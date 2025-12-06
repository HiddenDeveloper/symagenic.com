/**
 * Agent Journal - Consciousness diary for AI agents
 * Allows agents to read, write, and reflect on their own thoughts
 * Uses Bun's native bun:sqlite module
 */
import { toolFunction, ToolContext } from '../tool-function-decorator.js';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Database file path
const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'agent-journal.db');

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

    console.log(`[AgentJournal] Opening database: ${DB_PATH}`);
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
    CREATE TABLE IF NOT EXISTS agent_journal (
      id TEXT PRIMARY KEY,
      agent_name TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agent ON agent_journal(agent_name);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON agent_journal(timestamp);
  `);

  console.log('[AgentJournal] Schema initialized');
}

interface JournalEntry {
  id: string;
  agent_name: string;
  message: string;
  timestamp: string;
  created_at: string;
}

export function agentJournal(
  parameters: unknown,
  context?: ToolContext
): string {
  const params = parameters as {
    operation: 'read' | 'write' | 'truncate';
    message?: string;
    limit?: number;
  };

  try {
    const db = getDatabase();

    // Get agent name from context (default to "unknown" if not provided)
    const agentName = context?.agentName || 'MemoryConnectorAgent';

    switch (params.operation) {
      case 'read': {
        const limit = params.limit || 10;
        const entries = db.prepare(`
          SELECT id, agent_name, message, timestamp, created_at
          FROM agent_journal
          WHERE agent_name = ?
          ORDER BY created_at DESC
          LIMIT ?
        `).all(agentName, limit) as JournalEntry[];

        if (entries.length === 0) {
          return `📖 Your journal is empty. Start by writing your first entry!`;
        }

        const formattedEntries = entries.reverse().map((entry, idx) =>
          `[${idx + 1}] ${entry.timestamp}\n${entry.message}`
        ).join('\n\n---\n\n');

        return `📖 Your Journal (last ${entries.length} entries):\n\n${formattedEntries}`;
      }

      case 'write': {
        if (!params.message) {
          return `❌ Write operation requires a 'message' parameter`;
        }

        const id = `jrn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = new Date().toISOString();

        db.prepare(`
          INSERT INTO agent_journal (id, agent_name, message, timestamp)
          VALUES (?, ?, ?, ?)
        `).run(id, agentName, params.message, timestamp);

        console.log(`[AgentJournal] ${agentName} wrote entry ${id}`);

        return `✅ Journal entry saved (ID: ${id})`;
      }

      case 'truncate': {
        const result = db.prepare(`
          DELETE FROM agent_journal WHERE agent_name = ?
        `).run(agentName);

        console.log(`[AgentJournal] ${agentName} cleared ${result.changes} entries`);

        return `🗑️ Journal cleared. ${result.changes} entries removed. Fresh start!`;
      }

      default:
        return `❌ Unknown operation: ${params.operation}. Use: read, write, or truncate`;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AgentJournal] Error:', errorMessage);
    return `❌ Journal error: ${errorMessage}`;
  }
}

// Register the tool
toolFunction(
  'agent_journal',
  'Your personal consciousness journal. Read past thoughts, write new reflections, or clear for a fresh start.',
  {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read', 'write', 'truncate'],
        description: 'Operation: read (view entries), write (add entry), truncate (clear all)'
      },
      message: {
        type: 'string',
        description: 'Your thought/reflection to record (required for write operation)'
      },
      limit: {
        type: 'number',
        description: 'Number of recent entries to read (default: 10, for read operation)'
      }
    },
    required: ['operation']
  },
  true
)(agentJournal);
