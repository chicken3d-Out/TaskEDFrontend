import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CalendarEvent } from '../models/calendar-event.model';

export interface UpsertCalendarEventDto {
  title: string;
  description: string;
  eventDate: string;
  zoomLink?: string;
  isAnnouncement?: boolean;
}

export interface PersonalEvent {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  htmlLink: string | null;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private base = `${environment.apiUrl}/calendar`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<CalendarEvent[]> {
    return this.http.get<CalendarEvent[]>(this.base);
  }

  findAnnouncements(): Observable<CalendarEvent[]> {
    return this.http.get<CalendarEvent[]>(`${this.base}/announcements`);
  }

  create(dto: UpsertCalendarEventDto): Observable<CalendarEvent> {
    return this.http.post<CalendarEvent>(this.base, dto);
  }

  update(id: string, dto: Partial<UpsertCalendarEventDto>): Observable<CalendarEvent> {
    return this.http.patch<CalendarEvent>(`${this.base}/${id}`, dto);
  }

  personal(): Observable<PersonalEvent[]> {
    return this.http.get<PersonalEvent[]>(`${this.base}/personal`);
  }

  syncGoogle(force = false): Observable<{ connected: boolean; pulled: number; pushed: number; events: PersonalEvent[] }> {
    return this.http.post<{ connected: boolean; pulled: number; pushed: number; events: PersonalEvent[] }>(
      `${this.base}/google/sync`,
      { force },
    );
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
