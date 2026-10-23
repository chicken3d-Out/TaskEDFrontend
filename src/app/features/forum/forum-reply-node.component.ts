import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForumReplyNode } from '../../core/models/forum.model';

@Component({
  selector: 'app-forum-reply-node',
  standalone: true,
  imports: [CommonModule, ForumReplyNodeComponent],
  template: `
    <div class="reply-node">
      <div class="reply-body">
        <div class="reply-head">
          <strong>{{ node.author.name }}</strong>
          <span class="time">{{ node.createdAt | date: 'medium' }}</span>
        </div>
        <p>{{ node.body }}</p>
        <div class="reply-actions">
          <button (click)="vote.emit({ id: node.id, value: 1 })">▲ {{ node.upvotes }}</button>
          <button (click)="vote.emit({ id: node.id, value: -1 })">▼ {{ node.downvotes }}</button>
          <button class="reply-btn" (click)="replyTo.emit(node.id)">Reply</button>
        </div>
      </div>
      @if (node.children.length > 0) {
        <div class="children">
          @for (child of node.children; track child.id) {
            <app-forum-reply-node
              [node]="child"
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
      .reply-node {
        margin-bottom: 0.6rem;
      }
      .reply-body {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0.7rem 0.9rem;
      }
      .reply-head {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        margin-bottom: 0.25rem;
      }
      .reply-head strong {
        font-size: 0.85rem;
      }
      .time {
        font-size: 0.72rem;
        color: #999;
      }
      p {
        margin: 0 0 0.4rem;
        font-size: 0.88rem;
        color: #333;
      }
      .reply-actions {
        display: flex;
        gap: 0.5rem;
      }
      .reply-actions button {
        border: 1px solid #d0d5dd;
        background: #fff;
        border-radius: 6px;
        padding: 0.2rem 0.6rem;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .reply-btn {
        margin-left: auto;
      }
      .children {
        margin-left: 1.5rem;
        margin-top: 0.5rem;
        padding-left: 0.75rem;
        border-left: 2px solid #e5e7eb;
      }
    `,
  ],
})
export class ForumReplyNodeComponent {
  @Input({ required: true }) node!: ForumReplyNode;
  @Output() vote = new EventEmitter<{ id: string; value: 1 | -1 }>();
  @Output() replyTo = new EventEmitter<string>();
}
