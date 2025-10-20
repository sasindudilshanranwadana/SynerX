#!/usr/bin/env node

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Detect platform
const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';
const isLinux = os.platform() === 'linux';

// Virtual environment paths
const venvPaths = {
  windows: 'venv\\Scripts\\activate.bat',
  unix: 'venv/bin/activate'
};

// Build uvicorn executable path
const uvicornExec = isWindows
  ? path.join(process.cwd(), 'venv', 'Scripts', 'uvicorn.exe')
  : path.join(process.cwd(), 'venv', 'bin', 'uvicorn');

// Check if virtual environment exists
const venvDir = path.join(process.cwd(), 'venv');
if (!fs.existsSync(venvDir)) {
  console.error('❌ Virtual environment not found! Please create it first:');
  console.error('   python -m venv venv');
  console.error('   Then activate it and install requirements: pip install -r requirements.txt');
  process.exit(1);
}

// Check if uvicorn exists in venv
const uvicornPath = isWindows 
  ? path.join(venvDir, 'Scripts', 'uvicorn.exe')
  : path.join(venvDir, 'bin', 'uvicorn');

if (!fs.existsSync(uvicornPath)) {
  console.error('❌ uvicorn not found in virtual environment!');
  console.error('   Please install it: pip install uvicorn');
  process.exit(1);
}

console.log(`🚀 Starting FastAPI backend server...`);

// Start the backend process
const backendProcess = spawn(uvicornExec, ['main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'], {
  stdio: 'inherit',
  shell: false,
  cwd: process.cwd()
});

// Handle process events
backendProcess.on('error', (error) => {
  console.error('❌ Failed to start backend:', error.message);
  process.exit(1);
});

backendProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Backend process exited with code ${code}`);
    process.exit(code);
  }
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down backend...');
  backendProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down backend...');
  backendProcess.kill('SIGTERM');
  process.exit(0);
});
