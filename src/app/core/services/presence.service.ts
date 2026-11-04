import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RealtimeService } from './realtime.service';

export interface ActiveUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  school: string | null;
  pokedYou: boolean;
}

export interface PokeToast {
  id: number;
  fromId?: string;
  text: string;
  canPokeBack: boolean;
}

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private http = inject(HttpClient);
  private realtime = inject(RealtimeService);
  private base = `${environment.apiUrl}/presence`;
  private started = false;
  private seq = 0;

  readonly users = signal<ActiveUser[]>([]);
  readonly toasts = signal<PokeToast[]>([]);

  start() {
    if (this.started) return;
    this.started = true;
    this.refresh();
    this.realtime.on('presence:changed', () => this.refresh());
    this.realtime.on<{ fromId: string; fromName: string; mutual: boolean }>('poke:received', (p) => {
      this.refresh();
      this.toast(
        p.mutual ? `You and ${p.fromName} poked each other! 👋` : `${p.fromName} poked you 👋`,
        p.mutual ? undefined : p.fromId,
      );
    });
  }

  stop() {
    this.started = false;
    this.users.set([]);
    this.toasts.set([]);
  }

  refresh() {
    this.http.get<ActiveUser[]>(this.base).subscribe({
      next: (u) => this.users.set(u),
      error: () => {},
    });
  }

  poke(id: string) {
    this.http.post<{ mutual: boolean; name: string }>(`${this.base}/poke/${id}`, {}).subscribe({
      next: (r) => {
        this.toast(r.mutual ? `You and ${r.name} poked each other! 👋` : `You poked ${r.name} 👋`);
        this.refresh();
      },
      error: (e) => this.toast(e?.error?.message || 'Could not poke right now.'),
    });
  }

  dismiss(id: number) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  private toast(text: string, fromId?: string) {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, text, fromId, canPokeBack: !!fromId }]);
    setTimeout(() => this.dismiss(id), 8000);
  }
}
