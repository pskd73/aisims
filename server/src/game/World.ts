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

  constructor(width: number = 10, height: number = 10) {
    this.gridSize = { width, height };
    // Initialize grid matrix - null means empty
    this.grid = Array(height).fill(null).map(() => Array(width).fill(null));
  }

  addPlayer(id: string, name: string): Player {
    // Check if player with this name already exists (reconnecting)
    const existingPlayer = this.findPlayerByName(name);

    if (existingPlayer) {
      // Player is reconnecting - reuse same player, update ID
      const oldId = existingPlayer.id;
      existingPlayer.reconnect(id);

      // Update map with new ID
      this.players.delete(oldId);
      this.players.set(id, existingPlayer);

      // Update grid with new ID
      this.grid[existingPlayer.position.y][existingPlayer.position.x] = {
        type: 'player',
        id: existingPlayer.id,
        name: existingPlayer.name
      };

      return existingPlayer;
    }

    // New player - find random spawn position
    const position = this.findSpawnPosition();
    const player = new Player(id, name, position);
    this.players.set(id, player);
    // Place player on grid
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
      // Mark as disconnected instead of removing
      player.markDisconnected();
    }
  }

  cleanupDisconnectedPlayers(maxDisconnectTimeMs: number = 30000): void {
    const now = Date.now();
    for (const [id, player] of this.players) {
      if (player.isDisconnected() && player.disconnectedAt && (now - player.disconnectedAt) > maxDisconnectTimeMs) {
        // Clear from grid
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
        status: p.status
      })),
      objects: this.getObjects(),
      gridSize: this.gridSize
    };
  }

  setPlayerStatus(id: string, emoji: string, text: string): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    player.setStatus(emoji, text);
    return true;
  }

  movePlayer(id: string, direction: Direction): { success: boolean; message: string } {
    const player = this.players.get(id);
    if (!player) return { success: false, message: 'Player not found' };

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

    // Check if player is already at edge and cannot move further
    if (newPos.x === currentPos.x && newPos.y === currentPos.y) {
      const edgeInfo = direction === 'up' ? 'top edge' :
        direction === 'down' ? 'bottom edge' :
          direction === 'left' ? 'left edge' : 'right edge';
      return { success: false, message: `Cannot move ${direction} - already at ${edgeInfo} of the world` };
    }

    // Check what is occupying the position using the unified grid
    const occupant = this.grid[newPos.y][newPos.x];
    if (occupant) {
      if (occupant.type === 'player') {
        const occupantName = occupant.name || 'another player';
        return { success: false, message: `Cannot move ${direction} - cell (${newPos.x}, ${newPos.y}) is occupied by player "${occupantName}"` };
      } else if (occupant.type === 'object') {
        return { success: false, message: `Cannot move ${direction} - cell (${newPos.x}, ${newPos.y}) is blocked by ${occupant.emoji} ${occupant.objectType} placed by ${occupant.name}` };
      }
    }

    // Clear old position
    this.grid[currentPos.y][currentPos.x] = null;

    // Update player position
    player.updatePosition(newPos);

    // Place player at new position
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
    // Check bounds
    if (position.x < 0 || position.x >= this.gridSize.width ||
      position.y < 0 || position.y >= this.gridSize.height) {
      return null;
    }

    // Check if position is occupied (by anything)
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

    // Add to objects map
    this.objects.set(object.id, object);

    // Place on grid
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

    // Clear from grid
    this.grid[position.y][position.x] = null;

    // Remove from objects map
    this.objects.delete(occupant.id);
    return true;
  }

  removeObjectByExcavator(position: Position, excavatorId: string): { success: boolean; message: string } {
    // Check if excavator exists
    const excavator = this.players.get(excavatorId);
    if (!excavator) {
      return { success: false, message: 'Excavator not found' };
    }

    // Check if excavator is adjacent to the position
    if (!this.isAdjacentToPlayer(excavatorId, position)) {
      return { success: false, message: 'Excavator must be adjacent to the object to remove it' };
    }

    const occupant = this.grid[position.y][position.x];
    if (!occupant || occupant.type !== 'object') {
      return { success: false, message: 'No object found at the specified position' };
    }

    const object = this.objects.get(occupant.id);
    if (!object) {
      return { success: false, message: 'Object not found' };
    }

    // Clear from grid
    this.grid[position.y][position.x] = null;

    // Remove from objects map
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

    // Get nearby objects within look radius
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

    // Must be adjacent (including diagonals), max 1 cell away in any direction
    return dx <= 1 && dy <= 1 && (dx > 0 || dy > 0);
  }

  private getDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
}
