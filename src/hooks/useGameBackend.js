// 🎮 React Hook for Backend Game State
// This hook manages the connection to our backend and provides game state

import { useState, useEffect, useCallback } from 'react';
import gameService from '../services/gameService';

export const useGameBackend = () => {
  // Game state from backend
  const [gameState, setGameState] = useState('betting');
  const [multiplier, setMultiplier] = useState(1.00);
  const [countdown, setCountdown] = useState(5);
  const [playersOnline, setPlayersOnline] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  
  // Player state
  const [playerBalance, setPlayerBalance] = useState(10000);
  const [activeBet, setActiveBet] = useState(0);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashedOutAt, setCashedOutAt] = useState(0);

  // Handle messages from backend
  const handleMessage = useCallback((message) => {
    console.log('🎮 Game update:', message);
    
    switch (message.type) {
      case 'connected':
        setIsConnected(true);
        if (message.data?.gameState) {
          setGameState(message.data.gameState.state);
          setMultiplier(message.data.gameState.multiplier);
          setCountdown(message.data.gameState.countdown);
          setPlayersOnline(message.data.gameState.playersOnline);
        }
        break;
        
      case 'gameState':
        setGameState(message.data.state);
        setMultiplier(message.data.multiplier);
        setCountdown(message.data.countdown);
        setPlayersOnline(message.data.playersOnline);
        
        // Reset bet state when new round starts
        if (message.data.state === 'betting' && gameState !== 'betting') {
          setActiveBet(0);
          setCashedOut(false);
          setCashedOutAt(0);
        }
        break;
        
      case 'betPlaced':
        setActiveBet(message.data.amount);
        setPlayerBalance(message.data.balance);
        break;
        
      case 'cashedOut':
        setCashedOut(true);
        setCashedOutAt(message.data.multiplier);
        setPlayerBalance(message.data.balance);
        break;
        
      case 'error':
        console.error('❌ Game error:', message.message);
        // You could show a toast notification here
        break;
    }
  }, [gameState]);

  // Connect to backend on mount
  useEffect(() => {
    console.log('🔌 Connecting to game backend...');
    gameService.addListener(handleMessage);
    gameService.connect();

    // Cleanup on unmount
    return () => {
      gameService.removeListener(handleMessage);
      gameService.disconnect();
    };
  }, [handleMessage]);

  // Game actions
  const placeBet = useCallback((amount) => {
    if (gameState === 'betting' && activeBet === 0 && amount <= playerBalance) {
      gameService.placeBet(amount);
    }
  }, [gameState, activeBet, playerBalance]);

  const cashOut = useCallback(() => {
    if (gameState === 'running' && activeBet > 0 && !cashedOut) {
      gameService.cashOut();
    }
  }, [gameState, activeBet, cashedOut]);

  // Check backend health
  const checkHealth = useCallback(async () => {
    return await gameService.checkHealth();
  }, []);

  return {
    // Game state
    gameState,
    multiplier,
    countdown,
    playersOnline,
    isConnected,
    
    // Player state
    playerBalance,
    activeBet,
    cashedOut,
    cashedOutAt,
    
    // Actions
    placeBet,
    cashOut,
    checkHealth
  };
};
