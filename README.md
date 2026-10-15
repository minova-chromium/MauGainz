# MauGainZ

An Android-first performance cookbook for building recipes, tracking exact ingredient amounts, following preparation step by step, and recording per-serving macros. MauGainZ includes English and Dutch interfaces, responsive phone/tablet layouts, drag ordering, Open Food Facts nutrition lookup, barcode scanning, and recipe import from websites, photos, or pasted text.

## Download

Download the newest universal Android APK from [GitHub Releases](https://github.com/minova-chromium/MauGainz/releases/latest). Android may ask you to allow APK installation from your browser the first time.

MauGainZ checks the latest official GitHub release when the app starts. When a newer semantic version is available, an in-app English/Dutch update screen links directly to the universal APK. Android always keeps the final installation confirmation under the user's control.

## Smart features

- Drag ingredients and preparation steps from the handle on the left.
- Scan EAN/UPC barcodes or search Open Food Facts; verified per-100-g nutrition is stored with the ingredient.
- Automatic macro calculation uses the matched database values first and the built-in offline profile as fallback.
- Import recipe JSON-LD from websites, scan printed recipes locally with ML Kit OCR, or paste free-form English/Dutch recipe text.
- Cloud backup uses an anonymous Firebase account and a private 20-character device-link code.

## Enable cloud sync

Create a Firebase project, enable Anonymous Authentication and Cloud Firestore, then provide these variables when bundling:

```text
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
```

The Firestore rules only need document access for authenticated users; listing sync codes should remain disabled:

```text
match /maugainzSync/{code} {
  allow get, create, update: if request.auth != null;
}
```

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
