const raw = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL;
const SERVER_URL =
  (typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null) ||
  'http://localhost:3001';

export const apiBaseUrl = SERVER_URL.replace(/\/$/, '');

export const wsUrl =
  SERVER_URL.replace(/^http/, 'ws').replace(/\/$/, '') || 'ws://localhost:3001';
