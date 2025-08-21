import React, { useEffect, useState, useCallback } from 'react';
import authService from './services/authService.js';

// Telegram WebApp integration component
const TelegramWebApp = ({ children }) => {
  const [tg, setTg] = useState(null);
  const [user, setUser] = useState(null);
  const [themeParams, setThemeParams] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Authenticate user with backend
  const authenticateUser = async (telegramUser) => {
    try {
      console.log('🔐 Authenticating Telegram user:', telegramUser);
      const result = await authService.authenticateWithTelegram(telegramUser);
      
      if (result.success) {
        setIsAuthenticated(true);
        setAuthError(null);
        console.log('✅ Authentication successful');
      } else {
        setIsAuthenticated(false);
        setAuthError(result.error);
        console.error('❌ Authentication failed:', result.error);
      }
    } catch (error) {
      setIsAuthenticated(false);
      setAuthError('Network error');
      console.error('❌ Authentication error:', error);
    }
  };

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      setTg(webApp);

      // Initialize the app
      webApp.ready();
      webApp.expand();
      
      // Get user data and authenticate
      if (webApp.initDataUnsafe?.user) {
        const telegramUser = webApp.initDataUnsafe.user;
        setUser(telegramUser);
        
        // Automatically authenticate with backend
        authenticateUser(telegramUser);
      }

      // Get theme parameters
      setThemeParams(webApp.themeParams);

      // Apply Telegram theme
      applyTelegramTheme(webApp.themeParams);

      // Set up event listeners
      webApp.onEvent('themeChanged', () => {
        setThemeParams(webApp.themeParams);
        applyTelegramTheme(webApp.themeParams);
      });

      webApp.onEvent('viewportChanged', () => {
        console.log('Viewport changed:', webApp.viewportHeight, webApp.viewportStableHeight);
      });

      setIsReady(true);

      console.log('🤖 Telegram WebApp initialized:', {
        user: webApp.initDataUnsafe?.user,
        platform: webApp.platform,
        version: webApp.version,
        colorScheme: webApp.colorScheme
      });
    } else {
      // Fallback for development/testing outside Telegram
      console.log('⚠️ Running outside Telegram - using fallback mode');
      setIsReady(true);
    }
  }, []);

  const applyTelegramTheme = (theme) => {
    const root = document.documentElement;
    
    // Apply Telegram theme colors
    if (theme.bg_color) {
      root.style.setProperty('--tg-bg-color', theme.bg_color);
      root.style.setProperty('--tw-bg-gray-900', theme.bg_color);
    }
    
    if (theme.text_color) {
      root.style.setProperty('--tg-text-color', theme.text_color);
      root.style.setProperty('--tw-text-white', theme.text_color);
    }
    
    if (theme.hint_color) {
      root.style.setProperty('--tg-hint-color', theme.hint_color);
      root.style.setProperty('--tw-text-gray-400', theme.hint_color);
    }
    
    if (theme.button_color) {
      root.style.setProperty('--tg-button-color', theme.button_color);
      root.style.setProperty('--tw-bg-blue-600', theme.button_color);
    }
    
    if (theme.button_text_color) {
      root.style.setProperty('--tg-button-text-color', theme.button_text_color);
    }

    if (theme.secondary_bg_color) {
      root.style.setProperty('--tg-secondary-bg-color', theme.secondary_bg_color);
      root.style.setProperty('--tw-bg-gray-800', theme.secondary_bg_color);
    }

    // Apply theme class to body
    document.body.className = `telegram-theme ${tg?.colorScheme || 'dark'}`;
  };

  return (
    <TelegramContext.Provider value={{ 
      tg, 
      user, 
      themeParams, 
      isReady, 
      isAuthenticated, 
      authError,
      authenticateUser 
    }}>
      {children}
    </TelegramContext.Provider>
  );
};

// Context for Telegram WebApp
const TelegramContext = React.createContext({});

// Hook to use Telegram WebApp features
export const useTelegramWebApp = () => {
  const context = React.useContext(TelegramContext);
  
  const showAlert = useCallback((message) => {
    if (context.tg) {
      context.tg.showAlert(message);
    } else {
      alert(message);
    }
  }, [context.tg]);

  const showConfirm = useCallback((message, callback) => {
    if (context.tg) {
      context.tg.showConfirm(message, callback);
    } else {
      const result = confirm(message);
      callback(result);
    }
  }, [context.tg]);

  const hapticFeedback = useCallback((type = 'impact', style = 'medium') => {
    if (context.tg?.HapticFeedback) {
      switch (type) {
        case 'impact':
          context.tg.HapticFeedback.impactOccurred(style); // light, medium, heavy
          break;
        case 'notification':
          context.tg.HapticFeedback.notificationOccurred(style); // error, success, warning
          break;
        case 'selection':
          context.tg.HapticFeedback.selectionChanged();
          break;
      }
    } else if (navigator.vibrate) {
      // Fallback vibration
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30,
        success: [10, 50, 10],
        error: [20, 100, 20],
        warning: [15, 75, 15]
      };
      navigator.vibrate(patterns[style] || patterns.medium);
    }
  }, [context.tg]);

  const setMainButton = useCallback((text, callback, color = null) => {
    if (context.tg?.MainButton) {
      context.tg.MainButton.setText(text);
      if (color) {
        context.tg.MainButton.setParams({ color });
      }
      context.tg.MainButton.onClick(callback);
      context.tg.MainButton.show();
    }
  }, [context.tg]);

  const hideMainButton = useCallback(() => {
    if (context.tg?.MainButton) {
      context.tg.MainButton.hide();
    }
  }, [context.tg]);

  const setBackButton = useCallback((callback) => {
    if (context.tg?.BackButton) {
      context.tg.BackButton.onClick(callback);
      context.tg.BackButton.show();
    }
  }, [context.tg]);

  const hideBackButton = useCallback(() => {
    if (context.tg?.BackButton) {
      context.tg.BackButton.hide();
    }
  }, [context.tg]);

  const close = useCallback(() => {
    if (context.tg) {
      context.tg.close();
    }
  }, [context.tg]);

  const sendData = useCallback((data) => {
    if (context.tg) {
      context.tg.sendData(JSON.stringify(data));
    }
  }, [context.tg]);

  return {
    ...context,
    showAlert,
    showConfirm,
    hapticFeedback,
    setMainButton,
    hideMainButton,
    setBackButton,
    hideBackButton,
    close,
    sendData
  };
};

// Telegram-specific button component
export const TelegramButton = ({ 
  children, 
  onClick, 
  haptic = 'impact', 
  hapticStyle = 'medium',
  className = '',
  ...props 
}) => {
  const { hapticFeedback } = useTelegramWebApp();

  const handleClick = useCallback((e) => {
    hapticFeedback(haptic, hapticStyle);
    if (onClick) {
      onClick(e);
    }
  }, [onClick, hapticFeedback, haptic, hapticStyle]);

  return (
    <button
      className={`telegram-button ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

// Telegram theme styles component
export const TelegramThemeStyles = () => {
  return (
    <style jsx global>{`
      .telegram-theme {
        --tg-bg-color: var(--tg-bg-color, #1a1a1a);
        --tg-text-color: var(--tg-text-color, #ffffff);
        --tg-hint-color: var(--tg-hint-color, #999999);
        --tg-button-color: var(--tg-button-color, #2ea6ff);
        --tg-button-text-color: var(--tg-button-text-color, #ffffff);
        --tg-secondary-bg-color: var(--tg-secondary-bg-color, #2a2a2a);
      }

      .telegram-theme.light {
        --tg-bg-color: var(--tg-bg-color, #ffffff);
        --tg-text-color: var(--tg-text-color, #000000);
        --tg-hint-color: var(--tg-hint-color, #999999);
        --tg-secondary-bg-color: var(--tg-secondary-bg-color, #f0f0f0);
      }

      .telegram-button {
        background: var(--tg-button-color);
        color: var(--tg-button-text-color);
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        touch-action: manipulation;
        user-select: none;
      }

      .telegram-button:active {
        transform: scale(0.96);
        opacity: 0.8;
      }

      .telegram-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Telegram-specific viewport handling */
      .telegram-viewport {
        height: 100vh;
        height: var(--tg-viewport-height, 100vh);
        overflow: hidden;
      }

      /* Hide elements that shouldn't appear in Telegram */
      .telegram-theme .hide-in-telegram {
        display: none !important;
      }

      /* Telegram-safe scrolling */
      .telegram-scroll {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .telegram-scroll::-webkit-scrollbar {
        display: none;
      }
    `}</style>
  );
};

export default TelegramWebApp;
