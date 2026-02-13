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

    const senderMessages = this.messages.get(fromId) || [];
    senderMessages.push(message);
    this.messages.set(fromId, senderMessages);

    const recipientMessages = this.messages.get(toId) || [];
    recipientMessages.push(message);
    this.messages.set(toId, recipientMessages);

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

  getInbox(playerId: string): ExchangeMessage[] {
    const playerMessages = this.messages.get(playerId) || [];
    return playerMessages.filter(m => m.toId === playerId);
  }

  getSent(playerId: string): ExchangeMessage[] {
    const playerMessages = this.messages.get(playerId) || [];
    return playerMessages.filter(m => m.fromId === playerId);
  }

  removePlayer(playerId: string): void {
    this.messages.delete(playerId);
  }
}
