import { useEffect, useState, useRef } from 'react';
import { PlayerStatus } from '../../../shared/types';

interface StatusDisplayProps {
  status?: PlayerStatus;
}

export default function StatusDisplay({ status }: StatusDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const previousStatusRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!status) {
      setIsVisible(false);
      return;
    }

    const statusKey = `${status.emoji}-${status.text}`;
    const previousStatus = previousStatusRef.current;

    if (statusKey !== previousStatus) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setIsVisible(true);
      previousStatusRef.current = statusKey;

      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        timerRef.current = null;
      }, 3000);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [status]);

  if (!status) return null;

  const fullText = `${status.emoji} ${status.text}`;
  const needsScrolling = fullText.length > 12;

  return (
    <div 
      className={`player-status ${isVisible ? 'visible' : ''}`}
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
