import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Role, User } from '../models/user.model';
import { RegisterDto } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private base = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  pendingApprovals(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/pending-approvals`);
  }

  all(): Observable<User[]> {
    return this.http.get<User[]>(this.base);
  }

  assignRole(id: string, role: Role, assignedSchoolIds?: string[]): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/assign-role`, { role, assignedSchoolIds });
  }

  reject(id: string): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/reject`, {});
  }

  updateProfile(fields: Partial<RegisterDto>): Observable<User> {
    return this.http.patch<User>(`${this.base}/me`, fields);
  }
}
