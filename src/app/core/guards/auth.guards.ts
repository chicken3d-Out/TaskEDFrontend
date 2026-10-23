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
  if (user.role) return router.createUrlTree([auth.routeForCurrentState()]);
  return true;
};

export const approvedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  if (!user) return router.createUrlTree(['/login']);
  if (!user.role) return router.createUrlTree(['/register']);
  if (user.status !== AccountStatus.APPROVED) return router.createUrlTree(['/pending']);
  return true;
};

export const approverOnlyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  if (!user) return router.createUrlTree(['/login']);
  const canApprove = user.role === Role.ADMINISTRATOR || user.role === Role.ADMIN_OFFICER;
  return canApprove ? true : router.createUrlTree(['/tickets']);
};

export const teacherOnlyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  return user?.role === Role.TEACHER ? true : router.createUrlTree(['/tickets']);
};

// The Ask-a-Question forum is AO-only end to end per the spec decision.
export const aoOnlyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = await ensureUserLoaded(auth);
  return user?.role === Role.ADMIN_OFFICER ? true : router.createUrlTree(['/tickets']);
};
