import React from 'react';
import { Box, Typography } from '@mui/material';

interface Card {
  suit: string;
  rank: string;
  value: number;
  hidden?: boolean;
}

interface CardProps {
  card: Card;
}

const CardComponent: React.FC<CardProps> = ({ card }) => {
  const suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };
  
  const suitColors: Record<string, string> = {
    hearts: '#e53e3e',
    diamonds: '#e53e3e',
    clubs: '#2d3748',
    spades: '#2d3748'
  };

  if (card.hidden) {
    return (
      <Box
        sx={{
          width: 60,
          height: 84,
          backgroundColor: '#1a365d',
          border: '2px solid #2d3748',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
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
        position: 'relative',
        color: suitColors[card.suit] || '#2d3748'
      }}
    >
      <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 'bold' }}>
        {card.rank}
      </Typography>
      <Typography variant="h6" sx={{ fontSize: '16px' }}>
        {suitSymbols[card.suit] || card.suit}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 'bold', transform: 'rotate(180deg)' }}>
        {card.rank}
      </Typography>
    </Box>
  );
};

export default CardComponent; 