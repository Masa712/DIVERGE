# Production Setup Guide - Step 1

## 1. Create Production Supabase Project

### Steps:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Configure:
   ```
   Organization: [Your organization]
   Name: diverge-prod
   Database Password: [Generate strong password - SAVE THIS!]
   Region: ap-northeast-1 (Tokyo) - recommended for Japan
   ```
4. Wait for project creation (5-10 minutes)

### Get Credentials:
After creation, go to **Settings** → **API**:
- **Project URL**: https://[PROJECT_ID].supabase.co
- **anon/public key**: eyJhbGciOiJIUzI1NiIs... 
- **service_role key**: eyJhbGciOiJIUzI1NiIs... (KEEP SECRET!)

## 2. Run Database Migrations

### Method A: Copy from Development
1. In development Supabase: **SQL Editor** → **Templates** → **Export Schema**
2. Copy the complete schema
3. In production Supabase: **SQL Editor** → **New Query** → Paste and Run

### Method B: Run Migrations Individually
Copy each migration file content to production SQL Editor:
1. `001_initial_schema.sql`
2. `002_add_ancestor_function.sql` 
3. `003_add_node_comments_system.sql`
4. `004_fix_rls_policies.sql`
5. Continue through all migration files...
6. `010_prepare_for_production.sql`

### Verify Tables Created:
Go to **Database** → **Tables** and verify:
- ✅ sessions
- ✅ chat_nodes  
- ✅ usage_logs
- ✅ node_comments
- ✅ user_profiles
- ✅ session_participants
- ✅ (and other tables from migrations)

## 3. Production Redis Setup

### Option A: Redis Cloud (Recommended)
1. Go to [Redis Cloud](https://redis.com/redis-enterprise-cloud/)
2. Sign up / Login
3. Create **New Database**:
   ```
   Cloud Provider: AWS
   Region: ap-northeast-1 (Tokyo)
   Type: Fixed
   Size: 30MB (free tier)
   ```
4. Get connection details:
   ```
   Endpoint: redis-xxxxx.c1.ap-northeast-1.cache.amazonaws.com
   Port: 6379
   Password: [provided password]
   ```

### Option B: Railway Redis
1. Go to [Railway](https://railway.app)
2. **New Project** → **Add Redis**
3. Get connection string from Variables tab

### Option C: Upstash (Serverless)
1. Go to [Upstash](https://upstash.com)
2. Create **Redis Database**
3. Copy connection URL

## 4. Production Environment Variables

Create this file structure for deployment:

### For Vercel:
```bash
# .env.production (DO NOT COMMIT)

# Supabase Production
NEXT_PUBLIC_SUPABASE_URL=https://[PROD_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI... (service_role)

# OpenRouter (same as dev or separate key)
OPENROUTER_API_KEY=sk-or-v1-xxxxx
OPENROUTER_SITE_URL=https://your-domain.com
OPENROUTER_SITE_NAME=Diverge

# Redis Production
REDIS_HOST=redis-xxxxx.c1.ap-northeast-1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Optional: Keep development values for now
SENTRY_DSN=
RATE_LIMIT_REDIS_URL=
```

## 5. Pre-Deployment Checklist

### Code Preparation:
- [ ] All TypeScript errors fixed (`npm run typecheck`)
- [ ] All lint errors fixed (`npm run lint`)
- [ ] Production build successful (`npm run build`)
- [ ] Environment variables documented

### Database Preparation:
- [ ] Production Supabase project created
- [ ] All migrations applied
- [ ] RLS policies active
- [ ] Tables verified to exist

### Infrastructure:
- [ ] Redis instance ready
- [ ] Connection strings tested
- [ ] API keys valid

## 6. Deployment Steps (Next Phase)

1. **Push code to GitHub** (if not already)
2. **Connect Vercel to GitHub repo**
3. **Add environment variables in Vercel**
4. **Deploy and test**

## 7. Post-Deployment Verification

### Test these features:
- [ ] User registration/login
- [ ] Session creation
- [ ] Chat functionality
- [ ] Node comments
- [ ] Session list/dashboard
- [ ] All API endpoints responding

### Monitor:
- [ ] Supabase dashboard for queries
- [ ] Redis connection status
- [ ] Application logs
- [ ] Performance metrics

---

**Next Steps:**
Once this setup is complete, we'll proceed to Vercel deployment configuration.

**Important Notes:**
- NEVER commit production environment variables to git
- Keep service_role keys secure
- Test thoroughly in production before sharing
- Monitor usage and costs