# Blackjack Game - Full Stack Application

A modern multiplayer blackjack game built with React frontend and FastAPI backend, deployed on AWS.

## 🎮 **[Play Live Game →](http://blackjack-frontend-20250529-122009.s3-website-us-east-1.amazonaws.com)**

## 🎯 Features

- **Classic Blackjack Gameplay**: Standard blackjack rules with dealer AI
- **Multiplayer Support**: Up to 6 players per table with real-time updates
- **Authentication**: Guest and registered user support
- **Multiple Tables**: Beginner ($10-$500) and High Roller ($100-$1000) tables
- **Win Notifications**: Animated notifications for wins, blackjacks, and pushes
- **Betting Timer**: 15-second countdown for betting rounds
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Material-UI hosted on AWS S3
- **Backend**: FastAPI + Python deployed on AWS Lambda (Container)
- **Real-time Updates**: Polling-based game state synchronization
- **Authentication**: In-memory user management with token-based auth
- **Infrastructure**: AWS Lambda (ECR), API Gateway, S3 Static Website

## 📁 Project Structure

```
blackjack/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes (auth, game, tables)
│   │   ├── core/           # Core game logic and config
│   │   ├── models/         # Data models
│   │   ├── websocket/      # WebSocket handlers (unused in Lambda)
│   │   ├── main_lambda.py  # Lambda-specific FastAPI app
│   │   └── lambda_handler.py # AWS Lambda handler
│   ├── Dockerfile          # Multi-stage Docker build
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   ├── stores/         # State management
│   │   └── types/          # TypeScript types
│   └── package.json
├── deploy-lambda.ps1       # Backend deployment script
├── deploy-frontend.ps1     # Frontend deployment script
├── deploy-aws-s3.ps1       # S3 bucket creation script
└── docker-compose.yml     # Local development
```

## 🚀 Quick Start

### Local Development

1. **Clone and setup**:
   ```bash
   git clone <repo-url>
   cd blackjack
   ```

2. **Start with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Manual Setup

#### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main_lambda:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## 🎮 Game Features

### Core Blackjack Rules
- Standard deck of 52 cards
- Dealer hits on soft 17
- Blackjack pays 3:2
- Split pairs, Double down, Surrender options
- Player inactivity tracking (auto-removal after 2 missed hands)

### Multiplayer Features
- Up to 6 players per table
- Real-time game state updates via polling
- 15-second betting countdown timer
- Two table types: Beginner and High Roller
- Guest and registered user support

## 🚀 Deployment

### Current Production Setup
- **Backend**: AWS Lambda (Container) + ECR
- **Frontend**: AWS S3 Static Website
- **API**: AWS API Gateway with CORS configuration

### Deployment Commands
```powershell
# Deploy backend
./deploy-lambda.ps1

# Deploy frontend
./deploy-frontend.ps1
```

## 📝 API Documentation

Visit `/docs` when running locally for interactive API documentation.

## 🎯 Current Status

**Live Application**: http://blackjack-frontend-20250529-122009.s3-website-us-east-1.amazonaws.com

**Features Working**:
- ✅ User authentication (guest + registered)
- ✅ Multiple table support with different bet limits
- ✅ Complete blackjack gameplay (hit, stand, double, split, surrender)
- ✅ Win notifications with animations
- ✅ 15-second betting timer
- ✅ Player inactivity management
- ✅ Real-time game state updates

## 📄 License

MIT License - see LICENSE file for details
