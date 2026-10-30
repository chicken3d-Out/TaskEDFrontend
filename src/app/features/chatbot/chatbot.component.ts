import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChatbotApiService, ChatMessage } from '../../core/services/chatbot-api.service';
import { LoadingComponent } from '../../shared/loading/loading.component';

interface DisplayMessage extends ChatMessage {
  pending?: boolean;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingComponent],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.scss',
})
export class ChatbotComponent {
  private chatbotApi = inject(ChatbotApiService);
  private fb = inject(FormBuilder);

  @ViewChild('scrollAnchor') scrollAnchor?: ElementRef<HTMLDivElement>;

  messages: DisplayMessage[] = [
    {
      role: 'assistant',
      content:
        "Hi! I'm the TaskEd Assistant. Ask me how something in TaskEd works, or ask about your own tasks.",
    },
  ];
  sending = false;
  error: string | null = null;

  form = this.fb.group({
    message: ['', Validators.required],
  });

  private scrollToBottom() {
    setTimeout(() => {
      this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  send() {
    if (this.form.invalid || this.sending) return;
    const text = this.form.value.message!.trim();
    if (!text) return;

    this.error = null;
    this.messages.push({ role: 'user', content: text });
    this.form.reset({ message: '' });
    this.sending = true;
    this.scrollToBottom();

    // Only ever send prior real turns (not the fixed opening greeting) as
    // history, so the backend's context stays focused.
    const history = this.messages.slice(1, -1).map(({ role, content }) => ({ role, content }));

    this.chatbotApi.sendMessage(text, history).subscribe({
      next: ({ reply }) => {
        this.messages.push({ role: 'assistant', content: reply });
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
