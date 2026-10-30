import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TicketsService } from '../../core/services/tickets.service';

@Component({
  selector: 'app-ticket-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ticket-create.component.html',
  styleUrl: './ticket-create.component.scss',
})
export class TicketCreateComponent {
  private fb = inject(FormBuilder);
  private ticketsService = inject(TicketsService);
  private router = inject(Router);

  submitting = false;
  error: string | null = null;

  form = this.fb.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.error = null;
    this.ticketsService
      .create({
        title: this.form.value.title!,
        description: this.form.value.description!,
      })
      .subscribe({
        next: (ticket) => this.router.navigate(['/tasks', ticket.id]),
        error: (e) => {
          this.error = e?.error?.message ?? 'Could not create the task.';
          this.submitting = false;
        },
      });
  }
}
