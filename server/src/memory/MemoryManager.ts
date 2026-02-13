export interface Memory {
  id: string;
  content: string;
  timestamp: number;
}

export class MemoryManager {
  private memories: Map<string, Memory[]> = new Map();

  addMemory(playerId: string, content: string): Memory {
    const playerMemories = this.memories.get(playerId) || [];
    
    const memory: Memory = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: Date.now()
    };
    
    playerMemories.push(memory);
    if (playerMemories.length > 500) {
      playerMemories.shift();
    }
    
    this.memories.set(playerId, playerMemories);
    return memory;
  }

  getMemories(playerId: string): Memory[] {
    return this.memories.get(playerId) || [];
  }

  removePlayer(playerId: string): void {
    this.memories.delete(playerId);
  }
}
