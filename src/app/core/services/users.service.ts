import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountStatus, Role, User } from '../models/user.model';
import { RegisterDto } from './auth.service';

export interface CreateUserDto {
  kind: 'staff' | 'admin';
  firstName: string;
  middleName?: string;
  lastName: string;
  contactNumber?: string;
  designation?: string;
  district?: string;
  area?: string;
  schoolId?: string;
  depedEmail?: string;
  role?: Role;
  assignedSchoolIds?: string[];
  username?: string;
  password?: string;
}

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

  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.base, dto);
  }

  adminUpdate(id: string, dto: Partial<RegisterDto> & { depedEmail?: string }): Observable<User> {
    return this.http.patch<User>(`${this.base}/${id}`, dto);
  }

  setStatus(id: string, status: AccountStatus): Observable<User> {
    return this.http.post<User>(`${this.base}/${id}/status`, { status });
  }

  resetPassword(id: string, password: string): Observable<unknown> {
    return this.http.post(`${this.base}/${id}/reset-password`, { password });
  }

  updateProfile(fields: Partial<RegisterDto>): Observable<User> {
    return this.http.patch<User>(`${this.base}/me`, fields);
  }
}
