const overlayBackKinds = ['discover', 'create', 'tagPeoplePicker', 'aiClass', 'conversation', 'addToCall', 'incomingCall', 'incomingLectureCall', 'joinClassroom', 'createClassroom', 'classDetail', 'inviteStudents', 'newAnnouncement', 'scheduleLecture', 'classworkCreateMenu', 'newClasswork', 'newQuiz', 'newPoll', 'classworkDetail', 'classSettings', 'studyTimetable', 'studyReminders', 'classAnnouncements', 'classNotifications', 'gamification', 'profileMenu', 'profileQR', 'newMessage', 'myContacts', 'newCollaboration', 'profileAnalytics', 'careerAnalytics', 'notifications', 'notificationSettings', 'savedItems', 'blockedAccounts', 'referrals', 'termsOfService', 'privacyPolicy', 'helpCenter', 'contactUs', 'reportIssue', 'practiceTests', 'examTake', 'jobDetail', 'jobApply', 'postOpportunity', 'courseDetail', 'courseItemDetail', 'courseEnroll', 'courseTeachers', 'newCourse', 'personProfile', 'personNetwork', 'postFeed', 'careerStart', 'careerMatches', 'careerMatching'];
        const overlayBackAction = {
          call: (fromPopState) => minimizeCall(fromPopState),
          addToCall: () => returnToCallScreen(),
          incomingCall: (fromPopState) => declineIncomingCall(false, fromPopState),
          incomingLectureCall: (fromPopState) => declineIncomingLectureCall(fromPopState),
          lectureCall: () => endLecture(),
          newCourse: (fromPopState) => closeCourseEditorGuard(fromPopState),
          examTake: (fromPopState) => {
            if (typeof examStage !== 'undefined' && examStage === 'result') { closeOverlay(fromPopState); return; }
            if (typeof examExit === 'function') examExit(true);
            else closeOverlay(fromPopState);
          },
          careerStart: (fromPopState) => careerStartBack(fromPopState),
          careerMatching: (fromPopState) => { if (typeof clearCareerMatchingTimers === 'function') clearCareerMatchingTimers(); closeOverlay(fromPopState); },
          conversation: (fromPopState) => { if (typeof closeConversationOverlay === 'function') closeConversationOverlay(fromPopState); else closeOverlay(fromPopState); },
        };
        const modalBackStack = [];
        // ---- Modal back-button (history) handling ----
        function pushModalBackHandler(closeFn){
          modalBackStack.push(closeFn);
          history.pushState({ stitchModal: modalBackStack.length }, '');
        }
        let suppressNextPopstate = false;
        function popModalBackHandler(fromPopState){
          if (!modalBackStack.length) return;
          modalBackStack.pop();
          if (!fromPopState) {
            suppressNextPopstate = true;
            history.back();
          }
        }

        function teardownPaystackPopup(fromPopState){
          popModalBackHandler(fromPopState);
          document.querySelectorAll('iframe[src*="paystack"], iframe[name*="paystack"]').forEach(iframe => {
            const wrapper = iframe.parentElement;
            (wrapper && wrapper !== document.body ? wrapper : iframe).remove();
          });
        }

        let overlayHistoryPushed = false;

        let gamificationMenuOpen = false;
        let gameProfileAvatar = null;
        let gamingAvatarPickerOpen = false;
        // ---- Gaming profile (username/avatar/ID) ----
        function generateGameUniqueId(){
          const seg = n => Math.floor(Math.random() * Math.pow(10, n)).toString().padStart(n, '0');
          return `${seg(3)}-${seg(3)}-${seg(3)}-${seg(1)}`;
        }
        let gameUniqueId = generateGameUniqueId();
        let noticeBoardMenuOpen = false;
        let joinClassMenuOpen = false;
        let createClassMenuOpen = false;

        function toggleGamificationMenu(){
          gamificationMenuOpen = !gamificationMenuOpen;
          document.getElementById('overlay').innerHTML = gamificationHTML();
        }
        function openGameProfile(){
          gamificationSubView = 'profile';
          gamingAvatarPickerOpen = false;
          document.getElementById('overlay').innerHTML = gamificationHTML();
        }
        function toggleGamingAvatarPicker(){
          gamingAvatarPickerOpen = !gamingAvatarPickerOpen;
          document.getElementById('overlay').innerHTML = gamificationHTML();
        }
        function editGameUsername(){
          const next = (prompt('Game username:', profileData.username) || '').trim();
          if (next) profileData.username = next;
          document.getElementById('overlay').innerHTML = gamificationHTML();
        }
        function copyGameUniqueId(){
          const id = gameUniqueId;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(id).then(() => openAppAlertModal('ID copied: ' + id)).catch(() => openAppAlertModal(id));
          } else {
            openAppAlertModal(id);
          }
        }
        function selectGamingAvatarPreset(src){
          gameProfileAvatar = { type: 'photo', src };
          gamingAvatarPickerOpen = false;
          document.getElementById('overlay').innerHTML = gamificationHTML();
        }
        function removeGamingAvatar(){
          gameProfileAvatar = { type: 'none' };
          gamingAvatarPickerOpen = false;
          document.getElementById('overlay').innerHTML = gamificationHTML();
        }
        function gamificationAvatarButtonHTML(){
          if (gameProfileAvatar && gameProfileAvatar.type === 'photo') {
            return `<img src="${gameProfileAvatar.src}" class="w-full h-full object-cover">`;
          }
          if (gameProfileAvatar && gameProfileAvatar.type === 'icon') {
            return `<div class="w-full h-full flex items-center justify-center" style="background:${gameProfileAvatar.bg};color:${gameProfileAvatar.fg};">${Icon(gameProfileAvatar.icon,'w-4 h-4')}</div>`;
          }
          if (gameProfileAvatar && gameProfileAvatar.type === 'none') {
            return `<div class="w-full h-full flex items-center justify-center text-[${NAVY}]" style="background:rgba(10,37,64,0.14);">${Icon('user','w-4 h-4')}</div>`;
          }
          if (profileData.photo) {
            return `<img src="${profileData.photo}" class="w-full h-full object-cover">`;
          }
          return `<div class="w-full h-full flex items-center justify-center text-[${NAVY}]" style="background:rgba(10,37,64,0.14);">${Icon('user','w-4 h-4')}</div>`;
        }
        function gameProfileHTML(){
          const canRemove = (gameProfileAvatar && (gameProfileAvatar.type === 'photo' || gameProfileAvatar.type === 'icon'))
            || (!gameProfileAvatar && profileData.photo);
          const badges = getBadges();
          const earnedCount = badges.filter(b => b.earned).length;
          return `
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
              ${gamificationSubHeaderHTML('Game Profile')}
              <div class="p-5 space-y-4">

                <div class="bg-white rounded-3xl p-5 shadow-sm">
                  <div class="flex flex-col items-center">
                    <div class="relative">
                      <button onclick="toggleGamingAvatarPicker()" class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center" style="border:2px solid rgba(10,37,64,0.12);">${gamificationAvatarButtonHTML()}</button>
                    </div>

                    ${gamingAvatarPickerOpen ? `
                      <div class="w-full mt-3">
                        <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));justify-items:center;gap:0.4rem;">
                          ${defaultAvatarImages.map(src => `
                            <button onclick="event.stopPropagation(); selectGamingAvatarPreset('${src}')" class="rounded-full overflow-hidden flex-shrink-0 border border-gray-100" style="width:2.25rem;height:2.25rem;">
                              <img src="${src}" class="w-full h-full object-cover">
                            </button>
                          `).join('')}
                        </div>
                        ${canRemove ? `<button onclick="event.stopPropagation(); removeGamingAvatar()" class="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 text-sm text-left rounded-xl" style="color:#dc2626;background:#fef2f2;">${Icon('trash','w-4 h-4')} Remove</button>` : ''}
                      </div>
                    ` : ''}
                  </div>

                  <div class="mt-4 divide-y divide-gray-100">
                    <div class="flex items-center justify-between py-3">
                      <span class="font-bold text-base text-[${NAVY}] font-display">${escapeHtml(profileData.username)}</span>
                      <button onclick="editGameUsername()" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:${ROYAL};color:#fff;">${Icon('edit','w-3.5 h-3.5')}</button>
                    </div>
                    <div class="flex items-center justify-between py-3">
                      <span class="text-sm text-gray-500">Unique ID: <span class="font-bold" style="color:#b45309;">${gameUniqueId}</span></span>
                      <button onclick="copyGameUniqueId()" class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:${ROYAL};color:#fff;">${Icon('copy','w-3.5 h-3.5')}</button>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between mb-3 px-1">
                    <div class="text-base font-bold text-[${NAVY}] font-display">Achievements &amp; Badges</div>
                    <div class="text-sm font-semibold text-gray-500">${earnedCount} / ${badges.length}</div>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    ${badges.map(b => `
                      <div class="bg-white rounded-3xl p-5 text-center shadow-sm ${b.earned ? '' : 'opacity-50'}">
                        <div class="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-2" style="background:${b.earned ? '#eff6ff' : '#f3f4f6'};color:${b.earned ? NAVY : '#9ca3af'};">${Icon(b.icon,'w-6 h-6')}</div>
                        <div class="font-semibold text-sm mb-1">${escapeHtml(b.label)}</div>
                        <div class="text-xs text-gray-500 leading-snug mb-2">${escapeHtml(b.desc)}</div>
                        ${b.earned
                          ? `<div class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">${Icon('check','w-4 h-4')} Earned</div>`
                          : `<div class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Locked</div>`}
                      </div>
                    `).join('')}
                  </div>
                </div>

              </div>
            </div>`;
        }

        function rightPanelGameProfileHTML(){
          const badges = getBadges();
          const earnedCount = badges.filter(b => b.earned).length;
          return `
            <div class="p-5 text-center border-b border-gray-100">
              <button onclick="openGameProfile()" class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-3" style="border:2px solid rgba(10,37,64,0.12);">${gamificationAvatarButtonHTML()}</button>
              <div class="font-bold text-base mb-1">${escapeHtml(profileData.username)}</div>
              <div class="text-xs text-gray-500 mb-4">Unique ID: <span class="font-bold" style="color:#b45309;">${gameUniqueId}</span></div>
              <div class="flex items-center justify-center gap-6 mb-4">
                <div class="text-center"><div class="text-base font-bold">${userPoints.toLocaleString()}</div><div class="text-[11px] text-gray-500">Points</div></div>
                <div class="text-center"><div class="text-base font-bold">${earnedCount}/${badges.length}</div><div class="text-[11px] text-gray-500">Badges</div></div>
              </div>
              <button onclick="openGameProfile()" class="w-full bg-gray-100 py-2.5 rounded-2xl font-medium text-sm">View full profile</button>
            </div>
            <div class="px-5 pt-4 pb-5">
              <div class="font-semibold text-sm mb-3">Achievements &amp; Badges</div>
              <div class="grid grid-cols-2 gap-3">
                ${badges.map(b => `
                  <div class="bg-gray-50 rounded-2xl p-3 text-center ${b.earned ? '' : 'opacity-50'}">
                    <div class="w-9 h-9 mx-auto rounded-xl flex items-center justify-center mb-1.5" style="background:${b.earned ? '#eff6ff' : '#f3f4f6'};color:${b.earned ? NAVY : '#9ca3af'};">${Icon(b.icon,'w-4 h-4')}</div>
                    <div class="font-semibold text-xs">${escapeHtml(b.label)}</div>
                  </div>`).join('')}
              </div>
            </div>`;
        }

        // ---- Nav/menu toggles + media pause helper ----
        function toggleNoticeBoardMenu(){
          noticeBoardMenuOpen = !noticeBoardMenuOpen;
          renderClassAnnouncementsTab();
        }
        function toggleJoinClassMenu(){
          joinClassMenuOpen = !joinClassMenuOpen;
          document.getElementById('overlay').innerHTML = joinClassroomHTML();
        }
        function toggleCreateClassMenu(){
          createClassMenuOpen = !createClassMenuOpen;
          document.getElementById('overlay').innerHTML = createClassroomHTML();
        }

        function activeNavBarHeight(){
          const classroomNav = document.getElementById('classroom-nav');
          if (classroomNav && classroomNav.style.display !== 'none') return classroomNav.offsetHeight;
          const bottomNav = document.getElementById('bottom-nav');
          if (bottomNav && bottomNav.style.display !== 'none') return bottomNav.offsetHeight;
          return 0;
        }

        const OVERLAY_TOP = '0';
        const OVERLAY_TOP_50 = '0';

        function pauseAllOverlayMedia(){
          const ov = document.getElementById('overlay');
          if (ov) {
            ov.querySelectorAll('video, audio').forEach(function(el){
              try { el.pause(); } catch(e){}
            });
          }
          // Home feed videos autoplay with sound (see setupFeedVideoAutoplay in
          // feed.js) and live in #screen, not #overlay -- opening any overlay
          // (notifications, chat, create post, the post-feed viewer, etc.) while
          // sitting on Home would otherwise leave that audio playing underneath.
          document.querySelectorAll('#feed-list video, #post-feed-list video').forEach(function(el){
            try { el.pause(); } catch(e){}
          });
          if (typeof feedVideoObserver !== 'undefined' && feedVideoObserver) {
            feedVideoObserver.disconnect();
            feedVideoObserver = null;
          }
        }

        function checkCourseVideoAudio(videoEl){
          try {
            videoEl.muted = false;
            videoEl.volume = 1;
            const hasAudioTrack =
              (videoEl.audioTracks && videoEl.audioTracks.length > 0) ||
              (typeof videoEl.webkitAudioDecodedByteCount === 'number' && videoEl.webkitAudioDecodedByteCount > 0) ||
              (typeof videoEl.mozHasAudio === 'boolean' ? videoEl.mozHasAudio : null);
            setTimeout(function(){
              const noAudio =
                (typeof videoEl.webkitAudioDecodedByteCount === 'number' && videoEl.webkitAudioDecodedByteCount === 0) ||
                (typeof videoEl.mozHasAudio === 'boolean' && !videoEl.mozHasAudio);
              if (noAudio && hasAudioTrack !== true) {
                const warn = document.getElementById('course-video-noaudio-' + videoEl.id.replace('course-video-', ''));
                if (warn) warn.classList.remove('hidden');
              }
            }, 1200);
          } catch(e){}
        }

        let overlayReturnTo = null;

        // ---- Generic overlay open/close routing ----
        function openOverlayFrom(returnKind, kind){
          overlayReturnTo = returnKind;
          openOverlay(kind);
        }

        function overlayGoBack(){
          if (overlayReturnTo) {
            const target = overlayReturnTo;
            overlayReturnTo = null;
            openOverlay(target);
            return;
          }
          closeOverlay();
        }

        function openOverlay(kind){
          collabMembersOverlayOpen = false;
          pauseAllOverlayMedia();
          currentOverlayKind = kind;
          if (typeof STITCH_PAGE_TITLES !== 'undefined' && STITCH_PAGE_TITLES[kind]) setStitchPageTitle(STITCH_PAGE_TITLES[kind]);
          updateUtilityNavActive();
          if (typeof updateClassroomNav === 'function') updateClassroomNav();
          const ov = document.getElementById('overlay');
          clearQuizBackground();
          const studyFabWrap = document.getElementById('study-fab-wrap');
          if (studyFabWrap) studyFabWrap.style.display = 'none';
          const keepsTaskbar = kind === 'gamification' || kind === 'aiClass' || kind === 'classAnnouncements';
          if (!keepsTaskbar) {
            const bottomNavEl = document.getElementById('bottom-nav');
            const classroomNavEl = document.getElementById('classroom-nav');
            if (bottomNavEl) bottomNavEl.style.display = 'none';
            if (classroomNavEl) classroomNavEl.style.display = 'none';
          } else if (kind === 'aiClass' || kind === 'classAnnouncements') {
            const bottomNavEl = document.getElementById('bottom-nav');
            if (bottomNavEl) bottomNavEl.style.display = 'none';
          }
          const prevOverlayScrollEl = ov.querySelector('.overflow-y-auto');
          const prevOverlayScrollTop = prevOverlayScrollEl ? prevOverlayScrollEl.scrollTop : 0;
          ov.classList.remove('hidden');

          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) {
            if (kind === 'conversation' && currentTab === 3) { appShellEl.classList.add('messaging-split'); closeRightPanel(); }
            else appShellEl.classList.remove('messaging-split');
            if (kind === 'call') appShellEl.classList.add('call-fullscreen');
            else appShellEl.classList.remove('call-fullscreen');
          }

          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.style.transition = (kind === 'conversation' || kind === 'aiClass') ? 'bottom .3s cubic-bezier(.22,.68,0,1)' : '';
          if (kind === 'conversation' && typeof convoInputFocused !== 'undefined') convoInputFocused = false;

          if (kind === 'profileMenu' || kind === 'profileAnalytics' || kind === 'call' || kind === 'incomingCall' || kind === 'incomingLectureCall' || kind === 'profileQR' || kind === 'lectureCall' || kind === 'editMedia') {
            ov.style.top = '0';
          }

          if (kind === 'discover') { discoverSearchQuery = ''; ov.innerHTML = discoverHTML(); if (!discoverPeopleLoaded) loadDiscoverPeople(); else renderDiscoverList(); }
          else if (kind === 'create') {
            selectedMediaItems = []; selectedMediaHtml = null; selectedMediaType = null; selectedMediaFile = null; selectedMediaPreviewHtml = null;
            composeTaggedUsers = []; composeCaptionDraft = ''; tagPickerSearchQuery = '';
            ov.innerHTML = createPostHTML();
            if (!discoverPeopleLoaded) loadDiscoverPeople();
          }
          else if (kind === 'tagPeoplePicker') {
            ov.innerHTML = tagPeoplePickerHTML();
            if (!discoverPeopleLoaded) loadDiscoverPeople();
            const searchInput = document.getElementById('tag-picker-search-input');
            if (searchInput) setTimeout(() => searchInput.focus(), 60);
          }
          else if (kind === 'editMedia') ov.innerHTML = editMediaHTML();
          else if (kind === 'aiClass') { ov.innerHTML = aiClassHTML(); if (typeof renderPendingMermaidDiagrams === 'function') renderPendingMermaidDiagrams(); if (typeof startAIRobotAnimation === 'function') startAIRobotAnimation(); }
          else if (kind === 'conversation') ov.innerHTML = conversationHTML();
          else if (kind === 'call') ov.innerHTML = callHTML();
          else if (kind === 'addToCall') ov.innerHTML = addToCallHTML();
          else if (kind === 'incomingCall') ov.innerHTML = incomingCallHTML();
          else if (kind === 'incomingLectureCall') ov.innerHTML = incomingLectureCallHTML();
          else if (kind === 'joinClassroom') ov.innerHTML = joinClassroomHTML();
          else if (kind === 'createClassroom') ov.innerHTML = createClassroomHTML();
          else if (kind === 'classDetail') ov.innerHTML = classDetailHTML();
          else if (kind === 'inviteStudents') ov.innerHTML = inviteStudentsHTML();
          else if (kind === 'newAnnouncement') ov.innerHTML = newAnnouncementHTML();
          else if (kind === 'scheduleLecture') ov.innerHTML = scheduleLectureHTML();
          else if (kind === 'lectureCall') {
            inLectureCall = true;
            ov.innerHTML = lectureCallHTML();
            if (rightPanelMode === 'notebook') renderRightPanelBody();
            else if (window.innerWidth >= 1024) openRightPanel('notebook');
          }
          else if (kind === 'classworkCreateMenu') ov.innerHTML = classworkCreateMenuHTML();
          else if (kind === 'newClasswork') ov.innerHTML = newClassworkHTML();
          else if (kind === 'newQuiz') ov.innerHTML = newQuizHTML();
          else if (kind === 'newPoll') ov.innerHTML = newPollHTML();
          else if (kind === 'classworkDetail') ov.innerHTML = classworkDetailHTML();
          else if (kind === 'classSettings') ov.innerHTML = classSettingsHTML();
          else if (kind === 'studyTimetable') ov.innerHTML = studyTimetableHTML();
          else if (kind === 'studyReminders') ov.innerHTML = studyRemindersHTML();
          else if (kind === 'classAnnouncements') { renderClassAnnouncementsTab(); openRightPanel('pinned'); }
          else if (kind === 'classNotifications') ov.innerHTML = classNotificationsHTML();
          else if (kind === 'gamification') { gamificationSubView = 'home'; ov.innerHTML = gamificationHTML(); openRightPanel('gameprofile'); }
          else if (kind === 'profileMenu') ov.innerHTML = profileMenuHTML();
          else if (kind === 'profileQR') { ov.innerHTML = profileQRHTML(); initProfileQRCode(); }
          else if (kind === 'newMessage') { newMessageSearchActive = false; newMessageSearchQuery = ''; ov.innerHTML = newMessageHTML(); }
          else if (kind === 'myContacts') { ov.innerHTML = myContactsHTML(); if (typeof refreshAllContactPhotos === 'function') refreshAllContactPhotos(); }
          else if (kind === 'newCollaboration') ov.innerHTML = newCollaborationHTML();
          else if (kind === 'profileAnalytics') ov.innerHTML = profileAnalyticsHTML();
          else if (kind === 'careerAnalytics') ov.innerHTML = careerAnalyticsHTML();
          else if (kind === 'notificationSettings') ov.innerHTML = notificationSettingsHTML();
          else if (kind === 'savedItems') ov.innerHTML = savedItemsHTML();
          else if (kind === 'blockedAccounts') ov.innerHTML = blockedAccountsHTML();
          else if (kind === 'referrals') { ov.innerHTML = referralsHTML(); if (typeof loadReferralProfile === 'function') loadReferralProfile(); }
          else if (kind === 'termsOfService') ov.innerHTML = termsOfServiceHTML();
          else if (kind === 'privacyPolicy') ov.innerHTML = privacyPolicyHTML();
          else if (kind === 'helpCenter') ov.innerHTML = helpCenterHTML();
          else if (kind === 'contactUs') { resetContactFormDraft(); ov.innerHTML = contactUsHTML(); }
          else if (kind === 'reportIssue') { resetReportIssueDraft(); ov.innerHTML = reportIssueHTML(); }
          else if (kind === 'practiceTests') ov.innerHTML = practiceTestsHTML();
          else if (kind === 'examTake') { ov.innerHTML = examTakeHTML(); setNotebookNavLabel('Annotate'); }
          else if (kind === 'jobDetail') ov.innerHTML = jobDetailHTML();
          else if (kind === 'jobApply') ov.innerHTML = jobApplyHTML();
          else if (kind === 'careerStart') ov.innerHTML = careerStartFormHTML();
          else if (kind === 'careerMatching') ov.innerHTML = careerMatchingHTML();
          else if (kind === 'careerMatches') ov.innerHTML = careerMatchesHTML();
          else if (kind === 'postOpportunity') {
            if (!isCurrentUserAdmin()) { closeOverlay(); return; }
            ov.innerHTML = postOpportunityHTML();
          }
          else if (kind === 'courseDetail') ov.innerHTML = courseDetailHTML();
          else if (kind === 'courseItemDetail') ov.innerHTML = courseItemDetailHTML();
          else if (kind === 'courseEnroll') ov.innerHTML = courseEnrollHTML();
          else if (kind === 'newCourse') {
            if (!isCurrentUserAdmin()) { closeOverlay(); return; }
            ov.innerHTML = newCourseHTML();
          }
          else if (kind === 'courseTeachers') ov.innerHTML = courseTeachersHTML();
          else if (kind === 'personProfile') ov.innerHTML = personProfileHTML();
          else if (kind === 'messageRequestCompose') { ov.innerHTML = messageRequestComposeHTML(); const cInp = document.getElementById('message-request-compose-input'); if (cInp) setTimeout(() => cInp.focus(), 60); }
          else if (kind === 'postFeed') { ov.innerHTML = postFeedHTML(); scrollToPostFeedStart(); const pfl = document.getElementById('post-feed-list'); if (pfl && typeof setupFeedVideoAutoplay === 'function') setupFeedVideoAutoplay(pfl); }
          else if (kind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          else renderNotifTab();

          if (prevOverlayScrollTop) {
            const restoredOverlayScrollEl = ov.querySelector('.overflow-y-auto');
            if (restoredOverlayScrollEl) restoredOverlayScrollEl.scrollTop = prevOverlayScrollTop;
          }

          const navBackdropEl = document.getElementById('nav-bottom-backdrop');
          if (kind === 'gamification' || kind === 'aiClass' || kind === 'classAnnouncements') {
            const navH = activeNavBarHeight();
            if (navH) ov.style.bottom = navH + 'px';
            bottomNavOffset = 0;
            bottomNavLastScroll = 0;
            activeNavGapSyncEl = ov;
            attachTaskbarScrollHandler(ov.querySelector('.overflow-y-auto'), ov);
            if (navBackdropEl) navBackdropEl.style.display = 'block';
          } else {
            activeNavGapSyncEl = null;
            if (navBackdropEl) navBackdropEl.style.display = 'none';
          }

          if (overlayBackKinds.includes(kind) && !overlayHistoryPushed) {
            history.pushState({ stitchOverlay: kind }, '');
            overlayHistoryPushed = true;
          }
        }
        function closeOverlay(fromPopState){
          if (currentOverlayKind === 'examTake' && typeof examStage !== 'undefined' && examStage === 'take'
              && typeof examTest !== 'undefined' && examTest && typeof finishExam === 'function') {
            finishExam(true);
            if (typeof renderExamTake === 'function') renderExamTake();
            return;
          }
          const wasConversation = currentOverlayKind === 'conversation';
          const wasAIClass = currentOverlayKind === 'aiClass';
          if (typeof STITCH_PAGE_TITLES !== 'undefined' && STITCH_PAGE_TITLES[currentOverlayKind]) resetStitchPageTitle();
          pauseAllOverlayMedia();
          currentOverlayKind = null;
          overlayReturnTo = null;
          updateUtilityNavActive();
          if (typeof updateClassroomNav === 'function') updateClassroomNav();
          // Guarded: closeOverlay() is the generic "close whatever's open"
          // handler used by many unrelated screens' back buttons -- without
          // these checks, closing some other overlay while a call/lecture
          // is minimized (still running in the background) would silently
          // kill it, even though the person never tapped "End".
          if (typeof callMinimized === 'undefined' || !callMinimized) {
            clearCallTimers();
            stopCallLocalStream();
            teardownCallSignaling();
          }
          if (typeof lectureMinimized === 'undefined' || !lectureMinimized) {
            clearLectureTimer();
            stopLectureLocalStream();
          }
          clearStoryTimer();
          if (typeof stopChallengeScorePolling === 'function') stopChallengeScorePolling();
          const ov = document.getElementById('overlay');
          if (ov) { ov.classList.add('hidden'); ov.innerHTML=''; ov.style.top = OVERLAY_TOP; ov.style.bottom = '0'; ov.style.paddingTop = ''; ov.style.transition = ''; }
          activeNavGapSyncEl = null;
          const navBackdropElClose = document.getElementById('nav-bottom-backdrop');
          if (navBackdropElClose) navBackdropElClose.style.display = 'none';
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) { appShellEl.classList.remove('messaging-split'); appShellEl.classList.remove('call-fullscreen'); }
          clearQuizBackground();
          if (typeof stopQuizMusic === 'function') stopQuizMusic();
          resetBottomNav();
          setNotebookNavLabel('Notebook');
          const isClassroomTab = currentTab === 2;
          const bottomNavEl = document.getElementById('bottom-nav');
          const classroomNavEl = document.getElementById('classroom-nav');
          if (bottomNavEl) bottomNavEl.style.display = isClassroomTab ? 'none' : '';
          if (classroomNavEl) classroomNavEl.style.display = isClassroomTab ? '' : 'none';
          if (overlayHistoryPushed) {
            overlayHistoryPushed = false;
            if (!fromPopState) {
              // popModalBackHandler (above) already sets this flag before its
              // own history.back() so the resulting async popstate event
              // doesn't get treated as a real back-press. closeOverlay() was
              // missing the same guard: history.back() here fires its
              // popstate asynchronously, so any code that calls closeOverlay()
              // and then immediately opens a *different* overlay (e.g.
              // messageViewedProfile() closing the person-profile overlay and
              // opening the conversation overlay right after) would have that
              // stray popstate arrive after the new overlay's own
              // history.pushState -- and since the overlay panel is visible
              // again by then, the popstate handler read that as "user
              // pressed back" and immediately closed the overlay that had
              // just been opened, bouncing the person back to whatever was
              // underneath (e.g. the Home feed) instead of the chat.
              suppressNextPopstate = true;
              history.back();
            }
          }
          if (currentTab === 2) { renderStudy(); openRightPanel('notebook'); }
          if (currentTab === 0 && typeof setupFeedVideoAutoplay === 'function') {
            const feedListEl = document.getElementById('feed-list');
            if (feedListEl) setupFeedVideoAutoplay(feedListEl);
          }
          if (currentTab === 3) applyDefaultRightPanel(3);
          if (wasConversation && typeof leaveConvoTypingChannel === 'function') leaveConvoTypingChannel();
          if (wasConversation && typeof activeConvoId !== 'undefined') activeConvoId = null;
          if (wasConversation && typeof convoInputFocused !== 'undefined') convoInputFocused = false;
          // Stepping out of a conversation used to leave whatever inbox-list
          // HTML happened to be sitting in the DOM from before the chat was
          // opened. The underlying c.preview/c.time/c.unread data model is
          // already correct the instant a message is sent or read (see
          // updateConvoPreview/openConversation), but nothing forced the
          // list to redraw from it on the way back out -- so a chat you'd
          // just replied in could still show its old preview/timestamp
          // until something else (a tab switch, a poll) happened to
          // re-render it. Redraw here so what you see matches what you
          // just did, immediately and without depending on a network
          // round-trip.
          if (wasConversation && currentTab === 3 && typeof renderInboxTab === 'function') renderInboxTab();
          if (wasAIClass && typeof archiveCurrentAIChat === 'function') archiveCurrentAIChat();
          if (wasAIClass && typeof aiChatInputFocused !== 'undefined') aiChatInputFocused = false;
        }

        window.addEventListener('popstate', function(){
          if (suppressNextPopstate) { suppressNextPopstate = false; return; }
          if (modalBackStack.length) {
            const closeFn = modalBackStack[modalBackStack.length - 1];
            if (closeFn) closeFn(true);
            return;
          }
          const ov = document.getElementById('overlay');
          if (ov && !ov.classList.contains('hidden')) {
            const backAction = overlayBackAction[currentOverlayKind];
            if (backAction) { backAction(true); return; }
            closeOverlay(true);
          }
        });

        // ---- Overlay/menu header helpers ----
        function overlayHeader(title, extraTopPad, backAction, icon){
          const padStyle = ` style="padding-top:${extraTopPad || '20px'};"`;
          return `
            <div class="flex-shrink-0 w-full"${padStyle}>
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="${backAction || 'overlayGoBack()'}">${gradIcon(IconBold(icon || 'back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display grad-text">${title}</div>
              </div>
            </div>`;
        }

        function plainOverlayHeader(title){
          return `
            <div class="w-full px-5 pb-3" style="padding-top:var(--top-safe-pad);">
              <button onclick="closeOverlay()" class="flex items-center gap-1.5 font-semibold text-sm mb-3 grad-text">
                ${gradIcon(IconBold('back','w-5 h-5'))} Back
              </button>
              <h1 class="text-2xl font-bold font-display grad-text">${title}</h1>
            </div>`;
        }

        function attachMenuScrollCloser(scrollEl, menuOpen, toggleFnOrName){
          if (!menuOpen || !scrollEl) return;
          const anchor = scrollEl.scrollTop;
          let armed = false;
          setTimeout(() => { armed = true; }, 300);
          const onScroll = () => {
            if (armed && Math.abs(scrollEl.scrollTop - anchor) > 4) {
              scrollEl.removeEventListener('scroll', onScroll);
              if (typeof toggleFnOrName === 'function') toggleFnOrName();
              else if (typeof toggleFnOrName === 'string') window[toggleFnOrName]();
            }
          };
          scrollEl.addEventListener('scroll', onScroll, { passive: true });
        }

        function menuOverlayHeader(title, menuOpen, toggleFnName, dropdownHtml, opts){
          opts = opts || {};
          const backFnName = opts.backFn || 'closeOverlay';
          const backBtn = opts.hideBack ? '' : `<button onclick="${backFnName}()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>`;
          const menuIcon = opts.boldMenuIcon ? IconBold('dashes','w-5 h-5') : Icon('dashes','w-5 h-5');
          const menuBtnClass = `w-8 h-8 flex items-center justify-center flex-shrink-0${opts.hideMenuOnDesktop ? ' notif-header-menu-btn' : ''}`;
          const menuBtn = `<button onclick="${toggleFnName}()" class="${menuBtnClass}">${gradIcon(menuIcon)}</button>`;
          const titleSize = opts.titleSize || 'text-base';
          const titleClass = opts.titleLeft
            ? `${titleSize} font-bold font-display grad-text truncate${opts.menuLeft ? ' text-right' : ''}`
            : `${titleSize} font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate`;
          const titleMaxWidth = opts.titleLeft ? '80%' : '60%';
          const rowChildren = opts.menuLeft
            ? `${menuBtn}<h1 class="${titleClass}" style="max-width:${titleMaxWidth};">${title}</h1>`
            : `${backBtn}<h1 class="${titleClass}" style="max-width:${titleMaxWidth};">${title}</h1>${menuBtn}`;
          return `
            <div class="w-full px-5 pb-3 relative" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between">
                ${rowChildren}
              </div>
              ${menuOpen ? `<div onclick="${toggleFnName}()" onwheel="${toggleFnName}()" ontouchmove="${toggleFnName}()" class="fixed inset-0 z-10"></div>${dropdownHtml || placeholderDropdownMenu()}` : ''}
            </div>`;
        }

        // ---- Join/Create class forms ----
        function classDetailHeaderHTML(title){
          return `
            <div class="w-full px-5 pb-3 relative" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between">
                <button onclick="openLeaveClassModal(closeOverlay, 'Exit this class?', 'You can come back to this class anytime from Classroom.')" class="desktop-leave-classroom-btn w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}<span class="desktop-leave-classroom-label grad-text">Leave Classroom</span></button>
                <h1 class="text-base font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">${escapeHtml(title)}</h1>
                <button onclick="openOverlayFrom('classDetail', 'classNotifications')" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(Icon('bell','w-5 h-5'))}</button>
              </div>
            </div>`;
        }

        function placeholderDropdownMenu(){
          return `
            <div class="absolute w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;">
              <div class="px-4 py-2.5 text-sm text-gray-400 menu-item-pill">More options coming soon</div>
            </div>`;
        }

        function joinClassDropdownMenu(){
          return `
            <div class="absolute w-56 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;">
              <button onclick="pasteJoinClassCode()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('clip','w-4 h-4')} Paste code from clipboard</button>
              <button onclick="showJoinClassHelp()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('help','w-4 h-4')} How do I get a class code?</button>
            </div>`;
        }

        function createClassDropdownMenu(){
          return `
            <div class="absolute w-56 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;">
              <button onclick="resetCreateClassForm()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('trash','w-4 h-4')} Clear form</button>
              <button onclick="showCreateClassHelp()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('help','w-4 h-4')} What do these fields mean?</button>
            </div>`;
        }

        async function pasteJoinClassCode(){
          toggleJoinClassMenu();
          const input = document.getElementById('join-code-input');
          try {
            const text = await navigator.clipboard.readText();
            if (input && text) input.value = text.trim().toUpperCase();
            if (!text) openAppAlertModal('Your clipboard is empty. Copy a class code first, then try again.');
          } catch (e) {
            openAppAlertModal("Couldn't read your clipboard. You may need to allow clipboard access, or just type the code in manually.");
          }
        }

        function showJoinClassHelp(){
          toggleJoinClassMenu();
          openAppAlertModal('Ask your teacher or a classmate already in the class for the class code. It\'s usually 6-8 letters or numbers, shown at the top of the class in their app.');
        }

        function resetCreateClassForm(){
          toggleCreateClassMenu();
          const ids = ['create-name-input','create-section-input','create-subject-input'];
          ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        }

        function showCreateClassHelp(){
          toggleCreateClassMenu();
          openAppAlertModal('Class Name: what students will see (required).\nSection: an optional label like "Section B" if you teach more than one group.\nSubject: an optional label like "Biology" to help students find the class.');
        }

        let selectedMediaItems = [];
        let selectedMediaHtml = null;
        let selectedMediaType = null;
        let selectedMediaFile = null;
        let selectedMediaPreviewHtml = null;

        // ---- Create Post: media selection + preview ----
        function syncSelectedMediaMirror(){
          const first = selectedMediaItems[0] || null;
          selectedMediaFile = first ? first.file : null;
          selectedMediaType = first ? first.type : null;
          selectedMediaHtml = first ? mediaItemFullHtml(first) : null;
          selectedMediaPreviewHtml = first ? mediaItemFullHtml(first) : null;
        }

        function mediaItemFullHtml(item){
          return item.type === 'video'
            ? simplePostVideoHtml(item.url)
            : `<img src="${item.url}" class="w-full h-auto">`;
        }

        let composeTaggedUsers = [];
        let composeCaptionDraft = '';
        let tagPickerSearchQuery = '';

        function createPostHTML(captionDraft){
          const hasMedia = selectedMediaItems.length > 0;
          return `
            ${overlayHeader('New post', '20px', null, 'close')}
            <div id="create-post-scroll" class="p-5 flex-1 overflow-y-auto no-scrollbar">
              <div id="media-preview" class="mb-4">${mediaPreviewStripHTML()}</div>
              <input type="file" id="media-input" accept="image/*,video/*" multiple class="hidden" onchange="handleMediaSelect(event)">
              <div class="relative mb-2">
                <textarea id="new-post-text" oninput="onComposeTextInput()" class="w-full h-24 p-4 border border-gray-200 rounded-2xl text-base" placeholder="Write a caption... Type @ to tag someone">${escapeHtml(captionDraft || '')}</textarea>
              </div>
              <button type="button" onclick="openTagPeoplePicker()" class="text-xs font-semibold flex items-center gap-1.5 mb-2" style="color:${ROYAL}">${Icon('users','w-4 h-4')} Tag people</button>
              <div id="compose-tagged-chips" class="flex flex-wrap gap-2 ${composeTaggedUsers.length ? 'mb-3' : ''}">${composeTaggedChipsHTML()}</div>
            </div>
            <div id="create-post-footer" class="p-4 border-t flex-shrink-0">
              <button onclick="submitPost()" class="pill-cta w-full py-3 rounded-full font-semibold text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Post</button>
            </div>`;
        }

        function mediaPreviewStripHTML(){
          if (!selectedMediaItems.length) {
            return `
              <button type="button" onclick="pickMedia('image/*,video/*')" class="w-full h-48 bg-gray-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400">
                ${Icon('upload','w-8 h-8')}<div class="text-sm">(tap to upload a post)</div>
              </button>`;
          }
          return `
            <div class="relative">
              <div id="media-preview-scroll" class="flex gap-2 overflow-x-auto no-scrollbar w-full rounded-2xl" style="scroll-snap-type:x mandatory;">
                ${selectedMediaItems.map((item, i) => `
                  <div class="relative flex-shrink-0 w-full rounded-2xl overflow-hidden bg-black" style="scroll-snap-align:center;max-height:16rem;">
                    ${item.type === 'video'
                      ? `<video src="${item.url}" controls class="w-full h-auto max-h-64" style="object-fit:contain;"></video>`
                      : `<img src="${item.url}" class="w-full h-auto max-h-64" style="object-fit:contain;">`}
                    <button type="button" onclick="event.stopPropagation(); removeSelectedMediaItem(${i})" class="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white" style="background:rgba(0,0,0,0.55);">${IconBold('close','w-3.5 h-3.5')}</button>
                  </div>`).join('')}
                <button type="button" onclick="pickMedia('image/*,video/*')" class="flex-shrink-0 flex flex-col items-center justify-center gap-1 text-gray-400 bg-gray-100 rounded-2xl" style="scroll-snap-align:center;width:88px;max-height:16rem;">
                  ${Icon('plus','w-6 h-6')}<span class="text-[11px]">Add more</span>
                </button>
              </div>
              ${selectedMediaItems.length > 1 ? `
                <div class="flex items-center justify-center gap-1.5 mt-2">
                  ${selectedMediaItems.map(() => `<span class="rounded-full" style="width:5px;height:5px;background:rgba(10,37,64,0.25);"></span>`).join('')}
                </div>` : ''}
            </div>`;
        }

        function pickMedia(accept){
          const input = document.getElementById('media-input');
          input.setAttribute('accept', accept);
          input.click();
        }

        function handleMediaSelect(event){
          const files = Array.from(event.target.files || []);
          event.target.value = '';
          if (!files.length) return;
          let remaining = files.length;
          const newItems = new Array(files.length);
          files.forEach((file, idx) => {
            const isVideo = file.type.startsWith('video/');
            const reader = new FileReader();
            reader.onload = function(e){
              newItems[idx] = { file, type: isVideo ? 'video' : 'image', url: e.target.result };
              remaining -= 1;
              if (remaining === 0) {
                const startIndex = selectedMediaItems.length;
                selectedMediaItems = selectedMediaItems.concat(newItems);
                syncSelectedMediaMirror();
                const newPhotoIndices = newItems
                  .map((it, i) => (it.type === 'image' ? startIndex + i : -1))
                  .filter(i => i !== -1);
                if (newPhotoIndices.length) {
                  beginMediaEditQueue(newPhotoIndices);
                } else {
                  refreshMediaPreviewStrip();
                }
              }
            };
            reader.readAsDataURL(file);
          });
        }

        function removeSelectedMediaItem(index){
          selectedMediaItems.splice(index, 1);
          syncSelectedMediaMirror();
          refreshMediaPreviewStrip();
        }

        function refreshMediaPreviewStrip(){
          const el = document.getElementById('media-preview');
          if (el) el.innerHTML = mediaPreviewStripHTML();
        }

        let mediaEditQueue = [];        
        let mediaEditIndexInQueue = 0;
        let mediaEditAspect = 'original'; 
        let mediaEditZoom = 1;
        let mediaEditPan = { x: 0, y: 0 };
        let mediaEditDrag = null;
        let mediaEditNatural = { w: 0, h: 0 };

        // ---- Media editor (crop/zoom/aspect ratio) ----
        function beginMediaEditQueue(indices){
          mediaEditQueue = indices;
          mediaEditIndexInQueue = 0;
          const ta = document.getElementById('new-post-text');
          if (ta) composeCaptionDraft = ta.value;
          openMediaEditorStep();
        }

        function openMediaEditorStep(){
          if (mediaEditIndexInQueue >= mediaEditQueue.length) {
            mediaEditQueue = [];
            syncSelectedMediaMirror();
            currentOverlayKind = 'create';
            updateUtilityNavActive();
            const ov = document.getElementById('overlay');
            if (ov) ov.innerHTML = createPostHTML(composeCaptionDraft);
            return;
          }
          mediaEditAspect = 'original';
          mediaEditZoom = 1;
          mediaEditPan = { x: 0, y: 0 };
          mediaEditDrag = null;
          mediaEditNatural = { w: 0, h: 0 };
          openOverlay('editMedia');
        }

        function currentMediaEditItem(){
          return selectedMediaItems[mediaEditQueue[mediaEditIndexInQueue]] || null;
        }

        function editMediaHTML(){
          const item = currentMediaEditItem();
          if (!item) return '';
          return `
            <div class="flex flex-col h-full bg-black text-white relative">
              <div class="flex items-center justify-between px-4 flex-shrink-0" style="padding-top:var(--top-safe-pad);">
                <button type="button" onclick="skipMediaEdit()" class="text-sm font-semibold px-2 py-1">Cancel</button>
                <div class="text-sm font-semibold">${mediaEditQueue.length > 1 ? `Edit photo ${mediaEditIndexInQueue + 1} of ${mediaEditQueue.length}` : 'Edit photo'}</div>
                <button type="button" onclick="doneMediaEdit()" class="text-sm font-bold px-2 py-1" style="color:#4d9fff;">Done</button>
              </div>
              <div class="flex-1 flex items-center justify-center px-4 min-h-0">
                <div id="edit-crop-frame" class="relative overflow-hidden bg-gray-900 rounded-lg" style="width:100%;max-width:420px;${mediaEditFrameAspectCss()}touch-action:none;">
                  <img id="edit-media-img" src="${item.url}" draggable="false" ondragstart="return false;"
                    onload="initMediaEditTransform()"
                    onpointerdown="mediaEditPointerDown(event)"
                    onpointermove="mediaEditPointerMove(event)"
                    onpointerup="mediaEditPointerUp(event)"
                    onpointercancel="mediaEditPointerUp(event)"
                    style="position:absolute;top:50%;left:50%;user-select:none;-webkit-user-drag:none;cursor:grab;">
                </div>
              </div>
              <div id="edit-aspect-row" class="flex items-center justify-center gap-2 px-4 pt-4 flex-shrink-0">${mediaEditAspectRowInner()}</div>
              <div class="flex items-center gap-3 px-6 pt-3 flex-shrink-0">
                <span class="text-[11px] text-gray-400 flex-shrink-0">Zoom</span>
                <input id="edit-zoom-slider" type="range" min="1" max="3" step="0.01" value="${mediaEditZoom}" oninput="mediaEditZoomInput(this.value)" class="flex-1">
              </div>
              <div class="px-6 pt-2 flex-shrink-0" style="padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);">
                <div class="text-[11px] text-center text-gray-400">Drag the photo to reposition it</div>
              </div>
            </div>`;
        }

        function mediaEditAspectRowInner(){
          return mediaEditAspectBtn('original', 'Original') + mediaEditAspectBtn('square', '1:1') + mediaEditAspectBtn('portrait', '4:5') + mediaEditAspectBtn('landscape', '16:9');
        }

        function mediaEditAspectBtn(key, label){
          const active = mediaEditAspect === key;
          return `<button type="button" onclick="setMediaEditAspect('${key}')" class="px-3 py-1.5 rounded-full text-xs font-semibold" style="background:${active ? '#ffffff' : 'rgba(255,255,255,0.14)'};color:${active ? '#0a2540' : '#ffffff'};">${label}</button>`;
        }

        function mediaEditFrameAspectCss(){
          if (mediaEditAspect === 'square') return 'aspect-ratio:1/1;';
          if (mediaEditAspect === 'portrait') return 'aspect-ratio:4/5;';
          if (mediaEditAspect === 'landscape') return 'aspect-ratio:16/9;';
          if (mediaEditNatural.w && mediaEditNatural.h) return `aspect-ratio:${mediaEditNatural.w}/${mediaEditNatural.h};`;
          return 'aspect-ratio:1/1;';
        }

        function fitMediaEditFrame(){
          const frame = document.getElementById('edit-crop-frame');
          const box = frame && frame.parentElement;
          if (!frame || !box) return;
          const availW = Math.min(box.clientWidth, 420);
          const availH = box.clientHeight;
          if (!availW || !availH) return;
          let ratio; 
          if (mediaEditAspect === 'square') ratio = 1;
          else if (mediaEditAspect === 'portrait') ratio = 4 / 5;
          else if (mediaEditAspect === 'landscape') ratio = 16 / 9;
          else ratio = (mediaEditNatural.w && mediaEditNatural.h) ? mediaEditNatural.w / mediaEditNatural.h : 1;
          let w = availW, h = w / ratio;
          if (h > availH) { h = availH; w = h * ratio; }
          frame.style.width = w + 'px';
          frame.style.height = h + 'px';
        }

        function setMediaEditAspect(key){
          mediaEditAspect = key;
          mediaEditZoom = 1;
          mediaEditPan = { x: 0, y: 0 };
          const slider = document.getElementById('edit-zoom-slider');
          if (slider) slider.value = 1;
          const row = document.getElementById('edit-aspect-row');
          if (row) row.innerHTML = mediaEditAspectRowInner();
          requestAnimationFrame(() => { fitMediaEditFrame(); applyMediaEditTransform(); });
        }

        function initMediaEditTransform(){
          const img = document.getElementById('edit-media-img');
          if (!img) return;
          mediaEditNatural = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
          fitMediaEditFrame();
          applyMediaEditTransform();
        }

        function applyMediaEditTransform(){
          const img = document.getElementById('edit-media-img');
          const frame = document.getElementById('edit-crop-frame');
          if (!img || !frame || !mediaEditNatural.w) return;
          const frameW = frame.clientWidth, frameH = frame.clientHeight;
          if (!frameW || !frameH) return;
          const coverScale = Math.max(frameW / mediaEditNatural.w, frameH / mediaEditNatural.h);
          const totalScale = coverScale * mediaEditZoom;
          const dispW = mediaEditNatural.w * totalScale;
          const dispH = mediaEditNatural.h * totalScale;
          const maxPanX = Math.max(0, (dispW - frameW) / 2);
          const maxPanY = Math.max(0, (dispH - frameH) / 2);
          mediaEditPan.x = Math.min(maxPanX, Math.max(-maxPanX, mediaEditPan.x));
          mediaEditPan.y = Math.min(maxPanY, Math.max(-maxPanY, mediaEditPan.y));
          img.style.width = dispW + 'px';
          img.style.height = dispH + 'px';
          img.style.transform = `translate(-50%, -50%) translate(${mediaEditPan.x}px, ${mediaEditPan.y}px)`;
        }

        function mediaEditZoomInput(val){
          mediaEditZoom = parseFloat(val) || 1;
          applyMediaEditTransform();
        }

        function mediaEditPointerDown(e){
          const img = document.getElementById('edit-media-img');
          if (!img) return;
          img.setPointerCapture(e.pointerId);
          mediaEditDrag = { startX: e.clientX, startY: e.clientY, panX: mediaEditPan.x, panY: mediaEditPan.y };
          img.style.cursor = 'grabbing';
        }

        function mediaEditPointerMove(e){
          if (!mediaEditDrag) return;
          mediaEditPan.x = mediaEditDrag.panX + (e.clientX - mediaEditDrag.startX);
          mediaEditPan.y = mediaEditDrag.panY + (e.clientY - mediaEditDrag.startY);
          applyMediaEditTransform();
        }

        function mediaEditPointerUp(){
          mediaEditDrag = null;
          const img = document.getElementById('edit-media-img');
          if (img) img.style.cursor = 'grab';
        }

        function skipMediaEdit(){
          mediaEditIndexInQueue += 1;
          openMediaEditorStep();
        }

        function doneMediaEdit(){
          const item = currentMediaEditItem();
          const frame = document.getElementById('edit-crop-frame');
          const img = document.getElementById('edit-media-img');
          const advance = () => { mediaEditIndexInQueue += 1; openMediaEditorStep(); };
          if (!item || !frame || !img || !mediaEditNatural.w) { advance(); return; }
          try {
            const frameW = frame.clientWidth, frameH = frame.clientHeight;
            const coverScale = Math.max(frameW / mediaEditNatural.w, frameH / mediaEditNatural.h);
            const totalScale = coverScale * mediaEditZoom;
            const cropW = frameW / totalScale;
            const cropH = frameH / totalScale;
            let cropX = (mediaEditNatural.w - cropW) / 2 - (mediaEditPan.x / totalScale);
            let cropY = (mediaEditNatural.h - cropH) / 2 - (mediaEditPan.y / totalScale);
            cropX = Math.max(0, Math.min(mediaEditNatural.w - cropW, cropX));
            cropY = Math.max(0, Math.min(mediaEditNatural.h - cropH, cropY));
            const canvas = document.createElement('canvas');
            const outScale = Math.min(2, mediaEditNatural.w / Math.max(1, cropW));
            canvas.width = Math.max(1, Math.round(cropW * outScale));
            canvas.height = Math.max(1, Math.round(cropH * outScale));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) {
                const oldUrl = item.url;
                const name = (item.file && item.file.name) || 'photo.jpg';
                item.file = new File([blob], name, { type: 'image/jpeg' });
                item.url = URL.createObjectURL(blob);
                if (typeof oldUrl === 'string' && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
              }
              advance();
            }, 'image/jpeg', 0.92);
          } catch (e) {
            console.warn('Cropping photo failed, keeping the original instead:', e);
            advance();
          }
        }

        // ---- Tagging people + @mentions in post caption ----
        function composeTaggedChipsHTML(){
          if (!composeTaggedUsers.length) return '';
          return composeTaggedUsers.map(u => `
            <span class="inline-flex items-center gap-1 text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-full" style="background:rgba(65,105,225,0.12);color:${ROYAL};">
              @${escapeHtml(u.username || u.name)}
              <button type="button" onclick="removeComposeTag('${escapeForJsAttr(u.id)}')" class="w-4 h-4 flex items-center justify-center rounded-full" style="background:rgba(65,105,225,0.18);">${IconBold('close','w-2.5 h-2.5')}</button>
            </span>`).join('');
        }

        function refreshComposeTagChips(){
          const el = document.getElementById('compose-tagged-chips');
          if (el) {
            el.innerHTML = composeTaggedChipsHTML();
            el.className = `flex flex-wrap gap-2 ${composeTaggedUsers.length ? 'mb-3' : ''}`;
          }
        }

        function openTagPeoplePicker(prefillQuery){
          const ta = document.getElementById('new-post-text');
          if (ta) composeCaptionDraft = ta.value;
          tagPickerSearchQuery = prefillQuery || '';
          openOverlay('tagPeoplePicker');
        }

        function closeTagPeoplePicker(){
          currentOverlayKind = 'create';
          updateUtilityNavActive();
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = createPostHTML(composeCaptionDraft);
        }

        function tagPeoplePickerHTML(){
          return `
            ${overlayHeader('Tag people', '20px', 'closeTagPeoplePicker()')}
            <div class="px-5 flex-shrink-0">
              <input id="tag-picker-search-input" value="${escapeHtml(tagPickerSearchQuery)}" oninput="onTagPickerSearchInput(this.value)" placeholder="Search people to tag" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3" autocomplete="off">
              <div id="tag-picker-chips" class="flex flex-wrap gap-2 ${composeTaggedUsers.length ? 'mb-3' : 'hidden'}">${composeTaggedChipsHTML()}</div>
            </div>
            <div id="tag-picker-list" class="px-5 pb-5 flex-1 overflow-y-auto no-scrollbar">${tagPickerListHTML()}</div>
            <div class="p-4 border-t flex-shrink-0">
              <button onclick="closeTagPeoplePicker()" class="pill-cta w-full py-3 rounded-full font-semibold text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);">Done</button>
            </div>`;
        }

        function onTagPickerSearchInput(val){
          tagPickerSearchQuery = val;
          const list = document.getElementById('tag-picker-list');
          if (list) list.innerHTML = tagPickerListHTML();
        }

        function tagPickerListHTML(){
          if (!discoverPeopleLoaded) return `<div class="text-center text-gray-400 text-sm py-10">Loading people...</div>`;
          const q = tagPickerSearchQuery.trim().toLowerCase();
          const candidates = discoverPeople.filter(p => (p.username || '').trim());
          const filtered = q ? candidates.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.username || '').toLowerCase().includes(q.replace(/^@/, ''))
          ) : candidates;
          if (!filtered.length) return `<div class="text-center text-gray-400 text-sm py-10">No one found${q ? ` for "${escapeHtml(tagPickerSearchQuery)}"` : ''}.</div>`;
          return filtered.map(p => {
            const tagged = composeTaggedUsers.some(u => u.id === p.id);
            const avatarInner = p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : Icon('user','w-4 h-4');
            return `
              <button type="button" onclick="toggleComposeTagPerson('${escapeForJsAttr(p.id)}')" class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left ${tagged ? 'bg-blue-50' : ''}">
                <div class="w-9 h-9 rounded-full bg-blue-50 overflow-hidden flex items-center justify-center flex-shrink-0">${avatarInner}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate">${escapeHtml(p.name)}</div>
                  ${p.username ? `<div class="text-xs text-gray-400 truncate">@${escapeHtml(p.username)}</div>` : ''}
                </div>
                ${tagged ? Icon('check','w-4 h-4 text-blue-600') : ''}
              </button>`;
          }).join('');
        }

        function toggleComposeTagPerson(id){
          const idx = composeTaggedUsers.findIndex(u => u.id === id);
          if (idx !== -1) {
            composeTaggedUsers.splice(idx, 1);
          } else {
            const p = discoverPeople.find(x => x.id === id);
            if (!p || !(p.username || '').trim()) return;
            composeTaggedUsers.push({ id: p.id, name: p.name, username: p.username });
            insertMentionIntoCaption(p.username);
          }
          const chips = document.getElementById('tag-picker-chips');
          if (chips) { chips.innerHTML = composeTaggedChipsHTML(); chips.classList.toggle('hidden', !composeTaggedUsers.length); }
          const list = document.getElementById('tag-picker-list');
          if (list) list.innerHTML = tagPickerListHTML();
        }

        function removeComposeTag(id){
          composeTaggedUsers = composeTaggedUsers.filter(u => u.id !== id);
          const chips = document.getElementById('tag-picker-chips');
          if (chips) { chips.innerHTML = composeTaggedChipsHTML(); chips.classList.toggle('hidden', !composeTaggedUsers.length); }
          else refreshComposeTagChips();
          const list = document.getElementById('tag-picker-list');
          if (list) list.innerHTML = tagPickerListHTML();
        }

        function insertMentionIntoCaption(username){
          const mention = '@' + username;
          const needsSpaceBefore = composeCaptionDraft.length && !/\s$/.test(composeCaptionDraft);
          composeCaptionDraft = composeCaptionDraft + (needsSpaceBefore ? ' ' : '') + mention + ' ';
        }

        function onComposeTextInput(){
          const ta = document.getElementById('new-post-text');
          if (!ta) return;
          const cursor = ta.selectionStart;
          const textBeforeCursor = ta.value.slice(0, cursor);
          if (!/(^|\s)@$/.test(textBeforeCursor)) return;
          ta.value = ta.value.slice(0, cursor - 1) + ta.value.slice(cursor);
          openTagPeoplePicker('');
        }

        // ---- Post submission + carousel display ----
        function postSubmittingOverlayHTML(){
          return `
            <div class="w-full h-full flex flex-col items-center justify-center" style="background:linear-gradient(160deg, #ffffff 0%, #f4f7fc 50%, #ffffff 100%);">
              <div style="width:46px;height:46px;border-radius:50%;border:3px solid rgba(10,37,64,0.14);border-top-color:${NAVY};animation:classroom-spin .7s linear infinite;"></div>
              <div class="mt-4 text-sm font-semibold" style="color:${NAVY};">Updating post...</div>
            </div>`;
        }

        // Guards against a single tap firing submitPost() more than once
        // (e.g. a double-tap, or a tap plus an Enter-key submit landing in
        // the same event tick on a slow device) from creating two separate
        // rows in the shared posts table. Without this, a duplicate insert
        // shows up as an extra post in the feed and in the author's post
        // count everywhere except their own device -- their own client
        // never re-fetches its own already-known "mine" post, so only
        // other viewers (and a fresh reload) see the duplicate.
        let postSubmitInFlight = false;
        function submitPost(){
          if (postSubmitInFlight) return;
          if (!requireCompleteProfile()) return;
          if (!selectedMediaItems.length) { openAppAlertModal('Add a photo or video: the feed only shows posts with pictures or videos'); return; }
          postSubmitInFlight = true;
          const input = document.getElementById('new-post-text');
          const text = (input ? input.value : composeCaptionDraft).trim();
          const finalTaggedUsers = composeTaggedUsers.filter(u => u.username && new RegExp('(^|\\s)@' + u.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s|$)', 'i').test(text));
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = postSubmittingOverlayHTML();
          const mediaFiles = selectedMediaItems.map(it => it.file);
          const mediaTypes = selectedMediaItems.map(it => it.type);
          PostsAPI.create({
            meta: 'Kumasi · now',
            tag: mediaTypes.length > 1 ? 'Album' : (mediaTypes[0] === 'video' ? 'Video' : 'Photo'), tagClass: 'bg-green-100 text-green-700',
            body: text,
            mediaHtml: postMediaCarouselHtml(selectedMediaItems),
            taggedUsers: finalTaggedUsers,
            mediaFiles, mediaTypes,
          }).then(() => {
            postSubmitInFlight = false;
            selectedMediaItems = [];
            selectedMediaHtml = null;
            selectedMediaType = null;
            selectedMediaFile = null;
            selectedMediaPreviewHtml = null;
            composeTaggedUsers = [];
            composeCaptionDraft = '';
            tagPickerSearchQuery = '';
            closeOverlay();
            // Posting can happen from the Home tab, the Profile tab (its
            // own "+" button), or the desktop side nav on any tab, so
            // currentTab isn't necessarily Home here. renderFeed() always
            // rewrites #screen unconditionally -- calling it while the
            // Profile tab is showing would blow away the profile screen
            // instead of the feed, and would also wipe out
            // #profile-tab-content before refreshProfilePostsUI() below
            // gets a chance to update it, which is why a new post used to
            // fail to show up immediately in the feed and on the profile
            // page. Only touch whichever screen is actually on-screen,
            // and drop the cached snapshots of the other tabs so they
            // rebuild fresh (instead of restoring stale cached markup)
            // the next time the person switches to them.
            if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
            if (currentTab === 0) {
              renderFeed();
            } else if (currentTab === 4) {
              if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
            }
          }).catch(() => {
            postSubmitInFlight = false;
            const ov2 = document.getElementById('overlay');
            if (ov2) ov2.innerHTML = createPostHTML(text);
            openAppAlertModal('Something went wrong posting. Please try again.');
          });
        }

        function postMediaCarouselHtml(items){
          if (!items || !items.length) return null;
          if (items.length === 1) return mediaItemFullHtml(items[0]);
          const uid = 'pmc' + Math.random().toString(36).slice(2, 9);
          return `
            <div class="relative post-media-carousel" id="${uid}">
              <div class="flex overflow-x-auto no-scrollbar w-full" style="scroll-snap-type:x mandatory;" onscroll="updatePostCarouselDots('${uid}', this)">
                ${items.map(item => `
                  <div class="flex-shrink-0 w-full" style="scroll-snap-align:center;">
                    ${item.type === 'video'
                      ? simplePostVideoHtml(item.url)
                      : `<img src="${item.url}" class="w-full h-auto">`}
                  </div>`).join('')}
              </div>
              <div class="absolute left-1/2 flex items-center gap-1.5" style="bottom:8px;transform:translateX(-50%);">
                ${items.map((it, i) => `<span data-dot="${i}" class="rounded-full" style="width:5px;height:5px;background:${i===0?'#ffffff':'rgba(255,255,255,0.5)'};box-shadow:0 0 2px rgba(0,0,0,0.4);"></span>`).join('')}
              </div>
            </div>`;
        }

        function updatePostCarouselDots(uid, scroller){
          const container = document.getElementById(uid);
          if (!container) return;
          const idx = Math.round(scroller.scrollLeft / Math.max(1, scroller.clientWidth));
          container.querySelectorAll('[data-dot]').forEach(dot => {
            const active = Number(dot.getAttribute('data-dot')) === idx;
            dot.style.background = active ? '#ffffff' : 'rgba(255,255,255,0.5)';
          });
        }

        let discoverPeople = [];
        let discoverPeopleLoaded = false;
        let discoverSearchQuery = '';

        let discoverLoadError = false;

        async function loadDiscoverPeople(retryCount){
          discoverLoadError = false;
          const sb = getSupabaseClient();
          if (!sb) {
            // The Supabase client can still be spinning up the moment
            // Discover first opens (or briefly during a connectivity
            // blip). That used to mark the list as "loaded" with zero
            // people right away, which is what made the "No one else has
            // signed up yet" empty-state flash even though nobody had
            // actually been checked yet. Keep discoverPeopleLoaded false
            // (so the screen keeps showing "Loading people...") and retry
            // for a few seconds before finally surfacing the real
            // "couldn't load" retry state.
            const attempt = retryCount || 0;
            if (attempt < 12) {
              setTimeout(() => loadDiscoverPeople(attempt + 1), 400);
              return;
            }
            discoverLoadError = true;
            discoverPeopleLoaded = true;
            renderDiscoverList();
            return;
          }
          const withTimeout = (promise) => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
          ]);
          try {
            const [{ data: userRes }, { data, error }] = await withTimeout(Promise.all([
              sb.auth.getUser(),
              sb.from(PUBLIC_PROFILES_TABLE).select('*'),
            ]));
            const me = userRes && userRes.user;
            if (error || !data) { discoverLoadError = true; discoverPeopleLoaded = true; renderDiscoverList(); return; }
            let sentTo = new Set();
            let connectedIds = new Set();
            if (me) {
              const [{ data: fromRows }, { data: toRows }] = await withTimeout(Promise.all([
                sb.from(CONNECTION_REQUESTS_TABLE).select('to_user, status').eq('from_user', me.id),
                sb.from(CONNECTION_REQUESTS_TABLE).select('from_user, status').eq('to_user', me.id),
              ]));
              sentTo = new Set((fromRows || []).filter(r => r.status === 'pending').map(r => r.to_user));
              connectedIds = new Set([
                ...(fromRows || []).filter(r => r.status === 'accepted').map(r => r.to_user),
                ...(toRows || []).filter(r => r.status === 'accepted').map(r => r.from_user),
              ]);
            }
            discoverPeople = data
              .filter(row => !me || row.user_id !== me.id)
              .filter(row => (row.name || '').trim() || (row.username || '').trim())
              .map(row => ({
                id: row.user_id,
                name: row.name || 'Stitch member',
                username: row.username || '',
                sub: row.bio || 'Stitch member',
                icon: 'user',
                avatarBg: 'bg-blue-50',
                photo: row.photo || null,
                requestSent: sentTo.has(row.user_id),
                connected: connectedIds.has(row.user_id),
              }));
            discoverPeopleLoaded = true;
            renderDiscoverList();
          } catch (e) { discoverLoadError = true; discoverPeopleLoaded = true; renderDiscoverList(); }
        }

        // ---- Discover (suggested people) list ----
        function removeFromDiscover(userId){
          if (!userId) return;
          const p = discoverPeople.find(p => p.id === userId);
          if (!p) return;
          p.connected = true;
          p.requestSent = false;
          if (discoverPeopleLoaded) renderDiscoverList();
        }

        function renderDiscoverList(){
          const list = document.getElementById('discover-people-list');
          if (list) list.innerHTML = discoverPeopleHTML();
        }

        function retryLoadDiscoverPeople(){
          discoverPeopleLoaded = false;
          renderDiscoverList();
          loadDiscoverPeople();
        }

        function discoverHTML(){
          return `
            ${overlayHeader('Discover', '20px')}
            <div class="p-5 overflow-y-auto no-scrollbar flex-1">
              <input id="discover-search-input" value="${discoverSearchQuery}" oninput="onDiscoverSearchInput(this.value)" placeholder="Search by name, school, field..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-5" autocomplete="off">
              <div id="discover-people-list">${discoverPeopleHTML()}</div>
            </div>`;
        }

        function discoverLoadingHTML(){
          return `<div class="text-center text-gray-400 text-sm py-10">Loading people...</div>`;
        }

        function discoverPeopleHTML(){
          if (!discoverPeopleLoaded) {
            return discoverLoadingHTML();
          }
          if (discoverLoadError) {
            return `
              <div class="text-center text-gray-400 text-sm py-10">
                Couldn't load people right now.<br>Check your connection and try again.
                <div class="mt-3"><button onclick="retryLoadDiscoverPeople()" class="text-xs font-semibold px-4 py-2 rounded-full" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};">Retry</button></div>
              </div>`;
          }
          const q = discoverSearchQuery.trim().toLowerCase();
          const pool = discoverPeople;
          const filtered = q ? pool.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sub.toLowerCase().includes(q) ||
            (p.username || '').toLowerCase().includes(q.replace(/^@/, ''))
          ) : pool;
          if (!filtered.length && q) return `<div class="text-center text-gray-400 text-sm py-10">No one found for "${escapeHtml(discoverSearchQuery)}".</div>`;
          if (!filtered.length) return `<div class="text-center text-gray-400 text-sm py-10">No one else has signed up yet -- once they do, they'll show up here.</div>`;
          return filtered.map(p => personCard(p)).join('');
        }

        function onDiscoverSearchInput(val){
          discoverSearchQuery = val;
          const list = document.getElementById('discover-people-list');
          if (list) list.innerHTML = discoverPeopleHTML();
        }

        function personCard(p){
          const avatarInner = p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : Icon(p.icon || 'user','w-5 h-5');
          let actionHTML;
          if (p.connected) {
            actionHTML = `<span class="text-xs font-semibold px-4 py-2 rounded-full bg-gray-100 text-gray-400">Connected</span>`;
          } else if (p.requestSent) {
            actionHTML = `<button onclick="cancelConnectionRequest('${p.id}')" class="text-xs font-semibold px-4 py-2 rounded-full bg-gray-100 text-gray-600">Cancel Request</button>`;
          } else {
            actionHTML = `<button onclick="connectToDiscoverPerson('${p.id}')" class="text-xs font-semibold px-4 py-2 rounded-full" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};">Connect</button>`;
          }
          return `
            <div class="bg-white rounded-3xl p-4 flex items-center gap-4 mb-4 shadow-sm">
              <button onclick="openPersonProfileFromDiscover('${p.id}')" class="w-11 h-11 ${p.avatarBg || 'bg-blue-50'} rounded-2xl flex items-center justify-center text-gray-600 overflow-hidden flex-shrink-0">${avatarInner}</button>
              <div class="flex-1 min-w-0 cursor-pointer" onclick="openPersonProfileFromDiscover('${p.id}')">
                <div class="font-semibold text-sm truncate">${escapeHtml(p.name)}</div>
                <div class="text-xs text-gray-500 truncate">${p.username ? `@${escapeHtml(p.username)} · ` : ''}${escapeHtml(p.sub)}</div>
              </div>
              ${actionHTML}
            </div>`;
        }

        async function sendConnectionRequestTo(toUserId, message){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data: userRes } = await sb.auth.getUser();
            const me = userRes && userRes.user;
            if (!me) return false;
            const { error } = await sb.from(CONNECTION_REQUESTS_TABLE).insert({
              id: 'req' + Date.now() + Math.random().toString(36).slice(2,6),
              from_user: me.id,
              to_user: toUserId,
              status: 'pending',
              message: (message || '').trim() || null,
            });
            if (error) { console.warn('sendConnectionRequestTo failed:', error); }
            return !error;
          } catch (e) { console.warn('sendConnectionRequestTo threw:', e); return false; }
        }

        async function cancelMyConnectionRequestTo(toUserId){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data: userRes } = await sb.auth.getUser();
            const me = userRes && userRes.user;
            if (!me) return false;
            const { error } = await sb.from(CONNECTION_REQUESTS_TABLE)
              .delete()
              .eq('from_user', me.id)
              .eq('to_user', toUserId)
              .eq('status', 'pending');
            if (error) { console.warn('cancelMyConnectionRequestTo failed:', error); }
            return !error;
          } catch (e) { console.warn('cancelMyConnectionRequestTo threw:', e); return false; }
        }

        function clearRequestSentLocally(userId){
          const dp = discoverPeople.find(p => p.id === userId);
          if (dp) dp.requestSent = false;
          if (typeof viewedProfile !== 'undefined' && viewedProfile) {
            if (viewedProfile.id === userId) viewedProfile.requestSent = false;
            if (Array.isArray(viewedProfile.network)) {
              const m = viewedProfile.network.find(x => x.id === userId);
              if (m) m.requestSent = false;
            }
          }
        }

        async function connectToDiscoverPerson(id){
          const p = discoverPeople.find(x => x.id === id);
          if (!p || p.connected || p.requestSent) return;
          p.requestSent = true; 
          const list = document.getElementById('discover-people-list');
          if (list) list.innerHTML = discoverPeopleHTML();
          const ok = await sendConnectionRequestTo(id);
          if (!ok) { p.requestSent = false; if (list) list.innerHTML = discoverPeopleHTML(); }
        }

        async function cancelConnectionRequest(id){
          const p = discoverPeople.find(x => x.id === id);
          if (!p || !p.requestSent) return;
          p.requestSent = false; 
          const list = document.getElementById('discover-people-list');
          if (list) list.innerHTML = discoverPeopleHTML();
          const ok = await cancelMyConnectionRequestTo(id);
          if (!ok) { p.requestSent = true; if (list) list.innerHTML = discoverPeopleHTML(); return; }
          clearRequestSentLocally(id);
        }

        let viewedProfile = null; 

        const personProfileCache = {};
        const PERSON_PROFILE_CACHE_MS = 2 * 60 * 1000;

        async function openPersonProfile(userId, fallback){
          if (!userId) return;
          viewedProfile = Object.assign({
            id: userId, name: 'Stitch member', username: '', bio: '', links: [],
            icon: 'user', avatarBg: 'bg-blue-50', photo: null,
            connected: isUserInMyNetwork(userId), requestSent: false, loaded: false,
            network: [], networkLoaded: false, networkCount: null,
          }, fallback || {});
          personProfileTab = 'videos';

          const cached = personProfileCache[userId];
          const isFresh = cached && (Date.now() - cached.ts) < PERSON_PROFILE_CACHE_MS;
          if (cached) {
            Object.assign(viewedProfile, cached.details, cached.network);
          }
          openOverlay('personProfile');

          if (!isFresh) { loadPersonProfileDetails(userId); loadPersonNetwork(userId); }
          else { loadPersonProfileDetails(userId, true); loadPersonNetwork(userId, true); }
          const myId = await getCurrentUserId();
          if (myId && userId === myId && viewedProfile && viewedProfile.id === userId) {
            closeOverlay();
            switchTab(4);
          }
        }

        // ---- Other user's profile (view/connect/message) ----
        function openPersonProfileForConvo(convoId){
          const meta = convoMeta[convoId];
          if (!meta) return;
          // Tapping the header on a group conversation should open the
          // group's own profile (name, photo, members) instead of a
          // person's profile -- and it used to silently do nothing.
          if (meta.icon === 'users') { openConvoProfile(); return; }
          if (!meta.otherUserId) return;
          openPersonProfile(meta.otherUserId, { name: meta.name, photo: meta.photo, icon: meta.icon, avatarBg: meta.avatarBg });
        }

        function openPersonProfileFromDiscover(id){
          overlayReturnTo = 'discover';
          const p = discoverPeople.find(x => x.id === id);
          if (!p) { openPersonProfile(id); return; }
          openPersonProfile(id, { name: p.name, username: p.username, photo: p.photo, icon: p.icon, avatarBg: p.avatarBg });
        }

        async function loadPersonProfileDetails(userId, background){
          const sb = getSupabaseClient();
          if (!sb) { if (viewedProfile && viewedProfile.id === userId) { viewedProfile.loaded = true; renderPersonProfile(); } return; }
          try {
            const me = await getCachedAuthUser();
            const [{ data: row }, { data: fromRows }, { data: toRows }] = await Promise.all([
              sb.from(PUBLIC_PROFILES_TABLE).select('*').eq('user_id', userId).maybeSingle(),
              me ? sb.from(CONNECTION_REQUESTS_TABLE).select('to_user,status').eq('from_user', me.id).eq('to_user', userId) : Promise.resolve({ data: [] }),
              me ? sb.from(CONNECTION_REQUESTS_TABLE).select('from_user,status').eq('to_user', me.id).eq('from_user', userId) : Promise.resolve({ data: [] }),
            ]);
            const existing = (viewedProfile && viewedProfile.id === userId) ? viewedProfile : null;
            const acceptedEitherWay = [...(fromRows || []), ...(toRows || [])].some(r => r.status === 'accepted');
            const details = {
              name: (row && (row.name || row.username)) || (existing && existing.name) || 'Stitch member',
              username: (row && row.username) || (existing && existing.username) || '',
              bio: (row && row.bio) || '',
              photo: (row && row.photo) || (existing && existing.photo) || null,
              links: (row && Array.isArray(row.links)) ? row.links : [],
              connected: acceptedEitherWay || isUserInMyNetwork(userId),
              requestSent: (fromRows || []).some(r => r.status === 'pending'),
              loaded: true,
            };
            const prevCache = personProfileCache[userId];
            personProfileCache[userId] = { ts: Date.now(), network: prevCache ? prevCache.network : undefined, details };
            if (viewedProfile && viewedProfile.id === userId) {
              Object.assign(viewedProfile, details);
              if (!background || JSON.stringify(prevCache && prevCache.details) !== JSON.stringify(details)) {
                renderPersonProfile();
              }
            }
          } catch (e) {
            if (viewedProfile && viewedProfile.id === userId) { viewedProfile.loaded = true; renderPersonProfile(); }
          }
        }

        function renderPersonProfile(){
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'personProfile') ov.innerHTML = personProfileHTML();
        }

        let personProfileTab = 'videos'; 

        function personProfileTabSwitch(tab){
          personProfileTab = tab;
          const bar = document.getElementById('person-profile-tabs');
          if (bar) bar.innerHTML = personProfileTabsHTML();
          const content = document.getElementById('person-profile-tab-content');
          if (content) content.innerHTML = personProfileTabContent();
        }

        function personProfileTabsHTML(){
          const tabBtn = (key, icon) => `
            <button onclick="personProfileTabSwitch('${key}')" class="flex-1 flex justify-center py-3 ${personProfileTab === key ? `border-b-2 border-[${ROYAL}] text-[${NAVY}]` : 'text-gray-400'}">${Icon(icon,'w-5 h-5')}</button>`;
          return tabBtn('videos','videoTile') + tabBtn('pictures','photoTile') + tabBtn('reposts','repost');
        }

        function personProfilePostGroups(){
          const p = viewedProfile || {};
          const authored = (p.id ? feedPosts.filter(post => String(post.authorId) === String(p.id) && !post.isRepost) : []).sort(byNewestFirst);
          const reposts = (p.id ? feedPosts.filter(post => String(post.authorId) === String(p.id) && post.isRepost) : []).sort(byNewestFirst);
          return {
            videos: authored.filter(post => postMediaKind(post) === 'video'),
            pictures: authored.filter(post => postMediaKind(post) === 'picture'),
            reposts,
          };
        }

        function personProfileTabContent(){
          const p = viewedProfile || {};
          const groups = personProfilePostGroups();
          const emptyState = (text) => `<div class="text-gray-400 text-sm text-center py-10">${text}</div>`;
          const name = escapeHtml(p.name || 'This person');
          if (personProfileTab === 'pictures') {
            return groups.pictures.length ? `<div class="profile-thumb-grid">${groups.pictures.map(post => profileGridItem(post, 'author-pictures:' + p.id)).join('')}</div>` : emptyState(`${name}'s pictures will show up here.`);
          }
          if (personProfileTab === 'reposts') {
            return groups.reposts.length ? `<div class="profile-thumb-grid">${groups.reposts.map(post => profileGridItem(post, 'author-reposts:' + p.id)).join('')}</div>` : emptyState(`Posts ${name} reposts will show up here.`);
          }
          return groups.videos.length ? `<div class="profile-thumb-grid">${groups.videos.map(post => profileGridItem(post, 'author-videos:' + p.id)).join('')}</div>` : emptyState(`${name}'s videos will show up here.`);
        }

        async function loadPersonNetwork(userId, background){
          const sb = getSupabaseClient();
          if (!sb) { if (viewedProfile && viewedProfile.id === userId) { viewedProfile.networkLoaded = true; renderPersonProfile(); } return; }
          try {
            const countPromise = sb.rpc('get_network_count', { target_user: userId });
            const [{ data: fromRows }, { data: toRows }, { data: countData, error: countError }] = await Promise.all([
              sb.from(CONNECTION_REQUESTS_TABLE).select('to_user').eq('from_user', userId).eq('status', 'accepted'),
              sb.from(CONNECTION_REQUESTS_TABLE).select('from_user').eq('to_user', userId).eq('status', 'accepted'),
              countPromise,
            ]);
            const otherIds = [
              ...(fromRows || []).map(r => r.to_user),
              ...(toRows || []).map(r => r.from_user),
            ].filter((id, i, arr) => id && id !== userId && arr.indexOf(id) === i);

            const networkCount = (!countError && typeof countData === 'number') ? countData : otherIds.length;
            if (viewedProfile && viewedProfile.id === userId) {
              const countChanged = !background || !personProfileCache[userId] || personProfileCache[userId].network.networkCount !== networkCount;
              viewedProfile.networkCount = networkCount;
              if (countChanged) renderPersonProfile();
            }

            let network = [];
            if (otherIds.length) {
              const { data: profiles } = await sb.from(PUBLIC_PROFILES_TABLE).select('*').in('user_id', otherIds);
              const profileById = {};
              (profiles || []).forEach(p => { profileById[p.user_id] = p; });
              network = otherIds.map(id => {
                const p = profileById[id];
                return {
                  id,
                  name: (p && (p.name || p.username)) || 'Stitch member',
                  username: (p && p.username) || '',
                  photo: (p && p.photo) || null,
                  icon: 'user', avatarBg: 'bg-blue-50',
                  connected: isUserInMyNetwork(id), requestSent: false,
                };
              });
            }

            const newNetworkCache = { networkCount, network, networkLoaded: true };
            const prevCache = personProfileCache[userId];
            const listChanged = !background || !prevCache || JSON.stringify(prevCache.network) !== JSON.stringify(newNetworkCache);
            personProfileCache[userId] = { ts: Date.now(), details: prevCache ? prevCache.details : undefined, network: newNetworkCache };

            if (viewedProfile && viewedProfile.id === userId) {
              viewedProfile.network = network;
              viewedProfile.networkLoaded = true;
              viewedProfile.networkCount = networkCount;
              if (listChanged) renderPersonProfile();
            }
          } catch (e) {
            if (viewedProfile && viewedProfile.id === userId) { viewedProfile.networkLoaded = true; renderPersonProfile(); }
          }
        }

        async function prefetchContactProfiles(){
          if (typeof convoArrays !== 'function') return;
          const ids = [...new Set(convoArrays().flat().map(c => c.otherUserId).filter(Boolean))];
          if (!ids.length) return;
          const CONCURRENCY = 4;
          let next = 0;
          async function worker(){
            while (next < ids.length) {
              const id = ids[next++];
              const cached = personProfileCache[id];
              if (cached && (Date.now() - cached.ts) < PERSON_PROFILE_CACHE_MS) continue;
              await Promise.all([
                loadPersonProfileDetails(id, true).catch(() => {}),
                loadPersonNetwork(id, true).catch(() => {}),
              ]);
            }
          }
          await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
        }

        // ---- Other user's network/connections list ----
        function openPersonNetwork(){
          if (!viewedProfile) return;
          openOverlay('personNetwork');
        }

        function personNetworkHTML(){
          const p = viewedProfile || {};
          const list = p.network || [];
          return `
            ${overlayHeader((p.name || 'Their') + '\u2019s Network', '20px', "openOverlay('personProfile')")}
            <div class="flex-1 overflow-y-auto px-5 pb-6">
              ${!p.networkLoaded ? `<div class="text-center text-gray-400 text-xs py-8">Loading network...</div>` : (
                list.length ? `<div class="divide-y divide-gray-100">${list.map(personNetworkRow).join('')}</div>`
                : `<div class="py-8 text-center text-gray-400 text-sm">No connections yet.</div>`
              )}
            </div>`;
        }

        function personNetworkRow(m){
          let actionHTML;
          if (m.connected) {
            actionHTML = `<span class="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-gray-100 text-gray-400">Connected</span>`;
          } else if (m.requestSent) {
            actionHTML = `<button onclick="event.stopPropagation(); cancelConnectionRequestFromNetwork('${m.id}')" class="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-gray-100 text-gray-600">Cancel Request</button>`;
          } else {
            actionHTML = `<button onclick="event.stopPropagation(); connectWithNetworkMember('${m.id}')" class="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};">Connect</button>`;
          }
          return `
            <div onclick="openPersonProfile('${m.id}', {name:'${escapeForJsAttr(m.name)}', photo:${m.photo ? `'${escapeForJsAttr(m.photo)}'` : 'null'}, icon:'${m.icon}', avatarBg:'${m.avatarBg}'})" role="button" class="w-full flex items-center gap-3 py-3 text-left cursor-pointer">
              <div class="w-11 h-11 rounded-full ${m.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInnerHTML(m,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-[15px] text-gray-900 truncate">${escapeHtml(m.name)}</div>
                ${m.username ? `<div class="text-xs text-gray-400 mt-0.5 truncate">@${escapeHtml(m.username)}</div>` : ''}
              </div>
              ${actionHTML}
            </div>`;
        }

        async function connectWithNetworkMember(id){
          if (!viewedProfile) return;
          const m = (viewedProfile.network || []).find(x => x.id === id);
          if (!m || m.connected || m.requestSent) return;
          m.requestSent = true; 
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          const ok = await sendConnectionRequestTo(id);
          if (!ok) {
            m.requestSent = false;
            if (ov && currentOverlayKind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          }
        }

        async function cancelConnectionRequestFromNetwork(id){
          if (!viewedProfile) return;
          const m = (viewedProfile.network || []).find(x => x.id === id);
          if (!m || !m.requestSent) return;
          m.requestSent = false; 
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          const ok = await cancelMyConnectionRequestTo(id);
          if (!ok) {
            m.requestSent = true;
            if (ov && currentOverlayKind === 'personNetwork') ov.innerHTML = personNetworkHTML();
            return;
          }
          clearRequestSentLocally(id);
        }

        async function connectWithViewedProfile(){
          if (!viewedProfile || viewedProfile.connected || viewedProfile.requestSent) return;
          const id = viewedProfile.id;
          viewedProfile.requestSent = true; 
          renderPersonProfile();
          const ok = await sendConnectionRequestTo(id);
          if (!viewedProfile || viewedProfile.id !== id) return; 
          if (!ok) { viewedProfile.requestSent = false; renderPersonProfile(); return; }
          const dp = discoverPeople.find(p => p.id === id);
          if (dp) dp.requestSent = true;
        }

        async function cancelConnectionRequestWithViewedProfile(){
          if (!viewedProfile || !viewedProfile.requestSent) return;
          const id = viewedProfile.id;
          viewedProfile.requestSent = false; 
          renderPersonProfile();
          const ok = await cancelMyConnectionRequestTo(id);
          if (!viewedProfile || viewedProfile.id !== id) return; 
          if (!ok) { viewedProfile.requestSent = true; renderPersonProfile(); return; }
          const dp = discoverPeople.find(p => p.id === id);
          if (dp) dp.requestSent = false;
        }

        // ---- Message request compose (replaces the old prompt()-based
        //      flow) -- tapping "Message" on someone you're not connected
        //      with yet opens a small chat-style compose screen instead of
        //      a native browser prompt, so the person can type (and see)
        //      the note that goes out with their connect request. ----
        let messageRequestComposeDraft = '';
        function messageAndConnectViewedProfile(){
          if (!viewedProfile || viewedProfile.connected || viewedProfile.requestSent) return;
          messageRequestComposeDraft = '';
          openOverlayFrom('personProfile', 'messageRequestCompose');
        }

        function messageRequestComposeHTML(){
          const p = viewedProfile || {};
          const avatarInner = p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : Icon(p.icon || 'user','w-5 h-5');
          return `
            <div class="px-5 pb-3 flex items-center gap-3 flex-shrink-0 border-b border-gray-100" style="padding-top:var(--top-safe-pad);">
              <button onclick="overlayGoBack()">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <div class="w-10 h-10 ${p.avatarBg || 'bg-blue-50'} rounded-2xl flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarInner}</div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm font-display truncate grad-text">${escapeHtml(p.name || 'Stitch member')}</div>
                <div class="text-xs text-gray-400 truncate">New message request</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-5 flex flex-col items-center justify-center text-center gap-2">
              <div class="w-16 h-16 ${p.avatarBg || 'bg-blue-50'} rounded-full flex items-center justify-center text-gray-600 overflow-hidden">${avatarInner}</div>
              <div class="font-semibold text-sm text-gray-900 mt-1">${escapeHtml(p.name || 'Stitch member')}</div>
              <div class="text-xs text-gray-400 max-w-[240px]">You're not connected yet. Send a message along with your connect request to say hello.</div>
            </div>
            <div class="flex-shrink-0 px-3 pt-2" style="padding-bottom:20px;">
              <div class="flex items-center gap-2 rounded-3xl px-2 py-1.5" style="background:#ffffff;border:1.5px solid rgba(10,37,64,0.10);box-shadow:0 8px 24px rgba(10,37,64,0.10);">
                <textarea id="message-request-compose-input" placeholder="Write a message..." rows="1" enterkeyhint="send" oninput="autoGrowConvoInput(this); messageRequestComposeDraft = this.value;" onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); submitMessageRequestCompose(); }" class="flex-1 min-w-0 bg-transparent text-sm resize-none leading-snug self-center" style="max-height:120px;overflow-y:auto;">${escapeHtml(messageRequestComposeDraft)}</textarea>
                <button onclick="submitMessageRequestCompose()" class="w-8 h-8 text-white rounded-full flex items-center justify-center flex-shrink-0" style="background:${NAVY};">${Icon('send','w-4 h-4')}</button>
              </div>
            </div>`;
        }

        async function submitMessageRequestCompose(){
          if (!viewedProfile || viewedProfile.connected || viewedProfile.requestSent) { overlayGoBack(); return; }
          const inputEl = document.getElementById('message-request-compose-input');
          const note = (inputEl ? inputEl.value : messageRequestComposeDraft || '').trim();
          const id = viewedProfile.id;
          messageRequestComposeDraft = '';
          viewedProfile.requestSent = true;
          overlayGoBack();
          renderPersonProfile();
          const ok = await sendConnectionRequestTo(id, note);
          if (!viewedProfile || viewedProfile.id !== id) return; 
          if (!ok) { viewedProfile.requestSent = false; renderPersonProfile(); return; }
          const dp = discoverPeople.find(p => p.id === id);
          if (dp) dp.requestSent = true;
        }

        async function messageViewedProfile(){
          if (!viewedProfile) return;
          const id = viewedProfile.id;
          const p = viewedProfile;
          const existing = convoArrays().flat().find(c => c.otherUserId === id);
          closeOverlay();
          if (existing) { startNewMessageWith(existing.id); return; }
          // Bug: when two people are connected but have never exchanged a
          // message yet, no conversation entry/convoMeta exists locally
          // (those only get created by loadMyAcceptedIncomingRequests /
          // loadMyAcceptedOutgoingRequests, or by an earlier message).
          // Tapping "Message" here used to just closeOverlay() and stop --
          // silently dumping the person back on whatever screen was behind
          // the profile instead of opening a chat. Look up the accepted
          // connection between us and this person and build the same
          // conversation entry those loaders would have, then open it.
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const me = await getCachedAuthUser();
            if (!me) return;
            const { data: rows } = await sb
              .from(CONNECTION_REQUESTS_TABLE)
              .select('*')
              .eq('status', 'accepted')
              .or(`and(from_user.eq.${me.id},to_user.eq.${id}),and(from_user.eq.${id},to_user.eq.${me.id})`)
              .limit(1);
            const row = rows && rows[0];
            if (!row) { if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't start that chat. Please try again."); return; }
            if (viewedProfile !== p || p.id !== id) return; 
            const convoId = row.id;
            if (!convoMeta[convoId]) {
              const entry = {
                id: convoId,
                connectionRequestId: row.id,
                otherUserId: id,
                icon: p.icon || 'user',
                avatarBg: p.avatarBg || 'bg-blue-50',
                name: p.name || 'Stitch member',
                username: p.username || '',
                photo: p.photo || null,
                preview: '',
                time: formatRequestTime(row.created_at),
                unread: false,
                read: true,
                network: true,
              };
              primaryConvos.unshift(entry);
              convoMeta[convoId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: entry.preview, otherUserId: id };
              queueSaveUserState();
            }
            startNewMessageWith(convoId);
          } catch (e) { console.warn('Starting conversation failed:', e); if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't start that chat. Please try again."); }
        }

        function removeLocalConnection(otherUserId){
          let changed = false;
          for (const arr of convoArrays()){
            const idx = arr.findIndex(c => c.otherUserId === otherUserId);
            if (idx !== -1) {
              const [c] = arr.splice(idx, 1);
              delete convoMeta[c.id];
              changed = true;
            }
          }
          if (changed) queueSaveUserState();
          if (typeof cachedNetworkCount !== 'undefined' && cachedNetworkCount !== null && cachedNetworkCount > 0) cachedNetworkCount -= 1;
          renderInboxTab();
          if (currentTab === 4) renderProfile(); 
        }

        function removeConnectionWithViewedProfile(){
          if (!viewedProfile || !viewedProfile.connected) return;
          const id = viewedProfile.id;
          openAppConfirmModal(`Remove ${viewedProfile.name || 'this person'} from your network?`, '', 'Remove', async function(){
            viewedProfile.connected = false; 
            renderPersonProfile();
            removeLocalConnection(id);
            const sb = getSupabaseClient();
            if (!sb) return;
            try {
              const { data: userRes } = await sb.auth.getUser();
              const me = userRes && userRes.user;
              if (!me) return;
              await sb.from(CONNECTION_REQUESTS_TABLE).update({ status: 'removed' }).eq('from_user', me.id).eq('to_user', id).eq('status', 'accepted');
              await sb.from(CONNECTION_REQUESTS_TABLE).update({ status: 'removed' }).eq('from_user', id).eq('to_user', me.id).eq('status', 'accepted');
              if (typeof refreshNetworkCount === 'function') refreshNetworkCount();
            } catch (e) { console.warn('Removing connection failed:', e); }
          });
        }

        function personProfileHTML(){
          const p = viewedProfile || {};
          const avatarInner = p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : Icon(p.icon || 'user','w-10 h-10');
          let actionHTML;
          if (p.connected) {
            actionHTML = `
              <div class="flex gap-3">
                <button onclick="removeConnectionWithViewedProfile()" class="flex-1 py-2.5 rounded-2xl font-semibold text-sm bg-red-50 text-red-500">Remove</button>
                <button onclick="messageViewedProfile()" class="flex-1 py-2.5 rounded-2xl font-semibold text-sm bg-gray-100" style="color:${NAVY};">Message</button>
              </div>`;
          } else if (p.requestSent) {
            actionHTML = `<button onclick="cancelConnectionRequestWithViewedProfile()" class="w-full py-2.5 rounded-2xl font-semibold text-sm bg-gray-100 text-gray-600">Cancel Request</button>`;
          } else {
            actionHTML = `
              <div class="flex gap-3">
                <button onclick="connectWithViewedProfile()" class="flex-1 py-2.5 rounded-2xl font-semibold text-sm text-white" style="background:linear-gradient(135deg, rgba(65,105,225,0.9), ${NAVY});">Connect</button>
                <button onclick="messageAndConnectViewedProfile()" class="flex-1 py-2.5 rounded-2xl font-semibold text-sm bg-gray-100" style="color:${NAVY};">Message</button>
              </div>`;
          }
          const postGroups = personProfilePostGroups();
          const theirPostsCount = postGroups.videos.length + postGroups.pictures.length + postGroups.reposts.length;
          const networkCount = typeof p.networkCount === 'number' ? p.networkCount : '\u00b7\u00b7\u00b7';
          return `
            ${overlayHeader('Profile', '20px')}
            <div class="flex-1 overflow-y-auto">
            <div class="p-5">
              <div class="flex flex-col items-center text-center mb-4">
                <button ${p.photo ? `onclick="viewProfilePhoto('${escapeForJsAttr(p.photo)}', '${escapeForJsAttr(p.name || 'Stitch member')}')"` : ''} class="w-24 h-24 ${p.avatarBg || 'bg-blue-50'} rounded-full flex items-center justify-center text-gray-600 mb-3 overflow-hidden">${avatarInner}</button>
                <div class="font-bold text-xl font-display text-[${NAVY}]">${escapeHtml(p.name || 'Stitch member')}</div>
                ${p.username ? `<div class="text-sm text-gray-400 mt-0.5">@${escapeHtml(p.username)}</div>` : ''}
              </div>
              <div class="flex items-center justify-center gap-8 mb-5">
                <div class="text-center"><div class="text-base font-bold">${theirPostsCount}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Posts</div></div>
                <button onclick="openPersonNetwork()" class="text-center"><div class="text-base font-bold">${networkCount}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Network</div></button>
              </div>
              ${!p.loaded ? `<div class="text-center text-gray-400 text-xs mb-6">Loading profile...</div>` : `
                ${p.bio ? `<div class="text-sm text-gray-600 text-center mb-4">${escapeHtml(p.bio)}</div>` : ''}
                ${profileLinksHTML(p.links, { center: true })}
              `}
              <div class="max-w-sm mx-auto mb-6">${actionHTML}</div>
            </div>
            <div class="flex border-t border-gray-200" id="person-profile-tabs">${personProfileTabsHTML()}</div>
            <div class="px-5 py-3" id="person-profile-tab-content">${personProfileTabContent()}</div>
            </div>`;
        }

        let pressTimer = null;
        let longPressFired = false;
        let pressStartX = 0;
        let pressStartY = 0;

        // ---- Long-press row selection (notif/notice lists) ----
        function startPress(fnName, id, evt){
          longPressFired = false;
          clearTimeout(pressTimer);
          const pt = (evt && evt.touches && evt.touches[0]) ? evt.touches[0] : evt;
          pressStartX = pt ? pt.clientX : 0;
          pressStartY = pt ? pt.clientY : 0;
          pressTimer = setTimeout(function(){
            longPressFired = true;
            if (navigator.vibrate) navigator.vibrate(10);
            window[fnName](id);
          }, 550);
        }
        function endPress(){
          clearTimeout(pressTimer);
        }
        function movePress(evt){
          const pt = (evt && evt.touches && evt.touches[0]) ? evt.touches[0] : evt;
          if (!pt) return;
          const dx = Math.abs(pt.clientX - pressStartX);
          const dy = Math.abs(pt.clientY - pressStartY);
          if (dx > 12 || dy > 12) endPress();
        }
        function handleRowTap(fnName, id){
          if (longPressFired) { longPressFired = false; return; }
          window[fnName](id);
        }

        function notifActionsDropdownHTML(handlerName, opts){
          opts = opts || {};
          const showDelete = opts.showDelete !== false;
          const side = opts.align === 'left' ? 'left:1.25rem;' : 'right:1.25rem;';
          return `
            <div class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="${side}top:3.5rem;width:13rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="${handlerName}('pin')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('pin','w-4 h-4')} Pin</button>
              <button onclick="${handlerName}('read')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('check','w-4 h-4')} Mark as read</button>
              <button onclick="${handlerName}('block')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('lock','w-4 h-4')} Block</button>
              ${showDelete ? `
              <div class="border-t border-gray-100 my-1"></div>
              <button onclick="${handlerName}('delete')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete</button>` : ''}
            </div>`;
        }

        const notifData = [];

        let notifChimeAudioCtx = null;
        // ---- Notifications: sound, add, badge, ticker ----
        function getNotifChimeAudioCtx(){
          if (!notifChimeAudioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) notifChimeAudioCtx = new Ctx();
          }
          return notifChimeAudioCtx;
        }
        function playNotifChime(title, body){
          if (navigator.vibrate) navigator.vibrate(150);
          if (typeof soundMuted !== 'undefined' && soundMuted) return;
          // Prefer the device's own notification tone (set in the phone's
          // system settings, or the browser's default) over a synthesized
          // beep. Fall back to the old in-app chime only when neither is
          // available (e.g. permission not granted yet).
          if (typeof playDeviceNotificationSound === 'function') {
            playDeviceNotificationSound(title || 'Stitch', body || '').then(played => {
              if (!played) playSynthesizedNotifChime();
            });
            return;
          }
          playSynthesizedNotifChime();
        }
        function playSynthesizedNotifChime(){
          const ctx = getNotifChimeAudioCtx();
          if (!ctx) return;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          [ [880, 0], [1175, 0.09] ].forEach(([freq, delay]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t0 = ctx.currentTime + delay;
            const duration = 0.18;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(0.14, t0 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + duration + 0.03);
          });
        }

        function addNotif(opts){
          opts = opts || {};
          const id = opts.id || ('notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
          if (notifData.some(n => n.id === id)) return id;
          notifData.unshift({
            id,
            source: opts.source || 'app',
            type: opts.type || 'info',
            icon: opts.icon || 'bell',
            iconBg: opts.iconBg || 'bg-blue-50',
            iconClass: opts.iconClass || 'text-blue-600',
            name: opts.name || 'Stitch',
            message: opts.message || '',
            createdAt: opts.createdAt || Date.now(),
            time: 'now',
            read: false,
            pinned: false,
            otherUserId: opts.otherUserId || null,
            convoId: opts.convoId || null,
            postId: opts.postId != null ? opts.postId : null,
            classId: opts.classId || null,
            jobId: opts.jobId || null,
            workId: opts.workId || null,
            route: opts.route || null,
          });
          playNotifChime(opts.name || 'Stitch', opts.message || '');
          queueSaveUserState();
          refreshNotifBadge();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
          if (typeof appPrefs !== 'undefined' && appPrefs.notifEmail && typeof sendEmailNotification === 'function') {
            sendEmailNotification({
              subject: opts.name ? `${opts.name}: ${opts.message || 'New notification'}` : (opts.message || 'New notification on Stitch'),
              title: opts.name || 'Stitch',
              body: opts.message || '',
            });
          }
          return id;
        }

        function markNotifsReadForConvo(convoId){
          if (!convoId) return;
          let changed = false;
          notifData.forEach(n => {
            if ((n.type === 'message' || n.type === 'missed_call' || n.type === 'info' || n.type === 'group') && n.convoId === convoId && !n.read) { n.read = true; changed = true; }
          });
          if (!changed) return;
          queueSaveUserState();
          refreshNotifBadge();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
        }

        function formatNotifTime(ts){
          if (!ts) return 'now';
          const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
          if (diffSec < 60) return 'now';
          const mins = Math.floor(diffSec / 60);
          if (mins < 60) return mins + 'm';
          const hours = Math.floor(mins / 60);
          if (hours < 24) return hours + 'h';
          const days = Math.floor(hours / 24);
          if (days < 7) return days + 'd';
          const weeks = Math.floor(days / 7);
          if (weeks < 5) return weeks + 'w';
          return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }

        let notifTimeTickInterval = null;
        function startNotifTimeTicker(){
          if (notifTimeTickInterval) return;
          notifTimeTickInterval = setInterval(() => {
            document.querySelectorAll('[data-notif-time]').forEach(el => {
              const n = notifData.find(x => x.id === el.getAttribute('data-notif-time'));
              if (n) el.textContent = formatNotifTime(n.createdAt);
            });
          }, 30000);
        }

        function updateNotifOutcome(notifId, message, markRead){
          if (!notifId) return;
          const n = notifData.find(x => x.id === notifId);
          if (!n) return;
          if (message) n.message = message;
          if (markRead) n.read = true;
          queueSaveUserState();
          refreshNotifBadge();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
        }

        function refreshNotifBadge(){
          if (typeof unreadNotifCount !== 'function') return;
          const count = unreadNotifCount();
          const existing = document.getElementById('notif-badge');
          if (count) {
            if (existing) {
              existing.textContent = count;
            } else {
              const topbarIcons = document.getElementById('topbar-icons');
              const bellBtn = topbarIcons && topbarIcons.querySelector('button:last-child');
              if (bellBtn) bellBtn.insertAdjacentHTML('beforeend', `<span id="notif-badge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">${count}</span>`);
            }
          } else if (existing) {
            existing.remove();
          }

          const dnavBtn = document.getElementById('dnav-notif');
          if (dnavBtn) {
            const dnavExisting = document.getElementById('dnav-notif-badge');
            if (count) {
              if (dnavExisting) dnavExisting.textContent = count;
              else dnavBtn.insertAdjacentHTML('beforeend', `<span id="dnav-notif-badge">${count}</span>`);
            } else if (dnavExisting) {
              dnavExisting.remove();
            }
          }

          if (typeof unreadClassroomNotifCount !== 'function') return;
          const classroomCount = unreadClassroomNotifCount();
          const cnavBtn = document.getElementById('cnav-notif');
          if (cnavBtn) {
            const iconWrap = cnavBtn.querySelector('span.relative');
            const existing = document.getElementById('cnav-notif-badge');
            if (classroomCount) {
              if (existing) existing.textContent = classroomCount;
              else if (iconWrap) iconWrap.insertAdjacentHTML('beforeend', `<span id="cnav-notif-badge" class="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">${classroomCount}</span>`);
            } else if (existing) {
              existing.remove();
            }
          }
          const dcnavBtn = document.getElementById('dcnav-notif');
          if (dcnavBtn) {
            const existing = document.getElementById('dcnav-notif-badge');
            if (classroomCount) {
              if (existing) existing.textContent = classroomCount;
              else dcnavBtn.insertAdjacentHTML('beforeend', `<span id="dcnav-notif-badge">${classroomCount}</span>`);
            } else if (existing) {
              existing.remove();
            }
          }
        }

        let notifSelected = new Set();
        let notifMenuOpen = false;

        // ---- Notifications tab render + actions ----
        function toggleNotifMenu(){
          notifMenuOpen = !notifMenuOpen;
          renderNotifTab();
        }

        function notifLongPressSelect(id){
          notifSelected.add(id);
          renderNotifTab();
        }
        function notifTap(id){
          if (notifSelected.size){
            if (notifSelected.has(id)) notifSelected.delete(id); else notifSelected.add(id);
            renderNotifTab();
            return;
          }
          const n = notifData.find(x => x.id === id);
          if (!n) return;
          if ((n.type === 'message' || n.type === 'missed_call' || n.type === 'info' || n.type === 'group') && n.convoId) {
            n.read = true;
            queueSaveUserState();
            closeOverlay();
            openConversation(n.convoId);
            return;
          }
          if ((n.type === 'post' || n.type === 'comment' || n.type === 'like' || n.type === 'repost' || n.type === 'tag' || n.type === 'share') && n.postId != null && typeof openComments === 'function') {
            n.read = true;
            queueSaveUserState();
            closeOverlay();
            switchTab(0);
            openComments(n.postId);
            return;
          }
          if (n.type === 'classroom' && n.classId && typeof openOverlay === 'function') {
            n.read = true;
            queueSaveUserState();
            refreshNotifBadge();
            currentClassId = n.classId;
            if (n.workId && typeof openClassworkDetail === 'function') {
              openClassworkDetail(n.workId);
            } else {
              classDetailTab = 'stream';
              openOverlay('classDetail');
            }
            return;
          }
          if (n.type === 'opportunity' && n.jobId && typeof openJobDetail === 'function') {
            n.read = true;
            queueSaveUserState();
            closeOverlay();
            openJobDetail(n.jobId);
            return;
          }
          if (n.route === 'careerMatches' && typeof openCareerMatchesPage === 'function') {
            n.read = true;
            queueSaveUserState();
            closeOverlay();
            openCareerMatchesPage();
            return;
          }
          if (n.type === 'connect_accepted' && n.otherUserId && typeof openPersonProfile === 'function') {
            n.read = true;
            queueSaveUserState();
            openPersonProfile(n.otherUserId, { name: n.name, icon: n.icon, avatarBg: n.iconBg });
            return;
          }
          if (n.type === 'connect_request' && n.otherUserId && typeof openPersonProfile === 'function') {
            n.read = true;
            queueSaveUserState();
            refreshNotifBadge();
            openPersonProfile(n.otherUserId, { name: n.name, icon: n.icon, avatarBg: n.iconBg });
            return;
          }
          if (!n.read) {
            n.read = true;
            queueSaveUserState();
            refreshNotifBadge();
            renderNotifTab();
          }
        }
        function notifCancelSelect(){
          notifSelected.clear();
          renderNotifTab();
        }

        function renderNotifTab(){
          const ov = document.getElementById('overlay');
          const prevNotifScrollEl = ov.querySelector('.overflow-y-auto');
          const prevNotifScrollTop = prevNotifScrollEl ? prevNotifScrollEl.scrollTop : 0;
          ov.innerHTML = `
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
              ${menuOverlayHeader('Notifications', notifMenuOpen, 'toggleNotifMenu', notifActionsDropdownHTML('handleNotifAction'), { backFn: notifSelected.size ? 'notifCancelSelect' : 'closeOverlay', hideMenuOnDesktop: true })}
              <div class="p-5">
                <div class="notif-list">${notifCards(null, { selected: notifSelected, longPressFn: 'notifLongPressSelect', tapFn: 'notifTap' })}</div>
              </div>
            </div>`;
          if (prevNotifScrollTop) {
            const restoredNotifScrollEl = ov.querySelector('.overflow-y-auto');
            if (restoredNotifScrollEl) restoredNotifScrollEl.scrollTop = prevNotifScrollTop;
          }
          attachMenuScrollCloser(ov.querySelector('.overflow-y-auto'), notifMenuOpen, 'toggleNotifMenu');
        }

        let notifItemMenuOpenId = null;

        function toggleNotifItemMenu(id, renderFnName, event){
          if (event) event.stopPropagation();
          notifItemMenuOpenId = (notifItemMenuOpenId === id) ? null : id;
          const fn = window[renderFnName || 'renderNotifTab'];
          if (typeof fn === 'function') fn();
        }

        function notifItemAction(id, action, renderFnName){
          notifItemMenuOpenId = null;
          applyNotifAction(action, new Set([id]), function(){
            const fn = window[renderFnName || 'renderNotifTab'];
            if (typeof fn === 'function') fn();
          });
        }

        function notifItemMenuHTML(n, renderFn){
          return `
            <div onclick="event.stopPropagation(); toggleNotifItemMenu('${n.id}','${renderFn}')" class="fixed inset-0 z-20"></div>
            <div onclick="event.stopPropagation()" class="notif-item-menu absolute right-0 top-9 bg-white rounded-2xl border border-gray-100 py-2 z-30" style="width:12rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="event.stopPropagation(); notifItemAction('${n.id}','pin','${renderFn}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('pin','w-4 h-4')} Pin</button>
              <button onclick="event.stopPropagation(); notifItemAction('${n.id}','read','${renderFn}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('check','w-4 h-4')} Mark as read</button>
              <button onclick="event.stopPropagation(); notifItemAction('${n.id}','block','${renderFn}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('lock','w-4 h-4')} Block</button>
              <div class="border-t border-gray-100 my-1"></div>
              <button onclick="event.stopPropagation(); notifItemAction('${n.id}','delete','${renderFn}')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete</button>
            </div>`;
        }

        function notifCards(list, opts){
          opts = opts || {};
          const selectedSet = opts.selected || new Set();
          const longPressFn = opts.longPressFn || 'notifLongPressSelect';
          const tapFn = opts.tapFn || 'notifTap';
          const renderFn = opts.renderFn || 'renderNotifTab';
          const selecting = selectedSet.size > 0;
          startNotifTimeTicker();
          return (list || notifData).map(n => {
            const isSel = selectedSet.has(n.id);
            const itemMenuOpen = notifItemMenuOpenId === n.id;
            return `
            <div class="rounded-3xl p-4 flex items-start gap-3 ${isSel ? '' : (n.read ? 'bg-gray-50' : 'bg-amber-50')}"
              style="${isSel ? `background:rgba(65,105,225,0.14);` : ''}"
              onmousedown="startPress('${longPressFn}','${n.id}', event)" onmouseup="endPress()" onmouseleave="endPress()"
              ontouchstart="startPress('${longPressFn}','${n.id}', event)" ontouchend="endPress()" ontouchmove="movePress(event)" ontouchcancel="endPress()"
              onclick="handleRowTap('${tapFn}','${n.id}')">
              ${selecting
                ? `<div class="w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0" style="${isSel ? `background:${ROYAL};border-color:${ROYAL};` : 'border-color:#d1d5db;'}">${isSel ? Icon('check','w-4 h-4 text-white') : ''}</div>`
                : `<div class="w-10 h-10 ${n.iconBg} rounded-2xl flex items-center justify-center ${n.iconClass} flex-shrink-0">${Icon(n.icon,'w-5 h-5')}</div>`}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-sm ${n.read ? 'text-gray-500' : `text-[${NAVY}]`}">${escapeHtml(n.name)}</div>
                  ${n.pinned ? Icon('pin','w-3.5 h-3.5 text-amber-600') : ''}
                </div>
                <div class="text-sm ${n.read ? 'text-gray-400' : 'text-gray-600'} mt-0.5 leading-relaxed">${escapeHtml(n.message)}</div>
                ${n.type === 'connect_request' ? `
                <div class="flex gap-2 mt-3">
                  <button onclick="event.stopPropagation(); acceptConnection('${n.id}')" class="px-4 py-2 rounded-full text-xs font-semibold bg-gray-100 text-[${NAVY}]">Accept</button>
                  <button onclick="event.stopPropagation(); declineConnection('${n.id}')" class="px-4 py-2 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Decline</button>
                </div>` : ''}
              </div>
              <div class="flex flex-col items-center gap-1 flex-shrink-0 relative">
                ${selecting ? '' : `
                <button onclick="event.stopPropagation(); deleteNotif('${n.id}')" class="notif-action-mobile w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500" title="Delete">${Icon('trash','w-4 h-4')}</button>
                <button onclick="toggleNotifItemMenu('${n.id}','${renderFn}', event)" class="notif-action-desktop w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600" title="More options">${Icon('dashes','w-4 h-4')}</button>`}
                <div class="text-[10px] text-gray-400 whitespace-nowrap" data-notif-time="${n.id}">${formatNotifTime(n.createdAt)}</div>
                ${itemMenuOpen ? notifItemMenuHTML(n, renderFn) : ''}
              </div>
            </div>`;
          }).join('');
        }

        // ---- Connection request accept/decline ----
        function deleteNotif(id){
          const idx = notifData.findIndex(x => x.id === id);
          if (idx === -1) return;
          notifData.splice(idx, 1);
          queueSaveUserState();
          refreshNotifBadge();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classAnnouncements') renderClassAnnouncementsTab();
          if (typeof rightPanelMode !== 'undefined' && rightPanelMode === 'pinned') renderRightPanelBody();
        }

        function acceptConnection(id){
          const n = notifData.find(x => x.id === id);
          if (!n) return;
          notifData.splice(notifData.indexOf(n), 1);
          queueSaveUserState();
          if (typeof acceptRequest === 'function') acceptRequest(id);
          refreshNotifBadge();
          renderNotifTab();
        }

        function declineConnection(id){
          const n = notifData.find(x => x.id === id);
          if (!n) return;
          notifData.splice(notifData.indexOf(n), 1);
          queueSaveUserState();
          if (typeof rejectRequest === 'function') rejectRequest(id);
          refreshNotifBadge();
          renderNotifTab();
        }

        function applyNotifAction(action, selectedSet, doneFn){
          if (!selectedSet.size){
            doneFn();
            openAppAlertModal('Tap and hold a message to select it first.');
            return;
          }
          const ids = Array.from(selectedSet);
          if (action === 'delete'){
            for (let i = notifData.length - 1; i >= 0; i--){
              if (selectedSet.has(notifData[i].id)) notifData.splice(i, 1);
            }
          } else if (action === 'pin'){
            ids.forEach(id => {
              const n = notifData.find(x => x.id === id);
              if (n) n.pinned = !n.pinned;
            });
            notifData.sort((a,b) => (b.pinned?1:0) - (a.pinned?1:0));
          } else if (action === 'read'){
            ids.forEach(id => {
              const n = notifData.find(x => x.id === id);
              if (n) n.read = true;
            });
          } else if (action === 'block'){
            const names = new Set(ids.map(id => { const n = notifData.find(x => x.id === id); return n && n.name; }));
            names.forEach(name => { if (name) blockAccount(name); });
            for (let i = notifData.length - 1; i >= 0; i--){
              if (names.has(notifData[i].name)) notifData.splice(i, 1);
            }
          }
          queueSaveUserState();
          doneFn();
        }

        // ---- Classroom notice board tab ----
        function handleNoticeAction(action){
          noticeBoardMenuOpen = false;
          applyNotifAction(action, noticeSelected, function(){
            noticeSelected.clear();
            renderClassAnnouncementsTab();
            if (rightPanelMode === 'pinned') renderRightPanelBody();
          });
        }
        function handleNotifAction(action){
          notifMenuOpen = false;
          applyNotifAction(action, notifSelected, function(){ notifSelected.clear(); renderNotifTab(); });
        }

        let noticeSelected = new Set();

        function noticeLongPressSelect(id){
          noticeSelected.add(id);
          renderClassAnnouncementsTab();
        }
        function noticeTap(id){
          if (noticeSelected.size){
            if (noticeSelected.has(id)) noticeSelected.delete(id); else noticeSelected.add(id);
            renderClassAnnouncementsTab();
          }
        }
        function noticeCancelSelect(){
          noticeSelected.clear();
          renderClassAnnouncementsTab();
        }

        function renderClassAnnouncementsTab(){
          const ov = document.getElementById('overlay');
          const classroomNotifs = notifData.filter(n => n.source === 'classroom');
          ov.innerHTML = `
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
              ${menuOverlayHeader('Notice Board', noticeBoardMenuOpen, 'toggleNoticeBoardMenu', notifActionsDropdownHTML('handleNoticeAction', { align: 'left' }), { hideBack: true, boldMenuIcon: true, titleLeft: true, titleSize: 'text-3xl', menuLeft: true })}
              <div class="p-5">
                <div class="space-y-3">${classroomNotifs.length ? notifCards(classroomNotifs, { selected: noticeSelected, longPressFn: 'noticeLongPressSelect', tapFn: 'noticeTap', renderFn: 'renderClassAnnouncementsTab' }) : '<div class="text-sm text-gray-400 text-center py-6">No class announcements yet.</div>'}</div>
              </div>
            </div>`;
          attachMenuScrollCloser(ov.querySelector('.overflow-y-auto'), noticeBoardMenuOpen, 'toggleNoticeBoardMenu');
        }

        function rightPanelPinnedHTML(){
          const pinned = notifData.filter(n => n.source === 'classroom' && n.pinned);
          if (!pinned.length) return `<div class="text-gray-400 text-sm text-center py-10 px-5">No pinned messages yet.</div>`;
          return `<div class="p-5">${notifCards(pinned, { longPressFn: 'noticeLongPressSelect', tapFn: 'noticeTap', renderFn: 'renderRightPanelBody' })}</div>`;
        }

        function markAllNotifsRead(){
          notifData.forEach(n => { n.read = true; });
          queueSaveUserState();
          refreshNotifBadge();
        }

        function getQuizChampion(){
          return leaderboard[0] || { name: '-', pts: 0 };
        }

        const subGames = [
          { id:'wordHunt', icon:'search', title:'Word Hunt', tag:'Puzzle', img: GAME_IMG_wordHunt,
            desc:"Tap the first and last letter of a hidden word to select it. Words can run across, down, or diagonally: find them all." },
        ];
