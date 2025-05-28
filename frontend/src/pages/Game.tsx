import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Chip,
  Avatar,
  Grid,
  Card,
  CardContent,
  TextField,
  IconButton,
  Slider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import {
  Send as SendIcon,
  ExitToApp as LeaveIcon,
  Visibility as SpectateIcon,
  Casino as ChipIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { tableService } from '../services/api';

// Types for the game
interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' | 'hidden';
  rank: string;
  hidden?: boolean;
}

interface Hand {
  cards: Card[];
  value: number;
  bet: number;
  isFinished: boolean;
  isBlackjack: boolean;
  isBust: boolean;
}

interface Player {
  id: string;
  name: string;
  chips: number;
  hands: Hand[];
  seatPosition: number;
  isActive: boolean;
  isCurrentPlayer: boolean;
}

interface GameState {
  id: string;
  tableId: string;
  status: 'waiting' | 'betting' | 'dealing' | 'playing' | 'finished' | 'dealer_turn';
  players: Player[];
  dealerHand: Hand;
  currentPlayerId: string | null;
  minBet: number;
  maxBet: number;
}

const Game = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSpectating, setIsSpectating] = useState(false);
  const [gameResults, setGameResults] = useState<any>(null);
  
  // Betting state
  const [betAmount, setBetAmount] = useState(10);
  const [showBettingDialog, setShowBettingDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{id: string, player: string, message: string, timestamp: Date}>>([]);
  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // WebSocket connection
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasJoinedTable, setHasJoinedTable] = useState(false);

  useEffect(() => {
    if (!tableId) return;
    
    // Initialize game state and WebSocket connection
    initializeGame();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tableId]);

  useEffect(() => {
    // Auto-scroll chat to bottom
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const initializeGame = async () => {
    try {
      setLoading(true);
      
      // First, try to join the table via API
      if (user) {
        try {
          await tableService.joinTable(tableId!);
        } catch (err) {
          console.log('Could not join table via API, continuing with WebSocket connection');
        }
      }
      
      // Mock game state for now - in real implementation, fetch from API
      const mockGameState: GameState = {
        id: 'game-1',
        tableId: tableId!,
        status: 'waiting',
        players: [
          {
            id: user?.id || 'player-1',
            name: user?.username || 'You',
            chips: user?.chips || 1000,
            hands: [],
            seatPosition: 1,
            isActive: true,
            isCurrentPlayer: false
          }
        ],
        dealerHand: {
          cards: [],
          value: 0,
          bet: 0,
          isFinished: false,
          isBlackjack: false,
          isBust: false
        },
        currentPlayerId: null,
        minBet: 10,
        maxBet: 500
      };
      
      setGameState(mockGameState);
      setError(null);
    } catch (err) {
      setError('Failed to load game');
      console.error('Error loading game:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    if (!tableId || !user || isConnected) return;
    
    const wsUrl = `ws://localhost:8000/ws/${tableId}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Only send join message if we haven't joined yet
      if (!hasJoinedTable) {
        ws.send(JSON.stringify({
          type: 'join_table',
          player_name: user.username,
          player_id: user.id
        }));
      } else {
        // Just request current table state
        ws.send(JSON.stringify({
          type: 'get_table_state',
          player_id: user.id
        }));
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Reset join status on disconnect so we can rejoin on reconnect
      setHasJoinedTable(false);
      // Attempt to reconnect after 3 seconds
      setTimeout(() => {
        if (!isConnected) {
          connectWebSocket();
        }
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    wsRef.current = ws;
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'join_table_response':
        if (message.success) {
          console.log('Successfully joined table:', message.message);
          setHasJoinedTable(true);
        } else {
          setError('Failed to join table: ' + message.message);
        }
        break;
      case 'game_update':
      case 'table_state':
      case 'cards_dealt':
        const convertedState = convertBackendTableState(message.gameState || message.table_state);
        setGameState(convertedState);
        break;
      case 'chat_message':
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          player: message.playerName || message.player_name,
          message: message.message,
          timestamp: new Date(message.timestamp)
        }]);
        break;
      case 'player_joined':
        console.log('Player joined:', message.player);
        if (message.table_state) {
          // Convert backend table state to frontend format
          const convertedState = convertBackendTableState(message.table_state);
          setGameState(convertedState);
        } else if (message.player) {
          // Add player to current game state
          setGameState(prev => {
            if (!prev) return prev;
            const convertedPlayer = convertBackendPlayer(message.player);
            const existingPlayerIndex = prev.players.findIndex(p => p.id === convertedPlayer.id);
            
            if (existingPlayerIndex >= 0) {
              // Update existing player
              const updatedPlayers = [...prev.players];
              updatedPlayers[existingPlayerIndex] = convertedPlayer;
              return { ...prev, players: updatedPlayers };
            } else {
              // Add new player
              return { ...prev, players: [...prev.players, convertedPlayer] };
            }
          });
        }
        break;
      case 'player_left':
        console.log('Player left:', message.player_id);
        if (message.table_state) {
          const convertedState = convertBackendTableState(message.table_state);
          setGameState(convertedState);
        }
        break;
      case 'bet_placed':
        console.log('Bet placed:', message.amount);
        if (message.table_state) {
          const convertedState = convertBackendTableState(message.table_state);
          setGameState(convertedState);
        }
        break;
      case 'game_started':
        console.log('Game started:', message.message);
        if (message.table_state) {
          const convertedState = convertBackendTableState(message.table_state);
          setGameState(convertedState);
        }
        break;
      case 'player_action_broadcast':
        console.log('Player action:', message.action);
        if (message.table_state) {
          const convertedState = convertBackendTableState(message.table_state);
          setGameState(convertedState);
        }
        break;
      case 'game_finished':
        console.log('Game finished:', message.message);
        if (message.table_state) {
          const convertedState = convertBackendTableState(message.table_state);
          setGameState(convertedState);
        }
        if (message.results) {
          setGameResults(message);
          setShowResultsDialog(true);
        }
        break;
      case 'new_round_started':
        console.log('New round started:', message.message);
        if (message.table_state) {
          const convertedState = convertBackendTableState(message.table_state);
          setGameState(convertedState);
        }
        setGameResults(null);
        setShowResultsDialog(false);
        break;
      case 'error':
        setError(message.message);
        break;
      default:
        console.log('Unknown message type:', message.type, message);
    }
  };

  const sendWebSocketMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handlePlaceBet = () => {
    if (!gameState || !user) return;
    
    sendWebSocketMessage({
      type: 'place_bet',
      player_id: user.id,
      amount: betAmount
    });
    
    setShowBettingDialog(false);
  };

  const handlePlayerAction = (action: string) => {
    if (!gameState || !user) return;
    
    sendWebSocketMessage({
      type: 'player_action',
      player_id: user.id,
      action: action
    });
  };

  const handleSendChat = () => {
    if (!chatMessage.trim() || !user) return;
    
    sendWebSocketMessage({
      type: 'chat_message',
      player_id: user.id,
      player_name: user.username,
      message: chatMessage,
      timestamp: new Date().toISOString()
    });
    
    setChatMessage('');
  };

  const handleLeaveTable = () => {
    // Send leave message if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && user) {
      sendWebSocketMessage({
        type: 'leave_table',
        player_id: user.id
      });
    }
    
    // Reset connection state
    setHasJoinedTable(false);
    setIsConnected(false);
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    navigate('/tables');
  };

  const handlePlayAgain = () => {
    if (!user) return;
    
    sendWebSocketMessage({
      type: 'new_round'
    });
  };

  // Conversion functions for backend data
  const convertBackendPlayer = (backendPlayer: any): Player => {
    return {
      id: backendPlayer.id,
      name: backendPlayer.name,
      chips: backendPlayer.chips,
      hands: backendPlayer.hands ? backendPlayer.hands.map(convertBackendHand) : [],
      seatPosition: backendPlayer.seat_position || 1,
      isActive: backendPlayer.is_active !== false,
      isCurrentPlayer: backendPlayer.is_current_player || false
    };
  };

  const convertBackendHand = (backendHand: any): Hand => {
    return {
      cards: backendHand.cards || [],
      value: backendHand.value || 0,
      bet: backendHand.bet || 0,
      isFinished: backendHand.is_finished || false,
      isBlackjack: backendHand.is_blackjack || false,
      isBust: backendHand.is_bust || false
    };
  };

  const convertBackendTableState = (backendState: any): GameState => {
    const players = backendState.players ? backendState.players.map((player: any, index: number) => ({
      ...convertBackendPlayer(player),
      isCurrentPlayer: index === backendState.current_player_index && backendState.state === 'playing'
    })) : [];

    return {
      id: backendState.id || 'game-1',
      tableId: backendState.table_id || tableId!,
      status: backendState.state || backendState.status || 'waiting',
      players: players,
      dealerHand: backendState.dealer ? convertBackendHand(backendState.dealer.hand || backendState.dealer) : {
        cards: [],
        value: 0,
        bet: 0,
        isFinished: false,
        isBlackjack: false,
        isBust: false
      },
      currentPlayerId: backendState.current_player_id || null,
      minBet: backendState.min_bet || 10,
      maxBet: backendState.max_bet || 500
    };
  };

  const renderCard = (card: Card, index: number) => {
    const suitSymbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    
    const suitColors = {
      hearts: '#e53e3e',
      diamonds: '#e53e3e',
      clubs: '#2d3748',
      spades: '#2d3748'
    };

    if (card.hidden || card.suit === 'hidden') {
      return (
        <Box
          key={index}
          sx={{
            width: 60,
            height: 84,
            backgroundColor: '#1a365d',
            border: '2px solid #2d3748',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 -15px 0 0',
            position: 'relative',
            zIndex: 10 - index,
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold'
          }}
        >
          ?
        </Box>
      );
    }

    return (
      <Box
        key={index}
        sx={{
          width: 60,
          height: 84,
          backgroundColor: 'white',
          border: '2px solid #2d3748',
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 0.5,
          margin: '0 -15px 0 0',
          position: 'relative',
          zIndex: 10 - index,
          color: suitColors[card.suit]
        }}
      >
        <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 'bold' }}>
          {card.rank}
        </Typography>
        <Typography variant="h6" sx={{ fontSize: '16px' }}>
          {suitSymbols[card.suit]}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 'bold', transform: 'rotate(180deg)' }}>
          {card.rank}
        </Typography>
      </Box>
    );
  };

  const renderHand = (hand: Hand | null | undefined, label: string) => {
    if (!hand) {
      return (
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No cards
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          {label} {hand.value > 0 && `(${hand.value})`}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          {hand.cards && hand.cards.map((card, index) => renderCard(card, index))}
        </Box>
        {hand.bet > 0 && (
          <Chip
            icon={<ChipIcon />}
            label={`Bet: $${hand.bet}`}
            color="primary"
            size="small"
          />
        )}
        {hand.isBlackjack && <Chip label="Blackjack!" color="success" size="small" sx={{ ml: 1 }} />}
        {hand.isBust && <Chip label="Bust!" color="error" size="small" sx={{ ml: 1 }} />}
      </Box>
    );
  };

  const renderPlayerSeat = (player: Player) => (
    <Card
      key={player.id}
      sx={{
        minHeight: 200,
        backgroundColor: player.isCurrentPlayer ? 'action.selected' : 'background.paper',
        border: player.isCurrentPlayer ? '2px solid' : '1px solid',
        borderColor: player.isCurrentPlayer ? 'primary.main' : 'divider'
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ mr: 1, bgcolor: 'primary.main' }}>
            {player.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle1">{player.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              ${player.chips} chips
            </Typography>
          </Box>
        </Box>
        
        {player.hands.map((hand, index) => (
          <Box key={index}>
            {renderHand(hand, `Hand ${index + 1}`)}
          </Box>
        ))}
        
        {player.hands.length === 0 && gameState?.status === 'waiting' && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Waiting for game to start
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  if (!gameState) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Failed to load game</Alert>
      </Container>
    );
  }

  const currentPlayer = gameState.players.find(p => p.id === user?.id);
  const isCurrentPlayerTurn = currentPlayer?.isCurrentPlayer;

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Blackjack Table</Typography>
          {gameState.status === 'playing' && (
            <Typography variant="h6" color="primary">
              {isCurrentPlayerTurn ? "Your turn!" : `Waiting for ${gameState.players.find(p => p.isCurrentPlayer)?.name || 'player'}'s turn`}
            </Typography>
          )}
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<LeaveIcon />}
            onClick={handleLeaveTable}
            sx={{ mr: 1 }}
          >
            Leave Table
          </Button>
          {!isSpectating && gameState.status === 'waiting' && (
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={() => setShowBettingDialog(true)}
              disabled={currentPlayer?.hands && currentPlayer.hands.length > 0 && currentPlayer.hands[0].bet > 0}
            >
              {currentPlayer?.hands && currentPlayer.hands.length > 0 && currentPlayer.hands[0].bet > 0 ? 'Bet Placed' : 'Place Bet'}
            </Button>
          )}
          {gameState.status === 'finished' && (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayIcon />}
              onClick={handlePlayAgain}
            >
              Play Again
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Game Area */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, minHeight: 600 }}>
            {/* Dealer Area */}
            <Box sx={{ textAlign: 'center', mb: 4, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
              {renderHand(gameState.dealerHand, 'Dealer')}
            </Box>

            {/* Player Seats */}
            <Grid container spacing={2}>
              {Array.from({ length: 6 }, (_, index) => {
                const player = gameState.players.find(p => p.seatPosition === index + 1);
                return (
                  <Grid item xs={6} md={4} key={index}>
                    {player ? (
                      renderPlayerSeat(player)
                    ) : (
                      <Card sx={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                          Empty Seat {index + 1}
                        </Typography>
                      </Card>
                    )}
                  </Grid>
                );
              })}
            </Grid>

            {/* Player Actions */}
            {isCurrentPlayerTurn && gameState.status === 'playing' && (
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
                <Button variant="contained" onClick={() => handlePlayerAction('hit')}>
                  Hit
                </Button>
                <Button variant="contained" onClick={() => handlePlayerAction('stand')}>
                  Stand
                </Button>
                {currentPlayer?.hands && currentPlayer.hands[0] && currentPlayer.hands[0].cards.length === 2 && (
                  <>
                    <Button variant="outlined" onClick={() => handlePlayerAction('double')}>
                      Double
                    </Button>
                    {currentPlayer.hands[0].cards[0].rank === currentPlayer.hands[0].cards[1].rank && (
                      <Button variant="outlined" onClick={() => handlePlayerAction('split')}>
                        Split
                      </Button>
                    )}
                    <Button variant="outlined" color="error" onClick={() => handlePlayerAction('surrender')}>
                      Surrender
                    </Button>
                  </>
                )}
              </Box>
            )}

            {/* Game Status */}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Chip
                label={`Game Status: ${gameState.status.toUpperCase()}`}
                color={gameState.status === 'playing' ? 'success' : 
                       gameState.status === 'finished' ? 'error' : 'default'}
              />
              {gameState.status === 'playing' && !isCurrentPlayerTurn && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Waiting for {gameState.players.find(p => p.isCurrentPlayer)?.name || 'other player'}...
                </Typography>
              )}
              {gameState.status === 'dealer_turn' && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Dealer is playing...
                </Typography>
              )}
              {gameState.status === 'finished' && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Game finished! New round starting soon...
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Chat Area */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 600, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Table Chat
            </Typography>
            
            {/* Chat Messages */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2, p: 1, backgroundColor: 'action.hover', borderRadius: 1 }}>
              {chatMessages.map((msg) => (
                <Box key={msg.id} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {msg.player}: 
                  </Typography>
                  <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                    {msg.message}
                  </Typography>
                </Box>
              ))}
              <Box ref={chatEndRef} />
            </Box>
            
            {/* Chat Input */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatMessage(e.target.value)}
                onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSendChat()}
              />
              <IconButton onClick={handleSendChat} color="primary">
                <SendIcon />
              </IconButton>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Betting Dialog */}
      <Dialog open={showBettingDialog} onClose={() => setShowBettingDialog(false)}>
        <DialogTitle>Place Your Bet</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, minWidth: 300 }}>
            <Typography gutterBottom>
              Bet Amount: ${betAmount}
            </Typography>
            <Slider
              value={betAmount}
              onChange={(_: Event, value: number | number[]) => setBetAmount(value as number)}
              min={gameState.minBet}
              max={Math.min(gameState.maxBet, currentPlayer?.chips || 0)}
              step={5}
              marks={[
                { value: gameState.minBet, label: `$${gameState.minBet}` },
                { value: gameState.maxBet, label: `$${gameState.maxBet}` }
              ]}
              valueLabelDisplay="auto"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Available chips: ${currentPlayer?.chips || 0}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBettingDialog(false)}>Cancel</Button>
          <Button onClick={handlePlaceBet} variant="contained">Place Bet</Button>
        </DialogActions>
      </Dialog>

      {/* Game Results Dialog */}
      <Dialog open={showResultsDialog} onClose={() => setShowResultsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Game Results</DialogTitle>
        <DialogContent>
          {gameResults && (
            <Box sx={{ pt: 2 }}>
              {/* Dealer's Final Hand */}
              <Box sx={{ mb: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Dealer's Hand (Value: {gameResults.dealer_hand?.value})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  {gameResults.dealer_hand?.cards?.map((card: any, index: number) => (
                    <Box key={index} sx={{ 
                      width: 40, height: 56, backgroundColor: 'white', 
                      border: '1px solid #ccc', borderRadius: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', color: card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black'
                    }}>
                      {card.rank}
                    </Box>
                  ))}
                </Box>
                {gameResults.dealer_hand?.is_blackjack && <Chip label="Blackjack!" color="warning" size="small" />}
                {gameResults.dealer_hand?.is_bust && <Chip label="Bust!" color="error" size="small" />}
              </Box>

              {/* Player Results */}
              {gameResults.results?.map((result: any) => (
                <Box key={result.player_id} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {result.player_name} - New Balance: ${result.new_chip_count}
                  </Typography>
                  {result.hands?.map((hand: any, handIndex: number) => (
                    <Box key={handIndex} sx={{ mb: 1 }}>
                      <Typography variant="body2">
                        Hand {handIndex + 1}: Value {hand.value} | Bet: ${hand.bet} | 
                        <Chip 
                          label={hand.result.toUpperCase()} 
                          color={hand.result === 'win' || hand.result === 'blackjack' ? 'success' : 
                                 hand.result === 'push' ? 'default' : 'error'} 
                          size="small" 
                          sx={{ ml: 1 }}
                        />
                      </Typography>
                      {hand.winnings > 0 && (
                        <Typography variant="body2" color="success.main">
                          Winnings: ${hand.winnings}
                        </Typography>
                      )}
                    </Box>
                  ))}
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    Total Result: {result.total_winnings > result.total_bet ? '+' : ''}${result.total_winnings - result.total_bet}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResultsDialog(false)}>Close</Button>
          <Button onClick={handlePlayAgain} variant="contained" color="primary">
            Play Again
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Game; 