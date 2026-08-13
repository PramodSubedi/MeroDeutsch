# Deployment Guide

This guide covers the complete deployment process for Mero Deutsch from local development to production.

---

## Prerequisites

- [ ] Supabase project created ([supabase.com](https://supabase.com))
- [ ] Vercel account ([vercel.com](https://vercel.com))
- [ ] Production domain (optional, Vercel provides free subdomain)

---

## 1. Environment Variables

### Create `.env.example` (template for team)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Create `.env` (local development)

1. Go to your Supabase project dashboard
2. Navigate to **Settings > API**
3. Copy the following values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

4. Create `.env` in project root:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **Never commit `.env` to git** (already in `.gitignore`)

---

## 2. Supabase Database Setup

### Run Migrations

1. Open Supabase Dashboard → **SQL Editor**
2. Run migrations in order:
   - `supabase/migrations/20240520000000_initial_schema.sql`
   - `supabase/migrations/20260814000000_harden_database.sql`

3. Verify tables created:
   - `profiles`
   - `user_progress`
   - `user_streaks`
   - `user_achievements`
   - `review_queue`

### Configure Auth Redirect URLs

1. Go to **Authentication > URL Configuration**
2. Add **Redirect URLs** (Site URL):

   **Local Development:**
   ```
   http://localhost:5173
   http://localhost:5173/auth/callback
   ```

   **Production** (replace with your domain):
   ```
   https://your-app.vercel.app
   https://your-app.vercel.app/auth/callback
   https://your-custom-domain.com
   https://your-custom-domain.com/auth/callback
   ```

3. Set **Site URL** to your primary domain (production URL)

### Enable Email Auth (if using email/password)

1. Go to **Authentication > Providers**
2. Enable **Email** provider
3. Configure email templates (optional):
   - Confirmation email
   - Password reset email
   - Magic link email

---

## 3. Vercel Deployment

### Initial Setup

1. Install Vercel CLI (optional):
   ```bash
   npm i -g vercel
   ```

2. Push code to GitHub/GitLab/Bitbucket

3. Import project in Vercel:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`

### Configure Environment Variables

In Vercel Dashboard → **Settings > Environment Variables**, add:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` | Production, Preview, Development |

⚠️ **After adding env vars, trigger a redeploy:**
- Go to **Deployments**
- Click ⋯ on latest deployment → **Redeploy**
- OR push a new commit

### Domain Configuration (Optional)

1. Go to **Settings > Domains**
2. Add custom domain
3. Update DNS records as shown
4. **Important:** Add custom domain to Supabase Auth Redirect URLs (step 2)

---

## 4. Post-Deployment Verification

### Smoke Test Checklist

#### Authentication Flow
- [ ] Visit production URL
- [ ] Click **Sign Up** / **Get Started**
- [ ] Register new account (use real email to test confirmation)
- [ ] Verify email confirmation works
- [ ] Log out
- [ ] Log in with credentials
- [ ] Check user profile loads

#### User Isolation (Critical)
- [ ] Register User A
- [ ] Complete some lessons, add to review queue
- [ ] Log out
- [ ] Register User B
- [ ] Verify User B sees **empty progress** (not User A's data)
- [ ] Log back in as User A
- [ ] Verify User A's progress is intact

#### Core Features
- [ ] Navigate to **/learn** page
- [ ] Test **Alphabet** module (practice, quiz)
- [ ] Test **Numbers** module
- [ ] Test **Module Switcher** (header dropdown)
- [ ] Add wrong answers to review queue
- [ ] Visit **Review Queue** page
- [ ] Verify spaced repetition works

#### Offline Support
- [ ] Open DevTools → Network tab
- [ ] Set to **Offline**
- [ ] Verify **offline banner** appears
- [ ] Verify cached pages still work
- [ ] Go back **Online**
- [ ] Verify banner disappears

#### Performance
- [ ] Check Lighthouse score (Target: 90+ Performance)
- [ ] Test on mobile device
- [ ] Verify PWA install prompt works

---

## 5. Monitoring & Maintenance

### Supabase Dashboard

Monitor usage:
- **Database** → Check table sizes, query performance
- **Authentication** → Track user signups
- **Logs** → Review errors

### Vercel Analytics

- Go to **Analytics** tab
- Monitor page views, performance
- Check for 404s or errors

### Error Tracking (Optional)

Consider adding:
- [Sentry](https://sentry.io) for error tracking
- [LogRocket](https://logrocket.com) for session replay

---

## 6. Rollback Procedure

If deployment fails:

1. **Vercel:**
   - Go to **Deployments**
   - Find last working deployment
   - Click → **Promote to Production**

2. **Supabase (database):**
   - Restore from automatic backups:
   - **Database → Backups** (Pro plan required)
   - Or manually rollback migrations via SQL Editor

---

## 7. Common Issues

### "Failed to fetch" errors after deployment

**Cause:** Environment variables not loaded
**Fix:** 
1. Verify env vars in Vercel Settings
2. Redeploy (don't just restart)

### Auth redirect loops

**Cause:** Redirect URL not configured in Supabase
**Fix:**
1. Add production URL to Supabase Auth settings
2. Check for trailing slashes (be consistent)

### "RLS policy violation" errors

**Cause:** Missing or incorrect RLS policies
**Fix:**
1. Verify migrations ran successfully
2. Check Supabase logs for specific policy errors
3. Test with `auth.uid()` in SQL editor:
   ```sql
   SELECT auth.uid(); -- Should return your user ID when logged in
   ```

### PWA not updating

**Cause:** Service worker caching old version
**Fix:**
1. Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
2. Clear site data in DevTools
3. Verify `workbox` version updated in `dist/`

---

## 8. Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] `.env` file in `.gitignore`
- [ ] Supabase anon key is **public** (not service key)
- [ ] No sensitive data in client code
- [ ] CORS configured correctly in Supabase
- [ ] Rate limiting enabled (Supabase Auth settings)

---

## 9. Performance Optimization

### Already Implemented
✅ Code splitting (Vite)
✅ PWA with service worker
✅ Debounced database saves
✅ Indexed queries (user_id, due_at)

### Optional Improvements
- [ ] Image optimization (if adding photos)
- [ ] CDN for static assets
- [ ] Database connection pooling (Supabase Pro)
- [ ] Redis cache for vocabulary (advanced)

---

## 10. Staging Environment (Recommended)

For testing before production:

1. Create separate Supabase project (staging)
2. Create Vercel preview environment
3. Use different env vars for staging
4. Test migrations on staging first

**Workflow:**
```
Local Dev → Push to feature branch → Vercel Preview Deploy (staging)
           → Merge to main → Production Deploy
```

---

## Support

- **Documentation:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Supabase Docs:** https://supabase.com/docs
- **Vercel Docs:** https://vercel.com/docs
- **Issues:** Create GitHub issue or check [TASKS.md](./TASKS.md)

---

**Last Updated:** 2026-08-14  
**Migration Version:** 20260814000000
