// 🚀 Optimized MultiplierDisplay - High Performance!
// Uses direct DOM manipulation for multiplier updates
// React only renders static elements, no re-renders during animation

import React, { useEffect, useRef } from 'react';

const MultiplierDisplayOptimized = ({ gameState, countdown, multiplierElementRef, serverMultiplier }) => {
  const containerRef = useRef(null);
  const subtitleRef = useRef(null);
  
  // Update subtitle and static elements when game state changes (infrequent)
  useEffect(() => {
    if (!subtitleRef.current) return;
    
    const subtitle = subtitleRef.current;
    
    if (gameState === 'betting') {
      if (countdown > 0) {
        subtitle.innerHTML = `
          <div class="text-3xl font-bold text-yellow-400 animate-pulse">
            ${countdown}
          </div>
          <div class="text-sm text-gray-400 font-medium">
            Starting in...
          </div>
        `;
      } else {
        subtitle.innerHTML = `
          <div class="text-gray-400 text-sm font-medium">
            Place your bets now!
          </div>
        `;
      }
      subtitle.style.display = 'block';
    } else if (gameState === 'running') {
      subtitle.innerHTML = `
        <div class="text-gray-300 text-sm font-medium animate-pulse">
          Flying... Cash out before it crashes!
        </div>
      `;
      subtitle.style.display = 'block';
    } else if (gameState === 'crashed') {
      subtitle.innerHTML = `
        <div class="text-red-400 text-sm font-bold">
          Better luck next time!
        </div>
      `;
      subtitle.style.display = 'block';
    } else {
      subtitle.style.display = 'none';
    }
  }, [gameState, countdown]);
  
  // Initialize multiplier display
  useEffect(() => {
    if (!multiplierElementRef?.current) return;
    
    const element = multiplierElementRef.current;
    element.className = `
      text-6xl md:text-7xl font-black font-mono tracking-wider
      transition-colors duration-300
      ${gameState === 'running' ? 'animate-pulse' : ''}
      ${gameState === 'crashed' ? 'animate-bounce' : ''}
    `;
    
    // Set initial content
    if (gameState === 'crashed') {
      element.textContent = 'FLEW AWAY!';
      element.classList.add('text-red-400', 'drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]');
    } else {
      element.textContent = `${serverMultiplier.toFixed(2)}x`;
      element.classList.add('text-green-400', 'drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]');
    }
  }, [multiplierElementRef, gameState, serverMultiplier]);
  
  return (
    <div ref={containerRef} className="text-center">
      {/* Multiplier Display - Content updated via direct DOM manipulation */}
      <div 
        ref={multiplierElementRef}
        className="text-6xl md:text-7xl font-black font-mono tracking-wider text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]"
      >
        {gameState === 'crashed' ? 'FLEW AWAY!' : `${serverMultiplier.toFixed(2)}x`}
      </div>
      
      {/* Subtitle - Updated via useEffect for better performance */}
      <div ref={subtitleRef} className="mt-4 space-y-2">
        {gameState === 'betting' && countdown > 0 && (
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400 animate-pulse">
              {countdown}
            </div>
            <div className="text-sm text-gray-400 font-medium">
              Starting in...
            </div>
          </div>
        )}
        
        {gameState === 'betting' && countdown <= 0 && (
          <div className="text-gray-400 text-sm font-medium">
            Place your bets now!
          </div>
        )}
        
        {gameState === 'running' && (
          <div className="text-gray-300 text-sm font-medium animate-pulse">
            Flying... Cash out before it crashes!
          </div>
        )}
        
        {gameState === 'crashed' && (
          <div className="text-red-400 text-sm font-bold">
            Better luck next time!
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiplierDisplayOptimized;
