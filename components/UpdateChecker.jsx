import React, { useEffect, useState } from 'react';

const UpdateChecker = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkForUpdates = async () => {
    try {
      setChecking(true);
      // Add timestamp to bypass cache
      const response = await fetch(`/version.json?t=${Date.now()}`);
      const serverVersion = await response.json();
      
      // Get stored version
      const storedVersion = localStorage.getItem('app-version');
      
      if (storedVersion && storedVersion !== serverVersion.buildTime) {
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
    // Check on mount
    checkForUpdates();
    
    // Check every 30 seconds
    const interval = setInterval(checkForUpdates, 30000);
    
    // Check when app becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
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
      // Show feedback
      window.Telegram.WebApp.showAlert('Update available! The app will reload now.', () => {
        // Force reload with cache bypass
        window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
      });
    } else {
      // Regular browser reload
      window.location.reload(true);
    }
  };

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-green-700 text-white p-2 text-center animate-pulse">
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
      </div>
    </div>
  );
};

export default UpdateChecker;
