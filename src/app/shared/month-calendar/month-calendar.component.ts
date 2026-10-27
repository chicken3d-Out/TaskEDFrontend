import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export interface CalendarDot {
  id: string;
  title: string;
  eventDate: string;
}

interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarDot[];
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// A real month grid. Days with events show dots; clicking a day emits it.
@Component({
  selector: 'app-month-calendar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cal" [class.compact]="compact">
      <div class="head">
        <strong>{{ monthLabel() }}</strong>
        <div class="nav">
          <button type="button" (click)="shift(-1)" aria-label="Previous month">
            <app-icon name="chevron-left" [size]="18" />
          </button>
          <button type="button" class="today" (click)="goToday()">Today</button>
          <button type="button" (click)="shift(1)" aria-label="Next month">
            <app-icon name="chevron-right" [size]="18" />
          </button>
        </div>
      </div>
      <div class="grid weekdays">
        @for (w of weekdays; track w) {
          <span>{{ w }}</span>
        }
      </div>
      <div class="grid days">
        @for (cell of cells(); track cell.key) {
          <button
            type="button"
            class="day"
            [class.out]="!cell.inMonth"
            [class.today]="cell.isToday"
            [class.selected]="selectedKey === cell.key"
            (click)="pick(cell)"
          >
            <span class="num">{{ cell.date.getDate() }}</span>
            @if (cell.events.length) {
              <span class="dots">
                @for (e of cell.events.slice(0, 3); track e.id) {
                  <i></i>
                }
              </span>
              @if (!compact) {
                <span
                  class="first"
                  role="button"
                  [title]="cell.events[0].title"
                  (click)="pickEvent($event, cell, cell.events[0].id)"
                  >{{ cell.events[0].title }}</span
                >
                @if (cell.events.length > 1) {
                  <span class="more">+{{ cell.events.length - 1 }} more</span>
                }
              }
            }
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './month-calendar.component.scss',
})
export class MonthCalendarComponent {
  @Input() set events(value: CalendarDot[]) {
    this._events.set(value ?? []);
  }
  @Input() compact = false;
  @Input() selectedDate: Date | null = null;
  @Output() daySelected = new EventEmitter<Date>();
  @Output() eventSelected = new EventEmitter<string>();

  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  private _events = signal<CalendarDot[]>([]);
  private cursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  get selectedKey(): string | null {
    return this.selectedDate ? dayKey(this.selectedDate) : null;
  }

  monthLabel() {
    return this.cursor().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  cells = () => {
    const first = this.cursor();
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // back up to Sunday
    const byDay = new Map<string, CalendarDot[]>();
    for (const e of this._events()) {
      const k = dayKey(new Date(e.eventDate));
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    const todayKey = dayKey(new Date());
    const out: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dayKey(d);
      out.push({
        date: d,
        key,
        inMonth: d.getMonth() === first.getMonth(),
        isToday: key === todayKey,
        events: byDay.get(key) ?? [],
      });
    }
    return out;
  };

  shift(delta: number) {
    const c = this.cursor();
    this.cursor.set(new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  goToday() {
    const t = new Date();
    this.cursor.set(new Date(t.getFullYear(), t.getMonth(), 1));
    this.daySelected.emit(t);
  }

  pickEvent(domEvent: Event, cell: DayCell, id: string) {
    domEvent.stopPropagation();
    this.daySelected.emit(cell.date);
    this.eventSelected.emit(id);
  }

  pick(cell: DayCell) {
    this.daySelected.emit(cell.date);
  }
}
