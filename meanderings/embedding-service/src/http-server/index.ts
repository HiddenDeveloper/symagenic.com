import express, { Request, Response } from 'express';
import cors from 'cors';
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

const app = express();

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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for batch requests

// Auth middleware (skip for health check)
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }

  if (AUTH_TOKEN) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
      const error: ErrorResponse = { error: 'Unauthorized' };
      return res.status(401).json(error);
    }
  }
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const response: HealthResponse = {
    status: 'healthy',
    service: 'embedding-service',
    model: 'Xenova/multilingual-e5-large',
    dimensions: 1024
  };
  res.json(response);
});

// Single embedding endpoint
app.post('/embed', async (req: Request, res: Response) => {
  try {
    const { text }: EmbedRequest = req.body;

    if (!text || typeof text !== 'string') {
      const error: ErrorResponse = { error: 'Missing or invalid text parameter' };
      return res.status(400).json(error);
    }

    if (text.length === 0) {
      const error: ErrorResponse = { error: 'Text cannot be empty' };
      return res.status(400).json(error);
    }

    const embedding = await generateEmbedding(text);
    const response: EmbedResponse = {
      embedding,
      dimensions: embedding.length
    };
    res.json(response);
  } catch (error) {
    console.error('Embedding error:', error);
    const response: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Embedding generation failed'
    };
    res.status(500).json(response);
  }
});

// Batch embeddings endpoint
app.post('/embed/batch', async (req: Request, res: Response) => {
  try {
    const { texts }: EmbedBatchRequest = req.body;

    if (!Array.isArray(texts)) {
      const error: ErrorResponse = { error: 'Missing or invalid texts parameter (must be array)' };
      return res.status(400).json(error);
    }

    if (texts.length === 0) {
      const error: ErrorResponse = { error: 'Texts array cannot be empty' };
      return res.status(400).json(error);
    }

    if (texts.length > 100) {
      const error: ErrorResponse = { error: 'Batch size limit: 100 texts per request' };
      return res.status(400).json(error);
    }

    // Validate all texts are strings
    for (const text of texts) {
      if (typeof text !== 'string') {
        const error: ErrorResponse = { error: 'All texts must be strings' };
        return res.status(400).json(error);
      }
    }

    const embeddings = await generateEmbeddingBatch(texts);
    const response: EmbedBatchResponse = {
      embeddings,
      count: embeddings.length
    };
    res.json(response);
  } catch (error) {
    console.error('Batch embedding error:', error);
    const response: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Batch embedding generation failed'
    };
    res.status(500).json(response);
  }
});

// Model info endpoint
app.get('/model/info', (req: Request, res: Response) => {
  const info = getModelInfo();
  const response: ModelInfoResponse = info;
  res.json(response);
});

// 404 handler
app.use((req: Request, res: Response) => {
  const error: ErrorResponse = { error: 'Endpoint not found' };
  res.status(404).json(error);
});

// Start server after loading model
console.log('[Embedding Service] 🚀 Starting embedding service...');
console.log('[Embedding Service] 📦 Loading model (this may take 30-60 seconds)...');

initializeModel()
  .then(() => {
    console.log('[Embedding Service] ✅ Model loaded successfully');

    app.listen(PORT, '0.0.0.0', () => {
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
    });
  })
  .catch((error) => {
    console.error('[Embedding Service] ❌ Failed to initialize:', error);
    process.exit(1);
  });
