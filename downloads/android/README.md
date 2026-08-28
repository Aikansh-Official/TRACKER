# TRACKER Android downloads

Choose either edition. Both are installable release APKs built from the TRACKER mobile project.

## Flutter edition

[Download TRACKER-Flutter-release.apk](https://github.com/Aikansh-Official/TRACKER/releases/download/android-v1.0.0/TRACKER-Flutter-release.apk)

- Size: 58,509,868 bytes
- SHA-256: `10AB6634D63D196BD3B7DC1F3666028D8CBF1D284A0035A309605391A191550C`
- Best for: the complete cross-platform TRACKER experience with offline-first storage and optional web-account sync.

## Native Kotlin edition

[Download TRACKER-Kotlin-release.apk](https://github.com/Aikansh-Official/TRACKER/releases/download/android-v1.0.0/TRACKER-Kotlin-release.apk)

- Size: 12,878,180 bytes
- SHA-256: `4D8E28E2C131F44B74C9229A836015D48C30674A3EFE715DAF348BEA96609000`
- Best for: the lightweight native Android TRACKER experience built with Kotlin and Jetpack Compose.

## Install

1. Download one APK on your Android device.
2. Open the downloaded file.
3. If Android asks, allow your browser or file manager to install unknown apps.
4. Review the installation prompt and select Install.

Android may show an extra warning because these APKs are distributed directly through GitHub instead of Google Play. Both files passed Android APK signature verification before publication.

## Verify a download

On Windows PowerShell, run:

```powershell
Get-FileHash .\TRACKER-Flutter-release.apk -Algorithm SHA256
```

Compare the output with the checksum listed above. Replace the filename when checking the Kotlin edition.
