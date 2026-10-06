const jobsTabs = [['all','All'],['opportunities','Opportunities'],['internships','Internships'],['courses','Courses'],['scholarships','Scholarships'],['others','Others']];
        let careerSearchActive = false;
        let careerSearchQuery = '';

        // ---- Career Space search bar + filter pills ----
        function activateCareerSearch(){
          careerSearchActive = true;
          const bar = document.getElementById('career-searchbar');
          if (bar) bar.innerHTML = careerSearchBarHTML();
          const input = document.getElementById('career-search-input');
          if (input) input.focus();
        }

        function deactivateCareerSearch(){
          careerSearchActive = false;
          careerSearchQuery = '';
          const bar = document.getElementById('career-searchbar');
          if (bar) bar.innerHTML = careerSearchBarHTML();
          const content = document.getElementById('jobs-content');
          if (content) content.innerHTML = jobsContent();
        }

        function onCareerSearchInput(val){
          careerSearchQuery = val;
          const content = document.getElementById('jobs-content');
          if (content) content.innerHTML = jobsContent();
        }

        function careerSearchBarHTML(){
          return careerSearchActive ? `
            <div class="w-full flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm">
              ${Icon('search','w-4 h-4')}
              <input id="career-search-input" type="text" value="${escapeHtml(careerSearchQuery)}" oninput="onCareerSearchInput(this.value)" placeholder="Search opportunities, courses..." class="flex-1 min-w-0 bg-transparent outline-none text-gray-800" autocomplete="off">
              <button onclick="deactivateCareerSearch()" class="text-xs font-semibold flex-shrink-0" style="color:${NAVY};">Cancel</button>
            </div>
          ` : `
            <button onclick="activateCareerSearch()" class="w-full flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm text-left">
              ${Icon('search','w-4 h-4')}<span>Search opportunities, courses...</span>
            </button>
          `;
        }

        function careerFilterPillsHTML(){
          return `
            <div id="career-tabs-scroller" class="pill-bleed flex gap-2 overflow-x-auto no-scrollbar pb-1">
              ${jobsTabs.map(([key,label]) => `
                <button data-tab-key="${key}" onclick="jobsSubTab('${key}')" class="career-tab-pill flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${jobsSub===key ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${jobsSub===key ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${label}</button>
              `).join('')}
            </div>`;
        }

        function scrollActiveCareerTabIntoView(){
          const active = document.querySelector('#career-filterbar [data-tab-key="' + jobsSub + '"]');
          if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        }

        // ---- Job market render + admin menu ----
        function renderJobMarket(){
          const prevCareerScreenEl = document.getElementById('screen');
          const prevCareerScrollTop = prevCareerScreenEl ? prevCareerScreenEl.scrollTop : 0;
          document.getElementById('screen').innerHTML = `
            <div id="career-titlebar" class="sticky top-0 z-20 px-5 pb-3 border-b border-gray-100" style="padding-top:var(--top-safe-pad);background:#f9fafb;">
              <div class="relative flex items-center justify-between">
                <h1 class="text-base font-bold font-display grad-text whitespace-nowrap">Career Space</h1>
                <button id="career-dashes-btn" onclick="toggleCareerMenu()" class="h-10 flex items-center justify-end" style="width:32px;margin-right:-2px;">${gradIcon(Icon('dashesShortRight','w-6 h-6'))}</button>
              </div>
            </div>
            <div id="career-searchbar" class="sticky z-10 bg-gray-50 px-5 pt-4" style="padding-bottom:8px;">
              ${careerSearchBarHTML()}
            </div>
            <div id="career-filterbar" class="sticky z-10 bg-gray-50 px-5 pb-3 border-b border-gray-100">
              ${careerFilterPillsHTML()}
            </div>
            <div class="p-5" id="jobs-content">${jobsContent()}</div>`;
          stickBarsStack(['career-titlebar','career-searchbar','career-filterbar']);
          if (prevCareerScrollTop) {
            const restoredScreenEl = document.getElementById('screen');
            if (restoredScreenEl) {
              restoredScreenEl.scrollTop = prevCareerScrollTop;
            }
          }
          scrollActiveCareerTabIntoView();
        }

        let careerMenuArmed = false;
        let careerMenuScrollAnchor = 0;

        function toggleCareerMenu(){
          if (careerMenuOpen) {
            closeCareerMenuDropdownDom();
          } else {
            openCareerMenuDropdownDom();
          }
        }

        function openCareerMenuDropdownDom(){
          closeCareerMenuDropdownDom();
          careerMenuOpen = true;
          // Bottom sheet that pulls up from below, same as the feed's post/comment menus.
          const wrap = document.createElement('div');
          wrap.innerHTML = careerMenuDropdownHTML();
          while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
        }

        // Kept as a no-op: the old dropdown was sized to its widest item; the sheet is full width.
        function fitCareerMenuDropdownWidth(){}
        function positionCareerMenuDropdown(){}

        function closeCareerMenuDropdownDom(){
          careerMenuOpen = false;
          const dropdown = document.getElementById('career-menu-dropdown');
          const backdrop = document.getElementById('career-menu-backdrop');
          if (dropdown) dropdown.remove();
          if (backdrop) backdrop.remove();
        }

        function careerMenuRowHTML(onclick, icon, label, cls){
          return `
            <button onclick="${onclick}" class="w-full flex items-center gap-5 px-6 py-4 text-left text-base font-semibold ${cls || 'text-gray-800'}" style="background:transparent;">
              <span class="w-6 h-6 flex items-center justify-center flex-shrink-0">${Icon(icon,'w-6 h-6')}</span>
              <span style="font-family:'Colmeak','Montserrat',sans-serif;font-weight:400;font-size:17px;letter-spacing:.01em;">${label}</span>
            </button>`;
        }

        // Post item: admins/approved posters get "Post"; pending shows a status;
        // everyone else gets "Apply to post" (see openPosterApplicationForm).
        function careerMenuPostItemHTML(){
          if (isCurrentUserAdmin() || currentUserPosterStatus === 'approved') {
            return careerMenuRowHTML("closeCareerMenuThen(() => openPostOpportunity())", 'plus', 'Post an Opportunity');
          }
          if (currentUserPosterStatus === 'frozen') {
            return careerMenuRowHTML("closeCareerMenuThen(() => openAppAlertModal('Your poster access is frozen for now. Check your notifications or contact support for details.'))", 'lock', 'Poster access frozen', 'text-gray-400');
          }
          if (currentUserPosterStatus === 'blocked') {
            return careerMenuRowHTML("closeCareerMenuThen(() => openAppAlertModal('This account is not eligible to post opportunities.'))", 'block', 'Posting unavailable', 'text-gray-400');
          }
          if (currentUserPosterStatus === 'pending') {
            return careerMenuRowHTML("closeCareerMenuThen(() => openAppAlertModal('An admin is reviewing your application to post -- you\\'ll get a notification once it\\'s decided.'))", 'clock', 'Application pending', 'text-gray-400');
          }
          return careerMenuRowHTML("closeCareerMenuThen(() => openPosterApplicationForm())", 'plus', 'Apply to post');
        }

        // "Add course & paid classes" lives here (it used to be in the Classroom "+" menus)
        function careerMenuPaidItemHTML(){
          if (isCurrentUserAdmin()) return '';
          // Creator permission is separate from poster approval (plan section 2).
          if (currentUserCreatorStatus === 'approved') return careerMenuRowHTML("closeCareerMenuThen(() => openCreatorWallet())", 'coin', 'Creator wallet');
          if (currentUserCreatorStatus === 'suspended') return careerMenuRowHTML("closeCareerMenuThen(() => openCreatorWallet())", 'lock', 'Creator access paused', 'text-gray-400');
          // First-time applicants (haven't applied to post yet) don't see this at all
          if (currentUserPosterStatus !== 'pending' && currentUserPosterStatus !== 'approved') return '';
          if (currentUserPaidSellerRequested) {
            return careerMenuRowHTML("closeCareerMenuThen(() => openPaidSellerApplicationForm())", 'clock', 'Paid classes request pending', 'text-gray-400');
          }
          return careerMenuRowHTML("closeCareerMenuThen(() => openPaidSellerApplicationForm())", 'plus', 'Add course & paid classes');
        }

        // Shared with refreshPosterStatusUI() below, which swaps this back in live if the sheet
        // happens to be open when a poster_approved/poster_denied notification lands
        function careerMenuDropdownInnerHTML(){
          return `
            <div style="width:48px;height:5px;border-radius:3px;background:#1f2937;margin:2px auto 10px;"></div>
            ${careerMenuRowHTML("closeCareerMenuThen(() => jobsSubTab('saved'))", 'bookmarkOutline', 'Saved')}
            ${careerMenuRowHTML("closeCareerMenuThen(() => openCareerStartForm())", 'file', 'Match with CV')}
            ${careerMenuPostItemHTML()}
            ${careerMenuPaidItemHTML()}
            ${careerMenuRowHTML("closeCareerMenuThen(() => openOverlay('careerAnalytics'))", 'trending', 'Analytics')}`;
        }

        function careerMenuDropdownHTML(){
          return `
            <div id="career-menu-backdrop" onclick="closeCareerMenuDropdownDom()" ontouchmove="event.preventDefault()" style="position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.5);"></div>
            <div id="career-menu-dropdown" class="bg-white" style="position:fixed;left:0;right:0;bottom:0;z-index:11001;border-radius:24px 24px 0 0;padding:10px 0 calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:shareSheetSlideUp .22s cubic-bezier(0.16,1,0.3,1);max-width:640px;margin:0 auto;">
              ${careerMenuDropdownInnerHTML()}
            </div>`;
        }

        // Called the instant a poster_approved/poster_denied notification arrives (see
        // deliverRemoteNotification) so "Poster application pending" doesn't sit stale in the
        // Career Space menu, or in the "Apply to post" overlay, until the next reload
        function refreshPosterStatusUI(){
          if (typeof refreshProfilePosterButton === 'function') refreshProfilePosterButton();
          const dropdown = document.getElementById('career-menu-dropdown');
          if (dropdown) dropdown.innerHTML = careerMenuDropdownInnerHTML();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'posterApplication') {
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = posterApplicationOverlayHTML();
          }
        }

        function closeCareerMenuThen(fn){
          closeCareerMenuDropdownDom();
          fn();
        }

        // NOTE (security): admin identity now comes ONLY from the DB (profiles.role === 'admin'),
        // never from a hardcoded email list. Two reasons: (1) this file ships to every visitor's
        const PROFILES_TABLE = 'profiles';
        const OPPORTUNITIES_TABLE = 'opportunities';
        // Applications live in their own table (one row per applicant per listing)
        const APPLICATIONS_TABLE = 'opportunity_applications';
        // Read-only view of listings WITHOUT inline base64 covers -- what the list screens load.
        const OPPORTUNITIES_LIST_VIEW = 'opportunities_list';
        const NOTIFICATIONS_TABLE = 'notifications';
        const OPPORTUNITY_REPORTS_TABLE = 'opportunity_reports';
        let currentUserRole = 'user';
        let currentUserEmail = null;
        // Synchronous cache of the signed-in user's id, refreshed by loadCurrentUserRole() at boot
        let currentUserId = null;
        // ---- Regular-user "poster" permission state ----
        let currentUserPosterStatus = 'none'; // 'none' | 'pending' | 'approved' | 'denied' | 'frozen' | 'blocked'
        let currentUserPosterIntent = '';     // 'post' | 'explore'
        let currentUserPosterRole = '';       // 'student' | 'entrepreneur' | 'employee' | 'other'
        let currentUserPosterBusinessName = '';
        let currentUserPosterBusinessInfo = '';
        let currentUserPosterBusinessEstablished = ''; // date the business/org was established, 'YYYY-MM-DD'
        let currentUserPosterBusinessCategory = '';    // see POSTER_CATEGORY_OPTIONS
        let currentUserPosterBusinessWebsite = '';
        let currentUserPosterBusinessDocumentUrl = ''; // anything proving the business is real, uploaded during application
        let currentUserPosterIdDocumentUrl = '';       // front of a government-issued ID, uploaded during application
        let currentUserPosterIdDocumentBackUrl = '';   // back of that same ID, optional (some ID types have no back)
        let currentUserPosterProofOfResidenceUrl = ''; // optional -- utility bill, bank statement, tenancy agreement, etc.
        let currentUserPosterIdType = '';              // one of POSTER_ID_TYPE_OPTIONS, e.g. 'National ID', 'Passport'
        let currentUserPosterIdCountry = '';           // 2-letter country that issued the ID -- tells the
                                                        // automated ID check (see verifyPosterIdRemote) which country to check against
        let currentUserPosterIdVerificationStatus = ''; // 'not_started' | 'pending' | 'verified' | 'needs_review' | 'failed' | 'error'
        let currentUserPosterSelfieUrl = '';           // live selfie captured for the automated liveness + face-match check
        let currentUserPosterSelfieVerificationStatus = ''; // 'not_started' | 'pending' | 'verified' | 'needs_review' | 'failed' | 'error'
        let currentUserPosterConsentAccepted = false;  // agreed to Terms/Privacy + post & decision tracking (see posterAppConsentHTML)
        let currentUserPosterConsentAt = '';           // when that agreement was recorded, ISO timestamp

        async function loadCurrentUserRole(){
          currentUserRole = 'user';
          currentUserEmail = null;
          currentUserId = null;
          currentUserPosterStatus = 'none';
          currentUserPosterIntent = '';
          currentUserPosterRole = '';
          currentUserPosterBusinessName = '';
          currentUserPosterBusinessInfo = '';
          currentUserPosterBusinessEstablished = '';
          currentUserPosterBusinessCategory = '';
          currentUserPosterBusinessWebsite = '';
          currentUserPosterBusinessDocumentUrl = '';
          currentUserPosterIdDocumentUrl = '';
          currentUserPosterIdDocumentBackUrl = '';
          currentUserPosterProofOfResidenceUrl = '';
          currentUserPosterIdType = '';
          currentUserPosterIdCountry = '';
          currentUserPosterIdVerificationStatus = '';
          currentUserPosterSelfieUrl = '';
          currentUserPosterSelfieVerificationStatus = '';
          currentUserPosterConsentAccepted = false;
          currentUserPosterConsentAt = '';
          const sb = getSupabaseClient();
          if (!sb) return; 
          try {
            const user = await getCachedAuthUser();
            if (!user) return;
            currentUserEmail = user.email || null;
            currentUserId = user.id;
            const { data: profile, error } = await sb
              .from(PROFILES_TABLE)
              .select('role, poster_status, poster_intent, poster_role, poster_business_name, poster_business_info, poster_business_established, poster_business_category, poster_business_website, poster_business_document_url, poster_id_document_url, poster_id_document_back_url, poster_proof_of_residence_url, poster_id_type, poster_id_country, poster_id_verification_status, poster_selfie_url, poster_selfie_verification_status, poster_consent_accepted, poster_consent_at')
              .eq('user_id', user.id)
              .maybeSingle();
            if (!error && profile) {
              if (profile.role === 'admin') currentUserRole = 'admin';
              currentUserPosterStatus = profile.poster_status || 'none';
              currentUserPosterIntent = profile.poster_intent || '';
              currentUserPosterRole = profile.poster_role || '';
              currentUserPosterBusinessName = profile.poster_business_name || '';
              currentUserPosterBusinessInfo = profile.poster_business_info || '';
              currentUserPosterBusinessEstablished = profile.poster_business_established || '';
              currentUserPosterBusinessCategory = profile.poster_business_category || '';
              currentUserPosterBusinessWebsite = profile.poster_business_website || '';
              currentUserPosterBusinessDocumentUrl = profile.poster_business_document_url || '';
              currentUserPosterIdDocumentUrl = profile.poster_id_document_url || '';
              currentUserPosterIdDocumentBackUrl = profile.poster_id_document_back_url || '';
              currentUserPosterProofOfResidenceUrl = profile.poster_proof_of_residence_url || '';
              currentUserPosterIdType = profile.poster_id_type || '';
              currentUserPosterIdCountry = profile.poster_id_country || '';
              currentUserPosterIdVerificationStatus = profile.poster_id_verification_status || '';
              currentUserPosterSelfieUrl = profile.poster_selfie_url || '';
              currentUserPosterSelfieVerificationStatus = profile.poster_selfie_verification_status || '';
              currentUserPosterConsentAccepted = !!profile.poster_consent_accepted;
              currentUserPosterConsentAt = profile.poster_consent_at || '';
            }
            // Did they already ask to sell paid courses (ticked it while applying, or used the courses
            // form)
            try {
              const { data: paidRow, error: paidErr } = await sb.from(PROFILES_TABLE).select('creator_wants_paid').eq('user_id', user.id).maybeSingle();
              currentUserPaidSellerRequested = !paidErr && !!(paidRow && paidRow.creator_wants_paid);
            } catch (e2) {}
          } catch (e) {  }
          // The role is reset at the start of this function and only known now, so a course or
          // listing page that was opened in the meantime was drawn without the admin Dashboard/Edit
          // menu
          try {
            const ov = document.getElementById('overlay');
            if (ov && typeof currentOverlayKind !== 'undefined') {
              if (currentOverlayKind === 'courseDetail' && typeof courseDetailHTML === 'function') ov.innerHTML = courseDetailHTML();
              else if (currentOverlayKind === 'jobDetail' && typeof jobDetailHTML === 'function') ov.innerHTML = jobDetailHTML();
            }
            if (typeof currentTab !== 'undefined' && currentTab === 2 && typeof renderStudy === 'function') renderStudy();
          } catch (e) {}
        }

        function isCurrentUserAdmin(){
          return currentUserRole === 'admin';
        }

        // Admins can post any type
        function canCurrentUserPost(){
          return isCurrentUserAdmin() || currentUserPosterStatus === 'approved';
        }

        function isJobOwnedByCurrentUser(job){
          // The listing's owner lives on the database row (created_by), which loadOpportunities
          // keeps in oppOwners
          const owner = job && (job.createdByUserId || (typeof oppOwners !== 'undefined' ? oppOwners[job.id] : null));
          return !!(owner && currentUserId && owner === currentUserId);
        }

        // Only the person who posted a listing can open its Dashboard, edit it, delete it, view
        // applicants' documents or change their status
        function canCurrentUserManageJob(job){
          return isJobOwnedByCurrentUser(job);
        }

        // ---- Poster application (the signup Q&A that unlocks posting) ----
        const POSTER_ID_TYPE_OPTIONS = ["National ID", "Passport", "Driver's License", "Voter's Card", "Other"];

        let posterAppDraft = {
          intent: 'explore', role: 'student', businessName: '', businessInfo: '',
          businessEstablished: '', businessEstablishedTyped: '', businessCategory: '', businessWebsite: '',
          businessDocumentFile: null, businessDocumentName: '',
          // Front is required
          idDocumentFile: null, idDocumentName: '', idDocumentFrontPreviewUrl: '',
          idDocumentBackFile: null, idDocumentBackName: '', idDocumentBackPreviewUrl: '',
          proofOfResidenceFile: null, proofOfResidenceName: '', proofOfResidencePreviewUrl: '',
          idType: POSTER_ID_TYPE_OPTIONS[0], idCountry: '',
          // Live selfie for the automated liveness + face-match check (Smile ID)
          selfieFile: null, selfieName: '', selfiePreviewUrl: '',
          consent: false,
          // Paid courses / paid meetings (asked right before the documents are sent)
          interests: [], sellPaid: false, paidOnly: false, paidType: '', paidPlan: '', paidPrice: '', paidPayout: '',
          ageConfirmed: false, paidTermsAck: false,
        };
        function resetPosterAppDraft(){
          posterAppDraft = {
            intent: currentUserPosterIntent || 'explore',
            role: currentUserPosterRole || 'student',
            businessName: currentUserPosterBusinessName || '',
            businessInfo: currentUserPosterBusinessInfo || '',
            businessEstablished: currentUserPosterBusinessEstablished || '',
            // What's shown in the typed DD/MM/YYYY box
            businessEstablishedTyped: posterAppIsoToTyped(currentUserPosterBusinessEstablished || ''),
            businessCategory: currentUserPosterBusinessCategory || '',
            businessWebsite: currentUserPosterBusinessWebsite || '',
            // Files/photo are never pre-filled from a past application
            businessDocumentFile: null, businessDocumentName: '',
            idDocumentFile: null, idDocumentName: '', idDocumentFrontPreviewUrl: '',
            idDocumentBackFile: null, idDocumentBackName: '', idDocumentBackPreviewUrl: '',
            proofOfResidenceFile: null, proofOfResidenceName: '', proofOfResidencePreviewUrl: '',
            idType: currentUserPosterIdType || POSTER_ID_TYPE_OPTIONS[0], idCountry: currentUserPosterIdCountry || '',
            selfieFile: null, selfieName: '', selfiePreviewUrl: '',
            // Re-confirmed on every application (including a reapply), rather than carried over from
            // currentUserPosterConsentAccepted
            consent: false,
            interests: [], sellPaid: false, paidOnly: false, paidType: '', paidPlan: '', paidPrice: '', paidPayout: '',
            ageConfirmed: false, paidTermsAck: false,
          };
        }
        function setPosterAppConsent(checked){
          posterAppDraft.consent = !!checked;
          posterAppSyncNext();
          const err = document.getElementById('poster-app-stage-error');
          if (err) err.style.display = 'none';
          const authErr = document.getElementById('auth-poster-app-error');
          if (authErr) authErr.classList.remove('show');
        }
        function setPosterAppIntent(intent){
          posterAppDraft.intent = intent;
          const el = document.getElementById('poster-app-form');
          if (el) el.outerHTML = posterApplicationFormHTML();
        }
        function setPosterAppRole(role){
          posterAppDraft.role = role;
          const el = document.getElementById('poster-app-form');
          if (el) el.outerHTML = posterApplicationFormHTML();
          posterAppSyncNext();
        }
        function setPosterAppCategory(category){
          posterAppDraft.businessCategory = category;
          const el = document.getElementById('poster-app-form');
          if (el) el.outerHTML = posterApplicationFormHTML();
          posterAppSyncNext();
        }
        function updatePosterAppField(field, value){
          posterAppDraft[field] = value;
          posterAppSyncNext();
          const authErr = document.getElementById('auth-poster-app-error'); if (authErr) authErr.classList.remove('show');
        }
        // "Next" only shows once the current question has an answer (selected / started typing).
        function posterAppStageReady(stage){
          const d = posterAppDraft;
          if (stage === 'role') return !!d.role;
          if (stage === 'bizname') return !!(d.businessName || '').trim();
          if (stage === 'bizestablished') return !!(d.businessEstablishedTyped || '').trim();
          if (stage === 'bizcategory') return !!d.businessCategory;
          if (stage === 'bizwebsite') return !!(d.businessWebsite || '').trim();
          if (stage === 'bizdesc') return !!(d.businessInfo || '').trim();
          if (stage === 'bizdoc') return !!(d.businessDocumentFile || (typeof currentUserPosterBusinessDocumentUrl !== 'undefined' && currentUserPosterBusinessDocumentUrl));
          if (stage === 'iddoc') return !!(d.idDocumentFile || (typeof currentUserPosterIdDocumentUrl !== 'undefined' && currentUserPosterIdDocumentUrl));
          if (stage === 'selfie') return !!(d.selfieFile || (typeof currentUserPosterSelfieUrl !== 'undefined' && currentUserPosterSelfieUrl));
          if (stage === 'consent') return !!d.consent;
          if (stage === 'paidtype') return !!d.paidType;
          if (stage === 'paidprice') return !!d.paidPrice;
          if (stage === 'paidpayout') return !!d.paidPayout;
          if (stage === 'paidplan') return posterAppWordCount(d.paidPlan) >= PAID_SELLER_MIN_PLAN_WORDS;
          if (stage === 'paidconfirm') return !!(d.ageConfirmed && d.paidTermsAck);
          return true;
        }
        function posterAppSyncNext(){
          const wrap = document.getElementById('poster-app-next-wrap');
          if (!wrap || typeof posterAppStages === 'undefined') return;
          const list = posterAppStages();
          const stage = list[Math.min(Math.max(posterAppStageIdx, 0), list.length - 1)];
          wrap.style.display = posterAppStageReady(stage) ? '' : 'none';
        }

        // ---- Typed "date established" input ----
        function posterAppIsoToTyped(iso){
          const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
          return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
        }
        function posterAppFormatTypedDate(raw){
          const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
          let out = digits.slice(0, 2);
          if (digits.length > 2) out += '/' + digits.slice(2, 4);
          if (digits.length > 4) out += '/' + digits.slice(4, 8);
          return out;
        }
        // -> { iso, error }. An empty box is fine (iso ''), a half-typed or impossible date is not
        function posterAppParseTypedDate(typed){
          const str = String(typed || '').trim();
          if (!str) return { iso: '', error: null };
          const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
          if (!m) return { iso: '', error: 'Please enter the full date as DD/MM/YYYY, for example 14/03/2019.' };
          const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
          if (year < 1800) return { iso: '', error: 'Please enter a valid year.' };
          const dt = new Date(year, month - 1, day);
          if (month < 1 || month > 12 || dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
            return { iso: '', error: "That date doesn't look right. Please check the day and month." };
          }
          const today = new Date(); today.setHours(0, 0, 0, 0);
          if (dt.getTime() > today.getTime()) return { iso: '', error: "The date can't be in the future." };
          return { iso: `${m[3]}-${m[2]}-${m[1]}`, error: null };
        }
        function posterAppOnEstablishedInput(el){
          const formatted = posterAppFormatTypedDate(el.value);
          if (el.value !== formatted) el.value = formatted;
          posterAppDraft.businessEstablishedTyped = formatted;
          posterAppSyncNext();
          const parsed = posterAppParseTypedDate(formatted);
          posterAppDraft.businessEstablished = parsed.error ? '' : parsed.iso;
          // Clear any error left over from a previous Next tap as soon as they start fixing it.
          const authErr = document.getElementById('auth-poster-app-error');
          if (authErr) authErr.classList.remove('show');
          const ovErr = document.getElementById('poster-app-stage-error');
          if (ovErr) ovErr.style.display = 'none';
        }
        // Returns an error message, or null when the box is empty or holds a valid date.
        function posterAppEstablishedError(){
          return posterAppParseTypedDate(posterAppDraft.businessEstablishedTyped).error;
        }
        function posterAppEstablishedInputHTML(inputId, onEnter){
          const typed = posterAppDraft.businessEstablishedTyped || '';
          const enterAttr = onEnter ? ` onkeydown="if(event.key==='Enter'){event.preventDefault();${onEnter};}"` : '';
          return `
            <input type="text" id="${inputId}" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" oninput="posterAppOnEstablishedInput(this)"${enterAttr} value="${escapeHtml(typed)}" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none">
            <div style="font-size:12px;color:#9ca3af;margin-top:8px;">Format: DD/MM/YYYY (for example 14/03/2019)</div>`;
        }

        // ---- Shared ID/document upload tile ----
        function posterAppUploadTileHTML(o){
          // o: { label, inputId, onSelect, onRemove, file, previewUrl, existingUrl, accept, hint }
          const file = o.file || null;
          const previewUrl = o.previewUrl || o.existingUrl || '';
          const hasPreview = !!previewUrl;
          const isPdf = file ? /pdf/i.test((file.type || '') + (file.name || '')) : /\.pdf(\?|$)/i.test(previewUrl);
          // Short, fixed document names instead of real file names (which are often too long to fit)
          const lbl = String(o.label || '');
          const docName = /^front/i.test(lbl) ? 'ID - Front' : /^back/i.test(lbl) ? 'ID - Back' : /^proof/i.test(lbl) ? 'Residence' : /^selfie/i.test(lbl) ? 'Selfie' : 'Paperwork';
          const fileName = (file || hasPreview) ? docName : '';
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${escapeHtml(o.label)}</label>
              <input type="file" accept="${o.accept || 'image/*,.pdf'}" ${o.capture ? `capture="${o.capture}"` : ''} id="${o.inputId}" class="hidden" onchange="${o.onSelect}(this)">
              <div onclick="${hasPreview ? '' : `document.getElementById('${o.inputId}').click()`}" style="position:relative;height:120px;border-radius:16px;overflow:hidden;background:#f3f4f6;border:1.5px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;cursor:${hasPreview ? 'default' : 'pointer'};">
                ${!hasPreview
                  ? `<span style="display:flex;flex-direction:column;align-items:center;gap:6px;color:#9ca3af;">${Icon('camera','w-6 h-6')}<span style="font-size:11px;font-weight:600;">Tap to upload</span></span>`
                  : isPdf
                    ? `<span style="display:flex;flex-direction:column;align-items:center;gap:6px;color:#6b7280;">${Icon('file','w-7 h-7')}<span style="font-size:11px;font-weight:600;">${escapeHtml(fileName)}</span></span>`
                    : `<img src="${escapeHtml(previewUrl)}" style="width:100%;height:100%;object-fit:cover;">`}
              </div>
              ${hasPreview ? `
              <div style="display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-top:6px;">
                <button type="button" onclick="document.getElementById('${o.inputId}').click()" style="font-size:12px;font-weight:700;color:${ROYAL};background:none;border:none;padding:0;">Change</button>
                <button type="button" onclick="${o.onRemove}()" style="font-size:12px;font-weight:700;color:#e11d48;background:none;border:none;padding:0;">Remove</button>
              </div>` : ''}
              ${o.hint ? `<div class="text-[11px] text-gray-400 mt-1">${escapeHtml(o.hint)}</div>` : ''}
            </div>`;
        }

        // ---- File validation ----
        const FILE_ACCEPT_PROFILES = {
          photo:       { label: 'photo',                maxMB: 8,  mime: [/^image\//],                                                                                                              ext: ['.jpg','.jpeg','.png','.webp','.heic','.heif','.gif'] },
          idDoc:       { label: 'ID document',          maxMB: 10, mime: [/^image\//, 'application/pdf'],                                                                                            ext: ['.jpg','.jpeg','.png','.webp','.heic','.heif','.pdf'] },
          proofOfResidence: { label: 'proof of residence', maxMB: 10, mime: [/^image\//, 'application/pdf'],                                                                                         ext: ['.jpg','.jpeg','.png','.webp','.heic','.heif','.pdf'] },
          selfie:      { label: 'selfie',                maxMB: 8,  mime: [/^image\//],                                                                                                              ext: ['.jpg','.jpeg','.png','.webp','.heic','.heif'] },
          bizDoc:      { label: 'business document',    maxMB: 10, mime: [/^image\//, 'application/pdf'],                                                                                            ext: ['.jpg','.jpeg','.png','.webp','.heic','.heif','.pdf'] },
          coverLetter: { label: 'application file',     maxMB: 8,  mime: ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],        ext: ['.pdf','.doc','.docx'] },
          resume:      { label: 'resume/CV',            maxMB: 8,  mime: ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'],        ext: ['.pdf','.doc','.docx'] },
          coverImage:  { label: 'image',                 maxMB: 8,  mime: [/^image\//],                                                                                                              ext: ['.jpg','.jpeg','.png','.webp','.gif'] },
          other:       { label: 'document',             maxMB: 10, mime: [/^image\//, 'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ext: ['.jpg','.jpeg','.png','.webp','.heic','.heif','.pdf','.doc','.docx'] },
        };
        function formatFileSize(bytes){
          if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
          return Math.max(1, Math.round(bytes / 1024)) + 'KB';
        }
        // Returns { ok:true } or { ok:false, message } -- callers show `message` in the existing
        // alert modal and stop, rather than accepting the file into a draft or preview.
        function validateSelectedFile(file, profileKey){
          const profile = FILE_ACCEPT_PROFILES[profileKey];
          if (!file) return { ok: false, message: 'No file was selected. Please try again.' };
          if (!profile) return { ok: true };
          if (file.size === 0) return { ok: false, message: `That ${profile.label} looks empty. Please choose a different file.` };
          const maxBytes = profile.maxMB * 1024 * 1024;
          if (file.size > maxBytes) {
            return { ok: false, message: `That ${profile.label} is ${formatFileSize(file.size)}, which is over the ${profile.maxMB}MB limit. Please choose a smaller file.` };
          }
          const name = (file.name || '').toLowerCase();
          const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
          const mimeOk = profile.mime.some(m => (m instanceof RegExp) ? m.test(file.type || '') : (file.type === m));
          const extOk = profile.ext.includes(ext);
          if (!mimeOk && !extOk) {
            return { ok: false, message: `That doesn't look like a supported ${profile.label}. Accepted types: ${profile.ext.join(', ')}.` };
          }
          return { ok: true };
        }
        // Runs validateSelectedFile and, on failure, alerts the person and clears the <input> so
        // they can immediately try again with a different file (an untouched input showing the
        // rejected filename would look like it was accepted)
        function validateOrRejectFile(input, file, profileKey){
          const result = validateSelectedFile(file, profileKey);
          if (!result.ok) {
            if (input) input.value = '';
            openAppAlertModal(result.message, 'File not accepted');
          }
          return result.ok;
        }

        function posterAppHandleBizDocSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (!validateOrRejectFile(input, file, 'bizDoc')) return;
          posterAppDraft.businessDocumentFile = file;
          // Shown as just "Paperwork" -- real file names are often far too long to fit.
          posterAppDraft.businessDocumentName = 'Paperwork';
          const label = document.getElementById('poster-app-bizdoc-label');
          if (label) label.textContent = posterAppDraft.businessDocumentName;
          posterAppSyncNext();
        }
        // Frees a previously created object URL (if any) before it's replaced or the tile is reset
        function posterAppRevokePreviewUrl(url){
          if (url) { try { URL.revokeObjectURL(url); } catch (e) {} }
        }
        // Front of the ID -- required
        function posterAppHandleIdFrontSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (!validateOrRejectFile(input, file, 'idDoc')) return;
          posterAppRevokePreviewUrl(posterAppDraft.idDocumentFrontPreviewUrl);
          posterAppDraft.idDocumentFile = file;
          posterAppDraft.idDocumentName = file.name || 'Document selected';
          posterAppDraft.idDocumentFrontPreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          posterAppDraft.idDocumentVerifiedFile = null; // force a re-check of the new file
          posterAppRenderStage();
        }
        function posterAppRemoveIdFront(){
          posterAppRevokePreviewUrl(posterAppDraft.idDocumentFrontPreviewUrl);
          posterAppDraft.idDocumentFile = null;
          posterAppDraft.idDocumentName = '';
          posterAppDraft.idDocumentFrontPreviewUrl = '';
          posterAppDraft.idDocumentVerifiedFile = null;
          currentUserPosterIdDocumentUrl = ''; // also clears a previously-submitted front image
          posterAppRenderStage();
        }
        // Back of the ID -- optional (a passport, for example, has no meaningful back).
        function posterAppHandleIdBackSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (!validateOrRejectFile(input, file, 'idDoc')) return;
          posterAppRevokePreviewUrl(posterAppDraft.idDocumentBackPreviewUrl);
          posterAppDraft.idDocumentBackFile = file;
          posterAppDraft.idDocumentBackName = file.name || 'Document selected';
          posterAppDraft.idDocumentBackPreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          posterAppRenderStage();
        }
        function posterAppRemoveIdBack(){
          posterAppRevokePreviewUrl(posterAppDraft.idDocumentBackPreviewUrl);
          posterAppDraft.idDocumentBackFile = null;
          posterAppDraft.idDocumentBackName = '';
          posterAppDraft.idDocumentBackPreviewUrl = '';
          currentUserPosterIdDocumentBackUrl = '';
          posterAppRenderStage();
        }
        // Live selfie -- required, right after the ID upload
        function posterAppHandleSelfieSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (!validateOrRejectFile(input, file, 'selfie')) return;
          posterAppRevokePreviewUrl(posterAppDraft.selfiePreviewUrl);
          posterAppDraft.selfieFile = file;
          posterAppDraft.selfieName = file.name || 'Selfie captured';
          posterAppDraft.selfiePreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          posterAppRenderStage();
        }
        function posterAppRemoveSelfie(){
          posterAppRevokePreviewUrl(posterAppDraft.selfiePreviewUrl);
          posterAppDraft.selfieFile = null;
          posterAppDraft.selfieName = '';
          posterAppDraft.selfiePreviewUrl = '';
          currentUserPosterSelfieUrl = ''; // also clears a previously-submitted selfie
          posterAppRenderStage();
        }
        // Proof of residence -- optional (e.g. a utility bill, bank statement, tenancy agreement).
        function posterAppHandleProofOfResidenceSelected(input){
          const file = input.files && input.files[0];
          if (!file) return;
          if (!validateOrRejectFile(input, file, 'proofOfResidence')) return;
          posterAppRevokePreviewUrl(posterAppDraft.proofOfResidencePreviewUrl);
          posterAppDraft.proofOfResidenceFile = file;
          posterAppDraft.proofOfResidenceName = file.name || 'Document selected';
          posterAppDraft.proofOfResidencePreviewUrl = /^image\//.test(file.type || '') ? URL.createObjectURL(file) : '';
          posterAppRenderStage();
        }
        function posterAppRemoveProofOfResidence(){
          posterAppRevokePreviewUrl(posterAppDraft.proofOfResidencePreviewUrl);
          posterAppDraft.proofOfResidenceFile = null;
          posterAppDraft.proofOfResidenceName = '';
          posterAppDraft.proofOfResidencePreviewUrl = '';
          currentUserPosterProofOfResidenceUrl = '';
          posterAppRenderStage();
        }

        // ---- Automated ID verification (Smile ID) ----
        async function verifyPosterIdRemote(userId){
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) return false;
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/verify-poster-id`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'apikey': SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ user_id: userId }),
            });
            return res.ok;
          } catch (e) { console.warn('verifyPosterIdRemote failed:', e); return false; }
        }

        // ---- Automated selfie verification (Smile ID liveness + face match) ----
        async function verifyPosterSelfieRemote(userId){
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) return false;
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/verify-poster-selfie`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'apikey': SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ user_id: userId }),
            });
            return res.ok;
          } catch (e) { console.warn('verifyPosterSelfieRemote failed:', e); return false; }
        }

        let posterAppSubmitInFlight = false;
        let posterSubmitBlockedMessage = '';

        // Saves the application (pending for 'post', none for 'explore') and notifies admins
        async function submitPosterApplication(){
          if (posterAppSubmitInFlight) return false;
          posterAppSubmitInFlight = true;
          try {
            const sb = getSupabaseClient();
            const user = sb ? await getCachedAuthUser() : null;
            if (!sb || !user) return false;
            posterSubmitBlockedMessage = '';
            // A frozen or blocked account can never overwrite its status by re-submitting.
            if (currentUserPosterStatus === 'frozen' || currentUserPosterStatus === 'blocked') {
              posterSubmitBlockedMessage = currentUserPosterStatus === 'frozen'
                ? 'Your poster access is frozen, so you can’t apply right now.'
                : 'This account is not eligible to post opportunities.';
              return false;
            }
            const intent = posterAppDraft.intent === 'post' ? 'post' : 'explore';
            const posterStatus = intent === 'post' ? 'pending' : 'none';
            // Uploads happen at submit time, once we know the account exists (mirrors how the profile
            // photo is handled during onboarding in games.js)
            let businessDocumentUrl = currentUserPosterBusinessDocumentUrl || '';
            let idDocumentUrl = currentUserPosterIdDocumentUrl || '';
            let idDocumentBackUrl = currentUserPosterIdDocumentBackUrl || '';
            let proofOfResidenceUrl = currentUserPosterProofOfResidenceUrl || '';
            let selfieUrl = currentUserPosterSelfieUrl || '';
            if (posterAppDraft.businessDocumentFile) {
              const uploaded = await uploadPosterBusinessDocumentToStorage(posterAppDraft.businessDocumentFile);
              if (uploaded) businessDocumentUrl = uploaded;
            }
            if (posterAppDraft.idDocumentFile) {
              const uploaded = await uploadPosterIdDocumentToStorage(posterAppDraft.idDocumentFile, 'front');
              if (uploaded) idDocumentUrl = uploaded;
            }
            if (posterAppDraft.idDocumentBackFile) {
              const uploaded = await uploadPosterIdDocumentToStorage(posterAppDraft.idDocumentBackFile, 'back');
              if (uploaded) idDocumentBackUrl = uploaded;
            }
            if (posterAppDraft.proofOfResidenceFile) {
              const uploaded = await uploadPosterProofOfResidenceToStorage(posterAppDraft.proofOfResidenceFile);
              if (uploaded) proofOfResidenceUrl = uploaded;
            }
            if (posterAppDraft.selfieFile) {
              const uploaded = await uploadPosterSelfieToStorage(posterAppDraft.selfieFile);
              if (uploaded) selfieUrl = uploaded;
            }
            // A fresh front-of-ID upload means the old automated check (if any) no longer applies to
            // whatever's on file now
            if (typeof syncPublicProfile === 'function') {
              try { await Promise.race([syncPublicProfile(), new Promise(r => setTimeout(r, 4000))]); } catch (e) {}
            }
            const idChanged = !!posterAppDraft.idDocumentFile;
            // Same idea for the selfie
            const selfieChanged = !!posterAppDraft.selfieFile;
            const posterRow = {
              user_id: user.id,
              poster_email: user.email || currentUserEmail || '',
              poster_intent: intent,
              poster_role: posterAppDraft.role || '',
              poster_business_name: (posterAppDraft.businessName || '').trim(),
              poster_business_info: (posterAppDraft.businessInfo || '').trim(),
              poster_business_established: posterAppDraft.businessEstablished || '',
              poster_business_category: posterAppDraft.businessCategory || '',
              poster_business_website: (posterAppDraft.businessWebsite || '').trim(),
              poster_business_document_url: businessDocumentUrl,
              poster_id_document_url: idDocumentUrl,
              poster_id_document_back_url: idDocumentBackUrl,
              poster_proof_of_residence_url: proofOfResidenceUrl,
              poster_id_type: (posterAppDraft.idType || currentUserPosterIdType || '').trim(),
              poster_id_country: (posterAppDraft.idCountry || currentUserPosterIdCountry || '').trim().toUpperCase(),
              poster_id_verification_status: idChanged ? 'pending' : (currentUserPosterIdVerificationStatus || 'not_started'),
              poster_selfie_url: selfieUrl,
              poster_selfie_verification_status: selfieChanged ? 'pending' : (currentUserPosterSelfieVerificationStatus || 'not_started'),
              poster_status: posterStatus,
              poster_applied_at: new Date().toISOString(),
              // Recorded from the "consent" stage (posterAppStageHTML / authPosterAppStageHTML):
              // agreement to the Terms/Privacy Policy, and to Stitch tracking the opportunities this
              // person posts and the decisions (approve/deny/remove) made on them
              poster_consent_accepted: !!posterAppDraft.consent,
              poster_consent_at: posterAppDraft.consent ? new Date().toISOString() : (currentUserPosterConsentAt || null),
            };
            let { error } = await sb.from(PROFILES_TABLE).upsert(posterRow, { onConflict: 'user_id' });
            // poster_email is a newer column: if the database hasn't been updated yet, retry without
            // it
            if (error && /poster_email/i.test(error.message || '')) {
              delete posterRow.poster_email;
              ({ error } = await sb.from(PROFILES_TABLE).upsert(posterRow, { onConflict: 'user_id' }));
            }
            if (error) {
              console.warn('Poster application did not save:', error);
              if (/poster_blocked/i.test((error.message || '') + (error.details || '') + (error.hint || ''))) {
                posterSubmitBlockedMessage = 'These details can’t be used to apply. The account, business or ID has been permanently blocked from posting.';
              }
              return false;
            }
            currentUserPosterStatus = posterStatus;
            currentUserPosterIntent = intent;
            currentUserPosterRole = posterAppDraft.role || '';
            currentUserPosterBusinessName = (posterAppDraft.businessName || '').trim();
            currentUserPosterBusinessInfo = (posterAppDraft.businessInfo || '').trim();
            currentUserPosterBusinessEstablished = posterAppDraft.businessEstablished || '';
            currentUserPosterBusinessCategory = posterAppDraft.businessCategory || '';
            currentUserPosterBusinessWebsite = (posterAppDraft.businessWebsite || '').trim();
            currentUserPosterBusinessDocumentUrl = businessDocumentUrl;
            currentUserPosterIdDocumentUrl = idDocumentUrl;
            currentUserPosterIdDocumentBackUrl = idDocumentBackUrl;
            currentUserPosterProofOfResidenceUrl = proofOfResidenceUrl;
            currentUserPosterIdType = (posterAppDraft.idType || currentUserPosterIdType || '').trim();
            currentUserPosterIdCountry = (posterAppDraft.idCountry || currentUserPosterIdCountry || '').trim().toUpperCase();
            currentUserPosterSelfieUrl = selfieUrl;
            if (idChanged) currentUserPosterIdVerificationStatus = 'pending';
            if (selfieChanged) currentUserPosterSelfieVerificationStatus = 'pending';
            if (posterAppDraft.consent) {
              currentUserPosterConsentAccepted = true;
              currentUserPosterConsentAt = new Date().toISOString();
            }
            const alsoPaid = posterStatus === 'pending' && !!posterAppDraft.sellPaid;
            if (alsoPaid) await savePaidSellerAnswers(sb, user);
            if (posterStatus === 'pending') {
              notifyAllAdminsRemote({
                type: 'poster_application',
                title: 'New poster application',
                message: `${(typeof profileData !== 'undefined' && profileData.name) || 'A user'} wants to post opportunities on Career Space${alsoPaid ? ' and sell paid courses and meetings' : ''}.${(posterAppDraft.interests && posterAppDraft.interests.length) ? ' Picked: ' + posterAppDraft.interests.join(', ') + '.' : ''} Review it on the Admin Dashboard.`,
              });
            }
            // Kick off the automated ID check server-side (see verify-poster-id edge function)
            // whenever there's a new ID image to check
            if (idChanged && posterStatus === 'pending') {
              verifyPosterIdRemote(user.id).catch(() => {});
            }
            // Same idea for the selfie
            if (selfieChanged && posterStatus === 'pending') {
              verifyPosterSelfieRemote(user.id).catch(() => {});
            }
            // Make sure this account's name/username/photo are in PUBLIC_PROFILES_TABLE before an
            // admin looks at the application
            if (typeof syncPublicProfile === 'function') { try { await syncPublicProfile(); } catch (e) {} }
            return true;
          } catch (e) { console.warn('Poster application threw an error:', e); return false; }
          finally { posterAppSubmitInFlight = false; }
        }

        // Reached only from an explicit "I want to post" action (the Career Space menu's "Apply to
        // post" item, or trying to post without permission)
        function openPosterApplicationForm(){
          resetPosterAppDraft();
          posterAppDraft.intent = 'post';
          posterAppStageIdx = 0;
          openOverlay('posterApplication');
        }

        // Reached from "Add course & paid classes" in the Career Space menu, which only shows once
        // someone has applied to post (pending or approved) without ticking the paid-courses box
        function openPaidSellerApplicationForm(){
          if (isCurrentUserAdmin()) { openAppAlertModal('Admins can already create paid classes and courses.'); return; }
          if (currentUserPaidSellerRequested) { openAppAlertModal(`Your request to sell paid courses and classes is with an admin -- you'll hear back within ${PAID_SELLER_APPROVAL_HOURS} hours.`); return; }
          resetPosterAppDraft();
          posterAppDraft.intent = 'post';
          posterAppDraft.sellPaid = true;
          posterAppDraft.paidOnly = true;
          posterAppStageIdx = 0;
          openOverlay('posterApplication');
        }

        const POSTER_ROLE_OPTIONS = [
          ['student', 'Student', 'graduateOutline'],
          ['entrepreneur', 'Entrepreneur', 'rocketOutline'],
          ['employee', 'Employee', 'briefcaseOutline'],
          ['freelancer', 'Freelancer', 'laptopOutline'],
          ['educator', 'Educator / Tutor', 'bookOutline'],
          ['creator', 'Content creator', 'filmOutline'],
          ['organization', 'Organization / NGO', 'buildingOutline'],
          ['other', 'Other', 'dotsCircleOutline'],
        ];

        const POSTER_CATEGORY_OPTIONS = [
          ['retail', 'Retail & Commerce', 'cartOutline'],
          ['tech', 'Tech & Software', 'codeOutline'],
          ['food', 'Food & Beverage', 'foodOutline'],
          ['education', 'Education & Tutoring', 'graduateOutline'],
          ['creative', 'Creative & Design', 'brushOutline'],
          ['services', 'Professional Services', 'briefcaseOutline'],
          ['fashion', 'Fashion & Beauty', 'shirtOutline'],
          ['health', 'Health & Wellness', 'heartPulseOutline'],
          ['finance', 'Finance & Fintech', 'moneyOutline'],
          ['media', 'Media & Entertainment', 'filmOutline'],
          ['agriculture', 'Agriculture', 'leafOutline'],
          ['realestate', 'Real Estate', 'homeKeyOutline'],
          ['logistics', 'Logistics & Transport', 'truckOutline'],
          ['nonprofit', 'Non-profit & Community', 'users'],
          ['other', 'Other', 'dotsCircleOutline'],
        ];

        // One shared look for every single-choice pill in onboarding / "Apply to post": white pill
        // + soft shadow + optional icon, selected = blue outline (styles: .auth-intent-chip in
        // styles.css, the same chips used on "What brings you here?")
        function stitchChipRowHTML(options, isOn, onclickFn, noIcons){
          return `<div class="auth-intent-row">${options.map(([key, label, icon]) => `
            <button type="button" aria-pressed="${isOn(key)}" onclick="${onclickFn}('${key}')" class="auth-intent-chip ${isOn(key) ? 'on' : ''}">${icon && !noIcons ? Icon(icon, 'w-4 h-4') : ''}<span>${label}</span></button>`).join('')}
          </div>`;
        }

        // ---- In-app "Apply to post": one question per page ----
        const PAID_SELLER_SHARE_PCT = 20;          // Stitch's share of every sale
        // Withdrawal schedule (the database enforces it
        const PAID_SELLER_FIRST_WAIT_DAYS = 14;
        const PAID_SELLER_GAP_DAYS = [7, 7];
        const PAID_SELLER_GAP_DAYS_AFTER = 2;
        const PAID_SELLER_SCHEDULE_TEXT = `Your first withdrawal opens ${PAID_SELLER_FIRST_WAIT_DAYS} days after your first sale. The next two are ${PAID_SELLER_GAP_DAYS[0]} days apart, and after that you can withdraw every ${PAID_SELLER_GAP_DAYS_AFTER} days.`;
        const PAID_SELLER_MIN_WITHDRAWAL = 'GH₵50';
        const PAID_SELLER_APPROVAL_HOURS = 72;     // withdrawals are approved within this
        const PAID_SELLER_MIN_AGE = 18;
        const PAID_SELLER_MIN_ADDRESS_CHARS = 10;
        const PAID_SELLER_MIN_PLAN_WORDS = 15;
        // The paid-seller questions, in order
        const PAID_SELLER_STAGES = ['paidtype', 'paidplan', 'paidprice', 'paidpay', 'paidpayout', 'paidconfirm'];
        const PAID_TYPE_OPTIONS = [['courses', 'Paid courses', 'coin'], ['meetings', 'Paid live classes / meetings', 'video'], ['both', 'Both', 'grid']];
        const PAID_PRICE_OPTIONS = [['under50', 'Under GH₵50', 'tagOutline'], ['50-200', 'GH₵50 – 200', 'tagOutline'], ['200-500', 'GH₵200 – 500', 'tagOutline'], ['500plus', 'GH₵500+', 'tagOutline'], ['unsure', 'Not sure yet', 'helpCircleOutline']];
        const PAID_PAYOUT_OPTIONS = [['momo', 'Mobile money', 'phoneMoneyOutline'], ['bank', 'Bank account', 'bankOutline']];
        function paidOptionLabel(list, key){ const hit = list.find(([k]) => k === key); return hit ? hit[1] : ''; }
        // Works in both flows: sign-up (auth panel visible) and the in-app overlay.
        function posterAppIsAuthFlow(){
          const p = document.getElementById('auth-panel-poster-app');
          return !!(p && p.classList.contains('active'));
        }
        function posterAppRerender(){
          if (posterAppIsAuthFlow() && typeof authRenderPosterAppStage === 'function') authRenderPosterAppStage();
          else posterAppRenderStage();
        }
        function setPosterAppPaidChoice(field, value){
          posterAppDraft[field] = value;
          posterAppRerender();
          const err = document.getElementById('poster-app-stage-error'); if (err) err.style.display = 'none';
          const authErr = document.getElementById('auth-poster-app-error'); if (authErr) authErr.classList.remove('show');
        }
        let currentUserPaidSellerRequested = false; // set after a successful submit this session

        function posterAppPaidOnlyApproved(){
          return !!(posterAppDraft.paidOnly && (isCurrentUserAdmin() || currentUserPosterStatus === 'approved' || currentUserPosterStatus === 'pending'));
        }
        // The page list depends on the answers so far: the paid pages only appear when the person
        // says they'll sell, and an already-approved poster applying for paid selling only sees
        // the paid pages (no documents again)
        function posterAppStages(){
          const d = posterAppDraft;
          const paid = PAID_SELLER_STAGES;
          if (posterAppPaidOnlyApproved()) return paid;
          const list = ['role', 'bizname', 'bizestablished', 'bizcategory', 'bizwebsite', 'bizdesc'];
          if (!d.paidOnly) list.push('paidchoice');
          if (d.sellPaid) list.push(...paid);
          list.push('bizdoc', 'iddoc', 'selfie', 'consent');
          return list;
        }
        let posterAppStageIdx = 0;
        function posterAppHeaderTitle(){
          return posterAppPaidOnlyApproved() ? 'Paid courses & classes' : 'Apply to post';
        }
        function setPosterAppSellPaid(checked){
          posterAppDraft.sellPaid = !!checked;
          posterAppRerender(); // the number of pages (and the progress bar) just changed
        }
        function setPosterAppAge(checked){
          posterAppDraft.ageConfirmed = !!checked;
          posterAppSyncNext();
          const err = document.getElementById('poster-app-stage-error'); if (err) err.style.display = 'none';
          const authErr = document.getElementById('auth-poster-app-error'); if (authErr) authErr.classList.remove('show');
        }
        function setPosterAppPaidAck(checked){
          posterAppDraft.paidTermsAck = !!checked;
          posterAppSyncNext();
          const err = document.getElementById('poster-app-stage-error'); if (err) err.style.display = 'none';
          const authErr = document.getElementById('auth-poster-app-error'); if (authErr) authErr.classList.remove('show');
        }

        // Minimum words required in the "In your own words" business description
        const POSTER_APP_BIZDESC_MIN_WORDS = 50;
        function posterAppWordCount(text){
          return ((text || '').trim().match(/\S+/g) || []).length;
        }
        function posterAppBizdescError(){
          const wc = posterAppWordCount(posterAppDraft.businessInfo);
          if (wc < POSTER_APP_BIZDESC_MIN_WORDS) return `Please write at least ${POSTER_APP_BIZDESC_MIN_WORDS} words about your business (currently ${wc}).`;
          return null;
        }

        function posterAppStageTitle(stage){
          if (stage === 'role') return 'Nice to meet you';
          if (stage === 'bizname') return "What's it called?";
          if (stage === 'bizestablished') return 'A little history';
          if (stage === 'bizcategory') return 'Pick your lane';
          if (stage === 'bizwebsite') return 'Got a link?';
          if (stage === 'bizdesc') return 'In your own words';
          if (stage === 'bizdoc') return 'Paperwork, but quick';
          if (stage === 'iddoc') return 'Almost there';
          if (stage === 'selfie') return 'Last one, promise';
          if (stage === 'paidchoice') return 'One more thing';
          if (stage === 'paidtype') return 'What will you sell?';
          if (stage === 'paidplan') return 'Tell us more';
          if (stage === 'paidprice') return 'Pricing';
          if (stage === 'paidpay') return 'How you get paid';
          if (stage === 'paidpayout') return 'Where should it go?';
          if (stage === 'paidconfirm') return 'Before you continue';
          return 'Before you submit';
        }
        function posterAppStageSub(stage){
          if (stage === 'role') return 'Which best describes you?';
          if (stage === 'bizname') return "What's your business called?";
          if (stage === 'bizestablished') return 'When was it established?';
          if (stage === 'bizcategory') return 'What category fits best?';
          if (stage === 'bizwebsite') return 'Website or social link (optional)';
          if (stage === 'bizdesc') return 'Describe it in a few words';
          if (stage === 'bizdoc') return 'Anything that proves your business is real, required';
          if (stage === 'iddoc') return 'Submit a government-issued ID from any country';
          if (stage === 'selfie') return "A quick live selfie so we can confirm it's really you";
          if (stage === 'paidchoice') return 'Will you also be posting paid courses and paid meetings?';
          if (stage === 'paidtype') return 'Are you selling courses, paid live classes or meetings, or both?';
          if (stage === 'paidplan') return 'Tell us exactly what you will post';
          if (stage === 'paidprice') return 'Roughly what will most of your listings cost?';
          if (stage === 'paidpay') return 'Payment plan and withdrawals';
          if (stage === 'paidpayout') return 'How would you like to be paid out?';
          if (stage === 'paidconfirm') return 'Confirm your age and our rules';
          return 'Please review and confirm';
        }
        // Smaller helper line under the question, where the old one-page form had one.
        function posterAppStageHint(stage){
          if (stage === 'bizdesc') return `This goes straight to an admin's review queue -- at least ${POSTER_APP_BIZDESC_MIN_WORDS} words, required.`;
          if (stage === 'bizdoc') return 'Helps admins verify faster -- a registration certificate, permit, receipt, or anything else that shows your business is real.';
          if (stage === 'iddoc') return "National ID, passport, driver's license, etc. -- any country.";
          if (stage === 'selfie') return "We automatically check that this is a live photo and that it matches your ID -- an admin still reviews everything.";
          if (stage === 'paidchoice') return 'Tick the box if yes. If not, you can apply later from \"Add course & paid classes\" in the Career Space menu.';
          if (stage === 'paidplan') return `What topics will you teach, who is it for, and what will students walk away with? At least ${PAID_SELLER_MIN_PLAN_WORDS} words.`;
          if (stage === 'paidprice') return 'Just a ballpark -- you set the real price on each course or class, and you can change it later.';
          if (stage === 'paidpayout') return "You'll add the actual mobile money number or bank details later, when you make your first withdrawal. Nothing to enter now.";
          return '';
        }

        function posterAppStageHTML(stage){
          const d = posterAppDraft;
          const enterNext = `onkeydown="if(event.key==='Enter'){event.preventDefault();posterAppNext();}"`;
          const fieldCls = 'w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none';
          const skipLink = `<a href="#" onclick="posterAppNext(); return false;" style="font-size:12px;color:#9ca3af;display:block;margin-top:10px;">Skip for now</a>`;
          if (stage === 'role') {
            return stitchChipRowHTML(POSTER_ROLE_OPTIONS, k => d.role===k, 'setPosterAppRole');
          }
          if (stage === 'bizname') {
            return `<input type="text" id="poster-app-input" autocomplete="off" ${enterNext} oninput="updatePosterAppField('businessName', this.value); const e=document.getElementById('poster-app-stage-error'); if(e) e.style.display='none';" placeholder="e.g. Acme Design Studio" value="${escapeHtml(d.businessName || '')}" class="${fieldCls}">`;
          }
          if (stage === 'bizestablished') {
            return posterAppEstablishedInputHTML('poster-app-input', 'posterAppNext()');
          }
          if (stage === 'bizcategory') {
            return stitchChipRowHTML(POSTER_CATEGORY_OPTIONS, k => d.businessCategory===k, 'setPosterAppCategory', true);
          }
          if (stage === 'bizwebsite') {
            return `
              <input type="url" id="poster-app-input" autocomplete="off" ${enterNext} oninput="updatePosterAppField('businessWebsite', this.value)" placeholder="e.g. yourbusiness.com" value="${escapeHtml(d.businessWebsite || '')}" class="${fieldCls}">
              ${skipLink}`;
          }
          if (stage === 'bizdesc') {
            const wc = posterAppWordCount(d.businessInfo);
            const counterColor = wc >= POSTER_APP_BIZDESC_MIN_WORDS ? '#16a34a' : '#e11d48';
            return `
              <textarea id="poster-app-input" autocomplete="off" maxlength="3000" oninput="updatePosterAppField('businessInfo', this.value); const n=posterAppWordCount(this.value); const c=document.getElementById('poster-app-bizdesc-counter'); if(c){ c.textContent = n + '/${POSTER_APP_BIZDESC_MIN_WORDS} words minimum'; c.style.color = n>=${POSTER_APP_BIZDESC_MIN_WORDS} ? '#16a34a' : '#e11d48'; } const e=document.getElementById('poster-app-stage-error'); if(e) e.style.display='none';" placeholder="Describe your business and what you'll be posting -- at least ${POSTER_APP_BIZDESC_MIN_WORDS} words." rows="6" class="${fieldCls} resize-none">${escapeHtml(d.businessInfo || '')}</textarea>
              <div id="poster-app-bizdesc-counter" class="text-right" style="font-size:11px;margin-top:4px;color:${counterColor};">${wc}/${POSTER_APP_BIZDESC_MIN_WORDS} words minimum</div>`;
          }
          if (stage === 'bizdoc') {
            return `
              <input type="file" accept="image/*,.pdf" id="poster-app-bizdoc-file-input" class="hidden" onchange="posterAppHandleBizDocSelected(this)">
              <button type="button" onclick="document.getElementById('poster-app-bizdoc-file-input').click()" class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600 border border-gray-300 border-dashed">
                ${Icon('upload','w-4 h-4')}
                <span id="poster-app-bizdoc-label">${escapeHtml(d.businessDocumentName || (currentUserPosterBusinessDocumentUrl ? 'Document on file -- tap to replace' : 'Upload a document'))}</span>
              </button>
              <div class="text-[11px] text-gray-400 mt-2">A registration certificate, permit, receipt, invoice, or anything else that shows your business is real -- required.</div>`;
          }
          if (stage === 'iddoc') {
            // Country is free text
            return `
            <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Country that issued your ID</label>
            <input type="text" id="poster-app-idcountry-input" maxlength="2" autocapitalize="characters" oninput="this.value=this.value.toUpperCase(); updatePosterAppField('idCountry', this.value)" placeholder="e.g. GH, NG, US" value="${escapeHtml(d.idCountry || '')}" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none mb-3">
            <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Document type</label>
            <select id="poster-app-idtype-input" onchange="updatePosterAppField('idType', this.value)" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none mb-3">
              ${POSTER_ID_TYPE_OPTIONS.map(t => `<option value="${escapeHtml(t)}" ${d.idType === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
            </select>
            ${posterAppUploadTileHTML({ label: 'Front Side', inputId: 'poster-app-iddoc-front-input', onSelect: 'posterAppHandleIdFrontSelected', onRemove: 'posterAppRemoveIdFront', file: d.idDocumentFile, previewUrl: d.idDocumentFrontPreviewUrl, existingUrl: currentUserPosterIdDocumentUrl })}
            ${posterAppUploadTileHTML({ label: 'Back Side', inputId: 'poster-app-iddoc-back-input', onSelect: 'posterAppHandleIdBackSelected', onRemove: 'posterAppRemoveIdBack', file: d.idDocumentBackFile, previewUrl: d.idDocumentBackPreviewUrl, existingUrl: currentUserPosterIdDocumentBackUrl, hint: 'Skip if your document type has no back, e.g. a passport.' })}
            <div class="text-[11px] text-gray-400 mb-4">We run an automated document check, then a human on our team reviews it before you're approved.</div>
            ${posterAppUploadTileHTML({ label: 'Proof of Residence (optional)', inputId: 'poster-app-proof-input', onSelect: 'posterAppHandleProofOfResidenceSelected', onRemove: 'posterAppRemoveProofOfResidence', file: d.proofOfResidenceFile, previewUrl: d.proofOfResidencePreviewUrl, existingUrl: currentUserPosterProofOfResidenceUrl, hint: 'A utility bill, bank statement, or tenancy agreement can help speed up review.' })}`;
          }
          if (stage === 'selfie') {
            // Automated liveness + face-match, via Smile ID -- see verifyPosterSelfieRemote
            return `
            ${posterAppUploadTileHTML({ label: 'Selfie', inputId: 'poster-app-selfie-input', onSelect: 'posterAppHandleSelfieSelected', onRemove: 'posterAppRemoveSelfie', file: d.selfieFile, previewUrl: d.selfiePreviewUrl, existingUrl: currentUserPosterSelfieUrl, accept: 'image/*', capture: 'user', hint: 'Face the camera in good light, with your whole face visible and no sunglasses or hats.' })}
            <div class="text-[11px] text-gray-400 mt-1">This is only used to confirm it's really you -- we automatically check that it's a live photo and that it matches the ID you just submitted.</div>`;
          }
          if (stage === 'paidchoice') {
            return `
              <label for="poster-app-sellpaid-checkbox" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:#f9fafb;border:1.5px solid ${d.sellPaid ? NAVY : '#cbd5e1'};border-radius:16px;padding:14px 16px;">
                <input type="checkbox" id="poster-app-sellpaid-checkbox" ${d.sellPaid ? 'checked' : ''} onchange="setPosterAppSellPaid(this.checked)" style="margin-top:2px;width:18px;height:18px;flex-shrink:0;accent-color:${NAVY};">
                <span style="font-size:13px;line-height:1.55;color:#4b5563;">Yes, I'll also be posting <b>paid courses</b> and <b>paid meetings</b> on Stitch.</span>
              </label>
              <div class="text-[11px] text-gray-400 mt-3">Leave it unticked if you only want to post opportunities. Ticking it adds a few questions about payments before you send your documents.</div>`;
          }
          const paidChips = (field, options) => stitchChipRowHTML(options, k => d[field]===k, `setPosterAppPaidChoice.bind(null,'${field}')`);
          if (stage === 'paidtype') return paidChips('paidType', PAID_TYPE_OPTIONS, 'grid-cols-1');
          if (stage === 'paidprice') return paidChips('paidPrice', PAID_PRICE_OPTIONS, 'grid-cols-2');
          if (stage === 'paidpayout') return paidChips('paidPayout', PAID_PAYOUT_OPTIONS, 'grid-cols-2');
          if (stage === 'paidplan') {
            const wc = posterAppWordCount(d.paidPlan);
            const ok = wc >= PAID_SELLER_MIN_PLAN_WORDS;
            return `
              <textarea id="poster-app-input" autocomplete="off" maxlength="3000" rows="6" oninput="updatePosterAppField('paidPlan', this.value); const n=posterAppWordCount(this.value); const c=document.getElementById('poster-app-paidplan-counter'); if(c){ c.textContent = n + '/${PAID_SELLER_MIN_PLAN_WORDS} words minimum'; c.style.color = n>=${PAID_SELLER_MIN_PLAN_WORDS} ? '#16a34a' : '#e11d48'; } const e=document.getElementById('poster-app-stage-error'); if(e) e.style.display='none';" placeholder="e.g. A 6-week paid Excel course for students, plus weekly paid live meetings on budgeting. Courses GH₵150, meetings GH₵30." class="${fieldCls} resize-none">${escapeHtml(d.paidPlan || '')}</textarea>
              <div id="poster-app-paidplan-counter" class="text-right" style="font-size:11px;margin-top:4px;color:${ok ? '#16a34a' : '#e11d48'};">${wc}/${PAID_SELLER_MIN_PLAN_WORDS} words minimum</div>`;
          }
          if (stage === 'paidpay') {
            const row = (t) => `<li style="display:flex;gap:8px;"><span style="color:${NAVY};font-weight:700;">•</span><span>${t}</span></li>`;
            return `
              <div style="background:#f9fafb;border:1.5px solid #cbd5e1;border-radius:16px;padding:14px 16px;">
                <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;font-size:13px;line-height:1.55;color:#4b5563;">
                  ${row(`Stitch keeps <b>${PAID_SELLER_SHARE_PCT}%</b> of every sale. You keep <b>${100 - PAID_SELLER_SHARE_PCT}%</b>. On a GH₵100 sale, that's GH₵${100 - PAID_SELLER_SHARE_PCT} for you.`)}
                  ${row(`Students pay online. Your earnings go into your Stitch wallet. ${PAID_SELLER_SCHEDULE_TEXT}`)}
                  ${row(`The minimum withdrawal is <b>${PAID_SELLER_MIN_WITHDRAWAL}</b>.`)}
                  ${row(`Withdrawals are reviewed and <b>approved within ${PAID_SELLER_APPROVAL_HOURS} hours</b>, then sent to your mobile money or bank account.`)}
                  ${row(`If a class is reported, Stitch can pause it and hold payouts while we look into it.`)}
                </ul>
              </div>`;
          }
          if (stage === 'paidconfirm') {
            const box = (id, checked, fn, text) => `
              <label for="${id}" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:#f9fafb;border:1.5px solid #cbd5e1;border-radius:16px;padding:14px 16px;margin-bottom:12px;">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${fn}(this.checked)" style="margin-top:2px;width:18px;height:18px;flex-shrink:0;accent-color:${NAVY};">
                <span style="font-size:13px;line-height:1.55;color:#4b5563;">${text}</span>
              </label>`;
            return `
              ${box('poster-app-age-checkbox', d.ageConfirmed, 'setPosterAppAge', `I confirm that I am <b>${PAID_SELLER_MIN_AGE} years old or older</b>.`)}
              <div style="background:#fff1f2;border:1px solid #fecdd3;color:#be123c;border-radius:16px;padding:12px 14px;font-size:12.5px;line-height:1.55;margin-bottom:12px;">
                Any action that goes against the Stitch Terms or acceptable use can lead to a <b>permanent ban</b> on your account, along with some security restrictions.
              </div>
              ${box('poster-app-paidack-checkbox', d.paidTermsAck, 'setPosterAppPaidAck', `I understand this, and I agree to the <a href="#" onclick="${posterAppIsAuthFlow() ? 'authShowTerms()' : `openOverlay('termsOfService')`}; return false;" style="color:${ROYAL};font-weight:600;">Terms of Service</a> for selling paid courses and meetings.`)}`;
          }
          // stage === 'consent'
          return posterAppConsentHTML('poster-app-consent-checkbox', 'setPosterAppConsent(this.checked)', "openOverlay('termsOfService')", "openOverlay('privacyPolicy')");
        }

        // Shared by both the in-app "Apply to post" form (openOverlay links to the Terms/Privacy
        // overlays, see overlays.js) and onboarding in games.js (which links to the pre-login
        // authShowTerms()/openFooterInfo('privacy') modals instead, since the overlay system
        function posterAppConsentHTML(checkboxId, onChangeExpr, termsOnClick, privacyOnClick){
          const d = posterAppDraft;
          return `
            <label for="${checkboxId}" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:#f9fafb;border:1.5px solid #cbd5e1;border-radius:16px;padding:14px 16px;">
              <input type="checkbox" id="${checkboxId}" ${d.consent ? 'checked' : ''} onchange="${onChangeExpr}" style="margin-top:2px;width:18px;height:18px;flex-shrink:0;accent-color:${NAVY};">
              <span style="font-size:13px;line-height:1.55;color:#4b5563;">
                I agree to the <a href="#" onclick="${termsOnClick}; return false;" style="color:${ROYAL};font-weight:600;">Terms of Service</a> and <a href="#" onclick="${privacyOnClick}; return false;" style="color:${ROYAL};font-weight:600;">Privacy Policy</a>, and I consent to Stitch tracking the opportunities I post and the decisions admins make on my application and posts (approvals, denials, and removals), so we can review applications and keep Career Space safe.
              </span>
            </label>`;
        }

        // Just the current question's input
        function posterApplicationFormHTML(){
          return `<div id="poster-app-form" style="margin-top:22px;">${posterAppStageHTML(posterAppStages()[posterAppStageIdx])}</div>`;
        }

        function posterAppShowStageError(msg){
          const el = document.getElementById('poster-app-stage-error');
          if (!el) return;
          el.textContent = msg;
          el.style.display = 'block';
        }

        // Re-renders the whole overlay for the current stage (new title, progress and input).
        function posterAppRenderStage(){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          ov.innerHTML = posterApplicationOverlayHTML();
          const scroller = document.getElementById('poster-app-stage-scroll');
          if (scroller) scroller.scrollTop = 0;
          // Text-entry questions pop the keyboard straight away, same as onboarding.
          const input = document.getElementById('poster-app-input');
          if (input) setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
        }

        // Per-question checks
        function posterAppStageError(stage){
          if (stage === 'bizname' && !(posterAppDraft.businessName || '').trim()) return "Let us know what your business is called.";
          if (stage === 'bizestablished') return posterAppEstablishedError();
          if (stage === 'bizdesc') return posterAppBizdescError();
          if (stage === 'bizdoc' && !posterAppDraft.businessDocumentFile && !currentUserPosterBusinessDocumentUrl) return "Please upload something that proves your business is real to apply.";
          if (stage === 'iddoc') {
            if (!posterAppDraft.idDocumentFile && !currentUserPosterIdDocumentUrl) return "Please submit an ID to apply.";
            if (!(posterAppDraft.idCountry || currentUserPosterIdCountry || '').trim()) return "Please tell us which country issued your ID.";
          }
          if (stage === 'selfie' && !posterAppDraft.selfieFile && !currentUserPosterSelfieUrl) return "Please take a selfie to verify it's you.";
          if (stage === 'consent' && !posterAppDraft.consent) return "Please agree to the Terms of Service and Privacy Policy to continue.";
          if (stage === 'paidtype' && !posterAppDraft.paidType) return "Please pick what you'll be selling.";
          if (stage === 'paidprice' && !posterAppDraft.paidPrice) return "Please pick a rough price range.";
          if (stage === 'paidpayout' && !posterAppDraft.paidPayout) return "Please pick how you'd like to be paid out.";
          if (stage === 'paidplan' && posterAppWordCount(posterAppDraft.paidPlan) < PAID_SELLER_MIN_PLAN_WORDS) return `Please tell us what you'll post in at least ${PAID_SELLER_MIN_PLAN_WORDS} words (currently ${posterAppWordCount(posterAppDraft.paidPlan)}).`;
          if (stage === 'paidconfirm') {
            if (!posterAppDraft.ageConfirmed) return `You need to be ${PAID_SELLER_MIN_AGE} or older to sell paid courses and meetings.`;
            if (!posterAppDraft.paidTermsAck) return 'Please tick the box to confirm you understand the rules.';
          }
          return null;
        }

        // ---- ID document verification ----
        async function posterAppVerifyIdDocument(errorTargetId){
          const file = posterAppDraft.idDocumentFile;
          if (!file) return true; // nothing new selected -- an ID already on file is unaffected
          if (posterAppDraft.idDocumentVerifiedFile === file) return true; // already checked this exact file
          if (!/^image\//.test(file.type || '')) { posterAppDraft.idDocumentVerifiedFile = file; return true; }
          const showErr = (msg) => {
            if (errorTargetId) {
              const el = document.getElementById(errorTargetId);
              if (el) { el.textContent = msg; el.classList.add('show'); el.style.display = 'block'; }
            } else {
              posterAppShowStageError(msg);
            }
          };
          try {
            const base64 = await fileToBase64(file);
            const system = 'You check ID uploads for a student app\'s "apply to post" application. You will be shown ' +
              'exactly one image. Reply with ONLY the single word YES if it clearly shows a real government- or ' +
              'school-issued photo ID document -- a national ID card, passport (photo page), driver\'s license, ' +
              'voter\'s card, student ID, or similar -- the ID itself, front or back, filling a reasonable part of ' +
              'the frame. Reply with ONLY the single word NO for anything else: a selfie or portrait with no ID ' +
              'visible, a random unrelated photo or screenshot, blank/solid-color image, or something too blurry ' +
              'or cropped to make out as an ID. Reply with nothing but that one word.';
            const raw = await callClaude(system, 'Is this image a valid ID document? Answer YES or NO only.', 'materials', [{ mediaType: file.type || 'image/jpeg', data: base64 }]);
            const answer = (raw || '').trim().toUpperCase();
            if (answer.startsWith('YES')) {
              posterAppDraft.idDocumentVerifiedFile = file;
              return true;
            }
            showErr("That doesn't look like a valid ID document. Please upload a clear photo of a government- or school-issued ID.");
            return false;
          } catch (err) {
            console.warn('ID verification check failed, letting it through for admin review:', err);
            posterAppDraft.idDocumentVerifiedFile = file;
            return true;
          }
        }

        async function posterAppNext(){
          if (posterAppSubmitInFlight) return;
          const stageList = posterAppStages();
          const stage = stageList[posterAppStageIdx];
          const err = posterAppStageError(stage);
          if (err) { posterAppShowStageError(err); return; }
          if (stage === 'iddoc') {
            const btn = document.getElementById('poster-app-submit-btn');
            const originalLabel = btn ? btn.textContent : '';
            if (btn) { btn.disabled = true; btn.textContent = 'Checking ID…'; }
            const ok = await posterAppVerifyIdDocument();
            if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
            if (!ok) return;
          }
          if (posterAppStageIdx < stageList.length - 1) {
            posterAppStageIdx++;
            posterAppRenderStage();
            return;
          }
          await submitPosterApplicationOverlay();
        }

        // Header arrow: one question back at a time; from the first question, leave the form.
        function posterAppBack(){
          if (posterAppSubmitInFlight) return;
          if (posterAppStageIdx > 0) {
            posterAppStageIdx--;
            posterAppRenderStage();
            return;
          }
          overlayGoBack();
        }

        // Submit handler for the in-app "Apply to post" overlay (skipped-at-signup or reapplying)
        function posterApplicationFormHTML_submitBtnLabel(){
          return currentUserPosterStatus === 'denied' ? 'Reapply' : 'Submit application';
        }

        // Requires the business document and ID for a fresh application
        function paidSellerMissingFieldMessage(){
          const d = posterAppDraft;
          if (!d.paidType) return "Please pick what you'll be selling.";
          if (posterAppWordCount(d.paidPlan) < PAID_SELLER_MIN_PLAN_WORDS) return `Please tell us what you'll post in at least ${PAID_SELLER_MIN_PLAN_WORDS} words.`;
          if (!d.paidPrice) return 'Please pick a rough price range.';
          if (!d.paidPayout) return "Please pick how you'd like to be paid out.";
          if (!d.ageConfirmed) return `You need to be ${PAID_SELLER_MIN_AGE} or older to sell paid courses and meetings.`;
          if (!d.paidTermsAck) return 'Please confirm you understand the rules for selling on Stitch.';
          return null;
        }

        function paidSellerPlanText(d){
          return [
            `Selling: ${paidOptionLabel(PAID_TYPE_OPTIONS, d.paidType) || 'not stated'}`,
            `Typical price: ${paidOptionLabel(PAID_PRICE_OPTIONS, d.paidPrice) || 'not stated'}`,
            `Payout via: ${paidOptionLabel(PAID_PAYOUT_OPTIONS, d.paidPayout) || 'not stated'}`,
            '',
            (d.paidPlan || '').trim(),
          ].join('\n');
        }

        // Saves the paid-seller answers
        async function savePaidSellerAnswers(sb, user){
          const d = posterAppDraft;
          try {
            const { error } = await sb.from(PROFILES_TABLE).update({
              creator_wants_paid: true,
              // Type, price range and payout method ride along inside the plan text so no new database
              // columns are needed
              creator_content_plan: paidSellerPlanText(d),
              creator_age_confirmed: !!d.ageConfirmed,
              creator_terms_ack_at: new Date().toISOString(),
              creator_applied_at: new Date().toISOString(),
            }).eq('user_id', user.id);
            if (error) console.warn('Paid-seller answers not stored yet (columns missing?):', error.message);
          } catch (e) { console.warn('Paid-seller answers not stored:', e); }
          currentUserPaidSellerRequested = true;
        }

        // Already-approved poster asking only for paid selling: never touches poster_status.
        async function submitPaidSellerApplication(){
          if (posterAppSubmitInFlight) return false;
          posterAppSubmitInFlight = true;
          try {
            const sb = getSupabaseClient();
            const user = sb ? await getCachedAuthUser() : null;
            if (!sb || !user) return false;
            await savePaidSellerAnswers(sb, user);
            notifyAllAdminsRemote({
              type: 'paid_seller_application',
              title: 'New paid courses & classes request',
              message: `${(typeof profileData !== 'undefined' && profileData.name) || 'A user'} wants to sell paid courses and meetings. Selling: ${paidOptionLabel(PAID_TYPE_OPTIONS, posterAppDraft.paidType) || 'n/a'}. Plan: ${(posterAppDraft.paidPlan || '').trim().slice(0, 200)}`,
            });
            return true;
          } catch (e) { console.warn('Paid-seller application threw an error:', e); return false; }
          finally { posterAppSubmitInFlight = false; }
        }

        function posterApplicationMissingFieldMessage(){
          if (posterAppPaidOnlyApproved()) return paidSellerMissingFieldMessage();
          if (posterAppDraft.sellPaid && paidSellerMissingFieldMessage()) return paidSellerMissingFieldMessage();
          if (!(posterAppDraft.businessName || '').trim()) return "Let us know what your business is called.";
          if (posterAppEstablishedError()) return posterAppEstablishedError();
          if (posterAppBizdescError()) return posterAppBizdescError();
          if (!posterAppDraft.businessDocumentFile && !currentUserPosterBusinessDocumentUrl) return "Please upload something that proves your business is real to apply.";
          if (!posterAppDraft.idDocumentFile && !currentUserPosterIdDocumentUrl) return "Please submit an ID to apply.";
          if (!(posterAppDraft.idCountry || currentUserPosterIdCountry || '').trim()) return "Please tell us which country issued your ID.";
          if (!posterAppDraft.selfieFile && !currentUserPosterSelfieUrl) return "Please take a selfie to verify it's you.";
          if (!posterAppDraft.consent) return "Please agree to the Terms of Service and Privacy Policy to continue.";
          return null;
        }

        async function submitPosterApplicationOverlay(){
          const missing = posterApplicationMissingFieldMessage();
          if (missing) { openAppAlertModal(missing); return; }
          const btn = document.getElementById('poster-app-submit-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = 'Sending…'; }
          const paidOnlyApproved = posterAppPaidOnlyApproved();
          const ok = paidOnlyApproved ? await submitPaidSellerApplication() : await submitPosterApplication();
          if (!ok) {
            openAppAlertModal(posterSubmitBlockedMessage || "Couldn't submit your application. Please check your connection and try again.");
            if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = posterApplicationFormHTML_submitBtnLabel(); }
            return;
          }
          closeOverlay();
          openAppAlertModal(
            paidOnlyApproved
              ? `Thanks! Your request to sell paid courses and classes is with an admin -- you'll receive an update within ${PAID_SELLER_APPROVAL_HOURS} hours.`
              : posterAppDraft.intent === 'post'
                ? "Thanks! Your application is with an admin for review -- you'll receive an update within 72 hours."
                : "You're all set to explore Career Space."
          );
          const menuBtn = document.getElementById('career-dashes-btn');
          if (menuBtn && typeof renderJobMarket === 'function' && document.getElementById('jobs-content')) renderJobMarket();
        }

        function posterApplicationOverlayHTML(){
          const bg = '';
          if (currentUserPosterStatus === 'frozen' || currentUserPosterStatus === 'blocked') {
            const msg = currentUserPosterStatus === 'frozen'
              ? 'Your poster access is frozen. You can’t post or reapply right now. Check your notifications for details.'
              : 'This account, and the business and ID details linked to it, are not eligible to post opportunities on Stitch.';
            return `
              ${bg}
              <div class="flex-1 overflow-y-auto">
              ${overlayHeader('Apply to post', '20px', null, null, {center:true, titleSize:'text-xl', titleClass:'career-flow-title'})}
              <div class="px-5" style="padding-top:18px;padding-bottom:50px;">
                <div class="max-w-2xl mx-auto">
                  <div class="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-3 text-xs">${msg}</div>
                </div>
              </div>
              </div>`;
          }
          // Already submitted and waiting on an admin: nothing to fill in, so just say so.
          if (currentUserPosterStatus === 'pending' && !posterAppPaidOnlyApproved()) {
            return `
              ${bg}
              <div class="flex-1 overflow-y-auto">
              ${overlayHeader('Apply to post', '20px', null, null, {center:true, titleSize:'text-xl', titleClass:'career-flow-title'})}
              <div class="px-5" style="padding-top:18px;padding-bottom:50px;">
                <div class="max-w-2xl mx-auto">
                  <div class="bg-amber-50 border border-amber-100 text-amber-700 rounded-2xl p-3 text-xs">Your application is already awaiting review -- you'll receive an update within 72 hours.</div>
                </div>
              </div>
              </div>`;
          }
          const stageList = posterAppStages();
          const total = stageList.length;
          const idx = Math.min(Math.max(posterAppStageIdx, 0), total - 1);
          const stage = stageList[idx];
          const isLast = idx === total - 1;
          const pct = Math.round(((idx + 1) / total) * 100);
          const hint = posterAppStageHint(stage);
          const deniedBanner = (idx === 0 && currentUserPosterStatus === 'denied') ? `
            <div class="bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl p-3 text-xs mb-5">Your previous application wasn't approved. Feel free to update the details below and reapply.</div>` : '';
          return `
            ${bg}
            <div id="poster-app-stage-scroll" class="flex-1 overflow-y-auto">
            ${overlayHeader(posterAppHeaderTitle(), '20px', 'posterAppBack()', null, {center:true, titleSize:'text-xl', titleClass:'career-flow-title', pb:'0px'})}
            <div class="w-full px-5" style="margin-top:10px;">
              <div class="max-w-2xl mx-auto">
                <div style="height:4px;border-radius:9999px;background:rgba(128,128,128,0.25);overflow:hidden;">
                  <div style="height:100%;width:${pct}%;border-radius:9999px;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);transition:width .25s ease;"></div>
                </div>
              </div>
            </div>
            <div class="px-5" style="padding-top:26px;padding-bottom:20px;">
              <div class="max-w-2xl mx-auto">
                ${deniedBanner}
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Step ${idx + 1} of ${total}</div>
                <h2 class="text-2xl font-bold font-display grad-text" style="margin-bottom:6px;">${posterAppStageTitle(stage)}</h2>
                <div class="text-sm text-gray-500">${posterAppStageSub(stage)}</div>
                ${hint ? `<div class="text-xs text-gray-400" style="margin-top:6px;">${hint}</div>` : ''}
                ${posterApplicationFormHTML()}
              </div>
            </div>
            </div>
            <div class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(22px, env(safe-area-inset-bottom));">
              <div class="max-w-2xl mx-auto">
                <div id="poster-app-stage-error" role="alert" style="display:none;color:#e11d48;font-size:12.5px;text-align:center;margin-bottom:10px;"></div>
                <div id="poster-app-next-wrap" style="${posterAppStageReady(stage) ? '' : 'display:none;'}">
                <button id="poster-app-submit-btn" onclick="posterAppNext()" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${isLast ? posterApplicationFormHTML_submitBtnLabel() : 'Next'}</button>
                </div>
              </div>
            </div>`;
        }

        // ---- Listing cover images live in Storage, not inside the row ----
        const OPP_COVER_BUCKET = 'opportunity-covers';
        const oppOwners = {}; // listing id -> created_by (from the DB row), filled by loadOpportunitiesRemoteInner
        const oppCoverMigrationTried = {};

        function compressImageDataUrl(src, maxDim, quality){
          return new Promise(function(resolve, reject){
            const img = new Image();
            img.onload = function(){
              try {
                const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
                const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', quality));
              } catch (e) { reject(e); }
            };
            img.onerror = function(){ reject(new Error('Could not read image')); };
            img.src = src;
          });
        }

        function canCurrentUserWriteCoverFor(job, userId){
          if (isCurrentUserAdmin()) return true;
          const owner = oppOwners[job.id] || job.createdByUserId;
          return !owner || owner === userId;
        }

        // Uploads job.coverImage (a data
        async function uploadOpportunityCover(sb, job, userId){
          if (!job || typeof job.coverImage !== 'string' || job.coverImage.indexOf('data:image/') !== 0) return;
          let dataUrl = job.coverImage;
          if (dataUrl.length > 600000 || dataUrl.indexOf('data:image/jpeg') !== 0) {
            dataUrl = await compressImageDataUrl(dataUrl, 1280, 0.82);
          }
          const blob = await (await fetch(dataUrl)).blob();
          const safeId = String(job.id).replace(/[^A-Za-z0-9_-]/g, '');
          const path = userId + '/' + safeId + '.jpg';
          const { error } = await sb.storage.from(OPP_COVER_BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
          if (error) throw error;
          const pub = sb.storage.from(OPP_COVER_BUCKET).getPublicUrl(path);
          job.coverImage = pub.data.publicUrl + '?v=' + Date.now();
        }

        // A copy of the listing that is safe to store on the shared row: no applicant details
        function stripApplicants(job){
          const copy = Object.assign({}, job);
          delete copy.applicants;
          delete copy._coverStripped; // local-only marker, never saved
          return copy;
        }

        // Cache copy: no applicant details, but keep the marker that says "this listing's inline
        // cover was left out", so an edit made before the next fetch can't erase that cover
        function forCache(job){
          const c = stripApplicants(job);
          if (job && job._coverStripped) c._coverStripped = true;
          return c;
        }

        async function postOpportunityInsertRemote(job){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data } = await sb.auth.getUser();
            const user = data && data.user;
            // Only the poster (or an admin) edits a listing row
            const knownOwner = oppOwners[job.id];
            if (user && knownOwner && knownOwner !== user.id && !isCurrentUserAdmin()) return true;
            // The list query leaves out inline (base64) covers to keep it small
            if (job._coverStripped && !job.coverImage) {
              const { data: raw, error: rawErr } = await sb.from(OPPORTUNITIES_TABLE).select('data').eq('id', job.id).maybeSingle();
              if (rawErr) { console.warn('Could not load the listing cover; not saving so it is not lost:', rawErr); return false; }
              if (raw && raw.data && typeof raw.data.coverImage === 'string') job.coverImage = raw.data.coverImage;
            }
            if (user && typeof job.coverImage === 'string' && job.coverImage.indexOf('data:image/') === 0 && canCurrentUserWriteCoverFor(job, user.id)) {
              try { await uploadOpportunityCover(sb, job, user.id); }
              catch (e) { console.warn('Cover image upload failed; saving the listing without changing its cover:', e); return false; }
            }
            const { error } = await sb.from(OPPORTUNITIES_TABLE).upsert({
              id: job.id,
              data: stripApplicants(job),
              // Keep the original owner when someone else (an admin, an applicant) re-saves the row.
              created_by: oppOwners[job.id] || (user ? user.id : null),
            });
            if (error) console.warn('Opportunity did not sync to Supabase (see opportunities table SQL comment above):', error);
            else if (user && !oppOwners[job.id]) oppOwners[job.id] = user.id;
            return !error;
          } catch (e) { console.warn('Opportunity sync threw an error:', e); return false; }
        }

        // One-time, per-session cleanup: listings that still carry an inline base64 cover get it
        // moved to Storage by their owner (or an admin)
        async function migrateLegacyOpportunityCovers(rows){
          const sb = getSupabaseClient();
          if (!sb || !Array.isArray(rows)) return;
          let uid = null;
          try { const { data } = await sb.auth.getUser(); uid = data && data.user && data.user.id; } catch (e) {}
          if (!uid) return;
          for (const row of rows) {
            if (!row || !row._coverStripped) continue;
            if (oppCoverMigrationTried[row.id] || !canCurrentUserWriteCoverFor(row, uid)) continue;
            oppCoverMigrationTried[row.id] = true;
            try {
              // Load the full listing (with its heavy cover) for just this one row, then save it, which
              // uploads the cover to Storage and keeps only the short URL
              const { data: raw, error } = await sb.from(OPPORTUNITIES_TABLE).select('*').eq('id', row.id).maybeSingle();
              if (error || !raw || !raw.data) continue;
              const full = Object.assign({}, raw.data, { id: raw.id, applicants: row.applicants || [] });
              const ok = await postOpportunityInsertRemote(full);
              if (ok) { delete row._coverStripped; if (full.coverImage) row.coverImage = full.coverImage; }
            } catch (e) { console.warn('Cover migration failed for', row.id, e); }
          }
        }

        // Saves this applicant's own application into APPLICATIONS_TABLE so its poster can see it
        // on the Dashboard (jobDashboardHTML)
        async function syncJobApplicant(job, docsPayload){
          const myId = await getCurrentUserId();
          if (!myId) return false;
          const d = jobApplyDraft || {};
          if (!job.applicants) job.applicants = [];
          const entry = {
            id: myId,
            name: d.fullName || (typeof profileData !== 'undefined' && profileData.name) || '',
            email: d.email || (typeof currentUserEmail !== 'undefined' && currentUserEmail) || '',
            phone: d.phone || '',
            dob: d.dobIso || '',
            location: (d.location || '').trim(),
            // Profile picture shown next to the applicant on the poster's/admins' side. Only a
            // hosted URL is stored (never an inline data: image, which would bloat the row);
            // the Dashboard also refreshes it live from the public profile.
            photo: (typeof profileData !== 'undefined' && profileData.photo && String(profileData.photo).indexOf('data:') !== 0) ? profileData.photo : null,
            status: 'applied',
            appliedAt: Date.now(),
            // The resume/cover-letter/etc. the applicant attached, plus any free-form extra documents
            // and a short cover note
            documents: (docsPayload && docsPayload.documents) || {},
            additionalDocuments: (docsPayload && docsPayload.additionalDocuments) || [],
            coverNote: (d.letterText || '').trim(),
          };
          const existing = job.applicants.find(a => a.id === myId);
          if (existing) Object.assign(existing, entry); else job.applicants.push(entry);
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data, error } = await sb.from(APPLICATIONS_TABLE)
              .upsert({ opportunity_id: job.id, applicant_id: myId, data: entry }, { onConflict: 'opportunity_id,applicant_id' })
              .select('data')
              .maybeSingle();
            if (error) { console.warn('Application did not save:', error); return false; }
            // The database decides the real status (e.g. a rejected applicant can't reset it), so
            // adopt what it stored
            if (data && data.data) {
              const saved = Object.assign({}, data.data, { id: myId });
              const cur = job.applicants.find(a => a.id === myId);
              if (cur) Object.assign(cur, saved); else job.applicants.push(saved);
            }
            return true;
          } catch (e) { console.warn('Saving the application threw an error:', e); return false; }
        }

        // Persists one applicant's record after a status change, interview, message or offer reply
        const APPLICATION_REVIEW_KEYS = ['status', 'statusStage', 'statusUpdatedAt', 'interview', 'messages'];
        async function saveApplicantRemote(job, applicant){
          const sb = getSupabaseClient();
          if (!sb || !job || !applicant || !applicant.id) return false;
          try {
            let payload = applicant;
            if (canCurrentUserManageJob(job) && applicant.id !== currentUserId) {
              payload = {};
              APPLICATION_REVIEW_KEYS.forEach(k => { if (k in applicant) payload[k] = applicant[k]; });
            }
            const { error } = await sb.from(APPLICATIONS_TABLE)
              .update({ data: payload })
              .eq('opportunity_id', job.id)
              .eq('applicant_id', applicant.id);
            if (error) { console.warn('Application update did not save:', error); return false; }
            return true;
          } catch (e) { console.warn('Saving the application update threw an error:', e); return false; }
        }

        // Applications visible to the signed-in user (their own, plus those for listings they
        // own), grouped by listing id
        async function fetchApplicationsByJob(sb){
          const byJob = {};
          try {
            const { data, error } = await withClockSkewRetry(sb, () => sb.from(APPLICATIONS_TABLE).select('opportunity_id, applicant_id, data'));
            if (error || !data) { if (error) console.warn('Loading applications failed:', error); return byJob; }
            data.forEach(r => {
              if (!r || !r.opportunity_id) return;
              (byJob[r.opportunity_id] = byJob[r.opportunity_id] || []).push(Object.assign({}, r.data || {}, { id: r.applicant_id }));
            });
          } catch (e) { console.warn('Loading applications threw an error:', e); }
          return byJob;
        }

        async function deleteOpportunityRemote(id){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(OPPORTUNITIES_TABLE).delete().eq('id', id);
            if (error) console.warn('Opportunity delete did not sync to Supabase (see opportunities table SQL comment above):', error);
            return !error;
          } catch (e) { console.warn('Opportunity delete threw an error:', e); return false; }
        }

        // ---- Cross-user notifications (server-side) ----
        async function notifyUserRemote(userId, opts){
          if (!userId) return false;
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(NOTIFICATIONS_TABLE).insert({
              user_id: userId,
              type: opts.type || 'info',
              title: opts.title || 'Stitch',
              message: opts.message || '',
              job_id: opts.jobId || null,
              metadata: opts.metadata || null,
            });
            if (error) console.warn('Notification did not send (see notifications table in supabase-schema-updates.sql):', error);
            return !error;
          } catch (e) { console.warn('Sending notification threw an error:', e); return false; }
        }

        // Notifies every admin at once (poster applications, new reports).
        async function notifyAllAdminsRemote(opts){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data, error } = await sb.from(PROFILES_TABLE).select('user_id').eq('role', 'admin');
            if (error || !data) return;
            await Promise.all(data.map(row => notifyUserRemote(row.user_id, opts)));
          } catch (e) { console.warn('Notifying admins threw an error:', e); }
        }

        let notificationsChannel = null;

        // Delivers a notifications row into local notifData (see addNotif in overlays.js).
        function deliverRemoteNotification(row){
          if (!row || typeof addNotif !== 'function') return;
          const iconByType = {
            application_message: 'comment',
            interview_scheduled: 'calendar',
            application_status: 'briefcase',
            poster_approved: 'check',
            poster_denied: 'close',
            poster_frozen: 'lock',
            poster_unfrozen: 'check',
            poster_blocked: 'lock',
            admin_message: 'comment',
            opportunity_reported: 'flag',
            cancel_reason: 'flag',
          };
          // Update local poster status the instant the decision notification lands, so "Poster
          // application pending" reflects it right away instead of waiting on a reload
          const posterTypeToStatus = { poster_approved: 'approved', poster_denied: 'denied', poster_frozen: 'frozen', poster_unfrozen: 'approved', poster_blocked: 'blocked' };
          if (posterTypeToStatus[row.type]) {
            currentUserPosterStatus = posterTypeToStatus[row.type];
            refreshPosterStatusUI();
          }
          // A rescheduled interview replaces the earlier pinned one instead of stacking up.
          if (row.type === 'interview_scheduled') {
            for (let i = notifData.length - 1; i >= 0; i--) {
              if (notifData[i].type === 'interview_scheduled' && notifData[i].jobId === (row.job_id || null)) notifData.splice(i, 1);
            }
            // Also drop it into the applicant's own reminders so it fires before the interview.
            const md = row.metadata || {};
            if (md.date && md.time && typeof studyReminders !== 'undefined') {
              const rid = 'rem-int-' + (row.job_id || 'x');
              studyReminders = studyReminders.filter(r => r.id !== rid);
              studyReminders.push({ id: rid, title: 'Interview: ' + (md.jobTitle || 'your interview'), type: 'Interview', date: md.date, time: md.time, lead: 60 });
              if (typeof queueSaveUserState === 'function') queueSaveUserState();
            }
          }
          addNotif({
            id: 'srv-notif-' + row.id,
            pinned: row.type === 'interview_scheduled',
            source: 'career',
            type: row.type || 'info',
            icon: iconByType[row.type] || 'bell',
            iconBg: 'bg-blue-50',
            iconClass: `text-[${NAVY}]`,
            name: row.title || 'Career Space',
            message: row.message || '',
            createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
            jobId: row.job_id || null,
          });
        }

        // Runs at boot: pulls in notifications missed while offline, then marks them delivered so
        // they aren't re-imported next login
        async function loadUnreadNotificationsRemote(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const myId = await getCurrentUserId();
            if (!myId) return;
            const { data, error } = await sb.from(NOTIFICATIONS_TABLE)
              .select('*').eq('user_id', myId).eq('delivered', false)
              .order('created_at', { ascending: false }).limit(50);
            if (error || !data || !data.length) return;
            data.slice().reverse().forEach(deliverRemoteNotification);
            const ids = data.map(r => r.id);
            await sb.from(NOTIFICATIONS_TABLE).update({ delivered: true }).in('id', ids);
          } catch (e) { console.warn('Loading notifications threw an error:', e); }
        }

        // Live delivery while the app is open -- mirrors chat.js's per-user channel pattern.
        async function subscribeToUserNotifications(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (notificationsChannel) { try { sb.removeChannel(notificationsChannel); } catch (e) {} }
          notificationsChannel = sb.channel('notifications:' + myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: NOTIFICATIONS_TABLE, filter: 'user_id=eq.' + myId }, (payload) => {
              deliverRemoteNotification(payload.new);
              if (payload.new && payload.new.id != null) {
                sb.from(NOTIFICATIONS_TABLE).update({ delivered: true }).eq('id', payload.new.id).then(() => {}, () => {});
              }
            })
            .subscribe();
        }

        let jobsData = {
          opportunities: [],
          internships: [],
          courses: [],
          scholarships: [],
          others: [],
        };

        // ---- Instant opportunities ----
        const OPP_CACHE_KEY = 'stitch_opps_cache_v1';
        function splitOpportunityRows(rows){
          return {
            opportunities: rows.filter(j => j.type !== 'Course' && j.type !== 'Internship' && j.type !== 'Scholarship' && j.type !== 'Other'),
            internships: rows.filter(j => j.type === 'Internship'),
            courses: rows.filter(j => j.type === 'Course'),
            scholarships: rows.filter(j => j.type === 'Scholarship'),
            others: rows.filter(j => j.type === 'Other'),
          };
        }
        (function hydrateOpportunitiesFromCache(){
          try {
            const raw = localStorage.getItem(OPP_CACHE_KEY);
            if (!raw) return;
            const rows = JSON.parse(raw);
            if (Array.isArray(rows) && rows.length) jobsData = splitOpportunityRows(rows);
          } catch (e) {}
        })();
        function clearOpportunitiesCache(){
          try { localStorage.removeItem(OPP_CACHE_KEY); } catch (e) {}
        }
        function repaintJobsIfVisible(){
          if (typeof currentTab === 'undefined' || currentTab !== 1) return;
          const content = document.getElementById('jobs-content');
          if (content) content.innerHTML = jobsContent();
          else if (typeof renderJobMarket === 'function') renderJobMarket();
        }
        let lastOpportunitiesSignature = '';
        let opportunitiesLoadRetries = 0;
        let opportunitiesLoadInFlight = null;
        // Concurrent callers (login prefetch, boot chain, realtime, polling) share one request
        // instead of stacking duplicates, so the first response paints as fast as possible
        function loadOpportunitiesRemote(){
          if (opportunitiesLoadInFlight) return opportunitiesLoadInFlight;
          opportunitiesLoadInFlight = loadOpportunitiesRemoteInner().finally(() => { opportunitiesLoadInFlight = null; });
          return opportunitiesLoadInFlight;
        }
        function scheduleOpportunitiesRetry(){
          // Quick retries (0.6s, 1.2s, 1.8s, 2.4s, 3s) so a login-time hiccup (auth session not
          // ready yet, flaky network) never leaves the list empty until the next 15s poll
          if (opportunitiesLoadRetries >= 5) return;
          opportunitiesLoadRetries++;
          setTimeout(() => loadOpportunitiesRemote(), 600 * opportunitiesLoadRetries);
        }
        async function loadOpportunitiesRemoteInner(){
          const sb = getSupabaseClient();
          if (!sb) { scheduleOpportunitiesRetry(); return; }
          try {
            const [listingsRes, applicationsByJob] = await Promise.all([
              withClockSkewRetry(sb, () => sb.from(OPPORTUNITIES_LIST_VIEW).select('*')),
              fetchApplicationsByJob(sb),
            ]);
            const { data, error } = listingsRes;
            if (error) {
              console.warn('Loading opportunities from Supabase failed (see opportunities table SQL comment above):', error);
              scheduleOpportunitiesRetry();
              return;
            }
            if (!data) { scheduleOpportunitiesRetry(); return; }
            opportunitiesLoadRetries = 0;
            data.forEach(row => { if (row && row.id && row.created_by) oppOwners[row.id] = row.created_by; });
            const rows = data
              .map(row => (row.data && typeof row.data === 'object') ? Object.assign({}, row.data, { id: row.id, applicants: applicationsByJob[row.id] || [] }, row.has_inline_cover ? { _coverStripped: true } : {}) : null)
              .filter(Boolean);
            const signature = JSON.stringify(rows);
            jobsData = splitOpportunityRows(rows);
            // Personal details of applicants never go into the on-device listing cache.
            try { localStorage.setItem(OPP_CACHE_KEY, JSON.stringify(rows.map(forCache))); } catch (e) {}
            // Repaint the moment fresh data lands
            if (signature !== lastOpportunitiesSignature) {
              lastOpportunitiesSignature = signature;
              repaintJobsIfVisible();
            }
            if (typeof refreshProfilePosterButton === 'function') refreshProfilePosterButton();
            migrateLegacyOpportunityCovers(rows);
            await autoDeleteExpiredOpportunities();
          } catch (e) {
            console.warn('Loading opportunities threw an error:', e);
            scheduleOpportunitiesRetry();
          }
        }

        // Realtime: a change to ONE listing or ONE application now refreshes just that row,
        // instead of re-downloading every listing and application for every connected device
        let opportunitiesChannel = null;
        const pendingJobRefresh = new Set();
        let jobRefreshTimer = null;
        function removeJobLocally(id){
          Object.keys(jobsData).forEach(k => { jobsData[k] = jobsData[k].filter(j => j.id !== id); });
        }
        function queueJobRefresh(id){
          if (!id) return;
          pendingJobRefresh.add(String(id));
          clearTimeout(jobRefreshTimer);
          jobRefreshTimer = setTimeout(flushJobRefresh, 400);
        }
        async function flushJobRefresh(){
          const ids = Array.from(pendingJobRefresh); pendingJobRefresh.clear();
          const sb = getSupabaseClient();
          if (!sb || !ids.length) return;
          try {
            const [listings, apps] = await Promise.all([
              sb.from(OPPORTUNITIES_LIST_VIEW).select('*').in('id', ids),
              sb.from(APPLICATIONS_TABLE).select('opportunity_id, applicant_id, data').in('opportunity_id', ids),
            ]);
            if (listings.error || apps.error) { loadOpportunitiesRemote(); return; } // fall back to a full reload
            const appsByJob = {};
            (apps.data || []).forEach(r => { (appsByJob[r.opportunity_id] = appsByJob[r.opportunity_id] || []).push(Object.assign({}, r.data || {}, { id: r.applicant_id })); });
            const found = new Set();
            (listings.data || []).forEach(row => {
              if (!row || !row.id || !row.data || typeof row.data !== 'object') return;
              found.add(String(row.id));
              if (row.created_by) oppOwners[row.id] = row.created_by;
              const job = Object.assign({}, row.data, { id: row.id, applicants: appsByJob[row.id] || [] }, row.has_inline_cover ? { _coverStripped: true } : {});
              removeJobLocally(row.id);
              const part = splitOpportunityRows([job]);
              Object.keys(part).forEach(k => { jobsData[k].push.apply(jobsData[k], part[k]); });
            });
            ids.forEach(id => { if (!found.has(id)) removeJobLocally(id); }); // deleted
            const all = Object.keys(jobsData).reduce((a, k) => a.concat(jobsData[k]), []);
            try { localStorage.setItem(OPP_CACHE_KEY, JSON.stringify(all.map(forCache))); } catch (e) {}
            lastOpportunitiesSignature = '';
            repaintJobsIfVisible();
            if (activeJobId && !allJobs().some(j => j.id === activeJobId) && typeof closeOverlay === 'function') closeOverlay();
          } catch (e) { loadOpportunitiesRemote(); }
        }
        function subscribeToOpportunitiesRealtime(){
          const sb = getSupabaseClient();
          if (!sb || opportunitiesChannel) return;
          const onChange = (payload) => {
            const row = (payload && (payload.new && Object.keys(payload.new).length ? payload.new : payload.old)) || {};
            const id = row.opportunity_id || row.id;
            if (id) queueJobRefresh(id);
            else { clearTimeout(jobRefreshTimer); jobRefreshTimer = setTimeout(() => loadOpportunitiesRemote(), 400); }
          };
          try {
            opportunitiesChannel = sb.channel('opportunities-live')
              .on('postgres_changes', { event: '*', schema: 'public', table: OPPORTUNITIES_TABLE }, onChange)
              .on('postgres_changes', { event: '*', schema: 'public', table: APPLICATIONS_TABLE }, onChange)
              .subscribe();
          } catch (e) { opportunitiesChannel = null; }
        }

        // ---- Consistent admin-picked date system ----
        function todayISODate(){
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }

        function formatISODateForDisplay(isoStr){
          if (!isoStr) return '';
          const [y, m, d] = isoStr.split('-').map(Number);
          if (!y || !m || !d) return '';
          const dt = new Date(y, m - 1, d);
          if (isNaN(dt.getTime())) return '';
          return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
        }

        // Fallback parser for free-typed deadline strings from before the date picker existed (or
        // admin edits typed by hand)
        const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
        function parseFreeTypedDeadline(dateStr){
          const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)\b/gi, '$1').trim();
          // "30 August 2026" / "30 August, 2026"
          let m = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
          if (m) {
            const day = Number(m[1]);
            const monthIdx = MONTH_NAMES.indexOf(m[2].toLowerCase());
            const year = Number(m[3]);
            if (monthIdx !== -1 && day >= 1 && day <= 31) {
              const dt = new Date(year, monthIdx, day);
              if (!isNaN(dt.getTime())) return dt;
            }
          }
          // "August 30, 2026" / "August 30 2026"
          m = cleaned.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
          if (m) {
            const monthIdx = MONTH_NAMES.indexOf(m[1].toLowerCase());
            const day = Number(m[2]);
            const year = Number(m[3]);
            if (monthIdx !== -1 && day >= 1 && day <= 31) {
              const dt = new Date(year, monthIdx, day);
              if (!isNaN(dt.getTime())) return dt;
            }
          }
          // Last resort: let the browser have a go (covers ISO-ish and other formats it already
          // understands fine)
          const parsed = Date.parse(cleaned);
          return isNaN(parsed) ? null : new Date(parsed);
        }

        // ---- Auto-delete opportunities once their deadline has passed ----
        function parsedOpportunityDeadline(job){
          if (!job || job.type === 'Course') return null;
          // Prefer the admin-picked ISO date -- unambiguous and locale-proof.
          if (job.deadlineDate) {
            const [y, m, d] = job.deadlineDate.split('-').map(Number);
            if (y && m && d) {
              const dt = new Date(y, m - 1, d);
              if (!isNaN(dt.getTime())) return dt;
            }
          }
          // Fall back to parsing the legacy free-typed display string, for listings created before
          // the date picker existed
          const raw = (job.deadline || '').trim();
          if (!raw || /^no deadline given$/i.test(raw)) return null;
          const dateStr = raw.replace(/^Deadline\s+/i, '').trim();
          if (!dateStr) return null;
          return parseFreeTypedDeadline(dateStr);
        }

        function isOpportunityDeadlinePassed(job){
          const deadline = parsedOpportunityDeadline(job);
          if (!deadline) return false;
          // Keep the listing up through the end of its deadline day rather than dropping it the
          // instant the date ticks over
          const endOfDeadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59, 999);
          return Date.now() > endOfDeadlineDay.getTime();
        }

        // Removes any opportunity/internship/scholarship/other listing whose deadline has passed,
        // both locally and in Supabase, so admins never have to come back and delete expired
        async function autoDeleteExpiredOpportunities(){
          const expired = allJobs().filter(isOpportunityDeadlinePassed);
          if (!expired.length) return false;
          expired.forEach(job => {
            const bucket = jobBucketFor(job);
            const idx = bucket.indexOf(job);
            if (idx !== -1) bucket.splice(idx, 1);
            // The server deletes expired listings daily (pg_cron)
            if (isCurrentUserAdmin()) deleteOpportunityRemote(job.id);
          });
          return true;
        }

        let opportunitiesPollInterval = null;
        function startOpportunitiesPolling(){
          subscribeToOpportunitiesRealtime();
          if (opportunitiesPollInterval) return;
          const refresh = async () => {
            const sb = getSupabaseClient();
            if (!sb) return;
            await loadOpportunitiesRemote();
            if (activeJobId && !allJobs().some(j => j.id === activeJobId) && typeof closeOverlay === 'function') closeOverlay();
          };
          // Safety net behind realtime: a full reload every 5 minutes while visible, and when the
          // app returns after being away for a while (not on every tab flick)
          let lastFullRefresh = Date.now();
          const guarded = async () => { lastFullRefresh = Date.now(); await refresh(); };
          opportunitiesPollInterval = setInterval(() => { if (!document.hidden) guarded(); }, 300000);
          document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastFullRefresh > 60000) guarded(); });
          window.addEventListener('online', guarded);
        }

        // ---- Job/course listing data + application status helpers ----
        function allJobs(){
          return applySavedJobFlags([...jobsData.opportunities, ...jobsData.internships, ...jobsData.courses, ...jobsData.scholarships, ...jobsData.others]
            .filter(j => !isOpportunityDeadlinePassed(j)));
        }

        function courseAsExploreCard(course){
          return {
            id: course.id,
            type: 'Course',
            title: course.title,
            org: stitchOrgName(course.org),
            sub: stitchOrgName(course.org),
            deadline: course.deliveryType === 'live' ? 'Live Teaching' : 'Self-paced',
            description: course.description,
            icon: 'chart', 
            coverImage: course.photo || '',
            saved: false,
            isCatalogCourse: true, 
            colorIndex: course.colorIndex,
            motifIndex: course.motifIndex,
          };
        }

        function exploreCourseCards(){
          const linkedCourseIds = jobsData.courses.map(j => j.courseId).filter(Boolean);
          const catalogOnly = allCourses.filter(c => !linkedCourseIds.includes(c.id) && !c.archived).map(courseAsExploreCard);
          return [...jobsData.courses, ...catalogOnly];
        }

        function allExploreCards(){
          return applySavedJobFlags([...jobsData.opportunities, ...jobsData.internships, ...exploreCourseCards(), ...jobsData.scholarships, ...jobsData.others]
            .filter(j => !isOpportunityDeadlinePassed(j)));
        }

        // A lightweight personal record that a user applied (drives the "Apply"/"Applied" button
        // state and lets them jot a private note)
        let jobApplications = {}; 

        function jobApplication(job){
          const local = (job && jobApplications[job.id]) || null;
          if (local) return local;
          // The personal record can be missing (new device, cleared/late-loaded state) even though
          // the application is still on the opportunity itself
          if (job && job.type !== 'Course' && typeof currentUserId !== 'undefined' && currentUserId) {
            const mine = (job.applicants || []).find(a => a.id === currentUserId);
            if (mine) return { status: mine.status || 'applied', appliedDate: mine.appliedAt || null, statusUpdatedDate: mine.statusUpdatedAt || mine.appliedAt || null };
          }
          return null;
        }
        function isJobApplied(job){
          return !!jobApplication(job);
        }

        // ---- Job Application Tracker ----
        const JOB_PIPELINE_ORDER = ['saved', 'applied', 'under_review', 'shortlisted', 'interview', 'offer'];
        const JOB_PIPELINE_META = {
          saved:        { label: 'Saved',        color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-600' },
          applied:      { label: 'Applied',      color: '#1E90FF', bg: 'bg-blue-100',    text: 'text-blue-700',   message: 'Your application has been submitted.' },
          under_review: { label: 'Under Review', color: '#b45309', bg: 'bg-amber-100',   text: 'text-amber-700',  message: 'Your application has been received and is currently being reviewed.' },
          shortlisted:  { label: 'Shortlisted',  color: '#4f46e5', bg: 'bg-indigo-100',  text: 'text-indigo-700', message: "You've been shortlisted for this opportunity." },
          interview:    { label: 'Interview',    color: '#7c3aed', bg: 'bg-purple-100',  text: 'text-purple-700', message: "You've been invited to interview." },
          offer:        { label: 'Offer',        color: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700', message: "Congratulations -- you've received an offer!" },
        };
        // Statuses an application can end on instead of continuing through the pipeline.
        const JOB_TERMINAL_META = {
          rejected:       { label: 'Rejected',           color: '#be123c', bg: 'bg-rose-100',    text: 'text-rose-700',   message: "This application wasn't successful this time." },
          withdrawn:      { label: 'Withdrawn',          color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-600',   message: 'This application was withdrawn.' },
          closed:         { label: 'Application Closed', color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-600',   message: 'This opportunity is no longer accepting applications.' },
          offer_accepted: { label: 'Offer Accepted',     color: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700', message: "You've accepted the offer -- congratulations!" },
        };
        // Combined lookup, for badges/notifications that don't care whether a status is mid-
        // pipeline or terminal
        const JOB_STATUS_META = Object.assign({}, JOB_PIPELINE_META, JOB_TERMINAL_META);
        // What a poster/admin can actually set from the Dashboard
        const JOB_STATUS_SETTABLE_PIPELINE = ['under_review', 'shortlisted', 'interview', 'offer'];
        // 'closed' (Application Closed) is no longer something a poster can set
        const JOB_STATUS_SETTABLE_TERMINAL = ['rejected', 'withdrawn', 'offer_accepted'];
        // Kept for the couple of places that still want "every status in one flat list" (e.g.
        // Career Analytics' breakdown)
        const JOB_STATUS_ORDER = JOB_PIPELINE_ORDER.filter(k => k !== 'saved').concat(JOB_STATUS_SETTABLE_TERMINAL, ['closed']);

        // The status a poster/admin has set for the current user on this listing
        function myJobApplicantStatus(job){
          const mine = (job && job.applicants || []).find(a => a.id === currentUserId);
          return (mine && mine.status) || 'applied';
        }
        function jobStatusMeta(job){
          return JOB_STATUS_META[myJobApplicantStatus(job)];
        }

        function fmtJobDate(ts){
          if (!ts) return '';
          return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }

        function updateJobStatusNote(id, note){
          const app = jobApplications[id] = jobApplications[id] || {};
          app.statusNote = note;
          queueSaveUserState();
        }

        function jobStatusBadge(job){
          if (!isJobApplied(job)) return '';
          const meta = jobStatusMeta(job);
          if (job.type === 'Course') {
            // Plain text, no pill/background
            return `<span class="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide ${meta.text}">Enrolled</span>`;
          }
          // Plain text
          return `<span class="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide">${meta.label}</span>`;
        }

        // One row of the timeline
        // ---- Application tracker (applicant's own view) ----
        const JOB_TRACKER_TEAL = '#14b8a6';
        const JOB_TRACKER_SUBTEXT = {
          saved: 'Saved to your list',
          applied: 'Waiting for review',
          under_review: 'Being reviewed by the team',
          shortlisted: 'You made the shortlist',
          interview: 'Interview stage',
          offer: 'An offer is on the table',
        };

        function jobStatusChipHTML(meta){
          return `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold flex-shrink-0" style="background:${meta.color}1a;color:${meta.color};">${Icon('clock','w-3.5 h-3.5')}${escapeHtml(meta.label)}</span>`;
        }

        // One row of the timeline: a dot on a connecting line, the step name (with a short sub-
        // line on the current step) and its date on the right
        function jobTrackerStepRowHTML(label, state, dateText, isFirst, isLast, color, sub){
          const done = state === 'done', cur = state === 'current';
          const upperLine = !isFirst ? `<div style="position:absolute;left:19px;width:2px;top:0;bottom:50%;background:${state === 'upcoming' ? '#e5e7eb' : JOB_TRACKER_TEAL};"></div>` : '';
          const lowerLine = !isLast ? `<div style="position:absolute;left:19px;width:2px;top:50%;bottom:0;background:${done ? JOB_TRACKER_TEAL : '#e5e7eb'};"></div>` : '';
          const dot = done
            ? `<div style="position:absolute;left:11px;top:50%;transform:translateY(-50%);width:18px;height:18px;border-radius:9999px;background:${JOB_TRACKER_TEAL};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">&#10003;</div>`
            : cur
              ? `<div style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:9999px;background:${color};box-shadow:0 0 0 4px ${color}33;"></div>`
              : `<div style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;border-radius:9999px;background:#fff;border:2px solid #d1d5db;"></div>`;
          return `
            <div style="position:relative;padding:11px 12px 11px 42px;border-radius:14px;${cur ? `background:${color}14;` : ''}">
              ${upperLine}${lowerLine}${dot}
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm ${cur ? 'font-bold' : 'font-medium'} ${state === 'upcoming' ? 'text-gray-400' : 'text-gray-800'}" ${cur ? `style="color:${color};"` : ''}>${escapeHtml(label)}</div>
                  ${cur && sub ? `<div class="text-xs text-gray-500 mt-0.5">${escapeHtml(sub)}</div>` : ''}
                </div>
                ${dateText ? `<div class="text-[11px] text-gray-400 flex-shrink-0 pt-0.5">${escapeHtml(dateText)}</div>` : ''}
              </div>
            </div>`;
        }

        // "Sent to the poster"
        function jobTrackerSubmissionHTML(mine){
          const docs = mine.documents || {};
          const extra = mine.additionalDocuments || [];
          const keys = Object.keys(docs);
          if (!keys.length && !extra.length && !mine.coverNote) return '';
          const row = (label, name) => `<div class="flex items-center gap-2.5 py-1.5"><span class="text-gray-400 flex-shrink-0">${Icon('doc','w-4 h-4')}</span><div class="min-w-0"><div class="text-[11px] text-gray-400 leading-tight">${escapeHtml(label)}</div><div class="text-sm font-medium text-gray-800 truncate">${escapeHtml(jobDocDisplayName(name))}</div></div></div>`;
          return `
            <div class="rounded-2xl p-4 mb-4" style="border:1.5px solid #e5e7eb;">
              <div class="flex items-center justify-between mb-1">
                <div class="text-sm font-semibold text-gray-800">Sent to the poster</div>
                ${mine.appliedAt ? `<div class="text-[11px] text-gray-400">${escapeHtml(fmtJobDate(mine.appliedAt))}</div>` : ''}
              </div>
              ${keys.map(id => row(jobDocLabel(id), docs[id].fileName)).join('')}
              ${extra.map(d => row('Other document', d.fileName)).join('')}
              ${mine.coverNote ? `<div class="text-xs text-gray-500 mt-2 whitespace-pre-wrap">${escapeHtml(mine.coverNote)}</div>` : ''}
            </div>`;
        }

        // Messages the poster sent to this applicant (also delivered as notifications).
        function jobTrackerMessagesHTML(mine){
          if (!mine || !(mine.messages || []).length) return '';
          return `
            <div class="mb-4">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Messages from the poster</div>
              <div style="border-top:1px solid #eef0f3;border-bottom:1px solid #eef0f3;">${jobMessagesListHTML(mine, '')}</div>
            </div>`;
        }

        function jobApplicationTrackerHTML(job){
          const mine = (job.applicants || []).find(a => a.id === currentUserId) || {};
          const status = myJobApplicantStatus(job);
          const note = (jobApplications[job.id] || {}).statusNote || '';
          const terminalMeta = JOB_TERMINAL_META[status];
          if (terminalMeta) {
            const c = terminalMeta.color;
            const glyph = status === 'rejected' ? '&#10005;' : (status === 'offer_accepted' ? '&#10003;' : '&#8212;');
            return `
              <div class="mb-5 pb-5 border-b border-gray-100">
                <div class="flex items-center justify-between mb-3">
                  <div class="font-semibold text-sm text-gray-800">Application Tracker</div>
                  ${jobStatusChipHTML(terminalMeta)}
                </div>
                <div class="rounded-2xl p-4 flex items-center gap-3" style="background:${c}14;border:1.5px solid ${c}40;">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold" style="background:${c};color:#fff;">${glyph}</div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold" style="color:${c};">${escapeHtml(terminalMeta.label)}</div>
                    <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(terminalMeta.message)}</div>
                  </div>
                </div>
                <div class="mt-4">${jobTerminalTimelineHTML(mine)}</div>
                <div class="mt-4">${jobTrackerMessagesHTML(mine)}</div>
                <div class="mt-4">${jobTrackerSubmissionHTML(mine)}</div>
              </div>`;
          }
          const idx = Math.max(0, JOB_PIPELINE_ORDER.indexOf(status));
          const pct = Math.round((idx / (JOB_PIPELINE_ORDER.length - 1)) * 100);
          const meta = JOB_PIPELINE_META[status] || JOB_PIPELINE_META.applied;
          const c = meta.color;
          const stepsHTML = JOB_PIPELINE_ORDER.map((k, i) => {
            const stepMeta = JOB_PIPELINE_META[k];
            const state = i < idx ? 'done' : (i === idx ? 'current' : 'upcoming');
            let dateText = '';
            if (k === 'applied' && mine.appliedAt) dateText = fmtJobDate(mine.appliedAt);
            else if (state === 'current' && mine.statusUpdatedAt) dateText = fmtJobDate(mine.statusUpdatedAt);
            return jobTrackerStepRowHTML(stepMeta.label, state, dateText, i === 0, i === JOB_PIPELINE_ORDER.length - 1, stepMeta.color, JOB_TRACKER_SUBTEXT[k]);
          }).join('');
          const lastUpdate = mine.statusUpdatedAt || mine.appliedAt;
          return `
            <div class="mb-5 pb-5 border-b border-gray-100">
              <div class="flex items-center justify-between mb-3">
                <div class="font-semibold text-sm text-gray-800">Application Tracker</div>
                ${jobStatusChipHTML(meta)}
              </div>

              <div class="rounded-2xl p-4 mb-4" style="background:${c}14;border:1.5px solid ${c}40;">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold" style="background:${c};color:#fff;">${status === 'applied' || status === 'offer' ? '&#10003;' : '&#9679;'}</div>
                  <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</div>
                    <div class="text-lg font-bold leading-tight" style="color:${c};">${escapeHtml(meta.label)}</div>
                  </div>
                  <div class="text-sm font-bold" style="color:${c};">${pct}%</div>
                </div>
                <div style="height:6px;border-radius:9999px;background:#ffffffaa;overflow:hidden;margin:12px 0 10px;">
                  <div style="height:100%;width:${pct}%;border-radius:9999px;background:${c};transition:width .25s ease;"></div>
                </div>
                ${meta.message ? `<div class="text-xs text-gray-500">${escapeHtml(meta.message)}</div>` : ''}
              </div>

              <div class="rounded-2xl mb-4" style="border:1.5px solid #e5e7eb;padding:6px;">${stepsHTML}</div>

              ${status === 'offer' ? `
                <div class="rounded-2xl p-4 mb-4" style="border:1.5px solid #05966940;background:#0596690d;">
                  <div class="text-sm font-bold mb-1" style="color:#059669;">You have an opportunity offer</div>
                  <div class="text-xs text-gray-500 mb-3">Would you like to take this opportunity?</div>
                  <div class="grid grid-cols-2 gap-2">
                    <button onclick="applicantRespondToOffer('${job.id}', true)" class="text-sm font-bold py-3 rounded-2xl text-white" style="background:#059669;">Accept opportunity</button>
                    <button onclick="applicantRespondToOffer('${job.id}', false)" class="text-sm font-bold py-3 rounded-2xl" style="background:#be123c1a;color:#be123c;">Reject opportunity</button>
                  </div>
                </div>` : ''}
              ${jobInterviewCardHTML(job, mine, false)}
              ${jobTrackerMessagesHTML(mine)}
              ${jobTrackerSubmissionHTML(mine)}

              ${lastUpdate ? `
                <div class="rounded-2xl p-3 mb-4 flex items-center gap-3" style="background:rgba(107,114,128,0.08);">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-gray-500" style="background:rgba(107,114,128,0.12);">${Icon('clock','w-5 h-5')}</div>
                  <div class="min-w-0">
                    <div class="text-xs text-gray-500">Last update</div>
                    <div class="text-sm font-semibold text-gray-800">${escapeHtml(fmtJobDate(lastUpdate))}</div>
                  </div>
                </div>` : ''}

              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Your notes</label>
              <textarea oninput="updateJobStatusNote('${job.id}', this.value)" placeholder="e.g. Phone screen scheduled for Thursday" rows="2" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm resize-none" style="outline:none;border:1.5px solid #cbd5e1;">${escapeHtml(note)}</textarea>
            </div>`;
        }

        // Applicant answers an "Offer opportunity" from the poster: accept it, or reject it
        // (recorded as withdrawn at the Offer stage)
        function applicantRespondToOffer(jobId, accept){
          const job = findJob(jobId);
          if (!job) return;
          const mine = (job.applicants || []).find(a => a.id === currentUserId);
          if (!mine || (mine.status || 'applied') !== 'offer') return;
          const run = async function(){
            mine.status = accept ? 'offer_accepted' : 'withdrawn';
            mine.statusStage = 'offer';
            mine.statusUpdatedAt = Date.now();
            try { openJobDetail(job.id); } catch (e) {}
            await saveApplicantRemote(job, mine);
            if (job.createdByUserId) {
              notifyUserRemote(job.createdByUserId, {
                type: 'application_status',
                title: accept ? 'Opportunity accepted' : 'Opportunity rejected',
                message: (mine.name || 'An applicant') + (accept ? ' accepted' : ' rejected') + ' your offer for "' + job.title + '".',
                jobId: job.id,
              });
            }
          };
          openAppConfirmModal(
            accept ? 'Accept this opportunity?' : 'Reject this opportunity?',
            accept ? 'The poster will be told you accepted.' : "The poster will be told you turned it down. This can't be undone.",
            accept ? 'Accept' : 'Reject',
            run
          );
        }

        function findJob(id){
          return allJobs().find(j => j.id === id);
        }

        function findExploreCard(id){
          return allExploreCards().find(j => j.id === id);
        }

        function jobBucketFor(job){
          if (job.type === 'Course') return jobsData.courses;
          if (job.type === 'Internship') return jobsData.internships;
          if (job.type === 'Scholarship') return jobsData.scholarships;
          if (job.type === 'Other') return jobsData.others;
          return jobsData.opportunities;
        }

        function deleteOpportunity(id){
          const job = findJob(id);
          if (!job || !canCurrentUserManageJob(job)) return;
          const isCourse = job.type === 'Course';
          openAppConfirmModal(
            `Delete "${job.title}"?`,
            isCourse
              ? "This removes the listing from Opportunities so no one new can find or enroll in it. Anyone already enrolled keeps their access and progress in their courses."
              : "This removes this listing for everyone and can't be undone.",
            'Delete',
            function(){
              const bucket = jobBucketFor(job);
              const idx = bucket.indexOf(job);
              if (idx !== -1) bucket.splice(idx, 1);
              deleteOpportunityRemote(id);
              if (isCourse && job.courseId) {
                // Soft-delete the linked course instead of removing it outright, so students who already
                // enrolled don't lose access
                archiveCourse(job.courseId);
              }
              if (jobDashboardFromPoster && jobDashboardViewingId === id) { jobDashboardFromPoster = false; openOverlay('posterDashboard'); }
              else if (activeJobId === id || jobDashboardViewingId === id) closeOverlay();
              renderJobMarket();
            }
          );
        }

        function toggleSaveJob(id){
          const job = findJob(id);
          if (!job) return;
          // Remember where the open page is scrolled so re-drawing the lists doesn't throw it back
          // to the top
          const ovEl = document.getElementById('overlay');
          const ovScroller = ovEl && ovEl.querySelector('.overflow-y-auto');
          const ovTop = ovScroller ? ovScroller.scrollTop : 0;
          job.saved = !job.saved;
          const savedIds = readSavedJobIds();
          if (job.saved) savedIds.add(job.id); else savedIds.delete(job.id);
          writeSavedJobIds(savedIds);
          renderJobMarket();
          renderSavedItemsOverlay();
          if (typeof currentOverlayKind !== 'undefined' && (currentOverlayKind === 'careerMatches' || currentOverlayKind === 'careerSaved')) rerenderCareerMatches(true);
          if (ovTop && ovEl) { const sc = ovEl.querySelector('.overflow-y-auto'); if (sc) sc.scrollTop = ovTop; }
        }

        function jobMatchesSearch(j, q){
          return [j.title, j.sub, j.org, j.description, j.type].filter(Boolean).some(f => f.toLowerCase().includes(q));
        }

        // ---- Job list + job detail screens ----
        // Same centered "Nothing posted yet" message on every Career Space tab
        function careerEmptyHTML(title, hint){
          return `<div class="empty-center bg-white"></div>`;
        }
        function careerListOrEmpty(list, title, hint){
          return list.length ? list.map(jobCard).join('') : careerEmptyHTML(title, hint);
        }
        function jobsContent(){
          const q = careerSearchQuery.trim().toLowerCase();
          if (q) {
            const matches = allExploreCards().filter(j => jobMatchesSearch(j, q));
            return matches.length
              ? matches.map(jobCard).join('')
              : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No opportunities match "${escapeHtml(careerSearchQuery.trim())}".</div>`;
          }
          if (jobsSub === 'all') {
            const cards = allExploreCards();
            return cards.length
              ? cards.map(jobCard).join('')
              : careerEmptyHTML();
          }
          if (jobsSub === 'opportunities') return careerListOrEmpty(jobsData.opportunities.filter(j => !isOpportunityDeadlinePassed(j)));
          if (jobsSub === 'internships') return careerListOrEmpty(jobsData.internships.filter(j => !isOpportunityDeadlinePassed(j)));
          if (jobsSub === 'courses') return careerListOrEmpty(exploreCourseCards());
          if (jobsSub === 'scholarships') {
            const scholarships = jobsData.scholarships.filter(j => !isOpportunityDeadlinePassed(j));
            return careerListOrEmpty(scholarships);
          }
          if (jobsSub === 'others') {
            const others = jobsData.others.filter(j => !isOpportunityDeadlinePassed(j));
            return careerListOrEmpty(others);
          }
          if (jobsSub === 'saved') {
            const savedJobs = allJobs().filter(j => j.saved);
            return savedJobs.length
              ? savedJobs.map(jobCard).join('')
              : careerEmptyHTML('No saved opportunities yet', 'Tap the bookmark icon on a listing to save it here');
          }
          const appliedJobs = allJobs().filter(j => isJobApplied(j));
          return appliedJobs.length
            ? appliedJobs.map(jobCard).join('')
            : careerEmptyHTML("You haven't applied to anything yet", 'Browse opportunities to get started');
        }

        function jobCard(job){
          // Flat row separated by a faint line (no card/cover)
          return `
            <div onclick="${job.isCatalogCourse ? `openCourseDetail('${job.id}')` : `openJobOrClassroom('${job.id}')`}" class="career-job-row relative cursor-pointer" style="padding:16px 4px;border-bottom:1px solid rgba(0,0,0,0.07);">
              <div class="flex items-center gap-4 relative">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <div class="font-semibold text-sm truncate text-gray-800">${escapeHtml(job.title)}</div>
                    ${jobStatusBadge(job)}
                  </div>
                  <div class="text-xs text-gray-400 truncate" style="margin-top:2px;">${job.type === 'Course' ? escapeHtml(stitchOrgName(job.sub)) : job.sub} · ${job.deadline}</div>
                </div>
                ${job.isCatalogCourse ? '' : `<button onclick="event.stopPropagation(); toggleSaveJob('${job.id}')" class="flex-shrink-0 p-1" style="color:${job.saved ? ROYAL : '#9ca3af'};">${Icon('bookmark','w-5 h-5')}</button>`}
              </div>
            </div>`;
        }

        function jobsSubTab(k){
          jobsSub = k;
          const filterbar = document.getElementById('career-filterbar');
          if (filterbar) filterbar.innerHTML = careerFilterPillsHTML();
          const jobsContentEl = document.getElementById('jobs-content');
          if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
          scrollActiveCareerTabIntoView();
        }

        let activeJobId = null;
        let jobDetailMenuOpen = false;

        // A poster (or admin) tapping into their own posted opportunity now lands straight on its
        // Dashboard (applicants/enrollees + activity) instead of the public detail view
        function openJobDetail(id){
          const job = findJob(id);
          if (job && isJobOwnedByCurrentUser(job)) {
            openJobDashboard(id);
            return;
          }
          activeJobId = id;
          jobDetailMenuOpen = false;
          openOverlay('jobDetail');
        }

        // Edit / Delete menus on the listing pages open as a bottom sheet that pulls up from below
        // (same look as the Career Space menu), instead of a small dropdown by the header
        function closeJobSheetMenu(){
          const d = document.getElementById('job-sheet-menu'), b = document.getElementById('job-sheet-backdrop');
          if (d) d.remove();
          if (b) b.remove();
        }
        function openJobSheetMenu(job){
          closeJobSheetMenu();
          const isCourse = job.type === 'Course';
          const wrap = document.createElement('div');
          wrap.innerHTML = `
            <div id="job-sheet-backdrop" onclick="closeJobSheetMenu()" ontouchmove="event.preventDefault()" style="position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.5);"></div>
            <div id="job-sheet-menu" class="bg-white" style="position:fixed;left:0;right:0;bottom:0;z-index:11001;border-radius:24px 24px 0 0;padding:10px 0 calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:shareSheetSlideUp .22s cubic-bezier(0.16,1,0.3,1);max-width:640px;margin:0 auto;">
              ${careerMenuRowHTML(`closeJobSheetMenu(); openEditOpportunity('${job.id}')`, 'edit', 'Edit')}
              ${careerMenuRowHTML(`closeJobSheetMenu(); deleteOpportunity('${job.id}')`, 'trash', 'Delete ' + (isCourse ? 'course' : 'listing'), 'text-red-500')}
            </div>`;
          while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
        }

        function toggleJobDetailMenu(){
          if (document.getElementById('job-sheet-menu')) { closeJobSheetMenu(); return; }
          const job = findJob(activeJobId);
          if (job) openJobSheetMenu(job);
        }

        function jobDetailMenuDropdownHTML(job){ return ''; }

        // ---- Report a listing ----
        let reportOppTargetId = null;
        let reportOppReason = '';      // the category picked from the list (required)
        let reportOppDetails = '';     // optional free-text, typed separately from the category
        const REPORT_REASON_CHIPS = ['Spam or scam', 'Misleading info', 'Inappropriate content', 'Not a real opportunity'];

        function openReportOpportunity(id){
          reportOppTargetId = id;
          reportOppReason = '';
          reportOppDetails = '';
          openOverlay('reportOpportunity');
        }

        function reportOppChipStyle(on){
          return on
            ? `display:block;padding:14px 18px;margin-bottom:8px;border-radius:9999px;transition:background .15s ease,border-color .15s ease;background:rgba(65,105,225,0.10);border:1.5px solid ${ROYAL};`
            : 'display:block;padding:14px 18px;margin-bottom:8px;border-radius:9999px;transition:background .15s ease,border-color .15s ease;background:transparent;border:1.5px solid transparent;';
        }

        function setReportOppReasonChip(chip){
          reportOppReason = chip;
          // Only restyle the rows
          document.querySelectorAll('#overlay [data-report-chip]').forEach(btn => {
            const on = btn.getAttribute('data-report-chip') === chip;
            btn.setAttribute('style', reportOppChipStyle(on));
            const label = btn.querySelector('span');
            if (label) label.className = on ? 'font-semibold grad-text' : 'text-gray-600';
          });
          const hint = document.getElementById('report-opp-select-label');
          if (hint) hint.style.color = '';
        }

        function updateReportOppReason(value){
          reportOppDetails = value;
        }

        let reportOppSubmitInFlight = false;

        async function submitOpportunityReport(){
          if (reportOppSubmitInFlight || !reportOppTargetId) return;
          if (!reportOppReason) {
            const hint = document.getElementById('report-opp-select-label');
            if (hint) { hint.style.color = '#ef4444'; hint.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
            openAppAlertModal('Please select one reason for your report.');
            return;
          }
          reportOppSubmitInFlight = true;
          const btn = document.getElementById('report-opp-submit-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = 'Sending…'; }
          try {
            const sb = getSupabaseClient();
            const myId = await getCurrentUserId();
            if (!sb || !myId) { openAppAlertModal("Couldn't send your report. Please try again."); return; }
            const details = (reportOppDetails || '').trim();
            // Admins see the chosen category AND anything extra the reporter wrote.
            const reasonText = details ? `${reportOppReason}\n${details}` : reportOppReason;
            const { error } = await sb.from(OPPORTUNITY_REPORTS_TABLE).insert({
              opportunity_id: reportOppTargetId,
              reported_by: myId,
              reason: reasonText,
            });
            if (error) { openAppAlertModal("Couldn't send your report. Please try again."); return; }
            notifyAllAdminsRemote({
              type: 'opportunity_reported',
              title: 'Listing reported',
              message: `A listing was reported on Career Space (${reportOppReason}). Review it on the Admin Dashboard.`,
              jobId: reportOppTargetId,
            });
            openJobDetail(reportOppTargetId);
            openAppAlertModal('Thanks -- an admin will take a look.');
          } catch (e) {
            console.warn('Submitting report threw an error:', e);
            openAppAlertModal("Couldn't send your report. Please try again.");
          } finally { reportOppSubmitInFlight = false; }
        }

        function reportOpportunityHTML(){
          const job = findJob(reportOppTargetId);
          // Reasons are a spaced-out list (no circles). The chosen one is wrapped in a pill.
          const reasonRows = REPORT_REASON_CHIPS.map(chip => {
            const on = reportOppReason === chip;
            return `<button data-report-chip="${escapeHtml(chip)}" onclick="setReportOppReasonChip('${escapeForJsAttr(chip)}')" class="w-full text-left text-sm" style="${reportOppChipStyle(on)}"><span class="${on ? 'font-semibold grad-text' : 'text-gray-600'}">${escapeHtml(chip)}</span></button>`;
          }).join('');
          return `
            ${overlayHeader('Report listing', '20px', null, null, { center: true })}
            <div class="flex-1 overflow-y-auto px-5" style="padding-top:6px;padding-bottom:20px;">
              <div class="max-w-2xl mx-auto">
                ${job ? `<div class="text-sm text-gray-500 mb-3 text-center">Reporting "<span class="font-semibold text-gray-800">${escapeHtml(job.title)}</span>"</div>` : ''}
                <div style="margin:14px 0 22px;">
                  <label id="report-opp-select-label" class="text-xs font-bold uppercase tracking-wide text-gray-400 block" style="margin:0 0 8px 18px;">Select one <span style="color:#ef4444;">*</span></label>
                  ${reasonRows}
                </div>
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Tell us more (optional)</label>
                <textarea id="report-opp-textarea" oninput="updateReportOppReason(this.value)" placeholder="What's wrong with this listing?" rows="4" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none resize-none">${escapeHtml(reportOppDetails)}</textarea>
              </div>
            </div>
            <div class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(22px, env(safe-area-inset-bottom));">
              <div class="max-w-2xl mx-auto">
                <button id="report-opp-submit-btn" onclick="submitOpportunityReport()" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">Submit report</button>
              </div>
            </div>`;
        }

        // ---- Poster Dashboard ----
        let posterDashboardRange = 14;
        let jobDashboardFromPoster = false;

        function myPostedJobs(){
          return allJobs().filter(isJobOwnedByCurrentUser);
        }

        function canSeePosterDashboard(){
          return currentUserPosterStatus === 'approved' || myPostedJobs().length > 0;
        }

        // The Dashboard is for everyone (except it is not the Admin Dashboard): their listings if
        // they post, their wallet if they are an approved creator, and their receipts
        let dashboardTab = null;
        function dashboardTabs(){
          const t = [];
          if (canSeePosterDashboard()) t.push(['listings', 'Listings']);
          if (typeof currentUserCreatorStatus !== 'undefined' && (currentUserCreatorStatus === 'approved' || currentUserCreatorStatus === 'suspended')) t.push(['wallet', 'Wallet']);
          t.push(['receipts', 'Receipts']);
          return t;
        }
        function openDashboard(tab){
          posterDashboardRange = 14;
          jobDashboardFromPoster = false;
          dashboardTab = tab || null;
          openOverlay('posterDashboard');
          dashboardLoadTab();
        }
        function openPosterDashboard(){ openDashboard(null); }
        // From the Admin Dashboard's "My Dashboard" pill: the back arrow returns to the Admin
        // Dashboard
        function openDashboardFromAdmin(){ openDashboard(null); overlayReturnTo = 'adminDashboard'; }
        // Fetches whatever the open tab needs (the pages that own that data do the loading and re-
        // draw us)
        function dashboardLoadTab(){
          const tabs = dashboardTabs();
          if (!tabs.some(([k]) => k === dashboardTab)) dashboardTab = tabs[0][0];
          if (dashboardTab === 'wallet' && typeof loadCreatorWallet === 'function') loadCreatorWallet();
          if (dashboardTab === 'receipts' && typeof loadReceipts === 'function') loadReceipts();
        }
        function setDashboardTab(k){
          dashboardTab = k;
          const ov = document.getElementById('overlay');
          if (ov) { ov.innerHTML = posterDashboardHTML(); const sc = ov.querySelector('.overflow-y-auto'); if (sc) sc.scrollTop = 0; }
          dashboardLoadTab();
        }

        function setPosterDashboardRange(n){
          posterDashboardRange = n;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = posterDashboardHTML();
        }

        function openPosterListing(id){
          jobDashboardFromPoster = true;
          openJobDashboard(id, true);
        }

        // Back from a listing's Overview goes to the Poster Dashboard it was opened from.
        function jobDashboardBack(fromPopState){
          if (jobDashboardFromPoster) {
            jobDashboardFromPoster = false;
            if (fromPopState) overlayHistoryPushed = false;
            openOverlay('posterDashboard');
            return;
          }
          if (fromPopState) closeOverlay(true); else overlayGoBack();
        }

        function posterDashboardChartHTML(days, apps, updates){
          const W = 320, H = 150, padL = 26, padR = 6, padT = 10, padB = 24;
          const maxV = Math.max(1, ...apps, ...updates);
          const top = Math.max(2, Math.ceil(maxV / 2) * 2);
          const cw = W - padL - padR, ch = H - padT - padB;
          const n = days.length, slot = cw / n, bw = Math.max(2, Math.min(9, slot * 0.34));
          const y = v => padT + ch - (v / top) * ch;
          let g = '';
          [0, top / 2, top].forEach(t => {
            g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" stroke="#e5e7eb" stroke-width="1"/><text x="${padL - 5}" y="${y(t) + 3}" font-size="9" fill="#9ca3af" text-anchor="end">${Math.round(t)}</text>`;
          });
          const step = n > 14 ? 5 : (n > 7 ? 2 : 1);
          days.forEach((d, i) => {
            const cx = padL + slot * i + slot / 2;
            if (apps[i]) g += `<rect x="${cx - bw - 0.5}" y="${y(apps[i])}" width="${bw}" height="${Math.max(1, padT + ch - y(apps[i]))}" rx="2" fill="${NAVY}"/>`;
            if (updates[i]) g += `<rect x="${cx + 0.5}" y="${y(updates[i])}" width="${bw}" height="${Math.max(1, padT + ch - y(updates[i]))}" rx="2" fill="${JOB_TRACKER_TEAL}"/>`;
            if (i % step === 0 || i === n - 1) g += `<text x="${cx}" y="${H - 8}" font-size="9" fill="#9ca3af" text-anchor="middle">${d.getDate()}</text>`;
          });
          return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Applications and status updates per day" style="display:block;">${g}</svg>`;
        }

        function posterListingsBodyHTML(){
          const jobs = myPostedJobs();
          const isCourseJob = j => j.type === 'Course';
          const rangeBtn = n => `<button onclick="setPosterDashboardRange(${n})" class="px-3 py-1.5 rounded-full text-xs font-semibold" style="${posterDashboardRange === n ? `background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);color:#fff;` : 'background:#f3f4f6;color:#6b7280;'}">${n}d</button>`;
          if (!jobs.length) {
            return `
                <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                  <div class="flex justify-center mb-2 text-gray-400">${Icon('briefcase','w-6 h-6')}</div>
                  You haven't posted anything yet. Your listings and how they're doing will show up here.
                </div>
              <div class="mt-4" style="margin-top:auto;padding-top:1rem;">
                <button onclick="openPostOpportunity()" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">Post an Opportunity</button>
              </div>`;
          }
          const DAY = 86400000;
          const start = new Date(); start.setHours(0, 0, 0, 0);
          const days = [];
          for (let i = posterDashboardRange - 1; i >= 0; i--) days.push(new Date(start.getTime() - i * DAY));
          const apps = days.map(() => 0), updates = days.map(() => 0);
          const bucket = ts => {
            if (!ts) return -1;
            const t = new Date(ts); t.setHours(0, 0, 0, 0);
            return days.findIndex(d => d.getTime() === t.getTime());
          };
          const events = [];
          let totalPeople = 0, shortlisted = 0, decisions = 0;
          const statusCounts = {};
          jobs.forEach(j => {
            (j.applicants || []).forEach(a => {
              totalPeople++;
              const st = a.status || 'applied';
              if (!isCourseJob(j)) {
                statusCounts[st] = (statusCounts[st] || 0) + 1;
                if (st === 'shortlisted' || st === 'interview') shortlisted++;
                if (JOB_DECISION_STATUSES.indexOf(st) !== -1) decisions++;
              }
              const bi = bucket(a.appliedAt); if (bi >= 0) apps[bi]++;
              events.push({ ts: a.appliedAt || 0, jobId: j.id, title: j.title, text: `${a.name || 'Someone'} ${isCourseJob(j) ? 'enrolled in' : 'applied to'}`, color: NAVY });
              if (!isCourseJob(j) && a.statusUpdatedAt && st !== 'applied') {
                const ui = bucket(a.statusUpdatedAt); if (ui >= 0) updates[ui]++;
                const m = JOB_STATUS_META[st] || JOB_STATUS_META.applied;
                events.push({ ts: a.statusUpdatedAt, jobId: j.id, title: j.title, text: `You marked ${a.name || 'an applicant'} as ${m.label} for`, color: m.color });
              }
            });
          });
          const inRange = apps.reduce((x, y) => x + y, 0);
          const statCard = (n, label) => `<div class="rounded-2xl py-3 px-2 text-center bg-white" style="border:1.5px solid #e5e7eb;"><div class="text-xl font-bold" style="color:${NAVY};">${n}</div><div class="text-[11px] text-gray-400">${label}</div></div>`;
          const statusRows = JOB_STATUS_ORDER.filter(k => statusCounts[k]);
          const statusTotal = statusRows.reduce((x, k) => x + statusCounts[k], 0);
          const listingRow = j => {
            const people = j.applicants || [];
            const course = isCourseJob(j);
            const counts = {};
            people.forEach(a => { const st = a.status || 'applied'; counts[st] = (counts[st] || 0) + 1; });
            const seg = (!course && people.length) ? `<div class="flex h-1.5 rounded-full overflow-hidden mt-2" style="background:#f3f4f6;">${JOB_STATUS_ORDER.filter(k => counts[k]).map(k => `<div style="width:${(counts[k] / people.length) * 100}%;background:${JOB_STATUS_META[k].color};"></div>`).join('')}</div>` : '';
            return `
              <button onclick="openPosterListing('${j.id}')" class="w-full text-left rounded-2xl p-4 mb-2.5 bg-white" style="border:1.5px solid #e5e7eb;">
                <div class="flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(j.title)}</div>
                    <div class="text-[11px] text-gray-400 truncate">${escapeHtml(j.type || 'Opportunity')}${j.deadline ? ' &middot; ' + (course ? 'Starts ' : 'Deadline ') + escapeHtml(j.deadline) : ''}</div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div class="text-lg font-bold leading-tight" style="color:${NAVY};">${people.length}</div>
                    <div class="text-[10px] text-gray-400">${course ? 'Enrolled' : 'Applicants'}</div>
                  </div>
                  <span class="text-gray-300 flex-shrink-0">${Icon('arrowRight','w-4 h-4')}</span>
                </div>
                ${seg}
              </button>`;
          };
          events.sort((a, b) => b.ts - a.ts);
          const recent = events.slice(0, 8);
          return `
              <div class="grid grid-cols-2 gap-3 mb-5">
                ${statCard(jobs.length, 'Listings')}${statCard(totalPeople, 'Applicants')}${statCard(shortlisted, 'Shortlisted / Interviews')}${statCard(decisions, 'Decisions')}
              </div>

              <div class="rounded-3xl p-4 mb-5 bg-white" style="border:1.5px solid #e5e7eb;">
                <div class="flex items-center justify-between mb-1">
                  <div class="font-semibold text-sm text-gray-800">Entries &amp; activity</div>
                  <div class="flex gap-1.5">${rangeBtn(7)}${rangeBtn(14)}${rangeBtn(30)}</div>
                </div>
                <div class="text-[11px] text-gray-400 mb-3">${inRange} new ${inRange === 1 ? 'entry' : 'entries'} in the last ${posterDashboardRange} days</div>
                ${posterDashboardChartHTML(days, apps, updates)}
                <div class="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
                  <span class="inline-flex items-center gap-1.5"><span style="width:9px;height:9px;border-radius:3px;background:${NAVY};"></span>New entries</span>
                  <span class="inline-flex items-center gap-1.5"><span style="width:9px;height:9px;border-radius:3px;background:${JOB_TRACKER_TEAL};"></span>Status updates</span>
                </div>
              </div>

              ${statusRows.length ? `
                <div class="rounded-3xl p-4 mb-5 bg-white" style="border:1.5px solid #e5e7eb;">
                  <div class="font-semibold text-sm text-gray-800 mb-3">Where applicants are</div>
                  <div class="space-y-2.5">
                    ${statusRows.map(k => {
                      const m = JOB_STATUS_META[k];
                      const pct = Math.round((statusCounts[k] / statusTotal) * 100);
                      return `<div>
                        <div class="flex items-center justify-between text-xs mb-1"><span class="font-medium text-gray-600">${escapeHtml(m.label)}</span><span class="text-gray-400">${statusCounts[k]}</span></div>
                        <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div class="h-full rounded-full" style="width:${pct}%;background:${m.color};"></div></div>
                      </div>`;
                    }).join('')}
                  </div>
                </div>` : ''}

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your listings</div>
              <div class="mb-5">${jobs.map(listingRow).join('')}</div>

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recent activity</div>
              ${recent.length ? recent.map((e, i) => `
                <button onclick="openPosterListing('${e.jobId}')" class="w-full text-left flex items-start gap-3 py-3 ${i === recent.length - 1 ? '' : 'border-b border-gray-100'}">
                  <span style="width:9px;height:9px;border-radius:9999px;background:${e.color};flex-shrink:0;margin-top:6px;"></span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-gray-700">${escapeHtml(e.text)} <span class="font-semibold text-gray-800">${escapeHtml(e.title)}</span></div>
                    <div class="text-[11px] text-gray-400">${e.ts ? escapeHtml(fmtJobDateTime(e.ts)) : ''}</div>
                  </div>
                </button>`).join('') : `<div class="text-sm text-gray-400">No activity yet.</div>`}`;
        }

        // The Dashboard page: a header, tabs (only when there is more than one), and the open
        // tab's content
        function posterDashboardHTML(){
          const tabs = dashboardTabs();
          if (!tabs.some(([k]) => k === dashboardTab)) dashboardTab = tabs[0][0];
          const body = dashboardTab === 'listings' ? posterListingsBodyHTML()
            : dashboardTab === 'wallet' ? creatorWalletBodyHTML()
            : receiptsBodyHTML();
          const pills = tabs.length > 1 ? `
            <div class="pill-bleed flex flex-shrink-0 gap-2 overflow-x-auto no-scrollbar pb-1 mb-4" style="justify-content:safe center;">
              ${tabs.map(([k, label]) => `<button onclick="setDashboardTab('${k}')" class="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${dashboardTab === k ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${dashboardTab === k ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${label}</button>`).join('')}
            </div>` : '';
          return `
            <div class="flex-1 overflow-y-auto px-5 flex flex-col" style="padding-bottom:50px;">
              <div class="flex-shrink-0" style="margin:0 -1.25rem 10px;">${overlayHeader('Dashboard', '20px', null, null, { right: true })}</div>
              <div class="max-w-2xl mx-auto w-full flex flex-col flex-1">
                ${pills}
                ${body}
              </div>
            </div>`;
        }

        // ---- Opportunity dashboard (track applicants/enrollees + activity) ----
        let jobDashboardViewingId = null;
        let jobDashboardMenuOpen = false;

        function openJobDashboard(id, fromPoster){
          const job = findJob(id);
          if (!job || !canCurrentUserManageJob(job)) return;
          jobDashboardFromPoster = !!fromPoster;
          jobDashboardViewingId = id;
          jobDashboardApplicantMenuOpenId = null;
          jobDashboardApplicantViewId = null;
          jobDashboardListFilter = null;
          jobDashboardMenuOpen = false;
          openOverlay('jobDashboard');
          loadJobApplicantProfiles(job);
        }

        // Three-dot menu on the Dashboard header itself
        function toggleJobDashboardMenu(){
          if (document.getElementById('job-sheet-menu')) { closeJobSheetMenu(); return; }
          const job = findJob(jobDashboardViewingId);
          if (job) openJobSheetMenu(job);
        }

        function jobDashboardMenuDropdownHTML(job){ return ''; }

        // Which applicant's status-picker is expanded, if any.
        let jobDashboardApplicantMenuOpenId = null;

        function toggleJobDashboardApplicantMenu(applicantId){
          jobDashboardApplicantMenuOpenId = (jobDashboardApplicantMenuOpenId === applicantId) ? null : applicantId;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobDashboardHTML();
        }

        // Re-renders the Overview/applicant screen without jumping back to the top.
        function rerenderJobDashboard(resetTop){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const sc = ov.querySelector('.overflow-y-auto');
          const top = (sc && !resetTop) ? sc.scrollTop : 0;
          const tabs = document.getElementById('job-dash-tabs');
          const tabsLeft = tabs ? tabs.scrollLeft : 0;
          ov.innerHTML = jobDashboardHTML();
          if (top) { const sc2 = ov.querySelector('.overflow-y-auto'); if (sc2) sc2.scrollTop = top; }
          // Keep the tab bar where the user left it, and make sure the chosen tab is in view, so
          // tapping Decisions (etc.) never snaps the bar back to the first tab
          const tabs2 = document.getElementById('job-dash-tabs');
          if (tabs2) {
            tabs2.scrollLeft = tabsLeft;
            const on = tabs2.querySelector('[data-active="1"]');
            if (on) {
              const l = on.offsetLeft, r = l + on.offsetWidth;
              if (l < tabs2.scrollLeft) tabs2.scrollLeft = Math.max(0, l - 12);
              else if (r > tabs2.scrollLeft + tabs2.clientWidth) tabs2.scrollLeft = r - tabs2.clientWidth + 12;
            }
          }
        }

        const JOB_MANAGE_STAGES = ['under_review', 'shortlisted', 'interview', 'offer'];
        let jobStatusExpandedStage = null;
        let jobInterviewDraft = null;     // { applicantId, dateTyped, timeTyped, mode, location }
        let jobApplicantMsgDraft = '';

        function jobStageLabel(k){
          const m = JOB_PIPELINE_META[k];
          return m ? m.label : 'Applied';
        }

        // Poster/admin moves an applicant along, or closes them out, and this auto-notifies them
        // via NOTIFICATIONS_TABLE (see subscribeToUserNotifications)
        async function posterUpdateApplicantStatus(jobId, applicantId, status, stage){
          const job = findJob(jobId);
          if (!job || !canCurrentUserManageJob(job)) return;
          const applicant = (job.applicants || []).find(a => a.id === applicantId);
          if (!applicant) return;
          const prev = applicant.status || 'applied';
          applicant.status = status;
          applicant.statusUpdatedAt = Date.now();
          if (status === 'rejected' || status === 'withdrawn') {
            applicant.statusStage = stage || (JOB_MANAGE_STAGES.indexOf(prev) !== -1 ? prev : (applicant.statusStage || 'under_review'));
          } else if (status === 'offer_accepted') {
            applicant.statusStage = 'offer';
          } else {
            applicant.statusStage = null;
          }
          jobStatusExpandedStage = null;
          jobDashboardApplicantMenuOpenId = null;
          rerenderJobDashboard();
          await saveApplicantRemote(job, applicant);
          const meta = JOB_STATUS_META[status] || JOB_STATUS_META.applied;
          const noun = job.type === 'Course' ? 'enrollment' : 'application';
          const stageText = jobStageLabel(applicant.statusStage);
          let message;
          if (status === 'withdrawn') message = `Your ${noun} for "${job.title}" was withdrawn at the ${stageText} stage.`;
          else if (status === 'rejected') message = `Your ${noun} for "${job.title}" was not successful at the ${stageText} stage.`;
          else if (status === 'offer_accepted') message = `Your offer for "${job.title}" is marked as accepted. Congratulations!`;
          else if (status === 'offer') message = `Congratulations! You've received an offer for "${job.title}".`;
          else message = `Your ${noun} for "${job.title}" is now: ${meta.label}.`;
          notifyUserRemote(applicantId, {
            type: 'application_status',
            title: 'Application update',
            message,
            jobId: job.id,
          });
        }

        function confirmPosterStatus(jobId, applicantId, status, stage){
          const verb = status === 'rejected' ? 'Reject' : 'Mark as withdrawn';
          const a = (findJob(jobId)?.applicants || []).find(x => x.id === applicantId);
          const nm = (a && a.name) || 'this applicant';
          openAppConfirmModal(
            `${verb}?`,
            `${nm} will be notified that their application was ${status === 'rejected' ? 'not successful' : 'withdrawn'} at the ${jobStageLabel(stage)} stage.`,
            verb,
            function(){ posterUpdateApplicantStatus(jobId, applicantId, status, stage); }
          );
        }

        function toggleJobStatusStage(stage, applicantId){
          jobStatusExpandedStage = (jobStatusExpandedStage === stage) ? null : stage;
          if (jobStatusExpandedStage === 'interview') {
            const job = findJob(jobDashboardViewingId);
            const a = job && (job.applicants || []).find(x => x.id === applicantId);
            if (a) jobInterviewDraftFor(a);
          }
          rerenderJobDashboard();
        }

        // ---- Interview scheduling ---- typed date (DD/MM/YYYY) + time (HH:MM, 24-hour).
        function jobInterviewDraftFor(a){
          if (!jobInterviewDraft || jobInterviewDraft.applicantId !== a.id) {
            const iv = a.interview || {};
            jobInterviewDraft = {
              applicantId: a.id,
              dateTyped: iv.date ? posterAppIsoToTyped(iv.date) : '',
              timeTyped: iv.time || '',
              mode: iv.mode || 'online',
              location: iv.location || '',
            };
          }
          return jobInterviewDraft;
        }
        function formatTypedTimeDigits(raw){
          const digits = String(raw || '').replace(/\D/g, '').slice(0, 4);
          return digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
        }
        function onJobInterviewDateInput(el){
          const f = formatTypedDateDigits(el.value);
          if (el.value !== f) el.value = f;
          if (jobInterviewDraft) jobInterviewDraft.dateTyped = f;
        }
        function onJobInterviewTimeInput(el){
          const f = formatTypedTimeDigits(el.value);
          if (el.value !== f) el.value = f;
          if (jobInterviewDraft) jobInterviewDraft.timeTyped = f;
        }
        function onJobInterviewLocationInput(el){
          if (jobInterviewDraft) jobInterviewDraft.location = el.value;
        }
        function setJobInterviewMode(mode){
          if (!jobInterviewDraft) return;
          jobInterviewDraft.mode = mode;
          rerenderJobDashboard();
        }

        function jobFmtTime12(t){
          const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
          if (!m) return t || '';
          const h = parseInt(m[1], 10);
          return (((h + 11) % 12) + 1) + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM');
        }
        function jobInterviewStart(iv){
          const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iv && iv.date) || '');
          const t = /^(\d{1,2}):(\d{2})/.exec((iv && iv.time) || '') || [0, 0, 0];
          if (!d) return null;
          return new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], 0, 0);
        }
        function jobInterviewWhenText(iv){
          const st = jobInterviewStart(iv);
          if (!st) return '';
          return st.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + (iv.time ? ' at ' + jobFmtTime12(iv.time) : '');
        }
        function jobInterviewWhereText(iv){
          return iv && iv.mode === 'in_person' ? (iv.location || 'In person') : 'Online on Stitch (video call)';
        }
        // The video call opens 15 minutes before the start time and stays open for 3 hours.
        function jobInterviewJoinWindow(iv){
          const st = jobInterviewStart(iv);
          if (!st) return { open: false, before: false };
          const now = Date.now(), start = st.getTime();
          return { open: now >= start - 15 * 60000 && now <= start + 3 * 3600000, before: now < start - 15 * 60000 };
        }

        async function posterScheduleInterview(jobId, applicantId){
          const job = findJob(jobId);
          if (!job || !canCurrentUserManageJob(job)) return;
          const a = (job.applicants || []).find(x => x.id === applicantId);
          const d = jobInterviewDraft;
          if (!a || !d || d.applicantId !== applicantId) return;
          const dp = parseTypedDateDDMMYYYY(d.dateTyped, { allowPast: false });
          if (dp.error || !dp.iso) { openAppAlertModal(dp.error || 'Please enter the interview date as DD/MM/YYYY, for example 14/10/2026.'); return; }
          const tm = /^(\d{2}):(\d{2})$/.exec((d.timeTyped || '').trim());
          if (!tm || +tm[1] > 23 || +tm[2] > 59) { openAppAlertModal('Please enter the time as HH:MM in 24-hour format, for example 14:30.'); return; }
          if (d.mode === 'in_person' && !(d.location || '').trim()) { openAppAlertModal('Add where the interview will take place.'); return; }
          const iv = { date: dp.iso, time: d.timeTyped.trim(), mode: d.mode, location: d.mode === 'in_person' ? d.location.trim() : '', scheduledAt: Date.now() };
          if (jobInterviewStart(iv).getTime() < Date.now()) { openAppAlertModal("That date and time has already passed. Pick a time in the future."); return; }
          const rescheduled = !!(a.interview && a.status === 'interview');
          a.interview = iv;
          a.status = 'interview';
          a.statusStage = null;
          a.statusUpdatedAt = Date.now();
          jobStatusExpandedStage = null;
          rerenderJobDashboard();
          await saveApplicantRemote(job, a);
          notifyUserRemote(applicantId, {
            type: 'interview_scheduled',
            title: rescheduled ? 'Interview rescheduled' : 'Interview scheduled',
            message: `Your interview for "${job.title}" is on ${jobInterviewWhenText(iv)} · ${jobInterviewWhereText(iv)}.`,
            jobId: job.id,
            metadata: { jobId: job.id, jobTitle: job.title, date: iv.date, time: iv.time, mode: iv.mode, location: iv.location },
          });
        }

        // ---- Online interview = a Stitch video call ----
        function interviewConvoId(jobId, applicantId){ return 'interview-' + jobId + '-' + applicantId; }

        function openInterviewCall(jobId, applicantId){
          const job = findJob(jobId);
          const a = job && (job.applicants || []).find(x => x.id === applicantId);
          if (!job || !a || !a.interview) return;
          const isPoster = canCurrentUserManageJob(job);
          if (!isPoster && applicantId !== currentUserId) return;
          const convoId = interviewConvoId(jobId, applicantId);
          const otherId = isPoster ? applicantId : job.createdByUserId;
          if (!otherId) { openAppAlertModal("Couldn't reach the other person for this call."); return; }
          const otherName = isPoster ? (a.name || 'Applicant') : (job.createdByName || job.org || 'Interviewer');
          const otherPhoto = isPoster ? jobApplicantPhoto(a) : null;
          if (typeof ensureInterviewConvoMeta === 'function') ensureInterviewConvoMeta(convoId, otherId, otherName, otherPhoto);
          if (!isPoster && typeof incomingCallInfo !== 'undefined' && incomingCallInfo && incomingCallInfo.convoId === convoId && typeof acceptIncomingCall === 'function') {
            acceptIncomingCall();
            return;
          }
          if (typeof startCall !== 'function') return;
          // The poster starts the call (which rings the applicant); the applicant joins it.
          startCall(convoId, 'video', !isPoster);
        }

        // Interview details + Join/Start button, shown to the poster and to the applicant.
        function jobInterviewCardHTML(job, a, forPoster){
          const iv = a && a.interview;
          if (!iv || !iv.date || (a.status || 'applied') !== 'interview') return '';
          const online = iv.mode !== 'in_person';
          const w = jobInterviewJoinWindow(iv);
          const action = !online ? '' : (w.open
            ? `<button onclick="openInterviewCall('${job.id}','${a.id}')" class="mt-4 w-full flex items-center justify-center gap-2 text-white font-semibold text-sm rounded-full py-3" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">${Icon('video','w-4 h-4')} ${forPoster ? 'Start video interview' : 'Join video interview'}</button>`
            : `<div class="text-xs text-gray-400 mt-3">${w.before ? 'The video call opens 15 minutes before the start time.' : 'The time for this interview has passed.'}</div>`);
          return `
            <div class="mb-6 py-4" style="border-top:1px solid #eef0f3;border-bottom:1px solid #eef0f3;">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">${forPoster ? 'Scheduled interview' : 'Your interview'}</div>
              <div class="flex items-start gap-3">
                <span class="text-gray-400 flex-shrink-0 mt-0.5">${Icon('calendar','w-5 h-5')}</span>
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-gray-800">${escapeHtml(jobInterviewWhenText(iv))}</div>
                  <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(jobInterviewWhereText(iv))}</div>
                </div>
              </div>
              ${action}
            </div>`;
        }

        // ---- Poster -> applicant messages ----
        function onJobApplicantMsgInput(el){ jobApplicantMsgDraft = el.value; }

        async function posterSendApplicantMessage(jobId, applicantId){
          const job = findJob(jobId);
          if (!job || !canCurrentUserManageJob(job)) return;
          const a = (job.applicants || []).find(x => x.id === applicantId);
          if (!a) return;
          const text = (jobApplicantMsgDraft || '').trim();
          if (!text) { openAppAlertModal('Type a message first.'); return; }
          a.messages = a.messages || [];
          a.messages.push({ text, at: Date.now() });
          jobApplicantMsgDraft = '';
          rerenderJobDashboard();
          await saveApplicantRemote(job, a);
          notifyUserRemote(applicantId, {
            type: 'application_message',
            title: job.title,
            message: text,
            jobId: job.id,
          });
        }

        function jobMessagesListHTML(a, emptyText){
          const msgs = (a.messages || []).slice().sort((x, y) => (y.at || 0) - (x.at || 0));
          if (!msgs.length) return emptyText ? `<div class="text-xs text-gray-400">${emptyText}</div>` : '';
          return msgs.map((m, i) => `
            <div class="py-3" style="${i ? 'border-top:1px solid #f3f4f6;' : ''}">
              <div class="text-sm text-gray-700 whitespace-pre-wrap break-words">${escapeHtml(m.text)}</div>
              <div class="text-[11px] text-gray-400 mt-1">${escapeHtml(fmtJobDateTime(m.at))}</div>
            </div>`).join('');
        }

        // ---- Applicants (poster / admin side) ----
        let jobDashboardApplicantViewId = null;
        let jobApplicantProfiles = {};   // userId -> { photo }

        function fmtJobDateTime(ts){
          if (!ts) return '';
          return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        }

        function jobDocLabel(id){
          const t = OPP_DOC_TYPES.find(x => x.id === id);
          return t ? t.label : id;
        }

        function jobDocDisplayName(name){
          try { return decodeURIComponent(name || 'file'); } catch (e) { return name || 'file'; }
        }

        function jobApplicantPhoto(a){
          const p = jobApplicantProfiles[a.id];
          return (p && p.photo) || a.photo || null;
        }

        function jobApplicantAvatarHTML(a, sizeCls, iconCls){
          return `<div class="${sizeCls} rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style="background:rgba(30,144,255,0.1);color:${NAVY};">${avatarMediaHTML(jobApplicantPhoto(a), 'user', iconCls)}</div>`;
        }

        // Pulls each applicant's current profile picture so the list is always up to date.
        async function loadJobApplicantProfiles(job){
          const sb = getSupabaseClient();
          if (!sb || !job) return;
          const ids = (job.applicants || []).map(a => a.id).filter(id => id && !(id in jobApplicantProfiles));
          if (!ids.length) return;
          try {
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id,photo').in('user_id', ids);
            (data || []).forEach(p => { jobApplicantProfiles[p.user_id] = { photo: p.photo || null }; });
            ids.forEach(id => { if (!(id in jobApplicantProfiles)) jobApplicantProfiles[id] = { photo: null }; });
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'jobDashboard') {
              rerenderJobDashboard();
            }
          } catch (e) { /* the stored photo (if any) is used instead */ }
        }

        // Overview -> tap Applicants / Shortlisted / Interviews / Decisions to open that list.
        let jobDashboardListFilter = null;
        const JOB_DECISION_STATUSES = ['offer', 'offer_accepted', 'rejected', 'withdrawn', 'closed'];
        const JOB_DASHBOARD_LISTS = {
          applicants:  { title: 'Applicants',  label: 'Applicants',  empty: 'No applications yet.',             match: () => true },
          shortlisted: { title: 'Shortlisted', label: 'Shortlisted', empty: 'No one has been shortlisted yet.', match: a => (a.status || 'applied') === 'shortlisted' },
          interview:   { title: 'Interviews',  label: 'Interviews',  empty: 'No interviews yet.',               match: a => (a.status || 'applied') === 'interview' },
          decisions:   { title: 'Decisions',   label: 'Decisions',   empty: 'No decisions made yet.',           match: a => JOB_DECISION_STATUSES.indexOf(a.status || 'applied') !== -1 },
        };

        function openJobDashboardList(key){
          jobDashboardListFilter = key;
          rerenderJobDashboard();
        }

        function closeJobDashboardList(){
          jobDashboardListFilter = null;
          rerenderJobDashboard();
        }

        function openJobDashboardApplicant(applicantId){
          jobDashboardApplicantViewId = applicantId;
          jobStatusExpandedStage = null;
          rerenderJobDashboard(true);
        }

        function closeJobDashboardApplicant(){
          jobDashboardApplicantViewId = null;
          rerenderJobDashboard(true);
        }

        // Finds one of an applicant's attached documents -- poster only.
        function getApplicantDoc(jobId, applicantId, key){
          const job = findJob(jobId);
          if (!job || !canCurrentUserManageJob(job)) return null;
          const a = (job.applicants || []).find(x => x.id === applicantId);
          if (!a) return null;
          return key.indexOf('extra:') === 0 ? (a.additionalDocuments || [])[parseInt(key.slice(6), 10)] : (a.documents || {})[key];
        }

        // Small files kept inline (when storage was unavailable) are turned back into a Blob.
        function jobDocInlineBlob(dataUrl){
          const parts = dataUrl.split(',');
          const mime = ((parts[0] || '').match(/:(.*?);/) || [])[1] || 'application/octet-stream';
          const bin = atob(parts[1] || '');
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return new Blob([arr], { type: mime });
        }

        // Opens an attached document so the poster can read it
        async function resolveApplicantDocUrl(jobId, applicantId, doc){
          try {
            const sb = getSupabaseClient();
            if (!sb || !doc) return null;
            const bucket = (typeof APPLICATION_DOCUMENT_STORAGE_BUCKET !== 'undefined') ? APPLICATION_DOCUMENT_STORAGE_BUCKET : 'application-documents';
            const folder = jobId + '/' + applicantId;
            const { data, error } = await sb.storage.from(bucket).list(folder, { limit: 100 });
            if (error || !data) return null;
            const safe = String(doc.fileName || '').replace(/[^A-Za-z0-9._-]/g, '_');
            const hit = data.find(f => f.name.endsWith('-' + safe)) || data.find(f => f.name.indexOf(safe) !== -1);
            if (!hit) return null;
            const { data: sg } = await sb.storage.from(bucket).createSignedUrl(folder + '/' + hit.name, 3600);
            return (sg && sg.signedUrl) || null;
          } catch (e) { return null; }
        }

        async function openApplicantDocument(jobId, applicantId, key){
          const doc = getApplicantDoc(jobId, applicantId, key);
          if (!doc) return;
          if (!doc.url && !doc.path && !doc.dataUrl) {
            const found = await resolveApplicantDocUrl(jobId, applicantId, doc);
            if (found) { window.open(found, '_blank', 'noopener'); return; }
          }
          if (doc.url || doc.path) {
            // Signed link works whether the bucket is public or private.
            const signed = (typeof getApplicationDocumentSignedUrl === 'function') ? await getApplicationDocumentSignedUrl(doc.path || doc.url) : null;
            if (!signed && !doc.url) { openAppAlertModal("Couldn't open this file. It may not have finished uploading - ask the applicant to re-submit it."); return; }
            window.open(signed || doc.url, '_blank', 'noopener');
            return;
          }
          if (doc.dataUrl) {
            try { window.open(URL.createObjectURL(jobDocInlineBlob(doc.dataUrl)), '_blank'); }
            catch (e) { openAppAlertModal('Could not open this file.'); }
            return;
          }
          openAppAlertModal("This file didn't upload, so it isn't available. Ask the applicant to re-submit it.");
        }

        // Saves an attached document to the poster's device.
        async function downloadApplicantDocument(jobId, applicantId, key){
          const doc = getApplicantDoc(jobId, applicantId, key);
          if (!doc) return;
          if (!doc.url && !doc.path && !doc.dataUrl) {
            const found = await resolveApplicantDocUrl(jobId, applicantId, doc);
            if (found) { doc.url = found; }
          }
          const name = (doc.fileName || 'document').replace(/[\\/:*?"<>|]/g, '_');
          const save = (blob) => {
            const href = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = href; link.download = name;
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(href), 10000);
          };
          try {
            if (doc.url || doc.path) {
              const signed = (typeof getApplicationDocumentSignedUrl === 'function') ? await getApplicationDocumentSignedUrl(doc.path || doc.url) : null;
              const res = await fetch(signed || doc.url);
              if (!res.ok) throw new Error('bad response');
              save(await res.blob());
              return;
            }
            if (doc.dataUrl) { save(jobDocInlineBlob(doc.dataUrl)); return; }
          } catch (e) {
            // Blocked or offline: fall back to the plain link so the browser can still try.
            if (doc.url) { window.open(doc.url, '_blank', 'noopener'); return; }
          }
          openAppAlertModal("This file didn't upload, so it isn't available. Ask the applicant to re-submit it.");
        }

        function jobApplicantDocRowHTML(job, a, label, fileName, key, available){
          // Buttons always show: Open/Download look the file up in storage if the record has no link
          available = true;
          const btnStyle = `background:rgba(30,144,255,0.12);color:${NAVY};`;
          return `
            <div class="rounded-2xl p-3 mb-2" style="border:1.5px solid #e5e7eb;">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('doc','w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-gray-400">${escapeHtml(label)}</div>
                  <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(jobDocDisplayName(fileName))}</div>
                </div>
                ${available ? '' : `<span class="text-[11px] text-gray-400 flex-shrink-0">Unavailable</span>`}
              </div>
              ${available ? `
                <div class="grid grid-cols-2 gap-2" style="margin-top:14px;">
                  <button onclick="openApplicantDocument('${job.id}','${a.id}','${key}')" class="text-xs font-bold py-2.5 rounded-full" style="${btnStyle}">Open</button>
                  <button onclick="downloadApplicantDocument('${job.id}','${a.id}','${key}')" class="text-xs font-bold py-2.5 rounded-full" style="${btnStyle}">Download</button>
                </div>` : ''}
            </div>`;
        }

        // Vertical timeline for an application that ended on a terminal status, so the applicant
        // (and poster) can see exactly WHERE it was rejected/withdrawn, or that an offer was
        // accepted
        function jobTerminalTimelineHTML(a){
          const status = a.status || 'applied';
          const tm = JOB_TERMINAL_META[status];
          if (!tm) return '';
          const order = JOB_PIPELINE_ORDER.filter(k => k !== 'saved');
          const stage = status === 'offer_accepted' ? 'offer' : a.statusStage;
          const stageIdx = order.indexOf(stage);
          if (stageIdx === -1) return '';
          const rows = order.map((k, i) => {
            const state = i < stageIdx ? 'done' : (i === stageIdx ? 'current' : 'upcoming');
            let dateText = '';
            if (k === 'applied' && a.appliedAt) dateText = fmtJobDate(a.appliedAt);
            else if (state === 'current' && a.statusUpdatedAt) dateText = fmtJobDate(a.statusUpdatedAt);
            const sub = status === 'rejected' ? 'Rejected at this stage' : (status === 'withdrawn' ? 'Withdrawn at this stage' : 'Offer accepted');
            const color = state === 'current' ? tm.color : JOB_PIPELINE_META[k].color;
            return jobTrackerStepRowHTML(JOB_PIPELINE_META[k].label, state, dateText, i === 0, i === order.length - 1, color, sub);
          }).join('');
          return `<div class="rounded-2xl" style="border:1.5px solid #e5e7eb;padding:6px;">${rows}</div>`;
        }

        // "Manage status": four stages separated by faint lines (no boxes)
        function jobApplicantStatusControlsHTML(job, a){
          const cur = a.status || 'applied';
          const terminal = JOB_TERMINAL_META[cur] ? cur : null;
          const activeStage = terminal ? (cur === 'offer_accepted' ? 'offer' : a.statusStage) : cur;
          const jid = job.id, aid = a.id;
          const act = (label, color, onclick, disabled) => `
            <button ${disabled ? 'disabled' : `onclick="${onclick}"`} class="w-full text-left text-sm font-semibold" style="padding:14px 4px 14px 18px;border-top:1px solid #f3f4f6;color:${disabled ? '#9ca3af' : color};background:none;">${label}</button>`;
          const rejectBtn = (k) => act('Reject at this stage', '#be123c', `confirmPosterStatus('${jid}','${aid}','rejected','${k}')`, terminal === 'rejected' && activeStage === k);
          const withdrawBtn = (k) => act('Withdrawn at this stage', '#4b5563', `confirmPosterStatus('${jid}','${aid}','withdrawn','${k}')`, terminal === 'withdrawn' && activeStage === k);
          const moveBtn = (k, label) => act(cur === k ? 'Current stage' : label, ROYAL, `posterUpdateApplicantStatus('${jid}','${aid}','${k}')`, cur === k);

          const interviewForm = () => {
            const d = jobInterviewDraftFor(a);
            const inp = 'w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none';
            const modeBtn = (m, label) => `<button onclick="setJobInterviewMode('${m}')" class="flex-1 text-sm py-2.5 rounded-full" style="${d.mode === m ? `background:${ROYAL};color:#fff;font-weight:600;` : 'background:#f3f4f6;color:#6b7280;font-weight:500;'}">${label}</button>`;
            return `
              <div style="padding:16px 4px 18px 18px;border-top:1px solid #f3f4f6;">
                <div class="text-xs font-semibold text-gray-500 mb-1.5">Date</div>
                <input type="text" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="DD/MM/YYYY" oninput="onJobInterviewDateInput(this)" value="${escapeHtml(d.dateTyped)}" class="${inp}">
                <div style="font-size:11px;color:#9ca3af;margin:6px 0 14px;">Format: DD/MM/YYYY (for example 14/10/2026)</div>
                <div class="text-xs font-semibold text-gray-500 mb-1.5">Time</div>
                <input type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="HH:MM" oninput="onJobInterviewTimeInput(this)" value="${escapeHtml(d.timeTyped)}" class="${inp}">
                <div style="font-size:11px;color:#9ca3af;margin:6px 0 14px;">Format: HH:MM, 24-hour (for example 14:30)</div>
                <div class="text-xs font-semibold text-gray-500 mb-1.5">Where</div>
                <div class="flex gap-2 mb-3">${modeBtn('online', 'Online on Stitch')}${modeBtn('in_person', 'In person')}</div>
                ${d.mode === 'in_person'
                  ? `<input type="text" autocomplete="off" placeholder="Address or venue" oninput="onJobInterviewLocationInput(this)" value="${escapeHtml(d.location)}" class="${inp}">`
                  : `<div style="font-size:12px;color:#6b7280;">The interview is held on Stitch as a video call. You and the applicant can join from the interview card once it opens, 15 minutes before the start time.</div>`}
                <button onclick="posterScheduleInterview('${jid}','${aid}')" class="w-full text-white font-semibold text-sm rounded-full py-3" style="margin-top:24px;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">${(a.interview && cur === 'interview') ? 'Reschedule &amp; notify' : 'Schedule &amp; notify'}</button>
              </div>`;
          };

          const actionsFor = (k) => {
            if (k === 'under_review' || k === 'shortlisted') return moveBtn(k, 'Move here') + rejectBtn(k) + withdrawBtn(k);
            if (k === 'interview') return interviewForm() + rejectBtn(k) + withdrawBtn(k);
            return act(cur === 'offer' ? 'Opportunity offered' : (cur === 'offer_accepted' ? 'Offer accepted by applicant' : 'Offer opportunity'), '#059669', `posterUpdateApplicantStatus('${jid}','${aid}','offer')`, cur === 'offer' || cur === 'offer_accepted')
              + rejectBtn(k) + withdrawBtn(k);
          };

          const rows = JOB_MANAGE_STAGES.map((k, i) => {
            const m = JOB_PIPELINE_META[k];
            const open = jobStatusExpandedStage === k;
            let marker = '';
            if (activeStage === k) {
              if (terminal === 'rejected') marker = `<span class="text-xs font-semibold" style="color:#be123c;">Rejected here</span>`;
              else if (terminal === 'withdrawn') marker = `<span class="text-xs font-semibold text-gray-500">Withdrawn here</span>`;
              else if (terminal === 'offer_accepted') marker = `<span class="text-xs font-semibold" style="color:#059669;">Accepted</span>`;
              else marker = `<span class="inline-flex items-center gap-1.5 text-xs font-semibold" style="color:${m.color};"><span style="width:8px;height:8px;border-radius:9999px;background:${m.color};"></span>Current</span>`;
            }
            return `
              <div style="${i ? 'border-top:1px solid #eef0f3;' : ''}">
                <button onclick="toggleJobStatusStage('${k}','${aid}')" class="w-full flex items-center justify-between gap-3 text-left" style="padding:20px 2px;background:none;">
                  <span class="text-base ${activeStage === k ? 'font-bold' : 'font-medium'}" style="color:${activeStage === k && !terminal ? m.color : '#1f2937'};">${escapeHtml(m.label)}</span>
                  <span class="flex items-center gap-3 flex-shrink-0">${marker}<span class="text-gray-400" style="display:inline-flex;transition:transform .2s;transform:rotate(${open ? 180 : 0}deg);">${Icon('chevronDown','w-4 h-4')}</span></span>
                </button>
                ${open ? `<div style="padding-bottom:10px;">${actionsFor(k)}</div>` : ''}
              </div>`;
          }).join('');

          return `
            <div style="padding-bottom:30px;">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Manage status</div>
              <div style="border-top:1px solid #eef0f3;border-bottom:1px solid #eef0f3;">${rows}</div>
            </div>`;
        }

        // The applicant's progress as they see it in their own tracker, so the poster can see
        // exactly what the status they set looks like on the other end
        function jobApplicantProgressHTML(a){
          const status = a.status || 'applied';
          const terminalMeta = JOB_TERMINAL_META[status];
          if (terminalMeta) {
            const c = terminalMeta.color;
            return `<div class="rounded-2xl p-4 mb-3" style="background:${c}14;border:1.5px solid ${c}40;">
              <div class="text-sm font-bold" style="color:${c};">${escapeHtml(terminalMeta.label)}</div>
              <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(terminalMeta.message)}</div>
            </div>${jobTerminalTimelineHTML(a)}`;
          }
          const order = JOB_PIPELINE_ORDER.filter(k => k !== 'saved');
          const idx = Math.max(0, order.indexOf(status));
          const rows = order.map((k, i) => {
            const state = i < idx ? 'done' : (i === idx ? 'current' : 'upcoming');
            let dateText = '';
            if (k === 'applied' && a.appliedAt) dateText = fmtJobDate(a.appliedAt);
            else if (state === 'current' && a.statusUpdatedAt) dateText = fmtJobDate(a.statusUpdatedAt);
            return jobTrackerStepRowHTML(JOB_PIPELINE_META[k].label, state, dateText, i === 0, i === order.length - 1, JOB_PIPELINE_META[k].color, JOB_TRACKER_SUBTEXT[k]);
          }).join('');
          return `<div class="rounded-2xl" style="border:1.5px solid #e5e7eb;padding:6px;">${rows}</div>`;
        }

        function jobDashboardApplicantDetailHTML(job, a){
          const meta = JOB_STATUS_META[a.status || 'applied'] || JOB_STATUS_META.applied;
          const required = job.requiredDocs || [];
          const docs = a.documents || {};
          const docKeys = Object.keys(docs);
          const extra = a.additionalDocuments || [];
          const missing = required.filter(id => !docs[id]);
          const detailLine = (label, value) => value ? `<div class="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100"><div class="text-xs text-gray-400 flex-shrink-0">${label}</div><div class="text-sm font-medium text-gray-800 text-right break-words min-w-0">${escapeHtml(value)}</div></div>` : '';
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto px-5">
                <div style="margin:0 -20px;">${overlayHeader('Application', '20px', 'closeJobDashboardApplicant()', null, { center: true, pb: '0px' })}</div>
                <div style="height:10px;"></div>
                <div class="flex items-center gap-4 mb-5">
                  ${jobApplicantAvatarHTML(a, 'w-16 h-16', 'w-8 h-8')}
                  <div class="min-w-0">
                    <div class="font-bold text-lg truncate">${escapeHtml(a.name || 'Unnamed')}</div>
                    ${jobAgeFromISO(a.dob) !== '' ? `<div class="text-sm text-gray-500">${jobAgeFromISO(a.dob)} years old</div>` : ''}
                  </div>
                </div>

                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Application details</div>
                <div class="mb-5">
                  ${detailLine('Applied for', job.title)}
                  ${detailLine('Applied on', fmtJobDateTime(a.appliedAt))}
                  ${detailLine('Last update', a.statusUpdatedAt ? fmtJobDateTime(a.statusUpdatedAt) : '')}
                  ${detailLine('Email', a.email)}
                  ${detailLine('Phone', a.phone)}
                  ${detailLine('Date of birth', a.dob ? isoToTypedDate(a.dob) : '')}
                  ${detailLine('Location', a.location)}
                </div>

                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Documents</div>
                <div class="mb-5">
                  ${docKeys.map(id => jobApplicantDocRowHTML(job, a, jobDocLabel(id), docs[id].fileName, id, true)).join('')}
                  ${extra.map((d, i) => jobApplicantDocRowHTML(job, a, 'Other document', d.fileName, 'extra:' + i, true)).join('')}
                  ${missing.map(id => `<div class="flex items-center gap-3 rounded-2xl p-3 mb-2" style="border:1.5px dashed #fca5a5;background:#fef2f2;"><div class="flex-1 min-w-0"><div class="text-xs text-red-400">${escapeHtml(jobDocLabel(id))}</div><div class="text-sm font-semibold text-red-500">Not provided</div></div></div>`).join('')}
                  ${(!docKeys.length && !extra.length && !missing.length) ? `<div class="text-sm text-gray-400">No documents were attached.</div>` : ''}
                </div>

                ${a.coverNote ? `
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Cover note</div>
                  <div class="rounded-2xl p-4 mb-5 text-sm text-gray-700 whitespace-pre-wrap" style="border:1.5px solid #e5e7eb;">${escapeHtml(a.coverNote)}</div>` : ''}

                ${jobInterviewCardHTML(job, a, true)}

                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Status &amp; tracker</div>
                <div class="text-xs text-gray-400 mb-3">Whatever you set here updates the applicant's tracker and notifies them.</div>
                <div class="mb-6">${jobApplicantProgressHTML(a)}</div>
                ${jobApplicantStatusControlsHTML(job, a)}

                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Message applicant</div>
                <div class="text-xs text-gray-400 mb-3">Sent to ${escapeHtml(a.name || 'the applicant')} as a notification.</div>
                <textarea id="job-applicant-msg" rows="3" maxlength="500" placeholder="Write a message, for example what to bring or a question about their application" oninput="onJobApplicantMsgInput(this)" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm resize-none outline-none">${escapeHtml(jobApplicantMsgDraft)}</textarea>
                <button onclick="posterSendApplicantMessage('${job.id}','${a.id}')" class="mt-3 mb-4 w-full flex items-center justify-center gap-2 text-white font-semibold text-sm rounded-full py-3" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">${Icon('send','w-4 h-4')} Send notification</button>
                <div style="padding-bottom:40px;">${jobMessagesListHTML(a, '')}</div>
              </div>
            </div>`;
        }

        function jobDashboardApplicantRowHTML(job, a, isLast, showStatus){
          const isCourse = job.type === 'Course';
          if (showStatus === 'decision') {
            const st = a.status || 'applied';
            const dm = JOB_STATUS_META[st] || JOB_STATUS_META.applied;
            const lbl = st === 'offer' ? 'Opportunity offered' : dm.label;
            return `<button onclick="openJobDashboardApplicant('${a.id}')" class="w-full text-left flex items-center gap-3 py-3.5 ${isLast ? '' : 'border-b border-gray-100'}">
              ${jobApplicantAvatarHTML(a, 'w-12 h-12', 'w-6 h-6')}
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">${escapeHtml(a.name || 'Unnamed')}</div>
                <div class="text-xs text-gray-400 truncate">${escapeHtml(a.email || '')}</div>
                <div class="text-xs font-bold mt-0.5" style="color:${dm.color};">${escapeHtml(lbl)}</div>
              </div>
              <span class="text-gray-300 flex-shrink-0">${Icon('arrowRight','w-4 h-4')}</span>
            </button>`;
          }
          const meta = JOB_STATUS_META[a.status || 'applied'] || JOB_STATUS_META.applied;
          const docCount = Object.keys(a.documents || {}).length + (a.additionalDocuments || []).length;
          const inner = `
            ${jobApplicantAvatarHTML(a, 'w-12 h-12', 'w-6 h-6')}
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate">${escapeHtml(a.name || 'Unnamed')}</div>
              <div class="text-xs text-gray-400 truncate">${escapeHtml(a.email || '')}</div>
              <div class="text-[11px] text-gray-400 mt-0.5">${a.appliedAt ? fmtJobDateTime(a.appliedAt) : ''}${(!isCourse && docCount) ? ` &middot; ${docCount} document${docCount === 1 ? '' : 's'}` : ''}</div>
            </div>
            ${!isCourse ? `<span class="text-gray-300 flex-shrink-0">${Icon('arrowRight','w-4 h-4')}</span>` : ''}`;
          return isCourse
            ? `<div class="flex items-center gap-3 py-3.5 ${isLast ? '' : 'border-b border-gray-100'}">${inner}</div>`
            : `<button onclick="openJobDashboardApplicant('${a.id}')" class="w-full text-left flex items-center gap-3 py-3.5 ${isLast ? '' : 'border-b border-gray-100'}">${inner}</button>`;
        }

        function jobDashboardHTML(){
          const job = findJob(jobDashboardViewingId);
          if (!job) return `${overlayHeader('Overview', '20px')}<div class="p-5 text-center text-gray-400 text-sm">This listing is no longer available.</div>`;
          const isCourse = job.type === 'Course';
          const people = (job.applicants || []).slice().sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0));
          if (jobDashboardApplicantViewId) {
            const viewing = people.find(a => a.id === jobDashboardApplicantViewId);
            if (viewing) return jobDashboardApplicantDetailHTML(job, viewing);
            jobDashboardApplicantViewId = null;
          }
          const tabKeys = ['applicants', 'shortlisted', 'interview', 'decisions'];
          const activeKey = (jobDashboardListFilter && JOB_DASHBOARD_LISTS[jobDashboardListFilter]) ? jobDashboardListFilter : 'applicants';
          const tabBtn = (key) => {
            const def = JOB_DASHBOARD_LISTS[key];
            const n = people.filter(def.match).length;
            const on = key === activeKey;
            return `<button data-active="${on ? 1 : 0}" onclick="openJobDashboardList('${key}')" class="flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap" style="background:none;border:none;border-bottom:2.5px solid ${on ? ROYAL : 'transparent'};color:${on ? ROYAL : '#9ca3af'};font-weight:${on ? 700 : 500};">${def.label}<span style="font-weight:700;color:${on ? ROYAL : '#6b7280'};">${n}</span></button>`;
          };
          const activeDef = JOB_DASHBOARD_LISTS[activeKey];
          const activeRows = people.filter(activeDef.match);
          const activeShowStatus = activeKey === 'decisions' ? 'decision' : (activeKey === 'applicants');
          const tabsAndList = `
            <div id="job-dash-tabs" class="flex overflow-x-auto no-scrollbar mb-4" style="border-bottom:1.5px solid #e5e7eb;margin-left:-1.25rem;margin-right:-1.25rem;padding-left:0.5rem;padding-right:0.5rem;-webkit-overflow-scrolling:touch;">
              ${tabKeys.map(tabBtn).join('')}
            </div>
            ${activeRows.length ? activeRows.map((a, i) => jobDashboardApplicantRowHTML(job, a, i === activeRows.length - 1, activeShowStatus)).join('') : `
              <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                <div class="flex justify-center mb-2 text-gray-400">${Icon('briefcase','w-6 h-6')}</div>
                ${activeDef.empty}
              </div>`}`;
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              ${menuOverlayHeader('Overview', jobDashboardMenuOpen, 'toggleJobDashboardMenu', jobDashboardMenuDropdownHTML(job), {backFn: 'jobDashboardBack', titleSize: 'text-lg', shortDashes: true, menuEnd: true})}
              <div class="flex-1 overflow-y-auto px-5 pb-8">
                <div class="font-bold text-lg font-display mb-1" style="color:#1E90FF;margin-top:8px;">${escapeHtml(job.title)}</div>
                <div class="text-xs text-gray-400 mb-4">${isCourse ? 'Enrollment' : 'Application'} activity for this listing${isCourse ? '' : ' · swipe the tabs and tap someone to see their details'}</div>
                ${isCourse ? `
                  <button onclick="goToJobCourse('${job.id}')" class="w-full flex items-center gap-3 bg-white rounded-3xl p-4 mb-5 shadow-sm border border-gray-100 text-left">
                    <div class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('book','w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-sm text-gray-800">Manage Course</div>
                      <div class="text-xs text-gray-400">Add modules, graded exams &amp; announcements, and see learner progress</div>
                    </div>
                    <span class="text-gray-400 flex-shrink-0">${Icon('arrowRight','w-4 h-4')}</span>
                  </button>
                  <div class="text-center mb-5">
                    <div class="text-2xl font-bold" style="color:${NAVY};">${people.length}</div>
                    <div class="text-xs text-gray-400">Enrolled</div>
                  </div>
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Enrolled people</div>
                  ${people.length ? people.map((a, i) => jobDashboardApplicantRowHTML(job, a, i === people.length - 1, false)).join('') : `
                    <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                      <div class="flex justify-center mb-2 text-gray-400">${Icon('briefcase','w-6 h-6')}</div>
                      No enrollments yet.
                    </div>`}
                ` : `
                  ${tabsAndList}`}
              </div>
            </div>`;
        }

        function openJobOrClassroom(id){
          const job = findJob(id);
          const app = jobApplication(job);
          if (job && job.type === 'Course' && app && !isCurrentUserAdmin()) {
            goToJobCourse(job.id);
            return;
          }
          openJobDetail(id);
        }

        function createLinkedCourse(job){
          const course = {
            id: 'course' + Date.now() + Math.random().toString(36).slice(2,6),
            org: job.org || TEAM_STITCH_TEACHER,
            title: job.title,
            description: job.description || '',
            deliveryType: 'uploaded',
            modules: [],
            resources: [],
            announcements: [],
            enrolledUsers: [],
            photo: job.coverImage || null,
            colorIndex: Math.floor(Math.random() * blueCardPalette.length),
            motifIndex: Math.floor(Math.random() * classCardMotifs.length),
            opportunityId: job.id,
          };
          allCourses.unshift(course);
          postCourseInsertRemote(course);
          return course.id;
        }

        async function syncLinkedCourseMeta(job){
          if (!job.courseId) return;
          const c = allCourses.find(x => x.id === job.courseId);
          if (!c) return;
          c.title = job.title;
          c.description = job.description || '';
          if (job.org) c.org = job.org;
          if (job.coverImage) c.photo = job.coverImage;
          await postCourseInsertRemote(c);
        }

        function enrollJobCourse(job){
          if (!job.courseId) job.courseId = createLinkedCourse(job);
          if (!enrolledCourseIds.includes(job.courseId)) enrolledCourseIds.push(job.courseId);
        }

        function goToJobCourse(jobId){
          const job = findJob(jobId);
          if (!job) return;
          if (!job.courseId) {
            job.courseId = createLinkedCourse(job);
            postOpportunityInsertRemote(job);
          }
          // Opened from Opportunities, so stay on the Opportunities tab (no switch to the classroom)
          // and remember which opportunity page to come back to: back from the course lands on that
          // page, or on the Opportunities list when there wasn't one
          if (currentOverlayKind === 'jobDashboard') {
            jobDashboardViewingId = job.id;
            overlayReturnTo = 'jobDashboard';
          } else if (currentOverlayKind === 'jobDetail' || currentOverlayKind === 'jobApply') {
            activeJobId = job.id;
            jobDetailMenuOpen = false;
            overlayReturnTo = 'jobDetail';
          } else {
            overlayReturnTo = null;
          }
          openCourseDetail(job.courseId);
        }

        function finalizeJobApplication(id, docsPayload){
          const job = findJob(id);
          if (!job) return;
          const app = jobApplications[id] = jobApplications[id] || {};
          app.status = 'applied';
          app.appliedDate = Date.now();
          app.statusUpdatedDate = Date.now();
          if (job.type === 'Course') {
            enrollJobCourse(job);
          }
          queueSaveUserState();
          // Record this applicant on the opportunity itself
          syncJobApplicant(job, docsPayload);
          if (job.applyMethod === 'website' && job.website) {
            window.open(ensureUrlScheme(job.website), '_blank');
          }
          const jobsContentEl = document.getElementById('jobs-content');
          if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
        }

        function jobDetailHTML(){
          const job = findJob(activeJobId);
          if (!job) return `${overlayHeader('Opportunity', '20px')}<div class="p-5 text-center text-gray-400 text-sm">This listing is no longer available.</div>`;
          const isCourse = job.type === 'Course';
          const isWebsiteJob = !isCourse && job.applyMethod === 'website' && !!job.website;
          const applyLabel = isCourse ? 'Enroll' : (isWebsiteJob ? 'Go to website' : 'Apply');
          const detailRow = (icon, label, value) => `
            <div class="flex items-center gap-3 py-2.5 ${label === 'Type' ? '' : 'border-t border-gray-100'}">
              <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(icon,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0 flex items-center justify-between gap-3">
                <span class="text-xs text-gray-400">${label}</span>
                <span class="text-sm font-semibold text-gray-800 text-right">${value}</span>
              </div>
            </div>`;
          const canManage = canCurrentUserManageJob(job);
          return `
            <div class="flex-1 overflow-y-auto">
            ${canManage
              ? menuOverlayHeader('Opportunity', jobDetailMenuOpen, 'toggleJobDetailMenu', jobDetailMenuDropdownHTML(job), {titleRight: true, titleSize: 'text-lg'})
              : overlayHeader('Opportunity', '20px', null, null, { right: true })}
            <div class="px-5" style="padding-top:20px;padding-bottom:50px;">
              ${(job.coverImage || (job.courseId && (allCourses.find(x => x.id === job.courseId) || {}).photo)) ? `<img src="${job.coverImage || (allCourses.find(x => x.id === job.courseId) || {}).photo}" class="w-full rounded-3xl mb-4 object-cover" style="height:180px;" alt="">` : ''}
              <div class="flex items-center gap-4 mb-5">
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-lg font-display leading-snug">${escapeHtml(job.title)}</div>
                  <div class="text-sm text-gray-500 truncate">${isCourse ? escapeHtml(stitchOrgName(job.org)) : (job.org || '')}</div>
                  ${(job.createdByUsername || job.createdByName) ? `<div class="text-xs text-gray-400 mt-0.5">Posted by ${job.createdByUsername ? '@' + escapeHtml(job.createdByUsername) : escapeHtml(job.createdByName)}</div>` : ''}
                </div>
              </div>
              <div class="mb-5 pb-5 border-b border-gray-100">
                <div class="font-semibold text-sm text-gray-800 mb-2">Description &amp; requirements</div>
                <div class="text-sm text-gray-600 leading-relaxed" style="white-space:pre-wrap;">${job.description ? escapeHtml(job.description) : 'No description provided.'}</div>
              </div>
              <div class="mb-5 pb-5 border-b border-gray-100">
                <div class="font-semibold text-sm text-gray-800 mb-1">Details</div>
                <div>
                  ${detailRow('briefcase', 'Type', job.type)}
                  ${detailRow(job.mode === 'Online' ? 'link' : 'pin', 'Location', job.mode)}
                  ${job.duration ? detailRow('clock', 'Duration', job.duration) : ''}
                  ${isCourse ? detailRow('chart', 'Price', job.priceType === 'paid' ? (job.price || 'Paid') : 'Free') : ''}
                  ${job.deadline ? detailRow('calendar', isCourse ? 'Start' : 'Deadline', job.deadline) : ''}
                </div>
              </div>
              ${isCourse ? `
                <div class="mb-5 pb-5 border-b border-gray-100">
                  <div class="font-semibold text-sm text-gray-800 mb-1">How to join</div>
                  <div class="text-xs text-gray-500">No application or letter needed: just enroll for free${job.priceType === 'paid' ? ', or pay the enrollment fee where applicable' : ''} to get started.${job.email ? ` Questions go to <span class="font-medium text-gray-700">${job.email}</span>.` : ''}</div>
                </div>` : (job.applyMethod === 'website' && job.website ? `
                <div class="mb-5 pb-5 border-b border-gray-100">
                  <div class="font-semibold text-sm text-gray-800 mb-1">How to apply</div>
                  <div class="text-xs text-gray-500">Applications are handled on their website: <a href="${ensureUrlScheme(job.website)}" target="_blank" rel="noopener" class="font-medium" style="color:${NAVY};">${escapeHtml(job.website)}</a></div>
                </div>` : `
                <div class="mb-5 pb-5 border-b border-gray-100">
                  <div class="font-semibold text-sm text-gray-800 mb-1">How to apply</div>
                  <div class="text-xs text-gray-500">Applications go straight to the poster here in the app -- no email needed.${!isCourse ? ` Have ready: <span class="font-medium text-gray-700">${['resume'].concat((job.requiredDocs || []).filter(id => id !== 'resume')).map(id => escapeHtml((OPP_DOC_TYPES.find(t=>t.id===id)||{}).label || id)).join(', ')}</span>.` : ''}</div>
                </div>`)}
              ${isJobApplied(job) && !isCourse ? jobApplicationTrackerHTML(job) : ''}
              ${(isCourse && canManage) ? `
                <button onclick="goToJobCourse('${job.id}')" class="w-full flex items-center gap-3 bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100 text-left">
                  <div class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('book','w-5 h-5')}</div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm text-gray-800">Manage Course</div>
                    <div class="text-xs text-gray-400">Add modules, graded exams &amp; announcements, and see learner progress</div>
                  </div>
                  <span class="text-gray-400 flex-shrink-0">${Icon('arrowRight','w-4 h-4')}</span>
                </button>` : ''}
              <div class="text-center mt-2" style="padding-bottom:10px;">
                ${isWebsiteJob
                  ? `<button onclick="openJobApply('${job.id}')" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${applyLabel}</button>`
                  : (isJobApplied(job)
                  ? (isCourse
                      ? `<button onclick="goToJobCourse('${job.id}')" class="pill-cta w-full inline-flex items-center justify-center gap-2 text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${Icon('book','w-4 h-4')} Go to Course</button>`
                      : (myJobApplicantStatus(job) === 'offer' ? '' : `<div class="w-full inline-flex items-center justify-center rounded-full font-bold text-sm text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${escapeHtml(jobStatusMeta(job).label)}</div>`))
                  : `<button onclick="openJobApply('${job.id}')" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${applyLabel}</button>`)}
              </div>
              ${canManage ? '' : `<div class="text-center pb-2"><button onclick="openReportOpportunity('${job.id}')" class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400">${Icon('flag','w-3.5 h-3.5')} Report this listing</button></div>`}
            </div>
            </div>`;
        }

        let activeApplyJobId = null;
        // documents: { [docTypeId]: { file, fileName } } -- the poster-required (or optional
        // resume) attachments. additionalDocuments: [{ file, fileName }] -- any other relevant
        // document the applicant wants the poster/admins to see, freely added.
        let jobApplyDraft = { fullName:'', email:'', phone:'', dob:'', dobIso:'', location:'', letterText:'', documents:{}, additionalDocuments:[] };
        let jobApplyErrors = { fullName:'', email:'', phone:'', dob:'', location:'' };

        // ---- Job application form ----
        function resetJobApplyDraft(){
          const prefillName = (typeof profileData !== 'undefined' && profileData.name) || '';
          jobApplyDraft = { fullName: prefillName, email: currentUserEmail || '', phone:'', dob:'', dobIso:'', location: careerKnownLocation(), letterText:'', documents:{}, additionalDocuments:[] };
          jobApplyErrors = { fullName:'', email:'', phone:'', dob:'', location:'' };
        }

        function openJobApply(id){
          const job = findJob(id);
          // Website-based opportunities don't need our in-app form (name, email, cover letter, etc.)
          if (job && job.type !== 'Course' && job.applyMethod === 'website' && job.website) {
            finalizeJobApplication(id);
            openJobDetail(id);
            return;
          }
          activeApplyJobId = id;
          resetJobApplyDraft();
          jobApplyPaymentBusy = false;
          jobApplySubmitBusy = false;
          openOverlay('jobApply');
        }

        function updateJobApplyField(field, value){
          jobApplyDraft[field] = value;
          if (jobApplyErrors[field]) {
            jobApplyErrors[field] = '';
            const errEl = document.getElementById('job-apply-error-' + field);
            if (errEl) errEl.remove();
            const inputEl = document.getElementById('job-apply-input-' + field);
            if (inputEl) inputEl.classList.remove('field-invalid');
          }
        }

        // Date of birth: typed as DD/MM/YYYY, slashes are inserted as digits are typed.
        function onJobApplyDobInput(el){
          const formatted = formatTypedDateDigits(el.value);
          if (el.value !== formatted) el.value = formatted;
          const parsed = parseTypedDateDDMMYYYY(formatted, { allowFuture: false });
          jobApplyDraft.dobIso = parsed.error ? '' : parsed.iso;
          updateJobApplyField('dob', formatted);
        }

        function jobApplyDobRow(){
          const err = jobApplyErrors.dob;
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Date of birth</label>
              <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" id="job-apply-input-dob" value="${escapeHtml(jobApplyDraft.dob || '')}" oninput="onJobApplyDobInput(this)" placeholder="DD/MM/YYYY" class="w-full bg-gray-100 flow-outline rounded-2xl px-4 py-3 text-sm${err ? ' field-invalid' : ''}" style="outline:none;${err ? 'border-color:#dc2626;' : ''}">
              ${err ? `<div class="field-error" id="job-apply-error-dob">${escapeHtml(err)}</div>` : ''}
              ${typedDateHintHTML()}
            </div>`;
        }

        // Whole years since an 'YYYY-MM-DD' date of birth ('' if missing/invalid).
        function jobAgeFromISO(iso){
          const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
          if (!m) return '';
          const y = +m[1], mo = +m[2], d = +m[3];
          const now = new Date();
          let age = now.getFullYear() - y;
          if ((now.getMonth() + 1) < mo || ((now.getMonth() + 1) === mo && now.getDate() < d)) age--;
          return (age >= 0 && age < 130) ? age : '';
        }

        function jobApplyFieldRow(label, field, placeholder, type){
          const err = jobApplyErrors[field];
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${label}</label>
              <input type="${type || 'text'}" id="job-apply-input-${field}" value="${escapeHtml(jobApplyDraft[field] || '')}" oninput="updateJobApplyField('${field}', this.value)" placeholder="${placeholder || ''}" class="w-full bg-gray-100 flow-outline rounded-2xl px-4 py-3 text-sm${err ? ' field-invalid' : ''}" style="outline:none;${err ? 'border-color:#dc2626;' : ''}">
              ${err ? `<div class="field-error" id="job-apply-error-${field}">${escapeHtml(err)}</div>` : ''}
            </div>`;
        }

        // ---- Opportunity document types ----
        const OPP_DOC_TYPES = [
          { id: 'resume', label: 'Resume / CV', accept: '.pdf,.doc,.docx' },
          { id: 'applicationLetter', label: 'Application letter', accept: '.pdf,.doc,.docx' },
          { id: 'coverLetter', label: 'Cover letter', accept: '.pdf,.doc,.docx' },
          { id: 'transcript', label: 'Academic transcript', accept: '.pdf,.doc,.docx' },
          { id: 'portfolio', label: 'Portfolio', accept: '.pdf,.doc,.docx' },
          { id: 'idDocument', label: 'ID document', accept: '.pdf,.jpg,.jpeg,.png' },
        ];
        // Which shared file-validation profile (see FILE_ACCEPT_PROFILES) applies to each type.
        const OPP_DOC_VALIDATION_PROFILE = { resume: 'resume', applicationLetter: 'coverLetter', coverLetter: 'coverLetter', transcript: 'coverLetter', portfolio: 'coverLetter', idDocument: 'idDoc' };

        function jobApplyDocPicker(docId, label, accept, required){
          const doc = jobApplyDraft.documents[docId];
          const inputId = 'job-apply-doc-input-' + docId;
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${escapeHtml(label)}${required ? ' <span class="text-red-500">*</span>' : ' (optional)'}</label>
              <input type="file" id="${inputId}" accept="${accept}" class="hidden" onchange="handleJobApplyDocSelect(event, '${docId}')">
              <button onclick="document.getElementById('${inputId}').click()" class="w-full flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3 text-left" style="border:1.5px solid #cbd5e1;">
                <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('paperclip','w-4 h-4')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate ${doc ? 'text-gray-800' : 'text-gray-400'}">${doc ? escapeHtml(doc.fileName) : 'Tap to attach a file'}</div>
                </div>
                ${doc ? `<span onclick="event.stopPropagation(); clearJobApplyDoc('${docId}')" class="flex-shrink-0 text-gray-400">${IconBold('close','w-4 h-4')}</span>` : ''}
              </button>
            </div>`;
        }

        function handleJobApplyDocSelect(event, docId){
          const file = event.target.files && event.target.files[0];
          if (!file) { event.target.value = ''; return; }
          const profileKey = OPP_DOC_VALIDATION_PROFILE[docId] || 'coverLetter';
          if (!validateOrRejectFile(event.target, file, profileKey)) return;
          event.target.value = '';
          jobApplyDraft.documents[docId] = { file, fileName: file.name };
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobApplyHTML();
        }

        function clearJobApplyDoc(docId){
          delete jobApplyDraft.documents[docId];
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobApplyHTML();
        }

        // Catch-all "any other relevant document" attachments
        function handleJobApplyAdditionalDocSelect(event){
          const file = event.target.files && event.target.files[0];
          if (!file) { event.target.value = ''; return; }
          if (!validateOrRejectFile(event.target, file, 'other')) return;
          event.target.value = '';
          jobApplyDraft.additionalDocuments.push({ file, fileName: file.name });
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobApplyHTML();
        }

        function removeJobApplyAdditionalDoc(index){
          jobApplyDraft.additionalDocuments.splice(index, 1);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobApplyHTML();
        }

        // The full "Documents" section of the apply form: the poster's required documents (resume
        // first, if it's one of them), a resume picker even when it isn't required, a free-text
        // cover note, and an open-ended "attach anything else relevant" list
        function jobApplyDocumentsHTML(job){
          const required = job.requiredDocs || [];
          const extraRequired = required.filter(id => id !== 'resume');
          return `
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 mt-2">Documents</div>
            ${jobApplyDocPicker('resume', 'Resume / CV', '.pdf,.doc,.docx', true)}
            ${extraRequired.map(id => {
              const t = OPP_DOC_TYPES.find(x => x.id === id);
              if (!t) return '';
              return jobApplyDocPicker(t.id, t.label, t.accept, true);
            }).join('')}
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Cover note (optional)</label>
              <textarea oninput="updateJobApplyField('letterText', this.value)" placeholder="Tell them why you're a great fit..." rows="5" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;resize:none;border:1.5px solid #cbd5e1;">${escapeHtml(jobApplyDraft.letterText || '')}</textarea>
            </div>
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Any other relevant document (optional)</label>
              <input type="file" id="job-apply-extra-doc-input" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" class="hidden" onchange="handleJobApplyAdditionalDocSelect(event)">
              ${(jobApplyDraft.additionalDocuments || []).map((doc, i) => `
                <div class="w-full flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3 mb-2" style="border:1.5px solid #cbd5e1;">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('paperclip','w-4 h-4')}</div>
                  <div class="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">${escapeHtml(doc.fileName)}</div>
                  <span onclick="removeJobApplyAdditionalDoc(${i})" class="flex-shrink-0 text-gray-400">${IconBold('close','w-4 h-4')}</span>
                </div>`).join('')}
              <button onclick="document.getElementById('job-apply-extra-doc-input').click()" class="w-full flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3 text-left" style="border:1.5px solid #cbd5e1;">
                <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('plus','w-4 h-4')}</div>
                <div class="flex-1 min-w-0 text-sm font-medium text-gray-400">Attach another document</div>
              </button>
            </div>`;
        }

        // Uploads every file the applicant attached to Supabase Storage (see
        // uploadApplicationDocumentToStorage in core.js) and resolves to the payload
        // syncJobApplicant saves onto the applicant's record
        async function jobApplyInlineFallback(file){
          try {
            if (!file || file.size > 3 * 1024 * 1024) return '';
            return await fileToDataUrl(file);
          } catch (e) { return ''; }
        }

        async function jobApplyUploadOne(file, jobId, applicantId, docId){
          if (typeof uploadApplicationDocumentDetailed === 'function') {
            return await uploadApplicationDocumentDetailed(file, jobId, applicantId, docId);
          }
          const url = (typeof uploadApplicationDocumentToStorage === 'function') ? await uploadApplicationDocumentToStorage(file, jobId, applicantId, docId) : null;
          return { url, path: null, error: '' };
        }

        async function uploadJobApplyDocuments(jobId){
          const out = { documents: {}, additionalDocuments: [] };
          const applicantId = await getCurrentUserId();
          if (!applicantId) return out;
          const docs = jobApplyDraft.documents || {};
          for (const docId of Object.keys(docs)) {
            const entry = docs[docId];
            if (!entry || !entry.file) continue;
            const up = await jobApplyUploadOne(entry.file, jobId, applicantId, docId);
            const rec = { fileName: entry.fileName || entry.file.name, url: up.url || '', path: up.path || '' };
            if (!up.url) { rec.dataUrl = await jobApplyInlineFallback(entry.file); if (up.error) rec.error = up.error; }
            out.documents[docId] = rec;
          }
          const extra = jobApplyDraft.additionalDocuments || [];
          for (let i = 0; i < extra.length; i++) {
            const entry = extra[i];
            if (!entry || !entry.file) continue;
            const up = await jobApplyUploadOne(entry.file, jobId, applicantId, `other-${i}`);
            const rec = { fileName: entry.fileName || entry.file.name, url: up.url || '', path: up.path || '' };
            if (!up.url) { rec.dataUrl = await jobApplyInlineFallback(entry.file); if (up.error) rec.error = up.error; }
            out.additionalDocuments.push(rec);
          }
          return out;
        }

        const careerInterestOptions = [
          { id: 'jobs', label: 'Jobs' },
          { id: 'internships', label: 'Internships' },
          { id: 'scholarships', label: 'Scholarships' },
          { id: 'volunteering', label: 'Volunteering' },
          { id: 'courses', label: 'Courses' },
        ];
        const careerExperienceLevels = [
          { id: 'entry', label: 'Entry-level', desc: 'Starting out or early in my career' },
          { id: 'mid', label: 'Mid-level', desc: 'A few years of experience in the field' },
          { id: 'senior', label: 'Senior', desc: 'Significant experience leading projects or teams' },
          { id: 'leadership', label: 'Leadership', desc: 'Director, VP, or C-level' },
          { id: 'unsure', label: 'Not sure yet', desc: "Help me figure it out" },
        ];
        const careerEducationLevels = [
          { id: 'none', label: 'No formal education' },
          { id: 'highschool', label: 'Highschool / GED' },
          { id: 'associate', label: 'Associate' },
          { id: 'bachelors', label: "Bachelor's Degree" },
          { id: 'masters', label: "Master's or Higher" },
        ];
        const careerWorkStyles = [
          { id: 'remote', label: 'Remote' },
          { id: 'hybrid', label: 'Hybrid' },
          { id: 'onsite', label: 'On-site' },
          { id: 'any', label: 'No preference' },
        ];
        // Two intro pages come first, then the seven form questions, then the plan page (shown
        // after the CV is submitted)
const careerStartStepIds = ['intro1', 'intro2', 'interests', 'keyword', 'experience', 'education', 'workStyle', 'age', 'gender', 'resume', 'plan'];
        const careerStartFormStepIds = ['interests', 'keyword', 'experience', 'education', 'workStyle', 'age', 'gender', 'resume'];
        let careerStartSkipIntro = false;
        let careerPlanFromMatches = false;
        const careerGenders = [
          { id: 'male', label: 'Male' },
          { id: 'female', label: 'Female' },
          { id: 'none', label: 'Prefer not to say' },
        ];
        const careerStartOptionalSteps = ['interests', 'keyword', 'experience', 'education', 'workStyle'];
        // ---- Career-start intake quiz (the floating pill's form) ----
        function careerStartStepIsEmpty(stepId, d){
          if (stepId === 'interests') return !d.interests.length;
          if (stepId === 'keyword') return !d.jobTitle.trim();
          if (stepId === 'experience') return !d.experienceLevel;
          if (stepId === 'education') return !d.education;
          if (stepId === 'workStyle') return !d.workStyle;
          return false;
        }
        let careerStartStepIndex = 0;
        let careerStartDraft = { interests: [], jobTitle: '', experienceLevel: '', education: '', workStyle: '', age: '', gender: '', fullName: '', email: '', phone: '', city: '', country: '', contactMethod: 'email', resumeFileName: '', resumeFile: null, resumeText: '', resumeDataUrl: '' };
        let careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', age: '', gender: '', fullName: '', email: '', phone: '', resume: '' };
        let careerStartProfile = null;
        let careerMatchesLoading = false;
        let careerMatchesError = '';
        function careerProfileStorageKey(userId){
          return userId ? `career-profile-v1:${userId}` : null;
        }
        async function loadCareerStartProfile(){
          try {
            const userId = await getCurrentUserId();
            const key = careerProfileStorageKey(userId);
            let local = null;
            if (key) {
              try { const raw = localStorage.getItem(key); local = raw ? JSON.parse(raw) : null; } catch (e) { local = null; }
            }
            const synced = careerStartProfile;
            const localTime = (local && local.updatedAt) || 0;
            const syncedTime = (synced && synced.updatedAt) || 0;
            const winner = syncedTime >= localTime ? (synced || local) : local;
            careerStartProfile = winner || null;
            if (key && winner) { try { localStorage.setItem(key, JSON.stringify(winner)); } catch (e) {  } }
          } catch (e) {  }
        }
        // ---- City and country: asked once (Match with CV form or any application form) and reused everywhere ----
        function careerSplitLocation(loc){
          const v = String(loc || '').trim();
          const i = v.lastIndexOf(',');
          return i < 0 ? { city: v, country: '' } : { city: v.slice(0, i).trim(), country: v.slice(i + 1).trim() };
        }
        function careerJoinLocation(city, country){
          return [String(city || '').trim(), String(country || '').trim()].filter(Boolean).join(', ');
        }
        function careerKnownLocation(){
          try { const v = careerStartProfile && careerStartProfile.botContact && String(careerStartProfile.botContact.location || '').trim(); if (v) return v; } catch (e) {}
          try { return (localStorage.getItem('stitch-last-location:' + (typeof currentUserId !== 'undefined' ? currentUserId : '')) || '').trim(); } catch (e) { return ''; }
        }
        function careerRememberLocation(loc){
          const v = String(loc || '').trim(); if (!v) return;
          try { localStorage.setItem('stitch-last-location:' + (typeof currentUserId !== 'undefined' ? currentUserId : ''), v); } catch (e) {}
          if (careerStartProfile) {
            if (!careerStartProfile.botContact) careerStartProfile.botContact = { phone: careerStartProfile.phone || '', location: '' };
            if (!String(careerStartProfile.botContact.location || '').trim()) { careerStartProfile.botContact.location = v; saveCareerStartProfile(); }
          }
        }
        async function saveCareerStartProfile(){
          try {
            const userId = await getCurrentUserId();
            const key = careerProfileStorageKey(userId);
            if (!key) { console.warn('Could not save Career Profile: no signed-in user.'); return; }
            localStorage.setItem(key, JSON.stringify(careerStartProfile));
          } catch (e) { console.warn('Could not save Career Profile locally:', e); }
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }
        function fileToDataUrl(file){
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        async function extractCareerStartResumeText(file){
          try {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            if (ext === 'pdf') return await extractPdfText(file);
            if (ext === 'docx') return await extractDocxText(file);
            return '';
          } catch (e) { console.warn('Resume text extraction failed:', e); return ''; }
        }
        const careerStartResumeUploadPhases = ['Fetching…', 'Extracting content…', 'Almost there…', 'Finding matches…', 'In a second…'];
        let careerStartResumeUploading = false;
        let careerStartResumeUploadPhaseIndex = 0;
        let careerStartResumeUploadTimers = [];
        function clearCareerStartResumeUploadTimers(){
          careerStartResumeUploadTimers.forEach(t => clearTimeout(t));
          careerStartResumeUploadTimers = [];
        }
        function startCareerStartResumeUploadAnimation(){
          clearCareerStartResumeUploadTimers();
          careerStartResumeUploading = true;
          careerStartResumeUploadPhaseIndex = 0;
          rerenderCareerStart();
          const stepMs = 1000; 
          careerStartResumeUploadPhases.forEach((_, i) => {
            if (i === 0) return; 
            careerStartResumeUploadTimers.push(setTimeout(() => {
              careerStartResumeUploadPhaseIndex = i;
              rerenderCareerStart();
            }, i * stepMs));
          });
          careerStartResumeUploadTimers.push(setTimeout(() => {
            careerStartResumeUploading = false;
            careerStartResumeUploadTimers = [];
            rerenderCareerStart();
          }, careerStartResumeUploadPhases.length * stepMs));
        }
        function resetCareerStartDraft(){
          careerStartStepIndex = 0;
          careerStartSkipIntro = false;
          careerStartIntroThenPlan = false;
          careerPlanFromMatches = false;
          // The separate "How can we reach you?" page is gone: name and email come from the account.
          careerStartDraft = { interests: [], jobTitle: '', experienceLevel: '', education: '', workStyle: '', age: '', gender: '', fullName: (typeof profileData !== 'undefined' && profileData && profileData.name) || '', email: (typeof currentUserEmail !== 'undefined' && currentUserEmail) || '', phone: '', city: careerSplitLocation(careerKnownLocation()).city, country: careerSplitLocation(careerKnownLocation()).country, contactMethod: 'email', resumeFileName: '', resumeFile: null, resumeText: '', resumeDataUrl: '' };
          careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', age: '', gender: '', fullName: '', email: '', phone: '', resume: '' };
          clearCareerStartResumeUploadTimers();
          careerStartResumeUploading = false;
          careerStartResumeUploadPhaseIndex = 0;
        }
        function openCareerStartForm(){
          if (careerStartProfile && careerStartProfile.email) {
            if (careerSubscriptionActive()) openCareerMatchesPage(false);
            else openCareerStartIntro();
            return;
          }
          resetCareerStartDraft();
          openOverlay('careerStart');
        }
        // Unsubscribed users always begin at the intro pages, then go through the form questions
        // (pre-filled with their saved answers if they have a profile) before reaching the plan
        // page
        let careerStartIntroThenPlan = false;
        function openCareerStartIntro(){
          const hasProfile = !!(careerStartProfile && careerStartProfile.email);
          if (hasProfile) openCareerStartPlan(); else resetCareerStartDraft();
          careerStartIntroThenPlan = false;
          careerStartSkipIntro = false;
          careerStartStepIndex = 0;
          if (currentOverlayKind === 'careerStart') rerenderCareerStart();
          else openOverlay('careerStart');
        }
        // Jumps straight to the plan page (profile already saved, no active subscription).
        function openCareerStartPlan(fromMatches){
          resetCareerStartDraft();
          const p = careerStartProfile;
          if (p) {
            careerStartDraft.interests = [...(p.interests || [])];
            careerStartDraft.jobTitle = p.jobTitle || '';
            careerStartDraft.experienceLevel = p.experienceLevel || '';
            careerStartDraft.education = p.education || '';
            careerStartDraft.workStyle = p.workStyle || '';
            careerStartDraft.age = p.age || '';
            careerStartDraft.gender = p.gender || '';
            careerStartDraft.fullName = p.fullName || careerStartDraft.fullName;
            careerStartDraft.email = p.email || careerStartDraft.email;
            careerStartDraft.phone = p.phone || '';
            careerStartDraft.contactMethod = p.contactMethod || 'email';
            careerStartDraft.resumeFileName = p.resumeFileName || '';
            careerStartDraft.resumeText = p.resumeText || '';
            careerStartDraft.resumeDataUrl = p.resumeDataUrl || '';
          }
          careerStartStepIndex = careerStartStepIds.indexOf('plan');
          careerStartSkipIntro = true;
          careerStartIntroThenPlan = false;
          careerPlanFromMatches = fromMatches === true;
          if (currentOverlayKind === 'careerStart') rerenderCareerStart();
          else openOverlay('careerStart');
        }
        function startCareerStartQuiz(returnKind){
          resetCareerStartDraft();
          const p = careerStartProfile;
          if (p) {
            careerStartDraft.interests = [...(p.interests || [])];
            careerStartDraft.jobTitle = p.jobTitle || '';
            careerStartDraft.experienceLevel = p.experienceLevel || '';
            careerStartDraft.education = p.education || '';
            careerStartDraft.workStyle = p.workStyle || '';
            careerStartDraft.age = p.age || '';
            careerStartDraft.gender = p.gender || '';
            careerStartDraft.fullName = p.fullName || '';
            careerStartDraft.email = p.email || '';
            careerStartDraft.phone = p.phone || '';
            careerStartDraft.contactMethod = p.contactMethod || 'email';
            careerStartDraft.resumeFileName = p.resumeFileName || '';
            careerStartDraft.resumeText = p.resumeText || '';
            careerStartDraft.resumeDataUrl = p.resumeDataUrl || '';
            careerStartSkipIntro = true;
            careerStartStepIndex = careerStartStepIds.indexOf('interests');
          }
          if (returnKind) openOverlayFrom(returnKind, 'careerStart');
          else openOverlay('careerStart');
        }
        function rerenderCareerStart(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = careerStartFormHTML();
        }
        // Mirrors posterAppBack() in the "Apply to post" flow: the header back arrow (and the
        // hardware/browser back button, wired through overlayBackAction) steps back one question
        // at a time instead of leaving the whole flow, and only exits once you're already on
        function careerStartBack(fromPopState){
          careerPlanBusy = false;
          if (careerPlanFromMatches && careerStartStepIds[careerStartStepIndex] === 'plan' && careerStartProfile && careerSubscriptionActive()) {
            careerPlanFromMatches = false;
            openOverlay('careerMatches');
            return;
          }
          if (careerStartStepIndex > (careerStartSkipIntro ? careerStartStepIds.indexOf('interests') : 0)) {
            careerStartStepIndex--;
            careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', age: '', gender: '', fullName: '', email: '', phone: '', resume: '' };
            rerenderCareerStart();
            return;
          }
          if (overlayReturnTo) { overlayGoBack(); return; }
          closeOverlay(fromPopState);
        }
        function updateCareerStartField(field, value){ careerStartDraft[field] = value; careerStartSyncNext(); }
        // "Next" only shows once the step has an answer (selected / started typing)
        function careerStartStepReady(){
          const stepId = careerStartStepIds[careerStartStepIndex];
          const d = careerStartDraft;
          if (stepId === 'interests') return d.interests.length > 0;
          if (stepId === 'keyword') return !!d.jobTitle.trim();
          if (stepId === 'experience') return !!d.experienceLevel;
          if (stepId === 'education') return !!d.education;
          if (stepId === 'workStyle') return !!d.workStyle;
          if (stepId === 'age') return !!String(d.age || '').trim();
          if (stepId === 'gender') return !!d.gender;
          return true;
        }
        function careerStartSyncNext(){
          const wrap = document.getElementById('career-start-next-wrap');
          if (wrap) wrap.style.display = careerStartStepReady() ? '' : 'none';
        }
        function toggleCareerStartInterest(id){
          const idx = careerStartDraft.interests.indexOf(id);
          if (idx === -1) careerStartDraft.interests.push(id); else careerStartDraft.interests.splice(idx, 1);
          rerenderCareerStart();
        }
        function setCareerStartExperience(id){ careerStartDraft.experienceLevel = id; rerenderCareerStart(); }
        function setCareerStartEducation(id){ careerStartDraft.education = id; rerenderCareerStart(); }
        function setCareerStartGender(id){ careerStartDraft.gender = id; rerenderCareerStart(); }
        function setCareerStartWorkStyle(id){ careerStartDraft.workStyle = id; rerenderCareerStart(); }
        function handleCareerStartResumeSelect(event){
          const file = event.target.files && event.target.files[0];
          if (!file) { event.target.value = ''; return; }
          if (!validateOrRejectFile(event.target, file, 'resume')) return;
          event.target.value = '';
          careerStartDraft.resumeFileName = file.name;
          careerStartDraft.resumeFile = file;
          careerStartDraft.resumeText = '';
          careerStartDraft.resumeDataUrl = '';
          startCareerStartResumeUploadAnimation();
          extractCareerStartResumeText(file).then(text => { careerStartDraft.resumeText = text; });
          fileToDataUrl(file).then(url => { careerStartDraft.resumeDataUrl = url; }).catch(() => {});
          if (typeof uploadResumeFileToStorage === 'function') {
            uploadResumeFileToStorage(file).then(url => {
              if (!url) return;
              if (careerStartDraft.resumeFile === file) {
                careerStartDraft.resumeDataUrl = url;
              } else if (careerStartProfile && careerStartProfile.resumeFileName === file.name) {
                careerStartProfile.resumeDataUrl = url;
                saveCareerStartProfile();
              }
            });
          }
        }
        function clearCareerStartResume(){
          clearCareerStartResumeUploadTimers();
          careerStartResumeUploading = false;
          careerStartDraft.resumeFileName = '';
          careerStartDraft.resumeFile = null;
          careerStartDraft.resumeText = '';
          careerStartDraft.resumeDataUrl = '';
          rerenderCareerStart();
        }
        function careerStartResumePickerHTML(){
          const fileName = careerStartDraft.resumeFileName;
          const err = careerStartErrors.resume;
          if (careerStartResumeUploading) {
            const phase = careerStartResumeUploadPhases[careerStartResumeUploadPhaseIndex];
            return `
              <div class="mb-4">
                <div class="w-full flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3 text-left">
                  <div class="w-9 h-9 rounded-full flex-shrink-0" style="position:relative;">
                    <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(10,37,64,0.12) 45%, rgba(10,37,64,0.12) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));animation:classroom-spin 0.9s linear infinite;"></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate text-gray-800">${escapeHtml(fileName)}</div>
                    <div class="text-xs font-medium mt-0.5 cv-upload-phase" style="color:${NAVY};">${phase}</div>
                  </div>
                </div>
              </div>`;
          }
          return `
            <div class="mb-4">
              <input type="file" id="career-start-resume-input" accept=".pdf,.doc,.docx" class="hidden" onchange="handleCareerStartResumeSelect(event)">
              <button onclick="document.getElementById('career-start-resume-input').click()" class="w-full flex items-center gap-3 bg-gray-100 flow-outline rounded-2xl px-4 py-3 text-left${err ? ' field-invalid' : ''}">
                <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('paperclip','w-4 h-4')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate ${fileName ? 'text-gray-800' : 'text-gray-400'}">${fileName || 'Tap to attach your resume/CV (PDF or Word) *'}</div>
                </div>
                ${fileName ? `<span onclick="event.stopPropagation(); clearCareerStartResume()" class="flex-shrink-0 text-gray-400">${IconBold('close','w-4 h-4')}</span>` : ''}
              </button>
              ${err ? `<div class="field-error">${escapeHtml(err)}</div>` : ''}
            </div>`;
        }
        function setCareerStartContactMethod(method){
          careerStartDraft.contactMethod = method;
          rerenderCareerStart();
        }
        function careerContactMethodToggleHTML(value){
          const options = [
            { id: 'email', label: 'Email', icon: 'mail' },
            { id: 'inApp', label: 'In-app notification', icon: 'bell' },
          ];
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Notify me by</label>
              <div class="flex gap-2 bg-gray-100 rounded-2xl p-1">
                ${options.map(o => `
                  <button onclick="setCareerStartContactMethod('${o.id}')" class="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl transition-colors" style="${value === o.id ? `background:#fff;color:${NAVY};box-shadow:0 1px 3px rgba(0,0,0,0.12);` : 'background:transparent;color:#9ca3af;'}">
                    ${Icon(o.icon, 'w-4 h-4')}${o.label}
                  </button>
                `).join('')}
              </div>
            </div>`;
        }
        function careerStartFieldHTML(label, field, type, placeholder){
          const err = careerStartErrors[field];
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${label}</label>
              <input type="${type || 'text'}" autocomplete="off" value="${escapeHtml(careerStartDraft[field])}" oninput="updateCareerStartField('${field}', this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();careerStartFieldEnter(this);}" enterkeyhint="next" placeholder="${placeholder || ''}" class="w-full bg-gray-100 flow-outline rounded-2xl px-4 py-3 text-sm${err ? ' field-invalid' : ''}" style="outline:none;${err ? 'border-color:#dc2626;' : ''}">
              ${err ? `<div class="field-error">${escapeHtml(err)}</div>` : ''}
            </div>`;
        }
        // Enter/keyboard-"Go" on one of careerStartFieldHTML's inputs
        function careerStartFieldEnter(el){
          const scope = document.getElementById('career-start-step-body');
          const fields = scope ? Array.from(scope.querySelectorAll('input')) : [];
          const idx = fields.indexOf(el);
          const nextField = idx !== -1 ? fields[idx + 1] : null;
          if (nextField) { nextField.focus(); return; }
          careerStartNext();
        }
        function careerStartOptionListHTML(options, selectedId, setterName, errorKey, withDesc){
          const err = careerStartErrors[errorKey];
          return `
            <div class="flex flex-col gap-3 mb-1">
              ${options.map(o => `
                <button onclick="${setterName}('${o.id}')" class="w-full px-4 py-4 rounded-2xl text-left text-sm font-medium outline-pill ${selectedId === o.id ? 'is-selected' : ''}">
                  ${o.label}
                  ${withDesc && o.desc ? `<div class="text-xs font-normal mt-0.5" style="color:var(--pill-text);opacity:${selectedId === o.id ? '0.85' : '0.6'};">${o.desc}</div>` : ''}
                </button>
              `).join('')}
            </div>
            ${err ? `<div class="field-error">${escapeHtml(err)}</div>` : ''}`;
        }
        // ---- "Match with CV/Resume": one question per page ----
        function careerStartStepTitle(stepId){
          if (stepId === 'interests') return 'What are you looking for?';
          if (stepId === 'keyword') return 'Role, subject, or keyword';
          if (stepId === 'experience') return 'Your experience level';
          if (stepId === 'education') return 'Your education';
          if (stepId === 'workStyle') return 'How you like to work';
          if (stepId === 'age') return 'How old are you?';
          if (stepId === 'gender') return 'Your gender';
          if (stepId === 'resume') return 'Get 3x more matches';
          return 'Match with CV/Resume';
        }
        function careerStartStepSub(stepId){
          if (stepId === 'interests') return 'Pick as many as apply.';
          if (stepId === 'keyword') return 'What role, subject, or keyword are you searching for?';
          if (stepId === 'experience') return 'Which experience level fits you best?';
          if (stepId === 'education') return "What's your highest level of education?";
          if (stepId === 'workStyle') return 'How would you like to work or study?';
          if (stepId === 'age') return 'Some opportunities have an age range.';
          if (stepId === 'gender') return 'Some opportunities are open to one gender only.';
          if (stepId === 'resume') return "We'll match your experience and skills to the best-fit opportunities.";
          return '';
        }
        // Smaller helper line under the question, same role as posterAppStageHint above.
        function careerStartStepHint(stepId){
          if (stepId === 'interests') return "We'll widen your matches across everything you pick.";
          if (stepId === 'workStyle') return 'This shapes which opportunities we prioritize for you.';
          if (stepId === 'gender') return "We only use this to match you with opportunities you're eligible for.";
          if (stepId === 'resume') return 'Your resume/CV is required so Stitch Bot can match you to the right opportunities.';
          return '';
        }
        function careerStartStepBodyHTML(){
          const stepId = careerStartStepIds[careerStartStepIndex];
          const d = careerStartDraft;
          if (stepId === 'interests') {
            return `
              <div class="flex flex-col gap-3 mb-1">
                ${careerInterestOptions.map(o => `
                  <button onclick="toggleCareerStartInterest('${o.id}')" class="w-full px-4 py-4 rounded-2xl text-left text-sm font-medium outline-pill ${d.interests.includes(o.id) ? 'is-selected' : ''}">${o.label}</button>
                `).join('')}
              </div>
              ${careerStartErrors.interests ? `<div class="field-error">${escapeHtml(careerStartErrors.interests)}</div>` : ''}`;
          }
          if (stepId === 'keyword') {
            return careerStartFieldHTML('Keyword', 'jobTitle', 'text', 'e.g. Project Manager, Nursing, Climate advocacy');
          }
          if (stepId === 'experience') {
            return careerStartOptionListHTML(careerExperienceLevels, d.experienceLevel, 'setCareerStartExperience', 'experienceLevel', true);
          }
          if (stepId === 'education') {
            return careerStartOptionListHTML(careerEducationLevels, d.education, 'setCareerStartEducation', 'education', false);
          }
          if (stepId === 'workStyle') {
            return careerStartOptionListHTML(careerWorkStyles, d.workStyle, 'setCareerStartWorkStyle', 'workStyle', false);
          }
          if (stepId === 'age') {
            return careerStartFieldHTML('Age', 'age', 'number', 'e.g. 21');
          }
          if (stepId === 'gender') {
            return careerStartOptionListHTML(careerGenders, d.gender, 'setCareerStartGender', 'gender', false);
          }
          if (stepId === 'resume') {
            return careerStartFieldHTML('Phone number (with country code)', 'phone', 'tel', 'e.g. +233 24 123 4567') +
              careerStartFieldHTML('City', 'city', 'text', 'e.g. Accra') +
              careerStartFieldHTML('Country', 'country', 'text', 'e.g. Ghana') +
              careerStartResumePickerHTML();
          }
          return '';
        }

        // ---- Phone numbers: must carry a country code and look like a real number ----
        const CALLING_CODES = new Set(('1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 90 91 92 93 94 95 98 ' +
          '211 212 213 216 218 220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 235 236 237 238 239 240 241 242 243 244 245 246 248 249 250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 ' +
          '290 291 297 298 299 350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 380 381 382 383 385 386 387 389 420 421 423 500 501 502 503 504 505 506 507 508 509 590 591 592 593 594 595 596 597 598 599 ' +
          '670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 850 852 853 855 856 880 886 960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 992 993 994 995 996 998').split(' '));
        // Expected length of the number after the country code (without a leading 0), where it is
        // fixed
        const CALLING_CODE_LENGTHS = { '233': 9, '234': 10, '1': 10, '44': 10, '254': 9, '27': 9, '91': 10, '231': 8 };
        function normalizeIntlPhone(raw){
          let v = String(raw || '').trim();
          if (!v) return { ok: false, error: 'Please add your phone number.' };
          if (v.indexOf('00') === 0) v = '+' + v.slice(2);
          if (v.charAt(0) !== '+') return { ok: false, error: 'Start with your country code, e.g. +233 24 123 4567.' };
          if (/[^\d\s\-().+]/.test(v) || v.indexOf('+', 1) !== -1) return { ok: false, error: 'Use digits only, e.g. +233 24 123 4567.' };
          const digits = v.replace(/\D/g, '');
          let code = '';
          for (let n = 1; n <= 3; n++) { if (CALLING_CODES.has(digits.slice(0, n))) { code = digits.slice(0, n); break; } }
          if (!code) return { ok: false, error: "That country code doesn't exist. Check it and try again, e.g. +233 for Ghana." };
          let national = digits.slice(code.length).replace(/^0+/, '');
          const want = CALLING_CODE_LENGTHS[code];
          if (want ? national.length !== want : (national.length < 6 || national.length > 12)) {
            return { ok: false, error: want ? `A +${code} number has ${want} digits after the country code (you can leave out the leading 0).` : `That number is too ${national.length < 6 ? 'short' : 'long'} for +${code}.` };
          }
          const seq = '01234567890123456789', rseq = seq.split('').reverse().join('');
          if (/^(\d)\1+$/.test(national) || seq.indexOf(national) !== -1 || rseq.indexOf(national) !== -1 || (national.length >= 7 && new Set(national.split('')).size <= 2)) {
            return { ok: false, error: 'That looks like a made-up number. Please enter your real phone number.' };
          }
          if (code === '233' && !/^[235]/.test(national)) return { ok: false, error: "That doesn't look like a Ghana number. It should start with 2, 3 or 5 after +233." };
          return { ok: true, e164: '+' + code + national, display: '+' + code + ' ' + national, code, national };
        }
        function careerStartNext(){
          const stepId = careerStartStepIds[careerStartStepIndex];
          const d = careerStartDraft;
          careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', age: '', gender: '', fullName: '', email: '', phone: '', resume: '' };

          if (stepId === 'interests' && !d.interests.length) careerStartErrors.interests = 'Please select at least one option.';
          if (stepId === 'keyword' && !d.jobTitle.trim()) careerStartErrors.jobTitle = 'Please enter a keyword.';
          if (stepId === 'experience' && !d.experienceLevel) careerStartErrors.experienceLevel = 'Please select an experience level.';
          if (stepId === 'education' && !d.education) careerStartErrors.education = 'Please select your education level.';
          if (stepId === 'workStyle' && !d.workStyle) careerStartErrors.workStyle = 'Please select a work style.';

          if (stepId === 'age') {
            const ageNum = Number(String(d.age).trim());
            if (!String(d.age).trim()) careerStartErrors.age = 'Please enter your age.';
            else if (!Number.isInteger(ageNum) || ageNum < 13 || ageNum > 100) careerStartErrors.age = 'Enter a valid age between 13 and 100.';
          }
          if (stepId === 'gender' && !d.gender) careerStartErrors.gender = 'Please select an option.';
          if (stepId === 'resume') {
            const phoneCheck = normalizeIntlPhone(d.phone);
            if (!phoneCheck.ok) careerStartErrors.phone = phoneCheck.error;
            else d.phone = phoneCheck.display;
            // Asked here once, so Stitch Bot and the application forms never ask again
            if (!String(d.city || '').trim()) careerStartErrors.city = 'Please add your city.';
            if (!String(d.country || '').trim()) careerStartErrors.country = 'Please add your country.';
            // A resume/CV is mandatory: Stitch Bot can't match or apply without one.
            if (!d.resumeFile && !d.resumeFileName) careerStartErrors.resume = 'Please attach your resume/CV to continue.';
            else if (careerStartResumeUploading) careerStartErrors.resume = 'Hold on, your resume is still being read.';
          }

          const hasErrors = Object.values(careerStartErrors).some(Boolean);
          if (hasErrors) { rerenderCareerStart(); return; }

          if (stepId === 'resume') { submitCareerStartForm(); return; }

          careerStartStepIndex = Math.min(careerStartStepIndex + 1, careerStartStepIds.length - 1);
          rerenderCareerStart();
        }
        function careerStartStep(delta){
          careerStartStepIndex = Math.max(0, Math.min(careerStartStepIndex + delta, careerStartStepIds.length - 1));
          careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', age: '', gender: '', fullName: '', email: '', phone: '', resume: '' };
          rerenderCareerStart();
        }
        async function submitCareerStartForm(){
          const d = careerStartDraft;
          const interestLabels = careerInterestOptions.filter(o => d.interests.includes(o.id)).map(o => o.label).join(', ');
          const levelLabel = (careerExperienceLevels.find(l => l.id === d.experienceLevel) || {}).label || d.experienceLevel;
          const educationLabel = (careerEducationLevels.find(l => l.id === d.education) || {}).label || d.education;
          const workStyleLabel = (careerWorkStyles.find(w => w.id === d.workStyle) || {}).label || d.workStyle;
          const submitBtn = document.getElementById('career-start-submit-btn');
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

          try {
            const fd = new FormData();
            fd.append('_subject', 'Stitch - Career Space: ' + d.fullName);
            fd.append('form', "Don't know where to start?");
            fd.append('fullName', d.fullName);
            fd.append('email', d.email);
            if (d.phone.trim()) fd.append('phone', d.phone.trim());
            fd.append('city', String(d.city || '').trim());
            fd.append('country', String(d.country || '').trim());
            fd.append('contactMethod', d.contactMethod === 'inApp' ? 'In-app notification' : 'Email');
            fd.append('interestedIn', interestLabels);
            fd.append('jobTitle', d.jobTitle);
            fd.append('experienceLevel', levelLabel);
            fd.append('education', educationLabel);
            fd.append('workStyle', workStyleLabel);
            fd.append('age', String(d.age || ''));
            fd.append('gender', (careerGenders.find(g => g.id === d.gender) || {}).label || d.gender || '');
            fd.append('_replyto', d.email);
            if (d.resumeFile) fd.append('resume', d.resumeFile, d.resumeFileName);
            const res = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd });
            if (!res.ok) throw new Error('Formspree request failed: ' + res.status);
          } catch (err) {
            console.warn('Career start form did not notify Formspree (non-fatal, Career Profile is saved regardless):', err);
            window.reportError(err, { form: 'career-start', jobTitle: d.jobTitle });
          } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
          }

          const existing = careerStartProfile || {};
          careerStartProfile = {
            fullName: d.fullName.trim(),
            email: d.email.trim(),
            phone: d.phone.trim(),
            contactMethod: d.contactMethod || 'email',
            interests: [...d.interests],
            jobTitle: d.jobTitle.trim(),
            experienceLevel: d.experienceLevel,
            education: d.education,
            workStyle: d.workStyle,
            age: String(d.age || '').trim(),
            gender: d.gender || '',
            resumeFileName: d.resumeFileName || existing.resumeFileName || '',
            resumeText: d.resumeText || existing.resumeText || '',
            resumeDataUrl: d.resumeDataUrl || existing.resumeDataUrl || '',
            matches: existing.matches || [],
            matchesUpdatedAt: existing.matchesUpdatedAt || null,
            priorityId: existing.priorityId || '',
            priorityReason: existing.priorityReason || '',
            subscription: existing.subscription || null,
            botDocs: existing.botDocs || {},
            city: String(d.city || '').trim(),
            country: String(d.country || '').trim(),
            botContact: Object.assign({ phone: '', location: '' }, existing.botContact || {}, { phone: d.phone.trim(), location: careerJoinLocation(d.city, d.country) || (existing.botContact && existing.botContact.location) || '' }),
            botLog: existing.botLog || [],
            botSeen: existing.botSeen || {},
            botApplied: existing.botApplied || {},
            botCheckedAt: existing.botCheckedAt || null,
            updatedAt: Date.now(),
          };
          saveCareerStartProfile();
          careerRememberLocation(careerStartProfile.botContact.location);

          if (careerStartProfile.resumeFileName) markCareerStartPillDismissed();
          if (!careerSubscriptionActive()) {
            // CV is in -- last stop is the plan page; matching starts once the plan is paid.
            clearCareerStartResumeUploadTimers();
            careerStartResumeUploading = false;
            careerStartStepIndex = careerStartStepIds.indexOf('plan');
            rerenderCareerStart();
            return;
          }
          resetCareerStartDraft();
          runCareerMatchingAnimation();
        }

        const careerMatchingPhases = ['Reading your CV/resume…', 'Comparing you to posted opportunities…', 'Scoring your fit for each one…', 'Ranking your best matches…', 'Finding what to prioritize…'];
        let careerMatchingPhaseIndex = 0;
        let careerMatchingTimers = [];
        // ---- Career matching animation + results ----
        function clearCareerMatchingTimers(){
          careerMatchingTimers.forEach(t => clearTimeout(t));
          careerMatchingTimers = [];
        }
        function rerenderCareerMatchingAnim(){
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'careerMatching') ov.innerHTML = careerMatchingHTML();
        }
        async function runCareerMatchingAnimation(){
          openOverlay('careerMatching');
          clearCareerMatchingTimers();
          careerMatchingPhaseIndex = 0;
          const stepMs = 1000;
          careerMatchingPhases.forEach((_, i) => {
            if (i === 0) return;
            careerMatchingTimers.push(setTimeout(() => {
              careerMatchingPhaseIndex = i;
              rerenderCareerMatchingAnim();
            }, i * stepMs));
          });
          const minWait = new Promise(resolve => setTimeout(resolve, careerMatchingPhases.length * stepMs));
          await Promise.all([refreshCareerMatches(), minWait]);
          clearCareerMatchingTimers();
          if (currentOverlayKind === 'careerMatching') openCareerMatchesPage(false);
        }
        function careerMatchingHTML(){
          const phase = careerMatchingPhases[careerMatchingPhaseIndex];
          return `
            <div class="flex-1 flex flex-col items-center justify-center px-8 text-center">
              <div style="position:relative;width:76px;height:76px;" class="mb-6">
                <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(10,37,64,0.12) 45%, rgba(10,37,64,0.12) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));mask:radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));animation:classroom-spin 0.9s linear infinite;"></div>
                <div class="absolute flex items-center justify-center" style="inset:8px;border-radius:9999px;background:rgba(10,37,64,0.06);color:${NAVY};">${Icon('bot','w-7 h-7')}</div>
              </div>
              <div class="text-xl font-bold text-gray-900 mb-2 font-display">Matching your CV/Resume</div>
              <div class="text-sm text-gray-500 cv-upload-phase" style="min-height:1.25em;">${phase}</div>
            </div>`;
        }

        // ---- Intro pages + subscription plans for "Match with CV/Resume" ----
        const CAREER_PLANS = {
          daily:   { id: 'daily',   label: 'Daily',   price: 20,  unit: 'day',   months: 0, days: 1 },
          weekly:  { id: 'weekly',  label: 'Weekly',  price: 90,  unit: 'week',  months: 0, days: 7 },
          monthly: { id: 'monthly', label: 'Monthly', price: 300, unit: 'month', months: 1, days: 0 },
        };
        let careerPlanChoice = '';
        let careerPlanPillAnim = false;
        let careerPlanBusy = false;
        function careerSubscriptionActive(){
          const sub = careerStartProfile && careerStartProfile.subscription;
          return !!(sub && sub.expiresAt && Date.now() < sub.expiresAt);
        }
        function careerPlanDateLabel(ms){
          try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
        }
        function setCareerPlan(id){
          if (!CAREER_PLANS[id]) return;
          if (careerPlanBusy) return;
          careerPlanPillAnim = false;
          careerPlanChoice = id;
          rerenderCareerStart();
          openCareerSubscribeSheet();   // the panel pulls up right away; no separate Subscribe pill
        }
        function careerIntroBulletsHTML(items){
          return `<div class="flex flex-col gap-3" style="margin-top:22px;">${items.map(t => `
            <div class="flex items-start gap-3">
              <span class="flex-shrink-0 flex items-center justify-center" style="width:24px;height:24px;border-radius:9999px;background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('check','w-3.5 h-3.5')}</span>
              <div class="text-sm text-gray-700" style="padding-top:2px;">${t}</div>
            </div>`).join('')}</div>`;
        }
        function careerIntroTrendHTML(isFirst){
          const W = 200, H = 76;
          const stages = ['Applied', 'Review', 'Interview', 'Offer'];
          const pts = isFirst
            ? [[6,62],[40,52],[72,56],[104,36],[136,40],[168,18],[194,10]]
            : stages.map((_, i) => [14 + i * 57, 40 - i * 6]);
          const line = pts.map(p => p.join(',')).join(' ');
          const last = pts[pts.length - 1];
          const grad = `<linearGradient id="cit-g" x1="0" x2="1"><stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${ROYAL}"/></linearGradient>`;
          return `
            <style>@keyframes citDraw{to{stroke-dashoffset:0}}@keyframes citPop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}@keyframes citPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(3.2);opacity:0}}@keyframes citDash{to{stroke-dashoffset:-16}}</style>
            <svg viewBox="0 0 ${W} ${isFirst ? H : H + 16}" width="100%" aria-hidden="true" style="overflow:visible;display:block;">
              <defs>${grad}</defs>
              <line x1="0" y1="${H - 4}" x2="${W}" y2="${H - 4}" stroke="rgba(128,128,128,0.3)" stroke-width="1.5" stroke-dasharray="4 4" style="animation:citDash 1.2s linear infinite;"/>
              <polyline points="${line}" fill="none" stroke="url(#cit-g)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="100" style="stroke-dasharray:100;stroke-dashoffset:100;animation:citDraw 1.8s ease-out .2s forwards;"/>
              ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5.5 : 4}" fill="${i === pts.length - 1 ? ROYAL : '#fff'}" stroke="${ROYAL}" stroke-width="2.5" style="opacity:0;transform-box:fill-box;transform-origin:center;animation:citPop .35s ease-out ${(0.3 + i * (1.6 / pts.length)).toFixed(2)}s forwards;"/>`).join('')}
              <circle cx="${last[0]}" cy="${last[1]}" r="5.5" fill="none" stroke="${ROYAL}" stroke-width="2" style="transform-box:fill-box;transform-origin:center;animation:citPulse 1.8s ease-out 2.2s infinite;"/>
              ${isFirst ? '' : pts.map((p, i) => `<text x="${p[0]}" y="${H + 10}" text-anchor="middle" font-size="9" fill="#9ca3af">${stages[i]}</text>`).join('')}
            </svg>`;
        }
        function careerStartIntroHTML(stepId){
          const isFirst = stepId === 'intro1';
          const iconSvg = isFirst ? `<svg width="84" height="84" viewBox="130 110 240 280" fill="${ROYAL}" aria-hidden="true">
              <defs>
                <mask id="intro-docs-back" maskUnits="userSpaceOnUse" x="100" y="80" width="300" height="340"><rect x="100" y="80" width="300" height="340" fill="#fff"/><rect x="188" y="122" width="167" height="228" rx="26" fill="#000" stroke="#000" stroke-width="30"/></mask>
                <mask id="intro-docs-front" maskUnits="userSpaceOnUse" x="100" y="80" width="300" height="340"><rect x="100" y="80" width="300" height="340" fill="#fff"/><rect x="266" y="90" width="110" height="118" fill="#000"/><g stroke="#000" stroke-width="16" stroke-linecap="round"><path d="M230 197H250"/><path d="M230 243H310"/><path d="M230 285H310"/></g></mask>
              </defs>
              <rect x="147" y="158" width="171" height="222" rx="28" mask="url(#intro-docs-back)"/>
              <rect x="188" y="122" width="167" height="228" rx="26" mask="url(#intro-docs-front)"/>
              <path d="M286 130L348 192H304Q286 192 286 174Z" stroke="${ROYAL}" stroke-width="8" stroke-linejoin="round"/>
            </svg>` : `<svg width="84" height="84" viewBox="205 165 330 405" fill="${ROYAL}" aria-hidden="true">
              <defs>
                <mask id="intro-clip-board" maskUnits="userSpaceOnUse" x="180" y="150" width="380" height="440"><rect x="180" y="150" width="380" height="440" fill="#fff"/><rect x="252" y="190" width="236" height="112" rx="42" fill="#000"/><g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round"><path d="M278 358L298 380L344 336" stroke-width="18"/><path d="M372 367H458M345 430H458M345 493H458" stroke-width="26"/></g><circle cx="305" cy="431" r="13" fill="#000"/><circle cx="305" cy="493" r="13" fill="#000"/></mask>
                <mask id="intro-clip-top" maskUnits="userSpaceOnUse" x="180" y="150" width="380" height="440"><rect x="180" y="150" width="380" height="440" fill="#fff"/><circle cx="369" cy="229" r="13" fill="#000"/></mask>
              </defs>
              <rect x="218" y="242" width="302" height="314" rx="46" mask="url(#intro-clip-board)"/>
              <g mask="url(#intro-clip-top)"><rect x="268" y="203" width="200" height="78" rx="24"/><path d="M322 206Q330 180 369 180Q408 180 416 206Z"/></g>
            </svg>`;
          const title = isFirst ? 'Stitch Bot finds your matches' : 'Stitch Bot can apply for you';
          const sub = isFirst
            ? "Share your CV and what you're looking for. Stitch Bot reads them and matches you to the opportunities that fit you best."
            : "Once you're matched, Stitch Bot can send your applications for you. It only works on opportunities inside the Stitch ecosystem. It's a homebody and will not wander off to other websites.";
          const bullets = isFirst
            ? ['Reads your CV and your preferences', 'Scores every posted opportunity for your fit', 'Tells you which ones to prioritize']
            : ['Applies to your matches on your behalf', 'Stays in the Stitch ecosystem (a total homebody)', 'You can cancel your subscription any time'];
          return `
            <div class="flex-1 overflow-y-auto">
            ${overlayHeader('Match with CV/Resume', '20px', 'careerStartBack()', null, {right:true, titleSize:'text-xl', titleClass:'career-flow-title', pb:'0px'})}
            <div class="px-5" style="padding-top:44px;padding-bottom:20px;">
              <div class="max-w-2xl mx-auto">
                <div class="flex items-center" style="gap:18px;margin-bottom:26px;">
                  <div class="flex-shrink-0 flex items-center justify-center" style="width:84px;height:84px;">${iconSvg}</div>
                  <div class="flex-1 min-w-0">${careerIntroTrendHTML(isFirst)}</div>
                </div>
                <h2 class="text-2xl font-bold font-display grad-text" style="margin-bottom:8px;">${title}</h2>
                <div class="text-sm text-gray-500">${sub}</div>
                ${careerIntroBulletsHTML(bullets)}
              </div>
            </div>
            </div>
            <div class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(22px, env(safe-area-inset-bottom));">
              <div class="max-w-2xl mx-auto">
                <div class="flex items-center justify-center gap-2" style="margin-bottom:14px;">
                  ${['intro1','intro2'].map(id => `<span style="height:6px;width:${id === stepId ? 22 : 6}px;border-radius:9999px;background:${id === stepId ? NAVY : 'rgba(128,128,128,0.35)'};transition:width .2s ease;"></span>`).join('')}
                </div>
                <button id="career-start-submit-btn" onclick="careerStartNext()" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">Continue</button>
              </div>
            </div>`;
        }
        function careerPlanCardHTML(plan){
          const selected = careerPlanChoice === plan.id;
          const best = plan.id === 'monthly';
          return `
            <button onclick="setCareerPlan('${plan.id}')" class="w-full text-left rounded-3xl p-4 relative outline-pill ${selected ? 'is-selected' : ''}" style="margin-bottom:12px;${best ? 'margin-top:20px;' : ''}">
              ${best ? `<span class="absolute font-bold uppercase" style="top:-14px;left:18px;background:#1e90ff;color:#ffffff;font-size:11px;letter-spacing:0.04em;line-height:1.2;padding:0.45rem 1rem;border-radius:9999px;box-shadow:0 2px 8px rgba(30,144,255,0.35);white-space:nowrap;">Best value</span>` : ''}
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-base font-bold font-display" style="color:var(--pill-text);">${plan.label}</div>
                  <div class="text-xs" style="margin-top:2px;color:var(--pill-text);opacity:0.6;">Billed every ${plan.unit}</div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-right"><span class="text-2xl font-bold" style="color:var(--pill-text);">GHS ${plan.price}</span><span class="text-xs" style="color:var(--pill-text);opacity:0.6;"> /${plan.unit}</span></div>
                  <span class="flex-shrink-0 flex items-center justify-center" style="width:24px;height:24px;border-radius:9999px;${selected ? `background:#1e90ff;color:#fff;` : 'border:2px solid rgba(128,128,128,0.45);'}">${selected ? Icon('check','w-3.5 h-3.5') : ''}</span>
                </div>
              </div>
            </button>`;
        }
        function careerStartPlanHTML(){
          const plan = CAREER_PLANS[careerPlanChoice] || CAREER_PLANS.monthly;
          const features = [
            'Matched to opportunities using your CV and preferences',
            'Stitch Bot applies to your matches for you (in the app only)',
            'Fresh match updates as new opportunities are posted',
            'Cancel any time',
          ];
          return `
            <div class="flex-1 overflow-y-auto">
            ${overlayHeader('Match with CV/Resume', '20px', 'careerStartBack()', null, {right:true, titleSize:'text-xl', titleClass:'career-flow-title', pb:'0px'})}
            <div class="px-5" style="padding-top:30px;padding-bottom:max(28px, env(safe-area-inset-bottom));">
              <div class="max-w-2xl mx-auto">
                <h2 class="text-2xl font-bold font-display grad-text" style="margin-bottom:6px;">Choose your plan</h2>
                <div class="text-sm text-gray-500" style="margin-bottom:22px;">Your CV is in. Pick a plan and Stitch Bot starts matching you right away.</div>
                ${careerPlanCardHTML(CAREER_PLANS.daily)}
                ${careerPlanCardHTML(CAREER_PLANS.weekly)}
                ${careerPlanCardHTML(CAREER_PLANS.monthly)}
                <div class="rounded-3xl p-4" style="background:rgba(10,37,64,0.05);margin-top:6px;">
                  ${careerIntroBulletsHTML(features).replace('margin-top:22px;', 'margin-top:0;')}
                </div>
                <div class="text-xs text-gray-400 text-center" style="margin-top:14px;">Cancel any time from your Career Profile and keep access until the end of the period you paid for.</div>
              </div>
            </div>
            </div>
            `;
        }
        // Slide-up sheet shown when "Subscribe" is tapped: spells out the plan, price, end date and
        // what Stitch Bot does, like the cancel-subscription sheet does, before payment starts.
        function careerPlanEndDate(plan){
          const prev = careerStartProfile && careerStartProfile.subscription;
          const base = (prev && prev.expiresAt && prev.expiresAt > Date.now()) ? prev.expiresAt : Date.now();
          const end = new Date(base);
          if (plan.months) end.setMonth(end.getMonth() + plan.months);
          if (plan.days) end.setDate(end.getDate() + plan.days);
          return end.getTime();
        }
        function openCareerSubscribeSheet(){
          if (careerPlanBusy || !careerStartProfile || !CAREER_PLANS[careerPlanChoice]) return;
          const plan = CAREER_PLANS[careerPlanChoice];
          const modal = document.getElementById('careerSubscribeModal');
          const box = document.getElementById('careerSubscribeModalContent');
          if (!modal || !box) { startCareerPlanPayment(); return; }
          const row = (label, value) => `<div class="flex items-center justify-between py-2.5" style="border-top:1px solid rgba(128,128,128,0.15);"><span class="text-sm text-gray-500">${label}</span><span class="text-sm font-semibold text-gray-800 text-right">${value}</span></div>`;
          box.innerHTML = `
            <div class="text-center">
              <div class="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style="background:rgba(107,114,128,0.16);color:#6b7280;">${Icon('bot','w-6 h-6')}</div>
              <div class="text-lg font-bold text-[${NAVY}] font-display mb-2">Subscribe to Stitch Bot?</div>
              <div class="text-sm text-gray-500 mb-4">Stitch Bot is your job-hunting assistant inside Stitch. This plan is what keeps it working for you until ${escapeHtml(careerPlanDateLabel(careerPlanEndDate(plan)))}.</div>
            </div>
            <div class="mb-3">
              ${row('Plan', escapeHtml(plan.label) + ' · GH₵' + plan.price + ' per ' + plan.unit)}
              ${row('You pay today', 'GH₵' + plan.price)}
              ${row('Access until', escapeHtml(careerPlanDateLabel(careerPlanEndDate(plan))))}
            </div>
            <div class="text-xs text-gray-400 mb-5">Cancel any time from your Career Profile and keep access until the end of the period you paid for.</div>
            <div class="flex gap-3">
              <button onclick="closeCareerSubscribeSheet()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Back</button>
              <button onclick="confirmCareerSubscribeSheet()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Subscribe</button>
            </div>`;
          const wasHidden = modal.classList.contains('hidden');
          modal.classList.remove('hidden');
          if (wasHidden && typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeCareerSubscribeSheet(fromPopState));
        }
        function closeCareerSubscribeSheet(fromPopState){
          const modal = document.getElementById('careerSubscribeModal');
          if (!modal || modal.classList.contains('hidden')) return;
          modal.classList.add('hidden');
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }
        function confirmCareerSubscribeSheet(){
          closeCareerSubscribeSheet();
          startCareerPlanPayment();
        }
        async function startCareerPlanPayment(){
          if (careerPlanBusy || !careerStartProfile || !CAREER_PLANS[careerPlanChoice]) return;
          const plan = CAREER_PLANS[careerPlanChoice] || CAREER_PLANS.monthly;
          // Test account: skip Paystack entirely
          if (isStitchTestAccount()) { careerPlanBusy = true; verifyCareerPlanPayment(plan, 'stitchtest_' + Date.now()); return; }
          const payEmail = String(careerStartProfile.email || (typeof currentUserEmail !== 'undefined' && currentUserEmail) || '').trim();
          if (!payEmail) { openAppAlertModal('Please add your email first.', 'Payment unavailable'); return; }
          careerPlanBusy = true;
          rerenderCareerStart();
          try {
            await loadPaystackScript();
          } catch (err) {
            careerPlanBusy = false;
            rerenderCareerStart();
            openAppAlertModal('Could not load the payment popup. Check your connection and try again.', 'Payment unavailable');
            return;
          }
          function closeCareerPlanPopup(fromPopState){
            teardownPaystackPopup(fromPopState);
            careerPlanBusy = false;
            if (currentOverlayKind === 'careerStart') rerenderCareerStart();
          }
          const reference = 'stitchsub_' + plan.id + '_' + Date.now();
          const handler = window.PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: payEmail,
            amount: plan.price * 100,
            currency: 'GHS',
            ref: reference,
            metadata: { type: 'career_subscription', plan: plan.id, full_name: careerStartProfile.fullName || '', user_id: currentUserId || '' },
            callback: function(response){
              popModalBackHandler(false);
              verifyCareerPlanPayment(plan, response.reference);
            },
            onClose: function(){ closeCareerPlanPopup(false); }
          });
          pushModalBackHandler(closeCareerPlanPopup);
          handler.openIframe();
        }
        async function verifyCareerPlanPayment(plan, reference){
          try {
            if (!isStitchTestAccount()) {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to complete payment: please log in again.');
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/paystack-verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY },
              body: JSON.stringify({ reference })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Payment verification failed (' + res.status + ')');
            if (!data.verified) throw new Error('We could not confirm this payment. If you were charged, contact support with reference ' + reference + '.');
            }
            // Renewing early extends from the current end date instead of losing the time already paid
            // for
            const prev = careerStartProfile.subscription;
            const base = (prev && prev.expiresAt && prev.expiresAt > Date.now()) ? prev.expiresAt : Date.now();
            const end = new Date(base);
            if (plan.months) end.setMonth(end.getMonth() + plan.months);
            if (plan.days) end.setDate(end.getDate() + plan.days);
            careerStartProfile.subscription = { plan: plan.id, amount: plan.price, currency: 'GHS', reference, startedAt: Date.now(), expiresAt: end.getTime(), cancelled: false };
            careerStartProfile.updatedAt = Date.now();
            saveCareerStartProfile();
            careerPlanBusy = false;
            resetCareerStartDraft();
            runCareerMatchingAnimation();
          } catch (err) {
            careerPlanBusy = false;
            if (currentOverlayKind === 'careerStart') rerenderCareerStart();
            window.reportError && window.reportError(err, { call: 'verifyCareerPlanPayment', plan: plan.id });
            openAppAlertModal(err.message || 'Payment verification failed. Please try again.', 'Payment not confirmed');
          }
        }
        // ---- Renewal prompts: "Subscribe" pill after cancelling + expiry reminders ----
        function careerSubscriptionRemindWindowMs(sub){
          const plan = CAREER_PLANS[sub && sub.plan] || CAREER_PLANS.monthly;
          // A daily plan only lasts 24 hours, so remind in the last 4 hours instead of 2 days out
          if (plan.days === 1) return 4 * 3600000;
          return (plan.days ? 2 : 3) * 86400000;
        }
        function careerSubscriptionExpiringSoon(){
          const sub = careerStartProfile && careerStartProfile.subscription;
          if (!sub || !sub.expiresAt || !careerSubscriptionActive()) return false;
          return (sub.expiresAt - Date.now()) <= careerSubscriptionRemindWindowMs(sub);
        }
        // The pill pinned to the very bottom of the matches page
        function careerSubscribePillHTML(){
          const sub = careerStartProfile && careerStartProfile.subscription;
          if (!sub) return '';
          const active = careerSubscriptionActive();
          const showSubscribe = !!sub.cancelled || !active;
          const showRenew = !showSubscribe && careerSubscriptionExpiringSoon();
          if (!showSubscribe && !showRenew) return '';
          const label = showSubscribe ? 'Subscribe' : 'Renew subscription';
          const note = showSubscribe
            ? (active ? `Cancelled · access until ${careerPlanDateLabel(sub.expiresAt)}` : 'Your Stitch Bot subscription has ended')
            : `Ends ${careerPlanDateLabel(sub.expiresAt)}`;
          return `
            <div id="career-subscribe-pill-wrap" class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(18px, env(safe-area-inset-bottom));background:linear-gradient(to top, rgba(255,255,255,0.96) 70%, rgba(255,255,255,0));">
              <div class="max-w-2xl mx-auto">
                <div class="text-xs text-gray-400 text-center" style="margin-bottom:6px;">${escapeHtml(note)}</div>
                <button id="career-subscribe-pill" onclick="careerSubscribeAgain()" class="pill-cta font-display w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${label}</button>
              </div>
            </div>`;
        }
        function careerSubscribeAgain(){
          if (!careerStartProfile) return;
          openCareerStartPlan(true);
        }
        // Sends the reminder in-app (always) and by email too when that is how the user asked to
        // be contacted
        function careerSendRenewalNotice(sub, stage, message){
          const p = careerStartProfile;
          try {
            if (typeof addNotif === 'function') {
              addNotif({ id: `career-sub-${stage}-${sub.expiresAt}`, type: 'info', icon: 'bot', iconBg: 'bg-blue-50', iconClass: 'text-blue-600', name: 'Stitch Bot', message, route: 'careerMatches' });
            }
          } catch (e) {}
          if (p && p.contactMethod === 'email' && typeof sendEmailNotification === 'function') {
            sendEmailNotification({ subject: 'Your Stitch Bot subscription', title: 'Renew your Stitch Bot subscription', body: message });
          }
        }
        function careerCheckSubscriptionExpiry(){
          try {
            const p = careerStartProfile;
            const sub = p && p.subscription;
            if (!sub || !sub.expiresAt) return;
            if (!sub.reminders) sub.reminders = {};
            const r = sub.reminders;
            const left = sub.expiresAt - Date.now();
            const dateLabel = careerPlanDateLabel(sub.expiresAt);
            const cancelled = !!sub.cancelled;
            let stage = '', message = '';
            if (left <= 0) {
              if (!r.expired) { stage = 'expired'; message = 'Your Stitch Bot subscription has ended, so matching and auto-applying have stopped. Renew now to pick up where you left off.'; }
            } else if (left <= 86400000) {
              if (!r.last) {
                stage = 'last';
                message = cancelled
                  ? `Your Stitch Bot access ends within 24 hours (${dateLabel}). Subscribe again to keep getting matches and auto-applications.`
                  : `Your Stitch Bot subscription ends within 24 hours (${dateLabel}). Renew now so matching and auto-applying don't stop.`;
              }
            } else if (left <= careerSubscriptionRemindWindowMs(sub)) {
              if (!r.soon) {
                const days = Math.ceil(left / 86400000);
                stage = 'soon';
                message = cancelled
                  ? `Your Stitch Bot access ends in ${days} days (${dateLabel}). Subscribe again to keep your matches and auto-applications going.`
                  : `Your Stitch Bot subscription ends in ${days} days (${dateLabel}). Renew now so you don't lose your matches and auto-applications.`;
              }
            }
            if (!stage) return;
            // Mark this stage (and any earlier ones) as sent so the user is never notified twice.
            r.soon = true;
            if (stage === 'last' || stage === 'expired') r.last = true;
            if (stage === 'expired') r.expired = true;
            careerSendRenewalNotice(sub, stage, message);
            saveCareerStartProfile();
            if (currentOverlayKind === 'careerMatches' && typeof rerenderCareerMatches === 'function') rerenderCareerMatches();
          } catch (e) { console.warn('Subscription expiry check failed:', e); }
        }
        // Runs shortly after the app opens (once the profile has loaded), then every few minutes
        // while the app is open and whenever it comes back to the foreground
        setTimeout(careerCheckSubscriptionExpiry, 6000);
        setInterval(function(){ if (!document.hidden) careerCheckSubscriptionExpiry(); }, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', function(){ if (!document.hidden) careerCheckSubscriptionExpiry(); });
        function cancelCareerSubscription(){
          const sub = careerStartProfile && careerStartProfile.subscription;
          if (!sub || sub.cancelled) return;
          openAppConfirmModal('Cancel subscription?', `Stitch Bot will stop matching and applying for you after ${careerPlanDateLabel(sub.expiresAt)}. You keep full access until then.`, 'Cancel', function(){
            sub.cancelled = true;
            sub.cancelledAt = Date.now();
            careerStartProfile.updatedAt = Date.now();
            saveCareerStartProfile();
            openCareerCancelReason();
          }, undefined, 'Back');
        }

        // ---- Match with CV: top-right menu (Auto apply / Manage subscription / Saved) ----
        function careerMatchesHeaderHTML(){
          return `
            <div class="relative flex-shrink-0 w-full">
              ${overlayHeader('Match with CV', '20px', 'closeOverlay()', null, { center: true })}
              <button onclick="openCareerCvMenu()" aria-label="Menu" class="absolute flex items-center justify-end" style="right:20px;top:20px;height:28px;width:32px;">${gradIcon(Icon('dashesShortRight','w-6 h-6'))}</button>
            </div>`;
        }
        function careerCvMenuInnerHTML(){
          return `
            <div style="width:48px;height:5px;border-radius:3px;background:#1f2937;margin:2px auto 10px;"></div>
            ${careerMenuRowHTML("closeCareerMenuThen(() => openCareerAutoApply())", 'bot', 'Auto apply')}
            ${careerMenuRowHTML("closeCareerMenuThen(() => openCareerSubscriptionPage())", 'coin', 'Manage subscription')}
            ${careerMenuRowHTML("closeCareerMenuThen(() => openCareerSavedPage())", 'bookmarkOutline', 'Saved')}`;
        }
        function openCareerCvMenu(){
          openCareerMenuDropdownDom();
          const dd = document.getElementById('career-menu-dropdown');
          if (dd) dd.innerHTML = careerCvMenuInnerHTML();
        }
        function openCareerAutoApply(){ careerBotCheckUpdates(); openOverlayFrom('careerMatches', 'careerAutoApply'); }
        function openCareerSubscriptionPage(){ openOverlayFrom('careerMatches', 'careerSubscription'); }
        function openCareerSavedPage(){ openOverlayFrom('careerMatches', 'careerSaved'); }

        // =====================================================================================
        // Auto apply: dashboard, Documents, Notifications, Preferences, cancel-reason pages
        // =====================================================================================
        const CAREER_BOT_PREF_DEFAULTS = { mode: 'review', letter: 'always', extras: 'all', coverNote: 'fresh', tone: 'professional', minScore: 60, dailyLimit: 10, notes: '' };
        function careerBotPrefs(){
          const p = careerBotEnsure(); if (!p) return Object.assign({}, CAREER_BOT_PREF_DEFAULTS);
          p.botPrefs = Object.assign({}, CAREER_BOT_PREF_DEFAULTS, p.botPrefs || {});
          return p.botPrefs;
        }
        function setCareerBotPref(key, value){
          const p = careerBotEnsure(); if (!p) return;
          careerBotPrefs(); p.botPrefs[key] = value;
          p.updatedAt = Date.now(); saveCareerStartProfile();
          rerenderCareerMatches(true);
        }
        function setCareerBotPrefNotes(value){
          const p = careerBotEnsure(); if (!p) return;
          careerBotPrefs(); p.botPrefs.notes = String(value || '').slice(0, 600);
          saveCareerStartProfile();
        }
        const CAREER_BOT_NOTIF_DEFAULTS = { applications: true, matches: true, approvals: true, subscription: true };
        function careerBotNotifPrefs(){
          const p = careerBotEnsure(); if (!p) return Object.assign({}, CAREER_BOT_NOTIF_DEFAULTS);
          p.botNotif = Object.assign({}, CAREER_BOT_NOTIF_DEFAULTS, p.botNotif || {});
          return p.botNotif;
        }
        function toggleCareerBotNotif(key){
          const p = careerBotEnsure(); if (!p) return;
          const n = careerBotNotifPrefs(); n[key] = !n[key];
          saveCareerStartProfile(); rerenderCareerMatches(true);
        }
        function careerHasBotDocs(){
          const p = careerBotEnsure(); if (!p) return false;
          return CAREER_BOT_DOC_SLOTS.some(s => careerBotDocList(s.id).length > 0);
        }
        function careerSwitchHTML(on, onclick){
          return `<button onclick="${onclick}" role="switch" aria-checked="${on}" class="flex-shrink-0 relative" style="width:48px;height:28px;border-radius:9999px;border:none;background:${on ? `linear-gradient(135deg, ${NAVY}, ${ROYAL})` : 'rgba(128,128,128,0.35)'};transition:background .2s;"><span style="position:absolute;top:3px;left:${on ? '23px' : '3px'};width:22px;height:22px;border-radius:9999px;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span></button>`;
        }
        function careerAutoApplyHeaderHTML(){
          return `
            <div class="relative flex-shrink-0 w-full">
              ${overlayHeader('Auto apply', '20px', 'overlayGoBack()', null, { center: true })}
              <button onclick="openCareerAutoMenu()" aria-label="Menu" class="absolute flex items-center justify-end" style="right:20px;top:20px;height:28px;width:32px;">${gradIcon(Icon('dashesShortRight','w-6 h-6'))}</button>
            </div>`;
        }
        function careerSubPageHeaderHTML(title){
          return overlayHeader(title, '20px', 'careerBackToAutoApply()', null, { right: true });
        }
        function careerBackToAutoApply(){ openOverlayFrom('careerMatches', 'careerAutoApply'); }
        function careerAutoMenuInnerHTML(){
          return `
            <div style="width:48px;height:5px;border-radius:3px;background:#1f2937;margin:2px auto 10px;"></div>
            ${careerMenuRowHTML("closeCareerMenuThen(() => openCareerDocumentsPage())", 'doc', 'Documents')}
            ${careerMenuRowHTML("closeCareerMenuThen(() => openCareerNotificationsPage())", 'bell', 'Notifications')}
            ${careerMenuRowHTML("closeCareerMenuThen(() => openCareerPreferencesPage())", 'settings', 'Preferences')}`;
        }
        function openCareerAutoMenu(){
          openCareerMenuDropdownDom();
          const dd = document.getElementById('career-menu-dropdown');
          if (dd) dd.innerHTML = careerAutoMenuInnerHTML();
        }
        function openCareerDocumentsPage(){ openOverlayFrom('careerAutoApply', 'careerDocuments'); }
        function openCareerNotificationsPage(){ openOverlayFrom('careerAutoApply', 'careerNotifications'); }
        function openCareerPreferencesPage(){ openOverlayFrom('careerAutoApply', 'careerPreferences'); }

        // ---- View / download any stored file (CV or an Auto apply document) ----
        function careerMimeFor(name){
          const e = String(name || '').split('.').pop().toLowerCase();
          return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })[e] || 'application/octet-stream';
        }
        async function careerResolveFile(src){
          const p = careerBotEnsure(); if (!p) return null;
          if (src.kind === 'resume') {
            const u = p.resumeDataUrl; if (!u) return null;
            let href = u;
            try {
              const sb = getSupabaseClient();
              const m = String(u).match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/resume-files\/([^?#]+)/);
              if (sb && m) {
                const { data, error } = await sb.storage.from('resume-files').createSignedUrl(decodeURIComponent(m[1]), 600);
                if (!error && data && data.signedUrl) href = data.signedUrl;
              }
            } catch (e) {}
            return { href, name: p.resumeFileName || 'resume' };
          }
          const d = careerBotDocList(src.docId)[src.idx || 0]; if (!d) return null;
          let href = d.dataUrl || d.url; if (!href) return null;
          try { if (d.url && typeof getApplicationDocumentSignedUrl === 'function') { const s = await getApplicationDocumentSignedUrl(d.url); if (s) href = s; } } catch (e) {}
          return { href, name: d.fileName || 'document' };
        }
        async function careerFileBlob(href, name){
          const r = await fetch(href);
          const b = await r.blob();
          const type = (b.type && b.type !== 'application/octet-stream') ? b.type : careerMimeFor(name);
          return new Blob([b], { type });
        }
        async function careerViewFile(src){
          const w = window.open('', '_blank');
          try {
            const f = await careerResolveFile(src);
            if (!f) { if (w) w.close(); return; }
            const ext = String(f.name).split('.').pop().toLowerCase();
            if (ext === 'doc' || ext === 'docx') {
              if (/^https?:/i.test(f.href)) {
                const u = 'https://docs.google.com/viewer?url=' + encodeURIComponent(f.href);
                if (w) w.location.href = u; else window.location.href = u;
                return;
              }
              if (w) w.close();
              openAppAlertModal("Word files can't be previewed here, so it is downloading instead.", 'Downloading');
              careerDownloadFile(src);
              return;
            }
            const blob = await careerFileBlob(f.href, f.name);
            const u = URL.createObjectURL(blob);
            if (w) w.location.href = u; else window.location.href = u;
            setTimeout(() => URL.revokeObjectURL(u), 180000);
          } catch (e) {
            if (w) w.close();
            openAppAlertModal("We couldn't open that file. Check your connection and try again.");
          }
        }
        async function careerDownloadFile(src){
          try {
            const f = await careerResolveFile(src); if (!f) return;
            const blob = await careerFileBlob(f.href, f.name);
            const u = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = u; a.download = f.name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(u), 60000);
          } catch (e) {
            try { const f = await careerResolveFile(src); if (f) window.open(f.href, '_blank'); }
            catch (e2) { openAppAlertModal("We couldn't download that file. Check your connection and try again."); }
          }
        }
        function careerViewResume(){ careerViewFile({ kind: 'resume' }); }
        function careerDownloadResume(){ careerDownloadFile({ kind: 'resume' }); }
        function careerViewDoc(docId, idx){ careerViewFile({ kind: 'doc', docId, idx }); }
        function careerDownloadDoc(docId, idx){ careerDownloadFile({ kind: 'doc', docId, idx }); }

        // ---- Edit a document: rename, replace the file, or edit the text of a plain-text letter ----
        function closeCareerDocSheet(){ const w = document.getElementById('career-doc-sheet-wrap'); if (w) w.remove(); }
        function careerDocEdit(docId, idx){
          const d = careerBotDocList(docId)[idx]; if (!d) return;
          closeCareerDocSheet();
          const slot = CAREER_BOT_DOC_SLOTS.find(s => s.id === docId) || {};
          const canText = /\.txt$/i.test(d.fileName || '') && typeof d.text === 'string' && d.text.length > 0 && d.text.length < 6000;
          const wrap = document.createElement('div');
          wrap.id = 'career-doc-sheet-wrap';
          wrap.innerHTML = `
            <div onclick="closeCareerDocSheet()" style="position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.5);"></div>
            <div class="bg-white" style="position:fixed;left:0;right:0;bottom:0;z-index:11001;border-radius:24px 24px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:shareSheetSlideUp .22s cubic-bezier(0.16,1,0.3,1);max-width:640px;margin:0 auto;max-height:86vh;overflow-y:auto;">
              <div style="width:48px;height:5px;border-radius:3px;background:#1f2937;margin:2px auto 14px;"></div>
              <div class="text-base font-bold font-display grad-text">Edit document</div>
              <div class="text-xs text-gray-400" style="margin-bottom:14px;">${escapeHtml(slot.label || 'Document')}</div>
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400" style="margin-bottom:6px;">File name</div>
              <div class="flex gap-2" style="margin-bottom:16px;">
                <input id="career-doc-rename" type="text" value="${escapeHtml(d.fileName || '')}" class="flex-1 min-w-0 bg-gray-100 flow-outline text-sm rounded-2xl px-3 py-2.5" style="outline:none;">
                <button onclick="careerDocRename('${docId}',${idx})" class="text-sm font-semibold px-4 rounded-2xl text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">Save</button>
              </div>
              ${canText ? `
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400" style="margin-bottom:6px;">Text</div>
              <textarea id="career-doc-text" rows="8" class="w-full bg-gray-100 flow-outline text-sm rounded-2xl px-3 py-2.5" style="outline:none;resize:vertical;">${escapeHtml(d.text)}</textarea>
              <button onclick="careerDocSaveText('${docId}',${idx})" class="w-full text-sm font-semibold py-2.5 rounded-2xl text-white" style="margin:8px 0 16px;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">Save text</button>` : ''}
              <input type="file" id="career-doc-replace" class="hidden" accept="${docId === 'idDocument' ? '.pdf,.jpg,.jpeg,.png' : '.pdf,.doc,.docx'}" onchange="careerDocReplace('${docId}',${idx},event)">
              <button onclick="document.getElementById('career-doc-replace').click()" class="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-2xl" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px dashed ${ROYAL};">${Icon('upload','w-4 h-4')} Replace with a new file</button>
              <button onclick="closeCareerDocSheet()" class="w-full text-sm font-semibold py-3 text-gray-500" style="margin-top:6px;">Close</button>
            </div>`;
          document.body.appendChild(wrap);
        }
        function careerDocRename(docId, idx){
          const d = careerBotDocList(docId)[idx]; const el = document.getElementById('career-doc-rename');
          if (!d || !el) return;
          let name = String(el.value || '').replace(/[\\/:*?"<>|]/g, '').trim();
          if (!name) { openAppAlertModal('Give the file a name.'); return; }
          const oldExt = (String(d.fileName).match(/\.[A-Za-z0-9]+$/) || [''])[0];
          if (oldExt && !/\.[A-Za-z0-9]+$/.test(name)) name += oldExt;
          d.fileName = name.slice(0, 120);
          saveCareerStartProfile(); closeCareerDocSheet(); rerenderCareerMatches(true);
        }
        async function careerDocSaveText(docId, idx){
          const d = careerBotDocList(docId)[idx]; const el = document.getElementById('career-doc-text');
          if (!d || !el) return;
          const text = String(el.value || '').trim();
          if (!text) { openAppAlertModal('The text can\'t be empty.'); return; }
          closeCareerDocSheet();
          await careerBotStoreDocs(docId, [new File([text], d.fileName, { type: 'text/plain' })], text);
        }
        async function careerDocReplace(docId, idx, event){
          const input = event.target; const f = input.files && input.files[0];
          const d = careerBotDocList(docId)[idx];
          if (!f || !d) { input.value = ''; return; }
          const r = validateSelectedFile(f, docId === 'idDocument' ? 'idDoc' : 'coverLetter');
          input.value = '';
          if (!r.ok) { openAppAlertModal(r.message, 'File not accepted'); return; }
          const oldName = d.fileName;
          closeCareerDocSheet();
          await careerBotStoreDocs(docId, [f], '');
          if (f.name !== oldName) {
            const p = careerBotEnsure(); const list = careerBotDocList(docId).slice();
            const at = list.findIndex(x => x.fileName === oldName);
            if (at >= 0) { list.splice(at, 1); p.botDocs[docId] = list; saveCareerStartProfile(); rerenderCareerMatches(true); }
          }
        }

        // ---- Charts ----
        function careerDonutSVG(segs, big, small){
          const total = segs.reduce((s, x) => s + x.n, 0); const C = 2 * Math.PI * 40; let off = 0;
          const arcs = total ? segs.filter(x => x.n > 0).map(x => {
            const len = x.n / total * C;
            const el = `<circle cx="60" cy="60" r="40" fill="none" stroke="${x.color}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
            off += len; return el;
          }).join('') : '';
          return `<svg viewBox="0 0 120 120" width="108" height="108" role="img" aria-label="${escapeHtml(String(small))}"><circle cx="60" cy="60" r="40" fill="none" stroke="rgba(128,128,128,0.18)" stroke-width="16"/>${arcs}<text x="60" y="61" text-anchor="middle" font-size="20" font-weight="700" fill="#1f2937">${big}</text><text x="60" y="76" text-anchor="middle" font-size="9" fill="#9ca3af">${escapeHtml(String(small))}</text></svg>`;
        }
        function careerTrendSVG(vals, labels){
          const W = 300, H = 120, pl = 10, pr = 10, pt = 16, pb = 20;
          const max = Math.max(1, ...vals); const step = vals.length > 1 ? (W - pl - pr) / (vals.length - 1) : 0;
          const pts = vals.map((v, i) => [pl + i * step, pt + (H - pt - pb) * (1 - v / max)]);
          const line = pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
          const area = `M${pts[0][0].toFixed(1)},${H - pb} ` + pts.map(q => `L${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ') + ` L${pts[pts.length - 1][0].toFixed(1)},${H - pb} Z`;
          const grid = [0, 0.5, 1].map(f => `<line x1="${pl}" x2="${W - pr}" y1="${(pt + (H - pt - pb) * f).toFixed(1)}" y2="${(pt + (H - pt - pb) * f).toFixed(1)}" stroke="rgba(128,128,128,0.2)" stroke-width="1"/>`).join('');
          const dots = pts.map((q, i) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5" fill="#1e90ff" stroke="#fff" stroke-width="1.5"/>${vals[i] ? `<text x="${q[0].toFixed(1)}" y="${(q[1] - 7).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#374151">${vals[i]}</text>` : ''}`).join('');
          const xl = pts.map((q, i) => `<text x="${q[0].toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="8.5" fill="#9ca3af">${escapeHtml(labels[i])}</text>`).join('');
          return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Applications sent per week">${grid}<path d="${area}" fill="rgba(30,144,255,0.14)"/><polyline points="${line}" fill="none" stroke="#1e90ff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${xl}</svg>`;
        }
        function careerBarRowHTML(label, v, max, color, valueText){
          return `
            <div style="margin-bottom:10px;">
              <div class="flex items-center justify-between text-xs" style="margin-bottom:4px;"><span class="text-gray-600">${label}</span><span class="font-bold text-gray-800">${valueText != null ? valueText : v}</span></div>
              <div style="height:9px;border-radius:9999px;background:rgba(128,128,128,0.18);overflow:hidden;"><div style="height:100%;width:${max ? Math.round(v / max * 100) : 0}%;min-width:${v ? 6 : 0}px;border-radius:9999px;background:${color};transition:width .4s ease;"></div></div>
            </div>`;
        }
        function careerLegendHTML(segs){
          return segs.map(s => `<div class="flex items-center gap-2 text-xs" style="margin:3px 0;"><span style="width:9px;height:9px;border-radius:9999px;background:${s.color};flex-shrink:0;"></span><span class="text-gray-600 flex-1 min-w-0 truncate">${s.label}</span><span class="font-bold text-gray-800">${s.n}</span></div>`).join('');
        }

        // ---- Shared chart helpers: used by the admin dashboard and the wallet ----
        const CHART_COLORS = ['#1e90ff', '#4f46e5', '#059669', '#f59e0b', '#ef4444', '#94a3b8', '#a5b4fc', '#0ea5e9'];
        function chartCardHTML(title, right, inner){
          return `<div class="bg-white rounded-3xl p-4 mb-4 shadow-sm"><div class="flex items-center justify-between" style="margin-bottom:10px;"><div class="font-semibold text-sm text-gray-800">${title}</div>${right ? `<div class="text-xs text-gray-400">${right}</div>` : ''}</div>${inner}</div>`;
        }
        // Count rows by a key -> [{label, n, color}] biggest first
        function chartCountBy(rows, keyFn, colorMap){
          const m = {};
          rows.forEach(r => { const k = String(keyFn(r) || 'Other'); m[k] = (m[k] || 0) + 1; });
          return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, n], i) => ({ label, n, color: (colorMap && colorMap[label]) || CHART_COLORS[i % CHART_COLORS.length] }));
        }
        // Pie (donut) + legend. items: [{label, n, color?}]
        function chartDonutCardHTML(title, items, big, small, right){
          const segs = items.filter(x => x.n > 0).map((x, i) => ({ label: escapeHtml(x.label), n: x.n, color: x.color || CHART_COLORS[i % CHART_COLORS.length] }));
          const total = segs.reduce((a, x) => a + x.n, 0);
          if (!total) return '';
          return chartCardHTML(title, right, `<div class="flex items-center gap-4"><div class="flex-shrink-0">${careerDonutSVG(segs, big != null ? big : total, small || 'total')}</div><div class="flex-1 min-w-0">${careerLegendHTML(segs)}</div></div>`);
        }
        // Horizontal bars. items: [{label, n, color?}]
        function chartBarsCardHTML(title, items, right, valueFmt){
          const list = items.filter(x => x.n > 0).slice(0, 8);
          if (!list.length) return '';
          const max = Math.max(1, ...list.map(x => x.n));
          return chartCardHTML(title, right, list.map((x, i) => careerBarRowHTML(escapeHtml(x.label), x.n, max, x.color || CHART_COLORS[i % CHART_COLORS.length], valueFmt ? valueFmt(x.n) : x.n)).join(''));
        }
        function chartCompact(v){ v = Number(v) || 0; if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'; return v < 10 && v % 1 ? v.toFixed(1) : String(Math.round(v)); }
        // Totals per time slot, newest last. unitDays: 1 = per day, 7 = per week
        function chartTimeline(rows, tsFn, valFn, slots, unitDays){
          const UNIT = unitDays * 86400000, now = Date.now();
          const vals = new Array(slots).fill(0);
          rows.forEach(r => {
            const t = tsFn(r); const ts = t ? new Date(t).getTime() : 0; if (!ts) return;
            const i = slots - 1 - Math.floor((now - ts) / UNIT);
            if (i >= 0 && i < slots) vals[i] += Number(valFn(r)) || 0;
          });
          const labels = vals.map((_, k) => new Date(now - (slots - 1 - k) * UNIT).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
          return { vals, labels };
        }
        // Column chart (bar chart over time)
        function chartColumnsSVG(vals, labels, color, fmt, ariaLabel){
          const W = 300, H = 130, pl = 8, pr = 8, pt = 16, pb = 20;
          const max = Math.max(1, ...vals); const n = vals.length;
          const slot = (W - pl - pr) / n, bw = Math.min(26, slot * 0.62);
          const f = fmt || (v => String(v));
          const every = n > 8 ? Math.ceil(n / 7) : 1;
          const bars = vals.map((v, i) => {
            const h = v ? Math.max(3, (H - pt - pb) * v / max) : 0; const x = pl + i * slot + (slot - bw) / 2; const y = H - pb - h;
            return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${color}"/>${v && n <= 8 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#374151">${escapeHtml(f(v))}</text>` : ''}${i % every === 0 ? `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="8.5" fill="#9ca3af">${escapeHtml(labels[i])}</text>` : ''}`;
          }).join('');
          return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escapeHtml(ariaLabel || 'Chart')}"><line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" stroke="rgba(128,128,128,0.25)" stroke-width="1"/>${bars}</svg>`;
        }
        function chartColumnsCardHTML(title, tl, color, fmt, right){
          if (!tl.vals.some(v => v > 0)) return '';
          return chartCardHTML(title, right, chartColumnsSVG(tl.vals, tl.labels, color, fmt, title));
        }
        // Line chart with an area, for trends
        function chartLineCardHTML(title, tl, right){
          if (!tl.vals.some(v => v > 0)) return '';
          return chartCardHTML(title, right, careerTrendSVG(tl.vals, tl.labels));
        }

        // ---- Admin dashboard: charts for the poster / report tabs ----
        function adminPosterChartsHTML(tab){
          const pend = adminPosterApplications, rev = adminReviewedApplications;
          if (tab === 'applications') {
            if (adminDashboardLoading) return '';
            if (!adminHistoryLoaded && !adminHistoryLoading) setTimeout(loadAdminHistoryData, 0);
            const count = s => rev.filter(a => a.poster_status === s).length;
            const items = [{ label: 'Pending', n: pend.length, color: '#f59e0b' }];
            if (adminHistoryLoaded) items.push({ label: 'Approved', n: count('approved'), color: '#059669' }, { label: 'Declined', n: count('denied'), color: '#ef4444' }, { label: 'Frozen', n: count('frozen'), color: '#0ea5e9' }, { label: 'Blocked', n: count('blocked'), color: '#6b7280' });
            const all = pend.concat(rev);
            return chartDonutCardHTML('Poster applications', items, all.length, 'applications') +
              chartColumnsCardHTML('New applications per week', chartTimeline(all, a => a.poster_applied_at, () => 1, 8, 7), '#1e90ff', null, 'Last 8 weeks');
          }
          if (tab === 'approved' || tab === 'declined' || tab === 'frozen' || tab === 'blocked') {
            if (!adminHistoryLoaded) return '';
            const want = tab === 'declined' ? 'denied' : tab;
            const rows = rev.filter(a => a.poster_status === want);
            const color = { approved: '#059669', declined: '#ef4444', frozen: '#0ea5e9', blocked: '#6b7280' }[tab];
            const label = { approved: 'Approvals', declined: 'Declines', frozen: 'Freezes', blocked: 'Blocks' }[tab];
            return chartColumnsCardHTML(label + ' per week', chartTimeline(rows, a => a.poster_reviewed_at || a.poster_applied_at, () => 1, 8, 7), color, null, 'Last 8 weeks');
          }
          if (tab === 'reports') {
            if (adminDashboardLoading || !adminOpenReports.length) return '';
            const cat = r => { const raw = String(r.reason || '').trim(); const nl = raw.indexOf('\n'); return (nl === -1 ? raw : raw.slice(0, nl)) || 'No reason given'; };
            return chartDonutCardHTML('Open reports by reason', chartCountBy(adminOpenReports, cat), adminOpenReports.length, 'open') +
              chartColumnsCardHTML('Reports per week', chartTimeline(adminOpenReports, r => r.created_at, () => 1, 8, 7), '#f59e0b', null, 'Last 8 weeks');
          }
          if (tab === 'log') {
            if (!adminHistoryLoaded || !adminHistoryItems.length) return '';
            const dec = chartCountBy(adminHistoryItems, x => x.decision === 'listing_removed' ? 'Listing removed' : 'Dismissed', { 'Listing removed': '#ef4444', 'Dismissed': '#94a3b8' });
            return chartDonutCardHTML('How reports ended', dec, adminHistoryItems.length, 'closed') +
              chartColumnsCardHTML('Reports closed per week', chartTimeline(adminHistoryItems, x => x.when, () => 1, 8, 7), '#4f46e5', null, 'Last 8 weeks');
          }
          return '';
        }
        function careerBotStats(){
          const p = careerBotEnsure();
          const list = careerBotAppliedList();
          const sts = list.map(x => careerBotStatusOf(x.job));
          const is = (arr) => sts.filter(s => arr.includes(s)).length;
          const applied = list.length;
          const waiting = sts.filter(s => s === 'applied').length;
          const reviewing = sts.filter(s => s === 'under_review').length;
          const short = is(['shortlisted', 'interview']);
          const offers = is(['offer', 'offer_accepted']);
          const notChosen = is(['rejected']);
          const reviewedPlus = is(['under_review', 'shortlisted', 'interview', 'offer', 'offer_accepted']);
          const shortPlus = is(['shortlisted', 'interview', 'offer', 'offer_accepted']);
          const autoN = list.filter(x => x.rec.by === 'auto').length;
          const WEEKS = 6, DAY = 86400000, now = Date.now();
          const weekly = new Array(WEEKS).fill(0);
          list.forEach(x => {
            const app = jobApplication(x.job); const ts = app && (app.appliedDate || app.appliedAt) || (x.rec && x.rec.ts);
            if (!ts) return;
            const i = WEEKS - 1 - Math.floor((now - ts) / (7 * DAY));
            if (i >= 0 && i < WEEKS) weekly[i]++;
          });
          const weekLabels = weekly.map((_, i) => new Date(now - (WEEKS - 1 - i) * 7 * DAY).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
          const sections = CAREER_BOT_DOC_SLOTS.map(s => ({ s, n: careerBotDocList(s.id).length }));
          const cvOn = !!p.resumeFileName;
          const filled = sections.filter(x => x.n).length + (cvOn ? 1 : 0);
          const totalSections = sections.length + 1;
          const totalFiles = sections.reduce((a, x) => a + x.n, 0) + (cvOn ? 1 : 0);
          const left = sections.filter(x => !x.n).map(x => x.s.label);
          if (!cvOn) left.unshift('CV');
          const steps = [cvOn, careerBotDocList('openLetter').length > 0, !!(p.botContact.phone || '').trim(), careerSubscriptionActive(), applied > 0];
          const setupPct = Math.round(steps.filter(Boolean).length / steps.length * 100);
          const sub = p.subscription; let subPct = 0, subText = '';
          if (sub && sub.startedAt && sub.expiresAt) {
            subPct = Math.max(0, Math.min(100, Math.round((now - sub.startedAt) / (sub.expiresAt - sub.startedAt) * 100)));
            const d = Math.max(0, Math.ceil((sub.expiresAt - now) / DAY)); subText = `${d} day${d === 1 ? '' : 's'} left`;
          }
          const scores = list.map(x => x.rec.score).filter(v => typeof v === 'number');
          const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
          return { p, list, applied, waiting, reviewing, short, offers, notChosen, reviewedPlus, shortPlus, autoN, manualN: applied - autoN, weekly, weekLabels, filled, totalSections, totalFiles, left, setupPct, subPct, subText, avgScore, matched: (p.matches || []).length, responseRate: applied ? Math.round(reviewedPlus / applied * 100) : 0, hasSub: !!sub };
        }
        function careerAutoDashboardHTML(){
          const s = careerBotStats();
          const card = (inner) => `<div class="bg-white rounded-3xl p-4 mb-4 shadow-sm">${inner}</div>`;
          const title = (t, right) => `<div class="flex items-center justify-between" style="margin-bottom:10px;"><div class="font-semibold text-sm text-gray-800">${t}</div>${right ? `<div class="text-xs text-gray-400">${right}</div>` : ''}</div>`;
          const tile = (n, label, color) => `<div class="rounded-2xl text-center" style="background:rgba(10,37,64,0.05);padding:12px 4px;"><div class="text-xl font-bold" style="color:${color};">${n}</div><div class="text-xs text-gray-500" style="margin-top:2px;">${label}</div></div>`;
          const tiles = `<div class="grid grid-cols-4 gap-2 mb-4">${tile(s.matched, 'Matched', '#64748b')}${tile(s.applied, 'Applied', '#1e90ff')}${tile(s.shortPlus, 'Shortlisted', '#4f46e5')}${tile(s.offers, 'Offers', '#059669')}</div>`;
          const top = Math.max(1, s.matched, s.applied);
          const progress = card(`
            ${title('Your progress', `<span class="font-bold" style="color:${NAVY};">${s.setupPct}% set up</span>`)}
            ${careerBarRowHTML('Profile setup (CV, letter, phone, plan, first application)', s.setupPct, 100, `linear-gradient(90deg, ${NAVY}, ${ROYAL})`, s.setupPct + '%')}
            ${s.hasSub ? careerBarRowHTML('Plan time used', s.subPct, 100, '#1e90ff', s.subText) : ''}`);
          const funnel = card(`
            ${title('Application funnel')}
            ${careerBarRowHTML('Matched', s.matched, top, '#94a3b8')}
            ${careerBarRowHTML('Applied', s.applied, top, '#1e90ff')}
            ${careerBarRowHTML('Under review +', s.reviewedPlus, top, '#b45309')}
            ${careerBarRowHTML('Shortlisted / interview +', s.shortPlus, top, '#4f46e5')}
            ${careerBarRowHTML('Offers', s.offers, top, '#059669')}`);
          const trendTotal = s.weekly.reduce((a, b) => a + b, 0);
          const trend = card(`
            ${title('Applications sent', `Last 6 weeks${trendTotal ? ' · ' + trendTotal : ''}`)}
            ${careerTrendSVG(s.weekly, s.weekLabels)}`);
          const statusSegs = [
            { label: 'Waiting', n: s.waiting, color: '#94a3b8' }, { label: 'Under review', n: s.reviewing, color: '#b45309' },
            { label: 'Shortlisted / interview', n: s.short, color: '#4f46e5' }, { label: 'Offers', n: s.offers, color: '#059669' },
            { label: 'Not chosen', n: s.notChosen, color: '#ef4444' },
          ];
          const statusCard = card(`
            ${title('Where your applications stand', s.applied ? `${s.responseRate}% heard back` : '')}
            <div class="flex items-center gap-4"><div class="flex-shrink-0">${careerDonutSVG(statusSegs, s.applied, 'applied')}</div><div class="flex-1 min-w-0">${s.applied ? careerLegendHTML(statusSegs) : '<div class="text-xs text-gray-400">Nothing sent yet. Your breakdown shows up here as soon as Stitch Bot applies.</div>'}</div></div>`);
          const bySegs = [{ label: 'Stitch Bot on its own', n: s.autoN, color: '#1e90ff' }, { label: 'You chose', n: s.manualN, color: '#a5b4fc' }];
          const docSegs = [{ label: 'Uploaded', n: s.filled, color: '#059669' }, { label: 'Left to add', n: s.totalSections - s.filled, color: '#cbd5e1' }];
          const pair = `
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div class="bg-white rounded-3xl p-3 shadow-sm"><div class="font-semibold text-xs text-gray-800 text-center" style="margin-bottom:6px;">Applied by</div><div class="flex justify-center">${careerDonutSVG(bySegs, s.applied, 'total')}</div><div style="margin-top:6px;">${careerLegendHTML(bySegs)}</div></div>
              <div class="bg-white rounded-3xl p-3 shadow-sm"><div class="font-semibold text-xs text-gray-800 text-center" style="margin-bottom:6px;">Documents</div><div class="flex justify-center">${careerDonutSVG(docSegs, s.filled + '/' + s.totalSections, 'sections')}</div><div style="margin-top:6px;">${careerLegendHTML(docSegs)}</div></div>
            </div>`;
          const docsNote = s.left.length ? `<div class="text-xs text-gray-400 px-1 mb-4" style="margin-top:-4px;">${s.totalFiles} file${s.totalFiles === 1 ? '' : 's'} uploaded. Still to add: ${escapeHtml(s.left.slice(0, 4).join(', '))}${s.left.length > 4 ? ` and ${s.left.length - 4} more` : ''}. <button onclick="openCareerDocumentsPage()" class="font-semibold" style="color:${NAVY};">Open Documents</button></div>` : `<div class="text-xs text-gray-400 px-1 mb-4" style="margin-top:-4px;">${s.totalFiles} files uploaded. Every section is filled.</div>`;
          const score = s.avgScore !== null ? card(`${title('Match quality')}${careerBarRowHTML('Average match of the posts Stitch Bot chose', s.avgScore, 100, s.avgScore < 50 ? '#f59e0b' : '#059669', s.avgScore + '%')}`) : '';
          const tile2 = (n, label) => `<div class="rounded-2xl text-center" style="background:rgba(10,37,64,0.05);padding:12px 4px;"><div class="text-lg font-bold" style="color:${NAVY};">${n}</div><div class="text-xs text-gray-500" style="margin-top:2px;">${label}</div></div>`;
          const thisWeek = s.weekly[s.weekly.length - 1] || 0;
          const tiles2 = `<div class="grid grid-cols-4 gap-2 mb-4">${tile2(thisWeek, 'This week')}${tile2(s.applied ? s.responseRate + '%' : '-', 'Heard back')}${tile2(s.avgScore !== null ? s.avgScore + '%' : '-', 'Avg match')}${tile2(s.filled + '/' + s.totalSections, 'Documents')}</div>`;
          const todo = [];
          if (!s.p.resumeFileName) todo.push(['Attach your CV', 'openCareerDocumentsPage()']);
          if (!careerBotDocList('openLetter').length) todo.push(['Add an open application letter', 'openCareerDocumentsPage()']);
          if (!careerBotDocList('degree').length) todo.push(['Add your degree or diploma', 'openCareerDocumentsPage()']);
          if (!careerBotDocList('reference').length) todo.push(['Add a reference letter', 'openCareerDocumentsPage()']);
          if (!s.applied) todo.push(['Review your preferences before the first application', 'openCareerPreferencesPage()']);
          const nextSteps = todo.length ? card(`
            ${title('Next steps')}
            ${todo.slice(0, 4).map((t, i) => `<button onclick="${t[1]}" class="w-full flex items-center justify-between text-left text-sm text-gray-700" style="padding:12px 0;${i ? 'border-top:1px solid rgba(128,128,128,0.15);' : ''}"><span>${t[0]}</span>${Icon('arrowRight','w-4 h-4 text-gray-400')}</button>`).join('')}`) : '';
          return `
            ${tiles}
            ${tiles2}
            ${nextSteps}
            ${careerBotPendingHTML()}
            ${progress}${funnel}${trend}${statusCard}${pair}${docsNote}${score}
            ${careerAutoApplyInsightsHTML(true)}
            ${careerAutoApplyListHTML()}
            ${careerBotUpdatesCardHTML()}`;
        }
        function careerAutoApplyHTML(){
          const p = careerBotEnsure();
          const on = !!(p && p.autoApply);
          const active = careerSubscriptionActive();
          const prefs = careerBotPrefs();
          const hasDocs = careerHasBotDocs();
          const onText = prefs.mode === 'review' ? 'On. Stitch Bot asks you before each application, and shows why.' : 'On. Stitch Bot applies as soon as it spots a match.';
          const toggle = `
            <div class="bg-white rounded-3xl p-4 mb-5 shadow-sm">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('bot','w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-800">Auto apply to my matches</div>
                  <div class="text-xs text-gray-400">${on ? onText : 'Off. You choose which matches to apply to.'}</div>
                </div>
                ${careerSwitchHTML(on, 'toggleCareerAutoApply()')}
              </div>
              ${on ? `<div class="text-xs text-gray-400" style="margin-top:10px;">Stitch Bot sends your CV, open application letter and any documents a post asks for. Matches missing a required document are skipped until you add it in Documents. <button onclick="openCareerPreferencesPage()" class="font-semibold" style="color:${NAVY};">Change preferences</button></div>` : ''}
              ${!active ? `<div class="text-xs font-semibold" style="margin-top:10px;color:#ef4444;">Your subscription has ended, so auto apply is paused.</div>` : ''}
            </div>`;
          const body = hasDocs ? careerAutoDashboardHTML() : `
            <div class="bg-white rounded-3xl p-4 mb-5 shadow-sm">
              <div class="text-sm font-semibold text-gray-800" style="margin-bottom:4px;">Add your first document</div>
              <div class="text-xs text-gray-500">Upload your open application letter or any document below. Once the first one is in, your documents move to the Documents page in the menu and this page becomes your dashboard: progress, funnel, applications sent and your tracker.</div>
              <div class="text-xs text-gray-500" style="margin-top:10px;">You can add: ${CAREER_BOT_DOC_SLOTS.map(x => x.label.toLowerCase()).join(', ')}. Each section takes several files.</div>
            </div>
            ${careerBotDocsCardHTML()}`;
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
              ${careerAutoApplyHeaderHTML()}
              <div class="px-5" style="padding-top:20px;">${toggle}${body}</div>
            </div>`;
        }

        // ---- Documents page ----
        function careerDocumentsHTML(){
          const p = careerBotEnsure();
          const cv = p && p.resumeFileName ? `
            <div class="bg-white rounded-3xl p-4 mb-5 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400" style="margin-bottom:6px;">Your CV</div>
              <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(p.resumeFileName)}</div>
              <div class="flex items-center gap-2" style="margin-top:10px;">
                ${p.resumeDataUrl ? `<button onclick="careerViewResume()" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:rgba(10,37,64,0.08);color:${NAVY};">View</button><button onclick="careerDownloadResume()" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:rgba(10,37,64,0.08);color:${NAVY};">Download</button>` : ''}
                <input type="file" id="career-profile-resume-input" accept=".pdf,.doc,.docx" class="hidden" onchange="handleCareerProfileResumeReplace(event)">
                <button onclick="document.getElementById('career-profile-resume-input').click()" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:#f3f4f6;color:#374151;">Edit</button>
              </div>
            </div>` : `
            <div class="bg-white rounded-3xl p-4 mb-5 shadow-sm text-sm text-gray-500">No CV attached yet.
              <input type="file" id="career-profile-resume-input" accept=".pdf,.doc,.docx" class="hidden" onchange="handleCareerProfileResumeReplace(event)">
              <button onclick="document.getElementById('career-profile-resume-input').click()" class="block font-semibold" style="color:${NAVY};margin-top:6px;">Attach CV</button>
            </div>`;
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
              ${careerSubPageHeaderHTML('Documents')}
              <div class="px-5" style="padding-top:20px;">
                <div class="text-xs text-gray-400 px-1" style="margin-bottom:12px;">Everything you have uploaded for Stitch Bot. View, download or edit any file.</div>
                ${cv}
                ${careerBotDocsCardHTML()}
              </div>
            </div>`;
        }

        // ---- Notifications page ----
        function careerNotificationsHTML(){
          const p = careerBotEnsure(); const n = careerBotNotifPrefs();
          const rows = [
            ['applications', 'Application updates', 'Sent applications and every status change, interview and offer.'],
            ['matches', 'Matches and deadlines', 'New matches and posts that close soon.'],
            ['approvals', 'Needs your OK', 'When Stitch Bot is waiting for you to approve an application.'],
            ['subscription', 'Plan reminders', 'Before your Stitch Bot plan ends.'],
          ];
          const channel = (p && p.contactMethod === 'email') ? 'by email' : 'in the app';
          const log = (p && p.botLog || []).slice(0, 30);
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
              ${careerSubPageHeaderHTML('Notifications')}
              <div class="px-5" style="padding-top:20px;">
                <div class="bg-white rounded-3xl p-4 mb-5 shadow-sm">
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400" style="margin-bottom:2px;">What to tell me about</div>
                  <div class="text-xs text-gray-400" style="margin-bottom:6px;">Updates arrive ${channel}.</div>
                  ${rows.map((r, i) => `
                    <div class="flex items-center gap-3" style="padding:12px 0;${i ? 'border-top:1px solid rgba(128,128,128,0.15);' : ''}">
                      <div class="flex-1 min-w-0"><div class="text-sm font-semibold text-gray-800">${r[1]}</div><div class="text-xs text-gray-400">${r[2]}</div></div>
                      ${careerSwitchHTML(n[r[0]] !== false, `toggleCareerBotNotif('${r[0]}')`)}
                    </div>`).join('')}
                </div>
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 px-1" style="margin-bottom:6px;">Recent from Stitch Bot</div>
                ${log.length ? log.map(l => `
                  <div class="flex items-start gap-3 bg-white rounded-2xl shadow-sm" style="padding:12px;margin-bottom:8px;">
                    <span class="flex-shrink-0 flex items-center justify-center" style="width:32px;height:32px;border-radius:9999px;background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('bot','w-4 h-4')}</span>
                    <div class="flex-1 min-w-0"><div class="text-sm text-gray-700">${escapeHtml(l.text)}</div><div class="text-xs text-gray-400" style="margin-top:2px;">${escapeHtml(careerPlanDateLabel(l.ts))}</div></div>
                  </div>`).join('') : `<div class="text-center text-gray-500 text-sm" style="padding:28px 16px;">Nothing yet. Updates from Stitch Bot will show up here.</div>`}
              </div>
            </div>`;
        }

        // ---- Preferences page ----
        // Same white, shadowed chip as the onboarding "What brings you here?" and sign-up pills
        // (.auth-intent-chip in styles.css). Selected = blue outline.
        function careerPrefChipsHTML(key, options, current){
          return `<div class="auth-intent-row">${options.map(o => {
            const sel = current === o.v; const val = typeof o.v === 'number' ? o.v : `'${o.v}'`;
            return `<button type="button" aria-pressed="${sel}" onclick="setCareerBotPref('${key}',${val})" class="auth-intent-chip ${sel ? 'on' : ''}"><span>${o.l}</span></button>`;
          }).join('')}</div>`;
        }
        // The two big "Ask me first / Go ahead on its own" cards: tick circle, blue border and a
        // light blue fill when picked
        function careerPrefChoiceHTML(key, options, current){
          return options.map(o => {
            const sel = current === o.v;
            return `<button onclick="setCareerBotPref('${key}','${o.v}')" class="w-full text-left rounded-2xl flex items-start gap-3" style="padding:14px;margin-bottom:10px;border:2px solid ${sel ? '#1e90ff' : 'rgba(128,128,128,0.2)'};background:${sel ? 'rgba(30,144,255,0.06)' : 'transparent'};">
              <span class="flex-shrink-0 flex items-center justify-center" style="width:22px;height:22px;margin-top:1px;border-radius:9999px;${sel ? 'background:#1e90ff;color:#fff;' : 'border:2px solid rgba(128,128,128,0.4);'}">${sel ? Icon('check','w-3 h-3') : ''}</span>
              <span class="flex-1 min-w-0"><span class="block text-sm font-semibold text-gray-800">${o.l}</span><span class="block text-xs text-gray-500" style="margin-top:2px;">${o.d}</span></span>
            </button>`;
          }).join('');
        }
        function careerPreferencesHTML(){
          const pr = careerBotPrefs();
          const sec = (t, sub, inner) => `<div style="margin-bottom:28px;"><div class="text-base font-semibold text-gray-800">${t}</div>${sub ? `<div class="text-xs text-gray-400" style="margin:2px 0 12px;">${sub}</div>` : '<div style="height:10px;"></div>'}${inner}</div>`;
          const sub2 = (t) => `<div class="text-sm font-semibold text-gray-500" style="margin:20px 0 10px;">${t}</div>`;
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
              ${careerSubPageHeaderHTML('Preferences')}
              <div class="px-5" style="padding-top:20px;">
                ${sec('How should Stitch Bot act for you?', 'Applies to everything it does on auto apply.', careerPrefChoiceHTML('mode', [
                  { v: 'review', l: 'Ask me first', d: 'It shows each action and why it wants to take it. Nothing is sent until you approve.' },
                  { v: 'auto', l: 'Go ahead on its own', d: 'It takes every action itself and tells you after.' },
                ], pr.mode))}
                ${sec('How it submits your documents', '', `
                  ${sub2('Open application letter').replace('margin:20px 0 10px', 'margin:0 0 10px')}
                  ${careerPrefChipsHTML('letter', [{ v: 'always', l: 'Always attach' }, { v: 'asked', l: 'Only when a post asks' }], pr.letter)}
                  ${sub2('Extra documents (certificates, references, other)')}
                  ${careerPrefChipsHTML('extras', [{ v: 'all', l: 'Attach all' }, { v: 'asked', l: 'Only what a post asks for' }], pr.extras)}
                  ${sub2('Cover note')}
                  ${careerPrefChipsHTML('coverNote', [{ v: 'fresh', l: 'Write a new one per post' }, { v: 'letter', l: 'Use my open letter' }], pr.coverNote)}
                  ${sub2('Tone of the note')}
                  ${careerPrefChipsHTML('tone', [{ v: 'professional', l: 'Professional' }, { v: 'friendly', l: 'Friendly' }, { v: 'concise', l: 'Short and direct' }], pr.tone)}
                `)}
                ${sec('Which posts it applies to', '', `
                  ${sub2('Minimum match').replace('margin:20px 0 10px', 'margin:0 0 10px')}
                  ${careerPrefChipsHTML('minScore', [{ v: 40, l: '40%+' }, { v: 60, l: '60%+' }, { v: 70, l: '70%+' }, { v: 80, l: '80%+' }], pr.minScore)}
                  ${sub2('Most applications per day')}
                  ${careerPrefChipsHTML('dailyLimit', [{ v: 5, l: '5' }, { v: 10, l: '10' }, { v: 20, l: '20' }, { v: 0, l: 'No limit' }], pr.dailyLimit)}
                `)}
                ${sec('Anything else it should know?', 'Optional. Stitch Bot keeps this in mind when it writes for you.', `<textarea rows="4" maxlength="600" oninput="setCareerBotPrefNotes(this.value)" placeholder="e.g. I only want remote roles. Never mention my current employer." class="w-full bg-gray-100 flow-outline text-sm rounded-2xl px-3 py-2.5" style="outline:none;resize:vertical;">${escapeHtml(pr.notes || '')}</textarea>`)}
              </div>
            </div>`;
        }

        // ---- Waiting for your OK (review mode) ----
        function careerBotReasonFor(job, p){
          const m = (p.matches || []).find(x => x.id === job.id) || {};
          const pr = careerBotPrefs();
          const why = [];
          if (typeof m.score === 'number') why.push(`${m.score}% match to your profile`);
          if (m.reason) why.push(String(m.reason).replace(/[.\s]+$/, ''));
          why.push('every document it asks for is ready');
          const sends = ['your CV'];
          if (careerBotDocList('openLetter').length) sends.push('your open letter');
          const extra = CAREER_BOT_DOC_SLOTS.filter(sl => sl.extra).reduce((a, sl) => a + careerBotDocList(sl.id).length, 0);
          const more = ['degree', 'writingSample'].reduce((a, id) => a + careerBotDocList(id).length, 0);
          if ((extra + more) && pr.extras === 'all') sends.push(`${extra + more} extra document${(extra + more) === 1 ? '' : 's'}`);
          return { why: why.join('. ') + '.', sends: sends.join(', ') + (pr.coverNote === 'letter' ? '' : ' and a new cover note') };
        }
        function careerBotPendingHTML(){
          const p = careerBotEnsure(); if (!p) return '';
          const list = (p.botPending || []).map(x => ({ x, job: findJob(x.jobId) })).filter(y => y.job && !isJobApplied(y.job));
          if (!list.length) return '';
          return `
            <div class="bg-white rounded-3xl p-4 mb-4 shadow-sm" style="border:2px solid rgba(30,144,255,0.35);">
              <div class="flex items-center justify-between" style="margin-bottom:6px;">
                <div class="font-semibold text-sm text-gray-800">Waiting for your OK (${list.length})</div>
                ${list.length > 1 ? `<button onclick="careerBotApproveAll()" class="text-xs font-semibold" style="color:${NAVY};">Approve all</button>` : ''}
              </div>
              ${list.map(({ x, job }) => { const r = careerBotReasonFor(job, p); return `
                <div style="padding:12px 0;border-top:1px solid rgba(128,128,128,0.15);">
                  <div class="text-sm font-semibold text-gray-800">${escapeHtml(job.title)}</div>
                  <div class="text-xs text-gray-400">${escapeHtml(stitchOrgName(job.org || job.sub || ''))}</div>
                  <div class="text-xs text-gray-600" style="margin-top:6px;"><b>Why:</b> ${escapeHtml(r.why)}</div>
                  <div class="text-xs text-gray-600" style="margin-top:3px;"><b>It will send:</b> ${escapeHtml(r.sends)}.</div>
                  <div class="flex gap-2" style="margin-top:10px;">
                    <button ${careerBotBusy ? 'disabled' : ''} onclick="careerBotApprove('${job.id}')" class="flex-1 text-sm font-semibold py-2 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);${careerBotBusy ? 'opacity:.6;' : ''}">Approve</button>
                    <button onclick="careerBotDecline('${job.id}')" class="flex-1 text-sm font-semibold py-2 rounded-full" style="background:#f3f4f6;color:#374151;">Skip</button>
                  </div>
                </div>`; }).join('')}
            </div>`;
        }
        async function careerBotApprove(jobId){
          const p = careerBotEnsure(); if (!p || careerBotBusy) return;
          p.botPending = (p.botPending || []).filter(x => x.jobId !== jobId);
          careerBotBusy = true; rerenderCareerMatches(true);
          const why = await careerBotApplyOne(jobId, 'auto');
          careerBotBusy = false; rerenderCareerMatches(true);
          if (why) openAppAlertModal(why, 'Stitch Bot could not apply');
        }
        async function careerBotApproveAll(){
          const p = careerBotEnsure(); if (!p || careerBotBusy) return;
          const ids = (p.botPending || []).map(x => x.jobId);
          p.botPending = [];
          careerBotBusy = true; rerenderCareerMatches(true);
          for (const id of ids) { const why = await careerBotApplyOne(id, 'auto'); if (why === 'Your Stitch Bot subscription has ended.') break; }
          careerBotBusy = false; saveCareerStartProfile(); rerenderCareerMatches(true);
        }
        function careerBotDecline(jobId){
          const p = careerBotEnsure(); if (!p) return;
          p.botPending = (p.botPending || []).filter(x => x.jobId !== jobId);
          saveCareerStartProfile(); rerenderCareerMatches(true);
        }

        // ---- Cancel subscription: why did you cancel? ----
        const CAREER_CANCEL_GROUPS = [
          { title: 'Price', items: [
            { id: 'price', label: 'The price is too high', ask: 'What would a fair price look like for you?' },
            { id: 'subscribing', label: "I don't like subscribing", ask: 'What would you prefer instead of a subscription?' } ] },
          { title: 'Results', items: [
            { id: 'few_matches', label: 'Not enough matches', ask: 'What kind of opportunities were you hoping to see?' },
            { id: 'irrelevant', label: "Matches weren't relevant", ask: 'What was off about the matches you got?' },
            { id: 'no_response', label: "Applications didn't get responses", ask: 'Tell us what happened after Stitch Bot applied.' } ] },
          { title: 'Using Stitch Bot', items: [
            { id: 'control', label: "It didn't act the way I wanted", ask: 'What should Stitch Bot have done differently?' },
            { id: 'setup', label: 'Setup was confusing or slow', ask: 'Which part was hard to figure out?' },
            { id: 'broken', label: "Something wasn't working", ask: 'What went wrong? The more detail, the better.' } ] },
          { title: 'Life', items: [
            { id: 'found', label: 'I found a job or place', ask: 'Congratulations! Where did you find it? (Optional)' },
            { id: 'not_needed', label: "I don't need it right now", ask: 'Anything that would bring you back later? (Optional)' } ] },
          { title: 'Something else', items: [ { id: 'other', label: 'Something else', ask: 'Tell us in your own words.' } ] },
        ];
        let careerCancelDraft = { id: '', label: '', ask: '', text: '' };
        function careerCancelFind(id){ let f = null; CAREER_CANCEL_GROUPS.forEach(g => g.items.forEach(i => { if (i.id === id) f = i; })); return f; }
        function openCareerCancelReason(){
          careerCancelDraft = { id: '', label: '', ask: '', text: '' };
          openOverlayFrom('careerSubscription', 'careerCancelReason');
        }
        function careerCancelReasonHTML(){
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
              ${overlayHeader('Why did you cancel?', '20px', 'careerCancelSkip()', null, { right: true })}
              <div class="px-5" style="padding-top:18px;">
                <div class="text-sm text-gray-500 text-center" style="margin-bottom:18px;">We're sorry to see you go. Pick the closest reason. It takes a few seconds and helps us improve.</div>
                ${CAREER_CANCEL_GROUPS.map(g => `
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400 px-1" style="margin:16px 0 8px;">${g.title}</div>
                  ${g.items.map((i, ix) => `<button onclick="careerCancelPick('${i.id}')" class="w-full flex items-center justify-between text-left font-semibold text-sm" style="background:transparent;color:#374151;padding:1rem 0.25rem;${ix ? '' : 'border-top:1px solid rgba(128,128,128,0.18);'}border-bottom:1px solid rgba(128,128,128,0.18);"><span>${i.label}</span>${Icon('arrowRight','w-4 h-4 text-gray-400')}</button>`).join('')}`).join('')}
                <button onclick="careerCancelSkip()" class="w-full text-sm font-semibold text-gray-400 py-4">Skip</button>
              </div>
            </div>`;
        }
        function careerCancelPick(id){
          const it = careerCancelFind(id); if (!it) return;
          careerCancelDraft = { id: it.id, label: it.label, ask: it.ask, text: '' };
          openOverlayFrom('careerCancelReason', 'careerCancelDetail');
        }
        // Saves the reason so admins can read it in Admin Dashboard > Cancellations
        async function careerSendCancelReason(reasonId, label, text){
          try {
            const sb = getSupabaseClient(); if (!sb) return;
            const { data } = await sb.auth.getUser();
            const uid = data && data.user && data.user.id; if (!uid) return;
            const sub = (careerStartProfile && careerStartProfile.subscription) || {};
            await sb.from('career_cancel_reasons').insert({
              user_id: uid, reason_id: String(reasonId || 'skipped').slice(0, 40), reason_label: String(label || '').slice(0, 120),
              detail: String(text || '').trim().slice(0, 1000), plan: sub.plan ? String(sub.plan).slice(0, 40) : null,
              expires_at: sub.expiresAt ? new Date(sub.expiresAt).toISOString() : null,
            });
          } catch (e) {}
        }
        function careerCancelSkip(){ careerSendCancelReason('skipped', '', ''); openOverlayFrom('careerMatches', 'careerSubscription'); }
        function careerCancelDetailHTML(){
          const d = careerCancelDraft;
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:20px;">
              ${overlayHeader('Tell us more', '20px', 'overlayGoBack()', null, { right: true })}
              <div class="px-5" style="padding-top:18px;">
                <div class="text-xs font-semibold text-gray-400" style="margin-bottom:10px;">${escapeHtml(d.label)}</div>
                <div class="text-base font-semibold text-gray-800" style="margin-bottom:10px;">${escapeHtml(d.ask)}</div>
                <textarea id="career-cancel-text" rows="7" maxlength="1000" oninput="careerCancelDraft.text=this.value" placeholder="Type here…" class="w-full bg-gray-100 flow-outline text-sm rounded-2xl px-4 py-3" style="outline:none;resize:none;">${escapeHtml(d.text)}</textarea>
              </div>
            </div>
            <div class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(18px, env(safe-area-inset-bottom));">
              <button onclick="careerCancelSubmit()" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">Submit</button>
            </div>`;
        }
        function careerCancelSubmit(){
          const d = careerCancelDraft; const p = careerStartProfile;
          if (p && p.subscription) {
            p.subscription.cancelReason = { id: d.id, label: d.label, text: String(d.text || '').trim().slice(0, 1000), ts: Date.now() };
            saveCareerStartProfile();
          }
          careerSendCancelReason(d.id, d.label, d.text);
          try { if (window.posthog && typeof window.posthog.capture === 'function') window.posthog.capture('career_subscription_cancel_reason', { reason: d.id, text: String(d.text || '').slice(0, 500) }); } catch (e) {}
          openOverlayFrom('careerMatches', 'careerSubscription');
          openAppAlertModal('Thanks for telling us. Stitch Bot keeps working until your plan ends.', 'Feedback sent');
        }

        function toggleCareerAutoApply(){
          const p = careerBotEnsure(); if (!p) return;
          if (!p.autoApply && !careerSubscriptionActive()) { openAppAlertModal('Renew your subscription to switch on auto apply.'); return; }
          if (!p.autoApply) {
            const phone = normalizeIntlPhone(p.botContact.phone || p.phone);
            if (!phone.ok) { openAppAlertModal('Add your phone number with its country code first, so Stitch Bot has a way to reach you on applications.'); return; }
            if (!p.resumeFileName) { openAppAlertModal('Attach your CV first.'); return; }
            p.autoApply = true;
            saveCareerStartProfile();
            rerenderCareerMatches();
            careerBotAutoApplyRun();
            return;
          }
          p.autoApply = false;
          saveCareerStartProfile();
          rerenderCareerMatches();
        }
        // Applies once to every ready match that Stitch Bot hasn't already tried
        let careerAutoApplyRunning = false;
        async function careerBotAutoApplyRun(){
          const p = careerBotEnsure();
          if (!p || !p.autoApply || careerAutoApplyRunning || careerBotBusy || !careerSubscriptionActive()) return;
          careerAutoApplyRunning = true;
          try {
            const prefs = careerBotPrefs();
            if (!p.botPending) p.botPending = [];
            let ids = (p.matches || []).filter(m => {
              const jb = findJob(m.id);
              if (!(jb && careerBotCanApply(jb) && !careerBotMissingFor(jb).length && !p.botSeen['auto:' + m.id])) return false;
              return typeof m.score !== 'number' || m.score >= prefs.minScore;
            }).map(m => m.id);
            if (prefs.mode === 'review') {
              let queued = 0;
              ids.forEach(id => {
                if (p.botSeen['pend:' + id]) return;
                p.botSeen['pend:' + id] = 1; p.botPending.push({ jobId: id, ts: Date.now() }); queued++;
              });
              if (queued) { careerBotLog(`Stitch Bot is waiting for your OK on ${queued} application${queued === 1 ? '' : 's'}. Open Auto apply to review why.`, '', true, 'approvals'); saveCareerStartProfile(); }
              return;
            }
            if (prefs.dailyLimit > 0) {
              const since = Date.now() - 86400000;
              const sentToday = Object.keys(p.botApplied || {}).filter(k => p.botApplied[k].by === 'auto' && p.botApplied[k].ts > since).length;
              ids = ids.slice(0, Math.max(0, prefs.dailyLimit - sentToday));
            }
            let done = 0;
            for (const id of ids) {
              p.botSeen['auto:' + id] = 1;
              const why = await careerBotApplyOne(id, 'auto');
              if (!why) done++;
              else if (why === 'Your Stitch Bot subscription has ended.') break;
            }
            if (done) { careerBotLog(`Auto apply sent ${done} application${done === 1 ? '' : 's'} for you.`, '', true); saveCareerStartProfile(); }
          } finally {
            careerAutoApplyRunning = false;
            rerenderCareerMatches(true);
          }
        }


        // ---- Auto apply: everything Stitch Bot sent, with outcomes and a short read on how it is
        // going ----
        function careerBotAppliedList(){
          const p = careerBotEnsure(); if (!p) return [];
          const rec = Object.assign({}, p.botApplied || {});
          // Applications sent before this was recorded still show up through Stitch Bot's update log
          (p.botLog || []).forEach(l => { if (l.jobId && /^Applied to /.test(l.text) && !rec[l.jobId]) rec[l.jobId] = { ts: l.ts, by: 'manual', score: null }; });
          return Object.keys(rec).map(id => ({ id, job: findJob(id), rec: rec[id] }))
            .filter(x => x.job && isJobApplied(x.job))
            .sort((a, b) => (b.rec.ts || 0) - (a.rec.ts || 0));
        }
        function careerBotStatusOf(job){ return (jobApplication(job) || {}).status || 'applied'; }
        function careerBotAgoLabel(ts){
          if (!ts) return 'not yet';
          const m = Math.floor((Date.now() - ts) / 60000);
          if (m < 1) return 'just now';
          if (m < 60) return `${m} min ago`;
          const h = Math.floor(m / 60);
          if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
          const d = Math.floor(h / 24);
          return `${d} day${d === 1 ? '' : 's'} ago`;
        }
        function careerAutoApplyInsightsHTML(readoutOnly){
          const p = careerBotEnsure(); if (!p) return '';
          const list = careerBotAppliedList();
          const sts = list.map(x => careerBotStatusOf(x.job));
          const n = list.length;
          const autoN = list.filter(x => x.rec.by === 'auto').length;
          const reviewed = sts.filter(st => ['under_review','shortlisted','interview','offer','offer_accepted','rejected'].includes(st)).length;
          const short = sts.filter(st => ['shortlisted','interview','offer','offer_accepted'].includes(st)).length;
          const offers = sts.filter(st => ['offer','offer_accepted'].includes(st)).length;
          const notChosen = sts.filter(st => st === 'rejected').length;
          // What Stitch Bot has not applied to, and why.
          const botIds = new Set(list.map(x => x.id));
          let ready = 0, outside = 0, byYou = 0; const missing = {};
          (p.matches || []).forEach(m => {
            const jb = findJob(m.id); if (!jb || jb.type === 'Course') return;
            if (isJobApplied(jb)) { if (!botIds.has(jb.id)) byYou++; return; }
            if (jb.applyMethod === 'website' && jb.website) { outside++; return; }
            const miss = careerBotMissingFor(jb);
            if (miss.length) miss.forEach(l => { missing[l] = (missing[l] || 0) + 1; }); else ready++;
          });
          const topMissing = Object.keys(missing).sort((a, b) => missing[b] - missing[a])[0];
          const skippedForDocs = Object.keys(missing).length ? (p.matches || []).filter(m => { const jb = findJob(m.id); return jb && jb.type !== 'Course' && !isJobApplied(jb) && !(jb.applyMethod === 'website' && jb.website) && careerBotMissingFor(jb).length; }).length : 0;
          const scores = list.map(x => x.rec.score).filter(v => typeof v === 'number');
          const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
          const quiet = list.filter(x => careerBotStatusOf(x.job) === 'applied' && (Date.now() - (x.rec.ts || Date.now())) > 7 * 86400000).length;
          const plural = (k, one, many) => `${k} ${k === 1 ? one : many}`;
          const notes = [];
          if (!n) {
            notes.push(p.autoApply ? 'Auto apply is on, but Stitch Bot has not sent anything yet. It applies as soon as a match has every document it asks for.' : 'Stitch Bot has not applied for you yet. Switch on auto apply, or tap Apply with Stitch Bot on a match.');
          } else {
            notes.push(`Stitch Bot has sent ${plural(n, 'application', 'applications')}${autoN ? `, ${autoN} on its own` : ''}. ${reviewed ? `${plural(reviewed, 'has', 'have')} been looked at by the poster (${Math.round(reviewed / n * 100)}%).` : 'None has been reviewed yet, which is normal in the first days.'}`);
            if (avgScore !== null) notes.push(`The posts it chose average a ${avgScore}% match to your profile${avgScore < 50 ? ', which is on the low side. Tightening what you are looking for will sharpen its choices.' : '. Its choices are staying close to what you asked for.'}`);
            if (offers) notes.push(`You have ${plural(offers, 'offer', 'offers')}. Open it and respond before the poster moves on.`);
            else if (short) notes.push(`${plural(short, 'application is', 'applications are')} shortlisted or further along. Keep your phone and email close.`);
            if (quiet) notes.push(`${plural(quiet, 'application has', 'applications have')} had no response for over a week. Open them to check, or follow up with the poster directly.`);
            if (notChosen) notes.push(`${plural(notChosen, 'application was', 'applications were')} not successful. That is part of the process, and the rest are still in play.`);
          }
          if (skippedForDocs && topMissing) notes.push(`${plural(skippedForDocs, 'match was', 'matches were')} skipped because they ask for documents you have not added. Your ${topMissing.toLowerCase()} would unlock the most.`);
          if (outside) notes.push(`${plural(outside, 'match applies', 'matches apply')} on outside websites. Stitch Bot stays inside Stitch, so those are yours to do.`);
          if (byYou) notes.push(`You applied to ${plural(byYou, 'match', 'matches')} yourself.`);
          const bar = (label, v, max, color) => `
            <div style="margin-bottom:10px;">
              <div class="flex items-center justify-between text-xs" style="margin-bottom:4px;"><span class="text-gray-600">${label}</span><span class="font-bold text-gray-800">${v}</span></div>
              <div style="height:8px;border-radius:9999px;background:rgba(128,128,128,0.18);overflow:hidden;"><div style="height:100%;width:${max ? Math.round(v / max * 100) : 0}%;min-width:${v ? 6 : 0}px;border-radius:9999px;background:${color};transition:width .4s ease;"></div></div>
            </div>`;
          const top = Math.max(1, n);
          return `
            <div class="px-1 mb-5">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">How Stitch Bot is doing</div>
              ${(n && !readoutOnly) ? `
                ${careerAnalyticsGraphHTML(list.map(x => x.job))}
                <div style="margin-top:14px;">
                  ${bar('Sent', n, top, '#1e90ff')}
                  ${bar('Reviewed', reviewed, top, '#b45309')}
                  ${bar('Shortlisted or further', short, top, '#4f46e5')}
                  ${bar('Offers', offers, top, '#059669')}
                </div>` : ''}
              ${(ready || skippedForDocs || outside) ? `
                <div class="flex flex-wrap gap-2" style="margin:4px 0 12px;">
                  ${ready ? `<span class="text-xs font-semibold px-3 py-1 rounded-full" style="background:rgba(10,37,64,0.08);color:${NAVY};">${ready} ready to apply</span>` : ''}
                  ${skippedForDocs ? `<span class="text-xs font-semibold px-3 py-1 rounded-full" style="background:#fffbeb;color:#b45309;">${skippedForDocs} need documents</span>` : ''}
                  ${outside ? `<span class="text-xs font-semibold px-3 py-1 rounded-full" style="background:rgba(128,128,128,0.15);color:#6b7280;">${outside} on outside sites</span>` : ''}
                </div>` : ''}
              <div class="text-sm font-semibold text-gray-800" style="margin-bottom:6px;">Your read-out</div>
              ${notes.map(t => `<div class="flex items-start gap-2 py-1.5"><span style="color:${NAVY};margin-top:2px;">${Icon('bot','w-3.5 h-3.5')}</span><div class="flex-1 min-w-0 text-sm text-gray-700">${escapeHtml(t)}</div></div>`).join('')}
            </div>`;
        }
        // Small step tracker: Applied > Under review > Shortlisted > Interview > Offer.
        function careerBotMiniTrackerHTML(status){
          const steps = ['applied', 'under_review', 'shortlisted', 'interview', 'offer'];
          const term = JOB_TERMINAL_META[status];
          const idx = status === 'offer_accepted' ? 4 : steps.indexOf(status);
          const meta = JOB_STATUS_META[status] || JOB_PIPELINE_META.applied;
          const dots = steps.map((k, i) => {
            const on = !term || status === 'offer_accepted' ? i <= idx : i === 0;
            return `<div style="flex:1;height:5px;border-radius:9999px;background:${on ? meta.color : 'rgba(128,128,128,0.22)'};"></div>`;
          }).join('<div style="width:4px;"></div>');
          return `<div class="flex items-center" style="margin:8px 0 4px;">${dots}</div><div class="text-xs font-semibold" style="color:${meta.color};">${escapeHtml(meta.label)}</div>`;
        }
        function careerAutoApplyListHTML(){
          const p = careerBotEnsure(); if (!p) return '';
          const list = careerBotAppliedList();
          const head = `
            <div class="flex items-center justify-between mb-1">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400">Applied for you</div>
              ${list.length ? `<button onclick="careerBotCheckNow()" class="text-xs font-semibold" style="color:${NAVY};">Check now</button>` : ''}
            </div>`;
          if (!list.length) {
            return `<div class="px-1 mb-5">${head}<div class="text-xs text-gray-400">Posts Stitch Bot applies to will be listed here with a tracker for each.</div></div>`;
          }
          return `
            <div class="px-1 mb-5">
              ${head}
              <div class="text-xs text-gray-400" style="margin-bottom:6px;">Stitch Bot checks these each time you open Stitch. Last checked ${careerBotAgoLabel(p.botCheckedAt)}. Tap a post to see its full tracker.</div>
              ${list.map(x => `
                <div onclick="openJobOrClassroom('${x.id}')" class="cursor-pointer" style="padding:12px 0;border-top:1px solid rgba(128,128,128,0.15);">
                  <div class="flex items-start gap-2">
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(x.job.title)}</div>
                      <div class="text-xs text-gray-400 truncate">${escapeHtml(stitchOrgName(x.job.org || x.job.sub || ''))}${x.job.org || x.job.sub ? ' · ' : ''}Sent ${escapeHtml(careerPlanDateLabel(x.rec.ts))}</div>
                      ${x.rec.sent && x.rec.sent.length ? `<div class="text-xs text-gray-500" style="margin-top:2px;">Documents sent: ${escapeHtml(x.rec.sent.join(', '))}</div>` : ''}
                    </div>
                    <span class="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full" style="${x.rec.by === 'auto' ? `background:rgba(10,37,64,0.08);color:${NAVY};` : 'background:rgba(128,128,128,0.15);color:#6b7280;'}">${x.rec.by === 'auto' ? 'Auto' : 'You chose'}</span>
                  </div>
                  ${careerBotMiniTrackerHTML(careerBotStatusOf(x.job))}
                </div>`).join('')}
            </div>`;
        }

        // ---- Manage subscription page ----
        function careerSubscriptionPageHTML(){
          const sub = careerStartProfile && careerStartProfile.subscription;
          const active = careerSubscriptionActive();
          const row = (label, value) => `<div class="flex items-center justify-between py-3" style="border-top:1px solid rgba(128,128,128,0.15);"><span class="text-sm text-gray-500">${label}</span><span class="text-sm font-semibold text-gray-800 text-right">${value}</span></div>`;
          let body, bottomBar = '';
          if (!sub) {
            body = `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm shadow-sm">You don't have a Stitch Bot subscription yet.</div>
              <button onclick="openCareerStartPlan(true)" class="w-full font-semibold text-sm py-3 rounded-full text-white mt-4" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">Choose a plan</button>`;
          } else {
            const plan = CAREER_PLANS[sub.plan] || CAREER_PLANS.monthly;
            const leftDays = Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / 86400000));
            const status = !active ? 'Ended' : (sub.cancelled ? 'Cancelled' : 'Active');
            const statusColor = !active ? '#ef4444' : (sub.cancelled ? '#b45309' : '#059669');
            const pct = (sub.startedAt && sub.expiresAt) ? Math.max(0, Math.min(100, Math.round((Date.now() - sub.startedAt) / (sub.expiresAt - sub.startedAt) * 100))) : 0;
            const ref = String(sub.reference || '');
            body = `
              <div class="bg-white rounded-3xl p-4 shadow-sm">
                <div class="flex items-center gap-3 mb-1">
                  <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('bot','w-5 h-5')}</div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-800">Stitch Bot · ${escapeHtml(plan.label)}</div>
                    <div class="text-xs font-semibold" style="color:${statusColor};">${status}</div>
                  </div>
                </div>
                ${active ? `<div style="margin:10px 0 4px;height:8px;border-radius:9999px;background:rgba(128,128,128,0.18);overflow:hidden;"><div style="height:100%;width:${pct}%;border-radius:9999px;background:linear-gradient(90deg, ${NAVY}, ${ROYAL});"></div></div><div class="text-xs text-gray-400" style="margin-bottom:6px;">${leftDays} day${leftDays === 1 ? '' : 's'} left</div>` : ''}
                ${row('Plan', escapeHtml(plan.label) + ' · GH₵' + (sub.amount != null ? sub.amount : plan.price) + ' per ' + plan.unit)}
                ${row('Started', escapeHtml(careerPlanDateLabel(sub.startedAt)))}
                ${row(!active ? 'Ended' : (sub.cancelled ? 'Access until' : 'Renews / ends'), escapeHtml(careerPlanDateLabel(sub.expiresAt)))}
                ${sub.cancelled && sub.cancelledAt ? row('Cancelled on', escapeHtml(careerPlanDateLabel(sub.cancelledAt))) : ''}
                ${ref && ref.indexOf('preview_') !== 0 ? row('Payment reference', escapeHtml(ref.length > 18 ? ref.slice(0, 18) + '…' : ref)) : ''}
              </div>
              ${careerSubscriptionAboutHTML(sub, active)}`;
            const needsSubscribe = (!active || sub.cancelled || careerSubscriptionExpiringSoon());
            const canCancel = active && !sub.cancelled;
            if (needsSubscribe || canCancel) {
              bottomBar = `
                <div class="w-full" style="padding-top:26px;padding-bottom:max(8px, env(safe-area-inset-bottom));">
                  <div class="max-w-2xl mx-auto flex flex-col gap-3">
                    ${needsSubscribe ? `<button onclick="careerSubscribeAgain()" class="pill-cta font-display w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">Update subscription</button>` : ''}
                    ${canCancel ? `<button onclick="cancelCareerSubscription()" class="font-display w-full inline-flex items-center justify-center font-semibold text-center rounded-full text-sm" style="background-image:linear-gradient(90deg,#ff3b30,#d4161f);background-color:#e11d28;color:#ffffff;border:none;padding:0.85rem 1.1rem;box-shadow:0 6px 16px rgba(212,22,31,0.30);">Cancel subscription</button>` : ''}
                  </div>
                </div>`;
            }
          }
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
              ${overlayHeader('Manage subscription', '20px', 'overlayGoBack()', null, { right: true })}
              <div class="px-5" style="padding-top:20px;">${body}${bottomBar}</div>
            </div>`;
        }
        // Plain-language explainer shown under the plan details.
        function careerSubscriptionAboutHTML(sub, active){
          const items = [
            ['Matches you to opportunities', 'Stitch Bot reads your CV and what you are looking for, then picks the posts that fit you best.'],
            ['Applies for you', 'It sends your CV, open application letter and any documents a post asks for. It only applies to posts inside Stitch, never to outside websites.'],
            ['Keeps watch', 'It tracks every application and tells you when a status changes, an interview is set or a deadline is close. Updates come in the app or by email, as you chose.'],
          ];
          const end = sub && sub.expiresAt ? careerPlanDateLabel(sub.expiresAt) : '';
          const foot = !active
            ? 'Your plan has ended, so matching and auto apply are paused until you subscribe again.'
            : (sub && sub.cancelled
              ? `You cancelled. Everything keeps working until ${end}, then matching and auto apply stop.`
              : `Your plan covers everything above until ${end}. If you cancel, you keep access until then.`);
          return `
            <div class="px-1" style="margin-top:22px;">
              <div class="text-sm font-semibold text-gray-800" style="margin-bottom:4px;">What this subscription is</div>
              <div class="text-xs text-gray-500" style="margin-bottom:10px;">Stitch Bot is your job-hunting assistant inside Stitch. This plan is what keeps it working for you.</div>
              ${items.map(it => `
                <div class="flex items-start gap-3" style="padding:8px 0;">
                  <span class="flex-shrink-0 flex items-center justify-center" style="width:24px;height:24px;border-radius:9999px;background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('check','w-3.5 h-3.5')}</span>
                  <div class="flex-1 min-w-0"><div class="text-sm font-semibold text-gray-800">${it[0]}</div><div class="text-xs text-gray-500">${it[1]}</div></div>
                </div>`).join('')}
              <div class="text-xs text-gray-400" style="margin-top:8px;">${foot}</div>
            </div>`;
        }

        // ---- Saved opportunities (bookmarks from the cards) ----
        function careerSavedPageHTML(){
          const saved = allExploreCards().filter(c => c.saved && !c.isCatalogCourse);
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
              ${overlayHeader('Saved', '20px', 'overlayGoBack()', null, { right: true })}
              <div class="px-5" style="padding-top:20px;">
                ${saved.length ? saved.map(jobCard).join('') : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm shadow-sm">Nothing saved yet. Tap the bookmark on a card to keep it here.</div>`}
              </div>
            </div>`;
        }

        // ---- Saved flags survive reloads (per signed-in user, on this device) ----
        function savedJobsStorageKey(){ return currentUserId ? `saved-jobs-v1:${currentUserId}` : null; }
        function readSavedJobIds(){
          try { const k = savedJobsStorageKey(); return new Set(k ? JSON.parse(localStorage.getItem(k) || '[]') : []); } catch (e) { return new Set(); }
        }
        function writeSavedJobIds(set){
          try { const k = savedJobsStorageKey(); if (k) localStorage.setItem(k, JSON.stringify([...set])); } catch (e) {}
        }
        function applySavedJobFlags(list){
          const ids = readSavedJobIds();
          if (ids.size) list.forEach(j => { if (ids.has(j.id)) j.saved = true; });
          return list;
        }
        function careerSubscriptionCardHTML(){
          const sub = careerStartProfile && careerStartProfile.subscription;
          if (!sub) return '';
          const plan = CAREER_PLANS[sub.plan] || CAREER_PLANS.monthly;
          const active = careerSubscriptionActive();
          const status = !active ? `Ended ${careerPlanDateLabel(sub.expiresAt)}` : (sub.cancelled ? `Cancelled · access until ${careerPlanDateLabel(sub.expiresAt)}` : `${plan.label} plan · paid through ${careerPlanDateLabel(sub.expiresAt)}`);
          return `
            <div class="px-1 mb-5">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('bot','w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-800">Match with CV subscription</div>
                  <div class="text-xs text-gray-400">${escapeHtml(status)}</div>
                </div>
                ${active && !sub.cancelled ? `<button onclick="cancelCareerSubscription()" class="text-xs font-semibold flex-shrink-0" style="color:#ef4444;">Cancel</button>` : ''}
              </div>
            </div>`;
        }
        function careerStartFormHTML(){
          const stepId = careerStartStepIds[careerStartStepIndex];
          if (stepId === 'intro1' || stepId === 'intro2') return careerStartIntroHTML(stepId);
          if (stepId === 'plan') return careerStartPlanHTML();
          const total = careerStartFormStepIds.length;
          const stepNum = careerStartFormStepIds.indexOf(stepId) + 1;
          const isLastStep = stepId === 'resume';
          const pct = Math.round((stepNum / total) * 100);
          const resumeBusy = isLastStep && careerStartResumeUploading;
          const nextBtnLabel = resumeBusy ? 'Fetching…' : (isLastStep ? 'Submit' : 'Next');
          const hint = careerStartStepHint(stepId);
          // Same background technique as "Apply to post" (posterApplicationOverlayHTML): a sibling
          // of the scrollable step area, not inside it, so it never scrolls or shifts as you move
          // between questions
          const bg = '';
          return `
            ${bg}
            <div id="career-start-stage-scroll" class="flex-1 overflow-y-auto">
            ${overlayHeader('Match with CV/Resume', '20px', 'careerStartBack()', null, {right:true, titleSize:'text-xl', titleClass:'career-flow-title', pb:'0px'})}
            <div class="w-full px-5" style="margin-top:10px;">
              <div class="max-w-2xl mx-auto">
                <div style="height:4px;border-radius:9999px;background:rgba(128,128,128,0.25);overflow:hidden;">
                  <div style="height:100%;width:${pct}%;border-radius:9999px;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);transition:width .25s ease;"></div>
                </div>
              </div>
            </div>
            <div class="px-5" style="padding-top:26px;padding-bottom:20px;">
              <div class="max-w-2xl mx-auto">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Step ${stepNum} of ${total}</div>
                <h2 class="text-2xl font-bold font-display grad-text" style="margin-bottom:6px;">${careerStartStepTitle(stepId)}</h2>
                <div class="text-sm text-gray-500">${careerStartStepSub(stepId)}</div>
                ${hint ? `<div class="text-xs text-gray-400" style="margin-top:6px;">${hint}</div>` : ''}
                <div id="career-start-step-body" style="margin-top:22px;">
                  ${careerStartStepBodyHTML()}
                </div>
              </div>
            </div>
            </div>
            <div class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(22px, env(safe-area-inset-bottom));">
              <div class="max-w-2xl mx-auto">
                <div id="career-start-stage-error" role="alert" style="display:none;color:#e11d48;font-size:12.5px;text-align:center;margin-bottom:10px;"></div>
                <div id="career-start-next-wrap" style="${careerStartStepReady() ? '' : 'display:none;'}">
                <button id="career-start-submit-btn" onclick="${resumeBusy ? '' : 'careerStartNext()'}" ${resumeBusy ? 'disabled' : ''} class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;${resumeBusy ? 'opacity:.6;' : ''}">${nextBtnLabel}</button>
                </div>
              </div>
            </div>`;
        }

        function openCareerMatchesPage(forceRecompute){
          if (careerStartProfile && !careerSubscriptionActive()) { openCareerStartIntro(); return; }
          careerMatchesError = '';
          careerBotCheckUpdates();
          openOverlay('careerMatches');
          if (!careerStartProfile) return;
          const hasCachedMatches = Array.isArray(careerStartProfile.matches) && careerStartProfile.matches.length;
          if (forceRecompute || !hasCachedMatches) refreshCareerMatches();
          else careerBotAutoApplyRun();
        }
        function notifyCareerContact(profile, { name, message, jobId, icon } = {}){
          if (!profile) return;
          if (profile.contactMethod === 'email') {
            if (typeof sendEmailNotification === 'function') {
              sendEmailNotification({ subject: name || 'Stitch Career Space', title: name || 'Stitch', body: message || '' });
            }
          } else if (typeof addNotif === 'function') {
            addNotif({ type: 'info', icon: icon || 'briefcase', iconBg: 'bg-blue-50', iconClass: 'text-blue-600', name: name || 'Career Space', message: message || '', jobId: jobId || null, route: 'careerMatches' });
          }
        }
        function rerenderCareerMatches(keepScroll){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const pages = { careerMatches: careerMatchesHTML, careerAutoApply: careerAutoApplyHTML, careerSubscription: careerSubscriptionPageHTML, careerSaved: careerSavedPageHTML, careerDocuments: careerDocumentsHTML, careerNotifications: careerNotificationsHTML, careerPreferences: careerPreferencesHTML, careerCancelReason: careerCancelReasonHTML, careerCancelDetail: careerCancelDetailHTML };
          const build = pages[currentOverlayKind];
          if (!build) return;
          const sc = ov.querySelector('.overflow-y-auto');
          const top = sc ? sc.scrollTop : 0;
          ov.innerHTML = build();
          if (top) { const sc2 = ov.querySelector('.overflow-y-auto'); if (sc2) sc2.scrollTop = top; }
        }
        async function refreshCareerMatches(){
          if (!careerStartProfile) return;
          careerMatchesLoading = true;
          careerMatchesError = '';
          rerenderCareerMatches(true);
          const minSpin = new Promise(resolve => setTimeout(resolve, 1100));
          const hadMatchesBefore = careerStartProfile.matchesUpdatedAt;
          const previousMatchIds = new Set((careerStartProfile.matches || []).map(m => m.id));
          try {
            const result = await computeCareerMatches(careerStartProfile);
            careerStartProfile.matches = result.matches.map(m => ({ id: m.job.id, score: m.score, reason: m.reason }));
            careerStartProfile.priorityId = result.priority ? result.priority.job.id : '';
            careerStartProfile.priorityReason = result.priority ? result.priority.reason : '';
            careerStartProfile.matchesUpdatedAt = Date.now();
            if (hadMatchesBefore) {
              const newCount = careerStartProfile.matches.filter(m => !previousMatchIds.has(m.id)).length;
              if (newCount > 0) {
                notifyCareerContact(careerStartProfile, {
                  name: 'New matches found',
                  message: `We found ${newCount} new opportunit${newCount === 1 ? 'y' : 'ies'} matching your Career Space profile.`,
                  icon: 'briefcase',
                });
              }
            }
            if (planHasCvAI() && !planHasCvRecommendations()) {
              careerStartProfile.resumeAIFeedback = await computeResumeAIFeedback(careerStartProfile);
            } else {
              careerStartProfile.resumeAIFeedback = '';
            }
            saveCareerStartProfile();
          } catch (e) {
            console.warn('Could not compute career matches:', e);
            careerMatchesError = (e && e.code === 'subscription_required')
              ? 'Your Stitch Bot subscription has ended. Renew to keep getting AI matches.'
              : "We couldn't refresh your matches -- check your connection and try again.";
          } finally {
            await minSpin;
            careerMatchesLoading = false;
            rerenderCareerMatches(true);
          }
          careerBotAutoApplyRun();
        }
        function handleCareerProfileResumeReplace(event){
          const file = event.target.files && event.target.files[0];
          if (!file || !careerStartProfile) { event.target.value = ''; return; }
          if (!validateOrRejectFile(event.target, file, 'resume')) return;
          event.target.value = '';
          careerStartProfile.resumeFileName = file.name;
          careerMatchesLoading = true;
          rerenderCareerMatches();
          Promise.all([extractCareerStartResumeText(file), fileToDataUrl(file)]).then(([text, dataUrl]) => {
            careerStartProfile.resumeText = text;
            careerStartProfile.resumeDataUrl = dataUrl; 
            saveCareerStartProfile();
            markCareerStartPillDismissed();
            refreshCareerMatches();
          });
          if (typeof uploadResumeFileToStorage === 'function') {
            uploadResumeFileToStorage(file).then(url => {
              if (url && careerStartProfile && careerStartProfile.resumeFileName === file.name) {
                careerStartProfile.resumeDataUrl = url;
                saveCareerStartProfile();
              }
            });
          }
        }
        function deleteCareerProfileResume(){
          if (!careerStartProfile || !careerStartProfile.resumeFileName) return;
          openAppConfirmModal('Delete this resume?', "This removes it from your Career Profile. A resume is required for Stitch Bot to match and apply for you, so remember to attach a new one.", 'Delete', function(){
            careerStartProfile.resumeFileName = '';
            careerStartProfile.resumeText = '';
            careerStartProfile.resumeDataUrl = '';
            saveCareerStartProfile();
            if (typeof deleteResumeFileFromStorage === 'function') deleteResumeFileFromStorage();
            rerenderCareerMatches();
            refreshCareerMatches();
          });
        }

        function careerProfileFiltersSummary(p){
          const interestLabels = careerInterestOptions.filter(o => (p.interests || []).includes(o.id)).map(o => o.label);
          const levelLabel = (careerExperienceLevels.find(l => l.id === p.experienceLevel) || {}).label || '';
          const eduLabel = (careerEducationLevels.find(l => l.id === p.education) || {}).label || '';
          const styleLabel = (careerWorkStyles.find(w => w.id === p.workStyle) || {}).label || '';
          const genderLabel = (careerGenders.find(g => g.id === p.gender) || {}).label || '';
          return { interestLabels, levelLabel, eduLabel, styleLabel, genderLabel };
        }
        // A listing can be open to everyone ('any'/unset), men only, or women only
        function careerGenderCompatible(profile, job){
          const need = job && job.gender;
          if (!need || need === 'any') return true;
          const g = profile && profile.gender;
          if (g !== 'male' && g !== 'female') return true;
          return g === need;
        }
        function planHasCvRecommendations(){
          return true;
        }
        function planHasCvAI(){
          return true;
        }
        async function computeCareerMatches(profile){
          const jobs = allExploreCards().filter(j => careerGenderCompatible(profile, j));
          if (!jobs.length) return { matches: [], priority: null };
          if (!planHasCvRecommendations()) return computeCareerMatchesLocal(profile, jobs);
          try {
            const aiResult = await computeCareerMatchesAI(profile, jobs);
            if (aiResult.matches.length) return aiResult;
            return computeCareerMatchesLocal(profile, jobs);
          } catch (e) {
            if (e && e.code === 'subscription_required') throw e;
            console.warn('AI opportunity matching failed, falling back to local scoring:', e);
            return computeCareerMatchesLocal(profile, jobs);
          }
        }

        async function computeResumeAIFeedback(profile){
          if (!profile || !profile.resumeText || !profile.resumeText.trim()) return '';
          const { interestLabels } = careerProfileFiltersSummary(profile);
          try {
            const raw = await callCareerAI('feedback', { interestLabels, resumeText: (profile.resumeText || '').slice(0, 8000) });
            return String(raw || '').trim();
          } catch (e) {
            if (e && e.code === 'subscription_required') throw e;
            console.warn('Resume AI feedback failed:', e);
            return '';
          }
        }
        // ---- What Stitch Bot's AI gets to work with: the CV, every uploaded document (as text) and
        // the person's location and preferences. The ID document is never sent to the AI. ----
        const CAREER_AI_DOC_LABELS = { openLetter: 'Open application letter', transcript: 'Academic transcript', portfolio: 'Portfolio', degree: 'Degree or diploma', writingSample: 'Writing sample', certificate: 'Certificates', reference: 'Reference letter', license: 'Licence or registration', otherDocument: 'Other documents' };
        function careerBotDocDigest(perDoc, total){
          const p = careerBotEnsure(); if (!p) return [];
          const out = []; let used = 0;
          Object.keys(CAREER_AI_DOC_LABELS).forEach(id => {
            careerBotDocList(id).forEach(d => {
              if (used >= total) return;
              const text = String(d.text || '').replace(/\s+/g, ' ').trim().slice(0, Math.min(perDoc, total - used));
              used += text.length;
              out.push({ type: CAREER_AI_DOC_LABELS[id], fileName: d.fileName || '', excerpt: text });
            });
          });
          return out;
        }
        function careerBotAIContext(p){
          const loc = (p.botContact && p.botContact.location) || careerJoinLocation(p.city, p.country) || careerKnownLocation();
          const parts = careerSplitLocation(loc);
          const prefs = careerBotPrefs();
          return {
            location: loc, city: p.city || parts.city, country: p.country || parts.country,
            documentTypesOnHand: ['CV'].concat(Object.keys(CAREER_AI_DOC_LABELS).filter(id => careerBotDocList(id).length).map(id => CAREER_AI_DOC_LABELS[id])),
            documents: careerBotDocDigest(1200, 6000),
            candidateNotes: prefs.notes || '',
          };
        }
        const CAREER_AI_MATCH_RULES = [
          'You are Stitch Bot, a careful career matcher. Judge fit only from evidence in the CV and uploaded documents (degrees, certificates, references, transcript, portfolio, writing sample) and the candidate profile.',
          'Weigh skills, experience level, education, field, and the kind of opportunity the person wants. Prefer opportunities in the candidate\'s country or those that are remote/online.',
          'Do not recommend posts whose "openTo" excludes the candidate, and treat a missing required document as a reason to lower the rank but still mention it.',
          'Scores are honest 0-100 fit scores; do not inflate. Each reason is one plain sentence naming the specific CV or document evidence that supports the match.',
        ].join(' ');
        const CAREER_AI_WRITING_RULES = [
          'Write as the candidate in the first person, using only facts found in their CV and documents. Never invent employers, degrees, dates or skills.',
          'Match the post: name the role and organisation, connect two or three concrete strengths from the CV or documents to what the post asks for, and keep it honest and natural.',
          'Respect the requested tone and any instructions from the candidate. No placeholders, no brackets, no subject line.',
        ].join(' ');

        async function computeCareerMatchesAI(profile, jobs){
          const { interestLabels, levelLabel, eduLabel, styleLabel } = careerProfileFiltersSummary(profile);
          const ctx = careerBotAIContext(profile);
          // Send the 60 posts that already look closest to this person, not just the newest 60
          const ranked = jobs.map(j => ({ j, sc: careerScoreJob(profile, j, ctx) })).sort((a, b) => b.sc - a.sc).slice(0, 60).map(x => x.j);
          const listing = ranked.map(j => {
            const missing = careerBotMissingFor(j);
            return {
              id: j.id,
              type: j.type,
              title: j.title,
              org: j.org || j.sub || '',
              mode: j.mode || '',
              location: j.location || j.place || '',
              duration: j.duration || '',
              deadline: j.deadlineDate || '',
              pay: j.priceType === 'paid' ? (j.price || 'paid') : 'free',
              requiredDocuments: ['Resume / CV'].concat((j.requiredDocs || []).filter(id => id !== 'resume').map(id => (OPP_DOC_TYPES.find(t => t.id === id) || {}).label || id)),
              missingDocuments: missing,
              openTo: j.gender === 'male' ? 'men only' : j.gender === 'female' ? 'women only' : 'everyone',
              description: (j.description || '').slice(0, 900),
            };
          });
          const raw = await callCareerAI('match', {
            instructions: CAREER_AI_MATCH_RULES,
            profile: {
              interestLabels,
              jobTitle: profile.jobTitle || '',
              levelLabel, eduLabel, styleLabel,
              age: profile.age || '',
              genderLabel: (careerGenders.find(g => g.id === profile.gender) || {}).label || '',
              location: ctx.location, city: ctx.city, country: ctx.country,
              documentTypesOnHand: ctx.documentTypesOnHand,
              documents: ctx.documents,
              candidateNotes: ctx.candidateNotes,
              resumeText: (profile.resumeText || '').slice(0, 9000),
            },
            jobs: listing,
          });
          const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(cleaned);
          const byId = new Map(jobs.map(j => [String(j.id), j]));
          const matches = (parsed.matches || [])
            .map(m => ({ job: byId.get(String(m.id)), score: Math.max(0, Math.min(100, Number(m.score) || 0)), reason: String(m.reason || '').trim() }))
            .filter(m => m.job)
            .sort((a, b) => b.score - a.score)
            .slice(0, 12);
          let priority = null;
          if (parsed.priority && parsed.priority.id) {
            const pJob = byId.get(String(parsed.priority.id));
            if (pJob && matches.some(m => m.job.id === pJob.id)) {
              priority = { job: pJob, reason: String(parsed.priority.reason || '').trim() };
            }
          }
          if (!priority && matches.length) priority = { job: matches[0].job, reason: matches[0].reason || 'Your strongest match right now -- worth applying to first.' };
          return { matches, priority };
        }
        const CAREER_STOPWORDS = new Set(['and','the','for','with','you','your','are','from','this','that','have','has','will','was','were','our','their','into','using','use','who','all','any','not','can','able','job','work','role','team','looking']);
        // ---- Local (client-side) career match scoring ----
        function careerTokenize(text){
          return (text || '').toLowerCase().match(/[a-z0-9+#]{3,}/g) || [];
        }
        // One post's local score (0-100): CV/document keyword overlap, title, type, work style, gender
        // and country. Also used to pick which posts are worth sending to the AI.
        function careerScoreJob(profile, job, ctx){
          const { styleLabel } = careerProfileFiltersSummary(profile);
          if (!profile._tokCache || profile._tokCacheKey !== (profile.resumeText || '').length + ':' + (ctx ? ctx.documents.length : 0)) {
            const docText = ctx ? ctx.documents.map(d => d.excerpt).join(' ') : '';
            const toks = careerTokenize([profile.resumeText, profile.jobTitle, docText].filter(Boolean).join(' ')).filter(t => !CAREER_STOPWORDS.has(t));
            Object.defineProperty(profile, '_tokCache', { value: new Set(toks), enumerable: false, writable: true, configurable: true });
            Object.defineProperty(profile, '_tokCacheKey', { value: (profile.resumeText || '').length + ':' + (ctx ? ctx.documents.length : 0), enumerable: false, writable: true, configurable: true });
          }
          const resumeSet = profile._tokCache;
          const wantsTypes = new Set();
          if ((profile.interests || []).includes('jobs')) wantsTypes.add('Job');
          if ((profile.interests || []).includes('internships')) wantsTypes.add('Internship');
          if ((profile.interests || []).includes('scholarships')) wantsTypes.add('Scholarship');
          if ((profile.interests || []).includes('volunteering')) wantsTypes.add('Other');
          if ((profile.interests || []).includes('courses')) wantsTypes.add('Course');
          const jobTokens = careerTokenize([job.title, job.org, job.sub, job.description].filter(Boolean).join(' '));
          let overlap = 0;
          new Set(jobTokens).forEach(t => { if (resumeSet.has(t)) overlap++; });
          let score = Math.min(70, overlap * 6);
          if (profile.jobTitle && profile.jobTitle.trim() && (job.title || '').toLowerCase().includes(profile.jobTitle.trim().toLowerCase())) score += 20;
          if (wantsTypes.size && wantsTypes.has(job.type)) score += 15;
          if (styleLabel && job.mode && job.mode.toLowerCase() === styleLabel.toLowerCase()) score += 10;
          if (styleLabel === 'No preference') score += 3;
          if ((job.gender === 'male' || job.gender === 'female') && job.gender === profile.gender) score += 5;
          // Same country, or can be done from anywhere
          const country = ((ctx && ctx.country) || profile.country || '').toLowerCase();
          const where = String([job.location, job.place, job.mode].filter(Boolean).join(' ')).toLowerCase();
          if (country && where.indexOf(country) !== -1) score += 8;
          else if (/online|remote/.test(where)) score += 4;
          return Math.max(0, Math.min(100, score));
        }
        function computeCareerMatchesLocal(profile, jobs){
          const ctx = careerBotAIContext(profile);
          let scored = jobs.map(job => ({ job, score: careerScoreJob(profile, job, ctx) })).filter(m => m.score > 0);

          if (!scored.length) {
            scored = jobs.slice(0, 5).map(job => ({ job, score: 0 }));
            return { matches: scored.map(m => ({ job: m.job, score: m.score, reason: 'Recently posted on Career Space.' })), priority: null };
          }
          const matches = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 12)
            .map(m => ({ job: m.job, score: m.score, reason: careerLocalMatchReason(profile) }));
          const priority = matches.length ? { job: matches[0].job, reason: `Your highest-scoring match (${Math.round(matches[0].score)}% fit) -- start here.` } : null;
          return { matches, priority };
        }
        function careerLocalMatchReason(profile){
          if (profile.resumeText && profile.resumeText.trim()) return 'Matches skills and keywords from your resume.';
          if (profile.jobTitle && profile.jobTitle.trim()) return `Matches your search for "${escapeHtml(profile.jobTitle.trim())}".`;
          return 'Matches the filters from your Career Space quiz.';
        }

        function careerMatchFilterChip(label){
          return `<span class="career-filter-chip" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
        }
        function careerMatchReasonHTML(m, isPriority){
          return `
            <div class="-mt-2.5 mb-4 px-1">
              <div class="text-xs font-bold" style="color:${NAVY};">${Math.round(m.score)}% match</div>
              <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(m.reason || '')}</div>
            </div>`;
        }
        function careerPriorityCalloutHTML(p){
          if (!p || !p.job) return '';
          return `
            <div onclick="${p.job.isCatalogCourse ? `openCourseDetail('${p.job.id}')` : `openJobOrClassroom('${p.job.id}')`}" class="rounded-3xl p-4 mb-5 cursor-pointer" style="background:linear-gradient(135deg, rgba(10,37,64,0.06), rgba(30,144,255,0.10));border:1.5px solid rgba(10,37,64,0.14);">
              <div class="mb-1.5">
                <div class="text-xs font-bold uppercase tracking-wide" style="color:${NAVY};">AI recommends prioritizing this</div>
              </div>
              <div class="text-sm font-semibold text-gray-800 mb-1">${escapeHtml(p.job.title)}</div>
              <div class="text-xs text-gray-600">${escapeHtml(p.reason || '')}</div>
            </div>`;
        }
        // ---- Stitch Bot: documents vault, applying, updates and progress graph ----
        const CAREER_BOT_DOC_SLOTS = [
          { id: 'openLetter', label: 'Open application letter', hint: 'A general letter Stitch Bot sends as your application / cover letter.' },
          { id: 'transcript', label: 'Academic transcript', hint: 'Sent when a post asks for it.' },
          { id: 'portfolio', label: 'Portfolio', hint: 'Sent when a post asks for it.' },
          { id: 'idDocument', label: 'ID document', hint: 'Only sent when a post requires it.' },
          { id: 'degree', label: 'Degree or diploma', hint: 'Sent when a post asks for proof of your qualification.' },
          { id: 'writingSample', label: 'Writing sample', hint: 'Sent when a post asks for work samples.' },
          { id: 'certificate', label: 'Certificates', hint: 'Attached to your applications as extra documents.', extra: true },
          { id: 'reference', label: 'Reference letter', hint: 'Attached to your applications as extra documents.', extra: true },
          { id: 'license', label: 'Licence or registration', hint: 'Professional licence, membership or registration. Attached as an extra document.', extra: true },
          { id: 'otherDocument', label: 'Other documents', hint: 'Anything else you want sent with your applications.', extra: true },
        ];
        function careerBotEnsure(){
          const p = careerStartProfile;
          if (!p) return null;
          if (!p.botDocs) p.botDocs = {};
          if (!p.botContact) p.botContact = { phone: p.phone || '', location: '' };
          if (!String(p.botContact.location || '').trim()) {
            const known = careerJoinLocation(p.city, p.country) || careerKnownLocation();
            if (known) p.botContact.location = known;
          }
          if (!p.botLog) p.botLog = [];
          if (!p.botSeen) p.botSeen = {};
          return p;
        }
        function careerBotLog(text, jobId, notify, kind){
          const p = careerBotEnsure(); if (!p) return;
          p.botLog.unshift({ ts: Date.now(), text, jobId: jobId || '' });
          p.botLog = p.botLog.slice(0, 30);
          if (notify && careerBotNotifPrefs()[kind || 'applications'] !== false) notifyCareerContact(p, { name: 'Stitch Bot', message: text, jobId: jobId || null, icon: 'bot' });
        }
        let careerBotBusy = false;
        let careerBotDocBusy = '';
        const CAREER_BOT_MAX_FILES = 5; // per document section
        // Every section holds a list of files
        function careerBotDocList(docId){
          const p = careerBotEnsure(); if (!p) return [];
          const v = p.botDocs[docId];
          return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
        }
        async function handleCareerBotDoc(event, docId){
          const input = event.target;
          const files = Array.from(input.files || []);
          const p = careerBotEnsure();
          if (!files.length || !p) { input.value = ''; return; }
          const profileKey = docId === 'idDocument' ? 'idDoc' : 'coverLetter';
          const accepted = []; let firstProblem = ''; let rejected = 0;
          files.forEach(f => {
            const r = validateSelectedFile(f, profileKey);
            if (r.ok) accepted.push(f); else { rejected++; if (!firstProblem) firstProblem = r.message; }
          });
          input.value = '';
          const room = Math.max(0, CAREER_BOT_MAX_FILES - careerBotDocList(docId).length);
          const toStore = accepted.slice(0, room);
          if (rejected) openAppAlertModal(`${rejected} file${rejected === 1 ? ' was' : 's were'} not added. ${firstProblem}`, 'File not accepted');
          else if (accepted.length > room) openAppAlertModal(`Each section holds up to ${CAREER_BOT_MAX_FILES} files. Added ${toStore.length}.`, 'Limit reached');
          if (toStore.length) await careerBotStoreDocs(docId, toStore, '');
        }
        async function careerBotStoreDoc(docId, file, text){ return careerBotStoreDocs(docId, [file], text); }
        // Never let a stalled step (PDF worker, slow storage) leave an upload hanging on "Saving…"
        function careerWithTimeout(promise, ms, fallback){
          return new Promise(resolve => {
            let done = false;
            const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
            Promise.resolve(promise).then(v => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
                                          () => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
          });
        }
        function careerDataUrlToFile(dataUrl, name){
          try {
            const m = String(dataUrl).match(/^data:([^;,]*)(;base64)?,(.*)$/);
            if (!m) return null;
            const bin = atob(m[3]); const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new File([arr], name || 'document', { type: m[1] || careerMimeFor(name) });
          } catch (e) { return null; }
        }
        async function careerBotStoreDocs(docId, files, text){
          const p = careerBotEnsure(); if (!p) return;
          careerBotDocBusy = docId; rerenderCareerMatches(true);
          let saved = 0, failed = 0;
          try {
            let uid = null;
            try { uid = await careerWithTimeout(getCurrentUserId(), 8000, null); } catch (e) {}
            const list = careerBotDocList(docId).slice();
            for (const file of files) {
              try {
                const canUpload = !!(uid && typeof uploadApplicationDocumentToStorage === 'function');
                const [extracted, url] = await Promise.all([
                  text ? Promise.resolve(text) : careerWithTimeout(extractCareerStartResumeText(file), 10000, ''),
                  canUpload ? careerWithTimeout(uploadApplicationDocumentToStorage(file, 'career-profile', uid, docId), 30000, null) : Promise.resolve(null),
                ]);
                const rec = { fileName: file.name, url: url || '', text: String(extracted || '').slice(0, 6000), addedAt: Date.now() };
                // Storage unavailable: keep the file itself so it is never lost, and re-upload it when sending
                if (!rec.url) rec.dataUrl = await fileToDataUrl(file);
                const dup = list.findIndex(d => d.fileName === rec.fileName);
                if (dup >= 0) list[dup] = rec; else list.push(rec);
                saved++;
              } catch (e) { console.warn('Document not saved:', file && file.name, e); failed++; }
            }
            if (saved) {
              p.botDocs[docId] = list.slice(0, CAREER_BOT_MAX_FILES);
              await saveCareerStartProfile();
            }
          } catch (e) { failed = failed || 1; }
          careerBotDocBusy = ''; rerenderCareerMatches(true);
          if (failed) openAppAlertModal(saved ? `${failed} file${failed === 1 ? '' : 's'} couldn't be saved. The others were added.` : "We couldn't save that document. Check your connection and try again.", 'Upload failed');
        }
        // Before sending, copy every attached document under THIS listing's folder
        // (application-documents/<jobId>/<uid>/...). Storage only lets the poster open files in
        // their own listing's folder, so files left under career-profile/ would arrive unreadable.
        async function careerBotEnsureHosted(recs, jobId){
          let uid = null;
          try { uid = await careerWithTimeout(getCurrentUserId(), 8000, null); } catch (e) {}
          if (!uid || !jobId || typeof uploadApplicationDocumentToStorage !== 'function') return;
          for (const r of recs) {
            if (!r) continue;
            try {
              let f = null;
              if (r.dataUrl) f = careerDataUrlToFile(r.dataUrl, r.fileName);
              else if (r.url) {
                let href = r.url;
                try {
                  const rm = String(r.url).match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/resume-files\/([^?#]+)/);
                  const sb = getSupabaseClient();
                  if (rm && sb) { const { data: sd } = await sb.storage.from('resume-files').createSignedUrl(decodeURIComponent(rm[1]), 600); if (sd && sd.signedUrl) href = sd.signedUrl; }
                  else { const sgn = await getApplicationDocumentSignedUrl(r.url); if (sgn) href = sgn; }
                } catch (e) {}
                const blob = await careerWithTimeout(fetch(href).then(x => x.ok ? x.blob() : null), 30000, null);
                if (blob) f = new File([blob], r.fileName || 'document', { type: blob.type || careerMimeFor(r.fileName) });
              }
              if (!f) continue;
              const url = await careerWithTimeout(uploadApplicationDocumentToStorage(f, jobId, uid, 'sent'), 30000, null);
              if (url) { r.url = url; delete r.dataUrl; }
            } catch (e) { console.warn('Could not attach document to listing:', r && r.fileName, e); }
          }
        }
        function removeCareerBotDoc(docId, idx){
          const p = careerBotEnsure(); if (!p) return;
          const list = careerBotDocList(docId).slice();
          list.splice(idx || 0, 1);
          if (list.length) p.botDocs[docId] = list; else delete p.botDocs[docId];
          saveCareerStartProfile(); rerenderCareerMatches(true);
        }
        async function careerBotOpenDoc(docId, idx){
          const d = careerBotDocList(docId)[idx || 0]; if (!d) return;
          let href = d.dataUrl || d.url; if (!href) return;
          const w = window.open('', '_blank');
          try { if (d.url && typeof getApplicationDocumentSignedUrl === 'function') { const s = await getApplicationDocumentSignedUrl(d.url); if (s) href = s; } } catch (e) {}
          if (w) w.location.href = href; else window.location.href = href;
        }
        function updateCareerBotContact(field, value){
          const p = careerBotEnsure(); if (!p) return;
          if (field === 'phone') return setCareerBotPhone(value);
          p.botContact[field] = value;
          saveCareerStartProfile();
        }
        function setCareerBotPhone(value){
          const p = careerBotEnsure(); if (!p) return;
          const r = normalizeIntlPhone(value);
          if (!r.ok) { openAppAlertModal(r.error); return; }
          p.botContact.phone = r.display; p.phone = r.display;
          saveCareerStartProfile();
          rerenderCareerMatches();
        }
        async function draftCareerOpenLetter(){
          const p = careerBotEnsure(); if (!p) return;
          if (!p.resumeText || !p.resumeText.trim()) { openAppAlertModal('Attach your CV first so Stitch Bot can write the letter from it.'); return; }
          careerBotDocBusy = 'openLetter'; rerenderCareerMatches();
          try {
            const { interestLabels } = careerProfileFiltersSummary(p);
            const ctx = careerBotAIContext(p);
            const letter = String(await callCareerAI('letter', {
              instructions: CAREER_AI_WRITING_RULES + ' This is a general open application letter, not tied to one post.',
              fullName: p.fullName, interestLabels, jobTitle: p.jobTitle || '', location: ctx.location,
              tone: careerBotPrefs().tone, candidateNotes: ctx.candidateNotes,
              documents: ctx.documents.filter(d => d.type !== 'Open application letter'),
              resumeText: p.resumeText.slice(0, 8000),
            }) || '').trim();
            if (!letter) throw new Error('empty');
            const file = new File([letter], 'Open-application-letter.txt', { type: 'text/plain' });
            await careerBotStoreDoc('openLetter', file, letter);
          } catch (e) {
            careerBotDocBusy = ''; rerenderCareerMatches();
            openAppAlertModal(e && e.code === 'subscription_required'
              ? 'Your Stitch Bot subscription has ended. Renew to draft letters with Stitch Bot, or upload your own.'
              : "We couldn't draft the letter right now. Try again, or upload your own.");
          }
        }
        // The vault entry that satisfies a post's required document id (or null).
        function careerBotDocFor(docId){
          const p = careerBotEnsure(); if (!p) return null;
          if (docId === 'resume') return p.resumeFileName ? { fileName: p.resumeFileName, url: p.resumeDataUrl || '' } : null;
          if (docId === 'applicationLetter' || docId === 'coverLetter') return careerBotDocList('openLetter')[0] || null;
          return careerBotDocList(docId)[0] || null;
        }
        function careerBotMissingFor(job){
          const needed = ['resume'].concat((job.requiredDocs || []).filter(id => id !== 'resume'));
          return needed.filter(id => !careerBotDocFor(id)).map(id => (OPP_DOC_TYPES.find(t => t.id === id) || {}).label || id);
        }
        function careerBotCanApply(job){
          return job && job.type !== 'Course' && !(job.applyMethod === 'website' && job.website) && !isJobApplied(job);
        }
        function careerBotRec(d){
          const u = d.dataUrl || d.url || '';
          return u.indexOf('data:') === 0 ? { fileName: d.fileName, url: '', path: '', dataUrl: u } : { fileName: d.fileName, url: u, path: '' };
        }
        async function careerBotCoverNote(job, p){
          const letter = (careerBotDocList('openLetter').find(d => d.text) || {}).text || '';
          try {
            const ctx = careerBotAIContext(p);
            return String(await callCareerAI('cover_note', {
              fullName: p.fullName, title: job.title, org: job.org || '', type: job.type || '',
              location: ctx.location, jobLocation: job.location || job.place || '', mode: job.mode || '',
              requiredDocuments: (job.requiredDocs || []).map(id => (OPP_DOC_TYPES.find(t => t.id === id) || {}).label || id),
              description: (job.description || '').slice(0, 1500), tone: careerBotPrefs().tone,
              // Writing rules first, then anything the person asked for in Preferences
              instructions: CAREER_AI_WRITING_RULES + (careerBotPrefs().notes ? ' The candidate also asks: ' + careerBotPrefs().notes : ''),
              candidateNotes: careerBotPrefs().notes || '',
              documents: ctx.documents.filter(d => d.type !== 'Open application letter'),
              resumeText: (p.resumeText || '').slice(0, 6000), letterText: letter.slice(0, 2500),
            }) || '').trim();
          } catch (e) {
            if (e && e.code === 'subscription_required') throw e; // lapsed: stop, don't paper over it
            return letter.slice(0, 500);
          }
        }
        // Returns '' on success, otherwise a short reason.
        async function careerBotApplyOne(jobId, by){
          const p = careerBotEnsure(); const job = findJob(jobId);
          if (!p || !job) return 'Listing unavailable.';
          if (!careerSubscriptionActive()) return 'Your Stitch Bot subscription has ended.';
          if (!careerBotCanApply(job)) return job.applyMethod === 'website' ? 'Applies on an outside website.' : 'Not open to in-app applying.';
          const missing = careerBotMissingFor(job);
          if (missing.length) return 'Needs: ' + missing.join(', ');
          const botPhone = normalizeIntlPhone(p.botContact.phone || p.phone);
          if (!botPhone.ok) return 'Add your phone number with its country code under Auto apply.';
          const botLocation = (p.botContact.location || '').trim();
          if (!botLocation) return 'Add your city and country under Documents so applications carry your location.';
          resetJobApplyDraft();
          const d = jobApplyDraft;
          d.fullName = p.fullName; d.email = p.email; d.phone = botPhone.display; d.location = botLocation;
          const prefs = careerBotPrefs();
          try {
            const openLetterText = (careerBotDocList('openLetter').find(x => x.text) || {}).text || '';
            d.letterText = (prefs.coverNote === 'letter' && openLetterText) ? openLetterText.slice(0, 2000) : await careerBotCoverNote(job, p);
          }
          catch (e) { resetJobApplyDraft(); return 'Your Stitch Bot subscription has ended.'; }
          const documents = {};
          const resume = careerBotDocFor('resume'); if (resume) documents.resume = careerBotRec(resume);
          const additionalDocuments = [];
          const letters = careerBotDocList('openLetter');
          const needsLetter = (job.requiredDocs || []).some(id => id === 'coverLetter' || id === 'applicationLetter');
          if (letters.length && (prefs.letter === 'always' || needsLetter)) {
            const rec = careerBotRec(letters[0]); documents.applicationLetter = rec;
            if ((job.requiredDocs || []).includes('coverLetter')) documents.coverLetter = rec;
            letters.slice(1).forEach(d => additionalDocuments.push(careerBotRec(d)));
          }
          // The first file in a section answers the post's request
          (job.requiredDocs || []).forEach(id => {
            if (documents[id]) return;
            const list = careerBotDocList(id);
            if (list.length) { documents[id] = careerBotRec(list[0]); list.slice(1).forEach(d => additionalDocuments.push(careerBotRec(d))); }
          });
          if (prefs.extras === 'all') CAREER_BOT_DOC_SLOTS.filter(sl => sl.extra).forEach(sl => careerBotDocList(sl.id).forEach(d => additionalDocuments.push(careerBotRec(d))));
          // Degree and writing sample are not on the poster's checklist, so send them when the
          // all-in preference is on or the post's own text asks for them
          const postText = [job.title, job.description].filter(Boolean).join(' ').toLowerCase();
          const wantsDegree = /degree|diploma|qualification|bachelor|master'?s|certificat/.test(postText);
          const wantsSample = /writing sample|work sample|samples? of (your )?(work|writing)|portfolio of writing/.test(postText);
          if (prefs.extras === 'all' || wantsDegree) careerBotDocList('degree').forEach(d => additionalDocuments.push(careerBotRec(d)));
          if (prefs.extras === 'all' || wantsSample) careerBotDocList('writingSample').forEach(d => additionalDocuments.push(careerBotRec(d)));
          if (prefs.extras !== 'all') CAREER_BOT_DOC_SLOTS.filter(sl => sl.extra).forEach(sl => { if (sl.id === 'certificate' && wantsDegree) careerBotDocList(sl.id).forEach(d => additionalDocuments.push(careerBotRec(d))); });
          try { await careerBotEnsureHosted(Array.from(new Set(Object.values(documents).concat(additionalDocuments))), job.id); } catch (e) {}
          finalizeJobApplication(job.id, { documents, additionalDocuments });
          resetJobApplyDraft();
          p.botSeen[job.id] = 'applied';
          if (!p.botApplied) p.botApplied = {};
          const mScore = ((p.matches || []).find(m => m.id === job.id) || {}).score;
          // Remember what was actually sent, so the Applied list can show it
          const sentLabels = Object.keys(documents).map(id => id === 'resume' ? 'CV' : ((OPP_DOC_TYPES.find(t => t.id === id) || {}).label || id)).filter((l, i, a) => a.indexOf(l) === i && !(l === 'Cover letter' && a.indexOf('Application letter') !== -1));
          if (additionalDocuments.length) sentLabels.push(`${additionalDocuments.length} extra document${additionalDocuments.length === 1 ? '' : 's'}`);
          p.botApplied[job.id] = { ts: Date.now(), by: by === 'auto' ? 'auto' : 'manual', score: typeof mScore === 'number' ? mScore : null, sent: sentLabels };
          careerBotLog(`Applied to "${job.title}" for you.`, job.id, true);
          saveCareerStartProfile();
          return '';
        }
        async function careerBotApplyClick(jobId){
          if (careerBotBusy) return;
          careerBotBusy = true; rerenderCareerMatches();
          const why = await careerBotApplyOne(jobId, 'manual');
          careerBotBusy = false; rerenderCareerMatches(true);
          if (why) openAppAlertModal(why, 'Stitch Bot could not apply');
        }
        function careerBotApplyAll(){
          const p = careerBotEnsure(); if (!p || careerBotBusy) return;
          const ids = (p.matches || []).map(m => m.id).filter(id => { const j = findJob(id); return j && careerBotCanApply(j) && !careerBotMissingFor(j).length; });
          if (!ids.length) { openAppAlertModal('No matches are ready yet. Add the documents they ask for under Auto apply.'); return; }
          openAppConfirmModal('Apply to ' + ids.length + ' match' + (ids.length === 1 ? '' : 'es') + '?', 'Stitch Bot will send your CV, open application letter and the documents each post asks for.', 'Apply', async function(){
            careerBotBusy = true; rerenderCareerMatches();
            let done = 0, skipped = 0;
            for (const id of ids) { const why = await careerBotApplyOne(id); if (why) skipped++; else done++; if (why === 'Your Stitch Bot subscription has ended.') { skipped += ids.length - done - skipped; break; } }
            careerBotBusy = false; rerenderCareerMatches();
            if (skipped) openAppAlertModal(`Applied to ${done}. ${skipped} couldn't be sent (missing details).`, 'Stitch Bot');
          });
        }
        // Compares each application's current status with what the user was last told, and tells
        // them about changes, interview sessions and closing deadlines
        function careerBotCheckUpdates(){
          const p = careerBotEnsure(); if (!p) return;
          let changed = false;
          allJobs().forEach(job => {
            const app = jobApplication(job);
            if (app) {
              const st = app.status || 'applied';
              const prev = p.botSeen[job.id];
              if (prev === undefined) { p.botSeen[job.id] = st; changed = true; }
              else if (prev !== st) {
                p.botSeen[job.id] = st; changed = true;
                const meta = JOB_STATUS_META[st];
                careerBotLog(`"${job.title}": ${meta ? meta.label : st}. ${meta && meta.message ? meta.message : ''}`.trim(), job.id, true);
              }
              // Follow-up reminders for posts Stitch Bot applied to that have gone quiet
              const sentTs = (p.botApplied && p.botApplied[job.id] && p.botApplied[job.id].ts) || app.appliedDate || 0;
              if (st === 'applied' && sentTs && p.botApplied && p.botApplied[job.id]) {
                const days = Math.floor((Date.now() - sentTs) / 86400000);
                const k7 = 'fu7:' + job.id, k14 = 'fu14:' + job.id;
                if (days >= 14 && !p.botSeen[k14]) {
                  p.botSeen[k7] = 1; p.botSeen[k14] = 1; changed = true;
                  careerBotLog(`No reply yet from "${job.title}" after ${days} days. It may be worth a short, polite follow-up with the poster, or moving on to your next match.`, job.id, true);
                } else if (days >= 7 && !p.botSeen[k7]) {
                  p.botSeen[k7] = 1; changed = true;
                  careerBotLog(`A week has passed since you applied to "${job.title}" with no update. Stitch Bot will keep watching and tell you the moment its status changes.`, job.id, true);
                }
              }
              const mine = (job.applicants || []).find(a => a.id === currentUserId);
              if (mine && mine.interview && mine.interview.date) {
                // A heads-up the day before (or the same day) of an interview
                const ivDay = Date.parse(mine.interview.date + 'T00:00:00');
                const rk = 'ivr:' + job.id + ':' + mine.interview.date;
                if (ivDay && !p.botSeen[rk] && ivDay - Date.now() < 86400000 && ivDay - Date.now() > -86400000) {
                  p.botSeen[rk] = 1; changed = true;
                  careerBotLog(`Reminder: your interview for "${job.title}" is ${ivDay > Date.now() ? 'tomorrow' : 'today'} (${jobInterviewWhenText(mine.interview)}). Have your CV and documents handy.`, job.id, true);
                }
              }
              if (mine && mine.interview) {
                const key = 'iv:' + job.id + ':' + mine.interview.date + mine.interview.time;
                if (!p.botSeen[key]) {
                  p.botSeen[key] = 1; changed = true;
                  careerBotLog(`Interview session for "${job.title}": ${jobInterviewWhenText(mine.interview)} · ${jobInterviewWhereText(mine.interview)}.`, job.id, true);
                }
              }
            } else if ((p.matches || []).some(m => m.id === job.id)) {
              const t = Date.parse(job.deadlineDate || '');
              const key = 'dl:' + job.id;
              if (t && !p.botSeen[key] && t > Date.now() && t - Date.now() < 3 * 86400000) {
                p.botSeen[key] = 1; changed = true;
                careerBotLog(`"${job.title}" closes soon and you haven't applied yet.`, job.id, true, 'matches');
              }
            }
          });
          p.botCheckedAt = Date.now();
          if (changed) saveCareerStartProfile();
        }
        function careerBotCheckNow(){
          careerBotCheckUpdates();
          saveCareerStartProfile();
          rerenderCareerMatches(true);
        }
        function careerBotMatchActionHTML(job){
          if (!job || job.type === 'Course') return '';
          const app = jobApplication(job);
          if (app) {
            const meta = JOB_STATUS_META[app.status || 'applied'] || JOB_PIPELINE_META.applied;
            return `<div class="px-1 mb-4 -mt-2 text-xs font-semibold" style="color:${meta.color};">${Icon('check','w-3 h-3')} ${escapeHtml(meta.label)}</div>`;
          }
          if (job.applyMethod === 'website' && job.website) return '';
          const missing = careerBotMissingFor(job);
          if (missing.length) return `<div class="px-1 mb-4 -mt-2 text-xs text-gray-400">Stitch Bot needs: ${escapeHtml(missing.join(', '))}</div>`;
          return `<div class="px-1 mb-4 -mt-2"><button ${careerBotBusy ? 'disabled' : ''} onclick="careerBotApplyClick('${job.id}')" class="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);${careerBotBusy ? 'opacity:.6;' : ''}">Apply with Stitch Bot</button></div>`;
        }
        function careerBotDocsCardHTML(){
          const p = careerBotEnsure(); if (!p) return '';
          const rows = CAREER_BOT_DOC_SLOTS.map(s => {
            const list = careerBotDocList(s.id); const busy = careerBotDocBusy === s.id;
            const full = list.length >= CAREER_BOT_MAX_FILES;
            const sub = busy ? 'Saving…' : list.length ? `${list.length} file${list.length === 1 ? '' : 's'} added` : s.hint;
            return `
              <div class="py-3" style="border-top:1px solid rgba(128,128,128,0.15);">
                <div class="text-sm font-semibold text-gray-800">${s.label}</div>
                <div class="text-xs text-gray-400 truncate">${sub}</div>
                ${list.map((d, i) => `
                  <div class="flex items-center gap-2" style="padding:6px 0;">
                    <span class="flex-shrink-0" style="color:${NAVY};">${Icon('doc','w-4 h-4')}</span>
                    <div class="flex-1 min-w-0 text-xs text-gray-700 truncate">${escapeHtml(d.fileName)}</div>
                    <button onclick="careerViewDoc('${s.id}',${i})" class="text-xs font-semibold" style="color:${NAVY};">View</button>
                    <button onclick="careerDownloadDoc('${s.id}',${i})" class="text-xs font-semibold" style="color:${NAVY};margin-left:10px;">Download</button>
                    <button onclick="careerDocEdit('${s.id}',${i})" class="text-xs font-semibold" style="color:#374151;margin-left:10px;">Edit</button>
                    <button onclick="removeCareerBotDoc('${s.id}',${i})" class="text-xs font-semibold" style="color:#ef4444;margin-left:10px;">Remove</button>
                  </div>`).join('')}
                <div class="flex gap-2" style="margin-top:8px;">
                  <input type="file" multiple id="career-bot-doc-${s.id}" accept="${s.id === 'idDocument' ? '.pdf,.jpg,.jpeg,.png' : '.pdf,.doc,.docx'}" class="hidden" onchange="handleCareerBotDoc(event,'${s.id}')">
                  <button ${(busy || full) ? 'disabled' : ''} onclick="document.getElementById('career-bot-doc-${s.id}').click()" class="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-2xl" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px dashed ${ROYAL};${full ? 'opacity:.5;' : ''}">${Icon('upload','w-4 h-4')} ${full ? 'Limit reached' : list.length ? 'Add more' : 'Upload'}</button>
                </div>
              </div>`;
          }).join('');
          // The phone number was already checked (with its country code) on the last step of Match
          // with CV, so it is only shown here
          const phoneNow = normalizeIntlPhone(p.botContact.phone || p.phone);
          const phoneBlock = phoneNow.ok
            ? `<div class="flex items-center justify-between text-sm py-2"><span class="text-gray-500">Phone</span><span class="font-semibold text-gray-800">${escapeHtml(phoneNow.display)}</span></div>`
            : `<div class="text-xs mb-1" style="color:#ef4444;">Add your phone number with its country code so Stitch Bot can apply for you.</div>
               <input type="tel" value="${escapeHtml(p.botContact.phone || '')}" onchange="setCareerBotPhone(this.value)" placeholder="e.g. +233 24 123 4567" class="w-full min-w-0 bg-gray-100 flow-outline text-sm rounded-2xl px-3 py-2 mb-1" style="outline:none;">`;
          return `
            <div class="px-1 mb-5">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Application documents</div>
              <div class="text-xs text-gray-400 mb-2">Stitch Bot uses these, plus your CV, to apply for you. Posts that ask for other documents are skipped until you add them. You can add more than one file to each section.</div>
              ${phoneBlock}
              <div class="text-xs text-gray-400" style="margin:2px 0 4px;">${(p.botContact.location || '').trim() ? 'Your city and country, taken from your forms. Change it here if you move.' : 'Add your city and country so applications carry your location.'}</div>
              <input type="text" value="${escapeHtml(p.botContact.location || '')}" oninput="updateCareerBotContact('location', this.value)" placeholder="City, country" class="w-full min-w-0 bg-gray-100 flow-outline text-sm rounded-2xl px-3 py-2 mb-1" style="outline:none;">
              ${rows}
            </div>`;
        }
        function careerBotUpdatesCardHTML(){
          const p = careerBotEnsure(); if (!p || !p.botLog.length) return '';
          return `
            <div class="px-1 mb-5">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Stitch Bot updates</div>
              ${p.botLog.slice(0, 6).map(l => `<div class="flex items-start gap-2 py-1.5"><span style="color:${NAVY};margin-top:2px;">${Icon('bot','w-3.5 h-3.5')}</span><div class="flex-1 min-w-0"><div class="text-sm text-gray-700">${escapeHtml(l.text)}</div><div class="text-xs text-gray-400">${careerPlanDateLabel(l.ts)}</div></div></div>`).join('')}
            </div>`;
        }
        // "How far you are" graph: setup progress, subscription time used, an applications funnel
        // and applications per week
        function careerProgressGraphHTML(){
          const p = careerBotEnsure(); if (!p) return '';
          const applied = allJobs().filter(j => isJobApplied(j) && j.type !== 'Course');
          const stOf = j => (jobApplication(j) || {}).status || 'applied';
          const matched = (p.matches || []).length;
          const reviewed = applied.filter(j => ['under_review','shortlisted','interview','offer','offer_accepted'].includes(stOf(j))).length;
          const short = applied.filter(j => ['shortlisted','interview','offer','offer_accepted'].includes(stOf(j))).length;
          const offers = applied.filter(j => ['offer','offer_accepted'].includes(stOf(j))).length;
          const steps = [!!p.resumeFileName, careerBotDocList('openLetter').length > 0, !!(p.botContact.phone || '').trim(), careerSubscriptionActive(), applied.length > 0];
          const pct = Math.round(steps.filter(Boolean).length / steps.length * 100);
          const sub = p.subscription;
          let subPct = 0, subText = '';
          if (sub && sub.startedAt && sub.expiresAt) {
            subPct = Math.max(0, Math.min(100, Math.round((Date.now() - sub.startedAt) / (sub.expiresAt - sub.startedAt) * 100)));
            const left = Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / 86400000));
            subText = `${left} day${left === 1 ? '' : 's'} left`;
          }
          const bar = (label, n, max, color) => `
            <div style="margin-bottom:10px;">
              <div class="flex items-center justify-between text-xs" style="margin-bottom:4px;"><span class="text-gray-600">${label}</span><span class="font-bold text-gray-800">${n}</span></div>
              <div style="height:8px;border-radius:9999px;background:rgba(128,128,128,0.18);overflow:hidden;"><div style="height:100%;width:${max ? Math.round(n / max * 100) : 0}%;min-width:${n ? 6 : 0}px;border-radius:9999px;background:${color};transition:width .4s ease;"></div></div>
            </div>`;
          const top = Math.max(1, matched, applied.length);
          return `
            <div class="px-1 mb-5">
              <div class="flex items-center justify-between mb-2">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400">Your progress</div>
                <div class="text-xs font-bold" style="color:${NAVY};">${pct}% set up</div>
              </div>
              ${bar('Profile setup (CV, letter, phone, plan, first application)', pct, 100, `linear-gradient(90deg, ${NAVY}, ${ROYAL})`).replace(/<span class="font-bold text-gray-800">\d+<\/span>/, `<span class="font-bold text-gray-800">${pct}%</span>`)}
              ${sub ? bar('Plan time used', subPct, 100, '#1e90ff').replace(/<span class="font-bold text-gray-800">\d+<\/span>/, `<span class="font-bold text-gray-800">${subText}</span>`) : ''}
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400" style="margin:14px 0 8px;">Applications funnel</div>
              ${bar('Matched', matched, top, '#94a3b8')}
              ${bar('Applied', applied.length, top, '#1e90ff')}
              ${bar('Under review +', reviewed, top, '#b45309')}
              ${bar('Shortlisted / interview +', short, top, '#4f46e5')}
              ${bar('Offers', offers, top, '#059669')}
              <div style="margin-top:14px;">${careerAnalyticsGraphHTML(applied)}</div>
            </div>`;
        }
        function careerMatchesHTML(){
          const p = careerStartProfile;
          if (!p) {
            return `
              ${overlayHeader('Match with CV', '20px', 'closeOverlay()', null, { center: true })}
              <div class="flex-1 overflow-y-auto px-5 pb-6">
                <div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No Career Profile yet -- fill out the quick quiz to get matched with opportunities.</div>
                <button onclick="startCareerStartQuiz('careerMatches')" class="w-full font-semibold text-sm py-3 rounded-full text-white mt-4" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Get Started</button>
              </div>`;
          }
          const { interestLabels, levelLabel, eduLabel, styleLabel, genderLabel } = careerProfileFiltersSummary(p);
          const filterChips = [
            ...interestLabels,
            p.jobTitle ? `"${p.jobTitle}"` : '',
            levelLabel, eduLabel, styleLabel,
            p.age ? `Age ${p.age}` : '', (p.gender && p.gender !== 'none') ? genderLabel : '',
          ].filter(Boolean);
          const matches = (p.matches || [])
            .map(m => ({ job: findExploreCard(m.id), score: m.score, reason: m.reason }))
            .filter(m => m.job);
          const priorityJob = p.priorityId ? findExploreCard(p.priorityId) : null;
          return `
            <div class="flex-1 overflow-y-auto" style="padding-bottom:30px;">
            ${careerMatchesHeaderHTML()}
            <div class="px-5" style="padding-top:20px;">
              <div class="bg-white rounded-3xl p-4 mb-4 shadow-sm">
                <div class="flex items-center gap-3">
                  
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-800 truncate">${p.resumeFileName ? escapeHtml(p.resumeFileName) : 'No resume attached'}</div>
                    <div class="text-xs text-gray-400">${escapeHtml(p.fullName || '')}${p.fullName && p.email ? ' · ' : ''}${escapeHtml(p.email || '')}</div>
                  </div>
                  
                </div>
                <div class="flex items-center gap-2" style="margin-top:5px;">
                  ${p.resumeDataUrl ? `<button type="button" onclick="careerViewResume()" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:rgba(10,37,64,0.08);color:${NAVY};">View</button><button type="button" onclick="careerDownloadResume()" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:rgba(10,37,64,0.08);color:${NAVY};">Download</button>` : ''}
                  <input type="file" id="career-profile-resume-input" accept=".pdf,.doc,.docx" class="hidden" onchange="handleCareerProfileResumeReplace(event)">
                  <button onclick="document.getElementById('career-profile-resume-input').click()" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:#f3f4f6;color:#374151;">${p.resumeFileName ? 'Replace' : 'Attach resume'}</button>
                </div>
              </div>
              ${careerHasBotDocs() ? '' : careerProgressGraphHTML()}
              ${careerHasBotDocs() ? '' : careerBotUpdatesCardHTML()}
              <div class="px-1 mb-5">
                <div class="flex items-center justify-between mb-2.5">
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400">What you're looking for</div>
                  <button onclick="startCareerStartQuiz('careerMatches')" class="text-xs font-semibold" style="color:${NAVY};">Edit</button>
                </div>
                ${filterChips.length
                  ? `<div class="flex flex-col">${filterChips.map((label, i) => `<div class="text-sm font-medium text-gray-700" style="padding:12px 0;${i ? 'border-top:1px solid rgba(128,128,128,0.18);' : ''}">${escapeHtml(label)}</div>`).join('')}</div>`
                  : '<span class="text-xs text-gray-400">No filters set yet.</span>'}
              </div>
              ${p.resumeAIFeedback ? `
              <div class="px-1 mb-5">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Stitch's take on your resume</div>
                <div class="text-sm text-gray-700 leading-relaxed">${escapeHtml(p.resumeAIFeedback)}</div>
              </div>` : ''}
              <div class="flex flex-col items-center mb-3">
                <div class="font-semibold text-base font-display grad-text text-center whitespace-nowrap mb-2">Matched opportunities</div>
                <div class="flex items-center justify-between w-full">
                  <button onclick="careerBotApplyAll()" ${careerBotBusy ? 'disabled' : ''} class="text-xs font-semibold whitespace-nowrap" style="color:${careerBotBusy ? '#c1c5cc' : NAVY};">${careerBotBusy ? 'Applying…' : 'Apply to all'}</button>
                  <button type="button" onclick="refreshCareerMatches()" ${careerMatchesLoading ? 'disabled' : ''} class="career-refresh-btn text-xs font-semibold flex items-center gap-1 whitespace-nowrap${careerMatchesLoading ? ' career-refresh-spinning' : ''}" style="color:${NAVY};">${Icon('repost','w-4 h-4')}Refresh</button>
                </div>
              </div>
              ${careerMatchesLoading && !matches.length
                ? `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                    <div style="width:28px;height:28px;border-radius:9999px;border:3px solid rgba(10,37,64,0.12);border-top-color:${NAVY};animation:classroom-spin 0.9s linear infinite;"></div>
                    Screening posted opportunities against your profile…
                  </div>`
                : careerMatchesError
                  ? `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">${escapeHtml(careerMatchesError)}<button onclick="refreshCareerMatches()" class="block mx-auto mt-3 text-sm font-semibold" style="color:${NAVY};">Try again</button></div>`
                  : matches.length
                    ? `<div style="transition:opacity .2s ease;${careerMatchesLoading ? 'opacity:0.45;pointer-events:none;' : ''}">` + (priorityJob && planHasCvRecommendations() ? careerPriorityCalloutHTML({ job: priorityJob, reason: p.priorityReason }) : '') +
                      matches.map(m => jobCard(m.job) + careerMatchReasonHTML(m, priorityJob && m.job.id === priorityJob.id) + careerBotMatchActionHTML(m.job)).join('') + '</div>'
                    : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No strong matches yet -- check back once more opportunities are posted, or widen your filters.</div>`
              }
            </div>
            </div>
            ${careerSubscribePillHTML()}`;
        }

        // ---- Application submission + Paystack payment ----
        async function submitJobApplication(){
          if (!requireCompleteProfile()) return;
          const job = findJob(activeApplyJobId);
          if (!job) return;
          const d = jobApplyDraft;
          const isCourse = job.type === 'Course';

          jobApplyErrors = { fullName:'', email:'', phone:'', dob:'', location:'' };
          if (!d.fullName.trim()) {
            jobApplyErrors.fullName = 'Please add your full name.';
          } else if (!isValidName(d.fullName.trim())) {
            jobApplyErrors.fullName = 'Enter a valid full name (letters, spaces, hyphens, and apostrophes only).';
          }
          if (!d.email.trim()) {
            jobApplyErrors.email = 'Please add your email.';
          } else if (!isValidEmail(d.email.trim())) {
            jobApplyErrors.email = 'Enter a valid email address (e.g. you@example.com).';
          }
          // Contact details are mandatory for in-app applications: the poster needs a way to reach
          // the applicant, so a phone number (alongside the email above) is required
          if (!d.phone || !d.phone.trim()) {
            jobApplyErrors.phone = 'Please add your phone number so the poster can reach you.';
          } else if (!isValidPhone(d.phone.trim())) {
            jobApplyErrors.phone = 'Enter a valid phone number (7-15 digits, e.g. +233 24 123 4567).';
          }

          // Date of birth is typed as DD/MM/YYYY (digits get their slashes automatically) and must
          // be a real date that isn't in the future
          if (!d.dob || !d.dob.trim()) {
            jobApplyErrors.dob = 'Please add your date of birth.';
          } else {
            const dobParsed = parseTypedDateDDMMYYYY(d.dob.trim(), { allowFuture: false });
            if (dobParsed.error || !dobParsed.iso) jobApplyErrors.dob = dobParsed.error || 'Please enter your date of birth as DD/MM/YYYY.';
            else d.dobIso = dobParsed.iso;
          }
          if (!d.location || !d.location.trim()) {
            jobApplyErrors.location = 'Please add your location (city, country).';
          }

          if (jobApplyErrors.fullName || jobApplyErrors.email || jobApplyErrors.phone || jobApplyErrors.dob || jobApplyErrors.location) {
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = jobApplyHTML();
            return;
          }

          careerRememberLocation(d.location);

          // The poster/admin decides, per opportunity, which documents are mandatory
          if (!isCourse) {
            const allRequired = ['resume'].concat((job.requiredDocs || []).filter(id => id !== 'resume'));
            const missing = allRequired.filter(id => !d.documents[id]);
            if (missing.length) {
              const labels = missing.map(id => (OPP_DOC_TYPES.find(t => t.id === id) || {}).label || id).join(', ');
              openAppAlertModal(`Please attach the required document(s): ${labels}.`);
              return;
            }
          }

          if (isCourse && job.priceType === 'paid') {
            startPaystackPayment(job);
            return;
          }

          let docsPayload = null;
          if (!isCourse) {
            jobApplySubmitBusy = true;
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = jobApplyHTML();
            docsPayload = await uploadJobApplyDocuments(job.id);
            jobApplySubmitBusy = false;
            const attached = Object.values(docsPayload.documents || {}).concat(docsPayload.additionalDocuments || []);
            const failed = attached.filter(d => !d.url && !d.path && !d.dataUrl);
            if (failed.length) {
              const ov2 = document.getElementById('overlay');
              if (ov2) ov2.innerHTML = jobApplyHTML();
              const why = failed.map(d => d.error).filter(Boolean)[0];
              openAppAlertModal(`We couldn't upload ${failed.map(d => d.fileName).join(', ')}. ${why ? 'Reason: ' + why + '. ' : ''}Check your connection and try again, or attach a smaller file.`);
              return;
            }
          }

          if (docsPayload && !isCourse) await careerSyncApplyDocsToVault(d, docsPayload);
          completeJobApplication(job, docsPayload);
        }

        // Documents a person attaches to an application also land in Documents, with their text read,
        // so Stitch Bot (and its AI) can reuse them on the next post
        const CAREER_APPLY_DOC_SLOT = { applicationLetter: 'openLetter', coverLetter: 'openLetter', transcript: 'transcript', portfolio: 'portfolio', idDocument: 'idDocument' };
        async function careerSyncApplyDocsToVault(draft, payload){
          const p = careerBotEnsure(); if (!p || !payload || !draft) return;
          try {
            let changed = false;
            const addFile = async (slot, entry, rec) => {
              if (!entry || !entry.file || !rec) return;
              const list = careerBotDocList(slot).slice();
              if (list.some(x => x.fileName === rec.fileName) || list.length >= CAREER_BOT_MAX_FILES) return;
              const text = await extractCareerStartResumeText(entry.file);
              const vrec = { fileName: rec.fileName, url: rec.url || '', text: String(text || '').slice(0, 6000), addedAt: Date.now() };
              if (!vrec.url) { if (!rec.dataUrl) return; vrec.dataUrl = rec.dataUrl; }
              list.push(vrec); p.botDocs[slot] = list; changed = true;
            };
            const docs = payload.documents || {};
            for (const docId of Object.keys(docs)) {
              const entry = (draft.documents || {})[docId]; const rec = docs[docId];
              if (docId === 'resume') {
                if (!p.resumeFileName && entry && entry.file && rec && (rec.url || rec.dataUrl)) {
                  p.resumeFileName = rec.fileName; p.resumeText = await extractCareerStartResumeText(entry.file); p.resumeDataUrl = rec.url || rec.dataUrl; changed = true;
                }
                continue;
              }
              const slot = CAREER_APPLY_DOC_SLOT[docId]; if (slot) await addFile(slot, entry, rec);
            }
            const extras = payload.additionalDocuments || [];
            for (let i = 0; i < extras.length; i++) await addFile('otherDocument', (draft.additionalDocuments || [])[i], extras[i]);
            if (changed) saveCareerStartProfile();
          } catch (e) { console.warn('Could not copy application documents into Documents:', e); }
        }
        function completeJobApplication(job, docsPayload){
          finalizeJobApplication(job.id, docsPayload);
          resetJobApplyDraft();
          if (job.type === 'Course') {
            goToJobCourse(job.id);
          } else {
            openJobDetail(job.id);
          }
        }

        const PAYSTACK_PUBLIC_KEY = 'pk_live_f1ac7bbd6ae40d2ee67545b02e89ad4cd66e9c5c';
        let jobApplyPaymentBusy = false;
        // Set while the applicant's attached documents are uploading, right before the application
        // is finalized
        let jobApplySubmitBusy = false;
        let _paystackScriptPromise = null;

        function loadPaystackScript(){
          if (window.PaystackPop) return Promise.resolve();
          if (_paystackScriptPromise) return _paystackScriptPromise;
          _paystackScriptPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://js.paystack.co/v1/inline.js';
            s.onload = () => resolve();
            s.onerror = () => { _paystackScriptPromise = null; reject(new Error('Failed to load Paystack.')); };
            document.head.appendChild(s);
          });
          return _paystackScriptPromise;
        }

        function parseCoursePriceForPaystack(priceStr){
          const str = (priceStr || '').trim();
          const match = str.match(/[\d,]+(\.\d+)?/);
          const amount = match ? parseFloat(match[0].replace(/,/g, '')) : 0;
          const currency = /\$|USD/i.test(str) ? 'USD' : 'GHS';
          return { amount, currency, subunit: Math.round(amount * 100) };
        }

        async function startPaystackPayment(job){
          const d = jobApplyDraft;
          const { subunit, currency } = parseCoursePriceForPaystack(job.price);
          if (!isStitchTestAccount() && (!subunit || subunit <= 0)) {
            openAppAlertModal("This course's enrollment fee isn't set up correctly. Please contact the organizer.", 'Payment unavailable');
            return;
          }

          // Test account: enroll without paying
          if (isStitchTestAccount()) { jobApplyPaymentBusy = false; completeJobApplication(job); return; }

          jobApplyPaymentBusy = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobApplyHTML();

          try {
            await loadPaystackScript();
          } catch (err) {
            jobApplyPaymentBusy = false;
            const ov2 = document.getElementById('overlay');
            if (ov2) ov2.innerHTML = jobApplyHTML();
            openAppAlertModal('Could not load the payment popup. Check your connection and try again.', 'Payment unavailable');
            return;
          }

          function closeCoursePaystackPopup(fromPopState){
            teardownPaystackPopup(fromPopState);
            jobApplyPaymentBusy = false;
            const ovClose = document.getElementById('overlay');
            if (ovClose) ovClose.innerHTML = jobApplyHTML();
          }

          const reference = 'stitch_' + job.id + '_' + Date.now();
          const handler = window.PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: d.email.trim(),
            amount: subunit,
            currency: currency,
            ref: reference,
            metadata: {
              job_id: job.id,
              user_id: currentUserId || '',
              job_title: job.title,
              full_name: d.fullName.trim(),
              phone: d.phone ? d.phone.trim() : '',
            },
            callback: function(response){
              popModalBackHandler(false);
              verifyPaystackAndEnroll(job, response.reference);
            },
            onClose: function(){
              closeCoursePaystackPopup(false);
            }
          });
          pushModalBackHandler(closeCoursePaystackPopup);
          handler.openIframe();
        }

        async function verifyPaystackAndEnroll(job, reference){
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to complete payment: please log in again.');
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/paystack-verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'apikey': SUPABASE_ANON_KEY
              },
              body: JSON.stringify({ reference })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Payment verification failed (' + res.status + ')');
            if (!data.verified) throw new Error('We could not confirm this payment. If you were charged, contact support with reference ' + reference + '.');

            jobApplyPaymentBusy = false;
            completeJobApplication(job);
          } catch (err) {
            jobApplyPaymentBusy = false;
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = jobApplyHTML();
            window.reportError && window.reportError(err, { call: 'verifyPaystackAndEnroll', jobId: job.id });
            openAppAlertModal(err.message || 'Payment verification failed. Please try again.', 'Payment not confirmed');
          }
        }

        function jobApplyHTML(){
          const job = findJob(activeApplyJobId);
          if (!job) return `${overlayHeader('Apply', '20px')}<div class="p-5 text-center text-gray-400 text-sm">This listing is no longer available.</div>`;
          const isCourse = job.type === 'Course';
          return `
            ${overlayHeader(isCourse ? 'Enroll' : 'Apply', '20px', undefined, undefined, { center: true, pb: '10px' })}
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
              <div class="rounded-3xl p-4 mb-5 flex items-center gap-3" style="background:rgba(10,37,64,0.05);">
                <div class="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${job.coverImage ? `<img src="${job.coverImage}" class="w-full h-full object-cover" alt="">` : Icon(job.icon,'w-5 h-5')}</div>
                <div class="min-w-0">
                  <div class="font-semibold text-sm truncate">${escapeHtml(job.title)}</div>
                  <div class="text-xs text-gray-500 truncate">${isCourse ? escapeHtml(stitchOrgName(job.org)) : (job.org || '')}</div>
                </div>
              </div>

              ${isCourse ? `
                <div class="rounded-2xl p-4 mb-5" style="background:rgba(5,150,105,0.08);">
                  <div class="text-sm font-semibold text-emerald-700 mb-1">${job.priceType === 'paid' ? `Enrollment fee: ${escapeHtml(job.price || '')}` : 'Free to enroll'}</div>
                  <div class="text-xs text-gray-500">${job.priceType === 'paid' ? "No application or cover letter needed: just enroll below and you'll pay the enrollment fee to get started." : "No application or cover letter needed: just enroll below to get instant access."}</div>
                </div>
              ` : ''}

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your details</div>
              ${jobApplyFieldRow('Full name', 'fullName', 'e.g. Ama Konadu')}
              ${jobApplyFieldRow('Email', 'email', 'e.g. you@email.com', 'email')}
              ${jobApplyFieldRow('Phone', 'phone', 'e.g. 024 123 4567', 'tel')}
              ${jobApplyDobRow()}
              ${jobApplyFieldRow('Location', 'location', 'e.g. Accra, Ghana')}

              ${isCourse ? '' : jobApplyDocumentsHTML(job)}

              <div class="text-center mt-2" style="padding-bottom:10px;">
                <button onclick="submitJobApplication()" ${(jobApplyPaymentBusy || jobApplySubmitBusy) ? 'disabled' : ''} class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;${(jobApplyPaymentBusy || jobApplySubmitBusy) ? 'opacity:0.6;' : ''}">${jobApplyPaymentBusy ? 'Processing payment...' : jobApplySubmitBusy ? 'Submitting…' : (isCourse ? (job.priceType === 'paid' ? 'Continue to Payment' : 'Enroll for Free') : 'Submit Application')}</button>
              </div>
            </div>`;
        }

        const oppTypes = ['Job','Internship','Part-time','Scholarship','Course','Other'];
        const oppModes = ['Online','On-site'];
        // applyMethod 'inapp' (the default) means applications go straight to the poster and
        // admins inside Stitch
        let newOppDraft = { title:'', org:'', type:'Job', mode:'On-site', location:'', place:'', duration:'', deadline:'', deadlineDate:'', deadlineDateTyped:'', description:'', applyMethod:'inapp', email:'', website:'', requiredDocs:[], gender:'any', priceType:'free', price:'', coverImage:'' };
        let newOppEditingId = null;

        function resetNewOppDraft(){
          newOppDraft = { title:'', org:'', type:'Job', mode:'On-site', location:'', place:'', duration:'', deadline:'', deadlineDate:'', deadlineDateTyped:'', description:'', applyMethod:'inapp', email:'', website:'', requiredDocs:[], gender:'any', priceType:'free', price:'', coverImage:'' };
        }

        function rerenderPostOpportunity(){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const sc = ov.querySelector('.overflow-y-auto');
          const top = sc ? sc.scrollTop : 0;
          ov.innerHTML = postOpportunityHTML();
          if (top) { const sc2 = ov.querySelector('.overflow-y-auto'); if (sc2) sc2.scrollTop = top; }
        }

        function handleOppCoverSelect(event){
          const file = event.target.files && event.target.files[0];
          if (!file) { event.target.value = ''; return; }
          if (!validateOrRejectFile(event.target, file, 'coverImage')) return;
          event.target.value = '';
          const reader = new FileReader();
          reader.onload = function(ev){
            // Shrink right away (max 1280px, JPEG) so a 5-8 MB photo never ends up in the draft or the
            // row
            compressImageDataUrl(ev.target.result, 1280, 0.82)
              .then(function(small){ newOppDraft.coverImage = small; })
              .catch(function(){ newOppDraft.coverImage = ev.target.result; })
              .then(function(){ rerenderPostOpportunity(); });
          };
          reader.readAsDataURL(file);
        }

        function clearOppCover(){
          newOppDraft.coverImage = '';
          rerenderPostOpportunity();
        }

        function openPostOpportunity(){
          if (!canCurrentUserPost()) { openPosterApplicationForm(); return; }
          resetNewOppDraft();
          newOppEditingId = null;
          openOverlay('postOpportunity');
        }

        function openEditOpportunity(id){
          const job = findJob(id);
          if (!job || !canCurrentUserManageJob(job)) return;
          jobDetailMenuOpen = false;
          newOppDraft = {
            title: job.title || '',
            org: job.org || '',
            type: job.type || 'Job',
            mode: job.mode || 'On-site',
            location: job.location || '',
            place: job.place || '',
            duration: job.duration || '',
            deadline: (job.type === 'Course' ? (job.deadline === 'Self-paced' ? '' : (job.deadline || '')) : (job.deadline || '').replace(/^Deadline /, '')),
            deadlineDate: job.deadlineDate || '',
            deadlineDateTyped: isoToTypedDate(job.deadlineDate || ''),
            description: job.description || '',
            applyMethod: (job.applyMethod === 'website' || job.website) ? 'website' : 'inapp',
            email: job.email || '',
            website: job.website || '',
            requiredDocs: job.requiredDocs || [],
            gender: job.gender || 'any',
            priceType: job.priceType || 'free',
            price: (job.priceType === 'paid' ? (job.price || '') : ''),
            coverImage: job.coverImage || '',
          };
          newOppEditingId = id;
          openOverlay('postOpportunity');
        }

        function setNewOppGender(g){ newOppDraft.gender = g; rerenderPostOpportunity(); }
        function setNewOppPriceType(priceType){
          newOppDraft.priceType = priceType;
          rerenderPostOpportunity();
        }

        function setNewOppApplyMethod(method){
          newOppDraft.applyMethod = method;
          rerenderPostOpportunity();
        }

        // Poster/admin picks which documents an applicant must attach before they can submit
        function toggleNewOppRequiredDoc(id){
          const idx = newOppDraft.requiredDocs.indexOf(id);
          if (idx === -1) newOppDraft.requiredDocs.push(id); else newOppDraft.requiredDocs.splice(idx, 1);
          rerenderPostOpportunity();
        }

        function updateNewOppField(field, value){
          newOppDraft[field] = value;
        }

        // Every listing's description needs at least this many words.
        const OPP_DESC_MIN_WORDS = 50;
        function updateOppDescCounter(value){
          const n = posterAppWordCount(value);
          const c = document.getElementById('opp-desc-counter');
          if (c) { c.textContent = n + '/' + OPP_DESC_MIN_WORDS + ' words minimum'; c.style.color = n >= OPP_DESC_MIN_WORDS ? '#16a34a' : '#e11d48'; }
        }

        // Deadline is typed as DD/MM/YYYY (see typedDateHintHTML) rather than picked from a native
        // calendar
        function onOppDeadlineDateInput(el){
          const formatted = formatTypedDateDigits(el.value);
          if (el.value !== formatted) el.value = formatted;
          newOppDraft.deadlineDateTyped = formatted;
          const parsed = parseTypedDateDDMMYYYY(formatted, { allowPast: false });
          newOppDraft.deadlineDate = parsed.error ? '' : parsed.iso;
        }

        function setNewOppType(type){
          newOppDraft.type = type;
          if (type === 'Course') newOppDraft.mode = 'Online';
          rerenderPostOpportunity();
        }

        function setNewOppMode(mode){
          newOppDraft.mode = mode;
          rerenderPostOpportunity();
        }

        // Guards against duplicate listings caused by mashing "Post Opportunity" multiple times
        // before the first tap finishes (e.g. while waiting on the network sync)
        let oppSubmitInFlight = false;

        async function submitNewOpportunity(){
          if (oppSubmitInFlight) return;
          oppSubmitInFlight = true;
          const submitBtn = document.getElementById('opp-submit-btn');
          const submitBtnOriginalHTML = submitBtn ? submitBtn.innerHTML : '';
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
            submitBtn.style.pointerEvents = 'none';
            submitBtn.innerHTML = 'Posting…';
          }
          try {
            if (!canCurrentUserPost()) { openAppAlertModal('You need an approved poster application before you can post. Apply from Career Space\'s menu.'); return; }
            if (!requireCompleteProfile()) return;
            const d = newOppDraft;
            const isCourse = d.type === 'Course';
            // Course stays admin-only even for an approved poster (defense in depth
            if (isCourse && !isCurrentUserAdmin()) { openAppAlertModal('Only admins can post a course.'); return; }
            // 'inapp' (the default) means applications land directly with the poster/admins inside
            // Stitch
            const applyMethod = isCourse ? 'inapp' : (d.applyMethod || 'inapp');
            const applyViaWebsite = !isCourse && applyMethod === 'website';
            if (!d.title.trim() || !d.description.trim()) {
              openAppAlertModal('Please add at least a title and a description.');
              return;
            }
            const descWords = posterAppWordCount(d.description);
            if (descWords < OPP_DESC_MIN_WORDS) {
              openAppAlertModal(`Please write at least ${OPP_DESC_MIN_WORDS} words in the description (currently ${descWords}).`);
              return;
            }
            if (!isCourse) {
              if (applyViaWebsite && !d.website.trim()) {
                openAppAlertModal('Please add the website link where applicants should apply.');
                return;
              }
              if (!d.deadlineDate) {
                openAppAlertModal((d.deadlineDateTyped || '').trim() ? "Please enter a valid, future deadline date as DD/MM/YYYY." : 'Please enter a deadline date for this listing.');
                return;
              }
            }
            if (applyViaWebsite && d.website.trim() && !isValidUrl(d.website.trim())) {
              openAppAlertModal('Please enter a valid website link (e.g. careers.yourorg.com/apply).');
              return;
            }
            if (isCourse && d.email.trim() && !isValidEmail(d.email.trim())) {
              openAppAlertModal('Please enter a valid email address (e.g. you@example.com).');
              return;
            }
            if (isCourse && d.priceType === 'paid' && !d.price.trim()) {
              openAppAlertModal('Please add the enrollment fee amount, or switch this to a free course.');
              return;
            }
            const iconByType = { Job:'briefcase', Internship:'graduate', 'Part-time':'briefcase', Scholarship:'graduate', Course:'chart', Other:'briefcase' };
            const priceLabel = isCourse ? (d.priceType === 'paid' ? d.price.trim() : 'Free') : '';
            const sub = isCourse
              ? [d.org, (d.place || '').trim(), d.duration].filter(Boolean).join(' · ')
              : [d.org, d.mode === 'Online' ? (d.location || 'Online') : (d.location || 'On-site'), d.mode === 'Online' ? (d.place || '').trim() : '', d.duration].filter(Boolean).join(' · ');
            const fields = {
              icon: iconByType[d.type] || 'briefcase',
              title: d.title.trim(),
              sub,
              deadline: isCourse
                ? (d.deadline.trim() || 'Self-paced')
                : `Deadline ${formatISODateForDisplay(d.deadlineDate)}`,
              deadlineDate: isCourse ? '' : d.deadlineDate,
              type: d.type,
              mode: d.mode,
              org: d.org.trim(),
              location: d.location.trim(),
              place: (d.place || '').trim(),
              duration: d.duration.trim(),
              applyMethod: applyMethod,
              email: isCourse ? d.email.trim() : '',
              website: applyViaWebsite ? d.website.trim() : '',
              requiredDocs: isCourse ? [] : (d.requiredDocs || []),
              gender: d.gender || 'any',
              description: d.description.trim(),
              coverImage: d.coverImage || '',
            };
            if (isCourse) {
              fields.priceType = d.priceType;
              fields.price = priceLabel;
            }

            if (newOppEditingId) {
              const existing = findJob(newOppEditingId);
              if (existing) {
                const oldBucket = jobBucketFor(existing);
                Object.assign(existing, fields);
                const newBucket = jobBucketFor(existing);
                if (newBucket !== oldBucket) {
                  const idx = oldBucket.indexOf(existing);
                  if (idx !== -1) oldBucket.splice(idx, 1);
                  newBucket.unshift(existing);
                }
                if (isCourse) {
                  if (!existing.courseId) existing.courseId = createLinkedCourse(existing);
                  else await syncLinkedCourseMeta(existing);
                }
                const synced = await postOpportunityInsertRemote(existing);
                if (!synced) openAppAlertModal("Saved on this device, but couldn't sync to the shared catalog -- it may not show up for other users or survive your next sign-in. Check the console for details.");
                newOppEditingId = null;
                resetNewOppDraft();
                closeOverlay();
                jobsSub = isCourse ? 'courses' : (existing.type === 'Internship' ? 'internships' : existing.type === 'Scholarship' ? 'scholarships' : existing.type === 'Other' ? 'others' : 'opportunities');
                renderJobMarket();
                return;
              }
              newOppEditingId = null;
            }

            const job = Object.assign({ id: 'opp' + Date.now(), saved:false, applied:false, mine: true }, fields);
            job.colorIndex = Math.floor(Math.random() * blueCardPalette.length);
            job.motifIndex = Math.floor(Math.random() * classCardMotifs.length);
            // Ownership metadata for "Posted by @username", edit/delete permissions, and the Admin
            // Dashboard's user/admin split
            job.createdByUserId = currentUserId || null;
            job.createdByName = (typeof profileData !== 'undefined' && profileData.name) || '';
            job.createdByUsername = (typeof profileData !== 'undefined' && profileData.username) || '';
            job.createdByRole = isCurrentUserAdmin() ? 'admin' : 'user';
            const bucket = isCourse ? jobsData.courses
              : d.type === 'Internship' ? jobsData.internships
              : d.type === 'Scholarship' ? jobsData.scholarships
              : d.type === 'Other' ? jobsData.others
              : jobsData.opportunities;
            bucket.unshift(job);
            if (isCourse) job.courseId = createLinkedCourse(job);
            const synced = await postOpportunityInsertRemote(job);
            if (!synced) openAppAlertModal("This listing was saved on this device only -- it couldn't sync to the shared catalog, so it will disappear next time you sign in and won't show up for other users. Check the console for the Supabase error, or make sure the opportunities table + policies from the SQL comment above are set up.");
            resetNewOppDraft();
            closeOverlay();
            jobsSub = isCourse ? 'courses' : (job.type === 'Internship' ? 'internships' : job.type === 'Scholarship' ? 'scholarships' : job.type === 'Other' ? 'others' : 'opportunities');
            renderJobMarket();
          } finally {
            oppSubmitInFlight = false;
            const btnAfter = document.getElementById('opp-submit-btn');
            if (btnAfter) {
              btnAfter.disabled = false;
              btnAfter.style.opacity = '';
              btnAfter.style.pointerEvents = '';
              btnAfter.innerHTML = submitBtnOriginalHTML;
            }
          }
        }

        function oppFieldRow(label, field, placeholder, type){
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${label}</label>
              <input type="${type || 'text'}" value="${newOppDraft[field]}" oninput="updateNewOppField('${field}', this.value)" placeholder="${placeholder || ''}" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none">
            </div>`;
        }

        function postOpportunityHTML(){
          const isEditing = !!newOppEditingId;
          // Same still artwork as "Match with CV/Resume" / "Apply to post" (fixed, so it never
          // scrolls)
          const bg = '';
          return `
            ${bg}
            <div class="flex-1 overflow-y-auto">
            ${overlayHeader(isEditing ? (newOppDraft.type === 'Course' ? 'Edit Course' : 'Edit Opportunity') : 'Post an Opportunity', '20px', null, null, { right: true, pb: '10px' })}
            <div class="px-5" style="padding-bottom:50px;">
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Cover picture (optional)</label>
                <input type="file" id="opp-cover-input" accept="image/*" class="hidden" onchange="handleOppCoverSelect(event)">
                ${newOppDraft.coverImage ? `
                  <div class="relative rounded-2xl overflow-hidden mb-2" style="height:120px;">
                    <img src="${newOppDraft.coverImage}" class="w-full h-full object-cover" alt="">
                    <button onclick="clearOppCover()" class="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white" style="background:rgba(0,0,0,0.5);">${IconBold('close','w-3.5 h-3.5')}</button>
                  </div>
                  <button onclick="document.getElementById('opp-cover-input').click()" class="text-xs font-semibold" style="color:${NAVY};">Change picture</button>
                ` : `
                  <button onclick="document.getElementById('opp-cover-input').click()" class="w-full flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 text-gray-400" style="height:96px;">
                    ${Icon('camera','w-6 h-6')}
                    <span class="text-xs font-semibold">Tap to upload a cover picture</span>
                  </button>
                `}
              </div>
              ${oppFieldRow('Title', 'title', 'e.g. Research Intern')}
              ${oppFieldRow('Organization', 'org', 'e.g. Macro Team')}

              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Type</label>
                <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1" style="scroll-snap-type:x proximity;margin-left:-1.25rem;margin-right:-1.25rem;padding-left:1.25rem;padding-right:1.25rem;scroll-padding-left:1.25rem;">
                  ${(isCurrentUserAdmin() ? oppTypes : oppTypes.filter(t => t !== 'Course')).map(t => `
                    <button onclick="setNewOppType('${t}')" class="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold outline-pill ${newOppDraft.type===t ? 'is-selected' : ''}" style="scroll-snap-align:start;">${t}</button>
                  `).join('')}
                  <span class="flex-shrink-0" style="width:0.75rem;" aria-hidden="true"></span>
                </div>
              </div>

              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Open to</label>
                <div class="text-xs text-gray-400 mb-2">Used to match this listing with the right people in Match with CV.</div>
                <div class="flex gap-2">
                  ${[['any','Everyone'],['male','Men'],['female','Women']].map(([g,l]) => `
                    <button onclick="setNewOppGender('${g}')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${(newOppDraft.gender||'any')===g ? 'is-selected' : ''}">${l}</button>
                  `).join('')}
                </div>
              </div>

              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Where</label>
                <div class="flex gap-2">
                  ${oppModes.map(m => `
                    <button onclick="setNewOppMode('${m}')" class="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${newOppDraft.mode===m ? 'is-selected' : ''}">${Icon(m==='Online'?'link':'pin','w-4 h-4')} ${m}</button>
                  `).join('')}
                </div>
              </div>

              ${newOppDraft.type === 'Course' ? '' : oppFieldRow(newOppDraft.mode === 'Online' ? 'Platform / link' : 'Location', 'location', newOppDraft.mode === 'Online' ? 'e.g. Zoom, remote' : 'e.g. Accra, Ghana')}
              ${(newOppDraft.type === 'Course' || newOppDraft.mode === 'Online') ? oppFieldRow('Location (optional)', 'place', 'e.g. Accra, Ghana') : ''}
              ${oppFieldRow('Duration', 'duration', newOppDraft.type === 'Course' ? 'e.g. 4 weeks' : 'e.g. 3 months, Full-time, One-time')}
              ${newOppDraft.type === 'Course'
                ? oppFieldRow('Start date (optional)', 'deadline', 'e.g. Self-paced, or Starts Aug 10')
                : `
                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Deadline</label>
                  <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" oninput="onOppDeadlineDateInput(this)" value="${escapeHtml(newOppDraft.deadlineDateTyped || '')}" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none">
                  ${typedDateHintHTML()}
                  <div class="text-xs text-gray-400 mt-1">This listing disappears automatically once this date passes, so every admin's posts stay consistent.</div>
                </div>`}

              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Description &amp; requirements</label>
                <textarea oninput="updateNewOppField('description', this.value); updateOppDescCounter(this.value)" data-autogrow placeholder="${newOppDraft.type === 'Course' ? 'What will learners cover? Any prerequisites?' : 'What will they be doing? What do you need from applicants?'}" rows="5" class="w-full bg-gray-100 border border-gray-300 flow-outline rounded-2xl px-4 py-3 text-sm outline-none resize-none" style="overflow:hidden;">${escapeHtml(newOppDraft.description)}</textarea>
                <div id="opp-desc-counter" class="text-right" style="font-size:11px;margin-top:4px;color:${posterAppWordCount(newOppDraft.description) >= OPP_DESC_MIN_WORDS ? '#16a34a' : '#e11d48'};">${posterAppWordCount(newOppDraft.description)}/${OPP_DESC_MIN_WORDS} words minimum</div>
              </div>

              ${newOppDraft.type === 'Course' ? `
                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Enrollment</label>
                  <div class="text-xs text-gray-400 mb-2">Learners join a course by enrolling, not by applying; no application letter needed. Set whether enrollment is free or has a fee.</div>
                  <div class="flex gap-2 mb-3">
                    <button onclick="setNewOppPriceType('free')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${newOppDraft.priceType==='free' ? 'is-selected' : ''}">Free</button>
                    <button onclick="setNewOppPriceType('paid')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${newOppDraft.priceType==='paid' ? 'is-selected' : ''}">Paid</button>
                  </div>
                  ${newOppDraft.priceType === 'paid' ? oppFieldRow('Enrollment fee', 'price', 'e.g. GHS 150, or $20') : ''}
                </div>
                ${oppFieldRow('Email for enrollment questions (optional)', 'email', 'e.g. courses@yourorg.com', 'email')}
              ` : `
                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Apply via</label>
                  <div class="text-xs text-gray-400 mb-2">By default, applications go straight to you right here in Stitch -- no email needed. Choose Website instead if you'd rather applicants apply on your own site.</div>
                  <div class="flex gap-2 mb-3">
                    <button onclick="setNewOppApplyMethod('inapp')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${newOppDraft.applyMethod!=='website' ? 'is-selected' : ''}">In-app</button>
                    <button onclick="setNewOppApplyMethod('website')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${newOppDraft.applyMethod==='website' ? 'is-selected' : ''}">Website</button>
                  </div>
                  ${newOppDraft.applyMethod === 'website'
                    ? oppFieldRow('Website to receive applications', 'website', 'e.g. careers.yourorg.com/apply', 'url')
                    : ''}
                </div>
                ${newOppDraft.applyMethod === 'website' ? '' : `
                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Documents required from applicants (optional)</label>
                  <div class="text-xs text-gray-400 mb-2">A resume/CV is always required from applicants. Select any other documents you also want to require before they can submit.</div>
                  <div class="flex flex-col gap-2">
                    ${OPP_DOC_TYPES.map(t => {
                      const active = newOppDraft.requiredDocs.includes(t.id);
                      return `<button onclick="toggleNewOppRequiredDoc('${t.id}')" class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-left outline-pill ${active ? 'is-selected' : ''}"><span class="flex-1">${escapeHtml(t.label)}</span><span class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'text-white' : 'border border-gray-400'}" style="${active ? `background:${NAVY};` : ''}">${active ? '&#10003;' : ''}</span></button>`;
                    }).join('')}
                  </div>
                </div>`}
              `}

              <div class="text-center mt-2" style="padding-bottom:10px;">
                <button id="opp-submit-btn" onclick="submitNewOpportunity()" class="pill-cta w-full inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${isEditing ? 'Save Changes' : (newOppDraft.type === 'Course' ? 'Post Course' : 'Post Opportunity')}</button>
              </div>
            </div>
            </div>`;
        }

        // ---- Admin Dashboard (Profile tab pill, admins only) ----
        let adminDashboardTab = 'applications';
        let adminDashboardLoading = false;
        let adminPosterApplications = [];
        let adminOpenReports = [];
        let adminHistoryItems = [];
        let adminReviewedApplications = [];
        let adminExpandedReviewedId = null;
        let adminDetailUserId = null;
        // "Post an update" lives on its own page, opened from the + in the dashboard header.
        let adminComposeOpen = false;
        let adminComposeDraft = { title: '', message: '' };
        // Newer moderation columns (see poster-moderation.sql)
        let ADMIN_NEW_COLS = ', poster_email, poster_frozen_at, poster_blocked_at, poster_moderation_note';
        async function adminFetchProfiles(build){
          let res = await build();
          if (res && res.error && ADMIN_NEW_COLS) {
            ADMIN_NEW_COLS = '';
            res = await build();
          }
          return res;
        }
        let adminHistoryLoaded = false;
        let adminHistoryLoading = false;

        // From a "Stitch Bot cancellation" notification: open the admin dashboard on that tab
        function openAdminCancellations(){
          if (!isCurrentUserAdmin()) return;
          openAdminDashboard();
          setTimeout(function(){ try { switchAdminDashboardTab('cancellations'); } catch (e) {} }, 60);
        }
        function openAdminDashboard(){
          if (!isCurrentUserAdmin()) return;
          adminDashboardTab = 'applications';
          adminDetailUserId = null;
          adminComposeOpen = false;
          adminComposeDraft = { title: '', message: '' };
          adminHistoryLoaded = false;
          adminHistoryItems = [];
          adminReviewedApplications = [];
          adminExpandedReviewedId = null;
          if (typeof noticeComposeImageFile !== 'undefined') noticeComposeImageFile = null;
          if (typeof noticeComposeImagePreviewUrl !== 'undefined') noticeComposeImagePreviewUrl = null;
          openOverlay('adminDashboard');
          loadAdminDashboardData();
          // Creator payments data loads alongside so the tab counts (pending creators, payouts,
          // reports) are right
          if (typeof loadAdminCreatorData === 'function') { adminCreatorData.loaded = false; adminCreatorOpenId = null; adminPayoutRejectId = null; loadAdminCreatorData(); }
        }

        async function loadAdminDashboardData(){
          const sb = getSupabaseClient();
          if (!sb || !isCurrentUserAdmin()) return;
          adminDashboardLoading = true;
          refreshAdminDashboardDom();
          try {
            const [appsRes, reportsRes] = await Promise.all([
              adminFetchProfiles(() => sb.from(PROFILES_TABLE).select('user_id, poster_status, poster_intent, poster_role, poster_business_name, poster_business_info, poster_business_established, poster_business_category, poster_business_website, poster_business_document_url, poster_id_document_url, poster_id_document_back_url, poster_proof_of_residence_url, poster_id_type, poster_id_country, poster_id_verification_status, poster_id_verification_result, poster_selfie_url, poster_selfie_verification_status, poster_selfie_verification_result, poster_applied_at'+ADMIN_NEW_COLS).eq('poster_status', 'pending').order('poster_applied_at', { ascending: true })),
              sb.from(OPPORTUNITY_REPORTS_TABLE).select('*').eq('status', 'open').order('created_at', { ascending: false }),
            ]);
            const apps = (appsRes && appsRes.data) || [];
            const reports = (reportsRes && reportsRes.data) || [];
            const ids = Array.from(new Set([...apps.map(a => a.user_id), ...reports.map(r => r.reported_by)].filter(Boolean)));
            let peopleById = {};
            if (ids.length) {
              const { data: people } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, name, username, photo').in('user_id', ids);
              (people || []).forEach(p => { peopleById[p.user_id] = p; });
            }
            adminPosterApplications = apps.map(a => Object.assign({}, a, { person: peopleById[a.user_id] || null }));
            adminOpenReports = reports.map(r => Object.assign({}, r, {
              person: peopleById[r.reported_by] || null,
              job: findJob(r.opportunity_id) || null,
            }));
          } catch (e) { console.warn('Loading Admin Dashboard data threw an error:', e); }
          adminDashboardLoading = false;
          refreshAdminDashboardDom();
          healAdminDashboardPeople();
          setTimeout(healAdminDashboardPeople, 3000);
          setTimeout(healAdminDashboardPeople, 9000);
        }

        // Only swaps the tab pills and the tab's content in place
        let adminHealBusy = false;
        async function healAdminDashboardPeople(){
          if (adminHealBusy) return;
          const lists = [adminPosterApplications, adminReviewedApplications, adminOpenReports];
          const missing = [];
          lists.forEach(l => l.forEach(x => {
            const p = x.person;
            const id = x.user_id || x.reported_by;
            if (id && !(p && (p.name || p.username))) missing.push(x);
          }));
          if (!missing.length) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          adminHealBusy = true;
          try {
            const ids = Array.from(new Set(missing.map(x => x.user_id || x.reported_by)));
            const { data: people } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, name, username, photo').in('user_id', ids);
            const byId = {};
            (people || []).forEach(p => { byId[p.user_id] = p; });
            let changed = false;
            missing.forEach(x => {
              const p = byId[x.user_id || x.reported_by];
              if (p && (p.name || p.username)) { x.person = p; changed = true; }
            });
            if (changed) refreshAdminDashboardDom();
          } catch (e) { console.warn('Refreshing admin dashboard names failed:', e); }
          adminHealBusy = false;
        }

        function refreshAdminDashboardDom(){
          if (currentOverlayKind !== 'adminDashboard') return;
          if (adminComposeOpen) return; // don't redraw (and drop focus) while an update is being written
          const pills = document.getElementById('admin-tab-pills');
          const body = document.getElementById('admin-tab-body');
          if (pills && body) {
            const left = pills.scrollLeft;
            pills.innerHTML = adminDashboardTabPillsInnerHTML();
            pills.scrollLeft = left;
            body.innerHTML = adminBodyHTML();
            return;
          }
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = adminDashboardHTML();
        }

        function switchAdminDashboardTab(tab){
          adminDashboardTab = tab;
          adminExpandedReviewedId = null;
          refreshAdminDashboardDom();
          // Nudge the tapped pill fully into view (only scrolls the pill row, not the page).
          const pills = document.getElementById('admin-tab-pills');
          const btn = pills && pills.querySelector(`[data-admin-tab="${tab}"]`);
          if (pills && btn) {
            const l = btn.offsetLeft, r = l + btn.offsetWidth;
            if (l < pills.scrollLeft) pills.scrollTo({ left: Math.max(0, l - 12), behavior: 'smooth' });
            else if (r > pills.scrollLeft + pills.clientWidth) pills.scrollTo({ left: r - pills.clientWidth + 12, behavior: 'smooth' });
          }
          if (['approved','declined','frozen','blocked','log'].includes(tab) && !adminHistoryLoaded && !adminHistoryLoading) loadAdminHistoryData();
          if (typeof CREATOR_ADMIN_TABS !== 'undefined' && CREATOR_ADMIN_TABS.includes(tab) && !adminCreatorData.loaded && !adminCreatorData.loading) loadAdminCreatorData();
        }

        async function loadAdminHistoryData(){
          const sb = getSupabaseClient();
          if (!sb || !isCurrentUserAdmin()) return;
          adminHistoryLoading = true;
          refreshAdminDashboardDom();
          try {
            const [appsRes, reportsRes] = await Promise.all([
              adminFetchProfiles(() => sb.from(PROFILES_TABLE).select('user_id, poster_status, poster_intent, poster_role, poster_business_name, poster_business_info, poster_business_established, poster_business_category, poster_business_website, poster_business_document_url, poster_id_document_url, poster_id_document_back_url, poster_proof_of_residence_url, poster_id_type, poster_id_country, poster_id_verification_status, poster_selfie_url, poster_selfie_verification_status, poster_applied_at, poster_reviewed_at'+ADMIN_NEW_COLS).in('poster_status', ['approved', 'denied', 'frozen', 'blocked']).order('poster_reviewed_at', { ascending: false }).limit(200)),
              sb.from(OPPORTUNITY_REPORTS_TABLE).select('*').in('status', ['dismissed', 'reviewed']).order('created_at', { ascending: false }).limit(50),
            ]);
            const apps = (appsRes && appsRes.data) || [];
            const reports = (reportsRes && reportsRes.data) || [];
            const ids = Array.from(new Set([...apps.map(a => a.user_id), ...reports.map(r => r.reported_by)].filter(Boolean)));
            let peopleById = {};
            if (ids.length) {
              const { data: people } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, name, username, photo').in('user_id', ids);
              (people || []).forEach(p => { peopleById[p.user_id] = p; });
            }
            adminReviewedApplications = apps.map(a => Object.assign({}, a, { person: peopleById[a.user_id] || null }));
            adminHistoryItems = reports.map(r => ({
              kind: 'report',
              decision: r.status === 'reviewed' ? 'listing_removed' : 'dismissed',
              when: r.created_at,
              person: peopleById[r.reported_by] || null,
              job: findJob(r.opportunity_id) || null,
              reason: r.reason,
            }));
          } catch (e) { console.warn('Loading Admin Dashboard history threw an error:', e); }
          adminHistoryLoaded = true;
          adminHistoryLoading = false;
          refreshAdminDashboardDom();
          healAdminDashboardPeople();
        }

        // Plain-text log line (no card, no coloured badge) for closed reports.
        function adminHistoryCardHTML(item){
          const p = item.person || {};
          const who = p.username ? '@' + escapeHtml(p.username) : (p.name ? escapeHtml(p.name) : 'a user');
          const when = item.when ? fmtJobDate(new Date(item.when).getTime()) : '';
          const outcome = item.decision === 'listing_removed' ? 'Listing removed' : 'Dismissed';
          return `
            <div class="py-3 border-b border-gray-200">
              <div class="text-xs text-gray-400 mb-0.5">${outcome}${when ? ' · ' + when : ''}</div>
              <div class="text-sm text-gray-700">Report on ${item.job ? escapeHtml(item.job.title) : 'a listing'} by ${who}</div>
            </div>`;
        }

        // One approved/declined applicant: plain text on the page background
        function adminReviewedRowHTML(app){
          const p = app.person || {};
          const name = p.name || p.username || 'Unnamed user';
          const whenIso = app.poster_reviewed_at || app.poster_applied_at;
          const when = whenIso ? fmtJobDate(new Date(whenIso).getTime()) : '';
          const open = adminExpandedReviewedId === app.user_id;
          const roleLabel = (POSTER_ROLE_OPTIONS.find(([k]) => k === app.poster_role) || [null, app.poster_role || 'Not specified'])[1];
          const categoryLabel = (POSTER_CATEGORY_OPTIONS.find(([k]) => k === app.poster_business_category) || [null, ''])[1];
          const established = app.poster_business_established ? fmtJobDate(new Date(app.poster_business_established).getTime()) : '';
          const isApproved = app.poster_status === 'approved';
          const details = open ? `
            <div class="pt-3">
              <div class="text-xs text-gray-500 mb-2">${escapeHtml(roleLabel)}${categoryLabel ? ' · ' + escapeHtml(categoryLabel) : ''}${established ? ' · Est. ' + established : ''}${app.poster_business_website ? ` · <a href="${escapeHtml(app.poster_business_website)}" target="_blank" rel="noopener" style="color:${NAVY};">Website</a>` : ''}</div>
              ${app.poster_business_info ? `<div class="text-xs text-gray-600 mb-3" style="white-space:pre-wrap;">${escapeHtml(app.poster_business_info)}</div>` : `<div class="text-xs text-gray-400 mb-3">No additional details provided.</div>`}
              <div class="flex items-center gap-2 mb-2">
                ${posterIdVerificationBadgeHTML(app.poster_id_verification_status)}
                ${app.poster_id_type ? `<span class="text-[11px] text-gray-400">${escapeHtml(app.poster_id_type)}${app.poster_id_country ? ` (${escapeHtml(app.poster_id_country)})` : ''}</span>` : ''}
              </div>
              <div class="flex gap-2 mb-3">
                ${adminAttachmentPreviewHTML(app.poster_id_document_url, 'ID front')}
                ${app.poster_id_document_back_url ? adminAttachmentPreviewHTML(app.poster_id_document_back_url, 'ID back') : ''}
              </div>
              ${app.poster_selfie_url ? `<div class="flex items-center gap-2 mb-2">${posterSelfieVerificationBadgeHTML(app.poster_selfie_verification_status)}</div><div class="flex gap-2 mb-3">${adminAttachmentPreviewHTML(app.poster_selfie_url, 'Selfie')}</div>` : ''}
              ${app.poster_proof_of_residence_url ? `<div class="flex gap-2 mb-3">${adminAttachmentPreviewHTML(app.poster_proof_of_residence_url, 'Proof of residence')}</div>` : ''}
              ${app.poster_business_document_url ? `<div class="flex gap-2 mb-3">${adminAttachmentPreviewHTML(app.poster_business_document_url, 'Business doc')}</div>` : ''}
              ${isApproved
                ? `<button onclick="revokePosterApproval('${app.user_id}')" class="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-500">Remove approval</button>`
                : `<button onclick="restorePosterApproval('${app.user_id}')" class="w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-white" style="background:${NAVY};">Approve instead</button>`}
            </div>` : '';
          return `
            <div class="py-3 border-b border-gray-200 flex items-center gap-2">
              <button type="button" onclick="openAdminPosterDetail('${app.user_id}')" class="flex-1 min-w-0 flex items-center gap-3 text-left">
                <div class="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${p.photo ? `<img src="${escapeHtml(p.photo)}" class="w-full h-full object-cover">` : Icon('user','w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(name)}</div>
                  <div class="text-xs text-gray-400 truncate">${p.username ? '@' + escapeHtml(p.username) : ''}${app.poster_business_name ? (p.username ? ' · ' : '') + escapeHtml(app.poster_business_name) : ''}${when ? ' · ' + when : ''}</div>
                </div>
              </button>
              <button type="button" onclick="event.stopPropagation(); openAdminPosterMenu('${app.user_id}')" aria-label="More options" class="w-9 h-9 flex items-center justify-center text-gray-400 flex-shrink-0">${IconBold('dots','w-5 h-5')}</button>
            </div>`;
        }

        // ---- Moderation: three-dot menu, message, freeze, permanent block ----
        function adminCloseMenuSheet(){
          document.querySelectorAll('#admin-menu-backdrop, #admin-menu-sheet, #admin-menu-style, #admin-msg-backdrop, #admin-msg-sheet').forEach(el => el.remove());
        }
        function adminAfterChange(){
          adminCloseMenuSheet();
          adminDetailUserId = null;
          adminPosterApplications = adminPosterApplications.filter(a => a.poster_status === 'pending');
          adminHistoryLoaded = false;
          if (['approved','declined','frozen','blocked','log'].includes(adminDashboardTab)) loadAdminHistoryData();
          refreshAdminDashboardDom();
        }
        function openAdminPosterMenu(userId){
          const app = adminFindApplicant(userId);
          if (!app) return;
          adminCloseMenuSheet();
          const st = app.poster_status;
          const row = (fn, icon, label, sub, cls) => {
            const danger = cls && cls.indexOf('red') > -1;
            const pillBg = danger ? '#fef2f2' : '#eff6ff';
            return `
            <button onclick="${fn}" class="admin-menu-row w-full flex items-center gap-4 px-6 py-4 text-left ${cls || 'text-gray-800'}" style="background:transparent;">
              <span class="flex items-center justify-center flex-shrink-0" style="width:44px;height:44px;border-radius:9999px;background:${pillBg};">${Icon(icon,'w-6 h-6')}</span>
              <span class="flex-1 min-w-0"><span class="block text-base font-semibold" style="line-height:1.3;">${label}</span>${sub ? `<span class="block text-xs text-gray-400 font-normal" style="margin-top:3px;line-height:1.35;">${sub}</span>` : ''}</span>
            </button>`;
          };
          let rows = row(`adminOpenMessageSheet('${userId}')`, 'comment', 'Address report', 'Send them a personal notification');
          if (st === 'approved') rows += row(`adminFreezePoster('${userId}')`, 'lock', 'Freeze poster status', 'Pause posting without removing them');
          if (st === 'frozen') rows += row(`adminUnfreezePoster('${userId}')`, 'check', 'Unfreeze poster status', 'Restore their posting access');
          if (st === 'approved' || st === 'frozen') rows += row(`revokePosterApproval('${userId}')`, 'trash', 'Remove from posters', 'They can reapply later', 'text-red-500');
          if (st !== 'blocked') rows += row(`adminBlockPoster('${userId}')`, 'close', 'Block permanently', 'Their company and ID can never be used again', 'text-red-500');
          document.body.insertAdjacentHTML('beforeend', `
            <div id="admin-menu-backdrop" onclick="adminCloseMenuSheet()" style="position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.5);"></div>
            <div id="admin-menu-sheet" class="bg-white" style="position:fixed;left:0;right:0;bottom:0;z-index:11001;border-radius:24px 24px 0 0;padding:10px 0 calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:shareSheetSlideUp .22s cubic-bezier(0.16,1,0.3,1);max-width:640px;margin:0 auto;">
              <div style="width:48px;height:5px;border-radius:3px;background:#1f2937;margin:2px auto 8px;"></div>
              <div style="padding-top:6px;">${rows}</div>
            </div>
            <style id="admin-menu-style">#admin-menu-sheet .admin-menu-row + .admin-menu-row{border-top:1px solid #eef0f3;}#admin-menu-sheet .admin-menu-row{box-shadow:none;}</style>`);
        }

        function adminOpenMessageSheet(userId){
          const app = adminFindApplicant(userId);
          if (!app) return;
          adminCloseMenuSheet();
          const p = app.person || {};
          const name = p.name || p.username || 'this user';
          document.body.insertAdjacentHTML('beforeend', `
            <div id="admin-msg-sheet" class="bg-white" style="position:fixed;left:0;right:0;top:0;height:100dvh;z-index:11001;display:flex;flex-direction:column;max-width:640px;margin:0 auto;">
              <div style="position:relative;display:flex;align-items:center;justify-content:center;padding:calc(20px + env(safe-area-inset-top,0px)) 20px 12px;border-bottom:1px solid #eef0f3;">
                <button onclick="adminCloseMenuSheet()" aria-label="Back" style="position:absolute;left:20px;bottom:12px;color:${NAVY};">${IconBold('back','w-5 h-5')}</button>
                <div class="font-semibold font-display text-center" style="font-size:20px;color:${NAVY};">Address report</div>
              </div>
              <div style="flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;">
                <div class="text-xs text-gray-400 mb-4 text-center">They'll get this as a personal notification from Stitch.</div>
                <input id="admin-msg-title" type="text" maxlength="80" placeholder="Title (optional)" class="w-full mb-3 px-4 py-3 rounded-xl border border-gray-200 text-sm" />
                <textarea id="admin-msg-text" maxlength="600" placeholder="Type your message about their report or account…" class="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none" style="flex:1;min-height:140px;"></textarea>
              </div>
              <div style="display:flex;gap:8px;padding:12px 20px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #eef0f3;background:#fff;">
                <button onclick="adminCloseMenuSheet()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Cancel</button>
                <button id="admin-msg-send" onclick="adminSendPosterMessage('${userId}')" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Send</button>
              </div>
            </div>`);
          const vv = window.visualViewport;
          if (vv) {
            const fit = () => { const el = document.getElementById('admin-msg-sheet'); if (!el) { vv.removeEventListener('resize', fit); return; } el.style.height = vv.height + 'px'; el.style.top = vv.offsetTop + 'px'; };
            vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
          }
          setTimeout(() => { const t = document.getElementById('admin-msg-text'); if (t) t.focus(); }, 80);
        }

        async function adminSendPosterMessage(userId){
          const text = ((document.getElementById('admin-msg-text') || {}).value || '').trim();
          const title = ((document.getElementById('admin-msg-title') || {}).value || '').trim();
          if (!text) { openAppAlertModal('Type a message first.'); return; }
          const btn = document.getElementById('admin-msg-send');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
          const ok = await notifyUserRemote(userId, { type: 'admin_message', title: title || 'Message from Stitch', message: text });
          adminCloseMenuSheet();
          openAppAlertModal(ok ? 'Message sent.' : "Couldn't send the message. Please try again.");
        }

        async function adminSetStatusDirect(userId, status, extra){
          const sb = getSupabaseClient();
          if (!sb || !isCurrentUserAdmin()) return false;
          const me = await getCachedAuthUser();
          const patch = Object.assign({ poster_status: status, poster_reviewed_at: new Date().toISOString(), poster_reviewed_by: me ? me.id : null }, extra || {});
          let { error } = await sb.from(PROFILES_TABLE).update(patch).eq('user_id', userId);
          if (error && /poster_frozen_at|poster_blocked_at|poster_moderation_note/i.test(error.message || '')) {
            ['poster_frozen_at','poster_blocked_at','poster_moderation_note'].forEach(k => delete patch[k]);
            ({ error } = await sb.from(PROFILES_TABLE).update(patch).eq('user_id', userId));
          }
          if (error) { console.warn('Changing poster status failed:', error); return false; }
          return true;
        }

        function adminFreezePoster(userId){
          adminCloseMenuSheet();
          openAppConfirmModal('Freeze poster status?', "They keep their approval on record but can't post until you unfreeze them. They'll be notified.", 'Freeze', async () => {
            const ok = await adminSetStatusDirect(userId, 'frozen', { poster_frozen_at: new Date().toISOString() });
            if (!ok) { openAppAlertModal("Couldn't freeze this poster. Make sure poster-moderation.sql has been run, then try again."); return; }
            notifyUserRemote(userId, { type: 'poster_frozen', title: 'Poster access frozen', message: 'Your ability to post jobs & opportunities has been frozen while we review your account.' });
            const app = adminFindApplicant(userId); if (app) app.poster_status = 'frozen';
            adminAfterChange();
          });
        }
        function adminUnfreezePoster(userId){
          adminCloseMenuSheet();
          openAppConfirmModal('Unfreeze poster status?', 'They will be able to post opportunities again.', 'Unfreeze', async () => {
            const ok = await adminSetStatusDirect(userId, 'approved', { poster_frozen_at: null });
            if (!ok) { openAppAlertModal("Couldn't unfreeze this poster. Please try again."); return; }
            notifyUserRemote(userId, { type: 'poster_unfrozen', title: 'Poster access restored', message: 'Your ability to post jobs & opportunities has been restored.' });
            const app = adminFindApplicant(userId); if (app) app.poster_status = 'approved';
            adminAfterChange();
          });
        }
        function adminBlockPoster(userId){
          adminCloseMenuSheet();
          openAppConfirmModal('Block permanently?', "This can't be undone. Their account, email, business name/website and ID details are added to a blocklist, so none of them can be used to create or apply for a poster account again.", 'Block', async () => {
            const sb = getSupabaseClient();
            if (!sb || !isCurrentUserAdmin()) return;
            const { error } = await sb.rpc('block_poster', { target_user: userId, reason: 'Blocked by admin from Admin Dashboard' });
            if (error) { console.warn('block_poster failed:', error); openAppAlertModal("Couldn't block this poster. Make sure poster-moderation.sql has been run in Supabase, then try again."); return; }
            notifyUserRemote(userId, { type: 'poster_blocked', title: 'Poster access removed', message: 'Your account is no longer eligible to post jobs & opportunities on Stitch.' });
            const app = adminFindApplicant(userId); if (app) app.poster_status = 'blocked';
            adminAfterChange();
          });
        }

        // ---- Full-page view of one poster applicant (opened by tapping their name) ----
        function adminFindApplicant(userId){
          return adminReviewedApplications.find(a => a.user_id === userId)
            || adminPosterApplications.find(a => a.user_id === userId) || null;
        }
        function openAdminPosterDetail(userId){
          adminDetailUserId = userId;
          const ov = document.getElementById('overlay');
          if (ov) { ov.innerHTML = adminDashboardHTML(); const sc = ov.querySelector('.overflow-y-auto'); if (sc) sc.scrollTop = 0; }
        }
        function closeAdminPosterDetail(){
          adminDetailUserId = null;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = adminDashboardHTML();
        }
        function adminPosterDetailHTML(){
          const app = adminFindApplicant(adminDetailUserId);
          if (!app) { adminDetailUserId = null; return null; }
          const p = app.person || {};
          const name = p.name || p.username || 'Unnamed user';
          const roleLabel = (POSTER_ROLE_OPTIONS.find(([k]) => k === app.poster_role) || [null, app.poster_role || 'Not specified'])[1];
          const categoryLabel = (POSTER_CATEGORY_OPTIONS.find(([k]) => k === app.poster_business_category) || [null, ''])[1];
          const established = app.poster_business_established ? fmtJobDate(new Date(app.poster_business_established).getTime()) : '';
          const applied = app.poster_applied_at ? fmtJobDate(new Date(app.poster_applied_at).getTime()) : '';
          const reviewed = app.poster_reviewed_at ? fmtJobDate(new Date(app.poster_reviewed_at).getTime()) : '';
          const st = app.poster_status;
          const statusLabel = st === 'frozen' ? 'Frozen' : st === 'blocked' ? 'Blocked permanently' : '';
          const statusCls = st === 'blocked' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600';
          const field = (label, val) => val ? `<div class="py-2.5 border-b border-gray-100"><div class="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">${label}</div><div class="text-sm text-gray-800" style="white-space:pre-wrap;overflow-wrap:anywhere;">${val}</div></div>` : '';
          const attach = (url, label) => url ? `<div class="flex gap-2 mb-3">${adminAttachmentPreviewHTML(url, label)}</div>` : '';
          let actions = '';
          if (st === 'approved') actions = `<button onclick="revokePosterApproval('${app.user_id}')" class="w-full px-3 py-3 rounded-2xl text-sm font-semibold text-white bg-rose-500">Remove from posters</button>`;
          else if (st === 'frozen') actions = `<button onclick="adminUnfreezePoster('${app.user_id}')" class="w-full px-3 py-3 rounded-2xl text-sm font-semibold text-white" style="background:${NAVY};">Unfreeze poster status</button>`;
          else if (st === 'blocked') actions = `<div class="text-xs text-gray-400 text-center">This poster, their business and their ID are permanently blocked.</div>`;
          else if (st === 'denied') actions = `<button onclick="restorePosterApproval('${app.user_id}')" class="w-full px-3 py-3 rounded-2xl text-sm font-semibold text-white" style="background:${NAVY};">Approve as poster</button>`;
          else actions = `<div class="flex gap-2"><button onclick="reviewPosterApplication('${app.user_id}','denied')" class="flex-1 px-3 py-3 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-600">Deny</button><button onclick="reviewPosterApplication('${app.user_id}','approved')" class="flex-1 px-3 py-3 rounded-2xl text-sm font-semibold text-white" style="background:${NAVY};">Approve</button></div>`;
          return `
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
              <div style="margin:0 -1.25rem;">${overlayHeader('Creator details', '20px', 'closeAdminPosterDetail()', null, {right:true, pb: '10px'})}</div>
              <div class="flex items-center gap-4 pt-4 pb-5">
                <div class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${p.photo ? `<img src="${escapeHtml(p.photo)}" class="w-full h-full object-cover">` : Icon('user','w-9 h-9')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-lg text-gray-900 truncate">${escapeHtml(name)}</div>
                  <div class="text-sm text-gray-400 truncate">${p.username ? '@' + escapeHtml(p.username) : ''}</div>
                  ${statusLabel ? `<span class="inline-block mt-1.5 text-[11px] font-bold px-3 py-1 rounded-full ${statusCls}">${statusLabel}</span>` : ''}
                </div>
                <button type="button" onclick="openAdminPosterMenu('${app.user_id}')" aria-label="More options" class="w-10 h-10 flex items-center justify-center text-gray-500 flex-shrink-0">${IconBold('dots','w-5 h-5')}</button>
              </div>
              <div class="mb-4">
                ${field('Email', app.poster_email ? `<a href="mailto:${escapeHtml(app.poster_email)}" style="color:${NAVY};">${escapeHtml(app.poster_email)}</a>` : '<span class="text-gray-400">Not on file (applied before emails were collected)</span>')}
                ${field('Business / organisation', app.poster_business_name ? escapeHtml(app.poster_business_name) : '')}
                ${field('Role', escapeHtml(roleLabel))}
                ${field('Category', categoryLabel ? escapeHtml(categoryLabel) : '')}
                ${field('Established', established)}
                ${field('Website', app.poster_business_website ? `<a href="${escapeHtml(app.poster_business_website)}" target="_blank" rel="noopener" style="color:${NAVY};">${escapeHtml(app.poster_business_website)}</a>` : '')}
                ${field('About', app.poster_business_info ? escapeHtml(app.poster_business_info) : 'No additional details provided.')}
                ${field('Applied', applied)}
                ${field('Last reviewed', reviewed)}
              </div>
              <div class="mb-4 pt-2">
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                  ${posterIdVerificationBadgeHTML(app.poster_id_verification_status)}
                  ${app.poster_id_type ? `<span class="text-xs text-gray-500">${escapeHtml(app.poster_id_type)}${app.poster_id_country ? ` (${escapeHtml(app.poster_id_country)})` : ''}</span>` : ''}
                </div>
                <div class="flex gap-2 mb-3">
                  ${adminAttachmentPreviewHTML(app.poster_id_document_url, 'ID front')}
                  ${app.poster_id_document_back_url ? adminAttachmentPreviewHTML(app.poster_id_document_back_url, 'ID back') : ''}
                </div>
                ${app.poster_selfie_url ? `<div class="flex items-center gap-2 mb-2">${posterSelfieVerificationBadgeHTML(app.poster_selfie_verification_status)}</div>${attach(app.poster_selfie_url, 'Selfie')}` : ''}
                ${attach(app.poster_proof_of_residence_url, 'Proof of residence')}
                ${attach(app.poster_business_document_url, 'Business doc')}
              </div>
              ${actions}
            </div>`;
        }

        function toggleAdminReviewedRow(userId){
          adminExpandedReviewedId = adminExpandedReviewedId === userId ? null : userId;
          refreshAdminDashboardDom();
        }

        async function setPosterDecision(userId, decision){
          const sb = getSupabaseClient();
          if (!sb || !isCurrentUserAdmin()) return;
          const me = await getCachedAuthUser();
          try {
            const { error } = await sb.from(PROFILES_TABLE).update({
              poster_status: decision,
              poster_reviewed_at: new Date().toISOString(),
              poster_reviewed_by: me ? me.id : null,
            }).eq('user_id', userId);
            if (error) { openAppAlertModal("Couldn't save that change. Please try again."); return; }
            notifyUserRemote(userId, {
              type: decision === 'approved' ? 'poster_approved' : 'poster_denied',
              title: decision === 'approved' ? 'You can now post on Career Space' : 'Poster access update',
              message: decision === 'approved'
                ? "Your application to post jobs & opportunities was approved. Open Career Space's menu to post your first listing."
                : "Your access to post jobs & opportunities has been removed. You're welcome to update your details and reapply.",
            });
            const app = adminReviewedApplications.find(a => a.user_id === userId);
            if (app) { app.poster_status = decision; app.poster_reviewed_at = new Date().toISOString(); }
            adminExpandedReviewedId = null;
            adminDetailUserId = null;
            refreshAdminDashboardDom();
          } catch (e) { console.warn('Changing poster decision threw an error:', e); }
        }

        function revokePosterApproval(userId){
          if (typeof adminCloseMenuSheet === 'function') adminCloseMenuSheet();
          openAppConfirmModal('Remove from posters?', "They won't be able to post opportunities anymore. They can reapply later.", 'Remove', () => setPosterDecision(userId, 'denied'));
        }
        function restorePosterApproval(userId){
          setPosterDecision(userId, 'approved');
        }

        async function reviewPosterApplication(userId, decision){
          const sb = getSupabaseClient();
          if (!sb || !isCurrentUserAdmin()) return;
          const me = await getCachedAuthUser();
          try {
            const { error } = await sb.from(PROFILES_TABLE).update({
              poster_status: decision,
              poster_reviewed_at: new Date().toISOString(),
              poster_reviewed_by: me ? me.id : null,
            }).eq('user_id', userId);
            if (error) { openAppAlertModal("Couldn't save that decision. Please try again."); return; }
            notifyUserRemote(userId, {
              type: decision === 'approved' ? 'poster_approved' : 'poster_denied',
              title: decision === 'approved' ? 'You can now post on Career Space' : 'Poster application update',
              message: decision === 'approved'
                ? "Your application to post jobs & opportunities was approved. Open Career Space's menu to post your first listing."
                : "Your application to post jobs & opportunities wasn't approved this time. You're welcome to update your details and reapply.",
            });
            adminPosterApplications = adminPosterApplications.filter(a => a.user_id !== userId);
            adminDetailUserId = null;
            adminHistoryLoaded = false;
            refreshAdminDashboardDom();
          } catch (e) { console.warn('Reviewing poster application threw an error:', e); }
        }

        async function reviewOpportunityReport(reportId, action){
          const sb = getSupabaseClient();
          if (!sb || !isCurrentUserAdmin()) return;
          const report = adminOpenReports.find(r => r.id === reportId);
          try {
            if (action === 'delete_listing' && report && report.opportunity_id) {
              const job = findJob(report.opportunity_id);
              if (job) {
                const bucket = jobBucketFor(job);
                const idx = bucket.indexOf(job);
                if (idx !== -1) bucket.splice(idx, 1);
                await deleteOpportunityRemote(job.id);
              }
            }
            await sb.from(OPPORTUNITY_REPORTS_TABLE).update({ status: action === 'delete_listing' ? 'reviewed' : 'dismissed' }).eq('id', reportId);
            adminOpenReports = adminOpenReports.filter(r => r.id !== reportId);
            refreshAdminDashboardDom();
            const jobsContentEl = document.getElementById('jobs-content');
            if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
          } catch (e) { console.warn('Reviewing report threw an error:', e); }
        }

        function adminDashboardTabPillsInnerHTML(){
          const approvedCount = adminReviewedApplications.filter(x => x.poster_status === 'approved').length;
          const declinedCount = adminReviewedApplications.filter(x => x.poster_status === 'denied').length;
          const frozenCount = adminReviewedApplications.filter(x => x.poster_status === 'frozen').length;
          const blockedCount = adminReviewedApplications.filter(x => x.poster_status === 'blocked').length;
          const tabs = [['applications', `Pending${adminPosterApplications.length ? ` (${adminPosterApplications.length})` : ''}`], ['approved', `Approved${adminHistoryLoaded ? ` (${approvedCount})` : ''}`], ['declined', `Declined${adminHistoryLoaded ? ` (${declinedCount})` : ''}`], ['frozen', `Frozen${adminHistoryLoaded ? ` (${frozenCount})` : ''}`], ['blocked', `Blocked${adminHistoryLoaded ? ` (${blockedCount})` : ''}`], ['reports', `Reports${adminOpenReports.length ? ` (${adminOpenReports.length})` : ''}`], ['log', 'Report log']].concat(typeof creatorAdminTabs === 'function' ? creatorAdminTabs() : []).concat([['mydashboard', 'My Dashboard']]);
          return tabs.map(([key, label]) => `
                <button data-admin-tab="${key}" onclick="${key === 'mydashboard' ? 'openDashboardFromAdmin()' : `switchAdminDashboardTab('${key}')`}" class="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${adminDashboardTab===key ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${adminDashboardTab===key ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${label}</button>
              `).join('') + '<span class="flex-shrink-0" style="width:0.75rem;" aria-hidden="true"></span>';
        }
        function adminDashboardTabPillsHTML(){
          return `
            <div id="admin-tab-pills" class="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4" style="margin-left:-1.25rem;margin-right:-1.25rem;padding-left:1.25rem;padding-right:1.25rem;">${adminDashboardTabPillsInnerHTML()}</div>`;
        }

        // Guesses whether a poster-application attachment URL is an image (shown as an actual
        // thumbnail) or a document like a PDF (opened in the same in-app doc viewer messaging uses
        async function careerOpenResume(){
          const p = (typeof careerStartProfile !== 'undefined') ? careerStartProfile : null;
          const u = p && p.resumeDataUrl;
          if (!u) return;
          const name = (p.resumeFileName || 'resume');
          if (String(u).indexOf('data:') === 0) {
            const a = document.createElement('a'); a.href = u; a.download = name; a.target = '_blank';
            document.body.appendChild(a); a.click(); a.remove(); return;
          }
          const w = window.open('', '_blank');
          let href = u;
          try {
            const sb = getSupabaseClient();
            const m = String(u).match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/resume-files\/([^?#]+)/);
            if (sb && m) {
              const { data, error } = await sb.storage.from('resume-files').createSignedUrl(decodeURIComponent(m[1]), 600);
              if (!error && data && data.signedUrl) href = data.signedUrl;
            }
          } catch (e) {}
          if (w) w.location.href = href; else window.location.href = href;
        }

        function adminAttachmentKind(url){
          const clean = (url || '').split('?')[0].toLowerCase();
          if (/\.(jpe?g|png|gif|webp|bmp|heic)$/.test(clean)) return 'image';
          return 'doc';
        }
        // Renders one applicant attachment (photo / ID / business doc) so an admin can see what
        // was actually submitted at a glance, and open it in place
        async function adminSignPosterFile(url){
          try {
            const sb = getSupabaseClient();
            const m = String(url || '').match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/(poster-id-documents|poster-selfies|poster-proof-of-residence|poster-business-documents)\/([^?#]+)/);
            if (!sb || !m) return url;
            const { data, error } = await sb.storage.from(m[1]).createSignedUrl(decodeURIComponent(m[2]), 600);
            return (!error && data && data.signedUrl) ? data.signedUrl : url;
          } catch (e) { return url; }
        }
        // Called by the placeholder <img> once it loads: swaps in the signed URL exactly once.
        async function adminHydratePrivateImg(img){
          if (!img || img.dataset.done) return;
          img.dataset.done = '1';
          img.src = await adminSignPosterFile(decodeURIComponent(img.dataset.src || ''));
        }
        async function adminOpenPrivateFile(encodedUrl, kind, encodedName){
          const signed = await adminSignPosterFile(decodeURIComponent(encodedUrl));
          if (kind === 'image') openConvoImageViewer(encodeURIComponent(signed), true);
          else openConvoDocViewer(encodeURIComponent(signed), encodedName);
        }
        function adminAttachmentPreviewHTML(url, label){
          if (!url) return `<span class="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-500">${Icon('doc','w-3.5 h-3.5')} No ${label.toLowerCase()}</span>`;
          const kind = adminAttachmentKind(url);
          const enc = encodeURIComponent(url);
          if (kind === 'image') {
            return `
              <button type="button" onclick="adminOpenPrivateFile('${enc}','image','')" class="flex flex-col rounded-2xl overflow-hidden bg-gray-100 flex-1" style="min-width:130px;">
                <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" data-src="${enc}" onload="adminHydratePrivateImg(this)" class="w-full object-cover" style="height:150px;" alt="${escapeHtml(label)}">
                <span class="text-xs font-semibold text-gray-600 px-3 py-2 text-center">${escapeHtml(label)} · tap to enlarge</span>
              </button>`;
          }
          const fileName = `${label}${/\.pdf$/i.test(url) ? '.pdf' : ''}`;
          return `
            <button type="button" onclick="adminOpenPrivateFile('${enc}','doc','${encodeURIComponent(fileName)}')" class="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gray-100 text-gray-600 flex-1" style="min-width:130px;height:150px;">
              ${Icon('doc','w-7 h-7')}
              <span class="text-xs font-semibold px-2 text-center">${escapeHtml(label)} · view document</span>
            </button>`;
        }

        // Shows what the automated Smile ID check found, if anything
        function posterIdVerificationBadgeHTML(status){
          const map = {
            pending:      { bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Checking ID…' },
            verified:     { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'ID auto-verified' },
            needs_review: { bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'ID needs a closer look' },
            failed:       { bg: 'bg-rose-50',    text: 'text-rose-600',    label: "ID didn't match" },
            error:        { bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'Auto-check unavailable' },
          };
          const m = map[status];
          if (!m) return '';
          return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${m.bg} ${m.text} flex-shrink-0">${m.label}</span>`;
        }

        // Same idea as posterIdVerificationBadgeHTML above, for the selfie liveness + face-match
        // check (see verifyPosterSelfieRemote)
        function posterSelfieVerificationBadgeHTML(status){
          const map = {
            pending:      { bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Checking selfie…' },
            verified:     { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Face match verified' },
            needs_review: { bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Selfie needs a closer look' },
            failed:       { bg: 'bg-rose-50',    text: 'text-rose-600',    label: "Selfie didn't match" },
            error:        { bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'Auto-check unavailable' },
          };
          const m = map[status];
          if (!m) return '';
          return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${m.bg} ${m.text} flex-shrink-0">${m.label}</span>`;
        }

        function adminApplicationCardHTML(app){
          const p = app.person || {};
          const roleLabel = (POSTER_ROLE_OPTIONS.find(([k]) => k === app.poster_role) || [null, app.poster_role || 'Not specified'])[1];
          const categoryLabel = (POSTER_CATEGORY_OPTIONS.find(([k]) => k === app.poster_business_category) || [null, ''])[1];
          const established = app.poster_business_established ? fmtJobDate(new Date(app.poster_business_established).getTime()) : '';
          return `
            <div class="py-4 mb-1 border-b border-gray-200">
              <div onclick="openAdminPosterDetail('${app.user_id}')" class="flex items-center gap-3 mb-2 cursor-pointer">
                <div class="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : Icon('user','w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">${escapeHtml(p.name || p.username || 'Unnamed user')}</div>
                  <div class="text-xs text-gray-400 truncate">${p.username ? '@' + escapeHtml(p.username) : ''}</div>
                </div>
                <span class="text-[10px] font-bold uppercase flex-shrink-0 text-gray-400">${escapeHtml(roleLabel)}</span>
                <button type="button" onclick="event.stopPropagation(); openAdminPosterMenu('${app.user_id}')" aria-label="More options" class="w-8 h-8 flex items-center justify-center text-gray-400 flex-shrink-0">${IconBold('dots','w-5 h-5')}</button>
              </div>
              ${app.poster_business_name ? `<div class="text-xs font-semibold text-gray-700 mb-1">${escapeHtml(app.poster_business_name)}</div>` : ''}
              <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400 mb-2">
                ${categoryLabel ? `<span>${escapeHtml(categoryLabel)}</span>` : ''}
                ${established ? `<span>Est. ${established}</span>` : ''}
                ${app.poster_business_website ? `<a href="${escapeHtml(app.poster_business_website)}" target="_blank" rel="noopener" style="color:${NAVY};">Website</a>` : ''}
              </div>
              ${app.poster_business_info ? `<div class="text-xs text-gray-600 mb-3" style="white-space:pre-wrap;">${escapeHtml(app.poster_business_info)}</div>` : `<div class="text-xs text-gray-400 mb-3">No additional details provided.</div>`}
              <div class="flex items-center gap-2 mb-2">
                ${posterIdVerificationBadgeHTML(app.poster_id_verification_status)}
                ${app.poster_id_type ? `<span class="text-[11px] text-gray-400">${escapeHtml(app.poster_id_type)}${app.poster_id_country ? ` (${escapeHtml(app.poster_id_country)})` : ''}</span>` : ''}
              </div>
              <div class="flex gap-2 mb-3">
                ${adminAttachmentPreviewHTML(app.poster_id_document_url, 'ID front')}
                ${app.poster_id_document_back_url ? adminAttachmentPreviewHTML(app.poster_id_document_back_url, 'ID back') : ''}
              </div>
              <div class="flex items-center gap-2 mb-2">
                ${posterSelfieVerificationBadgeHTML(app.poster_selfie_verification_status)}
              </div>
              ${app.poster_selfie_url ? `<div class="flex gap-2 mb-3">${adminAttachmentPreviewHTML(app.poster_selfie_url, 'Selfie')}</div>` : ''}
              ${app.poster_proof_of_residence_url ? `<div class="flex gap-2 mb-3">${adminAttachmentPreviewHTML(app.poster_proof_of_residence_url, 'Proof of residence')}</div>` : ''}
              ${app.poster_business_document_url ? `<div class="flex gap-2 mb-3">${adminAttachmentPreviewHTML(app.poster_business_document_url, 'Business doc')}</div>` : ''}
              <div class="flex gap-2">
                <button onclick="reviewPosterApplication('${app.user_id}','denied')" class="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600">Deny</button>
                <button onclick="reviewPosterApplication('${app.user_id}','approved')" class="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold text-white" style="background:${NAVY};">Approve</button>
              </div>
            </div>`;
        }

        function adminReportCardHTML(report){
          const p = report.person || {};
          const job = report.job;
          return `
            <div class="bg-white rounded-3xl p-4 shadow-sm mb-3">
              <div class="text-sm font-semibold text-gray-800 mb-1 truncate">${job ? escapeHtml(job.title) : 'Listing no longer available'}</div>
              <div class="text-xs text-gray-400 mb-2">Reported by ${p.username ? '@' + escapeHtml(p.username) : (p.name ? escapeHtml(p.name) : 'a user')}${report.created_at ? ' · ' + fmtJobDate(new Date(report.created_at).getTime()) : ''}</div>
              ${(() => {
                // Reports are saved as "<selected category>\n<optional details>": show the category as a
                // bold heading
                const raw = String(report.reason || '').trim();
                if (!raw) return `<div class="text-xs text-gray-600 bg-gray-50 rounded-2xl p-3 mb-3">No reason given.</div>`;
                const nl = raw.indexOf('\n');
                const cat = nl === -1 ? raw : raw.slice(0, nl);
                const more = nl === -1 ? '' : raw.slice(nl + 1).trim();
                return `<div class="text-xs text-gray-600 bg-gray-50 rounded-2xl p-3 mb-3" style="white-space:pre-wrap;"><div class="font-semibold text-gray-800">${escapeHtml(cat)}</div>${more ? `<div style="margin-top:4px;">${escapeHtml(more)}</div>` : ''}</div>`;
              })()}
              <div class="flex gap-2">
                <button onclick="reviewOpportunityReport('${report.id}','dismiss')" class="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600">Dismiss</button>
                ${job ? `<button onclick="openJobDetail('${job.id}')" class="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600">View listing</button>` : ''}
                <button onclick="reviewOpportunityReport('${report.id}','delete_listing')" class="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-500">Remove listing</button>
              </div>
            </div>`;
        }

        function adminBodyHTML(){
          const tab0 = adminDashboardTab;
          if (typeof CREATOR_ADMIN_TABS !== 'undefined' && CREATOR_ADMIN_TABS.includes(tab0)) return adminBodyCoreHTML();
          let charts = '';
          try { charts = adminPosterChartsHTML(tab0); } catch (e) { charts = ''; }
          return charts + adminBodyCoreHTML();
        }
        function adminBodyCoreHTML(){
          const empty = msg => `<div class="text-center text-gray-400 text-sm py-8">${msg}</div>`;
          const tab = adminDashboardTab;
          if (typeof CREATOR_ADMIN_TABS !== 'undefined' && CREATOR_ADMIN_TABS.includes(tab)) return creatorAdminBodyHTML(tab);
          if (tab === 'approved' || tab === 'declined' || tab === 'frozen' || tab === 'blocked' || tab === 'log') {
            if (adminHistoryLoading || !adminHistoryLoaded) return empty('Loading…');
            if (tab === 'log') return adminHistoryItems.length ? adminHistoryItems.map(adminHistoryCardHTML).join('') : empty('No closed reports yet.');
            const want = tab === 'approved' ? 'approved' : tab === 'frozen' ? 'frozen' : tab === 'blocked' ? 'blocked' : 'denied';
            const rows = adminReviewedApplications.filter(a => a.poster_status === want);
            return rows.length ? rows.map(adminReviewedRowHTML).join('') : empty(tab === 'approved' ? 'No approved posters.' : tab === 'frozen' ? 'No frozen posters.' : tab === 'blocked' ? 'No blocked posters.' : 'No declined applications.');
          }
          if (adminDashboardLoading) return empty('Loading…');
          if (tab === 'applications') return adminPosterApplications.length ? adminPosterApplications.map(adminReviewedRowHTML).join('') : `<div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">No pending poster applications.</div>`;
          return adminOpenReports.length ? adminOpenReports.map(adminReportCardHTML).join('') : `<div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">No open reports.</div>`;
        }

        // Same centred header as every other page, plus a + on the right that opens "Post an
        // update"
        function adminDashboardHeaderHTML(){
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5" style="padding-bottom:10px;">
                <div class="relative flex items-center justify-center">
                  <button onclick="overlayGoBack()" aria-label="Back" class="absolute flex items-center" style="left:0;top:50%;transform:translateY(-50%);">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <div class="font-semibold text-lg font-display grad-text text-center" style="font-size:20px;">Admin Dashboard</div>
                  <button onclick="openAdminCompose()" aria-label="Post an update" class="absolute flex items-center" style="right:0;top:50%;transform:translateY(-50%);">${gradIcon(IconBold('plus','w-6 h-6'))}</button>
                </div>
              </div>
            </div>`;
        }
        function openAdminCompose(){
          adminComposeOpen = true;
          const ov = document.getElementById('overlay');
          if (ov) { ov.innerHTML = adminDashboardHTML(); const sc = ov.querySelector('.overflow-y-auto'); if (sc) sc.scrollTop = 0; }
        }
        function closeAdminCompose(){
          adminComposeOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = adminDashboardHTML();
        }
        function adminComposeHTML(){
          const hasImg = typeof noticeComposeImagePreviewUrl !== 'undefined' && noticeComposeImagePreviewUrl;
          return `
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
              <div style="margin:0 -1.25rem;">${overlayHeader('Post an update', '20px', 'closeAdminCompose()', null, {center:true, pb: '10px'})}</div>
              <div class="max-w-2xl mx-auto pt-3">
                <div class="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                  <input id="notice-compose-title" type="text" value="${escapeHtml(adminComposeDraft.title)}" oninput="adminComposeDraft.title=this.value" placeholder="Title (optional)" class="w-full mb-3 px-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
                  <textarea id="notice-compose-message" oninput="adminComposeDraft.message=this.value" placeholder="What's the update?" rows="6" class="w-full mb-3 px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none">${escapeHtml(adminComposeDraft.message)}</textarea>
                  <div class="mb-3">${hasImg ? `
                    <div class="relative inline-block">
                      <img src="${noticeComposeImagePreviewUrl}" class="rounded-xl max-h-40" />
                      <button onclick="removeNoticeComposeImage()" class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs">✕</button>
                    </div>` : ''}</div>
                  <input id="notice-compose-image-input" type="file" accept="image/*" class="hidden" onchange="onNoticeComposeImageSelected(this)" />
                  <button onclick="document.getElementById('notice-compose-image-input').click()" class="w-full mb-3 py-2.5 rounded-xl font-medium text-sm bg-gray-100">${hasImg ? 'Change image' : 'Add image (optional)'}</button>
                  <button id="notice-compose-submit-btn" onclick="submitAdminNotice()" class="w-full py-2.5 rounded-xl font-semibold text-sm text-white notice-compose-submit-btn" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">Post update</button>
                </div>
              </div>
            </div>`;
        }

        function adminDashboardHTML(){
          if (adminComposeOpen) return adminComposeHTML();
          if (adminDetailUserId) { const d = adminPosterDetailHTML(); if (d) return d; }
          const allJobsList = allJobs();
          const userPostedCount = allJobsList.filter(j => j.createdByRole === 'user').length;
          const adminPostedCount = allJobsList.length - userPostedCount;
          return `
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
              <div style="margin:0 -1.25rem;">${adminDashboardHeaderHTML()}</div>
              <div class="grid grid-cols-3 gap-2 mb-5" style="margin-top:calc(20px - 0.75rem);">
                <div class="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <div class="text-xl font-bold" style="color:${NAVY};">${allJobsList.length}</div>
                  <div class="text-[10px] text-gray-400">Live listings</div>
                </div>
                <div class="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <div class="text-xl font-bold" style="color:${NAVY};">${userPostedCount}</div>
                  <div class="text-[10px] text-gray-400">By users</div>
                </div>
                <div class="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <div class="text-xl font-bold" style="color:${NAVY};">${adminPostedCount}</div>
                  <div class="text-[10px] text-gray-400">By admins</div>
                </div>
              </div>
              ${adminDashboardTabPillsHTML()}
              <div id="admin-tab-body">${adminBodyHTML()}</div>
            </div>`;
        }

        let careerAnalyticsTab = 'saved';
        function careerAnalyticsGroups(){
          const jobs = allJobs();
          const appliedJobs = jobs.filter(j => isJobApplied(j));
          return [
            { key: 'saved', label: 'Saved', items: jobs.filter(j => j.saved), empty: 'No saved opportunities yet. Tap the bookmark on a listing to save it.' },
            { key: 'internships', label: 'Internships', items: appliedJobs.filter(j => j.type === 'Internship'), empty: "You haven't applied to any internships yet." },
            { key: 'courses', label: 'Courses', items: appliedJobs.filter(j => j.type === 'Course'), empty: "You haven't enrolled in any courses yet." },
            { key: 'posted', label: 'Posted', items: jobs.filter(j => j.mine), empty: "You haven't posted any opportunities yet." },
          ];
        }
        function careerAnalyticsTabStyle(on){
          return `padding:12px 2px;font-size:14px;font-weight:${on ? 700 : 600};white-space:nowrap;background:none;border:0;border-bottom:2px solid ${on ? ROYAL : 'transparent'};margin-bottom:-1px;color:${on ? ROYAL : '#6b7280'};`;
        }
        function careerAnalyticsListHTML(){
          const groups = careerAnalyticsGroups();
          const active = groups.find(g => g.key === careerAnalyticsTab) || groups[0];
          return active.items.length
            ? active.items.map(it => jobCard(it).replace('onclick="', 'onclick="overlayReturnTo=\'careerAnalytics\';')).join('')
            : `<div class="text-sm text-gray-400 text-center" style="padding:28px 0;">${active.empty}</div>`;
        }
        // Updates the tab styles and the list in place (no full re-render), so the tab row and the
        // page keep their scroll position and tapping the last tab doesn't jump back to the first
        function setCareerAnalyticsTab(key){
          careerAnalyticsTab = key;
          document.querySelectorAll('#career-analytics-tabs [data-tab]').forEach(btn => {
            btn.setAttribute('style', careerAnalyticsTabStyle(btn.getAttribute('data-tab') === key));
          });
          const list = document.getElementById('career-analytics-list');
          if (list) list.innerHTML = careerAnalyticsListHTML();
        }

        function openJobFromAnalytics(id){
          const job = findJob(id);
          if (job && isJobOwnedByCurrentUser(job)) { openJobDetail(id); return; }
          activeJobId = id;
          jobDetailMenuOpen = false;
          openOverlayFrom('careerAnalytics', 'jobDetail');
        }

        // Applications-sent-per-week graph (last 6 weeks).
        function careerAnalyticsGraphHTML(appliedJobs){
          const WEEKS = 6, DAY = 86400000, now = Date.now();
          const counts = new Array(WEEKS).fill(0);
          appliedJobs.forEach(job => {
            const app = jobApplication(job);
            const ts = app && (app.appliedDate || app.appliedAt);
            if (!ts) return;
            const idx = WEEKS - 1 - Math.floor((now - ts) / (7 * DAY));
            if (idx >= 0 && idx < WEEKS) counts[idx]++;
          });
          const max = Math.max(1, ...counts);
          const total = counts.reduce((s, n) => s + n, 0);
          const cols = counts.map((n, i) => {
            const start = new Date(now - (WEEKS - 1 - i) * 7 * DAY);
            const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const h = n ? Math.max(8, Math.round((n / max) * 100)) : 3;
            return `<div class="act-graph-col"><div class="act-graph-num">${n || ''}</div><div class="act-graph-track"><div class="act-graph-bar${n ? '' : ' act-graph-bar-empty'}" style="height:${h}%;"></div></div><div class="act-graph-label">${label}</div></div>`;
          }).join('');
          return `
            <div>
              <div class="flex items-center justify-between" style="margin-bottom:10px;">
                <div class="font-semibold text-sm text-gray-800">Applications sent</div>
                <div class="text-xs text-gray-400">Last 6 weeks${total ? ` &middot; ${total}` : ''}</div>
              </div>
              <div class="act-graph">${cols}</div>
            </div>`;
        }

        // Everything the user has interacted with (applied / saved / posted) as plain rows.
        function careerActivityListHTML(){
          const rows = [];
          allJobs().forEach(job => {
            const app = jobApplication(job);
            const applied = !!app;
            const saved = !!job.saved;
            const mine = !!job.mine;
            if (!applied && !saved && !mine) return;
            const ts = applied ? (app.appliedDate || app.appliedAt || 0) : 0;
            const tags = [];
            if (applied) tags.push((job.type === 'Course' ? 'Enrolled' : 'Applied') + (ts ? ' ' + fmtJobDate(ts) : ''));
            if (mine) tags.push('Posted');
            if (saved) tags.push('Saved');
            rows.push({ job, ts, rank: applied ? 0 : (mine ? 1 : 2), tags });
          });
          rows.sort((x, y) => x.rank - y.rank || y.ts - x.ts);
          if (!rows.length) return '';
          return `
            <div>
              <div class="font-semibold text-sm text-gray-800" style="margin-bottom:4px;">Your activity</div>
              <div class="act-list">
                ${rows.map(({ job, tags }) => {
                  const open = job.isCatalogCourse ? `openCourseDetail('${job.id}')` : `openJobOrClassroom('${job.id}')`;
                  const meta = [job.type, job.company].filter(Boolean).map(escapeHtml).concat(tags.map(escapeHtml)).join(' &middot; ');
                  return `
                    <button type="button" onclick="overlayReturnTo='careerAnalytics';${open}" class="act-row w-full text-left flex items-center gap-3">
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(job.title || 'Untitled')}</div>
                        <div class="text-xs text-gray-400 truncate" style="margin-top:2px;">${meta}</div>
                      </div>
                      ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
                    </button>`;
                }).join('')}
              </div>
            </div>`;
        }

        function careerAnalyticsHTML(){
          const jobs = allJobs();
          const appliedJobs = jobs.filter(j => isJobApplied(j));
          const savedCount = jobs.filter(j => j.saved).length;
          const postedCount = jobs.filter(j => j.mine).length;
          const internshipsApplied = appliedJobs.filter(j => j.type === 'Internship').length;
          const coursesEnrolled = appliedJobs.filter(j => j.type === 'Course').length;
          const trackedApplications = appliedJobs.filter(j => j.type !== 'Course');
          return `
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
            ${overlayHeader('Analytics', '20px', null, null, { right: true })}
            <div class="p-5 space-y-4">
              <div class="rounded-3xl p-5 text-white stat-hero-pill" style="background:linear-gradient(135deg,${ROYAL},${NAVY});">
                <div class="text-xs text-blue-200 font-semibold uppercase tracking-wide">Applications sent</div>
                <div class="text-3xl font-bold font-display">${appliedJobs.length}</div>
              </div>
              ${careerAnalyticsGraphHTML(appliedJobs)}
              ${careerActivityListHTML()}
              <div>
                <div class="font-semibold text-sm text-gray-800 mb-3">Application status</div>
                ${trackedApplications.length ? `
                  <div>
                    ${trackedApplications.map(j => {
                      const st = myJobApplicantStatus(j);
                      const m = JOB_STATUS_META[st] || JOB_STATUS_META.applied;
                      const idx = JOB_PIPELINE_ORDER.indexOf(st);
                      const pct = JOB_TERMINAL_META[st] ? 100 : Math.round((Math.max(0, idx) / (JOB_PIPELINE_ORDER.length - 1)) * 100);
                      return `
                        <button type="button" onclick="openJobFromAnalytics('${j.id}')" class="w-full text-left" style="padding:14px 0;border-top:1px solid #f3f4f6;">
                          <div class="flex items-center justify-between gap-3 mb-2">
                            <div class="min-w-0">
                              <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(j.title || 'Application')}</div>
                              ${j.company ? `<div class="text-xs text-gray-400 truncate">${escapeHtml(j.company)}</div>` : ''}
                            </div>
                            <span class="flex-shrink-0 text-[11px] font-bold rounded-full" style="padding:4px 10px;background:${m.color}1a;color:${m.color};">${escapeHtml(m.label)}</span>
                          </div>
                          <div class="rounded-full bg-gray-100 overflow-hidden" style="height:6px;">
                            <div class="rounded-full" style="height:100%;width:${pct}%;background:${m.color};"></div>
                          </div>
                          <div class="text-[11px] text-gray-400" style="margin-top:6px;">Tap to view tracker</div>
                        </button>`;
                    }).join('')}
                  </div>
                  <div class="text-xs text-gray-400" style="margin-top:12px;">Status updates come from whoever posted the opportunity -- you'll get a notification whenever one changes.</div>`
                : `<div class="text-xs text-gray-400">Apply to an opportunity to see your applications and their status here.</div>`}
              </div>
            </div>
            </div>`;
        }


        // ---- Profile Insights charts ----
        let insightsNetworkTimes = null;
        let insightsNetworkLoading = false;
        async function loadInsightsNetworkTimes(){
          if (insightsNetworkLoading) return;
          const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
          if (!sb) return;
          insightsNetworkLoading = true;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const [a, b] = await Promise.all([
              sb.from(CONNECTION_REQUESTS_TABLE).select('*').eq('from_user', me.id).eq('status', 'accepted'),
              sb.from(CONNECTION_REQUESTS_TABLE).select('*').eq('to_user', me.id).eq('status', 'accepted'),
            ]);
            const rows = [...(a.data || []), ...(b.data || [])];
            insightsNetworkTimes = rows.map(r => {
              const t = r.updated_at || r.accepted_at || r.responded_at || r.created_at;
              const ms = t ? new Date(t).getTime() : NaN;
              return isFinite(ms) ? ms : null;
            });
            dlRerender('profileAnalytics', profileAnalyticsHTML);
          } catch (e) { console.warn('Loading network timeline failed:', e); }
          finally { insightsNetworkLoading = false; }
        }

        // Smooth-ish line/area chart. Shapes are drawn in a stretchy SVG; the dots and labels are
        // plain HTML so they stay round and crisp at any width.
        // series: [{ name, color, values: number[], area?: bool }]
        function insightsLineChartHTML(labels, series, opts){
          opts = opts || {};
          const W = 300, H = 120, PADX = 8, PADY = 10;
          const n = labels.length;
          const all = series.flatMap(sr => sr.values);
          const max = Math.max(1, ...all);
          const xAt = i => n === 1 ? W / 2 : PADX + (i * (W - PADX * 2)) / (n - 1);
          const yAt = v => H - PADY - (v / max) * (H - PADY * 2);
          const grid = [0, 0.5, 1].map(f => {
            const y = H - PADY - f * (H - PADY * 2);
            return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="ins-grid" vector-effect="non-scaling-stroke"/>`;
          }).join('');
          const paths = series.map(sr => {
            const pts = sr.values.map((v, i) => [xAt(i), yAt(v)]);
            const line = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
            const area = sr.area ? `<path d="${line} L${pts[pts.length - 1][0].toFixed(1)} ${H - PADY} L${pts[0][0].toFixed(1)} ${H - PADY} Z" fill="${sr.color}" opacity="0.14"/>` : '';
            return `${area}<path d="${line}" fill="none" stroke="${sr.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
          }).join('');
          const dots = series.map(sr => sr.values.map((v, i) => {
            const left = (xAt(i) / W) * 100, top = (yAt(v) / H) * 100;
            return `<span class="ins-dot" style="left:${left}%;top:${top}%;background:${sr.color};"></span>`;
          }).join('')).join('');
          const xl = labels.map(l => `<span>${l}</span>`).join('');
          const legend = series.length > 1 ? `<div class="ins-legend">${series.map(sr => `<span><i style="background:${sr.color};"></i>${escapeHtml(sr.name)}</span>`).join('')}</div>` : '';
          return `
            <div class="ins-chart">
              <div class="ins-plot" style="height:${H}px;">
                <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="${H}">${grid}${paths}</svg>
                ${dots}
                <span class="ins-ymax">${max}</span>
              </div>
              <div class="ins-xlabels">${xl}</div>
              ${legend}
            </div>`;
        }

        function insightsBarChartHTML(labels, values, color){
          const max = Math.max(1, ...values);
          const cols = values.map((v, i) => {
            const h = v ? Math.max(8, Math.round((v / max) * 100)) : 3;
            return `<div class="act-graph-col"><div class="act-graph-num">${v || ''}</div><div class="act-graph-track"><div class="act-graph-bar${v ? '' : ' act-graph-bar-empty'}" style="height:${h}%;${v ? 'background:' + color + ';' : ''}"></div></div><div class="act-graph-label">${labels[i]}</div></div>`;
          }).join('');
          return `<div class="act-graph" style="height:140px;">${cols}</div>`;
        }

        function insightsWeekBuckets(weeks){
          const DAY = 86400000, now = Date.now();
          const labels = [];
          for (let i = 0; i < weeks; i++) {
            const d = new Date(now - (weeks - 1 - i) * 7 * DAY);
            labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
          }
          const idxOf = ts => {
            if (!ts || !isFinite(ts)) return -1;
            const i = weeks - 1 - Math.floor((now - ts) / (7 * DAY));
            return i > weeks - 1 ? weeks - 1 : i; // clock skew: future stamps land in the current week
          };
          return { labels, idxOf, weeks };
        }

        function insightsPostTime(p){
          if (p.createdAt && isFinite(p.createdAt)) return p.createdAt;
          const idNum = Number(p.id);
          return idNum > 1e12 ? idNum : 0; // post ids are creation timestamps
        }

        function insightsNetworkChartHTML(totalNow){
          const WEEKS = 8;
          const b = insightsWeekBuckets(WEEKS);
          const total = typeof totalNow === 'number' ? totalNow : (insightsNetworkTimes ? insightsNetworkTimes.length : 0);
          if (insightsNetworkTimes === null && typeof totalNow !== 'number') {
            return `<div class="text-xs text-gray-400">Loading your network activity...</div>`;
          }
          const times = insightsNetworkTimes || [];
          const gained = new Array(WEEKS).fill(0);
          let before = 0, dated = 0;
          times.forEach(ts => {
            if (ts === null) return;
            dated++;
            const i = b.idxOf(ts);
            if (i < 0) before++; else gained[i]++;
          });
          // Connections with no usable timestamp are treated as older than the window, so the line
          // always ends on the true current total
          const undated = Math.max(0, total - dated);
          let run = before + undated;
          if (!times.length) run = total;
          const cumulative = gained.map(g => (run += g));
          if (times.length && cumulative[WEEKS - 1] !== total) {
            const diff = total - cumulative[WEEKS - 1];
            for (let i = 0; i < WEEKS; i++) cumulative[i] = Math.max(0, cumulative[i] + diff);
          }
          const newInWindow = gained.reduce((s, n) => s + n, 0);
          return `
            <div class="flex items-end justify-between" style="margin-bottom:10px;">
              <div>
                <div class="font-semibold text-sm text-gray-800">My Network</div>
                <div class="text-xs text-gray-400">Connections &middot; last ${WEEKS} weeks</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold font-display" style="color:${ROYAL};line-height:1;">${total}</div>
                <div class="text-[11px] text-gray-400">${newInWindow ? `+${newInWindow} new` : 'total'}</div>
              </div>
            </div>
            ${insightsLineChartHTML(b.labels, [{ name: 'Connections', color: ROYAL, values: cumulative, area: true }])}`;
        }

        function insightsPostActivityChartHTML(myPosts){
          const WEEKS = 8;
          const b = insightsWeekBuckets(WEEKS);
          const posts = new Array(WEEKS).fill(0);
          const engagement = new Array(WEEKS).fill(0);
          myPosts.filter(p => !p.isRepost).forEach(p => {
            const i = b.idxOf(insightsPostTime(p));
            if (i < 0) return;
            posts[i]++;
            engagement[i] += (p.likes || 0) + (p.comments || 0) + (p.reposts || 0) + (p.shares || 0);
          });
          const totalPosts = myPostsCount();
          const inWindow = posts.reduce((s, n) => s + n, 0);
          const engTotal = engagement.reduce((s, n) => s + n, 0);
          return `
            <div class="flex items-end justify-between" style="margin-bottom:10px;">
              <div>
                <div class="font-semibold text-sm text-gray-800">Post activity</div>
                <div class="text-xs text-gray-400">Posts &middot; last ${WEEKS} weeks</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold font-display" style="color:${ROYAL};line-height:1;">${totalPosts}</div>
                <div class="text-[11px] text-gray-400">${inWindow ? `${inWindow} recent` : 'total'}</div>
              </div>
            </div>
            ${insightsBarChartHTML(b.labels, posts, ROYAL)}
            <div style="margin-top:18px;" class="flex items-center justify-between">
              <div class="font-semibold text-xs text-gray-600">Engagement on those posts</div>
              <div class="text-xs text-gray-400">${engTotal} total</div>
            </div>
            <div style="margin-top:8px;">${insightsLineChartHTML(b.labels, [{ name: 'Engagement', color: '#10b981', values: engagement, area: true }])}</div>`;
        }

        // ============================================================
        // MY ACTIVITY (formerly "Profile Insights")
        // ============================================================
        const ACT_COLORS = { blue:'#4169e1', green:'#10b981', amber:'#f59e0b', red:'#ef4444', purple:'#8b5cf6', cyan:'#06b6d4', pink:'#ec4899', gray:'#9ca3af' };
        let myActivityData = null;
        let myActivityLoading = false;
        let myActivityLoadedAt = 0;

        // ---- Screen time: counts seconds the app is open and visible, per day, on this device
        // ----
        const SCREEN_TIME_KEY = 'stitch-screen-time-v1';
        function actDayKey(ms){
          const d = new Date(ms);
          return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
        function screenTimeLoad(){
          try { return JSON.parse(localStorage.getItem(SCREEN_TIME_KEY) || '{}') || {}; } catch (e) { return {}; }
        }
        (function startScreenTimeTracker(){
          if (window.__stitchScreenTimeOn) return;
          window.__stitchScreenTimeOn = true;
          let last = Date.now();
          setInterval(() => {
            const now = Date.now();
            const dt = Math.min(now - last, 15000);
            last = now;
            if (document.visibilityState !== 'visible' || dt <= 0) return;
            try {
              const m = screenTimeLoad();
              const k = actDayKey(now);
              m[k] = (m[k] || 0) + Math.round(dt / 1000);
              const keys = Object.keys(m).sort();
              while (keys.length > 120) delete m[keys.shift()];
              localStorage.setItem(SCREEN_TIME_KEY, JSON.stringify(m));
            } catch (e) {}
          }, 5000);
          document.addEventListener('visibilitychange', () => { last = Date.now(); });
        })();

        // ---- Profile views: one row each time someone opens another person's profile ----
        const profileViewsRecorded = new Set();
        async function recordProfileView(profileId){
          try {
            if (!profileId || profileViewsRecorded.has(profileId)) return;
            profileViewsRecorded.add(profileId);
            const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
            const me = await getCachedAuthUser();
            if (!sb || !me || me.id === profileId) return;
            await sb.from('profile_views').insert({ profile_id: profileId, viewer_id: me.id });
          } catch (e) {}
        }

        // ---- Extra data this page needs from the server ----
        async function loadMyActivityData(){
          if (myActivityLoading) return;
          const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
          if (!sb) { myActivityData = myActivityData || { ready: true }; return; }
          myActivityLoading = true;
          const out = { ready: true, sent: [], received: [], chats: [], payments: [], views: [], viewsMissing: false, paymentsMissing: false };
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const safe = q => Promise.resolve(q).then(r => r, e => ({ data: null, error: e }));
            const [sent, recv, msgs, pays, views] = await Promise.all([
              safe(sb.from(CONNECTION_REQUESTS_TABLE).select('*').eq('from_user', me.id)),
              safe(sb.from(CONNECTION_REQUESTS_TABLE).select('*').eq('to_user', me.id)),
              safe(sb.from(MESSAGES_TABLE).select('sender_id,recipient_id,created_at').or(`sender_id.eq.${me.id},recipient_id.eq.${me.id}`).order('created_at', { ascending: false }).limit(3000)),
              safe(sb.from('payments').select('id,product_type,product_id,gross_amount,status,paid_at').eq('buyer_id', me.id).order('paid_at', { ascending: false })),
              safe(sb.from('profile_views').select('viewer_id,created_at').eq('profile_id', me.id).order('created_at', { ascending: false }).limit(2000)),
            ]);
            out.sent = sent.data || [];
            out.received = recv.data || [];
            out.payments = pays.data || [];
            out.paymentsMissing = !!pays.error;
            out.views = views.data || [];
            out.viewsMissing = !!views.error;
            // Who I talk to the most
            const per = {};
            (msgs.data || []).forEach(m => {
              const mine = m.sender_id === me.id;
              const other = mine ? m.recipient_id : m.sender_id;
              if (!other || other === me.id) return;
              const e = per[other] || (per[other] = { id: other, sent: 0, received: 0 });
              if (mine) e.sent++; else e.received++;
            });
            const ranked = Object.values(per).sort((a, b) => (b.sent + b.received) - (a.sent + a.received)).slice(0, 5);
            if (ranked.length) {
              const { data: profs } = await safe(sb.from('public_profiles').select('user_id,name,username').in('user_id', ranked.map(r => r.id)));
              const byId = {};
              (profs && profs.data ? profs.data : (Array.isArray(profs) ? profs : [])).forEach(p => { byId[p.user_id] = p; });
              ranked.forEach(r => { const p = byId[r.id] || {}; r.name = p.name || (p.username ? '@' + p.username : 'Stitch member'); });
            }
            out.chats = ranked;
            out.totalMessages = (msgs.data || []).length;
            myActivityData = out;
            myActivityLoadedAt = Date.now();
            dlRerender('profileAnalytics', profileAnalyticsHTML);
          } catch (e) { console.warn('Loading activity failed:', e); }
          finally { myActivityLoading = false; }
        }

        // ---- Small chart helpers ----
        function actSectionHTML(color, title, sub, inner, panel){
          const wrap = panel ? 'bg-white rounded-3xl p-5 shadow-sm' : '';
          const wrapStyle = panel ? '' : 'padding:6px 2px 2px;';
          return `
            <div class="${wrap}" style="${wrapStyle}">
              <div class="font-semibold text-sm text-gray-800" style="margin-bottom:${sub ? '2px' : '12px'};">${title}</div>
              ${sub ? `<div class="text-xs text-gray-400" style="margin:0 0 12px;">${sub}</div>` : ''}
              ${inner}
            </div>`;
        }
        function actPieHTML(slices, emptyMsg){
          const live = slices.filter(s => s.value > 0);
          const total = live.reduce((s, x) => s + x.value, 0);
          if (!total) return `<div class="text-xs text-gray-400">${emptyMsg || 'Nothing here yet.'}</div>`;
          let acc = 0;
          const stops = live.map(s => { const a = acc / total * 100; acc += s.value; return `${s.color} ${a.toFixed(2)}% ${(acc / total * 100).toFixed(2)}%`; }).join(',');
          const legend = slices.map(s => `
            <div class="myact-legend-row">
              <span class="myact-legend-dot" style="background:${s.color};"></span>
              <span class="myact-legend-label">${escapeHtml(s.label)}</span>
              <span class="myact-legend-val">${s.value}${total ? ` &middot; ${Math.round(s.value / total * 100)}%` : ''}</span>
            </div>`).join('');
          return `<div class="myact-pie-wrap"><div class="myact-pie" style="background:conic-gradient(${stops});"></div><div class="myact-legend">${legend}</div></div>`;
        }
        function actScatterHTML(points, opts){
          opts = opts || {};
          if (!points.length) return `<div class="text-xs text-gray-400">${opts.empty || 'Nothing to plot yet.'}</div>`;
          const xMax = Math.max(1, ...points.map(p => p.x)), yMax = Math.max(1, ...points.map(p => p.y));
          const grid = [0, 0.5, 1].map(f => `<div class="myact-sgrid" style="bottom:${f * 100}%;"></div>`).join('');
          const dots = points.map(p => {
            const l = 4 + (p.x / xMax) * 92, b = 6 + (p.y / yMax) * 86, s = p.size || 12;
            return `<span class="myact-sdot" style="left:${l}%;bottom:${b}%;width:${s}px;height:${s}px;background:${p.color || ACT_COLORS.blue};" title="${escapeHtml(p.tip || '')}"></span>`;
          }).join('');
          return `
            <div class="myact-scatter">${grid}${dots}<span class="myact-yl">${opts.yMax != null ? opts.yMax : yMax}</span></div>
            <div class="myact-xcap"><span>${opts.xLeft || ''}</span><span>${opts.xRight || ''}</span></div>
            ${opts.legend || ''}`;
        }
        function actStatTile(value, label, color){
          return `<div class="flex-1 bg-white rounded-2xl px-4 py-3 shadow-sm"><div class="font-bold text-lg font-display" style="color:${color};line-height:1.1;">${value}</div><div class="text-[11px] text-gray-400" style="margin-top:2px;">${label}</div></div>`;
        }
        function actFmtDuration(sec){
          const m = Math.round(sec / 60);
          if (m < 60) return m + ' min';
          const h = Math.floor(m / 60), r = m % 60;
          return h + 'h' + (r ? ' ' + r + 'm' : '');
        }

        // ---- Everything on the page, gathered once so the page and the download agree ----
        function myActivityCollect(){
          const D = myActivityData || {};
          const myPosts = feedPosts.filter(p => p.mine && !p.isRepost);
          const score = p => (p.likes||0) + (p.comments||0) + (p.reposts||0) + (p.shares||0);
          const sorted = [...myPosts].sort((a, b) => score(b) - score(a));
          const topPost = sorted[0] || null;
          const others = sorted.slice(1);
          const avg = key => others.length ? others.reduce((s, p) => s + (p[key] || 0), 0) / others.length : 0;
          const jobs = allJobs();
          const appliedJobs = jobs.filter(j => isJobApplied(j));
          const tracked = appliedJobs.filter(j => j.type !== 'Course');
          const SUCC = ['shortlisted','interview','offer','offer_accepted'], FAIL = ['rejected','withdrawn','closed'];
          let succ = 0, fail = 0, prog = 0;
          tracked.forEach(j => { const st = myJobApplicantStatus(j); if (SUCC.includes(st)) succ++; else if (FAIL.includes(st)) fail++; else prog++; });
          const sent = D.sent || [];
          const reqOk = sent.filter(r => r.status === 'accepted').length;
          const reqPending = sent.filter(r => !r.status || r.status === 'pending').length;
          const reqFail = sent.length - reqOk - reqPending;
          const PAID = ['paid','success','succeeded','completed'];
          const pays = D.payments || [];
          const times = screenTimeLoad();
          const days = [];
          for (let i = 6; i >= 0; i--) {
            const t = Date.now() - i * 86400000;
            days.push({ label: new Date(t).toLocaleDateString(undefined, { weekday: 'short' }), sec: times[actDayKey(t)] || 0 });
          }
          return {
            myPosts, topPost, others, avg, score,
            likes: myPosts.reduce((s,p)=>s+(p.likes||0),0), comments: myPosts.reduce((s,p)=>s+(p.comments||0),0),
            reposts: myPosts.reduce((s,p)=>s+(p.reposts||0),0), shares: myPosts.reduce((s,p)=>s+(p.shares||0),0),
            glimpseViews: myGlimpses.reduce((s, g) => s + (g.viewers ? g.viewers.length : 0), 0),
            glimpsesPosted: myGlimpses.filter(g => !g.failed).length,
            classesCreated: myClasses.filter(c => c.role === 'teacher').length,
            classesJoined: myClasses.filter(c => c.role !== 'teacher').length,
            jobs, appliedJobs, posted: jobs.filter(j => j.mine).length, saved: jobs.filter(j => j.saved).length,
            tracked, succ, fail, prog,
            reqOk, reqPending, reqFail, sent, received: D.received || [],
            chats: D.chats || [], totalMessages: D.totalMessages || 0,
            views: D.views || [], viewsMissing: !!D.viewsMissing,
            pays, paymentsMissing: !!D.paymentsMissing, PAID,
            spent: pays.filter(r => PAID.includes(r.status)).reduce((s, r) => s + Number(r.gross_amount || 0), 0),
            days, screenToday: days[6].sec, screenWeek: days.reduce((s, d) => s + d.sec, 0),
          };
        }

        // ---- Download: builds a designed PDF (charts drawn natively) of everything on My
        // activity ----
        function loadJsPdfLib(){
          if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
          return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            s.onload = () => (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF missing'));
            s.onerror = () => reject(new Error('Could not load the PDF library'));
            document.head.appendChild(s);
          });
        }
        // Colmeak (the app's font) as a TTF for the PDF. If it can't load we quietly fall back to
        // Helvetica
        function loadColmeakPdfFont(){
          if (window.COLMEAK_PDF_TTF_B64) return Promise.resolve(true);
          return new Promise(resolve => {
            const s = document.createElement('script');
            s.src = 'colmeak-pdf.js?v=20261002b';
            s.onload = () => resolve(!!window.COLMEAK_PDF_TTF_B64);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
          });
        }
        // ---- PDF watermark: the Stitch logo, large and faint, behind the content of every page
        // of every analytics PDF ----
        const STITCH_PDF_LOGO_B64 = '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';
        function pdfWatermarkInit(doc){
          const draw = () => {
            try {
              const W = 150, H = W * 204 / 500;
              const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
              doc.setGState(new doc.GState({ opacity: 0.06 }));
              doc.addImage('data:image/png;base64,' + STITCH_PDF_LOGO_B64, 'PNG', (pw - W) / 2, (ph - H) / 2, W, H);
              doc.setGState(new doc.GState({ opacity: 1 }));
            } catch (e) { try { doc.setGState(new doc.GState({ opacity: 1 })); } catch (e2) {} }
          };
          const addPage = doc.addPage.bind(doc);
          doc.addPage = function(){ const r = addPage.apply(doc, arguments); draw(); return r; };
          draw();
        }

        // ---- Download progress: an arc around the round download button and inside the
        // "Downloading..." pill ----
        function dlRingSVG(size){
          const sw = 3, r = (size - sw) / 2, c = 2 * Math.PI * r, h = size / 2;
          return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="dl-ring-track" cx="${h}" cy="${h}" r="${r}"/><circle class="dl-ring-bar" cx="${h}" cy="${h}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-c="${c}"/></svg>`;
        }
        // A download in progress can be cancelled by tapping its button again (the icon turns into
        // an X)
        let dlActive = null;
        // Re-draws an open overlay from fresh data without losing the scroll position
        function dlRerender(kind, htmlFn){
          if (dlActive) { dlActive.pendingRender = () => dlRerender(kind, htmlFn); return; }
          const ov = document.getElementById('overlay');
          if (!ov || typeof currentOverlayKind === 'undefined' || currentOverlayKind !== kind) return;
          const sc = ov.querySelector('.overflow-y-auto');
          const top = sc ? sc.scrollTop : 0;
          ov.innerHTML = htmlFn();
          const again = ov.querySelector('.overflow-y-auto');
          if (again) again.scrollTop = top;
        }
        function dlCancelActive(){
          if (!dlActive) return false;
          dlActive.cancel();
          return true;
        }
        function dlProgressStart(btns, pillLabel){
          const st = { p: 0, target: 6, timer: null };
          if (!document.getElementById('dl-spin-style')) {
            const sty = document.createElement('style');
            sty.id = 'dl-spin-style';
            sty.textContent = '@keyframes dlSpinRound{to{transform:rotate(360deg)}}';
            document.head.appendChild(sty);
          }
          const ring = (cls, style) => `<svg class="${cls}" viewBox="0 0 60 60" aria-hidden="true" style="${style}animation:dlSpinRound 1s linear infinite;"><circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="4"/><circle class="dl-ring-bar" cx="30" cy="30" r="26" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 26}" stroke-dashoffset="${2 * Math.PI * 26}" data-c="${2 * Math.PI * 26}"/></svg>`;
          const sels = btns.map(b => b.id ? '#' + b.id : '.' + Array.from(b.classList).join('.'));
          const skin = b => {
            b.__dlOrig = b.innerHTML;
            b.disabled = false; // stays tappable so it can cancel
            b.style.opacity = '';
            if (b.classList.contains('myact-dl-circle')) {
              // Round icon button: X inside a spinning ring, no text.
              b.style.position = 'relative';
              b.innerHTML = `${Icon('close', 'w-5 h-5')}${ring('dl-ring-round', 'position:absolute;left:-2px;top:-2px;width:calc(100% + 4px);height:calc(100% + 4px);pointer-events:none;')}`;
            } else {
              // Pill: X inside a small spinning ring, then the label (no percentage).
              b.innerHTML = `<span style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0;">${Icon('close', 'w-4 h-4')}${ring('dl-ring-pill', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;')}</span><span>${pillLabel || 'Downloading...'}</span>`;
            }
          };
          const unskin = () => btns.forEach(b => { if (b.__dlOrig !== undefined) { b.innerHTML = b.__dlOrig; b.__dlOrig = undefined; } b.disabled = false; b.style.opacity = ''; });
          btns.forEach(skin);
          // If something redraws the page and replaces the buttons, put the progress look back on
          // the new ones
          const reattach = () => btns.forEach((b, i) => {
            if (b.isConnected) return;
            const nb = document.querySelector(sels[i]);
            if (nb) { btns[i] = nb; skin(nb); }
          });
          const done = () => { if (dlActive === api) dlActive = null; unskin(); const p = api.pendingRender; api.pendingRender = null; if (p) p(); };
          const paint = () => {
            const p = Math.min(100, Math.max(8, st.p));
            btns.forEach(b => {
              const bar = b.querySelector('.dl-ring-bar');
              if (bar) { const c = parseFloat(bar.getAttribute('data-c')); bar.style.strokeDashoffset = String(c * (1 - p / 100)); }
            });
          };
          paint();
          st.timer = setInterval(() => { reattach(); st.p += (st.target - st.p) * 0.12 + 0.05; if (st.p > st.target) st.p = st.target; paint(); }, 60);
          const api = {
            pendingRender: null,
            cancelled: false,
            to(t){ st.target = Math.max(st.target, Math.min(t, 96)); },
            async finish(){
              st.target = 100;
              for (let i = 0; i < 15 && st.p < 99.5; i++) { st.p += (100 - st.p) * 0.35 + 0.5; paint(); await new Promise(r => setTimeout(r, 40)); }
              st.p = 100; paint();
              await new Promise(r => setTimeout(r, 250));
              clearInterval(st.timer);
              done();
            },
            stop(){ clearInterval(st.timer); done(); },
            cancel(){
              api.cancelled = true;
              clearInterval(st.timer);
              done();
            },
          };
          dlActive = api;
          return api;
        }
        async function downloadMyActivity(){
          if (dlCancelActive()) return;
          const btns = Array.from(document.querySelectorAll('.myact-dl-pill, .myact-dl-circle'));
          const labels = btns.map(b => b.innerHTML);
          const prog = dlProgressStart(btns);
          try {
            const jsPDF = await loadJsPdfLib();
            prog.to(35);
            if (prog.cancelled) return;
            await loadColmeakPdfFont();
            prog.to(55);
            if (myActivityData === null && typeof loadMyActivityData === 'function') {
              loadMyActivityData();
              for (let i = 0; i < 25 && myActivityData === null; i++) await new Promise(r => setTimeout(r, 200));
            }
            prog.to(80);
            await new Promise(r => setTimeout(r, 80));
            if (prog.cancelled) return;
            buildMyActivityPdf(jsPDF);
            await prog.finish();
          } catch (e) {
            prog.stop();
            console.warn('PDF failed:', e);
            if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't prepare your PDF. Check your connection and try again.");
          } finally {
          }
        }

        function buildMyActivityPdf(jsPDF){
          const A = myActivityCollect();
          const doc = new jsPDF({ unit: 'mm', format: 'a4' }); pdfWatermarkInit(doc);
          const PW = 210, PH = 297, M = 14, CW = PW - M * 2, BOTTOM = PH - 18;
          let y = 0;
          // Draw the whole document in Colmeak (same font as the app) so it reads the same
          // everywhere
          let useColmeak = false, useMont = false;
          try {
            if (window.COLMEAK_PDF_TTF_B64) {
              doc.addFileToVFS('Colmeak.ttf', window.COLMEAK_PDF_TTF_B64);
              doc.addFont('Colmeak.ttf', 'Colmeak', 'normal');
              doc.addFont('Colmeak.ttf', 'Colmeak', 'bold');
              useColmeak = true;
            }
          } catch (e) { useColmeak = false; }
          try {
            if (window.MONTSERRAT_PDF_REG_B64 && window.MONTSERRAT_PDF_BOLD_B64) {
              doc.addFileToVFS('Montserrat-Regular.ttf', window.MONTSERRAT_PDF_REG_B64);
              doc.addFileToVFS('Montserrat-Bold.ttf', window.MONTSERRAT_PDF_BOLD_B64);
              doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal');
              doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');
              useMont = true;
            }
          } catch (e) { useMont = false; }
          const cmOk = new Set(window.COLMEAK_PDF_CODES || []);
          const txt = s => Array.from(String(s == null ? '' : s)).filter(ch => {
            const c = ch.codePointAt(0);
            if (c >= 0x20 && c <= 0x7E) return true;
            return c >= 0xA0 && c <= 0xFF && (!useColmeak || cmOk.has(c));
          }).join('').trim();
          // `display` = true draws in Colmeak (title, headings); everything else is Montserrat.
          const typeface = display => (display && useColmeak) ? 'Colmeak' : (useMont ? 'Montserrat' : (useColmeak ? 'Colmeak' : 'helvetica'));
          const rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
          const fill = h => doc.setFillColor(...rgb(h));
          const stroke = h => doc.setDrawColor(...rgb(h));
          const color = h => doc.setTextColor(...rgb(h));
          const font = (size, bold, display) => { doc.setFont(typeface(display), bold ? 'bold' : 'normal'); doc.setFontSize(size); };
          const money = n => 'GHS ' + (Number(n || 0) / CREATOR_AMOUNT_DIVISOR).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = 18; } };
          const clip = (s, w) => { const t = doc.splitTextToSize(txt(s), w); return t[0] || ''; };
          const C = ACT_COLORS;

          // ---- header: plain background, centered title ----
          color('#000000'); font(32, true, true); doc.text('MY ACTIVITY', PW / 2, 24, { align: 'center' });
          const who = [txt(profileData && profileData.name), profileData && profileData.username ? '@' + txt(profileData.username) : ''].filter(Boolean).join('  ·  ');
          color('#000000'); font(11, false, true);
          if (who) doc.text(who, PW / 2, 33, { align: 'center' });
          color('#6b7280'); font(9, false);
          doc.text('Generated ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), PW / 2, 40, { align: 'center' });

          // ---- one short paragraph about this section and this document, before the numbers and
          // charts ----
          const intro = 'My Activity is your personal summary of how you use Stitch: the posts you share and the reactions and comments they earn, who views your profile and Glimpses, your classes, opportunities and network, your payments, and the time you spend in the app. '
            + 'This document is a snapshot saved on the date above, so every number reflects your account at that moment and will change as you keep using Stitch. '
            + 'The tiles and charts that follow turn those numbers into pictures, so you can see at a glance what your audience responds to and where to focus next.';
          color('#4b5563'); font(9, false);
          const introLines = doc.splitTextToSize(txt(intro), CW);
          doc.text(introLines, M, 51, { lineHeightFactor: 1.5 });
          y = 51 + introLines.length * 5.2 + 5;

          // ---- building blocks ----
          const section = (hex, title, sub, need) => {
            y += 8;
            ensure(need || 50);
            stroke('#e5e7eb'); doc.setLineWidth(0.3); doc.line(M, y - 3, M + CW, y - 3);
            color('#000000'); font(12.5, true, true); doc.text(txt(title), M, y + 2.6);
            y += 7;
            if (sub) { color('#9ca3af'); font(8.5, false); doc.text(txt(sub), M, y + 1); y += 5; }
            y += 3;
          };
          const sub2 = t => { ensure(48); color('#000000'); font(9.5, true, true); doc.text(txt(t), M, y + 2); y += 7; };
          const note = t => { color('#9ca3af'); font(8, false); const l = doc.splitTextToSize(txt(t), CW); doc.text(l, M, y + 2); y += l.length * 4 + 2; };
          const empty = t => { color('#9ca3af'); font(9, false); doc.text(txt(t), M, y + 3); y += 9; };
          const tiles = list => {
            ensure(20);
            const gap = 4, w = (CW - gap * (list.length - 1)) / list.length;
            list.forEach((t, i) => {
              const x = M + i * (w + gap);
              color('#000000'); font(15, true); doc.text(txt(t.v), x, y + 6);
              color('#6b7280'); font(7.5, false); doc.text(clip(t.l, w - 2), x, y + 11.5);
            });
            y += 19;
          };
          const sector = (cx, cy, r, a0, a1) => {
            const pts = [[cx, cy]], steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 36)));
            for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
            const rel = []; for (let i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]]);
            doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'FD', true);
          };
          const pie = (slices, emptyMsg) => {
            const live = slices.filter(s => s.value > 0), total = live.reduce((s, x) => s + x.value, 0);
            if (!total) { empty(emptyMsg || 'Nothing here yet.'); return; }
            ensure(42);
            const r = 17, cx = M + r + 2, cy = y + r + 2;
            doc.setLineWidth(0.5); stroke('#ffffff');
            if (live.length === 1) { fill(live[0].color); doc.circle(cx, cy, r, 'FD'); }
            else { let a = -Math.PI / 2; live.forEach(s => { const a1 = a + (s.value / total) * Math.PI * 2; fill(s.color); sector(cx, cy, r, a, a1); a = a1; }); }
            let ly = cy - (slices.length * 7) / 2 + 3;
            slices.forEach(s => {
              fill(s.color); doc.circle(M + 52, ly - 1, 1.7, 'F');
              color('#374151'); font(9.5, false); doc.text(clip(s.label, 50), M + 57, ly);
              color('#6b7280'); font(9.5, true); doc.text(s.value + '  (' + Math.round(s.value / total * 100) + '%)', M + CW, ly, { align: 'right' });
              ly += 7;
            });
            y += r * 2 + 8;
          };
          const bars = (lbls, vals, hex, h) => {
            h = h || 34; ensure(h + 16);
            const max = Math.max(1, ...vals), n = vals.length, slot = CW / n, bw = Math.min(14, slot * 0.55);
            stroke('#e5e7eb'); doc.setLineWidth(0.25); doc.line(M, y + 5 + h, M + CW, y + 5 + h);
            vals.forEach((v, i) => {
              const bh = v ? Math.max(1.5, v / max * h) : 0.8, x = M + i * slot + (slot - bw) / 2;
              fill(v ? hex : '#e5e7eb'); doc.roundedRect(x, y + 5 + h - bh, bw, bh, 1, 1, 'F');
              if (v) { color('#374151'); font(7.5, true); doc.text(String(v), x + bw / 2, y + 3.5 + h - bh, { align: 'center' }); }
              color('#9ca3af'); font(7, false); doc.text(txt(lbls[i]), x + bw / 2, y + h + 10, { align: 'center' });
            });
            y += h + 15;
          };
          const lines = (lbls, series, h) => {
            h = h || 34; ensure(h + 22);
            const all = series.flatMap(s => s.values), max = Math.max(1, ...all), n = lbls.length;
            const x0 = M + 6, w = CW - 10, y0 = y + 4, base = y0 + h;
            stroke('#e5e7eb'); doc.setLineWidth(0.25);
            [0, 0.5, 1].forEach(f => doc.line(M, base - f * h, M + CW, base - f * h));
            color('#9ca3af'); font(7, false); doc.text(String(max), M, y0 - 1);
            const xAt = i => n === 1 ? x0 + w / 2 : x0 + i * w / (n - 1), yAt = v => base - (v / max) * h;
            series.forEach(s => {
              stroke(s.color); doc.setLineWidth(0.9);
              for (let i = 1; i < n; i++) doc.line(xAt(i - 1), yAt(s.values[i - 1]), xAt(i), yAt(s.values[i]));
              fill(s.color); s.values.forEach((v, i) => doc.circle(xAt(i), yAt(v), 1.1, 'F'));
            });
            color('#9ca3af'); font(7, false); lbls.forEach((l, i) => doc.text(txt(l), xAt(i), base + 5, { align: 'center' }));
            y = base + 8;
            if (series.length > 1) {
              let lx = M; font(8, false);
              series.forEach(s => { fill(s.color); doc.circle(lx + 1.5, y + 0.8, 1.5, 'F'); color('#4b5563'); doc.text(txt(s.name), lx + 5, y + 2); lx += 8 + doc.getTextWidth(txt(s.name)) + 6; });
              y += 7;
            }
          };
          const scatter = (pts, xl, xr, emptyMsg) => {
            if (!pts.length) { empty(emptyMsg || 'Nothing to plot yet.'); return; }
            const h = 40; ensure(h + 14);
            fill('#f3f4fb'); doc.roundedRect(M, y, CW, h, 3, 3, 'F');
            stroke('#e5e7eb'); doc.setLineWidth(0.25); [0.25, 0.5, 0.75].forEach(f => doc.line(M + 2, y + h * f, M + CW - 2, y + h * f));
            const xMax = Math.max(1, ...pts.map(p => p.x)), yMax = Math.max(1, ...pts.map(p => p.y));
            pts.forEach(p => { fill(p.color); stroke('#ffffff'); doc.setLineWidth(0.5); doc.circle(M + 6 + (p.x / xMax) * (CW - 12), y + h - 6 - (p.y / yMax) * (h - 12), (p.size || 12) / 5, 'FD'); });
            y += h + 4; color('#9ca3af'); font(7.5, false); doc.text(txt(xl), M, y + 1); doc.text(txt(xr), M + CW, y + 1, { align: 'right' }); y += 7;
          };

          // ---- overview ----
          const engagementTotal = A.likes + A.comments + A.reposts + A.shares;
          tiles([
            { v: A.myPosts.length, l: 'Total posts', c: C.blue },
            { v: engagementTotal, l: 'Total reactions', c: C.red },
            { v: A.myPosts.length ? Math.round(engagementTotal / A.myPosts.length * 10) / 10 : 0, l: 'Average per post', c: C.green },
            { v: typeof cachedNetworkCount === 'number' ? cachedNetworkCount : 0, l: 'Connections', c: C.cyan },
          ]);

          // ---- weekly data ----
          const WEEKS = 8, wk = insightsWeekBuckets(WEEKS);
          const posts = new Array(WEEKS).fill(0), wL = new Array(WEEKS).fill(0), wC = new Array(WEEKS).fill(0), wR = new Array(WEEKS).fill(0), wS = new Array(WEEKS).fill(0), wV = new Array(WEEKS).fill(0);
          A.myPosts.forEach(p => { const i = wk.idxOf(insightsPostTime(p)); if (i < 0) return; posts[i]++; wL[i] += p.likes||0; wC[i] += p.comments||0; wR[i] += p.reposts||0; wS[i] += p.shares||0; });
          A.views.forEach(v => { const i = wk.idxOf(v.created_at ? new Date(v.created_at).getTime() : 0); if (i >= 0) wV[i]++; });

          // ---- posts ----
          section(C.blue, 'Post activity', 'Posts in the last 8 weeks', 70);
          bars(wk.labels, posts, C.blue);
          sub2('Top post vs your other posts');
          if (A.topPost) {
            const rows = [['Likes','likes',C.red],['Comments','comments',C.blue],['Reposts','reposts',C.green],['Shares','shares',C.amber]];
            const cmax = Math.max(1, ...rows.map(([, k]) => Math.max(A.topPost[k] || 0, A.avg(k))));
            ensure(rows.length * 15 + 8);
            fill(C.blue); doc.roundedRect(M, y, 3, 3, 0.8, 0.8, 'F'); color('#4b5563'); font(8, false); doc.text('Top post', M + 5, y + 2.6);
            fill(C.gray); doc.roundedRect(M + 30, y, 3, 3, 0.8, 0.8, 'F'); doc.text('Average of your other posts', M + 35, y + 2.6); y += 8;
            rows.forEach(([label, k]) => {
              const t = A.topPost[k] || 0, a = A.avg(k), bw = CW - 30;
              color('#374151'); font(8.5, true); doc.text(label, M, y + 2.5);
              fill(C.blue); doc.roundedRect(M + 22, y, Math.max(t ? 1.5 : 0, t / cmax * bw), 3.4, 1, 1, 'F'); color('#6b7280'); font(8, false); doc.text(String(t), M + 24 + Math.max(t ? 1.5 : 0, t / cmax * bw), y + 2.8);
              fill(C.gray); doc.roundedRect(M + 22, y + 4.6, Math.max(a ? 1.5 : 0, a / cmax * bw), 3.4, 1, 1, 'F'); doc.text(String(Math.round(a * 10) / 10), M + 24 + Math.max(a ? 1.5 : 0, a / cmax * bw), y + 7.4);
              y += 12;
            });
          } else empty('Once you post, your best post is compared with the rest here.');
          sub2('Every post, plotted (higher = more reactions, gold = top post)');
          const now = Date.now();
          const ptsRaw = A.myPosts.map(p => { const t = insightsPostTime(p); const age = t ? Math.max(0, (now - t) / 86400000) : 0; const top = A.topPost && p === A.topPost; return { age, y: A.score(p), size: top ? 18 : 12, color: top ? C.amber : C.blue }; });
          const maxAge = Math.max(1, ...ptsRaw.map(p => p.age));
          scatter(ptsRaw.map(p => ({ x: maxAge - p.age, y: p.y, size: p.size, color: p.color })), 'Older', 'Newer', 'Your posts will be plotted here once you post.');

          // ---- audience ----
          section(C.red, 'Audience activity', 'Reactions on your posts, by the week you posted', 100);
          lines(wk.labels, [{ name: 'Likes', color: C.red, values: wL }, { name: 'Comments', color: C.blue, values: wC }, { name: 'Reposts', color: C.green, values: wR }, { name: 'Shares', color: C.amber, values: wS }]);
          pie([{ label: 'Likes', value: A.likes, color: C.red }, { label: 'Comments', value: A.comments, color: C.blue }, { label: 'Reposts', value: A.reposts, color: C.green }, { label: 'Shares', value: A.shares, color: C.amber }], 'Reactions will be broken down here once people start interacting.');

          // ---- views ----
          section(C.pink, 'Profile and Glimpse views', 'Who is looking at you', 85);
          tiles([{ v: A.views.length, l: 'Profile views', c: C.pink }, { v: A.glimpseViews, l: 'Glimpse views', c: C.purple }, { v: A.glimpsesPosted, l: 'Glimpses posted', c: C.cyan }]);
          lines(wk.labels, [{ name: 'Profile views', color: C.pink, values: wV }]);

          // ---- classes ----
          section(C.green, 'Classes', 'Created vs joined', 55);
          pie([{ label: 'Created', value: A.classesCreated, color: C.blue }, { label: 'Joined', value: A.classesJoined, color: C.green }], 'Create or join a class and it shows up here.');
          if (myClasses.length) {
            font(9, false);
            myClasses.forEach(c => { ensure(6); fill(c.role === 'teacher' ? C.blue : C.green); doc.circle(M + 1.5, y + 0.8, 1.2, 'F'); color('#374151'); doc.text(clip(c.name || c.title || 'Class', CW - 40), M + 6, y + 2); color('#9ca3af'); doc.text(c.role === 'teacher' ? 'Created' : 'Joined', M + CW, y + 2, { align: 'right' }); y += 6; });
            y += 3;
          }

          // ---- opportunities ----
          section(C.amber, 'Opportunities', 'What you posted, interacted with and how your applications went', 110);
          sub2('Posted vs interacted with');
          pie([{ label: 'Posted', value: A.posted, color: C.blue }, { label: 'Applied', value: A.appliedJobs.length, color: C.green }, { label: 'Saved', value: A.saved, color: C.amber }], 'Post, save or apply to opportunities and they show up here.');
          sub2('Application results');
          pie([{ label: 'Successful', value: A.succ, color: C.green }, { label: 'In progress', value: A.prog, color: C.amber }, { label: 'Unsuccessful', value: A.fail, color: C.red }], 'Apply to an opportunity to see how your applications go.');
          note('Successful means shortlisted, interview or offer.');
          if (A.appliedJobs.length) {
            sub2('Your applications');
            A.appliedJobs.forEach(j => { ensure(6); color('#374151'); font(9, false); doc.text(clip((j.title || 'Untitled') + (j.company ? ' - ' + j.company : ''), CW - 40), M, y + 2); color('#6b7280'); doc.text(j.type === 'Course' ? 'Enrolled' : txt((JOB_STATUS_META[myJobApplicantStatus(j)] || {}).label || 'Applied'), M + CW, y + 2, { align: 'right' }); y += 6; });
            y += 3;
          }

          // ---- network ----
          section(C.cyan, 'My network', 'Connections, requests and who you talk to', 100);
          const total = typeof cachedNetworkCount === 'number' ? cachedNetworkCount : 0;
          const gained = new Array(WEEKS).fill(0); let before = 0, dated = 0;
          (insightsNetworkTimes || []).forEach(ts => { if (ts === null) return; dated++; const i = wk.idxOf(ts); if (i < 0) before++; else gained[i]++; });
          let run = (insightsNetworkTimes && insightsNetworkTimes.length) ? before + Math.max(0, total - dated) : total;
          const cum = gained.map(g => (run += g));
          if (insightsNetworkTimes && insightsNetworkTimes.length && cum[WEEKS - 1] !== total) { const d = total - cum[WEEKS - 1]; for (let i = 0; i < WEEKS; i++) cum[i] = Math.max(0, cum[i] + d); }
          lines(wk.labels, [{ name: 'Connections', color: C.cyan, values: cum }]);
          sub2('Connection requests you sent');
          pie([{ label: 'Successful', value: A.reqOk, color: C.green }, { label: 'Pending', value: A.reqPending, color: C.amber }, { label: 'Unsuccessful', value: A.reqFail, color: C.red }], 'Requests you send show up here.');
          sub2('Most interaction');
          if (A.chats.length) {
            const cmax = Math.max(1, ...A.chats.map(c => c.sent + c.received));
            A.chats.forEach((c, i) => {
              ensure(14);
              color('#374151'); font(9, true); doc.text((i + 1) + '. ' + clip(c.name || 'Stitch member', CW - 40), M, y + 2.5);
              color('#6b7280'); font(8.5, false); doc.text((c.sent + c.received) + ' messages', M + CW, y + 2.5, { align: 'right' });
              fill('#e5e7eb'); doc.roundedRect(M, y + 4.5, CW, 2.6, 1.3, 1.3, 'F');
              fill(C.cyan); doc.roundedRect(M, y + 4.5, Math.max(3, (c.sent + c.received) / cmax * CW), 2.6, 1.3, 1.3, 'F');
              color('#9ca3af'); font(7.5, false); doc.text('You sent ' + c.sent + '  -  they sent ' + c.received, M, y + 11);
              y += 14;
            });
          } else empty('Chat with people and the ones you talk to most show up here.');

          // ---- payments ----
          section(C.green, 'Payments and receipts', A.pays.length ? A.pays.length + ' purchase' + (A.pays.length === 1 ? '' : 's') + '  -  ' + money(A.spent) + ' spent' : 'Paid classes and courses', 60);
          if (A.pays.length) {
            pie([
              { label: 'Paid', value: A.pays.filter(r => A.PAID.includes(r.status)).length, color: C.green },
              { label: 'Refunded', value: A.pays.filter(r => r.status === 'refunded').length, color: C.gray },
              { label: 'Failed / other', value: A.pays.filter(r => !A.PAID.includes(r.status) && r.status !== 'refunded').length, color: C.red },
            ]);
            sub2('Purchases over time (higher = bigger amount)');
            const dp = A.pays.filter(r => r.paid_at).map(r => ({ t: new Date(r.paid_at).getTime(), y: Number(r.gross_amount || 0), color: A.PAID.includes(r.status) ? C.green : C.red, size: 13 }));
            const minT = Math.min(...dp.map(p => p.t));
            scatter(dp.map(p => ({ x: p.t - minT, y: p.y, color: p.color, size: p.size })), 'First purchase', 'Latest', '');
            sub2('Receipts');
            A.pays.forEach(r => {
              ensure(12);
              color('#111827'); font(9, true); doc.text(clip(typeof creatorProductName === 'function' ? creatorProductName(r.product_type, r.product_id) : 'Purchase', CW - 50), M, y + 2.5);
              color('#000000'); doc.text(money(r.gross_amount), M + CW, y + 2.5, { align: 'right' });
              color('#9ca3af'); font(7.5, false); doc.text(txt((typeof creatorDate === 'function' ? creatorDate(r.paid_at) : '') + '  -  ' + (r.status || '') + (r.paystack_reference ? '  -  Ref ' + r.paystack_reference : '')), M, y + 7);
              y += 11;
            });
          } else empty(A.paymentsMissing ? 'Receipts are not set up yet.' : 'No purchases yet. Receipts for paid classes show up here.');

          // ---- screen time ----
          section(C.purple, 'Screen time', 'Time spent in Stitch on this device, last 7 days', 80);
          tiles([{ v: actFmtDuration(A.screenToday), l: 'Today', c: C.purple }, { v: actFmtDuration(A.screenWeek / 7), l: 'Daily average', c: C.blue }, { v: actFmtDuration(A.screenWeek), l: 'This week', c: C.cyan }]);
          bars(A.days.map(d => d.label), A.days.map(d => Math.round(d.sec / 60)), C.purple);
          note('Minutes per day.');

          // ---- top posts ----
          const topList = [...A.myPosts].sort((a, b) => A.score(b) - A.score(a)).slice(0, 5);
          if (topList.length) {
            section(C.amber, 'Top posts', null, 40);
            topList.forEach((p, i) => { ensure(7); color('#374151'); font(9, false); doc.text((i + 1) + '. ' + clip(p.body || 'Photo/video post', CW - 30), M, y + 2); color('#6b7280'); font(8.5, true); doc.text(A.score(p) + ' reactions', M + CW, y + 2, { align: 'right' }); y += 7; });
          }

          // ---- footer on every page ----
          const pages = doc.getNumberOfPages();
          for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            color('#9ca3af'); font(7.5, false);
            // Footer brand: the Stitch logo + wordmark in black (same size as the old text), then the
            // document name
            try {
              const LW = 12, LH = LW * 204 / 500;
              doc.addImage('data:image/png;base64,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', 'PNG', M, PH - 9 - 0.95 - LH * 0.52, LW, LH, 'stitch-logo', 'FAST');
              doc.text('-  My Activity', M + LW + 1.5, PH - 9);
            } catch (e) {
              doc.text('Stitch  -  My Activity', M, PH - 9);
            }
            doc.text('Page ' + i + ' of ' + pages, PW - M, PH - 9, { align: 'right' });
          }
          doc.save('my-stitch-activity-' + actDayKey(Date.now()) + '.pdf');
        }

        function profileAnalyticsHTML(){
          if (!myActivityLoading && (myActivityData === null || Date.now() - myActivityLoadedAt > 60000) && typeof loadMyActivityData === 'function') loadMyActivityData();
          if (insightsNetworkTimes === null && typeof loadInsightsNetworkTimes === 'function') loadInsightsNetworkTimes();
          const A = myActivityCollect();
          const myPosts = A.myPosts;
          const engagementTotal = A.likes + A.comments + A.reposts + A.shares;
          const topPosts = A.myPosts.length ? [...myPosts].sort((a,b) => A.score(b) - A.score(a)).slice(0,3) : [];
          const recentActivity = feedPosts.filter(p => p.mine)
            .flatMap(p => (p.commentsList||[]).map(c => ({ ...c, post: p })))
            .slice(-6).reverse();
          const loadingNote = myActivityData === null ? `<div class="text-[11px] text-gray-400" style="margin-top:8px;">Loading the rest of your activity...</div>` : '';

          // Weekly audience reactions (by the week each post was made)
          const WEEKS = 8, wk = insightsWeekBuckets(WEEKS);
          const wLikes = new Array(WEEKS).fill(0), wComments = new Array(WEEKS).fill(0), wReposts = new Array(WEEKS).fill(0), wShares = new Array(WEEKS).fill(0);
          myPosts.forEach(p => { const i = wk.idxOf(insightsPostTime(p)); if (i < 0) return; wLikes[i] += p.likes||0; wComments[i] += p.comments||0; wReposts[i] += p.reposts||0; wShares[i] += p.shares||0; });
          const audienceLine = insightsLineChartHTML(wk.labels, [
            { name: 'Likes', color: ACT_COLORS.red, values: wLikes },
            { name: 'Comments', color: ACT_COLORS.blue, values: wComments },
            { name: 'Reposts', color: ACT_COLORS.green, values: wReposts },
            { name: 'Shares', color: ACT_COLORS.amber, values: wShares },
          ]);

          // Profile views per week
          const wViews = new Array(WEEKS).fill(0);
          A.views.forEach(v => { const t = v.created_at ? new Date(v.created_at).getTime() : 0; const i = wk.idxOf(t); if (i >= 0) wViews[i]++; });

          // Top post vs the rest
          const cmpRows = [['Likes','likes',ACT_COLORS.red],['Comments','comments',ACT_COLORS.blue],['Reposts','reposts',ACT_COLORS.green],['Shares','shares',ACT_COLORS.amber]];
          const cmpMax = Math.max(1, ...cmpRows.map(([, k]) => Math.max(A.topPost ? (A.topPost[k]||0) : 0, A.avg(k))));
          const compare = A.topPost ? `
            <div class="flex items-center gap-4 text-[11px] text-gray-500" style="margin-bottom:10px;">
              <span class="flex items-center gap-1.5"><i style="width:10px;height:10px;border-radius:3px;background:${ACT_COLORS.blue};display:inline-block;"></i>Top post</span>
              <span class="flex items-center gap-1.5"><i style="width:10px;height:10px;border-radius:3px;background:${ACT_COLORS.gray};display:inline-block;"></i>Average of your other posts</span>
            </div>
            ${cmpRows.map(([label, k]) => {
              const top = A.topPost[k] || 0, av = A.avg(k);
              return `<div style="margin-bottom:12px;">
                <div class="text-xs font-medium text-gray-600" style="margin-bottom:4px;">${label}</div>
                <div class="myact-hbar"><div style="width:${Math.max(top ? 4 : 0, top / cmpMax * 100)}%;background:${ACT_COLORS.blue};"></div><span>${top}</span></div>
                <div class="myact-hbar" style="margin-top:4px;"><div style="width:${Math.max(av ? 4 : 0, av / cmpMax * 100)}%;background:${ACT_COLORS.gray};"></div><span>${Math.round(av * 10) / 10}</span></div>
              </div>`;
            }).join('')}
            ${A.others.length ? '' : `<div class="text-[11px] text-gray-400">Post a few more times to see how your best post compares.</div>`}`
            : `<div class="text-xs text-gray-400">Once you post, your best post is compared with the rest here.</div>`;

          // Posts scatter: age vs engagement
          const now = Date.now();
          const postPts = myPosts.map(p => {
            const t = insightsPostTime(p); const age = t ? Math.max(0, (now - t) / 86400000) : 0;
            const isTop = A.topPost && p === A.topPost;
            return { x: age, y: A.score(p), size: isTop ? 18 : 12, color: isTop ? ACT_COLORS.amber : ACT_COLORS.blue, tip: (p.body || 'Post').slice(0, 40) };
          });
          const maxAge = Math.max(1, ...postPts.map(p => p.x));
          postPts.forEach(p => { p.x = maxAge - p.x; }); // right = newest

          // Payments scatter
          const payPts = A.pays.filter(r => r.paid_at).map(r => ({ x: new Date(r.paid_at).getTime(), y: Number(r.gross_amount || 0), color: A.PAID.includes(r.status) ? ACT_COLORS.green : ACT_COLORS.red, size: 13, tip: r.status }));
          const minT = Math.min(...payPts.map(p => p.x), now);
          payPts.forEach(p => { p.x = p.x - minT; }); const spanT = Math.max(1, ...payPts.map(p => p.x)); 
          const payStatusPie = [
            { label: 'Paid', value: A.pays.filter(r => A.PAID.includes(r.status)).length, color: ACT_COLORS.green },
            { label: 'Refunded', value: A.pays.filter(r => r.status === 'refunded').length, color: ACT_COLORS.gray },
            { label: 'Failed / other', value: A.pays.filter(r => !A.PAID.includes(r.status) && r.status !== 'refunded').length, color: ACT_COLORS.red },
          ];
          const receiptsPreview = A.pays.slice(0, 3).map(r => `
            <div class="flex items-center justify-between" style="padding:10px 0;border-top:1px solid #f3f4f6;">
              <div class="min-w-0 pr-3">
                <div class="text-sm font-medium text-gray-800 truncate">${escapeHtml(typeof creatorProductName === 'function' ? creatorProductName(r.product_type, r.product_id) : 'Purchase')}</div>
                <div class="text-[11px] text-gray-400">${typeof creatorDate === 'function' ? creatorDate(r.paid_at) : ''}</div>
              </div>
              <div class="text-sm font-bold" style="color:${NAVY};">${ghs(r.gross_amount)}</div>
            </div>`).join('');

          // Screen time
          const stMaxMin = Math.max(1, ...A.days.map(d => Math.round(d.sec / 60)));
          const screenBars = insightsBarChartHTML(A.days.map(d => d.label), A.days.map(d => Math.round(d.sec / 60)), ACT_COLORS.purple);

          // Most interaction
          const chatMax = Math.max(1, ...A.chats.map(c => c.sent + c.received));
          const chatList = A.chats.length ? A.chats.map((c, i) => `
            <div style="margin-bottom:12px;">
              <div class="flex items-center justify-between text-xs" style="margin-bottom:4px;">
                <span class="font-medium text-gray-700 truncate pr-3">${i + 1}. ${escapeHtml(c.name || 'Stitch member')}</span>
                <span class="text-gray-400 flex-shrink-0">${c.sent + c.received} msgs</span>
              </div>
              <div class="h-2 rounded-full bg-gray-100 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.max(6, (c.sent + c.received) / chatMax * 100)}%;background:${ACT_COLORS.cyan};"></div></div>
              <div class="text-[10px] text-gray-400" style="margin-top:3px;">You sent ${c.sent} &middot; they sent ${c.received}</div>
            </div>`).join('') : `<div class="text-xs text-gray-400">${myActivityData === null ? 'Loading...' : 'Chat with people and the ones you talk to most show up here.'}</div>`;

          const dlBtnClass = 'myact-dl-circle';
          return `
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
            ${overlayHeader('My Activity', '20px', null, null, { right: true })}
            <div class="p-5 space-y-4">

              <div class="rounded-3xl p-5 text-white stat-hero-pill" style="background:linear-gradient(135deg,${ROYAL},${NAVY});position:relative;overflow:hidden;">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-xs text-blue-200 font-semibold uppercase tracking-wide">Your activity at a glance</div>
                    <div class="flex gap-5" style="margin-top:12px;">
                      <div><div class="text-2xl font-bold font-display" style="line-height:1;">${A.myPosts.length}</div><div class="text-[11px] text-blue-100">Posts</div></div>
                      <div><div class="text-2xl font-bold font-display" style="line-height:1;">${typeof cachedNetworkCount === 'number' ? cachedNetworkCount : 0}</div><div class="text-[11px] text-blue-100">Connections</div></div>
                      <div><div class="text-2xl font-bold font-display" style="line-height:1;">${A.appliedJobs.length}</div><div class="text-[11px] text-blue-100">Applied</div></div>
                    </div>
                  </div>
                  <button type="button" onclick="downloadMyActivity()" aria-label="Download my activity" class="${dlBtnClass}">${Icon('download','w-5 h-5')}</button>
                </div>
                <div class="myact-hero-bars" aria-hidden="true">${[40,65,35,80,55,90,60,100].map(h => `<i style="height:${h}%;"></i>`).join('')}</div>
              </div>
              ${loadingNote}

              <div class="flex gap-3">
                ${actStatTile(A.myPosts.length, 'Total posts', ACT_COLORS.blue)}
                ${actStatTile(engagementTotal, 'Total reactions', ACT_COLORS.red)}
                ${actStatTile(A.myPosts.length ? Math.round(engagementTotal / A.myPosts.length * 10) / 10 : 0, 'Avg per post', ACT_COLORS.green)}
              </div>

              <div style="padding:6px 2px 2px;">${insightsPostActivityChartHTML(feedPosts.filter(p => p.mine))}</div>

              ${actSectionHTML(ACT_COLORS.amber, 'Top post vs your other posts', `Total posts: ${A.myPosts.length}`, compare)}

              ${actSectionHTML(ACT_COLORS.purple, 'Every post, plotted', 'Each dot is a post: higher means more reactions. The gold dot is your top post.', actScatterHTML(postPts, { xLeft: 'Older', xRight: 'Newer', empty: 'Your posts will be plotted here once you post.', legend: '' }))}

              ${actSectionHTML(ACT_COLORS.red, 'Audience activity', 'Reactions on your posts, by the week you posted', `
                ${audienceLine}
                <div style="margin-top:18px;">${actPieHTML([
                  { label: 'Likes', value: A.likes, color: ACT_COLORS.red },
                  { label: 'Comments', value: A.comments, color: ACT_COLORS.blue },
                  { label: 'Reposts', value: A.reposts, color: ACT_COLORS.green },
                  { label: 'Shares', value: A.shares, color: ACT_COLORS.amber },
                ], 'Reactions will be broken down here once people start interacting.')}</div>`)}

              ${actSectionHTML(ACT_COLORS.pink, 'Profile & Glimpse views', 'Who is looking at you', `
                <div class="flex gap-3" style="margin-bottom:14px;">
                  ${actStatTile(A.views.length, 'Profile views', ACT_COLORS.pink)}
                  ${actStatTile(A.glimpseViews, 'Glimpse views', ACT_COLORS.purple)}
                  ${actStatTile(A.glimpsesPosted, 'Glimpses posted', ACT_COLORS.cyan)}
                </div>
                ${insightsLineChartHTML(wk.labels, [{ name: 'Profile views', color: ACT_COLORS.pink, values: wViews, area: true }])}
                ${A.viewsMissing ? `<div class="text-[11px] text-gray-400" style="margin-top:8px;">Profile views start counting once view tracking is switched on for your account.</div>` : ''}`)}

              ${actSectionHTML(ACT_COLORS.green, 'Classes', 'Created vs joined', actPieHTML([
                { label: 'Created', value: A.classesCreated, color: ACT_COLORS.blue },
                { label: 'Joined', value: A.classesJoined, color: ACT_COLORS.green },
              ], 'Create or join a class and it shows up here.'))}

              ${actSectionHTML(ACT_COLORS.amber, 'Opportunities', 'What you posted, interacted with and how your applications went', `
                <div class="text-xs font-semibold text-gray-600" style="margin-bottom:8px;">Posted vs interacted with</div>
                ${actPieHTML([
                  { label: 'Posted', value: A.posted, color: ACT_COLORS.blue },
                  { label: 'Applied', value: A.appliedJobs.length, color: ACT_COLORS.green },
                  { label: 'Saved', value: A.saved, color: ACT_COLORS.amber },
                ], 'Post, save or apply to opportunities and they show up here.')}
                <div class="text-xs font-semibold text-gray-600" style="margin:18px 0 8px;">Application results</div>
                ${actPieHTML([
                  { label: 'Successful', value: A.succ, color: ACT_COLORS.green },
                  { label: 'In progress', value: A.prog, color: ACT_COLORS.amber },
                  { label: 'Unsuccessful', value: A.fail, color: ACT_COLORS.red },
                ], 'Apply to an opportunity to see how your applications go.')}
                <div class="text-[11px] text-gray-400" style="margin-top:8px;">Successful means shortlisted, interview or offer.</div>`)}

              ${actSectionHTML(ACT_COLORS.cyan, 'My network', 'Connections, requests and who you talk to', `
                ${insightsNetworkChartHTML(typeof cachedNetworkCount === 'number' ? cachedNetworkCount : undefined)}
                <div class="text-xs font-semibold text-gray-600" style="margin:18px 0 8px;">Connection requests you sent</div>
                ${actPieHTML([
                  { label: 'Successful', value: A.reqOk, color: ACT_COLORS.green },
                  { label: 'Pending', value: A.reqPending, color: ACT_COLORS.amber },
                  { label: 'Unsuccessful', value: A.reqFail, color: ACT_COLORS.red },
                ], myActivityData === null ? 'Loading...' : 'Requests you send show up here.')}
                <div class="text-xs font-semibold text-gray-600" style="margin:18px 0 10px;">Most interaction</div>
                ${chatList}`)}

              ${actSectionHTML(ACT_COLORS.green, 'Payments & receipts', A.pays.length ? `${A.pays.length} purchase${A.pays.length === 1 ? '' : 's'} &middot; ${ghs(A.spent)} spent` : 'Paid classes and courses', A.pays.length ? `
                ${actPieHTML(payStatusPie)}
                <div class="text-xs font-semibold text-gray-600" style="margin:18px 0 8px;">Purchases over time (higher = bigger amount)</div>
                ${actScatterHTML(payPts.map(p => ({ ...p, x: p.x })), { xLeft: 'First purchase', xRight: 'Latest', yMax: ghs(Math.max(...A.pays.map(r => Number(r.gross_amount || 0)))), legend: '' })}
                <div style="margin-top:14px;">${receiptsPreview}</div>
                <button onclick="overlayReturnTo='profileAnalytics';openReceipts()" class="w-full text-center text-xs font-semibold" style="padding-top:10px;color:${ROYAL};">View all receipts</button>`
                : `<div class="text-xs text-gray-400">${A.paymentsMissing ? 'Receipts are not set up yet.' : (myActivityData === null ? 'Loading...' : 'No purchases yet. Receipts for paid classes show up here.')}</div>`, true)}

              ${actSectionHTML(ACT_COLORS.purple, 'Screen time', 'Time spent in Stitch on this device, last 7 days', `
                <div class="flex gap-3" style="margin-bottom:12px;">
                  ${actStatTile(actFmtDuration(A.screenToday), 'Today', ACT_COLORS.purple)}
                  ${actStatTile(actFmtDuration(A.screenWeek / 7), 'Daily average', ACT_COLORS.blue)}
                  ${actStatTile(actFmtDuration(A.screenWeek), 'This week', ACT_COLORS.cyan)}
                </div>
                ${screenBars}
                <div class="text-[11px] text-gray-400" style="margin-top:8px;">Minutes per day. Counting started the first time this version opened.</div>`, true)}

              <div>
                <div class="font-semibold text-sm text-gray-800 mb-1">Top posts</div>
                ${topPosts.length ? `
                  <div class="divide-y">
                    ${topPosts.map(p => `
                      <button onclick="(function(){const sc=document.querySelector('#overlay .overflow-y-auto');profileInsightsSavedScrollTop=sc?sc.scrollTop:0;})();overlayReturnTo='profileAnalytics';openPostDetail(${p.id}, undefined, true)" class="w-full flex items-center gap-3 py-3 text-left">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm text-gray-700 truncate">${escapeHtml(p.body || 'Photo/video post')}</div>
                        </div>
                        ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
                      </button>`).join('')}
                  </div>
                ` : `<div class="text-xs text-gray-400">Once you post, your best-performing posts will show up here.</div>`}
              </div>

              ${recentActivity.length ? `
                <div>
                  <div class="font-semibold text-sm text-gray-800 mb-1">Recent comments</div>
                  <div class="divide-y">
                    ${recentActivity.map(c => `
                      <button onclick="overlayReturnTo='profileAnalytics';openPostDetail(${c.post.id}, undefined, true)" class="w-full flex items-start gap-2.5 py-3 text-left">
                        <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon('user','w-4 h-4')}</div>
                        <div class="min-w-0">
                          <div class="text-xs text-gray-700"><span class="font-semibold">${escapeHtml(c.name)}</span> commented: "${escapeHtml(c.text)}"</div>
                          <div class="text-[10px] text-gray-400 mt-0.5 truncate">on "${escapeHtml((c.post.body||'').slice(0,40))}${(c.post.body||'').length>40?'…':''}"</div>
                        </div>
                      </button>`).join('')}
                  </div>
                </div>
              ` : ''}

              <button type="button" onclick="downloadMyActivity()" class="myact-dl-pill">${Icon('download','w-5 h-5')}<span>Download my activity</span></button>
              <div class="text-[11px] text-gray-400 text-center" style="padding-bottom:max(24px, env(safe-area-inset-bottom));">Saves everything on this page as a PDF on your device.</div>
            </div>
            </div>`;
        }
