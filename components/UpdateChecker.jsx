import React, { useEffect, useState } from 'react';

const UpdateChecker = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);
  
  // Don't run in development
  const isDev = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1';

  const checkForUpdates = async () => {
    if (isDev) return; // Skip in development
    
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
    if (isDev) return; // Skip in development
    
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
      let countdown = 3;
      const showCountdown = () => {
        if (countdown > 0) {
          window.Telegram.WebApp.showAlert(
            `Update available! Reloading in ${countdown}...`, 
            () => {
              countdown--;
              if (countdown > 0) {
                setTimeout(showCountdown, 1000);
              } else {
                // Force reload with cache bypass
                window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
              }
            }
          );
        }
      };
      showCountdown();
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

  if (!hasUpdate || isDev) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-green-700 text-white p-2 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm font-medium">
          🎉 New version available!
        </span>
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
      </div>
    </div>
  );
};

export default UpdateChecker;