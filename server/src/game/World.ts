import { Player } from './Player.js';
import { WorldState, Position, Direction, LLMContext, WorldObject } from '../../../shared/types.js';

export interface Occupant {
  type: 'player' | 'object';
  id: string;
  name?: string;
  emoji?: string;
  objectType?: string;
}

export class World {
  private players: Map<string, Player> = new Map();
  private objects: Map<string, WorldObject> = new Map();
  private grid: (Occupant | null)[][];
  private gridSize: { width: number; height: number };
  private lookRadius: number = 5;
  private readonly createdAt: number;

  constructor(width: number = 10, height: number = 10) {
    this.gridSize = { width, height };
    this.createdAt = Date.now();
    this.grid = Array(height).fill(null).map(() => Array(width).fill(null));
  }

  getCreatedAt(): number {
    return this.createdAt;
  }

  addPlayer(id: string, name: string, model?: string): Player {
    const existingPlayer = this.findPlayerByName(name);

    if (existingPlayer) {
      const oldId = existingPlayer.id;
      existingPlayer.reconnect(id);
      if (model) {
        existingPlayer.model = model;
      }

      this.players.delete(oldId);
      this.players.set(id, existingPlayer);

      this.grid[existingPlayer.position.y][existingPlayer.position.x] = {
        type: 'player',
        id: existingPlayer.id,
        name: existingPlayer.name
      };

      return existingPlayer;
    }

    const position = this.findSpawnPosition();
    const player = new Player(id, name, position, model);
    this.players.set(id, player);
    this.grid[position.y][position.x] = {
      type: 'player',
      id: player.id,
      name: player.name
    };
    return player;
  }

  private findPlayerByName(name: string): Player | undefined {
    for (const player of this.players.values()) {
      if (player.name === name) {
        return player;
      }
    }
    return undefined;
  }

  removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      player.markDisconnected();
    }
  }

  cleanupDisconnectedPlayers(maxDisconnectTimeMs: number = 30000): void {
    const now = Date.now();
    for (const [id, player] of this.players) {
      if (player.isDisconnected() && player.disconnectedAt && (now - player.disconnectedAt) > maxDisconnectTimeMs) {
        this.grid[player.position.y][player.position.x] = null;
        this.players.delete(id);
      }
    }
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values()).filter(p => !p.isDisconnected());
  }

  getObjects(): WorldObject[] {
    return Array.from(this.objects.values());
  }

  getState(): WorldState {
    return {
      players: this.getAllPlayers().map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        color: p.color,
        positionHistory: p.getPositionHistory(),
        status: p.status,
        health: p.getHealth(),
        model: p.model
      })),
      objects: this.getObjects(),
      gridSize: this.gridSize,
      createdAt: this.createdAt
    };
  }

  setPlayerStatus(id: string, emoji: string, text: string): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    if (!player.isAlive()) return false;
    player.setStatus(emoji, text);
    return true;
  }

  movePlayer(id: string, direction: Direction): { success: boolean; message: string } {
    const player = this.players.get(id);
    if (!player) return { success: false, message: 'Player not found' };
    if (!player.isAlive()) return { success: false, message: 'Player is incapacitated (health is 0)' };

    const newPos = { ...player.position };
    const currentPos = { ...player.position };

    switch (direction) {
      case 'up':
        newPos.y = Math.max(0, newPos.y - 1);
        break;
      case 'down':
        newPos.y = Math.min(this.gridSize.height - 1, newPos.y + 1);
        break;
      case 'left':
        newPos.x = Math.max(0, newPos.x - 1);
        break;
      case 'right':
        newPos.x = Math.min(this.gridSize.width - 1, newPos.x + 1);
        break;
    }

    if (newPos.x === currentPos.x && newPos.y === currentPos.y) {
      const edgeInfo = direction === 'up' ? 'top edge' :
        direction === 'down' ? 'bottom edge' :
          direction === 'left' ? 'left edge' : 'right edge';
      return { success: false, message: `Cannot move ${direction} - already at ${edgeInfo} of the world` };
    }

    const occupant = this.grid[newPos.y][newPos.x];
    if (occupant) {
      if (occupant.type === 'player') {
        const occupantName = occupant.name || 'another player';
        return { success: false, message: `Cannot move ${direction} - cell (${newPos.x}, ${newPos.y}) is occupied by player "${occupantName}"` };
      } else if (occupant.type === 'object') {
        return { success: false, message: `Cannot move ${direction} - cell (${newPos.x}, ${newPos.y}) is blocked by ${occupant.emoji} ${occupant.objectType} placed by ${occupant.name}` };
      }
    }

    this.grid[currentPos.y][currentPos.x] = null;

    player.updatePosition(newPos);

    this.grid[newPos.y][newPos.x] = {
      type: 'player',
      id: player.id,
      name: player.name
    };

    return { success: true, message: `Moved ${direction} to (${newPos.x}, ${newPos.y})` };
  }

  placeObject(
    objectType: 'rock' | 'tree' | 'fire' | 'fountain',
    position: Position,
    placedBy: string,
    placedByName: string
  ): WorldObject | null {
    const player = this.players.get(placedBy);
    if (!player || !player.isAlive()) {
      return null;
    }
    if (position.x < 0 || position.x >= this.gridSize.width ||
      position.y < 0 || position.y >= this.gridSize.height) {
      return null;
    }

    const occupant = this.grid[position.y][position.x];
    if (occupant) {
      return null;
    }

    const emojiMap: Record<typeof objectType, string> = {
      'rock': '🪨',
      'tree': '🌳',
      'fire': '🔥',
      'fountain': '⛲'
    };

    const object: WorldObject = {
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: objectType,
      emoji: emojiMap[objectType],
      position,
      placedBy,
      placedByName,
      placedAt: Date.now()
    };

    this.objects.set(object.id, object);

    this.grid[position.y][position.x] = {
      type: 'object',
      id: object.id,
      name: placedByName,
      emoji: object.emoji,
      objectType: object.type
    };

    return object;
  }

  removeObject(position: Position): boolean {
    const occupant = this.grid[position.y][position.x];
    if (!occupant || occupant.type !== 'object') return false;

    const object = this.objects.get(occupant.id);
    if (!object) return false;

    this.grid[position.y][position.x] = null;

    this.objects.delete(occupant.id);
    return true;
  }

  removeObjectAtPosition(position: Position, playerId: string): { success: boolean; message: string } {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, message: 'Player not found' };
    }
    if (!player.isAlive()) {
      return { success: false, message: 'Player is incapacitated (health is 0)' };
    }

    if (!this.isAdjacentToPlayer(playerId, position)) {
      return { success: false, message: 'You must be adjacent to the object to remove it' };
    }

    const occupant = this.grid[position.y][position.x];
    if (!occupant || occupant.type !== 'object') {
      return { success: false, message: 'No object found at the specified position' };
    }

    const object = this.objects.get(occupant.id);
    if (!object) {
      return { success: false, message: 'Object not found' };
    }

    this.grid[position.y][position.x] = null;
    this.objects.delete(occupant.id);
    return { success: true, message: 'Object removed successfully' };
  }

  getObjectsAt(position: Position): WorldObject[] {
    const occupant = this.grid[position.y][position.x];
    if (occupant && occupant.type === 'object') {
      const obj = this.objects.get(occupant.id);
      return obj ? [obj] : [];
    }
    return [];
  }

  isPositionOccupied(pos: Position): boolean {
    return this.grid[pos.y][pos.x] !== null;
  }

  getPositionHistory(playerId: string): Position[] {
    const player = this.players.get(playerId);
    return player ? player.getPositionHistory() : [];
  }

  getLLMContext(playerId: string): LLMContext {
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const nearbyPlayers = this.getAllPlayers()
      .filter(p => p.id !== playerId)
      .map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        distance: this.getDistance(player.position, p.position)
      }))
      .filter(p => p.distance <= this.lookRadius);

    const nearbyObjects = this.getObjects().filter(obj => {
      const distance = this.getDistance(player.position, obj.position);
      return distance <= this.lookRadius;
    });

    return {
      position: player.position,
      positionHistory: player.getPositionHistory(),
      nearbyPlayers,
      nearbyObjects,
      sentMessages: [],
      receivedMessages: [],
      gridInfo: this.gridSize
    };
  }

  getNearbyPlayers(playerId: string): Player[] {
    const player = this.players.get(playerId);
    if (!player) return [];

    return this.getAllPlayers()
      .filter(p => {
        if (p.id === playerId) return false;
        const distance = this.getDistance(player.position, p.position);
        return distance <= this.lookRadius;
      });
  }

  private findSpawnPosition(): Position {
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = Math.floor(Math.random() * this.gridSize.width);
      const y = Math.floor(Math.random() * this.gridSize.height);
      const pos = { x, y };

      if (!this.isPositionOccupied(pos)) {
        return pos;
      }
    }

    return { x: 0, y: 0 };
  }

  isAdjacentToPlayer(playerId: string, pos: Position): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    const dx = Math.abs(pos.x - player.position.x);
    const dy = Math.abs(pos.y - player.position.y);

    return dx <= 1 && dy <= 1 && (dx > 0 || dy > 0);
  }

  private getDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  harmPlayer(attackerId: string, targetId: string): { success: boolean; message: string } {
    const attacker = this.players.get(attackerId);
    const target = this.players.get(targetId);

    if (!attacker) {
      return { success: false, message: 'Attacker not found' };
    }
    if (!attacker.isAlive()) {
      return { success: false, message: 'Attacker is incapacitated (health is 0)' };
    }

    if (!target) {
      return { success: false, message: 'Target player not found' };
    }

    if (attackerId === targetId) {
      return { success: false, message: 'Cannot harm yourself' };
    }

    const distance = this.getDistance(attacker.position, target.position);
    if (distance > 1) {
      return { success: false, message: `Target is too far away (distance: ${distance}). You must be adjacent (within 1 cell) to harm them.` };
    }

    target.harm();
    return { success: true, message: `Harmed ${target.name}. Their health is now ${target.getHealth()}/10.` };
  }

  healPlayer(healerId: string, targetId: string): { success: boolean; message: string } {
    const healer = this.players.get(healerId);
    const target = this.players.get(targetId);

    if (!healer) {
      return { success: false, message: 'Healer not found' };
    }
    if (!healer.isAlive()) {
      return { success: false, message: 'Healer is incapacitated (health is 0)' };
    }

    if (!target) {
      return { success: false, message: 'Target player not found' };
    }

    if (healerId === targetId) {
      return { success: false, message: 'Cannot heal yourself' };
    }

    const distance = this.getDistance(healer.position, target.position);
    if (distance > 1) {
      return { success: false, message: `Target is too far away (distance: ${distance}). You must be adjacent (within 1 cell) to heal them.` };
    }

    const oldHealth = target.getHealth();
    target.heal();
    const newHealth = target.getHealth();
    
    if (oldHealth === newHealth && oldHealth === 10) {
      return { success: false, message: `${target.name} already has maximum health (10/10)` };
    }

    return { success: true, message: `Healed ${target.name}. Their health is now ${target.getHealth()}/10.` };
  }
}
