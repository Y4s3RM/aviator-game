// Test script for debugging player settings
// Run this in your browser console after logging into the game

console.log('🔍 Testing Player Settings Endpoint...');

// Get the token - it's stored as 'auth_token'
const token = localStorage.getItem('auth_token');
const user = localStorage.getItem('user');

console.log('\n📱 Local Storage Contents:');
console.log('Token key "auth_token":', token ? token.substring(0, 20) + '...' : 'NOT FOUND');
console.log('User data:', user);

// Also check all localStorage keys
console.log('\n🔑 All localStorage keys:', Object.keys(localStorage));

if (!token) {
  console.error('\n❌ No token found! Please make sure you are logged in.');
  console.log('Looking for token in all localStorage keys...');
  Object.keys(localStorage).forEach(key => {
    if (key.toLowerCase().includes('token')) {
      console.log(`Found potential token key: ${key} = ${localStorage.getItem(key)?.substring(0, 20)}...`);
    }
  });
} else {
  console.log('\n✅ Token found!');
  
  // Test the debug probe
  console.log('\n📡 Testing PUT /api/player/settings...');
  fetch('https://aviator-game-production.up.railway.app/api/player/settings', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ 
      autoCashoutEnabled: true, 
      autoCashoutMultiplier: 2.5,
      soundEnabled: false 
    })
  })
  .then(r => {
    console.log('Response status:', r.status);
    console.log('Response headers:', Object.fromEntries(r.headers.entries()));
    return r.json();
  })
  .then(data => {
    console.log('✅ Response data:', data);
    
    if (data.debug && data.seenUserId) {
      console.log('\n🎯 SUCCESS! The endpoint is working!');
      console.log('User ID seen by server:', data.seenUserId);
      console.log('Request body echoed back:', data.echoed);
    } else {
      console.log('\n⚠️  Unexpected response format');
    }
  })
  .catch(err => {
    console.error('❌ Request failed:', err);
  });
  
  // Also test GET
  console.log('\n📡 Testing GET /api/player/settings...');
  fetch('https://aviator-game-production.up.railway.app/api/player/settings', {
    headers: { 
      'Authorization': `Bearer ${token}` 
    }
  })
  .then(r => r.json())
  .then(data => {
    console.log('GET Response:', data);
  })
  .catch(err => {
    console.error('GET failed:', err);
  });
}

// Try to access authService through window or other globals
console.log('\n🔐 Checking for auth service in global scope:');
console.log('window.authService:', window.authService);
console.log('window.auth:', window.auth);
console.log('globalThis.authService:', globalThis.authService);

// Alternative: Try to decode the token to see user info
if (token) {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      console.log('\n🔓 Decoded token payload:', payload);
    }
  } catch (e) {
    console.log('Could not decode token');
  }
}