import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountStatus, User } from '../models/user.model';

const TOKEN_KEY = 'tasked_token';

export interface RegisterDto {
  firstName: string;
  middleName?: string;
  lastName: string;
  contactNumber: string;
  designation: string;
  schoolId?: string;
  district: string;
  area: string;
  avatarUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSig = signal<User | null>(null);
  private loadingSig = signal<boolean>(true);

  readonly currentUser = this.currentUserSig.asReadonly();
  readonly loading = this.loadingSig.asReadonly();

  readonly isAuthenticated = computed(() => !!this.currentUserSig());
  readonly isRegistered = computed(() => !!this.currentUserSig()?.profileComplete);
  readonly isApproved = computed(
    () => this.currentUserSig()?.status === AccountStatus.APPROVED,
  );

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // Just navigates the browser to the backend's OAuth entrypoint - the
  // backend + Google handle everything else and land back on /auth/callback.
  loginWithGoogle() {
    if (Capacitor.isNativePlatform()) {
      // Google blocks OAuth inside embedded WebViews, so use the system
      // browser (Chrome Custom Tab); the backend returns via a deep link
      // handled by handleDeepLink().
      Browser.open({ url: `${environment.apiUrl}/auth/google?platform=mobile` });
      return;
    }
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  // Called by AppComponent when the OS opens the app via
  // ph.gov.deped.leyte.tasked://auth?token=...
  async handleDeepLink(url: string) {
    let token: string | null = null;
    try {
      const u = new URL(url);
      if (u.hostname !== 'auth') return;
      const error = u.searchParams.get('error');
      if (error) {
        try {
          await Browser.close();
        } catch {
          /* not supported on every platform */
        }
        this.router.navigate(['/login'], { queryParams: { error } });
        return;
      }
      token = u.searchParams.get('token');
    } catch {
      return;
    }
    if (!token) return;
    try {
      await Browser.close();
    } catch {
      /* not supported on every platform */
    }
    this.setToken(token);
    await this.loadCurrentUser();
    this.router.navigateByUrl(this.routeForCurrentState());
  }

  // Administrator sign-in (username + password). Throws with the server's message.
  async adminLogin(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ token: string }>(`${environment.apiUrl}/auth/admin-login`, { username, password }),
    );
    this.setToken(res.token);
    await this.loadCurrentUser();
    this.router.navigateByUrl(this.routeForCurrentState());
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword }),
    );
  }

  async loadCurrentUser(): Promise<User | null> {
    if (!this.token) {
      this.currentUserSig.set(null);
      this.loadingSig.set(false);
      return null;
    }
    try {
      const user = await firstValueFrom(
        this.http.get<User>(`${environment.apiUrl}/users/me`),
      );
      this.currentUserSig.set(user);
      return user;
    } catch {
      this.clearToken();
      this.currentUserSig.set(null);
      return null;
    } finally {
      this.loadingSig.set(false);
    }
  }

  async register(dto: RegisterDto): Promise<User> {
    const user = await firstValueFrom(
      this.http.post<User>(`${environment.apiUrl}/users/register`, dto),
    );
    this.currentUserSig.set(user);
    return user;
  }

  logout() {
    this.clearToken();
    this.currentUserSig.set(null);
    this.router.navigate(['/login']);
  }

  // Central "where should this user land right now" decision, used after
  // login, after registration, and by route guards.
  routeForCurrentState(): string {
    const user = this.currentUserSig();
    if (!user) return '/login';
    if (user.status === AccountStatus.APPROVED) return '/dashboard';
    if (!user.profileComplete) return '/register';
    return '/pending';
  }
}
