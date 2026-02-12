import { useState } from 'react';
import { PlayerConfig } from '../App';

const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano' },
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large' },
  { id: 'minimax/minimax-m2.5', name: 'Minimax M2.5' },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2' },
  { id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast' },
];

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
