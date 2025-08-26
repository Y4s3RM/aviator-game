// 🚀 Optimized Plane Component - High Performance!
// Uses direct DOM manipulation instead of React re-renders
// Smooth 60fps animations without performance impact

import React, { useRef, useEffect, useState } from 'react';

const PlaneOptimized = ({ gameState, multiplier, countdown, planeElementRef }) => {
  const containerRef = useRef(null);
  const exhaustRef = useRef(null);
  const warmupRef = useRef(null);
  const [initialRender, setInitialRender] = useState(true);
  
  // Initialize plane position only once
  useEffect(() => {
    if (planeElementRef?.current && initialRender) {
      // Set initial position
      const element = planeElementRef.current;
      element.style.transform = 'translate(20vw, 75vh) rotate(0deg)';
      element.style.transition = 'none';
      element.style.willChange = 'transform';
      setInitialRender(false);
    }
  }, [planeElementRef, initialRender]);
  
  // Update exhaust and warmup effects (these can use React since they're less frequent)
  useEffect(() => {
    if (!exhaustRef.current || !warmupRef.current) return;
    
    const exhaust = exhaustRef.current;
    const warmup = warmupRef.current;
    
    if (gameState === 'running') {
      // Show exhaust trail
      exhaust.style.display = 'block';
      exhaust.style.width = `${Math.min(multiplier * 4 + 8, 28)}px`;
      exhaust.style.opacity = Math.min(multiplier / 3, 1);
      exhaust.style.boxShadow = `0 0 ${Math.min(multiplier * 2, 8)}px rgba(255, 69, 0, 0.6)`;
      
      // Hide warmup
      warmup.style.display = 'none';
    } else if (gameState === 'betting' && countdown > 0 && countdown <= 3) {
      // Show warmup effect
      warmup.style.display = 'block';
      warmup.style.opacity = Math.max(0.4, (3 - countdown) / 3);
      
      // Hide exhaust
      exhaust.style.display = 'none';
    } else {
      // Hide both effects
      exhaust.style.display = 'none';
      warmup.style.display = 'none';
    }
  }, [gameState, multiplier, countdown]);
  
  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {/* Optimized Plane - Position updated via direct DOM manipulation */}
      <div
        ref={planeElementRef}
        className="absolute w-12 h-8 flex items-center justify-center"
        style={{
          transform: 'translate(20vw, 75vh) rotate(0deg)',
          transition: gameState === 'crashed' ? 'transform 0.5s ease-in' : 'none',
        }}
      >
        {/* Plane SVG */}
        <svg viewBox="0 0 48 32" className="w-full h-full">
          <defs>
            <linearGradient id="planeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#1e40af" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <filter id="planeShadow">
              <feDropShadow dx="2" dy="2" stdDeviation="1" floodColor="rgba(0,0,0,0.3)" />
            </filter>
          </defs>
          
          {/* Plane body */}
          <ellipse cx="24" cy="16" rx="20" ry="3" fill="url(#planeGradient)" filter="url(#planeShadow)" />
          
          {/* Wings */}
          <ellipse cx="18" cy="16" rx="8" ry="2" fill="#1e40af" />
          <ellipse cx="30" cy="16" rx="6" ry="1.5" fill="#1e3a8a" />
          
          {/* Cockpit */}
          <circle cx="38" cy="16" r="2" fill="#60a5fa" />
          <circle cx="38" cy="16" r="1" fill="#93c5fd" opacity="0.8" />
        </svg>

        {/* Exhaust Trail - Updated via useEffect for better performance */}
        <div 
          ref={exhaustRef}
          className="absolute -left-6 top-1/2 -translate-y-1/2"
          style={{ display: 'none' }}
        >
          <div 
            className="h-1 bg-gradient-to-r from-orange-500 via-red-500 to-transparent rounded-full animate-pulse"
          />
          {/* Secondary exhaust for high multipliers */}
          <div 
            className="absolute top-0 h-0.5 bg-gradient-to-r from-yellow-400 via-orange-400 to-transparent rounded-full animate-pulse"
            style={{ left: '2px', top: '1px' }}
          />
        </div>

        {/* Warmup Effect - Updated via useEffect */}
        <div 
          ref={warmupRef}
          className="absolute -left-4 top-1/2 -translate-y-1/2"
          style={{ display: 'none' }}
        >
          <div 
            className="w-4 h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-transparent rounded-full animate-pulse"
            style={{ 
              animationDuration: '0.8s',
              boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PlaneOptimized;
