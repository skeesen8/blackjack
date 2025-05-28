from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel

from app.core.game_engine import game_engine
from app.models.game import GameTable, Player, PlayerAction

router = APIRouter()

class CreateTableRequest(BaseModel):
    name: str
    min_bet: int = 10
    max_bet: int = 500

class JoinTableRequest(BaseModel):
    player_name: str
    player_id: Optional[str] = None

class PlaceBetRequest(BaseModel):
    player_id: str
    amount: int

class PlayerActionRequest(BaseModel):
    player_id: str
    action: PlayerAction
    hand_index: int = 0

@router.post("/tables", response_model=dict)
async def create_table(request: CreateTableRequest):
    """Create a new game table"""
    try:
        table = game_engine.create_table(
            name=request.name,
            min_bet=request.min_bet,
            max_bet=request.max_bet
        )
        return {
            "success": True,
            "table": table.dict(),
            "message": "Table created successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables", response_model=dict)
async def get_all_tables():
    """Get all available tables"""
    try:
        tables = game_engine.get_all_tables()
        return {
            "success": True,
            "tables": [table.dict() for table in tables],
            "count": len(tables)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tables/{table_id}", response_model=dict)
async def get_table(table_id: str):
    """Get specific table information"""
    table = game_engine.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return {
        "success": True,
        "table": table.dict()
    }

@router.post("/tables/{table_id}/join", response_model=dict)
async def join_table(table_id: str, request: JoinTableRequest):
    """Join a table"""
    success, message, player = game_engine.join_table(table_id, request.player_name, request.player_id)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "success": True,
        "player": player.dict(),
        "message": message
    }

@router.post("/tables/{table_id}/leave", response_model=dict)
async def leave_table(table_id: str, player_id: str):
    """Leave a table"""
    success = game_engine.leave_table(table_id, player_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to leave table")
    
    return {
        "success": True,
        "message": "Left table successfully"
    }

@router.post("/tables/{table_id}/bet", response_model=dict)
async def place_bet(table_id: str, request: PlaceBetRequest):
    """Place a bet"""
    success, message = game_engine.place_bet(table_id, request.player_id, request.amount)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "success": True,
        "message": message,
        "amount": request.amount
    }

@router.post("/tables/{table_id}/start", response_model=dict)
async def start_game(table_id: str):
    """Start a new game round"""
    success, message = game_engine.start_game(table_id)
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    table = game_engine.get_table(table_id)
    return {
        "success": True,
        "message": message,
        "table": table.dict() if table else None
    }

@router.post("/tables/{table_id}/action", response_model=dict)
async def player_action(table_id: str, request: PlayerActionRequest):
    """Perform a player action"""
    success, message, result = game_engine.player_action(
        table_id, 
        request.player_id, 
        request.action, 
        request.hand_index
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    table = game_engine.get_table(table_id)
    return {
        "success": True,
        "message": message,
        "result": result,
        "table": table.dict() if table else None
    }

@router.post("/tables/{table_id}/reset", response_model=dict)
async def reset_table(table_id: str):
    """Reset a table for a new game"""
    success = game_engine.reset_table(table_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Table not found")
    
    table = game_engine.get_table(table_id)
    return {
        "success": True,
        "message": "Table reset successfully",
        "table": table.dict() if table else None
    }

@router.get("/tables/{table_id}/state", response_model=dict)
async def get_table_state(table_id: str, player_id: Optional[str] = None):
    """Get current table state"""
    table = game_engine.get_table(table_id)
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Could implement player-specific views here
    return {
        "success": True,
        "table": table.dict()
    }

@router.get("/health", response_model=dict)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "blackjack-game-api",
        "active_tables": len(game_engine.get_all_tables())
    } 