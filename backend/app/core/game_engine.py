import random
from typing import List, Optional, Tuple, Dict, Any
from app.models.game import (
    Card, Hand, Player, Dealer, GameTable, GameState, 
    PlayerAction, Suit, CardRank, GameResult
)

class BlackjackEngine:
    """Core blackjack game engine handling all game logic"""
    
    def __init__(self):
        self.tables: Dict[str, GameTable] = {}
    
    def create_deck(self, num_decks: int = 6) -> List[Card]:
        """Create a shuffled deck of cards"""
        deck = []
        for _ in range(num_decks):
            for suit in Suit:
                for rank in CardRank:
                    deck.append(Card(suit=suit, rank=rank))
        
        random.shuffle(deck)
        return deck
    
    def create_table(self, name: str, min_bet: int = 10, max_bet: int = 500, max_players: int = 6) -> GameTable:
        """Create a new game table"""
        table = GameTable(
            name=name,
            min_bet=min_bet,
            max_bet=max_bet,
            max_players=max_players,
            deck=self.create_deck()
        )
        self.tables[table.id] = table
        return table
    
    def join_table(self, table_id: str, player_name: str, player_id: str = None) -> Tuple[bool, str, Optional[Player]]:
        """Add a player to a table"""
        if table_id not in self.tables:
            return False, "Table not found", None
        
        table = self.tables[table_id]
        
        # Check if player with same name already exists
        existing_player = next((p for p in table.players if p.name == player_name), None)
        if existing_player:
            return True, "Player already at table", existing_player
        
        # Also check by player_id if provided
        if player_id:
            existing_player_by_id = next((p for p in table.players if p.id == player_id), None)
            if existing_player_by_id:
                return True, "Player already at table", existing_player_by_id
        
        if table.is_full:
            return False, "Table is full", None
        
        # Find available seat
        occupied_seats = {p.seat_position for p in table.players}
        available_seat = next(i for i in range(1, table.max_players + 1) if i not in occupied_seats)
        
        player = Player(
            name=player_name,
            seat_position=available_seat
        )
        
        # Use provided player_id if available
        if player_id:
            player.id = player_id
        
        table.players.append(player)
        return True, "Joined successfully", player
    
    def leave_table(self, table_id: str, player_id: str) -> bool:
        """Remove a player from a table"""
        if table_id not in self.tables:
            return False
        
        table = self.tables[table_id]
        table.players = [p for p in table.players if p.id != player_id]
        
        # If no players left, reset table
        if not table.players:
            table.state = GameState.WAITING
            table.current_player_index = 0
        
        return True
    
    def place_bet(self, table_id: str, player_id: str, amount: int) -> Tuple[bool, str]:
        """Place a bet for a player"""
        if table_id not in self.tables:
            return False, "Table not found"
        
        table = self.tables[table_id]
        player = next((p for p in table.players if p.id == player_id), None)
        
        if not player:
            return False, "Player not found"
        
        if amount < table.min_bet or amount > table.max_bet:
            return False, f"Bet must be between {table.min_bet} and {table.max_bet}"
        
        if amount > player.chips:
            return False, "Insufficient chips"
        
        # Create initial hand with bet
        hand = Hand(bet=amount)
        player.hands = [hand]
        player.current_hand_index = 0
        player.chips -= amount
        
        # Check if all players have placed bets and auto-start game
        all_players_bet = all(
            len(p.hands) > 0 and p.hands[0].bet > 0 
            for p in table.players if p.is_active
        )
        
        if all_players_bet and len(table.active_players) > 0:
            # Auto-start the game
            self._auto_start_game(table)
        
        return True, "Bet placed successfully"
    
    def _auto_start_game(self, table: GameTable):
        """Automatically start the game when all players have bet"""
        if table.state != GameState.WAITING:
            return
        
        # Reset deck if running low
        if len(table.deck) < 20:
            table.deck = self.create_deck()
        
        # Reset dealer
        table.dealer = Dealer()
        
        # Deal initial cards
        self._deal_initial_cards(table)
        
        table.state = GameState.PLAYING
        table.current_player_index = 0
        
        # Check for immediate blackjacks
        self._check_initial_blackjacks(table)
    
    def start_game(self, table_id: str) -> Tuple[bool, str]:
        """Start a new game round"""
        if table_id not in self.tables:
            return False, "Table not found"
        
        table = self.tables[table_id]
        
        if len(table.active_players) == 0:
            return False, "No active players"
        
        # Check if all players have placed bets
        for player in table.active_players:
            if not player.hands or player.hands[0].bet == 0:
                return False, f"Player {player.name} hasn't placed a bet"
        
        # Reset deck if running low
        if len(table.deck) < 20:
            table.deck = self.create_deck()
        
        # Reset dealer
        table.dealer = Dealer()
        
        # Deal initial cards
        self._deal_initial_cards(table)
        
        table.state = GameState.PLAYING
        table.current_player_index = 0
        
        return True, "Game started"
    
    def _deal_initial_cards(self, table: GameTable):
        """Deal initial two cards to each player and dealer"""
        # Deal first card to each player
        for player in table.active_players:
            card = table.deck.pop()
            player.hands[0].cards.append(card)
        
        # Deal first card to dealer (face up)
        dealer_card = table.deck.pop()
        table.dealer.hand.cards.append(dealer_card)
        
        # Deal second card to each player
        for player in table.active_players:
            card = table.deck.pop()
            player.hands[0].cards.append(card)
        
        # Deal second card to dealer (face down)
        dealer_card = table.deck.pop()
        dealer_card.hidden = True
        table.dealer.hand.cards.append(dealer_card)
    
    def _check_initial_blackjacks(self, table: GameTable):
        """Check for blackjacks after initial deal"""
        dealer_has_blackjack = table.dealer.hand.is_blackjack
        
        # Check for player blackjacks but don't finish the game yet
        for player in table.active_players:
            hand = player.hands[0]
            if hand.is_blackjack:
                hand.is_finished = True
                # Don't pay out yet - wait for dealer to play
        
        # If dealer shows an Ace or 10-value card, check for blackjack later
        # For now, just set up the first player to act
        table.current_player_index = 0
        
        # Find first player who needs to act (skip blackjacks)
        self._find_next_active_player_initial(table)
    
    def _find_next_active_player_initial(self, table: GameTable):
        """Find the first player who needs to act (for initial setup)"""
        for i, player in enumerate(table.active_players):
            hand = player.current_hand
            if hand and not hand.is_finished:
                table.current_player_index = i
                return
        
        # If all players have blackjack or are finished, go to dealer
        self._dealer_turn(table)
    
    def player_action(self, table_id: str, player_id: str, action: PlayerAction, 
                     hand_index: int = 0) -> Tuple[bool, str, Dict[str, Any]]:
        """Process a player action"""
        if table_id not in self.tables:
            return False, "Table not found", {}
        
        table = self.tables[table_id]
        player = next((p for p in table.players if p.id == player_id), None)
        
        if not player:
            return False, "Player not found", {}
        
        if table.current_player != player:
            return False, "Not your turn", {}
        
        if hand_index >= len(player.hands):
            return False, "Invalid hand index", {}
        
        hand = player.hands[hand_index]
        result = {}
        
        if action == PlayerAction.HIT:
            success, message, data = self._hit(table, player, hand_index)
            result.update(data)
        elif action == PlayerAction.STAND:
            success, message, data = self._stand(table, player, hand_index)
            result.update(data)
        elif action == PlayerAction.DOUBLE:
            success, message, data = self._double_down(table, player, hand_index)
            result.update(data)
        elif action == PlayerAction.SPLIT:
            success, message, data = self._split(table, player, hand_index)
            result.update(data)
        elif action == PlayerAction.SURRENDER:
            success, message, data = self._surrender(table, player, hand_index)
            result.update(data)
        else:
            return False, "Invalid action", {}
        
        # Check if all players are done
        if self._all_players_done(table):
            self._dealer_turn(table)
            self._calculate_results(table)
            table.state = GameState.FINISHED
        
        return success, message, result
    
    def _hit(self, table: GameTable, player: Player, hand_index: int) -> Tuple[bool, str, Dict[str, Any]]:
        """Player hits"""
        hand = player.hands[hand_index]
        
        if hand.is_finished:
            return False, "Hand is already finished", {}
        
        # Deal card
        card = table.deck.pop()
        hand.cards.append(card)
        
        result = {"card": card.dict(), "hand_value": hand.value}
        
        # Check for bust
        if hand.is_bust:
            hand.is_finished = True
            result["bust"] = True
            self._next_hand_or_player(table, player)
        
        return True, "Card dealt", result
    
    def _stand(self, table: GameTable, player: Player, hand_index: int) -> Tuple[bool, str, Dict[str, Any]]:
        """Player stands"""
        hand = player.hands[hand_index]
        hand.is_finished = True
        
        self._next_hand_or_player(table, player)
        
        return True, "Player stands", {"hand_value": hand.value}
    
    def _double_down(self, table: GameTable, player: Player, hand_index: int) -> Tuple[bool, str, Dict[str, Any]]:
        """Player doubles down"""
        hand = player.hands[hand_index]
        
        if not hand.can_double:
            return False, "Cannot double down", {}
        
        if player.chips < hand.bet:
            return False, "Insufficient chips to double", {}
        
        # Double the bet
        player.chips -= hand.bet
        hand.bet *= 2
        hand.is_doubled = True
        
        # Deal one card
        card = table.deck.pop()
        hand.cards.append(card)
        hand.is_finished = True
        
        result = {
            "card": card.dict(),
            "hand_value": hand.value,
            "new_bet": hand.bet,
            "bust": hand.is_bust
        }
        
        self._next_hand_or_player(table, player)
        
        return True, "Doubled down", result
    
    def _split(self, table: GameTable, player: Player, hand_index: int) -> Tuple[bool, str, Dict[str, Any]]:
        """Player splits a pair"""
        hand = player.hands[hand_index]
        
        if not hand.can_split:
            return False, "Cannot split", {}
        
        if player.chips < hand.bet:
            return False, "Insufficient chips to split", {}
        
        # Create new hand with second card
        second_card = hand.cards.pop()
        new_hand = Hand(cards=[second_card], bet=hand.bet, is_split=True)
        hand.is_split = True
        
        # Deduct chips for second hand
        player.chips -= hand.bet
        
        # Insert new hand after current hand
        player.hands.insert(hand_index + 1, new_hand)
        
        # Deal new cards to both hands
        hand.cards.append(table.deck.pop())
        new_hand.cards.append(table.deck.pop())
        
        return True, "Hand split", {
            "first_hand": [card.dict() for card in hand.cards],
            "second_hand": [card.dict() for card in new_hand.cards],
            "first_value": hand.value,
            "second_value": new_hand.value
        }
    
    def _surrender(self, table: GameTable, player: Player, hand_index: int) -> Tuple[bool, str, Dict[str, Any]]:
        """Player surrenders"""
        hand = player.hands[hand_index]
        
        if len(hand.cards) != 2:
            return False, "Can only surrender with initial two cards", {}
        
        hand.is_surrendered = True
        hand.is_finished = True
        
        # Return half the bet
        player.chips += hand.bet // 2
        
        self._next_hand_or_player(table, player)
        
        return True, "Hand surrendered", {"chips_returned": hand.bet // 2}
    
    def _next_hand_or_player(self, table: GameTable, player: Player):
        """Move to next hand or next player"""
        # Use the centralized logic for finding next active player
        self._find_next_active_player(table)
    
    def _find_next_active_player(self, table: GameTable):
        """Find the next player who needs to act"""
        current_player = table.active_players[table.current_player_index]
        
        # Check if current player has more hands to play
        if current_player.current_hand_index + 1 < len(current_player.hands):
            current_player.current_hand_index += 1
            current_hand = current_player.current_hand
            if current_hand and not current_hand.is_finished:
                return  # Stay with same player, next hand
        
        # Move to next player
        starting_index = table.current_player_index
        
        while True:
            table.current_player_index += 1
            
            # If we've gone through all players, move to dealer turn
            if table.current_player_index >= len(table.active_players):
                self._dealer_turn(table)
                return
            
            current_player = table.active_players[table.current_player_index]
            current_player.current_hand_index = 0  # Reset to first hand
            current_hand = current_player.current_hand
            
            # If this player has an unfinished hand, they're the active player
            if current_hand and not current_hand.is_finished:
                return
            
            # If we've looped back to where we started, all players are done
            if table.current_player_index == starting_index:
                self._dealer_turn(table)
                return
    
    def _all_players_done(self, table: GameTable) -> bool:
        """Check if all players have finished their turns"""
        for player in table.active_players:
            for hand in player.hands:
                if not hand.is_finished:
                    return False
        return True
    
    def _dealer_turn(self, table: GameTable):
        """Play dealer's turn"""
        table.state = GameState.DEALER_TURN
        
        # Reveal hidden card (hole card)
        if len(table.dealer.hand.cards) > 1:
            table.dealer.hand.cards[1].hidden = False
        
        # Check if all players busted - if so, dealer doesn't need to play
        all_players_busted = all(
            all(hand.is_bust for hand in player.hands) 
            for player in table.active_players
        )
        
        if not all_players_busted:
            # Dealer hits until 17 or higher (including soft 17)
            while table.dealer.should_hit:
                if len(table.deck) == 0:
                    table.deck = self.create_deck()
                card = table.deck.pop()
                table.dealer.hand.cards.append(card)
        
        # Calculate final results
        self._calculate_results(table)
    
    def _calculate_results(self, table: GameTable) -> List[GameResult]:
        """Calculate game results and update player chips"""
        results = []
        dealer_value = table.dealer.hand.value
        dealer_blackjack = table.dealer.hand.is_blackjack
        dealer_bust = table.dealer.hand.is_bust
        
        for player in table.active_players:
            total_winnings = 0
            hand_results = []
            
            for hand in player.hands:
                winnings = 0
                
                if hand.is_surrendered:
                    # Already handled in surrender - player gets half bet back
                    result = "surrendered"
                    winnings = hand.bet // 2  # Half bet returned
                elif hand.is_bust:
                    result = "bust"
                    winnings = 0  # Lose entire bet
                elif hand.is_blackjack and not dealer_blackjack:
                    # Blackjack pays 3:2
                    winnings = hand.bet + int(hand.bet * 1.5)  # Original bet + 1.5x
                    result = "blackjack"
                elif hand.is_blackjack and dealer_blackjack:
                    # Push - return original bet
                    winnings = hand.bet
                    result = "push"
                elif dealer_bust and not hand.is_bust:
                    winnings = hand.bet * 2  # Original bet + winnings
                    result = "win"
                elif hand.value > dealer_value:
                    winnings = hand.bet * 2  # Original bet + winnings
                    result = "win"
                elif hand.value == dealer_value:
                    winnings = hand.bet  # Push - return original bet
                    result = "push"
                else:
                    result = "lose"
                    winnings = 0  # Lose entire bet
                
                # Update player chips
                player.chips += winnings
                total_winnings += winnings
                
                hand_results.append({
                    "cards": [card.dict() for card in hand.cards],
                    "value": hand.value,
                    "bet": hand.bet,
                    "winnings": winnings,
                    "result": result
                })
            
            results.append(GameResult(
                player_id=player.id,
                hands=hand_results,
                winnings=total_winnings,
                total_bet=player.total_bet
            ))
        
        # Set game state to finished
        table.state = GameState.FINISHED
        
        return results
    
    def get_table(self, table_id: str) -> Optional[GameTable]:
        """Get table by ID"""
        return self.tables.get(table_id)
    
    def get_all_tables(self) -> List[GameTable]:
        """Get all tables"""
        return list(self.tables.values())
    
    def reset_table(self, table_id: str) -> bool:
        """Reset table for new game"""
        if table_id not in self.tables:
            return False
        
        table = self.tables[table_id]
        
        # Reset all players
        for player in table.players:
            player.hands = []
            player.current_hand_index = 0
        
        # Reset dealer
        table.dealer = Dealer()
        
        # Reset game state
        table.state = GameState.WAITING
        table.current_player_index = 0
        
        return True
    
    def new_round(self, table_id: str) -> Tuple[bool, str]:
        """Start a new round - reset hands but keep players and chips"""
        if table_id not in self.tables:
            return False, "Table not found"
        
        table = self.tables[table_id]
        
        # Only allow new round if current game is finished
        if table.state != GameState.FINISHED:
            return False, "Current game is not finished"
        
        # Reset all players' hands but keep their chips
        for player in table.players:
            player.hands = []
            player.current_hand_index = 0
        
        # Reset dealer
        table.dealer = Dealer()
        
        # Reset game state to waiting for bets
        table.state = GameState.WAITING
        table.current_player_index = 0
        
        # Refresh deck if needed
        if len(table.deck) < 20:
            table.deck = self.create_deck()
        
        return True, "New round started - place your bets!"

# Global game engine instance
game_engine = BlackjackEngine() 