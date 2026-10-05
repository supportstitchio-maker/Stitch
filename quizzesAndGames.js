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
            navigator.share({ title: 'Join my Stitch challenge', text: 'Join my challenge on Stitch. Code: ' + code + '\nOr tap to jump straight in:', url: link }).catch(() => {});
          } else {
            copyChallengeCode(code);
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

        function challengeCodeBoxHTML(code){
          return `
            <div class="rounded-2xl flex items-center justify-center gap-3 mb-5" style="padding:16px 14px;background:rgba(65,105,225,0.12); border:1px solid rgba(65,105,225,0.25);">
              <span class="font-display" style="font-size:1.75rem;font-weight:800;letter-spacing:.1em;color:${NAVY};">${escapeHtml(code)}</span>
              <button onclick="copyChallengeCode('${code}')" aria-label="Copy code" class="flex-shrink-0 p-2 rounded-full" style="color:${NAVY};background:rgba(65,105,225,0.14);">${Icon('copy','w-4 h-4')}</button>
            </div>`;
        }

        function inviteFriendHTML(code){
          return `
            ${challengeSheetHeader('Invite a friend to the Arena')}
            <div class="text-sm text-gray-500 mb-5">Share this code with a friend. They can enter it under Join with a Code, or open the link you send.</div>
            ${challengeCodeBoxHTML(code)}
            <button onclick="openChallengeSendPicker('${code}','invite')" class="sheet-pill w-full rounded-2xl text-center mb-3" style="padding-top:11px;padding-bottom:11px;">${Icon('send','w-4 h-4 inline-block mr-1 -mt-0.5')} Send</button>
            <button onclick="startWaitingForChallengeFriend('${code}')" class="sheet-pill w-full rounded-2xl text-center" style="padding-top:11px;padding-bottom:11px;">Start Now</button>`;
        }

        // ---- Send the challenge to people in your chats as a tappable card ----
        let challengeSendSelected = new Set();

        function challengeSendBack(code, from){
          if (from === 'waiting') return waitingForChallengeFriendHTML();
          if (from === 'created') return challengeCreatedHTML(code);
          return inviteFriendHTML(code);
        }

        function openChallengeSendPicker(code, from){
          challengeSendSelected = new Set();
          openChallengeModal(challengeSendPickerHTML(code, from));
        }

        function challengeSendPickerHTML(code, from){
          const contacts = (typeof shareContactsList === 'function') ? shareContactsList() : [];
          const rows = contacts.map(c => `
            <button id="ch-send-${c.id}" data-name="${escapeHtml((c.name || '').toLowerCase())}" onclick="toggleChallengeSendContact('${c.id}')" class="w-full flex items-center gap-3 text-left" style="padding:8px 4px;">
              <div class="w-11 h-11 ${c.avatarBg} rounded-full flex items-center justify-center text-gray-600 overflow-hidden flex-shrink-0">${avatarInnerHTML(c,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0 text-sm font-semibold truncate">${escapeHtml(c.name || '')}</div>
              <div class="ch-send-check flex items-center justify-center rounded-full flex-shrink-0" style="width:24px;height:24px;border:2px solid rgba(65,105,225,0.35);color:#fff;">${Icon('check','w-3 h-3')}</div>
            </button>`).join('');
          return `
            ${challengeSheetHeader('Send challenge', `challengeSendClose('${code}','${from}')`)}
            <div class="text-sm text-gray-500 mb-3">Pick people from your chats. They get a card they can tap to join.</div>
            ${contacts.length ? `
              <input id="ch-send-search" oninput="filterChallengeSendContacts()" placeholder="Search" class="w-full bg-gray-100 rounded-full text-sm mb-2" style="outline:none;padding:0.6rem 1rem;">
              <div id="ch-send-list" style="max-height:38vh;overflow-y:auto;-webkit-overflow-scrolling:touch;margin-bottom:12px;">${rows}</div>
              <div id="ch-send-empty" class="hidden text-center text-sm text-gray-400 py-4">No matches</div>` : `<div class="text-center text-sm text-gray-400 py-6">No chats yet.</div>`}
            <button id="ch-send-go" onclick="sendChallengeToSelected('${code}','${from}')" class="sheet-pill w-full rounded-2xl text-center mb-3" style="padding-top:11px;padding-bottom:11px;opacity:.55;pointer-events:none;">Send</button>
            <button onclick="shareChallengeLink('${code}')" class="sheet-pill w-full rounded-2xl text-center" style="padding-top:11px;padding-bottom:11px;">More apps</button>`;
        }

        function challengeSendClose(code, from){
          openChallengeModal(challengeSendBack(code, from));
        }

        function toggleChallengeSendContact(id){
          if (challengeSendSelected.has(id)) challengeSendSelected.delete(id); else challengeSendSelected.add(id);
          const on = challengeSendSelected.has(id);
          const row = document.getElementById('ch-send-' + id);
          const chk = row && row.querySelector('.ch-send-check');
          if (chk) { chk.style.background = on ? ROYAL : 'transparent'; chk.style.borderColor = on ? ROYAL : 'rgba(65,105,225,0.35)'; }
          const n = challengeSendSelected.size;
          const go = document.getElementById('ch-send-go');
          if (go) {
            go.textContent = n ? 'Send to ' + n + (n === 1 ? ' person' : ' people') : 'Send';
            go.style.opacity = n ? '1' : '.55';
            go.style.pointerEvents = n ? 'auto' : 'none';
          }
        }

        function filterChallengeSendContacts(){
          const input = document.getElementById('ch-send-search');
          const q = input ? input.value.trim().toLowerCase() : '';
          const list = document.getElementById('ch-send-list');
          const empty = document.getElementById('ch-send-empty');
          if (!list) return;
          let visible = 0;
          Array.from(list.children).forEach(r => {
            const match = !q || (r.dataset.name || '').includes(q);
            r.classList.toggle('hidden', !match);
            if (match) visible++;
          });
          if (empty) empty.classList.toggle('hidden', visible !== 0);
        }

        function sendChallengeToSelected(code, from){
          if (!challengeSendSelected.size) return;
          const invite = pendingChallengeInvites[code];
          const attachment = {
            type: 'stitch/challenge',
            name: '',
            code,
            timePerQ: invite ? invite.timePerQ : challengeConfig.timePerQ,
            fromName: (typeof profileData !== 'undefined' && profileData && profileData.name) || '',
          };
          const ids = Array.from(challengeSendSelected);
          ids.forEach(id => deliverSharedMessage(id, '', { attachments: [attachment], previewText: 'You sent a challenge invite' }));
          challengeSendSelected = new Set();
          pushInAppNotification('Sent', ids.length === 1 ? 'Challenge invite sent.' : 'Challenge invite sent to ' + ids.length + ' people.');
          openChallengeModal(challengeSendBack(code, from));
        }

        // Friend taps the card in chat
        function openChallengeFromChat(code){
          code = String(code || '').trim().toUpperCase();
          if (!code) return;
          if (pendingChallengeInvites[code] || (typeof waitingForChallengeFriendCode !== 'undefined' && waitingForChallengeFriendCode === code)) {
            pushInAppNotification('Your challenge', 'This is your own invite. It starts when your friend joins.');
            return;
          }
          joinChallengeByCode(code);
        }

        let waitingForChallengeFriendTimer = null;
        let waitingForChallengeFriendCode = null;

        function startWaitingForChallengeFriend(code){
          waitingForChallengeFriendCode = code;
          openChallengeModal(waitingForChallengeFriendHTML());
          clearInterval(waitingForChallengeFriendTimer);
          waitingForChallengeFriendTimer = setInterval(async () => {
            const invite = pendingChallengeInvites[code];
            if (waitingForChallengeFriendCode !== code) { clearInterval(waitingForChallengeFriendTimer); return; }
            let joined = !!(invite && invite.joined);
            let remote = null;
            if (!joined) {
              remote = await fetchChallengeInviteRemote(code);
              if (remote && remote.joined) joined = true;
            }
            if (joined) {
              clearInterval(waitingForChallengeFriendTimer);
              waitingForChallengeFriendTimer = null;
              const questions = invite ? invite.questions : (remote && remote.questions) || [];
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
              <div class="text-sm text-gray-500 mb-6">The challenge starts as soon as they join with your code or link.</div>
              <div class="w-full">${challengeCodeBoxHTML(waitingForChallengeFriendCode)}</div>
              <button onclick="openChallengeSendPicker('${waitingForChallengeFriendCode}','waiting')" class="sheet-pill w-full rounded-2xl text-center mb-3" style="padding-top:11px;padding-bottom:11px;">${Icon('send','w-4 h-4 inline-block mr-1 -mt-0.5')} Send</button>
              <button onclick="cancelWaitingForChallengeFriend()" class="sheet-pill w-full rounded-2xl text-center" style="padding-top:11px;padding-bottom:11px;">Cancel</button>
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
          examTest = { title: 'Challenge', questions };
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
        // Updates only what changed (option highlight, mark icon, palette, progress) instead of
        // rebuilding the whole page, so tapping an answer never blinks, replays the fade-in or
        // jumps the scroll position. Falls back to a full render if the layout doesn't line up.
        function examPatchInPlace(){
          if (examStage !== 'take' || examContext === 'weeklyQuiz' || examContext === 'dailyQuiz') { renderExamTake(true); return; }
          const ov = document.getElementById('overlay');
          const fresh = document.createElement('template');
          fresh.innerHTML = examTakeHTML();
          const curCard = ov && ov.querySelector('.ar-take > .ar-card.ar-fade');
          const newCard = fresh.content.querySelector('.ar-take > .ar-card.ar-fade');
          const curOpts = curCard ? curCard.querySelectorAll('.ar-opt') : [];
          const newOpts = newCard ? newCard.querySelectorAll('.ar-opt') : [];
          const curNums = ov ? ov.querySelectorAll('.ar-n') : [];
          const newNums = fresh.content.querySelectorAll('.ar-n');
          const curSide = ov && ov.querySelector('.ar-side');
          const newSide = fresh.content.querySelector('.ar-side');
          const curMark = curCard && curCard.querySelector('button[onclick="toggleExamMark()"]');
          const newMark = newCard && newCard.querySelector('button[onclick="toggleExamMark()"]');
          if (!curCard || !newCard || curOpts.length !== newOpts.length || curNums.length !== newNums.length
              || !curSide || !newSide || !curMark || !newMark) { renderExamTake(true); return; }
          curOpts.forEach((el, k) => { el.className = newOpts[k].className; });
          curNums.forEach((el, k) => { el.className = newNums[k].className; });
          curMark.className = newMark.className;
          curMark.setAttribute('style', newMark.getAttribute('style') || '');
          curMark.setAttribute('aria-label', newMark.getAttribute('aria-label') || '');
          curSide.innerHTML = newSide.innerHTML;
        }

        function toggleExamMark(){ examMarked[examQIndex] = !examMarked[examQIndex]; examPatchInPlace(); }
        function selectExamOption(i){ examAnswers[examQIndex] = i; examPatchInPlace(); }
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


        function examResultFooterHTML(){
          if (examContext === 'dailyQuiz') {
            return `<button onclick="openOverlay('gamification')" class="sheet-pill">Back to Games</button>`;
          }
          if (examContext === 'weeklyQuiz') {
            return `
              <button onclick="openOverlay('gamification')" class="sheet-pill">Back to Games</button>
              <button onclick="openWeeklyQuizJoin()" class="sheet-pill">Play Again</button>`;
          }
          return `
            <button onclick="closeOverlay()" class="sheet-pill">Close</button>
            <button onclick="startMockTest(examMode)" class="sheet-pill">Practice Again</button>`;
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


        function quizAddFriendFromResult(){
          quizAddFriend(quizOpponent);
          renderExamTake();
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

        // =====================================================================
        // ARENA REDESIGN: practice tests, challenges, exam taking, results & charts
        // Responsive (mobile-first, two-pane on >=1024px). Charts are inline SVG (CSP-safe).
        // =====================================================================
        (function injectArenaCss(){
          if (document.getElementById('ar-css')) return;
          const s = document.createElement('style');
          s.id = 'ar-css';
          s.textContent = `
          .ar-root{--bg:#f5f7fb;--card:#fff;--line:#e5e9f2;--tx:#0f172a;--sub:#64748b;--ok:#16a34a;--bad:#dc2626;--warn:#f59e0b;--pri:#1e90ff;--pri2:#4169e1;--soft:rgba(65,105,225,.08);color:var(--tx)}
          body.dark-mode .ar-root{--bg:#121212;--card:#1e1e1e;--line:#33373f;--tx:#f2f2f2;--sub:#9aa3b2;--soft:rgba(30,144,255,.16)}
          .ar-page{flex:1;overflow-y:auto;background:var(--bg)}
          .ar-in{max-width:1080px;margin:0 auto;padding:0 20px 28px}
          .ar-top{padding-top:var(--top-safe-pad);padding-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}
          .ar-top,.ar-top *{font-family:'Colmeak','Montserrat',sans-serif}
          .ar-title{font-weight:700;font-size:1.05rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .ar-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px}
          .ar-h{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);margin-bottom:12px}
          .ar-grid{display:grid;gap:14px}
          .ar-g2{grid-template-columns:1fr 1fr}
          .ar-g4{grid-template-columns:1fr 1fr}
          @media(min-width:1024px){.ar-foot{padding-left:32px;padding-right:32px}.ar-g4{grid-template-columns:repeat(4,1fr)}.ar-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.ar-in{padding:0 32px 36px}}
          .ar-btn{border-radius:999px;font-weight:700;font-size:.85rem;padding:.7rem 1.2rem;text-align:center;border:1px solid var(--line);background:var(--card);color:var(--tx)}
          .ar-btn.p{background:linear-gradient(135deg,var(--pri2),var(--pri));color:#fff;border:0;box-shadow:0 4px 14px rgba(65,105,225,.35)}
          .ar-btn[disabled]{opacity:.4;pointer-events:none}
          .ar-chip{border-radius:999px;padding:.45rem .9rem;font-size:.8rem;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--sub);white-space:nowrap}
          .ar-chip.on{border-color:var(--pri);background:var(--soft);color:var(--pri)}
          .ar-take{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
          .ar-side{display:none}
          @media(min-width:1024px){.ar-take{grid-template-columns:minmax(0,1fr) 300px;align-items:start}.ar-side{display:block;position:sticky;top:12px}.ar-strip{display:none!important}}
          .ar-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;scrollbar-width:none}
          .ar-strip::-webkit-scrollbar{display:none}
          .ar-n{flex:0 0 auto;width:34px;height:34px;border-radius:10px;font-weight:700;font-size:.8rem;display:flex;align-items:center;justify-content:center;background:rgba(148,163,184,.18);color:var(--sub);border:0}
          .ar-n.ans{background:var(--ok);color:#fff}.ar-n.mark{background:var(--bad);color:#fff}.ar-n.cur{background:var(--pri);color:#fff;box-shadow:0 0 0 3px rgba(30,144,255,.28)}
          .ar-pal{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.ar-pal .ar-n{width:auto;aspect-ratio:1}
          .ar-opt{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:14px;border-radius:16px;border:1.5px solid var(--line);background:var(--card);color:var(--tx);margin-bottom:10px;transition:border-color .15s,background .15s}
          .ar-opt .l{flex:0 0 28px;height:28px;border-radius:9px;background:rgba(148,163,184,.18);font-weight:800;font-size:.8rem;display:flex;align-items:center;justify-content:center}
          .ar-opt.on{border-color:var(--pri);background:var(--soft)}.ar-opt.on .l{background:var(--pri);color:#fff}
          .ar-opt.ok{border-color:var(--ok);background:rgba(22,163,74,.1)}.ar-opt.ok .l{background:var(--ok);color:#fff}
          .ar-opt.no{border-color:var(--bad);background:rgba(220,38,38,.08)}.ar-opt.no .l{background:var(--bad);color:#fff}
          .ar-bar{height:10px;border-radius:99px;background:rgba(148,163,184,.2);overflow:hidden}.ar-bar>i{display:block;height:100%;border-radius:99px}
          .ar-end{display:flex;gap:10px;align-items:center;margin-top:20px;padding-bottom:calc(env(safe-area-inset-bottom,8px) + 12px)}
          .ar-end .sheet-pill{flex:1;padding:.75rem 0;font-size:.85rem;border-radius:9999px;text-align:center}
          .ar-chips-row{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-x;overscroll-behavior-x:contain;scrollbar-width:none;margin-bottom:20px;padding:2px 0}
          .ar-chips-row::-webkit-scrollbar{display:none}
          .ar-chips-row .ar-chip{flex:0 0 auto}
          .ar-foot{flex-shrink:0;border-top:1px solid var(--line);background:var(--card);padding:10px 20px calc(env(safe-area-inset-bottom,8px) + 10px)}
          .ar-foot-in{max-width:1080px;margin:0 auto;display:flex;gap:10px;align-items:center;justify-content:space-between}
          .ar-timer{font-weight:800;font-variant-numeric:tabular-nums;color:var(--pri);background:var(--soft);border-radius:999px;padding:.35rem .8rem;font-size:.95rem}
          .ar-pod{display:flex;align-items:flex-end;justify-content:center;gap:10px;height:190px}
          .ar-pod>div{flex:1;max-width:120px;border-radius:16px 16px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:10px;color:#fff;font-weight:800}
          .ar-vs{border-radius:24px;padding:20px;color:#fff}
          .ar-fade{animation:arIn .35s ease both}@keyframes arIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
          `;
          document.head.appendChild(s);
        })();

        // ---- Chart helpers (inline SVG / CSS) ----
        function arDonut(parts, big, small){
          const R = 52, C = 2 * Math.PI * R, tot = parts.reduce((a, p) => a + p.v, 0);
          let off = 0;
          const segs = tot ? parts.filter(p => p.v > 0).map(p => {
            const len = p.v / tot * C;
            const el = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${p.c}" stroke-width="15" stroke-dasharray="${Math.max(len - 2, 0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)" stroke-linecap="round"/>`;
            off += len; return el;
          }).join('') : '';
          return `<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="${escapeHtml(big)} ${escapeHtml(small || '')}">
            <circle cx="70" cy="70" r="${R}" fill="none" stroke="rgba(148,163,184,.22)" stroke-width="15"/>${segs}
            <text x="70" y="70" text-anchor="middle" font-size="28" font-weight="800" fill="currentColor">${escapeHtml(big)}</text>
            <text x="70" y="90" text-anchor="middle" font-size="10" font-weight="700" fill="#94a3b8">${escapeHtml(small || '')}</text></svg>`;
        }

        function arLine(vals, labels){
          const W = 340, H = 150, px = 28, py = 14, n = vals.length;
          if (!n) return '';
          const x = i => n === 1 ? W / 2 : px + i * (W - px * 2) / (n - 1);
          const y = v => H - py - (v / 100) * (H - py * 2);
          const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
          const grid = [0, 50, 100].map(g => `<line x1="${px}" x2="${W - px}" y1="${y(g)}" y2="${y(g)}" stroke="rgba(148,163,184,.3)" stroke-dasharray="3 4"/><text x="${px - 6}" y="${y(g) + 3}" text-anchor="end" font-size="9" fill="#94a3b8">${g}</text>`).join('');
          const dots = vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="#fff" stroke="#1e90ff" stroke-width="2.5"><title>${escapeHtml(labels[i] || '')}: ${v}%</title></circle>`).join('');
          return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Accuracy trend">
            <defs><linearGradient id="arLg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e90ff" stop-opacity=".25"/><stop offset="1" stop-color="#1e90ff" stop-opacity="0"/></linearGradient></defs>${grid}
            ${n > 1 ? `<polygon points="${x(0)},${H - py} ${pts} ${x(n - 1)},${H - py}" fill="url(#arLg)"/><polyline points="${pts}" fill="none" stroke="#1e90ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ''}${dots}</svg>`;
        }

        function arBars(items){
          return items.map(it => `
            <div class="mb-3">
              <div class="flex items-center justify-between gap-2 text-sm mb-1"><span class="truncate font-semibold">${escapeHtml(it.label)}</span><span style="color:var(--sub);font-weight:700;flex-shrink:0;">${it.text}</span></div>
              <div class="ar-bar"><i style="width:${Math.max(0, Math.min(100, it.pct))}%;background:${it.color}"></i></div>
            </div>`).join('');
        }

        function arStatTile(label, value, color){
          return `<div class="ar-card" style="padding:14px;text-align:center;"><div style="font-size:1.7rem;font-weight:800;color:${color};line-height:1.1;">${value}</div><div class="ar-h" style="margin:6px 0 0;">${label}</div></div>`;
        }

        function arTopicStats(){
          const m = {};
          examTest.questions.forEach((q, i) => {
            const k = q.meta || 'General';
            m[k] = m[k] || { c: 0, n: 0 };
            m[k].n++;
            if (isExamAnswerCorrect(q, i)) m[k].c++;
          });
          return Object.keys(m).map(k => ({ name: k, c: m[k].c, n: m[k].n, pct: Math.round(m[k].c / m[k].n * 100) })).sort((a, b) => b.pct - a.pct);
        }

        function arBack(action){ return `<button onclick="${action}" class="flex items-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>`; }

        // ---- Practice tests overlay ----
        function practiceTestsHTML(){
          return `
            <div class="ar-root ar-page"><div class="ar-in">
              <div class="ar-top">${arBack('closeOverlay()')}<div class="ar-title grad-text">Practice Tests</div></div>
              <div class="flex gap-2 mb-4">${practiceTestsTabBtn('test','Mock Test')}${practiceTestsTabBtn('score','Score & Progress')}</div>
              <div class="ar-fade">${practiceTestsTab === 'test' ? practiceTestsTestPane() : practiceTestsScorePane()}</div>
            </div></div>`;
        }

        function practiceTestsScorePane(){
          const h = mockTestScoreHistory;
          if (!h.length) return `<div class="ar-root ar-card text-center" style="padding:48px 20px;color:var(--sub);">No completed mock tests yet.<br>Finish one to see your progress here.</div>`;
          const acc = r => r.total ? Math.round(r.correct / r.total * 100) : 0;
          const recent = h.slice(0, 10).reverse();
          const avg = Math.round(h.reduce((a, r) => a + acc(r), 0) / h.length);
          const best = Math.max(...h.map(acc));
          const last = h[0], prev = h[1];
          const delta = prev ? acc(last) - acc(prev) : null;
          return `<div class="ar-root">
            <div class="ar-grid ar-g4 mb-3">
              ${arStatTile('Latest', acc(last) + '%', acc(last) >= 70 ? '#16a34a' : '#dc2626')}
              ${arStatTile('Average', avg + '%', '#1e90ff')}
              ${arStatTile('Best', best + '%', '#f59e0b')}
              ${arStatTile('Tests taken', h.length, '#4169e1')}
            </div>
            <div class="ar-cols">
              <div class="ar-card mb-3">
                <div class="ar-h">Accuracy trend · last ${recent.length}</div>
                ${arLine(recent.map(acc), recent.map(r => r.title))}
                ${delta === null ? '' : `<div class="text-sm mt-2" style="color:${delta >= 0 ? '#16a34a' : '#dc2626'};font-weight:700;">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} pts vs your previous test</div>`}
              </div>
              <div class="ar-card mb-3">
                <div class="ar-h">Recent scores</div>
                ${arBars(h.slice(0, 6).map(r => ({ label: r.title + ' · ' + formatScoreHistoryDate(r.date), pct: acc(r), text: r.correct + '/' + r.total, color: acc(r) >= 70 ? '#16a34a' : acc(r) >= 40 ? '#f59e0b' : '#dc2626' })))}
              </div>
            </div>
            ${h.length > 6 ? `<div class="ar-h">Older</div><div class="space-y-2.5">${h.slice(6, 26).map(scoreHistoryRowHTML).join('')}</div>` : ''}
          </div>`;
        }

        // ---- Challenge setup / lobby ----
        function challengeTimeNote(t){
          return t === 'No limit' ? 'Relaxed round: take as long as you need.' : 'Fast round: unanswered questions move on after ' + t + '.';
        }
        // Updates the selection in place so the sheet never re-renders or jumps
        function setChallengeTimePill(btn){
          const t = btn.getAttribute('data-t');
          challengeConfig.timePerQ = t;
          const row = document.getElementById('challenge-time-row');
          if (row) row.querySelectorAll('.ar-chip').forEach(b => b.classList.toggle('on', b === btn));
          const note = document.getElementById('challenge-time-note');
          if (note) note.textContent = challengeTimeNote(t);
        }
        function challengeSetupHTML(){
          const q = Math.min(buildChallengeQuestionPool().length, 99);
          return `
            <div class="ar-root" style="color:var(--tx)">
            ${challengeSheetHeader('Set Up a Challenge')}
            <div class="text-sm text-gray-500 mb-4">Questions are pulled from all your uploaded resources (${q} ready). Pick a pace, then share the code with your class.</div>
            <div class="ar-h">Time per question</div>
            <div class="ar-chips-row" id="challenge-time-row">${challengeTimeOptions.map(t => `<button class="ar-chip ${t === challengeConfig.timePerQ ? 'on' : ''}" data-t="${t}" onclick="setChallengeTimePill(this)">${t}</button>`).join('')}</div>
            <div class="ar-card mb-5" style="padding:14px;background:var(--soft);border:0;">
              <div class="flex items-center gap-2 text-sm font-semibold">${Icon('bolt','w-4 h-4')} <span id="challenge-time-note">${challengeTimeNote(challengeConfig.timePerQ)}</span></div>
            </div>
            <div class="flex gap-3">
              <button onclick="closeChallengeModal()" class="ar-btn flex-1">Cancel</button>
              <button onclick="submitCreateChallenge()" class="ar-btn p flex-1">Create</button>
            </div></div>`;
        }

        function submitCreateChallenge(){
          const questions = buildChallengeQuestionPool();
          if (!questions.length) {
            pushInAppNotification('No questions yet', 'Upload a resource to create a challenge.');
            closeChallengeModal();
            return;
          }
          const code = generateChallengeCode();
          pendingChallengeInvites[code] = { subject: 'All Resources', timePerQ: challengeConfig.timePerQ, questions, joined: false };
          insertChallengeInviteRemote(code, 'All Resources', challengeConfig.timePerQ, questions);
          openChallengeModal(challengeCreatedHTML(code));
        }

        function challengeCreatedHTML(code){
          return `
            <div class="ar-root">
            ${challengeSheetHeader('Challenge created!')}
            <div class="text-sm text-gray-500 mb-4">Share this code with whoever you want to challenge, then start whenever you're ready.</div>
            <div class="ar-card text-center mb-4" style="background:var(--soft);border:0;">
              <div class="ar-h" style="margin-bottom:6px;">Challenge code</div>
              <div class="flex items-center justify-center gap-2" style="font-size:2rem;font-weight:800;letter-spacing:.08em;color:var(--pri);"><span>${code}</span>
                <button onclick="copyChallengeCode('${code}')" class="p-2 rounded-full" style="background:rgba(65,105,225,.14);color:var(--pri);">${Icon('copy','w-4 h-4')}</button></div>
              <div class="text-xs mt-2" style="color:var(--sub);">${challengeConfig.timePerQ === 'No limit' ? 'No time limit' : challengeConfig.timePerQ + ' per question'}</div>
            </div>
            <div class="flex gap-3 mb-3">
              <button onclick="openChallengeSendPicker('${code}','created')" class="ar-btn flex-1">${Icon('send','w-4 h-4 inline-block mr-1 -mt-0.5')} Send</button>
              <button onclick="copyChallengeLink('${code}')" class="ar-btn flex-1">${Icon('link','w-4 h-4 inline-block mr-1 -mt-0.5')} Copy link</button>
            </div>
            <button onclick="startWaitingForChallengeFriend('${code}')" class="ar-btn p w-full">Wait for Friend &amp; Start</button></div>`;
        }

        // ---- Exam taking (mock test + challenge). Quiz board contexts keep their own UI ----
        function arPaletteState(i){
          if (i === examQIndex) return 'cur';
          if (examMarked[i]) return 'mark';
          return examAnswers[i] !== undefined ? 'ans' : '';
        }
        function arNums(cls){
          return examTest.questions.map((_, i) => `<button class="ar-n ${arPaletteState(i)}" onclick="examJumpTo(${i})" aria-label="Question ${i + 1}">${i + 1}</button>`).join('');
        }

        function examTakeHTML(){
          if (examContext === 'weeklyQuiz' || examContext === 'dailyQuiz') {
            return examCardOpenIndex === null ? weeklyQuizBoardHTML() : weeklyQuizCardHTML(examCardOpenIndex);
          }
          const q = examTest.questions[examQIndex];
          const total = examTest.questions.length;
          const sel = examAnswers[examQIndex];
          const answered = Object.keys(examAnswers).length;
          const marked = Object.keys(examMarked).filter(k => examMarked[k]).length;
          const isChallenge = examContext === 'challenge';
          const opts = q.type === 'written' ? writtenAnswerInputHTML(q, examQIndex, sel)
            : q.options.map((o, i) => `<button onclick="selectExamOption(${i})" class="ar-opt ${sel === i ? 'on' : ''}"><span class="l">${String.fromCharCode(65 + i)}</span><span class="text-base">${escapeHtml(o)}</span></button>`).join('');
          const legend = (c, t) => `<span class="inline-flex items-center gap-1.5 text-xs" style="color:var(--sub);font-weight:600;"><i style="width:10px;height:10px;border-radius:3px;background:${c};display:inline-block"></i>${t}</span>`;
          return `
            <div class="ar-root ar-page" id="exam-scroll-container"><div class="ar-in">
              <div class="ar-top">
                <div class="flex items-center gap-3 min-w-0"><button onclick="examExit()" class="text-sm font-semibold" style="color:#dc2626;">Exit</button><div class="ar-title">${escapeHtml(examTest.title)}</div></div>
                ${examMode === 'timed' ? `<div class="flex items-center gap-2">${examTimerHidden ? '' : `<span class="ar-timer" id="exam-timer-display">${formatExamTime(examTimeLeft)}</span>`}<button onclick="toggleExamTimerHidden()" class="ar-chip" style="padding:.3rem .7rem;">${examTimerHidden ? 'Show' : 'Hide'}</button></div>` : `<span class="ar-chip on">Self-paced</span>`}
              </div>
              <div class="ar-strip">${arNums()}</div>
              <div class="ar-take">
                <div class="ar-card ar-fade" key="${examQIndex}">
                  <div class="flex items-center justify-between gap-2 mb-3">
                    <span class="ar-h" style="margin:0;color:var(--pri);">Question ${examQIndex + 1} of ${total}</span>
                    <button onclick="toggleExamMark()" aria-label="${examMarked[examQIndex] ? 'Unmark for review' : 'Mark for review'}" class="ar-chip ${examMarked[examQIndex] ? 'on' : ''}" style="padding:.45rem .6rem;line-height:0;${examMarked[examQIndex] ? 'color:#dc2626;border-color:#dc2626;background:rgba(220,38,38,.08);' : ''}">${Icon('bookmark','w-4 h-4 inline-block')}</button>
                  </div>
                  <div class="ar-bar mb-4"><i style="width:${Math.round((examQIndex + 1) / total * 100)}%;background:linear-gradient(90deg,#4169e1,#1e90ff)"></i></div>
                  <div class="text-lg font-semibold leading-snug mb-5">${escapeHtml(q.text)}</div>
                  ${opts}
                  <div class="text-xs mt-1" style="color:#b91c1c;font-weight:600;">${Icon('alertTriangle','w-3.5 h-3.5 inline-block mr-1 -mt-0.5')}Stay on this tab. Leaving ends the ${isChallenge ? 'challenge' : 'test'} and locks in your score.</div>
                </div>
                <aside class="ar-side ar-card">
                  <div class="ar-h">${isChallenge ? 'Challenge' : 'Mock test'} progress</div>
                  <div class="flex items-center justify-between text-sm mb-1"><b>${answered}/${total}</b><span style="color:var(--sub)">answered</span></div>
                  <div class="ar-bar mb-4"><i style="width:${Math.round(answered / total * 100)}%;background:var(--ok)"></i></div>
                  <div class="ar-pal mb-4">${arNums()}</div>
                  <div style="display:flex;flex-wrap:wrap;gap:8px 14px;margin-bottom:12px;">${legend('#1e90ff','Current')}${legend('#16a34a','Answered')}${legend('#dc2626','Marked')}${legend('rgba(148,163,184,.5)','Not attempted')}</div>
                  <div class="text-xs" style="color:var(--sub)">${marked} marked for review · ${total - answered} unanswered</div>
                </aside>
              </div>
            </div>
            </div>
            <div class="ar-root ar-foot"><div class="ar-foot-in">
              <button onclick="examGoBack()" class="ar-btn ${examQIndex === 0 ? 'opacity-40 pointer-events-none' : ''}">Back</button>
              <span class="text-sm font-bold" style="color:var(--sub)">${examQIndex + 1} / ${total}</span>
              <button onclick="examGoNext(false)" class="ar-btn p">${examQIndex === total - 1 ? 'Submit test' : 'Next'}</button>
            </div></div>`;
        }

        // ---- Results ----
        let examReviewFilter = 'all';
        function setExamReviewFilter(f){ examReviewFilter = f; renderExamTake(true); }

        function arOutcome(q, i){
          if (examAnswers[i] === undefined) return 'skip';
          if (!isExamAnswerGraded(q, i)) return 'grading';
          return isExamAnswerCorrect(q, i) ? 'ok' : 'bad';
        }

        function examResultHTML(){
          const total = examTest.questions.length;
          const correct = examScore();
          const pct = total ? Math.round(correct / total * 100) : 0;
          const isQuiz = examContext === 'dailyQuiz' || examContext === 'weeklyQuiz';
          const isChallengeVsFriend = examContext === 'challenge' && !!activeChallengeCode;
          const tab = (k, l) => `<button onclick="switchExamResultTab('${k}')" class="ar-chip ${examResultTab === k ? 'on' : ''}" style="flex:1;padding:.6rem;">${l}</button>`;
          return `
            <div class="ar-root ar-page" id="exam-scroll-container"><div class="ar-in">
              <div class="ar-top">${arBack(isQuiz ? "openOverlay('gamification')" : 'closeOverlay()')}<div class="ar-title grad-text">${escapeHtml(examTest.title)}</div></div>
              <div class="ar-fade">
                ${isQuiz ? quizRewardBannerHTML() : ''}
                ${isChallengeVsFriend ? challengeMatchResultHTML() : ''}
                <div class="flex gap-2 mb-4">${tab('overview','Overview')}${tab('review','Review answers')}</div>
                ${examResultTab === 'overview' ? examResultOverviewHTML() : examResultReviewHTML()}
              </div>
              <div class="ar-end">${examResultFooterHTML()}</div>
            </div></div>`;
        }

        function examResultOverviewHTML(){
          const qs = examTest.questions, total = qs.length, correct = examScore();
          const c = { ok: 0, bad: 0, skip: 0, grading: 0 };
          qs.forEach((q, i) => c[arOutcome(q, i)]++);
          const pct = total ? Math.round(correct / total * 100) : 0;
          const verdict = pct >= 85 ? 'Outstanding work' : pct >= 70 ? 'Solid performance' : pct >= 40 ? 'Getting there' : 'Keep practising';
          const topics = arTopicStats();
          const weakest = topics.length > 1 ? topics[topics.length - 1] : null;
          const prev = examContext === 'test' ? mockTestScoreHistory[1] : null;
          const hist = examContext === 'test' ? mockTestScoreHistory.slice(0, 8).reverse() : [];
          return `
            ${c.grading ? `<div class="ar-card mb-3 text-center text-sm font-semibold" style="background:var(--soft);border:0;">${Icon('bolt','w-4 h-4 inline-block mr-1 -mt-0.5')} Grading ${c.grading} written answer${c.grading === 1 ? '' : 's'}&hellip;</div>` : ''}
            <div class="ar-card mb-3 flex items-center gap-5 flex-wrap justify-center">
              ${arDonut([{ v: c.ok, c: '#16a34a' }, { v: c.bad, c: '#dc2626' }, { v: c.skip + c.grading, c: '#94a3b8' }], pct + '%', correct + ' / ' + total)}
              <div style="min-width:180px;flex:1;">
                <div class="text-xl font-bold mb-1">${verdict}</div>
                <div class="text-sm mb-3" style="color:var(--sub)">You answered ${total - c.skip} of ${total} questions.${prev ? ` Previous test: ${prev.total ? Math.round(prev.correct / prev.total * 100) : 0}%.` : ''}</div>
                ${weakest ? `<div class="text-sm" style="color:var(--sub)">Focus next on <b style="color:var(--tx)">${escapeHtml(weakest.name)}</b> (${weakest.pct}%).</div>` : ''}
              </div>
            </div>
            <div class="ar-grid ar-g4 mb-3">${arStatTile('Correct', c.ok, '#16a34a')}${arStatTile('Incorrect', c.bad, '#dc2626')}${arStatTile('Skipped', c.skip, '#64748b')}${arStatTile('Accuracy', pct + '%', '#1e90ff')}</div>
            <div class="ar-cols">
              <div class="ar-card mb-3"><div class="ar-h">Score by topic</div>${arBars(topics.map(t => ({ label: t.name, pct: t.pct, text: t.c + '/' + t.n, color: t.pct >= 70 ? '#16a34a' : t.pct >= 40 ? '#f59e0b' : '#dc2626' })))}</div>
              <div class="ar-card mb-3"><div class="ar-h">Question map</div>
                <div class="ar-pal">${qs.map((q, i) => { const o = arOutcome(q, i); return `<button class="ar-n" style="${o === 'ok' ? 'background:#16a34a;color:#fff' : o === 'bad' ? 'background:#dc2626;color:#fff' : ''}" onclick="examReviewFilter='all';examResultTab='review';renderExamTake();setTimeout(()=>{const e=document.getElementById('ar-q-${i}');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},60)">${i + 1}</button>`; }).join('')}</div>
                ${hist.length > 1 ? `<div class="ar-h" style="margin-top:16px;">Your trend</div>${arLine(hist.map(r => r.total ? Math.round(r.correct / r.total * 100) : 0), hist.map(r => r.title))}` : ''}
              </div>
            </div>`;
        }

        function examResultReviewHTML(){
          const qs = examTest.questions;
          const f = examReviewFilter;
          const keep = (q, i) => f === 'all' || (f === 'bad' && arOutcome(q, i) === 'bad') || (f === 'skip' && arOutcome(q, i) === 'skip') || (f === 'mark' && examMarked[i]);
          const chip = (k, l) => `<button class="ar-chip ${f === k ? 'on' : ''}" onclick="setExamReviewFilter('${k}')">${l}</button>`;
          const cards = qs.map((q, i) => {
            if (!keep(q, i)) return '';
            const o = arOutcome(q, i), sel = examAnswers[i], written = q.type === 'written';
            const badge = { ok: ['Correct', '#16a34a'], bad: ['Incorrect', '#dc2626'], skip: ['Skipped', '#64748b'], grading: ['Grading…', '#1e90ff'] }[o];
            const fb = written && examWrittenGrades[i] ? examWrittenGrades[i].feedback : '';
            const body = written
              ? `<div class="text-sm mb-1" style="color:var(--sub)">Your answer: <b style="color:var(--tx)">${sel === undefined ? 'Skipped' : escapeHtml(sel)}</b></div>${o === 'bad' || o === 'skip' ? `<div class="text-sm" style="color:#16a34a">Model answer: <b>${escapeHtml(q.answer || '')}</b></div>` : ''}${fb ? `<div class="text-xs mt-1" style="color:var(--sub)">${escapeHtml(fb)}</div>` : ''}`
              : q.options.map((opt, oi) => `<div class="ar-opt ${oi === q.correct ? 'ok' : (oi === sel ? 'no' : '')}" style="margin-bottom:10px;padding:12px 14px;"><span class="l">${String.fromCharCode(65 + oi)}</span><span class="text-sm flex-1">${escapeHtml(opt)}</span></div>`).join('');
            return `<div class="ar-card mb-3" id="ar-q-${i}"><div class="flex items-start justify-between gap-4 mb-4"><div class="text-sm font-semibold" style="min-width:0;line-height:1.45;">${i + 1}. ${escapeHtml(q.text)}</div><span class="flex-shrink-0 text-xs font-bold rounded-full" style="padding:6px 14px;margin-top:-2px;white-space:nowrap;background:${badge[1]}1f;color:${badge[1]}">${badge[0]}</span></div>${body}${examMarked[i] ? `<div class="text-xs mt-1" style="color:#dc2626;font-weight:700">Marked for review</div>` : ''}</div>`;
          }).join('');
          return `<div class="flex gap-2 mb-3 flex-wrap">${chip('all','All')}${chip('bad','Incorrect')}${chip('skip','Skipped')}${chip('mark','Marked')}</div>${cards || '<div class="ar-card text-center" style="color:var(--sub)">Nothing here. Nice.</div>'}`;
        }

        // ---- Winner / head-to-head cards ----
        function arVsHTML(opts){
          const { me, opp, total, oppName, bg, headline, icon, extra } = opts;
          const sum = Math.max(me + opp, 1);
          return `
            <div class="ar-vs ar-fade mb-4" style="background:${bg};">
              <div class="flex items-center justify-between mb-4"><div class="font-bold text-xl font-display">${headline}</div>${Icon(icon, 'w-7 h-7')}</div>
              <div class="flex items-center justify-between mb-3">
                <div class="text-center flex-1"><div style="font-size:2.2rem;font-weight:800;line-height:1">${me}<span style="font-size:1rem;opacity:.7">/${total}</span></div><div class="text-xs opacity-80 mt-1">You</div></div>
                <div class="text-xs font-bold opacity-70 px-2">VS</div>
                <div class="text-center flex-1"><div style="font-size:2.2rem;font-weight:800;line-height:1">${opp}<span style="font-size:1rem;opacity:.7">/${total}</span></div><div class="text-xs opacity-80 mt-1 truncate">${escapeHtml(oppName)}</div></div>
              </div>
              <div style="display:flex;height:10px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.2)"><i style="width:${me / sum * 100}%;background:#fff"></i><i style="width:${opp / sum * 100}%;background:rgba(255,255,255,.45)"></i></div>
              ${extra || ''}
            </div>`;
        }

        function liveMatchResultHTML(){
          const opponent = quizOpponent || quizOpponentPool[0];
          const total = examTest.questions.length, correct = examScore();
          const won = quizCoinResult === 'win';
          const isFriend = opponent.id && quizFriends.some(f => f.id === opponent.id);
          return arVsHTML({
            me: correct, opp: quizOpponentScore, total, oppName: opponent.name, icon: won ? 'trophy' : 'block',
            headline: won ? 'You Won!' : `${escapeHtml(opponent.name)} Wins`,
            bg: won ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
            extra: `<div class="flex items-center justify-center gap-1.5 rounded-2xl py-2.5 font-bold mt-4" style="background:rgba(255,255,255,.16)">${Icon('coin','w-4 h-4')} ${quizCoinDelta >= 0 ? '+' : ''}${quizCoinDelta} coins</div>
              <button onclick="quizAddFriendFromResult()" class="w-full flex items-center justify-center gap-2 font-bold py-2.5 rounded-2xl mt-3 ${isFriend ? 'opacity-60 pointer-events-none' : ''}" style="background:rgba(255,255,255,.18);color:#fff;">${Icon('personPlus','w-4 h-4')} ${isFriend ? 'Added as Friend' : 'Add as Friend'}</button>`
          });
        }

        function challengeMatchResultHTML(){
          const total = examTest.questions.length, correct = examScore();
          if (challengeOpponentScore === null) {
            return `<div class="ar-card mb-4 text-center" style="background:var(--soft);border:0;">
              <div class="font-bold mb-1">Waiting for your friend to finish…</div>
              <div class="text-sm" style="color:var(--sub)">Your score (${correct}/${total}) is locked in. We'll reveal the winner as soon as they submit.</div>
              <div class="ar-bar mt-3"><i style="width:40%;background:linear-gradient(90deg,#4169e1,#1e90ff);animation:arIn 1s ease infinite alternate"></i></div></div>`;
          }
          const won = correct > challengeOpponentScore, tied = correct === challengeOpponentScore;
          return arVsHTML({
            me: correct, opp: challengeOpponentScore, total, oppName: 'Your Friend',
            headline: tied ? "It's a Tie!" : (won ? 'You Won!' : 'Your Friend Wins'), icon: tied ? 'flag' : (won ? 'trophy' : 'block'),
            bg: tied ? 'linear-gradient(135deg,#6b7280,#4b5563)' : (won ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)')
          });
        }
