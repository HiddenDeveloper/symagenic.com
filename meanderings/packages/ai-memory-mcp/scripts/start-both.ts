#!/usr/bin/env node

/**
 * Start both Memory HTTP server and STDIO wrapper
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__dirname));

async function startBoth() {
  console.log('🧠 Starting Memory dual-transport system...');
  
  // Start HTTP server
  console.log('📡 Starting Memory HTTP server...');
  const httpProcess = spawn(process.execPath, [join(projectRoot, 'dist', 'http-server', 'index.js')], {
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
      
      if (output.includes('Memory HTTP Server listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    httpProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(`[HTTP] ${output}`);
      
      if (output.includes('Memory HTTP Server listening')) {
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

  console.log('✅ Memory HTTP server started');
  console.log('🔄 Starting Memory STDIO wrapper...');

  // Start STDIO wrapper
  const stdioProcess = spawn(process.execPath, [join(projectRoot, 'dist', 'stdio-wrapper', 'index.js')], {
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
    console.log('\n🛑 Shutting down Memory dual-transport system...');
    
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
  console.error('💥 Failed to start Memory dual-transport system:', error);
  process.exit(1);
});