/**
 * Log trigger event - Record triggered events to SQLite database
 * Uses Bun's native bun:sqlite module (same as Strava skill)
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';
import { Database } from 'bun:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file path
const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'trigger-events.db');

let dbInstance: Database | null = null;

/**
 * Get or create SQLite database connection
 */
function getDatabase(): Database {
  if (!dbInstance) {
    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    console.log(`[TriggerEvents] Opening database: ${DB_PATH}`);
    dbInstance = new Database(DB_PATH, { create: true });

    // Enable Write-Ahead Logging for better concurrency
    dbInstance.exec('PRAGMA journal_mode = WAL;');

    // Initialize schema
    initializeSchema(dbInstance);
  }

  return dbInstance;
}

/**
 * Initialize database schema
 */
function initializeSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS trigger_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      analysis TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_event_type ON trigger_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON trigger_events(timestamp);
  `);

  console.log('[TriggerEvents] Schema initialized');
}

interface TriggerEventLog {
  id: string;
  event_type: string;
  event_data: string;
  analysis: string;
  timestamp: string;
}

export function logTriggerEvent(
  parameters: unknown,
  _context?: ToolContext
): string {
  // Validate and extract parameters
  const params = parameters as {
    event_type: string;
    event_data: string;
    analysis: string;
  };

  try {
    const db = getDatabase();

    // Generate unique ID
    const id = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Insert event
    const stmt = db.prepare(`
      INSERT INTO trigger_events (id, event_type, event_data, analysis, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.event_type,
      params.event_data,
      params.analysis,
      timestamp
    );

    console.log(`[TriggerEvents] Logged event ${id}: ${params.event_type}`);

    return `✅ Event logged successfully: ${params.event_type} (ID: ${id})`;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TriggerEvents] Failed to log event:', errorMessage);
    return `❌ Failed to log event: ${errorMessage}`;
  }
}

// Register the tool
toolFunction(
  'log_trigger_event',
  'Log a trigger event to SQLite database with agent analysis. Use this to record your observations about triggered events.',
  {
    type: 'object',
    properties: {
      event_type: {
        type: 'string',
        description: 'Type of trigger event (e.g., "new_memory_created")'
      },
      event_data: {
        type: 'string',
        description: 'JSON string of event details from the trigger'
      },
      analysis: {
        type: 'string',
        description: 'Your analysis of the event - what you discovered, connections found, actions taken'
      }
    },
    required: ['event_type', 'event_data', 'analysis']
  },
  true
)(logTriggerEvent);
