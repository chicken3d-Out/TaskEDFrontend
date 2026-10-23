import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TicketsService } from '../../core/services/tickets.service';
import { Ticket, TICKET_STATUS_LABELS } from '../../core/models/ticket.model';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { Role } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingComponent],
  templateUrl: './ticket-list.component.html',
  styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent implements OnInit, OnDestroy {
  tickets: Ticket[] = [];
  loading = true;
  statusLabels = TICKET_STATUS_LABELS;
  Role = Role;

  private unsubscribeRealtime?: () => void;

  constructor(
    private ticketsService: TicketsService,
    public auth: AuthService,
    private realtime: RealtimeService,
  ) {}

  ngOnInit() {
    this.load();
    // Any ticket change anywhere can affect this list (new ticket, status
    // change, etc.) - just quietly re-fetch through the normal, already
    // role-filtered API call rather than trying to patch the list in place.
    this.unsubscribeRealtime = this.realtime.on('tickets:changed', () => this.load());
  }

  ngOnDestroy() {
    this.unsubscribeRealtime?.();
  }

  private load() {
    this.ticketsService.findAll().subscribe((tickets) => {
      this.tickets = tickets;
      this.loading = false;
    });
  }

  isMine(ticket: Ticket): boolean {
    return ticket.requester.id === this.auth.currentUser()?.id;
  }
}
