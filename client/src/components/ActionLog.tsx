import { ChatMessage } from '../../../shared/types';

interface ActionLogProps {
  messages: ChatMessage[];
}

export default function ActionLog({ messages }: ActionLogProps) {
  return (
    <div className="action-log">
      <h3>Messages</h3>
      <div className="messages-list">
        {messages.length === 0 ? (
          <p className="no-messages">No messages yet</p>
        ) : (
          messages.slice(-10).map((msg, i) => (
            <div key={i} className="message">
              <span className="message-from">{msg.fromName}:</span>
              <span className="message-text">{msg.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
