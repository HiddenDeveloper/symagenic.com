/**
 * MCP Client Sampling Capability Detection and Management
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { SamplingConfig } from "../../shared/types.js";

export interface SamplingCapability {
  supported: boolean;
  tested: boolean;
  testResult?: "success" | "timeout" | "not_supported" | "error" | "not_tested";
  lastTested?: Date;
  clientCapabilities?: any;
}

export class SamplingCapabilityDetector {
  private capability: SamplingCapability = {
    supported: false,
    tested: false
  };

  constructor(
    private server: Server,
    private config: SamplingConfig
  ) {}

  /**
   * Test if the MCP client supports sampling during initialization
   */
  async detectCapability(clientCapabilities?: any): Promise<SamplingCapability> {
    console.error("🔍 Detecting MCP client sampling capability...");

    // Store client capabilities for reference
    this.capability.clientCapabilities = clientCapabilities;

    // Check if sampling is disabled in config
    if (!this.config.enabled) {
      console.error("⚙️ Sampling disabled in configuration");
      this.capability = {
        supported: false,
        tested: true,
        testResult: "not_supported",
        lastTested: new Date(),
        clientCapabilities
      };
      return this.capability;
    }

    // Check client capabilities first if provided
    if (clientCapabilities?.sampling !== undefined) {
      console.error("📋 Client advertises sampling capability:", !!clientCapabilities.sampling);
      // For VS Code, trust the advertised capability since the test may fail due to protocol differences
      if (clientCapabilities.sampling && !this.config.testOnStartup) {
        this.capability = {
          supported: true,
          tested: false,
          testResult: "success",
          lastTested: new Date(),
          clientCapabilities
        };
        console.error("✅ Sampling capability detection complete: SUPPORTED (based on client capabilities)");
        return this.capability;
      }
    }

    // Perform runtime test if configured
    if (this.config.testOnStartup) {
      try {
        const testResult = await this.performSamplingTest();
        this.capability = {
          supported: testResult === "success",
          tested: true,
          testResult,
          lastTested: new Date(),
          clientCapabilities
        };
      } catch (error) {
        console.error("❌ Sampling capability test failed:", error);
        this.capability = {
          supported: false,
          tested: true,
          testResult: "error",
          lastTested: new Date(),
          clientCapabilities
        };
      }
    } else {
      // Be conservative - assume NOT supported unless proven otherwise
      this.capability = {
        supported: false,
        tested: false,
        testResult: "not_tested",
        clientCapabilities
      };
    }

    console.error(`✅ Sampling capability detection complete: ${this.capability.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
    return this.capability;
  }

  /**
   * Perform a minimal sampling test to verify client support
   */
  private async performSamplingTest(): Promise<"success" | "timeout" | "not_supported" | "error"> {
    console.error("🧪 Performing minimal sampling test...");

    try {
      const testPromise = this.server.request(
        {
          method: "sampling/createMessage",
          params: {
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: "test"
                }
              }
            ],
            systemPrompt: "Respond with exactly: 'test'",
            temperature: 0,
            maxTokens: 5
          }
        },
        {
          parse: (response: any) => response
        } as any
      );

      // Race against timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Sampling test timeout")), this.config.testTimeoutMs);
      });

      const result = await Promise.race([testPromise, timeoutPromise]);
      
      console.error("✅ Sampling test successful:", result);
      return "success";

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("timeout") || errorMessage.includes("Sampling test timeout")) {
        console.error("⏰ Sampling test timed out");
        return "timeout";
      } else if (errorMessage.includes("not supported") || errorMessage.includes("unknown method")) {
        console.error("🚫 Sampling not supported by client");
        return "not_supported";
      } else {
        console.error("❌ Sampling test error:", errorMessage);
        return "error";
      }
    }
  }

  /**
   * Get current sampling capability status
   */
  getCapability(): SamplingCapability {
    return { ...this.capability };
  }

  /**
   * Check if sampling is supported and should be used
   */
  shouldUseSampling(): boolean {
    return this.capability.supported && this.config.enabled;
  }

  /**
   * Update capability status (for runtime changes)
   */
  updateCapability(capability: Partial<SamplingCapability>): void {
    this.capability = { ...this.capability, ...capability };
  }

  /**
   * Retry capability detection (if enabled in config)
   */
  async retryDetection(): Promise<SamplingCapability> {
    if (this.config.retryOnFailure && !this.capability.supported) {
      console.error("🔄 Retrying sampling capability detection...");
      return this.detectCapability(this.capability.clientCapabilities);
    }
    return this.capability;
  }
}