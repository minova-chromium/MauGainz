# MauGainZ

An Android-first performance nutrition app for building recipes, tracking meals and exact ingredient amounts, following preparation step by step, and recording macros, weight, vitamins, and training plans. MauGainZ includes English and Dutch interfaces, responsive phone/tablet layouts, drag ordering, Open Food Facts nutrition lookup, barcode scanning, and recipe import from websites, photos, or pasted text.

## Download

Download the newest universal Android APK from [GitHub Releases](https://github.com/minova-chromium/MauGainz/releases/latest). Android may ask you to allow APK installation from your browser the first time.

The official product site is published through GitHub Pages at [minova-chromium.github.io/MauGainz](https://minova-chromium.github.io/MauGainz/). Its download button reads GitHub's latest-release API, so a newly published APK appears on the website automatically without requiring a separate website edit.

The site also includes a desktop account dashboard at [`/app.html`](https://minova-chromium.github.io/MauGainz/app.html). The same email/password account works in Android and on the web, with private Firestore synchronization and opt-in recipe sharing between friends.

The owner-only account overview is available at [`/admin.html`](https://minova-chromium.github.io/MauGainz/admin.html). Firebase rules restrict the directory to the configured administrator. It exposes account activity and aggregate item counts only; private recipes, meals, body weight and planning data remain inaccessible.

MauGainZ checks the latest official GitHub release when the app starts. When a newer semantic version is available, an in-app English/Dutch update screen links directly to the universal APK. Android always keeps the final installation confirmation under the user's control.

## Smart features

- Drag ingredients and preparation steps from the handle on the left.
- Scan EAN/UPC barcodes or search Open Food Facts; verified per-100-g nutrition is stored with the ingredient.
- Automatic macro calculation uses the matched database values first and the built-in offline profile as fallback.
- Import recipe JSON-LD from websites, scan printed recipes locally with ML Kit OCR, or paste free-form English/Dutch recipe text.
- Email/password accounts synchronize recipes, diary entries, targets, progress, meal plans, ingredients, vitamins, and training days across phone, tablet, and desktop.
- Friend codes support friend requests and deliberate recipe sharing without exposing private diary or weight data.

## Firebase account backend

The production client configuration is in `src/firebaseConfig.ts`. Firebase web configuration values are public identifiers; access is protected by Authentication and the repository's `firestore.rules`.

You can override the production identifiers for another Firebase project when bundling:

```text
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
```

Deploy `firestore.rules` before using a replacement project. The rules isolate private account data by Firebase UID and only expose the minimum friend/profile records required for sharing.

## Run on Android

1. Install Expo Go on an Android phone or start an Android emulator.
2. Run `npm install`.
3. Run `npm run android`.

To start the development server without opening an emulator, run `npm start` and scan the QR code with Expo Go.

## Build an APK

Public releases must be signed with the same private release key. Create `android/keystore.properties` locally (it is ignored by Git) with `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`, then run:

```sh
cd android
./gradlew assembleRelease
```

The build intentionally refuses to create a release when production signing is missing. Back up the keystore securely: losing it makes it impossible to update existing installations.

For an Expo/EAS build, sign in and run:

```sh
npx eas-cli build --platform android --profile preview
```

The production profile in `eas.json` creates an Android App Bundle (`.aab`) for Google Play.
