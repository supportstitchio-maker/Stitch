        // ---------------- JOB MARKET ----------------
        const jobsTabs = [['opportunities','Opportunities'],['internships','Internships'],['courses','Courses'],['applied','Applied'],['saved','Saved']];
        let careerSearchActive = false;
        let careerSearchQuery = '';

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

        function renderJobMarket(){
          // Same fix as the Inbox: keep whatever scroll position the user
          // was at instead of snapping back to the top every time an
          // action (saving a job, switching a sub-tab, etc.) re-renders.
          const prevCareerScreenEl = document.getElementById('screen');
          const prevCareerScrollTop = prevCareerScreenEl ? prevCareerScreenEl.scrollTop : 0;
          document.getElementById('screen').innerHTML = `
            <div id="career-titlebar" class="sticky top-0 z-20 px-5 pb-3 border-b border-gray-100" style="padding-top:20px;background:#f9fafb;">
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
              <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                ${jobsTabs.map(([key,label]) => `
                  <button onclick="jobsSubTab('${key}')" class="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${jobsSub===key ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${jobsSub===key ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${label}</button>
                `).join('')}
              </div>
            </div>
            <div class="p-5" id="jobs-content">${jobsContent()}</div>`;
          stickBarsStack(['career-titlebar','career-searchbar','career-filterbar']);
          if (prevCareerScrollTop) {
            const restoredScreenEl = document.getElementById('screen');
            if (restoredScreenEl) {
              restoredScreenEl.scrollTop = prevCareerScrollTop;
            }
          }
        }


        // The dropdown is opened/closed by directly inserting/removing DOM
        // nodes rather than re-rendering the whole career screen; a full
        // re-render restarts the header's slide/fade transition on the
        // dashes and analytics icons, which looked like a "shake" every
        // time the menu was opened or closed.
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
          // The dropdown has left/right padding (menu-dropdown-inset, for
          // the pill highlight to sit inset from the edges) that has to be
          // added back on top of the buttons' own natural width, or the
          // buttons end up wider than the box and spill out past its edge.
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
              ${isCurrentUserAdmin() ? `<button onclick="closeCareerMenuThen(() => openOverlay('postOpportunity'))" class="text-left px-3 py-2 text-sm whitespace-nowrap text-gray-700 menu-item-pill">Post an Opportunity</button>` : ''}
            </div>`;
        }

        function closeCareerMenuThen(fn){
          closeCareerMenuDropdownDom();
          fn();
        }

        // ---- Admin role gate for "Post an Opportunity" ----
        // Real access control has to live server-side -- anything checked
        // only in this file can be bypassed by editing the page's JS in
        // devtools, so ADMIN_EMAILS below is just a fast way to test the
        // admin view before you've set up a database. The check that
        // actually matters is the `profiles` table lookup further down,
        // combined with a Postgres row-level-security policy that only
        // lets admins insert into `opportunities` (see OPPORTUNITIES_TABLE
        // below, and postOpportunityInsertRemote). Set this up in Supabase:
        //
        //   create table profiles (
        //     user_id uuid primary key references auth.users(id),
        //     role text not null default 'user'
        //   );
        //   -- give yourself admin access:
        //   -- insert into profiles (user_id, role) values ('<your-auth-uid>', 'admin');
        //
        //   alter table profiles enable row level security;
        //   create policy "Users can read their own profile"
        //     on profiles for select using (auth.uid() = user_id);
        //
        //   create table opportunities (
        //     id text primary key,
        //     data jsonb not null,
        //     created_by uuid references auth.users(id),
        //     created_at timestamptz default now()
        //   );
        //   alter table opportunities enable row level security;
        //   create policy "Anyone signed in can read opportunities"
        //     on opportunities for select using (auth.role() = 'authenticated');
        //   create policy "Only admins can insert opportunities"
        //     on opportunities for insert
        //     with check (
        //       exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
        //     );
        const ADMIN_EMAILS = ['0festusnkrumah@gmail.com']; // e.g. ['you@example.com'] -- quick local testing only
        const PROFILES_TABLE = 'profiles';
        const OPPORTUNITIES_TABLE = 'opportunities';
        let currentUserRole = 'user';
        let currentUserEmail = null;

        async function loadCurrentUserRole(){
          currentUserRole = 'user';
          currentUserEmail = null;
          const sb = getSupabaseClient();
          if (!sb) return; // no backend configured yet -- stays non-admin
          try {
            const { data } = await sb.auth.getUser();
            const user = data && data.user;
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
          } catch (e) { /* leave as 'user' */ }
        }

        function isCurrentUserAdmin(){
          return currentUserRole === 'admin';
        }

        // Best-effort remote insert so a posted opportunity is actually
        // shared with other users instead of only living in this browser
        // tab. If there's no backend configured, or the insert is rejected
        // (e.g. RLS policy blocks a non-admin), this just returns false and
        // the caller falls back to the local-only jobsData array.
        async function postOpportunityInsertRemote(job){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data } = await sb.auth.getUser();
            const user = data && data.user;
            const { error } = await sb.from(OPPORTUNITIES_TABLE).insert({
              id: job.id,
              data: job,
              created_by: user ? user.id : null,
            });
            return !error;
          } catch (e) { return false; }
        }

        // Same best-effort pattern in reverse: deletes are only actually
        // enforced by a Postgres RLS policy on OPPORTUNITIES_TABLE (mirror
        // the "insert" policy above with a "delete" one restricted to
        // admins). If there's no backend configured, or the delete is
        // rejected, this quietly no-ops and the caller has already removed
        // it from the local jobsData array, same as before.
        async function deleteOpportunityRemote(id){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(OPPORTUNITIES_TABLE).delete().eq('id', id);
            return !error;
          } catch (e) { return false; }
        }

        // Career opportunities live in one data store (instead of being
        // generated inline) so a listing's saved state persists and can be
        // shown back in Settings > Saved.
        let jobsData = {
          opportunities: [],
          internships: [],
          courses: [],
        };

        function allJobs(){
          return [...jobsData.opportunities, ...jobsData.internships, ...jobsData.courses];
        }

        // ---- Employer reply tracking ----
        // Stitch can't read the employer's inbox, but once someone applies we
        // let them log what happened next (still waiting, got an interview,
        // an offer, or turned down) so "Applied" isn't a dead end.
        const JOB_STATUS_META = {
          applied:      { label: 'Awaiting reply', color: '#6b7280', bg: 'bg-gray-100',    text: 'text-gray-600' },
          interviewing: { label: 'Interviewing',    color: '#b45309', bg: 'bg-amber-100',   text: 'text-amber-700' },
          offer:        { label: 'Offer received',  color: '#059669', bg: 'bg-emerald-100', text: 'text-emerald-700' },
          rejected:     { label: 'Not selected',    color: '#be123c', bg: 'bg-rose-100',    text: 'text-rose-700' },
        };
        const JOB_STATUS_ORDER = ['applied', 'interviewing', 'offer', 'rejected'];

        function jobStatusMeta(job){
          return JOB_STATUS_META[job.status || 'applied'];
        }

        function fmtJobDate(ts){
          if (!ts) return '';
          return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }

        function updateJobApplicationStatus(id, status){
          const job = findJob(id);
          if (!job || !job.applied) return;
          job.status = status;
          job.statusUpdatedDate = Date.now();
          const ov = document.getElementById('overlay');
          if (ov && activeJobId === id) ov.innerHTML = jobDetailHTML();
          const jobsContentEl = document.getElementById('jobs-content');
          if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
        }

        function updateJobStatusNote(id, note){
          const job = findJob(id);
          if (!job) return;
          job.statusNote = note;
        }

        function jobStatusBadge(job){
          if (!job.applied) return '';
          const meta = jobStatusMeta(job);
          return `<span class="flex-shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${meta.bg} ${escapeHtml(meta.text)}">${job.type === 'Course' ? 'Enrolled' : meta.label}</span>`;
        }

        function applicationStatusCardHTML(job){
          const meta = jobStatusMeta(job);
          return `
            <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
              <div class="flex items-center justify-between mb-1">
                <div class="font-semibold text-sm text-gray-800">Application status</div>
                <span class="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${meta.bg} ${escapeHtml(meta.text)}">${escapeHtml(meta.label)}</span>
              </div>
              <div class="text-xs text-gray-400 mb-3">Applied ${fmtJobDate(job.appliedDate)}${(job.status && job.status !== 'applied' && job.statusUpdatedDate) ? ` · Updated ${fmtJobDate(job.statusUpdatedDate)}` : ''}</div>
              <div class="text-xs text-gray-400 mb-4">Stitch can't read employer inboxes, so log any reply yourself to keep track of it here.</div>
              <div class="grid grid-cols-2 gap-2 mb-4">
                ${JOB_STATUS_ORDER.map(k => {
                  const active = (job.status || 'applied') === k;
                  const m = JOB_STATUS_META[k];
                  return `<button onclick="updateJobApplicationStatus('${job.id}','${k}')" class="px-3 py-2.5 rounded-xl text-xs font-semibold text-center" style="${active ? `background:${m.color};color:#ffffff;` : 'background:#f3f4f6;color:#6b7280;'}">${escapeHtml(m.label)}</button>`;
                }).join('')}
              </div>
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Notes</label>
              <textarea oninput="updateJobStatusNote('${job.id}', this.value)" placeholder="e.g. Phone screen scheduled for Thursday" rows="2" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm resize-none" style="outline:none;">${job.statusNote || ''}</textarea>
            </div>`;
        }

        function findJob(id){
          return allJobs().find(j => j.id === id);
        }

        function jobBucketFor(job){
          if (job.type === 'Course') return jobsData.courses;
          if (job.type === 'Internship') return jobsData.internships;
          return jobsData.opportunities;
        }

        function deleteOpportunity(id){
          if (!isCurrentUserAdmin()) return;
          const job = findJob(id);
          if (!job) return;
          const isCourse = job.type === 'Course';
          if (!confirm(`Delete "${job.title}"? This removes this ${isCourse ? 'course' : 'listing'} for everyone and can't be undone.`)) return;
          const bucket = jobBucketFor(job);
          const idx = bucket.indexOf(job);
          if (idx !== -1) bucket.splice(idx, 1);
          deleteOpportunityRemote(id);
          if (activeJobId === id) closeOverlay();
          renderJobMarket();
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

        function jobsContent(){
          const q = careerSearchQuery.trim().toLowerCase();
          if (q) {
            const matches = allJobs().filter(j => jobMatchesSearch(j, q));
            return matches.length
              ? matches.map(jobCard).join('')
              : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No opportunities match "${escapeHtml(careerSearchQuery.trim())}".</div>`;
          }
          if (jobsSub === 'opportunities') return jobsData.opportunities.map(jobCard).join('');
          if (jobsSub === 'internships') return jobsData.internships.map(jobCard).join('');
          if (jobsSub === 'courses') return jobsData.courses.map(jobCard).join('');
          if (jobsSub === 'saved') {
            const savedJobs = allJobs().filter(j => j.saved);
            return savedJobs.length
              ? savedJobs.map(jobCard).join('')
              : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">No saved career opportunities yet.<br>Tap the bookmark icon on a listing to save it here.</div>`;
          }
          const appliedJobs = allJobs().filter(j => j.applied);
          return appliedJobs.length
            ? appliedJobs.map(jobCard).join('')
            : `<div class="bg-white rounded-3xl p-8 text-center text-gray-500 text-sm">You haven't applied to anything yet.<br>Browse opportunities to get started.</div>`;
        }

        function jobCard(job){
          return `
            <div class="rounded-3xl p-4 flex items-center gap-4 mb-4 shadow-sm" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.07) 0%, rgba(65,105,225,0.07) 100%);background-color:#ffffff;">
              <button onclick="openJobOrClassroom('${job.id}')" class="flex items-center gap-4 flex-1 min-w-0 text-left">
                <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(job.icon,'w-6 h-6')}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <div class="font-semibold text-sm truncate" style="color:${NAVY};">${escapeHtml(job.title)}</div>
                    ${jobStatusBadge(job)}
                  </div>
                  <div class="text-xs text-gray-500 truncate">${job.sub} · ${job.deadline}</div>
                </div>
              </button>
              <button onclick="toggleSaveJob('${job.id}')" class="flex-shrink-0 p-1" style="color:${job.saved ? NAVY : '#9ca3af'}">${Icon('bookmark','w-5 h-5')}</button>
            </div>`;
        }

        function jobsSubTab(k){
          jobsSub = k;
          const filterbar = document.getElementById('career-filterbar');
          if (filterbar) {
            filterbar.innerHTML = `
              <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                ${jobsTabs.map(([key,label]) => `
                  <button onclick="jobsSubTab('${key}')" class="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${jobsSub===key ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${jobsSub===key ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${label}</button>
                `).join('')}
              </div>`;
          }
          const jobsContentEl = document.getElementById('jobs-content');
          if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
        }

        // ---------------- Job detail & apply ----------------
        let activeJobId = null;

        function openJobDetail(id){
          activeJobId = id;
          openOverlay('jobDetail');
        }

        // Tapping an opportunity card normally opens the job/course detail
        // overlay -- but once a Course has been enrolled in, it has become
        // a real class, so tapping it should take the learner straight
        // into that classroom instead (same as tapping it under "My
        // Classes" on the Classroom tab).
        function openJobOrClassroom(id){
          const job = findJob(id);
          if (job && job.type === 'Course' && job.applied && job.classId) {
            openClassDetailWithLoading(job.classId);
            return;
          }
          openJobDetail(id);
        }

        // Marks the listing as applied and, when the poster left a contact
        // email, opens the user's mail app with a pre-filled subject line.
        // Note: a mailto: link can't actually carry file attachments, so
        // this does NOT send the resume/cover letter file itself -- it
        // just lists the file names and reminds the person to attach them
        // by hand before hitting send in their mail app.
        // When a Course listing is enrolled in, it should behave like any
        // other class the learner joined: show up as a card under "My
        // Classes" on the Classroom tab, and open straight into that same
        // class detail (stream/classwork/people) from anywhere it's
        // tapped. This mints a real myClasses entry for the course (once
        // -- re-enrolling reuses the same class via job.classId) so it's
        // indistinguishable from a class created or joined normally.
        function enrollCourseIntoClassroom(job){
          if (job.classId && myClasses.find(c => c.id === job.classId)) return job.classId;
          const id = 'class-' + Date.now();
          const colorIndex = Math.floor(Math.random() * classCardPalette.length);
          const motifIndex = Math.floor(Math.random() * classCardMotifs.length);
          const newClass = {
            id,
            name: job.title,
            section: job.org || '',
            subject: job.org || '',
            code: null,
            isCourse: true,
            role: 'student',
            students: [],
            coTeachers: [],
            announcements: job.description ? [{
              id: 'ann-' + Date.now(),
              text: job.description,
              time: 'Just now',
              reposted: false,
              comments: [],
              attachments: [],
            }] : [],
            classwork: [],
            lectures: [],
            photo: null,
            notificationsEnabled: true,
            colorIndex,
            motifIndex,
          };
          myClasses.push(newClass);
          job.classId = id;
          return id;
        }

        function finalizeJobApplication(id){
          const job = findJob(id);
          if (!job) return;
          job.applied = true;
          job.status = 'applied';
          job.appliedDate = Date.now();
          job.statusUpdatedDate = Date.now();
          if (job.type === 'Course') {
            enrollCourseIntoClassroom(job);
          }
          if (job.email) {
            const d = jobApplyDraft;
            const isCourse = job.type === 'Course';
            let bodyLines;
            if (isCourse) {
              // Enrolling isn't an application -- no cover letter, no "I'd
              // like to apply" language. Just a friendly note that they're
              // in, consenting to the class's rules, signed with their
              // name and phone number.
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
                alert("Your mail app will open with a draft application. Please attach your cover letter file before hitting send -- Stitch can't attach it for you.");
              }
            }
            window.location.href = `mailto:${job.email}?subject=${encodeURIComponent((isCourse ? 'Enrollment: ' : 'Application: ') + job.title)}&body=${encodeURIComponent(bodyLines)}`;
          }
          const jobsContentEl = document.getElementById('jobs-content');
          if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
        }

        function jobDetailHTML(){
          const job = findJob(activeJobId);
          if (!job) return `${overlayHeader('Opportunity')}<div class="p-5 text-center text-gray-400 text-sm">This listing is no longer available.</div>`;
          const isCourse = job.type === 'Course';
          const applyLabel = isCourse ? 'Enroll' : 'Apply';
          const detailRow = (icon, label, value) => `
            <div class="flex items-center gap-3 py-2.5 ${label === 'Type' ? '' : 'border-t border-gray-100'}">
              <div class="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(icon,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0 flex items-center justify-between gap-3">
                <span class="text-xs text-gray-400">${label}</span>
                <span class="text-sm font-semibold text-gray-800 text-right">${value}</span>
              </div>
            </div>`;
          return `
            ${overlayHeader('Opportunity', '20px')}
            <div class="flex-1 overflow-y-auto px-5 pb-8">
              <div class="flex items-center gap-4 mb-5">
                <div class="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(job.icon,'w-7 h-7')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-lg font-display leading-snug">${escapeHtml(job.title)}</div>
                  <div class="text-sm text-gray-500 truncate">${job.org || ''}</div>
                </div>
              </div>
              <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
                <div class="font-semibold text-sm text-gray-800 mb-2">Description &amp; requirements</div>
                <div class="text-sm text-gray-600 leading-relaxed" style="white-space:pre-wrap;">${job.description || 'No description provided.'}</div>
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
                </div>` : (job.email ? `
                <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
                  <div class="font-semibold text-sm text-gray-800 mb-1">How to apply</div>
                  <div class="text-xs text-gray-500">Applications are sent directly to <span class="font-medium text-gray-700">${job.email}</span>.</div>
                </div>` : '')}
              ${job.applied && !isCourse ? applicationStatusCardHTML(job) : ''}
              <div class="text-center mt-2" style="padding-bottom:10px;">
                ${job.applied
                  ? (isCourse
                      ? `<button onclick="openClassDetailWithLoading('${job.classId}')" class="pill-cta inline-flex items-center justify-center gap-2 text-white font-semibold text-center rounded-2xl text-sm" style="background:rgba(30,144,255,0.5);padding:0.5rem 1.1rem;">${Icon('book','w-4 h-4')} Go to Classroom</button>`
                      : `<div class="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-base ${jobStatusMeta(job).bg} ${jobStatusMeta(job).text}">${Icon('check','w-4 h-4')} ${jobStatusMeta(job).label}</div>`)
                  : `<button onclick="openJobApply('${job.id}')" class="pill-cta inline-flex items-center justify-center text-white font-semibold text-center rounded-2xl text-sm" style="background:rgba(30,144,255,0.5);padding:0.5rem 1.1rem;">${applyLabel}</button>`}
              </div>
              ${isCurrentUserAdmin() ? `
                <button onclick="deleteOpportunity('${job.id}')" class="w-full py-2.5 rounded-2xl font-medium text-sm text-red-500">Delete ${isCourse ? 'course' : 'listing'}</button>` : ''}
            </div>`;
        }

        // ---------------- Job application form ----------------
        let activeApplyJobId = null;
        let jobApplyDraft = { fullName:'', email:'', phone:'', letterFileName:'', letterText:'' };

        function resetJobApplyDraft(){
          jobApplyDraft = { fullName:'', email:'', phone:'', letterFileName:'', letterText:'' };
        }

        function openJobApply(id){
          activeApplyJobId = id;
          resetJobApplyDraft();
          openOverlay('jobApply');
        }

        function updateJobApplyField(field, value){
          jobApplyDraft[field] = value;
        }

        function jobApplyFieldRow(label, field, placeholder, type){
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${label}</label>
              <input type="${type || 'text'}" value="${jobApplyDraft[field]}" oninput="updateJobApplyField('${field}', this.value)" placeholder="${placeholder || ''}" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm" style="outline:none;">
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

        function submitJobApplication(){
          if (!requireCompleteProfile()) return;
          const job = findJob(activeApplyJobId);
          if (!job) return;
          const d = jobApplyDraft;
          if (!d.fullName.trim() || !d.email.trim()) {
            alert('Please add your name and email.');
            return;
          }
          if (!isValidName(d.fullName.trim())) {
            alert('Please enter a valid full name (letters, spaces, hyphens, and apostrophes only).');
            return;
          }
          if (!isValidEmail(d.email.trim())) {
            alert('Please enter a valid email address (e.g. you@example.com).');
            return;
          }
          if (d.phone && d.phone.trim() && !isValidPhone(d.phone.trim())) {
            alert('Please enter a valid phone number (7-15 digits, e.g. +233 24 123 4567).');
            return;
          }
          finalizeJobApplication(job.id);
          resetJobApplyDraft();
          openJobDetail(job.id);
        }

        function jobApplyHTML(){
          const job = findJob(activeApplyJobId);
          if (!job) return `${overlayHeader('Apply')}<div class="p-5 text-center text-gray-400 text-sm">This listing is no longer available.</div>`;
          const isCourse = job.type === 'Course';
          return `
            ${overlayHeader(isCourse ? 'Enroll' : 'Apply', '20px')}
            <div class="flex-1 overflow-y-auto px-5 pb-8">
              <div class="rounded-3xl p-4 mb-5 flex items-center gap-3" style="background:rgba(10,37,64,0.05);">
                <div class="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(job.icon,'w-5 h-5')}</div>
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
                <button onclick="submitJobApplication()" class="pill-cta inline-flex items-center justify-center text-white font-semibold text-center rounded-2xl text-sm" style="background:rgba(30,144,255,0.5);padding:0.5rem 1.1rem;">${isCourse ? (job.priceType === 'paid' ? 'Continue to Payment' : 'Enroll for Free') : 'Submit Application'}</button>
              </div>
            </div>`;
        }

        // ---------------- Post an Opportunity ----------------
        const oppTypes = ['Job','Internship','Part-time','Course','Other'];
        const oppModes = ['Online','On-site'];
        let newOppDraft = { title:'', org:'', type:'Job', mode:'On-site', location:'', duration:'', deadline:'', description:'', email:'', priceType:'free', price:'' };

        function resetNewOppDraft(){
          newOppDraft = { title:'', org:'', type:'Job', mode:'On-site', location:'', duration:'', deadline:'', description:'', email:'', priceType:'free', price:'' };
        }

        function setNewOppPriceType(priceType){
          newOppDraft.priceType = priceType;
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

        async function submitNewOpportunity(){
          if (!isCurrentUserAdmin()) { alert('Only admins can post an opportunity.'); return; }
          if (!requireCompleteProfile()) return;
          const d = newOppDraft;
          const isCourse = d.type === 'Course';
          if (!d.title.trim() || !d.description.trim() || (!isCourse && !d.email.trim())) {
            alert(isCourse ? 'Please add at least a title and a description.' : 'Please add at least a title, a description, and an email to receive applications.');
            return;
          }
          if (d.email.trim() && !isValidEmail(d.email.trim())) {
            alert('Please enter a valid email address (e.g. you@example.com).');
            return;
          }
          if (isCourse && d.priceType === 'paid' && !d.price.trim()) {
            alert('Please add the enrollment fee amount, or switch this to a free course.');
            return;
          }
          const iconByType = { Job:'briefcase', Internship:'graduate', 'Part-time':'briefcase', Course:'chart', Other:'briefcase' };
          const priceLabel = isCourse ? (d.priceType === 'paid' ? d.price.trim() : 'Free') : '';
          const sub = isCourse
            ? [d.org, d.duration].filter(Boolean).join(' · ')
            : [d.org, d.mode === 'Online' ? (d.location || 'Online') : (d.location || 'On-site'), d.duration].filter(Boolean).join(' · ');
          const job = {
            id: 'opp' + Date.now(),
            icon: iconByType[d.type] || 'briefcase',
            title: d.title.trim(),
            sub,
            deadline: d.deadline.trim() ? (isCourse ? d.deadline.trim() : `Deadline ${d.deadline.trim()}`) : (isCourse ? 'Self-paced' : 'No deadline given'),
            type: d.type,
            mode: d.mode,
            org: d.org.trim(),
            duration: d.duration.trim(),
            email: d.email.trim(),
            description: d.description.trim(),
            saved:false,
            applied:false,
            mine: true,
          };
          if (isCourse) {
            job.priceType = d.priceType;
            job.price = priceLabel;
          }
          const bucket = isCourse ? jobsData.courses : (d.type === 'Internship' ? jobsData.internships : jobsData.opportunities);
          bucket.unshift(job);
          // Best-effort: also persist it so other users see it too. If
          // there's no backend configured yet, this quietly no-ops and the
          // listing just stays local, same as before.
          postOpportunityInsertRemote(job);
          resetNewOppDraft();
          closeOverlay();
          jobsSub = isCourse ? 'courses' : (job.type === 'Internship' ? 'internships' : 'opportunities');
          renderJobMarket();
        }

        function oppFieldRow(label, field, placeholder, type){
          return `
            <div class="mb-4">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${label}</label>
              <input type="${type || 'text'}" value="${newOppDraft[field]}" oninput="updateNewOppField('${field}', this.value)" placeholder="${placeholder || ''}" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
            </div>`;
        }

        function postOpportunityHTML(){
          return `
            ${overlayHeader('Post an Opportunity', '20px')}
            <div class="flex-1 overflow-y-auto px-5 pb-8">
              ${oppFieldRow('Title', 'title', 'e.g. Research Intern')}
              ${oppFieldRow('Organization', 'org', 'e.g. Macro Team')}

              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Type</label>
                <div class="flex flex-wrap gap-2">
                  ${oppTypes.map(t => `
                    <button onclick="setNewOppType('${t}')" class="px-4 py-2 rounded-full text-xs font-semibold ${newOppDraft.type===t ? '' : 'bg-gray-100 text-gray-500'}" style="${newOppDraft.type===t ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${t}</button>
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
              ${oppFieldRow(newOppDraft.type === 'Course' ? 'Start date (optional)' : 'Deadline', 'deadline', newOppDraft.type === 'Course' ? 'e.g. Self-paced, or Starts Aug 10' : 'e.g. Aug 30, 2026')}

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
              ` : oppFieldRow('Email to receive applications', 'email', 'e.g. careers@yourorg.com', 'email')}

              <div class="text-center mt-2" style="padding-bottom:10px;">
                <button onclick="submitNewOpportunity()" class="pill-cta inline-flex items-center justify-center text-white font-semibold text-center rounded-2xl text-sm" style="background:rgba(30,144,255,0.5);padding:0.5rem 1.1rem;">${newOppDraft.type === 'Course' ? 'Post Course' : 'Post Opportunity'}</button>
              </div>
            </div>`;
        }

        function careerAnalyticsHTML(){
          const jobs = allJobs();
          const appliedJobs = jobs.filter(j => j.applied);
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
                      const count = trackedApplications.filter(j => (j.status || 'applied') === k).length;
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
                  <div class="text-2xl font-bold text-[${NAVY}]">${profileData.network}</div>
                  <div class="text-xs text-gray-500 mt-1">My Network</div>
                </div>
                <div class="bg-white rounded-3xl p-4 shadow-sm">
                  <div class="text-2xl font-bold text-[${NAVY}]">${profileData.posts}</div>
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

