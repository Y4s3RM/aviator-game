# Admin System Deployment Guide

## Overview

The Aviator Game admin system provides comprehensive management capabilities for administrators, including user management, game statistics, referral tracking, and audit logging.

## Pre-Deployment Checklist

### Backend Requirements

- [ ] PostgreSQL database deployed and accessible
- [ ] Environment variables configured (see below)
- [ ] Backend API deployed (Railway recommended)
- [ ] Admin user created in database

### Frontend Requirements

- [ ] Frontend deployed with admin components
- [ ] CORS configured to allow admin dashboard access
- [ ] Environment variables set for API endpoint

## Environment Variables

### Required Backend Variables

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT Configuration
JWT_SECRET="strong-random-secret-for-production"
JWT_REFRESH_SECRET="another-strong-random-secret"

# Server
PORT=3002
NODE_ENV="production"

# CORS (include your frontend URLs)
CORS_ORIGINS="https://your-frontend-domain.com,https://admin.your-domain.com"

# Admin Security
ADMIN_REGISTRATION_KEY="secret-key-for-creating-admin-accounts"
```

### Optional Security Variables

```env
# IP Restriction (recommended for production)
ADMIN_IP_RANGES="your.office.ip.range/24,vpn.ip.range/16"

# Two-Factor Authentication
REQUIRE_ADMIN_2FA="true"  # When ready to implement
```

### Frontend Variables

```env
# API Endpoint
VITE_API_URL="https://your-backend-api.railway.app"
VITE_WS_URL="wss://your-backend-api.railway.app"
```

## Deployment Steps

### 1. Deploy Backend (Railway)

1. Push your code to GitHub
2. Connect Railway to your repository
3. Add environment variables in Railway dashboard
4. Deploy the backend service

### 2. Create Admin User

SSH into your backend or use a database client:

```sql
-- Check if admin user exists
SELECT username, role FROM users WHERE username = 'admin';

-- If needed, update role to ADMIN
UPDATE users SET role = 'ADMIN' WHERE username = 'admin';
```

Or use the provided script:
```bash
cd backend
node scripts/create-admin.js
```

### 3. Deploy Frontend (Vercel)

1. Push code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

### 4. Configure Security

#### IP Restrictions (Recommended)

1. Determine allowed IP ranges:
   - Office network
   - VPN endpoints
   - Admin home IPs (static)

2. Set in environment:
   ```
   ADMIN_IP_RANGES="203.0.113.0/24,198.51.100.0/24"
   ```

#### Enable HTTPS (Required)

Both Railway and Vercel provide HTTPS by default. Ensure all URLs use HTTPS.

## Post-Deployment Verification

### 1. Test Admin Login

1. Navigate to `https://your-app.com?admin=1`
2. Login with admin credentials
3. Verify dashboard loads

### 2. Verify All Admin Features

- [ ] Dashboard stats load correctly
- [ ] User list displays with pagination
- [ ] User details and balance adjustment work
- [ ] Game rounds show with crash points
- [ ] Referral system displays data
- [ ] Audit logs track admin actions

### 3. Security Audit

- [ ] Non-admin users cannot access admin routes
- [ ] JWT tokens expire appropriately
- [ ] IP restrictions work (if enabled)
- [ ] All admin actions are logged

## Admin Features Overview

### Dashboard
- Real-time statistics
- User activity metrics
- Economic overview
- WebSocket connection status

### User Management
- View all users with search
- Edit user details
- Adjust balances with reasons
- View user bet history
- Suspend/activate accounts

### Game Rounds
- View all game history
- Crash point analytics
- Bet details per round
- Provably fair verification

### Referral System
- Track referral chains
- Monitor conversion rates
- Approve/reject referrals
- View referral rewards

### Audit Log
- Track all admin actions
- Filter by admin user
- Search by action type
- Export capabilities

## Troubleshooting

### Admin Login Issues

1. **403 Forbidden**
   - Check IP restrictions if enabled
   - Verify user has ADMIN role
   - Check CORS configuration

2. **Stats Not Loading**
   - Verify database connection
   - Check for console errors
   - Ensure backend is running

### Performance Issues

1. **Slow Dashboard**
   - Add database indexes for common queries
   - Implement caching for stats
   - Use pagination for large datasets

2. **WebSocket Issues**
   - Verify WSS URL is correct
   - Check firewall/proxy settings
   - Ensure sticky sessions if load balanced

## Security Best Practices

1. **Regular Updates**
   - Keep dependencies updated
   - Monitor security advisories
   - Regular security audits

2. **Access Control**
   - Use strong admin passwords
   - Rotate JWT secrets regularly
   - Monitor audit logs

3. **Data Protection**
   - Encrypt sensitive data
   - Regular backups
   - GDPR compliance if applicable

## Monitoring

### Recommended Tools

1. **Application Monitoring**
   - Railway metrics
   - Vercel analytics
   - Custom dashboards

2. **Error Tracking**
   - Sentry or similar
   - Log aggregation
   - Alert configuration

3. **Security Monitoring**
   - Failed login attempts
   - Unusual admin activity
   - API rate limit violations

## Support

For deployment issues:
1. Check deployment logs
2. Verify environment variables
3. Test with minimal configuration first
4. Contact support with specific error messages

---

Last updated: August 2024
