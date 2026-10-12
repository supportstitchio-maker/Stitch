# Stitch: Team Working Rules

These rules are for everyone working on Stitch: developers, designers, moderators, support and the product lead. They keep the app safe, the work organised and the team aligned. If a rule does not fit a situation, talk to the team lead before breaking it.

Fonts for design work: **Montserrat** as the main font, with Colmeak and Inter kept where they are already used.


## 1. How we work together

1. **One source of truth.** Plans live in `planning.md`, work lives in `task.md`, and these rules live here. Do not keep important decisions only in chats.
2. **Write it down.** Every decision that affects the product, money or users goes into a short note with the date and who decided.
3. **Small steps.** Break work into small tasks that can be finished and checked in a day or two.
4. **Say when you are blocked.** Do not sit on a problem. Tell the team lead the same day.
5. **Be kind in reviews.** Comment on the work, not the person. Explain why, not only what.
6. **No heroics.** Do not work through the night to push risky changes. Rested people make fewer mistakes.
7. **Hand over properly.** Anyone leaving a task writes what is done, what is left and where the files are.
8. **Respect user data.** Real user data is never used for testing, demos or screenshots.

### Roles
- **Product lead:** sets priorities, makes final calls on product and money.
- **Developers:** build and fix features, review each other's work.
- **Designer:** owns how the app looks and feels, keeps the design consistent.
- **Moderators and support:** handle reports, user questions and scams.
- **Admins (accounts with admin power):** only people who truly need it. Always with 2-step login.


## 2. Code and files

### Folder and file habits
1. Every feature has a clear home. Do not add new code to a giant file if a new file makes more sense.
2. File names describe what is inside (`creator.js`, `chat.js`).
3. Keep files in place. When a feature is removed, remove the code but keep the file if the team agreed to keep it.
4. No copy-pasted blocks. If the same code appears twice, make it a shared helper.
5. Delete dead code. Do not leave old code commented out.

### Writing code
1. Write for the next person. Clear names, short functions, a short comment when the reason is not obvious.
2. One change, one purpose. Do not mix a bug fix, a redesign and a cleanup in the same change.
3. Never put secrets, passwords or private keys in the code. The only key allowed in the app is the Supabase publishable key.
4. Keep `.env` and other private files out of git.
5. All text the user sees must be clear, friendly and free of spelling mistakes.
6. Handle errors. The user must see a helpful message, never a blank screen or a raw error.
7. Add loading and empty states for every list and screen.
8. Do not add a new library without asking the team lead. Each library adds weight, risk and cost.

### Cache version numbers
When a script or stylesheet changes, bump its version number in `index.html` so users get the new file. Forgetting this is the most common reason users see old behaviour.


## 3. Git and releases

1. **Never work directly on the main branch.** Create a branch for each task.
2. **Branch names:** `feature/short-name`, `fix/short-name`, `chore/short-name`.
3. **Commit messages:** one clear line saying what changed and why, for example "Fix login code error for test account".
4. **Pull requests:** every change goes through a pull request. Another person reviews it before it is merged. Nobody approves their own work.
5. **A pull request must include:** what changed, why, how it was tested, screenshots for any screen change (light and dark mode), and any database or settings change.
6. **Small pull requests.** If a reviewer cannot understand it in 20 minutes, split it.
7. **Releases:** we release on a known day, not on Friday evening. Urgent fixes are the only exception.
8. **Every release has:** a version number, a short list of changes, and a plan to roll back.
9. **Tag every release** in git so we can always find what was live.


## 4. Environments

We use three separate environments. Never mix them.

1. **Development:** where we build and break things. Fake data only.
2. **Staging:** a copy of production used to test before release. Fake or cleaned data only.
3. **Production:** what real users use. Changes only after passing staging.

Rules:
- Never test on production.
- Never copy real user data into development or staging.
- Each environment has its own keys. Keys are never shared between them.
- A change reaches production only after it has run on staging.


## 5. Database and backend rules

1. **Every database change is a migration.** No changes by hand in the dashboard on production, except emergencies, and those are written up afterwards and turned into a migration.
2. **Every migration is saved in git** with a clear name.
3. **Row-level security (RLS) is on for every table, always.** A new table is not allowed to ship without policies.
4. **Test policies from the user's point of view.** Check that user A cannot read or change user B's data.
5. **The server decides money and permissions.** Prices, fees, payouts, who can create a class, who is an admin: all enforced in the database or edge functions. Never trust the app screen for these.
6. **Edge functions keep the JWT check on.** Only webhooks and the test login are exceptions, and each must verify the caller another way.
7. **Do not grant broad access.** Give the smallest permission that makes the feature work.
8. **Private files go in private storage.** CVs, IDs, selfies, class files and application documents are never public. Users can only touch their own folder.
9. **Add indexes for new queries** that filter or sort a lot, and use pagination for every list.
10. **Be careful with deletes.** Check what else depends on the data. Account deletion must remove or anonymise everything.
11. **Scheduled jobs are documented.** For each job we write what it does, how often it runs and who to tell if it fails.
12. **After any change, run the Supabase security and performance advisor** and fix what it flags.


## 6. Security rules

1. Use strong, unique passwords and 2-step login on everything: email, domain, hosting, Supabase, Paystack, app stores, GitHub.
2. Company accounts are owned by the company, not one person's private email.
3. Share access only to the people who need it. Remove access the day someone leaves.
4. Admin accounts always use 2-step login.
5. Rotate secrets on a schedule and any time one may have leaked.
6. Never paste keys, user data or private links in public chats, screenshots or issue trackers.
7. If you think something was leaked, tell the team lead immediately. Report fast, do not hide it.
8. Everything a user types is untrusted. Always clean it before showing it on screen.
9. Keep the content security policy tight. Any new outside address needs team lead approval.
10. Keep private screens (chat, calls, ID checks, payouts, CVs) hidden from analytics and session recordings.
11. Do not put personal details (names, emails, messages) in error reports or analytics events.
12. Review security every month and test it from outside before the big launch.


## 7. Testing and quality

### Before anything is merged
- [ ] It works on a phone-sized screen (the main target)
- [ ] It works in light mode and dark mode
- [ ] It works on a slow network and offline shows a clear message
- [ ] Loading, empty and error states look right
- [ ] Nothing else broke (open the main flows)
- [ ] No console errors
- [ ] Text uses the approved fonts (Montserrat, Colmeak, Inter) and follows the design rules

### Before every release, test these main flows
1. Sign up, onboarding, login (email code, Google, Apple), logout
2. Edit profile, change photo
3. Create a post, glimpse, comment, like, report
4. Send a connection request, accept it, send a message
5. Make and receive a voice call and a video call
6. Create and join a class and a meeting
7. Take a course and a quiz, start a challenge
8. Apply for an opportunity, use Match with CV
9. Buy a course or class (test payment), see it in the creator wallet, request a payout
10. Push notification arrives and opens the right screen
11. Account deletion works completely
12. The reviewer/test account still works and shows only its own data

### Devices
Test every release on at least one cheap Android phone, one recent Android phone and one iPhone, plus the browser.

### Bugs
- Every bug gets a title, steps to reproduce, what should happen, what happened, a screenshot and the device.
- Bugs affecting money, privacy or login are fixed first.


## 8. Design rules

1. **Fonts:** Montserrat is the main font (weights 400, 500, 600, 700, 800). Colmeak and Inter stay where they are used today. Do not add any other font without the designer's approval.
2. **Dark mode:** keep the current dark mode as it is. Charts keep their original colours. Every screen must look right in both light and dark mode.
3. **Menus and panels:** they pull up from the bottom, never drop down. When closed by tapping empty space, they slide down slowly.
4. **Icons on panels:** grey only. No red or blue icons.
5. **Bottom buttons:** two floating pills. Back is a white card pill with no outline. Continue is a dodger blue to royal blue gradient. No panel behind them. Back goes to the previous page and the top arrow exits the whole process.
6. **Titles:** right-aligned on New post, Posts and My glimpse. Centered on Match with CV.
7. **Menus look the same.** A new menu must copy the style of the existing ones (rows, spacing, colours).
8. **Words:** plain, friendly and short. Chart descriptions use everyday language.
9. **Touch:** buttons must be easy to tap with a thumb.
10. **Accessibility:** enough contrast, readable text, works with larger system text.
11. **Do not invent new styles.** Reuse existing pieces first. Talk to the designer before adding a new one.


## 9. Product rules

1. Accounts are private. Connections must be accepted before people can message.
2. People who do not finish onboarding do not keep an account.
3. Feed videos start with sound, autoplay in view, and stop when scrolled past. The user can mute.
4. Reports go to admins and use a reason-picker page.
5. Block and report must be available wherever users meet other users.
6. The free AI class has usage caps. Changing them needs the product lead's approval.
7. Features we dropped (referrals, mini-games) do not come back without a new decision.
8. The reviewer/test account never shows other people's data and never has a way around the rules.


## 10. Money rules

1. All money goes through Paystack and the wallet ledger. No side deals, no manual cash.
2. Every cedi in and out creates a ledger entry.
3. Prices, fees and payout limits are enforced on the server.
4. Creator fee is 20%. Minimum withdrawal is GHS 50. Changing these needs the product lead's approval and a written note.
5. Payouts need admin approval, and respect the cooldown and hold rules.
6. Two people are involved in any payout above a limit the team agrees on.
7. Check failed payments and payouts every day.
8. Match the ledger against Paystack regularly.
9. Refunds follow the written refund process, never an ad-hoc promise.
10. Any change to payment code needs two reviewers and a test on staging with test payments.
11. Never store card details. Paystack handles them.
12. Payment inside the store apps follows the store rules we decided on.


## 11. Data and privacy rules

1. Collect only the data we need.
2. The privacy policy must match what the app really does. Update it before releasing a change that collects new data.
3. Real user data is never used for demos, designs, tests or screenshots.
4. Only admins and support who need it can see user data, and every admin action is logged.
5. Respect deletion requests. Deleting an account removes the user's data everywhere, including files.
6. Follow Ghana's data protection law and any other law that applies where our users live.
7. A data leak is reported to the product lead immediately. We then follow the incident steps.


## 12. Moderation and support

1. Check the reports queue every day.
2. Target response times: urgent (scams, threats, child safety, harassment) within hours; normal reports within a day.
3. Always record what action was taken and why.
4. Be fair and consistent. Follow the community guidelines, not personal feelings.
5. Remove harmful content fast and tell the person who reported when possible.
6. Repeat or serious offenders are suspended. Serious cases are escalated to the product lead.
7. Fake jobs, fake courses and scams are removed and the poster is blocked.
8. Support replies are polite, clear and honest. Never promise what we cannot do.
9. Collect common user problems and share them with the team every week.


## 13. Calls and realtime

1. Calls must use our own or a paid relay service, never free public ones, in production.
2. Admins can mute everyone in group calls, class meetings and meetings.
3. Test calls on weak networks before each release.
4. We do not record calls unless a written plan with user consent exists.


## 14. Incidents (when something breaks)

1. **Tell the team lead immediately.** Do not wait to see if it fixes itself.
2. **Contain it.** Stop the damage first (turn off a feature, block a function, pause payouts).
3. **Fix it.** Roll back the last release if that is the fastest safe fix.
4. **Tell users** if their data, money or access was affected. Be honest and clear.
5. **Write it up** within a few days: what happened, why, what we did, what we change so it does not happen again.
6. **Update tests and checklists** so the same problem is caught next time.


## 15. Store and release rules (mobile apps)

1. Follow the Apple and Google rules. Read the current rules before each major release.
2. The privacy and data safety answers must match what the app does.
3. Keep the reviewer account working at all times, with the login details in the review notes.
4. Every store release is tested on real phones first.
5. Do not use the store apps to bypass store rules (for example, taking payments for digital content outside the allowed way).
6. Keep a minimum supported version so very old apps can be asked to update.
7. Keep all store accounts under the company with more than one trusted owner.


## 16. Documents and records

1. Keep `planning.md`, `task.md` and `rules.md` up to date. Update `task.md` after every release.
2. Keep a list of every account, tool and subscription we use, who owns it and when it renews.
3. Keep a list of every secret and where it is stored (never the secret itself).
4. Keep a list of all scheduled jobs and edge functions with a one-line purpose.
5. Keep release notes for every version.
6. Keep decisions notes: what was decided, by whom, when and why.


## 17. New team member checklist

1. Read `planning.md`, `task.md` and this file.
2. Get access only to what the role needs, with 2-step login.
3. Set up the development environment (never production first).
4. Do one small starter task with a review.
5. Meet the team lead and agree on weekly goals.


## 18. Changing these rules

Rules can change. Anyone can suggest a change. The product lead and team lead decide, write down the date, and tell everyone.
