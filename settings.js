        let appPrefs = {
          theme: 'light',
          accountPrivacy: 'Private',
          notifReminders: true,
          notifMessages: true,
          notifEmail: false
        };

        let accountPrivacyMenuOpen = false;

        function toggleTheme(){
          appPrefs.theme = appPrefs.theme === 'light' ? 'dark' : 'light';
          document.body.classList.toggle('dark-mode', appPrefs.theme === 'dark');
          openOverlay('profileMenu');
          queueSaveUserState();
        }

        function toggleAccountPrivacyMenu(){
          accountPrivacyMenuOpen = !accountPrivacyMenuOpen;
          openOverlay('profileMenu');
          const ov = document.getElementById('overlay');
          attachMenuScrollCloser(ov ? ov.querySelector('.overflow-y-auto') : null, accountPrivacyMenuOpen, 'toggleAccountPrivacyMenu');
        }

        function setAccountPrivacy(v){
          appPrefs.accountPrivacy = v;
          accountPrivacyMenuOpen = false;
          openOverlay('profileMenu');
          autoAcceptConnectionsIfPublic();
          queueSaveUserState();
        }

        function autoAcceptConnectionsIfPublic(){
          if (appPrefs.accountPrivacy !== 'Public') return;
          requestConvos.map(c => c.id).forEach(id => acceptRequest(id));
        }

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
            ${overlayHeader('Notifications', '20px')}
            <div class="flex-1 overflow-y-auto p-5">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notifications</div>
              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm">
                ${notificationSettingsRow('bell','bg-amber-100','text-amber-600','Reminders and updates','Session reminders plus app news and updates', appPrefs.notifReminders, "toggleNotifPref('notifReminders','notificationSettings')")}
                ${notificationSettingsRow('comment','bg-emerald-100','text-emerald-600','New messages','Direct messages and chat', appPrefs.notifMessages, "toggleNotifPref('notifMessages','notificationSettings')")}
                ${notificationSettingsRow('mail','bg-amber-50','text-amber-500','Email notifications','Receive updates via email', appPrefs.notifEmail, "toggleNotifPref('notifEmail','notificationSettings')")}
              </div>
            </div>`;
        }

        let savedTab = 'posts';

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
          return `<button onclick="setSavedTab('${key}')" class="flex-1 py-2.5 text-sm font-semibold ${active ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${active ? `background:rgba(30,144,255,0.55);` : 'background:#f3f4f6;'}">${label}</button>`;
        }

        function savedEmptyState(text){
          return `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm shadow-sm">${text}</div>`;
        }

        function savedItemsHTML(){
          const savedPosts = feedPosts.filter(p => p.saved);
          const savedJobs = allJobs().filter(j => j.saved);
          return `
            ${overlayHeader('Saved', '20px', "openOverlay('profileMenu')")}
            <div class="px-5 pt-1 pb-3 flex gap-2 flex-shrink-0">
              ${savedTabBtn('posts','Posts')}
              ${savedTabBtn('career','Career')}
            </div>
            <div id="saved-items-body" class="flex-1 overflow-y-auto p-5">
              ${savedTab === 'posts'
                ? (savedPosts.length ? `<div class="profile-thumb-grid">${savedPosts.map(p => profileGridItem(p,'saved')).join('')}</div>` : savedEmptyState('No saved posts yet. Tap the bookmark icon on a post to save it here.'))
                : (savedJobs.length ? savedJobs.map(jobCard).join('') : savedEmptyState('No saved career opportunities yet. Tap the bookmark icon on a listing to save it here.'))}
            </div>`;
        }

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
            ${overlayHeader('Blocked', '20px', "openOverlay('profileMenu')")}
            <div id="blocked-accounts-body" class="flex-1 overflow-y-auto p-5">
              ${blockedAccounts.length
                ? `<div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm">${blockedAccounts.map(blockedAccountRow).join('')}</div>`
                : savedEmptyState("You haven't blocked anyone. Blocked accounts will appear here.")}
            </div>`;
        }

        function termsOfServiceHTML(){
          return `
            ${overlayHeader('Terms of Service', '20px', "openOverlay('profileMenu')")}
            <div class="flex-1 overflow-y-auto p-5">
              <div class="bg-white rounded-3xl p-5 shadow-sm text-sm leading-relaxed text-gray-600 space-y-3">
                <p class="text-xs text-gray-400">Last Updated: August 2026 &middot; support.stitch.io@gmail.com</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">1. Introduction</h3>
                <p>Welcome to Stitch. By accessing or using our platform, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our service.</p>
                <p>Stitch is a community and study platform for students, including note-taking, flashcards, quizzes/exams, a study feed with short-lived "stories," messaging, and voice/video calls, designed to help students learn and connect with classmates.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">2. Eligibility</h3>
                <p>To use Stitch, you must: be at least 16 years of age; provide accurate and truthful information when creating your account; have a valid email address; and not have been previously suspended or removed from our platform. By registering, you confirm that all information you provide is accurate and complete.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">3. User Accounts</h3>
                <p>You are responsible for maintaining the confidentiality of your account credentials. You agree to keep your password secure, notify us immediately of any unauthorized access, not create multiple accounts to bypass usage limits, and not use bots or automated tools to create accounts or use our service. We reserve the right to suspend or terminate accounts that violate these terms.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">4. Community Content &amp; Conduct</h3>
                <p>Stitch lets you post notes, join classes, share quiz scores, post short-lived "stories" (visible to your network for 24 hours before disappearing), message other users, and start voice/video calls. You agree to use these features respectfully and to only share content you have the right to post.</p>
                <p>You must not: upload or share content that is illegal, harmful, offensive, or infringes on others' rights; harass, impersonate, or misrepresent your identity to another user; use bots or automated tools to abuse messaging, calling, or content-generation features; attempt to reverse-engineer, hack, or disrupt our platform; or share, resell, or redistribute study content generated on the platform without permission.</p>
                <p>Voice and video calls on Stitch connect directly between users (peer-to-peer); we do not record or store call content. Stories are automatically removed 24 hours after posting; we are not responsible for content shared or screenshotted by other users before it disappears.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">5. Uploaded Documents &amp; AI-Generated Content</h3>
                <p>Stitch allows you to upload documents (such as PDFs and Word files) so the platform can extract text from them and generate study materials, including notes, summaries, flashcards, and practice questions. By uploading a document, you confirm that you have the right to use and share its contents, and you grant us a limited license to process it solely to generate your study content.</p>
                <p>AI-generated content may occasionally contain errors, should be used as a study aid rather than a definitive academic resource, and depends on the quality of the documents you upload. We are not responsible for academic outcomes based on AI-generated content; always verify it against your original study materials.</p>
                <p>To keep your practice pool useful and avoid wasting your question/flashcard allowance, Stitch automatically checks each upload's extracted content against your other uploaded resources and rejects a file if it detects duplicate content -- including the exact same document uploaded again under a different file name or file type. Rejected duplicates are not processed and do not count against your plan's question/flashcard limit.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">6. Course Payments</h3>
                <p class="text-gray-400 italic">Stitch hosts online courses uploaded by course creators, and pricing for each course is set by the creator, not by Stitch. Pricing will be shown before purchase, and payments are processed by a third-party provider; we do not store card or mobile money details. Refunds are generally not offered for course access already granted, except where required by law; contact us within 7 days of a disputed charge.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">7. Stitch Pro Subscriptions</h3>
                <p>Stitch itself remains free to use. Every new account gets a 7-day free trial with unlimited practice questions, flashcards, and Challenge Arena questions across all uploaded resources, starting from account creation. After the trial ends, every account gets a free pool combined across all of your uploaded resources: up to 20 practice questions, 20 flashcards, and 20 Challenge Arena questions. Stitch Pro and Stitch Pro Plus are optional paid subscriptions, billed monthly, that raise this combined pool once the trial ends:</p>
                <p>&bull; <strong>Stitch Pro</strong> &mdash; GHS 20/month. Raises your combined pool to 50 practice questions, 50 flashcards, and 50 Challenge Arena questions across all uploaded resources.</p>
                <p>&bull; <strong>Stitch Pro Plus</strong> &mdash; GHS 25/month. Raises your combined pool to 70 practice questions, 70 flashcards, and 70 Challenge Arena questions across all uploaded resources.</p>
                <p>Subscription payments are processed by Paystack; we do not store your card or mobile money details, and Paystack's own terms and privacy policy govern how they handle your payment information. Every subscription payment is independently verified against Paystack's records before a plan is activated. When a Pro or Pro Plus subscription expires without renewal, your account automatically returns to the free pool (20 questions / 20 flashcards / 20 Challenge Arena questions); your uploaded resources, notes, and exam history are never deleted as a result. Subscriptions renew automatically at the end of each monthly billing cycle unless cancelled beforehand through the Profile page; cancelling stops future renewals but does not refund the current billing period, except where required by law. Contact us within 7 days of a disputed charge.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">8. Acceptable Use</h3>
                <p>You agree to use Stitch only for lawful purposes, and must not upload illegal or offensive content, attempt to hack or disrupt the platform, infringe others' intellectual property, use bots to abuse our AI, messaging, or calling systems, or impersonate another person or entity.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">9. Data &amp; Privacy</h3>
                <p>We collect account data, uploaded documents, content you create (notes, flashcards, quiz results, stories, messages), usage data, subscription/billing status, and call metadata (not recordings) to provide our service. We do not sell your personal data to third parties: see our Privacy Policy for full details. You may request deletion of your account and data at any time through the Profile page.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">10. Intellectual Property</h3>
                <p>All content, design, and code on the Stitch platform is owned by us and protected under applicable intellectual property laws. You retain ownership of the documents and content you upload or post, and grant us only a limited license to operate the platform and generate your study content. You may not copy, reproduce, or distribute any part of our platform without written permission.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">11. Account Termination</h3>
                <p>You may delete your account at any time through the Profile page, which permanently removes your notes, exam history, and messages. We reserve the right to suspend or terminate accounts that violate these Terms without notice. No refund will be issued for course access or an active Stitch Pro/Pro Plus subscription if your account is terminated for a violation of these Terms.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">12. Limitation of Liability</h3>
                <p>Stitch is provided "as is" without warranties of any kind. To the fullest extent permitted by Ghanaian law, we are not liable for indirect or consequential damages, loss of data or exam content, academic outcomes, content shared by other users, or service interruptions. Our total liability shall not exceed the amount you paid us in the 30 days prior to a claim.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">13. Changes to These Terms</h3>
                <p>We may update these Terms from time to time, including subscription pricing and plan limits, updating the "Last Updated" date above. Continued use of Stitch after changes are posted constitutes acceptance of the updated terms.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">14. Contact Us</h3>
                <p>Questions about these Terms? Email us at support.stitch.io@gmail.com. We aim to respond within 2 business days.</p>
              </div>
            </div>`;
        }

        function privacyPolicyHTML(){
          return `
            ${overlayHeader('Privacy Policy', '20px', "openOverlay('profileMenu')")}
            <div class="flex-1 overflow-y-auto p-5">
              <div class="bg-white rounded-3xl p-5 shadow-sm text-sm leading-relaxed text-gray-600 space-y-3">
                <p class="text-xs text-gray-400">Last updated: August 2026</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">1. Introduction</h3>
                <p>Stitch ("we", "us", "our") is a community and study platform built for university students. We take your privacy seriously. This policy explains what data we collect, how we use it, and your rights regarding your personal information.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">2. Data We Collect</h3>
                <p>We collect only what's necessary to provide the platform: account information (name, email, school/class, encrypted password); profile data (avatar, department, optional profile details); content you create (notes, flashcards, quiz/exam results, stories, messages); uploaded documents (processed to generate study content); usage data (pages visited, features used, session timestamps); and voice/video call metadata (duration, timestamp, not recordings; calls are peer-to-peer and not stored on our servers).</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">3. How We Store Your Data</h3>
                <p>Your data is stored securely using Supabase, which provides a Postgres database, authentication, file storage, and real-time messaging/signaling infrastructure, with encryption in transit and at rest. Uploaded documents are processed to generate study content and are not retained longer than necessary for that purpose.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">4. AI-Generated Content</h3>
                <p>Stitch uses an AI service to generate exam questions, summaries, flashcards, and other study content from your uploaded documents. Documents and prompts sent for this purpose are processed to generate your content and are not used to train AI models on our behalf.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">5. Stories &amp; Ephemeral Content</h3>
                <p>Stories you post are visible to your network for 24 hours and are then automatically removed from the platform. Screenshots or copies made by other users before expiry are outside our control.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">6. Data Sharing</h3>
                <p>We do not sell, rent, or share your personal data with third parties. Your information is only accessible to you, to other users limited to what you choose to share (notes, messages, stories, calls), and to platform administrators for moderation and safety, with strict access controls.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">7. Your Rights</h3>
                <p>Under the Ghana Data Protection Act, 2012 (Act 843) and applicable data protection laws, you have the right to access your data through account settings, correct inaccurate information, delete your account and data, withdraw consent for processing, and port your data as a readable copy.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">8. Account Deletion</h3>
                <p>You can request complete account deletion through the Profile page or by emailing support.stitch.io@gmail.com. We will delete your account, profile data, uploaded documents, message history, and associated records. Some anonymized, aggregated data may be retained for platform improvement purposes.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">9. Cookies &amp; Local Storage</h3>
                <p>We use browser local storage to persist your session state and preferences. We do not use third-party tracking cookies.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">10. Changes to This Policy</h3>
                <p>We may update this policy from time to time and will notify you of significant changes via email or an in-app notification. Continued use of Stitch after changes constitutes acceptance of the updated policy.</p>

                <h3 class="font-bold pt-1" style="background-image:linear-gradient(135deg, #1e90ff, #4169e1 60%, #0a2540);-webkit-background-clip:text;background-clip:text;color:transparent;">11. Contact Us</h3>
                <p>For privacy-related questions or data requests, email us at support.stitch.io@gmail.com.</p>
              </div>
            </div>`;
        }

        const helpFAQData = [
          { category: 'Getting Started', items: [
            { id: 'gs-profile', q: 'How do I set up my profile?', a: 'Open Settings from your profile menu, then tap your photo or name to add a picture, bio, department, and pronouns. You can update any of this again at any time.' },
            { id: 'gs-free', q: 'Is Stitch free to use?', a: "Yes, Stitch itself is free. New accounts get a 7-day free trial with unlimited practice questions, flashcards, and Challenge Arena questions. After the trial, every account gets a free pool across all your uploaded resources: 20 practice questions, 20 flashcards, and 20 Challenge Arena questions. Stitch Pro (GHS 20/month) raises that to 50 each, and Stitch Pro Plus (GHS 25/month) raises it to 70 each. Some courses in the Opportunities tab are also posted by outside creators who set their own price, and payments for both those and Stitch Pro/Pro Plus are handled securely by Paystack." },
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
        function toggleHelpFAQ(id){
          if (helpFAQOpenIds.has(id)) helpFAQOpenIds.delete(id); else helpFAQOpenIds.add(id);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = helpCenterHTML();
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
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">${escapeHtml(section.category)}</div>
              <div class="rounded-2xl border border-gray-100 divide-y px-4" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.07) 0%, rgba(65,105,225,0.07) 100%);background-color:#ffffff;">${section.items.map(helpFAQRow).join('')}</div>
            </div>`;
        }
        function helpCenterHTML(){
          return `
            ${overlayHeader('Help Center', '20px', "openOverlay('profileMenu')")}
            <div class="flex-1 overflow-y-auto px-5 pb-8">
              <p class="text-sm text-gray-500 mb-5">Answers to common questions about using Stitch. Can't find what you need? Reach us below.</p>
              ${helpFAQData.map(helpCategoryCard).join('')}
              <div class="rounded-3xl p-5 text-center mt-4" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                <div class="font-bold text-base mb-1" style="color:${NAVY};">Still need help?</div>
                <div class="text-sm text-gray-500 mb-4">Our support team responds within 24 hours.</div>
                <div class="flex flex-col gap-2.5">
                  <button onclick="openOverlayFrom('helpCenter','contactUs')" class="w-full font-semibold text-sm py-3 rounded-2xl text-white" style="background:rgba(30,144,255,0.5);">Contact Us</button>
                  <button onclick="openOverlayFrom('helpCenter','reportIssue')" class="w-full font-semibold text-sm py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">Report an Issue</button>
                </div>
              </div>
            </div>`;
        }

        let contactFormDraft = { name: '', email: '', message: '' };
        function resetContactFormDraft(){ contactFormDraft = { name: '', email: '', message: '' }; }
        function updateContactField(field, value){ contactFormDraft[field] = value; }
        function contactInfoRow(icon, label, value){
          return `
            <div class="flex items-center px-4 py-3 rounded-2xl mb-2.5 bg-white border border-gray-100">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide">${label}</div>
                <div class="text-sm font-semibold text-gray-800 truncate">${value}</div>
              </div>
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
            ${overlayHeader('Contact Us', '20px')}
            <div class="flex-1 overflow-y-auto px-5">
              <p class="text-sm text-gray-500 mb-5">Have a question, suggestion, or just want to say hi? We'd love to hear from you.</p>
              ${contactInfoRow('mail', 'Email', 'support.stitch.io@gmail.com')}
              ${contactInfoRow('clock', 'Response Time', 'We respond within 24 hours')}
              <div class="mb-4 mt-2">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Name</label>
                <input type="text" value="${escapeHtml(d.name)}" oninput="updateContactField('name', this.value)" placeholder="Your name" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;">
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Email</label>
                <input type="email" value="${escapeHtml(d.email)}" oninput="updateContactField('email', this.value)" placeholder="your@email.com" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;">
              </div>
              <div class="mb-5">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Message</label>
                <textarea oninput="updateContactField('message', this.value)" placeholder="How can we help you?" rows="6" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;resize:none;">${escapeHtml(d.message)}</textarea>
              </div>
              <button onclick="submitContactForm()" class="w-full font-semibold text-sm py-3 rounded-2xl text-white" style="background:rgba(30,144,255,0.5);margin-bottom:10px;">Send Message</button>
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
            ${overlayHeader('Report an Issue', '20px')}
            <div class="flex-1 overflow-y-auto px-5">
              <p class="text-sm text-gray-500 mb-5">Help us improve Stitch by reporting bugs, safety concerns, or suggesting features.</p>
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">What type of issue?</div>
              <div class="mb-5 flex flex-col gap-2.5">
                ${reportIssueTypes.map(t => `
                  <button onclick="setReportIssueType('${t.id}')" class="w-full px-4 py-2.5 rounded-2xl text-sm font-semibold text-left bg-white" style="${d.type === t.id ? `background:rgba(10,37,64,0.08);color:${NAVY};` : `color:#4b5563;`}">
                    <span>${t.label}</span>
                  </button>
                `).join('')}
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Describe the issue</label>
                <textarea oninput="updateReportIssueField('description', this.value)" placeholder="Tell us what happened, what you expected, and any steps to reproduce the issue..." rows="5" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;resize:none;">${escapeHtml(d.description)}</textarea>
              </div>
              <div class="mb-5">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Email for follow-up (optional)</label>
                <input type="email" value="${escapeHtml(d.email)}" oninput="updateReportIssueField('email', this.value)" placeholder="your@email.com" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;">
              </div>
              <button onclick="submitIssueReport()" class="w-full font-semibold text-sm py-3 rounded-2xl text-white" style="background:rgba(30,144,255,0.5);margin-bottom:10px;">Submit Report</button>
            </div>`;
        }

