try {
          if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default', fontFamily: 'inherit' });
          }
        } catch (err) {}
        let aiChatMessages = [];
        let aiChatHistoryOpen = false;

        let aiVoiceRecognition = null;
        let aiVoiceRecording = false;

        // ---- AI Class (Stitch Bot) chat history ----
        function studentFirstName(){
          const full = (typeof profileData !== 'undefined' && profileData.name) ? profileData.name.trim() : '';
          if (full) return full.split(/\s+/)[0];
          const uname = (typeof profileData !== 'undefined' && profileData.username) ? profileData.username.trim() : '';
          return uname || '';
        }

        let aiChatSessions = [];
        let aiChatSessionIdCounter = 0;

        function archiveCurrentAIChat(){
          stopAIVoiceInput();
          const hasUserMessage = aiChatMessages.some(m => m.role === 'user');
          if (hasUserMessage) {
            const session = { id: ++aiChatSessionIdCounter, messages: aiChatMessages.slice(), summary: null };
            aiChatSessions.unshift(session);
            generateAIChatSummary(session);
          }
          aiChatMessages = [];
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        async function generateAIChatSummary(session){
          const transcript = session.messages
            .filter(m => m.text || (m.attachments && m.attachments.length))
            .map(m => `${m.role === 'user' ? 'Student' : 'Stitch Bot'}: ${m.text || (m.attachments || []).map(f => f.name).join(', ')}`)
            .join('\n')
            .slice(0, 4000);
          if (!transcript.trim()) { session.summary = 'New chat'; refreshAIChatHistoryViews(); return; }
          try {
            const system = 'Summarise what this chat between a student and their AI study buddy was about, in 5 words or fewer. Describe the topic or task discussed, not who said what. No punctuation at the end, no quotation marks, no leading capital-letter labels like "Topic:".';
            const reply = await callClaude(system, transcript, 'summary');
            const clean = String(reply || '').trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
            session.summary = clean.slice(0, 60) || fallbackAIChatSummary(session);
          } catch (err) {
            session.summary = fallbackAIChatSummary(session);
          }
          refreshAIChatHistoryViews();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function fallbackAIChatSummary(session){
          const firstUser = session.messages.find(m => m.role === 'user');
          if (!firstUser) return 'New chat';
          if (firstUser.text) return firstUser.text.length > 40 ? firstUser.text.slice(0, 40) + '…' : firstUser.text;
          if (firstUser.attachments && firstUser.attachments.length) return `${firstUser.attachments.length} attachment${firstUser.attachments.length > 1 ? 's' : ''}`;
          return 'Chat';
        }

        function refreshAIChatHistoryViews(){
          const ov = document.getElementById('overlay');
          if (ov && !ov.classList.contains('hidden') && typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'aiClass' && aiChatHistoryOpen) {
            ov.innerHTML = aiClassHTML();
            renderPendingMermaidDiagrams();
          }
          if (typeof rightPanelMode !== 'undefined' && rightPanelMode === 'aihistory') renderRightPanelBody();
        }

        function openClassroomNavOverlay(kind){
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind && currentOverlayKind !== kind) {
            openOverlayFrom(currentOverlayKind, kind);
          } else {
            openOverlay(kind);
          }
        }

        function openAIClass(){
          aiChatHistoryOpen = false;
          aiChatInputFocused = false;
          openClassroomNavOverlay('aiClass');
          openRightPanel('aihistory');
        }

        function openAIChatHistory(){
          aiChatHistoryOpen = true;
          aiHistorySearchActive = false;
          aiHistorySearchQuery = '';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          renderPendingMermaidDiagrams();
        }

        function closeAIChatHistory(){
          aiChatHistoryOpen = false;
          aiHistorySearchActive = false;
          aiHistorySearchQuery = '';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          renderPendingMermaidDiagrams();
        }

        function clearAIChat(){
          aiChatMessages = [];
          aiChatHistoryOpen = false;
          aiHistoryPanelView = 'history';
          const ov = document.getElementById('overlay');
          if (ov && ov.classList.contains('hidden') === false) ov.innerHTML = aiClassHTML();
          renderPendingMermaidDiagrams();
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function openAIChatSession(id){
          archiveCurrentAIChat();
          const idx = aiChatSessions.findIndex(s => s.id === id);
          if (idx === -1) return;
          const session = aiChatSessions.splice(idx, 1)[0];
          aiChatMessages = session.messages.slice();
          aiChatHistoryOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          renderPendingMermaidDiagrams();
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function startNewAIChat(){
          archiveCurrentAIChat();
          aiChatHistoryOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          renderPendingMermaidDiagrams();
          if (typeof startAIRobotAnimation === 'function') startAIRobotAnimation();
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function aiSessionPreview(session){
          if (session.summary) return session.summary;
          return fallbackAIChatSummary(session);
        }

        let aiHistorySearchActive = false;
        let aiHistorySearchQuery = '';

        function activateAIHistorySearch(){
          aiHistorySearchActive = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          renderPendingMermaidDiagrams();
          const inp = document.getElementById('ai-history-search-input');
          if (inp) inp.focus();
        }

        function deactivateAIHistorySearch(){
          aiHistorySearchActive = false;
          aiHistorySearchQuery = '';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          renderPendingMermaidDiagrams();
        }

        function onAIHistorySearchInput(val){
          aiHistorySearchQuery = val;
          const rows = document.getElementById('ai-history-rows');
          if (rows) rows.innerHTML = aiHistoryRowsHTML();
        }

        function aiHistoryRowsHTML(){
          const q = aiHistorySearchQuery.trim().toLowerCase();
          const sessions = q ? aiChatSessions.filter(s => aiSessionPreview(s).toLowerCase().includes(q)) : aiChatSessions;
          if (!sessions.length) {
            return `<div class="text-center text-gray-400 text-sm py-10 px-3">${q ? `No conversations matching "${escapeHtml(aiHistorySearchQuery)}".` : 'No past conversations yet.'}</div>`;
          }
          return sessions.map(s => `
              <button onclick="openAIChatSession(${s.id})" class="w-full text-left px-3 py-3 rounded-xl text-sm text-gray-700 truncate menu-item-pill">${escapeHtml(aiSessionPreview(s))}</button>`
          ).join('');
        }

        function aiChatHistoryDrawerHTML(){
          if (!aiChatHistoryOpen) return '';
          return `
            <div onclick="closeAIChatHistory()" class="ai-history-drawer-backdrop"></div>
            <div class="ai-history-drawer">
              <div class="flex items-center justify-between px-4 flex-shrink-0" style="padding-top:var(--top-safe-pad);padding-bottom:14px;">
                ${aiHistorySearchActive ? `
                  <div class="flex-1 flex items-center gap-2.5 bg-gray-100 text-gray-500 rounded-full px-4 py-2 text-sm">
                    ${Icon('search','w-4 h-4')}
                    <input id="ai-history-search-input" type="text" value="${escapeHtml(aiHistorySearchQuery)}" oninput="onAIHistorySearchInput(this.value)" placeholder="Search chat history..." class="flex-1 min-w-0 bg-transparent outline-none text-gray-800" autocomplete="off">
                  </div>
                  <button onclick="deactivateAIHistorySearch()" class="w-8 h-8 flex items-center justify-center flex-shrink-0 ml-1">${Icon('close','w-4 h-4')}</button>
                ` : `
                  <h1 class="text-lg font-bold font-display grad-text">Chat History</h1>
                  <div class="flex items-center gap-1">
                    <button onclick="activateAIHistorySearch()" title="Search chat history" class="w-8 h-8 flex items-center justify-center flex-shrink-0 text-gray-400">${Icon('search','w-4 h-4')}</button>
                    <button onclick="closeAIChatHistory()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  </div>
                `}
              </div>
              <div class="px-3 pb-2 flex-shrink-0">
                <button onclick="startNewAIChat()" class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold" style="background:rgba(30,144,255,0.10);color:${NAVY};">${Icon('plus','w-4 h-4')} New chat</button>
              </div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pb-1 flex-shrink-0">Recents</div>
              <div id="ai-history-rows" class="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">${aiHistoryRowsHTML()}</div>
            </div>`;
        }

        let aiHistoryPanelView = 'history';

        function setAIHistoryPanelView(view){
          aiHistoryPanelView = view;
          renderRightPanelBody();
        }

        function rightPanelAIHistoryActionsHTML(){
          const activeStyle = `background:rgba(30,144,255,0.12);color:${NAVY};`;
          const inactiveStyle = `color:#9ca3af;`;
          return `
            <div class="flex items-center gap-1">
              <button onclick="startNewAIChat()" title="New chat" class="w-7 h-7 rounded-lg flex items-center justify-center" style="${inactiveStyle}">${Icon('plus','w-4 h-4')}</button>
              <button onclick="setAIHistoryPanelView('history')" title="Chat history" class="w-7 h-7 rounded-lg flex items-center justify-center" style="${aiHistoryPanelView === 'history' ? activeStyle : inactiveStyle}">${Icon('comment','w-4 h-4')}</button>
              <button onclick="setAIHistoryPanelView('delete')" title="Delete chat" class="w-7 h-7 rounded-lg flex items-center justify-center" style="${aiHistoryPanelView === 'delete' ? activeStyle : inactiveStyle}">${Icon('trash','w-4 h-4')}</button>
            </div>`;
        }

        function rightPanelAIHistoryHTML(){
          if (aiHistoryPanelView === 'delete') {
            return `
              <div class="p-5 flex flex-col items-center text-center">
                <div class="w-12 h-12 rounded-full flex items-center justify-center mb-3" style="background:#fef2f2;color:#dc2626;">${Icon('trash','w-5 h-5')}</div>
                <div class="font-semibold text-sm mb-1.5">Clear this chat?</div>
                <div class="text-xs text-gray-500 mb-4">This deletes your whole conversation with Stitch Bot. This can't be undone.</div>
                <button onclick="clearAIChat()" class="w-full bg-red-500 text-white font-semibold text-sm py-2.5 rounded-2xl mb-2">Clear chat</button>
                <button onclick="setAIHistoryPanelView('history')" class="w-full bg-gray-100 text-gray-700 font-medium text-sm py-2.5 rounded-2xl">Cancel</button>
              </div>`;
          }
          const rows = aiChatSessions.length ? aiChatSessions.map(s => `
              <button onclick="openAIChatSession(${s.id})" class="w-full text-left py-3.5 border-b border-gray-100 text-sm text-gray-700 truncate">${escapeHtml(aiSessionPreview(s))}</button>`
          ).join('') : `<div class="text-gray-400 text-sm text-center py-10">No past conversations yet.</div>`;
          return `<div class="p-5">${rows}</div>`;
        }

        // ---- AI chat screen render + file attachments ----
        function aiClassHTML(){
          return `
            <div class="flex-1 relative overflow-hidden">
              <div class="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pointer-events-none" style="padding-top:var(--top-safe-pad);">
                <div class="ai-header-pill-group pointer-events-auto">
                  <button onclick="closeOverlay()" title="Back" class="ai-header-pill-btn">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <div class="ai-header-pill-divider"></div>
                  <button onclick="openAIChatHistory()" title="Chat history" class="ai-header-pill-btn">${gradIcon(IconBold('dashes','w-5 h-5'))}</button>
                </div>
                <button onclick="startNewAIChat()" title="New chat" class="ai-header-pill pointer-events-auto">${gradIcon(IconBold('plus','w-5 h-5'))}</button>
              </div>
              <div id="ai-chat-log" class="absolute inset-0 overflow-y-auto p-5 flex flex-col gap-4" style="padding-top:76px;">
                ${aiChatLogHTML()}
              </div>
            </div>
            <div id="ai-attach-strip" class="flex-shrink-0">${aiAttachStripHTML()}</div>
            <div id="ai-composer-wrap" class="flex-shrink-0 px-3 pt-2 convo-composer-anim" style="padding-bottom:20px;">
              <input type="file" id="ai-file-input" accept="image/*,video/*,.pdf,.ppt,.pptx" multiple class="hidden" onchange="handleAIFileSelect(event)">
              <div class="flex items-center gap-2 rounded-3xl px-2 py-1.5" style="background:#ffffff;border:1.5px solid rgba(10,37,64,0.10);box-shadow:0 8px 24px rgba(10,37,64,0.10);">
                <button onclick="document.getElementById('ai-file-input').click()" title="Attach images, PDFs, or PPTX" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.06);color:${NAVY};">${Icon('clip','w-4 h-4')}</button>
                <textarea id="ai-chat-input" rows="1" placeholder="Ask Stitch Bot anything..." onkeydown="handleAIChatInputKeydown(event)" oninput="autoGrowAIChatInput(this)" onfocus="handleAIChatInputFocus()" onblur="handleAIChatInputBlur()" class="flex-1 min-w-0 bg-transparent text-sm resize-none leading-snug self-center" style="max-height:120px; overflow-y:auto;"></textarea>
                <button id="ai-mic-btn" onclick="toggleAIVoiceInput()" title="Ask by voice" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.06);color:${NAVY};">${Icon('mic','w-4 h-4')}</button>
                <button onclick="sendAIMessage()" class="w-8 h-8 text-white rounded-full flex items-center justify-center flex-shrink-0" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
              </div>
            </div>
            ${aiChatHistoryDrawerHTML()}`;
        }

        let pendingAIAttachments = [];

        function aiFileIcon(type){
          if (type && type.startsWith('image/')) return 'camera';
          return 'file';
        }

        function aiAttachStripHTML(){
          if (!pendingAIAttachments.length) return '';
          return `
            <div class="px-4 pt-3 flex gap-2 flex-wrap">
              ${pendingAIAttachments.map((f,i) => f.previewUrl ? `
                <div class="relative overflow-hidden flex-shrink-0" style="width:3.5rem;height:3.5rem;border-radius:0.75rem;background:${NAVY};">
                  ${f.type && f.type.startsWith('video/')
                    ? `<video src="${f.previewUrl}" muted playsinline preload="metadata" class="absolute inset-0 w-full h-full object-cover block"></video>`
                    : `<img src="${f.previewUrl}" alt="${escapeHtml(f.name)}" class="absolute inset-0 w-full h-full object-cover block" />`}
                  <button onclick="removeAIAttachment(${i})" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center text-gray-500 shadow">${Icon('close','w-3 h-3')}</button>
                </div>` : `
                <div class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700">
                  <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(aiFileIcon(f.type),'w-3.5 h-3.5')}</div>
                  <span class="max-w-[120px] truncate">${escapeHtml(f.name)}</span>
                  <button onclick="removeAIAttachment(${i})" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                </div>`).join('')}
            </div>`;
        }

        function handleAIFileSelect(event){
          const files = Array.from(event.target.files || []);
          const allowed = /image\/.*|video\/.*|application\/pdf|.*presentation.*|.*powerpoint.*/;
          files.forEach(f => {
            const okType = allowed.test(f.type) || /\.(pdf|pptx?|jpe?g|png|gif|webp|mp4|mov|webm)$/i.test(f.name);
            if (okType) {
              if (f.type && (f.type.startsWith('image/') || f.type.startsWith('video/'))) f.previewUrl = URL.createObjectURL(f);
              pendingAIAttachments.push(f); 
            }
          });
          event.target.value = '';
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();
        }

        // Image/video attachments start out as blob: preview URLs (fast, local-only)
        const AI_CHAT_MEDIA_BUCKET = 'ai-chat-media';

        async function uploadAIChatAttachmentToStorage(f){
          const sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
          if (!sb) return null;
          try {
            const user = (typeof getCachedAuthUser === 'function') ? await getCachedAuthUser() : null;
            if (!user) return null;
            const dotIdx = f.name ? f.name.lastIndexOf('.') : -1;
            const ext = dotIdx > -1 ? f.name.slice(dotIdx + 1) : ((f.type && f.type.split('/')[1]) || 'dat');
            const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
            const { error } = await sb.storage.from(AI_CHAT_MEDIA_BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream' });
            if (error) { console.warn('AI chat attachment upload failed:', error.message); return null; }
            const { data } = sb.storage.from(AI_CHAT_MEDIA_BUCKET).getPublicUrl(path);
            return (data && data.publicUrl) || null;
          } catch (err) {
            console.warn('AI chat attachment upload threw an error:', err);
            return null;
          }
        }

        // ---- Private ai-chat-media support ----
        const AI_CHAT_MEDIA_URL_MARK = '/storage/v1/object/public/ai-chat-media/';
        const aiChatMediaSignedCache = new Map(); // path -> { url, exp }

        function aiChatMediaPathFromUrl(u){
          if (typeof u !== 'string') return null;
          const i = u.indexOf(AI_CHAT_MEDIA_URL_MARK);
          if (i < 0) return null;
          try { return decodeURIComponent(u.slice(i + AI_CHAT_MEDIA_URL_MARK.length).split('?')[0]); }
          catch (e) { return null; }
        }

        async function signAIChatMediaUrl(u){
          const path = aiChatMediaPathFromUrl(u);
          if (!path) return null;
          const hit = aiChatMediaSignedCache.get(path);
          if (hit && hit.exp > Date.now() + 60000) return hit.url;
          const sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
          if (!sb) return null;
          try {
            const { data, error } = await sb.storage.from(AI_CHAT_MEDIA_BUCKET).createSignedUrl(path, 3600);
            if (error || !data || !data.signedUrl) return null;
            aiChatMediaSignedCache.set(path, { url: data.signedUrl, exp: Date.now() + 3600 * 1000 });
            return data.signedUrl;
          } catch (e) { return null; }
        }

        function fixAIChatMediaEl(el){
          if (!el || el.nodeType !== 1) return;
          const nodes = (el.matches && el.matches('img[src],video[src]')) ? [el] : [];
          if (el.querySelectorAll) el.querySelectorAll('img[src],video[src]').forEach(n => nodes.push(n));
          nodes.forEach(n => {
            const src = n.getAttribute('src');
            if (!aiChatMediaPathFromUrl(src)) return;
            signAIChatMediaUrl(src).then(signed => { if (signed && n.getAttribute('src') === src) n.setAttribute('src', signed); });
          });
        }

        (function startAIChatMediaSigner(){
          if (window.__aiChatMediaSigner || typeof MutationObserver === 'undefined') return;
          window.__aiChatMediaSigner = true;
          const start = () => {
            fixAIChatMediaEl(document.body);
            new MutationObserver(muts => {
              muts.forEach(m => {
                if (m.type === 'attributes') fixAIChatMediaEl(m.target);
                else m.addedNodes.forEach(fixAIChatMediaEl);
              });
            }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
          };
          if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
        })();

        function persistAIChatAttachments(attachments){
          const mediaFiles = (attachments || []).filter(f => f && f.previewUrl);
          if (!mediaFiles.length) return;
          Promise.all(mediaFiles.map(f => uploadAIChatAttachmentToStorage(f).then(url => ({ f, url })))).then(results => {
            let changed = false;
            results.forEach(({ f, url }) => {
              if (!url) return;
              const oldBlobUrl = f.previewUrl;
              f.previewUrl = url;
              f.url = url;
              if (typeof oldBlobUrl === 'string' && oldBlobUrl.indexOf('blob:') === 0) URL.revokeObjectURL(oldBlobUrl);
              changed = true;
            });
            if (changed) {
              refreshAIChatLog();
              if (typeof queueSaveUserState === 'function') queueSaveUserState();
            }
          });
        }

        function removeAIAttachment(i){
          const f = pendingAIAttachments[i];
          if (f && f.previewUrl) URL.revokeObjectURL(f.previewUrl);
          pendingAIAttachments.splice(i, 1);
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();
        }

        function handleAIChatInputKeydown(event){
          const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          if (isTouchDevice) return;
          if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            sendAIMessage();
          }
        }

        let aiChatInputFocused = false;

        function syncAIClassKeyboardInset(){
          const ov = document.getElementById('overlay');
          if (!ov || ov.classList.contains('hidden')) return;
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind !== 'aiClass') return;
          const navH = typeof activeNavBarHeight === 'function' ? activeNavBarHeight() : 0;
          const composerWrap = document.getElementById('ai-composer-wrap');
          const classroomNavEl = document.getElementById('classroom-nav');
          if (typeof setConvoKbFiller === 'function') setConvoKbFiller(!!aiChatInputFocused);
          if (!aiChatInputFocused) {
            ov.style.bottom = navH + 'px';
            if (composerWrap) composerWrap.style.paddingBottom = '20px';
            if (classroomNavEl) classroomNavEl.style.display = '';
            return;
          }
          const keyboardInset = getKeyboardInset(true);
          ov.style.bottom = keyboardInset + 'px';
          if (composerWrap) composerWrap.style.paddingBottom = '10px';
          if (classroomNavEl) classroomNavEl.style.display = 'none';
        }
        let aiClassInsetRAF = null;
        function scheduleAIClassKeyboardInsetSync(){
          if (aiClassInsetRAF !== null) return;
          aiClassInsetRAF = requestAnimationFrame(() => {
            aiClassInsetRAF = null;
            syncAIClassKeyboardInset();
          });
        }
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', scheduleAIClassKeyboardInsetSync);
          window.visualViewport.addEventListener('scroll', scheduleAIClassKeyboardInsetSync);
        }
        if (navigator.virtualKeyboard) {
          navigator.virtualKeyboard.addEventListener('geometrychange', scheduleAIClassKeyboardInsetSync);
        }

        function handleAIChatInputFocus(){
          aiChatInputFocused = true;
          syncAIClassKeyboardInset();
          // Re-check as the keyboard settles so the input row (send / mic) lands right above it.
          [120, 300, 600].forEach(ms => setTimeout(() => { if (aiChatInputFocused) syncAIClassKeyboardInset(); }, ms));
          hideAIRobot();
        }

        function handleAIChatInputBlur(){
          aiChatInputFocused = false;
          setTimeout(syncAIClassKeyboardInset, 60);
          const inputEl = document.getElementById('ai-chat-input');
          if (!inputEl || !inputEl.value.trim()) showAIRobot();
        }

        function autoGrowAIChatInput(el){
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
        }

        function resetAIChatInputHeight(){
          const inputEl = document.getElementById('ai-chat-input');
          if (inputEl) inputEl.style.height = 'auto';
        }

        const AI_ROBOT_POSES = [
          { id: 'point', src: 'assets/stitch-robot-point.png' },
          { id: 'wave-open', src: 'assets/stitch-robot-wave-open.png' },
          { id: 'wave-fingers', src: 'assets/stitch-robot-wave-fingers.png' },
          { id: 'cheer-fist', src: 'assets/stitch-robot-cheer-fist.png' },
        ];

        const AI_ROBOT_POSE_KEY = 'stitch-ai-robot-pose';
        let _aiRobotPoseFallback = null;

        // ---- Stitch Bot avatar/pose + input keyboard handling ----
        function _aiRobotPoseStorage(){
          try { return isNativeApp() ? window.localStorage : window.sessionStorage; }
          catch (e) { return null; }
        }

        function currentAIRobotPose(){
          const store = _aiRobotPoseStorage();
          let id = null;
          try { id = store && store.getItem(AI_ROBOT_POSE_KEY); } catch (e) {}
          id = id || _aiRobotPoseFallback;
          const found = AI_ROBOT_POSES.find(p => p.id === id);
          return found || AI_ROBOT_POSES[0];
        }

        function rollAIRobotPoseForNewLogin(){
          const pose = AI_ROBOT_POSES[Math.floor(Math.random() * AI_ROBOT_POSES.length)];
          _aiRobotPoseFallback = pose.id;
          const store = _aiRobotPoseStorage();
          try { if (store) store.setItem(AI_ROBOT_POSE_KEY, pose.id); } catch (e) {}
          return pose;
        }

        function aiRobotRandomPoseSrc(){
          return currentAIRobotPose().src;
        }

        function preloadAppImageAssets(){
          const srcs = [
            ...AI_ROBOT_POSES.map(p => p.src),
            'assets/practice/practice-tests.png',
            'assets/practice/challenge-arena.png',
            'assets/practice/flashcards.png',
          ];
          srcs.forEach(src => { const img = new Image(); img.src = src; });
        }

        function hideAIRobot(){
          const container = document.getElementById('ai-robot-container');
          if (container) container.classList.add('ai-robot-hidden');
        }

        function showAIRobot(){
          const container = document.getElementById('ai-robot-container');
          if (container) container.classList.remove('ai-robot-hidden');
        }

        let aiEditingMessageId = null;

        // ---- AI chat log rendering + rich text formatting ----
        function aiChatLogHTML(){
          if (!aiChatMessages.length) return aiChatEmptyStateHTML();
          const bubbles = aiChatMessages.map((m, i) => m.role === 'bot' ? aiBotBubble(m.text, i, m.promptLimit, m.image, m.mediaType) : aiUserBubble(m.text, m.attachments, i, i === aiEditingMessageId, m.voice)).join('');
          return bubbles;
        }

        function aiChatEmptyStateHTML(){
          return `
            <div class="h-full min-h-full flex flex-col items-center justify-center text-center px-8">
              <div id="ai-robot-container" class="ai-robot-container"></div>
            </div>`;
        }

        function refreshAIChatLog(scrollToBottom){
          const log = document.getElementById('ai-chat-log');
          if (log) {
            log.innerHTML = aiChatLogHTML();
            if (scrollToBottom) log.scrollTop = log.scrollHeight;
            renderPendingMermaidDiagrams();
          }
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
        }

        let aiMermaidIdCounter = 0;
        function formatAIText(raw){
          if (!raw) return '';
          let text = String(raw);

          const mermaidBlocks = [];
          text = text.replace(/```mermaid\s*([\s\S]*?)```/g, (_, code) => {
            const id = 'ai-mermaid-' + (++aiMermaidIdCounter);
            mermaidBlocks.push(`<div class="ai-mermaid-diagram my-2 rounded-xl overflow-x-auto bg-white p-2" id="${id}">${escapeHtml(code.trim())}</div>`);
            return `@@MERMAID${mermaidBlocks.length - 1}@@`;
          });

          const graphBlocks = [];
          text = text.replace(/```graph\s*([\s\S]*?)```/g, (_, spec) => {
            graphBlocks.push(renderGraphBlock(spec));
            return `@@GRAPH${graphBlocks.length - 1}@@`;
          });

          const mathBlocks = [];
          const renderMath = (expr, displayMode) => {
            let html;
            try {
              html = (typeof katex !== 'undefined')
                ? katex.renderToString(expr, { throwOnError: false, displayMode })
                : escapeHtml(displayMode ? `$$${expr}$$` : `$${expr}$`);
            } catch (err) {
              html = escapeHtml(displayMode ? `$$${expr}$$` : `$${expr}$`);
            }
            mathBlocks.push(html);
            return `@@MATH${mathBlocks.length - 1}@@`;
          };
          text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => renderMath(expr.trim(), true));
          text = text.replace(/\$([^\$\n]+?)\$/g, (_, expr) => renderMath(expr.trim(), false));

          text = text.replace(/\$\$/g, '');
          if ((text.match(/\$/g) || []).length % 2 === 1) {
            text = text.replace(/\$([^\$]*)$/, '$1');
          }

          const withBold = text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
          const cleaned = withBold.replace(/\*\*/g, '');

          const tableBlocks = [];
          const cleanedLines = cleaned.split(/\n/);
          const linesWithTables = [];
          for (let i = 0; i < cleanedLines.length; i++) {
            const line = cleanedLines[i];
            const next = cleanedLines[i + 1];
            const looksLikeHeader = /\|/.test(line) && line.trim().length;
            const looksLikeSeparator = next !== undefined && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(next);
            if (looksLikeHeader && looksLikeSeparator) {
              const tableRows = [line, next];
              let j = i + 2;
              while (j < cleanedLines.length && /\|/.test(cleanedLines[j]) && cleanedLines[j].trim().length) {
                tableRows.push(cleanedLines[j]);
                j++;
              }
              tableBlocks.push(renderMarkdownTableBlock(tableRows));
              linesWithTables.push(`@@TABLE${tableBlocks.length - 1}@@`);
              i = j - 1;
            } else {
              linesWithTables.push(line);
            }
          }
          const lines = linesWithTables;
          let html = '';
          let listBuffer = [];
          let listType = null; 
          const flushList = () => {
            if (!listBuffer.length) { listType = null; return; }
            const tag = listType === 'ol' ? 'ol' : 'ul';
            const cls = listType === 'ol' ? 'list-decimal' : 'list-disc';
            html += `<${tag} class="${cls} pl-5 my-1.5 space-y-1">${listBuffer.map(li => `<li>${li}</li>`).join('')}</${tag}>`;
            listBuffer = [];
            listType = null;
          };
          lines.forEach(line => {
            const trimmed = line.trim();
            const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
            const numberMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
            if (bulletMatch) {
              if (listType && listType !== 'ul') flushList();
              listType = 'ul';
              listBuffer.push(bulletMatch[1]);
            } else if (numberMatch) {
              if (listType && listType !== 'ol') flushList();
              listType = 'ol';
              listBuffer.push(numberMatch[1]);
            } else {
              flushList();
              if (trimmed === '') html += '<div class="h-2"></div>';
              else html += `<div>${line}</div>`;
            }
          });
          flushList();

          // Tables get rendered into HTML and spliced back in via @@TABLE#@@ *before* the
          // math/mermaid/graph placeholders are resolved below, so a table cell containing
          html = html.replace(/@@TABLE(\d+)@@/g, (_, i) => tableBlocks[Number(i)] || '');
          html = html.replace(/@@MATH(\d+)@@/g, (_, i) => mathBlocks[Number(i)] || '');
          html = html.replace(/@@MERMAID(\d+)@@/g, (_, i) => mermaidBlocks[Number(i)] || '');
          html = html.replace(/@@GRAPH(\d+)@@/g, (_, i) => graphBlocks[Number(i)] || '');
          return html;
        }

        // Parses one markdown table row ("| a | b |" or "a | b") into cells.
        function parseMarkdownTableRow(row){
          let r = row.trim();
          if (r.startsWith('|')) r = r.slice(1);
          if (r.endsWith('|')) r = r.slice(0, -1);
          return r.split('|').map(c => c.trim());
        }

        // Renders a block of raw markdown table lines (header, separator, data rows...) as a real
        // HTML table, styled to match the other AI-drawn tables (renderMatrixBlock) so it looks
        function renderMarkdownTableBlock(tableLines){
          try {
            const header = parseMarkdownTableRow(tableLines[0]);
            const sepCells = parseMarkdownTableRow(tableLines[1]);
            const aligns = sepCells.map(c => {
              const left = c.startsWith(':'), right = c.endsWith(':');
              if (left && right) return 'center';
              if (right) return 'right';
              if (left) return 'left';
              return null;
            });
            const bodyRows = tableLines.slice(2).map(parseMarkdownTableRow).filter(cells => cells.some(c => c !== ''));
            let table = '<table style="border-collapse:collapse;width:100%;font-size:12.5px;">';
            table += '<tr>';
            header.forEach((h, i) => {
              const align = aligns[i] ? `text-align:${aligns[i]};` : '';
              table += `<th style="border:1px solid rgba(10,37,64,0.12);background:rgba(10,37,64,0.03);padding:6px 8px;color:${NAVY};font-weight:600;white-space:nowrap;${align}">${h}</th>`;
            });
            table += '</tr>';
            bodyRows.forEach(cells => {
              table += '<tr>';
              header.forEach((_, i) => {
                const align = aligns[i] ? `text-align:${aligns[i]};` : '';
                const val = cells[i] !== undefined ? cells[i] : '';
                table += `<td style="border:1px solid rgba(10,37,64,0.12);padding:6px 8px;${align}">${val}</td>`;
              });
              table += '</tr>';
            });
            table += '</table>';
            return `<div class="my-2 rounded-xl bg-white p-2 overflow-x-auto" style="border:1px solid rgba(10,37,64,0.06);">${table}</div>`;
          } catch (err) {
            return tableLines.map(l => escapeHtml(l)).join('<br>');
          }
        }

        const GRAPH_COLORS = ['#1E90FF', '#E4572E', '#2EA043', '#8E44AD', '#F4A100'];
        // ---- AI-generated charts/graphs/tables in chat ----
        function graphNiceStep(range){
          if (!(range > 0)) return 1;
          const rough = range / 8;
          const mag = Math.pow(10, Math.floor(Math.log10(rough)));
          const norm = rough / mag;
          const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
          return step * mag;
        }
        function renderGraphBlock(rawSpec){
          try {
            const spec = JSON.parse(rawSpec);
            if (spec.type === 'matrix') return renderMatrixBlock(spec);
            if (spec.type === 'bar') return renderBarBlock(spec);
            const elements = Array.isArray(spec.elements) ? spec.elements : [];

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            const seen = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
            elements.forEach(el => {
              if (el.type === 'curve' || el.type === 'polygon') (el.points || []).forEach(p => seen(p[0], p[1]));
              else if (el.type === 'line') { seen(el.from[0], el.from[1]); seen(el.to[0], el.to[1]); }
              else if (el.type === 'circle') { seen(el.center[0] - el.radius, el.center[1] - el.radius); seen(el.center[0] + el.radius, el.center[1] + el.radius); }
              else if (el.type === 'point' || el.type === 'label') seen(el.at[0], el.at[1]);
            });
            if (!isFinite(minX)) { minX = -10; maxX = 10; minY = -10; maxY = 10; }

            let [xmin, xmax] = Array.isArray(spec.xRange) ? spec.xRange : [minX, maxX];
            let [ymin, ymax] = Array.isArray(spec.yRange) ? spec.yRange : [minY, maxY];
            if (!(xmax > xmin)) { xmin -= 1; xmax += 1; }
            if (!(ymax > ymin)) { ymin -= 1; ymax += 1; }
            const padX = (xmax - xmin) * 0.1, padY = (ymax - ymin) * 0.1;
            xmin -= padX; xmax += padX; ymin -= padY; ymax += padY;

            const rangeX = xmax - xmin, rangeY = ymax - ymin;
            const MAX_PX = 240;
            const ppu = MAX_PX / Math.max(rangeX, rangeY); 
            const chartW = rangeX * ppu, chartH = rangeY * ppu;
            const pad = 26; 
            const svgW = chartW + pad * 2, svgH = chartH + pad * 2;
            const toPx = (x, y) => [pad + (x - xmin) * ppu, pad + (ymax - y) * ppu];

            let svg = '';
            const stepX = graphNiceStep(rangeX), stepY = graphNiceStep(rangeY);
            if (spec.grid !== false) {
              svg += '<g stroke="rgba(10,37,64,0.08)" stroke-width="1">';
              for (let gx = Math.ceil(xmin / stepX) * stepX; gx <= xmax; gx += stepX) {
                const [px] = toPx(gx, 0);
                svg += `<line x1="${px.toFixed(1)}" y1="${pad}" x2="${px.toFixed(1)}" y2="${(pad + chartH).toFixed(1)}"/>`;
              }
              for (let gy = Math.ceil(ymin / stepY) * stepY; gy <= ymax; gy += stepY) {
                const [, py] = toPx(0, gy);
                svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${(pad + chartW).toFixed(1)}" y2="${py.toFixed(1)}"/>`;
              }
              svg += '</g>';
            }
            svg += '<g stroke="rgba(10,37,64,0.45)" stroke-width="1.5">';
            if (ymin <= 0 && ymax >= 0) { const [, py] = toPx(0, 0); svg += `<line x1="${pad}" y1="${py.toFixed(1)}" x2="${(pad + chartW).toFixed(1)}" y2="${py.toFixed(1)}"/>`; }
            if (xmin <= 0 && xmax >= 0) { const [px] = toPx(0, 0); svg += `<line x1="${px.toFixed(1)}" y1="${pad}" x2="${px.toFixed(1)}" y2="${(pad + chartH).toFixed(1)}"/>`; }
            svg += '</g>';
            svg += '<g font-size="8.5" fill="rgba(10,37,64,0.55)" font-family="sans-serif">';
            if (ymin <= 0 && ymax >= 0) {
              for (let gx = Math.ceil(xmin / stepX) * stepX; gx <= xmax; gx += stepX) {
                if (Math.abs(gx) < stepX / 1000) continue;
                const [px, py0] = toPx(gx, 0);
                svg += `<text x="${px.toFixed(1)}" y="${(py0 + 11).toFixed(1)}" text-anchor="middle">${Number(gx.toFixed(4))}</text>`;
              }
            }
            if (xmin <= 0 && xmax >= 0) {
              for (let gy = Math.ceil(ymin / stepY) * stepY; gy <= ymax; gy += stepY) {
                if (Math.abs(gy) < stepY / 1000) continue;
                const [px0, py] = toPx(0, gy);
                svg += `<text x="${(px0 - 4).toFixed(1)}" y="${(py + 3).toFixed(1)}" text-anchor="end">${Number(gy.toFixed(4))}</text>`;
              }
            }
            svg += '</g>';

            let colorI = 0;
            const legend = [];
            elements.forEach(el => {
              const color = el.color || GRAPH_COLORS[colorI++ % GRAPH_COLORS.length];
              if (el.label && (el.type === 'curve' || el.type === 'polygon' || el.type === 'circle')) legend.push({ color, label: el.label });
              if (el.type === 'curve') {
                const d = (el.points || []).map((p, i) => `${i === 0 ? 'M' : 'L'}${toPx(p[0], p[1]).map(n => n.toFixed(1)).join(',')}`).join(' ');
                svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.25"/>`;
              } else if (el.type === 'line') {
                const [x1, y1] = toPx(el.from[0], el.from[1]), [x2, y2] = toPx(el.to[0], el.to[1]);
                svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2"${el.dashed ? ' stroke-dasharray="5,4"' : ''}/>`;
              } else if (el.type === 'circle') {
                const [cx, cy] = toPx(el.center[0], el.center[1]);
                svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(el.radius * ppu).toFixed(1)}" fill="${el.fill ? color + '33' : 'none'}" stroke="${color}" stroke-width="2"/>`;
              } else if (el.type === 'polygon') {
                const pts = (el.points || []).map(p => toPx(p[0], p[1]).map(n => n.toFixed(1)).join(',')).join(' ');
                svg += `<polygon points="${pts}" fill="${el.fill ? color + '33' : 'none'}" stroke="${color}" stroke-width="2"/>`;
              } else if (el.type === 'point') {
                const [px, py] = toPx(el.at[0], el.at[1]);
                svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="${color}"/>`;
                if (el.label) svg += `<text x="${(px + 6).toFixed(1)}" y="${(py - 6).toFixed(1)}" font-size="10.5" font-family="sans-serif" fill="${NAVY}">${escapeHtml(String(el.label))}</text>`;
              } else if (el.type === 'label') {
                const [px, py] = toPx(el.at[0], el.at[1]);
                svg += `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" font-size="10.5" font-family="sans-serif" fill="${NAVY}">${escapeHtml(String(el.text || ''))}</text>`;
              }
            });

            const legendHTML = legend.length ? `
              <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 px-0.5">
                ${legend.map(l => `<span class="inline-flex items-center gap-1 text-[11px] text-gray-500"><span style="width:9px;height:9px;border-radius:9999px;background:${l.color};display:inline-block;"></span>${escapeHtml(l.label)}</span>`).join('')}
              </div>` : '';
            const titleHTML = spec.title ? `<div class="text-[12px] font-semibold text-gray-500 mb-1 px-0.5">${escapeHtml(String(spec.title))}</div>` : '';
            return `
              <div class="ai-graph-plot my-2 rounded-xl bg-white p-3">
                ${titleHTML}
                <svg viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" width="100%" style="max-width:280px;display:block;margin:0 auto;">${svg}</svg>
                ${legendHTML}
              </div>`;
          } catch (err) {
            return `<div class="ai-graph-plot my-2 rounded-xl bg-white p-3 text-[13px] text-gray-400">Couldn't draw that graph.</div>`;
          }
        }

        function renderMatrixBlock(spec){
          try {
            const rows = Array.isArray(spec.rows) ? spec.rows : [];
            const cols = Array.isArray(spec.cols) ? spec.cols : [];
            const cells = Array.isArray(spec.cells) ? spec.cells : [];
            if (!rows.length || !cols.length) throw new Error('empty matrix');
            const highlightSet = new Set((Array.isArray(spec.highlight) ? spec.highlight : []).map(p => `${p[0]},${p[1]}`));
            const titleHTML = spec.title ? `<div class="text-[12px] font-semibold text-gray-500 mb-1.5 px-0.5">${escapeHtml(String(spec.title))}</div>` : '';
            const colHeaderLabel = spec.colPlayer ? `<div class="text-[10.5px] text-gray-400 text-center mb-0.5">${escapeHtml(String(spec.colPlayer))}</div>` : '';
            const rowHeaderLabel = spec.rowPlayer ? `<div class="text-[10.5px] text-gray-400" style="writing-mode:vertical-rl;transform:rotate(180deg);text-align:center;">${escapeHtml(String(spec.rowPlayer))}</div>` : '';
            let table = '<table style="border-collapse:collapse;width:100%;font-size:11.5px;">';
            table += '<tr>';
            table += rowHeaderLabel ? `<td rowspan="${rows.length + 1}" style="width:16px;padding:0;">${rowHeaderLabel}</td>` : '';
            table += `<th style="border:1px solid rgba(10,37,64,0.12);background:rgba(10,37,64,0.03);padding:6px 8px;"></th>`;
            cols.forEach(c => { table += `<th style="border:1px solid rgba(10,37,64,0.12);background:rgba(10,37,64,0.03);padding:6px 8px;color:${NAVY};font-weight:600;">${escapeHtml(String(c))}</th>`; });
            table += '</tr>';
            rows.forEach((r, ri) => {
              table += '<tr>';
              table += `<th style="border:1px solid rgba(10,37,64,0.12);background:rgba(10,37,64,0.03);padding:6px 8px;color:${NAVY};font-weight:600;text-align:left;">${escapeHtml(String(r))}</th>`;
              cols.forEach((c, ci) => {
                const val = (cells[ri] && cells[ri][ci] !== undefined) ? cells[ri][ci] : '';
                const isHi = highlightSet.has(`${ri},${ci}`);
                table += `<td style="border:1px solid rgba(10,37,64,0.12);padding:6px 8px;text-align:center;${isHi ? `background:${GRAPH_COLORS[4]}22;font-weight:600;` : ''}">${escapeHtml(String(val))}</td>`;
              });
              table += '</tr>';
            });
            table += '</table>';
            const colBlock = colHeaderLabel ? `${colHeaderLabel}` : '';
            return `
              <div class="ai-graph-plot my-2 rounded-xl bg-white p-3 overflow-x-auto">
                ${titleHTML}
                ${colBlock}
                ${table}
              </div>`;
          } catch (err) {
            return `<div class="ai-graph-plot my-2 rounded-xl bg-white p-3 text-[13px] text-gray-400">Couldn't draw that matrix.</div>`;
          }
        }

        function renderBarBlock(spec){
          try {
            const categories = Array.isArray(spec.categories) ? spec.categories : [];
            const series = Array.isArray(spec.series) ? spec.series : [];
            if (!categories.length || !series.length) throw new Error('empty bar chart');
            let maxVal = 0, minVal = 0;
            series.forEach(s => (s.values || []).forEach(v => { if (v > maxVal) maxVal = v; if (v < minVal) minVal = v; }));
            if (maxVal === minVal) maxVal = minVal + 1;
            const chartH = 160, chartW = Math.max(240, categories.length * series.length * 34 + categories.length * 14);
            const padL = 30, padB = 20, padT = 10, padR = 8;
            const plotH = chartH, plotW = chartW;
            const svgW = plotW + padL + padR, svgH = plotH + padT + padB;
            const zeroY = padT + plotH * (maxVal / (maxVal - minVal));
            const groupW = plotW / categories.length;
            const barW = Math.min(28, (groupW * 0.7) / series.length);
            let svg = '';
            svg += `<line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${(padL + plotW).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="rgba(10,37,64,0.35)" stroke-width="1.5"/>`;
            svg += `<text x="${(padL - 4).toFixed(1)}" y="${(padT + 4).toFixed(1)}" font-size="8.5" fill="rgba(10,37,64,0.55)" text-anchor="end" font-family="sans-serif">${Number(maxVal.toFixed(2))}</text>`;
            if (minVal < 0) svg += `<text x="${(padL - 4).toFixed(1)}" y="${(padT + plotH + 3).toFixed(1)}" font-size="8.5" fill="rgba(10,37,64,0.55)" text-anchor="end" font-family="sans-serif">${Number(minVal.toFixed(2))}</text>`;
            const legend = [];
            categories.forEach((cat, ci) => {
              const groupX = padL + ci * groupW + (groupW - barW * series.length) / 2;
              series.forEach((s, si) => {
                const color = s.color || GRAPH_COLORS[si % GRAPH_COLORS.length];
                if (ci === 0 && s.name) legend.push({ color, label: s.name });
                const v = (s.values && s.values[ci] !== undefined) ? s.values[ci] : 0;
                const barH = Math.abs(v) / (maxVal - minVal) * plotH;
                const x = groupX + si * barW;
                const y = v >= 0 ? zeroY - barH : zeroY;
                svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 2).toFixed(1)}" height="${Math.max(0, barH).toFixed(1)}" fill="${color}" rx="2"/>`;
              });
              const [labelX] = [padL + ci * groupW + groupW / 2];
              svg += `<text x="${labelX.toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" font-size="9" fill="rgba(10,37,64,0.6)" text-anchor="middle" font-family="sans-serif">${escapeHtml(String(cat))}</text>`;
            });
            const legendHTML = legend.length ? `
              <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 px-0.5">
                ${legend.map(l => `<span class="inline-flex items-center gap-1 text-[11px] text-gray-500"><span style="width:9px;height:9px;border-radius:2px;background:${l.color};display:inline-block;"></span>${escapeHtml(l.label)}</span>`).join('')}
              </div>` : '';
            const titleHTML = spec.title ? `<div class="text-[12px] font-semibold text-gray-500 mb-1 px-0.5">${escapeHtml(String(spec.title))}</div>` : '';
            const yLabelHTML = spec.yLabel ? `<div class="text-[10.5px] text-gray-400 mb-0.5 px-0.5">${escapeHtml(String(spec.yLabel))}</div>` : '';
            return `
              <div class="ai-graph-plot my-2 rounded-xl bg-white p-3 overflow-x-auto">
                ${titleHTML}${yLabelHTML}
                <svg viewBox="0 0 ${svgW.toFixed(1)} ${svgH.toFixed(1)}" width="100%" height="${chartH + padT + padB}" style="max-width:320px;display:block;margin:0 auto;">${svg}</svg>
                ${legendHTML}
              </div>`;
          } catch (err) {
            return `<div class="ai-graph-plot my-2 rounded-xl bg-white p-3 text-[13px] text-gray-400">Couldn't draw that chart.</div>`;
          }
        }

        function renderPendingMermaidDiagrams(){
          if (typeof mermaid === 'undefined' || typeof mermaid.run !== 'function') return;
          const nodes = Array.from(document.querySelectorAll('.ai-mermaid-diagram:not([data-mermaid-rendered])'));
          if (!nodes.length) return;
          nodes.forEach(n => n.setAttribute('data-mermaid-rendered', '1'));
          mermaid.run({ nodes }).catch(() => {});
        }

        // ---- AI chat bubbles (bot/user, edit, copy, download) ----
        function plainTextFromAIMessage(text){
          return String(text || '').replace(/<[^>]*>/g, '').replace(/\*\*/g, '').trim();
        }

        function copyAIMessage(id){
          const msg = aiChatMessages[id];
          const plain = plainTextFromAIMessage(msg && msg.text);
          if (!plain) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(plain)
              .then(() => pushInAppNotification('Copied', "Stitch Bot's reply was copied to your clipboard."))
              .catch(() => {});
          }
        }

        function aiThinkingIndicatorHTML(){
          return `
            <div class="flex items-center gap-2 text-gray-500">
              <span class="ai-typing-dots">${'<span></span>'.repeat(3)}</span>
            </div>`;
        }

        function aiBotBubble(text, id, promptLimit, image, mediaType){
          const isThinking = text === '···';
          const imageHTML = image ? `
            <div class="rounded-2xl overflow-hidden mb-1.5" style="max-width:100%;">
              <img src="data:${mediaType || 'image/png'};base64,${image}" class="w-full h-auto block" style="max-height:340px;object-fit:cover;">
            </div>` : '';
          return `
            <div id="ai-msg-${id}" class="flex items-start">
              <div class="min-w-0" style="max-width:85%;">
                ${imageHTML}
                ${(!isThinking && !text) ? '' : (isThinking ? `<div class="px-2 py-3">${aiThinkingIndicatorHTML()}</div>` : `<div class="ai-msg-bubble bg-gray-100 px-4 py-3.5 text-[15px] text-gray-700 leading-relaxed" style="border-radius:20px 20px 20px 0;">${formatAIText(text)}</div>`)}
                ${isThinking ? '' : `
                <div class="mt-1.5 flex items-center gap-3">
                  <button onclick="copyAIMessage(${id})" title="Copy" class="flex items-center justify-center text-gray-400">${Icon('copy','w-5 h-5')}</button>
                  ${image ? `<button onclick="downloadAIImage(${id})" title="Download" class="flex items-center justify-center text-gray-400">${Icon('download','w-5 h-5')}</button>` : ''}
                </div>`}
              </div>
            </div>`;
        }

        function downloadAIImage(id){
          const msg = aiChatMessages[id];
          if (!msg || !msg.image) return;
          const a = document.createElement('a');
          a.href = `data:${msg.mediaType || 'image/png'};base64,${msg.image}`;
          a.download = 'stitch-bot-image.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }

        function copyAIUserMessage(id){
          const msg = aiChatMessages[id];
          const plain = String((msg && msg.text) || '').trim();
          if (!plain) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(plain)
              .then(() => pushInAppNotification('Copied', 'Your message was copied to your clipboard.'))
              .catch(() => {});
          }
        }

        function startEditAIUserMessage(id){
          aiEditingMessageId = id;
          refreshAIChatLog(false);
          const ta = document.getElementById(`ai-edit-input-${id}`);
          if (ta) {
            ta.focus();
            ta.selectionStart = ta.selectionEnd = ta.value.length;
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
          }
        }

        function cancelEditAIUserMessage(){
          aiEditingMessageId = null;
          refreshAIChatLog(false);
        }

        async function saveEditAIUserMessage(id){
          const ta = document.getElementById(`ai-edit-input-${id}`);
          const newText = ta ? ta.value.trim() : '';
          if (!newText) return;
          const msg = aiChatMessages[id];
          if (!msg) return;
          msg.text = newText;
          aiChatMessages = aiChatMessages.slice(0, id + 1);
          aiEditingMessageId = null;
          const thinkingMsg = { role:'bot', text: '···' };
          aiChatMessages.push(thinkingMsg);
          refreshAIChatLog(true);
          const reply = await getAIResponse(newText, msg.attachments || []);
          thinkingMsg.text = reply.text || '';
          if (reply.image) { thinkingMsg.image = reply.image; thinkingMsg.mediaType = reply.mediaType; }
          refreshAIChatLog(true);
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function aiUserBubble(text, attachments, id, isEditing, voice){
          const imageAttachments = (attachments || []).filter(f => f.previewUrl);
          const fileAttachments = (attachments || []).filter(f => !f.previewUrl);
          const images = imageAttachments.length ? `
            <div class="flex flex-wrap gap-1">
              ${imageAttachments.map(f => `
                <div class="relative overflow-hidden flex-shrink-0" style="width:9.5rem;height:9.5rem;max-width:100%;border-radius:1rem;background:${NAVY};">
                  ${f.type && f.type.startsWith('video/')
                    ? `<video src="${f.previewUrl}" muted playsinline preload="metadata" class="absolute inset-0 w-full h-full object-cover block"></video>`
                    : `<img src="${f.previewUrl}" alt="${escapeHtml(f.name)}" onclick="openConvoImageViewer('${encodeURIComponent(f.previewUrl)}')" class="absolute inset-0 w-full h-full object-cover block cursor-pointer" />`}
                </div>`).join('')}
            </div>` : '';
          const files = fileAttachments.length ? `
            <div class="flex flex-col gap-1.5 rounded-2xl px-2.5 py-2" style="background:${NAVY};">
              ${fileAttachments.map(f => `
                <div class="flex items-center gap-2.5 bg-white/15 rounded-xl px-2.5 py-1.5">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white" style="background:${ROYAL};">${Icon(aiFileIcon(f.type),'w-4 h-4')}</div><span class="text-xs text-white truncate">${escapeHtml(f.name)}</span>
                </div>`).join('')}
            </div>` : '';
          const voiceBadge = voice ? `<span class="inline-flex items-center justify-center mr-1.5 align-middle" style="opacity:0.5;">${Icon('mic','w-3.5 h-3.5 inline')}</span>` : '';
          const textBubble = text ? `
            <div class="px-4 py-3 text-[15px] text-gray-800 leading-relaxed" style="background:rgba(30,144,255,0.14); white-space:pre-wrap; border-radius:20px 20px 0 20px;">${voiceBadge}${escapeHtml(text)}</div>` : '';
          if (isEditing) {
            return `
              <div id="ai-msg-${id}" class="flex items-start justify-end gap-3">
                <div class="min-w-0 flex flex-col items-end gap-1.5 w-full" style="max-width:80%;">
                  ${images}${files}
                  <textarea id="ai-edit-input-${id}" rows="1" oninput="autoGrowAIChatInput(this)" onkeydown="handleAIEditInputKeydown(event, ${id})" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-[15px] resize-none leading-relaxed" style="max-height:160px; overflow-y:auto;">${escapeHtml(text)}</textarea>
                  <div class="flex items-center gap-2">
                    <button onclick="cancelEditAIUserMessage()" class="text-[12px] font-semibold text-gray-400 px-2 py-1">Cancel</button>
                    <button onclick="saveEditAIUserMessage(${id})" class="text-[12px] font-semibold text-white px-3 py-1.5 rounded-full" style="background:${NAVY};">Save</button>
                  </div>
                </div>
              </div>`;
          }
          return `
            <div id="ai-msg-${id}" class="flex items-start justify-end gap-3">
              <div class="min-w-0 flex flex-col items-end gap-1.5" style="max-width:80%;">
                ${images}${files}${textBubble}
              </div>
            </div>`;
        }

        function handleAIEditInputKeydown(event, id){
          const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          if (isTouchDevice) return;
          if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            saveEditAIUserMessage(id);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelEditAIUserMessage();
          }
        }

        function aiTopicChip(label){
          return `<button onclick="sendAIMessage('${label}')" class="bg-white border border-gray-200 rounded-2xl px-3 py-2 text-[11px] font-semibold text-[${NAVY}] text-left leading-snug min-w-0">${label}</button>`;
        }

        async function sendAIMessage(preset, viaVoice){
          const inputEl = document.getElementById('ai-chat-input');
          const text = (preset !== undefined ? preset : (inputEl ? inputEl.value : '')).trim();
          const attachments = pendingAIAttachments;
          if (!text && !attachments.length) return;
          if (typeof canSendAIPrompt === 'function' && !canSendAIPrompt()) {
            const window = (typeof aiPromptLimitWindowHit === 'function') ? aiPromptLimitWindowHit() : 'daily';
            const windowMsg = window === 'monthly'
              ? `You've used all your Stitch Bot credits for this month. They reset on the 1st.`
              : window === 'weekly'
              ? `You've used all your Stitch Bot credits for this week. They reset next week.`
              : `You've used all your daily Stitch Bot credits for today. They reset tomorrow.`;
            aiChatMessages.push({ role:'user', text, attachments, voice: !!viaVoice });
            aiChatMessages.push({ role:'bot', text: windowMsg, promptLimit: true });
            persistAIChatAttachments(attachments);
            pendingAIAttachments = [];
            if (inputEl) { inputEl.value = ''; }
            resetAIChatInputHeight();
            if (typeof syncAIClassKeyboardInset === 'function') syncAIClassKeyboardInset();
            refreshAIChatLog(true);
            const attachStrip = document.getElementById('ai-attach-strip');
            if (attachStrip) attachStrip.innerHTML = aiAttachStripHTML();
            if (typeof queueSaveUserState === 'function') queueSaveUserState();
            return;
          }
          pendingAIAttachments = [];
          aiChatMessages.push({ role:'user', text, attachments, voice: !!viaVoice });
          persistAIChatAttachments(attachments);
          const thinkingMsg = { role:'bot', text: '···' };
          aiChatMessages.push(thinkingMsg);
          if (inputEl) { inputEl.value = ''; }
          resetAIChatInputHeight();
          if (typeof syncAIClassKeyboardInset === 'function') syncAIClassKeyboardInset();
          refreshAIChatLog(true);
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();

          attachments.filter(f => /\.(pdf|docx|pptx)$/i.test(f.name)).forEach(f => processUploadedResource(f));

          if (typeof recordAIPromptUsed === 'function') recordAIPromptUsed();
          const reply = await getAIResponse(text, attachments, viaVoice);
          thinkingMsg.text = reply.text || '';
          if (reply.image) { thinkingMsg.image = reply.image; thinkingMsg.mediaType = reply.mediaType; }
          refreshAIChatLog(true);
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        // ---- AI chat voice input + message send ----
        function toggleAIVoiceInput(){
          if (aiVoiceRecording) { stopAIVoiceInput(); return; }
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SR) { flashAIMicMessage("Voice input isn't supported in this browser"); return; }
          let recognition;
          try { recognition = new SR(); } catch (err) { flashAIMicMessage('Voice input unavailable'); return; }
          const inputEl = document.getElementById('ai-chat-input');
          recognition.lang = (navigator.language || 'en-US');
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          let finalTranscript = '';
          recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) finalTranscript += res[0].transcript;
              else interim += res[0].transcript;
            }
            if (inputEl) { inputEl.value = (finalTranscript + interim).trim(); autoGrowAIChatInput(inputEl); }
          };
          recognition.onerror = (event) => {
            aiVoiceRecording = false;
            aiVoiceRecognition = null;
            setAIMicUI(false);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') flashAIMicMessage('Mic access denied');
            else if (event.error === 'no-speech') flashAIMicMessage("Didn't catch that, try again");
            else flashAIMicMessage('Voice input failed');
          };
          recognition.onend = () => {
            aiVoiceRecording = false;
            aiVoiceRecognition = null;
            setAIMicUI(false);
            const transcript = (finalTranscript || (inputEl ? inputEl.value : '')).trim();
            if (transcript) sendAIMessage(transcript, true);
          };
          try {
            recognition.start();
          } catch (err) {
            flashAIMicMessage('Voice input unavailable');
            return;
          }
          aiVoiceRecognition = recognition;
          aiVoiceRecording = true;
          setAIMicUI(true);
        }

        function stopAIVoiceInput(){
          if (aiVoiceRecognition) { try { aiVoiceRecognition.stop(); } catch (err) {} }
        }

        function setAIMicUI(on){
          const micBtn = document.getElementById('ai-mic-btn');
          if (!micBtn) return;
          micBtn.classList.toggle('bg-red-500', on);
          micBtn.classList.toggle('text-white', on);
          micBtn.innerHTML = Icon(on ? 'square' : 'mic', 'w-4 h-4');
          micBtn.style.animation = on ? 'pulse 1s infinite' : '';
          micBtn.title = on ? 'Stop and send' : 'Ask by voice';
          if (!on) { micBtn.style.background = 'rgba(10,37,64,0.06)'; micBtn.style.color = NAVY; }
          else { micBtn.style.background = ''; micBtn.style.color = ''; }
        }

        function flashAIMicMessage(msg){
          const inputEl = document.getElementById('ai-chat-input');
          if (!inputEl) return;
          const prev = 'Ask Stitch Bot anything...';
          inputEl.placeholder = msg;
          setTimeout(() => { if (inputEl) inputEl.placeholder = prev; }, 2200);
        }

        function fileToBase64(file){
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        function attachmentSummaryText(attachments){
          if (!Array.isArray(attachments) || !attachments.length) return '';
          const imgs = attachments.filter(f => f && f.type && f.type.startsWith('image/'));
          const others = attachments.filter(f => !imgs.includes(f));
          const parts = [];
          if (imgs.length) parts.push(`[sent ${imgs.length > 1 ? imgs.length + ' images' : 'an image'}${imgs[0] && imgs[0].name ? ` (${imgs.map(f => f.name).join(', ')})` : ''}]`);
          if (others.length) parts.push(`[sent file(s): ${others.map(f => f.name).join(', ')}]`);
          return parts.join(' ');
        }

        function buildAIChatMemory(){
          const priorTurns = aiChatMessages.slice(0, -2);
          const recentTurns = priorTurns.slice(-12)
            .filter(m => m.text || (m.attachments && m.attachments.length))
            .map(m => {
              const attSummary = attachmentSummaryText(m.attachments);
              const combined = [attSummary, m.text].filter(Boolean).join(' ');
              return `${m.role === 'user' ? 'Student' : 'Stitch Bot'}: ${combined}`;
            })
            .join('\n');
          const pastSessions = aiChatSessions
            .filter(s => s.summary && s.summary !== 'New chat')
            .slice(0, 8)
            .map(s => `- ${s.summary}`)
            .join('\n');
          let memory = '';
          if (recentTurns) memory += '\n\nEarlier messages in this conversation (for context, do not repeat them back):\n' + recentTurns;
          if (pastSessions) memory += '\n\nWhat you and this student talked about in past conversations (only bring one up if it is actually relevant right now, do not list them out):\n' + pastSessions;
          return memory;
        }

        const IMAGE_REQUEST_RE = /\b(draw|sketch|illustrate)\b|\b(generate|create|make)\b.{0,20}\b(image|picture|drawing|illustration|diagram|photo)\b/i;
        function isImageRequest(text){
          return IMAGE_REQUEST_RE.test(text || '');
        }

        // Matches phrases like "the screenshot I sent", "that image", "the picture I uploaded",
        // etc., so we know the student is referring back to an image from earlier in the chat
        const PAST_IMAGE_REFERENCE_RE = /\b(screenshot|screen ?shot|the (image|picture|photo|pic)|that (image|picture|photo|pic)|(i|I) (sent|uploaded|attached|shared)|sent (you|earlier)|uploaded (it|that|earlier))\b/i;
        function referencesPastImage(text){
          return PAST_IMAGE_REFERENCE_RE.test(text || '');
        }

        // Looks back through the conversation (skipping the current turn's user message and
        // "thinking" placeholder, which is why we start at length - 3) for the most recent message
        function findRecentImageAttachments(){
          for (let i = aiChatMessages.length - 3; i >= 0; i--) {
            const m = aiChatMessages[i];
            if (m && m.role === 'user' && Array.isArray(m.attachments) && m.attachments.length) {
              const imgs = m.attachments.filter(f => f && f.type && f.type.startsWith('image/') && (f instanceof Blob));
              if (imgs.length) return imgs;
            }
          }
          return [];
        }

        async function getAIResponse(text, attachments, viaVoice){
          const docs = (attachments || []).filter(f => /\.(pdf|docx|pptx)$/i.test(f.name));
          let images = (attachments || []).filter(f => !docs.includes(f) && f.type && f.type.startsWith('image/'));
          let usingPastImage = false;
          if (!images.length && referencesPastImage(text)) {
            const pastImages = findRecentImageAttachments();
            if (pastImages.length) { images = pastImages; usingPastImage = true; }
          }
          let ackLine = '';
          if (docs.length) {
            const names = docs.map(f => f.name).join(', ');
            ackLine = `<span class="inline-flex items-center gap-1 align-middle">${Icon('paperclip','w-3.5 h-3.5 inline')}</span> Scanning ${names} now: check Resources shortly for flashcards and practice questions built from ${docs.length > 1 ? 'them' : 'it'}.\n\n`;
          }
          if (!text && !images.length) return { text: ackLine || "What would you like help with?" };

          if (!images.length && isImageRequest(text)) {
            try {
              const img = await requestAIImage(text);
              return { text: ackLine, image: img.image, mediaType: img.mediaType };
            } catch (err) {
              const msg = (err && err.message) || '';
              if (msg.startsWith('Too many AI requests')) return { text: ackLine + msg };
              return { text: ackLine + "I couldn't generate that image just now, want to try again in a moment?" };
            }
          }
          try {
            const context = buildResourceContext();
            const system = 'You are Stitch Bot, a warm, encouraging AI tutor and study buddy inside a study app for students across any subject. ' +
              'Talk like a genuinely helpful, upbeat friend who is great at the subject, not like a formal textbook or a customer-support script: use natural, conversational language, contractions, the occasional casual aside, and real personality and warmth. React like a person would, not a database: get a little excited about a cool concept, empathize when something is genuinely tricky ("yeah, this one trips a lot of people up"), and celebrate a good question or a right answer instead of just moving on. Vary your openings and phrasing so replies never feel templated or copy-pasted. ' +
              'You have a genuine sense of humor: a light joke, playful aside, or bit of wit is welcome whenever it naturally fits, the way a funny friend would banter, not forced into every reply and never at the expense of actually answering the question or making light of something the student is genuinely stressed about. ' +
              'Students type fast and casually: typos, shorthand, half-finished sentences, or vague phrasing are normal, not a reason to get stuck. Do your best to work out what they actually mean from context (including what you have already talked about) and answer that, rather than taking a garbled message too literally or bouncing it back for clarification. Only ask a clarifying question when you genuinely cannot make a reasonable guess at their intent. ' +
              'You are not limited to slides, notes, or course material: you are a capable, versatile assistant the student can talk to about anything, schoolwork, a random question, something on their mind, planning something, whatever they bring up, the same way a smart friend would, while still being especially good at the studying, tutoring, and course-material side of things. ' +
              'Stay concise (2-5 sentences unless they ask for more detail or a worked example) and never let the friendly tone or the humor get in the way of being clear and accurate. ' +
              'If an image is attached, actually look at it and respond to what is in it (read handwriting, diagrams, or problems shown) rather than only acknowledging that a file was sent. ' +
              'Ground your answer in the excerpts from their uploaded resources when they are relevant to the question. ' +
              'If nothing relevant was uploaded, answer from your general knowledge instead. If someone asks what AI model or company is behind you, say you are Stitch Bot, an AI study buddy, and that you do not go into technical details about how you are built. ' +
              'Never use em dashes or double-hyphen dashes; use a comma, colon, semicolon, or a full stop instead. ' +
              'Use **double asterisks** around any word or phrase that should be bold (key terms, formulas, headings). ' +
              'When you are listing steps, options, or multiple items, format them as a numbered list (1. 2. 3.) or bullet list (- item) on their own lines instead of run-on prose. ' +
              'For tabular data, such as a worked calculation with several rows/columns (X, Y, predicted values, residuals, etc.), a comparison, or any dataset with more than a couple of columns, use a standard markdown pipe table: a header row like "| X | Y | Residual |", then a separator row like "|---|---|---|", then one data row per line. It will render as a real table, so prefer it over cramming a grid into a bullet list or plain prose. ' +
              'For any actual math, equations, or fractions, write real LaTeX and it will be rendered properly: wrap a standalone equation on its own line in double dollar signs, e.g. $$x = \\frac{585}{-111}$$, and wrap a short expression sitting inline in a sentence in single dollar signs, e.g. "solve for $x$". Always use \\frac{a}{b} for fractions rather than writing a/b, and use this for every equation, not just the final answer. ' +
              'When a simple diagram would genuinely help (a flowchart, a timeline, a cycle, a small hierarchy or mind-map, a step-by-step process), you can draw one: write it as Mermaid syntax inside a fenced code block starting with ```mermaid and ending with ```, e.g. a flowchart starting "graph TD". Keep diagrams small and only reach for one when it actually clarifies something a sentence would not; do not force one into every reply. ' +
              'For math or science questions where an actual plot or figure would help (graphing a function, showing a geometric shape, plotting points, illustrating a triangle/circle/angle problem), draw one using a fenced ```graph code block containing ONLY valid JSON, nothing else, in this shape: {"title":"optional string","xRange":[xmin,xmax],"yRange":[ymin,ymax],"elements":[...]}. xRange/yRange are optional (auto-fit if omitted). Each item in "elements" is one of: {"type":"curve","points":[[x,y],...],"label":"optional"} for a function (compute enough sample points yourself, e.g. 20-40 across the domain, to make the curve look smooth), {"type":"line","from":[x,y],"to":[x,y],"dashed":true|false} for a segment, {"type":"circle","center":[x,y],"radius":r,"fill":true|false} for a circle, {"type":"polygon","points":[[x,y],...],"fill":true|false,"label":"optional"} for a triangle/rectangle/other polygon, {"type":"point","at":[x,y],"label":"optional"} for a labeled point. x and y are always drawn to the same scale (never stretched), so shapes come out looking geometrically correct, not distorted. Do the actual math yourself (computing the curve\'s y-values, a shape\'s vertex coordinates, etc.) before writing the block; only reach for this when a picture genuinely adds clarity over just explaining it, and never put prose inside the ```graph block itself. ' +
              'The same fenced ```graph block also supports two other JSON shapes for things that are not x-y curves, picked via a top-level "type" field: (1) "type":"matrix" for a game-theory payoff matrix, truth table, or any row-by-column comparison grid: {"type":"matrix","title":"optional","rowPlayer":"optional label above the row headers","colPlayer":"optional label above the column headers","rows":["Row A","Row B"],"cols":["Col A","Col B"],"cells":[["r0c0 text","r0c1 text"],["r1c0 text","r1c1 text"]],"highlight":[[rowIndex,colIndex],...]} where cells[r][c] is the exact text to show in that cell (e.g. "(50, 50)" for a payoff pair, or a short outcome description) and "highlight" optionally marks specific cells (e.g. a Nash equilibrium) to visually stand out; use this instead of a markdown table whenever a student asks for a game-theory/strategic/decision matrix or its graph, since that is genuinely a grid, not a plot. (2) "type":"bar" for a categorical bar chart comparing values across labeled groups: {"type":"bar","title":"optional","yLabel":"optional","categories":["Q1","Q2","Q3"],"series":[{"name":"optional legend label","values":[10,20,15],"color":"optional hex"}]}, with more than one entry in "series" rendering as grouped bars per category. Reach for "matrix" or "bar" whenever the underlying thing genuinely is a grid of outcomes or a set of labeled quantities to compare, rather than forcing it into the curve/line/point shape above or declining to draw anything at all. ' +
              'When you verify or check a worked answer, do it in one short line (plug the numbers back in and confirm the result), not a second full side-by-side re-derivation: long multi-part answers are more likely to get cut off before you finish, which is worse than a shorter complete one. ' +
              'You do not recommend or rank specific jobs, internships, scholarships, or other posted opportunities, and you do not tell a student which listing is their best match. That matching is handled by a separate, dedicated feature (Match with CV, under Explore/Career Space) that actually screens every posted listing against their resume. If a student asks you to recommend, find, or match them with opportunities, or to review their resume for that purpose, tell them briefly and warmly to use Match with CV in Explore for that, rather than attempting it yourself. You can still discuss general career/resume advice (how to phrase a bullet point, what a cover letter should cover, interview prep, etc.) since that is not the same as matching them to specific listings.' +
              (studentFirstName()
                ? ` The student's first name is ${studentFirstName()}. Address them by that first name every so often (a greeting, celebrating a right answer, or checking in on something tricky) the way a friend actually would, not in every single message and never as a stiff "Hello, ${studentFirstName()}," opener glued onto every reply.`
                : ' You don\'t know the student\'s name yet (they haven\'t set one up), so just talk to them directly without a name.') +
              (context ? '\n\nExcerpts from the student\'s uploaded resources:\n' + context : '\n\nThe student has not uploaded any resources yet.') +
              buildAIChatMemory();
            const imagePayload = await Promise.all(images.map(async f => ({ mediaType: f.type || 'image/jpeg', data: await fileToBase64(f) })));
            let prompt = text || (images.length > 1 ? 'Take a look at these images and tell me what you notice, or help with what is shown.' : 'Take a look at this image and tell me what you notice, or help with what is shown.');
            if (usingPastImage) prompt += '\n\n(Re-attaching the image the student sent earlier in this chat so you can look at it again.)';
            const reply = await callClaude(system, prompt, 'chat', imagePayload);
            if (!reply) {
              window.reportError(new Error('callClaude returned an empty reply'), { call: 'getAIResponse', task: 'chat' });
              return { text: ackLine + "Sorry, that request failed. Please try again in a moment." };
            }
            return { text: ackLine + reply };
          } catch (err) {
            const msg = (err && err.message) || '';
            if (msg.startsWith('Too many AI requests')) return { text: ackLine + msg };
            // The raw AI-provider/Edge Function error used to be shown directly to the student here
            // (handy for debugging, but not something a student should ever see)
            if (typeof window !== 'undefined' && typeof window.reportError === 'function') {
              window.reportError(err instanceof Error ? err : new Error(msg || 'unknown error'), { call: 'getAIResponse', task: 'chat' });
            } else {
              console.warn('AI request failed:', msg || err);
            }
            return { text: ackLine + "Sorry, that request failed. Please try again in a moment." };
          }
        }

        // ---- AI fallback response (no-API mode) ----
        function fallbackAIResponse(text){
          const t = text.toLowerCase();
          if (t.includes('summar')) return "Sure, open Resources and upload the slides or notes you want covered, and I'll pull out the key definitions, formulas, and examples into a short summary you can study from.";
          if (t.includes('note')) return "Got it. Tell me which topic or which uploaded resource, and I'll turn it into structured notes with headings, key terms, and a quick recap at the end.";
          if (t.includes('elastic')) return "Elasticity of Demand measures how much quantity demanded changes in response to a price change. A value above 1 means demand is elastic (responsive); below 1 means it's inelastic. Want a practice question on it?";
          if (t.includes('comparative advantage')) return "Comparative Advantage is when a country or person can produce a good at a lower opportunity cost than another, even without an absolute advantage. Want an example worked out?";
          if (t.includes('quiz') || t.includes('test') || t.includes('practice')) return "I can generate a few practice questions on any topic you're studying; just tell me the topic and how many questions you'd like.";
          return "Good question: want me to explain the concept step by step, generate practice questions, or summarise/turn your uploaded materials into notes?";
        }

        const courseItemTypes = [
          { key:'video', label:'Video' },
          { key:'image', label:'Picture' },
          { key:'reading', label:'Reading' },
          { key:'assignment', label:'Assignment' },
          { key:'project', label:'Project' },
          { key:'practiceQuiz', label:'Practice Quiz' },
          { key:'gradedQuiz', label:'Graded Quiz' },
        ];
        // ---- Courses home + course card list ----
        function courseItemTypeLabel(key){
          const t = courseItemTypes.find(t => t.key === key);
          return t ? t.label : key;
        }
        function courseItemIsQuiz(type){
          return type === 'practiceQuiz' || type === 'gradedQuiz';
        }
        const courseDeliveryTypes = [
          { key:'uploaded', label:'Uploaded', description:'Self-paced -- learners work through uploaded material on their own schedule.' },
          { key:'live', label:'Live Teaching', description:'Taught in real time on a schedule, like a live class.' },
        ];
        function courseDeliveryTypeLabel(key){
          const t = courseDeliveryTypes.find(t => t.key === key);
          return t ? t.label : 'Uploaded';
        }

        let classroomAreaTab = 'classes'; 
        let classroomAreaTabSlideDir = 'left';
        const COURSES_TABLE = 'courses';

        let allCourses = [];

        // Courses that should actually be shown in a course list: hides archived (soft-deleted)
        // courses from everyone except students who are already enrolled in them, so deleting a
        function visibleCourses(){
          return allCourses.filter(c => !c.archived || enrolledCourseIds.includes(c.id));
        }
        let enrolledCourseIds = [];
        let currentCourseId = null;
        let currentCourseItemId = null;
        let courseActiveModule = 0;
        let courseDetailTab = 'content';
        let courseDetailMenuOpen = false;
        let courseQuizAnswers = {}; 
        let courseQuizSubmitted = {}; 
        let courseItemCompletions = {}; 
        let courseEnrollments = {}; 
        let courseEnrollDraft = null; 
        let newCourseDraft = null;
        let newCourseEditingId = null; 
        let newCourseAddingItemModuleIndex = null;
        let newCourseAddingItemDraft = null;
        let newCourseEditingItemIndex = null;
        let newCourseEditingItemOriginalPlacement = null;
        let coursePeopleViewingId = null; 
        let courseAnnouncementDraft = ''; 

        const TEAM_STITCH_TEACHER = 'Stitch Academy';
        // Courses saved earlier carry "Stitch" / "Stitch Team" (or nothing) as their organiser
        function stitchOrgName(org){
          const o = String(org || '').trim();
          if (!o || /^stitch(\s+team)?$/i.test(o)) return TEAM_STITCH_TEACHER;
          return o;
        }

        // The Create Course form builds on an unsaved draft
        const DRAFT_COURSE_ID = '__draft__';
        function courseForEditorPages(id){
          return id === DRAFT_COURSE_ID ? newCourseDraft : allCourses.find(x => x.id === id);
        }
        let newCourseFormScrollTop = 0;

        const COURSE_MEDIA_BUCKET = 'course-media';

        async function uploadCourseItemMediaToStorage(file, itemId){
          const sb = getSupabaseClient();
          if (!sb) return null;
          try {
            const path = `${itemId}-${escapeHtml(file.name)}`;
            const { error } = await sb.storage.from(COURSE_MEDIA_BUCKET).upload(path, file, { upsert: true });
            if (error) { console.warn('Course media upload failed (see COURSE_MEDIA_BUCKET comment above):', error.message); return null; }
            const { data } = sb.storage.from(COURSE_MEDIA_BUCKET).getPublicUrl(path);
            return (data && data.publicUrl) || null;
          } catch (err) {
            console.warn('Course media upload failed (see COURSE_MEDIA_BUCKET comment above):', err);
            return null;
          }
        }

        function resetNewCourseDraft(){
          newCourseDraft = { title:'', description:'', deliveryType:'uploaded', modules:[], resources:[], finalItems:[], photo:null, price:'', currency:'GHS' };
        }

        function triggerCoursePhotoUpload(){
          const input = document.getElementById('course-photo-input');
          if (input) input.click();
        }

        function handleCoursePhotoSelected(e){
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev){
            newCourseDraft.photo = ev.target.result;
            rerenderNewCourseOverlay();
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }

        function setClassroomAreaTab(tab){
          if (tab === classroomAreaTab) return;
          classroomAreaTabSlideDir = tab === 'courses' ? 'left' : 'right';
          classroomAreaTab = tab;
          courseCardMenuOpenId = null;
          renderStudy();
        }

        let courseCardMenuOpenId = null;

        function toggleCourseCardMenu(id, event){
          if (event) event.stopPropagation();
          courseCardMenuOpenId = (courseCardMenuOpenId === id) ? null : id;
          renderStudy();
        }

        function courseCardMenuHTML(courseId){
          return `
            <div onclick="event.stopPropagation();" class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:2.75rem;width:11rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="courseCardMenuOpenId=null; openEditCourse('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('edit','w-4 h-4')} Edit Course</button>
              <button onclick="courseCardMenuOpenId=null; openCourseEnrolledPeople('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('personPlus','w-4 h-4')} People</button>
              <button onclick="courseCardMenuOpenId=null; openCourseAnalytics('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('chart','w-4 h-4')} Course analytics</button>
              <button onclick="courseCardMenuOpenId=null; deleteCourse('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete</button>
            </div>`;
        }

        function courseTotalItems(course){
          return course.modules.reduce((n, m) => n + m.items.length, 0) + (course.finalItems ? course.finalItems.length : 0);
        }

        function isCourseItemComplete(item){
          return !!courseItemCompletions[item.id];
        }

        function courseCompletedItems(course){
          return course.modules.reduce((n, m) => n + m.items.filter(it => isCourseItemComplete(it)).length, 0)
            + (course.finalItems || []).filter(it => isCourseItemComplete(it)).length;
        }

        function courseModuleCompleted(course, mi){
          const m = course.modules[mi];
          return !!(m && m.items.length && m.items.every(it => isCourseItemComplete(it)));
        }

        // ---- Who may create / manage courses (mirrors the server rules; the server is the real
        // gate) ----
        function canCreateCourses(){
          return isCurrentUserAdmin() || currentUserCreatorStatus === 'approved';
        }
        function canManageCourse(courseOrId){
          if (isCurrentUserAdmin()) return true;
          if (currentUserCreatorStatus !== 'approved') return false;
          const c = (courseOrId && typeof courseOrId === 'object') ? courseOrId : allCourses.find(x => x.id === courseOrId);
          return !!(c && c.createdBy && typeof currentUserId !== 'undefined' && currentUserId && c.createdBy === currentUserId);
        }

        function totalCourseEnrollment(){
          return allCourses.reduce((n, c) => n + (c.enrolledCount || 0), 0);
        }

        function coursesHomeHTML(){
          const isAdmin = canCreateCourses();
          return `
            ${isAdmin ? `
              <div class="flex gap-2 mb-5">
                <button onclick="openNewCourse()" class="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                  ${Icon('plus','w-4 h-4')} Create a Course
                </button>
              </div>` : ''}
            ${visibleCourses().length ? visibleCourses().map(courseCardHTML).join('') : `
              <div class="flex flex-col items-center justify-center text-center px-3" style="min-height:calc(100dvh - 400px);">
                <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}]" style="margin-bottom:20px;">${Icon('book','w-9 h-9')}</div>
                <div class="text-base font-semibold text-gray-600">No courses yet</div>
                <div class="text-sm text-gray-400" style="max-width:280px;line-height:1.5;margin-top:8px;">Structured, self-paced courses will show up here once one is published.</div>
              </div>`}`;
        }

        function courseCardHTML(c){
          const enrolled = enrolledCourseIds.includes(c.id);
          const total = courseTotalItems(c);
          const done = courseCompletedItems(c);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const isLive = c.deliveryType === 'live';
          const isAdmin = canManageCourse(c);
          // Flat row separated by a faint line; the cover picture shows on the course page.
          return `
            <div onclick="openCourseDetail('${c.id}')" class="relative cursor-pointer" style="padding:16px 4px;border-bottom:1px solid rgba(0,0,0,0.07);">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  ${isAdmin ? `<button onclick="event.stopPropagation(); deleteCourse('${c.id}')" title="Delete course" class="w-6 h-6 -ml-1 rounded-full flex items-center justify-center text-gray-400 flex-shrink-0">${Icon('trash','w-3.5 h-3.5')}</button>` : ''}
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400 truncate">${escapeHtml(stitchOrgName(c.org))}</div>
                  ${isLive ? `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 bg-red-100 text-red-600">● Live</span>` : ''}
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                                    ${enrolled ? `<span class="text-[10px] font-bold uppercase text-emerald-500 flex-shrink-0">Enrolled</span>` : ''}
                </div>
              </div>
              <div class="text-lg font-bold font-display mb-1 text-gray-800">${escapeHtml(c.title)}</div>
              <div class="text-xs text-gray-400">${c.modules.length} module${c.modules.length === 1 ? '' : 's'} · ${total} lesson${total === 1 ? '' : 's'}${enrolled ? ` · ${pct}% complete` : ''}</div>
            </div>`;
        }

        function openCourseDetail(id){
          currentCourseId = id;
          courseActiveModule = 0;
          courseDetailTab = 'content';
          courseDetailMenuOpen = false;
          openOverlay('courseDetail');
        }

        function toggleCourseDetailMenu(){
          courseDetailMenuOpen = !courseDetailMenuOpen;
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        function courseDetailMenuDropdownHTML(courseId){
          return classMenuSheetHTML('toggleCourseDetailMenu', [
            { onclick: `courseDetailMenuOpen=false; openEditCourse('${courseId}')`, icon: 'edit', label: 'Edit Course' },
            { onclick: `courseDetailMenuOpen=false; openCourseEnrolledPeople('${courseId}')`, icon: 'personPlus', label: 'People' },
            { onclick: `courseDetailMenuOpen=false; openCourseAnalytics('${courseId}')`, icon: 'chart', label: 'Course analytics' },
            { onclick: `courseDetailMenuOpen=false; deleteCourse('${courseId}')`, icon: 'trash', label: 'Delete', cls: 'text-red-500' }
          ]);
        }

        function courseSwitchModule(i){
          courseActiveModule = i;
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        function setCourseDetailTab(tab){
          courseDetailTab = tab;
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        // ---- Course enrollment form ----
        function openCourseEnrollForm(courseId){
          courseEnrollDraft = {
            courseId,
            name: (typeof profileData !== 'undefined' && profileData.name) || '',
            email: (typeof currentUserEmail !== 'undefined' && currentUserEmail) || '',
            agreed: false,
          };
          openOverlay('courseEnroll');
        }

        function updateCourseEnrollField(field, value){
          if (!courseEnrollDraft) return;
          courseEnrollDraft[field] = value;
        }

        function toggleCourseEnrollAgree(){
          if (!courseEnrollDraft) return;
          courseEnrollDraft.agreed = !courseEnrollDraft.agreed;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseEnrollHTML();
        }

        function courseEnrollHTML(){
          const d = courseEnrollDraft;
          if (!d) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const c = allCourses.find(x => x.id === d.courseId);
          if (!c) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const canSubmit = d.name.trim() && d.agreed;
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
<div class="-mx-5">${overlayHeader('Enroll', '20px', `openOverlay('courseDetail')`)}</div>
                ${courseCoverOf(c) ? `<img src="${courseCoverOf(c)}" class="w-full rounded-3xl mb-4 object-cover" style="height:180px;margin-top:10px;" alt="">` : ''}
                <div class="text-lg font-bold font-display mb-1" style="color:#1E90FF;">${escapeHtml(c.title)}</div>
                <div class="text-sm text-gray-500 leading-relaxed mb-5">Fill this in and accept the course terms to unlock all modules and start learning.</div>

                <div class="mb-4">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Full Name</label>
                  <input type="text" value="${escapeHtml(d.name)}" oninput="updateCourseEnrollField('name', this.value)" placeholder="Your full name" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
                </div>
                <div class="mb-5">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Email <span class="normal-case font-medium text-gray-400">(optional)</span></label>
                  <input type="email" value="${escapeHtml(d.email)}" oninput="updateCourseEnrollField('email', this.value)" placeholder="you@example.com" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
                </div>

                <div class="bg-gray-50 rounded-2xl p-4 text-xs text-gray-500 leading-relaxed mb-5">
                  By enrolling you agree to complete coursework honestly, follow ${escapeHtml(stitchOrgName(c.org))}'s classroom guidelines, and understand your progress may be visible to the course's organizers. You can end your enrollment at any time from the course page.
                </div>

                <button onclick="toggleCourseEnrollAgree()" class="w-full flex items-start gap-3 bg-white rounded-2xl p-4 mb-6 shadow-sm border ${d.agreed ? 'border-transparent' : 'border-gray-200'}" style="${d.agreed ? `background:rgba(30,144,255,0.06);border-color:${NAVY};` : ''}">
                  <span class="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5" style="${d.agreed ? `background:${NAVY};border-color:${NAVY};` : 'border-color:#d1d5db;'}">${d.agreed ? Icon('check','w-3.5 h-3.5 text-white') : ''}</span>
                  <span class="text-sm text-gray-700 text-left leading-relaxed">I have read and accept the enrollment terms above.</span>
                </button>

                <button onclick="submitCourseEnroll()" ${canSubmit ? '' : 'disabled'} class="w-full flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm text-white ${canSubmit ? '' : 'opacity-40'}" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">
                  ${Icon('check','w-4 h-4')} Confirm Enrollment
                </button>
              </div>
            </div>`;
        }

        async function submitCourseEnroll(){
          const d = courseEnrollDraft;
          if (!d || !d.name.trim() || !d.agreed) return;
          const courseId = d.courseId;
          const wasEnrolled = enrolledCourseIds.includes(courseId);
          courseEnrollments[courseId] = { name: d.name.trim(), email: d.email.trim(), agreedAt: Date.now() };
          if (!wasEnrolled) enrolledCourseIds.push(courseId);
          courseEnrollDraft = null;
          currentCourseId = courseId;
          openOverlay('courseDetail');
          queueSaveUserState();
          if (!wasEnrolled) {
            const c = allCourses.find(x => x.id === courseId);
            if (c) {
              c.enrolledCount = (c.enrolledCount || 0) + 1;
              // Record who enrolled
              const myId = await getCurrentUserId();
              if (myId) {
                if (!c.enrolledUsers) c.enrolledUsers = [];
                if (!c.enrolledUsers.some(u => u.id === myId)) {
                  c.enrolledUsers.push({
                    id: myId,
                    name: d.name.trim(),
                    email: d.email.trim(),
                    username: (typeof profileData !== 'undefined' && profileData.username) || '',
                    enrolledAt: Date.now(),
                    progress: 0, done: 0, doneIds: [],
                  });
                }
                if (c.leftUsers) c.leftUsers = c.leftUsers.filter(u => u.id !== myId);
              }
              // Students can't write to the courses table directly
              courseReportSelf(courseId, 'enroll', { name: d.name.trim(), email: d.email.trim(), username: (typeof profileData !== 'undefined' && profileData.username) || '' });
            }
          }
        }

        function leaveCourse(courseId){
          const c = allCourses.find(x => x.id === courseId);
          openAppConfirmModal(
            c ? `End enrollment in "${c.title}"?` : 'End this enrollment?',
            "This removes your access to locked modules and your saved quiz answers for this course. You can re-enroll any time.",
            'End Enrollment',
            function(){
              enrolledCourseIds = enrolledCourseIds.filter(id => id !== courseId);
              delete courseEnrollments[courseId];
              if (c) {
                (c.modules || []).forEach(m => (m.items || []).forEach(it => {
                  delete courseQuizAnswers[it.id];
                  delete courseQuizSubmitted[it.id];
                }));
                (c.finalItems || []).forEach(it => {
                  delete courseQuizAnswers[it.id];
                  delete courseQuizSubmitted[it.id];
                });
              }
              const ov = document.getElementById('overlay');
              if (ov && currentOverlayKind === 'courseDetail') ov.innerHTML = courseDetailHTML();
              queueSaveUserState();
              if (c) {
                c.enrolledCount = Math.max(0, (c.enrolledCount || 0) - 1);
                getCurrentUserId().then(myId => {
                  if (myId && c.enrolledUsers) {
                    const me = c.enrolledUsers.find(u => u.id === myId);
                    if (me) {
                      if (!c.leftUsers) c.leftUsers = [];
                      c.leftUsers = c.leftUsers.filter(u => u.id !== myId);
                      c.leftUsers.push({ id: myId, name: me.name || '', username: me.username || '', enrolledAt: me.enrolledAt || null, leftAt: Date.now(), progress: me.progress || 0 });
                    }
                    c.enrolledUsers = c.enrolledUsers.filter(u => u.id !== myId);
                  }
                  courseReportSelf(courseId, 'leave', {});
                });
              }
            }
          );
        }

        // ---- Course detail screen (modules, resources, engage tabs) ----
        function courseCoverOf(c){
          if (c.photo) return c.photo;
          try {
            const j = (typeof jobsData !== 'undefined' && jobsData.courses || []).find(x => x.courseId === c.id || x.id === c.opportunityId);
            return (j && j.coverImage) || '';
          } catch (e) { return ''; }
        }

        function courseDetailHTML(){
          const c = allCourses.find(x => x.id === currentCourseId);
          if (!c) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const enrolled = enrolledCourseIds.includes(c.id);
          const mod = c.modules[courseActiveModule];
          const locked = courseActiveModule > 0 && !enrolled;
          const total = courseTotalItems(c);
          const done = courseCompletedItems(c);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const isLive = c.deliveryType === 'live';
          const resources = c.resources || [];
          const announcements = c.announcements || [];
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
                <div class="-mx-5">
                  ${canManageCourse(c)
                    ? menuOverlayHeader('Dashboard', courseDetailMenuOpen, 'toggleCourseDetailMenu', courseDetailMenuDropdownHTML(c.id), {backFn: 'overlayGoBack', shortDashes: true})
                    : overlayHeader(escapeHtml(c.title), '20px')}
                </div>
                ${courseCoverOf(c) ? `<img src="${courseCoverOf(c)}" class="w-full rounded-3xl mb-4 object-cover" style="height:180px;margin-top:10px;" alt="">` : ''}
                <div class="flex items-center gap-2 mb-3">
                  <button onclick="openCourseEnrolledPeople('${c.id}')" class="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">${escapeHtml(stitchOrgName(c.org))}</button>
                  ${isLive ? `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-600">● Live Teaching</span>` : ''}
                </div>
                <div class="text-xl font-bold font-display mb-2" style="color:#1E90FF;">${escapeHtml(c.title)}</div>
                ${!canManageCourse(c) ? `<button onclick="openReportClass('course','${escapeForJsAttr(c.id)}','${escapeForJsAttr(c.title)}')" class="text-[11px] font-semibold text-gray-400 mb-3 inline-flex items-center gap-1">${Icon('flag','w-3 h-3')} Report this course</button>` : ''}
                <div class="text-sm text-gray-600 leading-relaxed mb-4">${renderRichText(c.description)}</div>

                <div class="flex gap-2 mb-4 bg-gray-100 rounded-full p-1">
                  <button onclick="setCourseDetailTab('content')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'content' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'content' ? `background:${NAVY};` : ''}">Content</button>
                  <button onclick="setCourseDetailTab('engage')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'engage' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'engage' ? `background:${NAVY};` : ''}">Engage${announcements.length ? ` (${announcements.length})` : ''}</button>
                  <button onclick="setCourseDetailTab('resources')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'resources' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'resources' ? `background:${NAVY};` : ''}">Resources${resources.length ? ` (${resources.length})` : ''}</button>
                </div>

                ${courseDetailTab === 'resources' ? courseResourcesTabHTML(c, enrolled) : courseDetailTab === 'engage' ? courseEngageTabHTML(c) : (!c.modules.length ? `
                  <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                    <div class="flex justify-center mb-2 text-gray-400">${Icon('book','w-6 h-6')}</div>
                    No modules have been added to this course yet.
                    ${canManageCourse(c) ? `<button onclick="openEditCourse('${c.id}')" class="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-semibold text-xs text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${Icon('plus','w-3.5 h-3.5')} Add the first module</button>` : ''}
                  </div>` : `
                  <div class="pill-bleed flex items-center gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
                    ${c.modules.map((m, i) => {
                      const modDone = enrolled && courseModuleCompleted(c, i);
                      return `
                      <button onclick="courseSwitchModule(${i})" class="flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ${i === courseActiveModule ? 'text-white' : 'text-gray-500 bg-gray-100'}" style="${i === courseActiveModule ? `background:${NAVY};` : ''}">
                        ${(i > 0 && !enrolled) ? Icon('lock','w-3 h-3') : ''} ${i + 1}
                        ${modDone ? `<span class="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">${Icon('check','w-2.5 h-2.5')}</span>` : ''}
                      </button>`;
                    }).join('')}
                  </div>
                  ${!enrolled ? `
                    <button onclick="openCourseEnrollForm('${c.id}')" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white mb-5" style="background:rgba(30,144,255,0.85);">
                      ${Icon('plus','w-4 h-4')} Enroll to unlock all modules
                    </button>` : `
                    <div class="mb-5">
                      ${pct === 100 ? `
                        <div class="text-sm font-bold text-gray-800 mb-1">Course Completed</div>
                        <div class="text-xs text-gray-400 mb-2">Congrats on completing the course!</div>
                      ` : `
                        <div class="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
                          <span>Your progress</span><span>${pct}% complete</span>
                        </div>
                        <div class="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div class="h-full rounded-full" style="width:${pct}%;background:#059669;"></div>
                        </div>
                      `}
                      <button onclick="leaveCourse('${c.id}')" class="w-full mt-3 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm" style="background:transparent;color:#DC2626;">
                        ${Icon('logout','w-4 h-4')} End Enrollment
                      </button>
                    </div>`}
                  <div class="text-sm font-bold text-gray-700 mb-1">${escapeHtml(mod.title)}</div>
                  ${mod.description ? `<div class="text-xs text-gray-500 leading-relaxed mb-3">${renderRichText(mod.description)}</div>` : `<div class="mb-3"></div>`}
                  ${locked ? `
                    <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                      <div class="flex justify-center mb-2 text-gray-400">${Icon('lock','w-6 h-6')}</div>
                      Enroll to unlock this module. Module 1 is free to preview.
                    </div>` : mod.items.map(it => courseItemCardHTML(c, it)).join('')}
                  ${(c.finalItems && c.finalItems.length) ? `
                    <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 mt-6">Final Project</div>
                    ${!enrolled ? `
                      <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                        <div class="flex justify-center mb-2 text-gray-400">${Icon('lock','w-6 h-6')}</div>
                        Enroll to unlock the final project.
                      </div>` : c.finalItems.map(it => courseItemCardHTML(c, it)).join('')}
                  ` : ''}
                `)}
                <div style="height:20px;"></div>
              </div>
            </div>`;
        }

        function courseResourcesTabHTML(course, enrolled){
          const resources = course.resources || [];
          const isAdmin = canManageCourse(course);
          const addResourceButton = isAdmin ? `
            <button onclick="openEngageAddResource('${course.id}')" class="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500 mb-4">
              ${Icon('plus','w-3.5 h-3.5')} Add Resource
            </button>` : '';
          if (!resources.length) {
            return `${addResourceButton}<div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">No extra resources have been added to this course yet.</div>`;
          }
          if (!enrolled && !isAdmin) {
            return `
              <button onclick="openCourseEnrollForm('${course.id}')" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white mb-5" style="background:rgba(30,144,255,0.85);">
                ${Icon('plus','w-4 h-4')} Enroll to unlock resources
              </button>
              <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                <div class="flex justify-center mb-2 text-gray-400">${Icon('lock','w-6 h-6')}</div>
                ${resources.length} resource${resources.length === 1 ? '' : 's'} available after enrolling.
              </div>`;
          }
          return addResourceButton + resources.map(r => `
            <a href="${r.url ? escapeHtml(r.url) : '#'}" target="_blank" rel="noopener" class="flex items-center gap-3 bg-white rounded-3xl p-4 mb-3 shadow-sm border border-gray-100 ${r.url ? '' : 'pointer-events-none opacity-60'}">
              <div class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon(r.type === 'audio' ? 'mic' : 'video','w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(r.title || 'Untitled resource')}</div>
                <div class="text-xs text-gray-400">${r.type === 'audio' ? 'Audio' : 'Video'}${r.duration ? ' · ' + escapeHtml(r.duration) : ''}${r.url ? '' : ' · No link added yet'}</div>
              </div>
              ${r.url ? `<span class="text-gray-400 flex-shrink-0">${Icon('download','w-4 h-4')}</span>` : ''}
            </a>`).join('');
        }

        function openEngageAddResource(courseId){
          if (!canManageCourse(courseId)) return;
          openCourseAddResource(courseId);
        }

        // ---- Standalone "Add/Edit Resource" page (opened from the Resources tab or the Create
        // Course form) ----
        let courseResourcePageCourseId = null;
        let courseResourcePageEditIndex = null;
        let courseResourcePageDraft = null;

        function openCourseAddResource(courseId, editIndex){
          if (!canManageCourse(courseId)) return;
          const c = courseForEditorPages(courseId);
          if (!c) return;
          rememberNewCourseScroll(courseId);
          courseResourcePageCourseId = courseId;
          const existing = (editIndex !== undefined && editIndex !== null) ? (c.resources || [])[editIndex] : null;
          courseResourcePageEditIndex = existing ? editIndex : null;
          courseResourcePageDraft = existing
            ? { title: existing.title || '', type: existing.type === 'audio' ? 'audio' : 'video', url: existing.url || '', duration: existing.duration || '' }
            : { title: '', type: 'video', url: '', duration: '' };
          openOverlay('courseAddResource');
        }

        function updateCourseResourcePageField(field, value){
          if (courseResourcePageDraft) courseResourcePageDraft[field] = value;
        }

        // Restyles the two type pills in place (no re-render) so the page and keyboard never jump.
        function setCourseResourcePageType(type){
          if (!courseResourcePageDraft) return;
          courseResourcePageDraft.type = type;
          document.querySelectorAll('#overlay [data-res-type]').forEach(btn => {
            const on = btn.getAttribute('data-res-type') === type;
            btn.className = 'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold ' + (on ? 'text-white' : 'bg-gray-100 text-gray-500');
            btn.style.background = on ? NAVY : '';
          });
        }

        function cancelCourseResourcePage(){
          returnToCourseEngage(courseResourcePageCourseId, 'resources');
        }

        function confirmCourseResourcePage(){
          const d = courseResourcePageDraft;
          const c = courseForEditorPages(courseResourcePageCourseId);
          if (!d || !c) return;
          if (!d.title.trim()) { openAppAlertModal('Please add a title for this resource.'); return; }
          const isDraft = courseResourcePageCourseId === DRAFT_COURSE_ID;
          if (!c.resources) c.resources = [];
          const clean = { title: d.title.trim(), type: d.type, url: (d.url || '').trim(), duration: (d.duration || '').trim() };
          if (courseResourcePageEditIndex !== null && c.resources[courseResourcePageEditIndex]) {
            c.resources[courseResourcePageEditIndex] = Object.assign({}, c.resources[courseResourcePageEditIndex], clean);
          } else {
            c.resources.push(Object.assign({ id: 'res' + Date.now() + Math.random().toString(36).slice(2,6) }, clean));
          }
          if (!isDraft) postCourseInsertRemote(c);
          returnToCourseEngage(courseResourcePageCourseId, 'resources');
        }

        function courseAddResourcePageHTML(){
          const d = courseResourcePageDraft;
          if (!d || !courseForEditorPages(courseResourcePageCourseId)) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const isEditing = courseResourcePageEditIndex !== null;
          const typeBtn = (key, label, icon) => `<button data-res-type="${key}" onclick="setCourseResourcePageType('${key}')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold ${d.type === key ? 'text-white' : 'bg-gray-100 text-gray-500'}" style="${d.type === key ? `background:${NAVY};` : ''}">${Icon(icon,'w-3.5 h-3.5')} ${label}</button>`;
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader(isEditing ? 'Edit Resource' : 'Add Resource', '20px', 'cancelCourseResourcePage()', null, { center: true, pb: '20px' })}
            <div class="px-5 pb-8">
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Title</label>
                <input type="text" value="${escapeHtml(d.title)}" oninput="updateCourseResourcePageField('title', this.value)" placeholder="Resource title" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Type</label>
                <div class="flex gap-2">${typeBtn('video', 'Video', 'video')}${typeBtn('audio', 'Audio', 'mic')}</div>
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Link</label>
                <input type="text" value="${escapeHtml(d.url)}" oninput="updateCourseResourcePageField('url', this.value)" placeholder="Link (video, direct file, etc.)" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none" autocapitalize="none" autocorrect="off">
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Duration <span class="normal-case font-medium text-gray-400">(optional)</span></label>
                <input type="text" value="${escapeHtml(d.duration)}" oninput="updateCourseResourcePageField('duration', this.value)" placeholder="e.g. 12 min" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>
            </div>
            </div>
            ${courseEditorFooterHTML(isEditing ? 'Save Changes' : 'Add Resource', 'confirmCourseResourcePage()')}`;
        }

        // ---- Course "Engage" tab (posts, quizzes, assignments) ----
        function courseEngageItems(course){
          const out = [];
          (course.modules || []).forEach((m, mi) => {
            (m.items || []).forEach((it, ii) => {
              out.push({ mi, ii, moduleTitle: m.title, item: it });
            });
          });
          return out;
        }

        function openEngageItem(courseId, mi, ii){
          if (!canManageCourse(courseId)) return;
          openCourseEditItemPage(courseId, mi, ii);
        }

        function openEngageAddModule(courseId){
          if (!canManageCourse(courseId)) return;
          openCourseAddModule(courseId);
        }

        function openEngageAddItem(courseId, type){
          if (!canManageCourse(courseId)) return;
          openCourseAddItemPage(courseId, type);
        }

        function courseEngageQuizAssignmentSectionHTML(course){
          if (!canManageCourse(course)) return '';
          const items = courseEngageItems(course);
          const typeIcon = { video:'video', image:'camera', audio:'mic', reading:'book', assignment:'doc', project:'book', practiceQuiz:'help', gradedQuiz:'help' };
          return `
            <div class="grid grid-cols-2 gap-2 mb-4">
              <button onclick="openEngageAddModule('${course.id}')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Module</button>
              <button onclick="openEngageAddItem('${course.id}','video')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Part</button>
              <button onclick="openEngageAddItem('${course.id}','gradedQuiz')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Quiz</button>
              <button onclick="openEngageAddItem('${course.id}','assignment')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Assignment</button>
              <button onclick="openEngageAddItem('${course.id}','project')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500 col-span-2">${Icon('plus','w-3.5 h-3.5')} Add Project</button>
            </div>
            <div class="text-sm font-bold text-gray-700 mb-2">Parts, Quizzes, Assignments &amp; Projects</div>
            ${items.length ? items.map(({ mi, ii, moduleTitle, item }) => `
              <button onclick="openEngageItem('${course.id}', ${mi}, ${ii})" class="w-full flex items-center gap-3 bg-white rounded-3xl p-4 mb-3 shadow-sm border border-gray-100 text-left">
                <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:#1E90FF;">${Icon(typeIcon[item.type] || 'doc','w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(item.title || 'Untitled')}</div>
                  <div class="text-xs text-gray-400 truncate">${courseItemTypeLabel(item.type)} · ${escapeHtml(moduleTitle)}</div>
                </div>
                <span class="text-gray-300 flex-shrink-0">${Icon('arrowRight','w-4 h-4')}</span>
              </button>`).join('') : `
              <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-6 text-center text-gray-500 text-sm mb-2">No parts, quizzes, assignments, or projects yet -- add one above.</div>`}
            <div class="text-sm font-bold text-gray-700 mt-5 mb-2">Announcements</div>`;
        }

        function courseEngageTabHTML(course){
          const list = course.announcements || [];
          const isAdmin = canManageCourse(course);
          return `
            ${courseEngageQuizAssignmentSectionHTML(course)}
            ${isAdmin ? `
              <div class="bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100">
                <textarea id="course-announcement-input" oninput="courseAnnouncementDraft=this.value" placeholder="Share an update with everyone browsing this course..." class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none" rows="3">${escapeHtml(courseAnnouncementDraft)}</textarea>
                <button onclick="postCourseAnnouncement('${course.id}')" class="w-full mt-2 flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">
                  ${Icon('plus','w-4 h-4')} Post Announcement
                </button>
              </div>` : ''}
            ${list.length ? list.slice().reverse().map((a, revIdx) => {
              const i = list.length - 1 - revIdx; 
              return `
                <div class="bg-white rounded-3xl p-4 mb-3 shadow-sm border border-gray-100">
                  <div class="flex items-center justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style="background:${NAVY};">${Icon('bell','w-4 h-4')}</div>
                      <div class="min-w-0">
                        <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(TEAM_STITCH_TEACHER)}</div>
                        <div class="text-xs text-gray-400">${escapeHtml(new Date(a.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</div>
                      </div>
                    </div>
                    ${isAdmin ? `<button onclick="deleteCourseAnnouncement('${course.id}', ${i})" class="text-gray-400 flex-shrink-0">${Icon('trash','w-4 h-4')}</button>` : ''}
                  </div>
                  <div class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">${escapeHtml(a.text)}</div>
                </div>`;
            }).join('') : `
              <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">No announcements yet. ${isAdmin ? 'Post one above and it will show up here for everyone.' : 'Check back for updates from ' + escapeHtml(TEAM_STITCH_TEACHER) + '.'}</div>`}`;
        }

        // ---- Standalone "Add Module" page (opened from the Engage tab) ----
        function returnToCourseEngage(courseId, tab){
          if (courseId === DRAFT_COURSE_ID) {
            // Back to the Create/Edit Course form with everything typed so far, at the same scroll
            // spot
            openOverlay('newCourse');
            const keep = newCourseFormScrollTop;
            setTimeout(() => { const el = document.querySelector('#overlay .overflow-y-auto'); if (el) el.scrollTop = keep; }, 0);
            return;
          }
          currentCourseId = courseId;
          courseDetailTab = tab || 'engage';
          openOverlay('courseDetail');
        }

        let courseAddModuleCourseId = null;
        let courseAddModuleDraft = null;

        function openCourseAddModule(courseId){
          if (!canManageCourse(courseId)) return;
          courseAddModuleCourseId = courseId;
          courseAddModuleDraft = { title: '', description: '' };
          rememberNewCourseScroll(courseId);
          openOverlay('courseAddModule');
        }

        function rememberNewCourseScroll(courseId){
          if (courseId !== DRAFT_COURSE_ID) return;
          const el = document.querySelector('#overlay .overflow-y-auto');
          newCourseFormScrollTop = el ? el.scrollTop : 0;
        }

        function updateCourseAddModuleField(field, value){
          courseAddModuleDraft[field] = value;
          if (field === 'description') refreshDescCounter('course-add-module-desc-count', value);
        }

        function cancelCourseAddModule(){
          returnToCourseEngage(courseAddModuleCourseId);
        }

        function confirmCourseAddModule(){
          if (!courseAddModuleDraft.title.trim()) { openAppAlertModal('Please add a module title.'); return; }
          if (countDescWords(courseAddModuleDraft.description) < COURSE_DESC_MIN_WORDS) { openAppAlertModal('Please add a description of at least ' + COURSE_DESC_MIN_WORDS + ' words (currently ' + countDescWords(courseAddModuleDraft.description) + ').'); return; }
          const c = courseForEditorPages(courseAddModuleCourseId);
          if (!c) return;
          if (!c.modules) c.modules = [];
          c.modules.push({ id: 'mod' + Date.now() + Math.random().toString(36).slice(2,6), title: courseAddModuleDraft.title.trim(), description: (courseAddModuleDraft.description || '').trim(), items: [] });
          if (courseAddModuleCourseId !== DRAFT_COURSE_ID) postCourseInsertRemote(c);
          returnToCourseEngage(courseAddModuleCourseId);
        }

        // Same pinned "Add" pill on every Add/Edit page (module, part, quiz...), so it never jumps
        // around
        function courseEditorFooterHTML(label, onclick, iconHtml){
          return `
            <div class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(22px, env(safe-area-inset-bottom));">
              <div class="max-w-2xl mx-auto">
                <button onclick="${onclick}" class="pill-cta w-full inline-flex items-center justify-center gap-2 text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">${iconHtml || ''}${label}</button>
              </div>
            </div>`;
        }

        function courseAddModuleHTML(){
          const d = courseAddModuleDraft;
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Add Module', '20px', 'cancelCourseAddModule()', null, { center: true, pb: '20px' })}
            <div class="px-5 pb-8">
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Module Title</label>
                <input type="text" value="${escapeHtml(d.title)}" oninput="updateCourseAddModuleField('title', this.value)" placeholder="e.g. Introduction to Elasticity" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>
              <div class="mb-5">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Description <span style="color:#ef4444;">*</span></label>
                ${richTextToolbarHTML('formatCourseModuleDesc', { simple: true })}
                <textarea id="course-add-module-desc" oninput="updateCourseAddModuleField('description', this.value)" placeholder="What will students do in this module?" rows="3" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none">${escapeHtml(d.description || '')}</textarea>
                ${descCounterHTML('course-add-module-desc-count', d.description)}
              </div>
            </div>
            </div>
            ${courseEditorFooterHTML('Add Module', 'confirmCourseAddModule()', Icon('plus','w-4 h-4'))}`;
        }

        // ---- Standalone "Add/Edit Part" page (video, picture, reading, assignment, project, or
        // quiz) ----
        let courseItemPageCourseId = null;
        let courseItemPageModuleIndex = 0;
        let courseItemPageOriginalModuleIndex = null;
        let courseItemPageOriginalItemIndex = null;
        let courseItemPageDraft = null;

        function openCourseAddItemPage(courseId, type){
          if (!canManageCourse(courseId)) return;
          const c = courseForEditorPages(courseId);
          if (!c) return;
          rememberNewCourseScroll(courseId);
          if (!c.modules) c.modules = [];
          if (!c.modules.length) c.modules.push({ id: 'mod' + Date.now() + Math.random().toString(36).slice(2,6), title: 'Module 1', description: '', items: [] });
          courseItemPageCourseId = courseId;
          courseItemPageModuleIndex = c.modules.length - 1;
          courseItemPageOriginalModuleIndex = null;
          courseItemPageOriginalItemIndex = null;
          courseItemPageDraft = { title:'', type: type || 'video', duration:'', description:'', questions:[], mediaUrl:null, mediaType:null, mediaFileName:null, mediaUploading:false };
          openOverlay('courseAddItemPage');
        }

        function openCourseEditItemPage(courseId, mi, ii){
          if (!canManageCourse(courseId)) return;
          const c = courseForEditorPages(courseId);
          if (!c) return;
          rememberNewCourseScroll(courseId);
          const it = c.modules[mi] && c.modules[mi].items[ii];
          if (!it) return;
          courseItemPageCourseId = courseId;
          courseItemPageModuleIndex = mi;
          courseItemPageOriginalModuleIndex = mi;
          courseItemPageOriginalItemIndex = ii;
          courseItemPageDraft = {
            title: it.title || '',
            type: it.type || 'video',
            duration: it.duration || '',
            description: it.description || '',
            questions: (it.questions || []).map(q => ({ text:q.text || '', options:(q.options || ['', '', '', '']).slice(), correct:q.correct || 0 })),
            mediaUrl: it.mediaUrl || null,
            mediaType: it.mediaType || null,
            mediaFileName: it.mediaFileName || null,
            mediaUploading: false,
          };
          openOverlay('courseAddItemPage');
        }

        function rerenderCourseItemPage(){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const prevScrollEl = ov.querySelector('.overflow-y-auto');
          const prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
          ov.innerHTML = courseAddItemPageHTML();
          const newScrollEl = ov.querySelector('.overflow-y-auto');
          if (newScrollEl) newScrollEl.scrollTop = prevScrollTop;
        }

        function updateCourseItemPageField(field, value){
          courseItemPageDraft[field] = value;
          if (field === 'description') refreshDescCounter('course-item-page-desc-count', value);
        }

        function setCourseItemPageType(type){
          courseItemPageDraft.type = type;
          rerenderCourseItemPage();
        }

        function setCourseItemPageModule(value){
          courseItemPageModuleIndex = parseInt(value, 10);
        }

        function handleCourseItemPageMediaSelected(e){
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const d = courseItemPageDraft;
          if (!d) return;
          d.mediaType = d.type === 'video' ? 'video' : 'image';
          d.mediaFileName = file.name;
          d.mediaUrl = URL.createObjectURL(file);
          d.mediaUploading = true;
          rerenderCourseItemPage();
          const itemId = 'item' + Date.now() + Math.random().toString(36).slice(2,6);
          uploadCourseItemMediaToStorage(file, itemId).then(remoteUrl => {
            if (courseItemPageDraft !== d) return;
            if (remoteUrl) {
              d.mediaUrl = remoteUrl;
            } else {
              openAppAlertModal("This file uploaded to your device but couldn't reach shared storage, so it will only play for you and will look broken to students. Ask whoever set up the app's backend to create the \"course-media\" storage bucket, then re-upload this file.");
            }
            d.mediaUploading = false;
            rerenderCourseItemPage();
          });
        }

        function removeCourseItemPageMedia(){
          const d = courseItemPageDraft;
          if (!d) return;
          d.mediaUrl = null;
          d.mediaType = null;
          d.mediaFileName = null;
          d.mediaUploading = false;
          rerenderCourseItemPage();
        }

        function addCourseItemPageQuestion(){
          courseItemPageDraft.questions.push({ text:'', options:['', '', '', ''], correct:0 });
          rerenderCourseItemPage();
        }

        function removeCourseItemPageQuestion(qi){
          courseItemPageDraft.questions.splice(qi, 1);
          rerenderCourseItemPage();
        }

        function updateCourseItemPageQuestionText(qi, value){
          courseItemPageDraft.questions[qi].text = value;
        }

        function updateCourseItemPageOption(qi, oi, value){
          courseItemPageDraft.questions[qi].options[oi] = value;
        }

        function setCourseItemPageCorrect(qi, oi){
          courseItemPageDraft.questions[qi].correct = oi;
          rerenderCourseItemPage();
        }

        function cancelCourseItemPage(){
          returnToCourseEngage(courseItemPageCourseId);
        }

        function deleteCourseItemPage(){
          if (courseItemPageOriginalItemIndex === null) return;
          openAppConfirmModal('Delete this item?', "This can't be undone.", 'Delete', function(){
            const c = courseForEditorPages(courseItemPageCourseId);
            if (!c) return;
            c.modules[courseItemPageOriginalModuleIndex].items.splice(courseItemPageOriginalItemIndex, 1);
            if (courseItemPageCourseId !== DRAFT_COURSE_ID) postCourseInsertRemote(c);
            returnToCourseEngage(courseItemPageCourseId);
          });
        }

        function confirmCourseItemPage(){
          const c = courseForEditorPages(courseItemPageCourseId);
          if (!c) return;
          const d = courseItemPageDraft;
          if (!d.title.trim()) { openAppAlertModal('Please add a title for this item.'); return; }
          if (d.mediaUploading) { openAppAlertModal('Still uploading the file -- give it a moment and try again.'); return; }
          const isQuiz = courseItemIsQuiz(d.type);
          if (isQuiz && !d.questions.length) { openAppAlertModal('Add at least one question to this quiz.'); return; }
          if (!isQuiz && countDescWords(d.description) < COURSE_DESC_MIN_WORDS) { openAppAlertModal('Please add a description of at least ' + COURSE_DESC_MIN_WORDS + ' words (currently ' + countDescWords(d.description) + ').'); return; }
          const targetModule = c.modules[courseItemPageModuleIndex];
          if (!targetModule) { openAppAlertModal('Pick a module for this item.'); return; }
          const item = {
            id: 'item' + Date.now() + Math.random().toString(36).slice(2,6),
            title: d.title.trim(),
            type: d.type,
            duration: d.duration.trim(),
            description: d.description.trim(),
            mediaUrl: (d.type === 'video' || d.type === 'image') ? (d.mediaUrl || null) : null,
            mediaType: (d.type === 'video' || d.type === 'image') ? d.mediaType : null,
            mediaFileName: (d.type === 'video' || d.type === 'image') ? (d.mediaFileName || null) : null,
          };
          if (isQuiz) item.questions = d.questions.map(q => ({ text:q.text.trim(), options:q.options.map(o => o.trim()), correct:q.correct }));
          if (courseItemPageOriginalItemIndex !== null) {
            const existing = c.modules[courseItemPageOriginalModuleIndex].items[courseItemPageOriginalItemIndex];
            item.id = existing.id;
            if (courseItemPageOriginalModuleIndex === courseItemPageModuleIndex) {
              targetModule.items[courseItemPageOriginalItemIndex] = item;
            } else {
              c.modules[courseItemPageOriginalModuleIndex].items.splice(courseItemPageOriginalItemIndex, 1);
              targetModule.items.push(item);
            }
          } else {
            targetModule.items.push(item);
          }
          if (courseItemPageCourseId !== DRAFT_COURSE_ID) postCourseInsertRemote(c);
          returnToCourseEngage(courseItemPageCourseId);
        }

        function courseItemPageQuestionHTML(q, qi){
          return `
            <div class="bg-gray-100 rounded-2xl p-3 mb-2">
              <div class="flex items-center gap-2 mb-3">
                <input type="text" value="${escapeHtml(q.text)}" oninput="updateCourseItemPageQuestionText(${qi}, this.value)" placeholder="Question ${qi + 1}" class="flex-1 min-w-0 bg-white rounded-lg px-2.5 py-1.5 text-xs outline-none">
                <button onclick="removeCourseItemPageQuestion(${qi})" class="text-red-500 flex-shrink-0">${Icon('close','w-3.5 h-3.5')}</button>
              </div>
              ${q.options.map((opt, oi) => `
                <div class="flex items-center gap-2 mb-2">
                  <button onclick="setCourseItemPageCorrect(${qi},${oi})" class="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${q.correct === oi ? 'border-emerald-600' : 'border-gray-300'}">
                    ${q.correct === oi ? '<span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>' : ''}
                  </button>
                  <input type="text" value="${escapeHtml(opt)}" oninput="updateCourseItemPageOption(${qi},${oi}, this.value)" placeholder="Option ${oi + 1}" class="flex-1 min-w-0 bg-white rounded-lg px-2.5 py-1.5 text-xs outline-none">
                </div>`).join('')}
            </div>`;
        }

        function courseAddItemPageHTML(){
          const d = courseItemPageDraft;
          const c = courseForEditorPages(courseItemPageCourseId);
          if (!c || !d) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const isEditing = courseItemPageOriginalItemIndex !== null;
          const isQuiz = courseItemIsQuiz(d.type);
          const isMedia = d.type === 'video' || d.type === 'image';
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader((isEditing ? 'Edit ' : 'Add ') + courseItemTypeLabel(d.type), '20px', 'cancelCourseItemPage()', null, { center: true, pb: '20px' })}
            <div class="px-5 pb-8">
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Title</label>
                <input type="text" value="${escapeHtml(d.title)}" oninput="updateCourseItemPageField('title', this.value)" placeholder="Part title" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Type</label>
                <div class="pill-bleed flex gap-1.5 overflow-x-auto no-scrollbar">
                  ${courseItemTypes.map(t => `<button onclick="setCourseItemPageType('${t.key}')" class="flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-bold ${d.type === t.key ? 'text-white' : 'bg-gray-100 text-gray-500'}" style="${d.type === t.key ? `background:${NAVY};` : ''}">${t.label}</button>`).join('')}
                </div>
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Module</label>
                <select onchange="setCourseItemPageModule(this.value)" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none border border-gray-200">
                  ${c.modules.map((m, mi) => `<option value="${mi}" ${courseItemPageModuleIndex === mi ? 'selected' : ''}>${escapeHtml(m.title || 'Module ' + (mi + 1))}</option>`).join('')}
                </select>
              </div>
              ${isMedia ? `
                <input type="file" id="course-item-page-media-input" accept="${d.type === 'video' ? 'video/*' : 'image/*'}" class="hidden" onchange="handleCourseItemPageMediaSelected(event)">
                <div class="mb-4">
                ${d.mediaUrl ? `
                  <div class="relative rounded-2xl overflow-hidden bg-black" style="aspect-ratio:16/9;">
                    ${d.mediaType === 'image'
                      ? `<img src="${d.mediaUrl}" class="w-full h-full object-cover">`
                      : `<video src="${d.mediaUrl}" class="w-full h-full object-cover" controls controlsList="nodownload noplaybackrate" playsinline></video>`}
                    ${d.mediaUploading ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">Uploading...</div>` : ''}
                    <button onclick="removeCourseItemPageMedia()" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">${IconBold('close','w-4 h-4')}</button>
                  </div>` : `
                  <button onclick="document.getElementById('course-item-page-media-input').click()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-4 font-semibold text-sm border border-dashed border-gray-300 text-gray-500">
                    ${Icon('camera','w-4 h-4')} Upload ${d.type === 'video' ? 'a video' : 'a picture'}
                  </button>`}
                </div>` : ''}
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Duration <span class="normal-case font-medium text-gray-400">(optional)</span></label>
                <input type="text" value="${escapeHtml(d.duration)}" oninput="updateCourseItemPageField('duration', this.value)" placeholder="e.g. 5 min" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>
              ${!isQuiz ? `
                <div class="mb-5">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">${d.type === 'reading' ? 'Reading content' : isMedia ? 'Description' : 'Content / instructions'} <span style="color:#ef4444;">*</span></label>
                  ${richTextToolbarHTML('formatCourseItemDesc', { simple: true })}
                  <textarea id="course-item-page-desc" oninput="updateCourseItemPageField('description', this.value)" placeholder="${d.type === 'reading' ? 'Paste or write the reading content here -- this is exactly what students will see' : 'Add details...'}" rows="${d.type === 'reading' ? 8 : 3}" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none">${escapeHtml(d.description)}</textarea>
                  ${descCounterHTML('course-item-page-desc-count', d.description)}
                </div>` : `
                <div class="mb-5">
                  <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2 block">Questions</label>
                  ${d.questions.map((q, qi) => courseItemPageQuestionHTML(q, qi)).join('')}
                  <button onclick="addCourseItemPageQuestion()" class="w-full flex items-center justify-center gap-1.5 rounded-2xl py-2.5 font-semibold text-xs border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Question</button>
                </div>`}
              ${isEditing ? `
                <button onclick="deleteCourseItemPage()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm mb-3" style="background:rgba(220,38,38,0.08);color:#DC2626;">${Icon('trash','w-4 h-4')} Delete this item</button>` : ''}
            </div>
            </div>
            ${courseEditorFooterHTML(d.mediaUploading ? 'Uploading...' : (isEditing ? 'Save Changes' : 'Add ' + courseItemTypeLabel(d.type)), 'confirmCourseItemPage()')}`;
        }

        function postCourseAnnouncement(courseId){
          if (!canManageCourse(courseId)) return;
          const text = courseAnnouncementDraft.trim();
          if (!text) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c) return;
          if (!c.announcements) c.announcements = [];
          c.announcements.push({ id: 'cann' + Date.now() + Math.random().toString(36).slice(2,6), text, timestamp: Date.now() });
          courseAnnouncementDraft = '';
          postCourseInsertRemote(c);
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        function deleteCourseAnnouncement(courseId, index){
          if (!canManageCourse(courseId)) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c || !c.announcements) return;
          c.announcements.splice(index, 1);
          postCourseInsertRemote(c);
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        // ---- Course item detail + quiz taking ----
        function courseItemCardHTML(course, item){
          const isBigMedia = (item.mediaType === 'image' || item.mediaType === 'video') && item.mediaUrl;
          const doneBadge = isCourseItemComplete(item) ? `<span title="Completed" class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">${Icon('check','w-4 h-4')}</span>` : '';

          // Flush list items on the page background (divider between items, no floating white
          // card/shadow)
          if (isBigMedia) {
            return `
              <div onclick="openCourseItemDetail('${course.id}','${item.id}')" class="cursor-pointer pb-4 mb-4 border-b border-gray-100">
                <div class="relative w-full bg-black rounded-3xl overflow-hidden mb-3" style="aspect-ratio:16/9;">
                  ${item.mediaType === 'image'
                    ? `<img src="${item.mediaUrl}" class="w-full h-full object-cover">`
                    : `<video src="${item.mediaUrl}" class="w-full h-full object-cover" muted playsinline preload="metadata"></video>`}
                  ${item.mediaType === 'video' ? `
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div class="w-12 h-12 rounded-full flex items-center justify-center text-white" style="background:rgba(0,0,0,0.45);">${Icon('video','w-5 h-5')}</div>
                    </div>` : ''}
                  ${isCourseItemComplete(item) ? `<span title="Completed" class="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center">${Icon('check','w-4 h-4')}</span>` : ''}
                </div>
                <div class="font-bold text-gray-800 mb-1.5">${escapeHtml(item.title)}</div>
                <div class="flex items-center gap-1.5 text-xs font-semibold ${isCourseItemComplete(item) ? 'text-emerald-700' : 'text-gray-500'} ${item.description ? 'mb-1.5' : ''}">
                  <span>${courseItemTypeLabel(item.type)}</span>
                  ${item.duration ? `<span class="text-gray-400">· ${escapeHtml(item.duration)}</span>` : ''}
                </div>
                ${item.description ? `<div class="text-sm text-gray-600 leading-relaxed">${renderRichText(item.description)}</div>` : ''}
              </div>`;
          }

          const iconIndicator = item.mediaType === 'document' && item.mediaUrl
            ? `<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:#1E90FF;">${Icon('doc','w-4 h-4')}</div>`
            : '';
          return `
            <div onclick="openCourseItemDetail('${course.id}','${item.id}')" class="cursor-pointer pb-4 mb-4 border-b border-gray-100">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${iconIndicator}
                  <div class="font-bold text-gray-800 truncate">${escapeHtml(item.title)}</div>
                </div>
                ${doneBadge}
              </div>
              <div class="flex items-center gap-1.5 text-xs font-semibold ${isCourseItemComplete(item) ? 'text-emerald-700' : 'text-gray-500'}">
                <span>${courseItemTypeLabel(item.type)}</span>
                ${item.duration ? `<span class="text-gray-400">· ${escapeHtml(item.duration)}</span>` : ''}
              </div>
              ${item.type === 'reading' && item.description ? `<div class="text-sm text-gray-600 leading-relaxed mt-2">${renderRichText(item.description)}</div>` : ''}
            </div>`;
        }

        function openCourseItemDetail(courseId, itemId){
          currentCourseId = courseId;
          currentCourseItemId = itemId;
          openOverlay('courseItemDetail');
        }

        function findCourseItem(){
          const c = allCourses.find(x => x.id === currentCourseId);
          if (!c) return { course:null, item:null };
          for (const m of c.modules) {
            const it = m.items.find(i => i.id === currentCourseItemId);
            if (it) return { course:c, item:it };
          }
          const fit = (c.finalItems || []).find(i => i.id === currentCourseItemId);
          if (fit) return { course:c, item:fit };
          return { course:c, item:null };
        }

        function markCourseItemComplete(){
          const { item } = findCourseItem();
          if (item) courseItemCompletions[item.id] = true;
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseItemDetailHTML();
          queueSaveUserState();
          syncMyCourseProgress(currentCourseId);
        }

        function selectQuizAnswer(qIndex, optIndex){
          if (courseQuizSubmitted[currentCourseItemId]) return;
          if (!courseQuizAnswers[currentCourseItemId]) courseQuizAnswers[currentCourseItemId] = [];
          courseQuizAnswers[currentCourseItemId][qIndex] = optIndex;
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseItemDetailHTML();
          queueSaveUserState();
        }

        function submitCourseQuiz(){
          courseQuizSubmitted[currentCourseItemId] = true;
          const { item } = findCourseItem();
          if (item) courseItemCompletions[item.id] = true;
          pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseItemDetailHTML();
          queueSaveUserState();
          syncMyCourseProgress(currentCourseId);
        }

        function courseItemDetailHTML(){
          const { course, item } = findCourseItem();
          if (!course || !item) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const isQuiz = courseItemIsQuiz(item.type);
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
<div class="-mx-5">${overlayHeader(escapeHtml(item.title), '20px', `openCourseDetail('${course.id}')`)}</div>
                <div class="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-4">
                  <span>${courseItemTypeLabel(item.type)}</span>
                  ${item.duration ? `<span class="text-gray-400">· ${escapeHtml(item.duration)}</span>` : ''}
                </div>
                ${item.type === 'video' ? `
                  <div class="bg-black rounded-3xl mb-1 overflow-hidden flex items-center justify-center" style="aspect-ratio:16/9;">
                    ${item.mediaUrl
                      ? `<video id="course-video-${item.id}" src="${item.mediaUrl}" class="w-full h-full object-cover" controls controlsList="nodownload noplaybackrate" playsinline onloadedmetadata="checkCourseVideoAudio(this)"></video>`
                      : `<span class="text-white">${Icon('video','w-10 h-10')}</span>`}
                  </div>
                  <div id="course-video-noaudio-${item.id}" class="hidden text-xs text-amber-600 font-semibold mb-3">This video file has no audio track -- the sound is missing from the upload itself, not a playback setting.</div>
                  ${item.mediaUrl ? '' : '<div class="mb-3"></div>'}` : ''}
                ${item.type === 'image' ? `
                  <div class="bg-black rounded-3xl mb-3 overflow-hidden flex items-center justify-center" style="aspect-ratio:16/9;">
                    ${item.mediaUrl
                      ? `<img src="${item.mediaUrl}" class="w-full h-full object-cover">`
                      : `<span class="text-white">${Icon('camera','w-10 h-10')}</span>`}
                  </div>` : ''}
                ${item.type === 'document' ? `
                  <a href="${item.mediaUrl ? escapeHtml(item.mediaUrl) : '#'}" target="_blank" rel="noopener" class="py-4 border-t border-gray-100 mb-3 flex items-center gap-3 ${item.mediaUrl ? '' : 'pointer-events-none opacity-60'}">
                    <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:#1E90FF;">${Icon('doc','w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(item.mediaFileName || item.title)}</div>
                      <div class="text-xs text-gray-400">${item.mediaUrl ? 'Tap to open' : 'No file uploaded yet'}</div>
                    </div>
                    ${item.mediaUrl ? `<span class="text-gray-400 flex-shrink-0">${Icon('download','w-4 h-4')}</span>` : ''}
                  </a>` : ''}
                ${item.type === 'audio' ? `
                  <div class="bg-black rounded-3xl mb-3 flex items-center justify-center" style="aspect-ratio:21/9;">
                    <span class="text-white">${Icon('mic','w-10 h-10')}</span>
                  </div>` : ''}
                ${(item.type === 'video' || item.type === 'audio' || item.type === 'image' || item.type === 'document') && item.description ? `
                  <div class="py-4 border-t border-gray-100 mb-5 text-sm text-gray-700 leading-relaxed">${renderRichText(item.description)}</div>` : ''}
                ${(item.type === 'reading' || item.type === 'assignment' || item.type === 'project') ? `
                  <div class="py-4 border-t border-gray-100 mb-5 text-sm text-gray-700 leading-relaxed">${item.description ? renderRichText(item.description) : 'No additional content was added for this item yet.'}</div>` : ''}
                ${isQuiz ? courseQuizFormHTML(item) : ''}
                ${!isQuiz ? `
                  <button onclick="markCourseItemComplete()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white" style="background:${isCourseItemComplete(item) ? '#059669' : 'rgba(30,144,255,0.85)'};">
                    ${isCourseItemComplete(item) ? Icon('check','w-4 h-4') : ''} ${isCourseItemComplete(item) ? 'Completed' : 'Mark as complete'}
                  </button>` : ''}
                <div style="height:50px;" aria-hidden="true"></div>
              </div>
            </div>`;
        }

        function courseQuizFormHTML(item){
          const submitted = !!courseQuizSubmitted[item.id];
          const answers = courseQuizAnswers[item.id] || [];
          const questions = item.questions || [];
          if (!questions.length) return `<div class="bg-gray-50 rounded-3xl p-5 text-sm text-gray-500 text-center mb-5">No questions were added to this quiz yet.</div>`;
          let score = 0;
          if (submitted) questions.forEach((q, i) => { if (answers[i] === q.correct) score++; });
          return `
            ${questions.map((q, qi) => `
              <div class="bg-white rounded-3xl p-5 shadow-sm mb-3">
                <div class="font-semibold text-gray-800 mb-3">${qi + 1}. ${escapeHtml(q.text)}</div>
                ${q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrectOpt = submitted && oi === q.correct;
                  const isWrongPick = submitted && selected && oi !== q.correct;
                  let cls = 'border-gray-200';
                  if (isCorrectOpt) cls = 'border-emerald-600 bg-emerald-50 text-emerald-700';
                  else if (isWrongPick) cls = 'border-red-400 bg-red-50 text-red-600';
                  else if (selected) cls = `border-[${NAVY}]`;
                  return `<button ${submitted ? 'disabled' : `onclick="selectQuizAnswer(${qi},${oi})"`} class="w-full text-left px-4 py-2.5 rounded-2xl border mb-2 text-sm font-medium ${cls}">${escapeHtml(opt)}</button>`;
                }).join('')}
              </div>`).join('')}
            ${submitted
              ? `<div class="text-center font-bold text-gray-700 mb-4">Score: ${score}/${questions.length}</div>`
              : `<button onclick="submitCourseQuiz()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white mb-4" style="background:rgba(30,144,255,0.85);">Submit</button>`}
            ${courseQuizSubmissionHTML(item)}`;
        }

        function courseQuizSubmissionHTML(item){
          return `
            <div class="bg-white rounded-3xl p-5 shadow-sm mb-5">
              <div class="font-semibold text-sm text-gray-800 mb-1">Send us your final work</div>
              <div class="text-xs text-gray-500 mb-3">Upload the document, PDF, or file with your completed work for the team to review.</div>
              <input type="file" id="quiz-submission-input-${item.id}" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*" class="hidden" onchange="handleQuizSubmissionFile(event,'${item.id}')">
              ${item.submissionUrl ? `
                <div class="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3">
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:#1E90FF;">${Icon('doc','w-4.5 h-4.5')}</div>
                  <div class="flex-1 min-w-0 text-xs font-semibold text-gray-700 truncate">${escapeHtml(item.submissionFileName || 'Submitted file')}</div>
                  <button onclick="document.getElementById('quiz-submission-input-${item.id}').click()" class="text-xs font-bold flex-shrink-0" style="color:#1E90FF;">Replace</button>
                </div>
                <div class="text-[11px] text-emerald-600 font-semibold mt-2">${item.submissionUploading ? 'Uploading...' : 'Sent to the team'}</div>` : `
                <button onclick="document.getElementById('quiz-submission-input-${item.id}').click()" class="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-xs border border-dashed border-gray-300 text-gray-500">
                  ${Icon('camera','w-4 h-4')} ${item.submissionUploading ? 'Uploading...' : 'Upload your file'}
                </button>`}
            </div>`;
        }

        function handleQuizSubmissionFile(e, itemId){
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const { item } = findCourseItem();
          if (!item || item.id !== itemId) return;
          item.submissionFileName = file.name;
          item.submissionUrl = URL.createObjectURL(file);
          item.submissionUploading = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseItemDetailHTML();
          uploadCourseItemMediaToStorage(file, itemId + '-submission').then(remoteUrl => {
            if (remoteUrl) {
              item.submissionUrl = remoteUrl;
            } else {
              openAppAlertModal("This upload didn't reach the team's shared storage, so it may not be visible to them. Please try again in a moment, or send it another way if this keeps happening.");
            }
            item.submissionUploading = false;
            const ov2 = document.getElementById('overlay');
            if (ov2) ov2.innerHTML = courseItemDetailHTML();
            queueSaveUserState();
          });
        }

        // ---- Course creation/editing (teacher side) ----
        function openNewCourse(){
          if (!canCreateCourses()) return;
          resetNewCourseDraft();
          newCourseEditingId = null;
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = null;
          openOverlay('newCourse');
        }

        function openEditCourse(courseId){
          if (!canManageCourse(courseId)) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c) return;
          newCourseDraft = JSON.parse(JSON.stringify({ title: c.title, description: c.description, deliveryType: c.deliveryType || 'uploaded', modules: c.modules, resources: c.resources || [], finalItems: c.finalItems || [], photo: c.photo || null, price: c.price ? String(c.price) : '', currency: c.currency || 'GHS' }));
          newCourseEditingId = courseId;
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = null;
          // Opened from a course page: the back arrow returns there
          if (currentOverlayKind === 'courseDetail') overlayReturnTo = 'courseDetail';
          openOverlay('newCourse');
        }

        function rerenderNewCourseOverlay(){
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const prevScrollEl = ov.querySelector('.overflow-y-auto');
          const prevScrollTop = prevScrollEl ? prevScrollEl.scrollTop : 0;
          ov.innerHTML = newCourseHTML();
          const newScrollEl = ov.querySelector('.overflow-y-auto');
          if (newScrollEl) newScrollEl.scrollTop = prevScrollTop;
        }

        function setNewCourseDeliveryType(type){
          newCourseDraft.deliveryType = type;
          rerenderNewCourseOverlay();
        }

        function addCourseDraftResource(){
          if (!newCourseDraft.resources) newCourseDraft.resources = [];
          newCourseDraft.resources.push({ id:'res' + Date.now() + Math.random().toString(36).slice(2,6), title:'', type:'video', url:'', duration:'' });
          rerenderNewCourseOverlay();
        }

        function removeCourseDraftResource(ri){
          newCourseDraft.resources.splice(ri, 1);
          rerenderNewCourseOverlay();
        }

        function updateCourseDraftResourceField(ri, field, value){
          newCourseDraft.resources[ri][field] = value;
        }

        function setCourseDraftResourceType(ri, type){
          newCourseDraft.resources[ri].type = type;
          rerenderNewCourseOverlay();
        }

        function courseDraftResourceHTML(r, ri){
          return `
            <div class="flex items-center justify-between gap-2 py-3 mb-1" style="border-bottom:1px solid rgba(107,114,128,0.18);">
              <button onclick="openCourseAddResource('${DRAFT_COURSE_ID}', ${ri})" class="min-w-0 flex-1 flex items-center gap-3 text-left">
                <div class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon(r.type === 'audio' ? 'mic' : 'video','w-4 h-4')}</div>
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(r.title || 'Untitled resource')}</div>
                  <div class="text-xs text-gray-400 truncate">${r.type === 'audio' ? 'Audio' : 'Video'}${r.duration ? ' · ' + escapeHtml(r.duration) : ''}${r.url ? '' : ' · No link yet'}</div>
                </div>
              </button>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button onclick="openCourseAddResource('${DRAFT_COURSE_ID}', ${ri})" class="text-gray-400" style="padding:2px;">${Icon('edit','w-4 h-4')}</button>
                <button onclick="removeCourseDraftResource(${ri})" class="text-red-500" style="padding:2px;">${Icon('close','w-4 h-4')}</button>
              </div>
            </div>`;
        }

        function updateNewCourseField(field, value){
          newCourseDraft[field] = value;
        }

        function addCourseDraftModule(){
          newCourseDraft.modules.push({ id:'mod' + Date.now() + Math.random().toString(36).slice(2,6), title:'Module ' + (newCourseDraft.modules.length + 1), description:'', items:[] });
          rerenderNewCourseOverlay();
        }

        function removeCourseDraftModule(mi){
          newCourseDraft.modules.splice(mi, 1);
          if (newCourseAddingItemModuleIndex === mi) { newCourseAddingItemModuleIndex = null; newCourseEditingItemIndex = null; newCourseEditingItemOriginalPlacement = null; newCourseAddingItemDraft = null; }
          rerenderNewCourseOverlay();
        }

        function updateCourseDraftModuleTitle(mi, value){
          newCourseDraft.modules[mi].title = value;
        }

        function updateCourseDraftModuleDescription(mi, value){
          newCourseDraft.modules[mi].description = value;
        }

        function removeCourseDraftItem(mi, ii){
          newCourseDraft.modules[mi].items.splice(ii, 1);
          rerenderNewCourseOverlay();
        }

        function removeCourseDraftFinalItem(ii){
          newCourseDraft.finalItems.splice(ii, 1);
          rerenderNewCourseOverlay();
        }

        // ---- Course module/item drafting (add/edit/remove) ----
        function openAddCourseItemForm(mi){
          newCourseAddingItemModuleIndex = mi;
          newCourseEditingItemIndex = null;
          newCourseEditingItemOriginalPlacement = null;
          newCourseAddingItemDraft = { title:'', type:'video', duration:'', description:'', questions:[], mediaUrl:null, mediaType:null, mediaFileName:null, mediaUploading:false };
          rerenderNewCourseOverlay();
        }

        function openAddFinalItemForm(){
          newCourseAddingItemModuleIndex = 'final';
          newCourseEditingItemIndex = null;
          newCourseEditingItemOriginalPlacement = null;
          newCourseAddingItemDraft = { title:'', type:'project', duration:'', description:'', questions:[], mediaUrl:null, mediaType:null, mediaFileName:null, mediaUploading:false };
          rerenderNewCourseOverlay();
        }

        function openEditCourseItemForm(mi, ii){
          if (!canCreateCourses()) return;
          const it = newCourseDraft.modules[mi].items[ii];
          newCourseAddingItemModuleIndex = mi;
          newCourseEditingItemIndex = ii;
          newCourseEditingItemOriginalPlacement = mi;
          newCourseAddingItemDraft = {
            title: it.title || '',
            type: it.type || 'video',
            duration: it.duration || '',
            description: it.description || '',
            questions: (it.questions || []).map(q => ({ text:q.text || '', options:(q.options || ['', '', '', '']).slice(), correct:q.correct || 0 })),
            mediaUrl: it.mediaUrl || null,
            mediaType: it.mediaType || null,
            mediaFileName: it.mediaFileName || null,
            mediaUploading: false,
          };
          rerenderNewCourseOverlay();
        }

        function openEditFinalItemForm(ii){
          if (!canCreateCourses()) return;
          const it = newCourseDraft.finalItems[ii];
          newCourseAddingItemModuleIndex = 'final';
          newCourseEditingItemIndex = ii;
          newCourseEditingItemOriginalPlacement = 'final';
          newCourseAddingItemDraft = {
            title: it.title || '',
            type: it.type || 'project',
            duration: it.duration || '',
            description: it.description || '',
            questions: (it.questions || []).map(q => ({ text:q.text || '', options:(q.options || ['', '', '', '']).slice(), correct:q.correct || 0 })),
            mediaUrl: it.mediaUrl || null,
            mediaType: it.mediaType || null,
            mediaFileName: it.mediaFileName || null,
            mediaUploading: false,
          };
          rerenderNewCourseOverlay();
        }

        function setAddingItemPlacement(value){
          newCourseAddingItemModuleIndex = value === 'final' ? 'final' : parseInt(value, 10);
          rerenderNewCourseOverlay();
        }

        function cancelAddCourseItem(){
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseEditingItemOriginalPlacement = null;
          newCourseAddingItemDraft = null;
          rerenderNewCourseOverlay();
        }

        function updateAddingItemField(field, value){
          newCourseAddingItemDraft[field] = value;
        }

        function setAddingItemType(type){
          newCourseAddingItemDraft.type = type;
          rerenderNewCourseOverlay();
        }

        function handleAddingItemMediaSelected(e){
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const d = newCourseAddingItemDraft;
          if (!d) return;
          d.mediaType = d.type === 'video' ? 'video' : 'image';
          d.mediaFileName = file.name;
          d.mediaUrl = URL.createObjectURL(file);
          d.mediaUploading = true;
          rerenderNewCourseOverlay();
          const itemId = 'item' + Date.now() + Math.random().toString(36).slice(2,6);
          d.pendingItemId = itemId;
          uploadCourseItemMediaToStorage(file, itemId).then(remoteUrl => {
            if (newCourseAddingItemDraft !== d) return; 
            if (remoteUrl) {
              d.mediaUrl = remoteUrl;
            } else {
              openAppAlertModal("This file uploaded to your device but couldn't reach shared storage, so it will only play for you and will look broken to students. Ask whoever set up the app's backend to create the \"course-media\" storage bucket, then re-upload this file.");
            }
            d.mediaUploading = false;
            rerenderNewCourseOverlay();
          });
        }

        function removeAddingItemMedia(){
          const d = newCourseAddingItemDraft;
          if (!d) return;
          d.mediaUrl = null;
          d.mediaType = null;
          d.mediaFileName = null;
          d.mediaUploading = false;
          rerenderNewCourseOverlay();
        }

        function addAddingItemQuestion(){
          newCourseAddingItemDraft.questions.push({ text:'', options:['', '', '', ''], correct:0 });
          rerenderNewCourseOverlay();
        }

        function removeAddingItemQuestion(qi){
          newCourseAddingItemDraft.questions.splice(qi, 1);
          rerenderNewCourseOverlay();
        }

        function updateAddingItemQuestionText(qi, value){
          newCourseAddingItemDraft.questions[qi].text = value;
        }

        function updateAddingItemOption(qi, oi, value){
          newCourseAddingItemDraft.questions[qi].options[oi] = value;
        }

        function setAddingItemCorrect(qi, oi){
          newCourseAddingItemDraft.questions[qi].correct = oi;
          rerenderNewCourseOverlay();
        }

        function confirmAddCourseItem(){
          const d = newCourseAddingItemDraft;
          if (!d.title.trim()) { openAppAlertModal('Please add a title for this item.'); return; }
          if (d.mediaUploading) { openAppAlertModal('Still uploading the file -- give it a moment and try again.'); return; }
          const isQuiz = courseItemIsQuiz(d.type);
          if (isQuiz && !d.questions.length) { openAppAlertModal('Add at least one question to this quiz.'); return; }
          const item = {
            id: 'item' + Date.now() + Math.random().toString(36).slice(2,6),
            title: d.title.trim(),
            type: d.type,
            duration: d.duration.trim(),
            description: d.description.trim(),
            mediaUrl: (d.type === 'video' || d.type === 'image') ? (d.mediaUrl || null) : null,
            mediaType: (d.type === 'video' || d.type === 'image') ? d.mediaType : null,
            mediaFileName: (d.type === 'video' || d.type === 'image') ? (d.mediaFileName || null) : null,
          };
          if (isQuiz) item.questions = d.questions.map(q => ({ text:q.text.trim(), options:q.options.map(o => o.trim()), correct:q.correct }));
          const targetList = newCourseAddingItemModuleIndex === 'final' ? newCourseDraft.finalItems : newCourseDraft.modules[newCourseAddingItemModuleIndex].items;
          if (newCourseEditingItemIndex !== null) {
            const originalList = newCourseEditingItemOriginalPlacement === 'final' ? newCourseDraft.finalItems : newCourseDraft.modules[newCourseEditingItemOriginalPlacement].items;
            const existing = originalList[newCourseEditingItemIndex];
            item.id = existing.id;
            if (originalList === targetList) {
              targetList[newCourseEditingItemIndex] = item;
            } else {
              originalList.splice(newCourseEditingItemIndex, 1);
              targetList.push(item);
            }
          } else {
            targetList.push(item);
          }
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseEditingItemOriginalPlacement = null;
          newCourseAddingItemDraft = null;
          rerenderNewCourseOverlay();
        }

        // 0 = free. The number saved here is only what is SHOWN
        function coursePriceFromDraft(d){
          const n = Math.round(parseFloat(d.price) || 0);
          return n > 0 ? n : 0;
        }

        async function publishNewCourse(){
          if (newCourseEditingId ? !canManageCourse(newCourseEditingId) : !canCreateCourses()) return;
          const d = newCourseDraft;
          if (!d.title.trim()) { openAppAlertModal('Please add a course title.'); return; }
          if (d.price !== '' && d.price !== undefined && !(parseFloat(d.price) >= 0)) { openAppAlertModal('Enter a valid price, or leave it empty for a free course.'); return; }
          if (!d.modules.length || !d.modules.some(m => m.items.length)) { openAppAlertModal('Add at least one module with at least one item.'); return; }
          if (newCourseEditingId) {
            const c = allCourses.find(x => x.id === newCourseEditingId);
            if (c) {
              c.title = d.title.trim();
              c.description = d.description.trim();
              c.deliveryType = d.deliveryType || 'uploaded';
              c.modules = d.modules;
              c.resources = d.resources || [];
              c.finalItems = d.finalItems || [];
              c.photo = d.photo || null;
              c.price = coursePriceFromDraft(d); c.currency = d.currency || 'GHS';
              const synced = await postCourseInsertRemote(c);
              if (!synced) openAppAlertModal("Saved on this device, but couldn't sync to the shared course catalog -- it may not show up for other students or survive your next sign-in. Check the console for details.");
              if (c.opportunityId) {
                const job = findJob(c.opportunityId);
                if (job) {
                  job.title = c.title;
                  job.description = c.description;
                  if (c.photo) job.coverImage = c.photo;
                  await postOpportunityInsertRemote(job);
                  const jobsContentEl = document.getElementById('jobs-content');
                  if (jobsContentEl) jobsContentEl.innerHTML = jobsContent();
                }
              }
            }
            newCourseEditingId = null;
            resetNewCourseDraft();
            closeOverlay();
            classroomAreaTab = 'courses';
            renderStudy();
            return;
          }
          const course = {
            id: 'course' + Date.now(),
            createdBy: (typeof currentUserId !== 'undefined' && currentUserId) ? currentUserId : null,
            org: TEAM_STITCH_TEACHER,
            title: d.title.trim(),
            description: d.description.trim(),
            deliveryType: d.deliveryType || 'uploaded',
            modules: d.modules,
            resources: d.resources || [],
            finalItems: d.finalItems || [],
            photo: d.photo || null,
            price: coursePriceFromDraft(d),
            currency: d.currency || 'GHS',
            announcements: [], 
            enrolledUsers: [], 
            colorIndex: Math.floor(Math.random() * blueCardPalette.length),
            motifIndex: Math.floor(Math.random() * classCardMotifs.length),
          };
          allCourses.unshift(course);
          const synced = await postCourseInsertRemote(course);
          if (!synced) openAppAlertModal("This course was saved on this device only -- it couldn't sync to the shared catalog, so it will disappear next time you sign in and won't show up for other students. Check the console for the Supabase error, or make sure the courses table + policies from the SQL comment above are set up.");
          resetNewCourseDraft();
          closeOverlay();
          classroomAreaTab = 'courses';
          renderStudy();
        }

        // ---- Course enrolled people (who's enrolled, with email + username) ----
        function openCourseEnrolledPeople(courseId){
          coursePeopleViewingId = courseId;
          if (currentOverlayKind === 'courseDetail') overlayReturnTo = 'courseDetail';
          openOverlay('coursePeople');
          refreshCoursesThen('coursePeople');
        }

        function courseEnrolledPeopleHTML(){
          const c = allCourses.find(x => x.id === coursePeopleViewingId);
          if (!c) return `${overlayHeader('People', '20px', null, null, { right: true, pb: '20px', titleSize: 'text-3xl' })}<div class="p-5 text-center text-gray-400 text-sm">This course is no longer available.</div>`;
          const people = c.enrolledUsers || [];
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto px-5 pb-8">
<div class="-mx-5">${overlayHeader('People', '20px', null, null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">${people.length} enrolled</div>
                ${people.length ? people.map((p, i) => `
                  <div class="flex items-center gap-3 py-3.5 ${i < people.length - 1 ? 'border-b border-gray-100' : ''}">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('user','w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-sm truncate">${escapeHtml(p.name || 'Unnamed')}</div>
                      <div class="text-xs text-gray-400 truncate">${p.username ? '@' + escapeHtml(p.username) : ''}${p.username && p.email ? ' &middot; ' : ''}${p.email ? escapeHtml(p.email) : ''}</div>
                    </div>
                  </div>`).join('') : `
                  <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                    <div class="flex justify-center mb-2 text-gray-400">${Icon('personPlus','w-6 h-6')}</div>
                    No one has enrolled yet.
                  </div>`}
              </div>
            </div>`;
        }

        // ---- Course analytics (creator/admin view: enrolment, completion, drop-off, progress)
        // ----
        let courseAnalyticsViewingId = null;
        // Writes the signed-in student's own enrolment / progress / leave record through the
        // course_report_self RPC (security definer
        async function courseReportSelf(courseId, action, entry){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.rpc('course_report_self', { p_course_id: courseId, p_action: action, p_entry: entry || {} });
            if (error) { console.warn('Course progress did not sync (course_report_self):', error); return false; }
            return true;
          } catch (e) { console.warn('Course progress sync threw:', e); return false; }
        }
        // Pull the latest roster/progress before the creator looks at People or Analytics.
        async function refreshCoursesThen(kind){
          try { await loadCoursesRemote(); } catch (e) {}
          const fn = kind === 'courseAnalytics' ? courseAnalyticsHTML : courseEnrolledPeopleHTML;
          if (typeof dlRerender === 'function') dlRerender(kind, fn);
          else { const ov = document.getElementById('overlay'); if (ov && currentOverlayKind === kind) ov.innerHTML = fn(); }
        }
        function openCourseAnalytics(courseId){
          courseAnalyticsViewingId = courseId;
          if (currentOverlayKind === 'courseDetail') overlayReturnTo = 'courseDetail';
          openOverlay('courseAnalytics');
          refreshCoursesThen('courseAnalytics');
        }

        function courseAllItems(c){
          return (c.modules || []).flatMap(m => m.items || []).concat(c.finalItems || []);
        }

        function syncMyCourseProgress(courseId){
          const c = allCourses.find(x => x.id === courseId);
          if (!c || !enrolledCourseIds.includes(courseId)) return;
          getCurrentUserId().then(myId => {
            if (!myId || !c.enrolledUsers) return;
            const u = c.enrolledUsers.find(x => x.id === myId);
            if (!u) return;
            const items = courseAllItems(c);
            const ids = items.filter(it => isCourseItemComplete(it)).map(it => it.id);
            u.doneIds = ids;
            u.done = ids.length;
            u.progress = items.length ? Math.round((ids.length / items.length) * 100) : 0;
            u.lastActive = Date.now();
            if (items.length && ids.length >= items.length) { if (!u.completedAt) u.completedAt = Date.now(); }
            else delete u.completedAt;
            const quiz = {};
            items.filter(it => courseItemIsQuiz(it.type) && courseQuizSubmitted[it.id]).forEach(it => {
              const qs = it.questions || [], ans = courseQuizAnswers[it.id] || [];
              if (qs.length) quiz[it.id] = Math.round((qs.filter((q, i) => ans[i] === q.correct).length / qs.length) * 100);
            });
            u.quiz = quiz;
            courseReportSelf(courseId, 'progress', { progress: u.progress, done: u.done, doneIds: u.doneIds, quiz: u.quiz });
          });
        }

        function courseAnalyticsCollect(c){
          const DAY = 86400000, now = Date.now();
          const users = c.enrolledUsers || [];
          const left = c.leftUsers || [];
          const items = courseAllItems(c);
          const pctOf = u => Math.max(0, Math.min(100, Number(u.progress) || 0));
          const completed = users.filter(u => pctOf(u) >= 100 || u.completedAt);
          const notStarted = users.filter(u => pctOf(u) === 0);
          const inProgress = users.filter(u => !completed.includes(u) && pctOf(u) > 0);
          const everEnrolled = users.length + left.length;
          const avgProgress = users.length ? Math.round(users.reduce((n, u) => n + pctOf(u), 0) / users.length) : 0;
          const active7 = users.filter(u => u.lastActive && now - u.lastActive <= 7 * DAY && !completed.includes(u));
          const stalled = users.filter(u => !completed.includes(u) && pctOf(u) > 0 && u.lastActive && now - u.lastActive > 14 * DAY);
          const durations = completed.filter(u => u.completedAt && u.enrolledAt).map(u => (u.completedAt - u.enrolledAt) / DAY);
          const avgDays = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;
          const buckets = [
            { label: '0%', n: users.filter(u => pctOf(u) === 0).length },
            { label: '1-25', n: users.filter(u => pctOf(u) >= 1 && pctOf(u) <= 25).length },
            { label: '26-50', n: users.filter(u => pctOf(u) >= 26 && pctOf(u) <= 50).length },
            { label: '51-75', n: users.filter(u => pctOf(u) >= 51 && pctOf(u) <= 75).length },
            { label: '76-99', n: users.filter(u => pctOf(u) >= 76 && pctOf(u) <= 99).length },
            { label: '100%', n: completed.length },
          ];
          const WEEKS = 8;
          const wk = insightsWeekBuckets(WEEKS);
          const enrolledW = new Array(WEEKS).fill(0), leftW = new Array(WEEKS).fill(0), doneW = new Array(WEEKS).fill(0);
          users.forEach(u => { const i = wk.idxOf(u.enrolledAt); if (i >= 0) enrolledW[i]++; });
          left.forEach(u => { const i = wk.idxOf(u.leftAt); if (i >= 0) leftW[i]++; });
          completed.forEach(u => { const i = wk.idxOf(u.completedAt); if (i >= 0) doneW[i]++; });
          const modules = (c.modules || []).map((m, mi) => {
            const ids = (m.items || []).map(it => it.id);
            const finished = ids.length ? users.filter(u => ids.every(id => (u.doneIds || []).includes(id))).length : 0;
            return { title: m.title || ('Module ' + (mi + 1)), pct: users.length && ids.length ? Math.round((finished / users.length) * 100) : 0, finished };
          });
          const itemRates = items.map(it => {
            const n = users.filter(u => (u.doneIds || []).includes(it.id)).length;
            return { title: it.title || 'Untitled', type: it.type, n, pct: users.length ? Math.round((n / users.length) * 100) : 0 };
          });
          const quizzes = items.filter(it => courseItemIsQuiz(it.type)).map(it => {
            const scores = users.map(u => u.quiz && u.quiz[it.id]).filter(v => typeof v === 'number');
            return { title: it.title || 'Quiz', takers: scores.length, avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
          });
          const withQuiz = quizzes.filter(q => q.avg !== null);
          const avgQuiz = withQuiz.length ? Math.round(withQuiz.reduce((a, q) => a + q.avg, 0) / withQuiz.length) : null;
          const leftAvg = left.length ? Math.round(left.reduce((n, u) => n + (Number(u.progress) || 0), 0) / left.length) : 0;
          return {
            users, left, items, completed, notStarted, inProgress, everEnrolled, avgProgress, active7, stalled, avgDays, buckets,
            labels: wk.labels, enrolledW, leftW, doneW, modules, itemRates, quizzes, avgQuiz, leftAvg,
            completionRate: users.length ? Math.round((completed.length / users.length) * 100) : 0,
            retention: everEnrolled ? Math.round((users.length / everEnrolled) * 100) : 100,
            dropoutRate: everEnrolled ? Math.round((left.length / everEnrolled) * 100) : 0,
            noTracking: users.length > 0 && users.every(u => u.progress === undefined),
          };
        }

        function caCard(title, sub, body){
          return `<div style="padding:6px 2px 10px;">
            <div class="font-semibold text-sm text-gray-800">${title}</div>
            ${sub ? `<div class="text-xs text-gray-400" style="margin-bottom:12px;">${sub}</div>` : '<div style="height:10px;"></div>'}
            ${body}</div>`;
        }
        function caBar(label, pct, right, color){
          return `<div style="margin-bottom:11px;">
            <div class="flex items-center justify-between gap-3" style="margin-bottom:4px;"><div class="text-xs text-gray-600 truncate" style="min-width:0;">${escapeHtml(label)}</div><div class="text-[11px] text-gray-400 flex-shrink-0">${right}</div></div>
            <div style="height:9px;border-radius:6px;background:rgba(107,114,128,0.14);overflow:hidden;"><div style="height:100%;width:${Math.max(pct ? 3 : 0, Math.min(100, pct))}%;border-radius:6px;background:${color};"></div></div>
          </div>`;
        }
        function caRing(pct, color, label){
          const R = 38, C = 2 * Math.PI * R;
          return `<div style="position:relative;width:96px;height:96px;flex-shrink:0;">
            <svg width="96" height="96" viewBox="0 0 96 96" style="transform:rotate(-90deg);"><circle cx="48" cy="48" r="${R}" fill="none" stroke="rgba(107,114,128,0.18)" stroke-width="9"/><circle cx="48" cy="48" r="${R}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(100, pct) / 100)}"/></svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"><div class="font-bold text-xl font-display" style="color:${color};line-height:1;">${pct}%</div><div class="text-[10px] text-gray-400" style="margin-top:2px;">${label}</div></div>
          </div>`;
        }

        function courseAnalyticsHTML(){
          const c = allCourses.find(x => x.id === courseAnalyticsViewingId);
          if (!c) return `${overlayHeader('Analytics', '20px', null, null, { right: true, pb: '20px', titleSize: 'text-3xl' })}<div class="p-5 text-center text-gray-400 text-sm">This course is no longer available.</div>`;
          const A = courseAnalyticsCollect(c);
          const C = ACT_COLORS;
          const empty = A.everEnrolled === 0;
          const statusRows = [
            { label: 'Completed', n: A.completed.length, color: C.green },
            { label: 'In progress', n: A.inProgress.length, color: C.blue },
            { label: 'Not started', n: A.notStarted.length, color: C.amber },
            { label: 'Left the course', n: A.left.length, color: C.red },
          ];
          const statusTotal = statusRows.reduce((n, r) => n + r.n, 0);
          let acc = 0;
          const stops = statusRows.filter(r => r.n).map(r => { const from = acc / statusTotal * 100; acc += r.n; return `${r.color} ${from}% ${acc / statusTotal * 100}%`; }).join(', ');
          const pie = statusTotal ? `
            <div class="myact-pie-wrap">
              <div class="myact-pie" style="background:conic-gradient(${stops});"></div>
              <div class="myact-legend">${statusRows.map(r => `<div class="myact-legend-row"><span class="myact-legend-dot" style="background:${r.color};"></span><span class="myact-legend-label">${r.label}</span><span class="myact-legend-val">${r.n} &middot; ${Math.round(r.n / statusTotal * 100)}%</span></div>`).join('')}</div>
            </div>` : statusRows.map(r => caBar(r.label, 0, '0 &middot; 0%', r.color)).join('');
          const maxB = Math.max(1, ...A.buckets.map(b => b.n));
          const progressDist = insightsBarChartHTML(A.buckets.map(b => b.label), A.buckets.map(b => b.n), ROYAL);
          const hardest = A.itemRates.length ? A.itemRates.slice().sort((a, b) => a.pct - b.pct).slice(0, 5) : [];
          const bestQuiz = A.quizzes.filter(q => q.avg !== null);
          const top = A.users.slice().sort((a, b) => (Number(b.progress) || 0) - (Number(a.progress) || 0)).slice(0, 5).filter(u => (Number(u.progress) || 0) > 0);
          const recentLeft = A.left.slice().sort((a, b) => (b.leftAt || 0) - (a.leftAt || 0)).slice(0, 5);
          const fmtDate = ts => ts ? new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          const personRow = (name, username, right, i, n) => `
            <div class="flex items-center gap-3 py-2.5 ${i < n - 1 ? 'border-b border-gray-100' : ''}">
              <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('user','w-4 h-4')}</div>
              <div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${escapeHtml(name || 'Unnamed')}</div>${username ? `<div class="text-[11px] text-gray-400 truncate">@${escapeHtml(username)}</div>` : ''}</div>
              <div class="text-xs font-semibold text-gray-500 flex-shrink-0">${right}</div>
            </div>`;
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
            ${overlayHeader('Analytics', '20px', null, null, { right: true, pb: '20px', titleSize: 'text-3xl' })}
            <div class="p-5 space-y-4">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 truncate text-center">${escapeHtml(c.title || 'Course')}</div>

              <div class="rounded-3xl p-5 text-white stat-hero-pill" style="background:linear-gradient(135deg,${ROYAL},${NAVY});position:relative;overflow:hidden;">
                <div class="flex items-start justify-between gap-3">
                <div style="min-width:0;">
                <div class="text-xs text-blue-200 font-semibold uppercase tracking-wide">Course at a glance</div>
                <div style="display:flex;flex-wrap:wrap;column-gap:44px;row-gap:14px;margin-top:16px;">
                  <div><div class="text-2xl font-bold font-display" style="line-height:1;">${A.users.length}</div><div class="text-[11px] text-blue-100" style="margin-top:6px;white-space:nowrap;">Enrolled</div></div>
                  <div><div class="text-2xl font-bold font-display" style="line-height:1;">${A.avgProgress}%</div><div class="text-[11px] text-blue-100" style="margin-top:6px;white-space:nowrap;">Avg progress</div></div>
                </div>
                </div>
                <button type="button" onclick="downloadCourseAnalytics()" aria-label="Download course analytics" class="myact-dl-circle course-analytics-dl">${Icon('download','w-5 h-5')}</button>
                </div>
              </div>

              ${A.noTracking ? `<div class="text-xs text-gray-500 bg-white rounded-2xl p-3 shadow-sm">Progress is recorded as students finish parts, starting from now. Learners who enrolled earlier will appear at 0% until they next open the course.</div>` : ''}

              <div class="flex gap-3">
                ${actStatTile(A.completionRate + '%', 'Completion rate', C.green)}
                ${actStatTile(A.retention + '%', 'Retention', C.blue)}
                ${actStatTile(A.dropoutRate + '%', 'Drop-out rate', C.red)}
              </div>
              <div class="flex gap-3">
                ${actStatTile(A.active7.length, 'Active this week', C.cyan)}
                ${actStatTile(A.stalled.length, 'Stalled 14d+', C.amber)}
                ${actStatTile(A.avgDays === null ? '--' : A.avgDays + 'd', 'Avg days to finish', C.purple)}
              </div>

              ${empty ? `<div class="text-center" style="padding:6px 8px 2px;"><div class="font-semibold text-sm text-gray-800">No learners yet</div><div class="text-xs text-gray-400" style="margin-top:4px;">Analytics fill in as students enrol and work through the course.</div></div>` : ''}
              ${(() => { return `
              ${caCard('Where learners are', `${A.everEnrolled} ever enrolled`, pie)}

              ${caCard('Success vs. drop-off', 'Completion and retention', `
                <div class="flex items-center justify-around gap-3">
                  <div class="flex flex-col items-center gap-1">${caRing(A.completionRate, C.green, 'completed')}<div class="text-[11px] text-gray-400">${A.completed.length} of ${A.users.length} enrolled</div></div>
                  <div class="flex flex-col items-center gap-1">${caRing(A.retention, C.blue, 'stayed')}<div class="text-[11px] text-gray-400">${A.left.length} left${A.left.length ? ' at ~' + A.leftAvg + '%' : ''}</div></div>
                </div>`)}

              ${caCard('Progress spread', 'How many learners sit at each progress level', progressDist)}

              ${caCard('Enrolments', 'New learners &middot; last 8 weeks', insightsBarChartHTML(A.labels, A.enrolledW, ROYAL))}

              ${caCard('Trend', 'Completions vs. learners who left', insightsLineChartHTML(A.labels, [
                { name: 'Completed', color: C.green, values: A.doneW, area: true },
                { name: 'Left', color: C.red, values: A.leftW },
                { name: 'Enrolled', color: C.blue, values: A.enrolledW },
              ]))}

              ${A.modules.length ? caCard('Module completion', 'Share of enrolled learners who finished every part', A.modules.map(m => caBar(m.title, m.pct, `${m.pct}% &middot; ${m.finished}`, C.blue)).join('')) : ''}

              ${hardest.length ? caCard('Parts people skip most', 'Lowest completion first', hardest.map(h => caBar(h.title, h.pct, `${h.pct}%`, h.pct >= 60 ? C.green : (h.pct >= 30 ? C.amber : C.red))).join('')) : ''}

              ${bestQuiz.length ? caCard('Quiz performance', `${A.avgQuiz}% average across quizzes`, bestQuiz.map(q => caBar(q.title, q.avg, `${q.avg}% &middot; ${q.takers} taken`, C.purple)).join('')) : ''}

              ${top.length ? caCard('Top learners', 'Furthest through the course', top.map((u, i) => personRow(u.name, u.username, (Number(u.progress) || 0) + '%', i, top.length)).join('')) : ''}

              ${recentLeft.length ? caCard('Recently left', 'Progress when they left', recentLeft.map((u, i) => personRow(u.name, u.username, `${Number(u.progress) || 0}% &middot; ${fmtDate(u.leftAt)}`, i, recentLeft.length)).join('')) : ''}
              `; })()}
              <button id="course-analytics-dl-btn" type="button" onclick="downloadCourseAnalytics()" class="myact-dl-pill">${Icon('download','w-5 h-5')}<span>Download course analytics</span></button>
              <div class="text-[11px] text-gray-400 text-center" style="padding-bottom:max(24px, env(safe-area-inset-bottom));">Saves everything on this page as a PDF on your device.</div>
            </div>
            </div>
            </div>`;
        }

        async function downloadCourseAnalytics(){
          if (typeof dlCancelActive === 'function' && dlCancelActive()) return;
          const c = allCourses.find(x => x.id === courseAnalyticsViewingId);
          if (!c) return;
          const btns = Array.from(document.querySelectorAll('#course-analytics-dl-btn, .course-analytics-dl'));
          const labels = btns.map(b => b.innerHTML);
          const prog = (typeof dlProgressStart === 'function') ? dlProgressStart(btns) : { to(){}, finish: async () => {}, stop(){} };
          try {
            const jsPDF = await loadJsPdfLib();
            prog.to(45);
            if (typeof loadColmeakPdfFont === 'function') await loadColmeakPdfFont();
            prog.to(75);
            await new Promise(r => setTimeout(r, 80));
            if (prog.cancelled) return;
            buildCourseAnalyticsPdf(jsPDF, c);
            await prog.finish();
          } catch (e) {
            prog.stop();
            console.warn('Course analytics PDF failed:', e);
            if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't prepare your PDF. Check your connection and try again.");
          } finally {
            // the shared download helper puts the buttons back
          }
        }

        function buildCourseAnalyticsPdf(jsPDF, c){
          const A = courseAnalyticsCollect(c);
          const C = ACT_COLORS;
          const doc = new jsPDF({ unit: 'mm', format: 'a4' }); pdfWatermarkInit(doc);
          const PW = 210, PH = 297, M = 14, CW = PW - M * 2, BOTTOM = PH - 18;
          let y = 0;
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
          const typeface = display => (display && useColmeak) ? 'Colmeak' : (useMont ? 'Montserrat' : (useColmeak ? 'Colmeak' : 'helvetica'));
          const rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
          const fill = h => doc.setFillColor(...rgb(h));
          const stroke = h => doc.setDrawColor(...rgb(h));
          const color = h => doc.setTextColor(...rgb(h));
          const font = (size, bold, display) => { doc.setFont(typeface(display), bold ? 'bold' : 'normal'); doc.setFontSize(size); };
          const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = 18; } };
          const clip = (s, w) => { const t = doc.splitTextToSize(txt(s), w); return t[0] || ''; };
          const section = (title, sub, need) => {
            y += 8; ensure(need || 40);
            stroke('#e5e7eb'); doc.setLineWidth(0.3); doc.line(M, y - 3, M + CW, y - 3);
            color('#000000'); font(12.5, true, true); doc.text(txt(title), M, y + 2.6);
            y += 7;
            if (sub) { color('#6b7280'); font(8.5, false); doc.text(txt(sub), M, y + 1); y += 5; }
            y += 2;
          };
          const bar = (label, pct, right, hex) => {
            ensure(11);
            color('#374151'); font(9, false); doc.text(clip(label, CW - 40), M, y + 3);
            color('#6b7280'); doc.text(txt(right), M + CW, y + 3, { align: 'right' });
            fill('#e5e7eb'); doc.roundedRect(M, y + 5, CW, 2.6, 1.3, 1.3, 'F');
            if (pct > 0) { fill(hex); doc.roundedRect(M, y + 5, Math.max(2.6, CW * Math.min(100, pct) / 100), 2.6, 1.3, 1.3, 'F'); }
            y += 11;
          };
          const columns = (labels, values, hex) => {
            const H = 38, max = Math.max(1, ...values), n = labels.length, gap = 3, w = (CW - gap * (n - 1)) / n;
            ensure(H + 14);
            labels.forEach((l, i) => {
              const h = values[i] ? Math.max(1.5, (values[i] / max) * (H - 8)) : 0.6;
              const x = M + i * (w + gap);
              fill(values[i] ? hex : '#d1d5db'); doc.roundedRect(x, y + H - 6 - h, w, h, 1, 1, 'F');
              color('#374151'); font(8, true); if (values[i]) doc.text(String(values[i]), x + w / 2, y + H - 8 - h, { align: 'center' });
              color('#9ca3af'); font(7, false); doc.text(txt(l), x + w / 2, y + H - 1, { align: 'center' });
            });
            y += H + 2;
          };
          const tiles = (items) => {
            ensure(24);
            const gap = 3, w = (CW - gap * (items.length - 1)) / items.length;
            items.forEach((it, i) => {
              const x = M + i * (w + gap);
              fill('#f3f4f6'); doc.roundedRect(x, y, w, 19, 3, 3, 'F');
              color(it[2]); font(15, true); doc.text(txt(String(it[0])), x + 4, y + 9);
              color('#6b7280'); font(7.5, false); doc.text(txt(it[1]), x + 4, y + 15);
            });
            y += 23;
          };

          color('#000000'); font(32, true, true); doc.text('COURSE ANALYTICS', PW / 2, 24, { align: 'center' });
          color('#000000'); font(11, false, true); doc.text(clip(c.title || 'Course', CW), PW / 2, 33, { align: 'center' });
          color('#6b7280'); font(9, false);
          doc.text('Generated ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), PW / 2, 40, { align: 'center' });
          const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
          const intro = `Course Analytics is a summary of how ${txt(c.title || 'this course')} is doing on Stitch: who has enrolled, how far learners have got, who has finished and who has left, and which parts people skip most. `
            + `${txt(c.title || 'This course')} has ${plural(A.users.length, 'learner')} enrolled and ${plural(A.completed.length, 'learner')} who have completed it`
            + (A.users.length ? `, with an average progress of ${A.avgProgress}%. ` : ', so the numbers will fill in as students enrol and work through the course. ')
            + 'This document is a snapshot saved on the date above, so every number reflects the course at that moment and will change as you keep teaching.';
          color('#4b5563'); font(9, false);
          const introLines = doc.splitTextToSize(txt(intro), CW);
          doc.text(introLines, M, 51, { lineHeightFactor: 1.5 });
          y = 51 + introLines.length * 5.2 + 5;

          tiles([[A.users.length, 'Enrolled', C.blue], [A.completed.length, 'Completed', C.green], [A.left.length, 'Left', C.red], [A.avgProgress + '%', 'Avg progress', C.purple]]);
          tiles([[A.completionRate + '%', 'Completion rate', C.green], [A.retention + '%', 'Retention', C.blue], [A.dropoutRate + '%', 'Drop-out rate', C.red], [A.avgDays === null ? '--' : A.avgDays + 'd', 'Avg days to finish', C.amber]]);
          tiles([[A.active7.length, 'Active this week', C.cyan], [A.stalled.length, 'Stalled 14d+', C.amber], [A.notStarted.length, 'Not started', C.gray], [A.avgQuiz === null ? '--' : A.avgQuiz + '%', 'Avg quiz score', C.purple]]);

          const total = Math.max(1, A.everEnrolled);
          section('Where learners are', A.everEnrolled + ' ever enrolled', 50);
          [['Completed', A.completed.length, C.green], ['In progress', A.inProgress.length, C.blue], ['Not started', A.notStarted.length, C.amber], ['Left the course', A.left.length, C.red]]
            .forEach(r => bar(r[0], Math.round(r[1] / total * 100), r[1] + ' - ' + Math.round(r[1] / total * 100) + '%', r[2]));

          section('Progress spread', 'How many learners sit at each progress level', 60);
          columns(A.buckets.map(b => b.label), A.buckets.map(b => b.n), C.blue);

          section('Enrolments', 'New learners, last 8 weeks', 60);
          columns(A.labels, A.enrolledW, C.blue);
          section('Completions', 'Learners who finished, last 8 weeks', 60);
          columns(A.labels, A.doneW, C.green);
          section('Learners who left', 'Last 8 weeks', 60);
          columns(A.labels, A.leftW, C.red);

          if (A.modules.length) {
            section('Module completion', 'Share of enrolled learners who finished every part', 30);
            A.modules.forEach(m => bar(m.title, m.pct, m.pct + '% - ' + m.finished, C.blue));
          }
          const hardest = A.itemRates.slice().sort((a, b) => a.pct - b.pct).slice(0, 8);
          if (hardest.length) {
            section('Parts people skip most', 'Lowest completion first', 30);
            hardest.forEach(h => bar(h.title, h.pct, h.pct + '%', h.pct >= 60 ? C.green : (h.pct >= 30 ? C.amber : C.red)));
          }
          const qz = A.quizzes.filter(q => q.avg !== null);
          if (qz.length) {
            section('Quiz performance', A.avgQuiz + '% average across quizzes', 30);
            qz.forEach(q => bar(q.title, q.avg, q.avg + '% - ' + q.takers + ' taken', C.purple));
          }
          const top = A.users.slice().sort((a, b) => (Number(b.progress) || 0) - (Number(a.progress) || 0)).filter(u => (Number(u.progress) || 0) > 0).slice(0, 10);
          if (top.length) {
            section('Top learners', 'Furthest through the course', 30);
            top.forEach(u => bar((u.name || 'Unnamed') + (u.username ? ' (@' + u.username + ')' : ''), Number(u.progress) || 0, (Number(u.progress) || 0) + '%', C.green));
          }

          const pages = doc.getNumberOfPages();
          for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            color('#9ca3af'); font(7.5, false);
            // Footer brand: the Stitch logo + wordmark in black (same size as the old text), then the
            // document name
            try {
              const LW = 12, LH = LW * 204 / 500;
              doc.addImage('data:image/png;base64,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', 'PNG', M, PH - 9 - 0.95 - LH * 0.52, LW, LH, 'stitch-logo', 'FAST');
              doc.text('-  Course Analytics', M + LW + 1.5, PH - 9);
            } catch (e) {
              doc.text('Stitch  -  Course Analytics', M, PH - 9);
            }
            doc.text('Page ' + i + ' of ' + pages, PW - M, PH - 9, { align: 'right' });
          }
          const slug = txt(c.title || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'course';
          doc.save('course-analytics-' + slug + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
        }

        async function postCourseInsertRemote(course){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data } = await sb.auth.getUser();
            const user = data && data.user;
            const { error } = await sb.from(COURSES_TABLE).upsert({
              id: course.id,
              data: Object.assign({}, course, { createdBy: undefined }),
              created_by: course.createdBy || (user ? user.id : null),
            }, { onConflict: 'id' });
            if (error) console.warn('Course did not sync to Supabase (see courses table SQL comment above):', error);
            return !error;
          } catch (e) { console.warn('Course sync threw an error:', e); return false; }
        }

        async function loadCoursesRemote(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data, error } = await sb.from(COURSES_TABLE).select('*');
            if (error) { console.warn('Loading courses from Supabase failed (see courses table SQL comment above):', error); return; }
            if (!data) return;
            allCourses = data
              .map(row => (row.data && typeof row.data === 'object') ? Object.assign({}, row.data, { id: row.id, createdBy: row.created_by || null }) : null)
              .filter(Boolean);
          } catch (e) { console.warn('Loading courses threw an error:', e); }
        }

        let coursesChannel = null;
        let coursesSubscribedForUserId = null;
        async function subscribeToCoursesRealtime(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (coursesChannel && coursesSubscribedForUserId === myId) return;
          if (coursesChannel) { try { sb.removeChannel(coursesChannel); } catch (e) {  } coursesChannel = null; }
          coursesSubscribedForUserId = myId;
          coursesChannel = sb.channel('courses-catalog')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: COURSES_TABLE }, (payload) => applyRemoteCourseChange(payload))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: COURSES_TABLE }, (payload) => applyRemoteCourseChange(payload))
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: COURSES_TABLE }, (payload) => applyRemoteCourseChange(payload))
            .subscribe();
        }

        let coursesPollInterval = null;
        // ---- Realtime course sync + course deletion ----
        function startCoursesPolling(){
          if (coursesPollInterval) return;
          coursesPollInterval = setInterval(async () => {
            if (document.hidden) return;
            const sb = getSupabaseClient();
            if (!sb) return;
            const before = JSON.stringify(allCourses.map(c => [c.id, (c.announcements || []).length, JSON.stringify(c.modules)]));
            await loadCoursesRemote();
            const after = JSON.stringify(allCourses.map(c => [c.id, (c.announcements || []).length, JSON.stringify(c.modules)]));
            if (before === after) return; 
            if (typeof currentTab !== 'undefined' && currentTab === 2 && typeof classroomAreaTab !== 'undefined' && classroomAreaTab === 'courses') {
              const studyContentEl = document.getElementById('study-content');
              if (studyContentEl) studyContentEl.innerHTML = studyContent();
              else if (typeof renderStudy === 'function') renderStudy();
            }
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'courseDetail' && currentCourseId) {
              const stillExists = allCourses.some(c => c.id === currentCourseId);
              const ov = document.getElementById('overlay');
              if (!stillExists) { if (typeof closeOverlay === 'function') closeOverlay(); }
              else if (ov) ov.innerHTML = courseDetailHTML();
            }
          }, 120000);
        }

        function applyRemoteCourseChange(payload){
          const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
          if (!row || !row.id) return;
          if (payload.eventType === 'DELETE') {
            allCourses = allCourses.filter(c => c.id !== row.id);
          } else {
            const incoming = (row.data && typeof row.data === 'object') ? Object.assign({}, row.data, { id: row.id, createdBy: row.created_by || null }) : null;
            if (!incoming) return;
            const idx = allCourses.findIndex(c => c.id === row.id);
            if (idx === -1) allCourses.unshift(incoming); else allCourses[idx] = incoming;
          }
          if (typeof currentTab !== 'undefined' && currentTab === 2 && typeof classroomAreaTab !== 'undefined' && classroomAreaTab === 'courses') {
            const studyContentEl = document.getElementById('study-content');
            if (studyContentEl) studyContentEl.innerHTML = studyContent();
            else if (typeof renderStudy === 'function') renderStudy();
          }
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'courseDetail' && currentCourseId === row.id) {
            if (payload.eventType === 'DELETE') {
              if (typeof closeOverlay === 'function') closeOverlay();
            } else {
              const ov = document.getElementById('overlay');
              if (ov) ov.innerHTML = courseDetailHTML();
            }
          }
        }

        async function deleteCourseRemote(id){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(COURSES_TABLE).delete().eq('id', id);
            return !error;
          } catch (e) { return false; }
        }

        // Soft-deletes a course: it disappears from the catalog for everyone who isn't enrolled,
        // but students who already enrolled keep full access to it in their courses
        function archiveCourse(courseId){
          const c = allCourses.find(x => x.id === courseId);
          if (!c) return;
          c.archived = true;
          postCourseInsertRemote(c);
        }

        function deleteCourse(courseId){
          if (!canManageCourse(courseId)) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c) return;
          const hasEnrollees = Object.keys(courseEnrollments || {}).some(id => id === courseId) || enrolledCourseIds.includes(courseId);
          openAppConfirmModal(
            `Delete "${c.title}"?`,
            hasEnrollees
              ? "This removes it from the catalog so no one new can find or enroll in it. Anyone already enrolled keeps their access and progress."
              : "This removes it for everyone and can't be undone.",
            'Delete',
            function(){
              archiveCourse(courseId);
              if (currentCourseId === courseId) closeOverlay();
              renderStudy();
              queueSaveUserState();
            }
          );
        }

        // ---- New course form markup ----
        function newCourseHTML(){
          const d = newCourseDraft;
          const isEditing = !!newCourseEditingId;
          return `
            <div class="flex-1 overflow-y-auto">
            ${overlayHeader(isEditing ? 'Edit Course' : 'Create a Course', '20px', 'overlayGoBack()', null, { right: true, pb: '20px' })}
            <div class="px-5 pb-8" style="padding-top:20px;">
              <div class="flex flex-col items-center mb-5">
                <button onclick="triggerCoursePhotoUpload()" class="relative w-24 h-24 rounded-3xl overflow-hidden mb-2" style="${d.photo ? `background-image:url('${d.photo}');background-size:cover;background-position:center;` : `background:linear-gradient(135deg,${blueCardPalette[0][0]},${blueCardPalette[0][1]});`}">
                  ${d.photo ? '' : `<div class="w-full h-full flex items-center justify-center text-white">${Icon('book','w-9 h-9')}</div>`}
                  <div class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-[${NAVY}]" style="margin:4px;">${Icon('camera','w-4 h-4')}</div>
                </button>
                <button onclick="triggerCoursePhotoUpload()" class="text-sm font-semibold" style="color:${NAVY};">${d.photo ? 'Change course photo' : 'Add a course photo'}</button>
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Course Title</label>
                <input type="text" value="${escapeHtml(d.title)}" oninput="updateNewCourseField('title', this.value)" placeholder="e.g. Data Analysis with R" class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Course Type</label>
                <div class="flex gap-2">
                  ${courseDeliveryTypes.map(t => `
                    <button onclick="setNewCourseDeliveryType('${t.key}')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${d.deliveryType===t.key ? 'is-selected' : ''}">${t.label}</button>
                  `).join('')}
                </div>
                <div class="text-xs text-gray-400" style="margin-top:3px;">${courseDeliveryTypes.find(t => t.key === d.deliveryType) ? courseDeliveryTypes.find(t => t.key === d.deliveryType).description : ''}</div>
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Price <span class="normal-case font-medium text-gray-400">(leave empty for free)</span></label>
                <div class="flex gap-2">
                  <input type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(d.price || '')}" oninput="updateNewCourseField('price', this.value)" placeholder="0" class="border border-gray-200 flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
                  <select onchange="updateNewCourseField('currency', this.value)" class="border border-gray-200 bg-gray-100 rounded-2xl px-3 py-3 text-sm">
                    ${['GHS','NGN','USD','ZAR','KES'].map(cu => `<option value="${cu}" ${(d.currency || 'GHS') === cu ? 'selected' : ''}>${cu}</option>`).join('')}
                  </select>
                </div>
                <div class="text-xs text-gray-400" style="margin-top:3px;">Stitch keeps ${PAID_SELLER_SHARE_PCT}% of each sale.</div>
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Teacher</label>
                <div class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-500">${TEAM_STITCH_TEACHER}${isEditing ? ' -- see who has enrolled from the course\'s People button' : ''}</div>
              </div>
              <div class="mb-5">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
                ${richTextToolbarHTML('formatNewCourseDesc')}
                <textarea id="new-course-desc" data-autogrow oninput="updateNewCourseField('description', this.value)" placeholder="What will students learn in this course?" rows="3" class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none" style="overflow:hidden;">${escapeHtml(d.description)}</textarea>
              </div>

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Modules <span class="normal-case font-medium text-gray-400">(add modules, parts, quizzes &amp; assignments)</span></div>
              <div class="grid grid-cols-2 gap-2 mb-4">
                <button onclick="openCourseAddModule('${DRAFT_COURSE_ID}')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Module</button>
                <button onclick="openCourseAddItemPage('${DRAFT_COURSE_ID}','video')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Part</button>
                <button onclick="openCourseAddItemPage('${DRAFT_COURSE_ID}','gradedQuiz')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Quiz</button>
                <button onclick="openCourseAddItemPage('${DRAFT_COURSE_ID}','assignment')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Assignment</button>
                <button onclick="openCourseAddItemPage('${DRAFT_COURSE_ID}','project')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500 col-span-2">${Icon('plus','w-3.5 h-3.5')} Add Project</button>
              </div>
              ${d.modules.length ? d.modules.map((m, mi) => courseDraftModuleHTML(m, mi)).join('') : `
                <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-5 text-center text-gray-500 text-sm mb-6">No modules yet -- tap Add Module or Add Part above.</div>`}

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Resources <span class="normal-case font-medium text-gray-400">(supplementary video &amp; audio)</span></div>
              ${(d.resources || []).map((r, ri) => courseDraftResourceHTML(r, ri)).join('')}
              <button onclick="openCourseAddResource('${DRAFT_COURSE_ID}')" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border border-dashed border-gray-300 text-gray-500 mb-6">
                ${Icon('plus','w-4 h-4')} Add Resource
              </button>

              <button onclick="publishNewCourse()" class="pill-cta w-full inline-flex items-center justify-center gap-2 text-white font-semibold text-center rounded-full text-sm" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.85rem 1.1rem;">
                ${isEditing ? 'Save Changes' : 'Publish Course'}
              </button>
              <div style="height:50px;"></div>
            </div>
            </div>`;
        }

        function courseDraftModuleHTML(m, mi){
          const count = (m.items || []).length;
          return `
            <div class="course-draft-module" style="padding-bottom:22px;margin-bottom:22px;border-bottom:1px solid rgba(107,114,128,0.18);">
              <div class="flex items-center gap-2 mb-3">
                <input type="text" value="${escapeHtml(m.title)}" oninput="updateCourseDraftModuleTitle(${mi}, this.value)" class="border border-gray-200 flex-1 min-w-0 bg-gray-100 rounded-xl px-3 py-2 text-sm font-semibold outline-none">
                <button onclick="removeCourseDraftModule(${mi})" class="text-red-500 flex-shrink-0">${Icon('close','w-4 h-4')}</button>
              </div>
              <textarea data-autogrow oninput="updateCourseDraftModuleDescription(${mi}, this.value)" placeholder="Module description (optional) -- what will students do in this module?" rows="2" class="border border-gray-200 w-full bg-gray-100 rounded-xl px-3 py-2 text-sm outline-none resize-none mb-2" style="overflow:hidden;">${escapeHtml(m.description || '')}</textarea>
              ${(m.items || []).map((it, ii) => `
                <div class="flex items-center justify-between gap-2 px-1 py-3 course-draft-part" style="border-top:1px solid rgba(107,114,128,0.18);">
                  <button onclick="openCourseEditItemPage('${DRAFT_COURSE_ID}', ${mi}, ${ii})" class="min-w-0 flex-1 text-left">
                    <div class="text-sm font-semibold text-gray-700 truncate">${escapeHtml(it.title || 'Untitled')}</div>
                    <div class="text-xs text-gray-400">${courseItemTypeLabel(it.type)}${it.duration ? ' · ' + escapeHtml(it.duration) : ''}</div>
                  </button>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="openCourseEditItemPage('${DRAFT_COURSE_ID}', ${mi}, ${ii})" class="text-gray-400" style="padding:2px;">${Icon('edit','w-4 h-4')}</button>
                    <button onclick="removeCourseDraftItem(${mi}, ${ii})" class="text-red-500" style="padding:2px;">${Icon('close','w-4 h-4')}</button>
                  </div>
                </div>`).join('')}
              <div class="text-xs text-gray-400 pt-3" style="border-top:1px solid rgba(107,114,128,0.18);">${count} part${count === 1 ? '' : 's'}</div>
            </div>`;
        }

        function courseDraftFinalItemsHTML(){
          const items = newCourseDraft.finalItems || [];
          return `
            <div class="bg-white rounded-3xl p-4 shadow-sm mb-3 border border-gray-100">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-50 flex-shrink-0 text-amber-600">Final Project</span>
                <div class="text-xs text-gray-400">Not part of any specific module</div>
              </div>
              ${items.map((it, ii) => `
                <div class="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-2" style="border:1px solid rgba(107,114,128,0.18);">
                  <div class="min-w-0 flex items-center gap-2">
                    ${(it.mediaType === 'image') ? `<img src="${it.mediaUrl}" class="w-8 h-8 rounded-lg object-cover flex-shrink-0">` : ''}
                    ${(it.mediaType === 'video') ? `<div class="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0 text-white">${Icon('video','w-3.5 h-3.5')}</div>` : ''}
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 flex-shrink-0">Item</span>
                        <div class="text-sm font-semibold text-gray-700 truncate">${escapeHtml(it.title)}</div>
                      </div>
                      <div class="text-xs text-gray-400">${courseItemTypeLabel(it.type)}${it.duration ? ' · ' + escapeHtml(it.duration) : ''}</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="openEditFinalItemForm(${ii})" class="text-gray-400" style="padding:2px;">${Icon('edit','w-4 h-4')}</button>
                    <button onclick="removeCourseDraftFinalItem(${ii})" class="text-red-500" style="padding:2px;">${Icon('close','w-4 h-4')}</button>
                  </div>
                </div>`).join('')}
              ${newCourseAddingItemModuleIndex === 'final' ? addCourseItemFormHTML() : `
                <button onclick="openAddFinalItemForm()" class="w-full flex items-center justify-center gap-2 rounded-xl py-2 font-semibold text-xs border border-dashed border-gray-300 text-gray-500">
                  ${Icon('plus','w-3.5 h-3.5')} Add Assignment, Project, or Quiz <span class="normal-case font-medium text-gray-400">(applies to the whole course)</span>
                </button>`}
            </div>`;
        }

        function addCourseItemFormHTML(){
          const d = newCourseAddingItemDraft;
          const isEditing = newCourseEditingItemIndex !== null;
          const isQuiz = courseItemIsQuiz(d.type);
          const isMedia = d.type === 'video' || d.type === 'image';
          const isPlaceable = d.type === 'assignment' || d.type === 'project' || isQuiz;
          const isFinal = newCourseAddingItemModuleIndex === 'final';
          const badgeText = isFinal
            ? (isEditing ? 'Editing this item, under Final Project' : 'This item will be placed under Final Project')
            : (isEditing ? 'Editing this Part, inside the Module above' : 'This is a Part, inside the Module above');
          return `
            <div class="bg-blue-50 rounded-2xl p-3 mb-2">
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white text-gray-500">${badgeText}</span>
              </div>
              <input type="text" value="${escapeHtml(d.title)}" oninput="updateAddingItemField('title', this.value)" placeholder="Part title" class="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none mb-2">
              <div class="flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
                ${courseItemTypes.map(t => `
                  <button onclick="setAddingItemType('${t.key}')" class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${d.type === t.key ? 'text-white' : 'bg-white text-gray-500'}" style="${d.type === t.key ? `background:${NAVY};` : ''}">${t.label}</button>`).join('')}
              </div>
              ${isPlaceable ? `
                <div class="mb-2">
                  <label class="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1 block">Where should this go?</label>
                  <select onchange="setAddingItemPlacement(this.value)" class="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none border border-gray-200">
                    ${newCourseDraft.modules.map((m, mi) => `<option value="${mi}" ${newCourseAddingItemModuleIndex === mi ? 'selected' : ''}>${escapeHtml(m.title || 'Module ' + (mi + 1))}</option>`).join('')}
                    <option value="final" ${isFinal ? 'selected' : ''}>Final Project (not part of a module)</option>
                  </select>
                </div>
              ` : ''}
              ${isMedia ? `
                <input type="file" id="adding-item-media-input" accept="${d.type === 'video' ? 'video/*' : 'image/*'}" class="hidden" onchange="handleAddingItemMediaSelected(event)">
                ${d.mediaUrl ? `
                  <div class="relative rounded-xl overflow-hidden mb-2 bg-black" style="aspect-ratio:16/9;">
                    ${d.mediaType === 'image'
                      ? `<img src="${d.mediaUrl}" class="w-full h-full object-cover">`
                      : `<video src="${d.mediaUrl}" class="w-full h-full object-cover" controls controlsList="nodownload noplaybackrate" playsinline></video>`}
                    ${d.mediaUploading ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">Uploading...</div>` : ''}
                    <button onclick="removeAddingItemMedia()" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">${IconBold('close','w-4 h-4')}</button>
                  </div>` : `
                  <button onclick="document.getElementById('adding-item-media-input').click()" class="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-xs border border-dashed border-gray-300 text-gray-500 bg-white mb-2">
                    ${Icon('camera','w-4 h-4')} Upload ${d.type === 'video' ? 'a video' : 'a picture'}
                  </button>`}
              ` : ''}
              <input type="text" value="${escapeHtml(d.duration)}" oninput="updateAddingItemField('duration', this.value)" placeholder="Duration, e.g. 5 min" class="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none mb-2">
              ${!isQuiz ? `
                <textarea oninput="updateAddingItemField('description', this.value)" placeholder="${isMedia ? 'Describe this ' + (d.type === 'video' ? 'video' : 'picture') + ' (optional)' : 'Content / instructions'}" rows="2" class="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none resize-none mb-2">${escapeHtml(d.description)}</textarea>` : `
                <div class="mb-2">
                  ${d.questions.map((q, qi) => addCourseItemQuestionHTML(q, qi)).join('')}
                  <button onclick="addAddingItemQuestion()" class="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 font-semibold text-xs border border-dashed border-gray-300 text-gray-500 bg-white">
                    ${Icon('plus','w-3.5 h-3.5')} Add Question
                  </button>
                </div>`}
              <div class="flex gap-2">
                <button onclick="cancelAddCourseItem()" class="flex-1 rounded-xl py-2 font-semibold text-xs text-gray-500 bg-white">Cancel</button>
                <button onclick="confirmAddCourseItem()" class="flex-1 rounded-full py-2 font-semibold text-xs text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${d.mediaUploading ? 'Uploading...' : (isEditing ? 'Save Changes' : 'Add')}</button>
              </div>
            </div>`;
        }

        function addCourseItemQuestionHTML(q, qi){
          return `
            <div class="bg-white rounded-xl p-2.5 mb-2">
              <div class="flex items-center gap-2 mb-3">
                <input type="text" value="${escapeHtml(q.text)}" oninput="updateAddingItemQuestionText(${qi}, this.value)" placeholder="Question ${qi + 1}" class="flex-1 min-w-0 bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs outline-none">
                <button onclick="removeAddingItemQuestion(${qi})" class="text-red-500 flex-shrink-0">${Icon('close','w-3.5 h-3.5')}</button>
              </div>
              ${q.options.map((opt, oi) => `
                <div class="flex items-center gap-2 mb-2">
                  <button onclick="setAddingItemCorrect(${qi},${oi})" class="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${q.correct === oi ? 'border-emerald-600' : 'border-gray-300'}">
                    ${q.correct === oi ? '<span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>' : ''}
                  </button>
                  <input type="text" value="${escapeHtml(opt)}" oninput="updateAddingItemOption(${qi},${oi}, this.value)" placeholder="Option ${oi + 1}" class="flex-1 min-w-0 bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs outline-none">
                </div>`).join('')}
            </div>`;
        }

        let classesChannel = null;
        let classesSubscribedForUserId = null;
        async function subscribeToClassesRealtime(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (classesChannel && classesSubscribedForUserId === myId) return;
          if (classesChannel) { try { sb.removeChannel(classesChannel); } catch (e) {  } classesChannel = null; }
          classesSubscribedForUserId = myId;
          classesChannel = sb.channel('classes-catalog:' + myId)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: CLASSES_TABLE }, (payload) => applyRemoteClassDelete(payload))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: CLASSES_TABLE }, (payload) => applyRemoteClassUpdate(payload))
            .subscribe();
        }

        // ---- Realtime class sync (join/update/delete) ----
        function applyRemoteClassUpdate(payload){
          const row = payload && payload.new;
          if (!row || !row.id) return;
          const idx = myClasses.findIndex(c => c.id === row.id);
          if (idx === -1) return;
          const prev = myClasses[idx];
          const notifyMe = prev.role !== 'teacher';
          const isTeacherHere = prev.role === 'teacher';
          const prevAnnouncementIds = notifyMe ? new Set((prev.announcements || []).map(a => a.id)) : null;
          const prevClassworkIds = notifyMe ? new Set((prev.classwork || []).map(w => w.id)) : null;
          // A teacher never gets pinged for their own announcements/classwork above, but they do
          // need to know the moment someone is waiting on them
          const prevPendingIds = isTeacherHere ? new Set((prev.pendingRequests || []).map(r => r.userId)) : null;
          const prevMemberIds = isTeacherHere ? new Set(prev.members || []) : null;
          myClasses[idx] = Object.assign({}, prev, row.data || {}, {
            id: prev.id, code: prev.code, teacherId: prev.teacherId, role: prev.role,
            members: Array.isArray(row.members) ? row.members : (prev.members || []),
          });
          const updated = myClasses[idx];
          if (notifyMe && typeof addNotif === 'function') {
            (updated.announcements || []).forEach(a => {
              if (prevAnnouncementIds.has(a.id)) return;
              addNotif({
                id: 'announcement-' + a.id,
                type: 'classroom',
                source: 'classroom',
                icon: 'flag',
                iconBg: 'bg-blue-50',
                iconClass: 'text-blue-600',
                name: updated.name || 'Your class',
                message: a.text ? `New announcement in ${updated.name}: "${a.text.slice(0, 80)}"` : `New announcement in ${updated.name}`,
                classId: updated.id,
              });
            });
            (updated.classwork || []).forEach(w => {
              if (prevClassworkIds.has(w.id)) return;
              addNotif({
                id: 'classwork-' + w.id,
                type: 'classroom',
                source: 'classroom',
                icon: classworkTypeIcon(w.type),
                iconBg: 'bg-blue-50',
                iconClass: 'text-blue-600',
                name: updated.name || 'Your class',
                message: `New ${classworkTypeLabel(w.type).toLowerCase()} in ${updated.name}: "${w.title}"`,
                classId: updated.id,
                workId: w.id,
              });
            });
          }
          if (isTeacherHere && typeof addNotif === 'function') {
            // Surface it on the notice board (the Notifications bell) right at the top, live, the
            // instant the request lands
            (updated.pendingRequests || []).forEach(r => {
              if (prevPendingIds.has(r.userId)) return;
              addNotif({
                id: 'joinrequest-' + updated.id + '-' + r.userId,
                type: 'classroom',
                source: 'classroom',
                icon: 'personPlus',
                iconBg: 'bg-blue-50',
                iconClass: 'text-blue-600',
                name: updated.name || 'Your class',
                message: `${r.name || 'Someone'} wants to join ${updated.name} -- tap to approve`,
                classId: updated.id,
                tab: 'people',
              });
            });
            // A class with an entrance fee (or an open join policy) lets someone in the moment they
            // pay/join, with no approval step
            (updated.members || []).forEach(uid => {
              if (!uid || uid === updated.teacherId || prevMemberIds.has(uid)) return;
              const profile = classStudentProfiles[uid];
              addNotif({
                id: 'enrolled-' + updated.id + '-' + uid,
                type: 'classroom',
                source: 'classroom',
                icon: 'users',
                iconBg: 'bg-emerald-50',
                iconClass: 'text-emerald-600',
                name: updated.name || 'Your class',
                message: `${(profile && profile.name) || 'A new student'} just ${updated.paymentEnabled ? 'paid the entrance fee and enrolled in' : 'enrolled in'} ${updated.name}`,
                classId: updated.id,
                tab: 'people',
              });
            });
          }
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classDetail' && currentClassId === row.id) {
            const ov = document.getElementById('overlay');
            const sc = ov && ov.querySelector('.overflow-y-auto');
            const keepTop = sc ? sc.scrollTop : 0;
            if (ov) ov.innerHTML = classDetailHTML();
            const sc2 = ov && ov.querySelector('.overflow-y-auto');
            if (sc2) sc2.scrollTop = keepTop;
          }
          if (typeof currentOverlayKind !== 'undefined' && !currentOverlayKind && typeof currentTab !== 'undefined' && currentTab === 2 && typeof classroomAreaTab !== 'undefined' && classroomAreaTab === 'classes') {
            const studyContentEl = document.getElementById('study-content');
            if (studyContentEl && typeof studyContent === 'function') studyContentEl.innerHTML = studyContent();
          }
        }

        function applyRemoteClassDelete(payload){
          const deletedId = payload && payload.old && payload.old.id;
          if (!deletedId) return;
          const hadIt = myClasses.some(c => c.id === deletedId);
          if (!hadIt) return;
          myClasses = myClasses.filter(c => c.id !== deletedId);
          queueSaveUserState();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classDetail' && currentClassId === deletedId) {
            currentClassId = null;
            closeOverlay();
            openAppAlertModal('This class was deleted by its teacher.');
          } else if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classSettings' && currentClassId === deletedId) {
            currentClassId = null;
            closeOverlay();
            openAppAlertModal('This class was deleted by its teacher.');
          }
          if (typeof currentTab !== 'undefined' && currentTab === 2 && typeof classroomAreaTab !== 'undefined' && classroomAreaTab === 'classes') {
            const studyContentEl = document.getElementById('study-content');
            if (studyContentEl) studyContentEl.innerHTML = studyContent();
            else if (typeof renderStudy === 'function') renderStudy();
          }
        }

        const CLASSES_TABLE = 'classes';

        const CLASS_FEE_CURRENCY_SYMBOLS = { GHS: 'GH₵', NGN: '₦', USD: '$', ZAR: 'R', KES: 'KSh' };
        function classFeeLabel(cls){
          if (!cls || !cls.paymentEnabled || !(cls.paymentAmount > 0)) return '';
          const currency = cls.paymentCurrency || 'GHS';
          const symbol = CLASS_FEE_CURRENCY_SYMBOLS[currency] || (currency + ' ');
          return `${symbol}${cls.paymentAmount}`;
        }

        function classRowToLocal(row, myUserId){
          const data = row.data || {};
          return Object.assign({
            announcements: [],
            classwork: [],
            lectures: [],
            students: [],
            coTeachers: [],
            notificationsEnabled: true,
            photo: null,
            joinPolicy: 'open',
            paymentEnabled: false,
            paymentAmount: 0,
            paymentCurrency: 'GHS',
            pendingRequests: [],
          }, data, {
            id: row.id,
            code: row.code,
            teacherId: row.teacher_id,
            role: row.teacher_id === myUserId ? 'teacher' : 'student',
            members: Array.isArray(row.members) ? row.members : [],
            announcements: Array.isArray(data.announcements) ? data.announcements : [],
            classwork: Array.isArray(data.classwork) ? data.classwork : [],
            lectures: Array.isArray(data.lectures) ? data.lectures : [],
            students: Array.isArray(data.students) ? data.students : [],
            coTeachers: Array.isArray(data.coTeachers) ? data.coTeachers : [],
            pendingRequests: Array.isArray(data.pendingRequests) ? data.pendingRequests : [],
          });
        }

        async function claimPendingClassInvites(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { error } = await sb.rpc('claim_class_invites');
            if (error) {
              // A 404/"function not found" here means the claim_class_invites() RPC hasn't been created
              // in Supabase yet
              console.warn('claim_class_invites RPC failed (see supabase-fixes.sql):', error);
            }
          } catch (e) { console.warn('claim_class_invites RPC threw an error:', e); }
        }

        async function loadMyClasses(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            await claimPendingClassInvites();
            const { data, error } = await sb.from(CLASSES_TABLE).select('*');
            if (error || !data) return;
            myClasses = data.map(row => classRowToLocal(row, me.id));
            await hydrateClassSubmissions();
          } catch (e) {  }
        }

        // Submissions and grades live in the class_submissions table (row-level security: a
        // student only receives their own rows, the teacher receives the whole class)
        async function hydrateClassSubmissions(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data, error } = await sb.from('class_submissions').select('*');
            if (error || !data) return;
            myClasses.forEach(cls => (cls.classwork || []).forEach(w => { w.submissions = {}; w.quizSubmissions = {}; }));
            data.forEach(r => {
              const cls = myClasses.find(c => c.id === r.class_id);
              const w = cls && (cls.classwork || []).find(x => x.id === r.work_id);
              if (!w) return;
              if (r.kind === 'quiz') {
                w.quizSubmissions[r.student_id] = { answers: r.answers || [], total: r.total, autoScore: r.auto_score, submittedAt: r.submitted_at, remark: r.remark || '' };
              } else {
                w.submissions[r.student_id] = { text: r.text_answer || '', submittedAt: r.submitted_at, score: r.score, remark: r.remark || '', graded: !!r.graded };
              }
            });
          } catch (e) {  }
        }
        // Small helper: call a submission RPC
        async function classSubmissionRpc(fn, args){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.rpc(fn, args);
            if (error) throw error;
            return true;
          } catch (e) {
            console.warn(fn + ' failed:', e);
            if (typeof openAppAlertModal === 'function') openAppAlertModal('That could not be saved. Please try again.');
            await hydrateClassSubmissions();
            const ov = document.getElementById('overlay');
            if (ov && typeof classworkDetailHTML === 'function') ov.innerHTML = classworkDetailHTML();
            return false;
          }
        }

        const classSaveTimers = {};
        function queueSaveClassRemote(cls){
          if (!cls || !cls.id) return;
          if (classSaveTimers[cls.id]) clearTimeout(classSaveTimers[cls.id]);
          classSaveTimers[cls.id] = setTimeout(() => saveClassRemoteNow(cls), 800);
        }
        async function saveClassRemoteNow(cls){
          const sb = getSupabaseClient();
          if (!sb) return;
          const { id, code, teacherId, role, ...data } = cls;
          // Submissions/grades are stored separately (class_submissions)
          if (Array.isArray(data.classwork)) data.classwork = data.classwork.map(w => { const { submissions, quizSubmissions, ...rest } = w; return rest; });
          try {
            await sb.from(CLASSES_TABLE).update({ data, updated_at: new Date().toISOString() }).eq('id', cls.id);
          } catch (e) { console.warn('Saving class failed (will retry on next change):', e); }
        }
        let myClasses = []; 
        let currentClassId = null;
        let classDetailTab = 'stream'; 
        let classDetailMenuOpen = false;
        let inviteEmailsDraft = '';
        let joinClassBtnBusy = false;
        function setJoinClassBtnBusy(busy){
          joinClassBtnBusy = busy;
          const btn = document.getElementById('join-class-btn');
          if (!btn) return;
          btn.disabled = busy;
          btn.style.opacity = busy ? '0.7' : '';
          btn.innerHTML = busy ? classActionBtnSpinnerHTML(NAVY, 'Joining...') : 'Join Class';
        }

        // ---- Join/Create classroom flow ----
        function openJoinClassroom(){
          openOverlay('joinClassroom');
        }

        // Draft for the two class-creation options below: who can join (everyone vs. teacher-
        // approved), and
        let newClassDraft = { joinPolicy: 'open', paymentEnabled: false, paymentAmount: '', paymentCurrency: 'GHS' };
        function resetNewClassDraft(){
          newClassDraft = { joinPolicy: 'open', paymentEnabled: false, paymentAmount: '', paymentCurrency: 'GHS' };
        }
        // One "Entrance" choice instead of two separate sections
        function newClassEntranceMode(){
          const d = newClassDraft;
          if (d.paymentEnabled) return 'paid';
          return d.joinPolicy === 'approved' ? 'approved' : 'free';
        }
        function setNewClassEntrance(mode){
          if (mode === 'paid' && !canCurrentUserSellPaid()) return;
          newClassDraft.paymentEnabled = (mode === 'paid');
          newClassDraft.joinPolicy = (mode === 'approved') ? 'approved' : 'open';
          const el = document.getElementById('create-class-entrance');
          const strip = el && el.querySelector('.entrance-swipe');
          const keep = strip ? strip.scrollLeft : 0;
          if (el) el.outerHTML = newClassEntranceHTML();
          const strip2 = document.querySelector('#create-class-entrance .entrance-swipe');
          if (strip2) strip2.scrollLeft = keep;
        }
        function updateNewClassPaymentField(field, value){
          newClassDraft[field] = value;
        }

        function newClassEntranceHTML(){
          const d = newClassDraft;
          const mode = newClassEntranceMode();
          const options = [
            { key:'free', label:'Free for everyone' },
            { key:'approved', label:'Approve each student' },
          ];
          if (canCurrentUserSellPaid()) options.push({ key:'paid', label:'Paid entrance' });
          return `
            <div id="create-class-entrance" class="mb-5">
              <label class="text-xs font-semibold text-gray-500 mb-2 block text-center">Entrance</label>
              <div class="entrance-swipe no-scrollbar" style="display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;margin:0 -16px;padding:2px 16px;scroll-padding:0 16px;">
                ${options.map(o => `<button onclick="setNewClassEntrance('${o.key}')" class="px-3 py-3 rounded-2xl text-xs font-semibold text-center class-choice-pill ${mode===o.key ? 'is-selected' : ''}" style="flex:0 0 72%;scroll-snap-align:center;">${o.label}</button>`).join('')}
              </div>
              ${options.length > 1 ? `<div class="text-center text-[11px] text-gray-400 mt-2">Swipe to see more options</div>` : ''}
              ${mode === 'paid' ? `
                <div class="flex gap-2 mt-3">
                  <input type="number" min="1" step="1" oninput="updateNewClassPaymentField('paymentAmount', this.value)" value="${escapeHtml(d.paymentAmount)}" placeholder="Amount" class="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  <select onchange="updateNewClassPaymentField('paymentCurrency', this.value)" class="bg-gray-100 rounded-2xl px-3 py-3 text-sm">
                    ${['GHS','NGN','USD','ZAR','KES'].map(c => `<option value="${c}" ${d.paymentCurrency===c ? 'selected' : ''}>${c}</option>`).join('')}
                  </select>
                </div>
                <div class="text-xs text-gray-400 mt-2">Students pay this online before they get access.</div>
              ` : ''}
            </div>`;
        }

        function openCreateClassroom(){
          resetNewClassDraft();
          openOverlay('createClassroom');
        }

        function generateClassCode(){
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let i = 0; i < 7; i++) code += chars[Math.floor(Math.random() * chars.length)];
          return code;
        }

        function copyClassCode(code){
          const legacyCopy = () => {
            try {
              const textarea = document.createElement('textarea');
              textarea.value = code;
              textarea.style.position = 'fixed';
              textarea.style.opacity = '0';
              document.body.appendChild(textarea);
              textarea.focus();
              textarea.select();
              document.execCommand('copy');
              document.body.removeChild(textarea);
              openAppAlertModal('Class code copied: ' + code);
            } catch (err) {
              openAppAlertModal('Class code: ' + code);
            }
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => openAppAlertModal('Class code copied: ' + code)).catch(legacyCopy);
          } else {
            legacyCopy();
          }
        }

        function joinClassroomHTML(){
          return `
            <div class="p-4 flex-1 overflow-y-auto">
<div style="margin:-1rem -1rem 0;">
            <div class="w-full px-5 pb-3 relative" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" style="color:${NAVY};">${IconBold('back','w-5 h-5')}</button>
                <h1 class="text-base font-bold text-[${NAVY}] font-display truncate" style="margin-left:auto;margin-right:auto;text-align:center;max-width:60%;">Join a Class</h1>
                <button onclick="toggleJoinClassMenu()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" style="color:${NAVY};">${Icon('dashesShortRight','w-6 h-6')}</button>
              </div>
              ${joinClassMenuOpen ? joinClassDropdownMenu() : ''}
            </div>
</div>
              <div style="height:20px;"></div>
              <div class="text-sm font-semibold text-gray-700 mb-3">You're currently signed in as</div>
              <div class="flex items-center gap-3 mb-6">
                <span class="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 overflow-hidden">${avatarMediaHTML(profileData.photo, 'user', 'w-6 h-6')}</span>
                <div class="min-w-0">
                  <div class="font-semibold text-sm text-[${NAVY}] truncate">${escapeHtml(profileData.name || 'You')}</div>
                  <div class="text-xs text-gray-500 truncate">${escapeHtml((typeof currentUserEmail !== 'undefined' && currentUserEmail) || '')}</div>
                </div>
              </div>
              <div class="text-sm text-gray-500 mb-5">Ask your teacher or classmate for the class code, then enter it here.</div>
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Class Code</label>
              <input type="text" id="join-code-input" placeholder="e.g. ECN4821" class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-2 tracking-widest uppercase">
              <div class="text-xs text-gray-400 mb-5 leading-relaxed">Use a class code with 6-8 letters or numbers, and no spaces or symbols.</div>
              <button id="join-class-btn" onclick="submitJoinClassroom()" ${joinClassBtnBusy ? 'disabled' : ''} class="w-full font-semibold py-3 rounded-2xl border flex items-center justify-center" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;${joinClassBtnBusy ? 'opacity:0.7;' : ''}">${joinClassBtnBusy ? classActionBtnSpinnerHTML(NAVY, 'Joining...') : 'Join Class'}</button>
            </div>`;
        }

        function createClassroomHTML(){
          return `
           <div class="flex-1 overflow-y-auto">
            <div class="w-full px-5 pb-3 relative" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" style="color:${NAVY};">${IconBold('back','w-5 h-5')}</button>
                <h1 class="text-base font-bold text-[${NAVY}] font-display truncate" style="margin-left:auto;margin-right:auto;text-align:center;max-width:60%;">Create a Class</h1>
                <button onclick="toggleCreateClassMenu()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" style="color:${NAVY};">${Icon('dashesShortRight','w-6 h-6')}</button>
              </div>
              ${createClassMenuOpen ? createClassDropdownMenu() : ''}
            </div>
            <div class="p-4" style="padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 64px);">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Class Name (required)</label>
              <input type="text" id="create-name-input" placeholder="e.g. Macro I - Section B" class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Section</label>
              <input type="text" id="create-section-input" placeholder="e.g. Section B" class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Subject</label>
              <input type="text" id="create-subject-input" placeholder="e.g. Biology" class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Description (optional)</label>
              <textarea id="create-description-input" rows="3" placeholder="What's this class about?" class="border border-gray-200 w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-5 resize-none"></textarea>
              ${newClassEntranceHTML()}
              <button onclick="submitCreateClassroom()" class="w-full font-semibold py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">Create Class</button>
            </div>
           </div>`;
        }

        let classActionLoadToken = 0;

        // ---- Class action loading/result animation ----
        function classActionBtnSpinnerHTML(color, label){
          const track = color === '#ffffff' ? 'rgba(255,255,255,0.35)' : 'rgba(10,37,64,0.22)';
          const spinner = `<span style="display:inline-block;width:18px;height:18px;border-radius:9999px;border:2.5px solid ${track};border-top-color:${color};animation:classroom-spin .7s linear infinite;"></span>`;
          return `<span style="display:inline-flex;align-items:center;gap:8px;">${spinner}${label ? `<span>${escapeHtml(label)}</span>` : ''}</span>`;
        }

        function classActionLoadingMarkup(text, iconName){
          return `
            <div id="class-action-loading-overlay" class="classroom-slide-cover flex flex-col items-center justify-center">
              <div style="position:relative;width:84px;height:84px;">
                <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(10,37,64,0.12) 45%, rgba(10,37,64,0.12) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));animation:classroom-spin 0.9s linear infinite;"></div>
                <div style="position:absolute;inset:10px;background:#ffffff;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(10,37,64,0.18);">
                  ${gradIcon(Icon(iconName || 'users','w-8 h-8'))}
                </div>
              </div>
              <div class="mt-4 text-sm font-semibold text-gray-500 font-display" id="class-action-loading-text">${text}</div>
            </div>`;
        }

        function runClassActionLoading(text, iconName, onDone){
          const myToken = ++classActionLoadToken;
          const ov = document.getElementById('overlay');
          if (!ov) { onDone(); return; }
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = classActionLoadingMarkup(text, iconName);

          let dots = 0;
          const dotTimer = setInterval(() => {
            const el = document.getElementById('class-action-loading-text');
            if (!el || myToken !== classActionLoadToken) { clearInterval(dotTimer); return; }
            dots = (dots + 1) % 4;
            el.textContent = text + '.'.repeat(dots);
          }, 350);

          const CLASS_ACTION_LOAD_MS = 1600;
          setTimeout(async () => {
            clearInterval(dotTimer);
            if (myToken !== classActionLoadToken) return;
            try {
              await onDone();
            } catch (err) {
              window.reportError && window.reportError(err, { call: 'runClassActionLoading:onDone' });
              if (myToken !== classActionLoadToken) return;
              closeOverlay();
              openAppAlertModal((err && err.message) || "Something went wrong loading that class. Please try again.");
              return;
            }
            if (myToken !== classActionLoadToken) return;
            revealClassActionResult(myToken, text, iconName);
          }, CLASS_ACTION_LOAD_MS);
        }

        function revealClassActionResult(token, text, iconName){
          if (token !== classActionLoadToken) return;
          const ov = document.getElementById('overlay');
          if (!ov) return;
          ov.insertAdjacentHTML('afterbegin', classActionLoadingMarkup(text, iconName));
          const overlay = document.getElementById('class-action-loading-overlay');
          if (!overlay) return;

          void overlay.offsetWidth;
          requestAnimationFrame(() => {
            overlay.classList.add('slide-out');
          });

          const finishReveal = () => overlay.remove();
          overlay.addEventListener('transitionend', finishReveal, { once: true });
          setTimeout(finishReveal, 700);
        }

        async function submitJoinClassroom(){
          if (joinClassBtnBusy) return;
          const code = document.getElementById('join-code-input').value.trim().toUpperCase();
          if (!code) { openAppAlertModal('Enter a class code to join'); return; }
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal('Sign-in backend is not configured yet -- classes can\'t be joined.'); return; }
          setJoinClassBtnBusy(true);
          let userRes, me;
          try {
            ({ data: userRes } = await sb.auth.getUser());
            me = userRes && userRes.user;
          } catch (e) { me = null; }
          if (!me) { setJoinClassBtnBusy(false); openAppAlertModal('Please sign in again to join a class.'); return; }
          let result, error;
          try {
            ({ data: result, error } = await sb.rpc('join_class_by_code', {
              p_code: code,
              p_name: profileData.name || '',
              p_username: profileData.username || '',
              p_photo: profileData.photo || null,
            }));
          } catch (e) { error = e; }
          if (Array.isArray(result)) result = result[0];
          if (error || !result) { setJoinClassBtnBusy(false); openAppAlertModal("We couldn't find that class. Check the code and try again."); return; }

          if (result.status === 'not_found') { setJoinClassBtnBusy(false); openAppAlertModal("We couldn't find that class. Check the code and try again."); return; }
          if (result.status === 'pending') { setJoinClassBtnBusy(false); openAppAlertModal("Request sent -- the teacher needs to approve you before you can enter this class."); return; }
          if (result.status === 'payment_required') {
            setJoinClassBtnBusy(false);
            pendingClassPaymentCode = code;
            openClassPaymentConfirm(result);
            return;
          }
          if (result.status === 'joined' || result.status === 'already_member') {
            setJoinClassBtnBusy(false);
            const found = classRowToLocal(result.class, me.id);
            const existingIdx = myClasses.findIndex(c => c.id === found.id);
            if (existingIdx !== -1) myClasses[existingIdx] = found; else myClasses.push(found);
            runClassActionLoading('Adding you to class', 'users', async () => {
              // The RPC's own returned row is enough to open the class right away (above), but it can be
              // a beat ahead of the row Postgres will actually let us SELECT as a newly-added member
              // (RLS only starts allowing full reads once the membership insert has truly
              try {
                const sbRefetch = getSupabaseClient();
                if (sbRefetch) {
                  const { data: freshRow, error: refetchError } = await sbRefetch.from(CLASSES_TABLE).select('*').eq('id', found.id).single();
                  if (!refetchError && freshRow) {
                    const fresh = classRowToLocal(freshRow, me.id);
                    const idx = myClasses.findIndex(c => c.id === fresh.id);
                    if (idx !== -1) myClasses[idx] = fresh; else myClasses.push(fresh);
                  }
                }
              } catch (e) { console.warn('Refetching newly-joined class failed (falling back to RPC snapshot):', e); }
              // This already played the class's one-time "getting it ready" animation, so opening it
              // again later this session shouldn't repeat it
              if (typeof preparedClassIds !== 'undefined') preparedClassIds.add(found.id);
              openClassDetail(found.id);
            });
            return;
          }
          setJoinClassBtnBusy(false);
          openAppAlertModal("Something went wrong joining that class. Please try again.");
        }

        // ---- Paid class entrance (Paystack) ----
        let classPaymentBusy = false;
        const CLASS_PAYMENT_PENDING_KEY = 'stitchPendingClassPayment';
        const CLASS_PAYMENT_QUICK_ATTEMPTS = 6;
        const CLASS_PAYMENT_SLOW_CYCLES = 8;
        const CLASS_PAYMENT_SLOW_DELAY_MS = 20000;
        const CLASS_PAYMENT_PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000;

        function persistPendingClassPayment(reference, classId, className){
          try {
            localStorage.setItem(CLASS_PAYMENT_PENDING_KEY, JSON.stringify({ reference, classId, className, savedAt: Date.now() }));
          } catch (e) { /* best-effort -- worst case we just lose background-resume on reload */ }
        }
        function clearPendingClassPayment(reference){
          try {
            const raw = localStorage.getItem(CLASS_PAYMENT_PENDING_KEY);
            if (!raw) return;
            const pending = JSON.parse(raw);
            if (!reference || pending.reference === reference) localStorage.removeItem(CLASS_PAYMENT_PENDING_KEY);
          } catch (e) { try { localStorage.removeItem(CLASS_PAYMENT_PENDING_KEY); } catch (e2) {} }
        }
        // Resumes a payment that never got confirmed before the tab closed/reloaded
        function resumePendingClassPaymentIfAny(){
          let pending;
          try { pending = JSON.parse(localStorage.getItem(CLASS_PAYMENT_PENDING_KEY) || 'null'); } catch (e) { pending = null; }
          if (!pending || !pending.reference || !pending.classId) return;
          if (Date.now() - (pending.savedAt || 0) > CLASS_PAYMENT_PENDING_MAX_AGE_MS) { clearPendingClassPayment(pending.reference); return; }
          // Give auth/session restore a moment before the first attempt.
          setTimeout(() => verifyClassPayment(pending.reference, pending.classId, 1, { silent: true, className: pending.className }), 3000);
        }

        // ---- Paid-class entrance confirmation (shown before Paystack ever opens) ----
        let pendingClassPayment = null;
        let pendingClassPaymentCode = '';
        function openClassPaymentConfirm(result){
          const cls = result.class || {};
          // The join_class_by_code RPC's payment_required payload only carries what it needs to show
          // a fee (name/amount/photo)
          const cached = myClasses.find(c => c.id === result.classId) || {};
          pendingClassPayment = {
            code: pendingClassPaymentCode,
            classId: result.classId,
            className: cached.name || result.className || cls.name || 'This class',
            amount: result.amount,
            currency: result.currency || cached.paymentCurrency || cls.paymentCurrency || 'GHS',
            section: cached.section || cls.section || result.section || '',
            subject: cached.subject || cls.subject || result.subject || '',
            photo: cached.photo || cls.photo || result.photo || null,
            description: cached.description || cls.description || result.description || '',
            colorIndex: (typeof cached.colorIndex === 'number') ? cached.colorIndex : ((typeof cls.colorIndex === 'number') ? cls.colorIndex : ((typeof result.colorIndex === 'number') ? result.colorIndex : 0)),
            motifIndex: (typeof cached.motifIndex === 'number') ? cached.motifIndex : ((typeof cls.motifIndex === 'number') ? cls.motifIndex : ((typeof result.motifIndex === 'number') ? result.motifIndex : 0)),
          };
          openOverlayFrom('joinClassroom', 'classPaymentConfirm');
        }
        function classPaymentFeeLabel(p){
          const symbol = CLASS_FEE_CURRENCY_SYMBOLS[p.currency] || (p.currency + ' ');
          return `${symbol}${p.amount}`;
        }
        function classPaymentConfirmHTML(){
          const p = pendingClassPayment;
          if (!p) { setTimeout(overlayGoBack, 0); return '<div class="flex-1"></div>'; }
          const bg = '';
          return `
            ${bg}
            <div class="p-4 flex-1 overflow-y-auto flex flex-col">
<div style="margin:-1rem -1rem 0;">
            <div class="w-full px-5 pb-3 relative flex-shrink-0" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between">
                <button onclick="cancelClassPaymentConfirm()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" style="color:${NAVY};">${IconBold('back','w-5 h-5')}</button>
                <h1 class="text-base font-bold text-[${NAVY}] font-display truncate" style="margin-left:auto;margin-right:12px;text-align:right;max-width:60%;">Entrance Fee</h1>
              </div>
            </div>
</div>
              <div class="class-color-card rounded-3xl p-5 text-white relative overflow-hidden mb-5" style="${p.photo ? `background-image:linear-gradient(rgba(10,37,64,0.45),rgba(10,37,64,0.45)),url('${p.photo}');background-size:cover;background-position:center;` : classCardBackgroundStyle(p)}min-height:104px;">
                ${p.photo ? '' : `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${classCardMotifs[(p.motifIndex || 0) % classCardMotifs.length]}</svg>`}
                <div class="text-xl font-bold font-display mb-1 truncate pr-4 relative">${escapeHtml(p.className)}</div>
                <div class="flex items-center justify-between gap-3 relative">
                  <div class="text-sm text-white/85 truncate">${(p.section || p.subject) ? escapeHtml(p.section || p.subject) : ''}</div>
                  <div class="text-sm font-bold text-white/95 flex-shrink-0">${classPaymentFeeLabel(p)}</div>
                </div>
              </div>
              ${p.description ? `<div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6"><div class="text-sm text-gray-600 leading-relaxed">${escapeHtml(p.description)}</div></div>` : ''}
              <div class="mt-auto flex flex-col gap-2">
                <div class="text-sm text-gray-500 text-center mb-1">This class charges a one-time entrance fee before you can join</div>
                <button id="confirm-class-payment-btn" onclick="confirmClassPayment()" class="w-full font-semibold py-3 rounded-2xl text-white flex items-center justify-center" style="background:${NAVY};">Continue to Pay ${classPaymentFeeLabel(p)}</button>
                <button onclick="cancelClassPaymentConfirm()" class="w-full font-semibold py-3 rounded-2xl text-gray-500 bg-gray-100">Cancel</button>
                <button onclick="openReportClass('class','${escapeForJsAttr(p.classId)}','${escapeForJsAttr(p.className)}')" class="text-[11px] font-semibold text-gray-400 mt-2 inline-flex items-center justify-center gap-1">${Icon('flag','w-3 h-3')} Report this class</button>
              </div>
            </div>`;
        }
        function resetClassPaymentConfirmBtn(){
          const btn = document.getElementById('confirm-class-payment-btn');
          if (!btn || !pendingClassPayment) return;
          btn.disabled = false;
          btn.style.opacity = '';
          btn.innerHTML = 'Continue to Pay ' + classPaymentFeeLabel(pendingClassPayment);
        }
        // Asks the database for the class's price again (same RPC the code entry used)
        async function fetchClassPriceFromDatabase(p){
          if (!p.code) return { ok: true, amount: p.amount, currency: p.currency };
          const sb = getSupabaseClient();
          if (!sb) return { ok: false };
          try {
            let { data: r, error } = await sb.rpc('join_class_by_code', { p_code: p.code, p_name: profileData.name || '', p_username: profileData.username || '', p_photo: profileData.photo || null });
            if (Array.isArray(r)) r = r[0];
            if (error || !r) return { ok: false };
            if (r.status !== 'payment_required') return { ok: true, notRequired: true, status: r.status };
            return { ok: true, amount: r.amount, currency: r.currency || p.currency };
          } catch (e) { return { ok: false }; }
        }
        async function confirmClassPayment(){
          if (!pendingClassPayment || classPaymentBusy) return;
          const p = pendingClassPayment;
          if (!p.amount || p.amount <= 0) {
            openAppAlertModal("This class's entrance fee isn't set up correctly. Please contact the teacher.", 'Payment unavailable');
            return;
          }
          const btn = document.getElementById('confirm-class-payment-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.75'; btn.innerHTML = classActionBtnSpinnerHTML('#ffffff', 'Processing...'); }
          const fresh = await fetchClassPriceFromDatabase(p);
          if (pendingClassPayment !== p) return;
          if (!fresh.ok) {
            resetClassPaymentConfirmBtn();
            openAppAlertModal("We couldn't check the price just now. Check your connection and try again.", 'Payment unavailable');
            return;
          }
          if (fresh.notRequired) {
            pendingClassPayment = null;
            overlayGoBack();
            openAppAlertModal(fresh.status === 'pending' ? 'Your request is with the teacher.' : 'This class no longer needs payment from you.', 'Entrance Fee');
            return;
          }
          if (Number(fresh.amount) !== Number(p.amount) || fresh.currency !== p.currency) {
            p.amount = fresh.amount; p.currency = fresh.currency;
            const feeEl = document.getElementById('confirm-class-payment-btn');
            if (feeEl) { feeEl.disabled = false; feeEl.style.opacity = ''; }
            openClassPaymentConfirmRefresh();
            openAppAlertModal(`The price is now ${classPaymentFeeLabel(p)}. Check it, then tap Continue to Pay.`, 'Price updated');
            return;
          }
          // Only the class id goes forward. The amount is the one just read from the database.
          startClassPayment(p.classId, p.className);
        }
        function openClassPaymentConfirmRefresh(){
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'classPaymentConfirm') ov.innerHTML = classPaymentConfirmHTML();
        }
        function cancelClassPaymentConfirm(){
          pendingClassPayment = null;
          overlayGoBack();
        }

        // Takes only the class id
        function startClassPayment(classId, className){
          if (classPaymentBusy) return;
          const p = pendingClassPayment;
          const amount = p && p.classId === classId ? Number(p.amount) : 0;
          const currency = p && p.currency;
          if (!amount || amount <= 0) {
            openAppAlertModal("This class's entrance fee isn't set up correctly. Please contact the teacher.", 'Payment unavailable');
            resetClassPaymentConfirmBtn();
            return;
          }
          classPaymentBusy = true;
          const subunitAmount = Math.round(amount * 100);
          loadPaystackScript().then(() => {
            const reference = 'stitch_class_' + classId + '_' + Date.now();
            const handler = window.PaystackPop.setup({
              key: PAYSTACK_PUBLIC_KEY,
              email: (typeof currentUserEmail !== 'undefined' && currentUserEmail) || '',
              amount: subunitAmount,
              currency: currency || 'GHS',
              ref: reference,
              metadata: { class_id: classId, user_id: (typeof currentUserId !== 'undefined' && currentUserId) || '' },
              callback: function(response){
                popModalBackHandler(false);
                const ref = response.reference || reference;
                // Saved before the first verify attempt: if the tab dies mid-verification (or every
                // attempt this session fails to reach the server), the next launch picks up right here
                // instead of the payment silently vanishing
                persistPendingClassPayment(ref, classId, className);
                verifyClassPayment(ref, classId);
              },
              onClose: function(){ classPaymentBusy = false; resetClassPaymentConfirmBtn(); },
            });
            pushModalBackHandler(() => { teardownPaystackPopup(false); classPaymentBusy = false; resetClassPaymentConfirmBtn(); });
            handler.openIframe();
          }).catch(() => {
            classPaymentBusy = false;
            resetClassPaymentConfirmBtn();
            openAppAlertModal('Could not load the payment popup. Check your connection and try again.', 'Payment unavailable');
          });
        }

        // opts.silent: true when this is a background/resumed attempt (app just launched, or the
        // person navigated away)
        async function verifyClassPayment(reference, classId, attempt, opts){
          attempt = attempt || 1;
          opts = opts || {};
          const cycle = opts.cycle || 0;
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('NOT_SIGNED_IN');
            const res = await fetch(`${SUPABASE_URL}/functions/v1/bright-function`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY },
              body: JSON.stringify({ reference, classId }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Payment verification failed (' + res.status + ')');
            if (!data.verified) throw new Error('We could not confirm this payment. If you were charged, contact support with reference ' + reference + '.');

            classPaymentBusy = false;
            clearPendingClassPayment(reference);
            const { data: userRes } = await getSupabaseClient().auth.getUser();
            const me = userRes && userRes.user;
            const found = classRowToLocal(data.class, me.id);
            const existingIdx = myClasses.findIndex(c => c.id === found.id);
            if (existingIdx !== -1) myClasses[existingIdx] = found; else myClasses.push(found);
            if (typeof preparedClassIds !== 'undefined') preparedClassIds.add(found.id);
            if (opts.silent) {
              // The person isn't sitting in a loading screen waiting for this
              openAppAlertModal(`You're in! ${found.name || opts.className || 'The class'} has been added to your classes.`, 'Payment confirmed');
              if (typeof renderApp === 'function') { try { renderApp(); } catch (e) {} }
            } else {
              runClassActionLoading('Adding you to class', 'users', () => { openClassDetail(found.id); });
            }
          } catch (err) {
            // A bare "Failed to fetch" (or not being able to read a session yet, right after launch)
            // means the request never really got a chance to succeed or fail
            const isNetworkError = ((err instanceof TypeError) && /failed to fetch/i.test(err.message || '')) || err.message === 'NOT_SIGNED_IN';
            if (isNetworkError && attempt < CLASS_PAYMENT_QUICK_ATTEMPTS) {
              setTimeout(() => verifyClassPayment(reference, classId, attempt + 1, opts), Math.min(1500 * attempt, 8000));
              return;
            }
            if (isNetworkError && cycle < CLASS_PAYMENT_SLOW_CYCLES) {
              // Quick retries didn't land it
              classPaymentBusy = false;
              setTimeout(() => verifyClassPayment(reference, classId, 1, Object.assign({}, opts, { silent: true, cycle: cycle + 1 })), CLASS_PAYMENT_SLOW_DELAY_MS);
              return;
            }
            classPaymentBusy = false;
            window.reportError && window.reportError(err, { call: 'verifyClassPayment', classId, attempt, cycle, silent: !!opts.silent });
            if (isNetworkError) {
              // Exhausted every quiet retry this session
              return;
            }
            // A real, non-network decline (bad reference, actual verification failure)
            clearPendingClassPayment(reference);
            if (!opts.silent) {
              resetClassPaymentConfirmBtn();
              openAppAlertModal(err.message || 'Payment verification failed. Please try again.', 'Payment not confirmed');
            }
          }
        }
        resumePendingClassPaymentIfAny();

        async function submitCreateClassroom(){
          if (!requireCompleteProfile()) return;
          const name = document.getElementById('create-name-input').value.trim();
          const section = document.getElementById('create-section-input').value.trim();
          const subject = document.getElementById('create-subject-input').value.trim();
          const descriptionEl = document.getElementById('create-description-input');
          const description = descriptionEl ? descriptionEl.value.trim() : '';
          if (!name) { openAppAlertModal('Enter a class name'); return; }
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal('Sign-in backend is not configured yet -- classes can\'t be created.'); return; }
          const { data: userRes } = await sb.auth.getUser();
          const me = userRes && userRes.user;
          if (!me) { openAppAlertModal('Please sign in again to create a class.'); return; }
          const id = 'class-' + Date.now();
          const code = generateClassCode();
          const colorIndex = Math.floor(Math.random() * classCardPalette.length);
          const motifIndex = Math.floor(Math.random() * classCardMotifs.length);
          // Admins can gate a class behind a Paystack entrance fee
          const paymentEnabled = canCurrentUserSellPaid() && !!newClassDraft.paymentEnabled;
          const paymentAmount = paymentEnabled ? Math.round(parseFloat(newClassDraft.paymentAmount) || 0) : 0;
          if (paymentEnabled && paymentAmount <= 0) { openAppAlertModal('Enter a valid entrance fee amount.'); return; }
          const classData = {
            name, section, subject, description, students: [], coTeachers: [], announcements: [], classwork: [], lectures: [], photo: null, notificationsEnabled: true, colorIndex, motifIndex,
            joinPolicy: newClassDraft.joinPolicy === 'approved' ? 'approved' : 'open',
            paymentEnabled,
            paymentAmount,
            paymentCurrency: newClassDraft.paymentCurrency || 'GHS',
            pendingRequests: [],
          };
          runClassActionLoading('Creating class', 'plus', async () => {
            const { error } = await sb.from(CLASSES_TABLE).insert({ id, code, teacher_id: me.id, members: [], data: classData });
            if (error) {
              console.error('Create class error:', error);
              closeOverlay();
              openAppAlertModal("Couldn't create the class -- try again.");
              return;
            }
            myClasses.push(Object.assign({}, classData, { id, code, teacherId: me.id, role: 'teacher' }));
            if (typeof preparedClassIds !== 'undefined') preparedClassIds.add(id);
            openClassDetail(id);
          });
        }

        // ---- Class detail screen (tabs, dashboard) ----
        function classTeacherDisplayName(cls){
          if (cls && cls.role === 'teacher') return (profileData.name || '').trim() || 'You';
          const cached = cls && classTeacherProfiles[cls.teacherId];
          if (cached && cached.name) return cached.name;
          return 'Stitch Team';
        }

        let classTeacherProfiles = {};
        async function loadClassTeacherProfile(cls){
          if (!cls || cls.role === 'teacher' || !cls.teacherId) return;
          if (classTeacherProfiles[cls.teacherId]) return; 
          classTeacherProfiles[cls.teacherId] = {}; 
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('*').eq('user_id', cls.teacherId).maybeSingle();
            classTeacherProfiles[cls.teacherId] = {
              name: (data && (data.name || data.username)) || '',
              photo: (data && data.photo) || null,
            };
            const ov = document.getElementById('overlay');
            if (ov && currentOverlayKind === 'classDetail' && currentClassId === cls.id) ov.innerHTML = classDetailHTML();
          } catch (e) {  }
        }

        function classTeacherAvatarHTML(cls, sizeClass){
          const photo = cls && cls.role === 'teacher'
            ? profileData.photo
            : (cls && classTeacherProfiles[cls.teacherId] && classTeacherProfiles[cls.teacherId].photo);
          return avatarMediaHTML(photo, 'user', sizeClass);
        }

        // ---- Student roster photos (People tab) ----
        let classStudentProfiles = {};
        async function loadClassStudentProfiles(cls){
          if (!cls) return;
          // Include cls.members too, not just cls.students
          const idSet = new Set((cls.students || []).map(s => s.id));
          (cls.members || []).forEach(id => { if (id && id !== cls.teacherId) idSet.add(id); });
          const ids = Array.from(idSet).filter(id => id && !classStudentProfiles[id]);
          if (!ids.length) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id,name,photo').in('user_id', ids);
            (data || []).forEach(p => {
              classStudentProfiles[p.user_id] = { name: p.name || '', photo: p.photo || null };
            });
            ids.forEach(id => { if (!classStudentProfiles[id]) classStudentProfiles[id] = {}; });
            const ov = document.getElementById('overlay');
            if (ov && currentOverlayKind === 'classDetail' && currentClassId === cls.id && classDetailTab === 'people') {
              ov.innerHTML = classDetailHTML();
            }
          } catch (e) {  }
        }

        function classStudentAvatarHTML(s, sizeClass){
          const cached = s.id && classStudentProfiles[s.id];
          const photo = cached && cached.photo;
          return avatarMediaHTML(photo, 'user', sizeClass);
        }

        function openClassDetail(id){
          currentClassId = id;
          classDetailTab = 'stream';
          classDetailMenuOpen = false;
          openOverlay('classDetail');
          const cls = myClasses.find(c => c.id === id);
          if (cls) { loadClassTeacherProfile(cls); loadClassStudentProfiles(cls); }
        }

        async function leaveCurrentClass(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const idToRemove = currentClassId;
          myClasses = myClasses.filter(c => c.id !== idToRemove);
          currentClassId = null;
          closeOverlay();
          const sb = getSupabaseClient();
          if (!sb || !cls || !idToRemove) return;
          try {
            if (cls.role === 'teacher') {
              await sb.from(CLASSES_TABLE).delete().eq('id', idToRemove);
            } else {
              await sb.rpc('leave_class', { p_id: idToRemove });
            }
          } catch (e) { console.warn('Removing class failed:', e); }
        }

        function cancelCourseEnrollment(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) {
            Object.keys(jobApplications).forEach(jobId => {
              const app = jobApplications[jobId];
              if (app && app.classId === cls.id) {
                delete app.classId;
                delete app.status;
                delete app.appliedDate;
                delete app.statusUpdatedDate;
              }
            });
            queueSaveUserState();
          }
          leaveCurrentClass();
        }

        function classDetailSwitchTab(tab){
          if (CLASS_SUBPAGES.includes(tab) && !CLASS_SUBPAGES.includes(classDetailTab)) classDetailPrevTab = classDetailTab;
          classDetailTab = tab;
          document.getElementById('overlay').innerHTML = classDetailHTML();
        }

        function classDetailTabBtn(key, label){
          const active = classDetailTab === key;
          // min-w-0 + truncate: without these, a button's intrinsic content width (min-width:auto is
          // the flexbox default) can force the row wider than its container once all four tabs are
          return `<button onclick="classDetailSwitchTab('${key}')" class="flex-1 min-w-0 truncate py-2.5 text-sm font-bold ${active ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${active ? `background:rgba(30,144,255,0.5);` : 'background:#f3f4f6;'}">${label}</button>`;
        }

        function confirmDeleteCurrentClass(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          openLeaveClassModal(leaveCurrentClass, `Delete ${cls.name}?`, `This permanently deletes the class for you and every student in it, along with its stream, classwork, and materials. This can't be undone.`, 'trash');
        }
        function confirmLeaveCurrentClass(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          openLeaveClassModal(leaveCurrentClass, `Leave ${cls.name}?`, `You'll be removed from this classroom and its materials until you rejoin.`);
        }
        function confirmCancelCourseEnrollment(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          openLeaveClassModal(cancelCourseEnrollment, `Cancel enrollment in ${cls.name}?`, `You'll lose access to this course's materials until you enroll again.`);
        }

        function classDetailHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const showAdminDashboard = isCurrentUserAdmin() && cls.role === 'teacher';
          if (CLASS_SUBPAGES.includes(classDetailTab)) return classSubPageHTML(cls);
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto no-scrollbar" style="padding-bottom:50px;">
              ${classDetailHeaderHTML(cls.name, cls.role === 'teacher')}
              <div class="px-5">
                <div class="class-color-card rounded-3xl p-5 text-white relative overflow-hidden mb-4" style="${cls.photo ? `background-image:linear-gradient(rgba(10,37,64,0.45),rgba(10,37,64,0.45)),url('${cls.photo}');background-size:cover;background-position:center;` : classCardBackgroundStyle(cls)}min-height:104px;">
                  ${cls.photo ? '' : `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${classCardMotifs[classCardIndex(cls) % classCardMotifs.length]}</svg>`}
                  <div class="text-xl font-bold font-display mb-1 truncate pr-4 relative">${escapeHtml(cls.name)}</div>
                  <div class="flex items-center justify-between gap-3 mb-3 relative">
                    <div class="text-sm text-white/85 truncate">${cls.section ? escapeHtml(cls.section) : ''}</div>
                    ${classFeeLabel(cls) ? `<div class="text-sm font-bold text-white/95 flex-shrink-0">${classFeeLabel(cls)}</div>` : ''}
                  </div>
                  ${cls.description ? `<div class="text-xs text-white/80 relative" style="margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(cls.description)}</div>` : ''}
                  ${cls.code ? `<button onclick="copyClassCode('${cls.code}')" class="items-center gap-2 bg-white/15 rounded-full pl-3 pr-2 py-1.5 text-xs font-semibold relative" style="display:inline-flex;">
                    <span class="tracking-widest">Code: ${cls.code}</span>${Icon('copy','w-3.5 h-3.5')}
                  </button>` : ''}
                </div>
                ${(cls.isCourse && cls.role !== 'teacher') ? `
                <button onclick="confirmCancelCourseEnrollment()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 mb-4 font-semibold text-xs text-red-500 border border-red-100 bg-red-50">
                  ${Icon('trash','w-3.5 h-3.5')} Cancel Enrollment
                </button>` : ''}
                ${cls.role !== 'teacher' ? reportClassButtonHTML(cls.isCourse ? 'course' : 'class', cls.id, cls.name) : ''}
                ${cls.role === 'teacher' ? lectureActionPillsHTML() : ''}
                <div class="flex gap-1 mb-3 bg-gray-100 rounded-2xl p-1">
                  ${showAdminDashboard ? classDetailTabBtn('dashboard','Dashboard') : ''}
                  ${classDetailTabBtn('stream','Stream')}
                  ${classDetailTabBtn('classwork','Classwork')}
                </div>
                ${classDetailTab === 'dashboard' && showAdminDashboard ? classDashboardTabHTML(cls) : ''}
                ${classDetailTab === 'stream' ? classStreamTabHTML(cls) : ''}
                ${classDetailTab === 'classwork' ? classClassworkTabHTML(cls) : ''}
              </div>
              </div>
            </div>`;
        }

        // ---- Class sub-pages: People, Class profile (teacher) and My class report (student) ----
        const CLASS_SUBPAGES = ['people', 'profile', 'report'];
        let classDetailPrevTab = 'stream';
        const CLS_COLORS = { blue:'#4169e1', sky:'#1e90ff', green:'#10b981', amber:'#f59e0b', red:'#ef4444', purple:'#8b5cf6', cyan:'#06b6d4', pink:'#ec4899', gray:'#9ca3af' };

        function classSubPageBack(){
          classDetailTab = (classDetailPrevTab && !CLASS_SUBPAGES.includes(classDetailPrevTab)) ? classDetailPrevTab : 'stream';
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
        }

        function classStudentName(cls, s){
          const p = s && s.id ? classStudentProfiles[s.id] : null;
          const own = s && s.name && s.name !== 'Class member' ? s.name : '';
          return own || (p && p.name) || 'Student';
        }
        function classRound1(n){ return Math.round(n * 10) / 10; }
        function classGradeLetter(p){ return p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F'; }
        function classGradable(w){ return w.type !== 'material' && w.type !== 'poll'; }
        function classItemSubmitted(w, sid){
          return w.type === 'quiz' ? !!(w.quizSubmissions || {})[sid] : !!(w.submissions || {})[sid];
        }
        // Percent a student scored on one item, or null when there is nothing graded yet.
        function classItemPercent(w, sid){
          let p = null;
          if (w.type === 'quiz') {
            const q = (w.quizSubmissions || {})[sid];
            if (q && q.total) p = q.autoScore / q.total * 100;
          } else {
            const sub = (w.submissions || {})[sid];
            if (sub && sub.graded && w.points) p = Number(sub.score) / w.points * 100;
          }
          return p === null || isNaN(p) ? null : classRound1(Math.max(0, Math.min(100, p)));
        }
        function classFmtDuration(sec){
          const m = Math.round((sec || 0) / 60);
          return m < 60 ? m + ' min' : classRound1(m / 60) + ' hr';
        }

        function classAnalytics(cls){
          const roster = classRosterList(cls);
          const joined = roster.filter(s => s.id && !s.pending);
          const invited = roster.filter(s => !s.id || s.pending);
          const work = cls.classwork || [];
          const gradable = work.filter(classGradable);
          const rows = joined.map(s => {
            const pcts = []; let submitted = 0;
            gradable.forEach(w => {
              if (classItemSubmitted(w, s.id)) submitted++;
              const p = classItemPercent(w, s.id);
              if (p !== null) pcts.push(p);
            });
            const overall = pcts.length ? classRound1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
            return { id: s.id, name: classStudentName(cls, s), overall, graded: pcts.length, submitted, total: gradable.length };
          });
          const ranked = rows.filter(r => r.overall !== null).sort((a, b) => b.overall - a.overall || b.submitted - a.submitted);
          const unranked = rows.filter(r => r.overall === null);
          const average = ranked.length ? classRound1(ranked.reduce((a, r) => a + r.overall, 0) / ranked.length) : null;
          const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
          ranked.forEach(r => { dist[classGradeLetter(r.overall)]++; });
          const perItem = gradable.map(w => {
            const ps = joined.map(s => classItemPercent(w, s.id)).filter(p => p !== null);
            return { title: w.title || 'Untitled', type: w.type, avg: ps.length ? classRound1(ps.reduce((a, b) => a + b, 0) / ps.length) : null };
          }).filter(i => i.avg !== null);
          const possible = joined.length * gradable.length;
          const done = rows.reduce((a, r) => a + r.submitted, 0);
          const completion = possible ? Math.round(done / possible * 100) : null;
          const byType = { assignment: 0, question: 0, quiz: 0, poll: 0, material: 0 };
          work.forEach(w => { byType[Object.prototype.hasOwnProperty.call(byType, w.type) ? w.type : 'assignment']++; });
          const comments = (cls.announcements || []).reduce((a, x) => a + (x.comments || []).length, 0);
          const submissions = work.filter(w => ['quiz', 'poll', 'material'].indexOf(w.type) === -1).reduce((a, w) => a + Object.keys(w.submissions || {}).length, 0);
          const quizAttempts = work.filter(w => w.type === 'quiz').reduce((a, w) => a + Object.keys(w.quizSubmissions || {}).length, 0);
          const pollVotes = work.filter(w => w.type === 'poll').reduce((a, w) => a + (w.options || []).reduce((s, o) => s + (o.votes || 0), 0), 0);
          const callLog = cls.callLog || [];
          const callSeconds = callLog.reduce((a, c) => a + (c.seconds || 0), 0);
          const lectures = cls.lectures || [];
          return {
            joined, invited, requests: (cls.pendingRequests || []).length, work, gradable, rows, ranked, unranked, average, dist, perItem,
            completion, done, possible, byType, comments, submissions, quizAttempts, pollVotes,
            interactions: comments + submissions + quizAttempts + pollVotes,
            callLog, callSeconds, upcoming: lectures.filter(l => l.status !== 'live').length, live: lectures.filter(l => l.status === 'live').length,
          };
        }

        // One student's own numbers (used for the student-side "My class report").
        function classMyReport(cls){
          const uid = myClassworkUserId();
          const gradable = (cls.classwork || []).filter(classGradable);
          const items = gradable.map(w => {
            const submitted = uid ? classItemSubmitted(w, uid) : false;
            const percent = uid ? classItemPercent(w, uid) : null;
            let status = 'Not submitted';
            if (w.type === 'quiz') {
              const q = uid ? (w.quizSubmissions || {})[uid] : null;
              if (q) status = q.autoScore + '/' + q.total;
            } else {
              const sub = uid ? (w.submissions || {})[uid] : null;
              if (sub && sub.graded) status = sub.score + (w.points ? '/' + w.points : '');
              else if (sub) status = 'Turned in';
            }
            const joinedNow = classRosterList(cls).filter(x => x.id && !x.pending);
            const cps = joinedNow.map(x => classItemPercent(w, x.id)).filter(p => p !== null);
            const classAvg = cps.length ? classRound1(cps.reduce((a, b) => a + b, 0) / cps.length) : null;
            return { id: w.id, title: w.title || 'Untitled', type: w.type === 'quiz' ? 'Quiz' : (w.type === 'question' ? 'Question' : 'Assignment'), due: w.due || '', submitted, percent, classAvg, status };
          });
          const pcts = items.filter(i => i.percent !== null).map(i => i.percent);
          return {
            items,
            overall: pcts.length ? classRound1(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
            submitted: items.filter(i => i.submitted).length,
            graded: pcts.length,
            total: items.length,
          };
        }

        // ---- Small chart helpers (no panels, text sits on the page background) ----
        function classSectionHTML(title, sub, inner){
          // Only 'Who joined' and 'Where I stand' keep a panel; the rest sit on the page background.
          const panel = (title === 'Who joined' || title === 'Where I stand');
          return `
            <div class="${panel ? 'bg-white rounded-3xl p-5 shadow-sm' : 'class-flat-section'}" style="margin-bottom:${panel ? '16px' : '28px'};${panel ? '' : 'padding:0 4px;'}">
              <div class="font-semibold text-base text-gray-800" style="margin-bottom:${sub ? '2px' : '12px'};">${title}</div>
              ${sub ? `<div class="text-xs text-gray-400" style="margin:0 0 14px;">${sub}</div>` : ''}
              ${inner}
            </div>`;
        }
        function classTilesHTML(tiles){
          return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 16px;margin-bottom:28px;">${tiles.map(t => `
            <div>
              <div class="font-bold font-display" style="font-size:26px;line-height:1.1;color:${t.c};">${t.v}</div>
              <div class="text-xs text-gray-400" style="margin-top:3px;">${t.l}</div>
            </div>`).join('')}</div>`;
        }
        function classBarsHTML(items, opts){
          opts = opts || {};
          const h = opts.height || 120;
          const max = opts.max || Math.max(1, ...items.map(i => i.value));
          const cols = items.map(i => {
            const bh = i.value ? Math.max(4, Math.round(i.value / max * h)) : 2;
            return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:${h + 20}px;">
              <div style="font-size:10px;font-weight:700;color:#4b5563;margin-bottom:3px;">${i.display != null ? i.display : i.value}</div>
              <div style="width:100%;max-width:34px;height:${bh}px;background:${i.color || CLS_COLORS.sky};border-radius:8px 8px 3px 3px;"></div>
            </div>`;
          }).join('');
          const labels = items.map(i => `<div style="flex:1;min-width:0;text-align:center;font-size:10px;color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(i.label)}</div>`).join('');
          return `<div style="display:flex;gap:8px;align-items:flex-end;border-bottom:1px solid #e5e7eb;">${cols}</div><div style="display:flex;gap:8px;margin-top:6px;">${labels}</div>`;
        }
        function classHBarsHTML(items){
          return items.map(i => `
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;margin-bottom:5px;">
                <span class="font-semibold text-gray-700" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.rank ? i.rank + '. ' : ''}${escapeHtml(i.label)}</span>
                <span class="font-bold flex-shrink-0" style="color:${i.color || CLS_COLORS.sky};">${i.display}</span>
              </div>
              <div style="height:8px;border-radius:999px;background:#eef0f4;overflow:hidden;"><div style="height:100%;width:${Math.max(0, Math.min(100, i.value))}%;border-radius:999px;background:${i.color || CLS_COLORS.sky};"></div></div>
            </div>`).join('');
        }
        function classPieHTML(slices, emptyMsg){
          if (emptyMsg && !slices.some(s => s.value > 0)) return classNoDataHTML(emptyMsg, 'pie');
          if (typeof actPieHTML === 'function') return actPieHTML(slices, emptyMsg);
          return classHBarsHTML(slices.map(s => ({ label: s.label, value: s.value, display: String(s.value), color: s.color })));
        }
        // Empty state: a small faded graph illustration above the message.
        function classNoDataHTML(msg, kind){
          const C = CLS_COLORS;
          const art = {
            bars: `<svg viewBox="0 0 120 64" width="120" height="64" aria-hidden="true">
              <rect x="10" y="38" width="16" height="22" rx="5" fill="${C.sky}" opacity="0.30"/>
              <rect x="34" y="22" width="16" height="38" rx="5" fill="${C.purple}" opacity="0.30"/>
              <rect x="58" y="30" width="16" height="30" rx="5" fill="${C.cyan}" opacity="0.30"/>
              <rect x="82" y="10" width="16" height="50" rx="5" fill="${C.green}" opacity="0.30"/>
              <rect x="4" y="61" width="112" height="2" rx="1" fill="#9ca3af" opacity="0.25"/></svg>`,
            pie: `<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
              <circle cx="32" cy="32" r="22" fill="none" stroke="${C.sky}" stroke-opacity="0.30" stroke-width="10" stroke-dasharray="52 138" transform="rotate(-90 32 32)"/>
              <circle cx="32" cy="32" r="22" fill="none" stroke="${C.amber}" stroke-opacity="0.30" stroke-width="10" stroke-dasharray="36 138" stroke-dashoffset="-54" transform="rotate(-90 32 32)"/>
              <circle cx="32" cy="32" r="22" fill="none" stroke="${C.green}" stroke-opacity="0.30" stroke-width="10" stroke-dasharray="28 138" stroke-dashoffset="-92" transform="rotate(-90 32 32)"/></svg>`,
            line: `<svg viewBox="0 0 120 64" width="120" height="64" aria-hidden="true">
              <path d="M6 50 L28 36 L50 42 L74 20 L96 28 L114 10 L114 60 L6 60 Z" fill="${C.sky}" opacity="0.12"/>
              <path d="M6 50 L28 36 L50 42 L74 20 L96 28 L114 10" fill="none" stroke="${C.sky}" stroke-opacity="0.40" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="74" cy="20" r="3.5" fill="${C.sky}" opacity="0.45"/><circle cx="114" cy="10" r="3.5" fill="${C.sky}" opacity="0.45"/></svg>`,
            list: `<svg viewBox="0 0 120 64" width="120" height="64" aria-hidden="true">
              <rect x="10" y="8" width="100" height="14" rx="7" fill="${C.sky}" opacity="0.18"/><circle cx="19" cy="15" r="4" fill="${C.sky}" opacity="0.35"/>
              <rect x="10" y="26" width="100" height="14" rx="7" fill="${C.purple}" opacity="0.18"/><circle cx="19" cy="33" r="4" fill="${C.purple}" opacity="0.35"/>
              <rect x="10" y="44" width="100" height="14" rx="7" fill="${C.green}" opacity="0.18"/><circle cx="19" cy="51" r="4" fill="${C.green}" opacity="0.35"/></svg>`,
          }[kind || 'bars'];
          return `<div class="flex flex-col items-center text-center" style="padding:6px 0 2px;"><div style="margin-bottom:10px;">${art}</div><div class="text-sm text-gray-400">${msg}</div></div>`;
        }

        function classAvgOf(arr){ return arr.length ? classRound1(arr.reduce((x, y) => x + y, 0) / arr.length) : null; }
        function classWeeklyData(cls){
          const WK = 8;
          if (typeof insightsWeekBuckets !== 'function') return null;
          const b = insightsWeekBuckets(WK);
          const ann = new Array(WK).fill(0), calls = new Array(WK).fill(0);
          (cls.announcements || []).forEach(a => { const i = b.idxOf(a.createdAt); if (i >= 0) ann[i]++; });
          (cls.callLog || []).forEach(c => { const i = b.idxOf(c.endedAt ? new Date(c.endedAt).getTime() : 0); if (i >= 0) calls[i] += Math.round((c.seconds || 0) / 60); });
          return { labels: b.labels, ann, calls };
        }
        function classExtras(cls, A){
          const groups = {};
          A.perItem.forEach(i => { const k = i.type === 'quiz' ? 'Quizzes' : (i.type === 'question' ? 'Questions' : 'Assignments'); (groups[k] = groups[k] || []).push(i.avg); });
          const tc = { Quizzes: CLS_COLORS.purple, Questions: CLS_COLORS.cyan, Assignments: CLS_COLORS.sky };
          const typeRows = Object.keys(groups).map(k => { const v = classAvgOf(groups[k]); return { label: k, value: v, display: v + '%', color: tc[k] }; });
          const attention = A.rows
            .filter(r => (r.overall !== null && r.overall < 60) || (r.total > 0 && r.submitted === 0))
            .sort((a, b) => (a.overall === null ? -1 : a.overall) - (b.overall === null ? -1 : b.overall))
            .slice(0, 6).map(r => ({ name: r.name, note: r.overall !== null ? r.overall + '% average' : 'Nothing handed in' }));
          const poll = A.work.find(w => w.type === 'poll') || null;
          let pollRows = [], pollTotal = 0;
          if (poll) {
            pollTotal = (poll.options || []).reduce((t, o) => t + (o.votes || 0), 0);
            pollRows = (poll.options || []).map(o => ({ label: o.text || 'Option', value: pollTotal ? Math.round((o.votes || 0) / pollTotal * 100) : 0, display: (o.votes || 0) + ' vote' + ((o.votes || 0) === 1 ? '' : 's'), color: CLS_COLORS.amber }));
          }
          const pts = A.ranked.map((r, i) => ({ x: A.ranked.length - 1 - i, y: r.overall, size: i === 0 ? 18 : 12, color: i === 0 ? CLS_COLORS.amber : CLS_COLORS.sky, tip: r.name + ' - ' + r.overall + '%' }));
          return { typeRows, attention, poll, pollRows, pollTotal, pts, W: classWeeklyData(cls) };
        }
        function classStudentExtras(cls, R, A){
          const uid = myClassworkUserId();
          const scored = R.items.filter(i => i.percent !== null);
          const rank = uid ? A.ranked.findIndex(r => r.id === uid) + 1 : 0;
          const best = scored.length ? Math.max(...scored.map(i => i.percent)) : null;
          const worst = scored.length ? Math.min(...scored.map(i => i.percent)) : null;
          const tc = { Assignment: CLS_COLORS.sky, Quiz: CLS_COLORS.purple, Question: CLS_COLORS.cyan };
          const typeSlices = ['Assignment', 'Quiz', 'Question'].map(t => ({ label: t + 's handed in', value: R.items.filter(i => i.type === t && i.submitted).length, color: tc[t] }));
          const todo = R.items.filter(i => !i.submitted);
          const recent = scored.slice(-8);
          return { scored, rank, best, worst, typeSlices, todo, recent };
        }

        function classProfileBodyHTML(cls){
          const A = classAnalytics(cls);
          const X = classExtras(cls, A);
          const gradeColors = { A: CLS_COLORS.green, B: CLS_COLORS.sky, C: CLS_COLORS.amber, D: '#f97316', F: CLS_COLORS.red };
          const callBars = A.callLog.slice(-6).map(c => ({
            label: c.endedAt ? new Date(c.endedAt).getDate() + '/' + (new Date(c.endedAt).getMonth() + 1) : '',
            value: Math.round((c.seconds || 0) / 60), color: CLS_COLORS.green,
          }));
          const top = A.ranked.slice(0, 5);
          const weekly = (X.W && typeof insightsBarChartHTML === 'function' && typeof insightsLineChartHTML === 'function')
            ? classSectionHTML('Class activity', 'Announcements posted, last 8 weeks',
                insightsBarChartHTML(X.W.labels, X.W.ann, CLS_COLORS.blue)
                + `<div class="font-semibold text-xs text-gray-600" style="margin:18px 0 8px;">Call minutes per week</div>`
                + insightsLineChartHTML(X.W.labels, [{ name: 'Call minutes', color: CLS_COLORS.green, values: X.W.calls, area: true }]))
            : '';
          return `
            ${classSectionHTML('Who joined', 'Students in the class compared with people still to join',
              classPieHTML([
                { label: 'Joined', value: A.joined.length, color: CLS_COLORS.sky },
                { label: 'Invited, not joined', value: A.invited.length, color: CLS_COLORS.amber },
                { label: 'Join requests', value: A.requests, color: CLS_COLORS.purple },
              ], 'Nobody has joined yet.'))}
            ${weekly}
            ${classSectionHTML('Classwork', 'What you have posted so far',
              classBarsHTML([
                { label: 'Assign.', value: A.byType.assignment, color: CLS_COLORS.sky },
                { label: 'Quiz', value: A.byType.quiz, color: CLS_COLORS.purple },
                { label: 'Question', value: A.byType.question, color: CLS_COLORS.cyan },
                { label: 'Poll', value: A.byType.poll, color: CLS_COLORS.amber },
                { label: 'Material', value: A.byType.material, color: CLS_COLORS.green },
              ]))}
            ${classSectionHTML('Handed in vs missing', 'Turn-ins across every student and every assignment or quiz',
              classPieHTML([
                { label: 'Handed in', value: A.done, color: CLS_COLORS.green },
                { label: 'Missing', value: Math.max(0, A.possible - A.done), color: CLS_COLORS.amber },
              ], 'Nothing to hand in yet.'))}
            ${classSectionHTML('Interactions', 'How students are engaging with the class',
              classBarsHTML([
                { label: 'Comments', value: A.comments, color: CLS_COLORS.sky },
                { label: 'Turn-ins', value: A.submissions, color: CLS_COLORS.green },
                { label: 'Quiz tries', value: A.quizAttempts, color: CLS_COLORS.purple },
                { label: 'Votes', value: A.pollVotes, color: CLS_COLORS.amber },
              ]))}
            ${classSectionHTML('Calls', 'Live lectures and calls in this class',
              classTilesHTML([
                { v: A.callLog.length, l: 'Calls held', c: CLS_COLORS.green },
                { v: classFmtDuration(A.callSeconds), l: 'Total call time', c: CLS_COLORS.sky },
                { v: A.upcoming, l: 'Scheduled', c: CLS_COLORS.amber },
                { v: A.live, l: 'Live now', c: CLS_COLORS.red },
              ]) + (callBars.length ? `<div class="text-xs text-gray-400" style="margin-bottom:10px;">Minutes per call (latest ${callBars.length})</div>${classBarsHTML(callBars)}` : classNoDataHTML('Calls you end will show up here.', 'line')))}
            ${classSectionHTML('Class performance', 'Based on graded assignments and quizzes',
              classTilesHTML([
                { v: A.average !== null ? A.average + '%' : '--', l: 'Class average', c: CLS_COLORS.sky },
                { v: A.completion !== null ? A.completion + '%' : '--', l: 'Work handed in', c: CLS_COLORS.green },
              ]) + (A.ranked.length
                ? `<div class="text-xs text-gray-400" style="margin-bottom:10px;">Students per grade</div>${classBarsHTML(['A', 'B', 'C', 'D', 'F'].map(g => ({ label: g, value: A.dist[g], color: gradeColors[g] })))}`
                : classNoDataHTML('Grades will appear once you score some work.', 'bars')))}
            ${classSectionHTML('Every student, plotted', 'Each dot is a student: higher means a better average. The gold dot is the top student.',
              typeof actScatterHTML === 'function' ? actScatterHTML(X.pts, { xLeft: 'Lowest', xRight: 'Highest', empty: 'Students will be plotted here once they have graded work.', legend: '' }) : classNoDataHTML('Not available.'))}
            ${A.perItem.length ? classSectionHTML('Average score by classwork', null, classHBarsHTML(A.perItem.slice(0, 12).map(i => ({ label: i.title, value: i.avg, display: i.avg + '%', color: CLS_COLORS.sky })))) : ''}
            ${X.typeRows.length > 1 ? classSectionHTML('Average by kind of work', 'Quizzes, questions and assignments compared', classHBarsHTML(X.typeRows)) : ''}
            ${classSectionHTML('Top of the class', 'Highest overall average',
              top.length ? classHBarsHTML(top.map((r, i) => ({ rank: i + 1, label: r.name, value: r.overall, display: r.overall + '%', color: i === 0 ? CLS_COLORS.amber : CLS_COLORS.sky })))
                : classNoDataHTML('Nobody has a graded score yet.'))}
            ${X.attention.length ? classSectionHTML('Worth a check-in', 'Students under 60% or with nothing handed in',
              X.attention.map((r, idx) => `
                <div class="flex items-center justify-between gap-3 py-3" style="${idx < X.attention.length - 1 ? 'border-bottom:1px solid rgba(0,0,0,0.07);' : ''}">
                  <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(r.name)}</div>
                  <div class="text-sm font-bold flex-shrink-0" style="color:${CLS_COLORS.red};">${escapeHtml(r.note)}</div>
                </div>`).join('')) : ''}
            ${X.poll ? classSectionHTML('Latest poll', escapeHtml(X.poll.title || 'Poll') + ' &middot; ' + X.pollTotal + ' vote' + (X.pollTotal === 1 ? '' : 's'),
              X.pollTotal ? classHBarsHTML(X.pollRows) : classNoDataHTML('No votes yet.')) : ''}
            <div class="text-xs text-gray-400" style="margin-bottom:8px;">The downloadable report also lists every student with their grades and ranking.</div>`;
        }

        function classMyReportBodyHTML(cls){
          const R = classMyReport(cls);
          const A = classAnalytics(cls);
          const X = classStudentExtras(cls, R, A);
          const compare = [];
          if (R.overall !== null) compare.push({ label: 'You', value: R.overall, display: R.overall + '%', color: CLS_COLORS.sky });
          if (A.average !== null) compare.push({ label: 'Class average', value: A.average, display: A.average + '%', color: CLS_COLORS.gray });
          const lineChart = (X.recent.length >= 2 && typeof insightsLineChartHTML === 'function')
            ? classSectionHTML('Me and the class, item by item', 'Items in order, oldest to newest',
                insightsLineChartHTML(X.recent.map((_, i) => String(i + 1)), [
                  { name: 'Me', color: CLS_COLORS.sky, values: X.recent.map(i => i.percent), area: true },
                  { name: 'Class average', color: CLS_COLORS.gray, values: X.recent.map(i => i.classAvg != null ? i.classAvg : 0) },
                ])) : '';
          return `
            ${classSectionHTML('Where I stand', 'Compared with the rest of the class',
              classTilesHTML([
                { v: X.rank ? X.rank + ' of ' + A.ranked.length : '--', l: 'My rank', c: CLS_COLORS.amber },
                { v: R.overall !== null ? classGradeLetter(R.overall) : '--', l: 'My grade', c: CLS_COLORS.sky },
                { v: X.best !== null ? X.best + '%' : '--', l: 'Best score', c: CLS_COLORS.green },
                { v: X.worst !== null ? X.worst + '%' : '--', l: 'Lowest score', c: CLS_COLORS.red },
              ]))}
            ${classSectionHTML('My progress', 'Handed in compared with still to do',
              classPieHTML([
                { label: 'Handed in', value: R.submitted, color: CLS_COLORS.green },
                { label: 'Not yet', value: Math.max(0, R.total - R.submitted), color: CLS_COLORS.amber },
              ], 'No assignments or quizzes yet.'))}
            ${classSectionHTML('My scores', 'Percent on each graded item',
              X.scored.length ? classBarsHTML(X.scored.slice(-8).map(i => ({ label: i.title, value: i.percent, display: i.percent + '%', color: CLS_COLORS.sky })), { max: 100 }) : classNoDataHTML('Your graded work will show up here.'))}
            ${lineChart}
            ${classSectionHTML('What I have handed in', 'By kind of work', classPieHTML(X.typeSlices, 'Nothing handed in yet.'))}
            ${compare.length > 1 ? classSectionHTML('Me and the class', null, classHBarsHTML(compare)) : ''}
            ${X.todo.length ? classSectionHTML('Still to do', 'Not handed in yet',
              X.todo.map((i, idx) => `
                <div class="flex items-center justify-between gap-3 py-3" style="${idx < X.todo.length - 1 ? 'border-bottom:1px solid rgba(0,0,0,0.07);' : ''}">
                  <div class="min-w-0">
                    <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(i.title)}</div>
                    <div class="text-xs text-gray-400">${i.type}${i.due ? ' &middot; Due ' + escapeHtml(i.due) : ''}</div>
                  </div>
                  <div class="text-sm font-bold flex-shrink-0" style="color:${CLS_COLORS.amber};">To do</div>
                </div>`).join('')) : ''}
            ${classSectionHTML('My classwork', null, R.items.length ? R.items.map((i, idx) => `
              <div class="flex items-center justify-between gap-3 py-3" style="${idx < R.items.length - 1 ? 'border-bottom:1px solid rgba(0,0,0,0.07);' : ''}">
                <div class="min-w-0">
                  <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(i.title)}</div>
                  <div class="text-xs text-gray-400">${i.type}${i.due ? ' &middot; Due ' + escapeHtml(i.due) : ''}</div>
                </div>
                <div class="text-sm font-bold flex-shrink-0" style="color:${i.submitted ? CLS_COLORS.green : '#9ca3af'};">${escapeHtml(i.status)}</div>
              </div>`).join('') : classNoDataHTML('Nothing has been assigned yet.', 'list'))}`;
        }

        // The strip of bars on the hero card
        function classHeroBarsHTML(series, isTeacher){
          const vals = (series || []).filter(v => v !== null && v !== undefined && !isNaN(v)).slice(-8);
          if (!vals.length) {
            const art = [40,65,35,80,55,90,60,100].map(h => `<i style="height:${h}%;"></i>`).join('');
            return `<div class="myact-hero-bars" aria-hidden="true" style="opacity:.2;">${art}</div>
              <div class="text-[11px] text-blue-100" style="margin-top:8px;opacity:.85;">${isTeacher ? 'Average scores will chart here once work is graded' : 'Your scores will chart here once work is graded'}</div>`;
          }
          const bars = vals.map(v => {
            const pct = Math.max(0, Math.min(100, v));
            return `<i title="${classRound1(pct)}%" style="height:${Math.max(6, pct)}%;flex:0 0 calc((100% - 42px) / 8);"></i>`;
          }).join('');
          return `<div class="myact-hero-bars" role="img" aria-label="${isTeacher ? 'Average score per item' : 'My score per item'}" style="opacity:.75;">${bars}</div>
            <div class="text-[11px] text-blue-100" style="margin-top:8px;">${isTeacher ? 'Class average per item' : 'My score per item'}, latest ${vals.length}</div>`;
        }
        function classHeroHTML(stats, isTeacher, series){
          return `
            <div class="rounded-3xl p-5 text-white stat-hero-pill" style="background:linear-gradient(135deg,${ROYAL},${NAVY});position:relative;overflow:hidden;">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs text-blue-200 font-semibold uppercase tracking-wide">${isTeacher ? 'Your class at a glance' : 'Your progress at a glance'}</div>
                  <div class="flex gap-5" style="margin-top:12px;">
                    ${stats.map(t => `<div><div class="text-2xl font-bold font-display" style="line-height:1;">${t.v}</div><div class="text-[11px] text-blue-100">${t.l}</div></div>`).join('')}
                  </div>
                </div>
                <button type="button" onclick="downloadClassReport()" aria-label="${isTeacher ? 'Download class report' : 'Download my report'}" class="myact-dl-circle class-report-dl">${Icon('download','w-5 h-5')}</button>
              </div>
              ${classHeroBarsHTML(series, isTeacher)}
            </div>`;
        }
        function classPanelsHTML(tiles){
          return `<div class="flex gap-3">${tiles.map(t => `<div class="flex-1 bg-white rounded-2xl px-4 py-3 shadow-sm"><div class="font-bold text-lg font-display" style="color:${t.c};line-height:1.1;">${t.v}</div><div class="text-[11px] text-gray-400" style="margin-top:2px;">${t.l}</div></div>`).join('')}</div>`;
        }
        function classSubPageHeroHTML(cls, tab, isTeacher){
          if (tab === 'profile') {
            const A = classAnalytics(cls);
            return classHeroHTML([
              { v: A.joined.length, l: 'Students' },
              { v: A.work.length, l: 'Classwork' },
              { v: A.interactions, l: 'Interactions' },
            ], true, A.perItem.map(i => i.avg)) + `<div style="height:16px;"></div>` + classPanelsHTML([
              { v: A.callLog.length, l: 'Calls held', c: CLS_COLORS.green },
              { v: A.average !== null ? A.average + '%' : '--', l: 'Class average', c: CLS_COLORS.sky },
              { v: A.completion !== null ? A.completion + '%' : '--', l: 'Handed in', c: CLS_COLORS.amber },
            ]);
          }
          const R = classMyReport(cls);
          const A = classAnalytics(cls);
          return classHeroHTML([
            { v: R.overall !== null ? R.overall + '%' : '--', l: 'Score' },
            { v: R.submitted + '/' + R.total, l: 'Handed in' },
            { v: R.graded, l: 'Graded' },
          ], false, R.items.filter(i => i.percent !== null).map(i => i.percent)) + `<div style="height:16px;"></div>` + classPanelsHTML([
            { v: A.average !== null ? A.average + '%' : '--', l: 'Class average', c: CLS_COLORS.gray },
            { v: R.submitted, l: 'Handed in', c: CLS_COLORS.green },
            { v: Math.max(0, R.total - R.submitted), l: 'Still to do', c: CLS_COLORS.amber },
          ]);
        }

        function classSubPageHTML(cls){
          const isTeacher = cls.role === 'teacher';
          let tab = classDetailTab;
          if (tab === 'profile' && !isTeacher) tab = 'report';
          if (tab === 'report' && isTeacher) tab = 'profile';
          const title = tab === 'people' ? 'People' : (tab === 'profile' ? 'Class profile' : 'Class report');
          const body = tab === 'people' ? classPeopleTabHTML(cls) : (tab === 'profile' ? classProfileBodyHTML(cls) : classMyReportBodyHTML(cls));
          const hasFooter = tab !== 'people';
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto no-scrollbar" style="padding-bottom:${hasFooter ? 0 : 50}px;">
                ${overlayHeader(title, 'var(--top-safe-pad)', 'classSubPageBack()', null, { right: true, pb: '20px', titleSize: 'text-3xl' })}
                <div class="px-5">
                  ${hasFooter ? `<div class="text-sm text-gray-400 text-center" style="margin-bottom:14px;">${escapeHtml(cls.name)}${cls.section ? ' &middot; ' + escapeHtml(cls.section) : ''}</div><div style="margin-bottom:20px;">${classSubPageHeroHTML(cls, tab, isTeacher)}</div>` : ''}
                  ${body}
                  ${hasFooter ? `
                  <button id="class-report-dl-btn" type="button" onclick="downloadClassReport()" class="myact-dl-pill">${Icon('download','w-5 h-5')}<span>${isTeacher ? 'Download class report' : 'Download my report'}</span></button>
                  <div class="text-[11px] text-gray-400 text-center" style="padding:10px 0 max(24px, env(safe-area-inset-bottom));">Saves this report as a PDF on your device.</div>` : ''}
                </div>
              </div>
            </div>`;
        }

        // ---- Downloadable class report (PDF with grades, ranking and graphs) ----
        async function downloadClassReport(){
          if (typeof dlCancelActive === 'function' && dlCancelActive()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const btns = Array.from(document.querySelectorAll('#class-report-dl-btn, .class-report-dl'));
          const labels = btns.map(b => b.innerHTML);
          const prog = (typeof dlProgressStart === 'function') ? dlProgressStart(btns) : { to(){}, finish: async () => {}, stop(){} };
          try {
            if (typeof loadJsPdfLib !== 'function') throw new Error('PDF library unavailable');
            const jsPDF = await loadJsPdfLib();
            prog.to(40);
            if (typeof loadColmeakPdfFont === 'function') await loadColmeakPdfFont();
            prog.to(75);
            await new Promise(r => setTimeout(r, 80));
            if (prog.cancelled) return;
            buildClassReportPdf(jsPDF, cls);
            await prog.finish();
          } catch (e) {
            prog.stop();
            console.warn('Class report PDF failed:', e);
            if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't prepare your PDF. Check your connection and try again.");
          } finally {
            // the shared download helper puts the buttons back
          }
        }

        function buildClassReportPdf(jsPDF, cls){
          const isTeacher = cls.role === 'teacher';
          const A = classAnalytics(cls);
          const doc = new jsPDF({ unit: 'mm', format: 'a4' }); pdfWatermarkInit(doc);
          const PW = 210, PH = 297, M = 14, CW = PW - M * 2, BOTTOM = PH - 18;
          let y = 0;
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
          const typeface = display => (display && useColmeak) ? 'Colmeak' : (useMont ? 'Montserrat' : (useColmeak ? 'Colmeak' : 'helvetica'));
          const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
          const fill = h => doc.setFillColor(...rgb(h));
          const stroke = h => doc.setDrawColor(...rgb(h));
          const color = h => doc.setTextColor(...rgb(h));
          const font = (size, bold, display) => { doc.setFont(typeface(display), bold ? 'bold' : 'normal'); doc.setFontSize(size); };
          const ensure = h => { if (y + h > BOTTOM) { doc.addPage(); y = 18; } };
          const clip = (s, w) => { const t = doc.splitTextToSize(txt(s), w); return t[0] || ''; };
          const C = CLS_COLORS;

          // ---- header: plain background, centered title (same layout as My Activity) ----
          const X = isTeacher ? classExtras(cls, A) : null;
          const R = isTeacher ? null : classMyReport(cls);
          const S = isTeacher ? null : classStudentExtras(cls, R, A);
          color('#000000'); font(32, true, true); doc.text('CLASS REPORT', PW / 2, 24, { align: 'center' });
          const who = [txt(cls.name + (cls.section ? ' - ' + cls.section : '')), isTeacher ? '' : txt(profileData && profileData.name)].filter(Boolean).join('  ·  ');
          color('#000000'); font(11, false, true);
          if (who) doc.text(clip(who, CW), PW / 2, 33, { align: 'center' });
          color('#6b7280'); font(9, false);
          doc.text('Generated ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), PW / 2, 40, { align: 'center' });

          // ---- one short paragraph about this class and this document, before the numbers and
          // charts ----
          const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
          const intro = isTeacher
            ? (`This Class Report is a summary of how ${cls.name} is going on Stitch: who has joined, the classwork you have posted, how students are scoring, who is handing work in, and how much the class talks and meets. `
              + `${cls.name} has ${plural(A.joined.length, 'student')} who have joined and ${plural(A.work.length, 'piece')} of classwork`
              + (A.average !== null ? `, with a class average of ${A.average}%${A.ranked.length ? ' and ' + A.ranked[0].name + ' at the top with ' + A.ranked[0].overall + '%' : ''}. ` : ', and nothing has been graded yet. ')
              + `This document is a snapshot saved on the date above, so every number reflects the class at that moment and will change as you keep teaching.`)
            : (`This Class Report is a summary of your own results in ${cls.name} on Stitch: what you have handed in, how you scored on each item, and how you compare with the rest of the class. `
              + `You have handed in ${R.submitted} of ${R.total} assignment${R.total === 1 ? '' : 's'} and quizzes`
              + (R.overall !== null ? `, with an overall score of ${R.overall}%${A.average !== null ? ' against a class average of ' + A.average + '%' : ''}. ` : ', and nothing has been graded yet. ')
              + `This document is a snapshot saved on the date above, so every number reflects your results at that moment.`);
          color('#4b5563'); font(9, false);
          const introLines = doc.splitTextToSize(txt(intro), CW);
          doc.text(introLines, M, 51, { lineHeightFactor: 1.5 });
          y = 51 + introLines.length * 5.2 + 5;

          const section = (hex, title, sub, need) => {
            y += 6; ensure(need || 50);
            stroke('#e5e7eb'); doc.setLineWidth(0.3); doc.line(M, y - 3, M + CW, y - 3);
            color('#000000'); font(12.5, true, true); doc.text(txt(title), M, y + 2.6); y += 7;
            if (sub) { color('#9ca3af'); font(8.5, false); doc.text(txt(sub), M, y + 1); y += 5; }
            y += 3;
          };
          const para = t => { color('#4b5563'); font(9, false); const l = doc.splitTextToSize(txt(t), CW); doc.text(l, M, y + 2, { lineHeightFactor: 1.5 }); y += l.length * 5 + 3; };
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
          const bars = (items, h, max) => {
            h = h || 34; ensure(h + 18);
            const mx = max || Math.max(1, ...items.map(i => i.value)), n = items.length, slot = CW / n, bw = Math.min(14, slot * 0.55);
            stroke('#e5e7eb'); doc.setLineWidth(0.25); doc.line(M, y + 5 + h, M + CW, y + 5 + h);
            items.forEach((it, i) => {
              const bh = it.value ? Math.max(1.5, it.value / mx * h) : 0.8, x = M + i * slot + (slot - bw) / 2;
              fill(it.value ? (it.color || C.sky) : '#e5e7eb'); doc.roundedRect(x, y + 5 + h - bh, bw, bh, 1, 1, 'F');
              if (it.value) { color('#374151'); font(7.5, true); doc.text(txt(it.display != null ? it.display : it.value), x + bw / 2, y + 3.5 + h - bh, { align: 'center' }); }
              color('#9ca3af'); font(6.5, false); doc.text(clip(it.label, slot - 1), x + bw / 2, y + h + 10, { align: 'center' });
            });
            y += h + 15;
          };
          const hbars = items => {
            items.forEach(it => {
              ensure(12);
              color('#374151'); font(9, false); doc.text(clip((it.rank ? it.rank + '. ' : '') + it.label, CW - 24), M, y + 3);
              color('#000000'); font(9, true); doc.text(txt(it.display), M + CW, y + 3, { align: 'right' });
              fill('#eef0f4'); doc.roundedRect(M, y + 5, CW, 2.4, 1.2, 1.2, 'F');
              const w = Math.max(0, Math.min(100, it.value)) / 100 * CW;
              if (w > 0) { fill(it.color || C.sky); doc.roundedRect(M, y + 5, Math.max(w, 2.4), 2.4, 1.2, 1.2, 'F'); }
              y += 11;
            });
          };
          const table = (cols, rowsData) => {
            const head = () => { color('#9ca3af'); font(7.5, true); cols.forEach(c => doc.text(txt(c.h), c.align === 'right' ? c.x + c.w : c.x, y + 3, { align: c.align || 'left' })); stroke('#e5e7eb'); doc.setLineWidth(0.25); doc.line(M, y + 5, M + CW, y + 5); y += 8; };
            ensure(16); head();
            rowsData.forEach(r => {
              if (y + 7 > BOTTOM) { doc.addPage(); y = 18; head(); }
              cols.forEach(c => {
                const v = r[c.k];
                const top = r._top;
                color(top ? '#111827' : '#374151'); font(8.5, !!top);
                doc.text(clip(v == null ? '' : v, c.w - 2), c.align === 'right' ? c.x + c.w : c.x, y + 3, { align: c.align || 'left' });
              });
              stroke('#f3f4f6'); doc.setLineWidth(0.2); doc.line(M, y + 5, M + CW, y + 5);
              y += 7;
            });
            y += 4;
          };
          const sub2 = t => { ensure(48); color('#000000'); font(9.5, true, true); doc.text(txt(t), M, y + 2); y += 7; };
          const sector = (cx, cy, r, a0, a1) => {
            const pts = [[cx, cy]], steps = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 36)));
            for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
            const rel = []; for (let i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]]);
            doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'FD', true);
          };
          const pie = (slices, emptyMsg) => {
            const live = slices.filter(s => s.value > 0), total = live.reduce((t, x) => t + x.value, 0);
            if (!total) { empty(emptyMsg || 'Nothing here yet.'); return; }
            ensure(42);
            const r = 17, cx = M + r + 2, cy = y + r + 2;
            doc.setLineWidth(0.5); stroke('#ffffff');
            if (live.length === 1) { fill(live[0].color); doc.circle(cx, cy, r, 'FD'); }
            else { let a = -Math.PI / 2; live.forEach(sl => { const a1 = a + (sl.value / total) * Math.PI * 2; fill(sl.color); sector(cx, cy, r, a, a1); a = a1; }); }
            let ly = cy - (slices.length * 7) / 2 + 3;
            slices.forEach(sl => {
              fill(sl.color); doc.circle(M + 52, ly - 1, 1.7, 'F');
              color('#374151'); font(9.5, false); doc.text(clip(sl.label, 50), M + 57, ly);
              color('#6b7280'); font(9.5, true); doc.text(sl.value + '  (' + Math.round(sl.value / total * 100) + '%)', M + CW, ly, { align: 'right' });
              ly += 7;
            });
            y += r * 2 + 8;
          };
          const lines = (lbls, series, h) => {
            h = h || 34; ensure(h + 22);
            const all = series.flatMap(sr => sr.values), max = Math.max(1, ...all), n = lbls.length;
            const x0 = M + 6, w = CW - 10, y0 = y + 4, base = y0 + h;
            stroke('#e5e7eb'); doc.setLineWidth(0.25);
            [0, 0.5, 1].forEach(f => doc.line(M, base - f * h, M + CW, base - f * h));
            color('#9ca3af'); font(7, false); doc.text(String(max), M, y0 - 1);
            const xAt = i => n === 1 ? x0 + w / 2 : x0 + i * w / (n - 1), yAt = v => base - (v / max) * h;
            series.forEach(sr => {
              stroke(sr.color); doc.setLineWidth(0.9);
              for (let i = 1; i < n; i++) doc.line(xAt(i - 1), yAt(sr.values[i - 1]), xAt(i), yAt(sr.values[i]));
              fill(sr.color); sr.values.forEach((v, i) => doc.circle(xAt(i), yAt(v), 1.1, 'F'));
            });
            color('#9ca3af'); font(7, false); lbls.forEach((l, i) => doc.text(txt(l), xAt(i), base + 5, { align: 'center' }));
            y = base + 8;
            if (series.length > 1) {
              let lx = M; font(8, false);
              series.forEach(sr => { fill(sr.color); doc.circle(lx + 1.5, y + 0.8, 1.5, 'F'); color('#4b5563'); doc.text(txt(sr.name), lx + 5, y + 2); lx += 8 + doc.getTextWidth(txt(sr.name)) + 6; });
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
          const listRows = (rows, accent) => {
            rows.forEach(r => {
              ensure(10);
              color('#374151'); font(9.5, true); doc.text(clip(r.title, CW - 50), M, y + 3);
              if (r.sub) { color('#9ca3af'); font(8, false); doc.text(clip(r.sub, CW - 50), M, y + 7.2); }
              color('#000000'); font(9.5, true); doc.text(txt(r.right), M + CW, y + 3, { align: 'right' });
              stroke('#f3f4f6'); doc.setLineWidth(0.2); doc.line(M, y + (r.sub ? 9.6 : 6), M + CW, y + (r.sub ? 9.6 : 6));
              y += r.sub ? 11 : 8;
            });
            y += 2;
          };

          const gc = { A: C.green, B: C.sky, C: C.amber, D: '#f97316', F: C.red };
          if (isTeacher) {
            tiles([
              { v: A.joined.length, l: 'Students joined', c: C.sky },
              { v: A.average !== null ? A.average + '%' : '--', l: 'Class average', c: C.green },
              { v: A.completion !== null ? A.completion + '%' : '--', l: 'Work handed in', c: C.amber },
              { v: A.work.length, l: 'Classwork posted', c: C.purple },
            ]);

            section(C.sky, 'Who joined', 'Students in the class compared with people still to join', 50);
            pie([
              { label: 'Joined', value: A.joined.length, color: C.sky },
              { label: 'Invited, not joined', value: A.invited.length, color: C.amber },
              { label: 'Join requests', value: A.requests, color: C.purple },
            ], 'Nobody has joined yet.');

            if (X.W) {
              section(C.blue, 'Class activity', 'Announcements and calls, last 8 weeks', 90);
              bars(X.W.labels.map((l, i) => ({ label: l, value: X.W.ann[i], color: C.blue })), 32);
              sub2('Call minutes per week');
              lines(X.W.labels, [{ name: 'Call minutes', color: C.green, values: X.W.calls }], 30);
            }

            section(C.amber, 'Classwork posted', 'What has been posted so far', 60);
            bars([
              { label: 'Assign.', value: A.byType.assignment, color: C.sky },
              { label: 'Quiz', value: A.byType.quiz, color: C.purple },
              { label: 'Question', value: A.byType.question, color: C.cyan },
              { label: 'Poll', value: A.byType.poll, color: C.amber },
              { label: 'Material', value: A.byType.material, color: C.green },
            ], 32);

            section(C.green, 'Handed in vs missing', 'Turn-ins across every student and every assignment or quiz', 50);
            pie([
              { label: 'Handed in', value: A.done, color: C.green },
              { label: 'Missing', value: Math.max(0, A.possible - A.done), color: C.amber },
            ], 'Nothing to hand in yet.');

            section(C.amber, 'Who is topping the class', 'Ranked by overall average on graded assignments and quizzes', 40);
            if (!A.ranked.length) empty('Nobody has a graded score yet.');
            else {
              const medal = ['#f59e0b', '#9ca3af', '#b45309'];
              A.ranked.slice(0, 3).forEach((r, i) => {
                ensure(12);
                fill(medal[i]); doc.circle(M + 3.5, y + 4, 3.5, 'F');
                color('#ffffff'); font(9, true); doc.text(String(i + 1), M + 3.5, y + 5.2, { align: 'center' });
                color('#111827'); font(10.5, true); doc.text(clip(r.name, CW - 40), M + 11, y + 5);
                color('#000000'); font(10.5, true); doc.text(r.overall + '%', M + CW, y + 5, { align: 'right' });
                y += 11;
              });
              y += 3;
            }

            section(C.blue, 'Grades by student', 'Every student, highest first', 40);
            const tableRows = A.ranked.map((r, i) => ({ rank: i + 1, name: r.name, avg: r.overall + '%', grade: classGradeLetter(r.overall), done: r.submitted + '/' + r.total, _top: i === 0 }))
              .concat(A.unranked.map(r => ({ rank: '-', name: r.name, avg: '--', grade: '-', done: r.submitted + '/' + r.total })));
            if (!tableRows.length) empty('No students have joined yet.');
            else table([
              { k: 'rank', h: 'RANK', x: M, w: 14 },
              { k: 'name', h: 'STUDENT', x: M + 14, w: CW - 14 - 70 },
              { k: 'avg', h: 'AVERAGE', x: M + CW - 70, w: 22, align: 'right' },
              { k: 'grade', h: 'GRADE', x: M + CW - 46, w: 20, align: 'right' },
              { k: 'done', h: 'HANDED IN', x: M + CW - 24, w: 24, align: 'right' },
            ], tableRows);

            section(C.purple, 'Grade distribution', 'Students per grade (A 80+, B 70+, C 60+, D 50+, F below 50)', 60);
            bars(['A', 'B', 'C', 'D', 'F'].map(g => ({ label: g, value: A.dist[g], color: gc[g] })), 32);
            sub2('Every student, plotted (higher = better average, gold = top student)');
            scatter(X.pts, 'Lowest', 'Highest', 'Students will be plotted here once they have graded work.');

            if (A.perItem.length) {
              section(C.sky, 'Average score by classwork', null, 40);
              hbars(A.perItem.slice(0, 20).map(i => ({ label: i.title, value: i.avg, display: i.avg + '%', color: C.sky })));
            }
            if (X.typeRows.length > 1) {
              section(C.cyan, 'Average by kind of work', 'Quizzes, questions and assignments compared', 40);
              hbars(X.typeRows);
            }

            section(C.red, 'Interactions', 'How students engaged with the class', 60);
            bars([
              { label: 'Comments', value: A.comments, color: C.sky },
              { label: 'Turn-ins', value: A.submissions, color: C.green },
              { label: 'Quiz tries', value: A.quizAttempts, color: C.purple },
              { label: 'Poll votes', value: A.pollVotes, color: C.amber },
            ], 32);

            section(C.green, 'Calls', 'Live lectures and calls', 40);
            tiles([
              { v: A.callLog.length, l: 'Calls held', c: C.green },
              { v: classFmtDuration(A.callSeconds), l: 'Total call time', c: C.sky },
              { v: A.upcoming, l: 'Scheduled', c: C.amber },
            ]);

            if (X.attention.length) {
              section(C.red, 'Worth a check-in', 'Students under 60% or with nothing handed in', 40);
              listRows(X.attention.map(r => ({ title: r.name, right: r.note })), C.red);
            }
            if (X.poll) {
              section(C.amber, 'Latest poll', txt(X.poll.title || 'Poll') + '  -  ' + plural(X.pollTotal, 'vote'), 40);
              if (X.pollTotal) hbars(X.pollRows); else empty('No votes yet.');
            }
          } else {
            tiles([
              { v: R.overall !== null ? R.overall + '%' : '--', l: 'My overall score', c: C.sky },
              { v: A.average !== null ? A.average + '%' : '--', l: 'Class average', c: C.gray },
              { v: R.submitted + '/' + R.total, l: 'Work handed in', c: C.green },
              { v: R.graded, l: 'Items graded', c: C.purple },
            ]);

            section(C.amber, 'Where I stand', 'Compared with the rest of the class', 40);
            tiles([
              { v: S.rank ? S.rank + ' of ' + A.ranked.length : '--', l: 'My rank', c: C.amber },
              { v: R.overall !== null ? classGradeLetter(R.overall) : '--', l: 'My grade', c: C.sky },
              { v: S.best !== null ? S.best + '%' : '--', l: 'Best score', c: C.green },
              { v: S.worst !== null ? S.worst + '%' : '--', l: 'Lowest score', c: C.red },
            ]);

            section(C.green, 'My progress', 'Handed in compared with still to do', 50);
            pie([
              { label: 'Handed in', value: R.submitted, color: C.green },
              { label: 'Not yet', value: Math.max(0, R.total - R.submitted), color: C.amber },
            ], 'No assignments or quizzes yet.');

            section(C.sky, 'My scores', 'Percent on each graded item', 60);
            if (!S.scored.length) empty('Your graded work will show up here.');
            else bars(S.scored.slice(-10).map(i => ({ label: i.title, value: i.percent, display: i.percent + '%', color: C.sky })), 34, 100);

            if (S.recent.length >= 2) {
              section(C.blue, 'Me and the class, item by item', 'Items in order, oldest to newest', 60);
              lines(S.recent.map((_, i) => String(i + 1)), [
                { name: 'Me', color: C.sky, values: S.recent.map(i => i.percent) },
                { name: 'Class average', color: C.gray, values: S.recent.map(i => i.classAvg != null ? i.classAvg : 0) },
              ], 34);
            }

            section(C.purple, 'What I have handed in', 'By kind of work', 50);
            pie(S.typeSlices, 'Nothing handed in yet.');

            if (R.overall !== null && A.average !== null) {
              section(C.cyan, 'Me and the class', null, 30);
              hbars([{ label: 'You', value: R.overall, display: R.overall + '%', color: C.sky }, { label: 'Class average', value: A.average, display: A.average + '%', color: C.gray }]);
            }

            if (S.todo.length) {
              section(C.amber, 'Still to do', 'Not handed in yet', 30);
              listRows(S.todo.map(i => ({ title: i.title, sub: i.type + (i.due ? '  -  Due ' + i.due : ''), right: 'To do' })), C.amber);
            }

            section(C.red, 'My classwork', 'Every assignment and quiz', 40);
            if (!R.items.length) empty('Nothing has been assigned yet.');
            else table([
              { k: 'title', h: 'TITLE', x: M, w: CW - 90 },
              { k: 'type', h: 'TYPE', x: M + CW - 90, w: 24 },
              { k: 'due', h: 'DUE', x: M + CW - 66, w: 24 },
              { k: 'status', h: 'SCORE', x: M + CW - 42, w: 42, align: 'right' },
            ], R.items.map(i => ({ title: i.title, type: i.type, due: i.due || '--', status: i.status })));
          }

          const pages = doc.getNumberOfPages();
          for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            color('#9ca3af'); font(7.5, false);
            // Footer brand: the Stitch logo + wordmark in black (same size as the old text), then the
            // document name
            try {
              const LW = 12, LH = LW * 204 / 500;
              doc.addImage('data:image/png;base64,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', 'PNG', M, PH - 9 - 0.95 - LH * 0.52, LW, LH, 'stitch-logo', 'FAST');
              doc.text('-  Class Report', M + LW + 1.5, PH - 9);
            } catch (e) {
              doc.text('Stitch  -  Class Report', M, PH - 9);
            }
            doc.text('Page ' + i + ' of ' + pages, PW - M, PH - 9, { align: 'right' });
          }
          const slug = txt(cls.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'class';
          doc.save((isTeacher ? 'class-report-' : 'my-class-report-') + slug + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
        }

        function classDashboardTabHTML(cls){
          const totalStudents = cls.students.length;
          const totalClasswork = cls.classwork.length;
          const totalAnnouncements = cls.announcements.length;
          const totalCoTeachers = (cls.coTeachers || []).length;
          return `
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Overview</div>
            <div class="grid grid-cols-2 gap-4 mb-5">
              ${statCard('users','Students', String(totalStudents), 'bg-blue-50', "classDetailSwitchTab('people')")}
              ${statCard('doc','Classwork', String(totalClasswork), 'bg-amber-100', "classDetailSwitchTab('classwork')")}
              ${statCard('comment','Announcements', String(totalAnnouncements), 'bg-rose-100', "classDetailSwitchTab('stream')")}
              ${statCard('personPlus','Co-teachers', String(totalCoTeachers), 'bg-purple-100', "classDetailSwitchTab('people')")}
            </div>`;
        }

        // ---- Class stream tab (announcements + comments) ----
        function formatClassStreamTime(item){
          if (item.createdAt) return formatNotifTime(item.createdAt);
          return item.time || 'now';
        }

        let classStreamTimeTickInterval = null;
        function startClassStreamTimeTicker(){
          if (classStreamTimeTickInterval) return;
          classStreamTimeTickInterval = setInterval(() => {
            const cls = (typeof myClasses !== 'undefined') ? myClasses.find(c => c.id === currentClassId) : null;
            if (!cls) return;
            document.querySelectorAll('[data-announcement-time]').forEach(el => {
              const a = cls.announcements.find(x => x.id === el.getAttribute('data-announcement-time'));
              if (a) el.textContent = formatClassStreamTime(a);
            });
            document.querySelectorAll('[data-comment-time]').forEach(el => {
              const [announcementId, commentId] = el.getAttribute('data-comment-time').split(':');
              const a = cls.announcements.find(x => x.id === announcementId);
              const c = a && (a.comments || []).find(x => x.id === commentId);
              if (c) {
                el.innerHTML = `<span class="font-semibold text-gray-700">${escapeHtml(c.name)}</span> · ${formatClassStreamTime(c)}`;
              }
            });
          }, 30000);
        }

        function classStreamTabHTML(cls){
          startClassStreamTimeTicker();
          return `
            ${classLecturesListHTML(cls)}
            <div class="flex gap-2 mb-6">
              <button onclick="openNewAnnouncementOverlay()" class="flex-1 flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">New announcement</button>
            </div>
            ${cls.announcements.length ? cls.announcements.map(a => `
              <div class="bg-white rounded-3xl p-4 mb-3 shadow-sm">
                ${a.repostOf ? `
                <div class="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-2.5">
                  ${Icon('repost','w-3.5 h-3.5')} ${escapeHtml(a.repostedByName || 'You')} reposted
                </div>` : ''}
                <div class="flex items-center gap-3 mb-2.5">
                  <span class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0 overflow-hidden">${classTeacherAvatarHTML(cls,'w-5 h-5')}</span>
                  <div class="min-w-0">
                    <div class="font-semibold text-sm text-gray-800 truncate">${classTeacherDisplayName(cls)}</div>
                    <div class="text-xs text-gray-400" data-announcement-time="${a.id}">${formatClassStreamTime(a)}</div>
                  </div>
                  <div class="ml-auto flex flex-col items-end gap-3 flex-shrink-0">
                    <button onclick="repostAnnouncement('${a.id}')" id="announcement-repost-${a.id}" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 font-semibold text-xs ${(a.repostCount > 0) ? 'text-white' : 'border border-gray-200 text-gray-500'}" style="${(a.repostCount > 0) ? `background:${NAVY};` : ''}">
                      ${Icon('repost','w-3.5 h-3.5')} ${a.repostCount > 0 ? `Reposted${a.repostCount > 1 ? ' (' + a.repostCount + ')' : ''}` : 'Repost'}
                    </button>
                    ${cls.role === 'teacher' ? `<button onclick="deleteClassAnnouncement('${a.id}')" title="Delete announcement" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-gray-400 border border-gray-200">${Icon('trash','w-3.5 h-3.5')}</button>` : ''}
                  </div>
                </div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">${escapeHtml(a.text)}</div>
                ${announcementAttachmentsDisplayHTML(a)}
                ${streamAnnouncementCommentsHTML(a)}
              </div>`).join('') : `
              <div class="flex flex-col items-center text-center py-10">
                <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('comment','w-9 h-9')}</div>
                <div class="font-bold text-gray-700 mb-1">This is where you can talk to your class</div>
                <div class="text-sm text-gray-400 leading-relaxed">Use the stream to share announcements, post assignments, and respond to questions</div>
              </div>`}`;
        }

        function announcementAttachmentsDisplayHTML(a){
          if (!a.attachments || !a.attachments.length) return '';
          const images = a.attachments.filter(f => isImageAttachmentFile(f));
          const files = a.attachments.filter(f => !isImageAttachmentFile(f));
          return `
            ${images.length ? `
            <div class="flex items-center gap-2 overflow-x-auto pb-1 mb-3">
              ${images.map(f => `
                <img src="${escapeHtml(f.url)}" onclick="openClassworkImage('${escapeHtml(f.url)}')" class="rounded-xl object-cover flex-shrink-0 cursor-pointer" style="width:96px;height:96px;">`).join('')}
            </div>` : ''}
            ${files.length ? `
            <div class="flex items-center gap-2 overflow-x-auto pb-1 mb-3">
              ${files.map(f => `
                <a href="${escapeHtml(f.url)}" target="_blank" rel="noopener" class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-3 py-1 flex-shrink-0 text-inherit">
                  <span class="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('doc','w-3.5 h-3.5')}</span>
                  <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(f.name)}</span>
                </a>`).join('')}
            </div>` : ''}`;
        }

        function streamAnnouncementCommentsHTML(a){
          const comments = a.comments || [];
          return `
            <div class="border-t border-gray-100 pt-3">
              ${comments.length ? `
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Class comments</div>
                <div class="space-y-2.5 mb-3">
                  ${comments.map(c => `
                    <div class="flex items-start gap-2.5">
                      <span class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0 overflow-hidden">${(c.name === 'You') ? avatarMediaHTML(profileData.photo, 'user', 'w-3.5 h-3.5') : Icon('user','w-3.5 h-3.5')}</span>
                      <div class="min-w-0">
                        <div class="text-xs text-gray-400" data-comment-time="${a.id}:${c.id || ''}"><span class="font-semibold text-gray-700">${escapeHtml(c.name)}</span> · ${formatClassStreamTime(c)}</div>
                        <div class="text-sm text-gray-700 leading-snug">${escapeHtml(c.text)}</div>
                      </div>
                    </div>`).join('')}
                </div>` : ''}
              <div class="flex items-end gap-2">
                <textarea id="stream-comment-input-${a.id}" placeholder="Add class comment" rows="1" oninput="this.style.height='auto'; this.style.height=this.scrollHeight+'px';" onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); addStreamComment('${a.id}'); }" class="flex-1 min-w-0 bg-gray-100 rounded-3xl px-4 py-2 text-sm resize-none overflow-hidden" style="max-height:140px;"></textarea>
                <button onclick="addStreamComment('${a.id}')" class="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
              </div>
            </div>`;
        }

        // Reposting an announcement duplicates it back to the top of the class stream (marked with
        // a small "reposted" badge, like sharing a post again) so it visibly shows up again for
        function repostAnnouncement(announcementId){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const a = (cls.announcements || []).find(x => x.id === announcementId);
          if (!a) return;
          const repostEntry = {
            id: 'a-' + Date.now() + Math.random().toString(36).slice(2, 6),
            text: a.text,
            attachments: a.attachments ? a.attachments.slice() : undefined,
            createdAt: Date.now(),
            comments: [],
            repostOf: a.id,
            repostedByName: (typeof profileData !== 'undefined' && profileData.name) ? profileData.name : 'You',
          };
          cls.announcements.unshift(repostEntry);
          const post = PostsAPI.create({
            avatarIcon:'bell', avatarBg:'bg-blue-50', name:classTeacherDisplayName(cls),
            meta: cls.name + ' · Announcement', tag:'Announcement', tagClass:`bg-blue-50 text-[${NAVY}]`,
            timeAgo:'Just now',
            body: a.text, mediaHtml:null,
            reposts:1, reposted:true
          });
          a.repostCount = (a.repostCount || 0) + 1;
          if (!a.repostFeedIds) a.repostFeedIds = [];
          post.then(p => { if (p) a.repostFeedIds.push(p.id); });
          document.getElementById('overlay').innerHTML = classDetailHTML();
          renderFeed();
          if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          queueSaveClassRemote(cls);
        }

        // ---- Delete announcement (teacher only) ----
        let deleteAnnouncementPendingId = null;
        function deleteClassAnnouncement(announcementId){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const a = (cls.announcements || []).find(x => x.id === announcementId);
          if (!a) return;
          deleteAnnouncementPendingId = announcementId;
          openLeaveClassModal(confirmDeleteClassAnnouncement, 'Delete this announcement?', 'This will remove it from the class stream for everyone. This cannot be undone.', 'trash');
        }
        function confirmDeleteClassAnnouncement(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const announcementId = deleteAnnouncementPendingId;
          deleteAnnouncementPendingId = null;
          if (!cls || !announcementId) return;
          const idx = (cls.announcements || []).findIndex(x => x.id === announcementId);
          if (idx === -1) return;
          const [removed] = cls.announcements.splice(idx, 1);
          // Also remove any feed posts that were created by reposting this announcement.
          if (removed) {
            if (removed.repostFeedIds && removed.repostFeedIds.length) {
              removed.repostFeedIds.forEach(id => PostsAPI.remove(id));
            } else if (removed.repostFeedId) {
              PostsAPI.remove(removed.repostFeedId);
            }
          }
          document.getElementById('overlay').innerHTML = classDetailHTML();
          renderFeed();
          if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          queueSaveClassRemote(cls);
        }

        function addStreamComment(announcementId){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const a = cls.announcements.find(x => x.id === announcementId);
          if (!a) return;
          const input = document.getElementById('stream-comment-input-' + announcementId);
          const text = input ? input.value.trim() : '';
          if (!text) return;
          if (!a.comments) a.comments = [];
          a.comments.push({ id: 'c-' + Date.now() + Math.random().toString(36).slice(2, 6), name: 'You', text, createdAt: Date.now() });
          if (input) { input.value = ''; input.style.height = 'auto'; }
          document.getElementById('overlay').innerHTML = classDetailHTML();
          queueSaveClassRemote(cls);
        }

        // ---- Live lecture list + invite links ----
        function lectureActionPillsHTML(){
          return `
            <div class="flex gap-2 mb-4">
              <button onclick="startLiveLectureNow()" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-white border border-gray-300">${Icon('video','w-4 h-4')} Start Lecture</button>
              <button onclick="openScheduleLectureOverlay()" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-white border border-gray-300">${Icon('calendar','w-4 h-4')} Schedule Lecture</button>
            </div>`;
        }

        function classLecturesListHTML(cls){
          const lectures = (cls.lectures || []).filter(l => !lectureIsExpired(l));
          if (!lectures.length) return '';
          const isTeacher = cls.role === 'teacher';
          const sorted = [...lectures].sort((a,b) => (b.status === 'live') - (a.status === 'live') || (a.date+a.time).localeCompare(b.date+b.time));
          return `
            <div class="mb-5">
              ${sorted.map(l => lectureCardHTML(l, isTeacher)).join('')}
            </div>`;
        }


        // ---- Scheduled lecture countdown ----
        const LECTURE_AUTO_START_GRACE_MS = 10 * 60 * 1000;
        const LECTURE_ALERT_MILESTONES = [
          { ms: 60 * 60 * 1000, label: '1 hour' },
          { ms: 15 * 60 * 1000, label: '15 minutes' },
          { ms: 5 * 60 * 1000, label: '5 minutes' },
          { ms: 60 * 1000, label: '1 minute' },
        ];
        function lectureStartMs(l){
          if (!l || !l.date || !l.time) return NaN;
          const t = new Date(l.date + 'T' + l.time + ':00').getTime();
          return t;
        }
        function formatLectureCountdown(ms){
          if (ms <= 0) return 'Starting...';
          let s = Math.floor(ms / 1000);
          const d = Math.floor(s / 86400); s -= d * 86400;
          const h = Math.floor(s / 3600); s -= h * 3600;
          const m = Math.floor(s / 60); s -= m * 60;
          const pad = n => String(n).padStart(2, '0');
          if (d > 0) return d + 'd ' + h + 'h ' + pad(m) + 'm ' + pad(s) + 's';
          if (h > 0) return h + 'h ' + pad(m) + 'm ' + pad(s) + 's';
          return m + 'm ' + pad(s) + 's';
        }
        // Plain two-line text (no pill): "Call starts in" on top, the live countdown below it.
        function lectureCountdownInnerHTML(ms){
          return `<span style="display:block;">Call starts in</span><span style="display:block;">${escapeHtml(formatLectureCountdown(ms))}</span>`;
        }
        function lectureCountdownPillHTML(l){
          const left = lectureStartMs(l) - Date.now();
          const overdue = left < -LECTURE_AUTO_START_GRACE_MS;
          return `<span data-lecture-countdown="${l.id}" class="text-xs font-bold flex-shrink-0" style="color:#1e90ff;white-space:nowrap;text-align:right;line-height:1.35;">${overdue ? '<span style="display:block;">Call starts in</span><span style="display:block;">0s</span>' : lectureCountdownInnerHTML(left)}</span>`;
        }
        function lectureCountdownSlotHTML(l, isTeacher){
          const left = lectureStartMs(l) - Date.now();
          if (left < -LECTURE_AUTO_START_GRACE_MS) {
            return isTeacher ? `<button onclick="startScheduledLectureNow('${l.id}')" class="text-xs font-bold px-4 py-2 rounded-full text-white flex-shrink-0" style="background:${NAVY};">Start now</button>` : `<span class="text-xs font-semibold text-gray-400 flex-shrink-0">Waiting for teacher</span>`;
          }
          return lectureCountdownPillHTML(l);
        }

        const lectureAutoStarted = {};
        function lectureAlertKey(lid, ms){ return 'stitchLecAlert:' + lid + ':' + ms; }
        function fireLectureAlert(cls, l, label){
          const title = 'Call starts in ' + label;
          const body = (l.title || 'Lecture') + ' · ' + cls.name;
          if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification(title, { body, tag: 'lecture-countdown-' + l.id }); } catch (e) {}
          }
          pushInAppNotification(title, body);
        }
        // A scheduled meeting that nobody has started or joined within a day of its start time is
        // dropped from the schedule. Only the teacher's device deletes it (and gets the notice);
        // everyone else simply stops seeing it (see classLecturesListHTML) until the update syncs.
        const LECTURE_EXPIRE_AFTER_MS = 24 * 60 * 60 * 1000;
        const lectureExpiryNotified = {};
        function lectureIsExpired(l){
          if (!l || l.status !== 'scheduled') return false;
          const start = lectureStartMs(l);
          return !isNaN(start) && (Date.now() - start) > LECTURE_EXPIRE_AFTER_MS;
        }
        function sweepExpiredScheduledLectures(){
          const removed = [];
          (typeof myClasses !== 'undefined' ? myClasses : []).forEach(cls => {
            if (!cls || cls.role !== 'teacher') return;
            const list = cls.lectures || [];
            const expired = list.filter(lectureIsExpired);
            if (!expired.length) return;
            cls.lectures = list.filter(l => !lectureIsExpired(l));
            queueSaveClassRemote(cls);
            expired.forEach(l => {
              if (lectureExpiryNotified[l.id]) return;
              lectureExpiryNotified[l.id] = true;
              removed.push({ cls, l });
              if (typeof addNotif === 'function') {
                addNotif({
                  id: 'lecture-expired-' + l.id,
                  type: 'classroom',
                  source: 'classroom',
                  icon: 'video',
                  iconBg: 'bg-amber-50',
                  iconClass: 'text-amber-600',
                  name: cls.name || 'Your class',
                  message: `Your scheduled meeting "${l.title || 'Lecture'}" (${formatReminderDate(l.date)} at ${formatTime12(l.time)}) was removed because nobody joined it within a day.`,
                  classId: cls.id,
                });
              }
            });
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classDetail' && currentClassId === cls.id) {
              const ov = document.getElementById('overlay');
              if (ov) ov.innerHTML = classDetailHTML();
            }
          });
          if (removed.length) {
            const one = removed.length === 1;
            const title = one ? 'Scheduled meeting removed' : removed.length + ' scheduled meetings removed';
            const body = one
              ? `"${removed[0].l.title || 'Lecture'}" in ${removed[0].cls.name} was removed because nobody joined it within a day.`
              : 'They were removed because nobody joined them within a day.';
            if ('Notification' in window && Notification.permission === 'granted') {
              try { new Notification(title, { body, tag: 'lecture-expired' }); } catch (e) {}
            }
            pushInAppNotification(title, body);
          }
        }

        function lectureCountdownTick(){
          sweepExpiredScheduledLectures();
          const now = Date.now();
          (typeof myClasses !== 'undefined' ? myClasses : []).forEach(cls => {
            (cls.lectures || []).forEach(l => {
              if (l.status !== 'scheduled') return;
              const start = lectureStartMs(l);
              if (isNaN(start)) return;
              const left = start - now;
              // keep any visible countdown text in step
              document.querySelectorAll('[data-lecture-countdown="' + l.id + '"]').forEach(el => {
                el.innerHTML = lectureCountdownInnerHTML(left);
              });
              // timely alerts: only when a milestone was just crossed, once per device
              LECTURE_ALERT_MILESTONES.forEach(m => {
                if (left > m.ms) return;
                const key = lectureAlertKey(l.id, m.ms);
                let done = false;
                try { done = !!localStorage.getItem(key); } catch (e) {}
                if (done) return;
                try { localStorage.setItem(key, '1'); } catch (e) {}
                if (m.ms - left <= 90 * 1000) fireLectureAlert(cls, l, m.label);
              });
              // countdown finished: the teacher's device starts the call and alerts everyone
              if (left <= 0 && left >= -LECTURE_AUTO_START_GRACE_MS && cls.role === 'teacher' && !lectureAutoStarted[l.id]) {
                lectureAutoStarted[l.id] = true;
                startScheduledLectureNow(l.id, cls.id);
              }
            });
          });
        }
        if (!window.__lectureCountdownTimer) window.__lectureCountdownTimer = setInterval(lectureCountdownTick, 1000);

        function lectureCardHTML(l, isTeacher){
          const isLive = l.status === 'live';
          // If you've already joined this lecture and stepped away (minimized, not ended), the
          // button swaps from "Join" to "Return" so you can hop back into the call in progress
          const isMineMinimized = liveLectureState.connected && lectureMinimized && liveLectureState.lectureId === l.id;
          // The call panel takes the blue card's place while you're in this call (and the floating
          // copy of it steps aside on this screen
          if (isLive && isMineMinimized) return lectureInlineCallPanelHTML(l);
          // Scheduled (not yet started) lectures use the same panel as the call panel above (call-
          // min-card): title + date/time on the left, action on the right, no camera icon
          if (!isLive) {
            return `
            <div class="call-min-card rounded-2xl overflow-hidden bg-white mb-3">
              <div class="flex items-center gap-3 px-4 py-3 select-none">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-900 truncate font-display">${escapeHtml(l.title)}</div>
                  <div class="text-xs text-gray-500 truncate">${formatReminderDate(l.date)} &middot; ${formatTime12(l.time)}</div>
                </div>
                ${lectureCountdownSlotHTML(l, isTeacher)}
              </div>
              ${isTeacher ? `<div class="call-min-actions flex items-center border-t border-gray-100">
                <button onclick="cancelScheduledLecture('${l.id}')" class="flex-1 py-2.5 text-xs font-semibold text-red-500" style="color:#ef4444;">Cancel class meeting</button>
              </div>` : ''}
            </div>`;
          }
          // Live lecture: same white panel as the scheduled one (no blue), title + "Live now" on the
          // left, link + Join/Return on the right
          return `
            <div class="call-min-card rounded-2xl overflow-hidden bg-white mb-3">
              <div class="flex items-center gap-3 px-4 py-3 select-none">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-900 truncate font-display">${escapeHtml(l.title)}</div>
                  <div class="text-xs text-gray-500 truncate">Live now</div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button onclick="shareLectureLink('${currentClassId}','${l.id}')" title="Share lecture link" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('link','w-4 h-4')}</button>
                  ${isMineMinimized
                    ? `<button onclick="resumeLecture()" class="text-xs font-bold px-3 py-2 rounded-full text-white flex-shrink-0" style="background:${NAVY};">Return</button>`
                    : `<button onclick="joinLiveLecture('${l.id}')" class="text-xs font-bold px-3 py-2 rounded-full text-white flex-shrink-0" style="background:${NAVY};">Join</button>`}
                </div>
              </div>
            </div>`;
        }

        function buildLectureInviteLink(classId, lectureId){
          return window.location.origin + window.location.pathname + '?joinLecture=' + encodeURIComponent(classId + ':' + lectureId);
        }

        function copyLectureLink(classId, lectureId){
          const link = buildLectureInviteLink(classId, lectureId);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).catch(() => {});
          }
          pushInAppNotification('Link copied', 'Lecture link copied to your clipboard.');
        }

        function shareLectureLink(classId, lectureId){
          const link = buildLectureInviteLink(classId, lectureId);
          if (navigator.share) {
            navigator.share({ title: 'Join this lecture', text: "Join this live lecture on Stitch -- you don't need to join the class.", url: link }).catch(() => {});
          } else {
            copyLectureLink(classId, lectureId);
          }
        }

        let liveLectureState = { classId: null, lectureId: null, connected: false, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid', screenSharing: false };

        let guestLectureMode = false;
        let pendingGuestLectureJoin = null;
        let lectureTickInterval = null;
        let lectureLocalStream = null; 
        let lectureScreenStream = null;
        let lectureMoreSheetOpen = false;
        let lectureReactionsSheetOpen = false;
        let lectureFloatingReactions = []; 
        let lectureCommentSheetOpen = false;
        let lectureFloatingComments = []; 
        let lectureAttachments = []; 
        let lectureResourcesPanelOpen = false; 
        let inLectureCall = false;
        let inExamAnnotate = false;

        // ---- Starting/joining a live lecture + incoming ring ----
        function clearLectureTimer(){
          if (lectureTickInterval) { clearInterval(lectureTickInterval); lectureTickInterval = null; }
        }

        function escapeHtml(str){
          return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        // ---- Lightweight rich text: **bold**, *italic*, __underline__, "- " bullet lines ----
        function inlineRichFormat(s){
          // Italic is no longer supported: any leftover *text* shows as plain text.
          return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/\*(.+?)\*/g, '$1');
        }

        function renderRichText(str){
          if (!str) return '';
          // Bullets are no longer supported: a leading "- " is dropped and the line shows as plain
          // text
          return escapeHtml(str).split('\n').map(line => {
            const plain = line.replace(/^-\s+/, '');
            return plain.trim() ? `<div>${inlineRichFormat(plain)}</div>` : '<div>&nbsp;</div>';
          }).join('');
        }

        function insertRichFormatAtSelection(el, format){
          const start = el.selectionStart, end = el.selectionEnd;
          const value = el.value;
          const selected = value.slice(start, end);
          let inserted;
          if (format === 'bold') inserted = `**${selected || 'bold text'}**`;
          else if (format === 'underline') inserted = `__${selected || 'underlined text'}__`;
          else return el.value;
          const newValue = value.slice(0, start) + inserted + value.slice(end);
          el.value = newValue;
          if (typeof autoGrowTextarea === 'function') autoGrowTextarea(el);
          const cursor = start + inserted.length;
          el.focus();
          el.setSelectionRange(cursor, cursor);
          return newValue;
        }

        // Descriptions on the Add Module / Add Part pages must be at least this many words.
        const COURSE_DESC_MIN_WORDS = 50;
        function countDescWords(text){
          return String(text || '')
            .replace(/\*\*|__|\*/g, ' ')
            .replace(/^\s*-\s+/gm, ' ')
            .split(/\s+/).filter(Boolean).length;
        }
        function descCounterHTML(id, text){
          const n = countDescWords(text);
          const ok = n >= COURSE_DESC_MIN_WORDS;
          return `<div id="${id}" class="text-xs ${ok ? 'text-emerald-600' : 'text-gray-400'}" style="margin-top:6px;">${n} / ${COURSE_DESC_MIN_WORDS} words minimum</div>`;
        }
        // Updates the counter text/colour in place so the page never re-renders or jumps while
        // typing
        function refreshDescCounter(id, text){
          const el = document.getElementById(id);
          if (!el) return;
          const n = countDescWords(text);
          const ok = n >= COURSE_DESC_MIN_WORDS;
          el.textContent = n + ' / ' + COURSE_DESC_MIN_WORDS + ' words minimum';
          el.className = 'text-xs ' + (ok ? 'text-emerald-600' : 'text-gray-400');
        }

        function richTextToolbarHTML(formatFnName, opts){
          const simple = !!(opts && opts.simple); // simple = Bold + Underline only
          return `
            <div class="flex items-center gap-1.5" style="margin-bottom:5px;">
              <button type="button" onclick="${formatFnName}('bold')" class="w-8 h-7 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-600">B</button>
              ${simple ? '' : `
              <button type="button" onclick="${formatFnName}('underline')" class="w-8 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-600" style="text-decoration:underline;">U</button>
              `}
            </div>`;
        }

        function formatCourseItemDesc(format){
          const el = document.getElementById('course-item-page-desc');
          if (!el) return;
          updateCourseItemPageField('description', insertRichFormatAtSelection(el, format));
        }

        function formatCourseModuleDesc(format){
          const el = document.getElementById('course-add-module-desc');
          if (!el) return;
          updateCourseAddModuleField('description', insertRichFormatAtSelection(el, format));
        }

        function formatNewCourseDesc(format){
          const el = document.getElementById('new-course-desc');
          if (!el) return;
          updateNewCourseField('description', insertRichFormatAtSelection(el, format));
        }

        function gradIcon(svgMarkup){
          return svgMarkup.replace(/currentColor/g, 'url(#navyRoyalGrad)');
        }

        function escapeForJsAttr(str){
          const jsSafe = String(str == null ? '' : str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\r?\n/g, '\\n');
          return escapeHtml(jsSafe);
        }

        function startLiveLectureNow(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          if (!cls.lectures) cls.lectures = [];
          const lecture = { id: 'lec-' + Date.now(), title: cls.name + ' · Live Lecture', date: '', time: '', status: 'live' };
          cls.lectures.unshift(lecture);
          queueSaveClassRemote(cls);
          ringClassMembersForLecture(cls, lecture);
          joinLiveLecture(lecture.id);
        }

        function startScheduledLectureNow(id, classId){
          const cls = myClasses.find(c => c.id === (classId || currentClassId));
          if (!cls) return;
          const l = (cls.lectures || []).find(x => x.id === id);
          if (!l || l.status === 'live') return;
          l.status = 'live';
          // joining uses the open class, so point at this one when the countdown ends elsewhere in
          // the app
          if (currentClassId !== cls.id) currentClassId = cls.id;
          queueSaveClassRemote(cls);
          ringClassMembersForLecture(cls, l);
          joinLiveLecture(id);
        }

        let incomingLectureCallChannel = null;
        let incomingLectureCallSubscribedForUserId = null;
        let incomingLectureCallInfo = null; 
        let incomingLectureCallRingTimeout = null;

        async function subscribeToIncomingLectureCalls(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (incomingLectureCallChannel && incomingLectureCallSubscribedForUserId === myId) return;
          if (incomingLectureCallChannel) { try { sb.removeChannel(incomingLectureCallChannel); } catch (e) {  } incomingLectureCallChannel = null; }
          incomingLectureCallSubscribedForUserId = myId;
          incomingLectureCallChannel = sb.channel('incoming-lecture-calls:' + myId, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'ring' }, ({ payload }) => handleIncomingLectureRing(payload))
            .subscribe();
        }

        function broadcastLectureRingToUser(userId, payload){
          const sb = getSupabaseClient();
          if (!sb || !userId) return;
          const ch = sb.channel('incoming-lecture-calls:' + userId, { config: { broadcast: { self: false } } });
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              ch.send({ type: 'broadcast', event: 'ring', payload });
              setTimeout(() => { try { sb.removeChannel(ch); } catch (e) {  } }, 1000);
            }
          });
        }

        async function ringClassMembersForLecture(cls, lecture){
          const members = Array.isArray(cls.members) ? cls.members : [];
          if (!members.length) return; 
          const myId = await getCurrentUserId();
          const callerName = (typeof profileData !== 'undefined' && profileData.name) || 'Your teacher';
          const callerPhoto = (typeof profileData !== 'undefined' && profileData.photo) || null;
          const lecturePayload = { id: lecture.id, title: lecture.title, date: lecture.date, time: lecture.time };
          members.forEach(uid => {
            if (!uid || uid === myId) return;
            broadcastLectureRingToUser(uid, { classId: cls.id, className: cls.name, lecture: lecturePayload, callerName, callerPhoto });
            sendPushTo(uid, {
              title: `${callerName} started a lecture in ${cls.name}`,
              body: lecture.title || 'Live lecture',
              tag: 'lecture-' + lecture.id,
              data: { kind: 'lecture', classId: cls.id, lectureId: lecture.id },
            });
          });
        }

        function handleIncomingLectureRing(payload){
          if (!payload || !payload.classId || !payload.lecture || !payload.lecture.id) return;
          if (typeof callState !== 'undefined' && callState.convoId) return;
          if (incomingLectureCallInfo) return;
          if (liveLectureState.connected && liveLectureState.lectureId === payload.lecture.id) return;
          incomingLectureCallInfo = payload;
          openOverlay('incomingLectureCall');
          clearTimeout(incomingLectureCallRingTimeout);
          incomingLectureCallRingTimeout = setTimeout(() => declineIncomingLectureCall(), 45000);
          if (typeof addNotif === 'function') {
            addNotif({
              id: 'lecture-' + payload.lecture.id,
              type: 'classroom',
              source: 'classroom',
              icon: 'video',
              iconBg: 'bg-blue-50',
              iconClass: 'text-blue-600',
              name: payload.className || 'Your class',
              message: `${payload.callerName || 'Your teacher'} started "${payload.lecture.title || 'Live Lecture'}"`,
              classId: payload.classId,
            });
          }
        }

        // Fetches a single class row live (used when a ring/notification references a class this
        // device hasn't loaded into myClasses yet
        async function fetchClassByIdRemote(classId){
          const sb = getSupabaseClient();
          if (!sb || !classId) return null;
          try {
            const me = await getCachedAuthUser();
            if (!me) return null;
            const { data, error } = await sb.from(CLASSES_TABLE).select('*').eq('id', classId).maybeSingle();
            if (error || !data) return null;
            return classRowToLocal(data, me.id);
          } catch (e) { return null; }
        }

        async function acceptIncomingLectureCall(){
          if (!incomingLectureCallInfo) return;
          clearTimeout(incomingLectureCallRingTimeout); incomingLectureCallRingTimeout = null;
          const { classId, lecture } = incomingLectureCallInfo;
          incomingLectureCallInfo = null;
          let cls = myClasses.find(c => c.id === classId);
          if (!cls) {
            // Don't dead-end here: fetch the class live and join right away, so being mid-way through
            // something else
            runClassActionLoading('Joining lecture', 'video', async () => {
              const fetched = await fetchClassByIdRemote(classId);
              if (fetched) {
                const existingIdx = myClasses.findIndex(c => c.id === fetched.id);
                if (existingIdx !== -1) myClasses[existingIdx] = fetched; else myClasses.push(fetched);
                if (!fetched.lectures) fetched.lectures = [];
                const existingLec = fetched.lectures.find(l => l.id === lecture.id);
                if (existingLec) existingLec.status = 'live';
                else fetched.lectures.unshift(Object.assign({ status: 'live' }, lecture));
                currentClassId = classId;
                joinLiveLecture(lecture.id);
              } else {
                throw new Error("Couldn't join that class right now. Please check your connection and try again.");
              }
            });
            return;
          }
          if (!cls.lectures) cls.lectures = [];
          const existing = cls.lectures.find(l => l.id === lecture.id);
          if (existing) existing.status = 'live';
          else cls.lectures.unshift(Object.assign({ status: 'live' }, lecture));
          currentClassId = classId;
          joinLiveLecture(lecture.id);
        }

        function declineIncomingLectureCall(fromPopState){
          clearTimeout(incomingLectureCallRingTimeout); incomingLectureCallRingTimeout = null;
          if (!incomingLectureCallInfo) { closeOverlay(fromPopState); return; }
          incomingLectureCallInfo = null;
          closeOverlay(fromPopState);
        }

        function incomingLectureCallHTML(){
          const info = incomingLectureCallInfo || {};
          const lecture = info.lecture || {};
          return cuIncomingHTML({
            kicker: 'Incoming lecture',
            name: info.className || 'Class Lecture',
            sub: `${info.callerName || 'Your teacher'} started "${lecture.title || 'Live Lecture'}"`,
            avatar: info.callerPhoto ? `<img src="${escapeHtml(info.callerPhoto)}" class="w-full h-full object-cover">` : Icon('video', 'w-14 h-14 text-gray-400'),
            declineAction: 'declineIncomingLectureCall()',
            acceptAction: 'acceptIncomingLectureCall()',
            acceptIcon: 'video',
            acceptLabel: 'Join'
          });
        }

        async function joinLiveLecture(id){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const l = (cls.lectures || []).find(x => x.id === id);
          if (!l) return;
          guestLectureMode = false;
          await connectLectureCall(cls.id, id);
        }

        async function joinLectureAsGuest(classId, lectureId){
          guestLectureMode = true;
          pendingGuestLectureJoin = null;
          await connectLectureCall(classId, lectureId);
        }

        async function connectLectureCall(classId, lectureId){
          clearLectureTimer();
          stopLectureLocalStream();
          stopLectureScreenStream();
          if (whiteboardAttachment && whiteboardAttachment.url) URL.revokeObjectURL(whiteboardAttachment.url);
          lectureAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          whiteboardStrokes = [];
          whiteboardAttachment = null;
          lectureSlides = null;
          lecturePreview = null;
          lectureMoreSheetOpen = false;
          lectureReactionsSheetOpen = false;
          lectureCommentSheetOpen = false;
          cuUnmountCommentBar();
          lectureResourcesPanelOpen = false;
          lectureFloatingReactions = [];
          lectureFloatingComments = [];
          lectureAttachments = [];
          pendingAutoOpenAttachmentId = null;
          // Students join muted by default and can unmute themselves if they want to talk or make a
          // contribution
          const cls = myClasses.find(c => c.id === classId);
          const joiningAsTeacher = !!(cls && cls.role === 'teacher');
          liveLectureState = { classId, lectureId, connected: true, seconds: 0, muted: !joiningAsTeacher, camOff: false, handRaised: false, view: 'grid', mediaError: null, screenSharing: false };
          lectureMinimized = false;
          openOverlay('lectureCall');
          joinLectureSignaling(lectureId);

          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              lectureLocalStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
              if (liveLectureState.lectureId !== lectureId) { stopLectureLocalStream(); return; }
              applyLectureTrackStates();
              attachLocalTracksToLecturePeers();
            } catch (err) {
              liveLectureState.mediaError = (err && err.name === 'NotAllowedError') ? 'Camera/mic access was denied' : 'Camera/mic unavailable';
            }
          } else {
            liveLectureState.mediaError = 'Camera/mic not supported in this browser';
          }
          rerenderLectureScreen();

          lectureTickInterval = setInterval(() => {
            liveLectureState.seconds++;
            const timerEl = document.getElementById('lecture-call-timer');
            if (timerEl) timerEl.textContent = formatCallTime(liveLectureState.seconds);
            if (lectureMinimized) {
              updateLectureInlinePanel();
              if (typeof updateMinimizedCallBanner === 'function') updateMinimizedCallBanner();
              ensureLectureBannerObserver();
              syncLectureBannerVisibility();
            }
          }, 1000);
        }

        function checkPendingLectureLinkJoin(){
          let raw;
          try {
            raw = new URLSearchParams(window.location.search || '').get('joinLecture');
          } catch (err) { return; }
          if (!raw) return;
          history.replaceState(null, '', window.location.pathname);
          const sep = raw.indexOf(':');
          if (sep === -1) return;
          const classId = raw.slice(0, sep);
          const lectureId = raw.slice(sep + 1);
          if (!classId || !lectureId) return;
          const cls = myClasses.find(c => c.id === classId);
          if (cls) {
            currentClassId = classId;
            joinLiveLecture(lectureId);
            return;
          }
          pendingGuestLectureJoin = { classId, lectureId };
          openOverlay('guestLectureJoin');
        }

        function guestLectureJoinHTML(){
          const name = (typeof profileData !== 'undefined' && profileData.name) || 'You';
          return `
            <div class="flex-1 flex flex-col items-center justify-center px-8 text-center" style="padding-top:var(--top-safe-pad);">
              <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('video','w-7 h-7')}</div>
              <div class="text-xl font-bold font-display mb-2">You're invited to a live lecture</div>
              <div class="text-sm text-gray-500 mb-6 leading-relaxed">Join as ${escapeHtml(name)}. You'll only join this lecture -- not the rest of the class, its roster, or its classwork.</div>
              <button onclick="submitGuestLectureJoin()" class="w-full max-w-xs font-semibold py-3 rounded-full text-white mb-3" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Join lecture</button>
              <button onclick="cancelGuestLectureJoin()" class="text-sm font-semibold text-gray-400">Not now</button>
            </div>`;
        }

        function submitGuestLectureJoin(){
          if (!pendingGuestLectureJoin) return;
          const { classId, lectureId } = pendingGuestLectureJoin;
          joinLectureAsGuest(classId, lectureId);
        }

        function cancelGuestLectureJoin(fromPopState){
          pendingGuestLectureJoin = null;
          closeOverlay(fromPopState);
        }

        // ---- Lecture controls (mic/camera/hand raise/sheets) ----
        function applyLectureTrackStates(){
          if (!lectureLocalStream) return;
          lectureLocalStream.getAudioTracks().forEach(t => t.enabled = !liveLectureState.muted);
          lectureLocalStream.getVideoTracks().forEach(t => t.enabled = !liveLectureState.camOff);
        }

        function stopLectureLocalStream(){
          if (lectureLocalStream) {
            lectureLocalStream.getTracks().forEach(t => t.stop());
            lectureLocalStream = null;
          }
        }

        function stopLectureScreenStream(){
          if (lectureScreenStream) {
            lectureScreenStream.getTracks().forEach(t => t.stop());
            lectureScreenStream = null;
          }
          liveLectureState.screenSharing = false;
        }

        function cancelScheduledLecture(id){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          cls.lectures = (cls.lectures || []).filter(l => l.id !== id);
          queueSaveClassRemote(cls);
          document.getElementById('overlay').innerHTML = classDetailHTML();
        }

        function toggleLectureControl(key){
          liveLectureState[key] = !liveLectureState[key];
          applyLectureTrackStates();
          if (key === 'camOff' && liveLectureState.view === 'grid') {
            const media = document.getElementById('lecture-local-media');
            if (media) media.innerHTML = lectureLocalMediaHTML();
            attachLectureMedia();
          }
          updateLectureLocalBadges();
          updateLectureControlBarButtons();
          updateLecturePresenceTrack();
        }

        function toggleLectureHand(){
          liveLectureState.handRaised = !liveLectureState.handRaised;
          if (liveLectureState.handRaised) {
            const id = 'r' + Date.now() + Math.random().toString(36).slice(2);
            addLectureFloatingReaction(id, 'handRaised', (profileData && profileData.name) || 'You', true);
            broadcastLectureSignal({ type: 'reaction', id, icon: 'handRaised', name: (profileData && profileData.name) || 'Someone', big: true });
          }
          updateLectureLocalBadges();
          updateLectureControlBarButtons();
          updateLecturePresenceTrack();
        }

        function updateLecturePresenceTrack(){
          if (!lectureChannel || !myLecturePeerId) return;
          lectureChannel.track({ name: (profileData && profileData.name) || 'Student', photo: (profileData && profileData.photo) || null, muted: liveLectureState.muted, camOff: liveLectureState.camOff, handRaised: liveLectureState.handRaised, isTeacher: lectureIsTeacher() });
        }

        function updateLectureLocalBadges(){
          const el = document.getElementById('lecture-local-badges');
          if (el) el.innerHTML = lectureLocalBadgesHTML();
        }

        // The five call controls, shared by the first render and by in-place updates
        function lectureCtlSpecs(){
          const st = liveLectureState;
          const isTeacher = lectureIsTeacher();
          return {
            mute: { id: 'lecture-mute-btn', onclick: "toggleLectureControl('muted')", icon: st.muted ? 'micOff' : 'mic', label: st.muted ? 'Unmute' : 'Mute', on: !!st.muted },
            cam: { id: 'lecture-cam-btn', onclick: "toggleLectureControl('camOff')", icon: st.camOff ? 'cameraOff' : 'video', label: st.camOff ? 'Start video' : 'Camera', on: !!st.camOff },
            hand: { id: 'lecture-hand-btn', onclick: 'toggleLectureHand()', icon: 'handRaised', label: st.handRaised ? 'Lower' : 'Raise', on: !!st.handRaised, title: 'Raise hand' },
            more: { id: 'lecture-more-btn', onclick: 'toggleLectureMoreSheet()', icon: 'dashesShortRight', label: 'More', on: !!lectureMoreSheetOpen },
            end: { onclick: 'endLecture()', icon: 'phoneHangup', label: isTeacher ? 'End' : 'Leave', end: true, title: isTeacher ? 'End lecture' : 'Leave' },
          };
        }

        function lectureControlsHTML(){
          const c = lectureCtlSpecs();
          return `<div class="cu-bar-inner">${[c.mute, c.cam, c.hand, c.more, c.end].map(cuCtlHTML).join('')}</div>`;
        }

        function updateLectureControlBarButtons(){
          const c = lectureCtlSpecs();
          cuPatchCtl('lecture-mute-btn', c.mute);
          cuPatchCtl('lecture-cam-btn', c.cam);
          cuPatchCtl('lecture-hand-btn', c.hand);
          cuPatchCtl('lecture-more-btn', c.more);
        }

        function updateLectureSheetsRegion(){
          const el = document.getElementById('lecture-sheets-region');
          if (el) el.innerHTML = lectureSheetsRegionHTML(liveLectureState.view);
          if (lectureCommentSheetOpen) cuMountCommentBar({ inputId: 'lecture-comment-input', placeholder: 'Type a comment...', onSend: 'sendLectureComment()', onClose: 'closeLectureSheets()' });
          else cuUnmountCommentBar();
          updateLectureControlBarButtons();
        }

        function toggleLectureReactionsSheet(){
          lectureMoreSheetOpen = false;
          lectureCommentSheetOpen = false;
          lectureReactionsSheetOpen = !lectureReactionsSheetOpen;
          updateLectureSheetsRegion();
        }

        function toggleLectureMoreSheet(){
          lectureReactionsSheetOpen = false;
          lectureCommentSheetOpen = false;
          lectureMoreSheetOpen = !lectureMoreSheetOpen;
          updateLectureSheetsRegion();
        }

        function toggleLectureCommentSheet(){
          lectureReactionsSheetOpen = false;
          lectureMoreSheetOpen = false;
          lectureCommentSheetOpen = !lectureCommentSheetOpen;
          updateLectureSheetsRegion();
          if (lectureCommentSheetOpen) setTimeout(() => { const el = document.getElementById('lecture-comment-input'); if (el) el.focus(); }, 0);
        }

        function closeLectureSheets(){
          lectureMoreSheetOpen = false;
          lectureReactionsSheetOpen = false;
          lectureCommentSheetOpen = false;
          updateLectureSheetsRegion();
        }

        function toggleLectureResourcesPanel(){
          if (window.innerWidth >= 1024) {
            if (rightPanelMode === 'notebook') closeRightPanel();
            else openRightPanel('notebook');
            return;
          }
          closeLectureSheets();
          lectureResourcesPanelOpen = !lectureResourcesPanelOpen;
          rerenderLectureScreen();
        }

        // ---- Live reactions + comments overlay ----
        function sendLectureReaction(icon){
          const id = 'r' + Date.now() + Math.random().toString(36).slice(2);
          addLectureFloatingReaction(id, icon, (profileData && profileData.name) || 'You');
          lectureReactionsSheetOpen = false;
          broadcastLectureSignal({ type: 'reaction', id, icon, name: (profileData && profileData.name) || 'Someone' });
        }

        function addLectureFloatingReaction(id, icon, name, big){
          lectureFloatingReactions.push({ id, icon, name, big: !!big });
          const el = document.getElementById('lecture-reactions-float');
          if (el) el.innerHTML = lectureReactionsFloatHTML();
          setTimeout(() => {
            lectureFloatingReactions = lectureFloatingReactions.filter(r => r.id !== id);
            const el2 = document.getElementById('lecture-reactions-float');
            if (el2) el2.innerHTML = lectureReactionsFloatHTML();
          }, 2400);
        }

        function lectureReactionsFloatHTML(){
          if (!lectureFloatingReactions.length) return '';
          return lectureFloatingReactions.map(r => `
            <span class="lecture-reaction-float cu-float flex items-center gap-1.5 rounded-full" style="padding:8px 12px 8px 8px;">
              ${cuEmoji(r.icon) ? `<span class="flex items-center justify-center flex-shrink-0" style="font-size:26px;line-height:1;width:32px;height:32px;">${cuEmoji(r.icon)}</span>` : `<span class="${r.big ? 'w-10 h-10' : 'w-8 h-8'} rounded-full flex items-center justify-center flex-shrink-0" style="background:${NAVY}1a;color:${NAVY};">${Icon(r.icon, r.big ? 'w-5 h-5' : 'w-4 h-4')}</span>`}
              <span class="text-xs font-semibold truncate max-w-[130px]">${escapeHtml(r.name || '')}${r.icon === 'handRaised' ? ' raised a hand' : ''}</span>
            </span>`).join('');
        }

        function sendLectureComment(){
          const input = document.getElementById('lecture-comment-input');
          const text = input ? input.value.trim() : '';
          if (!text) return;
          if (input) input.value = '';
          const id = 'c' + Date.now() + Math.random().toString(36).slice(2);
          addLectureFloatingComment(id, text, (profileData && profileData.name) || 'You');
          lectureCommentSheetOpen = false;
          updateLectureSheetsRegion();
          broadcastLectureSignal({ type: 'comment', id, text, name: (profileData && profileData.name) || 'Someone' });
        }

        function addLectureFloatingComment(id, text, name){
          lectureFloatingComments.push({ id, text, name });
          const el = document.getElementById('lecture-comments-float');
          if (el) el.innerHTML = lectureCommentsFloatHTML();
          setTimeout(() => {
            lectureFloatingComments = lectureFloatingComments.filter(c => c.id !== id);
            const el2 = document.getElementById('lecture-comments-float');
            if (el2) el2.innerHTML = lectureCommentsFloatHTML();
          }, 6000);
        }

        function lectureCommentsFloatHTML(){
          if (!lectureFloatingComments.length) return '';
          return lectureFloatingComments.map(c => `
            <span class="lecture-reaction-float cu-float flex items-start gap-1.5 rounded-2xl" style="max-width:220px;padding:10px;">
              <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style="background:${NAVY};">${escapeHtml((c.name || '?').slice(0,1).toUpperCase())}</span>
              <span class="min-w-0">
                <span class="block text-[11px] font-bold truncate">${escapeHtml(c.name || '')}</span>
                <span class="block text-xs break-words" style="opacity:.8;">${escapeHtml(c.text || '')}</span>
              </span>
            </span>`).join('');
        }

        // ---- Lecture stage/view rendering (grid, whiteboard, present) ----
        function setLectureView(view){
          liveLectureState.view = view;
          rerenderLectureScreen();
        }

        function toggleLectureWhiteboard(){
          if (!lectureIsTeacher()) return;
          closeLectureSheets();
          const nextView = liveLectureState.view === 'whiteboard' ? 'grid' : 'whiteboard';
          setLectureView(nextView);
          broadcastLectureSignal({ type: 'view', view: nextView, strokes: whiteboardStrokes });
        }

        function toggleLectureScreenShare(){
          if (!lectureIsTeacher()) return;
          closeLectureSheets();
          if (liveLectureState.screenSharing) {
            stopLectureScreenShare_user();
          } else {
            startLectureScreenShare();
          }
        }

        async function startLectureScreenShare(){
          if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            openAppAlertModal('Screen sharing is not supported in this browser.');
            return;
          }
          let stream;
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          } catch (err) {
            return; // user cancelled the share picker
          }
          lectureScreenStream = stream;
          liveLectureState.screenSharing = true;
          const screenTrack = stream.getVideoTracks()[0];
          if (screenTrack) {
            screenTrack.onended = () => stopLectureScreenShare_user();
            Object.values(lecturePeerConnections).forEach(pc => {
              const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
              if (sender) sender.replaceTrack(screenTrack);
            });
          }
          broadcastLectureSignal({ type: 'screen-share', active: true });
          rerenderLectureScreen();
          updateLectureControlBarButtons();
        }

        function stopLectureScreenShare_user(){
          stopLectureScreenStream();
          const cameraTrack = lectureLocalStream ? lectureLocalStream.getVideoTracks()[0] : null;
          Object.values(lecturePeerConnections).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(cameraTrack || null);
          });
          broadcastLectureSignal({ type: 'screen-share', active: false });
          rerenderLectureScreen();
          updateLectureControlBarButtons();
        }

        function toggleLecturePresent(){
          closeLectureSheets();
          if (liveLectureState.view === 'slides') { setLectureView('grid'); return; }
          if (lectureSlides) { setLectureView('slides'); return; }
          const input = document.getElementById('lecture-slide-input');
          if (input) input.click();
        }

        function rerenderLectureScreen(){
          const screen = document.getElementById('lecture-call-screen');
          if (screen) screen.outerHTML = lectureCallHTML();
          attachLectureMedia();
          const classPadList = document.getElementById('desktop-classpad-resources-list');
          if (classPadList) classPadList.innerHTML = classPadResourcesHTML();
          const classPadUploaded = document.getElementById('desktop-classpad-uploaded-list');
          if (classPadUploaded) classPadUploaded.innerHTML = classPadUploadedResourcesHTML();
        }

        function updateLectureStageContent(){
          const view = liveLectureState.view;
          const stageHTML = view === 'whiteboard' ? lectureWhiteboardHTML() : (view === 'slides' ? lectureSlidesHTML() : lectureGridHTML());
          const el = document.getElementById('lecture-stage-content');
          if (el) el.innerHTML = stageHTML;
          attachLectureMedia();
        }

        function attachLectureMedia(){
          if (liveLectureState.view === 'grid') {
            const v = document.getElementById('lecture-local-video');
            if (v) v.srcObject = (liveLectureState.screenSharing && lectureScreenStream) ? lectureScreenStream : lectureLocalStream;
            Object.keys(lecturePresence).forEach(attachLectureRemoteVideo);
          } else if (liveLectureState.view === 'whiteboard') {
            initWhiteboardCanvas();
          } else if (liveLectureState.view === 'slides' && lectureSlides && lectureSlides.type === 'pdf') {
            renderPdfSlidePage();
          }
          if (lecturePreview && lecturePreview.kind === 'pdf' && lecturePreview.status === 'ready') renderPreviewPdfPage();
        }

        let lectureMinimized = false;

        // Swap screens with a short crossfade instead of a hard cut, so minimising, resuming or
        // leaving a class call doesn't flash (the video tiles are rebuilt on every swap).
        function lectureSmoothSwap(fn){
          const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (!reduce && typeof document.startViewTransition === 'function') {
            try { document.startViewTransition(() => { fn(); }); return; } catch (e) {}
          }
          fn();
        }

        // Tapping "Back" during a live lecture used to call endLecture() outright
        function minimizeLecture(fromPopState){
          if (!liveLectureState.connected) { closeOverlay(fromPopState); return; }
          lectureMinimized = true;
          syncLectureBgAudio();
          lectureSmoothSwap(() => {
            if (guestLectureMode) { if (fromPopState) overlayHistoryPushed = false; closeOverlay(); showLectureBanner(); return; }
            currentClassId = liveLectureState.classId;
            classDetailTab = 'stream';
            // The browser already popped this overlay's history entry when the phone's back button was
            // used
            if (fromPopState) overlayHistoryPushed = false;
            openOverlay('classDetail');
            showLectureBanner();
          });
        }

        function resumeLecture(){
          if (!liveLectureState.connected) return;
          lectureMinimized = false;
          lectureSmoothSwap(() => {
            hideLectureBanner();
            removeLectureBgAudio();
            if (liveLectureState.classId) currentClassId = liveLectureState.classId;
            openOverlay('lectureCall');
            attachLectureMedia();
          });
        }

        // ---- Minimized class call: the same floating, draggable card the 1:1/group call uses
        // (#call-minimized-banner, driven by chat.js), so it stays on screen --
        function lectureInlineCallPanelHTML(l){
          const muted = liveLectureState.muted;
          return `
            <div id="lecture-inline-panel" class="call-min-card rounded-2xl overflow-hidden bg-white mb-3">
              <div onclick="resumeLecture()" class="flex items-center gap-3 px-4 py-3 select-none cursor-pointer">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-900 truncate font-display">${escapeHtml(l.title || 'Live class')}</div>
                  <div class="text-xs text-gray-500 truncate">Class in progress &middot; <span id="lecture-inline-timer">${formatCallTime(liveLectureState.seconds)}</span></div>
                </div>
                <button onclick="event.stopPropagation();lectureBannerToggleMute()" id="lecture-inline-mute-btn" title="Mute" class="call-min-mute-btn w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0">${Icon(muted ? 'micOff' : 'mic','w-4 h-4')}</button>
                <button onclick="event.stopPropagation();endLecture()" title="End call" class="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">${Icon('phoneHangup','w-4 h-4')}</button>
              </div>
              <div class="call-min-actions flex items-center border-t border-gray-100">
                <button onclick="event.stopPropagation();openCallNotes()" title="Notes" class="flex-1 py-2.5 flex items-center justify-center text-gray-600" style="border-right:1px solid rgba(0,0,0,0.06);">${Icon('edit','w-4 h-4')}</button>
                <button onclick="event.stopPropagation();openLectureAddPeople()" title="Add to call" class="flex-1 py-2.5 flex items-center justify-center text-gray-600">${Icon('plus','w-4 h-4')}</button>
              </div>
            </div>`;
        }
        function updateLectureInlinePanel(){
          const t = document.getElementById('lecture-inline-timer');
          if (t) t.textContent = formatCallTime(liveLectureState.seconds);
          const m = document.getElementById('lecture-inline-mute-btn');
          if (m) m.innerHTML = Icon(liveLectureState.muted ? 'micOff' : 'mic', 'w-4 h-4');
        }
        // Hide the floating card whenever the inline panel is on screen (same call, one panel).
        function syncLectureBannerVisibility(){
          const banner = document.getElementById('call-minimized-banner');
          if (!banner || !lectureBannerActive()) return;
          if (typeof callMinimized !== 'undefined' && callMinimized) return;
          if (typeof callBannerDrag !== 'undefined' && callBannerDrag) return; // don't fight an in-progress drag
          const inline = !!document.getElementById('lecture-inline-panel');
          banner.classList.toggle('hidden', inline);
          if (!inline) { updateMinimizedCallBanner(); applyCallBannerPos(); }
        }
        // Watches the screen/overlay so the floating card and the inline panel swap places as the
        // person navigates (in a class -> inline panel
        let lectureBannerObs = null;
        let lectureBannerObsNodes = [];
        let lectureBannerSyncTimer = null;
        function scheduleLectureBannerSync(delay){
          if (!lectureMinimized) return;
          clearTimeout(lectureBannerSyncTimer);
          lectureBannerSyncTimer = setTimeout(syncLectureBannerVisibility, typeof delay === 'number' ? delay : 30);
        }
        function ensureLectureBannerObserver(){
          const nodes = ['overlay','screen'].map(id => document.getElementById(id)).filter(Boolean);
          if (!nodes.length) return;
          if (lectureBannerObs && nodes.length === lectureBannerObsNodes.length && nodes.every((n, i) => n === lectureBannerObsNodes[i])) return;
          if (lectureBannerObs) lectureBannerObs.disconnect();
          lectureBannerObs = new MutationObserver(() => scheduleLectureBannerSync());
          nodes.forEach(n => lectureBannerObs.observe(n, { childList: true, subtree: true }));
          lectureBannerObsNodes = nodes;
        }

        function lectureBannerActive(){
          return !!(liveLectureState.connected && lectureMinimized);
        }
        function showLectureBanner(){
          const banner = document.getElementById('call-minimized-banner');
          if (!banner) return;
          const inlineShown = !!document.getElementById('lecture-inline-panel');
          banner.classList.toggle('hidden', inlineShown);
          if (!inlineShown) {
            if (typeof updateMinimizedCallBanner === 'function') updateMinimizedCallBanner();
            if (typeof applyCallBannerPos === 'function') applyCallBannerPos();
          }
          ensureLectureBannerObserver();
          scheduleLectureBannerSync(60);
        }
        function hideLectureBanner(){
          const banner = document.getElementById('call-minimized-banner');
          if (banner && !(typeof callMinimized !== 'undefined' && callMinimized)) banner.classList.add('hidden');
        }
        // While minimized the lecture screen (and its <video> elements) is gone, so the remote
        // audio is played through hidden <audio> elements instead
        function syncLectureBgAudio(){
          if (!lectureMinimized) return;
          let box = document.getElementById('lecture-bg-audio-box');
          if (!box) { box = document.createElement('div'); box.id = 'lecture-bg-audio-box'; box.style.display = 'none'; document.body.appendChild(box); }
          Object.keys(lectureRemoteStreams).forEach(pid => {
            const stream = lectureRemoteStreams[pid];
            if (!stream) return;
            let a = box.querySelector('audio[data-peer="' + pid + '"]');
            if (!a) { a = document.createElement('audio'); a.setAttribute('data-peer', pid); a.autoplay = true; a.setAttribute('playsinline', ''); box.appendChild(a); }
            if (a.srcObject !== stream) { a.srcObject = stream; try { a.play(); } catch (e) {} }
          });
        }
        function removeLectureBgAudio(){
          const box = document.getElementById('lecture-bg-audio-box');
          if (box) box.remove();
        }
        function lectureBannerToggleMute(){
          toggleLectureControl('muted');
          updateLectureInlinePanel();
          if (typeof updateMinimizedCallBanner === 'function') updateMinimizedCallBanner();
        }

        // Notes taken from the minimized card land in the classroom Notebook (notebookNotes), one
        // note per lecture, so they show up with the rest of the class notes afterwards
        function lectureNoteId(){ return 'lecnote-' + liveLectureState.lectureId; }
        function lectureNoteText(){
          const n = notebookNotes.find(x => x.id === lectureNoteId());
          return n ? n.text : '';
        }
        function saveLectureNoteText(text){
          const id = lectureNoteId();
          const idx = notebookNotes.findIndex(x => x.id === id);
          const trimmed = String(text || '');
          if (!trimmed.trim()) {
            if (idx !== -1) notebookNotes.splice(idx, 1);
          } else if (idx !== -1) {
            notebookNotes[idx].text = trimmed;
          } else {
            const cls = myClasses.find(c => c.id === liveLectureState.classId);
            notebookNotes.unshift({ id, text: trimmed, time: (cls ? cls.name + ' · ' : '') + 'Just now' });
          }
          if (typeof refreshClassPadSurfaces === 'function') refreshClassPadSurfaces();
        }

        // Add someone to the running class call: only people who have already JOINED the class
        // (its members list, plus the teacher) can be added
        let lectureAddRinged = new Set();
        function lectureAddCandidateIds(){
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          if (!cls) return [];
          const ids = new Set((cls.members || []).filter(Boolean));
          if (cls.teacherId) ids.add(cls.teacherId);
          const myId = _cachedAuthUser && _cachedAuthUser.id;
          if (myId) ids.delete(myId);
          return Array.from(ids);
        }
        async function openLectureAddPeople(){
          const modal = document.getElementById('lectureAddModal');
          const list = document.getElementById('lectureAddList');
          if (!modal || !list) return;
          modal.classList.remove('hidden');
          list.innerHTML = '<div class="text-sm text-gray-400 text-center py-6">Loading class members...</div>';
          const ids = lectureAddCandidateIds();
          if (!ids.length) { list.innerHTML = '<div class="text-sm text-gray-400 text-center py-6">No one else has joined this class yet.</div>'; return; }
          let profiles = {};
          const sb = getSupabaseClient();
          try {
            if (sb) {
              const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id,name,username,photo').in('user_id', ids);
              (data || []).forEach(p => { profiles[p.user_id] = p; });
            }
          } catch (e) {}
          list.innerHTML = ids.map(uid => {
            const pr = profiles[uid] || {};
            const name = pr.name || pr.username || 'Class member';
            const done = lectureAddRinged.has(uid);
            return `<div class="flex items-center gap-3 py-2">
              <div class="w-10 h-10 rounded-full bg-blue-50 overflow-hidden flex items-center justify-center flex-shrink-0">${avatarMediaHTML(pr.photo || null, 'user', 'w-5 h-5')}</div>
              <div class="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">${escapeHtml(name)}</div>
              <button id="lecture-add-btn-${uid}" onclick="ringLectureMember('${uid}')" ${done ? 'disabled' : ''} class="text-xs font-bold px-3 py-1.5 rounded-full text-white flex-shrink-0" style="background:${done ? '#9ca3af' : ROYAL};">${done ? 'Invited' : 'Add'}</button>
            </div>`;
          }).join('');
        }
        function closeLectureAddPeople(){
          const modal = document.getElementById('lectureAddModal');
          if (modal) modal.classList.add('hidden');
        }
        function ringLectureMember(uid){
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          if (!cls || !uid) return;
          if (!lectureAddCandidateIds().includes(uid)) return;
          const l = (cls.lectures || []).find(x => x.id === liveLectureState.lectureId) || { id: liveLectureState.lectureId, title: 'Live class' };
          const callerName = (profileData && profileData.name) || 'Someone';
          broadcastLectureRingToUser(uid, { classId: cls.id, className: cls.name, lecture: { id: l.id, title: l.title, date: l.date, time: l.time }, callerName, callerPhoto: (profileData && profileData.photo) || null });
          try { sendPushTo(uid, { title: `${callerName} added you to a class call in ${cls.name}`, body: l.title || 'Live class', tag: 'lecture-' + l.id, data: { kind: 'lecture', classId: cls.id, lectureId: l.id } }); } catch (e) {}
          lectureAddRinged.add(uid);
          const btn = document.getElementById('lecture-add-btn-' + uid);
          if (btn) { btn.textContent = 'Invited'; btn.disabled = true; btn.style.background = '#9ca3af'; }
        }

        function endLecture(remoteEnded){
          lectureMinimized = false;
          hideLectureBanner();
          removeLectureBgAudio();
          lectureAddRinged = new Set();
          if (typeof closeCallNotesModal === 'function') closeCallNotesModal();
          if (typeof closeLectureAddPeople === 'function') closeLectureAddPeople();
          if (typeof resetCallBannerPos === 'function') resetCallBannerPos();
          clearLectureTimer();
          stopLectureLocalStream();
          stopLectureScreenStream();
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          const isTeacher = cls && cls.role === 'teacher';
          if (isTeacher && !remoteEnded) broadcastLectureSignal({ type: 'end' });
          teardownLectureSignaling();
          inLectureCall = false;
          // Only drop the lecture from the class's live-lecture list when the teacher actually ended
          // it for everyone (isTeacher ending it here, or this client receiving that teacher's 'end'
          if (cls && (isTeacher || remoteEnded)) {
            if (isTeacher) {
              const endedLec = (cls.lectures || []).find(l => l.id === liveLectureState.lectureId);
              cls.callLog = (cls.callLog || []).concat([{ id: liveLectureState.lectureId, title: (endedLec && endedLec.title) || 'Live class', endedAt: Date.now(), seconds: liveLectureState.seconds || 0 }]).slice(-200);
            }
            cls.lectures = (cls.lectures || []).filter(l => l.id !== liveLectureState.lectureId);
            if (isTeacher) queueSaveClassRemote(cls);
          }
          const wasGuest = guestLectureMode;
          guestLectureMode = false;
          liveLectureState = { classId: null, lectureId: null, connected: false, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid', screenSharing: false };
          lectureSlides = null;
          if (whiteboardAttachment && whiteboardAttachment.url) URL.revokeObjectURL(whiteboardAttachment.url);
          lectureAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          whiteboardStrokes = [];
          whiteboardAttachment = null;
          lecturePreview = null;
          lectureMoreSheetOpen = false;
          lectureReactionsSheetOpen = false;
          lectureCommentSheetOpen = false;
          cuUnmountCommentBar();
          lectureResourcesPanelOpen = false;
          lectureFloatingReactions = [];
          lectureFloatingComments = [];
          lectureAttachments = [];
          pendingAutoOpenAttachmentId = null;
          lectureSmoothSwap(() => {
            if (wasGuest) { closeOverlay(); return; }
            classDetailTab = 'stream';
            openOverlay('classDetail');
          });
        }

        const LECTURE_TILE_COLORS = ['bg-orange-500','bg-purple-500','bg-teal-500','bg-blue-500','bg-rose-500','bg-emerald-500','bg-indigo-500','bg-amber-500','bg-cyan-500','bg-pink-500'];

        // ---- Lecture video tile rendering (local/remote participants) ----
        function lectureLocalMediaHTML(){
          const isSharing = liveLectureState.screenSharing && lectureScreenStream;
          const showLocalVideo = isSharing || (lectureLocalStream && !liveLectureState.camOff && !liveLectureState.mediaError);
          // Screen share stays un-cropped (object-contain) so the whole shared screen is visible
          // instead of being cover-cropped like a face
          if (showLocalVideo) return `<video id="lecture-local-video" autoplay playsinline muted class="w-full h-full ${isSharing ? 'object-contain bg-black' : 'object-cover'}" style="${isSharing ? '' : 'transform:scaleX(-1);'}"></video>`;
          return `<div class="w-full h-full flex items-center justify-center"><div class="cu-avatar bg-blue-100">${avatarMediaHTML(profileData.photo, 'user', 'w-8 h-8 text-gray-500')}</div></div>`;
        }

        function lectureLocalBadgesHTML(){
          const st = liveLectureState;
          return `
            ${st.screenSharing ? `<span class="cu-chip" style="top:8px;left:8px;bottom:auto;display:inline-flex;align-items:center;gap:5px;background:rgba(30,144,255,.88);">${Icon('monitor','w-3 h-3')} Presenting</span>` : ''}
            ${st.muted ? `<span class="cu-corner cu-mute">${Icon('micOff','w-3.5 h-3.5')}</span>` : ''}
            ${st.camOff && !st.screenSharing ? `<span class="cu-corner" style="right:${st.muted ? '40px' : '8px'};">${Icon('cameraOff','w-3.5 h-3.5')}</span>` : ''}
            ${st.handRaised ? `<span class="cu-corner cu-hand" style="top:${st.screenSharing ? '40px' : '8px'};">${cuEmoji('handRaised')}</span>` : ''}`;
        }

        function lectureTileWrapperHTML(videoInner, badgesInner, caption, tileId, bgClass, spotlight){
          return `
            <div class="cu-tile" ${tileId ? `id="${tileId}"` : ''} style="width:100%;height:100%;${spotlight ? 'border-radius:22px;' : ''}">
              ${videoInner}
              ${badgesInner || ''}
              <span class="cu-chip">${caption}</span>
            </div>`;
        }

        function lectureRemoteBadgesHTML(p){
          return `
            ${p.sharingScreen ? `<span class="cu-chip" style="top:8px;left:8px;bottom:auto;display:inline-flex;align-items:center;gap:5px;background:rgba(30,144,255,.88);">${Icon('monitor','w-3 h-3')} Presenting</span>` : ''}
            ${p.muted ? `<span class="cu-corner cu-mute">${Icon('micOff','w-3.5 h-3.5')}</span>` : ''}
            ${p.handRaised ? `<span class="cu-corner cu-hand" style="top:${p.sharingScreen ? '40px' : '8px'};">${cuEmoji('handRaised')}</span>` : ''}`;
        }

        function updateLectureRemoteBadges(){
          Object.keys(lecturePresence).forEach(peerId => {
            const el = document.getElementById('lecture-remote-badges-' + peerId);
            if (el) el.innerHTML = lectureRemoteBadgesHTML(lecturePresence[peerId]);
          });
        }

        // Teacher-only: silence the whole room in one tap (students can unmute themselves again)
        function muteEveryoneInLecture(){
          if (!lectureIsTeacher()) return;
          if (!Object.keys(lecturePresence).length) { callToast('No one else is in the lecture yet'); return; }
          broadcastLectureSignal({ type: 'mute-all' });
          Object.keys(lecturePresence).forEach(k => { lecturePresence[k].muted = true; });
          updateLectureRemoteBadges();
          callToast('Muted everyone');
        }

        function lectureAdminBarHTML(){
          if (!lectureIsTeacher() || !Object.keys(lecturePresence).length) return '';
          return `<div class="cu-adminbar" style="padding-top:2px;"><button onclick="muteEveryoneInLecture()" class="cu-pill">${Icon('muteAll','w-4 h-4')}<span>Mute everyone</span></button></div>`;
        }

        function lectureGridHTML(){
          const iAmTeacher = lectureIsTeacher();
          const peerIds = Object.keys(lecturePresence);
          // Whoever is presenting (me or a peer) takes over the stage below instead of sitting in an
          // equal-sized grid cell like everyone else
          const localSharing = liveLectureState.screenSharing && lectureScreenStream;
          const remoteSharingId = peerIds.find(id => lecturePresence[id].sharingScreen);
          const spotlightId = localSharing ? 'local' : (remoteSharingId || null);

          const localTile = lectureTileWrapperHTML(
            `<div id="lecture-local-media" class="w-full h-full">${lectureLocalMediaHTML()}</div>`,
            `<div id="lecture-local-badges">${lectureLocalBadgesHTML()}</div>`,
            iAmTeacher ? 'You · Host' : 'You',
            'lecture-local-tile',
            localSharing ? 'bg-black' : null,
            spotlightId === 'local'
          );
          const sortedPeerIds = peerIds.slice().sort((a, b) => {
            const ta = lecturePresence[a].isTeacher ? 1 : 0;
            const tb = lecturePresence[b].isTeacher ? 1 : 0;
            return tb - ta;
          });
          const otherTileHTML = {};
          sortedPeerIds.forEach((peerId, i) => {
            const p = lecturePresence[peerId];
            const stream = lectureRemoteStreams[peerId];
            const showVideo = !p.camOff && stream && stream.getVideoTracks().some(t => t.enabled);
            const isSpotlight = spotlightId === peerId;
            const videoInner = `
              <video id="lecture-remote-video-${peerId}" autoplay playsinline class="w-full h-full ${isSpotlight ? 'object-contain' : 'object-cover'} ${showVideo ? '' : 'hidden'}"></video>
              ${!showVideo ? `<div class="w-full h-full flex items-center justify-center"><div class="cu-avatar ${LECTURE_TILE_COLORS[i % LECTURE_TILE_COLORS.length]}"><span class="text-white font-bold text-2xl">${escapeHtml((p.name || '?').trim().charAt(0).toUpperCase())}</span></div></div>` : ''}`;
            const badgesInner = `<div id="lecture-remote-badges-${peerId}">${lectureRemoteBadgesHTML(p)}</div>`;
            const caption = `${escapeHtml(p.name)}${p.isTeacher ? ' · Host' : ''}`;
            otherTileHTML[peerId] = lectureTileWrapperHTML(videoInner, badgesInner, caption, null, null, isSpotlight);
          });

          const mediaErr = liveLectureState.mediaError ? `<div class="cu-alert">${escapeHtml(liveLectureState.mediaError)}</div>` : '';

          if (spotlightId) {
            const spotlightTile = spotlightId === 'local' ? localTile : otherTileHTML[spotlightId];
            const stripIds = spotlightId === 'local' ? sortedPeerIds : ['local', ...sortedPeerIds.filter(id => id !== spotlightId)];
            const stripTiles = stripIds.map(id => `<div style="width:124px;height:100%;flex-shrink:0;">${id === 'local' ? localTile : otherTileHTML[id]}</div>`).join('');
            return `
              ${mediaErr}
              ${lectureAdminBarHTML()}
              <div class="flex-1 min-h-0 flex flex-col gap-2" style="padding:8px 12px;">
                <div class="flex-1 min-h-0">${spotlightTile}</div>
                ${stripTiles ? `<div class="flex gap-2 overflow-x-auto flex-shrink-0" style="height:92px;">${stripTiles}</div>` : ''}
              </div>`;
          }

          const orderedTiles = iAmTeacher
            ? [localTile].concat(sortedPeerIds.map(id => otherTileHTML[id]))
            : sortedPeerIds.map(id => otherTileHTML[id]).concat([localTile]);
          return `
            ${mediaErr}
            ${lectureAdminBarHTML()}
            <div class="flex-1 min-h-0" style="padding:8px 12px;">${cuGridHTML(orderedTiles)}</div>
            ${!peerIds.length ? `<div class="text-center text-xs pb-2 flex-shrink-0 leading-relaxed" style="color:rgba(255,255,255,.6);">No one else has joined this lecture yet.<br>Invite them from the People tab.</div>` : ''}`;
        }

        let lectureChannel = null;
        let myLecturePeerId = null;
        let lecturePresence = {}; 
        let lecturePeerConnections = {}; 
        let lectureRemoteStreams = {}; 
        let lecturePendingIce = {}; 
        let lectureRemoteDescSet = {}; 

        function lectureIsTeacher(){
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          return !!(cls && cls.role === 'teacher');
        }

        function joinLectureSignaling(lectureId){
          const sb = getSupabaseClient();
          if (!sb) return; 
          myLecturePeerId = newCallPeerId();
          lecturePresence = {};
          lecturePeerConnections = {};
          lectureRemoteStreams = {};
          lecturePendingIce = {};
          lectureRemoteDescSet = {};
          lectureChannel = sb.channel(`lecture:${lectureId}`, { config: { broadcast: { self: false }, presence: { key: myLecturePeerId } } });
          lectureChannel.on('broadcast', { event: 'lecture-signal' }, ({ payload }) => handleLectureSignal(payload));
          lectureChannel.on('presence', { event: 'sync' }, () => syncLecturePresence());
          lectureChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              lectureChannel.track({ name: (profileData && profileData.name) || 'Student', photo: (profileData && profileData.photo) || null, muted: liveLectureState.muted, camOff: liveLectureState.camOff, handRaised: false, isTeacher: lectureIsTeacher() });
            }
          });
        }

        function syncLecturePresence(){
          if (!lectureChannel) return;
          const state = lectureChannel.presenceState();
          const seen = new Set();
          const newlyJoined = [];
          Object.keys(state).forEach(key => {
            if (key === myLecturePeerId) return;
            const meta = (state[key] && state[key][0]) || {};
            seen.add(key);
            if (!lecturePresence[key]) newlyJoined.push(key);
            lecturePresence[key] = { name: meta.name || 'Student', photo: meta.photo || null, muted: !!meta.muted, camOff: !!meta.camOff, handRaised: !!meta.handRaised, isTeacher: !!meta.isTeacher };
            ensureLecturePeerConnection(key);
          });
          let anyoneLeft = false;
          Object.keys(lecturePresence).forEach(key => { if (!seen.has(key)) { anyoneLeft = true; leaveLecturePeer(key); } });
          if (newlyJoined.length || anyoneLeft) {
            updateLectureStageContent();
          } else {
            updateLectureRemoteBadges();
          }
          if (newlyJoined.length && lectureIsTeacher()) {
            broadcastLectureSignal({ type: 'view', view: liveLectureState.view, strokes: whiteboardStrokes });
          }
        }

        function leaveLecturePeer(key){
          delete lecturePresence[key];
          delete lectureRemoteStreams[key];
          const pc = lecturePeerConnections[key];
          if (pc) { pc.onicecandidate = null; pc.ontrack = null; pc.onnegotiationneeded = null; pc.close(); }
          delete lecturePeerConnections[key];
          delete lecturePendingIce[key];
          delete lectureRemoteDescSet[key];
        }

        function ensureLecturePeerConnection(peerId){
          if (lecturePeerConnections[peerId]) return lecturePeerConnections[peerId];
          const pc = new RTCPeerConnection(RTC_ICE_SERVERS);
          lecturePeerConnections[peerId] = pc;
          lecturePendingIce[peerId] = [];
          lectureRemoteDescSet[peerId] = false;
          if (lectureLocalStream) {
            lectureLocalStream.getTracks().forEach(t => {
              if (t.kind === 'video' && liveLectureState.screenSharing && lectureScreenStream) {
                pc.addTrack(lectureScreenStream.getVideoTracks()[0], lectureScreenStream);
              } else {
                pc.addTrack(t, lectureLocalStream);
              }
            });
          }
          pc.onicecandidate = (e) => {
            if (e.candidate) broadcastLectureSignal({ type: 'rtc-ice', to: peerId, candidate: e.candidate });
          };
          pc.ontrack = (e) => {
            lectureRemoteStreams[peerId] = e.streams[0];
            if (typeof syncLectureBgAudio === 'function') syncLectureBgAudio();
            attachLectureRemoteVideo(peerId);
            rerenderLectureScreen();
          };
          pc.onnegotiationneeded = async () => {
            if (myLecturePeerId < peerId) return; 
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              broadcastLectureSignal({ type: 'rtc-offer', to: peerId, sdp: offer });
            } catch (e) {  }
          };
          return pc;
        }

        function attachLocalTracksToLecturePeers(){
          if (!lectureLocalStream) return;
          Object.values(lecturePeerConnections).forEach(pc => {
            const already = pc.getSenders().map(s => s.track);
            lectureLocalStream.getTracks().forEach(t => { if (!already.includes(t)) pc.addTrack(t, lectureLocalStream); });
          });
        }

        async function flushLecturePendingIce(peerId, pc){
          const queued = lecturePendingIce[peerId] || [];
          for (const c of queued) { try { await pc.addIceCandidate(c); } catch (e) {  } }
          lecturePendingIce[peerId] = [];
        }

        function attachLectureRemoteVideo(peerId){
          const v = document.getElementById('lecture-remote-video-' + peerId);
          const stream = lectureRemoteStreams[peerId];
          if (v && stream) v.srcObject = stream;
        }

        function teardownLectureSignaling(){
          Object.keys(lecturePeerConnections).forEach(leaveLecturePeer);
          lecturePeerConnections = {};
          lectureRemoteStreams = {};
          lecturePresence = {};
          lecturePendingIce = {};
          lectureRemoteDescSet = {};
          myLecturePeerId = null;
          if (lectureChannel) {
            const sb = getSupabaseClient();
            if (sb) sb.removeChannel(lectureChannel);
            lectureChannel = null;
          }
        }

        function broadcastLectureSignal(payload){
          if (!lectureChannel) return;
          lectureChannel.send({ type: 'broadcast', event: 'lecture-signal', payload: Object.assign({ lectureId: liveLectureState.lectureId, from: myLecturePeerId }, payload) });
        }

        function handleLectureSignal(payload){
          if (!liveLectureState.connected || payload.lectureId !== liveLectureState.lectureId) return;
          if (payload.type === 'rtc-offer' || payload.type === 'rtc-answer' || payload.type === 'rtc-ice') {
            if (payload.to !== myLecturePeerId || !payload.from) return;
            const peerId = payload.from;
            const pc = ensureLecturePeerConnection(peerId);
            if (payload.type === 'rtc-offer') {
              pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
                .then(() => { lectureRemoteDescSet[peerId] = true; return flushLecturePendingIce(peerId, pc); })
                .then(() => pc.createAnswer())
                .then(answer => pc.setLocalDescription(answer).then(() => {
                  broadcastLectureSignal({ type: 'rtc-answer', to: peerId, sdp: answer });
                }));
            } else if (payload.type === 'rtc-answer') {
              pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)).then(() => {
                lectureRemoteDescSet[peerId] = true;
                flushLecturePendingIce(peerId, pc);
              });
            } else if (payload.type === 'rtc-ice') {
              if (lectureRemoteDescSet[peerId]) { pc.addIceCandidate(payload.candidate).catch(() => {}); }
              else { lecturePendingIce[peerId] = lecturePendingIce[peerId] || []; lecturePendingIce[peerId].push(payload.candidate); }
            }
            return;
          }
          if (payload.type === 'reaction') {
            addLectureFloatingReaction(payload.id, payload.icon, payload.name, payload.big);
            return;
          }
          if (payload.type === 'comment') {
            addLectureFloatingComment(payload.id, payload.text, payload.name);
            return;
          }
          if (payload.type === 'mute-all') {
            // Only the teacher's mute-all counts
            const sender = lecturePresence[payload.from];
            if (lectureIsTeacher() || !sender || !sender.isTeacher) return;
            if (!liveLectureState.muted) {
              liveLectureState.muted = true;
              applyLectureTrackStates();
              updateLectureLocalBadges();
              updateLectureControlBarButtons();
              updateLecturePresenceTrack();
              updateLectureInlinePanel();
              if (typeof updateMinimizedCallBanner === 'function') updateMinimizedCallBanner();
              callToast('Your teacher muted everyone');
            }
            return;
          }
          if (payload.type === 'screen-share') {
            const peerId = payload.from;
            if (peerId && lecturePresence[peerId]) {
              lecturePresence[peerId].sharingScreen = !!payload.active;
              updateLectureStageContent();
            }
            return;
          }
          if (payload.type === 'end') {
            endLecture(true);
            openAppAlertModal('Your teacher ended the lecture.');
            return;
          }
          if (lectureIsTeacher()) return; 
          if (payload.type === 'view') {
            if (Array.isArray(payload.strokes)) whiteboardStrokes = payload.strokes.slice();
            liveLectureState.view = payload.view;
            rerenderLectureScreen();
            if (payload.view === 'whiteboard') setTimeout(initWhiteboardCanvas, 0);
          } else if (payload.type === 'wb-strokes') {
            whiteboardStrokes = payload.strokes.slice();
            redrawWhiteboard();
          } else if (payload.type === 'attachment-add') {
            handleRemoteAttachmentAdd(payload);
          } else if (payload.type === 'attachment-remove') {
            const a = lectureAttachments.find(x => x.id === payload.id);
            if (a && a.url) URL.revokeObjectURL(a.url);
            if (lecturePreview && a && lecturePreview.url === a.url) closeFilePreview();
            lectureAttachments = lectureAttachments.filter(x => x.id !== payload.id);
            rerenderLectureScreen();
          } else if (payload.type === 'attachment-open') {
            const a = lectureAttachments.find(x => x.id === payload.id);
            if (a) openLectureAttachment(a.id);
            else pendingAutoOpenAttachmentId = payload.id;
          }
        }

        let pendingAutoOpenAttachmentId = null;
        async function handleRemoteAttachmentAdd(payload){
          if (lectureAttachments.some(x => x.id === payload.id)) return; 
          const placeholder = { id: payload.id, name: payload.name, kind: payload.kind, file: null, url: null, status: 'loading' };
          lectureAttachments.push(placeholder);
          rerenderLectureScreen();
          try {
            const { file, url } = await materializeRemoteLectureFile(payload.remoteUrl);
            const a = lectureAttachments.find(x => x.id === payload.id);
            if (!a) return; 
            a.file = file; a.url = url; a.status = 'ready';
            rerenderLectureScreen();
            if (pendingAutoOpenAttachmentId === payload.id) {
              pendingAutoOpenAttachmentId = null;
              openLectureAttachment(payload.id);
            }
          } catch (err) {
            const a = lectureAttachments.find(x => x.id === payload.id);
            if (a) { a.status = 'error'; rerenderLectureScreen(); }
          }
        }

        let whiteboardStrokes = [];
        let whiteboardTool = 'pen';
        let whiteboardColor = '#111827';
        let whiteboardDrawState = null;
        let whiteboardCtx = null;
        let whiteboardPrevTool = null; 
        let whiteboardAttachment = null; 
        const WHITEBOARD_COLORS = ['#111827','#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed'];

        // ---- Lecture whiteboard: tools, drawing, undo/clear ----
        function wbToolIcon(t){
          return { pen: 'penTool', square: 'square', circle: 'circle', line: 'lineTool', text: 'textTool', eraser: 'eraser' }[t] || 'penTool';
        }

        const WB_TOOL_LABELS = { pen: 'Pen (freehand)', square: 'Square', circle: 'Circle', line: 'Line', text: 'Text', eraser: 'Eraser' };

        function lectureWhiteboardHTML(){
          const isTeacher = lectureIsTeacher();
          return `
            <div class="flex-1 flex flex-col bg-white min-h-0" style="margin:0 10px 10px;border-radius:22px;overflow:hidden;color:#1f2937;">
              ${isTeacher ? `
              <div class="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 overflow-x-auto flex-shrink-0">
                ${['pen','square','circle','line','text','eraser'].map(t => `
                  <button onclick="wbSetTool('${t}')" title="${WB_TOOL_LABELS[t]}" class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="${whiteboardTool === t ? `background:${NAVY};color:#ffffff;box-shadow:0 0 0 2px ${NAVY}55;` : 'background:#f3f4f6;color:#4b5563;'}">${Icon(wbToolIcon(t), t === 'text' ? 'w-5 h-5' : 'w-4 h-4')}</button>`).join('')}
                <div class="w-px h-6 bg-gray-200 flex-shrink-0 mx-1"></div>
                ${WHITEBOARD_COLORS.map(c => `
                  <button onclick="wbSetColor('${c}')" class="w-6 h-6 rounded-full flex-shrink-0" style="background:${c};${whiteboardColor === c ? `box-shadow:0 0 0 2px #fff, 0 0 0 4px ${NAVY};` : ''}"></button>`).join('')}
                <div class="w-px h-6 bg-gray-200 flex-shrink-0 mx-1"></div>
                <button onclick="wbUndo()" title="Undo" class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-600">${Icon('undo','w-4 h-4')}</button>
                <button onclick="wbToggleDeleteSelect()" title="${whiteboardTool === 'delete' ? 'Cancel' : 'Select area to delete'}" class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="${whiteboardTool === 'delete' ? `background:${NAVY};color:#ffffff;box-shadow:0 0 0 2px ${NAVY}55;` : 'background:#f3f4f6;color:#4b5563;'}">${Icon('trash','w-4 h-4')}</button>
                <div class="w-px h-6 bg-gray-200 flex-shrink-0 mx-1"></div>
                <button onclick="wbAttachFile()" title="Attach PPTX/PDF" class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-600">${Icon('paperclip','w-4 h-4')}</button>
                <input type="file" id="wb-attach-input" accept=".pdf,.pptx" class="hidden" onchange="handleWbAttachFile(event)">
              </div>` : `
              <div class="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
                <span class="text-xs font-semibold text-gray-400">Your teacher is presenting the whiteboard</span>
              </div>`}
              <div id="lecture-whiteboard-stage" class="flex-1 relative bg-white overflow-hidden">
                <canvas id="lecture-whiteboard-canvas" class="absolute inset-0 w-full h-full" style="touch-action:${isTeacher ? 'none' : 'auto'};"></canvas>
              </div>
            </div>`;
        }

        function wbAttachFile(){
          const input = document.getElementById('wb-attach-input');
          if (input) input.click();
        }

        function handleWbAttachFile(event){
          const file = event.target.files && event.target.files[0];
          event.target.value = '';
          if (!file) return;
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          if (ext !== 'pdf' && ext !== 'pptx') { openAppAlertModal('Please choose a PDF or PPTX file to attach.'); return; }
          whiteboardAttachment = { name: file.name, file, url: URL.createObjectURL(file) };
          rerenderLectureScreen();
        }

        function openWhiteboardAttachmentPreview(){
          if (!whiteboardAttachment) return;
          lectureResourcesPanelOpen = false;
          openFilePreview(whiteboardAttachment.name, whiteboardAttachment.url, whiteboardAttachment.file);
        }

        function wbRemoveAttachment(){
          if (whiteboardAttachment && whiteboardAttachment.url) URL.revokeObjectURL(whiteboardAttachment.url);
          if (lecturePreview && whiteboardAttachment && lecturePreview.url === whiteboardAttachment.url) closeFilePreview();
          whiteboardAttachment = null;
          rerenderLectureScreen();
        }

        function wbCanvasCursor(){
          return whiteboardTool === 'text' ? 'text' : 'crosshair';
        }

        let wbWindowPointerUpWired = false;

        function initWhiteboardCanvas(){
          const canvas = document.getElementById('lecture-whiteboard-canvas');
          if (!canvas) return;
          const parent = canvas.parentElement;
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
          canvas.style.cursor = wbCanvasCursor();
          whiteboardCtx = canvas.getContext('2d');
          redrawWhiteboard();
          if (!canvas.dataset.wired && lectureIsTeacher()) {
            canvas.dataset.wired = '1';
            canvas.addEventListener('pointerdown', wbPointerDown);
            canvas.addEventListener('pointermove', wbPointerMove);
            if (!wbWindowPointerUpWired) {
              wbWindowPointerUpWired = true;
              window.addEventListener('pointerup', wbPointerUp);
            }
          }
        }

        function wbCanvasPoint(e){
          const canvas = document.getElementById('lecture-whiteboard-canvas');
          const rect = canvas.getBoundingClientRect();
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function wbPointerDown(e){
          if (liveLectureState.view !== 'whiteboard') return;
          if (document.getElementById('wb-text-input')) return; 
          if (e.cancelable) e.preventDefault();
          const p = wbCanvasPoint(e);
          if (whiteboardTool === 'text') {
            wbStartTextInput(p);
            return;
          }
          whiteboardDrawState = { tool: whiteboardTool, color: whiteboardTool === 'eraser' ? '#ffffff' : whiteboardColor, points: [p], x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        }

        function wbStartTextInput(p){
          const stage = document.getElementById('lecture-whiteboard-stage');
          if (!stage) return;
          const input = document.createElement('input');
          input.type = 'text';
          input.id = 'wb-text-input';
          input.placeholder = 'Type...';
          input.style.cssText = `position:absolute;left:${p.x}px;top:${p.y - 14}px;background:transparent;border:1px dashed ${whiteboardColor};outline:none;font:20px Montserrat, sans-serif;color:${whiteboardColor};padding:2px 4px;min-width:120px;z-index:5;`;
          const commit = () => {
            const text = input.value.trim();
            if (input.parentNode) input.parentNode.removeChild(input);
            if (text) { whiteboardStrokes.push({ tool: 'text', color: whiteboardColor, x: p.x, y: p.y, text }); redrawWhiteboard(); broadcastLectureSignal({ type: 'wb-strokes', strokes: whiteboardStrokes }); }
          };
          input.addEventListener('keydown', ev => {
            if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            else if (ev.key === 'Escape') { input.value = ''; input.blur(); }
          });
          input.addEventListener('blur', commit);
          stage.appendChild(input);
          input.focus();
        }

        function wbPointerMove(e){
          if (!whiteboardDrawState) return;
          const p = wbCanvasPoint(e);
          if (whiteboardDrawState.tool === 'pen' || whiteboardDrawState.tool === 'eraser') whiteboardDrawState.points.push(p);
          else { whiteboardDrawState.x1 = p.x; whiteboardDrawState.y1 = p.y; }
          redrawWhiteboard(whiteboardDrawState);
        }

        function wbPointerUp(){
          if (!whiteboardDrawState) return;
          if (whiteboardDrawState.tool === 'delete') {
            wbDeleteInRegion(whiteboardDrawState);
            whiteboardDrawState = null;
            whiteboardTool = whiteboardPrevTool || 'pen';
            whiteboardPrevTool = null;
            rerenderLectureScreen();
            return;
          }
          whiteboardStrokes.push(whiteboardDrawState);
          whiteboardDrawState = null;
          broadcastLectureSignal({ type: 'wb-strokes', strokes: whiteboardStrokes });
        }

        function redrawWhiteboard(preview){
          if (!whiteboardCtx) return;
          const canvas = whiteboardCtx.canvas;
          whiteboardCtx.clearRect(0, 0, canvas.width, canvas.height);
          whiteboardStrokes.forEach(s => drawWhiteboardItem(whiteboardCtx, s));
          if (preview) drawWhiteboardItem(whiteboardCtx, preview);
        }

        function drawWhiteboardItem(ctx, s){
          if (s.tool === 'delete') {
            const x = Math.min(s.x0, s.x1), y = Math.min(s.y0, s.y1);
            const w = Math.abs(s.x1 - s.x0), h = Math.abs(s.y1 - s.y0);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 1.5;
            ctx.fillStyle = 'rgba(220,38,38,0.1)';
            ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
            ctx.restore();
            return;
          }
          ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
          ctx.lineWidth = s.tool === 'eraser' ? 18 : 3;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          if (s.tool === 'pen' || s.tool === 'eraser') {
            if (s.points.length < 2) { ctx.beginPath(); ctx.arc(s.points[0].x, s.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
            ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y);
            s.points.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
          } else if (s.tool === 'square') {
            ctx.strokeRect(Math.min(s.x0, s.x1), Math.min(s.y0, s.y1), Math.abs(s.x1 - s.x0), Math.abs(s.y1 - s.y0));
          } else if (s.tool === 'circle') {
            const rx = Math.abs(s.x1 - s.x0) / 2, ry = Math.abs(s.y1 - s.y0) / 2;
            ctx.beginPath(); ctx.ellipse((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, rx || 0.01, ry || 0.01, 0, 0, Math.PI * 2); ctx.stroke();
          } else if (s.tool === 'line') {
            ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
          } else if (s.tool === 'text') {
            ctx.font = '20px Montserrat, sans-serif'; ctx.fillText(s.text, s.x, s.y);
          }
        }

        function wbSetTool(t){ whiteboardTool = t; rerenderLectureScreen(); }
        function wbSetColor(c){ whiteboardColor = c; rerenderLectureScreen(); }
        function wbUndo(){ whiteboardStrokes.pop(); redrawWhiteboard(); broadcastLectureSignal({ type: 'wb-strokes', strokes: whiteboardStrokes }); }
        function wbClear(){ openAppConfirmModal('Clear the whiteboard?', '', 'Clear', function(){ whiteboardStrokes = []; redrawWhiteboard(); broadcastLectureSignal({ type: 'wb-strokes', strokes: whiteboardStrokes }); }); }

        function wbToggleDeleteSelect(){
          if (whiteboardTool === 'delete') {
            whiteboardTool = whiteboardPrevTool || 'pen';
            whiteboardPrevTool = null;
          } else {
            whiteboardPrevTool = whiteboardTool;
            whiteboardTool = 'delete';
          }
          rerenderLectureScreen();
        }

        function wbStrokeBounds(s){
          if (s.tool === 'pen' || s.tool === 'eraser') {
            if (!s.points || !s.points.length) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            s.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            return { minX, minY, maxX, maxY };
          }
          if (s.tool === 'square' || s.tool === 'circle' || s.tool === 'line') {
            return { minX: Math.min(s.x0, s.x1), minY: Math.min(s.y0, s.y1), maxX: Math.max(s.x0, s.x1), maxY: Math.max(s.y0, s.y1) };
          }
          if (s.tool === 'text') {
            let w = s.text.length * 11;
            if (whiteboardCtx) { whiteboardCtx.font = '20px Montserrat, sans-serif'; w = whiteboardCtx.measureText(s.text).width; }
            return { minX: s.x, minY: s.y - 20, maxX: s.x + w, maxY: s.y + 6 };
          }
          return null;
        }

        function wbDeleteInRegion(sel){
          const rx0 = Math.min(sel.x0, sel.x1), rx1 = Math.max(sel.x0, sel.x1);
          const ry0 = Math.min(sel.y0, sel.y1), ry1 = Math.max(sel.y0, sel.y1);
          if (rx1 - rx0 < 4 && ry1 - ry0 < 4) return;
          const before = whiteboardStrokes.length;
          whiteboardStrokes = whiteboardStrokes.filter(s => {
            const b = wbStrokeBounds(s);
            if (!b) return true;
            const intersects = !(b.maxX < rx0 || b.minX > rx1 || b.maxY < ry0 || b.minY > ry1);
            return !intersects;
          });
          if (whiteboardStrokes.length !== before) broadcastLectureSignal({ type: 'wb-strokes', strokes: whiteboardStrokes });
        }

        let lectureSlides = null; 

        // ---- Lecture slide upload + navigation (present mode) ----
        function handleLectureSlideFile(event){
          const file = event.target.files && event.target.files[0];
          event.target.value = '';
          if (!file) return;
          const ext = (file.name.split('.').pop() || '').toLowerCase();
          if (ext === 'pdf') loadPdfSlides(file);
          else if (ext === 'pptx') loadPptxSlides(file);
          else openAppAlertModal('Please choose a PDF or PPTX file to present.');
        }

        async function loadPdfSlides(file){
          try {
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            lectureSlides = { type: 'pdf', pdfDoc: pdf, total: pdf.numPages, current: 1, fileName: file.name };
            setLectureView('slides');
          } catch (err) {
            openAppAlertModal('Could not open this PDF: ' + err.message);
          }
        }

        async function loadPptxSlides(file){
          try {
            const zip = await JSZip.loadAsync(file);
            const slideFiles = Object.keys(zip.files)
              .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
              .sort((a, b) => parseInt(a.match(/slide(\d+)\.xml/)[1]) - parseInt(b.match(/slide(\d+)\.xml/)[1]));
            if (!slideFiles.length) throw new Error('No slides found in this file');
            const parser = new DOMParser();
            const slides = [];
            for (const name of slideFiles) {
              const xml = await zip.files[name].async('text');
              const doc = parser.parseFromString(xml, 'application/xml');
              const paragraphs = [...doc.getElementsByTagName('a:p')];
              const texts = paragraphs
                .map(p => [...p.getElementsByTagName('a:t')].map(t => t.textContent).join(''))
                .filter(t => t.trim());
              slides.push({ title: texts[0] || '(untitled slide)', bullets: texts.slice(1) });
            }
            lectureSlides = { type: 'pptx', slides, current: 0, fileName: file.name };
            setLectureView('slides');
          } catch (err) {
            openAppAlertModal('Could not read this PPTX file: ' + err.message);
          }
        }

        async function renderPdfSlidePage(){
          if (!lectureSlides || lectureSlides.type !== 'pdf') return;
          const canvas = document.getElementById('lecture-slide-canvas');
          if (!canvas) return;
          const page = await lectureSlides.pdfDoc.getPage(lectureSlides.current);
          const container = canvas.parentElement;
          const unscaled = page.getViewport({ scale: 1 });
          const scale = Math.max(0.1, Math.min(container.clientWidth / unscaled.width, container.clientHeight / unscaled.height)) || 1;
          const viewport = page.getViewport({ scale });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }

        function lectureSlideNav(dir){
          if (!lectureSlides) return;
          if (lectureSlides.type === 'pdf') {
            const next = lectureSlides.current + dir;
            if (next < 1 || next > lectureSlides.total) return;
            lectureSlides.current = next;
          } else {
            const next = lectureSlides.current + dir;
            if (next < 0 || next >= lectureSlides.slides.length) return;
            lectureSlides.current = next;
          }
          rerenderLectureScreen();
        }

        function lectureSlidesHTML(){
          if (!lectureSlides) {
            return `
              <div class="flex-1 flex flex-col items-center justify-center text-white/70 px-8 text-center gap-3">
                ${Icon('monitor','w-10 h-10')}
                <div class="text-sm">Present a PDF or PowerPoint to the class</div>
                <button onclick="toggleLecturePresent()" class="text-sm font-bold px-4 py-2 rounded-full bg-white text-[${NAVY}]">Choose file</button>
              </div>`;
          }
          if (lectureSlides.type === 'pdf') {
            return `
              <div class="flex-1 flex flex-col min-h-0">
                <div class="flex-1 flex items-center justify-center overflow-hidden p-2 min-h-0">
                  <canvas id="lecture-slide-canvas" class="max-w-full max-h-full bg-white rounded-lg shadow"></canvas>
                </div>
                <div class="flex items-center justify-center gap-4 pb-2 flex-shrink-0">
                  <button onclick="lectureSlideNav(-1)" title="Previous" class="w-9 h-9 rounded-full cu-soft-btn flex items-center justify-center">${IconBold('back','w-4 h-4')}</button>
                  <div class="text-sm font-semibold text-white">Slide ${lectureSlides.current} / ${lectureSlides.total}</div>
                  <button onclick="lectureSlideNav(1)" title="Next" class="w-9 h-9 rounded-full cu-soft-btn flex items-center justify-center">${Icon('arrowRight','w-4 h-4')}</button>
                </div>
              </div>`;
          }
          const slide = lectureSlides.slides[lectureSlides.current];
          return `
            <div class="flex-1 flex flex-col min-h-0">
              <div class="flex-1 flex items-center justify-center p-3 min-h-0">
                <div class="w-full bg-white rounded-xl shadow p-6 flex flex-col overflow-y-auto" style="aspect-ratio:16/9;">
                  <div class="text-lg font-bold text-gray-800 mb-3">${escapeHtml(slide.title)}</div>
                  ${slide.bullets.length ? `<ul class="text-sm text-gray-600 space-y-1.5 list-disc pl-5">${slide.bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
                </div>
              </div>
              <div class="flex items-center justify-center gap-4 pb-2 flex-shrink-0">
                <button onclick="lectureSlideNav(-1)" title="Previous" class="w-9 h-9 rounded-full cu-soft-btn flex items-center justify-center">${IconBold('back','w-4 h-4')}</button>
                <div class="text-sm font-semibold text-white">Slide ${lectureSlides.current + 1} / ${lectureSlides.slides.length}</div>
                <button onclick="lectureSlideNav(1)" title="Next" class="w-9 h-9 rounded-full cu-soft-btn flex items-center justify-center">${Icon('arrowRight','w-4 h-4')}</button>
              </div>
            </div>`;
        }

        // ---- Lecture bottom sheets (reactions/comments/more) ----
        function lectureSheetsRegionHTML(view){
          return `
            ${(lectureReactionsSheetOpen || lectureMoreSheetOpen) ? `<div onclick="closeLectureSheets()" class="cu-backdrop"></div>` : ''}
            ${lectureReactionsSheetOpen ? lectureReactionsSheetHTML() : ''}
            ${lectureMoreSheetOpen ? lectureMoreSheetHTML(view) : ''}`;
        }

        function lectureCallHTML(){
          ensureCallUiStyles();
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          const isTeacher = cls && cls.role === 'teacher';
          const view = liveLectureState.view;
          const isWhiteboard = view === 'whiteboard';
          const headerLabel = view === 'whiteboard' ? 'Whiteboard' : (view === 'slides' ? (lectureSlides ? lectureSlides.fileName : 'Present') : (cls ? cls.name : 'Lecture'));
          const stageHTML = view === 'whiteboard' ? lectureWhiteboardHTML() : (view === 'slides' ? lectureSlidesHTML() : lectureGridHTML());
          const resourceCount = lectureAttachments.length + (whiteboardAttachment ? 1 : 0);
          const isDesktopLecture = window.innerWidth >= 1024;
          return `
            <div id="lecture-call-screen" class="cu-screen" style="padding-top:var(--top-safe-pad);">
              <input type="file" id="lecture-slide-input" accept=".pdf,.pptx" class="hidden" onchange="handleLectureSlideFile(event)">
              <input type="file" id="lecture-doc-input" accept=".pdf" class="hidden" onchange="handleLectureDocAttach(event)">
              <input type="file" id="lecture-media-input" accept="image/*,video/*" class="hidden" onchange="handleLectureMediaAttach(event)">
              <div class="cu-top">
                <button onclick="${(isWhiteboard && isTeacher) ? 'toggleLectureWhiteboard()' : 'minimizeLecture()'}" title="Back" class="cu-glass">${IconBold('back','w-5 h-5')}</button>
                <div class="cu-title">
                  <div class="cu-title-name">${escapeHtml(headerLabel)}</div>
                  <div class="cu-status"><span id="lecture-call-timer">${formatCallTime(liveLectureState.seconds)}</span> · Live</div>
                </div>
                ${!isDesktopLecture ? `
                <button onclick="toggleLectureResourcesPanel()" title="Class Pad" class="cu-glass">
                  ${Icon('doc','w-5 h-5')}
                  ${resourceCount ? `<span class="cu-count">${resourceCount}</span>` : ''}
                </button>` : `<div style="width:42px;height:42px;flex-shrink:0;"></div>`}
              </div>
              <div class="flex-1 flex flex-col min-h-0 relative">
                <div id="lecture-stage-content" class="flex-1 flex flex-col min-h-0 w-full">${stageHTML}</div>
                <div id="lecture-reactions-float" class="absolute flex flex-col items-end gap-1 z-10" style="bottom:10px;right:10px;pointer-events:none;">${lectureReactionsFloatHTML()}</div>
                <div id="lecture-comments-float" class="absolute flex flex-col items-start gap-1 z-10" style="bottom:10px;left:10px;pointer-events:none;max-width:220px;">${lectureCommentsFloatHTML()}</div>
                <div id="lecture-preview-region" class="absolute inset-0 z-20" style="${lecturePreview ? '' : 'pointer-events:none;'}">${lecturePreview ? lecturePreviewHTML() : ''}</div>
                <div id="lecture-resources-panel-region" class="absolute inset-0" style="overflow:hidden;pointer-events:none;${isDesktopLecture ? 'display:none;' : ''}">${isDesktopLecture ? '' : lectureResourcesPanelHTML(resourceCount)}</div>
              </div>
              ${!isWhiteboard ? `<div id="lecture-controls-bar" class="cu-bar">${lectureControlsHTML()}</div>` : ''}
              <div id="lecture-sheets-region">${lectureSheetsRegionHTML(view)}</div>
            </div>`;
        }

        function lectureReactionsSheetHTML(){
          const reactionIcons = [
            { icon: 'clap', label: 'Clap', color: '#f59e0b' },
            { icon: 'thumbsUp', label: 'Like', color: '#2563eb' },
            { icon: 'heart', label: 'Love', color: '#dc2626' },
            { icon: 'laugh', label: 'Haha', color: '#f59e0b' },
            { icon: 'wow', label: 'Wow', color: '#7c3aed' },
            { icon: 'party', label: 'Celebrate', color: '#16a34a' },
          ];
          return `
            <div class="cu-bsheet">
              <div class="cu-bsheet-grab"></div>
              <div class="cu-emoji-row">
                ${reactionIcons.map(r => `<button onclick="sendLectureReaction('${r.icon}')" title="${escapeHtml(r.label)}" class="cu-emoji-btn">${cuEmoji(r.icon)}</button>`).join('')}
              </div>
            </div>`;
        }

        function lectureCommentSheetHTML(){
          // Fixed (not absolute) so its position is computed against the real viewport rather than
          // the lecture screen's inner wrapper
          return `
            <div id="lecture-comment-sheet" class="fixed z-30 flex items-center gap-2 rounded-full shadow-lg bg-white" style="bottom:calc(124px + env(safe-area-inset-bottom,0px));left:10px;right:10px;max-width:380px;margin:0 auto;padding:10px;transition:bottom 0.15s ease-out;">
              <input id="lecture-comment-input" type="text" placeholder="Type a comment..." maxlength="200" class="flex-1 min-w-0 text-sm outline-none bg-transparent" onkeydown="if(event.key==='Enter'){event.preventDefault();sendLectureComment();}" onfocus="handleLectureCommentFocus()" onblur="handleLectureCommentBlur()">
              <button onclick="sendLectureComment()" title="Send" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
            </div>`;
        }

        let lectureCommentInputFocused = false;
        function syncLectureCommentKeyboardInset(){
          const sheet = document.getElementById('lecture-comment-sheet');
          if (!sheet) return;
          if (!lectureCommentInputFocused) { sheet.style.bottom = 'calc(124px + env(safe-area-inset-bottom,0px))'; return; }
          const vv = window.visualViewport;
          const keyboardInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
          sheet.style.bottom = (keyboardInset + 10) + 'px';
        }
        let lectureCommentInsetRAF = null;
        function scheduleLectureCommentKeyboardInsetSync(){
          if (lectureCommentInsetRAF !== null) return;
          lectureCommentInsetRAF = requestAnimationFrame(() => {
            lectureCommentInsetRAF = null;
            syncLectureCommentKeyboardInset();
          });
        }
        function handleLectureCommentFocus(){
          lectureCommentInputFocused = true;
          scheduleLectureCommentKeyboardInsetSync();
        }
        function handleLectureCommentBlur(){
          lectureCommentInputFocused = false;
          scheduleLectureCommentKeyboardInsetSync();
        }
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', scheduleLectureCommentKeyboardInsetSync);
          window.visualViewport.addEventListener('scroll', scheduleLectureCommentKeyboardInsetSync);
        }

        function lectureMoreSheetHTML(view){
          const grid = (onclick, icon, label, active) => `
            <button onclick="${onclick}" class="flex-1 min-w-0 flex flex-col items-center justify-center gap-1.5 py-1">
              <span class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="${active ? 'background:' + NAVY + ';' : 'background:var(--cu-soft);'}">
                ${cuEmoji(icon) ? `<span style="font-size:20px;line-height:1;">${cuEmoji(icon)}</span>` : Icon(icon, `w-5 h-5 ${active ? 'text-white' : ''}`)}
              </span>
              <span class="text-[10px] font-bold truncate" style="${active ? 'color:' + NAVY + ';' : ''}">${label}</span>
            </button>`;
          const isTeacher = lectureIsTeacher();
          const isSharingScreen = !!liveLectureState.screenSharing;
          return `
            <div class="cu-bsheet" style="padding:8px 16px calc(env(safe-area-inset-bottom,0px) + 18px);"><div class="cu-bsheet-grab"></div>
              ${isTeacher ? `
              <div class="flex items-center gap-2.5 mb-4">
                <button onclick="toggleLectureWhiteboard()" class="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-2xl border" style="padding:8px 0.5px;${view === 'whiteboard' ? `background:${NAVY};border-color:${NAVY};` : `color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:var(--cu-sheet);`}">
                  <span class="${view === 'whiteboard' ? 'text-white' : ''}" style="${view === 'whiteboard' ? '' : `color:${NAVY};`}">${Icon('edit','w-5 h-5')}</span>
                  <span class="text-sm font-bold truncate ${view === 'whiteboard' ? 'text-white' : ''}" style="${view === 'whiteboard' ? '' : `color:${NAVY};`}">Whiteboard</span>
                  ${view === 'whiteboard' ? `<span class="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">${Icon('check','w-3 h-3 text-white')}</span>` : ''}
                </button>
                <button onclick="toggleLectureScreenShare()" class="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-2xl border" style="padding:8px 0.5px;${isSharingScreen ? `background:${NAVY};border-color:${NAVY};` : `color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:var(--cu-sheet);`}">
                  <span class="${isSharingScreen ? 'text-white' : ''}" style="${isSharingScreen ? '' : `color:${NAVY};`}">${Icon('monitor','w-5 h-5')}</span>
                  <span class="text-sm font-bold truncate ${isSharingScreen ? 'text-white' : ''}" style="${isSharingScreen ? '' : `color:${NAVY};`}">Share Screen</span>
                  ${isSharingScreen ? `<span class="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">${Icon('check','w-3 h-3 text-white')}</span>` : ''}
                </button>
              </div>
              <button onclick="closeLectureSheets();muteEveryoneInLecture()" class="w-full flex items-center justify-center gap-1.5 rounded-2xl border mb-4" style="padding:8px 0.5px;color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:var(--cu-sheet);">
                <span style="color:${NAVY};">${Icon('muteAll','w-5 h-5')}</span>
                <span class="text-sm font-bold truncate" style="color:${NAVY};">Mute everyone</span>
              </button>` : ''}
              <div class="flex items-start justify-between gap-1">
                ${grid("toggleLectureReactionsSheet()", 'reactions', 'Reactions', false)}
                ${grid("lectureAttachDocuments()", 'doc', 'PDF', false)}
                ${grid("toggleLectureCommentSheet()", 'commentText', 'Comment', lectureCommentSheetOpen)}
                ${grid(`shareLectureLink('${liveLectureState.classId}','${liveLectureState.lectureId}')`, 'link', 'Share', false)}
              </div>
            </div>`;
        }

        // ---- Lecture file attachments (docs/media sharing) ----
        function lectureAttachDocuments(){
          closeLectureSheets();
          const input = document.getElementById('lecture-doc-input');
          if (input) input.click();
        }

        function lectureAttachMedia(){
          closeLectureSheets();
          const input = document.getElementById('lecture-media-input');
          if (input) input.click();
        }

        function handleLectureDocAttach(event){
          const file = event.target.files[0];
          event.target.value = '';
          if (!file) return;
          shareFileIntoLecture(file, 'doc');
        }

        function handleLectureMediaAttach(event){
          const file = event.target.files[0];
          event.target.value = '';
          if (!file) return;
          const isVideo = file.type && file.type.startsWith('video/');
          shareFileIntoLecture(file, isVideo ? 'video' : 'photo');
        }

        function shareFileIntoLecture(file, kind){
          const id = 'la' + Date.now() + Math.random().toString(36).slice(2);
          const url = URL.createObjectURL(file);
          const attachment = { id, name: file.name, kind, file, url };
          lectureAttachments.push(attachment);
          rerenderLectureScreen();
          openLectureAttachment(id);

          const lectureId = liveLectureState.lectureId;
          uploadLectureFileToStorage(file, lectureId, id).then(remoteUrl => {
            if (!remoteUrl) return; 
            if (liveLectureState.lectureId !== lectureId) return; 
            broadcastLectureSignal({ type: 'attachment-add', id, name: file.name, kind, remoteUrl });
          });
        }

        function removeLectureAttachment(id){
          const a = lectureAttachments.find(x => x.id === id);
          if (a) {
            if (a.url) URL.revokeObjectURL(a.url);
            if (lecturePreview && lecturePreview.url === a.url) closeFilePreview();
          }
          lectureAttachments = lectureAttachments.filter(a => a.id !== id);
          rerenderLectureScreen();
          broadcastLectureSignal({ type: 'attachment-remove', id });
        }

        function openLectureAttachment(id){
          const a = lectureAttachments.find(x => x.id === id);
          if (!a) return;
          lectureResourcesPanelOpen = false;
          openFilePreview(a.name, a.url, a.file, a.kind === 'photo' ? 'image' : a.kind === 'video' ? 'video' : null);
          if (lectureIsTeacher()) broadcastLectureSignal({ type: 'attachment-open', id });
        }

        function getLectureResourceItems(){
          return [
            ...(whiteboardAttachment ? [{ id: '__wb', name: whiteboardAttachment.name, kind: 'doc', isWhiteboard: true }] : []),
            ...lectureAttachments,
          ];
        }

        // ---- Classroom resources panel (Class Pad) ----
        function classPadResourcesHTML(){
          const iconFor = kind => kind === 'doc' ? 'doc' : kind === 'video' ? 'video' : 'camera';
          const items = getLectureResourceItems();
          return `
            <div class="mt-5">
              <div class="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('doc','w-3.5 h-3.5')}</span>
                Resources${items.length ? ` (${items.length})` : ''}
              </div>
              ${items.length ? items.map(a => `
                <div class="flex items-center gap-2 bg-gray-50 rounded-2xl pl-2 pr-1 py-1.5 mb-2">
                  <button ${a.status && a.status !== 'ready' ? 'disabled' : ''} onclick="${a.isWhiteboard ? 'openWhiteboardAttachmentPreview()' : `openLectureAttachment('${a.id}')`}" title="Open ${escapeHtml(a.name)}" class="flex items-center gap-2 flex-1 min-w-0 text-left ${a.status && a.status !== 'ready' ? 'opacity-60' : ''}">
                    <span class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(iconFor(a.kind),'w-4 h-4')}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-xs font-semibold text-gray-700 truncate">${escapeHtml(a.name)}</span>
                      ${a.status === 'loading' ? `<span class="block text-[10px] text-gray-400 truncate">Receiving\u2026</span>` : a.status === 'error' ? `<span class="block text-[10px] text-red-500 truncate">Failed to receive</span>` : ''}
                    </span>
                  </button>
                  <button onclick="${a.isWhiteboard ? 'wbRemoveAttachment()' : `removeLectureAttachment('${a.id}')`}" title="Remove" class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-gray-400">${Icon('close','w-3.5 h-3.5')}</button>
                </div>`).join('') : `<div class="text-gray-400 text-sm text-center py-6">Files shared into this class will show up here.</div>`}
            </div>`;
        }

        function classPadUploadedResourcesHTML(){
          return `
            <div class="mt-5">
              <div class="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('upload','w-3.5 h-3.5')}</span>
                Uploaded Resources${uploadedResources.length ? ` (${uploadedResources.length})` : ''}
              </div>
              ${uploadedResources.length ? uploadedResources.map(r => `
                <div class="flex items-center gap-2 bg-gray-50 rounded-2xl pl-2 pr-1 py-1.5 mb-2">
                  <button ${r.status === 'ready' ? `onclick="openUploadedResourcePreview('${r.id}')"` : 'disabled'} title="${escapeHtml(r.name)}" class="flex items-center gap-2 flex-1 min-w-0 text-left ${r.status === 'ready' ? '' : 'opacity-60'}">
                    <span class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('file','w-4 h-4')}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-xs font-semibold text-gray-700 truncate">${escapeHtml(r.name)}</span>
                      <span class="block text-[10px] ${r.status === 'error' ? 'text-red-500' : 'text-gray-400'} truncate">${r.status === 'processing' ? 'Scanning\u2026' : r.status === 'error' ? (r.error || 'Failed to process') : 'Tap to view'}</span>
                    </span>
                  </button>
                </div>`).join('') : `<div class="text-gray-400 text-sm text-center py-6">Files you upload in Resources will show up here too.</div>`}
            </div>`;
        }

        function openUploadedResourcePreview(id){
          const r = uploadedResources.find(x => x.id === id);
          if (!r || r.status !== 'ready' || !r.file) return;
          lectureResourcesPanelOpen = false;
          openFilePreview(r.name, r.url, r.file);
        }

        function refreshClassPadUploadedResources(){
          ['desktop','lecture'].forEach(prefix => {
            const el = document.getElementById(`${prefix}-classpad-uploaded-list`);
            if (el) el.innerHTML = classPadUploadedResourcesHTML();
          });
        }

        function lectureResourcesPanelHTML(resourceCount){
          const open = lectureResourcesPanelOpen;
          return `
            ${open ? `<div onclick="toggleLectureResourcesPanel()" class="absolute inset-0 z-30" style="background:rgba(10,15,25,0.25);pointer-events:auto;"></div>` : ''}
            <div class="absolute top-0 right-0 bottom-0 z-40 bg-white shadow-lg flex flex-col transition-transform" style="width:min(80vw,300px);transform:translateX(${open ? '0' : '100%'});pointer-events:auto;">
              <div class="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-gray-100">
                <div class="text-sm font-bold text-gray-800">Class Pad</div>
                <button onclick="toggleLectureResourcesPanel()" title="Close" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-600">${Icon('close','w-4 h-4')}</button>
              </div>
              <div class="flex-1 overflow-y-auto p-3">
                ${classPadBodyHTML('lecture')}
              </div>
            </div>`;
        }

        let lecturePreview = null; 

        // ---- File preview (PDF/PPTX) in lecture/resources ----
        function fileExt(name){ return (name.split('.').pop() || '').toLowerCase(); }

        async function openFilePreview(name, url, file, kindHint){
          const ext = fileExt(name);
          let kind = kindHint || 'other';
          if (!kindHint) {
            if (['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext)) kind = 'image';
            else if (['mp4','mov','webm','m4v'].includes(ext)) kind = 'video';
            else if (ext === 'pdf') kind = 'pdf';
            else if (ext === 'pptx') kind = 'pptx';
            else if (ext === 'docx') kind = 'docx';
            else if (ext === 'txt') kind = 'text';
          }
          const needsParsing = kind === 'pdf' || kind === 'pptx' || kind === 'docx' || kind === 'text';
          lecturePreview = { name, ext, kind, url, file, status: needsParsing ? 'loading' : 'ready' };
          renderLecturePreviewRegion();
          if (!needsParsing) return;
          try {
            if (kind === 'pdf') {
              const buf = await file.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
              if (!lecturePreview || lecturePreview.url !== url) return;
              lecturePreview.pdfDoc = pdf; lecturePreview.pdfTotal = pdf.numPages; lecturePreview.pdfCurrent = 1; lecturePreview.status = 'ready';
              renderLecturePreviewRegion();
            } else if (kind === 'pptx') {
              const zip = await JSZip.loadAsync(file);
              const slideFiles = Object.keys(zip.files)
                .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
                .sort((a, b) => parseInt(a.match(/slide(\d+)\.xml/)[1]) - parseInt(b.match(/slide(\d+)\.xml/)[1]));
              if (!slideFiles.length) throw new Error('No slides found in this file.');
              const parser = new DOMParser();
              const slides = [];
              for (const n of slideFiles) {
                const xml = await zip.files[n].async('text');
                const doc = parser.parseFromString(xml, 'application/xml');
                const paragraphs = [...doc.getElementsByTagName('a:p')];
                const texts = paragraphs
                  .map(p => [...p.getElementsByTagName('a:t')].map(t => t.textContent).join(''))
                  .filter(t => t.trim());
                slides.push({ title: texts[0] || '(untitled slide)', bullets: texts.slice(1) });
              }
              if (!lecturePreview || lecturePreview.url !== url) return;
              lecturePreview.pptxSlides = slides; lecturePreview.pptxCurrent = 0; lecturePreview.status = 'ready';
              renderLecturePreviewRegion();
            } else if (kind === 'docx') {
              const buf = await file.arrayBuffer();
              const result = await mammoth.convertToHtml({ arrayBuffer: buf });
              if (!lecturePreview || lecturePreview.url !== url) return;
              lecturePreview.htmlContent = result.value || '<p>No readable content was found in this file.</p>';
              lecturePreview.status = 'ready';
              renderLecturePreviewRegion();
            } else if (kind === 'text') {
              const t = await file.text();
              if (!lecturePreview || lecturePreview.url !== url) return;
              lecturePreview.textContent = t;
              lecturePreview.status = 'ready';
              renderLecturePreviewRegion();
            }
          } catch (err) {
            if (!lecturePreview || lecturePreview.url !== url) return;
            lecturePreview.status = 'error';
            lecturePreview.error = (err && err.message) ? err.message : 'Could not open this file.';
            renderLecturePreviewRegion();
          }
        }

        function closeFilePreview(){
          lecturePreview = null;
          const el = document.getElementById('lecture-preview-region');
          if (el) { el.innerHTML = ''; el.style.pointerEvents = 'none'; }
        }

        function renderLecturePreviewRegion(){
          const el = document.getElementById('lecture-preview-region');
          if (!el) return;
          el.innerHTML = lecturePreviewHTML();
          el.style.pointerEvents = lecturePreview ? '' : 'none';
          if (lecturePreview && lecturePreview.kind === 'pdf' && lecturePreview.status === 'ready') renderPreviewPdfPage();
        }

        async function renderPreviewPdfPage(){
          if (!lecturePreview || lecturePreview.kind !== 'pdf' || !lecturePreview.pdfDoc) return;
          const canvas = document.getElementById('lecture-preview-pdf-canvas');
          if (!canvas) return;
          const page = await lecturePreview.pdfDoc.getPage(lecturePreview.pdfCurrent);
          const container = canvas.parentElement;
          const unscaled = page.getViewport({ scale: 1 });
          const scale = Math.max(0.1, Math.min(container.clientWidth / unscaled.width, container.clientHeight / unscaled.height)) || 1;
          const viewport = page.getViewport({ scale });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }

        function previewPdfNav(dir){
          if (!lecturePreview || lecturePreview.kind !== 'pdf') return;
          const next = lecturePreview.pdfCurrent + dir;
          if (next < 1 || next > lecturePreview.pdfTotal) return;
          lecturePreview.pdfCurrent = next;
          renderLecturePreviewRegion();
        }

        function previewPptxNav(dir){
          if (!lecturePreview || lecturePreview.kind !== 'pptx') return;
          const next = lecturePreview.pptxCurrent + dir;
          if (next < 0 || next >= lecturePreview.pptxSlides.length) return;
          lecturePreview.pptxCurrent = next;
          renderLecturePreviewRegion();
        }

        function lecturePreviewHTML(){
          if (!lecturePreview) return '';
          const p = lecturePreview;
          const header = `
            <div class="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-gray-100">
              <div class="min-w-0 flex-1" style="padding-right:0.75rem;">
                <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(p.name)}</div>
              </div>
              <button onclick="closeFilePreview()" title="Close" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-600">${Icon('close','w-4 h-4')}</button>
            </div>`;
          let body;
          if (p.status === 'loading') {
            body = `<div class="flex-1 flex items-center justify-center text-gray-400 text-sm">Opening…</div>`;
          } else if (p.status === 'error') {
            body = `
              <div class="flex-1 flex flex-col items-center justify-center text-center px-8" style="gap:0.5rem;">
                ${Icon('doc','w-9 h-9 text-gray-300')}
                <div class="text-sm text-gray-500">${escapeHtml(p.error || 'Could not open this file.')}</div>
              </div>`;
          } else if (p.kind === 'image') {
            body = `<div class="flex-1 flex items-center justify-center p-4 overflow-y-auto"><img src="${escapeHtml(p.url)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:0.75rem;"></div>`;
          } else if (p.kind === 'video') {
            body = `<div class="flex-1 flex items-center justify-center p-4"><video src="${escapeHtml(p.url)}" controls autoplay style="max-width:100%;max-height:100%;border-radius:0.75rem;"></video></div>`;
          } else if (p.kind === 'pdf') {
            body = `
              <div class="flex-1 flex items-center justify-center overflow-hidden p-3" style="min-height:0;">
                <canvas id="lecture-preview-pdf-canvas" class="bg-white shadow" style="max-width:100%;max-height:100%;border-radius:0.5rem;"></canvas>
              </div>
              <div class="flex items-center justify-center gap-4 flex-shrink-0" style="padding-bottom:0.75rem;">
                <button onclick="previewPdfNav(-1)" title="Previous" class="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">${IconBold('back','w-4 h-4')}</button>
                <div class="text-sm font-semibold text-gray-600">Page ${p.pdfCurrent} / ${p.pdfTotal}</div>
                <button onclick="previewPdfNav(1)" title="Next" class="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">${Icon('arrowRight','w-4 h-4')}</button>
              </div>`;
          } else if (p.kind === 'pptx') {
            const slide = p.pptxSlides[p.pptxCurrent];
            body = `
              <div class="flex-1 flex items-center justify-center p-3" style="min-height:0;">
                <div class="w-full bg-white shadow p-6 flex flex-col overflow-y-auto border border-gray-100" style="aspect-ratio:16/9;border-radius:0.75rem;">
                  <div class="text-lg font-bold text-gray-800 mb-3">${escapeHtml(slide.title)}</div>
                  ${slide.bullets.length ? `<ul class="text-sm text-gray-600" style="list-style:disc;padding-left:1.25rem;">${slide.bullets.map(b => `<li style="margin-bottom:0.375rem;">${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
                </div>
              </div>
              <div class="flex items-center justify-center gap-4 flex-shrink-0" style="padding-bottom:0.75rem;">
                <button onclick="previewPptxNav(-1)" title="Previous" class="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">${IconBold('back','w-4 h-4')}</button>
                <div class="text-sm font-semibold text-gray-600">Slide ${p.pptxCurrent + 1} / ${p.pptxSlides.length}</div>
                <button onclick="previewPptxNav(1)" title="Next" class="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">${Icon('arrowRight','w-4 h-4')}</button>
              </div>`;
          } else if (p.kind === 'docx') {
            body = `<div class="flex-1 overflow-y-auto p-5"><div class="text-sm text-gray-700" style="line-height:1.6;">${p.htmlContent}</div></div>`;
          } else if (p.kind === 'text') {
            body = `<div class="flex-1 overflow-y-auto p-5"><div class="text-sm text-gray-700 font-sans" style="white-space:pre-wrap;">${escapeHtml(p.textContent)}</div></div>`;
          } else {
            body = `
              <div class="flex-1 flex flex-col items-center justify-center text-center px-8" style="gap:0.75rem;">
                ${Icon('doc','w-10 h-10 text-gray-300')}
                <div class="text-sm text-gray-500">Preview isn't available for this file type, but it can still be opened.</div>
                <a href="${escapeHtml(p.url)}" download="${escapeHtml(p.name)}" class="text-sm font-bold px-4 py-2 rounded-full text-white" style="background:${NAVY};">Download / Open</a>
              </div>`;
          }
          return `
            <div class="fixed inset-0 z-50 bg-white flex flex-col">
              ${header}
              ${body}
            </div>`;
        }

        // ---- Scheduling a future lecture ----
        function openScheduleLectureOverlay(){
          openOverlay('scheduleLecture');
        }

        // Back arrow on Schedule Lecture returns to the class the teacher was in (same tab), not
        // the Classroom list
        function scheduleLectureBack(){
          openOverlay('classDetail');
        }

        function scheduleLectureHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          return `
            <div class="p-5 flex-1 overflow-y-auto no-scrollbar">
<div style="margin:-1.25rem -1.25rem 0;">${overlayHeader('Let\'s schedule', '20px', 'scheduleLectureBack()', null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
              <div class="text-sm text-gray-500 mb-5">Set up an upcoming lecture for ${cls ? cls.name : 'your class'}; students will see it in the Stream and can join when it's live.</div>
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Lecture title</label>
              <input type="text" id="lecture-title-input" placeholder="e.g. Chapter 4: Market Structures" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm mb-4">
              <div class="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
                  <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" oninput="this.value=formatTypedDateDigits(this.value)" id="lecture-date-input" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm">
                  ${typedDateHintHTML()}
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Time</label>
                  <input type="time" id="lecture-time-input" class="w-full bg-gray-100 border border-gray-300 rounded-2xl px-4 py-3 text-sm">
                </div>
              </div>
            </div>
            <div class="flex-shrink-0 w-full" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
              <button onclick="submitScheduleLecture()" class="w-full font-semibold py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Schedule Lecture</button>
            </div>`;
        }

        function submitScheduleLecture(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const title = document.getElementById('lecture-title-input').value.trim();
          const dateTyped = document.getElementById('lecture-date-input').value;
          const time = document.getElementById('lecture-time-input').value;
          if (!title || !dateTyped || !time) { openAppAlertModal('Please fill in the title, date, and time.'); return; }
          const dateParsed = parseTypedDateDDMMYYYY(dateTyped);
          if (dateParsed.error || !dateParsed.iso) { openAppAlertModal(dateParsed.error || 'Please enter the lecture date as DD/MM/YYYY.'); return; }
          const date = dateParsed.iso;
          if (!cls.lectures) cls.lectures = [];
          const lecture = { id: 'lec-' + Date.now(), title, date, time, status: 'scheduled' };
          cls.lectures.push(lecture);
          queueSaveClassRemote(cls);
          ensureNotificationPermission();
          notifyClassOfScheduledLecture(cls, lecture);
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        // Scheduling a lecture used to only add it to the Stream silently
        async function notifyClassOfScheduledLecture(cls, lecture){
          const dateLabel = formatReminderDate(lecture.date);
          const timeLabel = formatTime12(lecture.time);
          const members = Array.isArray(cls.members) ? cls.members : [];
          const myId = await getCurrentUserId();
          const teacherName = (typeof profileData !== 'undefined' && profileData.name) || 'Your teacher';
          members.forEach(uid => {
            if (!uid || uid === myId) return;
            sendPushTo(uid, {
              title: `New lecture scheduled in ${cls.name}`,
              body: `${teacherName} scheduled "${lecture.title}" for ${dateLabel} at ${timeLabel}.`,
              tag: 'lecture-scheduled-' + lecture.id,
              data: { kind: 'lecture-scheduled', classId: cls.id, lectureId: lecture.id },
            });
          });
          pushInAppNotification('Lecture scheduled', `${lecture.title} · ${dateLabel} at ${timeLabel}. Students have been notified.`);
        }

        // ---- Classroom notifications tab ----
        function openClassNotifItem(idx){
          const n = (window.__classNotifItems || [])[idx];
          if (!n || typeof showNotifDetail !== 'function') return;
          showNotifDetail({ icon: n.icon, iconBg: n.iconBg, iconClass: n.iconClass, title: n.title, time: '', body: n.body || '' });
        }
        function classNotificationsHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const items = [];
          (cls.lectures || []).forEach(l => {
            items.push({
              sortKey: l.status === 'live' ? '0' : ('1' + l.date + l.time),
              icon: 'video', iconBg: 'bg-blue-50', iconClass: 'text-[' + NAVY + ']',
              title: l.status === 'live' ? 'Live lecture' : 'Upcoming lecture',
              body: l.title + (l.status === 'live' ? ' is live now' : ' · ' + formatReminderDate(l.date) + ' at ' + formatTime12(l.time))
            });
          });
          (cls.classwork || []).forEach(w => {
            if (!w.dueRaw) return;
            items.push({
              sortKey: '2' + w.dueRaw,
              icon: 'doc', iconBg: 'bg-amber-50', iconClass: 'text-amber-600',
              title: classworkTypeLabel(w.type) + ' due',
              body: w.title + ' · due ' + formatReminderDate(w.dueRaw)
            });
          });
          (cls.announcements || []).forEach(a => {
            items.push({
              sortKey: '3' + (a.id || ''),
              icon: 'bell', iconBg: 'bg-emerald-50', iconClass: 'text-emerald-600',
              title: 'New announcement',
              body: a.text
            });
          });
          items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
          window.__classNotifItems = items;
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
<div style="padding-top:20px;" class="pb-3">
                <div class="flex items-center justify-between">
                  <button onclick="overlayGoBack()" class="flex items-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <h1 class="text-3xl font-bold font-display grad-text truncate ml-3">Notifications</h1>
                </div>
              </div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3" style="margin-top:10px;">${escapeHtml(cls.name)}</div>
              ${items.length ? items.map((n, idx) => `
                <div class="py-3 flex items-start gap-3 cursor-pointer" style="${idx < items.length - 1 ? 'border-bottom:1px solid rgba(128,128,128,0.18);' : ''}" onclick="openClassNotifItem(${idx})">
                  <span class="w-10 h-10 rounded-full ${n.iconBg} ${n.iconClass} flex items-center justify-center flex-shrink-0">${NotifIcon(n.icon,'w-5 h-5')}</span>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm text-gray-800">${escapeHtml(n.title)}</div>
                    <div class="text-sm text-gray-500 truncate">${escapeHtml(n.body)}</div>
                  </div>
                </div>`).join('') : `
                <div class="flex flex-col items-center text-center py-16">
                  <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${NotifIcon('bell','w-9 h-9')}</div>
                  <div class="font-bold text-gray-700 mb-1">Nothing new yet</div>
                  <div class="text-sm text-gray-400 leading-relaxed">Announcements, lectures, and due dates from this class will show up here.</div>
                </div>`}
            </div>`;
        }

        // ---- Classwork tab (assignments/quizzes/polls list) ----
        function classworkTypeIcon(type){
          if (type === 'quiz') return 'edit';
          if (type === 'question') return 'help';
          if (type === 'material') return 'file';
          if (type === 'poll') return 'chart';
          return 'doc'; 
        }

        function myClassworkUserId(){
          return (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
        }

        function classworkSubmissionsMap(w){
          if (!w.submissions) w.submissions = {};
          return w.submissions;
        }
        function myClassworkSubmission(w){
          const uid = myClassworkUserId();
          return uid ? (classworkSubmissionsMap(w)[uid] || null) : null;
        }
        function classworkQuizSubmissionsMap(w){
          if (!w.quizSubmissions) w.quizSubmissions = {};
          return w.quizSubmissions;
        }
        function myClassworkQuizSubmission(w){
          const uid = myClassworkUserId();
          return uid ? (classworkQuizSubmissionsMap(w)[uid] || null) : null;
        }
        function classworkSubmitterName(cls, studentId){
          const s = (cls.students || []).find(s => s.id === studentId);
          return (s && s.name) || 'Student';
        }

        function classworkStatusBadge(w, isTeacher){
          if (w.type === 'quiz') {
            if (isTeacher) {
              const n = Object.keys(classworkQuizSubmissionsMap(w)).length;
              return `<span class="text-[10px] font-bold uppercase whitespace-nowrap ${n ? 'text-green-700' : 'text-gray-500'}">${n} submitted</span>`;
            }
            const mine = myClassworkQuizSubmission(w);
            return mine
              ? `<span class="text-[10px] font-bold uppercase whitespace-nowrap text-green-700">Score: ${mine.autoScore}/${mine.total}</span>`
              : `<span class="text-[10px] font-bold uppercase whitespace-nowrap text-gray-500">Not attempted</span>`;
          }
          if (w.type === 'material') return '';
          if (w.type === 'poll') {
            return w.myVote !== null
              ? `<span class="text-[10px] font-bold uppercase whitespace-nowrap text-sky-700">Voted</span>`
              : `<span class="text-[10px] font-bold uppercase whitespace-nowrap text-gray-500">Not voted</span>`;
          }
          if (isTeacher) {
            const n = Object.keys(classworkSubmissionsMap(w)).length;
            return `<span class="text-[10px] font-bold uppercase whitespace-nowrap ${n ? 'text-sky-700' : 'text-gray-500'}">${n} submitted</span>`;
          }
          const mine = myClassworkSubmission(w);
          if (mine && mine.graded) return `<span class="text-[10px] font-bold uppercase whitespace-nowrap text-green-700">Graded: ${mine.score}${w.points ? '/' + w.points : ''}</span>`;
          if (mine) return `<span class="text-[10px] font-bold uppercase whitespace-nowrap text-sky-700">Turned in</span>`;
          return `<span class="text-[10px] font-bold uppercase whitespace-nowrap text-gray-500">Not submitted</span>`;
        }

        function classClassworkTabHTML(cls){
          const isTeacher = cls.role === 'teacher';
          const materials = cls.classwork.filter(w => w.type === 'material');
          const work = cls.classwork.filter(w => w.type !== 'material');
          const row = (w, i, arr) => `
            <div onclick="openClassworkDetail('${w.id}')" class="flex items-start gap-3 py-4 cursor-pointer" style="${i < arr.length - 1 ? 'border-bottom:1px solid rgba(0,0,0,0.07);' : ''}">
              <span class="w-10 h-10 flex items-center justify-center flex-shrink-0 text-[${NAVY}]">${Icon(classworkTypeIcon(w.type),'w-5 h-5')}</span>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(w.title)}</div>
                ${w.instructions ? `<div class="text-xs text-gray-400 mt-0.5 line-clamp-2">${w.instructions}</div>` : ''}
                <div class="text-xs text-gray-400 mt-1.5 flex items-center justify-between gap-2">
                  <span class="min-w-0">${w.type === 'quiz' ? (w.questions.length + ' questions') : w.type === 'poll' ? (w.options.length + ' options') : (w.points ? w.points + ' points' : 'Unscored')}${w.due ? ' · Due ' + w.due : ''}</span>
                  ${classworkStatusBadge(w, isTeacher)}
                </div>
              </div>
              <div class="text-gray-300 flex-shrink-0" style="align-self:center;">›</div>
            </div>`;
          // Same static plus button as the main Classroom page.
          const createFab = isTeacher ? `
            <button onclick="openClassworkCreateMenu()" title="Create" class="fixed flex items-center justify-center text-white rounded-2xl shadow-lg z-30" style="right:1.25rem;bottom:calc(1.25rem + env(safe-area-inset-bottom, 0px));width:2.5rem;height:2.5rem;background:rgba(30,144,255,0.85);">${IconBold('plus','w-5 h-5')}</button>` : '';
          if (isTeacher && !cls.classwork.length) {
            return `
              <div class="text-center mb-4">
                <div class="font-bold text-gray-700 mb-1">Assign work to your class</div>
                <div class="text-sm text-gray-400 leading-relaxed">Post assignments and quizzes here; they can be turned in, scored, and remarked right here in Classwork</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:0;padding:0 4px;">
                ${classworkCreateMenuOptionRow('doc','Assignment','Students turn in work, you score & remark it', "openNewAssignmentOverlay()")}
                ${classworkCreateMenuOptionRow('edit','Quiz','Auto-graded questions, remark after submission', "openNewQuizOverlay()")}
                ${classworkCreateMenuOptionRow('help','Question','Post a question for the class to answer', "openNewQuestionOverlay()")}
                ${classworkCreateMenuOptionRow('chart','Poll','Quick multiple-choice vote for the class', "openNewPollOverlay()")}
                ${classworkCreateMenuOptionRow('file','Material','Share a resource, no submission needed', "openNewMaterialOverlay()", true)}
              </div>
              ${createFab}`;
          }

          return `
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Course Materials</div>
            ${materials.length ? materials.map(row).join('') : `
              <div class="py-4 mb-3 text-sm text-gray-400">
                ${isTeacher ? 'Share slides, notes, or readings with your class.' : "Your teacher hasn't uploaded any course materials yet."}
              </div>`}

            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 mt-6">Assignments &amp; Quizzes</div>
            ${work.length ? work.map(row).join('') : `
              <div class="flex flex-col items-center text-center py-10">
                <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('doc','w-9 h-9')}</div>
                <div class="font-bold text-gray-700 mb-1">${isTeacher ? 'Assign work to your class' : 'No assignments yet'}</div>
                <div class="text-sm text-gray-400 leading-relaxed">${isTeacher ? 'Post assignments and quizzes here; they can be turned in, scored, and remarked right here in Classwork' : 'Assignments and quizzes from your teacher will show up here.'}</div>
              </div>`}
            ${isTeacher ? `<div style="height:60px;"></div>${createFab}` : ''}`;
        }

        function openClassworkCreateMenu(){
          openOverlay('classworkCreateMenu');
        }

        function classworkCreateMenuOptionRow(icon, label, sub, onclick, isLast){
          return `
            <button onclick="${onclick}" class="w-full flex items-center gap-4 py-4 text-left" style="${isLast ? '' : 'border-bottom:1px solid rgba(0,0,0,0.07);'}">
              <span class="w-11 h-11 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(icon,'w-5 h-5')}</span>
              <div class="min-w-0">
                <div class="font-semibold text-sm text-gray-800">${label}</div>
                <div class="text-xs text-gray-400">${sub}</div>
              </div>
            </button>`;
        }

        function classworkCreateMenuHTML(){
          return `
            <div class="flex-1 overflow-y-auto px-5" style="padding-top:10px;display:flex;flex-direction:column;gap:0;">
<div class="-mx-5">${overlayHeader('Create', 'var(--top-safe-pad)', "classDetailTab='classwork'; openOverlay('classDetail')", null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
              ${classworkCreateMenuOptionRow('doc','Assignment','Students turn in work, you score & remark it', "openNewAssignmentOverlay()")}
              ${classworkCreateMenuOptionRow('edit','Quiz','Auto-graded questions, remark after submission', "openNewQuizOverlay()")}
              ${classworkCreateMenuOptionRow('help','Question','Post a question for the class to answer', "openNewQuestionOverlay()")}
              ${classworkCreateMenuOptionRow('chart','Poll','Quick multiple-choice vote for the class', "openNewPollOverlay()")}
              ${classworkCreateMenuOptionRow('file','Material','Share a resource, no submission needed', "openNewMaterialOverlay()", true)}
            </div>`;
        }

        let announcementDraft = '';
        let announcementMenuOpen = false;

        let announcementDraftAttachments = [];

        // ---- New announcement form ----
        function resetAnnouncementDraftAttachments(){
          announcementDraftAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          announcementDraftAttachments = [];
        }

        function openNewAnnouncementOverlay(){
          announcementDraft = '';
          announcementMenuOpen = false;
          resetAnnouncementDraftAttachments();
          openOverlay('newAnnouncement');
        }

        function toggleAnnouncementMenu(){
          announcementMenuOpen = !announcementMenuOpen;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = newAnnouncementHTML();
          attachMenuScrollCloser(ov ? ov.querySelector('.overflow-y-auto') : null, announcementMenuOpen, 'toggleAnnouncementMenu');
        }

        function discardAnnouncementDraft(){
          announcementDraft = '';
          announcementMenuOpen = false;
          resetAnnouncementDraftAttachments();
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        function isImageAttachmentFile(f){
          if (f && f.type && f.type.indexOf('image/') === 0) return true;
          return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test((f && f.name) || '');
        }

        function handleAnnouncementAttachFile(event){
          const files = Array.from(event.target.files || []);
          files.forEach(file => {
            const id = 'aa' + Date.now() + Math.random().toString(36).slice(2);
            const url = URL.createObjectURL(file);
            const entry = { id, name: file.name, file, url, type: file.type, uploading: true };
            announcementDraftAttachments.push(entry);
            entry.uploadPromise = uploadClassworkFileToStorage(file, id).then(remoteUrl => {
              if (!announcementDraftAttachments.includes(entry)) return; 
              if (remoteUrl) entry.url = remoteUrl; 
              entry.uploading = false;
              const strip = document.getElementById('announcement-attach-strip');
              if (strip) strip.innerHTML = announcementAttachStripHTML();
            });
          });
          event.target.value = '';
          const strip = document.getElementById('announcement-attach-strip');
          if (strip) strip.innerHTML = announcementAttachStripHTML();
        }

        function removeAnnouncementAttachment(id){
          const a = announcementDraftAttachments.find(x => x.id === id);
          if (a && a.url) URL.revokeObjectURL(a.url);
          announcementDraftAttachments = announcementDraftAttachments.filter(x => x.id !== id);
          const strip = document.getElementById('announcement-attach-strip');
          if (strip) strip.innerHTML = announcementAttachStripHTML();
        }

        function announcementAttachStripHTML(){
          if (!announcementDraftAttachments.length) return '';
          return `
            <div class="pill-bleed flex items-center gap-2 overflow-x-auto pb-1">
              ${announcementDraftAttachments.map(a => `
                <span class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1 flex-shrink-0">
                  <span class="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${isImageAttachmentFile(a) ? `<img src="${a.url}" class="w-full h-full object-cover">` : Icon('doc','w-3.5 h-3.5')}</span>
                  <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(a.name)}${a.uploading ? ' · Uploading…' : ''}</span>
                  <button onclick="removeAnnouncementAttachment('${a.id}')" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                </span>`).join('')}
            </div>`;
        }

        function newAnnouncementHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const canPost = announcementDraft.trim().length > 0;
          return `
            <div class="flex-1 overflow-y-auto px-5" style="padding-top:0;">
<div class="-mx-5">
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 flex items-center justify-between gap-4" style="position:relative;padding-bottom:20px;">
                <button onclick="discardAnnouncementDraft()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" style="color:${ROYAL};">${IconBold('back','w-5 h-5')}</button>
                <h1 class="text-base font-bold font-display truncate absolute left-1/2 -translate-x-1/2 text-center" style="color:${ROYAL};max-width:60%;">New announcement</h1>
                <button onclick="toggleAnnouncementMenu()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" style="color:${ROYAL};">${Icon('dashesShortRight','w-6 h-6')}</button>
                ${announcementMenuOpen ? classMenuSheetHTML('toggleAnnouncementMenu', [{ onclick: 'discardAnnouncementDraft()', icon: 'trash', label: 'Discard draft', cls: 'text-red-500' }]) : ''}
              </div>
            </div>
</div>
              <textarea id="announcement-text-input" oninput="announcementDraft=this.value; const b=document.getElementById('announcement-create-btn'); if(b){const c=announcementDraft.trim().length>0; b.disabled=!c; b.className='w-full font-semibold py-3 rounded-full '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)':''; b.style.boxShadow=c?'0 4px 14px rgba(65,105,225,0.35)':'';}" placeholder="Announce something to your class" rows="6" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-6">${announcementDraft}</textarea>
              <input type="file" id="announcement-attach-input" multiple class="hidden" onchange="handleAnnouncementAttachFile(event)">
              <button onclick="document.getElementById('announcement-attach-input').click()" class="flex items-center gap-2 text-sm font-semibold" style="color:${NAVY};">${Icon('paperclip','w-4 h-4')} Add attachment</button>
              <div id="announcement-attach-strip" class="mt-3">${announcementAttachStripHTML()}</div>
            </div>
            <div class="flex-shrink-0 w-full" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
              <button onclick="submitNewAnnouncement()" ${canPost ? '' : 'disabled'} id="announcement-create-btn" class="w-full font-semibold py-3 rounded-full ${canPost ? 'text-white' : 'text-gray-400 bg-gray-100'}" style="${canPost ? `background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);` : ''}">Create</button>
            </div>`;
        }

        function announcementPostingOverlayHTML(){
          return `
            <div class="w-full h-full flex flex-col items-center justify-center" style="background:linear-gradient(160deg, #ffffff 0%, #f4f7fc 50%, #ffffff 100%);">
              <div style="width:46px;height:46px;border-radius:50%;border:3px solid rgba(10,37,64,0.14);border-top-color:${NAVY};animation:classroom-spin .7s linear infinite;"></div>
              <div class="mt-4 text-sm font-semibold" style="color:${NAVY};">Posting announcement...</div>
            </div>`;
        }

        function finalizeNewAnnouncementSubmit(cls, text){
          const attachments = announcementDraftAttachments.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type || (a.file ? a.file.type : '') }));
          cls.announcements.unshift({ id: 'a-' + Date.now(), text, createdAt: Date.now(), comments: [], attachments });
          queueSaveClassRemote(cls);
          announcementDraftAttachments = [];
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        function submitNewAnnouncement(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const text = (document.getElementById('announcement-text-input') ? document.getElementById('announcement-text-input').value : announcementDraft).trim();
          if (!cls || !text) return;
          const pendingUploads = announcementDraftAttachments.filter(a => a.uploading && a.uploadPromise).map(a => a.uploadPromise);
          if (pendingUploads.length) {
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = announcementPostingOverlayHTML();
            Promise.all(pendingUploads.map(p => p.catch(() => null))).then(() => finalizeNewAnnouncementSubmit(cls, text));
            return;
          }
          finalizeNewAnnouncementSubmit(cls, text);
        }

        let classworkDraftType = 'assignment';
        let classworkDraftAttachments = [];

        // ---- New assignment/question/material form ----
        function resetClassworkDraftAttachments(){
          classworkDraftAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          classworkDraftAttachments = [];
        }

        function openNewAssignmentOverlay(){ classworkDraftType = 'assignment'; resetClassworkDraftAttachments(); openOverlay('newClasswork'); }
        function openNewQuestionOverlay(){ classworkDraftType = 'question'; resetClassworkDraftAttachments(); openOverlay('newClasswork'); }
        function openNewMaterialOverlay(){ classworkDraftType = 'material'; resetClassworkDraftAttachments(); openOverlay('newClasswork'); }

        function openNewClassworkOverlay(){ openNewAssignmentOverlay(); }

        function classworkTypeLabel(type){
          if (type === 'quiz') return 'Quiz';
          if (type === 'question') return 'Question';
          if (type === 'material') return 'Material';
          if (type === 'poll') return 'Poll';
          return 'Assignment';
        }

        function newClassworkHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const label = classworkTypeLabel(classworkDraftType);
          const showScoring = classworkDraftType !== 'material';
          return `
            <div class="flex-1 overflow-y-auto px-5">
<div class="-mx-5">${overlayHeader(label, '20px', 'openClassworkCreateMenu()', null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
              <input type="text" id="classwork-title-input" oninput="const b=document.getElementById('classwork-create-btn'); if(b){const c=this.value.trim().length>0; b.disabled=!c; b.className='w-full font-semibold py-3 rounded-full '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)':''; b.style.boxShadow=c?'0 4px 14px rgba(65,105,225,0.35)':'';}" placeholder="Title" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
              <textarea id="classwork-instructions-input" placeholder="Instructions (optional)" rows="4" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-4"></textarea>
              ${showScoring ? `
              <div class="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Points</label>
                  <input type="number" id="classwork-points-input" placeholder="100" class="w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm">
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Due date</label>
                  <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" oninput="this.value=formatTypedDateDigits(this.value)" id="classwork-due-input" class="w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm">
                  ${typedDateHintHTML()}
                </div>
              </div>` : `
              <div class="mb-6">
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Due date (optional)</label>
                <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" oninput="this.value=formatTypedDateDigits(this.value)" id="classwork-due-input" class="w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm">
                ${typedDateHintHTML()}
              </div>`}
              <input type="file" id="classwork-attach-input" multiple class="hidden" onchange="handleClassworkAttachFile(event)">
              <button onclick="document.getElementById('classwork-attach-input').click()" class="flex items-center gap-2 text-sm font-semibold" style="color:${NAVY};">${Icon('paperclip','w-4 h-4')} Add attachment</button>
              <div id="classwork-attach-strip" class="mt-3">${classworkAttachStripHTML()}</div>
            </div>
            <div class="flex-shrink-0 w-full" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
              <button onclick="submitNewClasswork()" id="classwork-create-btn" class="w-full font-semibold py-3 rounded-full text-gray-400 bg-gray-100">Create</button>
            </div>`;
        }

        function handleClassworkAttachFile(event){
          const files = Array.from(event.target.files || []);
          files.forEach(file => {
            const id = 'ca' + Date.now() + Math.random().toString(36).slice(2);
            const url = URL.createObjectURL(file);
            const entry = { id, name: file.name, file, url, uploading: true };
            classworkDraftAttachments.push(entry);
            uploadClassworkFileToStorage(file, id).then(remoteUrl => {
              if (!classworkDraftAttachments.includes(entry)) return; 
              if (remoteUrl) entry.url = remoteUrl; 
              entry.uploading = false;
              const strip = document.getElementById('classwork-attach-strip');
              if (strip) strip.innerHTML = classworkAttachStripHTML();
            });
          });
          event.target.value = '';
          const strip = document.getElementById('classwork-attach-strip');
          if (strip) strip.innerHTML = classworkAttachStripHTML();
        }

        function removeClassworkAttachment(id){
          const a = classworkDraftAttachments.find(x => x.id === id);
          if (a && a.url) URL.revokeObjectURL(a.url);
          classworkDraftAttachments = classworkDraftAttachments.filter(x => x.id !== id);
          const strip = document.getElementById('classwork-attach-strip');
          if (strip) strip.innerHTML = classworkAttachStripHTML();
        }

        function classworkAttachStripHTML(){
          if (!classworkDraftAttachments.length) return '';
          return `
            <div class="flex items-center gap-2 overflow-x-auto pb-1">
              ${classworkDraftAttachments.map(a => `
                <span class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1 flex-shrink-0">
                  <span class="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('doc','w-3.5 h-3.5')}</span>
                  <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(a.name)}${a.uploading ? ' · Uploading…' : ''}</span>
                  <button onclick="removeClassworkAttachment('${a.id}')" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                </span>`).join('')}
            </div>`;
        }

        function submitNewClasswork(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const title = (document.getElementById('classwork-title-input') || {}).value.trim();
          if (!cls || !title) return;
          if (classworkDraftAttachments.some(a => a.uploading)) { openAppAlertModal('Still uploading -- give it a moment and try again.'); return; }
          const instructions = (document.getElementById('classwork-instructions-input') || {}).value.trim();
          const pointsInput = document.getElementById('classwork-points-input');
          const points = pointsInput ? pointsInput.value.trim() : '';
          const dueTyped = (document.getElementById('classwork-due-input') || {}).value || '';
          const dueParsed = parseTypedDateDDMMYYYY(dueTyped);
          if (dueTyped.trim() && (dueParsed.error || !dueParsed.iso)) { openAppAlertModal(dueParsed.error || 'Please enter the due date as DD/MM/YYYY.'); return; }
          const due = dueParsed.iso;
          cls.classwork.unshift({
            id: 'w-' + Date.now(), type: classworkDraftType, title, instructions, points,
            due: due ? formatDueDate(due) : '', dueRaw: due || '',
            submissions: {},
            attachments: classworkDraftAttachments.map(a => ({ id: a.id, name: a.name, url: a.url }))
          });
          queueSaveClassRemote(cls);
          classworkDraftAttachments = []; 
          if (due) ensureNotificationPermission();
          classDetailTab = 'classwork';
          openOverlay('classDetail');
        }

        function formatDueDate(iso){
          const d = new Date(iso + 'T00:00:00');
          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }

        let quizQuestionCounter = 0;

        // ---- New quiz (classwork) builder ----
        function openNewQuizOverlay(){
          quizQuestionCounter = 0;
          openOverlay('newQuiz');
        }

        function quizQuestionBlockHTML(n){
          return `
            <div class="quiz-question-block" style="margin-bottom:28px;" data-qindex="${n}">
              <div class="flex items-center justify-between" style="margin-bottom:14px;">
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Question ${n + 1}</div>
                <button onclick="removeQuizQuestionBlock(this)" class="w-8 h-8 flex items-center justify-center text-gray-300 flex-shrink-0">${Icon('close','w-4 h-4')}</button>
              </div>
              <input type="text" class="quiz-q-text w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold" style="margin-bottom:20px;" placeholder="Question text">
              <div style="display:flex;flex-direction:column;gap:14px;">
                ${[0,1,2,3].map(i => `
                  <label class="flex items-center gap-3 text-sm">
                    <input type="radio" name="quiz-correct-${n}" value="${i}" class="quiz-q-correct flex-shrink-0" style="width:22px;height:22px;" ${i === 0 ? 'checked' : ''}>
                    <input type="text" class="quiz-q-option flex-1 bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm" placeholder="Option ${i + 1}">
                  </label>`).join('')}
              </div>
              <div class="text-[11px] text-gray-400" style="margin-top:18px;">Tap the circle next to the correct option.</div>
            </div>`;
        }

        function addQuizQuestionBlock(){
          quizQuestionCounter++;
          const container = document.getElementById('quiz-questions-container');
          if (container) container.insertAdjacentHTML('beforeend', quizQuestionBlockHTML(quizQuestionCounter));
        }

        function removeQuizQuestionBlock(btn){
          const block = btn.closest('.quiz-question-block');
          const container = document.getElementById('quiz-questions-container');
          if (block && container && container.children.length > 1) block.remove();
        }

        function newQuizHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          return `
            <div class="flex-1 overflow-y-auto px-5">
<div class="-mx-5">${overlayHeader('Quiz', '20px', 'openClassworkCreateMenu()', null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
              <input type="text" id="quiz-title-input" placeholder="Title" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
              <textarea id="quiz-instructions-input" placeholder="Instructions (optional)" rows="3" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-4"></textarea>
              <div class="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Points (optional)</label>
                  <input type="number" id="quiz-points-input" placeholder="e.g. 100" class="w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm">
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Due date</label>
                  <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" oninput="this.value=formatTypedDateDigits(this.value)" id="quiz-due-input" class="w-full bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm">
                  ${typedDateHintHTML()}
                </div>
              </div>
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400" style="margin-bottom:16px;">Questions</div>
              <div id="quiz-questions-container">${quizQuestionBlockHTML(0)}</div>
              <button onclick="addQuizQuestionBlock()" class="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 font-semibold text-sm text-[${NAVY}]">${Icon('plus','w-4 h-4')} Add question</button>
              <div style="height:24px;"></div>
            </div>
            <div class="flex-shrink-0 w-full" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
              <button onclick="submitNewQuiz()" class="w-full font-semibold py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Create</button>
            </div>`;
        }

        function submitNewQuiz(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const title = (document.getElementById('quiz-title-input') || {}).value.trim();
          if (!cls || !title) { openAppAlertModal('Give the quiz a title first.'); return; }
          const instructions = (document.getElementById('quiz-instructions-input') || {}).value.trim();
          const points = (document.getElementById('quiz-points-input') || {}).value.trim();
          const dueTyped = (document.getElementById('quiz-due-input') || {}).value || '';
          const dueParsed = parseTypedDateDDMMYYYY(dueTyped);
          if (dueTyped.trim() && (dueParsed.error || !dueParsed.iso)) { openAppAlertModal(dueParsed.error || 'Please enter the due date as DD/MM/YYYY.'); return; }
          const due = dueParsed.iso;
          const blocks = Array.from(document.querySelectorAll('#quiz-questions-container .quiz-question-block'));
          const questions = [];
          for (const block of blocks) {
            const text = block.querySelector('.quiz-q-text').value.trim();
            const options = Array.from(block.querySelectorAll('.quiz-q-option')).map(i => i.value.trim());
            const correctRadio = block.querySelector('.quiz-q-correct:checked');
            const correct = correctRadio ? parseInt(correctRadio.value, 10) : 0;
            if (text && options.every(o => o)) questions.push({ text, options, correct });
          }
          if (!questions.length) { openAppAlertModal('Add at least one complete question (text + all 4 options).'); return; }
          cls.classwork.unshift({
            id: 'w-' + Date.now(), type: 'quiz', title, instructions, points,
            due: due ? formatDueDate(due) : '', dueRaw: due || '',
            questions, quizSubmissions: {}
          });
          queueSaveClassRemote(cls);
          if (due) ensureNotificationPermission();
          classDetailTab = 'classwork';
          openOverlay('classDetail');
        }

        let pollOptionCounter = 0;

        // ---- New poll builder ----
        function openNewPollOverlay(){
          pollOptionCounter = 0;
          openOverlay('newPoll');
        }

        function pollOptionRowHTML(n){
          return `
            <div class="poll-option-row flex items-center gap-2 mb-3">
              <input type="text" class="poll-option-input flex-1 bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-sm" placeholder="Option ${n + 1}">
              <button onclick="removePollOptionRow(this)" class="text-gray-300 flex-shrink-0">${Icon('close','w-4 h-4')}</button>
            </div>`;
        }

        function addPollOptionRow(){
          pollOptionCounter++;
          const container = document.getElementById('poll-options-container');
          if (container) container.insertAdjacentHTML('beforeend', pollOptionRowHTML(pollOptionCounter));
        }

        function removePollOptionRow(btn){
          const row = btn.closest('.poll-option-row');
          const container = document.getElementById('poll-options-container');
          if (row && container && container.children.length > 2) row.remove();
        }

        function newPollHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          return `
            <div class="flex-1 overflow-y-auto px-5">
<div class="-mx-5">${overlayHeader('Poll', 'var(--top-safe-pad)', 'openClassworkCreateMenu()', null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
              <input type="text" id="poll-title-input" placeholder="Ask a question" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Options</div>
              <div id="poll-options-container">${pollOptionRowHTML(0)}${pollOptionRowHTML(1)}</div>
              <button onclick="addPollOptionRow()" class="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 font-semibold text-sm text-[${NAVY}]">${Icon('plus','w-4 h-4')} Add option</button>
            </div>
            <div class="flex-shrink-0 w-full" style="padding:0 1.25rem calc(env(safe-area-inset-bottom, 0px) + 16px);">
              <button onclick="submitNewPoll()" class="w-full font-semibold py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Create</button>
            </div>`;
        }

        function submitNewPoll(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const title = (document.getElementById('poll-title-input') || {}).value.trim();
          if (!cls || !title) { openAppAlertModal('Give the poll a question first.'); return; }
          const optionTexts = Array.from(document.querySelectorAll('#poll-options-container .poll-option-input'))
            .map(i => i.value.trim()).filter(Boolean);
          if (optionTexts.length < 2) { openAppAlertModal('Add at least 2 options.'); return; }
          cls.classwork.unshift({
            id: 'w-' + Date.now(), type: 'poll', title, instructions: '',
            options: optionTexts.map(text => ({ text, votes: 0 })),
            myVote: null
          });
          queueSaveClassRemote(cls);
          classDetailTab = 'classwork';
          openOverlay('classDetail');
        }

        let currentClassworkId = null;

        // ---- Classwork detail (view/submit/grade) ----
        function openClassworkDetail(id){
          currentClassworkId = id;
          classworkDetailMenuOpen = false;
          openOverlay('classworkDetail');
        }

        function currentClasswork(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return null;
          return cls.classwork.find(w => w.id === currentClassworkId) || null;
        }

        let classworkDetailMenuOpen = false;

        function toggleClassworkDetailMenu(){
          classworkDetailMenuOpen = !classworkDetailMenuOpen;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classworkDetailHTML();
          attachMenuScrollCloser(ov ? ov.querySelector('.overflow-y-auto') : null, classworkDetailMenuOpen, 'toggleClassworkDetailMenu');
        }

        function deleteCurrentClasswork(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const w = currentClasswork();
          if (!cls || !w) return;
          cls.classwork = cls.classwork.filter(x => x.id !== w.id);
          classworkDetailMenuOpen = false;
          classDetailTab = 'classwork';
          openOverlay('classDetail');
        }

        function classworkDetailHTML(){
          const w = currentClasswork();
          if (!w) { setTimeout(() => { classDetailTab = 'classwork'; openOverlay('classDetail'); }, 0); return '<div class="flex-1"></div>'; }
          const cls = myClasses.find(c => c.id === currentClassId);
          const isTeacher = cls && cls.role === 'teacher';
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex-1 overflow-y-auto px-5 pb-8">
<div class="-mx-5">
              ${isTeacher ? `<div class="w-full px-5 relative" style="padding-top:var(--top-safe-pad);padding-bottom:20px;">
                <div class="flex items-center justify-between">
                  <button onclick="classDetailTab='classwork'; openOverlay('classDetail')" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <h1 class="text-base font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">${classworkTypeLabel(w.type)}</h1>
                  <button onclick="toggleClassworkDetailMenu()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(Icon('dashesShortRight','w-6 h-6'))}</button>
                  ${classworkDetailMenuOpen ? classMenuSheetHTML('toggleClassworkDetailMenu', [{ onclick: 'deleteCurrentClasswork()', icon: 'trash', label: 'Delete', cls: 'text-red-500' }]) : ''}
                </div>
              </div>` : overlayHeader(classworkTypeLabel(w.type), 'var(--top-safe-pad)', "classDetailTab='classwork'; openOverlay('classDetail')", null, { right: true, pb: '20px', titleSize: 'text-3xl' })}
</div>
                <div class="text-xl font-bold text-gray-800 mb-1">${escapeHtml(w.title)}</div>
                <div class="text-xs text-gray-400 mb-4 flex items-center gap-2 flex-wrap">
                  ${w.type === 'quiz' ? w.questions.length + ' questions' : w.type === 'poll' ? w.options.length + ' options' : (w.points ? w.points + ' points' : 'Unscored')}
                  ${w.due ? ' · Due ' + w.due : ''}
                </div>
                ${w.instructions ? `<div class="mb-5 text-sm text-gray-700 leading-relaxed">${w.instructions}</div>` : ''}
                ${(w.attachments && w.attachments.length) ? `
                <div class="pill-bleed flex items-center gap-2 overflow-x-auto pb-1 mb-5">
                  ${w.attachments.map(a => `
                    <button onclick="openClassworkFile('${escapeHtml(a.url)}')" title="Open ${escapeHtml(a.name)}" class="flex items-center gap-1.5 bg-white rounded-full pl-1 pr-3 py-1 flex-shrink-0 shadow-sm">
                      <span class="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon('doc','w-3.5 h-3.5')}</span>
                      <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(a.name)}</span>
                    </button>`).join('')}
                </div>` : ''}
                ${w.type === 'quiz' ? classworkQuizDetailHTML(w) : w.type === 'poll' ? classworkPollDetailHTML(w) : classworkAssignmentDetailHTML(w)}
              </div>
            </div>`;
        }

        // ---- Assignment submission + grading ----
        function classworkAssignmentDetailHTML(w){
          const cls = myClasses.find(c => c.id === currentClassId);
          const isTeacher = cls && cls.role === 'teacher';

          if (isTeacher) {
            const subs = classworkSubmissionsMap(w);
            const studentIds = Object.keys(subs);
            if (!studentIds.length) {
              return `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('doc','w-9 h-9')}</div>
                  <div class="font-bold text-gray-700 mb-1">No submissions yet</div>
                  <div class="text-sm text-gray-400 leading-relaxed">You'll be able to grade each student's work here once they turn it in.</div>
                </div>`;
            }
            return studentIds.map(sid => {
              const sub = subs[sid];
              const name = classworkSubmitterName(cls, sid);
              return `
              <div class="py-2 mb-3">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">${escapeHtml(name)} · ${sub.submittedAt}</div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">${escapeHtml(sub.text)}</div>
                <div class="flex items-center gap-3 mb-3">
                  <input type="number" id="classwork-score-input-${sid}" value="${sub.score !== null && sub.score !== undefined ? sub.score : ''}" placeholder="Score" class="w-24 bg-gray-100 border border-gray-200 rounded-2xl px-3 py-2 text-sm">
                  <div class="text-sm text-gray-400">${w.points ? 'out of ' + w.points : 'points'}</div>
                </div>
                <textarea id="classwork-remark-input-${sid}" placeholder="Remark / feedback (optional)" rows="2" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3">${sub.remark || ''}</textarea>
                <button onclick="saveClassworkGrade('${w.id}','${sid}')" class="w-full font-semibold py-2.5 rounded-2xl" style="color:${NAVY};background:rgba(30,144,255,0.12);">${sub.graded ? 'Update grade' : 'Save grade'}</button>
                ${sub.graded ? `<div class="text-center text-xs text-green-600 font-semibold mt-2">Graded: ${sub.score}${w.points ? '/' + w.points : ''}</div>` : ''}
              </div>`;
            }).join('');
          }

          const mine = myClassworkSubmission(w);
          const submissionSection = mine ? `
            <div class="py-2 mb-4">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your submission · ${mine.submittedAt}</div>
              <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(mine.text)}</div>
            </div>
            ${mine.graded ? '' : `<button onclick="unsubmitClasswork('${w.id}')" class="text-xs font-semibold text-gray-400 mb-5">Unsubmit &amp; edit</button>`}
          ` : `
            <div class="py-2 mb-5">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your work</div>
              <textarea id="classwork-submission-input" placeholder="Type your answer here..." rows="5" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3"></textarea>
              <button onclick="submitClassworkAssignment('${w.id}')" class="w-full text-white font-semibold py-2.5 rounded-2xl" style="background:rgba(30,144,255,0.55);">Turn in</button>
            </div>
          `;
          const gradeSummary = (mine && mine.graded) ? `
            <div class="py-2">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Grade</div>
              <div class="text-lg font-bold text-[${NAVY}]">${mine.score}${w.points ? '/' + w.points : ''}</div>
              ${mine.remark ? `<div class="text-sm text-gray-600 mt-2 leading-relaxed">${mine.remark}</div>` : ''}
            </div>` : '';
          return submissionSection + gradeSummary;
        }

        function submitClassworkAssignment(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const uid = myClassworkUserId();
          if (!uid) return;
          const input = document.getElementById('classwork-submission-input');
          const text = input ? input.value.trim() : '';
          if (!text) { openAppAlertModal('Write something before turning it in.'); return; }
          const now = new Date();
          const submittedAt = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          classworkSubmissionsMap(w)[uid] = { text, submittedAt, score: null, remark: '', graded: false };
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          classSubmissionRpc('submit_classwork_assignment', { p_class_id: currentClassId, p_work_id: w.id, p_text: text, p_submitted_at: submittedAt });
        }

        function unsubmitClasswork(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const uid = myClassworkUserId();
          if (!uid) return;
          delete classworkSubmissionsMap(w)[uid];
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          classSubmissionRpc('unsubmit_classwork', { p_class_id: currentClassId, p_work_id: w.id });
        }

        function saveClassworkGrade(id, studentId){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const sub = classworkSubmissionsMap(w)[studentId];
          if (!sub) return;
          const scoreInput = document.getElementById('classwork-score-input-' + studentId);
          const remarkInput = document.getElementById('classwork-remark-input-' + studentId);
          const scoreVal = scoreInput ? scoreInput.value.trim() : '';
          if (scoreVal === '') { openAppAlertModal('Enter a score first.'); return; }
          sub.score = scoreVal;
          sub.remark = remarkInput ? remarkInput.value.trim() : '';
          sub.graded = true;
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          classSubmissionRpc('grade_classwork', { p_class_id: currentClassId, p_work_id: w.id, p_student_id: studentId, p_score: String(sub.score), p_remark: sub.remark || '' });
        }

        // ---- Quiz classwork submission + remarks ----
        function classworkQuizDetailHTML(w){
          const cls = myClasses.find(c => c.id === currentClassId);
          const isTeacher = cls && cls.role === 'teacher';

          const myQuizSub = myClassworkQuizSubmission(w);
          if (isTeacher) {
            const subs = classworkQuizSubmissionsMap(w);
            const studentIds = Object.keys(subs);
            if (!studentIds.length) {
              return `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('edit','w-9 h-9')}</div>
                  <div class="font-bold text-gray-700 mb-1">No submissions yet</div>
                  <div class="text-sm text-gray-400 leading-relaxed">Scores will show up here once a student takes this quiz.</div>
                </div>`;
            }
            return studentIds.map(sid => {
              const sub = subs[sid];
              const name = classworkSubmitterName(cls, sid);
              return `
              <div class="py-2 mb-3">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">${escapeHtml(name)}</div>
                <div class="text-lg font-bold text-[${NAVY}] font-display">${sub.autoScore}/${sub.total}${w.points ? ' · ' + Math.round((sub.autoScore / sub.total) * w.points) + '/' + w.points : ''}</div>
                <div class="text-xs text-gray-400 mb-3">Submitted ${sub.submittedAt}</div>
                <textarea id="quiz-remark-input-${sid}" placeholder="Add a remark (optional)" rows="2" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3">${sub.remark || ''}</textarea>
                <button onclick="saveQuizRemark('${w.id}','${sid}')" class="w-full font-semibold py-2 rounded-2xl" style="color:${NAVY};background:rgba(30,144,255,0.12);">Save remark</button>
              </div>`;
            }).join('');
          }

          if (!myQuizSub) {
            return `
              <div class="space-y-4 mb-5">
                ${w.questions.map((q, qi) => `
                  <div class="py-2">
                    <div class="text-sm font-semibold text-gray-800 mb-3">${qi + 1}. ${escapeHtml(q.text)}</div>
                    <div class="space-y-2">
                      ${q.options.map((opt, oi) => `
                        <label class="flex items-center gap-2.5 text-sm text-gray-700">
                          <input type="radio" name="quiz-take-${qi}" value="${oi}" class="quiz-take-answer flex-shrink-0" data-qindex="${qi}">
                          ${opt}
                        </label>`).join('')}
                    </div>
                  </div>`).join('')}
              </div>
              <button onclick="submitClassworkQuiz('${w.id}')" class="w-full text-white font-semibold py-3 rounded-2xl" style="background:rgba(30,144,255,0.55);">Submit Quiz</button>
            `;
          }
          const sub = myQuizSub;
          const remarkSection = sub.remark ? `
            <div class="py-2">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Remark / feedback</div>
              <div class="text-sm text-gray-700 leading-relaxed">${sub.remark}</div>
            </div>` : '';
          return `
            <div class="py-2 mb-4 text-center">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Your score</div>
              <div class="text-2xl font-bold text-[${NAVY}] font-display">${sub.autoScore}/${sub.total}${w.points ? ' · ' + Math.round((sub.autoScore / sub.total) * w.points) + '/' + w.points : ''}</div>
              <div class="text-xs text-gray-400 mt-1">Submitted ${sub.submittedAt}</div>
            </div>
            <div class="space-y-3 mb-5">
              ${w.questions.map((q, qi) => {
                const yourAnswer = sub.answers[qi];
                const correct = yourAnswer === q.correct;
                return `
                <div class="py-2">
                  <div class="flex items-start gap-2 mb-2">
                    <span class="flex-shrink-0 mt-0.5 ${correct ? 'text-emerald-600' : 'text-red-500'}">${Icon(correct ? 'check' : 'close', 'w-4 h-4')}</span>
                    <div class="text-sm font-semibold text-gray-800">${qi + 1}. ${escapeHtml(q.text)}</div>
                  </div>
                  <div class="text-xs text-gray-500 ml-6">Your answer: ${yourAnswer !== undefined && yourAnswer !== null ? q.options[yourAnswer] : '(no answer)'}</div>
                  ${!correct ? `<div class="text-xs text-emerald-600 ml-6 mt-0.5">Correct answer: ${q.options[q.correct]}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
            ${remarkSection}`;
        }

        function submitClassworkQuiz(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const uid = myClassworkUserId();
          if (!uid) return;
          const answers = w.questions.map((q, qi) => {
            const checked = document.querySelector(`.quiz-take-answer[data-qindex="${qi}"]:checked`);
            return checked ? parseInt(checked.value, 10) : null;
          });
          if (answers.some(a => a === null)) { openAppAlertModal('Answer every question before submitting.'); return; }
          const autoScore = answers.reduce((sum, a, qi) => sum + (a === w.questions[qi].correct ? 1 : 0), 0);
          const now = new Date();
          const quizSubmittedAt = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          classworkQuizSubmissionsMap(w)[uid] = { answers, total: w.questions.length, autoScore, submittedAt: quizSubmittedAt, remark: '' };
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          classSubmissionRpc('submit_classwork_quiz', { p_class_id: currentClassId, p_work_id: w.id, p_answers: answers, p_submitted_at: quizSubmittedAt });
        }

        function saveQuizRemark(id, studentId){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const sub = classworkQuizSubmissionsMap(w)[studentId];
          if (!sub) return;
          const input = document.getElementById('quiz-remark-input-' + studentId);
          sub.remark = input ? input.value.trim() : '';
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          classSubmissionRpc('remark_classwork_quiz', { p_class_id: currentClassId, p_work_id: w.id, p_student_id: studentId, p_remark: sub.remark });
        }

        // ---- Poll voting ----
        function classworkPollDetailHTML(w){
          const cls = myClasses.find(c => c.id === currentClassId);
          const isTeacher = cls && cls.role === 'teacher';
          const showResults = isTeacher || w.myVote !== null;
          const totalVotes = w.options.reduce((sum, o) => sum + o.votes, 0);

          if (!showResults) {
            return `
              <div class="mb-5" style="display:flex;flex-direction:column;gap:0.5px;">
                ${w.options.map((o, oi) => `
                  <label class="flex items-center gap-3 py-3 cursor-pointer">
                    <input type="radio" name="poll-vote" value="${oi}" class="poll-vote-input flex-shrink-0">
                    <span class="text-sm text-gray-700">${escapeHtml(o.text)}</span>
                  </label>`).join('')}
              </div>
              <button onclick="submitPollVote('${w.id}')" class="w-full text-white font-semibold py-3 rounded-2xl" style="background:rgba(30,144,255,0.55);">Vote</button>
            `;
          }

          return `
            <div class="space-y-3">
              ${w.options.map((o, oi) => {
                const pct = totalVotes ? Math.round((o.votes / totalVotes) * 100) : 0;
                const isMine = w.myVote === oi;
                return `
                <div class="py-2">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-semibold text-gray-800">${escapeHtml(o.text)}${isMine ? ` <span class="text-[10px] font-bold uppercase text-sky-600">· Your vote</span>` : ''}</div>
                    <div class="text-xs text-gray-400 flex-shrink-0">${pct}%</div>
                  </div>
                  <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div class="h-2 rounded-full" style="width:${pct}%;background:rgba(30,144,255,0.55);"></div>
                  </div>
                </div>`;
              }).join('')}
            </div>
            <div class="text-xs text-gray-400 mt-3">${totalVotes} vote${totalVotes === 1 ? '' : 's'}</div>
          `;
        }

        function submitPollVote(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const checked = document.querySelector('.poll-vote-input:checked');
          if (!checked) { openAppAlertModal('Pick an option before voting.'); return; }
          const oi = parseInt(checked.value, 10);
          w.options[oi].votes++;
          w.myVote = oi;
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
        }

        // A student who joins an open class, gets approved into one, or pays a class's entrance
        // fee is added to cls.members (the access-control list) straight away, but only shows up
        // in cls.students (the roster the People tab used to render from) when the teacher
        function classRosterList(cls){
          const knownIds = new Set((cls.students || []).map(s => s.id).filter(Boolean));
          const roster = (cls.students || []).map((s, i) => Object.assign({}, s, { _studentIndex: i }));
          (cls.members || []).forEach(id => {
            if (!id || id === cls.teacherId || knownIds.has(id)) return;
            const profile = classStudentProfiles[id];
            roster.push({
              id,
              name: (profile && profile.name) || 'Class member',
              email: '',
              enrolled: true,
              _studentIndex: -1,
            });
          });
          return roster;
        }

        // ---- Class People tab (roster + co-teacher invites) ----
        function classPeopleTabHTML(cls){
          const coTeachers = cls.coTeachers || [];
          const isTeacher = cls.role === 'teacher';
          return `
            <div class="flex items-center justify-between mb-3">
              <div class="text-xl font-bold text-[${NAVY}] font-display">Teachers</div>
              ${isTeacher ? `<button onclick="openInviteCoTeacherOverlay()" class="text-[${NAVY}]">${Icon('personPlus','w-6 h-6')}</button>` : ''}
            </div>
            <div class="border-t border-gray-100 mb-5">
              <div class="flex items-center gap-4 py-4 ${(isTeacher && coTeachers.length) ? 'border-b border-gray-100' : ''}">
                <span class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0 overflow-hidden">${classTeacherAvatarHTML(cls,'w-6 h-6')}</span>
                <div class="font-semibold text-sm text-gray-800">${classTeacherDisplayName(cls)}</div>
              </div>
              ${isTeacher ? coTeachers.map((t, i) => `
                <div class="flex items-center gap-4 py-4 ${i < coTeachers.length - 1 ? 'border-b border-gray-100' : ''}">
                  <span class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">${Icon('user','w-6 h-6')}</span>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(t.email)}</div>
                    <div class="text-xs text-gray-400 mt-0.5">Invite pending</div>
                  </div>
                  <button onclick="cancelCoTeacherInvite('${cls.id}', ${i})" class="text-xs font-semibold text-gray-400 flex-shrink-0">Cancel</button>
                </div>`).join('') : ''}
            </div>
            ${(isTeacher && cls.joinPolicy === 'approved' && cls.pendingRequests && cls.pendingRequests.length) ? `
              <div class="flex items-center justify-between mb-3">
                <div class="text-xl font-bold text-[${NAVY}] font-display">Join requests</div>
              </div>
              <div class="border-t border-gray-100 mb-5">
                ${cls.pendingRequests.map((r, i) => `
                  <div class="flex items-center gap-4 py-4 ${i < cls.pendingRequests.length - 1 ? 'border-b border-gray-100' : ''}">
                    <span class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0 overflow-hidden">${avatarMediaHTML(r.photo, 'user', 'w-6 h-6')}</span>
                    <div class="min-w-0 flex-1">
                      <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(r.name || 'Unnamed')}</div>
                      ${r.username ? `<div class="text-xs text-gray-400 mt-0.5 truncate">@${escapeHtml(r.username)}</div>` : ''}
                    </div>
                    <button onclick="denyClassJoinRequest('${cls.id}', '${r.userId}')" class="text-xs font-semibold text-gray-400 flex-shrink-0 mr-3">Deny</button>
                    <button onclick="approveClassJoinRequest('${cls.id}', '${r.userId}')" class="text-xs font-semibold flex-shrink-0" style="color:${NAVY};">Approve</button>
                  </div>`).join('')}
              </div>` : ''}
            <div class="flex items-center justify-between mb-3">
              <div class="text-xl font-bold text-[${NAVY}] font-display">Students${(() => { const n = classRosterList(cls).length; return n ? ` <span class="text-sm font-semibold text-gray-400">(${n}${cls.paymentEnabled ? ' enrolled' : ''})</span>` : ''; })()}</div>
              ${isTeacher ? `<button onclick="openInviteStudentsOverlay()" class="text-[${NAVY}]">${Icon('personPlus','w-6 h-6')}</button>` : ''}
            </div>
            <div class="border-t border-gray-100">
              ${(() => {
                const roster = classRosterList(cls);
                if (!roster.length) {
                  return isTeacher ? `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">${Icon('users','w-8 h-8')}</div>
                  <div class="text-gray-400 mb-5">Invite students to your class</div>
                  <button onclick="openInviteStudentsOverlay()" class="font-semibold text-sm px-8 py-2.5 rounded-2xl" style="color:${NAVY};background:rgba(30,144,255,0.12);margin-bottom:10px;">Invite</button>
                </div>` : `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">${Icon('users','w-8 h-8')}</div>
                  <div class="text-gray-400">No other students yet.</div>
                </div>`;
                }
                return roster.map((s, i) => `
                <div class="flex items-center gap-4 py-4 ${i < roster.length - 1 ? 'border-b border-gray-100' : ''}">
                  <span class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0 overflow-hidden">${classStudentAvatarHTML(s,'w-6 h-6')}</span>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(s.name)}</div>
                    ${s.pending
                      ? `<div class="text-xs text-gray-400 mt-0.5">Invite pending &middot; must enroll to get access</div>`
                      : (s.enrolled
                        ? `<div class="text-xs font-semibold mt-0.5" style="color:${NAVY};">${cls.paymentEnabled ? 'Enrolled &middot; paid entrance' : 'Enrolled'}</div>`
                        : `<div class="text-xs text-gray-400 mt-0.5 truncate">${s.email}</div>`)}
                  </div>
                  ${(isTeacher && s.pending) ? `<button onclick="cancelStudentInvite('${cls.id}', ${s._studentIndex})" class="text-xs font-semibold text-gray-400 flex-shrink-0">Cancel</button>` : ''}
                </div>`).join('');
              })()}
            </div>`;
        }

        let inviteCoTeacherDraft = '';

        function openInviteCoTeacherOverlay(){
          inviteCoTeacherDraft = '';
          openOverlay('inviteCoTeacher');
        }

        function inviteCoTeacherHTML(){
          const canInvite = inviteCoTeacherDraft.trim().length > 0;
          return `
            <div class="flex-1 overflow-y-auto px-5 pb-8">
<div class="-mx-5">${overlayHeader('Invite co-teacher', 'var(--top-safe-pad)', 'backToClassDetailPeople()', null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Enter email address</label>
              <input type="email" id="coteacher-email-input" value="${escapeHtml(inviteCoTeacherDraft)}" oninput="inviteCoTeacherDraft=this.value; const b=document.getElementById('coteacher-submit-btn'); if(b){const c=inviteCoTeacherDraft.trim().length>0; b.disabled=!c; b.className='w-full font-semibold text-sm py-3 rounded-2xl mt-4 '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)':''; b.style.boxShadow=c?'0 4px 14px rgba(65,105,225,0.35)':'';}" placeholder="e.g. teacher@example.com" class="w-full bg-gray-100 border-2 border-gray-300 rounded-2xl px-4 py-3 text-sm mb-2">
              <div class="text-xs text-gray-400 leading-relaxed mb-4">They'll be added as a co-teacher for this class once invited.</div>
              <button id="coteacher-submit-btn" onclick="submitInviteCoTeacher()" ${canInvite ? '' : 'disabled'} class="w-full font-semibold text-sm py-3 rounded-2xl mt-4 ${canInvite ? 'text-white' : 'text-gray-400 bg-gray-100'}" style="${canInvite ? `background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);` : ''}">Invite</button>
            </div>`;
        }

        function submitInviteCoTeacher(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const input = document.getElementById('coteacher-email-input');
          const email = (input ? input.value : inviteCoTeacherDraft).trim();
          if (!email) return;
          if (!cls.coTeachers) cls.coTeachers = [];
          if (cls.coTeachers.some(t => t.email.toLowerCase() === email.toLowerCase())) {
            openAppAlertModal(`${email} has already been invited.`);
            return;
          }
          cls.coTeachers.push({ email });
          queueSaveClassRemote(cls);
          backToClassDetailPeople();
        }

        function cancelCoTeacherInvite(classId, index){
          const cls = myClasses.find(c => c.id === classId);
          if (!cls || !cls.coTeachers) return;
          cls.coTeachers.splice(index, 1);
          queueSaveClassRemote(cls);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
        }

        async function approveClassJoinRequest(classId, studentId){
          const sb = getSupabaseClient();
          if (!sb) return;
          const { error } = await sb.rpc('approve_class_join_request', { p_class_id: classId, p_student_id: studentId });
          if (error) { openAppAlertModal("Couldn't approve that request. Please try again."); return; }
          const cls = myClasses.find(c => c.id === classId);
          if (cls) {
            const req = (cls.pendingRequests || []).find(r => r.userId === studentId);
            cls.pendingRequests = (cls.pendingRequests || []).filter(r => r.userId !== studentId);
            if (req) cls.students.push({ id: studentId, name: req.name || '', email: '' });
            if (!cls.members.includes(studentId)) cls.members.push(studentId);
          }
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
        }

        async function denyClassJoinRequest(classId, studentId){
          const sb = getSupabaseClient();
          if (!sb) return;
          const { error } = await sb.rpc('deny_class_join_request', { p_class_id: classId, p_student_id: studentId });
          if (error) { openAppAlertModal("Couldn't update that request. Please try again."); return; }
          const cls = myClasses.find(c => c.id === classId);
          if (cls) cls.pendingRequests = (cls.pendingRequests || []).filter(r => r.userId !== studentId);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
        }

        // ---- Edit class (teacher): name, section, subject, description, photo ----
        let editClassDraft = null;
        function openEditClass(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls || cls.role !== 'teacher') return;
          editClassDraft = { id: cls.id, name: cls.name || '', section: cls.section || '', subject: cls.subject || '', description: cls.description || '' };
          openOverlay('editClass');
        }
        function editClassHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls || cls.role !== 'teacher') { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          if (!editClassDraft || editClassDraft.id !== cls.id) editClassDraft = { id: cls.id, name: cls.name || '', section: cls.section || '', subject: cls.subject || '', description: cls.description || '' };
          const d = editClassDraft;
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Edit class', '20px', "openOverlay('classDetail')", null, { right: true, titleSize: 'text-3xl' })}
            <div class="px-5" style="padding-top:20px;padding-bottom:40px;">
              <div class="flex flex-col items-center mb-6">
                <button onclick="triggerClassPhotoUpload('editClass')" class="relative w-24 h-24 rounded-3xl overflow-hidden mb-2" style="${cls.photo ? `background-image:url('${cls.photo}');background-size:cover;background-position:center;` : classCardBackgroundStyle(cls)}">
                  ${cls.photo ? '' : `<div class="w-full h-full flex items-center justify-center text-white">${Icon('book','w-9 h-9')}</div>`}
                  <div class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-[${NAVY}]" style="margin:4px;">${Icon('camera','w-4 h-4')}</div>
                </button>
                <button onclick="triggerClassPhotoUpload('editClass')" class="text-sm font-semibold" style="color:${NAVY};">Change class photo</button>
              </div>
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Class Name (required)</label>
              <input type="text" id="edit-class-name" value="${escapeHtml(d.name)}" oninput="editClassDraft.name=this.value" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Section</label>
              <input type="text" id="edit-class-section" value="${escapeHtml(d.section)}" oninput="editClassDraft.section=this.value" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Subject</label>
              <input type="text" id="edit-class-subject" value="${escapeHtml(d.subject)}" oninput="editClassDraft.subject=this.value" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
              <textarea id="edit-class-description" rows="4" oninput="editClassDraft.description=this.value" placeholder="What's this class about?" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-5 resize-none">${escapeHtml(d.description)}</textarea>
              <button id="edit-class-save-btn" onclick="saveEditedClass()" class="w-full font-semibold text-sm py-3 rounded-2xl text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Save changes</button>
            </div>
            </div>`;
        }
        async function saveEditedClass(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const d = editClassDraft;
          if (!cls || !d) return;
          const name = (d.name || '').trim();
          if (!name) { openAppAlertModal('Enter a class name'); return; }
          const btn = document.getElementById('edit-class-save-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; btn.textContent = 'Saving...'; }
          cls.name = name;
          cls.section = (d.section || '').trim();
          cls.subject = (d.subject || '').trim();
          cls.description = (d.description || '').trim();
          if (classSaveTimers[cls.id]) { clearTimeout(classSaveTimers[cls.id]); delete classSaveTimers[cls.id]; }
          const sb = getSupabaseClient();
          let failed = false;
          if (sb) {
            const { id, code, teacherId, role, ...data } = cls;
            try {
              const { error } = await sb.from(CLASSES_TABLE).update({ data, updated_at: new Date().toISOString() }).eq('id', cls.id);
              if (error) failed = true;
            } catch (e) { failed = true; }
          }
          if (failed) {
            if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = 'Save changes'; }
            openAppAlertModal("Couldn't save your changes -- check your connection and try again.");
            return;
          }
          editClassDraft = null;
          openOverlay('classDetail');
        }

        // ---- Class settings (name/photo/notifications/invite link) ----
        function classSettingsHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4 text-[${NAVY}]">
                <button onclick="openOverlay('classDetail')">${IconBold('back','w-5 h-5')}</button>
                <div class="font-semibold text-lg font-display">Class settings</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-8">
              <div class="flex flex-col items-center mb-6">
                <button onclick="triggerClassPhotoUpload()" class="relative w-24 h-24 rounded-3xl overflow-hidden mb-2" style="${cls.photo ? `background-image:url('${cls.photo}');background-size:cover;background-position:center;` : classCardBackgroundStyle(cls)}">
                  ${cls.photo ? '' : `<div class="w-full h-full flex items-center justify-center text-white">${Icon('book','w-9 h-9')}</div>`}
                  <div class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-[${NAVY}]" style="margin:4px;">${Icon('camera','w-4 h-4')}</div>
                </button>
                <button onclick="triggerClassPhotoUpload()" class="text-sm font-semibold" style="color:${NAVY};">Change class photo</button>
              </div>

              <label class="text-xs font-semibold text-gray-500 mb-1 block">Class name</label>
              <input type="text" id="class-settings-name-input" value="${escapeHtml(cls.name)}" oninput="updateClassName(this.value)" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">

              <label class="text-xs font-semibold text-gray-500 mb-1 block">Section</label>
              <input type="text" id="class-settings-section-input" value="${cls.section || ''}" oninput="updateClassSection(this.value)" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-6">

              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notifications</div>
              <div class="rounded-2xl border border-gray-100 divide-y px-4 bg-white shadow-sm mb-6">
                ${notificationSettingsRow('bell','bg-amber-100','text-amber-600','Class notifications','Get notified about announcements and classwork', cls.notificationsEnabled, "toggleClassNotifications()")}
              </div>

              ${cls.code ? `<div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Class code</div>
              <div class="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-4 mb-6">
                <div class="text-lg font-bold tracking-widest text-[${NAVY}]">${cls.code}</div>
                <button onclick="copyClassCode('${cls.code}')" class="font-semibold text-sm" style="color:${NAVY};">Copy code</button>
              </div>` : ''}

              ${cls.role === 'teacher'
                ? `<button onclick="confirmDeleteCurrentClass()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-red-500 border border-red-100 bg-red-50">
                    ${IconBold('trash','w-3.5 h-3.5')} Delete class
                  </button>`
                : `<button onclick="confirmLeaveCurrentClass()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-red-500 border border-red-100 bg-red-50">
                    ${IconBold('back','w-3.5 h-3.5')} Leave class
                  </button>`}
            </div>`;
        }

        let classPhotoUploadReturnTo = 'classSettings';
        function triggerClassPhotoUpload(returnTo){
          classPhotoUploadReturnTo = returnTo || 'classSettings';
          const input = document.getElementById('class-photo-input');
          if (input) input.click();
        }

        function handleClassPhotoSelected(e){
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const reader = new FileReader();
          reader.onload = function(ev){
            cls.photo = ev.target.result;
            queueSaveClassRemote(cls);
            openOverlay(classPhotoUploadReturnTo);
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }

        function updateClassName(value){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) { cls.name = value; queueSaveClassRemote(cls); }
        }

        function updateClassSection(value){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) { cls.section = value; queueSaveClassRemote(cls); }
        }

        function toggleClassNotifications(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          cls.notificationsEnabled = !cls.notificationsEnabled;
          queueSaveClassRemote(cls);
          openOverlay('classSettings');
        }

        // ---- Inviting students to class ----
        function backToClassDetailPeople(){
          classDetailTab = 'people';
          openOverlay('classDetail');
        }

        function openInviteStudentsOverlay(){
          inviteEmailsDraft = '';
          openOverlay('inviteStudents');
        }

        function inviteStudentsHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const canInvite = inviteEmailsDraft.trim().length > 0;
          return `
            <div class="flex-1 overflow-y-auto px-5 pb-8">
<div class="-mx-5">${overlayHeader('Invite students', 'var(--top-safe-pad)', 'backToClassDetailPeople()', null, { right: true, pb: '20px', titleSize: 'text-3xl' })}</div>
              ${cls && cls.code ? `<div class="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-4 mb-3">
                <div class="min-w-0 text-gray-700">
                  <div class="font-semibold">Class code</div>
                  <div class="text-lg font-bold tracking-widest text-[${NAVY}]">${cls.code}</div>
                </div>
                <button onclick="copyClassCode('${cls.code}')" class="font-semibold text-sm flex-shrink-0" style="color:${NAVY};">Copy code</button>
              </div>
              <div class="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-4 mb-6">
                <div class="flex items-center gap-2 min-w-0 text-gray-700">
                  ${Icon('link','w-5 h-5 flex-shrink-0')}
                  <span class="font-semibold truncate">Class invite</span>
                </div>
                <div class="flex items-center gap-4 flex-shrink-0">
                  <button onclick="shareClassInviteLink()" class="font-semibold text-sm" style="color:${NAVY};">Share</button>
                  <button onclick="copyClassInviteLink()" class="font-semibold text-sm" style="color:${NAVY};">Copy link</button>
                </div>
              </div>` : ''}
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Enter email addresses</label>
              <textarea id="invite-emails-input" oninput="inviteEmailsDraft=this.value; const b=document.getElementById('invite-submit-btn'); if(b){const c=inviteEmailsDraft.trim().length>0; b.disabled=!c; b.className='w-full font-semibold text-sm py-3 rounded-2xl mt-4 '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)':''; b.style.boxShadow=c?'0 4px 14px rgba(65,105,225,0.35)':'';}" placeholder="e.g. ama@example.com, kojo@example.com" rows="4" class="w-full bg-gray-100 border-2 border-gray-300 rounded-2xl px-4 py-3 text-sm mb-2">${inviteEmailsDraft}</textarea>
              <div class="text-xs text-gray-400 leading-relaxed">${cls && cls.code ? 'Separate multiple addresses with commas, or just share the class code above so students can join themselves.' : 'Separate multiple addresses with commas.'}</div>
              <button id="invite-submit-btn" onclick="submitInviteStudents()" ${canInvite ? '' : 'disabled'} class="w-full font-semibold text-sm py-3 rounded-2xl mt-4 ${canInvite ? 'text-white' : 'text-gray-400 bg-gray-100'}" style="${canInvite ? `background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);` : ''}">Invite</button>
            </div>`;
        }

        function classInviteLink(){
          const cls = myClasses.find(c => c.id === currentClassId);
          return 'https://stitch.app/join/' + (cls ? cls.code : '');
        }

        function copyClassInviteLink(){
          const link = classInviteLink();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Invite link copied!'));
          } else {
            openAppAlertModal('Invite link: ' + link);
          }
        }

        function shareClassInviteLink(){
          const link = classInviteLink();
          if (navigator.share) {
            navigator.share({ title: 'Join my class', text: 'Join my class on Stitch', url: link }).catch(() => {});
          } else {
            openAppAlertModal('Invite link: ' + link);
          }
        }

        async function recordClassInviteRemote(classId, email){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const id = 'cinv' + Date.now() + Math.random().toString(36).slice(2, 6);
            await sb.from('class_invites').insert({ id, class_id: classId, email: email.toLowerCase() });
          } catch (e) {  }
        }

        async function submitInviteStudents(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const raw = (document.getElementById('invite-emails-input') ? document.getElementById('invite-emails-input').value : inviteEmailsDraft).trim();
          if (!raw) return;
          const emails = raw.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
          emails.forEach(email => {
            const nameGuess = email.split('@')[0].replace(/[._]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            cls.students.push(cls.isCourse ? { name: nameGuess, email, pending: true } : { name: nameGuess, email });
            if (!cls.isCourse) recordClassInviteRemote(cls.id, email);
          });
          queueSaveClassRemote(cls);
          backToClassDetailPeople();
        }

        function cancelStudentInvite(classId, index){
          const cls = myClasses.find(c => c.id === classId);
          if (!cls || !cls.students) return;
          const removed = cls.students[index];
          cls.students.splice(index, 1);
          queueSaveClassRemote(cls);
          if (removed && removed.email && !cls.isCourse) {
            const sb = getSupabaseClient();
            if (sb) {
              const likeSafeEmail = removed.email.replace(/[\\%_]/g, ch => '\\' + ch);
              sb.from('class_invites').delete().eq('class_id', classId).ilike('email', likeSafeEmail).then(() => {}, () => {});
            }
          }
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
        }

        // ---- Study timetable (weekly class schedule) ----
        function studyTimetableHTML(){
          const upcoming = getNextUpcomingClass();
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Study Timetable', '20px', null, null, { right: true, pb: '20px', titleSize: 'text-3xl' })}
            <div class="px-5 pb-10">
              <div class="text-base text-gray-500 mb-5">Your weekly schedule, all in one place; we'll notify you before each class starts.</div>

              <div class="bg-white rounded-3xl p-5 mb-5 shadow-sm">
                <div class="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">New Entry · Schedule a Class</div>
                <label class="text-sm font-semibold text-gray-500 mb-1 block">Day</label>
                <select id="class-day-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base mb-4">
                  <option value="">(Select day)</option>
                  ${WEEKDAYS.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
                <label class="text-sm font-semibold text-gray-500 mb-1 block">Subject</label>
                <input type="text" id="class-subject-input" placeholder="e.g. Organic Chemistry" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base mb-4">
                <div class="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label class="text-sm font-semibold text-gray-500 mb-1 block">Start time</label>
                    <input type="time" id="class-start-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base">
                  </div>
                  <div>
                    <label class="text-sm font-semibold text-gray-500 mb-1 block">End time</label>
                    <input type="time" id="class-end-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base">
                  </div>
                </div>
                <label class="text-sm font-semibold text-gray-500 mb-1 block">Room / Location (optional)</label>
                <input type="text" id="class-room-input" placeholder="e.g. Lecture Hall 3" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base mb-4">
                <label class="text-sm font-semibold text-gray-500 mb-1 block">Remind me</label>
                <select id="class-lead-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base mb-5">
                  <option value="0">Right at the time</option>
                  <option value="10" selected>10 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="30">30 minutes before</option>
                  <option value="60">1 hour before</option>
                </select>
                <button onclick="submitClassSchedule()" class="w-full font-semibold text-base py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">+ Add Class</button>
              </div>

              ${upcoming ? `
                <div class="rounded-2xl p-4 mb-5 flex items-center gap-3" style="background:rgba(217,119,6,0.12);">
                  ${Icon('bell','w-5 h-5 text-amber-600 flex-shrink-0')}
                  <div class="text-sm text-gray-800 flex-1"><span class="font-bold">Up next:</span> ${escapeHtml(upcoming.subject)}, ${upcoming.dayLabel} at ${formatTime12(upcoming.start)}</div>
                  <button onclick="addClassToCalendar('${upcoming.id}')" class="text-amber-700 flex-shrink-0">${Icon('calendar','w-5 h-5')}</button>
                </div>` : ''}

              <div class="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">Weekly schedule</div>
              ${WEEKDAYS.map(d => weekdayScheduleCard(d)).join('')}
            </div>
            </div>`;
        }

        function weekdayScheduleCard(day){
          const classes = classSchedule.filter(c => c.day === day).sort((a,b) => a.start.localeCompare(b.start));
          return `
            <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <div class="font-bold text-lg text-[${NAVY}]">${day}</div>
                <div class="text-sm font-bold text-gray-400">${classes.length} class${classes.length===1?'':'es'}</div>
              </div>
              ${classes.length === 0 ? `<div class="text-base text-gray-400 text-center py-3">No classes, free day</div>` : classes.map(c => `
                <div class="flex items-center justify-between bg-amber-50 rounded-2xl px-4 py-3 mb-2">
                  <div class="min-w-0">
                    <div class="text-sm font-bold text-amber-700">${formatTime12(c.start)} - ${formatTime12(c.end)}</div>
                    <div class="font-semibold text-base text-gray-800 truncate">${escapeHtml(c.subject)}${c.room ? ' · ' + c.room : ''}</div>
                  </div>
                  <div class="flex items-center gap-3 flex-shrink-0">
                    <button onclick="addClassToCalendar('${c.id}')" class="text-gray-400">${Icon('calendar','w-4 h-4')}</button>
                    <button onclick="deleteClassEntry('${c.id}')" class="text-gray-400">${Icon('trash','w-4 h-4')}</button>
                  </div>
                </div>`).join('')}
            </div>`;
        }

        function submitClassSchedule(){
          const day = document.getElementById('class-day-input').value;
          const subject = document.getElementById('class-subject-input').value.trim();
          const start = document.getElementById('class-start-input').value;
          const end = document.getElementById('class-end-input').value;
          const room = document.getElementById('class-room-input').value.trim();
          const lead = parseInt(document.getElementById('class-lead-input').value, 10) || 0;
          if (!day || !subject || !start || !end) { openAppAlertModal('Please select a day, subject, start time, and end time.'); return; }
          classSchedule.push({ id: 'cls-' + Date.now(), day, subject, start, end, room, lead });
          ensureNotificationPermission();
          openOverlay('studyTimetable');
          queueSaveUserState();
        }

        function deleteClassEntry(id){
          classSchedule = classSchedule.filter(c => c.id !== id);
          openOverlay('studyTimetable');
          queueSaveUserState();
        }

        function getNextUpcomingClass(){
          if (!classSchedule.length) return null;
          const now = new Date();
          let best = null;
          classSchedule.forEach(c => {
            const dayIdx = WEEKDAYS.indexOf(c.day);
            const [h,m] = c.start.split(':').map(Number);
            let diffDays = (dayIdx - now.getDay() + 7) % 7;
            const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays, h, m, 0, 0);
            if (candidate < now) candidate.setDate(candidate.getDate() + 7);
            if (!best || candidate < best.when) best = { ...c, when: candidate };
          });
          if (!best) return null;
          const diffDays = Math.round((new Date(best.when.getFullYear(), best.when.getMonth(), best.when.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
          const dayLabel = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : best.day;
          return { ...best, dayLabel };
        }

        // ---- Study reminders ----
        function studyRemindersHTML(){
          const sorted = [...studyReminders].sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
          return `
            <div class="flex-1 overflow-y-auto no-scrollbar">
            ${overlayHeader('Set Reminders', '20px', null, null, { right: true, pb: '20px', titleSize: 'text-3xl' })}
            <div class="px-5 pb-10">
              <div class="text-base text-gray-500 mb-5">Add an exam, deadline, or study session and we'll prompt you as it gets close.</div>

              <div class="bg-white rounded-3xl p-5 mb-5 shadow-sm">
                <div class="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">New Reminder · Add an Event</div>
                <label class="text-sm font-semibold text-gray-500 mb-1 block">Event</label>
                <input type="text" id="reminder-event-input" placeholder="e.g. Chemistry Mid-sem" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base mb-4">
                <label class="text-sm font-semibold text-gray-500 mb-1 block">Type</label>
                <select id="reminder-type-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base mb-4">
                  <option>Exam</option>
                  <option>Deadline</option>
                  <option>Study Session</option>
                </select>
                <div class="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label class="text-sm font-semibold text-gray-500 mb-1 block">Date</label>
                    <input type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="10" placeholder="DD/MM/YYYY" oninput="this.value=formatTypedDateDigits(this.value)" id="reminder-date-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base">
                    ${typedDateHintHTML()}
                  </div>
                  <div>
                    <label class="text-sm font-semibold text-gray-500 mb-1 block">Time</label>
                    <input type="time" id="reminder-time-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base">
                  </div>
                </div>
                <label class="text-sm font-semibold text-gray-500 mb-1 block">Remind me</label>
                <select id="reminder-lead-input" class="w-full bg-gray-100 border-2 border-gray-200 rounded-2xl px-4 py-3 text-base mb-5">
                  <option value="0">Right at the time</option>
                  <option value="15">15 minutes before</option>
                  <option value="60" selected>1 hour before</option>
                  <option value="180">3 hours before</option>
                  <option value="1440">1 day before</option>
                </select>
                <button onclick="submitReminder()" class="w-full font-semibold text-base py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">+ Add Reminder</button>
              </div>

              <div class="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">Upcoming</div>
              ${sorted.length === 0 ? `<div class="text-sm text-gray-400 text-center py-6">No reminders yet</div>` : sorted.map(r => reminderRow(r)).join('')}
            </div>
            </div>`;
        }

        function reminderRow(r){
          return `
            <div class="bg-white rounded-3xl p-4 flex items-center gap-3 mb-3 shadow-sm">
              <div class="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('bell','w-6 h-6')}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <div class="font-semibold text-base truncate">${escapeHtml(r.title)}</div>
                  <span class="text-xs font-bold uppercase text-gray-400 flex-shrink-0">${r.type}</span>
                </div>
                <div class="text-sm text-gray-500 mt-1">${formatReminderDate(r.date)} · ${formatTime12(r.time)}</div>
              </div>
              <button onclick="addReminderToCalendar('${r.id}')" class="text-gray-400 flex-shrink-0">${Icon('calendar','w-4 h-4')}</button>
              <button onclick="deleteReminder('${r.id}')" class="text-gray-400 flex-shrink-0">${Icon('trash','w-4 h-4')}</button>
            </div>`;
        }

        function submitReminder(){
          const title = document.getElementById('reminder-event-input').value.trim();
          const type = document.getElementById('reminder-type-input').value;
          const dateTyped = document.getElementById('reminder-date-input').value;
          const time = document.getElementById('reminder-time-input').value;
          const lead = parseInt(document.getElementById('reminder-lead-input').value, 10) || 0;
          if (!title || !dateTyped || !time) { openAppAlertModal('Please fill in the event, date, and time.'); return; }
          const dateParsed = parseTypedDateDDMMYYYY(dateTyped);
          if (dateParsed.error || !dateParsed.iso) { openAppAlertModal(dateParsed.error || 'Please enter the date as DD/MM/YYYY.'); return; }
          const date = dateParsed.iso;
          studyReminders.push({ id: 'rem-' + Date.now(), title, type, date, time, lead });
          ensureNotificationPermission();
          openOverlay('studyReminders');
          queueSaveUserState();
        }

        function deleteReminder(id){
          studyReminders = studyReminders.filter(r => r.id !== id);
          openOverlay('studyReminders');
          queueSaveUserState();
        }

        function formatReminderDate(dateStr){
          const d = new Date(dateStr + 'T00:00:00');
          return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        }

        function formatTime12(t){
          if (!t) return '';
          const [h, m] = t.split(':').map(Number);
          const period = h >= 12 ? 'PM' : 'AM';
          const h12 = ((h + 11) % 12) + 1;
          return h12 + ':' + String(m).padStart(2, '0') + ' ' + period;
        }

        // ---- Local push notifications for planner/classroom events ----
        function ensureNotificationPermission(){
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }

        function pushInAppNotification(title, body){
          const el = document.createElement('div');
          el.className = 'fixed left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3';
          el.style.cssText = 'top:calc(env(safe-area-inset-top, 12px) + 12px); width:calc(100% - 32px); max-width:480px; box-shadow:0 10px 30px rgba(0,0,0,.18);';
          el.innerHTML = `
            <div class="min-w-0 flex-1">
              <div class="font-bold text-sm text-[${NAVY}] truncate">${escapeHtml(title)}</div>
              <div class="text-xs text-gray-500 break-words" style="overflow-wrap:break-word;">${escapeHtml(body)}</div>
            </div>
            <button onclick="this.parentElement.remove()" class="text-gray-300 flex-shrink-0">${Icon('close','w-4 h-4')}</button>`;
          document.body.appendChild(el);
          enableSwipeDismiss(el, () => el.remove(), 'translateX(-50%)');
          setTimeout(() => el.remove(), 7000);
        }

        function fireStudyNotification(title, body){
          getCurrentUserId().then(myId => {
            if (myId) sendPushTo(myId, { title, body, tag: 'study-reminder' });
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification(title, { body }); return; } catch (e) {  }
          }
          pushInAppNotification(title, body);
        }

        function checkStudyPlannerNotifications(){
          const now = new Date();
          classSchedule.forEach(c => {
            const dayIdx = WEEKDAYS.indexOf(c.day);
            if (dayIdx !== now.getDay()) return;
            const [h, m] = c.start.split(':').map(Number);
            const classTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
            const diffMin = (classTime - now) / 60000;
            const dateTag = now.toDateString();
            const lead = (typeof c.lead === 'number') ? c.lead : 10;
            if (lead > 0) {
              const leadKey = 'cls-lead-' + c.id + '-' + dateTag;
              if (diffMin <= lead && diffMin > lead - 1.5 && !notifiedKeys.has(leadKey)) {
                notifiedKeys.add(leadKey);
                fireStudyNotification('Upcoming class', c.subject + ' starts at ' + formatTime12(c.start) + (c.room ? ' · ' + c.room : ''));
              }
            }
            const nowKey = 'cls-now-' + c.id + '-' + dateTag;
            if (diffMin <= 0 && diffMin > -1.5 && !notifiedKeys.has(nowKey)) {
              notifiedKeys.add(nowKey);
              fireStudyNotification('Class starting now', c.subject + ' is starting now' + (c.room ? ' · ' + c.room : ''));
            }
          });
          studyReminders.forEach(r => {
            const [y, mo, da] = r.date.split('-').map(Number);
            const [h, m] = r.time.split(':').map(Number);
            const remTime = new Date(y, mo - 1, da, h, m, 0, 0);
            const diffMin = (remTime - now) / 60000;
            const lead = (typeof r.lead === 'number') ? r.lead : 60;
            if (lead > 0) {
              const leadKey = 'rem-lead-' + r.id;
              if (diffMin <= lead && diffMin > lead - 1.5 && !notifiedKeys.has(leadKey)) {
                notifiedKeys.add(leadKey);
                fireStudyNotification(r.type + ' reminder', r.title + ', due ' + formatTime12(r.time));
              }
            }
            const nowKey = 'rem-now-' + r.id;
            if (diffMin <= 0 && diffMin > -1.5 && !notifiedKeys.has(nowKey)) {
              notifiedKeys.add(nowKey);
              fireStudyNotification(r.type + ' due now', r.title + ' is due now.');
            }
          });
        }
        setInterval(checkStudyPlannerNotifications, 30000);

        function checkClassroomNotifications(){
          const now = new Date();
          myClasses.forEach(cls => {
            (cls.lectures || []).forEach(l => {
              if (l.status !== 'scheduled' || !l.date || !l.time) return;
              const [y, mo, da] = l.date.split('-').map(Number);
              const [h, m] = l.time.split(':').map(Number);
              const lecTime = new Date(y, mo - 1, da, h, m, 0, 0);
              const diffMin = (lecTime - now) / 60000;
              const key = 'lec-' + l.id;
              if (diffMin <= 10 && diffMin > 8.5 && !notifiedKeys.has(key)) {
                notifiedKeys.add(key);
                fireStudyNotification('Upcoming lecture', l.title + ' starts at ' + formatTime12(l.time) + ' · ' + cls.name);
              }
            });
            (cls.classwork || []).forEach(w => {
              if (!w.dueRaw) return;
              const [y, mo, da] = w.dueRaw.split('-').map(Number);
              const dueDate = new Date(y, mo - 1, da, 0, 0, 0, 0);
              const key = 'work-' + w.id;
              if (dueDate.toDateString() === now.toDateString() && !notifiedKeys.has(key)) {
                notifiedKeys.add(key);
                fireStudyNotification(classworkTypeLabel(w.type) + ' due today', w.title + ' in ' + cls.name + ' is due today.');
              }
            });
          });
        }
        setInterval(checkClassroomNotifications, 30000);

        // ---- Export class/reminder to device calendar (.ics) ----
        function downloadICS(title, start, end){
          const pad = n => String(n).padStart(2, '0');
          const fmt = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
          const ics = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
            'UID:' + Date.now() + '@stitch-study-planner',
            'DTSTAMP:' + fmt(new Date()),
            'DTSTART:' + fmt(start),
            'DTEND:' + fmt(end),
            'SUMMARY:' + title,
            'END:VEVENT', 'END:VCALENDAR'
          ].join('\r\n');
          const blob = new Blob([ics], { type: 'text/calendar' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = title.replace(/[^a-z0-9]+/gi, '_') + '.ics';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          pushInAppNotification('Added to calendar', title + ': open the downloaded file to add it to your calendar app.');
        }

        function addClassToCalendar(id){
          const c = classSchedule.find(x => x.id === id);
          if (!c) return;
          const dayIdx = WEEKDAYS.indexOf(c.day);
          const now = new Date();
          const [sh, sm] = c.start.split(':').map(Number);
          const [eh, em] = c.end.split(':').map(Number);
          let diffDays = (dayIdx - now.getDay() + 7) % 7;
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays, sh, sm, 0, 0);
          if (start < now) start.setDate(start.getDate() + 7);
          const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), eh, em, 0, 0);
          downloadICS(c.subject + (c.room ? ' (' + c.room + ')' : ''), start, end);
        }

        function addReminderToCalendar(id){
          const r = studyReminders.find(x => x.id === id);
          if (!r) return;
          const [y, mo, da] = r.date.split('-').map(Number);
          const [h, m] = r.time.split(':').map(Number);
          const start = new Date(y, mo - 1, da, h, m, 0, 0);
          const end = new Date(start.getTime() + 60 * 60000);
          downloadICS(r.type + ': ' + r.title, start, end);
        }
