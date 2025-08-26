#!/usr/bin/env node

import crypto from 'crypto';

console.log('\n🔐 Generating secure secrets for deployment...\n');

// Generate secure random strings
const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');
const adminRegKey = crypto.randomBytes(32).toString('hex');

console.log('Copy these to your Railway environment variables:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
console.log(`ADMIN_REGISTRATION_KEY=${adminRegKey}`);

console.log('\n⚠️  Keep these secret and never commit them to git!');
console.log('💡 Each environment (dev/staging/prod) should have different secrets.\n');
