import { Router, Request, Response } from 'express';
import { AuthManager } from '../auth/AuthManager.js';
import { MemoryManager } from './MemoryManager.js';
import { World } from '../game/World.js';

export function createMemoryRouter(
  authManager: AuthManager,
  memoryManager: MemoryManager,
  world: World
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

  router.post('/memorise', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid content' });
    }

    const player = world.getPlayer(auth.playerId);
    if (!player || !player.isAlive()) {
      return res.status(403).json({ error: 'Player is incapacitated (health is 0)' });
    }

    const memory = memoryManager.addMemory(auth.playerId, content);
    res.json({ success: true, memory });
  });

  router.get('/', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const player = world.getPlayer(auth.playerId);
    if (!player || !player.isAlive()) {
      return res.status(403).json({ error: 'Player is incapacitated (health is 0)' });
    }
    const memories = memoryManager.getMemories(auth.playerId);
    res.json({ memories });
  });

  return router;
}
