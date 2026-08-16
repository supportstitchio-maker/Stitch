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
              ${(classroomAreaTab === 'courses' || (classroomAreaTab === 'classes' && (studySub === 'resources' || studySub === 'exams'))) ? `
              <div class="flex items-center justify-between mb-4">
                <button onclick="openLeaveClassModal()" class="study-leave-classroom-btn flex items-center gap-1 flex-shrink-0 text-red-500">${IconBold('back','w-3.5 h-3.5 study-leave-classroom-icon')}<span class="font-bold text-xs study-leave-classroom-label">Leave Classroom</span></button>
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

        // Gradient "feature card" treatment for the Study tab's Practice
        // Tests / Challenge Arena / Flashcards / upgrade panels, echoing
        // the same gradient-banner-with-motif look used for My Classes
        // (classCardBackgroundStyle/classCardMotifs above) and the
        // Opportunities cards in Explore, instead of a flat tinted box --
        // so the whole Study screen reads as one consistent card
        // language. colorIndex/motifIndex are passed in per-card so each
        // panel gets a different color/motif rather than solid blue
        // everywhere; onclick is optional since some cards (Challenge
        // Arena) hold several separate buttons instead of being one big
        // tap target. paper=true swaps the bright color-palette gradient
        // for an aged-cream paper look (see paperCardTexture below) with
        // ink-toned text/motif instead of white -- used for Practice,
        // Challenge Arena, and Flashcards specifically.
        const paperCardTexture = `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='paperGrain'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0.4  0 0 0 0 0.32  0 0 0 0 0.22  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23paperGrain)'/></svg>")}`;
        const PAPER_INK = '#3d2b1a';
        // Filled pill buttons on the paper cards: a coffee brown pill
        // instead of white, with cream text instead of navy blue -- so
        // the buttons read as part of the paper/ink palette instead of
        // looking like they wandered in from the old blue-gradient cards.
        const PAPER_PILL_BG = '#ffffff';
        const PAPER_PILL_TEXT = 'dodgerblue';
        function studyFeatureCard(colorIndex, motifIndex, icon, eyebrow, title, sub, actionsHtml, onclick, extraStyle, paper){
          const motif = classCardMotifs[motifIndex % classCardMotifs.length];
          const bgStyle = paper
            ? `background:dodgerblue;`
            : (() => { const [from, to] = classCardPalette[colorIndex % classCardPalette.length]; return `background:linear-gradient(135deg,${from},${to});`; })();
          return `
            <div ${onclick ? `onclick="${onclick}" class="rounded-2xl p-6 mb-4 relative overflow-hidden cursor-pointer"` : `class="rounded-2xl p-6 mb-4 relative overflow-hidden"`} style="${bgStyle}${extraStyle || ''}">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${motif}</svg>
              <div class="relative">
                <div class="flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-2" style="color:rgba(255,255,255,0.8);">${Icon(icon,'w-3.5 h-3.5')} ${eyebrow}</div>
                <div class="text-xl font-bold mb-2" style="color:#ffffff;">${title}</div>
                <div class="text-sm mb-4" style="color:rgba(255,255,255,0.8);">${sub}</div>
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
            ${isTrialActive() ? `
              <div class="rounded-2xl p-3 mb-4 text-center text-sm font-semibold" style="background:rgba(30,144,255,0.1);color:${NAVY};">
                ${Icon('bolt','w-4 h-4 inline-block mr-1 -mt-0.5')} Free trial: unlimited questions &amp; flashcards for ${trialDaysLeft()} more day${trialDaysLeft() === 1 ? '' : 's'}.
              </div>
            ` : ''}
            ${studyFeatureCard(0, 0, 'doc', 'Practice Tests', 'Full mock tests, timed or self-paced', 'Exam-ready questions sourced from your uploaded resources.', `
              <div class="font-semibold px-6 py-3 rounded-2xl inline-block" style="background:${PAPER_PILL_BG};color:${PAPER_PILL_TEXT};">Browse Mock Tests</div>
            `, 'openPracticeTestsOverlay()', null, true)}
            ${studyFeatureCard(4, 2, 'bolt', 'Live · Head-to-head', 'Challenge Arena', 'Real-time, competitive practice: go head-to-head with another student on the same question set.', `
              <div class="challenge-arena-actions relative">
                <button onclick="openChallengeSetupModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-2xl mb-3" style="background:${PAPER_PILL_BG};color:${PAPER_PILL_TEXT};">Set Up a Challenge</button>
                <button onclick="openInviteFriendModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-2xl mb-3" style="background:${PAPER_PILL_BG};color:${PAPER_PILL_TEXT};">Invite a Friend</button>
                <button onclick="openJoinChallengeCodeModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-2xl border" style="border-color:rgba(255,255,255,0.5);color:#ffffff;">Join with a Code</button>
              </div>
            `, null, null, true)}
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 mt-6">Flashcards</div>
            ${studyFeatureCard(6, 4, 'bookmark', 'All Resources', 'Study All Flashcards', "Auto-generated from everything you've uploaded: no need to open each resource separately.", `
              <div class="font-semibold px-6 py-3 rounded-2xl inline-block" style="background:${PAPER_PILL_BG};color:${PAPER_PILL_TEXT};">Start Studying</div>
            `, "openFlashDeck('all')", 'margin-bottom:50px;', true)}
            ${(!isTrialActive() && practiceCompleted && flashcardsCompleted) ? studyFeatureCard(2, 5, 'plus', 'Upgrade', 'Add More Questions &amp; Flashcards', "Finished everything in your practice set? Unlock a bigger pool of questions and flashcards from the same uploads.", `
              <button onclick="openSubscriptionUpgradeModal()" class="w-full text-[${NAVY}] font-semibold px-6 py-3 rounded-2xl bg-white">${Icon('plus','w-4 h-4 inline-block mr-1 -mt-0.5')} Add More Questions &amp; Flashcards</button>
            `, null, 'margin-bottom:50px;') : ''}
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
          // Capped to the student's current flashcard plan limit (20
          // free / 50 Pro / 70 Pro Plus / 70 Pro Max / unlimited
          // Platinum) across ALL uploaded resources combined, not per
          // resource -- see PLAN_LIMITS above.
          return { name: 'All Resources', cards: cards.slice(0, currentPlanLimit('flashcards')) };
        }

        // ================== RESOURCE ENGINE ==================
        // Handles uploaded files end-to-end: extract real text from the file,
        // send it to Claude to generate flashcards (terms picked from the
        // text, definitions written from real subject knowledge) plus
        // exam-style practice questions, then wire the results into flashDecks
        // (Flashcards), courseBank (Practice Tests + Challenge Mode), and
        // the AI Class chat's context so StudyBot can answer from it too.
        // ---------------- SUBSCRIPTION PLANS ----------------
        // Each plan caps the TOTAL pool of AI-generated practice
        // questions, flashcards, and challenge questions across every
        // uploaded resource combined (not per-resource) -- once a
        // student uploads enough material to exceed the cap, Stitch Pro
        // unlocks a bigger pool instead of unlocking "more resources".
        // The free tier's three pools are all sized the same (20
        // questions / 20 flashcards / 20 Challenge Arena questions);
        // Pro and Pro Plus stay uniform across all three. Both paid
        // plans renew/expire monthly -- refreshSubscriptionStatus()
        // quietly drops back to the free caps the moment a plan lapses,
        // so nothing else has to track expiry.
        const PLAN_LIMITS = {
          free: { questions: 20, flashcards: 20, challenge: 20 },
          pro: { questions: 50, flashcards: 50, challenge: 50 },
          proPlus: { questions: 70, flashcards: 70, challenge: 70 },
          proMax: { questions: 70, flashcards: 70, challenge: 70 },
          platinum: { questions: Infinity, flashcards: Infinity, challenge: Infinity }
        };
        const PLAN_PRICING = {
          pro: { amount: 20, currency: 'GHS', label: 'Pro', cycle: 'Monthly', periodDays: 30 },
          proPlus: { amount: 40, currency: 'GHS', label: 'Pro Plus', cycle: 'Monthly', periodDays: 30 },
          proMax: { amount: 50, currency: 'GHS', label: 'Pro Max', cycle: 'Monthly', periodDays: 30 },
          platinum: { amount: 500, currency: 'GHS', label: 'Platinum', cycle: 'Yearly', periodDays: 365 }
        };
        // ---------------- PER-PLAN FEATURE FLAGS ----------------
        // Beyond the questions/flashcards/challenge pool sizes above,
        // each plan also switches on/off two things that aren't a
        // "count": unlimited Stitch Bot prompts (see DAILY_PROMPT_LIMIT
        // below), and the two halves of the "Match with CV" AI career
        // feature in jobs.js -- cvAi (Claude actually reads/reasons
        // about the resume, e.g. resume feedback) and cvRecommendations
        // (Claude ranks posted opportunities against that resume and
        // hands back a matches list). Pro Plus intentionally has cvAi
        // without cvRecommendations; Pro Max and Platinum have both.
        // Free/Pro have neither -- they still get the local
        // keyword-based fallback scorer in jobs.js, just no Claude call.
        const PLAN_FEATURES = {
          free: { unlimitedPrompts: false, cvAi: false, cvRecommendations: false },
          pro: { unlimitedPrompts: true, cvAi: false, cvRecommendations: false },
          proPlus: { unlimitedPrompts: true, cvAi: true, cvRecommendations: false },
          proMax: { unlimitedPrompts: true, cvAi: true, cvRecommendations: true },
          platinum: { unlimitedPrompts: true, cvAi: true, cvRecommendations: true }
        };
        function currentPlanFeatures(){
          refreshSubscriptionStatus();
          return PLAN_FEATURES[userSubscription.plan] || PLAN_FEATURES.free;
        }
        // Renders a pool size for display -- Platinum's pools are
        // Infinity internally (see PLAN_LIMITS above) so slice(0, n)
        // call sites don't need special-casing, but "Infinity questions"
        // would look broken in the UI.
        function formatPlanCount(n){
          return n === Infinity ? 'Unlimited' : String(n);
        }
        // Default until loadUserSubscription() (core.js) loads the real
        // row right after login -- that row is the only thing that ever
        // sets this to anything other than free; see the comment there.
        let userSubscription = { plan: 'free', expiresAt: null }; // plan: 'free' | 'pro' | 'proPlus' | 'proMax' | 'platinum'

        // ---------------- 7-DAY FREE TRIAL ----------------
        // Every new account gets a full week of unlimited practice
        // questions, flashcards, and Challenge Arena questions (no plan
        // cap at all) starting the moment the account is created.
        // trialEndsAt is a ms-epoch timestamp, recomputed on every login
        // by ensureTrialInitialized (called from ensureUserStateLoaded in
        // core.js) from the account's real signup date -- not persisted,
        // since a stored copy would just be one more thing a signed-in
        // user could edit to their own advantage.
        const TRIAL_DAYS = 7;
        let trialEndsAt = null;

        // Anchors the trial to the account's real Supabase signup date
        // (user.created_at, a server-issued field the client can't set)
        // rather than "now" or a stored value, so an account whose real
        // signup was more than 7 days ago never comes back with an
        // unlimited trial -- and recomputes it fresh on every call
        // instead of trusting whatever trialEndsAt already holds. This
        // used to persist trialEndsAt into the same per-account blob a
        // user can freely upsert themselves, which meant editing that
        // one saved field to a far-future date bought permanent unlimited
        // AI usage; since this is a pure function of user.created_at
        // there's nothing worth trusting a stored copy for.
        function ensureTrialInitialized(user){
          const createdAtMs = (user && user.created_at) ? new Date(user.created_at).getTime() : Date.now();
          trialEndsAt = createdAtMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
        }
        function isTrialActive(){
          return trialEndsAt !== null && Date.now() < trialEndsAt;
        }
        function trialDaysLeft(){
          if (!isTrialActive()) return 0;
          return Math.max(1, Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)));
        }

        function refreshSubscriptionStatus(){
          if (userSubscription.plan !== 'free' && userSubscription.expiresAt && Date.now() > userSubscription.expiresAt) {
            userSubscription = { plan: 'free', expiresAt: null };
          }
        }
        // Unlimited during the trial window; otherwise the active paid
        // plan's cap for the given pool ('questions' | 'flashcards' |
        // 'challenge'). Array.prototype.slice(0, Infinity) returns the
        // full array, so every pool-building call site that does
        // `.slice(0, currentPlanLimit('questions'))` just works during
        // a trial without any special-casing.
        function currentPlanLimit(category){
          if (isTrialActive()) return Infinity;
          refreshSubscriptionStatus();
          const plan = PLAN_LIMITS[userSubscription.plan] || PLAN_LIMITS.free;
          return plan[category] !== undefined ? plan[category] : plan.questions;
        }
        function currentPlanName(){
          if (isTrialActive()) return 'trial';
          refreshSubscriptionStatus();
          return userSubscription.plan;
        }

        // ---------------- STITCH BOT DAILY PROMPT LIMIT ----------------
        // Free-tier students get DAILY_PROMPT_LIMIT Stitch Bot messages
        // per calendar day (device-local "today", same toDateString()
        // approach as lastDailyQuizDate in games.js). During the 7-day
        // trial, or on any active paid plan with unlimitedPrompts (Pro
        // and up all have it -- see PLAN_FEATURES above), prompts are
        // unlimited and this counter is never consulted. aiPromptCount/
        // aiPromptDate are persisted through collectUserState/
        // applyUserState in core.js (same pattern as lastDailyQuizDate)
        // so the count survives a refresh/relogin rather than quietly
        // resetting itself into a free unlimited-prompt loophole.
        const DAILY_PROMPT_LIMIT = 20;
        let aiPromptCount = 0;
        let aiPromptDate = null;

        function ensureAIPromptDayCurrent(){
          const today = new Date().toDateString();
          if (aiPromptDate !== today) {
            aiPromptDate = today;
            aiPromptCount = 0;
          }
        }
        function hasUnlimitedPrompts(){
          return isTrialActive() || currentPlanFeatures().unlimitedPrompts;
        }
        // How many Stitch Bot messages are left today; Infinity when
        // unlimited so callers can just check `> 0` without branching.
        function remainingAIPromptsToday(){
          if (hasUnlimitedPrompts()) return Infinity;
          ensureAIPromptDayCurrent();
          return Math.max(0, DAILY_PROMPT_LIMIT - aiPromptCount);
        }
        function canSendAIPrompt(){
          return remainingAIPromptsToday() > 0;
        }
        // Call once per Stitch Bot message actually sent to Claude (not
        // for messages blocked by the cap itself, and not for the
        // "materials"/CV-matching AI calls elsewhere in the app, which
        // have their own separate gating -- see currentPlanFeatures().
        function recordAIPromptUsed(){
          if (hasUnlimitedPrompts()) return;
          ensureAIPromptDayCurrent();
          aiPromptCount++;
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        // Tracks whether the student has been through everything in
        // their current practice/flashcard pool at least once -- only
        // once BOTH are true (and the trial has ended) does the "Add
        // more questions & flashcards" upsell button appear (see
        // studyContent()'s exams pane).
        let practiceCompleted = false;
        let flashcardsCompleted = false;

        // ---------------- SUBSCRIPTION UPGRADE MODAL ----------------
        // Reuses the shared challengeModal container (the same generic
        // popup used for Mock Test/Challenge Arena flows) instead of a
        // dedicated modal, since it already handles open/close + back-
        // button wiring.
        function openSubscriptionUpgradeModal(){
          openChallengeModal(subscriptionUpgradeHTML());
        }

        // One line per plan describing what it adds, kept out of the
        // pricing/limits tables above since it's UI copy, not config
        // other code reads.
        const PLAN_DESCRIPTIONS = {
          pro: 'Bumps practice questions, flashcards, and Challenge Arena questions to 50 each across all your uploaded resources, plus unlimited Stitch Bot prompts. Renews monthly; cancel anytime.',
          proPlus: 'Bumps practice questions, flashcards, and Challenge Arena questions to 70 each, unlimited Stitch Bot prompts, and unlocks AI-powered resume reading in Match with CV (without opportunity recommendations). Renews monthly; cancel anytime.',
          proMax: 'Everything in Pro Plus, plus AI-matched opportunity recommendations in Match with CV. Renews monthly; cancel anytime.',
          platinum: 'Unlocks everything: unlimited practice questions, flashcards, Challenge Arena questions, Stitch Bot prompts, and full AI resume matching with recommendations, for a full year.'
        };
        // Each subscription plan gets its own fixed color card (sea blue,
        // sea green, orange, golden -- one per plan, cheapest to priciest)
        // instead of a flat page-background row, echoing the same
        // gradient-card-with-motif language as the Study feature cards
        // and Classes/Opportunities elsewhere in the app.
        const planCardPalette = {
          pro: ['#006994', '#00506f'],       // sea blue
          proPlus: ['#2e8b57', '#1f6b46'],   // sea green
          proMax: ['#f97316', '#c2410c'],    // orange
          platinum: ['#d4af37', '#a8842a']   // golden
        };
        const planCardMotifs = {
          pro: classCardMotifs[0],
          proPlus: classCardMotifs[1],
          proMax: classCardMotifs[2],
          platinum: classCardMotifs[3]
        };
        function subscriptionPlanCardHTML(planKey){
          const p = PLAN_PRICING[planKey];
          const active = currentPlanName() === planKey;
          const [from, to] = planCardPalette[planKey] || planCardPalette.pro;
          return `
            <div class="rounded-2xl p-6 mb-4 relative overflow-hidden" style="background:linear-gradient(135deg,${from},${to});">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${planCardMotifs[planKey] || ''}</svg>
              <div class="relative">
                <div class="flex items-center justify-between mb-2">
                  <div class="text-2xl font-bold text-white">${p.label}</div>
                  <div class="text-xl font-bold text-white">${p.currency} ${p.amount}<span class="text-sm font-semibold text-white text-opacity-70">/${p.cycle === 'Yearly' ? 'year' : 'month'}</span></div>
                </div>
                <div class="text-base text-white text-opacity-85 mb-5 leading-relaxed">${PLAN_DESCRIPTIONS[planKey] || ''}</div>
                <button onclick="submitSubscriptionPurchase('${planKey}')" ${active ? 'disabled' : ''} class="w-full font-semibold py-3.5 rounded-2xl text-center text-base ${active ? 'bg-white bg-opacity-25 text-white' : 'bg-white'}" style="${active ? '' : `color:${from};`}">${active ? 'Current Plan' : 'Subscribe · ' + p.currency + ' ' + p.amount}</button>
              </div>
            </div>`;
        }

        function subscriptionUpgradeHTML(){
          return `
            <button onclick="closeChallengeModal()" class="w-8 h-8 -ml-1 -mt-1 mb-2 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
            <div class="text-2xl font-bold text-gray-900 mb-2">Add More Questions &amp; Flashcards</div>
            <div class="text-sm text-gray-500 mb-5">You've been through everything in your free practice set. Subscribe to unlock a bigger pool of practice questions, flashcards, and Challenge Arena questions generated from the same uploads.</div>
            ${subscriptionPlanCardHTML('pro')}
            ${subscriptionPlanCardHTML('proPlus')}
            ${subscriptionPlanCardHTML('proMax')}
            ${subscriptionPlanCardHTML('platinum')}
            <div class="text-xs text-gray-400 leading-relaxed mt-2">Pro raises your total question/flashcard/Challenge Arena pool to 50 each (all uploads combined) with unlimited Stitch Bot prompts; Pro Plus raises it to 70 each and adds AI resume reading in Match with CV; Pro Max adds AI opportunity recommendations on top of that; Platinum unlocks everything, unlimited, for a year. All plans can be cancelled anytime from Profile. When a plan expires without renewing, your account automatically returns to the free pool (20 practice questions, 20 flashcards, 20 Challenge Arena questions, ${DAILY_PROMPT_LIMIT} Stitch Bot prompts a day); your uploads and existing progress are never deleted. Payments are processed securely by Paystack; we never see or store your card details.</div>
          `;
        }

        // Settings > Subscription: shows every plan, flags whichever one
        // (if any) is currently active, and lets the student subscribe or
        // switch plans right here (same real Paystack checkout as the
        // upsell modal via submitSubscriptionPurchase) instead of only
        // being able to look, so this is reachable -- and usable -- any
        // time from Settings, not only after running out of the free
        // question/flashcard pool.
        function subscriptionSettingsHTML(){
          refreshSubscriptionStatus();
          const activePlan = currentPlanName();
          const activeLabel = activePlan === 'free' ? 'Free' : ((PLAN_PRICING[activePlan] || {}).label || activePlan);
          return `
            <div class="flex-1 overflow-y-auto">
              ${overlayHeader('Subscription', '20px')}
              <div class="p-5">
                <div class="rounded-2xl p-5 mb-6 text-center" style="background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                  <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Current Plan</div>
                  <div class="text-2xl font-bold" style="color:${NAVY};">${activeLabel}</div>
                  ${activePlan !== 'free' && userSubscription.expiresAt ? `
                    <div class="text-xs text-gray-400 mt-1">Renews/expires ${new Date(userSubscription.expiresAt).toLocaleDateString()}</div>
                  ` : `
                    <div class="text-xs text-gray-400 mt-1">${formatPlanCount(PLAN_LIMITS.free.questions)} practice questions, ${formatPlanCount(PLAN_LIMITS.free.flashcards)} flashcards, ${formatPlanCount(PLAN_LIMITS.free.challenge)} Challenge Arena questions</div>
                  `}
                </div>
                ${referralCreditToggleHTML()}
                <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">All Plans</div>
                ${Object.keys(PLAN_PRICING).map(subscriptionSettingsPlanRow).join('')}
                <div class="text-xs text-gray-400 leading-relaxed mt-4">All plans can be cancelled anytime; when a plan expires without renewing, your account automatically returns to the free pool and your uploads and existing progress are never deleted. Payments are processed securely by Paystack; we never see or store your card details.</div>
              </div>
            </div>`;
        }

        // Whether the signed-in student wants their referral points
        // credit (1 point = GHS 1 -- see loadReferralProfile in core.js)
        // applied as a discount on their next subscription purchase.
        // Purely a display/checkout-amount toggle -- points themselves
        // are only ever actually deducted server-side, after a payment
        // Paystack has actually confirmed (see verifyPaystackPaymentAndActivate
        // below), never just for toggling this on.
        let useReferralCreditAtCheckout = false;
        function toggleReferralCreditAtCheckout(){
          useReferralCreditAtCheckout = !useReferralCreditAtCheckout;
          const ov = document.getElementById('overlay');
          if (ov && typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'subscriptionSettings') ov.innerHTML = subscriptionSettingsHTML();
        }
        // How many of this account's referral points would actually get
        // spent on a given plan -- capped at both the plan's own price
        // (a point is worth exactly GHS 1, never more than the bill
        // itself) and whatever points are actually available.
        function referralCreditForPlan(planKey){
          if (!useReferralCreditAtCheckout) return 0;
          const p = PLAN_PRICING[planKey];
          if (!p) return 0;
          return Math.max(0, Math.min(referralPoints || 0, p.amount));
        }
        function referralCreditToggleHTML(){
          if (!referralPoints) return '';
          return `
            <div class="rounded-2xl p-4 mb-5 flex items-center gap-3" style="background:rgba(65,105,225,0.10); border:1px solid rgba(65,105,225,0.25);">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-bold" style="color:${NAVY};">Referral credit: GHS ${referralPoints}</div>
                <div class="text-xs text-gray-500 mt-0.5">Apply it toward whichever plan you subscribe to below</div>
              </div>
              <button onclick="toggleReferralCreditAtCheckout()" class="relative flex-shrink-0" style="width:44px;height:24px;border-radius:9999px;border:1px solid ${useReferralCreditAtCheckout ? 'transparent' : '#d1d5db'};background:${useReferralCreditAtCheckout ? `linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%)` : '#e5e7eb'};box-shadow:inset 0 1px 2px rgba(0,0,0,0.08);transition:background .15s ease;">
                <span style="position:absolute;top:1px;left:1px;width:20px;height:20px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);transform:translateX(${useReferralCreditAtCheckout ? '20px' : '0'});transition:transform .15s ease;"></span>
              </button>
            </div>`;
        }

        // Single plan row inside Settings > Subscription -- same colored
        // gradient card treatment (and same fixed sea-blue/sea-green/
        // orange/golden palette) as subscriptionPlanCardHTML above, plus
        // an "Active" tag next to the current plan. The button is a real,
        // working Subscribe action (submitSubscriptionPurchase), not just
        // a link out to another screen, so a plan can actually be bought
        // or switched right here.
        function subscriptionSettingsPlanRow(planKey){
          const p = PLAN_PRICING[planKey];
          const active = currentPlanName() === planKey;
          const [from, to] = planCardPalette[planKey] || planCardPalette.pro;
          const credit = referralCreditForPlan(planKey);
          const payable = p.amount - credit;
          return `
            <div class="rounded-2xl p-5 mb-4 relative overflow-hidden" style="background:linear-gradient(135deg,${from},${to});">
              <svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${planCardMotifs[planKey] || ''}</svg>
              <div class="relative">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <div class="text-lg font-bold text-white">${p.label}</div>
                    ${active ? `<span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-white" style="color:${from};">Active</span>` : ''}
                  </div>
                  <div class="text-right">
                    ${credit > 0 ? `<div class="text-xs font-semibold text-white text-opacity-70 line-through">${p.currency} ${p.amount}</div>` : ''}
                    <div class="text-base font-bold text-white">${p.currency} ${payable}<span class="text-xs font-semibold text-white text-opacity-70">/${p.cycle === 'Yearly' ? 'year' : 'month'}</span></div>
                  </div>
                </div>
                <div class="text-sm text-white text-opacity-85 mb-3">${PLAN_DESCRIPTIONS[planKey] || ''}${credit > 0 ? ` · GHS ${credit} referral credit applied` : ''}</div>
                <button onclick="submitSubscriptionPurchase('${planKey}')" ${active ? 'disabled' : ''} class="w-full font-semibold py-3 rounded-2xl text-center text-sm ${active ? 'bg-white bg-opacity-25 text-white' : 'bg-white'}" style="${active ? '' : `color:${from};`}">${active ? 'Current Plan' : 'Subscribe · ' + p.currency + ' ' + payable}</button>
              </div>
            </div>`;
        }

        // Launches a real Paystack Popup checkout, reusing the same
        // paystack-verify Edge Function and loadPaystackScript()/
        // PAYSTACK_PUBLIC_KEY already set up for paid course enrollment
        // (see jobs.js) rather than a second bespoke payment path. The
        // Popup's own `callback` fires as soon as Paystack's client-side
        // widget reports success, but that alone is never trusted to
        // activate a plan -- a client-side "success" callback can be
        // spoofed by anyone with devtools open. Instead the reference is
        // handed to verifyPaystackPaymentAndActivate(), which re-checks
        // it server-side via paystack-verify (Paystack's Verify
        // Transaction API + the secret key, which never reaches the
        // browser) before anything is actually unlocked.
        let subscriptionPaymentBusy = false;

        async function submitSubscriptionPurchase(planKey){
          if (subscriptionPaymentBusy) return;
          const p = PLAN_PRICING[planKey];
          const user = await getCachedAuthUser();
          const email = (user && user.email) || (typeof profileData !== 'undefined' && profileData.email) || '';
          if (!user || !email) {
            pushInAppNotification('Sign in required', 'Please sign in before subscribing.');
            return;
          }

          subscriptionPaymentBusy = true;
          try {
            await loadPaystackScript();
          } catch (err) {
            subscriptionPaymentBusy = false;
            pushInAppNotification('Payment unavailable', 'Could not load the payment popup. Check your connection and try again.');
            return;
          }

          // See teardownPaystackPopup() in overlays.js: wraps the shared
          // history-pop + DOM-cleanup with this checkout's own "payment
          // in progress" flag reset, so the phone/browser back button
          // dismisses the popup and lands the student back on the plan
          // picker instead of leaving the app.
          function closeSubscriptionPaystackPopup(fromPopState){
            teardownPaystackPopup(fromPopState);
            subscriptionPaymentBusy = false;
          }

          // Referral credit (1 point = GHS 1), capped at what this
          // account actually has and at the plan's own price -- see
          // referralCreditForPlan above. Locked into a local const here
          // (rather than re-read from the live referralPoints/toggle at
          // verify time) so a payment already opened at this discount
          // can't have a different amount deducted from points later,
          // however long the Paystack popup stays open.
          //
          // IMPORTANT: paystack-verify (the Edge Function that actually
          // confirms this charge -- see verifyPaystackPaymentAndActivate
          // below) is deployed separately and isn't part of this
          // repo/zip, so it isn't something this change could update
          // directly. For this discount to be tamper-proof end to end
          // (not just "the UI shows a lower number"), that function
          // needs a matching update: instead of checking the paid
          // amount against a single fixed PLAN_RULES[plan] price, it
          // should look up this account's real referral_points balance
          // itself (service-role, same as everything else it already
          // does), compute the same `expected = planPrice - min(points, planPrice)`,
          // and only accept the transaction if Paystack's confirmed
          // amount matches THAT. See referral-schema.sql (included
          // alongside this zip) for the exact snippet to add. Until
          // that's deployed, a discounted checkout here will very
          // likely fail paystack-verify's amount check and the plan
          // won't activate -- so treat this purely as the client half
          // of the feature until the server half is deployed too.
          const referralCreditUsed = referralCreditForPlan(planKey);
          const payable = p.amount - referralCreditUsed;

          const reference = 'stitch_' + planKey + '_' + user.id.slice(0, 8) + '_' + Date.now();
          const handler = window.PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email,
            amount: Math.round(payable * 100), // GHS -> pesewas: Paystack expects the smallest currency unit
            currency: p.currency,
            ref: reference,
            // No job_id here -- paystack-verify (supabase/functions/
            // paystack-verify/index.ts) checks metadata.plan against its
            // own PLAN_RULES table for subscription charges, the same
            // way it checks metadata.job_id against the opportunities
            // table for course-payment charges. referralPointsUsed is
            // read by the paystack-verify update described above, once
            // that's deployed.
            metadata: { plan: planKey, referralPointsUsed: referralCreditUsed },
            callback: function(response){
              // Paystack already closes its own iframe before calling
              // this, but our history entry (pushed below) still needs
              // consuming so the next back-press doesn't land on a dead
              // state -- not a cancel, so no "Payment cancelled" toast.
              popModalBackHandler(false);
              verifyPaystackPaymentAndActivate(planKey, response.reference, referralCreditUsed);
            },
            onClose: function(){
              closeSubscriptionPaystackPopup(false);
              pushInAppNotification('Payment cancelled', 'No charge was made.');
            }
          });
          pushModalBackHandler(closeSubscriptionPaystackPopup);
          handler.openIframe();
        }

        async function verifyPaystackPaymentAndActivate(planKey, reference, referralCreditUsed){
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to complete payment: please log in again.');
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/paystack-verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken,
                'apikey': SUPABASE_ANON_KEY
              },
              body: JSON.stringify({ reference })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Payment verification failed (' + res.status + ')');
            if (!data.verified) throw new Error('We could not confirm this payment. If you were charged, contact support with reference ' + reference + '.');
            if (!data.subscription) throw new Error('Payment confirmed but activation did not come back from the server. Please refresh -- contact support with reference ' + reference + ' if the plan still isn\'t active.');

            // Unlike course enrollment, the plan itself is NOT set here.
            // The edge function already wrote the authoritative row to
            // user_subscriptions (using the service-role key, since that
            // table isn't writable by the signed-in user at all) before
            // this response came back -- data.subscription is just that
            // same server-computed { plan, expiresAt } reflected locally
            // so the UI updates immediately, without a second round trip.
            const p = PLAN_PRICING[planKey];
            userSubscription = { plan: data.subscription.plan, expiresAt: data.subscription.expiresAt };
            subscriptionPaymentBusy = false;
            closeChallengeModal();
            // Only spend the referral points once Paystack has actually
            // confirmed the charge went through -- spend_referral_points
            // (see referral-schema.sql) clamps to whatever's really left
            // in this account's balance, so this can never take a
            // student below zero points even if the balance changed
            // (e.g. spent on another device) since checkout opened.
            // Best-effort: a failure here shouldn't undo an already-
            // activated subscription, it just leaves the points as they
            // were for next time.
            if (referralCreditUsed > 0) {
              const sb = getSupabaseClient();
              if (sb) {
                sb.rpc('spend_referral_points', { points_to_spend: referralCreditUsed })
                  .then(() => { if (typeof loadReferralProfile === 'function') loadReferralProfile(); })
                  .catch(e => console.warn('Spending referral points failed:', e));
              }
            }
            pushInAppNotification(p.label + ' activated', 'Your practice questions, flashcards, and Challenge Arena questions are now capped at ' + formatPlanCount(PLAN_LIMITS[planKey].questions) + ' each, across all your uploads, until this plan renews or expires.');
            const content = document.getElementById('study-content');
            if (content && typeof studyContent === 'function') content.innerHTML = studyContent();
            // Settings > Subscription lets a student buy or switch plans
            // right from that page (see subscriptionSettingsHTML) rather
            // than only from the upsell modal -- if that's the overlay
            // that's open, re-render it too so the new active plan and
            // its "Active" tag show up immediately.
            useReferralCreditAtCheckout = false;
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'subscriptionSettings') {
              const ov = document.getElementById('overlay');
              if (ov) ov.innerHTML = subscriptionSettingsHTML();
            }
          } catch (err) {
            subscriptionPaymentBusy = false;
            console.error('Paystack verification failed:', err);
            window.reportError && window.reportError(err, { call: 'verifyPaystackPaymentAndActivate', plan: planKey });
            pushInAppNotification('Payment not confirmed', err.message || 'Payment verification failed. Please try again.');
          }
        }

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
            throw new Error(`Too many AI requests, please wait ${waitSec}s and try again.`);
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
        // `images`, when given, is an array of { mediaType, data } (raw
        // base64, no "data:...;base64," prefix -- see fileToBase64 in
        // courses.js) that gets forwarded to the Edge Function so it can
        // build a real multimodal request to Claude. Without this, the
        // 4th argument getAIResponse (courses.js) already builds for
        // every image attachment was silently being dropped here, which
        // is why Stitch Bot kept saying it couldn't see a picture that
        // had, in fact, been sent -- see ai-proxy-routing-snippet.ts for
        // the matching server-side change this needs.
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
              err = new Error('Could not reach the AI service: check your connection, or the ai-proxy Edge Function/CORS setup, and try again.');
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

        // Deterministic content hash used for exact-duplicate resource
        // detection (see the "Duplicate detection" block in
        // processUploadedResource). Hashes normalized text with
        // SHA-256 via the browser's native crypto.subtle where
        // available (any real deployment, which is https); falls back
        // to a simple deterministic string hash otherwise (e.g. local
        // dev over plain http, where crypto.subtle is unavailable) --
        // not cryptographically strong, but exact-duplicate text still
        // always produces identical output, which is all this needs.
        async function hashResourceText(text){
          const normalized = text.replace(/\s+/g, ' ').trim();
          if (window.crypto && window.crypto.subtle && window.isSecureContext) {
            try {
              const encoded = new TextEncoder().encode(normalized);
              const digest = await window.crypto.subtle.digest('SHA-256', encoded);
              return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) { /* fall through to the simple hash below */ }
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

        // Sends the extracted text to Claude and asks for flashcards +
        // multiple-choice practice questions. The extracted text is only
        // used to pick WHICH terms/concepts are actually covered by this
        // resource -- each flashcard's definition is written from
        // accurate, real-world subject knowledge (the same way a
        // dictionary/textbook or a web search would define the term),
        // never lifted or paraphrased from the source document's own
        // wording. That's a deliberate fix: raw slide/PDF text is often
        // choppy, incomplete, or missing a real definition altogether
        // (a title, a bullet fragment, a name), which used to leak
        // straight into the card. Practice questions are written to read
        // like genuine exam questions -- testing understanding of a
        // concept, not just "which term matches this definition".
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
              // Default to mcq for anything else (including old rows saved
              // before "type" existed -- see applyUserState/uploadedResources
              // in core.js, which restores questions exactly as they were
              // saved, so an older resource's cards never had a "type" field).
              return Array.isArray(q.options) && q.options.length === 4 && typeof q.correct === 'number';
            }).map(q => q.type === 'written'
              ? { text: q.text, type: 'written', answer: q.answer, keywords: Array.isArray(q.keywords) ? q.keywords : [] }
              : { text: q.text, type: 'mcq', options: q.options, correct: q.correct })
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
          'each','some','many','most','all','such','only','just','even','not','no',
          'the','a','an','following','above','below','sample','given'
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
          'agenda','recap','review','following','sample','given','exercise','exercises',
          'problem','problems','task','tasks'
        ]);

        // Phrases that mark a sentence as a practice-problem/exam-instruction
        // statement ("Test the hypothesis that...", "Use the 0.05
        // significance level", "Solve for x", "Calculate the mean") rather
        // than a definition. These read grammatically like "X is Y" (so they
        // slip past the def-pattern regexes below) but the "definition" they
        // produce is actually a stats/math problem to be solved, not an
        // explanation of a concept -- unusable as either a flashcard or a
        // clean question stem.
        const EXAM_PROBLEM_RE = /\b(test the hypothesis|significance level|null hypothesis|alternative hypothesis|degrees? of freedom|confidence interval|solve for|calculate the|compute the|find the value|given that|using the (?:data|table|information)|round(?:ed)? to \d|p-value|critical value)\b/i;

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
          if (EXAM_PROBLEM_RE.test(cleaned) || EXAM_PROBLEM_RE.test(term)) return false;
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
                type: 'mcq',
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
            // Carries type/answer/keywords through too now (used by
            // written/fill-in-the-blank questions -- see the "type" field
            // generateStudyMaterials produces), not just the mcq fields.
            // Defaults type to 'mcq' for older saved resources from before
            // "type" existed (see applyUserState in core.js, which restores
            // uploadedResources -- and therefore these questions -- exactly
            // as previously saved).
            questions: resource.questions.map(q => q.type === 'written'
              ? { text: q.text, type: 'written', answer: q.answer, keywords: q.keywords || [] }
              : { text: q.text, type: 'mcq', options: q.options, correct: q.correct })
          });
          selectedCourseNames.add(name);
        }

        // Rebuilds flashDecks/courseBank (and the challenge subject list)
        // from whatever's currently in uploadedResources. Needed after
        // applyUserState replaces uploadedResources wholesale on login
        // (see core.js) -- that restores each resource's saved flashcards
        // and questions, but flashDecks/courseBank themselves are derived,
        // in-memory-only lookups that registerResourceDeck/
        // registerResourceCourse normally build at upload time, so they'd
        // otherwise stay empty (and Practice/Flashcards look empty) even
        // though the underlying data came back fine.
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

        // Removing a row shifts everything below it (including the Practice
        // card / next resource row) up into the spot the "x" button used to
        // occupy. On touchscreens a slightly-too-fast follow-up tap then
        // lands on whatever slid into that spot instead of empty space --
        // e.g. opening Practice or a mock test right after you meant to
        // just delete a file. Briefly ignore taps on the list after a
        // removal so that reflow can't be tapped through by accident.
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

            // ---- Duplicate detection ----
            // Hashes the EXTRACTED TEXT (not the filename and not the
            // raw file bytes), after collapsing whitespace, so this
            // catches both re-uploading the exact same file AND the
            // exact same document saved/exported under a different
            // filename or file type (e.g. "Week 3.pdf" and "week3 copy.docx"
            // that came from the same source) -- both extract to
            // identical text, so an identical content hash flags either
            // case the same way. This is a deterministic exact-content
            // check, not a fuzzy AI similarity check -- it's instant,
            // free, and precisely matches "the exact same document",
            // which is what was asked for; a near-duplicate/paraphrase
            // detector would be a different (fuzzier, costlier) feature.
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
          const wasLastCard = currentCardIndex === deck.cards.length - 1;
          currentCardIndex = (currentCardIndex + 1) % deck.cards.length;
          cardFlipped = false;
          // Only the combined "All Resources" deck counts toward the
          // upsell condition -- tapping Next past its last card means
          // the student has now been through every flashcard in their
          // current plan's pool at least once.
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

