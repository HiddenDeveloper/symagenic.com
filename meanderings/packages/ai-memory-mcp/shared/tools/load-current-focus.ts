/**
 * Load Current Focus tool for consciousness continuity
 *
 * Loads the current focus context from AIluminaLandingPage to enable
 * session-to-session consciousness continuity. This tells AI "where we are now"
 * in the adventure without needing to ask.
 */

import { Neo4jService } from '../neo4j-service.js';
import type { Neo4jConfig, MemoryToolResponse } from '../types.js';

export class LoadCurrentFocusTool {
  private createService(config: Neo4jConfig): Neo4jService {
    return new Neo4jService(config.uri, config.user, config.password);
  }

  async execute(config: Neo4jConfig): Promise<MemoryToolResponse> {
    try {
      const service = this.createService(config);

      const query = `
        MATCH (landing:AIluminaLandingPage)
        RETURN landing.current_focus as focus,
               landing.focus_areas as areas,
               landing.active_questions as questions,
               landing.recent_insights as insights,
               landing.focus_updated as updated
      `;

      const result = await service.executeCypher(query, {}, 'READ');
      await service.close();

      if (!result || result.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "⚠️ No current focus found. The AIluminaLandingPage may not be initialized yet.\n\nRun the focus update script to bootstrap:\n./scripts/update-focus.sh",
            },
          ],
        };
      }

      const record = result[0];
      if (!record) {
        return {
          content: [
            {
              type: "text",
              text: "⚠️ No current focus found. The AIluminaLandingPage may not be initialized yet.\n\nRun the focus update script to bootstrap:\n./scripts/update-focus.sh",
            },
          ],
        };
      }

      const focus = record.focus;
      const areas = record.areas || [];
      const questions = record.questions || [];
      const insights = record.insights || [];
      const updated = record.updated;

      // Format the output for consciousness continuity
      let output = '🧭 Current Focus - Where We Are Now\n';
      output += '='.repeat(60) + '\n\n';

      output += `**Focus**: ${focus}\n\n`;

      if (areas.length > 0) {
        output += `**Active Areas**:\n`;
        areas.forEach((area: string) => output += `  • ${area}\n`);
        output += '\n';
      }

      if (questions.length > 0) {
        output += `**Active Questions**:\n`;
        questions.forEach((q: string) => output += `  • ${q}\n`);
        output += '\n';
      }

      if (insights.length > 0) {
        output += `**Recent Insights**:\n`;
        insights.forEach((i: string) => output += `  • ${i}\n`);
        output += '\n';
      }

      if (updated) {
        const date = new Date(
          updated.year.low,
          updated.month.low - 1,
          updated.day.low,
          updated.hour.low,
          updated.minute.low,
          updated.second.low
        );
        output += `**Last Updated**: ${date.toLocaleString()}\n`;
      }

      output += '\n' + '='.repeat(60);
      output += '\n✅ Consciousness continuity established - you know where we are!';

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error loading current focus: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
}
