from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

from app.core.config import settings

router = APIRouter()
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory user storage (replace with database in production)
users_db = {}

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

class User(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    chips: int = 1000
    created_at: datetime

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token"""
    try:
        payload = jwt.decode(
            credentials.credentials, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/register", response_model=dict)
async def register(user_data: UserCreate):
    """Register a new user"""
    if user_data.username in users_db:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user
    user_id = f"user_{len(users_db) + 1}"
    user = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "hashed_password": hashed_password,
        "chips": settings.DEFAULT_STARTING_CHIPS,
        "created_at": datetime.utcnow()
    }
    
    users_db[user_data.username] = user
    
    # Create access token
    access_token = create_access_token(data={"sub": user_data.username})
    
    return {
        "success": True,
        "message": "User registered successfully",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "chips": user["chips"]
        },
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.post("/login", response_model=dict)
async def login(user_data: UserLogin):
    """Login user"""
    user = users_db.get(user_data.username)
    
    if not user or not verify_password(user_data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create access token
    access_token = create_access_token(data={"sub": user_data.username})
    
    return {
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "chips": user["chips"]
        },
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.get("/me", response_model=dict)
async def get_current_user(token_data: dict = Depends(verify_token)):
    """Get current user information"""
    username = token_data.get("sub")
    user = users_db.get(username)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "chips": user["chips"],
            "created_at": user["created_at"].isoformat()
        }
    }

@router.post("/refresh", response_model=dict)
async def refresh_token(token_data: dict = Depends(verify_token)):
    """Refresh access token"""
    username = token_data.get("sub")
    
    if not username or username not in users_db:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Create new access token
    access_token = create_access_token(data={"sub": username})
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.get("/users", response_model=dict)
async def get_all_users(token_data: dict = Depends(verify_token)):
    """Get all users (for admin/debugging)"""
    users_list = []
    for username, user in users_db.items():
        users_list.append({
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "chips": user["chips"],
            "created_at": user["created_at"].isoformat()
        })
    
    return {
        "success": True,
        "users": users_list,
        "count": len(users_list)
    }

# Guest user functionality for quick play
@router.post("/guest", response_model=dict)
async def create_guest_user():
    """Create a guest user for quick play"""
    import uuid
    guest_id = str(uuid.uuid4())
    guest_username = f"Guest_{guest_id[:8]}"
    
    # Create guest user
    user = {
        "id": guest_id,
        "username": guest_username,
        "email": None,
        "hashed_password": None,
        "chips": settings.DEFAULT_STARTING_CHIPS,
        "created_at": datetime.utcnow(),
        "is_guest": True
    }
    
    users_db[guest_username] = user
    
    # Create access token
    access_token = create_access_token(data={"sub": guest_username})
    
    return {
        "success": True,
        "message": "Guest user created",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "chips": user["chips"],
            "is_guest": True
        },
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    } 