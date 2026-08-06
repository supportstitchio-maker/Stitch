        // ---------------- Public directory (Discover) & connection requests ----------------
        // Discover needs to show real signed-up people, not made-up ones --
        // but the rest of this account's data (user_state, see core.js) is
        // private, readable only by its own owner. So just the handful of
        // fields actually meant to be public (name, username, bio, photo)
        // get mirrored into their own small, publicly-readable table
        // instead of loosening user_state's privacy. Requires two more
        // tables in Supabase:
        //
        //   create table public_profiles (
        //     user_id uuid primary key references auth.users(id) on delete cascade,
        //     name text not null default '',
        //     username text not null default '',
        //     bio text not null default '',
        //     photo text,
        //     updated_at timestamptz not null default now()
        //   );
        //   alter table public_profiles enable row level security;
        //   create policy "Anyone signed in can read public profiles"
        //     on public_profiles for select using (auth.role() = 'authenticated');
        //   create policy "You can only create your own public profile"
        //     on public_profiles for insert with check (auth.uid() = user_id);
        //   create policy "You can only update your own public profile"
        //     on public_profiles for update using (auth.uid() = user_id);
        //
        //   -- "Connect" sends a request rather than connecting right away.
        //   -- Accepting/declining isn't wired up in the UI yet, but the
        //   -- table already supports it (only the recipient can update
        //   -- status), so that's a follow-up to the request flow itself,
        //   -- not a schema change.
        //   create table connection_requests (
        //     id text primary key,
        //     from_user uuid not null references auth.users(id) on delete cascade,
        //     to_user uuid not null references auth.users(id) on delete cascade,
        //     status text not null default 'pending',
        //     message text,
        //     created_at timestamptz not null default now()
        //   );
        //   alter table connection_requests enable row level security;
        //   create policy "Sender or recipient can read a request"
        //     on connection_requests for select
        //     using (auth.uid() = from_user or auth.uid() = to_user);
        //   create policy "You can only send a request as yourself"
        //     on connection_requests for insert
        //     with check (auth.uid() = from_user and from_user <> to_user);
        //   create policy "Only the recipient can respond to a request"
        //     on connection_requests for update using (auth.uid() = to_user);
        //
        //   -- Already deployed? Add the new column with:
        //   --   alter table connection_requests add column message text;
        //   -- "status" also now accepts 'removed', written when someone
        //   -- taps "Remove" on a profile they're connected to -- no new
        //   -- column needed for that, since it reuses the existing status
        //   -- text field (see removeConnectionWithViewedProfile in
        //   -- overlays.js).
        const PUBLIC_PROFILES_TABLE = 'public_profiles';
        const CONNECTION_REQUESTS_TABLE = 'connection_requests';

        // Best-effort: mirrors this account's public-facing fields so it
        // can actually show up in other people's Discover list. Called
        // whenever the profile is edited, and once after login (see
        // authEnterApp in games.js).
        //
        // Deliberately NOT gated on hasCompleteProfile() (name AND
        // username both set) -- that gate is meant for "can this account
        // create content", not "can this account be discovered". Gating
        // sync on full completeness meant any account that hadn't yet
        // picked a username (which includes every "Continue with Google"
        // signup until they open Edit Profile) never got a row in
        // public_profiles at all, so it could never show up in anyone
        // else's Discover list -- which made Discover look empty/broken
        // for everyone even once real people had signed up. Falls back to
        // the account's email prefix so there's always at least a name to
        // show, same as the "Stitch member" fallback already used when
        // rendering the Discover list itself.
        async function syncPublicProfile(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const user = await getCachedAuthUser();
            if (!user) return;
            const emailPrefix = (user.email || '').split('@')[0] || '';
            const name = (profileData.name || '').trim() || emailPrefix;
            if (!name) return; // nothing at all to show yet
            await sb.from(PUBLIC_PROFILES_TABLE).upsert({
              user_id: user.id,
              name,
              username: (profileData.username || '').trim(),
              bio: profileData.bio || '',
              photo: profileData.photo || null,
              updated_at: new Date().toISOString(),
            });
          } catch (e) { console.warn('Syncing public profile failed:', e); }
        }

        // ---------------- PROFILE ----------------
        let profileData = {
          name: '',
          username: '',
          pronouns: '',
          bio: '',
          gender: '',
          photo: null,
          link: ''
        };

        // A name and username are required before someone can post, comment,
        // apply, or otherwise create anything -- including when the account
        // came from "Continue with Google", which only fills in email/photo,
        // not a chosen username. Anything that creates content should call
        // requireCompleteProfile() first and bail out if it returns false.
        function hasCompleteProfile(){
          return !!((profileData.name || '').trim() && (profileData.username || '').trim());
        }
        function requireCompleteProfile(){
          if (hasCompleteProfile()) return true;
          alert('Add your full name and a username before you can do that.');
          openEditProfileModal();
          return false;
        }

        // "Switch account" is a real, lightweight multi-account switcher:
        // each account keeps its own identity (name/username/photo/bio),
        // the rest of the app's content (classes, jobs, inbox) stays
        // shared, matching how a single device with multiple lightweight
        // profiles behaves. Switching snapshots the current identity back
        // into its account entry before loading the selected one.
        // Pronouns are chosen from a fixed list (like Gender) instead of
        // free text, so every user picks a value rather than typing one in.
        const PRONOUN_OPTIONS = ['He/Him', 'She/Her', 'They/Them', 'Prefer not to say'];

        function renderProfile(){
          document.getElementById('screen').innerHTML = `
            <div class="px-5 pb-3 flex items-center justify-between" style="padding-top:20px;">
              <button onclick="openOverlay('create')" class="w-8 h-8 flex items-center justify-center">${gradIcon(IconBold('plus','w-4 h-4'))}</button>
              <span class="font-bold text-base font-display grad-text flex items-center gap-1.5">${escapeHtml(profileData.username)}${appPrefs.accountPrivacy === 'Private' ? `<span title="Private account" class="text-gray-400">${Icon('lock','w-3.5 h-3.5')}</span>` : ''}</span>
              <div class="flex items-center rounded-full" style="background:rgba(65,105,225,0.08)">
                <button onclick="openOverlay('profileMenu')" class="w-8 h-8 flex items-center justify-center">${gradIcon(IconBold('settings','w-4 h-4'))}</button>
              </div>
            </div>

            <div class="p-5">
              <div class="flex items-center gap-5 mb-4">
                <div class="relative flex-shrink-0">
                  <div class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center ${profileData.photo ? '' : `text-[${NAVY}]`}" style="${profileData.photo ? '' : 'background:rgba(10,37,64,0.14);'}">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('user','w-9 h-9')}</div>
                </div>
                <div class="flex-1">
                  <div class="font-bold text-base mb-2">${escapeHtml(profileData.name)} <span class="font-normal text-gray-400">${profileData.pronouns}</span></div>
                  <div class="flex items-start gap-6">
                    <div class="text-center"><div class="text-base font-bold">${myPostsCount()}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Posts</div></div>
                    <button onclick="openOverlay('myContacts')" class="text-center"><div class="text-base font-bold">${networkConnectionCount()}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">My Network</div></button>
                  </div>
                </div>
              </div>

              <div class="text-sm text-gray-600 mb-4">${escapeHtml(profileData.bio)}</div>

              <div class="flex gap-3 mb-2">
                <button onclick="openEditProfileModal()" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">Edit profile</button>
                <button onclick="openOverlay('profileQR')" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">Share profile</button>
              </div>
            </div>

            <div class="flex border-t border-gray-200" id="profile-tabs">${profileTabsHTML()}</div>
            <div class="px-5" id="profile-tab-content">${profileTabContent()}</div>`;
        }

        // Posts / Reposts / Saved tab row on the profile page. Each tab
        // filters the same feedPosts array the main feed uses, so a post
        // you made, reposted, or bookmarked shows up here immediately.
        let profileTab = 'posts';

        function profileTabsHTML(){
          const tabBtn = (key, icon) => `
            <button onclick="profileTabSwitch('${key}')" class="flex-1 flex justify-center py-3 ${profileTab === key ? `border-b-2 border-[${ROYAL}] text-[${NAVY}]` : 'text-gray-400'}">${Icon(icon,'w-5 h-5')}</button>`;
          return tabBtn('posts','grid') + tabBtn('reposts','repost') + tabBtn('saved','bookmark');
        }

        // Small square thumbnail grid, Instagram-profile style. Posts with
        // an image/video (mediaHtml) show that media cropped to a square;
        // text-only posts fall back to a tiny tinted card with a snippet.
        function profileGridItem(post){
          const inner = post.mediaHtml
            ? post.mediaHtml
            : `<div class="w-full h-full bg-gray-100 flex items-center justify-center p-2"><div class="text-[9px] leading-tight text-gray-500 text-center overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${post.body||''}</div></div>`;
          return `<div class="relative w-full aspect-square overflow-hidden">${inner}</div>`;
        }

        function profileTabContent(){
          const emptyState = (text) => `<div class="text-gray-400 text-sm text-center py-10">${text}</div>`;
          if (profileTab === 'reposts') {
            const items = feedPosts.filter(p => p.reposted);
            return items.length ? `<div class="profile-thumb-grid">${items.map(profileGridItem).join('')}</div>` : emptyState('Posts you repost will show up here.');
          }
          if (profileTab === 'saved') {
            const items = feedPosts.filter(p => p.saved);
            return items.length ? `<div class="profile-thumb-grid">${items.map(profileGridItem).join('')}</div>` : emptyState('Posts you save will show up here.');
          }
          const items = feedPosts.filter(p => p.mine);
          return items.length ? `<div class="profile-thumb-grid">${items.map(profileGridItem).join('')}</div>` : emptyState('Your posts will show up here.');
        }

        // ---------------- Desktop right panel ----------------
        // Telegram-style info column fixed to the right edge (desktop
        // only). One shared panel, five possible contents depending on
        // what opened it: your Profile (with Discover friends folded in
        // underneath, same as Telegram's chat-info + shared-members
        // pattern), a standalone Discover search, the Classroom Notes, the
        // Jobs tab's Job Plan, or a file that was opened for viewing. Each
        // main tab opens its own default mode automatically on desktop
        // (see applyDefaultRightPanel) and never applies to Messaging.
        let rightPanelMode = null; // null | 'profile' | 'discover' | 'notebook' | 'jobplan' | 'file' | 'gameprofile' | 'aihistory' | 'pinned'

        function openRightPanel(mode, syncNav){
          // The right panel is a Telegram-style info column for the rest
          // of the app -- but an *open* conversation on desktop already
          // uses that same screen real estate for its own split view (see
          // .messaging-split), so the panel is skipped only while a chat
          // is actually open, not for the Messaging tab's inbox list.
          const appShellForCheck = document.getElementById('app-shell');
          if (appShellForCheck && appShellForCheck.classList.contains('messaging-split')) return;
          rightPanelMode = mode;
          // Both 'profile' (Discover friends folded in underneath) and
          // 'discover' show the same real people list -- load it fresh
          // each time either opens, same as the mobile overlay.
          if (mode === 'profile' || mode === 'discover') { discoverPeopleLoaded = false; loadDiscoverPeople(); }
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.add('right-panel-open');
          // syncNav defaults to true for direct profile-panel shortcuts
          // (Profile/Settings/Notifications); it's passed as false when a
          // tab (e.g. Messaging) is merely defaulting its panel content to
          // profile info, so that tab's own nav highlight isn't stolen.
          if (syncNav !== false) {
            const dnav4 = document.getElementById('dnav-4');
            if (dnav4) dnav4.classList.toggle('dnav-active', mode === 'profile');
            if (mode === 'profile') {
              for (let i = 0; i < 4; i++) {
                const el = document.getElementById('dnav-' + i);
                if (el) el.classList.remove('dnav-active');
              }
            }
          }
          renderRightPanelBody();
        }

        function closeRightPanel(){
          rightPanelMode = null;
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.remove('right-panel-open');
          const dnav4 = document.getElementById('dnav-4');
          if (dnav4) dnav4.classList.remove('dnav-active');
        }

        // ---- Right panel resize (drag) + collapse/expand ----
        // The panel's width is a single CSS variable (--rp-width) so
        // dragging the handle, toggling collapse, and the app-shell/FAB
        // reflow all stay in sync without touching more than one value.
        const RP_MIN_WIDTH = 340;
        const RP_MAX_WIDTH = 760;
        const RP_DEFAULT_WIDTH = 480;

        function setRPWidth(px){
          const clamped = Math.max(RP_MIN_WIDTH, Math.min(RP_MAX_WIDTH, Math.round(px)));
          document.documentElement.style.setProperty('--rp-width', clamped + 'px');
          return clamped;
        }

        function rpStartDrag(e){
          if (e.cancelable) e.preventDefault();
          const panel = document.getElementById('desktop-right-panel');
          const resizer = document.getElementById('rp-resizer');
          if (panel) panel.classList.add('rp-dragging');
          if (resizer) resizer.classList.add('rp-dragging');
          document.body.style.userSelect = 'none';
          const move = (ev) => {
            const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
            setRPWidth(window.innerWidth - x);
          };
          const up = () => {
            if (panel) panel.classList.remove('rp-dragging');
            if (resizer) resizer.classList.remove('rp-dragging');
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
          window.addEventListener('touchmove', move, { passive: true });
          window.addEventListener('touchend', up);
        }

        function rightPanelTitle(){
          if (rightPanelMode === 'profile') return 'Profile';
          if (rightPanelMode === 'discover') return 'Discover';
          if (rightPanelMode === 'notebook') return inLectureCall ? 'Class Pad' : (inExamAnnotate ? 'Annotate' : 'Notebook');
          if (rightPanelMode === 'jobplan') return 'Job Plan';
          if (rightPanelMode === 'gameprofile') return 'Gaming Profile';
          if (rightPanelMode === 'aihistory') return 'Chat History';
          if (rightPanelMode === 'pinned') return 'Pinned Messages';
          if (rightPanelMode === 'file') return (lecturePreview && lecturePreview.name) || 'File';
          return '';
        }

        function renderRightPanelBody(){
          const body = document.getElementById('desktop-right-panel-body');
          const headerBar = document.getElementById('desktop-right-panel-header');
          const title = document.getElementById('desktop-right-panel-title');
          const actions = document.getElementById('desktop-right-panel-actions');
          // The File mode supplies its own header (filename + close
          // button) inside lecturePreviewHTML, so the panel's generic
          // header hides rather than stacking a second one on top.
          if (headerBar) headerBar.style.display = (rightPanelMode === 'file') ? 'none' : '';
          if (title) title.textContent = rightPanelTitle();
          if (actions) {
            const modeActionsHTML = (rightPanelMode === 'aihistory') ? rightPanelAIHistoryActionsHTML() : '';
            actions.innerHTML = `<div class="flex items-center gap-1">${modeActionsHTML}</div>`;
          }
          if (!body) return;
          if (rightPanelMode === 'profile') body.innerHTML = rightPanelProfileHTML();
          else if (rightPanelMode === 'discover') body.innerHTML = rightPanelDiscoverHTML();
          else if (rightPanelMode === 'notebook') body.innerHTML = rightPanelNotebookHTML();
          else if (rightPanelMode === 'jobplan') body.innerHTML = rightPanelJobPlanHTML();
          else if (rightPanelMode === 'gameprofile') body.innerHTML = rightPanelGameProfileHTML();
          else if (rightPanelMode === 'aihistory') body.innerHTML = rightPanelAIHistoryHTML();
          else if (rightPanelMode === 'pinned') body.innerHTML = rightPanelPinnedHTML();
          else if (rightPanelMode === 'file') {
            body.innerHTML = lecturePreviewHTML();
            if (lecturePreview && lecturePreview.kind === 'pdf' && lecturePreview.status === 'ready') renderPreviewPdfPage();
          } else body.innerHTML = '';
        }

        // Condensed profile card (avatar, name, stats, bio) plus Discover
        // friends folded in underneath -- tapping Profile on desktop
        // doesn't need the full mobile page, just enough to glance at and
        // a way through to the full page if you want it.
        function rightPanelProfileHTML(){
          return `
            <div class="p-5 text-center border-b border-gray-100">
              <div class="font-bold text-base mb-1">${escapeHtml(profileData.name)}</div>
              <div class="text-xs text-gray-500 mb-4">@${escapeHtml(profileData.username)}</div>
              <div class="flex items-center justify-center gap-6 mb-4">
                <div class="text-center"><div class="text-base font-bold">${myPostsCount()}</div><div class="text-[11px] text-gray-500">Posts</div></div>
                <button onclick="openOverlay('myContacts')" class="text-center"><div class="text-base font-bold">${networkConnectionCount()}</div><div class="text-[11px] text-gray-500">My Network</div></button>
              </div>
              ${profileData.bio ? `<div class="text-sm text-gray-600 mb-4">${escapeHtml(profileData.bio)}</div>` : ''}
              <div class="flex gap-2">
                <button onclick="closeRightPanel();switchTab(4);" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">View full profile</button>
                <button onclick="openEditProfileModal()" class="flex-1 bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">Edit</button>
              </div>
            </div>
            <div class="px-5 pt-4 pb-5">
              <div class="font-semibold text-sm mb-3">Discover friends</div>
              <div id="discover-people-list">${discoverPeopleHTML()}</div>
            </div>`;
        }

        function rightPanelDiscoverHTML(){
          return `
            <div class="p-5">
              <input id="discover-search-input" value="${escapeHtml(discoverSearchQuery)}" oninput="onDiscoverSearchInput(this.value)" placeholder="Search by name, school, field..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-5" autocomplete="off">
              <div id="discover-people-list">${discoverPeopleHTML()}</div>
            </div>`;
        }

        // Classroom notebook: quick freeform notes scoped to study
        // sessions. Persisted via window.storage (see saveUserNotes /
        // loadUserNotes below) so notes survive a reload and only ever
        // go away when the person taps delete on them.
        let notebookNotes = [];
        let notebookDraft = '';
        let notebookExpandedIds = new Set();

        // Shared body for the Class Pad -- notes first, then (while a
        // lecture is live) the Resources list right underneath, so
        // there's a single "Class Pad" experience whether it's reached
        // through the desktop right panel or the mobile lecture slide-in
        // panel. `prefix` keeps element ids distinct between the two
        // surfaces, since both can exist in the DOM at the same time.
        function classPadBodyHTML(prefix){
          return `
            <textarea id="${prefix}-notebook-draft-input" oninput="notebookDraft=this.value" placeholder="Jot a quick note for this class..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3 resize-none" rows="3">${escapeHtml(notebookDraft)}</textarea>
            <button onclick="addNotebookNote()" class="w-full py-2.5 rounded-2xl font-medium text-sm text-white mb-5" style="background:${ROYAL};">Add note</button>
            <div class="font-semibold text-sm text-gray-700 mb-3">${inLectureCall ? 'Class Pad' : (inExamAnnotate ? 'Annotate' : 'Notebook')}</div>
            <div id="${prefix}-notebook-notes-list">${notebookNotesHTML()}</div>
            ${inLectureCall ? `
            <div id="${prefix}-classpad-resources-list">${classPadResourcesHTML()}</div>
            <div id="${prefix}-classpad-uploaded-list">${classPadUploadedResourcesHTML()}</div>` : ''}`;
        }

        function rightPanelNotebookHTML(){
          return `<div class="p-5">${classPadBodyHTML('desktop')}</div>`;
        }

        // Each saved note shows collapsed (a one-line preview) until
        // tapped, then expands in place to show the full text -- tapping
        // again collapses it back down.
        function notebookNotesHTML(){
          if (!notebookNotes.length) return `<div class="text-gray-400 text-sm text-center py-10">Notes you jot down during class will show up here.</div>`;
          return notebookNotes.map(n => {
            const expanded = notebookExpandedIds.has(n.id);
            return `
            <div onclick="toggleNotebookNote('${n.id}')" class="bg-gray-50 rounded-2xl p-4 mb-3 cursor-pointer">
              <div class="text-sm text-gray-700 mb-2 ${expanded ? '' : 'truncate'}" style="${expanded ? 'white-space:pre-wrap;' : ''}">${escapeHtml(n.text)}</div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-400">${n.time}</span>
                <button onclick="event.stopPropagation(); deleteNotebookNote('${n.id}')" class="text-gray-400">${Icon('trash','w-3.5 h-3.5')}</button>
              </div>
            </div>`;
          }).join('');
        }

        // Refreshes every Class Pad surface currently in the DOM (the
        // desktop right panel, and/or the mobile lecture slide-in panel)
        // rather than assuming only one exists at a time.
        function refreshClassPadSurfaces(){
          ['desktop','lecture'].forEach(prefix => {
            const list = document.getElementById(`${prefix}-notebook-notes-list`);
            if (list) list.innerHTML = notebookNotesHTML();
            const draft = document.getElementById(`${prefix}-notebook-draft-input`);
            if (draft) draft.value = notebookDraft;
          });
        }

        function toggleNotebookNote(id){
          if (notebookExpandedIds.has(id)) notebookExpandedIds.delete(id);
          else notebookExpandedIds.add(id);
          refreshClassPadSurfaces();
        }

        function addNotebookNote(){
          const text = notebookDraft.trim();
          if (!text) return;
          const id = 'note-' + Date.now();
          notebookNotes.unshift({ id, text, time: 'Just now' });
          notebookExpandedIds.add(id);
          notebookDraft = '';
          refreshClassPadSurfaces();
          saveUserNotes();
        }

        function deleteNotebookNote(id){
          notebookNotes = notebookNotes.filter(n => n.id !== id);
          notebookExpandedIds.delete(id);
          refreshClassPadSurfaces();
          saveUserNotes();
        }

        // Job Plan: same idea as the Classroom notebook, but scoped to the
        // Jobs tab -- quick tips/notes on postings, applications, or
        // interview prep. Shows by default whenever the Jobs tab opens on
        // desktop (see applyDefaultRightPanel). Persisted the same way as
        // the Classroom notebook (see saveUserNotes / loadUserNotes).
        let jobPlanNotes = [];
        let jobPlanDraft = '';
        let jobPlanExpandedIds = new Set();

        function rightPanelJobPlanHTML(){
          return `
            <div class="p-5">
              <textarea id="jobplan-draft-input" oninput="jobPlanDraft=this.value" placeholder="Jot a tip or note on a job or application..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3 resize-none" rows="3">${escapeHtml(jobPlanDraft)}</textarea>
              <button onclick="addJobPlanNote()" class="w-full py-2.5 rounded-2xl font-medium text-sm text-white mb-5" style="background:${ROYAL};">Add note</button>
              <div id="jobplan-notes-list">${jobPlanNotesHTML()}</div>
            </div>`;
        }

        // Each saved note shows collapsed (a one-line preview) until
        // tapped, then expands in place to show the full text -- tapping
        // again collapses it back down, same interaction as the notebook.
        function jobPlanNotesHTML(){
          if (!jobPlanNotes.length) return `<div class="text-gray-400 text-sm text-center py-10">Tips and notes you jot down on jobs will show up here.</div>`;
          return jobPlanNotes.map(n => {
            const expanded = jobPlanExpandedIds.has(n.id);
            return `
            <div onclick="toggleJobPlanNote('${n.id}')" class="bg-gray-50 rounded-2xl p-4 mb-3 cursor-pointer">
              <div class="text-sm text-gray-700 mb-2 ${expanded ? '' : 'truncate'}" style="${expanded ? 'white-space:pre-wrap;' : ''}">${escapeHtml(n.text)}</div>
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-400">${n.time}</span>
                <button onclick="event.stopPropagation(); deleteJobPlanNote('${n.id}')" class="text-gray-400">${Icon('trash','w-3.5 h-3.5')}</button>
              </div>
            </div>`;
          }).join('');
        }

        function toggleJobPlanNote(id){
          if (jobPlanExpandedIds.has(id)) jobPlanExpandedIds.delete(id);
          else jobPlanExpandedIds.add(id);
          const list = document.getElementById('jobplan-notes-list');
          if (list) list.innerHTML = jobPlanNotesHTML();
        }

        function addJobPlanNote(){
          const text = jobPlanDraft.trim();
          if (!text) return;
          const id = 'jplan-' + Date.now();
          jobPlanNotes.unshift({ id, text, time: 'Just now' });
          jobPlanExpandedIds.add(id);
          jobPlanDraft = '';
          const body = document.getElementById('desktop-right-panel-body');
          if (body) body.innerHTML = rightPanelJobPlanHTML();
          saveUserNotes();
        }

        function deleteJobPlanNote(id){
          jobPlanNotes = jobPlanNotes.filter(n => n.id !== id);
          jobPlanExpandedIds.delete(id);
          const list = document.getElementById('jobplan-notes-list');
          if (list) list.innerHTML = jobPlanNotesHTML();
          saveUserNotes();
        }

        // Best-effort persistence for both note lists above: saved after
        // every add/delete, loaded once on startup before the first
        // render (see window.onload) so notes are there on the very
        // first paint and only ever disappear when explicitly deleted.
        // Delegates to the shared account-wide sync engine in core.js
        // (Supabase-backed) rather than window.storage, which never
        // persisted anything once this app was deployed outside Claude's
        // own artifact preview sandbox.
        async function saveUserNotes(){
          queueSaveUserState();
        }

        async function loadUserNotes(){
          await ensureUserStateLoaded();
        }

        function profileTabSwitch(tab){
          profileTab = tab;
          const bar = document.getElementById('profile-tabs');
          if (bar) bar.innerHTML = profileTabsHTML();
          const content = document.getElementById('profile-tab-content');
          if (content) content.innerHTML = profileTabContent();
        }

        // ---------------- EDIT PROFILE ----------------
        // Each field's label sits above its own outlined box, rather than
        // being merged inside it; matching the reference layout.
        function editField(id, label, value, placeholder){
          return `
            <div class="mb-4">
              <label class="text-sm font-bold text-gray-700 block mb-2">${label}</label>
              <input id="${id}" type="text" value="${value||''}" placeholder="${placeholder||''}" class="w-full text-[15px] border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3" style="outline:none;">
            </div>`;
        }

        // Bio uses a textarea that grows taller/wider as you type so the
        // full text stays visible instead of scrolling inside a fixed box.
        function editBioField(id, label, value, placeholder){
          return `
            <div class="mb-4">
              <label class="text-sm font-bold text-gray-700 block mb-2">${label}</label>
              <textarea id="${id}" placeholder="${placeholder||''}" oninput="autoResizeBio(this)" rows="1" class="w-full text-[15px] border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3 resize-none overflow-hidden" style="min-height:48px;line-height:1.4;transition:height .12s ease;outline:none;">${value||''}</textarea>
            </div>`;
        }

        function autoResizeBio(el){
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
        }

        // Re-renders the Edit Profile form from profileData. Whenever this
        // runs because of something other than a fresh open (toggling the
        // gender/pronouns menu, picking a value, swapping the photo), the
        // name/username/bio inputs would otherwise get wiped back to
        // whatever profileData still holds -- losing anything typed but
        // not yet saved. captureEditProfileFieldDraft() below pulls the
        // live input values into profileData first so re-rendering never
        // loses in-progress edits.
        function captureEditProfileFieldDraft(){
          const nameEl = document.getElementById('edit-name');
          const usernameEl = document.getElementById('edit-username');
          const bioEl = document.getElementById('edit-bio');
          if (nameEl) profileData.name = nameEl.value;
          if (usernameEl) profileData.username = usernameEl.value;
          if (bioEl) profileData.bio = bioEl.value;
        }

        function renderEditProfileForm(){
          const content = document.getElementById('editProfileModalContent');
          if (!content) return;
          content.innerHTML = editProfileHTML();
          const bio = document.getElementById('edit-bio');
          if (bio) autoResizeBio(bio);
          const modalEl = document.getElementById('editProfileModal');
          attachMenuScrollCloser(modalEl, genderMenuOpen, () => toggleGenderMenu());
          attachMenuScrollCloser(modalEl, pronounsMenuOpen, () => togglePronounsMenu());
        }

        let genderMenuOpen = false;
        let pronounsMenuOpen = false;
        let editProfileAvatarPickerOpen = false;
        let editUsernameError = '';

        // Other Stitch users' usernames, simulated here since this build has
        // no real backend/user database to check against. Kept lowercase
        // since usernames are treated as case-insensitive.
        const takenUsernames = new Set([
          'stitch_nkrumah','ama_owusu','kwame_boateng','abena_asante','kofi_mensah',
          'efua_darko','yaw_appiah','adwoa_sarpong','kwabena_frimpong','akosua_agyeman',
          'nana_yeboah','esi_amoah','kojo_addai','maame_asare','fiifi_quaye',
          'jane_doe','john_smith','admin','support','stitch_team'
        ]);

        function isUsernameTaken(username){
          const clean = (username || '').trim().toLowerCase();
          if (!clean) return false;
          // Never flag it against the user's own current username.
          if (clean === (profileData.username || '').trim().toLowerCase()) return false;
          return takenUsernames.has(clean);
        }

        function editProfileHTML(){
          const p = profileData;
          const avatarInner = p.photo
            ? `<img src="${p.photo}" class="w-full h-full object-cover">`
            : Icon('user','w-8 h-8');
          return `
            <div class="mb-5">
              <button onclick="closeEditProfileModal()" class="w-9 h-9 -ml-2 mb-2 flex items-center justify-center text-gray-700">${Icon('back','w-5 h-5')}</button>
              <div class="text-xl font-bold text-gray-900 font-display mb-1">Edit Profile</div>
              <div class="text-sm text-gray-500">Update how your profile appears on Stitch.</div>
            </div>
            <div class="flex items-center gap-4 mb-5">
              <button onclick="viewProfilePhoto()" class="relative w-20 h-20 flex-shrink-0">
                <div class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center ${p.photo ? '' : `text-[${NAVY}]`}" style="${p.photo ? '' : 'background:rgba(10,37,64,0.14);'}">${avatarInner}</div>
              </button>
              <div class="flex flex-col items-start gap-1">
                <button onclick="triggerProfilePhotoUpload()" class="text-sm font-semibold" style="color:${ROYAL}">Upload picture</button>
                ${p.photo ? `<button onclick="deleteProfilePicture()" class="text-sm font-semibold text-red-500">Delete profile picture</button>` : ''}
                <div class="text-sm text-gray-500">${p.photo ? 'Tap your photo to view it' : 'No profile photo added yet'}</div>
              </div>
            </div>

            ${editField('edit-name','Full name', p.name)}
            <div class="mb-4">
              <label class="text-sm font-bold text-gray-700 block mb-2">Username</label>
              <input id="edit-username" type="text" value="${escapeHtml(p.username||'')}" oninput="onEditUsernameInput()" class="w-full text-[15px] border ${editUsernameError ? 'border-red-400' : 'border-gray-200'} bg-gray-50 rounded-2xl px-4 py-3" style="outline:none;">
              ${editUsernameError ? `<div class="text-xs font-medium text-red-500 mt-1.5 px-1">${editUsernameError}</div>` : ''}
            </div>

            <div class="relative mb-5">
              <label class="text-sm font-bold text-gray-700 block mb-2">Pronouns</label>
              <button onclick="togglePronounsMenu()" class="w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between text-left">
                <span class="text-[15px] ${p.pronouns ? '' : 'text-gray-400'}">${p.pronouns || 'Add pronouns'}</span>
                ${Icon('chevronDown','w-4 h-4 text-gray-500')}
              </button>
              ${pronounsMenuOpen ? `
                <div onclick="togglePronounsMenu()" onwheel="togglePronounsMenu()" ontouchmove="togglePronounsMenu()" class="fixed inset-0 z-10"></div>
                <div class="absolute left-0 right-0 mt-1 bg-white rounded-2xl border border-gray-100 py-2 z-20" style="box-shadow:0 10px 30px rgba(0,0,0,.14);">
                  ${PRONOUN_OPTIONS.map(opt => `<button onclick="setPronouns('${opt}')" class="w-full text-left px-4 py-2.5 text-sm ${p.pronouns===opt ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">${opt}</button>`).join('')}
                </div>
              ` : ''}
            </div>

            ${editBioField('edit-bio','Bio', p.bio, 'Write something about yourself')}

            <div class="mb-6">
              <label class="text-sm font-bold text-gray-700 block mb-2">Gender</label>
              <div onclick="toggleGenderMenu()" class="relative w-full border border-gray-200 bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between text-left cursor-pointer">
                <span class="text-[15px]">${p.gender}</span>
                <div class="relative flex-shrink-0">
                  ${Icon('chevronDown','w-4 h-4 text-gray-500')}
                  ${genderMenuOpen ? `
                    <div onclick="event.stopPropagation(); toggleGenderMenu()" onwheel="event.stopPropagation(); toggleGenderMenu()" ontouchmove="event.stopPropagation(); toggleGenderMenu()" style="position:fixed;inset:0;z-index:30;"></div>
                    <div onclick="event.stopPropagation()" class="bg-white rounded-2xl border border-gray-100 py-2 text-left" style="position:absolute;right:0;top:100%;margin-top:0.5rem;width:9rem;z-index:40;box-shadow:0 10px 30px rgba(0,0,0,.14);">
                      <button onclick="setGender('Male')" class="w-full text-left px-4 py-2.5 text-sm ${p.gender==='Male' ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">Male</button>
                      <button onclick="setGender('Female')" class="w-full text-left px-4 py-2.5 text-sm ${p.gender==='Female' ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">Female</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

            <div class="flex gap-3">
              <button onclick="closeEditProfileModal()" class="flex-1 py-3 rounded-2xl font-semibold text-sm border" style="color:#dc2626;border-color:rgba(220,38,38,0.25);background-image:linear-gradient(135deg, rgba(220,38,38,0.16) 0%, rgba(220,38,38,0.03) 100%);">Cancel</button>
              <button onclick="saveEditProfile()" class="flex-1 py-3 rounded-2xl font-semibold text-sm border" style="color:${NAVY};border-color:rgba(30,144,255,0.12);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">Save Changes</button>
            </div>`;
        }

        function openEditProfileModal(){
          genderMenuOpen = false;
          pronounsMenuOpen = false;
          editUsernameError = '';
          renderEditProfileForm();
          const modal = document.getElementById('editProfileModal');
          if (modal) modal.classList.remove('hidden');
        }

        function closeEditProfileModal(){
          const modal = document.getElementById('editProfileModal');
          if (modal) modal.classList.add('hidden');
          const content = document.getElementById('editProfileModalContent');
          if (content) content.innerHTML = '';
          genderMenuOpen = false;
          pronounsMenuOpen = false;
          editUsernameError = '';
        }

        // Tapping the avatar in Edit Profile no longer opens the upload/
        // choose-avatar controls; it just shows the current photo full-screen.
        function viewProfilePhoto(){
          const p = profileData;
          if (!p.photo) return;
          const img = document.getElementById('profilePhotoViewerImg');
          if (img) img.src = p.photo;
          const modal = document.getElementById('profilePhotoViewerModal');
          if (modal) modal.classList.remove('hidden');
        }

        function closeProfilePhotoViewer(){
          const modal = document.getElementById('profilePhotoViewerModal');
          if (modal) modal.classList.add('hidden');
        }

        function triggerProfilePhotoUpload(){
          const input = document.getElementById('profile-photo-input');
          if (input) input.click();
        }

        function handleProfilePhotoSelected(e){
          const file = e.target.files && e.target.files[0];
          e.target.value = ''; // reset so choosing the same file again still fires onchange
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev){ openPhotoCropModal(ev.target.result); };
          reader.readAsDataURL(file);
        }

        // ---- Crop/resize step, shown between picking a file and it
        // actually becoming the profile picture. Uses Cropper.js (loaded
        // in index.html) for the drag-to-reposition / zoom interaction; a
        // fixed 1:1 crop box since avatars render as circles elsewhere in
        // the app via CSS, and a square source is what makes that circle
        // come out looking right instead of stretched.
        let profilePhotoCropper = null;

        function openPhotoCropModal(dataUrl){
          const modal = document.getElementById('photoCropModal');
          const img = document.getElementById('cropperImage');
          if (!modal || !img) return;
          modal.classList.remove('hidden');
          const slider = document.getElementById('cropZoomSlider');
          if (slider) slider.value = 0;
          img.src = dataUrl;
          const start = () => {
            if (profilePhotoCropper) { profilePhotoCropper.destroy(); profilePhotoCropper = null; }
            profilePhotoCropper = new Cropper(img, {
              aspectRatio: 1,
              viewMode: 1,
              dragMode: 'move',
              autoCropArea: 1,
              cropBoxMovable: false,
              cropBoxResizable: false,
              toggleDragModeOnDblclick: false,
              background: false,
              guides: false,
              center: false,
              highlight: false,
            });
          };
          if (img.complete) start(); else img.onload = start;
        }

        function closePhotoCropModal(){
          const modal = document.getElementById('photoCropModal');
          if (modal) modal.classList.add('hidden');
          if (profilePhotoCropper) { profilePhotoCropper.destroy(); profilePhotoCropper = null; }
          const img = document.getElementById('cropperImage');
          if (img) img.src = '';
        }

        function cancelPhotoCrop(){
          closePhotoCropModal();
        }

        // The slider goes 0-100 for a simple, unitless "more zoom" feel
        // rather than asking the person to think in zoom-ratio units --
        // 0 is Cropper's default fit-to-crop-box zoom, 100 is 3x that.
        function onCropZoomInput(value){
          if (!profilePhotoCropper) return;
          const ratio = 1 + (Number(value) / 100) * 2;
          profilePhotoCropper.zoomTo(ratio);
        }

        function confirmPhotoCrop(){
          if (!profilePhotoCropper) { closePhotoCropModal(); return; }
          const canvas = profilePhotoCropper.getCroppedCanvas({
            width: 640, height: 640, imageSmoothingQuality: 'high',
          });
          if (!canvas) { closePhotoCropModal(); return; }
          profileData.photo = canvas.toDataURL('image/jpeg', 0.9);
          closePhotoCropModal();
          // Refresh every place a profile picture is shown, whichever of
          // these happens to be open/active right now.
          updateNavProfileIcon();
          const editModal = document.getElementById('editProfileModal');
          if (editModal && !editModal.classList.contains('hidden')) renderEditProfileForm();
          if (currentTab === 0) renderFeed();
          else if (currentTab === 4) renderProfile();
          queueSaveUserState();
          syncPublicProfile();
        }

        function deleteProfilePicture(){
          if (!profileData.photo) return;
          if (!confirm('Delete your profile picture?')) return;
          profileData.photo = null;
          // Refresh every place a profile picture is shown, whichever of
          // these happens to be open/active right now.
          updateNavProfileIcon();
          const editModal = document.getElementById('editProfileModal');
          if (editModal && !editModal.classList.contains('hidden')) renderEditProfileForm();
          if (currentTab === 0) renderFeed();
          else if (currentTab === 4) renderProfile();
          queueSaveUserState();
          syncPublicProfile();
        }

        function toggleEditProfileAvatarPicker(){
          captureEditProfileFieldDraft();
          editProfileAvatarPickerOpen = !editProfileAvatarPickerOpen;
          renderEditProfileForm();
        }

        function selectEditProfileAvatar(src){
          profileData.photo = src;
          editProfileAvatarPickerOpen = false;
          // Refresh every place a profile picture is shown, whichever of
          // these happens to be open/active right now.
          updateNavProfileIcon();
          renderEditProfileForm();
          if (currentTab === 0) renderFeed();
          else if (currentTab === 4) renderProfile();
          // These two calls were missing here (unlike confirmPhotoCrop/
          // deleteProfilePicture just above, which both call them):
          // without queueSaveUserState() a preset avatar picked from this
          // picker never made it into the per-account saved state, so it
          // silently reverted to the old photo (or none) the next time this
          // account signed in on any device. Without syncPublicProfile() it
          // also never reached other people's Discover cards or connection
          // requests -- only a cropped/uploaded photo did.
          queueSaveUserState();
          syncPublicProfile();
        }

        function toggleGenderMenu(){
          captureEditProfileFieldDraft();
          genderMenuOpen = !genderMenuOpen;
          renderEditProfileForm();
        }

        function setGender(g){
          captureEditProfileFieldDraft();
          profileData.gender = g;
          genderMenuOpen = false;
          renderEditProfileForm();
        }

        function togglePronounsMenu(){
          captureEditProfileFieldDraft();
          pronounsMenuOpen = !pronounsMenuOpen;
          renderEditProfileForm();
        }

        function setPronouns(v){
          captureEditProfileFieldDraft();
          profileData.pronouns = v;
          pronounsMenuOpen = false;
          renderEditProfileForm();
        }

        function onEditUsernameInput(){
          if (!editUsernameError) return;
          editUsernameError = '';
          const el = document.getElementById('edit-username');
          if (el) el.classList.remove('border-red-400');
          const errEl = el && el.parentElement ? el.parentElement.querySelector('.text-red-500') : null;
          if (errEl) errEl.remove();
        }

        function saveEditProfile(){
          const usernameEl = document.getElementById('edit-username');
          const newUsername = usernameEl ? usernameEl.value.trim() : profileData.username;
          if (isUsernameTaken(newUsername)){
            editUsernameError = 'That username is already taken. Please choose another.';
            renderEditProfileForm();
            return;
          }
          editUsernameError = '';
          profileData.name = document.getElementById('edit-name').value.trim() || profileData.name;
          profileData.username = newUsername || profileData.username;
          profileData.bio = document.getElementById('edit-bio').value.trim();
          queueSaveUserState();
          syncPublicProfile();
          closeEditProfileModal();
          renderProfile();
        }

        // If the user taps a nav tab while Edit Profile is open, quietly save
        // whatever they've typed so far into profileData before leaving, so
        // nothing is lost even though they didn't hit "Save Changes".
        function autoSaveEditProfileDraft(){
          const modal = document.getElementById('editProfileModal');
          if (!modal || modal.classList.contains('hidden')) return;
          const nameEl = document.getElementById('edit-name');
          const usernameEl = document.getElementById('edit-username');
          const bioEl = document.getElementById('edit-bio');
          if (nameEl) profileData.name = nameEl.value.trim() || profileData.name;
          // Don't silently save a taken username on the way out; just keep
          // whatever username was already valid.
          if (usernameEl && !isUsernameTaken(usernameEl.value.trim())) {
            profileData.username = usernameEl.value.trim() || profileData.username;
          }
          if (bioEl) profileData.bio = bioEl.value.trim();
          queueSaveUserState();
          syncPublicProfile();
          closeEditProfileModal();
          renderProfile();
        }

        function settingsRow(icon, label, sub, onclick, danger, hideArrow, id){
          return `
            <button ${id ? `id="${id}"` : ''} onclick="${onclick}" class="w-full flex items-center gap-3 py-3 text-left">
              <div class="w-9 h-9 flex items-center justify-center ${danger ? 'text-red-500' : 'text-[#1e90ff]'} flex-shrink-0">${Icon(icon,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] ${danger ? 'text-red-500 font-medium' : 'text-gray-900'}">${label}</div>
                ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
              </div>
              ${hideArrow ? '' : `<div class="flex-shrink-0" style="color:${NAVY}">${Icon('arrowRight','w-4 h-4')}</div>`}
            </button>`;
        }

        function settingsSection(title, rowsHtml){
          return `
            <div class="mb-5">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">${title}</div>
              <div class="rounded-2xl border border-gray-100 divide-y px-4" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.07) 0%, rgba(65,105,225,0.07) 100%);background-color:#ffffff;">${rowsHtml}</div>
            </div>`;
        }

        function settingsToggleRow(icon, label, sub, checked, onclick){
          return `
            <div class="w-full flex items-center gap-3 py-3">
              <div class="w-9 h-9 flex items-center justify-center text-[#1e90ff] flex-shrink-0">${Icon(icon,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] text-gray-900">${label}</div>
                ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
              </div>
              <button onclick="${onclick}" class="relative flex-shrink-0" style="width:44px;height:24px;border-radius:9999px;border:1px solid ${checked ? 'transparent' : '#d1d5db'};background:${checked ? `linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)` : '#e5e7eb'};box-shadow:inset 0 1px 2px rgba(0,0,0,0.08);transition:background .15s ease;">
                <span style="position:absolute;top:1px;left:1px;width:20px;height:20px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);transform:translateX(${checked ? '20px' : '0'});transition:transform .15s ease;"></span>
              </button>
            </div>`;
        }

        function dangerZoneSection(rowsHtml){
          return `
            <div class="mb-3">
              <div class="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">${Icon('alertTriangle','w-3.5 h-3.5')} Danger zone</div>
              <div class="rounded-2xl border border-red-100 divide-y divide-red-100 px-4" style="background-image:linear-gradient(135deg, rgba(220,38,38,0.16) 0%, rgba(220,38,38,0.03) 100%);">${rowsHtml}</div>
            </div>`;
        }

        function settingsPrivacyRow(){
          return `
            <div class="py-3">
              <div onclick="toggleAccountPrivacyMenu()" class="w-full flex items-center gap-3 cursor-pointer">
                <div class="w-9 h-9 flex items-center justify-center text-[#1e90ff] flex-shrink-0">${Icon('lock','w-4 h-4')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-[15px] text-gray-900">Account privacy</div>
                  <div class="text-xs text-gray-400 mt-0.5">${appPrefs.accountPrivacy}</div>
                </div>
                <div class="relative flex-shrink-0" style="color:${NAVY}">
                  ${Icon('chevronDown','w-4 h-4')}
                  ${accountPrivacyMenuOpen ? `
                    <div onclick="event.stopPropagation(); toggleAccountPrivacyMenu()" style="position:fixed;inset:0;z-index:30;"></div>
                    <div onclick="event.stopPropagation()" class="bg-white rounded-2xl border border-gray-100 py-2 text-left" style="position:absolute;right:0;top:100%;margin-top:0.5rem;width:9rem;z-index:40;box-shadow:0 10px 30px rgba(0,0,0,.14);">
                      <button onclick="setAccountPrivacy('Public')" class="w-full text-left px-4 py-2.5 text-sm ${appPrefs.accountPrivacy==='Public' ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">Public</button>
                      <button onclick="setAccountPrivacy('Private')" class="w-full text-left px-4 py-2.5 text-sm ${appPrefs.accountPrivacy==='Private' ? `font-semibold text-[${NAVY}]` : 'text-gray-700'}">Private</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>`;
        }

        // ---------------- PROFILE QR SHARE ----------------
        function profileQRLink(){
          return `https://stitch.app/@${escapeHtml(profileData.username)}`;
        }

        function profileQRHTML(){
          return `
            <div class="flex-1 flex flex-col overflow-y-auto" style="background:#ffffff;">
              <div class="flex items-center px-5 flex-shrink-0" style="padding-top:20px;">
                <button onclick="closeOverlay()" class="text-[${NAVY}]">${IconBold('close','w-6 h-6')}</button>
              </div>
              <div class="flex-1 flex flex-col items-center px-8" style="padding-top:48px;">
                <div class="bg-white rounded-3xl p-5 flex flex-col items-center shadow-xl" style="width:200px;">
                  <div id="profile-qr-code" class="relative flex items-center justify-center" style="width:160px;height:160px;">
                    <div class="absolute rounded-2xl bg-white flex items-center justify-center" style="width:42px;height:42px;box-shadow:0 0 0 5px #ffffff;">
                      <div class="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center" style="background:linear-gradient(135deg, ${ROYAL}, ${NAVY});">
                        ${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('camera','w-5 h-5 text-white')}
                      </div>
                    </div>
                  </div>
                  <div class="font-bold text-lg font-display mt-3 tracking-wide text-[${NAVY}]">@${profileData.username.toUpperCase()}</div>
                </div>
                <div class="flex items-start justify-between rounded-3xl pt-2.5 pb-3 px-4 bg-white shadow-xl" style="width:215px;margin-top:10px;">
                  ${qrActionButton('send','Share','shareProfileQR()')}
                  ${qrActionButton('link','Copy','copyProfileQRLink()')}
                  ${qrActionButton('download','Download','downloadProfileQR()')}
                </div>
              </div>
            </div>`;
        }

        function qrActionButton(icon,label,onclick){
          return `
            <button onclick="${onclick}" class="flex flex-col items-center gap-1 text-gray-700 flex-shrink-0">
              ${Icon(icon,'w-4 h-4')}
              <span class="text-[10px] font-medium text-gray-500">${label}</span>
            </button>`;
        }

        function initProfileQRCode(){
          const el = document.getElementById('profile-qr-code');
          if (!el || typeof QRCode === 'undefined') return;
          Array.from(el.querySelectorAll('canvas, table, img')).forEach(n => n.remove());
          new QRCode(el, {
            text: profileQRLink(),
            width: 160,
            height: 160,
            colorDark: NAVY,
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
          const canvas = el.querySelector('canvas') || el.querySelector('img');
          if (canvas) canvas.style.position = 'relative';
        }

        function shareProfileQR(){
          const link = profileQRLink();
          if (navigator.share) {
            navigator.share({ title: profileData.name, text: `Check out @${escapeHtml(profileData.username)} on Stitch`, url: link }).catch(() => {});
          } else {
            copyProfileQRLink();
          }
        }

        function copyProfileQRLink(){
          const link = profileQRLink();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => alert('Link copied to clipboard')).catch(() => alert(link));
          } else {
            alert(link);
          }
        }

        function downloadProfileQR(){
          const el = document.getElementById('profile-qr-code');
          const qrCanvas = el ? el.querySelector('canvas') : null;
          if (!qrCanvas) { alert('QR code is still generating, try again in a moment.'); return; }
          const size = 640, pad = 60;
          const out = document.createElement('canvas');
          out.width = size; out.height = size + 140;
          const ctx = out.getContext('2d');

          const drawBaseAndSave = () => {
            const link = document.createElement('a');
            link.download = `${escapeHtml(profileData.username)}-qr.png`;
            link.href = out.toDataURL('image/png');
            link.click();
          };

          const drawBase = () => {
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, 0, 0, out.width, out.height, 36);
            ctx.fill();
            const qrSize = size - pad * 2;
            ctx.drawImage(qrCanvas, pad, pad, qrSize, qrSize);
            ctx.fillStyle = NAVY;
            ctx.font = 'bold 34px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('@' + profileData.username.toUpperCase(), out.width / 2, size + 80);
          };

          const centerX = pad + (size - pad * 2) / 2;
          const centerY = pad + (size - pad * 2) / 2;

          const drawBadge = (img) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX, centerY, 32, 0, Math.PI * 2);
            ctx.clip();
            if (img) {
              ctx.drawImage(img, centerX - 32, centerY - 32, 64, 64);
            } else {
              const grad = ctx.createLinearGradient(centerX - 32, centerY - 32, centerX + 32, centerY + 32);
              grad.addColorStop(0, ROYAL);
              grad.addColorStop(1, NAVY);
              ctx.fillStyle = grad;
              ctx.fillRect(centerX - 32, centerY - 32, 64, 64);
            }
            ctx.restore();
          };

          drawBase();
          if (profileData.photo) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { drawBadge(img); drawBaseAndSave(); };
            img.onerror = () => { drawBadge(null); drawBaseAndSave(); };
            img.src = profileData.photo;
          } else {
            drawBadge(null);
            drawBaseAndSave();
          }
        }

        function roundRect(ctx, x, y, w, h, r){
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        }

        function profileMenuHTML(){
          return `
            <div class="flex-1 overflow-y-auto">
              ${overlayHeader('Settings and activity', '20px')}
              <div class="p-5">
              ${settingsSection('Your account', `
                ${settingsRow('bookmark','Saved', null, "openSavedItems('posts')")}
                ${settingsRow('close','Blocked', blockedAccounts.length ? `${blockedAccounts.length} account${blockedAccounts.length===1?'':'s'}` : 'No blocked accounts', "openOverlay('blockedAccounts')")}
                ${settingsPrivacyRow()}
              `)}
              ${settingsSection('Activity', `
                ${settingsRow('chart','Your activity', null, "openOverlay('profileAnalytics')")}
              `)}
              ${settingsSection('Notification Preferences', `
                ${settingsToggleRow('bell','Reminders and updates', 'Session reminders plus app news and updates', appPrefs.notifReminders, "toggleNotifPref('notifReminders')")}
                ${settingsToggleRow('comment','New messages', 'Direct messages and chat', appPrefs.notifMessages, "toggleNotifPref('notifMessages')")}
                ${settingsToggleRow('users','Forum replies', 'When someone replies to your posts', appPrefs.notifForumReplies, "toggleNotifPref('notifForumReplies')")}
                ${settingsToggleRow('mail','Email notifications', 'Receive updates via email', appPrefs.notifEmail, "toggleNotifPref('notifEmail')")}
              `)}
              ${settingsSection('Preferences', `
                ${settingsToggleRow('theme','Theme', appPrefs.theme === 'dark' ? 'Dark mode' : 'Light mode', appPrefs.theme === 'dark', "toggleTheme()")}
              `)}
              ${settingsSection('Support', `
                ${settingsRow('help','Help Center', 'FAQs and guides', "openOverlay('helpCenter')")}
                ${settingsRow('flag','Report an Issue', 'Bugs, safety, or content', "openOverlay('reportIssue')")}
                ${settingsRow('phone','Contact Us', 'Get in touch · support.stitch.io@gmail.com', "openOverlay('contactUs')")}
              `)}
              ${settingsSection('Data &amp; Privacy', `
                ${settingsRow('download','Download my data', 'Export all your Stitch data', "exportUserData()", false, false, 'downloadDataRow')}
                ${settingsRow('shield','Privacy Policy', null, "openOverlay('privacyPolicy')")}
                ${settingsRow('doc','Terms of Use', null, "openOverlay('termsOfService')")}
              `)}
              ${settingsSection('Account', `
                ${settingsRow('logout','Sign Out', null, "authSignOut()", false, true)}
              `)}
              ${dangerZoneSection(`
                ${settingsRow('trash','Delete Account', 'Permanently remove your account and all data', "authDeleteAccount()", true, true)}
              `)}
              </div>
            </div>`;
        }

