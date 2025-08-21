#!/usr/bin/env node

/**
 * Demo script for the Aviator Crash Game
 * This script demonstrates the game functionality without a full React setup
 */

console.log(`
🛩️  AVIATOR CRASH GAME DEMO
=============================

📱 Mobile-First Design Features:
- Dark theme with gradient sky background
- Animated multiplier display (1.00x → growing)
- Red plane SVG with flight animation
- Interactive bet controls (+/- buttons)
- Color-coded history pills (Blue, Purple, Pink, Gold)
- Bottom navigation with 6 tabs

🎮 Game States:
1. BETTING: Place your bet (BET button)
2. RUNNING: Multiplier growing (CASH OUT button)
3. CRASHED: Round ended (ROUND OVER)

🎨 Visual Effects:
- Smooth CSS transitions (300ms)
- Glow effects on buttons and multiplier
- Pulse animations during flight
- Bounce effect on crash
- Shimmer effect on cash out button

🚀 Tech Stack:
- React 18 (Functional Components)
- TailwindCSS (Utility Classes)
- Vite (Build Tool)
- Custom CSS Animations

📦 Project Structure:
├── App.js (Main layout & game logic)
├── components/
│   ├── MultiplierDisplay.js (Animated multiplier)
│   ├── Plane.js (SVG plane with animations)
│   ├── BetPanel.js (Betting controls)
│   ├── HistoryItem.js (History pills)
│   └── BottomNav.js (Navigation menu)
├── styles.css (Custom animations)
├── tailwind.config.js (Theme configuration)
└── package.json (Dependencies)

To run the application:
1. npm install
2. npm run dev
3. Open http://localhost:3000

The game simulates real crash game mechanics with:
- Random crash points (1.1x to 50x+)
- Real-time multiplier updates (100ms intervals)
- Balance management
- Betting validation
- History tracking

All components are fully responsive and optimized for mobile devices! 📱
`);

// Simulate a quick game round
console.log('\n🎲 Simulating a game round...\n');

let multiplier = 1.00;
let crashed = false;
let interval = 0;

const gameInterval = setInterval(() => {
  multiplier += Math.random() * 0.1 + 0.01;
  
  // Random crash probability increases with multiplier
  if (Math.random() < 0.02 + (multiplier / 100)) {
    crashed = true;
    console.log(`💥 CRASHED at ${multiplier.toFixed(2)}x!`);
    clearInterval(gameInterval);
    
    // Determine history color
    let color = 'Gray';
    if (multiplier >= 100) color = 'Gold';
    else if (multiplier >= 10) color = 'Pink';
    else if (multiplier >= 5) color = 'Purple';
    else if (multiplier >= 2) color = 'Blue';
    
    console.log(`📊 History pill: ${color} ${multiplier.toFixed(2)}x`);
    return;
  }
  
  console.log(`✈️  Flying at ${multiplier.toFixed(2)}x...`);
  interval++;
  
  // Auto-stop demo after 20 intervals
  if (interval > 20) {
    crashed = true;
    console.log(`🎯 Demo ended at ${multiplier.toFixed(2)}x`);
    clearInterval(gameInterval);
  }
}, 200);

process.on('SIGINT', () => {
  console.log('\n👋 Demo ended. Happy coding!');
  process.exit(0);
});
