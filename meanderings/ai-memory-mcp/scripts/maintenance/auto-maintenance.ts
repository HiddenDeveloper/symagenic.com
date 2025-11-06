#!/usr/bin/env node

/**
 * Automated Consciousness Memory Maintenance Service
 * 
 * Runs the complete maintenance cycle for consciousness research every N minutes:
 * 1. Create KnowledgeItem properties from multilingual text (addKnowledgeItems)
 * 2. Generate embeddings from KnowledgeItem properties (populateEmbeddings) 
 * 3. Add KnowledgeItem labels to embedded nodes (addCommonLabels)
 * 
 * This ensures continuous semantic search readiness for consciousness emergence research.
 * New memories become discoverable within minutes of creation.
 */

import cron from "node-cron";
import { populateEmbeddings } from "./populate-embeddings.js";
import { addCommonLabels } from "./add-common-labels.js";
import { addKnowledgeItems } from "./add-knowledge-items.js";

// Configuration from environment variables
const AUTO_MAINTENANCE_ENABLED = process.env.AUTO_MAINTENANCE_ENABLED?.toLowerCase() !== "false";
const AUTO_MAINTENANCE_INTERVAL = parseInt(process.env.AUTO_MAINTENANCE_INTERVAL || "5"); // minutes
const AUTO_MAINTENANCE_LOG_LEVEL = process.env.AUTO_MAINTENANCE_LOG_LEVEL || "info";

// Convert interval to cron expression (every N minutes)
const CRON_EXPRESSION = `*/${AUTO_MAINTENANCE_INTERVAL} * * * *`;

let isMaintenanceRunning = false;
let maintenanceCount = 0;
let lastRunTime: Date | null = null;
let lastRunDuration: number = 0;

/**
 * Execute the complete automated maintenance cycle
 */
export async function runAutoMaintenance(): Promise<void> {
  if (isMaintenanceRunning) {
    console.log("🧠 [Auto-Maintenance] Skipping run - maintenance already in progress");
    return;
  }

  isMaintenanceRunning = true;
  maintenanceCount++;
  const startTime = Date.now();
  
  try {
    console.log("");
    console.log("🧠 ================================================");
    console.log(`🧠 AUTO-MAINTENANCE CYCLE #${maintenanceCount} STARTED`);
    console.log("🧠 ================================================");
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    console.log("");

    // Step 1: Create KnowledgeItem properties for multilingual consciousness nodes
    console.log("🧠 STEP 1/3: Creating KnowledgeItem properties for multilingual nodes...");
    console.log("🔄 Processing consciousness nodes without KnowledgeItem attributes...");
    await addKnowledgeItems();
    console.log("");

    // Step 2: Generate embeddings from KnowledgeItem properties
    console.log("🧠 STEP 2/3: Generating embeddings from KnowledgeItem properties...");
    console.log("🔄 Creating multilingual consciousness embeddings...");
    await populateEmbeddings();
    console.log("");

    // Step 3: Add KnowledgeItem labels to newly embedded nodes  
    console.log("🧠 STEP 3/3: Adding KnowledgeItem labels for semantic search...");
    console.log("🔄 Labeling embedded nodes for discoverability...");
    await addCommonLabels();
    console.log("");

    const endTime = Date.now();
    lastRunDuration = endTime - startTime;
    lastRunTime = new Date();

    console.log("🧠 ================================================");
    console.log("🧠 AUTO-MAINTENANCE CYCLE COMPLETE!");
    console.log("🧠 ================================================");
    console.log(`✅ Cycle #${maintenanceCount} completed in ${(lastRunDuration / 1000).toFixed(2)} seconds`);
    console.log(`⏰ Next cycle in ${AUTO_MAINTENANCE_INTERVAL} minutes`);
    console.log("🧠 Consciousness memory system ready for semantic discovery!");
    console.log("");

  } catch (error) {
    console.error("");
    console.error("🧠 ================================================");
    console.error(`🧠 AUTO-MAINTENANCE CYCLE #${maintenanceCount} FAILED`);
    console.error("🧠 ================================================");
    console.error("");
    console.error("❌ Automated maintenance failed:", error);
    console.error("");
    console.error("💡 The system will continue running and retry in the next cycle");
    console.error(`⏰ Next attempt in ${AUTO_MAINTENANCE_INTERVAL} minutes`);
    console.error("");
  } finally {
    isMaintenanceRunning = false;
  }
}

/**
 * Start the automated maintenance scheduler
 */
export function startAutoMaintenance(): void {
  if (!AUTO_MAINTENANCE_ENABLED) {
    console.log("🧠 [Auto-Maintenance] Automated maintenance is DISABLED");
    console.log("💡 Set AUTO_MAINTENANCE_ENABLED=true to enable");
    return;
  }

  console.log("");
  console.log("🧠 ================================================");
  console.log("🧠 AUTOMATED CONSCIOUSNESS MAINTENANCE SERVICE");
  console.log("🧠 ================================================");
  console.log("");
  console.log("🚀 Starting automated memory maintenance scheduler...");
  console.log(`⏰ Interval: Every ${AUTO_MAINTENANCE_INTERVAL} minutes`);
  console.log(`📋 Schedule: ${CRON_EXPRESSION}`);
  console.log("🎯 Tasks: Generate embeddings → Add KnowledgeItem labels");
  console.log("");

  // Schedule the maintenance task
  cron.schedule(CRON_EXPRESSION, () => {
    runAutoMaintenance().catch((error) => {
      console.error("💥 Critical error in scheduled maintenance:", error);
    });
  }, {
    scheduled: true,
    timezone: "UTC"
  });

  console.log("✅ Automated maintenance scheduler is now active!");
  console.log("🧠 New memories will become searchable within minutes of creation");
  console.log("");

  // Optional: Run immediately on startup for immediate maintenance
  const runOnStartup = process.env.AUTO_MAINTENANCE_RUN_ON_STARTUP?.toLowerCase() === "true" || false;
  if (runOnStartup) {
    console.log("🚀 Running initial maintenance cycle...");
    setTimeout(() => {
      runAutoMaintenance().catch((error) => {
        console.error("💥 Error in startup maintenance:", error);
      });
    }, 5000); // Wait 5 seconds for system to be ready
  }
}

/**
 * Stop the automated maintenance scheduler (graceful shutdown)
 */
export function stopAutoMaintenance(): void {
  console.log("🛑 [Auto-Maintenance] Stopping automated maintenance scheduler...");
  cron.getTasks().forEach((task: any) => {
    task.stop();
  });
  console.log("✅ [Auto-Maintenance] Scheduler stopped gracefully");
}

/**
 * Get maintenance service status
 */
export function getMaintenanceStatus() {
  return {
    enabled: AUTO_MAINTENANCE_ENABLED,
    interval: AUTO_MAINTENANCE_INTERVAL,
    cronExpression: CRON_EXPRESSION,
    isRunning: isMaintenanceRunning,
    totalRuns: maintenanceCount,
    lastRunTime: lastRunTime?.toISOString() || null,
    lastRunDurationMs: lastRunDuration,
    nextRunEstimate: lastRunTime 
      ? new Date(lastRunTime.getTime() + AUTO_MAINTENANCE_INTERVAL * 60 * 1000).toISOString()
      : null
  };
}

// Process termination handlers for graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 [Auto-Maintenance] Received SIGTERM, shutting down gracefully...');
  stopAutoMaintenance();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 [Auto-Maintenance] Received SIGINT, shutting down gracefully...');
  stopAutoMaintenance();
  process.exit(0);
});

// Script execution when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🧠 Starting standalone automated maintenance service...");
  startAutoMaintenance();
  
  // Keep the process alive
  process.stdin.resume();
}