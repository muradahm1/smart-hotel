# Secure Deployment Guide

## Environment Variables Setup

### For Local Development:
1. Your `.env` file is already created with credentials
2. The `.env` file is protected by `.gitignore` (never committed to git)
3. Credentials are loaded from `config-public.js` as fallback

### For Production Deployment:

#### Option 1: Netlify
1. Go to Site Settings → Environment Variables
2. Add:
   - `SUPABASE_URL` = your_supabase_url
   - `SUPABASE_ANON_KEY` = your_anon_key
3. Netlify will inject these at build time

#### Option 2: Vercel
1. Go to Project Settings → Environment Variables
2. Add the same variables
3. Redeploy your site

#### Option 3: GitHub Pages (Static)
Since GitHub Pages doesn't support server-side environment variables:
1. Keep credentials in `config-public.js` (they're public anyway for frontend)
2. Use Supabase Row Level Security (RLS) to protect your data
3. The anon key is safe to expose - it's meant for client-side use

## Security Notes:

### ✅ Safe to Expose (Client-Side):
- `SUPABASE_URL` - Public endpoint
- `SUPABASE_ANON_KEY` - Public anonymous key (protected by RLS)

### ❌ NEVER Expose:
- `SUPABASE_SERVICE_KEY` - Server-side only
- Database passwords
- API secrets

## Current Setup:
Your app currently uses the **anon key** which is SAFE for client-side use because:
1. Supabase uses Row Level Security (RLS)
2. The anon key has limited permissions
3. All data access is controlled by your database policies

## Recommendation:
For a static site (no backend), keeping credentials in `config-public.js` is acceptable because:
- The anon key is designed for public use
- Real security comes from Supabase RLS policies
- Attackers can't do anything without proper RLS rules

## To Enhance Security:
1. Set up proper RLS policies in Supabase
2. Enable email verification
3. Use authentication for sensitive operations
4. Monitor usage in Supabase dashboard