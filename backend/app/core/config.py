from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Blackjack API"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"
    
    # Database
    DATABASE_URL: Optional[str] = None
    
    # AWS Settings
    AWS_REGION: str = "us-east-1"
    DYNAMODB_TABLE_PREFIX: str = "blackjack"
    
    # Redis (for session management)
    REDIS_URL: Optional[str] = None
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:8000"]
    
    # Game Settings
    MAX_PLAYERS_PER_TABLE: int = 6
    DEFAULT_STARTING_CHIPS: int = 1000
    MIN_BET: int = 10
    MAX_BET: int = 500
    
    model_config = {"env_file": ".env", "case_sensitive": True}

settings = Settings() 