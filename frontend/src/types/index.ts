// User types
export interface User {
  id: string;
  username: string;
  email: string;
  chips: number;
  is_guest: boolean;
  created_at: string;
}

// Table types
export interface Table {
  id: string;
  name: string;
  state: 'waiting' | 'playing' | 'finished';
  min_bet: number;
  max_bet: number;
  max_players: number;
  player_count: number;
  is_full: boolean;
  created_at?: string;
}

export interface Player {
  id: string;
  username: string;
  chips: number;
  position: number;
}

// Game types
export interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  value: number;
}

export interface Hand {
  cards: Card[];
  value: number;
  is_soft: boolean;
  is_blackjack: boolean;
  is_bust: boolean;
}

export interface GameState {
  id: string;
  table_id: string;
  status: 'waiting' | 'betting' | 'dealing' | 'playing' | 'finished';
  dealer_hand: Hand;
  player_hands: { [playerId: string]: Hand[] };
  current_player: string | null;
  bets: { [playerId: string]: number };
  deck_count: number;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// Tables API specific response
export interface TablesResponse {
  success: boolean;
  tables: Table[];
  count: number;
  filters?: any;
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  token_type: string;
}

// Table creation
export interface CreateTableRequest {
  name: string;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
} 