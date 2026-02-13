import { useState } from 'react';
import { PlayerConfig } from '../App';
import { AVAILABLE_MODELS } from '../models';

interface JoinScreenProps {
  onJoin: (config: PlayerConfig) => void;
}

export default function JoinScreen({ onJoin }: JoinScreenProps) {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(AVAILABLE_MODELS[0].id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !apiKey.trim()) return;

    const config: PlayerConfig = {
      id: `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      apiKey: apiKey.trim(),
      model,
      soul: ''
    };
    onJoin(config);
  };

  return (
    <div className="join-screen">
      <div className="join-container">
        <h1 className="title">AISims</h1>
        <p className="subtitle">LLM-Powered Simulation</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Player Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="apiKey">OpenRouter API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              required
            />
            <small>Your API key stays in your browser</small>
          </div>

          <div className="form-group">
            <label htmlFor="model">LLM Model</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="join-btn">
            Enter World
          </button>
        </form>
      </div>
    </div>
  );
}
