import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private base = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  pendingApprovals(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/pending-approvals`);
  }

  approve(id: string): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/approve`, {});
  }

  reject(id: string): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/reject`, {});
  }

  updateProfile(fields: Partial<Pick<User, 'name' | 'district' | 'designation'>> & { schoolId?: string }) {
    return this.http.patch<User>(`${this.base}/me`, fields);
  }
}
