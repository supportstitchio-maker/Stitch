        // ---------------- INBOX (tab) ----------------
        const inboxFilters = [['general','General',0],['collaborations','Collaborations',0],['requests','Requests',3]];
        let selectMode = false;
        let selectedConvos = new Set();
        let inboxMenuOpen = false;
        let inboxFilterMenuOpen = false;
        let inboxViewFilter = 'all'; // 'all' | 'unread' | 'pinned'
        let inboxSearchActive = false; // whether the contact search bar is expanded into an input
        let inboxSearchQuery = '';

        function activateInboxSearch(){
          inboxSearchActive = true;
          renderInboxTab();
          const inp = document.getElementById('inbox-search-input');
          if (inp) inp.focus();
        }
        function deactivateInboxSearch(){
          inboxSearchActive = false;
          inboxSearchQuery = '';
          renderInboxTab();
        }
        function onInboxSearchInput(val){
          inboxSearchQuery = val;
          const list = document.getElementById('inbox-list');
          if (list) list.innerHTML = inboxContent();
        }

        // Opened/closed via direct DOM insertion rather than a full
        // renderInboxTab() re-render; re-rendering restarts the header's
        // slide/fade transition on the filter and compose (pen) icons,
        // which looked like a "shake" every time the menu was toggled.
        function toggleInboxFilterMenu(){
          if (inboxFilterMenuOpen) {
            closeInboxFilterMenuDom();
          } else {
            openInboxFilterMenuDom();
          }
        }

        function openInboxFilterMenuDom(){
          closeInboxFilterMenuDom();
          inboxFilterMenuOpen = true;
          const row = document.getElementById('inbox-titlebar-row');
          if (!row) return;

          const backdrop = document.createElement('div');
          backdrop.id = 'inbox-filter-backdrop';
          backdrop.className = 'fixed inset-0 z-10';
          backdrop.onclick = closeInboxFilterMenuDom;
          backdrop.onwheel = closeInboxFilterMenuDom;
          backdrop.addEventListener('touchmove', closeInboxFilterMenuDom, { passive: true });
          row.appendChild(backdrop);

          const wrap = document.createElement('div');
          wrap.innerHTML = inboxFilterMenuHTML();
          row.appendChild(wrap.firstElementChild);
          requestAnimationFrame(positionInboxFilterDropdown);

          // Close the dropdown if the user scrolls the inbox list while it's
          // open, same as tapping the backdrop would. Armed after a short
          // delay so the open action itself doesn't immediately close it.
          const screenEl = document.getElementById('screen');
          if (screenEl) {
            const anchor = screenEl.scrollTop;
            let armed = false;
            setTimeout(() => { armed = true; }, 300);
            const onScroll = () => {
              if (armed && Math.abs(screenEl.scrollTop - anchor) > 4) {
                closeInboxFilterMenuDom();
              }
            };
            screenEl.addEventListener('scroll', onScroll, { passive: true });
            screenEl._inboxFilterScrollCloser = onScroll;
          }
        }

        function positionInboxFilterDropdown(){
          const btn = document.getElementById('inbox-filter-btn');
          const dropdown = document.getElementById('inbox-filter-dropdown');
          const row = document.getElementById('inbox-titlebar-row');
          if (!btn || !dropdown || !row) return;
          const btnRect = btn.getBoundingClientRect();
          const rowRect = row.getBoundingClientRect();
          dropdown.style.left = (btnRect.left - rowRect.left) + 'px';
          dropdown.style.top = (btnRect.bottom - rowRect.top + 8) + 'px';
        }

        function closeInboxFilterMenuDom(){
          inboxFilterMenuOpen = false;
          const dropdown = document.getElementById('inbox-filter-dropdown');
          const backdrop = document.getElementById('inbox-filter-backdrop');
          if (dropdown) dropdown.remove();
          if (backdrop) backdrop.remove();
          const screenEl = document.getElementById('screen');
          if (screenEl && screenEl._inboxFilterScrollCloser) {
            screenEl.removeEventListener('scroll', screenEl._inboxFilterScrollCloser);
            screenEl._inboxFilterScrollCloser = null;
          }
        }

        function setInboxViewFilter(val){
          inboxViewFilter = val;
          closeInboxFilterMenuDom();
          const listEl = document.getElementById('inbox-list');
          if (listEl) listEl.innerHTML = inboxContent();
        }
        function inboxFilterMenuHTML(){
          const opts = [['all','All messages'],['unread','Unread only'],['pinned','Pinned']];
          return `
            <div id="inbox-filter-dropdown" class="absolute bg-white rounded-2xl border border-gray-100 py-1.5 z-20 w-max menu-dropdown-inset" style="left:1.25rem;top:3.5rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              ${opts.map(([val,label]) => `
                <button onclick="setInboxViewFilter('${val}')" class="w-full flex items-center gap-5 px-3.5 py-2 text-sm whitespace-nowrap menu-item-pill ${inboxViewFilter===val ? `text-[${NAVY}] font-semibold` : 'text-gray-700'}">
                  <span>${label}</span>
                </button>`).join('')}
            </div>`;
        }

        // Conversation data, split by filter, so items can be pinned, marked
        // read, blocked, or deleted from the shared actions menu.
        const primaryConvos = [];
        const requestConvos = [];
        const collabConvos = [];

        // Shared avatar renderer for messaging: whenever a contact/convo
        // has a real profile photo (set via Edit Profile -> profileData.photo,
        // synced to the "photo" column on PUBLIC_PROFILES_TABLE and carried
        // along on the convo/convoMeta object as `.photo`), show that photo
        // instead of the generic icon+color placeholder. Falls back to the
        // icon placeholder for group chats or contacts with no photo set.
        // Every avatar circle in messaging (inbox rows, contact pickers,
        // chat header, message bubbles, call screen) should go through
        // this instead of calling Icon(...) directly, so a user's chosen
        // profile picture actually shows up everywhere they appear.
        function avatarInnerHTML(c, iconSizeClass){
          if (c && c.photo) return `<img src="${c.photo}" class="w-full h-full object-cover">`;
          return Icon((c && c.icon) || 'user', iconSizeClass);
        }

        // Batch version of the same idea as refreshConvoAvatarFromProfile,
        // but for a whole list of contacts/members at once instead of one
        // conversation at a time. That per-conversation refresh only ever
        // patches someone's cached photo once you actually open a chat or
        // call with them -- someone you're connected with but haven't
        // messaged in a while could still show their old picture
        // everywhere else (My Contacts, a collaboration's member list)
        // indefinitely. Mutates each entry's `.photo` in place and
        // returns whether anything actually changed, so callers only pay
        // for a re-render when there's something new to show.
        async function refreshPhotosFromProfiles(entries){
          const sb = getSupabaseClient();
          if (!sb) return false;
          const ids = [...new Set(entries.filter(e => e.otherUserId).map(e => e.otherUserId))];
          if (!ids.length) return false;
          try {
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id,photo').in('user_id', ids);
            if (!data) return false;
            const photoById = {};
            data.forEach(r => { photoById[r.user_id] = r.photo || null; });
            let changed = false;
            entries.forEach(e => {
              if (!e.otherUserId || !Object.prototype.hasOwnProperty.call(photoById, e.otherUserId)) return;
              const fresh = photoById[e.otherUserId];
              if (fresh !== e.photo) { e.photo = fresh; changed = true; }
            });
            return changed;
          } catch (e) { console.warn('Refreshing contact photos failed:', e); return false; }
        }

        // Refreshes every contact shown in My Contacts (both the "My
        // Network" and "General Chats" sections -- see myContactsHTML) in
        // one batch call. Called right after that overlay opens: it
        // renders instantly with whatever's cached, then quietly repaints
        // with current photos once the fetch resolves.
        async function refreshAllContactPhotos(){
          const all = convoArrays().flat();
          const changed = await refreshPhotosFromProfiles(all);
          if (!changed) return;
          all.forEach(c => { if (convoMeta[c.id]) convoMeta[c.id].photo = c.photo; });
          queueSaveUserState();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'myContacts') {
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = myContactsHTML();
          }
          if (typeof currentTab !== 'undefined' && currentTab === 3) renderInboxTab();
        }

        // convoMeta[id].photo/.username are whatever was cached the last
        // time this function ran for that contact (originally, off an
        // accepted connection request -- see loadIncomingConnectionRequests/
        // loadMyAcceptedOutgoingRequests). That cache used to only get
        // filled in when it was completely empty (`|| meta.photo` short-
        // circuited the fetch the moment ANY photo existed), so a contact
        // who later changed their profile picture stayed stuck on their
        // old photo everywhere they'd already been cached -- chat header,
        // call screen, inbox row -- forever, since nothing ever asked
        // public_profiles again once a photo was present. Now it always
        // re-checks the *current* photo AND username every time a
        // conversation/call for that contact is opened, and only touches
        // state/re-renders when a fetched value actually differs from
        // what's cached. username matters here for the same reason: the
        // chat header and call screen are meant to always show
        // @username (see convoDisplayName) rather than the person's real
        // name, but any contact connected before that field started
        // being saved -- or whose convoMeta was set from a code path
        // that only had their name -- was left with username: '' forever,
        // silently falling back to showing their name instead. This is
        // what backfills it, the same way a changed photo self-heals.
        async function refreshConvoAvatarFromProfile(convoId){
          const meta = convoMeta[convoId];
          if (!meta || !meta.otherUserId) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data: row } = await sb.from(PUBLIC_PROFILES_TABLE).select('photo,username').eq('user_id', meta.otherUserId).maybeSingle();
            const freshPhoto = (row && row.photo) || null;
            const freshUsername = (row && row.username) || '';
            const photoChanged = freshPhoto !== meta.photo;
            const usernameChanged = freshUsername && freshUsername !== meta.username;
            if (!photoChanged && !usernameChanged) return; // already up to date, nothing to repaint
            if (!convoMeta[convoId]) return; // conversation is gone by the time this resolved
            convoMeta[convoId].photo = freshPhoto;
            if (usernameChanged) convoMeta[convoId].username = freshUsername;
            const entry = convoArrays().flat().find(c => c.id === convoId);
            if (entry) {
              entry.photo = freshPhoto;
              if (usernameChanged) entry.username = freshUsername;
            }
            queueSaveUserState();
            // Chat header, if this conversation is the one currently open.
            if (activeConvoId === convoId) {
              const headerAvatar = document.getElementById('chat-header-avatar');
              if (headerAvatar) headerAvatar.innerHTML = avatarInnerHTML(convoMeta[convoId], 'w-5 h-5');
              const headerName = document.getElementById('chat-header-name');
              if (headerName) headerName.textContent = convoDisplayName(convoMeta[convoId]);
            }
            // Call screen's avatar/video stage, if this is the live call.
            if (callState.convoId === convoId) {
              const stageWrap = document.getElementById('call-stage-wrap');
              if (stageWrap) stageWrap.innerHTML = callStageHTML();
            }
            const inboxList = document.getElementById('inbox-list');
            if (inboxList) inboxList.innerHTML = inboxContent();
          } catch (e) { /* best-effort -- keep showing the fallback icon */ }
        }

        function newMessageContactRow(icon, iconBg, label, onclick, sub, extraIconRight){
          return `
            <button onclick="${onclick}" class="w-full flex items-center gap-3 py-3 text-left">
              <div class="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0" style="${iconBg}">${Icon(icon,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] font-semibold text-gray-900">${label}</div>
                ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
              </div>
              ${extraIconRight ? `<div class="flex-shrink-0 text-gray-400">${Icon(extraIconRight,'w-5 h-5')}</div>` : ''}
            </button>`;
        }

        // "My Contacts" screen: splits contacts into the people who are part
        // of the user's professional network vs. everyone else the user just
        // chats/collaborates with (general chats & group networks).
        function contactListRow(c){
          return `
            <button onclick="closeOverlay(); startNewMessageWith('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
              <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForConvo('${c.id}')">${avatarInnerHTML(c,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                ${c.preview ? `<div class="text-xs text-gray-400 mt-0.5 truncate">${c.preview}</div>` : ''}
              </div>
            </button>`;
        }

        function myContactsHTML(){
          const all = convoArrays().flat();
          const networkContacts = all.filter(c => c.network && c.icon !== 'users');
          const generalContacts = all.filter(c => !c.network || c.icon === 'users');
          return `
            ${overlayHeader('My Contacts', '20px')}
            <div class="flex-1 overflow-y-auto px-5 pb-6">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1">My Network</div>
              <div class="divide-y divide-gray-100 border-b border-gray-100 pb-2 mb-2">
                ${networkContacts.length ? networkContacts.map(contactListRow).join('') : `<div class="py-6 text-center text-gray-400 text-sm">No network connections yet.</div>`}
              </div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1">General Chats &amp; Networks</div>
              <div class="divide-y divide-gray-100">
                ${generalContacts.length ? generalContacts.map(contactListRow).join('') : `<div class="py-6 text-center text-gray-400 text-sm">No other chats yet.</div>`}
              </div>
            </div>`;
        }

        function newMessageContactList(){
          const q = newMessageSearchQuery.trim().toLowerCase();
          const contacts = convoArrays().flat().filter(c => c.icon !== 'users');
          const filtered = q ? contacts.filter(c => c.name.toLowerCase().includes(q)) : contacts;
          if (!filtered.length) return `<div class="py-8 text-center text-gray-400 text-sm">No contacts found${q ? ` for "${newMessageSearchQuery}"` : ''}.</div>`;
          return filtered.map(c => `
              <button onclick="startNewMessageWith('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
                <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden" onclick="event.stopPropagation(); openPersonProfileForConvo('${c.id}')">${avatarInnerHTML(c,'w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                  ${c.preview ? `<div class="text-xs text-gray-400 mt-0.5 truncate">${c.preview}</div>` : ''}
                </div>
              </button>`).join('');
        }

        // Search bar on the Select Contact screen: tapping the search icon
        // expands it into a text input that filters the contact list below
        // live, by name.
        let newMessageSearchActive = false;
        let newMessageSearchQuery = '';

        function activateNewMessageSearch(){
          newMessageSearchActive = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = newMessageHTML();
          const inp = document.getElementById('new-message-search-input');
          if (inp) inp.focus();
        }
        function deactivateNewMessageSearch(){
          newMessageSearchActive = false;
          newMessageSearchQuery = '';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = newMessageHTML();
        }
        function onNewMessageSearchInput(val){
          newMessageSearchQuery = val;
          const list = document.getElementById('new-message-contacts-list');
          if (list) list.innerHTML = newMessageContactList();
        }

        function startNewMessageWith(id){
          openConversation(id);
        }

        // ---- New collaboration flow: select contacts, then name it ----
        let newCollabStep = 'select'; // 'select' | 'name'
        let newCollabSelected = new Set();
        let newCollabName = '';

        function openNewCollaboration(){
          newCollabStep = 'select';
          newCollabSelected = new Set();
          newCollabName = '';
          openOverlay('newCollaboration');
        }

        function newCollaborationHTML(){
          return newCollabStep === 'name' ? newCollabNameHTML() : newCollabSelectHTML();
        }

        // Returns the person's contacts as candidates for a collaboration.
        // Each row from convoArrays() is just the lightweight inbox-list
        // entry (id/icon/name/preview/...) -- the real otherUserId that
        // Supabase needs to actually add them as a member lives on
        // convoMeta[c.id], not on the row itself. Previously this returned
        // the raw rows with no otherUserId at all, so every contact you
        // picked here came out as otherUserId: null in createNewCollaboration/
        // confirmAddCollabMembers -- collabCreateRemote/collabAddMembersRemote
        // both skip inserting a collaboration_members row for anyone
        // without an otherUserId, so the person you added never actually
        // got added on the backend and it never showed up in their inbox.
        function newCollabContactSource(){
          return convoArrays().flat().filter(c => c.icon !== 'users').map(c => ({ ...c, otherUserId: (convoMeta[c.id] && convoMeta[c.id].otherUserId) || null }));
        }

        function toggleNewCollabContact(id){
          if (newCollabSelected.has(id)) newCollabSelected.delete(id); else newCollabSelected.add(id);
          openOverlay('newCollaboration');
        }

        function newCollabSelectHTML(){
          const contacts = newCollabContactSource();
          const count = newCollabSelected.size;
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:20px;">
              <div class="flex items-center gap-4">
                <button onclick="openOverlay('newMessage')" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-lg font-display truncate grad-text">New collaboration</div>
                  <div class="text-xs text-gray-400">${count ? count + ' selected' : 'Select contacts to add'}</div>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5" style="position:relative;">
              <div class="divide-y divide-gray-100 pb-24">
                ${contacts.map(c => `
                  <button onclick="toggleNewCollabContact('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
                    <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                    </div>
                    <div class="w-5 h-5 rounded-full border-2 ${newCollabSelected.has(c.id) ? `bg-gradient-to-br from-[${ROYAL}] to-[${NAVY}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${newCollabSelected.has(c.id) ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>
                  </button>`).join('')}
              </div>
            </div>
            ${count ? `
              <button onclick="proceedToNewCollabName()" class="flex items-center justify-center gap-2 text-white rounded-full py-3.5 text-base font-bold shadow-lg" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:rgba(30,144,255,0.5);width:100px;">
                Next
              </button>
            ` : ''}`;
        }

        function proceedToNewCollabName(){
          if (!newCollabSelected.size) return;
          newCollabStep = 'name';
          openOverlay('newCollaboration');
        }

        function backToNewCollabSelect(){
          const input = document.getElementById('new-collab-name-input');
          if (input) newCollabName = input.value;
          newCollabStep = 'select';
          openOverlay('newCollaboration');
        }

        function newCollabNameHTML(){
          const contacts = newCollabContactSource().filter(c => newCollabSelected.has(c.id));
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100 flex items-center gap-4" style="padding-top:20px;">
              <button onclick="backToNewCollabSelect()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <div class="font-semibold text-lg font-display truncate grad-text">New collaboration</div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-5" style="padding-bottom:6rem;">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">${Icon('users','w-6 h-6')}</div>
                <input id="new-collab-name-input" type="text" placeholder="Collaboration name (optional)" value="${newCollabName.replace(/"/g,'&quot;')}" class="flex-1 min-w-0 border-b-2 border-[${ROYAL}] py-2 text-[15px]" style="outline:none;">
              </div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3">Members: ${contacts.length}</div>
              <div class="flex flex-wrap gap-4">
                ${contacts.map(c => `
                  <div class="flex flex-col items-center gap-1 w-16">
                    <div class="w-12 h-12 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                    <div class="text-[11px] text-gray-600 text-center truncate w-full">${escapeHtml(c.name)}</div>
                  </div>`).join('')}
              </div>
            </div>
            <button onclick="createNewCollaboration()" class="flex items-center justify-center gap-2 text-white rounded-full py-3.5 text-base font-bold shadow-lg" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:rgba(30,144,255,0.5);width:100px;">
              Create
            </button>`;
        }

        async function createNewCollaboration(){
          const input = document.getElementById('new-collab-name-input');
          const typedName = input ? input.value.trim() : '';
          const contacts = newCollabContactSource().filter(c => newCollabSelected.has(c.id));
          const finalName = typedName || contacts.map(c => c.name).slice(0,3).join(', ');
          const id = 'c' + Date.now();
          const myMember = {
            otherUserId: null, name: (typeof profileData !== 'undefined' && profileData.name) || 'You',
            avatarBg: 'bg-blue-100', icon: 'user', photo: (typeof profileData !== 'undefined' && profileData.photo) || null, mine: true,
          };
          const members = [myMember, ...contacts.map(c => ({ otherUserId: c.otherUserId || null, name: c.name, avatarBg: c.avatarBg, icon: c.icon, photo: c.photo || null, mine: false }))];
          const newConvo = { id, icon:'users', avatarBg:'bg-emerald-100', name: finalName, preview:'You created this collaboration', time: formatRequestTime(Date.now()), unread:false };
          collabConvos.unshift(newConvo);
          convoMeta[id] = { icon:'users', avatarBg:'bg-emerald-100', name: finalName, preview:'You created this collaboration', members, createdBy: 'me' };
          conversationMessages[id] = [{ from:'them', text: `You created "${finalName}" with ${contacts.map(c => c.name).join(', ')}.`, time: Date.now() }];
          queueSaveUserState();
          inboxFilter = 'collaborations';
          inboxViewFilter = 'all';
          closeOverlay();
          renderInboxTab();
          openConversation(id);
          // Syncs the collaboration + its members to Supabase so everyone
          // added actually sees it appear in their own inbox (see
          // loadMyCollaborations/subscribeToCollabMembership) instead of
          // it only existing on this device.
          const createdRemotely = await collabCreateRemote(id, finalName, null, contacts);
          if (createdRemotely && convoMeta[id]) {
            convoMeta[id].createdBy = _cachedAuthUser && _cachedAuthUser.id;
          } else if (!createdRemotely && contacts.length) {
            // collabCreateRemote failed silently (offline, or -- most
            // commonly -- the collaborations/collaboration_members tables
            // aren't set up in Supabase yet, see the setup comment above
            // collabCreateRemote). Without this, the collaboration looks
            // fine here but nobody else ever gets added on the backend,
            // so it never shows up on their end -- exactly the "stuck on
            // my phone" symptom, with no clue why. Surface it instead of
            // failing silently.
            pushInAppNotification('Collaboration not synced', `"${finalName}" was created on this device only -- the others won't see it until this syncs. Check your connection or Supabase setup.`);
          }
        }

        // ---- Collaboration members: view / add / remove, still usable
        // after the collaboration has been created (previously the only
        // way to set members was at creation time, with no way to see who
        // was in it or change the list afterwards). ----
        function isMe(userId){
          return !!userId && typeof _cachedAuthUser !== 'undefined' && !!_cachedAuthUser && _cachedAuthUser.id === userId;
        }

        function openCollabMembers(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = collabMembersHTML();
        }

        function collabMembersHTML(){
          const id = activeConvoId;
          const meta = convoMeta[id] || {};
          const members = meta.members || [];
          const iAmCreator = isMe(meta.createdBy) || meta.createdBy === 'me';
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="px-5 pb-3 flex items-center gap-4">
                <button onclick="closeConvoProfile()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display grad-text">Members (${members.length})</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-5">
              <button onclick="openAddCollabMembers()" class="w-full flex items-center gap-3 py-3 text-left mb-2">
                <div class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:${ROYAL};">${Icon('plus','w-5 h-5')}</div>
                <div class="text-[15px] font-semibold" style="color:${ROYAL};">Add members</div>
              </button>
              <div class="rounded-2xl border border-gray-100 divide-y bg-white shadow-sm px-4">
                ${members.map(m => `
                  <div class="flex items-center gap-3 py-3">
                    <div class="w-11 h-11 rounded-full ${m.avatarBg || 'bg-gray-100'} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(m,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(m.name)}${m.mine ? ' (You)' : ''}</div>
                      ${isMe(meta.createdBy) && m.otherUserId === meta.createdBy ? `<div class="text-xs text-gray-400 mt-0.5">Creator</div>` : ''}
                    </div>
                    ${(!m.mine && (iAmCreator || meta.createdBy === undefined)) ? `
                      <button onclick="removeCollabMemberTap('${m.otherUserId || ''}','${escapeHtml(m.name).replace(/'/g,"\\'")}')" class="p-2 text-red-500 flex-shrink-0" title="Remove">${Icon('close','w-4 h-4')}</button>
                    ` : ''}
                  </div>`).join('')}
              </div>
            </div>`;
        }

        // ---- Add members to an existing collaboration ----
        let addCollabSelected = new Set();

        function openAddCollabMembers(){
          addCollabSelected = new Set();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = addCollabMembersHTML();
        }

        function toggleAddCollabContact(cid){
          if (addCollabSelected.has(cid)) addCollabSelected.delete(cid); else addCollabSelected.add(cid);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = addCollabMembersHTML();
        }

        function addCollabMembersHTML(){
          const meta = convoMeta[activeConvoId] || {};
          const existingIds = new Set((meta.members || []).map(m => m.otherUserId).filter(Boolean));
          const contacts = newCollabContactSource().filter(c => !existingIds.has(c.otherUserId));
          const count = addCollabSelected.size;
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:20px;">
              <div class="flex items-center gap-4">
                <button onclick="openCollabMembers()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-lg font-display truncate grad-text">Add members</div>
                  <div class="text-xs text-gray-400">${count ? count + ' selected' : 'Select contacts to add'}</div>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5" style="position:relative;">
              <div class="divide-y divide-gray-100 pb-24">
                ${contacts.length ? contacts.map(c => `
                  <button onclick="toggleAddCollabContact('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
                    <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                    </div>
                    <div class="w-5 h-5 rounded-full border-2 ${addCollabSelected.has(c.id) ? `bg-gradient-to-br from-[${ROYAL}] to-[${NAVY}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${addCollabSelected.has(c.id) ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>
                  </button>`).join('') : `<div class="text-center text-gray-400 text-sm py-8">Everyone in your contacts is already a member.</div>`}
              </div>
            </div>
            ${count ? `
              <button onclick="confirmAddCollabMembers()" class="flex items-center justify-center gap-2 text-white rounded-full py-3.5 text-base font-bold shadow-lg" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:rgba(30,144,255,0.5);width:100px;">
                Add
              </button>
            ` : ''}`;
        }

        async function confirmAddCollabMembers(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          const newContacts = newCollabContactSource().filter(c => addCollabSelected.has(c.id));
          if (!newContacts.length) return;
          meta.members = (meta.members || []).concat(newContacts.map(c => ({ otherUserId: c.otherUserId || null, name: c.name, avatarBg: c.avatarBg, icon: c.icon, photo: c.photo || null, mine: false })));
          queueSaveUserState();
          openCollabMembers();
          collabAddMembersRemote(id, meta.name, newContacts).then(ok => {
            if (!ok) pushInAppNotification('Members not synced', `The people you just added won't see "${meta.name}" until this syncs. Check your connection or Supabase setup.`);
          });
        }

        function removeCollabMemberTap(userId, name){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          openAppConfirmModal(`Remove ${name}?`, `Remove ${name} from this collaboration?`, 'Remove', function(){
            meta.members = (meta.members || []).filter(m => m.otherUserId !== userId);
            queueSaveUserState();
            openCollabMembers();
            if (userId) collabRemoveMemberRemote(id, userId);
          });
        }

        // ---- Leave / delete a collaboration. Leaving just removes your
        // own membership (and it stays visible to everyone else); the
        // creator can also delete it outright for everyone. ----
        function leaveCollaboration(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          openAppConfirmModal(`Leave "${meta.name}"?`, "You'll no longer see this collaboration's messages, but it stays visible to everyone else.", 'Leave', function(){
            const myId = typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser ? _cachedAuthUser.id : null;
            if (myId) collabRemoveMemberRemote(id, myId);
            performDeleteConvoChat(id);
          });
        }

        function deleteCollaboration(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          openAppConfirmModal(`Delete "${meta.name}"?`, "This deletes it for everyone. This can't be undone.", 'Delete', function(){
            collabDeleteRemote(id);
            performDeleteConvoChat(id);
          });
        }

        // ---- Collaboration profile picture ----
        function triggerCollabPhotoUpload(){
          let input = document.getElementById('collab-photo-input');
          if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.id = 'collab-photo-input';
            input.className = 'hidden';
            input.onchange = handleCollabPhotoSelected;
            document.body.appendChild(input);
          }
          input.click();
        }

        function handleCollabPhotoSelected(e){
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev){
            const img = new Image();
            img.onload = function(){
              // Downscale to a modest square thumbnail before storing --
              // matches the resolution profile photos are saved at, keeps
              // the data URL small since it's cached in local user state.
              const size = 320;
              const canvas = document.createElement('canvas');
              canvas.width = size; canvas.height = size;
              const ctx = canvas.getContext('2d');
              const side = Math.min(img.width, img.height);
              ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              const id = activeConvoId;
              const meta = convoMeta[id];
              if (!meta) return;
              meta.photo = dataUrl;
              const entry = collabConvos.find(c => c.id === id);
              if (entry) entry.photo = dataUrl;
              queueSaveUserState();
              renderConvoProfile();
              if (currentTab === 3) renderInboxTab();
              collabUpdatePhotoRemote(id, dataUrl);
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }

        // ---- Rename a collaboration after it's already been created --
        // previously the name could only ever be set once, at creation
        // time (see createNewCollaboration), with no way to change it
        // afterwards. Mirrors handleCollabPhotoSelected above: update
        // local state + inbox row + chat header right away, then sync
        // the rename to Supabase so everyone else's copy picks it up
        // too (see loadMyCollaborations/subscribeToCollabMembership).
        function renameCollaboration(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!meta) return;
          const typed = prompt('Rename collaboration:', meta.name || '');
          if (typed === null) return; // cancelled
          const newName = typed.trim();
          if (!newName || newName === meta.name) return;
          meta.name = newName;
          const entry = collabConvos.find(c => c.id === id);
          if (entry) entry.name = newName;
          queueSaveUserState();
          renderConvoProfile();
          const headerName = document.getElementById('chat-header-name');
          if (headerName) headerName.textContent = convoDisplayName(meta);
          if (currentTab === 3) renderInboxTab();
          collabUpdateNameRemote(id, newName);
        }

        function newMessageHTML(){
          const contactCount = convoArrays().flat().filter(c => c.icon !== 'users').length;
          const gradientBg = `background:rgba(10,37,64,0.5);`;
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:20px;">
              ${newMessageSearchActive ? `
                <div class="flex items-center gap-3">
                  <button onclick="deactivateNewMessageSearch()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <div class="flex-1 flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm">
                    ${Icon('search','w-4 h-4')}
                    <input id="new-message-search-input" type="text" value="${newMessageSearchQuery}" oninput="onNewMessageSearchInput(this.value)" placeholder="Search contacts..." class="flex-1 min-w-0 bg-transparent outline-none text-gray-800" autocomplete="off">
                  </div>
                </div>
              ` : `
                <div class="flex items-center gap-4">
                  <button onclick="closeOverlay()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-lg font-display truncate grad-text">Select contact</div>
                    <div class="text-xs text-gray-400">${contactCount} contacts</div>
                  </div>
                  <button onclick="activateNewMessageSearch()" class="flex-shrink-0">${gradIcon(Icon('search','w-5 h-5'))}</button>
                  <button onclick="openOverlay('profileQR')" title="Invite via link" class="flex-shrink-0">${gradIcon(IconBold('dashes','w-5 h-5'))}</button>
                </div>
              `}
            </div>
            <div class="flex-1 overflow-y-auto px-5">
              <div class="divide-y divide-gray-100 border-b border-gray-100 pb-2 mb-2">
                ${newMessageContactRow('users', gradientBg, 'New collaboration', "openNewCollaboration()", 'Work on something together')}
              </div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1">Contacts on Stitch</div>
              <div class="divide-y divide-gray-100 pb-6" id="new-message-contacts-list">
                ${newMessageContactList()}
              </div>
            </div>`;
        }

        function inboxTitlebarRowHTML(){
          return `
            <div id="inbox-titlebar-row" class="relative flex items-center justify-between">
              ${selectMode ? `
                <button onclick="cancelInboxSelect()" class="text-sm font-semibold text-gray-600">Cancel</button>
                <div class="text-sm font-semibold grad-text">${selectedConvos.size} selected</div>
                <button onclick="toggleInboxActionsMenu()" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('dashes','w-6 h-6'))}</button>
              ` : `
                <button id="inbox-filter-btn" onclick="toggleInboxFilterMenu()" class="w-10 h-10 flex items-center justify-center flex-shrink-0" title="Filter">${gradIcon(IconBold('filter','w-5 h-5'))}</button>
                <span class="font-bold text-base font-display grad-text">${escapeHtml(profileData.username)}</span>
                <div id="inbox-icons-group" class="flex items-center gap-4">
                  <button onclick="openOverlay('newMessage')">${gradIcon(Icon('edit','w-6 h-6'))}</button>
                </div>
              `}
            </div>`;
        }

        function renderInboxTab(){
          // Remember where the user was scrolled to before we rebuild the
          // screen's contents, so an in-place action (accepting/declining a
          // request, selecting a chat, changing the filter, etc.) doesn't
          // yank the view back up to the top.
          const prevInboxScreenEl = document.getElementById('screen');
          const prevInboxScrollTop = prevInboxScreenEl ? prevInboxScreenEl.scrollTop : 0;
          document.getElementById('screen').innerHTML = `
            <div id="inbox-titlebar" class="sticky top-0 z-20 px-5 pb-3 border-b border-gray-100" style="padding-top:20px;background:#f9fafb;">
              ${inboxTitlebarRowHTML()}
              ${inboxMenuOpen ? `<div onclick="toggleInboxActionsMenu()" onwheel="toggleInboxActionsMenu()" ontouchmove="toggleInboxActionsMenu()" class="fixed inset-0 z-10"></div>${notifActionsDropdownHTML('handleInboxAction')}` : ''}
            </div>
            <div id="inbox-searchbar" class="sticky z-10 bg-gray-50 px-5 pt-4" style="padding-bottom:8px;">
              ${inboxSearchActive ? `
                <div class="w-full flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm">
                  ${Icon('search','w-4 h-4')}
                  <input id="inbox-search-input" type="text" value="${inboxSearchQuery}" oninput="onInboxSearchInput(this.value)" placeholder="Search contacts..." class="flex-1 min-w-0 bg-transparent outline-none text-gray-800" autocomplete="off">
                  <button onclick="deactivateInboxSearch()" class="text-xs font-semibold flex-shrink-0" style="color:${NAVY};">Cancel</button>
                </div>
              ` : `
                <button onclick="activateInboxSearch()" class="w-full flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm text-left">
                  ${Icon('search','w-4 h-4')}<span>Search contacts...</span>
                </button>
              `}
            </div>
            <div id="inbox-filterbar" class="sticky z-10 bg-gray-50 px-5 pb-3 border-b border-gray-100">
              <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                ${inboxFilters.map(([key,label,count]) => {
                  const effectiveCount = key === 'requests' ? requestConvos.length : key === 'collaborations' ? collabConvos.filter(c=>c.unread).length : key === 'general' ? unreadMessageCount() : count;
                  return `
                  <button onclick="inboxFilterTab('${key}')" class="flex-shrink-0 flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold ${inboxFilter===key ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${inboxFilter===key ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">
                    ${label}${effectiveCount ? `<span class="w-4 h-4 rounded-full ${inboxFilter===key?`bg-[${NAVY}] text-white`:'bg-red-500 text-white'} text-[9px] flex items-center justify-center">${effectiveCount}</span>` : ''}
                  </button>
                `;}).join('')}
              </div>
            </div>
            <div class="divide-y" id="inbox-list">${inboxContent()}</div>`;
          stickBarsStack(['inbox-titlebar','inbox-searchbar','inbox-filterbar']);
          if (prevInboxScrollTop) {
            const restoredScreenEl = document.getElementById('screen');
            if (restoredScreenEl) {
              restoredScreenEl.scrollTop = prevInboxScrollTop;
            }
          }
          // Close the actions dropdown if the user scrolls the list while
          // it's open, same as tapping the backdrop would.
          if (inboxMenuOpen) {
            const screenEl = document.getElementById('screen');
            if (screenEl) {
              const anchor = screenEl.scrollTop;
              let armed = false;
              setTimeout(() => { armed = true; }, 300);
              const onScroll = () => {
                if (armed && Math.abs(screenEl.scrollTop - anchor) > 4) {
                  screenEl.removeEventListener('scroll', onScroll);
                  if (inboxMenuOpen) toggleInboxActionsMenu();
                }
              };
              screenEl.addEventListener('scroll', onScroll, { passive: true });
            }
          }
        }

        function cancelInboxSelect(){
          selectMode = false;
          selectedConvos.clear();
          renderInboxTab();
        }

        function toggleInboxActionsMenu(){
          inboxMenuOpen = !inboxMenuOpen;
          renderInboxTab();
        }

        function convoLongPressSelect(id){
          selectMode = true;
          selectedConvos.add(id);
          renderInboxTab();
        }
        function convoTap(id){
          if (selectMode){
            if (selectedConvos.has(id)) selectedConvos.delete(id); else selectedConvos.add(id);
            renderInboxTab();
          } else {
            openConversation(id);
          }
        }

        function convoArrays(){ return [primaryConvos, requestConvos, collabConvos]; }

        // The number shown as "My Network" on the profile (and the Job
        // Plan stats panel). This used to be computed purely from local
        // convoArrays (a device's own in-memory list of connections),
        // which sounds live but isn't really synced -- convoArrays only
        // gets persisted as a whole-blob overwrite (see queueSaveUserState/
        // ensureUserStateLoaded in core.js), so two devices that haven't
        // replayed the exact same sequence of accept/connect actions can
        // show different numbers, and whichever device saves last simply
        // clobbers the other's count. That's what was happening here.
        //
        // Now it's asked straight from Supabase (same accepted-either-
        // direction query Discover already uses to hide people you're
        // connected to -- see loadDiscoverPeople in overlays.js), which is
        // the actual source of truth every device shares. cachedNetworkCount
        // holds the last real answer; refreshNetworkCount() below re-fetches
        // it at the same points connection data elsewhere gets refreshed
        // (app entry, opening Messaging, right after an accept/decline).
        //
        // Falling back to the old per-device local count used to apply any
        // time cachedNetworkCount was null -- which included not just "the
        // very first paint" as intended, but *forever* whenever a single
        // refreshNetworkCount() call happened to fail (flaky connection, a
        // request that lost the race in Promise.all, etc.), since nothing
        // ever retried it. That's exactly how two devices ended up
        // permanently disagreeing: one device's fetch failed once, silently
        // kept showing its own stale local tally, and never got another
        // chance to correct itself. Now a failed fetch schedules its own
        // retry (backing off if it keeps failing) instead of giving up
        // silently, and the local number is only ever shown for the first
        // couple of seconds after app open -- past that it shows a loading
        // placeholder rather than a number that might be wrong, the same
        // way another person's profile already does while its count loads
        // (see the "p.networkLoaded" placeholder in overlays.js).
        let cachedNetworkCount = null;
        let networkCountRequestSeq = 0;
        let networkCountFirstAttemptAt = null;
        let networkCountRetryTimer = null;
        function networkConnectionCount(){
          if (cachedNetworkCount !== null) return cachedNetworkCount;
          if (networkCountFirstAttemptAt && (Date.now() - networkCountFirstAttemptAt) < 2500) {
            return convoArrays().flat().filter(c => c.network && c.icon !== 'users').length;
          }
          return '\u00b7\u00b7\u00b7';
        }

        async function refreshNetworkCount(retryDelayMs){
          const sb = getSupabaseClient();
          if (!sb) return;
          if (!networkCountFirstAttemptAt) networkCountFirstAttemptAt = Date.now();
          if (networkCountRetryTimer) { clearTimeout(networkCountRetryTimer); networkCountRetryTimer = null; }
          const mySeq = ++networkCountRequestSeq;
          const scheduleRetry = () => {
            const delay = Math.min(retryDelayMs ? retryDelayMs * 2 : 3000, 30000);
            networkCountRetryTimer = setTimeout(() => refreshNetworkCount(delay), delay);
          };
          try {
            const me = await getCachedAuthUser();
            if (!me) { scheduleRetry(); return; }
            const [{ data: fromRows, error: fromErr }, { data: toRows, error: toErr }] = await Promise.all([
              sb.from(CONNECTION_REQUESTS_TABLE).select('to_user').eq('from_user', me.id).eq('status', 'accepted'),
              sb.from(CONNECTION_REQUESTS_TABLE).select('from_user').eq('to_user', me.id).eq('status', 'accepted'),
            ]);
            // A newer refreshNetworkCount() call was kicked off while this
            // one was still in flight -- its answer is more current, so
            // drop this stale one instead of clobbering it.
            if (mySeq !== networkCountRequestSeq) return;
            if (fromErr || toErr) { console.warn('Refreshing network count failed:', fromErr || toErr); scheduleRetry(); return; }
            const ids = new Set([
              ...(fromRows || []).map(r => r.to_user),
              ...(toRows || []).map(r => r.from_user),
            ]);
            cachedNetworkCount = ids.size;
            // Re-paint whichever visible screen is actually showing the
            // number right now -- profile tab, or the Career Analytics
            // overlay (see careerAnalyticsHTML in jobs.js).
            if (currentTab === 4 && typeof renderProfile === 'function') renderProfile();
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'careerAnalytics' && typeof careerAnalyticsHTML === 'function') {
              const ov = document.getElementById('overlay');
              if (ov) ov.innerHTML = careerAnalyticsHTML();
            }
          } catch (e) { console.warn('Refreshing network count failed:', e); scheduleRetry(); }
        }

        // Whether a given real (Supabase) user id is someone you're
        // actually connected to -- used by the feed to decide whether a
        // post's author gets a "Connect" button (see feedPost in feed.js).
        function isUserInMyNetwork(userId){
          if (!userId) return false;
          return convoArrays().flat().some(c => c.network && c.otherUserId === userId);
        }

        function findConvoAndArray(id){
          for (const arr of convoArrays()){
            const idx = arr.findIndex(c => c.id === id);
            if (idx !== -1) return { arr, idx };
          }
          return null;
        }

        // Applies pin / mark as read / block / delete to whichever
        // conversations are currently selected in the Inbox.
        function handleInboxAction(action){
          inboxMenuOpen = false;
          if (!selectedConvos.size){
            renderInboxTab();
            openAppAlertModal('Tap and hold a conversation to select it first.');
            return;
          }
          const ids = Array.from(selectedConvos);
          if (action === 'delete'){
            ids.forEach(id => {
              const found = findConvoAndArray(id);
              if (found) found.arr.splice(found.idx, 1);
            });
          } else if (action === 'pin'){
            ids.forEach(id => {
              const found = findConvoAndArray(id);
              if (found) found.arr[found.idx].pinned = !found.arr[found.idx].pinned;
            });
            primaryConvos.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0));
            requestConvos.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0));
            collabConvos.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0));
          } else if (action === 'read'){
            ids.forEach(id => {
              const found = findConvoAndArray(id);
              if (found) found.arr[found.idx].read = true;
            });
          } else if (action === 'block'){
            const names = new Set(ids.map(id => { const f = findConvoAndArray(id); return f && f.arr[f.idx].name; }));
            names.forEach(name => { if (name) blockAccount(name); });
            convoArrays().forEach(arr => {
              for (let i = arr.length - 1; i >= 0; i--){
                if (names.has(arr[i].name)) arr.splice(i, 1);
              }
            });
          }
          selectMode = false;
          selectedConvos.clear();
          renderInboxTab();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
        }

        function inboxFilterTab(key){
          inboxFilter = key;
          inboxViewFilter = 'all';
          renderInboxTab();
        }

        function inboxContent(){
          // When the contact search bar is active, search across every
          // contact (all inbox tabs), not just whichever filter tab is
          // currently selected, so it behaves like a proper contacts search.
          if (inboxSearchActive && inboxSearchQuery.trim()){
            const q = inboxSearchQuery.trim().toLowerCase();
            const results = convoArrays().flat().filter(c => c.name.toLowerCase().includes(q));
            return results.length
              ? results.map(c => convoRow(c)).join('')
              : `<div class="bg-white p-8 text-center text-gray-400 text-sm">No contacts found for "${inboxSearchQuery}".</div>`;
          }
          const applyView = (arr) => {
            if (inboxViewFilter === 'unread') return arr.filter(c => c.unread && !c.read);
            if (inboxViewFilter === 'pinned') return arr.filter(c => c.pinned);
            return arr;
          };
          const emptyLabel = (defaultText) => inboxViewFilter === 'pinned' ? 'No pinned messages.' : defaultText;
          if (inboxFilter === 'general') {
            const list = applyView(primaryConvos);
            return list.length ? list.map(c => convoRow(c)).join('') : `<div class="bg-white p-8 text-center text-gray-400 text-sm">${emptyLabel('No messages.')}</div>`;
          }
          if (inboxFilter === 'requests') {
            const list = applyView(requestConvos);
            return list.length ? list.map(c => requestRow(c)).join('') : `<div class="bg-white p-8 text-center text-gray-400 text-sm">${emptyLabel('No requests.')}</div>`;
          }
          if (inboxFilter === 'collaborations') {
            const list = applyView(collabConvos);
            return list.length ? list.map(c => convoRow(c)).join('') : `<div class="bg-white p-8 text-center text-gray-400 text-sm">${emptyLabel('No collaborations yet.')}</div>`;
          }
          return `
            <div class="bg-white p-8 text-center text-gray-400 text-sm">${emptyLabel('No general messages.')}</div>`;
        }

        const convoMeta = {};

        // Messaging, chat, and calls should surface someone's @username
        // rather than their real full name -- falls back to name for
        // group collaborations (which don't have a single username) or
        // any older/local entry that never had one saved.
        function convoDisplayName(c){
          if (!c) return '';
          return c.username ? `@${c.username}` : (c.name || '');
        }

        function convoRow(c){
          const { id, icon, avatarBg, name, username, preview, time, photo } = c;
          if (!convoMeta[id]) convoMeta[id] = { icon, avatarBg, name, username, preview, photo };
          const isSel = selectedConvos.has(id);
          const showUnread = c.unread && !c.read;
          const isActiveChat = activeConvoId === id && document.getElementById('app-shell') && document.getElementById('app-shell').classList.contains('messaging-split');
          return `
            <div class="flex items-center gap-4 px-5 py-4 cursor-pointer ${isSel ? '' : (c.read ? 'bg-gray-50' : 'bg-white')}"
              style="${isSel ? `background:rgba(65,105,225,0.14);` : (isActiveChat ? `background:rgba(65,105,225,0.09);` : '')}"
              onmousedown="startPress('convoLongPressSelect','${id}', event)" onmouseup="endPress()" onmouseleave="endPress()"
              ontouchstart="startPress('convoLongPressSelect','${id}', event)" ontouchend="endPress()" ontouchmove="movePress(event)" ontouchcancel="endPress()"
              onclick="handleRowTap('convoTap','${id}')">
              ${selectMode ? `<div class="w-5 h-5 rounded-full border-2 ${isSel ? `bg-gradient-to-br from-[${ROYAL}] to-[${NAVY}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${isSel ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>` : ''}
              <div class="w-12 h-12 ${avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForConvo('${id}')">${avatarInnerHTML(c,'w-6 h-6')}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-sm ${showUnread ? '' : 'text-gray-700'}">${name}</div>
                  ${c.pinned ? Icon('pin','w-3.5 h-3.5 text-amber-600') : ''}
                </div>
                <div class="text-xs ${showUnread ? 'text-gray-800 font-medium' : 'text-gray-500'} truncate">${preview}</div>
              </div>
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <div class="text-[11px] text-gray-400">${time}</div>
                ${showUnread ? `<div class="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>` : ''}
              </div>
            </div>`;
        }

        // A connect request card: shows the sender, an optional attached
        // message (some requests come with a note, some don't), and
        // Accept / Reject actions. Tapping it never opens the messaging
        // screen; only Accept or Reject do anything.
        function requestRow(c){
          const { id, icon, avatarBg, name, preview, time, photo } = c;
          const avatarInner = photo ? `<img src="${photo}" class="w-full h-full object-cover">` : Icon(icon,'w-6 h-6');
          return `
            <div class="flex items-start gap-4 px-5 py-4 bg-white">
              <div class="w-12 h-12 ${avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="openPersonProfileForConvo('${id}')">${avatarInner}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-sm text-gray-700">${name}</div>
                </div>
                ${preview
                  ? `<div class="text-xs text-gray-500 mt-0.5">${preview}</div>`
                  : `<div class="text-xs text-gray-400 italic mt-0.5">Wants to connect with you</div>`}
                <div class="flex gap-2 mt-2.5">
                  <button onclick="acceptRequest('${id}')" class="px-4 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-[${NAVY}]">Accept</button>
                  <button onclick="rejectRequest('${id}')" class="px-4 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Reject</button>
                </div>
              </div>
              <div class="text-[11px] text-gray-400 flex-shrink-0">${time}</div>
            </div>`;
        }

        // Accepting moves the request into Primary as a normal conversation
        // (with whatever message they attached, if any, as the opening
        // line); rejecting just removes it. Neither opens the chat screen.
        //
        // Real incoming requests (see loadIncomingConnectionRequests below)
        // carry a connectionRequestId pointing at their row in
        // connection_requests -- accepting/rejecting those also writes the
        // new status back to Supabase, both so the row stops being fetched
        // as "pending" on next load and so the sender's own account could
        // eventually read the outcome. Locally-seeded/demo requests (if
        // any) don't have that id, so the DB write is skipped for them.
        function acceptRequest(id){
          const idx = requestConvos.findIndex(c => c.id === id);
          if (idx === -1) return;
          const [c] = requestConvos.splice(idx, 1);
          primaryConvos.unshift({ ...c, preview: c.preview || 'You are now connected', unread: true, read: false, network: true });
          queueSaveUserState();
          renderInboxTab();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
          // Instant feedback while the real count re-fetches in the
          // background (see refreshNetworkCount) -- the .then() below is
          // what actually corrects it once the accepted status has landed
          // in Supabase, so it's right even if this optimistic +1 turns
          // out to double-count something.
          if (cachedNetworkCount !== null) cachedNetworkCount += 1;
          if (currentTab === 4) renderProfile(); // "My Network" count just changed
          removeFromDiscover(c.otherUserId); // they're connected now -- Discover shouldn't offer them again
          setConnectionRequestStatus(c.connectionRequestId, 'accepted').then(() => {
            if (typeof refreshNetworkCount === 'function') refreshNetworkCount();
          });
        }
        function rejectRequest(id){
          const idx = requestConvos.findIndex(c => c.id === id);
          if (idx === -1) return;
          const [c] = requestConvos.splice(idx, 1);
          queueSaveUserState();
          renderInboxTab();
          setConnectionRequestStatus(c.connectionRequestId, 'rejected');
        }
        async function setConnectionRequestStatus(connectionRequestId, status){
          if (!connectionRequestId) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            await sb.from(CONNECTION_REQUESTS_TABLE).update({ status }).eq('id', connectionRequestId);
          } catch (e) { console.warn('Updating connection request status failed:', e); }
        }

        // Pulls this account's pending incoming connection requests (rows
        // in connection_requests where to_user = me) so a request sent via
        // Discover's "Connect" button (see connectToDiscoverPerson in
        // overlays.js) actually shows up in the recipient's Inbox ->
        // Requests tab, not just as a row only the sender can see.
        //
        // Called once on app entry (see authEnterApp in games.js) and
        // again every time the Messaging tab is opened (see switchTab in
        // core.js), which is as close to "live" as this app's polling
        // model gets without standing up a Realtime subscription.
        //
        // Requests already accepted/rejected (and therefore no longer
        // 'pending' in the DB) or already present locally are skipped, so
        // re-running this doesn't duplicate rows or resurrect ones the
        // person already acted on.
        let connectionRequestsLoaded = false;
        async function loadIncomingConnectionRequests(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const { data: reqRows, error } = await sb
              .from(CONNECTION_REQUESTS_TABLE)
              .select('*')
              .eq('to_user', me.id)
              .eq('status', 'pending');
            if (error || !Array.isArray(reqRows) || !reqRows.length) { connectionRequestsLoaded = true; return; }

            const knownIds = new Set(convoArrays().flat().map(c => c.connectionRequestId).filter(Boolean));
            const newRows = reqRows.filter(r => !knownIds.has(r.id));
            if (!newRows.length) { connectionRequestsLoaded = true; return; }

            const senderIds = newRows.map(r => r.from_user);
            const { data: senderProfiles } = await sb
              .from(PUBLIC_PROFILES_TABLE)
              .select('*')
              .in('user_id', senderIds);
            const profileById = {};
            (senderProfiles || []).forEach(p => { profileById[p.user_id] = p; });

            newRows.forEach(row => {
              const senderProfile = profileById[row.from_user];
              const name = (senderProfile && (senderProfile.name || senderProfile.username)) || 'Stitch member';
              // row.id is already the id connectToDiscoverPerson generated
              // (e.g. "req1735999999abc") -- reuse it as-is as the convo id
              // rather than re-prefixing it, so it also doubles as the
              // connection_requests primary key for the status update above.
              const convoId = row.id;
              const entry = {
                id: convoId,
                connectionRequestId: row.id,
                otherUserId: row.from_user,
                icon: 'user',
                avatarBg: 'bg-blue-50',
                name,
                username: (senderProfile && senderProfile.username) || '',
                photo: (senderProfile && senderProfile.photo) || null,
                preview: row.message || '',
                time: formatRequestTime(row.created_at),
                network: false,
              };
              requestConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: 'Wants to connect with you', otherUserId: row.from_user };
              // Surface it in the in-app Notifications bell tab too, not
              // just the Messaging -> Requests tab. Reuses convoId as the
              // notification id (== the connection_requests row id) so
              // Accept/Decline there (see acceptConnection/declineConnection
              // in overlays.js) can delegate straight to acceptRequest/
              // rejectRequest below, and so a later re-poll of this same
              // row can't create a duplicate notification.
              if (typeof addNotif === 'function') {
                addNotif({
                  id: convoId,
                  type: 'connect_request',
                  source: 'network',
                  icon: 'user',
                  iconBg: 'bg-blue-50',
                  iconClass: 'text-blue-600',
                  name,
                  message: row.message ? `Wants to connect: "${row.message}"` : 'Wants to connect with you',
                  otherUserId: row.from_user,
                });
              }
            });
            connectionRequestsLoaded = true;
            renderInboxTab();
            // Public accounts don't gate who joins their network -- if
            // this account is already set to Public, don't leave these
            // sitting in Requests waiting for a manual Accept; run them
            // straight through the same auto-accept path the privacy
            // toggle uses (see autoAcceptConnectionsIfPublic in
            // settings.js).
            if (typeof appPrefs !== 'undefined' && appPrefs.accountPrivacy === 'Public' && typeof autoAcceptConnectionsIfPublic === 'function') {
              autoAcceptConnectionsIfPublic();
            }
          } catch (e) { console.warn('Loading incoming connection requests failed:', e); }
        }

        // Mirror of loadMyAcceptedOutgoingRequests, but for the OTHER
        // direction: requests THIS account received and already accepted
        // (to_user = me, status = 'accepted'). Those normally land in
        // primaryConvos the moment acceptRequest() runs on whichever device
        // actually tapped Accept -- but user_state is saved as a whole-blob
        // overwrite (see queueSaveUserState/ensureUserStateLoaded), so a
        // *different* device signed into the same account can easily never
        // get that entry locally (its own last save simply didn't include
        // it, or clobbered a newer one from elsewhere). That device's "My
        // Network" count already comes straight from Supabase now (see
        // refreshNetworkCount) so the NUMBER looks right everywhere, but
        // without this, My Contacts' actual list still only comes from
        // local convoArrays -- so that device would show a count that
        // doesn't match what's actually listed, or people missing
        // entirely. Same trigger points as loadMyAcceptedOutgoingRequests.
        async function loadMyAcceptedIncomingRequests(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const { data: reqRows, error } = await sb
              .from(CONNECTION_REQUESTS_TABLE)
              .select('*')
              .eq('to_user', me.id)
              .eq('status', 'accepted');
            if (error || !Array.isArray(reqRows) || !reqRows.length) return;

            const knownIds = new Set(convoArrays().flat().map(c => c.id));
            const newRows = reqRows.filter(r => !knownIds.has(r.id));
            if (!newRows.length) return;

            const senderIds = newRows.map(r => r.from_user);
            const { data: senderProfiles } = await sb
              .from(PUBLIC_PROFILES_TABLE)
              .select('*')
              .in('user_id', senderIds);
            const profileById = {};
            (senderProfiles || []).forEach(p => { profileById[p.user_id] = p; });

            newRows.forEach(row => {
              const profile = profileById[row.from_user];
              const name = (profile && (profile.name || profile.username)) || 'Stitch member';
              const convoId = row.id;
              const entry = {
                id: convoId,
                connectionRequestId: row.id,
                otherUserId: row.from_user,
                icon: 'user',
                avatarBg: 'bg-blue-50',
                name,
                username: (profile && profile.username) || '',
                photo: (profile && profile.photo) || null,
                preview: 'You are now connected',
                time: formatRequestTime(row.created_at),
                unread: false,
                read: true,
                network: true,
              };
              primaryConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: entry.preview, otherUserId: row.from_user };
              removeFromDiscover(row.from_user);
            });
            queueSaveUserState();
            renderInboxTab();
            if (currentTab === 4) renderProfile();
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'myContacts') {
              const ov = document.getElementById('overlay');
              if (ov) ov.innerHTML = myContactsHTML();
            }
          } catch (e) { console.warn('Loading accepted incoming requests failed:', e); }
        }

        // Realtime top-up for everything connection-related: instead of
        // only re-checking when the person happens to switch to Messaging
        // or reopen the app, listen for live changes on connection_requests
        // that involve this account and re-run the same loaders right away.
        // Supabase Realtime filters can only match one column per
        // subscription, so this needs two separate listeners (one for rows
        // where I'm the recipient, one for rows where I'm the sender) to
        // cover both directions -- e.g. someone accepting my request, or a
        // new request/accept coming in from someone else, on ANY of their
        // devices, shows up here without waiting on a tab switch.
        let connectionUpdatesChannel = null;
        let connectionUpdatesSubscribedForUserId = null;
        async function subscribeToConnectionUpdates(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (connectionUpdatesChannel && connectionUpdatesSubscribedForUserId === myId) return;
          if (connectionUpdatesChannel) { try { sb.removeChannel(connectionUpdatesChannel); } catch (e) { /* ignore */ } connectionUpdatesChannel = null; }
          connectionUpdatesSubscribedForUserId = myId;
          const onConnectionChange = () => {
            loadIncomingConnectionRequests();
            loadMyAcceptedIncomingRequests();
            loadMyAcceptedOutgoingRequests();
            if (typeof refreshNetworkCount === 'function') refreshNetworkCount();
          };
          connectionUpdatesChannel = sb.channel('connections:' + myId)
            .on('postgres_changes', { event: '*', schema: 'public', table: CONNECTION_REQUESTS_TABLE, filter: `to_user=eq.${myId}` }, onConnectionChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: CONNECTION_REQUESTS_TABLE, filter: `from_user=eq.${myId}` }, onConnectionChange)
            .subscribe();
        }

        // Mirror of loadIncomingConnectionRequests, but for requests THIS
        // account sent that the other person has since accepted. Without
        // this, only the recipient of a connect request ever ends up with
        // a real conversation entry -- the sender would have no local
        // record to open at all, which would make live messaging only
        // work in one direction. Same trigger points as
        // loadIncomingConnectionRequests (app entry + opening Messaging).
        async function loadMyAcceptedOutgoingRequests(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const { data: reqRows, error } = await sb
              .from(CONNECTION_REQUESTS_TABLE)
              .select('*')
              .eq('from_user', me.id)
              .eq('status', 'accepted');
            if (error || !Array.isArray(reqRows) || !reqRows.length) return;

            const knownIds = new Set(convoArrays().flat().map(c => c.id));
            const newRows = reqRows.filter(r => !knownIds.has(r.id));
            if (!newRows.length) return;

            const recipientIds = newRows.map(r => r.to_user);
            const { data: recipientProfiles } = await sb
              .from(PUBLIC_PROFILES_TABLE)
              .select('*')
              .in('user_id', recipientIds);
            const profileById = {};
            (recipientProfiles || []).forEach(p => { profileById[p.user_id] = p; });

            newRows.forEach(row => {
              const profile = profileById[row.to_user];
              const name = (profile && (profile.name || profile.username)) || 'Stitch member';
              const convoId = row.id;
              const entry = {
                id: convoId,
                connectionRequestId: row.id,
                otherUserId: row.to_user,
                icon: 'user',
                avatarBg: 'bg-blue-50',
                name,
                username: (profile && profile.username) || '',
                photo: (profile && profile.photo) || null,
                preview: 'You are now connected',
                time: formatRequestTime(row.created_at),
                unread: false,
                read: true,
                network: true,
              };
              primaryConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: entry.preview, otherUserId: row.to_user };
              removeFromDiscover(row.to_user); // they accepted -- Discover shouldn't offer them again
              // Surface it in the Notifications bell tab too -- reuses
              // convoId (== the connection_requests row id) as the
              // notification id so a later re-poll of this same now-
              // "accepted" row (this query re-runs on every realtime
              // connection change, see subscribeToConnectionUpdates)
              // can't create a duplicate entry.
              if (typeof addNotif === 'function') {
                addNotif({
                  id: 'accepted-' + convoId,
                  type: 'connect_accepted',
                  source: 'network',
                  icon: 'user',
                  iconBg: 'bg-blue-50',
                  iconClass: 'text-blue-600',
                  name,
                  message: `${name} accepted your connection request`,
                  otherUserId: row.to_user,
                });
              }
            });
            renderInboxTab();
            if (currentTab === 4) renderProfile(); // "My Network" count just changed
          } catch (e) { console.warn('Loading accepted outgoing requests failed:', e); }
        }

        // Compact time label for the Inbox / requests list, and for the
        // "time" field on every conversation row elsewhere. Escalates
        // the same way WhatsApp's own chat list does (see the reference
        // screenshots): an exact clock time for anything from within the
        // last hour ("8:14 AM"), then elapsed hours once it's older than
        // that ("3h"), then elapsed days once it's a full day or older
        // ("2d") -- not a vague, frozen "now" that stops meaning
        // anything the moment a minute has actually passed.
        function formatRequestTime(createdAt){
          const then = createdAt ? new Date(createdAt).getTime() : Date.now();
          const diffMs = Date.now() - then;
          const mins = Math.floor(diffMs / 60000);
          if (mins < 60) {
            return new Date(then).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          }
          const hours = Math.floor(mins / 60);
          if (hours < 24) return hours + 'h';
          const days = Math.floor(hours / 24);
          return days + 'd';
        }

        // ---------------- CONVERSATION THREAD ----------------
        // ---- Live messaging backend (Supabase) ----
        // Every message is written to a real `messages` table and
        // delivered over a Realtime subscription: sending writes a row
        // addressed to the other account's real user id, and every
        // signed-in account listens for rows addressed to itself so a
        // message shows up on the recipient's screen right away, without
        // a reload (see subscribeToIncomingMessages).
        //
        // This only works for conversations where we actually know the
        // other person's real Supabase user id, i.e. ones that came from
        // a connection request (see otherUserId on convoMeta, set in
        // loadIncomingConnectionRequests / loadMyAcceptedOutgoingRequests
        // above). Locally-created threads with no backend user on the
        // other end (e.g. a collaboration you made up a name for) just
        // stay local -- there's no real recipient to deliver to.
        //
        // Note: only message text is synced for now, not file
        // attachments -- those still only show up in your own browser
        // (same as before). Voice notes ARE synced now (see
        // uploadConvoVoiceToStorage / sendConvoVoiceNote below) --
        // making attachments live too would need the same Storage-bucket
        // treatment, a separate change.
        //
        // Requires, in the configured Supabase project:
        //   create table messages (
        //     id bigint generated always as identity primary key,
        //     convo_id text not null,
        //     sender_id uuid not null references auth.users(id) on delete cascade,
        //     recipient_id uuid not null references auth.users(id) on delete cascade,
        //     text text not null default '',
        //     voice_url text,
        //     voice_duration int,
        //     attachments jsonb,
        //     read boolean not null default false,
        //     local_id text,
        //     created_at timestamptz not null default now()
        //   );
        //   alter table messages enable row level security;
        //   create policy "Participants can read their messages" on messages
        //     for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
        //   create policy "Users can send messages as themselves" on messages
        //     for insert with check (auth.uid() = sender_id);
        //   create policy "Recipient can mark messages read" on messages
        //     for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
        //   create policy "Sender can delete their own message" on messages
        //     for delete using (auth.uid() = sender_id);
        //   -- Realtime needs to know to broadcast changes on this table:
        //   alter publication supabase_realtime add table messages;
        //   -- DELETE events only carry the deleted row's primary key by
        //   -- default, which isn't enough to filter "was this addressed
        //   -- to me" or to match it against local state by local_id (see
        //   -- handleIncomingMessageDelete below) -- this makes Postgres
        //   -- include the whole old row instead:
        //   alter table messages replica identity full;
        //   -- (Also double-check Database -> Replication -> messages is
        //   -- toggled on in the dashboard; the SQL above should do it,
        //   -- but the toggle is the source of truth.)
        //
        // If `messages` already existed from before voice notes/read
        // receipts/attachments were added, just run this once instead of
        // recreating the table:
        //   alter table messages add column if not exists voice_url text;
        //   alter table messages add column if not exists voice_duration int;
        //   alter table messages add column if not exists attachments jsonb;
        //   alter table messages add column if not exists read boolean not null default false;
        //   alter table messages add column if not exists local_id text;
        //   alter table messages replica identity full;
        //   -- plus the "Recipient can mark messages read" and "Sender can
        //   -- delete their own message" policies above, since existing
        //   -- projects won't have them yet.
        const MESSAGES_TABLE = 'messages';

        // Voice-note audio blobs upload here so the recipient can actually
        // fetch and play them -- same pattern as
        // uploadLectureFileToStorage/uploadResourceFileToStorage in
        // core.js and uploadCourseItemMediaToStorage in courses.js.
        // Requires a public bucket named CHAT_VOICE_BUCKET to exist in the
        // configured Supabase project; if upload fails or Supabase isn't
        // configured, the clip still plays for the sender (via the local
        // data URL captured in handleConvoVoiceNoteStop) but never reaches
        // the other account.
        const CHAT_VOICE_BUCKET = 'chat-voice-notes';

        async function uploadConvoVoiceToStorage(blob, convoId){
          const sb = getSupabaseClient();
          if (!sb) return null;
          try {
            const ext = (blob.type && blob.type.includes('mp4')) ? 'm4a' : 'webm';
            const path = `${convoId}/${Date.now()}.${ext}`;
            const { error } = await sb.storage.from(CHAT_VOICE_BUCKET).upload(path, blob, { contentType: blob.type || 'audio/webm' });
            if (error) { console.warn('Voice note upload failed:', error.message); return null; }
            const { data } = sb.storage.from(CHAT_VOICE_BUCKET).getPublicUrl(path);
            return (data && data.publicUrl) || null;
          } catch (err) {
            console.warn('Voice note upload failed:', err);
            return null;
          }
        }

        // Image/file attachments upload here, same idea as
        // uploadConvoVoiceToStorage above -- previously attachments were
        // never given anywhere to live (pendingConvoAttachments only ever
        // stored {name, type}, never the actual file bytes), so an image
        // could never be shown full-size, tapped open, or reach the other
        // account: sendConvoMessage only ever synced `text` to Supabase.
        // Requires a public bucket named CHAT_MEDIA_BUCKET to exist in the
        // configured Supabase project (Storage -> New bucket -> Public).
        const CHAT_MEDIA_BUCKET = 'chat-media';

        async function uploadConvoAttachmentsToStorage(attachments, convoId){
          const sb = getSupabaseClient();
          if (!sb || !attachments || !attachments.length) return [];
          const uploaded = [];
          for (const f of attachments) {
            try {
              const blob = f.file || (f.dataUrl ? await (await fetch(f.dataUrl)).blob() : null);
              if (!blob) continue;
              const dotIdx = f.name ? f.name.lastIndexOf('.') : -1;
              const ext = dotIdx > -1 ? f.name.slice(dotIdx + 1) : ((f.type && f.type.split('/')[1]) || 'dat');
              const path = `${convoId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
              const { error } = await sb.storage.from(CHAT_MEDIA_BUCKET).upload(path, blob, { contentType: f.type || 'application/octet-stream' });
              if (error) { console.warn('Attachment upload failed:', error.message); continue; }
              const { data } = sb.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
              if (data && data.publicUrl) uploaded.push({ url: data.publicUrl, name: f.name, type: f.type });
            } catch (err) { console.warn('Attachment upload threw an error:', err); }
          }
          return uploaded;
        }

        // PostgREST returns this shape (code PGRST204, "Could not find the
        // 'X' column of 'Y' in the schema cache") when a request
        // references a column that doesn't exist in the live table yet --
        // exactly what happens if a migration comment above (e.g. "alter
        // table messages add column if not exists local_id text;") was
        // never actually run against this project's database. Parses out
        // which column so the caller can drop it and retry instead of
        // failing the whole request over one optional field.
        function missingColumnFromError(error){
          if (!error) return null;
          const msg = error.message || '';
          const m = msg.match(/find the '([^']+)' column/i);
          return m ? m[1] : null;
        }

        // Returns the new row's id (so the sender can track its read
        // receipt -- see convoReadTicksHTML/handleMessageReadUpdate) or
        // null if it didn't sync. localId is a client-generated id shared
        // across every fan-out row of the same logical message (see
        // sendConvoMessage) -- it's what lets "delete for everyone" find
        // and remove every recipient's copy of a group message, not just
        // one row (see deleteActionMessageForEveryone).
        async function sendMessageRemote(convoId, otherUserId, text, voiceUrl, voiceDuration, attachments, localId){
          const sb = getSupabaseClient();
          const myId = await getCurrentUserId();
          if (!sb || !myId) return null;
          try {
            const row = {
              convo_id: convoId,
              sender_id: myId,
              recipient_id: otherUserId,
              text: text || '',
            };
            if (voiceUrl) { row.voice_url = voiceUrl; row.voice_duration = voiceDuration || null; }
            if (attachments && attachments.length) { row.attachments = attachments; }
            if (localId) { row.local_id = localId; }

            // If the live `messages` table is missing an optional column
            // this row includes (most commonly local_id, on a project
            // where that migration hasn't been run yet), drop just that
            // field and retry rather than losing the message entirely --
            // a message that's missing its local_id can still send and be
            // read, it just can't be found-and-removed as part of a
            // "delete for everyone" on a group later.
            let data, error;
            for (let attempt = 0; attempt < 5; attempt++) {
              ({ data, error } = await sb.from(MESSAGES_TABLE).insert(row).select('id').single());
              if (!error) break;
              const badCol = missingColumnFromError(error);
              if (badCol && Object.prototype.hasOwnProperty.call(row, badCol)) {
                console.warn(`messages table is missing column '${badCol}' -- sending without it. Run the migration comment above MESSAGES_TABLE to fix this permanently.`);
                delete row[badCol];
                continue;
              }
              break;
            }
            if (error) { console.warn('Message did not sync to Supabase:', error); return null; }
            // Real push so the recipient hears about the message even if
            // they aren't currently sitting in the app (postgres_changes
            // Realtime in subscribeToIncomingMessages only reaches a live,
            // open session).
            sendPushTo(otherUserId, {
              title: (typeof profileData !== 'undefined' && profileData.name) || 'New message',
              body: text ? (text.length > 120 ? text.slice(0, 117) + '...' : text) : (attachments && attachments.length ? 'Sent a photo' : 'Sent a voice message'),
              tag: 'msg-' + convoId,
              data: { kind: 'message', convoId },
            });
            return (data && data.id) || null;
          } catch (e) { console.warn('Sending message threw an error:', e); return null; }
        }

        // Replaces whatever placeholder/local history a real conversation
        // had with its actual message history from Supabase -- called
        // when opening a conversation that has a known otherUserId (see
        // openConversation below).
        async function loadConversationHistory(convoId){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const myId = await getCurrentUserId();
            let data, error;
            ({ data, error } = await sb.from(MESSAGES_TABLE)
              .select('id,sender_id,text,voice_url,voice_duration,attachments,read,local_id,created_at')
              .eq('convo_id', convoId)
              .order('created_at', { ascending: true }));
            // Same schema-drift situation as sendMessageRemote above: if
            // the live table is missing a column this SELECT asks for
            // (again, usually local_id), fall back to '*' instead of
            // silently returning no history at all -- an empty chat
            // reads exactly like "messages aren't syncing" to a user, even
            // though the real fix is just an unrun migration.
            if (error && missingColumnFromError(error)) {
              console.warn('messages table is missing a selected column -- loading with select(*) instead. Run the migration comment above MESSAGES_TABLE to fix this permanently.');
              ({ data, error } = await sb.from(MESSAGES_TABLE)
                .select('*')
                .eq('convo_id', convoId)
                .order('created_at', { ascending: true }));
            }
            if (error || !data) return;
            conversationMessages[convoId] = data
              .filter(r => !deletedForMeMessageIds.has(r.id))
              .map(r => ({
                id: r.id,
                localId: r.local_id || null,
                from: r.sender_id === myId ? 'me' : 'them',
                text: r.text,
                voice: r.voice_url ? { src: r.voice_url, duration: r.voice_duration || 0 } : undefined,
                attachments: Array.isArray(r.attachments) ? r.attachments : undefined,
                read: !!r.read,
                time: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
              }));
          } catch (e) { /* best effort -- keep whatever local history already existed */ }
        }

        // Tells Supabase the messages the other person sent us in this
        // conversation have now been seen, so their copy's ticks can turn
        // from "delivered" to "read" (see handleMessageReadUpdate, which
        // is what actually notices this on their end). Called once when
        // we open the conversation, and again for any message that
        // arrives in real time while we're already looking at it.
        async function markConvoMessagesRead(convoId, otherUserId){
          const sb = getSupabaseClient();
          const myId = await getCurrentUserId();
          if (!sb || !myId || !otherUserId) return;
          try {
            // Voice notes are deliberately left out of this bulk update --
            // see markVoiceMessageAsPlayed below for why they're only
            // marked read once actually played, not just because the
            // conversation happened to be open.
            await sb.from(MESSAGES_TABLE).update({ read: true })
              .eq('convo_id', convoId)
              .eq('sender_id', otherUserId)
              .eq('recipient_id', myId)
              .eq('read', false)
              .is('voice_url', null);
          } catch (e) { /* best effort -- worst case the sender's ticks just stay gray */ }
        }

        // Voice notes used to get swept up in markConvoMessagesRead just
        // like text and images -- the moment the conversation was open (or
        // already open when the note arrived), it ticked "read" for the
        // sender even though nobody had actually pressed play. That's
        // exactly backwards for a voice note: "read" there should mean
        // "listened to", not "the chat happened to be on screen". This
        // marks a single voice message read only when its <audio> element
        // actually starts playing (see the onplay handler in
        // convoVoiceNoteHTML), and only touches that one row/message
        // rather than the whole conversation.
        async function markVoiceMessageAsPlayed(convoId, messageId){
          if (!messageId) return;
          const msgs = conversationMessages[convoId];
          const m = msgs && msgs.find(x => String(x.id) === String(messageId));
          if (!m || m.read) return;
          m.read = true;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            await sb.from(MESSAGES_TABLE).update({ read: true }).eq('id', messageId).eq('read', false);
          } catch (e) { console.warn('Marking voice note as played failed:', e); }
        }

        // Re-derives each 1:1 conversation's unread state from the real
        // `messages` table on app entry, rather than trusting whatever
        // unread/read flags happened to be in the last-saved user_state
        // blob (see queueSaveUserState/applyUserState). Those flags only
        // ever got set to true through the live Realtime subscription
        // (handleIncomingMessage) while the app happened to be open --
        // which misses the ordinary case of a message arriving while the
        // app is closed or backgrounded (that's what the push notification
        // in sendMessageRemote is for). Reopening the app afterwards had
        // nothing that went back and asked "were any of my messages left
        // unread?", so the Messaging badge and the inbox's blue dot could
        // both silently stay off for a message nobody had actually opened
        // yet. This only ever ADDS an unread flag that the real data says
        // should be there -- it never clears one, so it can't accidentally
        // mark something read that the person hasn't opened.
        async function reconcileUnreadMessages(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          try {
            const { data, error } = await sb.from(MESSAGES_TABLE)
              .select('convo_id')
              .eq('recipient_id', myId)
              .eq('read', false);
            if (error || !data || !data.length) return;
            const unreadConvoIds = new Set(data.map(r => r.convo_id));
            let changed = false;
            convoArrays().flat().forEach(c => {
              if (unreadConvoIds.has(c.id) && activeConvoId !== c.id && (!c.unread || c.read)) {
                c.unread = true;
                c.read = false;
                changed = true;
              }
            });
            if (changed) {
              queueSaveUserState();
              if (typeof currentTab !== 'undefined' && currentTab === 3) renderInboxTab();
              if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
            }
          } catch (e) { console.warn('Reconciling unread messages failed:', e); }
        }

        // One Realtime subscription per signed-in session, listening for
        // any message row addressed to this account. Set up once on app
        // entry (see authEnterApp in games.js); re-calling it for the same
        // user id is a no-op so it's safe to call again defensively.
        let messagesChannel = null;
        let messagesSubscribedForUserId = null;
        async function subscribeToIncomingMessages(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (messagesChannel && messagesSubscribedForUserId === myId) return;
          if (messagesChannel) { try { sb.removeChannel(messagesChannel); } catch (e) { /* ignore */ } messagesChannel = null; }
          messagesSubscribedForUserId = myId;
          messagesChannel = sb.channel('messages:' + myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: MESSAGES_TABLE, filter: `recipient_id=eq.${myId}` }, (payload) => {
              handleIncomingMessage(payload.new);
            })
            // A message *we* sent just got marked read on the other end
            // (see markConvoMessagesRead) -- flip its ticks blue live
            // instead of only finding out next time the chat reloads.
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: MESSAGES_TABLE, filter: `sender_id=eq.${myId}` }, (payload) => {
              handleMessageReadUpdate(payload.new);
            })
            // Someone deleted a message "for everyone" on their end (see
            // deleteActionMessageForEveryone) -- this is what actually
            // makes it disappear live on ours too, instead of only on
            // the next full reload of the chat. Needs `replica identity
            // full` on the messages table (see the schema note above
            // MESSAGES_TABLE) -- without it, payload.old only carries the
            // deleted row's id, this filter can't match against
            // recipient_id at all, and the event never reaches here.
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: MESSAGES_TABLE, filter: `recipient_id=eq.${myId}` }, (payload) => {
              handleIncomingMessageDelete(payload.old);
            })
            .subscribe();
        }

        // ---- Polling fallback for incoming messages ----
        // subscribeToIncomingMessages above is the primary way new
        // messages arrive live, but it depends on Realtime actually being
        // turned on for the `messages` table in the configured Supabase
        // project (Database -> Replication, plus `alter publication
        // supabase_realtime add table messages;` -- see the schema
        // comment above MESSAGES_TABLE). That's easy to miss when setting
        // the project up, and when it's missing, messages still send and
        // save just fine -- they just never trigger
        // handleIncomingMessage live, so an open chat, the Messaging
        // badge, and the notification bell all silently stall until the
        // app happens to reload. This polls for anything the realtime
        // channel might have missed on a plain interval as a safety net,
        // reusing handleIncomingMessage (which is now dedup-safe against
        // seeing the same row twice) so a message caught by the poll
        // behaves identically to one that arrived live.
        let messagePollTimer = null;
        let lastPolledMessageId = 0;

        async function pollForNewMessages(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          try {
            const { data, error } = await sb.from(MESSAGES_TABLE)
              .select('id,convo_id,sender_id,recipient_id,text,voice_url,voice_duration,attachments,created_at')
              .eq('recipient_id', myId)
              .gt('id', lastPolledMessageId)
              .order('id', { ascending: true })
              .limit(50);
            if (error || !data || !data.length) return;
            data.forEach(row => {
              if (row.id > lastPolledMessageId) lastPolledMessageId = row.id;
              handleIncomingMessage(row);
            });
          } catch (e) { /* best effort -- try again on the next tick */ }
        }

        // Called once at app entry (see games.js authEnterApp), same spot
        // as subscribeToIncomingMessages. Seeds the cursor at whatever the
        // highest existing message id already is, so the very first poll
        // doesn't replay someone's entire message history through
        // addNotif/the unread badges the moment they sign in.
        async function startMessagePolling(){
          if (messagePollTimer) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          try {
            const { data } = await sb.from(MESSAGES_TABLE)
              .select('id').eq('recipient_id', myId)
              .order('id', { ascending: false }).limit(1);
            if (data && data[0]) lastPolledMessageId = data[0].id;
          } catch (e) { /* fine -- worst case the first poll surfaces a few already-read messages */ }
          messagePollTimer = setInterval(pollForNewMessages, 20000);
        }

        function handleIncomingMessageDelete(row){
          if (!row) return;
          const convoId = row.convo_id;
          const msgs = conversationMessages[convoId];
          if (!msgs) return;
          const idx = msgs.findIndex(m => (row.local_id && m.localId === row.local_id) || (row.id != null && m.id === row.id));
          if (idx === -1) return;
          msgs.splice(idx, 1);
          refreshConvoLogIfOpen(convoId);
          queueSaveUserState();
        }

        function handleMessageReadUpdate(row){
          if (!row || row.id == null || !row.read) return;
          const convoId = row.convo_id;
          const msgs = conversationMessages[convoId];
          if (!msgs) return;
          const m = msgs.find(x => x.id === row.id);
          if (!m || m.read) return;
          m.read = true;
          refreshConvoLogIfOpen(convoId);
        }

        // Small shared helper: several places (a message getting its id
        // back from Supabase, a read receipt flipping, a new message
        // arriving) all need "re-paint the log, but only if this
        // conversation is the one actually on screen right now".
        function refreshConvoLogIfOpen(convoId){
          if (activeConvoId !== convoId) return;
          const log = document.getElementById('convo-log');
          if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
        }

        // ---- Collaborations (group chats): real, backend-synced group
        // conversations. Previously a "collaboration" was pure local mock
        // state -- created on one device, invisible to everyone else, and
        // sending a message into one just sat there (see the old comment
        // above sendConvoMessage: "No known backend user on the other
        // end -- the message just sits sent"). This makes them live:
        //
        //  - Membership is a real row per (collaboration, person), so a
        //    collaboration someone else creates and adds you to actually
        //    shows up in *your* inbox too (see loadMyCollaborations /
        //    subscribeToCollabMembership below), not just theirs.
        //  - Sending a message fans out one row per member into the same
        //    `messages` table 1:1 chats already use, all sharing the
        //    collaboration's convo_id (see sendConvoMessage) -- so every
        //    member's existing subscribeToIncomingMessages() Realtime
        //    subscription just picks their copy up for free, with no
        //    separate group-messaging pipeline to build.
        //
        // Requires, in the configured Supabase project:
        //   create table collaborations (
        //     id text primary key,
        //     name text not null default '',
        //     photo text,
        //     created_by uuid not null references auth.users(id) on delete cascade,
        //     created_at timestamptz not null default now()
        //   );
        //   alter table collaborations enable row level security;
        //   create policy "Anyone signed in can read collaborations" on collaborations
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Signed-in users can create collaborations" on collaborations
        //     for insert with check (auth.uid() = created_by);
        //   create policy "Creator can update their collaboration" on collaborations
        //     for update using (auth.uid() = created_by);
        //   create policy "Creator can delete their collaboration" on collaborations
        //     for delete using (auth.uid() = created_by);
        //
        //   create table collaboration_members (
        //     id bigint generated always as identity primary key,
        //     collab_id text not null references collaborations(id) on delete cascade,
        //     user_id uuid not null references auth.users(id) on delete cascade,
        //     name text not null default '',
        //     avatar_bg text,
        //     icon text,
        //     photo text,
        //     created_at timestamptz not null default now(),
        //     unique (collab_id, user_id)
        //   );
        //   alter table collaboration_members enable row level security;
        //   create policy "Anyone signed in can read collaboration members" on collaboration_members
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Signed-in users can add collaboration members" on collaboration_members
        //     for insert with check (auth.role() = 'authenticated');
        //   create policy "Signed-in users can remove collaboration members" on collaboration_members
        //     for delete using (auth.role() = 'authenticated');
        //   -- Realtime needs to know to broadcast changes on this table:
        //   alter publication supabase_realtime add table collaboration_members;
        //   alter publication supabase_realtime add table collaborations;
        //   -- DELETE events only ship primary-key columns by default, but
        //   -- we filter/read by user_id and collab_id below (who got
        //   -- removed, from which collaboration) -- REPLICA IDENTITY FULL
        //   -- makes the whole old row available on delete:
        //   alter table collaboration_members replica identity full;
        const COLLABORATIONS_TABLE = 'collaborations';
        const COLLAB_MEMBERS_TABLE = 'collaboration_members';

        // Best-effort writes, same fallback philosophy as
        // postLikeRemote/sendMessageRemote above: local state is already
        // updated by the caller by the time these run, so a failure here
        // (offline, tables not set up yet, RLS) just means the
        // collaboration stays local to this device instead of breaking
        // the tap.
        async function collabCreateRemote(id, name, photo, memberContacts){
          const sb = getSupabaseClient();
          const myId = await getCurrentUserId();
          if (!sb || !myId) return false;
          try {
            const { error: cErr } = await sb.from(COLLABORATIONS_TABLE)
              .insert({ id, name, photo: photo || null, created_by: myId });
            if (cErr) { console.warn('Collaboration did not sync to Supabase:', cErr); return false; }
            const rows = [{
              collab_id: id, user_id: myId,
              name: (typeof profileData !== 'undefined' && profileData.name) || 'You',
              avatar_bg: 'bg-blue-100', icon: 'user',
              photo: (typeof profileData !== 'undefined' && profileData.photo) || null,
            }];
            memberContacts.forEach(c => {
              if (c.otherUserId) rows.push({ collab_id: id, user_id: c.otherUserId, name: c.name, avatar_bg: c.avatarBg, icon: c.icon, photo: c.photo || null });
            });
            // upsert (not insert): re-adding someone already in
            // collaboration_members -- entirely plausible, e.g. the same
            // contact picked twice, or a retry after a partial failure --
            // used to violate the (collab_id, user_id) unique constraint
            // and 409 the WHOLE batch, so even brand-new members sitting
            // alongside the duplicate in the same insert silently failed
            // to sync too. ignoreDuplicates just skips the row that's
            // already there instead of failing the request.
            const { error: mErr } = await sb.from(COLLAB_MEMBERS_TABLE).upsert(rows, { onConflict: 'collab_id,user_id', ignoreDuplicates: true });
            if (mErr) console.warn('Collaboration members did not sync to Supabase:', mErr);
            // No sendPushTo here: added members find out live, in-app, via
            // the collab-members Realtime INSERT listener below (see
            // subscribeToCollabMembership) instead of a push notification
            // routed through the hosting platform's Edge Function.
            return true;
          } catch (e) { console.warn('Creating collaboration threw an error:', e); return false; }
        }

        async function collabAddMembersRemote(id, name, newContacts){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const rows = newContacts.filter(c => c.otherUserId).map(c => ({ collab_id: id, user_id: c.otherUserId, name: c.name, avatar_bg: c.avatarBg, icon: c.icon, photo: c.photo || null }));
            if (rows.length) {
              // Same reasoning as collabCreateRemote above -- upsert with
              // ignoreDuplicates so one already-a-member row in the batch
              // can't 409 the rest of it.
              const { error } = await sb.from(COLLAB_MEMBERS_TABLE).upsert(rows, { onConflict: 'collab_id,user_id', ignoreDuplicates: true });
              if (error) { console.warn('Adding collaboration members did not sync:', error); return false; }
            }
            // Same as collabCreateRemote: rely on the live Realtime INSERT
            // listener to notify the new members in-app instead of a
            // hosting-platform push.
            return true;
          } catch (e) { console.warn('Adding collaboration members threw an error:', e); return false; }
        }

        async function collabRemoveMemberRemote(id, userId){
          const sb = getSupabaseClient();
          if (!sb || !userId) return false;
          try {
            const { error } = await sb.from(COLLAB_MEMBERS_TABLE).delete().eq('collab_id', id).eq('user_id', userId);
            if (error) { console.warn('Removing collaboration member did not sync:', error); return false; }
            return true;
          } catch (e) { return false; }
        }

        async function collabDeleteRemote(id){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(COLLABORATIONS_TABLE).delete().eq('id', id);
            if (error) { console.warn('Deleting collaboration did not sync:', error); return false; }
            return true;
          } catch (e) { return false; }
        }

        async function collabUpdatePhotoRemote(id, photo){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(COLLABORATIONS_TABLE).update({ photo }).eq('id', id);
            if (error) { console.warn('Collaboration photo did not sync:', error); return false; }
            return true;
          } catch (e) { return false; }
        }

        // Same idea as collabUpdatePhotoRemote, for renaming a
        // collaboration after it's already been created -- also updates
        // the member row backend keeps for "your own" name inside
        // collaboration_members, since collabCreateRemote/
        // collabAddMembersRemote store a name snapshot there too.
        async function collabUpdateNameRemote(id, name){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(COLLABORATIONS_TABLE).update({ name }).eq('id', id);
            if (error) { console.warn('Collaboration name did not sync:', error); return false; }
            return true;
          } catch (e) { return false; }
        }

        // Pulls every collaboration this account is a member of --
        // including ones someone else created and added them to -- and
        // merges them into collabConvos/convoMeta. Called once at boot
        // (see authEnterApp in games.js) and again whenever a live
        // collaboration_members insert for this account comes in (see
        // subscribeToCollabMembership below), so a brand new invite shows
        // up without needing a manual refresh.
        async function loadMyCollaborations(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const myId = await getCurrentUserId();
            if (!myId) return;
            const { data: myRows, error: myErr } = await sb.from(COLLAB_MEMBERS_TABLE).select('collab_id').eq('user_id', myId);
            if (myErr || !myRows || !myRows.length) return;
            const ids = [...new Set(myRows.map(r => r.collab_id))];
            const [{ data: collabs }, { data: allMembers }] = await Promise.all([
              sb.from(COLLABORATIONS_TABLE).select('id,name,photo,created_by').in('id', ids),
              sb.from(COLLAB_MEMBERS_TABLE).select('collab_id,user_id,name,avatar_bg,icon,photo').in('collab_id', ids),
            ]);
            if (!collabs) return;
            const membersByCollab = {};
            (allMembers || []).forEach(r => { (membersByCollab[r.collab_id] = membersByCollab[r.collab_id] || []).push(r); });
            collabs.forEach(row => {
              const id = row.id;
              const members = (membersByCollab[id] || []).map(m => ({
                otherUserId: m.user_id, name: m.name, avatarBg: m.avatar_bg || 'bg-blue-100', icon: m.icon || 'user', photo: m.photo || null, mine: m.user_id === myId,
              }));
              const existing = convoMeta[id];
              const displayName = row.name || members.filter(m => !m.mine).map(m => m.name).slice(0, 3).join(', ') || 'Collaboration';
              convoMeta[id] = {
                icon: 'users', avatarBg: (existing && existing.avatarBg) || 'bg-emerald-100', name: displayName, photo: row.photo || null,
                preview: (existing && existing.preview) || 'Collaboration', members, createdBy: row.created_by,
              };
              if (!collabConvos.some(c => c.id === id)) {
                collabConvos.unshift({ id, icon: 'users', avatarBg: 'bg-emerald-100', name: displayName, photo: row.photo || null, preview: 'You were added to this collaboration', time: formatRequestTime(Date.now()), unread: true, read: false });
                if (!conversationMessages[id]) conversationMessages[id] = [{ from: 'them', text: `You were added to "${displayName}".`, time: Date.now() }];
              } else {
                const entry = collabConvos.find(c => c.id === id);
                if (entry) { entry.name = displayName; entry.photo = row.photo || null; }
              }
            });
            // Member photos in collab_members are a snapshot taken when
            // each person was added to the group and otherwise never
            // touched again -- someone who changed their picture after
            // joining would show their old one to every other member
            // forever. Refresh them all from public_profiles in one batch
            // right after loading, same idea as refreshAllContactPhotos.
            const allMembersFlat = collabs.flatMap(row => (convoMeta[row.id] && convoMeta[row.id].members) || []);
            await refreshPhotosFromProfiles(allMembersFlat);
            queueSaveUserState();
          } catch (e) { /* best effort -- keep whatever local state already existed */ }
        }

        // Removes a collaboration from local state (all convo arrays, its
        // meta, its messages) and, when this wasn't something we just did
        // ourselves a moment ago (leaveCollaboration/deleteCollaboration
        // already clean up synchronously before the Realtime event lands),
        // surfaces an in-app toast explaining what happened. This -- not a
        // push notification routed through the hosting platform -- is what
        // the person sees; everything here runs from inside the app itself,
        // live, off the Realtime subscriptions below.
        function applyRemoteCollabRemoval(id, toastTitle, toastBodyFor){
          if (!id) return;
          const wasPresent = [primaryConvos, requestConvos, collabConvos].some(arr => arr.some(c => c.id === id));
          const meta = convoMeta[id];
          [primaryConvos, requestConvos, collabConvos].forEach(arr => {
            const idx = arr.findIndex(c => c.id === id);
            if (idx !== -1) arr.splice(idx, 1);
          });
          delete convoMeta[id];
          delete conversationMessages[id];
          selectedConvos.delete(id);
          if (activeConvoId === id) { activeConvoId = null; closeOverlay(); }
          queueSaveUserState();
          if (currentTab === 3) renderInboxTab();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
          if (wasPresent && meta) pushInAppNotification(toastTitle, toastBodyFor(meta.name || 'Collaboration'));
        }

        // One Realtime subscription per signed-in session, covering the
        // full live lifecycle of collaborations this account belongs to:
        // being added as a member (mirrors subscribeToIncomingMessages, so
        // it shows up the same way an incoming message does), being
        // individually removed by the creator, and the collaboration being
        // deleted outright for everyone. All three update this device
        // immediately and entirely in-app -- no hosting-platform push
        // involved.
        let collabMembersChannel = null;
        let collabMembersSubscribedForUserId = null;
        async function subscribeToCollabMembership(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (collabMembersChannel && collabMembersSubscribedForUserId === myId) return;
          if (collabMembersChannel) { try { sb.removeChannel(collabMembersChannel); } catch (e) { /* ignore */ } collabMembersChannel = null; }
          collabMembersSubscribedForUserId = myId;
          collabMembersChannel = sb.channel('collab-members:' + myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: COLLAB_MEMBERS_TABLE, filter: `user_id=eq.${myId}` }, async (payload) => {
              await loadMyCollaborations();
              if (currentTab === 3) renderInboxTab();
              if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
              const collabId = payload && payload.new && payload.new.collab_id;
              const meta = collabId && convoMeta[collabId];
              if (meta) pushInAppNotification('New collaboration', `You were added to "${meta.name}".`);
            })
            // Someone removed just this account from a collaboration (the
            // creator kicked us, or this cascaded from the whole
            // collaboration being deleted -- see the collaborations
            // listener below, which fires alongside this one in that case).
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: COLLAB_MEMBERS_TABLE, filter: `user_id=eq.${myId}` }, (payload) => {
              const collabId = payload && payload.old && payload.old.collab_id;
              applyRemoteCollabRemoval(collabId, 'Removed from collaboration', name => `You were removed from "${name}".`);
            })
            // The collaboration itself got deleted (by its creator, from
            // any of their devices) -- take it away for every member live,
            // not just next time loadMyCollaborations happens to run.
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: COLLABORATIONS_TABLE }, (payload) => {
              const collabId = payload && payload.old && payload.old.id;
              applyRemoteCollabRemoval(collabId, 'Collaboration deleted', name => `"${name}" was deleted.`);
            })
            .subscribe();
        }

        // ---- Incoming call ringing ----
        // Calls themselves were already real peer-to-peer WebRTC (see the
        // VOICE/VIDEO CALL section below) -- but previously the only way
        // the other side "received" a call was by coincidence: they had to
        // already be sitting in that exact conversation and tap Call
        // themselves at the same time. There was no actual notification.
        // This adds that: a lightweight per-account broadcast channel
        // (`incoming-calls:<userId>`, no table needed -- just like the
        // WebRTC signaling channel, this is transient and never stored)
        // that every signed-in account listens on for the rest of the
        // session (set up once in authEnterApp, same as
        // subscribeToIncomingMessages). Starting a call broadcasts a
        // 'ring' to the other person's channel; whichever screen they're
        // on, an incoming-call sheet pops up with Accept/Decline (see
        // incomingCallHTML). Accepting just calls startCall() the same
        // way tapping Call does -- the WebRTC room-join logic in
        // joinCallSignaling is already symmetric, so "answering" and
        // "calling" both simply mean "join call:<convoId>".
        let incomingCallChannel = null;
        let incomingCallSubscribedForUserId = null;
        let incomingCallInfo = null; // { convoId, type, fromUserId, callerName, callerPhoto }
        let incomingCallRingTimeout = null;

        // ---- Incoming call ringtone ----
        // handleIncomingCallRing below only popped up the Accept/Decline
        // sheet -- silently, with no actual sound, so a call was easy to
        // miss unless you happened to be looking at the screen. This
        // synthesizes a classic two-tone ring (same technique as the quiz
        // sound effects in quizzesAndGames.js: Web Audio oscillators, so
        // it plays instantly with no audio file to load) and repeats it
        // until the call is answered, declined, or times out. Vibration
        // rides along on devices that support it, using the same repeating
        // ring-like pattern the push notification uses in sw.js, so the
        // in-app and backgrounded cases feel consistent.
        let ringAudioCtx = null;
        let ringIntervalId = null;
        function getRingAudioCtx(){
          if (!ringAudioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) ringAudioCtx = new Ctx();
          }
          return ringAudioCtx;
        }
        // One "brring" burst: two tones together (440Hz + 480Hz, the
        // classic North American ring frequency pair) for ~1.8s.
        function playRingBurst(){
          if (typeof soundMuted !== 'undefined' && soundMuted) return;
          const ctx = getRingAudioCtx();
          if (!ctx) return;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          const t0 = ctx.currentTime;
          const burstDuration = 1.8;
          [440, 480].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(0.12, t0 + 0.05);
            gain.gain.setValueAtTime(0.12, t0 + burstDuration - 0.1);
            gain.gain.linearRampToValueAtTime(0.0001, t0 + burstDuration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + burstDuration + 0.03);
          });
        }
        function startIncomingCallRingtone(){
          stopIncomingCallRingtone();
          playRingBurst();
          if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
          // Repeat the burst+vibrate pattern every 4s, like a phone ringing
          // in cycles, until stopIncomingCallRingtone() is called.
          ringIntervalId = setInterval(() => {
            playRingBurst();
            if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
          }, 4000);
        }
        function stopIncomingCallRingtone(){
          if (ringIntervalId) { clearInterval(ringIntervalId); ringIntervalId = null; }
          if (navigator.vibrate) navigator.vibrate(0);
        }

        async function subscribeToIncomingCalls(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (incomingCallChannel && incomingCallSubscribedForUserId === myId) return;
          if (incomingCallChannel) { try { sb.removeChannel(incomingCallChannel); } catch (e) { /* ignore */ } incomingCallChannel = null; }
          incomingCallSubscribedForUserId = myId;
          incomingCallChannel = sb.channel('incoming-calls:' + myId, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'ring' }, ({ payload }) => handleIncomingCallRing(payload))
            .on('broadcast', { event: 'response' }, ({ payload }) => handleCallResponse(payload))
            .subscribe();
        }

        // A one-shot broadcast to someone else's inbox channel (ringing
        // them, or replying to a ring they sent) -- opens a channel just
        // long enough to deliver the message, then lets it go. Anyone
        // signed in can publish to any userId's channel by name (same
        // trust model as the call:<convoId> signaling channel above --
        // this app has no server-side authorization layer for Realtime
        // channels either way), so no extra backend setup is needed beyond
        // what messages already require.
        function broadcastToUserChannel(userId, event, payload){
          const sb = getSupabaseClient();
          if (!sb || !userId) return;
          const ch = sb.channel('incoming-calls:' + userId, { config: { broadcast: { self: false } } });
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              ch.send({ type: 'broadcast', event, payload });
              setTimeout(() => { try { sb.removeChannel(ch); } catch (e) { /* ignore */ } }, 1000);
            }
          });
        }

        async function sendCallRing(convoId, type, otherUserId){
          const myId = await getCurrentUserId();
          if (!myId) return;
          const callerName = (typeof profileData !== 'undefined' && profileData.username && `@${profileData.username}`) || (typeof profileData !== 'undefined' && profileData.name) || 'Someone';
          // A group ring also carries the collaboration's name, so the
          // person being rung sees "calling into 'Study group'" rather
          // than a plain 1:1-looking ring (see incomingCallHTML) --
          // otherUserId here is just whichever single member is being
          // rung right now, not the whole group.
          const meta = convoMeta[convoId];
          const isGroup = !!(meta && meta.icon === 'users');
          broadcastToUserChannel(otherUserId, 'ring', {
            convoId, type, fromUserId: myId,
            callerName,
            callerPhoto: (typeof profileData !== 'undefined' && profileData.photo) || null,
            groupName: isGroup ? meta.name : null,
          });
          // Realtime broadcast only reaches the other side if they're
          // actively signed in with the app open right now (see
          // subscribeToIncomingCalls) -- a real push notification is
          // what gets them a ring even if the app/tab is closed.
          sendPushTo(otherUserId, {
            title: isGroup ? `${callerName} is calling "${meta.name}"` : `${callerName} is calling you`,
            body: type === 'video' ? 'Incoming video call' : 'Incoming voice call',
            tag: 'call-' + convoId,
            data: { kind: 'call', convoId, type },
          });
        }

        // Logs a call outcome (missed / declined / duration) as a system
        // line inside the conversation itself -- same place a real chat
        // app shows "Missed call" -- instead of only in the separate
        // Notifications bell. Updates the inbox preview too so it's
        // visible from the Messaging list without opening the thread.
        function logCallEvent(convoId, text){
          if (!convoId) return;
          if (!conversationMessages[convoId]) conversationMessages[convoId] = [];
          conversationMessages[convoId].push({ from: 'system', text, time: Date.now() });
          queueSaveUserState();
          const found = findConvoAndArray(convoId);
          if (found) {
            const [c] = found.arr.splice(found.idx, 1);
            c.preview = text; c.time = formatRequestTime(Date.now());
            if (activeConvoId !== convoId) { c.unread = true; c.read = false; }
            found.arr.unshift(c);
          }
          if (convoMeta[convoId]) convoMeta[convoId].preview = text;
          if (activeConvoId === convoId) {
            const log = document.getElementById('convo-log');
            if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
          }
          const inboxList = document.getElementById('inbox-list');
          if (inboxList) inboxList.innerHTML = inboxContent();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
        }

        // fromUserId matters for group calls specifically: the caller
        // rang several people individually (see startCall's group
        // branch), so when a response comes back the caller needs to
        // know *which* member it's from to check it off
        // callState.pendingRingTargets (see handleCallResponse) instead
        // of assuming there's only ever one person who could have sent
        // it.
        async function sendCallResponse(convoId, toUserId, response){
          const myId = await getCurrentUserId();
          broadcastToUserChannel(toUserId, 'response', { convoId, response, fromUserId: myId });
        }

        // Someone is calling us. If we're already on a call (or already
        // ringing from a different call), respond busy automatically
        // instead of showing a second ring sheet on top of the first.
        function handleIncomingCallRing(payload){
          if (!payload || !payload.convoId) return;
          if (callState.convoId || incomingCallInfo) {
            sendCallResponse(payload.convoId, payload.fromUserId, 'busy');
            return;
          }
          incomingCallInfo = payload;
          openOverlay('incomingCall');
          startIncomingCallRingtone();
          clearTimeout(incomingCallRingTimeout);
          incomingCallRingTimeout = setTimeout(() => declineIncomingCall(true), 45000);
        }

        // A reply to a call WE placed (the other side declined, was busy,
        // or never picked up). Only acts if it matches the call we're
        // actually still ringing on.
        function handleCallResponse(payload){
          if (!payload || !callState.convoId || payload.convoId !== callState.convoId || callState.connected) return;
          if (payload.response === 'declined' || payload.response === 'busy' || payload.response === 'missed') {
            // Group call: one member declining/being busy/not answering
            // doesn't mean the call is over -- others we rang might
            // still pick up. Only actually end it once everyone we rang
            // has responded negatively and still nobody's connected.
            if (callState.pendingRingTargets) {
              callState.pendingRingTargets.delete(payload.fromUserId);
              if (callState.pendingRingTargets.size > 0) return;
            }
            const label = payload.response === 'busy' ? 'Line busy' : payload.response === 'missed' ? 'No answer' : 'Call declined';
            callState.statusOverride = label;
            logCallEvent(callState.convoId, `${callState.type === 'video' ? 'Video' : 'Voice'} call · ${label}`);
            const screen = document.getElementById('call-screen');
            if (screen) screen.outerHTML = callHTML();
            setTimeout(() => endCall(), 1400);
          }
        }

        function acceptIncomingCall(){
          if (!incomingCallInfo) return;
          stopIncomingCallRingtone();
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          const { convoId, type } = incomingCallInfo;
          incomingCallInfo = null;
          if (!conversationMessages[convoId]) conversationMessages[convoId] = [];
          activeConvoId = convoId;
          startCall(convoId, type, true);
        }

        // fromPopState is threaded through to closeOverlay so the
        // hardware/browser back button (see overlayBackAction in
        // overlays.js) can decline a ring the same way the on-screen
        // Decline button does, without also triggering closeOverlay's own
        // history.back() call on top of the back navigation that already
        // just happened.
        // Full-bleed background photo behind the incoming-call screen --
        // matches the plain, dark call-screen look most phones use instead
        // of the app's usual navy/royal gradient.
        const CALL_SCREEN_BG_IMAGE = 'data:image/jpeg;base64,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';

        function declineIncomingCall(isTimeout, fromPopState){
          stopIncomingCallRingtone();
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          if (!incomingCallInfo) { closeOverlay(fromPopState); return; }
          const { convoId, type, fromUserId } = incomingCallInfo;
          sendCallResponse(convoId, fromUserId, isTimeout ? 'missed' : 'declined');
          logCallEvent(convoId, isTimeout ? `Missed ${type === 'video' ? 'video' : 'voice'} call` : `${type === 'video' ? 'Video' : 'Voice'} call declined`);
          incomingCallInfo = null;
          closeOverlay(fromPopState);
        }

        // "Remind Me" on the incoming-call screen: declines the call (logged
        // as missed, same as letting it ring out) and schedules an in-app
        // reminder notification to call this person back. Web apps can't
        // set a real OS-level alarm, so this only fires if the tab/app
        // stays open -- best-effort, same limitation as the rest of the
        // in-app notifications system (see addNotif).
        const CALL_REMINDER_DELAY_MS = 10 * 60 * 1000;
        function remindMeIncomingCall(){
          if (!incomingCallInfo) return;
          stopIncomingCallRingtone();
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          const info = incomingCallInfo;
          sendCallResponse(info.convoId, info.fromUserId, 'missed');
          logCallEvent(info.convoId, `Missed ${info.type === 'video' ? 'video' : 'voice'} call`);
          incomingCallInfo = null;
          closeOverlay();
          setTimeout(() => {
            addNotif({
              type: 'info',
              icon: 'clock',
              iconBg: 'bg-amber-50',
              iconClass: 'text-amber-600',
              name: info.callerName || 'Someone',
              message: `Reminder: call ${info.callerName || 'them'} back`,
              otherUserId: info.fromUserId,
              convoId: info.convoId,
            });
          }, CALL_REMINDER_DELAY_MS);
          if (typeof openAppAlertModal === 'function') {
            openAppAlertModal(`We'll remind you to call ${escapeHtml(info.callerName || 'them')} back in 10 minutes.`);
          }
        }

        // "Message" on the incoming-call screen: declines the call and
        // drops straight into the conversation so you can reply with a
        // quick text instead of talking.
        function messageIncomingCall(){
          if (!incomingCallInfo) return;
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          const info = incomingCallInfo;
          sendCallResponse(info.convoId, info.fromUserId, 'declined');
          logCallEvent(info.convoId, `${info.type === 'video' ? 'Video' : 'Voice'} call declined`);
          incomingCallInfo = null;
          closeOverlay();
          if (info.convoId && typeof openConversation === 'function') openConversation(info.convoId);
        }

        function incomingCallHTML(){
          const info = incomingCallInfo || {};
          const isVideo = info.type === 'video';
          return `
            <div class="flex-1 flex flex-col bg-white text-gray-900" style="padding-top:20px;">
              <div class="flex items-center justify-between px-5 flex-shrink-0">
                <button onclick="declineIncomingCall()" title="Back" class="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-700">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 min-w-0 text-center px-2">
                  <div class="text-sm font-semibold text-gray-500 tracking-wide uppercase font-display">Incoming ${isVideo ? 'Video' : 'Voice'} Call</div>
                </div>
                <div class="w-11 h-11 flex-shrink-0"></div>
              </div>
              <div style="flex:0 0 20%;"></div>
              <div class="flex flex-col items-center px-6 text-center">
                <div class="rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mb-4 shadow-lg" style="width:9rem;height:9rem;">${avatarInnerHTML({ photo: info.callerPhoto, icon: 'user' }, 'w-16 h-16 text-gray-400')}</div>
                <div class="text-2xl font-bold font-display mb-1">${escapeHtml(info.callerName || 'Someone')}</div>
                <div class="text-base text-gray-500">is calling${info.groupName ? ` in "${escapeHtml(info.groupName)}"` : ''}\u2026</div>
              </div>
              <div style="flex:1;"></div>
              <div class="flex-shrink-0 flex items-center justify-center" style="gap:64px;padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 32px);">
                <button onclick="declineIncomingCall()" title="Decline" class="flex flex-col items-center gap-2">
                  <div class="rounded-full flex items-center justify-center shadow-lg" style="width:56px;height:56px;background:#ef4444;">${Icon('phoneHangup','w-6 h-6 text-white')}</div>
                  <div class="text-xs text-gray-600">Decline</div>
                </button>
                <button onclick="acceptIncomingCall()" title="Accept" class="flex flex-col items-center gap-2">
                  <div class="rounded-full flex items-center justify-center shadow-lg" style="width:56px;height:56px;background:#10b981;">${Icon(isVideo ? 'video' : 'phoneOutline','w-6 h-6 text-white')}</div>
                  <div class="text-xs text-gray-600">Accept</div>
                </button>
              </div>
            </div>`;
        }

        // A message just arrived from someone else in real time. If that
        // conversation is open right now, append it straight into the log;
        // otherwise just update the inbox row (preview/unread) so it's
        // visible next time they open Messaging. Either way, the inbox
        // preview itself gets updated to the latest message -- previously
        // this only happened in the "not currently viewing it" branch, so
        // a reply that arrived while the chat was open left the inbox row
        // stuck showing "You are now connected" instead of what was
        // actually just said.
        function handleIncomingMessage(row){
          if (!row || !row.convo_id) return;
          const convoId = row.convo_id;
          if (!conversationMessages[convoId]) conversationMessages[convoId] = [];
          // Realtime (subscribeToIncomingMessages) and the polling
          // fallback (pollForNewMessages, below) can both independently
          // observe the same row -- skip anything already recorded so a
          // message never shows up twice in the log or double-counts
          // toward unread/notifications.
          if (row.id != null && conversationMessages[convoId].some(m => m.id === row.id)) return;
          const isVoice = !!row.voice_url;
          const hasAttachments = Array.isArray(row.attachments) && row.attachments.length > 0;
          conversationMessages[convoId].push({
            id: row.id,
            from: 'them',
            text: row.text || '',
            voice: isVoice ? { src: row.voice_url, duration: row.voice_duration || 0 } : undefined,
            attachments: hasAttachments ? row.attachments : undefined,
            time: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          });
          queueSaveUserState();
          const previewText = isVoice ? '🎤 Voice message' : hasAttachments ? '📷 Photo' : (row.text || 'Attachment');
          // We're already looking at this conversation, so it counts as
          // read the instant it lands -- ack it back to the sender so
          // their ticks turn blue without them needing to reopen the chat.
          if (activeConvoId === convoId && row.sender_id) markConvoMessagesRead(convoId, row.sender_id);

          // Bump this conversation to the top of its list (splice it out,
          // unshift it back) the same way a real chat app surfaces
          // whoever just messaged you, instead of leaving the row wherever
          // it happened to already be.
          const found = findConvoAndArray(convoId);
          let c = null;
          if (found) {
            [c] = found.arr.splice(found.idx, 1);
            c.preview = previewText;
            c.time = formatRequestTime(Date.now());
            if (activeConvoId !== convoId) { c.unread = true; c.read = false; }
            found.arr.unshift(c);
          }

          if (activeConvoId === convoId) {
            const log = document.getElementById('convo-log');
            if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
          } else {
            // Only notify here (in-app bell tab) when the chat wasn't
            // already open above -- someone actively reading the
            // conversation doesn't need a notification about it too.
            if (typeof addNotif === 'function') {
              const meta = convoMeta[convoId] || {};
              const senderName = meta.name || (c && c.name) || 'someone';
              addNotif({
                type: 'message',
                source: 'messages',
                icon: 'comment',
                iconBg: 'bg-emerald-50',
                iconClass: 'text-emerald-600',
                name: senderName,
                // Don't surface the actual message text here -- keep it
                // generic (who it's from, not what it says) and let
                // opening the conversation be how you actually read it.
                message: `New message from ${senderName}`,
                convoId,
                otherUserId: meta.otherUserId || (c && c.otherUserId),
              });
            }
          }
          if (convoMeta[convoId]) convoMeta[convoId].preview = previewText;
          const inboxList = document.getElementById('inbox-list');
          if (inboxList) inboxList.innerHTML = inboxContent();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
        }

        let conversationMessages = {}; // id -> [{from:'me'|'them', text}]
        let activeConvoId = null;

        function openConversation(id){
          activeConvoId = id;
          if (!conversationMessages[id]) {
            conversationMessages[id] = [];
          }
          // Reading it clears the unread state -- the blue dot in the
          // inbox row (see convoRow's showUnread) and the Messaging badge
          // count. Previously nothing ever set read=true/unread=false
          // here, so both stayed stuck "unread" forever once a message
          // arrived, even after you'd opened and read it.
          const found = findConvoAndArray(id);
          if (found && found.arr[found.idx].unread) {
            found.arr[found.idx].unread = false;
            found.arr[found.idx].read = true;
            queueSaveUserState();
          }
          // Reading the conversation -- from Messaging, a notification tap,
          // wherever -- is what clears any matching row in the Notifications
          // bell tab too, instead of it only clearing via "Mark as read".
          if (typeof markNotifsReadForConvo === 'function') markNotifsReadForConvo(id);
          openOverlay('conversation');
          // In desktop split view the chat list (#screen) stays visible
          // beside the open conversation, so re-paint just its rows to
          // move the "active chat" highlight onto the one just opened.
          const inboxList = document.getElementById('inbox-list');
          if (inboxList) inboxList.innerHTML = inboxContent();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();

          // Real (backend-linked) conversations: swap in the actual
          // message history from Supabase once it arrives, so switching
          // between chats doesn't leave stale/placeholder text showing.
          const meta = convoMeta[id];
          if (meta && meta.otherUserId) {
            loadConversationHistory(id).then(() => {
              // Opening the conversation is what "reading" it means here --
              // mark whatever they'd sent us as read so their ticks turn
              // blue (see markConvoMessagesRead/handleMessageReadUpdate).
              markConvoMessagesRead(id, meta.otherUserId);
              if (activeConvoId !== id) return;
              const log = document.getElementById('convo-log');
              if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
            });
            refreshConvoAvatarFromProfile(id);
          }
        }


        function toggleConvoOptionsMenu(){
          const menu = document.getElementById('convo-options-menu');
          const backdrop = document.getElementById('convo-options-menu-backdrop');
          if (!menu) return;
          const opening = menu.classList.contains('hidden');
          menu.classList.toggle('hidden');
          if (backdrop) backdrop.classList.toggle('hidden');
          const log = document.getElementById('convo-log');
          if (log && log._convoOptionsScrollCloser) {
            log.removeEventListener('scroll', log._convoOptionsScrollCloser);
            log._convoOptionsScrollCloser = null;
          }
          // Close the menu if the user scrolls the chat log while it's
          // open, same as tapping the backdrop would.
          if (opening && log) {
            const anchor = log.scrollTop;
            let armed = false;
            setTimeout(() => { armed = true; }, 300);
            const onScroll = () => {
              if (armed && Math.abs(log.scrollTop - anchor) > 4) {
                closeConvoOptionsMenuThen();
              }
            };
            log.addEventListener('scroll', onScroll, { passive: true });
            log._convoOptionsScrollCloser = onScroll;
          }
        }

        function closeConvoOptionsMenuThen(fn){
          const menu = document.getElementById('convo-options-menu');
          const backdrop = document.getElementById('convo-options-menu-backdrop');
          if (menu) menu.classList.add('hidden');
          if (backdrop) backdrop.classList.add('hidden');
          const log = document.getElementById('convo-log');
          if (log && log._convoOptionsScrollCloser) {
            log.removeEventListener('scroll', log._convoOptionsScrollCloser);
            log._convoOptionsScrollCloser = null;
          }
          if (fn) fn();
        }

        // ---- Chat contact profile (the "View profile" screen reachable
        // from the conversation's three-dot menu). Holds its own bits of
        // state -- which chats are favorited and which have notifications
        // muted -- keyed by conversation id, alongside the existing
        // blockedAccounts/reportedConvos state reused from the chat menu.
        let favoriteConvos = new Set();
        let mutedConvoNotifs = new Set();

        function isConvoFavorite(id){ return favoriteConvos.has(id); }
        function isConvoNotifEnabled(id){ return !mutedConvoNotifs.has(id); }

        function toggleFavoriteConvo(){
          if (!activeConvoId) return;
          if (favoriteConvos.has(activeConvoId)) favoriteConvos.delete(activeConvoId);
          else favoriteConvos.add(activeConvoId);
          queueSaveUserState();
          renderConvoProfile();
        }

        function toggleConvoNotifPref(){
          if (!activeConvoId) return;
          if (mutedConvoNotifs.has(activeConvoId)) mutedConvoNotifs.delete(activeConvoId);
          else mutedConvoNotifs.add(activeConvoId);
          queueSaveUserState();
          renderConvoProfile();
        }

        function toggleBlockFromConvoProfile(){
          const meta = convoMeta[activeConvoId];
          if (!meta) return;
          if (isConvoBlocked(meta)) unblockAccount(meta.name);
          else blockAccount(meta.name, meta.icon, meta.avatarBg, meta.photo);
          renderConvoProfile();
        }

        // Deletes the whole chat (not just its messages) and returns to
        // the inbox, unlike "Clear chat" which empties the thread but
        // leaves the conversation itself in the list.
        //
        // The removal itself is split into performDeleteConvoChat so
        // leaveCollaboration/deleteCollaboration -- which already show
        // their own, more specific confirm prompt ("Leave X?" / "Delete X
        // for everyone?") -- can go straight there instead of stacking a
        // second, generic "Delete chat with X?" confirmation on top.
        function performDeleteConvoChat(id){
          if (!id) return;
          [primaryConvos, requestConvos, collabConvos].forEach(arr => {
            const idx = arr.findIndex(c => c.id === id);
            if (idx !== -1) arr.splice(idx, 1);
          });
          delete conversationMessages[id];
          if (activeConvoId === id) activeConvoId = null;
          closeOverlay();
          renderInboxTab();
        }

        function deleteConvoChat(){
          if (!activeConvoId) return;
          const id = activeConvoId;
          const meta = convoMeta[id];
          openAppConfirmModal(`Delete chat with ${meta ? meta.name : 'this contact'}?`, "This can't be undone.", 'Delete', function(){
            performDeleteConvoChat(id);
          });
        }

        // Pulls every image/file attachment and every link shared in the
        // thread so the "Media, links and docs" screen has real content
        // instead of a static placeholder.
        function collectConvoMedia(id){
          const msgs = conversationMessages[id] || [];
          const images = [], docs = [], links = [];
          const urlRe = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
          msgs.forEach(m => {
            (m.attachments || []).forEach(f => {
              if (f.type && f.type.startsWith('image/')) images.push(f);
              else docs.push(f);
            });
            if (m.text) {
              const found = m.text.match(urlRe);
              if (found) found.forEach(u => links.push(u));
            }
          });
          return { images, docs, links };
        }

        function openConvoMediaLinksDocs(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = convoMediaLinksDocsHTML();
        }

        function convoMediaLinksDocsHTML(){
          const meta = convoMeta[activeConvoId] || { name: 'Conversation' };
          const { images, docs, links } = collectConvoMedia(activeConvoId);
          const section = (title, items, renderItem, emptyLabelText) => `
            <div class="mb-6">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">${title} (${items.length})</div>
              ${items.length
                ? `<div class="rounded-2xl border border-gray-100 divide-y bg-white shadow-sm px-4">${items.map(renderItem).join('')}</div>`
                : `<div class="text-sm text-gray-400">${emptyLabelText}</div>`}
            </div>`;
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="px-5 pb-3 flex items-center gap-4">
                <button onclick="openConvoProfile()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display truncate grad-text">Media, links and docs</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-5">
              ${section('Media', images, f => `
                <div class="flex items-center gap-3 py-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 text-[${NAVY}] flex items-center justify-center flex-shrink-0">${Icon('camera','w-5 h-5')}</div>
                  <div class="text-sm text-gray-700 truncate">${escapeHtml(f.name)}</div>
                </div>`, `No photos or videos shared with ${escapeHtml(meta.name)} yet.`)}
              ${section('Docs', docs, f => `
                <div class="flex items-center gap-3 py-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 text-[${NAVY}] flex items-center justify-center flex-shrink-0">${Icon('file','w-5 h-5')}</div>
                  <div class="text-sm text-gray-700 truncate">${escapeHtml(f.name)}</div>
                </div>`, `No documents shared with ${escapeHtml(meta.name)} yet.`)}
              ${section('Links', links, u => `
                <div class="flex items-center gap-3 py-3">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 text-[${NAVY}] flex items-center justify-center flex-shrink-0">${Icon('link','w-5 h-5')}</div>
                  <div class="text-sm text-gray-700 truncate">${u}</div>
                </div>`, `No links shared with ${escapeHtml(meta.name)} yet.`)}
            </div>`;
        }

        function convoProfileRow(icon, iconBg, iconColor, label, sub, onclick, danger){
          return `
            <button onclick="${onclick}" class="w-full flex items-center gap-3 py-3 text-left">
              <div class="w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center ${iconColor} flex-shrink-0">${Icon(icon,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] font-semibold ${danger ? 'text-red-500' : 'text-gray-900'}">${label}</div>
                ${sub ? `<div class="text-xs text-gray-400 mt-0.5">${sub}</div>` : ''}
              </div>
              ${danger ? '' : Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
            </button>`;
        }

        function openConvoProfile(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = convoProfileHTML();
        }

        function renderConvoProfile(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = convoProfileHTML();
        }

        function closeConvoProfile(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = conversationHTML();
        }

        function convoProfileHTML(){
          const meta = convoMeta[activeConvoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Conversation' };
          const isGroup = meta.icon === 'users';
          const blocked = isConvoBlocked(meta);
          const favorited = isConvoFavorite(activeConvoId);
          const notifOn = isConvoNotifEnabled(activeConvoId);
          const { images, docs, links } = collectConvoMedia(activeConvoId);
          const mediaCount = images.length + docs.length + links.length;
          // Every collab thread the contact could plausibly share with the
          // user, aside from a 1:1 chat with them directly.
          const sharedCollabs = isGroup ? [] : collabConvos;
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="px-5 pb-3 flex items-center gap-4">
                <button onclick="closeConvoProfile()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display grad-text">Contact info</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-5">
              <div class="flex flex-col items-center text-center mb-6">
                <div class="relative">
                  <div class="w-24 h-24 ${meta.avatarBg} rounded-full flex items-center justify-center text-gray-600 mb-3 overflow-hidden" onclick="${isGroup ? 'triggerCollabPhotoUpload()' : `openPersonProfileForConvo('${activeConvoId}')`}">${avatarInnerHTML(meta,'w-10 h-10')}</div>
                  ${isGroup ? `<button onclick="triggerCollabPhotoUpload()" class="absolute top-0 right-0 w-7 h-7 rounded-full bg-white border-2 border-white shadow flex items-center justify-center text-gray-600" style="background:${ROYAL};color:white;" title="Change photo">${Icon('camera','w-3.5 h-3.5')}</button>` : ''}
                </div>
                ${isGroup ? `
                  <button onclick="renameCollaboration()" class="flex items-center gap-1.5 max-w-full" title="Rename collaboration">
                    <div class="font-bold text-xl font-display text-[${NAVY}] truncate">${escapeHtml(convoDisplayName(meta))}</div>
                    ${Icon('edit','w-4 h-4 text-gray-400 flex-shrink-0')}
                  </button>
                ` : `<div class="font-bold text-xl font-display text-[${NAVY}]">${escapeHtml(convoDisplayName(meta))}</div>`}
                <div class="text-sm text-gray-400 mt-0.5">${convoLastSeenText(meta)}</div>
              </div>

              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm mb-6">
                ${isGroup ? convoProfileRow('users','bg-emerald-50','text-emerald-600','Members', (meta.members || []).length + ' people', 'openCollabMembers()') : ''}
                ${convoProfileRow('grid','bg-blue-50',`text-[${NAVY}]`,'Media, links and docs', mediaCount + ' items', 'openConvoMediaLinksDocs()')}
              </div>

              <div class="rounded-2xl border border-gray-100 px-4 bg-white shadow-sm mb-6">
                ${notificationSettingsRow('bell','bg-amber-100','text-amber-600','Notifications', notifOn ? 'Allowed for this chat' : 'Muted for this chat', notifOn, 'toggleConvoNotifPref()')}
              </div>

              ${!isGroup ? `
              <div class="mb-6">
                <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Collaborations together</div>
                ${sharedCollabs.length
                  ? `<div class="rounded-2xl border border-gray-100 divide-y bg-white shadow-sm px-4">
                      ${sharedCollabs.map(c => `
                        <button onclick="closeOverlay(); openConversation('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
                          <div class="w-10 h-10 ${c.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-4 h-4')}</div>
                          <div class="flex-1 min-w-0 text-sm text-gray-700 truncate">${escapeHtml(c.name)}</div>
                          ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
                        </button>`).join('')}
                    </div>`
                  : `<div class="text-sm text-gray-400">No collaborations with ${escapeHtml(meta.name)} yet.</div>`}
              </div>` : ''}

              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm mb-6">
                ${convoProfileRow('star','bg-amber-50','text-amber-500', favorited ? 'Remove from favorites' : 'Add to favorites', null, 'toggleFavoriteConvo()')}
              </div>

              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm">
                ${isGroup ? `
                  ${convoProfileRow('logout','bg-red-50','text-red-500', 'Leave collaboration', null, 'leaveCollaboration()', true)}
                  ${(isMe(meta.createdBy) || meta.createdBy === 'me') ? convoProfileRow('trash','bg-red-50','text-red-500', 'Delete collaboration', null, 'deleteCollaboration()', true) : ''}
                ` : `
                  ${convoProfileRow('block','bg-red-50','text-red-500', blocked ? 'Unblock' : 'Block', null, 'toggleBlockFromConvoProfile()', true)}
                  ${convoProfileRow('trash','bg-red-50','text-red-500', 'Delete chat', null, 'deleteConvoChat()', true)}
                `}
              </div>
            </div>`;
        }

        // Conversation reports are real, persistent state (not just an
        // alert): once reported, the id is stored so the menu item flips
        // to "Reported" and won't fire again for that conversation, the
        // same way blocking already worked.
        let reportedConvos = new Set();
        // Message ids this account chose "Delete for me" on -- filtered
        // out of loadConversationHistory's results below so a message
        // deleted locally doesn't reappear next time the chat is opened.
        let deletedForMeMessageIds = new Set();

        function isConvoReported(id){
          return reportedConvos.has(id);
        }

        function reportConvo(){
          const meta = convoMeta[activeConvoId];
          if (!activeConvoId || isConvoReported(activeConvoId)) return;
          reportedConvos.add(activeConvoId);
          queueSaveUserState();
          openAppAlertModal(`${meta ? meta.name : 'This conversation'} has been reported. Our team will review it.`);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = conversationHTML();
        }

        function clearConvoChat(){
          if (!activeConvoId) return;
          conversationMessages[activeConvoId] = [];
          const log = document.getElementById('convo-log');
          if (log) log.innerHTML = convoLogHTML();
        }

        function isConvoBlocked(meta){
          return !!meta && blockedAccounts.some(b => b.name === meta.name);
        }

        // Tapping "Block"/"Unblock" toggles the contact's blocked state.
        // The chat stays open (rather than closing) so the same menu can
        // be reopened afterwards and will now read "Unblock", letting the
        // user reverse the action from right where they blocked it.
        function toggleBlockConvoContact(){
          const meta = convoMeta[activeConvoId];
          if (!meta) return;
          if (isConvoBlocked(meta)) {
            unblockAccount(meta.name);
          } else {
            blockAccount(meta.name, meta.icon, meta.avatarBg, meta.photo);
          }
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = conversationHTML();
        }

        function convoLastSeenText(meta){
          if (meta.icon === 'users') return 'Group';
          return 'last seen recently';
        }

        function conversationHTML(){
          const meta = convoMeta[activeConvoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Conversation' };
          const blocked = isConvoBlocked(meta);
          const reported = isConvoReported(activeConvoId);
          return `
            <div class="px-5 pb-3 flex items-center gap-3 flex-shrink-0 border-b border-gray-100" style="padding-top:20px;">
              <button onclick="closeOverlay()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <div id="chat-header-avatar" class="w-10 h-10 ${meta.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="openPersonProfileForConvo('${activeConvoId}')">${avatarInnerHTML(meta,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0 cursor-pointer" onclick="openPersonProfileForConvo('${activeConvoId}')">
                <div id="chat-header-name" class="font-semibold text-sm font-display truncate grad-text">${escapeHtml(convoDisplayName(meta))}</div>
                <div class="text-xs text-gray-400 truncate">${convoLastSeenText(meta)}</div>
              </div>
              <div class="flex items-center gap-0.5 flex-shrink-0" style="position:relative;">
                <button onclick="startCall('${activeConvoId}','video')" title="Video call" class="p-1">${gradIcon(Icon('video','w-5 h-5'))}</button>
                <button onclick="startCall('${activeConvoId}','audio')" title="Voice call" class="p-1">${gradIcon(Icon('phoneOutline','w-4 h-4'))}</button>
                <button onclick="toggleConvoOptionsMenu()" title="Chat settings" class="p-1">${gradIcon(IconBold('dots','w-5 h-5'))}</button>
                <div id="convo-options-menu" class="hidden bg-white rounded-2xl border border-gray-100 shadow-lg py-1.5 menu-dropdown-inset" style="position:absolute;top:calc(100% + 6px);right:0;width:220px;z-index:30;">
                  <button onclick="closeConvoOptionsMenuThen(() => openConvoProfile())" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 text-left menu-item-pill">${Icon('user','w-4 h-4')} View profile</button>
                  <button onclick="${reported ? '' : `closeConvoOptionsMenuThen(() => reportConvo())`}" ${reported ? 'disabled' : ''} class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left menu-item-pill ${reported ? 'text-gray-400' : 'text-gray-700'}">${Icon('flag','w-4 h-4')} ${reported ? 'Reported' : 'Report'}</button>
                  <button onclick="closeConvoOptionsMenuThen(() => clearConvoChat())" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 text-left menu-item-pill">${Icon('trash','w-4 h-4')} Clear chat</button>
                  <button onclick="closeConvoOptionsMenuThen(() => toggleBlockConvoContact())" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 text-left menu-item-pill">${Icon('block','w-4 h-4')} ${blocked ? 'Unblock' : 'Block'}</button>
                </div>
              </div>
            </div>
            <div id="convo-options-menu-backdrop" class="hidden" onclick="closeConvoOptionsMenuThen()" onwheel="closeConvoOptionsMenuThen()" ontouchmove="closeConvoOptionsMenuThen()" style="position:fixed;inset:0;z-index:25;"></div>
            <div id="convo-log" class="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              ${convoLogHTML()}
            </div>
            <div id="convo-attach-strip" class="flex-shrink-0">${convoAttachStripHTML()}</div>
            <div class="p-3 border-t border-gray-100 flex-shrink-0 flex items-center gap-1.5">
              <input type="file" id="convo-file-input" accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" multiple class="hidden" onchange="handleConvoFileSelect(event)">
              <button onclick="document.getElementById('convo-file-input').click()" title="Attach a file" class="w-8 h-8 bg-gray-100 text-[${NAVY}] rounded-full flex items-center justify-center flex-shrink-0">${Icon('clip','w-4 h-4')}</button>
              <textarea id="convo-input" placeholder="Message" rows="1" enterkeyhint="enter" oninput="autoGrowConvoInput(this)" class="flex-1 min-w-0 bg-gray-100 rounded-2xl px-3 py-2 text-sm resize-none" style="max-height:120px;overflow-y:auto;line-height:1.3;"></textarea>
              <button onclick="toggleConvoVoiceNote()" id="convo-mic-btn" title="Record a voice note" class="w-8 h-8 bg-gray-100 text-[${NAVY}] rounded-full flex items-center justify-center flex-shrink-0">${Icon('mic','w-4 h-4')}</button>
              <button onclick="handleConvoSendTap()" class="w-8 h-8 text-white rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.6);">${Icon('send','w-4 h-4')}</button>
            </div>`;
        }

        // ---- Inbox conversation file attachments ----
        let pendingConvoAttachments = [];

        function convoFileIcon(type){
          if (type && type.startsWith('image/')) return 'camera';
          if (type && type.startsWith('video/')) return 'video';
          return 'file';
        }

        // Image attachments show an actual thumbnail (once its data URL
        // has loaded -- see handleConvoFileSelect); other file types keep
        // the filename-chip look, since there's nothing useful to
        // preview for e.g. a PDF.
        function convoAttachStripHTML(){
          if (!pendingConvoAttachments.length) return '';
          return `
            <div class="px-4 pt-3 flex gap-2 flex-wrap">
              ${pendingConvoAttachments.map((f,i) => {
                const isImg = f.type && f.type.startsWith('image/');
                if (isImg && f.dataUrl) {
                  return `
                    <div class="relative flex-shrink-0" style="width:52px;height:52px;">
                      <img src="${f.dataUrl}" class="w-full h-full object-cover rounded-xl">
                      <button onclick="removeConvoAttachment(${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center">${Icon('close','w-3 h-3')}</button>
                    </div>`;
                }
                return `
                  <div class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700">
                    <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(convoFileIcon(f.type),'w-3.5 h-3.5')}</div>
                    <span class="max-w-[120px] truncate">${escapeHtml(f.name)}</span>
                    <button onclick="removeConvoAttachment(${i})" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                  </div>`;
              }).join('')}
            </div>`;
        }

        // Previously this only kept {name, type} -- never the actual file
        // bytes -- so a picked image had nothing to preview, nothing to
        // show full-size on tap, and nothing to upload/deliver. Now it
        // also keeps the raw File (for uploading -- see
        // uploadConvoAttachmentsToStorage) and, for images, a data URL
        // read in the background (for the instant local thumbnail/
        // preview, same idea as the voice-note recorder).
        //
        // `allowed` used to only match images, PDFs, and PowerPoint --
        // every video and every other document type (Word, Excel, plain
        // text, zip...) silently failed this test and never even got
        // added to pendingConvoAttachments, so picking one looked like it
        // worked (the file picker let you choose it) but nothing was ever
        // queued to send. That's the real reason those never "went
        // through" -- it wasn't a delivery problem, they never left the
        // picker. Broadened to match the file input's own `accept` list
        // above (image/*, video/*, pdf/office/text/zip).
        function handleConvoFileSelect(event){
          const files = Array.from(event.target.files || []);
          const allowed = /^image\/|^video\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|application\/vnd\.ms-powerpoint|text\/plain|text\/csv|application\/zip/;
          files.forEach(f => {
            const okType = allowed.test(f.type) || /\.(pdf|pptx?|docx?|xlsx?|csv|txt|zip|jpe?g|png|gif|webp|mp4|mov|webm|mkv|m4v)$/i.test(f.name);
            if (!okType) return;
            const entry = { name: f.name, type: f.type, dataUrl: null, file: f };
            pendingConvoAttachments.push(entry);
            if (f.type && f.type.startsWith('image/')) {
              const reader = new FileReader();
              reader.onload = () => {
                entry.dataUrl = reader.result;
                const strip = document.getElementById('convo-attach-strip');
                if (strip) strip.innerHTML = convoAttachStripHTML();
              };
              reader.readAsDataURL(f);
            }
          });
          event.target.value = '';
          const strip = document.getElementById('convo-attach-strip');
          if (strip) strip.innerHTML = convoAttachStripHTML();
        }

        function removeConvoAttachment(i){
          pendingConvoAttachments.splice(i, 1);
          const strip = document.getElementById('convo-attach-strip');
          if (strip) strip.innerHTML = convoAttachStripHTML();
        }

        // ---- DM voice notes: record real audio via getUserMedia +
        // MediaRecorder and send it as a playable message bubble. Tap the
        // mic to start recording, tap again (or send) to stop and send;
        // the recorded clip is embedded as a data URL so it plays back
        // with a normal <audio> element in the chat log.
        let convoRecorder = null;
        let convoRecordedChunks = [];
        let convoRecordStream = null;
        let convoRecording = false;
        let convoRecordStartTs = 0;
        let convoRecordTimerInterval = null;

        // Pending recording captured but not yet sent -- set by the mic/
        // pause button (stopConvoVoiceNote(false)) once recording stops,
        // and cleared once handleConvoSendTap() actually sends it (or the
        // user records over it again). Tapping the mic mid-recording now
        // only pauses/stops the capture; it's the actual send button
        // (paper plane) that sends it, matching every other messaging
        // app's record -> review -> send flow.
        let convoPendingVoice = null;

        async function toggleConvoVoiceNote(){
          if (convoRecording) { stopConvoVoiceNote(false); return; }
          if (convoPendingVoice) { discardConvoPendingVoice(); return; }
          if (!activeConvoId) return;
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
            flashConvoMicMessage('Voice notes not supported here');
            return;
          }
          try {
            convoRecordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch (err) {
            flashConvoMicMessage(err && err.name === 'NotAllowedError' ? 'Mic access denied' : 'Mic unavailable');
            return;
          }
          // The permission prompt is async; bail if the user navigated
          // away from this conversation while it was open.
          if (!activeConvoId || !document.getElementById('convo-mic-btn')) {
            convoRecordStream.getTracks().forEach(t => t.stop());
            convoRecordStream = null;
            return;
          }
          convoRecordedChunks = [];
          try {
            convoRecorder = new MediaRecorder(convoRecordStream);
          } catch (err) {
            flashConvoMicMessage('Recording not supported here');
            convoRecordStream.getTracks().forEach(t => t.stop());
            convoRecordStream = null;
            return;
          }
          convoRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) convoRecordedChunks.push(e.data); };
          convoRecorder.onstop = handleConvoVoiceNoteStop;
          convoRecorder.start();
          convoRecording = true;
          convoRecordStartTs = Date.now();
          setConvoMicRecordingUI(true);
          convoRecordTimerInterval = setInterval(updateConvoRecordTimer, 250);
        }

        function updateConvoRecordTimer(){
          const inputEl = document.getElementById('convo-input');
          if (inputEl) inputEl.placeholder = `Recording... ${formatCallTime(Math.floor((Date.now() - convoRecordStartTs) / 1000))}`;
        }

        // Three visual states for the mic button: idle (mic icon), actively
        // recording (red pulsing stop icon), and paused with a clip ready
        // to send (a trash icon -- tapping it now discards the pending
        // clip instead of re-sending it, since sending is the paper
        // plane's job).
        function setConvoMicRecordingUI(on){
          const micBtn = document.getElementById('convo-mic-btn');
          const inputEl = document.getElementById('convo-input');
          if (micBtn) {
            const pending = !on && convoPendingVoice;
            micBtn.classList.toggle('bg-red-500', on);
            micBtn.classList.toggle('text-white', on);
            micBtn.classList.toggle('bg-gray-100', !on && !pending);
            micBtn.classList.toggle('text-[' + NAVY + ']', !on && !pending);
            micBtn.innerHTML = Icon(on ? 'square' : (pending ? 'trash' : 'mic'), 'w-4 h-4');
            micBtn.style.animation = on ? 'pulse 1s infinite' : '';
            micBtn.title = on ? 'Pause recording' : (pending ? 'Discard voice note' : 'Record a voice note');
          }
          if (inputEl) inputEl.placeholder = (!on && convoPendingVoice) ? `Voice note ready (${formatCallTime(convoPendingVoice.durationSecs)}) -- tap send` : 'Message';
        }

        function stopConvoVoiceNote(send){
          if (convoRecorder && convoRecording) {
            convoRecorder._shouldSend = send;
            try { convoRecorder.stop(); } catch (e) {}
          }
          convoRecording = false;
          if (convoRecordTimerInterval) { clearInterval(convoRecordTimerInterval); convoRecordTimerInterval = null; }
        }

        // Stopping the recorder (via the mic/pause button) no longer sends
        // immediately -- it stashes the clip as convoPendingVoice so the
        // send button can send it, or the mic button (now showing a trash
        // icon) can discard it.
        function handleConvoVoiceNoteStop(){
          const durationSecs = Math.max(1, Math.round((Date.now() - convoRecordStartTs) / 1000));
          const blob = new Blob(convoRecordedChunks, { type: (convoRecorder && convoRecorder.mimeType) || 'audio/webm' });
          if (convoRecordStream) { convoRecordStream.getTracks().forEach(t => t.stop()); convoRecordStream = null; }
          convoRecorder = null;
          convoRecordedChunks = [];
          if (blob.size === 0 || !activeConvoId) { setConvoMicRecordingUI(false); return; }
          const reader = new FileReader();
          reader.onload = () => {
            convoPendingVoice = { dataUrl: reader.result, durationSecs, blob };
            setConvoMicRecordingUI(false);
          };
          reader.readAsDataURL(blob);
        }

        function discardConvoPendingVoice(){
          convoPendingVoice = null;
          setConvoMicRecordingUI(false);
        }

        // The paper-plane send button: sends whatever's ready to go --
        // a pending recorded voice note if there is one (stopping an
        // in-progress recording first if needed), otherwise the typed
        // text message.
        function handleConvoSendTap(){
          if (convoRecording) { stopConvoVoiceNote(false); return; }
          if (convoPendingVoice) {
            const { dataUrl, durationSecs, blob } = convoPendingVoice;
            convoPendingVoice = null;
            sendConvoVoiceNote(dataUrl, durationSecs, blob);
            setConvoMicRecordingUI(false);
            return;
          }
          sendConvoMessage();
        }

        function flashConvoMicMessage(msg){
          const inputEl = document.getElementById('convo-input');
          if (!inputEl) return;
          const prev = inputEl.placeholder;
          inputEl.placeholder = msg;
          setTimeout(() => { if (inputEl) inputEl.placeholder = prev || 'Message'; }, 1800);
        }

        function sendConvoVoiceNote(dataUrl, durationSecs, blob){
          if (!activeConvoId) return;
          const message = { from: 'me', voice: { src: dataUrl, duration: durationSecs }, time: Date.now(), read: false };
          conversationMessages[activeConvoId].push(message);
          const log = document.getElementById('convo-log');
          if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
          queueSaveUserState();
          const convoIdAtSend = activeConvoId;
          updateConvoPreview(convoIdAtSend, '🎤 Voice message');

          const meta = convoMeta[convoIdAtSend];
          if (meta && meta.otherUserId && blob) {
            // Upload first, then insert the message row -- the recipient
            // has nothing to fetch until the clip actually exists in
            // Storage, so this can't be fired in parallel with the insert
            // the way sendConvoMessage fires text (there's nothing to
            // upload there).
            uploadConvoVoiceToStorage(blob, convoIdAtSend).then(url => {
              if (!url) {
                console.warn('Voice note stayed local-only (upload failed) -- the other account will not receive it.');
                // Visible, not just console-only: silently failing here is
                // exactly what made voice notes look "not live" -- it
                // played fine for the sender (local data URL) and gave no
                // sign the other person never got it. Most common cause:
                // the "chat-voice-notes" Storage bucket doesn't exist yet
                // in this Supabase project (or isn't public/writable).
                flashConvoMicMessage('Voice note not sent (upload failed)');
                return;
              }
              sendMessageRemote(convoIdAtSend, meta.otherUserId, '', url, durationSecs).then(id => {
                if (id) {
                  message.id = id;
                  refreshConvoLogIfOpen(convoIdAtSend);
                }
              });
            });
          }
        }

        // A centered "Today" / "Yesterday" / "Monday" / "Jan 5" pill,
        // inserted once before the first message of each new calendar
        // day -- kept on its own row, separate from any per-message
        // time, so it never reads as crowded together with a bubble's
        // own timestamp (see formatConvoBubbleTime below).
        function formatConvoDateSeparator(ts){
          const d = new Date(ts);
          const now = new Date();
          const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
          if (diffDays === 0) return 'Today';
          if (diffDays === 1) return 'Yesterday';
          if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
        }

        // Small per-bubble time (e.g. "11:11 PM"), shown once under each
        // message instead of next to the date pill.
        function formatConvoBubbleTime(ts){
          return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        }

        function convoLogHTML(){
          const meta = convoMeta[activeConvoId] || { icon: 'user', avatarBg: 'bg-gray-100' };
          const msgs = conversationMessages[activeConvoId] || [];
          let lastDateKey = null;
          return msgs.map(m => {
            const ts = m.time || Date.now();
            const dateKey = new Date(ts).toDateString();
            let separator = '';
            if (dateKey !== lastDateKey) {
              lastDateKey = dateKey;
              separator = `<div class="flex justify-center py-1"><div class="text-[11px] font-medium text-gray-400 bg-gray-100 rounded-full px-3 py-1">${formatConvoDateSeparator(ts)}</div></div>`;
            }
            const timeLabel = formatConvoBubbleTime(ts);
            if (m.from === 'system') {
              return separator + `<div class="flex justify-center"><div class="text-[11px] text-gray-400 bg-gray-50 rounded-full px-3 py-1">${escapeHtml(m.text)}</div></div>`;
            }
            // Images and voice notes are "media" -- they get their own
            // clean surface instead of sitting inside the heavy colored
            // (mine) / gray (theirs) text bubble, matching how they look
            // in most messaging apps: the photo/waveform itself, not a
            // photo painted over with a solid color block. Plain text
            // (and any non-image file chips) still get the normal bubble.
            const images = (m.attachments || []).filter(f => f.type && f.type.startsWith('image/') && (f.dataUrl || f.url));
            const videos = (m.attachments || []).filter(f => f.type && f.type.startsWith('video/') && (f.url || f.file));
            const files = (m.attachments || []).filter(f => !images.includes(f) && !videos.includes(f));
            const hasBubbleContent = !!m.text || files.length > 0;
            const mine = m.from === 'me';
            // Voice notes render as their own standalone chip (see
            // convoVoiceNoteHTML) rather than being nested inside the
            // colored/gray text bubble below -- otherwise they'd end up
            // double-wrapped (chip inside bubble), right back to the
            // heavy blue background the images fix was meant to avoid.
            const voiceHTML = m.voice ? convoVoiceNoteHTML(m.voice, mine, m) : '';
            const bubbleHTML = hasBubbleContent ? (
              mine
                ? `<div class="text-white rounded-2xl px-4 py-2.5 text-sm" style="background:linear-gradient(135deg, rgba(65,105,225,0.55), rgba(65,105,225,0.35));">${convoFileAttachmentsHTML(files, mine)}${m.text}</div>`
                : `<div class="bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-700">${convoFileAttachmentsHTML(files, mine)}${m.text}</div>`
            ) : '';
            const imagesHTML = convoImageAttachmentsHTML(images);
            const videosHTML = convoVideoAttachmentsHTML(videos);
            const footer = mine
              ? `<div class="flex items-center gap-1 mt-1 px-1">
                   <span class="text-[10px] text-gray-400">${timeLabel}</span>
                   ${convoReadTicksHTML(m)}
                 </div>`
              : `<div class="text-[10px] text-gray-400 mt-1 px-1">${timeLabel}</div>`;
            const content = `
              <div class="flex flex-col ${mine ? 'items-end' : 'items-start'} gap-1" style="max-width:75%;">
                ${imagesHTML}
                ${videosHTML}
                ${voiceHTML}
                ${bubbleHTML}
                ${footer}
              </div>`;
            const pressKey = `${activeConvoId}|${ts}`;
            const pressHandlers = `onmousedown="startPress('messageLongPress','${pressKey}', event)" onmouseup="endPress()" onmouseleave="endPress()" ontouchstart="startPress('messageLongPress','${pressKey}', event)" ontouchend="endPress()" ontouchmove="movePress(event)" ontouchcancel="endPress()"`;
            const bubble = m.from === 'them' ? `
            <div class="flex items-start gap-3" ${pressHandlers}>
              <div class="w-8 h-8 ${meta.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForConvo('${activeConvoId}')">${avatarInnerHTML(meta,'w-4 h-4')}</div>
              ${content}
            </div>` : `
            <div class="flex items-start justify-end gap-3" ${pressHandlers}>
              ${content}
            </div>`;
            return separator + bubble;
          }).join('');
        }

        // ---- Long-press a message: "Delete for me" / "Delete for
        // everyone" / Cancel ----
        // Reuses the same startPress/endPress/movePress hold-to-trigger
        // helpers Inbox rows use (see overlays.js) -- a message is
        // identified by "<convoId>|<its time>" since freshly-sent
        // messages don't get a real Supabase id until the send round
        // trip finishes (see sendConvoMessage), but `time` is set the
        // instant the message is created and never changes afterward.
        let messageActionConvoId = null;
        let messageActionTime = null;

        function messageLongPress(key){
          const sep = key.lastIndexOf('|');
          if (sep === -1) return;
          messageActionConvoId = key.slice(0, sep);
          messageActionTime = Number(key.slice(sep + 1));
          if (navigator.vibrate) navigator.vibrate(10);
          let sheet = document.getElementById('message-action-sheet');
          if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'message-action-sheet';
            document.body.appendChild(sheet);
          }
          sheet.innerHTML = messageActionSheetHTML();
        }

        function closeMessageActionSheet(){
          const sheet = document.getElementById('message-action-sheet');
          if (sheet) sheet.remove();
          messageActionConvoId = null;
          messageActionTime = null;
        }

        function messageActionSheetHTML(){
          return `
            <div class="fixed inset-0 flex items-end justify-center" style="background:rgba(0,0,0,0.35);z-index:60;" onclick="closeMessageActionSheet()">
              <div class="bg-white w-full rounded-t-3xl overflow-hidden" style="max-width:480px;padding-bottom:env(safe-area-inset-bottom, 0px);" onclick="event.stopPropagation()">
                <div class="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-2.5 mb-1"></div>
                <button onclick="deleteActionMessageForMe()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-gray-800 border-b border-gray-100">Delete for me</button>
                <button onclick="deleteActionMessageForEveryone()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-red-500 border-b border-gray-100">Delete for everyone</button>
                <button onclick="closeMessageActionSheet()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-gray-500">Cancel</button>
              </div>
            </div>`;
        }

        function deleteActionMessageForMe(){
          const convoId = messageActionConvoId;
          const time = messageActionTime;
          closeMessageActionSheet();
          if (!convoId || time == null) return;
          const msgs = conversationMessages[convoId] || [];
          const idx = msgs.findIndex(m => m.time === time);
          if (idx === -1) return;
          // Remembers the id (if it already has one) so a later reopen of
          // this chat -- which re-fetches the full thread from Supabase --
          // doesn't just bring the "deleted" message right back (see the
          // filter in loadConversationHistory).
          if (msgs[idx].id != null) deletedForMeMessageIds.add(msgs[idx].id);
          msgs.splice(idx, 1);
          refreshConvoLogIfOpen(convoId);
          queueSaveUserState();
        }

        function deleteActionMessageForEveryone(){
          const convoId = messageActionConvoId;
          const time = messageActionTime;
          closeMessageActionSheet();
          if (!convoId || time == null) return;
          const msgs = conversationMessages[convoId] || [];
          const idx = msgs.findIndex(m => m.time === time);
          if (idx === -1) return;
          const [removed] = msgs.splice(idx, 1);
          refreshConvoLogIfOpen(convoId);
          queueSaveUserState();
          // Best-effort remote delete so it disappears for the other
          // side(s) too, live -- not just here. RLS on the `messages`
          // table only lets the sender delete their own row(s) (see the
          // policy below) -- if this was someone else's message, the
          // delete is silently rejected and it simply stays removed on
          // this side only, same as "Delete for me" above.
          //
          //   create policy "Sender can delete their own message" on messages
          //     for delete using (auth.uid() = sender_id);
          //
          // Deleting by local_id (not id) is what makes this actually
          // remove a *group* message for everyone: a collaboration
          // message is fanned out as one row per member, each with its
          // own distinct id but the same local_id (see sendConvoMessage),
          // so matching on local_id clears every member's copy in one
          // call instead of just the single row `removed.id` happens to
          // point at. Falls back to matching by id for older rows sent
          // before local_id existed, or receiver-side voice notes.
          if (removed) {
            const sb = getSupabaseClient();
            if (sb) {
              const query = removed.localId
                ? sb.from(MESSAGES_TABLE).delete().eq('convo_id', convoId).eq('local_id', removed.localId)
                : (removed.id != null ? sb.from(MESSAGES_TABLE).delete().eq('id', removed.id) : null);
              if (query) {
                query.then(({ error }) => {
                  if (error) console.warn('Deleting message for everyone failed:', error);
                });
              }
            }
          }
        }

        // A voice-note bubble: a real <audio> element (playable, since the
        // clip is embedded as a data URL) plus a mic icon and duration
        // label so it reads clearly as a recorded message rather than a
        // text one. onerror swaps in a visible "Couldn't load" message
        // instead of leaving a silently-broken player -- the most common
        // cause is the chat-voice-notes Storage bucket existing but not
        // actually being marked Public in Supabase, which still lets
        // getPublicUrl() return a URL (so the bubble looks fine) but 403s
        // the moment a browser tries to actually fetch and play it.
        //
        // For a received note (!mine), onplay reports it read the moment
        // playback actually starts -- see markVoiceMessageAsPlayed -- so
        // the sender's ticks reflect "listened to", not just "the chat was
        // open". Guarded on m.id existing: a note that hasn't finished its
        // own upload/insert round trip yet has no row to mark read against.
        //
        // Kept as a light, low-saturation chip rather than the heavy blue
        // (mine) / gray (theirs) gradient the surrounding bubble would
        // otherwise use -- same "media shouldn't be painted over" idea as
        // images (see convoImageAttachmentsHTML).
        function convoVoiceNoteHTML(voice, mine, m){
          const uid = 'voice-' + Math.random().toString(36).slice(2, 9);
          const chipBg = mine ? 'rgba(255,255,255,0.16)' : '#ffffff';
          const iconBg = mine ? 'rgba(255,255,255,0.25)' : '#e5e7eb';
          const fg = mine ? '#ffffff' : NAVY;
          const durationColor = mine ? 'rgba(255,255,255,0.85)' : '#6b7280';
          const onplay = (!mine && m && m.id != null) ? ` onplay="markVoiceMessageAsPlayed('${activeConvoId}','${m.id}')"` : '';
          return `
            <div class="flex items-center gap-2 rounded-2xl px-2.5 py-1.5" style="background:${chipBg};min-width:170px;">
              <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:${iconBg};color:${fg};">${Icon('mic','w-3.5 h-3.5')}</div>
              <audio id="${uid}" controls preload="none" src="${voice.src}"${onplay} style="height:32px;max-width:180px;flex:1;" onerror="document.getElementById('${uid}').outerHTML='<span class=&quot;text-xs italic ${mine ? 'text-white/80' : 'text-gray-400'}&quot;>Couldn\'t load voice note</span>'"></audio>
              <span class="text-xs flex-shrink-0" style="color:${durationColor};">${formatCallTime(voice.duration)}</span>
            </div>`;
        }

        // Actual tappable image thumbnails -- rendered outside/above the
        // colored text bubble (not inside it) so a photo shows as itself,
        // not as a photo sitting on a solid color block. Tapping opens it
        // full-screen (see openConvoImageViewer). `src` prefers a real
        // uploaded url (delivered messages) and falls back to the local
        // data URL (still-sending / local-only messages).
        function convoImageAttachmentsHTML(images){
          if (!images || !images.length) return '';
          return `
            <div class="flex flex-col gap-1.5">
              ${images.map(f => {
                const src = f.url || f.dataUrl;
                return `<img src="${src}" alt="${escapeHtml(f.name || 'Photo')}" onclick="openConvoImageViewer('${encodeURIComponent(src)}')" class="cursor-pointer" style="max-width:220px;max-height:280px;width:100%;border-radius:16px;object-fit:cover;display:block;">`;
              }).join('')}
            </div>`;
        }

        // Non-image attachments (pdf, docs, zip...) still show as a
        // filename chip inside the normal text bubble -- there's no
        // useful inline preview for those, unlike photos. Wrapped in a
        // real link (rather than being a static, unclickable chip) so
        // tapping it actually opens/downloads the file -- previously
        // there was nothing here to tap at all, so even a file that had
        // successfully reached the other side had no way to be opened
        // once it arrived. Local-only attachments (still uploading, or
        // upload failed -- no f.url yet) render as plain, non-clickable
        // chips since there's nothing to open yet.
        function convoFileAttachmentsHTML(files, mine){
          if (!files || !files.length) return '';
          return `
            <div class="flex flex-col gap-1.5 mb-1.5">
              ${files.map(f => {
                const chip = `
                  <div class="flex items-center gap-2 ${mine ? 'bg-white/15' : 'bg-black/5'} rounded-xl px-2.5 py-1.5">
                    ${Icon(convoFileIcon(f.type),'w-4 h-4')}<span class="text-xs truncate">${escapeHtml(f.name)}</span>
                  </div>`;
                return f.url ? `<a href="${f.url}" target="_blank" rel="noopener" download="${escapeHtml(f.name || '')}" class="no-underline">${chip}</a>` : chip;
              }).join('')}
            </div>`;
        }

        // Video attachments get an actual inline <video> player, same
        // idea as convoImageAttachmentsHTML for photos -- previously any
        // video fell into the plain filename-chip bucket above with no
        // way to preview or play it in place. `src` prefers the real
        // uploaded url; a still-sending video (no url yet) falls back to
        // an in-browser object URL off the raw File so it can at least
        // preview locally before delivery finishes.
        function convoVideoAttachmentsHTML(videos){
          if (!videos || !videos.length) return '';
          return `
            <div class="flex flex-col gap-1.5">
              ${videos.map(f => {
                const src = f.url || (f.file ? URL.createObjectURL(f.file) : '');
                if (!src) return '';
                return `<video controls preload="metadata" src="${src}" style="max-width:220px;max-height:280px;width:100%;border-radius:16px;display:block;"></video>`;
              }).join('')}
            </div>`;
        }

        // Read-receipt ticks, WhatsApp-style: a single gray check for a
        // message that's only sent locally (no real recipient to confirm
        // delivery -- e.g. a local-only mock contact), a double gray
        // check once it's actually synced to Supabase (m.id is only set
        // once that insert comes back -- see sendConvoMessage/
        // sendConvoVoiceNote), and double blue once the recipient has
        // opened the conversation and it's been marked read (m.read --
        // see markConvoMessagesRead/handleMessageReadUpdate).
        function convoReadTicksHTML(m){
          if (!m.id) return `<span class="flex-shrink-0" style="color:#9ca3af;">${Icon('checkSingle','w-3.5 h-3.5')}</span>`;
          const color = m.read ? '#34b7f1' : '#9ca3af';
          return `<span class="flex-shrink-0" style="color:${color};" title="${m.read ? 'Read' : 'Delivered'}">${Icon('checkDouble','w-3.5 h-3.5')}</span>`;
        }

        // Fullscreen tap-to-view for a chat image (see
        // convoImageAttachmentsHTML). Built/torn down via direct DOM
        // insertion, same pattern used elsewhere in this file (e.g.
        // openInboxFilterMenuDom), rather than a hidden modal baked into
        // the app shell -- chat.js doesn't own that shell markup.
        function openConvoImageViewer(encodedSrc){
          closeConvoImageViewer();
          const src = decodeURIComponent(encodedSrc);
          const modal = document.createElement('div');
          modal.id = 'convoImageViewerModal';
          modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
          modal.style.background = '#000';
          modal.onclick = closeConvoImageViewer;
          modal.innerHTML = `
            <button onclick="event.stopPropagation();closeConvoImageViewer()" class="absolute top-0 right-0 w-11 h-11 flex items-center justify-center text-white" style="margin:calc(env(safe-area-inset-top, 12px) + 12px) 12px 0 0;">${Icon('close','w-6 h-6')}</button>
            <img src="${src}" onclick="event.stopPropagation();" class="w-full h-auto max-h-full object-contain">`;
          document.body.appendChild(modal);
        }

        function closeConvoImageViewer(){
          const modal = document.getElementById('convoImageViewerModal');
          if (modal) modal.remove();
        }

        // Keeps the inbox list's preview line in sync with what's actually
        // been said, instead of getting stuck on the placeholder shown
        // right after connecting (see acceptRequest/loadMyAcceptedOutgoingRequests
        // above, both of which seed preview: 'You are now connected').
        function updateConvoPreview(convoId, previewText){
          // Bump it to the top of its list too, same as an incoming
          // message does (see handleIncomingMessage) -- sending a message
          // in an old conversation should surface it, not leave it buried.
          const found = findConvoAndArray(convoId);
          if (found) {
            const [c] = found.arr.splice(found.idx, 1);
            c.preview = previewText; c.time = formatRequestTime(Date.now()); c.unread = false; c.read = true;
            found.arr.unshift(c);
          }
          if (convoMeta[convoId]) convoMeta[convoId].preview = previewText;
          if (currentTab === 3) renderInboxTab();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
        }

        // The message box used to be a plain single-line <input>, whose
        // Enter key was wired straight to sendConvoMessage() -- so there
        // was no way to type a multi-line message at all; hitting Return
        // to start a new line just fired the send instead. It's a
        // <textarea> now (see convoOverlayHTML above), which supports
        // real newlines on its own, so Enter is left doing exactly what
        // it does anywhere else you type: adds a line break. Sending only
        // happens via the paper-plane button (handleConvoSendTap).
        // Auto-grows with typed content, up to the max-height set in the
        // textarea's own style (120px), then scrolls internally past that
        // instead of pushing the rest of the chat screen around forever.
        function autoGrowConvoInput(el){
          el.style.height = 'auto';
          el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        }

        function sendConvoMessage(){
          const inputEl = document.getElementById('convo-input');
          const text = inputEl ? inputEl.value.trim() : '';
          // pendingConvoAttachments entries carry a raw `file` (for
          // uploading) alongside the display fields -- keep that out of
          // the persisted message object (queueSaveUserState below would
          // otherwise try to serialize a File, which doesn't survive
          // JSON.stringify) and only pass it along to the upload step.
          const attachmentsForUpload = pendingConvoAttachments;
          const attachments = attachmentsForUpload.map(f => ({ name: f.name, type: f.type, dataUrl: f.dataUrl }));
          if (!text && !attachments.length) return;
          if (!activeConvoId) return;
          pendingConvoAttachments = [];
          const message = { from: 'me', text, attachments, time: Date.now(), read: false, localId: 'lm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) };
          conversationMessages[activeConvoId].push(message);
          if (inputEl) { inputEl.value = ''; inputEl.style.height = 'auto'; }
          const log = document.getElementById('convo-log');
          if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
          const strip = document.getElementById('convo-attach-strip');
          if (strip) strip.innerHTML = convoAttachStripHTML();
          queueSaveUserState();
          const convoIdAtSend = activeConvoId;
          const isPhoto = attachments.length && attachments[0].type && attachments[0].type.startsWith('image/');
          updateConvoPreview(convoIdAtSend, text || (isPhoto ? '📷 Photo' : (attachments.length ? `📎 ${attachments[0].name}` : 'Attachment')));

          const meta = convoMeta[convoIdAtSend];
          (async () => {
            // Attachments upload first (same reasoning as voice notes --
            // see sendConvoVoiceNote): the recipient has nothing to fetch
            // until the file actually exists in Storage.
            let uploaded = [];
            if (attachmentsForUpload.length && meta && (meta.otherUserId || (meta.icon === 'users' && Array.isArray(meta.members)))) {
              uploaded = await uploadConvoAttachmentsToStorage(attachmentsForUpload, convoIdAtSend);
              if (attachmentsForUpload.length && !uploaded.length) {
                flashConvoMicMessage('Attachment not sent (upload failed)');
              }
            }
            if (meta && meta.otherUserId) {
              // Real connection: actually deliver it via Supabase so the
              // other account receives it (see subscribeToIncomingMessages).
              if (text || uploaded.length) {
                const id = await sendMessageRemote(convoIdAtSend, meta.otherUserId, text, null, null, uploaded, message.localId);
                if (id) {
                  message.id = id;
                  refreshConvoLogIfOpen(convoIdAtSend);
                }
              }
            } else if (meta && meta.icon === 'users' && Array.isArray(meta.members) && (text || uploaded.length)) {
              // Collaboration (group): fan out one row per member (besides
              // ourselves) into the same `messages` table 1:1 chats use, all
              // sharing this convo_id -- each member's own
              // subscribeToIncomingMessages() picks their copy up the same
              // way a direct message would arrive. (Group reads aren't
              // tracked per-member, so these rows don't feed back into
              // this message's own tick color.) Every fan-out row also
              // shares message.localId, so "delete for everyone" (see
              // deleteActionMessageForEveryone) can find and remove all of
              // them together even though each has a different id.
              meta.members.forEach(m => {
                if (m.mine || !m.otherUserId) return;
                sendMessageRemote(convoIdAtSend, m.otherUserId, text, null, null, uploaded, message.localId);
              });
            }
            // No known backend user(s) on the other end (e.g. every member
            // is still a local-only mock contact) -- the message just sits
            // sent, same as it would in a real messaging app if nobody's
            // replied yet.
          })();
        }

        // ---------------- VOICE / VIDEO CALL ----------------
        // Real peer-to-peer calling over WebRTC. Supabase Realtime's
        // broadcast channels are used purely as the signaling layer (to
        // exchange SDP offers/answers and ICE candidates) - the actual
        // audio/video never passes through Supabase, it flows directly
        // between the two browsers once connected.
        //
        // Room = `call:${convoId}`. A real ring + push notification (see
        // sendCallRing / subscribeToIncomingCalls above) tells the other
        // account a call is coming in and joins them into the same room
        // when they hit Accept -- this only fires for conversations with
        // a known otherUserId (i.e. ones that came from an accepted
        // connection request; see the note on sendMessageRemote above).
        // For any other conversation, calling still opens the call
        // screen and joins the WebRTC room, but nobody is notified --
        // the "other side" would have to already be sitting in that same
        // conversation and tap Call at the same time for it to connect.
        //
        // STUN-only cannot traverse every network (symmetric NATs,
        // some corporate/mobile carrier networks) -- without a TURN
        // relay, two peers behind networks like that will ring/connect
        // signaling-wise but never actually see/hear each other, which
        // is the single most common reason a "call connects" but no
        // audio/video ever comes through. RTC_ICE_SERVERS below includes
        // a free public TURN relay (Open Relay Project / metered.ca) as
        // a fallback on top of STUN so this works across more real-world
        // networks; swap in your own TURN credentials for production use
        // -- the public one is rate-limited and not meant to carry real
        // traffic long-term.
        let callState = { convoId: null, type: 'audio', connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null, pendingRingTargets: null };
        let callRingTimeout = null;
        let callAnswerTimeout = null;
        let callTickInterval = null;
        let callLocalStream = null; // live MediaStream from getUserMedia, when granted

        // ---- Multi-party mesh ----
        // A 1:1 call only ever has one entry here; a collaboration
        // (group) call has one entry per other member who's actually
        // joined, each with its own RTCPeerConnection straight to that
        // person's browser -- a full mesh, not a single shared
        // connection. That's the right tradeoff for the small
        // collaboration sizes this app expects (every extra participant
        // roughly doubles everyone's own upload); a call with dozens of
        // people would need a real SFU media server instead of this.
        // callPeers: { [peerId]: { pc, stream, role, pendingIce,
        //   remoteDescSet, userId, connected } }
        let callPeers = {};
        let callChannel = null;
        let myCallPeerId = null;

        const RTC_ICE_SERVERS = {
          iceServers: [
            { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
            // Free public TURN relay -- lets calls connect across
            // networks STUN alone can't punch through (mobile data,
            // hotel/corporate wifi, symmetric NATs). Rate-limited and
            // shared publicly, so treat it as a "get calling working
            // now" fallback, not a permanent production TURN server.
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
          ]
        };

        function newCallPeerId(){
          return Math.random().toString(36).slice(2) + Date.now().toString(36);
        }

        function isGroupCallConvo(id){
          const meta = convoMeta[id || callState.convoId];
          return !!(meta && meta.icon === 'users');
        }

        async function startCall(id, type, answering){
          if (!id) return;
          clearCallTimers();
          stopCallLocalStream();
          teardownCallSignaling();
          callState = { convoId: id, type, connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null, pendingRingTargets: null };
          openOverlay('call');
          refreshConvoAvatarFromProfile(id);

          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              callLocalStream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video' ? { facingMode: 'user' } : false,
                audio: true
              });
              // The user may have hit "end call" or switched calls while the
              // permission prompt was open; if so, just release the stream.
              if (callState.convoId !== id) { stopCallLocalStream(); return; }
              applyCallTrackStates();
            } catch (err) {
              callState.mediaError = (err && err.name === 'NotAllowedError')
                ? 'Camera/mic access was denied'
                : 'Camera/mic unavailable';
            }
          } else {
            callState.mediaError = 'Camera/mic not supported in this browser';
          }

          const preScreen = document.getElementById('call-screen');
          if (preScreen) preScreen.outerHTML = callHTML();
          attachCallLocalVideo();

          const sb = getSupabaseClient();
          if (sb) {
            joinCallSignaling(id, sb);
            // Only actually ring anyone when we're the one placing the
            // call -- answering an incoming ring (see acceptIncomingCall)
            // joins the exact same call:<convoId> room through this same
            // function, but shouldn't re-ring anyone.
            if (!answering) {
              const meta = convoMeta[id];
              const isGroup = meta && meta.icon === 'users';
              if (isGroup) {
                // Ring every other member who has a real backend account
                // linked (contacts added before any connection was ever
                // accepted have no otherUserId, so there's nobody to
                // ring for them specifically -- they just won't get a
                // ring, same as the 1:1 "no known backend user" case
                // below).
                const ringTargets = (meta.members || []).filter(m => !m.mine && m.otherUserId);
                if (ringTargets.length) {
                  callState.pendingRingTargets = new Set(ringTargets.map(m => m.otherUserId));
                  ringTargets.forEach(m => sendCallRing(id, type, m.otherUserId));
                  // Give up after 2 minutes if literally nobody has
                  // joined yet -- same no-answer convention as the 1:1
                  // case below, just judged against "has anyone at all
                  // connected" instead of a single person.
                  const ringingConvoId = id;
                  callAnswerTimeout = setTimeout(() => {
                    if (callState.convoId !== ringingConvoId || callState.connected) return;
                    callState.statusOverride = 'No answer';
                    logCallEvent(ringingConvoId, `${type === 'video' ? 'Video' : 'Voice'} call · No answer`);
                    const screen = document.getElementById('call-screen');
                    if (screen) screen.outerHTML = callHTML();
                    setTimeout(() => endCall(), 1400);
                  }, 120000);
                } else {
                  console.warn('startCall: collaboration ' + id + ' has no other members with a linked backend account -- nobody was rung.');
                  callState.statusOverride = 'Not available to call';
                  const screen = document.getElementById('call-screen');
                  if (screen) screen.outerHTML = callHTML();
                }
              } else if (meta && meta.otherUserId) {
                sendCallRing(id, type, meta.otherUserId);
                // Give up after 2 minutes of ringing with no answer, same
                // as a normal phone call. This can't just rely on the
                // other side's own 45s auto-decline timer (see
                // handleIncomingCallRing/declineIncomingCall) -- that only
                // fires if their client is actually online and subscribed
                // right now, and the push notification meant to reach them
                // otherwise isn't guaranteed to land. So the caller keeps
                // its own independent clock and ends the call locally
                // either way, marking it as an unanswered/no-answer call.
                const ringingConvoId = id;
                callAnswerTimeout = setTimeout(() => {
                  if (callState.convoId !== ringingConvoId || callState.connected) return;
                  sendCallResponse(ringingConvoId, meta.otherUserId, 'missed');
                  callState.statusOverride = 'No answer';
                  logCallEvent(ringingConvoId, `${type === 'video' ? 'Video' : 'Voice'} call · No answer`);
                  const screen = document.getElementById('call-screen');
                  if (screen) screen.outerHTML = callHTML();
                  setTimeout(() => endCall(), 1400);
                }, 120000);
              } else {
                // No known backend user on the other end of this convo
                // (it wasn't created from an accepted connection request)
                // -- there's nobody real to ring. Say so instead of
                // silently sitting on "Calling..." forever, which is
                // what made this look "broken" rather than just N/A for
                // this particular conversation.
                console.warn('startCall: no otherUserId on convoMeta[' + id + '] -- nobody was rung, this conversation has no linked backend user.');
                callState.statusOverride = 'Not available to call';
                const screen = document.getElementById('call-screen');
                if (screen) screen.outerHTML = callHTML();
              }
            }
          } else {
            // No Supabase configured yet: fall back to the old self-view-only
            // demo so the screen still does *something* sensible instead of
            // just hanging on "Calling..." forever.
            callRingTimeout = setTimeout(() => {
              callState.connected = true;
              const log = document.getElementById('call-screen');
              if (log) log.outerHTML = callHTML();
              attachCallLocalVideo();
              startCallClock();
            }, 1800);
          }
        }

        function startCallClock(){
          if (callTickInterval) return;
          callTickInterval = setInterval(() => {
            callState.seconds++;
            const timerEl = document.getElementById('call-timer');
            if (timerEl) timerEl.textContent = formatCallTime(callState.seconds);
            updateMinimizedCallBanner();
          }, 1000);
        }

        // ---- Minimize / resume a live call ----
        // Tapping back on the call screen used to run straight into
        // closeOverlay(), which unconditionally tears down the call
        // (stopCallLocalStream/teardownCallSignaling) -- so "going back"
        // and "hanging up" were the same action, with no way to check
        // something else in the app mid-call. This instead just hides
        // the call screen: the local media stream and every
        // RTCPeerConnection in callPeers keep running exactly as they
        // were (they live in plain JS variables, not the DOM, so an
        // overlay swap doesn't touch them) -- only endCall() (the red
        // button, here or on the minimized banner) actually ends it.
        let callMinimized = false;

        function minimizeCall(fromPopState){
          if (!callState.convoId) { closeOverlay(fromPopState); return; }
          callMinimized = true;
          const bgAudio = document.getElementById('call-bg-audio');
          if (bgAudio) {
            const firstStream = Object.values(callPeers).find(e => e.stream);
            bgAudio.srcObject = firstStream ? firstStream.stream : null;
          }
          currentOverlayKind = null;
          updateUtilityNavActive();
          const ov = document.getElementById('overlay');
          if (ov) { ov.classList.add('hidden'); ov.innerHTML = ''; ov.style.top = OVERLAY_TOP; ov.style.bottom = '0'; ov.style.paddingTop = ''; }
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.remove('messaging-split');
          resetBottomNav();
          const isClassroomTab = currentTab === 2;
          const bottomNavEl = document.getElementById('bottom-nav');
          const classroomNavEl = document.getElementById('classroom-nav');
          if (bottomNavEl) bottomNavEl.style.display = isClassroomTab ? 'none' : '';
          if (classroomNavEl) classroomNavEl.style.display = isClassroomTab ? '' : 'none';
          if (overlayHistoryPushed) {
            overlayHistoryPushed = false;
            if (!fromPopState) history.back();
          }
          if (currentTab === 2) { renderStudy(); openRightPanel('notebook'); }
          if (currentTab === 3) applyDefaultRightPanel(3);
          const banner = document.getElementById('call-minimized-banner');
          if (banner) { banner.classList.remove('hidden'); updateMinimizedCallBanner(); }
        }

        function resumeCall(){
          if (!callState.convoId) return;
          callMinimized = false;
          const banner = document.getElementById('call-minimized-banner');
          if (banner) banner.classList.add('hidden');
          const bgAudio = document.getElementById('call-bg-audio');
          if (bgAudio) bgAudio.srcObject = null;
          returnToCallScreen();
        }

        // Re-renders the call screen without touching the live call
        // itself -- used by resumeCall above, and by anything (like the
        // "add to call" picker) that briefly leaves the call screen to
        // show something else and needs to come back to it. openOverlay
        // itself doesn't know to re-attach the local/remote <video>
        // elements' srcObject after swapping the DOM (see
        // attachCallLocalVideo/attachCallRemoteVideo), so this always
        // does both together.
        function returnToCallScreen(){
          if (!callState.convoId) { closeOverlay(); return; }
          openOverlay('call');
          attachCallLocalVideo();
          attachCallRemoteVideo();
        }

        function updateMinimizedCallBanner(){
          const banner = document.getElementById('call-minimized-banner');
          if (!banner || banner.classList.contains('hidden')) return;
          // Shows the live call duration, or a short status while still
          // connecting, in the horizontal top pill.
          const timer = document.getElementById('call-minimized-timer');
          if (timer) timer.textContent = callState.statusOverride || (callState.connected ? formatCallTime(callState.seconds) : '…');
        }

        // ---- WebRTC + Supabase Realtime signaling ----
        // Every other peer id in the call room gets its own
        // RTCPeerConnection (see callPeers above); this creates (or
        // returns the existing) one for a given peer id and wires up its
        // track/ICE handling the same way for every peer in the mesh.
        function ensurePeerConnection(peerId){
          let entry = callPeers[peerId];
          if (entry && entry.pc) return entry.pc;
          if (!entry) entry = callPeers[peerId] = { pc: null, stream: null, role: null, pendingIce: [], remoteDescSet: false, userId: null, connected: false };
          const pc = new RTCPeerConnection(RTC_ICE_SERVERS);
          entry.pc = pc;
          if (callLocalStream) {
            callLocalStream.getTracks().forEach(t => pc.addTrack(t, callLocalStream));
          }
          pc.onicecandidate = (e) => {
            if (e.candidate) sendCallSignal({ kind: 'ice', candidate: e.candidate, to: peerId });
          };
          pc.ontrack = (e) => {
            entry.stream = e.streams[0];
            entry.connected = true;
            if (!callState.connected) {
              callState.connected = true;
              callState.pendingRingTargets = null;
              clearCallTimers();
              startCallClock();
            }
            const screen = document.getElementById('call-screen');
            if (screen) screen.outerHTML = callHTML();
            attachCallLocalVideo();
            attachCallRemoteVideo();
          };
          return pc;
        }

        function sendCallSignal(payload){
          if (!callChannel) return;
          callChannel.send({ type: 'broadcast', event: 'signal', payload: Object.assign({ from: myCallPeerId }, payload) });
        }

        async function joinCallSignaling(convoId, sb){
          myCallPeerId = newCallPeerId();
          const myId = await getCurrentUserId();
          callChannel = sb.channel(`call:${convoId}`, { config: { broadcast: { self: false } } });
          callChannel.on('broadcast', { event: 'signal' }, ({ payload }) => handleCallSignal(payload));
          callChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') sendCallSignal({ kind: 'join', userId: myId });
          });
        }

        // Decides, once both peer ids in a pair are known, which side
        // sends the SDP offer for that pair -- both browsers compute
        // this the same way independently, so exactly one of them ends
        // up offering to the other. In a group call this runs once per
        // pair, entirely independently of every other pair in the mesh,
        // so it works the same whether two people are on the call or
        // five.
        async function maybeBecomeCallOfferer(peerId){
          const entry = callPeers[peerId];
          if (!entry || entry.role) return;
          entry.role = myCallPeerId > peerId ? 'offerer' : 'answerer';
          if (entry.role === 'offerer') {
            const pc = ensurePeerConnection(peerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendCallSignal({ kind: 'offer', sdp: offer, to: peerId });
          }
        }

        async function handleCallSignal(payload){
          if (!payload || payload.from === myCallPeerId) return;
          // Signals with a `to` are addressed to one specific peer (a
          // real 1:1 SDP/ICE exchange happening within a many-peer
          // room) -- everyone else in the room ignores them. `join` has
          // no `to`: it's how peers discover each other in the first
          // place, so every peer already in the room needs to see it.
          if (payload.to && payload.to !== myCallPeerId) return;
          if (payload.kind === 'join' || payload.kind === 'here') {
            const entry = callPeers[payload.from] || (callPeers[payload.from] = { pc: null, stream: null, role: null, pendingIce: [], remoteDescSet: false, userId: null, connected: false });
            entry.userId = payload.userId || entry.userId;
            if (payload.kind === 'join') {
              const myId = await getCurrentUserId();
              sendCallSignal({ kind: 'here', userId: myId, to: payload.from });
            }
            await maybeBecomeCallOfferer(payload.from);
            return;
          }
          if (payload.kind === 'hangup') {
            handlePeerHangup(payload.from);
            return;
          }
          const pc = ensurePeerConnection(payload.from);
          const entry = callPeers[payload.from];
          if (payload.kind === 'offer') {
            entry.role = 'answerer';
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            entry.remoteDescSet = true;
            await flushPendingIceCandidates(entry);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendCallSignal({ kind: 'answer', sdp: answer, to: payload.from });
          } else if (payload.kind === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            entry.remoteDescSet = true;
            await flushPendingIceCandidates(entry);
          } else if (payload.kind === 'ice') {
            if (entry.remoteDescSet) {
              try { await pc.addIceCandidate(payload.candidate); } catch (e) { /* benign: stale/duplicate candidate */ }
            } else {
              entry.pendingIce.push(payload.candidate);
            }
          }
        }

        async function flushPendingIceCandidates(entry){
          for (const c of entry.pendingIce) {
            try { await entry.pc.addIceCandidate(c); } catch (e) { /* benign */ }
          }
          entry.pendingIce = [];
        }

        // One specific participant left (they hung up, or their tab
        // closed on the way out) -- in a group call that's not the same
        // as the whole call being over for everyone still on it, so
        // this only tears down that one connection and re-renders; the
        // call only actually ends once nobody's left in callPeers,
        // which for an ordinary 1:1 call is immediate -- so this still
        // behaves exactly as before there.
        function handlePeerHangup(peerId){
          const entry = callPeers[peerId];
          if (entry) {
            if (entry.pc) { entry.pc.onicecandidate = null; entry.pc.ontrack = null; entry.pc.close(); }
            delete callPeers[peerId];
          }
          if (Object.keys(callPeers).length === 0) {
            endCall(true);
          } else {
            const screen = document.getElementById('call-screen');
            if (screen) screen.outerHTML = callHTML();
            attachCallLocalVideo();
            attachCallRemoteVideo();
          }
        }

        function teardownCallSignaling(){
          if (callChannel) {
            sendCallSignal({ kind: 'hangup' });
            const sb = getSupabaseClient();
            if (sb) sb.removeChannel(callChannel);
            callChannel = null;
          }
          Object.values(callPeers).forEach(entry => {
            if (entry.pc) { entry.pc.onicecandidate = null; entry.pc.ontrack = null; entry.pc.close(); }
          });
          callPeers = {};
          myCallPeerId = null;
        }

        // Wires the live local MediaStream into its <video> element.
        // Needed because innerHTML/outerHTML swaps don't preserve a
        // stream that was set via srcObject on the old node.
        function attachCallLocalVideo(){
          const v = document.getElementById('call-local-video');
          if (v && callLocalStream) v.srcObject = callLocalStream;
        }
        // Same idea, per remote participant. A 1:1 call (and the
        // waiting-room/pre-connect view) uses the plain
        // #call-remote-video/#call-remote-audio ids from callStageHTML;
        // a group call's grid ids each tile by peer id instead (see
        // groupCallStageHTML) since there can be more than one. Video
        // calls play remote audio through the <video> element itself; a
        // voice call has no <video> element at all, so #call-remote-audio
        // (a hidden <audio> element) is what actually plays it -- attach
        // to whichever of the two is actually present for each peer.
        function attachCallRemoteVideo(){
          const peerIds = Object.keys(callPeers);
          if (!isGroupCallConvo() && peerIds.length) {
            const stream = callPeers[peerIds[0]].stream;
            const v = document.getElementById('call-remote-video');
            if (v && stream) v.srcObject = stream;
            const a = document.getElementById('call-remote-audio');
            if (a && stream) a.srcObject = stream;
          } else {
            peerIds.forEach(pid => {
              const stream = callPeers[pid].stream;
              if (!stream) return;
              const v = document.getElementById('call-remote-video-' + pid);
              if (v) v.srcObject = stream;
              const a = document.getElementById('call-remote-audio-' + pid);
              if (a) a.srcObject = stream;
            });
          }
          // The call screen itself isn't even mounted while minimized (see
          // minimizeCall) -- keep whatever's playing through the
          // background <audio> element in sync with who's actually
          // connected instead, so audio doesn't silently stop if the
          // participant it was attached to leaves mid-call.
          if (callMinimized) {
            const bgAudio = document.getElementById('call-bg-audio');
            if (bgAudio) {
              const anyStream = Object.values(callPeers).find(e => e.stream);
              bgAudio.srcObject = anyStream ? anyStream.stream : null;
            }
          }
        }

        // Enables/disables the actual audio & video tracks to match
        // callState.muted / callState.camOff, so mute and camera-off really
        // stop your mic/camera - and, since these are the same track
        // objects handed to every RTCPeerConnection in the mesh, this
        // also really stops what's being sent to everyone else on the
        // call, not just your own preview.
        function applyCallTrackStates(){
          if (!callLocalStream) return;
          callLocalStream.getAudioTracks().forEach(t => t.enabled = !callState.muted);
          callLocalStream.getVideoTracks().forEach(t => t.enabled = !callState.camOff);
        }

        function stopCallLocalStream(){
          if (callLocalStream) {
            callLocalStream.getTracks().forEach(t => t.stop());
            callLocalStream = null;
          }
        }

        function clearCallTimers(){
          if (callRingTimeout) { clearTimeout(callRingTimeout); callRingTimeout = null; }
          if (callAnswerTimeout) { clearTimeout(callAnswerTimeout); callAnswerTimeout = null; }
          if (callTickInterval) { clearInterval(callTickInterval); callTickInterval = null; }
        }

        function formatCallTime(total){
          const m = Math.floor(total / 60).toString().padStart(2,'0');
          const s = (total % 60).toString().padStart(2,'0');
          return `${m}:${s}`;
        }

        function endCall(remoteInitiated){
          const wasConnected = callState.connected;
          const wasMinimized = callMinimized;
          const callDurationSecs = callState.seconds;
          const callType = callState.type;
          clearCallTimers();
          stopCallLocalStream();
          if (!remoteInitiated) {
            teardownCallSignaling();
          } else {
            // Every other peer already left (see handlePeerHangup) --
            // just release whatever's left without re-broadcasting our
            // own hangup back out at nobody.
            Object.values(callPeers).forEach(entry => {
              if (entry.pc) { entry.pc.onicecandidate = null; entry.pc.ontrack = null; entry.pc.close(); }
            });
            callPeers = {};
            if (callChannel) { const sb = getSupabaseClient(); if (sb) sb.removeChannel(callChannel); callChannel = null; }
            myCallPeerId = null;
          }
          callMinimized = false;
          const banner = document.getElementById('call-minimized-banner');
          if (banner) banner.classList.add('hidden');
          const bgAudio = document.getElementById('call-bg-audio');
          if (bgAudio) bgAudio.srcObject = null;
          const endedId = callState.convoId;
          if (wasConnected && endedId) {
            logCallEvent(endedId, `${callType === 'video' ? 'Video' : 'Voice'} call · ${formatCallTime(callDurationSecs)}`);
          }
          callState = { convoId: null, type: 'audio', connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null, pendingRingTargets: null };
          // If the call was ended from the minimized banner (or by the
          // other side while minimized), stay wherever the person
          // actually was instead of yanking them into the conversation
          // screen they'd deliberately stepped away from.
          if (wasMinimized) return;
          if (endedId) openConversation(endedId); else closeOverlay();
        }

        function toggleCallControl(key){
          callState[key] = !callState[key];
          applyCallTrackStates();
          if (key === 'camOff') {
            // Only camera on/off actually changes what's displayed (video
            // vs. avatar), so only the stage needs to be swapped - the
            // header, other buttons, and control bar are left alone.
            const stage = document.getElementById('call-stage-wrap');
            if (stage) stage.innerHTML = callStageHTML();
            attachCallLocalVideo();
            attachCallRemoteVideo();
          }
          // Mute/speaker/camera buttons only ever change their own class
          // and icon; previously every one of these taps replaced the
          // entire #call-screen via outerHTML, which destroyed and
          // recreated the live <video> element on every single tap - that
          // teardown/rebuild is what made the call video visibly glitch
          // and shake whenever any control was tapped.
          const secondaryBtn = document.getElementById('call-secondary-btn');
          if (secondaryBtn) {
            if (callState.type === 'video') {
              secondaryBtn.className = `w-9 h-9 rounded-full flex items-center justify-center ${callState.camOff ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}`;
            } else {
              secondaryBtn.className = `w-9 h-9 rounded-full flex items-center justify-center ${callState.speaker ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}`;
            }
          }
          const muteBtn = document.getElementById('call-mute-btn');
          if (muteBtn) muteBtn.className = `w-9 h-9 rounded-full flex items-center justify-center ${callState.muted ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}`;
        }

        // ---- Add someone to a live call ----
        // Replaces the old three-dot "participants" button: tapping it
        // opens a picker of the person's contacts (the same source
        // openNewCollaboration uses) and ringing anyone from it pulls
        // them straight into the call already in progress, live -- not
        // just a fixed collaboration member list. Works for a plain 1:1
        // call too, turning it into an ad hoc group call.
        function openAddToCall(){
          openOverlay('addToCall');
        }

        function addToCallHTML(){
          const meta = convoMeta[callState.convoId] || {};
          const alreadyOnCall = new Set([
            ...((meta.members || []).map(m => m.otherUserId).filter(Boolean)),
            ...Object.values(callPeers).map(e => e.userId).filter(Boolean),
          ]);
          const contacts = newCollabContactSource().filter(c => c.otherUserId && !alreadyOnCall.has(c.otherUserId));
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:20px;">
              <div class="flex items-center gap-4">
                <button onclick="returnToCallScreen()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-lg font-display truncate grad-text">Add to call</div>
                  <div class="text-xs text-gray-400">Tap someone to ring them in</div>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5" style="position:relative;">
              <div class="divide-y divide-gray-100 pb-24">
                ${contacts.length ? contacts.map(c => `
                  <button onclick="ringIntoCall('${c.otherUserId}')" class="w-full flex items-center gap-3 py-3 text-left">
                    <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                    </div>
                    ${Icon('phone','w-4 h-4 text-gray-300 flex-shrink-0')}
                  </button>`).join('') : `<div class="text-center text-gray-400 text-sm py-8">Everyone in your contacts is already on this call.</div>`}
              </div>
            </div>`;
        }

        function ringIntoCall(otherUserId){
          if (!callState.convoId || !otherUserId) { returnToCallScreen(); return; }
          // If the call hasn't connected to anyone yet, track this new
          // ring the same way startCall's initial ring-out does (see
          // handleCallResponse) -- so this person declining doesn't
          // count as "everyone declined" any differently than if they'd
          // been rung from the very start.
          if (!callState.connected) {
            if (!callState.pendingRingTargets) callState.pendingRingTargets = new Set();
            callState.pendingRingTargets.add(otherUserId);
          }
          sendCallRing(callState.convoId, callState.type, otherUserId);
          returnToCallScreen();
        }

        // The video/avatar "stage" pulled into its own function, and the
        // control buttons given stable ids, so toggling mute/speaker/
        // camera only updates the exact piece that actually changed
        // instead of tearing down the whole call screen (see
        // toggleCallControl above for why that mattered).
        function callStageHTML(){
          const meta = convoMeta[callState.convoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Unknown' };
          const isVideo = callState.type === 'video';
          const showLocalVideo = isVideo && callLocalStream && !callState.camOff && !callState.mediaError;

          if (isGroupCallConvo(callState.convoId)) return groupCallStageHTML(meta, isVideo, showLocalVideo);

          if (callState.connected) {
            const soleEntry = Object.values(callPeers)[0];
            const remoteCallStream = soleEntry && soleEntry.stream;
            const showRemoteVideo = isVideo && remoteCallStream && remoteCallStream.getVideoTracks().some(t => t.enabled);

            // Video calls, WhatsApp-style: the other person's video fills
            // the whole stage, and your own camera sits as a small
            // floating tile in the corner -- not split into two equal
            // panels, which is a video-conferencing-app look, not how a
            // 1:1 WhatsApp call actually renders.
            if (isVideo) {
              return `
                <div class="w-full h-full rounded-2xl overflow-hidden bg-black relative">
                  <video id="call-remote-video" autoplay playsinline class="w-full h-full object-cover ${showRemoteVideo ? '' : 'hidden'}"></video>
                  ${!showRemoteVideo ? `<div class="w-full h-full flex items-center justify-center ${meta.avatarBg} overflow-hidden">${avatarInnerHTML(meta,'w-24 h-24')}</div>` : ''}
                  <div class="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wide text-white/85 bg-black/40 rounded-full px-2.5 py-1 truncate max-w-[70%]">${escapeHtml(convoDisplayName(meta))}</div>
                  <div class="absolute rounded-2xl overflow-hidden bg-black shadow-lg" style="top:12px;right:12px;width:26%;aspect-ratio:3/4;">
                    <video id="call-local-video" autoplay playsinline muted class="w-full h-full object-cover ${showLocalVideo ? '' : 'hidden'}" style="transform:scaleX(-1);"></video>
                    ${!showLocalVideo ? `<div class="w-full h-full flex items-center justify-center bg-gray-800 text-white/60 text-[10px] font-semibold text-center px-1">${callState.mediaError ? escapeHtml(callState.mediaError) : 'Camera off'}</div>` : ''}
                  </div>
                </div>`;
            }

            // Voice call, connected: just the other person's avatar filling
            // the stage -- there's no video from either side to split.
            // The hidden #call-remote-audio element is what actually plays
            // the other person's voice (see attachCallRemoteVideo) -- a
            // voice call has no <video> element, and without this there
            // was nothing in the DOM for the remote audio track to play
            // through, so the call would connect but stay silent.
            return `
              <div class="w-full h-full rounded-2xl overflow-hidden bg-black relative flex items-center justify-center">
                <div class="w-full h-full flex items-center justify-center ${meta.avatarBg} overflow-hidden">${avatarInnerHTML(meta,'w-24 h-24')}</div>
                <audio id="call-remote-audio" autoplay playsinline class="hidden"></audio>
              </div>`;
          }

          return showLocalVideo
            ? `<div class="w-full h-full rounded-2xl overflow-hidden bg-black relative">
                 <video id="call-local-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform:scaleX(-1);"></video>
                 <div class="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wide text-white/80 bg-black/40 rounded-full px-2 py-1">You</div>
               </div>`
            : `<div class="${meta.avatarBg} rounded-full flex items-center justify-center text-gray-600 overflow-hidden" style="width:14rem;height:14rem;">${avatarInnerHTML(meta,'w-24 h-24')}</div>`;
        }

        // Group (collaboration) call stage: a simple responsive grid,
        // one tile per person actually connected, plus your own. Real
        // group calling needs a real mesh connection per participant
        // (see callPeers/ensurePeerConnection above) rather than just a
        // decorative name change, which is what this used to be.
        // Members who haven't joined yet don't get a tile here -- see
        // the "add to call" picker (openAddToCall) for pulling someone
        // in mid-call.
        //
        // Each caller's name is rendered as a caption *below* their
        // video/avatar box, not overlaid on top of it -- an absolutely
        // positioned label sitting inside a `flex items-center
        // justify-center` box (the earlier version of this) renders
        // dead center over the picture the moment it falls back to
        // being a normal flex child for any reason, which is exactly
        // what made names look like they were floating in the middle of
        // the video instead of pinned to an edge.
        function groupCallStageHTML(meta, isVideo, showLocalVideo){
          const connected = Object.keys(callPeers)
            .map(pid => ({ peerId: pid, ...callPeers[pid] }))
            .filter(e => e.connected && e.stream);
          const tileCount = connected.length + 1; // + your own tile
          const cols = tileCount <= 1 ? 1 : (tileCount <= 4 ? 2 : 3);
          const others = (meta.members || []).filter(m => !m.mine);

          function memberFor(userId){
            return others.find(m => m.otherUserId === userId) || { name: 'Someone', avatarBg: 'bg-gray-100', icon: 'user' };
          }

          const localTile = `
            <div class="flex flex-col items-center gap-1 min-w-0">
              <div class="w-full rounded-xl overflow-hidden bg-black flex items-center justify-center" style="aspect-ratio:1;">
                ${showLocalVideo
                  ? `<video id="call-local-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform:scaleX(-1);"></video>`
                  : `<div class="w-full h-full bg-blue-100 flex items-center justify-center overflow-hidden">${(typeof profileData !== 'undefined' && profileData.photo) ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('user','w-8 h-8 text-gray-500')}</div>`}
              </div>
              <div class="text-[11px] font-semibold text-gray-600 truncate max-w-full">You</div>
            </div>`;

          const remoteTiles = connected.map(e => {
            const m = memberFor(e.userId);
            const hasVideo = isVideo && e.stream.getVideoTracks().some(t => t.enabled);
            return `
              <div class="flex flex-col items-center gap-1 min-w-0">
                <div class="w-full rounded-xl overflow-hidden bg-black flex items-center justify-center" style="aspect-ratio:1;">
                  <video id="call-remote-video-${e.peerId}" autoplay playsinline class="w-full h-full object-cover ${hasVideo ? '' : 'hidden'}"></video>
                  <audio id="call-remote-audio-${e.peerId}" autoplay playsinline class="hidden"></audio>
                  ${!hasVideo ? `<div class="w-full h-full ${m.avatarBg || 'bg-gray-100'} flex items-center justify-center overflow-hidden">${avatarInnerHTML(m,'w-8 h-8')}</div>` : ''}
                </div>
                <div class="text-[11px] font-semibold text-gray-600 truncate max-w-full">${escapeHtml(m.name)}</div>
              </div>`;
          }).join('');

          const waitingCount = others.length - connected.length;
          return `
            <div class="w-full h-full overflow-y-auto">
              <div class="grid gap-3" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));">
                ${localTile}${remoteTiles}
              </div>
              ${waitingCount > 0 ? `<div class="text-center text-xs text-gray-400 mt-3">Waiting on ${waitingCount} more member${waitingCount === 1 ? '' : 's'}…</div>` : ''}
            </div>`;
        }

        function callHTML(){
          const meta = convoMeta[callState.convoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Unknown' };
          const isVideo = callState.type === 'video';
          const isGroup = isGroupCallConvo(callState.convoId);
          const statusText = callState.statusOverride
            ? escapeHtml(callState.statusOverride)
            : (callState.connected ? `<span id="call-timer">${formatCallTime(callState.seconds)}</span>` : (isVideo ? 'Video calling…' : 'Calling…'));
          return `
            <div id="call-screen" class="flex-1 flex flex-col text-gray-800" style="padding-top:20px;background:#ffffff;overflow-y:auto;">
              <div class="flex items-center justify-between px-5 flex-shrink-0">
                <button onclick="minimizeCall()" title="Back" class="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-700">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 min-w-0 text-center px-2">
                  <div class="text-lg font-bold font-display truncate">${escapeHtml(convoDisplayName(meta))}</div>
                  <div class="text-sm text-gray-500">${statusText}</div>
                </div>
                <div class="w-11 h-11 flex-shrink-0"></div>
              </div>
              ${callState.mediaError && isVideo ? `<div class="mx-5 mt-3 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold flex-shrink-0">${callState.mediaError}</div>` : ''}
              <div class="flex-1 min-h-0 flex items-center justify-center px-6 py-4" id="call-stage-wrap">
                ${callStageHTML()}
              </div>
              <div class="flex-shrink-0 pt-4 flex justify-center" style="padding-bottom:20px;">
                <div class="flex items-center gap-2 rounded-full py-1.5 px-2 shadow-md" style="background:#f2f2f2;">
                  <button onclick="openAddToCall()" title="Add to call" class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm">${Icon('personPlus','w-4 h-4')}</button>
                  ${isVideo ? `<button onclick="toggleCallControl('camOff')" id="call-secondary-btn" title="Camera" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.camOff ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('video','w-4 h-4')}</button>` : `<button onclick="toggleCallControl('speaker')" id="call-secondary-btn" title="Speaker" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.speaker ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('bell','w-4 h-4')}</button>`}
                  <button onclick="toggleCallControl('muted')" id="call-mute-btn" title="Mute" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.muted ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('mic','w-4 h-4')}</button>
                  <button onclick="endCall()" title="End call" class="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center">${Icon('phoneHangup','w-4 h-4')}</button>
                </div>
              </div>
            </div>`;
        }
