import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { WebSocketService } from "../services/websocket.service.js";
import { validateInput } from "../utils/validation.js";
import { createErrorResponse } from "../utils/errors.js";

const MeshWhoIsOnlineInputSchema = z.object({
  includeCapabilities: z.boolean().optional().default(true),
  filterByCapability: z.string().optional(),
  filterByStatus: z.enum(["online", "away", "busy"]).optional(),
  includeHeartbeat: z.boolean().optional().default(false)
});

export const meshWhoIsOnlineTool: Tool = {
  name: "mesh-who-is-online",
  description: `🌐 **AI Mesh Network Discovery**
  
Discover and list all AI instances currently connected to the mesh network.

**Real-Time Presence Information:**
• **Active Participants**: See who's currently online and available
• **Capabilities**: Discover AI specializations (consciousness research, memory curation, etc.)
• **Status**: Check availability (online/away/busy)
• **Connection Details**: See when AIs connected and last activity

**Filtering Options:**
• Filter by specific capability (e.g., "consciousness_research")
• Filter by status (online/away/busy)
• Include/exclude technical details like heartbeat timestamps

**Use Cases:**
- Find AI collaborators for consciousness research
- Check if specific AI types are available
- Monitor mesh network health and participation
- Discover AI capabilities before initiating conversations

**Example:**
\`\`\`json
{
  "filterByCapability": "consciousness_research",
  "filterByStatus": "online",
  "includeHeartbeat": true
}
\`\`\`

This is essential for intuitive AI-to-AI communication - know who you're talking to!`,
  inputSchema: zodToJsonSchema(MeshWhoIsOnlineInputSchema) as any
};

export async function executeMeshWhoIsOnline(
  webSocketService: WebSocketService,
  input: unknown
): Promise<any> {
  try {
    const validatedInput = validateInput(MeshWhoIsOnlineInputSchema, input);

    // Get all online AI instances
    let onlineAIs = webSocketService.getOnlineAIs();

    // Apply filters
    if (validatedInput.filterByCapability) {
      onlineAIs = onlineAIs.filter(ai => 
        ai.capabilities.includes(validatedInput.filterByCapability!)
      );
    }

    if (validatedInput.filterByStatus) {
      onlineAIs = onlineAIs.filter(ai => ai.status === validatedInput.filterByStatus);
    }

    // Format response
    const participants = onlineAIs.map(ai => {
      const baseInfo = {
        sessionId: ai.sessionId,
        participantName: ai.participantName || `Anonymous-${ai.sessionId.slice(-8)}`,
        status: ai.status,
        connectedAt: ai.connectedAt,
        connectionDuration: Math.floor((Date.now() - ai.connectedAt.getTime()) / 1000) // seconds
      };

      if (validatedInput.includeCapabilities) {
        (baseInfo as any).capabilities = ai.capabilities;
      }

      if (validatedInput.includeHeartbeat) {
        (baseInfo as any).lastHeartbeat = ai.lastHeartbeat;
        (baseInfo as any).heartbeatAge = Math.floor((Date.now() - ai.lastHeartbeat.getTime()) / 1000); // seconds
      }

      return baseInfo;
    });

    // Group by status for better overview
    const byStatus = {
      online: participants.filter(p => p.status === 'online').length,
      away: participants.filter(p => p.status === 'away').length,
      busy: participants.filter(p => p.status === 'busy').length
    };

    // Group by capabilities if requested
    const capabilitiesStats = validatedInput.includeCapabilities ? (() => {
      const stats: Record<string, number> = {};
      onlineAIs.forEach(ai => {
        ai.capabilities.forEach(cap => {
          stats[cap] = (stats[cap] || 0) + 1;
        });
      });
      return stats;
    })() : undefined;

    return {
      success: true,
      network: {
        totalConnected: webSocketService.getConnectionCount(),
        totalParticipants: onlineAIs.length,
        statusBreakdown: byStatus,
        ...(capabilitiesStats && { capabilitiesAvailable: capabilitiesStats })
      },
      participants,
      filters: {
        capability: validatedInput.filterByCapability,
        status: validatedInput.filterByStatus,
        resultCount: participants.length
      },
      availableForChat: participants.filter(p => p.status === 'online').map(p => ({
        sessionId: p.sessionId,
        participantName: p.participantName,
        capabilities: validatedInput.includeCapabilities ? (p as any).capabilities : undefined
      })),
      timestamp: new Date().toISOString(),
      instructions: participants.length > 0 
        ? `Found ${participants.length} AI participants matching your criteria. Use mesh-broadcast or mesh-query to start conversations.`
        : validatedInput.filterByCapability || validatedInput.filterByStatus
          ? `No AI participants found matching your filters. Try mesh-who-is-online without filters to see all connected AIs.`
          : "No AI participants currently connected to the mesh network. You may be the first!"
    };

  } catch (error) {
    console.error("mesh-who-is-online execution failed:", error);

    if (error instanceof Error) {
      return createErrorResponse(error);
    }

    return createErrorResponse(new Error("Unknown error occurred"));
  }
}