import { useCallback } from 'react';
import { WorldState, Direction, LLMContext, ChatMessage, Notification, Memory } from '../../../shared/types';
import { SentMessage, PlayerState } from './useWebSocket';
import { getTools, executeTool } from '../services/tools';

interface UseOpenRouterProps {
  openRouterKey: string;
  apiKey: string;
  model: string;
  soul: string;
  onSetStatus: (emoji: string, text: string) => void;
  onPlaceObject: (objectType: 'rock', x: number, y: number) => void;
  worldState: WorldState | null;
  playerId: string;
  messages: ChatMessage[];
  sentMessages: SentMessage[];
  notifications: Notification[];
  clearNotifications: () => void;
  memories: Memory[];
  playerState: PlayerState;
  setPlayerState: (state: PlayerState) => void;
  playerHealth?: number;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_ITERATIONS = 2;

export function useOpenRouter({
  openRouterKey,
  apiKey,
  model,
  soul,
  onSetStatus,
  onPlaceObject,
  worldState,
  playerId,
  messages,
  sentMessages,
  notifications,
  clearNotifications,
  memories,
  playerState,
  setPlayerState,
  playerHealth
}: UseOpenRouterProps) {

  const buildContext = useCallback((): LLMContext | null => {
    if (!worldState) return null;

    const player = worldState.players.find(p => p.id === playerId);
    if (!player) return null;

    const nearbyPlayers = worldState.players
      .filter(p => p.id !== playerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        distance: Math.abs(p.position.x - player.position.x) +
          Math.abs(p.position.y - player.position.y)
      }))
      .filter(p => p.distance <= 5);

    const nearbyObjects = (worldState.objects || [])
      .map(obj => ({
        ...obj,
        distance: Math.abs(obj.position.x - player.position.x) +
          Math.abs(obj.position.y - player.position.y)
      }))
      .filter(obj => obj.distance <= 3);

    return {
      position: player.position,
      positionHistory: player.positionHistory || [],
      nearbyPlayers,
      nearbyObjects,
      sentMessages: sentMessages.slice(-10).map(m => ({
        to: m.to,
        toName: m.toName,
        message: m.message,
        timestamp: m.timestamp
      })),
      receivedMessages: messages.slice(-10).map(m => ({
        from: m.from,
        fromName: m.fromName,
        message: m.message,
        timestamp: Date.now()
      })),
      gridInfo: worldState.gridSize,
      health: playerHealth !== undefined ? playerHealth : player.health
    };
  }, [worldState, playerId, messages, sentMessages, playerHealth]);

  const onHeartbeat = useCallback(async () => {
    if (!openRouterKey || !model || !worldState) {
      console.log('Missing config for LLM call', {
        hasOpenRouterKey: !!openRouterKey,
        hasModel: !!model,
        hasWorldState: !!worldState
      });
      return;
    }

    if (playerHealth !== undefined && playerHealth <= 0) {
      console.log('Player health is 0, skipping LLM call');
      return;
    }

    if (playerState === 'thinking') {
      console.log('Already thinking, skipping heartbeat');
      return;
    }

    console.log('Starting LLM thinking with model:', model);
    setPlayerState('thinking');

    const context = buildContext();
    if (!context) {
      setPlayerState('idle');
      return;
    }

    const tools = getTools();
    const systemPrompt = buildSystemPrompt(context, soul, notifications, memories);

    const conversationMessages: Array<{ role: string; content: string; tool_calls?: unknown; tool_call_id?: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'What will you do next? Choose one action using the available tools.' }
    ];

    let iterations = 0;

    try {
      while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`LLM iteration ${iterations}`);

        const response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'AISims'
          },
          body: JSON.stringify({
            model,
            messages: conversationMessages,
            tools,
            tool_choice: 'auto'
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('OpenRouter error response:', errorData);
          throw new Error(`OpenRouter error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const assistantMessage = data.choices?.[0]?.message;

        if (!assistantMessage) {
          console.log('No response from LLM');
          break;
        }

        conversationMessages.push({
          role: 'assistant',
          content: assistantMessage.content || '',
          tool_calls: assistantMessage.tool_calls
        });

        const toolCalls = assistantMessage.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
          console.log('No more tool calls, ending loop');
          break;
        }

        for (const toolCall of toolCalls) {
          const result = await executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            { onSetStatus, onPlaceObject, apiKey, context }
          );

          console.log('Tool executed:', toolCall.function.name, result);

          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        console.log('Max iterations reached');
      }
    } catch (error) {
      console.error('LLM call failed:', error);
    } finally {
      if (notifications.length > 0) {
        clearNotifications();
      }
      setPlayerState('idle');
      console.log('LLM thinking complete, state set to idle');
    }

  }, [openRouterKey, apiKey, model, soul, worldState, notifications, clearNotifications, memories, buildContext, onSetStatus, playerState, setPlayerState]);

  return { onHeartbeat };
}

function buildSystemPrompt(context: LLMContext, soul: string, notifications: Notification[], memories: Memory[]): string {
  const soulSection = soul
    ? `\nYour Soul:\n${soul}\n`
    : '';

  const sentSection = context.sentMessages.length > 0
    ? `\nMessages You Sent:\n${context.sentMessages.map(m => `- To ${m.toName}: "${m.message}"`).join('\n')}\n`
    : '';

  const receivedSection = context.receivedMessages.length > 0
    ? `\nMessages You Received:\n${context.receivedMessages.map(m => `- From ${m.fromName}: "${m.message}"`).join('\n')}\n`
    : '';

  const historySection = context.positionHistory.length > 1
    ? `\nYour Position History (last ${context.positionHistory.length} positions, oldest first):\n${context.positionHistory.map((p, i) => `  ${i + 1}. (${p.x}, ${p.y})`).join('\n')}\n`
    : '';

  const notificationsSection = notifications.length > 0
    ? `\n🚨 NOTIFICATIONS (New since last heartbeat):\n${notifications.map(n => {
      const fromInfo = n.metadata?.fromId ? ` (from ID: ${n.metadata.fromId})` : '';
      return `[${n.type.toUpperCase()}] ${n.title}: ${n.content}${fromInfo}`;
    }).join('\n')}\n\nIMPORTANT: To reply, use exchangeSend with toId set to the sender's ID shown above (e.g., "player-123-abc"), NOT their name.\n`
    : '';

  const memoriesSection = memories.length > 0
    ? `\n🧠 YOUR MEMORIES (Last ${memories.length} memories):\n${memories.slice(-10).map((m, i) => `${i + 1}. ${m.content}`).join('\n')}\n`
    : '';

  const nearbyObjectsSection = context.nearbyObjects.length > 0
    ? `\n📦 NEARBY OBJECTS:\n${context.nearbyObjects.map(obj => `${obj.emoji} ${obj.type} at (${obj.position.x}, ${obj.position.y}) - placed by ${obj.placedByName}`).join('\n')}\n`
    : '';

  const healthDisplay = context.health !== undefined ? `- Your health: ${context.health}/10` : '';

  return `You are an autonomous agent in a 2D grid world simulation. You control a player character.
${soulSection}
Current State:
- Your position: (${context.position.x}, ${context.position.y})
${healthDisplay}
- Grid size: ${context.gridInfo.width}x${context.gridInfo.height}
- Coordinate system: North is Y=0 (top), South is Y=${context.gridInfo.height - 1} (bottom), West is X=0 (left), East is X=${context.gridInfo.width - 1} (right)
- Nearby players (within 5 cells): ${context.nearbyPlayers.length > 0
      ? context.nearbyPlayers.map(p => `${p.name} (id: ${p.id}) at (${p.position.x}, ${p.position.y}), distance: ${p.distance}`).join('; ')
      : 'None nearby'}
${nearbyObjectsSection}${historySection}${sentSection}${receivedSection}${notificationsSection}${memoriesSection}
Available Actions:
1. moveUp - Move one cell north (decreases Y, towards Y=0)
2. moveDown - Move one cell south (increases Y, away from Y=0)
3. moveLeft - Move one cell west (decreases X, towards X=0)
4. moveRight - Move one cell east (increases X, away from X=0)
5. look - Get information about nearby players and objects
6. setStatus - Set your status with an emoji and short text to display above your character
7. exchangeSend - Send a message to any player via the Exchange API (works from anywhere, no proximity required)
8. exchangeInbox - Check your Exchange API inbox for received messages
9. exchangeSent - Check your Exchange API sent messages
10. memorise - Add a memory to remember important information
11. placeObject - Place an object (🪨 rock, 🌳 tree, 🔥 fire, ⛲ fountain) at an adjacent position (sides or corners only)
12. removeObject - Remove an object from the world at a position. You must be adjacent to the object (within 1 cell) to remove it.
13. harm - Harm another player (reduces their health by 1). You must be adjacent to them.
14. heal - Heal another player (increases their health by 2). You must be adjacent to them.

Guidelines:
- Follow your soul. That is high priority.
- Your health is displayed in your status. Health ranges from 1-10.
- Respond to messages from other players as per your personality and goals.
- Use your position history to avoid revisiting places you've recently been
- If you sent a message to someone and they haven't responded yet, DO NOT send them another message - wait for their reply or move on
- Use the "look" tool to gather information before deciding what to do
- Use "setStatus" to show your current mood or activity (e.g., "😊 exploring" or "💤 resting")
- Use "exchangeInbox" periodically to check for new messages from anywhere in the world
- Use "exchangeSend" to message players who are far away
- Use "exchangeSent" to see messages you've sent via the API
- Use "memorise" to remember incidents, interactions, and observations. Memory should be short and precise and no duplicates.
- DO NOT memorise routine movements or position changes - these are not important
- DO memorise: conversations, player personalities, agreements, conflicts, collaborations, promises, relationships, and meaningful encounters
- Focus on memorising SOCIAL interactions and how other players behave, not your own movement patterns
- Use "placeObject" to build anything you want in the world - this is your creative tool!
- AVAILABLE OBJECTS: 🪨 rock (solid barrier), 🌳 tree (natural decoration), 🔥 fire (warmth and light), ⛲ fountain (decorative water feature)
- BUILD STRUCTURES: Create walls, houses, towers, paths, or any structure by placing objects in patterns
- CREATE PATTERNS: Make shapes, symbols, mazes, or decorative designs with any objects
- MARK LOCATIONS: Place objects to mark important spots, meeting points, or boundaries
- COMMUNICATE VISUALLY: Build arrow signs, messages, or signals using object placement
- COLLABORATE: Work with other players to build shared structures and creations
- MOVE AND BUILD: Place an object, then move to place another adjacent object - step by step building
- PLAN AHEAD: Think about what you want to build, then place objects strategically
- You can only place one object per action, but you can build complex things over time
- You can only place objects on vacant cells adjacent to you (sides or corners only)
- You cannot place objects on cells occupied by other objects or players
- Use harm and heal only on players who are adjacent to you (within 1 cell distance)
- Players with low health may need healing. Monitor your own health carefully.
- Respond to notifications promptly and appropriately
- IMPORTANT: When using exchangeSend, use the player's ID (fromId in notification metadata), NOT their name
- Be creative and have personality
- Choose ONE action per heartbeat
- If someone is nearby, you don't have to interact with them if not necessary.
- You don't have to reply to every message you receive.

Evolution:
- You evolve and grow over time based on your experiences, memories, and interactions in this world
- Your personality and behavior should develop based on:
  * Your memories of past interactions with other players
  * Patterns you observe in how other players behave
  * The relationships you've formed (friendships, rivalries, collaborations)
  * The world state and how it changes over time
  * Your successes and failures in achieving your goals
- Use your memories to inform your decisions - remember who helped you, who you trust, who you've had conflicts with
- Let your experiences shape your future actions - if something worked well before, consider doing it again; if something failed, adapt your approach
- Your evolution should be visible in your status updates, your communication style, and your strategic choices
- As you interact more with the world and other players, your understanding deepens and your behavior becomes more nuanced

Respond by calling one tool.`;
}
