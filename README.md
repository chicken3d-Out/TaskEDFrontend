# TaskEd Frontend

Angular 18 (standalone components, signals) web app for TaskEd's core
flow: Google sign-in, registration, approval waiting screen, and the
ticketing UI (list, create, detail with the update/status/attachment
thread), plus an approvals queue for AOs/Administrators.

Built so the same components/services can be reused by an Ionic wrapper
later, per the spec's phase-2 plan - nothing here relies on
browser-only APIs yet, and state lives in Angular services (not the
window/localStorage directly, aside from the JWT itself).

## Setup

```bash
npm install
npm start   # ng serve, http://localhost:4200
```

Point `src/environments/environment.ts` (`apiUrl`) at wherever the
backend is running - defaults to `http://localhost:3000`.

## Mobile app (Ionic/Capacitor)

The `android/` and `ios/` folders are native project wrappers around
this same Angular app - see `MOBILE.md` for how to run, test, and
build them (including Firebase push notification setup). Nothing in
`src/` is mobile-specific except `core/services/location.service.ts`,
which uses `@capacitor/geolocation` (works the same in-browser too).

## How auth flows through the app

1. `LoginComponent` sends the browser to `${apiUrl}/auth/google`.
2. Google + the backend do their thing, then redirect to
   `/auth/callback?token=...` on this app.
3. `AuthCallbackComponent` stores the token, loads `/users/me`, and
   routes to `/register`, `/pending`, or `/tickets` depending on where
   the account actually is in the pipeline.
4. `AuthService.routeForCurrentState()` is the single source of truth
   for that decision - guards in `core/guards/auth.guards.ts` all defer
   to it.

## Structure

- `core/` - services (auth, tickets, users, schools, notifications),
  guards, interceptors, and shared models mirroring the backend entities.
- `features/auth/` - login, OAuth callback, registration form, pending
  screen.
- `features/tickets/` - list, create, detail (the update thread, AO
  status-change/attachment-request controls, teacher attachment upload).
- `features/approvals/` - the pending-approvals queue for AOs/Admins.
- `features/calendar/` - shared calendar + Announcements (same
  component, `mode` input picks the view); create/delete gated to
  Administrator and Admin Office accounts client-side (backend is
  the real enforcement).
- `features/forum/` - AO-only Ask-a-Question board: list (sort by
  top/recent), detail with a recursive `ForumReplyNodeComponent` for
  threaded replies (built client-side from the backend's flat list +
  `parentReply`), and toggle-able up/down voting.
- `features/weather/` - requests location permission, shows an
  embedded OpenStreetMap view (no API key needed), and a 2-hour
  rain-chance forecast for the next 12 hours.
- `features/profile/` - edit name/designation/district, and (for
  Teachers) home school. Refreshes the cached `AuthService` user on
  save so the nav/guards see the change immediately.
- `features/chatbot/` - general-purpose Q&A plus questions about
  TaskEd itself and the current user's own tickets (the backend
  grounds every request with a system prompt + a live ticket summary,
  so this component is just chat UI - no client-side context building).
- `core/services/upload.service.ts` - two-step upload used by the
  ticket attachment/image flows: ask the backend to sign a Cloudinary
  URL, then PUT the file straight there (never through our API).
- `shared/loading/` - `<app-loading>`, the branded pulsing-seal
  loading indicator used everywhere a view fetches data instead of a
  generic spinner, per the spec's Branding section.
- `shared/layout/` - the app shell (nav bar, notification bell).

## Real seal asset

`public/sdo-leyte-seal.png` is the actual Schools Division of Leyte
seal you provided - used in the login screen, the top nav, and the
branded loading indicator (`login.component.ts`,
`shell.component.html`, `loading.component.ts`).

## Geolocation and the Ionic migration

`core/services/location.service.ts` is the ONLY file that touches
`navigator.geolocation` directly - everything else calls through it.
When this app moves into the Ionic/Capacitor wrapper, swap the body
of `getCurrentPosition()` for `@capacitor/geolocation`'s call (same
return shape) and nothing else in the app needs to change.

## Known gaps (matches the backend README)

- Attachments and update images upload for real now (straight to
  Cloudinary via `UploadService`), but there's no client-side file-size or
  type validation yet - whatever the backend/Cloudinary will accept goes
  through.
- No AO picker for schools with more than one AO - ticket creation will
  surface the backend's error asking to disambiguate, but there's no
  UI for it yet.
- Chatbot history is client-side only (sent back each request as
  context) - refresh the page and the conversation is gone. No
  persisted chat log yet.
- The daily motivational quote widget was dropped per your instruction
  and won't be built.
