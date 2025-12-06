#!/usr/bin/env node

/**
 * Start both Ailumina Bridge HTTP server and STDIO wrapper
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// When running from dist/scripts/, go up two levels to reach project root
const projectRoot = __dirname.includes('/dist/') ? dirname(dirname(__dirname)) : dirname(__dirname);

async function startBoth() {
  console.log('🌐 Starting Ailumina Bridge dual-transport system...');
  
  // Start HTTP server
  console.log('📡 Starting Ailumina Bridge HTTP server...');
  const isDev = process.env.NODE_ENV !== 'production';
  const httpCommand = isDev ? 'tsx' : 'node';
  const httpScript = isDev ? 'http-server/index.ts' : 'dist/http-server/index.js';
  
  const httpProcess = spawn(httpCommand, [httpScript], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  // Wait for HTTP server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('HTTP server failed to start within 10 seconds'));
    }, 10000);

    httpProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(`[HTTP] ${output}`);
      
      if (output.includes('Ailumina Bridge HTTP Server listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    httpProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(`[HTTP] ${output}`);
      
      if (output.includes('Ailumina Bridge HTTP Server listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    httpProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    httpProcess.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`HTTP server exited with code ${code}`));
      }
    });
  });

  console.log('✅ Ailumina Bridge HTTP server started');
  console.log('🔄 Starting Ailumina Bridge STDIO wrapper...');

  // Start STDIO wrapper
  const stdioCommand = isDev ? 'tsx' : 'node';
  const stdioScript = isDev ? 'stdio-wrapper/index.ts' : 'dist/stdio-wrapper/index.js';
  
  const stdioProcess = spawn(stdioCommand, [stdioScript], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  stdioProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[STDIO] ${data}`);
  });

  stdioProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[STDIO] ${data}`);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down Ailumina Bridge dual-transport system...');
    
    httpProcess.kill('SIGTERM');
    stdioProcess.kill('SIGTERM');
    
    setTimeout(() => {
      httpProcess.kill('SIGKILL');
      stdioProcess.kill('SIGKILL');
      process.exit(0);
    }, 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Wait for both processes
  await Promise.all([
    new Promise((resolve) => httpProcess.on('exit', resolve)),
    new Promise((resolve) => stdioProcess.on('exit', resolve))
  ]);
}

startBoth().catch((error) => {
  console.error('💥 Failed to start Ailumina Bridge dual-transport system:', error);
  process.exit(1);
});