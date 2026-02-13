import { WebSocket } from 'ws';
import { World } from '../game/World.js';
import { AuthManager } from '../auth/AuthManager.js';
import { ExchangeManager } from '../exchange/ExchangeManager.js';
import { NotificationManager } from '../notifications/NotificationManager.js';
import { MemoryManager } from '../memory/MemoryManager.js';
import {
  ClientMessage,
  ServerMessage,
  MoveMessage,
  JoinMessage,
  LeaveMessage,
  StatusMessage,
  PlaceObjectMessage,
  HeartbeatMessage
} from '../../../shared/types.js';

interface ClientConnection {
  ws: WebSocket;
  playerId: string | null;
}

export class WebSocketHandler {
  private world: World;
  private authManager: AuthManager;
  private exchangeManager: ExchangeManager;
  private notificationManager: NotificationManager;
  private memoryManager: MemoryManager;
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_MS = 5000;

  constructor(
    world: World,
    authManager: AuthManager,
    exchangeManager: ExchangeManager,
    notificationManager: NotificationManager,
    memoryManager: MemoryManager
  ) {
    this.world = world;
    this.authManager = authManager;
    this.exchangeManager = exchangeManager;
    this.notificationManager = notificationManager;
    this.memoryManager = memoryManager;
  }

  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, this.HEARTBEAT_MS);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeats(): void {
    this.world.cleanupDisconnectedPlayers(30000);
    
    for (const [ws, client] of this.clients) {
      if (ws.readyState === WebSocket.OPEN && client.playerId) {
        const player = this.world.getPlayer(client.playerId);
        if (!player || !player.isAlive()) {
          continue;
        }
        const notifications = this.notificationManager.getAndFlush(client.playerId);
        const memories = this.memoryManager.getMemories(client.playerId);
        const now = Date.now();
        const heartbeat: HeartbeatMessage = {
          type: 'heartbeat',
          notifications: notifications.length > 0 ? notifications : undefined,
          memories: memories.length > 0 ? memories : undefined,
          worldTime: { createdAt: this.world.getCreatedAt(), serverTime: now },
          health: player.getHealth()
        };
        ws.send(JSON.stringify(heartbeat));
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }
  }

  handleConnection(ws: WebSocket): void {
    const client: ClientConnection = {
      ws,
      playerId: null
    };
    this.clients.set(ws, client);

    ws.on('message', (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        this.sendTo(ws, {
          type: 'error',
          message: 'Invalid message format'
        });
      }
    });

    ws.on('close', () => {
      const client = this.clients.get(ws);
      if (client?.playerId) {
        this.world.removePlayer(client.playerId);
      }
      this.clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleMessage(ws: WebSocket, message: ClientMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'join':
        this.handleJoin(ws, message);
        break;
      case 'leave':
        this.handleLeave(ws, message);
        break;
      case 'move':
        this.handleMove(ws, message);
        break;
      case 'status':
        this.handleStatus(ws, message);
        break;
      case 'placeObject':
        this.handlePlaceObject(ws, message);
        break;
    }
  }

  private handleJoin(ws: WebSocket, message: JoinMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    const player = this.world.addPlayer(message.playerId, message.name, message.model);
    client.playerId = message.playerId;

    const apiKey = this.authManager.generateKey(message.playerId, message.name);

    this.sendTo(ws, {
      type: 'joined',
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        color: player.color
      },
      apiKey
    });

    this.broadcast({
      type: 'state',
      world: this.world.getState()
    });

    console.log(`Player ${message.name} joined with API key: ${apiKey.slice(0, 16)}...`);
  }

  private handleLeave(ws: WebSocket, _message: LeaveMessage): void {
    const client = this.clients.get(ws);
    if (!client?.playerId) return;

    const playerId = client.playerId;
    this.world.removePlayer(playerId);
    this.world.cleanupDisconnectedPlayers(0); // Force immediate cleanup
    this.authManager.removePlayer(playerId);
    this.exchangeManager.removePlayer(playerId);
    this.notificationManager.removePlayer(playerId);
    this.memoryManager.removePlayer(playerId);
    client.playerId = null;

    this.broadcast({
      type: 'left',
      playerId
    });
  }

  private handleMove(ws: WebSocket, message: MoveMessage): void {
    const client = this.clients.get(ws);
    if (!client?.playerId) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Not joined'
      });
      return;
    }

    const player = this.world.getPlayer(client.playerId);
    if (!player || !player.isAlive()) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Player is incapacitated (health is 0)'
      });
      return;
    }

    const result = this.world.movePlayer(client.playerId, message.direction);
    
    if (result.success) {
      this.broadcast({
        type: 'state',
        world: this.world.getState()
      });
    } else {
      this.sendTo(ws, {
        type: 'error',
        message: result.message
      });
    }
  }

  private handleStatus(ws: WebSocket, message: StatusMessage): void {
    const client = this.clients.get(ws);
    if (!client?.playerId) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Not joined'
      });
      return;
    }

    const player = this.world.getPlayer(client.playerId);
    if (!player || !player.isAlive()) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Player is incapacitated (health is 0)'
      });
      return;
    }

    const success = this.world.setPlayerStatus(client.playerId, message.emoji, message.text);
    
    if (success) {
      this.broadcast({
        type: 'state',
        world: this.world.getState()
      });
    }
  }

  private handlePlaceObject(ws: WebSocket, message: PlaceObjectMessage): void {
    const client = this.clients.get(ws);
    if (!client?.playerId) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Not joined'
      });
      return;
    }

    const player = this.world.getPlayer(client.playerId);
    if (!player) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Player not found'
      });
      return;
    }
    if (!player.isAlive()) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Player is incapacitated (health is 0)'
      });
      return;
    }

    const position = { x: message.x, y: message.y };

    if (!this.world.isAdjacentToPlayer(client.playerId, position)) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Can only place objects on adjacent cells (sides or corners)'
      });
      return;
    }

    const state = this.world.getState();
    if (position.x < 0 || position.x >= state.gridSize.width || 
        position.y < 0 || position.y >= state.gridSize.height) {
      this.sendTo(ws, {
        type: 'error',
        message: 'Position out of bounds'
      });
      return;
    }

    const object = this.world.placeObject(
      message.objectType,
      position,
      player.id,
      player.name
    );

    if (object) {
      this.broadcast({
        type: 'state',
        world: this.world.getState()
      });
    } else {
      this.sendTo(ws, {
        type: 'error',
        message: 'Position already occupied'
      });
    }
  }

  private sendTo(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients.keys()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  broadcastState(world: World): void {
    this.broadcast({
      type: 'state',
      world: world.getState()
    });
  }
}
