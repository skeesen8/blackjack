import React, { useEffect, useState } from 'react';
import { 
  Snackbar, 
  Alert, 
  Slide, 
  Typography, 
  Box, 
  Chip,
  SlideProps
} from '@mui/material';
import { styled } from '@mui/material/styles';

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="down" />;
}

const StyledAlert = styled(Alert)(({ theme }) => ({
  fontSize: '1.2rem',
  fontWeight: 'bold',
  minWidth: '400px',
  '& .MuiAlert-icon': {
    fontSize: '2rem',
  },
  '& .MuiAlert-message': {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
}));

const WinAmount = styled(Chip)(({ theme }) => ({
  fontSize: '1.1rem',
  fontWeight: 'bold',
  padding: theme.spacing(0.5, 1),
  backgroundColor: theme.palette.success.light,
  color: theme.palette.success.contrastText,
}));

interface WinNotificationProps {
  show: boolean;
  winType: 'win' | 'blackjack' | 'push' | 'lose';
  amount: number;
  handValue?: number;
  onClose: () => void;
}

const WinNotification: React.FC<WinNotificationProps> = ({
  show,
  winType,
  amount,
  handValue,
  onClose,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (show) {
      setOpen(true);
    }
  }, [show]);

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
    setTimeout(() => onClose(), 300); // Wait for animation to complete
  };

  const getNotificationConfig = () => {
    switch (winType) {
      case 'blackjack':
        return {
          severity: 'success' as const,
          title: '🎊 BLACKJACK! 🎊',
          message: 'Perfect 21!',
          duration: 4000,
        };
      case 'win':
        return {
          severity: 'success' as const,
          title: '🎉 YOU WIN! 🎉',
          message: handValue ? `Hand value: ${handValue}` : 'You beat the dealer!',
          duration: 3000,
        };
      case 'push':
        return {
          severity: 'info' as const,
          title: '🤝 PUSH',
          message: 'Tie with dealer - bet returned',
          duration: 2500,
        };
      case 'lose':
        return {
          severity: 'error' as const,
          title: '💔 DEALER WINS',
          message: handValue ? `Hand value: ${handValue}` : 'Better luck next time!',
          duration: 2500,
        };
      default:
        return {
          severity: 'info' as const,
          title: 'Game Result',
          message: '',
          duration: 2000,
        };
    }
  };

  const config = getNotificationConfig();

  return (
    <Snackbar
      open={open}
      autoHideDuration={config.duration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      TransitionComponent={SlideTransition}
      sx={{ 
        '& .MuiSnackbar-root': {
          top: '20px !important',
        }
      }}
    >
      <StyledAlert 
        onClose={handleClose} 
        severity={config.severity}
        variant="filled"
        elevation={6}
      >
        <Box>
          <Typography variant="h6" component="div">
            {config.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="body1">
              {config.message}
            </Typography>
            {amount > 0 && (
              <WinAmount 
                label={`+$${amount}`}
                size="small"
              />
            )}
          </Box>
        </Box>
      </StyledAlert>
    </Snackbar>
  );
};

export default WinNotification; 