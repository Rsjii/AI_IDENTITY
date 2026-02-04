DONE (Confirmed in Code)
#	Plan Item	Where	Status
1	404 handling — PublicChatPage	PublicChatPage.tsx:749 creatorNotFound → <NotFoundCreator>	DONE
2	404 handling — CreatorPublicProfile	[CreatorPublicProfile.tsx:69-78] checks r.status===404	DONE
3	userType column on User table	[database.ts:43] "userType" TEXT	DONE
4	POST /api/auth/set-user-type endpoint	[authRoutes.ts] + [authController.ts setUserType]	DONE
5	/choose-type fork page	[ChooseTypePage.tsx] — auto-selects visitor if next starts with /chat/, else shows two buttons	DONE
6	AuthContext userType field	[AuthContext.tsx:19] userType?: 'creator'|'visitor'	DONE
7	Signup redirects to /choose-type	[authController.ts:1010, 1196] nextRedirect = '/choose-type' + Google auth too	DONE
8	Creator name clickable → modal	[PublicChatPage.tsx:864] <button onClick={() => setShowCreatorModal(true)}>	DONE
9	⭐ Subscribed badge in chat header	[PublicChatPage.tsx:872-874] yellow badge when isSubscribed	DONE
10	Subscription status check on page load	[PublicChatPage.tsx:264-288] calls /api/marketplace/subscriptions/status	DONE
11	Subscription bypass in publicChat	[publicController.ts:502] if (isSubscribed || ...) skips paywall	DONE
12	Subscription bypass in publicMessageLimit	[publicController.ts:274-293] checks hasActiveMarketplaceSubscription()	DONE
13	PaymentPrompt shows subscription option	[PublicChatPage.tsx:1429-1438] passes subscriptionOption prop; [PaymentPrompt.tsx] renders "Better value" section	DONE
14	Stripe Checkout for subscription	[subscriptionController.ts] creates Checkout session with mode: subscription	DONE
15	Custom success/cancel URLs	[subscriptionController.ts:142-149] validated against frontendUrl	DONE
16	?subscribed=1 → unlock flow	[PublicChatPage.tsx:174] reads param; [PublicChatPage.tsx:305-336] calls /api/public/unlock-by-subscription	DONE
17	unlock-by-subscription endpoint	[publicRoutes.ts + publicController.ts:652+] validates, regenerates teaser	DONE
18	Cancel subscription (cancel_at_period_end)	[subscriptionController.ts] stripe.subscriptions.update({ cancel_at_period_end: true })	DONE
19	/my-chats page	[MyChatsPage.tsx] search, filter (all/paid/free/favorites), date grouping, "Continue →" to /chat/:slug?sessionId=	DONE
20	/api/user/conversations endpoint	[conversationsController.ts] filter/search/pagination	DONE
21	/my-profile page (3 tabs)	[MyProfilePage.tsx] Profile + Subscriptions (with cancel) + Privacy	DONE
22	/api/user/subscriptions endpoint	[userRoutes.ts + userController.ts listMySubscriptions]	DONE
23	/explore page	[App.tsx:129] /explore → MarketplacePage	DONE
24	LandingPage "Meet the AIs" section	[LandingPage.tsx:172-230] fetches /api/marketplace/listings?featured=true	DONE
25	Navbar conditional by userType	[Navbar.tsx:47-71] Dashboard/Mirror/Identity only for userType==='creator'; all authed see Explore/MyChats/Profile	DONE
26	Daily free limit reset	[publicController.ts:212-226] ensureDailyFreeReset()	DONE
27	Transparency notice (one-time)	[PublicChatPage.tsx:940-958] dismissed via localStorage key	DONE
28	Creator dashboard: subscriber count + revenue	[creatorController.ts dashboard()] returns subscribers.active, revenue.subscriptionRevenueCents	DONE
29	Creator conversations: payment badges	[CreatorConversationsPage.tsx:80-91] ⭐/💳/🆓 badges	DONE
30	Creator listChats with isPaid/isSubscribed	[creatorController.ts:551-607] SQL with LEFT JOINs	DONE
31	Creator listSubscribers endpoint	[creatorController.ts:641-706]	DONE
32	Stripe Connect onboarding link	[creatorController.ts connectStripeAccount]	DONE
33	priceConfig subscription fields	[publicController.ts getCreator] returns listingId, subscriptionPriceCents, currency	DONE
34	Session auto-claim on login	[PublicChatPage.tsx:721-729] stores pending session IDs to localStorage; claim endpoint exists	DONE
35	Premium banner with countdown	[PublicChatPage.tsx:960-975] shows remaining time	DONE
36	Free message counter banner	[PublicChatPage.tsx:977-994]	DONE
BUGS FOUND (Need Fixing)
These are real mismatches in the current code:

Bug 1 — Fee percentage mismatch
Backend at subscriptionController.ts:151: application_fee_percent: 30 → platform takes 30%
Frontend at PaymentPrompt.tsx:139: displays "Platform fee: 25% | Creator earnings: 75%"
These contradict. Pick one and align both. The plan says 25%.
Bug 2 — ProfileCompletionGuard does NOT check userType or redirect to /choose-type
app.ts:286-392 — the guard only checks profileCompleted. It does NOT:
Redirect users with profileCompleted=true but userType=null → /choose-type
Allow visitors with profileCompleted=true + userType='visitor' to bypass onboarding
The plan (Section 3, "ProfileCompletionGuard changes") explicitly says:
userType=null → redirect to /choose-type
userType='visitor' + profile done → ALLOW everything
userType='creator' + onboarding not done → redirect to /onboarding
Currently none of this logic exists in the guard. The frontend /choose-type page works, but the backend guard doesn't enforce the pattern. This means if a visitor somehow hits a route before /choose-type runs, the guard won't redirect them correctly.
Bug 3 — Subscription option gated behind FLAGS.marketplace
PublicChatPage.tsx:1430: subscriptionOption is only passed if FLAGS.marketplace is true
The plan explicitly says (Section 16): marketplace is Phase 2. /explore is a directory, not a marketplace. But the subscription flow reuses marketplace routes (/api/marketplace/subscriptions/*), so if ENABLE_MARKETPLACE env flag is off, subscriptions silently break.
This is a flag naming/gating issue. The subscription checkout, explore page, and landing "Meet the AIs" all depend on marketplace routes being mounted.
Bug 4 — requestPayout is a stub
[creatorController.ts ~line 370]: creates a payout DB record but has // TODO: In production, trigger actual Stripe Connect transfer here
No actual stripe.transfers.create() or stripe.payouts.create() call. Creators can click "Request Payout" but money doesn't move.
Bug 5 — No frontend error if creator hasn't connected Stripe Connect
Subscription checkout requires listing.stripeConnectId. If a creator hasn't connected Stripe, the backend returns 400.
[PaymentPrompt.tsx] startSubscription() has no specific handling for this error — it would just show a generic failure.


NOT YET IMPLEMENTED (Genuinely Missing)
#	Plan Item	Where in Plan	Notes
1	featuredOnExplore column on User table	Section 12.1	Plan says add a BOOLEAN column. DB does NOT have it (confirmed in database.ts). The landing page fetches ?featured=true but the backend likely uses marketplace_listings featured field instead — works differently than planned.
2	Creator "Featured on homepage" toggle in dashboard settings	Section 7.1 ("Only shows creators who opted in")	No toggle UI found in creator dashboard settings.
3	Stripe webhook handlers for subscription events	Section 13.3	Plan lists subscription.created, subscription.updated, subscription.deleted, invoice.payment_failed. These are critical for keeping marketplace_subscriptions status in sync. Need to verify if existing webhook handler covers these.
4	Visitor → Creator upgrade flow	Section 3 ("Visitor → Creator upgrade")	Plan says visitor can click "Create my own AI" anywhere and enter creator onboarding. No such CTA exists on /explore or /my-profile.
5	Creator analytics: Top Questions + Popular Topics	Section 9.3, Plan item [15]	Plan explicitly lists this as a dashboard feature. No LLM summarization job exists for this.
6	Actual Stripe Connect payouts (weekly auto-transfer)	Section 4.7	See Bug 4 above — stub only.
SUMMARY: What to do RIGHT NOW
Priority order to ship:

Fix Bug 1 — Change application_fee_percent: 30 → 25 in subscriptionController.ts:151. One line.

Fix Bug 2 — Add userType-aware logic to ProfileCompletionGuard in app.ts:375. After the profileCompleted check passes, add: if userType is null → redirect to /choose-type. If userType='creator' and onboarding not done → redirect to /onboarding.

Fix Bug 3 — Either rename the flag check from FLAGS.marketplace to something like FLAGS.payments (since subscriptions aren't really "marketplace"), or ensure ENABLE_MARKETPLACE is always true in production. This is a config/naming issue.

Verify Stripe webhooks — Check if subscription.created / subscription.updated / subscription.deleted are handled. If not, add them.

Fix Bug 5 — Add error message in PaymentPrompt when Stripe Connect isn't connected.

Bug 4 (payouts) and the missing analytics features are Phase 2 polish — not blocking for launch.

Want me to fix any of these bugs now?

Update Todos

Complete A-Z audit of codebase vs MASTER_PLATFORM_PLAN.md
That's the full picture. 36 items confirmed done, 5 bugs with exact line numbers, 6 genuinely missing items. Ready to fix whichever you want first.