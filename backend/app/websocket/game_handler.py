from fastapi import WebSocket
from typing import Dict, Any
import json
from datetime import datetime
import asyncio

from app.websocket.connection_manager import ConnectionManager
from app.core.game_engine import game_engine
from app.models.game import PlayerAction, GameState

class GameHandler:
    """Handles WebSocket game messages and coordinates with game engine"""
    
    def __init__(self, connection_manager: ConnectionManager):
        self.connection_manager = connection_manager
    
    async def handle_message(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle incoming WebSocket message"""
        message_type = message.get("type")
        
        if message_type == "join_table":
            await self._handle_join_table(table_id, websocket, message)
        elif message_type == "leave_table":
            await self._handle_leave_table(table_id, websocket, message)
        elif message_type == "place_bet":
            await self._handle_place_bet(table_id, websocket, message)
        elif message_type == "start_game":
            await self._handle_start_game(table_id, websocket, message)
        elif message_type == "player_action":
            await self._handle_player_action(table_id, websocket, message)
        elif message_type == "get_table_state":
            await self._handle_get_table_state(table_id, websocket, message)
        elif message_type == "reset_table":
            await self._handle_reset_table(table_id, websocket, message)
        elif message_type == "new_round":
            await self._handle_new_round(table_id, websocket, message)
        elif message_type == "chat_message":
            await self._handle_chat_message(table_id, websocket, message)
        else:
            await self._send_error(websocket, f"Unknown message type: {message_type}")
    
    async def _handle_join_table(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle player joining table"""
        player_name = message.get("player_name")
        player_id = message.get("player_id")
        
        if not player_name:
            await self._send_error(websocket, "Player name is required")
            return
        
        # Get or create table
        table = game_engine.get_table(table_id)
        if not table:
            table = game_engine.create_table(f"Table {table_id}")
        
        # Join table with player_id if provided
        success, msg, player = game_engine.join_table(table_id, player_name, player_id)
        
        if success:
            # Update connection manager with player ID
            self.connection_manager.player_connections[player.id] = websocket
            self.connection_manager.websocket_players[websocket] = player.id
            
            # Send success response to player
            await websocket.send_text(json.dumps({
                "type": "join_table_response",
                "success": True,
                "player": player.dict(),
                "message": msg
            }))
            
            # Only broadcast if this is a new player (not already at table)
            if "already at table" not in msg.lower():
                # Broadcast to all players at table
                await self.connection_manager.broadcast_to_table(table_id, {
                    "type": "player_joined",
                    "player": player.dict(),
                    "table_state": self._get_table_state_dict(table)
                })
            else:
                # Just send current table state to the reconnecting player
                await websocket.send_text(json.dumps({
                    "type": "table_state",
                    "table_state": self._get_table_state_dict(table)
                }))
        else:
            await self._send_error(websocket, msg)
    
    async def _handle_leave_table(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle player leaving table"""
        player_id = message.get("player_id")
        
        if not player_id:
            await self._send_error(websocket, "Player ID is required")
            return
        
        success = game_engine.leave_table(table_id, player_id)
        
        if success:
            table = game_engine.get_table(table_id)
            
            # Send response to leaving player
            await websocket.send_text(json.dumps({
                "type": "leave_table_response",
                "success": True,
                "message": "Left table successfully"
            }))
            
            # Broadcast to remaining players
            await self.connection_manager.broadcast_to_table(table_id, {
                "type": "player_left",
                "player_id": player_id,
                "table_state": self._get_table_state_dict(table) if table else None
            })
        else:
            await self._send_error(websocket, "Failed to leave table")
    
    async def _handle_place_bet(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle player placing bet"""
        player_id = message.get("player_id")
        amount = message.get("amount")
        
        if not player_id or amount is None:
            await self._send_error(websocket, "Player ID and amount are required")
            return
        
        # Get table state before bet
        table_before = game_engine.get_table(table_id)
        was_waiting = table_before.state == "waiting" if table_before else False
        
        success, msg = game_engine.place_bet(table_id, player_id, amount)
        
        if success:
            table = game_engine.get_table(table_id)
            
            # Send response to player
            await websocket.send_text(json.dumps({
                "type": "place_bet_response",
                "success": True,
                "message": msg,
                "amount": amount
            }))
            
            # Broadcast to all players
            await self.connection_manager.broadcast_to_table(table_id, {
                "type": "bet_placed",
                "player_id": player_id,
                "amount": amount,
                "table_state": self._get_table_state_dict(table)
            })
            
            # If game auto-started, broadcast game start
            if was_waiting and table.state == "playing":
                await self.connection_manager.broadcast_to_table(table_id, {
                    "type": "game_started",
                    "message": "Game started! Cards have been dealt.",
                    "table_state": self._get_table_state_dict(table)
                })
                
                # Send individual player views (hide dealer's hole card)
                for player in table.players:
                    player_view = self._get_player_view(table, player.id)
                    await self.connection_manager.send_to_player(player.id, {
                        "type": "cards_dealt",
                        "table_state": player_view
                    })
        else:
            await self._send_error(websocket, msg)
    
    async def _handle_start_game(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle starting a new game"""
        success, msg = game_engine.start_game(table_id)
        
        if success:
            table = game_engine.get_table(table_id)
            
            # Broadcast game start to all players
            await self.connection_manager.broadcast_to_table(table_id, {
                "type": "game_started",
                "message": msg,
                "table_state": self._get_table_state_dict(table)
            })
            
            # Send individual hands to each player (hide other players' cards if needed)
            for player in table.players:
                player_view = self._get_player_view(table, player.id)
                await self.connection_manager.send_to_player(player.id, {
                    "type": "game_state_update",
                    "table_state": player_view
                })
        else:
            await self._send_error(websocket, msg)
    
    async def _handle_player_action(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle player game action"""
        player_id = message.get("player_id")
        action_str = message.get("action")
        hand_index = message.get("hand_index", 0)
        
        if not player_id or not action_str:
            await self._send_error(websocket, "Player ID and action are required")
            return
        
        try:
            action = PlayerAction(action_str)
        except ValueError:
            await self._send_error(websocket, f"Invalid action: {action_str}")
            return
        
        success, msg, result = game_engine.player_action(table_id, player_id, action, hand_index)
        
        if success:
            table = game_engine.get_table(table_id)
            
            # Send action result to player
            await websocket.send_text(json.dumps({
                "type": "player_action_response",
                "success": True,
                "action": action_str,
                "result": result,
                "message": msg
            }))
            
            # Broadcast action to all players
            await self.connection_manager.broadcast_to_table(table_id, {
                "type": "player_action_broadcast",
                "player_id": player_id,
                "action": action_str,
                "hand_index": hand_index,
                "result": result,
                "table_state": self._get_table_state_dict(table)
            })
            
            # If game is finished, send results
            if table.state == GameState.FINISHED:
                await self._handle_game_finished(table_id, table)
        else:
            await self._send_error(websocket, msg)
    
    async def _handle_get_table_state(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle request for current table state"""
        table = game_engine.get_table(table_id)
        player_id = message.get("player_id")
        
        if table:
            if player_id:
                # Send player-specific view
                player_view = self._get_player_view(table, player_id)
                await websocket.send_text(json.dumps({
                    "type": "table_state",
                    "table_state": player_view
                }))
            else:
                # Send general table state
                await websocket.send_text(json.dumps({
                    "type": "table_state",
                    "table_state": self._get_table_state_dict(table)
                }))
        else:
            await self._send_error(websocket, "Table not found")
    
    async def _handle_reset_table(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle table reset"""
        success = game_engine.reset_table(table_id)
        
        if success:
            table = game_engine.get_table(table_id)
            
            # Broadcast reset to all players
            await self.connection_manager.broadcast_to_table(table_id, {
                "type": "table_reset",
                "message": "Table has been reset",
                "table_state": self._get_table_state_dict(table)
            })
        else:
            await self._send_error(websocket, "Failed to reset table")
    
    async def _handle_game_finished(self, table_id: str, table):
        """Handle game completion"""
        results = game_engine._calculate_results(table)
        
        # Prepare detailed results for broadcast
        game_results = []
        for result in results:
            player = next((p for p in table.players if p.id == result.player_id), None)
            if player:
                game_results.append({
                    "player_id": result.player_id,
                    "player_name": player.name,
                    "hands": result.hands,
                    "total_winnings": result.winnings,
                    "total_bet": result.total_bet,
                    "new_chip_count": player.chips
                })
        
        # Send results to all players
        await self.connection_manager.broadcast_to_table(table_id, {
            "type": "game_finished",
            "message": "Game finished! Check your results.",
            "results": game_results,
            "dealer_hand": {
                "cards": [self._get_card_dict(card) for card in table.dealer.hand.cards],
                "value": table.dealer.hand.value,
                "is_blackjack": table.dealer.hand.is_blackjack,
                "is_bust": table.dealer.hand.is_bust
            },
            "table_state": self._get_table_state_dict(table)
        })
        
        # Auto-start new round after 5 seconds
        await asyncio.sleep(5)
        
        # Check if table still exists and has players
        current_table = game_engine.get_table(table_id)
        if current_table and len(current_table.players) > 0:
            success, msg = game_engine.new_round(table_id)
            if success:
                await self.connection_manager.broadcast_to_table(table_id, {
                    "type": "new_round_started",
                    "message": "New round starting! Place your bets.",
                    "table_state": self._get_table_state_dict(current_table)
                })
    
    async def _handle_chat_message(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle chat message"""
        player_id = message.get("player_id")
        player_name = message.get("player_name")
        chat_message = message.get("message")
        timestamp = message.get("timestamp")
        
        if not player_name or not chat_message:
            await self._send_error(websocket, "Player name and message are required")
            return
        
        # Broadcast chat message to all players at the table
        await self.connection_manager.broadcast_to_table(table_id, {
            "type": "chat_message",
            "player_id": player_id,
            "player_name": player_name,
            "message": chat_message,
            "timestamp": timestamp or datetime.utcnow().isoformat()
        })
    
    async def _handle_new_round(self, table_id: str, websocket: WebSocket, message: Dict[str, Any]):
        """Handle starting a new round"""
        success, msg = game_engine.new_round(table_id)
        
        if success:
            table = game_engine.get_table(table_id)
            
            # Broadcast new round to all players
            await self.connection_manager.broadcast_to_table(table_id, {
                "type": "new_round_started",
                "message": msg,
                "table_state": self._get_table_state_dict(table)
            })
        else:
            await self._send_error(websocket, msg)
    
    def _get_table_state_dict(self, table) -> Dict[str, Any]:
        """Get table state as dictionary"""
        if not table:
            return {}
        
        return {
            "id": table.id,
            "name": table.name,
            "state": table.state,
            "min_bet": table.min_bet,
            "max_bet": table.max_bet,
            "max_players": table.max_players,
            "current_player_index": table.current_player_index,
            "players": [self._get_player_dict(player) for player in table.players],
            "dealer": self._get_dealer_dict(table.dealer),
            "deck_count": len(table.deck)
        }
    
    def _get_player_view(self, table, player_id: str) -> Dict[str, Any]:
        """Get table state from a specific player's perspective"""
        table_dict = self._get_table_state_dict(table)
        
        # Hide dealer's hole card if game is in progress and card is marked as hidden
        if table.state in ["playing"] and table_dict.get("dealer"):
            dealer_hand = table_dict["dealer"]["hand"]
            if dealer_hand and dealer_hand.get("cards"):
                # Create a copy of the cards to avoid modifying the original
                cards_copy = []
                for i, card in enumerate(dealer_hand["cards"]):
                    if card.get("hidden", False):
                        # Replace hidden card with a placeholder
                        cards_copy.append({
                            "suit": "hidden",
                            "rank": "?",
                            "value": 0,
                            "hidden": True
                        })
                    else:
                        cards_copy.append(card)
                dealer_hand["cards"] = cards_copy
        
        return table_dict
    
    def _get_player_dict(self, player) -> Dict[str, Any]:
        """Get player as dictionary"""
        return {
            "id": player.id,
            "name": player.name,
            "chips": player.chips,
            "seat_position": player.seat_position,
            "is_active": player.is_active,
            "is_connected": player.is_connected,
            "current_hand_index": player.current_hand_index,
            "hands": [self._get_hand_dict(hand) for hand in player.hands],
            "total_bet": player.total_bet
        }
    
    def _get_hand_dict(self, hand) -> Dict[str, Any]:
        """Get hand as dictionary"""
        return {
            "cards": [self._get_card_dict(card) for card in hand.cards],
            "value": hand.value,
            "bet": hand.bet,
            "is_split": hand.is_split,
            "is_doubled": hand.is_doubled,
            "is_surrendered": hand.is_surrendered,
            "is_finished": hand.is_finished,
            "is_blackjack": hand.is_blackjack,
            "is_bust": hand.is_bust,
            "can_split": hand.can_split,
            "can_double": hand.can_double
        }
    
    def _get_dealer_dict(self, dealer) -> Dict[str, Any]:
        """Get dealer as dictionary"""
        return {
            "hand": self._get_hand_dict(dealer.hand),
            "upcard": self._get_card_dict(dealer.upcard) if dealer.upcard else None,
            "should_hit": dealer.should_hit
        }
    
    def _get_card_dict(self, card) -> Dict[str, Any]:
        """Get card as dictionary"""
        if not card:
            return None
        
        return {
            "suit": card.suit,
            "rank": card.rank,
            "value": card.value,
            "hidden": card.hidden
        }
    
    async def _send_error(self, websocket: WebSocket, message: str):
        """Send error message to websocket"""
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": message,
                "timestamp": datetime.utcnow().isoformat()
            }))
        except Exception as e:
            print(f"Error sending error message: {e}") 