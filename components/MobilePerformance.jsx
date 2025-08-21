import React, { useEffect, useState, useCallback } from 'react';

// Mobile performance optimization utilities
const MobilePerformance = {
  // Detect mobile device
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Detect touch device
  isTouchDevice: () => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  // Get device pixel ratio for high-DPI displays
  getPixelRatio: () => {
    return window.devicePixelRatio || 1;
  },

  // Optimize animations for mobile
  optimizeAnimations: () => {
    if (MobilePerformance.isMobile()) {
      // Reduce animation complexity on mobile
      document.documentElement.style.setProperty('--animation-duration', '0.2s');
      document.documentElement.style.setProperty('--transition-duration', '0.15s');
    }
  },

  // Debounce function for performance
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Throttle function for scroll/resize events
  throttle: (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // Lazy load images
  lazyLoadImages: () => {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  },

  // Optimize WebSocket for mobile
  optimizeWebSocket: (ws) => {
    if (MobilePerformance.isMobile()) {
      // Reduce ping frequency on mobile to save battery
      const originalSend = ws.send;
      let lastSent = 0;
      const minInterval = 100; // Minimum 100ms between sends

      ws.send = function(data) {
        const now = Date.now();
        if (now - lastSent >= minInterval) {
          originalSend.call(this, data);
          lastSent = now;
        }
      };
    }
  },

  // Memory management
  cleanupMemory: () => {
    // Force garbage collection if available (Chrome DevTools)
    if (window.gc) {
      window.gc();
    }
    
    // Clear unused event listeners
    const events = ['resize', 'scroll', 'touchmove', 'touchstart', 'touchend'];
    events.forEach(event => {
      const listeners = window.getEventListeners?.(window)?.[event] || [];
      listeners.forEach(listener => {
        if (listener.useCapture === false && !listener.passive) {
          window.removeEventListener(event, listener.listener);
        }
      });
    });
  },

  // Battery optimization
  optimizeForBattery: () => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        const updateBatteryOptimizations = () => {
          if (battery.level < 0.2 || !battery.charging) {
            // Low battery mode - reduce animations and effects
            document.documentElement.classList.add('low-battery-mode');
            document.documentElement.style.setProperty('--animation-duration', '0.1s');
            document.documentElement.style.setProperty('--glow-opacity', '0.1');
          } else {
            document.documentElement.classList.remove('low-battery-mode');
            document.documentElement.style.removeProperty('--animation-duration');
            document.documentElement.style.removeProperty('--glow-opacity');
          }
        };

        battery.addEventListener('levelchange', updateBatteryOptimizations);
        battery.addEventListener('chargingchange', updateBatteryOptimizations);
        updateBatteryOptimizations();
      });
    }
  },

  // Network optimization
  optimizeForNetwork: () => {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const updateNetworkOptimizations = () => {
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          // Slow network - reduce data usage
          document.documentElement.classList.add('slow-network');
          // Disable auto-refresh of non-critical data
          window.dispatchEvent(new CustomEvent('slowNetwork', { detail: true }));
        } else {
          document.documentElement.classList.remove('slow-network');
          window.dispatchEvent(new CustomEvent('slowNetwork', { detail: false }));
        }
      };

      connection.addEventListener('change', updateNetworkOptimizations);
      updateNetworkOptimizations();
    }
  }
};

// React hook for mobile performance monitoring
export const useMobilePerformance = () => {
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 60,
    memoryUsage: 0,
    isLowPower: false,
    networkSpeed: 'fast'
  });

  const measureFPS = useCallback(() => {
    let frames = 0;
    let lastTime = performance.now();

    const countFrames = (currentTime) => {
      frames++;
      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        setPerformanceMetrics(prev => ({ ...prev, fps }));
        frames = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(countFrames);
    };

    requestAnimationFrame(countFrames);
  }, []);

  const measureMemory = useCallback(() => {
    if ('memory' in performance) {
      const memory = performance.memory;
      const memoryUsage = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
      setPerformanceMetrics(prev => ({ ...prev, memoryUsage }));
    }
  }, []);

  useEffect(() => {
    // Initialize performance monitoring
    measureFPS();
    
    const memoryInterval = setInterval(measureMemory, 5000);
    
    // Battery monitoring
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        const updatePowerMode = () => {
          setPerformanceMetrics(prev => ({
            ...prev,
            isLowPower: battery.level < 0.2 || !battery.charging
          }));
        };
        
        battery.addEventListener('levelchange', updatePowerMode);
        battery.addEventListener('chargingchange', updatePowerMode);
        updatePowerMode();
      });
    }

    // Network monitoring
    if ('connection' in navigator) {
      const connection = navigator.connection;
      const updateNetworkSpeed = () => {
        const speed = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' 
          ? 'slow' : 'fast';
        setPerformanceMetrics(prev => ({ ...prev, networkSpeed: speed }));
      };
      
      connection.addEventListener('change', updateNetworkSpeed);
      updateNetworkSpeed();
    }

    return () => {
      clearInterval(memoryInterval);
    };
  }, [measureFPS, measureMemory]);

  return performanceMetrics;
};

// Performance monitoring component
export const PerformanceMonitor = ({ showMetrics = false }) => {
  const metrics = useMobilePerformance();

  if (!showMetrics) return null;

  return (
    <div className="fixed top-16 right-4 bg-black bg-opacity-75 text-white p-2 rounded text-xs font-mono z-50">
      <div>FPS: {metrics.fps}</div>
      <div>Memory: {metrics.memoryUsage}%</div>
      <div>Power: {metrics.isLowPower ? 'Low' : 'Normal'}</div>
      <div>Network: {metrics.networkSpeed}</div>
    </div>
  );
};

// Initialize mobile optimizations
export const initializeMobileOptimizations = () => {
  // Run optimizations on load
  MobilePerformance.optimizeAnimations();
  MobilePerformance.optimizeForBattery();
  MobilePerformance.optimizeForNetwork();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    MobilePerformance.cleanupMemory();
  });

  // Handle visibility changes to optimize when app is in background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // App is in background - reduce activity
      window.dispatchEvent(new CustomEvent('appBackground'));
    } else {
      // App is active - resume normal activity
      window.dispatchEvent(new CustomEvent('appForeground'));
    }
  });

  console.log('🚀 Mobile optimizations initialized');
};

export default MobilePerformance;
