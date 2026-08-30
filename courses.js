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
            const reply = await callClaude(system, transcript, 'chat');
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

        // Image/video attachments start out as blob: preview URLs (fast,
        // local-only). Those blob URLs die the moment the tab/session ends,
        // so if a message carrying one gets archived into aiChatSessions and
        // persisted to the account, it comes back as a broken image next
        // time the student logs in. To fix that, once a message with media
        // is sent we upload the file to permanent storage in the background
        // and swap the blob URL out for the permanent one before it ever
        // gets saved.
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
          if (!aiChatInputFocused) {
            ov.style.bottom = navH + 'px';
            if (composerWrap) composerWrap.style.paddingBottom = '20px';
            if (classroomNavEl) classroomNavEl.style.display = '';
            return;
          }
          const vv = window.visualViewport;
          const keyboardInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
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

        function handleAIChatInputFocus(){
          aiChatInputFocused = true;
          syncAIClassKeyboardInset();
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
          const img = document.getElementById('ai-robot-img');
          const pose = currentAIRobotPose();
          if (img) img.src = pose.src;
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
          const pose = currentAIRobotPose();
          return `
            <div class="h-full min-h-full flex flex-col items-center justify-center text-center px-8">
              <div id="ai-robot-container" class="ai-robot-container">
                <img id="ai-robot-img" class="ai-robot-img" src="${pose.src}" alt="Stitch Bot">
              </div>
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

          // Tables get rendered into HTML and spliced back in via @@TABLE#@@
          // *before* the math/mermaid/graph placeholders are resolved below,
          // so a table cell containing "@@MATH17@@" only gets that token
          // inserted into `html` once @@TABLE@@ itself is replaced. Doing the
          // TABLE substitution first (so all nested placeholders actually
          // land in `html`) and only then resolving MATH/MERMAID/GRAPH fixes
          // tables that contain formulas showing raw "@@MATH17@@" text
          // instead of the rendered value.
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

        // Renders a block of raw markdown table lines (header, separator,
        // data rows...) as a real HTML table, styled to match the other
        // AI-drawn tables (renderMatrixBlock) so it looks native to the app
        // rather than like leftover pipe-and-dash syntax.
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
                ${(!isThinking && !text) ? '' : `<div class="ai-msg-bubble bg-gray-100 px-4 py-3.5 text-[15px] text-gray-700 leading-relaxed" style="border-radius:20px 20px 20px 0;">${isThinking ? aiThinkingIndicatorHTML() : formatAIText(text)}</div>`}
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
                <div class="flex items-center gap-2 bg-white/15 rounded-xl px-2.5 py-1.5">
                  ${Icon(aiFileIcon(f.type),'w-4 h-4')}<span class="text-xs text-white truncate">${escapeHtml(f.name)}</span>
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
            aiChatMessages.push({ role:'user', text, attachments, voice: !!viaVoice });
            aiChatMessages.push({ role:'bot', text: `You've used all your daily Stitch Bot credits for today. They reset tomorrow.`, promptLimit: true });
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

        // Matches phrases like "the screenshot I sent", "that image", "the picture I uploaded", etc.,
        // so we know the student is referring back to an image from earlier in the chat.
        const PAST_IMAGE_REFERENCE_RE = /\b(screenshot|screen ?shot|the (image|picture|photo|pic)|that (image|picture|photo|pic)|(i|I) (sent|uploaded|attached|shared)|sent (you|earlier)|uploaded (it|that|earlier))\b/i;
        function referencesPastImage(text){
          return PAST_IMAGE_REFERENCE_RE.test(text || '');
        }

        // Looks back through the conversation (skipping the current turn's user message and
        // "thinking" placeholder, which is why we start at length - 3) for the most recent
        // message that had real image attachments still in memory this session, so the
        // student can ask a follow-up about a screenshot without re-uploading it every time.
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
              'If nothing relevant was uploaded, answer from your general knowledge instead. Never mention Claude or Anthropic. ' +
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
            return { text: ackLine + (reply || fallbackAIResponse(text)) };
          } catch (err) {
            const msg = (err && err.message) || '';
            if (msg.startsWith('Too many AI requests')) return { text: ackLine + msg };
            return { text: ackLine + fallbackAIResponse(text) };
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
          { key:'audio', label:'Audio' },
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
        let courseTeachersViewingId = null; 
        let courseAnnouncementDraft = ''; 

        const TEAM_STITCH_TEACHER = 'Stitch Team';

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
          newCourseDraft = { title:'', description:'', deliveryType:'uploaded', modules:[], resources:[], finalItems:[], photo:null };
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
              <button onclick="courseCardMenuOpenId=null; openCourseTeachers('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('personPlus','w-4 h-4')} Teachers</button>
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

        function coursesHomeHTML(){
          return `
            ${isCurrentUserAdmin() ? `
              <div class="flex gap-2 mb-5">
                <button onclick="openNewCourse()" class="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                  ${Icon('plus','w-4 h-4')} Create a Course
                </button>
              </div>` : ''}
            ${allCourses.length ? allCourses.map(courseCardHTML).join('') : `
              <div class="flex flex-col items-center text-center py-10">
                <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('book','w-9 h-9')}</div>
                <div class="font-bold text-gray-700 mb-1">No courses yet</div>
                <div class="text-sm text-gray-400 leading-relaxed">Structured, self-paced courses will show up here once one is published.</div>
              </div>`}`;
        }

        function courseCardHTML(c){
          const enrolled = enrolledCourseIds.includes(c.id);
          const total = courseTotalItems(c);
          const done = courseCompletedItems(c);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const isLive = c.deliveryType === 'live';
          const isAdmin = isCurrentUserAdmin();
          const idx = allCourses.findIndex(x => x.id === c.id);
          const motif = classCardMotifs[blueCardMotifIndex(c, idx === -1 ? 0 : idx) % classCardMotifs.length];
          return `
            <div onclick="openCourseDetail('${c.id}')" class="relative text-white rounded-3xl p-5 mb-3 shadow-sm cursor-pointer overflow-hidden" style="${c.photo ? `background-image:linear-gradient(rgba(10,37,64,0.45),rgba(10,37,64,0.45)),url('${c.photo}');background-size:cover;background-position:center;` : blueCardBackgroundStyle(c, idx === -1 ? 0 : idx)}">
              ${c.photo ? '' : `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${motif}</svg>`}
              <div class="flex items-center justify-between gap-2 mb-1 relative">
                <div class="flex items-center gap-1.5 min-w-0">
                  ${isAdmin ? `<button onclick="event.stopPropagation(); deleteCourse('${c.id}')" title="Delete course" class="w-6 h-6 -ml-1 rounded-full flex items-center justify-center text-white/70 flex-shrink-0">${Icon('trash','w-3.5 h-3.5')}</button>` : ''}
                  <div class="text-xs font-bold uppercase tracking-wide text-white/70 truncate">${escapeHtml(c.org)}</div>
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 bg-white/20">${isLive ? '● Live' : 'Uploaded'}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  ${enrolled ? `<span class="text-[10px] font-bold uppercase text-emerald-200 flex-shrink-0">Enrolled</span>` : ''}
                </div>
              </div>
              <div class="text-lg font-bold font-display mb-1 relative">${escapeHtml(c.title)}</div>
              <div class="text-xs text-white/80 relative">${c.modules.length} module${c.modules.length === 1 ? '' : 's'} · ${total} lesson${total === 1 ? '' : 's'}${enrolled ? ` · ${pct}% complete` : ''}</div>
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
          return `
            <div class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;width:12rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="courseDetailMenuOpen=false; openEditCourse('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('edit','w-4 h-4')} Edit Course</button>
              <button onclick="courseDetailMenuOpen=false; openCourseTeachers('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('personPlus','w-4 h-4')} Teachers</button>
              <button onclick="courseDetailMenuOpen=false; deleteCourse('${courseId}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete</button>
            </div>`;
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
              ${overlayHeader('Enroll', '20px', `openOverlay('courseDetail')`)}
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
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
                  By enrolling you agree to complete coursework honestly, follow ${escapeHtml(c.org)}'s classroom guidelines, and understand your progress may be visible to the course's teachers. You can end your enrollment at any time from the course page.
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

        function submitCourseEnroll(){
          const d = courseEnrollDraft;
          if (!d || !d.name.trim() || !d.agreed) return;
          const courseId = d.courseId;
          courseEnrollments[courseId] = { name: d.name.trim(), email: d.email.trim(), agreedAt: Date.now() };
          if (!enrolledCourseIds.includes(courseId)) enrolledCourseIds.push(courseId);
          courseEnrollDraft = null;
          currentCourseId = courseId;
          openOverlay('courseDetail');
          queueSaveUserState();
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
            }
          );
        }

        // ---- Course detail screen (modules, resources, engage tabs) ----
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
              ${isCurrentUserAdmin()
                ? menuOverlayHeader(escapeHtml(c.title), courseDetailMenuOpen, 'toggleCourseDetailMenu', courseDetailMenuDropdownHTML(c.id))
                : overlayHeader(escapeHtml(c.title), '20px')}
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
                ${c.photo ? `<img src="${c.photo}" class="w-full rounded-3xl mb-4 object-cover" style="height:150px;" alt="">` : ''}
                <div class="flex items-center gap-2 mb-3">
                  <button onclick="openCourseTeachers('${c.id}')" class="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">${escapeHtml(c.org)}${(c.teachers && c.teachers.length) ? ` +${c.teachers.length}` : ''}</button>
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isLive ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}">${isLive ? '● Live Teaching' : 'Self-paced'}</span>
                </div>
                <div class="text-xl font-bold font-display mb-2" style="color:#1E90FF;">${escapeHtml(c.title)}</div>
                <div class="text-sm text-gray-600 leading-relaxed mb-4">${escapeHtml(c.description)}</div>

                <div class="flex gap-2 mb-4 bg-gray-100 rounded-full p-1">
                  <button onclick="setCourseDetailTab('content')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'content' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'content' ? `background:${NAVY};` : ''}">Content</button>
                  <button onclick="setCourseDetailTab('engage')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'engage' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'engage' ? `background:${NAVY};` : ''}">Engage${announcements.length ? ` (${announcements.length})` : ''}</button>
                  <button onclick="setCourseDetailTab('resources')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'resources' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'resources' ? `background:${NAVY};` : ''}">Resources${resources.length ? ` (${resources.length})` : ''}</button>
                </div>

                ${courseDetailTab === 'resources' ? courseResourcesTabHTML(c, enrolled) : courseDetailTab === 'engage' ? courseEngageTabHTML(c) : (!c.modules.length ? `
                  <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                    <div class="flex justify-center mb-2 text-gray-400">${Icon('book','w-6 h-6')}</div>
                    No modules have been added to this course yet.
                    ${isCurrentUserAdmin() ? `<button onclick="openEditCourse('${c.id}')" class="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-semibold text-xs text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${Icon('plus','w-3.5 h-3.5')} Add the first module</button>` : ''}
                  </div>` : `
                  <div class="flex items-center gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
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
                  ${mod.description ? `<div class="text-xs text-gray-500 leading-relaxed mb-3">${escapeHtml(mod.description)}</div>` : `<div class="mb-3"></div>`}
                  ${locked ? `
                    <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                      <div class="flex justify-center mb-2 text-gray-400">${Icon('lock','w-6 h-6')}</div>
                      Enroll to unlock this module. Module 1 is free to preview.
                    </div>` : `<div class="divide-y divide-gray-100">${mod.items.map(it => courseItemCardHTML(c, it)).join('')}</div>`}
                  ${(c.finalItems && c.finalItems.length) ? `
                    <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 mt-6">Final Project</div>
                    ${!enrolled ? `
                      <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                        <div class="flex justify-center mb-2 text-gray-400">${Icon('lock','w-6 h-6')}</div>
                        Enroll to unlock the final project.
                      </div>` : `<div class="divide-y divide-gray-100">${c.finalItems.map(it => courseItemCardHTML(c, it)).join('')}</div>`}
                  ` : ''}
                `)}
              </div>
            </div>`;
        }

        function courseResourcesTabHTML(course, enrolled){
          const resources = course.resources || [];
          const isAdmin = isCurrentUserAdmin();
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
          if (!isCurrentUserAdmin()) return;
          openEditCourse(courseId);
          addCourseDraftResource();
        }

        // ---- Course "Engage" tab (posts, quizzes, assignments) ----
        function courseEngageItems(course){
          const out = [];
          (course.modules || []).forEach((m, mi) => {
            (m.items || []).forEach((it, ii) => {
              if (it.type === 'assignment' || it.type === 'project' || courseItemIsQuiz(it.type)) {
                out.push({ mi, ii, moduleTitle: m.title, item: it });
              }
            });
          });
          return out;
        }

        function openEngageItem(courseId, mi, ii){
          if (!isCurrentUserAdmin()) return;
          openEditCourse(courseId);
          openEditCourseItemForm(mi, ii);
        }

        function openEngageAddModule(courseId){
          if (!isCurrentUserAdmin()) return;
          openEditCourse(courseId);
          addCourseDraftModule();
        }

        function openEngageAddItem(courseId, type){
          if (!isCurrentUserAdmin()) return;
          openEditCourse(courseId);
          if (!newCourseDraft.modules.length) addCourseDraftModule();
          const mi = newCourseDraft.modules.length - 1;
          openAddCourseItemForm(mi);
          newCourseAddingItemDraft.type = type;
          rerenderNewCourseOverlay();
        }

        function courseEngageQuizAssignmentSectionHTML(course){
          if (!isCurrentUserAdmin()) return '';
          const items = courseEngageItems(course);
          const typeIcon = { assignment:'doc', project:'book', practiceQuiz:'help', gradedQuiz:'help' };
          return `
            <div class="grid grid-cols-2 gap-2 mb-4">
              <button onclick="openEngageAddModule('${course.id}')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Module</button>
              <button onclick="openEngageAddItem('${course.id}','gradedQuiz')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Quiz</button>
              <button onclick="openEngageAddItem('${course.id}','assignment')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Assignment</button>
              <button onclick="openEngageAddItem('${course.id}','project')" class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-bold border border-dashed border-gray-300 text-gray-500">${Icon('plus','w-3.5 h-3.5')} Add Project</button>
            </div>
            <div class="text-sm font-bold text-gray-700 mb-2">Quizzes, Assignments & Projects</div>
            ${items.length ? items.map(({ mi, ii, moduleTitle, item }) => `
              <button onclick="openEngageItem('${course.id}', ${mi}, ${ii})" class="w-full flex items-center gap-3 bg-white rounded-3xl p-4 mb-3 shadow-sm border border-gray-100 text-left">
                <div class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:#1E90FF;">${Icon(typeIcon[item.type] || 'doc','w-5 h-5')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(item.title || 'Untitled')}</div>
                  <div class="text-xs text-gray-400 truncate">${courseItemTypeLabel(item.type)} · ${escapeHtml(moduleTitle)}</div>
                </div>
                <span class="text-gray-300 flex-shrink-0">${Icon('arrowRight','w-4 h-4')}</span>
              </button>`).join('') : `
              <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-6 text-center text-gray-500 text-sm mb-2">No quizzes, assignments, or projects yet -- add one above.</div>`}
            <div class="text-sm font-bold text-gray-700 mt-5 mb-2">Announcements</div>`;
        }

        function courseEngageTabHTML(course){
          const list = course.announcements || [];
          const isAdmin = isCurrentUserAdmin();
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

        function postCourseAnnouncement(courseId){
          if (!isCurrentUserAdmin()) return;
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
          if (!isCurrentUserAdmin()) return;
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
          const thumb = item.mediaType === 'image' && item.mediaUrl
            ? `<img src="${item.mediaUrl}" class="w-10 h-10 rounded-xl object-cover flex-shrink-0">`
            : item.mediaType === 'video' && item.mediaUrl
              ? `<div class="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0 text-white">${Icon('video','w-4 h-4')}</div>`
              : item.mediaType === 'document' && item.mediaUrl
                ? `<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.12);color:#1E90FF;">${Icon('doc','w-4 h-4')}</div>`
                : '';
          return `
            <div onclick="openCourseItemDetail('${course.id}','${item.id}')" class="py-4 cursor-pointer">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${thumb}
                  <div class="font-bold text-gray-800 truncate">${escapeHtml(item.title)}</div>
                </div>
                ${isCourseItemComplete(item) ? `<span title="Completed" class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">${Icon('check','w-4 h-4')}</span>` : ''}
              </div>
              <div class="flex items-center gap-1.5 text-xs font-semibold ${isCourseItemComplete(item) ? 'text-emerald-700' : 'text-gray-500'}">
                <span>${courseItemTypeLabel(item.type)}</span>
                ${item.duration ? `<span class="text-gray-400">· ${escapeHtml(item.duration)}</span>` : ''}
              </div>
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
        }

        function courseItemDetailHTML(){
          const { course, item } = findCourseItem();
          if (!course || !item) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          const isQuiz = courseItemIsQuiz(item.type);
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              ${overlayHeader(escapeHtml(item.title), '20px', `openCourseDetail('${course.id}')`)}
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
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
                  <div class="py-4 border-t border-gray-100 mb-5 text-sm text-gray-700 leading-relaxed">${escapeHtml(item.description)}</div>` : ''}
                ${(item.type === 'reading' || item.type === 'assignment' || item.type === 'project') ? `
                  <div class="py-4 border-t border-gray-100 mb-5 text-sm text-gray-700 leading-relaxed">${escapeHtml(item.description || 'No additional content was added for this item yet.')}</div>` : ''}
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
          if (!isCurrentUserAdmin()) return;
          resetNewCourseDraft();
          newCourseEditingId = null;
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = null;
          openOverlay('newCourse');
        }

        function openEditCourse(courseId){
          if (!isCurrentUserAdmin()) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c) return;
          newCourseDraft = JSON.parse(JSON.stringify({ title: c.title, description: c.description, deliveryType: c.deliveryType || 'uploaded', modules: c.modules, resources: c.resources || [], finalItems: c.finalItems || [], photo: c.photo || null }));
          newCourseEditingId = courseId;
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = null;
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
            <div class="bg-white rounded-3xl p-4 shadow-sm mb-3 border border-gray-100">
              <div class="flex items-center gap-2 mb-2">
                <input type="text" value="${escapeHtml(r.title)}" oninput="updateCourseDraftResourceField(${ri}, 'title', this.value)" placeholder="Resource title" class="flex-1 min-w-0 bg-gray-100 rounded-xl px-3 py-2 text-sm outline-none">
                <button onclick="removeCourseDraftResource(${ri})" class="text-red-500 flex-shrink-0">${Icon('close','w-4 h-4')}</button>
              </div>
              <div class="flex gap-1.5 mb-2">
                <button onclick="setCourseDraftResourceType(${ri},'video')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${r.type==='video' ? 'text-white' : 'bg-gray-100 text-gray-500'}" style="${r.type==='video' ? `background:${NAVY};` : ''}">${Icon('video','w-3.5 h-3.5')} Video</button>
                <button onclick="setCourseDraftResourceType(${ri},'audio')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${r.type==='audio' ? 'text-white' : 'bg-gray-100 text-gray-500'}" style="${r.type==='audio' ? `background:${NAVY};` : ''}">${Icon('mic','w-3.5 h-3.5')} Audio</button>
              </div>
              <input type="text" value="${escapeHtml(r.url)}" oninput="updateCourseDraftResourceField(${ri}, 'url', this.value)" placeholder="Link (YouTube, direct file, etc.)" class="w-full bg-gray-100 rounded-xl px-3 py-2 text-sm outline-none mb-2">
              <input type="text" value="${escapeHtml(r.duration)}" oninput="updateCourseDraftResourceField(${ri}, 'duration', this.value)" placeholder="Duration, e.g. 12 min (optional)" class="w-full bg-gray-100 rounded-xl px-3 py-2 text-sm outline-none">
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
          if (!isCurrentUserAdmin()) return;
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
          if (!isCurrentUserAdmin()) return;
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

        function closeCourseEditorGuard(fromPopState){
          if (!newCourseDraft.title.trim()) {
            if (fromPopState) {
              history.pushState({ stitchOverlay: 'newCourse' }, '');
            }
            openAppAlertModal('Please add a course title before leaving this page.');
            return;
          }
          closeOverlay(fromPopState);
        }

        async function publishNewCourse(){
          if (!isCurrentUserAdmin()) return;
          const d = newCourseDraft;
          if (!d.title.trim()) { openAppAlertModal('Please add a course title.'); return; }
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
            org: TEAM_STITCH_TEACHER,
            title: d.title.trim(),
            description: d.description.trim(),
            deliveryType: d.deliveryType || 'uploaded',
            modules: d.modules,
            resources: d.resources || [],
            finalItems: d.finalItems || [],
            photo: d.photo || null,
            announcements: [], 
            teachers: [], 
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

        // ---- Course teachers/co-instructors management ----
        function openCourseTeachers(courseId){
          courseTeachersViewingId = courseId;
          openOverlay('courseTeachers');
        }

        function courseTeachersHTML(){
          const c = allCourses.find(x => x.id === courseTeachersViewingId);
          if (!c) return `${overlayHeader('Teachers', '20px')}<div class="p-5 text-center text-gray-400 text-sm">This course is no longer available.</div>`;
          const isAdmin = isCurrentUserAdmin();
          const extra = c.teachers || [];
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              ${overlayHeader('Teachers', '20px')}
              <div class="flex-1 overflow-y-auto px-5 pb-8">
                <div class="flex items-center gap-3 py-3.5 border-b border-gray-100">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('user','w-5 h-5')}</div>
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-sm truncate">${TEAM_STITCH_TEACHER}</div>
                    <div class="text-xs text-gray-400">Course owner</div>
                  </div>
                </div>
                ${extra.map((t, i) => `
                  <div class="flex items-center gap-3 py-3.5 ${i < extra.length - 1 ? 'border-b border-gray-100' : ''}">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('user','w-5 h-5')}</div>
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold text-sm truncate">${escapeHtml(t.email)}</div>
                      <div class="text-xs text-gray-400">Invited teacher</div>
                    </div>
                    ${isAdmin ? `<button onclick="removeCourseTeacher('${c.id}', ${i})" class="text-xs font-semibold text-gray-400 flex-shrink-0">Remove</button>` : ''}
                  </div>`).join('')}
                ${isAdmin ? `
                  <button onclick="inviteCourseTeacher('${c.id}')" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border border-dashed border-gray-300 text-gray-500 mt-4">
                    ${Icon('personPlus','w-4 h-4')} Invite Teacher
                  </button>` : ''}
              </div>
            </div>`;
        }

        function inviteCourseTeacher(courseId){
          if (!isCurrentUserAdmin()) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c) return;
          const email = (prompt('Invite a teacher by email:') || '').trim();
          if (!email) return;
          if (!isValidEmail(email)) { openAppAlertModal('Please enter a valid email address.'); return; }
          if (!c.teachers) c.teachers = [];
          if (c.teachers.some(t => t.email.toLowerCase() === email.toLowerCase())) {
            openAppAlertModal('That teacher has already been invited to this course.');
            return;
          }
          c.teachers.push({ email });
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseTeachersHTML();
        }

        function removeCourseTeacher(courseId, index){
          if (!isCurrentUserAdmin()) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c || !c.teachers) return;
          c.teachers.splice(index, 1);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseTeachersHTML();
        }

        async function postCourseInsertRemote(course){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data } = await sb.auth.getUser();
            const user = data && data.user;
            const { error } = await sb.from(COURSES_TABLE).upsert({
              id: course.id,
              data: course,
              created_by: user ? user.id : null,
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
              .map(row => (row.data && typeof row.data === 'object') ? Object.assign({}, row.data, { id: row.id }) : null)
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
          }, 30000);
        }

        function applyRemoteCourseChange(payload){
          const row = payload.eventType === 'DELETE' ? payload.old : payload.new;
          if (!row || !row.id) return;
          if (payload.eventType === 'DELETE') {
            allCourses = allCourses.filter(c => c.id !== row.id);
          } else {
            const incoming = (row.data && typeof row.data === 'object') ? Object.assign({}, row.data, { id: row.id }) : null;
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

        function deleteCourse(courseId){
          if (!isCurrentUserAdmin()) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c) return;
          openAppConfirmModal(`Delete "${c.title}"?`, "This removes it for everyone and can't be undone.", 'Delete', function(){
            const idx = allCourses.indexOf(c);
            if (idx !== -1) allCourses.splice(idx, 1);
            enrolledCourseIds = enrolledCourseIds.filter(id => id !== courseId);
            deleteCourseRemote(courseId);
            if (currentCourseId === courseId) closeOverlay();
            renderStudy();
            queueSaveUserState();
          });
        }

        // ---- New course form markup ----
        function newCourseHTML(){
          const d = newCourseDraft;
          const isEditing = !!newCourseEditingId;
          return `
            ${overlayHeader(isEditing ? 'Edit Course' : 'Create a Course', '20px', 'closeCourseEditorGuard()')}
            <div class="flex-1 overflow-y-auto px-5 pb-8">
              <div class="flex flex-col items-center mb-5">
                <button onclick="triggerCoursePhotoUpload()" class="relative w-24 h-24 rounded-3xl overflow-hidden mb-2" style="${d.photo ? `background-image:url('${d.photo}');background-size:cover;background-position:center;` : `background:linear-gradient(135deg,${blueCardPalette[0][0]},${blueCardPalette[0][1]});`}">
                  ${d.photo ? '' : `<div class="w-full h-full flex items-center justify-center text-white">${Icon('book','w-9 h-9')}</div>`}
                  <div class="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-[${NAVY}]" style="margin:4px;">${Icon('camera','w-4 h-4')}</div>
                </button>
                <button onclick="triggerCoursePhotoUpload()" class="text-sm font-semibold" style="color:${NAVY};">${d.photo ? 'Change course photo' : 'Add a course photo'}</button>
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Course Title</label>
                <input type="text" value="${escapeHtml(d.title)}" oninput="updateNewCourseField('title', this.value)" placeholder="e.g. Data Analysis with R" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none">
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Course Type</label>
                <div class="flex gap-2">
                  ${courseDeliveryTypes.map(t => `
                    <button onclick="setNewCourseDeliveryType('${t.key}')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold ${d.deliveryType===t.key ? '' : 'bg-gray-100 text-gray-500'}" style="${d.deliveryType===t.key ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${t.label}</button>
                  `).join('')}
                </div>
                <div class="text-xs text-gray-400 mt-1.5">${courseDeliveryTypes.find(t => t.key === d.deliveryType) ? courseDeliveryTypes.find(t => t.key === d.deliveryType).description : ''}</div>
              </div>
              <div class="mb-4">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Teacher</label>
                <div class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-500">${TEAM_STITCH_TEACHER}${isEditing ? ' -- manage additional teachers from the course\'s Teachers button' : ' -- invite additional teachers after publishing, from the course\'s Teachers button'}</div>
              </div>
              <div class="mb-5">
                <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Description</label>
                <textarea oninput="updateNewCourseField('description', this.value)" placeholder="What will students learn in this course?" rows="3" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none">${escapeHtml(d.description)}</textarea>
              </div>

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Modules</div>
              ${d.modules.map((m, mi) => courseDraftModuleHTML(m, mi)).join('')}
              <button onclick="addCourseDraftModule()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border border-dashed border-gray-300 text-gray-500 mb-6">
                ${Icon('plus','w-4 h-4')} Add Module
              </button>

              ${courseDraftFinalItemsHTML()}

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Resources <span class="normal-case font-medium text-gray-400">(supplementary video &amp; audio)</span></div>
              ${(d.resources || []).map((r, ri) => courseDraftResourceHTML(r, ri)).join('')}
              <button onclick="addCourseDraftResource()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border border-dashed border-gray-300 text-gray-500 mb-6">
                ${Icon('plus','w-4 h-4')} Add Resource
              </button>

              <button onclick="publishNewCourse()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white" style="background:rgba(30,144,255,0.85);">
                ${isEditing ? 'Save Changes' : 'Publish Course'}
              </button>
              <div style="height:50px;"></div>
            </div>`;
        }

        function courseDraftModuleHTML(m, mi){
          return `
            <div class="bg-white rounded-3xl p-4 shadow-sm mb-3 border border-gray-100">
              <div class="flex items-center gap-2 mb-3">
                <span class="text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-blue-50 flex-shrink-0" style="color:${NAVY};">Module</span>
                <input type="text" value="${escapeHtml(m.title)}" oninput="updateCourseDraftModuleTitle(${mi}, this.value)" class="flex-1 min-w-0 bg-gray-100 rounded-xl px-3 py-2 text-sm font-semibold outline-none">
                <button onclick="removeCourseDraftModule(${mi})" class="text-red-500 flex-shrink-0">${Icon('close','w-4 h-4')}</button>
              </div>
              <textarea oninput="updateCourseDraftModuleDescription(${mi}, this.value)" placeholder="Module description (optional) -- what will students do in this module?" rows="2" class="w-full bg-gray-100 rounded-xl px-3 py-2 text-sm outline-none resize-none mb-3">${escapeHtml(m.description || '')}</textarea>
              ${m.items.map((it, ii) => `
                <div class="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-2">
                  <div class="min-w-0 flex items-center gap-2">
                    ${(it.mediaType === 'image') ? `<img src="${it.mediaUrl}" class="w-8 h-8 rounded-lg object-cover flex-shrink-0">` : ''}
                    ${(it.mediaType === 'video') ? `<div class="w-8 h-8 rounded-lg bg-black flex items-center justify-center flex-shrink-0 text-white">${Icon('video','w-3.5 h-3.5')}</div>` : ''}
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500 flex-shrink-0">Part</span>
                        <div class="text-sm font-semibold text-gray-700 truncate">${escapeHtml(it.title)}</div>
                      </div>
                      <div class="text-xs text-gray-400">${courseItemTypeLabel(it.type)}${it.duration ? ' · ' + escapeHtml(it.duration) : ''}</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="openEditCourseItemForm(${mi},${ii})" class="text-gray-400" style="padding:2px;">${Icon('edit','w-4 h-4')}</button>
                    <button onclick="removeCourseDraftItem(${mi},${ii})" class="text-red-500" style="padding:2px;">${Icon('close','w-4 h-4')}</button>
                  </div>
                </div>`).join('')}
              ${newCourseAddingItemModuleIndex === mi ? addCourseItemFormHTML() : `
                <button onclick="openAddCourseItemForm(${mi})" class="w-full flex items-center justify-center gap-2 rounded-xl py-2 font-semibold text-xs border border-dashed border-gray-300 text-gray-500">
                  ${Icon('plus','w-3.5 h-3.5')} Add Part <span class="normal-case font-medium text-gray-400">(video, picture, reading, assignment, project, or quiz)</span>
                </button>`}
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
                <div class="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-2">
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
              <div class="flex items-center gap-2 mb-1.5">
                <input type="text" value="${escapeHtml(q.text)}" oninput="updateAddingItemQuestionText(${qi}, this.value)" placeholder="Question ${qi + 1}" class="flex-1 min-w-0 bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs outline-none">
                <button onclick="removeAddingItemQuestion(${qi})" class="text-red-500 flex-shrink-0">${Icon('close','w-3.5 h-3.5')}</button>
              </div>
              ${q.options.map((opt, oi) => `
                <div class="flex items-center gap-2 mb-1">
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
          const prevAnnouncementIds = notifyMe ? new Set((prev.announcements || []).map(a => a.id)) : null;
          const prevClassworkIds = notifyMe ? new Set((prev.classwork || []).map(w => w.id)) : null;
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
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classDetail' && currentClassId === row.id) {
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = classDetailHTML();
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
          });
        }

        async function claimPendingClassInvites(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { error } = await sb.rpc('claim_class_invites');
            if (error) {
              // A 404/"function not found" here means the claim_class_invites()
              // RPC hasn't been created in Supabase yet -- see the SQL in
              // supabase-fixes.sql. Not fatal: invited students just won't be
              // auto-added to the class until that function exists.
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
          } catch (e) {  }
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
          try {
            await sb.from(CLASSES_TABLE).update({ data, updated_at: new Date().toISOString() }).eq('id', cls.id);
          } catch (e) { console.warn('Saving class failed (will retry on next change):', e); }
        }
        let myClasses = []; 
        let currentClassId = null;
        let classDetailTab = 'stream'; 
        let classDetailMenuOpen = false;
        let inviteEmailsDraft = '';

        // ---- Join/Create classroom flow ----
        function openJoinClassroom(){
          openOverlay('joinClassroom');
        }

        function openCreateClassroom(){
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
            <div class="w-full px-5 pb-3 relative" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <h1 class="text-base font-bold text-[${NAVY}] font-display absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">Join a Class</h1>
                <button onclick="toggleJoinClassMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('dashes','w-5 h-5')}</button>
              </div>
              ${joinClassMenuOpen ? `<div onclick="toggleJoinClassMenu()" onwheel="toggleJoinClassMenu()" ontouchmove="toggleJoinClassMenu()" class="fixed inset-0 z-10"></div>${joinClassDropdownMenu()}` : ''}
            </div>
            <div class="p-4 flex-1 overflow-y-auto">
              <div class="text-sm font-semibold text-gray-700 mb-3">You're currently signed in as</div>
              <div class="flex items-center gap-3 mb-6">
                <span class="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0 overflow-hidden">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('user','w-6 h-6')}</span>
                <div class="min-w-0">
                  <div class="font-semibold text-sm text-[${NAVY}] truncate">${escapeHtml(profileData.name || 'You')}</div>
                  <div class="text-xs text-gray-500 truncate">${escapeHtml((typeof currentUserEmail !== 'undefined' && currentUserEmail) || '')}</div>
                </div>
              </div>
              <div class="text-sm text-gray-500 mb-5">Ask your teacher or classmate for the class code, then enter it here.</div>
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Class Code</label>
              <input type="text" id="join-code-input" placeholder="e.g. ECN4821" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-2 tracking-widest uppercase">
              <div class="text-xs text-gray-400 mb-5 leading-relaxed">Use a class code with 6-8 letters or numbers, and no spaces or symbols.</div>
              <button onclick="submitJoinClassroom()" class="w-full font-semibold py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">Join Class</button>
            </div>`;
        }

        function createClassroomHTML(){
          return `
            <div class="w-full px-5 pb-3 relative" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <h1 class="text-base font-bold text-[${NAVY}] font-display absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">Create a Class</h1>
                <button onclick="toggleCreateClassMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('dashes','w-5 h-5')}</button>
              </div>
              ${createClassMenuOpen ? `<div onclick="toggleCreateClassMenu()" onwheel="toggleCreateClassMenu()" ontouchmove="toggleCreateClassMenu()" class="fixed inset-0 z-10"></div>${createClassDropdownMenu()}` : ''}
            </div>
            <div class="p-4 flex-1 overflow-y-auto">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Class Name (required)</label>
              <input type="text" id="create-name-input" placeholder="e.g. Macro I - Section B" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Section</label>
              <input type="text" id="create-section-input" placeholder="e.g. Section B" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Subject</label>
              <input type="text" id="create-subject-input" placeholder="e.g. Biology" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-5">
              <button onclick="submitCreateClassroom()" class="w-full font-semibold py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">Create Class</button>
            </div>`;
        }

        let classActionLoadToken = 0;

        // ---- Class action loading/result animation ----
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
              openAppAlertModal("Something went wrong loading that class. Please try again.");
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
          const code = document.getElementById('join-code-input').value.trim().toUpperCase();
          if (!code) { openAppAlertModal('Enter a class code to join'); return; }
          const sb = getSupabaseClient();
          if (!sb) { openAppAlertModal('Sign-in backend is not configured yet -- classes can\'t be joined.'); return; }
          const { data: userRes } = await sb.auth.getUser();
          const me = userRes && userRes.user;
          if (!me) { openAppAlertModal('Please sign in again to join a class.'); return; }
          let row, error;
          try {
            ({ data: row, error } = await sb.rpc('join_class_by_code', { p_code: code }));
          } catch (e) { error = e; }
          if (Array.isArray(row)) row = row[0];
          if (error || !row) { openAppAlertModal("We couldn't find that class. Check the code and try again."); return; }
          const found = classRowToLocal(row, me.id);
          const existingIdx = myClasses.findIndex(c => c.id === found.id);
          if (existingIdx !== -1) myClasses[existingIdx] = found; else myClasses.push(found);
          runClassActionLoading('Adding you to class', 'users', () => {
            openClassDetail(found.id);
          });
        }

        async function submitCreateClassroom(){
          if (!requireCompleteProfile()) return;
          const name = document.getElementById('create-name-input').value.trim();
          const section = document.getElementById('create-section-input').value.trim();
          const subject = document.getElementById('create-subject-input').value.trim();
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
          const classData = { name, section, subject, students: [], coTeachers: [], announcements: [], classwork: [], lectures: [], photo: null, notificationsEnabled: true, colorIndex, motifIndex };
          runClassActionLoading('Creating class', 'plus', async () => {
            const { error } = await sb.from(CLASSES_TABLE).insert({ id, code, teacher_id: me.id, members: [], data: classData });
            if (error) {
              console.error('Create class error:', error);
              closeOverlay();
              openAppAlertModal("Couldn't create the class -- try again.");
              return;
            }
            myClasses.push(Object.assign({}, classData, { id, code, teacherId: me.id, role: 'teacher' }));
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
          return photo ? `<img src="${photo}" class="w-full h-full object-cover">` : Icon('user', sizeClass);
        }

        function openClassDetail(id){
          currentClassId = id;
          classDetailTab = 'stream';
          classDetailMenuOpen = false;
          openOverlay('classDetail');
          const cls = myClasses.find(c => c.id === id);
          if (cls) loadClassTeacherProfile(cls);
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
          classDetailTab = tab;
          document.getElementById('overlay').innerHTML = classDetailHTML();
        }

        function classDetailTabBtn(key, label){
          const active = classDetailTab === key;
          return `<button onclick="classDetailSwitchTab('${key}')" class="flex-1 py-2.5 text-sm font-bold ${active ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${active ? `background:rgba(30,144,255,0.5);` : 'background:#f3f4f6;'}">${label}</button>`;
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
          return `
            <div class="flex-1 flex flex-col overflow-hidden">
              ${classDetailHeaderHTML(cls.name)}
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
                <div class="rounded-3xl p-5 text-white relative overflow-hidden mb-4" style="${cls.photo ? `background-image:linear-gradient(rgba(10,37,64,0.45),rgba(10,37,64,0.45)),url('${cls.photo}');background-size:cover;background-position:center;` : classCardBackgroundStyle(cls)}min-height:104px;">
                  ${cls.photo ? '' : `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${classCardMotifs[classCardIndex(cls) % classCardMotifs.length]}</svg>`}
                  <div class="text-xl font-bold font-display mb-1 truncate pr-4 relative">${escapeHtml(cls.name)}</div>
                  ${cls.section ? `<div class="text-sm text-white/85 mb-3 relative">${cls.section}</div>` : '<div class="mb-3 relative"></div>'}
                  ${cls.code ? `<button onclick="copyClassCode('${cls.code}')" class="items-center gap-2 bg-white/15 rounded-full pl-3 pr-2 py-1.5 text-xs font-semibold relative" style="display:inline-flex;">
                    <span class="tracking-widest">Code: ${cls.code}</span>${Icon('copy','w-3.5 h-3.5')}
                  </button>` : ''}
                </div>
                ${(cls.isCourse && cls.role !== 'teacher') ? `
                <button onclick="confirmCancelCourseEnrollment()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 mb-4 font-semibold text-xs text-red-500 border border-red-100 bg-red-50">
                  ${Icon('trash','w-3.5 h-3.5')} Cancel Enrollment
                </button>` : ''}
                ${cls.role === 'teacher' ? `
                <button onclick="confirmDeleteCurrentClass()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 mb-4 font-semibold text-xs text-red-500 border border-red-100 bg-red-50">
                  ${Icon('trash','w-3.5 h-3.5')} Delete class
                </button>` : ''}
                ${cls.role === 'teacher' ? lectureActionPillsHTML() : ''}
                <div class="flex gap-1 mb-3 bg-gray-100 rounded-2xl p-1">
                  ${showAdminDashboard ? classDetailTabBtn('dashboard','Dashboard') : ''}
                  ${classDetailTabBtn('stream','Stream')}
                  ${classDetailTabBtn('classwork','Classwork')}
                  ${classDetailTabBtn('people','People')}
                </div>
                ${(lectureMinimized && liveLectureState.connected && liveLectureState.classId === cls.id) ? lectureMinimizedBannerHTML() : ''}
                ${classDetailTab === 'dashboard' && showAdminDashboard ? classDashboardTabHTML(cls) : ''}
                ${classDetailTab === 'stream' ? classStreamTabHTML(cls) : ''}
                ${classDetailTab === 'classwork' ? classClassworkTabHTML(cls) : ''}
                ${classDetailTab === 'people' ? classPeopleTabHTML(cls) : ''}
              </div>
            </div>`;
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
            </div>
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Quick actions</div>
            <div class="flex flex-col gap-2.5 mb-5">
              <button onclick="openNewAnnouncementOverlay()" class="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm text-left">
                <span class="w-9 h-9 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon('comment','w-5 h-5')}</span>
                <span class="font-semibold text-sm text-gray-800">New announcement</span>
              </button>
              <button onclick="openClassworkCreateMenu()" class="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm text-left">
                <span class="w-9 h-9 flex items-center justify-center text-amber-600 flex-shrink-0">${Icon('doc','w-5 h-5')}</span>
                <span class="font-semibold text-sm text-gray-800">Create classwork</span>
              </button>
              <button onclick="openInviteStudentsOverlay()" class="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm text-left">
                <span class="w-9 h-9 flex items-center justify-center text-emerald-600 flex-shrink-0">${Icon('personPlus','w-5 h-5')}</span>
                <span class="font-semibold text-sm text-gray-800">Invite students</span>
              </button>
              ${cls.code ? `
              <button onclick="copyClassCode('${cls.code}')" class="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm text-left">
                <span class="w-9 h-9 flex items-center justify-center text-purple-600 flex-shrink-0">${Icon('copy','w-5 h-5')}</span>
                <span class="font-semibold text-sm text-gray-800">Copy class code</span>
              </button>` : ''}
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
                <div class="flex items-center gap-3 mb-2.5">
                  <span class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0 overflow-hidden">${classTeacherAvatarHTML(cls,'w-5 h-5')}</span>
                  <div class="min-w-0">
                    <div class="font-semibold text-sm text-gray-800 truncate">${classTeacherDisplayName(cls)}</div>
                    <div class="text-xs text-gray-400" data-announcement-time="${a.id}">${formatClassStreamTime(a)}</div>
                  </div>
                  <button onclick="toggleAnnouncementRepost('${a.id}')" id="announcement-repost-${a.id}" class="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0 font-semibold text-xs ${a.reposted ? 'text-white' : 'border border-gray-200 text-gray-500'}" style="${a.reposted ? `background:${NAVY};` : ''}">
                    ${Icon('repost','w-3.5 h-3.5')} ${a.reposted ? 'Reposted' : 'Repost'}
                  </button>
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
          return `
            <div class="flex items-center gap-2 overflow-x-auto pb-1 mb-3">
              ${a.attachments.map(f => `
                <a href="${escapeHtml(f.url)}" target="_blank" rel="noopener" class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-3 py-1 flex-shrink-0 text-inherit">
                  <span class="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('doc','w-3.5 h-3.5')}</span>
                  <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(f.name)}</span>
                </a>`).join('')}
            </div>`;
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
                      <span class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0 overflow-hidden">${(c.name === 'You' && profileData.photo) ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('user','w-3.5 h-3.5')}</span>
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

        function toggleAnnouncementRepost(announcementId){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const a = (cls.announcements || []).find(x => x.id === announcementId);
          if (!a) return;
          if (a.reposted) {
            PostsAPI.remove(a.repostFeedId);
            a.reposted = false;
            a.repostFeedId = null;
            document.getElementById('overlay').innerHTML = classDetailHTML();
            renderFeed();
          } else {
            const post = PostsAPI.create({
              avatarIcon:'bell', avatarBg:'bg-blue-50', name:classTeacherDisplayName(cls),
              meta: cls.name + ' · Announcement', tag:'Announcement', tagClass:`bg-blue-50 text-[${NAVY}]`,
              timeAgo:'Just now',
              body: a.text, mediaHtml:null,
              reposts:1, reposted:true
            });
            a.reposted = true;
            post.then(p => { a.repostFeedId = p.id; });
            document.getElementById('overlay').innerHTML = classDetailHTML();
            renderFeed();
          }
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
          const lectures = cls.lectures || [];
          if (!lectures.length) return '';
          const isTeacher = cls.role === 'teacher';
          const sorted = [...lectures].sort((a,b) => (b.status === 'live') - (a.status === 'live') || (a.date+a.time).localeCompare(b.date+b.time));
          return `
            <div class="mb-5">
              ${sorted.map(l => lectureCardHTML(l, isTeacher)).join('')}
            </div>`;
        }

        function lectureCardHTML(l, isTeacher){
          const isLive = l.status === 'live';
          return `
            <div class="rounded-3xl p-4 mb-3 shadow-sm ${isLive ? 'text-white' : 'bg-white'}" style="${isLive ? 'background:linear-gradient(135deg,#2563eb,#1d4ed8);' : ''}">
              <div class="flex items-center gap-3">
                <span class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${isLive ? 'bg-white/15 text-white' : 'bg-blue-50 text-[' + NAVY + ']'}">${Icon('video','w-5 h-5')}</span>
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-sm truncate">${escapeHtml(l.title)}</div>
                  <div class="text-xs ${isLive ? 'text-white/80' : 'text-gray-400'}">${isLive ? 'Live now' : formatReminderDate(l.date) + ' · ' + formatTime12(l.time)}</div>
                </div>
                ${isLive
                  ? `<div class="flex items-center gap-2 flex-shrink-0">
                      <button onclick="shareLectureLink('${currentClassId}','${l.id}')" title="Share lecture link" class="w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center flex-shrink-0">${Icon('link','w-4 h-4')}</button>
                      <button onclick="joinLiveLecture('${l.id}')" class="text-xs font-bold px-3 py-2 rounded-full bg-white text-[${NAVY}] flex-shrink-0">Join</button>
                    </div>`
                  : (isTeacher ? `<button onclick="startScheduledLectureNow('${l.id}')" class="text-xs font-bold px-3 py-2 rounded-full text-white flex-shrink-0" style="background:${NAVY};">Start now</button>` : '')}
              </div>
              ${!isLive && isTeacher ? `<button onclick="cancelScheduledLecture('${l.id}')" class="text-xs font-semibold text-red-500 mt-2">Cancel</button>` : ''}
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

        let liveLectureState = { classId: null, lectureId: null, connected: false, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid' };

        let guestLectureMode = false;
        let pendingGuestLectureJoin = null;
        let lectureTickInterval = null;
        let lectureLocalStream = null; 
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

        function startScheduledLectureNow(id){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const l = (cls.lectures || []).find(x => x.id === id);
          if (!l) return;
          l.status = 'live';
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

        function acceptIncomingLectureCall(){
          if (!incomingLectureCallInfo) return;
          clearTimeout(incomingLectureCallRingTimeout); incomingLectureCallRingTimeout = null;
          const { classId, lecture } = incomingLectureCallInfo;
          incomingLectureCallInfo = null;
          const cls = myClasses.find(c => c.id === classId);
          if (!cls) { closeOverlay(); openAppAlertModal("Couldn't join that class -- try reopening the app."); return; }
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
          return `
            <div class="flex-1 flex flex-col bg-white text-gray-900" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between px-5 flex-shrink-0">
                <button onclick="declineIncomingLectureCall()" title="Back" class="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-700">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 min-w-0 text-center px-2">
                  <div class="text-sm font-semibold text-gray-500 tracking-wide uppercase font-display">Incoming Lecture</div>
                </div>
                <div class="w-11 h-11 flex-shrink-0"></div>
              </div>
              <div style="flex:0 0 20%;"></div>
              <div class="flex flex-col items-center px-6 text-center">
                <div class="rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mb-4 shadow-lg" style="width:9rem;height:9rem;">${info.callerPhoto ? `<img src="${escapeHtml(info.callerPhoto)}" class="w-full h-full object-cover">` : Icon('video','w-14 h-14 text-gray-400')}</div>
                <div class="text-2xl font-bold font-display mb-1">${escapeHtml(info.className || 'Class Lecture')}</div>
                <div class="text-base text-gray-500">${escapeHtml(info.callerName || 'Your teacher')} started "${escapeHtml(lecture.title || 'Live Lecture')}"</div>
              </div>
              <div style="flex:1;"></div>
              <div class="flex-shrink-0 flex items-center justify-center" style="gap:64px;padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 32px);">
                <button onclick="declineIncomingLectureCall()" title="Decline" class="flex flex-col items-center gap-2">
                  <div class="call-decline-icon-btn rounded-full flex items-center justify-center" style="width:56px;height:56px;">${Icon('phoneHangup','w-6 h-6 text-white')}</div>
                  <div class="text-xs text-gray-600">Decline</div>
                </button>
                <button onclick="acceptIncomingLectureCall()" title="Join lecture" class="flex flex-col items-center gap-2">
                  <div class="call-accept-icon-btn rounded-full flex items-center justify-center" style="width:56px;height:56px;">${Icon('video','w-6 h-6 text-white')}</div>
                  <div class="text-xs text-gray-600">Join</div>
                </button>
              </div>
            </div>`;
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
          if (whiteboardAttachment && whiteboardAttachment.url) URL.revokeObjectURL(whiteboardAttachment.url);
          lectureAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          whiteboardStrokes = [];
          whiteboardAttachment = null;
          lectureSlides = null;
          lecturePreview = null;
          lectureMoreSheetOpen = false;
          lectureReactionsSheetOpen = false;
          lectureCommentSheetOpen = false;
          lectureResourcesPanelOpen = false;
          lectureFloatingReactions = [];
          lectureFloatingComments = [];
          lectureAttachments = [];
          pendingAutoOpenAttachmentId = null;
          liveLectureState = { classId, lectureId, connected: true, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid', mediaError: null };
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
            const bannerTimerEl = document.getElementById('lecture-minimized-timer');
            if (bannerTimerEl) bannerTimerEl.textContent = formatCallTime(liveLectureState.seconds);
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

        function cancelScheduledLecture(id){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          cls.lectures = (cls.lectures || []).filter(l => l.id !== id);
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

        function updateLectureControlBarButtons(){
          const inactiveControlClass = 'bg-white text-gray-600 shadow-sm';
          const activeControlClass = 'bg-blue-600 text-white';
          const camBtn = document.getElementById('lecture-cam-btn');
          if (camBtn) {
            camBtn.className = `w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.camOff ? activeControlClass : inactiveControlClass}`;
            camBtn.title = liveLectureState.camOff ? 'Turn camera on' : 'Turn camera off';
            camBtn.innerHTML = Icon(liveLectureState.camOff ? 'cameraOff' : 'video','w-5 h-5');
          }
          const muteBtn = document.getElementById('lecture-mute-btn');
          if (muteBtn) {
            muteBtn.className = `w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.muted ? activeControlClass : inactiveControlClass}`;
            muteBtn.title = liveLectureState.muted ? 'Unmute' : 'Mute';
            muteBtn.innerHTML = Icon(liveLectureState.muted ? 'micOff' : 'mic','w-5 h-5');
          }
          const handBtn = document.getElementById('lecture-hand-btn');
          if (handBtn) {
            handBtn.className = `w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.handRaised ? 'text-white' : inactiveControlClass}`;
            handBtn.style.background = liveLectureState.handRaised ? NAVY : '';
          }
          const moreBtn = document.getElementById('lecture-more-btn');
          if (moreBtn) moreBtn.className = `w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${lectureMoreSheetOpen ? activeControlClass : inactiveControlClass}`;
        }

        function updateLectureSheetsRegion(){
          const el = document.getElementById('lecture-sheets-region');
          if (el) el.innerHTML = lectureSheetsRegionHTML(liveLectureState.view);
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
            <span class="lecture-reaction-float flex items-center gap-1.5 bg-white shadow-md rounded-full" style="padding:10px;">
              <span class="${r.big ? 'w-10 h-10' : 'w-8 h-8'} rounded-full flex items-center justify-center flex-shrink-0" style="${r.icon === 'handRaised' ? `background:${NAVY}1a;color:${NAVY};` : 'background:#f9fafb;color:#374151;'}">${Icon(r.icon, r.big ? 'w-5 h-5' : 'w-4 h-4')}</span>
              <span class="text-xs font-semibold text-gray-700 truncate max-w-[130px]">${escapeHtml(r.name || '')}${r.icon === 'handRaised' ? ' raised a hand' : ''}</span>
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
            <span class="lecture-reaction-float flex items-start gap-1.5 bg-white shadow-md rounded-2xl" style="max-width:220px;padding:10px;">
              <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style="background:${NAVY};">${escapeHtml((c.name || '?').slice(0,1).toUpperCase())}</span>
              <span class="min-w-0">
                <span class="block text-[11px] font-bold text-gray-900 truncate">${escapeHtml(c.name || '')}</span>
                <span class="block text-xs text-gray-700 break-words">${escapeHtml(c.text || '')}</span>
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
            if (v && lectureLocalStream) v.srcObject = lectureLocalStream;
            Object.keys(lecturePresence).forEach(attachLectureRemoteVideo);
          } else if (liveLectureState.view === 'whiteboard') {
            initWhiteboardCanvas();
          } else if (liveLectureState.view === 'slides' && lectureSlides && lectureSlides.type === 'pdf') {
            renderPdfSlidePage();
          }
          if (lecturePreview && lecturePreview.kind === 'pdf' && lecturePreview.status === 'ready') renderPreviewPdfPage();
        }

        let lectureMinimized = false;

        // Tapping "Back" during a live lecture used to call endLecture()
        // outright -- one accidental tap on the way to checking chat or
        // another tab would hang up (or, for a student, leave) the whole
        // class. Instead, it minimizes back to that class's own detail
        // screen (Stream/Classwork/People) with a persistent "Lecture in
        // progress" pill pinned just below the tab row -- see
        // lectureMinimizedBannerHTML below -- rather than floating over
        // the rest of the app. Stream and peer connections keep running
        // the whole time. The lecture only actually ends when the red
        // control-bar button is tapped.
        function minimizeLecture(){
          if (!liveLectureState.connected) { closeOverlay(); return; }
          lectureMinimized = true;
          if (guestLectureMode) { closeOverlay(); return; }
          currentClassId = liveLectureState.classId;
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        function resumeLecture(){
          if (!liveLectureState.connected) return;
          lectureMinimized = false;
          openOverlay('lectureCall');
          attachLectureMedia();
        }

        // Rendered inline inside classDetailHTML(), directly below the
        // Stream/Classwork/People tabs, whenever the lecture for *this*
        // class is connected but minimized. Deliberately not a
        // fixed/floating banner -- it only shows up in the one place it's
        // relevant (that class's own detail screen) and stays there,
        // scrolling with the page, until the lecture ends.
        function lectureMinimizedBannerHTML(){
          return `
            <div onclick="resumeLecture()" class="flex items-center gap-2 rounded-full shadow-lg py-2 select-none cursor-pointer mb-5" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 10px 26px rgba(65,105,225,0.35);border:1px solid rgba(255,255,255,0.22);color:#fff;padding-left:10px;padding-right:10px;">
              <span class="text-sm font-semibold flex-1 truncate">Lecture in progress</span>
              <span id="lecture-minimized-timer" class="text-xs font-semibold text-white/80 flex-shrink-0">${formatCallTime(liveLectureState.seconds)}</span>
              <button onclick="event.stopPropagation();endLecture()" title="End lecture" class="call-end-icon-btn w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                ${Icon('phoneHangup','w-3.5 h-3.5')}
              </button>
            </div>`;
        }

        function endLecture(remoteEnded){
          lectureMinimized = false;
          clearLectureTimer();
          stopLectureLocalStream();
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          const isTeacher = cls && cls.role === 'teacher';
          if (isTeacher && !remoteEnded) broadcastLectureSignal({ type: 'end' });
          teardownLectureSignaling();
          inLectureCall = false;
          if (cls && isTeacher) {
            cls.lectures = (cls.lectures || []).filter(l => l.id !== liveLectureState.lectureId);
            queueSaveClassRemote(cls);
          }
          const wasGuest = guestLectureMode;
          guestLectureMode = false;
          liveLectureState = { classId: null, lectureId: null, connected: false, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid' };
          lectureSlides = null;
          if (whiteboardAttachment && whiteboardAttachment.url) URL.revokeObjectURL(whiteboardAttachment.url);
          lectureAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          whiteboardStrokes = [];
          whiteboardAttachment = null;
          lecturePreview = null;
          lectureMoreSheetOpen = false;
          lectureReactionsSheetOpen = false;
          lectureCommentSheetOpen = false;
          lectureResourcesPanelOpen = false;
          lectureFloatingReactions = [];
          lectureFloatingComments = [];
          lectureAttachments = [];
          pendingAutoOpenAttachmentId = null;
          if (wasGuest) { closeOverlay(); return; }
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        const LECTURE_TILE_COLORS = ['bg-orange-500','bg-purple-500','bg-teal-500','bg-blue-500','bg-rose-500','bg-emerald-500','bg-indigo-500','bg-amber-500','bg-cyan-500','bg-pink-500'];

        // ---- Lecture video tile rendering (local/remote participants) ----
        function lectureLocalMediaHTML(){
          const showLocalVideo = lectureLocalStream && !liveLectureState.camOff && !liveLectureState.mediaError;
          if (showLocalVideo) return `<video id="lecture-local-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform:scaleX(-1);"></video>`;
          return `<div class="w-full h-full flex items-center justify-center bg-gray-700 overflow-hidden">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('user','w-10 h-10 text-white/70')}</div>`;
        }

        function lectureLocalBadgesHTML(){
          return `
            ${liveLectureState.muted ? `<div class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">${Icon('micOff','w-3.5 h-3.5')}</div>` : ''}
            ${liveLectureState.camOff ? `<div class="absolute top-1.5 ${liveLectureState.muted ? 'right-8' : 'right-1.5'} w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">${Icon('cameraOff','w-3.5 h-3.5')}</div>` : ''}
            ${liveLectureState.handRaised ? `<div class="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">${Icon('handRaised','w-3.5 h-3.5')}</div>` : ''}`;
        }

        function lectureTileWrapperHTML(videoInner, badgesInner, caption, tileId, bgClass){
          return `
            <div class="flex flex-col min-w-0">
              <div class="relative rounded-2xl overflow-hidden ${bgClass || 'bg-gray-800'}" style="aspect-ratio:4/3;" ${tileId ? `id="${tileId}"` : ''}>
                ${videoInner}
                ${badgesInner || ''}
              </div>
              <div class="mt-1 text-xs font-semibold text-gray-700 truncate text-center">${caption}</div>
            </div>`;
        }

        function lectureRemoteBadgesHTML(p){
          return `
            ${p.muted ? `<div class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white">${Icon('micOff','w-3.5 h-3.5')}</div>` : ''}
            ${p.handRaised ? `<div class="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white">${Icon('handRaised','w-3.5 h-3.5')}</div>` : ''}`;
        }

        function updateLectureRemoteBadges(){
          Object.keys(lecturePresence).forEach(peerId => {
            const el = document.getElementById('lecture-remote-badges-' + peerId);
            if (el) el.innerHTML = lectureRemoteBadgesHTML(lecturePresence[peerId]);
          });
        }

        function lectureGridHTML(){
          const isDesktopLecture = window.innerWidth >= 1024;
          const iAmTeacher = lectureIsTeacher();
          const localTile = lectureTileWrapperHTML(
            `<div id="lecture-local-media" class="w-full h-full">${lectureLocalMediaHTML()}</div>`,
            `<div id="lecture-local-badges">${lectureLocalBadgesHTML()}</div>`,
            iAmTeacher ? 'You · Host' : 'You',
            'lecture-local-tile'
          );
          const peerIds = Object.keys(lecturePresence);
          const sortedPeerIds = peerIds.slice().sort((a, b) => {
            const ta = lecturePresence[a].isTeacher ? 1 : 0;
            const tb = lecturePresence[b].isTeacher ? 1 : 0;
            return tb - ta;
          });
          const otherTiles = sortedPeerIds.map((peerId, i) => {
            const p = lecturePresence[peerId];
            const stream = lectureRemoteStreams[peerId];
            const showVideo = !p.camOff && stream && stream.getVideoTracks().some(t => t.enabled);
            const videoInner = `
              <video id="lecture-remote-video-${peerId}" autoplay playsinline class="w-full h-full object-cover ${showVideo ? '' : 'hidden'}"></video>
              ${!showVideo ? `<div class="w-full h-full flex items-center justify-center"><span class="text-white font-bold text-2xl">${escapeHtml((p.name || '?').trim().charAt(0).toUpperCase())}</span></div>` : ''}`;
            const badgesInner = `<div id="lecture-remote-badges-${peerId}">${lectureRemoteBadgesHTML(p)}</div>`;
            const caption = `${escapeHtml(p.name)}${p.isTeacher ? ' · Host' : ''}`;
            return lectureTileWrapperHTML(videoInner, badgesInner, caption, null, showVideo ? 'bg-gray-800' : LECTURE_TILE_COLORS[i % LECTURE_TILE_COLORS.length]);
          }).join('');
          const orderedTiles = iAmTeacher ? (localTile + otherTiles) : (otherTiles + localTile);
          const gridClass = isDesktopLecture
            ? 'grid gap-3 p-4 overflow-y-auto flex-1 content-start justify-center'
            : 'grid grid-cols-2 gap-2.5 p-3 overflow-y-auto flex-1 content-start';
          const gridStyle = isDesktopLecture ? 'grid-template-columns:repeat(auto-fill,minmax(150px,190px));' : '';
          return `
            ${liveLectureState.mediaError ? `<div class="mx-4 mt-2 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold flex-shrink-0">${escapeHtml(liveLectureState.mediaError)}</div>` : ''}
            <div class="${gridClass}" style="${gridStyle}">${orderedTiles}</div>
            ${!peerIds.length ? `<div class="text-center text-xs text-gray-400 pb-2 flex-shrink-0">No one else has joined this lecture yet: invite them from the People tab.</div>` : ''}`;
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
            lectureLocalStream.getTracks().forEach(t => pc.addTrack(t, lectureLocalStream));
          }
          pc.onicecandidate = (e) => {
            if (e.candidate) broadcastLectureSignal({ type: 'rtc-ice', to: peerId, candidate: e.candidate });
          };
          pc.ontrack = (e) => {
            lectureRemoteStreams[peerId] = e.streams[0];
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
          return { pen: 'penTool', square: 'square', circle: 'circle', line: 'lineTool', text: 'textT', eraser: 'eraser' }[t] || 'penTool';
        }

        const WB_TOOL_LABELS = { pen: 'Pen (freehand)', square: 'Square', circle: 'Circle', line: 'Line', text: 'Text', eraser: 'Eraser' };

        function lectureWhiteboardHTML(){
          const isTeacher = lectureIsTeacher();
          return `
            <div class="flex-1 flex flex-col bg-white min-h-0">
              ${isTeacher ? `
              <div class="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 overflow-x-auto flex-shrink-0">
                ${['pen','square','circle','line','text','eraser'].map(t => `
                  <button onclick="wbSetTool('${t}')" title="${WB_TOOL_LABELS[t]}" class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="${whiteboardTool === t ? `background:${NAVY};color:#ffffff;box-shadow:0 0 0 2px ${NAVY}55;` : 'background:#f3f4f6;color:#4b5563;'}">${Icon(wbToolIcon(t),'w-4 h-4')}</button>`).join('')}
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
                  <button onclick="lectureSlideNav(-1)" title="Previous" class="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">${IconBold('back','w-4 h-4')}</button>
                  <div class="text-sm font-semibold text-white">Slide ${lectureSlides.current} / ${lectureSlides.total}</div>
                  <button onclick="lectureSlideNav(1)" title="Next" class="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">${Icon('arrowRight','w-4 h-4')}</button>
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
                <button onclick="lectureSlideNav(-1)" title="Previous" class="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">${IconBold('back','w-4 h-4')}</button>
                <div class="text-sm font-semibold text-white">Slide ${lectureSlides.current + 1} / ${lectureSlides.slides.length}</div>
                <button onclick="lectureSlideNav(1)" title="Next" class="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">${Icon('arrowRight','w-4 h-4')}</button>
              </div>
            </div>`;
        }

        // ---- Lecture bottom sheets (reactions/comments/more) ----
        function lectureSheetsRegionHTML(view){
          return `
            ${(lectureReactionsSheetOpen || lectureMoreSheetOpen || lectureCommentSheetOpen) ? `<div onclick="closeLectureSheets()" class="absolute inset-0 z-20" style="background:rgba(10,15,25,0.25);"></div>` : ''}
            ${lectureReactionsSheetOpen ? lectureReactionsSheetHTML() : ''}
            ${lectureCommentSheetOpen ? lectureCommentSheetHTML() : ''}
            ${lectureMoreSheetOpen ? lectureMoreSheetHTML(view) : ''}`;
        }

        function lectureCallHTML(){
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          const isTeacher = cls && cls.role === 'teacher';
          const view = liveLectureState.view;
          const isWhiteboard = view === 'whiteboard';
          const headerLabel = view === 'whiteboard' ? 'Whiteboard' : (view === 'slides' ? (lectureSlides ? lectureSlides.fileName : 'Present') : (cls ? cls.name : 'Lecture'));
          const stageHTML = view === 'whiteboard' ? lectureWhiteboardHTML() : (view === 'slides' ? lectureSlidesHTML() : lectureGridHTML());
          const controlBarBg = 'rgba(10,37,64,0.035)';
          const inactiveControlClass = 'bg-white text-gray-600 shadow-sm';
          const activeControlClass = 'bg-blue-600 text-white';
          const resourceCount = lectureAttachments.length + (whiteboardAttachment ? 1 : 0);
          const isDesktopLecture = window.innerWidth >= 1024;
          return `
            <div id="lecture-call-screen" class="flex-1 flex flex-col text-gray-800" style="padding-top:var(--top-safe-pad);background:#ffffff;">
              <input type="file" id="lecture-slide-input" accept=".pdf,.pptx" class="hidden" onchange="handleLectureSlideFile(event)">
              <input type="file" id="lecture-doc-input" accept=".pdf" class="hidden" onchange="handleLectureDocAttach(event)">
              <input type="file" id="lecture-media-input" accept="image/*,video/*" class="hidden" onchange="handleLectureMediaAttach(event)">
              <div class="flex items-center px-3 flex-shrink-0 mb-2 relative">
                <button onclick="${(isWhiteboard && isTeacher) ? 'toggleLectureWhiteboard()' : 'minimizeLecture()'}" title="Back" class="absolute left-3 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white text-gray-700 shadow-sm border border-gray-200">${Icon('back','w-4 h-4')}</button>
                <div class="flex-1 min-w-0 text-center px-2">
                  <div class="text-lg font-bold font-display truncate text-gray-800">${escapeHtml(headerLabel)}</div>
                  <div class="text-sm text-gray-500"><span id="lecture-call-timer">${formatCallTime(liveLectureState.seconds)}</span> · Live</div>
                </div>
                <div class="absolute right-3 flex items-center gap-2 flex-shrink-0">
                  ${!isDesktopLecture ? `
                  <button onclick="toggleLectureResourcesPanel()" title="Class Pad" class="relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white text-gray-700 shadow-sm border border-gray-200">
                    ${Icon('doc','w-4 h-4')}
                    ${resourceCount ? `<span class="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">${resourceCount}</span>` : ''}
                  </button>` : ''}
                </div>
              </div>
              <div class="flex-1 flex flex-col min-h-0 relative">
                <div id="lecture-stage-content" class="flex-1 flex flex-col min-h-0 w-full">${stageHTML}</div>
                <div id="lecture-reactions-float" class="absolute flex flex-col items-end gap-1 z-10" style="bottom:10px;right:10px;pointer-events:none;">${lectureReactionsFloatHTML()}</div>
                <div id="lecture-comments-float" class="absolute flex flex-col items-start gap-1 z-10" style="bottom:10px;left:10px;pointer-events:none;max-width:220px;">${lectureCommentsFloatHTML()}</div>
                <div id="lecture-preview-region" class="absolute inset-0 z-20" style="${lecturePreview ? '' : 'pointer-events:none;'}">${lecturePreview ? lecturePreviewHTML() : ''}</div>
                <div id="lecture-resources-panel-region" class="absolute inset-0" style="overflow:hidden;pointer-events:none;${isDesktopLecture ? 'display:none;' : ''}">${isDesktopLecture ? '' : lectureResourcesPanelHTML(resourceCount)}</div>
              </div>
              ${!isWhiteboard ? `
              <div class="flex-shrink-0 pt-3 flex justify-center relative" style="padding-bottom:15px;">
                <div class="flex items-center gap-3 rounded-full py-2.5 px-3 shadow-sm overflow-x-auto" style="background:${controlBarBg};">
                  <button onclick="toggleLectureControl('camOff')" id="lecture-cam-btn" title="${liveLectureState.camOff ? 'Turn camera on' : 'Turn camera off'}" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.camOff ? activeControlClass : inactiveControlClass}">${Icon(liveLectureState.camOff ? 'cameraOff' : 'video','w-5 h-5')}</button>
                  <button onclick="toggleLectureControl('muted')" id="lecture-mute-btn" title="${liveLectureState.muted ? 'Unmute' : 'Mute'}" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.muted ? activeControlClass : inactiveControlClass}">${Icon(liveLectureState.muted ? 'micOff' : 'mic','w-5 h-5')}</button>
                  <button onclick="toggleLectureHand()" id="lecture-hand-btn" title="Raise hand" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.handRaised ? 'text-white' : inactiveControlClass}" style="${liveLectureState.handRaised ? 'background:' + NAVY + ';' : ''}">${Icon('handRaised','w-5 h-5')}</button>
                  <button onclick="toggleLectureMoreSheet()" id="lecture-more-btn" title="More" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${lectureMoreSheetOpen ? activeControlClass : inactiveControlClass}"><span style="display:inline-flex;transform:rotate(90deg);">${Icon('dots','w-5 h-5')}</span></button>
                  <button onclick="endLecture()" title="${isTeacher ? 'End lecture' : 'Leave'}" class="w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">${Icon('phoneHangup','w-5 h-5')}</button>
                </div>
              </div>` : ''}
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
            <div class="absolute z-30 flex items-center gap-2 rounded-full shadow-lg bg-white overflow-x-auto" style="bottom:94px;left:10px;right:10px;width:fit-content;max-width:calc(100% - 20px);margin:0 auto;padding:10px;">
              ${reactionIcons.map(r => `
                <button onclick="sendLectureReaction('${r.icon}')" title="${escapeHtml(r.label)}" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100" style="color:${r.color};">${Icon(r.icon,'w-5 h-5')}</button>`).join('')}
            </div>`;
        }

        function lectureCommentSheetHTML(){
          return `
            <div class="absolute z-30 flex items-center gap-2 rounded-full shadow-lg bg-white" style="bottom:94px;left:10px;right:10px;max-width:380px;margin:0 auto;padding:10px;">
              <input id="lecture-comment-input" type="text" placeholder="Type a comment..." maxlength="200" class="flex-1 min-w-0 text-sm outline-none bg-transparent" onkeydown="if(event.key==='Enter'){event.preventDefault();sendLectureComment();}">
              <button onclick="sendLectureComment()" title="Send" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
            </div>`;
        }

        function lectureMoreSheetHTML(view){
          const grid = (onclick, icon, label, active) => `
            <button onclick="${onclick}" class="flex-1 min-w-0 flex flex-col items-center justify-center gap-1.5 py-1">
              <span class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="${active ? 'background:' + NAVY + ';' : 'background:#f9fafb;'}">
                ${Icon(icon, `w-5 h-5 ${active ? 'text-white' : 'text-gray-500'}`)}
              </span>
              <span class="text-[10px] font-bold ${active ? '' : 'text-gray-900'} truncate" style="${active ? 'color:' + NAVY + ';' : ''}">${label}</span>
            </button>`;
          const isTeacher = lectureIsTeacher();
          return `
            <div class="absolute left-1/2 z-30 bg-white rounded-3xl shadow-lg p-4" style="bottom:94px;transform:translateX(-50%);width:min(calc(100vw - 60px),380px);">
              ${isTeacher ? `
              <button onclick="toggleLectureWhiteboard()" class="w-full flex items-center justify-center gap-2.5 rounded-2xl mb-4 border" style="padding:8px 0.5px;${view === 'whiteboard' ? `background:${NAVY};border-color:${NAVY};` : `color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;`}">
                <span class="${view === 'whiteboard' ? 'text-white' : ''}" style="${view === 'whiteboard' ? '' : `color:${NAVY};`}">${Icon('edit','w-5 h-5')}</span>
                <span class="text-base font-bold ${view === 'whiteboard' ? 'text-white' : ''}" style="${view === 'whiteboard' ? '' : `color:${NAVY};`}">Whiteboard</span>
                ${view === 'whiteboard' ? `<span class="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">${Icon('check','w-3 h-3 text-white')}</span>` : ''}
              </button>` : ''}
              <div class="flex items-start justify-between gap-1">
                ${grid("toggleLectureReactionsSheet()", 'heartOutline', 'Reactions', false)}
                ${grid("lectureAttachDocuments()", 'doc', 'PDF', false)}
                ${grid("toggleLectureCommentSheet()", 'textT', 'Comment', lectureCommentSheetOpen)}
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

        function scheduleLectureHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          return `
            ${overlayHeader('Schedule Lecture', '20px')}
            <div class="p-5 flex-1 overflow-y-auto no-scrollbar">
              <div class="text-sm text-gray-500 mb-5">Set up an upcoming lecture for ${cls ? cls.name : 'your class'}; students will see it in the Stream and can join when it's live.</div>
              <label class="text-xs font-semibold text-gray-500 mb-1 block">Lecture title</label>
              <input type="text" id="lecture-title-input" placeholder="e.g. Chapter 4: Market Structures" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
              <div class="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
                  <input type="date" id="lecture-date-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Time</label>
                  <input type="time" id="lecture-time-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                </div>
              </div>
              <button onclick="submitScheduleLecture()" class="w-full font-semibold py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Schedule Lecture</button>
            </div>`;
        }

        function submitScheduleLecture(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const title = document.getElementById('lecture-title-input').value.trim();
          const date = document.getElementById('lecture-date-input').value;
          const time = document.getElementById('lecture-time-input').value;
          if (!title || !date || !time) { openAppAlertModal('Please fill in the title, date, and time.'); return; }
          if (!cls.lectures) cls.lectures = [];
          cls.lectures.push({ id: 'lec-' + Date.now(), title, date, time, status: 'scheduled' });
          queueSaveClassRemote(cls);
          ensureNotificationPermission();
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        // ---- Classroom notifications tab ----
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
          return `
            ${overlayHeader('Notifications', '20px')}
            <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3" style="margin-top:10px;">${escapeHtml(cls.name)}</div>
              ${items.length ? items.map(n => `
                <div class="bg-white rounded-3xl p-4 mb-3 shadow-sm flex items-start gap-3">
                  <span class="w-10 h-10 rounded-full ${n.iconBg} ${n.iconClass} flex items-center justify-center flex-shrink-0">${Icon(n.icon,'w-5 h-5')}</span>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm text-gray-800">${escapeHtml(n.title)}</div>
                    <div class="text-sm text-gray-500 truncate">${escapeHtml(n.body)}</div>
                  </div>
                </div>`).join('') : `
                <div class="flex flex-col items-center text-center py-16">
                  <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('bell','w-9 h-9')}</div>
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
              return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${n ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${n} submitted</span>`;
            }
            const mine = myClassworkQuizSubmission(w);
            return mine
              ? `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-green-100 text-green-700">Score: ${mine.autoScore}/${mine.total}</span>`
              : `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not attempted</span>`;
          }
          if (w.type === 'material') return '';
          if (w.type === 'poll') {
            return w.myVote !== null
              ? `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-sky-100 text-sky-700">Voted</span>`
              : `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not voted</span>`;
          }
          if (isTeacher) {
            const n = Object.keys(classworkSubmissionsMap(w)).length;
            return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${n ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}">${n} submitted</span>`;
          }
          const mine = myClassworkSubmission(w);
          if (mine && mine.graded) return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-green-100 text-green-700">Graded: ${mine.score}${w.points ? '/' + w.points : ''}</span>`;
          if (mine) return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-sky-100 text-sky-700">Turned in</span>`;
          return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not submitted</span>`;
        }

        function classClassworkTabHTML(cls){
          const isTeacher = cls.role === 'teacher';
          const materials = cls.classwork.filter(w => w.type === 'material');
          const work = cls.classwork.filter(w => w.type !== 'material');
          const row = w => {
            const idx = cls.classwork.findIndex(x => x.id === w.id);
            const motif = classCardMotifs[blueCardMotifIndex(w, idx === -1 ? 0 : idx) % classCardMotifs.length];
            return `
            <div onclick="openClassworkDetail('${w.id}')" class="rounded-3xl p-4 mb-3 text-white relative overflow-hidden shadow-sm cursor-pointer" style="${blueCardBackgroundStyle(w, idx === -1 ? 0 : idx)}">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${motif}</svg>
              <div class="flex items-start gap-3 relative">
                <span class="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">${Icon(classworkTypeIcon(w.type),'w-5 h-5')}</span>
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-sm truncate">${escapeHtml(w.title)}</div>
                  ${w.instructions ? `<div class="text-xs text-white/70 mt-0.5 line-clamp-2">${w.instructions}</div>` : ''}
                  <div class="text-xs text-white/70 mt-1.5 flex items-center gap-2 flex-wrap">
                    <span>${w.type === 'quiz' ? (w.questions.length + ' questions') : w.type === 'poll' ? (w.options.length + ' options') : (w.points ? w.points + ' points' : 'Unscored')}${w.due ? ' · Due ' + w.due : ''}</span>
                    ${classworkStatusBadge(w, isTeacher)}
                  </div>
                </div>
                <div class="text-white/50 flex-shrink-0">›</div>
              </div>
            </div>`;
          };
          return `
            ${isTeacher ? `
            <div class="flex justify-end mb-4">
              <button onclick="openClassworkCreateMenu()" class="flex items-center gap-2 rounded-full py-2.5 px-4 font-semibold text-sm text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${Icon('plus','w-4 h-4')} Create</button>
            </div>` : ''}

            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Course Materials</div>
            ${materials.length ? materials.map(row).join('') : `
              <div class="bg-white rounded-3xl p-5 mb-5 shadow-sm text-center text-sm text-gray-400">
                ${isTeacher ? 'Share slides, notes, or readings with your class.' : "Your teacher hasn't uploaded any course materials yet."}
              </div>`}

            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 mt-2">Assignments &amp; Quizzes</div>
            ${work.length ? work.map(row).join('') : `
              <div class="flex flex-col items-center text-center py-10">
                <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('doc','w-9 h-9')}</div>
                <div class="font-bold text-gray-700 mb-1">${isTeacher ? 'Assign work to your class' : 'No assignments yet'}</div>
                <div class="text-sm text-gray-400 leading-relaxed">${isTeacher ? 'Post assignments and quizzes here; they can be turned in, scored, and remarked right here in Classwork' : 'Assignments and quizzes from your teacher will show up here.'}</div>
              </div>`}`;
        }

        function openClassworkCreateMenu(){
          openOverlay('classworkCreateMenu');
        }

        function classworkCreateMenuOptionRow(icon, label, sub, onclick){
          return `
            <button onclick="${onclick}" class="w-full flex items-center gap-4 py-3.5 text-left">
              <span class="w-11 h-11 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(icon,'w-5 h-5')}</span>
              <div class="min-w-0">
                <div class="font-semibold text-sm text-gray-800">${label}</div>
                <div class="text-xs text-gray-400">${sub}</div>
              </div>
            </button>`;
        }

        function classworkCreateMenuHTML(){
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4 text-[${NAVY}]">
                <button onclick="classDetailTab='classwork'; openOverlay('classDetail')">${IconBold('back','w-5 h-5')}</button>
                <div class="font-semibold text-lg font-display">Create</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 divide-y divide-gray-100" style="padding-top:10px;">
              ${classworkCreateMenuOptionRow('doc','Assignment','Students turn in work, you score & remark it', "openNewAssignmentOverlay()")}
              ${classworkCreateMenuOptionRow('edit','Quiz','Auto-graded questions, remark after submission', "openNewQuizOverlay()")}
              ${classworkCreateMenuOptionRow('help','Question','Post a question for the class to answer', "openNewQuestionOverlay()")}
              ${classworkCreateMenuOptionRow('chart','Poll','Quick multiple-choice vote for the class', "openNewPollOverlay()")}
              ${classworkCreateMenuOptionRow('file','Material','Share a resource, no submission needed', "openNewMaterialOverlay()")}
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

        function handleAnnouncementAttachFile(event){
          const files = Array.from(event.target.files || []);
          files.forEach(file => {
            const id = 'aa' + Date.now() + Math.random().toString(36).slice(2);
            const url = URL.createObjectURL(file);
            const entry = { id, name: file.name, file, url, uploading: true };
            announcementDraftAttachments.push(entry);
            uploadClassworkFileToStorage(file, id).then(remoteUrl => {
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
            <div class="flex items-center gap-2 overflow-x-auto pb-1">
              ${announcementDraftAttachments.map(a => `
                <span class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1 flex-shrink-0">
                  <span class="w-6 h-6 rounded-full bg-white flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('doc','w-3.5 h-3.5')}</span>
                  <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(a.name)}${a.uploading ? ' · Uploading…' : ''}</span>
                  <button onclick="removeAnnouncementAttachment('${a.id}')" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                </span>`).join('')}
            </div>`;
        }

        function newAnnouncementHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const canPost = announcementDraft.trim().length > 0;
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between gap-4" style="position:relative;">
                <button onclick="discardAnnouncementDraft()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <button onclick="toggleAnnouncementMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('dashes','w-5 h-5')}</button>
                ${announcementMenuOpen ? `
                  <div onclick="toggleAnnouncementMenu()" onwheel="toggleAnnouncementMenu()" ontouchmove="toggleAnnouncementMenu()" class="fixed inset-0 z-10"></div>
                  <div class="absolute bg-white rounded-2xl border border-gray-100 py-1.5 z-20 menu-dropdown-inset" style="right:1.25rem;top:2.75rem;width:11rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
                    <button onclick="discardAnnouncementDraft()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 text-left menu-item-pill">${Icon('trash','w-4 h-4')} Discard draft</button>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-24">
              <div class="flex items-center gap-2.5 mb-5">
                ${Icon('users','w-5 h-5 text-gray-500 flex-shrink-0')}
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? escapeHtml(cls.name) : 'Class'}</span>
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:${NAVY};">All students</span>
              </div>
              <textarea id="announcement-text-input" oninput="announcementDraft=this.value; const b=document.getElementById('announcement-create-btn'); if(b){const c=announcementDraft.trim().length>0; b.disabled=!c; b.className='font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)':''; b.style.boxShadow=c?'0 4px 14px rgba(65,105,225,0.35)':'';}" placeholder="Announce something to your class" rows="6" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-6">${announcementDraft}</textarea>
              <input type="file" id="announcement-attach-input" multiple class="hidden" onchange="handleAnnouncementAttachFile(event)">
              <button onclick="document.getElementById('announcement-attach-input').click()" class="flex items-center gap-2 text-sm font-semibold" style="color:${NAVY};">${Icon('paperclip','w-4 h-4')} Add attachment</button>
              <div id="announcement-attach-strip" class="mt-3">${announcementAttachStripHTML()}</div>
            </div>
            <button onclick="submitNewAnnouncement()" ${canPost ? '' : 'disabled'} id="announcement-create-btn" class="font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg ${canPost ? 'text-white' : 'text-gray-400 bg-gray-100'}" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;${canPost ? `background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);` : ''}">Create</button>`;
        }

        function submitNewAnnouncement(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const text = (document.getElementById('announcement-text-input') ? document.getElementById('announcement-text-input').value : announcementDraft).trim();
          if (!cls || !text) return;
          if (announcementDraftAttachments.some(a => a.uploading)) { openAppAlertModal('Still uploading -- give it a moment and try again.'); return; }
          const attachments = announcementDraftAttachments.map(a => ({ id: a.id, name: a.name, url: a.url }));
          cls.announcements.unshift({ id: 'a-' + Date.now(), text, createdAt: Date.now(), comments: [], attachments });
          queueSaveClassRemote(cls);
          announcementDraftAttachments = [];
          classDetailTab = 'stream';
          openOverlay('classDetail');
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
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="openClassworkCreateMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate text-center">${label}</div>
                <div class="w-8 h-8 flex-shrink-0"></div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-24">
              <div class="flex items-center gap-2.5 mb-5">
                ${Icon('users','w-5 h-5 text-gray-500 flex-shrink-0')}
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? escapeHtml(cls.name) : 'Class'}</span>
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:${NAVY};">All students</span>
              </div>
              <input type="text" id="classwork-title-input" oninput="const b=document.getElementById('classwork-create-btn'); if(b){const c=this.value.trim().length>0; b.disabled=!c; b.className='font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)':''; b.style.boxShadow=c?'0 4px 14px rgba(65,105,225,0.35)':'';}" placeholder="Title" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
              <textarea id="classwork-instructions-input" placeholder="Instructions (optional)" rows="4" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-4"></textarea>
              ${showScoring ? `
              <div class="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Points</label>
                  <input type="number" id="classwork-points-input" placeholder="100" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Due date</label>
                  <input type="date" id="classwork-due-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                </div>
              </div>` : `
              <div class="mb-6">
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Due date (optional)</label>
                <input type="date" id="classwork-due-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
              </div>`}
              <input type="file" id="classwork-attach-input" multiple class="hidden" onchange="handleClassworkAttachFile(event)">
              <button onclick="document.getElementById('classwork-attach-input').click()" class="flex items-center gap-2 text-sm font-semibold" style="color:${NAVY};">${Icon('paperclip','w-4 h-4')} Add attachment</button>
              <div id="classwork-attach-strip" class="mt-3">${classworkAttachStripHTML()}</div>
            </div>
            <button onclick="submitNewClasswork()" id="classwork-create-btn" class="font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg text-gray-400 bg-gray-100" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;">Create</button>`;
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
          const due = (document.getElementById('classwork-due-input') || {}).value;
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
            <div class="quiz-question-block border border-gray-200 rounded-2xl p-4 mb-4" data-qindex="${n}">
              <div class="flex items-center justify-between mb-2.5">
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wide">Question ${n + 1}</div>
                <button onclick="removeQuizQuestionBlock(this)" class="text-gray-300">${Icon('close','w-4 h-4')}</button>
              </div>
              <input type="text" class="quiz-q-text w-full border-b border-gray-200 px-1 py-2 text-sm mb-3" placeholder="Question text">
              <div class="space-y-2">
                ${[0,1,2,3].map(i => `
                  <label class="flex items-center gap-2.5 text-sm">
                    <input type="radio" name="quiz-correct-${n}" value="${i}" class="quiz-q-correct flex-shrink-0" ${i === 0 ? 'checked' : ''}>
                    <input type="text" class="quiz-q-option flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm" placeholder="Option ${i + 1}">
                  </label>`).join('')}
              </div>
              <div class="text-[11px] text-gray-400 mt-2">Tap the circle next to the correct option.</div>
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
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="openClassworkCreateMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate text-center">Quiz</div>
                <div class="w-8 h-8 flex-shrink-0"></div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-24">
              <div class="flex items-center gap-2.5 mb-5">
                ${Icon('users','w-5 h-5 text-gray-500 flex-shrink-0')}
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? escapeHtml(cls.name) : 'Class'}</span>
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:${NAVY};">All students</span>
              </div>
              <input type="text" id="quiz-title-input" placeholder="Title" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
              <textarea id="quiz-instructions-input" placeholder="Instructions (optional)" rows="3" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-4"></textarea>
              <div class="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Points (optional)</label>
                  <input type="number" id="quiz-points-input" placeholder="e.g. 100" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                </div>
                <div>
                  <label class="text-xs font-semibold text-gray-500 mb-1 block">Due date</label>
                  <input type="date" id="quiz-due-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                </div>
              </div>
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Questions</div>
              <div id="quiz-questions-container">${quizQuestionBlockHTML(0)}</div>
              <button onclick="addQuizQuestionBlock()" class="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 font-semibold text-sm text-[${NAVY}]">${Icon('plus','w-4 h-4')} Add question</button>
            </div>
            <button onclick="submitNewQuiz()" class="font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg text-white" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Create</button>`;
        }

        function submitNewQuiz(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const title = (document.getElementById('quiz-title-input') || {}).value.trim();
          if (!cls || !title) { openAppAlertModal('Give the quiz a title first.'); return; }
          const instructions = (document.getElementById('quiz-instructions-input') || {}).value.trim();
          const points = (document.getElementById('quiz-points-input') || {}).value.trim();
          const due = (document.getElementById('quiz-due-input') || {}).value;
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
              <input type="text" class="poll-option-input flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm" placeholder="Option ${n + 1}">
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
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="openClassworkCreateMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate text-center">Poll</div>
                <div class="w-8 h-8 flex-shrink-0"></div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-24">
              <div class="flex items-center gap-2.5 mb-5">
                ${Icon('users','w-5 h-5 text-gray-500 flex-shrink-0')}
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? escapeHtml(cls.name) : 'Class'}</span>
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:${NAVY};">All students</span>
              </div>
              <input type="text" id="poll-title-input" placeholder="Ask a question" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Options</div>
              <div id="poll-options-container">${pollOptionRowHTML(0)}${pollOptionRowHTML(1)}</div>
              <button onclick="addPollOptionRow()" class="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 font-semibold text-sm text-[${NAVY}]">${Icon('plus','w-4 h-4')} Add option</button>
            </div>
            <button onclick="submitNewPoll()" class="font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg text-white" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Create</button>`;
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
              <div class="w-full px-5 pb-3 relative" style="padding-top:var(--top-safe-pad);">
                <div class="flex items-center justify-between">
                  <button onclick="classDetailTab='classwork'; openOverlay('classDetail')" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                  <h1 class="text-base font-bold text-[${NAVY}] font-display absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">${classworkTypeLabel(w.type)}</h1>
                  ${isTeacher ? `
                    <button onclick="toggleClassworkDetailMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('dashes','w-5 h-5')}</button>
                    ${classworkDetailMenuOpen ? `
                      <div onclick="toggleClassworkDetailMenu()" onwheel="toggleClassworkDetailMenu()" ontouchmove="toggleClassworkDetailMenu()" class="fixed inset-0 z-10"></div>
                      <div class="absolute bg-white rounded-2xl border border-gray-100 py-1.5 z-20 menu-dropdown-inset" style="right:1.25rem;top:2.75rem;width:11rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
                        <button onclick="deleteCurrentClasswork()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 text-left menu-item-pill">${Icon('trash','w-4 h-4')} Delete</button>
                      </div>
                    ` : ''}
                  ` : `<div class="w-8 h-8 flex-shrink-0"></div>`}
                </div>
              </div>
              <div class="flex-1 overflow-y-auto px-5 pb-8">
                <div class="text-xl font-bold text-gray-800 mb-1">${escapeHtml(w.title)}</div>
                <div class="text-xs text-gray-400 mb-4 flex items-center gap-2 flex-wrap">
                  ${w.type === 'quiz' ? w.questions.length + ' questions' : w.type === 'poll' ? w.options.length + ' options' : (w.points ? w.points + ' points' : 'Unscored')}
                  ${w.due ? ' · Due ' + w.due : ''}
                </div>
                ${w.instructions ? `<div class="bg-white rounded-2xl p-4 mb-5 text-sm text-gray-700 leading-relaxed shadow-sm">${w.instructions}</div>` : ''}
                ${(w.attachments && w.attachments.length) ? `
                <div class="flex items-center gap-2 overflow-x-auto pb-1 mb-5">
                  ${w.attachments.map(a => `
                    <button onclick="window.open('${escapeHtml(a.url)}', '_blank')" title="Open ${escapeHtml(a.name)}" class="flex items-center gap-1.5 bg-white rounded-full pl-1 pr-3 py-1 flex-shrink-0 shadow-sm">
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
              <div class="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">${escapeHtml(name)} · ${sub.submittedAt}</div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-3">${escapeHtml(sub.text)}</div>
                <div class="flex items-center gap-3 mb-3">
                  <input type="number" id="classwork-score-input-${sid}" value="${sub.score !== null && sub.score !== undefined ? sub.score : ''}" placeholder="Score" class="w-24 bg-gray-100 rounded-2xl px-3 py-2 text-sm">
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
            <div class="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your submission · ${mine.submittedAt}</div>
              <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(mine.text)}</div>
            </div>
            ${mine.graded ? '' : `<button onclick="unsubmitClasswork('${w.id}')" class="text-xs font-semibold text-gray-400 mb-5">Unsubmit &amp; edit</button>`}
          ` : `
            <div class="bg-white rounded-2xl p-4 mb-5 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your work</div>
              <textarea id="classwork-submission-input" placeholder="Type your answer here..." rows="5" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3"></textarea>
              <button onclick="submitClassworkAssignment('${w.id}')" class="w-full text-white font-semibold py-2.5 rounded-2xl" style="background:rgba(30,144,255,0.55);">Turn in</button>
            </div>
          `;
          const gradeSummary = (mine && mine.graded) ? `
            <div class="bg-white rounded-2xl p-4 shadow-sm">
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
          classworkSubmissionsMap(w)[uid] = { text, submittedAt: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), score: null, remark: '', graded: false };
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
        }

        function unsubmitClasswork(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const uid = myClassworkUserId();
          if (!uid) return;
          delete classworkSubmissionsMap(w)[uid];
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
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
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
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
              <div class="bg-white rounded-2xl p-4 mb-3 shadow-sm">
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
                  <div class="bg-white rounded-2xl p-4 shadow-sm">
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
            <div class="bg-white rounded-2xl p-4 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Remark / feedback</div>
              <div class="text-sm text-gray-700 leading-relaxed">${sub.remark}</div>
            </div>` : '';
          return `
            <div class="bg-white rounded-2xl p-4 mb-4 shadow-sm text-center">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Your score</div>
              <div class="text-2xl font-bold text-[${NAVY}] font-display">${sub.autoScore}/${sub.total}${w.points ? ' · ' + Math.round((sub.autoScore / sub.total) * w.points) + '/' + w.points : ''}</div>
              <div class="text-xs text-gray-400 mt-1">Submitted ${sub.submittedAt}</div>
            </div>
            <div class="space-y-3 mb-5">
              ${w.questions.map((q, qi) => {
                const yourAnswer = sub.answers[qi];
                const correct = yourAnswer === q.correct;
                return `
                <div class="bg-white rounded-2xl p-4 shadow-sm">
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
          classworkQuizSubmissionsMap(w)[uid] = { answers, total: w.questions.length, autoScore, submittedAt: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), remark: '' };
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
        }

        function saveQuizRemark(id, studentId){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const sub = classworkQuizSubmissionsMap(w)[studentId];
          if (!sub) return;
          const input = document.getElementById('quiz-remark-input-' + studentId);
          sub.remark = input ? input.value.trim() : '';
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
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
                  <label class="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm cursor-pointer">
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
                <div class="bg-white rounded-2xl p-4 shadow-sm">
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

        // ---- Class People tab (roster + co-teacher invites) ----
        function classPeopleTabHTML(cls){
          const coTeachers = cls.coTeachers || [];
          const isTeacher = cls.role === 'teacher';
          return `
            <div class="flex items-center justify-between mb-3">
              <div class="text-xl font-bold text-[${NAVY}] font-display">Teachers</div>
              ${isTeacher ? `<button onclick="inviteCoTeacher('${cls.id}')" class="text-[${NAVY}]">${Icon('personPlus','w-6 h-6')}</button>` : ''}
            </div>
            <div class="border-t border-gray-100 mb-4">
              <div class="flex items-center gap-3 py-3.5 ${(isTeacher && coTeachers.length) ? 'border-b border-gray-100' : ''}">
                <span class="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0 overflow-hidden">${classTeacherAvatarHTML(cls,'w-6 h-6')}</span>
                <div class="font-semibold text-sm text-gray-800">${classTeacherDisplayName(cls)}</div>
              </div>
              ${isTeacher ? coTeachers.map((t, i) => `
                <div class="flex items-center gap-3 py-3.5 ${i < coTeachers.length - 1 ? 'border-b border-gray-100' : ''}">
                  <span class="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">${Icon('user','w-6 h-6')}</span>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(t.email)}</div>
                    <div class="text-xs text-gray-400">Invite pending</div>
                  </div>
                  <button onclick="cancelCoTeacherInvite('${cls.id}', ${i})" class="text-xs font-semibold text-gray-400 flex-shrink-0">Cancel</button>
                </div>`).join('') : ''}
            </div>
            <div class="flex items-center justify-between mb-3">
              <div class="text-xl font-bold text-[${NAVY}] font-display">Students</div>
              ${isTeacher ? `<button onclick="openInviteStudentsOverlay()" class="text-[${NAVY}]">${Icon('personPlus','w-6 h-6')}</button>` : ''}
            </div>
            <div class="border-t border-gray-100">
              ${cls.students.length ? cls.students.map((s, i) => `
                <div class="flex items-center gap-3 py-3.5 border-b border-gray-100">
                  <span class="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">${Icon('user','w-6 h-6')}</span>
                  <div class="min-w-0 flex-1">
                    <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(s.name)}</div>
                    ${s.pending ? `<div class="text-xs text-gray-400">Invite pending &middot; must enroll to get access</div>` : `<div class="text-xs text-gray-400 truncate">${s.email}</div>`}
                  </div>
                  ${(isTeacher && s.pending) ? `<button onclick="cancelStudentInvite('${cls.id}', ${i})" class="text-xs font-semibold text-gray-400 flex-shrink-0">Cancel</button>` : ''}
                </div>`).join('') : (isTeacher ? `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">${Icon('users','w-8 h-8')}</div>
                  <div class="text-gray-400 mb-5">Invite students to your class</div>
                  <button onclick="openInviteStudentsOverlay()" class="font-semibold text-sm px-8 py-2.5 rounded-2xl" style="color:${NAVY};background:rgba(30,144,255,0.12);margin-bottom:10px;">Invite</button>
                </div>` : `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">${Icon('users','w-8 h-8')}</div>
                  <div class="text-gray-400">No other students yet.</div>
                </div>`)}
            </div>`;
        }

        function inviteCoTeacher(classId){
          const cls = myClasses.find(c => c.id === classId);
          if (!cls) return;
          const email = (prompt('Invite a co-teacher by email:') || '').trim();
          if (!email) return;
          if (!cls.coTeachers) cls.coTeachers = [];
          if (cls.coTeachers.some(t => t.email.toLowerCase() === email.toLowerCase())) {
            openAppAlertModal(`${email} has already been invited.`);
            return;
          }
          cls.coTeachers.push({ email });
          queueSaveClassRemote(cls);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
        }

        function cancelCoTeacherInvite(classId, index){
          const cls = myClasses.find(c => c.id === classId);
          if (!cls || !cls.coTeachers) return;
          cls.coTeachers.splice(index, 1);
          queueSaveClassRemote(cls);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
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
        function openInviteStudentsOverlay(){
          inviteEmailsDraft = '';
          openOverlay('inviteStudents');
        }

        function inviteStudentsHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const canInvite = inviteEmailsDraft.trim().length > 0;
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between gap-4">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate">Invite students</div>
                <button id="invite-submit-btn" onclick="submitInviteStudents()" ${canInvite ? '' : 'disabled'} class="font-semibold text-sm px-4 py-2 rounded-full flex-shrink-0 ${canInvite ? 'text-white' : 'text-gray-400 bg-gray-100'}" style="${canInvite ? `background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);` : ''}">Invite</button>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-8">
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
              <textarea id="invite-emails-input" oninput="inviteEmailsDraft=this.value; const b=document.getElementById('invite-submit-btn'); if(b){const c=inviteEmailsDraft.trim().length>0; b.disabled=!c; b.className='font-semibold text-sm px-4 py-2 rounded-full flex-shrink-0 '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)':''; b.style.boxShadow=c?'0 4px 14px rgba(65,105,225,0.35)':'';}" placeholder="e.g. ama@example.com, kojo@example.com" rows="4" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-2">${inviteEmailsDraft}</textarea>
              <div class="text-xs text-gray-400 leading-relaxed">${cls && cls.code ? 'Separate multiple addresses with commas, or just share the class code above so students can join themselves.' : 'Separate multiple addresses with commas.'}</div>
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
          classDetailTab = 'people';
          openOverlay('classDetail');
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
            ${overlayHeader('Study Timetable', '20px')}
            <div class="p-4 flex-1 overflow-y-auto no-scrollbar">
              <div class="text-sm text-gray-500 mb-5">Your weekly schedule, all in one place; we'll notify you before each class starts.</div>

              <div class="bg-white rounded-3xl p-5 mb-5 shadow-sm">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">New Entry · Schedule a Class</div>
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Day</label>
                <select id="class-day-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
                  <option value="">(Select day)</option>
                  ${WEEKDAYS.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Subject</label>
                <input type="text" id="class-subject-input" placeholder="e.g. Organic Chemistry" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
                <div class="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Start time</label>
                    <input type="time" id="class-start-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  </div>
                  <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">End time</label>
                    <input type="time" id="class-end-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  </div>
                </div>
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Room / Location (optional)</label>
                <input type="text" id="class-room-input" placeholder="e.g. Lecture Hall 3" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-5">
                <button onclick="submitClassSchedule()" class="w-full font-semibold py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">+ Add Class</button>
              </div>

              ${upcoming ? `
                <div class="rounded-2xl p-4 mb-5 flex items-center gap-3" style="background:rgba(217,119,6,0.12);">
                  ${Icon('bell','w-5 h-5 text-amber-600 flex-shrink-0')}
                  <div class="text-sm text-gray-800 flex-1"><span class="font-bold">Up next:</span> ${escapeHtml(upcoming.subject)}, ${upcoming.dayLabel} at ${formatTime12(upcoming.start)}</div>
                  <button onclick="addClassToCalendar('${upcoming.id}')" class="text-amber-700 flex-shrink-0">${Icon('calendar','w-5 h-5')}</button>
                </div>` : ''}

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Weekly schedule</div>
              ${WEEKDAYS.map(d => weekdayScheduleCard(d)).join('')}
            </div>`;
        }

        function weekdayScheduleCard(day){
          const classes = classSchedule.filter(c => c.day === day).sort((a,b) => a.start.localeCompare(b.start));
          return `
            <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <div class="font-bold text-[${NAVY}]">${day}</div>
                <div class="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-3 py-1">${classes.length} class${classes.length===1?'':'es'}</div>
              </div>
              ${classes.length === 0 ? `<div class="text-sm text-gray-400 text-center py-3">No classes, free day</div>` : classes.map(c => `
                <div class="flex items-center justify-between bg-amber-50 rounded-2xl px-4 py-3 mb-2">
                  <div class="min-w-0">
                    <div class="text-xs font-bold text-amber-700">${formatTime12(c.start)} - ${formatTime12(c.end)}</div>
                    <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(c.subject)}${c.room ? ' · ' + c.room : ''}</div>
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
          if (!day || !subject || !start || !end) { openAppAlertModal('Please select a day, subject, start time, and end time.'); return; }
          classSchedule.push({ id: 'cls-' + Date.now(), day, subject, start, end, room });
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
            ${overlayHeader('Set Reminders', '20px')}
            <div class="p-4 flex-1 overflow-y-auto no-scrollbar">
              <div class="text-sm text-gray-500 mb-5">Add an exam, deadline, or study session and we'll prompt you as it gets close.</div>

              <div class="bg-white rounded-3xl p-5 mb-5 shadow-sm">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">New Reminder · Add an Event</div>
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Event</label>
                <input type="text" id="reminder-event-input" placeholder="e.g. Chemistry Mid-sem" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
                <label class="text-xs font-semibold text-gray-500 mb-1 block">Type</label>
                <select id="reminder-type-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-4">
                  <option>Exam</option>
                  <option>Deadline</option>
                  <option>Study Session</option>
                </select>
                <div class="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
                    <input type="date" id="reminder-date-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  </div>
                  <div>
                    <label class="text-xs font-semibold text-gray-500 mb-1 block">Time</label>
                    <input type="time" id="reminder-time-input" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm">
                  </div>
                </div>
                <button onclick="submitReminder()" class="w-full font-semibold py-3 rounded-2xl border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">+ Add Reminder</button>
              </div>

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Upcoming</div>
              ${sorted.length === 0 ? `<div class="text-sm text-gray-400 text-center py-6">No reminders yet</div>` : sorted.map(r => reminderRow(r)).join('')}
            </div>`;
        }

        function reminderRow(r){
          const typeColor = r.type === 'Exam' ? 'bg-rose-100 text-rose-700' : r.type === 'Deadline' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700';
          return `
            <div class="bg-white rounded-3xl p-4 flex items-center gap-3 mb-3 shadow-sm">
              <div class="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('bell','w-6 h-6')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">${escapeHtml(r.title)}</div>
                <div class="text-xs text-gray-500">${formatReminderDate(r.date)} · ${formatTime12(r.time)}</div>
              </div>
              <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0 ${typeColor}">${r.type}</span>
              <button onclick="addReminderToCalendar('${r.id}')" class="text-gray-400 flex-shrink-0">${Icon('calendar','w-4 h-4')}</button>
              <button onclick="deleteReminder('${r.id}')" class="text-gray-400 flex-shrink-0">${Icon('trash','w-4 h-4')}</button>
            </div>`;
        }

        function submitReminder(){
          const title = document.getElementById('reminder-event-input').value.trim();
          const type = document.getElementById('reminder-type-input').value;
          const date = document.getElementById('reminder-date-input').value;
          const time = document.getElementById('reminder-time-input').value;
          if (!title || !date || !time) { openAppAlertModal('Please fill in the event, date, and time.'); return; }
          studyReminders.push({ id: 'rem-' + Date.now(), title, type, date, time });
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
            <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(217,119,6,0.15);color:${NAVY};">${Icon('bell','w-5 h-5')}</div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-sm text-[${NAVY}] truncate">${escapeHtml(title)}</div>
              <div class="text-xs text-gray-500">${escapeHtml(body)}</div>
            </div>
            <button onclick="this.parentElement.remove()" class="text-gray-300 flex-shrink-0">${Icon('close','w-4 h-4')}</button>`;
          document.body.appendChild(el);
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
            const key = 'cls-' + c.id + '-' + now.toDateString();
            if (diffMin <= 10 && diffMin > 8.5 && !notifiedKeys.has(key)) {
              notifiedKeys.add(key);
              fireStudyNotification('Upcoming class', c.subject + ' starts at ' + formatTime12(c.start) + (c.room ? ' · ' + c.room : ''));
            }
          });
          studyReminders.forEach(r => {
            const [y, mo, da] = r.date.split('-').map(Number);
            const [h, m] = r.time.split(':').map(Number);
            const remTime = new Date(y, mo - 1, da, h, m, 0, 0);
            const diffMin = (remTime - now) / 60000;
            const key = 'rem-' + r.id;
            if (diffMin <= 60 && diffMin > 58.5 && !notifiedKeys.has(key)) {
              notifiedKeys.add(key);
              fireStudyNotification(r.type + ' reminder', r.title + ', due ' + formatTime12(r.time));
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
