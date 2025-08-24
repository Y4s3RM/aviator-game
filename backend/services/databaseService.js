const { PrismaClient, Prisma } = require('@prisma/client');
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
            autoCashoutMultiplier: new Prisma.Decimal(2.0),
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
      if (!settings) return null;
      
      // Convert Decimal fields to numbers for frontend consumption
      return {
        ...settings,
        autoCashoutMultiplier: settings.autoCashoutMultiplier ? Number(settings.autoCashoutMultiplier) : 2.0,
        maxDailyWager: settings.maxDailyWager ? Number(settings.maxDailyWager) : 10000,
        maxDailyLoss: settings.maxDailyLoss ? Number(settings.maxDailyLoss) : 5000
      };
    } catch (error) {
      console.error('❌ Error getting player settings:', error);
      return null;
    }
  }

  async upsertPlayerSettings(userId, partialSettings) {
    try {
      console.log(`📝 upsertPlayerSettings called for user ${userId} with:`, partialSettings);
      
      const updated = await prisma.playerSettings.upsert({
        where: { userId },
        update: {
          ...('autoCashoutEnabled' in partialSettings ? { autoCashoutEnabled: partialSettings.autoCashoutEnabled } : {}),
          ...('autoCashoutMultiplier' in partialSettings ? { autoCashoutMultiplier: new Prisma.Decimal(partialSettings.autoCashoutMultiplier) } : {}),
          ...('soundEnabled' in partialSettings ? { soundEnabled: partialSettings.soundEnabled } : {}),
          ...('dailyLimitsEnabled' in partialSettings ? { dailyLimitsEnabled: partialSettings.dailyLimitsEnabled } : {}),
          ...('maxDailyWager' in partialSettings ? { maxDailyWager: new Prisma.Decimal(partialSettings.maxDailyWager) } : {}),
          ...('maxDailyLoss' in partialSettings ? { maxDailyLoss: new Prisma.Decimal(partialSettings.maxDailyLoss) } : {}),
          ...('maxGamesPerDay' in partialSettings ? { maxGamesPerDay: partialSettings.maxGamesPerDay } : {}),
        },
        create: {
          userId,
          autoCashoutEnabled: !!partialSettings.autoCashoutEnabled,
          autoCashoutMultiplier: new Prisma.Decimal(partialSettings.autoCashoutMultiplier ?? 2.0),
          soundEnabled: 'soundEnabled' in partialSettings ? !!partialSettings.soundEnabled : true,
          dailyLimitsEnabled: 'dailyLimitsEnabled' in partialSettings ? !!partialSettings.dailyLimitsEnabled : true,
          maxDailyWager: new Prisma.Decimal(partialSettings.maxDailyWager ?? 10000),
          maxDailyLoss: new Prisma.Decimal(partialSettings.maxDailyLoss ?? 5000),
          maxGamesPerDay: partialSettings.maxGamesPerDay ?? 100,
        }
      });
      console.log(`✅ Player settings upserted successfully:`, updated);
      
      // Convert Decimal fields to numbers for frontend consumption
      return {
        ...updated,
        autoCashoutMultiplier: updated.autoCashoutMultiplier ? Number(updated.autoCashoutMultiplier) : 2.0,
        maxDailyWager: updated.maxDailyWager ? Number(updated.maxDailyWager) : 10000,
        maxDailyLoss: updated.maxDailyLoss ? Number(updated.maxDailyLoss) : 5000
      };
    } catch (error) {
      console.error('❌ Error upserting player settings:', error);
      console.error('Full error details:', error);
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
  
  async createGameRound(fairRoundData) {
    try {
      // fairRoundData should contain: serverSeed, serverSeedHash, clientSeed, nonce, crashPoint
      const gameRound = await prisma.gameRound.create({
        data: {
          serverSeed: fairRoundData.serverSeed,
          serverSeedHash: fairRoundData.serverSeedHash,
          clientSeed: fairRoundData.clientSeed || null,
          nonce: fairRoundData.nonce || 0,
          crashPoint: fairRoundData.crashPoint,
          startTime: new Date(),
          status: 'BETTING'
        }
      });
      
      console.log(`🎮 Created game round ${gameRound.roundNumber} (crash: ${fairRoundData.crashPoint}x)`);
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
          data: { 
            balance: balanceAfter,
            totalWagered: { increment: amount }
          }
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
        // Calculate experience based on win multiplier
        const expGained = Math.min(50, Math.floor(10 + (multiplier * 5))); // 10 base + 5 per multiplier, max 50
        
        await tx.user.update({
          where: { id: bet.userId },
          data: { 
            balance: balanceAfter,
            totalWon: { increment: payout },
            biggestWin: { set: Math.max(parseFloat(bet.user.biggestWin), payout) },
            gamesPlayed: { increment: 1 },
            experience: { increment: expGained }
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
      
      // Update user level based on new experience
      await this.updateUserLevel(result.userId);
      
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
          const betAmount = parseFloat(bet.amount);
          const currentUser = await tx.user.findUnique({
            where: { id: bet.userId },
            select: { biggestLoss: true }
          });
          
          await tx.user.update({
            where: { id: bet.userId },
            data: {
              totalLost: { increment: betAmount },
              gamesPlayed: { increment: 1 },
              // Update biggest loss if this is larger
              biggestLoss: betAmount > parseFloat(currentUser.biggestLoss || 0) 
                ? betAmount 
                : currentUser.biggestLoss,
              // Add experience for playing (even on loss)
              experience: { increment: 5 }
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
        
        return { lostBets, totalBets: activeBets.length, userIds: activeBets.map(bet => bet.userId) };
      });
      
      // Update levels for all affected users
      for (const userId of result.userIds) {
        await this.updateUserLevel(userId);
      }
      
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
  
  async getRecentRoundsForFairness(limit = 50) {
    try {
      const rounds = await prisma.gameRound.findMany({
        where: {
          status: 'CRASHED'
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        select: {
          id: true,
          roundNumber: true,
          serverSeed: true,
          serverSeedHash: true,
          clientSeed: true,
          nonce: true,
          crashPoint: true,
          startTime: true,
          endTime: true,
          createdAt: true
        }
      });
      
      // Only reveal server seeds for rounds older than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      return rounds.map(round => ({
        ...round,
        serverSeed: round.endTime && new Date(round.endTime) < fiveMinutesAgo 
          ? round.serverSeed 
          : null, // Hide seed for recent rounds
        crashPoint: round.crashPoint.toString()
      }));
    } catch (error) {
      console.error('❌ Error getting recent rounds for fairness:', error);
      return [];
    }
  }
  
  async getLeaderboard(type = 'balance', limit = 10) {
    try {
      // Determine sort order based on type
      let orderBy = {};
      switch (type) {
        case 'balance':
          orderBy = { balance: 'desc' };
          break;
        case 'totalWon':
          orderBy = { totalWon: 'desc' };
          break;
        case 'winRate':
          // For win rate, we need to fetch all and sort manually
          orderBy = { gamesPlayed: 'desc' }; // At least some games
          break;
        default:
          orderBy = { balance: 'desc' };
      }
      
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          role: 'PLAYER' // Exclude admins from leaderboard
        },
        orderBy,
        take: type === 'winRate' ? 100 : limit, // Get more for winRate calculation
        select: {
          id: true,
          username: true,
          firstName: true,
          balance: true,
          totalWon: true,
          totalWagered: true,
          totalLost: true,
          gamesPlayed: true,
          biggestWin: true,
          biggestLoss: true,
          experience: true,
          level: true
        },
        include: {
          bets: {
            select: {
              status: true
            }
          }
        }
      });
      
      // Calculate additional stats
      let processedUsers = users.map(user => {
        const wonBets = user.bets.filter(bet => bet.status === 'CASHED_OUT').length;
        const totalBets = user.bets.length;
        const winRate = totalBets > 0 ? (wonBets / totalBets * 100) : 0;
        
        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          balance: parseFloat(user.balance),
          totalWon: parseFloat(user.totalWon),
          totalWagered: parseFloat(user.totalWagered),
          gamesPlayed: user.gamesPlayed,
          biggestWin: parseFloat(user.biggestWin),
          netProfit: parseFloat(user.totalWon) - parseFloat(user.totalLost),
          winRate: parseFloat(winRate.toFixed(2))
        };
      });
      
      // Sort by win rate if needed and limit
      if (type === 'winRate') {
        processedUsers = processedUsers
          .filter(user => user.gamesPlayed >= 10) // Min 10 games for win rate leaderboard
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, limit);
      }
      
      return processedUsers;
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

  // ==================== FARMING SYSTEM ====================
  
  async claimFarmingPoints(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const now = new Date();
      const lastClaimed = user.lastClaimedAt ? new Date(user.lastClaimedAt) : null;
      const hoursElapsed = lastClaimed 
        ? (now - lastClaimed) / (1000 * 60 * 60) 
        : 6; // If never claimed, allow first claim

      if (hoursElapsed < 6) {
        const timeRemaining = 6 - hoursElapsed;
        return { 
          success: false, 
          error: 'Cannot claim yet',
          timeRemaining: timeRemaining * 60 * 60 * 1000, // milliseconds
          nextClaimTime: new Date(lastClaimed.getTime() + 6 * 60 * 60 * 1000)
        };
      }

      // Award 6000 points
      const pointsToAward = 6000;
      const newBalance = parseFloat(user.balance) + pointsToAward;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          lastClaimedAt: now,
          // Add 20 experience for farming claim
          experience: { increment: 20 }
        }
      });

      // Record transaction
      await prisma.transaction.create({
        data: {
          userId,
          type: 'FARMING_CLAIM',
          amount: pointsToAward,
          balanceBefore: parseFloat(user.balance),
          balanceAfter: newBalance,
          description: 'Daily farming points claim',
          metadata: {
            source: 'farming',
            claimedAt: now.toISOString(),
            hoursElapsed: Math.min(hoursElapsed, 6)
          }
        }
      });

      // Update user level based on new experience
      await this.updateUserLevel(userId);
      
      console.log(`🌾 User ${userId} claimed ${pointsToAward} farming points`);

      return {
        success: true,
        pointsClaimed: pointsToAward,
        newBalance,
        lastClaimedAt: now,
        nextClaimTime: new Date(now.getTime() + 6 * 60 * 60 * 1000)
      };
    } catch (error) {
      console.error('❌ Error claiming farming points:', error);
      return { success: false, error: 'Failed to claim farming points' };
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
  
  // Calculate level based on experience
  calculateLevel(experience) {
    // Level progression: 0-99 XP = Level 1, 100-249 = Level 2, etc.
    // Each level requires more XP than the previous
    if (experience < 100) return 1;
    if (experience < 250) return 2;
    if (experience < 500) return 3;
    if (experience < 1000) return 4;
    if (experience < 2000) return 5;
    if (experience < 3500) return 6;
    if (experience < 5500) return 7;
    if (experience < 8000) return 8;
    if (experience < 11000) return 9;
    if (experience < 15000) return 10;
    
    // After level 10, each level requires 5000 more XP
    return Math.floor(10 + (experience - 15000) / 5000);
  }

  // Update user level based on experience
  async updateUserLevel(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { experience: true, level: true }
      });
      
      if (!user) return;
      
      const newLevel = this.calculateLevel(user.experience);
      if (newLevel !== user.level) {
        await prisma.user.update({
          where: { id: userId },
          data: { level: newLevel }
        });
      }
      
      return newLevel;
    } catch (error) {
      console.error('❌ Error updating user level:', error);
    }
  }

  sanitizeUser(user) {
    if (!user) return null;
    
    const { passwordHash, ...sanitized } = user;
    return {
      ...sanitized,
      balance: parseFloat(sanitized.balance),
      totalWagered: parseFloat(sanitized.totalWagered),
      totalWon: parseFloat(sanitized.totalWon),
      totalLost: parseFloat(sanitized.totalLost),
      biggestWin: parseFloat(sanitized.biggestWin),
      biggestLoss: parseFloat(sanitized.biggestLoss || 0),
      experience: sanitized.experience || 0,
      level: sanitized.level || 1
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
