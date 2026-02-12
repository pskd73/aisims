import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WorldState,
  ServerMessage,
  ClientMessage,
  ChatMessage,
  Notification,
  Memory
} from '../../../shared/types';
import { wsUrl } from '../config';

interface UseWebSocketOptions {
  onHeartbeat?: () => void;
}

export interface SentMessage {
  to: string;
  toName: string;
  message: string;
  timestamp: number;
}

export type PlayerState = 'idle' | 'thinking';

export function useWebSocket(options?: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>('idle');
  const [apiKey, setApiKey] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const onHeartbeatRef = useRef(options?.onHeartbeat);
  const worldStateRef = useRef<WorldState | null>(null);
  const playerStateRef = useRef<PlayerState>('idle');
  const apiKeyRef = useRef<string>('');
  const notificationsRef = useRef<Notification[]>([]);
  const memoriesRef = useRef<Memory[]>([]);

  useEffect(() => {
    onHeartbeatRef.current = options?.onHeartbeat;
  }, [options?.onHeartbeat]);

  useEffect(() => {
    worldStateRef.current = worldState;
  }, [worldState]);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'state':
        setWorldState(message.world);
        break;
      case 'joined':
        console.log('Player joined:', message.player);
        if ('apiKey' in message && message.apiKey) {
          setApiKey(message.apiKey);
        }
        break;
      case 'left':
        console.log('Player left:', message.playerId);
        break;
      case 'error':
        console.error('Server error:', message.message);
        break;
      case 'heartbeat':
        // Store notifications from heartbeat
        if ('notifications' in message && message.notifications && message.notifications.length > 0) {
          setNotifications(prev => [...prev, ...message.notifications!]);
        }
        // Store memories from heartbeat
        if ('memories' in message && message.memories && message.memories.length > 0) {
          setMemories(message.memories);
        }
        // Trigger LLM thinking if idle
        if (playerStateRef.current === 'idle') {
          onHeartbeatRef.current?.();
        } else {
          console.log(`Skipping heartbeat - player is ${playerStateRef.current}`);
        }
        break;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to server');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
  }, [handleMessage]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const joinGame = useCallback((playerId: string, name: string) => {
    if (!isConnected) {
      connect();
      setTimeout(() => {
        send({ type: 'join', playerId, name });
      }, 100);
    } else {
      send({ type: 'join', playerId, name });
    }
  }, [isConnected, connect, send]);

  const setStatus = useCallback((emoji: string, text: string) => {
    send({ type: 'status', emoji, text });
  }, [send]);

  const placeObject = useCallback((objectType: 'rock', x: number, y: number) => {
    send({ type: 'placeObject', objectType, x, y });
  }, [send]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        send({ type: 'leave' });
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setWorldState(null);
    setMessages([]);
    setSentMessages([]);
    setNotifications([]);
    setMemories([]);
    setApiKey('');
  }, [send]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    worldState,
    messages,
    sentMessages,
    notifications,
    clearNotifications,
    memories,
    playerState,
    setPlayerState,
    apiKey,
    joinGame,
    setStatus,
    placeObject,
    disconnect
  };
}
