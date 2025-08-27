// 🚀 Fred's Low-Spec Device Detector
// Auto-detects weak devices using hardware metrics and probes

export function detectLowSpec() {
  try {
    // Hardware metrics (not available on all browsers/devices)
    const mem = navigator.deviceMemory || 1;            // 0.5–8 GB (not on iOS)
    const cores = navigator.hardwareConcurrency || 2;   // ~1–8 cores
    const ua = (navigator.userAgent || '').toLowerCase();
    
    // Context detection
    const isTelegram = typeof window.Telegram !== 'undefined';
    const isOldAndroidWebView = ua.includes('android') && /chrome\/(5[0-9]|6[0-6])/.test(ua); // Chrome 50-66
    const isLowEndDevice = ua.includes('android') && (
      ua.includes('android 4') || 
      ua.includes('android 5') || 
      ua.includes('android 6') ||
      ua.includes('sm-j') ||      // Samsung Galaxy J series (budget)
      ua.includes('sm-a0') ||     // Samsung Galaxy A0x series (budget) 
      ua.includes('redmi')        // Xiaomi Redmi series (budget)
    );
    
    // Hardware thresholds
    const smallRam = mem <= 2;   // ≤2GB RAM
    const fewCores = cores <= 4; // ≤4 CPU cores
    
    // Performance probe: micro busy-loop to test CPU responsiveness
    const t0 = performance.now();
    while (performance.now() - t0 < 12) {} // 12ms busy-loop probe
    const busyProbe = (performance.now() - t0) > 10; // Should complete in <10ms on good devices
    
    // Screen size heuristic (small screens often = budget devices)
    const smallScreen = (window.screen.width || 999) < 400 || (window.screen.height || 999) < 600;
    
    console.log('📱 Device Detection Results:', {
      deviceMemory: mem,
      hardwareConcurrency: cores,
      isTelegram,
      isOldAndroidWebView,
      isLowEndDevice,
      smallRam,
      fewCores,
      busyProbe,
      smallScreen,
      userAgent: ua.substring(0, 100) + '...'
    });
    
    // Decision logic: conservative approach (better to optimize unnecessarily than lag)
    const shouldUseLowSpec = (
      isTelegram ||           // Telegram WebView is often constrained
      smallRam ||             // Low memory devices
      fewCores ||             // Limited CPU cores
      isOldAndroidWebView ||  // Old Chrome WebView
      isLowEndDevice ||       // Known budget device models
      busyProbe ||            // Failed responsiveness test
      smallScreen             // Small screen heuristic
    );
    
    console.log(`🎯 Low-spec mode decision: ${shouldUseLowSpec ? 'ENABLED' : 'DISABLED'}`);
    
    return shouldUseLowSpec;
  } catch (error) {
    console.error('❌ Error in low-spec detection:', error);
    // Be conservative: if detection fails, assume low-spec
    return true;
  }
}

// Export additional device info for debugging
export function getDeviceInfo() {
  try {
    return {
      userAgent: navigator.userAgent || 'unknown',
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      platform: navigator.platform || 'unknown',
      screenWidth: window.screen.width || 'unknown',
      screenHeight: window.screen.height || 'unknown',
      pixelRatio: window.devicePixelRatio || 1,
      isTelegram: typeof window.Telegram !== 'undefined',
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : 'unknown'
    };
  } catch (error) {
    return { error: error.message };
  }
}
