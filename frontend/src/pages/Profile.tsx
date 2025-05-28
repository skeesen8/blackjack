import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Avatar,
  Chip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { AttachMoney, TrendingUp, Casino, EmojiEvents } from '@mui/icons-material';
import { useAuthStore } from '../stores/authStore';

const Profile = () => {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4">Please log in to view your profile</Typography>
      </Container>
    );
  }

  const stats = [
    {
      icon: <AttachMoney />,
      label: 'Current Chips',
      value: user.chips.toLocaleString(),
      color: 'success'
    },
    {
      icon: <Casino />,
      label: 'Games Played',
      value: '0',
      color: 'primary'
    },
    {
      icon: <TrendingUp />,
      label: 'Win Rate',
      value: '0%',
      color: 'info'
    },
    {
      icon: <EmojiEvents />,
      label: 'Best Streak',
      value: '0',
      color: 'warning'
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Player Profile
      </Typography>

      <Grid container spacing={4}>
        {/* Profile Info */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                bgcolor: 'primary.main',
                fontSize: '3rem',
                mx: 'auto',
                mb: 2
              }}
            >
              {user.username.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="h4" gutterBottom>
              {user.username}
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {user.email}
            </Typography>
            <Chip
              label={user.is_guest ? 'Guest Player' : 'Registered Player'}
              color={user.is_guest ? 'default' : 'primary'}
              sx={{ mt: 1 }}
            />
          </Paper>
        </Grid>

        {/* Stats */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {stats.map((stat, index) => (
              <Grid item xs={12} sm={6} key={index}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ color: `${stat.color}.main`, mr: 1 }}>
                        {stat.icon}
                      </Box>
                      <Typography variant="h6" component="div">
                        {stat.value}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Recent Activity */}
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No recent activity to display
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Profile; 