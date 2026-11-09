import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarService, CalendarNoteDto } from '../../core/services/calendar.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { CalendarEvent } from '../../core/models/calendar-event.model';
import { Role } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { MonthCalendarComponent } from '../../shared/month-calendar/month-calendar.component';

type Item = CalendarEvent & { holiday?: boolean; note?: boolean; noteId?: string; noteBody?: string };

// Calendar and announcements are one thing: every event is an announcement
// too. The month grid is clickable; the side panel shows today's events,
// the selected day, and what is coming up, each with full details.
@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LoadingComponent, IconComponent, MonthCalendarComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
})
export class CalendarComponent implements OnInit, OnDestroy {
  private calendarService = inject(CalendarService);
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private realtime = inject(RealtimeService);

  // Division events and announcements (green), Philippine holidays (blue) and the person's private notes (orange).
  events: Item[] = [];
  private systemEvents: CalendarEvent[] = [];
  private noteItems: Item[] = [];
  private holidayItems: Item[] = [];
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

  private merge() {
    this.events = [...this.systemEvents, ...this.holidayItems, ...this.noteItems].sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
    );
  }

  // ---- personal notes (private, orange) ----
  noteTitle = '';
  noteBody = '';
  noteBusy = false;
  noteError: string | null = null;
  editingNote: string | null = null;
  noteOpen = false;
  dayOpen = false;

  openNote() {
    this.cancelNote();
    this.dayOpen = true;
    this.noteOpen = true;
  }

  closeDay() {
    this.cancelNote();
    this.dayOpen = false;
  }

  private ymd(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private setNotes(list: CalendarNoteDto[]) {
    this.noteItems = list.map((n) => ({
      id: 'n:' + n.id,
      noteId: n.id,
      title: n.title,
      description: n.body,
      noteBody: n.body,
      eventDate: new Date(n.noteDate + 'T12:00:00').toISOString(),
      zoomLink: null,
      isAnnouncement: false,
      createdBy: { name: 'You' } as any,
      createdAt: n.noteDate,
      note: true,
    }));
    this.merge();
  }

  saveNote() {
    const title = this.noteTitle.trim();
    if (!title || this.noteBusy) return;
    this.noteBusy = true;
    this.noteError = null;
    const req = this.editingNote
      ? this.calendarService.updateNote(this.editingNote, { title, body: this.noteBody })
      : this.calendarService.addNote({ noteDate: this.ymd(this.selectedDate), title, body: this.noteBody });
    req.subscribe({
      next: () => {
        this.noteTitle = '';
        this.noteBody = '';
        this.editingNote = null;
        this.noteOpen = false;
        this.noteBusy = false;
        this.loadNotes();
      },
      error: (e) => {
        this.noteError = e?.error?.message ?? 'Could not save your note.';
        this.noteBusy = false;
      },
    });
  }

  editNote(e: Item) {
    this.editingNote = e.noteId ?? null;
    this.noteTitle = e.title;
    this.noteBody = e.noteBody ?? '';
    this.noteError = null;
    this.noteOpen = true;
  }

  cancelNote() {
    this.editingNote = null;
    this.noteOpen = false;
    this.noteTitle = '';
    this.noteBody = '';
    this.noteError = null;
  }

  removeNote(e: Item) {
    if (!e.noteId || !confirm(`Delete your note "${e.title}"?`)) return;
    this.calendarService.deleteNote(e.noteId).subscribe(() => this.loadNotes());
  }

  private loadNotes() {
    this.calendarService.notes().subscribe({ next: (l) => this.setNotes(l), error: () => undefined });
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

  get dayEvents(): Item[] {
    return this.events.filter((e) => this.sameDay(new Date(e.eventDate), this.selectedDate));
  }

  // Strictly after today, soonest first.
  get upcoming(): Item[] {
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
    this.dayOpen = true;
    if (this.editingNote || this.noteOpen) this.cancelNote();
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
      this.systemEvents = events;
      this.merge();
      this.loading = false;
    });
    if (showLoading) {
      this.calendarService.holidays().subscribe({
        next: (r) => {
          this.holidayItems = r.holidays.map((h) => ({
            id: 'h:' + h.date,
            title: h.title,
            description: 'Philippine holiday',
            eventDate: new Date(h.date + 'T12:00:00').toISOString(),
            zoomLink: null,
            isAnnouncement: false,
            createdBy: { name: 'Philippine holiday' } as any,
            createdAt: h.date,
            holiday: true,
          }));
          this.merge();
        },
        error: () => undefined,
      });
    }
    if (showLoading) this.loadNotes();
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
