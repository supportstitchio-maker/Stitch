const inboxFilters = [['general','General',0],['collaborations','Collaborations',0],['meetings','Meetings',0],['requests','Requests',3]];
        let selectMode = false;
        let selectedConvos = new Set();
        let inboxMenuOpen = false;
        let inboxFilterMenuOpen = false;
        let inboxViewFilter = 'all'; 
        let inboxSearchActive = false; 
        let inboxSearchQuery = '';

        // ---- Inbox search + filter menu ----
        function activateInboxSearch(){
          inboxSearchActive = true;
          renderInboxTab();
          const inp = document.getElementById('inbox-search-input');
          if (inp) inp.focus();
        }
        function deactivateInboxSearch(){
          inboxSearchActive = false;
          inboxSearchQuery = '';
          inboxCollabSearchResults = [];
          renderInboxTab();
        }
        function onInboxSearchInput(val){
          inboxSearchQuery = val;
          const list = document.getElementById('inbox-list');
          if (list) list.innerHTML = inboxContent();
          scheduleInboxCollabSearch();
        }

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
          // Bottom sheet that pulls up from below, same look as the Career Space menu.
          const wrap = document.createElement('div');
          wrap.innerHTML = inboxFilterMenuHTML();
          while (wrap.firstElementChild) document.body.appendChild(wrap.firstElementChild);
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
        // Tapping the active filter again turns it off (back to all messages).
        function toggleInboxViewFilter(val){
          setInboxViewFilter(inboxViewFilter === val ? 'all' : val);
        }
        function inboxFilterMenuHTML(){
          const row = (onclick, icon, label, active) => `
            <button onclick="${onclick}" class="w-full flex items-center gap-5 px-6 py-4 text-left text-base font-semibold ${active ? '' : 'text-gray-800'}" style="background:transparent;${active ? `color:${NAVY};` : ''}">
              <span class="w-6 h-6 flex items-center justify-center flex-shrink-0">${Icon(icon,'w-6 h-6')}</span>
              <span style="font-family:'Colmeak','Montserrat',sans-serif;font-weight:400;font-size:17px;letter-spacing:.01em;">${label}</span>
            </button>`;
          return `
            <div id="inbox-filter-backdrop" onclick="closeInboxFilterMenuDom()" ontouchmove="event.preventDefault()" style="position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.5);"></div>
            <div id="inbox-filter-dropdown" class="bg-white" style="position:fixed;left:0;right:0;bottom:0;z-index:11001;border-radius:24px 24px 0 0;padding:10px 0 calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:shareSheetSlideUp .22s cubic-bezier(0.16,1,0.3,1);max-width:640px;margin:0 auto;">
              <div style="width:48px;height:5px;border-radius:3px;background:#1f2937;margin:2px auto 10px;"></div>
              ${row("closeInboxFilterMenuDom();openOverlay('newMessage')", 'edit', 'New', false)}
              ${row("closeInboxFilterMenuDom();meetingKindFromMeetings=false;openOverlay('meetingKind')", 'video', 'Create meeting', false)}
              ${row("toggleInboxViewFilter('unread')", 'comment', 'Unread only', inboxViewFilter === 'unread')}
              ${row("toggleInboxViewFilter('pinned')", 'pin', 'Pinned', inboxViewFilter === 'pinned')}
            </div>`;
        }

        const primaryConvos = [];
        const requestConvos = [];
        const sentRequestConvos = [];
        const collabConvos = [];

        // ---- XSS hardening helpers ----
        function safeChatUrl(u){
          if (typeof u !== 'string') return '';
          const s = u.trim();
          if (!s || s.length > 8000000) return '';
          if (/^data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,[a-z0-9+\/=]+$/i.test(s)) return s;
          if (/^blob:/i.test(s)) return s;
          try {
            const x = new URL(s, window.location.href);
            return (x.protocol === 'https:' || x.protocol === 'http:') ? s : '';
          } catch (e) { return ''; }
        }
        // encodeURIComponent leaves ' ( ) ! * ~ untouched
        function encUriArg(v){
          return encodeURIComponent(String(v == null ? '' : v)).replace(/['()!*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
        }
        // Cleans an attachments array received from the network or restored from saved state.
        function sanitizeChatAttachments(list){
          if (!Array.isArray(list)) return undefined;
          const out = [];
          list.forEach(a => {
            if (!a || typeof a !== 'object') return;
            const c = Object.assign({}, a);
            c.name = typeof a.name === 'string' ? a.name.slice(0, 255) : '';
            c.type = typeof a.type === 'string' ? a.type.slice(0, 100) : '';
            if (c.type === 'stitch/post') {
              if (c.thumbnail != null) c.thumbnail = safeChatUrl(c.thumbnail) || undefined;
              out.push(c);
              return;
            }
            if (c.type === 'stitch/challenge') {
              const code = String(a.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
              if (!code) return;
              out.push({ type: 'stitch/challenge', name: '', code, timePerQ: String(a.timePerQ || '').slice(0, 20), fromName: String(a.fromName || '').slice(0, 80) });
              return;
            }
            if (a.url != null) { c.url = safeChatUrl(a.url); if (!c.url) return; }
            if (a.dataUrl != null) { c.dataUrl = safeChatUrl(a.dataUrl); if (!c.dataUrl) return; }
            if (a.thumbnail != null) c.thumbnail = safeChatUrl(a.thumbnail) || undefined;
            out.push(c);
          });
          return out.length ? out : undefined;
        }
        function sanitizeChatVoice(v){
          if (!v || typeof v !== 'object') return undefined;
          const src = safeChatUrl(v.src);
          if (!src) return undefined;
          return { src, duration: Number(v.duration) > 0 ? Number(v.duration) : 0 };
        }
        // Strips scripts, event handlers and non-web link schemes from converted document HTML.
        function sanitizeDocHtml(html){
          try {
            const t = document.createElement('template');
            t.innerHTML = String(html == null ? '' : html);
            t.content.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form').forEach(n => n.remove());
            t.content.querySelectorAll('*').forEach(n => {
              Array.from(n.attributes).forEach(at => {
                const name = at.name.toLowerCase();
                if (name.startsWith('on')) { n.removeAttribute(at.name); return; }
                if (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action' || name === 'formaction') {
                  const v = at.value.trim();
                  if (!(/^(https?:|mailto:|#)/i.test(v) || (name === 'src' && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)))) n.removeAttribute(at.name);
                }
              });
            });
            return t.innerHTML;
          } catch (e) { return ''; }
        }

        // ---- Contacts list + avatar rendering ----
        function avatarMediaHTML(photo, icon, iconSizeClass){
          if (!photo) return Icon(icon || 'user', iconSizeClass);
          return `<img src="${escapeHtml(safeChatUrl(String(photo)))}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="w-full h-full items-center justify-center" style="display:none;">${Icon(icon || 'user', iconSizeClass)}</div>`;
        }

        function avatarInnerHTML(c, iconSizeClass){
          return avatarMediaHTML(c && c.photo, c && c.icon, iconSizeClass);
        }

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

        async function refreshConvoAvatarFromProfile(convoId){
          const meta = convoMeta[convoId];
          if (!meta || !meta.otherUserId) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data: row } = await sb.from(PUBLIC_PROFILES_TABLE).select('photo,username,last_active').eq('user_id', meta.otherUserId).maybeSingle();
            const freshPhoto = (row && row.photo) || null;
            const freshUsername = (row && row.username) || '';
            const freshLastActive = (row && row.last_active) || null;
            const photoChanged = freshPhoto !== meta.photo;
            const usernameChanged = freshUsername && freshUsername !== meta.username;
            const lastActiveChanged = freshLastActive !== meta.lastActive;
            if (!convoMeta[convoId]) return;
            if (lastActiveChanged) convoMeta[convoId].lastActive = freshLastActive;
            if (activeConvoId === convoId) refreshConvoStatusLine(convoId);
            if (!photoChanged && !usernameChanged) return; 
            convoMeta[convoId].photo = freshPhoto;
            if (usernameChanged) convoMeta[convoId].username = freshUsername;
            const entry = convoArrays().flat().find(c => c.id === convoId);
            if (entry) {
              entry.photo = freshPhoto;
              if (usernameChanged) entry.username = freshUsername;
            }
            queueSaveUserState();
            if (activeConvoId === convoId) {
              const headerAvatar = document.getElementById('chat-header-avatar');
              if (headerAvatar) headerAvatar.innerHTML = avatarInnerHTML(convoMeta[convoId], 'w-5 h-5');
              const headerName = document.getElementById('chat-header-name');
              if (headerName) headerName.textContent = convoDisplayName(convoMeta[convoId]);
            }
            if (callState.convoId === convoId) {
              const stageWrap = document.getElementById('call-stage-wrap');
              if (stageWrap) stageWrap.innerHTML = callStageHTML();
            }
            const inboxList = document.getElementById('inbox-list');
            if (inboxList) inboxList.innerHTML = inboxContent();
          } catch (e) {  }
        }

        // ---- Presence: who's online right now ----
        let onlineUserIds = new Set();
        let presenceChannel = null;
        let presenceSubscribedForUserId = null;

        async function subscribeToPresence(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (presenceChannel && presenceSubscribedForUserId === myId) return;
          if (presenceChannel) { try { sb.removeChannel(presenceChannel); } catch (e) {  } presenceChannel = null; }
          presenceSubscribedForUserId = myId;
          presenceChannel = sb.channel('online-users', { config: { presence: { key: myId } } });
          presenceChannel
            .on('presence', { event: 'sync' }, () => {
              const state = presenceChannel.presenceState();
              onlineUserIds = new Set(Object.keys(state));
              refreshAllVisiblePresenceUI();
            })
            .subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                try { await presenceChannel.track({ online_at: new Date().toISOString() }); } catch (e) {  }
              }
            });
          document.addEventListener('visibilitychange', () => {
            if (!presenceChannel) return;
            if (document.visibilityState === 'visible') {
              presenceChannel.track({ online_at: new Date().toISOString() }).catch(() => {});
            } else {
              presenceChannel.untrack().catch(() => {});
            }
          });
          window.addEventListener('beforeunload', () => {
            if (presenceChannel) presenceChannel.untrack().catch(() => {});
          });
        }

        function isUserOnline(userId){
          return !!userId && onlineUserIds.has(String(userId));
        }

        function refreshAllVisiblePresenceUI(){
          if (activeConvoId) refreshConvoStatusLine(activeConvoId);
          const inboxList = document.getElementById('inbox-list');
          if (currentTab === 3 && inboxList) inboxList.innerHTML = inboxContent();
        }

        // ---- Presence: "last active" heartbeat, so offline users show a real last-seen time ----
        let lastActiveHeartbeatTimer = null;

        async function startLastActiveHeartbeat(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          const beat = async () => {
            if (document.visibilityState !== 'visible') return;
            try { await sb.from(PUBLIC_PROFILES_TABLE).update({ last_active: new Date().toISOString() }).eq('user_id', myId); } catch (e) {  }
          };
          beat();
          if (lastActiveHeartbeatTimer) clearInterval(lastActiveHeartbeatTimer);
          lastActiveHeartbeatTimer = setInterval(beat, 120000);
          document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beat(); });
        }

        // ---- Typing indicator (per open conversation) ----
        let convoTypingChannel = null;
        let convoTypingChannelId = null;
        let typingByConvo = {}; // convoId -> boolean (the OTHER person is typing)
        let typingClearTimers = {};
        let iAmTypingSendTimer = null;
        let iAmTypingActive = false;
        let recordingByConvo = {}; // convoId -> boolean (the OTHER person is recording a voice note)
        let recordingClearTimers = {};

        function joinConvoTypingChannel(convoId){
          const sb = getSupabaseClient();
          if (!sb || !convoId) return;
          if (convoTypingChannelId === convoId && convoTypingChannel) return;
          leaveConvoTypingChannel();
          convoTypingChannelId = convoId;
          convoTypingChannel = sb.channel('typing:' + convoId, { config: { broadcast: { self: false } } });
          convoTypingChannel
            .on('broadcast', { event: 'typing' }, (msg) => {
              const payload = msg && msg.payload;
              if (!payload) return;
              typingByConvo[convoId] = !!payload.typing;
              if (typingClearTimers[convoId]) clearTimeout(typingClearTimers[convoId]);
              if (payload.typing) {
                // Safety net in case a "stopped typing" broadcast is lost (tab closed, etc.)
                typingClearTimers[convoId] = setTimeout(() => {
                  typingByConvo[convoId] = false;
                  if (activeConvoId === convoId) refreshConvoStatusLine(convoId);
                }, 6000);
              }
              if (activeConvoId === convoId) refreshConvoStatusLine(convoId);
            })
            .on('broadcast', { event: 'recording' }, (msg) => {
              const payload = msg && msg.payload;
              if (!payload) return;
              recordingByConvo[convoId] = !!payload.recording;
              if (recordingClearTimers[convoId]) clearTimeout(recordingClearTimers[convoId]);
              if (payload.recording) {
                // Safety net in case a "stopped recording" broadcast is lost.
                recordingClearTimers[convoId] = setTimeout(() => {
                  recordingByConvo[convoId] = false;
                  if (activeConvoId === convoId) refreshConvoStatusLine(convoId);
                }, 15000);
              }
              if (activeConvoId === convoId) refreshConvoStatusLine(convoId);
            })
            .subscribe();
        }

        function leaveConvoTypingChannel(){
          if (iAmTypingSendTimer) { clearTimeout(iAmTypingSendTimer); iAmTypingSendTimer = null; }
          if (iAmTypingActive && convoTypingChannel) sendTypingBroadcast(false);
          iAmTypingActive = false;
          if (convoRecording && convoTypingChannel) sendRecordingBroadcast(false);
          if (convoTypingChannel) {
            const sb = getSupabaseClient();
            if (sb) { try { sb.removeChannel(convoTypingChannel); } catch (e) {  } }
            convoTypingChannel = null;
          }
          convoTypingChannelId = null;
        }

        function sendTypingBroadcast(typing){
          if (!convoTypingChannel) return;
          convoTypingChannel.send({ type: 'broadcast', event: 'typing', payload: { typing } });
        }

        function sendRecordingBroadcast(recording){
          if (!convoTypingChannel) return;
          convoTypingChannel.send({ type: 'broadcast', event: 'recording', payload: { recording } });
        }

        function notifyConvoTyping(){
          if (!activeConvoId || !convoTypingChannel) return;
          if (!iAmTypingActive) {
            iAmTypingActive = true;
            sendTypingBroadcast(true);
          }
          if (iAmTypingSendTimer) clearTimeout(iAmTypingSendTimer);
          iAmTypingSendTimer = setTimeout(() => {
            iAmTypingActive = false;
            sendTypingBroadcast(false);
          }, 2500);
        }

        function convoStoppedTypingNow(){
          if (iAmTypingSendTimer) { clearTimeout(iAmTypingSendTimer); iAmTypingSendTimer = null; }
          if (iAmTypingActive) { iAmTypingActive = false; sendTypingBroadcast(false); }
        }

        function refreshConvoStatusLine(convoId){
          if (activeConvoId !== convoId) return;
          const meta = convoMeta[convoId];
          if (!meta) return;
          const el = document.getElementById('chat-header-status');
          if (el) el.textContent = convoLastSeenText(meta);
          const profileEl = document.getElementById('convo-profile-status');
          if (profileEl) profileEl.textContent = convoLastSeenText(meta);
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

        function contactListRow(c){
          return `
            <button onclick="closeOverlay(); startNewMessageWith('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
              <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForConvo('${c.id}')">${avatarInnerHTML(c,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0 cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForConvo('${c.id}')">
                <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.username || convoDisplayName(c))}</div>
                ${c.name ? `<div class="text-xs text-gray-400 mt-0.5 truncate">${escapeHtml(c.name)}</div>` : ''}
              </div>
            </button>`;
        }

        function myContactsHTML(){
          const all = convoArrays().flat();
          const raw = all.filter(c => c.network && c.icon !== 'users');
          // De-dupe by the actual person (otherUserId), not by conversation id: if the same person
          // ends up with two separate conversation rows both flagged network:true (e.g. a leftover
          const seen = new Set();
          const networkContacts = raw.filter(c => {
            const key = (convoMeta[c.id] && convoMeta[c.id].otherUserId) || c.otherUserId || c.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          return `
            ${overlayHeader('My Network', '20px')}
            <div class="flex-1 overflow-y-auto px-5 pb-6">
              <div class="divide-y divide-gray-100">
                ${networkContacts.length ? networkContacts.map(contactListRow).join('') : `<div class="py-6 text-center text-gray-400 text-sm">No network connections yet.</div>`}
              </div>
            </div>`;
        }

        function newMessageContactList(){
          const q = newMessageSearchQuery.trim().toLowerCase();
          const contacts = convoArrays().flat().filter(c => c.icon !== 'users');
          const filtered = q ? contacts.filter(c => c.name.toLowerCase().includes(q)) : contacts;
          if (!filtered.length) return `<div class="py-8 text-center text-gray-400 text-sm">No contacts found${q ? ` for "${escapeHtml(newMessageSearchQuery)}"` : ''}.</div>`;
          return filtered.map(c => `
              <button onclick="startNewMessageWith('${escapeForJsAttr(c.id)}')" class="w-full flex items-center gap-3 py-3 text-left">
                <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden" onclick="event.stopPropagation(); openPersonProfileForConvo('${escapeForJsAttr(c.id)}')">${avatarInnerHTML(c,'w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                  ${c.preview ? `<div class="text-xs text-gray-400 mt-0.5 truncate">${escapeHtml(c.preview)}</div>` : ''}
                </div>
              </button>`).join('');
        }

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

        let newCollabStep = 'type';
        let newCollabVisibility = 'private'; 
        let newCollabSelected = new Set();
        let newCollabName = '';
        let newCollabDescription = '';
        let newCollabPhoto = null;

        // ---- New message / new collaboration (group chat) setup ----
        function openNewCollaboration(){
          newCollabStep = 'type';
          newCollabVisibility = 'private';
          newCollabSelected = new Set();
          newCollabName = '';
          newCollabDescription = '';
          newCollabPhoto = null;
          openOverlay('newCollaboration');
        }

        function triggerNewCollabPhotoUpload(){
          let input = document.getElementById('new-collab-photo-input');
          if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.id = 'new-collab-photo-input';
            input.className = 'hidden';
            input.onchange = handleNewCollabPhotoSelected;
            document.body.appendChild(input);
          }
          input.click();
        }

        function handleNewCollabPhotoSelected(e){
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev){
            const img = new Image();
            img.onload = function(){
              const size = 320;
              const canvas = document.createElement('canvas');
              canvas.width = size; canvas.height = size;
              const ctx = canvas.getContext('2d');
              const side = Math.min(img.width, img.height);
              ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
              newCollabPhoto = canvas.toDataURL('image/jpeg', 0.9);
              if (newCollabStep === 'name') openOverlay('newCollaboration');
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }

        function newCollaborationHTML(){
          if (newCollabStep === 'type') return newCollabTypeHTML();
          return newCollabStep === 'name' ? newCollabNameHTML() : newCollabSelectHTML();
        }

        // ---- Step 1: General (public) or Private ----
        const PRIVATE_COLLAB_MAX_MEMBERS = 500;
        function chooseNewCollabType(vis){
          newCollabVisibility = vis === 'general' ? 'general' : 'private';
          newCollabStep = 'select';
          openOverlay('newCollaboration');
        }
        function newCollabTypeHTML(){
          const card = (vis, title, desc, bullets, iconName) => `
            <button onclick="chooseNewCollabType('${vis}')" class="collab-type-card w-full text-left rounded-2xl border border-gray-200 bg-white p-4 mb-3 block" style="box-shadow:0 1px 3px rgba(0,0,0,0.04);">
              <div class="font-display font-semibold text-[17px] text-gray-900">${title}</div>
              <div class="text-sm text-gray-500 mt-0.5 leading-snug">${desc}</div>
              <p class="text-xs text-gray-400 mt-2 leading-relaxed">${bullets.map(b => b.replace(/[.]$/, '') + '.').join(' ')}</p>
            </button>`;
          return `
            <div class="px-5 pb-3 border-b border-gray-100" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center gap-3">
                <button onclick="closeOverlay()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0 font-semibold text-lg font-display truncate grad-text" style="text-align:right;">New collaboration</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5" style="padding-top:20px;">
              <div class="text-sm text-gray-500 mb-4">What kind of collaboration do you want to create?</div>
              ${card('general','General','Open to everyone on Stitch.',['Anyone can find it by searching Messages and Collaborations','Shown on the Collaborations page','Anyone can join, no member limit'],'users')}
              ${card('private','Private','Only for people you invite.',[`Up to ${PRIVATE_COLLAB_MAX_MEMBERS} members`,'Never shown in search or on the Collaborations page','Only people with access can see it'],'lock')}
            </div>`;
        }

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
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center gap-4">
                <button onclick="newCollabStep='type';openOverlay('newCollaboration')" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-lg font-display truncate grad-text" style="text-align:right;">${newCollabVisibility === 'general' ? 'General collaboration' : 'Private collaboration'}</div>
                  ${count ? `<div class="text-xs text-gray-400" style="text-align:right;">${count} selected${newCollabVisibility === 'private' ? ` · max ${PRIVATE_COLLAB_MAX_MEMBERS}` : ''}</div>` : ''}
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5" style="position:relative;">
              <div class="divide-y divide-gray-100">
                ${contacts.map(c => `
                  <button onclick="toggleNewCollabContact('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
                    <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                    </div>
                    <div class="w-5 h-5 rounded-full ${newCollabSelected.has(c.id) ? `border-2 bg-[${ROYAL}] border-[${ROYAL}]` : 'border-[3px] border-gray-300'} flex items-center justify-center flex-shrink-0">${newCollabSelected.has(c.id) ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>
                  </button>`).join('')}
              </div>
            </div>
            ${(count || newCollabVisibility === 'general') ? `
              <div class="flex-shrink-0 flex justify-end" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
                <button onclick="proceedToNewCollabName()" class="flex items-center justify-center gap-2 text-white rounded-full px-6 py-3 text-sm font-semibold shadow-lg" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">
                  ${count || newCollabVisibility !== 'general' ? 'Next' : 'Skip'}
                </button>
              </div>
            ` : ''}`;
        }

        function proceedToNewCollabName(){
          if (!newCollabSelected.size && newCollabVisibility !== 'general') return;
          if (newCollabVisibility === 'private' && newCollabSelected.size + 1 > PRIVATE_COLLAB_MAX_MEMBERS) {
            openAppAlertModal(`Private collaborations can have up to ${PRIVATE_COLLAB_MAX_MEMBERS} members.`);
            return;
          }
          newCollabStep = 'name';
          openOverlay('newCollaboration');
        }

        function backToNewCollabSelect(){
          const input = document.getElementById('new-collab-name-input');
          if (input) newCollabName = input.value;
          const descInput = document.getElementById('new-collab-description-input');
          if (descInput) newCollabDescription = descInput.value;
          newCollabStep = 'select';
          openOverlay('newCollaboration');
        }

        function newCollabNameHTML(){
          const contacts = newCollabContactSource().filter(c => newCollabSelected.has(c.id));
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100 flex items-center gap-4" style="padding-top:var(--top-safe-pad);">
              <button onclick="backToNewCollabSelect()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <div class="flex-1 min-w-0 font-semibold text-lg font-display truncate grad-text" style="text-align:right;">New collaboration</div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-5">
              <div style="height:20px;"></div>
              <input id="new-collab-name-input" type="text" placeholder="Collaboration name" value="${newCollabName.replace(/"/g,'&quot;')}" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-[15px] mb-4" style="outline:none;">
              <textarea id="new-collab-description-input" placeholder="Description (optional)" rows="2" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-6" style="outline:none;resize:none;">${newCollabDescription.replace(/</g,'&lt;')}</textarea>
              <div class="flex items-center gap-4 mb-6">
                <div class="relative flex-shrink-0" onclick="triggerNewCollabPhotoUpload()">
                  <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden">${newCollabPhoto ? `<img src="${escapeHtml(safeChatUrl(String(newCollabPhoto)))}" class="w-full h-full object-cover">` : Icon('users','w-6 h-6')}</div>
                  <div class="absolute" style="bottom:-2px;right:-2px;width:22px;height:22px;border-radius:9999px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;background:${ROYAL};color:#fff;">${Icon('camera','w-3 h-3')}</div>
                </div>
                <div class="flex-1 min-w-0">
                  <button onclick="triggerNewCollabPhotoUpload()" class="text-sm font-semibold" style="color:${ROYAL};">${newCollabPhoto ? 'Change photo' : 'Add a profile picture'}</button>
                  <div class="text-xs text-gray-400 mt-0.5">Optional -- you can skip this and add one later.</div>
                </div>
              </div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-3">Members: ${contacts.length}</div>
              <div class="flex flex-nowrap gap-4 overflow-x-auto no-scrollbar" style="-webkit-overflow-scrolling:touch;touch-action:pan-x;padding-top:10px;">
                ${contacts.map(c => `
                  <div class="relative flex flex-col items-center gap-1 w-16 flex-shrink-0">
                    <div class="relative">
                      <div class="w-12 h-12 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                      <button onclick="toggleNewCollabContact('${c.id}')" class="absolute flex items-center justify-center" style="top:-4px;right:-4px;width:18px;height:18px;border-radius:9999px;background:#374151;border:2px solid #fff;" title="Remove">${Icon('close','w-2.5 h-2.5 text-white')}</button>
                    </div>
                    <div class="text-[11px] text-gray-600 text-center truncate w-full">${escapeHtml(c.name)}</div>
                  </div>`).join('')}
              </div>
            </div>
            <div class="flex-shrink-0 flex justify-end" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
              <button onclick="createNewCollaboration()" class="flex items-center justify-center gap-2 text-white rounded-full px-6 py-3 text-sm font-semibold shadow-lg" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">
                Create
              </button>
            </div>`;
        }

        async function createNewCollaboration(){
          const input = document.getElementById('new-collab-name-input');
          const typedName = input ? input.value.trim() : '';
          if (!typedName) {
            openAppAlertModal('Please give your collaboration a name.');
            if (input) input.focus();
            return;
          }
          const descInput = document.getElementById('new-collab-description-input');
          const typedDescription = descInput ? descInput.value.trim() : '';
          // Photo is optional and can be skipped
          const contacts = newCollabContactSource().filter(c => newCollabSelected.has(c.id));
          const finalName = typedName;
          const finalDescription = typedDescription;
          const finalPhoto = newCollabPhoto;
          const finalVisibility = newCollabVisibility === 'general' ? 'general' : 'private';
          if (finalVisibility === 'private' && contacts.length + 1 > PRIVATE_COLLAB_MAX_MEMBERS) {
            openAppAlertModal(`Private collaborations can have up to ${PRIVATE_COLLAB_MAX_MEMBERS} members.`);
            return;
          }
          // Random, unguessable id: the invite link is the only key to join, so it must not be
          // derivable from the creation time
          const id = 'c' + Date.now() + '-' + (function(){
            try { return Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join(''); }
            catch (e) { return Math.random().toString(16).slice(2, 14) + Math.random().toString(16).slice(2, 14); }
          })();
          const myMember = {
            otherUserId: null, name: (typeof profileData !== 'undefined' && profileData.name) || 'You',
            avatarBg: 'bg-blue-100', icon: 'user', photo: (typeof profileData !== 'undefined' && profileData.photo) || null, mine: true,
          };
          const members = [myMember, ...contacts.map(c => ({ otherUserId: c.otherUserId || null, name: c.name, avatarBg: c.avatarBg, icon: c.icon, photo: c.photo || null, mine: false }))];
          const newConvo = { id, icon:'users', avatarBg:'bg-emerald-100', name: finalName, photo: finalPhoto, preview:'You created this collaboration', time: formatRequestTime(Date.now()), unread:false };
          collabConvos.unshift(newConvo);
          convoMeta[id] = { icon:'users', avatarBg:'bg-emerald-100', name: finalName, description: finalDescription, photo: finalPhoto, preview:'You created this collaboration', members, createdBy: 'me', membersCanAdd: false, visibility: finalVisibility };
          conversationMessages[id] = [{ from:'them', text: contacts.length ? `You created "${finalName}" with ${contacts.map(c => c.name).join(', ')}.` : `You created "${finalName}". Anyone on Stitch can find and join it.`, time: Date.now() }];
          queueSaveUserState();
          inboxFilter = 'collaborations';
          inboxViewFilter = 'all';
          closeOverlay();
          renderInboxTab();
          openConversation(id);
          const createdRemotely = await collabCreateRemote(id, finalName, finalPhoto, contacts, finalDescription, finalVisibility);
          if (createdRemotely && convoMeta[id]) {
            const myRealId = _cachedAuthUser && _cachedAuthUser.id;
            convoMeta[id].createdBy = myRealId;
            // The creator's own member row was seeded with otherUserId:null at creation time (see
            // myMember above)
            const mineEntry = (convoMeta[id].members || []).find(m => m.mine);
            if (mineEntry && myRealId) mineEntry.otherUserId = myRealId;
            queueSaveUserState();
            // Push each invited person so they're notified even if their app is closed
            const myName = myMember.name;
            contacts.forEach(c => {
              if (!c.otherUserId) return;
              sendPushTo(c.otherUserId, {
                title: 'Added to a group',
                body: `${myName} added you to "${finalName}"`,
                tag: 'collab-add-' + id,
                data: { kind: 'collab_add', convoId: id },
              });
            });
          } else if (!createdRemotely && contacts.length) {
            pushInAppNotification('Collaboration not synced', `"${finalName}" was created on this device only -- the others won't see it until this syncs. Check your connection or Supabase setup.`);
          }
        }

        // ---- Collaboration (group) membership management ----
        function isMe(userId){
          return !!userId && typeof _cachedAuthUser !== 'undefined' && !!_cachedAuthUser && _cachedAuthUser.id === userId;
        }

        let collabMembersOverlayOpen = false;
        let collabProfileOverlayOpen = false;
        function openCollabMembers(){
          collabMembersOverlayOpen = true;
          collabProfileOverlayOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = collabMembersHTML();
        }

        function collabMembersHTML(){
          const id = activeConvoId;
          const meta = convoMeta[id] || {};
          const members = meta.members || [];
          const iAmCreator = isMe(meta.createdBy) || meta.createdBy === 'me';
          const canAddMembers = iAmCreator || !!meta.membersCanAdd;
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="px-5 pb-3 flex items-center gap-4">
                <button onclick="closeConvoProfile()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display grad-text">Members (${members.length})</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-5">
              ${canAddMembers ? `
              <button onclick="openAddCollabMembers()" class="w-full flex items-center gap-3 py-3 text-left mb-2">
                <div class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:${ROYAL};">${Icon('plus','w-5 h-5')}</div>
                <div class="text-[15px] font-semibold" style="color:${ROYAL};">Add members</div>
              </button>` : ''}
              ${iAmCreator ? `
              <div class="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 mb-4">
                ${notificationSettingsRow('users','bg-emerald-50','text-emerald-600','Let members add people', meta.membersCanAdd ? 'Any member can add new people' : 'Only you can add new people', !!meta.membersCanAdd, 'toggleCollabMembersCanAdd()')}
              </div>` : ''}
              <div class="rounded-2xl border border-gray-100 divide-y bg-white shadow-sm px-4">
                ${orderedCollabMembers(members).map(m => `
                  <div class="flex items-center gap-3 py-3">
                    <div class="w-11 h-11 rounded-full ${m.avatarBg || 'bg-gray-100'} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(m,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(m.name)}${m.mine ? ' (You)' : ''}</div>
                      ${meta.createdBy && m.otherUserId === meta.createdBy ? `<div class="text-xs text-gray-400 mt-0.5">Creator</div>` : ''}
                    </div>
                    ${(!m.mine && (iAmCreator || meta.createdBy === undefined)) ? `
                      <button onclick="removeCollabMemberTap('${m.otherUserId || ''}','${escapeHtml(m.name).replace(/'/g,"\\'")}')" class="p-2 text-red-500 flex-shrink-0" title="Remove">${Icon('close','w-4 h-4')}</button>
                    ` : ''}
                  </div>`).join('')}
              </div>
            </div>`;
        }

        let addCollabSelected = new Set();

        function openAddCollabMembers(){
          collabMembersOverlayOpen = false;
          collabProfileOverlayOpen = false;
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
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center gap-4">
                <button onclick="openCollabMembers()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-lg font-display truncate grad-text">Add members</div>
                  <div class="text-xs text-gray-400">${count ? count + ' selected' : 'Select contacts to add'}</div>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5" style="position:relative;">
              <div class="divide-y divide-gray-100">
                ${contacts.length ? contacts.map(c => `
                  <button onclick="toggleAddCollabContact('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
                    <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                    </div>
                    <div class="w-5 h-5 rounded-full border-2 ${addCollabSelected.has(c.id) ? `bg-[${ROYAL}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${addCollabSelected.has(c.id) ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>
                  </button>`).join('') : `<div class="text-center text-gray-400 text-sm py-8">Everyone in your contacts is already a member.</div>`}
              </div>
            </div>
            ${count ? `
              <div class="flex-shrink-0 flex justify-end" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
                <button onclick="confirmAddCollabMembers()" class="flex items-center justify-center gap-2 text-white rounded-full px-6 py-3 text-sm font-semibold shadow-lg" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">
                  Add
                </button>
              </div>
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
          const myName = (typeof profileData !== 'undefined' && profileData.name) || 'Someone';
          collabAddMembersRemote(id, meta.name, newContacts).then(ok => {
            if (!ok) { pushInAppNotification('Members not synced', `The people you just added won't see "${meta.name}" until this syncs. Check your connection or Supabase setup.`); return; }
            // Let everyone already in the group know who just joined, and separately notify the new
            // members themselves
            sendGroupSystemEvent(id, `${myName} added ${newContacts.map(c => c.name).join(', ')} to the group`, {
              excludeUserIds: new Set(newContacts.map(c => c.otherUserId).filter(Boolean)),
            });
            newContacts.forEach(c => {
              if (!c.otherUserId) return;
              sendPushTo(c.otherUserId, {
                title: 'Added to a group',
                body: `${myName} added you to "${meta.name}"`,
                tag: 'collab-add-' + id,
                data: { kind: 'collab_add', convoId: id },
              });
            });
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
            if (userId) {
              collabRemoveMemberRemote(id, userId);
              const myName = (typeof profileData !== 'undefined' && profileData.name) || 'Someone';
              sendGroupSystemEvent(id, `${myName} removed ${name} from the group`);
              sendPushTo(userId, {
                title: 'Removed from a group',
                body: `${myName} removed you from "${meta.name}"`,
                tag: 'collab-remove-' + id,
                data: { kind: 'collab_remove', convoId: id },
              });
            }
          });
        }

        async function toggleCollabMembersCanAdd(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          const next = !meta.membersCanAdd;
          meta.membersCanAdd = next;
          queueSaveUserState();
          openCollabMembers();
          const ok = await collabUpdateMembersCanAddRemote(id, next);
          if (!ok.ok) {
            pushInAppNotification(
              'Setting not synced',
              ok.reason === 'missing_column'
                ? "Your database needs a small update before this setting can be saved -- ask whoever set up your Supabase project to add a `members_can_add` column to the collaborations table."
                : "This didn't save to the server -- try again once you're back online."
            );
          }
        }

        // ---- Collaboration invite link (tap to join) ----
        function buildCollabInviteLink(collabId){
          return window.location.origin + window.location.pathname + '?joinCollab=' + encodeURIComponent(collabId);
        }
        function shareCollabInviteLink(){
          const meta = convoMeta[activeConvoId];
          const link = buildCollabInviteLink(activeConvoId);
          if (navigator.share) {
            navigator.share({ title: meta ? meta.name : 'Stitch collaboration', text: `Join "${(meta && meta.name) || 'this collaboration'}" on Stitch`, url: link }).catch(() => {});
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => pushInAppNotification('Link copied', 'Invite link copied to your clipboard.')).catch(() => openAppAlertModal(link));
          } else {
            openAppAlertModal(link);
          }
        }

        // Whoever opens this link gets asked to join or cancel (see guestCollabJoinHTML) rather
        // than being added silently
        let pendingCollabJoinId = null;
        function checkPendingCollabLinkJoin(){
          let collabId;
          try {
            collabId = new URLSearchParams(window.location.search || '').get('joinCollab');
          } catch (err) { return; }
          if (!collabId) return;
          history.replaceState(null, '', window.location.pathname);
          if (convoMeta[collabId]) {
            // Already a member -- just open it.
            if (typeof openConversation === 'function') openConversation(collabId);
            return;
          }
          pendingCollabJoinId = collabId;
          openOverlay('guestCollabJoin');
        }

        async function fetchCollabInvitePreview(collabId){
          const sb = getSupabaseClient();
          if (!sb) return null;
          try {
            const { data, error } = await sb.rpc('get_collaboration_preview', { p_collab_id: collabId });
            if (error || !data || data.status !== 'ok') return null;
            return data;
          } catch (e) { return null; }
        }

        let guestCollabPreview = null;
        async function openGuestCollabJoinOverlay(){
          guestCollabPreview = await fetchCollabInvitePreview(pendingCollabJoinId);
          const ov = document.getElementById('overlay');
          if (ov && document.getElementById('guest-collab-join-screen')) ov.innerHTML = guestCollabJoinHTML();
        }

        function guestCollabJoinHTML(){
          const name = (guestCollabPreview && guestCollabPreview.name) || 'this collaboration';
          return `
            <div id="guest-collab-join-screen" class="flex-1 flex flex-col items-center justify-center px-8 text-center" style="padding-top:var(--top-safe-pad);">
              <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5 overflow-hidden" style="background:rgba(30,144,255,0.1);color:${NAVY};">${guestCollabPreview && guestCollabPreview.photo ? `<img src="${escapeHtml(safeChatUrl(String(guestCollabPreview.photo)))}" class="w-full h-full object-cover">` : Icon('users','w-7 h-7')}</div>
              <div class="text-xl font-bold font-display mb-2">You're invited to join</div>
              <div class="text-sm text-gray-500 mb-6 leading-relaxed">"${escapeHtml(name)}" wants you to join this collaboration on Stitch.</div>
              <button onclick="submitGuestCollabJoin()" class="w-full max-w-xs font-semibold py-3 rounded-full text-white mb-3" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Join</button>
              <button onclick="cancelGuestCollabJoin()" class="text-sm font-semibold text-gray-400">Cancel</button>
            </div>`;
        }

        async function submitGuestCollabJoin(){
          if (!pendingCollabJoinId) return;
          const collabId = pendingCollabJoinId;
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal("Couldn't join right now. Please try again."); return; }
          const { data, error } = await sb.rpc('join_collaboration_by_id', { p_collab_id: collabId });
          if (error || !data || data.status !== 'joined') {
            openAppAlertModal(data && data.status === 'not_found' ? "That invite link isn't valid anymore." : "Couldn't join that collaboration. Please try again.");
            return;
          }
          pendingCollabJoinId = null;
          closeOverlay();
          if (typeof loadMyCollaborations === 'function') await loadMyCollaborations();
          if (typeof openConversation === 'function') openConversation(collabId);
        }

        function cancelGuestCollabJoin(fromPopState){
          pendingCollabJoinId = null;
          closeOverlay(fromPopState);
        }

        // ---- General (public) collaborations: discovery, search and join ----
        let generalCollabs = [];
        let generalCollabsLoaded = false;
        let generalCollabsLoading = false;
        let inboxCollabSearchResults = [];
        let inboxCollabSearchSeq = 0;
        let inboxCollabSearchTimer = null;
        let joiningGeneralCollabIds = new Set();

        function rerenderInboxList(){
          const list = document.getElementById('inbox-list');
          if (list && typeof currentTab !== 'undefined' && currentTab === 3) list.innerHTML = inboxContent();
        }

        async function loadGeneralCollabs(force){
          if (generalCollabsLoading || (generalCollabsLoaded && !force)) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          generalCollabsLoading = true;
          try {
            const { data, error } = await sb.rpc('list_general_collaborations', { p_limit: 50, p_offset: 0 });
            if (error) { console.warn('Could not load general collaborations:', error); }
            else { generalCollabs = Array.isArray(data) ? data : []; generalCollabsLoaded = true; }
          } catch (e) { console.warn('Loading general collaborations threw:', e); }
          generalCollabsLoading = false;
          if (inboxFilter === 'collaborations') rerenderInboxList();
        }

        function scheduleInboxCollabSearch(){
          clearTimeout(inboxCollabSearchTimer);
          const q = (inboxSearchQuery || '').trim();
          if (!inboxSearchActive || !q) { inboxCollabSearchResults = []; return; }
          const seq = ++inboxCollabSearchSeq;
          inboxCollabSearchTimer = setTimeout(async () => {
            const sb = getSupabaseClient();
            if (!sb) return;
            try {
              const { data, error } = await sb.rpc('search_general_collaborations', { p_query: q, p_limit: 20 });
              if (seq !== inboxCollabSearchSeq) return;
              inboxCollabSearchResults = (!error && Array.isArray(data)) ? data : [];
              rerenderInboxList();
            } catch (e) {}
          }, 250);
        }

        function generalCollabRowHTML(g){
          const joined = !!g.is_member || collabConvos.some(c => c.id === g.id);
          const joining = joiningGeneralCollabIds.has(g.id);
          const count = Number(g.member_count) || 0;
          const gid = escapeHtml(String(g.id)).replace(/'/g, "\\'");
          return `
            <div class="flex items-center gap-4 px-5 py-4 bg-white">
              <div class="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${g.photo ? `<img src="${escapeHtml(safeChatUrl(String(g.photo)))}" class="w-full h-full object-cover">` : Icon('users','w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] font-semibold text-gray-900 truncate">${escapeHtml(g.name || 'Collaboration')}</div>
                <div class="text-xs text-gray-400 truncate">${count} member${count === 1 ? '' : 's'}${g.description ? ' · ' + escapeHtml(g.description) : ''}</div>
              </div>
              ${joined
                ? `<button onclick="openConversation('${gid}')" class="text-xs font-semibold rounded-full px-4 py-2 flex-shrink-0" style="color:${NAVY};border:1.5px solid ${NAVY};">Open</button>`
                : `<button ${joining ? 'disabled' : ''} onclick="joinGeneralCollab('${gid}')" class="text-xs font-semibold rounded-full px-4 py-2 text-white flex-shrink-0" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);${joining ? 'opacity:.6;' : ''}">${joining ? 'Joining...' : 'Join'}</button>`}
            </div>`;
        }

        async function joinGeneralCollab(id){
          if (!id || joiningGeneralCollabIds.has(id)) return;
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal("Couldn't join right now. Please check your connection."); return; }
          joiningGeneralCollabIds.add(id);
          rerenderInboxList();
          let ok = false, status = '';
          try {
            const { data, error } = await sb.rpc('join_collaboration_by_id', { p_collab_id: id });
            status = data && data.status;
            ok = !error && status === 'joined';
          } catch (e) {}
          joiningGeneralCollabIds.delete(id);
          if (!ok) {
            rerenderInboxList();
            openAppAlertModal(status === 'not_found' ? 'That collaboration no longer exists.' : status === 'full' ? 'That collaboration is full.' : "Couldn't join that collaboration. Please try again.");
            return;
          }
          generalCollabs = generalCollabs.map(g => g.id === id ? { ...g, is_member: true, member_count: (Number(g.member_count) || 0) + 1 } : g);
          inboxCollabSearchResults = inboxCollabSearchResults.map(g => g.id === id ? { ...g, is_member: true, member_count: (Number(g.member_count) || 0) + 1 } : g);
          await loadMyCollaborations();
          rerenderInboxList();
          openConversation(id);
        }

        function discoverCollabsSectionHTML(){
          const mine = new Set(collabConvos.map(c => c.id));
          const items = generalCollabs.filter(g => !g.is_member && !mine.has(g.id));
          if (!items.length) return '';
          return `
            <div class="px-5 pt-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Discover collaborations</div>
            ${items.map(generalCollabRowHTML).join('')}`;
        }

        function leaveCollaboration(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!id || !meta) return;
          openAppConfirmModal(`Leave "${meta.name}"?`, "You'll no longer see this collaboration's messages, but it stays visible to everyone else.", 'Leave', function(){
            const myId = typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser ? _cachedAuthUser.id : null;
            const myName = (typeof profileData !== 'undefined' && profileData.name) || 'Someone';
            sendGroupSystemEvent(id, `${myName} left the group`);
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

        // ---- Collaboration photo/rename/leave/delete ----
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

        function renameCollaboration(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!meta) return;
          const typed = prompt('Rename collaboration:', meta.name || '');
          if (typed === null) return; 
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

        function editCollabDescription(){
          const id = activeConvoId;
          const meta = convoMeta[id];
          if (!meta) return;
          const typed = prompt('Collaboration description:', meta.description || '');
          if (typed === null) return;
          const newDescription = typed.trim();
          if (newDescription === (meta.description || '')) return;
          meta.description = newDescription;
          queueSaveUserState();
          renderConvoProfile();
          collabUpdateDescriptionRemote(id, newDescription);
        }

        // ---- Inbox tab render (primary/requests/collabs) ----
        function newMessageHTML(){
          const gradientBg = `background:rgba(10,37,64,0.5);`;
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:var(--top-safe-pad);">
              ${newMessageSearchActive ? `
                <div class="flex items-center gap-3">
                  <button onclick="deactivateNewMessageSearch()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <div class="flex-1 flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm">
                    ${Icon('search','w-4 h-4')}
                    <input id="new-message-search-input" type="text" value="${newMessageSearchQuery}" oninput="onNewMessageSearchInput(this.value)" placeholder="Search contacts..." class="flex-1 min-w-0 bg-transparent outline-none text-gray-800" autocomplete="off">
                  </div>
                </div>
              ` : `
                <div class="relative flex items-center justify-center" style="min-height:40px;">
                  <button onclick="closeOverlay()" class="absolute flex-shrink-0" style="left:0;top:50%;transform:translateY(-50%);">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <div class="font-semibold text-lg font-display truncate grad-text text-center" style="max-width:60%;">Select network</div>
                  <button onclick="activateNewMessageSearch()" title="Search" class="absolute w-10 h-10 flex items-center justify-center" style="right:-8px;top:50%;transform:translateY(-50%);">${gradIcon(Icon('search','w-6 h-6'))}</button>
                </div>
              `}
            </div>
            <div class="flex-1 overflow-y-auto px-5">
              <div class="divide-y divide-gray-100 border-b border-gray-100 pb-2 mb-2">
                ${newMessageContactRow('users', gradientBg, 'New collaboration', "openNewCollaboration()", 'Work on something together')}
              </div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1">Connections</div>
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
                <button onclick="toggleInboxActionsMenu()" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('dots','w-6 h-6'))}</button>
              ` : `
                <span id="inbox-username-el" class="font-bold text-base font-display grad-text whitespace-nowrap">${escapeHtml(profileData.username)}</span>
                <button id="inbox-filter-btn" onclick="toggleInboxFilterMenu()" class="h-10 flex items-center justify-end flex-shrink-0" style="width:32px;margin-right:-2px;" title="Menu">${gradIcon(Icon('dashesShortRight','w-6 h-6'))}</button>
              `}
            </div>`;
        }

        // "General" should only count unread DMs
        function generalUnreadCount(){
          return primaryConvos.filter(c => c.unread && !c.read).reduce((n, c) => n + (c.unreadCount || 1), 0);
        }

        function inboxFilterBarRowHTML(){
          return inboxFilters.map(([key,label,count]) => {
            const effectiveCount = key === 'requests' ? requestConvos.length
              : key === 'collaborations' ? collabConvos.filter(c => c.unread && !c.read).reduce((n, c) => n + (c.unreadCount || 1), 0)
              : key === 'general' ? generalUnreadCount()
              : count;
            return `
              <button onclick="inboxFilterTab('${key}')" class="flex-shrink-0 flex items-center gap-1 px-4 py-2 rounded-full text-xs font-semibold ${inboxFilter===key ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${inboxFilter===key ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">
                ${label}${effectiveCount ? `<span class="rounded-full ${inboxFilter===key?`bg-[${NAVY}] text-white`:'bg-red-500 text-white'} text-[9px] flex items-center justify-center" style="min-width:1rem;height:1rem;padding:0 0.25rem;">${effectiveCount}</span>` : ''}
              </button>
            `;
          }).join('');
        }

        // Tapping into a conversation (or any other action that flips a convo's read/unread flag)
        // used to only refresh #inbox-list
        function refreshInboxFilterBar(){
          const row = document.getElementById('inbox-filterbar-row');
          if (row) row.innerHTML = inboxFilterBarRowHTML();
        }

        // Collapse duplicate Sent entries for the same person (already saved from earlier runs).
        function dedupeSentRequestConvos(){
          const seen = new Set();
          for (let i = 0; i < sentRequestConvos.length; i++) {
            const k = sentRequestConvos[i].otherUserId;
            if (!k) continue;
            if (seen.has(k)) { sentRequestConvos.splice(i, 1); i--; } else seen.add(k);
          }
        }

        function renderInboxTab(){
          dedupeSentRequestConvos();
          // Background updates (realtime messages, request loaders, state sync) call this at any
          // time
          if (typeof currentTab !== 'undefined' && currentTab !== 3) return;
          syncAllConvoPreviewsFromMessages();
          const prevInboxScreenEl = document.getElementById('screen');
          const prevInboxScrollTop = prevInboxScreenEl ? prevInboxScreenEl.scrollTop : 0;
          document.getElementById('screen').innerHTML = `
            <div id="inbox-titlebar" class="sticky top-0 z-20 px-5 pb-3 border-b border-gray-100" style="padding-top:var(--top-safe-pad);background:#f9fafb;">
              ${inboxTitlebarRowHTML()}
              ${inboxMenuOpen ? `<div onclick="toggleInboxActionsMenu()" onwheel="toggleInboxActionsMenu()" ontouchmove="toggleInboxActionsMenu()" class="fixed inset-0 z-10"></div>${notifActionsDropdownHTML('handleInboxAction')}` : ''}
            </div>
            <div id="inbox-searchbar" class="sticky z-10 bg-gray-50 px-5 pt-4" style="padding-bottom:8px;">
              ${inboxSearchActive ? `
                <div class="w-full flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm">
                  ${Icon('search','w-4 h-4')}
                  <input id="inbox-search-input" type="text" value="${escapeHtml(inboxSearchQuery)}" oninput="onInboxSearchInput(this.value)" placeholder="Search contacts and collaborations..." class="flex-1 min-w-0 bg-transparent outline-none text-gray-800" autocomplete="off">
                  <button onclick="deactivateInboxSearch()" class="text-xs font-semibold flex-shrink-0" style="color:${NAVY};">Cancel</button>
                </div>
              ` : `
                <button onclick="activateInboxSearch()" class="w-full flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2.5 text-sm text-left">
                  ${Icon('search','w-4 h-4')}<span>Search contacts and collaborations...</span>
                </button>
              `}
            </div>
            <div id="inbox-filterbar" class="sticky z-10 bg-gray-50 px-5 pb-3 border-b border-gray-100">
              <div class="pill-bleed flex gap-2 overflow-x-auto no-scrollbar pb-1" id="inbox-filterbar-row">${inboxFilterBarRowHTML()}</div>
            </div>
            <div class="divide-y" id="inbox-list">${inboxContent()}</div>`;
          stickBarsStack(['inbox-titlebar','inbox-searchbar','inbox-filterbar']);
          if (prevInboxScrollTop) {
            const restoredScreenEl = document.getElementById('screen');
            if (restoredScreenEl) {
              restoredScreenEl.scrollTop = prevInboxScrollTop;
            }
          }
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

        // ---- Conversation selection + long-press actions ----
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
            if (mySeq !== networkCountRequestSeq) return;
            if (fromErr || toErr) { console.warn('Refreshing network count failed:', fromErr || toErr); scheduleRetry(); return; }
            const ids = new Set([
              ...(fromRows || []).map(r => r.to_user),
              ...(toRows || []).map(r => r.from_user),
            ]);
            cachedNetworkCount = ids.size;
            if (currentTab === 4 && typeof renderProfile === 'function') renderProfile();
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'careerAnalytics' && typeof careerAnalyticsHTML === 'function') {
              const ov = document.getElementById('overlay');
              if (ov) ov.innerHTML = careerAnalyticsHTML();
            }
          } catch (e) { console.warn('Refreshing network count failed:', e); scheduleRetry(); }
        }

        function isUserInMyNetwork(userId){
          if (!userId) return false;
          return convoArrays().flat().some(c => c.network && c.otherUserId === userId);
        }

        // Whether *I* currently have an outgoing connection request pending to this person
        function isConnectionRequestPendingTo(userId){
          if (!userId) return false;
          return sentRequestConvos.some(c => c.otherUserId === userId);
        }

        // Keeps any currently-open "other person's network" list (and its cache) lined up with
        // reality whenever a connection is accepted, sent, cancelled, or declined
        function syncNetworkConnectionStates(){
          if (typeof viewedProfile !== 'undefined' && viewedProfile && viewedProfile.id) {
            const nowConnected = isUserInMyNetwork(viewedProfile.id);
            const nowSent = !nowConnected && isConnectionRequestPendingTo(viewedProfile.id);
            let changed = false;
            if (nowConnected && !viewedProfile.connected) { viewedProfile.connected = true; viewedProfile.requestSent = false; changed = true; }
            else if (!nowConnected && !viewedProfile.connected && viewedProfile.requestSent !== nowSent && viewedProfile.loaded) { viewedProfile.requestSent = nowSent; changed = true; }
            if (changed && typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'personProfile' && typeof renderPersonProfile === 'function') renderPersonProfile();
          }
          if (typeof viewedProfile !== 'undefined' && viewedProfile && Array.isArray(viewedProfile.network)) {
            viewedProfile.network.forEach(m => {
              m.connected = isUserInMyNetwork(m.id);
              m.requestSent = isConnectionRequestPendingTo(m.id);
            });
          }
          if (typeof personProfileCache !== 'undefined') {
            Object.keys(personProfileCache).forEach(id => {
              const entry = personProfileCache[id];
              if (entry && entry.network && Array.isArray(entry.network.network)) {
                entry.network.network.forEach(m => {
                  m.connected = isUserInMyNetwork(m.id);
                  m.requestSent = isConnectionRequestPendingTo(m.id);
                });
              }
            });
          }
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'personNetwork' && typeof personNetworkHTML === 'function') {
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = personNetworkHTML();
          }
        }

        // ---- Server-truth reconcile for the network ----
        let networkReconcileSeq = 0;
        function hasRecentLocalConnection(userId){
          const now = Date.now();
          return convoArrays().flat().some(c => c.otherUserId === userId && c._localAt && (now - c._localAt) < 20000);
        }
        async function reconcileNetworkWithServer(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const seq = ++networkReconcileSeq;
            const [a, b] = await Promise.all([
              sb.from(CONNECTION_REQUESTS_TABLE).select('to_user').eq('from_user', me.id).eq('status', 'accepted'),
              sb.from(CONNECTION_REQUESTS_TABLE).select('from_user').eq('to_user', me.id).eq('status', 'accepted'),
            ]);
            if (seq !== networkReconcileSeq) return;
            if (a.error || b.error || !Array.isArray(a.data) || !Array.isArray(b.data)) return;
            const acceptedIds = new Set([...a.data.map(r => r.to_user), ...b.data.map(r => r.from_user)]);
            const staleIds = new Set();
            convoArrays().forEach(arr => {
              for (let i = arr.length - 1; i >= 0; i--) {
                const c = arr[i];
                if (!c.network || c.icon === 'users' || !c.otherUserId) continue;
                if (acceptedIds.has(c.otherUserId)) continue;
                if (c._localAt && (Date.now() - c._localAt) < 20000) continue;
                arr.splice(i, 1);
                delete convoMeta[c.id];
                staleIds.add(c.otherUserId);
              }
            });
            if (typeof discoverPeople !== 'undefined') {
              discoverPeople.forEach(p => { if (p.connected && !acceptedIds.has(p.id) && !hasRecentLocalConnection(p.id)) staleIds.add(p.id); });
            }
            if (typeof viewedProfile !== 'undefined' && viewedProfile && viewedProfile.connected && !acceptedIds.has(viewedProfile.id) && !hasRecentLocalConnection(viewedProfile.id)) {
              staleIds.add(viewedProfile.id);
            }
            const countChanged = cachedNetworkCount !== acceptedIds.size;
            cachedNetworkCount = acceptedIds.size;
            if (!staleIds.size) { if (countChanged && currentTab === 4 && typeof renderProfile === 'function') renderProfile(); return; }
            staleIds.forEach(id => { if (typeof markUserDisconnectedLocally === 'function') markUserDisconnectedLocally(id); });
            queueSaveUserState();
            renderInboxTab();
            if (currentTab === 4 && typeof renderProfile === 'function') renderProfile();
          } catch (e) { console.warn('Reconciling network failed:', e); }
        }

        function findConvoAndArray(id){
          for (const arr of convoArrays()){
            const idx = arr.findIndex(c => c.id === id);
            if (idx !== -1) return { arr, idx };
          }
          return null;
        }

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
              if (found) { found.arr[found.idx].read = true; found.arr[found.idx].unreadCount = 0; }
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
          // "Meetings" is not an inbox list: it opens the meetings page (create + your meetings)
          if (key === 'meetings') { openCreateMenu(); return; }
          inboxFilter = key;
          inboxViewFilter = 'all';
          renderInboxTab();
        }

        function inboxContent(){
          if (inboxSearchActive && inboxSearchQuery.trim()){
            const q = inboxSearchQuery.trim().toLowerCase();
            const results = convoArrays().flat().filter(c => c.name.toLowerCase().includes(q));
            const myIds = new Set(collabConvos.map(c => c.id));
            const publicResults = inboxCollabSearchResults.filter(g => !myIds.has(g.id));
            const publicHTML = publicResults.length ? `
              <div class="px-5 pt-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Public collaborations</div>
              ${publicResults.map(generalCollabRowHTML).join('')}` : '';
            return (results.length || publicResults.length)
              ? results.map(c => convoRow(c)).join('') + publicHTML
              : `<div class="inbox-empty bg-white p-8 text-center text-gray-400 text-sm">No results found for "${escapeHtml(inboxSearchQuery)}".</div>`;
          }
          const applyView = (arr) => {
            if (inboxViewFilter === 'unread') return arr.filter(c => c.unread && !c.read);
            if (inboxViewFilter === 'pinned') return arr.filter(c => c.pinned);
            return arr;
          };
          const emptyLabel = (defaultText) => inboxViewFilter === 'pinned' ? 'No pinned messages.' : defaultText;
          // Empty inbox / requests / pinned: just a clean blank page, no text
          const emptyState = (title, body, fallback) => `<div class="inbox-empty empty-center bg-white"></div>`;
          if (inboxFilter === 'general') {
            const list = applyView(primaryConvos);
            return list.length ? list.map(c => convoRow(c)).join('') : emptyState('Your inbox is empty', 'Tap the menu in the top right corner to start messaging your contacts. Your conversations will show up here.', 'No messages.');
          }
          if (inboxFilter === 'requests') {
            const incoming = applyView(requestConvos);
            const sent = applyView(sentRequestConvos);
            if (!incoming.length && !sent.length) {
              return emptyState('No requests yet', 'Message requests you send and receive will appear here.', 'No requests.');
            }
            const incomingHTML = incoming.length ? incoming.map(c => requestRow(c)).join('') : '';
            const sentHTML = sent.length ? `
              <div class="px-5 pt-4 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">Sent</div>
              ${sent.map(c => sentRequestRow(c)).join('')}` : '';
            return incomingHTML + sentHTML;
          }
          if (inboxFilter === 'collaborations') {
            if (!generalCollabsLoaded && !generalCollabsLoading) loadGeneralCollabs();
            const list = applyView(collabConvos);
            const discoverHTML = inboxViewFilter === 'all' ? discoverCollabsSectionHTML() : '';
            if (list.length) return list.map(c => convoRow(c)).join('') + discoverHTML;
            if (discoverHTML && inboxViewFilter === 'all') {
              return `
                <div class="bg-white px-5 pt-6 pb-4 flex flex-col items-center text-center">
                  <button type="button" onclick="openNewCollaboration()" class="neu-add-btn" aria-label="Create a collaboration"><span class="neu-add-plus"></span></button>
                  <div class="text-sm text-gray-400" style="max-width:280px;line-height:1.5;margin-top:12px;">Tap the plus to start your own, or join one below</div>
                </div>${discoverHTML}`;
            }
            if (inboxViewFilter === 'pinned') {
              return `<div class="inbox-empty bg-white p-8 text-center text-gray-400 text-sm">${emptyLabel('No collaborations yet.')}</div>`;
            }
            return `
              <div class="inbox-empty empty-center w-full bg-white px-8 text-center">
                <button type="button" onclick="openNewCollaboration()" class="neu-add-btn" aria-label="Create a collaboration"><span class="neu-add-plus"></span></button>
                <div class="text-base font-semibold text-gray-600" style="margin-top:20px;">No collaborations yet</div>
                <div class="text-sm text-gray-400" style="max-width:280px;line-height:1.5;margin-top:8px;">Tap on the plus to collaborate with your network</div>
              </div>`;
          }
          return `
            <div class="inbox-empty bg-white p-8 text-center text-gray-400 text-sm">${emptyLabel('No general messages.')}</div>`;
        }

        const convoMeta = {};

        function convoDisplayName(c){
          if (!c) return '';
          // Was `@${c.username}`
          return c.username || c.name || '';
        }

        function callDisplayName(c){
          if (!c) return '';
          return c.name || c.username || '';
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
              onmousedown="startPress('convoLongPressSelect','${escapeForJsAttr(id)}', event)" onmouseup="endPress()" onmouseleave="endPress()"
              ontouchstart="startPress('convoLongPressSelect','${escapeForJsAttr(id)}', event)" ontouchend="endPress()" ontouchmove="movePress(event)" ontouchcancel="endPress()"
              onclick="handleRowTap('convoTap','${escapeForJsAttr(id)}')">
              ${selectMode ? `<div class="w-5 h-5 rounded-full border-2 ${isSel ? `bg-[${ROYAL}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${isSel ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>` : ''}
              <div class="w-12 h-12 ${avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForConvo('${escapeForJsAttr(id)}')">${avatarInnerHTML(c,'w-6 h-6')}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-sm ${showUnread ? '' : 'text-gray-700'}">${escapeHtml(name)}</div>
                  ${c.pinned ? Icon('pin','w-3.5 h-3.5 text-amber-600') : ''}
                </div>
                <div class="text-xs ${showUnread ? 'text-gray-800 font-medium' : 'text-gray-500'} truncate">${escapeHtml(preview)}</div>
              </div>
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <div class="text-[11px] text-gray-400">${time}</div>
                ${showUnread ? unreadCountBadge(c.unreadCount) : ''}
              </div>
            </div>`;
        }

        // A plain dot only ever showed "something's unread", not how much
        function unreadCountBadge(count){
          const n = count || 1;
          const label = n > 99 ? '99+' : String(n);
          return `<div class="rounded-full bg-blue-500 text-white flex items-center justify-center flex-shrink-0" style="min-width:1.25rem;height:1.25rem;padding:0 0.35rem;font-size:10px;font-weight:700;line-height:1;">${label}</div>`;
        }

        // ---- Message requests (accept/reject) ----
        function requestRow(c){
          const { id, icon, avatarBg, name, preview, time, photo } = c;
          const avatarInner = avatarMediaHTML(photo, icon, 'w-6 h-6');
          return `
            <div class="flex items-center gap-5 px-5 py-4 bg-white">
              <div class="${avatarBg} rounded-full flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" style="width:52px;height:52px;" onclick="openPersonProfileForConvo('${escapeForJsAttr(id)}')">${avatarInner}</div>
              <div class="flex-1 min-w-0 cursor-pointer" onclick="openPersonProfileForConvo('${escapeForJsAttr(id)}')">
                <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(name)}</div>
                <div class="text-xs text-gray-500 mt-0.5 truncate">${escapeHtml(preview || 'Wants to connect with you')}</div>
                <div class="text-[11px] text-gray-400 mt-0.5">${time}</div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button onclick="event.stopPropagation(); rejectRequest('${escapeForJsAttr(id)}')" aria-label="Ignore" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white" style="border:1.5px solid #d1d5db;color:#6b7280;">${IconBold('close','w-4 h-4')}</button>
                <button onclick="event.stopPropagation(); acceptRequest('${escapeForJsAttr(id)}')" aria-label="Accept" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white" style="border:1.5px solid ${ROYAL};color:${ROYAL};">${IconBold('check','w-4 h-4')}</button>
              </div>
            </div>`;
        }

        // ---- Requests I've sent (pending, cancellable) ----
        function sentRequestRow(c){
          const { id, icon, avatarBg, name, preview, time, photo } = c;
          const avatarInner = avatarMediaHTML(photo, icon, 'w-6 h-6');
          return `
            <div class="flex items-center gap-5 px-5 py-4 bg-white">
              <div class="flex-shrink-0 rounded-full ${avatarBg} flex items-center justify-center text-gray-600 overflow-hidden cursor-pointer" style="width:52px;height:52px;" onclick="openPersonProfileForConvo('${escapeForJsAttr(id)}')">${avatarInner}</div>
              <div class="flex-1 min-w-0 cursor-pointer" onclick="openPersonProfileForConvo('${escapeForJsAttr(id)}')">
                <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(name)}</div>
                <div class="text-xs text-gray-500 mt-0.5 truncate">${escapeHtml(preview || 'Invitation sent')}</div>
                <div class="text-[11px] text-gray-400 mt-0.5">${time}</div>
              </div>
              <button onclick="event.stopPropagation(); confirmWithdrawSentRequest('${escapeForJsAttr(id)}','${escapeForJsAttr(name)}')" class="text-xs font-semibold px-4 py-1.5 rounded-full flex-shrink-0 bg-white" style="border:1.5px solid #d1d5db;color:#6b7280;">Pending</button>
            </div>`;
        }

        function confirmWithdrawSentRequest(id, name){
          openAppConfirmModal('Withdraw invitation?', `Your invitation to ${name} will be withdrawn.`, 'Withdraw', () => cancelSentRequest(id));
        }

        function cancelSentRequest(id){
          const idx = sentRequestConvos.findIndex(c => c.id === id);
          if (idx === -1) return;
          const [c] = sentRequestConvos.splice(idx, 1);
          renderInboxTab();
          if (typeof syncConnectNotif === 'function') syncConnectNotif({ requestId: c.connectionRequestId || c.id, otherUserId: c.otherUserId }, 'remove');
          if (typeof clearRequestSentLocally === 'function') clearRequestSentLocally(c.otherUserId);
          if (typeof cancelMyConnectionRequestTo !== 'function') { queueSaveUserState(); return; }
          // FIX: this used to remove the row and save state immediately, with no check on whether
          // the backend cancel actually succeeded
          cancelMyConnectionRequestTo(c.otherUserId).then(ok => {
            if (ok) { queueSaveUserState(); return; }
            sentRequestConvos.splice(idx, 0, c);
            const dp = (typeof discoverPeople !== 'undefined') ? discoverPeople.find(p => p.id === c.otherUserId) : null;
            if (dp) dp.requestSent = true;
            if (typeof viewedProfile !== 'undefined' && viewedProfile && viewedProfile.id === c.otherUserId) viewedProfile.requestSent = true;
            renderInboxTab();
          });
        }

        function acceptRequest(id){
          const idx = requestConvos.findIndex(c => c.id === id);
          if (idx === -1) return;
          const [c] = requestConvos.splice(idx, 1);
          if (typeof syncConnectNotif === 'function') syncConnectNotif({ requestId: c.connectionRequestId || c.id }, 'accepted');
          primaryConvos.unshift({ ...c, preview: c.preview || 'You are now connected', unread: true, read: false, unreadCount: 1, network: true, _localAt: Date.now() });
          queueSaveUserState();
          renderInboxTab();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
          if (cachedNetworkCount !== null) cachedNetworkCount += 1;
          if (currentTab === 4) renderProfile(); 
          if (typeof removeFromDiscover === 'function') removeFromDiscover(c.otherUserId); 
          setConnectionRequestStatus(c.connectionRequestId, 'accepted').then(() => {
            if (typeof refreshNetworkCount === 'function') refreshNetworkCount();
          });
        }
        function rejectRequest(id){
          const idx = requestConvos.findIndex(c => c.id === id);
          if (idx === -1) return;
          const [c] = requestConvos.splice(idx, 1);
          if (typeof syncConnectNotif === 'function') syncConnectNotif({ requestId: c.connectionRequestId || c.id }, 'declined');
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

        let connectionRequestsLoaded = false;
        // Requests that arrived while the sender's public profile was not saved yet show up as
        // "Stitch member"
        let healRequestNamesBusy = false;
        let lastHealRequestNamesAt = 0;
        async function healRequestSenderNames(){
          if (healRequestNamesBusy) return;
          // Names are refreshed for every request now, so don't hit the database on every 5s poll.
          if (Date.now() - lastHealRequestNamesAt < 30000) return;
          lastHealRequestNamesAt = Date.now();
          const stale = requestConvos.concat(sentRequestConvos).filter(c => c && c.otherUserId);
          if (!stale.length) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          healRequestNamesBusy = true;
          try {
            const { data: profiles } = await sb.from(PUBLIC_PROFILES_TABLE).select('*').in('user_id', Array.from(new Set(stale.map(c => c.otherUserId))));
            const byId = {};
            (profiles || []).forEach(p => { byId[p.user_id] = p; });
            let changed = false;
            stale.forEach(c => {
              const p = byId[c.otherUserId];
              const name = p && (p.name || p.username);
              if (!name) return;
              if (c.name === name && (!p.photo || c.photo === p.photo)) return;
              c.name = name;
              c.username = p.username || c.username || '';
              if (p.photo) c.photo = p.photo;
              if (convoMeta[c.id]) { convoMeta[c.id].name = c.name; convoMeta[c.id].username = c.username; if (c.photo) convoMeta[c.id].photo = c.photo; }
              if (typeof notifData !== 'undefined' && Array.isArray(notifData)) {
                notifData.forEach(n => { if (n && n.type === 'connect_request' && n.otherUserId === c.otherUserId) n.name = name; });
              }
              changed = true;
            });
            if (changed) { queueSaveUserState(); renderInboxTab(); }
          } catch (e) { console.warn('Refreshing request sender names failed:', e); }
          healRequestNamesBusy = false;
        }

        async function loadIncomingConnectionRequests(){
          try { await loadIncomingConnectionRequestsCore(); } finally {
            healRequestSenderNames();
            // The sender's profile can land a moment after their request does -- try again shortly.
            setTimeout(healRequestSenderNames, 3000);
            setTimeout(healRequestSenderNames, 9000);
          }
        }

        async function loadIncomingConnectionRequestsCore(){
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
            if (error) { connectionRequestsLoaded = true; return; }
            const rows = Array.isArray(reqRows) ? reqRows : [];

            const stillPendingIds = new Set(rows.map(r => r.id));
            let removedAny = false;
            for (let i = requestConvos.length - 1; i >= 0; i--) {
              const c = requestConvos[i];
              if (c.connectionRequestId && !stillPendingIds.has(c.connectionRequestId)) {
                requestConvos.splice(i, 1);
                if (typeof syncConnectNotif === 'function') syncConnectNotif({ requestId: c.connectionRequestId || c.id }, 'remove');
                else if (typeof deleteNotif === 'function') deleteNotif(c.id);
                removedAny = true;
              }
            }
            // Orphans: an unanswered request notification whose request is no longer pending (the
            // sender withdrew it) must not linger even if its Requests row is already gone
            if (typeof notifData !== 'undefined' && Array.isArray(notifData) && typeof syncConnectNotif === 'function') {
              notifData.filter(n => n && n.type === 'connect_request' && !n.connectionStatus && !stillPendingIds.has(n.connectionRequestId || n.id))
                .forEach(n => syncConnectNotif({ requestId: n.id }, 'remove'));
            }
            if (removedAny) { queueSaveUserState(); renderInboxTab(); }

            if (!rows.length) { connectionRequestsLoaded = true; return; }

            const knownIds = new Set(convoArrays().flat().map(c => c.connectionRequestId).filter(Boolean));
            const newRows = rows.filter(r => !knownIds.has(r.id));
            if (!newRows.length) { connectionRequestsLoaded = true; return; }

            // Guard against the same person showing up more than once in the Requests list
            const knownSenderIds = new Set(convoArrays().flat().filter(c => c.connectionRequestId).map(c => c.otherUserId));
            const latestRowBySender = {};
            newRows.forEach(r => {
              const existing = latestRowBySender[r.from_user];
              if (!existing || new Date(r.created_at) > new Date(existing.created_at)) latestRowBySender[r.from_user] = r;
            });
            const duplicateRowIds = [];
            const dedupedNewRows = [];
            newRows.forEach(r => {
              const isDuplicate = knownSenderIds.has(r.from_user) || latestRowBySender[r.from_user].id !== r.id;
              if (isDuplicate) duplicateRowIds.push(r.id);
              else dedupedNewRows.push(r);
            });
            if (duplicateRowIds.length) {
              sb.from(CONNECTION_REQUESTS_TABLE).update({ status: 'rejected' }).in('id', duplicateRowIds).then(() => {}).catch(() => {});
            }
            if (!dedupedNewRows.length) { connectionRequestsLoaded = true; return; }

            const senderIds = dedupedNewRows.map(r => r.from_user);
            const { data: senderProfiles } = await sb
              .from(PUBLIC_PROFILES_TABLE)
              .select('*')
              .in('user_id', senderIds);
            const profileById = {};
            (senderProfiles || []).forEach(p => { profileById[p.user_id] = p; });

            dedupedNewRows.forEach(row => {
              const senderProfile = profileById[row.from_user];
              const name = (senderProfile && (senderProfile.name || senderProfile.username)) || 'Stitch member';
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
            // Accounts are always private now, so incoming connection requests always sit here until
            // manually accepted (see acceptRequest)
          } catch (e) { console.warn('Loading incoming connection requests failed:', e); }
        }

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
                _localAt: Date.now(),
              };
              primaryConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: entry.preview, otherUserId: row.from_user };
              if (typeof removeFromDiscover === 'function') removeFromDiscover(row.from_user);
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

        let connectionUpdatesChannel = null;
        let connectionUpdatesSubscribedForUserId = null;
        async function subscribeToConnectionUpdates(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (connectionUpdatesChannel && connectionUpdatesSubscribedForUserId === myId) return;
          if (connectionUpdatesChannel) { try { sb.removeChannel(connectionUpdatesChannel); } catch (e) {  } connectionUpdatesChannel = null; }
          connectionUpdatesSubscribedForUserId = myId;
          const onConnectionChange = () => {
            Promise.all([
              loadIncomingConnectionRequests(),
              loadMyAcceptedIncomingRequests(),
              loadMyAcceptedOutgoingRequests(),
              loadMyPendingOutgoingRequests(),
            ]).then(() => reconcileNetworkWithServer()).then(() => {
              // Run after those settle so convoArrays/sentRequestConvos are already up to date when we
              // re-derive connected/requestSent for any open network list
              if (typeof syncNetworkConnectionStates === 'function') syncNetworkConnectionStates();
            }).catch(() => {});
            if (typeof refreshNetworkCount === 'function') refreshNetworkCount();
          };
          // Supabase can't filter DELETE events by column, so a removed connection never reached the
          // filtered listeners below
          const onConnectionDeleted = (payload) => {
            const oldRow = payload && payload.old;
            if (!oldRow) { onConnectionChange(); return; }
            if (oldRow.id === undefined) { onConnectionChange(); return; }
            const mine = convoArrays().flat().some(c => c.connectionRequestId === oldRow.id || c.id === oldRow.id);
            if (mine) onConnectionChange();
          };
          connectionUpdatesChannel = sb.channel('connections:' + myId)
            .on('postgres_changes', { event: '*', schema: 'public', table: CONNECTION_REQUESTS_TABLE, filter: `to_user=eq.${myId}` }, onConnectionChange)
            .on('postgres_changes', { event: '*', schema: 'public', table: CONNECTION_REQUESTS_TABLE, filter: `from_user=eq.${myId}` }, onConnectionChange)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: CONNECTION_REQUESTS_TABLE }, onConnectionDeleted)
            .subscribe();
          // Catch anything that changed while the app was closed / backgrounded / loading.
          reconcileNetworkWithServer().then(() => { if (typeof syncNetworkConnectionStates === 'function') syncNetworkConnectionStates(); });
        }
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reconcileNetworkWithServer().then(() => { if (typeof syncNetworkConnectionStates === 'function') syncNetworkConnectionStates(); });
          }
        });

        // ---- Connection-request polling fallback ----
        let connectionsPollInterval = null;
        function startConnectionsPolling(){
          if (connectionsPollInterval) return;
          // Realtime (connection_requests is in the publication) delivers changes instantly
          connectionsPollInterval = setInterval(() => {
            if (document.hidden) return;
            const sb = getSupabaseClient();
            if (!sb) return;
            Promise.all([
              loadIncomingConnectionRequests(),
              loadMyAcceptedIncomingRequests(),
              loadMyAcceptedOutgoingRequests(),
              loadMyPendingOutgoingRequests(),
            ]).then(() => reconcileNetworkWithServer()).then(() => {
              if (typeof syncNetworkConnectionStates === 'function') syncNetworkConnectionStates();
            }).catch(() => {});
            if (typeof refreshNetworkCount === 'function') refreshNetworkCount();
          }, 60000);
        }

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
                _localAt: Date.now(),
              };
              primaryConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: entry.preview, otherUserId: row.to_user };
              if (typeof removeFromDiscover === 'function') removeFromDiscover(row.to_user); 
              // The request is no longer pending
              if (typeof clearRequestSentLocally === 'function') clearRequestSentLocally(row.to_user);
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
            if (currentTab === 4) renderProfile(); 
          } catch (e) { console.warn('Loading accepted outgoing requests failed:', e); }
        }

        // Only one load at a time: the poll, the realtime push and the send flow can all trigger
        // this together, and overlapping runs each added the same request to the Sent list
        let pendingOutgoingLoadInFlight = null;
        function loadMyPendingOutgoingRequests(){
          if (pendingOutgoingLoadInFlight) return pendingOutgoingLoadInFlight;
          pendingOutgoingLoadInFlight = loadMyPendingOutgoingRequestsCore().finally(() => { pendingOutgoingLoadInFlight = null; });
          return pendingOutgoingLoadInFlight;
        }

        async function loadMyPendingOutgoingRequestsCore(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const { data: reqRows, error } = await sb
              .from(CONNECTION_REQUESTS_TABLE)
              .select('*')
              .eq('from_user', me.id)
              .eq('status', 'pending');
            if (error) return;
            const rows = Array.isArray(reqRows) ? reqRows : [];

            // Two pending rows to the same person (a double tap) -> keep the newest, retire the rest.
            const newestByRecipient = {};
            rows.forEach(r => {
              const cur = newestByRecipient[r.to_user];
              if (!cur || new Date(r.created_at) > new Date(cur.created_at)) newestByRecipient[r.to_user] = r;
            });
            const dupIds = rows.filter(r => newestByRecipient[r.to_user].id !== r.id).map(r => r.id);
            if (dupIds.length) {
              sb.from(CONNECTION_REQUESTS_TABLE).update({ status: 'rejected' }).in('id', dupIds).then(() => {}).catch(() => {});
              for (let i = rows.length - 1; i >= 0; i--) { if (dupIds.indexOf(rows[i].id) !== -1) rows.splice(i, 1); }
            }
            const stillPendingIds = new Set(rows.map(r => r.id));
            let removedAny = false;
            const removedAuthorIds = [];
            for (let i = sentRequestConvos.length - 1; i >= 0; i--) {
              const c = sentRequestConvos[i];
              if (!stillPendingIds.has(c.connectionRequestId)) {
                removedAuthorIds.push(c.otherUserId);
                sentRequestConvos.splice(i, 1);
                removedAny = true;
              }
            }
            if (removedAny) {
              queueSaveUserState();
              renderInboxTab();
              // A request that's no longer pending was either accepted or declined
              removedAuthorIds.forEach(uid => { if (typeof clearRequestSentLocally === 'function') clearRequestSentLocally(uid); });
            }

            if (!rows.length) return;

            const knownIds = new Set(sentRequestConvos.map(c => c.connectionRequestId));
            const newRows = rows.filter(r => !knownIds.has(r.id));
            if (!newRows.length) return;

            const recipientIds = newRows.map(r => r.to_user);
            const { data: recipientProfiles } = await sb
              .from(PUBLIC_PROFILES_TABLE)
              .select('*')
              .in('user_id', recipientIds);
            const profileById = {};
            (recipientProfiles || []).forEach(p => { profileById[p.user_id] = p; });

            newRows.forEach(row => {
              if (sentRequestConvos.some(c => c.connectionRequestId === row.id || c.otherUserId === row.to_user)) return;
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
                preview: row.message ? `You: "${row.message}"` : '',
                time: formatRequestTime(row.created_at),
              };
              sentRequestConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: 'Request sent', otherUserId: row.to_user };
            });
            queueSaveUserState();
            renderInboxTab();
          } catch (e) { console.warn('Loading pending outgoing requests failed:', e); }
        }

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

        const MESSAGES_TABLE = 'messages';

        // A group-event notice ("X added Y", "X left the group", etc.) is sent through the same
        // messages table as a normal chat message so it reaches every member's device (and reuses
        const SYS_MSG_PREFIX = '\u0000SYS\u0000';

        // Notifies every other current member of a group (excluding whoever is in
        // opts.excludeUserIds) that something changed
        function sendGroupSystemEvent(convoId, text, opts){
          opts = opts || {};
          const meta = convoMeta[convoId];
          if (!meta || meta.icon !== 'users') return;
          logCallEvent(convoId, text);
          const exclude = opts.excludeUserIds || new Set();
          const localId = 'sys_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          (meta.members || []).forEach(m => {
            if (!m.otherUserId || m.mine || exclude.has(m.otherUserId)) return;
            sendMessageRemote(convoId, m.otherUserId, SYS_MSG_PREFIX + text, null, null, [], localId);
          });
        }

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

        const CHAT_MEDIA_BUCKET = 'chat-media';

        // ---- Private chat media ----
        const CHAT_SIGNED_URL_TTL = 6 * 60 * 60;   // seconds
        const chatSignedUrlCache = {};              // "bucket/path" -> { url, exp }
        const chatSignFailedAt = {};                // "bucket/path" -> ms of last failure (30s backoff)
        const chatSignQueue = new Map();
        let chatSignTimer = null;
        const CHAT_MEDIA_URL_RE = /https?:\/\/[^"'\s<>)]*\/storage\/v1\/object\/(?:public|sign|authenticated)\/(?:chat-media|chat-voice-notes)\/[^"'\s<>)]*/g;

        function parseChatMediaUrl(url){
          const m = String(url || '').match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/(chat-media|chat-voice-notes)\/([^?#]+)/);
          if (!m) return null;
          let path = m[2];
          try { path = decodeURIComponent(path); } catch (e) {}
          return { bucket: m[1], path, key: m[1] + '/' + path };
        }

        function queueChatMediaSigning(p){
          if (chatSignQueue.has(p.key)) return;
          if (chatSignFailedAt[p.key] && Date.now() - chatSignFailedAt[p.key] < 30000) return;
          chatSignQueue.set(p.key, p);
          if (!chatSignTimer) chatSignTimer = setTimeout(flushChatMediaSigning, 30);
        }

        async function flushChatMediaSigning(){
          chatSignTimer = null;
          const items = Array.from(chatSignQueue.values());
          chatSignQueue.clear();
          const sb = getSupabaseClient();
          if (!sb || !items.length) return;
          const byBucket = {};
          items.forEach(p => { (byBucket[p.bucket] = byBucket[p.bucket] || []).push(p.path); });
          let gotAny = false;
          for (const bucket of Object.keys(byBucket)) {
            try {
              const { data, error } = await sb.storage.from(bucket).createSignedUrls(byBucket[bucket], CHAT_SIGNED_URL_TTL);
              if (error || !data) { byBucket[bucket].forEach(path => { chatSignFailedAt[bucket + '/' + path] = Date.now(); }); continue; }
              data.forEach(row => {
                const key = bucket + '/' + row.path;
                if (row.signedUrl) { chatSignedUrlCache[key] = { url: row.signedUrl, exp: Date.now() + CHAT_SIGNED_URL_TTL * 1000 }; gotAny = true; }
                else chatSignFailedAt[key] = Date.now();
              });
            } catch (e) { console.warn('Signing chat media failed:', e); byBucket[bucket].forEach(path => { chatSignFailedAt[bucket + '/' + path] = Date.now(); }); }
          }
          if (gotAny && typeof activeConvoId !== 'undefined' && activeConvoId) {
            const log = document.getElementById('convo-log');
            if (log) { const keep = log.scrollTop; log.innerHTML = convoLogHTML(); log.scrollTop = keep; }
          }
        }

        // Sync: returns a signed URL if we already have one, otherwise the original URL while a
        // signed one is fetched in the background (the chat log redraws when it arrives)
        function chatMediaSrc(url){
          const p = parseChatMediaUrl(url);
          if (!p) return url;
          const hit = chatSignedUrlCache[p.key];
          if (hit && hit.exp > Date.now() + 60000) return hit.url;
          queueChatMediaSigning(p);
          return url;
        }

        // Async: always resolves to a usable URL (used by download / viewer / open-in-new-tab).
        async function chatMediaResolve(url){
          const p = parseChatMediaUrl(url);
          if (!p) return url;
          const hit = chatSignedUrlCache[p.key];
          if (hit && hit.exp > Date.now() + 60000) return hit.url;
          const sb = getSupabaseClient();
          if (!sb) return url;
          try {
            const { data, error } = await sb.storage.from(p.bucket).createSignedUrl(p.path, CHAT_SIGNED_URL_TTL);
            if (error || !data || !data.signedUrl) return url;
            chatSignedUrlCache[p.key] = { url: data.signedUrl, exp: Date.now() + CHAT_SIGNED_URL_TTL * 1000 };
            return data.signedUrl;
          } catch (e) { return url; }
        }

        function chatMediaRewriteHtml(html){
          return String(html).replace(CHAT_MEDIA_URL_RE, u => chatMediaSrc(u));
        }

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

        function missingColumnFromError(error){
          if (!error) return null;
          const msg = error.message || '';
          const m = msg.match(/find the '([^']+)' column/i);
          return m ? m[1] : null;
        }

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
            const isSysEvent = text && text.startsWith(SYS_MSG_PREFIX);
            const meta = convoMeta[convoId];
            sendPushTo(otherUserId, isSysEvent ? {
              title: (meta && meta.name) || 'Group update',
              body: text.slice(SYS_MSG_PREFIX.length),
              tag: 'group-event-' + convoId,
              data: { kind: 'group_event', convoId },
            } : {
              title: (typeof profileData !== 'undefined' && profileData.name) || 'New message',
              body: text ? (text.length > 120 ? text.slice(0, 117) + '...' : text)
                : (attachments && attachments.length && (attachments[0].type === 'stitch/post' || attachments[0].type === 'stitch/challenge')) ? (typeof convoAttachmentPreviewText === 'function' ? convoAttachmentPreviewText(attachments) : 'Shared a post')
                : (attachments && attachments.length ? 'Sent a photo' : 'Sent a voice message'),
              tag: 'msg-' + convoId,
              data: { kind: 'message', convoId },
            });
            return (data && data.id) || null;
          } catch (e) { console.warn('Sending message threw an error:', e); return null; }
        }

        async function loadConversationHistory(convoId){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const myId = await getCurrentUserId();
            // A group message is stored as one row per recipient (so each person's own delivery/read
            // state is independent)
            const cols = 'id,sender_id,text,voice_url,voice_duration,attachments,read,local_id,created_at';
            let data, error;
            ({ data, error } = await sb.from(MESSAGES_TABLE)
              .select(cols)
              .eq('convo_id', convoId)
              .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
              .order('created_at', { ascending: true }));
            if (error && missingColumnFromError(error)) {
              console.warn('messages table is missing a selected column -- loading with select(*) instead. Run the migration comment above MESSAGES_TABLE to fix this permanently.');
              ({ data, error } = await sb.from(MESSAGES_TABLE)
                .select('*')
                .eq('convo_id', convoId)
                .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
                .order('created_at', { ascending: true }));
            }
            if (error || !data) return;
            const seenLocalIds = new Set();
            conversationMessages[convoId] = data
              .filter(r => !deletedForMeMessageIds.has(r.id))
              .map(r => {
                const raw = r.text || '';
                const isSys = raw.startsWith(SYS_MSG_PREFIX);
                return {
                  id: r.id,
                  localId: r.local_id || null,
                  from: isSys ? 'system' : (r.sender_id === myId ? 'me' : 'them'),
                  text: isSys ? raw.slice(SYS_MSG_PREFIX.length) : raw,
                  voice: r.voice_url ? sanitizeChatVoice({ src: r.voice_url, duration: r.voice_duration || 0 }) : undefined,
                  attachments: Array.isArray(r.attachments) ? sanitizeChatAttachments(r.attachments) : undefined,
                  read: !!r.read,
                  time: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
                  _mine: isSys || r.sender_id === myId,
                };
              })
              // My own message/attachment/system-event sent to a group is stored as one row per other
              // member
              .filter((m, idx, arr) => {
                if (!m._mine) return true;
                if (m.localId) {
                  if (seenLocalIds.has(m.localId)) return false;
                  seenLocalIds.add(m.localId);
                  return true;
                }
                return !arr.slice(0, idx).some(prev => prev._mine && !prev.localId && prev.text === m.text && Math.abs(prev.time - m.time) < 5000);
              })
              .map(({ _mine, ...rest }) => rest);
            // The chat now holds the server's full history: make sure this conversation's inbox row
            // shows the real last message instead of an older stored preview
            const loadedConvo = (typeof findConvoAndArray === 'function') ? findConvoAndArray(convoId) : null;
            if (loadedConvo && syncConvoPreviewFromMessages(loadedConvo.arr[loadedConvo.idx])) {
              const [moved] = loadedConvo.arr.splice(loadedConvo.idx, 1);
              if (!moved.pinned) loadedConvo.arr.unshift(moved); else loadedConvo.arr.splice(loadedConvo.idx, 0, moved);
              queueSaveUserState();
              if (typeof currentTab !== 'undefined' && currentTab === 3) renderInboxTab();
            }
          } catch (e) {  }
        }

        // ---- Local "read up to" watermark ----
        function readWmKey(uid){ return 'stitch_read_wm_' + uid; }
        function getReadWm(uid){
          try { return JSON.parse(localStorage.getItem(readWmKey(uid)) || '{}') || {}; } catch (e) { return {}; }
        }
        function bumpReadWm(uid, convoId, msgId){
          const n = Number(msgId);
          if (!uid || !convoId || !isFinite(n)) return;
          const wm = getReadWm(uid);
          if (wm[convoId] >= n) return;
          wm[convoId] = n;
          try { localStorage.setItem(readWmKey(uid), JSON.stringify(wm)); } catch (e) {}
        }
        async function markConvoSeenLocally(convoId){
          try {
            const myId = await getCurrentUserId();
            if (!myId) return;
            const msgs = conversationMessages[convoId] || [];
            let max = null;
            msgs.forEach(m => {
              if (!m || m.mine || m.id == null) return;
              const n = Number(m.id);
              if (isFinite(n) && (max === null || n > max)) max = n;
            });
            if (max !== null) bumpReadWm(myId, convoId, max);
          } catch (e) {}
        }

        async function markConvoMessagesRead(convoId, otherUserId){
          // recipient_id + convo_id is enough (works for DMs and groups), so a chat whose meta lost
          // its otherUserId still gets marked read
          return markGroupConvoMessagesRead(convoId);
        }

        // Marks every message sent to me in this conversation as read on the server.
        async function markGroupConvoMessagesRead(convoId){
          const sb = getSupabaseClient();
          const myId = await getCurrentUserId();
          if (!sb || !myId) return;
          await markConvoSeenLocally(convoId);
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const { error } = await sb.from(MESSAGES_TABLE).update({ read: true })
                .eq('convo_id', convoId)
                .eq('recipient_id', myId)
                .eq('read', false)
                .is('voice_url', null);
              if (!error) return;
            } catch (e) {  }
            await new Promise(r => setTimeout(r, 600));
          }
        }

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

        async function reconcileUnreadMessages(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          try {
            // Previously this only asked "is there ANY message ever sent to me in this convo that's
            // still read:false on the server?"
            const { data, error } = await sb.from(MESSAGES_TABLE)
              .select('id,convo_id,sender_id,recipient_id,read')
              .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
              .order('id', { ascending: false })
              .limit(1000);
            if (error) return;
            const wm = getReadWm(myId);
            const healConvos = new Set();
            const unreadConvoIds = new Set();
            const unreadCounts = {};   // convo_id -> exact number of unread messages received
            const decided = new Set();
            const counting = new Set();
            (data || []).forEach(row => {
              const fromThem = row.recipient_id === myId && row.sender_id !== myId;
              const seenLocally = wm[row.convo_id] != null && Number(row.id) <= wm[row.convo_id];
              if (fromThem && !row.read && seenLocally) { healConvos.add(row.convo_id); row = { ...row, read: true }; }
              if (!decided.has(row.convo_id)) {
                decided.add(row.convo_id);
                if (fromThem && !row.read) {
                  unreadConvoIds.add(row.convo_id);
                  counting.add(row.convo_id);
                  unreadCounts[row.convo_id] = 1;
                }
                // else: I sent the most recent message (or it's read) -- nothing unread.
              } else if (counting.has(row.convo_id)) {
                // Newest-first: keep counting the unbroken run of unread messages from them, stop at the
                // first message that's mine or already read
                if (fromThem && !row.read) unreadCounts[row.convo_id]++;
                else counting.delete(row.convo_id);
              }
            });
            let changed = false;
            convoArrays().flat().forEach(c => {
              const shouldBeUnread = unreadConvoIds.has(c.id) && activeConvoId !== c.id;
              if (shouldBeUnread) {
                const exact = unreadCounts[c.id] || 1;
                if (!c.unread || c.read || c.unreadCount !== exact) {
                  c.unread = true;
                  c.read = false;
                  c.unreadCount = exact;
                  changed = true;
                }
              } else if (!shouldBeUnread && c.unread) {
                // The locally-restored snapshot can lag behind the server
                c.unread = false;
                c.read = true;
                c.unreadCount = 0;
                changed = true;
              }
            });
            healConvos.forEach(id => { markGroupConvoMessagesRead(id); });
            if (typeof markNotifsReadForConvo === 'function') {
              convoArrays().flat().forEach(c => { if (!(c.unread && !c.read)) markNotifsReadForConvo(c.id); });
            }
            if (changed) {
              queueSaveUserState();
              if (typeof currentTab !== 'undefined' && currentTab === 3) renderInboxTab();
              if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
            }
          } catch (e) { console.warn('Reconciling unread messages failed:', e); }
        }

        // Re-syncs the inbox order against what actually happened on the server while this device
        // was signed out
        function convoAttachmentPreviewText(attachments, mine){
          const first = attachments && attachments[0];
          if (first && first.type === 'stitch/post') {
            if (first.tagged) {
              // Sender sees who they tagged; the person tagged sees who tagged them.
              if (mine) return first.taggedName ? `You tagged ${first.taggedName}` : 'You tagged them in a post';
              return first.authorName ? `${first.authorName} tagged you` : 'Tagged you in a post';
            }
            return first.caption ? `Shared a post: "${first.caption.slice(0,60)}"` : 'Shared a post';
          }
          if (first && first.type === 'stitch/challenge') return mine ? 'You sent a challenge invite' : (first.fromName ? `${first.fromName} challenged you` : 'Challenge invite');
          if (first && first.type && first.type.startsWith('image/')) return '📷 Photo';
          if (first && first.type && first.type.startsWith('video/')) return '🎥 Video';
          return first && first.name ? `📎 ${first.name}` : '📎 Attachment';
        }

        // The inbox row keeps its own copy of the last-message preview/time (c.preview / c.time)
        function convoMessagePreviewText(m){
          if (!m) return '';
          if (m.from === 'system') return m.text || '';
          if (m.voice) return '🎤 Voice message';
          if (Array.isArray(m.attachments) && m.attachments.length) return convoAttachmentPreviewText(m.attachments, m.from === 'me');
          return m.text || 'Attachment';
        }
        function syncConvoPreviewFromMessages(c){
          try {
            if (!c || !c.id) return false;
            const msgs = conversationMessages[c.id];
            if (!Array.isArray(msgs) || !msgs.length) return false;
            let last = null;
            for (let i = msgs.length - 1; i >= 0; i--) {
              const m = msgs[i];
              if (m && (m.text || m.voice || (Array.isArray(m.attachments) && m.attachments.length))) { last = m; break; }
            }
            if (!last || !last.time) return false;
            // Only when the message is clearly newer than what the row already reflects (a couple of
            // seconds of slack so a just-sent message doesn't fight its own local preview)
            if (last.time <= (c._lastMsgAt || 0) + 2000) return false;
            const text = convoMessagePreviewText(last);
            if (!text) return false;
            c.preview = text;
            c.time = formatRequestTime(last.time);
            c._lastMsgAt = last.time;
            if (convoMeta[c.id]) convoMeta[c.id].preview = text;
            return true;
          } catch (e) { return false; }
        }
        function syncAllConvoPreviewsFromMessages(){
          let changed = false;
          convoArrays().forEach(arr => {
            const stale = [];
            arr.forEach(c => { if (syncConvoPreviewFromMessages(c)) stale.push(c); });
            // A conversation with newer activity than its row shows belongs at the top, like every
            // other path that receives or sends a message does
            stale.forEach(c => {
              const idx = arr.indexOf(c);
              if (idx > 0 && !c.pinned) { arr.splice(idx, 1); arr.unshift(c); }
            });
            if (stale.length) changed = true;
          });
          if (changed && typeof queueSaveUserState === 'function') queueSaveUserState();
          return changed;
        }

        async function reconcileConvoOrder(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          try {
            const { data, error } = await sb.from(MESSAGES_TABLE)
              .select('convo_id,text,voice_url,attachments,created_at,sender_id')
              .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
              .order('created_at', { ascending: false })
              .limit(500);
            if (error || !data || !data.length) return;
            const latestByConvo = new Map();
            data.forEach(row => {
              if (!latestByConvo.has(row.convo_id)) latestByConvo.set(row.convo_id, row);
            });
            let changed = false;
            latestByConvo.forEach((row, convoId) => {
              const found = findConvoAndArray(convoId);
              if (!found) return;
              const c = found.arr[found.idx];
              const rowTime = row.created_at ? new Date(row.created_at).getTime() : 0;
              // Trust the server's own "latest row per convo" query as ground truth rather than gating
              // on a locally-cached _lastMsgAt marker
              if (!rowTime) return;
              const isSysEvent = (row.text || '').startsWith(SYS_MSG_PREFIX);
              const previewText = isSysEvent ? row.text.slice(SYS_MSG_PREFIX.length)
                : row.voice_url ? '🎤 Voice message'
                : (Array.isArray(row.attachments) && row.attachments.length) ? convoAttachmentPreviewText(row.attachments, row.sender_id && String(row.sender_id) === String(myId))
                : (row.text || 'Attachment');
              // Already in sync (same moment or slightly newer locally, same text): nothing to do.
              if (Math.abs(rowTime - (c._lastMsgAt || 0)) < 5000 && c.preview === previewText) return;
              // The row already reflects something newer than the server's latest (a message still being
              // delivered): don't roll it back
              if ((c._lastMsgAt || 0) > rowTime + 5000) return;
              c.preview = previewText;
              c.time = formatRequestTime(rowTime);
              c._lastMsgAt = rowTime;
              const [moved] = found.arr.splice(found.idx, 1);
              found.arr.unshift(moved);
              changed = true;
            });
            if (changed) {
              queueSaveUserState();
              if (typeof currentTab !== 'undefined' && currentTab === 3) renderInboxTab();
            }
          } catch (e) { console.warn('Reconciling conversation order failed:', e); }
        }

        let messagesChannel = null;
        let messagesSubscribedForUserId = null;
        async function subscribeToIncomingMessages(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (messagesChannel && messagesSubscribedForUserId === myId) return;
          if (messagesChannel) { try { sb.removeChannel(messagesChannel); } catch (e) {  } messagesChannel = null; }
          messagesSubscribedForUserId = myId;
          messagesChannel = sb.channel('messages:' + myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: MESSAGES_TABLE, filter: `recipient_id=eq.${myId}` }, (payload) => {
              handleIncomingMessage(payload.new);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: MESSAGES_TABLE, filter: `sender_id=eq.${myId}` }, (payload) => {
              handleMessageReadUpdate(payload.new);
            })
            // "Delete for everyone" can be triggered by either side of a conversation, so this user's
            // client needs to hear about a DELETE whether they were the sender or the recipient of the
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: MESSAGES_TABLE, filter: `recipient_id=eq.${myId}` }, (payload) => {
              handleIncomingMessageDelete(payload.old);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: MESSAGES_TABLE, filter: `sender_id=eq.${myId}` }, (payload) => {
              handleIncomingMessageDelete(payload.old);
            })
            .subscribe();
        }

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
          } catch (e) {  }
        }

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
          } catch (e) {  }
          // Realtime delivers messages instantly
          messagePollTimer = setInterval(() => { if (!document.hidden) pollForNewMessages(); }, 60000);
          document.addEventListener('visibilitychange', () => { if (!document.hidden) pollForNewMessages(); });
        }

        // ---- Realtime message/collab event handlers ----
        function handleIncomingMessageDelete(row){
          if (!row) return;
          const convoId = row.convo_id;
          if (convoId && conversationMessages[convoId]) {
            const msgs = conversationMessages[convoId];
            const idx = msgs.findIndex(m => (row.local_id && m.localId === row.local_id) || (row.id != null && m.id === row.id));
            if (idx !== -1) {
              msgs.splice(idx, 1);
              refreshConvoLogIfOpen(convoId);
              queueSaveUserState();
              return;
            }
          }
          // Realtime DELETE payloads only include the primary key unless the messages table has
          // REPLICA IDENTITY FULL, so convo_id can be missing here
          if (row.id == null) return;
          for (const cid in conversationMessages) {
            const msgs = conversationMessages[cid];
            const idx = msgs.findIndex(m => m.id === row.id);
            if (idx !== -1) {
              msgs.splice(idx, 1);
              refreshConvoLogIfOpen(cid);
              queueSaveUserState();
              return;
            }
          }
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

        function refreshConvoLogIfOpen(convoId){
          if (activeConvoId !== convoId) return;
          const log = document.getElementById('convo-log');
          if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
        }

        const COLLABORATIONS_TABLE = 'collaborations';
        const COLLAB_MEMBERS_TABLE = 'collaboration_members';

        async function collabCreateRemote(id, name, photo, memberContacts, description, visibility){
          const sb = getSupabaseClient();
          const myId = await getCurrentUserId();
          if (!sb || !myId) return false;
          try {
            let { error: cErr } = await sb.from(COLLABORATIONS_TABLE)
              .insert({ id, name, description: description || null, photo: photo || null, created_by: myId, members_can_add: false, visibility: visibility === 'general' ? 'general' : 'private' });
            if (cErr && missingColumnFromError(cErr) === 'description') {
              ({ error: cErr } = await sb.from(COLLABORATIONS_TABLE)
                .insert({ id, name, photo: photo || null, created_by: myId, members_can_add: false }));
            }
            if (cErr && missingColumnFromError(cErr) === 'members_can_add') {
              ({ error: cErr } = await sb.from(COLLABORATIONS_TABLE)
                .insert({ id, name, photo: photo || null, created_by: myId }));
            }
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
            const { error: mErr } = await sb.from(COLLAB_MEMBERS_TABLE).upsert(rows, { onConflict: 'collab_id,user_id', ignoreDuplicates: true });
            if (mErr) console.warn('Collaboration members did not sync to Supabase:', mErr);
            return true;
          } catch (e) { console.warn('Creating collaboration threw an error:', e); return false; }
        }

        async function collabAddMembersRemote(id, name, newContacts){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const rows = newContacts.filter(c => c.otherUserId).map(c => ({ collab_id: id, user_id: c.otherUserId, name: c.name, avatar_bg: c.avatarBg, icon: c.icon, photo: c.photo || null }));
            if (rows.length) {
              const { error } = await sb.from(COLLAB_MEMBERS_TABLE).upsert(rows, { onConflict: 'collab_id,user_id', ignoreDuplicates: true });
              if (error) {
                console.warn('Adding collaboration members did not sync:', error);
                if (/COLLAB_FULL/.test(error.message || '')) openAppAlertModal('This private collaboration is full (500 members maximum).');
                return false;
              }
            }
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

        async function collabUpdateNameRemote(id, name){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(COLLABORATIONS_TABLE).update({ name }).eq('id', id);
            if (error) { console.warn('Collaboration name did not sync:', error); return false; }
            return true;
          } catch (e) { return false; }
        }

        async function collabUpdateDescriptionRemote(id, description){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(COLLABORATIONS_TABLE).update({ description: description || null }).eq('id', id);
            if (error) {
              if (missingColumnFromError(error) === 'description') return false;
              console.warn('Collaboration description did not sync:', error);
              return false;
            }
            return true;
          } catch (e) { return false; }
        }

        // "members_can_add" is a boolean column on the collaborations table (default false)
        // controlling whether non-creator members are allowed to add new people
        async function collabUpdateMembersCanAddRemote(id, allowed){
          const sb = getSupabaseClient();
          if (!sb) return { ok: false, reason: 'offline' };
          try {
            const { error } = await sb.from(COLLABORATIONS_TABLE).update({ members_can_add: allowed }).eq('id', id);
            if (error) {
              const badCol = missingColumnFromError(error);
              console.warn('Collaboration "members can add" setting did not sync -- add a `members_can_add boolean default false` column to the collaborations table to enable this:', error);
              return { ok: false, reason: badCol ? 'missing_column' : 'error' };
            }
            return { ok: true };
          } catch (e) { return { ok: false, reason: 'offline' }; }
        }

        async function loadMyCollaborations(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const myId = await getCurrentUserId();
            if (!myId) return;
            const { data: myRows, error: myErr } = await sb.from(COLLAB_MEMBERS_TABLE).select('collab_id').eq('user_id', myId);
            if (myErr || !myRows || !myRows.length) return;
            const ids = [...new Set(myRows.map(r => r.collab_id))];
            const [{ data: collabs, error: collabsErr }, { data: allMembers }] = await Promise.all([
              (async () => {
                let res = await sb.from(COLLABORATIONS_TABLE).select('id,name,photo,created_by,members_can_add,description,visibility').in('id', ids);
                if (res.error) {
                  res = await sb.from(COLLABORATIONS_TABLE).select('id,name,photo,created_by,members_can_add').in('id', ids);
                }
                return res;
              })(),
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
                preview: (existing && existing.preview) || 'Collaboration', members, createdBy: row.created_by, membersCanAdd: !!row.members_can_add,
                description: row.description || (existing && existing.description) || '', visibility: row.visibility || 'private',
              };
              if (!collabConvos.some(c => c.id === id)) {
                collabConvos.unshift({ id, icon: 'users', avatarBg: 'bg-emerald-100', name: displayName, photo: row.photo || null, preview: 'You were added to this collaboration', time: formatRequestTime(Date.now()), unread: true, read: false, unreadCount: 1 });
                if (!conversationMessages[id]) conversationMessages[id] = [{ from: 'them', text: `You were added to "${displayName}".`, time: Date.now() }];
              } else {
                const entry = collabConvos.find(c => c.id === id);
                if (entry) { entry.name = displayName; entry.photo = row.photo || null; }
              }
            });
            const allMembersFlat = collabs.flatMap(row => (convoMeta[row.id] && convoMeta[row.id].members) || []);
            await refreshPhotosFromProfiles(allMembersFlat);
            queueSaveUserState();
          } catch (e) {  }
        }

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

        let collabMembersChannel = null;
        let collabMembersSubscribedForUserId = null;
        async function subscribeToCollabMembership(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (collabMembersChannel && collabMembersSubscribedForUserId === myId) return;
          if (collabMembersChannel) { try { sb.removeChannel(collabMembersChannel); } catch (e) {  } collabMembersChannel = null; }
          collabMembersSubscribedForUserId = myId;
          collabMembersChannel = sb.channel('collab-members:' + myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: COLLAB_MEMBERS_TABLE, filter: `user_id=eq.${myId}` }, async (payload) => {
              await loadMyCollaborations();
              if (currentTab === 3) renderInboxTab();
              if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
              const collabId = payload && payload.new && payload.new.collab_id;
              const meta = collabId && convoMeta[collabId];
              if (meta) {
                pushInAppNotification('New collaboration', `You were added to "${meta.name}".`);
                if (typeof addNotif === 'function') {
                  addNotif({
                    type: 'group',
                    source: 'messages',
                    icon: 'users',
                    iconBg: 'bg-emerald-50',
                    iconClass: 'text-emerald-600',
                    name: meta.name,
                    message: `You were added to "${meta.name}"`,
                    convoId: collabId,
                  });
                }
              }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: COLLAB_MEMBERS_TABLE, filter: `user_id=eq.${myId}` }, (payload) => {
              const collabId = payload && payload.old && payload.old.collab_id;
              const meta = collabId && convoMeta[collabId];
              const groupName = meta && meta.name;
              if (groupName && typeof addNotif === 'function') {
                addNotif({
                  type: 'group',
                  source: 'messages',
                  icon: 'users',
                  iconBg: 'bg-red-50',
                  iconClass: 'text-red-500',
                  name: groupName,
                  message: `You were removed from "${groupName}"`,
                });
              }
              applyRemoteCollabRemoval(collabId, 'Removed from collaboration', name => `You were removed from "${name}".`);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: COLLABORATIONS_TABLE }, (payload) => {
              const collabId = payload && payload.old && payload.old.id;
              applyRemoteCollabRemoval(collabId, 'Collaboration deleted', name => `"${name}" was deleted.`);
            })
            // Keeps name/photo/creator/permission changes live for every member
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: COLLABORATIONS_TABLE }, (payload) => {
              const row = payload && payload.new;
              const meta = row && convoMeta[row.id];
              if (!meta) return;
              if (row.name) meta.name = row.name;
              meta.photo = row.photo || null;
              meta.createdBy = row.created_by;
              meta.membersCanAdd = !!row.members_can_add;
              const entry = collabConvos.find(c => c.id === row.id);
              if (entry) { entry.name = meta.name; entry.photo = meta.photo; }
              queueSaveUserState();
              if (activeConvoId === row.id && collabMembersOverlayOpen) openCollabMembers();
              if (currentTab === 3) renderInboxTab();
            })
            // Unlike the two INSERT/DELETE listeners above (filtered to `user_id=eq.myId`, i.e. only
            // fire for *my own* membership changing), these aren't filtered
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: COLLAB_MEMBERS_TABLE }, (payload) => {
              const row = payload && payload.new;
              if (!row || row.user_id === myId) return;
              const meta = convoMeta[row.collab_id];
              if (!meta || meta.icon !== 'users') return;
              if ((meta.members || []).some(m => m.otherUserId === row.user_id)) return;
              meta.members = (meta.members || []).concat([{
                otherUserId: row.user_id, name: row.name, avatarBg: row.avatar_bg || 'bg-blue-100',
                icon: row.icon || 'user', photo: row.photo || null, mine: false,
              }]);
              queueSaveUserState();
              refreshConvoStatusLine(row.collab_id);
              if (activeConvoId === row.collab_id) {
                if (collabMembersOverlayOpen) openCollabMembers();
                else if (collabProfileOverlayOpen) renderConvoProfile();
              }
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: COLLAB_MEMBERS_TABLE }, (payload) => {
              const row = payload && payload.old;
              if (!row || row.user_id === myId) return;
              const meta = convoMeta[row.collab_id];
              if (!meta || meta.icon !== 'users') return;
              const before = (meta.members || []).length;
              meta.members = (meta.members || []).filter(m => m.otherUserId !== row.user_id);
              if (meta.members.length === before) return;
              queueSaveUserState();
              refreshConvoStatusLine(row.collab_id);
              if (activeConvoId === row.collab_id) {
                if (collabMembersOverlayOpen) openCollabMembers();
                else if (collabProfileOverlayOpen) renderConvoProfile();
              }
            })
            .subscribe();
        }

        let incomingCallChannel = null;
        let incomingCallSubscribedForUserId = null;
        let incomingCallInfo = null; 
        let incomingCallRingTimeout = null;

        let ringAudioCtx = null;
        let ringIntervalId = null;
        // ---- Call ringtone sound effects ----
        function getRingAudioCtx(){
          if (!ringAudioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) ringAudioCtx = new Ctx();
          }
          return ringAudioCtx;
        }
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
        // Each ring "burst" tries the device's own ringtone first (native system sound, or the
        // browser's Notification sound on the web app) and only falls back to the synthesized tone
        function playDeviceRingBurst(callerName){
          if (typeof soundMuted !== 'undefined' && soundMuted) return;
          if (typeof playDeviceNotificationSound === 'function') {
            playDeviceNotificationSound(callerName || 'Incoming call', 'is calling you\u2026', { channelId: 'calls', tag: 'incoming-call' }).then(played => {
              if (!played) playRingBurst();
            });
          } else {
            playRingBurst();
          }
        }
        function startIncomingCallRingtone(){
          stopIncomingCallRingtone();
          const callerName = (incomingCallInfo && incomingCallInfo.callerName) || 'Someone';
          playDeviceRingBurst(callerName);
          if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
          ringIntervalId = setInterval(() => {
            playDeviceRingBurst(callerName);
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
          if (incomingCallChannel) { try { sb.removeChannel(incomingCallChannel); } catch (e) {  } incomingCallChannel = null; }
          incomingCallSubscribedForUserId = myId;
          incomingCallChannel = sb.channel('incoming-calls:' + myId, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'ring' }, ({ payload }) => handleIncomingCallRing(payload))
            .on('broadcast', { event: 'response' }, ({ payload }) => handleCallResponse(payload))
            .on('broadcast', { event: 'cancel' }, ({ payload }) => handleCallCancel(payload))
            .subscribe();
        }

        // ---- Incoming call signaling (ring/accept/decline) ----
        function broadcastToUserChannel(userId, event, payload){
          const sb = getSupabaseClient();
          if (!sb || !userId) return;
          const ch = sb.channel('incoming-calls:' + userId, { config: { broadcast: { self: false } } });
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              ch.send({ type: 'broadcast', event, payload });
              setTimeout(() => { try { sb.removeChannel(ch); } catch (e) {  } }, 1000);
            }
          });
        }

        async function sendCallRing(convoId, type, otherUserId){
          const myId = await getCurrentUserId();
          if (!myId) return;
          const callerName = (typeof profileData !== 'undefined' && profileData.username) || (typeof profileData !== 'undefined' && profileData.name) || 'Someone';
          const meta = convoMeta[convoId];
          const isGroup = !!(meta && meta.icon === 'users');
          broadcastToUserChannel(otherUserId, 'ring', {
            convoId, type, fromUserId: myId,
            callerName,
            callerPhoto: (typeof profileData !== 'undefined' && profileData.photo) || null,
            groupName: isGroup ? meta.name : null,
          });
          sendPushTo(otherUserId, {
            title: isGroup ? `${callerName} is calling "${meta.name}"` : `${callerName} is calling you`,
            body: type === 'video' ? 'Incoming video call' : 'Incoming voice call',
            tag: 'call-' + convoId,
            data: { kind: 'call', convoId, type },
          });
        }

        function logCallEvent(convoId, text){
          if (!convoId) return;
          if (!conversationMessages[convoId]) conversationMessages[convoId] = [];
          conversationMessages[convoId].push({ from: 'system', text, time: Date.now() });
          queueSaveUserState();
          const found = findConvoAndArray(convoId);
          if (found) {
            const [c] = found.arr.splice(found.idx, 1);
            c.preview = text; c.time = formatRequestTime(Date.now());
            if (activeConvoId !== convoId) { c.unread = true; c.read = false; c.unreadCount = (c.unreadCount || 0) + 1; }
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
          if (typeof refreshInboxFilterBar === 'function') refreshInboxFilterBar();
        }

        function addMissedCallNotif(info){
          if (!info || !info.convoId) return;
          const callerName = info.callerName || 'Someone';
          const kind = info.type === 'video' ? 'video' : 'voice';
          addNotif({
            type: 'missed_call',
            icon: 'phone',
            iconBg: 'bg-red-50',
            iconClass: 'text-red-500',
            name: callerName,
            message: `Missed ${kind} call${info.groupName ? ` in "${info.groupName}"` : ''}`,
            otherUserId: info.fromUserId || null,
            convoId: info.convoId,
          });
        }

        async function sendCallResponse(convoId, toUserId, response){
          const myId = await getCurrentUserId();
          broadcastToUserChannel(toUserId, 'response', { convoId, response, fromUserId: myId });
        }

        async function sendCallCancel(convoId, toUserId){
          const myId = await getCurrentUserId();
          broadcastToUserChannel(toUserId, 'cancel', { convoId, fromUserId: myId });
        }

        // Interview video calls use a synthetic conversation id
        // ("interview-<jobId>-<applicantId>") that isn't in anyone's inbox
        function ensureInterviewConvoMeta(convoId, otherUserId, name, photo){
          if (!convoId) return;
          if (!convoMeta[convoId]) {
            convoMeta[convoId] = { id: convoId, otherUserId: otherUserId || null, icon: 'user', avatarBg: 'bg-blue-50', name: name || 'Interview', username: '', photo: photo || null, preview: '' };
          } else {
            if (otherUserId) convoMeta[convoId].otherUserId = otherUserId;
            if (name) convoMeta[convoId].name = name;
            if (photo) convoMeta[convoId].photo = photo;
          }
        }

        function handleIncomingCallRing(payload){
          if (!payload || !payload.convoId) return;
          if (String(payload.convoId).indexOf('interview-') === 0) {
            ensureInterviewConvoMeta(payload.convoId, payload.fromUserId, payload.callerName, payload.callerPhoto);
            // Already waiting in this same interview call -- the other side will connect on their own.
            if (callState.convoId === payload.convoId) return;
          }
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

        function handleCallResponse(payload){
          if (!payload || !callState.convoId || payload.convoId !== callState.convoId || callState.connected) return;
          if (payload.response === 'declined' || payload.response === 'busy' || payload.response === 'missed') {
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

        function handleCallCancel(payload){
          if (!payload || !incomingCallInfo || incomingCallInfo.convoId !== payload.convoId || incomingCallInfo.fromUserId !== payload.fromUserId) return;
          stopIncomingCallRingtone();
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          logCallEvent(payload.convoId, `Missed ${incomingCallInfo.type === 'video' ? 'video' : 'voice'} call`);
          addMissedCallNotif({ convoId: payload.convoId, type: incomingCallInfo.type, fromUserId: incomingCallInfo.fromUserId, callerName: incomingCallInfo.callerName, groupName: incomingCallInfo.groupName });
          incomingCallInfo = null;
          closeOverlay();
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

        const CALL_SCREEN_BG_IMAGE = 'data:image/jpeg;base64,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';

        function declineIncomingCall(isTimeout, fromPopState){
          stopIncomingCallRingtone();
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          if (!incomingCallInfo) { closeOverlay(fromPopState); return; }
          const { convoId, type, fromUserId, callerName, groupName } = incomingCallInfo;
          sendCallResponse(convoId, fromUserId, isTimeout ? 'missed' : 'declined');
          logCallEvent(convoId, isTimeout ? `Missed ${type === 'video' ? 'video' : 'voice'} call` : `${type === 'video' ? 'Video' : 'Voice'} call declined`);
          if (isTimeout) addMissedCallNotif({ convoId, type, fromUserId, callerName, groupName });
          incomingCallInfo = null;
          closeOverlay(fromPopState);
        }

        const CALL_REMINDER_DELAY_MS = 10 * 60 * 1000;
        function remindMeIncomingCall(){
          if (!incomingCallInfo) return;
          stopIncomingCallRingtone();
          clearTimeout(incomingCallRingTimeout); incomingCallRingTimeout = null;
          const info = incomingCallInfo;
          sendCallResponse(info.convoId, info.fromUserId, 'missed');
          logCallEvent(info.convoId, `Missed ${info.type === 'video' ? 'video' : 'voice'} call`);
          addMissedCallNotif({ convoId: info.convoId, type: info.type, fromUserId: info.fromUserId, callerName: info.callerName, groupName: info.groupName });
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
          return cuIncomingHTML({
            kicker: `Incoming ${isVideo ? 'video' : 'voice'} call`,
            name: info.callerName || 'Someone',
            sub: info.groupName ? `is calling in "${info.groupName}"\u2026` : 'is calling\u2026',
            avatar: avatarInnerHTML({ photo: info.callerPhoto, icon: 'user' }, 'w-16 h-16 text-gray-400'),
            declineAction: 'declineIncomingCall()',
            acceptAction: 'acceptIncomingCall()',
            acceptIcon: isVideo ? 'video' : 'phoneOutline',
            acceptLabel: 'Accept'
          });
        }

        // ---- Opening/reading a conversation thread ----
        function handleIncomingMessage(row){
          if (!row || !row.convo_id) return;
          const convoId = row.convo_id;
          if (!conversationMessages[convoId]) conversationMessages[convoId] = [];
          if (row.id != null && conversationMessages[convoId].some(m => m.id === row.id)) return;
          const rawText = row.text || '';
          const isSysEvent = rawText.startsWith(SYS_MSG_PREFIX);
          const isVoice = !isSysEvent && !!row.voice_url;
          const hasAttachments = !isSysEvent && Array.isArray(row.attachments) && row.attachments.length > 0;
          conversationMessages[convoId].push({
            id: row.id,
            from: isSysEvent ? 'system' : 'them',
            text: isSysEvent ? rawText.slice(SYS_MSG_PREFIX.length) : rawText,
            voice: isVoice ? sanitizeChatVoice({ src: row.voice_url, duration: row.voice_duration || 0 }) : undefined,
            attachments: hasAttachments ? sanitizeChatAttachments(row.attachments) : undefined,
            time: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          });
          queueSaveUserState();
          const previewText = isSysEvent ? rawText.slice(SYS_MSG_PREFIX.length) : (isVoice ? '🎤 Voice message' : hasAttachments ? convoAttachmentPreviewText(row.attachments) : (row.text || 'Attachment'));
          if (!isSysEvent && activeConvoId === convoId && row.sender_id) markConvoMessagesRead(convoId, row.sender_id);

          const found = findConvoAndArray(convoId);
          let c = null;
          if (found) {
            [c] = found.arr.splice(found.idx, 1);
            c.preview = previewText;
            c.time = formatRequestTime(Date.now());
            if (activeConvoId !== convoId) { c.unread = true; c.read = false; c.unreadCount = (c.unreadCount || 0) + 1; }
            found.arr.unshift(c);
          }

          if (activeConvoId === convoId) {
            const log = document.getElementById('convo-log');
            if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
          } else {
            if (typeof addNotif === 'function') {
              const meta = convoMeta[convoId] || {};
              const isGroup = meta.icon === 'users';
              const senderName = meta.name || (c && c.name) || 'someone';
              addNotif(isSysEvent ? {
                type: 'group',
                source: 'messages',
                icon: 'users',
                iconBg: 'bg-emerald-50',
                iconClass: 'text-emerald-600',
                name: senderName,
                message: previewText,
                convoId,
              } : {
                type: 'message',
                source: 'messages',
                icon: isGroup ? 'users' : 'comment',
                iconBg: 'bg-emerald-50',
                iconClass: 'text-emerald-600',
                name: senderName,
                message: isGroup ? `New message in "${senderName}"` : `New message from ${senderName}`,
                body: previewText,
                convoId,
                otherUserId: meta.otherUserId || (c && c.otherUserId),
              });
            }
          }
          if (convoMeta[convoId]) convoMeta[convoId].preview = previewText;
          const inboxList = document.getElementById('inbox-list');
          if (inboxList) inboxList.innerHTML = inboxContent();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
          if (typeof refreshInboxFilterBar === 'function') refreshInboxFilterBar();
        }

        let conversationMessages = {}; 
        let activeConvoId = null;
        // True when the currently-open conversation was opened from outside the Messaging tab
        let convoOpenedOutsideMessaging = false;

        function closeConversationOverlay(fromPopState){
          if (activeConvoId) { markGroupConvoMessagesRead(activeConvoId); saveUserStateNow(); }
          const openedOutside = convoOpenedOutsideMessaging;
          convoOpenedOutsideMessaging = false;
          // Always land on the Messaging tab for a chat opened from outside Messaging (e.g. tapping
          // "Message" on someone's Discover profile)
          if (openedOutside && typeof switchTab === 'function') { switchTab(3, true); return; }
          closeOverlay(fromPopState);
        }


        function openConversation(id){
          convoOpenedOutsideMessaging = currentTab !== 3;
          activeConvoId = id;
          if (!conversationMessages[id]) {
            conversationMessages[id] = [];
          }
          const found = findConvoAndArray(id);
          if (found && found.arr[found.idx].unread) {
            found.arr[found.idx].unread = false;
            found.arr[found.idx].read = true;
            found.arr[found.idx].unreadCount = 0;
            queueSaveUserState();
            saveUserStateNow();
          }
          if (typeof markNotifsReadForConvo === 'function') markNotifsReadForConvo(id);
          markGroupConvoMessagesRead(id);
          openOverlay('conversation');
          requestAnimationFrame(() => {
            const log = document.getElementById('convo-log');
            if (log) log.scrollTop = log.scrollHeight;
          });
          initConvoJumpToLatestButton();
          const inboxList = document.getElementById('inbox-list');
          if (inboxList) inboxList.innerHTML = inboxContent();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
          if (typeof refreshInboxFilterBar === 'function') refreshInboxFilterBar();

          const meta = convoMeta[id];
          const isGroupConvo = !!(meta && meta.icon === 'users');
          if (meta && (meta.otherUserId || isGroupConvo)) {
            // loadConversationHistory is keyed purely on convo_id, so it already works for group chats
            loadConversationHistory(id).then(() => {
              markGroupConvoMessagesRead(id);
              if (activeConvoId !== id) return;
              const log = document.getElementById('convo-log');
              if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
            });
            if (meta.otherUserId) refreshConvoAvatarFromProfile(id);
            joinConvoTypingChannel(id);
          }
        }

        function scrollConvoLogToBottom(){
          const log = document.getElementById('convo-log');
          if (!log) return;
          log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
        }

        function initConvoJumpToLatestButton(){
          const log = document.getElementById('convo-log');
          const btn = document.getElementById('convo-jump-latest-btn');
          if (!log || !btn) return;
          const NEAR_BOTTOM_PX = 80;
          const onScroll = () => {
            const distanceFromBottom = log.scrollHeight - log.scrollTop - log.clientHeight;
            btn.classList.toggle('hidden', distanceFromBottom <= NEAR_BOTTOM_PX);
          };
          log.addEventListener('scroll', onScroll, { passive: true });
          onScroll();
        }

        // ---- Conversation options menu (favorite/mute/block/delete) ----
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

        async function deleteConvoMessagesRemote(id){
          const sb = getSupabaseClient();
          if (!sb || !id) return false;
          try {
            // Only removes rows this user sent (DB policy); mirrors per-message delete.
            const { error } = await sb.from(MESSAGES_TABLE).delete().eq('convo_id', id);
            if (error) { console.warn('Deleting chat messages did not sync:', error); return false; }
            return true;
          } catch (e) { return false; }
        }

        function deleteConvoChat(){
          if (!activeConvoId) return;
          const id = activeConvoId;
          const meta = convoMeta[id];
          openAppConfirmModal(`Delete chat with ${meta ? meta.name : 'this contact'}?`, "This can't be undone.", 'Delete', function(){
            performDeleteConvoChat(id);
            deleteConvoMessagesRemote(id);
          });
        }

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
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="px-5 pb-3 flex items-center gap-4">
                <button onclick="openConvoProfile()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display truncate grad-text">Media, links and docs</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-5">
              ${section('Media', images, f => `
                <button onclick="openExternalUrl('${escapeHtml((f.url || f.dataUrl || '')).replace(/'/g,"\\'")}')" class="w-full flex items-center gap-3 py-3 text-left">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 text-[${NAVY}] flex items-center justify-center flex-shrink-0">${Icon('camera','w-5 h-5')}</div>
                  <div class="text-sm text-gray-700 truncate flex-1 min-w-0">${escapeHtml(f.name)}</div>
                  ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
                </button>`, `No photos or videos shared with ${escapeHtml(meta.name)} yet.`)}
              ${section('Docs', docs, f => `
                <button onclick="openExternalUrl('${escapeHtml((f.url || f.dataUrl || '')).replace(/'/g,"\\'")}')" class="w-full flex items-center gap-3 py-3 text-left">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 text-[${NAVY}] flex items-center justify-center flex-shrink-0">${Icon('file','w-5 h-5')}</div>
                  <div class="text-sm text-gray-700 truncate flex-1 min-w-0">${escapeHtml(f.name)}</div>
                  ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
                </button>`, `No documents shared with ${escapeHtml(meta.name)} yet.`)}
              ${section('Links', links, u => `
                <button onclick="openExternalUrl('${escapeHtml(u).replace(/'/g,"\\'")}')" class="w-full flex items-center gap-3 py-3 text-left">
                  <div class="w-10 h-10 rounded-xl bg-blue-50 text-[${NAVY}] flex items-center justify-center flex-shrink-0">${Icon('link','w-5 h-5')}</div>
                  <div class="text-sm text-gray-700 truncate flex-1 min-w-0">${u}</div>
                  ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
                </button>`, `No links shared with ${escapeHtml(meta.name)} yet.`)}
            </div>`;
        }

        // ---- Conversation profile screen (shared media, report) ----
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
          collabProfileOverlayOpen = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = convoProfileHTML();
        }

        function renderConvoProfile(){
          collabProfileOverlayOpen = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = convoProfileHTML();
        }

        function closeConvoProfile(){
          collabMembersOverlayOpen = false;
          collabProfileOverlayOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = conversationHTML();
          requestAnimationFrame(() => {
            const log = document.getElementById('convo-log');
            if (log) log.scrollTop = log.scrollHeight;
          });
          initConvoJumpToLatestButton();
        }

        function convoProfileHTML(){
          const meta = convoMeta[activeConvoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Conversation' };
          const isGroup = meta.icon === 'users';
          const blocked = isConvoBlocked(meta);
          const favorited = isConvoFavorite(activeConvoId);
          const notifOn = isConvoNotifEnabled(activeConvoId);
          const { images, docs, links } = collectConvoMedia(activeConvoId);
          const mediaCount = images.length + docs.length + links.length;
          const sharedCollabs = isGroup ? [] : collabConvos;
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
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
                <div id="convo-profile-status" class="text-sm text-gray-400 mt-0.5">${convoLastSeenText(meta)}</div>
                ${isGroup ? `
                  <button onclick="editCollabDescription()" class="flex items-center gap-1.5 max-w-full mt-2" title="Edit description">
                    <div class="text-sm text-gray-500 truncate">${meta.description ? escapeHtml(meta.description) : 'Add a description'}</div>
                    ${Icon('edit','w-3.5 h-3.5 text-gray-400 flex-shrink-0')}
                  </button>
                ` : ''}
              </div>

              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm mb-6">
                ${isGroup ? convoProfileRow('users','bg-emerald-50','text-emerald-600','Members', (meta.members || []).length + ' people', 'openCollabMembers()') : ''}
                ${isGroup ? convoProfileRow('send','bg-blue-50',`text-[${NAVY}]`,'Share invite link', 'Anyone with the link can ask to join', 'shareCollabInviteLink()') : ''}
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

        let reportedConvos = new Set();
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
          initConvoJumpToLatestButton();
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
          initConvoJumpToLatestButton();
        }

        function convoLastSeenText(meta){
          // Someone typing/recording is more useful than the static member list, so it takes
          // priority even in a collaboration
          if (activeConvoId && recordingByConvo[activeConvoId]) return 'recording audio...';
          if (activeConvoId && typingByConvo[activeConvoId]) return 'typing...';
          if (meta.icon === 'users') {
            const names = orderedCollabMemberNames(meta.members);
            return names.length ? names.join(', ') : 'Group';
          }
          if (meta.otherUserId && isUserOnline(meta.otherUserId)) return 'Online';
          return formatLastActiveText(meta.lastActive);
        }

        // Puts "You" first, then everyone else in their existing order
        function orderedCollabMemberNames(members){
          const list = (members || []).filter(Boolean);
          const mine = list.filter(m => m.mine).map(() => 'You');
          const others = list.filter(m => !m.mine).map(m => m.name).filter(Boolean);
          return mine.concat(others);
        }

        function orderedCollabMembers(members){
          const list = (members || []).filter(Boolean);
          const mine = list.filter(m => m.mine);
          const others = list.filter(m => !m.mine);
          return mine.concat(others);
        }

        function formatLastActiveText(lastActive){
          if (!lastActive) return 'last seen recently';
          const then = new Date(lastActive);
          const thenMs = then.getTime();
          if (!thenMs || Number.isNaN(thenMs)) return 'last seen recently';
          const now = new Date();
          const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
          const diffDays = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);
          const timeStr = then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          if (diffDays <= 0) return `last seen today at ${timeStr}`;
          if (diffDays === 1) return `last seen yesterday at ${timeStr}`;
          if (diffDays < 7) return `last seen ${then.toLocaleDateString(undefined, { weekday: 'long' })} at ${timeStr}`;
          return `last seen ${then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric' })} at ${timeStr}`;
        }

        function conversationHTML(){
          const meta = convoMeta[activeConvoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Conversation' };
          const blocked = isConvoBlocked(meta);
          const reported = isConvoReported(activeConvoId);
          return `
            <div class="px-5 flex items-center gap-3 flex-shrink-0 border-b border-gray-100" style="padding-top:var(--top-safe-pad);padding-bottom:calc(0.75rem + 5px);">
              <button onclick="closeConversationOverlay()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <div id="chat-header-avatar" class="w-10 h-10 ${meta.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="openPersonProfileForConvo('${activeConvoId}')">${avatarInnerHTML(meta,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0 cursor-pointer" onclick="openPersonProfileForConvo('${activeConvoId}')">
                <div id="chat-header-name" class="font-semibold text-sm font-display truncate grad-text">${escapeHtml(convoDisplayName(meta))}</div>
                <div id="chat-header-status" class="text-xs text-gray-400 truncate">${convoLastSeenText(meta)}</div>
              </div>
              <div class="flex items-center gap-0.5 flex-shrink-0" style="position:relative;">
                <button onclick="startCall('${activeConvoId}','video')" title="Video call" class="p-1">${gradIcon(Icon('video','w-5 h-5'))}</button>
                <button onclick="startCall('${activeConvoId}','audio')" title="Voice call" class="p-1">${gradIcon(Icon('phoneOutline','w-4 h-4'))}</button>
                <button onclick="toggleConvoOptionsMenu()" title="Chat settings" class="p-1">${gradIcon(IconBold('dots','w-5 h-5'))}</button>

              </div>
            </div>
            <div id="convo-options-menu-backdrop" class="hidden convo-sheet-scrim" onclick="closeConvoOptionsMenuThen()" style="position:fixed;inset:0;z-index:25;"></div>
            <div id="convo-options-menu" class="hidden bg-white convo-sheet" style="position:fixed;left:0;right:0;bottom:0;z-index:30;">
                  <div class="convo-sheet-grabber"></div>
                  <button onclick="closeConvoOptionsMenuThen(() => openConvoProfile())" class="w-full flex items-center gap-3 text-left px-5 py-4 text-[15px] font-medium text-gray-800 border-b border-gray-100">${Icon('user','w-4 h-4')} View profile</button>
                  <button onclick="${reported ? '' : `closeConvoOptionsMenuThen(() => reportConvo())`}" ${reported ? 'disabled' : ''} class="w-full flex items-center gap-3 text-left px-5 py-4 text-[15px] font-medium border-b border-gray-100 ${reported ? 'text-gray-400' : 'text-gray-800'}">${Icon('flag','w-4 h-4')} ${reported ? 'Reported' : 'Report'}</button>
                  <button onclick="closeConvoOptionsMenuThen(() => clearConvoChat())" class="w-full flex items-center gap-3 text-left px-5 py-4 text-[15px] font-medium text-gray-800 border-b border-gray-100">${Icon('trash','w-4 h-4')} Clear chat</button>
                  <button onclick="closeConvoOptionsMenuThen(() => toggleBlockConvoContact())" class="w-full flex items-center gap-3 text-left px-5 py-4 text-[15px] font-medium text-red-500">${Icon('block','w-4 h-4')} ${blocked ? 'Unblock' : 'Block'}</button>
                </div>
            <div id="convo-log-wrap" class="flex-1 relative" style="min-height:0;">
              <div id="convo-log" class="overflow-y-auto p-5 flex flex-col gap-3" style="height:100%;">
                ${convoLogHTML()}
              </div>
              <button id="convo-jump-latest-btn" onclick="scrollConvoLogToBottom()" title="Jump to latest" class="hidden convo-jump-btn flex items-center justify-center" style="position:absolute;right:16px;bottom:14px;z-index:5;width:36px;height:36px;border-radius:9999px;">${Icon('chevronDown','w-4 h-4')}</button>
            </div>
            <div id="convo-attach-strip" class="flex-shrink-0">${convoAttachStripHTML()}</div>
            <div id="convo-composer-wrap" class="flex-shrink-0 px-3 pt-2 convo-composer-anim" style="padding-bottom:20px;">
              <input type="file" id="convo-file-input" accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" multiple class="hidden" onchange="handleConvoFileSelect(event)">
              <div class="flex items-center gap-2 rounded-3xl px-2 py-1.5 convo-composer-pill">
                <button onclick="document.getElementById('convo-file-input').click()" title="Attach a file" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 convo-composer-icon-btn">${Icon('clip','w-4 h-4')}</button>
                <textarea id="convo-input" placeholder="Message" rows="1" enterkeyhint="enter" oninput="autoGrowConvoInput(this); notifyConvoTyping();" onfocus="handleConvoInputFocus()" onblur="handleConvoInputBlur()" class="flex-1 min-w-0 bg-transparent text-sm resize-none leading-snug self-center convo-composer-textarea" style="max-height:120px;overflow-y:auto;"></textarea>
                <button onclick="toggleConvoVoiceNote()" id="convo-mic-btn" title="Record a voice note" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 convo-composer-icon-btn">${Icon('mic','w-4 h-4')}</button>
                <button onclick="handleConvoSendTap()" class="w-8 h-8 text-white rounded-full flex items-center justify-center flex-shrink-0" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
              </div>
            </div>`;
        }

        let pendingConvoAttachments = [];

        // ---- Conversation view: attachments (files/voice notes) ----
        function convoFileIcon(type){
          if (type && type.startsWith('image/')) return 'camera';
          if (type && type.startsWith('video/')) return 'video';
          return 'file';
        }

        function convoAttachStripHTML(){
          if (!pendingConvoAttachments.length) return '';
          return `
            <div class="px-4 pt-3 flex gap-2 flex-wrap">
              ${pendingConvoAttachments.map((f,i) => {
                const isImg = f.type && f.type.startsWith('image/');
                if (isImg && f.dataUrl) {
                  return `
                    <div class="relative flex-shrink-0" style="width:52px;height:52px;">
                      <img src="${escapeHtml(safeChatUrl(String(f.dataUrl || '')))}" class="w-full h-full object-cover rounded-xl">
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

        let convoRecorder = null;
        let convoRecordedChunks = [];
        let convoRecordStream = null;
        let convoRecording = false;
        let convoRecordStartTs = 0;
        let convoRecordTimerInterval = null;

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
          sendRecordingBroadcast(true);
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
          sendRecordingBroadcast(false);
          if (convoRecordTimerInterval) { clearInterval(convoRecordTimerInterval); convoRecordTimerInterval = null; }
        }

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
          const localId = 'lm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          const message = { from: 'me', voice: { src: dataUrl, duration: durationSecs }, time: Date.now(), read: false, localId };
          conversationMessages[activeConvoId].push(message);
          const log = document.getElementById('convo-log');
          if (log) { log.innerHTML = convoLogHTML(); log.scrollTop = log.scrollHeight; }
          queueSaveUserState();
          const convoIdAtSend = activeConvoId;
          updateConvoPreview(convoIdAtSend, '🎤 Voice message');

          const meta = convoMeta[convoIdAtSend];
          if (!blob) return;
          const isGroupConvo = !!(meta && meta.icon === 'users' && Array.isArray(meta.members));
          if (!meta || (!meta.otherUserId && !isGroupConvo)) return;

          uploadConvoVoiceToStorage(blob, convoIdAtSend).then(url => {
            if (!url) {
              console.warn('Voice note stayed local-only (upload failed) -- other members will not receive it.');
              flashConvoMicMessage('Voice note not sent (upload failed)');
              return;
            }
            if (meta.otherUserId) {
              sendMessageRemote(convoIdAtSend, meta.otherUserId, '', url, durationSecs, [], localId).then(id => {
                if (id) { message.id = id; refreshConvoLogIfOpen(convoIdAtSend); }
              });
              return;
            }
            // Group/collaboration voice notes need the same per-member fan-out as text messages
            const recipients = meta.members.filter(m => !m.mine && m.otherUserId);
            Promise.all(recipients.map(m => sendMessageRemote(convoIdAtSend, m.otherUserId, '', url, durationSecs, [], localId))).then(results => {
              const firstId = results.find(id => id);
              if (firstId) { message.id = firstId; refreshConvoLogIfOpen(convoIdAtSend); }
              const failedCount = results.filter(id => !id).length;
              if (failedCount > 0) {
                pushInAppNotification(
                  'Voice note may not have sent',
                  failedCount === recipients.length
                    ? "This voice note didn't sync to anyone else in the collaboration. Check your connection and try again."
                    : `This voice note didn't reach ${failedCount} of ${recipients.length} member${recipients.length === 1 ? '' : 's'}.`
                );
              }
            });
          });
        }

        // ---- Conversation log rendering (bubbles, timestamps) ----
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

        function formatConvoBubbleTime(ts){
          return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        }

        function convoLogHTML(){ return chatMediaRewriteHtml(convoLogHTMLInner()); }
        function convoLogHTMLInner(){
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
            const sharedPosts = (m.attachments || []).filter(f => f.type === 'stitch/post');
            const sharedChallenges = (m.attachments || []).filter(f => f.type === 'stitch/challenge');
            const images = (m.attachments || []).filter(f => f.type && f.type.startsWith('image/') && (f.dataUrl || f.url));
            const videos = (m.attachments || []).filter(f => f.type && f.type.startsWith('video/') && (f.url || f.file));
            const files = (m.attachments || []).filter(f => !images.includes(f) && !videos.includes(f) && !sharedPosts.includes(f) && !sharedChallenges.includes(f));
            const hasBubbleContent = !!m.text || files.length > 0;
            const mine = m.from === 'me';
            const voiceHTML = m.voice ? convoVoiceNoteHTML(m.voice, mine, m) : '';
            const bubbleHTML = hasBubbleContent ? (
              mine
                ? `<div class="text-white px-4 py-2.5 text-sm" style="background:linear-gradient(135deg, rgba(65,105,225,0.55), rgba(65,105,225,0.35)); border-radius:20px 20px 0 20px;">${convoFileAttachmentsHTML(files, mine)}${escapeHtml(m.text)}</div>`
                : `<div class="bg-gray-100 px-4 py-2.5 text-sm text-gray-700" style="border-radius:20px 20px 20px 0;">${convoFileAttachmentsHTML(files, mine)}${escapeHtml(m.text)}</div>`
            ) : '';
            const sharedPostsHTML = convoSharedPostAttachmentsHTML(sharedPosts, mine) + convoSharedChallengeAttachmentsHTML(sharedChallenges, mine);
            const imagesHTML = convoImageAttachmentsHTML(images);
            const videosHTML = convoVideoAttachmentsHTML(videos);
            const footer = mine
              ? `<div class="flex items-center gap-1 mt-1 px-1">
                   <span class="text-[10px] text-gray-400">${timeLabel}</span>
                   ${convoReadTicksHTML(m)}
                 </div>`
              : `<div class="text-[10px] text-gray-400 mt-1 px-1">${timeLabel}</div>`;
            // Voice notes need an actual (not shrink-wrapped) width to expand into, or width:100% on
            // the bubble has nothing to fill against
            const contentWidthStyle = m.voice ? 'width:75%;' : 'max-width:75%;';
            const content = `
              <div class="flex flex-col ${mine ? 'items-end' : 'items-start'} gap-1" style="${contentWidthStyle}">
                ${sharedPostsHTML}
                ${imagesHTML}
                ${videosHTML}
                ${voiceHTML}
                ${bubbleHTML}
                ${footer}
              </div>`;
            const pressKey = `${activeConvoId}|${ts}`;
            const pressHandlers = `onmousedown="startPress('messageLongPress','${pressKey}', event)" onmouseup="endPress()" onmouseleave="endPress()" ontouchstart="startPress('messageLongPress','${pressKey}', event)" ontouchend="endPress()" ontouchmove="movePress(event)" ontouchcancel="endPress()"`;
            const menuBtn = `<button type="button" onclick="event.stopPropagation();toggleDesktopMessageMenu('${pressKey}', event)" class="desktop-msg-menu-btn w-7 h-7 rounded-full items-center justify-center text-gray-400 hover:bg-gray-100 flex-shrink-0" style="align-self:center;" title="Message options" aria-label="Message options">${Icon('dots','w-4 h-4')}</button>`;
            const bubble = m.from === 'them' ? `
            <div class="flex items-start gap-3" ${pressHandlers}>
              <div class="w-8 h-8 ${meta.avatarBg} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForConvo('${activeConvoId}')">${avatarInnerHTML(meta,'w-4 h-4')}</div>
              ${content}
              ${menuBtn}
            </div>` : `
            <div class="flex items-start justify-end gap-3" ${pressHandlers}>
              ${menuBtn}
              ${content}
            </div>`;
            return separator + bubble;
          }).join('');
        }

        let messageActionConvoId = null;
        let messageActionTime = null;

        // ---- Message long-press actions (delete for me/everyone) ----
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
          closeDesktopMessageMenu();
          messageActionConvoId = null;
          messageActionTime = null;
        }

        function messageActionSheetHTML(){
          // "Delete for everyone" only makes sense (and is only ever allowed by the DB's delete
          // policy) for a message the current user actually sent
          const msgs = (messageActionConvoId && conversationMessages[messageActionConvoId]) || [];
          const msg = msgs.find(m => m.time === messageActionTime);
          const canDeleteForEveryone = canDeleteMessageForEveryone(msg);
          const canCopy = !!(msg && msg.text);
          return `
            <div class="fixed inset-0 flex items-end justify-center" style="background:rgba(0,0,0,0.35);z-index:60;" onclick="closeMessageActionSheet()">
              <div class="bg-white w-full rounded-t-3xl overflow-hidden" style="max-width:480px;padding-bottom:env(safe-area-inset-bottom, 0px);" onclick="event.stopPropagation()">
                <div class="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-2.5 mb-1"></div>
                ${canCopy ? `<button onclick="copyActionMessage()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-gray-800 border-b border-gray-100">Copy</button>` : ''}
                <button onclick="openForwardMessagePicker()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-gray-800 border-b border-gray-100">Forward</button>
                <button onclick="deleteActionMessageForMe()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-gray-800 border-b border-gray-100">Delete for me</button>
                ${canDeleteForEveryone ? `<button onclick="deleteActionMessageForEveryone()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-red-500 border-b border-gray-100">Delete for everyone</button>` : ''}
                <button onclick="closeMessageActionSheet()" class="w-full text-left px-5 py-4 text-[15px] font-medium text-gray-500">Cancel</button>
              </div>
            </div>`;
        }

        // ---- Desktop message-options dropdown ("..." button) ----
        function closeDesktopMessageMenu(){
          const menu = document.getElementById('desktop-message-menu');
          if (menu) menu.remove();
        }

        function toggleDesktopMessageMenu(key, evt){
          const alreadyOpenForThisKey = document.getElementById('desktop-message-menu') && messageActionConvoId === key.slice(0, key.lastIndexOf('|')) && messageActionTime === Number(key.slice(key.lastIndexOf('|') + 1));
          closeDesktopMessageMenu();
          if (alreadyOpenForThisKey) { messageActionConvoId = null; messageActionTime = null; return; }

          const sep = key.lastIndexOf('|');
          if (sep === -1) return;
          messageActionConvoId = key.slice(0, sep);
          messageActionTime = Number(key.slice(sep + 1));

          const msgs = (messageActionConvoId && conversationMessages[messageActionConvoId]) || [];
          const msg = msgs.find(m => m.time === messageActionTime);
          const canDeleteForEveryone = canDeleteMessageForEveryone(msg);
          const canCopy = !!(msg && msg.text);

          const btn = evt.currentTarget;
          const rect = btn.getBoundingClientRect();
          const menuWidth = 190;
          const menuHeightEstimate = (canDeleteForEveryone ? 100 : 60) + (canCopy ? 40 : 0) + 40;
          const dropUp = (window.innerHeight - rect.bottom) < (menuHeightEstimate + 12);
          const top = dropUp ? (rect.top - menuHeightEstimate - 6) : (rect.bottom + 6);
          const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);

          const menu = document.createElement('div');
          menu.id = 'desktop-message-menu';
          menu.innerHTML = `
            <div class="fixed inset-0" style="z-index:59;" onclick="closeMessageActionSheet()"></div>
            <div class="fixed bg-white rounded-2xl border border-gray-100 py-2 menu-dropdown-inset" style="z-index:60;top:${Math.max(8, top)}px;left:${left}px;width:${menuWidth}px;box-shadow:0 10px 30px rgba(0,0,0,.14);" onclick="event.stopPropagation()">
              ${canCopy ? `<button onclick="copyActionMessage()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 menu-item-pill">Copy</button>` : ''}
              <button onclick="openForwardMessagePicker()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 menu-item-pill">Forward</button>
              <button onclick="deleteActionMessageForMe()" class="w-full text-left px-4 py-2.5 text-sm text-gray-700 menu-item-pill">Delete for me</button>
              ${canDeleteForEveryone ? `<button onclick="deleteActionMessageForEveryone()" class="w-full text-left px-4 py-2.5 text-sm text-red-500 menu-item-pill">Delete for everyone</button>` : ''}
            </div>`;
          document.body.appendChild(menu);
        }

        // "Delete for everyone" is only offered for your own messages (including shared posts)
        // sent within the last 2 days
        const DELETE_FOR_EVERYONE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
        function canDeleteMessageForEveryone(msg){
          if (!msg || msg.from !== 'me') return false;
          const sentAt = Number(msg.time);
          if (!sentAt) return true;
          return (Date.now() - sentAt) <= DELETE_FOR_EVERYONE_WINDOW_MS;
        }

        function copyActionMessage(){
          const convoId = messageActionConvoId;
          const time = messageActionTime;
          const msgs = (convoId && conversationMessages[convoId]) || [];
          const msg = msgs.find(m => m.time === time);
          const text = (msg && msg.text) || '';
          closeMessageActionSheet();
          if (!text) return;
          const done = () => { if (typeof pushInAppNotification === 'function') pushInAppNotification('Copied', 'Message copied to your clipboard.'); };
          const fallback = () => {
            try {
              const ta = document.createElement('textarea');
              ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
              document.body.appendChild(ta); ta.select();
              document.execCommand('copy'); ta.remove(); done();
            } catch (e) {}
          };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback);
          else fallback();
        }

        function deleteActionMessageForMe(){
          const convoId = messageActionConvoId;
          const time = messageActionTime;
          closeMessageActionSheet();
          if (!convoId || time == null) return;
          const msgs = conversationMessages[convoId] || [];
          const idx = msgs.findIndex(m => m.time === time);
          if (idx === -1) return;
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
          // Only the sender of a message is allowed to delete it for everyone
          if (!canDeleteMessageForEveryone(msgs[idx])) return;
          const [removed] = msgs.splice(idx, 1);
          refreshConvoLogIfOpen(convoId);
          queueSaveUserState();
          if (removed) {
            const sb = getSupabaseClient();
            if (sb) {
              const query = removed.localId
                ? sb.from(MESSAGES_TABLE).delete().eq('convo_id', convoId).eq('local_id', removed.localId)
                : (removed.id != null ? sb.from(MESSAGES_TABLE).delete().eq('id', removed.id) : null);
              if (query) {
                query.then(({ error, count }) => {
                  if (error) {
                    console.warn('Deleting message for everyone failed:', error);
                    // The remote delete didn't go through (RLS rejection, network error, etc.)
                    msgs.splice(idx, 0, removed);
                    refreshConvoLogIfOpen(convoId);
                    queueSaveUserState();
                    if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't delete this message for everyone. Please try again.");
                  }
                });
              }
            }
          }
        }

        // ---- Forward message to another contact/collaboration ----
        let forwardMessageSource = null;

        function openForwardMessagePicker(){
          if (!messageActionConvoId || messageActionTime == null) { closeMessageActionSheet(); return; }
          forwardMessageSource = { convoId: messageActionConvoId, time: messageActionTime };
          closeMessageActionSheet();
          openOverlay('forwardMessage');
        }

        function closeForwardMessagePicker(){
          forwardMessageSource = null;
          closeOverlay();
        }

        // Anyone you can already message -- your contacts and collaborations, not pending requests
        function forwardMessageTargets(){
          return [...primaryConvos, ...collabConvos];
        }

        function forwardMessagePreviewText(msg){
          if (!msg) return '';
          if (msg.text) return escapeHtml(msg.text.length > 80 ? msg.text.slice(0, 80) + '...' : msg.text);
          if (msg.voice) return '🎤 Voice message';
          if (msg.attachments && msg.attachments.length) {
            const a = msg.attachments[0];
            return a.type && a.type.startsWith('image/') ? '📷 Photo' : `📎 ${escapeHtml(a.name || 'Attachment')}`;
          }
          return 'Message';
        }

        function forwardMessageHTML(){
          const src = forwardMessageSource;
          const msgs = (src && conversationMessages[src.convoId]) || [];
          const msg = msgs.find(m => m.time === src.time);
          const targets = forwardMessageTargets();
          return `
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center gap-4">
                <button onclick="closeForwardMessagePicker()" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-lg font-display truncate grad-text">Forward message</div>
                  ${msg ? `<div class="text-xs text-gray-400 truncate">${escapeHtml(forwardMessagePreviewText(msg))}</div>` : ''}
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-4 pb-1">Send to</div>
              <div class="divide-y divide-gray-100 pb-6">
                ${targets.length ? targets.map(c => `
                  <button onclick="forwardMessageTo('${c.id}')" class="w-full flex items-center gap-3 py-3 text-left">
                    <div class="w-11 h-11 rounded-full ${c.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(c,'w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[15px] text-gray-900 truncate">${escapeHtml(c.name)}</div>
                    </div>
                  </button>`).join('') : `<div class="py-8 text-center text-gray-400 text-sm">No contacts to forward to yet.</div>`}
              </div>
            </div>`;
        }

        async function forwardMessageTo(targetConvoId){
          const src = forwardMessageSource;
          forwardMessageSource = null;
          if (!src) { closeOverlay(); return; }
          const msgs = conversationMessages[src.convoId] || [];
          const msg = msgs.find(m => m.time === src.time);
          closeOverlay();
          if (!msg || !conversationMessages[targetConvoId]) return;

          const text = msg.text || '';
          const attachments = Array.isArray(msg.attachments)
            ? msg.attachments.map(a => ({ name: a.name, type: a.type, url: a.url, dataUrl: a.dataUrl }))
            : [];
          // A voice note's local echo can still be sitting on a "data:" URI while it's uploading
          const voice = (msg.voice && msg.voice.src && !String(msg.voice.src).startsWith('data:')) ? msg.voice : null;
          if (!text && !attachments.length && !voice) {
            openAppAlertModal("This message can't be forwarded yet -- please try again in a moment.");
            return;
          }

          const localId = 'lm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          const newMessage = { from: 'me', text, attachments, voice: voice || undefined, time: Date.now(), read: false, localId };
          conversationMessages[targetConvoId].push(newMessage);
          queueSaveUserState();
          refreshConvoLogIfOpen(targetConvoId);
          const plainPreview = text ? text : (voice ? '🎤 Voice message' : (attachments.length ? (attachments[0].type && attachments[0].type.startsWith('image/') ? '📷 Photo' : `📎 ${attachments[0].name || 'Attachment'}`) : 'Message'));
          updateConvoPreview(targetConvoId, plainPreview);
          renderInboxTab();

          const meta = convoMeta[targetConvoId];
          if (meta && meta.otherUserId) {
            const id = await sendMessageRemote(targetConvoId, meta.otherUserId, text, voice ? voice.src : null, voice ? voice.duration : null, attachments, localId);
            if (id) { newMessage.id = id; refreshConvoLogIfOpen(targetConvoId); }
          } else if (meta && meta.icon === 'users' && Array.isArray(meta.members)) {
            const recipients = meta.members.filter(m => !m.mine && m.otherUserId);
            const results = await Promise.all(recipients.map(m =>
              sendMessageRemote(targetConvoId, m.otherUserId, text, voice ? voice.src : null, voice ? voice.duration : null, attachments, localId)
            ));
            const failedCount = results.filter(id => !id).length;
            if (failedCount > 0) {
              pushInAppNotification(
                'Message may not have sent',
                failedCount === recipients.length
                  ? "This message didn't sync to anyone else in the collaboration. Check your connection and try again."
                  : `This message didn't reach ${failedCount} of ${recipients.length} member${recipients.length === 1 ? '' : 's'}.`
              );
            }
          }
        }

        // ---- Media attachment rendering in bubbles ----
        function voiceNoteSeed(str){
          let h = 0;
          for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
          return h % 1000;
        }

        function voiceWaveBarsHTML(seed, count, barColor){
          let bars = '';
          for (let i = 0; i < count; i++){
            const n = Math.abs(Math.sin(seed + i * 12.9898) * 43758.5453);
            const frac = n - Math.floor(n);
            const h = 5 + Math.round(frac * 13); // 5-18px tall
            // flex:1 (not a fixed px width) so the bars stretch to fill however much space the wave
            // column ends up with
            bars += `<div style="flex:1;min-width:1.5px;height:${h}px;border-radius:2px;background:${barColor};"></div>`;
          }
          return bars;
        }

        function convoVoiceNoteHTML(voice, mine, m){
          const uid = 'voice-' + Math.random().toString(36).slice(2, 9);
          // Sent notes echo the outgoing text-bubble treatment
          const bubbleBg = mine ? 'linear-gradient(135deg, rgba(65,105,225,0.55), rgba(65,105,225,0.35))' : '#f3f4f6';
          const subColor = mine ? 'rgba(255,255,255,0.8)' : '#6b7280';
          const waveBg = mine ? 'rgba(255,255,255,0.4)' : '#d1d5db';
          const waveFg = mine ? '#ffffff' : NAVY;
          const playBtnBg = mine ? 'rgba(255,255,255,0.22)' : '#ffffff';
          const playBtnColor = mine ? '#ffffff' : NAVY;
          const markPlayedCall = (!mine && m && m.id != null) ? `markVoiceMessageAsPlayed('${activeConvoId}','${m.id}');` : '';

          const barCount = 24;
          const seed = voiceNoteSeed(voice.src || uid);
          const bgBars = voiceWaveBarsHTML(seed, barCount, waveBg);
          const fgBars = voiceWaveBarsHTML(seed, barCount, waveFg);

          // Explicit options button: a custom player still needs its own long-press affordance.
          const pressKey = (m && m.time != null) ? `${activeConvoId}|${m.time}` : '';
          const optionsBtn = pressKey ? `<button type="button" onclick="event.stopPropagation(); messageLongPress('${pressKey}')" class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style="color:${subColor};" aria-label="Message options">${Icon('dots','w-3.5 h-3.5')}</button>` : '';

          // width:100%
          return `
            <div class="flex items-center gap-2 rounded-2xl px-3 py-2" id="voicewrap-${uid}" style="background:${bubbleBg};width:100%;">
              <button type="button" onclick="event.stopPropagation(); toggleVoiceNotePlayback('${uid}')" id="playbtn-${uid}" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:${playBtnBg};color:${playBtnColor};" aria-label="Play voice note">${Icon('play','w-3.5 h-3.5 ml-0.5')}</button>
              <div class="relative flex-1 min-w-0" style="height:20px;cursor:pointer;" onclick="event.stopPropagation(); seekVoiceNote(event, '${uid}')">
                <div class="absolute inset-0 flex items-center gap-[2px]">${bgBars}</div>
                <div id="wavefg-${uid}" class="absolute inset-0 flex items-center gap-[2px]" style="clip-path:inset(0 100% 0 0);">${fgBars}</div>
              </div>
              <span id="dur-${uid}" class="text-[11px] flex-shrink-0" style="color:${subColor};">${formatCallTime(voice.duration)}</span>
              <audio id="${uid}" class="convo-voice-audio" preload="none" src="${escapeHtml(voice.src)}" style="display:none;"
                onplay="onVoiceNotePlay('${uid}'); ${markPlayedCall}"
                onpause="onVoiceNotePause('${uid}')"
                onended="onVoiceNoteEnded('${uid}')"
                ontimeupdate="onVoiceNoteTimeUpdate('${uid}', ${voice.duration || 0})"
                onerror="voiceNoteLoadError('${uid}')"
              ></audio>
              ${optionsBtn}
            </div>`;
        }

        function toggleVoiceNotePlayback(uid){
          const audio = document.getElementById(uid);
          if (!audio) return;
          if (audio.paused){
            document.querySelectorAll('audio.convo-voice-audio').forEach(a => { if (a.id !== uid && !a.paused) a.pause(); });
            audio.play().catch(()=>{});
          } else {
            audio.pause();
          }
        }

        function onVoiceNotePlay(uid){
          const btn = document.getElementById('playbtn-' + uid);
          if (btn) btn.innerHTML = Icon('pause', 'w-3.5 h-3.5');
        }

        function onVoiceNotePause(uid){
          const btn = document.getElementById('playbtn-' + uid);
          if (btn) btn.innerHTML = Icon('play', 'w-3.5 h-3.5 ml-0.5');
        }

        function onVoiceNoteEnded(uid){
          onVoiceNotePause(uid);
          const fg = document.getElementById('wavefg-' + uid);
          if (fg) fg.style.clipPath = 'inset(0 100% 0 0)';
          const audio = document.getElementById(uid);
          const durEl = document.getElementById('dur-' + uid);
          if (durEl) durEl.textContent = formatCallTime(audio && isFinite(audio.duration) ? audio.duration : 0);
        }

        function onVoiceNoteTimeUpdate(uid, fallbackDuration){
          const audio = document.getElementById(uid);
          if (!audio) return;
          const dur = (audio.duration && isFinite(audio.duration) && audio.duration > 0) ? audio.duration : fallbackDuration;
          const fg = document.getElementById('wavefg-' + uid);
          if (fg && dur > 0) {
            const pct = Math.min(100, (audio.currentTime / dur) * 100);
            fg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`; // reveal the played bars from the left, whatever width the wave column happens to be
          }
          const durEl = document.getElementById('dur-' + uid);
          if (durEl) durEl.textContent = formatCallTime(Math.max(0, dur - audio.currentTime)); // formatCallTime floors internally, so this always reads whole seconds
        }

        function seekVoiceNote(evt, uid){
          const audio = document.getElementById(uid);
          if (!audio) return;
          const rect = evt.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (evt.clientX - rect.left) / rect.width));
          const dur = (audio.duration && isFinite(audio.duration)) ? audio.duration : 0;
          if (dur > 0) audio.currentTime = ratio * dur;
        }

        function voiceNoteLoadError(uid){
          const wrap = document.getElementById('voicewrap-' + uid);
          if (wrap) wrap.innerHTML = '<span class="text-xs italic text-gray-400">Couldn\'t load voice note</span>';
        }

        // A shared post's caption now travels with it in one tappable card (thumbnail + author +
        // caption) instead of a bare text line, so the recipient can go straight to the post
        // Tappable challenge invite card: opens the challenge straight away for the friend
        function convoSharedChallengeAttachmentsHTML(items, mine){
          if (!items || !items.length) return '';
          return `
            <div class="flex flex-col gap-1.5">
              ${items.map(ch => `
                <button type="button" onclick="openChallengeFromChat('${escapeHtml(ch.code)}')" class="block text-left overflow-hidden" style="max-width:240px;width:100%;border-radius:16px;background:linear-gradient(135deg,${NAVY},${ROYAL});color:#fff;padding:12px 14px;">
                  <div class="text-[11px] font-semibold" style="opacity:.8;">${mine ? 'You invited them to a challenge' : (ch.fromName ? escapeHtml(ch.fromName) + ' challenged you' : 'Challenge invite')}</div>
                  <div class="font-display" style="font-size:1.15rem;font-weight:800;letter-spacing:.08em;margin-top:2px;">${escapeHtml(ch.code)}</div>
                  <div class="text-[11px]" style="opacity:.8;margin-top:2px;">${ch.timePerQ ? (ch.timePerQ === 'No limit' ? 'No time limit' : escapeHtml(ch.timePerQ) + ' per question') : 'Head-to-head'}</div>
                  <div class="text-[11px] font-semibold" style="margin-top:8px;background:rgba(255,255,255,.18);border-radius:999px;padding:6px 12px;text-align:center;">${mine ? 'Waiting for your friend' : 'Tap to join'}</div>
                </button>`).join('')}
            </div>`;
        }

        function convoSharedPostAttachmentsHTML(items, mine){
          if (!items || !items.length) return '';
          return `
            <div class="flex flex-col gap-1.5">
              ${items.map(sp => `
                <button type="button" onclick="openSharedPostFromChat(${escapeHtml(JSON.stringify(sp.postId))})" class="block text-left overflow-hidden bg-white" style="max-width:230px;width:100%;border-radius:16px;border:1px solid rgba(0,0,0,0.08);">
                  ${sp.thumbnail ? `<img src="${escapeHtml(sp.thumbnail)}" alt="" style="width:100%;height:140px;object-fit:cover;display:block;">` : ''}
                  <div style="padding:8px 12px 10px;">
                    <div class="text-[11px] font-semibold" style="color:${ROYAL};">${sp.tagged ? (mine ? `You tagged &ldquo;${escapeHtml(sp.taggedName || 'them')}&rdquo;` : `${escapeHtml(sp.authorName || 'Stitch member')} tagged you`) : `${escapeHtml(sp.authorName || 'Stitch member')}'s post`}</div>
                    ${sp.caption ? `<div class="text-[11px] text-gray-700 mt-0.5" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(sp.caption)}</div>` : ''}
                    <div class="text-[10.5px] text-gray-400 mt-1">Tap to view post</div>
                  </div>
                </button>`).join('')}
            </div>`;
        }

        function convoImageAttachmentsHTML(images){
          if (!images || !images.length) return '';
          return `
            <div class="flex flex-col gap-1.5">
              ${images.map(f => {
                const src = f.url || f.dataUrl;
                const name = f.name || 'photo.jpg';
                return `<div class="relative" style="max-width:220px;width:100%;">
                  <img src="${escapeHtml(src)}" alt="${escapeHtml(name)}" onclick="openConvoImageViewer('${encUriArg(src)}')" class="cursor-pointer" style="max-width:220px;max-height:280px;width:100%;border-radius:16px;object-fit:cover;display:block;">
                  <button type="button" onclick="event.stopPropagation();convoDownloadDocument('${encUriArg(src)}','${encUriArg(name)}')" aria-label="Download photo" class="convo-media-action-btn" style="top:8px;right:8px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></button>
                </div>`;
              }).join('')}
            </div>`;
        }

        // Per-URL download state so re-renders (new messages arriving, etc.) don't reset an in-
        // progress download back to its idle icon
        const CONVO_DOC_STATE_STORAGE_KEY = 'stitchConvoDocDownloadState';
        let convoDocDownloadState = {};
        try {
          const savedDocState = JSON.parse(localStorage.getItem(CONVO_DOC_STATE_STORAGE_KEY) || '{}');
          Object.keys(savedDocState).forEach(url => {
            if (savedDocState[url] && savedDocState[url].status === 'done') convoDocDownloadState[url] = { status: 'done', progress: 1 };
          });
        } catch (e) {  }
        function persistConvoDocDownloadState(){
          try {
            const done = {};
            Object.keys(convoDocDownloadState).forEach(url => {
              if (convoDocDownloadState[url] && convoDocDownloadState[url].status === 'done') done[url] = { status: 'done' };
            });
            localStorage.setItem(CONVO_DOC_STATE_STORAGE_KEY, JSON.stringify(done));
          } catch (e) {  }
        }

        // Once a document has actually been fetched, keep the Blob around in memory so tapping the
        // chip again just opens/saves it straight away instead of hitting the network and re-
        let convoDocBlobCache = {};

        // Persistent cache of downloaded documents' actual bytes (not just the "done" status), so
        // reopening one doesn't need a fresh network fetch
        const CONVO_DOC_BLOB_DB_NAME = 'stitch-doc-blobs';
        let _docBlobDBPromise = null;
        function openConvoDocBlobDB(){
          if (!window.indexedDB) return Promise.resolve(null);
          if (!_docBlobDBPromise) {
            _docBlobDBPromise = new Promise((resolve) => {
              try {
                const req = indexedDB.open(CONVO_DOC_BLOB_DB_NAME, 1);
                req.onupgradeneeded = () => { req.result.createObjectStore('blobs'); };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
              } catch (e) { resolve(null); }
            });
          }
          return _docBlobDBPromise;
        }
        async function saveConvoDocBlobToDB(url, blob){
          try {
            const db = await openConvoDocBlobDB();
            if (!db) return;
            await new Promise((resolve) => {
              const tx = db.transaction('blobs', 'readwrite');
              tx.objectStore('blobs').put(blob, url);
              tx.oncomplete = resolve;
              tx.onerror = () => resolve();
            });
          } catch (e) {  }
        }
        async function loadConvoDocBlobFromDB(url){
          try {
            const db = await openConvoDocBlobDB();
            if (!db) return null;
            return await new Promise((resolve) => {
              const tx = db.transaction('blobs', 'readonly');
              const req = tx.objectStore('blobs').get(url);
              req.onsuccess = () => resolve(req.result || null);
              req.onerror = () => resolve(null);
            });
          } catch (e) { return null; }
        }

        function convoDocChipId(url){
          let h = 0;
          for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
          return 'convoDoc' + Math.abs(h);
        }

        // A round badge for the state icon, tinted to blend with whichever bubble it sits in
        // (translucent white on a colored "mine" bubble, a soft royal tint on a plain received
        // one) instead of a bright, disconnected solid-royal circle
        function convoDocIconHTML(state, mine){
          const badge = (inner, tint) => `<div class="w-full h-full rounded-full flex items-center justify-center" style="background:${tint.bg};color:${tint.fg};">${inner}</div>`;
          const soft = mine ? { bg: 'rgba(255,255,255,0.22)', fg: '#fff' } : { bg: 'rgba(30,144,255,0.12)', fg: ROYAL };
          const softError = mine ? { bg: 'rgba(255,255,255,0.22)', fg: '#fff' } : { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444' };
          if (state && (state.status === 'downloading' || state.status === 'opening')) {
            // Spins in place until the download/open resolves
            return badge(`<span class="inline-flex" style="animation:classroom-spin 0.9s linear infinite;">${Icon('download','w-3.5 h-3.5')}</span>`, soft);
          }
          if (state && state.status === 'done') return badge(Icon('file','w-3.5 h-3.5'), soft);
          if (state && state.status === 'error') return badge(Icon('close','w-3.5 h-3.5'), softError);
          return badge(Icon('download','w-3.5 h-3.5'), soft);
        }

        function convoDocCaptionText(url, state){
          if (state && state.status === 'downloading') return 'Downloading…';
          if (state && state.status === 'opening') return 'Opening…';
          if (state && state.status === 'error') return 'Failed, tap to retry';
          // Already downloaded earlier
          if (state && state.status === 'done') return 'Tap to open';
          return '';
        }

        function convoUpdateDocChipDOM(url){
          const id = convoDocChipId(url);
          const state = convoDocDownloadState[url] || { status: 'idle' };
          const iconEl = document.getElementById(id + '-icon');
          const capEl = document.getElementById(id + '-caption');
          if (iconEl) iconEl.innerHTML = convoDocIconHTML(state, iconEl.dataset.mine === '1');
          if (capEl) capEl.textContent = convoDocCaptionText(url, state);
        }

        function convoFileAttachmentsHTML(files, mine){
          if (!files || !files.length) return '';
          return `
            <div class="flex flex-col gap-1.5 mb-1.5">
              ${files.map(f => {
                if (!f.url) {
                  const softUploading = mine ? { bg: 'rgba(255,255,255,0.22)', fg: '#fff' } : { bg: 'rgba(30,144,255,0.12)', fg: ROYAL };
                  return `
                    <div class="flex items-center gap-2.5 ${mine ? 'bg-white/15' : 'bg-black/5'} rounded-xl px-2.5 py-1.5">
                      <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:${softUploading.bg};color:${softUploading.fg};">${Icon(convoFileIcon(f.type),'w-3.5 h-3.5')}</div><span class="text-xs truncate">${escapeHtml(f.name)}</span>
                    </div>`;
                }
                const id = convoDocChipId(f.url);
                const state = convoDocDownloadState[f.url] || { status: 'idle' };
                // The circle is now the only download control (tap it to fetch/open the raw file);
                // the filename/caption area opens Stitch's own in-app viewer for previewable types.
                return `
                  <div class="flex items-center gap-2 ${mine ? 'bg-white/15' : 'bg-black/5'} rounded-xl px-2.5 py-1.5">
                    <button type="button" id="${id}-icon" data-mine="${mine ? '1' : '0'}" onclick="event.stopPropagation(); convoDownloadDocument('${encUriArg(f.url)}','${encUriArg(f.name || '')}')" class="w-10 h-10 flex items-center justify-center flex-shrink-0" aria-label="Download">${convoDocIconHTML(state, mine)}</button>
                    <button type="button" id="${id}" onclick="openConvoDocViewer('${encUriArg(f.url)}','${encUriArg(f.name || '')}')" class="flex flex-col items-start text-left flex-1 min-w-0">
                      <span class="text-xs truncate block w-full">${escapeHtml(f.name)}</span>
                      <div id="${id}-caption" class="text-[10px] ${mine ? 'text-white/60' : 'text-gray-400'} mt-0.5 truncate w-full">${convoDocCaptionText(f.url, state)}</div>
                    </button>
                  </div>`;
              }).join('')}
            </div>`;
        }

        // Downloads the file in place (fetch + blob, saved via a throwaway <a download> click)
        // instead of navigating to it in a new tab
        function canShareFiles(file){
          return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
        }

        // Used to gate the Web Share attempt in convoOpenDocumentBlob to phones/tablets only
        function isMobileDevice(){
          if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') return navigator.userAgentData.mobile;
          return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        }

        // Browsers can only render a handful of types inline -- PDFs, images, plain text
        function isBrowserPreviewableMime(type){
          return !!type && (type === 'application/pdf' || type.indexOf('image/') === 0 || type.indexOf('text/') === 0);
        }

        async function convoOpenDocumentBlob(blob, name){
          const type = blob.type || 'application/octet-stream';
          const file = new File([blob], name || 'document', { type });
          // The share sheet is only the right move on a phone/tablet, where there's no obvious
          // "open" surface otherwise
          if (isMobileDevice() && canShareFiles(file)) {
            try {
              await navigator.share({ files: [file], title: name || 'Document' });
              return;
            } catch (err) {
              if (err && err.name === 'AbortError') return; // user dismissed the sheet, not an error
              if (err && err.name === 'NotAllowedError') {
                // Expected, not a bug: the share sheet requires being called within the window right after
                // a user tap ("transient activation")
                console.info('Share sheet unavailable for this tap (activation window expired) -- opening the document directly instead.');
              } else {
                console.warn('Sharing the document failed, falling back to opening it directly:', err);
              }
              // fall through to the fallback below
            }
          } else if (isMobileDevice()) {
            console.warn('This browser does not support sharing files for this document type -- falling back to opening it directly. type=', type);
          }
          const blobUrl = URL.createObjectURL(blob);
          if (isBrowserPreviewableMime(type)) {
            window.open(blobUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
          } else {
            // Not something the browser can render
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = name || 'download';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
          }
        }

        // First tap: fetch + save to disk (with progress)
        async function convoDownloadDocument(encodedUrl, encodedName){
          const url = decodeURIComponent(encodedUrl);
          const name = decodeURIComponent(encodedName || '');
          const current = convoDocDownloadState[url];
          if (current && (current.status === 'downloading' || current.status === 'opening')) return;

          if (current && current.status === 'done') {
            if (convoDocBlobCache[url]) {
              convoOpenDocumentBlob(convoDocBlobCache[url], name);
              return;
            }
            // Try the fast local cache first
            const dbBlob = await loadConvoDocBlobFromDB(url);
            if (dbBlob) {
              convoDocBlobCache[url] = dbBlob;
              convoOpenDocumentBlob(dbBlob, name);
              return;
            }
            // Not in the local cache (cleared, or downloaded before this feature existed)
            convoDocDownloadState[url] = { status: 'opening', progress: 1 };
            convoUpdateDocChipDOM(url);
            try {
              const res = await fetch(await chatMediaResolve(url));
              if (!res.ok) throw new Error('Open failed (' + res.status + ')');
              const blob = await res.blob();
              convoDocBlobCache[url] = blob;
              saveConvoDocBlobToDB(url, blob);
              convoDocDownloadState[url] = { status: 'done', progress: 1 };
              convoUpdateDocChipDOM(url);
              convoOpenDocumentBlob(blob, name);
            } catch (err) {
              console.warn('Reopening a previously downloaded document failed:', err);
              convoDocDownloadState[url] = { status: 'error', progress: 0 };
              convoUpdateDocChipDOM(url);
            }
            return;
          }

          convoDocDownloadState[url] = { status: 'downloading', progress: 0 };
          convoUpdateDocChipDOM(url);
          try {
            const res = await fetch(await chatMediaResolve(url));
            if (!res.ok) throw new Error('Download failed (' + res.status + ')');
            const total = Number(res.headers.get('content-length')) || 0;
            // Keep the real Content-Type from the response on the chunked path
            const contentType = res.headers.get('content-type') || '';
            let blob;
            if (res.body && res.body.getReader) {
              const reader = res.body.getReader();
              const chunks = [];
              let received = 0;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                if (total) {
                  convoDocDownloadState[url].progress = received / total;
                  convoUpdateDocChipDOM(url);
                }
              }
              blob = new Blob(chunks, contentType ? { type: contentType } : undefined);
            } else {
              blob = await res.blob();
            }
            convoDocBlobCache[url] = blob;
            saveConvoDocBlobToDB(url, blob);
            convoDocDownloadState[url] = { status: 'done', progress: 1 };
            persistConvoDocDownloadState();
            convoUpdateDocChipDOM(url);
            // Route the freshly-downloaded file through the same open/share logic as a repeat tap,
            // instead of unconditionally forcing a save-to-disk
            convoOpenDocumentBlob(blob, name);
            return;
          } catch (err) {
            console.warn('Document download failed:', err);
            convoDocDownloadState[url] = { status: 'error', progress: 0 };
          }
          convoUpdateDocChipDOM(url);
        }

        // ---- In-app document viewer (docx / pdf / txt / csv) ----
        function convoDocViewerKind(name){
          const ext = (name || '').split('.').pop().toLowerCase();
          if (ext === 'docx') return 'docx';
          if (ext === 'pdf') return 'pdf';
          if (ext === 'txt' || ext === 'csv') return 'text';
          return 'other';
        }

        let convoDocViewerState = null;

        async function getConvoDocBlobForViewer(url){
          if (convoDocBlobCache[url]) return convoDocBlobCache[url];
          const dbBlob = await loadConvoDocBlobFromDB(url);
          if (dbBlob) { convoDocBlobCache[url] = dbBlob; return dbBlob; }
          const res = await fetch(await chatMediaResolve(url));
          if (!res.ok) throw new Error('Could not load this file (' + res.status + ').');
          const blob = await res.blob();
          convoDocBlobCache[url] = blob;
          saveConvoDocBlobToDB(url, blob);
          convoDocDownloadState[url] = { status: 'done', progress: 1 };
          persistConvoDocDownloadState();
          convoUpdateDocChipDOM(url);
          return blob;
        }

        async function openConvoDocViewer(encodedUrl, encodedName){
          const url = decodeURIComponent(encodedUrl);
          const name = decodeURIComponent(encodedName || '');
          const kind = convoDocViewerKind(name);
          if (kind === 'other') { convoDownloadDocument(encodedUrl, encodedName); return; }
          convoDocViewerState = { url, name, kind, status: 'loading' };
          renderConvoDocViewer();
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeConvoDocViewer(fromPopState));
          try {
            const blob = await getConvoDocBlobForViewer(url);
            if (!convoDocViewerState || convoDocViewerState.url !== url) return;
            if (kind === 'docx') {
              const buf = await blob.arrayBuffer();
              const result = await mammoth.convertToHtml({ arrayBuffer: buf });
              if (!convoDocViewerState || convoDocViewerState.url !== url) return;
              convoDocViewerState.html = result.value || '<p>No readable content was found in this file.</p>';
              convoDocViewerState.status = 'ready';
              renderConvoDocViewer();
            } else if (kind === 'text') {
              const t = await blob.text();
              if (!convoDocViewerState || convoDocViewerState.url !== url) return;
              convoDocViewerState.text = t;
              convoDocViewerState.status = 'ready';
              renderConvoDocViewer();
            } else if (kind === 'pdf') {
              const buf = await blob.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
              if (!convoDocViewerState || convoDocViewerState.url !== url) return;
              convoDocViewerState.pdfDoc = pdf;
              convoDocViewerState.pdfTotal = pdf.numPages;
              convoDocViewerState.status = 'ready';
              renderConvoDocViewer();
              renderConvoDocViewerPdfPages();
            }
          } catch (err) {
            if (!convoDocViewerState || convoDocViewerState.url !== url) return;
            convoDocViewerState.status = 'error';
            convoDocViewerState.error = (err && err.message) ? err.message : 'Could not open this file.';
            renderConvoDocViewer();
          }
        }

        async function renderConvoDocViewerPdfPages(){
          const s = convoDocViewerState;
          if (!s || s.kind !== 'pdf' || !s.pdfDoc) return;
          const container = document.getElementById('doc-viewer-pdf-pages');
          if (!container) return;
          const width = container.clientWidth || 320;
          for (let i = 1; i <= s.pdfTotal; i++) {
            if (!convoDocViewerState || convoDocViewerState.url !== s.url) return;
            const page = await s.pdfDoc.getPage(i);
            const unscaled = page.getViewport({ scale: 1 });
            const scale = width / unscaled.width;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = 'rounded-lg shadow-sm';
            container.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          }
        }

        function renderConvoDocViewer(){
          const existing = document.getElementById('convo-doc-viewer');
          if (!convoDocViewerState) { if (existing) existing.remove(); return; }
          const html = convoDocViewerHTML();
          if (existing) existing.outerHTML = html;
          else document.body.insertAdjacentHTML('beforeend', html);
        }

        function closeConvoDocViewer(fromPopState){
          convoDocViewerState = null;
          const el = document.getElementById('convo-doc-viewer');
          if (el) el.remove();
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }

        function convoDocViewerHTML(){
          const s = convoDocViewerState;
          let body;
          if (s.status === 'loading') {
            body = `<div class="flex-1 flex items-center justify-center text-gray-400 text-sm">Opening document&hellip;</div>`;
          } else if (s.status === 'error') {
            body = `
              <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                <div class="text-gray-500 text-sm">${escapeHtml(s.error || 'Could not open this file.')}</div>
                <button onclick="convoDownloadDocument('${encUriArg(s.url)}','${encUriArg(s.name)}')" class="text-[13px] font-semibold px-4 py-2 rounded-full" style="background:rgba(10,37,64,0.08);color:${NAVY};">Download instead</button>
              </div>`;
          } else if (s.kind === 'docx') {
            body = `<div class="flex-1 overflow-y-auto doc-viewer-scroll"><div class="doc-viewer-page doc-viewer-content">${sanitizeDocHtml(s.html)}</div></div>`;
          } else if (s.kind === 'text') {
            body = `<div class="flex-1 overflow-y-auto px-5 py-4"><pre class="text-[13px] whitespace-pre-wrap font-sans">${escapeHtml(s.text)}</pre></div>`;
          } else if (s.kind === 'pdf') {
            body = `<div class="flex-1 overflow-y-auto px-3 py-4 flex flex-col items-center gap-3" id="doc-viewer-pdf-pages"></div>`;
          } else {
            body = `<div class="flex-1 flex items-center justify-center text-gray-400 text-sm">Preview not available.</div>`;
          }
          return `
            <div id="convo-doc-viewer" class="fixed inset-0 bg-white flex flex-col" style="z-index:200;">
              <div class="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <button onclick="closeConvoDocViewer()" class="w-8 h-8 flex items-center justify-center flex-shrink-0 -ml-1">${Icon('back','w-5 h-5')}</button>
                <span class="flex-1 min-w-0 font-semibold text-[14px] truncate">${escapeHtml(s.name)}</span>
                <button onclick="convoDownloadDocument('${encUriArg(s.url)}','${encUriArg(s.name)}')" class="w-8 h-8 flex items-center justify-center flex-shrink-0 text-gray-500" aria-label="Download">${Icon('download','w-4 h-4')}</button>
              </div>
              ${body}
            </div>`;
        }

        function convoVideoAttachmentsHTML(videos){
          if (!videos || !videos.length) return '';
          return `
            <div class="flex flex-col gap-1.5">
              ${videos.map(f => {
                const src = f.url || (f.file ? URL.createObjectURL(f.file) : '');
                if (!src) return '';
                const name = f.name || 'video.mp4';
                return `<div class="relative" style="max-width:220px;width:100%;">
                  <video preload="metadata" muted playsinline disablepictureinpicture controlslist="nodownload noremoteplayback nofullscreen noplaybackrate" oncontextmenu="return false;" src="${escapeHtml(src)}" onclick="openConvoVideoViewer('${encUriArg(src)}')" class="cursor-pointer" style="max-width:220px;max-height:280px;width:100%;border-radius:16px;display:block;object-fit:cover;"></video>
                  <div onclick="openConvoVideoViewer('${encUriArg(src)}')" class="absolute" style="top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                    <div style="width:44px;height:44px;border-radius:9999px;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div>
                  </div>
                  <button type="button" onclick="event.stopPropagation();convoDownloadDocument('${encUriArg(src)}','${encUriArg(name)}')" aria-label="Download video" class="convo-media-action-btn" style="top:8px;right:8px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg></button>
                </div>`;
              }).join('')}
            </div>`;
        }

        function convoReadTicksHTML(m){
          if (!m.id) return `<span class="flex-shrink-0" style="color:#9ca3af;">${Icon('checkSingle','w-3.5 h-3.5')}</span>`;
          const color = m.read ? '#34b7f1' : '#9ca3af';
          return `<span class="flex-shrink-0" style="color:${color};" title="${m.read ? 'Read' : 'Delivered'}">${Icon('checkDouble','w-3.5 h-3.5')}</span>`;
        }

        function openConvoImageViewer(encodedSrc, onlyBack){
          closeConvoImageViewer();
          const rawSrc = decodeURIComponent(encodedSrc);
          const src = chatMediaSrc(rawSrc);
          const modal = document.createElement('div');
          modal.id = 'convoImageViewerModal';
          modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
          modal.style.background = '#000';
          modal.onclick = () => closeConvoImageViewer();
          modal.innerHTML = `
            <button onclick="event.stopPropagation();closeConvoImageViewer()" aria-label="Back" class="absolute top-0 left-0 w-11 h-11 flex items-center justify-center text-white" style="margin:calc(env(safe-area-inset-top, 12px) + 12px) 0 0 8px;">${IconBold('back','w-6 h-6')}</button>
            ${onlyBack ? '' : `<button onclick="event.stopPropagation();closeConvoImageViewer()" aria-label="Close" class="absolute top-0 right-0 w-11 h-11 flex items-center justify-center text-white" style="margin:calc(env(safe-area-inset-top, 12px) + 12px) 12px 0 0;">${Icon('close','w-6 h-6')}</button>`}
            <img src="${escapeHtml(src)}" onclick="event.stopPropagation();" style="max-width:96vw;max-height:96vh;width:auto;height:auto;object-fit:contain;">`;
          document.body.appendChild(modal);
          if (src === rawSrc && parseChatMediaUrl(rawSrc)) {
            chatMediaResolve(rawSrc).then(u => {
              const im = modal.querySelector('img');
              if (im && u && u !== im.getAttribute('src')) im.src = u;
            });
          }
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeConvoImageViewer(fromPopState));
        }

        function closeConvoImageViewer(fromPopState){
          const modal = document.getElementById('convoImageViewerModal');
          if (!modal) return;
          modal.remove();
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }

        function openConvoVideoViewer(encodedSrc){
          closeConvoVideoViewer();
          const rawSrc = decodeURIComponent(encodedSrc);
          // chat-media is private: use a signed link (cached) or fetch one if we don't have it yet.
          const src = chatMediaSrc(rawSrc);
          const modal = document.createElement('div');
          modal.id = 'convoVideoViewerModal';
          modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
          modal.style.background = '#000';
          modal.onclick = () => closeConvoVideoViewer();
          modal.innerHTML = `
            <button onclick="event.stopPropagation();closeConvoVideoViewer()" aria-label="Back" class="absolute top-0 left-0 w-11 h-11 flex items-center justify-center text-white" style="margin:calc(env(safe-area-inset-top, 12px) + 12px) 0 0 8px;">${IconBold('back','w-6 h-6')}</button>
            <button onclick="event.stopPropagation();closeConvoVideoViewer()" aria-label="Close" class="absolute top-0 right-0 w-11 h-11 flex items-center justify-center text-white" style="margin:calc(env(safe-area-inset-top, 12px) + 12px) 12px 0 0;">${Icon('close','w-6 h-6')}</button>
            <video src="${escapeHtml(src)}" controls autoplay playsinline disablepictureinpicture controlslist="nodownload noremoteplayback noplaybackrate" onclick="event.stopPropagation();" style="max-width:96vw;max-height:96vh;width:auto;height:auto;object-fit:contain;"></video>`;
          document.body.appendChild(modal);
          if (src === rawSrc && parseChatMediaUrl(rawSrc)) {
            chatMediaResolve(rawSrc).then(u => {
              const v = modal.querySelector('video');
              if (v && u && u !== v.getAttribute('src')) v.src = u;
            });
          }
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeConvoVideoViewer(fromPopState));
        }

        function closeConvoVideoViewer(fromPopState){
          const modal = document.getElementById('convoVideoViewerModal');
          if (!modal) return;
          const video = modal.querySelector('video');
          if (video) { try { video.pause(); } catch (err) {} }
          modal.remove();
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }

        // ---- Message compose input (keyboard, autogrow, send) ----
        function updateConvoPreview(convoId, previewText){
          const found = findConvoAndArray(convoId);
          if (found) {
            const [c] = found.arr.splice(found.idx, 1);
            c.preview = previewText; c.time = formatRequestTime(Date.now()); c.unread = false; c.read = true; c.unreadCount = 0;
            c._lastMsgAt = Date.now();
            found.arr.unshift(c);
          }
          if (convoMeta[convoId]) convoMeta[convoId].preview = previewText;
          if (currentTab === 3) renderInboxTab();
          if (typeof refreshMessagingBadges === 'function') refreshMessagingBadges();
        }

        let convoInputFocused = false;

        // Fills the strip between the composer and the keyboard with the chat's own background so
        // the inbox / black page never shows through
        function setConvoKbFiller(show){
          const stale = document.getElementById('convo-kb-filler'); // leftover from the earlier approach
          if (stale) stale.remove();
          const ov = document.getElementById('overlay');
          if (!ov) return;
          ov.classList.toggle('kb-fill', !!show);
        }

        function syncConvoKeyboardInset(){
          const ov = document.getElementById('overlay');
          if (!ov || ov.classList.contains('hidden')) { setConvoKbFiller(false); return; }
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind !== 'conversation') { setConvoKbFiller(false); return; }
          const keyboardInset = getKeyboardInset(convoInputFocused);
          const keyboardLikelyOpen = keyboardInset > 0 || convoInputFocused;
          ov.style.bottom = (keyboardLikelyOpen ? keyboardInset : 0) + 'px';
          setConvoKbFiller(keyboardLikelyOpen);
          const composerWrap = document.getElementById('convo-composer-wrap');
          if (composerWrap) composerWrap.style.paddingBottom = (keyboardLikelyOpen ? 10 : 20) + 'px';
        }
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', syncConvoKeyboardInset);
          window.visualViewport.addEventListener('scroll', syncConvoKeyboardInset);
        }
        if (navigator.virtualKeyboard) {
          navigator.virtualKeyboard.addEventListener('geometrychange', syncConvoKeyboardInset);
        }

        function handleConvoInputFocus(){
          convoInputFocused = true;
          syncConvoKeyboardInset();
          // The keyboard takes a moment to slide up and report its real height
          [120, 300, 600].forEach(ms => setTimeout(() => {
            if (!convoInputFocused) return;
            syncConvoKeyboardInset();
            const log = document.getElementById('convo-log');
            if (log) log.scrollTop = log.scrollHeight;
          }, ms));
        }

        function handleConvoInputBlur(){
          convoInputFocused = false;
          setTimeout(syncConvoKeyboardInset, 60);
        }

        function autoGrowConvoInput(el){
          el.style.height = 'auto';
          el.style.height = Math.min(el.scrollHeight, 120) + 'px';
        }

        function sendConvoMessage(){
          const inputEl = document.getElementById('convo-input');
          const text = inputEl ? inputEl.value.trim() : '';
          const attachmentsForUpload = pendingConvoAttachments;
          // Keep `file` on the locally-echoed attachment (not just dataUrl) so non-image attachments
          const attachments = attachmentsForUpload.map(f => ({ name: f.name, type: f.type, dataUrl: f.dataUrl, file: f.file }));
          if (!text && !attachments.length) return;
          if (!activeConvoId) return;
          convoStoppedTypingNow();
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
            let uploaded = [];
            if (attachmentsForUpload.length && meta && (meta.otherUserId || (meta.icon === 'users' && Array.isArray(meta.members)))) {
              uploaded = await uploadConvoAttachmentsToStorage(attachmentsForUpload, convoIdAtSend);
              if (attachmentsForUpload.length && !uploaded.length) {
                flashConvoMicMessage('Attachment not sent (upload failed)');
              } else if (uploaded.length) {
                // Swap the local blob-only attachments for the real uploaded ones (which have a permanent
                // `url`) so the bubble keeps rendering correctly after the object URL above is gone, and
                message.attachments = uploaded;
                queueSaveUserState();
                refreshConvoLogIfOpen(convoIdAtSend);
              }
            }
            if (meta && meta.otherUserId) {
              if (text || uploaded.length) {
                const id = await sendMessageRemote(convoIdAtSend, meta.otherUserId, text, null, null, uploaded, message.localId);
                if (id) {
                  message.id = id;
                  refreshConvoLogIfOpen(convoIdAtSend);
                }
              }
            } else if (meta && meta.icon === 'users' && Array.isArray(meta.members) && (text || uploaded.length)) {
              const recipients = meta.members.filter(m => !m.mine && m.otherUserId);
              const results = await Promise.all(recipients.map(m =>
                sendMessageRemote(convoIdAtSend, m.otherUserId, text, null, null, uploaded, message.localId)
              ));
              const failedCount = results.filter(id => !id).length;
              if (failedCount > 0) {
                // Previously this failure was silent (just a console.warn inside sendMessageRemote), so a
                // message could sit there looking "sent" locally while other members never actually
                pushInAppNotification(
                  'Message may not have sent',
                  failedCount === recipients.length
                    ? "This message didn't sync to anyone else in the collaboration. Check your connection and try again."
                    : `This message didn't reach ${failedCount} of ${recipients.length} member${recipients.length === 1 ? '' : 's'}.`
                );
              }
            }
          })();
        }

        let callState = { convoId: null, type: 'audio', connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null, pendingRingTargets: null };
        let callRingTimeout = null;
        let callAnswerTimeout = null;
        let callTickInterval = null;
        let callLocalStream = null; 

        let callPeers = {};
        let callChannel = null;
        let myCallPeerId = null;
        let myCallUserId = null;

        const RTC_ICE_SERVERS = {
          iceServers: [
            { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
          ]
        };

        // ---- Voice/video call: WebRTC peer connection setup ----
        function newCallPeerId(){
          return Math.random().toString(36).slice(2) + Date.now().toString(36);
        }

        function isGroupCallConvo(id){
          const meta = convoMeta[id || callState.convoId];
          return !!(meta && meta.icon === 'users');
        }

        async function startCall(id, type, answering, opts){
          if (!id) return;
          clearCallTimers();
          stopCallLocalStream();
          teardownCallSignaling();
          groupCallFullscreenId = null;
          callState = { convoId: id, type, connected: false, seconds: 0, muted: false, speaker: false, camOff: !!(opts && opts.camOff), mediaError: null, statusOverride: null, pendingRingTargets: null };
          openOverlay('call');
          refreshConvoAvatarFromProfile(id);

          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              callLocalStream = await navigator.mediaDevices.getUserMedia({
                video: type === 'video' ? { facingMode: 'user' } : false,
                audio: true
              });
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

          if (isMeetingConvo(id)) {
            // Meetings never ring anyone: you are in the room as soon as you join
            callState.connected = true;
            startCallClock();
            scheduleMeetingAutoEnd();
            const meetingScreen = document.getElementById('call-screen');
            if (meetingScreen) meetingScreen.outerHTML = callHTML();
            attachCallLocalVideo();
          }

          const sb = getSupabaseClient();
          if (sb) {
            joinCallSignaling(id, sb);
            if (!answering) {
              const meta = convoMeta[id];
              const isGroup = meta && meta.icon === 'users';
              if (isGroup) {
                const ringTargets = (meta.members || []).filter(m => !m.mine && m.otherUserId);
                if (ringTargets.length) {
                  callState.pendingRingTargets = new Set(ringTargets.map(m => m.otherUserId));
                  ringTargets.forEach(m => sendCallRing(id, type, m.otherUserId));
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
                callState.pendingRingTargets = new Set([meta.otherUserId]);
                sendCallRing(id, type, meta.otherUserId);
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
                console.warn('startCall: no otherUserId on convoMeta[' + id + '] -- nobody was rung, this conversation has no linked backend user.');
                callState.statusOverride = 'Not available to call';
                const screen = document.getElementById('call-screen');
                if (screen) screen.outerHTML = callHTML();
              }
            }
          } else {
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

        let callMinimized = false;

        // ---- Dragging the minimized call banner --------------------------------------------
        let callBannerPos = null;
        let callBannerDrag = null;
        let callBannerJustDragged = false;
        const CALL_BANNER_COMPACT_WIDTH = 250;
        const CALL_BANNER_DRAG_THRESHOLD = 6;

        function clampCallBannerPos(left, top, width, height){
          const pad = 8;
          const maxLeft = Math.max(pad, window.innerWidth - width - pad);
          const maxTop = Math.max(pad, window.innerHeight - height - pad);
          return { left: Math.min(Math.max(left, pad), maxLeft), top: Math.min(Math.max(top, pad), maxTop) };
        }

        // Re-applies a remembered dropped position/size to the banner
        function applyCallBannerPos(){
          const banner = document.getElementById('call-minimized-banner');
          if (!banner || !callBannerPos) return;
          banner.classList.add('cmb-compact');
          banner.style.setProperty('width', callBannerPos.width + 'px', 'important');
          banner.style.setProperty('max-width', callBannerPos.width + 'px', 'important');
          banner.style.setProperty('left', callBannerPos.left + 'px', 'important');
          banner.style.setProperty('top', callBannerPos.top + 'px', 'important');
          banner.style.setProperty('right', 'auto', 'important');
          banner.style.setProperty('margin', '0', 'important');
        }

        // Clears any remembered dropped position, restoring the banner to the default full-width
        // top bar the next time it's shown (used when a call ends)
        function resetCallBannerPos(){
          callBannerPos = null;
          const banner = document.getElementById('call-minimized-banner');
          if (!banner) return;
          banner.classList.remove('cmb-compact');
          ['width','max-width','left','top','right','margin'].forEach(prop => banner.style.removeProperty(prop));
        }

        // Pressing anywhere on the banner except its three action buttons can start a drag
        function callBannerDragStart(e){
          if (e.target.closest('button')) return;
          const banner = document.getElementById('call-minimized-banner');
          if (!banner) return;
          const rect = banner.getBoundingClientRect();
          callBannerDrag = {
            pointerId: e.pointerId,
            startX: e.clientX, startY: e.clientY,
            originLeft: rect.left, originTop: rect.top, originHeight: rect.height,
            moved: false
          };
          try { banner.setPointerCapture(e.pointerId); } catch(err) {}
          banner.addEventListener('pointermove', callBannerDragMove);
          banner.addEventListener('pointerup', callBannerDragEnd);
          banner.addEventListener('pointercancel', callBannerDragEnd);
        }

        function callBannerDragMove(e){
          if (!callBannerDrag || e.pointerId !== callBannerDrag.pointerId) return;
          const dx = e.clientX - callBannerDrag.startX;
          const dy = e.clientY - callBannerDrag.startY;
          if (!callBannerDrag.moved && Math.hypot(dx, dy) < CALL_BANNER_DRAG_THRESHOLD) return;
          const banner = document.getElementById('call-minimized-banner');
          if (!banner) return;
          if (!callBannerDrag.moved) {
            callBannerDrag.moved = true;
            callBannerJustDragged = true;
            // First real movement: shrink from the full-width bar into a small card so it has
            // somewhere to go, instead of staying pinned edge to edge
            banner.classList.add('cmb-compact');
            banner.style.setProperty('width', CALL_BANNER_COMPACT_WIDTH + 'px', 'important');
            banner.style.setProperty('max-width', CALL_BANNER_COMPACT_WIDTH + 'px', 'important');
            banner.style.setProperty('right', 'auto', 'important');
            banner.style.setProperty('margin', '0', 'important');
          }
          const clamped = clampCallBannerPos(
            callBannerDrag.originLeft + dx,
            callBannerDrag.originTop + dy,
            CALL_BANNER_COMPACT_WIDTH,
            callBannerDrag.originHeight
          );
          banner.style.setProperty('left', clamped.left + 'px', 'important');
          banner.style.setProperty('top', clamped.top + 'px', 'important');
          callBannerPos = { left: clamped.left, top: clamped.top, width: CALL_BANNER_COMPACT_WIDTH };
        }

        function callBannerDragEnd(e){
          const banner = document.getElementById('call-minimized-banner');
          if (banner) {
            banner.removeEventListener('pointermove', callBannerDragMove);
            banner.removeEventListener('pointerup', callBannerDragEnd);
            banner.removeEventListener('pointercancel', callBannerDragEnd);
            if (callBannerDrag) { try { banner.releasePointerCapture(callBannerDrag.pointerId); } catch(err) {} }
          }
          callBannerDrag = null;
        }

        // Keeps a dropped banner on screen if the viewport changes size (e.g. rotating the device)
        // instead of letting it get stranded off-screen
        window.addEventListener('resize', () => {
          if (!callBannerPos) return;
          const banner = document.getElementById('call-minimized-banner');
          if (!banner || banner.classList.contains('hidden')) return;
          const clamped = clampCallBannerPos(callBannerPos.left, callBannerPos.top, callBannerPos.width, banner.getBoundingClientRect().height);
          callBannerPos.left = clamped.left; callBannerPos.top = clamped.top;
          banner.style.setProperty('left', clamped.left + 'px', 'important');
          banner.style.setProperty('top', clamped.top + 'px', 'important');
        });

        // The name/timer row's click handler
        function callBannerRowClick(e){
          if (callBannerJustDragged) { callBannerJustDragged = false; e.preventDefault(); e.stopPropagation(); return; }
          resumeCall();
        }

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
          if (appShellEl) { appShellEl.classList.remove('messaging-split'); appShellEl.classList.remove('call-fullscreen'); }
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
          if (banner) { banner.classList.remove('hidden'); updateMinimizedCallBanner(); applyCallBannerPos(); }
        }

        function resumeCall(){
          if (typeof lectureBannerActive === 'function' && lectureBannerActive() && !callMinimized) { resumeLecture(); return; }
          if (!callState.convoId) return;
          callMinimized = false;
          const banner = document.getElementById('call-minimized-banner');
          if (banner) banner.classList.add('hidden');
          const bgAudio = document.getElementById('call-bg-audio');
          if (bgAudio) bgAudio.srcObject = null;
          returnToCallScreen();
        }

        function returnToCallScreen(){
          if (!callState.convoId) { closeOverlay(); return; }
          openOverlay('call');
          attachCallLocalVideo();
          attachCallRemoteVideo();
        }

        function updateMinimizedCallBanner(){
          const banner = document.getElementById('call-minimized-banner');
          if (!banner || banner.classList.contains('hidden')) return;
          const msgBtn = document.getElementById('call-minimized-msg-btn');
          const labelEl = document.getElementById('call-minimized-label');
          if (typeof lectureBannerActive === 'function' && lectureBannerActive() && !callMinimized) {
            const cls = (typeof myClasses !== 'undefined') ? myClasses.find(c => c.id === liveLectureState.classId) : null;
            const nm = document.getElementById('call-minimized-name');
            if (nm) nm.textContent = (cls && cls.name) || 'Class call';
            const tm = document.getElementById('call-minimized-timer');
            if (tm) tm.textContent = formatCallTime(liveLectureState.seconds);
            if (labelEl) labelEl.textContent = 'Class in progress';
            if (msgBtn) msgBtn.style.display = 'none';
            const mb = document.getElementById('call-minimized-mute-btn');
            if (mb) mb.innerHTML = Icon(liveLectureState.muted ? 'micOff' : 'mic', 'w-4 h-4');
            return;
          }
          if (labelEl) labelEl.textContent = 'Call in progress';
          if (labelEl && isMeetingConvo(callState.convoId)) labelEl.textContent = 'Meeting in progress';
          if (msgBtn) msgBtn.style.display = isMeetingConvo(callState.convoId) ? 'none' : '';
          const timer = document.getElementById('call-minimized-timer');
          if (timer) timer.textContent = callState.statusOverride || (callState.connected ? formatCallTime(callState.seconds) : '…');
          const nameEl = document.getElementById('call-minimized-name');
          if (nameEl) {
            const meta = convoMeta[callState.convoId] || {};
            nameEl.textContent = callDisplayName(meta) || 'Call';
          }
          const muteBtn = document.getElementById('call-minimized-mute-btn');
          if (muteBtn) muteBtn.innerHTML = Icon(callState.muted ? 'micOff' : 'mic', 'w-4 h-4');
        }

        // Mute toggle from the minimized banner
        function callBannerToggleMute(){
          if (lectureBannerActive() && !callMinimized) { lectureBannerToggleMute(); return; }
          toggleCallControl('muted');
          updateMinimizedCallBanner();
        }

        // Message icon on the minimized banner: opens the chat with whoever the call is with,
        // while leaving the call minimized and running
        function callBannerMessage(){
          if (!callState.convoId || isMeetingConvo(callState.convoId)) return;
          openConversation(callState.convoId);
        }

        // Plus icon on the minimized banner: unlike messaging, adding someone to the call is
        // itself a call-management action, so this returns to the full call screen (clearing the
        // banner) before showing the add-to-call list, rather than leaving the banner
        function callBannerEnd(){
          if (lectureBannerActive() && !callMinimized) { endLecture(); return; }
          endCall();
        }
        function callBannerAddToCall(){
          if (lectureBannerActive() && !callMinimized) { openLectureAddPeople(); return; }
          if (!callState.convoId) return;
          callMinimized = false;
          const banner = document.getElementById('call-minimized-banner');
          if (banner) banner.classList.add('hidden');
          openAddToCall();
        }

        // ---- Call notes: a short note per conversation, jotted down while a call with them is in
        // progress (via the pencil icon on the minimized banner) and kept even after the call ends
        // --
        let callNotes = {};
        let activeCallNotesConvoId = null;
        let callNotesSaveTimer = null;

        function openCallNotes(){
          if (lectureBannerActive() && !callMinimized) {
            activeCallNotesConvoId = 'lecture:' + liveLectureState.lectureId;
            const cls = myClasses.find(c => c.id === liveLectureState.classId);
            const modal = document.getElementById('callNotesModal');
            const titleEl = document.getElementById('callNotesModalTitle');
            const ta = document.getElementById('callNotesTextarea');
            const hint = document.getElementById('callNotesSavedHint');
            if (titleEl) titleEl.textContent = `Notes · ${(cls && cls.name) || 'Class'}`;
            if (ta) ta.value = lectureNoteText();
            if (hint) hint.textContent = 'Saved to your classroom Notebook';
            if (modal) modal.classList.remove('hidden');
            requestAnimationFrame(() => { if (ta) ta.focus(); });
            return;
          }
          if (!callState.convoId) return;
          activeCallNotesConvoId = callState.convoId;
          const modal = document.getElementById('callNotesModal');
          const titleEl = document.getElementById('callNotesModalTitle');
          const ta = document.getElementById('callNotesTextarea');
          const hint = document.getElementById('callNotesSavedHint');
          if (titleEl) {
            const meta = convoMeta[callState.convoId] || {};
            titleEl.textContent = `Notes · ${callDisplayName(meta) || 'Call'}`;
          }
          if (ta) ta.value = callNotes[activeCallNotesConvoId] || '';
          if (hint) hint.textContent = 'Saved automatically';
          if (modal) modal.classList.remove('hidden');
          requestAnimationFrame(() => { if (ta) ta.focus(); });
        }

        function closeCallNotesModal(){
          const modal = document.getElementById('callNotesModal');
          if (modal) modal.classList.add('hidden');
          activeCallNotesConvoId = null;
        }

        function handleCallNotesInput(){
          const key = activeCallNotesConvoId;
          const ta = document.getElementById('callNotesTextarea');
          if (!key || !ta) return;
          if (String(key).indexOf('lecture:') === 0) {
            saveLectureNoteText(ta.value);
            const h = document.getElementById('callNotesSavedHint');
            if (h) h.textContent = 'Saving…';
            if (callNotesSaveTimer) clearTimeout(callNotesSaveTimer);
            callNotesSaveTimer = setTimeout(() => {
              queueSaveUserState();
              const h2 = document.getElementById('callNotesSavedHint');
              if (h2) h2.textContent = 'Saved to your classroom Notebook';
            }, 500);
            return;
          }
          callNotes[key] = ta.value;
          const hint = document.getElementById('callNotesSavedHint');
          if (hint) hint.textContent = 'Saving…';
          if (callNotesSaveTimer) clearTimeout(callNotesSaveTimer);
          callNotesSaveTimer = setTimeout(() => {
            queueSaveUserState();
            const hintNow = document.getElementById('callNotesSavedHint');
            if (hintNow) hintNow.textContent = 'Saved automatically';
          }, 500);
        }

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
          myCallUserId = myId;
          callChannel = sb.channel(`call:${convoId}`, { config: { broadcast: { self: false } } });
          callChannel.on('broadcast', { event: 'signal' }, ({ payload }) => handleCallSignal(payload));
          callChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') sendCallSignal({ kind: 'join', userId: myId, muted: !!callState.muted, camOff: !!callState.camOff });
          });
        }

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
          if (payload.to && payload.to !== myCallPeerId) return;
          if (payload.kind === 'meeting_end') { meetingHandleEndSignal(); return; }
          if (payload.kind === 'meeting_reaction' || payload.kind === 'meeting_comment') { meetingReceiveExtra(payload); return; }
          if (payload.kind === 'state') {
            const stateEntry = callPeers[payload.from];
            if (stateEntry) {
              stateEntry.muted = !!payload.muted;
              stateEntry.camOff = !!payload.camOff;
              const wasHand = !!stateEntry.hand;
              stateEntry.hand = !!payload.hand;
              if (stateEntry.hand && !wasHand && stateEntry.userId) callToast(callMemberName(stateEntry.userId) + ' raised a hand');
              refreshCallStage();
            }
            return;
          }
          if (payload.kind === 'mute_all') {
            // Only honoured when it comes from someone who really is an admin of this call
            const sender = callPeers[payload.from];
            const senderId = sender && sender.userId;
            if (!senderId || senderId !== payload.userId || callAdminUserIds().indexOf(senderId) === -1) return;
            if (!callState.muted) {
              callState.muted = true;
              applyCallTrackStates();
              broadcastMyCallState();
              refreshCallControls();
              if (isGroupCallConvo(callState.convoId)) refreshCallStage();
              callToast(callMemberName(senderId) + ' muted everyone');
            }
            return;
          }
          if (payload.kind === 'join' || payload.kind === 'here') {
            const entry = callPeers[payload.from] || (callPeers[payload.from] = { pc: null, stream: null, role: null, pendingIce: [], remoteDescSet: false, userId: null, connected: false, muted: false, camOff: false });
            entry.userId = payload.userId || entry.userId;
            if (payload.muted !== undefined) entry.muted = !!payload.muted;
            if (payload.camOff !== undefined) entry.camOff = !!payload.camOff;
            if (payload.hand !== undefined) entry.hand = !!payload.hand;
            if (entry.userId && isMeetingConvo(callState.convoId)) meetingResolvePeer(entry.userId);
            if (payload.kind === 'join') {
              const myId = await getCurrentUserId();
              sendCallSignal({ kind: 'here', userId: myId, to: payload.from, muted: !!callState.muted, camOff: !!callState.camOff, hand: !!callState.handRaised });
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
              try { await pc.addIceCandidate(payload.candidate); } catch (e) {  }
            } else {
              entry.pendingIce.push(payload.candidate);
            }
          }
        }

        async function flushPendingIceCandidates(entry){
          for (const c of entry.pendingIce) {
            try { await entry.pc.addIceCandidate(c); } catch (e) {  }
          }
          entry.pendingIce = [];
        }

        function handlePeerHangup(peerId){
          const entry = callPeers[peerId];
          if (entry) {
            if (entry.pc) { entry.pc.onicecandidate = null; entry.pc.ontrack = null; entry.pc.close(); }
            delete callPeers[peerId];
          }
          if (Object.keys(callPeers).length === 0 && !isMeetingConvo(callState.convoId)) {
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
          myCallUserId = null;
        }

        function attachCallLocalVideo(){
          const v = document.getElementById('call-local-video');
          if (v && callLocalStream) { v.srcObject = callLocalStream; v.style.transform = callState.facing === 'environment' ? 'none' : 'scaleX(-1)'; }
        }
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
          if (callMinimized) {
            const bgAudio = document.getElementById('call-bg-audio');
            if (bgAudio) {
              const anyStream = Object.values(callPeers).find(e => e.stream);
              bgAudio.srcObject = anyStream ? anyStream.stream : null;
            }
          }
        }

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
          total = Math.max(0, Math.floor(Number(total) || 0)); // whole seconds only -- fractional input (e.g. audio.currentTime) must never leak milliseconds into the label
          const m = Math.floor(total / 60).toString().padStart(2,'0');
          const s = (total % 60).toString().padStart(2,'0');
          return `${m}:${s}`;
        }

        function endCall(remoteInitiated){
          const wasConnected = callState.connected;
          const wasMinimized = callMinimized;
          const callDurationSecs = callState.seconds;
          const callType = callState.type;
          closeCallNotesModal();
          clearCallTimers();
          stopCallLocalStream();
          if (!remoteInitiated) {
            if (callState.pendingRingTargets) {
              Array.from(callState.pendingRingTargets).forEach(uid => sendCallCancel(callState.convoId, uid));
            }
            teardownCallSignaling();
          } else {
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
          resetCallBannerPos();
          const bgAudio = document.getElementById('call-bg-audio');
          if (bgAudio) bgAudio.srcObject = null;
          const endedId = callState.convoId;
          const endedWasMeeting = isMeetingConvo(endedId);
          if (wasConnected && endedId && !endedWasMeeting) {
            logCallEvent(endedId, `${callType === 'video' ? 'Video' : 'Voice'} call · ${formatCallTime(callDurationSecs)}`);
          }
          if (endedWasMeeting) meetingOnCallEnded();
          callState = { convoId: null, type: 'audio', connected: false, seconds: 0, muted: false, speaker: false, camOff: false, mediaError: null, statusOverride: null, pendingRingTargets: null };
          groupCallFullscreenId = null;
          if (wasMinimized) return;
          if (endedId && !endedWasMeeting) openConversation(endedId); else closeOverlay();
        }

        // ---- Call controls (mute/video/minimize/end) ----
        function toggleCallControl(key){
          callState[key] = !callState[key];
          applyCallTrackStates();
          if (key === 'muted' || key === 'camOff') broadcastMyCallState();
          // Group tiles show a muted badge on your own tile, so they re-render on mute too
          if (key === 'camOff' || (key === 'muted' && isGroupCallConvo(callState.convoId))) refreshCallStage();
          refreshCallControls();
        }

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
            <div class="px-5 pb-3 flex-shrink-0 border-b border-gray-100" style="padding-top:var(--top-safe-pad);">
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
          if (!callState.connected) {
            if (!callState.pendingRingTargets) callState.pendingRingTargets = new Set();
            callState.pendingRingTargets.add(otherUserId);
          }
          sendCallRing(callState.convoId, callState.type, otherUserId);
          returnToCallScreen();
        }


        // Real emojis for in-call reactions (the icon key is still what is sent over the wire)
        const CU_EMOJI = { clap: '\u{1F44F}', thumbsUp: '\u{1F44D}', heart: '\u2764\uFE0F', laugh: '\u{1F602}', wow: '\u{1F62E}', party: '\u{1F389}', handRaised: '\u270B', reactions: '\u{1F60A}' };
        function cuEmoji(icon){ return CU_EMOJI[icon] || ''; }

        // Message box that rides on top of the on-screen keyboard. It is mounted on <body> so no
        // transformed/clipped parent can push it under the keyboard.
        let cuCommentTimer = null;
        function cuKeyboardInset(){
          const bar = document.getElementById('cu-comment-bar');
          const ae = document.activeElement;
          const focused = !!(bar && ae && bar.contains(ae));
          if (typeof getKeyboardInset === 'function') return getKeyboardInset(focused);
          const vv = window.visualViewport;
          return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
        }
        function cuPlaceCommentBar(){
          const bar = document.getElementById('cu-comment-bar');
          if (!bar) return;
          const inset = cuKeyboardInset();
          bar.style.bottom = inset + 'px';
          bar.style.transition = 'bottom .12s ease-out';
          bar.style.paddingBottom = inset > 0 ? '10px' : 'calc(env(safe-area-inset-bottom,0px) + 12px)';
        }
        function cuMountCommentBar(o){
          if (document.getElementById('cu-comment-wrap')) return;
          const w = document.createElement('div');
          w.id = 'cu-comment-wrap';
          w.innerHTML = `
            <div class="cu-backdrop" style="z-index:99980;" onclick="${o.onClose}"></div>
            <div id="cu-comment-bar" class="cu-bsheet" style="z-index:99981;">
              <div class="cu-bsheet-grab"></div>
              <div style="display:flex;align-items:center;gap:10px;padding:2px 6px 0;">
                <input id="${o.inputId}" type="text" placeholder="${o.placeholder}" maxlength="200" enterkeyhint="send" autocomplete="off"
                  style="flex:1;min-width:0;height:46px;border-radius:999px;padding:0 18px;font-size:16px;outline:none;border:0;background:var(--cu-soft);color:var(--cu-fg);"
                  onkeydown="if(event.key==='Enter'){event.preventDefault();${o.onSend};}">
                <button onclick="${o.onSend}" title="Send" style="width:46px;height:46px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:#1e90ff;">${Icon('send','w-5 h-5')}</button>
              </div>
            </div>`;
          document.body.appendChild(w);
          cuPlaceCommentBar();
          if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', cuPlaceCommentBar);
            window.visualViewport.addEventListener('scroll', cuPlaceCommentBar);
          }
          if (navigator.virtualKeyboard) navigator.virtualKeyboard.addEventListener('geometrychange', cuPlaceCommentBar);
          const inp = document.getElementById(o.inputId);
          if (inp) { inp.addEventListener('focus', cuPlaceCommentBar); inp.addEventListener('blur', () => setTimeout(cuPlaceCommentBar, 50)); }
          cuCommentTimer = setInterval(cuPlaceCommentBar, 100);
          setTimeout(() => { const i = document.getElementById(o.inputId); if (i) i.focus(); cuPlaceCommentBar(); }, 60);
        }
        function cuUnmountCommentBar(){
          const w = document.getElementById('cu-comment-wrap');
          if (w) w.remove();
          if (cuCommentTimer) { clearInterval(cuCommentTimer); cuCommentTimer = null; }
          if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', cuPlaceCommentBar);
            window.visualViewport.removeEventListener('scroll', cuPlaceCommentBar);
          }
          if (navigator.virtualKeyboard) navigator.virtualKeyboard.removeEventListener('geometrychange', cuPlaceCommentBar);
        }

        // ---- Call screen markup (1:1, group and meeting) ----------------------------------
        // Shared look for every call screen (also used by class lectures in courses.js):
        // a deep-blue stage, glass top bar, rounded tiles with name chips + muted badges,
        // and a floating labelled control bar.
        function ensureCallUiStyles(){
          if (document.getElementById('call-ui-styles')) return;
          const st = document.createElement('style');
          st.id = 'call-ui-styles';
          st.textContent = `

            body{--cu-bg:#f8fafc;--cu-fg:#0f172a;--cu-sub:#64748b;--cu-soft:rgba(15,23,42,.07);--cu-soft2:rgba(15,23,42,.12);--cu-line:#e2e8f0;--cu-tile:#e5eaf2;--cu-sheet:#ffffff;--cu-bar:#f1f3f6;--cu-blue-soft:rgba(30,144,255,.1);--cu-endtxt:#dc2626;--cu-accepttxt:#16a34a;--cu-alerttxt:#92400e;}
            body.dark-mode{--cu-bg:#0b0d12;--cu-fg:#f1f5f9;--cu-sub:#94a3b8;--cu-soft:rgba(255,255,255,.09);--cu-soft2:rgba(255,255,255,.16);--cu-line:#242a36;--cu-tile:#1a1f29;--cu-sheet:#161a22;--cu-bar:#161a22;--cu-blue-soft:rgba(30,144,255,.16);--cu-endtxt:#fecaca;--cu-accepttxt:#bbf7d0;--cu-alerttxt:#fde68a;}
            ::view-transition-old(root),::view-transition-new(root){animation-duration:.18s;animation-timing-function:ease-out;}
            .cu-soft-btn{background:var(--cu-soft2);color:var(--cu-fg);}
            .cu-float{background:var(--cu-sheet);color:var(--cu-fg);box-shadow:0 4px 14px rgba(0,0,0,.18);}
            .cu-float .cu-float-sub{color:var(--cu-fg);}
            .cu-backdrop{position:fixed;inset:0;z-index:30;background:rgba(0,0,0,.35);animation:cuFade .2s ease;}
            .cu-bsheet{position:fixed;left:0;right:0;bottom:0;z-index:40;max-width:560px;margin:0 auto;background:var(--cu-sheet);color:var(--cu-fg);border-radius:24px 24px 0 0;padding:8px 10px calc(env(safe-area-inset-bottom,0px) + 16px);box-shadow:0 -10px 40px rgba(0,0,0,.25);animation:cuSheetUp .26s cubic-bezier(.22,1,.36,1);}
            .cu-bsheet-grab{width:40px;height:4px;border-radius:2px;background:var(--cu-soft2);margin:6px auto 8px;}
            .cu-bsheet-row{width:100%;display:flex;align-items:center;gap:14px;padding:14px 14px;border-radius:14px;text-align:left;font-weight:600;font-size:15px;color:inherit;}
            .cu-bsheet-row:active{background:var(--cu-soft);}
            .cu-bsheet-row.red{color:#ef4444;}
            .cu-tile.cu-speaking,.cu-pip.cu-speaking{outline:3px solid #22c55e;outline-offset:-3px;}
            .cu-flip{position:absolute;right:8px;bottom:8px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);color:#fff;z-index:3;cursor:pointer;}
            .cu-bsheet-row{border-radius:0;border-bottom:1px solid var(--cu-line);padding:12px 4px;}
            .cu-bsheet-row:last-child{border-bottom:0;}
            .cu-bsheet-row > :first-child{width:38px !important;height:38px;flex-shrink:0;border-radius:12px;background:var(--cu-blue-soft);color:#1e90ff;display:flex;align-items:center;justify-content:center;padding:9px;font-size:20px !important;}
            .cu-bsheet-row.red > :first-child{background:rgba(239,68,68,.12);color:#ef4444;}
            .cu-bsheet-row small{display:block;font-size:12px;font-weight:500;color:var(--cu-sub);margin-top:2px;}
            .cu-emoji-row{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:10px 6px 6px;}
            .cu-emoji-btn{width:100%;max-width:62px;aspect-ratio:1;margin:0 auto;border-radius:50%;font-size:clamp(24px,7.4vw,31px);line-height:1;display:flex;align-items:center;justify-content:center;background:var(--cu-soft);transition:transform .12s ease;}
            .cu-emoji-btn:active{transform:scale(.88);}
            @keyframes cuSheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
            @keyframes cuFade{from{opacity:0}to{opacity:1}}
            .cu-screen{position:relative;display:flex;flex-direction:column;flex:1 1 0%;min-height:0;color:var(--cu-fg);overflow:hidden;background:var(--cu-bg);}
            .cu-top{display:flex;align-items:center;gap:10px;padding:6px 14px 4px;flex-shrink:0;position:relative;z-index:2;}
            .cu-glass{width:42px;height:42px;flex-shrink:0;border-radius:999px;display:flex;align-items:center;justify-content:center;color:var(--cu-fg);background:var(--cu-soft);border:1px solid var(--cu-line);transition:transform .12s ease,background .15s ease;position:relative;}
            .cu-glass:active{transform:scale(.93);background:var(--cu-soft2);}
            .cu-glass .cu-count{position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#1e90ff;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;}
            .cu-title{flex:1;min-width:0;text-align:center;}
            .cu-title-name{font-weight:700;font-size:17px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .cu-status{display:inline-flex;align-items:center;gap:6px;margin-top:3px;font-size:12.5px;color:var(--cu-sub);font-variant-numeric:tabular-nums;}
            .cu-dot{width:7px;height:7px;border-radius:50%;background:#34d399;animation:cuPulse 1.8s infinite;}
            .cu-dot-warn{background:#fbbf24;animation-name:cuPulseWarn;}
            @keyframes cuPulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.55);}70%,100%{box-shadow:0 0 0 7px rgba(52,211,153,0);}}
            @keyframes cuPulseWarn{0%{box-shadow:0 0 0 0 rgba(251,191,36,.55);}70%,100%{box-shadow:0 0 0 7px rgba(251,191,36,0);}}
            .cu-alert{margin:6px 14px 0;padding:8px 12px;border-radius:14px;background:rgba(251,191,36,.16);color:var(--cu-alerttxt);font-size:12px;font-weight:600;flex-shrink:0;}
            .cu-adminbar{display:flex;justify-content:center;padding:6px 14px 0;flex-shrink:0;}
            .cu-pill{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;color:var(--cu-fg);font-size:13px;font-weight:700;background:var(--cu-soft);border:1px solid var(--cu-line);transition:transform .12s ease,background .15s ease;}
            .cu-pill:active{transform:scale(.96);background:var(--cu-soft2);}
            .cu-stage{flex:1 1 0%;min-height:0;position:relative;padding:8px 12px;display:flex;align-items:center;justify-content:center;}
            .cu-grid{width:100%;height:100%;display:grid;gap:10px;}
            .cu-tile{position:relative;overflow:hidden;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;text-align:left;border-radius:22px;background:var(--cu-tile);border:1px solid var(--cu-line);}
            .cu-tile video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:transparent;}
            .cu-tile video.hidden{display:none;}
            .cu-tile[data-span="2"]{grid-column:span 2;}
            .cu-tile video.object-contain{object-fit:contain;}
            .cu-bar-inner::-webkit-scrollbar{display:none;}
            .cu-avatar{color:#6b7280;width:clamp(52px,38%,96px);aspect-ratio:1;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--cu-soft2);}
            .cu-avatar.cu-avatar-lg{width:clamp(96px,34vw,150px);}
            .cu-chip{position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-size:11.5px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .cu-corner{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);color:#fff;}
            .cu-corner.cu-mute{background:rgba(239,68,68,.92);}
            .cu-corner.cu-hand{right:auto;left:8px;width:32px;height:32px;font-size:18px;line-height:1;background:var(--cu-sheet);box-shadow:0 2px 8px rgba(0,0,0,.25);}
            .cu-ring{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(120,170,255,.38);animation:cuRing 2.6s ease-out infinite;}
            @keyframes cuRing{0%{transform:scale(.86);opacity:.9;}100%{transform:scale(1.65);opacity:0;}}
            .cu-voice{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;width:100%;}
            .cu-voice-avatar-wrap{position:relative;width:clamp(150px,46vw,200px);aspect-ratio:1;display:flex;align-items:center;justify-content:center;margin-bottom:12px;}
            .cu-voice-avatar{color:#6b7280;position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 14px rgba(30,144,255,.1),0 0 0 30px rgba(30,144,255,.05);}
            .cu-voice-name{font-size:22px;font-weight:700;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .cu-voice-sub{font-size:13px;color:var(--cu-sub);display:inline-flex;align-items:center;gap:6px;}
            .cu-pip{position:absolute;top:14px;right:14px;width:27%;max-width:130px;aspect-ratio:3/4;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.2);border:1px solid var(--cu-line);background:var(--cu-tile);display:flex;align-items:center;justify-content:center;}
            .cu-pip video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
            .cu-bar{flex-shrink:0;display:flex;justify-content:center;padding:8px 12px calc(env(safe-area-inset-bottom,0px) + 22px);position:relative;z-index:2;}
            .cu-bar-inner{display:flex;align-items:flex-start;justify-content:center;gap:clamp(6px,2.4vw,16px);padding:11px 12px 9px;scrollbar-width:none;border-radius:34px;max-width:100%;overflow-x:auto;background:var(--cu-bar);border:1px solid var(--cu-line);}
            .cu-ctl{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:52px;flex-shrink:0;color:var(--cu-fg);}
            .cu-ctl-btn{width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--cu-soft2);color:var(--cu-fg);transition:transform .12s ease,background .15s ease,color .15s ease;}
            .cu-ctl:active .cu-ctl-btn{transform:scale(.92);}
            .cu-ctl-label{font-size:10.5px;font-weight:600;line-height:1;white-space:nowrap;}
            .cu-ctl.on .cu-ctl-btn{background:var(--cu-fg);color:var(--cu-bg);}
            .cu-ctl.accent .cu-ctl-btn{background:#1e90ff;color:#fff;}
            .cu-ctl.end .cu-ctl-btn{background:#ef4444;color:#fff;box-shadow:0 6px 18px rgba(239,68,68,.45);}
            .cu-ctl.end{color:var(--cu-endtxt);}
            .cu-ctl.accept .cu-ctl-btn{background:#22c55e;color:#fff;box-shadow:0 6px 18px rgba(34,197,94,.45);}
            .cu-ctl.accept{color:var(--cu-accepttxt);}
            .cu-sheet{background:var(--cu-sheet);color:var(--cu-fg);}
            .cu-paper{background:var(--cu-sheet);color:var(--cu-fg);border-radius:22px;overflow:hidden;}
            .cu-toast{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 72px);transform:translateX(-50%);z-index:99999;max-width:min(88vw,360px);padding:10px 16px;border-radius:999px;background:rgba(15,23,42,.95);color:#fff;font-size:13px;font-weight:600;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.35);pointer-events:none;animation:cuToast 3.2s ease forwards;}
            @keyframes cuToast{0%{opacity:0;transform:translate(-50%,-8px);}8%,86%{opacity:1;transform:translate(-50%,0);}100%{opacity:0;transform:translate(-50%,-6px);}}
          `;
          document.head.appendChild(st);
        }

        // Ringing screen shared by incoming calls and incoming class lectures.
        // o: { kicker, name, sub, avatar, declineAction, acceptAction, acceptIcon, acceptLabel }
        function cuIncomingHTML(o){
          ensureCallUiStyles();
          return `
            <div class="cu-screen" style="padding-top:var(--top-safe-pad);background:linear-gradient(180deg,var(--cu-blue-soft),var(--cu-bg) 60%);">
              <div class="cu-top">
                <button onclick="${o.declineAction}" title="Back" class="cu-glass">${IconBold('back', 'w-5 h-5')}</button>
                <div class="cu-title"><div class="cu-status" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:12px;">${escapeHtml(o.kicker)}</div></div>
                <div style="width:42px;height:42px;flex-shrink:0;"></div>
              </div>
              <div class="cu-stage">
                <div class="cu-voice">
                  <div class="cu-voice-avatar-wrap">
                    <span class="cu-ring"></span><span class="cu-ring" style="animation-delay:1.3s;"></span>
                    <div class="cu-voice-avatar bg-blue-50">${o.avatar}</div>
                  </div>
                  <div class="cu-voice-name">${escapeHtml(o.name)}</div>
                  <div class="cu-voice-sub" style="max-width:86%;white-space:normal;">${escapeHtml(o.sub)}</div>
                </div>
              </div>
              <div class="cu-bar">
                <div class="cu-bar-inner" style="gap:56px;padding:14px 30px 12px;">
                  ${cuCtlHTML({ onclick: o.declineAction, icon: 'phoneHangup', label: 'Decline', end: true })}
                  ${cuCtlHTML({ onclick: o.acceptAction, icon: o.acceptIcon, label: o.acceptLabel, accept: true })}
                </div>
              </div>
            </div>`;
        }

        // ---- Initials avatars (used whenever a person has no photo or their camera is off) ----
        function userInitials(name){
          const parts = String(name || '').replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
          if (!parts.length) return '';
          const first = Array.from(parts[0])[0] || '';
          const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] || '') : '';
          return (first + last).toUpperCase();
        }
        function initialsBadgeHTML(initials, sizeCls){
          const m = /w-(\d+(?:\.\d+)?)/.exec(sizeCls || '');
          const px = Math.round((m ? parseFloat(m[1]) * 4 : 48) * 0.42);
          return `<span style="font-weight:700;font-size:${px}px;line-height:1;letter-spacing:.02em;color:#4b5563;">${escapeHtml(initials)}</span>`;
        }
        // Photo if there is one, otherwise the person's initials, otherwise the plain silhouette
        function callAvatarFor(c, sizeCls){
          if (c && c.photo) return avatarInnerHTML(c, sizeCls);
          const nm = callDisplayName(c);
          const ini = (nm && nm !== 'Unknown' && nm !== 'Someone') ? userInitials(nm) : '';
          return ini ? initialsBadgeHTML(ini, sizeCls) : avatarInnerHTML(c, sizeCls);
        }
        function myCallInitials(){
          const nm = (typeof profileData !== 'undefined' && profileData) ? ((profileData.name || '').trim() || (profileData.username || '').trim()) : '';
          return userInitials(nm);
        }

        function callToast(text){
          ensureCallUiStyles();
          const el = document.createElement('div');
          el.className = 'cu-toast';
          el.textContent = text;
          document.body.appendChild(el);
          setTimeout(() => el.remove(), 3300);
        }

        // One labelled round control. o: { id, onclick, icon, label, on, end, accent, title }
        function cuCtlInnerHTML(o){
          return `<span class="cu-ctl-btn">${cuEmoji(o.icon) ? `<span style="font-size:26px;line-height:1;">${cuEmoji(o.icon)}</span>` : Icon(o.icon, 'w-6 h-6')}</span><span class="cu-ctl-label">${escapeHtml(o.label || '')}</span>`;
        }
        function cuCtlClass(o){
          return 'cu-ctl' + (o.on ? ' on' : '') + (o.accent ? ' accent' : '') + (o.accept ? ' accept' : '') + (o.end ? ' end' : '');
        }
        function cuCtlHTML(o){
          return `<button ${o.id ? `id="${o.id}"` : ''} onclick="${o.onclick}" title="${escapeHtml(o.title || o.label || '')}" class="${cuCtlClass(o)}">${cuCtlInnerHTML(o)}</button>`;
        }
        function cuPatchCtl(id, o){
          const el = document.getElementById(id);
          if (!el) return;
          el.className = cuCtlClass(o);
          el.title = o.title || o.label || '';
          el.innerHTML = cuCtlInnerHTML(o);
        }

        // One participant tile. o: { media, hasVideo, avatar, bg, name, muted, hand, onclick, style, extra, large }
        function cuTileHTML(o){
          const tag = o.onclick ? 'button' : 'div';
          return `
            <${tag} ${o.onclick ? `onclick="${o.onclick}"` : ''} ${o.speakKey ? `data-speak="${o.speakKey}"` : ''} class="cu-tile" style="${o.style || ''}">
              ${o.media || ''}
              ${!o.hasVideo ? `<div class="cu-avatar ${o.large ? 'cu-avatar-lg' : ''} ${o.bg || 'bg-blue-50'}">${o.avatar || ''}</div>` : ''}
              ${o.hand ? `<span class="cu-corner cu-hand">${cuEmoji('handRaised')}</span>` : ''}
              ${o.muted ? `<span class="cu-corner cu-mute">${Icon('micOff', 'w-3.5 h-3.5')}</span>` : ''}
              ${o.name ? `<span class="cu-chip">${escapeHtml(o.name)}</span>` : ''}
              ${o.extra || ''}
            </${tag}>`;
        }

        // Rows/columns for n tiles (portrait phones get tall single columns for 2 people)
        function cuGridLayout(n){
          const wide = window.innerWidth >= 700;
          if (n <= 1) return { cols: 1, rows: 1 };
          if (n === 2) return wide ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
          if (n <= 4) return { cols: 2, rows: 2 };
          if (n <= 6) return wide ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
          const cols = wide ? 4 : 3;
          return { cols, rows: Math.ceil(n / cols), scroll: true };
        }

        function cuGridHTML(tiles){
          const lay = cuGridLayout(tiles.length);
          const style = lay.scroll
            ? `grid-template-columns:repeat(${lay.cols},minmax(0,1fr));grid-auto-rows:minmax(130px,1fr);overflow-y:auto;align-content:start;`
            : `grid-template-columns:repeat(${lay.cols},minmax(0,1fr));grid-template-rows:repeat(${lay.rows},minmax(0,1fr));`;
          const spanLast = !lay.scroll && lay.cols === 2 && tiles.length % 2 === 1;
          return `<div class="cu-grid" style="${style}">${tiles.map((t, i) => (spanLast && i === tiles.length - 1) ? t.replace('class="cu-tile"', 'class="cu-tile" data-span="2"') : t).join('')}</div>`;
        }

        function myCallAvatarHTML(sizeCls){
          const photo = (typeof profileData !== 'undefined' && profileData) ? profileData.photo : null;
          if (!photo && myCallInitials()) return initialsBadgeHTML(myCallInitials(), sizeCls || 'w-8 h-8');
          return avatarMediaHTML(photo, 'user', sizeCls || 'w-8 h-8 text-gray-500');
        }

        // ---- Admin tools: who can mute everyone, and the signal itself ----
        // Meetings: the host + admins. Group calls: the person who created the collaboration.
        // 1:1 calls have no admin.
        function callCanMuteAll(){
          const id = callState.convoId;
          if (!id) return false;
          if (isMeetingConvo(id)) return !!(activeMeeting && activeMeeting.isAdmin);
          const meta = convoMeta[id];
          if (!meta || meta.icon !== 'users') return false;
          return meta.createdBy === 'me' || isMe(meta.createdBy);
        }

        function callAdminUserIds(){
          const id = callState.convoId;
          if (!id) return [];
          if (isMeetingConvo(id)) return (activeMeeting && activeMeeting.adminIds) || [];
          const meta = convoMeta[id];
          return (meta && meta.createdBy && meta.createdBy !== 'me') ? [meta.createdBy] : [];
        }

        function callMemberName(userId){
          const meta = convoMeta[callState.convoId] || {};
          const m = (meta.members || []).find(x => x.otherUserId === userId);
          return (m && m.name) || 'An admin';
        }

        function muteEveryoneInCall(){
          if (!callCanMuteAll()) return;
          const others = Object.values(callPeers).filter(e => e.connected);
          if (!others.length) {
            const mCode = (isMeetingConvo(callState.convoId) && activeMeeting) ? activeMeeting.code : null;
            addNotif({ type: 'info', icon: 'users', name: 'Stitch', message: 'No one else is in the call yet', convoId: mCode ? null : callState.convoId, meetingCode: mCode });
            return;
          }
          sendCallSignal({ kind: 'mute_all', userId: myCallUserId });
          others.forEach(e => { e.muted = true; });
          callToast('Muted everyone');
          refreshCallStage();
        }


        // ---- Raise hand (meetings / group calls) ----
        function toggleCallHand(){
          callState.handRaised = !callState.handRaised;
          broadcastMyCallState();
          refreshCallStage();
          callToast(callState.handRaised ? 'Hand raised' : 'Hand lowered');
        }

        // ---- Flip front/back camera (swaps the video track live, peers keep their connection) ----
        async function flipCallCamera(){
          if (!callLocalStream || callState.camOff) return;
          const next = callState.facing === 'environment' ? 'user' : 'environment';
          const old = callLocalStream.getVideoTracks()[0];
          // Most phones only let one app stream use the camera, so the old track is released first
          if (old) { callLocalStream.removeTrack(old); old.stop(); }
          let nt = null;
          try {
            const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } }, audio: false });
            nt = ns.getVideoTracks()[0];
          } catch (e1) {
            try {
              const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false });
              nt = ns.getVideoTracks()[0];
            } catch (e2) {
              try {
                const back = await navigator.mediaDevices.getUserMedia({ video: { facingMode: callState.facing === 'environment' ? 'environment' : 'user' }, audio: false });
                nt = back.getVideoTracks()[0];
              } catch (e3) { nt = null; }
              callToast("Couldn't switch camera");
              if (nt) { /* restored the previous camera */ } 
              if (!nt) return;
            }
          }
          if (!nt) return;
          callLocalStream.addTrack(nt);
          Object.values(callPeers).forEach(e => {
            const sender = e.pc && e.pc.getSenders().find(x => x.track ? x.track.kind === 'video' : false);
            if (sender) sender.replaceTrack(nt).catch(() => {});
          });
          if (nt.getSettings && nt.getSettings().facingMode) callState.facing = nt.getSettings().facingMode === 'environment' ? 'environment' : 'user';
          else callState.facing = next;
          applyCallTrackStates();
          attachCallLocalVideo();
        }

        // ---- Speaking ring: green outline on whoever is talking (calls, meetings and lectures) ----
        let cuAudioCtx = null;
        const cuSpeakProbes = {};
        const cuSpeakLast = {};
        function cuSpeakLevel(key, stream){
          if (!stream || !stream.getAudioTracks().length) return 0;
          const id = key + ':' + stream.id;
          let pr = cuSpeakProbes[id];
          if (!pr) {
            try {
              const Ctx = window.AudioContext || window.webkitAudioContext;
              if (!Ctx) return 0;
              cuAudioCtx = cuAudioCtx || new Ctx();
              if (cuAudioCtx.state === 'suspended') cuAudioCtx.resume().catch(() => {});
              const an = cuAudioCtx.createAnalyser();
              an.fftSize = 512;
              cuAudioCtx.createMediaStreamSource(stream).connect(an);
              pr = cuSpeakProbes[id] = { an, buf: new Uint8Array(an.fftSize), key };
            } catch (e) { return 0; }
          }
          pr.an.getByteTimeDomainData(pr.buf);
          let sum = 0;
          for (let i = 0; i < pr.buf.length; i++) { const v = (pr.buf[i] - 128) / 128; sum += v * v; }
          return Math.sqrt(sum / pr.buf.length);
        }
        function cuSpeakTick(){
          const srcs = [];
          if (typeof callState !== 'undefined' && callState && callState.convoId) {
            if (callLocalStream) srcs.push(['local', callLocalStream, !!callState.muted]);
            Object.keys(callPeers).forEach(pid => { const e = callPeers[pid]; if (e && e.stream) srcs.push([pid, e.stream, !!e.muted]); });
          }
          if (typeof liveLectureState !== 'undefined' && liveLectureState.connected) {
            if (typeof lectureLocalStream !== 'undefined' && lectureLocalStream) srcs.push(['local', lectureLocalStream, !!liveLectureState.muted]);
            if (typeof lectureRemoteStreams !== 'undefined') Object.keys(lectureRemoteStreams).forEach(pid => {
              const p = (typeof lecturePresence !== 'undefined' && lecturePresence[pid]) || {};
              srcs.push([pid, lectureRemoteStreams[pid], !!p.muted]);
            });
          }
          const now = Date.now(), live = {};
          srcs.forEach(([key, stream, muted]) => {
            live[key + ':' + stream.id] = true;
            if (!muted && cuSpeakLevel(key, stream) > 0.035) cuSpeakLast[key] = now;
            if (muted) cuSpeakLast[key] = 0;
          });
          Object.keys(cuSpeakProbes).forEach(id => { if (!live[id]) delete cuSpeakProbes[id]; });
          document.querySelectorAll('[data-speak]').forEach(el => {
            el.classList.toggle('cu-speaking', now - (cuSpeakLast[el.getAttribute('data-speak')] || 0) < 600);
          });
        }
        setInterval(cuSpeakTick, 250);

        function broadcastMyCallState(){
          sendCallSignal({ kind: 'state', muted: !!callState.muted, camOff: !!callState.camOff, hand: !!callState.handRaised });
        }

        function refreshCallStage(){
          const stage = document.getElementById('call-stage-wrap');
          if (!stage) return;
          stage.innerHTML = callStageHTML();
          attachCallLocalVideo();
          attachCallRemoteVideo();
        }

        function refreshCallControls(){
          const bar = document.getElementById('call-controls-bar');
          if (bar) bar.innerHTML = callControlsHTML();
        }

        // ---- Stage (1:1 and group) ----
        function callStageHTML(){
          const meta = convoMeta[callState.convoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Unknown' };
          const isVideo = callState.type === 'video';
          const showLocalVideo = isVideo && callLocalStream && !callState.camOff && !callState.mediaError;

          if (isGroupCallConvo(callState.convoId)) return groupCallStageHTML(meta, isVideo, showLocalVideo);

          const entry = Object.values(callPeers)[0];
          const remoteStream = entry && entry.stream;
          const speakKey = Object.keys(callPeers)[0] || '';
          const peerMuted = !!(entry && entry.muted);
          const peerCamOff = !!(entry && entry.camOff);

          if (callState.connected) {
            const showRemoteVideo = isVideo && remoteStream && remoteStream.getVideoTracks().length > 0 && !peerCamOff;

            if (isVideo) {
              const pip = `
                <div class="cu-pip" data-speak="local">
                  ${showLocalVideo ? `<span class="cu-flip" title="Flip camera" style="right:6px;bottom:6px;width:28px;height:28px;" onclick="event.stopPropagation();flipCallCamera()"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg></span>` : ''}
                  <video id="call-local-video" autoplay playsinline muted class="${showLocalVideo ? '' : 'hidden'}" style="transform:scaleX(-1);"></video>
                  ${!showLocalVideo ? (callState.mediaError ? `<span class="text-white/70 text-[10px] font-semibold text-center px-2">${escapeHtml(callState.mediaError)}</span>` : `<span class="cu-avatar ${'bg-blue-100'}" style="width:56%;">${myCallAvatarHTML('w-12 h-12')}</span>`) : ''}
                  ${callState.muted ? `<span class="cu-corner cu-mute" style="top:6px;right:6px;width:22px;height:22px;">${Icon('micOff', 'w-3 h-3')}</span>` : ''}
                </div>`;
              return `
                <div class="cu-tile" data-speak="${speakKey}" style="width:100%;height:100%;border-radius:26px;">
                  <video id="call-remote-video" autoplay playsinline class="${showRemoteVideo ? '' : 'hidden'}"></video>
                  ${!showRemoteVideo ? `<div class="cu-avatar cu-avatar-lg ${meta.avatarBg || 'bg-gray-100'}">${callAvatarFor(meta, 'w-12 h-12')}</div>` : ''}
                  ${entry ? `<span class="cu-chip" style="left:12px;top:12px;bottom:auto;">${escapeHtml(callDisplayName(meta))}${peerMuted ? ' · Muted' : ''}</span>` : ''}
                  ${pip}
                </div>`;
            }

            return `
              <div class="cu-voice">
                <div class="cu-voice-avatar-wrap">
                  <span class="cu-ring"></span><span class="cu-ring" style="animation-delay:1.3s;"></span>
                  <div class="cu-voice-avatar ${meta.avatarBg || 'bg-gray-100'}">${callAvatarFor(meta, 'w-16 h-16')}</div>
                </div>
                <div class="cu-voice-name">${escapeHtml(callDisplayName(meta))}</div>
                <div class="cu-voice-sub">${peerMuted ? `${Icon('micOff', 'w-3.5 h-3.5')} Muted` : 'Voice call'}</div>
                <audio id="call-remote-audio" autoplay playsinline class="hidden"></audio>
              </div>`;
          }

          // Ringing / connecting
          if (showLocalVideo) {
            return `
              <div class="cu-tile" data-speak="${speakKey}" style="width:100%;height:100%;border-radius:26px;">
                <video id="call-local-video" autoplay playsinline muted style="transform:scaleX(-1);"></video>
                <span class="cu-chip">You</span>
              </div>`;
          }
          return `
            <div class="cu-voice">
              <div class="cu-voice-avatar-wrap">
                <span class="cu-ring"></span><span class="cu-ring" style="animation-delay:1.3s;"></span>
                <div class="cu-voice-avatar ${meta.avatarBg || 'bg-gray-100'}">${callAvatarFor(meta, 'w-16 h-16')}</div>
              </div>
              <div class="cu-voice-name">${escapeHtml(callDisplayName(meta))}</div>
            </div>`;
        }

        // Which participant (if any) is pinned full screen inside a group call
        let groupCallFullscreenId = null;

        function openGroupCallFullscreen(id){
          groupCallFullscreenId = id;
          refreshCallStage();
        }

        function closeGroupCallFullscreen(){
          groupCallFullscreenId = null;
          refreshCallStage();
        }

        function groupCallStageHTML(meta, isVideo, showLocalVideo){
          const connected = Object.keys(callPeers)
            .map(pid => ({ peerId: pid, ...callPeers[pid] }))
            .filter(e => e.connected && e.stream);
          const others = (meta.members || []).filter(m => !m.mine);

          function memberFor(userId){
            return others.find(m => m.otherUserId === userId) || { name: 'Someone', avatarBg: 'bg-gray-100', icon: 'user' };
          }

          function remoteSpec(e){
            const m = memberFor(e.userId);
            const hasVideo = isVideo && e.stream.getVideoTracks().length > 0 && !e.camOff;
            return {
              // The <audio> element carries the sound, so the video element stays muted (no doubled audio)
              media: `<video id="call-remote-video-${e.peerId}" autoplay playsinline muted class="${hasVideo ? '' : 'hidden'}"></video>
                      <audio id="call-remote-audio-${e.peerId}" autoplay playsinline class="hidden"></audio>`,
              hasVideo, avatar: callAvatarFor(m, 'w-12 h-12'), bg: m.avatarBg || 'bg-gray-100',
              name: m.name, muted: !!e.muted, hand: !!e.hand, speakKey: e.peerId
            };
          }
          function localSpec(){
            return {
              media: showLocalVideo ? `<video id="call-local-video" autoplay playsinline muted style="transform:scaleX(-1);"></video>` : '',
              hasVideo: !!showLocalVideo, avatar: myCallAvatarHTML('w-12 h-12 text-gray-500'), bg: 'bg-blue-100',
              name: 'You', muted: !!callState.muted, hand: !!callState.handRaised, speakKey: 'local',
              extra: showLocalVideo ? `<span class="cu-flip" title="Flip camera" onclick="event.stopPropagation();flipCallCamera()"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg></span>` : ''
            };
          }

          // Whoever was pinned full screen may have since left the call -- fall back to the grid.
          if (groupCallFullscreenId && groupCallFullscreenId !== 'local' && !connected.some(e => e.peerId === groupCallFullscreenId)) {
            groupCallFullscreenId = null;
          }

          if (groupCallFullscreenId) {
            const isLocalPinned = groupCallFullscreenId === 'local';
            const pinnedEntry = isLocalPinned ? null : connected.find(e => e.peerId === groupCallFullscreenId);
            const spec = isLocalPinned ? localSpec() : remoteSpec(pinnedEntry);
            const back = `<button onclick="closeGroupCallFullscreen()" title="Back to grid" class="cu-glass" style="position:absolute;top:10px;left:10px;width:38px;height:38px;">${IconBold('back', 'w-5 h-5')}</button>`;
            // Everyone else's audio must keep playing while one person is pinned
            const otherSinks = connected.filter(e => e.peerId !== groupCallFullscreenId)
              .map(e => `<audio id="call-remote-audio-${e.peerId}" autoplay playsinline class="hidden"></audio>`).join('');
            return `
              <div style="width:100%;height:100%;">
                ${cuTileHTML(Object.assign(spec, { large: true, style: 'width:100%;height:100%;border-radius:26px;', extra: (spec.extra || '') + back }))}
                <div class="hidden">${otherSinks}</div>
              </div>`;
          }

          const tileCount = connected.length + 1;

          // Nobody else has joined yet
          if (tileCount <= 1) {
            return cuTileHTML(Object.assign(localSpec(), {
              large: true, onclick: "openGroupCallFullscreen('local')", style: 'width:100%;height:100%;border-radius:26px;',
              extra: (localSpec().extra || '') + `<div style="position:absolute;left:0;right:0;top:16px;text-align:center;font-size:12.5px;color:var(--cu-sub);">Waiting for others to join…</div>`
            }));
          }

          const tiles = [cuTileHTML(Object.assign(localSpec(), { onclick: "openGroupCallFullscreen('local')" }))]
            .concat(connected.map(e => cuTileHTML(Object.assign(remoteSpec(e), { onclick: `openGroupCallFullscreen('${e.peerId}')` }))));

          const waitingCount = others.length - connected.length;
          return `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;gap:8px;min-height:0;">
              <div style="flex:1 1 0%;min-height:0;">${cuGridHTML(tiles)}</div>
              ${waitingCount > 0 ? `<div style="text-align:center;font-size:12px;color:var(--cu-sub);flex-shrink:0;">Waiting on ${waitingCount} more member${waitingCount === 1 ? '' : 's'}…</div>` : ''}
            </div>`;
        }

        function callControlsHTML(){
          const isVideo = callState.type === 'video';
          const isMeetingCall = isMeetingConvo(callState.convoId);
          const ctls = [];
          ctls.push(cuCtlHTML({ id: 'call-mute-btn', onclick: "toggleCallControl('muted')", icon: callState.muted ? 'micOff' : 'mic', label: callState.muted ? 'Unmute' : 'Mute', on: callState.muted }));
          if (isVideo) {
            ctls.push(cuCtlHTML({ id: 'call-secondary-btn', onclick: "toggleCallControl('camOff')", icon: callState.camOff ? 'cameraOff' : 'video', label: callState.camOff ? 'Start video' : 'Camera', on: callState.camOff }));
          } else {
            ctls.push(cuCtlHTML({ id: 'call-secondary-btn', onclick: "toggleCallControl('speaker')", icon: 'volume', label: 'Speaker', on: callState.speaker }));
          }
          if (isMeetingCall) {
            ctls.push(cuCtlHTML({ id: 'meeting-more-btn', onclick: 'toggleMeetingMenu()', icon: 'dashesShortRight', label: 'More', on: !!meetingSheet }));
          } else {
            ctls.push(cuCtlHTML({ onclick: 'openAddToCall()', icon: 'personPlus', label: 'Add' }));
          }
          ctls.push(cuCtlHTML({ onclick: 'endCall()', icon: 'phoneHangup', label: isMeetingCall ? 'Leave' : 'End', end: true, title: isMeetingCall ? 'Leave meeting' : 'End call' }));
          return `<div class="cu-bar-inner">${ctls.join('')}</div>`;
        }

        function callAdminBarHTML(){
          if (!callState.connected || !callCanMuteAll()) return '';
          if (!Object.values(callPeers).some(e => e.connected)) return '';
          return `<div id="call-admin-bar" class="cu-adminbar"><button onclick="muteEveryoneInCall()" class="cu-pill">${Icon('muteAll', 'w-4 h-4')}<span>Mute everyone</span></button></div>`;
        }

        function callHTML(){
          ensureCallUiStyles();
          const meta = convoMeta[callState.convoId] || { icon: 'user', avatarBg: 'bg-gray-100', name: 'Unknown' };
          const isVideo = callState.type === 'video';
          const isGroup = isGroupCallConvo(callState.convoId);
          const isMeetingCall = isMeetingConvo(callState.convoId);
          const peopleCount = Object.values(callPeers).filter(e => e.connected).length + 1;
          let statusHTML;
          if (callState.statusOverride) {
            statusHTML = `${escapeHtml(callState.statusOverride)}`;
          } else if (callState.connected) {
            statusHTML = `${(isMeetingCall || isGroup) ? `${peopleCount} in ${isMeetingCall ? 'meeting' : 'call'} · ` : ''}<span id="call-timer">${formatCallTime(callState.seconds)}</span>`;
          } else {
            statusHTML = `${isVideo ? 'Video calling…' : 'Calling…'}`;
          }
          const headRight = isMeetingCall
            ? `<button onclick="shareActiveMeetingLink()" title="Share meeting link" class="cu-glass">${Icon('link', 'w-5 h-5')}</button>`
            : `<div style="width:42px;height:42px;flex-shrink:0;"></div>`;
          return `
            <div id="call-screen" class="cu-screen" style="padding-top:var(--top-safe-pad);">
              <div id="call-header" class="cu-top">
                <button onclick="minimizeCall()" title="Back" class="cu-glass">${IconBold('back', 'w-5 h-5')}</button>
                <div class="cu-title">
                  <div id="call-display-name" class="cu-title-name">${escapeHtml(callDisplayName(meta))}</div>
                  <div class="cu-status">${statusHTML}</div>
                </div>
                ${headRight}
              </div>
              ${callState.mediaError && isVideo ? `<div class="cu-alert">${escapeHtml(callState.mediaError)}</div>` : ''}
              ${callAdminBarHTML()}
              <div class="cu-stage" id="call-stage-wrap">${callStageHTML()}</div>
              <div id="call-controls-bar" class="cu-bar">${callControlsHTML()}</div>
              ${isMeetingCall ? meetingOverlaysHTML() : ''}
            </div>`;
        }


        // =====================================================================
        // MEETINGS -- standalone calls (not tied to a class or a group chat).
        // Create from the "+" button -> Live or Scheduled -> share the link. Anyone signed in
        // who opens the link lands on a join screen and then the normal call screen.
        // Backend (live Supabase): meetings + meeting_members tables and the RPCs create_meeting,
        // get_meeting_by_code, join_meeting, end_meeting, set_meeting_reminder, list_my_meetings.
        // They return camelCase JSON and raise errors; normalizeMeeting() below converts that to the
        // flat shape the screens use. Admin notifications, push and reminders are sent by the database
        // (process_meeting_reminders runs every minute), so the app does not send them itself.
        // Calls reuse the same WebRTC-over-Supabase-broadcast
        // signaling as group calls, on the channel `call:meeting:<code>`.
        // =====================================================================
        let meetingDraft = { kind: 'live', title: '', date: '', time: '', admins: [], search: '' };
        let meetingCreated = null;        // result of create_meeting, shown on the "ready" screen
        let meetingSubmitting = false;
        let pendingMeetingCode = null;    // code from an opened link / tapped meeting
        let pendingMeetingInfo = null;    // get_meeting_by_code result (null while loading)
        let pendingMeetingError = null;   // 'not_found' | 'offline' | null
        let meetingJoinPollTimer = null;
        let meetingJoinCamOn = true;
        let meetingJoinPreviewStream = null;
        function stopMeetingJoinPreview(){
          if (meetingJoinPreviewStream) {
            try { meetingJoinPreviewStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            meetingJoinPreviewStream = null;
          }
        }
        async function syncMeetingJoinPreview(){
          const v = document.getElementById('mj-preview-video');
          if (!v || currentOverlayKind !== 'meetingJoin') { stopMeetingJoinPreview(); return; }
          if (!meetingJoinCamOn) { stopMeetingJoinPreview(); v.srcObject = null; return; }
          if (!meetingJoinPreviewStream) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
            try {
              const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
              if (!meetingJoinCamOn || currentOverlayKind !== 'meetingJoin') { st.getTracks().forEach(t => t.stop()); return; }
              meetingJoinPreviewStream = st;
            } catch (e) { return; }
          }
          const cur = document.getElementById('mj-preview-video');
          if (cur && cur.srcObject !== meetingJoinPreviewStream) { cur.srcObject = meetingJoinPreviewStream; try { cur.play(); } catch (e) {} }
        }
        function toggleMeetingJoinCamera(){
          meetingJoinCamOn = !meetingJoinCamOn;
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'meetingJoin') ov.innerHTML = meetingJoinHTML();
        }
        let meetingJoinStep = 'info';     // 'info' | 'camera' (asks how to join before entering)
        let myUpcomingMeetings = null;    // list_my_meetings result for the "+" menu (null = loading)
        let activeMeeting = null;         // the meeting currently on the call screen
        let meetingEndTimer = null;

        function isMeetingConvo(id){
          return typeof id === 'string' && id.indexOf('meeting:') === 0;
        }

        // Converts the database's meeting JSON into the flat shape used by the screens below.
        // Meetings last duration_min (60) minutes from their start; "state" is worked out here.
        function normalizeMeeting(j){
          if (!j || !j.code) return null;
          const startMs = new Date(j.startsAt).getTime();
          const endMs = startMs + (Number(j.durationMin) || 60) * 60000;
          const now = Date.now();
          let state;
          if (j.status === 'ended' || now >= endMs) state = 'ended';
          else if (j.status === 'live' || now >= startMs - 5 * 60000) state = 'live';   // joinable 5 min before a scheduled start
          else state = 'upcoming';
          const role = j.myRole || null;
          return {
            id: j.id, code: j.code, title: j.title, kind: j.kind,
            starts_at: j.startsAt, ends_at: new Date(endMs).toISOString(), state,
            host_id: j.hostId, host_name: j.hostName || j.hostUsername || null,
            is_host: role === 'host', is_admin: role === 'host' || role === 'admin',
            admin_ids: (j.admins || []).map(a => a.id),
            reminded: !!j.remind,
          };
        }

        function buildMeetingLink(code){
          return window.location.origin + window.location.pathname + '?meeting=' + encodeURIComponent(code);
        }

        function meetingWhenText(iso){
          const d = new Date(iso);
          if (isNaN(d)) return '';
          const now = new Date();
          const sameDay = d.toDateString() === now.toDateString();
          const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          if (sameDay) return 'Today at ' + time;
          if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow at ' + time;
          return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ' at ' + time;
        }

        function meetingLocalDateParts(iso){
          const d = new Date(iso);
          const p = n => String(n).padStart(2, '0');
          return { date: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), time: p(d.getHours()) + ':' + p(d.getMinutes()) };
        }

        // ---- Step 1: "+" -> Post or Meeting ----
        // "New meeting" goes back to the Meetings page when it was opened from there,
        // otherwise (opened from the inbox menu) back to the page you were on.
        let meetingKindFromMeetings = false;
        function meetingKindBack(){
          if (meetingKindFromMeetings) openCreateMenu(); else closeOverlay();
        }
        function openCreateMenu(){
          openOverlay('createMenu');
          loadMyUpcomingMeetings();
        }

        // Header + cards share the look of the "New collaboration" screen
        function meetingScreenHeader(title, backAction){
          return `
            <div class="px-5 pb-3 border-b border-gray-100 flex-shrink-0" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center gap-3">
                <button onclick="${backAction}" class="flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="flex-1 min-w-0 font-semibold text-lg font-display truncate grad-text" style="text-align:right;">${title}</div>
              </div>
            </div>`;
        }

        function meetingChoiceCard(onclick, title, desc, detail){
          return `
            <button onclick="${onclick}" class="collab-type-card w-full text-left rounded-2xl border border-gray-200 bg-white p-4 mb-3 block" style="box-shadow:0 1px 3px rgba(0,0,0,0.04);">
              <div class="font-display font-semibold text-[17px] text-gray-900">${title}</div>
              <div class="text-sm text-gray-500 mt-0.5 leading-snug">${desc}</div>
              ${detail ? `<p class="text-xs text-gray-400 mt-2 leading-relaxed">${detail}</p>` : ''}
            </button>`;
        }

        function createMenuHTML(){
          const upcoming = (myUpcomingMeetings || []);
          return `
            <div class="flex-1 overflow-y-auto">
            ${meetingScreenHeader('Create something', 'closeOverlay()')}
            <div class="px-5" style="padding-top:20px;padding-bottom:24px;">
              <div class="text-sm text-gray-500 mb-4">What would you like to create?</div>
              ${meetingChoiceCard("meetingKindFromMeetings=true;openOverlay('meetingKind')", 'Create a meeting', 'Start a live call or schedule one for later.', 'Share the link so anyone can join you.')}
              ${upcoming.length ? `
                <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-6 mb-2">Your meetings</div>
                ${upcoming.map(m => `
                  <div class="w-full rounded-2xl border border-gray-200 bg-white mb-3 overflow-hidden" style="box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                    <button onclick="openMeetingByCode('${escapeHtml(m.code)}')" class="w-full p-4 text-left">
                      <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(m.title)}</div>
                      <div class="text-xs text-gray-400">${escapeHtml(meetingWhenText(m.starts_at))}${m.is_host ? '' : (m.is_admin ? ' · Admin' : ' · Reminder on')}</div>
                    </button>
                    <div class="flex border-t border-gray-100">
                      <button onclick="copyMeetingLink('${escapeHtml(m.code)}')" class="flex-1 py-2.5 text-xs font-semibold" style="color:${NAVY};">Copy link</button>
                      <button onclick="shareMeetingLink('${escapeHtml(m.code)}', '${escapeHtml(m.title).replace(/'/g, '&#39;')}')" class="flex-1 py-2.5 text-xs font-semibold border-l border-gray-100" style="color:${NAVY};">Share</button>
                    </div>
                    ${m.is_admin ? `<button onclick="confirmEndMeetingFromList('${escapeHtml(m.code)}')" class="w-full py-2.5 text-xs font-semibold border-t border-gray-100" style="color:#ef4444;">${m.state === 'live' ? 'End meeting' : 'Cancel meeting'}</button>` : ''}
                  </div>`).join('')}` : ''}
            </div>
            </div>`;
        }

        function confirmEndMeetingFromList(code){
          const m = (myUpcomingMeetings || []).find(x => x.code === code);
          if (!m) return;
          const live = m.state === 'live';
          openAppConfirmModal(live ? 'End this meeting?' : 'Cancel this meeting?', live ? 'Anyone in the call will be removed.' : 'It will no longer be available to join.', live ? 'End meeting' : 'Cancel meeting', async () => {
            const sb = getSupabaseClient();
            if (!sb) { openAppAlertModal("Couldn't reach the server. Check your connection and try again."); return; }
            try {
              const { error } = await sb.rpc('end_meeting', { p_meeting: m.id });
              if (error) throw error;
              myUpcomingMeetings = (myUpcomingMeetings || []).filter(x => x.code !== code);
              if (currentOverlayKind === 'createMenu') { const ov = document.getElementById('overlay'); if (ov) ov.innerHTML = createMenuHTML(); }
              loadMyUpcomingMeetings();
            } catch (e) {
              console.warn('end_meeting failed:', e);
              openAppAlertModal("Couldn't end the meeting. Please try again.");
            }
          }, 'phoneHangup');
        }

        async function loadMyUpcomingMeetings(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data, error } = await sb.rpc('list_my_meetings');
            if (error || !Array.isArray(data)) return;
            // Meetings I host or administer, plus scheduled ones I asked to be reminded about
            myUpcomingMeetings = data.map(normalizeMeeting)
              .filter(m => m && m.state !== 'ended' && (m.is_admin || (m.kind === 'scheduled' && m.reminded)));
            if (currentOverlayKind === 'createMenu') {
              const ov = document.getElementById('overlay');
              if (ov) ov.innerHTML = createMenuHTML();
            }
          } catch (e) { /* the menu simply shows no list */ }
        }

        // ---- Step 2: Live or Scheduled ----
        function meetingKindHTML(){
          return `
            ${meetingScreenHeader('New meeting', 'meetingKindBack()')}
            <div class="flex-1 overflow-y-auto px-5" style="padding-top:20px;">
              <div class="text-sm text-gray-500 mb-4">What kind of meeting do you want to create?</div>
              ${meetingChoiceCard("chooseMeetingKind('live')", 'Live meeting', 'Start right now and share the link.', 'You join the call straight away. Anyone with the link can join you.')}
              ${meetingChoiceCard("chooseMeetingKind('scheduled')", 'Scheduled meeting', 'Pick a date and time.', 'People who open the link can ask for a reminder before it starts.')}
            </div>`;
        }

        function chooseMeetingKind(kind){
          meetingDraft = { kind, title: '', date: '', time: '', admins: [], search: '' };
          openOverlay('newMeeting');
        }

        // ---- Step 3: details + contributors (admins) ----
        function newMeetingHTML(){
          const scheduled = meetingDraft.kind === 'scheduled';
          return `
            ${meetingScreenHeader(scheduled ? 'Schedule meeting' : 'Live meeting', "openOverlay('meetingKind')")}
            <div class="p-5 flex-1 overflow-y-auto no-scrollbar">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Meeting title</label>
              <input type="text" id="meeting-title-input" maxlength="120" value="${escapeHtml(meetingDraft.title)}" oninput="meetingDraft.title=this.value" placeholder="e.g. Physics revision session" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm mb-4">
              ${scheduled ? `
                <div class="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
                    <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" value="${escapeHtml(meetingDraft.date)}" oninput="this.value=formatTypedDateDigits(this.value);meetingDraft.date=this.value" id="meeting-date-input" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm">
                    ${typedDateHintHTML()}
                  </div>
                  <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Time</label>
                    <input type="time" id="meeting-time-input" value="${escapeHtml(meetingDraft.time)}" oninput="meetingDraft.time=this.value" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm">
                  </div>
                </div>` : ''}
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Contributors <span class="font-normal text-gray-400">(optional)</span></label>
              <div class="text-xs text-gray-400 mb-2 leading-relaxed">Contributors are admins of this meeting. They get a notification and can end the meeting for everyone.</div>
              <div id="meeting-admin-chips" class="flex flex-wrap gap-x-3 gap-y-3 ${meetingDraft.admins.length ? 'mt-3 mb-5' : 'hidden'}">${meetingAdminChipsHTML()}</div>
              <input type="text" id="meeting-admin-search" value="${escapeHtml(meetingDraft.search)}" oninput="onMeetingAdminSearch(this.value)" placeholder="Search people to add" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm mb-2">
              <div id="meeting-admin-list" class="rounded-2xl overflow-y-auto no-scrollbar" style="max-height:15rem;">${meetingAdminListHTML()}</div>
            </div>
            <div class="flex-shrink-0 w-full" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
              <button id="meeting-submit-btn" onclick="submitNewMeeting()" class="w-full font-semibold py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${scheduled ? 'Schedule meeting' : 'Start meeting'}</button>
            </div>`;
        }

        function meetingAdminChipsHTML(){
          return meetingDraft.admins.map(a => `
            <span class="inline-flex items-center gap-2 bg-blue-50 text-[${NAVY}] text-xs font-semibold rounded-full pl-4 pr-3 py-2.5">
              ${escapeHtml(a.name)}
              <button onclick="toggleMeetingAdmin('${escapeHtml(String(a.id))}')" class="flex items-center" title="Remove">${Icon('close', 'w-3.5 h-3.5')}</button>
            </span>`).join('');
        }

        function meetingAdminListHTML(){
          if (!discoverPeopleLoaded) return `<div class="text-center text-gray-400 text-sm py-6">Loading people...</div>`;
          const q = (meetingDraft.search || '').trim().toLowerCase().replace(/^@/, '');
          let list = discoverPeople.filter(p => (p.username || '').trim() || (p.name || '').trim());
          if (q) list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q));
          list = list.slice(0, 40);
          if (!list.length) return `<div class="text-center text-gray-400 text-sm py-6">No one found${q ? ` for "${escapeHtml(meetingDraft.search)}"` : ''}.</div>`;
          return list.map(p => {
            const on = meetingDraft.admins.some(a => a.id === p.id);
            const avatar = p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : Icon('user', 'w-4 h-4');
            return `
              <button onclick="toggleMeetingAdmin('${escapeHtml(String(p.id))}')" class="w-full flex items-center gap-3 py-2.5 px-1 text-left">
                <span class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${p.avatarBg || 'bg-blue-50'} text-[${NAVY}]">${avatar}</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-gray-800 truncate">${escapeHtml(p.name)}</span>
                  ${p.username ? `<span class="block text-xs text-gray-400 truncate">@${escapeHtml(p.username)}</span>` : ''}
                </span>
                <span class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style="${on ? `background:${ROYAL};border:2px solid ${ROYAL};` : 'border:2px solid #d1d5db;'}">${on ? '<svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : ''}</span>
              </button>`;
          }).join('');
        }

        let meetingPeopleWaitTimer = null;
        function waitForMeetingPeople(){
          if (meetingPeopleWaitTimer) clearInterval(meetingPeopleWaitTimer);
          let tries = 0;
          meetingPeopleWaitTimer = setInterval(() => {
            tries++;
            if (currentOverlayKind !== 'newMeeting' || tries > 30) { clearInterval(meetingPeopleWaitTimer); meetingPeopleWaitTimer = null; return; }
            if (discoverPeopleLoaded) {
              clearInterval(meetingPeopleWaitTimer); meetingPeopleWaitTimer = null;
              const list = document.getElementById('meeting-admin-list');
              if (list) list.innerHTML = meetingAdminListHTML();
            }
          }, 400);
        }

        function onMeetingAdminSearch(val){
          meetingDraft.search = val;
          const list = document.getElementById('meeting-admin-list');
          if (list) list.innerHTML = meetingAdminListHTML();
        }

        function toggleMeetingAdmin(id){
          const idx = meetingDraft.admins.findIndex(a => String(a.id) === String(id));
          if (idx >= 0) meetingDraft.admins.splice(idx, 1);
          else {
            const p = discoverPeople.find(x => String(x.id) === String(id));
            if (!p) return;
            if (meetingDraft.admins.length >= 20) { openAppAlertModal('You can add up to 20 contributors.'); return; }
            meetingDraft.admins.push({ id: p.id, name: p.name || p.username || 'Stitch member' });
          }
          const chips = document.getElementById('meeting-admin-chips');
          if (chips) { chips.innerHTML = meetingAdminChipsHTML(); chips.classList.toggle('hidden', !meetingDraft.admins.length); chips.classList.toggle('mb-5', !!meetingDraft.admins.length); chips.classList.toggle('mt-3', !!meetingDraft.admins.length); }
          const list = document.getElementById('meeting-admin-list');
          if (list) list.innerHTML = meetingAdminListHTML();
        }

        async function submitNewMeeting(){
          if (meetingSubmitting) return;
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal("Couldn't create the meeting right now. Check your connection and try again."); return; }
          const title = (meetingDraft.title || '').trim();
          if (!title) { openAppAlertModal('Please give the meeting a title.'); return; }
          let startsAtIso = null;
          if (meetingDraft.kind === 'scheduled') {
            if (!meetingDraft.date || !meetingDraft.time) { openAppAlertModal('Please choose the date and time.'); return; }
            const parsed = parseTypedDateDDMMYYYY(meetingDraft.date);
            if (parsed.error || !parsed.iso) { openAppAlertModal(parsed.error || 'Please enter the date as DD/MM/YYYY.'); return; }
            const when = new Date(parsed.iso + 'T' + meetingDraft.time);
            if (isNaN(when)) { openAppAlertModal('That date or time is not valid.'); return; }
            if (when.getTime() < Date.now() - 60000) { openAppAlertModal('Please pick a time in the future.'); return; }
            startsAtIso = when.toISOString();
          }
          meetingSubmitting = true;
          const btn = document.getElementById('meeting-submit-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
          try {
            const { data, error } = await sb.rpc('create_meeting', {
              p_title: title,
              p_description: null,
              p_kind: meetingDraft.kind,
              p_starts_at: startsAtIso,
              p_duration_min: 60,
              p_admin_ids: meetingDraft.admins.map(a => a.id),
            });
            const created = error ? null : normalizeMeeting(data);
            if (!created) {
              console.warn('create_meeting failed:', error || data);
              if (error && /start_must_be_in_future/.test(error.message || '')) openAppAlertModal('Please pick a time in the future.');
              else openAppAlertModal("Couldn't create the meeting. Please try again.");
              return;
            }
            meetingCreated = { code: created.code, title: created.title, kind: created.kind, starts_at: created.starts_at, ends_at: created.ends_at };
            // Contributors are notified (in-app + push) by the database inside create_meeting.
            if (created.kind === 'live') {
              // Ask camera on/off before entering: same pre-join screen everyone else gets
              pendingMeetingCode = created.code;
              pendingMeetingInfo = Object.assign({ status: 'ok', is_host: true, is_admin: true }, created);
              pendingMeetingError = null;
              meetingJoinStep = 'info';
              meetingJoinCamOn = true;
              openOverlay('meetingJoin');
              pushInAppNotification('Meeting link ready', 'Tap the link button on the call screen to share it.');
            } else {
              ensureNotificationPermission();
              openOverlay('meetingCreated');
            }
          } catch (e) {
            console.warn('create_meeting threw:', e);
            openAppAlertModal("Couldn't create the meeting. Please try again.");
          } finally {
            meetingSubmitting = false;
            const b = document.getElementById('meeting-submit-btn');
            if (b) { b.disabled = false; b.style.opacity = ''; }
          }
        }

        // ---- Step 4 (scheduled): "ready" screen with the link ----
        function meetingCreatedHTML(){
          const m = meetingCreated;
          if (!m) return '';
          const link = buildMeetingLink(m.code);
          const pill = 'w-full max-w-sm font-semibold py-3 rounded-full text-sm font-display';
          const grey = 'background:var(--cu-soft,#eef0f3);color:var(--cu-fg,#374151);border:1px solid var(--cu-line,#e2e8f0);';
          return `
            ${meetingScreenHeader('Meeting scheduled', 'openCreateMenu()')}
            <div class="flex-1 overflow-y-auto px-6 flex flex-col items-center text-center" style="padding-top:28px;">
              <div class="text-base font-semibold mb-1 break-words max-w-full">${escapeHtml(m.title)}</div>
              <div class="text-sm text-gray-500 mb-6">${escapeHtml(meetingWhenText(m.starts_at))}</div>
              <div class="w-full max-w-sm rounded-2xl px-4 py-3 text-xs break-all text-left mb-3" style="background:var(--cu-soft,#f1f5f9);color:var(--cu-sub,#64748b);border:1px solid var(--cu-line,#e2e8f0);">${escapeHtml(link)}</div>
              <div class="w-full max-w-sm flex gap-3 mb-3">
                <button onclick="copyMeetingLink('${escapeHtml(m.code)}')" class="flex-1 font-semibold py-3 rounded-full text-sm font-display" style="${grey}">Copy link</button>
                <button onclick="shareMeetingLink('${escapeHtml(m.code)}')" class="flex-1 font-semibold py-3 rounded-full text-sm font-display" style="${grey}">Share</button>
              </div>
              <button onclick="addMeetingToCalendar()" class="${pill} mt-6 mb-4 text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Add to calendar</button>
              <div class="text-xs text-gray-400 leading-relaxed max-w-xs">Anyone with this link can join. We'll remind you shortly before it starts.</div>
            </div>`;
        }

        function addMeetingToCalendar(){
          const m = meetingCreated || pendingMeetingInfo;
          if (!m || !m.starts_at) return;
          const start = new Date(m.starts_at);
          if (isNaN(start.getTime())) return;
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
          const link = buildMeetingLink(m.code);
          const title = m.title || 'Meeting';
          const details = 'Join on Stitch: ' + link;
          const enc = encodeURIComponent;
          const ua = navigator.userAgent || '';
          const isAndroid = /Android/i.test(ua);
          const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + enc(title)
            + '&dates=' + f(start) + '/' + f(end) + '&details=' + enc(details) + '&location=' + enc(link);

          if (isAndroid) {
            // Opens the phone's own calendar on a pre-filled new event (nothing is downloaded);
            // falls back to Google Calendar if no calendar app answers.
            window.location.href = 'intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/event;'
              + 'S.title=' + enc(title) + ';S.description=' + enc(details) + ';S.eventLocation=' + enc(link) + ';'
              + 'l.beginTime=' + start.getTime() + ';l.endTime=' + end.getTime() + ';'
              + 'S.browser_fallback_url=' + enc(gcal) + ';end';
            return;
          }
          if (isIOS) {
            // Safari shows the native "Add to Calendar" sheet for a calendar file opened in the page
            const esc = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
            const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Stitch//Meetings//EN','BEGIN:VEVENT',
              'UID:' + (m.code || Date.now()) + '@stitch','DTSTAMP:' + f(new Date()),'DTSTART:' + f(start),'DTEND:' + f(end),
              'SUMMARY:' + esc(title),'DESCRIPTION:' + esc(details),'URL:' + link,
              'BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY','DESCRIPTION:Meeting starting soon','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
            window.location.href = 'data:text/calendar;charset=utf-8,' + enc(ics);
            return;
          }
          window.open(gcal, '_blank', 'noopener');
        }

        function copyMeetingLink(code){
          const link = buildMeetingLink(code);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => pushInAppNotification('Link copied', 'Meeting link copied to your clipboard.')).catch(() => openAppAlertModal(link));
          } else {
            openAppAlertModal(link);
          }
        }

        function meetingShareName(code, title){
          if (title) return title;
          if (meetingCreated && meetingCreated.code === code && meetingCreated.title) return meetingCreated.title;
          const up = (typeof myUpcomingMeetings !== 'undefined' && myUpcomingMeetings || []).find(x => x.code === code);
          if (up && up.title) return up.title;
          if (activeMeeting && activeMeeting.code === code && activeMeeting.title) return activeMeeting.title;
          return 'a meeting';
        }

        function meetingShareText(code, title){
          return `Join "${meetingShareName(code, title)}" on Stitch: ${buildMeetingLink(code)}`;
        }

        // Native OS share sheet (used in-call, and by the "Share" option in the sheet below)
        function shareMeetingNative(code, title){
          const link = buildMeetingLink(code);
          const name = meetingShareName(code, title);
          if (navigator.share) {
            navigator.share({ title: name, text: `Join "${name}" on Stitch`, url: link }).catch(() => {});
          } else {
            copyMeetingLink(code);
          }
        }

        // ---- Share a meeting: in-app people picker + external options ----
        let meetingShareSelected = new Set();
        let meetingShareCode = '';
        let meetingShareTitle = '';

        function shareMeetingLink(code, title){
          meetingShareSelected = new Set();
          meetingShareCode = code;
          meetingShareTitle = meetingShareName(code, title);
          if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (!ov) { shareMeetingNative(code, title); return; }
          shareSheetReturnHTML = (!ov.classList.contains('hidden')) ? ov.innerHTML : null;
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.style.background = 'rgba(8,15,28,0.55)';
          ov.innerHTML = meetingShareSheetHTML();
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeShareSheet(fromPopState));
        }

        function meetingShareSheetHTML(){
          const contacts = shareContactsList();
          const code = escapeHtml(meetingShareCode);
          return `
            <div class="w-full h-full flex flex-col justify-end" onclick="if (event.target === this) closeShareSheet();">
              <div class="w-full bg-white flex flex-col share-sheet-panel" style="max-height:82vh;border-radius:22px 22px 0 0;overflow:hidden;" onclick="event.stopPropagation();">
                <div class="flex justify-center pt-2.5 pb-1 flex-shrink-0"><div class="w-9 h-1.5 rounded-full bg-gray-300"></div></div>
                <div class="flex-shrink-0 w-full">
                  <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between">
                    <div class="font-semibold text-lg font-display truncate" style="color:${NAVY};">Share meeting</div>
                    <button onclick="closeShareSheet()" style="color:${ROYAL};">${IconBold('close','w-5 h-5')}</button>
                  </div>
                  <div class="max-w-2xl mx-auto px-5 pb-4">
                    <div class="relative">
                      <div class="text-gray-400" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);">${Icon('search','w-4 h-4')}</div>
                      <input id="meeting-share-search" oninput="filterMeetingShareContacts()" placeholder="Search" class="w-full bg-gray-100 rounded-full text-sm" style="outline:none;padding:0.625rem 1rem 0.625rem 2.5rem;"/>
                    </div>
                  </div>
                </div>
                <div class="flex-1 overflow-y-hidden">
                  <div class="max-w-2xl mx-auto px-5">
                    <div id="meeting-share-grid" class="pill-bleed flex overflow-x-auto no-scrollbar" style="gap:16px;scroll-snap-type:x proximity;padding-top:2px;padding-bottom:8px;">
                      ${contacts.map(c => meetingShareContactCell(c)).join('')}
                    </div>
                    <div id="meeting-share-empty" class="${contacts.length ? 'hidden ' : ''}text-center text-sm text-gray-400 py-10">${contacts.length ? 'No matches' : 'No connections yet'}</div>
                  </div>
                </div>
                <div class="share-sheet-actions flex-shrink-0 w-full border-t border-gray-100" style="background:#fafafa;">
                  <div class="share-sheet-actions-row flex items-start no-scrollbar" style="gap:22px;padding:16px 20px calc(env(safe-area-inset-bottom, 12px) + 16px) 20px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
                    <div id="meeting-share-action">${meetingShareActionHTML()}</div>
                    ${shareExternalOption('send','Share', `shareMeetingNativeFromSheet()`, `linear-gradient(135deg,${ROYAL},${NAVY})`, '#fff')}
                    ${shareExternalOption('link','Copy link', `copyMeetingLinkFromSheet()`, '#eef0f4', NAVY)}
                    ${shareWhatsAppOption(`shareMeetingVia('whatsapp')`)}
                    ${shareMessagesOption(`shareMeetingVia('sms')`)}
                    ${shareGmailOption(`shareMeetingVia('gmail')`)}
                    ${shareOutlookOption(`shareMeetingVia('outlook')`)}
                  </div>
                </div>
              </div>
            </div>`;
        }

        function meetingShareContactCell(c){
          const selected = meetingShareSelected.has(c.id);
          return `
            <button id="meeting-share-cell-${c.id}" data-name="${escapeHtml(c.name.toLowerCase())}" onclick="toggleMeetingShareContact('${c.id}')" class="flex flex-col items-center gap-1.5 flex-shrink-0 text-center" style="width:72px;scroll-snap-align:start;">
              <div class="relative">
                <div class="w-14 h-14 ${c.avatarBg} rounded-full flex items-center justify-center text-gray-600 overflow-hidden" style="${selected ? `box-shadow:0 0 0 2.5px ${ROYAL};` : ''}">${avatarInnerHTML(c,'w-6 h-6')}</div>
                <div id="meeting-share-check-${c.id}" class="${selected ? '' : 'hidden'} absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center" style="background:${ROYAL};box-shadow:0 0 0 2px #fff;">${Icon('check','w-3 h-3 text-white')}</div>
              </div>
              <div class="text-xs font-medium truncate w-full leading-tight">${escapeHtml(c.name)}</div>
            </button>`;
        }

        function toggleMeetingShareContact(id){
          if (meetingShareSelected.has(id)) meetingShareSelected.delete(id); else meetingShareSelected.add(id);
          const on = meetingShareSelected.has(id);
          const badge = document.getElementById('meeting-share-check-' + id);
          if (badge) {
            badge.classList.toggle('hidden', !on);
            const avatar = badge.previousElementSibling;
            if (avatar) avatar.style.boxShadow = on ? `0 0 0 2.5px ${ROYAL}` : '';
          }
          const action = document.getElementById('meeting-share-action');
          if (action) action.innerHTML = meetingShareActionHTML();
        }

        function meetingShareActionHTML(){
          const count = meetingShareSelected.size;
          if (!count) return '';
          return `
            <div class="flex flex-col items-center gap-1 flex-shrink-0" style="width:56px;">
              <button onclick="sendMeetingToSelectedContacts()" title="Send" class="rounded-full flex items-center justify-center flex-shrink-0 relative" style="width:38px;height:38px;background:linear-gradient(135deg,${ROYAL},${NAVY});color:#fff;">
                ${Icon('send','w-4 h-4')}
                <span class="absolute bg-white text-[10px] font-bold rounded-full flex items-center justify-center" style="top:-3px;right:-3px;width:17px;height:17px;color:${ROYAL};box-shadow:0 0 0 1.5px ${ROYAL};">${count}</span>
              </button>
              <div class="text-[11px] text-gray-600 font-medium text-center leading-tight">Send</div>
            </div>`;
        }

        function filterMeetingShareContacts(){
          const input = document.getElementById('meeting-share-search');
          const q = input ? input.value.trim().toLowerCase() : '';
          const grid = document.getElementById('meeting-share-grid');
          const empty = document.getElementById('meeting-share-empty');
          if (!grid) return;
          let visible = 0;
          Array.from(grid.children).forEach(cell => {
            const match = !q || cell.dataset.name.includes(q);
            cell.classList.toggle('hidden', !match);
            if (match) visible++;
          });
          if (empty) { empty.textContent = 'No matches'; empty.classList.toggle('hidden', visible !== 0 || !grid.children.length); }
        }

        function sendMeetingToSelectedContacts(){
          if (!meetingShareSelected.size) return;
          const text = meetingShareText(meetingShareCode, meetingShareTitle);
          const ids = Array.from(meetingShareSelected);
          ids.forEach(id => deliverSharedMessage(id, text, { previewText: `Shared a meeting: "${meetingShareTitle}"` }));
          closeShareSheet();
          openAppAlertModal(ids.length === 1 ? 'Sent' : `Sent to ${ids.length} people`);
        }

        function shareMeetingNativeFromSheet(){
          const code = meetingShareCode, title = meetingShareTitle;
          closeShareSheet();
          shareMeetingNative(code, title);
        }

        function copyMeetingLinkFromSheet(){
          const code = meetingShareCode;
          closeShareSheet();
          copyMeetingLink(code);
        }

        function shareMeetingVia(kind){
          const text = meetingShareText(meetingShareCode, meetingShareTitle);
          const subject = `Join "${meetingShareTitle}" on Stitch`;
          let url;
          if (kind === 'whatsapp') url = 'https://wa.me/?text=' + encodeURIComponent(text);
          else if (kind === 'sms') url = 'sms:?&body=' + encodeURIComponent(text);
          else if (kind === 'gmail') url = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
          else url = 'https://outlook.live.com/mail/0/deeplink/compose?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
          closeShareSheet();
          if (kind === 'sms') window.location.href = url; else window.open(url, '_blank');
        }

        function shareActiveMeetingLink(){
          if (activeMeeting) shareMeetingNative(activeMeeting.code, activeMeeting.title);
        }

        // ---- Opening a meeting link / a tapped meeting ----
        // Runs at boot (games.js) after sign-in, same as checkPendingCollabLinkJoin.
        // The code is also stashed on first load, so it survives a sign-in / sign-up step that
        // reloads the page and drops the query string.
        try {
          const _mc = new URLSearchParams(window.location.search || '').get('meeting');
          if (_mc) localStorage.setItem('stitch-pending-meeting', JSON.stringify({ code: _mc, t: Date.now() }));
        } catch (e) { /* storage unavailable: the URL param alone still works */ }

        function checkPendingMeetingLink(){
          let code = null;
          try { code = new URLSearchParams(window.location.search || '').get('meeting'); } catch (e) { /* ignore */ }
          if (!code) {
            try {
              const saved = JSON.parse(localStorage.getItem('stitch-pending-meeting') || 'null');
              if (saved && saved.code && Date.now() - saved.t < 24 * 3600 * 1000) code = saved.code;
            } catch (e) { /* ignore */ }
          }
          try { localStorage.removeItem('stitch-pending-meeting'); } catch (e) { /* ignore */ }
          if (!code) return;
          if (window.location.search) history.replaceState(null, '', window.location.pathname);
          openMeetingByCode(code);
        }

        function openMeetingByCode(code){
          pendingMeetingCode = String(code || '').trim().toLowerCase();
          if (!pendingMeetingCode) return;
          pendingMeetingInfo = null;
          pendingMeetingError = null;
          meetingJoinStep = 'info';
          openOverlay('meetingJoin');
          refreshPendingMeeting();
        }

        async function fetchMeetingByCode(code){
          const sb = getSupabaseClient();
          if (!sb) return { status: 'offline' };
          try {
            const { data, error } = await sb.rpc('get_meeting_by_code', { p_code: code });
            if (error) return { status: 'offline' };
            const m = normalizeMeeting(data);      // null data = no such meeting
            return m ? Object.assign({ status: 'ok' }, m) : { status: 'not_found' };
          } catch (e) { return { status: 'offline' }; }
        }

        async function refreshPendingMeeting(){
          const code = pendingMeetingCode;
          const res = await fetchMeetingByCode(code);
          if (code !== pendingMeetingCode) return;
          if (res.status === 'ok') { pendingMeetingInfo = res; pendingMeetingError = null; }
          else { pendingMeetingInfo = null; pendingMeetingError = res.status === 'not_found' ? 'not_found' : 'offline'; }
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'meetingJoin') ov.innerHTML = meetingJoinHTML();
          startMeetingJoinPoll();
        }

        // While the join screen is open for an upcoming meeting, re-check so the Join button appears on time.
        function startMeetingJoinPoll(){
          stopMeetingJoinPoll();
          if (!pendingMeetingInfo || pendingMeetingInfo.state !== 'upcoming') return;
          meetingJoinPollTimer = setInterval(() => {
            if (currentOverlayKind !== 'meetingJoin') { stopMeetingJoinPoll(); return; }
            refreshPendingMeeting();
          }, 30000);
        }
        function stopMeetingJoinPoll(){
          if (meetingJoinPollTimer) { clearInterval(meetingJoinPollTimer); meetingJoinPollTimer = null; }
        }

        function meetingJoinHTML(){
          const shell = inner => `<div class="flex-1 flex flex-col items-center justify-center px-8 text-center relative" style="padding-top:var(--top-safe-pad);"><button onclick="closeOverlay()" title="Back" class="absolute w-10 h-10 rounded-full flex items-center justify-center" style="top:calc(var(--top-safe-pad) + 12px);left:16px;background:rgba(127,127,127,0.14);">${IconBold('back','w-5 h-5')}</button>${inner}</div>`;
          const iconBubble = name => `<div class="w-16 h-16 rounded-full flex items-center justify-center mb-5" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon(name, 'w-7 h-7')}</div>`;
          const closeBtn = label => '';
          const primary = (label, action) => `<button onclick="${action}" class="w-full max-w-xs font-semibold py-3 rounded-full text-white mb-3" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${label}</button>`;

          if (pendingMeetingError === 'not_found') {
            return shell(`${iconBubble('link')}<div class="text-xl font-bold font-display mb-2">Meeting not found</div><div class="text-sm text-gray-500 mb-6 leading-relaxed">This link isn't valid. Ask the host to send it again.</div>${closeBtn('Close')}`);
          }
          if (pendingMeetingError === 'offline') {
            return shell(`${iconBubble('link')}<div class="text-xl font-bold font-display mb-2">Couldn't load the meeting</div><div class="text-sm text-gray-500 mb-6 leading-relaxed">Check your connection and try again.</div>${primary('Try again', 'openMeetingByCode(pendingMeetingCode)')}${closeBtn('Close')}`);
          }
          if (!pendingMeetingInfo) {
            return shell(`<div class="text-sm text-gray-400">Loading meeting...</div>`);
          }
          const m = pendingMeetingInfo;
          const isAdmin = !!(m.is_host || m.is_admin);
          const hostLine = m.host_name ? `Hosted by ${escapeHtml(m.host_name)}` : '';
          const head = `${iconBubble(m.kind === 'live' ? 'video' : 'calendar')}
            <div class="text-xl font-bold font-display mb-1 break-words max-w-full">${escapeHtml(m.title)}</div>
            ${hostLine ? `<div class="text-xs text-gray-400 mb-1">${hostLine}</div>` : ''}`;

          if (m.state === 'cancelled') {
            return shell(`${head}<div class="text-sm text-gray-500 mb-6 leading-relaxed">This meeting was cancelled.</div>${closeBtn('Close')}`);
          }
          if (m.state === 'ended') {
            return shell(`${head}<div class="text-sm text-gray-500 mb-6 leading-relaxed">This meeting has ended.</div>${closeBtn('Close')}`);
          }
          if (m.state === 'live' || isAdmin) {
            const label = m.state === 'live' ? 'Join meeting' : 'Start meeting now';
            const sub = m.state === 'live' ? '' : `Scheduled for ${escapeHtml(meetingWhenText(m.starts_at))}. As an admin you can open it early.`;
            const camRow = `
              <button onclick="toggleMeetingJoinCamera()" class="w-full max-w-xs flex items-center justify-between rounded-2xl px-4 py-3 mb-4" style="background:rgba(30,144,255,0.08);">
                <span class="text-sm font-semibold" style="color:${NAVY};">Camera</span>
                <span style="width:46px;height:28px;border-radius:999px;position:relative;flex-shrink:0;transition:background .2s;background:${meetingJoinCamOn ? '#1e90ff' : '#c4c9d2'};">
                  <span style="position:absolute;top:3px;left:${meetingJoinCamOn ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.25);"></span>
                </span>
              </button>`;
            const preview = `
              <div class="w-full rounded-3xl overflow-hidden relative" style="background:#0f1115;max-width:230px;aspect-ratio:3/4;flex:none;margin:auto 0;">
                <video id="mj-preview-video" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);${meetingJoinCamOn ? '' : 'display:none;'}"></video>
                ${meetingJoinCamOn ? '' : `<div class="absolute inset-0 flex flex-col items-center justify-center gap-3" style="color:#9ca3af;"><div class="flex items-center justify-center overflow-hidden" style="width:96px;height:96px;border-radius:50%;background:#e5e7eb;">${myCallAvatarHTML('w-24 h-24')}</div><div class="text-sm font-semibold">Camera is off</div></div>`}
              </div>`;
            setTimeout(syncMeetingJoinPreview, 0);
            return `<div class="flex-1 flex flex-col items-center px-6 pb-6 text-center min-h-0" style="padding-top:var(--top-safe-pad);">
              <div class="w-full flex items-center gap-3 pt-3">
                <button onclick="closeOverlay()" title="Back" class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(0,0,0,0.06);">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 min-w-0 text-xl font-bold font-display truncate">${escapeHtml(m.title)}</div>
                <div class="w-10 h-10 flex-shrink-0"></div>
              </div>
              ${hostLine ? `<div class="text-xs text-gray-400 mt-1">${hostLine}</div>` : ''}
              ${sub ? `<div class="text-sm text-gray-500 mt-2 leading-relaxed">${sub}</div>` : ''}
              ${preview}
              ${camRow}${primary(label, 'joinPendingMeeting(meetingJoinCamOn)')}
            </div>`;
          }
          // Upcoming, regular guest: ask whether to be reminded
          const reminded = !!m.reminded;
          return shell(`${head}
            <div class="text-sm text-gray-500 mb-6 leading-relaxed">Starts ${escapeHtml(meetingWhenText(m.starts_at))}.<br>${reminded ? "You'll get a reminder shortly before it begins." : 'Want us to remind you when it is about to start?'}</div>
            ${reminded
              ? `${primary('Done', 'closeOverlay()')}<button onclick="setPendingMeetingReminder(false)" class="text-sm font-semibold text-gray-400 mt-1">Turn reminder off</button>`
              : `${primary('Remind me', 'setPendingMeetingReminder(true)')}${closeBtn('No thanks')}`}`);
        }

        async function setPendingMeetingReminder(on){
          const m = pendingMeetingInfo;
          if (!m) return;
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal("Couldn't save the reminder right now. Please try again."); return; }
          try {
            // The database sends the reminder (in-app + push) 10 minutes before the start.
            const { data, error } = await sb.rpc('set_meeting_reminder', { p_code: m.code, p_minutes_before: on ? 10 : null });
            if (error || !data) throw (error || new Error('reminder failed'));
          } catch (e) {
            console.warn('set_meeting_reminder failed:', e);
            openAppAlertModal("Couldn't save the reminder right now. Please try again.");
            return;
          }
          if (on) ensureNotificationPermission();
          m.reminded = !!on;
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'meetingJoin') ov.innerHTML = meetingJoinHTML();
        }

        function setMeetingJoinStep(step){
          meetingJoinStep = step;
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'meetingJoin') ov.innerHTML = meetingJoinHTML();
        }

        // camOn: true = join with the camera on, false = join with it off
        async function joinPendingMeeting(camOn){
          const info = pendingMeetingInfo;
          if (!info) return;
          stopMeetingJoinPreview();
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal("Couldn't join the meeting right now. Check your connection and try again."); return; }
          try {
            // Registers me as a member (and opens a scheduled meeting early when an admin joins close to the start)
            const { data, error } = await sb.rpc('join_meeting', { p_code: info.code });
            if (error) {
              if (/meeting_ended/.test(error.message || '')) {
                pendingMeetingInfo = Object.assign({}, info, { state: 'ended' });
                meetingJoinStep = 'info';
                const ov = document.getElementById('overlay');
                if (ov && currentOverlayKind === 'meetingJoin') ov.innerHTML = meetingJoinHTML();
                return;
              }
              throw error;
            }
            const m = normalizeMeeting(data);
            openMeetingCall(m ? Object.assign({ status: 'ok' }, m) : info, { camOff: camOn === false });
          } catch (e) {
            console.warn('join_meeting failed:', e);
            openAppAlertModal("Couldn't join the meeting. Please try again.");
          }
        }

        // ---- Into the call screen ----
        function openMeetingCall(info, opts){
          if (callState.convoId && !isMeetingConvo(callState.convoId)) {
            openAppAlertModal('Finish your current call before joining a meeting.');
            return;
          }
          if (callState.convoId && isMeetingConvo(callState.convoId)) {
            if (activeMeeting && activeMeeting.code === info.code) { if (callMinimized) resumeCall(); return; }
            openAppAlertModal('You are already in a meeting. Leave it before joining another.');
            return;
          }
          const id = 'meeting:' + info.code;
          convoMeta[id] = { icon: 'users', avatarBg: 'bg-blue-50', name: info.title, username: '', preview: '', members: [], isMeeting: true, meetingCode: info.code };
          activeMeeting = {
            id: info.id,
            code: info.code,
            title: info.title,
            endsAt: new Date(info.ends_at).getTime(),
            isAdmin: !!(info.is_host || info.is_admin),
            isHost: !!info.is_host,
            // Used to check that a "mute everyone" signal really came from the host or an admin
            adminIds: [info.host_id].concat(info.admin_ids || []).filter(Boolean),
          };
          const adminLookupCode = info.code;
          fetchMeetingByCode(adminLookupCode).then(res => {
            if (res && res.status === 'ok' && activeMeeting && activeMeeting.code === adminLookupCode) {
              activeMeeting.adminIds = [res.host_id].concat(res.admin_ids || []).filter(Boolean);
            }
          });
          pendingMeetingCode = null; pendingMeetingInfo = null;
          stopMeetingJoinPoll();
          startCall(id, 'video', true, opts);
        }

        // One hour hard stop -- never announced up front; the call simply wraps up.
        function scheduleMeetingAutoEnd(){
          if (meetingEndTimer) { clearTimeout(meetingEndTimer); meetingEndTimer = null; }
          if (!activeMeeting) return;
          const code = activeMeeting.code;
          const fire = () => {
            meetingEndTimer = null;
            if (!activeMeeting || activeMeeting.code !== code) return;
            pushInAppNotification('Meeting ended', 'This meeting has wrapped up.');
            endCall();
          };
          const ms = activeMeeting.endsAt - Date.now();
          if (ms <= 0) { setTimeout(fire, 0); return; }
          meetingEndTimer = setTimeout(fire, Math.min(ms, 2147483000));
        }

        function meetingOnCallEnded(){
          if (meetingEndTimer) { clearTimeout(meetingEndTimer); meetingEndTimer = null; }
          const id = activeMeeting ? 'meeting:' + activeMeeting.code : null;
          if (id && convoMeta[id]) delete convoMeta[id];
          meetingSheet = ''; meetingFloatReactions = []; meetingFloatComments = []; meetingCommentFocused = false;
          cuUnmountCommentBar();
          activeMeeting = null;
        }

        // ---- In-meeting extras: reactions + messages, opened from the three-dots button ----
        let meetingSheet = '';              // '' | 'menu' | 'reactions' | 'comment'
        let meetingFloatReactions = [];
        let meetingFloatComments = [];
        const MEETING_REACTIONS = [
          { icon: 'clap', label: 'Clap', color: '#f59e0b' },
          { icon: 'thumbsUp', label: 'Like', color: '#2563eb' },
          { icon: 'heart', label: 'Love', color: '#dc2626' },
          { icon: 'laugh', label: 'Haha', color: '#f59e0b' },
          { icon: 'wow', label: 'Wow', color: '#7c3aed' },
          { icon: 'party', label: 'Celebrate', color: '#16a34a' },
        ];

        function meetingMyName(){
          return (typeof profileData !== 'undefined' && profileData && profileData.name) || 'Someone';
        }

        function meetingReactionsFloatHTML(){
          return meetingFloatReactions.map(r => `
            <span class="lecture-reaction-float cu-float flex items-center gap-1.5 rounded-full" style="padding:8px 12px 8px 8px;">
              <span class="flex items-center justify-center flex-shrink-0" style="font-size:26px;line-height:1;width:32px;height:32px;">${cuEmoji(r.icon)}</span>
              <span class="text-xs font-semibold truncate max-w-[130px]">${escapeHtml(r.name || '')}</span>
            </span>`).join('');
        }

        function meetingCommentsFloatHTML(){
          return meetingFloatComments.map(c => `
            <span class="lecture-reaction-float cu-float flex items-start gap-1.5 rounded-2xl" style="max-width:220px;padding:10px;animation-duration:6s;">
              <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style="background:${NAVY};">${escapeHtml((c.name || '?').slice(0, 1).toUpperCase())}</span>
              <span class="min-w-0">
                <span class="block text-[11px] font-bold truncate">${escapeHtml(c.name || '')}</span>
                <span class="block text-xs break-words" style="opacity:.8;">${escapeHtml(c.text || '')}</span>
              </span>
            </span>`).join('');
        }

        function meetingSheetHTML(){
          if (!activeMeeting) return '';
          const backdrop = `<div class="cu-backdrop" onclick="closeMeetingSheet()"></div>`;
          if (meetingSheet === 'menu') {
            const row = (icon, label, action, red) => `
              <button onclick="${action}" class="cu-bsheet-row ${red ? 'red' : ''}">
                ${cuEmoji(icon) ? `<span style="font-size:22px;line-height:1;width:20px;text-align:center;">${cuEmoji(icon)}</span>` : Icon(icon, 'w-5 h-5')}<span>${label}</span>
              </button>`;
            return `${backdrop}
              <div class="cu-bsheet">
                <div class="cu-bsheet-grab"></div>
                ${row('reactions', 'Reactions', "setMeetingSheet('reactions')")}
                ${row('commentText', 'Send a message', "setMeetingSheet('comment')")}
                ${row('handRaised', callState.handRaised ? 'Lower hand' : 'Raise hand', 'closeMeetingSheet();toggleCallHand()')}
                ${activeMeeting.code ? row('link', 'Copy invite link', `closeMeetingSheet();copyMeetingLink('${escapeHtml(activeMeeting.code)}')`) : ''}
                ${activeMeeting.isAdmin ? row('muteAll', 'Mute everyone', 'closeMeetingSheet();muteEveryoneInCall()') : ''}
                ${activeMeeting.isAdmin ? row('phoneHangup', 'End meeting for everyone', 'closeMeetingSheet();confirmEndMeetingForAll()', true) : ''}
              </div>`;
          }
          if (meetingSheet === 'reactions') {
            return `${backdrop}
              <div class="cu-bsheet">
                <div class="cu-bsheet-grab"></div>
                <div class="cu-emoji-row">
                  ${MEETING_REACTIONS.map(r => `<button onclick="sendMeetingReaction('${r.icon}')" title="${escapeHtml(r.label)}" class="cu-emoji-btn">${cuEmoji(r.icon)}</button>`).join('')}
                </div>
              </div>`;
          }
          return '';
        }

        // Floating reactions/messages + the sheets, drawn inside the call screen
        function meetingOverlaysHTML(){
          return `
            <div id="meeting-reactions-float" class="fixed flex flex-col items-end gap-1 z-20" style="bottom:calc(150px + env(safe-area-inset-bottom,0px));right:14px;pointer-events:none;">${meetingReactionsFloatHTML()}</div>
            <div id="meeting-comments-float" class="fixed flex flex-col items-start gap-1 z-20" style="bottom:calc(150px + env(safe-area-inset-bottom,0px));left:14px;pointer-events:none;max-width:220px;">${meetingCommentsFloatHTML()}</div>
            <div id="meeting-sheets-region">${meetingSheetHTML()}</div>`;
        }

        function updateMeetingSheet(){
          const el = document.getElementById('meeting-sheets-region');
          if (el) el.innerHTML = meetingSheetHTML();
          if (meetingSheet === 'comment') cuMountCommentBar({ inputId: 'meeting-comment-input', placeholder: 'Type a message...', onSend: 'sendMeetingComment()', onClose: 'closeMeetingSheet()' });
          else cuUnmountCommentBar();
        }
        function setMeetingSheet(name){ meetingSheet = name; updateMeetingSheet(); }
        function closeMeetingSheet(){ setMeetingSheet(''); }
        function toggleMeetingMenu(){ setMeetingSheet(meetingSheet === 'menu' ? '' : 'menu'); }

        // Keep the message box above the on-screen keyboard
        let meetingCommentFocused = false;
        function meetingCommentFocus(on){ meetingCommentFocused = on; syncMeetingCommentInset(); }
        function syncMeetingCommentInset(){
          return;
          const sheet = document.getElementById('meeting-comment-sheet');
          if (!sheet) return;
          if (!meetingCommentFocused) { sheet.style.bottom = 'calc(132px + env(safe-area-inset-bottom,0px))'; return; }
          const vv = window.visualViewport;
          const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
          sheet.style.bottom = (inset + 10) + 'px';
        }

        function addMeetingFloatReaction(id, icon, name){
          const def = MEETING_REACTIONS.find(r => r.icon === icon);
          if (!def) return;
          meetingFloatReactions.push({ id, icon, name, color: def.color });
          if (meetingFloatReactions.length > 6) meetingFloatReactions.shift();
          const el = document.getElementById('meeting-reactions-float');
          if (el) el.innerHTML = meetingReactionsFloatHTML();
          setTimeout(() => {
            meetingFloatReactions = meetingFloatReactions.filter(r => r.id !== id);
            const el2 = document.getElementById('meeting-reactions-float');
            if (el2) el2.innerHTML = meetingReactionsFloatHTML();
          }, 2400);
        }

        function addMeetingFloatComment(id, text, name){
          meetingFloatComments.push({ id, text, name });
          if (meetingFloatComments.length > 4) meetingFloatComments.shift();
          const el = document.getElementById('meeting-comments-float');
          if (el) el.innerHTML = meetingCommentsFloatHTML();
          setTimeout(() => {
            meetingFloatComments = meetingFloatComments.filter(c => c.id !== id);
            const el2 = document.getElementById('meeting-comments-float');
            if (el2) el2.innerHTML = meetingCommentsFloatHTML();
          }, 6000);
        }

        function sendMeetingReaction(icon){
          if (!activeMeeting) return;
          const id = 'r' + Date.now() + Math.random().toString(36).slice(2);
          const name = meetingMyName();
          addMeetingFloatReaction(id, icon, name);
          sendCallSignal({ kind: 'meeting_reaction', id, icon, name });
          closeMeetingSheet();
        }

        function sendMeetingComment(){
          if (!activeMeeting) return;
          const input = document.getElementById('meeting-comment-input');
          const text = input ? input.value.trim().slice(0, 200) : '';
          if (!text) return;
          const id = 'c' + Date.now() + Math.random().toString(36).slice(2);
          const name = meetingMyName();
          addMeetingFloatComment(id, text, name);
          sendCallSignal({ kind: 'meeting_comment', id, text, name });
          meetingCommentFocused = false;
          closeMeetingSheet();
        }

        // Signals from other people in the meeting (never echoed back to the sender)
        function meetingReceiveExtra(payload){
          if (!activeMeeting || !isMeetingConvo(callState.convoId)) return;
          const id = String(payload.id || '').slice(0, 60) || ('x' + Date.now());
          const name = String(payload.name || 'Someone').slice(0, 60);
          if (payload.kind === 'meeting_reaction') addMeetingFloatReaction(id, String(payload.icon || ''), name);
          else if (payload.kind === 'meeting_comment') addMeetingFloatComment(id, String(payload.text || '').slice(0, 200), name);
        }

        // Admins can end the meeting for everyone. The server decides who may; other people's
        // apps double-check with the server before leaving, so a spoofed signal can't kick anyone.
        function confirmEndMeetingForAll(){
          openAppConfirmModal('End meeting for everyone?', 'Everyone will be removed from the call.', 'End for everyone', () => endMeetingForAll(), 'phoneHangup');
        }

        async function endMeetingForAll(){
          if (!activeMeeting) return;
          const sb = getSupabaseClient();
          if (sb) {
            try {
              // Raises 'admin_only' for anyone who isn't the host or an admin
              const { data, error } = await sb.rpc('end_meeting', { p_meeting: activeMeeting.id });
              if (!error && data) sendCallSignal({ kind: 'meeting_end' });
            } catch (e) { console.warn('end_meeting failed:', e); }
          }
          endCall();
        }

        async function meetingHandleEndSignal(){
          if (!activeMeeting) return;
          const code = activeMeeting.code;
          const res = await fetchMeetingByCode(code);
          if (!activeMeeting || activeMeeting.code !== code) return;
          if (res.status === 'ok' && (res.state === 'ended' || res.state === 'cancelled')) {
            pushInAppNotification('Meeting ended', 'The host ended this meeting.');
            endCall(true);
          }
        }

        // Shows real names/photos for people who join (the signaling only carries user ids).
        async function meetingResolvePeer(userId){
          const meta = activeMeeting ? convoMeta['meeting:' + activeMeeting.code] : null;
          if (!meta || !userId) return;
          if ((meta.members || []).some(m => m.otherUserId === userId)) return;
          const member = { otherUserId: userId, name: 'Someone', icon: 'user', avatarBg: 'bg-blue-50', photo: null, mine: false };
          meta.members.push(member);
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('name,username,photo').eq('user_id', userId).maybeSingle();
            if (data) { member.name = data.name || data.username || 'Someone'; member.photo = data.photo || null; }
          } catch (e) { /* keep the placeholder name */ }
          const screen = document.getElementById('call-screen');
          if (screen && callState.convoId === 'meeting:' + (activeMeeting && activeMeeting.code)) {
            screen.outerHTML = callHTML();
            attachCallLocalVideo();
            attachCallRemoteVideo();
          }
        }

        // Opens a meeting from a push notification tap (sw.js posts 'open-meeting').
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', (e) => {
            const d = e && e.data;
            if (d && d.type === 'open-meeting' && d.code) openMeetingByCode(d.code);
          });
        }
