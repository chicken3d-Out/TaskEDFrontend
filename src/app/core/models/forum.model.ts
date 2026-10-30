export type ForumStatus = 'pending' | 'approved' | 'rejected';

// "Mini profile" shown next to a question or reply.
export interface PublicProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  designation: string | null;
  school: string | null;
  district: string | null;
  area: string | null;
}

export interface ForumQuestion {
  id: string;
  author: PublicProfile;
  title: string;
  body: string;
  status: ForumStatus;
  rejectReason: string | null;
  upvotes: number;
  downvotes: number;
  myVote: number;
  replyCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForumReply {
  id: string;
  author: PublicProfile;
  body: string;
  upvotes: number;
  downvotes: number;
  myVote: number;
  parentReply: { id: string } | null;
  createdAt: string;
}

// Client-side shape after threading flat replies into a tree - not sent
// by the backend as-is, built in ForumThreadComponent.
export interface ForumReplyNode extends ForumReply {
  children: ForumReplyNode[];
}

export interface VoteResult {
  upvotes: number;
  downvotes: number;
  myVote: number;
}
