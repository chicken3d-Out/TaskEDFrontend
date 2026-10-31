import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ForumService } from '../../core/services/forum.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { AuthService } from '../../core/services/auth.service';
import { ForumQuestion, ForumReply } from '../../core/models/forum.model';
import { Role } from '../../core/models/user.model';
import { LoadingComponent } from '../../shared/loading/loading.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { ForumAuthorComponent } from './forum-author.component';

@Component({
  selector: 'app-forum-list',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ReactiveFormsModule, RouterLink, LoadingComponent, IconComponent, ForumAuthorComponent],
  templateUrl: './forum-list.component.html',
  styleUrl: './forum-list.component.scss',
})
export class ForumListComponent implements OnInit, OnDestroy {
  private forumService = inject(ForumService);
  private fb = inject(FormBuilder);
  private realtime = inject(RealtimeService);
  private auth = inject(AuthService);

  questions: ForumQuestion[] = [];
  loading = true;
  sort: 'top' | 'recent' = 'recent';
  view: 'pending' | 'all' = 'all';
  showForm = false;
  submitting = false;
  notice: string | null = null;
  rejectingId: string | null = null;
  rejectReason = '';
  error: string | null = null;

  // Inline discussion: vote and comment straight from the list.
  openId: string | null = null;
  openReplies: ForumReply[] = [];
  repliesLoading = false;
  replyText = '';
  replying = false;

  private unsubscribeRealtime?: () => void;

  form = this.fb.group({
    title: ['', Validators.required],
    body: ['', Validators.required],
  });

  get isAdmin() {
    return this.auth.currentUser()?.role === Role.ADMINISTRATOR;
  }

  get canInteract() {
    return this.auth.currentUser()?.role === Role.ADMIN_OFFICER;
  }

  vote(q: ForumQuestion, value: 1 | -1) {
    if (!this.canInteract || q.status !== 'approved') return;
    this.forumService.voteQuestion(q.id, value).subscribe({
      next: (r) => Object.assign(q, r),
      error: (e) => (this.error = e?.error?.message ?? 'Could not vote.'),
    });
  }

  voteReply(r: ForumReply, value: 1 | -1) {
    this.forumService.voteReply(r.id, value).subscribe({
      next: (res) => Object.assign(r, res),
      error: (e) => (this.error = e?.error?.message ?? 'Could not vote.'),
    });
  }

  toggleComments(q: ForumQuestion) {
    if (this.openId === q.id) {
      this.openId = null;
      return;
    }
    this.openId = q.id;
    this.replyText = '';
    this.loadReplies(q.id, true);
  }

  private loadReplies(id: string, showLoading: boolean) {
    if (showLoading) this.repliesLoading = true;
    this.forumService.getQuestion(id).subscribe({
      next: ({ replies }) => {
        this.openReplies = replies;
        this.repliesLoading = false;
      },
      error: () => (this.repliesLoading = false),
    });
  }

  sendReply(q: ForumQuestion) {
    if (!this.replyText.trim()) return;
    this.replying = true;
    this.forumService.createReply(q.id, this.replyText.trim()).subscribe({
      next: () => {
        this.replyText = '';
        this.replying = false;
        this.loadReplies(q.id, false);
        this.load(false);
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'Could not post your reply.';
        this.replying = false;
      },
    });
  }

  get pendingCount() {
    return this.questions.filter((q) => q.status === 'pending').length;
  }

  get visible() {
    if (this.isAdmin && this.view === 'pending') return this.questions.filter((q) => q.status === 'pending');
    return this.questions;
  }

  ngOnInit() {
    if (this.isAdmin) this.view = 'pending';
    this.load(true);
    // Any forum change re-fetches quietly so it shows up without a refresh.
    this.unsubscribeRealtime = this.realtime.on('forum:changed', () => {
      this.load(false);
      if (this.openId) this.loadReplies(this.openId, false);
    });
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
    this.forumService.listQuestions(this.sort).subscribe({
      next: (questions) => {
        this.questions = questions;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.forumService.createQuestion(this.form.value.title!, this.form.value.body!).subscribe({
      next: () => {
        this.form.reset({ title: '', body: '' });
        this.showForm = false;
        this.submitting = false;
        this.notice = 'Your question was sent. It will appear for everyone once an Administrator approves it.';
        this.load(false);
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'Could not post your question.';
        this.submitting = false;
      },
    });
  }

  approve(q: ForumQuestion) {
    this.forumService.approve(q.id).subscribe({ next: () => this.load(false), error: (e) => (this.error = e?.error?.message ?? 'Failed.') });
  }

  startReject(q: ForumQuestion) {
    this.rejectingId = q.id;
    this.rejectReason = '';
  }

  confirmReject(q: ForumQuestion) {
    this.forumService.reject(q.id, this.rejectReason).subscribe({
      next: () => {
        this.rejectingId = null;
        this.load(false);
      },
      error: (e) => (this.error = e?.error?.message ?? 'Failed.'),
    });
  }

  remove(q: ForumQuestion) {
    if (!confirm(`Remove "${q.title}" and all its replies?`)) return;
    this.forumService.remove(q.id).subscribe(() => this.load(false));
  }
}
