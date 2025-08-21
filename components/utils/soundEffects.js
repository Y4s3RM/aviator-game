// 🔊 Sound Effects Utility for Aviator Game
// Uses Web Audio API to generate sound effects programmatically

class SoundEffects {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.volume = 0.3;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.enabled = false;
    }
  }

  // Resume audio context (required for user interaction)
  async resumeContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Generate a beep sound
  playBeep(frequency = 440, duration = 0.2, type = 'sine') {
    if (!this.enabled || !this.audioContext) return;

    this.resumeContext();

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Bet placed sound - positive chirp
  playBetSound() {
    this.playBeep(600, 0.15, 'sine');
    setTimeout(() => this.playBeep(800, 0.1, 'sine'), 100);
  }

  // Cashout sound - success chime
  playCashoutSound() {
    this.playBeep(800, 0.2, 'sine');
    setTimeout(() => this.playBeep(1000, 0.15, 'sine'), 150);
    setTimeout(() => this.playBeep(1200, 0.1, 'sine'), 250);
  }

  // Engine sound - low rumble during flight
  playEngineSound(intensity = 1) {
    if (!this.enabled || !this.audioContext) return;

    this.resumeContext();

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Low frequency rumble
    oscillator.frequency.setValueAtTime(60 + (intensity * 40), this.audioContext.currentTime);
    oscillator.type = 'sawtooth';

    // Low-pass filter for muffled engine sound
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200 + (intensity * 100), this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.3 * intensity, this.audioContext.currentTime + 0.1);

    oscillator.start(this.audioContext.currentTime);
    
    // Return stop function
    return () => {
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      oscillator.stop(this.audioContext.currentTime + 0.3);
    };
  }

  // Crash sound - dramatic descending tone
  playCrashSound() {
    if (!this.enabled || !this.audioContext) return;

    this.resumeContext();

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.8);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.5, this.audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.8);
  }

  // Countdown beep
  playCountdownBeep() {
    this.playBeep(400, 0.1, 'square');
  }

  // Final countdown beep (different pitch)
  playFinalCountdownBeep() {
    this.playBeep(600, 0.15, 'square');
  }

  // Auto-cashout sound - robotic beep
  playAutoCashoutSound() {
    this.playBeep(500, 0.1, 'square');
    setTimeout(() => this.playBeep(700, 0.1, 'square'), 100);
    setTimeout(() => this.playBeep(900, 0.1, 'square'), 200);
  }

  // Toggle sound on/off
  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Set volume (0-1)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

// Create singleton instance
const soundEffects = new SoundEffects();

export default soundEffects;
