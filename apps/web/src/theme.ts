'use client';
import { createTheme } from '@mui/material/styles';

/**
 * Pearson-inspired professional palette: deep navy ink, teal-blue primary,
 * generous whitespace, subtle borders — deliberately un-Excel.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#007FA3', dark: '#005D77', light: '#4AA8C4' },
    secondary: { main: '#512EAB' },
    background: { default: '#F6F8FA', paper: '#FFFFFF' },
    text: { primary: '#101828', secondary: '#475467' },
    divider: '#E4E7EC',
    success: { main: '#1F7A3F' },
    warning: { main: '#B58A00' },
    error: { main: '#B91C1C' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"Inter","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 2px rgba(16,24,40,0.05)' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none', borderBottom: '1px solid #E4E7EC' },
      },
    },
  },
});
