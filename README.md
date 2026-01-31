# 🪞 Identity Mirror

**Personal identity mirror for consistent communication across Gmail, LinkedIn, and Slack.**

---

## 🚀 Quick Start

See [QUICK_START.md](./QUICK_START.md) for setup instructions.

---

## 📚 Documentation

- **[FINAL_CODE_FLOW.md](./FINAL_CODE_FLOW.md)** - Complete system flow with diagrams
- **[FINAL_PRODUCTION_READINESS_REPORT.md](./FINAL_PRODUCTION_READINESS_REPORT.md)** - Production deployment guide
- **[QUICK_START.md](./QUICK_START.md)** - Development setup
- **[RULES.md](./RULES.md)** - Project guidelines

---

## 🏗️ Architecture

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Extension:** Chrome Extension (Gmail integration)
- **Deployment:** Railway

---

## ✅ Production Status

**Status:** ✅ **PRODUCTION READY**

- All core features implemented
- Security measures in place
- Rate limiting configured
- Payment integration (disabled by default)
- Comprehensive error handling

See [FINAL_PRODUCTION_READINESS_REPORT.md](./FINAL_PRODUCTION_READINESS_REPORT.md) for details.

---

## 📖 Key Features

- **Identity Management:** Define your communication rules and style
- **Mirror Engine:** Generate replies that match your identity
- **Decision Gate:** Pre-LLM checks (auto-reply, ignore, defer)
- **Output Validator:** Post-LLM validation and retry logic
- **Gmail Extension:** Direct integration with Gmail compose
- **Subscription Tiers:** Free (10/month), Pro (unlimited), Teams

---

## 🔒 Security

- JWT-based authentication
- CSRF protection
- Rate limiting (OWASP-compliant)
- PostgreSQL-backed rate limit store
- Security headers (Helmet.js)
- Payment signature verification

---

## 📝 License

Proprietary - All rights reserved













