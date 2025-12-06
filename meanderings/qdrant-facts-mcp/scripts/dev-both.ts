#!/usr/bin/env node

/**
 * Development script to run both HTTP and STDIO transports
 */

import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

let httpServer: ChildProcess | null = null;
let stdioWrapper: ChildProcess | null = null;

function startHttpServer() {
  console.log('🚀 Starting Facts HTTP Server...');
  httpServer = spawn('npx', ['tsx', 'watch', 'http-server/index.ts'], {
    cwd: packageRoot,
    stdio: 'inherit',
    shell: true
  });

  httpServer.on('exit', (code) => {
    console.log(`HTTP Server exited with code ${code}`);
    cleanup();
  });
}

function startStdioWrapper() {
  // Wait 2 seconds for HTTP server to start
  setTimeout(() => {
    console.log('🚀 Starting Facts STDIO Wrapper...');
    stdioWrapper = spawn('npx', ['tsx', 'stdio-wrapper/index.ts'], {
      cwd: packageRoot,
      stdio: 'inherit',
      shell: true
    });

    stdioWrapper.on('exit', (code) => {
      console.log(`STDIO Wrapper exited with code ${code}`);
      cleanup();
    });
  }, 2000);
}

function cleanup() {
  if (httpServer) httpServer.kill();
  if (stdioWrapper) stdioWrapper.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('📦 Starting Qdrant Facts MCP (both transports)...');
startHttpServer();
startStdioWrapper();
