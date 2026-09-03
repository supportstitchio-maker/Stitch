let studyFabMenuOpen = false;

        let studyFabScrollCleanup = null;
        // ---- Study floating-action-button (FAB) menu ----
        function armStudyFabScrollCloser(scrollEl, isOpen){
          if (studyFabScrollCleanup) { studyFabScrollCleanup(); studyFabScrollCleanup = null; }
          if (!isOpen || !scrollEl) return;
          const anchor = scrollEl.scrollTop;
          let armed = false;
          const armTimer = setTimeout(() => { armed = true; }, 300);
          const onScroll = () => {
            if (armed && Math.abs(scrollEl.scrollTop - anchor) > 4) {
              cleanup();
              toggleStudyFabMenu();
            }
          };
          function cleanup(){
            clearTimeout(armTimer);
            scrollEl.removeEventListener('scroll', onScroll);
            if (studyFabScrollCleanup === cleanup) studyFabScrollCleanup = null;
          }
          scrollEl.addEventListener('scroll', onScroll, { passive: true });
          studyFabScrollCleanup = cleanup;
        }

        function toggleStudyFabMenu(){
          studyFabMenuOpen = !studyFabMenuOpen;
          renderStudy();
          morphPlusIcon('study-fab-icon', !studyFabMenuOpen);
          const classroomNavEl = document.getElementById('classroom-nav');
          if (classroomNavEl) classroomNavEl.style.display = studyFabMenuOpen ? 'none' : '';
          armStudyFabScrollCloser(document.getElementById('screen'), studyFabMenuOpen);
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
                <span id="study-fab-icon" class="plus-morph-icon${studyFabMenuOpen ? '' : ' is-plus'}">${IconBold('plus','w-5 h-5')}</span>
              </button>
            </div>`;
        }

        // ---- Classroom/study tab render + class cards ----
        function renderStudy() {
          const hasClasses = myClasses.length > 0;
          document.getElementById('screen').innerHTML = `
            <div class="px-5" style="padding-top:var(--top-safe-pad);padding-bottom:50px;">
              ${(classroomAreaTab === 'courses' || (classroomAreaTab === 'classes' && (studySub === 'resources' || studySub === 'exams'))) ? `
              <div class="flex items-center justify-between mb-4">
                <button onclick="openLeaveClassModal()" class="study-leave-classroom-btn flex items-center gap-1 flex-shrink-0 text-red-500">${IconBold('back','w-4 h-4 study-leave-classroom-icon')}<span class="font-bold text-xs study-leave-classroom-label">Leave Classroom</span></button>
                <h1 class="text-3xl font-bold font-display grad-text truncate ml-3">Classroom</h1>
              </div>` : `
              <div class="flex items-center gap-2 mb-4">
                <h1 class="text-3xl font-bold font-display grad-text truncate">Classroom</h1>
              </div>`}
              <div class="classroom-toggle-wrap flex gap-1 mb-5 bg-gray-100 rounded-2xl p-1">
                <button onclick="setClassroomAreaTab('classes')" class="classroom-toggle-pill flex-1 py-2.5 text-sm font-bold ${classroomAreaTab === 'classes' ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${classroomAreaTab === 'classes' ? `background:rgba(30,144,255,0.5);` : 'background:transparent;'}">My Classes</button>
                <button onclick="setClassroomAreaTab('courses')" class="classroom-toggle-pill flex-1 py-2.5 text-sm font-bold ${classroomAreaTab === 'courses' ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${classroomAreaTab === 'courses' ? `background:rgba(30,144,255,0.5);` : 'background:transparent;'}">Courses</button>
              </div>
              <div class="classroom-tab-panel ${classroomAreaTabSlideDir === 'left' ? 'classroom-tab-slide-left' : 'classroom-tab-slide-right'}">
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
            </div>
            ${classroomAreaTab === 'classes' && hasClasses && (studySub === 'exams' || studySub === 'resources') ? studyFabHTML() : ''}`;
          const classroomNav = document.getElementById('classroom-nav');
          if (classroomNav) classroomNav.style.display = classroomAreaTab === 'courses' ? 'none' : '';
          updateClassroomNav();
        }

        const classCardPalette = [
          ['#2563eb', '#1d4ed8'], 
          ['#059669', '#047857'], 
          ['#d97706', '#b45309'], 
          ['#dc2626', '#b91c1c'], 
          ['#7c3aed', '#6d28d9'], 
          ['#0891b2', '#0e7490'], 
          ['#db2777', '#be185d'], 
          ['#65a30d', '#4d7c0f'], 
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

        // Tracks which classes have already played the "Preparing class"
        // spin-up animation this session -- same one-time-per-session idea
        // as classroomNeedsLoadingAnimation for the Classroom tab itself
        // (core.js). The first time someone opens a given class it loads
        // and prepares it with the animation; every time after that (same
        // session) it just opens straight in.
        let preparedClassIds = new Set();
        function openClassDetailWithLoading(id){
          enterClassroomTab();
          if (preparedClassIds.has(id)) {
            openClassDetail(id);
            return;
          }
          runClassActionLoading('Preparing class', 'folder', () => {
            preparedClassIds.add(id);
            openClassDetail(id);
          });
        }

        function studyFeatureCard(icon, eyebrow, title, sub, actionsHtml, onclick, extraStyle, image){
          return `
            <div ${onclick ? `onclick="${onclick}" class="bg-white rounded-3xl p-6 mb-4 relative overflow-hidden study-feature-card-shadow cursor-pointer"` : `class="bg-white rounded-3xl p-6 mb-4 relative overflow-hidden study-feature-card-shadow"`} style="${extraStyle || ''}">
              ${image ? `<img src="${image}" alt="" class="absolute" style="right:-1rem;top:50%;transform:translateY(-50%);width:14rem;height:14rem;opacity:0.22;object-fit:contain;object-position:right center;pointer-events:none;user-select:none;-webkit-user-select:none;">` : ''}
              <div class="relative">
                <div class="flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-2" style="color:${NAVY};opacity:0.75;">${Icon(icon,'w-3.5 h-3.5')} ${eyebrow}</div>
                <div class="text-xl font-bold mb-2 text-[${NAVY}]">${title}</div>
                <div class="text-sm mb-4 text-gray-500">${sub}</div>
                ${actionsHtml}
              </div>
            </div>`;
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
              ${studyCard('edit', 'Practice', 'Quizzes and flashcards built from your uploads', "studySubTab('exams')")}
            ` : `
              <div class="text-sm text-gray-400 text-center py-6">Upload a PDF, DOCX, or PPTX above to unlock quizzes and flashcards built from it.</div>
            `}
          `;
          if (studySub === 'exams') return `
            ${studyFeatureCard('doc', 'Practice Tests', 'Full mock tests, timed or self-paced', 'Exam-ready questions sourced from your uploaded resources.', `
              <div class="font-semibold px-6 py-3 rounded-full inline-block text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Browse Mock Tests</div>
            `, 'openPracticeTestsOverlay()', null, 'assets/practice/practice-tests.png')}
            ${studyFeatureCard('bolt', 'Live · Head-to-head', 'Challenge Arena', 'Real-time, competitive practice: go head-to-head with another student on the same question set.', `
              <div class="challenge-arena-actions relative">
                <button onclick="openChallengeSetupModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-full mb-3 text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Set Up a Challenge</button>
                <button onclick="openInviteFriendModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-full mb-3 text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Invite a Friend</button>
                <button onclick="openJoinChallengeCodeModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-full border" style="border-color:${NAVY};color:${NAVY};">Join with a Code</button>
              </div>
            `, null, null, 'assets/practice/challenge-arena.png')}
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 mt-6">Flashcards</div>
            ${studyFeatureCard('bookmark', 'All Resources', 'Study All Flashcards', "Auto-generated from everything you've uploaded: no need to open each resource separately.", `
              <div class="font-semibold px-6 py-3 rounded-full inline-block text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Start Studying</div>
            `, "openFlashDeck('all')", 'margin-bottom:50px;', 'assets/practice/flashcards.png')}
          `;
        }

        // ---- Study plan cards + tab/limit helpers ----
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

        const flashDecks = {};

        function getAllResourcesDeck(){
          const cards = [];
          Object.keys(flashDecks).forEach(key => {
            flashDecks[key].cards.forEach(c => cards.push({ ...c, source: flashDecks[key].name }));
          });
          return { name: 'All Resources', cards: cards.slice(0, currentPlanLimit('flashcards')) };
        }

        // ---- Plan tiers + usage limits ----
        // currentPlanName() always resolves to 'free' for now -- there's no subscription/billing
        // state wired up yet. Once Stitch Pro / Pro Plus purchases are tracked (e.g. via Paystack
        // + a subscriptions table), point this at that real status and the limits below take effect
        // automatically for every category.
        const PLAN_TIERS = {
          free:     { dailyPrompts: 20,  monthlyQuestions: 50,  monthlyFlashcards: 50,  challenge: 20 },
          pro:      { dailyPrompts: 100, monthlyQuestions: 100, monthlyFlashcards: 100, challenge: 50 },
          pro_plus: { dailyPrompts: 200, monthlyQuestions: 150, monthlyFlashcards: 150, challenge: 70 },
        };

        function currentPlanName(){
          return 'free';
        }

        function currentPlanTier(){
          return PLAN_TIERS[currentPlanName()] || PLAN_TIERS.free;
        }

        function currentPlanFeatures(){
          const isPaid = currentPlanName() !== 'free';
          return { unlimitedPrompts: isPaid, cvAi: isPaid, cvRecommendations: isPaid };
        }

        // "questions" and "flashcards" are a recurring monthly allowance (resets on the 1st of
        // each calendar month); "challenge" is a pool-size cap for how many Challenge Arena
        // questions get pulled from everything you've uploaded.
        function currentPlanLimit(category){
          const tier = currentPlanTier();
          if (category === 'flashcards') return tier.monthlyFlashcards;
          if (category === 'questions') return tier.monthlyQuestions;
          if (category === 'challenge') return tier.challenge;
          return Infinity;
        }

        function todayDateKey(){
          return new Date().toISOString().slice(0, 10);
        }
        function currentMonthKey(){
          return new Date().toISOString().slice(0, 7);
        }

        // ---- AI prompt usage/rate limiting (daily) ----
        let aiPromptCount = 0;
        let aiPromptDate = null; // 'YYYY-MM-DD'

        function resetAIPromptCountIfNewDay(){
          const today = todayDateKey();
          if (aiPromptDate !== today) { aiPromptDate = today; aiPromptCount = 0; }
        }
        function hasUnlimitedPrompts(){
          return currentPlanFeatures().unlimitedPrompts;
        }
        function remainingAIPromptsToday(){
          if (hasUnlimitedPrompts()) return Infinity;
          resetAIPromptCountIfNewDay();
          return Math.max(0, currentPlanTier().dailyPrompts - aiPromptCount);
        }
        function canSendAIPrompt(){
          return hasUnlimitedPrompts() || remainingAIPromptsToday() > 0;
        }
        function recordAIPromptUsed(){
          if (hasUnlimitedPrompts()) return;
          resetAIPromptCountIfNewDay();
          aiPromptCount++;
          queueSaveUserState();
        }

        // ---- Monthly content usage: practice questions + flashcards generated from uploads ----
        let monthlyContentUsage = { questions: 0, flashcards: 0 };
        let monthlyContentUsageMonth = null; // 'YYYY-MM'

        function resetMonthlyContentUsageIfNewMonth(){
          const month = currentMonthKey();
          if (monthlyContentUsageMonth !== month) {
            monthlyContentUsageMonth = month;
            monthlyContentUsage = { questions: 0, flashcards: 0 };
          }
        }
        function remainingMonthlyContent(category){
          const limit = currentPlanLimit(category);
          if (limit === Infinity) return Infinity;
          resetMonthlyContentUsageIfNewMonth();
          return Math.max(0, limit - (monthlyContentUsage[category] || 0));
        }
        function recordMonthlyContentUsed(category, count){
          if (!count) return;
          resetMonthlyContentUsageIfNewMonth();
          monthlyContentUsage[category] = (monthlyContentUsage[category] || 0) + count;
          queueSaveUserState();
        }

        let practiceCompleted = false;
        let flashcardsCompleted = false;



        let uploadedResources = []; 
        let resourceIdCounter = 1;

        const AI_RATE_WINDOW_MS = 60000;
        const MAX_AI_CALLS_PER_WINDOW = 8;
        let aiCallTimestamps = [];

        function checkAiRateLimit(){
          const now = Date.now();
          aiCallTimestamps = aiCallTimestamps.filter(t => now - t < AI_RATE_WINDOW_MS);
          if (aiCallTimestamps.length >= MAX_AI_CALLS_PER_WINDOW) {
            const waitSec = Math.ceil((AI_RATE_WINDOW_MS - (now - aiCallTimestamps[0])) / 1000);
            throw new Error(`Too many AI requests, please wait ${waitSec}s and try again.`);
          }
          aiCallTimestamps.push(now);
        }

        async function callClaude(systemPrompt, userPrompt, task, images){
          checkAiRateLimit();
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to use AI features: please log in again.');
            const body = { systemPrompt, userPrompt, task: task || 'chat' };
            if (Array.isArray(images) && images.length) body.images = images;
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/ai-proxy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'apikey': SUPABASE_ANON_KEY
              },
              body: JSON.stringify(body)
            });
            if (res.status === 401) throw new Error('Your session expired, please log in again.');
            let data;
            try { data = await res.json(); } catch { data = null; }
            if (!res.ok) throw new Error((data && data.error) || ('AI request failed (' + res.status + ')'));
            if (data && data.error) throw new Error(data.error);
            return (data && data.text) || '';
          } catch (err) {
            if (err instanceof TypeError && /fetch/i.test(err.message)) {
              err = new Error('Could not reach the AI service: check your connection, or the ai-proxy Edge Function/CORS setup, and try again.');
            }
            window.reportError(err, { call: 'callClaude', promptLength: (userPrompt || '').length });
            throw err;
          }
        }

        async function requestAIImage(prompt){
          checkAiRateLimit();
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to use AI features: please log in again.');
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/ai-proxy`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'apikey': SUPABASE_ANON_KEY
              },
              body: JSON.stringify({ userPrompt: prompt, task: 'image' })
            });
            if (res.status === 401) throw new Error('Your session expired, please log in again.');
            let data;
            try { data = await res.json(); } catch { data = null; }
            if (!res.ok) throw new Error((data && data.error) || ('Image generation failed (' + res.status + ')'));
            if (data && data.error) throw new Error(data.error);
            if (!data || !data.image) throw new Error('Image generation returned nothing.');
            return { image: data.image, mediaType: data.mediaType || 'image/png' };
          } catch (err) {
            if (err instanceof TypeError && /fetch/i.test(err.message)) {
              err = new Error('Could not reach the AI service: check your connection, or the ai-proxy Edge Function/CORS setup, and try again.');
            }
            window.reportError(err, { call: 'requestAIImage', promptLength: (prompt || '').length });
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
            const paragraphs = xml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [];
            for (const p of paragraphs) {
              const runs = p.match(/<a:t>([^<]*)<\/a:t>/g) || [];
              const line = runs.map(r => r.replace(/<a:t>|<\/a:t>/g, '')).join(' ').replace(/\s+/g, ' ').trim();
              if (line) text += line + '\n';
            }
          }
          return text;
        }

        async function hashResourceText(text){
          const normalized = text.replace(/\s+/g, ' ').trim();
          if (window.crypto && window.crypto.subtle && window.isSecureContext) {
            try {
              const encoded = new TextEncoder().encode(normalized);
              const digest = await window.crypto.subtle.digest('SHA-256', encoded);
              return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {  }
          }
          let h = 0;
          for (let i = 0; i < normalized.length; i++) { h = (Math.imul(31, h) + normalized.charCodeAt(i)) | 0; }
          return 'fnv' + (h >>> 0).toString(16) + '_' + normalized.length;
        }

        async function extractTextFromFile(file){
          const ext = file.name.split('.').pop().toLowerCase();
          if (ext === 'pdf') return extractPdfText(file);
          if (ext === 'docx') return extractDocxText(file);
          if (ext === 'pptx') return extractPptxText(file);
          throw new Error('Unsupported file type: please upload a PDF, DOCX, or PPTX.');
        }

        async function generateStudyMaterials(text, resourceName){
          const trimmed = text.slice(0, 12000);
          const system = 'You generate study material for an education app from a single uploaded resource. ' +
            'Read the provided extracted text ONLY to identify which keywords, concepts, and terms this resource ' +
            'actually covers -- do not use the extracted text as the source of any definition, since raw document ' +
            'text is often choppy, incomplete, or missing a clean definition (a slide title, a bullet fragment, a ' +
            'name, a citation). ' +
            'Flashcards: each "term" must be a short, clean concept name or phrase that is genuinely covered in the ' +
            'material (never a slide title, author byline, or a name mashed together with the next line of text). ' +
            'Each "def" must be an accurate, complete, textbook/dictionary-quality definition of that term written ' +
            'from your own real subject-matter knowledge of the term -- the same definition a reliable reference or ' +
            'a web search would give -- even when the source document\'s own wording for it is garbled, partial, or ' +
            'missing entirely. Never just repeat the term back, and never phrase the definition as a question ' +
            'fragment like "what is X?". ' +
            'Questions: write genuine exam-ready questions in the exact register of a real university past-questions ' +
            'paper -- short, precise stems like "Deductive theory begins with which element?" or "Validity refers to ' +
            'which of the following?", never padded with filler like "According to the text..." or "The passage ' +
            'states...". Each one should test real understanding of a concept, a named principle/theory/term, a ' +
            'formula/procedure, or the ability to classify an example under the right category -- not just "which ' +
            'term matches this definition". Vary the question style across the set instead of reusing one template ' +
            'for every question. ' +
            'Most questions should be "type":"mcq": exactly one option is correct; the other three must be ' +
            'plausible, closely-related distractors from the same conceptual family (e.g. sibling terms, adjacent ' +
            'theories, common mix-ups students actually make) -- never an obviously-wrong filler option. Every ' +
            'option must be a short phrase, number, or single term (typically 1-5 words, matching how real exam ' +
            'answer choices read), never a full sentence restating the question. ' +
            'About a third of the questions -- whichever genuinely suit it, never forced onto material that ' +
            'doesn\'t -- should instead be "type":"written": a typed-answer question with no options, used for ' +
            'either (a) a self-contained worked calculation with real numbers and one computable correct value ' +
            '(e.g. "A sample of n=25 has a mean of 40 and a standard deviation of 5. What is the standard error?"), ' +
            'or (b) a "define this term" / "name this concept" question with a single correct term or short phrase ' +
            'as the answer. Never use "written" for a question whose real answer is a long explanation or essay -- ' +
            'only ones with one clear, checkable correct answer. Every "written" question needs "answer" (the ' +
            'ideal short answer -- the resolved number for a calculation, or the term/phrase for a ' +
            'definition/name question) and "keywords" (2-5 strings: for a calculation, the key numbers/units that ' +
            'must appear; for a definition/term, the essential words or synonyms an acceptable answer must ' +
            'contain) -- these are the marking scheme a grader (human or AI) checks a typed answer against. ' +
            'Respond with ONLY raw JSON (no markdown fences, no commentary) matching exactly this schema: ' +
            '{"flashcards":[{"term":"string","def":"string"}],"questions":[{"text":"string","type":"mcq","options":["string","string","string","string"],"correct":0},{"text":"string","type":"written","answer":"string","keywords":["string","string"]}]}. ' +
            'Produce 6 to 10 flashcards and 5 to 8 questions total, mixing both question types as described above.';
          const user = 'Resource name: ' + resourceName + '\n\nExtracted text:\n"""' + trimmed + '"""';
          const raw = await callClaude(system, user, 'materials');
          const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
          const parsed = JSON.parse(cleaned);
          return {
            flashcards: (parsed.flashcards || []).filter(c => c.term && c.def),
            questions: (parsed.questions || []).filter(q => {
              if (!q || !q.text) return false;
              if (q.type === 'written') return typeof q.answer === 'string' && q.answer.trim();
              return Array.isArray(q.options) && q.options.length === 4 && typeof q.correct === 'number';
            }).map(q => q.type === 'written'
              ? { text: q.text, type: 'written', answer: q.answer, keywords: Array.isArray(q.keywords) ? q.keywords : [] }
              : { text: q.text, type: 'mcq', options: q.options, correct: q.correct })
          };
        }

        // ---- Text cleanup helpers for generated study material ----
        function shuffleArray(arr){
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        const FALLBACK_STOPWORD_START = new Set([
          'this','that','these','those','it','its','there','they','them','we','us','you',
          'i','he','she','him','her','who','which','what','when','where','why','how',
          'but','and','so','or','because','although','however','also','therefore','thus',
          'if','while','since','then','than','here','once','now','still','yet','both',
          'each','some','many','most','all','such','only','just','even','not','no',
          'the','a','an','following','above','below','sample','given'
        ]);

        const FALLBACK_BAD_STANDALONE_TERMS = new Set([
          'according','however','therefore','additionally','furthermore','moreover',
          'meanwhile','overall','also','thus','hence','consequently','similarly',
          'example','examples','note','notes','summary','definition','introduction',
          'overview','question','questions','answer','answers','source','sources',
          'references','reference','conclusion','objective','objectives','outline',
          'agenda','recap','review','following','sample','given','exercise','exercises',
          'problem','problems','task','tasks'
        ]);

        const EXAM_PROBLEM_RE = /\b(test the hypothesis|significance level|null hypothesis|alternative hypothesis|degrees? of freedom|confidence interval|solve for|calculate the|compute the|find the value|given that|using the (?:data|table|information)|round(?:ed)? to \d|p-value|critical value)\b/i;

        // ---- Fallback flashcard/summary generator (no-AI mode) ----
        function isUsableFallbackTerm(term){
          if (!term) return false;
          const words = term.split(/\s+/).filter(Boolean);
          if (words.length < 1 || words.length > 8) return false;
          if (term.length < 3 || term.length > 60) return false;
          const firstWord = words[0].toLowerCase().replace(/[^a-z]/g, '');
          if (FALLBACK_STOPWORD_START.has(firstWord)) return false;
          if (FALLBACK_BAD_STANDALONE_TERMS.has(firstWord)) return false;
          if (/[,;:]$/.test(term)) return false;
          if (words.length > 1 && !/[A-Z]/.test(words[0][0]) && !/^\d/.test(words[0])) return false;
          if (words.some(w => w.length >= 5 && w === w.toUpperCase() && /[A-Z]/.test(w))) return false;
          if (words.length > 5) return false;
          return true;
        }

        function defIsRedundantWithTerm(def, term){
          const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const nDef = norm(def), nTerm = norm(term);
          if (!nDef || !nTerm) return true;
          if (nDef === nTerm) return true;
          if (nDef.startsWith(nTerm) && (nDef.length - nTerm.length) < 8) return true;
          if (/\?\s*$/.test(def.trim()) && def.trim().length < 80) return true;
          return false;
        }

        function isUsableFallbackDef(def, term){
          if (!def) return false;
          const cleaned = def.trim();
          if (cleaned.length < 12) return false;
          if (cleaned.toLowerCase() === term.toLowerCase()) return false;
          if (EXAM_PROBLEM_RE.test(cleaned) || EXAM_PROBLEM_RE.test(term)) return false;
          return true;
        }

        function stripStrayQuotes(s){
          return s.replace(/^[\s"'\u2018\u2019\u201c\u201d]+/, '').replace(/[\s"'\u2018\u2019\u201c\u201d]+$/, '');
        }

        function stripStrayBrackets(s){
          return s.replace(/[\[\](){}]+$/g, '').replace(/^[\[\](){}]+/g, '').trim();
        }

        function polishSentence(s){
          let t = stripStrayBrackets(s.trim());
          if (!t) return t;
          t = t[0].toUpperCase() + t.slice(1);
          if (!/[.!?…]$/.test(t)) t += '.';
          return t;
        }

        function polishTerm(s){
          let t = stripStrayBrackets(s.trim()).replace(/[.,;:]+$/, '').trim();
          if (!t) return t;
          if (t.length > 1) t = t[0].toUpperCase() + t.slice(1);
          return t;
        }

        const IMPERATIVE_PROMPT_RE = /^(name|list|discuss|explain|describe|state|identify|give|mention|outline|define|summarize|summarise|write|compare|analyze|analyse)\b/i;
        const EMBEDDED_DEFINITION_RE = /\b(is|are|refers to|means|defined as|known as)\b/i;

        function isJunkLine(line){
          const t = line.trim();
          if (!t || t.length < 8) return true;
          if (/^lecture[_\s]/i.test(t)) return true;
          if (/^tutorial\s+\d/i.test(t)) return true;
          if (/\.(pptx?|docx?|pdf)$/i.test(t)) return true;
          if (/^(slide|page)\s*\d+$/i.test(t)) return true;
          if (/^\d+[.)]?$/.test(t)) return true;
          if (IMPERATIVE_PROMPT_RE.test(t) && !EMBEDDED_DEFINITION_RE.test(t)) return true;
          const words = t.split(/\s+/).filter(Boolean);
          if (words.length >= 2 && words.length <= 5 && !/[.,;:]/.test(t)) {
            const nameLike = words.every(w => /^[A-Z][A-Za-z'\-]*$/.test(w));
            if (nameLike) return true;
          }
          return false;
        }

        function truncateAtWord(s, maxLen){
          if (s.length <= maxLen) return s;
          const cut = s.slice(0, maxLen);
          const lastSpace = cut.lastIndexOf(' ');
          return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…';
        }

        function stripAttributionPrefix(s){
          return s.replace(/^(?:according to|as defined by|as stated by|as noted by|per)\s+[^,]{2,50},\s*/i, '');
        }

        function generateStudyMaterialsFallback(text){
          const rawParagraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p && !isJunkLine(p));
          const sentences = [];
          const sentenceParaIdx = [];
          rawParagraphs.forEach((p, idx) => {
            const cleanP = p.replace(/\s+/g, ' ');
            cleanP.split(/(?<=[.?!])\s+/).forEach(s => {
              const t = stripAttributionPrefix(s.trim());
              if (t.length > 25 && t.length < 280 && !isJunkLine(t)) { sentences.push(t); sentenceParaIdx.push(idx); }
            });
          });

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

          let flashcards = candidates.slice(0, 10);

          if (flashcards.length < 4) {
            rawParagraphs.forEach((p, idx) => {
              if (flashcards.length >= 6 || usedParaIdx.has(idx) || p.length <= 60) return;
              const capRun = p.match(/^([A-Z][a-zA-Z0-9\-]*(?:\s+[A-Z][a-zA-Z0-9\-]*){0,2})\b/);
              const firstClause = p.match(/^([^,.;:]{4,60})[,.;:]/);
              const term = polishTerm(stripStrayQuotes((capRun && capRun[1].split(' ').length >= 1 ? capRun[1] : (firstClause ? firstClause[1].trim() : '')).trim()));
              const key = term.toLowerCase();
              if (term && isUsableFallbackTerm(term) && !seen.has(key)) {
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
                type: 'mcq',
                options,
                correct: options.indexOf(card.term)
              });
            });
          }

          return { flashcards: flashcards.slice(0, 10), questions };
        }

        // ---- Uploaded resource registration + list UI ----
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
            questions: resource.questions.map(q => q.type === 'written'
              ? { text: q.text, type: 'written', answer: q.answer, keywords: q.keywords || [] }
              : { text: q.text, type: 'mcq', options: q.options, correct: q.correct })
          });
          selectedCourseNames.add(name);
        }

        function reregisterUploadedResources(){
          Object.keys(flashDecks).forEach(key => delete flashDecks[key]);
          courseBank.length = 0;
          selectedCourseNames = new Set();
          uploadedResources.forEach(resource => {
            if (resource.status !== 'ready') return;
            if (resource.flashcards && resource.flashcards.length) registerResourceDeck(resource);
            if (resource.questions && resource.questions.length) registerResourceCourse(resource);
          });
          refreshResourcesUI();
        }

        function unregisterResource(resource){
          delete flashDecks[resource.id];
          if (resource.courseName) {
            const i = courseBank.findIndex(c => c.name === resource.courseName);
            if (i !== -1) courseBank.splice(i, 1);
            selectedCourseNames.delete(resource.courseName);
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
          suppressResourceListTapsBriefly();
          queueSaveUserState();
        }

        function suppressResourceListTapsBriefly(){
          const el = document.getElementById('study-content');
          if (!el) return;
          el.style.pointerEvents = 'none';
          setTimeout(() => { el.style.pointerEvents = ''; }, 350);
        }

        function refreshResourcesUI(){
          if (studySub === 'resources') {
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
          uploadResourceFileToStorage(file, resource.id).then(url => {
            resource.storageUrl = url;
            resource.storageStatus = url ? 'stored' : 'local-only';
            refreshResourcesUI();
          });
          try {
            const text = await extractTextFromFile(file);
            if (!text || text.trim().length < 30) throw new Error('No readable text could be found in this file.');
            resource.text = text;

            const contentHash = await hashResourceText(text);
            const dupe = uploadedResources.find(r => r.id !== resource.id && r.contentHash === contentHash && r.status !== 'error');
            if (dupe) {
              uploadedResources = uploadedResources.filter(r => r.id !== resource.id);
              if (resource.url) URL.revokeObjectURL(resource.url);
              pushInAppNotification('Duplicate file rejected', file.name + ' looks identical to "' + dupe.name + '", which you\'ve already uploaded. It was skipped to avoid duplicate flashcards and questions.');
              refreshResourcesUI();
              return;
            }
            resource.contentHash = contentHash;

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

            // Trim to whatever's left of this month's practice-question/flashcard allowance,
            // and record what actually got used.
            const remainingFlash = remainingMonthlyContent('flashcards');
            const remainingQ = remainingMonthlyContent('questions');
            const flashOver = Math.max(0, resource.flashcards.length - remainingFlash);
            const qOver = Math.max(0, resource.questions.length - remainingQ);
            if (remainingFlash < Infinity) resource.flashcards = resource.flashcards.slice(0, remainingFlash);
            if (remainingQ < Infinity) resource.questions = resource.questions.slice(0, remainingQ);
            recordMonthlyContentUsed('flashcards', resource.flashcards.length);
            recordMonthlyContentUsed('questions', resource.questions.length);

            registerResourceDeck(resource);
            registerResourceCourse(resource);

            if (flashOver > 0 || qOver > 0) {
              pushInAppNotification('Monthly limit reached', `${file.name}: saved ${resource.flashcards.length} flashcards and ${resource.questions.length} questions -- you've hit this month's free limit (${currentPlanLimit('flashcards')} flashcards, ${currentPlanLimit('questions')} questions). It resets next month, or upgrade to Stitch Pro for a higher limit.`);
            } else if (usedFallback) {
              pushInAppNotification('Resource saved (backup screening)', file.name + ': AI screening wasn\'t available, so ' + resource.flashcards.length + ' flashcards and ' + resource.questions.length + ' questions were built with backup screening. Tap Upgrade to try AI screening again.');
            } else {
              pushInAppNotification('Resource ready', file.name + ': ' + resource.flashcards.length + ' flashcards and ' + resource.questions.length + ' questions are ready.');
            }
          } catch (err) {
            resource.status = 'error';
            resource.error = (err && err.message) ? err.message : 'Something went wrong while processing this file.';
            pushInAppNotification('Processing failed', file.name + ': ' + resource.error);
          }
          refreshResourcesUI();
          queueSaveUserState();
        }

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
          const action = hasQuestions ? `openMockTestForCourse('${r.courseName}')` : '';
          return `
            <div ${action ? `onclick="${action}"` : ''} class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 ${action ? 'cursor-pointer' : ''} shadow-sm">
              <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('file','w-6 h-6')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">${escapeHtml(r.name)}</div>
                <div class="text-xs text-gray-500">${r.flashcards.length} flashcards · ${r.questions.length} practice questions</div>
              </div>
              <button onclick="event.stopPropagation();removeUploadedResource('${r.id}')" class="text-gray-300 flex-shrink-0 px-1">${Icon('close','w-4 h-4')}</button>
            </div>`;
        }

        let currentDeckKey = null;
        let currentDeck = null;
        let currentCardIndex = 0;
        let cardFlipped = false;

        // ---- Flashcard deck viewer modal ----
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
            <div class="mb-4">
              <div class="flex items-center gap-1.5 font-bold text-base mb-1" style="color:${NAVY};">
                ${Icon('bookmark','w-5 h-5')} Flashcards
              </div>
              <div class="text-sm text-gray-400">Card ${currentCardIndex + 1} of ${deck.cards.length}</div>
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
            <button onclick="nextStudyCard()" class="w-full text-white font-bold py-3 rounded-full text-center" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Next ›</button>
          `;
        }

        function studyCardFaceHTML(card){
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
          const wasLastCard = currentCardIndex === deck.cards.length - 1;
          currentCardIndex = (currentCardIndex + 1) % deck.cards.length;
          cardFlipped = false;
          if (wasLastCard && currentDeckKey === 'all') flashcardsCompleted = true;
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
