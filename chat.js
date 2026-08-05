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
              <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(c.icon,'w-5 h-5')}</div>
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
                <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(c.icon,'w-5 h-5')}</div>
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

        function newCollabContactSource(){
          return convoArrays().flat().filter(c => c.icon !== 'users');
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
                    <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(c.icon,'w-5 h-5')}</div>
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
                    <div class="w-12 h-12 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(c.icon,'w-5 h-5')}</div>
                    <div class="text-[11px] text-gray-600 text-center truncate w-full">${escapeHtml(c.name)}</div>
                  </div>`).join('')}
              </div>
            </div>
            <button onclick="createNewCollaboration()" class="flex items-center justify-center gap-2 text-white rounded-full py-3.5 text-base font-bold shadow-lg" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:rgba(30,144,255,0.5);width:100px;">
              Create
            </button>`;
        }

        function createNewCollaboration(){
          const input = document.getElementById('new-collab-name-input');
          const typedName = input ? input.value.trim() : '';
          const contacts = newCollabContactSource().filter(c => newCollabSelected.has(c.id));
          const finalName = typedName || contacts.map(c => c.name).slice(0,3).join(', ');
          const id = 'c' + Date.now();
          const newConvo = { id, icon:'users', avatarBg:'bg-emerald-100', name: finalName, preview:'You created this collaboration', time:'now', unread:false };
          collabConvos.unshift(newConvo);
          convoMeta[id] = { icon:'users', avatarBg:'bg-emerald-100', name: finalName, preview:'You created this collaboration' };
          conversationMessages[id] = [{ from:'them', text: `You created "${finalName}" with ${contacts.map(c => c.name).join(', ')}.` }];
          queueSaveUserState();
          inboxFilter = 'collaborations';
          inboxViewFilter = 'all';
          closeOverlay();
          renderInboxTab();
          openConversation(id);
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
        // Plan stats panel) -- computed live from actual accepted
        // connections rather than a manually incremented counter, so it
        // can't drift out of sync with who you're really connected to.
        // Mirrors the same filter myContactsHTML uses to decide who shows
        // up under "My Network" there.
        function networkConnectionCount(){
          return convoArrays().flat().filter(c => c.network && c.icon !== 'users').length;
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

        function convoRow(c){
          const { id, icon, avatarBg, name, preview, time } = c;
          if (!convoMeta[id]) convoMeta[id] = { icon, avatarBg, name, preview };
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
              <div class="w-12 h-12 ${avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(icon,'w-6 h-6')}</div>
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
              <div class="w-12 h-12 ${avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInner}</div>
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
          if (currentTab === 4) renderProfile(); // "My Network" count just changed
          removeFromDiscover(c.otherUserId); // they're connected now -- Discover shouldn't offer them again
          setConnectionRequestStatus(c.connectionRequestId, 'accepted');
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
                preview: '',
                time: formatRequestTime(row.created_at),
                network: false,
              };
              requestConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, preview: 'Wants to connect with you', otherUserId: row.from_user };
            });
            connectionRequestsLoaded = true;
            renderInboxTab();
          } catch (e) { console.warn('Loading incoming connection requests failed:', e); }
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
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, preview: entry.preview, otherUserId: row.to_user };
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
        //     created_at timestamptz not null default now()
        //   );
        //   alter table messages enable row level security;
        //   create policy "Participants can read their messages" on messages
        //     for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
        //   create policy "Users can send messages as themselves" on messages
        //     for insert with check (auth.uid() = sender_id);
        //   -- Realtime needs to know to broadcast changes on this table:
        //   alter publication supabase_realtime add table messages;
        //   -- (Also double-check Database -> Replication -> messages is
        //   -- toggled on in the dashboard; the SQL above should do it,
        //   -- but the toggle is the source of truth.)
        //
        // If `messages` already existed from before voice notes were
        // added, just run this once instead of recreating the table:
        //   alter table messages add column if not exists voice_url text;
        //   alter table messages add column if not exists voice_duration int;
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

        async function sendMessageRemote(convoId, otherUserId, text, voiceUrl, voiceDuration){
          const sb = getSupabaseClient();
          const myId = await getCurrentUserId();
          if (!sb || !myId) return false;
          try {
            const row = {
              convo_id: convoId,
              sender_id: myId,
              recipient_id: otherUserId,
              text: text || '',
            };
            if (voiceUrl) { row.voice_url = voiceUrl; row.voice_duration = voiceDuration || null; }
            const { error } = await sb.from(MESSAGES_TABLE).insert(row);
            if (error) { console.warn('Message did not sync to Supabase:', error); return false; }
            // Real push so the recipient hears about the message even if
            // they aren't currently sitting in the app (postgres_changes
            // Realtime in subscribeToIncomingMessages only reaches a live,
            // open session).
            sendPushTo(otherUserId, {
              title: (typeof profileData !== 'undefined' && profileData.name) || 'New message',
              body: text ? (text.length > 120 ? text.slice(0, 117) + '...' : text) : 'Sent a voice message',
              tag: 'msg-' + convoId,
              data: { kind: 'message', convoId },
            });
            return true;
          } catch (e) { console.warn('Sending message threw an error:', e); return false; }
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
              .select('sender_id,text,voice_url,voice_duration,created_at')
              .eq('convo_id', convoId)
              .order('created_at', { ascending: true });
            if (error || !data) return;
            conversationMessages[convoId] = data.map(r => ({
              from: r.sender_id === myId ? 'me' : 'them',
              text: r.text,
              voice: r.voice_url ? { src: r.voice_url, duration: r.voice_duration || 0 } : undefined,
            }));
          } catch (e) { /* best effort -- keep whatever local history already existed */ }
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
          const callerName = (typeof profileData !== 'undefined' && profileData.name) || 'Someone';
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
            callState.statusOverride = payload.response === 'busy' ? 'Line busy'
              : payload.response === 'missed' ? 'No answer'
              : 'Call declined';
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
          sendCallResponse(incomingCallInfo.convoId, incomingCallInfo.fromUserId, isTimeout ? 'missed' : 'declined');
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
              <div class="flex-shrink-0 flex items-center justify-center gap-16" style="padding-bottom:calc(env(safe-area-inset-bottom, 14px) + 14px);">
                <button onclick="declineIncomingCall()" title="Decline" class="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">${Icon('phoneHangup','w-6 h-6')}</button>
                <button onclick="acceptIncomingCall()" title="Accept" class="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">${Icon(isVideo ? 'video' : 'phoneOutline','w-6 h-6')}</button>
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
          conversationMessages[convoId].push({
            from: 'them',
            text: row.text || '',
            voice: isVoice ? { src: row.voice_url, duration: row.voice_duration || 0 } : undefined,
          });
          queueSaveUserState();
          const previewText = isVoice ? '🎤 Voice message' : (row.text || 'Attachment');
          if (activeConvoId === convoId) {
            const log = document.getElementById('convo-log');
            if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
            updateConvoPreview(convoId, previewText);
          } else {
            const c = convoArrays().flat().find(x => x.id === convoId);
            if (c) { c.unread = true; c.read = false; c.preview = previewText; c.time = 'now'; }
            const inboxList = document.getElementById('inbox-list');
            if (inboxList) inboxList.innerHTML = inboxContent();
          }
        }

        let conversationMessages = {}; // id -> [{from:'me'|'them', text}]
        let activeConvoId = null;

        function openConversation(id){
          activeConvoId = id;
          if (!conversationMessages[id]) {
            conversationMessages[id] = [];
          }
          openOverlay('conversation');
          // In desktop split view the chat list (#screen) stays visible
          // beside the open conversation, so re-paint just its rows to
          // move the "active chat" highlight onto the one just opened.
          const inboxList = document.getElementById('inbox-list');
          if (inboxList) inboxList.innerHTML = inboxContent();

          // Real (backend-linked) conversations: swap in the actual
          // message history from Supabase once it arrives, so switching
          // between chats doesn't leave stale/placeholder text showing.
          const meta = convoMeta[id];
          if (meta && meta.otherUserId) {
            loadConversationHistory(id).then(() => {
              if (activeConvoId !== id) return;
              const log = document.getElementById('convo-log');
              if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
            });
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
          else blockAccount(meta.name, meta.icon, meta.avatarBg);
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
                <div class="w-24 h-24 ${meta.avatarBg} rounded-full flex items-center justify-center text-gray-600 mb-3">${Icon(meta.icon,'w-10 h-10')}</div>
                <div class="font-bold text-xl font-display text-[${NAVY}]">${escapeHtml(meta.name)}</div>
                <div class="text-sm text-gray-400 mt-0.5">${convoLastSeenText(meta)}</div>
              </div>

              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm mb-6">
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
                          <div class="w-10 h-10 ${c.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(c.icon,'w-4 h-4')}</div>
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
                ${convoProfileRow('block','bg-red-50','text-red-500', blocked ? 'Unblock' : 'Block', null, 'toggleBlockFromConvoProfile()', true)}
                ${convoProfileRow('trash','bg-red-50','text-red-500', 'Delete chat', null, 'deleteConvoChat()', true)}
              </div>
            </div>`;
        }

        // Conversation reports are real, persistent state (not just an
        // alert): once reported, the id is stored so the menu item flips
        // to "Reported" and won't fire again for that conversation, the
        // same way blocking already worked.
        let reportedConvos = new Set();

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
            blockAccount(meta.name, meta.icon, meta.avatarBg);
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
              <div class="w-10 h-10 ${meta.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(meta.icon,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm font-display truncate grad-text">${escapeHtml(meta.name)}</div>
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
              <input type="file" id="convo-file-input" accept="image/*,.pdf,.ppt,.pptx" multiple class="hidden" onchange="handleConvoFileSelect(event)">
              <button onclick="document.getElementById('convo-file-input').click()" title="Attach a file" class="w-8 h-8 bg-gray-100 text-[${NAVY}] rounded-full flex items-center justify-center flex-shrink-0">${Icon('clip','w-4 h-4')}</button>
              <input type="text" id="convo-input" placeholder="Message" onkeydown="if(event.key==='Enter'){sendConvoMessage();}" class="flex-1 min-w-0 bg-gray-100 rounded-full px-3 py-2 text-sm">
              <button onclick="toggleConvoVoiceNote()" id="convo-mic-btn" title="Record a voice note" class="w-8 h-8 bg-gray-100 text-[${NAVY}] rounded-full flex items-center justify-center flex-shrink-0">${Icon('mic','w-4 h-4')}</button>
              <button onclick="sendConvoMessage()" class="w-8 h-8 text-white rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.6);">${Icon('send','w-4 h-4')}</button>
            </div>`;
        }

        // ---- Inbox conversation file attachments ----
        let pendingConvoAttachments = [];

        function convoFileIcon(type){
          if (type && type.startsWith('image/')) return 'camera';
          return 'file';
        }

        function convoAttachStripHTML(){
          if (!pendingConvoAttachments.length) return '';
          return `
            <div class="px-4 pt-3 flex gap-2 flex-wrap">
              ${pendingConvoAttachments.map((f,i) => `
                <div class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700">
                  <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(convoFileIcon(f.type),'w-3.5 h-3.5')}</div>
                  <span class="max-w-[120px] truncate">${escapeHtml(f.name)}</span>
                  <button onclick="removeConvoAttachment(${i})" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                </div>`).join('')}
            </div>`;
        }

        function handleConvoFileSelect(event){
          const files = Array.from(event.target.files || []);
          const allowed = /image\/.*|application\/pdf|.*presentation.*|.*powerpoint.*/;
          files.forEach(f => {
            const okType = allowed.test(f.type) || /\.(pdf|pptx?|jpe?g|png|gif|webp)$/i.test(f.name);
            if (okType) pendingConvoAttachments.push({ name: f.name, type: f.type });
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

        async function toggleConvoVoiceNote(){
          if (convoRecording) { stopConvoVoiceNote(true); return; }
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

        function setConvoMicRecordingUI(on){
          const micBtn = document.getElementById('convo-mic-btn');
          const inputEl = document.getElementById('convo-input');
          if (micBtn) {
            micBtn.classList.toggle('bg-red-500', on);
            micBtn.classList.toggle('text-white', on);
            micBtn.classList.toggle('bg-gray-100', !on);
            micBtn.classList.toggle('text-[' + NAVY + ']', !on);
            micBtn.innerHTML = Icon(on ? 'square' : 'mic', 'w-4 h-4');
            micBtn.style.animation = on ? 'pulse 1s infinite' : '';
            micBtn.title = on ? 'Stop and send voice note' : 'Record a voice note';
          }
          if (inputEl && !on) inputEl.placeholder = 'Message';
        }

        function stopConvoVoiceNote(send){
          if (convoRecorder && convoRecording) {
            convoRecorder._shouldSend = send;
            try { convoRecorder.stop(); } catch (e) {}
          }
          convoRecording = false;
          if (convoRecordTimerInterval) { clearInterval(convoRecordTimerInterval); convoRecordTimerInterval = null; }
          setConvoMicRecordingUI(false);
        }

        function handleConvoVoiceNoteStop(){
          const shouldSend = convoRecorder ? convoRecorder._shouldSend !== false : true;
          const durationSecs = Math.max(1, Math.round((Date.now() - convoRecordStartTs) / 1000));
          const blob = new Blob(convoRecordedChunks, { type: (convoRecorder && convoRecorder.mimeType) || 'audio/webm' });
          if (convoRecordStream) { convoRecordStream.getTracks().forEach(t => t.stop()); convoRecordStream = null; }
          convoRecorder = null;
          convoRecordedChunks = [];
          if (!shouldSend || blob.size === 0 || !activeConvoId) return;
          const reader = new FileReader();
          reader.onload = () => sendConvoVoiceNote(reader.result, durationSecs, blob);
          reader.readAsDataURL(blob);
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
          conversationMessages[activeConvoId].push({ from: 'me', voice: { src: dataUrl, duration: durationSecs } });
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
              if (!url) { console.warn('Voice note stayed local-only (upload failed) -- the other account will not receive it.'); return; }
              sendMessageRemote(convoIdAtSend, meta.otherUserId, '', url, durationSecs);
            });
          }
        }

        function convoLogHTML(){
          const meta = convoMeta[activeConvoId] || { icon: 'user', avatarBg: 'bg-gray-100' };
          const msgs = conversationMessages[activeConvoId] || [];
          return msgs.map(m => m.from === 'them' ? `
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 ${meta.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(meta.icon,'w-4 h-4')}</div>
              <div class="bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-700" style="max-width:75%;">${m.voice ? convoVoiceNoteHTML(m.voice, false) : m.text}</div>
            </div>` : `
            <div class="flex items-start justify-end gap-3">
              <div class="text-white rounded-2xl px-4 py-2.5 text-sm" style="max-width:75%;background:linear-gradient(135deg, rgba(65,105,225,0.55), rgba(65,105,225,0.35));">${m.voice ? convoVoiceNoteHTML(m.voice, true) : (convoAttachmentsHTML(m.attachments) + m.text)}</div>
            </div>`).join('');
        }

        // A voice-note bubble: a real <audio> element (playable, since the
        // clip is embedded as a data URL) plus a mic icon and duration
        // label so it reads clearly as a recorded message rather than a
        // text one.
        function convoVoiceNoteHTML(voice, mine){
          const barClass = mine ? 'bg-white/25' : 'bg-white';
          return `
            <div class="flex items-center gap-2" style="min-width:170px;">
              <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${barClass}" style="color:${mine ? '#fff' : NAVY};">${Icon('mic','w-3.5 h-3.5')}</div>
              <audio controls preload="metadata" src="${voice.src}" style="height:32px;max-width:180px;flex:1;"></audio>
              <span class="text-xs flex-shrink-0 ${mine ? 'text-white/80' : 'text-gray-500'}">${formatCallTime(voice.duration)}</span>
            </div>`;
        }

        function convoAttachmentsHTML(attachments){
          if (!attachments || !attachments.length) return '';
          return `
            <div class="flex flex-col gap-1.5 mb-1.5">
              ${attachments.map(f => `
                <div class="flex items-center gap-2 bg-white/15 rounded-xl px-2.5 py-1.5">
                  ${Icon(convoFileIcon(f.type),'w-4 h-4')}<span class="text-xs truncate">${escapeHtml(f.name)}</span>
                </div>`).join('')}
            </div>`;
        }

        // Keeps the inbox list's preview line in sync with what's actually
        // been said, instead of getting stuck on the placeholder shown
        // right after connecting (see acceptRequest/loadMyAcceptedOutgoingRequests
        // above, both of which seed preview: 'You are now connected').
        function updateConvoPreview(convoId, previewText){
          const c = convoArrays().flat().find(x => x.id === convoId);
          if (c) { c.preview = previewText; c.time = 'now'; c.unread = false; c.read = true; }
          if (convoMeta[convoId]) convoMeta[convoId].preview = previewText;
          if (currentTab === 3) renderInboxTab();
        }

        function sendConvoMessage(){
          const inputEl = document.getElementById('convo-input');
          const text = inputEl ? inputEl.value.trim() : '';
          const attachments = pendingConvoAttachments;
          if (!text && !attachments.length) return;
          if (!activeConvoId) return;
          pendingConvoAttachments = [];
          conversationMessages[activeConvoId].push({ from: 'me', text, attachments });
          if (inputEl) inputEl.value = '';
          const log = document.getElementById('convo-log');
          if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
          const strip = document.getElementById('convo-attach-strip');
          if (strip) strip.innerHTML = convoAttachStripHTML();
          queueSaveUserState();
          const convoIdAtSend = activeConvoId;
          updateConvoPreview(convoIdAtSend, text || (attachments.length ? `📎 ${attachments[0].name}` : 'Attachment'));

          const meta = convoMeta[convoIdAtSend];
          if (meta && meta.otherUserId) {
            // Real connection: actually deliver it via Supabase so the
            // other account receives it (see subscribeToIncomingMessages).
            if (text) sendMessageRemote(convoIdAtSend, meta.otherUserId, text);
          }
          // No known backend user on the other end (a locally-created
          // collaboration) -- the message just sits sent, same as it
          // would in a real messaging app if nobody's replied yet.
        }

        // ---------------- VOICE / VIDEO CALL ----------------
        // Real peer-to-peer calling over WebRTC. Supabase Realtime's
        // broadcast channels are used purely as the signaling layer (to
        // exchange SDP offers/answers and ICE candidates) - the actual
        // audio/video never passes through Supabase, it flows directly
        // between the two browsers once connected.
        //
        // Room = `call:${convoId}`. Whoever else opens a call on that same
        // conversation id lands in the same room and gets connected - there
        // is no separate ringing/accept step or push notification, since
        // this app has no real user-identity/presence system: the "other
        // side" simply has to also be viewing that conversation and tap
        // Call. (Two browser tabs/devices both calling from the same
        // conversation is the way to test this for real.)
        //
        // STUN-only (stun.l.google.com) works for most home/office
        // networks but not every network (symmetric NATs, some corporate
        // or mobile carriers) - for guaranteed connectivity you'd add a
        // TURN server to RTC_ICE_SERVERS too.
        let callState = { convoId: null, type: 'audio', connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null };
        let callRingTimeout = null;
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
          iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
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
              if (meta && meta.otherUserId) sendCallRing(id, type, meta.otherUserId);
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

        // Wires the live MediaStreams into their <video> elements. Needed
        // because innerHTML/outerHTML swaps don't preserve a stream that
        // was set via srcObject on the old node.
        function attachCallLocalVideo(){
          const v = document.getElementById('call-local-video');
          if (v && callLocalStream) v.srcObject = callLocalStream;
        }
        function attachCallRemoteVideo(){
          const v = document.getElementById('call-remote-video');
          if (v && remoteCallStream) v.srcObject = remoteCallStream;
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
          if (callTickInterval) { clearInterval(callTickInterval); callTickInterval = null; }
        }

        function formatCallTime(total){
          const m = Math.floor(total / 60).toString().padStart(2,'0');
          const s = (total % 60).toString().padStart(2,'0');
          return `${m}:${s}`;
        }

        function endCall(remoteInitiated){
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
            // A real remote party is on the line: their video (or an
            // avatar placeholder for audio calls / their camera being off)
            // fills the stage, with your own live self-view as a small
            // picture-in-picture corner - same layout as most call apps.
            const showRemoteVideo = isVideo && remoteCallStream && remoteCallStream.getVideoTracks().some(t => t.enabled);
            return `
              <div class="w-full h-full rounded-2xl overflow-hidden bg-black relative">
                <video id="call-remote-video" autoplay playsinline class="w-full h-full object-cover ${showRemoteVideo ? '' : 'hidden'}"></video>
                ${!showRemoteVideo ? `<div class="w-full h-full flex items-center justify-center ${meta.avatarBg}">${Icon(meta.icon,'w-24 h-24')}</div>` : ''}
                ${showLocalVideo ? `
                  <div class="absolute top-3 right-3 w-20 h-28 rounded-xl overflow-hidden shadow-lg border-2 border-white/80">
                    <video id="call-local-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform:scaleX(-1);"></video>
                  </div>` : ''}
              </div>`;
          }

          return showLocalVideo
            ? `<div class="w-full h-full rounded-2xl overflow-hidden bg-black relative">
                 <video id="call-local-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform:scaleX(-1);"></video>
                 <div class="absolute bottom-2 left-2 text-[10px] font-bold uppercase tracking-wide text-white/80 bg-black/40 rounded-full px-2 py-1">You</div>
               </div>`
            : `<div class="w-56 h-56 ${meta.avatarBg} rounded-full flex items-center justify-center text-gray-600">${Icon(meta.icon,'w-24 h-24')}</div>`;
        }

        function callHTML(){
          const meta = convoMeta[callState.convoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Unknown' };
          const isVideo = callState.type === 'video';
          const statusText = callState.statusOverride
            ? escapeHtml(callState.statusOverride)
            : (callState.connected ? `<span id="call-timer">${formatCallTime(callState.seconds)}</span>` : (isVideo ? 'Video calling…' : 'Calling…'));
          return `
            <div id="call-screen" class="flex-1 flex flex-col text-gray-800" style="padding-top:20px;background:#ffffff;">
              <div class="flex items-center justify-between px-5 flex-shrink-0">
                <button onclick="closeOverlay()" title="Back" class="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-700">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 min-w-0 text-center px-2">
                  <div class="text-lg font-bold font-display truncate">${escapeHtml(meta.name)}</div>
                  <div class="text-sm text-gray-500">${statusText}</div>
                </div>
                <div class="w-11 h-11 flex-shrink-0"></div>
              </div>
              ${callState.mediaError && isVideo ? `<div class="mx-5 mt-3 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold flex-shrink-0">${callState.mediaError}</div>` : ''}
              <div class="flex-1 flex items-center justify-center px-6 py-4" id="call-stage-wrap">
                ${callStageHTML()}
              </div>
              <div class="flex-shrink-0 pt-24 flex justify-center" style="padding-bottom:15px;">
                <div class="flex items-center gap-2 rounded-full py-1.5 px-2 shadow-md" style="background:#f2f2f2;">
                  <button onclick="addCallParticipant()" title="Add participant" class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm">${IconBold('dots','w-4 h-4')}</button>
                  ${isVideo ? `<button onclick="toggleCallControl('camOff')" id="call-secondary-btn" title="Camera" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.camOff ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('video','w-4 h-4')}</button>` : `<button onclick="toggleCallControl('speaker')" id="call-secondary-btn" title="Speaker" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.speaker ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('bell','w-4 h-4')}</button>`}
                  <button onclick="toggleCallControl('muted')" id="call-mute-btn" title="Mute" class="w-9 h-9 rounded-full flex items-center justify-center ${callState.muted ? 'bg-[' + NAVY + '] text-white' : 'bg-white text-gray-700 shadow-sm'}">${Icon('mic','w-4 h-4')}</button>
                  <button onclick="endCall()" title="End call" class="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center">${Icon('phoneHangup','w-4 h-4')}</button>
                </div>
              </div>
            </div>`;
        }

