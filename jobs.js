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
            <div id="career-tabs-scroller" class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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
                <button id="career-dashes-btn" onclick="toggleCareerMenu()" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('dashes','w-6 h-6'))}</button>
                <h1 class="text-base font-bold font-display grad-text">Career Space</h1>
                <div id="career-icons-group" class="flex items-center rounded-full" style="background:rgba(65,105,225,0.08);">
                  <button onclick="openOverlay('careerAnalytics')" class="w-8 h-8 flex items-center justify-center">${gradIcon(IconBold('trending','w-4 h-4'))}</button>
                </div>
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
          const screenEl = document.getElementById('screen');
          careerMenuScrollAnchor = screenEl ? screenEl.scrollTop : 0;
          careerMenuArmed = false;

          const backdrop = document.createElement('div');
          backdrop.id = 'career-menu-backdrop';
          backdrop.className = 'fixed inset-0 z-30';
          backdrop.onclick = closeCareerMenuDropdownDom;
          backdrop.onwheel = closeCareerMenuDropdownDom;
          backdrop.addEventListener('touchmove', closeCareerMenuDropdownDom, { passive: true });
          document.body.appendChild(backdrop);

          const wrap = document.createElement('div');
          wrap.innerHTML = careerMenuDropdownHTML();
          document.body.appendChild(wrap.firstElementChild);

          requestAnimationFrame(() => { positionCareerMenuDropdown(); fitCareerMenuDropdownWidth(); });
          setTimeout(() => { careerMenuArmed = true; }, 300);

          if (screenEl) {
            const onScroll = () => {
              if (careerMenuArmed && Math.abs(screenEl.scrollTop - careerMenuScrollAnchor) > 4) {
                closeCareerMenuDropdownDom();
              }
            };
            screenEl.addEventListener('scroll', onScroll, { passive: true });
            screenEl._careerMenuScrollCloser = onScroll;
          }
        }

        function fitCareerMenuDropdownWidth(){
          const dropdown = document.getElementById('career-menu-dropdown');
          if (!dropdown) return;
          const cs = getComputedStyle(dropdown);
          const padX = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
          const buttons = dropdown.querySelectorAll('button');
          let maxW = 0;
          buttons.forEach(btn => {
            btn.style.width = 'auto';
            maxW = Math.max(maxW, btn.scrollWidth);
          });
          dropdown.style.width = (maxW + padX) + 'px';
          buttons.forEach(btn => { btn.style.width = maxW + 'px'; });
        }

        function closeCareerMenuDropdownDom(){
          careerMenuOpen = false;
          const dropdown = document.getElementById('career-menu-dropdown');
          const backdrop = document.getElementById('career-menu-backdrop');
          if (dropdown) dropdown.remove();
          if (backdrop) backdrop.remove();
          const screenEl = document.getElementById('screen');
          if (screenEl && screenEl._careerMenuScrollCloser) {
            screenEl.removeEventListener('scroll', screenEl._careerMenuScrollCloser);
            screenEl._careerMenuScrollCloser = null;
          }
        }

        function positionCareerMenuDropdown(){
          const btn = document.getElementById('career-dashes-btn');
          const dropdown = document.getElementById('career-menu-dropdown');
          if (!btn || !dropdown) return;
          const rect = btn.getBoundingClientRect();
          dropdown.style.top = (rect.bottom + 8) + 'px';
          dropdown.style.left = rect.left + 'px';
          dropdown.style.visibility = 'visible';
        }

        function careerMenuDropdownHTML(){
          return `
            <div id="career-menu-dropdown" class="fixed bg-white rounded-2xl shadow-lg border border-gray-100 py-1.5 z-30 menu-dropdown-inset" style="visibility:hidden;">
              <button onclick="closeCareerMenuThen(() => jobsSubTab('applied'))" class="text-left px-3 py-2 text-sm whitespace-nowrap text-gray-700 menu-item-pill">My Applications</button>
              <button onclick="closeCareerMenuThen(() => jobsSubTab('saved'))" class="text-left px-3 py-2 text-sm whitespace-nowrap text-gray-700 menu-item-pill">Saved</button>
              <button onclick="closeCareerMenuThen(() => openCareerStartForm())" class="text-left px-3 py-2 text-sm whitespace-nowrap text-gray-700 menu-item-pill">Match with CV</button>
              ${isCurrentUserAdmin() ? `<button onclick="closeCareerMenuThen(() => openPostOpportunity())" class="text-left px-3 py-2 text-sm whitespace-nowrap text-gray-700 menu-item-pill">Post an Opportunity</button>` : ''}
            </div>`;
        }

        function closeCareerMenuThen(fn){
          closeCareerMenuDropdownDom();
          fn();
        }

        const ADMIN_EMAILS = ['0festusnkrumah@gmail.com']; 
        const PROFILES_TABLE = 'profiles';
        const OPPORTUNITIES_TABLE = 'opportunities';
        let currentUserRole = 'user';
        let currentUserEmail = null;

        async function loadCurrentUserRole(){
          currentUserRole = 'user';
          currentUserEmail = null;
          const sb = getSupabaseClient();
          if (!sb) return; 
          try {
            const user = await getCachedAuthUser();
            if (!user) return;
            currentUserEmail = user.email || null;
            if (currentUserEmail && ADMIN_EMAILS.includes(currentUserEmail)) {
              currentUserRole = 'admin';
              return;
            }
            const { data: profile, error } = await sb
              .from(PROFILES_TABLE)
              .select('role')
              .eq('user_id', user.id)
              .maybeSingle();
            if (!error && profile && profile.role === 'admin') currentUserRole = 'admin';
          } catch (e) {  }
        }

        function isCurrentUserAdmin(){
          return currentUserRole === 'admin';
        }

        async function postOpportunityInsertRemote(job){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data } = await sb.auth.getUser();
            const user = data && data.user;
            const { error } = await sb.from(OPPORTUNITIES_TABLE).upsert({
              id: job.id,
              data: job,
              created_by: user ? user.id : null,
            });
            if (error) console.warn('Opportunity did not sync to Supabase (see opportunities table SQL comment above):', error);
            return !error;
          } catch (e) { console.warn('Opportunity sync threw an error:', e); return false; }
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

        let jobsData = {
          opportunities: [],
          internships: [],
          courses: [],
          scholarships: [],
          others: [],
        };

        async function loadOpportunitiesRemote(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data, error } = await withClockSkewRetry(sb, () => sb.from(OPPORTUNITIES_TABLE).select('*'));
            if (error) { console.warn('Loading opportunities from Supabase failed (see opportunities table SQL comment above):', error); return; }
            if (!data) return;
            const rows = data
              .map(row => (row.data && typeof row.data === 'object') ? Object.assign({}, row.data, { id: row.id }) : null)
              .filter(Boolean);
            jobsData = {
              opportunities: rows.filter(j => j.type !== 'Course' && j.type !== 'Internship' && j.type !== 'Scholarship' && j.type !== 'Other'),
              internships: rows.filter(j => j.type === 'Internship'),
              courses: rows.filter(j => j.type === 'Course'),
              scholarships: rows.filter(j => j.type === 'Scholarship'),
              others: rows.filter(j => j.type === 'Other'),
            };
            await autoDeleteExpiredOpportunities();
          } catch (e) { console.warn('Loading opportunities threw an error:', e); }
        }

        // ---- Consistent admin-picked date system ----
        // Deadlines are chosen through a native <input type="date"> so every
        // listing's deadlineDate is always a plain, unambiguous ISO string
        // (YYYY-MM-DD) rather than free-typed text -- that's what makes
        // auto-expiry below reliable across devices/browsers/locales.
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

        // Fallback parser for free-typed deadline strings from before the
        // date picker existed (or admin edits typed by hand). Handles
        // ordinal suffixes ("30th", "1st", "22nd", "23rd") and both
        // "30 August 2026" / "August 30, 2026" word orders, which
        // Date.parse() doesn't reliably understand -- an unparseable
        // string used to mean the listing's deadline silently never
        // "passed" and it stuck around forever.
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
          // Last resort: let the browser have a go (covers ISO-ish and
          // other formats it already understands fine).
          const parsed = Date.parse(cleaned);
          return isNaN(parsed) ? null : new Date(parsed);
        }

        // ---- Auto-delete opportunities once their deadline has passed ----
        // Courses are exempt: their "deadline" field is a start date, not a
        // closing date, so they're left alone here.
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
          // Fall back to parsing the legacy free-typed display string, for
          // listings created before the date picker existed.
          const raw = (job.deadline || '').trim();
          if (!raw || /^no deadline given$/i.test(raw)) return null;
          const dateStr = raw.replace(/^Deadline\s+/i, '').trim();
          if (!dateStr) return null;
          return parseFreeTypedDeadline(dateStr);
        }

        function isOpportunityDeadlinePassed(job){
          const deadline = parsedOpportunityDeadline(job);
          if (!deadline) return false;
          // Keep the listing up through the end of its deadline day rather than
          // dropping it the instant the date ticks over.
          const endOfDeadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59, 999);
          return Date.now() > endOfDeadlineDay.getTime();
        }

        // Removes any opportunity/internship/scholarship/other listing whose
        // deadline has passed, both locally and in Supabase, so admins never
        // have to come back and delete expired listings by hand.
        async function autoDeleteExpiredOpportunities(){
          const expired = allJobs().filter(isOpportunityDeadlinePassed);
          if (!expired.length) return false;
          expired.forEach(job => {
            const bucket = jobBucketFor(job);
            const idx = bucket.indexOf(job);
            if (idx !== -1) bucket.splice(idx, 1);
            deleteOpportunityRemote(job.id);
          });
          return true;
        }

        let opportunitiesPollInterval = null;
        function startOpportunitiesPolling(){
          if (opportunitiesPollInterval) return;
          opportunitiesPollInterval = setInterval(async () => {
            const sb = getSupabaseClient();
            if (!sb) return;
            const before = JSON.stringify(allJobs().map(j => j.id));
            await loadOpportunitiesRemote();
            const after = JSON.stringify(allJobs().map(j => j.id));
            if (before === after) return;
            if (typeof currentTab !== 'undefined' && currentTab === 1) {
              const content = document.getElementById('jobs-content');
              if (content) content.innerHTML = jobsContent();
              else if (typeof renderJobMarket === 'function') renderJobMarket();
            }
            if (activeJobId && !allJobs().some(j => j.id === activeJobId) && typeof closeOverlay === 'function') closeOverlay();
          }, 60000);
        }

        // ---- Job/course listing data + application status helpers ----
        // Defensive, synchronous safety net: allJobs()/allExploreCards()
        // are what every screen actually renders from, so filtering
        // expired opportunities out right here guarantees a passed
        // deadline can never show up -- even for the moment between the
        // deadline ticking over and the next background
        // autoDeleteExpiredOpportunities() pass (or an admin-typed legacy
        // deadline string that only the fallback parser can read).
        function allJobs(){
          return [...jobsData.opportunities, ...jobsData.internships, ...jobsData.courses, ...jobsData.scholarships, ...jobsData.others]
            .filter(j => !isOpportunityDeadlinePassed(j));
        }

        function courseAsExploreCard(course){
          return {
            id: course.id,
            type: 'Course',
            title: course.title,
            org: course.org,
            sub: course.org,
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
          return [...jobsData.opportunities, ...jobsData.internships, ...exploreCourseCards(), ...jobsData.scholarships, ...jobsData.others]
            .filter(j => !isOpportunityDeadlinePassed(j));
        }

        let jobApplications = {}; 

        function jobApplication(job){
          return (job && jobApplications[job.id]) || null;
        }
        function isJobApplied(job){
          return !!jobApplication(job);
        }

        const JOB_STATUS_META = {
          applied:      { label: 'Awaiting reply', color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-600' },
          interviewing: { label: 'Interviewing',    color: '#b45309', bg: 'bg-amber-100',   text: 'text-amber-700' },
          offer:        { label: 'Offer received',  color: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700' },
          rejected:     { label: 'Not selected',    color: '#be123c', bg: 'bg-rose-100',    text: 'text-rose-700' },
        };
        const JOB_STATUS_ORDER = ['applied', 'interviewing', 'offer', 'rejected'];

        function jobStatusMeta(job){
          const app = jobApplication(job);
          return JOB_STATUS_META[(app && app.status) || 'applied'];
        }

        function fmtJobDate(ts){
          if (!ts) return '';
          return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }

        function updateJobApplicationStatus(id, status){
          const job = findJob(id);
          const app = jobApplication(job);
          if (!job || !app) return;
          app.status = status;
          app.statusUpdatedDate = Date.now();
          queueSaveUserState();
          const ov = document.getElementById('overlay');
          if (ov && activeJobId === id) ov.innerHTML = jobDetailHTML();
          const jobsContentEl = document.getElementById('jobs-content');
          if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
        }

        function updateJobStatusNote(id, note){
          const app = jobApplication(findJob(id));
          if (!app) return;
          app.statusNote = note;
          queueSaveUserState();
        }

        function jobStatusBadge(job){
          const app = jobApplication(job);
          if (!app) return '';
          const meta = jobStatusMeta(job);
          return `<span class="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.bg} ${escapeHtml(meta.text)}">${job.type === 'Course' ? 'Enrolled' : meta.label}</span>`;
        }

        function applicationStatusCardHTML(job){
          const app = jobApplication(job) || {};
          const meta = jobStatusMeta(job);
          return `
            <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
              <div class="flex items-center justify-between mb-1">
                <div class="font-semibold text-sm text-gray-800">Application status</div>
                <span class="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${meta.bg} ${escapeHtml(meta.text)}">${escapeHtml(meta.label)}</span>
              </div>
              <div class="text-xs text-gray-400 mb-3">Applied ${fmtJobDate(app.appliedDate)}${(app.status && app.status !== 'applied' && app.statusUpdatedDate) ? ` · Updated ${fmtJobDate(app.statusUpdatedDate)}` : ''}</div>
              <div class="text-xs text-gray-400 mb-4">Stitch can't read employer inboxes, so log any reply yourself to keep track of it here.</div>
              <div class="grid grid-cols-2 gap-2 mb-4">
                ${JOB_STATUS_ORDER.map(k => {
                  const active = (app.status || 'applied') === k;
                  const m = JOB_STATUS_META[k];
                  return `<button onclick="updateJobApplicationStatus('${job.id}','${k}')" class="px-3 py-2.5 rounded-xl text-xs font-semibold text-center" style="${active ? `background:${m.color};color:#ffffff;` : 'background:#f3f4f6;color:#6b7280;'}">${escapeHtml(m.label)}</button>`;
                }).join('')}
              </div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
              <textarea oninput="updateJobStatusNote('${job.id}', this.value)" placeholder="e.g. Phone screen scheduled for Thursday" rows="2" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm resize-none" style="outline:none;">${app.statusNote || ''}</textarea>
            </div>`;
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
          if (!isCurrentUserAdmin()) return;
          const job = findJob(id);
          if (!job) return;
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
                // Soft-delete the linked course instead of removing it outright,
                // so students who already enrolled don't lose access.
                archiveCourse(job.courseId);
              }
              if (activeJobId === id) closeOverlay();
              renderJobMarket();
            }
          );
        }

        function toggleSaveJob(id){
          const job = findJob(id);
          if (!job) return;
          job.saved = !job.saved;
          renderJobMarket();
          renderSavedItemsOverlay();
        }

        function jobMatchesSearch(j, q){
          return [j.title, j.sub, j.org, j.description, j.type].filter(Boolean).some(f => f.toLowerCase().includes(q));
        }

        // ---- Job list + job detail screens ----
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
              : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">Nothing posted yet.</div>`;
          }
          if (jobsSub === 'opportunities') return jobsData.opportunities.filter(j => !isOpportunityDeadlinePassed(j)).map(jobCard).join('');
          if (jobsSub === 'internships') return jobsData.internships.filter(j => !isOpportunityDeadlinePassed(j)).map(jobCard).join('');
          if (jobsSub === 'courses') return exploreCourseCards().map(jobCard).join('');
          if (jobsSub === 'scholarships') {
            const scholarships = jobsData.scholarships.filter(j => !isOpportunityDeadlinePassed(j));
            return scholarships.length
              ? scholarships.map(jobCard).join('')
              : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No scholarships posted yet.</div>`;
          }
          if (jobsSub === 'others') {
            const others = jobsData.others.filter(j => !isOpportunityDeadlinePassed(j));
            return others.length
              ? others.map(jobCard).join('')
              : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">Nothing else posted yet.</div>`;
          }
          if (jobsSub === 'saved') {
            const savedJobs = allJobs().filter(j => j.saved);
            return savedJobs.length
              ? savedJobs.map(jobCard).join('')
              : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No saved career opportunities yet.<br>Tap the bookmark icon on a listing to save it here.</div>`;
          }
          const appliedJobs = allJobs().filter(j => isJobApplied(j));
          return appliedJobs.length
            ? appliedJobs.map(jobCard).join('')
            : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">You haven't applied to anything yet.<br>Browse opportunities to get started.</div>`;
        }

        function jobCard(job){
          const idx = allJobs().findIndex(j => j.id === job.id);
          const motif = classCardMotifs[blueCardMotifIndex(job, idx === -1 ? 0 : idx) % classCardMotifs.length];
          const cardBackground = job.coverImage
            ? `background-image:linear-gradient(rgba(10,37,64,0.45),rgba(10,37,64,0.45)),url('${job.coverImage}');background-size:cover;background-position:center;`
            : blueCardBackgroundStyle(job, idx === -1 ? 0 : idx);
          return `
            <div onclick="${job.isCatalogCourse ? `openCourseDetail('${job.id}')` : `openJobOrClassroom('${job.id}')`}" class="career-job-card ${job.type === 'Course' ? 'career-job-card-course' : ''} rounded-3xl p-4 text-white relative overflow-hidden mb-4 shadow-sm cursor-pointer" style="${cardBackground}min-height:96px;">
              ${job.coverImage ? '' : `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${motif}</svg>`}
              <div class="flex items-center gap-4 relative">
                <div class="career-job-icon w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">${Icon(job.icon,'w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <div class="career-job-title font-semibold text-sm truncate">${escapeHtml(job.title)}</div>
                    ${jobStatusBadge(job)}
                  </div>
                  <div class="career-job-sub text-xs text-white/80 truncate">${job.sub} · ${job.deadline}</div>
                </div>
                ${job.isCatalogCourse ? '' : `<button onclick="event.stopPropagation(); toggleSaveJob('${job.id}')" class="flex-shrink-0 p-1 text-white/${job.saved ? '100' : '60'}">${Icon('bookmark','w-5 h-5')}</button>`}
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

        function openJobDetail(id){
          activeJobId = id;
          jobDetailMenuOpen = false;
          openOverlay('jobDetail');
        }

        function toggleJobDetailMenu(){
          jobDetailMenuOpen = !jobDetailMenuOpen;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobDetailHTML();
        }

        function jobDetailMenuDropdownHTML(job){
          const isCourse = job.type === 'Course';
          return `
            <div class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;width:12rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="openEditOpportunity('${job.id}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('edit','w-4 h-4')} Edit</button>
              <button onclick="jobDetailMenuOpen=false; deleteOpportunity('${job.id}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete ${isCourse ? 'course' : 'listing'}</button>
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
            teachers: [],
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
          enterClassroomTab();
          openCourseDetail(job.courseId);
        }

        function finalizeJobApplication(id){
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
          if (job.applyMethod === 'website' && job.website) {
            window.open(ensureUrlScheme(job.website), '_blank');
          } else if (job.email) {
            const d = jobApplyDraft;
            const isCourse = job.type === 'Course';
            let bodyLines;
            if (isCourse) {
              bodyLines = [
                'Hi,',
                '',
                `I'm glad to enroll in your "${job.title}". I will make the best out of it.`,
                '',
                'I consent to all class rules and regulations.',
                '',
                d.fullName,
                d.phone ? d.phone : null,
              ].filter(Boolean).join('\n');
            } else {
              const attachments = d.letterFileName ? `Application letter: ${d.letterFileName}` : '';
              bodyLines = [
                `Hi ${job.org || ''},`,
                '',
                `I'd like to apply for the ${escapeHtml(job.title)} opportunity posted on Stitch.`,
                '',
                `Name: ${d.fullName}`,
                `Email: ${d.email}`,
                d.phone ? `Phone: ${d.phone}` : null,
                attachments ? `\n[Attach before sending:]\n${attachments}` : null,
                d.letterText.trim() ? `\n${d.letterText.trim()}` : null,
              ].filter(Boolean).join('\n');
              if (attachments) {
                openAppAlertModal("Your mail app will open with a draft application. Please attach your cover letter file before hitting send -- Stitch can't attach it for you.");
              }
            }
            window.location.href = `mailto:${job.email}?subject=${encodeURIComponent((isCourse ? 'Enrollment: ' : 'Application: ') + job.title)}&body=${encodeURIComponent(bodyLines)}`;
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
          return `
            ${isCurrentUserAdmin()
              ? menuOverlayHeader('Opportunity', jobDetailMenuOpen, 'toggleJobDetailMenu', jobDetailMenuDropdownHTML(job))
              : overlayHeader('Opportunity', '20px')}
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
              ${job.coverImage ? `<img src="${job.coverImage}" class="w-full rounded-3xl mb-4 object-cover" style="height:150px;" alt="">` : ''}
              <div class="flex items-center gap-4 mb-5">
                <div class="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${Icon(job.icon,'w-7 h-7')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-lg font-display leading-snug">${escapeHtml(job.title)}</div>
                  <div class="text-sm text-gray-500 truncate">${job.org || ''}</div>
                </div>
              </div>
              <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
                <div class="font-semibold text-sm text-gray-800 mb-2">Description &amp; requirements</div>
                <div class="text-sm text-gray-600 leading-relaxed" style="white-space:pre-wrap;">${job.description ? escapeHtml(job.description) : 'No description provided.'}</div>
              </div>
              <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
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
                <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
                  <div class="font-semibold text-sm text-gray-800 mb-1">How to join</div>
                  <div class="text-xs text-gray-500">No application or letter needed: just enroll for free${job.priceType === 'paid' ? ', or pay the enrollment fee where applicable' : ''} to get started.${job.email ? ` Questions go to <span class="font-medium text-gray-700">${job.email}</span>.` : ''}</div>
                </div>` : (job.applyMethod === 'website' && job.website ? `
                <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
                  <div class="font-semibold text-sm text-gray-800 mb-1">How to apply</div>
                  <div class="text-xs text-gray-500">Applications are handled on their website: <a href="${ensureUrlScheme(job.website)}" target="_blank" rel="noopener" class="font-medium" style="color:${NAVY};">${escapeHtml(job.website)}</a></div>
                </div>` : (job.email ? `
                <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
                  <div class="font-semibold text-sm text-gray-800 mb-1">How to apply</div>
                  <div class="text-xs text-gray-500">Applications are sent directly to <span class="font-medium text-gray-700">${job.email}</span>.</div>
                </div>` : ''))}
              ${isJobApplied(job) && !isCourse && !isWebsiteJob ? applicationStatusCardHTML(job) : ''}
              ${(isCourse && isCurrentUserAdmin()) ? `
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
                  ? `<button onclick="openJobApply('${job.id}')" class="pill-cta inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.5rem 1.1rem;">${applyLabel}</button>`
                  : (isJobApplied(job)
                  ? (isCourse
                      ? `<button onclick="goToJobCourse('${job.id}')" class="pill-cta inline-flex items-center justify-center gap-2 text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.5rem 1.1rem;">${Icon('book','w-4 h-4')} Go to Course</button>`
                      : `<div class="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-base ${jobStatusMeta(job).bg} ${jobStatusMeta(job).text}">${Icon('check','w-4 h-4')} ${jobStatusMeta(job).label}</div>`)
                  : `<button onclick="openJobApply('${job.id}')" class="pill-cta inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.5rem 1.1rem;">${applyLabel}</button>`)}
              </div>
            </div>`;
        }

        let activeApplyJobId = null;
        let jobApplyDraft = { fullName:'', email:'', phone:'', letterFileName:'', letterText:'' };
        let jobApplyErrors = { fullName:'', email:'', phone:'' };

        // ---- Job application form ----
        function resetJobApplyDraft(){
          jobApplyDraft = { fullName:'', email:'', phone:'', letterFileName:'', letterText:'' };
          jobApplyErrors = { fullName:'', email:'', phone:'' };
        }

        function openJobApply(id){
          const job = findJob(id);
          // Website-based opportunities don't need our in-app form (name,
          // email, cover letter, etc.) -- the org's own site collects that.
          // Tapping "Apply" should just mark it applied and take the
          // person straight to the website, not into a form that used to
          // fall through to a mailto: compose screen.
          if (job && job.type !== 'Course' && job.applyMethod === 'website' && job.website) {
            finalizeJobApplication(id);
            openJobDetail(id);
            return;
          }
          activeApplyJobId = id;
          resetJobApplyDraft();
          jobApplyPaymentBusy = false;
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

        function jobApplyFieldRow(label, field, placeholder, type){
          const err = jobApplyErrors[field];
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${label}</label>
              <input type="${type || 'text'}" id="job-apply-input-${field}" value="${jobApplyDraft[field]}" oninput="updateJobApplyField('${field}', this.value)" placeholder="${placeholder || ''}" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm${err ? ' field-invalid' : ''}" style="outline:none;">
              ${err ? `<div class="field-error" id="job-apply-error-${field}">${escapeHtml(err)}</div>` : ''}
            </div>`;
        }

        function jobApplyFilePicker(label, field, inputId, accept){
          const fileName = jobApplyDraft[field];
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${label}</label>
              <input type="file" id="${inputId}" accept="${accept}" class="hidden" onchange="handleJobApplyFileSelect(event, '${field}')">
              <button onclick="document.getElementById('${inputId}').click()" class="w-full flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3 text-left">
                <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('paperclip','w-4 h-4')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate ${fileName ? 'text-gray-800' : 'text-gray-400'}">${fileName || 'Tap to attach a file'}</div>
                </div>
                ${fileName ? `<span onclick="event.stopPropagation(); clearJobApplyFile('${field}')" class="flex-shrink-0 text-gray-400">${IconBold('close','w-4 h-4')}</span>` : ''}
              </button>
            </div>`;
        }

        function handleJobApplyFileSelect(event, field){
          const file = event.target.files && event.target.files[0];
          event.target.value = '';
          if (!file) return;
          jobApplyDraft[field] = file.name;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobApplyHTML();
        }

        function clearJobApplyFile(field){
          jobApplyDraft[field] = '';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = jobApplyHTML();
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
        const careerStartStepIds = ['interests', 'keyword', 'experience', 'education', 'workStyle', 'contact', 'resume'];
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
        let careerStartDraft = { interests: [], jobTitle: '', experienceLevel: '', education: '', workStyle: '', fullName: '', email: '', phone: '', contactMethod: 'email', resumeFileName: '', resumeFile: null, resumeText: '', resumeDataUrl: '' };
        let careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', fullName: '', email: '', phone: '', resume: '' };
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
          careerStartDraft = { interests: [], jobTitle: '', experienceLevel: '', education: '', workStyle: '', fullName: '', email: '', phone: '', contactMethod: 'email', resumeFileName: '', resumeFile: null, resumeText: '', resumeDataUrl: '' };
          careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', fullName: '', email: '', phone: '', resume: '' };
          clearCareerStartResumeUploadTimers();
          careerStartResumeUploading = false;
          careerStartResumeUploadPhaseIndex = 0;
        }
        function openCareerStartForm(){
          if (careerStartProfile && careerStartProfile.email) {
            openCareerMatchesPage(false);
            return;
          }
          resetCareerStartDraft();
          openOverlay('careerStart');
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
            careerStartDraft.fullName = p.fullName || '';
            careerStartDraft.email = p.email || '';
            careerStartDraft.phone = p.phone || '';
            careerStartDraft.contactMethod = p.contactMethod || 'email';
            careerStartDraft.resumeFileName = p.resumeFileName || '';
            careerStartDraft.resumeText = p.resumeText || '';
            careerStartDraft.resumeDataUrl = p.resumeDataUrl || '';
          }
          if (returnKind) openOverlayFrom(returnKind, 'careerStart');
          else openOverlay('careerStart');
        }
        function rerenderCareerStart(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = careerStartFormHTML();
        }
        function careerStartBack(fromPopState){
          if (overlayReturnTo) { overlayGoBack(); return; }
          closeOverlay(fromPopState);
        }
        function updateCareerStartField(field, value){ careerStartDraft[field] = value; }
        function toggleCareerStartInterest(id){
          const idx = careerStartDraft.interests.indexOf(id);
          if (idx === -1) careerStartDraft.interests.push(id); else careerStartDraft.interests.splice(idx, 1);
          rerenderCareerStart();
        }
        function setCareerStartExperience(id){ careerStartDraft.experienceLevel = id; rerenderCareerStart(); }
        function setCareerStartEducation(id){ careerStartDraft.education = id; rerenderCareerStart(); }
        function setCareerStartWorkStyle(id){ careerStartDraft.workStyle = id; rerenderCareerStart(); }
        function handleCareerStartResumeSelect(event){
          const file = event.target.files && event.target.files[0];
          event.target.value = '';
          if (!file) return;
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
              <button onclick="document.getElementById('career-start-resume-input').click()" class="w-full flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3 text-left${err ? ' field-invalid' : ''}">
                <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon('paperclip','w-4 h-4')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate ${fileName ? 'text-gray-800' : 'text-gray-400'}">${fileName || 'Tap to attach your resume/CV (PDF or Word)'}</div>
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
              <input type="${type || 'text'}" value="${escapeHtml(careerStartDraft[field])}" oninput="updateCareerStartField('${field}', this.value)" placeholder="${placeholder || ''}" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm${err ? ' field-invalid' : ''}" style="outline:none;">
              ${err ? `<div class="field-error">${escapeHtml(err)}</div>` : ''}
            </div>`;
        }
        function careerStartOptionListHTML(options, selectedId, setterName, errorKey, withDesc){
          const err = careerStartErrors[errorKey];
          return `
            <div class="flex flex-col gap-3 mb-1">
              ${options.map(o => `
                <button onclick="${setterName}('${o.id}')" class="w-full px-4 py-4 rounded-2xl text-left text-sm font-medium" style="${selectedId === o.id ? `background:rgba(10,37,64,0.08);border:1.5px solid ${NAVY};color:${NAVY};` : 'background:#fff;border:1px solid #e5e7eb;color:#1f2937;'}">
                  ${o.label}
                  ${withDesc && o.desc ? `<div class="text-xs font-normal mt-0.5" style="color:${selectedId === o.id ? NAVY : '#9ca3af'};">${o.desc}</div>` : ''}
                </button>
              `).join('')}
            </div>
            ${err ? `<div class="field-error">${escapeHtml(err)}</div>` : ''}`;
        }
        function careerStartStepBodyHTML(){
          const stepId = careerStartStepIds[careerStartStepIndex];
          const d = careerStartDraft;
          if (stepId === 'interests') {
            return `
              <h2 class="text-xl font-bold text-gray-800 text-center leading-snug" style="margin-bottom:20px;">What are you looking for?</h2>
              <div class="flex flex-col gap-3 mb-1">
                ${careerInterestOptions.map(o => `
                  <button onclick="toggleCareerStartInterest('${o.id}')" class="w-full px-4 py-4 rounded-2xl text-left text-sm font-medium" style="${d.interests.includes(o.id) ? `background:rgba(10,37,64,0.08);border:1.5px solid ${NAVY};color:${NAVY};` : 'background:#fff;border:1px solid #e5e7eb;color:#1f2937;'}">${o.label}</button>
                `).join('')}
              </div>
              ${careerStartErrors.interests ? `<div class="field-error">${escapeHtml(careerStartErrors.interests)}</div>` : ''}
              <div class="text-xs text-gray-400 mt-3 text-center">Pick as many as apply -- we'll widen your matches across all of them.</div>`;
          }
          if (stepId === 'keyword') {
            return `
              <h2 class="text-xl font-bold text-gray-800 text-center leading-snug" style="margin-bottom:20px;">What role, subject, or keyword are you searching for?</h2>
              ${careerStartFieldHTML('Keyword', 'jobTitle', 'text', 'e.g. Project Manager, Nursing, Climate advocacy')}`;
          }
          if (stepId === 'experience') {
            return `
              <h2 class="text-xl font-bold text-gray-800 text-center leading-snug" style="margin-bottom:20px;">Which experience level fits you best?</h2>
              ${careerStartOptionListHTML(careerExperienceLevels, d.experienceLevel, 'setCareerStartExperience', 'experienceLevel', true)}`;
          }
          if (stepId === 'education') {
            return `
              <h2 class="text-xl font-bold text-gray-800 text-center leading-snug" style="margin-bottom:20px;">What's your highest level of education?</h2>
              ${careerStartOptionListHTML(careerEducationLevels, d.education, 'setCareerStartEducation', 'education', false)}`;
          }
          if (stepId === 'workStyle') {
            return `
              <h2 class="text-xl font-bold text-gray-800 text-center leading-snug" style="margin-bottom:20px;">How would you like to work or study?</h2>
              ${careerStartOptionListHTML(careerWorkStyles, d.workStyle, 'setCareerStartWorkStyle', 'workStyle', false)}
              <div class="text-xs text-gray-400 mt-3 flex items-start gap-2">${Icon('help','w-4 h-4 flex-shrink-0 mt-0.5')}<span>This shapes which opportunities we prioritize for you.</span></div>`;
          }
          if (stepId === 'contact') {
            return `
              <h2 class="text-xl font-bold text-gray-800 text-center leading-snug" style="margin-bottom:20px;">How can we reach you?</h2>
              ${careerContactMethodToggleHTML(d.contactMethod)}
              ${careerStartFieldHTML('Full name', 'fullName', 'text', 'Your full name')}
              ${careerStartFieldHTML(d.contactMethod === 'email' ? 'Email' : 'Email (optional)', 'email', 'email', 'you@example.com')}
              ${careerStartFieldHTML('Phone (optional)', 'phone', 'tel', '+233 24 123 4567')}
              <div class="text-xs text-gray-400 mt-1 flex items-start gap-2">${Icon('help','w-4 h-4 flex-shrink-0 mt-0.5')}<span>${d.contactMethod === 'email' ? "We'll email match updates to the address above." : "We'll send match updates as in-app notifications inside Stitch."}</span></div>`;
          }
          if (stepId === 'resume') {
            return `
              <h2 class="text-xl font-bold text-gray-800 mb-3 text-center leading-snug">Get 3x more matches with your resume</h2>
              <p class="text-sm text-gray-500 mb-7 text-center">We'll match your experience and skills to the best-fit opportunities.</p>
              ${careerStartResumePickerHTML()}
              <div class="text-xs text-gray-400 mt-2 flex items-start gap-2">${Icon('help','w-4 h-4 flex-shrink-0 mt-0.5')}<span>A resume increases your chances of getting a response -- but you can still submit without one.</span></div>`;
          }
          return '';
        }
        function careerStartNext(){
          const stepId = careerStartStepIds[careerStartStepIndex];
          const d = careerStartDraft;
          careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', fullName: '', email: '', phone: '', resume: '' };

          if (stepId === 'contact') {
            if (!d.fullName.trim()) careerStartErrors.fullName = 'Please add your full name.';
            else if (!isValidName(d.fullName.trim())) careerStartErrors.fullName = 'Enter a valid full name (letters, spaces, hyphens, and apostrophes only).';

            if (!d.email.trim()) { if (d.contactMethod === 'email') careerStartErrors.email = 'Please add your email.'; }
            else if (!isValidEmail(d.email.trim())) careerStartErrors.email = 'Enter a valid email address (e.g. you@example.com).';

            if (d.phone.trim() && !isValidPhone(d.phone.trim())) careerStartErrors.phone = 'Enter a valid phone number (7-15 digits, e.g. +233 24 123 4567).';
          }

          const hasErrors = Object.values(careerStartErrors).some(Boolean);
          if (hasErrors) { rerenderCareerStart(); return; }

          if (stepId === 'resume') { submitCareerStartForm(); return; }

          careerStartStepIndex = Math.min(careerStartStepIndex + 1, careerStartStepIds.length - 1);
          rerenderCareerStart();
        }
        function careerStartStep(delta){
          careerStartStepIndex = Math.max(0, Math.min(careerStartStepIndex + delta, careerStartStepIds.length - 1));
          careerStartErrors = { interests: '', jobTitle: '', experienceLevel: '', education: '', workStyle: '', fullName: '', email: '', phone: '', resume: '' };
          rerenderCareerStart();
        }
        async function submitCareerStartForm(){
          const d = careerStartDraft;
          const interestLabels = careerInterestOptions.filter(o => d.interests.includes(o.id)).map(o => o.label).join(', ');
          const levelLabel = (careerExperienceLevels.find(l => l.id === d.experienceLevel) || {}).label || d.experienceLevel;
          const educationLabel = (careerEducationLevels.find(l => l.id === d.education) || {}).label || d.education;
          const workStyleLabel = (careerWorkStyles.find(w => w.id === d.workStyle) || {}).label || d.workStyle;
          const submitBtn = document.getElementById('career-start-submit-btn');
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

          try {
            const fd = new FormData();
            fd.append('_subject', 'Stitch - Career Space: ' + d.fullName);
            fd.append('form', "Don't know where to start?");
            fd.append('fullName', d.fullName);
            fd.append('email', d.email);
            if (d.phone.trim()) fd.append('phone', d.phone.trim());
            fd.append('contactMethod', d.contactMethod === 'inApp' ? 'In-app notification' : 'Email');
            fd.append('interestedIn', interestLabels);
            fd.append('jobTitle', d.jobTitle);
            fd.append('experienceLevel', levelLabel);
            fd.append('education', educationLabel);
            fd.append('workStyle', workStyleLabel);
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
            resumeFileName: d.resumeFileName || existing.resumeFileName || '',
            resumeText: d.resumeText || existing.resumeText || '',
            resumeDataUrl: d.resumeDataUrl || existing.resumeDataUrl || '',
            matches: existing.matches || [],
            matchesUpdatedAt: existing.matchesUpdatedAt || null,
            priorityId: existing.priorityId || '',
            priorityReason: existing.priorityReason || '',
            updatedAt: Date.now(),
          };
          saveCareerStartProfile();

          if (careerStartProfile.resumeFileName) markCareerStartPillDismissed();
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
        function careerStartFormHTML(){
          const total = careerStartStepIds.length;
          const stepNum = careerStartStepIndex + 1;
          const stepId = careerStartStepIds[careerStartStepIndex];
          const isFirstStep = careerStartStepIndex === 0;
          const isLastStep = stepId === 'resume';
          const pct = Math.round((stepNum / total) * 100);
          const isOptionalEmpty = careerStartOptionalSteps.includes(stepId) && careerStartStepIsEmpty(stepId, careerStartDraft);
          const resumeBusy = isLastStep && careerStartResumeUploading;
          const mainBtnLabel = resumeBusy ? 'Matching…' : (isLastStep ? 'Submit' : (isOptionalEmpty ? 'Skip' : 'Continue'));
          const mainBtnOnclick = resumeBusy ? '' : (isOptionalEmpty ? 'careerStartStep(1)' : 'careerStartNext()');
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-3">
                <button onclick="careerStartBack()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-base font-display grad-text flex-1 text-center">Match with CV/Resume</div>
                <div class="text-xs font-bold flex-shrink-0" style="color:#6b7280;">${stepNum}/${total}</div>
              </div>
              <div class="w-full" style="height:3px;background:#f0f0f0;margin-top:10px;">
                <div style="height:3px;width:${pct}%;background:${NAVY};transition:width .25s ease;"></div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5" style="padding-top:30px;">
              <div class="flex flex-col justify-between" style="min-height:100%;">
                <div>
                  ${careerStartStepBodyHTML()}
                </div>
                <div class="flex-shrink-0 mt-8">
                  <button id="career-start-submit-btn" onclick="${mainBtnOnclick}" ${resumeBusy ? 'disabled' : ''} class="w-full font-semibold text-sm py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);${resumeBusy ? 'opacity:.6;cursor:default;' : ''}">${mainBtnLabel}</button>
                  <div class="flex items-center justify-between gap-3" style="margin-top:10px;margin-bottom:16px;">
                    <button onclick="careerStartStep(-1)" ${isFirstStep ? 'disabled' : ''} class="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-full flex-1 justify-center" style="background:#f3f4f6;color:${isFirstStep ? '#c1c5cc' : '#374151'};${isFirstStep ? 'cursor:default;' : ''}">${Icon('arrowLeft','w-4 h-4')}Previous</button>
                    <button onclick="careerStartStep(1)" ${isLastStep ? 'disabled' : ''} class="flex items-center gap-1.5 text-sm font-medium px-4 py-2.5 rounded-full flex-1 justify-center" style="background:#f3f4f6;color:${isLastStep ? '#c1c5cc' : '#374151'};${isLastStep ? 'cursor:default;' : ''}">Next${Icon('arrowRight','w-4 h-4')}</button>
                  </div>
                </div>
              </div>
            </div>`;
        }

        function openCareerMatchesPage(forceRecompute){
          careerMatchesError = '';
          openOverlay('careerMatches');
          if (!careerStartProfile) return;
          const hasCachedMatches = Array.isArray(careerStartProfile.matches) && careerStartProfile.matches.length;
          if (forceRecompute || !hasCachedMatches) refreshCareerMatches();
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
        function rerenderCareerMatches(){
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'careerMatches') ov.innerHTML = careerMatchesHTML();
        }
        async function refreshCareerMatches(){
          if (!careerStartProfile) return;
          careerMatchesLoading = true;
          careerMatchesError = '';
          rerenderCareerMatches();
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
            careerMatchesError = "We couldn't refresh your matches -- check your connection and try again.";
          } finally {
            careerMatchesLoading = false;
            rerenderCareerMatches();
          }
        }
        function handleCareerProfileResumeReplace(event){
          const file = event.target.files && event.target.files[0];
          event.target.value = '';
          if (!file || !careerStartProfile) return;
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
          openAppConfirmModal('Delete this resume?', "This removes it from your Career Profile. You can attach a new one any time.", 'Delete', function(){
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
          return { interestLabels, levelLabel, eduLabel, styleLabel };
        }
        function planHasCvRecommendations(){
          return true;
        }
        function planHasCvAI(){
          return true;
        }
        async function computeCareerMatches(profile){
          const jobs = allExploreCards();
          if (!jobs.length) return { matches: [], priority: null };
          if (!planHasCvRecommendations()) return computeCareerMatchesLocal(profile, jobs);
          try {
            const aiResult = await computeCareerMatchesAI(profile, jobs);
            if (aiResult.matches.length) return aiResult;
            return computeCareerMatchesLocal(profile, jobs);
          } catch (e) {
            console.warn('AI opportunity matching failed, falling back to local scoring:', e);
            return computeCareerMatchesLocal(profile, jobs);
          }
        }

        async function computeResumeAIFeedback(profile){
          if (!profile || !profile.resumeText || !profile.resumeText.trim()) return '';
          const system = 'You are a warm, encouraging resume reviewer inside a student career app. ' +
            'You will be given a resume/CV\'s extracted text and the candidate\'s stated interests. ' +
            'Write 2-4 short sentences of direct, practical feedback on the resume itself: what reads ' +
            'strongly, and one or two concrete things to improve (missing metrics, unclear phrasing, ' +
            'formatting, etc). Do NOT recommend, name, or reference any specific job, internship, ' +
            'scholarship, or other posted opportunity -- you are not matching them to anything, only ' +
            'reviewing the resume itself. Plain text only, no markdown, no headings, speak directly to the candidate ("Your...").';
          const { interestLabels } = careerProfileFiltersSummary(profile);
          const user = `Interested in: ${interestLabels.join(', ') || 'not specified'}\n\nResume/CV text:\n"""${(profile.resumeText || '').slice(0, 8000)}"""`;
          try {
            const raw = await callClaude(system, user, 'materials');
            return String(raw || '').trim();
          } catch (e) {
            console.warn('Resume AI feedback failed:', e);
            return '';
          }
        }
        async function computeCareerMatchesAI(profile, jobs){
          const { interestLabels, levelLabel, eduLabel, styleLabel } = careerProfileFiltersSummary(profile);
          const listing = jobs.slice(0, 60).map(j => ({
            id: j.id,
            type: j.type,
            title: j.title,
            org: j.org || j.sub || '',
            mode: j.mode || '',
            description: (j.description || '').slice(0, 500),
          }));
          const system = 'You are the opportunity-matching engine for a student career app called Career Space. ' +
            'You are given a candidate profile (their stated interests/filters and, when available, their resume/CV ' +
            'text) and a list of every currently posted opportunity, internship, course, and scholarship. Screen the ' +
            'candidate against every listing in the list and rank the ones that are a genuine fit -- treat the ' +
            'candidate\'s selected filters (category interest, desired role/keyword, experience level, education ' +
            'level, preferred work style) as strong preferences, and their resume/CV text as the deepest signal of ' +
            'actual skills/experience when present. Never invent a listing that is not in the provided list, and ' +
            'never fabricate an id. Return between 0 and 8 matches, best first -- fewer (or none) is correct if ' +
            'nothing in the list is genuinely a reasonable fit. On top of ranking every match, also pick exactly ' +
            'ONE of those same matches as the single opportunity the candidate should prioritize/act on first ' +
            '(usually, but not always, the highest-scored one -- e.g. prefer one with a sooner deadline if the ' +
            'fit is close) and explain why in one encouraging sentence. Respond with ONLY raw JSON (no markdown ' +
            'fences, no commentary) matching exactly this schema: {"matches":[{"id":"string","score":0,' +
            '"reason":"string"}],"priority":{"id":"string","reason":"string"}}. "score" is 0-100 (fit confidence). ' +
            'Both "reason" fields are a single short sentence (under 20 words) in plain, encouraging language ' +
            'directed at the candidate ("You..."/"Your..."), never a generic restatement of the listing title. ' +
            '"priority" must be omitted (or null) if "matches" is empty, and its "id" must be one of the ids ' +
            'already present in "matches".';
          const user = 'Candidate filters:\n' +
            `Interested in: ${interestLabels.join(', ') || 'no preference given'}\n` +
            `Role/keyword: ${profile.jobTitle || 'none given'}\n` +
            `Experience level: ${levelLabel || 'not given'}\n` +
            `Education: ${eduLabel || 'not given'}\n` +
            `Preferred work style: ${styleLabel || 'no preference'}\n\n` +
            'Resume/CV text (may be empty if none attached):\n"""' + (profile.resumeText || '').slice(0, 8000) + '"""\n\n' +
            'Posted opportunities (JSON):\n' + JSON.stringify(listing);
          const raw = await callClaude(system, user, 'materials');
          const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(cleaned);
          const byId = new Map(jobs.map(j => [String(j.id), j]));
          const matches = (parsed.matches || [])
            .map(m => ({ job: byId.get(String(m.id)), score: Math.max(0, Math.min(100, Number(m.score) || 0)), reason: String(m.reason || '').trim() }))
            .filter(m => m.job)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
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
        function computeCareerMatchesLocal(profile, jobs){
          const { styleLabel } = careerProfileFiltersSummary(profile);
          const resumeTokens = careerTokenize([profile.resumeText, profile.jobTitle].filter(Boolean).join(' ')).filter(t => !CAREER_STOPWORDS.has(t));
          const resumeSet = new Set(resumeTokens);
          const wantsTypes = new Set();
          if ((profile.interests || []).includes('jobs')) wantsTypes.add('Job');
          if ((profile.interests || []).includes('internships')) wantsTypes.add('Internship');
          if ((profile.interests || []).includes('scholarships')) wantsTypes.add('Scholarship');
          if ((profile.interests || []).includes('volunteering')) wantsTypes.add('Other');
          if ((profile.interests || []).includes('courses')) wantsTypes.add('Course');

          let scored = jobs.map(job => {
            const jobTokens = careerTokenize([job.title, job.org, job.sub, job.description].filter(Boolean).join(' '));
            let overlap = 0;
            jobTokens.forEach(t => { if (resumeSet.has(t)) overlap++; });
            let score = Math.min(70, overlap * 6);
            if (profile.jobTitle && profile.jobTitle.trim() && (job.title || '').toLowerCase().includes(profile.jobTitle.trim().toLowerCase())) score += 20;
            if (wantsTypes.size && wantsTypes.has(job.type)) score += 15;
            if (styleLabel && job.mode && job.mode.toLowerCase() === styleLabel.toLowerCase()) score += 10;
            if (styleLabel === 'No preference') score += 3;
            return { job, score: Math.max(0, Math.min(100, score)) };
          }).filter(m => m.score > 0);

          if (!scored.length) {
            scored = jobs.slice(0, 5).map(job => ({ job, score: 0 }));
            return { matches: scored.map(m => ({ job: m.job, score: m.score, reason: 'Recently posted on Career Space.' })), priority: null };
          }
          const matches = scored
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
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
            <div class="flex items-start gap-2 -mt-2.5 mb-4 px-1">
              <div class="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Math.round(m.score)}% match</div>
              ${isPriority ? `<div class="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style="background:#fff7e6;color:#b45309;">${Icon('star','w-3 h-3')}Prioritize this</div>` : ''}
              <div class="text-xs text-gray-500 flex-1 pt-0.5">${escapeHtml(m.reason || '')}</div>
            </div>`;
        }
        function careerPriorityCalloutHTML(p){
          if (!p || !p.job) return '';
          return `
            <div onclick="${p.job.isCatalogCourse ? `openCourseDetail('${p.job.id}')` : `openJobOrClassroom('${p.job.id}')`}" class="rounded-3xl p-4 mb-5 cursor-pointer" style="background:linear-gradient(135deg, rgba(10,37,64,0.06), rgba(30,144,255,0.10));border:1.5px solid rgba(10,37,64,0.14);">
              <div class="flex items-center gap-2 mb-1.5">
                <span style="color:#b45309;">${Icon('star','w-4 h-4')}</span>
                <div class="text-xs font-bold uppercase tracking-wide" style="color:${NAVY};">AI recommends prioritizing this</div>
              </div>
              <div class="text-sm font-semibold text-gray-800 mb-1">${escapeHtml(p.job.title)}</div>
              <div class="text-xs text-gray-600">${escapeHtml(p.reason || '')}</div>
            </div>`;
        }
        function careerMatchesHTML(){
          const p = careerStartProfile;
          if (!p) {
            return `
              ${overlayHeader('Career Profile', '20px', 'closeOverlay()')}
              <div class="flex-1 overflow-y-auto px-5 pb-6">
                <div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No Career Profile yet -- fill out the quick quiz to get matched with opportunities.</div>
                <button onclick="startCareerStartQuiz('careerMatches')" class="w-full font-semibold text-sm py-3 rounded-full text-white mt-4" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Get Started</button>
              </div>`;
          }
          const { interestLabels, levelLabel, eduLabel, styleLabel } = careerProfileFiltersSummary(p);
          const filterChips = [
            ...interestLabels,
            p.jobTitle ? `"${p.jobTitle}"` : '',
            levelLabel, eduLabel, styleLabel,
          ].filter(Boolean);
          const matches = (p.matches || [])
            .map(m => ({ job: findExploreCard(m.id), score: m.score, reason: m.reason }))
            .filter(m => m.job);
          const priorityJob = p.priorityId ? findExploreCard(p.priorityId) : null;
          return `
            ${overlayHeader('Career Profile', '20px', 'closeOverlay()')}
            <div class="flex-1 overflow-y-auto px-5 pb-6">
              <div class="bg-white rounded-3xl p-4 mb-4 shadow-sm">
                <div class="flex items-center gap-3">
                  <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon(p.resumeFileName ? 'doc' : 'paperclip','w-5 h-5')}</div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-gray-800 truncate">${p.resumeFileName ? escapeHtml(p.resumeFileName) : 'No resume attached'}</div>
                    <div class="text-xs text-gray-400">${escapeHtml(p.fullName || '')}${p.fullName && p.email ? ' · ' : ''}${escapeHtml(p.email || '')}</div>
                  </div>
                  ${p.resumeFileName ? `<button onclick="deleteCareerProfileResume()" title="Delete resume" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:#fef2f2;color:#dc2626;">${Icon('trash','w-4 h-4')}</button>` : ''}
                </div>
                <div class="flex items-center gap-2" style="margin-top:5px;">
                  ${p.resumeDataUrl ? `<a href="${p.resumeDataUrl}" download="${escapeHtml(p.resumeFileName || 'resume')}" target="_blank" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:rgba(10,37,64,0.08);color:${NAVY};">View / Download</a>` : ''}
                  <input type="file" id="career-profile-resume-input" accept=".pdf,.doc,.docx" class="hidden" onchange="handleCareerProfileResumeReplace(event)">
                  <button onclick="document.getElementById('career-profile-resume-input').click()" class="flex-1 text-center text-sm font-semibold py-2.5 rounded-2xl" style="background:#f3f4f6;color:#374151;">${p.resumeFileName ? 'Replace resume' : 'Attach resume'}</button>
                </div>
              </div>
              <div class="bg-white rounded-3xl p-4 mb-5 shadow-sm">
                <div class="flex items-center justify-between mb-2.5">
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400">What you're looking for</div>
                  <button onclick="startCareerStartQuiz('careerMatches')" class="text-xs font-semibold" style="color:${NAVY};">Edit</button>
                </div>
                ${filterChips.length
                  ? `<div class="career-filter-grid" style="grid-template-columns:repeat(${filterChips.length <= 6 ? 2 : 3}, 1fr);">${filterChips.map(label => careerMatchFilterChip(label)).join('')}</div>`
                  : '<span class="text-xs text-gray-400">No filters set yet.</span>'}
              </div>
              ${p.resumeAIFeedback ? `
              <div class="bg-white rounded-3xl p-4 mb-4 shadow-sm">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Stitch's take on your resume</div>
                <div class="text-sm text-gray-700 leading-relaxed">${escapeHtml(p.resumeAIFeedback)}</div>
              </div>` : ''}
              <div class="flex items-center justify-between mb-3">
                <div class="font-semibold text-base font-display grad-text">Matched opportunities</div>
                <button onclick="refreshCareerMatches()" ${careerMatchesLoading ? 'disabled' : ''} class="text-xs font-semibold flex items-center gap-1" style="color:${careerMatchesLoading ? '#c1c5cc' : NAVY};">${Icon('shuffle','w-3.5 h-3.5')}Refresh</button>
              </div>
              ${careerMatchesLoading
                ? `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
                    <div style="width:28px;height:28px;border-radius:9999px;border:3px solid rgba(10,37,64,0.12);border-top-color:${NAVY};animation:classroom-spin 0.9s linear infinite;"></div>
                    Screening posted opportunities against your profile…
                  </div>`
                : careerMatchesError
                  ? `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">${escapeHtml(careerMatchesError)}<button onclick="refreshCareerMatches()" class="block mx-auto mt-3 text-sm font-semibold" style="color:${NAVY};">Try again</button></div>`
                  : matches.length
                    ? (priorityJob && planHasCvRecommendations() ? careerPriorityCalloutHTML({ job: priorityJob, reason: p.priorityReason }) : '') +
                      matches.map(m => jobCard(m.job) + careerMatchReasonHTML(m, priorityJob && m.job.id === priorityJob.id)).join('')
                    : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No strong matches yet -- check back once more opportunities are posted, or widen your filters.</div>`
              }
            </div>`;
        }

        // ---- Application submission + Paystack payment ----
        function submitJobApplication(){
          if (!requireCompleteProfile()) return;
          const job = findJob(activeApplyJobId);
          if (!job) return;
          const d = jobApplyDraft;

          jobApplyErrors = { fullName:'', email:'', phone:'' };
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
          if (d.phone && d.phone.trim() && !isValidPhone(d.phone.trim())) {
            jobApplyErrors.phone = 'Enter a valid phone number (7-15 digits, e.g. +233 24 123 4567).';
          }

          if (jobApplyErrors.fullName || jobApplyErrors.email || jobApplyErrors.phone) {
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = jobApplyHTML();
            return;
          }

          if (job.type === 'Course' && job.priceType === 'paid') {
            startPaystackPayment(job);
            return;
          }

          completeJobApplication(job);
        }

        function completeJobApplication(job){
          finalizeJobApplication(job.id);
          resetJobApplyDraft();
          if (job.type === 'Course') {
            goToJobCourse(job.id);
          } else {
            openJobDetail(job.id);
          }
        }

        const PAYSTACK_PUBLIC_KEY = 'pk_live_f1ac7bbd6ae40d2ee67545b02e89ad4cd66e9c5c';
        let jobApplyPaymentBusy = false;
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
          if (!subunit || subunit <= 0) {
            openAppAlertModal("This course's enrollment fee isn't set up correctly. Please contact the organizer.", 'Payment unavailable');
            return;
          }

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
            ${overlayHeader(isCourse ? 'Enroll' : 'Apply', '20px')}
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
              <div class="rounded-3xl p-4 mb-5 flex items-center gap-3" style="background:rgba(10,37,64,0.05);">
                <div class="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${job.coverImage ? `<img src="${job.coverImage}" class="w-full h-full object-cover" alt="">` : Icon(job.icon,'w-5 h-5')}</div>
                <div class="min-w-0">
                  <div class="font-semibold text-sm truncate">${escapeHtml(job.title)}</div>
                  <div class="text-xs text-gray-500 truncate">${job.org || ''}</div>
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
              ${jobApplyFieldRow('Phone (optional)', 'phone', 'e.g. 024 123 4567', 'tel')}

              ${isCourse ? '' : `
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 mt-2">Cover letter attachment</div>
                ${jobApplyFilePicker('Application / cover letter (optional file)', 'letterFileName', 'job-apply-letter-input', '.pdf,.doc,.docx')}

                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Or write your application letter</label>
                  <textarea oninput="updateJobApplyField('letterText', this.value)" placeholder="Tell them why you're a great fit..." rows="6" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;resize:none;">${jobApplyDraft.letterText}</textarea>
                </div>
              `}

              <div class="text-center mt-2" style="padding-bottom:10px;">
                <button onclick="submitJobApplication()" ${jobApplyPaymentBusy ? 'disabled' : ''} class="pill-cta inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.5rem 1.1rem;${jobApplyPaymentBusy ? 'opacity:0.6;' : ''}">${jobApplyPaymentBusy ? 'Processing payment...' : (isCourse ? (job.priceType === 'paid' ? 'Continue to Payment' : 'Enroll for Free') : 'Submit Application')}</button>
              </div>
            </div>`;
        }

        const oppTypes = ['Job','Internship','Part-time','Scholarship','Course','Other'];
        const oppModes = ['Online','On-site'];
        let newOppDraft = { title:'', org:'', type:'Job', mode:'On-site', location:'', duration:'', deadline:'', deadlineDate:'', description:'', applyMethod:'email', email:'', website:'', priceType:'free', price:'', coverImage:'' };
        let newOppEditingId = null;

        function resetNewOppDraft(){
          newOppDraft = { title:'', org:'', type:'Job', mode:'On-site', location:'', duration:'', deadline:'', deadlineDate:'', description:'', applyMethod:'email', email:'', website:'', priceType:'free', price:'', coverImage:'' };
        }

        function handleOppCoverSelect(event){
          const file = event.target.files && event.target.files[0];
          event.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev){
            newOppDraft.coverImage = ev.target.result;
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = postOpportunityHTML();
          };
          reader.readAsDataURL(file);
        }

        function clearOppCover(){
          newOppDraft.coverImage = '';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = postOpportunityHTML();
        }

        function openPostOpportunity(){
          if (!isCurrentUserAdmin()) return;
          resetNewOppDraft();
          newOppEditingId = null;
          openOverlay('postOpportunity');
        }

        function openEditOpportunity(id){
          if (!isCurrentUserAdmin()) return;
          const job = findJob(id);
          if (!job) return;
          jobDetailMenuOpen = false;
          newOppDraft = {
            title: job.title || '',
            org: job.org || '',
            type: job.type || 'Job',
            mode: job.mode || 'On-site',
            location: job.location || '',
            duration: job.duration || '',
            deadline: (job.type === 'Course' ? (job.deadline === 'Self-paced' ? '' : (job.deadline || '')) : (job.deadline || '').replace(/^Deadline /, '')),
            deadlineDate: job.deadlineDate || '',
            description: job.description || '',
            applyMethod: job.applyMethod || (job.website ? 'website' : 'email'),
            email: job.email || '',
            website: job.website || '',
            priceType: job.priceType || 'free',
            price: (job.priceType === 'paid' ? (job.price || '') : ''),
            coverImage: job.coverImage || '',
          };
          newOppEditingId = id;
          openOverlay('postOpportunity');
        }

        function setNewOppPriceType(priceType){
          newOppDraft.priceType = priceType;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = postOpportunityHTML();
        }

        function setNewOppApplyMethod(method){
          newOppDraft.applyMethod = method;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = postOpportunityHTML();
        }

        function updateNewOppField(field, value){
          newOppDraft[field] = value;
        }

        function setNewOppType(type){
          newOppDraft.type = type;
          if (type === 'Course') newOppDraft.mode = 'Online';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = postOpportunityHTML();
        }

        function setNewOppMode(mode){
          newOppDraft.mode = mode;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = postOpportunityHTML();
        }

        // Guards against duplicate listings caused by mashing "Post
        // Opportunity" multiple times before the first tap finishes (e.g.
        // while waiting on the network sync). The flag is set synchronously
        // the instant the function starts, before any awaited work, and the
        // button itself is disabled/relabeled for the same reason -- either
        // guard alone would close the race, but the two together are
        // reliable even if a tap lands mid-render.
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
            if (!isCurrentUserAdmin()) { openAppAlertModal('Only admins can post an opportunity.'); return; }
            if (!requireCompleteProfile()) return;
            const d = newOppDraft;
            const isCourse = d.type === 'Course';
            const applyMethod = isCourse ? 'email' : (d.applyMethod || 'email');
            const applyViaWebsite = !isCourse && applyMethod === 'website';
            if (!d.title.trim() || !d.description.trim()) {
              openAppAlertModal('Please add at least a title and a description.');
              return;
            }
            if (!isCourse) {
              if (applyViaWebsite && !d.website.trim()) {
                openAppAlertModal('Please add the website link where applicants should apply.');
                return;
              }
              if (!applyViaWebsite && !d.email.trim()) {
                openAppAlertModal('Please add an email to receive applications.');
                return;
              }
              if (!d.deadlineDate) {
                openAppAlertModal('Please choose a deadline date for this listing.');
                return;
              }
            }
            if (applyViaWebsite && d.website.trim() && !isValidUrl(d.website.trim())) {
              openAppAlertModal('Please enter a valid website link (e.g. careers.yourorg.com/apply).');
              return;
            }
            if (d.email.trim() && !isValidEmail(d.email.trim())) {
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
              ? [d.org, d.duration].filter(Boolean).join(' · ')
              : [d.org, d.mode === 'Online' ? (d.location || 'Online') : (d.location || 'On-site'), d.duration].filter(Boolean).join(' · ');
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
              duration: d.duration.trim(),
              applyMethod: applyMethod,
              email: applyViaWebsite ? '' : d.email.trim(),
              website: applyViaWebsite ? d.website.trim() : '',
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
              <input type="${type || 'text'}" value="${newOppDraft[field]}" oninput="updateNewOppField('${field}', this.value)" placeholder="${placeholder || ''}" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
            </div>`;
        }

        function postOpportunityHTML(){
          const isEditing = !!newOppEditingId;
          return `
            ${overlayHeader(isEditing ? (newOppDraft.type === 'Course' ? 'Edit Course' : 'Edit Opportunity') : 'Post an Opportunity', '20px')}
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
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
                <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1" style="scroll-snap-type:x proximity;">
                  ${oppTypes.map(t => `
                    <button onclick="setNewOppType('${t}')" class="flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold ${newOppDraft.type===t ? '' : 'bg-gray-100 text-gray-500'}" style="scroll-snap-align:start;${newOppDraft.type===t ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${t}</button>
                  `).join('')}
                </div>
              </div>

              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Where</label>
                <div class="flex gap-2">
                  ${oppModes.map(m => `
                    <button onclick="setNewOppMode('${m}')" class="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold ${newOppDraft.mode===m ? '' : 'bg-gray-100 text-gray-500'}" style="${newOppDraft.mode===m ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${Icon(m==='Online'?'link':'pin','w-4 h-4')} ${m}</button>
                  `).join('')}
                </div>
              </div>

              ${newOppDraft.type === 'Course' ? '' : oppFieldRow(newOppDraft.mode === 'Online' ? 'Platform / link' : 'Location', 'location', newOppDraft.mode === 'Online' ? 'e.g. Zoom, remote' : 'e.g. Accra, Ghana')}
              ${oppFieldRow('Duration', 'duration', newOppDraft.type === 'Course' ? 'e.g. 4 weeks' : 'e.g. 3 months, Full-time, One-time')}
              ${newOppDraft.type === 'Course'
                ? oppFieldRow('Start date (optional)', 'deadline', 'e.g. Self-paced, or Starts Aug 10')
                : `
                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Deadline</label>
                  <input type="date" value="${newOppDraft.deadlineDate}" min="${todayISODate()}" oninput="updateNewOppField('deadlineDate', this.value)" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
                  <div class="text-xs text-gray-400 mt-1">This listing disappears automatically once this date passes, so every admin's posts stay consistent.</div>
                </div>`}

              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Description &amp; requirements</label>
                <textarea oninput="updateNewOppField('description', this.value)" placeholder="${newOppDraft.type === 'Course' ? 'What will learners cover? Any prerequisites?' : 'What will they be doing? What do you need from applicants?'}" rows="5" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none">${escapeHtml(newOppDraft.description)}</textarea>
              </div>

              ${newOppDraft.type === 'Course' ? `
                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Enrollment</label>
                  <div class="text-xs text-gray-400 mb-2">Learners join a course by enrolling, not by applying; no application letter needed. Set whether enrollment is free or has a fee.</div>
                  <div class="flex gap-2 mb-3">
                    <button onclick="setNewOppPriceType('free')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold ${newOppDraft.priceType==='free' ? '' : 'bg-gray-100 text-gray-500'}" style="${newOppDraft.priceType==='free' ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">Free</button>
                    <button onclick="setNewOppPriceType('paid')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold ${newOppDraft.priceType==='paid' ? '' : 'bg-gray-100 text-gray-500'}" style="${newOppDraft.priceType==='paid' ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">Paid</button>
                  </div>
                  ${newOppDraft.priceType === 'paid' ? oppFieldRow('Enrollment fee', 'price', 'e.g. GHS 150, or $20') : ''}
                </div>
                ${oppFieldRow('Email for enrollment questions (optional)', 'email', 'e.g. courses@yourorg.com', 'email')}
              ` : `
                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Apply via</label>
                  <div class="flex gap-2 mb-3">
                    <button onclick="setNewOppApplyMethod('email')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold ${newOppDraft.applyMethod!=='website' ? '' : 'bg-gray-100 text-gray-500'}" style="${newOppDraft.applyMethod!=='website' ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">Email</button>
                    <button onclick="setNewOppApplyMethod('website')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold ${newOppDraft.applyMethod==='website' ? '' : 'bg-gray-100 text-gray-500'}" style="${newOppDraft.applyMethod==='website' ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">Website</button>
                  </div>
                  ${newOppDraft.applyMethod === 'website'
                    ? oppFieldRow('Website to receive applications', 'website', 'e.g. careers.yourorg.com/apply', 'url')
                    : oppFieldRow('Email to receive applications', 'email', 'e.g. careers@yourorg.com', 'email')}
                </div>
              `}

              <div class="text-center mt-2" style="padding-bottom:10px;">
                <button id="opp-submit-btn" onclick="submitNewOpportunity()" class="pill-cta inline-flex items-center justify-center text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.5rem 1.1rem;">${isEditing ? 'Save Changes' : (newOppDraft.type === 'Course' ? 'Post Course' : 'Post Opportunity')}</button>
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
            ${overlayHeader('Career Analytics', '20px')}
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50 p-5 space-y-4">
              <div class="rounded-3xl p-5 text-white" style="background:linear-gradient(135deg,${ROYAL},${NAVY});">
                <div class="text-xs text-blue-200 font-semibold uppercase tracking-wide">Applications sent</div>
                <div class="text-3xl font-bold font-display">${appliedJobs.length}</div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${savedCount}</div>
                  <div class="text-xs text-gray-500 mt-1">Saved opportunities</div>
                </div>
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${postedCount}</div>
                  <div class="text-xs text-gray-500 mt-1">Opportunities posted</div>
                </div>
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${internshipsApplied}</div>
                  <div class="text-xs text-gray-500 mt-1">Internships applied</div>
                </div>
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${coursesEnrolled}</div>
                  <div class="text-xs text-gray-500 mt-1">Courses enrolled</div>
                </div>
              </div>
              <div class="bg-white rounded-3xl p-5 shadow-sm">
                <div class="font-semibold text-sm text-gray-800 mb-3">Employer replies</div>
                ${trackedApplications.length ? `
                  <div class="space-y-2.5 mb-1">
                    ${JOB_STATUS_ORDER.map(k => {
                      const count = trackedApplications.filter(j => ((jobApplication(j) || {}).status || 'applied') === k).length;
                      const m = JOB_STATUS_META[k];
                      const pct = Math.round((count / trackedApplications.length) * 100);
                      return `
                        <div>
                          <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-medium text-gray-600">${escapeHtml(m.label)}</span>
                            <span class="text-gray-400">${count}</span>
                          </div>
                          <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div class="h-full rounded-full" style="width:${pct}%;background:${m.color};"></div>
                          </div>
                        </div>`;
                    }).join('')}
                  </div>
                  <div class="text-xs text-gray-400 mt-3">Stitch can't read employer inboxes; open an application and update its status yourself as you hear back.</div>
                ` : `<div class="text-xs text-gray-400">Apply to an opportunity, then log replies from its detail page to see a breakdown here.</div>`}
              </div>
            </div>`;
        }

        function profileAnalyticsHTML(){
          const glimpseViews = myGlimpses.reduce((sum, g) => sum + (g.viewers ? g.viewers.length : 0), 0);
          const myPosts = feedPosts.filter(p => p.mine);
          const likesReceived = myPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
          const commentsReceived = myPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
          const repostsReceived = myPosts.reduce((sum, p) => sum + (p.reposts || 0), 0);
          const sharesReceived = myPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
          const engagementTotal = likesReceived + commentsReceived + repostsReceived + sharesReceived;

          const postScore = p => (p.likes||0) + (p.comments||0) + (p.reposts||0) + (p.shares||0);
          const topPosts = [...myPosts].sort((a,b) => postScore(b) - postScore(a)).slice(0,3);

          const recentActivity = myPosts
            .flatMap(p => (p.commentsList||[]).map(c => ({ ...c, post: p })))
            .slice(-6).reverse();

          const engagementRows = [
            ['Likes', likesReceived, '#ef4444'],
            ['Comments', commentsReceived, '#3b82f6'],
            ['Reposts', repostsReceived, '#10b981'],
            ['Shares', sharesReceived, '#f59e0b'],
          ];

          return `
            ${overlayHeader('Profile Insights', '20px')}
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50 p-5 space-y-4">
              <div class="rounded-3xl p-5 text-white" style="background:linear-gradient(135deg,${ROYAL},${NAVY});">
                <div class="text-xs text-blue-200 font-semibold uppercase tracking-wide">Glimpse views</div>
                <div class="text-3xl font-bold font-display">${glimpseViews}</div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${networkConnectionCount()}</div>
                  <div class="text-xs text-gray-500 mt-1">My Network</div>
                </div>
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${myPostsCount()}</div>
                  <div class="text-xs text-gray-500 mt-1">Posts</div>
                </div>
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${myGlimpses.length}</div>
                  <div class="text-xs text-gray-500 mt-1">Glimpses posted</div>
                </div>
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${likesReceived}</div>
                  <div class="text-xs text-gray-500 mt-1">Likes received</div>
                </div>
              </div>

              <div class="bg-white rounded-3xl p-4 shadow-sm">
                <div class="font-semibold text-sm text-gray-800 mb-1">Top posts</div>
                ${topPosts.length ? `
                  <div class="divide-y divide-gray-50">
                    ${topPosts.map(p => `
                      <button onclick="openPostDetail(${p.id})" class="w-full flex items-center gap-3 py-3 text-left">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm text-gray-700 truncate">${escapeHtml(p.body || 'Photo/video post')}</div>
                          <div class="text-xs text-gray-400 mt-0.5">${p.likes||0} likes · ${p.comments||0} comments · ${p.reposts||0} reposts</div>
                        </div>
                        ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
                      </button>`).join('')}
                  </div>
                ` : `<div class="text-xs text-gray-400">Once you post, your best-performing posts will show up here.</div>`}
              </div>

              <div class="bg-white rounded-3xl p-4 shadow-sm">
                <div class="font-semibold text-sm text-gray-800 mb-3">Audience activity</div>
                ${engagementTotal ? `
                  <div class="space-y-2.5">
                    ${engagementRows.map(([label,count,color]) => {
                      const pct = Math.round((count / engagementTotal) * 100);
                      return `
                        <div>
                          <div class="flex items-center justify-between text-xs mb-1">
                            <span class="font-medium text-gray-600">${label}</span>
                            <span class="text-gray-400">${count}</span>
                          </div>
                          <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div class="h-full rounded-full" style="width:${pct}%;background:${color};"></div>
                          </div>
                        </div>`;
                    }).join('')}
                  </div>
                ` : `<div class="text-xs text-gray-400">Engagement on your posts will be broken down here once people start interacting.</div>`}
              </div>

              ${recentActivity.length ? `
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="font-semibold text-sm text-gray-800 mb-1">Recent comments</div>
                  <div class="divide-y divide-gray-50">
                    ${recentActivity.map(c => `
                      <button onclick="openPostDetail(${c.post.id})" class="w-full flex items-start gap-2.5 py-3 text-left">
                        <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon('user','w-4 h-4')}</div>
                        <div class="min-w-0">
                          <div class="text-xs text-gray-700"><span class="font-semibold">${escapeHtml(c.name)}</span> commented: "${escapeHtml(c.text)}"</div>
                          <div class="text-[10px] text-gray-400 mt-0.5 truncate">on "${escapeHtml((c.post.body||'').slice(0,40))}${(c.post.body||'').length>40?'…':''}"</div>
                        </div>
                      </button>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>`;
        }
