# HerSentinel APK Distribution Guide

## Overview
This guide explains how to get the release APK and distribute it for testing.

---

## APK Locations

### After Build Completes
The release APK will be located at:
```
C:\P-HerSentinel\HerSentinel\android\app\build\outputs\apk\release\app-release.apk
```

File size: ~100-150 MB (includes all native code for ARM architectures)

---

## Step 1: Download APK to Share

After the build finishes, the APK is ready at the path above.

**To copy for sharing:**
```powershell
Copy-Item "C:\P-HerSentinel\HerSentinel\android\app\build\outputs\apk\release\app-release.apk" "C:\Users\<YourUsername>\Downloads\HerSentinel-release.apk"
```

---

## Distribution Methods

### Method 1: GitHub Releases (Recommended for Team Testing)

1. **Go to**: https://github.com/hkumarrai1/HerSentinel/releases
2. **Click**: **Draft a new release**
3. **Tag**: `v1.0.0-beta1`
4. **Release Title**: `HerSentinel Beta 1 - Production Ready`
5. **Description**:
   ```
   ## HerSentinel Beta 1 - Production Deployment
   
   ### Features
   - Mobile app with live location tracking
   - Emergency alert system with guardian notifications
   - Evidence upload to Cloudinary
   - Real-time SOS timeline
   
   ### Backend
   - Live at https://hersentinel.onrender.com
   - MongoDB Atlas database
   - Cloudinary for evidence storage
   
   ### Installation
   1. Download `app-release.apk` below
   2. Enable "Unknown Sources" in Android Settings
   3. Install the APK
   4. Create account or login
   5. Add guardians and test emergency flow
   
   ### Testing Checklist
   - [ ] App launches without errors
   - [ ] Login/Register works
   - [ ] Can add guardians
   - [ ] Emergency trigger works
   - [ ] Location is sent to backend
   - [ ] Evidence uploads successfully
   - [ ] Guardian receives notifications
   
   **Known Issues**: None at this time
   **Tested On**: Android 12+
   **Build Date**: 2026-04-23
   ```
6. **Upload File**: Drag `app-release.apk` into the assets box
7. **Publish Release**

**Testers can now download from**: https://github.com/hkumarrai1/HerSentinel/releases

---

### Method 2: Direct Download Link

Upload APK to a cloud storage service and share the direct link:

**Option A: Google Drive**
1. Upload `app-release.apk` to Google Drive
2. Right-click → Share
3. Set to "Anyone with link can view"
4. Copy shareable link
5. Send link to testers

**Option B: OneDrive**
1. Upload `app-release.apk` to OneDrive
2. Click "Share"
3. Generate shareable link
4. Send to testers

**Option C: WeTransfer** (for large files)
1. Go to https://wetransfer.com
2. Drag APK
3. Enter tester emails
4. Send - testers get 7-day download link

---

### Method 3: Android Debug Bridge (Local Network)

If testers are on the same WiFi:

```powershell
adb connect <DEVICE_IP>:5555
adb install -r "C:\P-HerSentinel\HerSentinel\android\app\build\outputs\apk\release\app-release.apk"
```

---

## Installation Instructions for Testers

### Prerequisites
- Android 12 or higher
- ~200 MB free storage
- Google Play Services installed

### Steps

1. **Download APK**: Get the APK file from your chosen method
2. **Enable Unknown Sources**:
   - Settings → Apps & notifications → Advanced → Install unknown apps
   - Enable Chrome (or download app)
3. **Install**:
   - Open file manager → locate APK
   - Tap → Install
   - Wait ~30 seconds
4. **Launch App**:
   - Settings → Apps → HerSentinel → Open
   - Or tap "Open" in installer
5. **Create Account**:
   - Email, password (strong)
   - Verify email (check inbox)
6. **Grant Permissions**:
   - Location: Allow
   - Contacts: Allow
   - Camera: Allow
   - Microphone: Allow
   - Notifications: Allow
7. **Add Guardian**:
   - Settings → Add Guardian
   - Enter guardian email
   - Guardian receives invite
8. **Test Emergency**:
   - Hold power button 3 seconds
   - Or use Safety Mode → Emergency
   - Confirm SOS
   - Location sent to backend
   - Guardian notified

---

## Testing Checklist for Testers

### Functionality Tests
- [ ] App installs without errors
- [ ] App launches and doesn't crash
- [ ] Login/Register works
- [ ] Can add multiple guardians
- [ ] Emergency trigger activates
- [ ] Location updates in real-time
- [ ] Can upload evidence (photo/video)
- [ ] Evidence visible in guardian dashboard
- [ ] SOS timeline shows events

### Backend Integration Tests
- [ ] Internet connection required (no offline mode in beta)
- [ ] API calls complete within 5 seconds
- [ ] Notifications reach guardians
- [ ] Evidence uploads to Cloudinary
- [ ] Database saves user data

### Device Compatibility Tests
- [ ] Works on Android 12
- [ ] Works on Android 13
- [ ] Works on Android 14+
- [ ] Works on different phone brands (Samsung, Pixel, etc.)

### Edge Cases
- [ ] App doesn't crash on slow network
- [ ] App handles lost connection gracefully
- [ ] App recovers after screen lock/unlock
- [ ] Multiple emergencies don't conflict

---

## Collecting Feedback

**Ask testers to provide**:
1. Device model & Android version
2. Any crashes (with screenshot of error)
3. Performance issues (lag, freezing)
4. UX feedback (confusing buttons, etc.)
5. Missing features or bugs

---

## Rollback (If Issues Found)

If critical issues are found:

1. **Pause Distribution**: Stop sharing the APK
2. **Fix Issue**: Commit fix to GitHub
3. **Rebuild**: Run `./gradlew assembleRelease` again
4. **Create New Release**: Tag as `v1.0.0-beta2`
5. **Notify Testers**: Update on the issue fix

---

## Public Release (When Ready)

For production release:

1. **Google Play Store**:
   - Register as developer ($25 one-time)
   - Prepare store listing
   - Upload APK + screenshots
   - Submit for review (24-48 hours)
   - Goes live to all Android users

2. **F-Droid** (Open Source App Store):
   - No approval needed
   - Free distribution
   - Great for privacy-focused users

3. **Direct APK Distribution**:
   - Maintain releases on GitHub
   - Users sideload directly

---

## Security Notes for Testers

⚠️ **IMPORTANT**:
- This APK connects to `https://hersentinel.onrender.com`
- Backend uses secure authentication (JWT)
- Evidence uploaded to Cloudinary (encrypted link)
- Don't use real emergency data for testing

---

## Support

If testers encounter issues:
1. Check GitHub Issues: https://github.com/hkumarrai1/HerSentinel/issues
2. Report new issues with:
   - Device info
   - Steps to reproduce
   - Screenshot/video
   - Error message (if any)

---

## FAQ

**Q: Is the app safe to use?**
A: Yes, for testing. It uses production-grade authentication and data storage. Don't use real emergencies.

**Q: Will my data be deleted?**
A: No, it's stored in MongoDB Atlas. Data persists until account deletion.

**Q: Can I install multiple versions?**
A: No, the release APK overwrites debug APK. Uninstall first if needed.

**Q: How do I uninstall?**
A: Settings → Apps → HerSentinel → Uninstall

**Q: How do I report a bug?**
A: Create an issue on GitHub with device details and steps to reproduce.

---
