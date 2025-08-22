import React, { useState, useEffect, useMemo, useCallback } from 'react';
import MultiplierDisplay from './components/MultiplierDisplay.jsx';
import Plane from './components/Plane.jsx';
import BetPanel from './components/BetPanel.jsx';
import HistoryItem from './components/HistoryItem.jsx';
import BottomNav from './components/BottomNav.jsx';
import BackendTest from './components/BackendTest.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import NotificationSystem from './components/NotificationSystem.jsx';
import AuthModal from './components/AuthModal.jsx';
import AdminLoginModal from './components/AdminLoginModal.jsx';
import UserProfile from './components/UserProfile.jsx';
import { useGameBackend } from './components/hooks/useGameBackend.js';
import soundEffects from './components/utils/soundEffects.js';
import authService from './components/services/authService.js';
import gameService from './components/services/gameService.js';
import TelegramWebApp, { useTelegramWebApp, TelegramThemeStyles } from './components/TelegramWebApp.jsx';

function App() {
  // Telegram WebApp integration
  const { 
    tg, 
    user: telegramUser, 
    themeParams, 
    isReady: telegramReady,
    hapticFeedback,
    setMainButton,
    hideMainButton,
    showAlert
  } = useTelegramWebApp();

  // Use the backend hook for real-time game state
  const {
    isConnected,
    gameState,
    multiplier,
    countdown,
    playersOnline,
    playerBalance,
    hasActiveBet,
    activeBetAmount,
    cashedOut,
    cashedOutMultiplier,
    crashHistory,
    placeBet,
    cashOut
  } = useGameBackend();

  // Local state for UI
  const [betAmount, setBetAmount] = useState(100);
  const [showBackendTest, setShowBackendTest] = useState(false); // Default to main game now
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [prevGameState, setPrevGameState] = useState(gameState);
  const [prevCountdown, setPrevCountdown] = useState(countdown);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState([]);
  
  // Authentication state
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Avatar image selection (Telegram photo, user avatar, or identicon fallback)
  const avatarUrl = useMemo(() => {
    if (telegramUser?.photo_url) return telegramUser.photo_url;
    if (user?.avatar) return user.avatar;
    const seed = telegramUser?.username || telegramUser?.first_name || user?.username || 'Guest';
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;
  }, [telegramUser, user]);

  const displayName = useMemo(() => {
    return telegramUser?.first_name || user?.username || 'Guest';
  }, [telegramUser, user]);

  const displayUsername = useMemo(() => {
    return telegramUser?.username || user?.username || 'user';
  }, [telegramUser, user]);

  // defined after notification helpers to avoid TDZ

  // Notification functions (defined first to avoid hoisting issues)
  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { ...notification, id }]);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      addNotification({ type: 'success', title: 'Logged out', message: 'You have been logged out', duration: 2000 });
    } finally {
      setShowUserMenu(false);
    }
  }, [addNotification]);

  // Authentication state management
  useEffect(() => {
    // Initialize auth state from localStorage
    const initializeAuth = () => {
      const isAuth = authService.isAuthenticated();
      const currentUser = authService.getUser();
      
      setIsAuthenticated(isAuth);
      setUser(currentUser);
      
      if (isAuth && currentUser) {
        addNotification({
          type: 'success',
          title: 'Welcome back!',
          message: `Logged in as ${currentUser.username}`,
          duration: 3000
        });
      }
    };

    initializeAuth();

    // If URL has ?admin=1 and not already authenticated as admin, open admin login
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1' && !(authService.isAuthenticated() && authService.isAdmin())) {
      setShowAdminLogin(true);
    }
  }, [addNotification]);

  // Debug crash history and connection
  console.log('🎯 App crashHistory:', crashHistory, 'length:', crashHistory?.length);
  console.log('🔌 Connection status:', isConnected);
  console.log('🎮 Game state:', gameState);
  console.log('🔐 Auth state:', { isAuthenticated, user: user?.username });

  // Handle bet placement using backend with limit checking
  const handleBet = useCallback(() => {
    if (gameState === 'betting' && betAmount <= playerBalance && !hasActiveBet) {
      const result = placeBet(betAmount);
      if (!result.success) {
        // Show limit warning notification
        addNotification({
          type: 'warning',
          title: 'Daily Limit Reached',
          message: 'Your bet was blocked by responsible gaming limits.',
          details: result.reasons,
          duration: 6000
        });
      }
    }
  }, [gameState, betAmount, playerBalance, hasActiveBet, placeBet, addNotification]);

  // Handle cash out using backend
  const handleCashOut = useCallback(() => {
    if (gameState === 'running' && hasActiveBet && !cashedOut) {
      cashOut();
    }
  }, [gameState, hasActiveBet, cashedOut, cashOut]);

  // Sound effects for game state changes
  useEffect(() => {
    // Countdown sounds
    if (gameState === 'betting' && countdown > 0 && countdown !== prevCountdown) {
      if (countdown <= 3 && countdown > 0) {
        if (countdown === 1) {
          soundEffects.playFinalCountdownBeep();
        } else {
          soundEffects.playCountdownBeep();
        }
      }
    }

    // Crash sound and notification
    if (gameState === 'crashed' && prevGameState === 'running') {
      soundEffects.playCrashSound();
      
      // Show crash notification if player had an active bet
      if (hasActiveBet && !cashedOut) {
        addNotification({
          type: 'error',
          title: 'Plane Crashed!',
          message: `The plane crashed at ${multiplier.toFixed(2)}x. Better luck next time!`,
          duration: 4000
        });
      }
    }

    // Update previous states
    setPrevGameState(gameState);
    setPrevCountdown(countdown);
  }, [gameState, countdown, prevGameState, prevCountdown, hasActiveBet, cashedOut, multiplier, addNotification]);

  // Show backend test if needed (for debugging)
  if (showBackendTest) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">🚀 Aviator Backend Test</h1>
            <p className="text-gray-400">Testing connection to our new backend</p>
            <button 
              onClick={() => setShowBackendTest(false)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Switch to Main Game
            </button>
          </div>
          <BackendTest />
        </div>
      </div>
    );
  }

  // Show connection error if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔌</div>
          <h1 className="text-2xl font-bold mb-2">Connecting to Game Server...</h1>
          <p className="text-gray-400 mb-4">Please wait while we establish connection</p>
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <TelegramWebApp>
      <TelegramThemeStyles />
      <div className="telegram-viewport bg-gray-900 text-white flex flex-col overflow-hidden" style={{ height: '-webkit-fill-available' }}>
      {/* Header - Mobile optimized */}
      <header className="bg-gray-800 shadow-lg flex-shrink-0">
        {/* Main header row */}
        <div className="flex items-center justify-between p-3 sm:p-4">
                  <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12L8 10l2-2 2 2-2 2z"/>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Aviator</h1>
            {isAuthenticated && (
              <p className="text-xs text-gray-400">Welcome, {user.username}</p>
            )}
          </div>
        </div>
          
          {/* Balance and controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Balance - Always visible */}
            <div className="text-right">
              <div className="text-xs sm:text-sm text-gray-400">
                {isAuthenticated ? 'Balance' : 'Demo Balance'}
              </div>
              <div className={`font-bold text-sm sm:text-base ${isAuthenticated ? 'text-green-400' : 'text-yellow-400'}`}>
                {playerBalance} pts
              </div>
            </div>
            
            {/* Connection status - Hidden on very small screens */}
            <div className="hidden sm:flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-400 hidden md:inline">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Telegram User Info */}
              {
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="flex items-center space-x-2 focus:outline-none"
                  >
                    <img
                      src={avatarUrl}
                      alt="avatar"
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-gray-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-medium">{displayName}</div>
                      <div className="text-xs text-gray-400">@{displayUsername}</div>
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                      {/* Sound control */}
                      <button
                        onClick={() => {
                          const newSoundState = soundEffects.toggleSound();
                          setSoundEnabled(newSoundState);
                        }}
                        className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-700 border-b border-gray-700"
                      >
                        <span className="mr-2">{soundEnabled ? '🔊' : '🔇'}</span>
                        <span> {soundEnabled ? 'On' : 'Off'}</span>
                      </button>
                      <button
                        onClick={async () => {
                          const newSoundState = soundEffects.toggleSound();
                          setSoundEnabled(newSoundState);
                          try {
                            const auth = (await import('./components/services/authService.js')).default;
                            await auth.updatePlayerSettings({ soundEnabled: newSoundState });
                          } catch (_) {}
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 rounded-t-lg"
                      >
                        <span className="mr-2">{soundEnabled ? '🔊' : '🔇'}</span>
                        <span> Sound {soundEnabled ? 'On' : 'Off'}</span>
                      </button>
                      <button
                        onClick={() => setShowUserProfile(true)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 rounded-t-lg"
                      >
                        Profile
                      </button>
                      {authService.isAdmin() && (
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-gray-700 rounded-b-lg"
                        >
                          Logout (Admin)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              }
              
              <button 
                onClick={() => setShowStatsPanel(true)}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                title="Statistics & History"
              >
                <span className="text-xs sm:text-sm">📊</span>
              </button>

              <button 
                onClick={() => setShowBackendTest(true)}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 text-gray-300 rounded-full flex items-center justify-center hover:bg-gray-600 transition-colors"
                title="Debug: Show Backend Test"
              >
                <span className="text-xs sm:text-sm">🐛</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area - Optimized for both desktop and mobile */}
      <div className="flex-1 relative overflow-hidden bg-gradient-to-br from-purple-900 via-gray-900 to-black flex flex-col min-h-0">
        {/* Professional gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-800/30 via-gray-900/50 to-black/80"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}></div>
        
        {/* Stars background */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        {/* Multiplier Display - Mobile optimized */}
        <div className="relative z-10 flex-shrink-0 pt-4 pb-2 sm:pt-8 sm:pb-4 md:pt-12 md:pb-8">
          <MultiplierDisplay multiplier={multiplier} gameState={gameState} countdown={countdown} />
        </div>

        {/* Plane - Mobile optimized with more space */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-2 py-4 sm:px-8 sm:py-8 md:px-12 md:py-12 plane-container min-h-0">
          <Plane gameState={gameState} multiplier={multiplier} countdown={countdown} />
        </div>

      </div>

      {/* History Strip - Fixed horizontal overflow */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-800/50 backdrop-blur-sm flex-shrink-0 overflow-hidden">
        <div className="flex space-x-2 sm:space-x-3 overflow-x-auto scrollbar-hide pb-1">
          {crashHistory.length > 0 ? (
            crashHistory.map((crashMultiplier, index) => (
              <HistoryItem key={`${crashMultiplier}-${index}`} multiplier={crashMultiplier} />
            ))
          ) : (
            // Show placeholder while loading
            <div className="text-gray-400 text-sm">Waiting for crash history...</div>
          )}
        </div>
      </div>

      {/* Bet Panel - Mobile optimized with better touch targets */}
      <div className="p-4 sm:p-4 md:p-6 bg-gray-800 border-t border-gray-700 flex-shrink-0 mobile-spacing">
        <BetPanel
          gameState={gameState}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onBet={handleBet}
          onCashOut={handleCashOut}
          userBalance={playerBalance}
          multiplier={multiplier}
          hasBet={hasActiveBet}
          countdown={countdown}
          activeBet={activeBetAmount}
          cashedOutMultiplier={cashedOutMultiplier}
        />
      </div>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Statistics Panel */}
      <StatsPanel 
        isOpen={showStatsPanel} 
        onClose={() => setShowStatsPanel(false)} 
      />

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={(user) => {
          console.log('User authenticated:', user);
          // The auth service will handle state updates
        }}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={showAdminLogin && !(isAuthenticated && authService.isAdmin())}
        onClose={() => setShowAdminLogin(false)}
        onSuccess={(user) => {
          setIsAuthenticated(true);
          setUser(user);
          addNotification({ type: 'success', title: 'Welcome, Admin', message: user.username, duration: 2500 });
          try {
            // Reconnect WebSocket with fresh auth token so session is not guest
            gameService.disconnect();
            setTimeout(() => {
              gameService.connect();
            }, 200);
          } catch (_) {}
        }}
      />

      {/* User Profile Modal */}
      <UserProfile 
        isOpen={showUserProfile} 
        onClose={() => setShowUserProfile(false)}
      />

      {/* Notification System */}
      <NotificationSystem 
        notifications={notifications}
        onDismiss={dismissNotification}
      />
      </div>
    </TelegramWebApp>
  );
}

export default App;
