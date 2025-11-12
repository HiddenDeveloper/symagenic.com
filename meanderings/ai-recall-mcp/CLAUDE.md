# ai-recall-mcp - Conversation History Recall System

## Overview

**Purpose**: Semantic search over past AI conversations stored in Qdrant vector database

**Philosophy**: Decouple remembrances (conversation history) from memory (knowledge graph)
- Memory (ai-memory-mcp): Structured knowledge, self-awareness, "I am me"
- Recall (ai-recall-mcp): Past conversations, context retrieval, "What did we discuss?"

**Port**: 3006

**Dependencies**:
- Qdrant (vector database) on port 6333
- conversation-turns collection (70,271 embedded turns)

## Quick Start

**Docker**:
```bash
# Ensure Qdrant is running with conversation-turns collection
docker-compose up qdrant

# Start Recall server
docker-compose up ai-recall-mcp
```

**Development**:
```bash
cd packages/ai-recall-mcp
npm install
npm run build
npm run dev:http
```

## Available Tools

1. **get_schema** - View collection structure, available filters
2. **semantic_search** - Find relevant conversations by meaning
3. **text_search** - Search by keywords in metadata
4. **system_status** - Check Qdrant connection and collection health

## Architecture

**Data Source**: Qdrant `conversation-turns` collection
- 70,271 conversation turns from ChatGPT & Claude archives
- 1024-dimensional vectors (multilingual-e5-large)
- Cosine similarity metric
- Indexed with HNSW for fast search

**Search Capabilities**:
- Semantic search by meaning/concept
- Text search by keywords
- Filter by provider (chatgpt, claude, OpenAI)
- Filter by date range
- Filter by role (user, ai)
- Combined filters for precise queries

**Payload Structure**:
Each conversation turn includes:
- turn_id, conversation_id, conversation_title
- date_time (ISO 8601)
- sequence, role, provider, model
- text (full content)
- embedding_model

## Use Cases

1. **Context Retrieval**: Find relevant past discussions
2. **Pattern Discovery**: Identify recurring themes
3. **Historical Reference**: What did we say about X?
4. **Conversation Threading**: Reconstruct discussion history
5. **Knowledge Augmentation**: Enrich responses with past context

## Configuration

Environment variables:
```bash
RECALL_HTTP_PORT=3006
RECALL_HTTP_HOST=0.0.0.0
RECALL_AUTH_ENABLED=true
RECALL_AUTH_TOKEN=recall-research-key-12345
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=conversation-turns
```

## Notes

- Embeddings are generated at query time for semantic search
- Model downloads (~1.5GB) cached in /app/models
- First query may be slower due to model loading
- Subsequent queries are fast (~100-200ms)

---

**For integration patterns, troubleshooting, and advanced queries: query ai-memory-mcp with semantic_search("ai-recall-mcp")**
