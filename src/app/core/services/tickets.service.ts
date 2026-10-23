import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ticket, TicketStatus, TicketUpdate } from '../models/ticket.model';

export interface CreateTicketDto {
  title: string;
  description: string;
}

export interface PostUpdateDto {
  message: string;
  imageUrl?: string;
  attachmentRequest?: boolean;
  newStatus?: TicketStatus;
}

@Injectable({ providedIn: 'root' })
export class TicketsService {
  private base = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<Ticket[]> {
    return this.http.get<Ticket[]>(this.base);
  }

  findOne(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.base}/${id}`);
  }

  create(dto: CreateTicketDto): Observable<Ticket> {
    return this.http.post<Ticket>(this.base, dto);
  }

  postUpdate(ticketId: string, dto: PostUpdateDto): Observable<TicketUpdate> {
    return this.http.post<TicketUpdate>(`${this.base}/${ticketId}/updates`, dto);
  }

  addAttachment(
    ticketId: string,
    fileUrl: string,
    fileName?: string,
  ): Observable<unknown> {
    return this.http.post(`${this.base}/${ticketId}/attachments`, { fileUrl, fileName });
  }
}
