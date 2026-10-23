# TaskEd Mobile (Ionic/Capacitor)

This wraps the exact same Angular app as the web version - Capacitor
bundles the built web assets into a native shell. There is no separate
mobile codebase to maintain; `frontend/src` is the only source of truth,
same as before.

## 1. One-time setup

You'll need:
- **Android**: Android Studio (includes the SDK) - free, any OS.
- **iOS**: a Mac with Xcode - Apple only allows building/signing iOS
  apps on macOS. If you don't have a Mac, you can still do everything
  else in this guide except the actual iOS build/run step.
- A **Firebase project**, if you want push notifications to work (see
  section 3) - optional, the app runs fine without it, just without
  device push.

```bash
cd frontend
npm install
```

## 2. Point the app at your backend

Before building, make sure `src/environments/environment.ts` (dev) or
`environment.prod.ts` (release builds) has the right `apiUrl` - **not**
`localhost` for a real device/emulator, since the phone can't reach
your laptop's localhost. Options while testing locally:

- Run the backend, then find your computer's LAN IP (e.g.
  `ipconfig`/`ifconfig` -> `192.168.1.23`), and set `apiUrl` to
  `http://192.168.1.23:3000`. Your phone/emulator must be on the same
  Wi-Fi network.
- Or deploy the backend somewhere reachable (see the top-level
  `DEPLOYMENT.md`) and point at that URL instead - simplest once it exists.

**Android only, one extra step for local HTTP testing**: newer Android
blocks plain HTTP (non-HTTPS) network calls by default. If your backend
isn't on HTTPS yet, add a network security config allowing cleartext to
your dev IP - see
https://capacitorjs.com/docs/guides/security#android-network-security-config.
Once your backend is on HTTPS (any real deployment should be), this
doesn't matter.

After changing environment files:

```bash
npm run build   # ng build - or `ng build --configuration production` for a release build
npx cap sync    # copies the new build + plugins into android/ and ios/
```

Run `npx cap sync` again any time you change frontend code, install a
new Capacitor plugin, or switch environments.

## 3. Firebase setup (for push notifications)

Device push (`@capacitor/push-notifications`) needs a real Firebase
project - this is a one-time manual step in Firebase's console since it
creates credentials tied to your own Google account, which nothing here
can do for you.

1. Go to https://console.firebase.google.com and create a project (or
   reuse an existing one).
2. **Android**: Project Settings > Add app > Android. Use the same
   package name as `capacitor.config.ts`'s `appId`:
   `ph.gov.deped.leyte.tasked`. Download `google-services.json` and
   place it at `frontend/android/app/google-services.json`. The
   Gradle files already check for this file and wire up the Google
   Services plugin automatically if it's present - nothing else to edit.
3. **iOS**: Project Settings > Add app > iOS. Same bundle ID. Download
   `GoogleService-Info.plist` and drag it into the Xcode project at
   `ios/App/App/` (via Xcode's "Add Files" - dragging in Finder alone
   won't add it to the build target). Then in Xcode: select the App
   target > Signing & Capabilities > "+ Capability" > **Push
   Notifications**, and also add **Background Modes** > Remote
   notifications. This part requires Xcode/macOS.
4. **Backend**: Project Settings > Service Accounts > "Generate new
   private key" - downloads a JSON file. Paste its entire contents as
   one line into the backend's `.env` as `FIREBASE_SERVICE_ACCOUNT_JSON`
   (or base64-encode it first, both are accepted - see the backend
   README). This is what lets the backend actually *send* pushes, not
   just receive device tokens.

Until you do this, the app works completely normally - it just won't
receive device push notifications (in-app/realtime notifications via
Socket.IO still work everywhere, web included).

## 4. Run it

### Android (fastest way to actually see it working)

```bash
npx cap open android
```

This opens Android Studio. Pick a device/emulator and hit Run. First
build will take a while (Gradle downloading dependencies) - normal.

Alternatively, from the command line once a device/emulator is already
connected:

```bash
npx cap run android
```

### iOS (Mac + Xcode required)

```bash
npx cap open ios
```

Opens Xcode. Pick a simulator or a connected device (a physical device
needs your Apple ID signed into Xcode and a provisioning profile - Xcode
mostly handles this automatically for a free personal team, enough for
testing on your own device).

### Live reload during development (optional, faster iteration)

Instead of rebuilding + re-syncing for every change, point the native
shell at your local dev server:

```bash
ng serve --host 0.0.0.0
```

then temporarily set `server.url` in `capacitor.config.ts` to
`http://<your-LAN-IP>:4200`, run `npx cap sync`, and launch. Remove that
`server.url` override before building a real release - it should load
the bundled `dist/` assets, not reach out to your dev machine.

## 5. Building a release (Play Store / App Store)

This is genuinely a separate, multi-step process per platform (signing
keys, store listings, review) - outside what any single guide can fully
cover, but the short version:

**Android**: Android Studio > Build > Generate Signed Bundle/APK. You'll
need to create a keystore (`keytool -genkey ...` or Android Studio's UI)
and **keep it safe and backed up** - losing it means you can never
update the app again under the same listing. Upload the resulting
`.aab` to the Google Play Console.

**iOS**: needs an active Apple Developer Program membership ($99/year).
Xcode > Product > Archive, then use the Organizer window to upload to
App Store Connect.

## What's still genuinely native-only work

- App icons and splash screen images - Capacitor ships defaults;
  replace them via `@capacitor/assets` or manually per the platform's
  asset folders when you have real branding assets ready.
- Store listings, screenshots, privacy policy URLs, review submission.
- Testing push notifications end-to-end needs a real device (FCM
  doesn't reliably reach emulators/simulators for testing).


## Google sign-in on mobile (system browser + deep link)

Google refuses OAuth inside embedded WebViews (`disallowed_useragent`), so the
app opens sign-in in the system browser (Chrome Custom Tab) via
`@capacitor/browser`:

1. App opens `<apiUrl>/auth/google?platform=mobile`.
2. Backend carries a `mobile` marker through Google's `state` parameter.
3. After Google, the callback serves a tiny page that opens
   `ph.gov.deped.leyte.tasked://auth?token=<jwt>`.
4. Android routes that link to the app (intent-filter in `AndroidManifest.xml`,
   iOS: `CFBundleURLTypes` in `Info.plist`); `AppComponent` catches it with
   `App.addListener('appUrlOpen')`, stores the token and routes the user.

No change is needed in Google Cloud Console: the authorized redirect URI stays
the backend's `/auth/google/callback`. The custom scheme can be changed with
`MOBILE_APP_SCHEME` on the backend (must match the manifest and `Info.plist`).
After pulling this change run `npx ng build && npx cap sync android`.
Web login is unchanged.
