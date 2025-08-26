// 🎮 Game Service - Connects React frontend to our backend
// This replaces the local game state with real backend communication

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://aviator-game-production.up.railway.app';

// Import auth service for token management
import authService from './authService.js';

class GameService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.playerId = null; // Store player ID
    
    // Fred's Fix: Reconnect WS after token refresh
    if (typeof window !== 'undefined') {
      window.addEventListener('authStateChanged', () => {
        console.log('🔄 Auth state changed, reconnecting WebSocket...');
        this.reconnect();
      });
    }
  }

  // Connect to backend WebSocket  
  connect() {
    // Prevent multiple connections
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 Already connected, skipping new connection');
      return;
    }
    
    console.log('🔌 Connecting to game backend...');
    
    // Fred's Fix: Get auth token for authenticated connection
    const token = authService.getToken();
    const baseWsUrl = import.meta.env.VITE_API_BASE_URL?.replace('https://', 'wss://').replace('/api', '') || 'wss://aviator-game-production.up.railway.app';
    const wsPath = '/ws';  // WebSocket path
    
    // Fred's belt-and-suspenders: both query param AND subprotocol
    const wsUrl = token ? `${baseWsUrl}${wsPath}?token=${encodeURIComponent(token)}` : `${baseWsUrl}${wsPath}`;
    const protocols = token ? [`bearer.${token}`] : [];
    
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
      console.log('🔌 WebSocket URL:', wsUrl.replace(/token=[^&]*/, 'token=***'));
      console.log('🎯 Auth token:', token ? 'Present' : 'Missing');  
      console.log('📡 Protocols:', protocols.length > 0 ? ['bearer.***'] : 'None');
    }
    
    try {
      // Fred's approach: send token via both query param and subprotocol
      this.ws = new WebSocket(wsUrl, protocols);
      
      this.ws.onopen = () => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.log('✅ Connected to game backend!');
          console.log('✅ WebSocket URL:', this.ws.url);
          console.log('✅ WebSocket readyState:', this.ws.readyState);
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Try to restore previous player ID from localStorage
        const savedPlayerId = localStorage.getItem('aviator_player_id');
        if (savedPlayerId) {
          this.playerId = savedPlayerId;
          console.log('🔄 Restored player ID:', this.playerId);
        }
        
        this.notifyListeners({ type: 'connected' });
      };
      
      this.ws.onmessage = (event) => {
        try {
          if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
            console.log('📨 Raw message received:', event.data);
          }
          const message = JSON.parse(event.data);
          if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
            console.log('📨 Parsed message:', message);
          }
          
          // Fred's Stale Token Handler - proactive authentication recovery
          if (message?.type === 'auth_error' && message?.data?.reason === 'STALE_TOKEN') {
            console.log('🧹 Server detected stale token, triggering re-authentication...');
            // Hard path: nuke and re-auth via Telegram
            try {
              authService.clearTokens();
              // Tell the app to reauth:
              window.dispatchEvent(new Event('auth:stale'));
            } catch (error) {
              console.error('❌ Error handling stale token:', error);
            }
            return; // Don't process this message further
          }
          
          // Save player/user ID when we receive it from backend
          if (message.type === 'connected' && message.data?.userId) {
            this.playerId = message.data.userId;
            if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
              console.log('💾 Connected as:', message.data.isGuest ? 'Guest' : 'Authenticated User');
              console.log('💾 User ID:', this.playerId);
            }
          }
          
          this.notifyListeners(message);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
          console.error('❌ Raw message that failed:', event.data);
        }
      };
      
      this.ws.onclose = () => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.log('🔌 Connection closed');
        }
        this.isConnected = false;
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
          console.error('❌ WebSocket error:', error);
          console.error('❌ WebSocket readyState:', this.ws.readyState);
          console.error('❌ WebSocket URL:', this.ws.url);
          console.error('❌ Error details:', {
            type: error.type,
            target: error.target,
            isTrusted: error.isTrusted
          });
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      this.attemptReconnect();
    }
  }

  // Reconnect logic with backoff - now safe since server preserves player IDs by path
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('🔄 Max reconnection attempts reached. Please refresh the page.');
      return;
    }
    
    this.reconnectAttempts++;
    const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000); // Exponential backoff, max 10s
    console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffDelay}ms`);
    
    setTimeout(() => {
      console.log('🔄 Attempting reconnection now...');
      this.connect();
    }, backoffDelay);
  }

  // Send message to backend
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
        console.log('📤 Sent:', message);
      }
    } else {
      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true') {
        console.error('❌ WebSocket not connected');
      }
    }
  }

  // Place a bet
  placeBet(amount) {
    console.log('💰 [GameService] Placing bet:', amount, 'pts for player:', this.playerId);
    this.send({
      type: 'bet',
      amount: amount,
      playerId: this.playerId // Include player ID
    });
  }

  // Cash out
  cashOut() {
    console.log('💸 [GameService] Attempting cash out for player:', this.playerId);
    this.send({
      type: 'cashOut',
      playerId: this.playerId // Include player ID
    });
  }

  // Add event listener
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove event listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners(message) {
    console.log('🔔 Notifying listeners, count:', this.listeners.size);
    this.listeners.forEach((callback, index) => {
      try {
        console.log(`🔔 Calling listener ${index}:`, callback);
        callback(message);
        console.log(`✅ Listener ${index} executed successfully`);
      } catch (error) {
        console.error(`❌ Error in listener ${index}:`, error);
        console.error(`❌ Listener function:`, callback);
      }
    });
  }

  // Get current game state from REST API (fallback)
  async getGameState() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/game-state`);
      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get game state:', error);
      return null;
    }
  }

  // Check backend health
  async checkHealth() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      return await response.json();
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      return null;
    }
  }

  // Disconnect
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.isConnected = false;
    }
  }
  
  // Fred's Fix: Reconnect with fresh token
  reconnect() {
    console.log('🔄 Reconnecting WebSocket with fresh token...');
    try {
      this.disconnect();
    } catch (e) {
      console.warn('Disconnect error during reconnect:', e);
    }
    // Small delay to ensure clean disconnect
    setTimeout(() => this.connect(), 100);
  }
}

// Create singleton instance
const gameService = new GameService();

export default gameService;
