# 🌐 Subdomain Standalone Link Setup (Phase 2)

**Status:** ✅ Code ready, deployment pending  
**Priority:** Phase 2 (after launch)  
**Cost:** ₹0 (using free Let's Encrypt SSL)

---

## 📋 Overview

Allow creators to have custom subdomain links: `yourname.selflyx.com` instead of `selflyx.com/chat/yourname`

**Current Phase 1:** Uses `/chat/:slug` (working, zero cost)  
**Phase 2:** Add subdomain support (better branding, same cost)

---

## ✅ Code Status

### Already Implemented (Frontend)

1. **`frontend/react-app/src/pages/HomeRoute.tsx`**
   - `getSubdomainHandle()` function detects subdomain
   - Auto-redirects `yourname.selflyx.com` → `/chat/yourname`
   - **Gated:** Only works if `VITE_PUBLIC_BASE_DOMAIN` env var is set

2. **`frontend/react-app/src/pages/Integrations.tsx`**
   - Generates subdomain link: `https://${publicSlug}.${baseDomain}/`
   - Falls back to `/chat/:slug` if env var not set

### How It Works (Current)

```typescript
// Only activates if VITE_PUBLIC_BASE_DOMAIN is set
const baseDomain = (import.meta.env.VITE_PUBLIC_BASE_DOMAIN || '').trim();
if (!baseDomain) {
  // Falls back to /chat/:slug (Phase 1 behavior)
  return null;
}
```

**Result:** Code is ready but **disabled by default** (no env var = Phase 1 behavior)

---

## 🚀 Deployment Setup (Phase 2)

### Step 1: DNS Configuration

#### Option A: Hostinger DNS (if wildcard supported)

1. Login to Hostinger → DNS Management
2. Add A Record:
   ```
   Type: A
   Name: *
   Value: YOUR_SERVER_IP
   TTL: 3600
   ```

#### Option B: Cloudflare (Recommended - Free)

1. Transfer domain DNS to Cloudflare (or add as external)
2. Add A Record:
   ```
   Type: A
   Name: *
   Content: YOUR_SERVER_IP
   Proxy: ON (optional, for DDoS protection)
   ```

**Note:** If Hostinger doesn't support wildcard (`*`), use Cloudflare (free, better features)

---

### Step 2: SSL Certificate (HTTPS)

#### Let's Encrypt Wildcard (Free, Recommended)

```bash
# On your server
sudo apt install certbot python3-certbot-nginx

# Get wildcard cert (DNS challenge)
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.selflyx.com" \
  -d "selflyx.com"
```

**DNS Challenge Steps:**
1. Certbot will ask you to add a TXT record
2. Add it in Hostinger/Cloudflare DNS:
   ```
   Type: TXT
   Name: _acme-challenge
   Value: [certbot provides this]
   ```
3. Wait 1-2 minutes for DNS propagation
4. Press Enter in certbot
5. Cert saved to: `/etc/letsencrypt/live/selflyx.com/`

**Auto-renewal:**
```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renews (cron job installed automatically)
```

---

### Step 3: Nginx Configuration

Create wildcard server block:

```nginx
# /etc/nginx/sites-available/selflyx-wildcard
server {
    listen 80;
    server_name *.selflyx.com selflyx.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name *.selflyx.com selflyx.com;

    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/selflyx.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/selflyx.com/privkey.pem;

    # SSL settings (security best practices)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Your React app (Vite dev server or production build)
    location / {
        proxy_pass http://localhost:5173; # Vite dev
        # OR: proxy_pass http://localhost:3000; # Production Node server
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API routes (if backend on same server)
    location /api {
        proxy_pass http://localhost:5000; # Your backend port
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/selflyx-wildcard /etc/nginx/sites-enabled/
sudo nginx -t  # Test config
sudo systemctl reload nginx
```

---

### Step 4: Frontend Environment Variable

Add to `.env` (or `.env.production`):

```bash
VITE_PUBLIC_BASE_DOMAIN=selflyx.com
```

**Important:** Don't include `https://` or trailing slash, just the domain name.

Rebuild frontend:
```bash
cd frontend/react-app
npm run build
```

---

## 🧪 Testing

### 1. DNS Test
```bash
# Check if wildcard DNS resolves
dig *.selflyx.com
# Should return your server IP
```

### 2. SSL Test
```bash
# Check SSL certificate
openssl s_client -connect yourname.selflyx.com:443 -servername yourname.selflyx.com
# Should show Let's Encrypt cert
```

### 3. Browser Test
1. Visit `yourname.selflyx.com`
2. Should redirect to `/chat/yourname`
3. Should show HTTPS (green lock)

---

## 💰 Cost Breakdown

| Item | Cost | Provider |
|------|------|----------|
| DNS Wildcard | ₹0 | Hostinger/Cloudflare (free) |
| SSL Certificate | ₹0 | Let's Encrypt (free) |
| Server | ₹0 | Same server (no extra cost) |
| **Total** | **₹0** | **Zero additional cost** |

---

## ⚠️ Important Notes

### Phase 1 (Current)
- ✅ Uses `/chat/:slug` (already working)
- ✅ No DNS/SSL changes needed
- ✅ Zero deployment complexity
- ✅ Shareable: `selflyx.com/chat/yourname`

### Phase 2 (When Ready)
- 🌐 Subdomain: `yourname.selflyx.com`
- 📝 Better branding for creators
- ⏱️ Setup time: 30-60 minutes
- 💰 Cost: ₹0 (free SSL)

---

## 🔄 Rollback Plan

If subdomain causes issues, simply:

1. Remove `VITE_PUBLIC_BASE_DOMAIN` from `.env`
2. Rebuild frontend
3. System falls back to `/chat/:slug` (Phase 1 behavior)

**Code is designed to be backward compatible.**

---

## 📝 Checklist (When Implementing)

- [ ] DNS wildcard record added (`*.selflyx.com` → server IP)
- [ ] Let's Encrypt wildcard cert installed
- [ ] Nginx wildcard config created and enabled
- [ ] `VITE_PUBLIC_BASE_DOMAIN=selflyx.com` added to `.env`
- [ ] Frontend rebuilt with new env var
- [ ] Test: `yourname.selflyx.com` → `/chat/yourname`
- [ ] Test: HTTPS works (green lock)
- [ ] Test: Integrations page shows subdomain link
- [ ] SSL auto-renewal verified (`certbot renew --dry-run`)

---

## 🐛 Troubleshooting

### Subdomain not resolving
- Check DNS propagation: `dig *.selflyx.com`
- Wait 5-10 minutes after DNS change
- Clear browser DNS cache

### SSL certificate error
- Verify cert path in Nginx config
- Check cert expiry: `sudo certbot certificates`
- Renew if needed: `sudo certbot renew`

### Nginx 502 Bad Gateway
- Check backend is running on correct port
- Verify proxy_pass URL in Nginx config
- Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

---

## 📚 References

- [Let's Encrypt Wildcard Cert Guide](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge)
- [Nginx Wildcard Server Blocks](https://nginx.org/en/docs/http/server_names.html#wildcard_names)
- [Cloudflare DNS Setup](https://developers.cloudflare.com/dns/manage-dns-records/)

---

**Last Updated:** Phase 1 Complete - Subdomain deferred to Phase 2  
**Code Status:** ✅ Ready (gated by env var, disabled by default)

