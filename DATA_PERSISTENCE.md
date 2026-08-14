# Data Persistence Architecture

## Overview

This application uses a **hybrid storage approach** that combines local browser storage with cloud synchronization via Supabase for authenticated users.

## Storage Strategy

### Local Storage (Browser-Specific)
- **Guest Users**: All data is stored locally in the browser's localStorage
- **Isolated per browser**: Data in Chrome won't appear in Firefox, etc.
- **Privacy-focused**: Each user's data is scoped with unique keys

### Cloud Storage (Cross-Browser)
- **Authenticated Users**: Data syncs to Supabase database
- **Cross-device sync**: Login on any browser to access your data
- **Merge strategy**: Local and remote data are merged on login (max values or union of sets)

## Storage Implementation

All data persistence uses the **safeStorage** utility (`src/utils/safeStorage.ts`) which provides:
- Graceful fallback to in-memory storage if localStorage is unavailable
- Consistent error handling across the application
- Browser compatibility safety

### Data Types and Hooks

| Data Type | Hook/Context | Storage Key | Sync Strategy |
|-----------|--------------|-------------|---------------|
| **Activity Log** | `useActivityLog` | `meroDeutschActivity:{userId}` | Max count per day |
| **Progress** | `useProgress` | `germanAlphabetProgress:{userId}` | Union of practiced letters, max counts |
| **Review Queue** | `useReviewQueue` | `meroDeutschWrongAnswers:{userId}` | Merge by item ID |
| **Streak Data** | `useStreak` | `germanDailyStreak:{userId}` | Max streak values |
| **XP/Leveling** | `XpContext` | `mero_deutsch_xp:{userId}` | Remote value takes precedence |

### User Scoping

All storage keys use the `scopedKey()` utility:
```typescript
// Authenticated: "keyName:user123"
// Guest: "keyName:guest"
```

This ensures:
- ✅ Authenticated users never see guest data
- ✅ Different authenticated users have isolated data
- ✅ Guest data is consistent within a browser

## Why Data Appears Different Across Browsers

### For Guest Users
This is **expected behavior**:
- Each browser maintains its own localStorage
- No cloud sync occurs for security/privacy
- Data is intentionally isolated per browser

**Solution**: Create an account to enable cross-browser sync

### For Authenticated Users
Data **should sync** across browsers:
1. Login triggers a fetch from Supabase
2. Local and remote data are merged
3. All changes are synced back to the cloud
4. Login on another browser pulls the latest data

## Recent Fix (2026-08-14)

### Issue
XpContext was using direct `localStorage` calls instead of `safeStorage`, creating inconsistency with other hooks.

### Solution
Updated `src/context/XpContext.tsx` to use `safeStorage` utilities:
- Replaced `localStorage.getItem()` with `getItem()`
- Replaced `localStorage.setItem()` with `setItem()`
- Added proper imports from `utils/safeStorage`

### Benefits
- ✅ Consistent storage approach across entire application
- ✅ Better error handling and fallback behavior
- ✅ Improved browser compatibility
- ✅ Memory fallback if localStorage is blocked/full

## Testing Data Persistence

### Guest User Test
1. Open app in Browser A (not logged in)
2. Complete some activities
3. Open app in Browser B (not logged in)
4. **Expected**: Different data (this is correct)

### Authenticated User Test
1. Create account and login in Browser A
2. Complete some activities
3. Logout and login in Browser B
4. **Expected**: Same data appears (synced from cloud)

### Verify Sync is Working
Check browser console for:
- ✅ No "Failed to sync" warnings
- ✅ Successful Supabase operations
- ✅ Data appearing after login

## Troubleshooting

### Data Not Syncing for Authenticated Users

1. **Check Authentication**: Verify user is actually logged in
   ```typescript
   console.log('User:', user, 'Authenticated:', isAuthenticated);
   ```

2. **Check Supabase Connection**: Look for errors in browser console

3. **Verify Database Tables**: Ensure these tables exist:
   - `user_progress`
   - `user_activity_days`
   - `review_queue`
   - `user_streaks`
   - `user_xp`

4. **Check Network Tab**: Verify API calls to Supabase are succeeding

### localStorage Issues

If localStorage is blocked (e.g., private browsing):
- ✅ App will still work (uses memory fallback)
- ❌ Data won't persist after browser refresh
- 💡 Encourage users to login for cloud persistence

## Best Practices

### For Developers
- Always use `safeStorage` utilities, never direct `localStorage`
- Use `scopedKey()` for all user-specific data
- Implement proper merge strategies for cloud sync
- Handle authentication state changes properly

### For Users
- **Guest mode**: Good for trying the app, data stays in browser
- **Authenticated**: Required for cross-browser/cross-device experience
- **Privacy**: Each browser isolates guest data by design
