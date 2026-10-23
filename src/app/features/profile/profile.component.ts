import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { SchoolsService } from '../../core/services/schools.service';
import { Role, School } from '../../core/models/user.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  public auth = inject(AuthService);
  private usersService = inject(UsersService);
  private schoolsService = inject(SchoolsService);
  private fb = inject(FormBuilder);

  Role = Role;
  schools: School[] = [];
  saving = false;
  saved = false;
  error: string | null = null;

  form = this.fb.group({
    name: ['', Validators.required],
    district: ['', Validators.required],
    designation: ['', Validators.required],
    schoolId: [''],
  });

  ngOnInit() {
    const user = this.auth.currentUser();
    this.form.patchValue({
      name: user?.name ?? '',
      district: user?.district ?? '',
      designation: user?.designation ?? '',
      schoolId: user?.school?.id ?? '',
    });

    if (this.isTeacher) {
      this.schoolsService.findAll().subscribe((schools) => (this.schools = schools));
    }
  }

  get isTeacher() {
    return this.auth.currentUser()?.role === Role.TEACHER;
  }

  submit() {
    if (this.form.invalid) return;
    this.saving = true;
    this.saved = false;
    this.error = null;
    const raw = this.form.value;
    this.usersService
      .updateProfile({
        name: raw.name!,
        district: raw.district!,
        designation: raw.designation!,
        schoolId: this.isTeacher && raw.schoolId ? raw.schoolId : undefined,
      })
      .subscribe({
        next: async () => {
          await this.auth.loadCurrentUser(); // refresh cached user (nav, guards, etc.)
          this.saving = false;
          this.saved = true;
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Could not save your profile.';
          this.saving = false;
        },
      });
  }
}
