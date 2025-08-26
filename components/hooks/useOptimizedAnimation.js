// 🚀 Optimized Animation Hook - No React Re-renders!
// Uses useRef + requestAnimationFrame for smooth 60fps animations
// without triggering React component re-renders

import { useRef, useEffect, useCallback } from 'react';

export function useOptimizedAnimation(gameState, serverMultiplier) {
  const animationRef = useRef();
  const lastUpdateRef = useRef(Date.now());
  const localMultiplierRef = useRef(1.0);
  const targetMultiplierRef = useRef(1.0);
  const gameStartTimeRef = useRef(null);
  const planeElementRef = useRef(null);
  const multiplierElementRef = useRef(null);
  
  // Update target from server (only triggers when server sends new data)
  useEffect(() => {
    targetMultiplierRef.current = serverMultiplier;
    lastUpdateRef.current = Date.now();
    
    if (gameState === 'running' && gameStartTimeRef.current === null) {
      gameStartTimeRef.current = Date.now();
      localMultiplierRef.current = 1.0;
    }
    
    if (gameState === 'betting' || gameState === 'crashed') {
      gameStartTimeRef.current = null;
      localMultiplierRef.current = serverMultiplier;
    }
  }, [serverMultiplier, gameState]);
  
  // Smooth local interpolation function
  const interpolateToTarget = useCallback((current, target, deltaTime) => {
    if (gameState !== 'running') return target;
    
    // For running state, smoothly interpolate between updates
    const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
    if (timeSinceLastUpdate > 1000) {
      // Too long since last server update, fall back to local calculation
      const elapsed = Date.now() - gameStartTimeRef.current;
      return 1.0 + (elapsed / 3000);
    }
    
    // Smooth interpolation between current and target
    const lerpSpeed = 0.1; // Adjust for smoothness vs responsiveness
    return current + (target - current) * Math.min(lerpSpeed * deltaTime * 60, 1);
  }, [gameState]);
  
  // Animation loop (runs at 60fps, no React re-renders!)
  const animate = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - (animationRef.lastTime || now)) / 1000;
    animationRef.lastTime = now;
    
    // Update local multiplier smoothly
    localMultiplierRef.current = interpolateToTarget(
      localMultiplierRef.current,
      targetMultiplierRef.current,
      deltaTime
    );
    
    // Update DOM elements directly (bypassing React)
    updatePlanePosition();
    updateMultiplierDisplay();
    
    // Continue animation loop
    animationRef.current = requestAnimationFrame(animate);
  }, [interpolateToTarget]);
  
  // Direct DOM updates for performance
  const updatePlanePosition = useCallback(() => {
    if (!planeElementRef.current) return;
    
    const multiplier = localMultiplierRef.current;
    let x, y, rotation;
    
    if (gameState === 'betting') {
      x = 20; y = 75; rotation = 0;
    } else if (gameState === 'running') {
      const t = Math.min(multiplier / 5, 1);
      x = 20 + t * 50 + Math.sin(Date.now() / 300) * 2;
      y = 75 - Math.pow(t, 0.7) * 50;
      rotation = 2 - (t * 12);
      
      // Mobile bounds
      const isMobile = window.innerWidth < 640;
      const maxX = isMobile ? 80 : 85;
      const minY = isMobile ? 20 : 15;
      x = Math.min(x, maxX);
      y = Math.max(y, minY);
    } else if (gameState === 'crashed') {
      x = 110; y = 5; rotation = -15;
    }
    
    // Apply transform directly to DOM (GPU accelerated)
    const element = planeElementRef.current;
    element.style.transform = `translate(${x}vw, ${y}vh) rotate(${rotation}deg)`;
    element.style.willChange = 'transform'; // GPU hint
  }, [gameState]);
  
  const updateMultiplierDisplay = useCallback(() => {
    if (!multiplierElementRef.current) return;
    
    const multiplier = localMultiplierRef.current;
    const element = multiplierElementRef.current;
    
    if (gameState === 'crashed') {
      element.textContent = 'FLEW AWAY!';
      element.className = 'text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]';
    } else {
      element.textContent = `${multiplier.toFixed(2)}x`;
      
      // Update colors based on multiplier
      let colorClass, glowClass;
      if (multiplier >= 10) {
        colorClass = 'text-yellow-400';
        glowClass = 'drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]';
      } else if (multiplier >= 5) {
        colorClass = 'text-purple-400';
        glowClass = 'drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]';
      } else if (multiplier >= 2) {
        colorClass = 'text-blue-400';
        glowClass = 'drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]';
      } else {
        colorClass = 'text-green-400';
        glowClass = 'drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]';
      }
      
      element.className = `${colorClass} ${glowClass}`;
    }
  }, [gameState]);
  
  // Start/stop animation loop
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);
  
  // Get current smooth multiplier (for components that need it)
  const getCurrentMultiplier = useCallback(() => {
    return localMultiplierRef.current;
  }, []);
  
  return {
    planeElementRef,
    multiplierElementRef,
    getCurrentMultiplier
  };
}
