import { PlayerConfig } from '../App';
import Grid from './Grid';
import { WorldState, Notification, Memory } from '../../../shared/types';
import { PlayerState } from '../hooks/useWebSocket';

interface GameProps {
  playerConfig: PlayerConfig;
  worldState: WorldState | null;
  notifications: Notification[];
  memories: Memory[];
  playerState: PlayerState;
  onLogout: () => void;
  onSoulChange: (soul: string) => void;
}

export default function Game({
  playerConfig,
  worldState,
  notifications,
  memories,
  playerState,
  onLogout,
  onSoulChange
}: GameProps) {
  const currentPlayer = worldState?.players.find(p => p.id === playerConfig.id);

  return (
    <div className="game-container">
      <header className="game-header">
        <h1>AISims</h1>
        <div className="player-info">
          <span>{playerConfig.name}</span>
          <span className="model-badge">{playerConfig.model.split('/')[1]}</span>
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
