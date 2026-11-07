import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MyFile, MyFilesView } from '../models/my-files.model';

@Injectable({ providedIn: 'root' })
export class MyFilesService {
  private base = `${environment.apiUrl}/my-files`;
  constructor(private http: HttpClient) {}

  list(): Observable<MyFilesView> {
    return this.http.get<MyFilesView>(this.base);
  }
  add(label: string, category: string, link: string, schoolYear?: string, section?: string): Observable<MyFile> {
    return this.http.post<MyFile>(this.base, { label, category, link, schoolYear, section });
  }
  update(id: string, dto: { label: string; category: string; link: string }): Observable<MyFile> {
    return this.http.patch<MyFile>(`${this.base}/${id}`, dto);
  }
  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
