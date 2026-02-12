import { Router, Request, Response } from 'express';
import { AuthManager } from '../auth/AuthManager.js';
import { ExchangeManager } from './ExchangeManager.js';
import { World } from '../game/World.js';
import { WebSocketHandler } from '../ws/handler.js';

function isExcavator(name: string): boolean {
  return name.toLowerCase() === 'excavator';
}

export function createExchangeRouter(
  authManager: AuthManager,
  exchangeManager: ExchangeManager,
  world: World,
  wsHandler: WebSocketHandler
): Router {
  const router = Router();

  // Middleware to validate API key
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

    // Attach auth to request
    (req as any).auth = auth;
    next();
  };

  // GET /api/exchange/directory - Public directory listing excavators (no auth required)
  router.get('/directory', (_req: Request, res: Response) => {
    const players = world.getAllPlayers();
    const excavators = players
      .filter(p => isExcavator(p.name))
      .map(p => ({
        id: p.id,
        name: p.name,
        role: 'excavator'
      }));
    res.json({ excavators });
  });

  // POST /api/exchange/send - Send a message to a player
  router.post('/send', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { toId, content } = req.body;

    if (!toId || !content) {
      return res.status(400).json({ error: 'Missing toId or content' });
    }

    // Check if recipient exists
    const recipient = world.getPlayer(toId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    const message = exchangeManager.sendMessage(
      auth.playerId,
      auth.name,
      toId,
      recipient.name,
      content
    );

    res.json({ success: true, message });
  });

  // GET /api/exchange/inbox - Get received messages
  router.get('/inbox', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const messages = exchangeManager.getInbox(auth.playerId);
    res.json({ messages });
  });

  // GET /api/exchange/sent - Get sent messages
  router.get('/sent', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const messages = exchangeManager.getSent(auth.playerId);
    res.json({ messages });
  });

  // DELETE /api/exchange/object - Remove an object (excavator only, any object)
  router.delete('/object', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { x, y } = req.body;

    if (!isExcavator(auth.name)) {
      return res.status(403).json({ error: 'Only excavators can remove objects' });
    }

    if (x === undefined || y === undefined) {
      return res.status(400).json({ error: 'Missing x or y coordinates' });
    }

    const result = world.removeObjectByExcavator({ x, y }, auth.playerId);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    wsHandler.broadcastState(world);
    res.json({ success: true, message: 'Object removed' });
  });

  return router;
}
