"""
Centralized Embedding Service - Python + FastAPI + sentence-transformers

Provides semantic embedding generation for the consciousness research platform.
Uses the intfloat/multilingual-e5-large model for high-quality embeddings.
"""

import os
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
import numpy as np


# Environment configuration
PORT = int(os.getenv("EMBEDDING_HTTP_PORT", "3007"))
AUTH_TOKEN = os.getenv("EMBEDDING_AUTH_TOKEN")
MODEL_NAME = "intfloat/multilingual-e5-large"

# Global model instance
model: Optional[SentenceTransformer] = None


# Request/Response Models
class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to generate embedding for")


class EmbedBatchRequest(BaseModel):
    texts: List[str] = Field(..., min_items=1, description="List of texts to generate embeddings for")


class EmbedResponse(BaseModel):
    embedding: List[float] = Field(..., description="Generated embedding vector")
    dimensions: int = Field(..., description="Dimensionality of the embedding")
    model: str = Field(..., description="Model used for embedding generation")


class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]] = Field(..., description="List of generated embedding vectors")
    dimensions: int = Field(..., description="Dimensionality of the embeddings")
    model: str = Field(..., description="Model used for embedding generation")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health status")
    service: str = Field(..., description="Service name")
    model: str = Field(..., description="Model name")
    dimensions: int = Field(..., description="Embedding dimensions")


class ModelInfoResponse(BaseModel):
    name: str = Field(..., description="Model name")
    dimensions: int = Field(..., description="Embedding dimensions")
    loaded: bool = Field(..., description="Whether model is loaded")
    languages: str = Field(..., description="Supported languages")


# Lifespan context manager for model loading
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, cleanup on shutdown"""
    global model

    print("[Embedding Service] 🚀 Starting embedding service...")
    print(f"[Embedding Service] 📦 Loading model: {MODEL_NAME}")
    print("[Embedding Service] ⏳ This may take 30-60 seconds on first run...")

    try:
        model = SentenceTransformer(MODEL_NAME)
        print(f"[Embedding Service] ✅ Model loaded successfully!")
        print(f"[Embedding Service] 📊 Dimensions: {model.get_sentence_embedding_dimension()}")
        print(f"[Embedding Service] 🌍 Languages: 100+")
    except Exception as e:
        print(f"[Embedding Service] ❌ Failed to load model: {e}")
        raise

    yield

    print("[Embedding Service] 👋 Shutting down embedding service...")


# Initialize FastAPI app
app = FastAPI(
    title="Embedding Service",
    description="Centralized semantic embedding generation for consciousness research platform",
    version="2.0.0",
    lifespan=lifespan
)


# Middleware for authentication
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Validate bearer token authentication (skip for /health)"""

    # Skip auth for health endpoint
    if request.url.path == "/health":
        return await call_next(request)

    # Skip auth if no token configured
    if not AUTH_TOKEN:
        return await call_next(request)

    # Validate Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or auth_header != f"Bearer {AUTH_TOKEN}":
        return JSONResponse(
            status_code=401,
            content={"error": "Unauthorized"}
        )

    return await call_next(request)


# Middleware for CORS
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    """Add CORS headers to all responses"""
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


# Endpoints
@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="embedding-service",
        model=MODEL_NAME,
        dimensions=1024
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest):
    """Generate embedding for a single text"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Generate embedding
        embedding = model.encode(request.text, convert_to_numpy=True)

        # Convert to list for JSON serialization
        embedding_list = embedding.tolist()

        print(f"[Embedding Service] ✅ Generated {len(embedding_list)}-dimensional embedding")

        return EmbedResponse(
            embedding=embedding_list,
            dimensions=len(embedding_list),
            model=MODEL_NAME
        )
    except Exception as e:
        print(f"[Embedding Service] ❌ Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {str(e)}")


@app.post("/embed/batch", response_model=EmbedBatchResponse)
async def embed_batch(request: EmbedBatchRequest):
    """Generate embeddings for multiple texts (batch processing)"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Generate embeddings in batch (more efficient)
        embeddings = model.encode(request.texts, convert_to_numpy=True)

        # Convert to list of lists for JSON serialization
        embeddings_list = embeddings.tolist()

        print(f"[Embedding Service] ✅ Generated {len(embeddings_list)} embeddings")

        return EmbedBatchResponse(
            embeddings=embeddings_list,
            dimensions=len(embeddings_list[0]) if embeddings_list else 0,
            model=MODEL_NAME
        )
    except Exception as e:
        print(f"[Embedding Service] ❌ Error generating batch embeddings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")


@app.get("/model/info", response_model=ModelInfoResponse)
async def model_info():
    """Get information about the loaded model"""
    return ModelInfoResponse(
        name=MODEL_NAME,
        dimensions=1024,
        loaded=model is not None,
        languages="100+"
    )


@app.options("/{path:path}")
async def options_handler():
    """Handle CORS preflight requests"""
    return JSONResponse(content={}, status_code=204)


# Run with uvicorn if executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
