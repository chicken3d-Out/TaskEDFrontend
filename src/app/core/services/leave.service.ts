import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type LeaveStatus = 'awaiting_applicant' | 'awaiting_ao' | 'ao_approved' | 'awaiting_signatory' | 'approved' | 'disapproved';
export interface LeaveData {
  office: string; lastName: string; firstName: string; middleName: string; filingDate: string; position: string; salary: string;
  leaveType: string; otherLeave: string;
  where: '' | 'ph' | 'abroad'; whereText: string; illness: '' | 'hospital' | 'outpatient'; illnessText: string; womenText: string; study: '' | 'masters' | 'bar'; monetization: '' | 'monetization' | 'terminal';
  days: number; dates: string; commutation: 'not' | 'requested';
}
export interface LeaveSig { img: string; x: number; y: number; at: string }
export interface LeaveView {
  id: string; status: LeaveStatus; data: LeaveData; kind: string | null; kindLabel: string | null; days: number;
  credit: { asOf: string; label: string; earned: number; less: number; balance: number } | null; deducted: boolean;
  recommendation: { decision: 'approval' | 'disapproval'; reason: string } | null; note: string | null;
  applicant: { id: string; name: string; role: string; school: string }; filedBy: { id: string; name: string } | null;
  sigs: { applicant?: LeaveSig; ao?: LeaveSig; signatory?: LeaveSig };
  myTurn: 'applicant' | 'ao' | 'send' | 'signatory' | null; signAs: string | null; kinds: { kind: string; label: string }[];
  printed: { hrmo: string; asds: string; signatory: string; signatoryTitle: string; signatoryNote: string | null };
  createdAt: string; updatedAt: string;
}
export const LEAVE_STATUS: Record<LeaveStatus, string> = {
  awaiting_applicant: 'Waiting for the applicant’s signature', awaiting_ao: 'Waiting for the AO’s approval', ao_approved: 'Approved by the AO · ready to send',
  awaiting_signatory: 'Waiting for the corresponding signatory', approved: 'Approved', disapproved: 'Disapproved',
};

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private base = `${environment.apiUrl}/leave`;
  constructor(private http: HttpClient) {}
  types(): Observable<string[]> { return this.http.get<string[]>(`${this.base}/types`); }
  list(): Observable<LeaveView[]> { return this.http.get<LeaveView[]>(this.base); }
  get(id: string): Observable<LeaveView> { return this.http.get<LeaveView>(`${this.base}/${id}`); }
  create(body: { applicantId?: string; data: Partial<LeaveData>; kind: string | null }): Observable<LeaveView> { return this.http.post<LeaveView>(this.base, body); }
  update(id: string, body: { data: Partial<LeaveData>; kind: string | null }): Observable<LeaveView> { return this.http.put<LeaveView>(`${this.base}/${id}`, body); }
  remove(id: string) { return this.http.delete(`${this.base}/${id}`); }
  sign(id: string, body: { x: number; y: number; kind?: string | null; decision?: string; reason?: string }): Observable<LeaveView> { return this.http.post<LeaveView>(`${this.base}/${id}/sign`, body); }
  disapprove(id: string, reason: string): Observable<LeaveView> { return this.http.post<LeaveView>(`${this.base}/${id}/disapprove`, { reason }); }
  send(id: string): Observable<LeaveView> { return this.http.post<LeaveView>(`${this.base}/${id}/send`, {}); }
  settings(): Observable<{ hrmo: string; asds: string }> { return this.http.get<{ hrmo: string; asds: string }>(`${this.base}/settings`); }
  saveSettings(b: { hrmo?: string; asds?: string }): Observable<{ hrmo: string; asds: string }> { return this.http.put<{ hrmo: string; asds: string }>(`${this.base}/settings`, b); }
}
