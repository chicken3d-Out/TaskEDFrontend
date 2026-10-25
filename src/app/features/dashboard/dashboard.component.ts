import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { CalendarService } from '../../core/services/calendar.service';
import { CalendarEvent } from '../../core/models/calendar-event.model';
import { TICKET_STATUS_LABELS, TicketStatus } from '../../core/models/ticket.model';
import { Role, roleLabel } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { MonthCalendarComponent } from '../../shared/month-calendar/month-calendar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingComponent, IconComponent, MonthCalendarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  public auth = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private calendarService = inject(CalendarService);
  private realtime = inject(RealtimeService);

  Role = Role;
  roleLabel = roleLabel;
  statusLabels = TICKET_STATUS_LABELS;
  statuses = Object.values(TicketStatus);

  summary: DashboardSummary | null = null;
  events: CalendarEvent[] = [];
  loading = true;
  today = new Date();

  private unsubs: (() => void)[] = [];

  ngOnInit() {
    this.load(true);
    this.unsubs.push(
      this.realtime.on('tickets:changed', () => this.load(false)),
      this.realtime.on('calendar:changed', () => this.load(false)),
    );
  }

  ngOnDestroy() {
    this.unsubs.forEach((u) => u());
  }

  private load(showLoading: boolean) {
    if (showLoading) this.loading = true;
    this.dashboardService.load().subscribe({
      next: (s) => {
        this.summary = s;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
    this.calendarService.findAll().subscribe((e) => (this.events = e));
  }

  get greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  get firstName(): string {
    const u = this.auth.currentUser();
    return u?.firstName || u?.name?.split(' ')[0] || '';
  }

  get profileIncomplete(): boolean {
    return !this.auth.currentUser()?.profileComplete;
  }

  barWidth(status: string): number {
    const t = this.summary?.tickets;
    if (!t || t.total === 0) return 0;
    return Math.round(((t.byStatus[status] ?? 0) / t.total) * 100);
  }

  roleEntries(): { role: string; count: number }[] {
    const by = this.summary?.admin?.byRole ?? {};
    return Object.entries(by).map(([role, count]) => ({
      role: role === 'unassigned' ? 'No role yet' : roleLabel(role),
      count,
    }));
  }

  statusLabel(status: string): string {
    return this.statusLabels[status as TicketStatus] ?? status;
  }

  statusClass(status: string) {
    return `st-${status}`;
  }
}
