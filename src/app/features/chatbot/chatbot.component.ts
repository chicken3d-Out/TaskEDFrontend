import { AfterViewInit, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChatbotApiService, ChatMessage } from '../../core/services/chatbot-api.service';
import { AuthService } from '../../core/services/auth.service';
import { LoadingComponent } from '../../shared/loading/loading.component';

interface Chat {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const GREETING =
  "Hi! I'm the TaskEd AI Assistant. Ask me how something in TaskEd works, or ask about your own tasks.";
const MAX_CHATS = 30;
const MAX_MESSAGES = 60;

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingComponent],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss',
})
export class ChatbotComponent implements AfterViewInit {
  private chatbotApi = inject(ChatbotApiService);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  @ViewChild('scrollAnchor') scrollAnchor?: ElementRef<HTMLDivElement>;

  // Chats are kept only on this device (per signed-in account), never on the server.
  // They stay when the person signs out and back in; another account on the same
  // device has its own separate list.
  private storageKey = `tasked_chats_${this.auth.currentUser()?.id ?? 'guest'}`;
  chats: Chat[] = this.restore();
  current: Chat = this.chats[0];
  showList = false;

  sending = false;
  error: string | null = null;

  form = this.fb.group({ message: ['', Validators.required] });

  get messages(): ChatMessage[] {
    return this.current.messages;
  }

  private blank(): Chat {
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: 'New chat', updatedAt: Date.now(), messages: [{ role: 'assistant', content: GREETING }] };
  }

  private restore(): Chat[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length) {
        const ok = list
          .filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages))
          .map((c) => ({
            id: c.id,
            title: String(c.title ?? 'Chat').slice(0, 80),
            updatedAt: Number(c.updatedAt) || 0,
            messages: c.messages
              .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
              .map((m: any) => ({ role: m.role, content: m.content })),
          }))
          .filter((c) => c.messages.length);
        if (ok.length) return ok;
      }
      // chat saved by the previous version (a single conversation)
      const old = localStorage.getItem(`tasked_chat_${this.auth.currentUser()?.id ?? 'guest'}`);
      const msgs = old ? JSON.parse(old) : null;
      if (Array.isArray(msgs) && msgs.length > 1) {
        const first = msgs.find((m: any) => m.role === 'user');
        return [{ id: 'old', title: String(first?.content ?? 'Earlier chat').slice(0, 60), updatedAt: Date.now(), messages: msgs }];
      }
    } catch {
      /* storage unavailable: start fresh */
    }
    return [this.blank()];
  }

  private save() {
    try {
      const keep = this.chats
        .filter((c) => c.messages.length > 1)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CHATS)
        .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MESSAGES) }));
      localStorage.setItem(this.storageKey, JSON.stringify(keep));
    } catch {
      /* storage full or blocked: the chat still works, it just will not be remembered */
    }
  }

  // newest first, empty "New chat" drafts hidden
  get history(): Chat[] {
    return this.chats.filter((c) => c.messages.length > 1).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  newChat() {
    // reuse an empty draft instead of piling them up
    const empty = this.chats.find((c) => c.messages.length <= 1);
    this.current = empty ?? this.blank();
    if (!empty) this.chats.unshift(this.current);
    this.error = null;
    this.showList = false;
    this.scrollToBottom();
  }

  open(c: Chat) {
    this.current = c;
    this.error = null;
    this.showList = false;
    this.scrollToBottom();
  }

  remove(c: Chat, ev: Event) {
    ev.stopPropagation();
    if (!confirm(`Delete this chat?\n"${c.title}"`)) return;
    this.chats = this.chats.filter((x) => x !== c);
    if (!this.chats.length) this.chats = [this.blank()];
    if (this.current === c) this.current = this.chats.find((x) => x.messages.length > 1) ?? this.chats[0];
    this.save();
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  private scrollToBottom() {
    setTimeout(() => this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  send() {
    if (this.form.invalid || this.sending) return;
    const text = this.form.value.message!.trim();
    if (!text) return;

    const chat = this.current; // replies go to the chat the question was asked in
    this.error = null;
    chat.messages.push({ role: 'user', content: text });
    if (chat.title === 'New chat') chat.title = text.slice(0, 60);
    chat.updatedAt = Date.now();
    if (!this.chats.includes(chat)) this.chats.unshift(chat);
    this.save();
    this.form.reset({ message: '' });
    this.sending = true;
    this.scrollToBottom();

    // Earlier real turns only (not the opening greeting) as context.
    const history = chat.messages
      .slice(1, -1)
      .map(({ role, content }) => ({ role, content }));

    this.chatbotApi.sendMessage(text, history).subscribe({
      next: ({ reply }) => {
        chat.messages.push({ role: 'assistant', content: reply });
        chat.updatedAt = Date.now();
        this.save();
        this.sending = false;
        this.scrollToBottom();
      },
      error: (e) => {
        this.error = e?.error?.message ?? 'The assistant is unavailable right now.';
        this.sending = false;
      },
    });
  }
}
