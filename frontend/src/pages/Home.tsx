import React from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
  Chip
} from '@mui/material';
import {
  Casino,
  People,
  Speed,
  Security,
  PlayArrow,
  PersonAdd
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loginAsGuest, isLoading } = useAuthStore();

  const handleQuickPlay = async () => {
    if (isAuthenticated) {
      navigate('/tables');
    } else {
      const success = await loginAsGuest();
      if (success) {
        navigate('/tables');
      }
    }
  };

  const features = [
    {
      icon: <People fontSize="large" />,
      title: 'Multiplayer',
      description: 'Play with up to 6 players at each table in real-time'
    },
    {
      icon: <Speed fontSize="large" />,
      title: 'Real-time',
      description: 'Instant updates with WebSocket technology'
    },
    {
      icon: <Security fontSize="large" />,
      title: 'Secure',
      description: 'Safe and fair gameplay with JWT authentication'
    },
    {
      icon: <Casino fontSize="large" />,
      title: 'Classic Rules',
      description: 'Standard blackjack with split, double down, and surrender'
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Hero Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          background: 'linear-gradient(135deg, #0f5132 0%, #198754 50%, #0f5132 100%)',
          borderRadius: 4,
          mb: 6,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 
              'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            opacity: 0.5
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Casino sx={{ fontSize: 80, color: '#fff', mb: 2 }} />
          <Typography variant="h2" component="h1" gutterBottom sx={{ color: '#fff', fontWeight: 'bold' }}>
            Multiplayer Blackjack
          </Typography>
          <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.9)', mb: 4 }}>
            Experience the thrill of real-time blackjack with players from around the world
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrow />}
              onClick={handleQuickPlay}
              disabled={isLoading}
              sx={{
                bgcolor: '#ff9800',
                '&:hover': { bgcolor: '#f57c00' },
                px: 4,
                py: 1.5,
                fontSize: '1.1rem'
              }}
            >
              {isAuthenticated ? 'Play Now' : 'Quick Play'}
            </Button>
            
            {!isAuthenticated && (
              <Button
                variant="outlined"
                size="large"
                startIcon={<PersonAdd />}
                onClick={() => navigate('/register')}
                sx={{
                  borderColor: '#fff',
                  color: '#fff',
                  '&:hover': {
                    borderColor: '#fff',
                    bgcolor: 'rgba(255,255,255,0.1)'
                  },
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem'
                }}
              >
                Sign Up
              </Button>
            )}
          </Box>
        </Box>
      </Box>

      {/* Features Section */}
      <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 4 }}>
        Why Choose Our Blackjack?
      </Typography>
      
      <Grid container spacing={4} sx={{ mb: 6 }}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                textAlign: 'center',
                transition: 'transform 0.3s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 8px 25px rgba(76, 175, 80, 0.3)'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ color: 'primary.main', mb: 2 }}>
                  {feature.icon}
                </Box>
                <Typography variant="h6" component="h3" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Game Rules Section */}
      <Card sx={{ mb: 6 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" component="h2" gutterBottom textAlign="center">
            Game Rules
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Basic Rules:
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                  • Get as close to 21 as possible without going over
                </Typography>
                <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                  • Beat the dealer's hand to win
                </Typography>
                <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                  • Aces count as 1 or 11, face cards count as 10
                </Typography>
                <Typography variant="body2" component="div">
                  • Blackjack (21 with 2 cards) pays 3:2
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Player Actions:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="Hit" color="primary" variant="outlined" />
                <Chip label="Stand" color="primary" variant="outlined" />
                <Chip label="Double Down" color="primary" variant="outlined" />
                <Chip label="Split Pairs" color="primary" variant="outlined" />
                <Chip label="Surrender" color="primary" variant="outlined" />
                <Chip label="Insurance" color="primary" variant="outlined" />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Ready to Play?
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Join thousands of players in the most exciting online blackjack experience
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={handleQuickPlay}
          disabled={isLoading}
          sx={{ px: 6, py: 2 }}
        >
          Start Playing Now
        </Button>
      </Box>
    </Container>
  );
};

export default Home; 