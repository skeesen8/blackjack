from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import game, auth, tables
from app.core.config import settings

app = FastAPI(
    title="Blackjack API",
    description="A real-time multiplayer blackjack game API (Lambda version - no WebSockets)",
    version="1.0.0"
)

# CORS middleware - Updated to include S3 website domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # Allow all for development
        "http://blackjack-frontend-20250529-101344.s3-website-us-east-1.amazonaws.com",  # Your S3 website
        "https://blackjack-frontend-20250529-101344.s3-website-us-east-1.amazonaws.com",  # HTTPS version
        "http://localhost:3000",  # For local development
        "https://localhost:3000"  # HTTPS local
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Include API routes (REST endpoints only)
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(tables.router, prefix="/api/tables", tags=["tables"])

@app.get("/")
async def root():
    return {"message": "Blackjack API is running! (Lambda version)", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "blackjack-api-lambda"}

# Note: WebSocket endpoints removed for Lambda compatibility
# For real-time features, you would need:
# 1. API Gateway WebSocket API with separate Lambda functions
# 2. Or use polling with REST endpoints
# 3. Or deploy to ECS/Fargate instead of Lambda 