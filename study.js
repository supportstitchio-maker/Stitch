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
              closeStudyFabMenu();
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

        // Close-only: dragging on the dim backdrop fires touchmove many times, so a plain toggle
        // would flip the menu open and shut while scrolling.
        function closeStudyFabMenu(){
          if (!studyFabMenuOpen) return;
          toggleStudyFabMenu();
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
                <div onclick="closeStudyFabMenu()" onwheel="closeStudyFabMenu()" ontouchmove="closeStudyFabMenu()" class="fixed inset-0 z-30" style="background:rgba(10,15,25,0.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);"></div>
                <div id="study-fab-menu" class="fixed w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-30" style="right:1.25rem;bottom:8.5rem;">
                  <button onclick="toggleStudyFabMenu(); openJoinClassroom();" class="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-semibold text-gray-700">${Icon('users','w-4 h-4')} Join space</button>
                  <button onclick="toggleStudyFabMenu(); openCreateClassroom();" class="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-semibold text-gray-700">${Icon('plus','w-4 h-4')} Create space</button>
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
                <button onclick="openLeaveClassModal()" class="study-leave-classroom-btn flex items-center gap-1 flex-shrink-0 text-red-500">${IconBold('back','w-4 h-4 study-leave-classroom-icon')}<span class="font-bold text-xs study-leave-classroom-label">Leave</span></button>
                <h1 class="text-3xl font-bold font-display grad-text truncate ml-3">Workspace</h1>
              </div>` : `
              <div class="flex items-center gap-2 mb-4">
                <h1 class="text-3xl font-bold font-display grad-text truncate">Workspace</h1>
              </div>`}
              <div class="classroom-toggle-wrap seg-bar mb-5">
                <button onclick="setClassroomAreaTab('classes')" class="seg-btn classroom-toggle-pill ${classroomAreaTab === 'classes' ? 'on' : ''}"><span class="seg-lbl-m">My Spaces</span><span class="seg-lbl-d">Spaces</span></button>
                <button onclick="setClassroomAreaTab('courses')" class="seg-btn classroom-toggle-pill ${classroomAreaTab === 'courses' ? 'on' : ''}">Courses</button>
              </div>
              <div class="classroom-tab-panel ${(window.__studyNoSlide || !classroomAreaTabSlideDir) ? '' : (classroomAreaTabSlideDir === 'left' ? 'classroom-tab-slide-left' : 'classroom-tab-slide-right')}">
              ${classroomAreaTab === 'courses' ? coursesHomeHTML() : `
                ${hasClasses ? (studySub === 'resources' ? '' : myClassesListHTML()) : `
                <div class="flex gap-2 mb-5">
                  <button onclick="openJoinClassroom()" class="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-3 font-semibold text-sm text-[${NAVY}]">
                    ${Icon('users','w-4 h-4')} Join a Space
                  </button>
                  <button onclick="openCreateClassroom()" class="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-sm border" style="color:${NAVY};border-color:rgba(30,144,255,0.09);background-image:linear-gradient(135deg, rgba(30,144,255,0.09) 0%, rgba(65,105,225,0.09) 100%);background-color:#ffffff;">
                    ${Icon('plus','w-4 h-4')} Create a Space
                  </button>
                </div>`}
                <div id="study-content">${studyContent()}</div>`}
              </div>
            </div>
            ${classroomAreaTab === 'classes' && hasClasses && (studySub === 'exams' || studySub === 'resources') ? studyFabHTML() : ''}`;
          // The slide-in plays once per tab switch, not on every re-draw (re-draws look like blinking)
          classroomAreaTabSlideDir = null;
          setTimeout(studyMiniBarSync, 0);
          const classroomNav = document.getElementById('classroom-nav');
          if (classroomNav) classroomNav.style.display = '';
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
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">My Spaces</div>
            <div class="my-spaces-grid">${myClasses.map((c, i) => {
              const motif = classCardMotifs[classCardMotifIndex(c, i) % classCardMotifs.length];
              return `
              <div onclick="openClassDetailWithLoading('${c.id}')" class="class-color-card ${i % 2 ? 'class-tone-b' : 'class-tone-a'} rounded-3xl p-5 text-white relative overflow-hidden mb-3 cursor-pointer" style="${c.photo ? `background-image:linear-gradient(rgba(10,37,64,0.45),rgba(10,37,64,0.45)),url('${c.photo}');background-size:cover;background-position:center;` : classCardBackgroundStyle(c)}min-height:104px;">
                ${c.photo ? '' : `<svg viewBox="0 0 300 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full" style="opacity:0.16;">${motif}</svg>`}
                <div class="flex items-center justify-between gap-2 mb-1 relative">
                  <div class="nm-wrap nm-left text-base font-bold font-display" style="flex:1;min-width:0;"><span class="nm-inner">${escapeHtml(c.name)}</span></div>
                  <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0 bg-white/20">${c.role === 'teacher' ? 'Moderating' : 'Member'}</span>
                </div>
                ${(c.section || classFeeLabel(c)) ? `<div class="flex items-center justify-between gap-3 relative">
                  <div class="text-sm text-white/85 truncate">${c.section ? escapeHtml(c.section) : ''}</div>
                  ${classFeeLabel(c) ? `<div class="text-sm font-bold text-white/95 flex-shrink-0">${classFeeLabel(c)}</div>` : ''}
                </div>` : ''}
              </div>`;
            }).join('')}</div>
          `;
        }

        // Tracks which classes have already played the "Preparing class" spin-up animation this
        // session
        let preparedClassIds = new Set();
        function openClassDetailWithLoading(id){
          enterClassroomTab();
          if (preparedClassIds.has(id)) {
            openClassDetail(id);
            return;
          }
          { const _c = myClasses.find(x => x.id === id); classSkeletonRole = (_c && _c.role === 'student') ? 'student' : 'teacher'; }
          runClassActionLoading('Preparing space', 'folder', () => {
            preparedClassIds.add(id);
            openClassDetail(id);
          });
        }

        function studyFeatureCard(icon, eyebrow, title, sub, actionsHtml, onclick, extraStyle, image){
          return `
            <div ${onclick ? `onclick="${onclick}" class="bg-white rounded-3xl p-6 mb-4 relative overflow-hidden border border-gray-100 cursor-pointer"` : `class="bg-white rounded-3xl p-6 mb-4 relative overflow-hidden border border-gray-100"`} style="${extraStyle || ''}">
              <div class="relative">
                <div class="text-base font-bold mb-2 text-[${NAVY}]">${title}</div>
                <div class="text-sm mb-4 text-gray-500">${sub}</div>
                ${actionsHtml}
              </div>
            </div>`;
        }

        function studyContent(){
          if (studySub === 'resources') return `
            ${studyToolsHTML()}
            ${myClasses.length ? myClassesListHTML() : ''}
          `;
          if (studySub === 'exams') return `
            ${studyFeatureCard('doc', 'Practice Tests', 'Full mock tests, timed or self-paced', 'Exam-ready questions sourced from your uploaded resources.', `
              <div class="font-semibold px-6 py-3 rounded-full inline-block text-white" style="font-family:'Colmeak','Montserrat',sans-serif;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Browse Mock Tests</div>
            `, 'openPracticeTestsOverlay()', null)}
            ${studyFeatureCard('bolt', 'Live · Head-to-head', 'Challenge Arena', 'Real-time, competitive practice: go head-to-head with another student on the same question set.', `
              <div class="challenge-arena-actions relative">
                <button onclick="openChallengeSetupModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-full mb-3 text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Set Up a Challenge</button>
                <button onclick="openInviteFriendModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-full mb-3 text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Invite a Friend</button>
                <button onclick="openJoinChallengeCodeModal()" class="w-full flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-full border" style="font-family:'Colmeak','Montserrat',sans-serif;border-color:${NAVY};color:${NAVY};">Join with a Code</button>
              </div>
            `, null, null)}
            <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3 mt-6">Flashcards</div>
            ${studyFeatureCard('bookmark', 'All Resources', 'Study All Flashcards', "Auto-generated from everything you've uploaded: no need to open each resource separately.", `
              <div class="font-semibold px-6 py-3 rounded-full inline-block text-white" style="font-family:'Colmeak','Montserrat',sans-serif;background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Start Studying</div>
            `, "openFlashDeck('all')", 'margin-bottom:50px;')}
          `;
        }

        // ---- Study plan cards + tab/limit helpers ----
        function studyCard(icon,title,sub,onclick){
          return `
            <div onclick="${onclick}" class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 cursor-pointer shadow-sm">
              <div class="w-12 h-12 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(icon,'w-6 h-6')}</div>
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
              <div class="w-12 h-12 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(icon,'w-6 h-6')}</div>
              <div class="flex-1">
                <div class="font-semibold text-sm">${title}</div>
                <div class="text-xs text-gray-500">${sub}</div>
              </div>
            </div>`;
        }

        // Study Planner hub: what is next, then Timetable and Reminders as call-card rows
        // ---- Workspace tools: next class (call card) + Upload / Timetable / Reminders ----
        function studyToolsHTML(){
          const next = (typeof getNextUpcomingClass === 'function') ? getNextUpcomingClass() : null;
          const now = new Date();
          const remCount = [...studyReminders].filter(r => reminderWhen(r) >= now).length;
          const classCount = classSchedule.length;
          const nextCard = next ? `
            <div class="call-min-card rounded-2xl overflow-hidden bg-white" style="margin-bottom:12px;cursor:pointer;" onclick="openStudyTimetable()">
              <div class="flex items-center gap-3 px-4 py-3 select-none">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold text-gray-900 truncate font-display">${escapeHtml(next.subject)}</div>
                  <div class="text-xs text-gray-500 truncate">${next.dayLabel === 'today' ? 'Today' : next.dayLabel === 'tomorrow' ? 'Tomorrow' : next.dayLabel} &middot; ${formatTime12(next.start)}${next.room ? ' &middot; ' + escapeHtml(next.room) : ''}</div>
                </div>
                <span class="text-xs font-bold flex-shrink-0" style="color:#1e90ff;white-space:nowrap;text-align:right;line-height:1.35;"><span style="display:block;">Class starts in</span><span style="display:block;">${plannerCountdownText(next.when - now)}</span></span>
              </div>
            </div>` : '';
          const tile = (icon, title, sub, fn) => `
            <button onclick="${fn}" class="stg-card" style="flex:1;min-width:0;padding:14px 6px;text-align:center;display:flex;flex-direction:column;align-items:center;">
              <span class="stg-ico flex items-center justify-center">${Icon(icon,'w-6 h-6')}</span>
              <div class="stg-title font-semibold" style="font-size:13px;margin-top:6px;">${title}</div>
              <div class="stg-sub" style="font-size:11px;margin-top:1px;white-space:nowrap;">${sub}</div>
            </button>`;
          const files = uploadedResources.length;
          return `
            <div style="margin-bottom:6px;">
              ${nextCard}
              <div id="study-tools-tiles" style="display:flex;gap:10px;">
                ${tile('upload','Upload', files ? `${files} file${files === 1 ? '' : 's'}` : 'Add a file', 'openUploadSheet()')}
                ${tile('calendar','Timetable', classCount ? `${classCount} this week` : 'Set up', 'openStudyTimetable()')}
                ${tile('bell','Reminders', remCount ? `${remCount} due` : 'Add one', "openOverlay('studyReminders')")}
              </div>
            </div>`;
        }

        // Upload lives in a sheet: picker + every upload with its status
        function uploadSheetInnerHTML(){
          return `
            <div class="font-display" style="font-size:24px;color:${ROYAL};">Upload a resource</div>
            <input type="file" id="resource-file-input" accept=".pdf,.docx,.pptx" multiple class="hidden" onchange="handleResourceFileSelect(event)">
            <div onclick="document.getElementById('resource-file-input').click()"
                 ondragover="event.preventDefault();this.classList.add('bg-amber-100')"
                 ondragleave="this.classList.remove('bg-amber-100')"
                 ondrop="handleResourceDrop(event)"
                 class="resource-dropzone stg-card" style="margin-top:14px;border:2px dashed #d1d5db;padding:24px 16px;text-align:center;cursor:pointer;">
              <span class="stg-ico flex items-center justify-center" style="margin:0 auto;">${Icon('upload','w-7 h-7')}</span>
              <div class="stg-title font-semibold" style="font-size:14px;margin-top:6px;">Choose files</div>
              <div class="stg-sub" style="font-size:12px;margin-top:2px;">Textbooks, slides, practice tests &middot; PDF, DOCX, PPTX &middot; up to 50MB</div>
            </div>
            ${uploadedResources.length ? `
              <div class="k stg-k" style="font-size:11px;font-weight:800;letter-spacing:.06em;color:#9ca3af;text-transform:uppercase;margin:18px 4px 8px;">Your uploads</div>
              ${uploadedResources.map(resourceStatusRow).join('')}
            ` : `<div class="stg-sub" style="font-size:13px;text-align:center;padding:18px 0 4px;">Upload a PDF, DOCX or PPTX to unlock quizzes and flashcards built from it.</div>`}`;
        }
        function openUploadSheet(){
          plannerSheetOpen(uploadSheetInnerHTML());
          const w = document.getElementById('planner-sheet');
          if (w) w.dataset.kind = 'upload';
        }
        function refreshUploadSheet(){
          const w = document.getElementById('planner-sheet');
          if (!w || w.dataset.kind !== 'upload') return;
          const box = w.querySelector('.planner-sheet');
          const top = box ? box.scrollTop : 0;
          openUploadSheet();
          const nb = document.querySelector('#planner-sheet .planner-sheet');
          if (nb) nb.scrollTop = top;
        }

        // Slim tool bar that appears once the tiles scroll out of view
        let studyMiniObserver = null;
        function studyMiniBarRemove(){
          if (studyMiniObserver) { try { studyMiniObserver.disconnect(); } catch (e) {} studyMiniObserver = null; }
          const b = document.getElementById('study-mini-bar');
          if (b) b.remove();
        }
        function studyMiniBarSync(){
          studyMiniBarRemove();
          const tiles = document.getElementById('study-tools-tiles');
          if (!tiles || typeof IntersectionObserver === 'undefined' || window.innerWidth >= 1024) return;
          const bar = document.createElement('div');
          bar.id = 'study-mini-bar';
          bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:20;display:none;gap:8px;padding:calc(var(--top-safe-pad, 0px) + 8px) 16px 10px;background:rgba(249,250,251,.96);box-shadow:0 6px 16px rgba(15,23,42,.08);backdrop-filter:blur(8px);justify-content:center;';
          const pill = (icon, label, fn) => `<button onclick="${fn}" class="stg-card" style="display:flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;font-size:13px;font-weight:700;"><span class="stg-ico flex items-center">${Icon(icon,'w-4 h-4')}</span><span class="stg-title">${label}</span></button>`;
          bar.innerHTML = pill('upload','Upload','openUploadSheet()') + pill('calendar','Timetable','openStudyTimetable()') + pill('bell','Reminders',"openOverlay('studyReminders')");
          document.body.appendChild(bar);
          studyMiniObserver = new IntersectionObserver(entries => {
            const e = entries[entries.length - 1];
            if (!tiles.isConnected) { studyMiniBarRemove(); return; }
            const ov = document.getElementById('overlay');
            const overlayOpen = ov && !ov.classList.contains('hidden') && ov.style.display !== 'none' && ov.innerHTML.trim();
            bar.style.display = (!e.isIntersecting && !overlayOpen) ? 'flex' : 'none';
          });
          studyMiniObserver.observe(tiles);
        }

        function plannerHubRow(icon,title,sub,onclick){
          return `
            <button onclick="${onclick}" class="stg-card w-full flex items-center text-left" style="gap:12px;padding:13px 16px;margin-bottom:10px;">
              <span class="stg-ico flex items-center justify-center flex-shrink-0">${Icon(icon,'w-5 h-5')}</span>
              <div class="flex-1 min-w-0">
                <div class="stg-title font-semibold" style="font-size:15px;">${title}</div>
                <div class="stg-sub" style="font-size:12px;margin-top:1px;">${sub}</div>
              </div>
              <div class="flex-shrink-0" style="color:#9ca3af;">${Icon('arrowRight','w-4 h-4')}</div>
            </button>`;
        }

        function plannerRow(icon,title,sub,onclick){
          return `
            <div onclick="${onclick}" class="border border-gray-200 rounded-3xl p-4 flex items-center gap-4 mb-3 cursor-pointer">
              <div class="w-12 h-12 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(icon,'w-6 h-6')}</div>
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
              <div class="w-12 h-12 flex items-center justify-center text-gray-600 mb-3">${Icon(icon,'w-6 h-6')}</div>
              <div class="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">${label}</div>
              <div class="text-lg font-bold text-[${NAVY}]">${count}</div>
            </div>`;
        }

        function studySubTab(key){
          studySub = key;
          if (classroomAreaTab === 'courses') { classroomAreaTab = 'classes'; classroomAreaTabSlideDir = 'right'; courseCardMenuOpenId = null; }
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
        function currentPlanName(){
          return 'free';
        }

        function currentPlanFeatures(){
          return { unlimitedPrompts: false, cvAi: false, cvRecommendations: false };
        }

        function currentPlanLimit(category){
          return Infinity;
        }

        function todayDateKey(){
          return new Date().toISOString().slice(0, 10);
        }
        function currentMonthKey(){
          return new Date().toISOString().slice(0, 7);
        }
        // ISO week key (year + week number) so the weekly Stitch Bot cap resets on a consistent
        // Mon-Sun boundary rather than a rolling 7-day window
        function currentWeekKey(){
          const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
          const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
          d.setUTCDate(d.getUTCDate() - dayNum + 3);
          const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
          const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
          return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
        }

        // ---- Stitch Bot prompt usage/rate limiting (daily + weekly + monthly) ----
        const AI_PROMPT_LIMITS = { daily: 30, weekly: 150, monthly: 500 };
        let aiPromptCount = 0;
        let aiPromptDate = null;     // 'YYYY-MM-DD'
        let aiPromptWeekCount = 0;
        let aiPromptWeek = null;     // 'YYYY-Www'
        let aiPromptMonthCount = 0;
        let aiPromptMonth = null;    // 'YYYY-MM'

        function resetAIPromptCountIfNewDay(){
          const today = todayDateKey();
          if (aiPromptDate !== today) { aiPromptDate = today; aiPromptCount = 0; }
          const week = currentWeekKey();
          if (aiPromptWeek !== week) { aiPromptWeek = week; aiPromptWeekCount = 0; }
          const month = currentMonthKey();
          if (aiPromptMonth !== month) { aiPromptMonth = month; aiPromptMonthCount = 0; }
        }
        function hasUnlimitedPrompts(){
          return currentPlanFeatures().unlimitedPrompts;
        }
        // Returns the number of prompts left, taking the *tightest* of the three windows
        function remainingAIPromptsToday(){
          if (hasUnlimitedPrompts()) return Infinity;
          resetAIPromptCountIfNewDay();
          return Math.max(0, Math.min(
            AI_PROMPT_LIMITS.daily - aiPromptCount,
            AI_PROMPT_LIMITS.weekly - aiPromptWeekCount,
            AI_PROMPT_LIMITS.monthly - aiPromptMonthCount
          ));
        }
        // Tells the UI which specific window was hit, so the message can say
        // "daily"/"weekly"/"monthly" instead of a generic "limit reached"
        function aiPromptLimitWindowHit(){
          resetAIPromptCountIfNewDay();
          if (aiPromptCount >= AI_PROMPT_LIMITS.daily) return 'daily';
          if (aiPromptWeekCount >= AI_PROMPT_LIMITS.weekly) return 'weekly';
          if (aiPromptMonthCount >= AI_PROMPT_LIMITS.monthly) return 'monthly';
          return null;
        }
        function canSendAIPrompt(){
          return hasUnlimitedPrompts() || remainingAIPromptsToday() > 0;
        }
        function recordAIPromptUsed(){
          if (hasUnlimitedPrompts()) return;
          resetAIPromptCountIfNewDay();
          aiPromptCount++;
          aiPromptWeekCount++;
          aiPromptMonthCount++;
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

        async function callClaude(systemPrompt, userPrompt, task, images, purpose){
          checkAiRateLimit();
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to use AI features: please log in again.');
            const body = { systemPrompt, userPrompt, task: task || 'chat' };
            if (Array.isArray(images) && images.length) body.images = images;
            if (purpose) body.purpose = purpose;
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
            if (res.status === 429 && data && data.code === 'feature_limit') {
              const limErr = new Error(data.error || 'You have reached your limit.');
              limErr.featureLimit = true;
              if (!data.pro && typeof openProSheet === 'function') openProSheet(data.feature || 'ai_generate');
              throw limErr;
            }
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

        // Career AI (Match with CV / Stitch Bot). Prompts live on the server (ai-proxy), the browser only
        // sends an action name and plain data. Needs a subscription (err.code 'subscription_required').
        async function callCareerAI(action, data){
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
              body: JSON.stringify({ task: 'career', action, data })
            });
            if (res.status === 401) throw new Error('Your session expired, please log in again.');
            let body;
            try { body = await res.json(); } catch { body = null; }
            if (res.status === 402 || (body && body.code === 'subscription_required')) {
              const e = new Error((body && body.error) || 'Your Stitch Bot subscription is not active.');
              e.code = 'subscription_required';
              throw e;
            }
            if (!res.ok) throw new Error((body && body.error) || ('AI request failed (' + res.status + ')'));
            if (body && body.error) throw new Error(body.error);
            return (body && body.text) || '';
          } catch (err) {
            if (err instanceof TypeError && /fetch/i.test(err.message)) {
              err = new Error('Could not reach the AI service: check your connection and try again.');
            }
            if (err.code !== 'subscription_required') window.reportError(err, { call: 'callCareerAI', action });
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
            'About 40% of the questions -- whichever genuinely suit the material, never forced onto material that ' +
            'doesn\'t -- should instead be "type":"written": a typed-answer question with no options. Give each a ' +
            '"kind": ' +
            '"calc" (maths/worked calculation with real numbers and one computable value, e.g. "A sample of n=25 has a mean ' +
            'of 40 and SD of 5. What is the standard error?"; give "workings" = the short steps/formula); ' +
            '"fill" (fill in the blank: the stem contains "______" where one number, term or short phrase belongs, e.g. ' +
            '"The standard error equals the SD divided by the ______ of n."); ' +
            '"define" (a "What is...?" or "Define..." question whose answer is a short definition or term); ' +
            '"explain" (an "In your own words, ...", "How does...", "Why...", or "When is/does..." question answered in 1-2 sentences); ' +
            '"logic" (a short reasoning/logic question where the student must reach a conclusion and justify it). ' +
            'Use a spread of these kinds across the set. Never make a "written" question whose real answer is a long essay. ' +
            'Every "written" question needs "answer" (the ideal answer: the resolved value for calc/fill, a one or two ' +
            'sentence model answer for define/explain/logic) and "keywords" (2-6 strings: the key numbers/units for calc, ' +
            'the missing term and its synonyms for fill, and the essential words/ideas an acceptable define/explain/logic answer ' +
            'must contain) -- this is the marking scheme an AI grader checks the student\'s typed answer against for ' +
            'keywords, workings, sense and meaning. ' +
            'Respond with ONLY raw JSON (no markdown fences, no commentary) matching exactly this schema: ' +
            '{"flashcards":[{"term":"string","def":"string"}],"questions":[{"text":"string","type":"mcq","options":["string","string","string","string"],"correct":0},{"text":"string","type":"written","kind":"calc|fill|define|explain|logic","answer":"string","keywords":["string","string"],"workings":"string (calc only, else omit)"}]}. ' +
            'Produce 6 to 10 flashcards and 6 to 10 questions total, mixing multiple-choice and the written kinds as described above.';
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
              ? { text: q.text, type: 'written', kind: ['calc','fill','define','explain','logic'].indexOf(q.kind) > -1 ? q.kind : undefined, answer: q.answer, keywords: Array.isArray(q.keywords) ? q.keywords : [], workings: typeof q.workings === 'string' ? q.workings : '' }
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
              ? { text: q.text, type: 'written', kind: q.kind, answer: q.answer, keywords: q.keywords || [], workings: q.workings || '' }
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
            studyMiniBarSync();
          }
          refreshUploadSheet();
          if (inLectureCall) refreshClassPadUploadedResources();
        }

        async function processUploadedResource(file){
          const ext = file.name.split('.').pop().toLowerCase();
          if (!['pdf', 'docx', 'pptx'].includes(ext)) {
            pushInAppNotification('Unsupported file', file.name + ': please upload a PDF, DOCX, or PPTX file.');
            return;
          }
          const resource = { id: 'res' + Date.now().toString(36) + (resourceIdCounter++) + Math.random().toString(36).slice(2, 5), name: file.name, ext, status: 'processing', text: '', flashcards: [], questions: [], file, url: URL.createObjectURL(file), storageUrl: null, storageStatus: 'pending' };
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

            // Trim to whatever's left of this month's practice-question/flashcard allowance, and
            // record what actually got used
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
              pushInAppNotification('Monthly limit reached', `${file.name}: saved ${resource.flashcards.length} flashcards and ${resource.questions.length} questions -- you've hit this month's limit (${currentPlanLimit('flashcards')} flashcards, ${currentPlanLimit('questions')} questions). It resets next month.`);
            } else if (usedFallback) {
              pushInAppNotification('Resource saved (backup screening)', file.name + ': AI screening wasn\'t available, so ' + resource.flashcards.length + ' flashcards and ' + resource.questions.length + ' questions were built with backup screening.');
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
          const rowCls = 'flex items-center gap-4 py-4';
          const rowStyle = 'border-bottom:1px solid rgba(10,37,64,0.08);';
          const delBtn = (stop) => `<button onclick="${stop ? 'event.stopPropagation();' : ''}removeUploadedResource('${r.id}')" aria-label="Delete resource" class="flex-shrink-0 p-2 text-red-500">${Icon('trash','w-5 h-5')}</button>`;
          if (r.status === 'processing') {
            return `
              <div class="${rowCls}" style="${rowStyle}">
                <div class="w-10 h-10 flex items-center justify-center text-amber-600 flex-shrink-0">${Icon('file','w-6 h-6')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">${escapeHtml(r.name)}</div>
                  <div class="text-xs text-amber-600">Scanning with Stitch Bot: building flashcards &amp; questions…</div>
                </div>
              </div>`;
          }
          if (r.status === 'error') {
            return `
              <div class="${rowCls}" style="${rowStyle}">
                <div class="w-10 h-10 flex items-center justify-center text-red-500 flex-shrink-0">${Icon('file','w-6 h-6')}</div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm truncate">${escapeHtml(r.name)}</div>
                  <div class="text-xs text-red-500 truncate">${r.error}</div>
                </div>
                ${delBtn(false)}
              </div>`;
          }
          const hasQuestions = r.questions.length > 0;
          const action = hasQuestions ? `openMockTestForResource('${r.id}')` : '';
          return `
            <div ${action ? `onclick="${action}"` : ''} class="${rowCls} ${action ? 'cursor-pointer' : ''}" style="${rowStyle}">
              <div class="w-10 h-10 flex items-center justify-center text-gray-600 flex-shrink-0">${Icon('file','w-6 h-6')}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">${escapeHtml(r.name)}</div>
                <div class="text-xs text-gray-500">${r.flashcards.length} flashcards · ${r.questions.length} practice questions</div>
              </div>
              ${delBtn(true)}
            </div>`;
        }

        let currentDeckKey = null;
        let currentDeck = null;
        let currentCardIndex = 0;
        let cardFlipped = false;

        // ---- Flashcard deck viewer modal ----
        // Card-stack study session: tap to flip, swipe right = "Got it", swipe left = "Again".
        // Ends in a summary with a ring score and a one-tap review of the missed cards.
        const FC_TINTS = ['#dfe5ff', '#ffd9d6', '#e6f5b5', '#d2ecff', '#ebdcff'];
        let fcQueue = [], fcPos = 0, fcKnown = [], fcLearning = [], fcHistory = [];
        let fcDone = false, fcBusy = false, fcStartedAt = 0, fcElapsedMs = 0, fcTimerId = null, fcRound = 1;

        function openFlashDeck(key){
          const deck = key === 'all' ? getAllResourcesDeck() : flashDecks[key];
          if (!deck || !deck.cards || !deck.cards.length) {
            pushInAppNotification('No flashcards yet', "This deck doesn't have any cards yet.");
            return;
          }
          currentDeckKey = key;
          currentDeck = deck;
          fcStartedAt = Date.now();
          fcRound = 1;
          fcStartRound(deck.cards.slice());
          document.getElementById('flashModal').classList.remove('hidden');
          renderFlashModal();
          fcStartTimer();
          document.addEventListener('keydown', fcKey);
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeFlashModal(fromPopState));
        }

        function closeFlashModal(fromPopState){
          fcStopTimer();
          document.removeEventListener('keydown', fcKey);
          document.getElementById('flashModal').classList.add('hidden');
          document.getElementById('flashModalContent').innerHTML = '';
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }

        function fcStartRound(cards){
          fcQueue = cards;
          fcPos = 0;
          fcKnown = [];
          fcLearning = [];
          fcHistory = [];
          fcDone = false;
          fcBusy = false;
          currentCardIndex = 0;
          cardFlipped = false;
        }

        function fcFmtTime(ms){
          const t = Math.max(0, Math.floor(ms / 1000));
          const m = Math.floor(t / 60), sec = t % 60;
          return m + ':' + (sec < 10 ? '0' : '') + sec;
        }
        function fcStartTimer(){
          fcStopTimer();
          fcTimerId = setInterval(() => {
            const el = document.getElementById('fcTimer');
            if (el) el.textContent = fcFmtTime(Date.now() - fcStartedAt);
          }, 1000);
        }
        function fcStopTimer(){
          if (fcTimerId) { clearInterval(fcTimerId); fcTimerId = null; }
        }
        function fcBuzz(ms){
          try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) {}
        }

        const FC_ICONS = {
          back: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
          smile: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.2c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2"/><path d="M9 9.6h.01M15 9.6h.01" stroke-width="2.8"/></svg>',
          frown: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 16.2c.9-1.3 2.1-2 3.5-2s2.6.7 3.5 2"/><path d="M9 9.6h.01M15 9.6h.01" stroke-width="2.8"/></svg>',
          undo: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>',
          shuffle: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
          x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
          check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
          flip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0115.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>'
        };

        function fcTextSize(t){
          const n = (t || '').length;
          return n > 150 ? 'fc-t-sm' : (n > 62 ? 'fc-t-md' : 'fc-t-lg');
        }

        // PDF/slide extraction leaves private-use glyphs (bullets, icons), replacement chars and
        // zero-width marks in the text; they render as empty boxes, so drop them for display
        function fcCleanText(t){
          return String(t || '')
            .replace(/[\uE000-\uF8FF\uFFFC\uFFFD\uFFF0-\uFFFF\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF]/g, ' ')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .trim();
        }

        function fcFaceHTML(card, side, idx){
          const isFront = side === 'front';
          const text = fcCleanText(isFront ? card.term : card.def);
          const source = card.source ? escapeHtml(card.source) : '';
          return `
            <div class="fc-face ${isFront ? 'fc-face-front' : 'fc-face-back'}" ${isFront ? `style="--fc-tint:${FC_TINTS[idx % FC_TINTS.length]};"` : ''}>
              <div class="fc-face-top">
                <span class="fc-chip">${isFront ? 'Term' : 'Definition'}</span>
                ${source ? `<span class="fc-source">${source}</span>` : ''}
              </div>
              <div class="fc-face-body">
                <div class="fc-text ${fcTextSize(text)} ${isFront ? 'font-display' : ''}">${escapeHtml(text)}</div>
              </div>
              <div class="fc-face-foot">${isFront ? 'Tap to reveal' : 'Swipe it away when you are ready'}</div>
            </div>`;
        }

        function renderFlashModal(){
          if (fcDone) { fcRenderSummary(); return; }
          const total = fcQueue.length;
          const card = fcQueue[fcPos];
          const idx = fcPos;
          const pct = Math.round((fcPos / total) * 100);
          const ghosts = [2, 1].map(i => {
            if (fcPos + i >= total) return '';
            return `<div class="fc-ghost fc-ghost-${i}" style="background:${FC_TINTS[(idx + i) % FC_TINTS.length]};"></div>`;
          }).join('');
          const upNext = fcQueue.slice(fcPos + 1, fcPos + 5).map(c => {
            const t = fcCleanText(c.term);
            return `<div class="fc-up"><i></i><span>${escapeHtml(t.length > 44 ? t.slice(0, 42) + '…' : t)}</span></div>`;
          }).join('');
          document.getElementById('flashModalContent').innerHTML = `
            <div class="fc-head" style="padding-top:var(--top-safe-pad);">
              <button onclick="closeFlashModal()" class="fc-round-btn" aria-label="Back">${FC_ICONS.back}</button>
              <div class="fc-head-mid">
                <div class="fc-head-title">${currentDeckKey === 'all' ? 'All resources' : escapeHtml((currentDeck && currentDeck.name) || 'Flashcards')}${fcRound > 1 ? ' · review' : ''}</div>
                <div class="fc-head-sub"><span id="fcTimer">${fcFmtTime(Date.now() - fcStartedAt)}</span></div>
              </div>
              <button onclick="fcEnd()" class="fc-end-btn">End</button>
            </div>
            <div class="fc-progress-wrap">
              <div class="fc-progress"><div class="fc-progress-fill" style="width:${pct}%;"></div></div>
              <div class="fc-progress-count">${fcPos + 1} / ${total}</div>
            </div>
            <div class="fc-body"><div class="fc-main">
            <div class="fc-stage">
              <div class="fc-stack">
                ${ghosts}
                <div id="fcCard" class="fc-card" style="touch-action:none;-webkit-user-select:none;user-select:none;">
                  <div id="fcFlipper" class="fc-flipper ${cardFlipped ? 'is-flipped' : ''}">
                    ${fcFaceHTML(card, 'front', idx)}
                    ${fcFaceHTML(card, 'back', idx)}
                  </div>
                  <div class="fc-stamp fc-stamp-yes">Got it</div>
                  <div class="fc-stamp fc-stamp-no">Again</div>
                </div>
              </div>
            </div>
            <div class="fc-tools">
              <button onclick="prevStudyCard()" class="fc-tool-btn" ${fcHistory.length ? '' : 'disabled'} aria-label="Undo last card">${FC_ICONS.undo}<span>Undo</span></button>
              <div class="fc-tally"><span class="fc-tally-no">${fcLearning.length}</span><span class="fc-tally-sep"></span><span class="fc-tally-yes">${fcKnown.length}</span></div>
              <button onclick="shuffleStudyDeck()" class="fc-tool-btn" aria-label="Shuffle remaining cards">${FC_ICONS.shuffle}<span>Shuffle</span></button>
            </div>
            <div class="fc-actions" style="padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));">
              <button onclick="fcMark(false)" class="fc-act fc-act-no" aria-label="Still learning">${FC_ICONS.x}<span class="fc-act-lbl">Again</span></button>
              <button onclick="flipStudyCard()" class="fc-act fc-act-flip">${FC_ICONS.flip}<span id="fcFlipLabel">${cardFlipped ? 'Show term' : 'Show answer'}</span></button>
              <button onclick="fcMark(true)" class="fc-act fc-act-yes" aria-label="Got it">${FC_ICONS.check}<span class="fc-act-lbl">Got it</span></button>
            </div></div>
            <aside class="fc-side">
              <div class="fc-panel"><div class="fc-panel-h">This session</div>
                <div class="fc-side-tally"><div class="fc-st fc-st-no"><b>${fcLearning.length}</b><span>Learning</span></div><div class="fc-st fc-st-yes"><b>${fcKnown.length}</b><span>Known</span></div></div></div>
              ${upNext ? `<div class="fc-panel"><div class="fc-panel-h">Up next</div>${upNext}</div>` : ''}
              <div class="fc-side-tools">
                <button onclick="prevStudyCard()" class="fc-side-btn" ${fcHistory.length ? '' : 'disabled'}>${FC_ICONS.undo}<span>Undo</span></button>
                <button onclick="shuffleStudyDeck()" class="fc-side-btn">${FC_ICONS.shuffle}<span>Shuffle</span></button>
              </div>
            </aside></div>`;
          fcBindDrag();
        }

        // Swipe handling. The card owns every touch (touch-action:none) so the browser can't steal a
        // diagonal swipe as a scroll. Long text in a card scrolls by hand on a mostly vertical move.
        function fcBindDrag(){
          const el = document.getElementById('fcCard');
          if (!el) return;
          let id = null, sx = 0, sy = 0, lx = 0, ly = 0, dx = 0, t0 = 0, vx = 0, lt = 0;
          let moved = false, axis = null, body = null;
          const reset = () => {
            ['--fc-x','--fc-r','--fc-yes','--fc-no'].forEach(k => el.style.removeProperty(k));
          };
          const faceBody = () => {
            const flipped = !!(document.getElementById('fcFlipper') || {}).classList && document.getElementById('fcFlipper').classList.contains('is-flipped');
            return el.querySelector(flipped ? '.fc-face-back .fc-face-body' : '.fc-face-front .fc-face-body');
          };
          el.onpointerdown = e => {
            if (fcBusy || id !== null) return;
            id = e.pointerId; sx = lx = e.clientX; sy = ly = e.clientY; dx = 0; vx = 0;
            t0 = lt = performance.now(); moved = false; axis = null; body = faceBody();
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
          };
          el.onpointermove = e => {
            if (e.pointerId !== id) return;
            const now = performance.now();
            const tx = e.clientX - sx, ty = e.clientY - sy;
            if (!axis) {
              if (Math.abs(tx) < 8 && Math.abs(ty) < 8) return;
              // Horizontal unless clearly vertical, so loose swipes still count
              axis = Math.abs(ty) > Math.abs(tx) * 1.6 && body && body.scrollHeight > body.clientHeight + 2 ? 'y' : 'x';
              moved = true;
              if (axis === 'x') el.classList.add('fc-dragging');
            }
            if (axis === 'y') {
              body.scrollTop -= (e.clientY - ly);
              ly = e.clientY; lx = e.clientX; lt = now;
              return;
            }
            dx = tx;
            if (now > lt) vx = (e.clientX - lx) / (now - lt);
            lx = e.clientX; ly = e.clientY; lt = now;
            const p = Math.min(1, Math.abs(dx) / 90);
            el.style.setProperty('--fc-x', dx + 'px');
            el.style.setProperty('--fc-r', (dx / 16) + 'deg');
            el.style.setProperty('--fc-yes', dx > 0 ? p : 0);
            el.style.setProperty('--fc-no', dx < 0 ? p : 0);
          };
          const finish = cancelled => {
            if (id === null) return;
            try { el.releasePointerCapture(id); } catch (err) {}
            id = null;
            el.classList.remove('fc-dragging');
            if (cancelled) { reset(); return; }
            if (!moved) { if (performance.now() - t0 < 600) flipStudyCard(); return; }
            if (axis === 'y') return;
            // Distance OR a quick flick commits the swipe
            const flick = Math.abs(vx) > 0.45 && Math.abs(dx) > 30;
            if (Math.abs(dx) > 70 || flick) fcMark(dx > 0); else reset();
          };
          el.onpointerup = () => finish(false);
          el.onpointercancel = () => finish(true);
          el.onlostpointercapture = () => { if (id !== null) finish(false); };
        }

        function flipStudyCard(){
          if (fcDone || fcBusy) return;
          const fl = document.getElementById('fcFlipper');
          if (!fl) { cardFlipped = !cardFlipped; renderFlashModal(); return; }
          cardFlipped = !cardFlipped;
          fl.classList.toggle('is-flipped', cardFlipped);
          const lbl = document.getElementById('fcFlipLabel');
          if (lbl) lbl.textContent = cardFlipped ? 'Show term' : 'Show answer';
          fcBuzz(8);
        }

        function fcMark(known){
          if (fcDone || fcBusy) return;
          const card = fcQueue[fcPos];
          if (!card) return;
          fcBusy = true;
          (known ? fcKnown : fcLearning).push(card);
          fcHistory.push({ card, known });
          const el = document.getElementById('fcCard');
          if (el) {
            el.style.setProperty(known ? '--fc-yes' : '--fc-no', 1);
            el.classList.add(known ? 'fc-out-right' : 'fc-out-left');
          }
          fcBuzz(known ? 12 : [8, 30, 8]);
          setTimeout(() => {
            fcPos++;
            currentCardIndex = fcPos;
            cardFlipped = false;
            fcBusy = false;
            if (fcPos >= fcQueue.length) fcFinish(true); else renderFlashModal();
          }, 240);
        }

        function fcFinish(completed){
          fcDone = true;
          fcElapsedMs = Date.now() - fcStartedAt;
          fcStopTimer();
          if (completed && currentDeckKey === 'all') flashcardsCompleted = true;
          renderFlashModal();
        }

        function fcEnd(){
          if (fcDone) { closeFlashModal(); return; }
          fcFinish(false);
        }

        function fcRenderSummary(){
          const seen = fcKnown.length + fcLearning.length;
          const total = fcQueue.length;
          const pct = seen ? Math.round((fcKnown.length / seen) * 100) : 0;
          const left = Math.max(0, total - seen);
          const C = 2 * Math.PI * 54;
          const title = pct >= 90 ? 'Flawless run' : (pct >= 60 ? 'Solid session' : (seen ? 'Good start, go again' : 'Nothing studied yet'));
          document.getElementById('flashModalContent').innerHTML = `
            <div class="fc-head" style="padding-top:var(--top-safe-pad);">
              <button onclick="closeFlashModal()" class="fc-round-btn" aria-label="Close">${FC_ICONS.back}</button>
              <div class="fc-head-mid"><div class="fc-head-title">Session complete</div><div class="fc-head-sub">${fcFmtTime(fcElapsedMs)}</div></div>
              <span style="width:64px;"></span>
            </div>
            <div class="fc-summary">
              <div class="fc-ring">
                <svg viewBox="0 0 128 128" width="176" height="176">
                  <circle cx="64" cy="64" r="54" fill="none" stroke="rgba(30,144,255,0.14)" stroke-width="12"/>
                  <circle id="fcRingArc" cx="64" cy="64" r="54" fill="none" stroke="url(#fcRingGrad)" stroke-width="12" stroke-linecap="round" transform="rotate(-90 64 64)" stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
                  <defs><linearGradient id="fcRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4169e1"/><stop offset="1" stop-color="#1e90ff"/></linearGradient></defs>
                </svg>
                <div class="fc-ring-label"><div class="fc-ring-pct font-display">${pct}%</div><div class="fc-ring-sub">got it</div></div>
              </div>
              <div class="fc-summary-title font-display">${title}</div>
              <div class="fc-summary-chips">
                <div class="fc-sum-chip fc-sum-yes"><b>${fcKnown.length}</b><span>Got it</span></div>
                <div class="fc-sum-chip fc-sum-no"><b>${fcLearning.length}</b><span>Again</span></div>
                <div class="fc-sum-chip fc-sum-left"><b>${left}</b><span>Left</span></div>
              </div>
            </div>
            <div class="fc-summary-actions" style="padding-bottom:calc(20px + env(safe-area-inset-bottom,0px));">
              ${fcLearning.length ? `<button onclick="fcReviewMissed()" class="fc-cta">Review ${fcLearning.length} missed card${fcLearning.length === 1 ? '' : 's'}</button>` : ''}
              <button onclick="fcRestart()" class="fc-ghost-cta">Restart deck</button>
              <button onclick="closeFlashModal()" class="fc-text-cta">Done</button>
            </div>`;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const arc = document.getElementById('fcRingArc');
            if (arc) arc.style.strokeDashoffset = String(C * (1 - pct / 100));
          }));
        }

        function fcReviewMissed(){
          if (!fcLearning.length) return;
          fcRound++;
          fcStartRound(fcLearning.slice());
          fcStartedAt = Date.now() - fcElapsedMs;
          renderFlashModal();
          fcStartTimer();
        }

        function fcRestart(){
          fcRound = 1;
          fcStartedAt = Date.now();
          fcStartRound(currentDeck.cards.slice());
          renderFlashModal();
          fcStartTimer();
        }

        function fcKey(e){
          const m = document.getElementById('flashModal');
          if (!m || m.classList.contains('hidden') || fcDone) return;
          const onBtn = e.target && e.target.tagName === 'BUTTON';
          if (e.key === 'ArrowRight') { fcMark(true); e.preventDefault(); }
          else if (e.key === 'ArrowLeft') { fcMark(false); e.preventDefault(); }
          else if (e.key === '2') { fcMark(true); e.preventDefault(); }
          else if (e.key === '1') { fcMark(false); e.preventDefault(); }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || ((e.key === ' ' || e.key === 'Enter') && !onBtn)) { flipStudyCard(); e.preventDefault(); }
        }

        // Kept for any older callers: "next" now means "got it", "prev" undoes the last card.
        function nextStudyCard(){ fcMark(true); }

        function prevStudyCard(){
          if (fcBusy || !fcHistory.length) return;
          const last = fcHistory.pop();
          const arr = last.known ? fcKnown : fcLearning;
          const i = arr.lastIndexOf(last.card);
          if (i > -1) arr.splice(i, 1);
          fcPos = Math.max(0, fcPos - 1);
          currentCardIndex = fcPos;
          cardFlipped = false;
          fcDone = false;
          renderFlashModal();
        }

        function shuffleStudyDeck(){
          if (fcBusy || fcDone) return;
          const rest = fcQueue.slice(fcPos);
          for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
          }
          fcQueue = fcQueue.slice(0, fcPos).concat(rest);
          cardFlipped = false;
          renderFlashModal();
          const st = document.querySelector('.fc-stack');
          if (st) { st.classList.add('fc-shuffling'); setTimeout(() => st.classList.remove('fc-shuffling'), 420); }
          fcBuzz(10);
        }


        // =====================================================================
        // Stitch Pro: Free / Daily / Monthly / Yearly plans for Practice and Challenge Arena.
        // The real limits live on the server (table feature_limits, functions feature_take / feature_status,
        // the ai-proxy function and a database trigger on challenge_invites). The numbers below are for display only.
        // Keep prices in sync with PRO_PLANS in the paystack-verify and paystack-webhook functions.
        // =====================================================================
        const PRO_PLANS = {
          daily:   { id: 'daily',   label: 'Daily',   price: 12,  unit: 'day'   },
          monthly: { id: 'monthly', label: 'Monthly', price: 40,  unit: 'month' },
          yearly:  { id: 'yearly',  label: 'Yearly',  price: 399, unit: 'year'  }
        };
        const PRO_FEATURES = [
          { key: 'mock_test',   label: 'Mock tests',                    per: 'week',  free: 3, pro: 30 },
          { key: 'ai_grade',    label: 'AI-marked written answers',     per: 'week',  free: 3, pro: 30 },
          { key: 'arena',       label: 'Challenge Arena games',         per: 'week',  free: 2, pro: 20 },
          { key: 'ai_generate', label: 'Uploads turned into questions', per: 'month', free: 3, pro: 30 }
        ];
        let proState = { loaded: false, pro: false, plan: null, expiresAt: null, cancelled: false, startedAt: null, features: {} };
        let proView = 'auto'; // 'auto' (manage when active, plans otherwise) | 'plans' | 'cancel'
        let proPlanChoice = 'yearly';
        let proPayBusy = false;

        async function refreshProStatus(){
          try {
            const sb = getSupabaseClient();
            if (!sb) return proState;
            const { data, error } = await sb.rpc('feature_status');
            if (error || !data) return proState;
            proState = { loaded: true, pro: !!data.pro, plan: data.plan || null, expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null, cancelled: !!data.cancelled, startedAt: data.startedAt ? new Date(data.startedAt).getTime() : null, features: data.features || {} };
          } catch (e) { /* keep last known state */ }
          return proState;
        }
        function isProActive(){ return !!(proState.pro && proState.expiresAt && proState.expiresAt > Date.now()); }

        // Asks the server for one use of a limited feature. true = go ahead. false = limit reached (the plans sheet opens).
        async function gateFeature(feature){
          try {
            const sb = getSupabaseClient();
            if (!sb) return true;
            const { data, error } = await sb.rpc('feature_take', { p_feature: feature });
            if (error) { console.warn('feature gate unavailable:', error.message); return true; } // no AI cost here, so never block on a network hiccup
            if (data && data.ok === true) return true;
            if (data && data.reason === 'daily') { openAppAlertModal('You have reached today\'s limit for this. It resets tomorrow.', 'Daily limit'); return false; }
            if (data && data.pro) { openAppAlertModal('You have used all of this ' + (data.period === 'month' ? 'month' : 'week') + '\'s allowance. It resets soon.', 'Limit reached'); return false; }
            openProSheet(feature);
            return false;
          } catch (e) { return true; }
        }

        function proPlanDateLabel(ms){
          try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; }
        }
        function proManageHTML(){
          const plan = PRO_PLANS[proState.plan] || PRO_PLANS.monthly;
          const row = (label, value) => `<div class="flex items-center justify-between py-2.5" style="border-top:1px solid rgba(128,128,128,0.15);"><span class="text-sm text-gray-500">${label}</span><span class="text-sm font-semibold text-gray-800 text-right">${value}</span></div>`;
          const end = escapeHtml(proPlanDateLabel(proState.expiresAt));
          const usage = PRO_FEATURES.map(f => { const u = proState.features && proState.features[f.key]; return u ? row(escapeHtml(f.label), u.used + ' of ' + u.limit + ' this ' + (u.period === 'month' ? 'month' : 'week')) : ''; }).join('');
          return `
            <div class="pro3-head"><button type="button" onclick="closeCareerSubscribeSheet()" class="pro3-back" aria-label="Back"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button><span class="pro3-title">Your subscription</span></div>
            <div class="pro3-sub">${proState.cancelled ? 'Cancelled. You keep Stitch Pro until ' + end + '.' : 'Stitch Pro is active.'}</div>
            <div class="mb-3">
              ${row('Plan', escapeHtml(plan.label) + ' · GH₵' + plan.price + ' per ' + plan.unit)}
              ${proState.startedAt ? row('Last paid', escapeHtml(proPlanDateLabel(proState.startedAt))) : ''}
              ${row(proState.cancelled ? 'Ends on' : 'Access until', end)}
              ${row('Status', proState.cancelled ? 'Cancelled' : 'Active')}
            </div>
            <div class="text-xs text-gray-400 mb-3">Stitch Pro does not renew by itself, so you are never charged again unless you pay again. You can cancel at any time and keep access until the date above.</div>
            <div class="mb-4">${usage}</div>
            <div class="pro3-bar">
              ${proState.cancelled
                ? `<button onclick="closeCareerSubscribeSheet()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Close</button><button onclick="proShowPlans()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Subscribe again</button>`
                : `<button onclick="proShowCancel()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Cancel</button><button onclick="proShowPlans()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Extend</button>`}
            </div>`;
        }
        function proCancelHTML(){
          const end = escapeHtml(proPlanDateLabel(proState.expiresAt));
          return `
            <div class="pro3-scrim" onclick="proShowManage()"></div>
            <div class="pro3-sheet" role="dialog" aria-modal="true">
              <div class="pro3-grab"></div>
              <div class="pro3-sheet-title">Cancel Stitch Pro?</div>
              <div class="pro3-sheet-text">You keep every Pro benefit until ${end}. After that your account goes back to the free plan. You can subscribe again whenever you like.</div>
              <div class="flex gap-3">
                <button onclick="proShowManage()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Keep Pro</button>
                <button id="pro-cancel-btn" onclick="confirmProCancel()" class="sheet-pill flex-1 py-3 rounded-2xl text-sm">Cancel it</button>
              </div>
            </div>`;
        }
        function proRender(){
          const box = document.getElementById('careerSubscribeModalContent');
          const modal = document.getElementById('careerSubscribeModal');
          if (box && modal && !modal.classList.contains('hidden')) box.innerHTML = proSheetHTML(window.__proSheetReason || '');
        }
        function proShowPlans(){ proView = 'plans'; proRender(); }
        function proShowCancel(){ proView = 'cancel'; proRender(); }
        function proShowManage(){ proView = 'auto'; proRender(); }
        async function confirmProCancel(){
          const btn = document.getElementById('pro-cancel-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
          try {
            const sb = getSupabaseClient();
            const { data, error } = await sb.rpc('cancel_pro');
            if (error || data !== true) throw new Error((error && error.message) || 'Could not cancel right now.');
            await refreshProStatus();
            proView = 'auto';
            proRender();
            openAppAlertModal('Cancelled. You keep Stitch Pro until ' + proPlanDateLabel(proState.expiresAt) + '.', 'Subscription cancelled');
            if (typeof stgRefreshProRow === 'function') stgRefreshProRow();
          } catch (err) {
            if (btn) { btn.disabled = false; btn.style.opacity = ''; }
            openAppAlertModal('Could not cancel right now. Please try again.', 'Not cancelled');
          }
        }
        function proSheetHTML(reason){
          const head = (typeof overlayHeader === 'function') ? `<div class="-mx-5" style="margin-left:-20px;margin-right:-20px;">${overlayHeader('Stitch Pro', 'var(--top-safe-pad)', 'closeCareerSubscribeSheet()')}</div>` : '';
          let body;
          if (isProActive() && proView !== 'plans') return `<div class="pro-page-body pro3">${proManageHTML()}${proView === 'cancel' ? proCancelHTML() : ''}</div>`;
          return `<div class="pro-page-body pro2">${proPlansHTML(reason)}</div>`;
        }
        function proPlansHTML(reason){
          const active = isProActive();
          const why = {
            mock_test: 'You have used this week\'s free mock tests.',
            ai_grade: 'You have used this week\'s free AI marking.',
            arena: 'You have used this week\'s free Challenge Arena games.',
            ai_generate: 'You have used this month\'s free upload-to-question sets.'
          }[reason] || '';
          const PI = {
            mock_test: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6M9 16h3"/>',
            ai_grade: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>',
            arena: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
            ai_generate: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>'
          };
          const rows = PRO_FEATURES.map(f => {
            const u = proState.features && proState.features[f.key];
            const used = u ? (u.used + ' of ' + f.free + ' used') : ('Free: ' + f.free + ' a ' + f.per);
            return `<div class="pro2-row">
              <span class="pro2-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PI[f.key] || ''}</svg></span>
              <div class="pro2-rm"><div class="pro2-rn">${f.label}</div><div class="pro2-rs">${u ? 'Free: ' + f.free + ' a ' + f.per + ' (' + used + ')' : used}</div></div>
              <span class="pro2-pill">${f.pro} a ${f.per}</span>
            </div>`;
          }).join('');
          const chosen = PRO_PLANS[proPlanChoice] || PRO_PLANS.yearly;
          const notes = { daily: '24 hours of Pro. No auto-renew.', monthly: 'Pay month by month. Cancel any time.', yearly: 'About GH\u20b5' + Math.round(PRO_PLANS.yearly.price / 12) + ' a month. Billed once a year.' };
          const seg = ['daily', 'monthly', 'yearly'].map(id => `<button type="button" onclick="setProPlan('${id}')" class="${proPlanChoice === id ? 'on' : ''}">${PRO_PLANS[id].label}</button>`).join('');
          return `
            <div class="pro2-hero">
              <button type="button" onclick="closeCareerSubscribeSheet()" class="pro2-back" aria-label="Back"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>
              <div class="pro2-h1">${active ? 'Extend your plan' : 'Go further with Pro'}</div>
              <div class="pro2-sub">${active ? 'Your plan is active until ' + escapeHtml(proPlanDateLabel(proState.expiresAt)) + '.' : (why ? why + ' Pro gives you about ten times more.' : 'About ten times more Practice and Challenge Arena.')}</div>
              <div class="pro2-seg">${seg}</div>
              <div class="pro2-price">GH\u20b5${chosen.price}<small> / ${chosen.unit}</small></div>
              <div class="pro2-note">${notes[chosen.id] || ''}</div>
            </div>
            <div class="pro2-list">
              <div class="pro2-lh"><span>What Pro unlocks</span><span>Pro limit</span></div>
              ${rows}
              <div class="pro2-free">Stitch Bot, flashcards and everything else stay free. Pro also has a daily safety limit so no one burns through a month in one day.</div>
            </div>
            <div class="pro2-cta">
              <button id="pro-pay-btn" type="button" onclick="startProPayment()" class="pro2-go">Continue with ${chosen.label}</button>
              <button type="button" onclick="closeCareerSubscribeSheet()" class="pro2-nn">Not now</button>
            </div>`;
        }
        function setProPlan(id){
          if (!PRO_PLANS[id] || proPayBusy) return;
          proPlanChoice = id;
          const box = document.getElementById('careerSubscribeModalContent');
          proRender();
        }
        async function openProSheet(reason){
          window.__proSheetReason = reason || '';
          proView = 'auto';
          const modal = document.getElementById('careerSubscribeModal');
          const box = document.getElementById('careerSubscribeModalContent');
          if (!modal || !box) return;
          box.innerHTML = proSheetHTML(reason);
          const wasHidden = modal.classList.contains('hidden');
          modal.classList.add('pro-page');
          modal.classList.remove('hidden');
          try { modal.scrollTop = 0; box.parentElement.scrollTop = 0; } catch (e) {}
          if (wasHidden && typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeCareerSubscribeSheet(fromPopState));
          // fill in the live usage numbers once they arrive
          refreshProStatus().then(() => proRender());
        }
        async function startProPayment(){
          if (proPayBusy) return;
          const plan = PRO_PLANS[proPlanChoice];
          if (!plan) return;
          const payEmail = String((typeof currentUserEmail !== 'undefined' && currentUserEmail) || '').trim();
          if (!payEmail) { openAppAlertModal('Please sign in again to pay.', 'Payment unavailable'); return; }
          proPayBusy = true;
          try { await loadPaystackScript(); } catch (err) {
            proPayBusy = false;
            openAppAlertModal('Could not load the payment popup. Check your connection and try again.', 'Payment unavailable');
            return;
          }
          closeCareerSubscribeSheet();
          function closeProPopup(fromPopState){ teardownPaystackPopup(fromPopState); proPayBusy = false; }
          const reference = 'stitchpro_' + plan.id + '_' + Date.now();
          const handler = window.PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: payEmail,
            amount: plan.price * 100,
            currency: 'GHS',
            ref: reference,
            metadata: { type: 'pro_subscription', plan: plan.id, user_id: (typeof currentUserId !== 'undefined' && currentUserId) || '' },
            callback: function(response){
              popModalBackHandler(false);
              verifyProPayment(plan, response.reference);
            },
            onClose: function(){ closeProPopup(false); }
          });
          pushModalBackHandler(closeProPopup);
          handler.openIframe();
        }
        async function verifyProPayment(plan, reference){
          try {
            const accessToken = await getAuthAccessToken();
            if (!accessToken) throw new Error('You need to be signed in to complete payment: please log in again.');
            const res = await fetch(`https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/paystack-verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken, 'apikey': SUPABASE_ANON_KEY },
              body: JSON.stringify({ reference })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Payment verification failed (' + res.status + ')');
            if (!data.verified) throw new Error('We could not confirm this payment. If you were charged, contact support with reference ' + reference + '.');
            proPayBusy = false;
            await refreshProStatus();
            proView = 'auto';
            openAppAlertModal('Stitch Pro is active until ' + proPlanDateLabel(proState.expiresAt) + '.', 'Payment confirmed');
            if (typeof stgRefreshProRow === 'function') stgRefreshProRow();
          } catch (err) {
            proPayBusy = false;
            window.reportError && window.reportError(err, { call: 'verifyProPayment', plan: plan.id });
            openAppAlertModal(err.message || 'Payment verification failed. Please try again.', 'Payment not confirmed');
          }
        }
