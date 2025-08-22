const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class DatabaseService {
  // Helper function to get today's date as DateTime for Prisma
  getTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    return today;
  }

  // ==================== USER MANAGEMENT ====================
  
  async createUser(userData) {
    const { telegramId, username, email, firstName, lastName, avatar, password, role } = userData;
    
    try {
      // Hash password if provided
      let passwordHash = null;
      if (password) {
        passwordHash = await bcrypt.hash(password, 12);
      }
      
      const user = await prisma.user.create({
        data: {
          telegramId: telegramId?.toString(),
          username,
          email,
          firstName,
          lastName,
          avatar,
          passwordHash,
          role: role || 'PLAYER', // Default to PLAYER if no role specified
          balance: process.env.DEFAULT_BALANCE || 1000,
          isVerified: !!telegramId, // Auto-verify Telegram users
        },
      });

      // Create default player settings (best-effort)
      try {
        await prisma.playerSettings.create({
          data: {
            userId: user.id,
            autoCashoutEnabled: false,
            autoCashoutMultiplier: new prisma.Prisma.Decimal(2.0),
            soundEnabled: true,
          }
        });
      } catch (_) {}
      
      console.log(`👤 Created user: ${username} (${user.id})`);
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return { success: false, error: 'Failed to create user' };
    }
  }

  // ==================== PLAYER SETTINGS ====================

  async getPlayerSettings(userId) {
    try {
      const settings = await prisma.playerSettings.findUnique({ where: { userId } });
      return settings;
    } catch (error) {
      console.error('❌ Error getting player settings:', error);
      return null;
    }
  }

  async upsertPlayerSettings(userId, partialSettings) {
    try {
      const updated = await prisma.playerSettings.upsert({
        where: { userId },
        update: {
          ...('autoCashoutEnabled' in partialSettings ? { autoCashoutEnabled: partialSettings.autoCashoutEnabled } : {}),
          ...('autoCashoutMultiplier' in partialSettings ? { autoCashoutMultiplier: new prisma.Prisma.Decimal(partialSettings.autoCashoutMultiplier) } : {}),
          ...('soundEnabled' in partialSettings ? { soundEnabled: partialSettings.soundEnabled } : {}),
        },
        create: {
          userId,
          autoCashoutEnabled: !!partialSettings.autoCashoutEnabled,
          autoCashoutMultiplier: new prisma.Prisma.Decimal(partialSettings.autoCashoutMultiplier ?? 2.0),
          soundEnabled: 'soundEnabled' in partialSettings ? !!partialSettings.soundEnabled : true,
        }
      });
      return updated;
    } catch (error) {
      console.error('❌ Error upserting player settings:', error);
      return null;
    }
  }
  
  async findUserById(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          dailyLimits: {
            where: {
              date: this.getTodayDate()
            }
          }
        }
      });
      
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      console.error('❌ Error finding user by ID:', error);
      return null;
    }
  }
  
  async findUserByTelegramId(telegramId) {
    try {
      const user = await prisma.user.findUnique({
        where: { telegramId: telegramId.toString() },
        include: {
          dailyLimits: {
            where: {
              date: this.getTodayDate()
            }
          }
        }
      });
      
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      console.error('❌ Error finding user by Telegram ID:', error);
      return null;
    }
  }
  
  async findUserByUsername(username) {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });
      
      return user ? this.sanitizeUser(user) : null;
    } catch (error) {
      console.error('❌ Error finding user by username:', error);
      return null;
    }
  }
  
  async authenticateUser(username, password) {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });
      
      if (!user || !user.passwordHash) {
        return null;
      }
      
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return null;
      }
      
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      
      return this.sanitizeUser(user);
    } catch (error) {
      console.error('❌ Error authenticating user:', error);
      return null;
    }
  }
  
  // ==================== BALANCE MANAGEMENT ====================
  
  async updateBalance(userId, amount, description = null) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get current user
        const user = await tx.user.findUnique({
          where: { id: userId }
        });
        
        if (!user) {
          throw new Error('User not found');
        }
        
        const balanceBefore = parseFloat(user.balance);
        const balanceAfter = balanceBefore + amount;
        
        if (balanceAfter < 0) {
          throw new Error('Insufficient balance');
        }
        
        // Update user balance
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter }
        });
        
        // Create transaction record
        await tx.transaction.create({
          data: {
            userId,
            type: amount > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
            amount: Math.abs(amount),
            balanceBefore,
            balanceAfter,
            description
          }
        });
        
        return updatedUser;
      });
      
      console.log(`💰 Updated balance for ${userId}: ${amount} (new: ${result.balance})`);
      return this.sanitizeUser(result);
    } catch (error) {
      console.error('❌ Error updating balance:', error);
      throw error;
    }
  }
  
  // ==================== GAME ROUND MANAGEMENT ====================
  
  async createGameRound(crashPoint) {
    try {
      // Generate provably fair seeds
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      
      const gameRound = await prisma.gameRound.create({
        data: {
          serverSeed,
          serverSeedHash,
          crashPoint,
          startTime: new Date(),
          status: 'BETTING'
        }
      });
      
      console.log(`🎮 Created game round ${gameRound.roundNumber} (crash: ${crashPoint}x)`);
      return gameRound;
    } catch (error) {
      console.error('❌ Error creating game round:', error);
      throw error;
    }
  }
  
  async updateGameRoundStatus(roundId, status, endTime = null) {
    try {
      const updateData = { status };
      if (endTime) {
        updateData.endTime = endTime;
      }
      
      const gameRound = await prisma.gameRound.update({
        where: { id: roundId },
        data: updateData
      });
      
      return gameRound;
    } catch (error) {
      console.error('❌ Error updating game round status:', error);
      throw error;
    }
  }
  
  async getCurrentGameRound() {
    try {
      const gameRound = await prisma.gameRound.findFirst({
        where: {
          status: { in: ['BETTING', 'RUNNING'] }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return gameRound;
    } catch (error) {
      console.error('❌ Error getting current game round:', error);
      return null;
    }
  }
  
  // ==================== BET MANAGEMENT ====================
  
  async placeBet(userId, gameRoundId, amount, cashoutAt = null) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Validate user balance
        const user = await tx.user.findUnique({
          where: { id: userId }
        });
        
        if (!user) {
          throw new Error('User not found');
        }
        
        if (parseFloat(user.balance) < amount) {
          throw new Error('Insufficient balance');
        }
        
        // Check daily limits
        await this.checkDailyLimits(userId, amount, tx);
        
        // Deduct balance
        const balanceBefore = parseFloat(user.balance);
        const balanceAfter = balanceBefore - amount;
        
        await tx.user.update({
          where: { id: userId },
          data: { balance: balanceAfter }
        });
        
        // Create bet
        const bet = await tx.bet.create({
          data: {
            userId,
            gameRoundId,
            amount,
            cashoutAt,
            status: 'ACTIVE'
          }
        });
        
        // Create transaction record
        await tx.transaction.create({
          data: {
            userId,
            betId: bet.id,
            type: 'BET_PLACED',
            amount,
            balanceBefore,
            balanceAfter,
            description: `Bet placed for round ${gameRoundId}`
          }
        });
        
        // Update daily limits
        await this.updateDailyLimits(userId, amount, 0, 1, tx);
        
        return bet;
      });
      
      console.log(`🎯 Bet placed: ${userId} - ${amount} (${result.id})`);
      return result;
    } catch (error) {
      console.error('❌ Error placing bet:', error);
      throw error;
    }
  }
  
  async cashoutBet(betId, multiplier) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get bet
        const bet = await tx.bet.findUnique({
          where: { id: betId },
          include: { user: true }
        });
        
        if (!bet || bet.status !== 'ACTIVE') {
          throw new Error('Invalid bet');
        }
        
        const payout = parseFloat(bet.amount) * multiplier;
        const balanceBefore = parseFloat(bet.user.balance);
        const balanceAfter = balanceBefore + payout;
        
        // Update bet
        const updatedBet = await tx.bet.update({
          where: { id: betId },
          data: {
            actualCashout: multiplier,
            payout,
            cashedOutAt: new Date(),
            status: 'CASHED_OUT'
          }
        });
        
        // Update user balance
        await tx.user.update({
          where: { id: bet.userId },
          data: { 
            balance: balanceAfter,
            totalWon: { increment: payout },
            biggestWin: { set: Math.max(parseFloat(bet.user.biggestWin), payout) }
          }
        });
        
        // Create transaction record
        await tx.transaction.create({
          data: {
            userId: bet.userId,
            betId: bet.id,
            type: 'BET_WON',
            amount: payout,
            balanceBefore,
            balanceAfter,
            description: `Cashout at ${multiplier}x`
          }
        });
        
        return updatedBet;
      });
      
      console.log(`💰 Bet cashed out: ${betId} at ${multiplier}x (payout: ${result.payout})`);
      return result;
    } catch (error) {
      console.error('❌ Error cashing out bet:', error);
      throw error;
    }
  }
  
  async crashBets(gameRoundId, crashPoint) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Get all active bets for this round
        const activeBets = await tx.bet.findMany({
          where: {
            gameRoundId,
            status: 'ACTIVE'
          },
          include: { user: true }
        });
        
        let lostBets = 0;
        
        for (const bet of activeBets) {
          // Update bet as lost
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              status: 'LOST',
              actualCashout: crashPoint
            }
          });
          
          // Update user stats
          await tx.user.update({
            where: { id: bet.userId },
            data: {
              totalLost: { increment: parseFloat(bet.amount) },
              gamesPlayed: { increment: 1 }
            }
          });
          
          // Create transaction record
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              betId: bet.id,
              type: 'BET_LOST',
              amount: parseFloat(bet.amount),
              balanceBefore: parseFloat(bet.user.balance),
              balanceAfter: parseFloat(bet.user.balance),
              description: `Lost at ${crashPoint}x`
            }
          });
          
          // Update daily limits
          await this.updateDailyLimits(bet.userId, 0, parseFloat(bet.amount), 0, tx);
          
          lostBets++;
        }
        
        return { lostBets, totalBets: activeBets.length };
      });
      
      console.log(`💥 Crashed ${result.lostBets} bets at ${crashPoint}x`);
      return result;
    } catch (error) {
      console.error('❌ Error crashing bets:', error);
      throw error;
    }
  }
  
  // ==================== DAILY LIMITS ====================
  
  async checkDailyLimits(userId, betAmount, tx = prisma) {
    const today = this.getTodayDate();
    
    const limits = await tx.dailyLimit.findUnique({
      where: {
        userId_date: {
          userId,
          date: new Date(today)
        }
      }
    });
    
    if (limits) {
      if (limits.maxWager && (parseFloat(limits.currentWager) + betAmount) > parseFloat(limits.maxWager)) {
        throw new Error('Daily wager limit exceeded');
      }
      
      if (limits.maxGames && (limits.currentGames + 1) > limits.maxGames) {
        throw new Error('Daily games limit exceeded');
      }
    }
  }
  
  async updateDailyLimits(userId, wager, loss, games, tx = prisma) {
    const today = this.getTodayDate();
    
    await tx.dailyLimit.upsert({
      where: {
        userId_date: {
          userId,
          date: new Date(today)
        }
      },
      update: {
        currentWager: { increment: wager },
        currentLoss: { increment: loss },
        currentGames: { increment: games }
      },
      create: {
        userId,
        date: new Date(today),
        currentWager: wager,
        currentLoss: loss,
        currentGames: games
      }
    });
  }
  
  // ==================== STATISTICS ====================
  
  async getUserStats(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          bets: {
            orderBy: { placedAt: 'desc' },
            take: 50,
            include: {
              gameRound: true
            }
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });
      
      if (!user) return null;
      
      // Calculate additional stats
      const totalBets = user.bets.length;
      const wonBets = user.bets.filter(bet => bet.status === 'CASHED_OUT').length;
      const winRate = totalBets > 0 ? (wonBets / totalBets * 100).toFixed(2) : 0;
      const netProfit = parseFloat(user.totalWon) - parseFloat(user.totalLost);
      
      return {
        ...this.sanitizeUser(user),
        stats: {
          totalBets,
          wonBets,
          winRate: parseFloat(winRate),
          netProfit,
          recentBets: user.bets,
          recentTransactions: user.transactions
        }
      };
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      return null;
    }
  }
  
  async getLeaderboard(limit = 10) {
    try {
      const users = await prisma.user.findMany({
        orderBy: { totalWon: 'desc' },
        take: limit,
        select: {
          id: true,
          username: true,
          firstName: true,
          totalWon: true,
          totalWagered: true,
          gamesPlayed: true,
          biggestWin: true
        }
      });
      
      return users.map(user => ({
        ...user,
        netProfit: parseFloat(user.totalWon) - parseFloat(user.totalWagered)
      }));
    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      return [];
    }
  }
  
  async updateUser(userId, updateData) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });
      
      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error updating user:', error);
      return { success: false, error: 'Failed to update user' };
    }
  }

  async authenticateUser(usernameOrEmail, password) {
    try {
      // Find user by username or email
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: usernameOrEmail },
            { email: usernameOrEmail }
          ]
        }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.passwordHash) {
        return { success: false, error: 'No password set for this user' };
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid password' };
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is disabled' };
      }

      return { success: true, user: this.sanitizeUser(user) };
    } catch (error) {
      console.error('❌ Error authenticating user:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  // ==================== ADMIN METHODS ====================
  
  async getAdminStats() {
    try {
      const [
        totalUsers,
        totalGames,
        totalBets,
        activeUsers,
        recentUsers
      ] = await Promise.all([
        prisma.user.count(),
        prisma.gameRound.count(),
        prisma.bet.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ]);

      const totalWagered = await prisma.bet.aggregate({
        _sum: { amount: true }
      });

      const totalWon = await prisma.bet.aggregate({
        _sum: { payout: true },
        where: { status: 'CASHED_OUT' }
      });

      return {
        totalUsers,
        totalGames,
        totalBets,
        activeUsers,
        recentUsers,
        totalWagered: totalWagered._sum.amount || 0,
        totalWon: totalWon._sum.payout || 0,
        houseProfit: (totalWagered._sum.amount || 0) - (totalWon._sum.payout || 0)
      };
    } catch (error) {
      console.error('❌ Error getting admin stats:', error);
      throw error;
    }
  }

  async getAllUsers(page = 1, limit = 50, search = '') {
    try {
      const skip = (page - 1) * limit;
      const where = search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } }
        ]
      } : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            telegramId: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            balance: true,
            isActive: true,
            isVerified: true,
            totalWagered: true,
            totalWon: true,
            gamesPlayed: true,
            createdAt: true,
            lastLoginAt: true
          }
        }),
        prisma.user.count({ where })
      ]);

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('❌ Error getting all users:', error);
      throw error;
    }
  }

  async getGameRounds(page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;

      const [rounds, total] = await Promise.all([
        prisma.gameRound.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            bets: {
              select: {
                id: true,
                amount: true,
                payout: true,
                status: true,
                user: {
                  select: {
                    username: true,
                    telegramId: true
                  }
                }
              }
            }
          }
        }),
        prisma.gameRound.count()
      ]);

      return {
        rounds,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('❌ Error getting game rounds:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================
  
  sanitizeUser(user) {
    if (!user) return null;
    
    const { passwordHash, ...sanitized } = user;
    return {
      ...sanitized,
      balance: parseFloat(sanitized.balance),
      totalWagered: parseFloat(sanitized.totalWagered),
      totalWon: parseFloat(sanitized.totalWon),
      totalLost: parseFloat(sanitized.totalLost),
      biggestWin: parseFloat(sanitized.biggestWin)
    };
  }
  
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', database: 'connected' };
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return { status: 'unhealthy', database: 'disconnected', error: error.message };
    }
  }
}

module.exports = new DatabaseService();
