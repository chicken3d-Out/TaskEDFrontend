import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent, AvatarComponent, IconComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private usersService = inject(UsersService);
  private schoolsService = inject(SchoolsService);
  public auth = inject(AuthService);

  Role = Role;
  roleLabel = roleLabel;
  roles = Object.values(Role).map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  AccountStatus = AccountStatus;

  rows: Row[] = [];
  schools: School[] = [];
  loading = true;
  filter: 'pending' | 'all' = 'pending';
  search = '';

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
        }));
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  isPending(u: User) {
    return u.status === AccountStatus.PENDING || u.status === AccountStatus.REJECTED;
  }

  get visible(): Row[] {
    const q = this.search.trim().toLowerCase();
    return this.rows.filter((r) => {
      if (this.filter === 'pending' && !(r.user.status === AccountStatus.PENDING && r.user.profileComplete)) {
        return false;
      }
      if (!q) return true;
      return [r.user.name, r.user.depedEmail, r.user.school?.name, r.user.district, r.user.area]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }

  get pendingCount(): number {
    return this.rows.filter((r) => r.user.status === AccountStatus.PENDING && r.user.profileComplete).length;
  }

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
      .assignRole(
        row.user.id,
        row.role as Role,
        row.role === Role.ADMIN_OFFICER ? [...row.schoolIds] : undefined,
      )
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
    row.busy = true;
    this.usersService.reject(row.user.id).subscribe({
      next: () => this.load(),
      error: (e) => {
        row.error = e?.error?.message ?? 'Could not reject.';
        row.busy = false;
      },
    });
  }
}
