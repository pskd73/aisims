import { useState, useEffect, useCallback, useRef } from 'react';
import JoinScreen from './components/JoinScreen';
import Game from './components/Game';
import { useWebSocket } from './hooks/useWebSocket';
import { useOpenRouter } from './hooks/useOpenRouter';

export interface PlayerConfig {
  id: string;
  name: string;
  apiKey: string;
  model: string;
  soul: string;
}

function App() {
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(() => {
    const saved = localStorage.getItem('playerConfig');
    return saved ? JSON.parse(saved) : null;
  });

  const heartbeatCallbackRef = useRef<(() => void) | null>(null);

  const { 
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
  } = useWebSocket({
    onHeartbeat: useCallback(() => {
      heartbeatCallbackRef.current?.();
    }, [])
  });

  const { onHeartbeat } = useOpenRouter({
    openRouterKey: playerConfig?.apiKey || '',
    apiKey,
    model: playerConfig?.model || '',
    soul: playerConfig?.soul || '',
    onSetStatus: setStatus,
    onPlaceObject: placeObject,
    worldState,
    playerId: playerConfig?.id || '',
    messages,
    sentMessages,
    notifications,
    clearNotifications,
    memories,
    playerState,
    setPlayerState
  });

  useEffect(() => {
    heartbeatCallbackRef.current = onHeartbeat;
  }, [onHeartbeat]);

  useEffect(() => {
    if (isConnected && playerConfig) {
      joinGame(playerConfig.id, playerConfig.name);
    }
  }, [isConnected, playerConfig, joinGame]);

  useEffect(() => {
    if (playerConfig) {
      localStorage.setItem('playerConfig', JSON.stringify(playerConfig));
    }
  }, [playerConfig]);

  const handleJoin = (config: PlayerConfig) => {
    setPlayerConfig(config);
  };

  const handleLogout = () => {
    disconnect();
    localStorage.removeItem('playerConfig');
    setPlayerConfig(null);
  };

  const handleSoulChange = (soul: string) => {
    setPlayerConfig(prev => prev ? { ...prev, soul } : null);
  };

  if (!playerConfig) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return (
    <Game
      playerConfig={playerConfig}
      worldState={worldState}
      notifications={notifications}
      memories={memories}
      playerState={playerState}
      onLogout={handleLogout}
      onSoulChange={handleSoulChange}
    />
  );
}

export default App;
