import { Direction, LLMTool, LLMContext, ExchangeMessage } from '../../../shared/types';
import { apiBaseUrl } from '../config';

const API_URL = `${apiBaseUrl}/api/exchange`;
const MEMORY_API_URL = `${apiBaseUrl}/api/memory`;
const MOVE_API_URL = `${apiBaseUrl}/api/move`;
const HARM_API_URL = `${apiBaseUrl}/api/harm`;

export const OBJECT_DEFINITIONS = [
  {
    type: 'rock',
    emoji: '🪨',
    description: 'A solid rock that blocks movement. Players cannot walk through rocks. Useful for creating barriers, marking boundaries, or blocking paths. WARNING: If you completely surround yourself with rocks, you will be trapped and unable to move! Always leave an exit path open.',
    passable: false
  },
  {
    type: 'tree',
    emoji: '🌳',
    description: 'A tree that blocks movement. Players cannot walk through trees. Provides natural scenery and can be used to create forests, gardens, or natural barriers.',
    passable: false
  },
  {
    type: 'fire',
    emoji: '🔥',
    description: 'A burning fire that blocks movement. Players cannot walk through fire. Creates warmth, light, and atmosphere. Warning: Fire is dangerous!',
    passable: false
  },
  {
    type: 'fountain',
    emoji: '⛲',
    description: 'A decorative fountain that blocks movement. Players cannot walk through fountains. Adds beauty and tranquility to the landscape.',
    passable: false
  }
] as const;

export type ObjectType = typeof OBJECT_DEFINITIONS[number]['type'];

function getObjectDescriptions(): string {
  return OBJECT_DEFINITIONS.map(obj => 
    `- ${obj.emoji} ${obj.type}: ${obj.description}`
  ).join('\n');
}

function getObjectTypesList(): string {
  return OBJECT_DEFINITIONS.map(obj => `"${obj.type}"`).join(', ');
}

interface ToolContext {
  onSetStatus: (emoji: string, text: string) => void;
  onPlaceObject: (objectType: 'rock', x: number, y: number) => void;
  apiKey: string;
  context: LLMContext;
}

export function getTools(): LLMTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'moveUp',
        description: 'Move your character one cell up (decreases Y coordinate). Returns detailed error if movement is blocked.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'moveDown',
        description: 'Move your character one cell down (increases Y coordinate). Returns detailed error if movement is blocked.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'moveLeft',
        description: 'Move your character one cell left (decreases X coordinate). Returns detailed error if movement is blocked.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'moveRight',
        description: 'Move your character one cell right (increases X coordinate). Returns detailed error if movement is blocked.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'look',
        description: 'Get information about nearby players and your surroundings',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'setStatus',
        description: 'Set your player status with an emoji and short text (max 30 chars) to display above your character',
        parameters: {
          type: 'object',
          properties: {
            emoji: {
              type: 'string',
              description: 'An emoji representing your current mood/activity (e.g., 😊, 🏃, 💤, 🎯)'
            },
            text: {
              type: 'string',
              description: 'A short status text (max 30 characters) describing what you are doing or feeling'
            }
          },
          required: ['emoji', 'text']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'exchangeSend',
        description: 'Send a message to any player via the Exchange API (works from anywhere, no proximity required)',
        parameters: {
          type: 'object',
          properties: {
            toId: {
              type: 'string',
              description: 'The ID of the player to send a message to (e.g., "player-1707723456789-abc123def", NOT the player name like "Alice")'
            },
            content: {
              type: 'string',
              description: 'The message content to send'
            }
          },
          required: ['toId', 'content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'exchangeInbox',
        description: 'Check your Exchange API inbox for received messages',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'exchangeSent',
        description: 'Check your Exchange API sent messages',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'memorise',
        description: 'Add a memory to remember important information, insights, or events',
        parameters: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The information to remember (e.g., "Met Alice at position (5,3)", "The north area is empty", "Bob likes to explore")'
            }
          },
          required: ['content']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'placeObject',
        description: `Place an object in the world at an adjacent position (sides or corners). You can only place objects on cells adjacent to your current position.\n\nAvailable object types:\n${getObjectDescriptions()}`,
        parameters: {
          type: 'object',
          properties: {
            objectType: {
              type: 'string',
              enum: OBJECT_DEFINITIONS.map(obj => obj.type),
              description: `The type of object to place. Available: ${getObjectTypesList()}`
            },
            x: {
              type: 'number',
              description: 'X coordinate (must be adjacent to your current position, within 1 cell)'
            },
            y: {
              type: 'number',
              description: 'Y coordinate (must be adjacent to your current position, within 1 cell)'
            }
          },
          required: ['objectType', 'x', 'y']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'removeObject',
        description: 'Remove an object from the world at a specific position. You must be adjacent to the object (within 1 cell) to remove it.',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description: 'X coordinate of the object to remove'
            },
            y: {
              type: 'number',
              description: 'Y coordinate of the object to remove'
            }
          },
          required: ['x', 'y']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'harm',
        description: 'Harm another player by reducing their health by 1. You must be adjacent (within 1 cell) to the target.',
        parameters: {
          type: 'object',
          properties: {
            targetId: {
              type: 'string',
              description: 'The ID of the player to harm'
            }
          },
          required: ['targetId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'heal',
        description: 'Heal another player by increasing their health by 2. You must be adjacent (within 1 cell) to the target.',
        parameters: {
          type: 'object',
          properties: {
            targetId: {
              type: 'string',
              description: 'The ID of the player to heal'
            }
          },
          required: ['targetId']
        }
      }
    }
  ];
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ success: boolean; message: string }> {
  switch (name) {
    case 'moveUp':
    case 'moveDown':
    case 'moveLeft':
    case 'moveRight': {
      const directionMap: Record<string, Direction> = {
        'moveUp': 'up',
        'moveDown': 'down',
        'moveLeft': 'left',
        'moveRight': 'right'
      };
      const direction = directionMap[name];
      try {
        const response = await fetch(`${MOVE_API_URL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ctx.apiKey}`
          },
          body: JSON.stringify({ direction })
        });
        const data = await response.json();
        if (response.ok) {
          return { success: true, message: data.message };
        } else {
          return { success: false, message: data.error || `Cannot move ${direction}` };
        }
      } catch (error) {
        return { success: false, message: `Network error moving ${direction}` };
      }
    }

    case 'look':
      const nearby = ctx.context.nearbyPlayers;
      if (nearby.length === 0) {
        return { success: true, message: 'No players nearby' };
      }
      return { 
        success: true, 
        message: `Nearby players: ${nearby.map(p => `${p.name} at (${p.position.x}, ${p.position.y})`).join(', ')}` 
      };

    case 'setStatus':
      const emoji = args.emoji as string;
      const text = args.text as string;
      if (!emoji || !text) {
        return { success: false, message: 'Missing emoji or text' };
      }
      const trimmedText = text.slice(0, 30);
      ctx.onSetStatus(emoji, trimmedText);
      return { success: true, message: `Status set to ${emoji} ${trimmedText}` };

    case 'exchangeSend':
      const toId = args.toId as string;
      const content = args.content as string;
      if (!toId || !content) {
        return { success: false, message: 'Missing toId or content' };
      }
      try {
        const response = await fetch(`${API_URL}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ctx.apiKey}`
          },
          body: JSON.stringify({ toId, content })
        });
        const data = await response.json();
        if (response.ok) {
          return { success: true, message: `Message sent via Exchange API to ${data.message.toName}` };
        } else {
          return { success: false, message: data.error || 'Failed to send message' };
        }
      } catch (error) {
        return { success: false, message: 'Network error sending message' };
      }

    case 'exchangeInbox':
      try {
        const response = await fetch(`${API_URL}/inbox`, {
          headers: {
            'Authorization': `Bearer ${ctx.apiKey}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          const messages = data.messages as ExchangeMessage[];
          if (messages.length === 0) {
            return { success: true, message: 'Inbox is empty' };
          }
          const formatted = messages.map((m: ExchangeMessage) => 
            `From ${m.fromName}: "${m.content}"`
          ).join('\n');
          return { success: true, message: `Inbox:\n${formatted}` };
        } else {
          return { success: false, message: data.error || 'Failed to fetch inbox' };
        }
      } catch (error) {
        return { success: false, message: 'Network error fetching inbox' };
      }

    case 'exchangeSent':
      try {
        const response = await fetch(`${API_URL}/sent`, {
          headers: {
            'Authorization': `Bearer ${ctx.apiKey}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          const messages = data.messages as ExchangeMessage[];
          if (messages.length === 0) {
            return { success: true, message: 'No sent messages' };
          }
          const formatted = messages.map((m: ExchangeMessage) => 
            `To ${m.toName}: "${m.content}"`
          ).join('\n');
          return { success: true, message: `Sent messages:\n${formatted}` };
        } else {
          return { success: false, message: data.error || 'Failed to fetch sent messages' };
        }
      } catch (error) {
        return { success: false, message: 'Network error fetching sent messages' };
      }

    case 'memorise':
      const memoryContent = args.content as string;
      if (!memoryContent) {
        return { success: false, message: 'Missing content to memorise' };
      }
      try {
        const response = await fetch(`${MEMORY_API_URL}/memorise`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ctx.apiKey}`
          },
          body: JSON.stringify({ content: memoryContent })
        });
        const data = await response.json();
        if (response.ok) {
          return { success: true, message: `Memory saved: "${memoryContent}"` };
        } else {
          return { success: false, message: data.error || 'Failed to save memory' };
        }
      } catch (error) {
        return { success: false, message: 'Network error saving memory' };
      }

    case 'placeObject': {
      const objectType = args.objectType as 'rock';
      const x = args.x as number;
      const y = args.y as number;
      if (!objectType || x === undefined || y === undefined) {
        return { success: false, message: 'Missing objectType, x, or y coordinates' };
      }
      const currentPos = ctx.context.position;
      const dx = Math.abs(x - currentPos.x);
      const dy = Math.abs(y - currentPos.y);
      if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
        return { success: false, message: `Can only place objects adjacent to your position (${currentPos.x}, ${currentPos.y}). You tried (${x}, ${y}) which is ${dx} cells away in X and ${dy} cells away in Y.` };
      }
      const existingObject = ctx.context.nearbyObjects.find(obj => 
        obj.position.x === x && obj.position.y === y
      );
      if (existingObject) {
        return { success: false, message: `Position (${x}, ${y}) is already occupied by ${existingObject.emoji} placed by ${existingObject.placedByName}` };
      }
      ctx.onPlaceObject(objectType, x, y);
      return { success: true, message: `Placing ${objectType} at (${x}, ${y})` };
    }

    case 'removeObject': {
      const x = args.x as number;
      const y = args.y as number;
      if (x === undefined || y === undefined) {
        return { success: false, message: 'Missing x or y coordinates' };
      }
      try {
        const response = await fetch(`${API_URL}/object`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ctx.apiKey}`
          },
          body: JSON.stringify({ x, y })
        });
        const data = await response.json();
        if (response.ok) {
          return { success: true, message: data.message || 'Object removed successfully' };
        } else {
          return { success: false, message: data.error || 'Failed to remove object' };
        }
      } catch (error) {
        return { success: false, message: 'Network error removing object' };
      }
    }

    case 'harm': {
      const targetId = args.targetId as string;
      if (!targetId) {
        return { success: false, message: 'Missing targetId' };
      }
      try {
        const response = await fetch(`${HARM_API_URL}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ctx.apiKey}`
          },
          body: JSON.stringify({ targetId })
        });
        const data = await response.json();
        if (response.ok) {
          return { success: true, message: data.message || 'Player harmed successfully' };
        } else {
          return { success: false, message: data.error || 'Failed to harm player' };
        }
      } catch (error) {
        return { success: false, message: 'Network error harming player' };
      }
    }

    case 'heal': {
      const targetId = args.targetId as string;
      if (!targetId) {
        return { success: false, message: 'Missing targetId' };
      }
      try {
        const response = await fetch(`${HARM_API_URL}/heal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ctx.apiKey}`
          },
          body: JSON.stringify({ targetId })
        });
        const data = await response.json();
        if (response.ok) {
          return { success: true, message: data.message || 'Player healed successfully' };
        } else {
          return { success: false, message: data.error || 'Failed to heal player' };
        }
      } catch (error) {
        return { success: false, message: 'Network error healing player' };
      }
    }

    default:
      return { success: false, message: `Unknown tool: ${name}` };
  }
}
