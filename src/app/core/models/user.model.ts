export enum Role {
  TEACHER = 'teacher',
  ADMIN_OFFICER = 'admin_officer',
  PUBLISHER = 'publisher',
  SCHOOL = 'school',
  ADMINISTRATOR = 'administrator',
}

export enum AccountStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export interface School {
  id: string;
  name: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  contactNumber: string | null;
  area: string | null;
  avatarUrl: string | null;
  // true once name, contact, designation, school, district and area are filled in
  profileComplete: boolean;
  district: string;
}

export interface SchoolInfo {
  id: string;
  name: string;
  district: string;
  area: string;
  schoolCode: string | null;
  address: string | null;
  contactNumber: string | null;
  email: string | null;
  schoolHeadName: string | null;
  schoolHeadContact: string | null;
}

export interface User {
  id: string;
  googleId: string | null;
  depedEmail: string | null;
  // set only for Administrator accounts, which sign in with username + password
  username: string | null;
  name: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  contactNumber: string | null;
  area: string | null;
  avatarUrl: string | null;
  // true once name, contact, designation, school, district and area are filled in
  profileComplete: boolean;
  district: string | null;
  designation: string | null;
  role: Role | null;
  status: AccountStatus;
  school: School | null;
  assignedSchools: School[];
  createdAt: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.TEACHER]: 'Teacher',
  [Role.ADMIN_OFFICER]: 'Administrative Officer',
  [Role.PUBLISHER]: 'Publisher',
  [Role.SCHOOL]: 'School',
  [Role.ADMINISTRATOR]: 'Administrator',
};

export function roleLabel(role: Role | string | null | undefined): string {
  if (!role) return 'No role yet';
  return ROLE_LABELS[role as Role] ?? String(role);
}

export function initialsOf(user: Pick<User, 'name'> | null | undefined): string {
  const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
