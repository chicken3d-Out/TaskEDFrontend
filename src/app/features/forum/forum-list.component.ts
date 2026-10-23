import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ForumService } from '../../core/services/forum.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ForumQuestion } from '../../core/models/forum.model';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-forum-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingComponent],
  templateUrl: './forum-list.component.html',
  styleUrl: './forum-list.component.scss',
})
export class ForumListComponent implements OnInit, OnDestroy {
  private forumService = inject(ForumService);
  private fb = inject(FormBuilder);
  private realtime = inject(RealtimeService);

  questions: ForumQuestion[] = [];
  loading = true;
  sort: 'top' | 'recent' = 'recent';
  showForm = false;
  submitting = false;

  private unsubscribeRealtime?: () => void;

  form = this.fb.group({
    title: ['', Validators.required],
    body: ['', Validators.required],
  });

  ngOnInit() {
    this.load(true);
    // A new question anywhere affects this list - re-fetch quietly (no
    // loading flash) so it shows up without a manual refresh.
    this.unsubscribeRealtime = this.realtime.on('forum:changed', () => this.load(false));
  }

  ngOnDestroy() {
    this.unsubscribeRealtime?.();
  }

  setSort(sort: 'top' | 'recent') {
    this.sort = sort;
    this.load(true);
  }

  private load(showLoading: boolean) {
    if (showLoading) this.loading = true;
    this.forumService.listQuestions(this.sort).subscribe((questions) => {
      this.questions = questions;
      this.loading = false;
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.forumService.createQuestion(this.form.value.title!, this.form.value.body!).subscribe(() => {
      this.form.reset({ title: '', body: '' });
      this.showForm = false;
      this.submitting = false;
      this.load(false);
    });
  }
}
