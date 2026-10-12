# Stitch: Product and Platform Plan

This document sets out what Stitch is, where it stands today, and how it grows into a fully launched product on its own domain and in the Play Store and App Store. Montserrat is the main product font, used together with Colmeak and Inter where they are already in use.


## 1. Vision

Stitch is a community app for students that brings social networking, study and career building into one place. Creators such as lecturers, strong students and tutors can also earn money by teaching on it.

**Who it is for**
- First: university students in Ghana
- Next: students across West Africa, then Africa
- Later: any student community that wants one trusted place to learn, connect and find work

**What makes it different**
- Study, social and career in one app instead of several
- Creators can earn from their knowledge
- Built for Ghana first: Mobile Money, cedis (GHS) and careful data use

**Goals**
- Become the first app a student opens each day
- Let creators earn real money
- Help students land internships, jobs and scholarships
- Stay safe, trusted and fast on an ordinary phone and network


## 2. Current State

**What already exists**
- Accounts: sign-up, onboarding, public profiles, private accounts, connection requests
- Social: feed, posts, comments, likes, reposts, saves, glimpses
- Chat: direct messages, collaboration chats, meeting and lecture chats, voice notes, voice and video calls
- Study: classes, invites, submissions, meetings, AI class (Stitch Bot), courses, quizzes, multiplayer challenges
- Career: opportunities, internships, scholarships, applications, subscriptions, Match with CV
- Verification: ID and selfie checks for people who post opportunities
- Creators: paid courses and classes, wallet, Mobile Money withdrawals, 20% platform fee
- Admin: reports, payouts, alerts, audit log
- Platform: push notifications, emails, daily digest, PostHog analytics, Sentry error tracking
- Safety: account deletion, reviewer test account

**How it is built**
- Front end: plain HTML, CSS and JavaScript, no build step, no framework
- Hosting: Vercel (temporary)
- Backend: Supabase, Postgres 17, London region (eu-west-2)
- Database: about 65 tables, all with row-level security
- Edge functions: 20
- Payments: Paystack
- History: close to 100 migrations of security and feature work


## 3. Findings From the Code and Database Review

**Vercel is built into the project**
- The Vercel address appears in index.html (canonical link, social sharing tags), sitemap.xml and robots.txt
- Security headers live in vercel.json, which only Vercel reads
- Share links for classes and profiles use stitch.app, which must be owned or replaced

**Web app setup is incomplete**
- A service worker exists but there is no web app manifest
- The service worker only caches the offline page and user media

**Calls are not production-ready**
- Calls use free public relay (TURN) servers and peer-to-peer connections
- They will fail on some networks and group calls will not scale

**Code is hard to maintain**
- courses.js and jobs.js are about 10,000 lines each
- chat.js is about 8,500 lines and styles.css is nearly 4,000
- games.js still holds demo values (points, streak, coins) and old mini-game code
- Referral and game tables are still in the database

**Fonts and security rules are scattered**
- The app uses Montserrat, Colmeak and Inter together, and some fonts load from Google at run time
- The content security policy lives in both vercel.json and index.html

**Very little real data so far**
- Most tables are empty or hold a handful of rows
- This is the best time to clean up and restructure


## 4. Moving From Vercel to a Domain and Proper Hosting

**Step 1: Get the domain**
- Pick a short, easy-to-spell name and check it on both app stores and the main social platforms
- A .com is safest for trust, a .app suits an application, a .com.gh adds local credibility
- Own more than one and redirect the others
- Register under the company or a secured product lead account with two-step login and auto-renew

**Step 2: Plan the addresses**
- Main domain: landing page
- app subdomain: the web app
- api subdomain: custom domain for Supabase, so users never see a supabase.co address
- links address: share and deep links
- status subdomain: public status page
- Mailboxes: hello, support, noreply

**Step 3: Choose the host**
- Recommended: Cloudflare Pages with Cloudflare DNS (fast across Africa, generous free tier, attack protection)
- Alternative: Netlify
- Option for later: a self-managed server behind a CDN, if control or cost requires it
- Keep Supabase as the backend

**Step 4: Rebuild what Vercel handled**
- Security headers: no framing, no content sniffing, strict HTTPS, referrer policy, permissions policy, content security policy
- Caching: long cache for scripts and images, never cache index.html, sw.js and offline.html
- Redirects: www to non-www, http to https, old Vercel address to the new one
- A proper 404 page
- Updated content security policy for the new domain, the Supabase custom domain, Paystack, Sentry and PostHog

**Step 5: Migrate safely**
- Set up a copy on a test address and test login, Google and Apple sign-in, payments, push, uploads and calls
- Update the Supabase auth redirect URLs
- Update Google and Apple sign-in settings
- Update Paystack callback and webhook URLs
- Update allowed domains in Sentry and PostHog
- Switch DNS in a quiet period
- Keep the old Vercel site as a redirect for a few weeks
- Submit the new sitemap to Google


## 5. Play Store and App Store

**Approach**
- Wrap the existing web app in a native shell using Capacitor
- Keeps almost all current code and adds real native features
- Rebuild individual screens natively later where it matters

**Native features needed (a plain website in a frame risks rejection)**
- Native push notifications (Firebase on Android, Apple's service on iPhone)
- Proper camera, microphone and photo access
- System share sheet
- Deep links that open the app from a Stitch link
- Safe areas, notches and the Android back button
- Optional biometric lock
- Clear offline screen
- Native splash screen and icon

**Requirements for both stores**
- Privacy policy and terms of service on our own domain
- Support page and contact email
- In-app account deletion plus a web page to request deletion
- Reporting and blocking of user content
- A described moderation process
- Accurate age rating and data-collection form
- A working reviewer account
- Screenshots, descriptions and keywords

**Store-specific notes**
- Apple: Sign in with Apple is required because Google login is offered (already in place); developer account is about 99 USD per year
- Google: developer account is about 25 USD once; new accounts may need a closed test with real testers before production, so check the current rule

**The key decision: payments inside the apps**
- Stitch sells digital products: paid courses, class access and career subscriptions
- Both stores require digital content sold in-app to use their own billing, and take roughly 15% to 30%
- Using Paystack in-app for these products could cause rejection or removal
- Together with the 20% creator fee, store cuts could leave creators with too little

Options:
- Option 1: store billing in the apps, Paystack on the web, and adjust prices or the creator fee
- Option 2: sell courses on the web only, apps show content people already own
- Option 3: Paystack in the apps only for real-world services, after careful review

Decide this before building the store versions, after checking the current store rules.

**Release process**
- Internal testing, then wider beta, then production
- Version number increases with each release
- Web-layer fixes can ship without a store review; native changes need a new store release
- Record a minimum supported app version in the backend to force very old versions to update


## 6. Design System

- Fonts: Montserrat is the main font (weights 400 to 800), used together with Colmeak and Inter where they are already in use; keep the current font choices as they are
- Ship all font files inside the app so they load reliably in the store apps and on slow networks
- Brand colour: blue gradient from dodger blue to royal blue on primary buttons
- Modes: light and dark; the current dark mode stays as it is, and charts keep their original colours
- Menus and panels pull up from the bottom and slide down slowly when dismissed
- Icons on panels are grey only
- Bottom actions in flows are two floating pills: white Back and blue-gradient Continue, with no panel behind them
- Titles: right-aligned on New post, Posts and My glimpse; centred on Match with CV
- Language is plain and friendly; chart descriptions use everyday words
- Touch targets sized for thumbs, enough contrast, respect for larger system text


## 7. Backend Plan

**Already in place**
- Tables for users, social, classes, meetings, courses, challenges, career, money, admin and system data
- 20 edge functions covering AI, email, push, payments, verification, admin and the test account
- Scheduled cleanup jobs
- Private storage for sensitive files

**Before launch**
- Separate production, staging and development environments
- Keep every migration in the code repository so any environment can be rebuilt
- Upgrade the Supabase plan for daily backups, point-in-time recovery, no pausing and better limits
- Set a spend cap and usage alerts
- Test a backup restore at least once
- Set up a custom domain for the backend
- Check speed from Ghana and consider caching or a closer region
- Add rate limits for login, codes, messages, uploads, reports and AI use
- Set up SPF, DKIM and DMARC so verification emails reach inboxes
- Update auth settings: redirect addresses, email templates, code expiry
- Archive then remove unused referral, game and old backup tables
- Check indexes and slow queries with thousands of test users and posts
- Add alerts for repeated edge function failures

**Tools Supabase already provides for later**
- Message queue for reliable push and email
- Text search for people, classes, courses and jobs
- Scheduled jobs for digests and reminders


## 8. Calls, Meetings and Realtime

- Move to an owned or paid relay service first (cheapest, most urgent fix)
- Adopt a managed media server (such as LiveKit) for group calls, class meetings and lectures
- Admin controls: mute everyone, remove participants, lock a meeting
- Weak-network support: automatic reconnection, audio-only fallback, low-data mode
- Rebuild the call screens for classes, messaging and meetings with one consistent design
- Recording is not planned now and would need a consent flow and storage rules first


## 9. Money

**Current setup**
- Paystack for card and Mobile Money collections and payouts
- Wallet ledger records every cedi in and out
- 20% creator fee, GHS 50 minimum withdrawal
- Payouts to MTN, Telecel or AirtelTigo Mobile Money
- Safeguards: server-side price checks, payout cooldown and hold, admin approval, audit log

**Still to plan**
- Refund and dispute process: who decides, how long it takes, what the creator sees
- Fraud controls: multiple accounts, stolen cards, fake courses
- Creator verification before the first payout
- Receipts and statements for creators
- Company, bank account and tax setup with professional advice
- The store billing decision from section 5
- Other currencies and countries (Nigeria, Kenya) once Ghana works
- Daily reconciliation of the wallet ledger against Paystack


## 10. Safety, Privacy and Trust

**Protecting users**
- Reporting, blocking and muting
- Moderation queue for administrators
- Fast removal of harmful posts and glimpses
- Verified posters for career opportunities
- Visible scam warnings
- Clear community guidelines page

**Protecting data**
- Register with Ghana's Data Protection Commission and comply with the Data Protection Act, 2012 (Act 843); consider GDPR if European users join
- Decide the minimum age (some first-year students are 17 or younger) and enforce it at sign-up
- Collect only necessary data and keep private files in private storage
- Keep the privacy policy short, clear and accurate
- Hide private screens (chat, calls, ID checks, payouts, CVs) from analytics and session recordings
- Remove personal details from error reports

**Protecting the system**
- Two-step login for all administrator accounts
- Secrets kept only in the backend and rotated regularly and when someone leaves
- Periodic review of row-level security and edge functions
- Outside penetration test before the main launch
- Written incident plan: who is told, who fixes it, how users are informed


## 11. Performance and Low-Data Use

- Compress images before upload and serve several sizes
- Process videos into multiple qualities and stream them
- Load every list a page at a time
- Split the large JavaScript files so the first screen appears quickly
- Cache safe content for offline reading
- Low-data mode: no autoplay, lower image quality
- Measure performance on a cheap Android phone, not only a recent one


## 12. Growth and Analytics

**Growth**
- Landing page with sign-up and store links
- Campus ambassadors at each university
- Launch campus by campus, starting with one, so the community feels active
- Seed the app with strong creators and genuine opportunities first
- Deep links so shared classes, profiles and posts open the app
- Notifications and daily digest with user controls

**What PostHog should track**
- Funnel: sign-up, onboarding completed, first connection, first post, first class joined, first purchase
- Key numbers: new users, onboarding completion, daily active users, 7-day and 30-day return, posts and messages per user, creator earnings, payment success rate, crash-free sessions


## 13. Roadmap

Each phase must pass its exit check before the next begins.

**Phase 0: Stabilise**
- Complete call screens and chart descriptions, remove leftover code, fix the test account
- Exit check: no known bugs in main flows on a real phone

**Phase 1: Domain and hosting**
- Buy the domain, move hosting, set up email, update all links and settings
- Exit check: app runs fully on the new domain and the old address redirects

**Phase 2: Backend ready**
- Separate environments, backups, paid plan, custom backend domain, owned call relay, rate limits
- Exit check: restore test and load test both pass

**Phase 3: Legal, business and money**
- Company registration, data protection registration, privacy policy and terms, payout and refund processes, store billing decision
- Exit check: all legal pages live and payment model decided

**Phase 4: Mobile apps**
- Capacitor shell, native push, deep links, icons, splash screens, bundled fonts, store assets
- Exit check: internal testers use both apps for a week without blockers

**Phase 5: Store submission and beta**
- Google closed test, Apple TestFlight, review feedback, submission
- Exit check: both stores approve

**Phase 6: Launch**
- Single campus, ambassadors, daily monitoring
- Exit check: healthy return rates and low crashes for several weeks

**Phase 7: Grow**
- More campuses, more creators, more countries, larger group calls, better recommendations

**Phase 8: Long term**
- See section 14


## 14. Long-Term Direction

**Product**
- Personalised feed and recommendations
- Official campus and department spaces for universities and student unions
- Study groups, timetables and exam countdowns
- Library of past questions and course resources
- Live classes with whiteboards, recordings and certificates
- Creator tools: analytics, coupons, bundles, subscriptions, affiliates
- Mentorship and alumni network
- Employer accounts with verified companies and talent search
- Stronger CV tools: CV builder and interview practice with the AI class
- Scholarship tracker with deadline reminders
- Marketplace for tutoring and student services
- Wallet features for payments between students
- Multiple languages: English first, then local languages and French

**Platform**
- Move to a build system such as Vite and split the code into modules
- Adopt TypeScript step by step
- Automated tests and a release pipeline
- Separate administrator dashboard application
- Public API for partners and universities
- Background workers for video processing, notifications and search
- AI class that is course-aware, safer for moderation support and useful for platform-wide search
- Decide later whether to rebuild the apps fully native or stay on Capacitor, using real performance data

**Business**
- Income from creator fees, career subscriptions, employer listings, clearly labelled sponsored opportunities and university partnerships
- Ads and sponsorship must never look like ordinary posts
- Hiring order: developer, designer, community and support lead, moderator, marketing


## 15. Costs to Plan For

Collect real prices when each decision is made.

- Domain (yearly)
- Apple developer account (about 99 USD per year) and Google Play account (about 25 USD once)
- Paid Supabase plan and extra usage (storage, bandwidth, edge function calls)
- Hosting and CDN
- Call relay and group call service
- Video storage and streaming
- Email and SMS sending
- Push notification services
- AI usage for the AI class
- Monitoring tools as usage grows
- Paystack fees, always clear to the payer
- Verification services for poster ID
- Company registration, legal and accounting
- Security testing
- Support and moderation staff


## 16. Principal Risks

- **Store rejection:** from payment rules or an app that feels like a website; decide billing early and add real native features
- **Data leak:** one mistake in row-level security could expose private data; review every new table
- **Scams:** fake jobs and fake courses can destroy trust; keep verification, reporting and fast removal strong
- **Calls failing:** fix the relay servers before launch
- **Runaway infrastructure cost:** set spend caps and alerts from day one
- **Empty app:** a social product cannot survive it; launch campus by campus
- **Losing the domain or key accounts:** use company accounts with two-step login, not personal ones
- **Dependence on one person:** document everything so any team member can continue


## 17. Open Decisions

- Final name and domain
- Hosting provider
- Payment model inside the store apps
- Minimum age
- First campus and launch date
- Whether the AI class stays free with usage caps or becomes a paid feature
- Which countries follow Ghana
- Who handles moderation and support at launch
