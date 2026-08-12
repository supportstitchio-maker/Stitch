        // ---------------- STUDY ----------------
        let studyFabMenuOpen = false;

        function toggleStudyFabMenu(){
          studyFabMenuOpen = !studyFabMenuOpen;
          renderStudy();
          const classroomNavEl = document.getElementById('classroom-nav');
          if (classroomNavEl) classroomNavEl.style.display = studyFabMenuOpen ? 'none' : '';
          attachMenuScrollCloser(document.getElementById('screen'), studyFabMenuOpen, 'toggleStudyFabMenu');
        }

        function studyFabHTML(){
          return `
            <div id="study-fab-wrap">
              ${studyFabMenuOpen ? `
                <div onclick="toggleStudyFabMenu()" onwheel="toggleStudyFabMenu()" ontouchmove="toggleStudyFabMenu()" class="fixed inset-0 z-30" style="background:rgba(10,15,25,0.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);"></div>
                <div id="study-fab-menu" class="fixed w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-30" style="right:1.25rem;bottom:8.5rem;">
                  <button onclick="toggleStudyFabMenu(); openJoinClassroom();" class="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-semibold text-gray-700">${Icon('users','w-4 h-4')} Join class</button>
                  <button onclick="toggleStudyFabMenu(); openCreateClassroom();" class="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-semibold text-gray-700">${Icon('plus','w-4 h-4')} Create class</button>
                </div>` : ''}
              <button id="study-fab-btn" onclick="toggleStudyFabMenu()" class="fixed flex items-center justify-center text-white rounded-2xl shadow-lg z-30" style="right:1.25rem;bottom:5.25rem;width:2.5rem;height:2.5rem;background:rgba(30,144,255,0.85);">
                ${IconBold(studyFabMenuOpen ? 'close' : 'plus','w-5 h-5')}
              </button>
            </div>`;
        }

        function renderStudy() {
          const hasClasses = myClasses.length > 0;
          document.getElementById('screen').innerHTML = `
            <div class="px-5 pb-5" style="padding-top:20px;">
              ${(classroomAreaTab === 'courses' || (classroomAreaTab === 'classes' && (studySub === 'resources' || studySub === 'uploads' || studySub === 'exams'))) ? `
              <div class="flex items-center justify-between mb-4">
                <button onclick="openLeaveClassModal()" class="flex items-center gap-1 flex-shrink-0 text-red-500">${IconBold('back','w-3.5 h-3.5')}<span class="font-bold text-xs">Leave Classroom</span></button>
                <h1 class="text-3xl font-bold font-display grad-text truncate ml-3">Classroom</h1>
              </div>` : `
              <div class="flex items-center gap-2 mb-4">
                <h1 class="text-3xl font-bold font-display grad-text truncate">Classroom</h1>
              </div>`}
              <div class="classroom-toggle-wrap flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1">
                <button onclick="setClassroomAreaTab('classes')" class="classroom-toggle-pill flex-1 py-2.5 text-sm font-bold ${classroomAreaTab === 'classes' ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${classroomAreaTab === 'classes' ? `background:rgba(30,144,255,0.5);` : 'background:transparent;'}">My Classes</button>
                <button onclick="setClassroomAreaTab('courses')" class="classroom-toggle-pill flex-1 py-2.5 text-sm font-bold ${classroomAreaTab === 'courses' ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${classroomAreaTab === 'courses' ? `background:rgba(30,144,255,0.5);` : 'background:transparent;'}">Courses</button>
              </div>
              ${classroomAreaTab === 'courses' ? coursesHomeHTML() : `
                ${hasClasses ? myClassesListHTML() : `
                <div class="flex gap-2 mb-5">
                  <button onclick="openJoinClassroom()" class="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-3 font-semibold text-sm text-[${NAVY}]">
                    ${Icon('users','w-4 h-4')} Join a Class
                  </button>
                  <button onclick="openCreateClassroom()" class="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                    ${Icon('plus','w-4 h-4')} Create a Class
                  </button>
                </div>`}
                <div id="study-content">${studyContent()}</div>`}
            </div>
            ${classroomAreaTab === 'classes' && hasClasses && (studySub === 'exams' || studySub === 'resources' || studySub === 'uploads') ? studyFabHTML() : ''}`;
          const classroomNav = document.getElementById('classroom-nav');
          if (classroomNav) classroomNav.style.display = classroomAreaTab === 'courses' ? 'none' : '';
          updateClassroomNav();
        }

        // Each class card gets its own color from this palette (cycled by
        // list position) instead of every card sharing one flat blue, plus
        // a low-opacity flowing squiggle-line motif behind the text:
        // echoing the reference moodboard the user shared, without
        // embedding raster images. viewBox is wide (300x100) to roughly
        // match a card's aspect ratio so the lines don't get squashed.
        const classCardPalette = [
          ['#2563eb', '#1d4ed8'], // blue
          ['#059669', '#047857'], // emerald
          ['#d97706', '#b45309'], // amber
          ['#dc2626', '#b91c1c'], // red
          ['#7c3aed', '#6d28d9'], // violet
          ['#0891b2', '#0e7490'], // cyan
          ['#db2777', '#be185d'], // pink
          ['#65a30d', '#4d7c0f'], // lime
        ];
        const classCardMotifStroke = 'stroke="white" stroke-width="42" fill="none" stroke-linecap="round" stroke-linejoin="round"';
        const classCardMotifs = [
          `<path d="M-10,70 C40,20 70,20 100,55 C130,90 160,90 190,55 C220,20 250,20 300,55" ${classCardMotifStroke}/><circle cx="255" cy="15" r="18" fill="white"/>`,
          `<path d="M-10,90 C30,90 30,50 60,50 C90,50 90,10 130,10 C170,10 170,60 210,60 C250,60 250,20 300,20" ${classCardMotifStroke}/>`,
          `<path d="M-10,30 C30,80 60,80 90,40 C120,0 150,0 180,40 C210,80 240,80 280,40" ${classCardMotifStroke}/><circle cx="20" cy="75" r="18" fill="white"/>`,
          `<path d="M-10,10 C40,10 40,60 90,60 C140,60 140,10 190,10 C240,10 240,80 300,80" ${classCardMotifStroke}/>`,
          `<path d="M-10,50 C10,20 30,20 50,50 C70,80 90,80 110,50 C130,20 150,20 170,50 C190,80 210,80 230,50 C250,20 270,20 300,50" ${classCardMotifStroke} stroke-width="33"/>`,
          `<path d="M-10,60 C60,100 90,20 150,50 C210,80 240,10 300,40" ${classCardMotifStroke}/><circle cx="270" cy="20" r="18" fill="white"/>`,
        ];

        // Each class gets its own randomly-assigned palette color and motif,
        // fixed at creation time and stored on the class itself, so it stays
        // the same everywhere (list card, detail header) regardless of where
        // it sits in myClasses -- rather than always landing on the first
        // (blue) palette entry just because it's the only/first class.
        function classCardIndex(cls){
          if (typeof cls.colorIndex === 'number') return cls.colorIndex;
          const i = myClasses.findIndex(c => c.id === cls.id);
          return i === -1 ? 0 : i;
        }
        function classCardMotifIndex(cls, fallbackIndex){
          if (typeof cls.motifIndex === 'number') return cls.motifIndex;
          return fallbackIndex;
        }
        function classCardBackgroundStyle(cls){
          const [from, to] = classCardPalette[classCardIndex(cls) % classCardPalette.length];
          return `background:linear-gradient(135deg,${from},${to});`;
        }

        // Lists every class the user has created or joined, shown right on
        // the Classroom tab above everything else (Study Planner included).
        function myClassesListHTML(){
          if (!myClasses.length) return '';
          return `
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">My Classes</div>
            ${myClasses.map((c, i) => {
              const motif = classCardMotifs[classCardMotifIndex(c, i) % classCardMotifs.length];
              return `
              <div onclick="openClassDetailWithLoading('${c.id}')" class="rounded-3xl p-5 text-white relative overflow-hidden mb-3 cursor-pointer" style="${c.photo ? `background-image:linear-gradient(rgba(10,37,64,0.45),rgba(10,37,64,0.45)),url('${c.photo}');background-size:cover;background-position:center;` : classCardBackgroundStyle(c)}min-height:104px;">
                ${c.photo ? '' : `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${motif}</svg>`}
                <div class="flex items-center justify-between gap-2 mb-1 relative">
                  <div class="text-xl font-bold font-display truncate pr-4">${escapeHtml(c.name)}</div>
                  <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0 bg-white/20">${c.role === 'teacher' ? 'Teaching' : 'Enrolled'}</span>
                </div>
                ${c.section ? `<div class="text-sm text-white/85 relative">${c.section}</div>` : ''}
              </div>`;
            }).join('')}
          `;
        }

        // Shows the same "loading then slide-away" curtain used for
        // creating/joining a class, but for simply opening one you already
        // belong to. This can be reached from outside the Classroom tab
        // (e.g. "Go to Classroom" on an enrolled Course under Explore), so
        // it makes sure the tab state actually is Classroom first -- see
        // enterClassroomTab() for why that matters for leaving cleanly.
        function openClassDetailWithLoading(id){
          enterClassroomTab();
          runClassActionLoading('Preparing class', 'folder', () => {
            openClassDetail(id);
          });
        }

        function studyContent(){
          if (studySub === 'resources') return `
            <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
              <div class="flex items-center gap-2 mb-1">
                ${Icon('calendar','w-6 h-6 text-['+NAVY+']')}
                <div class="text-lg font-bold text-[${NAVY}]">Study Planner</div>
              </div>
              <div class="text-xs font-bold text-amber-600 mb-4">Timetable &amp; reminders</div>
              ${plannerRow('calendar','Set Timetable','Add your weekly class schedule', "openOverlay('studyTimetable')")}
              ${plannerRow('clock','Set Reminders','Add exams, deadlines, or study sessions', "openOverlay('studyReminders')")}
            </div>
          `;
          if (studySub === 'uploads') return `
            <div class="bg-white rounded-3xl p-5 mb-4 shadow-sm">
              <div class="flex items-center justify-between mb-4">
                <div class="text-lg font-bold text-[${NAVY}]">Upload a resource</div>
              </div>
              <input type="file" id="resource-file-input" accept=".pdf,.docx,.pptx" multiple class="hidden" onchange="handleResourceFileSelect(event)">
              <div onclick="document.getElementById('resource-file-input').click()"
                   ondragover="event.preventDefault();this.classList.add('bg-amber-100')"
                   ondragleave="this.classList.remove('bg-amber-100')"
                   ondrop="handleResourceDrop(event)"
                   class="bg-amber-50 border-2 border-dashed border-gray-300 rounded-3xl p-8 flex flex-col items-center text-center cursor-pointer">
                <div class="w-12 h-12 bg-gray-400 rounded-2xl flex items-center justify-center text-white mb-3">${Icon('upload','w-6 h-6')}</div>
                <div class="text-sm font-bold text-gray-800 mb-1">Drag &amp; drop files here, or <span style="text-decoration:underline" class="text-amber-600">click to upload</span></div>
                <div class="text-xs text-gray-500">Textbooks, lecture slides, practice tests. PDF, DOCX, PPTX · Max 50MB per file</div>
              </div>
            </div>
            ${uploadedResources.length ? `
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Your Uploads</div>
              ${uploadedResources.map(resourceStatusRow).join('')}
            ` : `
              <div class="text-sm text-gray-400 text-center py-6">Upload a PDF, DOCX, or PPTX above to unlock quizzes and flashcards built from it.</div>
            `}
          `;
          if (studySub === 'exams') return `
            <div onclick="openPracticeTestsOverlay()" class="rounded-2xl p-6 mb-4 cursor-pointer" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.07) 0%, rgba(65,105,225,0.07) 100%);background-color:#ffffff;">
              <div class="text-xs uppercase tracking-wide text-[${NAVY}] font-bold mb-2 flex items-center gap-1.5">${Icon('doc','w-3.5 h-3.5')} Practice Tests</div>
              <div class="text-xl font-bold mb-2 text-[${NAVY}]">Full mock tests, timed or self-paced</div>
              <div class="text-sm text-gray-500 mb-4">Real practice tests from your school and others, worked exactly like the real exam.</div>
              <div class="text-white font-semibold px-6 py-3 rounded-2xl inline-block" style="background:rgba(30,144,255,0.5);">Browse Mock Tests</div>
            </div>
            <div class="rounded-2xl p-4 mb-4" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.07) 0%, rgba(65,105,225,0.07) 100%);background-color:#ffffff;">
              <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-[${NAVY}] font-bold mb-2">
                ${Icon('bolt','w-4 h-4')} Live · Head-to-head
              </div>
              <div class="text-2xl font-bold mb-2 text-[${NAVY}]">Challenge Arena</div>
              <div class="text-sm text-gray-500 mb-5">Real-time, competitive practice: go head-to-head with another student on the same question set.</div>
              <button onclick="openChallengeSetupModal()" class="w-full flex items-center justify-center gap-2 text-white font-semibold px-6 py-2.5 rounded-2xl mb-3" style="background:rgba(30,144,255,0.5);">Set Up a Challenge</button>
              <button onclick="openInviteFriendModal()" class="w-full flex items-center justify-center gap-2 text-white font-semibold px-6 py-2.5 rounded-2xl mb-3" style="background:rgba(30,144,255,0.5);">Invite a Friend</button>
              <button onclick="openJoinChallengeCodeModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-2xl" style="background:rgba(65,105,225,0.12);color:${NAVY};">Join with a Code</button>
            </div>
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 mt-6">Flashcards</div>
            <div onclick="openFlashDeck('all')" class="rounded-2xl p-6 mb-5 cursor-pointer" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.07) 0%, rgba(65,105,225,0.07) 100%);background-color:#ffffff;">
              <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-[${NAVY}] font-bold mb-2">
                ${Icon('bookmark','w-4 h-4')} All Resources
              </div>
              <div class="text-xl font-bold mb-2 text-[${NAVY}]">Study All Flashcards</div>
              <div class="text-sm text-gray-500 mb-4">Auto-generated from everything you've uploaded: no need to open each resource separately.</div>
              <div class="text-white font-semibold px-6 py-3 rounded-2xl inline-block" style="background:rgba(30,144,255,0.5);">Start Studying</div>
            </div>
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Sourced from</div>
            ${uploadedResources.filter(r => r.status === 'ready').length ? uploadedResources.filter(r => r.status === 'ready').map(r =>
              studyCard('folder', r.name.replace(/\.[^.]+$/, ''), r.flashcards.length + ' cards · your upload', `openFlashDeck('${r.id}')`)
            ).join('') : `
              <div class="text-sm text-gray-400 text-center py-6">Upload materials to unlock flashcards.</div>
            `}
          `;
        }

        function studyCard(icon,title,sub,onclick){
          return `
            <div onclick="${onclick}" class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 cursor-pointer shadow-sm">
              <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(icon,'w-6 h-6')}</div>
              <div class="flex-1">
                <div class="font-semibold text-sm">${title}</div>
                <div class="text-xs text-gray-500">${sub}</div>
              </div>
              <div class="text-gray-300">›</div>
            </div>`;
        }

        // Read-only variant of studyCard: no onclick, no chevron, no pointer
        // cursor. Used for flashcard-deck items in the Resources window so
        // they only ever present their data instead of opening the
        // flashcard study modal (that navigation lives in the Practice window).
        function studyCardStatic(icon,title,sub){
          return `
            <div class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 shadow-sm">
              <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(icon,'w-6 h-6')}</div>
              <div class="flex-1">
                <div class="font-semibold text-sm">${title}</div>
                <div class="text-xs text-gray-500">${sub}</div>
              </div>
            </div>`;
        }

        function plannerRow(icon,title,sub,onclick){
          return `
            <div onclick="${onclick}" class="border border-gray-200 rounded-3xl p-4 flex items-center gap-4 mb-3 cursor-pointer">
              <div class="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(icon,'w-6 h-6')}</div>
              <div class="flex-1">
                <div class="font-semibold text-sm">${title}</div>
                <div class="text-xs text-gray-500">${sub}</div>
              </div>
              <div class="text-gray-300">›</div>
            </div>`;
        }

        function statCard(icon,label,count,bg,onclick){
          return `
            <div ${onclick ? `onclick="${onclick}"` : ''} class="bg-white rounded-3xl p-5 flex flex-col items-center text-center shadow-sm ${onclick ? 'cursor-pointer' : ''}">
              <div class="w-12 h-12 ${bg} rounded-2xl flex items-center justify-center text-gray-600 mb-3">${Icon(icon,'w-6 h-6')}</div>
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">${label}</div>
              <div class="text-2xl font-bold text-[${NAVY}]">${count}</div>
            </div>`;
        }

        function studySubTab(key){
          studySub = key;
          const ov = document.getElementById('overlay');
          if (ov && !ov.classList.contains('hidden')) closeOverlay();
          renderStudy();
        }

        // ---------------- FLASHCARD STUDY MODAL ----------------
        // Starts empty by design: decks are populated only from what the
        // student actually uploads (see registerResourceDeck in the
        // Resource Engine below), so this works for any subject, not just
        // Economics.
        const flashDecks = {};

        // Combines every uploaded resource's flashcards into one deck automatically,
        // so studying doesn't require opening each resource individually.
        function getAllResourcesDeck(){
          const cards = [];
          Object.keys(flashDecks).forEach(key => {
            flashDecks[key].cards.forEach(c => cards.push({ ...c, source: flashDecks[key].name }));
          });
          return { name: 'All Resources', cards };
        }

        // ================== RESOURCE ENGINE ==================
        // Handles uploaded files end-to-end: extract real text from the file,
        // send it to Claude to generate flashcards + practice questions
        // grounded in that text, then wire the results into flashDecks
        // (Flashcards), courseBank (Practice Tests + Challenge Mode), and
        // the AI Class chat's context so StudyBot can answer from it too.
        let uploadedResources = []; // { id, name, ext, status, text, flashcards, questions, courseName, error, file, url }
        let resourceIdCounter = 1;

        // ---- Client-side rate limiting for the AI proxy ----
        // The ai-proxy Edge Function holds the real Anthropic API key, so
        // it's worth guarding against the frontend hammering it -- a burst
        // of rapid chat sends, someone bulk-uploading resources, a stuck
        // retry loop, etc. This is a simple sliding-window limiter: only
        // MAX_AI_CALLS_PER_WINDOW requests are allowed in any
        // AI_RATE_WINDOW_MS window; anything past that fails fast on the
        // client instead of ever reaching the network/Edge Function.
        const AI_RATE_WINDOW_MS = 60000;
        const MAX_AI_CALLS_PER_WINDOW = 8;
        let aiCallTimestamps = [];

        function checkAiRateLimit(){
          const now = Date.now();
          aiCallTimestamps = aiCallTimestamps.filter(t => now - t < AI_RATE_WINDOW_MS);
          if (aiCallTimestamps.length >= MAX_AI_CALLS_PER_WINDOW) {
            const waitSec = Math.ceil((AI_RATE_WINDOW_MS - (now - aiCallTimestamps[0])) / 1000);
            throw new Error(`Too many AI requests -- please wait ${waitSec}s and try again.`);
          }
          aiCallTimestamps.push(now);
        }

        // Calls the Supabase Edge Function proxy (supabase/functions/ai-proxy),
        // which holds the real Anthropic API key server-side and forwards
        // the request. Uses the shared SUPABASE_PROJECT_REF/SUPABASE_ANON_KEY
        // config declared near the top of this script.
        //
        // The 'apikey' header is just the Supabase gateway's routing key
        // (same for every caller). The 'Authorization' header is what
        // actually identifies *this* user -- it's the JWT issued by
        // Supabase Auth after they completed password + OTP login, and
        // the Edge Function verifies it server-side (supabase.auth.getUser)
        // before doing anything. Without a live session, there's nothing
        // valid to send, so we fail fast instead of falling back to the
        // anon key.
        // `task` picks which model the ai-proxy Edge Function uses for
        // this request (see the ROUTES map in supabase/functions/ai-proxy)
        // -- deliberately just a label, not a model name, so a compromised
        // or modified client can't force an expensive model: the actual
        // model id is decided server-side, the client only says what kind
        // of task this is. Defaults to 'chat' (StudyBot conversation);
        // pass 'materials' for the bulk flashcard/quiz generation call.
        async function callClaude(systemPrompt, userPrompt, task){
          checkAiRateLimit();
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to use AI features -- please log in again.');
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/ai-proxy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'apikey': SUPABASE_ANON_KEY
              },
              body: JSON.stringify({ systemPrompt, userPrompt, task: task || 'chat' })
            });
            if (res.status === 401) throw new Error('Your session expired -- please log in again.');
            if (!res.ok) throw new Error('AI request failed (' + res.status + ')');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return data.text || '';
          } catch (err) {
            // A bare "Failed to fetch" means the request never reached the
            // Edge Function at all (DNS/CORS/network), as opposed to the
            // function running and returning an error. Surface that
            // distinction instead of the cryptic browser message, since
            // "Failed to fetch" alone gives no actionable signal to the user.
            if (err instanceof TypeError && /fetch/i.test(err.message)) {
              err = new Error('Could not reach the AI service -- check your connection, or the ai-proxy Edge Function/CORS setup, and try again.');
            }
            window.reportError(err, { call: 'callClaude', promptLength: (userPrompt || '').length });
            throw err;
          }
        }

        async function extractPdfText(file){
          const buf = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages && text.length < 40000; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ') + '\n';
          }
          return text;
        }

        async function extractDocxText(file){
          const buf = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer: buf });
          return result.value || '';
        }

        async function extractPptxText(file){
          const buf = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(buf);
          const slideFiles = Object.keys(zip.files)
            .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
            .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
          let text = '';
          for (const name of slideFiles) {
            const xml = await zip.file(name).async('text');
            // Walk paragraph-by-paragraph (<a:p>...</a:p>) instead of
            // grabbing every <a:t> run on the whole slide at once. A
            // slide's title, author byline, and each separate bullet are
            // all separate paragraphs -- joining them with just a space
            // and a single newline at the very end of the *slide* (the
            // old behavior) mashes unrelated lines into one continuous
            // run with no sentence-ending punctuation between them (e.g.
            // "ALICE GYASI-MENSAH Name some global challenges Focus on
            // migration : Migration is..."), which is exactly what
            // confuses the definition-sentence regex and the paragraph
            // padding fallback below into treating a title + byline +
            // heading as if they were one sentence. One line per
            // paragraph gives both real breaks to split on.
            const paragraphs = xml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
            for (const p of paragraphs) {
              const runs = p.match(/<a:t>([^<]*)<\/a:t>/g) || [];
              const line = runs.map(r => r.replace(/<a:t>|<\/a:t>/g, '')).join(' ').replace(/\s+/g, ' ').trim();
              if (line) text += line + '\n';
            }
          }
          return text;
        }

        async function extractTextFromFile(file){
          const ext = file.name.split('.').pop().toLowerCase();
          if (ext === 'pdf') return extractPdfText(file);
          if (ext === 'docx') return extractDocxText(file);
          if (ext === 'pptx') return extractPptxText(file);
          throw new Error('Unsupported file type: please upload a PDF, DOCX, or PPTX.');
        }

        // Sends the extracted text to Claude and asks for flashcards +
        // multiple-choice questions grounded strictly in that text.
        async function generateStudyMaterials(text, resourceName){
          const trimmed = text.slice(0, 12000);
          const system = 'You generate study material for an education app from a single uploaded resource. ' +
            'Read the provided extracted text and produce flashcards and multiple-choice practice questions that are ' +
            'strictly grounded in that text (do not invent facts not supported by it). ' +
            'Flashcards: each "term" must be a short, clean concept name or phrase (never a slide title, author byline, ' +
            'or a name mashed together with the next line of text), and each "def" must be a real, self-contained ' +
            'explanation of that term (never just the term repeated back, and never a question fragment like "what is X?"). ' +
            'Questions: phrase each stem the way a real exam or tutorial paper would, and vary the phrasing across ' +
            'questions instead of reusing one template -- rotate through styles like "What is described by...", ' +
            '"Which of the answers below correctly matches...", "Explain which concept/term fits...", "Discuss the ' +
            'statement below, then select...", and direct application or scenario-based questions. Do not phrase ' +
            'every question as "Which term matches this definition". ' +
            'Respond with ONLY raw JSON (no markdown fences, no commentary) matching exactly this schema: ' +
            '{"flashcards":[{"term":"string","def":"string"}],"questions":[{"text":"string","options":["string","string","string","string"],"correct":0}]}. ' +
            'Produce 6 to 10 flashcards and 5 to 8 questions. Each question needs exactly 4 options, with "correct" as the 0-based index of the right one.';
          const user = 'Resource name: ' + resourceName + '\n\nExtracted text:\n"""' + trimmed + '"""';
          const raw = await callClaude(system, user, 'materials');
          const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(cleaned);
          return {
            flashcards: (parsed.flashcards || []).filter(c => c.term && c.def),
            questions: (parsed.questions || []).filter(q => q.text && Array.isArray(q.options) && q.options.length === 4 && typeof q.correct === 'number')
          };
        }

        // ---- Backup (non-AI) screening ----
        // Used whenever the AI screening call fails (offline, rate-limited,
        // the ai-proxy Edge Function down, or a bad/unparsable AI response)
        // so an uploaded file is never lost -- it's already been received
        // and text-extracted by this point, so we can still hand the
        // student something useful instead of a bare error. Purely
        // heuristic (no network call): finds definition-style sentences in
        // the extracted text and builds flashcards from them, plus simple
        // multiple-choice questions built from those same flashcards.
        function shuffleArray(arr){
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        // Words that make a poor flashcard "term" when they're the first
        // word captured -- almost always a sign the regex grabbed a clause
        // fragment (e.g. "This is important...") rather than a real noun
        // phrase from the resource.
        const FALLBACK_STOPWORD_START = new Set([
          'this','that','these','those','it','its','there','they','them','we','us','you',
          'i','he','she','him','her','who','which','what','when','where','why','how',
          'but','and','so','or','because','although','however','also','therefore','thus',
          'if','while','since','then','than','here','once','now','still','yet','both',
          'each','some','many','most','all','such','only','just','even','not','no'
        ]);

        // Single words that are only ever discourse connectors or document
        // structure labels, never real study terms on their own -- even
        // when they're capitalized (start of a sentence/slide) and would
        // otherwise pass every other check. Left unchecked, these are the
        // second-biggest source of garbled cards after the name/heading
        // problem above (e.g. "According" from "According to the IOM...",
        // or "Example" from "Example: Bangladesh, ...").
        const FALLBACK_BAD_STANDALONE_TERMS = new Set([
          'according','however','therefore','additionally','furthermore','moreover',
          'meanwhile','overall','also','thus','hence','consequently','similarly',
          'example','examples','note','notes','summary','definition','introduction',
          'overview','question','questions','answer','answers','source','sources',
          'references','reference','conclusion','objective','objectives','outline',
          'agenda','recap','review'
        ]);

        // Rejects terms that are clause fragments rather than real,
        // reusable study terms: wrong starting word, too short/long, or
        // containing punctuation that signals it's a partial sentence.
        function isUsableFallbackTerm(term){
          if (!term) return false;
          const words = term.split(/\s+/).filter(Boolean);
          if (words.length < 1 || words.length > 8) return false;
          if (term.length < 3 || term.length > 60) return false;
          const firstWord = words[0].toLowerCase().replace(/[^a-z]/g, '');
          if (FALLBACK_STOPWORD_START.has(firstWord)) return false;
          // Reject if the term OPENS with a discourse/attribution word
          // ("According to...", "However...") or a structural label
          // ("Example:", "Note:") -- these never start a real concept
          // name, no matter how many words follow.
          if (FALLBACK_BAD_STANDALONE_TERMS.has(firstWord)) return false;
          if (/[,;:]$/.test(term)) return false;
          // A term with a lowercase first letter and no capitals anywhere
          // in a multi-word phrase usually means the regex sliced into
          // the middle of a clause rather than starting a real phrase.
          if (words.length > 1 && !/[A-Z]/.test(words[0][0]) && !/^\d/.test(words[0])) return false;
          // Reject terms containing a long ALL-CAPS word (5+ letters).
          // Short all-caps words (GDP, IOM, FDI, EU) are legitimate econ
          // acronyms, but a long one almost always means the regex swept
          // up a slide author's name or a shouted heading rather than a
          // real study term (e.g. "ALICE GYASI-MENSAH").
          if (words.some(w => w.length >= 5 && w === w.toUpperCase() && /[A-Z]/.test(w))) return false;
          // Two or more Title-Case words in a row followed immediately by
          // more Title-Case words with no connector is a sign two separate
          // slide runs (a name/heading + the next line) got concatenated
          // into one "term" -- cap it at 5 words total (already enforced
          // by the capRun regex quantifier, this is a second safety net).
          if (words.length > 5) return false;
          return true;
        }

        // Rejects a term/def pair where the definition is really just the
        // term restated (or the term plus a trailing question fragment
        // like "WHAT IS X?") rather than an actual explanation -- a sign
        // the source text had no real separation between the two.
        function defIsRedundantWithTerm(def, term){
          const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const nDef = norm(def), nTerm = norm(term);
          if (!nDef || !nTerm) return true;
          if (nDef === nTerm) return true;
          if (nDef.startsWith(nTerm) && (nDef.length - nTerm.length) < 8) return true;
          // A definition that is itself phrased as a question ("...what
          // is migration?") is a mis-sliced heading, not a definition.
          if (/\?\s*$/.test(def.trim()) && def.trim().length < 80) return true;
          return false;
        }

        // Rejects definitions that are too thin or just a restatement of
        // the term itself (which would make the resulting question/card
        // useless). Length is not checked here -- a real definition can
        // legitimately run long (e.g. the IOM's official migrant
        // definition), so overlong defs are truncated at a word boundary
        // by the caller instead of being thrown away outright.
        function isUsableFallbackDef(def, term){
          if (!def) return false;
          const cleaned = def.trim();
          if (cleaned.length < 12) return false;
          if (cleaned.toLowerCase() === term.toLowerCase()) return false;
          return true;
        }

        // Strips stray leading/trailing quote characters that sometimes
        // survive PPTX/PDF extraction (a run split right at a quote mark
        // becomes a term or def with an unmatched " or ' stuck to it).
        function stripStrayQuotes(s){
          return s.replace(/^[\s"'\u2018\u2019\u201c\u201d]+/, '').replace(/[\s"'\u2018\u2019\u201c\u201d]+$/, '');
        }

        // Strips stray leftover brackets/footnote markers that sometimes
        // survive PPTX extraction when a slide title had a citation marker
        // or an unmatched bracket split across runs (e.g. a title ending
        // in "...Global Challenges]" with no matching "[").
        function stripStrayBrackets(s){
          return s.replace(/[\[\](){}]+$/g, '').replace(/^[\[\](){}]+/g, '').trim();
        }

        // Capitalizes the first letter and ensures the string ends with
        // sentence-closing punctuation, so cards read like a properly
        // written definition rather than a raw text-extraction fragment.
        function polishSentence(s){
          let t = stripStrayBrackets(s.trim());
          if (!t) return t;
          t = t[0].toUpperCase() + t.slice(1);
          if (!/[.!?…]$/.test(t)) t += '.';
          return t;
        }

        // Cleans a candidate term for display: strips stray brackets and
        // trailing punctuation (a term is a label, not a sentence, so it
        // should never end in a period/comma left over from extraction).
        function polishTerm(s){
          let t = stripStrayBrackets(s.trim()).replace(/[.,;:]+$/, '').trim();
          if (!t) return t;
          if (t.length > 1) t = t[0].toUpperCase() + t.slice(1);
          return t;
        }

        // Imperative instructional prompts a lecturer writes *to the
        // class* ("Name some global challenges", "Discuss the causes of
        // X", "List two examples of Y") rather than sentences that state
        // a fact. These make useless flashcard terms/definitions on their
        // own (there's no answer embedded in them), so they're screened
        // out before pattern matching runs. A line is only treated as a
        // bare prompt if it has no embedded copula/definition phrasing --
        // "Explain: migration is..." still gets through because the rest
        // of the sentence is a real definition.
        const IMPERATIVE_PROMPT_RE = /^(name|list|discuss|explain|describe|state|identify|give|mention|outline|define|summarize|summarise|write|compare|analyze|analyse)\b/i;
        const EMBEDDED_DEFINITION_RE = /\b(is|are|refers to|means|defined as|known as)\b/i;

        // Lines that are structural/meta noise rather than testable exam
        // content -- a presenter's name on a title slide, a raw lecture
        // filename, a slide/page number, or a bare instructional prompt.
        // None of these make a usable flashcard term or definition; left
        // in, they're the biggest source of garbled cards (a presenter's
        // name showing up as a flashcard "term", a "Name some..." prompt
        // showing up as a "definition").
        function isJunkLine(line){
          const t = line.trim();
          if (!t || t.length < 8) return true;
          if (/^lecture[_\s]/i.test(t)) return true;
          if (/^tutorial\s+\d/i.test(t)) return true;
          if (/\.(pptx?|docx?|pdf)$/i.test(t)) return true;
          if (/^(slide|page)\s*\d+$/i.test(t)) return true;
          if (/^\d+[.)]?$/.test(t)) return true;
          if (IMPERATIVE_PROMPT_RE.test(t) && !EMBEDDED_DEFINITION_RE.test(t)) return true;
          // A short, all-Title-Case/ALL-CAPS line with no punctuation and
          // no lowercase connector words reads as a name or heading, not
          // sentence content (e.g. "ALICE GYASI-MENSAH", "Dr John Mensah").
          const words = t.split(/\s+/).filter(Boolean);
          if (words.length >= 2 && words.length <= 5 && !/[.,;:]/.test(t)) {
            const nameLike = words.every(w => /^[A-Z][A-Za-z'\-]*$/.test(w));
            if (nameLike) return true;
          }
          return false;
        }

        // Truncates at a word boundary instead of a raw character index,
        // so a long definition used as a question stem never gets cut
        // off mid-word (e.g. "...habitual place of residence, regard").
        function truncateAtWord(s, maxLen){
          if (s.length <= maxLen) return s;
          const cut = s.slice(0, maxLen);
          const lastSpace = cut.lastIndexOf(' ');
          return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…';
        }

        // Strips a leading attribution clause ("According to the IOM, ...",
        // "As defined by the UN, ...") so the sentence's real subject ends
        // up at the start where the def-pattern regexes expect it -- e.g.
        // "According to the IOM, a migrant is any person..." becomes "a
        // migrant is any person...", which correctly yields the term
        // "Migrant" instead of either failing to match at all or (worse)
        // capturing the whole attribution clause as the "term".
        function stripAttributionPrefix(s){
          return s.replace(/^(?:according to|as defined by|as stated by|as noted by|per)\s+[^,]{2,50},\s*/i, '');
        }

        function generateStudyMaterialsFallback(text){
          // Split into paragraphs (real line breaks -- one per PPTX
          // bullet/title, one per PDF/DOCX paragraph) FIRST, then split
          // each paragraph into sentences on its own. Collapsing all
          // whitespace (including newlines) before splitting on sentence
          // punctuation -- the old approach -- let a title/heading with
          // no period run straight into the next unrelated bullet as if
          // they were one sentence. Junk lines (names, filenames, bare
          // instructional prompts) are dropped here, before anything
          // downstream can mistake them for real content.
          const rawParagraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p && !isJunkLine(p));
          const sentences = [];
          // Tracks which paragraph each sentence came from, so a
          // paragraph that already produced a good flashcard below isn't
          // also fed into the padding step as a second, weaker card.
          const sentenceParaIdx = [];
          rawParagraphs.forEach((p, idx) => {
            const cleanP = p.replace(/\s+/g, ' ');
            cleanP.split(/(?<=[.?!])\s+/).forEach(s => {
              const t = stripAttributionPrefix(s.trim());
              if (t.length > 25 && t.length < 280 && !isJunkLine(t)) { sentences.push(t); sentenceParaIdx.push(idx); }
            });
          });

          // Ordered from most to least reliable: explicit definition
          // phrasing first, generic "X is Y" last (it's the most likely
          // to false-positive on unrelated sentences, so it's filtered
          // hardest by isUsableFallbackTerm below).
          const defPatterns = [
            /^(.{3,60}?)\s+(?:is|are)\s+(?:defined as|known as)\s+(.+)$/i,
            /^(.{3,60}?)\s+refers to\s+(.+)$/i,
            /^(.{3,60}?)\s+means\s+(.+)$/i,
            /^(.{3,60}?)\s*[:\u2013\u2014]\s+(.{10,})$/,
            /^(.{3,60}?)\s+(?:is|are)\s+(?:a|an|the)\s+(.{10,})$/i,
            /^(.{3,60}?)\s+(?:is|are)\s+(.{10,})$/i
          ];

          const seen = new Set();
          const usedParaIdx = new Set();
          const candidates = [];
          for (let i = 0; i < sentences.length; i++) {
            const s = sentences[i];
            for (const re of defPatterns) {
              const m = s.match(re);
              if (m) {
                const term = polishTerm(stripStrayQuotes(m[1].trim().replace(/^(The|A|An)\s+/i, '')));
                const def = polishSentence(stripStrayQuotes(m[2].trim().replace(/\.$/, '')));
                const key = term.toLowerCase();
                if (!seen.has(key) && isUsableFallbackTerm(term) && isUsableFallbackDef(def, term) && !defIsRedundantWithTerm(def, term)) {
                  seen.add(key);
                  usedParaIdx.add(sentenceParaIdx[i]);
                  candidates.push({ term, def });
                }
                break;
              }
            }
            if (candidates.length >= 20) break;
          }

          // Quality over quantity: cap at 10, but never force more cards
          // than the text actually supports well.
          let flashcards = candidates.slice(0, 10);

          // Only pad with weaker, paragraph-start candidates when there's
          // a genuine shortfall (fewer than 4 clean cards) -- and even
          // then, every candidate still has to clear the same term/def
          // quality bars as the primary pass. A short, sparse deck of
          // honest cards beats a padded one full of half-sentences.
          if (flashcards.length < 4) {
            rawParagraphs.forEach((p, idx) => {
              if (flashcards.length >= 6 || usedParaIdx.has(idx) || p.length <= 60) return;
              // Capped at 3 Title-Case words: a longer run is far more
              // likely to be a whole slide heading/byline than a clean,
              // reusable study term.
              const capRun = p.match(/^([A-Z][a-zA-Z0-9\-]*(?:\s+[A-Z][a-zA-Z0-9\-]*){0,2})\b/);
              const firstClause = p.match(/^([^,.;:]{4,60})[,.;:]/);
              const term = polishTerm(stripStrayQuotes((capRun && capRun[1].split(' ').length >= 1 ? capRun[1] : (firstClause ? firstClause[1].trim() : '')).trim()));
              const key = term.toLowerCase();
              if (term && isUsableFallbackTerm(term) && !seen.has(key)) {
                // Definition body starts right after the extracted term
                // (not from the top of the paragraph again), so the term
                // isn't repeated at the start of its own definition.
                const rest = stripStrayQuotes(p.slice(term.length).trim());
                const defSource = rest.length > 20 ? rest : p;
                const def = polishSentence(stripStrayQuotes(defSource.length > 220 ? defSource.slice(0, 220).trim() + '…' : defSource));
                if (isUsableFallbackDef(def, term) && !defIsRedundantWithTerm(def, term)) {
                  seen.add(key);
                  flashcards.push({ term, def });
                }
              }
            });
          }

          // Turn the flashcards themselves into simple multiple-choice
          // questions: the definition is the stem, the correct term plus
          // three other extracted terms are the options. Only build a
          // question when there are enough distinct terms to make real
          // (non-repeating) distractors.
          //
          // Stems rotate through 8 exam-style phrasings (one per question,
          // up to the 8-question cap below) instead of repeating the same
          // "Which term matches this definition" template every time --
          // mixes "What is...", "Discuss...", "Explain...", and "Which of
          // the answers below..." framings so it reads like an actual
          // tutorial/exam paper rather than an auto-generated matching quiz.
          const EXAM_STEM_TEMPLATES = [
            def => 'What is described by the following statement? "' + def + '"',
            def => 'Which of the answers below correctly matches this description: "' + def + '"?',
            def => 'Explain which concept fits this description: "' + def + '"',
            def => 'Discuss the statement below, then select the term it describes: "' + def + '"',
            def => 'What term is being defined here? "' + def + '"',
            def => 'Identify the term that matches: "' + def + '"',
            def => 'Which of the following options best fits this definition: "' + def + '"?',
            def => 'Based on the description below, which term applies? "' + def + '"'
          ];
          const questions = [];
          if (flashcards.length >= 4) {
            flashcards.slice(0, 8).forEach((card, i) => {
              const pool = flashcards.filter((c, j) => j !== i && c.term.toLowerCase() !== card.term.toLowerCase()).map(c => c.term);
              const distractors = shuffleArray([...new Set(pool)]).slice(0, 3);
              if (distractors.length < 3) return;
              const options = shuffleArray([card.term, ...distractors]);
              const template = EXAM_STEM_TEMPLATES[i % EXAM_STEM_TEMPLATES.length];
              questions.push({
                text: template(truncateAtWord(card.def, 140)),
                options,
                correct: options.indexOf(card.term)
              });
            });
          }

          return { flashcards: flashcards.slice(0, 10), questions };
        }

        function registerResourceDeck(resource){
          if (!resource.flashcards.length) return;
          flashDecks[resource.id] = {
            name: resource.name.replace(/\.[^.]+$/, ''),
            cards: resource.flashcards.map(c => ({ term: c.term, def: c.def }))
          };
        }

        function registerResourceCourse(resource){
          if (!resource.questions.length) return;
          const name = resource.name.replace(/\.[^.]+$/, '');
          resource.courseName = name;
          courseBank.push({
            name,
            questions: resource.questions.map(q => ({ text: q.text, options: q.options, correct: q.correct }))
          });
          selectedCourseNames.add(name);
          if (!challengeSubjects.includes(name)) challengeSubjects.push(name);
        }

        function unregisterResource(resource){
          delete flashDecks[resource.id];
          if (resource.courseName) {
            const i = courseBank.findIndex(c => c.name === resource.courseName);
            if (i !== -1) courseBank.splice(i, 1);
            selectedCourseNames.delete(resource.courseName);
            const j = challengeSubjects.indexOf(resource.courseName);
            if (j !== -1) challengeSubjects.splice(j, 1);
            if (challengeConfig.subject === resource.courseName) challengeConfig.subject = challengeSubjects[0];
          }
        }

        function removeUploadedResource(id){
          const resource = uploadedResources.find(r => r.id === id);
          if (resource) {
            unregisterResource(resource);
            if (resource.url) {
              if (lecturePreview && lecturePreview.url === resource.url) closeFilePreview();
              URL.revokeObjectURL(resource.url);
            }
          }
          uploadedResources = uploadedResources.filter(r => r.id !== id);
          if (currentDeckKey === id) closeFlashModal();
          refreshResourcesUI();
          queueSaveUserState();
        }

        function refreshResourcesUI(){
          if (studySub === 'resources' || studySub === 'uploads') {
            const el = document.getElementById('study-content');
            if (el) el.innerHTML = studyContent();
          }
          if (inLectureCall) refreshClassPadUploadedResources();
        }

        async function processUploadedResource(file){
          const ext = file.name.split('.').pop().toLowerCase();
          if (!['pdf', 'docx', 'pptx'].includes(ext)) {
            pushInAppNotification('Unsupported file', file.name + ': please upload a PDF, DOCX, or PPTX file.');
            return;
          }
          const resource = { id: 'res' + (resourceIdCounter++), name: file.name, ext, status: 'processing', text: '', flashcards: [], questions: [], file, url: URL.createObjectURL(file), storageUrl: null, storageStatus: 'pending' };
          uploadedResources.unshift(resource);
          refreshResourcesUI();
          // Fire-and-forget: push the raw file to Supabase Storage in the
          // background so it's actually persisted once a backend is
          // configured. This never blocks or fails the text-extraction /
          // flashcard flow below -- it just fills in resource.storageUrl
          // when (if) it succeeds.
          uploadResourceFileToStorage(file, resource.id).then(url => {
            resource.storageUrl = url;
            resource.storageStatus = url ? 'stored' : 'local-only';
            refreshResourcesUI();
          });
          try {
            const text = await extractTextFromFile(file);
            if (!text || text.trim().length < 30) throw new Error('No readable text could be found in this file.');
            resource.text = text;

            // AI screening is the "optimised" path. If it fails for any
            // reason (offline, rate-limited, ai-proxy down, bad JSON back
            // from the model) the file has still been received and its
            // text still extracted above, so fall back to local backup
            // screening instead of failing the whole upload. The student
            // can upgrade to AI-generated material later via "Upgrade".
            let material;
            let usedFallback = false;
            try {
              material = await generateStudyMaterials(text, file.name);
              if (!material.flashcards.length && !material.questions.length) throw new Error('AI returned no study material.');
            } catch (aiErr) {
              console.warn('AI screening failed, using backup screening:', aiErr);
              material = generateStudyMaterialsFallback(text);
              usedFallback = true;
            }

            resource.flashcards = material.flashcards;
            resource.questions = material.questions;
            resource.status = 'ready';
            resource.usedFallback = usedFallback;
            registerResourceDeck(resource);
            registerResourceCourse(resource);

            if (usedFallback) {
              pushInAppNotification('Resource saved (backup screening)', file.name + ': AI screening wasn\'t available, so ' + resource.flashcards.length + ' flashcards and ' + resource.questions.length + ' questions were built with backup screening. Tap Upgrade to try AI screening again.');
            } else {
              pushInAppNotification('Resource ready', file.name + ': ' + resource.flashcards.length + ' flashcards and ' + resource.questions.length + ' questions are ready.');
            }
          } catch (err) {
            // Only genuine, unrecoverable failures land here now --
            // unreadable/corrupt/unsupported files. AI outages no longer
            // take the whole upload down with them.
            resource.status = 'error';
            resource.error = (err && err.message) ? err.message : 'Something went wrong while processing this file.';
            pushInAppNotification('Processing failed', file.name + ': ' + resource.error);
          }
          refreshResourcesUI();
          queueSaveUserState();
        }

        // Lets a student re-run AI screening on a resource that's currently
        // running on backup (non-AI) screening -- e.g. because AI was
        // temporarily unavailable at upload time.
        async function retryAIScreening(id){
          const resource = uploadedResources.find(r => r.id === id);
          if (!resource || !resource.text || resource.retrying) return;
          resource.retrying = true;
          refreshResourcesUI();
          try {
            const material = await generateStudyMaterials(resource.text, resource.name);
            unregisterResource(resource);
            resource.flashcards = material.flashcards;
            resource.questions = material.questions;
            resource.usedFallback = false;
            registerResourceDeck(resource);
            registerResourceCourse(resource);
            pushInAppNotification('AI screening complete', resource.name + ' now has AI-generated flashcards and questions.');
          } catch (err) {
            pushInAppNotification('AI screening still unavailable', (err && err.message) ? err.message : 'Please try again later.');
          }
          resource.retrying = false;
          refreshResourcesUI();
          queueSaveUserState();
        }

        function handleResourceFileSelect(event){
          const files = Array.from(event.target.files || []);
          event.target.value = '';
          files.forEach(processUploadedResource);
        }

        function handleResourceDrop(event){
          event.preventDefault();
          event.currentTarget.classList.remove('bg-amber-100');
          const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
          files.forEach(processUploadedResource);
        }

        // Builds a short excerpt of every ready resource, used to ground
        // StudyBot's answers in what the student has actually uploaded.
        function buildResourceContext(){
          const ready = uploadedResources.filter(r => r.status === 'ready' && r.text);
          if (!ready.length) return '';
          return ready.slice(0, 5).map(r => '--- ' + r.name + ' ---\n' + r.text.slice(0, 2000)).join('\n\n');
        }

        function resourceStatusRow(r){
          if (r.status === 'processing') {
            return `
              <div class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 shadow-sm">
                <div class="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">${Icon('file','w-6 h-6')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">${escapeHtml(r.name)}</div>
                  <div class="text-xs text-amber-600">Scanning with AI: building flashcards &amp; questions…</div>
                </div>
              </div>`;
          }
          if (r.status === 'error') {
            return `
              <div class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 shadow-sm">
                <div class="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-500 flex-shrink-0">${Icon('file','w-6 h-6')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">${escapeHtml(r.name)}</div>
                  <div class="text-xs text-red-500 truncate">${r.error}</div>
                </div>
                <button onclick="removeUploadedResource('${r.id}')" class="text-gray-300 flex-shrink-0 px-1">${Icon('close','w-4 h-4')}</button>
              </div>`;
          }
          const hasCards = r.flashcards.length > 0;
          const hasQuestions = r.questions.length > 0;
          // Flashcards are shown here as read-only info only: tapping a
          // resource in this (Resources) window must never jump into the
          // flashcard study modal, which lives in the Practice window.
          const action = hasQuestions ? `openMockTestForCourse('${r.courseName}')` : '';
          return `
            <div ${action ? `onclick="${action}"` : ''} class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 ${action ? 'cursor-pointer' : ''} shadow-sm">
              <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('file','w-6 h-6')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">${escapeHtml(r.name)}</div>
                <div class="text-xs text-gray-500">${r.flashcards.length} flashcards · ${r.questions.length} practice questions${r.usedFallback ? ' · backup screening' : ''}</div>
              </div>
              ${r.usedFallback ? `<button onclick="event.stopPropagation();retryAIScreening('${r.id}')" ${r.retrying ? 'disabled' : ''} class="text-xs font-bold flex-shrink-0 px-2.5 py-1.5 rounded-full" style="color:${NAVY};background:rgba(30,144,255,0.1);">${r.retrying ? 'Retrying…' : 'Upgrade'}</button>` : ''}
              <button onclick="event.stopPropagation();removeUploadedResource('${r.id}')" class="text-gray-300 flex-shrink-0 px-1">${Icon('close','w-4 h-4')}</button>
            </div>`;
        }

        let currentDeckKey = null;
        let currentDeck = null;
        let currentCardIndex = 0;
        let cardFlipped = false;

        function openFlashDeck(key){
          const deck = key === 'all' ? getAllResourcesDeck() : flashDecks[key];
          if (!deck || !deck.cards || !deck.cards.length) {
            pushInAppNotification('No flashcards yet', "This deck doesn't have any cards yet.");
            return;
          }
          currentDeckKey = key;
          currentDeck = deck;
          currentCardIndex = 0;
          cardFlipped = false;
          document.getElementById('flashModal').classList.remove('hidden');
          renderFlashModal();
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeFlashModal(fromPopState));
        }

        function closeFlashModal(fromPopState){
          document.getElementById('flashModal').classList.add('hidden');
          document.getElementById('flashModalContent').innerHTML = '';
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }

        function renderFlashModal(){
          const deck = currentDeck;
          const card = deck.cards[currentCardIndex];
          const pct = Math.round(((currentCardIndex + 1) / deck.cards.length) * 100);
          document.getElementById('flashModalContent').innerHTML = `
            <div class="flex items-start justify-between mb-4">
              <div>
                <div class="flex items-center gap-1.5 font-bold text-base mb-1" style="color:${NAVY};">
                  ${Icon('bookmark','w-5 h-5')} Flashcards
                </div>
                <div class="text-sm text-gray-400">Card ${currentCardIndex + 1} of ${deck.cards.length}</div>
              </div>
              <div class="flex items-start gap-3">
                <div class="font-bold text-sm px-4 py-2.5 rounded-full" style="background:rgba(30,144,255,0.12);color:${NAVY};">${escapeHtml(deck.name)}</div>
                <button onclick="closeFlashModal()" class="text-gray-400 mt-1">${Icon('close','w-5 h-5')}</button>
              </div>
            </div>
            <div class="w-full h-2 rounded-full mb-5 overflow-hidden" style="background:rgba(30,144,255,0.12);">
              <div class="h-full rounded-full" style="width:${pct}%;background:${NAVY};"></div>
            </div>
            <div id="studyCardBody" class="flip-card" onclick="flipStudyCard()">
              ${studyCardFaceHTML(card)}
            </div>
            <div class="text-center text-sm text-gray-400 mb-5 flex items-center justify-center gap-1.5">${Icon('tap','w-4 h-4')} Tap the card to flip between term and definition</div>
            <div class="flex gap-3 mb-3">
              <button onclick="prevStudyCard()" class="flex-1 border border-gray-200 rounded-2xl py-3 font-bold text-[${NAVY}] text-center">‹ Prev</button>
              <button onclick="shuffleStudyDeck()" class="flex-1 border border-gray-200 rounded-2xl py-3 font-bold text-[${NAVY}] flex items-center justify-center gap-2">${Icon('shuffle','w-4 h-4')} Shuffle</button>
            </div>
            <button onclick="nextStudyCard()" class="w-full text-white font-bold py-3 rounded-2xl text-center" style="background:rgba(30,144,255,0.5);">Next ›</button>
          `;
        }

        // A single, normal-flow face for the card (term or definition
        // depending on cardFlipped); no position:absolute/3D transform
        // stacking, so the card can never visually detach from its text
        // while the modal scrolls.
        function studyCardFaceHTML(card){
          // Term/def text comes straight from AI-extracted document text,
          // which often contains characters like <, >, & (e.g. "R&D",
          // "Cost < Benefit") that break unescaped HTML -- every other
          // question/card display in the app escapes this text (see
          // escapeHtml(q.text) in quizzesAndGames.js) but this one didn't,
          // so a card containing those characters would render blank or
          // garbled instead of showing its actual content.
          const text = escapeHtml(cardFlipped ? card.def : card.term);
          const source = card.source ? escapeHtml(card.source) : '';
          const label = cardFlipped ? 'DEFINITION' : 'TERM';
          return `
            <div class="flip-card-inner">
              <div class="w-full">
                ${source ? `<div class="text-xs font-bold uppercase tracking-wide mb-1" style="color:${NAVY};">${source}</div>` : ''}
                <div class="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">${label}</div>
                <div class="text-base text-gray-900 leading-snug">${text}</div>
              </div>
            </div>`;
        }

        function flipStudyCard(){
          const cardEl = document.getElementById('studyCardBody');
          if (!cardEl) { cardFlipped = !cardFlipped; renderFlashModal(); return; }
          const card = currentDeck.cards[currentCardIndex];
          cardEl.classList.add('flipping');
          setTimeout(() => {
            cardFlipped = !cardFlipped;
            cardEl.innerHTML = studyCardFaceHTML(card);
            cardEl.classList.remove('flipping');
          }, 150);
        }

        function nextStudyCard(){
          const deck = currentDeck;
          currentCardIndex = (currentCardIndex + 1) % deck.cards.length;
          cardFlipped = false;
          renderFlashModal();
        }

        function prevStudyCard(){
          const deck = currentDeck;
          currentCardIndex = (currentCardIndex - 1 + deck.cards.length) % deck.cards.length;
          cardFlipped = false;
          renderFlashModal();
        }

        function shuffleStudyDeck(){
          const deck = currentDeck;
          for (let i = deck.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
          }
          currentCardIndex = 0;
          cardFlipped = false;
          renderFlashModal();
        }

