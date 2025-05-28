export enum Suit {
  HEARTS = 'hearts',
  DIAMONDS = 'diamonds',
  CLUBS = 'clubs',
  SPADES = 'spades'
}

export enum CardRank {
  ACE = 'A',
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K'
}

export interface Card {
  suit: Suit;
  rank: CardRank;
  value: number;
  hidden: boolean;
}

export interface Hand {
  cards: Card[];
  value: number;
  bet: number;
  is_split: boolean;
  is_doubled: boolean;
  is_surrendered: boolean;
  is_finished: boolean;
  is_blackjack: boolean;
  is_bust: boolean;
  can_split: boolean;
  can_double: boolean;
}

export enum GameState {
  WAITING = 'waiting',
  BETTING = 'betting',
  DEALING = 'dealing',
  PLAYING = 'playing',
  DEALER_TURN = 'dealer_turn',
  FINISHED = 'finished'
}

export enum PlayerAction {
  HIT = 'hit',
  STAND = 'stand',
  DOUBLE = 'double',
  SPLIT = 'split',
  SURRENDER = 'surrender',
  INSURANCE = 'insurance'
}

export interface Player {
  id: string;
  name: string;
  chips: number;
  seat_position: number;
  is_active: boolean;
  is_connected: boolean;
  current_hand_index: number;
  hands: Hand[];
  total_bet: number;
}

export interface Dealer {
  hand: Hand;
  upcard: Card | null;
  should_hit: boolean;
}

export interface GameTable {
  id: string;
  name: string;
  state: GameState;
  min_bet: number;
  max_bet: number;
  max_players: number;
  current_player_index: number;
  players: Player[];
  dealer: Dealer;
  deck_count: number;
}

export interface GameResult {
  player_id: string;
  hands: Array<{
    cards: Card[];
    value: number;
    bet: number;
    winnings: number;
    result: string;
  }>;
  winnings: number;
  total_bet: number;
}

export interface TableSummary {
  id: string;
  name: string;
  state: GameState;
  player_count: number;
  max_players: number;
  min_bet: number;
  max_bet: number;
  is_full: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  chips: number;
  is_guest?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  access_token: string;
  token_type: string;
  expires_in: number;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface JoinTableMessage extends WebSocketMessage {
  type: 'join_table';
  player_name: string;
}

export interface PlaceBetMessage extends WebSocketMessage {
  type: 'place_bet';
  player_id: string;
  amount: number;
}

export interface PlayerActionMessage extends WebSocketMessage {
  type: 'player_action';
  player_id: string;
  action: PlayerAction;
  hand_index?: number;
}

export interface ChatMessage extends WebSocketMessage {
  type: 'chat_message';
  player_id: string;
  player_name: string;
  message: string;
  timestamp: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface TableListResponse extends ApiResponse {
  tables: TableSummary[];
  count: number;
}

export interface TableResponse extends ApiResponse {
  table: GameTable;
}

export interface PlayerResponse extends ApiResponse {
  player: Player;
} 