import fs from 'fs';
import path from 'path';

// Update version.json with current timestamp
const versionFile = path.join(process.cwd(), 'public', 'version.json');
const version = {
  version: process.env.npm_package_version || '1.0.0',
  buildTime: new Date().toISOString(),
  commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local'
};

fs.writeFileSync(versionFile, JSON.stringify(version, null, 2));
console.log('✅ Updated version.json:', version);
