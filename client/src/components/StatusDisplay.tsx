import { PlayerStatus } from '../../../shared/types';

interface StatusDisplayProps {
  status?: PlayerStatus;
}

export default function StatusDisplay({ status }: StatusDisplayProps) {
  if (!status) return null;

  const fullText = `${status.emoji} ${status.text}`;
  const needsScrolling = fullText.length > 12; // Approximate character limit before scrolling

  return (
    <div 
      className="player-status"
      title={status.text}
    >
      <span className={`status-text ${needsScrolling ? 'status-text-scrolling' : ''}`}>
        {needsScrolling ? (
          <>
            <span className="status-text-content">{fullText}</span>
            <span className="status-text-content" aria-hidden="true">{fullText}</span>
          </>
        ) : (
          fullText
        )}
      </span>
    </div>
  );
}
