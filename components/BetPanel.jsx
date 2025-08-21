import React, { useState, useEffect } from 'react';
import soundEffects from './utils/soundEffects.js';
import { TelegramButton, useTelegramWebApp } from './TelegramWebApp.jsx';

const BetPanel = ({ gameState, betAmount, setBetAmount, onBet, onCashOut, userBalance, multiplier, hasBet, countdown, activeBet, cashedOutMultiplier }) => {
  // Telegram WebApp integration
  const { hapticFeedback, showAlert } = useTelegramWebApp();
  
  // Auto-cashout state
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutMultiplier, setAutoCashoutMultiplier] = useState(2.0);
  const [showAutoCashoutSettings, setShowAutoCashoutSettings] = useState(false);
  
  // Visual feedback state
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [lastAction, setLastAction] = useState(null);

  // Auto-cashout logic
  useEffect(() => {
    if (autoCashoutEnabled && gameState === 'running' && activeBet > 0 && cashedOutMultiplier === 0) {
      if (multiplier >= autoCashoutMultiplier) {
        console.log(`🤖 Auto-cashout triggered at ${multiplier.toFixed(2)}x (target: ${autoCashoutMultiplier}x)`);
        onCashOut();
        soundEffects.playAutoCashoutSound();
        showFeedback(`Auto-cashed out at ${multiplier.toFixed(2)}x!`, 'auto-cashout');
        setAutoCashoutEnabled(false); // Disable after auto-cashout
      }
    }
  }, [multiplier, autoCashoutEnabled, autoCashoutMultiplier, gameState, activeBet, cashedOutMultiplier, onCashOut]);
  const handleDecrease = () => {
    setBetAmount(prev => Math.max(100, prev - 100));
  };

  const handleIncrease = () => {
    setBetAmount(prev => Math.min(userBalance, prev + 100));
  };

  const getButtonText = () => {
    switch (gameState) {
      case 'betting':
        if (activeBet > 0) {
          const autoText = autoCashoutEnabled ? ` (AUTO @ ${autoCashoutMultiplier.toFixed(1)}x)` : '';
          return `BET PLACED - STARTS IN ${countdown}${autoText}`;
        }
        if (countdown > 0) {
          return `BET (STARTS IN ${countdown})`;
        }
        return 'BET';
      case 'running':
        if (activeBet === 0) return 'WAIT FOR NEXT ROUND';
        if (cashedOutMultiplier > 0) return `CASHED OUT @ ${cashedOutMultiplier.toFixed(2)}x`;
        if (autoCashoutEnabled) {
          return `CASH OUT (AUTO @ ${autoCashoutMultiplier.toFixed(1)}x)`;
        }
        return 'CASH OUT';
      case 'crashed':
        if (activeBet === 0) return 'ROUND OVER';
        if (cashedOutMultiplier > 0) return `CASHED OUT @ ${cashedOutMultiplier.toFixed(2)}x`;
        return 'TOO LATE';
      default:
        return 'BET';
    }
  };

  const getButtonColor = () => {
    switch (gameState) {
      case 'betting':
        if (activeBet > 0) {
          return 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/30';
        }
        return 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-500/50';
      case 'running':
        if (activeBet === 0) {
          return 'bg-gray-600 cursor-not-allowed shadow-gray-500/30';
        }
        if (cashedOutMultiplier > 0) {
          return 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/30';
        }
        return 'bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 shadow-yellow-500/50 text-black font-bold';
      case 'crashed':
        if (cashedOutMultiplier > 0) {
          return 'bg-gradient-to-r from-green-600 to-green-500 shadow-green-500/30';
        }
        return 'bg-gray-600 cursor-not-allowed shadow-gray-500/30';
      default:
        return 'bg-gradient-to-r from-red-600 to-red-500';
    }
  };

  const isButtonDisabled = () => {
    return gameState === 'crashed' || 
           (gameState === 'betting' && betAmount > userBalance) ||
           (gameState === 'betting' && activeBet > 0) ||
           (gameState === 'running' && activeBet === 0) ||
           (gameState === 'running' && cashedOutMultiplier > 0);
  };

  const handleButtonClick = () => {
    if (gameState === 'betting' && activeBet === 0) {
      onBet();
      soundEffects.playBetSound();
      showFeedback('Bet placed!', 'bet');
    } else if (gameState === 'running' && activeBet > 0 && cashedOutMultiplier === 0) {
      onCashOut();
      soundEffects.playCashoutSound();
      showFeedback('Cashed out!', 'cashout');
    }
  };

  // Visual feedback function
  const showFeedback = (message, action) => {
    setSuccessMessage(message);
    setLastAction(action);
    setShowSuccessAnimation(true);
    setTimeout(() => {
      setShowSuccessAnimation(false);
    }, 2000);
  };

  // Track successful cashouts for feedback
  useEffect(() => {
    if (cashedOutMultiplier > 0 && lastAction !== 'cashout-shown') {
      const winnings = Math.floor(activeBet * cashedOutMultiplier);
      showFeedback(`Won ${winnings} pts at ${cashedOutMultiplier.toFixed(2)}x!`, 'cashout-shown');
      setLastAction('cashout-shown');
    }
  }, [cashedOutMultiplier, activeBet, lastAction]);

  const getPotentialWinnings = () => {
    if (gameState === 'running' && activeBet > 0) {
      if (cashedOutMultiplier > 0) {
        return Math.floor(activeBet * cashedOutMultiplier);
      }
      return Math.floor(activeBet * multiplier);
    }
    if (activeBet > 0) {
      return Math.floor(activeBet * 2);
    }
    return Math.floor(betAmount * 2);
  };

  return (
    <div className="space-y-4">
      {/* Bet Amount Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400 font-medium">Bet Amount</div>
        {gameState === 'running' && (
          <>
            {activeBet > 0 ? (
              <div className="text-sm text-green-400 font-bold">
                Potential Win: {getPotentialWinnings()} pts
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                No bet placed
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center space-x-3">
        {/* Decrease Button */}
        <TelegramButton
          onClick={handleDecrease}
          disabled={gameState !== 'betting' || betAmount <= 1 || activeBet > 0}
          haptic="selection"
          className="
            w-12 h-12 rounded-full border-2 border-gray-600 
            bg-gray-700 hover:bg-gray-600 
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center
            transition-all duration-200
            shadow-lg hover:shadow-xl
          "
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
          </svg>
        </TelegramButton>

        {/* Bet Amount Display */}
        <div className="flex-1 text-center">
          <div className="bg-gray-700 border border-gray-600 rounded-lg py-3 px-4">
            <div className="text-2xl font-bold text-white">
              {activeBet > 0 ? activeBet : betAmount} pts
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {activeBet > 0 ? 'Active Bet' : 'Bet Amount'}
            </div>
          </div>
        </div>

        {/* Increase Button */}
        <TelegramButton
          onClick={handleIncrease}
          disabled={gameState !== 'betting' || betAmount >= userBalance || activeBet > 0}
          haptic="selection"
          className="
            w-12 h-12 rounded-full border-2 border-gray-600 
            bg-gray-700 hover:bg-gray-600 
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center
            transition-all duration-200
            shadow-lg hover:shadow-xl
          "
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
        </TelegramButton>
      </div>

      {/* Auto-Cashout Settings */}
      {gameState === 'betting' && activeBet === 0 && (
        <div className="space-y-3">
          {/* Auto-Cashout Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAutoCashoutEnabled(!autoCashoutEnabled)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${autoCashoutEnabled ? 'bg-green-600' : 'bg-gray-600'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${autoCashoutEnabled ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
              <span className="text-sm font-medium text-gray-300">Auto Cashout</span>
            </div>
            
            {autoCashoutEnabled && (
              <button
                onClick={() => setShowAutoCashoutSettings(!showAutoCashoutSettings)}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                {showAutoCashoutSettings ? 'Hide' : 'Settings'}
              </button>
            )}
          </div>

          {/* Auto-Cashout Multiplier Settings */}
          {autoCashoutEnabled && showAutoCashoutSettings && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-600">
              <div className="text-sm text-gray-400 mb-2">Auto-cashout at:</div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setAutoCashoutMultiplier(Math.max(1.1, autoCashoutMultiplier - 0.1))}
                  className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
                >
                  <span className="text-sm">-</span>
                </button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    value={autoCashoutMultiplier}
                    onChange={(e) => setAutoCashoutMultiplier(Math.max(1.1, parseFloat(e.target.value) || 1.1))}
                    step="0.1"
                    min="1.1"
                    max="100"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-sm"
                  />
                </div>
                <button
                  onClick={() => setAutoCashoutMultiplier(Math.min(100, autoCashoutMultiplier + 0.1))}
                  className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center"
                >
                  <span className="text-sm">+</span>
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Will auto-cashout at {autoCashoutMultiplier.toFixed(1)}x
              </div>
            </div>
          )}

          {/* Quick Auto-Cashout Presets */}
          {autoCashoutEnabled && !showAutoCashoutSettings && (
            <div className="flex space-x-1">
              {[1.5, 2.0, 3.0, 5.0, 10.0].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAutoCashoutMultiplier(preset)}
                  className={`
                    flex-1 py-1 px-2 text-xs font-medium rounded
                    transition-all duration-200
                    ${autoCashoutMultiplier === preset 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }
                  `}
                >
                  {preset}x
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Bet Buttons */}
      {gameState === 'betting' && activeBet === 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-medium">Quick Bet</div>
          <div className="grid grid-cols-3 gap-2">
            {[10, 50, 100].map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(Math.min(amount, userBalance))}
                disabled={amount > userBalance}
                className="
                  py-2 px-3 text-xs font-medium
                  bg-gray-700 hover:bg-gray-600 
                  border border-gray-600 rounded-lg
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  hover:shadow-lg
                "
              >
                {amount}
              </button>
            ))}
            {[500, 1000, 'Max'].map((amount) => (
              <button
                key={amount}
                onClick={() => setBetAmount(amount === 'Max' ? userBalance : Math.min(amount, userBalance))}
                disabled={amount !== 'Max' && amount > userBalance}
                className="
                  py-2 px-3 text-xs font-medium
                  bg-gray-700 hover:bg-gray-600 
                  border border-gray-600 rounded-lg
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  hover:shadow-lg
                "
              >
                {amount === 'Max' ? 'Max' : amount}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Action Button */}
      <TelegramButton
        onClick={handleButtonClick}
        disabled={isButtonDisabled()}
        haptic="impact"
        hapticStyle={gameState === 'running' ? 'heavy' : 'medium'}
        className={`
          w-full py-4 px-6 rounded-2xl font-black text-lg
          transition-all duration-300 transform
          ${getButtonColor()}
          ${!isButtonDisabled() ? 'hover:scale-105 shadow-lg hover:shadow-2xl' : ''}
          disabled:transform-none disabled:opacity-50
          relative overflow-hidden
        `}
      >
        {/* Button glow effect */}
        {!isButtonDisabled() && (
          <div className="absolute inset-0 bg-white opacity-20 rounded-2xl animate-pulse"></div>
        )}
        
        <span className="relative z-10">{getButtonText()}</span>
        
        {gameState === 'running' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
        )}
      </TelegramButton>

      {/* Status Messages */}
      {gameState === 'betting' && betAmount > userBalance && (
        <div className="text-center text-red-400 text-sm font-medium">
          Insufficient balance
        </div>
      )}

      {gameState === 'crashed' && (
        <div className="text-center text-gray-400 text-sm">
          Waiting for next round...
        </div>
      )}

      {/* Success Animation */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              <span className="font-bold">{successMessage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BetPanel;
