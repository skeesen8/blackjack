import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  TableRestaurant,
  People,
  AttachMoney,
  Add,
  PlayArrow,
  Visibility
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { tableService, apiService } from '../services/api';
import { Table } from '../types/index';

const Tables = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await tableService.getTables();
      setTables(response.tables || []);
      setError(null);
    } catch (err) {
      setError('Failed to load tables');
      console.error('Error loading tables:', err);
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTable = async (tableId: string) => {
    try {
      if (!user) {
        setError('You must be logged in to join a table');
        return;
      }
      await tableService.joinTable(tableId, user.id, user.username);
      navigate(`/game/${tableId}`);
    } catch (err) {
      setError('Failed to join table');
      console.error('Error joining table:', err);
    }
  };

  const handleSpectateTable = (tableId: string) => {
    navigate(`/game/${tableId}?spectate=true`);
  };

  const handleCreateTable = async () => {
    try {
      const response = await tableService.createTable({
        name: `Table ${tables.length + 1}`,
        minBet: 10,
        maxBet: 500,
        maxPlayers: 6
      });
      navigate(`/game/${response.data.id}`);
    } catch (err) {
      setError('Failed to create table');
      console.error('Error creating table:', err);
    }
  };

  const handleClearTables = async () => {
    try {
      await apiService.clearAllTables();
      await loadTables(); // Reload tables after clearing
      setError(null);
    } catch (err) {
      setError('Failed to clear tables');
      console.error('Error clearing tables:', err);
    }
  };

  const getTableStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'success';
      case 'playing':
        return 'warning';
      case 'full':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTableStatusText = (table: Table) => {
    if (table.is_full) {
      return 'Full';
    }
    if (table.state === 'playing') {
      return 'In Game';
    }
    return 'Waiting';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom>
            Game Tables
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Choose a table to join or create your own
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleClearTables}
            size="large"
            color="warning"
          >
            Clear All Tables
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateTable}
            size="large"
            sx={{ px: 3 }}
          >
            Create Table
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {tables.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2
          }}
        >
          <TableRestaurant sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            No tables available
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Be the first to create a table and start playing!
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateTable}
            size="large"
          >
            Create First Table
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {tables.map((table) => (
            <Grid item xs={12} sm={6} md={4} key={table.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(76, 175, 80, 0.2)'
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {table.name}
                    </Typography>
                    <Chip
                      label={getTableStatusText(table)}
                      color={getTableStatusColor(table.state)}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <People sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {table.player_count}/{table.max_players} players
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AttachMoney sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      ${table.min_bet} - ${table.max_bet}
                    </Typography>
                  </Box>

                  {table.player_count > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Players: {table.player_count}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                    {!table.is_full ? (
                      <Button
                        variant="contained"
                        startIcon={<PlayArrow />}
                        onClick={() => handleJoinTable(table.id)}
                        fullWidth
                      >
                        Join
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        startIcon={<Visibility />}
                        onClick={() => handleSpectateTable(table.id)}
                        fullWidth
                      >
                        Spectate
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default Tables; 