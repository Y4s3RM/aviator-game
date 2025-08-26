// authService.js
class AuthService {
  constructor() {
    this.baseURL = import.meta.env?.VITE_API_BASE_URL || 'https://aviator-game-production.up.railway.app/api';
    this.token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    this.refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    this.user = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
  }

  async authenticateWithTelegram(telegramUser, startParam = null) {
    try {
      // Create device ID for referral tracking
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('device_id', deviceId);
      }

      console.log(`🌐 Sending request to: ${this.baseURL}/auth/telegram`);
      console.log('🌐 Request payload:', JSON.stringify({ telegramUser, startParam }, null, 2));
      
      const res = await fetch(`${this.baseURL}/auth/telegram`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId
        },
        body: JSON.stringify({ telegramUser, startParam })
      });
      
      console.log(`🌐 Backend response: HTTP ${res.status} ${res.statusText}`);
      const data = await this.safeJson(res);
      console.log('🌐 Backend data:', data);
      
      if (res.ok && data?.success) {
        this.applySession(data.token, data.refreshToken, data.user);
        window.dispatchEvent(new Event('authStateChanged'));
        return { success: true, user: this.user, referralMessage: data.referralMessage };
      }
      return { success: false, error: data?.error || `HTTP ${res.status}`, status: res.status, data };
    } catch (e) {
      console.error('🚨 Network error details:', e);
      console.error('🚨 Error name:', e.name);
      console.error('🚨 Error message:', e.message);
      return { success: false, error: 'Network error', details: e.message };
    }
  }

  async adminLogin(usernameOrEmail, password) {
    try {
      const res = await fetch(`${this.baseURL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password })
      });
      const data = await this.safeJson(res);
      if (res.ok && data?.success) {
        this.applySession(data.token, data.refreshToken, data.user);
        window.dispatchEvent(new Event('authStateChanged'));
        return { success: true, user: this.user };
      }
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  async adminRegister(username, email, password, adminKey) {
    try {
      const res = await fetch(`${this.baseURL}/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ username, email, password })
      });
      const data = await this.safeJson(res);
      if (res.ok && data?.success) {
        this.applySession(data.token, data.refreshToken, data.user);
        window.dispatchEvent(new Event('authStateChanged'));
        return { success: true, user: this.user };
      }
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  async logout() {
    try {
      if (this.token) {
        await fetch(`${this.baseURL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.token}`, 'Content-Type': 'application/json' }
        });
      }
    } catch {}
    finally {
      this.clearSession();
      window.dispatchEvent(new Event('authStateChanged'));
    }
  }

  async refreshAccessToken() {
    if (!this.refreshToken) return { success: false, error: 'No refresh token' };
    try {
      const res = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });
      const data = await this.safeJson(res);
      if (res.ok && data?.success && data?.token) {
        this.token = data.token;
        if (typeof localStorage !== 'undefined') localStorage.setItem('auth_token', this.token);
        window.dispatchEvent(new Event('authStateChanged'));
        return { success: true, token: this.token };
      }
      await this.logout();
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    } catch {
      await this.logout();
      return { success: false, error: 'Network error' };
    }
  }

  // Fred's graceful token validation with automatic refresh
  async validateCurrentToken() {
    if (!this.token) return { valid: false, reason: 'No token' };
    
    try {
      // Try to get current user profile to validate token
      const res = await fetch(`${this.baseURL}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      
      if (res.ok) return { valid: true, reason: 'Token valid' };
      
      if (res.status === 404 || (res.status === 401 && res.statusText.includes('User not found'))) {
        console.log('🧹 Stale JWT detected - user no longer exists, clearing token');
        await this.logout();
        return { valid: false, reason: 'User not found - stale token cleared' };
      }
      
      // Fred's graceful refresh chain for expired tokens
      if (res.status === 401 || res.status === 403) {
        const rt = this.refreshToken;
        if (!rt) return { valid: false, reason: 'Token expired, no refresh token' };
        
        console.log('🔄 Token expired, attempting refresh...');
        const refreshResult = await this.refreshAccessToken();
        if (!refreshResult.success) {
          console.log('❌ Token refresh failed, clearing session');
          await this.logout();
          return { valid: false, reason: 'Token refresh failed' };
        }
        
        console.log('✅ Token refreshed successfully');
        window.dispatchEvent(new Event('authStateChanged'));
        return { valid: true, refreshed: true, reason: 'Token refreshed' };
      }
      
      return { valid: false, reason: `HTTP ${res.status}` };
    } catch (error) {
      return { valid: false, reason: 'Network error' };
    }
  }

  // Get current auth token
  getToken() {
    return this.token;
  }

  isAuthenticated() {
    return !!this.token && !!this.user;
  }
  isAdmin() {
    return this.isAuthenticated() && this.user?.role === 'ADMIN';
  }
  isTelegramUser() {
    return this.isAuthenticated() && !!this.user?.telegramId;
  }
  getUser() { return this.user; }
  getToken() { return this.token; }
  getAuthToken() { return this.token; }

  async apiRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const doFetch = async () => {
      const res = await fetch(url, { ...options, headers });
      return res;
    };

    let res = await doFetch();

    if (res.status === 401 && this.refreshToken) {
      const refresh = await this.refreshAccessToken();
      if (refresh.success) {
        headers['Authorization'] = `Bearer ${this.token}`;
        res = await doFetch();
      }
    }

    const data = await this.safeJson(res);

    if (!res.ok) {
      const err = new Error(data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.details = data;
      throw err;
    }

    return data;
  }

  async getAdminStats() {
    return await this.apiRequest('/admin/stats');
  }
  async getUsers(page = 1, limit = 50, search = '') {
    const params = new URLSearchParams({ page, limit, search });
    return await this.apiRequest(`/admin/users?${params.toString()}`);
  }
  async updateUser(userId, updateData) {
    return await this.apiRequest(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(updateData) });
  }
  async getGameRounds(page = 1, limit = 50) {
    const params = new URLSearchParams({ page, limit });
    return await this.apiRequest(`/admin/game-rounds?${params.toString()}`);
  }

  async getFarmingStatus() {
    try {
      return await this.apiRequest('/farming/status', { method: 'GET' });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async claimFarmingPoints() {
    try {
      const result = await this.apiRequest('/farming/claim', { method: 'POST' });
      if (result?.success && typeof result.newBalance === 'number') {
        const u = this.getUser();
        if (u) {
          u.balance = result.newBalance;
          this.saveUser(u);
        }
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLeaderboard(type = 'balance', limit = 10) {
    const params = new URLSearchParams({ type, limit });
    return await this.apiRequest(`/leaderboard?${params.toString()}`);
  }

  async getReferralStats() {
    try {
      return await this.apiRequest('/referrals/stats');
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPlayerSettings() {
    return await this.apiRequest('/player/settings');
  }

  async updatePlayerSettings(partial) {
    return await this.apiRequest('/player/settings', {
      method: 'PUT',
      body: JSON.stringify(partial)
    });
  }

  applySession(token, refreshToken, user) {
    this.token = token || null;
    this.refreshToken = refreshToken || this.refreshToken || null;
    this.user = user || null;
    if (typeof localStorage !== 'undefined') {
      if (this.token) localStorage.setItem('auth_token', this.token); else localStorage.removeItem('auth_token');
      if (this.refreshToken) localStorage.setItem('refresh_token', this.refreshToken); else localStorage.removeItem('refresh_token');
      if (this.user) localStorage.setItem('user', JSON.stringify(this.user)); else localStorage.removeItem('user');
    }
  }

  clearSession() {
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  }

  // Fred's API compatibility - alias for clearSession
  clearTokens() {
    this.clearSession();
  }

  saveUser(user) {
    this.user = user;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
    }
  }

  async changePassword(oldPassword, newPassword) {
    try {
      const result = await this.apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword })
      });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async safeJson(response) {
    const text = await response.text().catch(() => '');
    if (!text) return null;
    try { return JSON.parse(text); } catch { return { error: text }; }
  }
}

export default new AuthService();