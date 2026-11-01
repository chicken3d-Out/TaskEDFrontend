import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountStatus, SchoolInfo, User } from '../models/user.model';
import {
  DocumentType,
  FileKind,
  SchoolFilesView,
  SchoolOverview,
  SchoolSummaryRow,
  TeacherInput,
} from '../models/school-portal.model';

@Injectable({ providedIn: 'root' })
export class SchoolPortalService {
  private base = `${environment.apiUrl}/school-portal`;
  constructor(private http: HttpClient) {}

  mine(): Observable<SchoolInfo[]> {
    return this.http.get<SchoolInfo[]>(`${this.base}/schools/mine`);
  }
  summary(): Observable<SchoolSummaryRow[]> {
    return this.http.get<SchoolSummaryRow[]>(`${this.base}/schools`);
  }
  overview(id: string): Observable<SchoolOverview> {
    return this.http.get<SchoolOverview>(`${this.base}/schools/${id}`);
  }
  updateSchool(id: string, dto: Partial<SchoolInfo>): Observable<SchoolInfo> {
    return this.http.patch<SchoolInfo>(`${this.base}/schools/${id}`, dto);
  }

  // teachers
  teachers(id: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/schools/${id}/teachers`);
  }
  addTeacher(id: string, dto: TeacherInput): Observable<User> {
    return this.http.post<User>(`${this.base}/schools/${id}/teachers`, dto);
  }
  updateTeacher(id: string, userId: string, dto: TeacherInput): Observable<User> {
    return this.http.patch<User>(`${this.base}/schools/${id}/teachers/${userId}`, dto);
  }
  setTeacherStatus(id: string, userId: string, status: AccountStatus): Observable<User> {
    return this.http.post<User>(`${this.base}/schools/${id}/teachers/${userId}/status`, { status });
  }
  approveTeacher(id: string, userId: string): Observable<User> {
    return this.http.post<User>(`${this.base}/schools/${id}/teachers/${userId}/approve`, {});
  }
  rejectTeacher(id: string, userId: string): Observable<User> {
    return this.http.post<User>(`${this.base}/schools/${id}/teachers/${userId}/reject`, {});
  }

  // document types
  types(): Observable<DocumentType[]> {
    return this.http.get<DocumentType[]>(`${this.base}/document-types`);
  }
  createType(dto: { name: string; description?: string; required?: boolean }): Observable<DocumentType> {
    return this.http.post<DocumentType>(`${this.base}/document-types`, dto);
  }
  updateType(id: string, dto: Partial<DocumentType>): Observable<DocumentType> {
    return this.http.patch<DocumentType>(`${this.base}/document-types/${id}`, dto);
  }
  deleteType(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/document-types/${id}`);
  }

  // files
  files(id: string): Observable<SchoolFilesView> {
    return this.http.get<SchoolFilesView>(`${this.base}/schools/${id}/files`);
  }
  uploadFile(id: string, documentTypeId: string, kind: FileKind, file: File) {
    const form = new FormData();
    form.append('documentTypeId', documentTypeId);
    form.append('kind', kind);
    form.append('file', file);
    return this.http.post(`${this.base}/schools/${id}/files/upload`, form);
  }
  downloadFile(id: string, fileId: string) {
    return this.http.get(`${this.base}/schools/${id}/files/${fileId}/download`, { responseType: 'blob' });
  }
  deleteFile(id: string, fileId: string) {
    return this.http.delete(`${this.base}/schools/${id}/files/${fileId}`);
  }
}
