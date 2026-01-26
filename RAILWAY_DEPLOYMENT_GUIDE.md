# 🚂 Railway Deployment Guide - Frontend & Backend

## 📋 Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **GitHub Repository** - Code should be pushed to GitHub
3. **Domain** (Optional) - For custom domains
4. **Environment Variables** - Ready to configure

---

## 🗄️ Step 1: Deploy PostgreSQL Database

### 1.1 Create PostgreSQL Service
1. Go to Railway Dashboard
2. Click **"New Project"**
3. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
4. Wait for database to provision

### 1.2 Get Database Connection String
1. Click on PostgreSQL service
2. Go to **"Variables"** tab
3. Copy `DATABASE_URL` value
   - Format: `postgresql://postgres:password@host:port/railway`

**Save this `DATABASE_URL` - you'll need it for backend!**

---

## 🔧 Step 2: Deploy Backend Service

### 2.1 Create Backend Service
1. In same Railway project, click **"New"** → **"GitHub Repo"**
2. Select your repository
3. Railway will auto-detect it

### 2.2 Configure Backend Service

#### **Settings Tab:**
- **Root Directory:** `backend`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`
- **Health Check Path:** `/health` (optional)

#### **Variables Tab - Add These:**

```bash
# Database
DATABASE_URL=postgresql://postgres:password@host:port/railway
# (Use the DATABASE_URL from PostgreSQL service)

# App Configuration
NODE_ENV=production
APP_ENV=prod
PORT=3000

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com
# OR if using Railway subdomain:
# FRONTEND_URL=https://your-frontend-service.railway.app

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Session Secret
SESSION_SECRET=your-super-secret-session-key-min-32-chars

# OAuth (Google)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
# OR Railway subdomain:
# GOOGLE_CALLBACK_URL=https://your-backend-service.railway.app/api/auth/google/callback

# LLM API Keys
OPENAI_API_KEY=sk-your-openai-key
GROQ_API_KEY=your-groq-api-key

# Email (Resend)
RESEND_API_KEY=re_your-resend-key
FROM_EMAIL=noreply@yourdomain.com

# PostHog (Analytics - Optional)
POSTHOG_API_KEY=your-posthog-key
POSTHOG_HOST=https://app.posthog.com

# Feature Flags (Optional)
ENABLE_POSTHOG=false
ENABLE_RATE_LIMITING=true
ENABLE_CSRF=true
```

### 2.3 Deploy Backend
1. Railway will auto-deploy on push to main branch
2. Check **"Deployments"** tab for build logs
3. Wait for deployment to complete

### 2.4 Get Backend URL
1. Go to **"Settings"** → **"Networking"**
2. Copy the **Public Domain** (e.g., `your-backend-service.railway.app`)
3. **Save this URL** - you'll need it for frontend!

---

## ⚛️ Step 3: Deploy Frontend Service

### 3.1 Create Frontend Service
1. In same Railway project, click **"New"** → **"GitHub Repo"**
2. Select same repository (or create new service)

### 3.2 Configure Frontend Service

#### **Settings Tab:**
- **Root Directory:** `frontend/react-app`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm run serve`
- **Health Check Path:** `/` (optional)

#### **Variables Tab - Add These:**

```bash
# API Base URL (Backend URL from Step 2.4)
VITE_API_BASE_URL=https://your-backend-service.railway.app
# OR if using custom domain:
# VITE_API_BASE_URL=https://api.yourdomain.com

# Environment
NODE_ENV=production
PORT=3000
```

**Note:** Frontend uses `VITE_` prefix for environment variables (Vite requirement)

### 3.3 Deploy Frontend
1. Railway will auto-deploy on push to main branch
2. Check **"Deployments"** tab for build logs
3. Wait for deployment to complete

### 3.4 Get Frontend URL
1. Go to **"Settings"** → **"Networking"**
2. Copy the **Public Domain** (e.g., `your-frontend-service.railway.app`)

---

## 🌐 Step 4: Setup Custom Domains (Optional)

### 4.1 Backend Custom Domain
1. Go to Backend service → **"Settings"** → **"Networking"**
2. Click **"Custom Domain"**
3. Enter domain: `api.yourdomain.com`
4. Railway will show DNS instructions:
   - **Type:** CNAME
   - **Name:** `api`
   - **Value:** `your-backend-service.railway.app`
5. Add this CNAME record in your DNS provider
6. Wait for DNS propagation (5-30 minutes)
7. Railway will auto-configure SSL

### 4.2 Frontend Custom Domain
1. Go to Frontend service → **"Settings"** → **"Networking"**
2. Click **"Custom Domain"**
3. Enter domain: `yourdomain.com` (or `app.yourdomain.com`)
4. Railway will show DNS instructions:
   - **Type:** CNAME
   - **Name:** `@` (or blank for root domain)
   - **Value:** `your-frontend-service.railway.app`
5. Add this CNAME record in your DNS provider
6. Wait for DNS propagation (5-30 minutes)
7. Railway will auto-configure SSL

### 4.3 Update Environment Variables After Domain Setup

**Backend Variables:**
```bash
FRONTEND_URL=https://yourdomain.com
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
```

**Frontend Variables:**
```bash
VITE_API_BASE_URL=https://api.yourdomain.com
```

**Then redeploy both services!**

---

## ✅ Step 5: Verify Deployment

### 5.1 Test Backend
```bash
# Health check
curl https://api.yourdomain.com/health
# OR
curl https://your-backend-service.railway.app/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}
```

### 5.2 Test Frontend
1. Open `https://yourdomain.com` (or Railway subdomain)
2. Should see landing page
3. Try signup/login flow

### 5.3 Test API Connection
1. Open browser console on frontend
2. Check Network tab
3. API calls should go to backend URL
4. No CORS errors should appear

---

## 🔍 Troubleshooting

### Backend Issues

**Error: "Failed to lookup view"**
- ✅ Fixed: `backend/frontend` folder removed
- Backend now points to root `frontend/src/views`

**Error: "Database connection failed"**
- Check `DATABASE_URL` is correct
- Ensure PostgreSQL service is running
- Check database credentials

**Error: "Port already in use"**
- Railway auto-assigns PORT, don't hardcode
- Use `process.env.PORT || 3000` in code

### Frontend Issues

**Error: "Cannot connect to API"**
- Check `VITE_API_BASE_URL` is correct
- Ensure backend is deployed and running
- Check CORS settings in backend

**Error: "Build failed"**
- Check `package-lock.json` is committed
- Run `npm install` locally and commit lock file
- Check Node.js version (Railway auto-detects)

### Domain Issues

**SSL Certificate not working**
- Wait 5-30 minutes for DNS propagation
- Check DNS records are correct
- Railway auto-provisions SSL (can take time)

**CORS errors**
- Update `FRONTEND_URL` in backend variables
- Redeploy backend after changing CORS settings

---

## 📝 Quick Checklist

- [ ] PostgreSQL database created
- [ ] Backend service created and configured
- [ ] All backend environment variables set
- [ ] Backend deployed successfully
- [ ] Frontend service created and configured
- [ ] Frontend environment variables set (VITE_API_BASE_URL)
- [ ] Frontend deployed successfully
- [ ] Custom domains configured (if using)
- [ ] DNS records added (if using custom domains)
- [ ] Environment variables updated with custom domains
- [ ] Both services redeployed after domain setup
- [ ] Health check passes
- [ ] Frontend can connect to backend API
- [ ] Test signup/login flow

---

## 🎯 Recommended Setup

**Option 1: Root Domain → Frontend (Recommended)**
- `yourdomain.com` → Frontend React App
- `api.yourdomain.com` → Backend API

**Option 2: Subdomain Setup**
- `app.yourdomain.com` → Frontend React App
- `api.yourdomain.com` → Backend API

---

## 📞 Support

If you face issues:
1. Check Railway deployment logs
2. Check service health status
3. Verify environment variables
4. Check DNS propagation (if using custom domains)
5. Review this guide again

---

**Last Updated:** 2025-01-24
**Status:** ✅ Ready for deployment

