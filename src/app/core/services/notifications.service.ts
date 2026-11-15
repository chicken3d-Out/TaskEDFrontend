import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { RealtimeService } from './realtime.service';
import { AuthService } from './auth.service';

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
  private router = inject(Router);
  private auth = inject(AuthService);
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

  // Where a notification should take the person. Mark-as-read always happens
  // first, then we open the page the notification is about.
  private target(type: string, message: string, rel: string | null): { cmds: any[]; q?: Record<string, string> } {
    const role = this.auth.currentUser()?.role as string | undefined;
    const msg = (message || '').toLowerCase();
    if (rel?.startsWith('bug:')) return role === 'administrator' ? { cmds: ['/bug-reports'] } : { cmds: ['/dashboard'] };
    switch (type) {
      case 'ticket_update': case 'attachment_request': case 'ticket_status_change':
        return rel ? { cmds: ['/tasks', rel] } : { cmds: ['/tasks'] };
      case 'forum_review':
        return rel ? { cmds: ['/forum', rel] } : { cmds: ['/forum'] };
      case 'calendar_reminder':
        return { cmds: ['/calendar'] };
      case 'travel_authority':
        return { cmds: ['/my-files'], q: { tab: /waiting for|prepared/.test(msg) ? 'pending' : 'travel' } };
      case 'service_credit':
        return { cmds: ['/my-files'], q: { tab: /waiting for your signature|prepared a leave/.test(msg) ? 'pending' : 'credits' } };
      case 'account_approved':
        return { cmds: ['/dashboard'] };
      case 'account_rejected':
        if (role === 'administrator' && /waiting for a role/.test(msg)) return { cmds: ['/users'] };
        if (role === 'school' && /waiting for approval/.test(msg)) return { cmds: ['/school'] };
        return { cmds: ['/dashboard'] };
      default:
        return { cmds: ['/dashboard'] };
    }
  }

  // Tap on a notification in the list: mark read, then open it.
  open(n: AppNotification) {
    if (!n.read) this.markRead(n.id);
    const t = this.target(n.type, n.message, n.relatedEntityId);
    this.router.navigate(t.cmds, t.q ? { queryParams: t.q } : undefined);
  }

  // Tap on a phone push banner: same thing, matched to the stored notification.
  openFromPush(type: string, message: string, rel: string | null) {
    const hit = this.notifications().find((n) => !n.read && n.type === type && (n.relatedEntityId ?? null) === (rel || null));
    if (hit) this.markRead(hit.id);
    const t = this.target(type, message, rel || null);
    this.router.navigate(t.cmds, t.q ? { queryParams: t.q } : undefined);
  }

  disconnect() {
    this.realtime.disconnect();
    this.notifications.set([]);
    this.unreadCount.set(0);
  }
}
