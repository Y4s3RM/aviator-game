// Test script for Telegram Mini App context
console.log('🔍 Testing Telegram Mini App Authentication...');

// Check if we're in Telegram context
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  console.log('\n✅ Telegram WebApp detected!');
  console.log('Platform:', tg.platform);
  console.log('Version:', tg.version);
  console.log('Init Data:', tg.initData);
  console.log('Init Data Unsafe:', tg.initDataUnsafe);
  
  if (tg.initDataUnsafe?.user) {
    console.log('\n👤 Telegram User:');
    console.log('ID:', tg.initDataUnsafe.user.id);
    console.log('Username:', tg.initDataUnsafe.user.username);
    console.log('First Name:', tg.initDataUnsafe.user.first_name);
  }
  
  // Try to find auth data in the game's iframe or context
  console.log('\n🔍 Looking for game authentication...');
  
  // Check if the game stores auth differently in Telegram context
  const gameFrame = document.querySelector('iframe');
  if (gameFrame) {
    console.log('Found game iframe:', gameFrame.src);
    // Can't access iframe localStorage due to same-origin policy
  }
  
  // Try manual API call with Telegram init data
  console.log('\n📡 Attempting direct API call with Telegram auth...');
  
  // First, let's try to authenticate with the backend using Telegram data
  const authData = {
    id: tg.initDataUnsafe?.user?.id,
    first_name: tg.initDataUnsafe?.user?.first_name,
    last_name: tg.initDataUnsafe?.user?.last_name,
    username: tg.initDataUnsafe?.user?.username,
    language_code: tg.initDataUnsafe?.user?.language_code,
    allows_write_to_pm: tg.initDataUnsafe?.user?.allows_write_to_pm
  };
  
  console.log('Auth data to send:', authData);
  
  // Try to authenticate first
  fetch('https://aviator-game-production.up.railway.app/api/auth/telegram', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user: authData,
      initData: tg.initData
    })
  })
  .then(r => r.json())
  .then(authResult => {
    console.log('\n🔐 Auth response:', authResult);
    
    if (authResult.token) {
      console.log('✅ Got token! Testing settings endpoint...');
      
      // Now test the settings endpoint with the token
      return fetch('https://aviator-game-production.up.railway.app/api/player/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${authResult.token}` 
        },
        body: JSON.stringify({ 
          autoCashoutEnabled: true, 
          autoCashoutMultiplier: 2.5,
          soundEnabled: false 
        })
      })
      .then(r => r.json())
      .then(settingsResult => {
        console.log('\n📥 Settings endpoint response:', settingsResult);
      });
    }
  })
  .catch(err => {
    console.error('❌ Error:', err);
  });
  
} else {
  console.log('❌ Not in Telegram WebApp context');
  console.log('This test must be run inside Telegram Mini App');
}

// Also check for any game-specific storage
console.log('\n💾 Checking all storage mechanisms:');
console.log('localStorage keys:', Object.keys(localStorage));
console.log('sessionStorage keys:', Object.keys(sessionStorage));

// Try to find the game's context
if (window.frames.length > 0) {
  console.log('Found', window.frames.length, 'iframe(s)');
  // Note: Can't access iframe content due to security restrictions
}
