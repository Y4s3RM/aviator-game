// Replacement for getAdminStats method
// Copy this into databaseService.js to replace the existing method

async getAdminStats() {
  try {
    console.log('🔧 Getting admin stats...');
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    console.log('📅 Date ranges:', { today, weekAgo });

    // Get basic counts
    console.log('1️⃣ Getting user counts...');
    const totalUsers = await prisma.user.count();
    const activeToday = await prisma.user.count({
      where: { lastLoginAt: { gte: today } }
    });
    const activeThisWeek = await prisma.user.count({
      where: { lastLoginAt: { gte: weekAgo } }
    });

    console.log('2️⃣ Getting game counts...');
    const roundsToday = await prisma.gameRound.count({
      where: { createdAt: { gte: today } }
    });

    console.log('3️⃣ Getting bet statistics...');
    const totalBetsToday = await prisma.bet.count({
      where: { placedAt: { gte: today } }
    });

    // Get unique players today
    const uniquePlayers = await prisma.bet.findMany({
      where: { placedAt: { gte: today } },
      select: { userId: true },
      distinct: ['userId']
    });
    const uniquePlayersToday = uniquePlayers.length;

    console.log('4️⃣ Getting financial stats...');
    // Total wagered today
    const wagerResult = await prisma.bet.aggregate({
      where: { placedAt: { gte: today } },
      _sum: { amount: true }
    });
    const totalWageredToday = wagerResult._sum.amount || 0;

    // Total won today (use CASHED_OUT status)
    const wonResult = await prisma.bet.aggregate({
      where: { 
        placedAt: { gte: today },
        status: 'CASHED_OUT'
      },
      _sum: { payout: true }
    });
    const totalWonToday = wonResult._sum.payout || 0;

    console.log('5️⃣ Getting referral stats...');
    const referralsToday = await prisma.referral.count({
      where: { createdAt: { gte: today } }
    }).catch(err => {
      console.log('No referrals table or error:', err.message);
      return 0;
    });

    const activationsToday = await prisma.referral.count({
      where: {
        activationEventAt: { gte: today },
        referrerRewardStatus: 'PAID'
      }
    }).catch(err => {
      console.log('Referral activation query error:', err.message);
      return 0;
    });

    console.log('6️⃣ Getting average crash point...');
    const avgCrashResult = await prisma.gameRound.aggregate({
      where: {
        createdAt: { gte: today },
        status: 'CRASHED'
      },
      _avg: { crashPoint: true }
    });
    const avgCrashToday = avgCrashResult._avg.crashPoint || 0;

    // Calculate derived metrics
    const houseEdgeToday = totalWageredToday - totalWonToday;

    console.log('✅ All queries completed successfully');
    console.log('📊 Stats summary:', {
      totalUsers,
      activeToday,
      roundsToday,
      totalBetsToday,
      uniquePlayersToday,
      totalWageredToday,
      totalWonToday
    });

    return {
      users: {
        total: totalUsers,
        activeToday,
        activeThisWeek,
        percentActiveToday: totalUsers > 0 ? ((activeToday / totalUsers) * 100).toFixed(1) : 0
      },
      gameplay: {
        roundsToday,
        betsToday: totalBetsToday,
        uniquePlayersToday,
        avgBetsPerPlayer: uniquePlayersToday > 0 ? (totalBetsToday / uniquePlayersToday).toFixed(1) : 0,
        avgCrashToday: parseFloat(avgCrashToday).toFixed(2)
      },
      economy: {
        totalWageredToday: parseFloat(totalWageredToday).toFixed(0),
        totalWonToday: parseFloat(totalWonToday).toFixed(0),
        houseEdgeToday: parseFloat(houseEdgeToday).toFixed(0),
        houseEdgePercent: totalWageredToday > 0 ? ((houseEdgeToday / totalWageredToday) * 100).toFixed(1) : 0
      },
      referrals: {
        newToday: referralsToday,
        activatedToday: activationsToday,
        conversionRate: referralsToday > 0 ? ((activationsToday / referralsToday) * 100).toFixed(1) : 0
      }
    };

  } catch (error) {
    console.error('❌ Error getting admin stats:', error);
    throw error;
  }
}

