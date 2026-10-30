import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SchoolPortalService } from '../../core/services/school-portal.service';
import { UploadService } from '../../core/services/upload.service';
import { AccountStatus, Role, SchoolInfo, User } from '../../core/models/user.model';
import { FileKind, SchoolFilesView, SchoolOverview } from '../../core/models/school-portal.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { IconComponent } from '../../shared/icon/icon.component';

type Tab = 'overview' | 'teachers' | 'files';

interface TeacherRow {
  user: User;
  editing: boolean;
  busy: boolean;
  error: string | null;
  edit: { firstName: string; middleName: string; lastName: string; contactNumber: string; designation: string; depedEmail: string };
}

// One page for three audiences: a School account (own school), an AO (their
// schools, can manage teachers but not edit the profile or upload files) and
// an Administrator (any school, opened from the Schools list).
@Component({
  selector: 'app-school',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DatePipe, LoadingComponent, AvatarComponent, IconComponent],
  templateUrl: './school.component.html',
  styleUrl: './school.component.scss',
})
export class SchoolComponent implements OnInit {
  private portal = inject(SchoolPortalService);
  private uploads = inject(UploadService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  public auth = inject(AuthService);

  AccountStatus = AccountStatus;
  Role = Role;

  schools: SchoolInfo[] = [];
  schoolId = '';
  tab: Tab = 'overview';
  loading = true;
  error: string | null = null;

  overview: SchoolOverview | null = null;
  teachers: TeacherRow[] = [];
  teachersLoaded = false;
  files: SchoolFilesView | null = null;

  // profile editing
  editingProfile = false;
  savingProfile = false;
  profileMsg: string | null = null;
  profileForm = this.fb.group({
    name: [''],
    schoolCode: [''],
    address: [''],
    contactNumber: [''],
    email: [''],
    schoolHeadName: [''],
    schoolHeadContact: [''],
  });

  // add teacher
  showAdd = false;
  adding = false;
  addError: string | null = null;
  addForm = this.fb.group({
    depedEmail: ['', Validators.required],
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    contactNumber: [''],
    designation: [''],
  });

  // files
  uploadingKey: string | null = null;
  fileError: string | null = null;

  get isAdmin() {
    return this.auth.currentUser()?.role === Role.ADMINISTRATOR;
  }
  get softFormats() {
    return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
  }
  get scannedFormats() {
    return '.pdf,.jpg,.jpeg,.png';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab === 'teachers' || tab === 'files') this.tab = tab;
    if (id) {
      this.portal.mine().subscribe({
        next: (list) => {
          this.schools = list;
          this.select(id);
        },
        error: () => (this.loading = false),
      });
      return;
    }
    this.portal.mine().subscribe({
      next: (list) => {
        this.schools = list;
        if (list.length === 0) {
          this.loading = false;
          return;
        }
        this.select(list[0].id);
      },
      error: () => (this.loading = false),
    });
  }

  select(id: string) {
    this.schoolId = id;
    this.teachersLoaded = false;
    this.files = null;
    this.teachers = [];
    this.editingProfile = false;
    this.loadOverview();
    if (this.tab === 'teachers') this.loadTeachers();
    if (this.tab === 'files') this.loadFiles();
  }

  setTab(t: Tab) {
    this.tab = t;
    if (t === 'teachers' && !this.teachersLoaded) this.loadTeachers();
    if (t === 'files' && !this.files) this.loadFiles();
  }

  private loadOverview() {
    this.loading = true;
    this.portal.overview(this.schoolId).subscribe({
      next: (o) => {
        this.overview = o;
        this.loading = false;
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'Could not load the school.';
        this.loading = false;
      },
    });
  }

  // ---- profile ----
  startEditProfile() {
    const s = this.overview!.school;
    this.profileForm.patchValue({
      name: s.name,
      schoolCode: s.schoolCode ?? '',
      address: s.address ?? '',
      contactNumber: s.contactNumber ?? '',
      email: s.email ?? '',
      schoolHeadName: s.schoolHeadName ?? '',
      schoolHeadContact: s.schoolHeadContact ?? '',
    });
    this.editingProfile = true;
    this.profileMsg = null;
  }

  saveProfile() {
    this.savingProfile = true;
    this.profileMsg = null;
    const v = this.profileForm.value;
    const dto: Partial<SchoolInfo> = {
      schoolCode: v.schoolCode ?? '',
      address: v.address ?? '',
      contactNumber: v.contactNumber ?? '',
      email: v.email ?? '',
      schoolHeadName: v.schoolHeadName ?? '',
      schoolHeadContact: v.schoolHeadContact ?? '',
      ...(this.isAdmin && v.name ? { name: v.name } : {}),
    };
    this.portal.updateSchool(this.schoolId, dto).subscribe({
      next: () => {
        this.savingProfile = false;
        this.editingProfile = false;
        this.loadOverview();
      },
      error: (e) => {
        this.profileMsg = e?.error?.message ?? 'Could not save.';
        this.savingProfile = false;
      },
    });
  }

  // ---- teachers ----
  loadTeachers() {
    this.portal.teachers(this.schoolId).subscribe((list) => {
      this.teachers = list.map((user) => ({
        user,
        editing: false,
        busy: false,
        error: null,
        edit: {
          firstName: user.firstName ?? '',
          middleName: user.middleName ?? '',
          lastName: user.lastName ?? '',
          contactNumber: user.contactNumber ?? '',
          designation: user.designation ?? '',
          depedEmail: user.depedEmail ?? '',
        },
      }));
      this.teachersLoaded = true;
    });
  }

  get pending() {
    return this.teachers.filter((t) => !t.user.role);
  }
  get members() {
    return this.teachers.filter((t) => !!t.user.role);
  }

  private afterTeacherAction(row: TeacherRow, req: import('rxjs').Observable<unknown>) {
    row.busy = true;
    row.error = null;
    req.subscribe({
      next: () => {
        this.loadTeachers();
        this.loadOverview();
      },
      error: (e) => {
        row.error = e?.error?.message ?? 'Action failed.';
        row.busy = false;
      },
    });
  }

  approve(row: TeacherRow) {
    this.afterTeacherAction(row, this.portal.approveTeacher(this.schoolId, row.user.id));
  }
  reject(row: TeacherRow) {
    if (!confirm(`Reject ${row.user.name}?`)) return;
    this.afterTeacherAction(row, this.portal.rejectTeacher(this.schoolId, row.user.id));
  }
  suspend(row: TeacherRow) {
    if (!confirm(`Suspend ${row.user.name}? They will not be able to sign in.`)) return;
    this.afterTeacherAction(row, this.portal.setTeacherStatus(this.schoolId, row.user.id, AccountStatus.SUSPENDED));
  }
  reactivate(row: TeacherRow) {
    this.afterTeacherAction(row, this.portal.setTeacherStatus(this.schoolId, row.user.id, AccountStatus.APPROVED));
  }
  saveTeacher(row: TeacherRow) {
    const e = row.edit;
    this.afterTeacherAction(
      row,
      this.portal.updateTeacher(this.schoolId, row.user.id, {
        firstName: e.firstName,
        middleName: e.middleName,
        lastName: e.lastName,
        contactNumber: e.contactNumber,
        designation: e.designation,
        ...(row.user.googleId ? {} : { depedEmail: e.depedEmail }),
      }),
    );
  }

  addTeacher() {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    this.adding = true;
    this.addError = null;
    const v = this.addForm.value;
    this.portal
      .addTeacher(this.schoolId, {
        depedEmail: v.depedEmail!,
        firstName: v.firstName!,
        middleName: v.middleName || undefined,
        lastName: v.lastName!,
        contactNumber: v.contactNumber || undefined,
        designation: v.designation || undefined,
      })
      .subscribe({
        next: () => {
          this.addForm.reset();
          this.showAdd = false;
          this.adding = false;
          this.loadTeachers();
          this.loadOverview();
        },
        error: (e) => {
          this.addError = e?.error?.message ?? 'Could not add the teacher.';
          this.adding = false;
        },
      });
  }

  // ---- files ----
  loadFiles() {
    this.portal.files(this.schoolId).subscribe((f) => (this.files = f));
  }

  async onPick(event: Event, typeId: string, kind: FileKind) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.fileError = null;
    this.uploadingKey = typeId + kind;
    try {
      const url = await this.uploads.uploadSchoolFile(this.schoolId, file, kind);
      await new Promise<void>((resolve, reject) =>
        this.portal
          .saveFile(this.schoolId, { documentTypeId: typeId, kind, fileName: file.name, fileUrl: url })
          .subscribe({ next: () => resolve(), error: reject }),
      );
      this.loadFiles();
    } catch (e: any) {
      this.fileError = e?.error?.message ?? e?.message ?? 'Upload failed.';
    } finally {
      this.uploadingKey = null;
    }
  }

  removeFile(fileId: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    this.portal.deleteFile(this.schoolId, fileId).subscribe({
      next: () => this.loadFiles(),
      error: (e) => (this.fileError = e?.error?.message ?? 'Could not remove the file.'),
    });
  }

  get uploadedCount() {
    return (this.files?.documents ?? []).filter((d) => d.soft || d.scanned).length;
  }
}
