let appPrefs = {
          theme: 'light',
          // Accounts are always private: every connection request must be accepted manually (see
          // acceptRequest in chat.js) before two users can message/connect
          accountPrivacy: 'Private',
          notifReminders: true,
          notifMessages: true,
          notifEmail: false
        };

        // ---- Theme toggle ----
        function applyThemeColorMeta(){
          const isDark = document.body.classList.contains('dark-mode');
          const themeColorMeta = document.querySelector('meta[name="theme-color"]');
          if (themeColorMeta) themeColorMeta.setAttribute('content', isDark ? '#121212' : '#ffffff');
          const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
          if (colorSchemeMeta) colorSchemeMeta.setAttribute('content', isDark ? 'dark' : 'light');
        }

        function toggleTheme(){
          appPrefs.theme = appPrefs.theme === 'light' ? 'dark' : 'light';
          document.body.classList.toggle('dark-mode', appPrefs.theme === 'dark');
          if (document.documentElement) document.documentElement.classList.toggle('dark-mode', appPrefs.theme === 'dark');
          try { localStorage.setItem('stitchTheme', appPrefs.theme); } catch (e) {}
          applyThemeColorMeta();
          openOverlay('profileMenu');
          queueSaveUserState();
        }

        // ---- Notification preferences screen ----
        function toggleNotifPref(key, screenKind){
          appPrefs[key] = !appPrefs[key];
          openOverlay(screenKind || 'profileMenu');
          queueSaveUserState();
        }

        function notificationSettingsRow(icon, iconBg, iconColor, label, sub, checked, onclick){
          return `
            <div class="w-full flex items-center gap-3 py-3">
              <div class="w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center ${iconColor} flex-shrink-0">${Icon(icon,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] font-semibold text-gray-900">${label}</div>
                ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
              </div>
              <button onclick="${onclick}" class="relative flex-shrink-0" style="width:44px;height:24px;border-radius:9999px;border:1px solid ${checked ? 'transparent' : '#d1d5db'};background:${checked ? `linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)` : '#e5e7eb'};box-shadow:inset 0 1px 2px rgba(0,0,0,0.08);transition:background .15s ease;">
                <span style="position:absolute;top:1px;left:1px;width:20px;height:20px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);transform:translateX(${checked ? '20px' : '0'});transition:transform .15s ease;"></span>
              </button>
            </div>`;
        }

        function notificationSettingsHTML(){
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Notifications', '20px', null, null, { right: true })}
            <div class="p-5">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notifications</div>
              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm">
                ${notificationSettingsRow('bell','bg-amber-100','text-amber-600','Reminders and updates','Session reminders plus app news and updates', appPrefs.notifReminders, "toggleNotifPref('notifReminders','notificationSettings')")}
                ${notificationSettingsRow('comment','bg-emerald-100','text-emerald-600','New messages','Direct messages and chat', appPrefs.notifMessages, "toggleNotifPref('notifMessages','notificationSettings')")}
                ${notificationSettingsRow('mail','bg-amber-50','text-amber-500','Email notifications','Receive updates via email', appPrefs.notifEmail, "toggleNotifPref('notifEmail','notificationSettings')")}
              </div>
            </div>
            </div>`;
        }

        let savedTab = 'posts';

        // ---- Saved items overlay ----
        function openSavedItems(tab){
          savedTab = tab || 'posts';
          openOverlay('savedItems');
        }

        function setSavedTab(t){
          savedTab = t;
          renderSavedItemsOverlay();
        }

        function renderSavedItemsOverlay(){
          const ov = document.getElementById('overlay');
          if (ov && !ov.classList.contains('hidden') && ov.querySelector('#saved-items-body')) {
            ov.innerHTML = savedItemsHTML();
          }
        }

        function savedTabBtn(key, label){
          const active = savedTab === key;
          return `<button onclick="setSavedTab('${key}')" class="flex-1 py-2.5 text-sm font-semibold saved-tab-btn" style="background:none;border:none;border-radius:0;box-shadow:none;color:${active ? NAVY : '#6b7280'};border-bottom:2px solid ${active ? NAVY : 'transparent'};">${label}</button>`;
        }

        function savedEmptyState(text){
          return `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm shadow-sm">${text}</div>`;
        }

        function savedItemsHTML(){
          const savedPosts = feedPosts.filter(p => p.saved);
          const savedJobs = allJobs().filter(j => j.saved);
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Saved', '20px', "openOverlay('profileMenu')", null, { right: true })}
            <div class="px-5 pb-3 flex flex-shrink-0" style="padding-top:20px;">
              ${savedTabBtn('posts','Posts')}
              ${savedTabBtn('career','Career')}
            </div>
            <div id="saved-items-body" class="p-5">
              ${savedTab === 'posts'
                ? (savedPosts.length ? `<div class="profile-thumb-grid">${savedPosts.map(p => profileGridItem(p,'saved')).join('')}</div>` : savedEmptyState('No saved posts yet. Tap the bookmark icon on a post to save it here.'))
                : (savedJobs.length ? savedJobs.map(jobCard).join('') : savedEmptyState('No saved career opportunities yet. Tap the bookmark icon on a listing to save it here.'))}
            </div>
            </div>`;
        }

        // ---- Blocked accounts overlay ----
        function renderBlockedAccountsOverlay(){
          const ov = document.getElementById('overlay');
          if (ov && !ov.classList.contains('hidden') && ov.querySelector('#blocked-accounts-body')) {
            ov.innerHTML = blockedAccountsHTML();
          }
        }

        function blockedAccountRow(b){
          return `
            <div class="flex items-center gap-3 py-3">
              <div class="w-11 h-11 rounded-full ${b.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(b,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0 text-[15px] text-gray-900 truncate">${escapeHtml(b.name)}</div>
              <button onclick="unblockAccount('${escapeForJsAttr(b.name)}')" class="text-sm font-semibold px-4 py-1.5 rounded-full flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};">Unblock</button>
            </div>`;
        }

        function blockedAccountsHTML(){
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Blocked', '20px', "openOverlay('profileMenu')", null, { right: true })}
            <div id="blocked-accounts-body" class="p-5">
              ${blockedAccounts.length
                ? `<div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm">${blockedAccounts.map(blockedAccountRow).join('')}</div>`
                : savedEmptyState("You haven't blocked anyone. Blocked accounts will appear here.")}
            </div>
            </div>`;
        }

        // ---- Legal pages (terms + privacy policy) ----
        // Single source of truth: the in-app pages (Profile -> Terms / Privacy) AND the pre-login
        // Terms modal + footer Privacy modal (games.js) all render from these section lists.
        const LEGAL_LAST_UPDATED = 'October 2026';
        const LEGAL_SUPPORT_EMAIL = 'support.stitch.io@gmail.com';
        function legalPlanPricesText(){
          try {
            if (typeof CAREER_PLANS !== 'undefined') return `GHS ${CAREER_PLANS.daily.price} per day, GHS ${CAREER_PLANS.weekly.price} per week or GHS ${CAREER_PLANS.monthly.price} per month`;
          } catch (e) {}
          return 'the daily, weekly or monthly price shown before you pay';
        }
        function legalTermsSections(){
          const sharePct = (typeof PAID_SELLER_SHARE_PCT !== 'undefined') ? PAID_SELLER_SHARE_PCT : 20;
          const schedule = (typeof PAID_SELLER_SCHEDULE_TEXT !== 'undefined') ? PAID_SELLER_SCHEDULE_TEXT : 'The withdrawal schedule is shown in the app when you apply to sell.';
          const minWd = (typeof PAID_SELLER_MIN_WITHDRAWAL !== 'undefined') ? PAID_SELLER_MIN_WITHDRAWAL : 'the minimum shown in the app';
          const approvalHrs = (typeof PAID_SELLER_APPROVAL_HOURS !== 'undefined') ? PAID_SELLER_APPROVAL_HOURS : 72;
          const E = LEGAL_SUPPORT_EMAIL;
          return [
            ['1. Introduction and Acceptance', [
              `Welcome to Stitch. These Terms of Service (the "Terms") are an agreement between you and Stitch ("Stitch", "we", "us"). By creating an account or using the Stitch app or website (the "Service"), you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use the Service.`,
              `Stitch is a community, study and career platform for students. It includes classes and courses, study notes, flashcards, quizzes and exams, a feed with short-lived "glimpses" (stories), messaging, voice and video calls, an AI study assistant called Stitch Bot, an Opportunities and Career Space for internships, courses and jobs, and paid features described in section 7.`
            ]],
            ['2. Eligibility', [
              `To use Stitch you must be at least 16 years old, provide accurate information when you sign up, have a working email address, and not have been previously suspended or removed from the Service. If you are under 18, you confirm that you have your parent or guardian's permission to use Stitch where the law requires it.`,
              `If you use Stitch on behalf of a school, business or organisation, you confirm that you have authority to accept these Terms for it.`
            ]],
            ['3. Your Account', [
              `You sign in with a one-time code sent to your email, or with Google. Stitch does not use passwords, so keeping your email account and your device secure is how you keep your Stitch account secure. You are responsible for everything that happens under your account.`,
              `Use one account per person. Do not create accounts to get around limits, bans or verification, and do not use bots or automated tools to create accounts or use the Service. Tell us straight away at ${E} if you think someone else has accessed your account.`
            ]],
            ['4. Community Content and Conduct', [
              `You can post content, join classes, share quiz scores, post glimpses (visible to your network for 24 hours), message other users and start voice or video calls. You keep ownership of what you post. You give Stitch a non-exclusive, worldwide, royalty-free licence to host, store, display and deliver it to the people you choose to share it with, for as long as it is on the Service, solely so that we can run and improve the Service.`,
              `You must only share content that you have the right to share. You must not: post content that is illegal, hateful, sexually explicit, threatening, harassing or that exploits or endangers anyone, especially children; bully, stalk, impersonate or mislead other users; share other people's private information without permission; spam or run scams; use bots to abuse messaging, calling or AI features; attempt to hack, probe, reverse-engineer or disrupt the Service; or resell or redistribute content from the Service without permission.`,
              `You can report posts, glimpses, messages, classes, courses and opportunities from the three-dot menu or the item's page. We may review reports and remove content, restrict features or suspend accounts to keep Stitch safe. We may also act on content that is reported by others or that we find ourselves.`,
              `Voice and video calls connect directly between users (peer-to-peer). We do not record call content. Glimpses are removed automatically after 24 hours, but we cannot control copies or screenshots made by other users before then.`
            ]],
            ['5. Uploaded Documents and AI-Generated Content', [
              `You can upload documents (such as PDFs and Word files) so that Stitch can extract text and generate study material such as notes, summaries, flashcards and practice questions, and so that Stitch Bot can answer questions about them. By uploading a document you confirm that you have the right to use it, and you give us a limited licence to process it only to provide your study content and Stitch Bot answers.`,
              `AI-generated content can be wrong, incomplete or out of date. It is a study aid, not professional, legal, medical or academic advice. Always check it against your original materials. You are responsible for following your school's rules on AI use and academic integrity, and we are not responsible for academic results that depend on AI-generated content.`,
              `To keep your practice pool useful, Stitch checks each upload against your other uploaded resources and rejects a file if it detects duplicate content, including the same document uploaded again under a different name or file type. Rejected duplicates are not processed.`
            ]],
            ['6. Classes, Courses and Opportunities', [
              `Classes, courses, internships, jobs and other opportunities on Stitch are posted by teachers, creators, organisations and other users, not by Stitch. We do not guarantee that any listing is accurate, safe, lawful or will lead to a place, job or result, and listing something on Stitch is not an endorsement.`,
              `Do your own checks before you apply, share personal documents or pay anyone. Stitch will never ask you for your sign-in code. Report any listing that looks like a scam, asks for unfair payments, or asks for sensitive information that it does not need.`,
              `Anyone who wants to post opportunities or sell content must apply and be approved first. We may ask for identity and business verification, and we may refuse, pause or remove anyone's posting rights at any time.`
            ]],
            ['7. Payments, Subscriptions and Refunds', [
              `<strong>Paid classes and courses.</strong> Approved creators can sell paid classes and courses on Stitch. The creator sets the price and it is shown to you before you pay. Payments are processed by Paystack, so Stitch does not store your card or mobile money details. Stitch keeps ${sharePct}% of every sale and the creator receives the remaining ${100 - sharePct}%. Card and mobile money processing fees come out of Stitch's share, so the price you see is the price you pay.`,
              `<strong>Stitch Bot subscription.</strong> "Match with CV/Resume" in Career Space is the one paid feature offered by Stitch itself. It costs ${legalPlanPricesText()}, paid in advance for that period, in Ghana cedis. You can cancel at any time and you keep access until the end of the period you already paid for. Before a plan ends we will remind you, and it only continues if you choose to pay again. Prices may change, but a change never applies to a period you have already paid for.`,
              `<strong>Creators.</strong> ${schedule} Withdrawals can also be held while a report about your class is open. The minimum withdrawal is ${minWd}. Each withdrawal is reviewed by a Stitch admin, usually within ${approvalHrs} hours, and is paid to a mobile money or bank account in your own name. Stitch may pause a class, hold payouts or suspend a creator while a report is reviewed, and may refund students from a creator's earnings. If a refund is paid after you have already withdrawn the money, the amount is taken from your future earnings. You are responsible for any taxes that apply to what you earn.`,
              `<strong>Refunds.</strong> You can report any class or course from its page. Stitch admins decide refunds case by case, taking into account the report, how much of the class or course was used, and the reason. To ask for a refund, email ${E} with your payment reference from Profile, then Receipts. Nothing in these Terms limits any refund right that the law gives you.`,
              `Stitch admins can see who bought which class, how much was paid and each creator's earnings, so that they can review reports and approve withdrawals. Every admin action on payments is logged.`
            ]],
            ['8. Acceptable Use', [
              `You agree to use Stitch only for lawful purposes. In addition to section 4, you must not use the Service to break any law, infringe anyone's intellectual property, cheat in exams or assessments, collect other users' data, or interfere with how the Service, its security features or its payment systems work.`
            ]],
            ['9. Privacy and Your Data', [
              `Our Privacy Policy explains what we collect, why, who we share it with and your rights. We do not sell your personal data. You can ask for your account and data to be deleted at any time from the Profile page or by emailing ${E}.`
            ]],
            ['10. Intellectual Property', [
              `The Stitch name, logo, design, software and the content we create are owned by Stitch and protected by law. You may not copy, modify, distribute or reverse-engineer any part of the Service without our written permission. Content that you or other users post belongs to them, subject to the licence in section 4.`,
              `If you believe content on Stitch infringes your copyright or other rights, email ${E} with enough detail for us to find it, and we will review it and remove it where appropriate.`
            ]],
            ['11. Suspension and Termination', [
              `You can delete your account at any time from the Profile page. This permanently removes your notes, exam history, messages and other content, except records we must keep by law (for example payment records, see the Privacy Policy).`,
              `We may suspend or terminate your account, with or without notice, if you break these Terms, put others at risk, or if we are required to by law. Where we can, we will tell you why. If we terminate your account for breaking these Terms, you may lose access to paid courses and any unused subscription time without a refund, except where the law says otherwise.`
            ]],
            ['12. Disclaimers and Limitation of Liability', [
              `The Service is provided "as is" and "as available". We work hard to keep it running but we do not promise that it will always be available, error-free or secure, or that any content, listing or AI output is accurate.`,
              `To the fullest extent permitted by Ghanaian law, Stitch is not liable for indirect or consequential loss, loss of data or exam content, academic or career outcomes, content or conduct of other users or third parties, or service interruptions. Our total liability to you for any claim is limited to the amount you paid Stitch in the 30 days before the claim. Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law.`
            ]],
            ['13. Governing Law and Disputes', [
              `These Terms are governed by the laws of the Republic of Ghana. If you have a problem, please contact us first at ${E} so we can try to sort it out. If we cannot, the courts of Ghana will have jurisdiction, unless the law gives you the right to go elsewhere.`
            ]],
            ['14. Changes to These Terms', [
              `We may update these Terms from time to time, for example when we add features or change how payments work. We will update the "Last Updated" date and, for important changes, tell you in the app or by email. If you keep using Stitch after changes take effect, you accept the updated Terms. If you do not agree, you can stop using Stitch and delete your account.`
            ]],
            ['15. Contact Us', [
              `Questions about these Terms? Email ${E}. We aim to reply within 2 business days.`
            ]]
          ];
        }
        function legalPrivacySections(){
          const E = LEGAL_SUPPORT_EMAIL;
          return [
            ['1. Who We Are and What This Policy Covers', [
              `Stitch ("we", "us", "our") is a community, study and career platform for students. This policy explains what personal data we collect when you use the Stitch app or website, how we use and protect it, who we share it with, and the choices and rights you have. We handle personal data in line with the Ghana Data Protection Act, 2012 (Act 843) and other data protection laws that apply to us. For anything in this policy, contact us at ${E}.`
            ]],
            ['2. Data We Collect', [
              `<strong>Account and profile:</strong> your name, username, email address, profile photo, bio, pronouns, school or department, and your settings. If you sign in with Google, we receive your Google account email and basic profile details. Stitch does not use passwords.`,
              `<strong>Content you create:</strong> notes, flashcards, quiz and exam results, posts, glimpses, comments, messages, class activity, and the questions you ask Stitch Bot.`,
              `<strong>Documents you upload:</strong> study documents (such as PDFs and Word files), and CVs or resumes if you use "Match with CV/Resume" in Career Space.`,
              `<strong>Payments:</strong> if you buy or sell a paid class or course, or buy a Stitch Bot plan, we keep a record of the payment (who paid, who was paid, amount, date and payment reference). Creators also give us a payout account (mobile money or bank) and its account name. Paystack handles card and mobile money details; Stitch does not store them.`,
              `<strong>Verification (only if you apply to post or sell):</strong> your role and business details, ID document, proof of residence, business documents and a live selfie, together with the results of automated ID, liveness and face-match checks run by our verification provider, Smile ID.`,
              `<strong>Calls and notifications:</strong> call metadata such as who called whom, when and for how long (never the content of the call), and a push notification token if you turn on notifications.`,
              `<strong>Usage and device data:</strong> the features you use, pages or screens you view, app errors, device and browser type, and approximate time and activity information. We do not collect your precise location.`
            ]],
            ['3. How We Use Your Data', [
              `We use your data to: create and secure your account; run Stitch and its features, including generating study content and Stitch Bot answers; connect you with classmates, classes, courses and opportunities; process payments, subscriptions, refunds and payouts; verify people who want to post or sell, and prevent fraud and abuse; moderate content and keep the community safe; send you notifications and service messages; understand how Stitch is used so we can fix problems and improve it; and meet our legal duties.`,
              `Under Act 843 we rely on: your consent (for example, for notifications or when you submit verification documents); the need to provide the Service you asked for; our legitimate interests in running, securing and improving Stitch; and legal obligations. Where we rely on consent, you can withdraw it at any time.`
            ]],
            ['4. AI Features', [
              `Stitch uses third-party AI services to generate exam questions, summaries, flashcards and notes from your documents, to power Stitch Bot, and to match your CV with opportunities. When you use these features, the relevant text, documents and prompts are sent to the AI provider to produce your result. They are used to provide your result and are not used by us to train AI models. Please do not upload or type in information that you do not want processed this way, such as other people's sensitive details.`
            ]],
            ['5. Who We Share Data With', [
              `We do not sell your personal data and we do not use it for advertising. We share it only as follows:`,
              `<strong>Other users:</strong> what you choose to share, such as your profile, posts, glimpses, messages, class activity and course enrolment, with the audience that you or the feature intends.`,
              `<strong>Service providers (processors)</strong> who help us run Stitch, only for the purposes described here: Supabase (database, sign-in, file storage and real-time messaging); Paystack (payments); Smile ID (ID, liveness and face-match checks for people who apply to post or sell); PostHog (product analytics and error diagnosis); our AI provider (study content, Stitch Bot and CV matching); Google (if you choose Google sign-in); and push notification services provided by your device's platform.`,
              `<strong>Stitch administrators</strong> can see the information needed for moderation, safety, verification, refunds and payouts, under access controls, and their actions on payments are logged.`,
              `<strong>Legal and safety:</strong> we may disclose data if the law requires it, to respond to valid requests from authorities, or to protect people's safety and our rights. If Stitch is ever sold or merged, your data may transfer to the new owner, who must honour this policy.`
            ]],
            ['6. International Transfers', [
              `Our providers may store or process data in countries outside Ghana, including in Europe and the United States. When this happens we take steps to make sure your data is still protected, for example by using providers with appropriate security and contractual safeguards.`
            ]],
            ['7. Glimpses and Temporary Content', [
              `Glimpses are visible to your network for 24 hours and are then removed automatically. Screenshots or copies made by other users before they expire are outside our control.`
            ]],
            ['8. How Long We Keep Your Data', [
              `We keep your data for as long as your account is active and as needed to provide the Service. Uploaded documents are processed to create your study content and are not kept longer than needed for that purpose. Verification documents are kept only as long as needed to review your application, keep the platform safe and meet legal duties.`,
              `When you delete your account, we delete your profile, content, uploaded documents and messages. We may keep limited records where the law or our legitimate interests require it, for example payment and payout records for accounting and fraud prevention, and anonymised or aggregated data. Deleted data may remain in secure backups for a short period until they are overwritten.`
            ]],
            ['9. Security', [
              `Your data is stored with Supabase using encryption in transit and at rest. We limit who can access personal data, and we log administrator actions on payments. No system is completely secure, so we cannot guarantee absolute security. If a breach affects your personal data, we will tell you and the authorities where the law requires it. Keep your email account secure, since it is how you sign in.`
            ]],
            ['10. Your Rights', [
              `Under Act 843 you have the right to: know what data we hold about you and get a copy; have inaccurate data corrected; have your data deleted; object to or restrict certain processing; and withdraw consent you have given. You can see and edit most of your data in the app, delete your account from the Profile page, or contact us at ${E} for anything else. We aim to respond within 30 days.`,
              `If you are not happy with how we handle your data, please contact us first. You also have the right to complain to the Data Protection Commission of Ghana.`
            ]],
            ['11. Children', [
              `Stitch is for people aged 16 and over. We do not knowingly collect data from anyone younger. If you think a child under 16 has an account, email ${E} and we will delete it.`
            ]],
            ['12. Cookies, Local Storage and Analytics', [
              `We use your browser or device storage to keep you signed in and to remember your settings. We use PostHog for product analytics. It stores an identifier in your browser or device storage and records events such as sign-ins, payments and feature use. It does not use autocapture, identifies you only by an internal account ID (not your name or email), and masks inputs. Session replay is blocked on sensitive screens such as chat, calls, ID verification, payouts, CV and career pages, enrolment forms, settings and sign-in. We respect your browser's Do Not Track setting. We do not use advertising or cross-site tracking cookies.`
            ]],
            ['13. Changes to This Policy', [
              `We may update this policy from time to time. We will change the "Last Updated" date and, for important changes, tell you in the app or by email. If you keep using Stitch after a change, you accept the updated policy.`
            ]],
            ['14. Contact Us', [
              `For privacy questions or to use your rights, email ${E}. We aim to reply within 2 business days.`
            ]]
          ];
        }
        // variant 'app' = in-app Tailwind styling; 'plain' = pre-login modals (inline styles)
        function legalRenderHTML(sections, variant){
          const grad = 'background-image:linear-gradient(90deg, #1e90ff, #4169e1);-webkit-background-clip:text;background-clip:text;color:transparent;';
          return sections.map(sec => {
            const h = variant === 'app'
              ? `<h3 class="font-bold pt-1" style="${grad}">${sec[0]}</h3>`
              : `<h3 style="font-weight:700;padding-top:4px;${grad}">${sec[0]}</h3>`;
            return h + sec[1].map(p => `<p>${p}</p>`).join('');
          }).join('');
        }
        function legalDateLineHTML(variant){
          return variant === 'app'
            ? `<p class="text-xs text-gray-400">Last Updated: ${LEGAL_LAST_UPDATED} &middot; ${LEGAL_SUPPORT_EMAIL}</p>`
            : `<p style="font-size:11.5px;color:#9ca3af;">Last Updated: ${LEGAL_LAST_UPDATED} &middot; ${LEGAL_SUPPORT_EMAIL}</p>`;
        }
        function legalPageHTML(title, sections){
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader(title, '20px', "openOverlay('profileMenu')", null, { right: true })}
            <div class="p-5">
              <div class="text-sm leading-relaxed text-gray-600 space-y-3">
                ${legalDateLineHTML('app')}
                ${legalRenderHTML(sections, 'app')}
              </div>
            </div>
            </div>`;
        }
        function termsOfServiceHTML(){ return legalPageHTML('Terms of Service', legalTermsSections()); }
        function privacyPolicyHTML(){ return legalPageHTML('Privacy Policy', legalPrivacySections()); }

        const helpFAQData = [
          { category: 'Getting Started', items: [
            { id: 'gs-profile', q: 'How do I set up my profile?', a: 'Open Settings from your profile menu, then tap your photo or name to add a picture, bio, department, and pronouns. You can update any of this again at any time.' },
            { id: 'gs-free', q: 'Is Stitch free to use?', a: "Yes, Stitch is free to use. The one paid extra is the Stitch Bot subscription in \"Match with CV/Resume\" (GHS 20 a day, GHS 90 a week or GHS 300 a month, cancel any time). Every account gets 50 Stitch Bot prompts a day (up to 250 a week and 1000 a month). Practice questions, flashcards, and Challenge Arena questions generated from your uploads are unlimited. Some courses in the Opportunities tab are posted by outside creators who set their own price, and those payments are handled securely by Paystack." },
          ]},
          { category: 'Stitch Bot AI Tutor', items: [
            { id: 'sb-help', q: 'What can Stitch Bot help me with?', a: "Stitch Bot can explain concepts, generate notes and flashcards from your uploaded documents, quiz you on a topic, and answer questions about your course material in plain language." },
            { id: 'sb-docs', q: 'Can Stitch Bot use my uploaded documents?', a: "Yes. Once you upload a PDF or Word file, Stitch Bot can read its content and use it to generate summaries, flashcards, and practice questions, or to answer your questions directly from that document." },
          ]},
          { category: 'Feed & Stories', items: [
            { id: 'feed-post', q: 'How do I share a note or post?', a: 'Tap the + button on the Feed to create a post. You can attach notes, images, or quiz scores, and choose who sees it based on your account privacy setting.' },
            { id: 'feed-report', q: 'How do I report inappropriate content?', a: "Tap the three-dot menu on any post, story, or message and choose Report. Our team reviews every report and takes action on content that breaks our Terms of Service." },
          ]},
          { category: 'Classes & Messaging', items: [
            { id: 'class-join', q: 'How do I join or create a class?', a: "Go to the Classroom tab and tap Join Class to enter a class code from your teacher, or Create Class if you're setting one up yourself." },
            { id: 'msg-calls', q: 'Are voice and video calls private?', a: 'Calls connect directly between users (peer-to-peer) and are never recorded or stored on our servers.' },
          ]},
          { category: 'Practice Tests & Past Papers', items: [
            { id: 'pt-source', q: 'Where do past questions come from?', a: 'Past papers are sourced from real exams and contributed by teachers and students on Stitch, then organized by course and topic.' },
            { id: 'pt-progress', q: 'Can I track my practice progress?', a: 'Yes, your scores and streaks are saved automatically and shown on your Analytics page, so you can see how you\'re improving over time.' },
          ]},
        ];
        let helpFAQOpenIds = new Set();
        // ---- Help center: FAQ ----
        function toggleHelpFAQ(id){
          if (helpFAQOpenIds.has(id)) helpFAQOpenIds.delete(id); else helpFAQOpenIds.add(id);
          const ov = document.getElementById('overlay');
          if (!ov) return;
          // Keep the page where it was scrolled -- re-rendering would otherwise jump back to the top
          const scroller = ov.querySelector('.overflow-y-auto');
          const top = scroller ? scroller.scrollTop : 0;
          ov.innerHTML = helpCenterHTML();
          const s2 = ov.querySelector('.overflow-y-auto');
          if (s2) s2.scrollTop = top;
        }
        function helpFAQRow(item){
          const open = helpFAQOpenIds.has(item.id);
          return `
            <div class="py-3">
              <button onclick="toggleHelpFAQ('${item.id}')" class="w-full flex items-center justify-between gap-3 text-left">
                <span class="text-[15px] text-gray-900">${escapeHtml(item.q)}</span>
                <span class="flex-shrink-0 text-gray-400" style="transform:rotate(${open ? '180deg' : '0deg'});transition:transform .15s ease;">${Icon('chevronDown','w-4 h-4')}</span>
              </button>
              ${open ? `<div class="pt-2 text-xs text-gray-400 leading-relaxed">${escapeHtml(item.a)}</div>` : ''}
            </div>`;
        }
        function helpCategoryCard(section){
          return `
            <div class="mb-5">
              <div class="help-dodger text-xs font-semibold uppercase tracking-wide mb-2 font-display" style="color:#1e90ff;">${escapeHtml(section.category)}</div>
              <div class="divide-y">${section.items.map(helpFAQRow).join('')}</div>
            </div>`;
        }
        function helpCenterHTML(){
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Help Center', '20px', "openOverlay('profileMenu')", null, { right: true })}
            <div class="px-5" style="padding-top:20px;padding-bottom:32px;">
              <p class="text-sm text-gray-500 mb-5">Answers to common questions about using Stitch. Can't find what you need? Reach us below.</p>
              ${helpFAQData.map(helpCategoryCard).join('')}
              <div class="p-5 text-center mt-4" style="margin-bottom:50px;">
                <div class="help-dodger font-bold text-base mb-1" style="color:${NAVY};">Still need help?</div>
                <div class="text-sm text-gray-500 mb-4">Our support team responds within 24 hours.</div>
                <div class="flex flex-col gap-2.5">
                  <button onclick="openOverlayFrom('helpCenter','contactUs')" class="w-full font-semibold text-sm py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Contact Us</button>
                  <button onclick="openOverlayFrom('helpCenter','reportIssue')" class="w-full font-semibold text-sm py-3 rounded-full border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">Report an Issue</button>
                </div>
              </div>
            </div>
            </div>`;
        }

        let contactFormDraft = { name: '', email: '', message: '' };
        // ---- Contact us form ----
        function resetContactFormDraft(){ contactFormDraft = { name: '', email: '', message: '' }; }
        function updateContactField(field, value){ contactFormDraft[field] = value; }
        function contactInfoRow(icon, label, value){
          return `
            <div style="margin-bottom:16px;">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400" style="margin-bottom:4px;">${label}</div>
              <div class="text-sm font-semibold text-gray-800" style="word-break:break-word;">${value}</div>
            </div>`;
        }
        async function submitContactForm(){
          const d = contactFormDraft;
          if (!d.name.trim() || !d.email.trim() || !d.message.trim()) {
            openAppAlertModal('Please fill in your name, email, and message.');
            return;
          }
          try {
            const res = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                _subject: 'Stitch - Contact Us: ' + d.name,
                form: 'Contact Us',
                name: d.name,
                email: d.email,
                message: d.message,
                _replyto: d.email
              })
            });
            if (!res.ok) throw new Error('Formspree request failed: ' + res.status);
          } catch (err) {
            console.error('Contact form send failed, falling back to mailto:', err);
            window.reportError(err, { form: 'contact-us' });
            const subject = encodeURIComponent('Stitch - Contact Us: ' + d.name);
            const body = encodeURIComponent(`From: ${d.name} <${d.email}>\n\n${d.message}`);
            window.location.href = `mailto:${SUGGESTIONS_EMAIL}?subject=${subject}&body=${body}`;
          }
          resetContactFormDraft();
          openAppAlertModal("Thanks for reaching out! We'll get back to you at " + d.email + " within 24 hours.");
          openOverlay('profileMenu');
        }
        function contactUsHTML(){
          const d = contactFormDraft;
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Contact Us', '20px', null, null, { right: true })}
            <div class="px-5" style="padding-top:20px;">
              <p class="text-sm text-gray-500 mb-5">Have a question, suggestion, or just want to say hi? We'd love to hear from you.</p>
              ${contactInfoRow('mail', 'Email', 'support.stitch.io@gmail.com')}
              ${contactInfoRow('clock', 'Response Time', 'We respond within 24 hours')}
              <div class="mb-4 mt-2">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Name</label>
                <input type="text" value="${escapeHtml(d.name)}" oninput="updateContactField('name', this.value)" placeholder="Your name" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm border border-gray-300" style="outline:none;">
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Email</label>
                <input type="email" value="${escapeHtml(d.email)}" oninput="updateContactField('email', this.value)" placeholder="your@email.com" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm border border-gray-300" style="outline:none;">
              </div>
              <div class="mb-5">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Message</label>
                <textarea oninput="updateContactField('message', this.value)" placeholder="How can we help you?" rows="6" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm border border-gray-300" style="outline:none;resize:none;">${escapeHtml(d.message)}</textarea>
              </div>
              <button onclick="submitContactForm()" class="w-full font-semibold text-sm py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);margin-bottom:10px;">Send Message</button>
            </div>
            </div>`;
        }

        const reportIssueTypes = [
          { id: 'bug', icon: 'alertTriangle', label: 'Bug / Something Broken' },
          { id: 'safety', icon: 'shield', label: 'Safety Concern' },
          { id: 'content', icon: 'block', label: 'Inappropriate Content' },
          { id: 'feature', icon: 'rocket', label: 'Feature Request' },
          { id: 'other', icon: 'edit', label: 'Other' },
        ];
        let reportIssueDraft = { type: null, description: '', email: '' };
        // ---- Report an issue form ----
        function resetReportIssueDraft(){ reportIssueDraft = { type: null, description: '', email: '' }; }
        function setReportIssueType(id){
          reportIssueDraft.type = id;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = reportIssueHTML();
        }
        function updateReportIssueField(field, value){ reportIssueDraft[field] = value; }
        async function submitIssueReport(){
          const d = reportIssueDraft;
          if (!d.type) { openAppAlertModal('Please choose what type of issue this is.'); return; }
          if (!d.description.trim()) { openAppAlertModal('Please describe the issue.'); return; }
          const typeLabel = (reportIssueTypes.find(t => t.id === d.type) || {}).label || d.type;
          try {
            const res = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify({
                _subject: 'Stitch - Report an Issue: ' + typeLabel,
                form: 'Report an Issue',
                issueType: typeLabel,
                description: d.description,
                email: d.email || undefined,
                _replyto: d.email || undefined
              })
            });
            if (!res.ok) throw new Error('Formspree request failed: ' + res.status);
          } catch (err) {
            console.error('Issue report send failed, falling back to mailto:', err);
            window.reportError(err, { form: 'report-issue', issueType: typeLabel });
            const subject = encodeURIComponent('Stitch - Report an Issue: ' + typeLabel);
            const body = encodeURIComponent(`Issue type: ${typeLabel}\n\n${d.description}` + (d.email ? `\n\nReply to: ${d.email}` : ''));
            window.location.href = `mailto:${SUGGESTIONS_EMAIL}?subject=${subject}&body=${body}`;
          }
          resetReportIssueDraft();
          openAppAlertModal("Thanks for the report. Our team will look into it" + (d.email ? (" and follow up at " + d.email) : "") + ".");
          openOverlay('profileMenu');
        }
        function reportIssueHTML(){
          const d = reportIssueDraft;
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Report an Issue', '20px', null, null, { right: true })}
            <div class="px-5" style="padding-top:20px;">
              <p class="text-sm text-gray-500 mb-5">Help us improve Stitch by reporting bugs, safety concerns, or suggesting features.</p>
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">What type of issue?</div>
              <div class="mb-5 flex flex-col gap-2.5">
                ${reportIssueTypes.map(t => `
                  <button onclick="setReportIssueType('${t.id}')" class="w-full px-4 py-2.5 rounded-2xl text-sm font-semibold text-left outline-pill ${d.type === t.id ? 'is-selected' : ''}">
                    <span>${t.label}</span>
                  </button>
                `).join('')}
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Describe the issue</label>
                <textarea oninput="updateReportIssueField('description', this.value)" placeholder="Tell us what happened, what you expected, and any steps to reproduce the issue..." rows="5" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm border border-gray-300" style="outline:none;resize:none;">${escapeHtml(d.description)}</textarea>
              </div>
              <div class="mb-5">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Email for follow-up (optional)</label>
                <input type="email" value="${escapeHtml(d.email)}" oninput="updateReportIssueField('email', this.value)" placeholder="your@email.com" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm border border-gray-300" style="outline:none;">
              </div>
              <button onclick="submitIssueReport()" class="w-full font-semibold text-sm py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);margin-bottom:50px;">Submit Report</button>
            </div>
            </div>`;
        }
