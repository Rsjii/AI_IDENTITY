📊 CURRENT ISSUES IDENTIFIED
Issue A: Pricing Tab - Only Pay-Per-Chat
✗ Currently only has pay-per-chat configuration
✗ Missing: Earnings, Payouts, Billing History, Stripe Connect, Plan/Subscription management

Issue B: Account Tab - Duplicate/Common Sections
✗ After the 3 sub-tabs (Security/Earnings/Preferences), there are ADDITIONAL sections that appear for ALL sub-tabs:

Current Plan card (with upgrade options)
Stripe Connect section
Spending Dashboard
Billing History
Earnings & Payouts card
Email Notifications
A/B Testing (Scale plan)
Issue C: Account Tab UI - Poor Organization
✗ Too many unrelated things mixed together
✗ No clear separation between security, billing, and preferences
✗ Sub-tabs have content below them that isn't related to the sub-tab

Issue D: Marketplace Tab - Empty
✗ Just a simple card that redirects to /marketplace/manage
✗ No actual settings here

Issue E: Duplicates
✗ Appearance settings appear in MULTIPLE places
✗ Email notifications scattered across sections

🎯 PROPOSED SETTINGS STRUCTURE
FOR CREATORS (6 Main Tabs - Clean & Organized)

┌─────────────────────────────────────────────────────────────────┐
│                        SETTINGS                                  │
├─────────────────────────────────────────────────────────────────┤
│  Profile │ Billing │ Integrations │ Notifications │ Security │ Preferences
└─────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════╗
║  TAB 1: PROFILE (Public-Facing Info)                          ║
╚═══════════════════════════════════════════════════════════════╝
  
  📸 Basic Information
     • Profile Picture
     • Display Name
     • Bio/Description
     • Phone Number (optional)
     • Time Zone
  
  🔗 Social Links
     • Twitter
     • Instagram
     • YouTube
     • Website
  
  👁️ Profile Visibility
     • Public / Unlisted / Private
     • Show in Public Directory
     • Allow Search Engine Indexing

╔═══════════════════════════════════════════════════════════════╗
║  TAB 2: BILLING & PAYMENTS (All Money Matters)                ║
╚═══════════════════════════════════════════════════════════════╝
  
  💰 Earnings Overview (Top Summary Cards)
     • Total Earnings
     • Available Balance
     • Pending Balance
  
  💳 Payout Settings
     • Stripe Connect Status & Setup
     • Request Payout Button
     • Payout History
  
  💵 Pay-Per-Chat Configuration
     • Enable/Disable Pay-Per-Chat
     • Price Tiers ($1, $5, $10, $25, $50, Custom)
     • Default Tier Selection
     • Welcome Message
     • Popular Questions
     • Payment Trigger Rules (keywords, min length, always require)
  
  📊 Spending & Usage
     • Spending Dashboard (AI usage costs)
     • Usage Limits & Quotas
  
  📜 Billing History & Transactions
     • Transaction History Table
     • Export CSV
     • Date Range Filters
  
  🎁 Subscription & Plans
     • Current Plan (Free/Pro/Growth/Scale)
     • Plan Features Comparison
     • Upgrade/Downgrade Options
     • Trial Status (if applicable)

╔═══════════════════════════════════════════════════════════════╗
║  TAB 3: INTEGRATIONS (Third-Party Connections)                ║
╚═══════════════════════════════════════════════════════════════╝
  
  🔌 Connected Services
     • API Keys & Webhooks
     • Third-party App Connections
     • OAuth Applications
  
  🧪 A/B Testing (Scale Plan Only)
     • Variant Groups
     • Create New Variants
     • Variant Metrics & Performance

╔═══════════════════════════════════════════════════════════════╗
║  TAB 4: NOTIFICATIONS (All Notification Preferences)          ║
╚═══════════════════════════════════════════════════════════════╝
  
  📧 Email Notifications
     • New Messages
     • Payment Received
     • Weekly Summary Report
     • System Updates
     • Marketing Communications
  
  🔔 Push Notifications (Future)
     • Browser Notifications
     • Mobile Notifications

╔═══════════════════════════════════════════════════════════════╗
║  TAB 5: SECURITY (Account Protection)                         ║
╚═══════════════════════════════════════════════════════════════╝
  
  📧 Email & Phone
     • Email Address (read-only, contact support to change)
     • Phone Number (for recovery)
  
  🔑 Password Management
     • Change Password (if password exists)
     • Set Password via OTP (if Google-only login)
     • Password Strength Requirements
  
  🔗 Connected Accounts
     • Google Account Status
     • Connect/Disconnect Google
  
  📱 Active Sessions (Future Enhancement)
     • List of active login sessions
     • Device info, location, last active
     • Revoke sessions
  
  🛡️ Two-Factor Authentication (Future)
     • Enable 2FA
     • Backup Codes

╔═══════════════════════════════════════════════════════════════╗
║  TAB 6: PREFERENCES (Personal Settings & Danger Zone)         ║
╚═══════════════════════════════════════════════════════════════╝
  
  🎨 Appearance
     • Theme: Light / Dark / Auto
     • Language (English, Spanish, French, German - coming soon)
     • Date Format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
     • Time Format (12h / 24h)
  
  ♿ Accessibility
     • High Contrast Mode
     • Reduce Animations
     • Larger Text
  
  🔒 Privacy
     • Allow Analytics Tracking
     • Cookie Preferences
  
  🚨 DANGER ZONE
     • Export All Account Data (ZIP download)
     • Delete Account Permanently (with OTP confirmation)
FOR END-USERS (4 Main Tabs - Simplified)

┌─────────────────────────────────────────────────────────────────┐
│                        SETTINGS                                  │
├─────────────────────────────────────────────────────────────────┤
│     Profile  │  Notifications  │  Security  │  Preferences       │
└─────────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════╗
║  TAB 1: PROFILE (If User Has Public Profile)                  ║
╚═══════════════════════════════════════════════════════════════╝
  
  📸 Basic Information
     • Profile Picture (optional)
     • Display Name
     • Bio (optional)
  
  👁️ Profile Visibility
     • Public / Private
     • Show in Directory

  NOTE: If end-user doesn't have public-facing profile, 
        skip this tab entirely or show minimal info

╔═══════════════════════════════════════════════════════════════╗
║  TAB 2: NOTIFICATIONS                                          ║
╚═══════════════════════════════════════════════════════════════╝
  
  📧 Email Notifications
     • New Messages from Creators
     • System Updates
     • Weekly Activity Summary
     • Marketing Communications

╔═══════════════════════════════════════════════════════════════╗
║  TAB 3: SECURITY (Account Protection)                         ║
╚═══════════════════════════════════════════════════════════════╝
  
  📧 Email & Phone
     • Email Address (read-only)
     • Phone Number (optional, for recovery)
  
  🔑 Password Management
     • Change Password
     • Set Password (if Google-only login)
  
  🔗 Connected Accounts
     • Google Account Status
     • Connect/Disconnect
  
  📱 Active Sessions (Future)
     • View and manage active login sessions

╔═══════════════════════════════════════════════════════════════╗
║  TAB 4: PREFERENCES (Personal Settings & Account)             ║
╚═══════════════════════════════════════════════════════════════╝
  
  🎨 Appearance
     • Theme: Light / Dark / Auto
     • Language
     • Date/Time Format
  
  ♿ Accessibility
     • High Contrast
     • Reduce Animations
     • Larger Text
  
  🔒 Privacy
     • Allow Analytics
     • Cookie Preferences
  
  🚨 DANGER ZONE
     • Export Account Data
     • Delete Account
📋 COMPARISON TABLE: WHAT GOES WHERE
Feature/Section	Current Location	New Location (Creator)	New Location (End-User)
Profile Picture, Name, Bio	Profile tab	Profile tab	Profile tab
Social Links	Profile tab	Profile tab	❌ N/A
Phone Number	Account > Security	Security tab	Security tab
Profile Visibility	Account > Preferences	Profile tab	Profile tab
Pay-Per-Chat Settings	Pricing tab	Billing tab	❌ N/A
Earnings & Payouts	Account tab (after sub-tabs)	Billing tab	❌ N/A
Stripe Connect	Account tab (after sub-tabs)	Billing tab	❌ N/A
Current Plan & Upgrades	Account tab (after sub-tabs)	Billing tab	❌ N/A
Billing History	Account tab (after sub-tabs)	Billing tab	❌ N/A
Spending Dashboard	Account tab (after sub-tabs)	Billing tab	❌ N/A
Email Notifications	Account tab (after sub-tabs)	Notifications tab	Notifications tab
Weekly Summary	Account tab (after sub-tabs)	Notifications tab	Notifications tab
Password Management	Account > Security	Security tab	Security tab
Connected Accounts	Account > Security	Security tab	Security tab
Active Sessions	Account > Security	Security tab	Security tab
Privacy Settings	Account > Preferences	Preferences tab	Preferences tab
Appearance Settings	Account > Preferences	Preferences tab	Preferences tab
Accessibility	Account > Preferences	Preferences tab	Preferences tab
Export Data	Account > Preferences	Preferences tab (Danger Zone)	Preferences tab (Danger Zone)
Delete Account	Account > Preferences	Preferences tab (Danger Zone)	Preferences tab (Danger Zone)
API Keys	Integrations tab	Integrations tab	❌ N/A
A/B Testing	Account tab (after sub-tabs)	Integrations tab	❌ N/A
Marketplace Listing	Marketplace tab	❌ Remove (keep in separate /marketplace route)	❌ N/A
Search Engine Indexing	Account > Preferences	Profile tab	Profile tab
Public Directory	Account > Preferences	Profile tab	Profile tab
Allow Analytics	Account > Preferences	Preferences tab (Privacy)	Preferences tab (Privacy)
🎨 UI/UX DESIGN PRINCIPLES (Reference: Stripe, GitHub, Notion)
Layout Structure

┌─────────────────────────────────────────────────────────────┐
│  HEADER: Settings                                            │
├─────────────────────────────────────────────────────────────┤
│  [Profile] [Billing] [Integrations] [Notifications] [Security] [Preferences]
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  CARD TITLE                                           │  │
│  │  Brief description of what this section controls     │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                       │  │
│  │  Form fields, toggles, inputs...                     │  │
│  │                                                       │  │
│  │              [Cancel]  [Save Changes]                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  NEXT CARD TITLE                                      │  │
│  │  ...                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
Best Practices
Flat Hierarchy - NO sub-tabs, just cards within tabs
Clear Sections - Each card = one logical group
Individual Save Buttons - Each card has own save (no global save)
Visual Separation - Clear spacing between cards
Contextual Help - Brief descriptions under section titles
Progressive Disclosure - Show advanced options on expand
Danger Zone at Bottom - Destructive actions always last
Status Indicators - Show connected/disconnected states clearly
Loading States - Skeleton loaders for async data
Success Feedback - Toast notifications + checkmark on save
🚀 KEY IMPROVEMENTS
✅ What Gets Fixed
No More Pricing Tab - All money stuff consolidated in "Billing & Payments"
No More Marketplace Tab - Keep marketplace management in separate route
No More Account Sub-tabs - Flat structure with Security/Preferences as main tabs
No More Duplicates - Appearance settings in ONE place (Preferences)
Logical Grouping - All notifications together, all security together
Cleaner UI - Stripe, GitHub-style card layouts
Better UX - Each section independently saveable
📊 Tab Count Reduction
Creator: 5 tabs → 6 tabs (BUT better organized, no sub-tabs!)
End-User: 2 tabs → 4 tabs (clearer separation of concerns)
💡 FINAL RECOMMENDATIONS
Remove Entirely
❌ Marketplace tab (keep as separate route /marketplace/manage)
❌ Sub-tabs in Account section (flatten to main tabs)
Consolidate
✅ Pricing + Earnings + Billing → Billing & Payments tab
✅ Email notifications → Notifications tab
✅ Appearance + Privacy → Preferences tab
✅ Password + Sessions → Security tab
Separate
✅ A/B Testing → Move from Account to Integrations tab
✅ Profile visibility → Move from Account to Profile tab
This structure follows industry best practices from Stripe, GitHub, Notion, and Linear while being clean, intuitive, and role-appropriate for both creators and end-users!