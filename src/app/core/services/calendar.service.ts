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

export interface CalendarNoteDto {
  id: string;
  noteDate: string; // YYYY-MM-DD
  title: string;
  body: string;
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

export interface IcalResult {
  linked: boolean;
  count: number;
  events: PersonalEvent[];
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

  // Your own Google Calendar, read one way into TaskEd through its private iCal link.
  linkCalendar(url: string): Observable<IcalResult> {
    return this.http.put<IcalResult>(`${this.base}/ical`, { url });
  }
  unlinkCalendar(): Observable<unknown> {
    return this.http.delete(`${this.base}/ical`);
  }
  syncCalendar(force = false): Observable<IcalResult> {
    return this.http.post<IcalResult>(`${this.base}/ical/sync`, { force });
  }

  notes(): Observable<CalendarNoteDto[]> {
    return this.http.get<CalendarNoteDto[]>(`${this.base}/notes`);
  }
  addNote(n: { noteDate: string; title: string; body?: string }): Observable<CalendarNoteDto> {
    return this.http.post<CalendarNoteDto>(`${this.base}/notes`, n);
  }
  updateNote(id: string, n: { title?: string; body?: string }): Observable<CalendarNoteDto> {
    return this.http.patch<CalendarNoteDto>(`${this.base}/notes/${id}`, n);
  }
  deleteNote(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/notes/${id}`);
  }

  // Philippine public holidays (read by the server from Google's public holiday calendar).
  holidays(): Observable<{ source: string; holidays: { date: string; title: string }[] }> {
    return this.http.get<{ source: string; holidays: { date: string; title: string }[] }>(`${this.base}/holidays`);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${id}`);
  }
}
