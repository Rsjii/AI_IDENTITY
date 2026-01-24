# React Frontend - Modern SPA

## ✅ What's Built

### Core Setup
- ✅ Vite + React + TypeScript
- ✅ TailwindCSS with modern theme (light/dark mode)
- ✅ React Router for client-side routing
- ✅ React Query for data fetching
- ✅ shadcn/ui style components

### API Integration
- ✅ CSRF token management (`src/lib/csrf.ts`)
- ✅ API fetch wrapper with auto CSRF (`src/lib/api.ts`)
- ✅ Automatic token refresh on 403 errors
- ✅ Cookie-based auth (JWT)

### Pages Built
- ✅ **Landing Page** (`/`) - Modern hero with features
- ✅ **Auth Page** (`/auth`) - Login/Signup/Forgot tabs

### Components
- ✅ Layout & Navbar
- ✅ Theme Toggle (dark/light)
- ✅ UI Components (Button, Input, Card, Tabs, Alert)

## 🚀 How to Run

```bash
cd frontend/react-app
npm install
npm run dev
```

Frontend will run on `http://localhost:5173` (Vite default)
Backend API is proxied to `http://localhost:5000` (see `vite.config.ts`)

## 📝 Next Steps

1. **OTP Verify Pages** - `/signup/verify` and `/login/verify`
2. **Profile Completion** - `/signup/profile`
3. **Identity Setup/Edit** - `/identity/setup` and `/identity/edit`
4. **Mirror Page** - `/mirror`
5. **History Page** - `/history`
6. **Admin Pages** - `/admin/*`

## 🎨 Theme

Modern white/dark theme with:
- Clean, minimal design
- Smooth transitions
- Professional color palette
- Responsive layout

## 📦 Dependencies

All dependencies are in `package.json`. Key ones:
- `react-router-dom` - Routing
- `@tanstack/react-query` - Data fetching
- `tailwindcss` - Styling
- `lucide-react` - Icons
- `@radix-ui/react-tabs` - Accessible tabs
