import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
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

  // 'calendar' = month grid + the selected day; 'announcements' = list of
  // upcoming announcement-flagged events. Same backing data per the spec.
  @Input() mode: 'calendar' | 'announcements' = 'calendar';

  events: CalendarEvent[] = [];
  selectedDate: Date = new Date();
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
    isAnnouncement: [true],
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
    return role === Role.ADMINISTRATOR || role === Role.ADMIN_OFFICE_ACCOUNT;
  }

  get heading(): string {
    return this.mode === 'announcements' ? 'Announcements' : 'Calendar';
  }

  private sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  get dayEvents(): CalendarEvent[] {
    return this.events.filter((e) => this.sameDay(new Date(e.eventDate), this.selectedDate));
  }

  get upcoming(): CalendarEvent[] {
    const now = Date.now();
    return this.events.filter((e) => new Date(e.eventDate).getTime() >= now).slice(0, 6);
  }

  toDate(event: CalendarEvent): Date {
    return new Date(event.eventDate);
  }

  selectDay(date: Date) {
    this.selectedDate = date;
    // Pre-fill the form with the clicked day (9:00 AM) for managers.
    const d = new Date(date);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (!this.form.value.eventDate) this.form.patchValue({ eventDate: local });
  }

  private load(showLoading: boolean) {
    if (showLoading) this.loading = true;
    const source$ =
      this.mode === 'announcements'
        ? this.calendarService.findAnnouncements()
        : this.calendarService.findAll();
    source$.subscribe((events) => {
      this.events = events;
      this.loading = false;
    });
  }

  daysUntil(event: CalendarEvent): number {
    const diff = new Date(event.eventDate).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
        isAnnouncement: !!raw.isAnnouncement,
      })
      .subscribe({
        next: () => {
          this.form.reset({ title: '', description: '', eventDate: '', zoomLink: '', isAnnouncement: true });
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
