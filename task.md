# Stitch: Tasks

This is the full task list, from the start until the future. Tick the box when a task is done. Phases match `planning.md`.

How to read it:
- [x] done
- [ ] not done yet
- Tasks marked **(decision)** need a choice from the product lead before work can start.


## Already done (the build so far)

### Accounts and profiles
- [x] Sign up and login (email code, Google, Apple)
- [x] Onboarding with Back and Continue floating pills
- [x] Public profiles, profile photos, pronouns
- [x] Private accounts and connection requests
- [x] Profile views
- [x] Account deletion (app and backend)
- [x] Cleanup of sign-ups that never finish onboarding

### Social
- [x] Feed with posts, likes, reposts, saves, shares, views
- [x] Comments, replies and reactions
- [x] Glimpses (stories) with seen tracking
- [x] Glimpse menu: Share to network, Report, Repost to my glimpse
- [x] Feed videos play with sound and autoplay in view
- [x] Reports for posts and glimpses reaching admins

### Chat and calls
- [x] Inbox with General, Collaborations, Meetings, Requests
- [x] Direct messages, glimpse replies, pending DMs
- [x] Voice and video calls (first version)
- [x] Voice notes
- [x] Collaboration chats
- [x] Meetings, meeting chat, lecture chat, reminders

### Study and learning
- [x] Classes, invites, join by code, class chat
- [x] Class submissions and class reports
- [x] AI class (Stitch Bot) with free usage caps
- [x] Courses and course self-report
- [x] Quizzes and multiplayer challenges
- [x] Study space

### Career
- [x] Opportunities, internships, scholarships, others
- [x] Applications and private application documents
- [x] Poster ID and selfie verification
- [x] Career subscriptions and cancel reasons
- [x] Match with CV
- [x] Automatic cleanup of expired opportunities

### Creators and money
- [x] Creators can make paid courses and classes
- [x] Server-side price rules
- [x] Wallet ledger, payouts, withdrawals, 20% fee, minimum GHS 50
- [x] Payout cooldown and hold, admin approval
- [x] Paystack payments with verification and webhook
- [x] Admin audit log and critical alerts

### Platform
- [x] Push notifications, email, daily digest
- [x] PostHog analytics and Sentry error tracking
- [x] Reviewer/test account (backdoor closed)
- [x] Security hardening rounds, private storage buckets
- [x] Speed work: indexes, pagination, RLS tuning
- [x] Removed referrals and mini-games from the code


## Phase 0: Clean up and stabilise (now)

### Finish what is in progress
- [ ] Check every screen in the current dark mode, including popups, menus, loading screens and splash, and fix anything that looks wrong
- [ ] Add plain-language chart descriptions to My Activity
- [ ] Add plain-language chart descriptions to Course analytics
- [ ] Add plain-language chart descriptions to Career analytics
- [ ] Add plain-language chart descriptions to Space profile and Space report
- [ ] Rebuild the call screens for classes, messaging and meetings
- [ ] Let admins mute everyone in group calls, class meetings and meetings
- [ ] Replace the plain "T" with a custom text-button icon
- [ ] Make sure the test account never shows other people's data

### Fonts
- [ ] Keep Montserrat, Colmeak and Inter as they are used today
- [ ] Bundle the Montserrat, Colmeak and Inter font files with the app instead of loading them from Google

### Code cleanup
- [ ] Remove leftover game code and demo values (points, streak, coins) from `games.js`
- [ ] Move the sign-in and entry code out of `games.js` into its own file
- [ ] Plan the split of the large files: `courses.js`, `jobs.js`, `chat.js`, `feed.js`, `overlays.js`, `styles.css`
- [ ] Remove unused styles and old comments
- [ ] Put the project in a git repository with a clear folder layout

### Database cleanup
- [ ] Decide what to do with the referral and game tables (archive, then drop)
- [ ] Remove old backup tables that are no longer needed
- [ ] Re-check RLS on every table
- [ ] Re-run the Supabase security and performance advisor and fix what it finds

### Test on real devices
- [ ] Test the full app on a cheap Android phone
- [ ] Test the full app on an iPhone
- [ ] Test on slow and unstable networks
- [ ] Test sign-in with Google and Apple
- [ ] Test push notifications on both phones


## Phase 1: Domain and hosting

- [ ] **(decision)** Choose the final product name and domain
- [ ] Check the name on Play Store, App Store, Instagram, X, TikTok and LinkedIn
- [ ] Buy the domain under the company or product lead account with 2-step login and auto-renew
- [ ] Buy matching domains and redirect them (for example `.com.gh`)
- [ ] **(decision)** Choose the host (Cloudflare Pages is the recommendation)
- [ ] Set up DNS and the subdomains: app, api, links, status
- [ ] Set up business email: hello@, support@, noreply@
- [ ] Set up SPF, DKIM and DMARC so emails land in inboxes
- [ ] Rebuild the security headers from `vercel.json` on the new host
- [ ] Rebuild cache rules (long cache for scripts and images, never cache index.html, sw.js, offline.html)
- [ ] Set up redirects: www, http to https, old Vercel address
- [ ] Add a proper 404 page
- [ ] Replace the Vercel address in `index.html` (canonical, social sharing tags), `sitemap.xml` and `robots.txt`
- [ ] Make share links (class join, profiles) use the real domain
- [ ] Update the content security policy with the new addresses and keep it in one place
- [ ] Add a web app manifest file (name, icons, colours, start address)
- [ ] Update the service worker for the new host
- [ ] Update Supabase auth redirect URLs
- [ ] Update Google and Apple sign-in settings
- [ ] Update Paystack callback and webhook URLs
- [ ] Update allowed domains in Sentry and PostHog
- [ ] Test everything on a staging address
- [ ] Switch DNS in a quiet hour
- [ ] Keep Vercel as a redirect for a few weeks, then shut it down
- [ ] Submit the sitemap to Google Search Console
- [ ] Make a simple public landing page and a status page


## Phase 2: Backend ready for launch

### Environments and safety
- [ ] Create a staging Supabase project and a development one
- [ ] Put every migration in git so any environment can be rebuilt
- [ ] Write the steps to deploy edge functions and migrations
- [ ] Upgrade the Supabase plan (backups, point-in-time recovery, no pausing)
- [ ] Set the Supabase spend cap and usage alerts
- [ ] Test restoring a backup
- [ ] Set up the custom domain for Supabase (api.yourdomain.com)
- [ ] Measure speed from Ghana and decide if the region needs to change

### Protection
- [ ] Add rate limits: login, codes, messages, uploads, AI, reports
- [ ] Add spam and abuse detection on posts and messages
- [ ] Turn on 2-step login for every admin account
- [ ] List every secret and key, move them to safe storage, rotate them
- [ ] Review every edge function for who is allowed to call it
- [ ] Order an outside security test

### Calls and realtime
- [ ] Replace the free public relay servers with our own or a paid relay
- [ ] **(decision)** Choose a group call service (LiveKit or similar)
- [ ] Move class meetings and lectures to the group call service
- [ ] Add reconnect, audio-only fallback and low-data mode
- [ ] Load test chat, feed and calls with many fake users

### Reliability
- [ ] Move push and email sending to a queue with retries
- [ ] Set up alerts for failures in edge functions, payments and scheduled jobs
- [ ] Make a simple status page and an incident checklist
- [ ] Add search for people, classes, courses and jobs that works with typos

### Media
- [ ] Compress images on upload
- [ ] Make several sizes of each image
- [ ] Process feed videos into smaller versions and stream them
- [ ] Set limits on file size and type
- [ ] Set storage cleanup for deleted accounts and old files


## Phase 3: Legal, business and money

- [ ] Register the company
- [ ] Open a business bank account
- [ ] Set up tax details and get accounting help
- [ ] Register with Ghana's Data Protection Commission
- [ ] Write the privacy policy, terms of service and community guidelines
- [ ] Put the legal pages on our own domain
- [ ] **(decision)** Choose the minimum age and enforce it at sign-up
- [ ] **(decision)** Decide how payments work inside the store apps (store billing, web only, or a mix)
- [ ] Update creator prices or fee if store cuts apply
- [ ] Write the refund and dispute process
- [ ] Add creator verification before the first payout
- [ ] Add receipts and statements for creators
- [ ] Add daily matching between the wallet ledger and Paystack
- [ ] Write the moderation process: who reviews reports, how fast, what happens next
- [ ] Hire or assign moderators and a support contact
- [ ] Write the copyright and takedown process


## Phase 4: Mobile apps

- [ ] Create the Apple developer account and the Google Play developer account (company name)
- [ ] Set up the Capacitor project for Android and iPhone
- [ ] Add app icons, splash screens and adaptive icons
- [ ] Bundle the fonts (Montserrat, Colmeak, Inter) and all scripts inside the app
- [ ] Add native push notifications (Firebase and Apple)
- [ ] Add deep links so Stitch links open the app
- [ ] Add native share sheet, camera, microphone and photo picker
- [ ] Handle safe areas, notches, keyboard and the back button on Android
- [ ] Add an offline screen and clear error messages
- [ ] Add app version checks and a forced update message
- [ ] Add optional biometric lock
- [ ] Make sure account deletion and block work inside the app
- [ ] Prepare the reviewer account for both stores
- [ ] Set up automatic builds for test versions
- [ ] Internal testing with a small group on both phones for at least a week


## Phase 5: Store submission and beta

- [ ] Write the store listing: name, short and long description, keywords
- [ ] Make screenshots for phones and tablets
- [ ] Make a short preview video
- [ ] Fill in the age rating
- [ ] Fill in the data safety form (Google) and privacy details (Apple) exactly as the app behaves
- [ ] Add the privacy policy, support and account deletion links
- [ ] Run the Google closed test with enough real testers
- [ ] Run TestFlight with testers on iPhone
- [ ] Collect feedback and fix blockers
- [ ] Submit to both stores
- [ ] Fix any review feedback and resubmit
- [ ] Prepare a launch day plan and a rollback plan


## Phase 6: Launch

- [ ] **(decision)** Choose the first campus and the launch date
- [ ] Recruit campus ambassadors
- [ ] Seed good creators, real opportunities and starter content
- [ ] Set up the waitlist and invite flow
- [ ] Announce on social media and campus groups
- [ ] Watch dashboards every day: sign-ups, crashes, payment success, call success, reports
- [ ] Answer every support message quickly
- [ ] Hold a weekly review: what broke, what users asked for, what to fix first
- [ ] Collect user feedback inside the app


## Phase 7: Grow

- [ ] Open more campuses one at a time
- [ ] Add campus and department spaces
- [ ] Add a personalised feed
- [ ] Improve notifications with user controls
- [ ] Add creator tools: analytics, coupons, bundles, subscriptions
- [ ] Add employer accounts and verified companies
- [ ] Add scholarship tracker and deadline reminders
- [ ] Add past questions and resource library
- [ ] Add multiple languages
- [ ] Expand to other countries and currencies
- [ ] Add SEO pages for public courses, opportunities and creators


## Phase 8: Long term

- [ ] Move the web code to a build system (Vite) and split it into modules
- [ ] Add TypeScript step by step
- [ ] Add automated tests and a release pipeline
- [ ] Build a separate admin dashboard
- [ ] Build a public API for partners and universities
- [ ] Move heavy jobs (video, search, notifications) to background workers
- [ ] Improve the AI class: course-aware tutoring, safer moderation, smart search
- [ ] Add live classes with whiteboard, recording (with consent) and certificates
- [ ] Add mentorship and alumni network
- [ ] Add wallet features between students
- [ ] **(decision)** Decide whether to rebuild the mobile apps fully native
- [ ] Grow the team: developer, designer, community and support lead, moderators, marketing


## Always ongoing

- [ ] Check Supabase advisors for security and speed every month
- [ ] Review reports and the moderation queue every day
- [ ] Review failed payments and payouts every day
- [ ] Review crash and error reports every week
- [ ] Rotate secrets on a schedule
- [ ] Back up and test restores every quarter
- [ ] Keep the privacy policy matching the real app
- [ ] Update this file after every release
