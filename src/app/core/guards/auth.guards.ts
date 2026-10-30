import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AccountStatus, Role } from '../models/user.model';

// Ensures a user is loaded (waits on the initial /users/me fetch triggered
// in app.component) and redirects to wherever they actually belong if the
// requested route doesn't match their current state.
async function ensureUserLoaded(auth: AuthService) {
  if (!auth.loading()) return auth.currentUser();
  // app.component kicks off loadCurrentUser() on bootstrap; poll briefly
  // until it settles rather than duplicating that call here.
  await new Promise<void>((resolve) => {
    const check = () => (auth.loading() ? setTimeout(check, 25) : resolve());
    check();
  });
  return auth.currentUser();
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  if (!user) return router.createUrlTree(['/login']);
  return true;
};

export const needsRegistrationGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  if (!user) return router.createUrlTree(['/login']);
  if (user.status === AccountStatus.APPROVED || user.profileComplete) {
    return router.createUrlTree([auth.routeForCurrentState()]);
  }
  return true;
};

export const approvedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  if (!user) return router.createUrlTree(['/login']);
  if (user.status === AccountStatus.APPROVED) return true;
  return router.createUrlTree([auth.routeForCurrentState()]);
};

export const adminOnlyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  if (!user) return router.createUrlTree(['/login']);
  return user.role === Role.ADMINISTRATOR ? true : router.createUrlTree(['/dashboard']);
};

export const teacherOnlyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  return user?.role === Role.TEACHER ? true : router.createUrlTree(['/dashboard']);
};

// The Ask-a-Question forum: AOs use it, Administrators moderate it.
export const forumGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  const ok = user?.role === Role.ADMIN_OFFICER || user?.role === Role.ADMINISTRATOR;
  return ok ? true : router.createUrlTree(['/dashboard']);
};

// "My school" page: School accounts and AOs (Administrators reach schools by id).
export const schoolStaffGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  const ok = user?.role === Role.SCHOOL || user?.role === Role.ADMIN_OFFICER || user?.role === Role.ADMINISTRATOR;
  return ok ? true : router.createUrlTree(['/dashboard']);
};
