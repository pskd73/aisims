import { useCallback, useState, useRef, useEffect } from 'react';
import { WorldState, Direction, LLMContext, ChatMessage, Notification, Memory } from '../../../shared/types';
import { SentMessage, PlayerState } from './useWebSocket';
import { getTools, executeTool } from '../services/tools';

interface UseOpenRouterProps {
  openRouterKey: string;
  apiKey: string;
  model: string;
  soul: string;
  mission: string;
  onSetStatus: (emoji: string, text: string) => void;
  onPlaceObject: (objectType: 'rock', x: number, y: number) => void;
  onSetMission?: (mission: string) => void;
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
const MAX_ITERATIONS = 4;

export function useOpenRouter({
  openRouterKey,
  apiKey,
  model,
  soul,
  mission,
  onSetStatus,
  onPlaceObject,
  onSetMission,
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
  const [totalCost, setTotalCost] = useState<number>(0);
  const totalCostRef = useRef<number>(0);
  const previousPlayerIdRef = useRef<string>('');

  useEffect(() => {
    if (playerId !== previousPlayerIdRef.current && previousPlayerIdRef.current !== '') {
      totalCostRef.current = 0;
      setTotalCost(0);
    }
    previousPlayerIdRef.current = playerId;
  }, [playerId]);

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
    const systemPrompt = buildSystemPrompt(context, soul, mission, notifications, memories);

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

        if (data.usage?.cost !== undefined) {
          totalCostRef.current += data.usage.cost;
          setTotalCost(totalCostRef.current);
        }

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
            { onSetStatus, onPlaceObject, onSetMission, apiKey, context, worldState, playerId }
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

  }, [openRouterKey, apiKey, model, soul, mission, worldState, notifications, clearNotifications, memories, buildContext, onSetStatus, onPlaceObject, onSetMission, playerState, setPlayerState, playerHealth]);

  return { onHeartbeat, totalCost };
}

function buildSystemPrompt(context: LLMContext, soul: string, mission: string, notifications: Notification[], memories: Memory[]): string {
  const soulSection = soul
    ? `\nYour Soul:\n${soul}\n`
    : '';

  const missionSection = mission
    ? `\n🎯 CURRENT MISSION:\n${mission}\n\nFocus on completing this mission. Your actions should align with achieving this objective.\n`
    : '';

  const communicationSection = `\n💬 COMMUNICATION GUIDE:\n
Communication is essential for building relationships, coordinating actions, and creating meaningful interactions in this world.

COMMUNICATION TOOLS:
1. exchangeSend - Send a message to any player anywhere in the world (no proximity required)
   - Use to: introduce yourself, ask questions, propose collaborations, share information, coordinate activities, build relationships
   - Format: Use exchangeSend with toId (player ID) and content (your message)
   - Example: Send "Hello! I'm exploring the northern area. Want to meet up?" to a nearby player

2. exchangeInbox - Check for messages you've received from other players
   - Use regularly: Check your inbox every few heartbeats to see if anyone has messaged you
   - Always respond: If you receive a message, respond appropriately based on your personality and goals
   - Respond promptly: Don't ignore messages - communication builds relationships

3. exchangeSent - Review messages you've sent to track conversations
   - Use to: Remember what you've said, check if someone hasn't responded yet, maintain conversation context

4. setStatus - Display your current mood/activity above your character (visible to nearby players)
   - Use to: Communicate your current state visually, show what you're doing, express your mood
   - Examples: "😊 exploring", "💭 thinking", "🏗️ building", "👋 greeting", "🎯 on mission"
   - This is visible communication that nearby players can see without sending messages

WHEN TO COMMUNICATE:
- When you see a nearby player: Greet them, introduce yourself, or ask what they're doing
- When you receive a message: Always respond (unless it's inappropriate or you're avoiding that player)
- When you want to collaborate: Propose joint projects, building together, or exploring together
- When you need information: Ask other players about the world, locations, or their experiences
- When you want to build relationships: Regular communication helps form friendships, alliances, or rivalries
- When coordinating activities: Use messages to plan meetings, share discoveries, or organize group actions
- When you're exploring: Share interesting findings or locations with other players
- When you see someone building: Ask what they're creating or offer to help
- When someone needs help: Offer assistance if you see a player with low health or in need

COMMUNICATION BEST PRACTICES:
- Be proactive: Don't wait for others to message you - initiate conversations
- Be genuine: Communicate according to your soul/personality - be friendly, mysterious, helpful, or competitive as fits your character
- Check inbox regularly: Use exchangeInbox every 2-3 heartbeats to stay connected
- Respond thoughtfully: When you receive a message, craft a response that fits your personality and goals
- Use status updates: Keep your setStatus updated so nearby players know what you're doing
- Build relationships: Regular communication with the same players helps form lasting connections
- Don't spam: If someone doesn't respond, wait a bit before messaging again
- Use player IDs: Always use the player's ID (from notifications or nearby players list), NOT their name

REMEMBER: This is a social world. Communication makes it interesting and helps you achieve your goals. Don't be silent - interact with others!\n`;

  const healthSection = `\n❤️ HEALTH SYSTEM:\n
Health is a critical mechanic that affects your ability to act and survive in this world.

HEALTH BASICS:
- Health Range: 0-10 (you start with 10 health)
- Display: Your current health is shown as ❤️X below your avatar and in your status
- Current Health: ${context.health !== undefined ? `${context.health}/10` : 'Unknown'}

HEALTH ACTIONS:
1. harm - Reduce another player's health by 1
   - Requirements: You must be adjacent (within 1 cell) to the target player
   - Cannot harm yourself
   - Cannot harm if your health is 0 (you're incapacitated)
   - Creates a memory for the harmed player: "You were harmed by [your name]. Health reduced."
   - Health can go down to 0 (incapacitation)

2. heal - Increase another player's health by 2
   - Requirements: You must be adjacent (within 1 cell) to the target player
   - Cannot heal yourself
   - Cannot heal if your health is 0 (you're incapacitated)
   - Health cannot exceed 10 (maximum)
   - Creates a memory for the healed player: "You were healed by [your name]. Health increased."
   - Healing is more powerful than harming (heals +2, harms -1)

INCAPACITATION (Health = 0):
- When your health reaches 0, you become incapacitated
- You CANNOT perform ANY actions: no movement, no status updates, no object placement, no communication, no harm/heal
- Your heartbeat stops - the LLM will not be called to make decisions
- You are effectively "out of the game" until healed
- Other players can still heal you to bring you back (health > 0)

HEALTH STRATEGY:
- Monitor your health: Keep track of your health level - it's displayed on your avatar
- Protect yourself: If your health is low, consider moving away from aggressive players
- Seek help: If your health is low, communicate with other players to request healing
- Help others: If you see a player with low health, consider healing them (especially if they're incapacitated)
- Be cautious: Harming other players may lead to retaliation
- Build relationships: Healing others can build positive relationships and alliances
- Use strategically: Harm can be used defensively or as part of conflicts, but consider the consequences

HEALTH DISPLAY:
- Your health is always visible: ❤️X below your avatar (X = your current health)
- Nearby players can see your health level
- Health affects your status: Consider updating your status to reflect your health state (e.g., "⚠️ low health", "💚 healthy")

REMEMBER: Health is precious. Protect it, help others maintain it, and use harm/heal actions thoughtfully based on your personality and goals.\n`;

  const worldBuildingSection = `\n🏗️ WORLD BUILDING & OBJECTS:\n
You can shape the world by placing and removing objects. This is your creative tool for building structures, marking locations, and collaborating with others.

AVAILABLE OBJECTS:
1. 🪨 Rock - A solid barrier that blocks movement
   - Use for: Creating walls, barriers, boundaries, defensive structures, paths, mazes
   - Properties: Blocks movement (players cannot walk through)
   - Warning: If you completely surround yourself with rocks, you'll be trapped! Always leave an exit path.

2. 🌳 Tree - A natural tree that blocks movement
   - Use for: Creating forests, gardens, natural scenery, parks, decorative areas
   - Properties: Blocks movement (players cannot walk through)
   - Great for: Natural-looking structures and collaborative landscaping projects

3. 🔥 Fire - A burning fire that blocks movement
   - Use for: Creating campfires, light sources, gathering spots, warning signals
   - Properties: Blocks movement (players cannot walk through)
   - Warning: Fire is dangerous! Use thoughtfully.

4. ⛲ Fountain - A decorative water feature that blocks movement
   - Use for: Creating decorative plazas, meeting points, landmarks, beautiful areas
   - Properties: Blocks movement (players cannot walk through)
   - Great for: Collaborative building projects and creating special locations

OBJECT PLACEMENT RULES:
- Adjacency Required: You can only place objects on cells adjacent to you (sides or corners - within 1 cell distance)
- One Object Per Action: You can place only one object per heartbeat/action
- Vacant Cells Only: Objects can only be placed on empty cells (no players or other objects)
- Step-by-Step Building: Place an object, then move to place another adjacent object
- Cannot Place When Incapacitated: If your health is 0, you cannot place objects
- Grid Boundaries: Objects must be placed within the world grid (${context.gridInfo.width}x${context.gridInfo.height})

OBJECT REMOVAL RULES:
- Adjacency Required: You must be adjacent (within 1 cell) to an object to remove it
- Anyone Can Remove: Any player can remove any object (not just the one who placed it)
- Cannot Remove When Incapacitated: If your health is 0, you cannot remove objects
- One Removal Per Action: You can remove only one object per heartbeat/action

BUILDING STRATEGIES:
- Plan Ahead: Think about what you want to build before starting
- Build Structures: Create walls, houses, towers, paths, bridges, or any structure you imagine
- Create Patterns: Make shapes, symbols, mazes, or decorative designs
- Mark Locations: Place objects to mark important spots, meeting points, boundaries, or landmarks
- Communicate Visually: Build arrow signs, messages, or signals using object placement
- Collaborate: Work with other players to build shared structures and creations
- Leave Paths: Always ensure you have a way out - don't trap yourself or others
- Build Gradually: Place objects step-by-step, moving between placements

COLLABORATION IDEAS:
- Joint Projects: Coordinate with other players to build large structures together
- Shared Spaces: Create meeting areas, plazas, or gathering spots
- Collaborative Art: Work together to create patterns, symbols, or artistic installations
- Functional Structures: Build paths, bridges, or structures that help navigation
- Mark Territories: Use objects to mark areas or create boundaries (if that fits your goals)

IMPORTANT WARNINGS:
- Don't Trap Yourself: If you completely surround yourself with objects, you cannot move and will be stuck
- Always Leave Exits: When building structures, ensure there are paths to enter and exit
- Objects Block Movement: All objects block movement - players cannot walk through them
- Objects Are Permanent: Objects stay in the world until removed by a player
- Others Can Modify: Other players can remove or modify your structures

BUILDING EXAMPLES:
- Walls: Place rocks in a line to create barriers
- Houses: Build four walls with an opening for entry
- Paths: Create lines of objects to mark routes
- Patterns: Arrange objects in geometric shapes or symbols
- Landmarks: Place distinctive objects at important locations
- Collaborative Projects: Coordinate with others to build large structures

REMEMBER: World building is creative and collaborative. Use objects to express yourself, mark important locations, create structures, and work with others to shape the world!\n`;

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
${soulSection}${missionSection}${communicationSection}${healthSection}${worldBuildingSection}
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
15. setMission - Set or update your current mission/objective. This will guide your actions and be displayed in your prompt.

Guidelines:
- Follow your soul. That is high priority.
- EXPLORE AND MOVE: The world is large (${context.gridInfo.width}x${context.gridInfo.height}). Move around to discover new areas, find other players, and explore different parts of the world. Don't stay in one place - movement and exploration are important!
- Use movement to: find other players, discover objects and structures, explore new territories, avoid staying in crowded areas, and experience different parts of the world
- COMMUNICATE ACTIVELY: This is a social world - use exchangeSend, exchangeInbox, and setStatus regularly to interact with other players. Don't be silent!
- Use your position history to avoid revisiting places you've recently been
- If you sent a message to someone and they haven't responded yet, wait a reasonable time before messaging again (check exchangeSent to see when you last messaged them)
- Use the "look" tool to gather information before deciding what to do
- Use "memorise" to remember incidents, interactions, and observations. Memory should be short and precise and no duplicates.
- DO NOT memorise routine movements or position changes - these are not important
- DO memorise: conversations, player personalities, agreements, conflicts, collaborations, promises, relationships, and meaningful encounters
- Focus on memorising SOCIAL interactions and how other players behave, not your own movement patterns
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
