from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime

class Suit(str, Enum):
    HEARTS = "hearts"
    DIAMONDS = "diamonds"
    CLUBS = "clubs"
    SPADES = "spades"

class CardRank(str, Enum):
    ACE = "A"
    TWO = "2"
    THREE = "3"
    FOUR = "4"
    FIVE = "5"
    SIX = "6"
    SEVEN = "7"
    EIGHT = "8"
    NINE = "9"
    TEN = "10"
    JACK = "J"
    QUEEN = "Q"
    KING = "K"

class Card(BaseModel):
    suit: Suit
    rank: CardRank
    hidden: bool = False
    
    @property
    def value(self) -> int:
        """Get the base value of the card (Ace = 1, Face cards = 10)"""
        if self.rank in [CardRank.JACK, CardRank.QUEEN, CardRank.KING]:
            return 10
        elif self.rank == CardRank.ACE:
            return 1
        else:
            return int(self.rank)
    
    def __str__(self):
        return f"{self.rank}{self.suit}"

class Hand(BaseModel):
    cards: List[Card] = Field(default_factory=list)
    bet: int = 0
    is_split: bool = False
    is_doubled: bool = False
    is_surrendered: bool = False
    is_finished: bool = False
    
    @property
    def value(self) -> int:
        """Calculate the best possible value of the hand"""
        total = sum(card.value for card in self.cards)
        aces = sum(1 for card in self.cards if card.rank == CardRank.ACE)
        
        # Add 10 for each ace that can be counted as 11 without busting
        while aces > 0 and total + 10 <= 21:
            total += 10
            aces -= 1
            
        return total
    
    @property
    def is_blackjack(self) -> bool:
        """Check if hand is a blackjack (21 with 2 cards)"""
        return len(self.cards) == 2 and self.value == 21
    
    @property
    def is_bust(self) -> bool:
        """Check if hand is bust (over 21)"""
        return self.value > 21
    
    @property
    def can_split(self) -> bool:
        """Check if hand can be split"""
        return (len(self.cards) == 2 and 
                self.cards[0].rank == self.cards[1].rank and 
                not self.is_split)
    
    @property
    def can_double(self) -> bool:
        """Check if hand can be doubled"""
        return len(self.cards) == 2 and not self.is_doubled

class GameState(str, Enum):
    WAITING = "waiting"
    BETTING = "betting"
    DEALING = "dealing"
    PLAYING = "playing"
    DEALER_TURN = "dealer_turn"
    FINISHED = "finished"

class PlayerAction(str, Enum):
    HIT = "hit"
    STAND = "stand"
    DOUBLE = "double"
    SPLIT = "split"
    SURRENDER = "surrender"
    INSURANCE = "insurance"

class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    chips: int = 1000
    hands: List[Hand] = Field(default_factory=list)
    current_hand_index: int = 0
    is_active: bool = True
    is_connected: bool = True
    seat_position: int
    
    @property
    def current_hand(self) -> Optional[Hand]:
        """Get the current active hand"""
        if 0 <= self.current_hand_index < len(self.hands):
            return self.hands[self.current_hand_index]
        return None
    
    @property
    def total_bet(self) -> int:
        """Get total bet across all hands"""
        return sum(hand.bet for hand in self.hands)

class Dealer(BaseModel):
    hand: Hand = Field(default_factory=Hand)
    
    @property
    def upcard(self) -> Optional[Card]:
        """Get the dealer's visible card"""
        if self.hand.cards:
            return self.hand.cards[0]
        return None
    
    @property
    def should_hit(self) -> bool:
        """Dealer hits on soft 17"""
        value = self.hand.value
        if value < 17:
            return True
        if value == 17:
            # Check for soft 17 (Ace counted as 11)
            total = sum(card.value for card in self.hand.cards)
            aces = sum(1 for card in self.hand.cards if card.rank == CardRank.ACE)
            return total + 10 == 17 and aces > 0
        return False

class GameTable(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    min_bet: int = 10
    max_bet: int = 500
    max_players: int = 6
    players: List[Player] = Field(default_factory=list)
    dealer: Dealer = Field(default_factory=Dealer)
    deck: List[Card] = Field(default_factory=list)
    state: GameState = GameState.WAITING
    current_player_index: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def current_player(self) -> Optional[Player]:
        """Get the current active player"""
        if 0 <= self.current_player_index < len(self.players):
            return self.players[self.current_player_index]
        return None
    
    @property
    def is_full(self) -> bool:
        """Check if table is full"""
        return len(self.players) >= self.max_players
    
    @property
    def active_players(self) -> List[Player]:
        """Get list of active players"""
        return [p for p in self.players if p.is_active]

class GameAction(BaseModel):
    player_id: str
    action: PlayerAction
    hand_index: int = 0
    amount: Optional[int] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class GameResult(BaseModel):
    player_id: str
    hands: List[Dict[str, Any]]
    winnings: int
    total_bet: int

class TableUpdate(BaseModel):
    type: str
    table_id: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow) 