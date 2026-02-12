/**
 * Server base URL. Set VITE_SERVER_URL in .env (e.g. VITE_SERVER_URL=https://api.example.com)
 * or leave unset for local development (http://localhost:3001).
 */
const raw = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL;
const SERVER_URL =
  (typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null) ||
  'http://localhost:3001';

/** Base URL for HTTP API calls (no trailing slash). */
export const apiBaseUrl = SERVER_URL.replace(/\/$/, '');

/**
 * WebSocket URL derived from server URL (http -> ws, https -> wss).
 */
export const wsUrl =
  SERVER_URL.replace(/^http/, 'ws').replace(/\/$/, '') || 'ws://localhost:3001';
