export interface Position {
  x: number;
  y: number;
}

export interface PlayerStatus {
  emoji: string;
  text: string;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  color: string;
  positionHistory?: Position[];
  status?: PlayerStatus;
  health?: number;
  model?: string;
}

export interface WorldObject {
  id: string;
  type: 'rock' | 'tree' | 'fire' | 'fountain';
  emoji: string;
  position: Position;
  placedBy: string;
  placedByName: string;
  placedAt: number;
}

export interface WorldState {
  players: Player[];
  objects: WorldObject[];
  gridSize: { width: number; height: number };
  createdAt: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type MessageType =
  | 'join'
  | 'leave'
  | 'move'
  | 'talk'
  | 'status'
  | 'heartbeat'
  | 'state'
  | 'message'
  | 'joined'
  | 'left'
  | 'error';

export interface JoinMessage {
  type: 'join';
  name: string;
  playerId: string;
  model?: string;
}

export interface LeaveMessage {
  type: 'leave';
}

export interface MoveMessage {
  type: 'move';
  direction: Direction;
}

export interface TalkMessage {
  type: 'talk';
  targetId: string;
  message: string;
}

export interface StatusMessage {
  type: 'status';
  emoji: string;
  text: string;
}

export interface PlaceObjectMessage {
  type: 'placeObject';
  objectType: 'rock' | 'tree' | 'fire' | 'fountain';
  x: number;
  y: number;
}

export interface Notification {
  id: string;
  type: 'message' | 'system' | 'proximity';
  title: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Memory {
  id: string;
  content: string;
  timestamp: number;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  notifications?: Notification[];
  memories?: Memory[];
  worldTime?: { createdAt: number; serverTime: number };
  health?: number;
}

export interface StateMessage {
  type: 'state';
  world: WorldState;
}

export interface ChatMessage {
  type: 'message';
  from: string;
  fromName: string;
  message: string;
}

export interface ExchangeMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  content: string;
  timestamp: number;
}

export interface JoinedMessage {
  type: 'joined';
  player: Player;
  apiKey: string;
}

export interface LeftMessage {
  type: 'left';
  playerId: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ClientMessage = JoinMessage | LeaveMessage | MoveMessage | TalkMessage | StatusMessage | PlaceObjectMessage;
export type ServerMessage =
  | HeartbeatMessage
  | StateMessage
  | ChatMessage
  | JoinedMessage
  | LeftMessage
  | ErrorMessage;

export interface LLMContext {
  position: Position;
  positionHistory: Position[];
  nearbyPlayers: Array<{
    id: string;
    name: string;
    position: Position;
    distance: number;
  }>;
  nearbyObjects: WorldObject[];
  sentMessages: Array<{
    to: string;
    toName: string;
    message: string;
    timestamp: number;
  }>;
  receivedMessages: Array<{
    from: string;
    fromName: string;
    message: string;
    timestamp: number;
  }>;
  gridInfo: { width: number; height: number };
  health?: number;
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: object;
  };
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
