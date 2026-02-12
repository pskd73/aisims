import { Player as PlayerType, Position, PlayerStatus } from '../../../shared/types.js';

export class Player implements PlayerType {
  id: string;
  name: string;
  position: Position;
  color: string;
  lastHeartbeat: number;
  positionHistory: Position[] = [];
  status?: PlayerStatus;
  disconnectedAt: number | null = null;
  private readonly MAX_HISTORY = 20;

  constructor(id: string, name: string, position: Position) {
    this.id = id;
    this.name = name;
    this.position = position;
    this.color = this.generateColor();
    this.lastHeartbeat = Date.now();
    this.positionHistory.push({ ...position });
  }

  private generateColor(): string {
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12', 
      '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  updateHeartbeat(): void {
    this.lastHeartbeat = Date.now();
  }

  updatePosition(newPosition: Position): void {
    this.position = newPosition;
    this.positionHistory.push({ ...newPosition });
    if (this.positionHistory.length > this.MAX_HISTORY) {
      this.positionHistory.shift();
    }
  }

  getPositionHistory(): Position[] {
    return [...this.positionHistory];
  }

  setStatus(emoji: string, text: string): void {
    this.status = { emoji, text };
  }

  markDisconnected(): void {
    this.disconnectedAt = Date.now();
  }

  isDisconnected(): boolean {
    return this.disconnectedAt !== null;
  }

  reconnect(newId: string): void {
    this.id = newId;
    this.disconnectedAt = null;
    this.lastHeartbeat = Date.now();
  }
}
