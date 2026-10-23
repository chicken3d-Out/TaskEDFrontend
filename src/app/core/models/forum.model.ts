import { User } from './user.model';

export interface ForumQuestion {
  id: string;
  author: User;
  title: string;
  body: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForumReply {
  id: string;
  author: User;
  body: string;
  upvotes: number;
  downvotes: number;
  parentReply: { id: string } | null;
  createdAt: string;
}

// Client-side shape after threading flat replies into a tree - not sent
// by the backend as-is, built in ForumThreadComponent.
export interface ForumReplyNode extends ForumReply {
  children: ForumReplyNode[];
}
