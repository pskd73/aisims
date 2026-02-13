import { useState, useEffect, useRef } from 'react';
import { PlayerConfig } from '../App';
import Grid from './Grid';
import { WorldState, Notification, Memory } from '../../../shared/types';
import { PlayerState } from '../hooks/useWebSocket';
import { AVAILABLE_MODELS } from '../models';

function formatElapsed(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface GameProps {
  playerConfig: PlayerConfig;
  worldState: WorldState | null;
  worldTime: { createdAt: number; serverTime: number } | null;
  notifications: Notification[];
  memories: Memory[];
  playerState: PlayerState;
  onLogout: () => void;
  onSoulChange: (soul: string) => void;
  onModelChange: (model: string) => void;
}

export default function Game({
  playerConfig,
  worldState,
  worldTime,
  notifications,
  memories,
  playerState,
  onLogout,
  onSoulChange,
  onModelChange
}: GameProps) {
  const currentPlayer = worldState?.players.find(p => p.id === playerConfig.id);
  const [tick, setTick] = useState(0);
  const worldTimeReceivedAtRef = useRef(0);

  useEffect(() => {
    if (worldTime) worldTimeReceivedAtRef.current = Date.now();
  }, [worldTime]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = worldTime
    ? worldTime.serverTime - worldTime.createdAt + (Date.now() - worldTimeReceivedAtRef.current)
    : 0;

  return (
    <div className="game-container">
      <header className="game-header">
        <h1>AISims</h1>
        {worldTime != null && (
          <span className="world-time" title="World elapsed time">
            ⏱ {formatElapsed(elapsedMs)}
          </span>
        )}
        <div className="player-info">
          <span>{playerConfig.name}</span>
          <select
            className="model-select"
            value={playerConfig.model}
            onChange={(e) => onModelChange(e.target.value)}
            title="LLM model"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="game-main">
        <div className="game-world">
          {worldState ? (
            <Grid 
              worldState={worldState} 
              playerId={playerConfig.id}
            />
          ) : (
            <div className="loading">Connecting...</div>
          )}
        </div>

        <aside className="game-sidebar">
          <div className="status-panel">
            <h3>Status</h3>
            {currentPlayer && (
              <div className="status-info">
                <p>Position: ({currentPlayer.position.x}, {currentPlayer.position.y})</p>
                <p>Players Online: {worldState?.players.length || 0}</p>
                <p>Nearby: {worldState?.players.filter(p => 
                  Math.abs(p.position.x - currentPlayer.position.x) + 
                  Math.abs(p.position.y - currentPlayer.position.y) <= 5 &&
                  p.id !== playerConfig.id
                ).length || 0}</p>
                <p className={`player-state player-state--${playerState}`}>State: {playerState}</p>
              </div>
            )}
          </div>

          <div className="soul-panel">
            <h3>Soul</h3>
            <textarea
              className="soul-textarea"
              value={playerConfig.soul}
              onChange={(e) => onSoulChange(e.target.value)}
              placeholder="Define your player's personality, goals, and motivations..."
              rows={4}
            />
          </div>

          {notifications.length > 0 && (
            <div className="notifications-panel">
              <h3>🚨 Notifications ({notifications.length})</h3>
              <div className="notifications-list">
                {notifications.slice(-5).reverse().map((notif, i) => (
                  <div key={i} className="notification-item">
                    <span className="notification-type">[{notif.type.toUpperCase()}]</span>
                    <span className="notification-title">{notif.title}</span>
                    <span className="notification-content">{notif.content}</span>
                    {notif.metadata && (notif.metadata as Record<string, string>).fromId && (
                      <span className="notification-sender">
                        From: {(notif.metadata as Record<string, string>).fromName} ({(notif.metadata as Record<string, string>).fromId})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {memories.length > 0 && (
            <div className="memories-panel">
              <h3>🧠 Memories ({memories.length})</h3>
              <div className="memories-list">
                {memories.slice(-5).reverse().map((memory, i) => (
                  <div key={i} className="memory-item">
                    <span className="memory-content">{memory.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
