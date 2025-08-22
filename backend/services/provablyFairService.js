const crypto = require('crypto');

class ProvablyFairService {
  constructor() {
    this.serverSeedLength = parseInt(process.env.SERVER_SEED_LENGTH) || 64;
    this.clientSeedLength = parseInt(process.env.CLIENT_SEED_LENGTH) || 32;
    this.houseEdge = parseFloat(process.env.HOUSE_EDGE) || 0.01;
  }
  
  /**
   * Generate a cryptographically secure server seed
   */
  generateServerSeed() {
    return crypto.randomBytes(this.serverSeedLength / 2).toString('hex');
  }
  
  /**
   * Generate hash of server seed (revealed before round starts)
   */
  hashServerSeed(serverSeed) {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }
  
  /**
   * Generate a client seed (can be provided by players or auto-generated)
   */
  generateClientSeed() {
    return crypto.randomBytes(this.clientSeedLength / 2).toString('hex');
  }
  
  /**
   * Calculate crash point using provably fair algorithm
   * This uses the industry-standard method used by many crash games
   */
  calculateCrashPoint(serverSeed, clientSeed, nonce = 0) {
    // Create HMAC hash using server seed as key and client seed + nonce as message
    const message = `${clientSeed}:${nonce}`;
    const hash = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
    
    // Take first 8 characters and convert to integer
    const hex = hash.substring(0, 8);
    const intValue = parseInt(hex, 16);
    
    // Calculate crash point with house edge
    // This ensures the house edge while maintaining fairness
    const crashPoint = this.calculateMultiplierFromHash(intValue);
    
    return Math.max(1.00, crashPoint);
  }
  
  /**
   * Convert hash integer to crash multiplier
   * Uses the standard algorithm that ensures proper distribution
   */
  calculateMultiplierFromHash(intValue) {
    // Maximum value for 8 hex characters
    const maxValue = 0xFFFFFFFF;
    
    // Calculate the probability (0 to 1)
    const probability = intValue / maxValue;
    
    // Apply house edge
    const adjustedProbability = probability * (1 - this.houseEdge);
    
    // Convert to crash multiplier using exponential distribution
    // This creates the characteristic crash game distribution
    if (adjustedProbability === 0) {
      return 1.00;
    }
    
    const crashPoint = 1 / adjustedProbability;
    
    // Cap at reasonable maximum (1000x)
    return Math.min(crashPoint, 1000);
  }
  
  /**
   * Verify a crash point calculation
   * Players can use this to verify game fairness
   */
  verifyCrashPoint(serverSeed, clientSeed, nonce, expectedCrashPoint) {
    const calculatedCrashPoint = this.calculateCrashPoint(serverSeed, clientSeed, nonce);
    const tolerance = 0.01; // Allow small floating point differences
    
    return Math.abs(calculatedCrashPoint - expectedCrashPoint) < tolerance;
  }
  
  /**
   * Generate a complete provably fair round
   */
  generateFairRound(clientSeed = null, nonce = 0) {
    const serverSeed = this.generateServerSeed();
    const serverSeedHash = this.hashServerSeed(serverSeed);
    const finalClientSeed = clientSeed || this.generateClientSeed();
    
    const crashPoint = this.calculateCrashPoint(serverSeed, finalClientSeed, nonce);
    
    return {
      serverSeed,
      serverSeedHash,
      clientSeed: finalClientSeed,
      nonce,
      crashPoint: parseFloat(crashPoint.toFixed(2))
    };
  }
  
  /**
   * Create verification data for players
   */
  createVerificationData(serverSeed, clientSeed, nonce, crashPoint) {
    return {
      serverSeed,
      clientSeed,
      nonce,
      crashPoint,
      verification: {
        serverSeedHash: this.hashServerSeed(serverSeed),
        isValid: this.verifyCrashPoint(serverSeed, clientSeed, nonce, crashPoint),
        algorithm: 'HMAC-SHA256',
        houseEdge: this.houseEdge
      }
    };
  }
  
  /**
   * Generate crash points using pure provably fair algorithm
   * NO MANIPULATION - uses only cryptographic randomness
   */
  generateRealisticCrashPoint() {
    const fairRound = this.generateFairRound();
    
    // Return the pure provably fair result - NO MANIPULATION
    // The natural distribution from the algorithm already provides
    // a good mix of multipliers based on mathematical probability
    return fairRound;
  }
  
  /**
   * Get statistics about crash point distribution
   */
  getDistributionStats(crashPoints) {
    const total = crashPoints.length;
    if (total === 0) return {};
    
    const sorted = [...crashPoints].sort((a, b) => a - b);
    const sum = crashPoints.reduce((acc, val) => acc + val, 0);
    
    return {
      total,
      average: parseFloat((sum / total).toFixed(2)),
      median: sorted[Math.floor(total / 2)],
      min: sorted[0],
      max: sorted[total - 1],
      distribution: {
        under2x: crashPoints.filter(x => x < 2).length / total * 100,
        under5x: crashPoints.filter(x => x < 5).length / total * 100,
        under10x: crashPoints.filter(x => x < 10).length / total * 100,
        over10x: crashPoints.filter(x => x >= 10).length / total * 100,
        over50x: crashPoints.filter(x => x >= 50).length / total * 100,
        over100x: crashPoints.filter(x => x >= 100).length / total * 100
      }
    };
  }
}

module.exports = new ProvablyFairService();
