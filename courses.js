        // ---------------- AI INTERACTIVE CLASS ----------------
        let aiChatMessages = [];
        let aiChatHistoryOpen = false;

        // First name Stitch Bot should call the student by -- pulled from
        // their profile (see profileData.name in profile.js), same name
        // shown everywhere else in the app (profile page, posts, etc.),
        // not a separate "AI nickname" the student would have to set up
        // twice. Falls back to their username, then to nothing (the bot
        // just skips using a name) for accounts that haven't finished
        // onboarding yet -- never invents a placeholder like "Student" or
        // "there", which would read as obviously robotic.
        function studentFirstName(){
          const full = (typeof profileData !== 'undefined' && profileData.name) ? profileData.name.trim() : '';
          if (full) return full.split(/\s+/)[0];
          const uname = (typeof profileData !== 'undefined' && profileData.username) ? profileData.username.trim() : '';
          return uname || '';
        }

        function aiWelcomeMessage(){
          const name = studentFirstName();
          return (name ? `Welcome back, ${escapeHtml(name)}! ` : 'Welcome to Stitch Bot! ') +
            "Ask me to explain a topic, quiz you, summarise your slides, or turn a resource into notes. What would you like to do?";
        }

        // Past conversations, one entry per session (everything you sent
        // between opening Stitch Bot and leaving it). Chat History lists
        // these -- not every individual message inside whatever chat is
        // currently open -- and tapping one resumes that conversation.
        let aiChatSessions = [];
        let aiChatSessionIdCounter = 0;

        // Files away whatever's currently in aiChatMessages as a session
        // (as long as you actually said something -- an empty chat with
        // just the bot's welcome line isn't worth a history entry) and
        // resets the live conversation so the next open starts fresh.
        // Called whenever Stitch Bot is left (see closeOverlay) and
        // before switching into a past session from history.
        function archiveCurrentAIChat(){
          const hasUserMessage = aiChatMessages.some(m => m.role === 'user');
          if (hasUserMessage) {
            const session = { id: ++aiChatSessionIdCounter, messages: aiChatMessages.slice(), summary: null };
            aiChatSessions.unshift(session);
            generateAIChatSummary(session);
          }
          aiChatMessages = [];
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        // Chat History used to just show each session's very first
        // message verbatim, which was usually a bare greeting ("Yoo
        // Sup") that says nothing about what the conversation actually
        // covered. This asks Claude for a short "what was this about"
        // label instead, running in the background right after a chat
        // is archived so it doesn't block leaving/switching chats.
        // aiSessionPreview() falls back to the old first-message
        // behaviour until session.summary comes back, then
        // refreshAIChatHistoryViews() quietly repaints whichever Chat
        // History view (mobile full-screen or desktop panel) is open.
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
          }
          if (typeof rightPanelMode !== 'undefined' && rightPanelMode === 'aihistory') renderRightPanelBody();
        }

        function openAIClass(){
          if (aiChatMessages.length === 0) {
            aiChatMessages.push({ role:'bot', text: aiWelcomeMessage() });
          }
          // Always land back on the live chat, not wherever the mobile
          // full-screen history view was left open last time (it never
          // got reset on close, so re-opening Stitch Bot from the nav
          // could silently drop you onto the history list instead).
          aiChatHistoryOpen = false;
          openOverlay('aiClass');
          openRightPanel('aihistory');
        }

        function openAIChatHistory(){
          aiClassMenuOpen = false;
          aiChatHistoryOpen = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
        }

        // Dropdown for the AI Class kebab menu: the same "Chat history" /
        // "Clear chat" actions that used to sit as loose icon buttons in
        // the header, now consolidated behind the three-dot menu like
        // every other overlay's actions.
        function aiClassMenuDropdownHTML(){
          return `
            <div class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;width:12rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="openAIChatHistory()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('comment','w-4 h-4')} Chat history</button>
              <button onclick="aiClassMenuOpen=false; confirmClearAIChat();" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Clear chat</button>
            </div>`;
        }

        function closeAIChatHistory(){
          aiChatHistoryOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
        }

        // Mobile header dustbin (replaces the old clock/history icon there):
        // clears the current AI Class conversation after a confirm prompt.
        function confirmClearAIChat(){
          openAppConfirmModal('Clear this chat?', 'This will delete your conversation with Stitch Bot.', 'Clear', function(){ clearAIChat(); });
        }

        function clearAIChat(){
          aiChatMessages = [];
          aiChatHistoryOpen = false;
          aiHistoryPanelView = 'history';
          const ov = document.getElementById('overlay');
          if (ov && ov.classList.contains('hidden') === false) ov.innerHTML = aiClassHTML();
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        // Resumes a past session as the live conversation: whatever's
        // currently open gets archived first (so it isn't lost), then the
        // picked session is pulled back out of history and becomes the
        // active chat.
        function openAIChatSession(id){
          archiveCurrentAIChat();
          const idx = aiChatSessions.findIndex(s => s.id === id);
          if (idx === -1) return;
          const session = aiChatSessions.splice(idx, 1)[0];
          aiChatMessages = session.messages.slice();
          aiChatHistoryOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        // "+ New chat" in Chat History: archives whatever's currently
        // live (only if anything was actually said, same as leaving
        // Stitch Bot normally would) and drops straight into a fresh
        // conversation, instead of making the student back all the way
        // out and reopen Stitch Bot to start over.
        function startNewAIChat(){
          archiveCurrentAIChat();
          aiChatMessages.push({ role:'bot', text: aiWelcomeMessage() });
          aiChatHistoryOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function aiSessionPreview(session){
          if (session.summary) return session.summary;
          return fallbackAIChatSummary(session);
        }

        // Past-conversations list, used as a full-screen fallback on phone
        // widths (where the desktop panel doesn't exist) -- reachable via
        // "Chat history" in the header's three-dot menu. Each row is a
        // whole prior session, not an individual message, and rows sit
        // directly on the page background instead of inside pill cards.
        function aiChatHistoryHTML(){
          const rows = aiChatSessions.length ? aiChatSessions.map(s => `
              <button onclick="openAIChatSession(${s.id})" class="w-full text-left py-4 border-b border-gray-100 text-sm text-gray-700 truncate">${escapeHtml(aiSessionPreview(s))}</button>`
          ).join('') : `<div class="text-center text-gray-400 text-sm py-10">No past conversations yet.</div>`;
          return `
            <div class="w-full px-5 pb-3 flex-shrink-0" style="padding-top:20px;">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-4 min-w-0">
                  <button onclick="closeAIChatHistory()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <h1 class="text-base font-bold font-display grad-text truncate">Chat History</h1>
                </div>
                <button onclick="startNewAIChat()" class="flex items-center gap-1 text-sm font-bold flex-shrink-0" style="color:${NAVY};">${Icon('plus','w-4 h-4')} New chat</button>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5">${rows}</div>`;
        }

        // Desktop right-panel version of the same list: the panel is
        // already titled "Chat History" (see rightPanelTitle), so this is
        // just the rows, and tapping one resumes that past session as the
        // live chat in the already-open AI Class window. Toggled via the
        // dustbin/history icons added to the panel's corner (see
        // rightPanelAIHistoryActionsHTML): 'history' shows the usual
        // session list, 'delete' swaps in a confirm-to-clear view for the
        // current chat, letting you pick between the two from that same
        // corner instead of the old clock icon inside AI Class itself.
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

        function aiClassHTML(){
          if (aiChatHistoryOpen) return aiChatHistoryHTML();
          return `
            <div class="flex-shrink-0">
              <div class="w-full px-5 pb-3 relative" style="padding-top:20px;">
                <div class="flex items-center justify-between">
                  <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <h1 class="text-base font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">Stitch Bot</h1>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="startNewAIChat()" title="New chat" class="w-8 h-8 flex items-center justify-center">${gradIcon(Icon('plus','w-5 h-5'))}</button>
                    <button onclick="toggleAIClassMenu()" class="w-8 h-8 flex items-center justify-center">${gradIcon(Icon('dashes','w-5 h-5'))}</button>
                  </div>
                </div>
                ${aiClassMenuOpen ? `<div onclick="toggleAIClassMenu()" onwheel="toggleAIClassMenu()" ontouchmove="toggleAIClassMenu()" class="fixed inset-0 z-10"></div>${aiClassMenuDropdownHTML()}` : ''}
              </div>
            </div>
            <div id="ai-chat-log" class="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              ${aiChatLogHTML()}
            </div>
            <div id="ai-attach-strip" class="flex-shrink-0">${aiAttachStripHTML()}</div>
            <div class="p-3 border-t border-gray-100 flex-shrink-0 flex items-center gap-1.5">
              <input type="file" id="ai-file-input" accept="image/*,video/*,.pdf,.ppt,.pptx" multiple class="hidden" onchange="handleAIFileSelect(event)">
              <button onclick="document.getElementById('ai-file-input').click()" title="Attach images, PDFs, or PPTX" class="w-8 h-8 bg-gray-100 text-[${NAVY}] rounded-full flex items-center justify-center flex-shrink-0">${Icon('clip','w-4 h-4')}</button>
              <textarea id="ai-chat-input" rows="1" placeholder="Ask Stitch Bot anything..." onkeydown="handleAIChatInputKeydown(event)" oninput="autoGrowAIChatInput(this)" class="flex-1 min-w-0 bg-gray-100 rounded-3xl px-3 py-2 text-sm resize-none leading-snug" style="max-height:120px; overflow-y:auto;"></textarea>
              <button onclick="sendAIMessage()" class="w-8 h-8 text-white rounded-full flex items-center justify-center flex-shrink-0" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
            </div>`;
        }

        // ---- AI class file attachments (images, PDFs, PPTX) ----
        let pendingAIAttachments = [];

        function aiFileIcon(type){
          if (type && type.startsWith('image/')) return 'camera';
          return 'file';
        }

        // Images (and video, if attached) get a real thumbnail (both in
        // this pre-send strip and in the sent bubble, see aiUserBubble)
        // instead of a generic file pill, so the student can actually see
        // what they attached rather than just its filename. previewUrl is
        // a local blob: URL good for this tab's session; it's set once at
        // select time in handleAIFileSelect and reused everywhere the file
        // is rendered. The navy circle behind the remove (x) button is the
        // only "chrome" here -- the thumbnail itself is an overflow-hidden
        // frame with the media absolutely filling it via object-fit:cover,
        // so it's cropped exactly to the frame's rounded-xl shape instead
        // of floating inside a differently-shaped border.
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
              pendingAIAttachments.push(f); // keep the real File object so it can be scanned like a Resources upload
            }
          });
          event.target.value = '';
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();
        }

        function removeAIAttachment(i){
          const f = pendingAIAttachments[i];
          if (f && f.previewUrl) URL.revokeObjectURL(f.previewUrl);
          pendingAIAttachments.splice(i, 1);
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();
        }

        // On a physical keyboard, Enter sends and Shift+Enter (or
        // Alt/Ctrl+Enter) inserts a newline. Touch devices don't get a
        // vote here: their on-screen keyboard has no reliable Shift
        // modifier to pair with Enter, so treating Enter as "send" on
        // those devices made it impossible to ever type a second line --
        // Enter is left to do its normal job (insert a newline) there,
        // and sending happens via the Send button instead.
        function handleAIChatInputKeydown(event){
          const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          if (isTouchDevice) return;
          if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            sendAIMessage();
          }
        }

        // ---- Keep the composer bar pinned above the on-screen keyboard ----
        // Mobile browsers resize the *visual* viewport (not the layout
        // viewport) when the keyboard opens. The AI Class overlay is
        // positioned with a plain `bottom:0`, which anchors to the full,
        // keyboard-covered layout viewport -- so without this, opening
        // the keyboard to type could shove the composer bar (attach/
        // textarea/mic/send row) up and off-screen behind the keyboard
        // instead of leaving it sitting still right above it. This keeps
        // that bottom inset in sync with however much of the screen the
        // keyboard is actually covering, only while AI Class is open.
        function syncAIClassKeyboardInset(){
          const ov = document.getElementById('overlay');
          if (!ov || ov.classList.contains('hidden')) return;
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind !== 'aiClass') return;
          const vv = window.visualViewport;
          if (!vv) return;
          const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
          ov.style.bottom = keyboardInset + 'px';
        }
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', syncAIClassKeyboardInset);
          window.visualViewport.addEventListener('scroll', syncAIClassKeyboardInset);
        }

        // Grows the textarea as the user types multiple lines, up to the CSS max-height (then it scrolls).
        function autoGrowAIChatInput(el){
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
        }

        function resetAIChatInputHeight(){
          const inputEl = document.getElementById('ai-chat-input');
          if (inputEl) inputEl.style.height = 'auto';
        }

        function aiChatLogHTML(){
          const bubbles = aiChatMessages.map((m, i) => m.role === 'bot' ? aiBotBubble(m.text, i) : aiUserBubble(m.text, m.attachments, i)).join('');
          return bubbles;
        }

        // Turns Stitch Bot's plain-text/lightweight-markdown replies into
        // real HTML: **bold** becomes <strong>, and consecutive "- "/"* "
        // or "1. " lines become an actual <ul>/<ol> instead of sitting
        // there as run-on text. Any stray, unmatched "**" left over (the
        // model starting a bold span it never closed, etc.) is stripped
        // rather than shown literally. Doesn't HTML-escape the input --
        // getAIResponse's attachment "ackLine" prefix is trusted markup
        // (an icon + text) baked into the same string, so escaping here
        // would mangle that; this matches how the bubble already treated
        // its text before this formatting was added.
        function formatAIText(raw){
          if (!raw) return '';
          const withBold = String(raw).replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
          const cleaned = withBold.replace(/\*\*/g, '');
          const lines = cleaned.split(/\n/);
          let html = '';
          let listBuffer = [];
          let listType = null; // 'ul' | 'ol'
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
          return html;
        }

        // Strips markup and any leftover markdown bold markers so the
        // clipboard gets clean plain text, not raw HTML tags.
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

        function aiBotBubble(text, id){
          const isThinking = text === '···';
          return `
            <div id="ai-msg-${id}" class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style="background:${NAVY};">${Icon('bot','w-5 h-5')}</div>
              <div class="min-w-0" style="max-width:80%;">
                <div class="bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-700 leading-relaxed">${isThinking ? text : formatAIText(text)}</div>
                ${isThinking ? '' : `<button onclick="copyAIMessage(${id})" title="Copy" class="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400">${Icon('copy','w-3.5 h-3.5')}<span>Copy</span></button>`}
              </div>
            </div>`;
        }

        function aiUserBubble(text, attachments, id){
          // Images (and video, if ever attached) get an actual thumbnail
          // here, same as the pre-send attach strip (aiAttachStripHTML) --
          // they used to always fall into the generic file-pill row below,
          // so a sent photo showed up as an unhelpful blue "image.jpg" chip
          // instead of the picture itself. Docs/PDFs/PPTX (no previewUrl)
          // still use the pill since there's nothing visual to preview.
          const imageAttachments = (attachments || []).filter(f => f.previewUrl);
          const fileAttachments = (attachments || []).filter(f => !f.previewUrl);
          // The navy rounded-2xl block is meant to be the media's actual
          // frame/outline, not a padded border sitting around a
          // separately-rounded thumbnail -- that gap used to leave a ring
          // of blue visible around every photo. Each thumbnail is now its
          // own overflow-hidden frame (blue background doubles as a
          // loading-state placeholder until the image/video paints), sized
          // and rounded exactly like the frame, with the media set to
          // absolutely fill it via object-fit:cover -- so it's cropped to
          // that exact shape and can never exceed or gap away from it.
          // <video> attachments (mediaType starting with "video/") render
          // with the same frame so a video thumbnail matches image
          // thumbnails pixel-for-pixel.
          const images = imageAttachments.length ? `
            <div class="flex flex-wrap gap-1">
              ${imageAttachments.map(f => `
                <div class="relative overflow-hidden flex-shrink-0" style="width:9.5rem;height:9.5rem;max-width:100%;border-radius:1rem;background:${NAVY};">
                  ${f.type && f.type.startsWith('video/')
                    ? `<video src="${f.previewUrl}" muted playsinline preload="metadata" class="absolute inset-0 w-full h-full object-cover block"></video>`
                    : `<img src="${f.previewUrl}" alt="${escapeHtml(f.name)}" class="absolute inset-0 w-full h-full object-cover block" />`}
                </div>`).join('')}
            </div>` : '';
          const files = fileAttachments.length ? `
            <div class="flex flex-col gap-1.5 rounded-2xl px-2.5 py-2" style="background:${NAVY};">
              ${fileAttachments.map(f => `
                <div class="flex items-center gap-2 bg-white/15 rounded-xl px-2.5 py-1.5">
                  ${Icon(aiFileIcon(f.type),'w-4 h-4')}<span class="text-xs text-white truncate">${escapeHtml(f.name)}</span>
                </div>`).join('')}
            </div>` : '';
          const textBubble = text ? `
            <div class="text-white rounded-2xl px-4 py-3 text-sm" style="background:${NAVY};white-space:pre-wrap;">${escapeHtml(text)}</div>` : '';
          return `
            <div id="ai-msg-${id}" class="flex items-start justify-end gap-3">
              <div class="min-w-0 flex flex-col items-end gap-1.5" style="max-width:80%;">
                ${images}${files}${textBubble}
              </div>
            </div>`;
        }

        function aiTopicChip(label){
          return `<button onclick="sendAIMessage('${label}')" class="bg-white border border-gray-200 rounded-2xl px-3 py-2 text-[11px] font-semibold text-[${NAVY}] text-left leading-snug min-w-0">${label}</button>`;
        }

        async function sendAIMessage(preset){
          const inputEl = document.getElementById('ai-chat-input');
          const text = (preset !== undefined ? preset : (inputEl ? inputEl.value : '')).trim();
          const attachments = pendingAIAttachments;
          if (!text && !attachments.length) return;
          pendingAIAttachments = [];
          aiChatMessages.push({ role:'user', text, attachments });
          const thinkingMsg = { role:'bot', text: '···' };
          aiChatMessages.push(thinkingMsg);
          if (inputEl) { inputEl.value = ''; inputEl.style.height = 'auto'; }
          const log = document.getElementById('ai-chat-log');
          if (log) {
            log.innerHTML = aiChatLogHTML();
            log.scrollTop = log.scrollHeight;
          }
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();

          // Any PDF/DOCX/PPTX attached here gets scanned exactly like a
          // Resources-tab upload; same flashcards, practice questions, and
          // it becomes part of what StudyBot can answer from going forward.
          attachments.filter(f => /\.(pdf|docx|pptx)$/i.test(f.name)).forEach(f => processUploadedResource(f));

          const reply = await getAIResponse(text, attachments);
          thinkingMsg.text = reply;
          const log2 = document.getElementById('ai-chat-log');
          if (log2) {
            log2.innerHTML = aiChatLogHTML();
            log2.scrollTop = log2.scrollHeight;
          }
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        // Reads a File into raw base64 (no "data:...;base64," prefix) so it
        // can ride along in the JSON body callClaude sends to the ai-proxy
        // Edge Function.
        function fileToBase64(file){
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        // Talks to Claude for real, grounding the answer in excerpts from
        // whatever the student has uploaded under Resources (when relevant),
        // and now actually looking at any attached images instead of just
        // acknowledging the filename.
        async function getAIResponse(text, attachments){
          const docs = (attachments || []).filter(f => /\.(pdf|docx|pptx)$/i.test(f.name));
          const images = (attachments || []).filter(f => !docs.includes(f) && f.type && f.type.startsWith('image/'));
          let ackLine = '';
          if (docs.length) {
            const names = docs.map(f => f.name).join(', ');
            ackLine = `<span class="inline-flex items-center gap-1 align-middle">${Icon('paperclip','w-3.5 h-3.5 inline')}</span> Scanning ${names} now: check Resources shortly for flashcards and practice questions built from ${docs.length > 1 ? 'them' : 'it'}.\n\n`;
          }
          if (!text && !images.length) return ackLine || "What would you like help with?";
          try {
            const context = buildResourceContext();
            const system = 'You are Stitch Bot, a warm, encouraging AI tutor and study buddy inside a study app for students across any subject. ' +
              'Talk like a genuinely helpful, upbeat friend who is great at the subject, not like a formal textbook or a customer-support script: use natural, conversational language, contractions, the occasional casual aside, and real personality and warmth. React like a person would, not a database: get a little excited about a cool concept, empathize when something is genuinely tricky ("yeah, this one trips a lot of people up"), and celebrate a good question or a right answer instead of just moving on. Vary your openings and phrasing so replies never feel templated or copy-pasted. ' +
              'Stay concise (2-5 sentences unless they ask for more detail or a worked example) and never let the friendly tone get in the way of being clear and accurate. ' +
              'If an image is attached, actually look at it and respond to what is in it (read handwriting, diagrams, or problems shown) rather than only acknowledging that a file was sent. ' +
              'Ground your answer in the excerpts from their uploaded resources when they are relevant to the question. ' +
              'If nothing relevant was uploaded, answer from your general knowledge of the subject instead. Never mention Claude or Anthropic. ' +
              'Never use em dashes or double-hyphen dashes; use a comma, colon, semicolon, or a full stop instead. ' +
              'Use **double asterisks** around any word or phrase that should be bold (key terms, formulas, headings). ' +
              'When you are listing steps, options, or multiple items, format them as a numbered list (1. 2. 3.) or bullet list (- item) on their own lines instead of run-on prose.' +
              (studentFirstName()
                ? ` The student's first name is ${studentFirstName()}. Address them by that first name every so often (a greeting, celebrating a right answer, or checking in on something tricky) the way a friend actually would, not in every single message and never as a stiff "Hello, ${studentFirstName()}," opener glued onto every reply.`
                : ' You don\'t know the student\'s name yet (they haven\'t set one up), so just talk to them directly without a name.') +
              (context ? '\n\nExcerpts from the student\'s uploaded resources:\n' + context : '\n\nThe student has not uploaded any resources yet.');
            const imagePayload = await Promise.all(images.map(async f => ({ mediaType: f.type || 'image/jpeg', data: await fileToBase64(f) })));
            const prompt = text || (images.length > 1 ? 'Take a look at these images and tell me what you notice, or help with what is shown.' : 'Take a look at this image and tell me what you notice, or help with what is shown.');
            const reply = await callClaude(system, prompt, 'chat', imagePayload);
            return ackLine + (reply || fallbackAIResponse(text));
          } catch (err) {
            // Surface the rate-limit message directly rather than masking
            // it behind a generic canned reply -- the student needs to
            // know to slow down/wait, not think StudyBot just gave a
            // vague non-answer.
            const msg = (err && err.message) || '';
            if (msg.startsWith('Too many AI requests')) return ackLine + msg;
            return ackLine + fallbackAIResponse(text);
          }
        }

        function fallbackAIResponse(text){
          const t = text.toLowerCase();
          if (t.includes('summar')) return "Sure, open Resources and upload the slides or notes you want covered, and I'll pull out the key definitions, formulas, and examples into a short summary you can study from.";
          if (t.includes('note')) return "Got it. Tell me which topic or which uploaded resource, and I'll turn it into structured notes with headings, key terms, and a quick recap at the end.";
          if (t.includes('elastic')) return "Elasticity of Demand measures how much quantity demanded changes in response to a price change. A value above 1 means demand is elastic (responsive); below 1 means it's inelastic. Want a practice question on it?";
          if (t.includes('comparative advantage')) return "Comparative Advantage is when a country or person can produce a good at a lower opportunity cost than another, even without an absolute advantage. Want an example worked out?";
          if (t.includes('quiz') || t.includes('test') || t.includes('practice')) return "I can generate a few practice questions on any topic you're studying; just tell me the topic and how many questions you'd like.";
          return "Good question: want me to explain the concept step by step, generate practice questions, or summarise/turn your uploaded materials into notes?";
        }

        // ---------------- COURSES (Coursera-style) ----------------
        // A separate catalog from myClasses (which stays the join-by-code
        // Google-Classroom-style flow). Courses are authored by admins as
        // Modules -> Items (video / reading / assignment / practice quiz /
        // graded quiz), browsable by anyone, with Module 1 free to preview
        // and the rest unlocked only after enrolling. Uses the same
        // best-effort Supabase pattern as opportunities (see
        // postOpportunityInsertRemote in jobs.js) -- but that pattern only
        // actually works once a matching `courses` table + RLS policies
        // exist in Supabase. If a posted course disappears after signing
        // out and back in, that's exactly what's happening: the insert
        // below is being silently rejected (no table, or no insert policy
        // for this admin) so it never leaves this browser tab, and the
        // next sign-in loads allCourses fresh from Supabase (loadCoursesRemote,
        // called from authEnterApp) which never had it. Run this once in
        // the Supabase SQL editor to fix it (mirrors the `opportunities`
        // table set up in jobs.js -- skip it if you already ran the
        // equivalent for courses):
        //
        //   create table courses (
        //     id text primary key,
        //     data jsonb not null,
        //     created_by uuid references auth.users(id),
        //     created_at timestamptz default now()
        //   );
        //   alter table courses enable row level security;
        //   create policy "Anyone signed in can read courses"
        //     on courses for select using (auth.role() = 'authenticated');
        //   create policy "Only admins can insert courses"
        //     on courses for insert
        //     with check (
        //       exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
        //     );
        //   create policy "Only admins can update courses"
        //     on courses for update
        //     using (
        //       exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
        //     );
        //   create policy "Only admins can delete courses"
        //     on courses for delete
        //     using (
        //       exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
        //     );
        //
        //   -- REQUIRED for a posted announcement/edit to actually go live
        //   -- for everyone else without them having to sign out and back
        //   -- in: subscribeToCoursesRealtime below only ever fires for
        //   -- tables added to Supabase's realtime publication. Without
        //   -- this, postCourseInsertRemote still writes the row to
        //   -- Postgres fine, but no other signed-in student hears about it
        //   -- until their next sign-in (or the 30s poll below catches it).
        //   -- Run this once per project:
        //   alter publication supabase_realtime add table courses;
        //
        // postCourseInsertRemote/loadCoursesRemote below now log the actual
        // Supabase error to the console instead of swallowing it, so you
        // can confirm from devtools whether this is in fact the cause.
        // Even if the publication step above is skipped, refreshCoursesLive
        // (a 30s poll) below is a fallback that still gets updates out to
        // everyone, just with up to a 30s delay instead of instantly.
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
        function courseItemTypeLabel(key){
          const t = courseItemTypes.find(t => t.key === key);
          return t ? t.label : key;
        }
        function courseItemIsQuiz(type){
          return type === 'practiceQuiz' || type === 'gradedQuiz';
        }
        // A course is either taught live (scheduled sessions, like myClasses'
        // live-lecture feature) or a self-paced set of uploaded material a
        // learner works through on their own -- this is a course-level tag
        // (courseDeliveryTypes), separate from an individual item's type
        // (courseItemTypes, which is video/audio/reading/etc within a
        // module). Defaults to 'uploaded' since that's what every course
        // in this catalog has been so far.
        const courseDeliveryTypes = [
          { key:'uploaded', label:'Uploaded', description:'Self-paced -- learners work through uploaded material on their own schedule.' },
          { key:'live', label:'Live Teaching', description:'Taught in real time on a schedule, like a live class.' },
        ];
        function courseDeliveryTypeLabel(key){
          const t = courseDeliveryTypes.find(t => t.key === key);
          return t ? t.label : 'Uploaded';
        }

        let classroomAreaTab = 'classes'; // 'classes' | 'courses'
        // Which way the classroom-tab-panel should slide in on its next
        // render -- 'left' when moving classes->courses (courses tab sits
        // to the right of My Classes, so its content enters from the
        // right, sliding the panel leftward into place) and 'right' for
        // the reverse. Read by renderStudy() in study.js to pick the
        // matching CSS animation class; defaults to 'left' since My
        // Classes is the initial tab.
        let classroomAreaTabSlideDir = 'left';
        const COURSES_TABLE = 'courses';

        let allCourses = [];
        let enrolledCourseIds = [];
        let currentCourseId = null;
        let currentCourseItemId = null;
        let courseActiveModule = 0;
        // 'content' (Modules/Items) | 'resources' (supplementary video &
        // audio) | 'announcements' -- which tab of the course detail screen
        // is showing.
        let courseDetailTab = 'content';
        // Whether the three-dot admin menu (Edit Course / Teachers / Delete)
        // is open on the course detail screen -- see courseDetailMenuDropdownHTML.
        let courseDetailMenuOpen = false;
        let courseQuizAnswers = {}; // itemId -> [selectedOptionIndex, ...]
        let courseQuizSubmitted = {}; // itemId -> bool
        // Which lesson/item ids THIS student has marked complete. Kept
        // separate from the shared course object (which every student's
        // client re-pulls wholesale from Supabase on load, every 30s poll,
        // and on every realtime update -- see loadCoursesRemote/
        // applyRemoteCourseChange) because completion is per-student, not
        // part of the admin-authored course content. Storing it as
        // item.completed directly on the shared course used to get wiped
        // out the moment courses refreshed from the server, since the
        // server was never told about it -- this persists through
        // collectUserState/applyUserState instead, same as
        // courseQuizAnswers/courseQuizSubmitted above, so progress sticks
        // immediately and survives a refresh instead of reverting.
        let courseItemCompletions = {}; // itemId -> true
        let courseEnrollments = {}; // courseId -> { name, email, agreedAt } -- see openCourseEnrollForm
        let courseEnrollDraft = null; // { courseId, name, email, agreed } while the enroll form is open
        let newCourseDraft = null;
        let newCourseEditingId = null; // set while editing an existing course instead of creating a new one
        let newCourseAddingItemModuleIndex = null;
        let newCourseAddingItemDraft = null;
        // When set (to the item's index within the module), the Add Part
        // form below is in edit mode -- confirmAddCourseItem() overwrites
        // that existing item instead of pushing a new one. null means the
        // form is adding a brand-new part.
        let newCourseEditingItemIndex = null;
        let newCourseEditingItemOriginalPlacement = null;
        let courseTeachersViewingId = null; // which course's Teachers overlay is open
        let courseAnnouncementDraft = ''; // text currently being composed in the Announcements tab

        // Every course is taught by "Stitch Team" by default; admins can
        // additionally invite other teachers onto a specific course (see
        // openCourseTeachers / inviteCourseTeacher below), who show up
        // alongside Stitch Team in that course's Teachers list.
        const TEAM_STITCH_TEACHER = 'Stitch Team';

        // ---- Course item media (video/picture uploads on a Part) ----
        // Same reasoning as uploadLectureFileToStorage/uploadResourceFileToStorage
        // in core.js: the actual video/image bytes go to a public Supabase
        // Storage bucket, and only the resulting public URL is stored on
        // the item -- never the raw file -- so a course's `data` jsonb blob
        // (which every enrolled student's client re-downloads) stays small
        // no matter how much video is attached to it.
        //
        // THIS BUCKET MUST EXIST for uploaded video/image/document files
        // (and quiz submission files) to actually reach other students, and
        // for the "Download file" button to work once the tab/session that
        // uploaded it is gone -- without it, mediaUrl is a blob: URL that
        // only exists in the browser tab that created it, so it plays fine
        // for the admin who just uploaded it and then is a broken link for
        // literally everyone else, including that same admin after a
        // refresh. If uploads are silently falling back to local-only,
        // this bucket is missing (or isn't public). Run this once in the
        // Supabase SQL editor / Storage tab to fix it:
        //
        //   -- Dashboard: Storage -> New bucket -> name it exactly
        //   -- "course-media" -> toggle "Public bucket" on.
        //   -- Or via SQL:
        //   insert into storage.buckets (id, name, public)
        //   values ('course-media', 'course-media', true)
        //   on conflict (id) do nothing;
        //
        //   create policy "Anyone signed in can upload course media"
        //     on storage.objects for insert
        //     with check (bucket_id = 'course-media' and auth.role() = 'authenticated');
        //   create policy "Course media is publicly readable"
        //     on storage.objects for select
        //     using (bucket_id = 'course-media');
        //
        // uploadCourseItemMediaToStorage below now logs the actual Supabase
        // error to the console (check devtools) and callers surface a
        // one-time warning to the admin when it fails, instead of quietly
        // keeping the broken local-only fallback.
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

        // Same simple base64-data-URL pattern as a class photo
        // (handleClassPhotoSelected) rather than a Storage upload -- it's
        // one small image on a course's `data` jsonb blob, which every
        // student already re-downloads in full for modules/items anyway,
        // so there's no real cost to keeping it inline and no bucket
        // dependency to set up.
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
          // 'classes' is the left-hand pill and 'courses' is the right-hand
          // pill, so moving into 'courses' slides the panel in from the
          // right (direction 'left') and moving back into 'classes' slides
          // it in from the left (direction 'right').
          classroomAreaTabSlideDir = tab === 'courses' ? 'left' : 'right';
          classroomAreaTab = tab;
          courseCardMenuOpenId = null;
          renderStudy();
        }

        // Which course card (in the Courses list, not the detail overlay)
        // has its admin quick-menu open -- lets an admin Edit/manage
        // Teachers/Delete a course they just posted straight from the list,
        // without first opening the course (same three actions as the
        // detail overlay's menu, see courseDetailMenuDropdownHTML).
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

        // A module counts as "done" (gets the Coursera-style checkmark pill)
        // once it has at least one item and every item in it is completed.
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
          // Same gradient-banner-plus-motif treatment as a My Classes card
          // (see myClassesListHTML in study.js), but blue-only
          // (blueCardPalette in core.js) instead of the class palette's
          // full color range -- see jobCard in jobs.js for the matching
          // treatment on the Opportunities side.
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
                  ${isAdmin ? `<button onclick="toggleCourseCardMenu('${c.id}', event)" class="w-7 h-7 -mr-1.5 rounded-full flex items-center justify-center text-white/70 flex-shrink-0">${Icon('dots','w-4 h-4')}</button>` : ''}
                </div>
              </div>
              <div class="text-lg font-bold font-display mb-1 relative">${escapeHtml(c.title)}</div>
              <div class="text-xs text-white/80 relative">${c.modules.length} module${c.modules.length === 1 ? '' : 's'} · ${total} lesson${total === 1 ? '' : 's'}${enrolled ? ` · ${pct}% complete` : ''}</div>
              ${isAdmin && courseCardMenuOpenId === c.id ? `<div onclick="toggleCourseCardMenu('${c.id}', event)" onwheel="toggleCourseCardMenu('${c.id}', event)" ontouchmove="toggleCourseCardMenu('${c.id}', event)" class="fixed inset-0 z-10"></div>${courseCardMenuHTML(c.id)}` : ''}
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

        // Dropdown for the course detail three-dot menu: consolidates the
        // admin-only actions (Edit Course -- add/remove modules, lessons,
        // and quizzes -- Teachers, and Delete) that used to sit as three
        // separate buttons under the title, matching every other overlay's
        // menu-button treatment (see aiClassMenuDropdownHTML).
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

        // Enrolling used to be a single tap that unlocked every module
        // instantly -- now it requires filling in a short form and
        // explicitly agreeing to the course's terms first, same spirit as
        // a real course registration. openCourseEnrollForm shows that
        // form; enrollInCourse (called from the form's submit button) is
        // what actually unlocks the course once it's been accepted.
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

                <button onclick="submitCourseEnroll()" ${canSubmit ? '' : 'disabled'} class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white ${canSubmit ? '' : 'opacity-40'}" style="background:${NAVY};">
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

        // Ends a student's own enrollment -- distinct from deleteCourse
        // (admin-only, removes the course for everyone). This only clears
        // their personal enrollment record and quiz answers/submissions,
        // never the shared course content itself, so re-enrolling later
        // is always possible.
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
                    ${isCurrentUserAdmin() ? `<button onclick="openEditCourse('${c.id}')" class="mt-3 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-semibold text-xs text-white" style="background:${NAVY};">${Icon('plus','w-3.5 h-3.5')} Add the first module</button>` : ''}
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

        // Resources are supplementary video/audio, kept separate from the
        // graded Module/Item curriculum above -- same enrollment gate as
        // module 2+, since they're still part of the paid/enrolled content,
        // just not part of the graded flow. Each opens its link in a new
        // tab rather than trying to embed arbitrary hosts inline.
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

        // Quick-add shortcut from the Resources tab -- same underlying
        // newCourseDraft/publishNewCourse pipeline as Manage Course, see
        // openEngageAddModule/openEngageAddItem above.
        function openEngageAddResource(courseId){
          if (!isCurrentUserAdmin()) return;
          openEditCourse(courseId);
          addCourseDraftResource();
        }

        // ---- Engage tab: everyone's Announcements (as before), plus --
        // for admins only -- a quick-reach list of every Quiz/Assignment/
        // Project already in this course, each opening straight into its
        // editor. Previously the only way to touch a quiz/assignment/
        // project was Manage Course > find the right module > find the
        // right Part, which is a lot of navigation for something admins
        // do often; this surfaces them all in one place on the course
        // screen itself. See courseEngageItems/openEngageItem below. ----
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

        // Jumps an admin straight from the Engage tab into editing one
        // specific quiz/assignment/project, skipping the module-list
        // screen entirely: loads the course into the same draft used by
        // Manage Course (openEditCourse) then immediately opens that
        // item's edit form (openEditCourseItemForm) on top of it.
        function openEngageItem(courseId, mi, ii){
          if (!isCurrentUserAdmin()) return;
          openEditCourse(courseId);
          openEditCourseItemForm(mi, ii);
        }

        // Quick-add shortcuts from the Engage tab -- same underlying
        // newCourseDraft/publishNewCourse pipeline as Manage Course (so a
        // module/item added this way shows up for students exactly the
        // same way once Published), just reached in one tap instead of
        // Course card > menu > Edit Course > scroll to find the right spot.
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

        // ---- Course Announcements (admin-posted updates shown to
        // everyone browsing the course, enrolled or not -- e.g. "Module 4
        // is now live" or "Deadline extended to Friday"). Kept separate
        // from the graded Module/Item curriculum and from Classes'
        // Google-Classroom-style stream, but styled the same way so it
        // feels consistent across the app. ----
        function courseEngageTabHTML(course){
          const list = course.announcements || [];
          const isAdmin = isCurrentUserAdmin();
          return `
            ${courseEngageQuizAssignmentSectionHTML(course)}
            ${isAdmin ? `
              <div class="bg-white rounded-3xl p-4 mb-4 shadow-sm border border-gray-100">
                <textarea id="course-announcement-input" oninput="courseAnnouncementDraft=this.value" placeholder="Share an update with everyone browsing this course..." class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none" rows="3">${escapeHtml(courseAnnouncementDraft)}</textarea>
                <button onclick="postCourseAnnouncement('${course.id}')" class="w-full mt-2 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white" style="background:${NAVY};">
                  ${Icon('plus','w-4 h-4')} Post Announcement
                </button>
              </div>` : ''}
            ${list.length ? list.slice().reverse().map((a, revIdx) => {
              const i = list.length - 1 - revIdx; // real index into course.announcements (list is shown newest-first)
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

        // ---- Quiz "final work" file submission ----
        // Separate from the auto-graded multiple-choice answers above --
        // this lets a learner attach the actual file (write-up, workbook,
        // etc.) their graded/practice quiz was asking them to produce, and
        // send it in through the app rather than by some outside channel.
        // Stored directly on the item (submissionUrl/submissionFileName),
        // uploaded the same way Part media is (uploadCourseItemMediaToStorage),
        // so it syncs to the shared course data instead of staying
        // local-only.
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

        // Local preview shows immediately (object URL) while the real file
        // uploads to Storage in the background, same pattern as Part media
        // uploads -- see handleAddingItemMediaSelected above.
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

        // ---- Create / Edit a Course (admin only) ----
        function openNewCourse(){
          if (!isCurrentUserAdmin()) return;
          resetNewCourseDraft();
          newCourseEditingId = null;
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = null;
          openOverlay('newCourse');
        }

        // Loads an existing course into the same draft/form used for
        // creating one, so admins can add/remove modules and items or
        // change the title/description without rebuilding the course from
        // scratch. publishNewCourse() below checks newCourseEditingId to
        // update the existing course in place instead of creating a new one.
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
          // Every small interaction on this screen (toggling course/resource
          // type, adding or removing a module/resource, picking a file to
          // upload) re-renders the whole editor via innerHTML, which used to
          // reset scroll to the top every time -- annoying on a long form
          // where those controls sit well below the fold. Capture the
          // scroll position of the editor's scroll container beforehand and
          // restore it right after, so the screen stays put.
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

        // ---- Course Resources (admin only) -- supplementary videos and
        // audio, separate from the graded Module/Item curriculum above.
        // Stored as a link (YouTube, Vimeo, a direct file host, etc.)
        // rather than an uploaded binary -- same reasoning as
        // materializeRemoteLectureFile in core.js: keeping large media out
        // of the jsonb blob this course is stored in.
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

        // Course-level items (assignments/projects/quizzes placed under
        // "Final Project" instead of inside a specific module) -- kept in
        // their own array so student-facing course detail can show them as
        // one final-project section rather than pretending they belong to
        // whichever module happens to be open. See setAddingItemPlacement
        // below for how a Part moves between a module and here.
        function removeCourseDraftFinalItem(ii){
          newCourseDraft.finalItems.splice(ii, 1);
          rerenderNewCourseOverlay();
        }

        function openAddCourseItemForm(mi){
          newCourseAddingItemModuleIndex = mi;
          newCourseEditingItemIndex = null;
          newCourseEditingItemOriginalPlacement = null;
          newCourseAddingItemDraft = { title:'', type:'video', duration:'', description:'', questions:[], mediaUrl:null, mediaType:null, mediaFileName:null, mediaUploading:false };
          rerenderNewCourseOverlay();
        }

        // Opens the same Add Part form, but for an assignment/project/quiz
        // that belongs to the course as a whole rather than any single
        // module -- defaults its type to Project since that's the most
        // common "final project" case, though any type in the placement
        // picker can still be chosen.
        function openAddFinalItemForm(){
          newCourseAddingItemModuleIndex = 'final';
          newCourseEditingItemIndex = null;
          newCourseEditingItemOriginalPlacement = null;
          newCourseAddingItemDraft = { title:'', type:'project', duration:'', description:'', questions:[], mediaUrl:null, mediaType:null, mediaFileName:null, mediaUploading:false };
          rerenderNewCourseOverlay();
        }

        // Admin editing an existing Part (video/reading/assignment/project/
        // quiz, etc.) inside a module -- reopens the same Add Part form,
        // pre-filled from the existing item, in edit mode.
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

        // Same as above, but for editing an item that's already placed
        // under Final Project instead of inside a module.
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

        // Called from the "Where should this go?" picker in the Add Part
        // form (assignment/project/quiz types only) -- just moves which
        // section the open form itself renders under; the actual item
        // doesn't move until confirmAddCourseItem saves it.
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

        // Picking a video/picture file shows an instant local preview
        // (object URL, so it appears immediately with no network wait)
        // while the real file uploads to Storage in the background;
        // mediaUrl gets swapped over to the permanent public URL once
        // that finishes -- see uploadCourseItemMediaToStorage above.
        function handleAddingItemMediaSelected(e){
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const d = newCourseAddingItemDraft;
          if (!d) return;
          // The Part's chosen type (video/picture) decides how the file is
          // treated -- not the raw mime type.
          d.mediaType = d.type === 'video' ? 'video' : 'image';
          d.mediaFileName = file.name;
          d.mediaUrl = URL.createObjectURL(file);
          d.mediaUploading = true;
          rerenderNewCourseOverlay();
          const itemId = 'item' + Date.now() + Math.random().toString(36).slice(2,6);
          d.pendingItemId = itemId;
          uploadCourseItemMediaToStorage(file, itemId).then(remoteUrl => {
            if (newCourseAddingItemDraft !== d) return; // form was cancelled/closed meanwhile
            if (remoteUrl) {
              d.mediaUrl = remoteUrl;
            } else {
              // Upload failed -- keep the local preview so it isn't lost,
              // but tell the admin now instead of letting them publish a
              // file that will look broken to everyone else. See the
              // COURSE_MEDIA_BUCKET comment above uploadCourseItemMediaToStorage.
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
          // Placement -- either a specific module's items array, or the
          // course-level finalItems array when placed under Final Project
          // (see setAddingItemPlacement/openAddFinalItemForm above).
          const targetList = newCourseAddingItemModuleIndex === 'final' ? newCourseDraft.finalItems : newCourseDraft.modules[newCourseAddingItemModuleIndex].items;
          if (newCourseEditingItemIndex !== null) {
            // Editing in place -- keep the original id, overwrite
            // everything else with the edited values. Completion itself
            // lives in courseItemCompletions (per-student), not on the
            // item, so there's nothing to carry over here.
            const originalList = newCourseEditingItemOriginalPlacement === 'final' ? newCourseDraft.finalItems : newCourseDraft.modules[newCourseEditingItemOriginalPlacement].items;
            const existing = originalList[newCourseEditingItemIndex];
            item.id = existing.id;
            if (originalList === targetList) {
              // Placement unchanged -- overwrite in place.
              targetList[newCourseEditingItemIndex] = item;
            } else {
              // Placement changed while editing (e.g. moved from a module
              // to Final Project, or vice versa) -- remove from where it
              // used to live and add it to its new home instead.
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

        // Leaving the editor (back arrow, or the phone/browser back
        // button -- see the 'newCourse' entry in overlayBackAction) used to
        // just close straight out, silently dropping whatever had been
        // typed. Mirrors the same title requirement publishNewCourse
        // already enforces on Save/Publish: no title means a warning
        // instead of letting the page close.
        function closeCourseEditorGuard(fromPopState){
          if (!newCourseDraft.title.trim()) {
            if (fromPopState) {
              // The hardware/browser back button has already popped our
              // history entry by the time this fires -- push it back on
              // so the editor stays open instead of actually navigating
              // away underneath the warning.
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
              // Keep the remote copy in sync too, same pattern as a
              // brand-new course below -- awaited now so we can warn if it
              // silently failed instead of assuming it always works.
              const synced = await postCourseInsertRemote(c);
              if (!synced) openAppAlertModal("Saved on this device, but couldn't sync to the shared course catalog -- it may not show up for other students or survive your next sign-in. Check the console for details.");
              // This course may have originated from a "Course" opportunity
              // listing (see createLinkedCourse in jobs.js), which keeps its
              // own title/org/description in sync with the course *only*
              // when the opportunity itself is edited (syncLinkedCourseMeta).
              // That's one-way -- editing the course here, as we just did,
              // never used to flow back to the linked opportunity, so the
              // Explore/Opportunities listing would keep showing stale
              // title/description text after an admin updated the course
              // straight from Courses. Push the fresh values back onto the
              // linked job now so both sides stay live.
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
            announcements: [], // admin-posted updates -- see courseEngageTabHTML
            teachers: [], // additional teachers invited on top of Stitch Team -- see openCourseTeachers
            // Fixed at creation time, same pattern as a class's
            // colorIndex/motifIndex -- never re-rolled on edit, since the
            // newCourseEditingId branch above only ever mutates fields it
            // explicitly lists.
            colorIndex: Math.floor(Math.random() * blueCardPalette.length),
            motifIndex: Math.floor(Math.random() * classCardMotifs.length),
          };
          allCourses.unshift(course);
          // Persist it so other users see it too, and so it's still there
          // the next time this admin signs in -- awaited so a failure can
          // actually be surfaced instead of quietly leaving the course
          // local-only (see the courses table SQL comment above).
          const synced = await postCourseInsertRemote(course);
          if (!synced) openAppAlertModal("This course was saved on this device only -- it couldn't sync to the shared catalog, so it will disappear next time you sign in and won't show up for other students. Check the console for the Supabase error, or make sure the courses table + policies from the SQL comment above are set up.");
          resetNewCourseDraft();
          closeOverlay();
          classroomAreaTab = 'courses';
          renderStudy();
        }

        // ---- Course Teachers (admin can invite additional teachers onto
        // a course; Stitch Team is always the base teacher and can't be
        // removed) ----
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
            // upsert, not insert: this is called both when a brand-new
            // course is published AND when an existing one is edited
            // (see publishNewCourse above). insert() would fail on the
            // primary-key conflict for every edit, so edits were silently
            // never reaching Supabase at all -- only ever changing the
            // in-memory copy in this one browser tab. created_by is only
            // set on first insert (course.id conflict keeps the original
            // author on later edits instead of overwriting it).
            const { error } = await sb.from(COURSES_TABLE).upsert({
              id: course.id,
              data: course,
              created_by: user ? user.id : null,
            }, { onConflict: 'id' });
            if (error) console.warn('Course did not sync to Supabase (see courses table SQL comment above):', error);
            return !error;
          } catch (e) { console.warn('Course sync threw an error:', e); return false; }
        }

        // Loads every course from Supabase into allCourses -- called once
        // on sign-in (see authEnterApp in games.js). Without this, courses
        // only ever existed in the browser tab that created/edited them:
        // publishing or editing a course wrote to Supabase (see
        // postCourseInsertRemote above) but nothing ever read it back, so
        // a page refresh -- or any other student's device -- never saw
        // it. row.data holds the full course shape (title/modules/etc);
        // row.id is kept as the source of truth for the id itself in case
        // it and data.id were ever to drift.
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

        // One Realtime subscription per signed-in session, same pattern as
        // subscribeToIncomingMessages in chat.js. Without this, a course
        // edit made in Manage Course only reached Supabase (via
        // postCourseInsertRemote) but any student already sitting on the
        // Courses screen wouldn't see it until their next sign-in, when
        // loadCoursesRemote runs again -- this pushes INSERT/UPDATE rows
        // straight into allCourses the instant an admin publishes, and
        // re-renders whichever course screen is actually on screen right
        // now (the catalog list on the Classroom tab, and/or an open
        // course detail overlay for that same course) so it updates live
        // with no refresh needed. Deletes are handled the same way so a
        // removed course also disappears live instead of lingering until
        // next sign-in.
        let coursesChannel = null;
        let coursesSubscribedForUserId = null;
        async function subscribeToCoursesRealtime(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (coursesChannel && coursesSubscribedForUserId === myId) return;
          if (coursesChannel) { try { sb.removeChannel(coursesChannel); } catch (e) { /* ignore */ } coursesChannel = null; }
          coursesSubscribedForUserId = myId;
          coursesChannel = sb.channel('courses-catalog')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: COURSES_TABLE }, (payload) => applyRemoteCourseChange(payload))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: COURSES_TABLE }, (payload) => applyRemoteCourseChange(payload))
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: COURSES_TABLE }, (payload) => applyRemoteCourseChange(payload))
            .subscribe();
        }

        // Fallback for when the `alter publication supabase_realtime add
        // table courses;` step (see the courses table SQL comment near the
        // top of this file) hasn't been run, or Realtime is otherwise
        // unavailable: re-pulls every course from Supabase every 30s and
        // re-renders whichever course screen is on-screen, the same way
        // applyRemoteCourseChange does. This is what makes a posted
        // announcement (or any other admin edit) reliably show up for
        // other signed-in students even if the instant Realtime push never
        // fires -- just with up to a 30s delay instead of immediately.
        let coursesPollInterval = null;
        function startCoursesPolling(){
          if (coursesPollInterval) return;
          coursesPollInterval = setInterval(async () => {
            const sb = getSupabaseClient();
            if (!sb) return;
            const before = JSON.stringify(allCourses.map(c => [c.id, (c.announcements || []).length, JSON.stringify(c.modules)]));
            await loadCoursesRemote();
            const after = JSON.stringify(allCourses.map(c => [c.id, (c.announcements || []).length, JSON.stringify(c.modules)]));
            if (before === after) return; // nothing changed, skip the re-render
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
          // Only touch the DOM for screens actually on-screen right now --
          // the Classroom tab's course catalog, and/or an open course
          // detail overlay for this same course.
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

        // Same best-effort pattern in reverse: a real delete needs its own
        // Postgres RLS "delete" policy on COURSES_TABLE restricted to
        // admins (mirroring the "insert" policy). With no backend
        // configured, or if the delete is rejected, this quietly no-ops --
        // the caller has already removed it from allCourses either way.
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

        // Course-level "Final Project" section, shown once below every
        // Module -- assignments/projects/quizzes placed here (via the
        // placement picker in addCourseItemFormHTML, or by opening this
        // section's own Add button) apply to the whole course rather than
        // any single module. Rendered the same row style as a module's
        // Parts, just sourced from newCourseDraft.finalItems instead.
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
          // Assignments/projects/quizzes are the types that can live either
          // inside a specific module or under the course-wide Final
          // Project section -- everything else (video/image/audio/
          // reading) stays lesson content tied to whichever module it was
          // added from.
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
                <button onclick="confirmAddCourseItem()" class="flex-1 rounded-xl py-2 font-semibold text-xs text-white" style="background:${NAVY};">${d.mediaUploading ? 'Uploading...' : (isEditing ? 'Save Changes' : 'Add')}</button>
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

        // ---------------- JOIN / CREATE CLASSROOM ----------------
        // Classes are real, shared rows in Supabase now -- a class is only
        // ever visible to its teacher and the accounts that have joined it
        // (its `members`), enforced server-side by Postgres row-level
        // security, not just hidden in the UI. Requires a `classes` table
        // in the configured Supabase project:
        //
        //   create table classes (
        //     id text primary key,
        //     code text unique not null,
        //     teacher_id uuid not null references auth.users(id) on delete cascade,
        //     members uuid[] not null default '{}',
        //     data jsonb not null,
        //     created_at timestamptz not null default now(),
        //     updated_at timestamptz not null default now()
        //   );
        //   alter table classes enable row level security;
        //
        //   create policy "Teacher and members can read their class"
        //     on classes for select
        //     using (auth.uid() = teacher_id or auth.uid() = any(members));
        //
        //   create policy "Signed-in users can create a class they teach"
        //     on classes for insert
        //     with check (auth.uid() = teacher_id);
        //
        //   create policy "Teacher and members can update class content"
        //     on classes for update
        //     using (auth.uid() = teacher_id or auth.uid() = any(members));
        //
        //   create policy "Teacher can delete their class"
        //     on classes for delete
        //     using (auth.uid() = teacher_id);
        //
        //   -- REQUIRED for "delete for everyone" to actually be live: the
        //   -- postgres_changes DELETE subscription below (see
        //   -- subscribeToClassesRealtime/applyRemoteClassDelete) only ever
        //   -- fires for tables added to Supabase's realtime publication.
        //   -- Without this, a teacher deleting their class still removes
        //   -- the row from Postgres (deleteCourseRemote-style best-effort
        //   -- delete), so the class is really gone -- but every student's
        //   -- app never hears about it and keeps showing it locally until
        //   -- they happen to refresh. Run this once per project:
        //   alter publication supabase_realtime add table classes;
        //
        //   -- Joining by code has to run as a function: the select policy
        //   -- above correctly stops a non-member from reading a class it
        //   -- hasn't joined yet, which means the client can never look one
        //   -- up by code to add itself as a member. This function runs
        //   -- with elevated privileges just long enough to do that one
        //   -- narrow thing -- look up a class by its code and add the
        //   -- caller to `members` -- without ever exposing classes the
        //   -- caller isn't in.
        //   create or replace function join_class_by_code(p_code text)
        //   returns classes
        //   language plpgsql
        //   security definer
        //   set search_path = public
        //   as $$
        //   declare
        //     result classes;
        //     joiner_email text := auth.email();
        //     joiner_name text := split_part(coalesce(joiner_email, 'Student'), '@', 1);
        //   begin
        //     if auth.uid() is null then
        //       raise exception 'Not signed in';
        //     end if;
        //     update classes
        //       set members = array_append(members, auth.uid()),
        //           data = jsonb_set(
        //             data, '{students}',
        //             coalesce(data->'students', '[]'::jsonb) ||
        //               jsonb_build_object('id', auth.uid(), 'name', joiner_name, 'email', joiner_email)
        //           ),
        //           updated_at = now()
        //       where code = p_code
        //         and teacher_id <> auth.uid()
        //         and not (auth.uid() = any(members))
        //       returning * into result;
        //     if result.id is null then
        //       -- already a member (or the teacher) -- just return it as-is
        //       -- so re-submitting a code you already joined isn't an error.
        //       select * into result from classes
        //         where code = p_code and (teacher_id = auth.uid() or auth.uid() = any(members));
        //     end if;
        //     return result;
        //   end;
        //   $$;
        //   revoke all on function join_class_by_code(text) from public;
        //   grant execute on function join_class_by_code(text) to authenticated;
        //
        //   -- Removes the caller from a class's members array ("Leave
        //   -- class"). A teacher can't leave their own class this way --
        //   -- see deleteClassRemote below, which uses the delete policy.
        //   create or replace function leave_class(p_id text)
        //   returns void
        //   language plpgsql
        //   security definer
        //   set search_path = public
        //   as $$
        //   begin
        //     update classes set members = array_remove(members, auth.uid()), updated_at = now()
        //       where id = p_id and auth.uid() = any(members);
        //   end;
        //   $$;
        //   revoke all on function leave_class(text) from public;
        //   grant execute on function leave_class(text) to authenticated;
        let classesChannel = null;
        let classesSubscribedForUserId = null;
        // Live top-up for deletions specifically: a teacher deleting their
        // own class (leaveCurrentClass, role==='teacher') removes the row
        // outright, but every student who had it in their local myClasses
        // list otherwise wouldn't find out until they happened to reopen
        // it or resync -- "delete everything and remove everyone" needs
        // this to actually be live, not just eventually-consistent. Scoped
        // to DELETE only (membership/content updates already re-render
        // from queueSaveClassRemote's own round-trip when you're looking
        // at that class yourself).
        async function subscribeToClassesRealtime(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (classesChannel && classesSubscribedForUserId === myId) return;
          if (classesChannel) { try { sb.removeChannel(classesChannel); } catch (e) { /* ignore */ } classesChannel = null; }
          classesSubscribedForUserId = myId;
          classesChannel = sb.channel('classes-catalog:' + myId)
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: CLASSES_TABLE }, (payload) => applyRemoteClassDelete(payload))
            // UPDATE was previously missing entirely: a teacher starting a
            // lecture, posting an announcement, or changing anything else
            // about the class only ever reached Supabase (via
            // queueSaveClassRemote) -- any student who already had the
            // class loaded in myClasses (i.e. everyone, since loadMyClasses
            // runs once at sign-in) never found out until their next
            // sign-in. That's a big part of why "Start Lecture" never
            // actually reached students: the lecture got added to the
            // teacher's local cls.lectures and pushed to Supabase, but
            // every student's local copy of that same class simply didn't
            // have it, so their Stream tab never showed a "Live now" card
            // to join. This keeps every member's local copy live.
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: CLASSES_TABLE }, (payload) => applyRemoteClassUpdate(payload))
            .subscribe();
        }

        // Merges a remote class row update into the matching local
        // myClasses entry (id/code/teacherId/role never change here, only
        // the shared `data` blob and the `members` list do), then
        // re-renders whatever's actually on screen for that class right
        // now -- the class detail overlay if it's open, and/or the Stream
        // tab's live lecture list. Ignored entirely if this account isn't
        // in that class locally (nothing to merge into).
        function applyRemoteClassUpdate(payload){
          const row = payload && payload.new;
          if (!row || !row.id) return;
          const idx = myClasses.findIndex(c => c.id === row.id);
          if (idx === -1) return;
          const prev = myClasses[idx];
          // Only students get alerted about classroom activity here -- the
          // teacher who just posted the announcement/classwork already
          // knows about it (this update round-trips back to them too,
          // since Postgres realtime doesn't distinguish who caused it).
          const notifyMe = prev.role !== 'teacher';
          const prevAnnouncementIds = notifyMe ? new Set((prev.announcements || []).map(a => a.id)) : null;
          const prevClassworkIds = notifyMe ? new Set((prev.classwork || []).map(w => w.id)) : null;
          myClasses[idx] = Object.assign({}, prev, row.data || {}, {
            id: prev.id, code: prev.code, teacherId: prev.teacherId, role: prev.role,
            members: Array.isArray(row.members) ? row.members : (prev.members || []),
          });
          const updated = myClasses[idx];
          // Sync every classroom alert (new announcement, new classwork)
          // into the same Notifications bell tab everything else uses --
          // this is on top of the existing "Live now" lecture ring, which
          // already has its own dedicated notification path.
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
          // Re-render the class detail overlay (Stream/Classwork/People) if
          // it's open on this same class, same pattern as
          // applyRemoteCourseChange -- this is what flips a lecture card
          // from "Start now" to "Live now"/"Join" without a manual refresh,
          // and is the fallback path if a lecture ring (see
          // ringClassMembersForLecture) never arrived for some reason.
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
          // If it's the exact class currently open, kick back out with a
          // heads-up instead of leaving them staring at a now-nonexistent
          // classroom (or letting them keep typing into it).
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

        // Turns a `classes` row into the shape the rest of this file
        // already expects on a myClasses entry (name/section/announcements/
        // etc, spread out of `data`, plus id/code/teacherId/role layered
        // on top) -- role is derived from teacher_id so it can never be
        // spoofed by tampering with local state.
        // Guarantees every field the class-detail views (classStreamTabHTML,
        // classworkTabHTML, classPeopleTabHTML, etc.) read off a class
        // object unconditionally -- announcements.length, classwork.map,
        // lectures.filter, and so on. `row.data` is a jsonb column and can
        // legitimately come back null/partial (a class row inserted before
        // a field existed, or a join_class_by_code() row where `data`
        // hasn't been backfilled yet), and Object.assign alone doesn't
        // fill in anything missing from it. Left unguarded, opening a
        // class like that throws mid-render (e.g. "Cannot read properties
        // of undefined (reading 'length')" in classStreamTabHTML) -- and
        // because that happens inside the awaited step of the "Adding you
        // to class..." loading sequence in submitJoinClassroom, the error
        // aborts the await chain before the loading overlay ever gets
        // torn down, so it just spins forever instead of surfacing an
        // error.
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
            // Carried over so a teacher starting a lecture can ring every
            // student directly (see ringClassMembersForLecture) without a
            // separate round-trip to fetch the roster first.
            members: Array.isArray(row.members) ? row.members : [],
            // Any array field can independently come back non-array from
            // a stale/partial `data` blob (e.g. null instead of just
            // missing) -- Object.assign's defaults above only cover keys
            // that are absent entirely, not ones present but wrong-typed.
            announcements: Array.isArray(data.announcements) ? data.announcements : [],
            classwork: Array.isArray(data.classwork) ? data.classwork : [],
            lectures: Array.isArray(data.lectures) ? data.lectures : [],
            students: Array.isArray(data.students) ? data.students : [],
            coTeachers: Array.isArray(data.coTeachers) ? data.coTeachers : [],
          });
        }

        // Loads every class this signed-in account can see -- thanks to
        // the RLS policy above, a plain select() already comes back
        // filtered to just "I teach it" or "I'm a member", so there's no
        // extra client-side filtering needed (or possible to get wrong).
        async function loadMyClasses(){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const { data, error } = await sb.from(CLASSES_TABLE).select('*');
            if (error || !data) return;
            myClasses = data.map(row => classRowToLocal(row, me.id));
          } catch (e) { /* no backend configured yet, or table not set up */ }
        }

        // Debounced best-effort sync of a class's content (announcements,
        // classwork, lectures, roster, settings) back to its shared row,
        // same pattern as queueSaveUserState -- so a change a teacher or
        // student makes is what other members actually see, instead of
        // only living in the browser tab that made it. Keyed per class id
        // so edits to two different classes in quick succession don't
        // clobber each other's debounce timers.
        const classSaveTimers = {};
        function queueSaveClassRemote(cls){
          if (!cls || !cls.id) return;
          if (classSaveTimers[cls.id]) clearTimeout(classSaveTimers[cls.id]);
          classSaveTimers[cls.id] = setTimeout(() => saveClassRemoteNow(cls), 800);
        }
        async function saveClassRemoteNow(cls){
          const sb = getSupabaseClient();
          if (!sb) return;
          // Only the fields that live in `data` -- id/code/teacherId/role
          // are either the primary key or derived, and shouldn't be
          // written back as part of the jsonb blob.
          const { id, code, teacherId, role, ...data } = cls;
          try {
            await sb.from(CLASSES_TABLE).update({ data, updated_at: new Date().toISOString() }).eq('id', cls.id);
          } catch (e) { console.warn('Saving class failed (will retry on next change):', e); }
        }
        // Loaded fresh from Supabase on every sign-in (loadMyClasses above)
        // -- starts empty so there's something defined for the rest of
        // this file to read/push into before that first load completes.
        let myClasses = []; // { id, name, section, subject, code, teacherId, role, students:[{name,email}], ... }
        let currentClassId = null;
        let classDetailTab = 'stream'; // 'stream' | 'classwork' | 'people'
        let classDetailMenuOpen = false;
        let inviteEmailsDraft = '';

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
            <div class="w-full px-5 pb-3 relative" style="padding-top:20px;">
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
            <div class="w-full px-5 pb-3 relative" style="padding-top:20px;">
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

        // ---------------- CLASS CREATE/JOIN LOADING (mirrors the Classroom-tab
        // and exam "loading then slide-away" curtain pattern) ----------------
        let classActionLoadToken = 0;

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

        // Shows the loading curtain in the overlay, runs onDone (which should
        // populate data and render the final overlay content), then slides
        // the curtain away to reveal it underneath.
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
            // onDone may be async (e.g. it needs to hit Supabase first) --
            // await it so the curtain doesn't slide away and reveal stale
            // or empty content underneath before the real data has landed.
            // If it throws (e.g. bad/partial data crashing a render
            // function), the curtain must still come down instead of
            // spinning forever -- surface an error and close the overlay
            // rather than leaving the user stuck on the loading screen.
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

        // Joining now goes through the join_class_by_code() function (see
        // the schema comment above myClasses) instead of searching this
        // browser's own local list -- that's what actually makes joining
        // a class someone else created possible at all, and it only ever
        // works if the code is real: an unknown or mistyped code comes
        // back with no row, same error message as before.
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
            // members starts empty -- the teacher is already covered by
            // teacher_id in the RLS policies, no need to also list them
            // as a member.
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

        // Classes (as opposed to self-paced Courses, which already use
        // TEAM_STITCH_TEACHER above) show the actual teacher's name to a
        // teacher looking at their own class, but a student should just
        // see "Stitch Team" -- same convention as the Courses area.
        function classTeacherDisplayName(cls){
          if (cls && cls.role === 'teacher') return (profileData.name || '').trim() || 'You';
          const cached = cls && classTeacherProfiles[cls.teacherId];
          if (cached && cached.name) return cached.name;
          return 'Stitch Team';
        }

        // Real per-teacher public profile (name + photo), keyed by
        // teacherId, for students looking at someone else's class --
        // teacherId is a genuine auth user id (see classRowToLocal above),
        // so this is a real lookup against public_profiles, not a guess.
        // Cached so switching tabs/re-rendering doesn't re-fetch.
        let classTeacherProfiles = {};
        async function loadClassTeacherProfile(cls){
          if (!cls || cls.role === 'teacher' || !cls.teacherId) return;
          if (classTeacherProfiles[cls.teacherId]) return; // already loaded (or loading)
          classTeacherProfiles[cls.teacherId] = {}; // placeholder so we don't fire twice
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
          } catch (e) { /* keep the placeholder -- falls back to "Stitch Team" */ }
        }

        // Real photo for whoever's "the teacher" in this class -- your own
        // for a class you teach, or the real teacher's (once loaded by
        // loadClassTeacherProfile) for a class you're a student in.
        // Falls back to a generic silhouette only until that resolves.
        function classTeacherAvatarHTML(cls, sizeClass){
          const photo = cls && cls.role === 'teacher'
            ? profileData.photo
            : (cls && classTeacherProfiles[cls.teacherId] && classTeacherProfiles[cls.teacherId].photo);
          return photo ? `<img src="${photo}" class="w-full h-full object-cover">` : Icon('user', sizeClass);
        }

        // ---------------- CLASS DETAIL (Google Classroom-style) ----------------
        function openClassDetail(id){
          currentClassId = id;
          classDetailTab = 'stream';
          classDetailMenuOpen = false;
          openOverlay('classDetail');
          const cls = myClasses.find(c => c.id === id);
          if (cls) loadClassTeacherProfile(cls);
        }

        // A teacher "leaving" their own class deletes it for everyone
        // (there'd be no teacher left otherwise); a student leaving just
        // removes themself from `members` via leave_class(), same
        // security-definer pattern as joining. Either way the local list
        // updates immediately and the remote change is best-effort behind
        // it, same as the rest of this app's save calls.
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

        // Cancel enrollment in a course that was enrolled into from the
        // Explore/Opportunities tab (see enrollCourseIntoClassroom in
        // jobs.js), which mints a real myClasses entry for it. This ends
        // that session the same way leaveCurrentClass() does, and also
        // clears the classId/status off the original job application so
        // the Explore listing goes back to showing "Enroll" instead of
        // "Go to Classroom".
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

        // Wrapper functions instead of building the modal's title/message by
        // concatenating cls.name straight into an onclick="..." attribute
        // string (see below) -- if a class name contains an apostrophe (or
        // certain other characters), that concatenation produces invalid
        // JS inside the attribute, and the button just silently does
        // nothing when tapped -- no error shown, looks "broken" for no
        // obvious reason. Reading cls.name from here, as real JS, sidesteps
        // that entirely regardless of what characters the name contains.
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
          // The Dashboard tab is for admins looking at a classroom they
          // teach -- a plain teacher (non-admin) still just gets the
          // regular Stream/Classwork/People tabs.
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
                <div class="flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1">
                  ${showAdminDashboard ? classDetailTabBtn('dashboard','Dashboard') : ''}
                  ${classDetailTabBtn('stream','Stream')}
                  ${classDetailTabBtn('classwork','Classwork')}
                  ${classDetailTabBtn('people','People')}
                </div>
                ${classDetailTab === 'dashboard' && showAdminDashboard ? classDashboardTabHTML(cls) : ''}
                ${classDetailTab === 'stream' ? classStreamTabHTML(cls) : ''}
                ${classDetailTab === 'classwork' ? classClassworkTabHTML(cls) : ''}
                ${classDetailTab === 'people' ? classPeopleTabHTML(cls) : ''}
              </div>
            </div>`;
        }

        // ---- Admin Dashboard (visible to site admins inside a classroom
        // they teach): an at-a-glance overview plus one-tap shortcuts to
        // the actions they reach for most, so they don't have to hunt
        // through Stream/Classwork/People to manage the class. ----
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

        // Class stream (announcements + their comments) used to stamp
        // every one with the literal string 'now' at creation time and
        // never touch it again -- so a comment from an hour ago still
        // read "now" forever, same bug the notifications bell had before
        // formatNotifTime/createdAt fixed it there (see overlays.js).
        // This reuses that same formatter against a real createdAt
        // timestamp instead. `item.time === 'now'` is a fallback for
        // announcements/comments already saved under the old scheme,
        // before they had a createdAt at all -- treated as "just now"
        // once and then ages normally like everything else from here on.
        function formatClassStreamTime(item){
          if (item.createdAt) return formatNotifTime(item.createdAt);
          return item.time || 'now';
        }

        // Mirrors startNotifTimeTicker (overlays.js): walks whatever
        // announcement/comment time labels are currently on screen and
        // refreshes their text in place every 30s, without a full
        // re-render (which would cost scroll position mid-read). Safe to
        // call on every classStreamTabHTML render -- setInterval only
        // actually gets created once.
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
              <button onclick="openNewAnnouncementOverlay()" class="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white" style="background:rgba(30,144,255,0.5);">New announcement</button>
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

        // Read-only attachment chips shown under a posted announcement
        // (tapping one opens the staged blob URL in a new tab).
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

        // Renders the "Class comments" thread beneath a stream announcement,
        // plus an input box to add a new one, mirroring the Google
        // Classroom comment section (name + time + text, then a text box
        // with a send button).
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

        // Reposting a class-stream announcement: pushes a copy into
        // feedPosts (marked reposted:true) so it shows up in the main
        // feed and under the "Reposts" pill on the profile page, exactly
        // like reposting a regular feed post. Toggling it off removes
        // that copy again.
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
            // PostsAPI.create() already ran synchronously by this point (see
            // mockRequest), so the post's real id is available immediately;
            // .then() here just reads that same value back out.
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
          // Without this, the comment only ever existed in this device's
          // local copy of `cls` -- it never reached Supabase, so no other
          // member's app (including this same account on another device)
          // would ever see it. This is what makes comments "live": it
          // pushes the updated announcements array up, and every other
          // member's subscribeToClassesRealtime/applyRemoteClassUpdate
          // picks the change up and re-renders if they have this class's
          // Stream open.
          queueSaveClassRemote(cls);
        }

        // ---------------- LECTURES: Start Live / Schedule (teacher-only controls) ----------------
        // Two pill buttons shown right under the class banner, mirroring the
        // Stream/Classwork/People tab style: one drops the teacher straight
        // into a live, Zoom-style session; the other schedules a future one.
        function lectureActionPillsHTML(){
          return `
            <div class="flex gap-2 mb-4">
              <button onclick="startLiveLectureNow()" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-white border border-gray-300">${Icon('video','w-4 h-4')} Start Lecture</button>
              <button onclick="openScheduleLectureOverlay()" class="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-white border border-gray-300">${Icon('calendar','w-4 h-4')} Schedule Lecture</button>
            </div>`;
        }

        // Lists live + upcoming lectures at the top of the Stream tab so
        // students can see and join them too, not just the teacher.
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
                  ? `<button onclick="joinLiveLecture('${l.id}')" class="text-xs font-bold px-3 py-2 rounded-full bg-white text-[${NAVY}] flex-shrink-0">Join</button>`
                  : (isTeacher ? `<button onclick="startScheduledLectureNow('${l.id}')" class="text-xs font-bold px-3 py-2 rounded-full text-white flex-shrink-0" style="background:${NAVY};">Start now</button>` : '')}
              </div>
              ${!isLive && isTeacher ? `<button onclick="cancelScheduledLecture('${l.id}')" class="text-xs font-semibold text-red-500 mt-2">Cancel</button>` : ''}
            </div>`;
        }

        // ---------------- LIVE LECTURE (Zoom-style call screen) ----------------
        // view: 'grid' (participant tiles) | 'whiteboard' | 'slides'
        let liveLectureState = { classId: null, lectureId: null, connected: false, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid' };
        let lectureTickInterval = null;
        let lectureLocalStream = null; // real camera/mic, same approach as the 1:1 call
        let lectureMoreSheetOpen = false;
        let lectureReactionsSheetOpen = false;
        let lectureFloatingReactions = []; // { id, emoji } bursts shown briefly over the stage
        let lectureCommentSheetOpen = false;
        let lectureFloatingComments = []; // { id, text, name } comment bubbles shown briefly over the stage, seen by everyone
        let lectureAttachments = []; // { id, name, kind: 'doc'|'photo'|'video' } attached via the More menu
        let lectureResourcesPanelOpen = false; // slide-in panel listing every uploaded resource for this lecture
        // While a live lecture is open, the Classroom right panel's usual
        // "Notebook" mode is relabelled "Class Pad" instead (see
        // rightPanelTitle/rightPanelNotebookHTML) -- same notes feature,
        // just under the name that fits the in-lecture context.
        let inLectureCall = false;
        // While a practice exam (or quiz/challenge using the shared exam
        // engine) is open, the Classroom right *panel* relabels itself
        // "Annotate" -- the side-rail "Notebook" nav button stays put.
        // renderExamTake()/closeOverlay() flip this via setNotebookNavLabel().
        let inExamAnnotate = false;

        function clearLectureTimer(){
          if (lectureTickInterval) { clearInterval(lectureTickInterval); lectureTickInterval = null; }
        }

        function escapeHtml(str){
          return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        // For strings that get embedded inside an inline event-handler
        // attribute as a JS string literal, e.g. onclick="doThing('${x}')".
        // escapeHtml() alone is NOT enough here: the browser HTML-decodes
        // the attribute value *before* handing it to the JS parser, so an
        // escaped quote like &#39; comes back out as a literal ' and can
        // still break out of the string / attribute. This first escapes
        // the value so it's safe as JS-string content, then HTML-escapes
        // that result so it survives being an HTML attribute value too.
        // Renders an Icon()/IconBold() svg string with the Dodger Blue ->
        // Royal Blue brand gradient (see the #navyRoyalGrad def near the
        // top of <body>) instead of a flat currentColor fill/stroke.
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

        // ---- Lecture ringing (teacher -> every student in the class) ----
        // Starting a lecture previously only wrote it into cls.lectures and
        // saved it to Supabase -- there was no notification of any kind, so
        // a call in the classroom section never actually "went through" to
        // students the way a 1:1 call does. This mirrors the 1:1 call ring
        // pattern in chat.js (subscribeToIncomingCalls/sendCallRing) but
        // fans a single ring out to every member of the class instead of
        // one other person, so every student gets an Accept/Decline sheet
        // the instant the teacher starts (or resumes) a lecture -- tapping
        // Accept drops them straight into joinLiveLecture(), same as
        // tapping "Join" on the Stream tab card.
        let incomingLectureCallChannel = null;
        let incomingLectureCallSubscribedForUserId = null;
        let incomingLectureCallInfo = null; // { classId, className, lecture, callerName, callerPhoto }
        let incomingLectureCallRingTimeout = null;

        async function subscribeToIncomingLectureCalls(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (incomingLectureCallChannel && incomingLectureCallSubscribedForUserId === myId) return;
          if (incomingLectureCallChannel) { try { sb.removeChannel(incomingLectureCallChannel); } catch (e) { /* ignore */ } incomingLectureCallChannel = null; }
          incomingLectureCallSubscribedForUserId = myId;
          incomingLectureCallChannel = sb.channel('incoming-lecture-calls:' + myId, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'ring' }, ({ payload }) => handleIncomingLectureRing(payload))
            .subscribe();
        }

        // One-shot broadcast to a single student's ring inbox -- same
        // disposable-channel trick as broadcastToUserChannel in chat.js.
        function broadcastLectureRingToUser(userId, payload){
          const sb = getSupabaseClient();
          if (!sb || !userId) return;
          const ch = sb.channel('incoming-lecture-calls:' + userId, { config: { broadcast: { self: false } } });
          ch.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              ch.send({ type: 'broadcast', event: 'ring', payload });
              setTimeout(() => { try { sb.removeChannel(ch); } catch (e) { /* ignore */ } }, 1000);
            }
          });
        }

        // Rings every student in the class (cls.members -- populated by the
        // join_class RPC, see the CLASSES_TABLE SQL comment above; the
        // teacher is never in it, so no need to filter self out here, but
        // co-teachers joining as a "member" are excluded defensively too).
        async function ringClassMembersForLecture(cls, lecture){
          const members = Array.isArray(cls.members) ? cls.members : [];
          if (!members.length) return; // nobody's joined the class yet
          const myId = await getCurrentUserId();
          const callerName = (typeof profileData !== 'undefined' && profileData.name) || 'Your teacher';
          const callerPhoto = (typeof profileData !== 'undefined' && profileData.photo) || null;
          const lecturePayload = { id: lecture.id, title: lecture.title, date: lecture.date, time: lecture.time };
          members.forEach(uid => {
            if (!uid || uid === myId) return;
            broadcastLectureRingToUser(uid, { classId: cls.id, className: cls.name, lecture: lecturePayload, callerName, callerPhoto });
            // Same reasoning as sendCallRing in chat.js: the broadcast only
            // reaches students actively signed in with the app open right
            // now -- this also lets anyone with the app closed find out.
            sendPushTo(uid, {
              title: `${callerName} started a lecture in ${cls.name}`,
              body: lecture.title || 'Live lecture',
              tag: 'lecture-' + lecture.id,
              data: { kind: 'lecture', classId: cls.id, lectureId: lecture.id },
            });
          });
        }

        // A teacher just started/resumed a lecture we're a member of. If
        // we're already on a call or already mid-ring for another lecture,
        // skip it silently rather than stacking sheets. Also skips if
        // we're already connected to this exact lecture (e.g. we joined
        // from the Stream tab a moment before the ring landed).
        function handleIncomingLectureRing(payload){
          if (!payload || !payload.classId || !payload.lecture || !payload.lecture.id) return;
          if (typeof callState !== 'undefined' && callState.convoId) return;
          if (incomingLectureCallInfo) return;
          if (liveLectureState.connected && liveLectureState.lectureId === payload.lecture.id) return;
          incomingLectureCallInfo = payload;
          openOverlay('incomingLectureCall');
          clearTimeout(incomingLectureCallRingTimeout);
          incomingLectureCallRingTimeout = setTimeout(() => declineIncomingLectureCall(), 45000);
          // Also logged to the Notifications bell tab, same as every
          // other classroom alert -- so a lecture that was missed/
          // declined (or rang while this account was signed in on
          // another device) still shows up as a real record here, not
          // just as a ring sheet that came and went.
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
          // The class's local lectures list might not have caught up yet
          // (applyRemoteClassUpdate should normally beat the ring here,
          // but don't depend on ordering) -- make sure the lecture we were
          // just rung about actually exists locally before joining it.
          if (!cls.lectures) cls.lectures = [];
          const existing = cls.lectures.find(l => l.id === lecture.id);
          if (existing) existing.status = 'live';
          else cls.lectures.unshift(Object.assign({ status: 'live' }, lecture));
          currentClassId = classId;
          joinLiveLecture(lecture.id);
        }

        // fromPopState is threaded through to closeOverlay -- same reason
        // as declineIncomingCall's in chat.js.
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
            <div class="flex-1 flex flex-col text-white" style="padding-top:20px;background:linear-gradient(160deg, ${NAVY}, ${ROYAL});">
              <div class="flex-1 flex flex-col items-center justify-center px-6">
                <div class="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center mb-5" style="background:rgba(255,255,255,0.15);">
                  ${info.callerPhoto ? `<img src="${escapeHtml(info.callerPhoto)}" class="w-full h-full object-cover">` : Icon('video','w-14 h-14')}
                </div>
                <div class="text-2xl font-bold font-display mb-1 text-center">${escapeHtml(info.className || 'Class Lecture')}</div>
                <div class="text-sm text-white/70 text-center">${escapeHtml(info.callerName || 'Your teacher')} started "${escapeHtml(lecture.title || 'Live Lecture')}"</div>
              </div>
              <div class="flex-shrink-0 flex items-center justify-center" style="gap:20px;padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 10px);">
                <button onclick="declineIncomingLectureCall()" title="Decline" class="rounded-full flex items-center justify-center shadow-lg" style="width:44px;height:44px;background:#ef4444;">${Icon('phoneHangup','w-5 h-5')}</button>
                <button onclick="acceptIncomingLectureCall()" title="Join lecture" class="rounded-full flex items-center justify-center shadow-lg" style="width:44px;height:44px;background:#10b981;">${Icon('video','w-5 h-5')}</button>
              </div>
            </div>`;
        }

        async function joinLiveLecture(id){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const l = (cls.lectures || []).find(x => x.id === id);
          if (!l) return;
          clearLectureTimer();
          stopLectureLocalStream();
          // Fresh session: clear any whiteboard drawings/slides left over
          // from a previous lecture, and release any object URLs created
          // for previously attached/previewed files.
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
          liveLectureState = { classId: cls.id, lectureId: id, connected: true, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid', mediaError: null };
          openOverlay('lectureCall');
          joinLectureSignaling(id);

          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              lectureLocalStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
              if (liveLectureState.lectureId !== id) { stopLectureLocalStream(); return; }
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
          }, 1000);
        }

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
            // Camera on/off is the one case that genuinely has to swap
            // what's displayed (video vs. placeholder avatar), but it only
            // needs to touch the local tile's media slot - the rest of the
            // grid, the header, and the control bar stay untouched.
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
          // Only burst on the rising edge (hand going up), not when it's
          // lowered again -- and reuse the exact same Reactions flow
          // (local echo + broadcast) as the emoji reactions, just bigger,
          // so everyone in the lecture sees it too.
          if (liveLectureState.handRaised) {
            const id = 'r' + Date.now() + Math.random().toString(36).slice(2);
            addLectureFloatingReaction(id, 'handRaised', (profileData && profileData.name) || 'You', true);
            broadcastLectureSignal({ type: 'reaction', id, icon: 'handRaised', name: (profileData && profileData.name) || 'Someone', big: true });
          }
          updateLectureLocalBadges();
          updateLectureControlBarButtons();
          updateLecturePresenceTrack();
        }

        // Re-publishes this participant's mute/camera/hand state via
        // Presence so every other tile in the grid (see lectureGridHTML)
        // shows accurate badges for you, instead of the old hard-coded
        // "always muted" placeholder.
        function updateLecturePresenceTrack(){
          if (!lectureChannel || !myLecturePeerId) return;
          lectureChannel.track({ name: (profileData && profileData.name) || 'Student', photo: (profileData && profileData.photo) || null, muted: liveLectureState.muted, camOff: liveLectureState.camOff, handRaised: liveLectureState.handRaised, isTeacher: lectureIsTeacher() });
        }

        // Refreshes just the small overlay badges on the local camera tile
        // (mute/camera-off/hand-raised icons) without ever touching the
        // <video> element sitting right next to them.
        function updateLectureLocalBadges(){
          const el = document.getElementById('lecture-local-badges');
          if (el) el.innerHTML = lectureLocalBadgesHTML();
        }

        // Refreshes only the control-bar button appearance (icon + active
        // styling) for camera/mute/hand/more, in place, instead of
        // re-rendering the whole lecture screen every time one is tapped.
        function updateLectureControlBarButtons(){
          const inactiveControlClass = 'bg-white text-gray-600 shadow-sm';
          const activeControlClass = 'bg-blue-600 text-white';
          const camBtn = document.getElementById('lecture-cam-btn');
          if (camBtn) {
            camBtn.className = `w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.camOff ? activeControlClass : inactiveControlClass}`;
            camBtn.title = liveLectureState.camOff ? 'Turn camera on' : 'Turn camera off';
            camBtn.innerHTML = Icon(liveLectureState.camOff ? 'cameraOff' : 'video','w-4 h-4');
          }
          const muteBtn = document.getElementById('lecture-mute-btn');
          if (muteBtn) {
            muteBtn.className = `w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.muted ? activeControlClass : inactiveControlClass}`;
            muteBtn.title = liveLectureState.muted ? 'Unmute' : 'Mute';
            muteBtn.innerHTML = Icon(liveLectureState.muted ? 'micOff' : 'mic','w-4 h-4');
          }
          const handBtn = document.getElementById('lecture-hand-btn');
          if (handBtn) {
            handBtn.className = `w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.handRaised ? 'text-white' : inactiveControlClass}`;
            handBtn.style.background = liveLectureState.handRaised ? NAVY : '';
          }
          const moreBtn = document.getElementById('lecture-more-btn');
          if (moreBtn) moreBtn.className = `w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${lectureMoreSheetOpen ? activeControlClass : inactiveControlClass}`;
        }

        // Refreshes just the floating Reactions/More sheets (and their
        // dimmed backdrop) without rebuilding the grid/whiteboard/slides
        // stage sitting underneath them.
        function updateLectureSheetsRegion(){
          const el = document.getElementById('lecture-sheets-region');
          if (el) el.innerHTML = lectureSheetsRegionHTML(liveLectureState.view);
          updateLectureControlBarButtons();
        }

        // ---- Mobile call bar: "Reactions" and "More" bottom sheets ----
        // Mirrors the reference: the main bar only shows End / Reactions /
        // Mute / Raise hand / More, and everything else (camera, whiteboard,
        // present slides) lives behind the More sheet.
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

        // "T" button in the More sheet -- lets anyone (student or teacher)
        // type a quick comment during the lecture that everyone else in
        // the call sees too, mirroring the Reactions flow (local echo +
        // broadcast) below.
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
          // On desktop, Class Pad lives in the static right-hand panel
          // (matching Profile/Discover/Notebook/File) instead of the
          // mobile-style slide-in overlay, so it opens there rather than
          // floating over the lecture stage.
          if (window.innerWidth >= 1024) {
            if (rightPanelMode === 'notebook') closeRightPanel();
            else openRightPanel('notebook');
            return;
          }
          closeLectureSheets();
          lectureResourcesPanelOpen = !lectureResourcesPanelOpen;
          rerenderLectureScreen();
        }

        // Reactions used to only ever be added to this participant's own
        // lectureFloatingReactions and re-rendered locally -- nothing was
        // ever sent over the lecture channel, so nobody else in the call
        // ever actually saw a reaction someone tapped. Now it both shows
        // locally right away (no round-trip delay for the sender) and
        // broadcasts to every other participant so it shows up on their
        // screens too, same as the whiteboard/attachment signals.
        function sendLectureReaction(icon){
          const id = 'r' + Date.now() + Math.random().toString(36).slice(2);
          addLectureFloatingReaction(id, icon, (profileData && profileData.name) || 'You');
          lectureReactionsSheetOpen = false;
          broadcastLectureSignal({ type: 'reaction', id, icon, name: (profileData && profileData.name) || 'Someone' });
        }

        // `big` renders this burst larger than a normal tap reaction --
        // used for the raised-hand burst below so it stands out from a
        // regular clap/heart/etc. reaction, while riding the exact same
        // local-echo + broadcast flow as the rest of the Reactions feature.
        function addLectureFloatingReaction(id, icon, name, big){
          lectureFloatingReactions.push({ id, icon, name, big: !!big });
          // Only touch the floating-bubble layer itself, not the whole
          // lecture screen -- rerenderLectureScreen() replaces the entire
          // #lecture-call-screen (video tiles included), which was making
          // the video visibly shake/flicker every time a reaction fired.
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

        // Comments typed via the "T" button -- same local-echo + broadcast
        // pattern as reactions above, but shown as a short-lived text
        // bubble (longer on-screen than a reaction burst, since there's
        // text to read) so every participant sees what was typed.
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
          // Same targeted update as reactions above -- avoid a full
          // rerenderLectureScreen() so the video tiles don't shake.
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

        function setLectureView(view){
          liveLectureState.view = view;
          rerenderLectureScreen();
        }

        function toggleLectureWhiteboard(){
          // Only the teacher can open/close the whiteboard; students'
          // screens just follow along via the broadcast below.
          if (!lectureIsTeacher()) return;
          closeLectureSheets();
          const nextView = liveLectureState.view === 'whiteboard' ? 'grid' : 'whiteboard';
          setLectureView(nextView);
          broadcastLectureSignal({ type: 'view', view: nextView, strokes: whiteboardStrokes });
        }

        function toggleLecturePresent(){
          // Match the pattern every other "More" sheet action uses
          // (lectureAttachDocuments/lectureAttachMedia/toggleLectureWhiteboard):
          // actually close the sheet via closeLectureSheets() rather than
          // just flipping the flag with no re-render. Without this, the
          // sheet never visibly/reliably closed and the tap could appear
          // to do nothing.
          closeLectureSheets();
          if (liveLectureState.view === 'slides') { setLectureView('grid'); return; }
          if (lectureSlides) { setLectureView('slides'); return; }
          const input = document.getElementById('lecture-slide-input');
          if (input) input.click();
        }

        // Re-renders the whole lecture screen, then re-wires whatever
        // non-serializable bits (camera stream, canvas, pdf page) live in
        // that view, since outerHTML swaps wipe them out.
        function rerenderLectureScreen(){
          const screen = document.getElementById('lecture-call-screen');
          if (screen) screen.outerHTML = lectureCallHTML();
          attachLectureMedia();
          const classPadList = document.getElementById('desktop-classpad-resources-list');
          if (classPadList) classPadList.innerHTML = classPadResourcesHTML();
          const classPadUploaded = document.getElementById('desktop-classpad-uploaded-list');
          if (classPadUploaded) classPadUploaded.innerHTML = classPadUploadedResourcesHTML();
        }

        // Rebuilds just the grid/whiteboard/slides stage (video tiles,
        // canvas, etc.) in place, leaving the header, control bar, and
        // floating reaction/comment bubbles untouched. Used for anything
        // that needs a real tile added/removed (someone joining/leaving,
        // switching view) without the full-screen outerHTML swap that was
        // causing the video to visibly shake on every unrelated update.
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

        function endLecture(remoteEnded){
          clearLectureTimer();
          stopLectureLocalStream();
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          const isTeacher = cls && cls.role === 'teacher';
          // The teacher ending the lecture ends it for every student still
          // on the call too -- broadcast it on the same lecture-signal
          // channel before tearing our own connection down, so everyone
          // still connected gets dropped immediately instead of being
          // left talking to a room the teacher already left.
          if (isTeacher && !remoteEnded) broadcastLectureSignal({ type: 'end' });
          teardownLectureSignaling();
          inLectureCall = false;
          // Only the teacher ending the lecture actually ends it for the
          // class. If a student just leaves, the lecture stays live in the
          // Stream so they (or anyone else) can rejoin it later. Saved
          // remotely too, so a student who wasn't even on the call right
          // now (just browsing the Stream tab) also sees it stop being
          // "Live" instead of a stale card sitting there forever.
          if (cls && isTeacher) {
            cls.lectures = (cls.lectures || []).filter(l => l.id !== liveLectureState.lectureId);
            queueSaveClassRemote(cls);
          }
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
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        // ---- Zoom-style participant grid ----
        // Other participants' tiles now come from lecturePresence (who's
        // actually in the call right now, tracked via Supabase Presence in
        // joinLectureSignaling) with a real <video> bound to their WebRTC
        // stream -- previously this rendered the *entire class roster* as
        // permanently-muted placeholder tiles regardless of who had really
        // joined, because there was no actual connection to anyone.
        const LECTURE_TILE_COLORS = ['bg-orange-500','bg-purple-500','bg-teal-500','bg-blue-500','bg-rose-500','bg-emerald-500','bg-indigo-500','bg-amber-500','bg-cyan-500','bg-pink-500'];

        // The local camera tile is split into two independently-updatable
        // pieces (media = video-or-avatar, badges = mute/camOff/hand
        // overlay icons) so that toggling mute or raising a hand only
        // touches the small badge layer, never the <video> element itself.
        // Previously every one of these taps re-rendered the *entire*
        // lecture screen via outerHTML, which destroyed and recreated the
        // live <video> node each time - that teardown/rebuild is what
        // made the feed visibly glitch and shake on every control tap.
        function lectureLocalMediaHTML(){
          const showLocalVideo = lectureLocalStream && !liveLectureState.camOff && !liveLectureState.mediaError;
          if (showLocalVideo) return `<video id="lecture-local-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform:scaleX(-1);"></video>`;
          // This tile is always you (the other participants get their own
          // tiles elsewhere) -- show your real profile photo when the
          // camera's off, same as the 1:1 call screen does, instead of a
          // generic silhouette.
          return `<div class="w-full h-full flex items-center justify-center bg-gray-700 overflow-hidden">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : Icon('user','w-10 h-10 text-white/70')}</div>`;
        }

        function lectureLocalBadgesHTML(){
          return `
            ${liveLectureState.muted ? `<div class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">${Icon('micOff','w-3.5 h-3.5')}</div>` : ''}
            ${liveLectureState.camOff ? `<div class="absolute top-1.5 ${liveLectureState.muted ? 'right-8' : 'right-1.5'} w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">${Icon('cameraOff','w-3.5 h-3.5')}</div>` : ''}
            ${liveLectureState.handRaised ? `<div class="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">${Icon('handRaised','w-3.5 h-3.5')}</div>` : ''}`;
        }

        // A single tile: the video/avatar square itself, plus a name
        // caption rendered as its own row underneath (not overlaid on top
        // of the video) -- so a name never sits in the middle of anyone's
        // face, and stays readable regardless of what's showing in the
        // tile above it.
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

        // Just the mute/hand-raised badge markup for a remote participant's
        // tile, split out so it can be patched in place (see
        // updateLectureRemoteBadges) without rebuilding that peer's whole
        // tile -- and, in turn, without touching every other tile's <video>
        // element, which is what was causing the visible "shake" whenever
        // anyone raised a hand, muted, or reacted.
        function lectureRemoteBadgesHTML(p){
          return `
            ${p.muted ? `<div class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white">${Icon('micOff','w-3.5 h-3.5')}</div>` : ''}
            ${p.handRaised ? `<div class="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white">${Icon('handRaised','w-3.5 h-3.5')}</div>` : ''}`;
        }

        // Patches each already-rendered remote tile's badge markup in
        // place. Used whenever presence syncs but the set of participants
        // hasn't actually changed (see syncLecturePresence) -- no reason to
        // tear down and recreate every video element just because someone's
        // mute/hand-raised flag flipped.
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
          // The teacher's tile always leads the grid -- whether that's
          // this participant's own local tile (handled by localTeacherFirst
          // below) or one of the remote peer tiles, so students always see
          // their teacher first regardless of join order.
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
          // If I'm the teacher, my own tile is the host tile and belongs
          // first. Otherwise, whichever remote tile is the teacher (if
          // any has joined yet) leads, with my own tile right after it.
          const orderedTiles = iAmTeacher ? (localTile + otherTiles) : (otherTiles + localTile);
          // On desktop, a fixed 2-column grid meant a single tile (just
          // the lecturer, before any students joined) stretched to fill
          // half the whole stage. Switching to auto-fill with a capped
          // tile width keeps every tile a sane, consistent size -- more
          // tiles per row as students join, rather than fewer, huge ones
          // -- while mobile keeps its original fixed 2-up layout.
          const gridClass = isDesktopLecture
            ? 'grid gap-3 p-4 overflow-y-auto flex-1 content-start justify-center'
            : 'grid grid-cols-2 gap-2.5 p-3 overflow-y-auto flex-1 content-start';
          const gridStyle = isDesktopLecture ? 'grid-template-columns:repeat(auto-fill,minmax(150px,190px));' : '';
          return `
            ${liveLectureState.mediaError ? `<div class="mx-4 mt-2 px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold flex-shrink-0">${escapeHtml(liveLectureState.mediaError)}</div>` : ''}
            <div class="${gridClass}" style="${gridStyle}">${orderedTiles}</div>
            ${!peerIds.length ? `<div class="text-center text-xs text-gray-400 pb-2 flex-shrink-0">No one else has joined this lecture yet: invite them from the People tab.</div>` : ''}`;
        }

        // ---- Lecture realtime signaling (teacher -> students) ----
        // Reuses the same Supabase Realtime broadcast channel pattern as the
        // 1:1 call signaling above, but scoped per-lecture, so that when the
        // teacher opens the whiteboard (or draws on it), every connected
        // student's screen mirrors it live. Requires SUPABASE_PROJECT_REF /
        // SUPABASE_ANON_KEY to be configured; if they aren't, the whiteboard
        // still works locally, it just won't sync to other participants.
        //
        // Previously this channel only carried whiteboard/attachment state
        // -- there was no actual audio/video connection between
        // participants at all. Every "other student" tile was just a
        // static initials box pulled from the class roster, always shown
        // muted, whether or not that person had ever joined -- so calls in
        // the class section simply never went through; nobody's camera or
        // mic was ever sent to anyone. Fixed by adding a real WebRTC mesh:
        // Supabase Presence tracks who's actually in the lecture room, and
        // a peer connection is opened with each of them (same offerer
        // tie-break as the 1:1 call in chat.js -- see maybeBecomeCallOfferer
        // there), using this same channel for signaling.
        let lectureChannel = null;
        let myLecturePeerId = null;
        let lecturePresence = {}; // peerId -> { name, photo, muted, camOff, handRaised }
        let lecturePeerConnections = {}; // peerId -> RTCPeerConnection
        let lectureRemoteStreams = {}; // peerId -> MediaStream
        let lecturePendingIce = {}; // peerId -> [candidate, ...] queued until that peer's remote description is set
        let lectureRemoteDescSet = {}; // peerId -> bool

        function lectureIsTeacher(){
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          return !!(cls && cls.role === 'teacher');
        }

        function joinLectureSignaling(lectureId){
          const sb = getSupabaseClient();
          if (!sb) return; // no Supabase configured: call/whiteboard stay local-only, nobody else can be reached
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

        // Called whenever Presence reports who's actually in the room right
        // now (fires on join, leave, and periodic resync). Opens a peer
        // connection for anyone newly present, and tears down/removes the
        // tile for anyone who's left.
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
          // Someone actually joining or leaving needs real tiles added or
          // removed, so rebuild the stage. Otherwise (e.g. someone just
          // muted, raised a hand, or toggled camera) every tile that's
          // already on screen is still valid -- just patch their badges in
          // place instead of tearing every video element down and back up,
          // which is what made the whole call screen visibly shake.
          if (newlyJoined.length || anyoneLeft) {
            updateLectureStageContent();
          } else {
            updateLectureRemoteBadges();
          }
          // A student who joins (or reconnects) AFTER the teacher already
          // switched to the whiteboard previously landed on the plain grid
          // view and stayed there -- the 'view' signal only ever fired at
          // the moment the teacher toggled it, which was before this
          // student's channel existed to hear it. Re-broadcasting current
          // state whenever someone new shows up in presence is what makes
          // a late joiner's screen actually switch to match whatever the
          // teacher is presenting right now, same as everyone who was
          // already there.
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

        // One mesh connection per other participant. Which side actually
        // sends the SDP offer is decided the same deterministic way as the
        // 1:1 call (comparing peer ids), via onnegotiationneeded -- that
        // also means it fires again automatically if local tracks get
        // added later (see attachLocalTracksToLecturePeers, for when mic/
        // camera permission finishes loading after a peer already connected).
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
            if (myLecturePeerId < peerId) return; // the other side offers instead
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              broadcastLectureSignal({ type: 'rtc-offer', to: peerId, sdp: offer });
            } catch (e) { /* benign: e.g. connection already closed */ }
          };
          return pc;
        }

        // Adds the local camera/mic stream to every already-open lecture
        // peer connection. Needed because getUserMedia() is async and can
        // resolve after presence has already connected some peers (their
        // connections get created with no local tracks yet) -- addTrack
        // here triggers onnegotiationneeded above to renegotiate.
        function attachLocalTracksToLecturePeers(){
          if (!lectureLocalStream) return;
          Object.values(lecturePeerConnections).forEach(pc => {
            const already = pc.getSenders().map(s => s.track);
            lectureLocalStream.getTracks().forEach(t => { if (!already.includes(t)) pc.addTrack(t, lectureLocalStream); });
          });
        }

        async function flushLecturePendingIce(peerId, pc){
          const queued = lecturePendingIce[peerId] || [];
          for (const c of queued) { try { await pc.addIceCandidate(c); } catch (e) { /* benign */ } }
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

        // Students (and any other participant) receive teacher-driven
        // updates here: switching into/out of the whiteboard, and every
        // stroke/undo/clear the teacher makes while on it. Also carries
        // the per-peer WebRTC mesh signaling (rtc-offer/rtc-answer/rtc-ice)
        // added above -- those are addressed to one specific peer (`to`),
        // so every other participant just ignores them.
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
          // Reactions aren't teacher-authoritative state like the
          // whiteboard/attachments below -- anyone can send one, and
          // everyone (including the teacher) should see everyone else's,
          // so this is handled before the "teacher is the source of
          // truth" early-return further down.
          if (payload.type === 'reaction') {
            addLectureFloatingReaction(payload.id, payload.icon, payload.name, payload.big);
            return;
          }
          // Comments, like reactions, are anyone-can-send and everyone
          // (including the teacher) should see them.
          if (payload.type === 'comment') {
            addLectureFloatingComment(payload.id, payload.text, payload.name);
            return;
          }
          // The teacher just ended the lecture -- close it out for us too,
          // the same as tapping "Leave" ourselves, instead of staying
          // connected to a call the teacher has already left. Anyone can
          // technically send this (no server-side auth on these channels,
          // same trust model as the rest of the app's signaling), but
          // lectureIsTeacher() below already fences off anything more
          // sensitive than "end the call I'm currently in".
          if (payload.type === 'end') {
            endLecture(true);
            openAppAlertModal('Your teacher ended the lecture.');
            return;
          }
          if (lectureIsTeacher()) return; // teacher is the source of truth, ignore echoes
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
            // If the file hasn't finished downloading yet, once it lands
            // (see handleRemoteAttachmentAdd) it opens itself automatically.
            else pendingAutoOpenAttachmentId = payload.id;
          }
        }

        // Downloads a file another participant shared into the lecture and
        // adds it to this screen's own Resources list, so it appears and
        // opens exactly like something picked locally.
        let pendingAutoOpenAttachmentId = null;
        async function handleRemoteAttachmentAdd(payload){
          if (lectureAttachments.some(x => x.id === payload.id)) return; // already have it
          const placeholder = { id: payload.id, name: payload.name, kind: payload.kind, file: null, url: null, status: 'loading' };
          lectureAttachments.push(placeholder);
          rerenderLectureScreen();
          try {
            const { file, url } = await materializeRemoteLectureFile(payload.remoteUrl);
            const a = lectureAttachments.find(x => x.id === payload.id);
            if (!a) return; // removed while downloading
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

        // ---- Whiteboard (freehand pen, shapes, text, colors) ----
        let whiteboardStrokes = [];
        let whiteboardTool = 'pen';
        let whiteboardColor = '#111827';
        let whiteboardDrawState = null;
        let whiteboardCtx = null;
        let whiteboardPrevTool = null; // tool to restore after a delete-area selection finishes
        let whiteboardAttachment = null; // { name } of a pptx/pdf attached while staying on the whiteboard
        const WHITEBOARD_COLORS = ['#111827','#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed'];

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
          // Stays on the whiteboard: this just attaches the file for reference,
          // it does not switch the view over to the slide presenter. It can
          // still be opened and read in full via the chip below.
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
            // The canvas itself gets recreated (and re-wired) on every
            // whiteboard re-render -- switching tools, colors, etc. -- but
            // `window` doesn't, so this one is guarded separately to avoid
            // piling up duplicate listeners across a long session.
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
          if (document.getElementById('wb-text-input')) return; // an existing text box is still being edited
          // Without this, the canvas (which can't itself hold focus) still
          // runs its default mousedown handling right after this handler
          // returns, which blurs whatever was just focused -- including
          // the text input wbStartTextInput is about to create below. That
          // blur fires before any keystroke lands, so the box immediately
          // commits as empty and gets discarded, making the Text tool look
          // like it does nothing when tapped.
          if (e.cancelable) e.preventDefault();
          const p = wbCanvasPoint(e);
          if (whiteboardTool === 'text') {
            wbStartTextInput(p);
            return;
          }
          whiteboardDrawState = { tool: whiteboardTool, color: whiteboardTool === 'eraser' ? '#ffffff' : whiteboardColor, points: [p], x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        }

        // Tapping the board with the "T" tool selected drops a real,
        // editable text box right where you tapped -- a transparent-
        // background input sitting on top of the canvas -- instead of a
        // browser prompt() dialog. Typing shows live on the board; the
        // text is only baked into the canvas (as a 'text' stroke) once
        // you tap away or press Enter, and an empty box is discarded.
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

        // Tapping the trash icon no longer wipes the whole board -- it
        // arms "delete select" mode. The next drag on the canvas draws a
        // marquee rectangle, and anything inside it is removed the moment
        // you lift your finger; tapping the trash icon again (without
        // dragging) just cancels back to whatever tool you were using.
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
          // A stray tap (no real drag) shouldn't delete whatever happens to sit under it.
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

        // ---- Slide presentation (real PDF rendering via pdf.js; PPTX text outline via JSZip) ----
        let lectureSlides = null; // { type:'pdf', pdfDoc, total, current, fileName } | { type:'pptx', slides:[{title,bullets}], current, fileName }

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

        // PPTX has no simple client-side visual renderer, so this reads the
        // real slide XML out of the .pptx zip and rebuilds each slide's
        // title + bullet text on a slide-styled card: genuine content from
        // the file, laid out like a presentation rather than shown as raw markup.
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

        // The floating Reactions/More sheets plus their dimming backdrop,
        // pulled out into their own function so they can be refreshed in
        // isolation (see updateLectureSheetsRegion) without disturbing the
        // stage or the live video feed underneath.
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
            <div id="lecture-call-screen" class="flex-1 flex flex-col text-gray-800" style="padding-top:20px;background:#ffffff;">
              <input type="file" id="lecture-slide-input" accept=".pdf,.pptx" class="hidden" onchange="handleLectureSlideFile(event)">
              <input type="file" id="lecture-doc-input" accept=".pdf" class="hidden" onchange="handleLectureDocAttach(event)">
              <input type="file" id="lecture-media-input" accept="image/*,video/*" class="hidden" onchange="handleLectureMediaAttach(event)">
              <div class="flex items-center px-3 flex-shrink-0 mb-2 relative">
                <button onclick="${(isWhiteboard && isTeacher) ? 'toggleLectureWhiteboard()' : 'endLecture()'}" title="Back" class="absolute left-3 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white text-gray-700 shadow-sm border border-gray-200">${Icon('back','w-4 h-4')}</button>
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
                <div class="flex items-center gap-2 rounded-full py-1.5 px-2 shadow-sm overflow-x-auto" style="background:${controlBarBg};">
                  <button onclick="endLecture()" title="${isTeacher ? 'End lecture' : 'Leave'}" class="w-9 h-9 rounded-full bg-white border-2 border-red-500 text-red-500 flex items-center justify-center flex-shrink-0">${Icon('phoneHangup','w-4 h-4')}</button>
                  <button onclick="toggleLectureControl('camOff')" id="lecture-cam-btn" title="${liveLectureState.camOff ? 'Turn camera on' : 'Turn camera off'}" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.camOff ? activeControlClass : inactiveControlClass}">${Icon(liveLectureState.camOff ? 'cameraOff' : 'video','w-4 h-4')}</button>
                  <button onclick="toggleLectureControl('muted')" id="lecture-mute-btn" title="${liveLectureState.muted ? 'Unmute' : 'Mute'}" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.muted ? activeControlClass : inactiveControlClass}">${Icon(liveLectureState.muted ? 'micOff' : 'mic','w-4 h-4')}</button>
                  <button onclick="toggleLectureHand()" id="lecture-hand-btn" title="Raise hand" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${liveLectureState.handRaised ? 'text-white' : inactiveControlClass}" style="${liveLectureState.handRaised ? 'background:' + NAVY + ';' : ''}">${Icon('handRaised','w-4 h-4')}</button>
                  <button onclick="toggleLectureMoreSheet()" id="lecture-more-btn" title="More" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${lectureMoreSheetOpen ? activeControlClass : inactiveControlClass}"><span style="display:inline-flex;transform:rotate(90deg);">${Icon('dots','w-4 h-4')}</span></button>
                </div>
              </div>` : ''}
              <div id="lecture-sheets-region">${lectureSheetsRegionHTML(view)}</div>
            </div>`;
        }

        // ---- "Reactions" popover: a horizontal rounded pill of icons that
        // floats just above the control bar (not a vertical sheet). ----
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
            <div class="absolute z-30 flex items-center gap-2 rounded-full shadow-lg bg-white overflow-x-auto" style="bottom:78px;left:10px;right:10px;width:fit-content;max-width:calc(100% - 20px);margin:0 auto;padding:10px;">
              ${reactionIcons.map(r => `
                <button onclick="sendLectureReaction('${r.icon}')" title="${escapeHtml(r.label)}" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100" style="color:${r.color};">${Icon(r.icon,'w-5 h-5')}</button>`).join('')}
            </div>`;
        }

        // ---- "T" (comment) popover: a quick text box so anyone can type
        // something during the lecture -- shown to every participant as a
        // bubble over the stage (see lectureCommentsFloatHTML). ----
        function lectureCommentSheetHTML(){
          return `
            <div class="absolute z-30 flex items-center gap-2 rounded-full shadow-lg bg-white" style="bottom:78px;left:10px;right:10px;max-width:380px;margin:0 auto;padding:10px;">
              <input id="lecture-comment-input" type="text" placeholder="Type a comment..." maxlength="200" class="flex-1 min-w-0 text-sm outline-none bg-transparent" onkeydown="if(event.key==='Enter'){event.preventDefault();sendLectureComment();}">
              <button onclick="sendLectureComment()" title="Send" class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
            </div>`;
        }

        // ---- "More" bottom sheet (camera, whiteboard, present: everything
        // that doesn't fit on the compact main bar) ----
        function lectureMoreSheetHTML(view){
          // Single inline row (icon + label stacked, no tile/box background)
          // instead of a 2x2 grid of tiles, sitting directly under the
          // Whiteboard pill.
          const grid = (onclick, icon, label, active) => `
            <button onclick="${onclick}" class="flex-1 min-w-0 flex flex-col items-center justify-center gap-1.5 py-1">
              <span class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="${active ? 'background:' + NAVY + ';' : 'background:#f9fafb;'}">
                ${Icon(icon, `w-5 h-5 ${active ? 'text-white' : 'text-gray-500'}`)}
              </span>
              <span class="text-[10px] font-bold ${active ? '' : 'text-gray-900'} truncate" style="${active ? 'color:' + NAVY + ';' : ''}">${label}</span>
            </button>`;
          const isTeacher = lectureIsTeacher();
          return `
            <div class="absolute left-1/2 z-30 bg-white rounded-3xl shadow-lg p-4" style="bottom:78px;transform:translateX(-50%);width:min(calc(100vw - 60px),380px);">
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
              </div>
            </div>`;
        }

        // ---- "More" sheet: attach a document, or a photo/video, to the
        // lecture. No backend to actually upload to, so the picked file is
        // added to lectureAttachments and shown as a chip strip on the call
        // screen (same lightweight pattern as other attach strips in the
        // app), rather than just a one-off confirmation alert. ----
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

        // Adds the file to this participant's own screen immediately (so it
        // opens with zero delay for whoever picked it), then uploads it to
        // shared storage in the background and broadcasts the resulting URL
        // so every other participant in the lecture receives it too.
        function shareFileIntoLecture(file, kind){
          const id = 'la' + Date.now() + Math.random().toString(36).slice(2);
          const url = URL.createObjectURL(file);
          const attachment = { id, name: file.name, kind, file, url };
          lectureAttachments.push(attachment);
          rerenderLectureScreen();
          openLectureAttachment(id);

          const lectureId = liveLectureState.lectureId;
          uploadLectureFileToStorage(file, lectureId, id).then(remoteUrl => {
            if (!remoteUrl) return; // Supabase Storage not configured/upload failed: stays local-only
            if (liveLectureState.lectureId !== lectureId) return; // left the lecture before upload finished
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

        // Tapping a chip (not the ✕) opens that exact file so it can
        // actually be viewed, live, by whoever is in the lecture: a PDF
        // shows its pages, a PPTX its slides, a DOCX its formatted text,
        // photos/videos play inline. This is what makes "shared" files
        // genuinely openable rather than just a name in a pill.
        function openLectureAttachment(id){
          const a = lectureAttachments.find(x => x.id === id);
          if (!a) return;
          lectureResourcesPanelOpen = false;
          openFilePreview(a.name, a.url, a.file, a.kind === 'photo' ? 'image' : a.kind === 'video' ? 'video' : null);
          // When the teacher opens a shared file, every student's screen
          // should follow along and open the same file automatically.
          // A student opening a file is treated as a personal look-up and
          // stays local, so it doesn't yank everyone else's screen around.
          if (lectureIsTeacher()) broadcastLectureSignal({ type: 'attachment-open', id });
        }

        // ---- Resources panel: every file shared into this lecture (via the
        // More > Documents/Photos menu, or attached straight to the
        // whiteboard) lives here as a slide-in side panel instead of a strip
        // pinned to the top of the screen. Tapping an item opens it in the
        // middle stage area (see lecturePreviewHTML) rather than as a
        // full-screen takeover. ----
        function getLectureResourceItems(){
          return [
            ...(whiteboardAttachment ? [{ id: '__wb', name: whiteboardAttachment.name, kind: 'doc', isWhiteboard: true }] : []),
            ...lectureAttachments,
          ];
        }

        // Same items list as the slide-in Resources panel, rendered inline
        // instead -- used to surface lecture resources on the Class Pad
        // (the desktop right panel) right under the notes, so they're
        // visible without opening the separate slide-in panel.
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

        // Second Class Pad section: every file from the app-wide Resources
        // library (Study > Resources -- PDFs/DOCX/PPTX the student has
        // uploaded and had scanned into flashcards/questions), not just
        // what's been shared into this specific lecture. Lets a student
        // pull up anything they've already uploaded while the class is
        // live, without leaving the call to go dig through the Resources
        // tab. Reuses the same file-preview surface as lecture attachments
        // (the extracted text is already sitting on the resource, so no
        // re-parsing is needed -- it's handed straight to the 'text' kind
        // lecturePreviewHTML already knows how to render).
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

        // Opens an app-wide Resource in the same full-screen/right-panel
        // preview lecture attachments use. The resource kept its real File
        // and a blob URL from when it was uploaded (see
        // processUploadedResource), so this re-parses it live -- real PDF
        // pages on a canvas, real PPTX slide text, real DOCX formatting --
        // rather than showing only the plain extracted text.
        function openUploadedResourcePreview(id){
          const r = uploadedResources.find(x => x.id === id);
          if (!r || r.status !== 'ready' || !r.file) return;
          lectureResourcesPanelOpen = false;
          openFilePreview(r.name, r.url, r.file);
        }

        // Keeps the Uploaded Resources section of every open Class Pad
        // surface (desktop right panel and/or mobile slide-in panel) in
        // sync as resources finish processing or fail, mirroring
        // refreshClassPadSurfaces() for notes above.
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



        // ---- Lecture file preview: opens any shared attachment (lecture
        // "Documents"/"Photos & videos" chips, or the whiteboard's attached
        // PDF/PPTX) as a real, readable full-screen viewer instead of just
        // a filename pill. Reuses the same pdf.js / JSZip / mammoth
        // libraries already loaded for study resources and Present Slides,
        // so images play, PDFs page through, PPTX slides render their real
        // text, and DOCX shows its formatted content. ----
        let lecturePreview = null; // { name, ext, kind, url, file, status:'loading'|'ready'|'error', error, pdfDoc, pdfTotal, pdfCurrent, pptxSlides, pptxCurrent, htmlContent, textContent }

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

        // Renders an opened document (lecture attachment or app-wide
        // Resource) right over the call stage -- the same spot the video
        // grid/whiteboard/slides occupy -- on both mobile and desktop.
        // Previously this swapped the desktop Class Pad panel over to a
        // "file" mode, replacing notes/resources with the open document;
        // now the Class Pad stays put and only the stage area changes,
        // matching how it already worked on mobile.
        function renderLecturePreviewRegion(){
          const el = document.getElementById('lecture-preview-region');
          if (!el) return;
          el.innerHTML = lecturePreviewHTML();
          // Set the inline style directly (not just a class) -- the region's
          // clickability is controlled via inline style on first render, and
          // an inline style always wins over a class toggle. Only touching
          // the class here left the panel stuck at whatever it was during
          // the last full-screen re-render, which is why the close (X)
          // button and preview controls would randomly stop responding.
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

        // ---------------- SCHEDULE LECTURE (upcoming event) ----------------
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
              <button onclick="submitScheduleLecture()" class="w-full font-semibold py-3 rounded-2xl text-white" style="background:rgba(30,144,255,0.5);">Schedule Lecture</button>
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

        // ---------------- CLASS-SCOPED NOTIFICATIONS ----------------
        // Unlike the app-wide Notice Board, this only surfaces items that
        // belong to whichever class is currently open: new announcements,
        // live/upcoming lectures, and classwork due dates.
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


        function classworkTypeIcon(type){
          if (type === 'quiz') return 'edit';
          if (type === 'question') return 'help';
          if (type === 'material') return 'file';
          if (type === 'poll') return 'chart';
          return 'doc'; // assignment
        }

        // Synchronous current-user id for keying per-student submissions --
        // _cachedAuthUser (core.js) is populated early in authEnterApp's
        // boot sequence (getCachedAuthUser()), well before any classwork
        // screen can be opened, so it's safe to read directly here without
        // an extra await on every render.
        function myClassworkUserId(){
          return (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
        }

        // Assignment/question submissions used to be a single `w.submission`
        // field shared by the whole class -- fine for one student, but with
        // a real class every student's "Turn in" overwrote the previous
        // student's submission (and the teacher could only ever see the
        // last one that arrived), which is why submissions looked like they
        // "weren't received." Submissions are now keyed per student in
        // `w.submissions[studentId]`; these two helpers read/ensure that
        // map so the rest of this file doesn't have to null-check it
        // everywhere (older classwork items saved before this change won't
        // have the field at all).
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

        // Small status pill: what state this piece of classwork is in for
        // the current student (not submitted / turned in / graded / a quiz
        // score) -- for a teacher it instead shows how many students have
        // submitted so far, since a teacher isn't the one submitting.
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
          // Same gradient-banner-plus-motif card treatment as an
          // Opportunities card (see jobCard in jobs.js) -- shades of blue
          // only (blueCardPalette in core.js), rather than a flat white
          // row, so classwork reads as its own "live" card here too.
          // Each classwork item's position in cls.classwork is a stable
          // fallback index (nothing here has its own colorIndex/
          // motifIndex stored on creation, unlike classes/opportunities),
          // so the same item always lands on the same color/motif.
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
              <button onclick="openClassworkCreateMenu()" class="flex items-center gap-2 rounded-2xl py-2.5 px-4 font-semibold text-sm text-white" style="background:rgba(30,144,255,0.5);">${Icon('plus','w-4 h-4')} Create</button>
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

        // ---------------- CLASSWORK: Create-type menu (Assignment / Quiz / Question / Material) ----------------
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
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
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

        // ---------------- NEW ANNOUNCEMENT (Google Classroom-style) ----------------
        let announcementDraft = '';
        let announcementMenuOpen = false;

        // Files picked via "Add attachment" while drafting an announcement.
        // Mirrors classworkDraftAttachments: staged here as a chip strip,
        // then handed off to the announcement once it's actually posted, or
        // revoked if the draft is discarded/abandoned unposted.
        let announcementDraftAttachments = [];

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

        // Files picked here get an instant local blob preview (so the chip
        // shows up immediately with no network wait) while the real bytes
        // upload to Storage in the background -- url gets swapped over to
        // the permanent public URL once that finishes (see
        // uploadClassworkFileToStorage in core.js). uploading stays true
        // until that settles, and submitNewAnnouncement blocks posting
        // until every attachment has either finished or fallen back.
        function handleAnnouncementAttachFile(event){
          const files = Array.from(event.target.files || []);
          files.forEach(file => {
            const id = 'aa' + Date.now() + Math.random().toString(36).slice(2);
            const url = URL.createObjectURL(file);
            const entry = { id, name: file.name, file, url, uploading: true };
            announcementDraftAttachments.push(entry);
            uploadClassworkFileToStorage(file, id).then(remoteUrl => {
              if (!announcementDraftAttachments.includes(entry)) return; // removed/discarded meanwhile
              if (remoteUrl) entry.url = remoteUrl; // otherwise keep the local preview as a same-session fallback
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
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between gap-4" style="position:relative;">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate text-center">New announcement</div>
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
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? cls.name : 'Class'}</span>
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:${NAVY};">All students</span>
              </div>
              <textarea id="announcement-text-input" oninput="announcementDraft=this.value; const b=document.getElementById('announcement-create-btn'); if(b){const c=announcementDraft.trim().length>0; b.disabled=!c; b.className='font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'rgba(30,144,255,0.5)':'';}" placeholder="Announce something to your class" rows="6" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-6">${announcementDraft}</textarea>
              <input type="file" id="announcement-attach-input" multiple class="hidden" onchange="handleAnnouncementAttachFile(event)">
              <button onclick="document.getElementById('announcement-attach-input').click()" class="flex items-center gap-2 text-sm font-semibold" style="color:${NAVY};">${Icon('paperclip','w-4 h-4')} Add attachment</button>
              <div id="announcement-attach-strip" class="mt-3">${announcementAttachStripHTML()}</div>
            </div>
            <button onclick="submitNewAnnouncement()" ${canPost ? '' : 'disabled'} id="announcement-create-btn" class="font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg ${canPost ? 'text-white' : 'text-gray-400 bg-gray-100'}" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;${canPost ? `background:rgba(30,144,255,0.5);` : ''}">Create</button>`;
        }

        function submitNewAnnouncement(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const text = (document.getElementById('announcement-text-input') ? document.getElementById('announcement-text-input').value : announcementDraft).trim();
          if (!cls || !text) return;
          if (announcementDraftAttachments.some(a => a.uploading)) { openAppAlertModal('Still uploading -- give it a moment and try again.'); return; }
          // Only id/name/url are ever kept -- the raw File object can't
          // survive being saved to Supabase's jsonb `data` column anyway,
          // and by this point url should already be the permanent Storage
          // URL from uploadClassworkFileToStorage (see
          // handleAnnouncementAttachFile), not a local blob: URL.
          const attachments = announcementDraftAttachments.map(a => ({ id: a.id, name: a.name, url: a.url }));
          cls.announcements.unshift({ id: 'a-' + Date.now(), text, createdAt: Date.now(), comments: [], attachments });
          queueSaveClassRemote(cls);
          announcementDraftAttachments = [];
          classDetailTab = 'stream';
          openOverlay('classDetail');
        }

        // ---------------- NEW CLASSWORK (Google Classroom-style) ----------------
        // classworkDraftType decides both the label on the creation form and
        // what fields the resulting classwork item gets (submission fields
        // for Assignment/Question, none for Material).
        let classworkDraftType = 'assignment';
        // Files picked via "Add attachment" while drafting an Assignment,
        // Question, or Material. { id, name, file, url }; url is an object
        // URL kept alive until either the draft is submitted (where it's
        // handed off to the created classwork item) or a fresh draft is
        // started (where any leftover, un-submitted files are revoked).
        let classworkDraftAttachments = [];

        function resetClassworkDraftAttachments(){
          classworkDraftAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          classworkDraftAttachments = [];
        }

        function openNewAssignmentOverlay(){ classworkDraftType = 'assignment'; resetClassworkDraftAttachments(); openOverlay('newClasswork'); }
        function openNewQuestionOverlay(){ classworkDraftType = 'question'; resetClassworkDraftAttachments(); openOverlay('newClasswork'); }
        function openNewMaterialOverlay(){ classworkDraftType = 'material'; resetClassworkDraftAttachments(); openOverlay('newClasswork'); }

        // Kept so any old callers still work: defaults to Assignment.
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
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="openClassworkCreateMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate text-center">${label}</div>
                <div class="w-8 h-8 flex-shrink-0"></div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-24">
              <div class="flex items-center gap-2.5 mb-5">
                ${Icon('users','w-5 h-5 text-gray-500 flex-shrink-0')}
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? cls.name : 'Class'}</span>
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:${NAVY};">All students</span>
              </div>
              <input type="text" id="classwork-title-input" oninput="const b=document.getElementById('classwork-create-btn'); if(b){const c=this.value.trim().length>0; b.disabled=!c; b.className='font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'rgba(30,144,255,0.5)':'';}" placeholder="Title" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
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

        // ---- Draft attachments for the Assignment/Question/Material form:
        // picking files here just stages them (chip strip below the form);
        // they're only handed to the classwork item once it's actually
        // created, mirroring how lecture/whiteboard attachments work. ----
        // Same instant-preview-then-upload pattern as
        // handleAnnouncementAttachFile above -- see the comment there and
        // uploadClassworkFileToStorage in core.js for why this matters:
        // without it, a video attached to a Material/Assignment never
        // reached enrolled students, only a broken local blob: link did.
        function handleClassworkAttachFile(event){
          const files = Array.from(event.target.files || []);
          files.forEach(file => {
            const id = 'ca' + Date.now() + Math.random().toString(36).slice(2);
            const url = URL.createObjectURL(file);
            const entry = { id, name: file.name, file, url, uploading: true };
            classworkDraftAttachments.push(entry);
            uploadClassworkFileToStorage(file, id).then(remoteUrl => {
              if (!classworkDraftAttachments.includes(entry)) return; // removed/discarded meanwhile
              if (remoteUrl) entry.url = remoteUrl; // otherwise keep the local preview as a same-session fallback
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
            // Only id/name/url are kept, same reasoning as
            // submitNewAnnouncement -- the File object never survives the
            // round trip to Supabase, and url should already be the
            // permanent Storage URL by the time this runs.
            attachments: classworkDraftAttachments.map(a => ({ id: a.id, name: a.name, url: a.url }))
          });
          queueSaveClassRemote(cls);
          classworkDraftAttachments = []; // handed off above, so don't revoke their URLs
          if (due) ensureNotificationPermission();
          classDetailTab = 'classwork';
          openOverlay('classDetail');
        }

        function formatDueDate(iso){
          const d = new Date(iso + 'T00:00:00');
          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }

        // ---------------- NEW QUIZ (question builder) ----------------
        // Question blocks are built directly in the DOM (rather than kept
        // in a JS array re-rendered on every keystroke) so typing in one
        // field never has to re-render the others.
        let quizQuestionCounter = 0;

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
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="openClassworkCreateMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate text-center">Quiz</div>
                <div class="w-8 h-8 flex-shrink-0"></div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-24">
              <div class="flex items-center gap-2.5 mb-5">
                ${Icon('users','w-5 h-5 text-gray-500 flex-shrink-0')}
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? cls.name : 'Class'}</span>
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
            <button onclick="submitNewQuiz()" class="font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg text-white" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:rgba(30,144,255,0.5);">Create</button>`;
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

        // ---------------- NEW POLL ----------------
        let pollOptionCounter = 0;

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
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="openClassworkCreateMenu()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate text-center">Poll</div>
                <div class="w-8 h-8 flex-shrink-0"></div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 pb-24">
              <div class="flex items-center gap-2.5 mb-5">
                ${Icon('users','w-5 h-5 text-gray-500 flex-shrink-0')}
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:rgba(30,144,255,0.5);">${cls ? cls.name : 'Class'}</span>
                <span class="text-sm font-semibold px-4 py-2 rounded-full text-white" style="background:${NAVY};">All students</span>
              </div>
              <input type="text" id="poll-title-input" placeholder="Ask a question" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-lg font-semibold mb-4">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Options</div>
              <div id="poll-options-container">${pollOptionRowHTML(0)}${pollOptionRowHTML(1)}</div>
              <button onclick="addPollOptionRow()" class="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-2xl py-3 font-semibold text-sm text-[${NAVY}]">${Icon('plus','w-4 h-4')} Add option</button>
            </div>
            <button onclick="submitNewPoll()" class="font-semibold text-sm px-6 py-3 rounded-full flex-shrink-0 shadow-lg text-white" style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;background:rgba(30,144,255,0.5);">Create</button>`;
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

        // ---------------- CLASSWORK DETAIL: submission + grading ----------------
        let currentClassworkId = null;

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
              <div class="w-full px-5 pb-3 relative" style="padding-top:20px;">
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

        // ---- Assignment / Question: text submission, then teacher grading ----
        function classworkAssignmentDetailHTML(w){
          const cls = myClasses.find(c => c.id === currentClassId);
          const isTeacher = cls && cls.role === 'teacher';

          if (isTeacher) {
            // Every student's submission is kept in its own slot
            // (w.submissions[studentId]) instead of a single shared field,
            // so the teacher sees and grades each student's work
            // separately instead of only ever the last one to arrive.
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

          // Student view: turn work in, or see what was already turned in;
          // the grade (once given) is shown read-only, never editable here.
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
          // Keyed by student id (see classworkSubmissionsMap) instead of a
          // single shared field -- otherwise one student turning work in
          // would silently overwrite whatever another student had already
          // submitted, which is why submissions "weren't received."
          classworkSubmissionsMap(w)[uid] = { text, submittedAt: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), score: null, remark: '', graded: false };
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
          // Without this, "Turn in" only ever updated this student's own
          // local copy of `cls` -- it never reached Supabase, so the
          // teacher (on their own device) never received it. Same fix as
          // addStreamComment above.
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
          // So the grade/remark the teacher just saved actually reaches
          // the student instead of staying stuck on the teacher's device.
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
        }

        // ---- Quiz: take it, auto-score it, then an optional teacher remark ----
        function classworkQuizDetailHTML(w){
          const cls = myClasses.find(c => c.id === currentClassId);
          const isTeacher = cls && cls.role === 'teacher';

          // Same per-student fix as the assignment view above: quiz
          // submissions are keyed by student id (w.quizSubmissions[id])
          // instead of one shared field, so every student's score/answers
          // reach the teacher instead of overwriting each other.
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
          // Same fix as submitClassworkAssignment -- a quiz submission has
          // to be pushed to Supabase for the teacher to ever see the score.
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

        // ---- Poll: vote once, then see live results as percentage bars ----
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
          // Otherwise this vote only ever counted on the voter's own
          // device -- everyone else's tally (and the teacher's) never
          // moved, since it never made it to Supabase.
          const cls = myClasses.find(c => c.id === currentClassId);
          if (cls) queueSaveClassRemote(cls);
        }

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

        // A co-teacher invite is a lightweight, real piece of class state:
        // it's stored on the class, shown in the Teachers list as
        // "Invite pending", and can be cancelled, rather than the old
        // button that just alerted and forgot about it immediately.
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

        // ---------------- CLASS SETTINGS (Google Classroom-style) ----------------
        function classSettingsHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) { setTimeout(closeOverlay, 0); return '<div class="flex-1"></div>'; }
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
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


        function openInviteStudentsOverlay(){
          inviteEmailsDraft = '';
          openOverlay('inviteStudents');
        }

        function inviteStudentsHTML(){
          const cls = myClasses.find(c => c.id === currentClassId);
          const canInvite = inviteEmailsDraft.trim().length > 0;
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between gap-4">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
                <div class="flex-1 font-semibold text-lg font-display truncate">Invite students</div>
                <button id="invite-submit-btn" onclick="submitInviteStudents()" ${canInvite ? '' : 'disabled'} class="font-semibold text-sm px-4 py-2 rounded-2xl flex-shrink-0 ${canInvite ? 'text-white' : 'text-gray-400 bg-gray-100'}" style="${canInvite ? `background:rgba(30,144,255,0.5);` : ''}">Invite</button>
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
              <textarea id="invite-emails-input" oninput="inviteEmailsDraft=this.value; const b=document.getElementById('invite-submit-btn'); if(b){const c=inviteEmailsDraft.trim().length>0; b.disabled=!c; b.className='font-semibold text-sm px-4 py-2 rounded-2xl flex-shrink-0 '+(c?'text-white':'text-gray-400 bg-gray-100'); b.style.background=c?'rgba(30,144,255,0.5)':'';}" placeholder="e.g. ama@example.com, kojo@example.com" rows="4" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-2">${inviteEmailsDraft}</textarea>
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

        function submitInviteStudents(){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const raw = (document.getElementById('invite-emails-input') ? document.getElementById('invite-emails-input').value : inviteEmailsDraft).trim();
          if (!raw) return;
          const emails = raw.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
          emails.forEach(email => {
            const nameGuess = email.split('@')[0].replace(/[._]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            // Note: an email invite here is still just a roster placeholder,
            // not real access -- it doesn't add anyone to the class's
            // `members` array, so it can't grant them the ability to
            // actually read this class's row (RLS still blocks that).
            // The real way in is the class code / invite link below;
            // matching an email invite to an actual account and granting
            // access automatically on signup would need its own lookup
            // (email -> auth user id), which isn't wired up here.
            //
            // A Course works differently from a regular class: an invited
            // learner doesn't get a roster spot (and the access that comes
            // with it) right away. They're added as pending and only get
            // access once they've gone through the Enroll window
            // themselves, same as anyone finding the course on their own.
            cls.students.push(cls.isCourse ? { name: nameGuess, email, pending: true } : { name: nameGuess, email });
          });
          queueSaveClassRemote(cls);
          classDetailTab = 'people';
          openOverlay('classDetail');
        }

        function cancelStudentInvite(classId, index){
          const cls = myClasses.find(c => c.id === classId);
          if (!cls || !cls.students) return;
          cls.students.splice(index, 1);
          queueSaveClassRemote(cls);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = classDetailHTML();
        }

        // ---------------- STUDY PLANNER: TIMETABLE ----------------
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

        // Finds the soonest upcoming occurrence of any class this week,
        // rolling over to next week if every occurrence this week has passed.
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

        // ---------------- STUDY PLANNER: REMINDERS ----------------
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

        // ---------------- NOTIFICATIONS: schedule + reminder alerts ----------------
        function ensureNotificationPermission(){
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }

        // In-app banner used whenever browser notifications aren't available
        // or haven't been granted; keeps the "you will be notified" promise
        // reliable even inside a webview/preview that blocks Notification.
        function pushInAppNotification(title, body){
          const el = document.createElement('div');
          el.className = 'fixed left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3';
          el.style.cssText = 'top:calc(env(safe-area-inset-top, 12px) + 12px); width:calc(100% - 32px); max-width:480px; box-shadow:0 10px 30px rgba(0,0,0,.18);';
          el.innerHTML = `
            <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style="background:rgba(217,119,6,0.15);color:${NAVY};">${Icon('bell','w-5 h-5')}</div>
            <div class="min-w-0 flex-1">
              <div class="font-bold text-sm text-[${NAVY}] truncate">${title}</div>
              <div class="text-xs text-gray-500">${body}</div>
            </div>
            <button onclick="this.parentElement.remove()" class="text-gray-300 flex-shrink-0">${Icon('close','w-4 h-4')}</button>`;
          document.body.appendChild(el);
          setTimeout(() => el.remove(), 7000);
        }

        function fireStudyNotification(title, body){
          // Real push -- reaches this same account on another device, or
          // even this device once the tab is closed, unlike the in-tab
          // Notification()/banner below which only fire while this exact
          // tab is open and in memory to run the 30s planner check.
          getCurrentUserId().then(myId => {
            if (myId) sendPushTo(myId, { title, body, tag: 'study-reminder' });
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification(title, { body }); return; } catch (e) { /* fall through to in-app banner */ }
          }
          pushInAppNotification(title, body);
        }

        // Ticks every 30s, checking whether any class starts within the next
        // ~10 minutes or any reminder is due within the next ~hour, and fires
        // a one-time notification for each (tracked in notifiedKeys so it
        // doesn't repeat).
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

        // Same idea as checkStudyPlannerNotifications above, but covers
        // anything scheduled inside a class: upcoming lectures (reminder
        // ~10 min before start) and classwork due dates (reminder once the
        // due date arrives). Runs on the same 30s tick so every scheduled
        // item in the Classroom gets a timely reminder without a separate
        // timer.
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

        // ---------------- ADD TO CALENDAR (.ics export) ----------------
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

