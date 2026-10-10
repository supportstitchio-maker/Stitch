const overlayBackKinds = ['discover', 'create', 'createMenu', 'meetingKind', 'newMeeting', 'meetingCreated', 'meetingJoin', 'tagPeoplePicker', 'aiClass', 'conversation', 'addToCall', 'incomingCall', 'incomingLectureCall', 'joinClassroom', 'classPaymentConfirm', 'createClassroom', 'classDetail', 'inviteStudents', 'inviteCoTeacher', 'newAnnouncement', 'scheduleLecture', 'classworkCreateMenu', 'newClasswork', 'newQuiz', 'newPoll', 'classworkDetail', 'classSettings', 'editClass', 'studyTimetable', 'studyReminders', 'classAnnouncements', 'classNotifications', 'gamification', 'profileMenu', 'profileQR', 'newMessage', 'myContacts', 'newCollaboration', 'profileAnalytics', 'careerAnalytics', 'notifications', 'notificationSettings', 'savedItems', 'blockedAccounts', 'termsOfService', 'privacyPolicy', 'helpCenter', 'contactUs', 'reportIssue', 'practiceTests', 'examTake', 'jobDetail', 'reportOpportunity', 'jobApply', 'jobDashboard', 'posterDashboard', 'postOpportunity', 'courseDetail', 'courseItemDetail', 'courseEnroll', 'coursePeople', 'courseAnalytics', 'newCourse', 'creatorWallet', 'creatorWithdraw', 'reportClass', 'receipts', 'courseAddModule', 'courseAddItemPage', 'courseAddResource', 'personProfile', 'personProfileQR', 'personNetwork', 'postFeed', 'careerStart', 'careerMatches', 'careerAutoApply', 'careerSubscription', 'careerSaved', 'careerDocuments', 'careerNotifications', 'careerPreferences', 'careerCancelReason', 'careerCancelDetail', 'careerMatching', 'myFullProfile', 'forwardMessage'];
        const overlayBackAction = {
          // Phone back on the meeting pages steps back one page instead of leaving to the inbox
          meetingKind: (fromPopState) => {
            if (typeof meetingKindFromMeetings !== 'undefined' && meetingKindFromMeetings) { if (fromPopState) overlayHistoryPushed = false; openCreateMenu(); return; }
            closeOverlay(fromPopState);
          },
          meetingCreated: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; openCreateMenu(); },
          newMeeting: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; if (typeof meetingInline !== 'undefined' && meetingInline) { meetingInline = false; closeOverlay(fromPopState); if (typeof renderInboxTab === 'function') renderInboxTab(); return; } openOverlay('meetingKind'); },
          // Phone back on People / Class profile / My class report returns to the class page instead
          // of leaving the class
          classDetail: (fromPopState) => {
            if (typeof CLASS_SUBPAGES !== 'undefined' && CLASS_SUBPAGES.includes(classDetailTab)) {
              if (fromPopState) overlayHistoryPushed = false;
              classSubPageBack();
              return;
            }
            closeOverlay(fromPopState);
          },
          courseDetail: (fromPopState) => {
            // Going back into another overlay after the browser already popped this one's history
            // entry: clear the flag so the next overlay pushes a fresh entry of its own
            if (overlayReturnTo) { if (fromPopState) overlayHistoryPushed = false; overlayGoBack(); return; }
            closeOverlay(fromPopState);
          },
          careerAutoApply: (fromPopState) => { if (overlayReturnTo) { if (fromPopState) overlayHistoryPushed = false; overlayGoBack(); return; } closeOverlay(fromPopState); },
          careerSubscription: (fromPopState) => { if (overlayReturnTo) { if (fromPopState) overlayHistoryPushed = false; overlayGoBack(); return; } closeOverlay(fromPopState); },
          careerSaved: (fromPopState) => { if (overlayReturnTo) { if (fromPopState) overlayHistoryPushed = false; overlayGoBack(); return; } closeOverlay(fromPopState); },
          careerDocuments: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; careerBackToAutoApply(); },
          careerNotifications: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; careerBackToAutoApply(); },
          careerPreferences: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; careerBackToAutoApply(); },
          careerCancelReason: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; openOverlayFrom('careerMatches', 'careerSubscription'); },
          careerCancelDetail: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; openOverlayFrom('careerSubscription', 'careerCancelReason'); },
          profileAnalytics: (fromPopState) => { if (overlayReturnTo) { overlayGoBack(); return; } closeOverlay(fromPopState); },
          jobDashboard: (fromPopState) => jobDashboardBack(fromPopState),
          call: (fromPopState) => minimizeCall(fromPopState),
          addToCall: () => returnToCallScreen(),
          incomingCall: (fromPopState) => declineIncomingCall(false, fromPopState),
          incomingLectureCall: (fromPopState) => declineIncomingLectureCall(fromPopState),
          lectureCall: (fromPopState) => minimizeLecture(fromPopState),
          // Edit Course / People opened from a course page: phone back returns to that page,
          // otherwise to the list
          newCourse: (fromPopState) => { if (overlayReturnTo) { if (fromPopState) overlayHistoryPushed = false; overlayGoBack(); return; } closeOverlay(fromPopState); },
          courseAnalytics: (fromPopState) => { if (overlayReturnTo) { if (fromPopState) overlayHistoryPushed = false; overlayGoBack(); return; } closeOverlay(fromPopState); },
          coursePeople: (fromPopState) => { if (overlayReturnTo) { if (fromPopState) overlayHistoryPushed = false; overlayGoBack(); return; } closeOverlay(fromPopState); },
          // Phone back on these pages goes to the previous page (the form / course) instead of out
          // to the classroom
          courseAddModule: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; cancelCourseAddModule(); },
          courseAddItemPage: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; cancelCourseItemPage(); },
          courseAddResource: (fromPopState) => { if (fromPopState) overlayHistoryPushed = false; cancelCourseResourcePage(); },
          examTake: (fromPopState) => {
            if (typeof examStage !== 'undefined' && examStage === 'result') { closeOverlay(fromPopState); return; }
            if (typeof examExit === 'function') examExit(true);
            else closeOverlay(fromPopState);
          },
          careerStart: (fromPopState) => careerStartBack(fromPopState),
          careerMatching: (fromPopState) => { if (typeof clearCareerMatchingTimers === 'function') clearCareerMatchingTimers(); closeOverlay(fromPopState); },
          conversation: (fromPopState) => { if (typeof closeConversationOverlay === 'function') closeConversationOverlay(fromPopState); else closeOverlay(fromPopState); },
          classPaymentConfirm: () => cancelClassPaymentConfirm(),
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
        function toggleClassDetailMenu(){
          classDetailMenuOpen = !classDetailMenuOpen;
          document.getElementById('overlay').innerHTML = classDetailHTML();
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
          // Home feed videos autoplay with sound (see setupFeedVideoAutoplay in feed.js) and live in
          // #screen, not #overlay
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

        let settingsMenuSavedScrollTop = 0;
        let profileInsightsSavedScrollTop = 0;
        function openOverlay(kind){
          // Composing while only the cached (pre-reconnect) feed is on screen would look like it
          // worked and then either fail to send or post against stale state once a connection comes
          if (kind === 'create' && typeof feedShowingCachedOnly !== 'undefined' && feedShowingCachedOnly) {
            if (typeof openAppAlertModal === 'function') openAppAlertModal("You're viewing saved posts from your last session. Reconnect to the internet before creating a new post.", "Reconnecting...");
            return;
          }
          collabMembersOverlayOpen = false;
          pauseAllOverlayMedia();
          // Opening any other page ends whatever glimpse was playing.
          if (typeof stopGlimpsePlayback === 'function') stopGlimpsePlayback();
          const prevKindForScroll = currentOverlayKind;
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
          let prevOverlayScrollTop = prevOverlayScrollEl ? prevOverlayScrollEl.scrollTop : 0;
          // Settings ('profileMenu'): remember where it was scrolled when a settings sub-page opens
          // on top of it, and put it back when that sub-page goes back
          if (prevKindForScroll === 'profileMenu' && kind !== 'profileMenu') {
            settingsMenuSavedScrollTop = prevOverlayScrollTop;
            prevOverlayScrollTop = 0;   // don't hand the settings scroll offset to the sub-page
          } else if (kind === 'profileMenu') {
            prevOverlayScrollTop = (prevKindForScroll && prevKindForScroll !== 'profileMenu') ? settingsMenuSavedScrollTop : 0;
          }
          // Profile Insights: same idea
          if (kind === 'profileAnalytics' && prevKindForScroll !== 'profileAnalytics' && profileInsightsSavedScrollTop > 0) {
            prevOverlayScrollTop = profileInsightsSavedScrollTop;
            profileInsightsSavedScrollTop = 0;
          } else if (kind !== 'profileAnalytics' && prevKindForScroll === 'profileAnalytics' && profileInsightsSavedScrollTop === 0) {
            profileInsightsSavedScrollTop = 0;
          }
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
          // Re-pin (or clear) #overlay's height for whichever kind is opening now
          if (typeof window.__pinOverlayApplyStable === 'function') window.__pinOverlayApplyStable();
          else ov.style.removeProperty('height');
          if (kind === 'conversation' && typeof convoInputFocused !== 'undefined') convoInputFocused = false;

          if (kind === 'profileMenu' || kind === 'profileAnalytics' || kind === 'call' || kind === 'incomingCall' || kind === 'incomingLectureCall' || kind === 'profileQR' || kind === 'personProfileQR' || kind === 'lectureCall' || kind === 'editMedia' || kind === 'myFullProfile') {
            ov.style.top = '0';
          }

          if (kind === 'discover') { discoverSearchQuery = ''; ov.innerHTML = discoverHTML(); if (!discoverPeopleLoaded) loadDiscoverPeople(); else renderDiscoverList(); }
          else if (kind === 'create') {
            selectedMediaItems = []; selectedMediaHtml = null; selectedMediaType = null; selectedMediaFile = null; selectedMediaPreviewHtml = null;
            composeTaggedUsers = []; composeCaptionDraft = ''; tagPickerSearchQuery = '';
            ov.innerHTML = createPostHTML();
            if (!discoverPeopleLoaded) loadDiscoverPeople();
          }
          else if (kind === 'createMenu') ov.innerHTML = createMenuHTML();
          else if (kind === 'meetingKind') ov.innerHTML = meetingKindHTML();
          else if (kind === 'newMeeting') {
            ov.innerHTML = newMeetingHTML();
            if (!discoverPeopleLoaded) { loadDiscoverPeople(); waitForMeetingPeople(); }
          }
          else if (kind === 'meetingCreated') ov.innerHTML = meetingCreatedHTML();
          else if (kind === 'meetingJoin') ov.innerHTML = meetingJoinHTML();
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
          else if (kind === 'classPaymentConfirm') ov.innerHTML = classPaymentConfirmHTML();
          else if (kind === 'createClassroom') ov.innerHTML = createClassroomHTML();
          else if (kind === 'classDetail') ov.innerHTML = classDetailHTML();
          else if (kind === 'inviteStudents') ov.innerHTML = inviteStudentsHTML();
          else if (kind === 'inviteCoTeacher') ov.innerHTML = inviteCoTeacherHTML();
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
          else if (kind === 'editClass') ov.innerHTML = editClassHTML();
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
          else if (kind === 'forwardMessage') ov.innerHTML = forwardMessageHTML();
          else if (kind === 'profileAnalytics') ov.innerHTML = profileAnalyticsHTML();
          else if (kind === 'careerAnalytics') ov.innerHTML = careerAnalyticsHTML();
          else if (kind === 'notificationSettings') ov.innerHTML = notificationSettingsHTML();
          else if (kind === 'savedItems') ov.innerHTML = savedItemsHTML();
          else if (kind === 'blockedAccounts') ov.innerHTML = blockedAccountsHTML();
          else if (kind === 'termsOfService') ov.innerHTML = termsOfServiceHTML();
          else if (kind === 'privacyPolicy') ov.innerHTML = privacyPolicyHTML();
          else if (kind === 'helpCenter') ov.innerHTML = helpCenterHTML();
          else if (kind === 'contactUs') { resetContactFormDraft(); ov.innerHTML = contactUsHTML(); }
          else if (kind === 'reportIssue') { resetReportIssueDraft(); ov.innerHTML = reportIssueHTML(); }
          else if (kind === 'practiceTests') ov.innerHTML = practiceTestsHTML();
          else if (kind === 'examTake') { ov.innerHTML = examTakeHTML(); setNotebookNavLabel('Annotate'); }
          else if (kind === 'jobDetail') ov.innerHTML = jobDetailHTML();
          else if (kind === 'jobApply') ov.innerHTML = jobApplyHTML();
          else if (kind === 'jobDashboard') ov.innerHTML = jobDashboardHTML();
          else if (kind === 'careerStart') ov.innerHTML = careerStartFormHTML();
          else if (kind === 'careerMatching') ov.innerHTML = careerMatchingHTML();
          else if (kind === 'careerMatches') ov.innerHTML = careerMatchesHTML();
          else if (kind === 'careerAutoApply') ov.innerHTML = careerAutoApplyHTML();
          else if (kind === 'careerSubscription') ov.innerHTML = careerSubscriptionPageHTML();
          else if (kind === 'careerSaved') ov.innerHTML = careerSavedPageHTML();
          else if (kind === 'careerDocuments') ov.innerHTML = careerDocumentsHTML();
          else if (kind === 'careerNotifications') ov.innerHTML = careerNotificationsHTML();
          else if (kind === 'careerPreferences') ov.innerHTML = careerPreferencesHTML();
          else if (kind === 'careerCancelReason') ov.innerHTML = careerCancelReasonHTML();
          else if (kind === 'careerCancelDetail') ov.innerHTML = careerCancelDetailHTML();
          else if (kind === 'postOpportunity') {
            // Editing an existing listing is an ownership/management check (same as the Dashboard's
            // Edit button), not the "am I allowed to post something new" check
            const editingJob = newOppEditingId ? findJob(newOppEditingId) : null;
            const allowed = editingJob ? canCurrentUserManageJob(editingJob) : canCurrentUserPost();
            if (!allowed) { closeOverlay(); return; }
            ov.innerHTML = postOpportunityHTML();
          }
          else if (kind === 'posterApplication') ov.innerHTML = posterApplicationOverlayHTML();
          else if (kind === 'reportOpportunity') ov.innerHTML = reportOpportunityHTML();
          else if (kind === 'posterDashboard') {
            ov.innerHTML = posterDashboardHTML();
          }
          else if (kind === 'adminDashboard') {
            if (!isCurrentUserAdmin()) { closeOverlay(); return; }
            ov.innerHTML = adminDashboardHTML();
          }
          else if (kind === 'creatorWallet' || kind === 'creatorWithdraw' || kind === 'reportClass' || kind === 'receipts') ov.innerHTML = creatorOverlayHTML(kind);
          else if (kind === 'courseDetail') ov.innerHTML = courseDetailHTML();
          else if (kind === 'courseItemDetail') ov.innerHTML = courseItemDetailHTML();
          else if (kind === 'courseEnroll') ov.innerHTML = courseEnrollHTML();
          else if (kind === 'newCourse') {
            if (!isCurrentUserAdmin()) { closeOverlay(); return; }
            ov.innerHTML = newCourseHTML();
          }
          else if (kind === 'coursePeople') ov.innerHTML = courseEnrolledPeopleHTML();
          else if (kind === 'courseAnalytics') ov.innerHTML = courseAnalyticsHTML();
          else if (kind === 'courseAddModule') ov.innerHTML = courseAddModuleHTML();
          else if (kind === 'courseAddItemPage') ov.innerHTML = courseAddItemPageHTML();
          else if (kind === 'courseAddResource') ov.innerHTML = courseAddResourcePageHTML();
          else if (kind === 'personProfile') ov.innerHTML = personProfileHTML();
          else if (kind === 'personProfileQR') { ov.innerHTML = personProfileQRHTML(); initPersonProfileQRCode(); }
          else if (kind === 'myFullProfile') ov.innerHTML = myProfileOverlayHTML();
          else if (kind === 'messageRequestCompose') { ov.innerHTML = messageRequestComposeHTML(); const cInp = document.getElementById('message-request-compose-input'); if (cInp) setTimeout(() => cInp.focus(), 60); }
          else if (kind === 'postFeed') { ov.innerHTML = postFeedHTML(); scrollToPostFeedStart(); const pfl = document.getElementById('post-feed-list'); if (pfl && typeof setupFeedVideoAutoplay === 'function') setupFeedVideoAutoplay(pfl); }
          else if (kind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          else if (kind === 'guestCollabJoin') { ov.innerHTML = guestCollabJoinHTML(); if (typeof openGuestCollabJoinOverlay === 'function') openGuestCollabJoinOverlay(); }
          else { notifGroupOpenKey = null; renderNotifTab(); }

          if (prevOverlayScrollTop) {
            const restoredOverlayScrollEl = ov.querySelector('.overflow-y-auto');
            if (restoredOverlayScrollEl) restoredOverlayScrollEl.scrollTop = prevOverlayScrollTop;
          }

          const navBackdropEl = document.getElementById('nav-bottom-backdrop');
          if (kind === 'gamification' || kind === 'aiClass' || kind === 'classAnnouncements') {
            const navH = activeNavBarHeight();
            // Animate the page's bottom edge with the same duration/easing the nav bar slides with
            // (applyBottomNavVisual: 0.22s ease-out)
            ov.style.transition = 'none';
            if (navH) ov.style.bottom = navH + 'px';
            void ov.offsetHeight;
            ov.style.transition = 'bottom 0.22s ease-out';
            bottomNavOffset = 0;
            bottomNavLastScroll = 0;
            activeNavGapSyncEl = ov;
            attachTaskbarScrollHandler(ov.querySelector('.overflow-y-auto'), ov);
            if (navBackdropEl) navBackdropEl.style.display = 'block';
          } else {
            activeNavGapSyncEl = null;
            if (ov.style.transition === 'bottom 0.22s ease-out') ov.style.transition = '';
            if (navBackdropEl) navBackdropEl.style.display = 'none';
          }

          if (overlayBackKinds.includes(kind) && !overlayHistoryPushed) {
            history.pushState({ stitchOverlay: kind }, '');
            overlayHistoryPushed = true;
          }
        }
        function closeOverlay(fromPopState){
          try { const _ovEl = document.getElementById('overlay'); if (_ovEl) _ovEl.classList.remove('kb-fill'); } catch (e) {}
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
          if (typeof stopMeetingJoinPreview === 'function') stopMeetingJoinPreview();
          currentOverlayKind = null;
          overlayReturnTo = null;
          updateUtilityNavActive();
          if (typeof updateClassroomNav === 'function') updateClassroomNav();
          // Guarded: closeOverlay() is the generic "close whatever's open" handler used by many
          // unrelated screens' back buttons
          if (typeof callMinimized === 'undefined' || !callMinimized) {
            clearCallTimers();
            stopCallLocalStream();
            teardownCallSignaling();
          }
          if (typeof lectureMinimized === 'undefined' || !lectureMinimized) {
            clearLectureTimer();
            stopLectureLocalStream();
          }
          try { if (typeof storyMenuOpen !== 'undefined') storyMenuOpen = false; document.querySelectorAll('[data-story-menu-sheet]').forEach(el => el.remove()); } catch (e) {}
          if (typeof stopGlimpsePlayback === 'function') stopGlimpsePlayback(); else clearStoryTimer();
          if (typeof stopChallengeScorePolling === 'function') stopChallengeScorePolling();
          const ov = document.getElementById('overlay');
          if (ov) { ov.classList.add('hidden'); ov.innerHTML=''; ov.style.top = OVERLAY_TOP; ov.style.bottom = '0'; ov.style.paddingTop = ''; ov.style.transition = ''; ov.style.background = ''; }
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
              // popModalBackHandler (above) already sets this flag before its own history.back() so the
              // resulting async popstate event doesn't get treated as a real back-press
              suppressNextPopstate = true;
              history.back();
              // If no popstate ever arrives the flag would stay set and swallow the next real back-press
              // (or misfire a navigation)
              setTimeout(() => { suppressNextPopstate = false; }, 600);
            }
          }
          if (currentTab === 2) { renderStudy(); openRightPanel('notebook'); }
          if (currentTab === 0 && typeof setupFeedVideoAutoplay === 'function') {
            const feedListEl = document.getElementById('feed-list');
            if (feedListEl) setupFeedVideoAutoplay(feedListEl);
          }
          if (currentTab === 3) applyDefaultRightPanel(3);
          // A minimized class call swaps between its inline panel (inside the class) and the
          // floating card (everywhere else)
          if (typeof scheduleLectureBannerSync === 'function') scheduleLectureBannerSync();
          if (wasConversation && typeof leaveConvoTypingChannel === 'function') leaveConvoTypingChannel();
          if (wasConversation && typeof activeConvoId !== 'undefined') activeConvoId = null;
          if (wasConversation && typeof convoInputFocused !== 'undefined') convoInputFocused = false;
          // Stepping out of a conversation used to leave whatever inbox-list HTML happened to be
          // sitting in the DOM from before the chat was opened
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

        // ---- Auto-growing text boxes: any <textarea data-autogrow> expands to fit what is typed
        // ----
        function autoGrowTextarea(el){
          if (!el || !el.isConnected) return;
          let sp = null, p = el.parentElement;
          while (p && p !== document.body) {
            const oy = getComputedStyle(p).overflowY;
            if (oy === 'auto' || oy === 'scroll') { sp = p; break; }
            p = p.parentElement;
          }
          const keepTop = sp ? sp.scrollTop : 0;
          el.style.height = 'auto';
          const sh = el.scrollHeight;
          if (!sh) { el.style.height = ''; return; }
          el.style.height = (sh + (el.offsetHeight - el.clientHeight)) + 'px';
          if (sp) sp.scrollTop = keepTop;
        }
        document.addEventListener('input', function(e){
          const t = e.target;
          if (t && t.matches && t.matches('textarea[data-autogrow]')) autoGrowTextarea(t);
        }, true);
        new MutationObserver(function(muts){
          const found = [];
          muts.forEach(m => m.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.matches && n.matches('textarea[data-autogrow]')) found.push(n);
            if (n.querySelectorAll) n.querySelectorAll('textarea[data-autogrow]').forEach(t => found.push(t));
          }));
          if (!found.length) return;
          found.forEach(autoGrowTextarea);
          requestAnimationFrame(() => found.forEach(autoGrowTextarea));
        }).observe(document.body, { childList: true, subtree: true });

        // ---- Overlay/menu header helpers ----
        function overlayHeader(title, extraTopPad, backAction, icon, opts){
          opts = opts || {};
          const padStyle = ` style="padding-top:${extraTopPad || '20px'};"`;
          const titleSize = opts.titleSize || 'text-lg';
          const titleClass = opts.titleClass ? (' ' + opts.titleClass) : '';
          const pbClass = opts.pb ? '' : ' pb-3';
          const pbStyle = opts.pb ? ` style="padding-bottom:${opts.pb};"` : '';
          // Back-only headers are always left-aligned (opts.right / opts.center are ignored)
          return `
            <div class="flex-shrink-0 w-full"${padStyle}>
              <div class="max-w-2xl mx-auto px-5${pbClass} flex items-center gap-4"${pbStyle}>
                <button onclick="${backAction || 'overlayGoBack()'}">${gradIcon(IconBold(icon || 'back','w-5 h-5'))}</button>
                <div class="font-semibold ${titleSize} font-display grad-text${titleClass}">${title}</div>
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

        // Classroom three-dash menus: a sheet that slides up from the bottom (same look as the
        // post menu on the main pages)
        function classMenuSheetHTML(toggleFnName, rows){
          const rowHtml = rows.map(r => `
            <button onclick="${r.onclick}" class="w-full flex items-center gap-5 px-6 py-4 text-left text-base font-semibold ${r.cls || 'text-gray-800'}" style="background:transparent;">
              <span class="w-6 h-6 flex items-center justify-center flex-shrink-0">${(r.cls && /text-red/.test(r.cls)) ? Icon(r.icon,'w-6 h-6').replace('<svg ', '<svg style="color:#ef4444;" ') : Icon(r.icon,'w-6 h-6')}</span>
              <span style="font-family:'Colmeak','Montserrat',sans-serif;font-weight:400;font-size:17px;letter-spacing:.01em;">${r.label}</span>
            </button>`).join('');
          return `
            <div onclick="${toggleFnName}()" ontouchmove="event.preventDefault()" style="position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.5);"></div>
            <div class="bg-white" style="position:fixed;left:0;right:0;bottom:0;z-index:11001;border-radius:24px 24px 0 0;padding:10px 0 calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.18);animation:shareSheetSlideUp .22s cubic-bezier(0.16,1,0.3,1);max-width:640px;margin:0 auto;">
              <div style="width:48px;height:5px;border-radius:3px;background:#1f2937;margin:2px auto 10px;"></div>
              ${rowHtml}
            </div>`;
        }

        function menuOverlayHeader(title, menuOpen, toggleFnName, dropdownHtml, opts){
          opts = opts || {};
          const backFnName = opts.backFn || 'closeOverlay';
          const backBtn = opts.hideBack ? '' : `<button onclick="${backFnName}()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>`;
          const menuIconName = opts.dotsMenuIcon ? 'dots' : (opts.shortDashes ? 'dashesShortRight' : 'dashes');
          const menuIconSize = opts.shortDashes ? 'w-6 h-6' : 'w-5 h-5';
          const menuIcon = opts.boldMenuIcon ? IconBold(menuIconName,menuIconSize) : Icon(menuIconName,menuIconSize);
          const menuBtnClass = `${opts.menuEnd ? 'h-10 flex items-center justify-end flex-shrink-0' : 'w-8 h-8 flex items-center justify-center flex-shrink-0'}${opts.hideMenuOnDesktop ? ' notif-header-menu-btn' : ''}`;
          const menuBtnStyle = opts.menuEnd ? ' style="width:32px;margin-right:-2px;"' : '';
          const menuBtn = `<button onclick="${toggleFnName}()" class="${menuBtnClass}"${menuBtnStyle}>${opts.flipMenuIcon ? `<span style="display:flex;transform:scaleX(-1);">${gradIcon(menuIcon)}</span>` : gradIcon(menuIcon)}</button>`;
          const titleSize = opts.titleSize || 'text-base';
          const titleClass = opts.titleRight
            ? `${titleSize} font-bold font-display grad-text truncate`
            : opts.titleLeft
            ? `${titleSize} font-bold font-display grad-text truncate${opts.menuLeft ? ' text-right' : ''}`
            : `${titleSize} font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate`;
          const titleMaxWidth = (opts.titleLeft ? '80%' : '60%') + (opts.titleRight ? ';margin-left:auto;margin-right:12px;text-align:right' : '');
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
        function classDetailMenuDropdown(isTeacher){
          const rows = [
            { onclick: "toggleClassDetailMenu(); openOverlayFrom('classDetail', 'classNotifications')", icon: 'bell', label: 'Notifications' },
            { onclick: "toggleClassDetailMenu(); classDetailSwitchTab('people')", icon: 'users', label: 'People' },
            { onclick: "toggleClassDetailMenu(); openClassMessages()", icon: 'comment', label: 'Messages' + (typeof classMsgUnreadTotal === 'function' && classMsgUnreadTotal() ? ' (' + classMsgUnreadTotal() + ')' : '') },
            isTeacher
              ? { onclick: "toggleClassDetailMenu(); classDetailSwitchTab('profile')", icon: 'chart', label: 'Space profile' }
              : { onclick: "toggleClassDetailMenu(); classDetailSwitchTab('report')", icon: 'doc', label: 'My space report' }
          ];
          if (isTeacher) {
            rows.push({ onclick: 'toggleClassDetailMenu(); openEditClass()', icon: 'edit', label: 'Edit space' });
            rows.push({ onclick: 'toggleClassDetailMenu(); confirmDeleteCurrentClass()', icon: 'trash', label: 'Delete space', cls: 'text-red-500' });
          } else {
            rows.push({ onclick: 'toggleClassDetailMenu(); confirmLeaveCurrentClass()', icon: 'back', label: 'Leave space', cls: 'text-red-500' });
          }
          return classMenuSheetHTML('toggleClassDetailMenu', rows);
        }
        function classDetailHeaderHTML(title, isTeacher){
          return `
            <div class="w-full px-5 relative" style="padding-top:var(--top-safe-pad);padding-bottom:calc(0.75rem + 10px);">
              <div class="flex items-center justify-between">
                <button onclick="openLeaveClassModal(closeOverlay, 'Exit this space?', 'You can come back to this space anytime from Workspace.')" title="Leave space" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <h1 class="nm-wrap text-base font-bold font-display absolute left-1/2 -translate-x-1/2" style="max-width:60%;"><span class="nm-inner grad-text">${escapeHtml(title)}</span></h1>
                <button onclick="toggleClassDetailMenu()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(Icon('dashesShortRight','w-6 h-6'))}</button>
              </div>
              ${classDetailMenuOpen ? classDetailMenuDropdown(isTeacher) : ''}
            </div>`;
        }

        function placeholderDropdownMenu(){
          return `
            <div class="absolute w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;">
              <div class="px-4 py-2.5 text-sm text-gray-400 menu-item-pill">More options coming soon</div>
            </div>`;
        }

        function joinClassDropdownMenu(){
          return classMenuSheetHTML('toggleJoinClassMenu', [
            { onclick: 'pasteJoinClassCode()', icon: 'clip', label: 'Paste code from clipboard' },
            { onclick: 'showJoinClassHelp()', icon: 'help', label: 'How do I get a space code?' }
          ]);
        }

        function createClassDropdownMenu(){
          return classMenuSheetHTML('toggleCreateClassMenu', [
            { onclick: 'resetCreateClassForm()', icon: 'trash', label: 'Clear form', cls: 'text-red-500' },
            { onclick: 'showCreateClassHelp()', icon: 'help', label: 'What do these fields mean?' }
          ]);
        }

        async function pasteJoinClassCode(){
          toggleJoinClassMenu();
          const input = document.getElementById('join-code-input');
          try {
            const text = await navigator.clipboard.readText();
            if (input && text) input.value = text.trim().toUpperCase();
            if (!text) openAppAlertModal('Your clipboard is empty. Copy a space code first, then try again.');
          } catch (e) {
            openAppAlertModal("Couldn't read your clipboard. You may need to allow clipboard access, or just type the code in manually.");
          }
        }

        function showJoinClassHelp(){
          toggleJoinClassMenu();
          openAppAlertModal('Ask a moderator or a fellow member already in the space for the space code. It\'s usually 6-8 letters or numbers, shown at the top of the space in their app.');
        }

        function resetCreateClassForm(){
          toggleCreateClassMenu();
          const ids = ['create-name-input','create-section-input','create-subject-input'];
          ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        }

        function showCreateClassHelp(){
          toggleCreateClassMenu();
          openAppAlertModal('Space Name: what members will see (required).\nSection: an optional label like "Section B" if you teach more than one group.\nSubject: an optional label like "Biology" to help members find the space.');
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
                <textarea id="new-post-text" oninput="onComposeTextInput()" onfocus="composeAutoGrow(this)" rows="3" class="w-full p-4 border border-gray-200 rounded-2xl text-base" style="min-height:6rem;resize:none;overflow:hidden;display:block;" placeholder="Write a caption... Type @ to tag someone">${escapeHtml(captionDraft || '')}</textarea>
              </div>
              <button type="button" onclick="openTagPeoplePicker()" class="text-xs font-semibold flex items-center gap-1.5 mb-2" style="color:${ROYAL}">${Icon('users','w-4 h-4')} Tag people</button>
              <div id="compose-tagged-chips" class="flex flex-wrap gap-2 ${composeTaggedUsers.length ? 'mb-3' : ''}">${composeTaggedChipsHTML()}</div>
            </div>
            <div id="create-post-footer" class="px-4 pt-4 border-t flex-shrink-0" style="padding-bottom:max(16px, env(safe-area-inset-bottom, 0px));">
              <button id="post-submit-btn" onclick="submitPost()" class="pill-cta w-full py-3 rounded-full font-semibold text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);box-shadow:0 4px 14px rgba(65,105,225,0.35);transition:transform .12s ease, opacity .15s ease;">Post</button>
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
                      ? `<video src="${item.url}" controls disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen noremoteplayback" class="w-full h-auto max-h-64" style="object-fit:contain;"></video>`
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
                <button type="button" onclick="deleteCurrentPhotoInEditor()" class="text-sm font-semibold px-2 py-1">Delete</button>
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
              <div id="edit-aspect-row" class="flex items-center justify-center gap-2 px-4 pt-4 flex-shrink-0 overflow-x-auto no-scrollbar">${mediaEditAspectRowInner()}</div>
              <input type="file" id="edit-media-add-input" accept="image/*,video/*" multiple class="hidden" onchange="handleEditMediaAddSelect(event)">
              <div class="px-6 pt-2 flex-shrink-0" style="padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);">
                <div class="text-[11px] text-center text-gray-400">Drag the photo to reposition it</div>
              </div>
            </div>`;
        }

        function mediaEditAspectRowInner(){
          return mediaEditAspectBtn('original', 'Original') + mediaEditAspectBtn('square', '1:1') + mediaEditAspectBtn('portrait', '4:5') + mediaEditAspectBtn('landscape', '16:9') + mediaEditActionIconsHTML();
        }

        // Add-another-photo, sitting right after the 16:9 pill, styled like the bare (no circle
        // background) plus icon used in the home topbar rather than as a filled icon button
        function mediaEditActionIconsHTML(){
          return `
            <button type="button" onclick="addAnotherPhotoFromEditor()" aria-label="Add another photo" class="flex items-center justify-center flex-shrink-0 text-white">${IconBold('plus','w-7 h-7')}</button>`;
        }

        function deleteCurrentPhotoInEditor(){
          const actualIndex = mediaEditQueue[mediaEditIndexInQueue];
          if (actualIndex === undefined) return;
          selectedMediaItems.splice(actualIndex, 1);
          // Everything still queued after the one we just removed shifted down by one slot in
          // selectedMediaItems
          mediaEditQueue = mediaEditQueue
            .filter((qi, i) => i !== mediaEditIndexInQueue)
            .map(qi => qi > actualIndex ? qi - 1 : qi);
          syncSelectedMediaMirror();
          openMediaEditorStep();
        }

        function addAnotherPhotoFromEditor(){
          const input = document.getElementById('edit-media-add-input');
          if (input) input.click();
        }

        function handleEditMediaAddSelect(event){
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
                // Tack the new photos onto the end of the current edit session's queue instead of starting
                // a separate one, so they get their own crop step once you're done with whatever's already
                mediaEditQueue = mediaEditQueue.concat(newPhotoIndices);
              }
            };
            reader.readAsDataURL(file);
          });
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
            <div class="px-5 flex-shrink-0" style="padding-top:10px;">
              <input id="tag-picker-search-input" value="${escapeHtml(tagPickerSearchQuery)}" oninput="onTagPickerSearchInput(this.value)" placeholder="Search people to tag" class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm mb-3" autocomplete="off">
              <div id="tag-picker-chips" class="flex flex-wrap gap-2 flex-shrink-0 ${composeTaggedUsers.length ? 'mb-3' : 'hidden'}">${composeTaggedChipsHTML()}</div>
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
              <button type="button" onclick="toggleComposeTagPerson('${escapeForJsAttr(p.id)}')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left mb-0.5" style="${tagged ? 'background:rgba(65,105,225,0.16);box-shadow:inset 0 0 0 1.5px rgba(65,105,225,0.55);' : ''}">
                <div class="w-9 h-9 rounded-full bg-blue-50 overflow-hidden flex items-center justify-center flex-shrink-0" style="${tagged ? 'box-shadow:0 0 0 2px #fff, 0 0 0 4px ' + ROYAL + ';' : ''}">${avatarInner}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate" style="${tagged ? 'color:' + ROYAL + ';' : ''}">${escapeHtml(p.name)}</div>
                  ${p.username ? `<div class="text-xs truncate ${tagged ? '' : 'text-gray-400'}" style="${tagged ? 'color:' + ROYAL + ';opacity:0.8;' : ''}">@${escapeHtml(p.username)}</div>` : ''}
                </div>
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

        // The caption box grows with what you type (up to ~45% of the screen, then scrolls)
        function composeAutoGrow(ta){
          if (!ta) return;
          ta.style.height = 'auto';
          const max = Math.round(window.innerHeight * 0.45);
          const h = Math.max(96, ta.scrollHeight + 2);
          ta.style.height = Math.min(h, max) + 'px';
          ta.style.overflowY = h > max ? 'auto' : 'hidden';
          // keep the line you're typing visible inside the scrolling page
          const scroller = document.getElementById('create-post-scroll');
          if (scroller && document.activeElement === ta) {
            const r = ta.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
            if (r.bottom > sr.bottom) scroller.scrollTop += (r.bottom - sr.bottom) + 8;
          }
        }

        function onComposeTextInput(){
          const ta = document.getElementById('new-post-text');
          if (!ta) return;
          composeAutoGrow(ta);
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

        // Guards against a single tap firing submitPost() more than once (e.g. a double-tap, or a
        // tap plus an Enter-key submit landing in the same event tick on a slow device) from
        let postSubmitInFlight = false;
        // Gives the Post button instant feedback and ignores extra taps while it works
        function submitPost(){
          const btn = document.getElementById('post-submit-btn');
          if (btn && btn.dataset.busy === '1') return;
          if (btn) {
            btn.dataset.busy = '1';
            btn.dataset.label = btn.textContent;
            btn.textContent = 'Posting...';
            btn.style.opacity = '.7';
            btn.style.transform = 'scale(0.98)';
            btn.style.pointerEvents = 'none';
          }
          submitPostCore();
          // If nothing started (missing photo, offline, incomplete profile), hand the button back
          if (!postSubmitInFlight && btn && document.body.contains(btn)) {
            btn.dataset.busy = '0';
            btn.textContent = btn.dataset.label || 'Post';
            btn.style.opacity = '';
            btn.style.transform = '';
            btn.style.pointerEvents = '';
          }
        }

        function submitPostCore(){
          if (postSubmitInFlight) return;
          if (!requireCompleteProfile()) return;
          if (!selectedMediaItems.length) { openAppAlertModal('Add a photo or video: the feed only shows posts with pictures or videos'); return; }
          // Bail out before touching the network at all when the device is known to be offline
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            openAppAlertModal("You're offline. Connect to the internet and try again.", 'No internet');
            return;
          }
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
          }).then((post) => {
            // Don't clear the guard until the real upload+insert finishes
            const pending = (post && post._pending) ? post._pending : Promise.resolve();
            pending.catch(() => {}).finally(() => { postSubmitInFlight = false; });
            selectedMediaItems = [];
            selectedMediaHtml = null;
            selectedMediaType = null;
            selectedMediaFile = null;
            selectedMediaPreviewHtml = null;
            composeTaggedUsers = [];
            composeCaptionDraft = '';
            tagPickerSearchQuery = '';
            closeOverlay();
            // Posting can happen from the Home tab, the Profile tab (its own "+" button), or the
            // desktop side nav on any tab, so currentTab isn't necessarily Home here
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

        // ---- Live "new person just signed up" delivery ----
        let discoverPeopleChannel = null;
        let discoverPeopleSubscribedForUserId = null;
        async function subscribeToDiscoverPeople(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (discoverPeopleChannel && discoverPeopleSubscribedForUserId === myId) return;
          if (discoverPeopleChannel) { try { sb.removeChannel(discoverPeopleChannel); } catch (e) {  } discoverPeopleChannel = null; }
          discoverPeopleSubscribedForUserId = myId;
          discoverPeopleChannel = sb.channel('discover-people')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: PUBLIC_PROFILES_TABLE }, (payload) => handleNewDiscoverProfile(payload, myId))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: PUBLIC_PROFILES_TABLE }, (payload) => handleDiscoverProfileUpdated(payload, myId))
            .subscribe();
        }

        function handleNewDiscoverProfile(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.user_id || row.user_id === myId) return;
          if (row.deleted) return;
          if (!((row.name || '').trim() || (row.username || '').trim())) return;
          if (discoverPeople.some(p => p.id === row.user_id)) return;
          discoverPeople.push({
            id: row.user_id,
            name: row.name || 'Stitch member',
            username: row.username || '',
            sub: row.bio || '',
            icon: 'user',
            avatarBg: 'bg-blue-50',
            photo: row.photo || null,
            requestSent: false,
            connected: false,
          });
          if (discoverPeopleLoaded) renderDiscoverList();
        }

        // A profile that gets soft-deleted (account deletion keeps the row so existing chats still
        // show the real name, but flips `deleted` to true) should immediately drop out of Discover
        // for anyone currently browsing it, without needing a full reload

        // ---- Live profile sync: when anyone edits their name/username/bio/photo, every place
        // that shows them (feed posts, glimpses, chats, contacts, discover, notifications) updates
        // right away for everyone else, with no refresh. ----
        let liveProfileRenderTimer = null;
        function applyLiveProfileUpdate(row, myId){
          if (!row || !row.user_id || row.deleted) return;
          const uid = row.user_id;
          const isMe = uid === myId;
          const newName = (row.name || '').trim();
          const newPhoto = row.photo || null;
          let changed = false;
          if (!isMe) {
            const dp = (typeof discoverPeople !== 'undefined') ? discoverPeople.find(p => p.id === uid) : null;
            if (dp) {
              if (newName && dp.name !== newName) { dp.name = newName; changed = true; }
              if ((row.username || '') !== dp.username) { dp.username = row.username || ''; changed = true; }
              dp.sub = row.bio || '';
              if (dp.photo !== newPhoto) { dp.photo = newPhoto; changed = true; }
            }
          }
          if (typeof feedPosts !== 'undefined') {
            feedPosts.forEach(p => {
              if (p.authorId === uid) {
                if (newName && p.name !== newName) { p.name = newName; changed = true; }
                if (!isMe && p.photo !== newPhoto) { p.photo = newPhoto; changed = true; }
              }
              if (Array.isArray(p.commentsList)) p.commentsList.forEach(c => {
                if (c && c.userId === uid) {
                  if (newName && !isMe && c.name !== newName) { c.name = newName; changed = true; }
                  if (!isMe && c.photo !== newPhoto) { c.photo = newPhoto; changed = true; }
                }
              });
              if (Array.isArray(p.taggedUsers)) p.taggedUsers.forEach(t => {
                if (t && String(t.id) === String(uid) && row.username && t.username !== row.username) { /* handle stays as typed in the caption */ }
              });
            });
          }
          if (!isMe && typeof stories !== 'undefined') {
            stories.forEach(s => { if (!s.mine && s.id === uid) { if (newName) s.name = newName; s.photo = newPhoto; changed = true; } });
          }
          if (!isMe && typeof convoArrays === 'function' && typeof convoMeta !== 'undefined') {
            convoArrays().flat().forEach(c => {
              const meta = convoMeta[c.id];
              if (!meta || meta.otherUserId !== uid) return;
              if (newName && c.name !== newName) { c.name = newName; meta.name = newName; changed = true; }
              if (c.photo !== newPhoto) { c.photo = newPhoto; meta.photo = newPhoto; changed = true; }
              if (row.username) meta.username = row.username;
            });
          }
          if (!isMe && typeof notifData !== 'undefined' && newName) {
            notifData.forEach(n => { if (n.otherUserId === uid && n.type !== 'message' && n.name !== newName) { n.name = newName; changed = true; } });
          }
          if (!changed) return;
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
          if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          if (liveProfileRenderTimer) clearTimeout(liveProfileRenderTimer);
          liveProfileRenderTimer = setTimeout(() => {
            liveProfileRenderTimer = null;
            try {
              const ov = document.getElementById('overlay');
              const overlayOpen = ov && !ov.classList.contains('hidden');
              if (overlayOpen) {
                if (currentOverlayKind === 'discover' && typeof renderDiscoverList === 'function') renderDiscoverList();
                else if (currentOverlayKind === 'notifications' && typeof renderNotifTab === 'function') renderNotifTab();
                else if (currentOverlayKind === 'myContacts' && typeof myContactsHTML === 'function') ov.innerHTML = myContactsHTML();
                return;
              }
              if (currentTab === 0 && typeof renderFeed === 'function') renderFeed();
              else if (currentTab === 3 && typeof renderInboxTab === 'function') renderInboxTab();
            } catch (e) {}
          }, 250);
        }

        function handleDiscoverProfileUpdated(payload, myId){
          const row = payload && payload.new;
          if (row && !row.deleted) applyLiveProfileUpdate(row, myId);
          if (!row || !row.user_id || row.user_id === myId) return;
          if (row.deleted) {
            const before = discoverPeople.length;
            discoverPeople = discoverPeople.filter(p => p.id !== row.user_id);
            if (discoverPeople.length !== before && discoverPeopleLoaded) renderDiscoverList();
          }
        }

        let discoverPeoplePollInterval = null;
        function startDiscoverPeoplePolling(){
          if (discoverPeoplePollInterval) return;
          discoverPeoplePollInterval = setInterval(() => {
            if (document.hidden) return;
            const sb = getSupabaseClient();
            if (!sb) return;
            loadDiscoverPeople().catch(() => {});
          }, 90000);
        }

        async function loadDiscoverPeople(retryCount){
          discoverLoadError = false;
          const sb = getSupabaseClient();
          if (!sb) {
            // The Supabase client can still be spinning up the moment Discover first opens (or briefly
            // during a connectivity blip)
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
              sb.from(PUBLIC_PROFILES_TABLE).select('*').or('deleted.is.null,deleted.eq.false')
                // Most recently active first, capped: loading every profile ever made doesn't scale.
                .order('last_active', { ascending: false, nullsFirst: false }).limit(500),
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
              .filter(row => !row.deleted)
              .filter(row => (row.name || '').trim() || (row.username || '').trim())
              .map(row => ({
                id: row.user_id,
                name: row.name || 'Stitch member',
                username: row.username || '',
                sub: row.bio || '',
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
            ${overlayHeader('Discover', '20px', null, null, {right:true})}
            <div class="px-5 pt-3 pb-3 flex-shrink-0" style="padding-bottom:calc(0.75rem + 5px);">
              <input id="discover-search-input" value="${escapeHtml(discoverSearchQuery)}" oninput="onDiscoverSearchInput(this.value)" placeholder="Search by name, school, field..." class="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm" autocomplete="off">
            </div>
            <div class="px-5 pb-5 overflow-y-auto no-scrollbar flex-1">
              <div id="discover-people-list" class="flex flex-col items-center">${discoverPeopleHTML()}</div>
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

        let discoverSearchInterestTimer = null;
        function onDiscoverSearchInput(val){
          discoverSearchQuery = val;
          const list = document.getElementById('discover-people-list');
          if (list) list.innerHTML = discoverPeopleHTML();
          // Debounced so we record what the person actually searched for (a pause in typing), not
          // every half-typed keystroke, as a signal for which "Suggested for you" videos are
          if (discoverSearchInterestTimer) clearTimeout(discoverSearchInterestTimer);
          discoverSearchInterestTimer = setTimeout(() => {
            if (typeof recordContentInterestTerms === 'function') recordContentInterestTerms(val);
          }, 600);
        }

        function personCard(p){
          // Falls back to the silhouette placeholder when the photo can't load (e.g. offline and not
          // cached yet) instead of showing the browser's broken-image icon
          const avatarInner = avatarMediaHTML(p.photo, p.icon || 'user', 'w-5 h-5');
          let actionHTML;
          if (p.connected) {
            actionHTML = `<span class="text-xs font-semibold px-4 py-2 rounded-full bg-gray-100 text-gray-400">Connected</span>`;
          } else if (p.requestSent) {
            actionHTML = `<button onclick="cancelConnectionRequest('${p.id}')" class="text-xs font-semibold px-4 py-2 rounded-full bg-gray-100 text-gray-600">Cancel Request</button>`;
          } else {
            actionHTML = `<button onclick="connectToDiscoverPerson('${p.id}')" class="text-xs font-semibold px-4 py-2 rounded-full" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};">Connect</button>`;
          }
          return `
            <div class="w-full flex items-center gap-4" style="padding:10px 0;margin-bottom:5px;border-bottom:1px solid rgba(0,0,0,0.08);">
              <button onclick="openPersonProfileFromDiscover('${p.id}')" class="w-11 h-11 ${p.avatarBg || 'bg-blue-50'} rounded-2xl flex items-center justify-center text-gray-600 overflow-hidden flex-shrink-0">${avatarInner}</button>
              <div class="flex-1 min-w-0 cursor-pointer text-left" onclick="openPersonProfileFromDiscover('${p.id}')">
                <div class="font-semibold text-sm truncate">${escapeHtml(p.name)}</div>
                <div class="text-xs text-gray-500 truncate">${p.username ? escapeHtml(p.username) : ''}${p.username && p.sub ? ' · ' : ''}${escapeHtml(p.sub)}</div>
              </div>
              ${actionHTML}
            </div>`;
        }

        // Tracks toUserId values with a send currently in flight, so a double-tap on Connect
        // (before isConnectionRequestPendingTo below has anything local to check against) can't
        // race its way into two pending rows to the same person
        const connectionRequestSendsInFlight = new Set();
        // Adds a request I just sent to the Requests > Sent list right away
        function addOptimisticSentRequest(toUserId, message){
          let p = null;
          try {
            p = (typeof discoverPeople !== 'undefined' && discoverPeople.find(x => x.id === toUserId))
              || (typeof viewedProfile !== 'undefined' && viewedProfile && viewedProfile.id === toUserId ? viewedProfile : null);
            if (!p && typeof feedPosts !== 'undefined' && Array.isArray(feedPosts)) {
              const fp = feedPosts.find(x => x.authorId === toUserId);
              if (fp) p = { name: fp.author || fp.authorName, username: fp.authorUsername, photo: fp.authorPhoto };
            }
          } catch (e) {}
          const tmpId = 'pending-' + toUserId;
          const msg = (message || '').trim();
          const entry = {
            id: tmpId,
            optimistic: true,
            connectionRequestId: null,
            otherUserId: toUserId,
            icon: 'user',
            avatarBg: 'bg-blue-50',
            name: (p && (p.name || p.username)) || 'Stitch member',
            username: (p && p.username) || '',
            photo: (p && p.photo) || null,
            preview: msg ? `You: "${msg}"` : '',
            time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          };
          sentRequestConvos.unshift(entry);
          convoMeta[tmpId] = { icon: entry.icon, avatarBg: entry.avatarBg, name: entry.name, username: entry.username, photo: entry.photo, preview: 'Request sent', otherUserId: toUserId };
          renderInboxTab();
          return entry;
        }

        async function sendConnectionRequestTo(toUserId, message){
          // Guard against duplicate requests / duplicate network rows: if we're already connected to
          // this person, or already have a request pending to them (per our local, server-synced
          if (typeof isUserInMyNetwork === 'function' && isUserInMyNetwork(toUserId)) return true;
          if (typeof isConnectionRequestPendingTo === 'function' && isConnectionRequestPendingTo(toUserId)) return true;
          if (connectionRequestSendsInFlight.has(toUserId)) return true;
          connectionRequestSendsInFlight.add(toUserId);
          // Flip every Connect tag for this person to Pending right away, rather than only the one
          // the request was sent from
          setConnectionTagEverywhere(toUserId, true);
          // Show it in Messaging > Requests > Sent immediately, before the server round-trip
          const optimisticEntry = addOptimisticSentRequest(toUserId, message);
          const dropOptimistic = () => {
            const i = sentRequestConvos.indexOf(optimisticEntry);
            if (i !== -1) { sentRequestConvos.splice(i, 1); delete convoMeta[optimisticEntry.id]; renderInboxTab(); }
          };
          const sb = getSupabaseClient();
          if (!sb) { dropOptimistic(); setConnectionTagEverywhere(toUserId, false); connectionRequestSendsInFlight.delete(toUserId); return false; }
          try {
            const { data: userRes } = await sb.auth.getUser();
            const me = userRes && userRes.user;
            if (!me) { dropOptimistic(); setConnectionTagEverywhere(toUserId, false); return false; }
            // Save this account's name/username/photo BEFORE the request goes out, so the person
            // receiving it sees the real name instead of "Stitch member" (waits at most 4s)
            if (typeof syncPublicProfile === 'function') {
              try { await Promise.race([syncPublicProfile(), new Promise(r => setTimeout(r, 4000))]); } catch (e) {}
            }
            // Belt-and-suspenders check against the DB itself, in case our local
            // sentRequestConvos/network state hasn't caught up yet (e.g. right after app load, before
            const { data: existing } = await sb.from(CONNECTION_REQUESTS_TABLE)
              .select('id')
              .eq('from_user', me.id)
              .eq('to_user', toUserId)
              .eq('status', 'pending')
              .maybeSingle();
            if (existing) { optimisticEntry.optimistic = false; optimisticEntry.connectionRequestId = existing.id; optimisticEntry.id = existing.id; return true; }
            const newReqId = 'req' + Date.now() + Math.random().toString(36).slice(2,6);
            const { error } = await sb.from(CONNECTION_REQUESTS_TABLE).insert({
              id: newReqId,
              from_user: me.id,
              to_user: toUserId,
              status: 'pending',
              message: (message || '').trim() || null,
            });
            if (error) { console.warn('sendConnectionRequestTo failed:', error); dropOptimistic(); setConnectionTagEverywhere(toUserId, false); }
            else if (typeof loadMyPendingOutgoingRequests === 'function') {
              // Promote the optimistic row to the real one so the reloader doesn't duplicate or drop it
              delete convoMeta[optimisticEntry.id];
              optimisticEntry.optimistic = false;
              optimisticEntry.connectionRequestId = newReqId;
              optimisticEntry.id = newReqId;
              convoMeta[newReqId] = { icon: optimisticEntry.icon, avatarBg: optimisticEntry.avatarBg, name: optimisticEntry.name, username: optimisticEntry.username, photo: optimisticEntry.photo, preview: 'Request sent', otherUserId: toUserId };
              queueSaveUserState();
              await loadMyPendingOutgoingRequests();
              if (typeof syncNetworkConnectionStates === 'function') syncNetworkConnectionStates();
            }
            // Make sure this account's name/username/photo are in PUBLIC_PROFILES_TABLE before the
            // recipient looks at the request
            if (!error && typeof syncPublicProfile === 'function') { syncPublicProfile().catch(() => {}); }
            return !error;
          } catch (e) { console.warn('sendConnectionRequestTo threw:', e); dropOptimistic(); setConnectionTagEverywhere(toUserId, false); return false; }
          finally { connectionRequestSendsInFlight.delete(toUserId); }
        }

        async function cancelMyConnectionRequestTo(toUserId){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            // FIX: this used to run a plain .delete() against connection_requests filtered to
            // from_user = me
            const { error } = await sb.rpc('cancel_connection_request', { target_user: toUserId });
            if (error) { console.warn('cancelMyConnectionRequestTo failed:', error); }
            else {
              const idx = sentRequestConvos.findIndex(c => c.otherUserId === toUserId);
              if (idx !== -1) { sentRequestConvos.splice(idx, 1); queueSaveUserState(); renderInboxTab(); }
              syncConnectNotif({ otherUserId: toUserId }, 'remove');
              if (typeof syncNetworkConnectionStates === 'function') syncNetworkConnectionStates();
            }
            return !error;
          } catch (e) { console.warn('cancelMyConnectionRequestTo threw:', e); return false; }
        }

        // Every place a person's Connect/Pending status can be shown
        function setConnectionTagEverywhere(userId, sent){
          const dp = discoverPeople.find(p => p.id === userId);
          if (dp) dp.requestSent = sent;
          if (typeof feedPosts !== 'undefined' && Array.isArray(feedPosts)) {
            feedPosts.forEach(p => { if (p.authorId === userId) p.connectRequestSent = sent; });
          }
          if (typeof viewedProfile !== 'undefined' && viewedProfile) {
            if (viewedProfile.id === userId) viewedProfile.requestSent = sent;
            if (Array.isArray(viewedProfile.network)) {
              const m = viewedProfile.network.find(x => x.id === userId);
              if (m) m.requestSent = sent;
            }
          }
          if (typeof personProfileCache !== 'undefined') {
            Object.keys(personProfileCache).forEach(id => {
              const entry = personProfileCache[id];
              if (!entry) return;
              if (entry.details && entry.details.id === userId) entry.details.requestSent = sent;
              if (entry.network && Array.isArray(entry.network.network)) {
                entry.network.network.forEach(m => { if (m.id === userId) m.requestSent = sent; });
              }
            });
          }
          // Re-render whatever of the above is actually on screen right now.
          const feedListEl = document.getElementById('feed-list');
          if (feedListEl && typeof renderFeed === 'function') renderFeed();
          const discoverListEl = document.getElementById('discover-people-list');
          if (discoverListEl && typeof discoverPeopleHTML === 'function') discoverListEl.innerHTML = discoverPeopleHTML();
          const ov = document.getElementById('overlay');
          if (ov && typeof currentOverlayKind !== 'undefined') {
            if (currentOverlayKind === 'personProfile' && typeof personProfileHTML === 'function') ov.innerHTML = personProfileHTML();
            if (currentOverlayKind === 'personNetwork' && typeof personNetworkHTML === 'function') ov.innerHTML = personNetworkHTML();
          }
        }

        function clearRequestSentLocally(userId){
          setConnectionTagEverywhere(userId, false);
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
          // Looking someone up counts as a real interest signal for the "Suggested for you" videos
          // elsewhere in the feed
          if (typeof recordContentInterestAuthor === 'function') recordContentInterestAuthor(userId);
          if (typeof recordProfileView === 'function') recordProfileView(userId);
          viewedProfile = Object.assign({
            id: userId, name: 'Stitch member', username: '', pronouns: '', bio: '', links: [],
            icon: 'user', avatarBg: 'bg-blue-50', photo: null,
            connected: isUserInMyNetwork(userId), requestSent: false, loaded: false,
            network: [], networkLoaded: false, networkCount: null,
          }, fallback || {});
          personProfileTab = 'videos';
          personProfileMenuOpen = false;

          const cached = personProfileCache[userId];
          const isFresh = cached && (Date.now() - cached.ts) < PERSON_PROFILE_CACHE_MS;
          if (cached) {
            Object.assign(viewedProfile, cached.details, cached.network);
          }
          openOverlay('personProfile');
          // Safety net: if either lookup hangs (poor connection), stop showing the skeleton after 8s
          // and show what we have rather than leaving the screen empty forever
          setTimeout(() => {
            if (viewedProfile && viewedProfile.id === userId && !(viewedProfile.loaded && viewedProfile.networkLoaded)) {
              viewedProfile.loaded = true; viewedProfile.networkLoaded = true;
              renderPersonProfile();
            }
          }, 8000);

          if (!isFresh) { loadPersonProfileDetails(userId); loadPersonNetwork(userId); }
          else { loadPersonProfileDetails(userId, true); loadPersonNetwork(userId, true); }
          const myId = await getCurrentUserId();
          if (myId && userId === myId && viewedProfile && viewedProfile.id === userId) {
            closeOverlay();
            if (typeof currentTab !== 'undefined' && currentTab === 2) {
              openOverlay('myFullProfile');
            } else {
              switchTab(4);
            }
          }
        }

        // ---- Other user's profile (view/connect/message) ----
        function openPersonProfileForConvo(convoId){
          const meta = convoMeta[convoId];
          if (!meta) return;
          // Tapping the header on a group conversation should open the group's own profile (name,
          // photo, members) instead of a person's profile
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
            const [{ data: row }, { data: fromRows, error: fromErr }, { data: toRows, error: toErr }] = await Promise.all([
              sb.from(PUBLIC_PROFILES_TABLE).select('*').eq('user_id', userId).maybeSingle(),
              me ? sb.from(CONNECTION_REQUESTS_TABLE).select('to_user,status').eq('from_user', me.id).eq('to_user', userId) : Promise.resolve({ data: [] }),
              me ? sb.from(CONNECTION_REQUESTS_TABLE).select('from_user,status').eq('to_user', me.id).eq('from_user', userId) : Promise.resolve({ data: [] }),
            ]);
            const existing = (viewedProfile && viewedProfile.id === userId) ? viewedProfile : null;
            const acceptedEitherWay = [...(fromRows || []), ...(toRows || [])].some(r => r.status === 'accepted');
            const details = {
              name: (row && (row.name || row.username)) || (existing && existing.name) || 'Stitch member',
              username: (row && row.username) || (existing && existing.username) || '',
              pronouns: (row && row.pronouns) || (existing && existing.pronouns) || '',
              bio: (row && row.bio) || '',
              photo: (row && row.photo) || (existing && existing.photo) || null,
              links: (row && Array.isArray(row.links)) ? row.links : [],
              // Server is the source of truth: if the other person removed the connection, local network
              // state is stale and must not keep showing them as connected
              connected: (me && !fromErr && !toErr) ? (acceptedEitherWay || (hasRecentLocalConnection(userId) && isUserInMyNetwork(userId))) : isUserInMyNetwork(userId),
              requestSent: (fromRows || []).some(r => r.status === 'pending'),
              loaded: true,
            };
            // Let the photo finish loading before the skeleton comes down (max 2.5s).
            if (!background && details.photo) {
              await new Promise(resolve => {
                try {
                  const im = new Image();
                  im.onload = im.onerror = () => resolve();
                  im.src = details.photo;
                  setTimeout(resolve, 2500);
                } catch (e) { resolve(); }
              });
            }
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
            // FIX: this used to select straight from connection_requests with .eq('from_user', userId)
            // / .eq('to_user', userId) for whichever OTHER person's profile we're viewing
            const countPromise = sb.rpc('get_network_count', { target_user: userId });
            const listPromise = sb.rpc('get_network_list', { target_user: userId });
            const [{ data: listRows, error: listError }, { data: countData, error: countError }] = await Promise.all([
              listPromise,
              countPromise,
            ]);
            const otherIds = (!listError && Array.isArray(listRows))
              ? listRows.map(r => r.other_user).filter((id, i, arr) => id && id !== userId && arr.indexOf(id) === i)
              : [];

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
                  // FIX: these used to always initialize to connected:false/ requestSent:false-ish state
                  // derived only from local convo caches computed at fetch time, so a person you'd already
                  connected: isUserInMyNetwork(id),
                  requestSent: (typeof isConnectionRequestPendingTo === 'function') ? isConnectionRequestPendingTo(id) : false,
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
            ${overlayHeader('Network', '20px', "openOverlay('personProfile')")}
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
                ${m.username ? `<div class="text-xs text-gray-400 mt-0.5 truncate">${escapeHtml(m.username)}</div>` : ''}
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

        // Tapping the "Pending" pill (LinkedIn-style) confirms before withdrawing, instead of
        // cancelling the request immediately
        function confirmWithdrawViewedProfileRequest(){
          if (!viewedProfile || !viewedProfile.requestSent) return;
          const name = viewedProfile.name || 'this person';
          openAppConfirmModal('Withdraw invitation?', `Your invitation to ${name} will be withdrawn.`, 'Withdraw', () => cancelConnectionRequestWithViewedProfile());
        }

        // ---- Message request compose (replaces the old prompt()-based flow) --
        let messageRequestComposeDraft = '';
        function messageAndConnectViewedProfile(){
          if (!viewedProfile) return;
          if (viewedProfile.connected) { messageViewedProfile(); return; }
          // A request is already pending: tapping Message opens the chat straight away
          // (it used to do nothing because the request was already sent)
          if (viewedProfile.requestSent) { messagePendingViewedProfile(); return; }
          messageRequestComposeDraft = '';
          openOverlayFrom('personProfile', 'messageRequestCompose');
        }

        function messageRequestComposeHTML(){
          const p = viewedProfile || {};
          const avatarInner = p.photo
            ? `<img src="${p.photo}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="w-full h-full items-center justify-center" style="display:none;">${Icon(p.icon || 'user','w-5 h-5')}</div>`
            : Icon(p.icon || 'user','w-5 h-5');
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

        async function messagePendingViewedProfile(){
          const p = viewedProfile;
          if (!p || !p.id) return;
          try {
            const convo = await ensureConvoForUser({
              otherUserId: p.id, name: p.name, username: p.username,
              photo: p.photo, avatarBg: p.avatarBg
            });
            if (!convo) { if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't start that chat. Please try again."); return; }
            closeOverlay();
            startNewMessageWith(convo.id);
          } catch (e) {
            console.warn('Opening chat with pending contact failed:', e);
            if (typeof openAppAlertModal === 'function') openAppAlertModal("Couldn't start that chat. Please try again.");
          }
        }

        async function messageViewedProfile(){
          if (!viewedProfile) return;
          const id = viewedProfile.id;
          const p = viewedProfile;
          const existing = convoArrays().flat().find(c => c.otherUserId === id);
          closeOverlay();
          if (existing) { startNewMessageWith(existing.id); return; }
          // Bug: when two people are connected but have never exchanged a message yet, no
          // conversation entry/convoMeta exists locally (those only get created by
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
                _localAt: Date.now(),
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
          if (changed && typeof cachedNetworkCount !== 'undefined' && cachedNetworkCount !== null && cachedNetworkCount > 0) cachedNetworkCount -= 1;
          markUserDisconnectedLocally(otherUserId);
          renderInboxTab();
          if (currentTab === 4) renderProfile(); 
        }

        // Flips every in-memory "connected" flag for this person back to "not connected" (Discover
        // list, their open profile, cached profiles, other people's network lists, feed posts) and
        // repaints whatever is on screen, so they show Connect + Message again
        function markUserDisconnectedLocally(userId){
          if (!userId) return;
          const dp = discoverPeople.find(p => p.id === userId);
          if (dp) { dp.connected = false; dp.requestSent = false; }
          if (viewedProfile) {
            if (viewedProfile.id === userId) { viewedProfile.connected = false; viewedProfile.requestSent = false; }
            if (Array.isArray(viewedProfile.network)) {
              viewedProfile.network.forEach(m => { if (m.id === userId) { m.connected = false; m.requestSent = false; } });
            }
          }
          Object.keys(personProfileCache).forEach(id => {
            const entry = personProfileCache[id];
            if (!entry) return;
            if (id === userId && entry.details) { entry.details.connected = false; entry.details.requestSent = false; }
            if (entry.network && Array.isArray(entry.network.network)) {
              entry.network.network.forEach(m => { if (m.id === userId) { m.connected = false; m.requestSent = false; } });
            }
          });
          if (typeof feedPosts !== 'undefined' && Array.isArray(feedPosts)) {
            feedPosts.forEach(p => { if (p.authorId === userId) p.connectRequestSent = false; });
          }
          try {
            const discoverListEl = document.getElementById('discover-people-list');
            if (discoverListEl) discoverListEl.innerHTML = discoverPeopleHTML();
            const ov = document.getElementById('overlay');
            if (ov && typeof currentOverlayKind !== 'undefined') {
              if (currentOverlayKind === 'personProfile') ov.innerHTML = personProfileHTML();
              else if (currentOverlayKind === 'personNetwork') ov.innerHTML = personNetworkHTML();
              else if (currentOverlayKind === 'myContacts' && typeof myContactsHTML === 'function') ov.innerHTML = myContactsHTML();
            }
            if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof renderFeed === 'function') renderFeed();
          } catch (e) { console.warn('Repainting after disconnect failed:', e); }
        }

        function removeConnectionWithViewedProfile(){
          if (!viewedProfile || !viewedProfile.connected) return;
          const id = viewedProfile.id;
          const name = viewedProfile.name || 'this person';
          openAppConfirmModal(`Remove ${name} from your network?`, '', 'Remove', async function(){
            // Remove immediately in the UI so it feels instant...
            viewedProfile.connected = false;
            renderPersonProfile();
            removeLocalConnection(id);
            const ok = await removeConnectionOnServer(id);
            // ...but if the backend removal didn't actually go through, put it back and tell the
            // person, instead of silently leaving a stale "accepted" row in the database that comes
            if (!ok) {
              if (typeof viewedProfile !== 'undefined' && viewedProfile && viewedProfile.id === id) viewedProfile.connected = true;
              if (typeof syncNetworkConnectionStates === 'function') syncNetworkConnectionStates();
              renderPersonProfile();
              if (typeof openAppAlertModal === 'function') openAppAlertModal(`Couldn't remove ${name}. Please try again.`);
              return;
            }
            if (typeof refreshNetworkCount === 'function') refreshNetworkCount();
          });
        }

        // Removing a mutual connection touches BOTH people's rows in connection_requests
        // (from_user=me/to_user=them AND from_user=them/to_user=me), but a plain .update() can
        async function removeConnectionOnServer(otherUserId){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.rpc('remove_connection', { target_user: otherUserId });
            if (error) { console.warn('removeConnectionOnServer failed:', error); return false; }
            return true;
          } catch (e) { console.warn('removeConnectionOnServer threw:', e); return false; }
        }

        let personProfileMenuOpen = false;
        // Close-only, so repeated touchmove/wheel events from a scroll can't flip the menu back open
        function closePersonProfileMenu(){ if (personProfileMenuOpen) togglePersonProfileMenu(); }

        function togglePersonProfileMenu(){
          personProfileMenuOpen = !personProfileMenuOpen;
          // Patch just the action row (Connect/Message/... pills) in place instead of re-rendering
          // the whole profile screen
          const row = document.getElementById('person-profile-action-row');
          if (row && currentOverlayKind === 'personProfile') {
            row.outerHTML = personProfileActionRowHTML(viewedProfile || {});
            return;
          }
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'personProfile') ov.innerHTML = personProfileHTML();
        }

        function isPersonProfileBlocked(p){
          return !!p && typeof blockedAccounts !== 'undefined' && blockedAccounts.some(b => b.name === p.name);
        }

        function togglePersonProfileBlock(){
          const p = viewedProfile;
          if (!p) return;
          if (isPersonProfileBlocked(p)) unblockAccount(p.name);
          else blockAccount(p.name, p.icon, p.avatarBg, p.photo);
          renderPersonProfile();
        }

        // ---- LinkedIn-style pill row: Connect/Message/Pending on the left, a round "..." dots
        // button (Share/Block/Remove) on the right --
        function personProfileActionRowHTML(p){
          const pillBase = 'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold min-w-0';
          const filled = `color:#fff;background:${ROYAL};`;
          const outline = 'border:1.5px solid #d1d5db;color:#6b7280;';
          let pills;
          if (p.connected) {
            pills = `<button onclick="messageViewedProfile()" class="${pillBase}" style="${filled}">${Icon('mail','w-4 h-4')} Message</button>`;
          } else if (p.requestSent) {
            pills = `
              <button onclick="messageAndConnectViewedProfile()" class="${pillBase}" style="${filled}">${Icon('mail','w-4 h-4')} Message</button>
              <button onclick="confirmWithdrawViewedProfileRequest()" class="${pillBase} bg-white" style="${outline}">${Icon('clock','w-4 h-4')} Pending</button>`;
          } else {
            pills = `
              <button onclick="connectWithViewedProfile()" class="${pillBase}" style="${filled}">${Icon('personPlus','w-4 h-4')} Connect</button>
              <button onclick="messageAndConnectViewedProfile()" class="${pillBase} bg-white" style="${outline}">${Icon('mail','w-4 h-4')} Message</button>`;
          }
          return `
            <div id="person-profile-action-row" class="flex items-center gap-2 mb-4 relative">
              ${pills}
              <button onclick="togglePersonProfileMenu()" aria-label="More" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="border:1.5px solid #d1d5db;color:#374151;">${IconBold('dots','w-5 h-5')}</button>
              ${personProfileMenuOpen ? `<div onclick="closePersonProfileMenu()" onwheel="closePersonProfileMenu()" ontouchmove="closePersonProfileMenu()" class="fixed inset-0 z-10"></div>${personProfileDropdownMenuHTML(p)}` : ''}
            </div>`;
        }

        // ---- "More" menu for a viewed profile: a small dropdown card anchored to the right,
        // right under the "..." button --
        function personProfileDropdownMenuHTML(p){
          const blocked = isPersonProfileBlocked(p);
          const rows = [
            { onclick: "togglePersonProfileMenu(); openOverlayFrom('personProfile','personProfileQR');", icon: 'send', label: 'Share profile' },
            { onclick: "togglePersonProfileMenu(); togglePersonProfileBlock();", icon: 'block', label: blocked ? 'Unblock' : 'Block', cls: 'text-red-500' }
          ];
          if (p.connected) {
            rows.push({ onclick: "togglePersonProfileMenu(); removeConnectionWithViewedProfile();", icon: 'trash', label: 'Remove', cls: 'text-red-500' });
          }
          return classMenuSheetHTML('togglePersonProfileMenu', rows);
        }

        // ---- Share a viewed (other) person's profile as a QR code ----
        function personProfileQRLink(p){
          return `https://stitch.app/@${escapeHtml(p.username || '')}`;
        }

        function personProfileQRHTML(){
          const p = viewedProfile || {};
          return `
            <div class="flex-1 flex flex-col overflow-y-auto" style="background:#ffffff;">
              <div class="flex items-center px-5 flex-shrink-0" style="padding-top:var(--top-safe-pad);">
                <button onclick="closeOverlay()" class="text-[${NAVY}]">${IconBold('close','w-6 h-6')}</button>
              </div>
              <div class="flex-1 flex flex-col items-center px-8" style="padding-top:48px;">
                <div class="bg-white rounded-3xl p-5 flex flex-col items-center shadow-xl" style="width:280px;">
                  <div id="person-profile-qr-code" class="relative flex items-center justify-center" style="width:240px;height:240px;">
                    <div class="absolute rounded-2xl bg-white flex items-center justify-center" style="width:52px;height:52px;box-shadow:0 0 0 5px #ffffff;">
                      <div class="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center" style="background:linear-gradient(135deg, ${ROYAL}, ${NAVY});">
                        ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : Icon('user','w-5 h-5 text-white')}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex-1"></div>
                <div class="flex flex-col items-center" style="margin-bottom:50px;width:280px;">
                  <div class="font-bold text-lg font-display mb-3 tracking-wide text-[${NAVY}]">${p.username ? escapeHtml(p.username.toUpperCase()) : escapeHtml(p.name || 'STITCH MEMBER')}</div>
                  <div class="flex items-center justify-between rounded-3xl pt-2.5 pb-3 px-4 bg-white shadow-xl" style="width:280px;">
                    ${qrActionButton('send','Share','sharePersonProfileQR()')}
                    ${qrActionButton('link','Copy','copyPersonProfileQRLink()')}
                    ${qrActionButton('download','Download','downloadPersonProfileQR()')}
                  </div>
                </div>
              </div>
            </div>`;
        }

        function initPersonProfileQRCode(){
          const el = document.getElementById('person-profile-qr-code');
          if (!el || typeof QRCode === 'undefined') return;
          Array.from(el.querySelectorAll('canvas, table, img')).forEach(n => n.remove());
          new QRCode(el, {
            text: personProfileQRLink(viewedProfile || {}),
            width: 240,
            height: 240,
            colorDark: NAVY,
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
          });
          const canvas = el.querySelector('canvas') || el.querySelector('img');
          if (canvas) canvas.style.position = 'relative';
        }

        function sharePersonProfileQR(){
          const p = viewedProfile || {};
          const link = personProfileQRLink(p);
          if (navigator.share) {
            navigator.share({ title: p.name, text: `Check out ${p.username ? escapeHtml(p.username) : (p.name || 'this profile')} on Stitch`, url: link }).catch(() => {});
          } else {
            copyPersonProfileQRLink();
          }
        }

        function copyPersonProfileQRLink(){
          const link = personProfileQRLink(viewedProfile || {});
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Link copied to clipboard')).catch(() => openAppAlertModal(link));
          } else {
            openAppAlertModal(link);
          }
        }

        function downloadPersonProfileQR(){
          const el = document.getElementById('person-profile-qr-code');
          const qrCanvas = el ? el.querySelector('canvas') : null;
          if (!qrCanvas) { openAppAlertModal('QR code is still generating, try again in a moment.'); return; }
          const p = viewedProfile || {};
          const size = 640, pad = 60;
          const out = document.createElement('canvas');
          out.width = size; out.height = size + 140;
          const ctx = out.getContext('2d');

          const drawBaseAndSave = () => {
            const link = document.createElement('a');
            link.download = `${escapeHtml(p.username || 'stitch-profile')}-qr.png`;
            link.href = out.toDataURL('image/png');
            link.click();
          };

          const drawBase = () => {
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, 0, 0, out.width, out.height, 36);
            ctx.fill();
            const qrSize = size - pad * 2;
            ctx.drawImage(qrCanvas, pad, pad, qrSize, qrSize);
            ctx.fillStyle = NAVY;
            ctx.font = 'bold 34px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(p.username ? p.username.toUpperCase() : (p.name || 'STITCH MEMBER'), out.width / 2, size + 80);
          };

          const centerX = pad + (size - pad * 2) / 2;
          const centerY = pad + (size - pad * 2) / 2;

          const drawBadge = (img) => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX, centerY, 32, 0, Math.PI * 2);
            ctx.clip();
            if (img) {
              ctx.drawImage(img, centerX - 32, centerY - 32, 64, 64);
            } else {
              const grad = ctx.createLinearGradient(centerX - 32, centerY - 32, centerX + 32, centerY + 32);
              grad.addColorStop(0, ROYAL);
              grad.addColorStop(1, NAVY);
              ctx.fillStyle = grad;
              ctx.fillRect(centerX - 32, centerY - 32, 64, 64);
            }
            ctx.restore();
          };

          drawBase();
          if (p.photo) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => { drawBadge(img); drawBaseAndSave(); };
            img.onerror = () => { drawBadge(null); drawBaseAndSave(); };
            img.src = p.photo;
          } else {
            drawBadge(null);
            drawBaseAndSave();
          }
        }

        // Whole-screen placeholder shown until the person's details AND network count have loaded,
        // so nobody lands on a half-filled profile ("Loading profile...", "..." network count)
        function personProfileSkeletonHTML(){
          return `
            <div class="px-5 pb-3 flex items-center gap-1 relative" style="padding-top:var(--top-safe-pad);">
              <button onclick="overlayGoBack()" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <div class="skel-line skel-shimmer" style="width:110px;height:16px;"></div>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div class="p-5">
                <div class="flex items-center gap-5 mb-4">
                  <div class="skel-avatar skel-shimmer flex-shrink-0" style="width:80px;height:80px;border-radius:9999px;"></div>
                  <div class="flex-1">
                    <div class="skel-line skel-shimmer mb-3" style="width:55%;height:16px;"></div>
                    <div class="flex items-start gap-6">
                      <div class="skel-line skel-shimmer" style="width:44px;height:30px;"></div>
                      <div class="skel-line skel-shimmer" style="width:56px;height:30px;"></div>
                    </div>
                  </div>
                </div>
                <div class="skel-line skel-shimmer mb-2" style="width:90%;"></div>
                <div class="skel-line skel-shimmer mb-5" style="width:65%;"></div>
                <div class="skel-line skel-shimmer" style="width:100%;height:40px;border-radius:14px;"></div>
              </div>
              <div class="grid grid-cols-3 gap-[2px] px-0">
                ${Array.from({ length: 6 }).map(() => `<div class="skel-shimmer" style="aspect-ratio:1/1;"></div>`).join('')}
              </div>
            </div>`;
        }

        function personProfileHTML(){
          const p = viewedProfile || {};
          if (!(p.loaded && p.networkLoaded)) return personProfileSkeletonHTML();
          // NOTE: this used to also require p.connected, on the idea that a photo shouldn't be
          // visible to someone outside this person's network
          const showPhoto = !!p.photo;
          // Same broken-image fallback as avatarMediaHTML in chat.js / editProfileHTML in
          // profile.js: an image that fails to load falls back to the plain silhouette instead of
          // showing the browser's broken-image icon
          const avatarInner = showPhoto
            ? `<img src="${p.photo}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <div class="w-full h-full items-center justify-center" style="display:none;">${Icon(p.icon || 'user','w-9 h-9')}</div>`
            : Icon(p.icon || 'user','w-9 h-9');
          const postGroups = personProfilePostGroups();
          const theirPostsCount = postGroups.videos.length + postGroups.pictures.length + postGroups.reposts.length;
          const networkCount = typeof p.networkCount === 'number' ? p.networkCount : '\u00b7\u00b7\u00b7';
          // The header (back arrow + username) lives INSIDE the scrolling area so the whole profile
          return `
            <div class="flex-1 overflow-y-auto">
            <div class="px-5 pb-3 flex items-center gap-1 relative" style="padding-top:var(--top-safe-pad);">
              <button onclick="overlayGoBack()" class="w-10 h-10 flex items-center justify-center">${gradIcon(IconBold('back','w-5 h-5'))}</button>
              <span class="nm-wrap nm-left font-bold" style="flex:1;min-width:0;font-family:'Montserrat',sans-serif;font-size:16px;"><span class="nm-inner grad-text">${escapeHtml(p.username ? String(p.username) : String(p.name || 'Profile'))}</span></span>
            </div>
            <div class="p-5">
              <div class="flex items-center gap-5 mb-4">
                <div class="relative flex-shrink-0">
                  <button ${showPhoto ? `onclick="viewProfilePhoto('${escapeForJsAttr(p.photo)}', '${escapeForJsAttr(p.name || 'Stitch member')}')"` : ''} class="w-20 h-20 ${p.avatarBg || 'bg-blue-50'} rounded-full flex items-center justify-center text-gray-600 overflow-hidden">${avatarInner}</button>
                </div>
                <div class="flex-1">
                  <div class="font-bold text-base mb-2">${escapeHtml(p.name || 'Stitch member')}${p.pronouns ? ` <span class="font-normal text-gray-400">${escapeHtml(p.pronouns)}</span>` : ''}</div>
                  <div class="flex items-start gap-6">
                    <div class="text-left"><div class="text-base font-bold">${theirPostsCount}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Posts</div></div>
                    <button onclick="openPersonNetwork()" class="text-left"><div class="text-base font-bold">${networkCount}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Network</div></button>
                  </div>
                </div>
              </div>
              ${!p.loaded ? `<div class="text-gray-400 text-xs mb-6">Loading profile...</div>` : `
                ${p.bio ? `<div class="text-sm text-gray-600 mb-4">${escapeHtml(p.bio)}</div>` : ''}
                ${profileLinksHTML(p.links)}
                ${personProfileActionRowHTML(p)}
              `}
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
          if (opts.sheetToggle) {
            const rows = [
              { onclick: `${handlerName}('pin')`, icon: 'pin', label: 'Pin' },
              { onclick: `${handlerName}('read')`, icon: 'check', label: 'Mark as read' },
              { onclick: `${handlerName}('block')`, icon: 'lock', label: 'Block' }
            ];
            if (showDelete) rows.push({ onclick: `${handlerName}('delete')`, icon: 'trash', label: 'Delete', cls: 'text-red-500' });
            return classMenuSheetHTML(opts.sheetToggle, rows);
          }
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
          // Prefer the device's own notification tone (set in the phone's system settings, or the
          // browser's default) over a synthesized beep
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

        // ---- Notification avatars + persistent read state ----
        const notifPhotoCache = {};      // userId -> photo url (or '' when they have none)
        const notifPhotoRequested = new Set();

        function notifUserIdFor(n){
          if (!n || n.source === 'classroom' || n.type === 'group') return null;
          let uid = n.otherUserId || null;
          if (!uid && n.convoId && typeof convoMeta !== 'undefined' && convoMeta[n.convoId]) {
            const m = convoMeta[n.convoId];
            if (m.icon === 'users') return null;
            uid = m.otherUserId || null;
          }
          return uid;
        }

        function notifPhotoFor(n){
          const uid = notifUserIdFor(n);
          if (!uid) return null;
          if (notifPhotoCache[uid]) return notifPhotoCache[uid];
          if (typeof convoMeta !== 'undefined') {
            for (const k in convoMeta) {
              const m = convoMeta[k];
              if (m && m.otherUserId === uid && m.photo) return m.photo;
            }
          }
          return null;
        }

        async function notifHydratePhotos(list){
          try {
            const sb = getSupabaseClient();
            if (!sb) return;
            const ids = [];
            (list || notifData).forEach(n => {
              const uid = notifUserIdFor(n);
              if (uid && !notifPhotoFor(n) && !notifPhotoRequested.has(uid) && ids.indexOf(uid) === -1) ids.push(uid);
            });
            if (!ids.length) return;
            ids.forEach(id => notifPhotoRequested.add(id));
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id,photo').in('user_id', ids);
            let found = false;
            (data || []).forEach(r => { if (r && r.photo) { notifPhotoCache[r.user_id] = r.photo; found = true; } });
            if (found && typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
          } catch (e) {}
        }

        // Person avatar (photo, or the round user placeholder) for person-related notifications;
        // everything else keeps its themed icon tile.
        function notifAvatarHTML(n){
          const uid = notifUserIdFor(n);
          if (!uid) return `<div class="w-10 h-10 ${n.iconBg} rounded-2xl flex items-center justify-center ${n.iconClass} flex-shrink-0">${NotifIcon(n.icon,'w-5 h-5')}</div>`;
          const photo = notifPhotoFor(n);
          return `<div class="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-gray-600 flex-shrink-0 overflow-hidden">${avatarMediaHTML(photo, 'user', 'w-5 h-5')}</div>`;
        }

        // Read flags are also remembered on this device, so a stale server copy of the saved state
        // (debounced save, quick logout) can never turn an already-read notification unread again
        function notifReadStoreKey(){
          const u = (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
          return u ? 'stitch_read_notifs_' + u : null;
        }
        function persistNotifReadLocal(){
          try {
            const key = notifReadStoreKey();
            if (!key || typeof userStateLoadedForUserId === 'undefined' || userStateLoadedForUserId !== _cachedAuthUser.id) return;
            let stored = [];
            try { stored = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) {}
            const set = new Set(stored);
            notifData.forEach(n => { if (n.read) set.add(n.id); });
            localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-600)));
          } catch (e) {}
        }
        function applyNotifReadLocal(){
          try {
            const key = notifReadStoreKey();
            if (!key) return;
            const set = new Set(JSON.parse(localStorage.getItem(key) || '[]') || []);
            notifData.forEach(n => { if (set.has(n.id)) n.read = true; });
          } catch (e) {}
        }

        // Every notification shakes the bell (the red count badge is handled by refreshNotifBadge)
        function ringNotifBell(){
          try {
            const icon = document.querySelector('#notif-bell-btn .notif-bell-icon');
            if (!icon) return;
            icon.classList.remove('bell-ring');
            void icon.offsetWidth;
            icon.classList.add('bell-ring');
            setTimeout(() => icon.classList.remove('bell-ring'), 1400);
          } catch (e) {}
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
            body: opts.body || null,
            thumb: opts.thumb || null,
            thumbType: opts.thumbType || 'image',
            createdAt: opts.createdAt || Date.now(),
            time: 'now',
            read: false,
            pinned: !!opts.pinned,
            otherUserId: opts.otherUserId || null,
            convoId: opts.convoId || null,
            postId: opts.postId != null ? opts.postId : null,
            classId: opts.classId || null,
            jobId: opts.jobId || null,
            workId: opts.workId || null,
            route: opts.route || null,
            tab: opts.tab || null,
            meetingCode: opts.meetingCode || null,
          });
          playNotifChime(opts.name || 'Stitch', opts.message || '');
          queueSaveUserState();
          refreshNotifBadge();
          ringNotifBell();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
          // No per-event email anymore -- rolled into the daily digest (send-daily-digest).
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
              const bellBtn = document.getElementById('notif-bell-btn') || (topbarIcons && topbarIcons.querySelector('button:last-child'));
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
          if ((n.type === 'post' || n.type === 'comment' || n.type === 'like' || n.type === 'repost' || n.type === 'tag' || n.type === 'share') && n.postId != null && typeof openPostDetail === 'function') {
            n.read = true;
            queueSaveUserState();
            closeOverlay();
            switchTab(0);
            // Open the post itself (fetched directly if it isn't loaded on this device yet).
            if (typeof openPostById === 'function') openPostById(n.postId);
            return;
          }
          if (n.type === 'classroom' && !n.__openDirect && (n.body || n.message)) {
            openNotifDetail(id);
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
              // Join-request / new-enrollment notices set tab:'people' so tapping them lands straight on
              // the roster (where Approve/Deny live) instead of the stream
              classDetailTab = n.tab || 'stream';
              openOverlay('classDetail');
            }
            return;
          }
          if ((n.type === 'meeting_admin' || n.type === 'meeting_reminder') && n.meetingCode) {
            n.read = true;
            queueSaveUserState();
            closeOverlay();
            openMeetingByCode(n.meetingCode);
            return;
          }
          if ((n.type === 'opportunity' || n.type === 'application_status' || n.type === 'application_message' || n.type === 'interview_scheduled') && n.jobId && typeof openJobDetail === 'function') {
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
          // Anything else has nowhere to go: show what it says in full.
          if (n.body || n.message) { openNotifDetail(id); renderNotifTab(); return; }
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

        // ---- Grouping ----
        let notifGroupOpenKey = null;

        function notifGroupKey(n){
          if (!n || n.source === 'classroom') return null;
          if (n.type === 'connect_request' || n.type === 'connect_accepted') return null;
          if (n.type === 'message' || n.type === 'missed_call') return 'convo:' + (n.convoId || n.otherUserId || n.name);
          if (n.type === 'application_message') return 'jobmsg:' + (n.jobId || n.name);
          if (n.type === 'application_status' || n.type === 'poster_approved' || n.type === 'poster_denied' || n.type === 'opportunity_reported') return 'type:' + n.type;
          return null;
        }

        function notifGroupItems(key){
          return notifData.filter(n => notifGroupKey(n) === key);
        }

        function notifBuildGroups(){
          const counts = {};
          notifData.forEach(n => { const k = notifGroupKey(n); if (k) counts[k] = (counts[k] || 0) + 1; });
          const seen = new Set();
          const rows = [];
          const ordered = notifData.map((n, i) => ({ n, i })).sort((x, y) => ((y.n.pinned ? 1 : 0) - (x.n.pinned ? 1 : 0)) || (x.i - y.i)).map(x => x.n);
          ordered.forEach(n => {
            const k = notifGroupKey(n);
            if (k && counts[k] > 1) {
              if (seen.has(k)) return;
              seen.add(k);
              rows.push({ group: true, key: k, items: notifGroupItems(k) });
            } else {
              rows.push({ group: false, n });
            }
          });
          return rows;
        }

        function notifOpenGroup(key){
          if (notifSelected.size) return;
          notifGroupOpenKey = key;
          let changed = false;
          notifGroupItems(key).forEach(n => { if (!n.read) { n.read = true; changed = true; } });
          if (changed) { queueSaveUserState(); refreshNotifBadge(); }
          renderNotifTab();
        }
        function notifCloseGroup(){
          notifGroupOpenKey = null;
          renderNotifTab();
        }
        function notifGroupBack(){
          if (notifGroupOpenKey) notifCloseGroup(); else closeOverlay();
        }
        function notifMarkGroupRead(key){
          notifGroupItems(key).forEach(n => { n.read = true; });
          queueSaveUserState();
          refreshNotifBadge();
          renderNotifTab();
        }
        function notifDeleteGroup(key){
          for (let i = notifData.length - 1; i >= 0; i--){
            if (notifGroupKey(notifData[i]) === key) notifData.splice(i, 1);
          }
          notifGroupOpenKey = null;
          queueSaveUserState();
          refreshNotifBadge();
          renderNotifTab();
        }

        function notifGroupRowHTML(g){
          const items = g.items;
          const latest = items[0];
          const unread = items.filter(n => !n.read).length;
          const allRead = unread === 0;
          const title = (latest.type === 'message' || latest.type === 'missed_call') ? latest.name : (latest.name || 'Notifications');
          const preview = latest.body || latest.message || '';
          return `
            <div class="rounded-3xl p-4 flex items-start gap-3 ${allRead ? 'bg-gray-50' : 'bg-amber-50'}" onclick="notifOpenGroup('${g.key}')" style="cursor:pointer;">
              ${notifAvatarHTML(latest)}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-sm ${allRead ? 'text-gray-500' : ''}" style="${allRead ? '' : `color:${NAVY};`}">${escapeHtml(title)}</div>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background:${allRead ? '#e5e7eb' : ROYAL};color:${allRead ? '#6b7280' : '#fff'};">${allRead ? items.length : unread + ' new'}</span>
                </div>
                <div class="text-sm ${allRead ? 'text-gray-400' : 'text-gray-600'} leading-relaxed truncate mt-0.5">${escapeHtml(preview)}</div>
              </div>
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <div class="text-[10px] text-gray-400 whitespace-nowrap">${formatNotifTime(latest.createdAt)}</div>
                <span class="text-gray-300">${Icon('arrowRight','w-4 h-4')}</span>
              </div>
            </div>`;
        }

        function notifGroupTitle(key, items){
          const first = items[0];
          if (!first) return 'Notifications';
          if (key.indexOf('convo:') === 0) return first.name || 'Messages';
          return first.name || 'Notifications';
        }

        function notifGroupDetailHTML(key){
          const items = notifGroupItems(key);
          if (!items.length) { notifGroupOpenKey = null; return null; }
          const title = notifGroupTitle(key, items);
          const cards = notifCards(items, { selected: notifSelected, longPressFn: 'notifLongPressSelect', tapFn: 'notifTap', full: true });
          return `
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
              ${menuOverlayHeader(escapeHtml(title), notifMenuOpen, 'toggleNotifMenu', notifActionsDropdownHTML('handleNotifAction', { sheetToggle: 'toggleNotifMenu' }), { backFn: notifSelected.size ? 'notifCancelSelect' : 'notifGroupBack', hideMenuOnDesktop: true })}
              <div class="p-5">
                <div class="flex items-center justify-between mb-3">
                  <div class="text-xs text-gray-400">${items.length} ${items.length === 1 ? 'notification' : 'notifications'}</div>
                  <div class="flex items-center gap-4">
                    <button onclick="notifMarkGroupRead('${key}')" class="text-xs font-semibold" style="color:${ROYAL};">Mark all read</button>
                    <button onclick="notifDeleteGroup('${key}')" class="text-xs font-semibold text-red-500">Clear all</button>
                  </div>
                </div>
                <div class="notif-list space-y-2">${cards}</div>
              </div>
            </div>`;
        }

        function renderNotifTab(){
          const ov = document.getElementById('overlay');
          const prevNotifScrollEl = ov.querySelector('.overflow-y-auto');
          const prevNotifScrollTop = prevNotifScrollEl ? prevNotifScrollEl.scrollTop : 0;
          let html = notifGroupOpenKey ? notifGroupDetailHTML(notifGroupOpenKey) : null;
          if (!html) {
            const rows = notifBuildGroups();
            const listHTML = rows.length
              ? rows.map(r => r.group ? notifGroupRowHTML(r) : notifCards([r.n], { selected: notifSelected, longPressFn: 'notifLongPressSelect', tapFn: 'notifTap' })).join('')
              : '<div class="text-sm text-gray-400 text-center py-10">No notifications yet.</div>';
            html = `
              <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
                ${menuOverlayHeader('Notifications', notifMenuOpen, 'toggleNotifMenu', notifActionsDropdownHTML('handleNotifAction', { sheetToggle: 'toggleNotifMenu' }), { backFn: notifSelected.size ? 'notifCancelSelect' : 'closeOverlay', hideMenuOnDesktop: true, shortDashes: true })}
                <div class="p-5">
                  <div class="notif-list space-y-2">${listHTML}</div>
                </div>
              </div>`;
          }
          ov.innerHTML = html;
          notifHydratePhotos();
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
                : notifAvatarHTML(n)}
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-sm ${n.read ? 'text-gray-500' : ''}" style="${n.read ? '' : `color:${NAVY};`}">${escapeHtml(n.name)}</div>
                  ${n.pinned ? Icon('pin','w-3.5 h-3.5 text-amber-600') : ''}
                </div>
                <div class="flex items-center justify-between gap-2 mt-0.5">
                  <div class="text-sm ${n.read ? 'text-gray-400' : 'text-gray-600'} leading-relaxed ${opts.full ? 'break-words' : 'truncate'}" ${opts.full ? 'style="white-space:normal;overflow-wrap:anywhere;"' : ''}>${escapeHtml(opts.full && n.body ? n.body : n.message)}</div>
                  ${n.type === 'connect_request' ? connectRequestActionsHTML(n) : ''}
                </div>
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
        function connectRequestActionsHTML(n){
          if (n.connectionStatus === 'accepted'){
            return `<div class="flex items-center gap-1 text-xs font-semibold flex-shrink-0" style="color:${ROYAL};">${IconBold('check','w-3.5 h-3.5')} Accepted</div>`;
          }
          if (n.connectionStatus === 'declined'){
            return `<div class="flex items-center gap-1 text-xs font-semibold text-gray-400 flex-shrink-0">${IconBold('close','w-3.5 h-3.5')} Declined</div>`;
          }
          return `
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button onclick="event.stopPropagation(); declineConnection('${n.id}')" aria-label="Decline" class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white" style="border:1.5px solid #d1d5db;color:#6b7280;">${IconBold('close','w-3.5 h-3.5')}</button>
              <button onclick="event.stopPropagation(); acceptConnection('${n.id}')" aria-label="Accept" class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white" style="border:1.5px solid ${ROYAL};color:${ROYAL};">${IconBold('check','w-3.5 h-3.5')}</button>
            </div>`;
        }

        // Keeps the notification for a connection request in step with the Requests list (and the
        // other way round)
        function syncConnectNotif(match, action){
          try {
            if (typeof notifData === 'undefined' || !Array.isArray(notifData)) return;
            const hit = (n) => n && n.type === 'connect_request' && (
              (match.requestId && (n.id === match.requestId || n.connectionRequestId === match.requestId)) ||
              (match.otherUserId && n.otherUserId === match.otherUserId));
            let changed = false;
            for (let i = notifData.length - 1; i >= 0; i--) {
              const n = notifData[i];
              if (!hit(n)) continue;
              if (action === 'remove') { notifData.splice(i, 1); changed = true; }
              else if (n.connectionStatus !== action) { n.connectionStatus = action; n.read = true; changed = true; }
            }
            if (!changed) return;
            if (typeof queueSaveUserState === 'function') queueSaveUserState();
            if (typeof refreshNotifBadge === 'function') refreshNotifBadge();
            if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications' && typeof renderNotifTab === 'function') renderNotifTab();
            if (typeof rightPanelMode !== 'undefined' && rightPanelMode === 'pinned' && typeof renderRightPanelBody === 'function') renderRightPanelBody();
          } catch (e) {}
        }

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
          n.connectionStatus = 'accepted';
          n.read = true;
          queueSaveUserState();
          if (typeof acceptRequest === 'function') acceptRequest(id);
          refreshNotifBadge();
          renderNotifTab();
        }

        function declineConnection(id){
          const n = notifData.find(x => x.id === id);
          if (!n) return;
          n.connectionStatus = 'declined';
          n.read = true;
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
            return;
          }
          openNotifDetail(id);
        }

        // ---- Notification detail sheet ----
        function notifDetailSheetHTML(d){
          return `
            <div id="notifDetailModal" class="fixed inset-0 z-50 flex items-end" style="background:rgba(0,0,0,0.45);" onclick="closeNotifDetail()">
              <div class="w-full bg-white" style="border-radius:22px 22px 0 0;padding:14px 20px calc(env(safe-area-inset-bottom, 0px) + 20px);max-height:80%;overflow-y:auto;" onclick="event.stopPropagation()">
                <div style="width:42px;height:5px;border-radius:9999px;background:#c7cad1;margin:0 auto 14px;"></div>
                <div class="flex items-center gap-3 mb-3">
                  <span class="w-11 h-11 rounded-full ${d.iconBg} ${d.iconClass} flex items-center justify-center flex-shrink-0">${NotifIcon(d.icon,'w-5 h-5')}</span>
                  <div class="min-w-0">
                    <div class="font-bold text-base text-gray-800">${escapeHtml(d.title)}</div>
                    ${d.time ? `<div class="text-xs text-gray-400">${escapeHtml(d.time)}</div>` : ''}
                  </div>
                </div>
                <div class="text-sm text-gray-600 leading-relaxed" style="white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(d.body)}</div>
                ${d.openFn ? `<button onclick="closeNotifDetail(); ${d.openFn}" class="w-full mt-5 font-semibold py-3 rounded-full text-white" style="background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);">${escapeHtml(d.openLabel || 'Open')}</button>` : ''}
              </div>
            </div>`;
        }
        function showNotifDetail(d){
          closeNotifDetail();
          const wrap = document.createElement('div');
          wrap.id = 'notifDetailWrap';
          wrap.innerHTML = notifDetailSheetHTML(d);
          document.body.appendChild(wrap);
        }
        function closeNotifDetail(){
          const w = document.getElementById('notifDetailWrap');
          if (w) w.remove();
        }
        function openNotifTarget(id){
          const n = notifData.find(x => x.id === id);
          if (!n) return;
          n.__openDirect = true;
          try { notifTap(id); } finally { n.__openDirect = false; }
        }
        function openNotifDetail(id){
          const n = notifData.find(x => x.id === id);
          if (!n) return;
          if (!n.read) { n.read = true; queueSaveUserState(); refreshNotifBadge(); }
          const isCancel = n.type === 'cancel_reason' && typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin();
          const canOpen = (n.type === 'classroom' && n.classId) || isCancel;
          showNotifDetail({
            icon: n.icon, iconBg: n.iconBg, iconClass: n.iconClass,
            title: n.name || 'Notification',
            time: (typeof formatNotifTime === 'function' && n.createdAt) ? formatNotifTime(n.createdAt) : '',
            body: n.body || n.message || '',
            openFn: isCancel ? 'openAdminCancellations()' : (canOpen ? `openNotifTarget('${n.id}')` : ''),
            openLabel: isCancel ? 'See cancellations' : 'Open space'
          });
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'classAnnouncements') renderClassAnnouncementsTab();
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
              ${menuOverlayHeader('Notice Board', noticeBoardMenuOpen, 'toggleNoticeBoardMenu', notifActionsDropdownHTML('handleNoticeAction', { align: 'left', sheetToggle: 'toggleNoticeBoardMenu' }), { hideBack: true, shortDashes: true, titleLeft: true, titleSize: 'text-xl', menuLeft: true, flipMenuIcon: true })}
              <div class="p-5">
                <div class="space-y-3">${classroomNotifs.length ? notifCards(classroomNotifs, { selected: noticeSelected, longPressFn: 'noticeLongPressSelect', tapFn: 'noticeTap', renderFn: 'renderClassAnnouncementsTab' }) : '<div class="text-sm text-gray-400 text-center py-6">No space announcements yet.</div>'}</div>
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

        // ---- Keep #overlay from being pushed up by the on-screen keyboard ----
        (function pinOverlayHeightAgainstKeyboard(){
          const KEYBOARD_TRACKING_KINDS = ['conversation', 'aiClass'];
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const vv = window.visualViewport;
          let restH = window.innerHeight;
          function tracksKeyboardItself(){
            return typeof currentOverlayKind !== 'undefined' && KEYBOARD_TRACKING_KINDS.indexOf(currentOverlayKind) !== -1;
          }
          function isTyping(){
            const a = document.activeElement;
            return !!(a && ov.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName));
          }
          function applyStableHeight(){
            if (typeof currentOverlayKind !== 'undefined' && (currentOverlayKind === 'careerMatches' || currentOverlayKind === 'careerAutoApply' || currentOverlayKind === 'careerPreferences' || currentOverlayKind === 'careerCancelDetail' || currentOverlayKind === 'careerDocuments')) { ov.style.removeProperty('height'); return; }
            if (tracksKeyboardItself()) { ov.style.removeProperty('height'); return; }
            const h = vv ? vv.height : window.innerHeight;
            if (!isTyping() && Math.abs(window.innerHeight - h) < 60) {
              restH = h;
              ov.style.height = h + 'px';
            }
          }
          // Exposed so openOverlay() (below) can re-pin/clear the height the instant a new overlay
          // kind opens, instead of waiting on the next resize/focus event
          window.__pinOverlayApplyStable = applyStableHeight;
          function dropNow(){
            if (tracksKeyboardItself()) return;
            if (typeof currentOverlayKind !== 'undefined' && (currentOverlayKind === 'careerMatches' || currentOverlayKind === 'careerAutoApply' || currentOverlayKind === 'careerPreferences' || currentOverlayKind === 'careerCancelDetail' || currentOverlayKind === 'careerDocuments')) return;
            ov.style.height = restH + 'px';
          }
          applyStableHeight();
          window.addEventListener('resize', applyStableHeight);
          window.addEventListener('orientationchange', function(){ setTimeout(applyStableHeight, 300); });
          // Scroll the focused field into view ourselves, same as the auth-gate version
          document.addEventListener('focusin', function(e){
            if (tracksKeyboardItself()) return;
            if (!ov.contains(e.target) || !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
            const target = e.target;
            const scrollEl = target.closest('.overflow-y-auto') || ov;
            // Wait a beat for the keyboard (and visualViewport) to settle before measuring, so this
            // doesn't scroll against the still-full pre-keyboard viewport
            setTimeout(function(){
              if (document.activeElement !== target) return;
              const vv = window.visualViewport;
              const visibleBottom = vv ? (vv.offsetTop + vv.height) : window.innerHeight;
              const margin = 16;
              const overflow = target.getBoundingClientRect().bottom - (visibleBottom - margin);
              if (overflow > 0) scrollEl.scrollTop += overflow;
            }, 80);
          });
          document.addEventListener('focusout', function(e){
            if (tracksKeyboardItself()) return;
            if (!ov.contains(e.target) || !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
            const next = e.relatedTarget;
            if (next && ov.contains(next) && /^(INPUT|TEXTAREA)$/.test(next.tagName)) return;
            dropNow();
          });
          // Same debounced "did the keyboard actually close" check as pinAuthGateHeight, for the
          // system back-gesture/button case (no blur event fires there)
          if (vv) {
            let lastVvH = vv.height;
            let closeTimer = null;
            const KEYBOARD_CLOSE_DEBOUNCE_MS = 140;
            const NEAR_FULL_HEIGHT_SLOP = 60;
            vv.addEventListener('resize', function(){
              if (tracksKeyboardItself()) return;
              const grew = vv.height > lastVvH + 60;
              const coveredNow = window.innerHeight - vv.height;
              lastVvH = vv.height;
              if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
              if (!(grew && coveredNow < NEAR_FULL_HEIGHT_SLOP)) return;
              closeTimer = setTimeout(function(){
                closeTimer = null;
                const stillLooksClosed = (window.innerHeight - vv.height) < NEAR_FULL_HEIGHT_SLOP;
                if (!stillLooksClosed) return;
                if (isTyping()) { try { document.activeElement.blur(); } catch (err) {} }
                dropNow();
              }, KEYBOARD_CLOSE_DEBOUNCE_MS);
            });
          }
        })();


// ---- Long username marquee: every profile username uses one size; names that don't fit slide
// sideways (and back) by themselves so the rest can be read ----
(function setupNameMarquee(){
  if (window.__nmMarquee2) return; window.__nmMarquee2 = true;
  const st = document.createElement('style');
  st.textContent = `
    .nm-wrap{overflow:hidden;white-space:nowrap;text-align:center;display:block}
    .nm-wrap.nm-left{text-align:left}
    .nm-inner{display:inline-block;white-space:nowrap;will-change:transform}
    .nm-inner.nm-run{animation:nmSlide var(--nm-t,8s) ease-in-out infinite alternate}
    @keyframes nmSlide{0%,18%{transform:translateX(0)}82%,100%{transform:translateX(var(--nm-d,0px))}}
    /* If the phone asks for reduced motion, don't animate: let the name be swiped instead */
    @media (prefers-reduced-motion:reduce){
      .nm-inner.nm-run{animation:none}
      .nm-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;text-align:left}
      .nm-wrap::-webkit-scrollbar{display:none}
    }`;
  document.head.appendChild(st);
  let queued = false;
  // Only touches an element when its measurement changed, so unrelated page updates never
  // restart a slide that is already running
  function measure(){
    queued = false;
    document.querySelectorAll('.nm-wrap').forEach(w => {
      const i = w.querySelector('.nm-inner'); if (!i) return;
      const over = Math.ceil(i.getBoundingClientRect().width - w.clientWidth);
      if (over > 2) {
        const d = (-over - 2) + 'px';
        const t = Math.max(5, over / 18 + 3) + 's';
        if (i.style.getPropertyValue('--nm-d') !== d) i.style.setProperty('--nm-d', d);
        if (i.style.getPropertyValue('--nm-t') !== t) i.style.setProperty('--nm-t', t);
        if (!i.classList.contains('nm-run')) i.classList.add('nm-run');
      } else if (i.classList.contains('nm-run')) {
        i.classList.remove('nm-run');
        i.style.removeProperty('--nm-d');
      }
    });
  }
  function queue(){ if (!queued) { queued = true; requestAnimationFrame(() => setTimeout(measure, 80)); } }
  new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', queue);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  setInterval(queue, 1500);
  queue();
})();
