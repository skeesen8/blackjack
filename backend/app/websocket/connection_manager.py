from fastapi import WebSocket
from typing import Dict, List, Set
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    """Manages WebSocket connections for real-time communication"""
    
    def __init__(self):
        # Table connections: table_id -> set of websockets
        self.table_connections: Dict[str, Set[WebSocket]] = {}
        
        # Chat connections: table_id -> set of websockets
        self.chat_connections: Dict[str, Set[WebSocket]] = {}
        
        # Player to websocket mapping
        self.player_connections: Dict[str, WebSocket] = {}
        
        # Websocket to player mapping
        self.websocket_players: Dict[WebSocket, str] = {}
    
    async def connect(self, websocket: WebSocket, table_id: str, player_id: str = None):
        """Connect a websocket to a table"""
        await websocket.accept()
        
        if table_id not in self.table_connections:
            self.table_connections[table_id] = set()
        
        self.table_connections[table_id].add(websocket)
        
        if player_id:
            self.player_connections[player_id] = websocket
            self.websocket_players[websocket] = player_id
        
        print(f"WebSocket connected to table {table_id}")
    
    async def connect_chat(self, websocket: WebSocket, table_id: str):
        """Connect a websocket to table chat"""
        await websocket.accept()
        
        if table_id not in self.chat_connections:
            self.chat_connections[table_id] = set()
        
        self.chat_connections[table_id].add(websocket)
        print(f"Chat WebSocket connected to table {table_id}")
    
    async def disconnect(self, websocket: WebSocket, table_id: str):
        """Disconnect a websocket from a table"""
        if table_id in self.table_connections:
            self.table_connections[table_id].discard(websocket)
            
            # Clean up empty table connections
            if not self.table_connections[table_id]:
                del self.table_connections[table_id]
        
        # Clean up player mappings
        if websocket in self.websocket_players:
            player_id = self.websocket_players[websocket]
            del self.websocket_players[websocket]
            if player_id in self.player_connections:
                del self.player_connections[player_id]
        
        print(f"WebSocket disconnected from table {table_id}")
    
    async def disconnect_chat(self, websocket: WebSocket, table_id: str):
        """Disconnect a websocket from table chat"""
        if table_id in self.chat_connections:
            self.chat_connections[table_id].discard(websocket)
            
            # Clean up empty chat connections
            if not self.chat_connections[table_id]:
                del self.chat_connections[table_id]
        
        print(f"Chat WebSocket disconnected from table {table_id}")
    
    async def send_to_player(self, player_id: str, message: dict):
        """Send message to a specific player"""
        if player_id in self.player_connections:
            websocket = self.player_connections[player_id]
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error sending to player {player_id}: {e}")
                # Remove broken connection
                await self._remove_broken_connection(websocket)
    
    async def broadcast_to_table(self, table_id: str, message: dict):
        """Broadcast message to all connections in a table"""
        if table_id not in self.table_connections:
            return
        
        # Add timestamp to message
        message["timestamp"] = datetime.utcnow().isoformat()
        
        broken_connections = []
        
        for websocket in self.table_connections[table_id].copy():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error broadcasting to table {table_id}: {e}")
                broken_connections.append(websocket)
        
        # Remove broken connections
        for websocket in broken_connections:
            await self._remove_broken_connection(websocket, table_id)
    
    async def broadcast_chat_to_table(self, table_id: str, message: dict):
        """Broadcast chat message to all chat connections in a table"""
        if table_id not in self.chat_connections:
            return
        
        # Add timestamp to message
        message["timestamp"] = datetime.utcnow().isoformat()
        
        broken_connections = []
        
        for websocket in self.chat_connections[table_id].copy():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                print(f"Error broadcasting chat to table {table_id}: {e}")
                broken_connections.append(websocket)
        
        # Remove broken connections
        for websocket in broken_connections:
            await self._remove_broken_chat_connection(websocket, table_id)
    
    async def broadcast_to_all_tables(self, message: dict):
        """Broadcast message to all connected tables"""
        message["timestamp"] = datetime.utcnow().isoformat()
        
        for table_id in list(self.table_connections.keys()):
            await self.broadcast_to_table(table_id, message)
    
    async def get_table_connection_count(self, table_id: str) -> int:
        """Get number of connections for a table"""
        return len(self.table_connections.get(table_id, set()))
    
    async def get_total_connections(self) -> int:
        """Get total number of connections"""
        total = 0
        for connections in self.table_connections.values():
            total += len(connections)
        return total
    
    async def _remove_broken_connection(self, websocket: WebSocket, table_id: str = None):
        """Remove a broken websocket connection"""
        # Remove from table connections
        if table_id and table_id in self.table_connections:
            self.table_connections[table_id].discard(websocket)
        else:
            # Search all tables
            for tid, connections in self.table_connections.items():
                connections.discard(websocket)
        
        # Remove from player mappings
        if websocket in self.websocket_players:
            player_id = self.websocket_players[websocket]
            del self.websocket_players[websocket]
            if player_id in self.player_connections:
                del self.player_connections[player_id]
    
    async def _remove_broken_chat_connection(self, websocket: WebSocket, table_id: str = None):
        """Remove a broken chat websocket connection"""
        if table_id and table_id in self.chat_connections:
            self.chat_connections[table_id].discard(websocket)
        else:
            # Search all tables
            for tid, connections in self.chat_connections.items():
                connections.discard(websocket)
    
    def get_connected_tables(self) -> List[str]:
        """Get list of table IDs with active connections"""
        return list(self.table_connections.keys())
    
    def is_player_connected(self, player_id: str) -> bool:
        """Check if a player is connected"""
        return player_id in self.player_connections 