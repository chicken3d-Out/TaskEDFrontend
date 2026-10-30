import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { AuthCallbackComponent } from './features/auth/auth-callback.component';
import { RegisterComponent } from './features/auth/register.component';
import { PendingApprovalComponent } from './features/auth/pending-approval.component';
import { ShellComponent } from './shared/layout/shell.component';
import { TicketListComponent } from './features/tickets/ticket-list.component';
import { TicketCreateComponent } from './features/tickets/ticket-create.component';
import { TicketDetailComponent } from './features/tickets/ticket-detail.component';
import { UsersComponent } from './features/users/users.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CalendarComponent } from './features/calendar/calendar.component';
import { ForumListComponent } from './features/forum/forum-list.component';
import { ForumQuestionComponent } from './features/forum/forum-question.component';
import { WeatherComponent } from './features/weather/weather.component';
import { ProfileComponent } from './features/profile/profile.component';
import { ChatbotComponent } from './features/chatbot/chatbot.component';
import { SchoolComponent } from './features/school/school.component';
import { SchoolsAdminComponent } from './features/schools-admin/schools-admin.component';
import { DocumentTypesComponent } from './features/document-types/document-types.component';
import {
  approvedGuard,
  adminOnlyGuard,
  needsRegistrationGuard,
  teacherOnlyGuard,
  forumGuard,
  schoolStaffGuard,
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
      { path: 'dashboard', component: DashboardComponent },
      { path: 'tasks', component: TicketListComponent },
      { path: 'tasks/new', component: TicketCreateComponent, canActivate: [teacherOnlyGuard] },
      { path: 'tasks/:id', component: TicketDetailComponent },
      // old links
      { path: 'tickets', redirectTo: 'tasks', pathMatch: 'full' },
      { path: 'tickets/new', redirectTo: 'tasks/new', pathMatch: 'full' },
      { path: 'tickets/:id', redirectTo: 'tasks/:id' },
      { path: 'users', component: UsersComponent, canActivate: [adminOnlyGuard] },
      { path: 'approvals', redirectTo: 'users', pathMatch: 'full' },
      { path: 'calendar', component: CalendarComponent },
      { path: 'announcements', redirectTo: 'calendar', pathMatch: 'full' },
      { path: 'forum', component: ForumListComponent, canActivate: [forumGuard] },
      { path: 'forum/:id', component: ForumQuestionComponent, canActivate: [forumGuard] },
      { path: 'school', component: SchoolComponent, canActivate: [schoolStaffGuard] },
      { path: 'schools', component: SchoolsAdminComponent, canActivate: [adminOnlyGuard] },
      { path: 'schools/:id', component: SchoolComponent, canActivate: [adminOnlyGuard] },
      { path: 'document-types', component: DocumentTypesComponent, canActivate: [adminOnlyGuard] },
      { path: 'weather', component: WeatherComponent },
      { path: 'profile', component: ProfileComponent },
      { path: 'chat', component: ChatbotComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
