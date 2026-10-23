import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarService } from '../../core/services/calendar.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { CalendarEvent } from '../../core/models/calendar-event.model';
import { Role } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private calendarService = inject(CalendarService);
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private realtime = inject(RealtimeService);

  // 'calendar' shows every event chronologically; 'announcements' shows
  // only the announcement-flagged, still-upcoming ones - same backing data
  // per the spec ("every announcement... should also appear as a calendar
  // event, and vice versa").
  @Input() mode: 'calendar' | 'announcements' = 'calendar';

  events: CalendarEvent[] = [];
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
    // Someone (Administrator/Admin Office account) created, edited, or
    // deleted an event - re-fetch quietly so it shows up live for
    // everyone viewing the calendar/announcements, without a refresh.
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
    this.calendarService.remove(event.id).subscribe(() => this.load(false));
  }
}
