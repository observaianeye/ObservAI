#!/usr/bin/env node
/**
 * Cross-platform Python backend starter
 * Handles Windows and Unix path differences for venv
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const projectRoot = path.join(__dirname, '../../packages/camera-analytics');

// Cross-platform venv Python path
const venvPython = path.join(
  projectRoot,
  '.venv',
  isWindows ? 'Scripts' : 'bin',
  isWindows ? 'python.exe' : 'python'
);

// Build command arguments
const args = [
  '-m',
  'camera_analytics.run_with_websocket',
  '--source', '0',
  '--ws-port', '5001'
];

console.log(`[Python Backend] Starting with: ${venvPython}`);
console.log(`[Python Backend] Args: ${args.join(' ')}`);

// Spawn Python process
const pythonProcess = spawn(venvPython, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PYTHONUNBUFFERED: '1'
  }
});

pythonProcess.on('error', (error) => {
  console.error(`[Python Backend] Failed to start: ${error.message}`);
  console.error(`[Python Backend] Make sure virtual environment exists at: ${path.join(projectRoot, '.venv')}`);
  process.exit(1);
});

pythonProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[Python Backend] Process exited with code ${code}`);
    process.exit(code);
  }
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  pythonProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  pythonProcess.kill('SIGTERM');
  process.exit(0);
});




