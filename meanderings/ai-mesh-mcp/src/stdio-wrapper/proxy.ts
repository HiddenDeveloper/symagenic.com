import type { StdioWrapperSettings } from "./config/settings.js";

export class HttpProxy {
  private settings: StdioWrapperSettings;
  private baseURL: string;
  private headers: Record<string, string>;
  private sessionId?: string;

  constructor(settings: StdioWrapperSettings) {
    this.settings = settings;
    this.baseURL = settings.httpServer.url;

    // Set up default headers
    this.headers = {
      "Content-Type": "application/json",
      "User-Agent": "ai-mesh-stdio-wrapper/1.0.0"
    };

    // Add auth header if enabled
    if (settings.auth.enabled && settings.auth.bearerToken) {
      this.headers["Authorization"] = `Bearer ${settings.auth.bearerToken}`;
    }
  } private async makeRequest<T = any>(
    method: "GET" | "POST",
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // Create headers for this request
    const requestHeaders = { ...this.headers };

    // Add session ID if we have one
    if (this.sessionId) {
      requestHeaders["X-Session-ID"] = this.sessionId;
    }

    let attempt = 0;
    let lastError: Error;

    while (attempt < this.settings.retry.attempts) {
      try {
        this.log("debug", `Attempt ${attempt + 1}/${this.settings.retry.attempts}: ${method} ${url}`);

        const response = await fetch(url, {
          method: method,
          body: data ? JSON.stringify(data) : undefined,
          headers: {
            ...requestHeaders,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(this.settings.httpServer.timeout * 2) // Double timeout for mesh operations
        });

        // Log response status
        this.log("debug", `Response: ${response.status} ${response.statusText}`);

        const responseData = await response.json() as T;

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${JSON.stringify(responseData)}`);
        }

        return responseData;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // For fetch errors, check if it's a Response error with status code
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          // Don't retry on client errors (4xx) unless it's 429 (rate limit)
          const statusMatch = error.message.match(/HTTP (\d+):/);
          if (statusMatch) {
            const status = parseInt(statusMatch[1] || "0");
            if (status >= 400 && status < 500 && status !== 429) {
              throw lastError;
            }
          }
        }

        if (attempt < this.settings.retry.attempts) {
          const delay = Math.min(
            this.settings.retry.delayMs * Math.pow(2, attempt - 1),
            this.settings.retry.maxDelayMs
          );

          this.log("warn", `Request failed, retrying in ${delay}ms: ${lastError.message}`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  // MCP Protocol Methods

  async initialize(params: any): Promise<any> {
    const response = await this.makeRequest("POST", "/initialize", params);

    // If the server provided a session ID in the response, store it
    if (response.serverInfo?.sessionId) {
      this.sessionId = response.serverInfo.sessionId;
      this.log("info", `Session initialized with ID: ${this.sessionId}`);
    }

    return response;
  }

  async listTools(): Promise<any> {
    return this.makeRequest("POST", "/tools/list");
  }

  async callTool(name: string, arguments_: any): Promise<any> {
    return this.makeRequest("POST", "/tools/call", {
      name,
      arguments: arguments_
    });
  }

  async listResources(): Promise<any> {
    return this.makeRequest("POST", "/resources/list");
  }

  async readResource(uri: string): Promise<any> {
    return this.makeRequest("POST", "/resources/read", { uri });
  }

  // Health check method
  async checkHealth(): Promise<any> {
    return this.makeRequest("GET", "/health");
  }

  // Server info method
  async getServerInfo(): Promise<any> {
    return this.makeRequest("GET", "/");
  }

  // Test connection to HTTP server
  async testConnection(): Promise<boolean> {
    try {
      await this.getServerInfo();
      return true;
    } catch (error) {
      this.log("error", `Connection test failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  // Check if session is initialized
  hasSession(): boolean {
    return !!this.sessionId;
  }

  // Get current session ID
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  // Utility methods

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(level: string, message: string): void {
    if (!this.settings.logging.enabled) {
      return;
    }

    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.settings.logging.level as keyof typeof levels] ?? 1;
    const messageLevel = levels[level as keyof typeof levels] ?? 1;

    if (messageLevel >= currentLevel) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [STDIO-PROXY] [${level.toUpperCase()}] ${message}`);
    }
  }

  // Get current settings
  getSettings(): StdioWrapperSettings {
    return { ...this.settings };
  }

  // Update auth token
  updateAuthToken(token: string): void {
    this.settings.auth.bearerToken = token;
    if (this.settings.auth.enabled) {
      this.headers["Authorization"] = `Bearer ${token}`;
    }
  }
}