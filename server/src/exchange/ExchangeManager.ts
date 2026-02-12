import { NotificationManager } from '../notifications/NotificationManager.js';

export interface ExchangeMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  content: string;
  timestamp: number;
}

export class ExchangeManager {
  // playerId -> all messages involving this player (as sender or recipient)
  private messages: Map<string, ExchangeMessage[]> = new Map();
  private notificationManager: NotificationManager;

  constructor(notificationManager: NotificationManager) {
    this.notificationManager = notificationManager;
  }

  sendMessage(
    fromId: string,
    fromName: string,
    toId: string,
    toName: string,
    content: string
  ): ExchangeMessage {
    const message: ExchangeMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromId,
      fromName,
      toId,
      toName,
      content,
      timestamp: Date.now()
    };

    // Add to sender's messages
    const senderMessages = this.messages.get(fromId) || [];
    senderMessages.push(message);
    this.messages.set(fromId, senderMessages);

    // Add to recipient's messages
    const recipientMessages = this.messages.get(toId) || [];
    recipientMessages.push(message);
    this.messages.set(toId, recipientMessages);

    // Create notification for recipient
    this.notificationManager.addNotification(toId, {
      type: 'message',
      title: `New message from ${fromName}`,
      content: content,
      metadata: {
        fromId,
        fromName,
        messageId: message.id
      }
    });

    return message;
  }

  // Get messages where player is the recipient
  getInbox(playerId: string): ExchangeMessage[] {
    const playerMessages = this.messages.get(playerId) || [];
    return playerMessages.filter(m => m.toId === playerId);
  }

  // Get messages where player is the sender
  getSent(playerId: string): ExchangeMessage[] {
    const playerMessages = this.messages.get(playerId) || [];
    return playerMessages.filter(m => m.fromId === playerId);
  }

  removePlayer(playerId: string): void {
    this.messages.delete(playerId);
  }
}
