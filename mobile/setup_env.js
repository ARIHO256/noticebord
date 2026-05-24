#!/usr/bin/env node
/**
 * Setup script to generate .env file for the Bugema NoticeBoard mobile app.
 * 
 * Usage:
 *   node setup_env.js              # Interactive mode
 *   node setup_env.js --auto       # Auto-generate with defaults
 *   node setup_env.js --ip         # Auto-detect local IP
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.1.100';
}

function createEnvFile(options = {}) {
  const envPath = path.join(__dirname, '.env');
  
  if (fs.existsSync(envPath) && !options.auto) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`\n.env file already exists at ${envPath}\nOverwrite? (y/N): `, (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        writeEnvFile(envPath, options);
      } else {
        console.log('Aborted. Existing .env kept.');
      }
    });
    return;
  }
  
  writeEnvFile(envPath, options);
}

function writeEnvFile(envPath, options) {
  const ip = options.ip || getLocalIpAddress();
  const apiUrl = options.apiUrl || `http://${ip}:8000`;
  
  const config = `# =============================================================================
# Bugema University NoticeBoard - Mobile Environment
# =============================================================================
# Generated automatically by setup_env.js
# DO NOT COMMIT THIS FILE TO VERSION CONTROL
# =============================================================================

# Backend API URL
EXPO_PUBLIC_API_URL=${apiUrl}

# API port (fallback)
EXPO_PUBLIC_API_PORT=8000

# Debug mode
EXPO_PUBLIC_DEBUG=1

# App info
EXPO_PUBLIC_APP_VERSION=0.1.0
EXPO_PUBLIC_APP_ENV=development
`;

  fs.writeFileSync(envPath, config);
  
  console.log('\n' + '='.repeat(60));
  console.log('  .env file created at:', envPath);
  console.log('  API URL:', apiUrl);
  console.log('='.repeat(60));
  console.log('\n  IMPORTANT: Make sure your backend is running and');
  console.log('  accessible at:', apiUrl);
  console.log('\n  If using a physical device, ensure your phone');
  console.log('  and computer are on the same WiFi network.');
  console.log('='.repeat(60) + '\n');
}

function validateEnv() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: No .env file found at', envPath);
    console.log('Run: node setup_env.js');
    process.exit(1);
  }
  
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  
  const vars = {};
  for (const line of lines) {
    const match = line.match(/^EXPO_PUBLIC_(\w+)=(.*)$/);
    if (match) {
      vars[match[1]] = match[2];
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('  Mobile Environment Validation');
  console.log('='.repeat(60));
  
  const apiUrl = vars['API_URL'];
  if (!apiUrl) {
    console.log('\n  ERROR: EXPO_PUBLIC_API_URL is not set!');
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
  
  console.log('\n  API_URL:', apiUrl);
  
  if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    console.log('  WARNING: Using localhost - this only works on iOS simulator!');
    console.log('  For Android emulator, use: http://10.0.2.2:8000');
    console.log('  For physical devices, use your computer\'s IP address.');
  }
  
  console.log('\n  All checks passed!');
  console.log('='.repeat(60) + '\n');
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  auto: args.includes('--auto'),
  ip: args.includes('--ip'),
};

if (args.includes('--validate')) {
  validateEnv();
} else {
  createEnvFile(options);
}
