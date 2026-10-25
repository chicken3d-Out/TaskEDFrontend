import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { SchoolsService } from '../../core/services/schools.service';
import { School } from '../../core/models/user.model';
import { AvatarPickerComponent } from '../avatar/avatar-picker.component';

// One form used by both first-time registration and the profile page.
@Component({
  selector: 'app-profile-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AvatarPickerComponent],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss',
})
export class ProfileFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private usersService = inject(UsersService);
  private schoolsService = inject(SchoolsService);

  @Input() mode: 'register' | 'edit' = 'edit';
  @Output() saved = new EventEmitter<void>();

  schools: School[] = [];
  avatarUrl: string | null = null;
  saving = false;
  done = false;
  error: string | null = null;

  form = this.fb.group({
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    contactNumber: ['', [Validators.required, Validators.pattern(/^[0-9+()\-\s]{7,20}$/)]],
    designation: ['', Validators.required],
    schoolId: ['', Validators.required],
    district: ['', Validators.required],
    area: ['', Validators.required],
  });

  get user() {
    return this.auth.currentUser();
  }

  ngOnInit() {
    const u = this.user;
    if (u) {
      this.avatarUrl = u.avatarUrl;
      this.form.patchValue({
        firstName: u.firstName ?? '',
        middleName: u.middleName ?? '',
        lastName: u.lastName ?? '',
        contactNumber: u.contactNumber ?? '',
        designation: u.designation ?? '',
        schoolId: u.school?.id ?? '',
        district: u.district ?? '',
        area: u.area ?? '',
      });
    }
    this.schoolsService.findAll().subscribe((schools) => (this.schools = schools));
  }

  // Picking a school suggests its district (still editable).
  onSchoolChange() {
    const school = this.schools.find((s) => s.id === this.form.value.schoolId);
    if (school && !this.form.value.district) {
      this.form.patchValue({ district: school.district });
    }
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.done = false;
    this.error = null;
    const v = this.form.value;
    const dto = {
      firstName: v.firstName!,
      middleName: v.middleName || undefined,
      lastName: v.lastName!,
      contactNumber: v.contactNumber!,
      designation: v.designation!,
      schoolId: v.schoolId!,
      district: v.district!,
      area: v.area!,
      avatarUrl: this.avatarUrl,
    };
    try {
      if (this.mode === 'register') {
        await this.auth.register(dto);
      } else {
        await new Promise<void>((resolve, reject) =>
          this.usersService.updateProfile(dto).subscribe({ next: () => resolve(), error: reject }),
        );
        await this.auth.loadCurrentUser();
      }
      this.done = true;
      this.saved.emit();
    } catch (e: any) {
      this.error = e?.error?.message ?? 'Could not save your profile. Please try again.';
    } finally {
      this.saving = false;
    }
  }
}
