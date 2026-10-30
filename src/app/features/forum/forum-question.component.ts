import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models/user.model';
import { Router } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { ForumAuthorComponent } from './forum-author.component';
import { ForumService } from '../../core/services/forum.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ForumQuestion, ForumReply, ForumReplyNode } from '../../core/models/forum.model';
import { ForumReplyNodeComponent } from './forum-reply-node.component';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-forum-question',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ForumReplyNodeComponent, LoadingComponent, IconComponent, ForumAuthorComponent],
  templateUrl: './forum-question.component.html',
  styleUrl: './forum-question.component.scss',
})
export class ForumQuestionComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private forumService = inject(ForumService);
  private fb = inject(FormBuilder);
  private realtime = inject(RealtimeService);
  private auth = inject(AuthService);
  private router = inject(Router);
  error: string | null = null;

  get isAdmin() {
    return this.auth.currentUser()?.role === Role.ADMINISTRATOR;
  }
  get canInteract() {
    return this.auth.currentUser()?.role === Role.ADMIN_OFFICER && this.question?.status === 'approved';
  }

  question: ForumQuestion | null = null;
  replyTree: ForumReplyNode[] = [];
  loading = true;
  replyingTo: string | null = null; // null = top-level reply box

  private unsubscribeRealtime?: () => void;

  replyForm = this.fb.group({
    body: ['', Validators.required],
  });

  ngOnInit() {
    this.load(true);
    // Someone else replied/voted on this question - re-fetch quietly if
    // it's the one currently open (a missing questionId means a reply
    // vote whose question we couldn't resolve server-side - reload
    // regardless in that rare case, since we can't rule it out).
    this.unsubscribeRealtime = this.realtime.on<{ questionId?: string }>('forum:changed', (payload) => {
      if (!payload.questionId || payload.questionId === this.question?.id) this.load(false);
    });
  }

  ngOnDestroy() {
    this.unsubscribeRealtime?.();
  }

  private load(showLoading: boolean) {
    const id = this.route.snapshot.paramMap.get('id')!;
    if (showLoading) this.loading = true;
    this.forumService.getQuestion(id).subscribe({
      next: ({ question, replies }) => {
        this.question = question;
        this.replyTree = this.buildTree(replies);
        this.loading = false;
      },
      error: () => {
        this.question = null;
        this.loading = false;
      },
    });
  }

  private buildTree(flat: ForumReply[]): ForumReplyNode[] {
    const nodes = new Map<string, ForumReplyNode>();
    flat.forEach((r) => nodes.set(r.id, { ...r, children: [] }));

    const roots: ForumReplyNode[] = [];
    nodes.forEach((node) => {
      if (node.parentReply) {
        const parent = nodes.get(node.parentReply.id);
        if (parent) parent.children.push(node);
        else roots.push(node); // orphaned parent (shouldn't happen) - show at top level
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  voteQuestion(value: 1 | -1) {
    if (!this.question) return;
    this.forumService.voteQuestion(this.question.id, value).subscribe({
      next: (result) => Object.assign(this.question!, result),
      error: (e) => (this.error = e?.error?.message ?? 'Could not vote.'),
    });
  }

  onVoteReply(event: { id: string; value: 1 | -1 }) {
    this.forumService.voteReply(event.id, event.value).subscribe(() => this.load(false));
  }

  onReplyTo(replyId: string) {
    this.replyingTo = replyId;
    this.replyForm.reset({ body: '' });
  }

  cancelReply() {
    this.replyingTo = null;
  }

  submitReply() {
    if (this.replyForm.invalid || !this.question) return;
    this.forumService
      .createReply(this.question.id, this.replyForm.value.body!, this.replyingTo ?? undefined)
      .subscribe(() => {
        this.replyForm.reset({ body: '' });
        this.replyingTo = null;
        this.load(false);
      });
  }

  approve() {
    this.forumService.approve(this.question!.id).subscribe(() => this.load(false));
  }

  reject() {
    const reason = prompt('Reason for not approving (optional):') ?? undefined;
    this.forumService.reject(this.question!.id, reason).subscribe(() => this.load(false));
  }

  removeQuestion() {
    if (!confirm('Remove this question and all its replies?')) return;
    this.forumService.remove(this.question!.id).subscribe(() => this.router.navigate(['/forum']));
  }
}
