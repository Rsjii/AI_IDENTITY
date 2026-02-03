# Phase 1 Docs — “Kaunsa doc kya hai?” + Cleanup Plan

Ye repo me Phase‑1 ke around multiple “final/analysis/todo” docs hain. Problem ye hai ki kuch docs **outdated** ho gaye (implementation change ho chuki), isliye confusion hota hai.

Goal: **Single Source of Truth** + baaki docs ko **archive** (delete nahi).

---

## A) “Must Keep” (daily use ke liye)

### **1) Requirements (spec)**
- `docs/phase1/PHASE1.md`  
  High-level Phase‑1 scope.
- `docs/phase1/PHASE_1_DETAILED.md`  
  Detailed requirements. (Agar 1 hi rakhna ho, ye rakh lo, aur `PHASE1.md` ko 1‑pager bana do.)

### **2) Testing**
- `docs/INTEGRATION_TEST_CHECKLIST.md`  
  Manual test checklist (release-gate).
- `docs/phase1/PHASE1_TESTING_LAUNCH_RUNBOOK.md`  
  **Single end‑to‑end runbook** (created to reduce confusion).

### **3) Launch / Go-live**
- `docs/LAUNCH_CHECKLIST.md`  
  Ops checklist.
- `docs/phase2_3/GO_LIVE_PHASE1_2_3.md`  
  Production env vars + **feature flags** (Phase‑1 only rollout ke liye important).

### **4) Database & Ops fixes**
- `docs/phase1/DATABASE_FIX.md`  
  Missing tables/session table fixes guidance.
- `docs/phase1/DATABASE_TIMEOUT_FIX.md`  
  Pool/timeouts/session pool separation guidance.

### **5) Payments**
- `docs/phase1/STRIPE_CLI_SETUP.md`
- `docs/phase1/STRIPE_WEBHOOK_FIXES.md`
- `docs/phase1/test_payment.json`

### **6) AI/RAG**
- `docs/phase1/LLM_OPTIMIZATION_CHANGES.md` (cost + RAG/caching overview)

---

## B) “Optional Keep” (reference / background)

- `docs/phase1/IMPLEMENTATION_SUMMARY.md`  
  Useful if you’re debugging refresh-token/session security or social import approach.

---

## C) “Archive these” (high duplication / frequently outdated)

> Suggestion: move into `docs/archive/phase1/` (delete mat karo; future reference ke liye).

- `docs/phase1/FINAL_DETAILED_ANALYSIS.md`  
  Very long + snapshots; time ke saath mismatch ho jata.
- `docs/phase1/FINAL_AZ_REVIEW.md`  
  Another “final” flow doc; runbook/checklist covers this.
- `docs/phase1/FINAL_PHASE1_REVIEW.md`
- `docs/phase1/MVP_FINAL_PHASE1_REVIEW.md`
- `docs/phase1/MVP_LAUNCH_ANALYSIS.md`  
  **Outdated risk:** isme kuch gaps (e.g. embed missing) ab code me fixed hain.
- `docs/phase1/PHASE1_FINAL_TODO.md` / `docs/phase1/PHASE1_TODO.txt`  
  Too many TODOs; current state ke saath mismatch ho sakta.
- `docs/phase1/FINAL_UI_UX_TODO.md`  
  Useful as design spec, but if UI polish complete hai, isko archive karke “done” note add kar do.
- `docs/phase1/FINAL_POLISH_COMPLETE.md`  
  Keep only if you need audit trail; otherwise archive.
- `docs/phase1/TODO_CURRENT.md`  
  Date mismatch (2024) + many claims; treat as historical snapshot.

---

## D) “How to de-confuse” (simple rules)

1) **Spec**: only `PHASE_1_DETAILED.md` counts as requirement truth.  
2) **Launch**: only `GO_LIVE_PHASE1_2_3.md` + `LAUNCH_CHECKLIST.md`.  
3) **Testing**: only `INTEGRATION_TEST_CHECKLIST.md` + `PHASE1_TESTING_LAUNCH_RUNBOOK.md`.  
4) Everything else = archive / historical.

---

## E) Suggested folder structure (non-breaking)

Create:
- `docs/phase1/` → only active Phase‑1 docs
- `docs/archive/phase1/` → old “final/analysis/todo” snapshots

No deletions required.










