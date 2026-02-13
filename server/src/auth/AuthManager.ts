import { randomBytes } from 'crypto';

interface PlayerAuth {
  playerId: string;
  apiKey: string;
  name: string;
}

export class AuthManager {
  private auths: Map<string, PlayerAuth> = new Map(); // apiKey -> PlayerAuth
  private playerToKey: Map<string, string> = new Map(); // playerId -> apiKey

  generateKey(playerId: string, name: string): string {
    const oldKey = this.playerToKey.get(playerId);
    if (oldKey) {
      this.auths.delete(oldKey);
    }

    const apiKey = `sk-${randomBytes(32).toString('hex')}`;
    const auth: PlayerAuth = { playerId, apiKey, name };
    
    this.auths.set(apiKey, auth);
    this.playerToKey.set(playerId, apiKey);
    
    return apiKey;
  }

  removePlayer(playerId: string): void {
    const apiKey = this.playerToKey.get(playerId);
    if (apiKey) {
      this.auths.delete(apiKey);
      this.playerToKey.delete(playerId);
    }
  }

  validateKey(apiKey: string): PlayerAuth | null {
    return this.auths.get(apiKey) || null;
  }
}
