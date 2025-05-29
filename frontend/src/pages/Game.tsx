import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Avatar,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Send,
  ExitToApp,
  Casino,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { tableService } from '../services/api';
import CardComponent from '../components/Card';
import WinNotification from '../components/WinNotification';
import { Hand, Card as GameCard, GameState as GameStateEnum } from '../types/game';

interface GamePlayer {
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
  name: string;
  status: string;
  players: GamePlayer[];
  dealerHand: Hand;
  currentPlayerId: string | null;
  minBet: number;
  maxBet: number;
  bet_countdown: number;
}

const Game = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameResults, setGameResults] = useState<any>(null);
  
  // Betting state
  const [betAmount, setBetAmount] = useState(10);
  const [showBettingDialog, setShowBettingDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  
  // Chat state (disabled for now since no WebSocket)
  const [chatMessages, setChatMessages] = useState<Array<{id: string, player: string, message: string, timestamp: Date}>>([]);
  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Win notification state
  const [showWinNotification, setShowWinNotification] = useState(false);
  const [winNotificationType, setWinNotificationType] = useState<'win' | 'blackjack' | 'push' | 'lose'>('win');
  const [winAmount, setWinAmount] = useState(0);
  const [winHandValue, setWinHandValue] = useState<number | undefined>(undefined);
  
  // Polling for game state updates
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initializingRef = useRef(false);

  // Update bet amount when game state changes to match table minimums
  useEffect(() => {
    if (gameState && gameState.minBet > betAmount) {
      setBetAmount(gameState.minBet);
    }
  }, [gameState?.minBet, betAmount]);

  // Conversion functions for backend data
  const convertBackendHand = useCallback((backendHand: any): Hand => {
    return {
      cards: backendHand.cards || [],
      value: backendHand.value || 0,
      bet: backendHand.bet || 0,
      is_split: backendHand.is_split || false,
      is_doubled: backendHand.is_doubled || false,
      is_surrendered: backendHand.is_surrendered || false,
      is_finished: backendHand.is_finished || false,
      is_blackjack: backendHand.is_blackjack || false,
      is_bust: backendHand.is_bust || false,
      can_split: backendHand.can_split || false,
      can_double: backendHand.can_double || false
    };
  }, []);

  const convertBackendPlayer = useCallback((backendPlayer: any): GamePlayer => {
    return {
      id: backendPlayer.id,
      name: backendPlayer.name,
      chips: backendPlayer.chips,
      hands: backendPlayer.hands ? backendPlayer.hands.map(convertBackendHand) : [],
      seatPosition: backendPlayer.seat_position || 1,
      isActive: backendPlayer.is_active !== false,
      isCurrentPlayer: backendPlayer.is_current_player || false
    };
  }, [convertBackendHand]);

  const convertBackendTableState = useCallback((backendState: any): GameState => {
    const players = backendState.players ? backendState.players.map((player: any, index: number) => ({
      ...convertBackendPlayer(player),
      isCurrentPlayer: index === backendState.current_player_index && backendState.state === 'playing'
    })) : [];

    return {
      id: backendState.id || 'game-1',
      tableId: backendState.table_id || tableId!,
      name: backendState.name || '',
      status: backendState.state || 'waiting',
      players: players,
      dealerHand: backendState.dealer ? convertBackendHand(backendState.dealer.hand || backendState.dealer) : {
        cards: [],
        value: 0,
        bet: 0,
        is_split: false,
        is_doubled: false,
        is_surrendered: false,
        is_finished: false,
        is_blackjack: false,
        is_bust: false,
        can_split: false,
        can_double: false
      },
      currentPlayerId: backendState.current_player_id || null,
      minBet: backendState.min_bet || 10,
      maxBet: backendState.max_bet || 500,
      bet_countdown: backendState.bet_countdown || 0
    };
  }, [tableId, convertBackendPlayer, convertBackendHand]);

  const checkForWinResults = useCallback((newGameState: GameState) => {
    if (!user || !newGameState) return;
    
    const currentPlayer = newGameState.players.find(p => p.id === user.id);
    if (!currentPlayer || !currentPlayer.hands.length) return;
    
    const dealerValue = newGameState.dealerHand.value;
    const dealerBlackjack = newGameState.dealerHand.cards.length === 2 && dealerValue === 21;
    const dealerBust = dealerValue > 21;
    
    // Check each hand for results
    currentPlayer.hands.forEach((hand, index) => {
      if (hand.is_surrendered) return; // Skip surrendered hands
      
      let winType: 'win' | 'blackjack' | 'push' | 'lose' = 'lose';
      let winAmount = 0;
      
      if (hand.is_bust) {
        winType = 'lose';
        winAmount = 0;
      } else if (hand.is_blackjack && !dealerBlackjack) {
        winType = 'blackjack';
        winAmount = hand.bet + Math.floor(hand.bet * 1.5); // 3:2 payout
      } else if (hand.is_blackjack && dealerBlackjack) {
        winType = 'push';
        winAmount = hand.bet; // Return original bet
      } else if (dealerBust && !hand.is_bust) {
        winType = 'win';
        winAmount = hand.bet * 2;
      } else if (hand.value > dealerValue) {
        winType = 'win';
        winAmount = hand.bet * 2;
      } else if (hand.value === dealerValue) {
        winType = 'push';
        winAmount = hand.bet;
      } else {
        winType = 'lose';
        winAmount = 0;
      }
      
      // Show notification for the first hand (or if only one hand)
      if (index === 0) {
        console.log('Showing win notification:', winType, 'amount:', winAmount);
        setWinNotificationType(winType);
        setWinAmount(winAmount);
        setWinHandValue(hand.value);
        setShowWinNotification(true);
      }
    });
  }, [user]);

  // Win notification effect - separate from loadGameState to ensure it runs
  useEffect(() => {
    if (!gameState || !user) return;
    
    // Only check if game is finished and we have a dealer hand with cards
    if (gameState.status === 'finished' && gameState.dealerHand.cards.length > 0) {
      console.log('Game finished, checking for win notifications');
      checkForWinResults(gameState);
    }
  }, [gameState?.status, gameState?.dealerHand.cards.length, user, checkForWinResults]);

  const loadGameState = useCallback(async () => {
    if (!tableId) return;
    
    try {
      const response = await tableService.getTable(tableId);
      // The backend returns { success: true, table: ... }
      const table = (response as any).table || response.data;
      
      // Convert backend table format to frontend game state
      const convertedState = convertBackendTableState(table);
      
      // Simply update the state - win notification effect will handle notifications
      setGameState(convertedState);
      
      setError(null);
    } catch (err) {
      console.error('Error loading game state:', err);
      setError('Failed to load game state');
    }
  }, [tableId, convertBackendTableState]);

  const initializeGame = useCallback(async () => {
    if (initializingRef.current) {
      console.log('Initialization already in progress, skipping...');
      return;
    }
    
    try {
      initializingRef.current = true;
      setLoading(true);
      setError(null);
      
      console.log('Initializing game for table:', tableId, 'user:', user?.id);
      
      // First load the current game state to see if we're already in the table
      await loadGameState();
      
      // Only try to join if we're not already in the table
      if (user) {
        try {
          const tableResponse = await tableService.getTable(tableId!);
          const table = (tableResponse as any).table || tableResponse.data;
          const existingPlayer = table.players?.find((p: any) => p.id === user.id);
          
          if (!existingPlayer) {
            console.log('Player not found in table, joining...');
            // Only join if we're not already in the table
            await tableService.joinTable(tableId!, user.id, user.username);
            // Reload game state after joining
            await loadGameState();
          } else {
            console.log('Player already in table, skipping join');
          }
        } catch (err) {
          console.error('Error joining table:', err);
          // Don't fail completely if join fails, maybe we're already in
        }
      }
      
      // Start polling for updates only after initialization is complete
      setPolling(true);
      
    } catch (err) {
      setError('Failed to initialize game');
      console.error('Error initializing game:', err);
    } finally {
      setLoading(false);
      initializingRef.current = false;
    }
  }, [tableId, user, loadGameState]);

  // Polling effect
  useEffect(() => {
    if (polling && tableId) {
      pollingRef.current = setInterval(() => {
        loadGameState();
      }, 3000); // Increased from 2 to 3 seconds to reduce load
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [polling, loadGameState, tableId]);

  useEffect(() => {
    if (!tableId || !user) return;
    
    // Reset polling when changing tables/users
    setPolling(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    // Initialize the game
    initializeGame();
    
    return () => {
      setPolling(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      initializingRef.current = false;
    };
  }, [tableId, user?.id]); // Only depend on tableId and user.id, not the full initializeGame function

  const handlePlaceBet = async () => {
    if (!gameState || !user) return;
    
    try {
      const response = await tableService.placeBet(tableId!, user.id, betAmount);
      if (response.success && (response as any).table) {
        const convertedState = convertBackendTableState((response as any).table);
        setGameState(convertedState);
      }
      setShowBettingDialog(false);
    } catch (err) {
      console.error('Error placing bet:', err);
      setError('Failed to place bet');
    }
  };

  const handlePlayerAction = async (action: string) => {
    if (!gameState || !user) return;
    
    try {
      const response = await tableService.playerAction(tableId!, user.id, action);
      if (response.success && (response as any).table) {
        const convertedState = convertBackendTableState((response as any).table);
        setGameState(convertedState);
      }
    } catch (err) {
      console.error('Error performing player action:', err);
      setError('Failed to perform action');
    }
  };

  const handlePlayAgain = async () => {
    if (!tableId) return;
    
    try {
      const response = await tableService.newRound(tableId);
      if (response.success && (response as any).table) {
        const convertedState = convertBackendTableState((response as any).table);
        setGameState(convertedState);
        setShowResultsDialog(false);
        setGameResults(null);
      }
    } catch (err) {
      console.error('Error starting new round:', err);
      setError('Failed to start new round');
    }
  };

  const handleLeaveTable = () => {
    setPolling(false);
    navigate('/tables');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => navigate('/tables')} variant="contained">
          Back to Tables
        </Button>
      </Container>
    );
  }

  if (!gameState) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="info">No game data available</Alert>
      </Container>
    );
  }

  const currentPlayer = gameState.players.find(p => p.id === user?.id);
  const isCurrentPlayerTurn = currentPlayer?.isCurrentPlayer;

  return (
    <Container maxWidth="lg" sx={{ mt: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Blackjack Table
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {gameState.bet_countdown > 0 && (
            <Chip 
              label={`Betting ends in: ${gameState.bet_countdown}s`} 
              color="warning"
              sx={{ 
                fontSize: '1rem',
                fontWeight: 'bold',
                animation: 'pulse 1s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                  '100%': { opacity: 1 }
                }
              }}
            />
          )}
          <Chip 
            label={`Status: ${gameState.status}`} 
            color={gameState.status === 'playing' ? 'success' : gameState.status === 'finished' ? 'error' : 'default'} 
          />
          <Button
            variant="outlined"
            startIcon={<ExitToApp />}
            onClick={handleLeaveTable}
          >
            Leave Table
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Game Area */}
        <Grid item xs={12} md={8}>
          {/* Dealer Section */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Dealer {gameState.dealerHand.value > 0 && `(${gameState.dealerHand.value})`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', minHeight: 120 }}>
                {gameState.dealerHand.cards.map((card: GameCard, index: number) => (
                  <CardComponent key={index} card={card} />
                ))}
                {gameState.dealerHand.cards.length === 0 && (
                  <Typography variant="body2" color="textSecondary">
                    No cards dealt
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Players Section */}
          <Grid container spacing={2}>
            {gameState.players.map((player) => (
              <Grid item xs={12} sm={6} key={player.id}>
                <Card sx={{ 
                  border: player.isCurrentPlayer ? '2px solid' : '1px solid',
                  borderColor: player.isCurrentPlayer ? 'primary.main' : 'divider',
                  bgcolor: player.id === user?.id ? 'action.hover' : 'background.paper'
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">
                        {player.name} {player.id === user?.id && '(You)'}
                      </Typography>
                      <Chip 
                        label={`${player.chips} chips`} 
                        color="primary" 
                        size="small" 
                      />
                    </Box>
                    
                    {player.hands.map((hand, handIndex) => (
                      <Box key={handIndex} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2">
                            Hand {handIndex + 1} 
                            {hand.value > 0 && ` (${hand.value})`}
                            {hand.bet > 0 && ` - Bet: ${hand.bet}`}
                          </Typography>
                          <Box>
                            {hand.is_blackjack && <Chip label="Blackjack!" color="success" size="small" />}
                            {hand.is_bust && <Chip label="Bust" color="error" size="small" />}
                            {hand.is_doubled && <Chip label="Doubled" color="info" size="small" />}
                            {hand.is_split && <Chip label="Split" color="warning" size="small" />}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', minHeight: 80 }}>
                          {hand.cards.map((card: GameCard, cardIndex: number) => (
                            <CardComponent key={cardIndex} card={card} />
                          ))}
                          {hand.cards.length === 0 && (
                            <Typography variant="body2" color="textSecondary">
                              No cards
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Game Actions */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Game Actions
              </Typography>
              
              {/* Betting */}
              {gameState.status === 'waiting' && currentPlayer && currentPlayer.hands.length === 0 && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={() => setShowBettingDialog(true)}
                    startIcon={<Casino />}
                  >
                    Place Bet
                  </Button>
                  <Typography variant="body2" color="textSecondary">
                    Min bet: {gameState.minBet}, Max bet: {gameState.maxBet}
                  </Typography>
                </Box>
              )}

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

              {/* Game Finished */}
              {gameState.status === 'finished' && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={handlePlayAgain}
                    startIcon={<PlayArrow />}
                  >
                    Play Again
                  </Button>
                </Box>
              )}

              {/* Game Status */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {gameState.status === 'waiting' && 'Waiting for players to place bets...'}
                  {gameState.status === 'playing' && isCurrentPlayerTurn && "It's your turn!"}
                  {gameState.status === 'playing' && !isCurrentPlayerTurn && 'Waiting for other players...'}
                  {gameState.status === 'finished' && 'Round finished!'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Player Info */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Your Info
              </Typography>
              <Box sx={{ display: 'flex', justify: 'space-between', mb: 1 }}>
                <Typography variant="body2">Chips:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {currentPlayer?.chips || 0}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justify: 'space-between' }}>
                <Typography variant="body2">Total Bet:</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {currentPlayer?.hands.reduce((total, hand) => total + hand.bet, 0) || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Chat - Disabled */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Chat (Coming Soon)
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Chat functionality will be available in the next update.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Betting Dialog */}
      <Dialog open={showBettingDialog} onClose={() => setShowBettingDialog(false)}>
        <DialogTitle>Place Your Bet - {gameState.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary">
              Table limits: ${gameState.minBet} - ${gameState.maxBet}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Your chips: ${currentPlayer?.chips || 0}
            </Typography>
          </Box>
          <TextField
            autoFocus
            margin="dense"
            label="Bet Amount"
            type="number"
            fullWidth
            variant="outlined"
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            inputProps={{
              min: gameState.minBet,
              max: Math.min(gameState.maxBet, currentPlayer?.chips || 0)
            }}
            helperText={
              betAmount < gameState.minBet 
                ? `Minimum bet is $${gameState.minBet}` 
                : betAmount > Math.min(gameState.maxBet, currentPlayer?.chips || 0)
                ? `Maximum bet is $${Math.min(gameState.maxBet, currentPlayer?.chips || 0)}`
                : `Valid bet range: $${gameState.minBet} - $${Math.min(gameState.maxBet, currentPlayer?.chips || 0)}`
            }
            error={betAmount < gameState.minBet || betAmount > Math.min(gameState.maxBet, currentPlayer?.chips || 0)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBettingDialog(false)}>Cancel</Button>
          <Button 
            onClick={handlePlaceBet} 
            variant="contained"
            disabled={betAmount < gameState.minBet || betAmount > Math.min(gameState.maxBet, currentPlayer?.chips || 0)}
          >
            Place Bet
          </Button>
        </DialogActions>
      </Dialog>

      {/* Win Notification */}
      <WinNotification
        show={showWinNotification}
        winType={winNotificationType}
        amount={winAmount}
        handValue={winHandValue}
        onClose={() => setShowWinNotification(false)}
      />
    </Container>
  );
};

export default Game; 