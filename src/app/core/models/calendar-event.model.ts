import { User } from './user.model';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  zoomLink: string | null;
  isAnnouncement: boolean;
  createdBy: User;
  createdAt: string;
}
