from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from pydantic import BaseModel

from app.core.game_engine import game_engine
from app.models.game import GameState
from app.api.auth import verify_token

router = APIRouter()

class TableSummary(BaseModel):
    id: str
    name: str
    state: GameState
    player_count: int
    max_players: int
    min_bet: int
    max_bet: int
    is_full: bool

class CreateTableRequest(BaseModel):
    name: str
    minBet: int
    maxBet: int
    maxPlayers: int

@router.get("/", response_model=dict)
async def list_tables(
    state: Optional[GameState] = Query(None, description="Filter by game state"),
    available_only: bool = Query(False, description="Show only tables with available seats")
):
    """List all tables with optional filtering"""
    try:
        tables = game_engine.get_all_tables()
        
        # Apply filters
        if state:
            tables = [t for t in tables if t.state == state]
        
        if available_only:
            tables = [t for t in tables if not t.is_full]
        
        # Create summary objects
        table_summaries = []
        for table in tables:
            summary = TableSummary(
                id=table.id,
                name=table.name,
                state=table.state,
                player_count=len(table.players),
                max_players=table.max_players,
                min_bet=table.min_bet,
                max_bet=table.max_bet,
                is_full=table.is_full
            )
            table_summaries.append(summary.dict())
        
        return {
            "success": True,
            "tables": table_summaries,
            "count": len(table_summaries),
            "filters": {
                "state": state,
                "available_only": available_only
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/available", response_model=dict)
async def get_available_tables():
    """Get tables that have available seats"""
    try:
        tables = game_engine.get_all_tables()
        available_tables = [t for t in tables if not t.is_full]
        
        table_summaries = []
        for table in available_tables:
            summary = TableSummary(
                id=table.id,
                name=table.name,
                state=table.state,
                player_count=len(table.players),
                max_players=table.max_players,
                min_bet=table.min_bet,
                max_bet=table.max_bet,
                is_full=table.is_full
            )
            table_summaries.append(summary.dict())
        
        return {
            "success": True,
            "tables": table_summaries,
            "count": len(table_summaries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active", response_model=dict)
async def get_active_tables():
    """Get tables that are currently in a game"""
    try:
        tables = game_engine.get_all_tables()
        active_tables = [
            t for t in tables 
            if t.state in [GameState.PLAYING, GameState.DEALER_TURN, GameState.BETTING]
        ]
        
        table_summaries = []
        for table in active_tables:
            summary = TableSummary(
                id=table.id,
                name=table.name,
                state=table.state,
                player_count=len(table.players),
                max_players=table.max_players,
                min_bet=table.min_bet,
                max_bet=table.max_bet,
                is_full=table.is_full
            )
            table_summaries.append(summary.dict())
        
        return {
            "success": True,
            "tables": table_summaries,
            "count": len(table_summaries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=dict)
async def get_table_stats():
    """Get overall table statistics"""
    try:
        tables = game_engine.get_all_tables()
        
        stats = {
            "total_tables": len(tables),
            "available_tables": len([t for t in tables if not t.is_full]),
            "full_tables": len([t for t in tables if t.is_full]),
            "active_games": len([
                t for t in tables 
                if t.state in [GameState.PLAYING, GameState.DEALER_TURN]
            ]),
            "waiting_tables": len([t for t in tables if t.state == GameState.WAITING]),
            "total_players": sum(len(t.players) for t in tables),
            "states": {}
        }
        
        # Count tables by state
        for state in GameState:
            stats["states"][state.value] = len([t for t in tables if t.state == state])
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{table_id}/players", response_model=dict)
async def get_table_players(table_id: str):
    """Get players at a specific table"""
    table = game_engine.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    players_info = []
    for player in table.players:
        player_info = {
            "id": player.id,
            "name": player.name,
            "chips": player.chips,
            "seat_position": player.seat_position,
            "is_active": player.is_active,
            "is_connected": player.is_connected,
            "total_bet": player.total_bet,
            "hand_count": len(player.hands)
        }
        players_info.append(player_info)
    
    return {
        "success": True,
        "table_id": table_id,
        "players": players_info,
        "player_count": len(players_info),
        "max_players": table.max_players
    }

@router.get("/{table_id}/spectate", response_model=dict)
async def spectate_table(table_id: str):
    """Get table information for spectators (limited view)"""
    table = game_engine.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Spectator view - hide hole cards and sensitive information
    spectator_view = {
        "id": table.id,
        "name": table.name,
        "state": table.state,
        "min_bet": table.min_bet,
        "max_bet": table.max_bet,
        "player_count": len(table.players),
        "max_players": table.max_players,
        "current_player_index": table.current_player_index,
        "dealer_upcard": None,
        "players": []
    }
    
    # Add dealer upcard if available
    if table.dealer.upcard:
        spectator_view["dealer_upcard"] = {
            "suit": table.dealer.upcard.suit,
            "rank": table.dealer.upcard.rank
        }
    
    # Add limited player information
    for i, player in enumerate(table.players):
        player_info = {
            "name": player.name,
            "seat_position": player.seat_position,
            "is_active": player.is_active,
            "hand_count": len(player.hands),
            "total_bet": player.total_bet if player.hands else 0,
            "is_current_player": i == table.current_player_index
        }
        
        # Add visible cards (not hole cards)
        if player.hands and table.state != GameState.WAITING:
            hand = player.hands[0]  # Show first hand only for spectators
            visible_cards = []
            for card in hand.cards:
                if not card.hidden:
                    visible_cards.append({
                        "suit": card.suit,
                        "rank": card.rank
                    })
            player_info["visible_cards"] = visible_cards
            player_info["hand_value"] = hand.value if visible_cards else None
        
        spectator_view["players"].append(player_info)
    
    return {
        "success": True,
        "spectator_view": spectator_view
    }

@router.post("/", response_model=dict)
async def create_table(table_data: CreateTableRequest, token_data: dict = Depends(verify_token)):
    """Create a new table"""
    try:
        # Get user info from token
        username = token_data.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Create table using game engine
        table = game_engine.create_table(
            name=table_data.name,
            min_bet=table_data.minBet,
            max_bet=table_data.maxBet,
            max_players=table_data.maxPlayers
        )
        
        return {
            "success": True,
            "message": "Table created successfully",
            "data": {
                "id": table.id,
                "name": table.name,
                "state": table.state,
                "min_bet": table.min_bet,
                "max_bet": table.max_bet,
                "max_players": table.max_players,
                "player_count": len(table.players),
                "is_full": table.is_full
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{table_id}/join", response_model=dict)
async def join_table(table_id: str, token_data: dict = Depends(verify_token)):
    """Join a table"""
    try:
        # Get user info from token
        username = token_data.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get table
        table = game_engine.get_table(table_id)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        
        # Check if table is full
        if table.is_full:
            raise HTTPException(status_code=400, detail="Table is full")
        
        # Add player to table (this would need to be implemented in game_engine)
        # For now, return success
        return {
            "success": True,
            "message": f"Successfully joined table {table.name}",
            "table_id": table_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{table_id}/leave", response_model=dict)
async def leave_table(table_id: str, token_data: dict = Depends(verify_token)):
    """Leave a table"""
    try:
        # Get user info from token
        username = token_data.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get table
        table = game_engine.get_table(table_id)
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        
        # Remove player from table (this would need to be implemented in game_engine)
        # For now, return success
        return {
            "success": True,
            "message": f"Successfully left table {table.name}",
            "table_id": table_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 