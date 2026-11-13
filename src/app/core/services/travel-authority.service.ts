import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TaStatus = 'draft' | 'awaiting_requester' | 'awaiting_recommending' | 'awaiting_approving' | 'approved';
export interface TaSigRec { img: string; x: number; y: number; at: string }
export interface TaForm {
  name: string; position: string; station: string; purpose: string; host: string;
  dates: string; destination: string; fund: string; dateFrom: string; dateTo: string;
}
export interface TaRecord {
  id: string; status: TaStatus; outside: boolean; data: TaForm;
  ownerId: string; ownerName: string; requesterId: string; requesterName: string;
  recommendingName: string; approvingName: string; driveLink: string | null;
  rev: number; driveRev: number; needsDriveSync: boolean;
  myTurn: 'requester' | 'recommending' | 'approving' | null; isOwner: boolean;
  signed: { requester: boolean; recommending: boolean; approving: boolean };
  sigs?: { requester: TaSigRec | null; recommending: TaSigRec | null; approving: TaSigRec | null };
  createdAt: string; updatedAt: string;
}
export interface TaRoute {
  recommending: { name: string; userId: string | null; note?: string } | null;
  approving: { name: string; userId: string | null; note?: string };
}
export interface TaSettingsPart { userId: string | null; userName: string; email: string; name: string }
export interface TaSettings { districtSupervisor: TaSettingsPart; sds: TaSettingsPart }

export const STATUS_LABEL: Record<TaStatus, string> = {
  draft: 'Draft',
  awaiting_requester: 'Waiting for the employee to sign',
  awaiting_recommending: 'Waiting for the recommending authority',
  awaiting_approving: 'Waiting for the approving authority',
  approved: 'Fully signed',
};

@Injectable({ providedIn: 'root' })
export class TravelAuthorityService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/travel-authority`;
  /** bumped whenever something changes so lists reload */
  readonly version = signal(0);
  bump() { this.version.update((v) => v + 1); }

  mine(): Observable<TaRecord[]> { return this.http.get<TaRecord[]>(this.base); }
  inbox(): Observable<TaRecord[]> { return this.http.get<TaRecord[]>(`${this.base}/inbox`); }
  get(id: string): Observable<TaRecord> { return this.http.get<TaRecord>(`${this.base}/${id}`); }
  route(outside: boolean, requesterId?: string): Observable<TaRoute> {
    const q = `outside=${outside}${requesterId ? `&requesterId=${requesterId}` : ''}`;
    return this.http.get<TaRoute>(`${this.base}/route?${q}`);
  }
  create(body: { data: Partial<TaForm>; outside: boolean; forTeacherId?: string }): Observable<TaRecord> { return this.http.post<TaRecord>(this.base, body); }
  update(id: string, body: { data: Partial<TaForm>; outside: boolean }): Observable<TaRecord> { return this.http.patch<TaRecord>(`${this.base}/${id}`, body); }
  send(id: string): Observable<TaRecord> { return this.http.post<TaRecord>(`${this.base}/${id}/send`, {}); }
  sign(id: string, x: number, y: number): Observable<TaRecord> { return this.http.post<TaRecord>(`${this.base}/${id}/sign`, { x, y }); }
  setDrive(id: string, link: string, rev: number) { return this.http.patch(`${this.base}/${id}/drive`, { link, rev }); }
  remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
  getSignature(): Observable<{ signature: string | null }> { return this.http.get<{ signature: string | null }>(`${this.base}/signature`); }
  setSignature(signature: string | null) { return this.http.put<{ signature: string | null }>(`${this.base}/signature`, { signature }); }
  settings(): Observable<TaSettings> { return this.http.get<TaSettings>(`${this.base}/settings`); }
  saveSettings(b: { districtSupervisor: { userId: string | null; name: string }; sds: { userId: string | null; name: string } }) { return this.http.put<TaSettings>(`${this.base}/settings`, b); }
}
