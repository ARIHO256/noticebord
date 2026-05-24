#!/usr/bin/env node
/**
 * Network setup helper for Bugema NoticeBoard mobile app.
 * 
 * This script auto-detects the best IP address for connecting
 * a phone to the backend when:
 * - Phone and laptop are on same WiFi
 * - Phone is hotspotting the laptop
 * - Using Android emulator or iOS simulator
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const results = [];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        results.push({
          name,
          address: addr.address,
          netmask: addr.netmask,
          cidr: addr.cidr,
        });
      }
    }
  }
  return results;
}

function guessBestInterface(interfaces) {
  // Priority order for interface selection
  const priority = [
    /wl/i,      // WiFi (wireless) - most common for hotspot
    /en/i,      // Ethernet (macOS)
    /eth/i,     // Ethernet (Linux)
    /wi-fi/i,   // WiFi (Windows)
    /wlan/i,    // WLAN (Linux)
  ];
  
  for (const pattern of priority) {
    const match = interfaces.find(i => pattern.test(i.name));
    if (match) return match;
  }
  
  // Fallback: return first non-Docker interface
  return interfaces.find(i => !i.name.includes('docker') && !i.name.includes('br-'));
}

function isLikelyHotspotScenario() {
  const interfaces = getNetworkInterfaces();
  
  // Check if we have a wireless interface with a 192.168.x.x IP
  // This is typical for mobile hotspots
  const wifiInterface = interfaces.find(i => 
    /wl|wi-fi|wlan/i.test(i.name) && 
    i.address.startsWith('192.168.')
  );
  
  return !!wifiInterface;
}

function updateEnvFile(apiUrl) {
  const envPath = path.join(__dirname, '.env');
  let content = '';
  
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add EXPO_PUBLIC_API_URL
  const urlLine = `EXPO_PUBLIC_API_URL=${apiUrl}`;
  
  if (content.includes('EXPO_PUBLIC_API_URL=')) {
    content = content.replace(/EXPO_PUBLIC_API_URL=.*/g, urlLine);
  } else {
    content += `\n${urlLine}\n`;
  }
  
  fs.writeFileSync(envPath, content.trim() + '\n');
  return envPath;
}

function printBox(title, lines, color = '\x1b[36m') {
  const width = Math.max(title.length, ...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(width);
  const reset = '\x1b[0m';
  
  console.log(`\n${color}╔${border}╗${reset}`);
  console.log(`${color}║${' '.repeat(width)}║${reset}`);
  console.log(`${color}║  ${title.padEnd(width - 4)}  ║${reset}`);
  console.log(`${color}║${' '.repeat(width)}║${reset}`);
  for (const line of lines) {
    console.log(`${color}║  ${line.padEnd(width - 4)}  ║${reset}`);
  }
  console.log(`${color}║${' '.repeat(width)}║${reset}`);
  console.log(`${color}╚${border}╝${reset}\n`);
}

function main() {
  const interfaces = getNetworkInterfaces();
  const best = guessBestInterface(interfaces);
  const isHotspot = isLikelyHotspotScenario();
  
  console.clear();
  console.log('\n  🔧 Bugema NoticeBoard - Network Setup\n');
  
  if (interfaces.length === 0) {
    console.error('  ❌ No network interfaces found!');
    console.error('  Make sure you are connected to a network.\n');
    process.exit(1);
  }
  
  console.log('  Available network interfaces:\n');
  interfaces.forEach((iface, i) => {
    const marker = (iface === best) ? '  ✅' : '    ';
    const hotspotHint = (iface === best && isHotspot) ? ' ← likely your hotspot' : '';
    console.log(`${marker} [${i + 1}] ${iface.name.padEnd(12)} → ${iface.address}${hotspotHint}`);
  });
  
  console.log('');
  
  if (best) {
    const apiUrl = `http://${best.address}:8000`;
    const envPath = updateEnvFile(apiUrl);
    
    if (isHotspot) {
      printBox(
        'HOTSPOT DETECTED!',
        [
          'Your phone is likely the hotspot.',
          '',
          `Laptop IP: ${best.address}`,
          `API URL:   ${apiUrl}`,
          '',
          '✅ .env file updated automatically!',
        ],
        '\x1b[32m'
      );
      
      console.log('  📋 Next steps:\n');
      console.log('  1. Start the backend with network access:');
      console.log(`     cd backend && source .venv/bin/activate`);
      console.log(`     python manage.py runserver 0.0.0.0:8000\n`);
      console.log('  2. Start Expo:');
      console.log(`     cd mobile && npx expo start --clear\n`);
      console.log('  3. Scan the QR code with your phone\n');
      
    } else {
      printBox(
        'NETWORK CONFIGURED',
        [
          `Using interface: ${best.name}`,
          `IP Address:      ${best.address}`,
          `API URL:         ${apiUrl}`,
          '',
          '✅ .env file updated!',
        ],
        '\x1b[36m'
      );
    }
    
    console.log(`  📁 Updated: ${envPath}\n`);
    
  } else {
    console.error('  ❌ Could not determine best network interface.\n');
    process.exit(1);
  }
}

main();
