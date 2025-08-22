// 🚀 Aviator Game Backend (SECURE AUTHENTICATED VERSION)

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Import our database services
const databaseService = require('./services/databaseService');
const provablyFairService = require('./services/provablyFairService');
const authService = require('./authService');

// Import error handling middleware
const { AppError, asyncHandler, errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Security middleware
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
  // Enable CSP in production for API responses (minimal, API-safe)
  contentSecurityPolicy: isProduction ? {
    useDefaults: true,
    directives: {
      // API returns JSON; block everything by default
      defaultSrc: ["'none'"],
      // Allow API consumers to call us
      connectSrc: ["'self'", "*"] ,
      // Disallow framing except Telegram (documented hostnames)
      frameAncestors: ["'self'", "https://*.telegram.org"],
      // Basic allowances; API does not serve scripts/styles
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// CORS: allowlist via env in production; permissive in dev
const parseOrigins = (val) => (val || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = isProduction
  ? parseOrigins(process.env.CORS_ORIGINS)
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser clients
    if (!isProduction) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS not allowed for this origin'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// =============================================================================
// GAME STATE
// =============================================================================
let gameState = {
  state: 'betting',     // 'betting' | 'running' | 'crashed'
  multiplier: 1.00,
  countdown: 5,
  crashPoint: 0,
  startTime: 0,
  players: new Map(),      // Map<userId, { ws, user, isGuest }>
  activeBets: new Map(),   // Map<userId, { amount, cashedOut, cashedOutMultiplier }>
  crashHistory: [2.45, 1.89, 5.67, 1.23, 8.91, 3.45, 2.17, 12.34]  // Array of recent crash multipliers (last 10)
};

// =============================================================================
// AUTHENTICATION ROUTES
// =============================================================================

// Telegram authentication for players
app.post('/api/auth/telegram', [
  body('telegramUser').isObject(),
  body('telegramUser.id').isNumeric(),
  body('telegramUser.first_name').notEmpty().trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid Telegram data', details: errors.array() });
    }

    const { telegramUser } = req.body;
    
    // Find or create user based on Telegram ID
    let user = await databaseService.findUserByTelegramId(telegramUser.id);
    
    if (!user) {
      // Create new user from Telegram data
      const result = await databaseService.createUser({
        telegramId: telegramUser.id,
        username: telegramUser.username || `user_${telegramUser.id}`,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        avatar: telegramUser.photo_url,
        languageCode: telegramUser.language_code
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      user = result.user;
    } else {
      // Update last login time and enrich any missing fields from Telegram payload
      const updates = { lastLoginAt: new Date() };
      if (!user.avatar && telegramUser.photo_url) updates.avatar = telegramUser.photo_url;
      if (!user.firstName && telegramUser.first_name) updates.firstName = telegramUser.first_name;
      if (!user.lastName && telegramUser.last_name) updates.lastName = telegramUser.last_name;
      // If username was empty, set it. Do not overwrite existing username to avoid collisions
      if (!user.username && telegramUser.username) updates.username = telegramUser.username;
      if (Object.keys(updates).length > 0) {
        const r = await databaseService.updateUser(user.id, updates);
        if (r.success) {
          user = r.user;
        }
      }
    }

    // Generate tokens
    const tokenResult = authService.generateToken(user);
    const refreshTokenResult = authService.generateRefreshToken(user);

    if (!tokenResult.success || !refreshTokenResult.success) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    res.json({
      success: true,
      user: user,
      token: tokenResult.token,
      refreshToken: refreshTokenResult.refreshToken
    });
  } catch (error) {
    console.error('❌ Telegram authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// =============================================================================
// ADMIN AUTHENTICATION ROUTES (Email/Password)
// =============================================================================

// Admin registration (restricted)
app.post('/api/admin/register', [
  body('username').isLength({ min: 3, max: 20 }).trim().escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  // Disallow new admin registration in production unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_REGISTRATION !== 'true') {
    return res.status(403).json({ error: 'Admin registration disabled in production' });
  }
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    // Check if admin registration is allowed (you can add your own logic here)
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_REGISTRATION_KEY) {
      return res.status(403).json({ error: 'Admin registration not allowed' });
    }

    const { username, email, password } = req.body;
    const result = await databaseService.createUser({ 
      username, 
      email, 
      password,
      role: 'ADMIN' // Set role as admin
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Generate tokens
    const tokenResult = authService.generateToken(result.user);
    const refreshTokenResult = authService.generateRefreshToken(result.user);

    if (!tokenResult.success || !refreshTokenResult.success) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    res.status(201).json({
      success: true,
      user: result.user,
      token: tokenResult.token,
      refreshToken: refreshTokenResult.refreshToken
    });
  } catch (error) {
    console.error('❌ Admin registration error:', error);
    res.status(500).json({ error: 'Admin registration failed' });
  }
});

// Admin login
app.post('/api/admin/login', [
  body('usernameOrEmail').notEmpty().trim().escape(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { usernameOrEmail, password } = req.body;
    const result = await databaseService.authenticateUser(usernameOrEmail, password);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    // Check if user is admin
    if (result.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Generate tokens
    const tokenResult = authService.generateToken(result.user);
    const refreshTokenResult = authService.generateRefreshToken(result.user);

    if (!tokenResult.success || !refreshTokenResult.success) {
      return res.status(500).json({ error: 'Failed to generate tokens' });
    }

    res.json({
      success: true,
      user: result.user,
      token: tokenResult.token,
      refreshToken: refreshTokenResult.refreshToken
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh token
app.post('/api/auth/refresh', [
  body('refreshToken').notEmpty()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      token: result.token
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
app.post('/api/auth/logout', authService.authenticateToken.bind(authService), (req, res) => {
  try {
    const result = authService.logout(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user profile
app.get('/api/auth/profile', authService.authenticateToken.bind(authService), (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Update user profile
app.put('/api/auth/profile', [
  authService.authenticateToken.bind(authService),
  body('username').optional().isLength({ min: 3, max: 20 }).trim().escape(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    // For now, we'll just return the current user
    // In a full implementation, you'd update the allowed fields
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// Change password
app.post('/api/auth/change-password', [
  authService.authenticateToken.bind(authService),
  body('oldPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { oldPassword, newPassword } = req.body;
    const result = await databaseService.changePassword(req.user.id, oldPassword, newPassword);

    res.json(result);
  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

// =============================================================================
// ADMIN MIDDLEWARE
// =============================================================================

// Admin authentication middleware
const requireAdmin = async (req, res, next) => {
  try {
    // First authenticate the token
    await authService.authenticateToken(req, res, () => {});
    
    // Check if user is admin
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// Admin dashboard stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await databaseService.getAdminStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get admin stats' });
  }
});

// Get all users (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const users = await databaseService.getAllUsers(parseInt(page), parseInt(limit), search);
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('❌ Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user (admin only)
app.put('/api/admin/users/:userId', [
  requireAdmin,
  body('balance').optional().isNumeric(),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const { userId } = req.params;
    const updateData = req.body;
    
    const result = await databaseService.updateUser(userId, updateData);
    res.json(result);
  } catch (error) {
    console.error('❌ Admin update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get game rounds (admin only)
app.get('/api/admin/game-rounds', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const rounds = await databaseService.getGameRounds(parseInt(page), parseInt(limit));
    res.json({
      success: true,
      rounds
    });
  } catch (error) {
    console.error('❌ Admin get game rounds error:', error);
    res.status(500).json({ error: 'Failed to get game rounds' });
  }
});

// =============================================================================
// PUBLIC ROUTES
// =============================================================================

// Get leaderboard
app.get('/api/leaderboard', authService.optionalAuth.bind(authService), async (req, res) => {
  try {
    const { type = 'balance', limit = 10 } = req.query;
    const leaderboard = await databaseService.getLeaderboard(type, parseInt(limit));
    
    res.json({
      success: true,
      leaderboard,
      type,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// =============================================================================
// PLAYER SETTINGS ROUTES (auth required)
// =============================================================================

app.get('/api/player/settings', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const settings = await databaseService.getPlayerSettings(req.user.id);
    res.json({ success: true, settings: settings || null });
  } catch (error) {
    console.error('❌ Player settings get error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

app.put('/api/player/settings', authService.authenticateToken.bind(authService), async (req, res) => {
  try {
    const { 
      autoCashoutEnabled, 
      autoCashoutMultiplier, 
      soundEnabled,
      dailyLimitsEnabled,
      maxDailyWager,
      maxDailyLoss,
      maxGamesPerDay
    } = req.body || {};
    
    const payload = {};
    if (typeof autoCashoutEnabled === 'boolean') payload.autoCashoutEnabled = autoCashoutEnabled;
    if (typeof autoCashoutMultiplier === 'number') payload.autoCashoutMultiplier = autoCashoutMultiplier;
    if (typeof soundEnabled === 'boolean') payload.soundEnabled = soundEnabled;
    if (typeof dailyLimitsEnabled === 'boolean') payload.dailyLimitsEnabled = dailyLimitsEnabled;
    if (typeof maxDailyWager === 'number') payload.maxDailyWager = maxDailyWager;
    if (typeof maxDailyLoss === 'number') payload.maxDailyLoss = maxDailyLoss;
    if (typeof maxGamesPerDay === 'number') payload.maxGamesPerDay = maxGamesPerDay;

    const updated = await databaseService.upsertPlayerSettings(req.user.id, payload);
    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error('❌ Player settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Crash point generation now uses provably fair system
let currentGameRound = null;

// =============================================================================
// GAME LOOP
// =============================================================================
function startGameLoop() {
  console.log('🎮 Game loop started');
  async function startBetting() {
    gameState.state = 'betting';
    gameState.multiplier = 1.0;
    gameState.countdown = 5;
    
    // Generate new game round with provably fair crash point
    const fairRound = provablyFairService.generateFairRound();
    currentGameRound = await databaseService.createGameRound(fairRound.crashPoint);
    gameState.crashPoint = fairRound.crashPoint;
    gameState.currentRoundHash = fairRound.serverSeedHash; // Show hash before round
    gameState.currentRoundSeed = fairRound.serverSeed; // Reveal after crash
    gameState.activeBets.clear();
    console.log(`💰 Betting phase. Crash at ${gameState.crashPoint.toFixed(2)}x`);
    broadcastAll();
    const countdownInterval = setInterval(() => {
      gameState.countdown--;
      broadcastAll();
      if (gameState.countdown <= 0) {
        clearInterval(countdownInterval);
        startFlying();
      }
    }, 1000);
  }
  async function startFlying() {
    gameState.state = 'running';
    gameState.startTime = Date.now();
    
    // Update game round status to running
    if (currentGameRound) {
      try {
        await databaseService.updateGameRoundStatus(currentGameRound.id, 'RUNNING');
      } catch (error) {
        console.error('❌ Error updating game round to running:', error);
      }
    }
    
    console.log("✈️ Plane taking off");
    broadcastAll();
    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.startTime;
      gameState.multiplier = 1.0 + (elapsed / 3000);
      if (gameState.multiplier >= gameState.crashPoint) {
        clearInterval(interval);
        crash();
      } else {
        broadcastAll();
      }
    }, 50);
  }
  async function crash() {
    gameState.state = 'crashed';
    gameState.multiplier = gameState.crashPoint;
    
    // Record crashed bets (bets that didn't cash out)
    if (currentGameRound) {
      try {
        for (const [userId, bet] of gameState.activeBets.entries()) {
          const player = gameState.players.get(userId);
          if (!bet.cashedOut && player && !player.isGuest) {
            await databaseService.recordCrash(userId, currentGameRound.id);
          }
        }
        
        // Complete the game round in database
        await databaseService.updateGameRoundStatus(currentGameRound.id, 'CRASHED', new Date());
      } catch (error) {
        console.error('❌ Error handling game round completion:', error);
      }
    }
    
    // Add to crash history (keep last 10)
    gameState.crashHistory.unshift(gameState.crashPoint);
    if (gameState.crashHistory.length > 10) {
      gameState.crashHistory.pop();
    }
    
    console.log(`💥 Crashed at ${gameState.crashPoint.toFixed(2)}x`);
    broadcastAll();
    setTimeout(startBetting, 3000);
  }
  startBetting();
}

// =============================================================================
// WebSocket handling - Railway-compatible with heartbeat
// =============================================================================
const wss = new WebSocket.Server({ noServer: true });

function heartbeat() { 
  this.isAlive = true; 
}

function broadcastAll() {
  // send each player *their own state* (so we can highlight their bet/cashout)
  for (const [userId, p] of gameState.players.entries()) {
    if (p.ws.readyState !== WebSocket.OPEN) continue;
    const personalBet = gameState.activeBets.get(userId);
    
    // Get balance from user account or guest balance
    const balance = p.isGuest ? p.guestBalance : p.user.balance;
    
    p.ws.send(JSON.stringify({
      type: 'gameState',
      data: {
        state: gameState.state,
        multiplier: gameState.multiplier,
        countdown: gameState.countdown,
        playersOnline: gameState.players.size,
        hasActiveBet: !!personalBet,
        activeBetAmount: personalBet?.amount || 0,
        cashedOut: personalBet?.cashedOut || false,
        cashedOutMultiplier: personalBet?.cashedOutMultiplier || 0,
        balance: balance,
        crashHistory: gameState.crashHistory,
        isAuthenticated: !p.isGuest,
        user: p.isGuest ? null : p.user
      }
    }));
  }
}

wss.on('connection', async (ws, req) => {
  // Enable heartbeat for this connection
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  // Per-connection simple rate limit (messages/second)
  ws._msgWindowStart = Date.now();
  ws._msgCount = 0;

  let userId = null;
  let user = null;
  let isGuest = true;

  // Try to authenticate user from token in query params or headers
  const url = new URL(req.url, `http://${req.headers.host}`);
  let token = url.searchParams.get('token') || req.headers.authorization?.split(' ')[1];
  // Also accept token via WebSocket subprotocols: ['auth','bearer.<token>']
  if (!token && req.headers['sec-websocket-protocol']) {
    const prot = req.headers['sec-websocket-protocol']
      .split(',')
      .map(s => s.trim());
    const bearer = prot.find(p => p.startsWith('bearer.'));
    if (bearer) token = bearer.substring('bearer.'.length);
  }

  if (token) {
    const verification = authService.verifyToken(token);
    if (verification.success) {
      user = await databaseService.findUserById(verification.decoded.userId);
      if (user && user.isActive) {
        userId = user.id;
        isGuest = false;
        console.log(`🔐 Authenticated user connected: ${user.username}`);
      }
    }
  }

  // If not authenticated, create guest session
  if (isGuest) {
    userId = 'guest_' + Math.random().toString(36).substring(7);
    console.log(`👤 Guest player connected: ${userId}`);
  }

  // Store player connection
  gameState.players.set(userId, { 
    ws, 
    user: user,
    isGuest: isGuest,
    guestBalance: isGuest ? 10000 : 0 // Guests get demo balance
  });
  
  ws.userId = userId;
  ws.isGuest = isGuest;

  console.log(`📊 Sending initial crash history:`, gameState.crashHistory);
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    data: { 
      userId: userId,
      playerId: userId,
      isGuest: isGuest,
      user: isGuest ? null : user
    }
  }));

  ws.on('message', (msg) => {
    try {
      // Rate limiting: allow up to 10 messages per second
      const now = Date.now();
      if (now - ws._msgWindowStart >= 1000) {
        ws._msgWindowStart = now;
        ws._msgCount = 0;
      }
      ws._msgCount += 1;
      if (ws._msgCount > 10) {
        console.warn(`🚧 Rate limit exceeded for user ${ws.userId}`);
        return; // Drop excess messages silently
      }

      const data = JSON.parse(msg);
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        return; // Ignore invalid messages
      }

      // Basic schema validation
      if (data.type === 'bet') {
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
          return; // invalid bet
        }
      }

      const id = ws.userId;
      if (!id) return;
      if (data.type === 'bet') handleBet(id, data.amount);
      if (data.type === 'cashOut') handleCashOut(id);
    } catch (err) {
      console.error("Could not parse:", msg);
    }
  });

  ws.on('close', () => {
    gameState.players.delete(userId);
    gameState.activeBets.delete(userId);
    if (isGuest) {
      console.log(`👋 Guest player ${userId} disconnected. Total players: ${gameState.players.size}`);
    } else {
      console.log(`👋 User ${user.username} disconnected. Total players: ${gameState.players.size}`);
    }
  });
});

// Heartbeat system - ping clients every 15s to keep connections alive
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log(`💀 Terminating dead connection for user: ${ws.userId}`);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Manual upgrade handling - only upgrade on /ws path
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  console.log(`🔌 WebSocket upgrade request for: ${req.url}`);

  if (pathname !== '/ws') {
    console.log(`❌ Rejecting upgrade for non-WebSocket path: ${req.url}`);
    socket.destroy();
    return;
  }

  console.log(`✅ Upgrading connection to WebSocket on /ws`);
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

// =============================================================================
// Bet / CashOut logic
// =============================================================================
async function handleBet(userId, amount) {
  const player = gameState.players.get(userId);
  if (!player || gameState.state !== 'betting') return;

  // Get current balance
  const currentBalance = player.isGuest ? player.guestBalance : player.user.balance;
  
  if (amount > currentBalance) return;

  // Deduct bet amount
  if (player.isGuest) {
    player.guestBalance -= amount;
  } else {
    // Update authenticated user's balance in database and record bet
    const newBalance = player.user.balance - amount;
    await databaseService.updateUserBalance(userId, newBalance);
    
    // Record the bet in database
    if (currentGameRound) {
      await databaseService.recordBet(userId, currentGameRound.id, amount, null, 'active');
    }
    
    player.user.balance = newBalance; // Update cached user data
  }

  gameState.activeBets.set(userId, {
    amount,
    cashedOut: false,
    cashedOutMultiplier: 0
  });

  const newBalance = player.isGuest ? player.guestBalance : player.user.balance;
  player.ws.send(JSON.stringify({ 
    type: 'betPlaced', 
    data: { amount, balance: newBalance } 
  }));
}

async function handleCashOut(userId) {
  const player = gameState.players.get(userId);
  const bet = gameState.activeBets.get(userId);
  if (!player || !bet || bet.cashedOut || gameState.state !== 'running') return;
  
  const winnings = Math.floor(bet.amount * gameState.multiplier);
  bet.cashedOut = true;
  bet.cashedOutMultiplier = gameState.multiplier;
  
  // Add winnings to balance
  if (player.isGuest) {
    player.guestBalance += winnings;
  } else {
    // Update authenticated user's balance and bet record in database
    const newBalance = player.user.balance + winnings;
    await databaseService.updateUserBalance(userId, newBalance);
    
    // Update the bet record with cashout info
    if (currentGameRound) {
      await databaseService.recordCashout(userId, currentGameRound.id, gameState.multiplier, winnings);
    }
    
    player.user.balance = newBalance; // Update cached user data
  }

  const newBalance = player.isGuest ? player.guestBalance : player.user.balance;
  player.ws.send(JSON.stringify({ 
    type: 'cashedOut', 
    data: { 
      winnings, 
      multiplier: bet.cashedOutMultiplier, 
      balance: newBalance 
    } 
  }));
}

// =============================================================================
// REST API
// =============================================================================
app.get('/api/health', (_,res)=>res.json({ status:'OK', players:gameState.players.size }));
app.get('/api/game-state', (_,res)=>res.json({ state:gameState.state, multiplier:gameState.multiplier, countdown:gameState.countdown, players:gameState.players.size }));

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3002;
server.listen(PORT,()=>{ console.log(`Server on ${PORT}`);startGameLoop(); });
