import { Router, Request, Response } from 'express';
import { AuthManager } from '../auth/AuthManager.js';
import { World } from '../game/World.js';
import { WebSocketHandler } from '../ws/handler.js';
import { MemoryManager } from '../memory/MemoryManager.js';

export function createHarmRouter(
  authManager: AuthManager,
  world: World,
  wsHandler: WebSocketHandler,
  memoryManager: MemoryManager
): Router {
  const router = Router();

  const requireAuth = (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const apiKey = authHeader.slice(7);
    const auth = authManager.validateKey(apiKey);
    if (!auth) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    (req as any).auth = auth;
    next();
  };

  router.post('/', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { targetId } = req.body;

    if (!targetId || typeof targetId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid targetId' });
    }

    const attacker = world.getPlayer(auth.playerId);
    if (!attacker || !attacker.isAlive()) {
      return res.status(403).json({ success: false, error: 'Attacker is incapacitated (health is 0)' });
    }

    const result = world.harmPlayer(auth.playerId, targetId);
    
    if (result.success) {
      const attacker = world.getPlayer(auth.playerId);
      const target = world.getPlayer(targetId);
      
      if (attacker && target) {
        memoryManager.addMemory(targetId, `You were harmed by ${attacker.name}. Health reduced.`);
      }

      wsHandler.broadcastState(world);
      res.json({ success: true, message: result.message });
    } else {
      res.status(403).json({ success: false, error: result.message });
    }
  });

  router.post('/heal', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { targetId } = req.body;

    if (!targetId || typeof targetId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid targetId' });
    }

    const healer = world.getPlayer(auth.playerId);
    if (!healer || !healer.isAlive()) {
      return res.status(403).json({ success: false, error: 'Healer is incapacitated (health is 0)' });
    }

    const result = world.healPlayer(auth.playerId, targetId);
    
    if (result.success) {
      const healer = world.getPlayer(auth.playerId);
      const target = world.getPlayer(targetId);
      
      if (healer && target) {
        memoryManager.addMemory(targetId, `You were healed by ${healer.name}. Health increased.`);
      }

      wsHandler.broadcastState(world);
      res.json({ success: true, message: result.message });
    } else {
      res.status(403).json({ success: false, error: result.message });
    }
  });

  return router;
}
