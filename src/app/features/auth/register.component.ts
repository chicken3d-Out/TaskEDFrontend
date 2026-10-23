import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SchoolsService } from '../../core/services/schools.service';
import { Role, School } from '../../core/models/user.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private schoolsService = inject(SchoolsService);
  private router = inject(Router);
  public auth = inject(AuthService);

  Role = Role;
  schools: School[] = [];
  submitting = false;
  error: string | null = null;

  form = this.fb.group({
    role: [Role.TEACHER, Validators.required],
    designation: ['', Validators.required],
    district: ['', Validators.required],
    schoolId: [''],
    assignedSchoolIds: [[] as string[]],
  });

  ngOnInit() {
    this.schoolsService.findAll().subscribe((schools) => (this.schools = schools));
  }

  get isTeacher() {
    return this.form.value.role === Role.TEACHER;
  }
  get isAo() {
    return this.form.value.role === Role.ADMIN_OFFICER;
  }

  toggleAssignedSchool(schoolId: string, checked: boolean) {
    const current = this.form.value.assignedSchoolIds ?? [];
    this.form.patchValue({
      assignedSchoolIds: checked
        ? [...current, schoolId]
        : current.filter((id) => id !== schoolId),
    });
  }

  async submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.error = null;
    try {
      await this.auth.register({
        role: this.form.value.role!,
        designation: this.form.value.designation!,
        district: this.form.value.district!,
        schoolId: this.isTeacher ? this.form.value.schoolId! : undefined,
        assignedSchoolIds: this.isAo ? this.form.value.assignedSchoolIds! : undefined,
      });
      this.router.navigateByUrl(this.auth.routeForCurrentState());
    } catch (e: any) {
      this.error = e?.error?.message ?? 'Registration failed. Please try again.';
    } finally {
      this.submitting = false;
    }
  }
}
