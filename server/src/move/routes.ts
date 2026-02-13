import { Router, Request, Response } from 'express';
import { AuthManager } from '../auth/AuthManager.js';
import { World } from '../game/World.js';
import { WebSocketHandler } from '../ws/handler.js';

export function createMoveRouter(
  authManager: AuthManager,
  world: World,
  wsHandler: WebSocketHandler
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
    const { direction } = req.body;

    if (!direction || !['up', 'down', 'left', 'right'].includes(direction)) {
      return res.status(400).json({ error: 'Invalid direction. Must be up, down, left, or right' });
    }

    const player = world.getPlayer(auth.playerId);
    if (!player || !player.isAlive()) {
      return res.status(403).json({ success: false, error: 'Player is incapacitated (health is 0)' });
    }

    const result = world.movePlayer(auth.playerId, direction as 'up' | 'down' | 'left' | 'right');
    
    if (result.success) {
      wsHandler.broadcastState(world);
      res.json({ success: true, message: result.message, position: world.getPlayer(auth.playerId)?.position });
    } else {
      res.status(403).json({ success: false, error: result.message });
    }
  });

  return router;
}
