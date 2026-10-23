import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

// Single shared Socket.IO connection for the whole app. Notifications use
// it (the 'notification' event), and Tickets/Forum/Calendar listen on it
// too ('tickets:changed', 'forum:changed', 'calendar:changed') so open
// views update live instead of needing a manual refresh - the backend
// only ever sends a lightweight "something changed" ping, never full
// entity data, so the listening component just quietly re-fetches
// through its normal, already-authorized API call.
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private socket: Socket | null = null;

  connect(userId: string) {
    if (this.socket) return; // already connected - don't open a second socket
    this.socket = io(environment.apiUrl, { transports: ['websocket'] });
    this.socket.emit('join', userId);
  }

  // Returns an unsubscribe function - call it from the component's
  // ngOnDestroy so navigating away stops triggering silent re-fetches.
  on<T = unknown>(event: string, callback: (payload: T) => void): () => void {
    this.socket?.on(event, callback);
    return () => this.socket?.off(event, callback);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
