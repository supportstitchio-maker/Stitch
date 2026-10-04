const challengeTimeOptions = ['No limit','15 sec','30 sec','45 sec','60 sec'];
        let challengeConfig = { timePerQ: 'No limit' };

        const CHALLENGE_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        // ---- Challenge creation + invite/join flow ----
        function generateChallengeCode(){
          let code = '';
          for (let i = 0; i < 8; i++) {
            if (i === 4) code += '-';
            code += CHALLENGE_CODE_CHARS.charAt(Math.floor(Math.random() * CHALLENGE_CODE_CHARS.length));
          }
          return code;
        }

        function buildChallengeInviteLink(code){
          return window.location.origin + window.location.pathname + '?joinChallenge=' + encodeURIComponent(code);
        }

        function copyChallengeLink(code){
          const link = buildChallengeInviteLink(code);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).catch(() => {});
          }
          pushInAppNotification('Link copied', 'Invite link copied to your clipboard.');
        }

        function shareChallengeLink(code){
          const link = buildChallengeInviteLink(code);
          if (navigator.share) {
            navigator.share({ title: 'Join my Stitch challenge', text: 'Join my challenge on Stitch -- tap the link to jump straight in:', url: link }).catch(() => {});
          } else {
            copyChallengeLink(code);
          }
        }

        // Header row for the pages inside the challenge sheet: same look as overlayHeader's
        // right-aligned variant (gradient back arrow on the left, gradient display title on the right)
        function challengeSheetHeader(title, backAction){
          return `
            <div class="flex items-center justify-between gap-4 mb-4">
              <button onclick="${backAction || 'closeChallengeModal()'}" class="flex items-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <div class="font-semibold text-lg font-display grad-text text-right" style="min-width:0;">${title}</div>
            </div>`;
        }

        function openChallengeModal(html){
          const modal = document.getElementById('challengeModal');
          const wasHidden = modal.classList.contains('hidden');
          document.getElementById('challengeModalContent').innerHTML = html;
          modal.classList.remove('hidden');
          if (wasHidden && typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeChallengeModal(fromPopState));
        }

        function closeChallengeModal(fromPopState){
          const modal = document.getElementById('challengeModal');
          modal.classList.add('hidden');
          document.getElementById('challengeModalContent').innerHTML = '';
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }

        function dismissChallengeModalForExam(){
          const modal = document.getElementById('challengeModal');
          modal.classList.add('hidden');
          document.getElementById('challengeModalContent').innerHTML = '';
          if (typeof popModalBackHandler === 'function') popModalBackHandler(true);
        }

        function openChallengeSetupModal(){
          if (!courseBank.length) {
            openChallengeModal(challengeEmptyStateHTML());
            return;
          }
          openChallengeModal(challengeSetupHTML());
        }

        function challengeEmptyStateHTML(){
          return `
            <div class="py-10 text-center text-gray-400 text-base px-2">
              <div class="font-semibold text-gray-500 mb-1">Upload materials to unlock this quiz</div>
              <div class="text-sm mb-5">Add a PDF, DOCX, or PPTX under Resources and we'll build a question set from it automatically.</div>
              <button onclick="closeChallengeModal()" class="tab-plain-btn w-full py-3.5 font-bold text-center" style="color:${NAVY};">Close</button>
            </div>`;
        }

        function challengeSetupHTML(){
          return `
            ${challengeSheetHeader('Set Up a Challenge')}
            <div class="text-sm text-gray-500 mb-5">Pulls questions from all your uploaded resources. Pick a time limit, then share the code with your class.</div>

            <label class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Time / Question</label>
            <select id="challenge-time-input" class="w-full rounded-2xl px-4 py-3 text-base font-semibold text-gray-800 mb-5" style="background:rgba(65,105,225,0.12); border:1px solid rgba(65,105,225,0.25);">
              ${challengeTimeOptions.map(t => `<option ${t === challengeConfig.timePerQ ? 'selected' : ''}>${t}</option>`).join('')}
            </select>

            <div class="flex gap-3">
              <button onclick="closeChallengeModal()" class="tab-plain-btn flex-1 py-3.5 font-bold text-gray-700 text-center">Cancel</button>
              <button onclick="submitCreateChallenge()" class="tab-plain-btn flex-1 py-3.5 font-bold text-center" style="color:${NAVY};">Create</button>
            </div>`;
        }

        function submitCreateChallenge(){
          challengeConfig.timePerQ = document.getElementById('challenge-time-input').value;
          const code = generateChallengeCode();
          openChallengeModal(challengeCreatedHTML(code));
        }

        function challengeCreatedHTML(code){
          return `
            ${challengeSheetHeader('Challenge created!')}
            <div class="text-sm text-gray-500 mb-5">Share this code with whoever you want to challenge, then start whenever you're ready.</div>
            <div class="rounded-2xl flex items-center justify-center gap-2 font-bold text-2xl tracking-wide mb-5" style="padding-top:7px;padding-bottom:7px;background:rgba(65,105,225,0.12); color:${NAVY};">
              <span>${code}</span>
              <button onclick="copyChallengeCode('${code}')" class="flex-shrink-0 p-1.5 rounded-full" style="color:${NAVY};background:rgba(65,105,225,0.14);">${Icon('copy','w-4 h-4')}</button>
            </div>
            <button onclick="startChallengeNow()" class="w-full rounded-2xl font-bold text-center" style="padding-top:5px;padding-bottom:5px;background:rgba(65,105,225,0.12); color:${NAVY};">Start Challenge Now</button>`;
        }

        let pendingChallengeInvites = {};
        const CHALLENGE_INVITES_TABLE = 'challenge_invites';

        async function insertChallengeInviteRemote(code, subject, timePerQ, questions){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(CHALLENGE_INVITES_TABLE).insert({ code, subject, time_per_q: timePerQ, questions, joined: false });
            if (error) { console.warn('Challenge invite create failed:', error.message); return false; }
            return true;
          } catch (err) {
            console.warn('Challenge invite create failed:', err);
            return false;
          }
        }

        async function fetchChallengeInviteRemote(code){
          const sb = getSupabaseClient();
          if (!sb) return null;
          try {
            const { data, error } = await sb.from(CHALLENGE_INVITES_TABLE).select('code, subject, time_per_q, questions, joined').eq('code', code).maybeSingle();
            if (error) { console.warn('Challenge invite lookup failed:', error.message); return null; }
            return data || null;
          } catch (err) {
            console.warn('Challenge invite lookup failed:', err);
            return null;
          }
        }

        async function markChallengeInviteJoinedRemote(code){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            await sb.from(CHALLENGE_INVITES_TABLE).update({ joined: true }).eq('code', code);
          } catch (err) {
            console.warn('Marking challenge invite joined failed:', err);
          }
        }

        async function deleteChallengeInviteRemote(code){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            await sb.from(CHALLENGE_INVITES_TABLE).delete().eq('code', code);
          } catch (err) {
            console.warn('Deleting challenge invite failed:', err);
          }
        }

        let activeChallengeCode = null;
        let activeChallengeRole = null; 
        let challengeOpponentScore = null; 
        let challengeScorePollTimer = null;

        async function submitChallengeScoreRemote(code, role, score){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const field = role === 'inviter' ? 'inviter_score' : 'friend_score';
            await sb.from(CHALLENGE_INVITES_TABLE).update({ [field]: score }).eq('code', code);
          } catch (err) {
            console.warn('Submitting challenge score failed:', err);
          }
        }

        async function fetchChallengeScoresRemote(code){
          const sb = getSupabaseClient();
          if (!sb) return null;
          try {
            const { data, error } = await sb.from(CHALLENGE_INVITES_TABLE).select('inviter_score, friend_score').eq('code', code).maybeSingle();
            if (error) { console.warn('Fetching challenge scores failed:', error.message); return null; }
            return data || null;
          } catch (err) {
            console.warn('Fetching challenge scores failed:', err);
            return null;
          }
        }

        async function submitAndAwaitChallengeResult(){
          if (!activeChallengeCode || !activeChallengeRole) return;
          const code = activeChallengeCode, role = activeChallengeRole;
          await submitChallengeScoreRemote(code, role, examScore());
          const opponentField = role === 'inviter' ? 'friend_score' : 'inviter_score';
          const check = async () => {
            const row = await fetchChallengeScoresRemote(code);
            const score = row ? row[opponentField] : null;
            if (score !== null && score !== undefined) {
              stopChallengeScorePolling();
              challengeOpponentScore = score;
              if (examStage === 'result') renderExamTake(true);
            }
          };
          await check();
          if (challengeOpponentScore === null) {
            challengeScorePollTimer = setInterval(check, 3000);
          }
        }

        function stopChallengeScorePolling(){
          if (challengeScorePollTimer) { clearInterval(challengeScorePollTimer); challengeScorePollTimer = null; }
        }

        function buildChallengeQuestionPool(){
          const pool = courseBank.flatMap(c => c.questions.map(q => Object.assign({ meta: c.name }, q)));
          return shuffleArray(pool).slice(0, currentPlanLimit('challenge')).map(shuffleMcqOptions);
        }

        function openInviteFriendModal(){
          const questions = buildChallengeQuestionPool();
          if (!questions.length) {
            pushInAppNotification('No questions yet', 'Upload a resource before inviting a friend.');
            return;
          }
          const code = generateChallengeCode();
          pendingChallengeInvites[code] = { subject: 'All Resources', timePerQ: challengeConfig.timePerQ, questions, joined: false };
          insertChallengeInviteRemote(code, 'All Resources', challengeConfig.timePerQ, questions); 
          openChallengeModal(inviteFriendHTML(code));
        }

        function inviteFriendHTML(code){
          const link = buildChallengeInviteLink(code);
          return `
            ${challengeSheetHeader('Invite a friend to the Arena')}
            <div class="text-sm text-gray-500 mb-5">Send this link to a friend -- opening it drops them straight into your challenge, no code to type.</div>
            <div class="rounded-2xl flex items-center gap-2 mb-5" style="padding:12px 14px;background:rgba(65,105,225,0.12); border:1px solid rgba(65,105,225,0.25);">
              <span class="flex-1 text-sm font-semibold truncate" style="color:${NAVY};">${escapeHtml(link)}</span>
              <button onclick="copyChallengeLink('${code}')" class="flex-shrink-0 p-1.5 rounded-full" style="color:${NAVY};background:rgba(65,105,225,0.14);">${Icon('copy','w-4 h-4')}</button>
            </div>
            <button onclick="shareChallengeLink('${code}')" class="w-full rounded-2xl font-bold text-center mb-3" style="padding-top:9px;padding-bottom:9px;background:rgba(65,105,225,0.12); color:${NAVY};">Send Link</button>
            <button onclick="startWaitingForChallengeFriend('${code}')" class="w-full rounded-2xl font-bold text-center tab-plain-btn" style="padding-top:9px;padding-bottom:9px;color:${NAVY};">Start Now</button>`;
        }

        let waitingForChallengeFriendTimer = null;
        let waitingForChallengeFriendCode = null;

        function startWaitingForChallengeFriend(code){
          waitingForChallengeFriendCode = code;
          openChallengeModal(waitingForChallengeFriendHTML());
          clearInterval(waitingForChallengeFriendTimer);
          waitingForChallengeFriendTimer = setInterval(async () => {
            const invite = pendingChallengeInvites[code];
            let joined = !invite || invite.joined;
            if (!joined) {
              const remote = await fetchChallengeInviteRemote(code);
              if (remote && remote.joined) joined = true;
            }
            if (joined) {
              clearInterval(waitingForChallengeFriendTimer);
              waitingForChallengeFriendTimer = null;
              const questions = invite ? invite.questions : (await fetchChallengeInviteRemote(code))?.questions || [];
              delete pendingChallengeInvites[code];
              activeChallengeCode = code;
              activeChallengeRole = 'inviter';
              challengeOpponentScore = null;
              dismissChallengeModalForExam();
              startChallengeWithQuestions(questions, 'All Resources', challengeConfig.timePerQ);
            }
          }, 800);
        }

        function waitingForChallengeFriendHTML(){
          return `
            <div class="flex flex-col items-center text-center py-4">
              <div style="position:relative;width:64px;height:64px;" class="mb-4">
                <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(65,105,225,0.15) 45%, rgba(65,105,225,0.15) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));animation:classroom-spin 0.9s linear infinite;"></div>
              </div>
              <div class="text-xl font-bold text-gray-900 mb-2">Waiting for your friend…</div>
              <div class="text-sm text-gray-500 mb-6">The challenge will start as soon as they open your link.</div>
              <div class="rounded-2xl flex items-center gap-2 mb-6" style="padding:12px 14px;background:rgba(65,105,225,0.12); border:1px solid rgba(65,105,225,0.25);">
                <span class="flex-1 text-sm font-semibold truncate" style="color:${NAVY};">${escapeHtml(buildChallengeInviteLink(waitingForChallengeFriendCode))}</span>
                <button onclick="copyChallengeLink('${waitingForChallengeFriendCode}')" class="flex-shrink-0 p-1.5 rounded-full" style="color:${NAVY};background:rgba(65,105,225,0.14);">${Icon('copy','w-4 h-4')}</button>
              </div>
              <button onclick="cancelWaitingForChallengeFriend()" class="w-full rounded-2xl font-bold text-center py-2.5" style="background:rgba(65,105,225,0.12); color:${NAVY};">Cancel</button>
            </div>`;
        }

        function cancelWaitingForChallengeFriend(){
          clearInterval(waitingForChallengeFriendTimer);
          waitingForChallengeFriendTimer = null;
          if (waitingForChallengeFriendCode) {
            delete pendingChallengeInvites[waitingForChallengeFriendCode];
            deleteChallengeInviteRemote(waitingForChallengeFriendCode);
          }
          waitingForChallengeFriendCode = null;
          closeChallengeModal();
        }

        function openJoinChallengeCodeModal(){
          openChallengeModal(joinChallengeCodeHTML());
        }

        function joinChallengeCodeHTML(err){
          return `
            ${challengeSheetHeader('Join with a Code')}
            <div class="text-sm text-gray-500 mb-5">Enter the code a friend shared with you to jump straight into their challenge.</div>
            <label class="text-xs font-semibold text-gray-500 mb-1 block">Challenge Code</label>
            <input type="text" id="join-challenge-code-input" placeholder="e.g. 4F9K-QX7Z" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm mb-2 tracking-widest uppercase" onkeydown="if(event.key==='Enter') submitJoinChallengeCode()">
            ${err ? `<div class="text-xs text-red-500 mb-3">${err}</div>` : `<div class="text-xs text-gray-400 mb-5 leading-relaxed">Codes are shared from the "Invite a Friend" screen in Challenge Arena -- if you got a link instead, just open it directly.</div>`}
            <button onclick="submitJoinChallengeCode()" class="w-full rounded-2xl font-bold text-center" style="padding-top:9px;padding-bottom:9px;background:rgba(65,105,225,0.12); color:${NAVY};">Join Challenge</button>`;
        }

        async function submitJoinChallengeCode(){
          const input = document.getElementById('join-challenge-code-input');
          const code = (input ? input.value : '').trim().toUpperCase();
          if (!code) { openChallengeModal(joinChallengeCodeHTML('Enter a code to join.')); return; }
          await joinChallengeByCode(code);
        }

        async function joinChallengeByCode(code){
          const invite = pendingChallengeInvites[code];
          if (invite) {
            invite.joined = true;
            markChallengeInviteJoinedRemote(code);
            activeChallengeCode = code;
            activeChallengeRole = 'friend';
            challengeOpponentScore = null;
            dismissChallengeModalForExam();
            startChallengeWithQuestions(invite.questions, invite.subject, invite.timePerQ);
            return true;
          }

          openChallengeModal(joinGameCodeLoadingHTML());
          const remote = await fetchChallengeInviteRemote(code);
          if (!remote) { openChallengeModal(joinChallengeCodeHTML("We couldn't find that code. Check it and try again.")); return false; }
          await markChallengeInviteJoinedRemote(code);
          activeChallengeCode = code;
          activeChallengeRole = 'friend';
          challengeOpponentScore = null;
          dismissChallengeModalForExam();
          startChallengeWithQuestions(remote.questions || [], remote.subject, remote.time_per_q);
          return true;
        }

        function checkPendingChallengeLinkJoin(){
          let code;
          try {
            code = new URLSearchParams(window.location.search || '').get('joinChallenge');
          } catch (err) { return; }
          if (!code) return;
          history.replaceState(null, '', window.location.pathname);
          code = code.trim().toUpperCase();
          if (!code) return;
          if (typeof switchTab === 'function') switchTab(2);
          if (typeof studySubTab === 'function') studySubTab('exams');
          joinChallengeByCode(code);
        }

        function copyChallengeCode(code){
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).catch(() => {});
          }
          pushInAppNotification('Code copied', code + ' copied to your clipboard.');
        }

        function startChallengeNow(){
          const questions = buildChallengeQuestionPool();
          if (!questions.length) {
            pushInAppNotification('No questions yet', 'Upload a resource to start a challenge.');
            closeChallengeModal();
            return;
          }
          activeChallengeCode = null;
          activeChallengeRole = null;
          dismissChallengeModalForExam();
          startChallengeWithQuestions(questions, 'All Resources', challengeConfig.timePerQ);
        }

        function startChallengeWithQuestions(questions, subject, timePerQ){
          if (!questions || !questions.length) {
            pushInAppNotification('Challenge unavailable', 'This challenge has no questions to play.');
            return;
          }
          stopChallengeScorePolling();
          challengeOpponentScore = null;
          examTest = { title: 'Challenge · ' + (subject || 'All Resources'), questions };
          examContext = 'challenge';
          examTimerSeconds = parseInt(timePerQ) || 60;
          examMode = timePerQ === 'No limit' ? 'self' : 'timed';
          examQIndex = 0;
          examAnswers = {};
          resetExamGradingState();
          examMarked = {};
          examLocked = {};
          examTimerHidden = false;
          examDirectionsOpen = false;
          examStage = 'take';
          examResultTab = 'overview';
          examQuestionPickerOpen = false;
          openOverlay('examTake');
          if (examMode === 'timed') startExamTimer(currentExamTimerSeconds());
        }

        let practiceTestsTab = 'test'; 

        const courseBank = [];

        let selectedCourseNames = new Set(courseBank.map(c => c.name));

        // ---- Practice Tests overlay (tabs, scores, course list) ----
        function openPracticeTestsOverlay(){
          practiceTestsTab = 'test';
          openOverlay('practiceTests');
        }

        function practiceTestsTabBtn(key, label){
          const active = practiceTestsTab === key;
          return `<button onclick="switchPracticeTestsTab('${key}')" class="flex-1 py-2.5 text-sm font-bold ${active ? 'text-white' : 'text-gray-500'}" style="border-radius:0.75rem;${active ? `background:rgba(30,144,255,0.5);` : 'background:#f3f4f6;'}">${label}</button>`;
        }

        function practiceTestsHTML(){
          return `
            <div class="flex-1 overflow-y-auto">
              ${overlayHeader('Practice Tests', '20px', null, null, { right: true })}
              <div class="px-5" style="margin-top:10px;">
                <div class="flex gap-2 mb-4">
                  ${practiceTestsTabBtn('test','Mock Test')}
                  ${practiceTestsTabBtn('score','Score')}
                </div>
                ${practiceTestsTab === 'test' ? practiceTestsTestPane() : practiceTestsScorePane()}
              </div>
            </div>`;
        }

        function courseListRow(label, onclick, sub){
          return `
            <button onclick="${onclick}" class="w-full text-left px-4 py-4 rounded-2xl border border-gray-200">
              <div class="font-semibold text-base text-gray-900 break-words" style="overflow-wrap:break-word;">${label}</div>
              ${sub ? `<div class="text-sm text-gray-400 mt-0.5 break-words" style="overflow-wrap:break-word;">${sub}</div>` : ''}
            </button>`;
        }

        function practiceTestsTestPane(){
          if (!courseBank.length) {
            return `
              <div class="py-16 text-center text-gray-400 text-base px-2">
                <div class="font-semibold text-gray-500 mb-1">Upload materials to unlock this quiz</div>
                <div class="text-sm">Add a PDF, DOCX, or PPTX under Resources and we'll turn it into a mock test automatically.</div>
              </div>`;
          }
          return `
            <div class="text-base font-bold mb-1" style="color:${NAVY};">Build a Mock Test</div>
            <div class="text-base text-gray-400 mb-4">Choose from the courses and slides you've uploaded; tap one to start, or test yourself on everything.</div>
            <div class="space-y-4 mb-6">
              ${courseListRow('All Courses', "openMockTestForCourse('__ALL__')")}
              ${courseBank.map(c => courseListRow(c.name, `openMockTestForCourse('${escapeHtml(c.name)}')`)).join('')}
            </div>
          `;
        }

        function practiceTestsScorePane(){
          if (!mockTestScoreHistory.length) {
            return `
              <div class="py-16 text-center text-gray-400 text-base">No completed mock tests yet.<br>Finish one to see your score here.</div>`;
          }
          const latest = mockTestScoreHistory[0];
          const latestAccuracy = latest.total ? Math.round((latest.correct / latest.total) * 100) : 0;
          const history = mockTestScoreHistory.slice(1, 21); 
          return `
            <div class="rounded-3xl p-6 text-center mb-5" style="background:rgba(65,105,225,0.06);">
              <div class="text-sm font-bold uppercase tracking-wide mb-1" style="color:${NAVY};">${escapeHtml(latest.title)}</div>
              <div class="text-5xl font-extrabold text-gray-900 my-3">${latest.correct}<span class="text-gray-300"> / </span>${latest.total}</div>
              <div class="text-sm text-gray-500">${latestAccuracy}% accuracy</div>
            </div>
            ${history.length ? `
              <div class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Past Scores</div>
              <div class="space-y-2.5">
                ${history.map(scoreHistoryRowHTML).join('')}
              </div>
            ` : ''}`;
        }

        function scoreHistoryRowHTML(r){
          const accuracy = r.total ? Math.round((r.correct / r.total) * 100) : 0;
          const color = accuracy >= 70 ? '#15803d' : accuracy >= 40 ? '#b45309' : '#b91c1c';
          const dateLabel = formatScoreHistoryDate(r.date);
          return `
            <div class="rounded-2xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-gray-800 truncate">${escapeHtml(r.title)}</div>
                <div class="text-xs text-gray-400 mt-0.5">${dateLabel}</div>
              </div>
              <div class="flex-shrink-0 text-right">
                <div class="text-sm font-bold" style="color:${color};">${r.correct}/${r.total}</div>
                <div class="text-xs text-gray-400">${accuracy}%</div>
              </div>
            </div>`;
        }

        function formatScoreHistoryDate(iso){
          try {
            const d = new Date(iso);
            if (typeof formatRequestTime === 'function') return formatRequestTime(d.getTime());
            return d.toLocaleDateString();
          } catch (e) {
            return '';
          }
        }

        function switchPracticeTestsTab(tab){
          practiceTestsTab = tab;
          document.getElementById('overlay').innerHTML = practiceTestsHTML();
        }

        function openMockTestForCourse(name){
          selectedCourseNames = name === '__ALL__' ? new Set(courseBank.map(c => c.name)) : new Set([name]);
          openChallengeModal(mockTestStartHTML());
        }

        function mockTestStartHTML(){
          const n = selectedCourseNames.size;
          return `
            ${challengeSheetHeader('Mock Test')}
            <div class="text-base text-gray-500 mb-5">${n === courseBank.length ? 'All courses' : n + ' course' + (n === 1 ? '' : 's')} selected. How do you want to take this test?</div>
            <button onclick="startMockTest('timed')" class="w-full text-white font-bold text-center py-4 rounded-full mb-3" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${Icon('clock','w-4 h-4 inline-block mr-1 -mt-0.5')} Timed · 60s per question</button>
            <button onclick="startMockTest('self')" class="w-full font-bold text-center py-4 rounded-full mb-4 border" style="color:${NAVY};border-color:rgba(65,105,225,0.3);">Self-paced · no timer</button>
            <div class="text-sm text-gray-400">Either way, leaving this tab or page ends the test early and locks in your score.</div>`;
        }

        let examTest = null, examMode = 'self', examQIndex = 0, examAnswers = {}, examMarked = {};
        let examLocked = {};
        let examCardOpenIndex = null;
        let examCardJustOpened = false;
        let flashcardAutoCloseTimer = null;
        let quizTurn = 'me';
        let examCardOwner = {};
        let quizOpponentAnswers = {};
        let opponentTurnTimer = null;
        let examContext = 'test';
        let examTimerSeconds = 60;
        let examTimerId = null, examTimeLeft = 60, examTimerHidden = false, examDirectionsOpen = false;
        let examStage = 'take'; 
        let examResultTab = 'overview'; 
        let examQuestionPickerOpen = false;
        let mockTestScoreHistory = [];
        let lastMockTestScoreId = null;
        let examWrittenGrades = {};
        let examGradingToken = 0;

        // ---- Quiz sound effects + background music ----
        function resetExamGradingState(){
          examWrittenGrades = {};
          examGradingToken++;
          lastMockTestScoreId = null;
        }

        function shuffleArray(arr){
          const a = arr.slice();
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        }

        function shuffleMcqOptions(q){
          if (!q || q.type === 'written' || !Array.isArray(q.options)) return q;
          const order = shuffleArray(q.options.map((_, i) => i));
          return Object.assign({}, q, {
            options: order.map(i => q.options[i]),
            correct: order.indexOf(q.correct),
          });
        }

        let examLoadToken = 0;

        const QUIZ_MUSIC_SRC = 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8e6b2d0d6.mp3?filename=game-music-loop-6-183980.mp3';
        let quizMusicEl = null;
        let soundMuted = false; 

        function getQuizMusicEl(){
          if (!quizMusicEl) {
            quizMusicEl = new Audio(QUIZ_MUSIC_SRC);
            quizMusicEl.loop = true;
            quizMusicEl.volume = 0.35;
          }
          return quizMusicEl;
        }

        function startQuizMusic(){
          if (examContext !== 'dailyQuiz' && examContext !== 'weeklyQuiz') return;
          const el = getQuizMusicEl();
          el.muted = soundMuted;
          el.currentTime = 0;
          el.play().catch(() => {}); 
          startQuizBeat();
        }

        function stopQuizMusic(){
          stopQuizBeat();
          if (!quizMusicEl) return;
          quizMusicEl.pause();
          quizMusicEl.currentTime = 0;
        }

        function toggleAppSound(){
          soundMuted = !soundMuted;
          if (quizMusicEl) quizMusicEl.muted = soundMuted;
          const icon = Icon(soundMuted ? 'volumeOff' : 'volume', 'w-5 h-5');
          const quizBtn = document.getElementById('quiz-music-toggle');
          if (quizBtn) quizBtn.innerHTML = icon;
          const headerBtn = document.getElementById('header-volume-btn');
          if (headerBtn) headerBtn.innerHTML = Icon(soundMuted ? 'volumeOff' : 'volume', 'w-6 h-6');
        }
        function toggleQuizMusicMute(){ toggleAppSound(); }

        let sfxAudioCtx = null;
        function getSfxAudioCtx(){
          if (!sfxAudioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) sfxAudioCtx = new Ctx();
          }
          return sfxAudioCtx;
        }
        function playTone(freq, startDelay, duration, type, peakVolume){
          if (soundMuted) return;
          const ctx = getSfxAudioCtx();
          if (!ctx) return;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type || 'sine';
          osc.frequency.value = freq;
          const t0 = ctx.currentTime + (startDelay || 0);
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(peakVolume || 0.15, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + duration + 0.03);
        }
        function playCardTapSfx(){ playTone(520, 0, 0.09, 'triangle', 0.08); }
        function playOpponentMoveSfx(){ playTone(400, 0, 0.08, 'triangle', 0.07); }
        function playQuizFinishSfx(perfect){
          const notes = perfect ? [523, 659, 784, 1046] : [523, 659];
          notes.forEach((f, idx) => playTone(f, idx * 0.11, 0.18, 'sine', 0.13));
        }

        let quizBeatIntervalId = null;
        function startQuizBeat(){
          stopQuizBeat();
          quizBeatIntervalId = setInterval(() => { playTone(110, 0, 0.14, 'sine', 0.06); }, 700);
        }
        function stopQuizBeat(){
          if (quizBeatIntervalId) { clearInterval(quizBeatIntervalId); quizBeatIntervalId = null; }
        }

        function examLoadingLabel(){
          return (examContext === 'dailyQuiz' || examContext === 'weeklyQuiz') ? 'Loading quiz' : 'Loading exam';
        }

        function currentExamTimerSeconds(){
          if (examContext === 'weeklyQuiz') return 15 * 60;
          if (examContext === 'dailyQuiz') return 10 * 60;
          return examTimerSeconds;
        }

        function examLoadingMarkup(){
          return `
            <div id="exam-loading-overlay" class="classroom-slide-cover flex flex-col items-center justify-center">
              <div style="position:relative;width:84px;height:84px;">
                <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(10,37,64,0.12) 45%, rgba(10,37,64,0.12) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));mask:radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px));animation:classroom-spin 0.9s linear infinite;"></div>
                <div style="position:absolute;inset:10px;background:#ffffff;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(10,37,64,0.18);">
                  ${gradIcon(Icon('edit','w-8 h-8'))}
                </div>
              </div>
              <div class="mt-4 text-sm font-semibold text-gray-500 font-display" id="exam-loading-text">${examLoadingLabel()}</div>
            </div>`;
        }

        // ---- Mock test start + timer ----
        function startMockTest(mode){
          dismissChallengeModalForExam();
          stopChallengeScorePolling();
          activeChallengeCode = null;
          activeChallengeRole = null;
          challengeOpponentScore = null;
          const questions = shuffleArray(courseBank
            .filter(c => selectedCourseNames.has(c.name))
            .flatMap(c => c.questions.map(q => Object.assign({ meta: c.name }, q))))
            .slice(0, currentPlanLimit('questions'))
            .map(shuffleMcqOptions);
          examTest = { title: 'Mock Test', questions };
          examContext = 'test';
          examTimerSeconds = 60;
          examMode = mode;
          examQIndex = 0;
          examAnswers = {};
          resetExamGradingState();
          examMarked = {};
          examLocked = {};
          examTimerHidden = false;
          examDirectionsOpen = false;
          examStage = 'take';
          examResultTab = 'overview';
          examQuestionPickerOpen = false;

          if (typeof currentOverlayKind !== 'undefined') currentOverlayKind = 'examTake';

          const myToken = ++examLoadToken;
          const ov = document.getElementById('overlay');
          if (!ov) return;
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = examLoadingMarkup();

          let dots = 0;
          const dotTimer = setInterval(() => {
            const el = document.getElementById('exam-loading-text');
            if (!el || myToken !== examLoadToken) { clearInterval(dotTimer); return; }
            dots = (dots + 1) % 4;
            el.textContent = examLoadingLabel() + '.'.repeat(dots);
          }, 350);

          const EXAM_LOAD_MS = 1800;
          setTimeout(() => {
            clearInterval(dotTimer);
            if (myToken === examLoadToken) revealExamTake(myToken);
          }, EXAM_LOAD_MS);
        }

        function revealExamTake(token) {
          if (token !== examLoadToken) return;
          const ov = document.getElementById('overlay');
          if (!ov) return;

          ov.innerHTML = examTakeHTML();
          setNotebookNavLabel('Annotate');
          ov.insertAdjacentHTML('afterbegin', examLoadingMarkup());
          const overlay = document.getElementById('exam-loading-overlay');
          if (!overlay) return;

          void overlay.offsetWidth;
          requestAnimationFrame(() => {
            overlay.classList.add('slide-out');
          });

          const finishReveal = () => {
            overlay.remove();
            if (examMode === 'timed' && token === examLoadToken) startExamTimer(currentExamTimerSeconds());
          };
          overlay.addEventListener('transitionend', finishReveal, { once: true });
          setTimeout(finishReveal, 700);
        }

        function startExamTimer(seconds){
          clearInterval(examTimerId);
          examTimeLeft = seconds || 60;
          examTimerId = setInterval(() => {
            examTimeLeft--;
            if (examTimeLeft <= 0) {
              clearInterval(examTimerId);
              if (examContext === 'weeklyQuiz' || examContext === 'dailyQuiz') {
                if (examContext === 'dailyQuiz') finalizeDailyQuizSelection();
                finishExam();
                renderExamTake();
              } else {
                examGoNext(true);
              }
              return;
            }
            const el = document.getElementById('exam-timer-display');
            if (el) el.textContent = formatExamTime(examTimeLeft);
          }, 1000);
        }

        function formatExamTime(s){
          const m = Math.floor(s / 60);
          const sec = s % 60;
          return m + ':' + String(sec).padStart(2, '0');
        }

        function writtenAnswerInputHTML(q, index, selected){
          if (q.type !== 'written') {
            return q.options.map((opt, i) => `
              <button onclick="selectExamOption(${i})" class="w-full text-left px-4 py-4 rounded-2xl outline-pill ${selected === i ? 'is-selected' : ''}">
                <span class="text-base ${selected === i ? 'font-bold' : ''}">${escapeHtml(opt)}</span>
              </button>`).join('');
          }
          const value = typeof selected === 'string' ? selected : '';
          return `
            <textarea oninput="setExamWrittenAnswer(${index}, this.value)" placeholder="Type your answer (a calculation result, a definition, or a term)..." class="w-full border rounded-2xl px-4 py-3 text-base resize-none" style="border-color:${value ? NAVY : '#e5e7eb'};" rows="3">${escapeHtml(value)}</textarea>
            <div class="text-xs text-gray-400 mt-2">${Icon('bolt','w-3.5 h-3.5 inline-block mr-1 -mt-0.5')} Graded automatically against the marking scheme once you submit.</div>`;
        }

        function examTakeHTML(){
          if (examContext === 'weeklyQuiz' || examContext === 'dailyQuiz') {
            return examCardOpenIndex === null ? weeklyQuizBoardHTML() : weeklyQuizCardHTML(examCardOpenIndex);
          }
          const q = examTest.questions[examQIndex];
          const total = examTest.questions.length;
          const selected = examAnswers[examQIndex];
          return `
            <div id="exam-scroll-container" class="flex-1 overflow-y-auto" style="padding-top:var(--top-safe-pad);">
              <div class="px-5">
                <div class="flex items-start justify-between mb-3">
                  <button onclick="toggleExamDirections()" class="text-base font-bold text-gray-700 flex items-center gap-1">Directions ${Icon('chevronDown','w-3.5 h-3.5')}</button>
                  <div class="flex flex-col items-center">
                    ${examMode === 'timed' && !examTimerHidden ? `<div id="exam-timer-display" class="text-2xl font-bold" style="color:${NAVY};">${formatExamTime(examTimeLeft)}</div>` : ''}
                    ${examMode === 'timed' ? `<button onclick="toggleExamTimerHidden()" class="text-xs font-semibold px-3 py-1 rounded-full border border-gray-200 text-gray-600 mt-2">${examTimerHidden ? 'Show' : 'Hide'}</button>` : ''}
                  </div>
                  <div style="width:64px;">${examContext === 'weeklyQuiz' && quizStake > 0 ? `<div class="flex items-center gap-1 font-bold text-white flex-shrink-0" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:9999px;padding:0.25rem 0.5rem;font-size:0.65rem;">${Icon('coin','w-3 h-3')} ${quizStake}</div>` : ''}</div>
                </div>
                ${examDirectionsOpen ? `
                  <div class="rounded-2xl p-4 mb-3 text-sm text-gray-600" style="background:rgba(65,105,225,0.08);">
                    Answer every question to the best of your ability. You can mark questions for review and revisit them using Back before submitting.
                  </div>` : ''}
                <div class="rounded-2xl p-4 mb-4 flex items-start gap-2" style="background:rgba(220,38,38,0.08);">
                  <span class="flex-shrink-0" style="color:#b91c1c;">${Icon('alertTriangle','w-5 h-5')}</span>
                  <div class="text-sm font-semibold" style="color:#b91c1c;">Stay on this tab. Leaving the page ends the test and locks in your score.</div>
                </div>

                <div class="text-sm font-bold uppercase tracking-wide mb-2" style="color:${NAVY};">${q.meta}</div>
                <div class="text-base text-gray-900 mb-4 leading-snug">${escapeHtml(q.text)}</div>
              </div>

              <div class="border-t border-dashed border-gray-200 my-2"></div>

              <div class="px-5">
                <div class="rounded-2xl px-4 py-3 mb-3 flex items-center justify-between" style="background:rgba(65,105,225,0.1);">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-bold" style="background:rgba(30,144,255,0.5);">${examQIndex + 1}</div>
                  <button onclick="toggleExamMark()" class="text-sm font-bold flex items-center gap-1.5" style="color:${examMarked[examQIndex] ? '#b45309' : NAVY};">${Icon('bookmark','w-4 h-4')} ${examMarked[examQIndex] ? 'Marked' : 'Mark for Review'}</button>
                </div>

                <div class="space-y-4 mb-6 quiz-options-grid">
                  ${writtenAnswerInputHTML(q, examQIndex, selected)}
                </div>
              </div>
            </div>
            ${examQuestionPickerOpen ? `<div onclick="toggleExamQuestionPicker()" onwheel="toggleExamQuestionPicker()" ontouchmove="toggleExamQuestionPicker()" class="fixed inset-0 z-20"></div>${examQuestionGridHTML()}` : ''}
            <div class="flex-shrink-0 border-t border-gray-100 px-5 py-3 flex items-center justify-between gap-2" style="padding-bottom:calc(env(safe-area-inset-bottom, 8px) + 10px);">
              <button onclick="examExit()" class="text-sm font-semibold text-gray-500">Exit</button>
              ${examContext === 'weeklyQuiz' ? '' : `<button onclick="toggleExamQuestionPicker()" class="font-bold text-white rounded-full flex-shrink-0 flex items-center gap-1" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);font-size:0.75rem;padding:0.4rem 0.75rem;">Question ${examQIndex + 1} of ${total} ${Icon('chevronDown','w-3 h-3')}</button>`}
              <button onclick="examGoBack()" class="text-sm font-bold px-5 py-2.5 rounded-full border border-gray-200 text-gray-700 ${examQIndex === 0 ? 'opacity-40 pointer-events-none' : ''}">Back</button>
              <button onclick="examGoNext(false)" class="text-sm font-bold px-5 py-2.5 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">${examQIndex === total - 1 ? 'Submit' : 'Next'}</button>
            </div>`;
        }

        // ---- Weekly quiz board + flashcard-style questions ----
        function weeklyQuizTimerAndStakeHTML(onBack){
          return `
            <div class="flex items-center justify-between mb-3">
              <button onclick="${onBack}" class="w-8 h-8 flex items-center justify-center text-gray-600 flex-shrink-0">${IconBold('back','w-5 h-5')}</button>
              <button id="quiz-music-toggle" onclick="toggleAppSound()" class="w-8 h-8 flex items-center justify-center flex-shrink-0" title="Mute/unmute sound">${Icon(soundMuted ? 'volumeOff' : 'volume', 'w-5 h-5')}</button>
              ${examContext === 'weeklyQuiz' && quizStake > 0 ? `<div class="flex items-center gap-1 font-bold text-white flex-shrink-0" style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:9999px;padding:0.25rem 0.5rem;font-size:0.65rem;">${Icon('coin','w-3 h-3')} ${quizStake}</div>` : ''}
            </div>`;
        }

        function quizBoardTarget(){
          const total = examTest.questions.length;
          return examContext === 'dailyQuiz' ? Math.min(10, total) : total;
        }

        function weeklyQuizBoardHTML(){
          const total = examTest.questions.length;
          const isDaily = examContext === 'dailyQuiz';
          const target = quizBoardTarget();
          const answeredCount = Object.keys(examAnswers).length;
          const opponent = quizOpponent || quizOpponentPool[0];
          const myTurn = isDaily || quizTurn === 'me';
          let cards = '';
          for (let i = 0; i < total; i++) {
            const isAnswered = examAnswers[i] !== undefined;
            const isMarked = !!examMarked[i];
            const isLocked = !!examLocked[i];
            const owner = examCardOwner[i];
            const isOpponentCard = !isDaily && owner === 'opponent';
            const canTap = !isLocked && !isOpponentCard && myTurn;
            const faceStyle = isLocked
              ? 'background:rgba(107,114,128,0.16);color:#6b7280;border:1.5px dashed rgba(107,114,128,0.4);'
              : isOpponentCard
                ? `background:${opponent.color};color:#fff;`
                : isAnswered
                  ? `background:linear-gradient(135deg,${ROYAL},${NAVY});color:#fff;`
                  : isMarked
                    ? 'background:rgba(180,83,9,0.1);color:#b45309;border:1.5px solid rgba(180,83,9,0.35);'
                    : `background:url('${flashcardBackImage}') center/cover; color:#fff;`;
            const inner = isLocked
              ? Icon('lock','w-5 h-5')
              : isOpponentCard
                ? `<span class="text-sm">${escapeHtml(opponent.name.charAt(0))}</span>`
                : isAnswered
                  ? Icon('check','w-6 h-6')
                  : isMarked
                    ? Icon('bookmark','w-5 h-5')
                    : '';
            cards += `
              <button onclick="${canTap ? `openFlashcard(${i})` : ''}" class="flex flex-col items-center justify-center font-bold flashcard-tile ${canTap ? '' : 'pointer-events-none'} ${!isLocked && !isOpponentCard && !isAnswered && !myTurn ? 'opacity-60' : ''}" style="${faceStyle}border-radius:0.9rem;aspect-ratio:3/4;box-shadow:0 3px 8px rgba(0,0,0,0.18);">
                ${inner}
              </button>`;
          }
          const helperText = isDaily
            ? `Tap any ${target} of the ${total} cards to answer them. ${answeredCount} of ${target} chosen.`
            : myTurn
              ? `Your turn: tap a card to claim and answer it.`
              : `${escapeHtml(opponent.name)}'s turn: they're picking a card...`;
          const isDesktopView = window.innerWidth >= 1024;
          const boardCols = isDesktopView ? (isDaily ? 3 : 4) : (isDaily ? 4 : 5);
          const boardRows = Math.ceil(total / boardCols);
          const turnBanner = isDaily ? '' : `
            <div class="flex items-center justify-between rounded-2xl p-3 mb-4" style="background:rgba(65,105,225,0.08);">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-xs" style="background:${NAVY};">You</div>
                <span class="text-xs font-bold text-gray-400">${Object.values(examCardOwner).filter(o => o === 'me').length}</span>
              </div>
              <div class="text-xs font-bold flex-shrink-0 ${myTurn ? '' : 'animate-pulse'}" style="color:${NAVY};">${myTurn ? 'Your turn' : escapeHtml(opponent.name) + ' is picking'}</div>
              <div class="flex items-center gap-2 min-w-0 flex-row-reverse">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-xs" style="background:${opponent.color};">${escapeHtml(opponent.name.charAt(0))}</div>
                <span class="text-xs font-bold text-gray-400">${Object.values(examCardOwner).filter(o => o === 'opponent').length}</span>
              </div>
            </div>`;
          return `
            <div class="flex-1 overflow-y-auto" style="padding-top:var(--top-safe-pad);">
              <div class="px-5">
                ${weeklyQuizTimerAndStakeHTML('examExit()')}
                <div class="rounded-3xl p-4 quiz-board-wrap" style="background:rgba(255,255,255,0.92);backdrop-filter:blur(2px);box-shadow:0 8px 24px rgba(0,0,0,0.12);">
                  ${turnBanner}
                  <div class="text-sm text-gray-500 mb-4">${helperText}</div>
                  <div class="grid gap-2.5 quiz-board-grid" style="grid-template-columns:repeat(${boardCols},1fr);grid-template-rows:repeat(${boardRows},1fr);">${cards}</div>
                </div>
              </div>
            </div>`;
        }

        function weeklyQuizCardHTML(i){
          const q = examTest.questions[i];
          const total = examTest.questions.length;
          const selected = examAnswers[i];
          const justOpened = examCardJustOpened;
          examCardJustOpened = false;
          return `
            <div id="flashcard-card-view" class="flex-1 overflow-y-auto flashcard-flip-wrap ${justOpened ? 'flashcard-flip-in' : ''}" style="padding-top:var(--top-safe-pad);">
              <div class="px-5 h-full flex flex-col">
                ${weeklyQuizTimerAndStakeHTML('backFromFlashcard()')}
                <div class="rounded-3xl p-4 flex-1 flex flex-col" style="background:rgba(255,255,255,0.92);backdrop-filter:blur(2px);box-shadow:0 8px 24px rgba(0,0,0,0.12);">
                  <div class="text-base text-gray-900 mb-4 leading-snug">${escapeHtml(q.text)}</div>
                  <div class="space-y-4 quiz-options-grid flex-1 flex flex-col">
                    ${q.type === 'written' ? writtenAnswerInputHTML(q, i, selected) : q.options.map((opt, oi) => `
                      <button onclick="selectFlashcardOption(${i}, ${oi})" class="flex-1 flex items-center text-left px-4 py-4 rounded-2xl outline-pill ${selected === oi ? 'is-selected' : ''}" style="width:70%;margin-left:auto;margin-right:auto;">
                        <span class="text-base ${selected === oi ? 'font-bold' : ''}">${escapeHtml(opt)}</span>
                      </button>`).join('')}
                  </div>
                </div>
              </div>
            </div>`;
        }

        function openFlashcard(i){
          if (examLocked[i]) return;
          if (examContext === 'weeklyQuiz' && (quizTurn !== 'me' || examCardOwner[i] === 'opponent')) return;
          playCardTapSfx();
          examCardOpenIndex = i;
          examCardJustOpened = true;
          clearTimeout(flashcardAutoCloseTimer);
          const q = examTest.questions[i];
          const limitMs = (q && q.calc ? 60 : 30) * 1000;
          flashcardAutoCloseTimer = setTimeout(() => {
            if (examCardOpenIndex === i && examAnswers[i] === undefined) lockFlashcardForTimeout(i);
          }, limitMs);
          renderExamTake();
        }
        function lockFlashcardForTimeout(i){
          examLocked[i] = true;
          closeFlashcard();
          pushInAppNotification('Question locked', "Time's up, so this question is locked and won't count toward your score.");
          if (examContext === 'weeklyQuiz') { resolveMyWeeklyTurn(i); return; }
          const resolvedCount = Object.keys(examAnswers).length + Object.keys(examLocked).filter(k => examAnswers[k] === undefined).length;
          if (examTest && resolvedCount === quizBoardTarget()) {
            if (examContext === 'dailyQuiz') finalizeDailyQuizSelection();
            finishExam();
            renderExamTake();
          }
        }
        function closeFlashcard(){
          clearTimeout(flashcardAutoCloseTimer);
          examCardOpenIndex = null;
          renderExamTake();
        }

        function backFromFlashcard(){
          const i = examCardOpenIndex;
          if (i === null || examAnswers[i] !== undefined || examLocked[i]) { closeFlashcard(); return; }
          examLocked[i] = true;
          closeFlashcard();
          pushInAppNotification('Question locked', 'Leaving a question unanswered locks it in, so it won\'t count toward your score.');
          if (examContext === 'weeklyQuiz') { resolveMyWeeklyTurn(i); return; }
          const resolvedCount = Object.keys(examAnswers).length + Object.keys(examLocked).filter(k => examAnswers[k] === undefined).length;
          if (examTest && resolvedCount === quizBoardTarget()) {
            if (examContext === 'dailyQuiz') finalizeDailyQuizSelection();
            finishExam();
            renderExamTake();
          }
        }
        function selectFlashcardOption(i, oi){
          clearTimeout(flashcardAutoCloseTimer);
          examAnswers[i] = oi;
          renderExamTake();
          const cardEl = document.getElementById('flashcard-card-view');
          if (cardEl) cardEl.classList.add('flashcard-flip-out');
          setTimeout(() => {
            if (examCardOpenIndex !== i) return;
            if (examContext === 'weeklyQuiz') { resolveMyWeeklyTurn(i); return; }
            const resolvedCount = Object.keys(examAnswers).length + Object.keys(examLocked).filter(k => examAnswers[k] === undefined).length;
            const allAnswered = resolvedCount === quizBoardTarget();
            if (allAnswered) {
              if (examContext === 'dailyQuiz') finalizeDailyQuizSelection();
              finishExam();
              renderExamTake();
            } else {
              closeFlashcard();
            }
          }, 320);
        }

        function finalizeDailyQuizSelection(){
          const indices = Object.keys(examAnswers).map(Number).sort((a, b) => a - b);
          const questions = indices.map(idx => examTest.questions[idx]);
          const answers = {};
          indices.forEach((idx, newIdx) => { answers[newIdx] = examAnswers[idx]; });
          examTest = { title: examTest.title, questions };
          examAnswers = answers;
          examMarked = {};
          examLocked = {};
        }

        function resolveMyWeeklyTurn(i){
          examCardOwner[i] = 'me';
          closeFlashcard();
          const total = examTest.questions.length;
          if (Object.keys(examCardOwner).length === total) {
            finalizeWeeklyQuizSelection();
            finishExam();
            renderExamTake();
          } else {
            quizTurn = 'opponent';
            renderExamTake();
            scheduleOpponentTurn();
          }
        }

        function scheduleOpponentTurn(){
          clearTimeout(opponentTurnTimer);
          opponentTurnTimer = setTimeout(() => {
            if (examContext !== 'weeklyQuiz' || !examTest || quizTurn !== 'opponent') return;
            const total = examTest.questions.length;
            const unclaimed = [];
            for (let i = 0; i < total; i++) { if (examCardOwner[i] === undefined) unclaimed.push(i); }
            if (!unclaimed.length) return;
            const pick = unclaimed[Math.floor(Math.random() * unclaimed.length)];
            examCardOwner[pick] = 'opponent';
            quizOpponentAnswers[pick] = Math.random() < 0.65;
            playOpponentMoveSfx();
            if (Object.keys(examCardOwner).length === total) {
              finalizeWeeklyQuizSelection();
              finishExam();
              renderExamTake();
            } else {
              quizTurn = 'me';
              renderExamTake();
            }
          }, 900 + Math.random() * 700);
        }

        function finalizeWeeklyQuizSelection(){
          const total = examTest.questions.length;
          const myIndices = [];
          let oppCorrect = 0;
          for (let i = 0; i < total; i++) {
            if (examCardOwner[i] === 'me') myIndices.push(i);
            else if (examCardOwner[i] === 'opponent' && quizOpponentAnswers[i]) oppCorrect++;
          }
          const questions = myIndices.map(idx => examTest.questions[idx]);
          const answers = {};
          myIndices.forEach((idx, newIdx) => { answers[newIdx] = examAnswers[idx]; });
          examTest = { title: examTest.title, questions };
          examAnswers = answers;
          examMarked = {};
          examLocked = {};
          quizOpponentScore = oppCorrect;
        }
        function toggleFlashcardMark(i){
          examMarked[i] = !examMarked[i];
          renderExamTake();
        }

        // ---- Exam-taking screen (navigation, answers, marking) ----
        function examQuestionGridHTML(){
          const total = examTest.questions.length;
          let cells = '';
          for (let i = 0; i < total; i++) {
            const isCurrent = i === examQIndex;
            const isAnswered = examAnswers[i] !== undefined;
            const isMarked = !!examMarked[i];
            let style;
            if (isCurrent) style = `background:rgba(30,144,255,0.5);color:#fff;`;
            else if (isMarked) style = 'background:rgba(180,83,9,0.12);color:#b45309;border:1px solid rgba(180,83,9,0.3);';
            else if (isAnswered) style = `background:rgba(65,105,225,0.1);color:${NAVY};border:1px solid rgba(65,105,225,0.25);`;
            else style = 'background:#fff;color:#374151;border:1px solid #e5e7eb;';
            cells += `<button onclick="examJumpTo(${i})" class="font-bold text-sm" style="${style}border-radius:0.75rem;display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;">${i + 1}</button>`;
          }
          return `
            <div class="bg-white rounded-3xl border border-gray-100" style="position:absolute;left:1rem;right:1rem;z-index:30;bottom:78px;max-height:340px;overflow-y:auto;padding:1rem;box-shadow:0 10px 30px rgba(0,0,0,0.15);">
              <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.5rem;">${cells}</div>
            </div>`;
        }

        function toggleExamQuestionPicker(){
          examQuestionPickerOpen = !examQuestionPickerOpen;
          renderExamTake();
        }

        function examJumpTo(i){
          examQuestionPickerOpen = false;
          examQIndex = i;
          if (examMode === 'timed' && examContext !== 'weeklyQuiz') startExamTimer(currentExamTimerSeconds());
          renderExamTake();
        }

        function renderExamTake(preserveScroll){
          const prevContainer = document.getElementById('exam-scroll-container');
          const prevScrollTop = preserveScroll && prevContainer ? prevContainer.scrollTop : 0;
          document.getElementById('overlay').innerHTML = examStage === 'result' ? examResultHTML() : examTakeHTML();
          setNotebookNavLabel('Annotate');
          if (preserveScroll && prevScrollTop) {
            const newContainer = document.getElementById('exam-scroll-container');
            if (newContainer) newContainer.scrollTop = prevScrollTop;
          }
        }

        function setNotebookNavLabel(text){
          inExamAnnotate = (text === 'Annotate');
          if (rightPanelMode === 'notebook') renderRightPanelBody();
        }

        function toggleExamDirections(){ examDirectionsOpen = !examDirectionsOpen; renderExamTake(true); }
        function toggleExamTimerHidden(){ examTimerHidden = !examTimerHidden; renderExamTake(true); }
        function toggleExamMark(){ examMarked[examQIndex] = !examMarked[examQIndex]; renderExamTake(true); }
        function selectExamOption(i){ examAnswers[examQIndex] = i; renderExamTake(true); }
        function setExamWrittenAnswer(i, text){ examAnswers[i] = text; }

        function examGoBack(){
          if (examQIndex === 0) return;
          examQIndex--;
          if (examMode === 'timed' && examContext !== 'weeklyQuiz') startExamTimer(currentExamTimerSeconds());
          renderExamTake();
        }

        function examGoNext(auto){
          const total = examTest.questions.length;
          if (examQIndex >= total - 1) {
            finishExam();
            renderExamTake();
            return;
          }
          examQIndex++;
          if (examMode === 'timed' && examContext !== 'weeklyQuiz') startExamTimer(currentExamTimerSeconds());
          renderExamTake();
        }

        function finishExam(exitedEarly){
          clearInterval(examTimerId);
          clearQuizBackground();
          stopQuizMusic();
          const total = examTest.questions.length;
          const correct = examScore();
          recordMockTestScore(examTest.title, correct, total);
          if (examContext === 'test') practiceCompleted = true;
          if (examContext === 'dailyQuiz' || examContext === 'weeklyQuiz') {
            applyQuizRewards(correct, total, !!exitedEarly);
            playQuizFinishSfx(quizWasPerfect);
          }
          if (examContext === 'challenge' && activeChallengeCode) {
            submitAndAwaitChallengeResult(); 
          }
          examStage = 'result';
          examResultTab = 'overview';
          examQuestionPickerOpen = false;
          gradeWrittenExamAnswers();
        }

        // ---- Exam grading + scoring ----
        function recordMockTestScore(title, correct, total){
          if (examContext !== 'test') { lastMockTestScoreId = null; return; }
          const id = 'mockscore-' + Date.now();
          mockTestScoreHistory.unshift({ id, title, correct, total, date: new Date().toISOString() });
          if (mockTestScoreHistory.length > 100) mockTestScoreHistory.length = 100;
          lastMockTestScoreId = id;
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function updateMockTestScoreHistoryAfterGrading(){
          if (!lastMockTestScoreId) return;
          const entry = mockTestScoreHistory.find(e => e.id === lastMockTestScoreId);
          if (!entry || !examTest) return;
          entry.correct = examScore();
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
        }

        function isExamAnswerGraded(q, i){
          if (q.type !== 'written') return true;
          if (examAnswers[i] === undefined) return true;
          return !!examWrittenGrades[i];
        }

        function isExamAnswerCorrect(q, i){
          if (q.type === 'written') {
            const g = examWrittenGrades[i];
            return !!(g && g.correct);
          }
          return examAnswers[i] !== undefined && examAnswers[i] === q.correct;
        }

        function examScore(){
          let correct = 0;
          examTest.questions.forEach((q, i) => { if (isExamAnswerCorrect(q, i)) correct++; });
          return correct;
        }

        async function gradeWrittenExamAnswers(){
          if (!examTest) return;
          const myToken = examGradingToken;
          const pending = [];
          examTest.questions.forEach((q, i) => {
            if (q.type === 'written' && examAnswers[i] !== undefined && String(examAnswers[i]).trim() && !examWrittenGrades[i]) {
              pending.push({ i, q });
            }
          });
          if (!pending.length) return;
          const system = 'You are grading short written answers against a marking scheme for an education app. ' +
            'For each item, decide whether the student\'s answer earns credit: it should contain the required ' +
            'keywords/values (numbers, terms, or close equivalents/synonyms) or otherwise match the ideal ' +
            'answer\'s meaning -- minor wording differences, extra explanation, or different unit/formatting are ' +
            'fine as long as the core answer is right. A calculation answer needs the correct final numeric value ' +
            '(reasonable rounding is fine); a definition/key-term answer needs to convey the same meaning as the ' +
            'ideal answer, not just share a word with it. ' +
            'Respond with ONLY raw JSON (no markdown fences, no commentary): an array of ' +
            '{"i":number,"correct":boolean,"feedback":"string"} objects, one per item, "i" matching the given ' +
            'index. "feedback" is one short sentence (under 20 words) explaining the verdict to the student.';
          const user = JSON.stringify(pending.map(({ i, q }) => ({
            i,
            question: q.text,
            idealAnswer: q.answer || '',
            keywords: q.keywords || [],
            studentAnswer: String(examAnswers[i])
          })));
          try {
            const raw = await callClaude(system, user, 'materials');
            const cleaned = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
            const results = JSON.parse(cleaned);
            if (myToken !== examGradingToken) return; 
            (Array.isArray(results) ? results : []).forEach(r => {
              if (typeof r.i === 'number') examWrittenGrades[r.i] = { correct: !!r.correct, feedback: r.feedback || '' };
            });
          } catch (err) {
            if (myToken !== examGradingToken) return;
            console.error('Written-answer grading failed:', err);
            pending.forEach(({ i }) => { examWrittenGrades[i] = { correct: false, feedback: "Couldn't auto-grade this answer against the marking scheme -- please review it yourself." }; });
          }
          if (myToken !== examGradingToken) return;
          updateMockTestScoreHistoryAfterGrading();
          if (examStage === 'result') renderExamTake();
        }

        // ---- Exam/quiz results screen ----
        function switchExamResultTab(tab){
          examResultTab = tab;
          renderExamTake();
        }

        function examResultHTML(){
          const total = examTest.questions.length;
          const correct = examScore();
          const answered = Object.keys(examAnswers).length;
          const isQuiz = examContext === 'dailyQuiz' || examContext === 'weeklyQuiz';
          const isChallengeVsFriend = examContext === 'challenge' && !!activeChallengeCode;
          return `
            <div class="flex-1 overflow-y-auto" style="background:#fff;">
              <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
                <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between gap-4">
                  <button onclick="${isQuiz ? "openOverlay('gamification')" : 'closeOverlay()'}" class="flex items-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                  <div class="font-semibold text-lg font-display grad-text text-right truncate" style="min-width:0;">${escapeHtml(examTest.title)}</div>
                </div>
              </div>
              <div class="px-5 pb-8">
                <div class="text-center font-display" style="margin-top:10px;margin-bottom:1rem;font-size:4rem;line-height:1;font-weight:800;color:${total ? (Math.round((correct / total) * 100) >= 70 ? '#15803d' : '#b91c1c') : '#b91c1c'};">${correct}</div>
                ${isQuiz ? '' : `<div class="text-center text-sm text-gray-500 mb-6">You answered ${answered} of ${total} questions. Your final score is locked in.</div>`}
                ${isQuiz ? quizRewardBannerHTML() : ''}
                ${isChallengeVsFriend ? challengeMatchResultHTML() : ''}
                <div class="flex gap-2 mb-5 bg-gray-100 rounded-2xl p-1">
                  <button onclick="switchExamResultTab('overview')" class="flex-1 py-2.5 text-sm font-bold rounded-2xl ${examResultTab === 'overview' ? 'text-white' : 'text-gray-500'}" style="${examResultTab === 'overview' ? `background:rgba(30,144,255,0.5);` : ''}">Overview</button>
                  <button onclick="switchExamResultTab('review')" class="flex-1 py-2.5 text-sm font-bold rounded-2xl ${examResultTab === 'review' ? 'text-white' : 'text-gray-500'}" style="${examResultTab === 'review' ? `background:rgba(30,144,255,0.5);` : ''}">Review Answers</button>
                </div>
                ${examResultTab === 'overview' ? examResultOverviewHTML() : examResultReviewHTML()}
              </div>
            </div>
            <div class="flex-shrink-0 border-t border-gray-100 px-5 py-3 flex gap-2" style="padding-bottom:calc(env(safe-area-inset-bottom, 8px) + 10px);">
              ${examResultFooterHTML()}
            </div>`;
        }

        function examResultFooterHTML(){
          if (examContext === 'dailyQuiz') {
            return `<button onclick="openOverlay('gamification')" class="flex-1 font-semibold text-center rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.4rem 0;font-size:0.8rem;">Back to Games</button>`;
          }
          if (examContext === 'weeklyQuiz') {
            return `
              <button onclick="openOverlay('gamification')" class="flex-1 font-semibold text-center rounded-lg border border-gray-200 text-gray-700" style="padding:0.8rem 0;font-size:0.8rem;">Back to Games</button>
              <button onclick="openWeeklyQuizJoin()" class="flex-1 font-semibold text-center rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.8rem 0;font-size:0.8rem;">Play Again</button>`;
          }
          return `
            <button onclick="closeOverlay()" class="flex-1 font-semibold text-center rounded-lg border border-gray-200 text-gray-700" style="padding:0.4rem 0;font-size:0.8rem;">Close</button>
            <button onclick="startMockTest(examMode)" class="flex-1 font-semibold text-center rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);padding:0.4rem 0;font-size:0.8rem;">Practice Again</button>`;
        }

        function quizRewardBannerHTML(){
          const isDaily = examContext === 'dailyQuiz';
          const rank = leaderboard.findIndex(p => p.me) + 1;
          return `
            <div class="rounded-3xl p-5 text-white mb-5" style="background:${isDaily ? 'linear-gradient(135deg,#f59e0b,#d97706)' : `linear-gradient(135deg,${ROYAL},${NAVY})`};">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-semibold uppercase tracking-wide" style="color:rgba(255,255,255,0.75);">${isDaily ? 'Coins earned' : 'Points earned'}</div>
                  <div class="text-3xl font-bold font-display flex items-center gap-2">+${quizPointsEarned}${isDaily ? Icon('coin','w-6 h-6') : ''}</div>
                </div>
                ${quizWasPerfect ? `<div class="flex flex-col items-center">${Icon('trophy','w-9 h-9 text-amber-400')}<span class="text-xs font-semibold mt-1">Perfect!</span></div>` : ''}
              </div>
              <div class="flex items-center gap-4 mt-3 text-sm" style="color:rgba(255,255,255,0.85);">
                ${isDaily
                  ? `<div class="flex items-center gap-1.5">${Icon('coin','w-4 h-4')} ${userCoins.toLocaleString()} total</div>`
                  : `<div class="flex items-center gap-1.5">${Icon('gem','w-4 h-4')} ${userPoints.toLocaleString()} total</div>`}
                ${isDaily ? `<div class="flex items-center gap-1.5">${Icon('flame','w-4 h-4')} ${userStreak}-day streak</div>` : ''}
                ${!isDaily && rank > 0 ? `<div class="flex items-center gap-1.5">${Icon('crown','w-4 h-4')} Rank #${rank}</div>` : ''}
              </div>
            </div>
            ${quizCoinResult ? liveMatchResultHTML() : ''}`;
        }

        function liveMatchResultHTML(){
          const opponent = quizOpponent || quizOpponentPool[0];
          const total = examTest.questions.length;
          const correct = examScore();
          const won = quizCoinResult === 'win';
          const headline = won ? 'You Won!' : `${escapeHtml(opponent.name)} Wins`;
          const bg = won ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)';
          const isFriend = opponent.id && quizFriends.some(f => f.id === opponent.id);
          return `
            <div class="rounded-3xl p-5 text-white mb-5" style="background:${bg};">
              <div class="flex items-center justify-between mb-3">
                <div class="font-bold text-lg font-display">${headline}</div>
                ${Icon(won ? 'trophy' : 'block', 'w-6 h-6')}
              </div>
              <div class="flex items-center justify-between text-sm mb-4">
                <div class="text-center flex-1">
                  <div class="font-bold text-2xl font-display">${correct}/${total}</div>
                  <div class="text-white/80 text-xs mt-0.5">You</div>
                </div>
                <div class="text-white/60 text-xs font-bold px-2">VS</div>
                <div class="text-center flex-1">
                  <div class="font-bold text-2xl font-display">${quizOpponentScore}/${total}</div>
                  <div class="text-white/80 text-xs mt-0.5 truncate">${escapeHtml(opponent.name)}</div>
                </div>
              </div>
              <div class="flex items-center justify-center gap-1.5 bg-white/15 rounded-2xl py-2.5 font-bold">
                ${Icon('coin','w-4 h-4')} ${quizCoinDelta >= 0 ? '+' : ''}${quizCoinDelta} coins ${Icon('coin','w-4 h-4 opacity-0')}
              </div>
              <button onclick="quizAddFriendFromResult()" class="w-full flex items-center justify-center gap-2 font-bold text-center py-2.5 rounded-2xl mt-3 ${isFriend ? 'opacity-60 pointer-events-none' : ''}" style="background:rgba(255,255,255,0.18);color:#fff;">${Icon('personPlus','w-4 h-4')} ${isFriend ? 'Added as Friend' : 'Add as Friend'}</button>
            </div>`;
        }

        function quizAddFriendFromResult(){
          quizAddFriend(quizOpponent);
          renderExamTake();
        }

        function challengeMatchResultHTML(){
          const total = examTest.questions.length;
          const correct = examScore();
          if (challengeOpponentScore === null) {
            return `
              <div class="rounded-3xl p-5 mb-5 text-center" style="background:rgba(65,105,225,0.08);">
                <div class="w-8 h-8 mx-auto mb-3" style="position:relative;">
                  <div style="position:absolute;inset:0;border-radius:9999px;background:conic-gradient(from 90deg, ${NAVY}, ${ROYAL} 45%, rgba(65,105,225,0.15) 45%, rgba(65,105,225,0.15) 100%);-webkit-mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));mask:radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));animation:classroom-spin 0.9s linear infinite;"></div>
                </div>
                <div class="font-bold text-gray-800 mb-1">Waiting for your friend to finish…</div>
                <div class="text-sm text-gray-500">Your score (${correct}/${total}) is locked in. We'll show who won as soon as they submit.</div>
              </div>`;
          }
          const won = correct > challengeOpponentScore;
          const tied = correct === challengeOpponentScore;
          const headline = tied ? "It's a Tie!" : (won ? 'You Won!' : 'Your Friend Wins');
          const bg = tied ? 'linear-gradient(135deg,#6b7280,#4b5563)' : (won ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)');
          return `
            <div class="rounded-3xl p-5 text-white mb-5" style="background:${bg};">
              <div class="flex items-center justify-between mb-3">
                <div class="font-bold text-lg font-display">${headline}</div>
                ${Icon(tied ? 'flag' : (won ? 'trophy' : 'block'), 'w-6 h-6')}
              </div>
              <div class="flex items-center justify-between text-sm">
                <div class="text-center flex-1">
                  <div class="font-bold text-2xl font-display">${correct}/${total}</div>
                  <div class="text-white/80 text-xs mt-0.5">You</div>
                </div>
                <div class="text-white/60 text-xs font-bold px-2">VS</div>
                <div class="text-center flex-1">
                  <div class="font-bold text-2xl font-display">${challengeOpponentScore}/${total}</div>
                  <div class="text-white/80 text-xs mt-0.5">Your Friend</div>
                </div>
              </div>
            </div>`;
        }

        function examResultOverviewHTML(){
          const total = examTest.questions.length;
          const correct = examScore();
          let wrong = 0, skipped = 0, grading = 0;
          examTest.questions.forEach((q, i) => {
            if (examAnswers[i] === undefined) { skipped++; return; }
            if (!isExamAnswerGraded(q, i)) { grading++; return; } 
            if (!isExamAnswerCorrect(q, i)) wrong++;
          });
          const accuracy = total ? Math.round((correct / total) * 100) : 0;
          const stat = (label, value, color) => `
            <div class="rounded-2xl p-4 text-center" style="background:rgba(65,105,225,0.06);">
              <div class="text-2xl font-extrabold" style="color:${color};">${value}</div>
              <div class="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wide">${label}</div>
            </div>`;
          return `
            ${grading ? `
              <div class="rounded-2xl p-3 mb-4 text-center text-sm font-semibold flex items-center justify-center gap-2" style="background:rgba(30,144,255,0.1);color:${NAVY};">
                ${Icon('bolt','w-4 h-4')} Grading ${grading} written answer${grading === 1 ? '' : 's'} against the marking scheme&hellip;
              </div>` : ''}
            <div class="grid grid-cols-2 gap-3">
              ${stat('Correct', correct, '#15803d')}
              ${stat('Incorrect', wrong, '#b91c1c')}
              ${stat('Skipped', skipped, '#6b7280')}
              ${stat('Accuracy', accuracy + '%', NAVY)}
            </div>`;
        }

        function examResultReviewHTML(){
          return examTest.questions.map((q, i) => {
            const selected = examAnswers[i];
            const isWritten = q.type === 'written';
            const skipped = selected === undefined;
            const graded = isExamAnswerGraded(q, i);
            const isCorrect = !skipped && graded && isExamAnswerCorrect(q, i);
            let badge, badgeText, answeredText;
            if (skipped) {
              badge = 'background:#f3f4f6;color:#6b7280;';
              badgeText = 'Skipped';
              answeredText = 'Skipped';
            } else if (isWritten && !graded) {
              badge = `background:rgba(65,105,225,0.1);color:${NAVY};`;
              badgeText = 'Grading…';
              answeredText = escapeHtml(selected);
            } else {
              badge = isCorrect ? 'background:rgba(21,128,61,0.12);color:#15803d;' : 'background:rgba(185,28,28,0.1);color:#b91c1c;';
              badgeText = isCorrect ? 'Correct' : 'Incorrect';
              answeredText = isWritten ? escapeHtml(selected) : escapeHtml(q.options[selected]);
            }
            const feedback = isWritten && graded && examWrittenGrades[i] ? examWrittenGrades[i].feedback : '';
            return `
              <div class="rounded-2xl border border-gray-100 p-4 mb-3">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="text-sm text-gray-900">${i + 1}. ${escapeHtml(q.text)}</div>
                  <div class="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full" style="${badge}">${badgeText}</div>
                </div>
                <div class="text-xs text-gray-500 mb-1">Your answer: <span class="font-semibold text-gray-700">${answeredText}</span></div>
                ${(!skipped && graded && !isCorrect) ? `<div class="text-xs text-gray-500">${isWritten ? 'Model answer' : 'Correct answer'}: <span class="font-semibold" style="color:#15803d;">${isWritten ? escapeHtml(q.answer || '') : escapeHtml(q.options[q.correct])}</span></div>` : ''}
                ${feedback ? `<div class="text-xs text-gray-400 mt-1">${escapeHtml(feedback)}</div>` : ''}
              </div>`;
          }).join('');
        }

        // ---- Exam exit confirmation modal ----
        function examExit(){
          const modal = document.getElementById('examExitModal');
          const msg = document.getElementById('examExitMessage');
          if (msg) {
            if (examContext === 'weeklyQuiz' && quizStake > 0) {
              msg.textContent = `Leaving now forfeits the match: you'll lose your ${quizStake} coin stake and your opponent wins.`;
            } else {
              const total = examTest ? examTest.questions.length : 0;
              const correct = examTest ? examScore() : 0;
              msg.textContent = `Your current score is ${correct}/${total}. Leaving now ends the test and locks in this score.`;
            }
          }
          if (modal) modal.classList.remove('hidden');
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeExamExitModal(fromPopState));
        }
        function closeExamExitModal(fromPopState){
          const modal = document.getElementById('examExitModal');
          if (modal) modal.classList.add('hidden');
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
        }
        function confirmExamExitYes(){
          closeExamExitModal();
          finishExam(true);
          renderExamTake();
        }

