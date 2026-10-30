import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarService } from '../../core/services/calendar.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { CalendarEvent } from '../../core/models/calendar-event.model';
import { Role } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { MonthCalendarComponent } from '../../shared/month-calendar/month-calendar.component';

// Calendar and announcements are one thing: every event is an announcement
// too. The month grid is clickable; the side panel shows today's events,
// the selected day, and what is coming up, each with full details.
@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingComponent, IconComponent, MonthCalendarComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private calendarService = inject(CalendarService);
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private realtime = inject(RealtimeService);

  events: CalendarEvent[] = [];
  today = new Date();
  selectedDate: Date = new Date();
  expandedId: string | null = null;
  loading = true;
  showForm = false;
  submitting = false;
  error: string | null = null;

  private unsubscribeRealtime?: () => void;

  form = this.fb.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    eventDate: ['', Validators.required],
    zoomLink: [''],
  });

  ngOnInit() {
    this.load(true);
    this.unsubscribeRealtime = this.realtime.on('calendar:changed', () => this.load(false));
  }

  ngOnDestroy() {
    this.unsubscribeRealtime?.();
  }

  get canManage(): boolean {
    const role = this.auth.currentUser()?.role;
    return role === Role.ADMINISTRATOR || role === Role.PUBLISHER;
  }

  private sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  get todayEvents(): CalendarEvent[] {
    return this.events.filter((e) => this.sameDay(new Date(e.eventDate), this.today));
  }

  get selectedIsToday(): boolean {
    return this.sameDay(this.selectedDate, this.today);
  }

  get dayEvents(): CalendarEvent[] {
    return this.events.filter((e) => this.sameDay(new Date(e.eventDate), this.selectedDate));
  }

  // Strictly after today, soonest first.
  get upcoming(): CalendarEvent[] {
    const endOfToday = new Date(this.today);
    endOfToday.setHours(23, 59, 59, 999);
    return this.events.filter((e) => new Date(e.eventDate) > endOfToday).slice(0, 8);
  }

  toggle(id: string) {
    this.expandedId = this.expandedId === id ? null : id;
  }

  openEvent(id: string) {
    this.expandedId = id;
  }

  selectDay(date: Date) {
    this.selectedDate = date;
    this.expandedId = null;
    // Pre-fill the form with the clicked day (9:00 AM) for managers.
    const d = new Date(date);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (!this.form.value.eventDate) this.form.patchValue({ eventDate: local });
  }

  selectEventDay(event: CalendarEvent) {
    this.selectedDate = new Date(event.eventDate);
    this.expandedId = event.id;
  }

  private load(showLoading: boolean) {
    if (showLoading) this.loading = true;
    this.calendarService.findAll().subscribe((events) => {
      this.events = events;
      this.loading = false;
    });
  }

  daysUntil(event: CalendarEvent): number {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const target = new Date(event.eventDate);
    target.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - start.getTime()) / 86400000);
  }

  submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.error = null;
    const raw = this.form.value;
    this.calendarService
      .create({
        title: raw.title!,
        description: raw.description!,
        eventDate: new Date(raw.eventDate!).toISOString(),
        zoomLink: raw.zoomLink || undefined,
        isAnnouncement: true,
      })
      .subscribe({
        next: () => {
          this.form.reset({ title: '', description: '', eventDate: '', zoomLink: '' });
          this.showForm = false;
          this.submitting = false;
          this.load(false);
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Could not save the event.';
          this.submitting = false;
        },
      });
  }

  remove(event: CalendarEvent) {
    if (!confirm(`Delete "${event.title}"?`)) return;
    this.calendarService.remove(event.id).subscribe(() => this.load(false));
  }
}
