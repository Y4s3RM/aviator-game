const authService = require('../authService');
const ipRangeCheck = require('ip-range-check');

// Get admin IP ranges from environment
const ADMIN_IP_RANGES = (process.env.ADMIN_IP_RANGES || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const REQUIRE_ADMIN_2FA = process.env.REQUIRE_ADMIN_2FA === 'true';

/**
 * Middleware to require admin authentication and authorization
 */
const requireAdmin = async (req, res, next) => {
  try {
    // First authenticate the token
    const authResult = await new Promise((resolve) => {
      authService.authenticateToken(req, res, () => resolve({ success: true }));
    });

    if (!authResult.success) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user exists and has admin role
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check if user account is active
    if (req.user.isActive === false) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // IP allowlist check (if configured)
    if (ADMIN_IP_RANGES.length > 0) {
      const clientIp = req.ip || req.connection.remoteAddress;
      const isAllowed = ipRangeCheck(clientIp, ADMIN_IP_RANGES);
      
      if (!isAllowed) {
        console.warn(`⚠️ Admin access denied from IP: ${clientIp} for user: ${req.user.username}`);
        return res.status(403).json({ error: 'Admin access not allowed from this IP' });
      }
    }

    // 2FA check (if enabled)
    if (REQUIRE_ADMIN_2FA) {
      const otpHeader = req.headers['x-admin-otp'];
      if (!otpHeader) {
        return res.status(403).json({ error: '2FA required', requiresOTP: true });
      }
      
      // TODO: Implement actual 2FA verification
      // const isValidOTP = await authService.verify2FA(req.user.id, otpHeader);
      // if (!isValidOTP) {
      //   return res.status(403).json({ error: 'Invalid 2FA code' });
      // }
    }

    // Add admin info to request for audit logging
    req.admin = {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Middleware to require specific permissions (for future use)
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    // For now, just check if admin
    if (!req.admin) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // TODO: Implement granular permissions
    // const hasPermission = await authService.checkPermission(req.user.id, permission);
    // if (!hasPermission) {
    //   return res.status(403).json({ error: `Permission required: ${permission}` });
    // }

    next();
  };
};

module.exports = {
  requireAdmin,
  requirePermission
};
