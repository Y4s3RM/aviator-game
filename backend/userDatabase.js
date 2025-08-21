// 👤 User Database Service - Simple file-based user storage with security
// In production, this would be replaced with a proper database like PostgreSQL

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class UserDatabase {
  constructor() {
    this.dbPath = path.join(__dirname, 'users.json');
    this.users = new Map();
    this.loadUsers();
  }

  // Load users from file
  async loadUsers() {
    try {
      const data = await fs.readFile(this.dbPath, 'utf8');
      const usersArray = JSON.parse(data);
      this.users = new Map(usersArray.map(user => [user.id, user]));
      console.log(`📚 Loaded ${this.users.size} users from database`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📚 Creating new user database');
        await this.saveUsers();
      } else {
        console.error('❌ Error loading users:', error);
      }
    }
  }

  // Save users to file
  async saveUsers() {
    try {
      const usersArray = Array.from(this.users.values());
      await fs.writeFile(this.dbPath, JSON.stringify(usersArray, null, 2));
    } catch (error) {
      console.error('❌ Error saving users:', error);
    }
  }

  // Create new user
  async createUser(username, email, password) {
    try {
      // Check if user already exists
      const existingUser = this.findUserByUsername(username) || this.findUserByEmail(email);
      if (existingUser) {
        return { success: false, error: 'User already exists' };
      }

      // Validate input
      if (!username || username.length < 3 || username.length > 20) {
        return { success: false, error: 'Username must be 3-20 characters' };
      }

      if (!email || !this.isValidEmail(email)) {
        return { success: false, error: 'Invalid email address' };
      }

      if (!password || password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user object
      const user = {
        id: uuidv4(),
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        balance: 10000, // Starting balance
        totalWagered: 0,
        totalWon: 0,
        totalLost: 0,
        gamesPlayed: 0,
        winRate: 0,
        biggestWin: 0,
        biggestLoss: 0,
        level: 1,
        experience: 0,
        achievements: [],
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        isActive: true,
        role: 'player' // 'player', 'vip', 'admin'
      };

      this.users.set(user.id, user);
      await this.saveUsers();

      console.log(`👤 Created new user: ${username} (${email})`);
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return { success: false, error: 'Failed to create user' };
    }
  }

  // Authenticate user
  async authenticateUser(usernameOrEmail, password) {
    try {
      const user = this.findUserByUsername(usernameOrEmail) || this.findUserByEmail(usernameOrEmail);
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is disabled' };
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid password' };
      }

      // Update last login
      user.lastLoginAt = new Date().toISOString();
      await this.saveUsers();

      console.log(`🔐 User authenticated: ${user.username}`);
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error authenticating user:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  // Find user by username
  findUserByUsername(username) {
    if (!username) return null;
    return Array.from(this.users.values()).find(
      user => user.username === username.toLowerCase().trim()
    );
  }

  // Find user by email
  findUserByEmail(email) {
    if (!email) return null;
    return Array.from(this.users.values()).find(
      user => user.email === email.toLowerCase().trim()
    );
  }

  // Find user by ID
  findUserById(id) {
    return this.users.get(id);
  }

  // Update user data
  async updateUser(userId, updates) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Only allow certain fields to be updated
      const allowedFields = ['balance', 'totalWagered', 'totalWon', 'totalLost', 'gamesPlayed', 'winRate', 'biggestWin', 'biggestLoss', 'level', 'experience', 'achievements'];
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          user[key] = value;
        }
      }

      user.updatedAt = new Date().toISOString();
      await this.saveUsers();

      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return { success: false, error: 'Failed to update user' };
    }
  }

  // Update user balance
  async updateBalance(userId, newBalance) {
    return this.updateUser(userId, { balance: newBalance });
  }

  // Record game statistics
  async recordGameStats(userId, betAmount, winnings, multiplier) {
    try {
      const user = this.users.get(userId);
      if (!user) return { success: false, error: 'User not found' };

      const profit = winnings - betAmount;
      const isWin = winnings > 0;

      const updates = {
        balance: user.balance + profit,
        totalWagered: user.totalWagered + betAmount,
        gamesPlayed: user.gamesPlayed + 1
      };

      if (isWin) {
        updates.totalWon = user.totalWon + winnings;
        updates.biggestWin = Math.max(user.biggestWin, profit);
      } else {
        updates.totalLost = user.totalLost + betAmount;
        updates.biggestLoss = Math.max(user.biggestLoss, betAmount);
      }

      // Calculate win rate
      const totalGames = updates.gamesPlayed;
      const wins = isWin ? (user.winRate * user.gamesPlayed / 100) + 1 : (user.winRate * user.gamesPlayed / 100);
      updates.winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      // Calculate experience and level
      updates.experience = user.experience + Math.floor(betAmount / 100);
      updates.level = Math.floor(updates.experience / 1000) + 1;

      return this.updateUser(userId, updates);
    } catch (error) {
      console.error('❌ Error recording game stats:', error);
      return { success: false, error: 'Failed to record stats' };
    }
  }

  // Get leaderboard
  getLeaderboard(type = 'balance', limit = 10) {
    const users = Array.from(this.users.values())
      .filter(user => user.isActive)
      .sort((a, b) => {
        switch (type) {
          case 'balance': return b.balance - a.balance;
          case 'totalWon': return b.totalWon - a.totalWon;
          case 'winRate': return b.winRate - a.winRate;
          case 'level': return b.level - a.level;
          default: return b.balance - a.balance;
        }
      })
      .slice(0, limit)
      .map(user => this.sanitizeUser(user));

    return users;
  }

  // Remove sensitive data from user object
  sanitizeUser(user) {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Get user count
  getUserCount() {
    return this.users.size;
  }

  // Get active users
  getActiveUsers() {
    return Array.from(this.users.values()).filter(user => user.isActive);
  }

  // Deactivate user
  async deactivateUser(userId) {
    return this.updateUser(userId, { isActive: false });
  }

  // Change password
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = this.users.get(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const isValidPassword = await bcrypt.compare(oldPassword, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid current password' };
      }

      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'New password must be at least 6 characters' };
      }

      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      user.password = hashedPassword;
      user.updatedAt = new Date().toISOString();
      await this.saveUsers();

      console.log(`🔐 Password changed for user: ${user.username}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error changing password:', error);
      return { success: false, error: 'Failed to change password' };
    }
  }
}

// Create singleton instance
const userDatabase = new UserDatabase();

module.exports = userDatabase;
