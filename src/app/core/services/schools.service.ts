import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { School } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class SchoolsService {
  constructor(private http: HttpClient) {}

  findAll(): Observable<School[]> {
    return this.http.get<School[]>(`${environment.apiUrl}/schools`);
  }
}
