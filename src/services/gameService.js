// 🎮 Game Service - Connects React frontend to our backend
// This replaces the local game state with real backend communication

const BACKEND_URL = 'http://localhost:3002';

class GameService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Connect to backend WebSocket
  connect() {
    console.log('🔌 Connecting to game backend...');
    
    try {
      this.ws = new WebSocket(`ws://localhost:3002`);
      
      this.ws.onopen = () => {
        console.log('✅ Connected to game backend!');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notifyListeners({ type: 'connected' });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received:', message);
          this.notifyListeners(message);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('🔌 Connection closed');
        this.isConnected = false;
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      this.attemptReconnect();
    }
  }

  // Reconnect logic
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 2000);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  // Send message to backend
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log('📤 Sent:', message);
    } else {
      console.error('❌ WebSocket not connected');
    }
  }

  // Place a bet
  placeBet(amount) {
    this.send({
      type: 'bet',
      amount: amount
    });
  }

  // Cash out
  cashOut() {
    this.send({
      type: 'cashOut'
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
    this.listeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('❌ Error in listener:', error);
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
    }
  }
}

// Create singleton instance
const gameService = new GameService();

export default gameService;
