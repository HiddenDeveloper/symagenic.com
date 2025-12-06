#!/usr/bin/env node

/**
 * Schema Compliance Test for Consciousness Research
 *
 * Validates that the memory system maintains schema coherence by:
 * 1. Monitoring property catalog growth
 * 2. Checking vocabulary compliance (core labels/relationships)
 * 3. Detecting ghost properties
 * 4. Verifying CurationGuidelines integrity
 *
 * Run weekly to ensure schema guidance is being followed.
 */

import { Neo4jService } from "../../shared/neo4j-service.js";

const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "testpassword123";
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || "neo4j";

// Compliance thresholds
const THRESHOLDS = {
  PROPERTY_COUNT_MAX: 150,
  PROPERTY_COUNT_WARN: 125,
  CORE_LABEL_USAGE_MIN: 0.85,      // 85% of new nodes should use core labels
  CORE_RELATIONSHIP_USAGE_MIN: 0.90, // 90% of new relationships should use core types
};

const CORE_LABELS = [
  "KnowledgeItem",
  "Insight",
  "Pattern",
  "Feature",
  "Event",
  "Concept",
  "Solution",
  "Problem",
  "Lesson",
  "Observation",
  "Decision",
  "Component",
  "Topic",
  "Experiment",
  "Philosophy",
];

const CORE_RELATIONSHIPS = [
  "RELATES_TO",
  "PART_OF",
  "ENABLES",
  "REQUIRES",
  "SUPPORTS",
  "DEMONSTRATES",
  "TRANSFORMS",
  "IMPLEMENTS",
  "STRUCTURES",
  "EXEMPLIFIES",
  "INFORMS",
  "COMPLETES",
  "GUIDES",
];

interface ComplianceReport {
  passed: boolean;
  timestamp: string;
  checks: {
    propertyCount: {
      passed: boolean;
      current: number;
      max: number;
      warning: boolean;
    };
    coreLabelsUsage: {
      passed: boolean;
      percentage: number;
      target: number;
      details: string;
    };
    coreRelationshipsUsage: {
      passed: boolean;
      percentage: number;
      target: number;
      details: string;
    };
    ghostProperties: {
      passed: boolean;
      count: number;
      examples: string[];
    };
    curationGuidelinesHealth: {
      passed: boolean;
      exists: boolean;
      hasData: boolean;
    };
  };
  recommendations: string[];
}

async function runSchemaComplianceTest(): Promise<ComplianceReport> {
  console.log("🧠 ================================================");
  console.log("🧠 SCHEMA COMPLIANCE TEST");
  console.log("🧠 ================================================");
  console.log("");

  const service = new Neo4jService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);
  const report: ComplianceReport = {
    passed: true,
    timestamp: new Date().toISOString(),
    checks: {
      propertyCount: { passed: true, current: 0, max: THRESHOLDS.PROPERTY_COUNT_MAX, warning: false },
      coreLabelsUsage: { passed: true, percentage: 0, target: THRESHOLDS.CORE_LABEL_USAGE_MIN, details: "" },
      coreRelationshipsUsage: { passed: true, percentage: 0, target: THRESHOLDS.CORE_RELATIONSHIP_USAGE_MIN, details: "" },
      ghostProperties: { passed: true, count: 0, examples: [] },
      curationGuidelinesHealth: { passed: true, exists: false, hasData: false },
    },
    recommendations: [],
  };

  try {
    await service.verifyConnection(NEO4J_DATABASE);
    console.log("✅ Connected to Neo4j");
    console.log("");

    // CHECK 1: Property Count
    console.log("🔍 CHECK 1: Property Catalog Size");
    const propertyKeysResult = await service.executeCypher("CALL db.propertyKeys() YIELD propertyKey RETURN count(propertyKey) as count");
    const propertyCount = propertyKeysResult[0]?.count?.low || 0;
    report.checks.propertyCount.current = propertyCount;

    if (propertyCount >= THRESHOLDS.PROPERTY_COUNT_MAX) {
      report.checks.propertyCount.passed = false;
      report.passed = false;
      console.log(`❌ FAIL: Property count (${propertyCount}) exceeds maximum (${THRESHOLDS.PROPERTY_COUNT_MAX})`);
      report.recommendations.push(`Immediate action required: Consolidate properties (current: ${propertyCount}, max: ${THRESHOLDS.PROPERTY_COUNT_MAX})`);
    } else if (propertyCount >= THRESHOLDS.PROPERTY_COUNT_WARN) {
      report.checks.propertyCount.warning = true;
      console.log(`⚠️  WARN: Property count (${propertyCount}) approaching maximum (${THRESHOLDS.PROPERTY_COUNT_MAX})`);
      report.recommendations.push(`Monitor property growth - currently at ${propertyCount}/${THRESHOLDS.PROPERTY_COUNT_MAX}`);
    } else {
      console.log(`✅ PASS: Property count (${propertyCount}) is healthy`);
    }
    console.log("");

    // CHECK 2: Core Label Usage (last 7 days)
    console.log("🔍 CHECK 2: Core Label Usage (last 7 days)");
    const recentNodesQuery = `
      MATCH (n)
      WHERE n.created IS NOT NULL
        AND duration.between(n.created, datetime()).days <= 7
        AND NOT 'Embedding' IN labels(n)
        AND NOT 'KnowledgeText' IN labels(n)
      RETURN labels(n) as labels
    `;
    const recentNodes = await service.executeCypher(recentNodesQuery);

    if (recentNodes.length > 0) {
      const coreLabelsCount = recentNodes.filter((node: any) => {
        const nodeLabels = node.labels || [];
        return nodeLabels.some((label: string) => CORE_LABELS.includes(label));
      }).length;

      const coreLabelsPercentage = coreLabelsCount / recentNodes.length;
      report.checks.coreLabelsUsage.percentage = coreLabelsPercentage;
      report.checks.coreLabelsUsage.details = `${coreLabelsCount}/${recentNodes.length} nodes use core labels`;

      if (coreLabelsPercentage < THRESHOLDS.CORE_LABEL_USAGE_MIN) {
        report.checks.coreLabelsUsage.passed = false;
        report.passed = false;
        console.log(`❌ FAIL: Core label usage (${(coreLabelsPercentage * 100).toFixed(1)}%) below target (${(THRESHOLDS.CORE_LABEL_USAGE_MIN * 100).toFixed(1)}%)`);
        report.recommendations.push(`Improve core label usage: ${report.checks.coreLabelsUsage.details}`);
      } else {
        console.log(`✅ PASS: Core label usage (${(coreLabelsPercentage * 100).toFixed(1)}%) meets target`);
      }
    } else {
      console.log(`ℹ️  INFO: No new nodes created in last 7 days`);
      report.checks.coreLabelsUsage.details = "No recent nodes to analyze";
    }
    console.log("");

    // CHECK 3: Core Relationship Usage (last 7 days)
    console.log("🔍 CHECK 3: Core Relationship Usage (last 7 days)");
    const recentRelsQuery = `
      MATCH ()-[r]->()
      WHERE r.created IS NOT NULL
        AND duration.between(r.created, datetime()).days <= 7
        AND NOT type(r) IN ['HAS_EMBEDDING', 'HAS_CONCATENATED_TEXT']
      RETURN type(r) as rel_type
    `;
    const recentRels = await service.executeCypher(recentRelsQuery);

    if (recentRels.length > 0) {
      const coreRelsCount = recentRels.filter((rel: any) =>
        CORE_RELATIONSHIPS.includes(rel.rel_type)
      ).length;

      const coreRelsPercentage = coreRelsCount / recentRels.length;
      report.checks.coreRelationshipsUsage.percentage = coreRelsPercentage;
      report.checks.coreRelationshipsUsage.details = `${coreRelsCount}/${recentRels.length} relationships use core types`;

      if (coreRelsPercentage < THRESHOLDS.CORE_RELATIONSHIP_USAGE_MIN) {
        report.checks.coreRelationshipsUsage.passed = false;
        report.passed = false;
        console.log(`❌ FAIL: Core relationship usage (${(coreRelsPercentage * 100).toFixed(1)}%) below target (${(THRESHOLDS.CORE_RELATIONSHIP_USAGE_MIN * 100).toFixed(1)}%)`);
        report.recommendations.push(`Improve core relationship usage: ${report.checks.coreRelationshipsUsage.details}`);
      } else {
        console.log(`✅ PASS: Core relationship usage (${(coreRelsPercentage * 100).toFixed(1)}%) meets target`);
      }
    } else {
      console.log(`ℹ️  INFO: No new relationships created in last 7 days`);
      report.checks.coreRelationshipsUsage.details = "No recent relationships to analyze";
    }
    console.log("");

    // CHECK 4: Ghost Properties Detection
    console.log("🔍 CHECK 4: Ghost Properties (in catalog but unused)");
    const allPropertiesQuery = "CALL db.propertyKeys() YIELD propertyKey RETURN propertyKey";
    const allProperties = await service.executeCypher(allPropertiesQuery);

    const ghostProperties: string[] = [];
    for (const prop of allProperties) {
      const propKey = prop.propertyKey;
      const usageQuery = `MATCH (n) WHERE n.\`${propKey}\` IS NOT NULL RETURN count(n) as count LIMIT 1`;
      try {
        const usage = await service.executeCypher(usageQuery);
        if (usage[0]?.count?.low === 0) {
          ghostProperties.push(propKey);
        }
      } catch (error) {
        // Skip properties that can't be queried (special chars, etc.)
        continue;
      }
    }

    report.checks.ghostProperties.count = ghostProperties.length;
    report.checks.ghostProperties.examples = ghostProperties.slice(0, 5);

    if (ghostProperties.length > 10) {
      report.checks.ghostProperties.passed = false;
      console.log(`⚠️  WARN: Found ${ghostProperties.length} ghost properties`);
      console.log(`   Examples: ${ghostProperties.slice(0, 3).join(", ")}`);
      report.recommendations.push(`Consider cleaning up ${ghostProperties.length} unused properties`);
    } else if (ghostProperties.length > 0) {
      console.log(`ℹ️  INFO: Found ${ghostProperties.length} ghost properties (acceptable)`);
    } else {
      console.log(`✅ PASS: No ghost properties found`);
    }
    console.log("");

    // CHECK 5: CurationGuidelines Health
    console.log("🔍 CHECK 5: CurationGuidelines Node Health");
    const guidelinesQuery = `
      MATCH (cg:CurationGuidelines)
      RETURN cg.core_labels as core_labels,
             cg.core_relationships as core_relationships
      LIMIT 1
    `;
    const guidelines = await service.executeCypher(guidelinesQuery);

    if (guidelines.length > 0) {
      report.checks.curationGuidelinesHealth.exists = true;
      const hasLabels = guidelines[0]?.core_labels && guidelines[0].core_labels.length > 0;
      const hasRelationships = guidelines[0]?.core_relationships && guidelines[0].core_relationships.length > 0;
      report.checks.curationGuidelinesHealth.hasData = hasLabels && hasRelationships;

      if (report.checks.curationGuidelinesHealth.hasData) {
        console.log(`✅ PASS: CurationGuidelines node exists with data`);
        console.log(`   Core labels: ${guidelines[0]?.core_labels?.length || 0}`);
        console.log(`   Core relationships: ${guidelines[0]?.core_relationships?.length || 0}`);
      } else {
        report.checks.curationGuidelinesHealth.passed = false;
        report.passed = false;
        console.log(`❌ FAIL: CurationGuidelines node exists but missing data`);
        report.recommendations.push("Repopulate CurationGuidelines node with schema vocabulary");
      }
    } else {
      report.checks.curationGuidelinesHealth.passed = false;
      report.passed = false;
      console.log(`❌ FAIL: CurationGuidelines node not found`);
      report.recommendations.push("Create CurationGuidelines node with schema vocabulary");
    }
    console.log("");

  } catch (error) {
    console.error("❌ Error during compliance test:", error);
    report.passed = false;
    throw error;
  } finally {
    await service.close();
  }

  return report;
}

async function main() {
  try {
    const report = await runSchemaComplianceTest();

    console.log("🧠 ================================================");
    console.log("🧠 COMPLIANCE TEST SUMMARY");
    console.log("🧠 ================================================");
    console.log("");

    if (report.passed) {
      console.log("✅ ✅ ✅ ALL CHECKS PASSED ✅ ✅ ✅");
      console.log("");
      console.log("🎉 Schema coherence is maintained!");
      console.log("📊 Current state:");
      console.log(`   • Property count: ${report.checks.propertyCount.current}/${report.checks.propertyCount.max}`);
      console.log(`   • Core label usage: ${(report.checks.coreLabelsUsage.percentage * 100).toFixed(1)}%`);
      console.log(`   • Core relationship usage: ${(report.checks.coreRelationshipsUsage.percentage * 100).toFixed(1)}%`);
      console.log(`   • Ghost properties: ${report.checks.ghostProperties.count}`);
    } else {
      console.log("❌ ❌ ❌ COMPLIANCE ISSUES DETECTED ❌ ❌ ❌");
      console.log("");
      console.log("⚠️  Action required to maintain schema coherence:");
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    console.log("");
    console.log(`📅 Test completed at: ${report.timestamp}`);
    console.log("🧠 ================================================");
    console.log("");

    process.exit(report.passed ? 0 : 1);

  } catch (error) {
    console.error("💥 Fatal error during schema compliance test:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runSchemaComplianceTest };
