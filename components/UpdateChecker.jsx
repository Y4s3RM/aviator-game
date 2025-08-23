import React, { useEffect, useState } from 'react';
import { useGameBackend } from './hooks/useGameBackend';

const UpdateChecker = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const { gameState, hasActiveBet } = useGameBackend();
  
  // Configuration based on environment
  const isDev = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1';
  
  // Check environment variable or URL pattern
  const isTestingEnv = import.meta.env.VITE_ENABLE_AUTO_UPDATE === 'true' ||
                       (window.location.hostname.includes('aviator-game') && 
                        window.location.hostname.includes('vercel.app'));
  
  // Enable only for non-dev testing environments
  const isEnabled = !isDev && isTestingEnv;

  const checkForUpdates = async () => {
    if (!isEnabled) return; // Skip if not enabled
    
    try {
      setChecking(true);
      // Add timestamp to bypass cache
      const response = await fetch(`/version.json?t=${Date.now()}`);
      const serverVersion = await response.json();
      
      // Get stored version
      const storedVersion = localStorage.getItem('app-version');
      
      if (storedVersion && storedVersion !== serverVersion.buildTime) {
        // Check if user is in an active game
        const gameState = window.gameState || {};
        if (gameState.activeBet || gameState.state === 'running') {
          // Delay update notification during active gameplay
          setTimeout(checkForUpdates, 60000); // Check again in 1 minute
          return;
        }
        setHasUpdate(true);
      } else if (!storedVersion) {
        // First time, just store the version
        localStorage.setItem('app-version', serverVersion.buildTime);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!isEnabled) return; // Skip if not enabled
    
    // Check on mount
    checkForUpdates();
    
    // Check every 2 minutes (instead of 30 seconds)
    const interval = setInterval(checkForUpdates, 120000);
    
    // Check when app becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Listen for custom events to pause checking
    const handleGameStart = () => {
      clearInterval(interval);
    };
    const handleGameEnd = () => {
      // Resume checking after game ends
      checkForUpdates();
    };
    
    window.addEventListener('gameStart', handleGameStart);
    window.addEventListener('gameEnd', handleGameEnd);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('gameStart', handleGameStart);
      window.removeEventListener('gameEnd', handleGameEnd);
    };
  }, [isDev]);

  const handleUpdate = () => {
    // Save any pending data
    try {
      if (window.betHistoryService) {
        window.betHistoryService.saveToLocalStorage();
      }
    } catch (e) {
      console.error('Failed to save data before update:', e);
    }
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    
    // Update stored version
    localStorage.setItem('app-version', 'updating');
    
    // For Telegram Mini Apps, we need to close and reopen
    if (window.Telegram?.WebApp) {
      // Show feedback with countdown
      // Note: showAlert is not available in Telegram WebApp v6.0, use HapticFeedback instead
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning');
      
      // Visual countdown
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Force reload with cache bypass
            window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Regular browser reload
      if (confirm('New version available! Reload now?')) {
        window.location.reload(true);
      }
    }
  };

  const handleDismiss = () => {
    setHasUpdate(false);
    // Check again in 5 minutes
    setTimeout(checkForUpdates, 300000);
  };

  // Debug mode - show status in development/testing
  const showDebug = window.location.search.includes('debug=updates');
  
  if (showDebug && !hasUpdate) {
    return (
      <div className="fixed bottom-2 right-2 bg-gray-800 text-white p-2 rounded text-xs opacity-50">
        Auto-update: {isEnabled ? '✅ ON' : '❌ OFF'}
      </div>
    );
  }

  if (!hasUpdate || !isEnabled) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-green-700 text-white p-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-medium">
          {countdown !== null 
            ? `🔄 Updating in ${countdown}...` 
            : '🎉 New version available!'}
        </span>
        {countdown === null && (
          <>
            <button
              onClick={handleUpdate}
              disabled={checking}
              className="px-3 py-1 bg-white text-green-700 rounded-full text-xs font-bold hover:bg-gray-100 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1 bg-green-800 text-white rounded-full text-xs font-bold hover:bg-green-900 transition-colors"
            >
              Later
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default UpdateChecker;