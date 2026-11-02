import { SchoolInfo, User, AccountStatus } from './user.model';

export interface PersonMini {
  id: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
  contactNumber: string | null;
  depedEmail: string | null;
  status: AccountStatus;
}

export interface SchoolOverview {
  school: SchoolInfo;
  canEdit: boolean;
  personnel: {
    schoolHead: { id?: string | null; name: string; contactNumber: string | null; avatarUrl?: string | null; designation?: string | null; depedEmail?: string | null } | null;
    schoolAccount: PersonMini | null;
    administrativeOfficers: PersonMini[];
    teachers: PersonMini[];
  };
}

export interface SchoolSummaryRow {
  id: string;
  name: string;
  district: string;
  area: string;
  teachers: number;
  pendingTeachers: number;
  schoolAccount: string | null;
  ao: string | null;
  documentsUploaded: number;
  documentsTotal: number;
}

export interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  active: boolean;
  sortOrder: number;
}

export interface SchoolFileView {
  id: string;
  fileName: string;
  link: string;
  uploadedBy: string | null;
  createdAt: string;
}

export interface SchoolFileArchiveRow extends SchoolFileView {
  document: string;
  kind: FileKind;
}

export interface SchoolFilesView {
  canUpload: boolean;
  currentYear: string;
  archive: { schoolYear: string; files: SchoolFileArchiveRow[] }[];
  documents: { type: DocumentType; soft: SchoolFileView | null; scanned: SchoolFileView | null }[];
}

export type FileKind = 'soft' | 'scanned';

export interface TeacherInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  contactNumber?: string;
  designation?: string;
  depedEmail?: string;
}

export type TeacherRow = User;
