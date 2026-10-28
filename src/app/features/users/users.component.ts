import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersService } from '../../core/services/users.service';
import { SchoolsService } from '../../core/services/schools.service';
import { AuthService } from '../../core/services/auth.service';
import { AccountStatus, ROLE_LABELS, Role, School, User, roleLabel } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';

interface Row {
  user: User;
  role: Role | '';
  schoolIds: Set<string>;
  busy: boolean;
  error: string | null;
  editing: boolean;
  edit: {
    firstName: string;
    middleName: string;
    lastName: string;
    contactNumber: string;
    depedEmail: string;
    designation: string;
    schoolId: string;
    district: string;
    area: string;
  };
  newPassword: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LoadingComponent, AvatarComponent, IconComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private usersService = inject(UsersService);
  private schoolsService = inject(SchoolsService);
  private fb = inject(FormBuilder);
  public auth = inject(AuthService);

  Role = Role;
  roleLabel = roleLabel;
  AccountStatus = AccountStatus;
  // Administrator is not offered here: administrators are created with
  // "Add user" and sign in with a username and password.
  roles = [Role.TEACHER, Role.ADMIN_OFFICER, Role.ADMIN_OFFICE_ACCOUNT].map((r) => ({
    value: r,
    label: ROLE_LABELS[r],
  }));

  rows: Row[] = [];
  schools: School[] = [];
  loading = true;
  filter: 'pending' | 'all' = 'pending';
  search = '';

  // add-user panel
  showAdd = false;
  addKind: 'staff' | 'admin' = 'staff';
  addSchoolIds = new Set<string>();
  adding = false;
  addError: string | null = null;
  addForm = this.fb.group({
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    contactNumber: [''],
    depedEmail: [''],
    role: [Role.TEACHER as Role],
    schoolId: [''],
    designation: [''],
    district: [''],
    area: [''],
    username: [''],
    password: [''],
  });

  ngOnInit() {
    this.schoolsService.findAll().subscribe((s) => (this.schools = s));
    this.load();
  }

  private load() {
    this.loading = true;
    this.usersService.all().subscribe({
      next: (users) => {
        this.rows = users.map((user) => ({
          user,
          role: user.role ?? '',
          schoolIds: new Set((user.assignedSchools ?? []).map((s) => s.id)),
          busy: false,
          error: null,
          editing: false,
          newPassword: '',
          edit: {
            firstName: user.firstName ?? '',
            middleName: user.middleName ?? '',
            lastName: user.lastName ?? '',
            contactNumber: user.contactNumber ?? '',
            depedEmail: user.depedEmail ?? '',
            designation: user.designation ?? '',
            schoolId: user.school?.id ?? '',
            district: user.district ?? '',
            area: user.area ?? '',
          },
        }));
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  // ---- counts ----
  get totalUsers() {
    return this.rows.length;
  }
  get pendingCount(): number {
    return this.rows.filter((r) => this.needsReview(r.user)).length;
  }
  get activeCount() {
    return this.rows.filter((r) => r.user.status === AccountStatus.APPROVED).length;
  }
  get suspendedCount() {
    return this.rows.filter((r) => r.user.status === AccountStatus.SUSPENDED).length;
  }

  needsReview(u: User) {
    return u.status === AccountStatus.PENDING && u.profileComplete;
  }

  get visible(): Row[] {
    const q = this.search.trim().toLowerCase();
    return this.rows.filter((r) => {
      if (this.filter === 'pending' && !this.needsReview(r.user)) return false;
      if (!q) return true;
      return [r.user.name, r.user.depedEmail, r.user.username, r.user.school?.name, r.user.district, r.user.area]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }

  isPasswordAccount(u: User) {
    return !!u.username;
  }

  isSelf(u: User) {
    return u.id === this.auth.currentUser()?.id;
  }

  // ---- role assignment ----
  toggleSchool(row: Row, id: string, checked: boolean) {
    checked ? row.schoolIds.add(id) : row.schoolIds.delete(id);
  }

  canSave(row: Row): boolean {
    if (!row.role) return false;
    if (row.role === Role.ADMIN_OFFICER && row.schoolIds.size === 0) return false;
    return true;
  }

  save(row: Row) {
    if (!this.canSave(row)) return;
    row.busy = true;
    row.error = null;
    this.usersService
      .assignRole(row.user.id, row.role as Role, row.role === Role.ADMIN_OFFICER ? [...row.schoolIds] : undefined)
      .subscribe({
        next: () => this.load(),
        error: (e) => {
          row.error = e?.error?.message ?? 'Could not save.';
          row.busy = false;
        },
      });
  }

  reject(row: Row) {
    if (!confirm(`Reject ${row.user.name}?`)) return;
    this.act(row, this.usersService.reject(row.user.id));
  }

  suspend(row: Row) {
    if (!confirm(`Suspend ${row.user.name}? They will not be able to sign in.`)) return;
    this.act(row, this.usersService.setStatus(row.user.id, AccountStatus.SUSPENDED));
  }

  reactivate(row: Row) {
    this.act(row, this.usersService.setStatus(row.user.id, AccountStatus.APPROVED));
  }

  private act(row: Row, request$: import('rxjs').Observable<unknown>) {
    row.busy = true;
    row.error = null;
    request$.subscribe({
      next: () => this.load(),
      error: (e) => {
        row.error = e?.error?.message ?? 'Action failed.';
        row.busy = false;
      },
    });
  }

  // ---- edit details ----
  saveEdit(row: Row) {
    row.busy = true;
    row.error = null;
    const e = row.edit;
    this.usersService
      .adminUpdate(row.user.id, {
        firstName: e.firstName,
        middleName: e.middleName,
        lastName: e.lastName,
        contactNumber: e.contactNumber,
        designation: e.designation,
        schoolId: e.schoolId || undefined,
        district: e.district,
        area: e.area,
        ...(this.isPasswordAccount(row.user) ? {} : { depedEmail: e.depedEmail }),
      })
      .subscribe({
        next: () => this.load(),
        error: (err) => {
          row.error = err?.error?.message ?? 'Could not save.';
          row.busy = false;
        },
      });
  }

  resetPassword(row: Row) {
    if (row.newPassword.length < 10) {
      row.error = 'New password must be at least 10 characters.';
      return;
    }
    row.busy = true;
    row.error = null;
    this.usersService.resetPassword(row.user.id, row.newPassword).subscribe({
      next: () => {
        row.newPassword = '';
        row.busy = false;
        row.error = null;
        alert('Password updated.');
      },
      error: (err) => {
        row.error = err?.error?.message ?? 'Could not reset the password.';
        row.busy = false;
      },
    });
  }

  // ---- add user ----
  toggleAddSchool(id: string, checked: boolean) {
    checked ? this.addSchoolIds.add(id) : this.addSchoolIds.delete(id);
  }

  get addValid(): boolean {
    const v = this.addForm.value;
    if (!v.firstName?.trim() || !v.lastName?.trim()) return false;
    if (this.addKind === 'admin') return !!v.username?.trim() && (v.password?.length ?? 0) >= 10;
    if (!v.depedEmail?.trim()) return false;
    if (v.role === Role.TEACHER && !v.schoolId) return false;
    if (v.role === Role.ADMIN_OFFICER && this.addSchoolIds.size === 0) return false;
    return true;
  }

  addUser() {
    if (!this.addValid) return;
    this.adding = true;
    this.addError = null;
    const v = this.addForm.value;
    this.usersService
      .create({
        kind: this.addKind,
        firstName: v.firstName!,
        middleName: v.middleName || undefined,
        lastName: v.lastName!,
        contactNumber: v.contactNumber || undefined,
        designation: v.designation || undefined,
        district: v.district || undefined,
        area: v.area || undefined,
        schoolId: v.schoolId || undefined,
        depedEmail: v.depedEmail || undefined,
        ...(this.addKind === 'staff'
          ? {
              role: v.role as Role,
              assignedSchoolIds: v.role === Role.ADMIN_OFFICER ? [...this.addSchoolIds] : undefined,
            }
          : { username: v.username!, password: v.password! }),
      })
      .subscribe({
        next: () => {
          this.addForm.reset({ role: Role.TEACHER });
          this.addSchoolIds.clear();
          this.showAdd = false;
          this.adding = false;
          this.filter = 'all';
          this.load();
        },
        error: (e) => {
          this.addError = e?.error?.message ?? 'Could not add the user.';
          this.adding = false;
        },
      });
  }
}
