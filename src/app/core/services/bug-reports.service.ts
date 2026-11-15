import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BugReportView {
  id: string; title: string; description: string; page: string | null; userAgent: string | null; status: 'open' | 'resolved'; adminNote: string | null;
  reporter: { id: string; name: string; role: string | null; email: string | null } | null; createdAt: string; updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class BugReportsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/bug-reports`;
  /** the "Report a bug" dialog is open */
  dialog = signal(false);
  openDialog() { this.dialog.set(true); }
  closeDialog() { this.dialog.set(false); }

  create(body: { title: string; description: string; page: string; userAgent: string }): Observable<{ ok: true }> { return this.http.post<{ ok: true }>(this.base, body); }
  list(): Observable<BugReportView[]> { return this.http.get<BugReportView[]>(this.base); }
  openCount(): Observable<{ count: number }> { return this.http.get<{ count: number }>(`${this.base}/open-count`); }
  setStatus(id: string, body: { status?: 'open' | 'resolved'; note?: string }): Observable<BugReportView> { return this.http.post<BugReportView>(`${this.base}/${id}/status`, body); }
  remove(id: string): Observable<{ ok: true }> { return this.http.delete<{ ok: true }>(`${this.base}/${id}`); }
}
