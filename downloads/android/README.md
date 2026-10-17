# TRACKER Android 2.1.1

[Download the native Android app](https://github.com/Aikansh-Official/TRACKER/releases/download/android-v2.1.1/TRACKER-Kotlin-release.apk)

Kotlin + Jetpack Compose, with offline SQLite storage and revision-aware task synchronization. Requires Android 8.0 or later.

- Version: **2.1.1** (version code 4)
- Application ID: `com.aikansh.tracker.nativeapp`
- Size: 13,339,902 bytes
- SHA-256: `29ea37cb6f40dec49f8f846fe48168dcbebf65276091261c2091e72ee91a1dda`
- Server: `https://tracker-rw9d.onrender.com/api/`
- Signature: existing Android debug certificate; verified to match the prior native repository APK.

This is a portfolio/testing distribution, not a Play Store build.

## Install or update

Download and open the APK on your phone. If prompted, allow installation from your browser/file manager. Update without uninstalling when the existing app has the same signing certificate; uninstalling removes local data. This build does not migrate data from the separate Flutter app.

## Verify

```powershell
Get-FileHash .\TRACKER-Kotlin-release.apk -Algorithm SHA256
```

Compare with the hash above or the release's `SHA256SUMS.txt`.

## Older downloads

The [original Flutter and Kotlin release](https://github.com/Aikansh-Official/TRACKER/releases/tag/android-v1.0.0) is retained for historical reference. Those builds use the legacy sync contract and should not be used to sync with the updated backend. Use the current native app instead.

[Android source](https://github.com/Aikansh-Official/TRACKER-Kotlin-) · [Release notes](https://github.com/Aikansh-Official/TRACKER/releases/tag/android-v2.1.1)
