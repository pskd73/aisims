import { Position, PlayerStatus } from '../../../shared/types.js';

export type EntityType = 'player' | 'object';

export interface Entity {
  id: string;
  type: EntityType;
  position: Position;
}

export interface PlayerEntity extends Entity {
  type: 'player';
  name: string;
  color: string;
  lastHeartbeat: number;
  positionHistory: Position[];
  status?: PlayerStatus;
}

export interface ObjectEntity extends Entity {
  type: 'object';
  objectType: 'rock' | 'tree' | 'fire' | 'fountain';
  emoji: string;
  placedBy: string;
  placedByName: string;
  placedAt: number;
}

export type Cell = {
  player?: PlayerEntity;
  object?: ObjectEntity;
} | null;

export type Grid = Cell[][];

export { Player } from './Player.js';
export { World } from './World.js';
