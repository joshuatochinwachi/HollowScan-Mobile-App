# iOS Production Build Guide (EAS)

Follow these steps to build the HollowScan iOS app for production using EAS Cloud.

## 📋 Critical Files to Track
EAS Cloud cannot see files that are excluded in your `.gitignore`. You must temporarily track these files so they can be uploaded to the build server:
- `eas.json`
- `GoogleService-Info.plist`
- `google-services.json`

## 🚀 Build Instructions

Run these commands in your terminal from the root directory:

### 1. Force add ignored files to Git
```powershell
git add -f eas.json GoogleService-Info.plist google-services.json
```

### 2. Create a temporary commit
This ensures the files are included in the upload to EAS.
```powershell
git commit -m "temp: tracking config for ios production build"
```

### 3. Run the EAS Build
```powershell
eas build --platform ios --profile production
```

### 4. Cleanup Tracking
Once the terminal says **"Project uploaded successfully"** (and the build has started on the dashboard), you should untrack these sensitive files again:

```powershell
# Undo the temporary commit (keep changes)
git reset --soft HEAD~1

# Unstage the sensitive files
git reset eas.json GoogleService-Info.plist google-services.json
```

---
> [!IMPORTANT]
> Never push these files to a public GitHub repository. Always perform the cleanup step after the build starts.
