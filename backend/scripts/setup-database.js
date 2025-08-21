#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Aviator Game Database...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  const envExamplePath = path.join(__dirname, '..', 'env.example');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created');
  console.log('⚠️  Please update DATABASE_URL and other secrets in .env file\n');
}

try {
  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Prisma client generated\n');
  
  console.log('🗄️  Running database migrations...');
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Database migrations completed\n');
  
  console.log('🌱 Seeding database with initial data...');
  execSync('node scripts/seed-database.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Database seeded\n');
  
  console.log('🎉 Database setup completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Update your .env file with correct database credentials');
  console.log('2. Run "npm start" to start the server');
  console.log('3. The game will now use PostgreSQL instead of file-based storage');
  
} catch (error) {
  console.error('❌ Database setup failed:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Make sure PostgreSQL is running');
  console.log('2. Check your DATABASE_URL in .env file');
  console.log('3. Ensure the database exists and is accessible');
  process.exit(1);
}
