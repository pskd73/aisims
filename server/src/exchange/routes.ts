import { Router, Request, Response } from 'express';
import { AuthManager } from '../auth/AuthManager.js';
import { ExchangeManager } from './ExchangeManager.js';
import { World } from '../game/World.js';
import { WebSocketHandler } from '../ws/handler.js';

export function createExchangeRouter(
  authManager: AuthManager,
  exchangeManager: ExchangeManager,
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

  router.post('/send', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { toId, content } = req.body;

    if (!toId || !content) {
      return res.status(400).json({ error: 'Missing toId or content' });
    }

    const sender = world.getPlayer(auth.playerId);
    if (!sender || !sender.isAlive()) {
      return res.status(403).json({ error: 'Sender is incapacitated (health is 0)' });
    }

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

  router.get('/inbox', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const player = world.getPlayer(auth.playerId);
    if (!player || !player.isAlive()) {
      return res.status(403).json({ error: 'Player is incapacitated (health is 0)' });
    }
    const messages = exchangeManager.getInbox(auth.playerId);
    res.json({ messages });
  });

  router.get('/sent', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const player = world.getPlayer(auth.playerId);
    if (!player || !player.isAlive()) {
      return res.status(403).json({ error: 'Player is incapacitated (health is 0)' });
    }
    const messages = exchangeManager.getSent(auth.playerId);
    res.json({ messages });
  });

  router.delete('/object', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { x, y } = req.body;

    if (x === undefined || y === undefined) {
      return res.status(400).json({ error: 'Missing x or y coordinates' });
    }

    const player = world.getPlayer(auth.playerId);
    if (!player || !player.isAlive()) {
      return res.status(403).json({ error: 'Player is incapacitated (health is 0)' });
    }

    const result = world.removeObjectAtPosition({ x, y }, auth.playerId);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    wsHandler.broadcastState(world);
    res.json({ success: true, message: 'Object removed' });
  });

  return router;
}
