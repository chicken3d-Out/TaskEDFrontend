import { School, User } from './user.model';

export enum TicketStatus {
  SUBMITTED = 'submitted',
  ACKNOWLEDGED = 'acknowledged',
  IN_PROGRESS = 'in_progress',
  NEEDS_ATTACHMENT = 'needs_attachment',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.SUBMITTED]: 'Submitted',
  [TicketStatus.ACKNOWLEDGED]: 'Acknowledged',
  [TicketStatus.IN_PROGRESS]: 'In Progress',
  [TicketStatus.NEEDS_ATTACHMENT]: 'Needs Attachment',
  [TicketStatus.RESOLVED]: 'Resolved',
  [TicketStatus.CLOSED]: 'Closed',
};

// Mirrors the backend's VALID_TRANSITIONS map - used only to populate the
// status dropdown; the backend is the actual source of truth/enforcement.
export const VALID_NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.SUBMITTED]: [TicketStatus.ACKNOWLEDGED, TicketStatus.IN_PROGRESS],
  [TicketStatus.ACKNOWLEDGED]: [TicketStatus.IN_PROGRESS, TicketStatus.NEEDS_ATTACHMENT],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.NEEDS_ATTACHMENT, TicketStatus.RESOLVED],
  [TicketStatus.NEEDS_ATTACHMENT]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [],
};

export interface TicketUpdate {
  id: string;
  author: User;
  message: string;
  imageUrl: string | null;
  attachmentRequest: boolean;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  uploadedBy: User;
  fileUrl: string;
  fileName: string | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  requester: User;
  assignedAo: User;
  school: School;
  title: string;
  description: string;
  status: TicketStatus;
  updates?: TicketUpdate[];
  attachments?: TicketAttachment[];
  createdAt: string;
  updatedAt: string;
}
