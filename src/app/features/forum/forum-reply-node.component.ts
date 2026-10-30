import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForumReplyNode } from '../../core/models/forum.model';
import { IconComponent } from '../../shared/icon/icon.component';
import { ForumAuthorComponent } from './forum-author.component';

@Component({
  selector: 'app-forum-reply-node',
  standalone: true,
  imports: [CommonModule, ForumReplyNodeComponent, IconComponent, ForumAuthorComponent],
  template: `
    <div class="reply-node">
      <div class="reply-body">
        <div class="reply-head">
          <app-forum-author [profile]="node.author" [size]="32" />
          <span class="time">{{ node.createdAt | date: 'medium' }}</span>
        </div>
        <p>{{ node.body }}</p>
        <div class="reply-actions">
          <button [class.on-up]="node.myVote === 1" [disabled]="!canInteract" (click)="vote.emit({ id: node.id, value: 1 })">
            <app-icon name="thumbs-up" [size]="14" /> {{ node.upvotes }}
          </button>
          <button [class.on-down]="node.myVote === -1" [disabled]="!canInteract" (click)="vote.emit({ id: node.id, value: -1 })">
            <app-icon name="thumbs-down" [size]="14" /> {{ node.downvotes }}
          </button>
          @if (canInteract) {
            <button class="reply-btn" (click)="replyTo.emit(node.id)">Reply</button>
          }
        </div>
      </div>
      @if (node.children.length > 0) {
        <div class="children">
          @for (child of node.children; track child.id) {
            <app-forum-reply-node
              [node]="child"
              [canInteract]="canInteract"
              (vote)="vote.emit($event)"
              (replyTo)="replyTo.emit($event)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .reply-node { margin-bottom: 0.6rem; }
      .reply-body { background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 0.7rem 0.9rem; }
      .reply-head { display: flex; gap: 0.6rem; align-items: center; justify-content: space-between; margin-bottom: 0.3rem; flex-wrap: wrap; }
      .time { font-size: 0.72rem; color: #999; }
      p { margin: 0 0 0.5rem; font-size: 0.9rem; color: #333; white-space: pre-wrap; }
      .reply-actions { display: flex; gap: 0.5rem; }
      .reply-actions button { border: 1px solid var(--border); background: #fff; border-radius: 8px; padding: 0.2rem 0.6rem; font-size: 0.78rem; cursor: pointer; display: inline-flex; gap: 0.3rem; align-items: center; }
      .reply-actions button:disabled { cursor: default; opacity: 0.8; }
      .on-up { background: var(--primary-soft) !important; border-color: var(--primary) !important; color: var(--primary-strong); }
      .on-down { background: #fee2e2 !important; border-color: var(--danger) !important; color: #991b1b; }
      .reply-btn { margin-left: auto; }
      .children { margin-left: 1.5rem; margin-top: 0.5rem; padding-left: 0.75rem; border-left: 2px solid var(--border); }
    `,
  ],
})
export class ForumReplyNodeComponent {
  @Input({ required: true }) node!: ForumReplyNode;
  @Input() canInteract = true;
  @Output() vote = new EventEmitter<{ id: string; value: 1 | -1 }>();
  @Output() replyTo = new EventEmitter<string>();
}
