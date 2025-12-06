// Store the pipeline instance globally to avoid reloading
let extractor: any | null = null;
let transformersModule: any | null = null;

/**
 * Initialize the embedding model
 * Call this on startup to pre-load the model
 */
export async function initializeModel(): Promise<void> {
  if (extractor) {
    return; // Already initialized
  }

  try {
    console.log("[Embedding Service] 🌍 Initializing E5-large multilingual embedding model...");

    // Lazy load the transformers module
    if (!transformersModule) {
      transformersModule = await import("@xenova/transformers");
      try {
        // Determine cache directory based on environment
        const defaultCacheDir = process.platform === 'darwin' || process.platform === 'linux'
          ? `${process.env.HOME}/.cache/transformers`
          : process.platform === 'win32'
          ? `${process.env.LOCALAPPDATA || process.env.USERPROFILE}/.cache/transformers`
          : '/usr/src/app/.cache/transformers'; // Docker location

        const cacheDir = process.env.TRANSFORMERS_CACHE || defaultCacheDir;

        // Configure cache directory and reduce wasm threads to lower memory pressure
        if (transformersModule.env) {
          transformersModule.env.cacheDir = cacheDir;
          if (transformersModule.env.backends?.onnx?.wasm) {
            transformersModule.env.backends.onnx.wasm.numThreads = 1;
          }
        }
        console.log(`[Embedding Service] 📁 Using cache directory: ${cacheDir}`);
      } catch (error) {
        console.warn("[Embedding Service] ⚠️  Could not configure cache, using defaults:", error);
      }
    }

    // Use Xenova's multilingual-e5-large model (JavaScript-compatible ONNX model, 1024D)
    extractor = await transformersModule.pipeline(
      "feature-extraction",
      "Xenova/multilingual-e5-large"
    );
    console.log("[Embedding Service] ✅ E5-large embedding model initialized successfully (1024D, 100+ languages supported)");
  } catch (error) {
    console.error("[Embedding Service] ❌ Failed to initialize embedding model:", error);
    throw new Error("Failed to initialize the embedding model");
  }
}

/**
 * Generates an embedding for the given text using Xenova/multilingual-e5-large model
 * Model produces 1024-dimensional vectors optimized for semantic similarity across 100+ languages
 *
 * @param text The text to generate an embedding for
 * @returns A promise that resolves to an array of numbers representing the embedding (1024D)
 * @throws An error if the embedding generation fails
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Ensure model is initialized
  if (!extractor) {
    await initializeModel();
  }

  if (!extractor) {
    throw new Error("Embedding model (extractor) is not available");
  }

  try {
    // Generate embedding with mean pooling and normalization
    const result = await extractor(text, { pooling: "mean", normalize: true });

    // Convert tensor to JavaScript array
    const embedding = result.tolist()[0];

    console.log(`[Embedding Service] ✅ Generated ${embedding.length}-dimensional embedding for text: "${text.substring(0, 50)}..."`);
    return embedding;
  } catch (error) {
    console.error("[Embedding Service] ❌ Failed to generate embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * More efficient than calling generateEmbedding multiple times
 *
 * @param texts Array of texts to generate embeddings for
 * @returns Promise that resolves to array of embeddings
 */
export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(text => generateEmbedding(text)));
}

/**
 * Get model information
 */
export function getModelInfo() {
  return {
    name: 'Xenova/multilingual-e5-large',
    dimensions: 1024,
    loaded: extractor !== null,
    languages: '100+'
  };
}
