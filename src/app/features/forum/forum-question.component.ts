import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ForumService } from '../../core/services/forum.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ForumQuestion, ForumReply, ForumReplyNode } from '../../core/models/forum.model';
import { ForumReplyNodeComponent } from './forum-reply-node.component';
import { LoadingComponent } from '../../shared/loading/loading.component';

@Component({
  selector: 'app-forum-question',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ForumReplyNodeComponent, LoadingComponent],
  templateUrl: './forum-question.component.html',
  styleUrl: './forum-question.component.scss',
})
export class ForumQuestionComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private forumService = inject(ForumService);
  private fb = inject(FormBuilder);
  private realtime = inject(RealtimeService);

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
    this.forumService.getQuestion(id).subscribe(({ question, replies }) => {
      this.question = question;
      this.replyTree = this.buildTree(replies);
      this.loading = false;
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
    this.forumService.voteQuestion(this.question.id, value).subscribe((result) => {
      Object.assign(this.question!, result);
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
}
