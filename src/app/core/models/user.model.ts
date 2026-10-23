export enum Role {
  TEACHER = 'teacher',
  ADMIN_OFFICER = 'admin_officer',
  ADMIN_OFFICE_ACCOUNT = 'admin_office_account',
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
  district: string;
}

export interface User {
  id: string;
  googleId: string;
  depedEmail: string;
  name: string;
  district: string | null;
  designation: string | null;
  role: Role | null;
  status: AccountStatus;
  school: School | null;
  assignedSchools: School[];
  createdAt: string;
}
