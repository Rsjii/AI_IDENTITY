Codebase structure dekh raha hoon, phir ek clear implementation plan deta hoon.


[8 tools called]


Yeh raha step-by-step implementation plan:

## Implementation strategy

### Phase 1: Foundation (Day 1-2) — start yahan se

#### Step 1.1: Color scheme update (2-3 hours)
Pehle color system update karo — yeh base hai.

Files to update:
1. `frontend/react-app/tailwind.config.js` — new purple palette add karo
2. `frontend/react-app/src/index.css` — CSS variables update karo

Action plan:
```javascript
// tailwind.config.js mein yeh add karo:
colors: {
  // Dark mode backgrounds
  'bg-primary': '#0A0A0B',
  'bg-secondary': '#18181B',
  'bg-tertiary': '#27272A',
  'bg-elevated': '#3F3F46',
  
  // Purple accent (main brand color)
  'accent-primary': '#8B5CF6',
  'accent-hover': '#A78BFA',
  
  // Text colors
  'text-primary': '#FAFAFA',
  'text-secondary': '#A1A1AA',
  'text-tertiary': '#71717A',
  'text-muted': '#52525B',
  
  // Semantic colors
  'success': '#10B981',
  'error': '#EF4444',
  'warning': '#F59E0B',
  'info': '#3B82F6',
  
  // Borders
  'border-subtle': '#27272A',
  'border-default': '#3F3F46',
  'border-focus': '#8B5CF6',
},
backgroundImage: {
  'accent-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
}
```

#### Step 1.2: Test color scheme (30 mins)
- Dark mode toggle test karo
- All pages pe colors check karo
- Contrast ratio verify karo

---

### Phase 2: Onboarding flow polish (Day 2-3)

#### Step 2.1: Onboarding quiz redesign (4-5 hours)
File: `frontend/react-app/src/pages/OnboardingQuizPage.tsx`

Changes:
1. Full-screen modal layout
2. One question per screen (no scrolling)
3. Progress bar with gradient
4. Slide animations (200ms)
5. Visual question types (cards, sliders)

#### Step 2.2: Content upload page enhance (3-4 hours)
File: `frontend/react-app/src/pages/OnboardingContentPage.tsx`

Changes:
1. Better drag-drop zone
2. Real-time stats sidebar
3. File previews
4. Social media import buttons

---

### Phase 3: Dashboard enhancement (Day 3-4)

#### Step 3.1: Dashboard metrics cards (4-5 hours)
File: `frontend/react-app/src/pages/CreatorDashboardPage.tsx`

Add:
1. 4 large metric cards (top row)
2. Sparkline charts (recharts library)
3. Real-time counters
4. Tabbed analytics section

---

### Phase 4: AI prompt engineering (Day 4-5) — critical

#### Step 4.1: Multi-layer prompt system (6-8 hours)
Files:
- `backend/src/services/llmClient.ts`
- `backend/src/modules/public/publicController.ts`

Implement:
1. Layer 1: System identity (from quiz data)
2. Layer 2: RAG (knowledge base search)
3. Layer 3: Conversation memory
4. Layer 4: Task-specific instructions
5. Layer 5: Safety gates

---

## Recommended order (priority-wise)

### Week 1: UI/UX polish
```
Day 1: Color Scheme (Step 1.1-1.2)
Day 2: Onboarding Quiz (Step 2.1)
Day 3: Content Upload + Dashboard Cards (Step 2.2 + Step 3.1)
Day 4-5: Chat Interface Polish + Typography
```

### Week 2: AI power + forms
```
Day 1-2: Prompt Engineering (Step 4.1) - CRITICAL
Day 3-4: AI Personality Form (Advanced Settings)
Day 5: Payment UX improvements
```

### Week 3: Testing + launch prep
```
Day 1-2: Integration testing
Day 3: Analytics setup
Day 4-5: Final polish + beta testing
```

---

## Quick start commands

1. Color scheme update karo (pehle yeh):
```bash
cd frontend/react-app
# tailwind.config.js edit karo
# index.css edit karo
npm run dev  # test karo
```

2. Onboarding quiz check karo:
```bash
# OnboardingQuizPage.tsx open karo
# Current implementation dekh lo
# Phir redesign karo
```

3. Dashboard check karo:
```bash
# CreatorDashboardPage.tsx open karo
# Current metrics dekh lo
# Phir enhance karo
```

---

## Important notes

1. Pehle color scheme fix karo — baaki sab ispe depend karega
2. Test as you go — har change ke baad test karo
3. One feature at a time — parallel mat karo
4. Backend changes last mein — pehle frontend polish karo

Kya aap chahte ho ki main:
1. Pehle color scheme code de doon (tailwind.config.js + index.css)?
2. Ya onboarding quiz ka structure de doon?
3. Ya dashboard metrics cards ka code de doon?

Batao kahan se start karna hai.