import { Router, Request, Response } from 'express';
import { AuthManager } from '../auth/AuthManager.js';
import { MemoryManager } from './MemoryManager.js';

export function createMemoryRouter(
  authManager: AuthManager,
  memoryManager: MemoryManager
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

    (req as any).auth = auth;
    next();
  };

  // POST /api/memory/memorise - Add a memory
  router.post('/memorise', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid content' });
    }

    const memory = memoryManager.addMemory(auth.playerId, content);
    res.json({ success: true, memory });
  });

  // GET /api/memory - Get all memories
  router.get('/', requireAuth, (req: Request, res: Response) => {
    const auth = (req as any).auth;
    const memories = memoryManager.getMemories(auth.playerId);
    res.json({ memories });
  });

  return router;
}
