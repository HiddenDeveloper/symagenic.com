#!/usr/bin/env node

import { spawn, ChildProcess } from "child_process";
import { join } from "path";

class ServiceManager {
  private httpServer?: ChildProcess;
  private stdioWrapper?: ChildProcess;
  private isShuttingDown = false;

  async start(): Promise<void> {
    console.log("🚀 Starting AI Mesh MCP Server (both HTTP and STDIO)...");
    console.log("");

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    try {
      // Start HTTP server first (required dependency)
      await this.startHttpServer();
      
      // Wait a bit for HTTP server to fully initialize
      await this.sleep(2000);
      
      // Start STDIO wrapper
      await this.startStdioWrapper();
      
      console.log("");
      console.log("✅ Both services are running!");
      console.log("");
      console.log("📋 Service Status:");
      console.log("   • HTTP Server: ✅ Running on port 3001");
      console.log("   • STDIO Wrapper: ✅ Running");
      console.log("");
      console.log("🔗 HTTP Endpoints:");
      console.log("   • http://localhost:3001/");
      console.log("   • http://localhost:3001/health");
      console.log("   • http://localhost:3001/docs");
      console.log("");
      console.log("🛠️  MCP Tools Available:");
      console.log("   • mesh-broadcast, mesh-query, mesh-respond, mesh-status");
      console.log("");
      console.log("Press Ctrl+C to stop both services");
      
      // Keep the process alive
      await this.waitForShutdown();
      
    } catch (error) {
      console.error("❌ Failed to start services:", error);
      await this.shutdown();
      process.exit(1);
    }
  }

  private async startHttpServer(): Promise<void> {
    console.log("🌐 Starting HTTP Server...");
    
    return new Promise((resolve, reject) => {
      const httpServerPath = join(process.cwd(), "src", "http-server", "index.ts");
      
      this.httpServer = spawn("tsx", [httpServerPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env }
      });

      let httpReady = false;

      this.httpServer.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.log(`[HTTP] ${output.trim()}`);
        
        // Check if server is ready
        if (output.includes("AI Mesh HTTP Server is ready") && !httpReady) {
          httpReady = true;
          resolve();
        }
      });

      this.httpServer.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.error(`[HTTP] ${output.trim()}`);
      });

      this.httpServer.on("error", (error) => {
        console.error("HTTP Server error:", error);
        reject(error);
      });

      this.httpServer.on("exit", (code, signal) => {
        if (!this.isShuttingDown) {
          console.error(`HTTP Server exited unexpectedly (code: ${code}, signal: ${signal})`);
          reject(new Error(`HTTP Server exited with code ${code}`));
        }
      });

      // Timeout if server doesn't start within 30 seconds
      setTimeout(() => {
        if (!httpReady) {
          reject(new Error("HTTP Server startup timeout"));
        }
      }, 30000);
    });
  }

  private async startStdioWrapper(): Promise<void> {
    console.log("🔌 Starting STDIO Wrapper...");
    
    return new Promise((resolve, reject) => {
      const stdioWrapperPath = join(process.cwd(), "src", "stdio-wrapper", "index.ts");
      
      this.stdioWrapper = spawn("tsx", [stdioWrapperPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env }
      });

      let stdioReady = false;

      this.stdioWrapper.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.log(`[STDIO] ${output.trim()}`);
      });

      this.stdioWrapper.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.error(`[STDIO] ${output.trim()}`);
        
        // Check if wrapper is ready
        if (output.includes("AI Mesh STDIO Wrapper is ready") && !stdioReady) {
          stdioReady = true;
          resolve();
        }
      });

      this.stdioWrapper.on("error", (error) => {
        console.error("STDIO Wrapper error:", error);
        reject(error);
      });

      this.stdioWrapper.on("exit", (code, signal) => {
        if (!this.isShuttingDown) {
          console.error(`STDIO Wrapper exited unexpectedly (code: ${code}, signal: ${signal})`);
          reject(new Error(`STDIO Wrapper exited with code ${code}`));
        }
      });

      // Timeout if wrapper doesn't start within 15 seconds
      setTimeout(() => {
        if (!stdioReady) {
          reject(new Error("STDIO Wrapper startup timeout"));
        }
      }, 15000);
    });
  }

  private setupGracefulShutdown(): void {
    const signals = ["SIGTERM", "SIGINT"];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n📴 Received ${signal}, shutting down services...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on("uncaughtException", async (error) => {
      console.error("Uncaught Exception:", error);
      await this.shutdown();
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    console.log("🛑 Shutting down services...");

    const shutdownPromises: Promise<void>[] = [];

    // Shutdown STDIO wrapper first
    if (this.stdioWrapper && !this.stdioWrapper.killed) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          this.stdioWrapper!.on("exit", () => {
            console.log("📴 STDIO Wrapper stopped");
            resolve();
          });
          this.stdioWrapper!.kill("SIGTERM");
          
          // Force kill after 5 seconds
          setTimeout(() => {
            if (!this.stdioWrapper!.killed) {
              this.stdioWrapper!.kill("SIGKILL");
              resolve();
            }
          }, 5000);
        })
      );
    }

    // Shutdown HTTP server
    if (this.httpServer && !this.httpServer.killed) {
      shutdownPromises.push(
        new Promise<void>((resolve) => {
          this.httpServer!.on("exit", () => {
            console.log("📴 HTTP Server stopped");
            resolve();
          });
          this.httpServer!.kill("SIGTERM");
          
          // Force kill after 10 seconds
          setTimeout(() => {
            if (!this.httpServer!.killed) {
              this.httpServer!.kill("SIGKILL");
              resolve();
            }
          }, 10000);
        })
      );
    }

    // Wait for all services to shutdown
    await Promise.all(shutdownPromises);
    console.log("✅ All services stopped gracefully");
  }

  private async waitForShutdown(): Promise<void> {
    return new Promise(() => {
      // Keep process alive until shutdown
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const manager = new ServiceManager();
  await manager.start();
}

main().catch((error) => {
  console.error("Failed to start services:", error);
  process.exit(1);
});