import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CreditKind = 'service_credit' | 'wellness' | 'vl_sl' | 'spl' | 'fl' | 'cto';

export interface CreditCard { kind: CreditKind; label: string; balance: number; initialSet: boolean; pending?: { id: string; newBalance: number; reason: string } | null }
export interface CreditLog { id: string; kind: CreditKind; label: string; type: 'initial' | 'special_order' | 'edit' | 'reset' | 'deduction' | 'restore'; delta: number; balanceAfter: number; reason: string | null; soNumber: string | null; fileName: string | null; fileUrl: string | null; actor: string | null; createdAt: string }
export interface CreditOverview { user: { id: string; name: string; role: string; school: string }; type: 'teacher' | 'staff'; canManage: boolean; isAdmin: boolean; credits: CreditCard[]; logs: CreditLog[] }
export interface StaffRow { id: string; name: string; role: string; school: string; self: boolean; credits: { kind: CreditKind; label: string; balance: number; initialSet: boolean }[] }
export interface CreditRequest { id: string; status: 'pending' | 'approved' | 'rejected'; kind: CreditKind; label: string; oldBalance: number; newBalance: number; reason: string; person: string; school: string; requestedBy: string; decidedNote: string | null; createdAt: string; decidedAt: string | null }

@Injectable({ providedIn: 'root' })
export class ServiceCreditsService {
  private base = `${environment.apiUrl}/service-credits`;
  constructor(private http: HttpClient) {}

  mine(): Observable<CreditOverview> { return this.http.get<CreditOverview>(`${this.base}/me`); }
  staff(): Observable<StaffRow[]> { return this.http.get<StaffRow[]>(`${this.base}/staff`); }
  user(id: string): Observable<CreditOverview> { return this.http.get<CreditOverview>(`${this.base}/user/${id}`); }
  setInitial(id: string, kind: CreditKind, balance: number) { return this.http.post<CreditOverview>(`${this.base}/user/${id}/initial`, { kind, balance }); }
  requestEdit(id: string, kind: CreditKind, balance: number, reason: string) { return this.http.post<CreditOverview>(`${this.base}/user/${id}/edit-request`, { kind, balance, reason }); }
  specialOrder(id: string, body: { kind: CreditKind; amount: number; soNumber: string; fileName: string; url: string; publicId: string }) { return this.http.post<CreditOverview>(`${this.base}/user/${id}/special-order`, body); }
  uploadSignature(): Observable<{ uploadUrl: string; fields: Record<string, string> }> { return this.http.post<{ uploadUrl: string; fields: Record<string, string> }>(`${this.base}/upload-signature`, {}); }
  requests(): Observable<{ pending: CreditRequest[]; recent: CreditRequest[] }> { return this.http.get<{ pending: CreditRequest[]; recent: CreditRequest[] }>(`${this.base}/requests`); }
  decide(id: string, approve: boolean, note: string) { return this.http.post<{ pending: CreditRequest[]; recent: CreditRequest[] }>(`${this.base}/requests/${id}/decision`, { approve, note }); }
}
