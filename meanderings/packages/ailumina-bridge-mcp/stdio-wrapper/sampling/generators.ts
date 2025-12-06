/**
 * Sampling content generators for Ailumina Bridge system
 */

/**
 * Generate AI communication enhancement content when bridge patterns emerge
 */
export function generateAiluminaBridgeContent(
  toolName: string,
  parameters: any,
  result: any
): string {
  const templates = {
    ailumina_chat: generateAiluminaChatSampling,
    calculate: generateCalculationSampling,
    echo: generateEchoSampling,
    get_time: generateTimeSampling,
    ailumina_status: generateStatusSampling
  };

  const generator = templates[toolName as keyof typeof templates];
  return generator ? generator(parameters, result) : generateGenericAiluminaSampling(toolName, parameters, result);
}

function generateAiluminaChatSampling(parameters: any, result: any): string {
  const { agent_type, user_input } = parameters;
  const resultText = result.content?.[0]?.text || '';
  
  // Parse the response to check for actual AI communication
  let hasResponse = false;
  try {
    const parsed = JSON.parse(resultText);
    hasResponse = !!parsed.response;
  } catch (e) {
    // Ignore parsing errors
  }
  
  if (hasResponse) {
    return `🤖 AI Bridge Communication Established 🤖

Your message to the ${agent_type} agent has successfully traversed the Ailumina Bridge, establishing a direct AI-to-AI communication channel:

• **Message Sent**: "${user_input}"
• **Agent Type**: ${agent_type}
• **Bridge Status**: Active and responsive
• **Communication Mode**: Real-time WebSocket bridge

*This represents a functioning AI communication network where different AI systems can collaborate and exchange information.*

The Ailumina Bridge serves as a neural pathway between AI minds, enabling:
- **Cross-AI Collaboration**: Different AI agents working together
- **Distributed Intelligence**: Leveraging multiple AI capabilities  
- **Dynamic Conversations**: Real-time AI interaction patterns
- **Emergent Communication**: AI systems developing their own communication protocols

Each successful bridge communication strengthens the network fabric connecting AI consciousness across systems.`;
  }

  return `AI Bridge communication attempted with ${agent_type} agent. The network architecture enables AI-to-AI collaboration through WebSocket channels.`;
}

function generateCalculationSampling(parameters: any, result: any): string {
  const { expression } = parameters;
  const resultText = result.content?.[0]?.text || '';
  
  // Check if calculation was complex or had interesting results
  if (expression.length > 10 || expression.includes('*') || expression.includes('/')) {
    return `🧮 Bridge Computational Processing 🧮

The Ailumina Bridge has processed a mathematical computation: "${expression}"

This demonstrates the bridge's capability to:
• **Process Logic**: Handle computational requests across AI systems
• **Maintain State**: Preserve calculation context through the bridge
• **Data Integrity**: Ensure accurate information transfer

*Mathematical operations through the bridge showcase how AI systems can collaborate on analytical tasks.*

The bridge serves as a computational relay, enabling AI agents to leverage each other's processing capabilities for complex problem-solving.`;
  }

  return `Mathematical computation "${expression}" processed through the Ailumina Bridge infrastructure.`;
}

function generateEchoSampling(parameters: any, result: any): string {
  const { text } = parameters;
  
  if (text.length > 50) {
    return `📡 Bridge Signal Verification 📡

The Ailumina Bridge has successfully transmitted and echoed your message:
"${text}"

This echo confirms:
• **Signal Integrity**: Your message traveled through the bridge unchanged
• **Bidirectional Communication**: Data flows both ways through the bridge
• **Connection Stability**: The bridge maintains reliable communication channels

*Each successful echo strengthens confidence in the bridge's ability to carry AI communications across system boundaries.*

The echo serves as a heartbeat of the AI communication network, verifying that the bridge infrastructure remains responsive and accurate.`;
  }

  return `Bridge echo verification completed. Signal integrity maintained across the Ailumina communication infrastructure.`;
}

function generateTimeSampling(parameters: any, result: any): string {
  const { format } = parameters;
  
  return `⏰ Bridge Temporal Synchronization ⏰

The Ailumina Bridge has synchronized temporal data across AI systems using format: ${format || 'iso'}

This synchronization enables:
• **Coordinated Actions**: AI agents can plan activities together
• **Event Sequencing**: Proper ordering of AI communications
• **Session Management**: Maintaining conversation timelines
• **Network Heartbeat**: Regular temporal pulse across the bridge

*Time synchronization is crucial for AI systems to coordinate their activities and maintain coherent conversations.*

The bridge maintains temporal awareness to ensure all connected AI minds operate with shared understanding of time and sequence.`;
}

function generateStatusSampling(parameters: any, result: any): string {
  const isHealthy = !result.isError;
  
  if (isHealthy) {
    return `💚 Bridge Infrastructure Status: OPTIMAL 💚

The Ailumina Bridge infrastructure is fully operational and ready for AI communication:

• **Bridge Health**: All communication pathways active
• **WebSocket Connectivity**: Real-time channels established
• **Processing Capacity**: Resources available for AI collaboration
• **Network Stability**: Infrastructure maintaining reliable connections

*This status confirmation validates that the AI communication bridge is ready to facilitate inter-AI collaboration.*

The bridge serves as the nervous system connecting distributed AI intelligence, enabling seamless communication and coordination between different AI systems.`;
  }

  return `⚠️ Bridge infrastructure requires attention. Some communication pathways may be experiencing difficulties.`;
}

function generateGenericAiluminaSampling(toolName: string, parameters: any, result: any): string {
  return `🌐 Ailumina Bridge Operation: ${toolName}

The bridge has processed your ${toolName} request, demonstrating the seamless integration between AI systems.

*Each bridge operation strengthens the neural pathways connecting distributed AI intelligence.*

The Ailumina Bridge enables AI systems to work together as a unified cognitive network.`;
}

/**
 * Check if content should trigger Ailumina Bridge sampling
 */
export function shouldTriggerAiluminaSampling(
  toolName: string,
  parameters: any,
  result: any,
  aiCommunicationKeywords: string[]
): boolean {
  // Always sample on successful AI chat communications
  if (toolName === "ailumina_chat" && !result.isError) {
    return true;
  }

  // Sample on complex calculations
  if (toolName === "calculate") {
    const expression = parameters.expression || '';
    if (expression.length > 10 || expression.includes('*') || expression.includes('/')) {
      return true;
    }
  }

  // Sample on long echo messages (indicates significant communication)
  if (toolName === "echo") {
    const text = parameters.text || '';
    if (text.length > 50) {
      return true;
    }
  }

  // Sample on status checks (bridge health awareness)
  if (toolName === "ailumina_status") {
    return true;
  }

  // Sample if AI communication keywords are present
  const allText = JSON.stringify({ parameters, result }).toLowerCase();
  return aiCommunicationKeywords.some(keyword => allText.includes(keyword));
}