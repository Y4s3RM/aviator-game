import React from 'react';

const MultiplierDisplay = ({ multiplier, gameState, countdown }) => {
  const getDisplayText = () => {
    if (gameState === 'crashed') {
      return 'FLEW AWAY!';
    }
    return `${multiplier.toFixed(2)}x`;
  };

  const getTextColor = () => {
    if (gameState === 'crashed') {
      return 'text-red-400';
    }
    if (multiplier >= 10) {
      return 'text-yellow-400';
    }
    if (multiplier >= 5) {
      return 'text-purple-400';
    }
    if (multiplier >= 2) {
      return 'text-blue-400';
    }
    return 'text-green-400';
  };

  const getGlowColor = () => {
    if (gameState === 'crashed') {
      return 'drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]';
    }
    if (multiplier >= 10) {
      return 'drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]';
    }
    if (multiplier >= 5) {
      return 'drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]';
    }
    if (multiplier >= 2) {
      return 'drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]';
    }
    return 'drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]';
  };

  return (
    <div className="text-center">
      <div className={`
        text-6xl md:text-7xl font-black 
        ${getTextColor()} 
        ${getGlowColor()}
        transition-all duration-300 
        ${gameState === 'running' ? 'animate-pulse' : ''}
        ${gameState === 'crashed' ? 'animate-bounce' : ''}
        font-mono tracking-wider
      `}>
        {getDisplayText()}
      </div>
      
      {gameState === 'betting' && (
        <div className="mt-4 space-y-2">
          {countdown > 0 ? (
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400 animate-pulse">
                {countdown}
              </div>
              <div className="text-sm text-gray-400 font-medium">
                Starting in...
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm font-medium">
              Place your bets now!
            </div>
          )}
        </div>
      )}
      
      {gameState === 'running' && (
        <div className="mt-2 text-gray-300 text-sm font-medium animate-pulse">
          Flying... Cash out before it crashes!
        </div>
      )}
      
      {gameState === 'crashed' && (
        <div className="mt-2 text-red-400 text-sm font-bold">
          Better luck next time!
        </div>
      )}
    </div>
  );
};

export default MultiplierDisplay;
