# Supabase Removal & Cloud Stack Migration Plan

## Phase 1: Remove Supabase Dependencies
- [ ] Remove @supabase/supabase-js from package.json
- [ ] Remove all supabase imports from codebase
- [ ] Remove supabase environment variables
- [ ] Delete lib/supabase/admin.ts

## Phase 2: Add Cloudinary Integration
- [ ] Install cloudinary package
- [ ] Create Cloudinary upload handler
- [ ] Update /api/upload/business-logo/route.ts
- [ ] Update /api/upload/product-image/route.ts
- [ ] Add Cloudinary environment variables

## Phase 3: Database Setup
- [ ] Create Neon PostgreSQL account
- [ ] Get DATABASE_URL from Neon
- [ ] Set DATABASE_URL in Vercel
- [ ] Run Prisma migrations on Neon
- [ ] Seed database with admin user

## Phase 4: Redis Setup
- [ ] Verify Upstash Redis credentials
- [ ] Update Redis environment variables
- [ ] Test Redis connection

## Phase 5: Testing & Deployment
- [ ] Test locally
- [ ] Deploy to Vercel
- [ ] Test file uploads on production
- [ ] Test login functionality
- [ ] Verify caching works

## Timeline: ~2 hours total
