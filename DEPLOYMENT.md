# Deployment Guide

## Environment Configuration

### For Testing (Vercel + Telegram Bot)

1. **In Vercel Dashboard:**
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add these variables:
   ```
   VITE_ENABLE_AUTO_UPDATE = true
   ```

2. **Auto-Update Behavior:**
   - Enabled on: `aviator-game-*.vercel.app`
   - Disabled on: `localhost` and production domains
   - Checks every 2 minutes for updates
   - Shows update banner when new version is available

### For Production

1. **In Vercel Dashboard:**
   - Set for production deployment:
   ```
   VITE_ENABLE_AUTO_UPDATE = false
   ```

2. **Custom Domain:**
   - When you add a custom domain (e.g., `aviator.yourdomain.com`)
   - Auto-updates will be disabled automatically

## Current Setup Detection

The UpdateChecker uses this logic:
```javascript
// Auto-updates enabled if:
// 1. Environment variable is set to 'true', OR
// 2. URL contains 'aviator-game' AND 'vercel.app'
```

## Verifying Your Setup

1. Open browser console on your deployed app
2. Run: `console.log(import.meta.env.VITE_ENABLE_AUTO_UPDATE)`
3. Should show `true` for test, `false` or `undefined` for production

## Quick Toggle

To quickly enable/disable auto-updates without code changes:
1. Go to Vercel dashboard
2. Change `VITE_ENABLE_AUTO_UPDATE` variable
3. Redeploy (or trigger new deployment)
