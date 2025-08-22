// 🔐 Authentication Service - Handles Telegram authentication for players
// and admin authentication for dashboard access

class AuthService {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'https://aviator-game-production.up.railway.app/api';
    this.token = localStorage.getItem('auth_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  // =============================================================================
  // TELEGRAM AUTHENTICATION (for players)
  // =============================================================================

  async authenticateWithTelegram(telegramUser) {
    try {
      const response = await fetch(`${this.baseURL}/auth/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telegramUser })
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        this.refreshToken = data.refreshToken;
        this.user = data.user;

        // Store in localStorage
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('refresh_token', this.refreshToken);
        localStorage.setItem('user', JSON.stringify(this.user));

        console.log('🔐 Telegram authentication successful:', this.user.username);
        return { success: true, user: this.user };
      } else {
        console.error('❌ Telegram authentication failed:', data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('❌ Telegram authentication error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // =============================================================================
  // ADMIN AUTHENTICATION (for dashboard)
  // =============================================================================

  async adminLogin(usernameOrEmail, password) {
    try {
      const response = await fetch(`${this.baseURL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usernameOrEmail, password })
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        this.refreshToken = data.refreshToken;
        this.user = data.user;

        // Store in localStorage
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('refresh_token', this.refreshToken);
        localStorage.setItem('user', JSON.stringify(this.user));

        console.log('🔐 Admin login successful:', this.user.username);
        return { success: true, user: this.user };
      } else {
        console.error('❌ Admin login failed:', data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('❌ Admin login error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async adminRegister(username, email, password, adminKey) {
    try {
      const response = await fetch(`${this.baseURL}/admin/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        this.refreshToken = data.refreshToken;
        this.user = data.user;

        // Store in localStorage
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('refresh_token', this.refreshToken);
        localStorage.setItem('user', JSON.stringify(this.user));

        console.log('🔐 Admin registration successful:', this.user.username);
        return { success: true, user: this.user };
      } else {
        console.error('❌ Admin registration failed:', data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('❌ Admin registration error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // =============================================================================
  // COMMON AUTHENTICATION METHODS
  // =============================================================================

  async logout() {
    try {
      if (this.token) {
        await fetch(`${this.baseURL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          }
        });
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
    } finally {
      // Clear local storage regardless of API call success
      this.token = null;
      this.refreshToken = null;
      this.user = null;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      console.log('👋 Logged out successfully');
    }
  }

  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        return { success: false, error: 'No refresh token' };
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        localStorage.setItem('auth_token', this.token);
        return { success: true, token: this.token };
      } else {
        // Refresh token is invalid, logout
        await this.logout();
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      await this.logout();
      return { success: false, error: 'Network error' };
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  isAdmin() {
    return this.isAuthenticated() && this.user.role === 'ADMIN';
  }

  isTelegramUser() {
    return this.isAuthenticated() && !!this.user.telegramId;
  }

  getUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }

  // Alias for getToken (for backward compatibility)
  getAuthToken() {
    return this.token;
  }

  // Make authenticated API requests
  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && this.refreshToken) {
        const refreshResult = await this.refreshAccessToken();
        if (refreshResult.success) {
          // Retry the original request with new token
          headers['Authorization'] = `Bearer ${this.token}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers
          });
          return await retryResponse.json();
        }
      }

      return await response.json();
    } catch (error) {
      console.error('❌ API request error:', error);
      throw error;
    }
  }

  // =============================================================================
  // ADMIN API METHODS
  // =============================================================================

  async getAdminStats() {
    return await this.apiRequest('/admin/stats');
  }

  async getUsers(page = 1, limit = 50, search = '') {
    const params = new URLSearchParams({ page, limit, search });
    return await this.apiRequest(`/admin/users?${params}`);
  }

  async updateUser(userId, updateData) {
    return await this.apiRequest(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
  }

  async getGameRounds(page = 1, limit = 50) {
    const params = new URLSearchParams({ page, limit });
    return await this.apiRequest(`/admin/game-rounds?${params}`);
  }

  // =============================================================================
  // PUBLIC API METHODS
  // =============================================================================

  async getLeaderboard(type = 'balance', limit = 10) {
    const params = new URLSearchParams({ type, limit });
    return await this.apiRequest(`/leaderboard?${params}`);
  }

  // Player settings
  async getPlayerSettings() {
    return await this.apiRequest('/player/settings');
  }

  async updatePlayerSettings(partial) {
    return await this.apiRequest('/player/settings', {
      method: 'PUT',
      body: JSON.stringify(partial)
    });
  }
}

// Export singleton instance
export default new AuthService();