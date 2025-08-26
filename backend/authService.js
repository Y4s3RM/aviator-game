// 🔐 Authentication Service - JWT token management and middleware
// Handles token generation, validation, and authentication middleware

const jwt = require('jsonwebtoken');
const databaseService = require('./services/databaseService');

class AuthService {
  constructor() {
    // Require JWT secret in production
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    
    this.jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'dev-only-secret' : null);
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshTokenExpiresIn = '30d';
    
    // Store active sessions with TTL (in production, use Redis)
    this.activeSessions = new Map();
    this.sessionTTL = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Fred's Fix: Generate JWT token with stable sub claim and relaxed session policy
  generateToken(user) {
    try {
      const payload = {
        sub: String(user.id),             // Fred's canonical ID claim
        userId: String(user.id),          // legacy compatibility
        username: user.username || null,
        email: user.email || null,
        role: user.role || 'PLAYER',
        telegramId: user.telegramId || null,
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      // Fred's Fix: Track sessions by token (not userId) to allow multiple valid tokens
      this.activeSessions.set(token, {
        token,
        userId: String(user.id),
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.sessionTTL).toISOString()
      });

      this.cleanupExpiredSessions();
      console.log(`🎫 Generated token for user: ${user.username}`);
      return { success: true, token };
    } catch (e) {
      console.error('❌ Error generating token:', e);
      return { success: false, error: 'Failed to generate token' };
    }
  }

  // Generate refresh token
  generateRefreshToken(user) {
    try {
      const payload = {
        userId: user.id,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      };

      const refreshToken = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.refreshTokenExpiresIn,
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      return { success: true, refreshToken };
    } catch (error) {
      console.error('❌ Error generating refresh token:', error);
      return { success: false, error: 'Failed to generate refresh token' };
    }
  }

  // Fred's Fix: Verify JWT token with relaxed session policy
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      // Fred's Fix: Optional activity tracking; do NOT force-match token to user session
      const session = this.activeSessions.get(token);
      if (session) session.lastActivity = new Date().toISOString();

      return { success: true, decoded };
    } catch (error) {
      if (error.name === 'TokenExpiredError') return { success: false, error: 'Token expired' };
      if (error.name === 'JsonWebTokenError') return { success: false, error: 'Invalid token' };
      console.error('❌ Error verifying token:', error);
      return { success: false, error: 'Token verification failed' };
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      
      if (decoded.type !== 'refresh') {
        return { success: false, error: 'Invalid refresh token' };
      }

      const user = await databaseService.findUserById(decoded.userId);
      if (!user || !user.isActive) {
        return { success: false, error: 'User not found or inactive' };
      }

      return this.generateToken(user);
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      return { success: false, error: 'Failed to refresh token' };
    }
  }

  // Fred's Fix: Logout token (invalidate specific session)
  logout(token) {
    try {
      const session = this.activeSessions.get(token);
      if (session) {
        this.activeSessions.delete(token);
        console.log(`👋 Token logged out for user: ${session.userId}`);
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Error logging out token:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  // Fred's Fix: Logout all sessions for user (by userId)
  logoutAllSessions(userId) {
    try {
      let loggedOutCount = 0;
      for (const [token, session] of this.activeSessions.entries()) {
        if (session.userId === userId) {
          this.activeSessions.delete(token);
          loggedOutCount++;
        }
      }
      console.log(`👋 Logged out ${loggedOutCount} sessions for user: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error logging out all sessions:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  // Authentication middleware
  async authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const verification = this.verifyToken(token);
    if (!verification.success) {
      return res.status(403).json({ error: verification.error });
    }

    // Get fresh user data
    const user = await databaseService.findUserById(verification.decoded.userId);
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  }

  // Optional authentication middleware (doesn't fail if no token)
  async optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const verification = this.verifyToken(token);
      if (verification.success) {
        const user = await databaseService.findUserById(verification.decoded.userId);
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }

    next();
  }

  // Role-based authorization middleware
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
      const requiredRoles = Array.isArray(roles) ? roles : [roles];

      const hasRole = requiredRoles.some(role => userRoles.includes(role));
      if (!hasRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  // Get active sessions count
  getActiveSessionsCount() {
    return this.activeSessions.size;
  }

  // Fred's Fix: Clean up expired sessions (token-based keys)
  cleanupExpiredSessions() {
    const now = new Date().toISOString();
    let cleanedCount = 0;

    for (const [token, session] of this.activeSessions.entries()) {
      if (session.expiresAt && new Date(session.expiresAt) < new Date(now)) {
        this.activeSessions.delete(token);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
    
    // Limit map size to prevent unbounded growth
    const maxSessions = 10000;
    if (this.activeSessions.size > maxSessions) {
      // Remove oldest sessions
      const sortedSessions = Array.from(this.activeSessions.entries())
        .sort((a, b) => new Date(a[1].createdAt) - new Date(b[1].createdAt));
      
      const toRemove = sortedSessions.slice(0, this.activeSessions.size - maxSessions);
      toRemove.forEach(([userId]) => this.activeSessions.delete(userId));
      
      console.log(`🧹 Removed ${toRemove.length} oldest sessions to maintain size limit`);
    }
  }

  // Get session info
  getSessionInfo(userId) {
    return this.activeSessions.get(userId);
  }
}

// Create singleton instance
const authService = new AuthService();

// Clean up expired sessions every hour
setInterval(() => {
  authService.cleanupExpiredSessions();
}, 60 * 60 * 1000);

module.exports = authService;
