/**
 * Express adapter for Bun native HTTP
 * Creates minimal Express-compatible req/res objects for MCP SDK
 */

import { EventEmitter } from 'events';

interface ExpressRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  on(event: string, callback: (...args: any[]) => void): void;
}

interface ExpressResponse extends EventEmitter {
  statusCode: number;
  headersSent: boolean;
  status(code: number): ExpressResponse;
  set(field: string, value: string): ExpressResponse;
  setHeader(name: string, value: string | string[]): ExpressResponse;
  getHeader(name: string): string | string[] | undefined;
  removeHeader(name: string): void;
  write(chunk: any): boolean;
  end(chunk?: any): void;
  json(obj: any): void;
  send(body: any): void;
}

export function createExpressAdapter(req: Request): {
  expressReq: ExpressRequest;
  expressRes: ExpressResponse;
  responsePromise: Promise<Response>;
} {
  const url = new URL(req.url);

  // Create Express-compatible request
  const headers: Record<string, string | string[] | undefined> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const query: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const existing = query[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        query[key] = [existing, value];
      }
    } else {
      query[key] = value;
    }
  });

  const expressReq: ExpressRequest = {
    method: req.method,
    url: url.pathname + url.search,
    headers,
    query,
    params: {},
    on: () => {}, // Minimal implementation
  };

  // Create Express-compatible response with promise resolution
  let resolveResponse: (response: Response) => void;
  let rejectResponse: (error: Error) => void;

  const responsePromise = new Promise<Response>((resolve, reject) => {
    resolveResponse = resolve;
    rejectResponse = reject;
  });

  class ExpressResponseAdapter extends EventEmitter implements ExpressResponse {
    statusCode = 200;
    headersSent = false;
    private _headers: Map<string, string | string[]> = new Map();
    private _body: any[] = [];
    private _finished = false;

    status(code: number): ExpressResponse {
      this.statusCode = code;
      return this;
    }

    set(field: string, value: string): ExpressResponse {
      this.setHeader(field, value);
      return this;
    }

    setHeader(name: string, value: string | string[]): ExpressResponse {
      if (!this.headersSent) {
        this._headers.set(name.toLowerCase(), value);
      }
      return this;
    }

    getHeader(name: string): string | string[] | undefined {
      return this._headers.get(name.toLowerCase());
    }

    removeHeader(name: string): void {
      this._headers.delete(name.toLowerCase());
    }

    write(chunk: any): boolean {
      if (!this._finished) {
        this.headersSent = true;
        this._body.push(chunk);
      }
      return true;
    }

    end(chunk?: any): void {
      if (this._finished) return;

      this._finished = true;
      this.headersSent = true;

      if (chunk !== undefined) {
        this._body.push(chunk);
      }

      // Build response
      const headers = new Headers();
      this._headers.forEach((value, key) => {
        if (Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      });

      // Combine body chunks
      let body: any = null;
      if (this._body.length > 0) {
        if (typeof this._body[0] === 'string') {
          body = this._body.join('');
        } else if (Buffer.isBuffer(this._body[0])) {
          body = Buffer.concat(this._body);
        } else {
          body = this._body[0];
        }
      }

      const response = new Response(body, {
        status: this.statusCode,
        headers,
      });

      this.emit('finish');
      this.emit('close');
      resolveResponse(response);
    }

    json(obj: any): void {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(obj));
    }

    send(body: any): void {
      if (typeof body === 'object') {
        this.json(body);
      } else {
        this.end(body);
      }
    }
  }

  const expressRes = new ExpressResponseAdapter();

  // Set timeout to prevent hanging
  const timeout = setTimeout(() => {
    if (!expressRes.headersSent) {
      rejectResponse(new Error('Response timeout'));
    }
  }, 30000); // 30 second timeout

  responsePromise.finally(() => clearTimeout(timeout));

  return {
    expressReq,
    expressRes,
    responsePromise,
  };
}
