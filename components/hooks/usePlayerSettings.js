import { useEffect, useRef, useState, useCallback } from 'react';
import authService from '../../components/services/authService';

export function usePlayerSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const backoffRef = useRef(5000); // 5s start
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchSettings = useCallback(async () => {
    const token = authService.getToken();
    if (!token || !mountedRef.current) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/player/settings`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 429) {
        // Rate limited - exponential backoff
        clearTimeout(timerRef.current);
        backoffRef.current = Math.min(backoffRef.current * 2, 60000); // max 60s
        console.log(`⏰ Rate limited, retrying in ${backoffRef.current / 1000}s`);
        timerRef.current = setTimeout(fetchSettings, backoffRef.current);
        return;
      }
      
      // Reset backoff on successful request
      backoffRef.current = 10000; // 10s for normal refresh
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const json = await response.json();
      if (json?.settings && mountedRef.current) {
        setSettings(json.settings);
      }
    } catch (error) {
      console.error('❌ Failed to fetch settings:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const saveSettings = useCallback(async (patch) => {
    const token = authService.getToken();
    if (!token) return { success: false, error: 'Not authenticated' };
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/player/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patch)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const json = await response.json();
      if (json?.settings && mountedRef.current) {
        setSettings(json.settings);
        console.log('✅ Settings saved successfully');
      }
      return { success: true, settings: json?.settings };
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      return { success: false, error: error.message };
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch
    fetchSettings();
    
    // Fetch on visibility change (tab becomes active)
    const handleVisibilityChange = () => {
      if (!document.hidden && mountedRef.current) {
        console.log('👁️ Tab became visible, refreshing settings');
        fetchSettings();
      }
    };
    
    // Listen for auth state changes
    const handleAuthChange = (event) => {
      if (event.detail?.isAuthenticated && mountedRef.current) {
        console.log('🔐 Auth state changed, refreshing settings');
        fetchSettings();
      } else if (!event.detail?.isAuthenticated && mountedRef.current) {
        // Clear settings when logged out
        setSettings(null);
      }
    };
    
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('authStateChanged', handleAuthChange);
    
    // Set up gentle background refresh (every 30s when active)
    const refreshInterval = setInterval(() => {
      if (!document.hidden && mountedRef.current) {
        fetchSettings();
      }
    }, 30000);
    
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      clearInterval(refreshInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('authStateChanged', handleAuthChange);
    };
  }, [fetchSettings]);

  return { 
    settings, 
    loading, 
    fetchSettings, 
    saveSettings,
    // Convenience getters
    autoCashoutEnabled: settings?.autoCashoutEnabled ?? false,
    autoCashoutMultiplier: settings?.autoCashoutMultiplier ?? 2.0,
    soundEnabled: settings?.soundEnabled ?? true,
    dailyLimitsEnabled: settings?.dailyLimitsEnabled ?? false,
    maxDailyWager: settings?.maxDailyWager ?? 10000,
    maxDailyLoss: settings?.maxDailyLoss ?? 5000,
    maxGamesPerDay: settings?.maxGamesPerDay ?? 100
  };
}
