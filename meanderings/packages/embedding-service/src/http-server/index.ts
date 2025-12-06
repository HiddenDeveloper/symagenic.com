import { generateEmbedding, generateEmbeddingBatch, initializeModel, getModelInfo } from '../lib/embedding.js';
import type {
  EmbedRequest,
  EmbedResponse,
  EmbedBatchRequest,
  EmbedBatchResponse,
  HealthResponse,
  ModelInfoResponse,
  ErrorResponse
} from '../types/api.js';

// Environment variables with backward compatibility
const PORT = parseInt(
  process.env.EMBEDDING_HTTP_PORT ||
  process.env.HTTP_PORT || // Deprecated fallback
  '3007'
);
const AUTH_TOKEN =
  process.env.EMBEDDING_AUTH_TOKEN ||
  process.env.AUTH_TOKEN; // Deprecated fallback

// Log deprecation warnings
if (process.env.HTTP_PORT && !process.env.EMBEDDING_HTTP_PORT) {
  console.warn('⚠️  HTTP_PORT is deprecated, use EMBEDDING_HTTP_PORT instead');
}
if (process.env.AUTH_TOKEN && !process.env.EMBEDDING_AUTH_TOKEN) {
  console.warn('⚠️  AUTH_TOKEN is deprecated, use EMBEDDING_AUTH_TOKEN instead');
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Validate authentication (skip for /health endpoint)
 */
function validateAuth(req: Request, pathname: string): Response | null {
  // Skip auth for health check
  if (pathname === '/health') {
    return null;
  }

  // Skip auth if no token configured
  if (!AUTH_TOKEN) {
    return null;
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return Response.json(
      { error: 'Unauthorized' } as ErrorResponse,
      { status: 401 }
    );
  }

  return null;
}

/**
 * Health check endpoint handler
 */
function handleHealth(): Response {
  const response: HealthResponse = {
    status: 'healthy',
    service: 'embedding-service',
    model: 'Xenova/multilingual-e5-large',
    dimensions: 1024
  };
  return Response.json(response);
}

/**
 * Single embedding endpoint handler
 */
async function handleEmbed(req: Request): Promise<Response> {
  try {
    const body = await req.json() as EmbedRequest;
    const { text } = body;

    if (!text || typeof text !== 'string') {
      const error: ErrorResponse = { error: 'Missing or invalid text parameter' };
      return Response.json(error, { status: 400 });
    }

    if (text.length === 0) {
      const error: ErrorResponse = { error: 'Text cannot be empty' };
      return Response.json(error, { status: 400 });
    }

    const embedding = await generateEmbedding(text);
    const response: EmbedResponse = {
      embedding,
      dimensions: embedding.length
    };
    return Response.json(response);
  } catch (error) {
    console.error('Embedding error:', error);
    const response: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Embedding generation failed'
    };
    return Response.json(response, { status: 500 });
  }
}

/**
 * Batch embeddings endpoint handler
 */
async function handleEmbedBatch(req: Request): Promise<Response> {
  try {
    const body = await req.json() as EmbedBatchRequest;
    const { texts } = body;

    if (!Array.isArray(texts)) {
      const error: ErrorResponse = { error: 'Missing or invalid texts parameter (must be array)' };
      return Response.json(error, { status: 400 });
    }

    if (texts.length === 0) {
      const error: ErrorResponse = { error: 'Texts array cannot be empty' };
      return Response.json(error, { status: 400 });
    }

    if (texts.length > 100) {
      const error: ErrorResponse = { error: 'Batch size limit: 100 texts per request' };
      return Response.json(error, { status: 400 });
    }

    // Validate all texts are strings
    for (const text of texts) {
      if (typeof text !== 'string') {
        const error: ErrorResponse = { error: 'All texts must be strings' };
        return Response.json(error, { status: 400 });
      }
    }

    const embeddings = await generateEmbeddingBatch(texts);
    const response: EmbedBatchResponse = {
      embeddings,
      count: embeddings.length
    };
    return Response.json(response);
  } catch (error) {
    console.error('Batch embedding error:', error);
    const response: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Batch embedding generation failed'
    };
    return Response.json(response, { status: 500 });
  }
}

/**
 * Model info endpoint handler
 */
function handleModelInfo(): Response {
  const info = getModelInfo();
  const response: ModelInfoResponse = info;
  return Response.json(response);
}

/**
 * 404 handler
 */
function handle404(): Response {
  const error: ErrorResponse = { error: 'Endpoint not found' };
  return Response.json(error, { status: 404 });
}

/**
 * Main request router
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Validate authentication
  const authError = validateAuth(req, pathname);
  if (authError) {
    return addCorsHeaders(authError);
  }

  // Route to handlers
  try {
    let response: Response;

    if (method === 'GET' && pathname === '/health') {
      response = handleHealth();
    } else if (method === 'POST' && pathname === '/embed') {
      response = await handleEmbed(req);
    } else if (method === 'POST' && pathname === '/embed/batch') {
      response = await handleEmbedBatch(req);
    } else if (method === 'GET' && pathname === '/model/info') {
      response = handleModelInfo();
    } else {
      response = handle404();
    }

    return addCorsHeaders(response);
  } catch (error) {
    console.error('Request error:', error);
    const errorResponse: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error'
    };
    return addCorsHeaders(Response.json(errorResponse, { status: 500 }));
  }
}

// Start server after loading model
console.log('[Embedding Service] 🚀 Starting embedding service...');
console.log('[Embedding Service] 📦 Loading model (this may take 30-60 seconds)...');

initializeModel()
  .then(() => {
    console.log('[Embedding Service] ✅ Model loaded successfully');

    Bun.serve({
      port: PORT,
      hostname: '0.0.0.0',
      fetch: handleRequest,
    });

    console.log(`[Embedding Service] 🌐 Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Embedding Service] 📍 Endpoints:`);
    console.log(`[Embedding Service]    GET  /health       - Health check`);
    console.log(`[Embedding Service]    POST /embed        - Generate single embedding`);
    console.log(`[Embedding Service]    POST /embed/batch  - Generate batch embeddings`);
    console.log(`[Embedding Service]    GET  /model/info   - Model information`);
    if (AUTH_TOKEN) {
      console.log(`[Embedding Service] 🔐 Authentication: Enabled`);
    } else {
      console.log(`[Embedding Service] ⚠️  Authentication: Disabled (set AUTH_TOKEN env var)`);
    }
  })
  .catch((error) => {
    console.error('[Embedding Service] ❌ Failed to initialize:', error);
    process.exit(1);
  });
