import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { PushNotificationsService } from '../../core/services/push-notifications.service';
import { Role } from '../../core/models/user.model';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  Role = Role;
  showNotifications = false;

  constructor(
    public auth: AuthService,
    public notifications: NotificationsService,
    private pushNotifications: PushNotificationsService,
  ) {}

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user) {
      this.notifications.loadAndConnect(user.id);
      // No-ops on web; on the native Ionic/Capacitor build this asks for
      // permission and registers the device for FCM push.
      this.pushNotifications.register();
    }
  }

  get canApprove() {
    const role = this.auth.currentUser()?.role;
    return role === Role.ADMINISTRATOR || role === Role.ADMIN_OFFICER;
  }

  get isTeacher() {
    return this.auth.currentUser()?.role === Role.TEACHER;
  }

  get isAo() {
    return this.auth.currentUser()?.role === Role.ADMIN_OFFICER;
  }
}
