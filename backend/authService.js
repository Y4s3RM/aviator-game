// 🔐 Authentication Service - JWT token management and middleware
// Handles token generation, validation, and authentication middleware

const jwt = require('jsonwebtoken');
const databaseService = require('./services/databaseService');

class AuthService {
  constructor() {
    // In production, use environment variables for secrets
    this.jwtSecret = process.env.JWT_SECRET || 'aviator-game-super-secret-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshTokenExpiresIn = '30d';
    
    // Store active sessions (in production, use Redis)
    this.activeSessions = new Map();
  }

  // Generate JWT token
  generateToken(user) {
    try {
      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      // Store session
      this.activeSessions.set(user.id, {
        token,
        userId: user.id,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });

      console.log(`🎫 Generated token for user: ${user.username}`);
      return { success: true, token };
    } catch (error) {
      console.error('❌ Error generating token:', error);
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

  // Verify JWT token
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'aviator-game',
        audience: 'aviator-players'
      });

      // Check if session is still active
      const session = this.activeSessions.get(decoded.userId);
      if (!session || session.token !== token) {
        return { success: false, error: 'Session expired or invalid' };
      }

      // Update last activity
      session.lastActivity = new Date().toISOString();

      return { success: true, decoded };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: 'Token expired' };
      } else if (error.name === 'JsonWebTokenError') {
        return { success: false, error: 'Invalid token' };
      } else {
        console.error('❌ Error verifying token:', error);
        return { success: false, error: 'Token verification failed' };
      }
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

  // Logout user (invalidate session)
  logout(userId) {
    try {
      this.activeSessions.delete(userId);
      console.log(`👋 User logged out: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error logging out user:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  // Logout all sessions for user
  logoutAllSessions(userId) {
    try {
      // In a real implementation, you'd invalidate all tokens for this user
      this.activeSessions.delete(userId);
      console.log(`👋 All sessions logged out for user: ${userId}`);
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

  // Clean up expired sessions (call periodically)
  cleanupExpiredSessions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [userId, session] of this.activeSessions.entries()) {
      const sessionAge = now - new Date(session.lastActivity).getTime();
      if (sessionAge > maxAge) {
        this.activeSessions.delete(userId);
        console.log(`🧹 Cleaned up expired session for user: ${userId}`);
      }
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
