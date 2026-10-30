import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardSummary {
  tickets: null | {
    total: number;
    open: number;
    mine: number;
    byStatus: Record<string, number>;
    recent: { id: string; title: string; status: string; createdAt: string; requesterName: string }[];
  };
  upcomingEvents: {
    id: string;
    title: string;
    eventDate: string;
    isAnnouncement: boolean;
    zoomLink: string | null;
  }[];
  admin: null | {
    pendingUsers: number;
    totalUsers: number;
    schools: number;
    pendingQuestions: number;
    byRole: Record<string, number>;
  };
  schools: null | {
    id: string;
    name: string;
    teachers: number;
    pendingTeachers: number;
    documentsUploaded: number;
    documentsTotal: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  load(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${environment.apiUrl}/dashboard`);
  }
}
