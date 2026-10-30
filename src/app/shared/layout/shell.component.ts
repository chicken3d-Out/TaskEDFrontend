import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { PushNotificationsService } from '../../core/services/push-notifications.service';
import { Role, roleLabel } from '../../core/models/user.model';
import { IconComponent } from '../icon/icon.component';
import { AvatarComponent } from '../avatar/avatar.component';

const SIDEBAR_KEY = 'tasked_sidebar_open';
const DESKTOP_MIN = 900;

interface NavItem {
  label: string;
  icon: string;
  link: string;
  show: boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, IconComponent, AvatarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  Role = Role;
  roleLabel = roleLabel;
  showNotifications = false;
  showUserMenu = false;
  sidebarOpen = signal(true);

  constructor(
    public auth: AuthService,
    public notifications: NotificationsService,
    private pushNotifications: PushNotificationsService,
    private router: Router,
  ) {
    // On phones the panel is an overlay: close it after navigating.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.showNotifications = false;
        this.showUserMenu = false;
        if (!this.isDesktop()) this.sidebarOpen.set(false);
      });
  }

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user) {
      this.notifications.loadAndConnect(user.id);
      // No-ops on web; on the native build this registers the device for push.
      this.pushNotifications.register();
    }
    this.sidebarOpen.set(this.initialSidebarState());
  }

  private isDesktop(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN;
  }

  private initialSidebarState(): boolean {
    if (!this.isDesktop()) return false;
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  }

  toggleSidebar() {
    const next = !this.sidebarOpen();
    this.sidebarOpen.set(next);
    if (this.isDesktop()) {
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable: fine */
      }
    }
  }

  closeSidebarOnMobile() {
    if (!this.isDesktop()) this.sidebarOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.showNotifications = false;
    this.showUserMenu = false;
  }

  get role() {
    return this.auth.currentUser()?.role;
  }

  get navItems(): NavItem[] {
    const r = this.role;
    const hasTickets = r === Role.TEACHER || r === Role.ADMIN_OFFICER || r === Role.ADMINISTRATOR;
    return [
      { label: 'Dashboard', icon: 'dashboard', link: '/dashboard', show: true },
      { label: 'Tasks', icon: 'ticket', link: '/tasks', show: hasTickets },
      { label: 'New Task', icon: 'plus', link: '/tasks/new', show: r === Role.TEACHER },
      { label: r === Role.ADMIN_OFFICER ? 'My Schools' : 'My School', icon: 'school', link: '/school', show: r === Role.SCHOOL || r === Role.ADMIN_OFFICER },
      { label: 'Users', icon: 'users', link: '/users', show: r === Role.ADMINISTRATOR },
      { label: 'Schools', icon: 'school', link: '/schools', show: r === Role.ADMINISTRATOR },
      { label: 'School documents', icon: 'folder', link: '/document-types', show: r === Role.ADMINISTRATOR },
      { label: 'Calendar & Announcements', icon: 'calendar', link: '/calendar', show: true },
      { label: 'Forum', icon: 'forum', link: '/forum', show: r === Role.ADMIN_OFFICER || r === Role.ADMINISTRATOR },
      { label: 'Weather', icon: 'weather', link: '/weather', show: true },
      { label: 'Assistant', icon: 'bot', link: '/chat', show: true },
    ].filter((i) => i.show);
  }
}
