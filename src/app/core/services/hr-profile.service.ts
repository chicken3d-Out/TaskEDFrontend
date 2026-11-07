import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HrProfile {
  userId: string;
  canEdit: boolean;
  defaults: { firstName: string | null; middleName: string | null; lastName: string | null; schoolName: string | null; schoolIdNo: string | null; positionTitle: string | null; depedEmail: string | null };
  [field: string]: any;
}

export interface TeacherFileRow { id: string; section: string; label: string; link: string; createdAt: string }
export interface TeacherFilesView { sections: string[]; schoolName: string; teacherName: string; files: TeacherFileRow[] }

@Injectable({ providedIn: 'root' })
export class HrProfileService {
  constructor(private http: HttpClient) {}
  get(userId: string): Observable<HrProfile> {
    return this.http.get<HrProfile>(`${environment.apiUrl}/hr-profile/${userId}`);
  }
  save(userId: string, dto: Record<string, any>): Observable<HrProfile> {
    return this.http.put<HrProfile>(`${environment.apiUrl}/hr-profile/${userId}`, dto);
  }
  teacherFiles(teacherId: string): Observable<TeacherFilesView> {
    return this.http.get<TeacherFilesView>(`${environment.apiUrl}/teacher-files/teacher/${teacherId}`);
  }
  addTeacherFile(teacherId: string, section: string, label: string, link: string): Observable<TeacherFileRow> {
    return this.http.post<TeacherFileRow>(`${environment.apiUrl}/teacher-files/teacher/${teacherId}`, { section, label, link });
  }
  removeTeacherFile(id: string): Observable<unknown> {
    return this.http.delete(`${environment.apiUrl}/teacher-files/${id}`);
  }
}
