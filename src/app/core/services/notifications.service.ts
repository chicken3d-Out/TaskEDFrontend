import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RealtimeService } from './realtime.service';

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  relatedEntityId: string | null;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private realtime = inject(RealtimeService);
  private base = `${environment.apiUrl}/notifications`;

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal<number>(0);

  async loadAndConnect(userId: string) {
    const list = await this.http.get<AppNotification[]>(this.base).toPromise();
    this.notifications.set(list ?? []);
    this.unreadCount.set((list ?? []).filter((n) => !n.read).length);

    this.realtime.connect(userId);
    this.realtime.on<AppNotification>('notification', (n) => {
      this.notifications.update((list) => [n, ...list]);
      this.unreadCount.update((c) => c + 1);
    });
  }

  markRead(id: string) {
    this.http.patch(`${this.base}/${id}/read`, {}).subscribe(() => {
      this.notifications.update((list) =>
        list.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      this.unreadCount.update((c) => Math.max(0, c - 1));
    });
  }

  disconnect() {
    this.realtime.disconnect();
    this.notifications.set([]);
    this.unreadCount.set(0);
  }
}
