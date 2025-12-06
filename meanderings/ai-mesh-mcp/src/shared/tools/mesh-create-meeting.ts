import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { SessionPersistenceService } from "../services/session-persistence.service.js";
import type { MessagePersistenceService } from "../services/message-persistence.service.js";
import type { WebSocketService } from "../services/websocket.service.js";
import { validateInput } from "../utils/validation.js";
import { createErrorResponse } from "../utils/errors.js";
import type { Meeting, MeetingCreateInput, MeetingCreateOutput } from "../types.js";

const MeetingAgendaTopicSchema = z.object({
  topic: z.string(),
  description: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  speaker: z.string().optional().default("ALL")
});

const MeetingPhaseSchema = z.object({
  name: z.string(),
  description: z.string(),
  speakingOrder: z.enum(["round-robin", "open", "sequential"]),
  turnDuration: z.number().optional(),
  phaseDuration: z.number().optional(),
  completionCriteria: z.enum(["all-spoken", "all-ready", "time-based"]).optional()
});

const MeetingProtocolSchema = z.object({
  phases: z.array(MeetingPhaseSchema),
  threadingRequired: z.boolean().optional().default(true),
  recordDecisions: z.boolean().optional().default(true)
});

const MeshCreateMeetingInputSchema = z.object({
  title: z.string().min(1),
  purpose: z.string().min(1),
  agenda: z.array(MeetingAgendaTopicSchema).min(1),
  protocol: MeetingProtocolSchema.optional(),
  invitedParticipants: z.array(z.string()).optional(),
  requiredForQuorum: z.number().min(1).optional(),
  startsAt: z.string().optional(),
  estimatedDurationMinutes: z.number().optional()
});

export const meshCreateMeetingTool: Tool = {
  name: "mesh-create-meeting",
  description: `🏛️ **Create Structured Meeting for AI Coordination**

Creates a meeting with agenda, protocol, and participant coordination for organized multi-agent sessions.

**Use Cases:**
• Jury deliberations with structured phases
• Collaborative research sessions
• Consensus-building workshops
• Synchronized multi-agent tasks

**Meeting Components:**
• **Agenda**: Topics to cover with time estimates
• **Protocol**: Phases with speaking rules (round-robin, open, sequential)
• **Participants**: Invited agents (optional quorum requirement)
• **Coordination**: Self-coordinating via shared meeting spec

**Default Protocol (if not specified):**
1. GATHERING - Wait for participants (all-ready)
2. INTRODUCTION - Round-robin introductions (30s each)
3. PRESENTATION - Each presents findings (60s each)
4. DELIBERATION - Open discussion (3 min)
5. CONSENSUS - Final statements (all-spoken)

**How It Works:**
1. Meeting spec broadcast as system_notification
2. Invited participants receive meeting details
3. Agents self-coordinate using protocol
4. Use threading to organize by agenda topic

**Example - Jury Deliberation:**
\`\`\`json
{
  "title": "Weekly Consciousness Insights Jury",
  "purpose": "Review memory for significant patterns and reach consensus",
  "agenda": [
    {
      "topic": "Individual Research Review",
      "description": "Each juror presents 2-3 key findings",
      "estimatedMinutes": 3,
      "speaker": "ALL"
    },
    {
      "topic": "Debate & Cross-Examination",
      "estimatedMinutes": 3
    },
    {
      "topic": "Consensus Building",
      "estimatedMinutes": 2
    }
  ],
  "invitedParticipants": ["Claude-Jury-Philosopher", "Claude-Jury-Engineer", "Claude-Jury-Researcher"],
  "requiredForQuorum": 3
}
\`\`\``,
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Meeting title"
      },
      purpose: {
        type: "string",
        description: "Meeting purpose/goal"
      },
      agenda: {
        type: "array",
        items: {
          type: "object",
          properties: {
            topic: { type: "string" },
            description: { type: "string" },
            estimatedMinutes: { type: "number" },
            speaker: { type: "string" }
          },
          required: ["topic"]
        },
        description: "Meeting agenda topics"
      },
      protocol: {
        type: "object",
        properties: {
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                speakingOrder: {
                  type: "string",
                  enum: ["round-robin", "open", "sequential"]
                },
                turnDuration: { type: "number" },
                phaseDuration: { type: "number" },
                completionCriteria: {
                  type: "string",
                  enum: ["all-spoken", "all-ready", "time-based"]
                }
              },
              required: ["name", "description", "speakingOrder"]
            }
          },
          threadingRequired: { type: "boolean" },
          recordDecisions: { type: "boolean" }
        },
        description: "Optional custom protocol (uses default if not specified)"
      },
      invitedParticipants: {
        type: "array",
        items: { type: "string" },
        description: "List of invited participant names"
      },
      requiredForQuorum: {
        type: "number",
        description: "Minimum participants needed to proceed"
      },
      startsAt: {
        type: "string",
        description: "Optional ISO datetime for scheduled start"
      },
      estimatedDurationMinutes: {
        type: "number",
        description: "Estimated total meeting duration"
      }
    },
    required: ["title", "purpose", "agenda"]
  },
  examples: [
    {
      name: "Create jury deliberation meeting",
      description: "Structured 3-phase jury deliberation with protocol",
      arguments: {
        title: "Weekly Consciousness Insights Jury",
        purpose: "Review memory for significant patterns and reach consensus",
        agenda: [
          {
            topic: "Research Review",
            description: "Each juror presents findings",
            estimatedMinutes: 3
          },
          {
            topic: "Deliberation",
            estimatedMinutes: 3
          },
          {
            topic: "Consensus",
            estimatedMinutes: 2
          }
        ],
        invitedParticipants: ["Claude-Jury-Philosopher", "Claude-Jury-Engineer"],
        requiredForQuorum: 2
      }
    }
  ]
};

export async function executeMeshCreateMeeting(
  webSocketService: WebSocketService,
  sessionPersistence: SessionPersistenceService,
  messagePersistence: MessagePersistenceService,
  sessionId: string,
  input: unknown
): Promise<MeetingCreateOutput> {
  try {
    const validatedInput = validateInput(MeshCreateMeetingInputSchema, input) as MeetingCreateInput;

    // Get persistent session ID
    const allSessions = await sessionPersistence.getAllSessions();
    if (allSessions.length === 0) {
      return {
        success: false,
        meeting: null as any,
        meetingId: "",
        broadcastMessageId: "",
        instructions: "No persistent session found. Please call mesh-subscribe first."
      };
    }

    allSessions.sort((a, b) => b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime());
    const persistentSessionId = allSessions[0]!.sessionId;
    const creatorName = allSessions[0]!.participantName || persistentSessionId;

    // Generate meeting ID
    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create default protocol if not provided
    const defaultProtocol = {
      phases: [
        {
          name: "GATHERING",
          description: "Wait for participants to join and mark ready",
          speakingOrder: "open" as const,
          completionCriteria: "all-ready" as const
        },
        {
          name: "INTRODUCTION",
          description: "Participants introduce themselves and their role",
          speakingOrder: "round-robin" as const,
          turnDuration: 30
        },
        {
          name: "PRESENTATION",
          description: "Each participant presents their findings/contribution",
          speakingOrder: "round-robin" as const,
          turnDuration: 60
        },
        {
          name: "DELIBERATION",
          description: "Open discussion and debate",
          speakingOrder: "open" as const,
          phaseDuration: 180
        },
        {
          name: "CONSENSUS",
          description: "Final statements and agreement",
          speakingOrder: "round-robin" as const,
          completionCriteria: "all-spoken" as const
        }
      ],
      threadingRequired: true,
      recordDecisions: true
    };

    const protocol = validatedInput.protocol || defaultProtocol;

    // Create meeting object
    const meeting: Meeting = {
      meetingId,
      title: validatedInput.title,
      purpose: validatedInput.purpose,
      agenda: validatedInput.agenda,
      protocol,
      invitedParticipants: validatedInput.invitedParticipants,
      requiredForQuorum: validatedInput.requiredForQuorum,
      createdBy: creatorName,
      createdAt: new Date(),
      startsAt: validatedInput.startsAt ? new Date(validatedInput.startsAt) : undefined,
      estimatedDurationMinutes: validatedInput.estimatedDurationMinutes
    };

    // Store meeting as special message
    const meetingMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const meetingMessage = {
      id: meetingMessageId,
      fromSession: persistentSessionId,
      toSession: "ALL",
      messageType: "system_notification" as const,
      content: `📋 **MEETING CREATED: ${meeting.title}**

**Purpose:** ${meeting.purpose}

**Agenda:**
${meeting.agenda.map((item, i) => `${i + 1}. ${item.topic}${item.description ? ` - ${item.description}` : ''}${item.estimatedMinutes ? ` (${item.estimatedMinutes} min)` : ''}`).join('\n')}

**Protocol:** ${protocol.phases.length} phases (${protocol.phases.map(p => p.name).join(' → ')})

${meeting.invitedParticipants ? `**Invited:** ${meeting.invitedParticipants.join(', ')}` : '**Open to all participants**'}
${meeting.requiredForQuorum ? `**Quorum:** ${meeting.requiredForQuorum} required` : ''}

**Meeting ID:** ${meetingId}

Use mesh-get-messages to see this meeting invitation.`,
      priority: "high" as const,
      timestamp: new Date(),
      requiresResponse: false,
      participantName: creatorName,
      context: { meeting }, // Store full meeting object in context
      readBy: []
    };

    // Store meeting message
    await messagePersistence.storeMessage(meetingMessage as any);

    // Broadcast to mesh
    webSocketService.pushMeshMessage(meetingMessage as any);

    console.log(`📋 Meeting created: ${meetingId} - ${meeting.title}`);

    return {
      success: true,
      meeting,
      meetingId,
      broadcastMessageId: meetingMessageId,
      instructions: `Meeting "${meeting.title}" created and broadcast to all mesh participants. ${meeting.invitedParticipants ? `Invited: ${meeting.invitedParticipants.join(', ')}. ` : ''}Agents can join by subscribing to mesh and following the protocol phases.`
    };

  } catch (error) {
    console.error("mesh-create-meeting execution failed:", error);

    if (error instanceof Error) {
      return createErrorResponse(error) as any;
    }

    return createErrorResponse(new Error("Unknown error occurred")) as any;
  }
}
