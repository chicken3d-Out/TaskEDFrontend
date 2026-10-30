import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ForumQuestion, ForumReply, ForumStatus, VoteResult } from '../models/forum.model';

@Injectable({ providedIn: 'root' })
export class ForumService {
  private base = `${environment.apiUrl}/forum`;

  constructor(private http: HttpClient) {}

  listQuestions(sort: 'top' | 'recent' = 'recent', status?: ForumStatus): Observable<ForumQuestion[]> {
    const params: Record<string, string> = { sort };
    if (status) params['status'] = status;
    return this.http.get<ForumQuestion[]>(`${this.base}/questions`, { params });
  }

  createQuestion(title: string, body: string): Observable<ForumQuestion> {
    return this.http.post<ForumQuestion>(`${this.base}/questions`, { title, body });
  }

  getQuestion(id: string): Observable<{ question: ForumQuestion; replies: ForumReply[] }> {
    return this.http.get<{ question: ForumQuestion; replies: ForumReply[] }>(`${this.base}/questions/${id}`);
  }

  createReply(questionId: string, body: string, parentReplyId?: string): Observable<ForumReply> {
    return this.http.post<ForumReply>(`${this.base}/questions/${questionId}/replies`, { body, parentReplyId });
  }

  voteQuestion(id: string, value: 1 | -1): Observable<VoteResult> {
    return this.http.post<VoteResult>(`${this.base}/questions/${id}/vote`, { value });
  }

  voteReply(id: string, value: 1 | -1): Observable<VoteResult> {
    return this.http.post<VoteResult>(`${this.base}/replies/${id}/vote`, { value });
  }

  // Administrator moderation
  approve(id: string) {
    return this.http.post<ForumQuestion>(`${this.base}/questions/${id}/approve`, {});
  }
  reject(id: string, reason?: string) {
    return this.http.post<ForumQuestion>(`${this.base}/questions/${id}/reject`, { reason });
  }
  remove(id: string) {
    return this.http.delete(`${this.base}/questions/${id}`);
  }
}
