import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TicketsService } from '../../core/services/tickets.service';
import { AuthService } from '../../core/services/auth.service';
import { UploadService } from '../../core/services/upload.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { Ticket, TicketStatus, TICKET_STATUS_LABELS, VALID_NEXT_STATUSES } from '../../core/models/ticket.model';
import { Role } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingComponent],
  templateUrl: './ticket-detail.component.html',
  styleUrl: './ticket-detail.component.scss',
})
export class TicketDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private ticketsService = inject(TicketsService);
  private uploadService = inject(UploadService);
  private realtime = inject(RealtimeService);
  public auth = inject(AuthService);

  ticket: Ticket | null = null;
  loading = true;
  posting = false;
  uploadingImage = false;
  uploadingAttachment = false;
  updateImageFile: File | null = null;
  error: string | null = null;
  statusLabels = TICKET_STATUS_LABELS;

  private unsubscribeRealtime?: () => void;

  updateForm = this.fb.group({
    message: ['', Validators.required],
    attachmentRequest: [false],
    newStatus: [''],
  });

  ngOnInit() {
    this.load();
    // Someone else (the other party on this ticket, typically) posted an
    // update/attachment/status change - quietly re-fetch this ticket if
    // it's the one being viewed, so it appears without a manual refresh.
    this.unsubscribeRealtime = this.realtime.on<{ ticketId: string }>('tickets:changed', (payload) => {
      if (payload.ticketId === this.ticket?.id) this.load();
    });
  }

  ngOnDestroy() {
    this.unsubscribeRealtime?.();
  }

  private load() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.ticketsService.findOne(id).subscribe((ticket) => {
      this.ticket = ticket;
      this.loading = false;
    });
  }

  get isAssignedAo(): boolean {
    const user = this.auth.currentUser();
    return !!user && user.role === Role.ADMIN_OFFICER && user.id === this.ticket?.assignedAo.id;
  }

  get isOwner(): boolean {
    const user = this.auth.currentUser();
    return !!user && user.role === Role.TEACHER && user.id === this.ticket?.requester.id;
  }

  get canAct(): boolean {
    return this.isAssignedAo || this.isOwner;
  }

  get availableNextStatuses(): TicketStatus[] {
    if (!this.ticket) return [];
    return VALID_NEXT_STATUSES[this.ticket.status] ?? [];
  }

  onUpdateImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.updateImageFile = input.files?.[0] ?? null;
  }

  async postUpdate() {
    if (this.updateForm.invalid || !this.ticket) return;
    this.posting = true;
    this.error = null;
    const raw = this.updateForm.value;

    try {
      let imageUrl: string | undefined;
      if (this.updateImageFile) {
        this.uploadingImage = true;
        imageUrl = await this.uploadService.uploadFile(this.updateImageFile);
        this.uploadingImage = false;
      }

      this.ticketsService
        .postUpdate(this.ticket.id, {
          message: raw.message!,
          imageUrl,
          attachmentRequest: this.isAssignedAo ? !!raw.attachmentRequest : undefined,
          newStatus: this.isAssignedAo && raw.newStatus ? (raw.newStatus as TicketStatus) : undefined,
        })
        .subscribe({
          next: () => {
            this.updateForm.reset({ message: '', attachmentRequest: false, newStatus: '' });
            this.updateImageFile = null;
            this.posting = false;
            this.load();
          },
          error: (e) => {
            this.error = e?.error?.message ?? 'Could not post the update.';
            this.posting = false;
          },
        });
    } catch (e: any) {
      this.uploadingImage = false;
      this.posting = false;
      this.error = e?.message ?? 'Could not upload the image. Please try again.';
    }
  }

  async onAttachmentSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.ticket) return;

    this.uploadingAttachment = true;
    this.error = null;
    try {
      const fileUrl = await this.uploadService.uploadFile(file);
      this.ticketsService.addAttachment(this.ticket.id, fileUrl, file.name).subscribe({
        next: () => {
          this.uploadingAttachment = false;
          input.value = '';
          this.load();
        },
        error: (e) => {
          this.error = e?.error?.message ?? 'Could not attach the file.';
          this.uploadingAttachment = false;
        },
      });
    } catch (e: any) {
      this.uploadingAttachment = false;
      this.error = e?.message ?? 'Upload failed. Please try again.';
    }
  }
}
