export interface Notification {
  id: string;
  type: 'message' | 'system' | 'proximity';
  title: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export class NotificationManager {
  private notifications: Map<string, Notification[]> = new Map();

  addNotification(playerId: string, notification: Omit<Notification, 'id' | 'timestamp'>): Notification {
    const playerNotifications = this.notifications.get(playerId) || [];
    
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    playerNotifications.push(newNotification);
    this.notifications.set(playerId, playerNotifications);
    
    return newNotification;
  }

  getAndFlush(playerId: string): Notification[] {
    const playerNotifications = this.notifications.get(playerId) || [];
    this.notifications.set(playerId, []); // Flush after retrieval
    return playerNotifications;
  }

  removePlayer(playerId: string): void {
    this.notifications.delete(playerId);
  }
}
