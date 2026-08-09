        // ---------------- AI INTERACTIVE CLASS ----------------
        let aiChatMessages = [];
        let aiChatHistoryOpen = false;

        function openAIClass(){
          if (aiChatMessages.length === 0) {
            aiChatMessages.push({ role:'bot', text: "Welcome to your AI Interactive Class! Ask me to explain a topic, quiz you, summarise your slides, or turn a resource into notes. What would you like to do?" });
          }
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
          if (confirm('Clear this chat? This will delete your conversation with StudyBot.')) clearAIChat();
        }

        function clearAIChat(){
          aiChatMessages = [];
          aiChatHistoryOpen = false;
          aiHistoryPanelView = 'history';
          const ov = document.getElementById('overlay');
          if (ov && ov.classList.contains('hidden') === false) ov.innerHTML = aiClassHTML();
          if (rightPanelMode === 'aihistory') renderRightPanelBody();
        }

        function jumpToAIMessage(i){
          aiChatHistoryOpen = false;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = aiClassHTML();
          setTimeout(() => {
            const el = document.getElementById('ai-msg-' + i);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
        }

        // Same "which of my own questions did I ask" list as the desktop
        // panel below, used as a full-screen fallback on phone widths
        // (where the panel doesn't exist) -- reachable via the single
        // history icon in the header instead of a three-dot menu.
        function aiChatHistoryHTML(){
          const userTurns = aiChatMessages
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m.role === 'user');
          const rows = userTurns.length ? userTurns.map(({ m, i }) => {
            const preview = m.text ? m.text : (m.attachments && m.attachments.length ? `${m.attachments.length} attachment${m.attachments.length > 1 ? 's' : ''}` : 'Message');
            return `
              <button onclick="jumpToAIMessage(${i})" class="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 mb-2.5 shadow-sm text-left">
                <div class="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('comment','w-4 h-4')}</div>
                <div class="flex-1 min-w-0 text-sm text-gray-700 truncate">${preview}</div>
                ${Icon('arrowRight','w-4 h-4 text-gray-300 flex-shrink-0')}
              </button>`;
          }).join('') : `<div class="bg-white rounded-3xl p-8 text-center text-gray-400 text-sm">No questions asked yet.</div>`;
          return `
            <div class="w-full px-5 pb-3 flex-shrink-0" style="padding-top:20px;">
              <div class="flex items-center gap-4">
                <button onclick="closeAIChatHistory()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <h1 class="text-base font-bold font-display grad-text">Chat History</h1>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5">${rows}</div>`;
        }

        // Desktop right-panel version of the same list: the panel is
        // already titled "Chat History" (see rightPanelTitle), so this is
        // just the rows, and tapping one scrolls the already-open AI Class
        // straight to that question instead of navigating anywhere.
        // Toggled via the dustbin/history icons added to the panel's
        // corner (see rightPanelAIHistoryActionsHTML): 'history' shows the
        // usual question list, 'delete' swaps in a confirm-to-clear view,
        // letting you pick between the two from that same corner instead
        // of the old clock icon inside AI Class itself.
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
                <div class="text-xs text-gray-500 mb-4">This deletes your whole conversation with StudyBot. This can't be undone.</div>
                <button onclick="clearAIChat()" class="w-full bg-red-500 text-white font-semibold text-sm py-2.5 rounded-2xl mb-2">Clear chat</button>
                <button onclick="setAIHistoryPanelView('history')" class="w-full bg-gray-100 text-gray-700 font-medium text-sm py-2.5 rounded-2xl">Cancel</button>
              </div>`;
          }
          const userTurns = aiChatMessages
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m.role === 'user');
          const rows = userTurns.length ? userTurns.map(({ m, i }) => {
            const preview = m.text ? m.text : (m.attachments && m.attachments.length ? `${m.attachments.length} attachment${m.attachments.length > 1 ? 's' : ''}` : 'Message');
            return `
              <button onclick="jumpToAIMessageInPanel(${i})" class="w-full flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3.5 mb-2.5 text-left">
                <div class="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style="background:rgba(30,144,255,0.1);color:${NAVY};">${Icon('comment','w-4 h-4')}</div>
                <div class="flex-1 min-w-0 text-sm text-gray-700 truncate">${escapeHtml(preview)}</div>
              </button>`;
          }).join('') : `<div class="text-gray-400 text-sm text-center py-10">No questions asked yet.</div>`;
          return `<div class="p-5">${rows}</div>`;
        }

        function jumpToAIMessageInPanel(i){
          const el = document.getElementById('ai-msg-' + i);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        function aiClassHTML(){
          if (aiChatHistoryOpen) return aiChatHistoryHTML();
          return `
            <div class="flex-shrink-0">
              <div class="w-full px-5 pb-3 relative" style="padding-top:20px;">
                <div class="flex items-center justify-between">
                  <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <h1 class="text-base font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">AI Class</h1>
                  <button onclick="toggleAIClassMenu()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(Icon('dashes','w-5 h-5'))}</button>
                </div>
                ${aiClassMenuOpen ? `<div onclick="toggleAIClassMenu()" onwheel="toggleAIClassMenu()" ontouchmove="toggleAIClassMenu()" class="fixed inset-0 z-10"></div>${aiClassMenuDropdownHTML()}` : ''}
              </div>
            </div>
            <div id="ai-chat-log" class="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              ${aiChatLogHTML()}
            </div>
            <div id="ai-attach-strip" class="flex-shrink-0">${aiAttachStripHTML()}</div>
            <div class="p-3 border-t border-gray-100 flex-shrink-0 flex items-center gap-1.5">
              <input type="file" id="ai-file-input" accept="image/*,.pdf,.ppt,.pptx" multiple class="hidden" onchange="handleAIFileSelect(event)">
              <button onclick="document.getElementById('ai-file-input').click()" title="Attach images, PDFs, or PPTX" class="w-8 h-8 bg-gray-100 text-[${NAVY}] rounded-full flex items-center justify-center flex-shrink-0">${Icon('clip','w-4 h-4')}</button>
              <input type="text" id="ai-chat-input" placeholder="Ask StudyBot anything..." onkeydown="if(event.key==='Enter'){sendAIMessage();}" class="flex-1 min-w-0 bg-gray-100 rounded-full px-3 py-2 text-sm">
              <button onclick="toggleAIVoiceInput()" id="ai-mic-btn" class="w-8 h-8 bg-gray-100 text-[${NAVY}] rounded-full flex items-center justify-center flex-shrink-0">${Icon('mic','w-4 h-4')}</button>
              <button onclick="sendAIMessage()" class="w-8 h-8 text-white rounded-full flex items-center justify-center flex-shrink-0" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
            </div>`;
        }

        // ---- AI class file attachments (images, PDFs, PPTX) ----
        let pendingAIAttachments = [];

        function aiFileIcon(type){
          if (type && type.startsWith('image/')) return 'camera';
          return 'file';
        }

        function aiAttachStripHTML(){
          if (!pendingAIAttachments.length) return '';
          return `
            <div class="px-4 pt-3 flex gap-2 flex-wrap">
              ${pendingAIAttachments.map((f,i) => `
                <div class="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700">
                  <div class="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(aiFileIcon(f.type),'w-3.5 h-3.5')}</div>
                  <span class="max-w-[120px] truncate">${escapeHtml(f.name)}</span>
                  <button onclick="removeAIAttachment(${i})" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                </div>`).join('')}
            </div>`;
        }

        function handleAIFileSelect(event){
          const files = Array.from(event.target.files || []);
          const allowed = /image\/.*|application\/pdf|.*presentation.*|.*powerpoint.*/;
          files.forEach(f => {
            const okType = allowed.test(f.type) || /\.(pdf|pptx?|jpe?g|png|gif|webp)$/i.test(f.name);
            if (okType) pendingAIAttachments.push(f); // keep the real File object so it can be scanned like a Resources upload
          });
          event.target.value = '';
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();
        }

        function removeAIAttachment(i){
          pendingAIAttachments.splice(i, 1);
          const strip = document.getElementById('ai-attach-strip');
          if (strip) strip.innerHTML = aiAttachStripHTML();
        }

        let aiVoiceListening = false;
        function toggleAIVoiceInput(){
          const micBtn = document.getElementById('ai-mic-btn');
          if (!micBtn) return;
          if (aiVoiceListening) return;
          aiVoiceListening = true;
          startMicRecording({ micBtnId: 'ai-mic-btn', inputId: 'ai-chat-input', defaultPlaceholder: 'Ask StudyBot anything...' });
          const checkDone = setInterval(() => {
            if (!activeSpeechRecognition) { clearInterval(checkDone); aiVoiceListening = false; }
          }, 200);
        }

        function aiChatLogHTML(){
          const bubbles = aiChatMessages.map((m, i) => m.role === 'bot' ? aiBotBubble(m.text, i) : aiUserBubble(m.text, m.attachments, i)).join('');
          const chips = aiChatMessages.length <= 1 ? `
            <div class="grid grid-cols-2 gap-2 mt-2">
              ${aiTopicChip('Summarise my slides')}
              ${aiTopicChip('Make notes for me')}
            </div>` : '';
          return bubbles + chips;
        }

        function aiBotBubble(text, id){
          return `
            <div id="ai-msg-${id}" class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style="background:${NAVY};">${Icon('bot','w-5 h-5')}</div>
              <div class="bg-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-700" style="max-width:80%;">${text}</div>
            </div>`;
        }

        function aiUserBubble(text, attachments, id){
          const files = (attachments && attachments.length) ? `
            <div class="flex flex-col gap-1.5 ${text ? 'mb-1.5' : ''}">
              ${attachments.map(f => `
                <div class="flex items-center gap-2 bg-white/15 rounded-xl px-2.5 py-1.5">
                  ${Icon(aiFileIcon(f.type),'w-4 h-4')}<span class="text-xs truncate">${escapeHtml(f.name)}</span>
                </div>`).join('')}
            </div>` : '';
          return `
            <div id="ai-msg-${id}" class="flex items-start justify-end gap-3">
              <div class="text-white rounded-2xl px-4 py-3 text-sm" style="max-width:80%;background:${NAVY};">${files}${text}</div>
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
          if (inputEl) inputEl.value = '';
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
        }

        // Talks to Claude for real, grounding the answer in excerpts from
        // whatever the student has uploaded under Resources (when relevant).
        async function getAIResponse(text, attachments){
          const docs = (attachments || []).filter(f => /\.(pdf|docx|pptx)$/i.test(f.name));
          const images = (attachments || []).filter(f => !docs.includes(f));
          let ackLine = '';
          if (docs.length) {
            const names = docs.map(f => f.name).join(', ');
            ackLine = `<span class="inline-flex items-center gap-1 align-middle">${Icon('paperclip','w-3.5 h-3.5 inline')}</span> Scanning ${names} now: check Resources shortly for flashcards and practice questions built from ${docs.length > 1 ? 'them' : 'it'}.\n\n`;
          } else if (images.length) {
            const names = images.map(f => f.name).join(', ');
            ackLine = `<span class="inline-flex items-center gap-1 align-middle">${Icon('paperclip','w-3.5 h-3.5 inline')}</span> Got ${names}: I can chat about images, but for flashcards and practice questions, attach a PDF, DOCX, or PPTX instead.\n\n`;
          }
          if (!text) return ackLine || "What would you like help with?";
          try {
            const context = buildResourceContext();
            const system = 'You are StudyBot, a friendly, encouraging AI tutor inside a study app for students across any subject. ' +
              'Answer the student clearly and concisely (2-5 sentences unless they ask for more detail or a worked example). ' +
              'Ground your answer in the excerpts from their uploaded resources when they are relevant to the question. ' +
              'If nothing relevant was uploaded, answer from your general knowledge of the subject instead. Never mention Claude or Anthropic.' +
              (context ? '\n\nExcerpts from the student\'s uploaded resources:\n' + context : '\n\nThe student has not uploaded any resources yet.');
            const reply = await callClaude(system, text);
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
        // postCourseInsertRemote/loadCoursesRemote below now log the actual
        // Supabase error to the console instead of swallowing it, so you
        // can confirm from devtools whether this is in fact the cause.
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
        let newCourseDraft = null;
        let newCourseEditingId = null; // set while editing an existing course instead of creating a new one
        let newCourseAddingItemModuleIndex = null;
        let newCourseAddingItemDraft = null;
        // When set (to the item's index within the module), the Add Part
        // form below is in edit mode -- confirmAddCourseItem() overwrites
        // that existing item instead of pushing a new one. null means the
        // form is adding a brand-new part.
        let newCourseEditingItemIndex = null;
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
        // no matter how much video is attached to it. Requires a public
        // bucket named COURSE_MEDIA_BUCKET in the configured Supabase
        // project; if upload fails or Supabase isn't configured, the
        // in-browser preview URL is kept as a same-session-only fallback
        // (see handleAddingItemMediaSelected below) so it still works for
        // whoever added it, it just won't reach other students until a
        // bucket exists.
        const COURSE_MEDIA_BUCKET = 'course-media';

        async function uploadCourseItemMediaToStorage(file, itemId){
          const sb = getSupabaseClient();
          if (!sb) return null;
          try {
            const path = `${itemId}-${escapeHtml(file.name)}`;
            const { error } = await sb.storage.from(COURSE_MEDIA_BUCKET).upload(path, file, { upsert: true });
            if (error) { console.warn('Course media upload failed:', error.message); return null; }
            const { data } = sb.storage.from(COURSE_MEDIA_BUCKET).getPublicUrl(path);
            return (data && data.publicUrl) || null;
          } catch (err) {
            console.warn('Course media upload failed:', err);
            return null;
          }
        }

        function resetNewCourseDraft(){
          newCourseDraft = { title:'', description:'', deliveryType:'uploaded', modules:[], resources:[] };
        }

        function setClassroomAreaTab(tab){
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
          return course.modules.reduce((n, m) => n + m.items.length, 0);
        }

        function courseCompletedItems(course){
          return course.modules.reduce((n, m) => n + m.items.filter(it => it.completed).length, 0);
        }

        // A module counts as "done" (gets the Coursera-style checkmark pill)
        // once it has at least one item and every item in it is completed.
        function courseModuleCompleted(course, mi){
          const m = course.modules[mi];
          return !!(m && m.items.length && m.items.every(it => it.completed));
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
          const isLive = c.deliveryType === 'live';
          const isAdmin = isCurrentUserAdmin();
          return `
            <div onclick="openCourseDetail('${c.id}')" class="relative bg-white rounded-3xl p-5 mb-3 shadow-sm cursor-pointer">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  ${isAdmin ? `<button onclick="event.stopPropagation(); deleteCourse('${c.id}')" title="Delete course" class="w-6 h-6 -ml-1 rounded-full flex items-center justify-center text-red-400 flex-shrink-0">${Icon('trash','w-3.5 h-3.5')}</button>` : ''}
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400 truncate">${escapeHtml(c.org)}</div>
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${isLive ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}">${isLive ? '● Live' : 'Uploaded'}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  ${enrolled ? `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">Enrolled</span>` : ''}
                  ${isAdmin ? `<button onclick="toggleCourseCardMenu('${c.id}', event)" class="w-7 h-7 -mr-1.5 rounded-full flex items-center justify-center text-gray-400 flex-shrink-0">${Icon('dots','w-4 h-4')}</button>` : ''}
                </div>
              </div>
              <div class="text-lg font-bold font-display mb-1" style="color:${NAVY};">${escapeHtml(c.title)}</div>
              <div class="text-xs text-gray-400">${c.modules.length} module${c.modules.length === 1 ? '' : 's'} · ${total} lesson${total === 1 ? '' : 's'}${enrolled ? ` · ${done}/${total} completed` : ''}</div>
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
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        function setCourseDetailTab(tab){
          courseDetailTab = tab;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        function enrollInCourse(){
          if (!enrolledCourseIds.includes(currentCourseId)) enrolledCourseIds.push(currentCourseId);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
          queueSaveUserState();
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
                : overlayHeader(escapeHtml(c.title), '50px')}
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
                <div class="flex items-center gap-2 mb-3">
                  <button onclick="openCourseTeachers('${c.id}')" class="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">${escapeHtml(c.org)}${(c.teachers && c.teachers.length) ? ` +${c.teachers.length}` : ''}</button>
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isLive ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}">${isLive ? '● Live Teaching' : 'Uploaded · Self-paced'}</span>
                </div>
                <div class="text-xl font-bold font-display text-gray-800 mb-2">${escapeHtml(c.title)}</div>
                <div class="text-sm text-gray-600 leading-relaxed mb-4">${escapeHtml(c.description)}</div>

                <div class="flex gap-2 mb-4 bg-gray-100 rounded-full p-1">
                  <button onclick="setCourseDetailTab('content')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'content' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'content' ? `background:${NAVY};` : ''}">Content</button>
                  <button onclick="setCourseDetailTab('announcements')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'announcements' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'announcements' ? `background:${NAVY};` : ''}">Announcements${announcements.length ? ` (${announcements.length})` : ''}</button>
                  <button onclick="setCourseDetailTab('resources')" class="flex-1 rounded-full py-2 text-xs font-bold ${courseDetailTab === 'resources' ? 'text-white' : 'text-gray-500'}" style="${courseDetailTab === 'resources' ? `background:${NAVY};` : ''}">Resources${resources.length ? ` (${resources.length})` : ''}</button>
                </div>

                ${courseDetailTab === 'resources' ? courseResourcesTabHTML(c, enrolled) : courseDetailTab === 'announcements' ? courseAnnouncementsTabHTML(c) : (!c.modules.length ? `
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
                        ${modDone
                          ? `<span class="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">${Icon('check','w-2.5 h-2.5')}</span>`
                          : (i > 0 && !enrolled ? Icon('lock','w-3 h-3') : '')} ${i + 1}
                      </button>`;
                    }).join('')}
                  </div>
                  ${!enrolled ? `
                    <button onclick="enrollInCourse()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white mb-5" style="background:rgba(30,144,255,0.85);">
                      ${Icon('plus','w-4 h-4')} Enroll to unlock all modules
                    </button>` : `
                    <div class="mb-5">
                      ${pct === 100 ? `
                        <div class="text-sm font-bold text-gray-800 mb-1">Course Completed</div>
                        <div class="text-xs text-gray-400 mb-2">Congrats on completing the course!</div>
                      ` : `
                        <div class="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
                          <span>Your progress</span><span>${done}/${total} completed</span>
                        </div>
                      `}
                      <div class="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div class="h-full rounded-full" style="width:${pct}%;background:${pct === 100 ? '#059669' : NAVY};"></div>
                      </div>
                    </div>`}
                  <div class="text-sm font-bold text-gray-700 mb-1">${escapeHtml(mod.title)}</div>
                  ${mod.description ? `<div class="text-xs text-gray-500 leading-relaxed mb-3">${escapeHtml(mod.description)}</div>` : `<div class="mb-3"></div>`}
                  ${locked ? `
                    <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                      <div class="flex justify-center mb-2 text-gray-400">${Icon('lock','w-6 h-6')}</div>
                      Enroll to unlock this module. Module 1 is free to preview.
                    </div>` : mod.items.map(it => courseItemCardHTML(c, it)).join('')}
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
          if (!resources.length) {
            return `<div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">No extra resources have been added to this course yet.</div>`;
          }
          if (!enrolled) {
            return `
              <button onclick="enrollInCourse()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white mb-5" style="background:rgba(30,144,255,0.85);">
                ${Icon('plus','w-4 h-4')} Enroll to unlock resources
              </button>
              <div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">
                <div class="flex justify-center mb-2 text-gray-400">${Icon('lock','w-6 h-6')}</div>
                ${resources.length} resource${resources.length === 1 ? '' : 's'} available after enrolling.
              </div>`;
          }
          return resources.map(r => `
            <a href="${r.url ? escapeHtml(r.url) : '#'}" target="_blank" rel="noopener" class="flex items-center gap-3 bg-white rounded-3xl p-4 mb-3 shadow-sm border border-gray-100 ${r.url ? '' : 'pointer-events-none opacity-60'}">
              <div class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};">${Icon(r.type === 'audio' ? 'mic' : 'video','w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(r.title || 'Untitled resource')}</div>
                <div class="text-xs text-gray-400">${r.type === 'audio' ? 'Audio' : 'Video'}${r.duration ? ' · ' + escapeHtml(r.duration) : ''}${r.url ? '' : ' · No link added yet'}</div>
              </div>
              ${r.url ? `<span class="text-gray-400 flex-shrink-0">${Icon('download','w-4 h-4')}</span>` : ''}
            </a>`).join('');
        }

        // ---- Course Announcements (admin-posted updates shown to
        // everyone browsing the course, enrolled or not -- e.g. "Module 4
        // is now live" or "Deadline extended to Friday"). Kept separate
        // from the graded Module/Item curriculum and from Classes'
        // Google-Classroom-style stream, but styled the same way so it
        // feels consistent across the app. ----
        function courseAnnouncementsTabHTML(course){
          const list = course.announcements || [];
          const isAdmin = isCurrentUserAdmin();
          return `
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
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        function deleteCourseAnnouncement(courseId, index){
          if (!isCurrentUserAdmin()) return;
          const c = allCourses.find(x => x.id === courseId);
          if (!c || !c.announcements) return;
          c.announcements.splice(index, 1);
          postCourseInsertRemote(c);
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseDetailHTML();
        }

        function courseItemCardHTML(course, item){
          const thumb = item.mediaType === 'image' && item.mediaUrl
            ? `<img src="${item.mediaUrl}" class="w-10 h-10 rounded-xl object-cover flex-shrink-0">`
            : item.mediaType === 'video' && item.mediaUrl
              ? `<div class="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0 text-white">${Icon('video','w-4 h-4')}</div>`
              : '';
          return `
            <div onclick="openCourseItemDetail('${course.id}','${item.id}')" class="bg-white rounded-3xl p-5 mb-3 shadow-sm border border-gray-100 cursor-pointer">
              <div class="flex items-center justify-between gap-2 mb-3">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${thumb}
                  <div class="font-bold text-gray-800 truncate">${escapeHtml(item.title)}</div>
                </div>
                <span class="text-gray-400 flex-shrink-0">${Icon('download','w-4 h-4')}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-xs font-semibold ${item.completed ? 'border-emerald-600 text-emerald-700' : 'border-gray-300 text-gray-500'}">
                  ${item.completed ? Icon('check','w-3.5 h-3.5') : ''} ${courseItemTypeLabel(item.type)}
                </span>
                ${item.duration ? `<span class="border border-gray-200 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500">${escapeHtml(item.duration)}</span>` : ''}
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
          return { course:c, item:null };
        }

        function markCourseItemComplete(){
          const { item } = findCourseItem();
          if (item) item.completed = true;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseItemDetailHTML();
          queueSaveUserState();
        }

        function selectQuizAnswer(qIndex, optIndex){
          if (courseQuizSubmitted[currentCourseItemId]) return;
          if (!courseQuizAnswers[currentCourseItemId]) courseQuizAnswers[currentCourseItemId] = [];
          courseQuizAnswers[currentCourseItemId][qIndex] = optIndex;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = courseItemDetailHTML();
          queueSaveUserState();
        }

        function submitCourseQuiz(){
          courseQuizSubmitted[currentCourseItemId] = true;
          const { item } = findCourseItem();
          if (item) item.completed = true;
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
              ${overlayHeader(escapeHtml(item.title), '50px', `openCourseDetail('${course.id}')`)}
              <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
                <div class="flex items-center gap-2 mb-4">
                  <span class="border border-gray-200 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500">${courseItemTypeLabel(item.type)}</span>
                  ${item.duration ? `<span class="border border-gray-200 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500">${escapeHtml(item.duration)}</span>` : ''}
                </div>
                ${item.type === 'video' ? `
                  <div class="bg-black rounded-3xl mb-3 overflow-hidden flex items-center justify-center" style="aspect-ratio:16/9;">
                    ${item.mediaUrl
                      ? `<video src="${item.mediaUrl}" class="w-full h-full object-cover" controls></video>`
                      : `<span class="text-white">${Icon('video','w-10 h-10')}</span>`}
                  </div>` : ''}
                ${item.type === 'image' ? `
                  <div class="bg-black rounded-3xl mb-3 overflow-hidden flex items-center justify-center" style="aspect-ratio:16/9;">
                    ${item.mediaUrl
                      ? `<img src="${item.mediaUrl}" class="w-full h-full object-cover">`
                      : `<span class="text-white">${Icon('camera','w-10 h-10')}</span>`}
                  </div>` : ''}
                ${item.type === 'audio' ? `
                  <div class="bg-black rounded-3xl mb-3 flex items-center justify-center" style="aspect-ratio:21/9;">
                    <span class="text-white">${Icon('mic','w-10 h-10')}</span>
                  </div>` : ''}
                ${(item.type === 'video' || item.type === 'audio' || item.type === 'image') && item.description ? `
                  <div class="bg-white rounded-3xl p-5 shadow-sm mb-5 text-sm text-gray-700 leading-relaxed">${escapeHtml(item.description)}</div>` : ''}
                ${(item.type === 'reading' || item.type === 'assignment' || item.type === 'project') ? `
                  <div class="bg-white rounded-3xl p-5 shadow-sm mb-5 text-sm text-gray-700 leading-relaxed">${escapeHtml(item.description || 'No additional content was added for this item yet.')}</div>` : ''}
                ${isQuiz ? courseQuizFormHTML(item) : ''}
                ${!isQuiz ? `
                  <button onclick="markCourseItemComplete()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white" style="background:${item.completed ? '#059669' : 'rgba(30,144,255,0.85)'};">
                    ${item.completed ? Icon('check','w-4 h-4') : ''} ${item.completed ? 'Completed' : 'Mark as complete'}
                  </button>` : ''}
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
              : `<button onclick="submitCourseQuiz()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white mb-4" style="background:rgba(30,144,255,0.85);">Submit</button>`}`;
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
          newCourseDraft = JSON.parse(JSON.stringify({ title: c.title, description: c.description, deliveryType: c.deliveryType || 'uploaded', modules: c.modules, resources: c.resources || [] }));
          newCourseEditingId = courseId;
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = null;
          openOverlay('newCourse');
        }

        function rerenderNewCourseOverlay(){
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = newCourseHTML();
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
          if (newCourseAddingItemModuleIndex === mi) { newCourseAddingItemModuleIndex = null; newCourseEditingItemIndex = null; newCourseAddingItemDraft = null; }
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

        function openAddCourseItemForm(mi){
          newCourseAddingItemModuleIndex = mi;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = { title:'', type:'video', duration:'', description:'', questions:[], mediaUrl:null, mediaType:null, mediaUploading:false };
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
          newCourseAddingItemDraft = {
            title: it.title || '',
            type: it.type || 'video',
            duration: it.duration || '',
            description: it.description || '',
            questions: (it.questions || []).map(q => ({ text:q.text || '', options:(q.options || ['', '', '', '']).slice(), correct:q.correct || 0 })),
            mediaUrl: it.mediaUrl || null,
            mediaType: it.mediaType || null,
            mediaUploading: false,
          };
          rerenderNewCourseOverlay();
        }

        function cancelAddCourseItem(){
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
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
          const isVideo = file.type.startsWith('video/');
          d.mediaType = isVideo ? 'video' : 'image';
          d.mediaUrl = URL.createObjectURL(file);
          d.mediaUploading = true;
          rerenderNewCourseOverlay();
          const itemId = 'item' + Date.now() + Math.random().toString(36).slice(2,6);
          d.pendingItemId = itemId;
          uploadCourseItemMediaToStorage(file, itemId).then(remoteUrl => {
            if (newCourseAddingItemDraft !== d) return; // form was cancelled/closed meanwhile
            if (remoteUrl) d.mediaUrl = remoteUrl; // otherwise keep the local preview as a same-session fallback
            d.mediaUploading = false;
            rerenderNewCourseOverlay();
          });
        }

        function removeAddingItemMedia(){
          const d = newCourseAddingItemDraft;
          if (!d) return;
          d.mediaUrl = null;
          d.mediaType = null;
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
          if (!d.title.trim()) { alert('Please add a title for this item.'); return; }
          if (d.mediaUploading) { alert('Still uploading the file -- give it a moment and try again.'); return; }
          const isQuiz = courseItemIsQuiz(d.type);
          if (isQuiz && !d.questions.length) { alert('Add at least one question to this quiz.'); return; }
          const item = {
            id: 'item' + Date.now() + Math.random().toString(36).slice(2,6),
            title: d.title.trim(),
            type: d.type,
            duration: d.duration.trim(),
            description: d.description.trim(),
            mediaUrl: (d.type === 'video' || d.type === 'image') ? (d.mediaUrl || null) : null,
            mediaType: (d.type === 'video' || d.type === 'image') ? d.mediaType : null,
            completed:false,
          };
          if (isQuiz) item.questions = d.questions.map(q => ({ text:q.text.trim(), options:q.options.map(o => o.trim()), correct:q.correct }));
          const items = newCourseDraft.modules[newCourseAddingItemModuleIndex].items;
          if (newCourseEditingItemIndex !== null) {
            // Editing in place -- keep the original id/completed state,
            // overwrite everything else with the edited values.
            const existing = items[newCourseEditingItemIndex];
            item.id = existing.id;
            item.completed = existing.completed;
            items[newCourseEditingItemIndex] = item;
          } else {
            items.push(item);
          }
          newCourseAddingItemModuleIndex = null;
          newCourseEditingItemIndex = null;
          newCourseAddingItemDraft = null;
          rerenderNewCourseOverlay();
        }

        async function publishNewCourse(){
          if (!isCurrentUserAdmin()) return;
          const d = newCourseDraft;
          if (!d.title.trim()) { alert('Please add a course title.'); return; }
          if (!d.modules.length || !d.modules.some(m => m.items.length)) { alert('Add at least one module with at least one item.'); return; }
          if (newCourseEditingId) {
            const c = allCourses.find(x => x.id === newCourseEditingId);
            if (c) {
              c.title = d.title.trim();
              c.description = d.description.trim();
              c.deliveryType = d.deliveryType || 'uploaded';
              c.modules = d.modules;
              c.resources = d.resources || [];
              // Keep the remote copy in sync too, same pattern as a
              // brand-new course below -- awaited now so we can warn if it
              // silently failed instead of assuming it always works.
              const synced = await postCourseInsertRemote(c);
              if (!synced) alert("Saved on this device, but couldn't sync to the shared course catalog -- it may not show up for other students or survive your next sign-in. Check the console for details.");
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
            announcements: [], // admin-posted updates -- see courseAnnouncementsTabHTML
            teachers: [], // additional teachers invited on top of Stitch Team -- see openCourseTeachers
          };
          allCourses.unshift(course);
          // Persist it so other users see it too, and so it's still there
          // the next time this admin signs in -- awaited so a failure can
          // actually be surfaced instead of quietly leaving the course
          // local-only (see the courses table SQL comment above).
          const synced = await postCourseInsertRemote(course);
          if (!synced) alert("This course was saved on this device only -- it couldn't sync to the shared catalog, so it will disappear next time you sign in and won't show up for other students. Check the console for the Supabase error, or make sure the courses table + policies from the SQL comment above are set up.");
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
          if (!c) return `${overlayHeader('Teachers')}<div class="p-5 text-center text-gray-400 text-sm">This course is no longer available.</div>`;
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
          if (!isValidEmail(email)) { alert('Please enter a valid email address.'); return; }
          if (!c.teachers) c.teachers = [];
          if (c.teachers.some(t => t.email.toLowerCase() === email.toLowerCase())) {
            alert('That teacher has already been invited to this course.');
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
          if (!confirm(`Delete "${c.title}"? This removes it for everyone and can't be undone.`)) return;
          const idx = allCourses.indexOf(c);
          if (idx !== -1) allCourses.splice(idx, 1);
          enrolledCourseIds = enrolledCourseIds.filter(id => id !== courseId);
          deleteCourseRemote(courseId);
          if (currentCourseId === courseId) closeOverlay();
          renderStudy();
          queueSaveUserState();
        }

        function newCourseHTML(){
          const d = newCourseDraft;
          const isEditing = !!newCourseEditingId;
          return `
            ${overlayHeader(isEditing ? 'Edit Course' : 'Create a Course', '20px')}
            <div class="flex-1 overflow-y-auto px-5 pb-8">
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

              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Resources <span class="normal-case font-medium text-gray-400">(supplementary video &amp; audio)</span></div>
              ${(d.resources || []).map((r, ri) => courseDraftResourceHTML(r, ri)).join('')}
              <button onclick="addCourseDraftResource()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border border-dashed border-gray-300 text-gray-500 mb-6">
                ${Icon('plus','w-4 h-4')} Add Resource
              </button>

              <button onclick="publishNewCourse()" class="w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm text-white" style="background:rgba(30,144,255,0.85);">
                ${isEditing ? 'Save Changes' : 'Publish Course'}
              </button>
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

        function addCourseItemFormHTML(){
          const d = newCourseAddingItemDraft;
          const isEditing = newCourseEditingItemIndex !== null;
          const isQuiz = courseItemIsQuiz(d.type);
          const isMedia = d.type === 'video' || d.type === 'image';
          return `
            <div class="bg-blue-50 rounded-2xl p-3 mb-2">
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white text-gray-500">${isEditing ? 'Editing this Part, inside the Module above' : 'This is a Part, inside the Module above'}</span>
              </div>
              <input type="text" value="${escapeHtml(d.title)}" oninput="updateAddingItemField('title', this.value)" placeholder="Part title" class="w-full bg-white rounded-xl px-3 py-2 text-sm outline-none mb-2">
              <div class="flex gap-1.5 overflow-x-auto no-scrollbar mb-2">
                ${courseItemTypes.map(t => `
                  <button onclick="setAddingItemType('${t.key}')" class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${d.type === t.key ? 'text-white' : 'bg-white text-gray-500'}" style="${d.type === t.key ? `background:${NAVY};` : ''}">${t.label}</button>`).join('')}
              </div>
              ${isMedia ? `
                <input type="file" id="adding-item-media-input" accept="${d.type === 'video' ? 'video/*' : 'image/*'}" class="hidden" onchange="handleAddingItemMediaSelected(event)">
                ${d.mediaUrl ? `
                  <div class="relative rounded-xl overflow-hidden mb-2 bg-black" style="aspect-ratio:16/9;">
                    ${d.mediaType === 'image'
                      ? `<img src="${d.mediaUrl}" class="w-full h-full object-cover">`
                      : `<video src="${d.mediaUrl}" class="w-full h-full object-cover" controls></video>`}
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
            .subscribe();
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
            alert('This class was deleted by its teacher.');
          } else if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classSettings' && currentClassId === deletedId) {
            currentClassId = null;
            closeOverlay();
            alert('This class was deleted by its teacher.');
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
        function classRowToLocal(row, myUserId){
          return Object.assign({}, row.data, {
            id: row.id,
            code: row.code,
            teacherId: row.teacher_id,
            role: row.teacher_id === myUserId ? 'teacher' : 'student',
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
              alert('Class code copied: ' + code);
            } catch (err) {
              alert('Class code: ' + code);
            }
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => alert('Class code copied: ' + code)).catch(legacyCopy);
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
            await onDone();
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
          if (!code) { alert('Enter a class code to join'); return; }
          const sb = getSupabaseClient();
          if (!sb) { alert('Sign-in backend is not configured yet -- classes can\'t be joined.'); return; }
          const { data: userRes } = await sb.auth.getUser();
          const me = userRes && userRes.user;
          if (!me) { alert('Please sign in again to join a class.'); return; }
          let row, error;
          try {
            ({ data: row, error } = await sb.rpc('join_class_by_code', { p_code: code }));
          } catch (e) { error = e; }
          if (Array.isArray(row)) row = row[0];
          if (error || !row) { alert("We couldn't find that class. Check the code and try again."); return; }
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
          if (!name) { alert('Enter a class name'); return; }
          const sb = getSupabaseClient();
          if (!sb) { alert('Sign-in backend is not configured yet -- classes can\'t be created.'); return; }
          const { data: userRes } = await sb.auth.getUser();
          const me = userRes && userRes.user;
          if (!me) { alert('Please sign in again to create a class.'); return; }
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
              alert("Couldn't create the class -- try again.");
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

        function classStreamTabHTML(cls){
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
                    <div class="text-xs text-gray-400">${a.time}</div>
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
                        <div class="text-xs text-gray-400"><span class="font-semibold text-gray-700">${escapeHtml(c.name)}</span> · ${c.time}</div>
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
          a.comments.push({ name: 'You', text, time: 'now' });
          if (input) { input.value = ''; input.style.height = 'auto'; }
          document.getElementById('overlay').innerHTML = classDetailHTML();
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
          joinLiveLecture(lecture.id);
        }

        function startScheduledLectureNow(id){
          const cls = myClasses.find(c => c.id === currentClassId);
          if (!cls) return;
          const l = (cls.lectures || []).find(x => x.id === id);
          if (!l) return;
          l.status = 'live';
          joinLiveLecture(id);
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
          lectureResourcesPanelOpen = false;
          lectureFloatingReactions = [];
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
          lectureChannel.track({ name: (profileData && profileData.name) || 'Student', photo: (profileData && profileData.photo) || null, muted: liveLectureState.muted, camOff: liveLectureState.camOff, handRaised: liveLectureState.handRaised });
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
          lectureReactionsSheetOpen = !lectureReactionsSheetOpen;
          updateLectureSheetsRegion();
        }

        function toggleLectureMoreSheet(){
          lectureReactionsSheetOpen = false;
          lectureMoreSheetOpen = !lectureMoreSheetOpen;
          updateLectureSheetsRegion();
        }

        function closeLectureSheets(){
          lectureMoreSheetOpen = false;
          lectureReactionsSheetOpen = false;
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

        function sendLectureReaction(icon){
          const id = 'r' + Date.now() + Math.random().toString(36).slice(2);
          lectureFloatingReactions.push({ id, icon });
          lectureReactionsSheetOpen = false;
          rerenderLectureScreen();
          setTimeout(() => {
            lectureFloatingReactions = lectureFloatingReactions.filter(r => r.id !== id);
            const el = document.getElementById('lecture-reactions-float');
            if (el) el.innerHTML = lectureReactionsFloatHTML();
          }, 2400);
        }

        function lectureReactionsFloatHTML(){
          if (!lectureFloatingReactions.length) return '';
          return lectureFloatingReactions.map(r => `<span class="lecture-reaction-float w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700">${Icon(r.icon,'w-5 h-5')}</span>`).join('');
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

        function endLecture(){
          clearLectureTimer();
          stopLectureLocalStream();
          teardownLectureSignaling();
          inLectureCall = false;
          const cls = myClasses.find(c => c.id === liveLectureState.classId);
          const isTeacher = cls && cls.role === 'teacher';
          // Only the teacher ending the lecture actually ends it for the
          // class. If a student just leaves, the lecture stays live in the
          // Stream so they (or anyone else) can rejoin it later.
          if (cls && isTeacher) cls.lectures = (cls.lectures || []).filter(l => l.id !== liveLectureState.lectureId);
          liveLectureState = { classId: null, lectureId: null, connected: false, seconds: 0, muted: false, camOff: false, handRaised: false, view: 'grid' };
          lectureSlides = null;
          if (whiteboardAttachment && whiteboardAttachment.url) URL.revokeObjectURL(whiteboardAttachment.url);
          lectureAttachments.forEach(a => { if (a.url) URL.revokeObjectURL(a.url); });
          whiteboardStrokes = [];
          whiteboardAttachment = null;
          lecturePreview = null;
          lectureMoreSheetOpen = false;
          lectureReactionsSheetOpen = false;
          lectureResourcesPanelOpen = false;
          lectureFloatingReactions = [];
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

        function lectureGridHTML(){
          const isDesktopLecture = window.innerWidth >= 1024;
          const localTile = `
            <div class="relative rounded-2xl overflow-hidden bg-gray-800" style="aspect-ratio:4/3;" id="lecture-local-tile">
              <div id="lecture-local-media" class="w-full h-full">${lectureLocalMediaHTML()}</div>
              <div class="absolute bottom-1.5 left-1.5 text-xs font-semibold text-white bg-black/40 rounded-full px-2 py-0.5">You · Host</div>
              <div id="lecture-local-badges">${lectureLocalBadgesHTML()}</div>
            </div>`;
          const peerIds = Object.keys(lecturePresence);
          const otherTiles = peerIds.map((peerId, i) => {
            const p = lecturePresence[peerId];
            const stream = lectureRemoteStreams[peerId];
            const showVideo = !p.camOff && stream && stream.getVideoTracks().some(t => t.enabled);
            return `
              <div class="relative rounded-2xl overflow-hidden flex items-center justify-center ${LECTURE_TILE_COLORS[i % LECTURE_TILE_COLORS.length]}" style="aspect-ratio:4/3;">
                <video id="lecture-remote-video-${peerId}" autoplay playsinline class="w-full h-full object-cover ${showVideo ? '' : 'hidden'}"></video>
                ${!showVideo ? `<span class="text-white font-bold text-2xl">${escapeHtml((p.name || '?').trim().charAt(0).toUpperCase())}</span>` : ''}
                <div class="absolute bottom-1.5 left-1.5 text-xs font-semibold text-white bg-black/30 rounded-full px-2 py-0.5 max-w-[85%] truncate">${escapeHtml(p.name)}</div>
                ${p.muted ? `<div class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white">${Icon('micOff','w-3.5 h-3.5')}</div>` : ''}
                ${p.handRaised ? `<div class="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center text-white">${Icon('handRaised','w-3.5 h-3.5')}</div>` : ''}
              </div>`;
          }).join('');
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
            <div class="${gridClass}" style="${gridStyle}">${localTile}${otherTiles}</div>
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
              lectureChannel.track({ name: (profileData && profileData.name) || 'Student', photo: (profileData && profileData.photo) || null, muted: liveLectureState.muted, camOff: liveLectureState.camOff, handRaised: false });
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
          Object.keys(state).forEach(key => {
            if (key === myLecturePeerId) return;
            const meta = (state[key] && state[key][0]) || {};
            seen.add(key);
            lecturePresence[key] = { name: meta.name || 'Student', photo: meta.photo || null, muted: !!meta.muted, camOff: !!meta.camOff, handRaised: !!meta.handRaised };
            ensureLecturePeerConnection(key);
          });
          Object.keys(lecturePresence).forEach(key => { if (!seen.has(key)) leaveLecturePeer(key); });
          rerenderLectureScreen();
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
          if (ext !== 'pdf' && ext !== 'pptx') { alert('Please choose a PDF or PPTX file to attach.'); return; }
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
        function wbClear(){ if (!confirm('Clear the whiteboard?')) return; whiteboardStrokes = []; redrawWhiteboard(); broadcastLectureSignal({ type: 'wb-strokes', strokes: whiteboardStrokes }); }

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
          else alert('Please choose a PDF or PPTX file to present.');
        }

        async function loadPdfSlides(file){
          try {
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            lectureSlides = { type: 'pdf', pdfDoc: pdf, total: pdf.numPages, current: 1, fileName: file.name };
            setLectureView('slides');
          } catch (err) {
            alert('Could not open this PDF: ' + err.message);
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
            alert('Could not read this PPTX file: ' + err.message);
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
            ${(lectureReactionsSheetOpen || lectureMoreSheetOpen) ? `<div onclick="closeLectureSheets()" class="absolute inset-0 z-20" style="background:rgba(10,15,25,0.25);"></div>` : ''}
            ${lectureReactionsSheetOpen ? lectureReactionsSheetHTML() : ''}
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
              <input type="file" id="lecture-doc-input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" class="hidden" onchange="handleLectureDocAttach(event)">
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
                ${stageHTML}
                <div id="lecture-reactions-float" class="absolute bottom-3 right-3 flex flex-col items-end gap-1 z-10" style="pointer-events:none;">${lectureReactionsFloatHTML()}</div>
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
            <div class="absolute left-1/2 z-30 flex items-center gap-2 rounded-full py-2 px-3 shadow-lg bg-white overflow-x-auto" style="bottom:78px;transform:translateX(-50%);max-width:92vw;">
              ${reactionIcons.map(r => `
                <button onclick="sendLectureReaction('${r.icon}')" title="${escapeHtml(r.label)}" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100" style="color:${r.color};">${Icon(r.icon,'w-5 h-5')}</button>`).join('')}
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
                ${grid("lectureAttachDocuments()", 'doc', 'Docs', false)}
                ${grid("lectureAttachMedia()", 'camera', 'Media', false)}
                ${grid("toggleLecturePresent()", 'monitor', 'Slides', view === 'slides')}
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
            ${overlayHeader('Schedule Lecture')}
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
          if (!title || !date || !time) { alert('Please fill in the title, date, and time.'); return; }
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
            ${overlayHeader('Notifications')}
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

        // Small status pill: what state this piece of classwork is in for
        // the current student (not submitted / turned in / graded / a quiz
        // score), so it's visible right from the list without opening it.
        function classworkStatusBadge(w){
          if (w.type === 'quiz') {
            return w.quizSubmission
              ? `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-green-100 text-green-700">Score: ${w.quizSubmission.autoScore}/${w.quizSubmission.total}</span>`
              : `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not attempted</span>`;
          }
          if (w.type === 'material') return '';
          if (w.type === 'poll') {
            return w.myVote !== null
              ? `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-sky-100 text-sky-700">Voted</span>`
              : `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not voted</span>`;
          }
          if (w.graded) return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-green-100 text-green-700">Graded: ${w.score}${w.points ? '/' + w.points : ''}</span>`;
          if (w.submission) return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-sky-100 text-sky-700">Turned in</span>`;
          return `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not submitted</span>`;
        }

        function classClassworkTabHTML(cls){
          const isTeacher = cls.role === 'teacher';
          const materials = cls.classwork.filter(w => w.type === 'material');
          const work = cls.classwork.filter(w => w.type !== 'material');
          const row = w => `
            <div onclick="openClassworkDetail('${w.id}')" class="bg-white rounded-3xl p-4 mb-3 shadow-sm flex items-start gap-3 cursor-pointer">
              <span class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[${NAVY}] flex-shrink-0">${Icon(classworkTypeIcon(w.type),'w-5 h-5')}</span>
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-sm text-gray-800 truncate">${escapeHtml(w.title)}</div>
                ${w.instructions ? `<div class="text-xs text-gray-400 mt-0.5 line-clamp-2">${w.instructions}</div>` : ''}
                <div class="text-xs text-gray-400 mt-1.5 flex items-center gap-2 flex-wrap">
                  <span>${w.type === 'quiz' ? (w.questions.length + ' questions') : w.type === 'poll' ? (w.options.length + ' options') : (w.points ? w.points + ' points' : 'Unscored')}${w.due ? ' · Due ' + w.due : ''}</span>
                  ${classworkStatusBadge(w)}
                </div>
              </div>
              <div class="text-gray-300 flex-shrink-0">›</div>
            </div>`;
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

        function handleAnnouncementAttachFile(event){
          const files = Array.from(event.target.files || []);
          files.forEach(file => {
            const url = URL.createObjectURL(file);
            announcementDraftAttachments.push({ id: 'aa' + Date.now() + Math.random().toString(36).slice(2), name: file.name, file, url });
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
                  <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(a.name)}</span>
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
          const attachments = announcementDraftAttachments.map(a => ({ id: a.id, name: a.name, url: a.url }));
          cls.announcements.unshift({ id: 'a-' + Date.now(), text, time: 'now', comments: [], attachments });
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
        function handleClassworkAttachFile(event){
          const files = Array.from(event.target.files || []);
          files.forEach(file => {
            const url = URL.createObjectURL(file);
            classworkDraftAttachments.push({ id: 'ca' + Date.now() + Math.random().toString(36).slice(2), name: file.name, file, url });
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
                  <span class="text-xs font-semibold text-gray-700 truncate" style="max-width:140px;">${escapeHtml(a.name)}</span>
                  <button onclick="removeClassworkAttachment('${a.id}')" class="text-gray-400 flex-shrink-0">${Icon('close','w-3 h-3')}</button>
                </span>`).join('')}
            </div>`;
        }

        function submitNewClasswork(){
          if (!requireCompleteProfile()) return;
          const cls = myClasses.find(c => c.id === currentClassId);
          const title = (document.getElementById('classwork-title-input') || {}).value.trim();
          if (!cls || !title) return;
          const instructions = (document.getElementById('classwork-instructions-input') || {}).value.trim();
          const pointsInput = document.getElementById('classwork-points-input');
          const points = pointsInput ? pointsInput.value.trim() : '';
          const due = (document.getElementById('classwork-due-input') || {}).value;
          cls.classwork.unshift({
            id: 'w-' + Date.now(), type: classworkDraftType, title, instructions, points,
            due: due ? formatDueDate(due) : '', dueRaw: due || '',
            submission: null, graded: false, score: null, remark: '',
            attachments: classworkDraftAttachments
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
          if (!cls || !title) { alert('Give the quiz a title first.'); return; }
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
          if (!questions.length) { alert('Add at least one complete question (text + all 4 options).'); return; }
          cls.classwork.unshift({
            id: 'w-' + Date.now(), type: 'quiz', title, instructions, points,
            due: due ? formatDueDate(due) : '', dueRaw: due || '',
            questions, quizSubmission: null, graded: false, score: null, remark: ''
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
          if (!cls || !title) { alert('Give the poll a question first.'); return; }
          const optionTexts = Array.from(document.querySelectorAll('#poll-options-container .poll-option-input'))
            .map(i => i.value.trim()).filter(Boolean);
          if (optionTexts.length < 2) { alert('Add at least 2 options.'); return; }
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
            if (!w.submission) {
              return `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('doc','w-9 h-9')}</div>
                  <div class="font-bold text-gray-700 mb-1">No submission yet</div>
                  <div class="text-sm text-gray-400 leading-relaxed">You'll be able to grade this once a student turns it in.</div>
                </div>`;
            }
            return `
              <div class="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Submission · ${w.submission.submittedAt}</div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(w.submission.text)}</div>
              </div>
              <div class="bg-white rounded-2xl p-4 shadow-sm">
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">${w.graded ? 'Grade' : 'Grade this submission'}</div>
                <div class="flex items-center gap-3 mb-3">
                  <input type="number" id="classwork-score-input" value="${w.score !== null ? w.score : ''}" placeholder="Score" class="w-24 bg-gray-100 rounded-2xl px-3 py-2 text-sm">
                  <div class="text-sm text-gray-400">${w.points ? 'out of ' + w.points : 'points'}</div>
                </div>
                <textarea id="classwork-remark-input" placeholder="Remark / feedback (optional)" rows="3" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3">${w.remark || ''}</textarea>
                <button onclick="saveClassworkGrade('${w.id}')" class="w-full font-semibold py-2.5 rounded-2xl" style="color:${NAVY};background:rgba(30,144,255,0.12);">${w.graded ? 'Update grade' : 'Save grade'}</button>
                ${w.graded ? `<div class="text-center text-xs text-green-600 font-semibold mt-2">Graded: ${w.score}${w.points ? '/' + w.points : ''}</div>` : ''}
              </div>`;
          }

          // Student view: turn work in, or see what was already turned in;
          // the grade (once given) is shown read-only, never editable here.
          const submissionSection = w.submission ? `
            <div class="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your submission · ${w.submission.submittedAt}</div>
              <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(w.submission.text)}</div>
            </div>
            ${w.graded ? '' : `<button onclick="unsubmitClasswork('${w.id}')" class="text-xs font-semibold text-gray-400 mb-5">Unsubmit &amp; edit</button>`}
          ` : `
            <div class="bg-white rounded-2xl p-4 mb-5 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your work</div>
              <textarea id="classwork-submission-input" placeholder="Type your answer here..." rows="5" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3"></textarea>
              <button onclick="submitClassworkAssignment('${w.id}')" class="w-full text-white font-semibold py-2.5 rounded-2xl" style="background:rgba(30,144,255,0.55);">Turn in</button>
            </div>
          `;
          const gradeSummary = w.graded ? `
            <div class="bg-white rounded-2xl p-4 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Grade</div>
              <div class="text-lg font-bold text-[${NAVY}]">${w.score}${w.points ? '/' + w.points : ''}</div>
              ${w.remark ? `<div class="text-sm text-gray-600 mt-2 leading-relaxed">${w.remark}</div>` : ''}
            </div>` : '';
          return submissionSection + gradeSummary;
        }

        function submitClassworkAssignment(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const input = document.getElementById('classwork-submission-input');
          const text = input ? input.value.trim() : '';
          if (!text) { alert('Write something before turning it in.'); return; }
          const now = new Date();
          w.submission = { text, submittedAt: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
        }

        function unsubmitClasswork(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          w.submission = null;
          w.graded = false;
          w.score = null;
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
        }

        function saveClassworkGrade(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const scoreInput = document.getElementById('classwork-score-input');
          const remarkInput = document.getElementById('classwork-remark-input');
          const scoreVal = scoreInput ? scoreInput.value.trim() : '';
          if (scoreVal === '') { alert('Enter a score first.'); return; }
          w.score = scoreVal;
          w.remark = remarkInput ? remarkInput.value.trim() : '';
          w.graded = true;
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
        }

        // ---- Quiz: take it, auto-score it, then an optional teacher remark ----
        function classworkQuizDetailHTML(w){
          const cls = myClasses.find(c => c.id === currentClassId);
          const isTeacher = cls && cls.role === 'teacher';

          if (!w.quizSubmission) {
            if (isTeacher) {
              return `
                <div class="flex flex-col items-center text-center py-10">
                  <div class="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[${NAVY}]">${Icon('edit','w-9 h-9')}</div>
                  <div class="font-bold text-gray-700 mb-1">No submissions yet</div>
                  <div class="text-sm text-gray-400 leading-relaxed">Scores will show up here once a student takes this quiz.</div>
                </div>`;
            }
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
          const sub = w.quizSubmission;
          const remarkSection = isTeacher ? `
            <div class="bg-white rounded-2xl p-4 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Remark / feedback</div>
              <textarea id="quiz-remark-input" placeholder="Add a remark (optional)" rows="3" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3">${w.remark || ''}</textarea>
              <button onclick="saveQuizRemark('${w.id}')" class="w-full font-semibold py-2.5 rounded-2xl" style="color:${NAVY};background:rgba(30,144,255,0.12);">Save remark</button>
            </div>` : (w.remark ? `
            <div class="bg-white rounded-2xl p-4 shadow-sm">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Remark / feedback</div>
              <div class="text-sm text-gray-700 leading-relaxed">${w.remark}</div>
            </div>` : '');
          return `
            <div class="bg-white rounded-2xl p-4 mb-4 shadow-sm text-center">
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">${isTeacher ? "Student's score" : 'Your score'}</div>
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
                  <div class="text-xs text-gray-500 ml-6">${isTeacher ? "Student's" : 'Your'} answer: ${yourAnswer !== undefined && yourAnswer !== null ? q.options[yourAnswer] : '(no answer)'}</div>
                  ${!correct ? `<div class="text-xs text-emerald-600 ml-6 mt-0.5">Correct answer: ${q.options[q.correct]}</div>` : ''}
                </div>`;
              }).join('')}
            </div>
            ${remarkSection}`;
        }

        function submitClassworkQuiz(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const answers = w.questions.map((q, qi) => {
            const checked = document.querySelector(`.quiz-take-answer[data-qindex="${qi}"]:checked`);
            return checked ? parseInt(checked.value, 10) : null;
          });
          if (answers.some(a => a === null)) { alert('Answer every question before submitting.'); return; }
          const autoScore = answers.reduce((sum, a, qi) => sum + (a === w.questions[qi].correct ? 1 : 0), 0);
          const now = new Date();
          w.quizSubmission = { answers, total: w.questions.length, autoScore, submittedAt: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
          w.graded = true;
          w.score = w.points ? Math.round((autoScore / w.questions.length) * w.points) : autoScore;
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
        }

        function saveQuizRemark(id){
          const w = currentClasswork();
          if (!w || w.id !== id) return;
          const input = document.getElementById('quiz-remark-input');
          w.remark = input ? input.value.trim() : '';
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
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
          if (!checked) { alert('Pick an option before voting.'); return; }
          const oi = parseInt(checked.value, 10);
          w.options[oi].votes++;
          w.myVote = oi;
          document.getElementById('overlay').innerHTML = classworkDetailHTML();
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
            alert(`${email} has already been invited.`);
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
            navigator.clipboard.writeText(link).then(() => alert('Invite link copied!'));
          } else {
            alert('Invite link: ' + link);
          }
        }

        function shareClassInviteLink(){
          const link = classInviteLink();
          if (navigator.share) {
            navigator.share({ title: 'Join my class', text: 'Join my class on Stitch', url: link }).catch(() => {});
          } else {
            alert('Invite link: ' + link);
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
          if (!day || !subject || !start || !end) { alert('Please select a day, subject, start time, and end time.'); return; }
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
          if (!title || !date || !time) { alert('Please fill in the event, date, and time.'); return; }
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

