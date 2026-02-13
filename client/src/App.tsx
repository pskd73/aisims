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
  mission: string;
}

function App() {
  const [playerConfig, setPlayerConfig] = useState<PlayerConfig | null>(null);

  const heartbeatCallbackRef = useRef<(() => void) | null>(null);

  const handleSoulChange = useCallback((soul: string) => {
    setPlayerConfig(prev => prev ? { ...prev, soul } : null);
  }, []);

  const handleModelChange = useCallback((model: string) => {
    setPlayerConfig(prev => prev ? { ...prev, model } : null);
  }, []);

  const handleMissionChange = useCallback((mission: string) => {
    setPlayerConfig(prev => prev ? { ...prev, mission } : null);
  }, []);

  const { 
    isConnected, 
    worldState,
    worldTime,
    messages, 
    sentMessages,
    notifications,
    clearNotifications,
    memories,
    playerState,
    setPlayerState,
    apiKey,
    playerHealth,
    joinGame, 
    setStatus,
    placeObject,
    disconnect
  } = useWebSocket({
    onHeartbeat: useCallback(() => {
      heartbeatCallbackRef.current?.();
    }, [])
  });

  const { onHeartbeat, totalCost } = useOpenRouter({
    openRouterKey: playerConfig?.apiKey || '',
    apiKey,
    model: playerConfig?.model || '',
    soul: playerConfig?.soul || '',
    mission: playerConfig?.mission || '',
    onSetStatus: setStatus,
    onPlaceObject: placeObject,
    onSetMission: handleMissionChange,
    worldState,
    playerId: playerConfig?.id || '',
    messages,
    sentMessages,
    notifications,
    clearNotifications,
    memories,
    playerState,
    setPlayerState,
    playerHealth
  });

  useEffect(() => {
    heartbeatCallbackRef.current = onHeartbeat;
  }, [onHeartbeat]);

  useEffect(() => {
    if (isConnected && playerConfig) {
      joinGame(playerConfig.id, playerConfig.name, playerConfig.model);
    }
  }, [isConnected, playerConfig, joinGame]);

  const handleJoin = (config: PlayerConfig) => {
    setPlayerConfig(config);
  };

  const handleLogout = () => {
    disconnect();
    setPlayerConfig(null);
  };

  if (!playerConfig) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  return (
    <Game
      playerConfig={playerConfig}
      worldState={worldState}
      worldTime={worldTime}
      notifications={notifications}
      memories={memories}
      playerState={playerState}
      totalCost={totalCost}
      onLogout={handleLogout}
      onSoulChange={handleSoulChange}
      onModelChange={handleModelChange}
      onMissionChange={handleMissionChange}
    />
  );
}

export default App;
