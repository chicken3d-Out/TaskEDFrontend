import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { AuthCallbackComponent } from './features/auth/auth-callback.component';
import { RegisterComponent } from './features/auth/register.component';
import { PendingApprovalComponent } from './features/auth/pending-approval.component';
import { ShellComponent } from './shared/layout/shell.component';
import { TicketListComponent } from './features/tickets/ticket-list.component';
import { TicketCreateComponent } from './features/tickets/ticket-create.component';
import { TicketDetailComponent } from './features/tickets/ticket-detail.component';
import { ApprovalsComponent } from './features/approvals/approvals.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { ForumListComponent } from './features/forum/forum-list.component';
import { ForumQuestionComponent } from './features/forum/forum-question.component';
import { WeatherComponent } from './features/weather/weather.component';
import { ProfileComponent } from './features/profile/profile.component';
import { ChatbotComponent } from './features/chatbot/chatbot.component';
import {
  approvedGuard,
  approverOnlyGuard,
  needsRegistrationGuard,
  teacherOnlyGuard,
  aoOnlyGuard,
} from './core/guards/auth.guards';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'register', component: RegisterComponent, canActivate: [needsRegistrationGuard] },
  { path: 'pending', component: PendingApprovalComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [approvedGuard],
    children: [
      { path: 'tickets', component: TicketListComponent },
      { path: 'tickets/new', component: TicketCreateComponent, canActivate: [teacherOnlyGuard] },
      { path: 'tickets/:id', component: TicketDetailComponent },
      { path: 'approvals', component: ApprovalsComponent, canActivate: [approverOnlyGuard] },
      { path: 'calendar', component: CalendarComponent, data: { mode: 'calendar' } },
      {
        path: 'announcements',
        component: CalendarComponent,
        data: { mode: 'announcements' },
      },
      { path: 'forum', component: ForumListComponent, canActivate: [aoOnlyGuard] },
      { path: 'forum/:id', component: ForumQuestionComponent, canActivate: [aoOnlyGuard] },
      { path: 'weather', component: WeatherComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'chat', component: ChatbotComponent },
      { path: '', redirectTo: 'tickets', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'tickets' },
];
