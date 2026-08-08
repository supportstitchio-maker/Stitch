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

        // convoMeta[id].photo is whatever was cached the last time this
        // function ran for that contact (originally, off an accepted
        // connection request -- see loadIncomingConnectionRequests/
        // loadMyAcceptedOutgoingRequests). That cache used to only get
        // filled in when it was completely empty (`|| meta.photo` short-
        // circuited the fetch the moment ANY photo existed), so a contact
        // who later changed their profile picture stayed stuck on their
        // old photo everywhere they'd already been cached -- chat header,
        // call screen, inbox row -- forever, since nothing ever asked
        // public_profiles again once a photo was present. Now it always
        // re-checks the *current* photo every time a conversation/call for
        // that contact is opened, and only touches state/re-renders when
        // the fetched value actually differs from what's cached, so a
        // changed picture propagates here within one open instead of never.
        async function refreshConvoAvatarFromProfile(convoId){
          const meta = convoMeta[convoId];
          if (!meta || !meta.otherUserId) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data: row } = await sb.from(PUBLIC_PROFILES_TABLE).select('photo').eq('user_id', meta.otherUserId).maybeSingle();
            const freshPhoto = (row && row.photo) || null;
            if (freshPhoto === meta.photo) return; // already up to date, nothing to repaint
            if (!convoMeta[convoId]) return; // conversation is gone by the time this resolved
            convoMeta[convoId].photo = freshPhoto;
            const entry = convoArrays().flat().find(c => c.id === convoId);
            if (entry) entry.photo = freshPhoto;
            queueSaveUserState();
            // Chat header, if this conversation is the one currently open.
            if (activeConvoId === convoId) {
              const headerAvatar = document.getElementById('chat-header-avatar');
              if (headerAvatar) headerAvatar.innerHTML = avatarInnerHTML(convoMeta[convoId], 'w-5 h-5');
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
            ${overlayHeader('My Contacts')}
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
          const newConvo = { id, icon:'users', avatarBg:'bg-emerald-100', name: finalName, preview:'You created this collaboration', time:'now', unread:false };
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
          if (createdRemotely && convoMeta[id]) convoMeta[id].createdBy = _cachedAuthUser && _cachedAuthUser.id;
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
          collabAddMembersRemote(id, meta.name, newContacts);
        }

        function removeCollabMemberTap(userId, name){
          if (!confirm(`Remove ${name} from this collaboration?`)) return;
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          meta.members = (meta.members || []).filter(m => m.otherUserId !== userId);
          queueSaveUserState();
          openCollabMembers();
          if (userId) collabRemoveMemberRemote(id, userId);
        }

        // ---- Leave / delete a collaboration. Leaving just removes your
        // own membership (and it stays visible to everyone else); the
        // creator can also delete it outright for everyone. ----
        function leaveCollaboration(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          if (!confirm(`Leave "${meta.name}"?`)) return;
          const myId = typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser ? _cachedAuthUser.id : null;
          if (myId) collabRemoveMemberRemote(id, myId);
          deleteConvoChat();
        }

        function deleteCollaboration(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          if (!confirm(`Delete "${meta.name}" for everyone? This can't be undone.`)) return;
          collabDeleteRemote(id);
          deleteConvoChat();
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
            alert('Tap and hold a conversation to select it first.');
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
            });
            renderInboxTab();
            if (currentTab === 4) renderProfile(); // "My Network" count just changed
          } catch (e) { console.warn('Loading accepted outgoing requests failed:', e); }
        }

        // Short relative-time label ("now", "5m", "3h", "2d") for the
        // request's created_at timestamp, matching the compact style used
        // for the "time" field elsewhere in the Inbox.
        function formatRequestTime(createdAt){
          const then = createdAt ? new Date(createdAt).getTime() : Date.now();
          const diffMs = Date.now() - then;
          const mins = Math.floor(diffMs / 60000);
          if (mins < 1) return 'now';
          if (mins < 60) return mins + 'm';
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
        //     created_at timestamptz not null default now()
        //   );
        //   alter table messages enable row level security;
        //   create policy "Participants can read their messages" on messages
        //     for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
        //   create policy "Users can send messages as themselves" on messages
        //     for insert with check (auth.uid() = sender_id);
        //   create policy "Recipient can mark messages read" on messages
        //     for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
        //   -- Realtime needs to know to broadcast changes on this table:
        //   alter publication supabase_realtime add table messages;
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
        //   -- plus the "Recipient can mark messages read" policy above,
        //   -- since existing projects won't have it yet.
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

        // Returns the new row's id (so the sender can track its read
        // receipt -- see convoReadTicksHTML/handleMessageReadUpdate) or
        // null if it didn't sync.
        async function sendMessageRemote(convoId, otherUserId, text, voiceUrl, voiceDuration, attachments){
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
            const { data, error } = await sb.from(MESSAGES_TABLE).insert(row).select('id').single();
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
            const { data, error } = await sb.from(MESSAGES_TABLE)
              .select('id,sender_id,text,voice_url,voice_duration,attachments,read,created_at')
              .eq('convo_id', convoId)
              .order('created_at', { ascending: true });
            if (error || !data) return;
            conversationMessages[convoId] = data
              .filter(r => !deletedForMeMessageIds.has(r.id))
              .map(r => ({
                id: r.id,
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
            .subscribe();
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
                collabConvos.unshift({ id, icon: 'users', avatarBg: 'bg-emerald-100', name: displayName, photo: row.photo || null, preview: 'You were added to this collaboration', time: 'now', unread: true, read: false });
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
          broadcastToUserChannel(otherUserId, 'ring', {
            convoId, type, fromUserId: myId,
            callerName,
            callerPhoto: (typeof profileData !== 'undefined' && profileData.photo) || null,
          });
          // Realtime broadcast only reaches the other side if they're
          // actively signed in with the app open right now (see
          // subscribeToIncomingCalls) -- a real push notification is
          // what gets them a ring even if the app/tab is closed.
          sendPushTo(otherUserId, {
            title: `${callerName} is calling you`,
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
            c.preview = text; c.time = 'now';
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

        function sendCallResponse(convoId, toUserId, response){
          broadcastToUserChannel(toUserId, 'response', { convoId, response });
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
          clearTimeout(incomingCallRingTimeout);
          incomingCallRingTimeout = setTimeout(() => declineIncomingCall(true), 45000);
        }

        // A reply to a call WE placed (the other side declined, was busy,
        // or never picked up). Only acts if it matches the call we're
        // actually still ringing on.
        function handleCallResponse(payload){
          if (!payload || !callState.convoId || payload.convoId !== callState.convoId || callState.connected) return;
          if (payload.response === 'declined' || payload.response === 'busy' || payload.response === 'missed') {
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
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          const { convoId, type } = incomingCallInfo;
          incomingCallInfo = null;
          if (!conversationMessages[convoId]) conversationMessages[convoId] = [];
          activeConvoId = convoId;
          startCall(convoId, type, true);
        }

        function declineIncomingCall(isTimeout){
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          if (!incomingCallInfo) { closeOverlay(); return; }
          const { convoId, type, fromUserId } = incomingCallInfo;
          sendCallResponse(convoId, fromUserId, isTimeout ? 'missed' : 'declined');
          logCallEvent(convoId, isTimeout ? `Missed ${type === 'video' ? 'video' : 'voice'} call` : `${type === 'video' ? 'Video' : 'Voice'} call declined`);
          incomingCallInfo = null;
          closeOverlay();
        }

        function incomingCallHTML(){
          const info = incomingCallInfo || {};
          const isVideo = info.type === 'video';
          return `
            <div class="flex-1 flex flex-col text-white" style="padding-top:20px;background:linear-gradient(160deg, ${NAVY}, ${ROYAL});">
              <div class="flex-1 flex flex-col items-center justify-center px-6">
                <div class="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center mb-5" style="background:rgba(255,255,255,0.15);">
                  ${info.callerPhoto ? `<img src="${escapeHtml(info.callerPhoto)}" class="w-full h-full object-cover">` : Icon('user','w-14 h-14')}
                </div>
                <div class="text-2xl font-bold font-display mb-1 text-center">${escapeHtml(info.callerName || 'Someone')}</div>
                <div class="text-sm text-white/70">Incoming ${isVideo ? 'video' : 'voice'} call…</div>
              </div>
              <div class="flex-shrink-0 flex items-center justify-center" style="gap:20px;padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 10px);">
                <button onclick="declineIncomingCall()" title="Decline" class="rounded-full flex items-center justify-center shadow-lg" style="width:44px;height:44px;background:#ef4444;">${Icon('phoneHangup','w-5 h-5')}</button>
                <button onclick="acceptIncomingCall()" title="Accept" class="rounded-full flex items-center justify-center shadow-lg" style="width:44px;height:44px;background:#10b981;">${Icon(isVideo ? 'video' : 'phoneOutline','w-5 h-5')}</button>
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
            c.time = 'now';
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
        function deleteConvoChat(){
          if (!activeConvoId) return;
          const meta = convoMeta[activeConvoId];
          if (!confirm(`Delete chat with ${meta ? meta.name : 'this contact'}? This can't be undone.`)) return;
          const id = activeConvoId;
          [primaryConvos, requestConvos, collabConvos].forEach(arr => {
            const idx = arr.findIndex(c => c.id === id);
            if (idx !== -1) arr.splice(idx, 1);
          });
          delete conversationMessages[id];
          activeConvoId = null;
          closeOverlay();
          renderInboxTab();
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
                  ${isGroup ? `<button onclick="triggerCollabPhotoUpload()" class="absolute bottom-2 right-0 w-7 h-7 rounded-full bg-white border-2 border-white shadow flex items-center justify-center text-gray-600" style="background:${ROYAL};color:white;" title="Change photo">${Icon('camera','w-3.5 h-3.5')}</button>` : ''}
                </div>
                <div class="font-bold text-xl font-display text-[${NAVY}]">${escapeHtml(convoDisplayName(meta))}</div>
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
          alert(`${meta ? meta.name : 'This conversation'} has been reported. Our team will review it.`);
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
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm font-display truncate grad-text">${escapeHtml(convoDisplayName(meta))}</div>
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
              <input type="text" id="convo-input" placeholder="Message" onkeydown="if(event.key==='Enter'){sendConvoMessage();}" class="flex-1 min-w-0 bg-gray-100 rounded-full px-3 py-2 text-sm">
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
          // side too. RLS on the `messages` table only lets the sender
          // delete their own row (see the policy below) -- if this was
          // someone else's message, the delete is silently rejected and
          // it simply stays removed on this side only, same as "Delete
          // for me" above.
          //
          //   create policy "Sender can delete their own message" on messages
          //     for delete using (auth.uid() = sender_id);
          if (removed && removed.id != null) {
            const sb = getSupabaseClient();
            if (sb) {
              sb.from(MESSAGES_TABLE).delete().eq('id', removed.id).then(({ error }) => {
                if (error) console.warn('Deleting message for everyone failed:', error);
              });
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
              <audio id="${uid}" controls preload="metadata" src="${voice.src}"${onplay} style="height:32px;max-width:180px;flex:1;" onerror="document.getElementById('${uid}').outerHTML='<span class=&quot;text-xs italic ${mine ? 'text-white/80' : 'text-gray-400'}&quot;>Couldn&#39;t load voice note</span>'"></audio>
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
            c.preview = previewText; c.time = 'now'; c.unread = false; c.read = true;
            found.arr.unshift(c);
          }
          if (convoMeta[convoId]) convoMeta[convoId].preview = previewText;
          if (currentTab === 3) renderInboxTab();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
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
          const message = { from: 'me', text, attachments, time: Date.now(), read: false };
          conversationMessages[activeConvoId].push(message);
          if (inputEl) inputEl.value = '';
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
                const id = await sendMessageRemote(convoIdAtSend, meta.otherUserId, text, null, null, uploaded);
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
              // this message's own tick color.)
              meta.members.forEach(m => {
                if (m.mine || !m.otherUserId) return;
                sendMessageRemote(convoIdAtSend, m.otherUserId, text, null, null, uploaded);
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
        let callState = { convoId: null, type: 'audio', connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null };
        let callRingTimeout = null;
        let callAnswerTimeout = null;
        let callTickInterval = null;
        let callLocalStream = null; // live MediaStream from getUserMedia, when granted
        let remoteCallStream = null; // live MediaStream from the other peer, once connected
        let rtcPeerConnection = null;
        let callChannel = null;
        let myCallPeerId = null;
        let remoteCallPeerId = null;
        let callRole = null; // 'offerer' | 'answerer', decided once both peer ids are known
        let pendingIceCandidates = [];
        let remoteDescriptionSet = false;

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

        async function startCall(id, type, answering){
          if (!id) return;
          clearCallTimers();
          stopCallLocalStream();
          teardownCallSignaling();
          callState = { convoId: id, type, connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null };
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
            ensurePeerConnection();
            joinCallSignaling(id, sb);
            // Only actually ring the other person when we're the one
            // placing the call -- answering an incoming ring (see
            // acceptIncomingCall) joins the exact same call:<convoId> room
            // through this same function, but shouldn't re-ring anyone.
            if (!answering) {
              const meta = convoMeta[id];
              if (meta && meta.otherUserId) {
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
          }, 1000);
        }

        // ---- WebRTC + Supabase Realtime signaling ----
        function ensurePeerConnection(){
          if (rtcPeerConnection) return rtcPeerConnection;
          rtcPeerConnection = new RTCPeerConnection(RTC_ICE_SERVERS);
          if (callLocalStream) {
            callLocalStream.getTracks().forEach(t => rtcPeerConnection.addTrack(t, callLocalStream));
          }
          rtcPeerConnection.onicecandidate = (e) => {
            if (e.candidate && callChannel) {
              sendCallSignal({ kind: 'ice', candidate: e.candidate });
            }
          };
          rtcPeerConnection.ontrack = (e) => {
            remoteCallStream = e.streams[0];
            if (!callState.connected) {
              callState.connected = true;
              clearCallTimers();
              const log = document.getElementById('call-screen');
              if (log) log.outerHTML = callHTML();
              attachCallLocalVideo();
              attachCallRemoteVideo();
              startCallClock();
            } else {
              attachCallRemoteVideo();
            }
          };
          return rtcPeerConnection;
        }

        function sendCallSignal(payload){
          if (!callChannel) return;
          callChannel.send({ type: 'broadcast', event: 'signal', payload: Object.assign({ from: myCallPeerId }, payload) });
        }

        function joinCallSignaling(convoId, sb){
          myCallPeerId = newCallPeerId();
          callChannel = sb.channel(`call:${convoId}`, { config: { broadcast: { self: false } } });
          callChannel.on('broadcast', { event: 'signal' }, ({ payload }) => handleCallSignal(payload));
          callChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') sendCallSignal({ kind: 'join' });
          });
        }

        // Decides, once both peer ids in the room are known, which side
        // sends the SDP offer - both browsers compute this the same way
        // independently, so exactly one of them ends up offering.
        async function maybeBecomeCallOfferer(){
          if (!myCallPeerId || !remoteCallPeerId || callRole) return;
          callRole = myCallPeerId > remoteCallPeerId ? 'offerer' : 'answerer';
          if (callRole === 'offerer') {
            const pc = ensurePeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendCallSignal({ kind: 'offer', sdp: offer });
          }
        }

        async function handleCallSignal(payload){
          if (!payload || payload.from === myCallPeerId) return;
          if (payload.kind === 'join' || payload.kind === 'here') {
            remoteCallPeerId = payload.from;
            if (payload.kind === 'join') sendCallSignal({ kind: 'here' });
            await maybeBecomeCallOfferer();
            return;
          }
          const pc = ensurePeerConnection();
          if (payload.kind === 'offer') {
            remoteCallPeerId = payload.from;
            callRole = 'answerer';
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            remoteDescriptionSet = true;
            await flushPendingIceCandidates(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendCallSignal({ kind: 'answer', sdp: answer });
          } else if (payload.kind === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            remoteDescriptionSet = true;
            await flushPendingIceCandidates(pc);
          } else if (payload.kind === 'ice') {
            if (remoteDescriptionSet) {
              try { await pc.addIceCandidate(payload.candidate); } catch (e) { /* benign: stale/duplicate candidate */ }
            } else {
              pendingIceCandidates.push(payload.candidate);
            }
          } else if (payload.kind === 'hangup') {
            endCall(true);
          }
        }

        async function flushPendingIceCandidates(pc){
          for (const c of pendingIceCandidates) {
            try { await pc.addIceCandidate(c); } catch (e) { /* benign */ }
          }
          pendingIceCandidates = [];
        }

        function teardownCallSignaling(){
          if (callChannel) {
            sendCallSignal({ kind: 'hangup' });
            const sb = getSupabaseClient();
            if (sb) sb.removeChannel(callChannel);
            callChannel = null;
          }
          if (rtcPeerConnection) {
            rtcPeerConnection.onicecandidate = null;
            rtcPeerConnection.ontrack = null;
            rtcPeerConnection.close();
            rtcPeerConnection = null;
          }
          myCallPeerId = null;
          remoteCallPeerId = null;
          callRole = null;
          remoteCallStream = null;
          pendingIceCandidates = [];
          remoteDescriptionSet = false;
        }

        // Wires the live MediaStreams into their <video>/<audio> elements.
        // Needed because innerHTML/outerHTML swaps don't preserve a stream
        // that was set via srcObject on the old node.
        function attachCallLocalVideo(){
          const v = document.getElementById('call-local-video');
          if (v && callLocalStream) v.srcObject = callLocalStream;
        }
        // Video calls play remote audio through #call-remote-video itself
        // (a <video> element plays the audio track of its srcObject even
        // though only the picture is visually shown as "the call"). Voice
        // calls have no <video> element at all -- previously that meant
        // the remote MediaStream, audio track included, was received by
        // WebRTC just fine but never attached to anything that actually
        // plays audio, so the call connected but was silent. #call-remote-audio
        // is a hidden <audio> element that exists for voice calls (see
        // callStageHTML) specifically to fix that -- attach to whichever
        // of the two elements is actually present.
        function attachCallRemoteVideo(){
          const v = document.getElementById('call-remote-video');
          if (v && remoteCallStream) v.srcObject = remoteCallStream;
          const a = document.getElementById('call-remote-audio');
          if (a && remoteCallStream) a.srcObject = remoteCallStream;
        }

        // Enables/disables the actual audio & video tracks to match
        // callState.muted / callState.camOff, so mute and camera-off really
        // stop your mic/camera - and, since these are the same track
        // objects handed to the RTCPeerConnection, this also really stops
        // what's being sent to the other side, not just your own preview.
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
          const callDurationSecs = callState.seconds;
          const callType = callState.type;
          clearCallTimers();
          stopCallLocalStream();
          if (!remoteInitiated) {
            teardownCallSignaling();
          } else {
            // The other side already told us they're hanging up - clean up
            // locally without re-broadcasting our own hangup back at them.
            if (rtcPeerConnection) { rtcPeerConnection.onicecandidate = null; rtcPeerConnection.ontrack = null; rtcPeerConnection.close(); rtcPeerConnection = null; }
            if (callChannel) { const sb = getSupabaseClient(); if (sb) sb.removeChannel(callChannel); callChannel = null; }
            myCallPeerId = null; remoteCallPeerId = null; callRole = null; remoteCallStream = null;
            pendingIceCandidates = []; remoteDescriptionSet = false;
          }
          const endedId = callState.convoId;
          if (wasConnected && endedId) {
            logCallEvent(endedId, `${callType === 'video' ? 'Video' : 'Voice'} call · ${formatCallTime(callDurationSecs)}`);
          }
          callState = { convoId: null, type: 'audio', connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null };
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

        // NOTE: this stays a decorative, local-only rename (it doesn't add
        // a real third participant to the WebRTC connection above, which is
        // strictly 1:1). Real group calling needs an SFU/mesh design, not
        // just more signaling messages, so it's left out of scope here.
        function addCallParticipant(){
          const name = prompt('Add participant by name:');
          if (!name) return;
          const meta = convoMeta[callState.convoId];
          if (meta) meta.name = meta.name + ', ' + name;
          const screen = document.getElementById('call-screen');
          if (screen) screen.outerHTML = callHTML();
          attachCallLocalVideo();
          attachCallRemoteVideo();
        }

        // The video/avatar "stage" pulled into its own function, and the
        // control buttons given stable ids, so toggling mute/speaker/
        // camera only updates the exact piece that actually changed
        // instead of tearing down the whole call screen (see
        // toggleCallControl below for why that mattered).
        function callStageHTML(){
          const meta = convoMeta[callState.convoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Unknown' };
          const isVideo = callState.type === 'video';
          const showLocalVideo = isVideo && callLocalStream && !callState.camOff && !callState.mediaError;

          if (callState.connected) {
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

        function callHTML(){
          const meta = convoMeta[callState.convoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Unknown' };
          const isVideo = callState.type === 'video';
          const statusText = callState.statusOverride
            ? escapeHtml(callState.statusOverride)
            : (callState.connected ? `<span id="call-timer">${formatCallTime(callState.seconds)}</span>` : (isVideo ? 'Video calling…' : 'Calling…'));
          return `
            <div id="call-screen" class="flex-1 flex flex-col text-gray-800" style="padding-top:20px;background:#ffffff;overflow-y:auto;">
              <div class="flex items-center justify-between px-5 flex-shrink-0">
                <button onclick="closeOverlay()" title="Back" class="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-700">${IconBold('back','w-5 h-5')}</button>
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
                  <button onclick="addCallParticipant()" title="Add participant" class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm">${IconBold('dots','w-4 h-4')}</button>
                  ${isVideo ? `<button onclick="toggleCallControl('camOff')" id="call-secondary-btn" title="Camera" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.camOff ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('video','w-4 h-4')}</button>` : `<button onclick="toggleCallControl('speaker')" id="call-secondary-btn" title="Speaker" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.speaker ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('bell','w-4 h-4')}</button>`}
                  <button onclick="toggleCallControl('muted')" id="call-mute-btn" title="Mute" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.muted ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('mic','w-4 h-4')}</button>
                  <button onclick="endCall()" title="End call" class="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center">${Icon('phoneHangup','w-4 h-4')}</button>
                </div>
              </div>
            </div>`;
        }

