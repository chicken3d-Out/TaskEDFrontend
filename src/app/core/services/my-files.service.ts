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
  upload(file: File, label: string, category: string): Observable<MyFile> {
    const form = new FormData();
    form.append('file', file);
    form.append('label', label);
    form.append('category', category);
    return this.http.post<MyFile>(this.base, form);
  }
  rename(id: string, label: string, category: string): Observable<MyFile> {
    return this.http.patch<MyFile>(`${this.base}/${id}`, { label, category });
  }
  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
  download(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/download`, { responseType: 'blob' });
  }
}
