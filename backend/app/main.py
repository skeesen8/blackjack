from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import json
import asyncio
from typing import Dict, List
import uuid

from app.api import game, auth, tables
from app.websocket.connection_manager import ConnectionManager
from app.websocket.game_handler import GameHandler
from app.core.config import settings

app = FastAPI(
    title="Blackjack API",
    description="A real-time multiplayer blackjack game API",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your S3 bucket URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
manager = ConnectionManager()
game_handler = GameHandler(manager)

# Include API routes
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(tables.router, prefix="/api/tables", tags=["tables"])

@app.get("/")
async def root():
    return {"message": "Blackjack API is running!", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "blackjack-api"}

@app.websocket("/ws/{table_id}")
async def websocket_endpoint(websocket: WebSocket, table_id: str):
    """WebSocket endpoint for real-time game communication"""
    await manager.connect(websocket, table_id)
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            await game_handler.handle_message(table_id, websocket, message)
            
    except WebSocketDisconnect:
        await manager.disconnect(websocket, table_id)
        # Notify other players that someone left
        await manager.broadcast_to_table(
            table_id, 
            {
                "type": "player_left",
                "message": "A player has left the table"
            }
        )

@app.websocket("/ws/chat/{table_id}")
async def chat_websocket(websocket: WebSocket, table_id: str):
    """WebSocket endpoint for table chat"""
    await manager.connect_chat(websocket, table_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Broadcast chat message to all players at the table
            await manager.broadcast_chat_to_table(table_id, {
                "type": "chat_message",
                "player_id": message.get("player_id"),
                "player_name": message.get("player_name"),
                "message": message.get("message"),
                "timestamp": message.get("timestamp")
            })
            
    except WebSocketDisconnect:
        await manager.disconnect_chat(websocket, table_id)

# For AWS Lambda deployment
from mangum import Mangum
handler = Mangum(app) 