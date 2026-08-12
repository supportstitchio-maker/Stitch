        // ---------------- OVERLAYS: Discover / Notifications ----------------
        // Kinds that should respond to the phone/browser back button by
        // closing the overlay, rather than leaving the page (or, for the
        // handful with a custom entry in overlayBackAction below, doing
        // whatever their on-screen back arrow does instead of a flat
        // close). This used to only cover about half of the overlay kinds
        // openOverlay() actually handles -- anything opened via a kind
        // missing from this list never pushed history to begin with, so
        // the hardware/browser back button had nothing of ours to catch
        // and fell through to actually leaving the app. Every kind
        // openOverlay() knows about is listed here now, except 'call' and
        // 'lectureCall': both are always opened from on top of another
        // overlay that already pushed its own state (a conversation for
        // calls, Class Detail for lectures), so they deliberately ride on
        // that existing entry instead of pushing a second one.
        const overlayBackKinds = ['discover', 'create', 'aiClass', 'conversation', 'addToCall', 'incomingCall', 'incomingLectureCall', 'joinClassroom', 'createClassroom', 'classDetail', 'inviteStudents', 'newAnnouncement', 'scheduleLecture', 'classworkCreateMenu', 'newClasswork', 'newQuiz', 'newPoll', 'classworkDetail', 'classSettings', 'studyTimetable', 'studyReminders', 'classAnnouncements', 'classNotifications', 'gamification', 'profileMenu', 'profileQR', 'newMessage', 'myContacts', 'newCollaboration', 'profileAnalytics', 'careerAnalytics', 'notifications', 'notificationSettings', 'savedItems', 'blockedAccounts', 'termsOfService', 'privacyPolicy', 'helpCenter', 'contactUs', 'reportIssue', 'practiceTests', 'examTake', 'jobDetail', 'jobApply', 'postOpportunity', 'courseDetail', 'courseItemDetail', 'courseEnroll', 'courseTeachers', 'newCourse', 'personProfile', 'personNetwork'];
        // Kinds whose hardware/browser back button shouldn't just do a
        // flat closeOverlay() -- each of these has its own on-screen back
        // control that does something more specific (return to a live
        // call instead of hanging up on it, decline a ring instead of
        // leaving it silently stuck "ringing", leave a lecture cleanly).
        // Mirrors that same action so the hardware button matches
        // whatever tapping the visible back arrow does. Every entry is
        // called with (fromPopState = true) so it can skip its own
        // history.back() -- the browser already navigated back by the
        // time popstate fires, doing it again would skip an extra entry.
        const overlayBackAction = {
          call: (fromPopState) => minimizeCall(fromPopState),
          addToCall: () => returnToCallScreen(),
          incomingCall: (fromPopState) => declineIncomingCall(false, fromPopState),
          incomingLectureCall: (fromPopState) => declineIncomingLectureCall(fromPopState),
          lectureCall: () => endLecture(),
        };
        // ---- Back-button handling for standalone modals ----
        // (confirm/alert dialogs, Edit Profile, Photo Crop, Leave Class,
        // the challenge/invite-friend/join-code modal, exam-exit, the
        // flashcard modal) -- separate from the overlay system above
        // because these can float on top of *either* an open overlay or
        // the bare tab underneath, and unlike overlays they never pushed
        // their own history entry, so the phone/browser back button
        // skipped straight past whichever of these was open: with an
        // overlay behind it, back closed the overlay instead of just the
        // modal; with nothing behind it, back left the app outright while
        // the modal sat there still visibly open. Every open call below
        // now does pushModalBackHandler(closeFn); the popstate listener
        // checks this stack first (before the overlay-level handling
        // below) so a modal sitting on top of an overlay dismisses first,
        // one back-press at a time, same as its own Cancel/X button.
        const modalBackStack = [];
        function pushModalBackHandler(closeFn){
          modalBackStack.push(closeFn);
          history.pushState({ stitchModal: modalBackStack.length }, '');
        }
        // Called from inside a modal's own close function -- whether
        // that's reached via its Cancel/X/backdrop tap, a Confirm action,
        // or the hardware back button -- so the history entry it pushed
        // always gets consumed exactly once. fromPopState is true only
        // when popstate itself triggered the close: history has already
        // moved back by then, so skip doing it a second time.
        function popModalBackHandler(fromPopState){
          if (!modalBackStack.length) return;
          modalBackStack.pop();
          if (!fromPopState) history.back();
        }

        let overlayHistoryPushed = false;

        // Three-dot menu open state for the row-style headers.
        let gamificationMenuOpen = false;
        // Whether the gaming-avatar picker grid is open. Tapping the game
        // profile avatar opens this picker directly (no intermediate
        // "Upload photo / Choose gaming avatar" menu step).
        // Overrides the game-profile picture shown on the Gamification
        // screen only; independent of the main profileData.photo.
        // null            -> no override, falls back to profileData.photo
        // {type:'photo'}  -> a photo chosen specifically for the game profile
        // {type:'icon'}   -> a chosen gaming avatar icon preset
        // {type:'none'}   -> explicitly removed, always show the plain icon
        let gameProfileAvatar = null;
        // Whether the avatar-preset grid is showing inside the Game
        // Profile card (toggled by tapping the avatar or its pencil icon).
        let gamingAvatarPickerOpen = false;
        // A stable per-device Game ID shown on the Game Profile card.
        // Generated once and kept for the life of the session (matches
        // the "487-825-435-7" style ID shown in the reference design).
        function generateGameUniqueId(){
          const seg = n => Math.floor(Math.random() * Math.pow(10, n)).toString().padStart(n, '0');
          return `${seg(3)}-${seg(3)}-${seg(3)}-${seg(1)}`;
        }
        let gameUniqueId = generateGameUniqueId();
        // Default gaming avatar art the user can pick from; these are the
        // same illustrated character images used for the profile picture
        // picker (see defaultAvatarImages above).
        let aiClassMenuOpen = false;
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
        // Tapping the avatar (or its pencil) inside the Game Profile card
        // reveals the avatar-preset grid in place, the same way the pencil
        // works on the main Edit Profile form.
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
        // Renders whatever should currently show inside the round avatar
        // button on the Gamification screen (custom game photo, chosen
        // icon preset, main profile photo, or the plain fallback icon).
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

        // Condensed Game Profile for the desktop right panel while the
        // Games window is open -- avatar, username, unique ID, points,
        // and an earned/total badge count, mirroring how rightPanelProfileHTML
        // condenses the full Profile page. "View full profile" hands off
        // to the complete Game Profile screen for the badge grid itself.
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

        function toggleAIClassMenu(){
          aiClassMenuOpen = !aiClassMenuOpen;
          document.getElementById('overlay').innerHTML = aiClassHTML();
        }
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

        // Returns the height of whichever bottom nav bar is currently on
        // screen (classroom sub-nav takes priority over the main nav),
        // so overlays like the game window can leave room for it instead
        // of covering it up.
        function activeNavBarHeight(){
          const classroomNav = document.getElementById('classroom-nav');
          if (classroomNav && classroomNav.style.display !== 'none') return classroomNav.offsetHeight;
          const bottomNav = document.getElementById('bottom-nav');
          if (bottomNav && bottomNav.style.display !== 'none') return bottomNav.offsetHeight;
          return 0;
        }

        const OVERLAY_TOP = '0';
        const OVERLAY_TOP_50 = '0';

        function openOverlay(kind){
          currentOverlayKind = kind;
          updateUtilityNavActive();
          const ov = document.getElementById('overlay');
          clearQuizBackground();
          const studyFabWrap = document.getElementById('study-fab-wrap');
          if (studyFabWrap) studyFabWrap.style.display = 'none';
          // Overlays sit at the same flex level as the bottom nav bars
          // (not stacked strictly above them), so without this the nav
          // icons stay visible/bleeding through underneath overlays like
          // Join Class or Create Class. Gamification is the one exception:
          // it deliberately reserves a gap so the taskbar peeks through.
          if (kind !== 'gamification') {
            const bottomNavEl = document.getElementById('bottom-nav');
            const classroomNavEl = document.getElementById('classroom-nav');
            if (bottomNavEl) bottomNavEl.style.display = 'none';
            if (classroomNavEl) classroomNavEl.style.display = 'none';
          }
          // If this overlay is already open and we're just re-rendering it
          // (e.g. flipping a toggle in Settings), keep its scroll position
          // instead of jumping back to the top of the list.
          const prevOverlayScrollEl = ov.querySelector('.overflow-y-auto');
          const prevOverlayScrollTop = prevOverlayScrollEl ? prevOverlayScrollEl.scrollTop : 0;
          ov.classList.remove('hidden');

          // On desktop, an open conversation keeps the chat list visible
          // in a left column instead of covering it (see the
          // .messaging-split CSS rules) -- so switching between chats
          // there is an instant in-place swap, not a close-then-reopen.
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) {
            if (kind === 'conversation' && currentTab === 3) { appShellEl.classList.add('messaging-split'); closeRightPanel(); }
            else appShellEl.classList.remove('messaging-split');
          }

          // Every overlay window (including the messaging/conversation
          // window) uses the same 30px (+safe-area) top offset as the
          // rest of the app, and always stretches all the way down to the
          // bottom of the screen. These must be set explicitly every time
          // (not cleared to ''), otherwise the overlay's "bottom" offset
          // gets un-declared and the box shrinks to fit its content
          // instead of filling the screen, which is what made short
          // conversations stop partway down and show the inbox behind them.
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';

          if (kind === 'profileMenu' || kind === 'profileAnalytics' || kind === 'call' || kind === 'incomingCall' || kind === 'incomingLectureCall' || kind === 'profileQR' || kind === 'lectureCall') {
            ov.style.top = '0';
          }

          if (kind === 'discover') { discoverSearchQuery = ''; discoverPeopleLoaded = false; ov.innerHTML = discoverHTML(); loadDiscoverPeople(); }
          else if (kind === 'create') { selectedMediaHtml = null; selectedMediaType = null; selectedMediaFile = null; ov.innerHTML = createPostHTML(); }
          else if (kind === 'aiClass') ov.innerHTML = aiClassHTML();
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
          else if (kind === 'termsOfService') ov.innerHTML = termsOfServiceHTML();
          else if (kind === 'privacyPolicy') ov.innerHTML = privacyPolicyHTML();
          else if (kind === 'helpCenter') ov.innerHTML = helpCenterHTML();
          else if (kind === 'contactUs') { resetContactFormDraft(); ov.innerHTML = contactUsHTML(); }
          else if (kind === 'reportIssue') { resetReportIssueDraft(); ov.innerHTML = reportIssueHTML(); }
          else if (kind === 'practiceTests') ov.innerHTML = practiceTestsHTML();
          else if (kind === 'examTake') { ov.innerHTML = examTakeHTML(); setNotebookNavLabel('Annotate'); }
          else if (kind === 'jobDetail') ov.innerHTML = jobDetailHTML();
          else if (kind === 'jobApply') ov.innerHTML = jobApplyHTML();
          else if (kind === 'postOpportunity') {
            // The menu item that opens this is already hidden for non-admins;
            // this check just makes sure the overlay can't be reached some
            // other way (e.g. someone calling openOverlay() directly).
            // Draft setup (fresh vs. prefilled for editing) is handled by
            // openPostOpportunity/openEditOpportunity in jobs.js before this
            // runs, so it isn't reset again here.
            if (!isCurrentUserAdmin()) { closeOverlay(); return; }
            ov.innerHTML = postOpportunityHTML();
          }
          else if (kind === 'courseDetail') ov.innerHTML = courseDetailHTML();
          else if (kind === 'courseItemDetail') ov.innerHTML = courseItemDetailHTML();
          else if (kind === 'courseEnroll') ov.innerHTML = courseEnrollHTML();
          else if (kind === 'newCourse') {
            // Same defense-in-depth as postOpportunity: the "Create a
            // Course" button is already hidden for non-admins, this just
            // covers openOverlay('newCourse') being reached another way.
            if (!isCurrentUserAdmin()) { closeOverlay(); return; }
            ov.innerHTML = newCourseHTML();
          }
          else if (kind === 'courseTeachers') ov.innerHTML = courseTeachersHTML();
          else if (kind === 'personProfile') ov.innerHTML = personProfileHTML();
          else if (kind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          else renderNotifTab();

          if (prevOverlayScrollTop) {
            const restoredOverlayScrollEl = ov.querySelector('.overflow-y-auto');
            if (restoredOverlayScrollEl) restoredOverlayScrollEl.scrollTop = prevOverlayScrollTop;
          }

          // The game window shouldn't cover the taskbar below it; leave a
          // gap the height of whichever nav bar is currently showing, and
          // wire up its own scroll container so that taskbar still slides
          // away as the user scrolls, matching every other window.
          if (kind === 'gamification') {
            const navH = activeNavBarHeight();
            if (navH) ov.style.bottom = navH + 'px';
            bottomNavOffset = 0;
            bottomNavLastScroll = 0;
            attachTaskbarScrollHandler(ov.querySelector('.overflow-y-auto'), ov);
          }

          if (overlayBackKinds.includes(kind) && !overlayHistoryPushed) {
            history.pushState({ stitchOverlay: kind }, '');
            overlayHistoryPushed = true;
          }
        }
        function closeOverlay(fromPopState){
          // Capture this before it gets reset below -- see the
          // activeConvoId clear further down, which needs to know
          // whether a conversation was actually the thing being closed.
          const wasConversation = currentOverlayKind === 'conversation';
          currentOverlayKind = null;
          updateUtilityNavActive();
          clearCallTimers();
          stopCallLocalStream();
          teardownCallSignaling();
          clearLectureTimer();
          stopLectureLocalStream();
          clearStoryTimer();
          const ov = document.getElementById('overlay');
          if (ov) { ov.classList.add('hidden'); ov.innerHTML=''; ov.style.top = OVERLAY_TOP; ov.style.bottom = '0'; ov.style.paddingTop = ''; }
          const appShellEl = document.getElementById('app-shell');
          if (appShellEl) appShellEl.classList.remove('messaging-split');
          clearQuizBackground();
          stopQuizMusic();
          resetBottomNav();
          setNotebookNavLabel('Notebook');
          // openOverlay hides both nav bars while any overlay is up; put
          // back whichever one belongs on the current tab (Classroom uses
          // its own sub-nav instead of the main one).
          const isClassroomTab = currentTab === 2;
          const bottomNavEl = document.getElementById('bottom-nav');
          const classroomNavEl = document.getElementById('classroom-nav');
          if (bottomNavEl) bottomNavEl.style.display = isClassroomTab ? 'none' : '';
          if (classroomNavEl) classroomNavEl.style.display = isClassroomTab ? '' : 'none';
          if (overlayHistoryPushed) {
            overlayHistoryPushed = false;
            if (!fromPopState) history.back();
          }
          // The Classroom screen underneath the overlay was rendered before
          // any join/create action, so refresh it to reflect the latest
          // myClasses state (pills vs. class cards + FAB). Closing out of
          // Games/AI Class/Alerts (each of which sets its own panel mode)
          // also brings the Notebook panel back as the Classroom default.
          if (currentTab === 2) { renderStudy(); openRightPanel('notebook'); }
          // Closing a conversation drops out of the desktop split view
          // back to the plain inbox list, which gets its default Profile
          // panel back (see applyDefaultRightPanel).
          if (currentTab === 3) applyDefaultRightPanel(3);
          // activeConvoId (chat.js) was never cleared here -- it stayed
          // set to whatever conversation was last opened for the rest of
          // the session, even after backing out to Home/Messaging. Every
          // check downstream that gates "am I actively looking at this
          // chat right now" on activeConvoId (handleIncomingMessage's
          // auto-mark-read and its skip of addNotif chief among them)
          // kept firing for that conversation as if it were still open,
          // silently marking new messages read and never notifying about
          // them -- exactly like a message sitting there unread ought to.
          // Clearing it here, but only when a conversation was actually
          // what just closed, keeps every other overlay's close behavior
          // unaffected.
          if (wasConversation && typeof activeConvoId !== 'undefined') activeConvoId = null;
        }

        // Let the phone/browser back button close these overlay windows
        // instead of navigating away from the app -- and, for the kinds in
        // overlayBackAction above, do the same thing their on-screen back
        // arrow does (return to a live call, decline a ring, leave a
        // lecture) instead of a flat close.
        window.addEventListener('popstate', function(){
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



        function overlayHeader(title, extraTopPad, backAction){
          const padStyle = ` style="padding-top:${extraTopPad || '20px'};"`;
          return `
            <div class="flex-shrink-0 w-full"${padStyle}>
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center gap-4">
                <button onclick="${backAction || 'closeOverlay()'}">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <div class="font-semibold text-lg font-display grad-text">${title}</div>
              </div>
            </div>`;
        }

        // Plain header style matching the Classroom screen's "← Leave Classroom"
        // treatment: a gray back link above a bold title, no colored bar.
        function plainOverlayHeader(title){
          return `
            <div class="w-full px-5 pb-3" style="padding-top:20px;">
              <button onclick="closeOverlay()" class="flex items-center gap-1.5 font-semibold text-sm mb-3 grad-text">
                ${gradIcon(IconBold('back','w-5 h-5'))} Back
              </button>
              <h1 class="text-2xl font-bold font-display grad-text">${title}</h1>
            </div>`;
        }

        // Shared helper for menuOverlayHeader dropdowns: closes the menu if
        // the user scrolls the screen while it's open, same as tapping the
        // backdrop would. Armed after a short delay so the scroll-position
        // restore that happens right after render doesn't immediately
        // trigger a close.
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

        // Row-style header: back arrow on the left, title centered, and a
        // three-dot menu button on the right that opens a small dropdown.
        function menuOverlayHeader(title, menuOpen, toggleFnName, dropdownHtml){
          return `
            <div class="w-full px-5 pb-3 relative" style="padding-top:20px;">
              <div class="flex items-center justify-between">
                <button onclick="closeOverlay()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}</button>
                <h1 class="text-base font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">${title}</h1>
                <button onclick="${toggleFnName}()" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(Icon('dashes','w-5 h-5'))}</button>
              </div>
              ${menuOpen ? `<div onclick="${toggleFnName}()" onwheel="${toggleFnName}()" ontouchmove="${toggleFnName}()" class="fixed inset-0 z-10"></div>${dropdownHtml || placeholderDropdownMenu()}` : ''}
            </div>`;
        }

        // Same row layout as menuOverlayHeader (back arrow left, centered
        // title) but with no three-dot menu button on the right at all,
        // per request to remove the top-right menu tab on the Classroom
        // detail screen. The empty spacer div keeps the title perfectly
        // centered, matching the back button's width.
        function classDetailHeaderHTML(title){
          return `
            <div class="w-full px-5 pb-3 relative" style="padding-top:20px;">
              <div class="flex items-center justify-between">
                <button onclick="openLeaveClassModal(closeOverlay, 'Exit this class?', 'You can come back to this class anytime from Classroom.')" class="desktop-leave-classroom-btn w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(IconBold('back','w-5 h-5'))}<span class="desktop-leave-classroom-label grad-text">Leave Classroom</span></button>
                <h1 class="text-base font-bold font-display grad-text absolute left-1/2 -translate-x-1/2 truncate" style="max-width:60%;">${title}</h1>
                <button onclick="openOverlay('classNotifications')" class="w-8 h-8 flex items-center justify-center flex-shrink-0">${gradIcon(Icon('bell','w-5 h-5'))}</button>
              </div>
            </div>`;
        }

        // Placeholder menu content: actions to be filled in later.
        function placeholderDropdownMenu(){
          return `
            <div class="absolute w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;">
              <div class="px-4 py-2.5 text-sm text-gray-400 menu-item-pill">More options coming soon</div>
            </div>`;
        }

        // Real dropdown for the "..." menu on Join a Class: paste a code
        // straight from the clipboard, or get quick help finding one.
        function joinClassDropdownMenu(){
          return `
            <div class="absolute w-56 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;">
              <button onclick="pasteJoinClassCode()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('clip','w-4 h-4')} Paste code from clipboard</button>
              <button onclick="showJoinClassHelp()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('help','w-4 h-4')} How do I get a class code?</button>
            </div>`;
        }

        // Real dropdown for the "..." menu on Create a Class: clear the
        // form, or get quick help on what each field means.
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

        // ---------------- OVERLAY: Create Post (Instagram-style, via + in top bar) ----------------
        let selectedMediaHtml = null;
        let selectedMediaType = null;
        // The raw File object behind selectedMediaHtml's preview. The
        // preview itself is a local blob:/data: URL (see handleMediaSelect)
        // which only exists in this browser -- submitPost hands this File
        // to PostsAPI.create so it can be uploaded to shared Storage and
        // swapped for a public URL other accounts can actually load.
        let selectedMediaFile = null;

        function createPostHTML(){
          return `
            ${overlayHeader('New post', '20px')}
            <div class="p-5 flex-1 overflow-y-auto no-scrollbar">
              <button type="button" onclick="pickMedia('image/*,video/*')" id="media-preview" class="w-full h-48 bg-gray-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 mb-4">
                ${Icon('upload','w-8 h-8')}
                <div class="text-sm">(tap to upload a post)</div>
              </button>
              <input type="file" id="media-input" accept="image/*,video/*" class="hidden" onchange="handleMediaSelect(event)">
              <textarea id="new-post-text" class="w-full h-24 p-4 border border-gray-200 rounded-2xl text-base" placeholder="Write a caption..."></textarea>
            </div>
            <div class="p-4 border-t flex-shrink-0">
              <button onclick="submitPost()" class="w-full py-3 rounded-2xl font-semibold border" style="color:${NAVY};border-color:rgba(10,37,64,0.25);background-image:linear-gradient(135deg, rgba(10,37,64,0.18) 0%, rgba(65,105,225,0.18) 100%);background-color:#ffffff;">Post</button>
            </div>`;
        }

        function pickMedia(accept){
          const input = document.getElementById('media-input');
          input.setAttribute('accept', accept);
          input.click();
        }

        function handleMediaSelect(event){
          const file = event.target.files[0];
          if (!file) return;
          selectedMediaFile = file;
          const isVideo = file.type.startsWith('video/');
          const reader = new FileReader();
          reader.onload = function(e){
            const url = e.target.result;
            selectedMediaType = isVideo ? 'video' : 'image';
            selectedMediaHtml = isVideo
              ? `<video src="${url}" controls class="w-full h-auto bg-black"></video>`
              : `<img src="${url}" class="w-full h-auto">`;
            const preview = document.getElementById('media-preview');
            if (preview) {
              preview.className = 'w-full rounded-2xl overflow-hidden mb-4';
              preview.innerHTML = isVideo
                ? `<video src="${url}" controls class="w-full h-auto max-h-64 bg-black" style="object-fit:contain;"></video>`
                : `<img src="${url}" class="w-full h-auto max-h-64" style="object-fit:contain;">`;
            }
          };
          reader.readAsDataURL(file);
        }

        function submitPost(){
          if (!requireCompleteProfile()) return;
          if (!selectedMediaHtml) { openAppAlertModal('Add a photo or video: the feed only shows posts with pictures or videos'); return; }
          const input = document.getElementById('new-post-text');
          const text = input.value.trim();
          PostsAPI.create({
            meta: 'Kumasi · now',
            tag: selectedMediaType === 'video' ? 'Video' : 'Photo', tagClass: 'bg-green-100 text-green-700',
            body: text, mediaHtml: selectedMediaHtml,
            // Passed through so PostsAPI.create can upload the real file to
            // shared Storage -- see the note there for why the local
            // preview URL above isn't enough on its own.
            mediaFile: selectedMediaFile, mediaType: selectedMediaType,
          }).then(() => {
            profileData.posts += 1;
            selectedMediaHtml = null;
            selectedMediaType = null;
            selectedMediaFile = null;
            closeOverlay();
            renderFeed();
          });
        }

        // Discover shows real signed-up people, loaded from public_profiles
        // (see syncPublicProfile in profile.js) -- starts empty until
        // loadDiscoverPeople() finishes, rather than any made-up seed data.
        let discoverPeople = [];
        let discoverPeopleLoaded = false;
        let discoverSearchQuery = '';

        // Pulls every other account's public profile plus which of them
        // this account has already sent a connection request to, so the
        // list renders with the right button state (Connect / Request
        // Sent) on first paint instead of flashing "Connect" for everyone
        // and then correcting itself.
        //
        // discoverLoadError is set when the fetch itself fails (bad
        // connection, RLS misconfigured, etc) so the empty state can say
        // "couldn't load, try again" instead of the misleading "no one's
        // signed up yet" -- and a hard timeout guarantees the spinner
        // never sits there forever even if the request itself hangs.
        let discoverLoadError = false;

        async function loadDiscoverPeople(){
          discoverLoadError = false;
          const sb = getSupabaseClient();
          if (!sb) { discoverPeopleLoaded = true; return; }
          const withTimeout = (promise) => Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
          ]);
          try {
            // getUser() and the public_profiles fetch don't depend on each
            // other -- run them in parallel instead of one after another
            // so Discover shows up roughly twice as fast.
            const [{ data: userRes }, { data, error }] = await withTimeout(Promise.all([
              sb.auth.getUser(),
              sb.from(PUBLIC_PROFILES_TABLE).select('*'),
            ]));
            const me = userRes && userRes.user;
            if (error || !data) { discoverLoadError = true; discoverPeopleLoaded = true; renderDiscoverList(); return; }
            let sentTo = new Set();
            let connectedIds = new Set();
            if (me) {
              // Both directions: requests I sent (to know which are still
              // pending -> "Request Sent") and requests sent to me (to
              // catch connections I formed by accepting someone else's
              // request, not just ones I initiated). Anyone with an
              // 'accepted' row either way is a real connection now and
              // shouldn't be offered again in Discover -- see
              // removeFromDiscover, which does the same thing instantly
              // right when an accept happens, without waiting for the
              // next time Discover is opened.
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
              .filter(row => !connectedIds.has(row.user_id))
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
              }));
            discoverPeopleLoaded = true;
            renderDiscoverList();
          } catch (e) { discoverLoadError = true; discoverPeopleLoaded = true; renderDiscoverList(); }
        }

        // Called right when a connection is formed (either accepting an
        // incoming request in acceptRequest, or noticing one of my own
        // outgoing requests got accepted in loadMyAcceptedOutgoingRequests
        // -- both in chat.js) so the person disappears from Discover
        // immediately, instead of only after the next time Discover
        // happens to be reloaded from Supabase (which also excludes them,
        // via loadDiscoverPeople's connectedIds filter above -- this is
        // just the instant, no-reload-needed version of the same thing).
        function removeFromDiscover(userId){
          if (!userId) return;
          const idx = discoverPeople.findIndex(p => p.id === userId);
          if (idx === -1) return;
          discoverPeople.splice(idx, 1);
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

        // Shown in place of the real people list while loadDiscoverPeople()
        // is still in flight. Deliberately NOT the shimmering skeleton
        // treatment (that's reserved for the homepage boot screen only,
        // see appBootSkeletonHTML in core.js) -- just a quiet, lightweight
        // loading line so Discover doesn't sit there looking like a long
        // skeleton load of its own.
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
          const filtered = q ? discoverPeople.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sub.toLowerCase().includes(q) ||
            (p.username || '').toLowerCase().includes(q.replace(/^@/, ''))
          ) : discoverPeople;
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
            actionHTML = `<span class="text-xs font-semibold px-4 py-2 rounded-full bg-gray-100 text-gray-400">Request Sent</span>`;
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

        // Sends a connection request rather than connecting right away --
        // it's real (a row in connection_requests, see the schema comment
        // in profile.js), but it's pending until the other person accepts,
        // which isn't wired up in the UI yet. The button just reflects
        // that: "Request Sent", not "Connected", and nothing gets added to
        // My Contacts / My Network until an accept flow exists to earn it.
        // Shared helper: inserts a real connection_requests row from me to
        // toUserId. Used by both Discover's "Connect" button
        // (connectToDiscoverPerson below, which also has discoverPeople
        // state of its own to flip) and the feed's "Connect" button that
        // appears on a post from someone outside your network
        // (connectWithPoster in feed.js) -- that one has no discoverPeople
        // entry to update, just a post to mark as pending.
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

        async function connectToDiscoverPerson(id){
          const p = discoverPeople.find(x => x.id === id);
          if (!p || p.connected || p.requestSent) return;
          p.requestSent = true; // optimistic -- flip back if the insert fails
          const list = document.getElementById('discover-people-list');
          if (list) list.innerHTML = discoverPeopleHTML();
          const ok = await sendConnectionRequestTo(id);
          if (!ok) { p.requestSent = false; if (list) list.innerHTML = discoverPeopleHTML(); }
        }

        // ---------------- View someone's profile (tap any avatar) ----------------
        // A lightweight, read-only profile card reachable by tapping
        // *anyone's* avatar anywhere in the app -- inbox rows, a connect
        // request card, the open-chat header, a message bubble, a post's
        // avatar, or a Discover card. Shows their photo/name/bio plus
        // whatever the relationship with them actually is right now, so
        // tapping a stranger's picture is how you decide whether to
        // connect, and tapping someone you already know gets you straight
        // to messaging them. This is deliberately separate from
        // convoProfileHTML ("Contact info" inside an already-open chat),
        // which assumes you're already connected -- this one is for
        // deciding whether to be.
        let viewedProfile = null; // { id, name, username, photo, icon, avatarBg, bio, connected, requestSent, loaded, network, networkLoaded }

        // Opens instantly with whatever's already known locally (the name/
        // photo straight off the avatar that was tapped, passed in as
        // `fallback`) so there's no blank/loading flash, then quietly
        // fills in their bio and the real connect/request-sent state from
        // Supabase once that resolves. fallback: {name, photo, icon, avatarBg, username}.
        async function openPersonProfile(userId, fallback){
          if (!userId) return;
          const myId = await getCurrentUserId();
          if (myId && userId === myId) {
            // Tapped your own avatar somewhere -- go to your actual
            // profile, not a read-only card of yourself with a Connect
            // button that would never make sense.
            closeOverlay();
            switchTab(4);
            return;
          }
          viewedProfile = Object.assign({
            id: userId, name: 'Stitch member', username: '', bio: '',
            icon: 'user', avatarBg: 'bg-blue-50', photo: null,
            connected: isUserInMyNetwork(userId), requestSent: false, loaded: false,
            network: [], networkLoaded: false, networkCount: 0,
          }, fallback || {});
          openOverlay('personProfile');
          loadPersonProfileDetails(userId);
          loadPersonNetwork(userId);
        }

        // Convenience wrapper for anywhere that already has a convoId
        // handy (inbox rows, chat header, message bubbles, request cards)
        // -- reads straight from convoMeta instead of needing every call
        // site to pass name/photo/icon by hand. No-ops for group chats
        // (no single person to show) or convos with no linked backend user.
        function openPersonProfileForConvo(convoId){
          const meta = convoMeta[convoId];
          if (!meta || !meta.otherUserId || meta.icon === 'users') return;
          openPersonProfile(meta.otherUserId, { name: meta.name, photo: meta.photo, icon: meta.icon, avatarBg: meta.avatarBg });
        }

        // Same idea for a Discover card's avatar specifically (has richer
        // fallback data -- username, bio -- already loaded).
        function openPersonProfileFromDiscover(id){
          const p = discoverPeople.find(x => x.id === id);
          if (!p) { openPersonProfile(id); return; }
          openPersonProfile(id, { name: p.name, username: p.username, photo: p.photo, icon: p.icon, avatarBg: p.avatarBg });
        }

        async function loadPersonProfileDetails(userId){
          const sb = getSupabaseClient();
          if (!sb) { if (viewedProfile && viewedProfile.id === userId) { viewedProfile.loaded = true; renderPersonProfile(); } return; }
          try {
            const { data: userRes } = await sb.auth.getUser();
            const me = userRes && userRes.user;
            const [{ data: row }, { data: fromRows }, { data: toRows }] = await Promise.all([
              sb.from(PUBLIC_PROFILES_TABLE).select('*').eq('user_id', userId).maybeSingle(),
              me ? sb.from(CONNECTION_REQUESTS_TABLE).select('to_user,status').eq('from_user', me.id).eq('to_user', userId) : Promise.resolve({ data: [] }),
              me ? sb.from(CONNECTION_REQUESTS_TABLE).select('from_user,status').eq('to_user', me.id).eq('from_user', userId) : Promise.resolve({ data: [] }),
            ]);
            if (!viewedProfile || viewedProfile.id !== userId) return; // navigated away while this was loading
            if (row) {
              viewedProfile.name = row.name || row.username || viewedProfile.name;
              viewedProfile.username = row.username || viewedProfile.username || '';
              viewedProfile.bio = row.bio || '';
              viewedProfile.photo = row.photo || viewedProfile.photo || null;
            }
            const acceptedEitherWay = [...(fromRows || []), ...(toRows || [])].some(r => r.status === 'accepted');
            viewedProfile.connected = acceptedEitherWay || isUserInMyNetwork(userId);
            viewedProfile.requestSent = (fromRows || []).some(r => r.status === 'pending');
            viewedProfile.loaded = true;
            renderPersonProfile();
          } catch (e) {
            if (viewedProfile && viewedProfile.id === userId) { viewedProfile.loaded = true; renderPersonProfile(); }
          }
        }

        function renderPersonProfile(){
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'personProfile') ov.innerHTML = personProfileHTML();
        }

        // Pulls the list of people THIS profile (userId) is actually
        // connected to -- an accepted row in connection_requests with
        // userId on either side -- so tapping "Network" on someone else's
        // profile shows their real connections instead of just yours.
        // Mirrors loadIncomingConnectionRequests/loadMyAcceptedOutgoingRequests
        // in chat.js, just keyed off an arbitrary userId instead of "me".
        async function loadPersonNetwork(userId){
          const sb = getSupabaseClient();
          if (!sb) { if (viewedProfile && viewedProfile.id === userId) { viewedProfile.networkLoaded = true; renderPersonProfile(); } return; }
          try {
            // The real count comes from get_network_count (see the SQL at
            // the top of profile.js) -- a security-definer function that
            // sees every accepted row for target_user regardless of who's
            // asking, unlike the plain select below which RLS quietly
            // limits to just rows the CALLER is a party to. Without this,
            // viewing someone else's profile showed a "Network" number
            // that only counted your own overlap with them, not their real
            // total -- correct-looking on their own profile (where they
            // themselves are the caller and pass RLS on every row) but
            // wrong everywhere else, which is what looked like a random
            // mismatch between devices/accounts.
            const countPromise = sb.rpc('get_network_count', { target_user: userId });
            const [{ data: fromRows }, { data: toRows }, { data: countData, error: countError }] = await Promise.all([
              sb.from(CONNECTION_REQUESTS_TABLE).select('to_user').eq('from_user', userId).eq('status', 'accepted'),
              sb.from(CONNECTION_REQUESTS_TABLE).select('from_user').eq('to_user', userId).eq('status', 'accepted'),
              countPromise,
            ]);
            if (!viewedProfile || viewedProfile.id !== userId) return; // navigated away while this was loading
            const otherIds = [
              ...(fromRows || []).map(r => r.to_user),
              ...(toRows || []).map(r => r.from_user),
            ].filter((id, i, arr) => id && id !== userId && arr.indexOf(id) === i);

            // Fall back to the (possibly RLS-limited) row count only if the
            // RPC isn't deployed yet/failed -- better a slightly-wrong
            // number than none at all.
            viewedProfile.networkCount = (!countError && typeof countData === 'number') ? countData : otherIds.length;

            if (!otherIds.length) {
              viewedProfile.network = [];
              viewedProfile.networkLoaded = true;
              renderPersonProfile();
              return;
            }

            const { data: profiles } = await sb.from(PUBLIC_PROFILES_TABLE).select('*').in('user_id', otherIds);
            const profileById = {};
            (profiles || []).forEach(p => { profileById[p.user_id] = p; });

            if (!viewedProfile || viewedProfile.id !== userId) return;
            viewedProfile.network = otherIds.map(id => {
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
            viewedProfile.networkLoaded = true;
            renderPersonProfile();
          } catch (e) {
            if (viewedProfile && viewedProfile.id === userId) { viewedProfile.networkLoaded = true; renderPersonProfile(); }
          }
        }

        // Opens a read-only list of whoever viewedProfile is connected to.
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
            actionHTML = `<span class="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-gray-100 text-gray-400">Request Sent</span>`;
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

        // Connect button tapped from inside someone else's Network list
        // (as opposed to connectWithViewedProfile, which connects with the
        // profile itself). Updates just that row's state.
        async function connectWithNetworkMember(id){
          if (!viewedProfile) return;
          const m = (viewedProfile.network || []).find(x => x.id === id);
          if (!m || m.connected || m.requestSent) return;
          m.requestSent = true; // optimistic -- flip back if the insert fails
          const ov = document.getElementById('overlay');
          if (ov && currentOverlayKind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          const ok = await sendConnectionRequestTo(id);
          if (!ok) {
            m.requestSent = false;
            if (ov && currentOverlayKind === 'personNetwork') ov.innerHTML = personNetworkHTML();
          }
        }

        async function connectWithViewedProfile(){
          if (!viewedProfile || viewedProfile.connected || viewedProfile.requestSent) return;
          const id = viewedProfile.id;
          viewedProfile.requestSent = true; // optimistic -- flip back if the insert fails
          renderPersonProfile();
          const ok = await sendConnectionRequestTo(id);
          if (!viewedProfile || viewedProfile.id !== id) return; // moved on already
          if (!ok) { viewedProfile.requestSent = false; renderPersonProfile(); return; }
          // Keep Discover's own copy of this person in sync too, so it
          // doesn't still show "Connect" there after this.
          const dp = discoverPeople.find(p => p.id === id);
          if (dp) dp.requestSent = true;
        }

        // The "Message" pill on a profile you're not yet connected to.
        // There's no real conversation to open yet (that only exists once
        // they accept), so this asks for a short note and sends it as a
        // connect request with that note attached -- the recipient sees
        // it right on their request card (see requestRow in chat.js,
        // which already shows an attached message when one is present),
        // and it becomes the opening line of the real chat once they
        // accept (see acceptRequest's preview fallback).
        async function messageAndConnectViewedProfile(){
          if (!viewedProfile || viewedProfile.connected || viewedProfile.requestSent) return;
          const note = prompt(`Send ${viewedProfile.name || 'them'} a message along with your connect request:`);
          if (note === null) return; // cancelled
          const id = viewedProfile.id;
          viewedProfile.requestSent = true; // optimistic -- flip back if the insert fails
          renderPersonProfile();
          const ok = await sendConnectionRequestTo(id, note);
          if (!viewedProfile || viewedProfile.id !== id) return; // moved on already
          if (!ok) { viewedProfile.requestSent = false; renderPersonProfile(); return; }
          const dp = discoverPeople.find(p => p.id === id);
          if (dp) dp.requestSent = true;
        }

        // Already connected -- jump straight to the real conversation
        // with them instead of a dead end. Falls back to just closing
        // (no conversation locally yet -- it'll appear next time
        // loadMyAcceptedOutgoingRequests/loadIncomingConnectionRequests
        // runs) rather than creating a duplicate local-only thread.
        function messageViewedProfile(){
          if (!viewedProfile) return;
          const id = viewedProfile.id;
          const existing = convoArrays().flat().find(c => c.otherUserId === id);
          closeOverlay();
          if (existing) startNewMessageWith(existing.id);
        }

        // Drops whichever local conversation entry links to this person
        // (Primary or Requests -- wherever it happens to be) so Messaging
        // and the "My Network" count reflect a removal right away.
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
          // Persist the removal to the saved user_state right away --
          // without this, the in-memory splice above only lasted until the
          // next reload/sync, which would restore convoArrays from the
          // last *saved* blob (still containing the old connection) and
          // make a removed connection silently reappear even though the
          // underlying connection_requests row was already flipped to
          // 'removed' in Supabase. It should stay gone until you actually
          // reconnect with them.
          if (changed) queueSaveUserState();
          // Instant feedback for the "My Network" count -- see
          // refreshNetworkCount in chat.js, which re-fetches the real
          // number afterward (removeConnectionWithViewedProfile calls it
          // once the 'removed' status has actually landed in Supabase).
          if (typeof cachedNetworkCount !== 'undefined' && cachedNetworkCount !== null && cachedNetworkCount > 0) cachedNetworkCount -= 1;
          renderInboxTab();
          if (currentTab === 4) renderProfile(); // "My Network" count just changed
        }

        // The "Remove" pill on a profile you're connected to -- revokes
        // the connection. Flips the underlying connection_requests row(s)
        // to 'removed' (rather than deleting them outright) so a fresh
        // load doesn't resurrect the connection, then drops the local
        // conversation entry so it disappears from Messaging immediately.
        function removeConnectionWithViewedProfile(){
          if (!viewedProfile || !viewedProfile.connected) return;
          const id = viewedProfile.id;
          openAppConfirmModal(`Remove ${viewedProfile.name || 'this person'} from your network?`, '', 'Remove', async function(){
            viewedProfile.connected = false; // optimistic
            renderPersonProfile();
            removeLocalConnection(id);
            const sb = getSupabaseClient();
            if (!sb) return;
            try {
              const { data: userRes } = await sb.auth.getUser();
              const me = userRes && userRes.user;
              if (!me) return;
              // The accepted row could exist in either direction depending
              // on who originally sent the request -- flip whichever one's there.
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
            actionHTML = `<button disabled class="w-full py-2.5 rounded-2xl font-semibold text-sm bg-gray-100 text-gray-400">Request Sent</button>`;
          } else {
            actionHTML = `
              <div class="flex gap-3">
                <button onclick="connectWithViewedProfile()" class="flex-1 py-2.5 rounded-2xl font-semibold text-sm text-white" style="background:linear-gradient(135deg, rgba(65,105,225,0.9), ${NAVY});">Connect</button>
                <button onclick="messageAndConnectViewedProfile()" class="flex-1 py-2.5 rounded-2xl font-semibold text-sm bg-gray-100" style="color:${NAVY};">Message</button>
              </div>`;
          }
          // Their posts: every post in the shared feed authored by this
          // user (feedPosts is already backed by the shared `posts` table
          // via loadRemotePosts, so this covers posts made from any
          // account, not just ones that happened to sync to this browser).
          // Not limited to posts with media -- profileGridItem() already
          // falls back to a text-snippet tile for text-only posts, same
          // as the "grid of 3" on your own Profile tab.
          const theirPosts = p.id ? feedPosts.filter(post => post.authorId === p.id) : [];
          const networkCount = p.networkLoaded ? (typeof p.networkCount === 'number' ? p.networkCount : (p.network || []).length) : '\u00b7\u00b7\u00b7';
          return `
            ${overlayHeader('Profile', '20px')}
            <div class="flex-1 overflow-y-auto p-5">
              <div class="flex flex-col items-center text-center mb-4">
                <div class="w-24 h-24 ${p.avatarBg || 'bg-blue-50'} rounded-full flex items-center justify-center text-gray-600 mb-3 overflow-hidden">${avatarInner}</div>
                <div class="font-bold text-xl font-display text-[${NAVY}]">${escapeHtml(p.name || 'Stitch member')}</div>
                ${p.username ? `<div class="text-sm text-gray-400 mt-0.5">@${escapeHtml(p.username)}</div>` : ''}
              </div>
              <div class="flex items-center justify-center gap-8 mb-5">
                <div class="text-center"><div class="text-base font-bold">${theirPosts.length}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Posts</div></div>
                <button onclick="openPersonNetwork()" class="text-center"><div class="text-base font-bold">${networkCount}</div><div class="text-[11px] text-gray-500 whitespace-nowrap">Network</div></button>
              </div>
              ${!p.loaded ? `<div class="text-center text-gray-400 text-xs mb-6">Loading profile...</div>` : (p.bio ? `<div class="text-sm text-gray-600 text-center mb-6">${escapeHtml(p.bio)}</div>` : '')}
              <div class="max-w-sm mx-auto mb-6">${actionHTML}</div>
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2">Posts</div>
              ${theirPosts.length
                ? `<div class="profile-thumb-grid">${theirPosts.map(profileGridItem).join('')}</div>`
                : `<div class="text-center text-gray-400 text-sm py-8">No posts yet.</div>`}
            </div>`;
        }

        // ---------------- Generic long-press-to-select handling ----------------
        // Used by Notice Board, Notifications, and Inbox: press and hold a
        // row to select it, then tap the "..." menu to Pin / Mark as read /
        // Block / Delete whatever is currently selected.
        let pressTimer = null;
        let longPressFired = false;
        let pressStartX = 0;
        let pressStartY = 0;

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
        // A finger resting for a long-press naturally drifts a few pixels;
        // only cancel the hold if the touch actually moves away (scrolling),
        // not on that small jitter, otherwise "select" almost never triggers.
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

        // Shared dropdown content for the top-right "..." menu on Notice
        // Board and Notifications: acts on whatever rows are selected.
        // Delete is left out of this menu for Notifications specifically
        // (pass showDelete: false) -- each notification row now has its
        // own dustbin icon for that (see notifCards), so a bulk "Delete"
        // here would just be redundant. Notice Board still gets it since
        // nothing else calls this dropdown for that list.
        function notifActionsDropdownHTML(handlerName, opts){
          opts = opts || {};
          const showDelete = opts.showDelete !== false;
          return `
            <div class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1.25rem;top:3.5rem;width:13rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="${handlerName}('pin')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('pin','w-4 h-4')} Pin</button>
              <button onclick="${handlerName}('read')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('check','w-4 h-4')} Mark as read</button>
              <button onclick="${handlerName}('block')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('lock','w-4 h-4')} Block</button>
              ${showDelete ? `
              <div class="border-t border-gray-100 my-1"></div>
              <button onclick="${handlerName}('delete')" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete</button>` : ''}
            </div>`;
        }

        // ---------------- OVERLAY: Notifications ----------------
        const notifData = [];

        // Pushes a real, live entry into notifData -- the in-app
        // Notifications bell tab -- for things that happen while this
        // account is signed in. Called from chat.js for incoming
        // connection requests (loadIncomingConnectionRequests), new
        // messages (handleIncomingMessage), and incoming calls
        // (handleIncomingCallRing/acceptIncomingCall/declineIncomingCall).
        // This is separate from real Web Push (sendPushTo in core.js,
        // which reaches a closed tab/app) -- addNotif only affects what's
        // shown here, in-app, while signed in.
        //
        // Pass an explicit `id` when the notification should map 1:1 to
        // an existing record (e.g. a connection_requests row id) so a
        // later re-poll of that same record doesn't create a duplicate
        // entry -- callers that don't care can omit it and get a
        // generated one.
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
            // Real timestamp the row was created, in ms -- what
            // formatNotifTime actually computes "now" / "5m" / "2h" from.
            // The old 'now' string got baked in once and never moved, so
            // a notification from an hour ago still read "now" forever.
            createdAt: opts.createdAt || Date.now(),
            time: 'now',
            read: false,
            pinned: false,
            otherUserId: opts.otherUserId || null,
            convoId: opts.convoId || null,
            // Extra routing info so tapping a notification can jump
            // straight to the relevant post/class/opportunity -- see
            // notifTap below. Any that don't apply to this notification's
            // type are just left null.
            postId: opts.postId != null ? opts.postId : null,
            classId: opts.classId || null,
            jobId: opts.jobId || null,
            // Specific classwork item (assignment/quiz/material/poll) a
            // "New classwork" notification is about, so tapping it can
            // open that item directly instead of just the class's
            // Classwork tab. Left null for announcement/lecture
            // classroom notifications, which route to the Stream tab
            // instead (see notifTap).
            workId: opts.workId || null,
          });
          queueSaveUserState();
          refreshNotifBadge();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
          // Mirror this notification to email if the person has "Email
          // notifications" on in Settings. Every notification that reaches
          // this function is already for the signed-in user themselves
          // (never on behalf of someone else), so no recipient needs
          // picking here -- the Edge Function resolves the address from
          // their own access token. Skipped entirely, not just silently
          // failing, when the pref is off, so no needless network call.
          if (typeof appPrefs !== 'undefined' && appPrefs.notifEmail && typeof sendEmailNotification === 'function') {
            sendEmailNotification({
              subject: opts.name ? `${opts.name}: ${opts.message || 'New notification'}` : (opts.message || 'New notification on Stitch'),
              title: opts.name || 'Stitch',
              body: opts.message || '',
            });
          }
          return id;
        }

        // Marks any bell-tab notification(s) pointing at this conversation
        // as read. Previously the only way a message notification cleared
        // was tapping that exact row in Notifications (or "Mark all as
        // read") -- reading the same conversation from Messaging, a push
        // notification, or anywhere else left it stuck unread. Called from
        // openConversation so reading the chat, however you got there, is
        // what clears it.
        function markNotifsReadForConvo(convoId){
          if (!convoId) return;
          let changed = false;
          notifData.forEach(n => {
            if (n.type === 'message' && n.convoId === convoId && !n.read) { n.read = true; changed = true; }
          });
          if (!changed) return;
          queueSaveUserState();
          refreshNotifBadge();
          if (typeof currentOverlayKind !== 'undefined' && currentOverlayKind === 'notifications') renderNotifTab();
        }

        // Turns a createdAt timestamp into the short relative label shown
        // under each notification ("now", "5m", "3h", "2d", ...), and is
        // re-run on a timer (see startNotifTimeTicker) so the label keeps
        // advancing while the list is on screen instead of freezing at
        // whatever it said the moment the row was drawn.
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

        // One shared ticker for every place notifCards gets rendered
        // (Notifications bell tab, Notice Board, the pinned right-panel
        // list) -- walks whatever [data-notif-time] rows are currently in
        // the DOM and refreshes their text in place, so times stay live
        // without a full re-render (which would cost scroll position and
        // any in-progress selection).
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

        // Updates an existing notifData entry in place (used to turn an
        // "Incoming call" entry into "Missed call" / "Call declined" /
        // "Call answered" once the ring is resolved -- see
        // acceptIncomingCall/declineIncomingCall in chat.js).
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

        // Keeps the bell badge (phone top bar + desktop rail) in sync
        // with unreadNotifCount() without a full renderApp() re-render,
        // which would otherwise blow away whatever screen/overlay is
        // currently open.
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

          // Desktop sidebar bell (dnav-notif) was previously never
          // updated here, so its count silently drifted out of sync /
          // never appeared at all -- mirror the same insert/update/
          // remove logic refreshMessagingBadges uses for dnav-3.
          const dnavBtn = document.getElementById('dnav-notif');
          if (dnavBtn) {
            const dnavExisting = document.getElementById('dnav-notif-badge');
            if (count) {
              if (dnavExisting) dnavExisting.textContent = count;
              else dnavBtn.insertAdjacentHTML('beforeend', `<span id="dnav-notif-badge" class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">${count}</span>`);
            } else if (dnavExisting) {
              dnavExisting.remove();
            }
          }

          // Classroom "Alerts" / Notice Board bells (cnav-notif on phone,
          // dcnav-notif on desktop) get their own count, scoped to just
          // classroom notifications -- these previously never showed any
          // figure at all, unlike the general Notifications bell above.
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
              else dcnavBtn.insertAdjacentHTML('beforeend', `<span id="dcnav-notif-badge" class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">${classroomCount}</span>`);
            } else if (existing) {
              existing.remove();
            }
          }
        }

        let notifSelected = new Set();
        let notifMenuOpen = false;

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
          // Tapping a message notification takes you straight to that
          // conversation, same as tapping the row in Messaging would.
          // Connection requests are acted on via their own Accept/Decline
          // buttons (see notifCards), not by tapping the row itself.
          if (n.type === 'message' && n.convoId) {
            n.read = true;
            queueSaveUserState();
            closeOverlay();
            openConversation(n.convoId);
            return;
          }
          // Post/comment, classroom, and opportunity notifications jump
          // straight to the thing they're about, same idea as tapping a
          // message notification opens that conversation.
          if ((n.type === 'post' || n.type === 'comment') && n.postId != null && typeof openComments === 'function') {
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
            // "New classwork" notifications jump straight into that
            // assignment/quiz/material/poll; announcement and live-lecture
            // notifications don't have a single item to deep-link to, so
            // they land on the Stream tab (where both actually show up).
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
          // "X accepted your connection request" -- jump straight to their
          // profile, same as tapping their row anywhere else in the app.
          if (n.type === 'connect_accepted' && n.otherUserId && typeof openPersonProfile === 'function') {
            n.read = true;
            queueSaveUserState();
            openPersonProfile(n.otherUserId, { name: n.name, icon: n.icon, avatarBg: n.iconBg });
            return;
          }
          // Incoming connection requests keep their own Accept/Decline
          // buttons (see notifCards -- those stop propagation so they
          // don't trigger this), but tapping elsewhere on the row still
          // takes you to the requester's profile instead of doing nothing.
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
          autoAcceptConnectionsIfPublic();
          const ov = document.getElementById('overlay');
          // Keep the list where the user had scrolled to; actions like
          // accepting/declining a connection or marking things read
          // shouldn't reset the view to the top.
          const prevNotifScrollEl = ov.querySelector('.overflow-y-auto');
          const prevNotifScrollTop = prevNotifScrollEl ? prevNotifScrollEl.scrollTop : 0;
          ov.innerHTML = `
            <div class="overflow-y-auto no-scrollbar flex-1 bg-gray-50">
              ${menuOverlayHeader('Notifications', notifMenuOpen, 'toggleNotifMenu', notifActionsDropdownHTML('handleNotifAction', { showDelete: false }))}
              <div class="p-5">
                <div class="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
                  ${notifSelected.size ? `
                    <div class="text-xs font-semibold text-[${NAVY}]">${notifSelected.size} selected</div>
                    <button onclick="notifCancelSelect()" class="text-xs font-semibold text-gray-500">Cancel</button>
                  ` : `
                    <div></div>
                    <button onclick="markAllNotifsRead()" class="text-xs font-semibold text-amber-600">Mark all as read</button>
                  `}
                </div>
                <div class="space-y-3">${notifCards(null, { selected: notifSelected, longPressFn: 'notifLongPressSelect', tapFn: 'notifTap' })}</div>
              </div>
            </div>`;
          if (prevNotifScrollTop) {
            const restoredNotifScrollEl = ov.querySelector('.overflow-y-auto');
            if (restoredNotifScrollEl) restoredNotifScrollEl.scrollTop = prevNotifScrollTop;
          }
          attachMenuScrollCloser(ov.querySelector('.overflow-y-auto'), notifMenuOpen, 'toggleNotifMenu');
        }

        function notifCards(list, opts){
          opts = opts || {};
          const selectedSet = opts.selected || new Set();
          const longPressFn = opts.longPressFn || 'notifLongPressSelect';
          const tapFn = opts.tapFn || 'notifTap';
          const selecting = selectedSet.size > 0;
          startNotifTimeTicker();
          return (list || notifData).map(n => {
            const isSel = selectedSet.has(n.id);
            return `
            <div class="rounded-3xl p-4 flex items-start gap-3 ${isSel ? '' : (n.read ? 'bg-gray-50' : 'bg-amber-50')}"
              style="${isSel ? `background:rgba(65,105,225,0.14);` : ''}"
              onmousedown="startPress('${longPressFn}','${n.id}', event)" onmouseup="endPress()" onmouseleave="endPress()"
              ontouchstart="startPress('${longPressFn}','${n.id}', event)" ontouchend="endPress()" ontouchmove="movePress(event)" ontouchcancel="endPress()"
              onclick="handleRowTap('${tapFn}','${n.id}')">
              ${selecting ? `<div class="w-5 h-5 rounded-full border-2 ${isSel ? `bg-gradient-to-br from-[${ROYAL}] to-[${NAVY}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${isSel ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>` : ''}
              <div class="w-10 h-10 ${n.iconBg} rounded-2xl flex items-center justify-center ${n.iconClass} flex-shrink-0">${Icon(n.icon,'w-5 h-5')}</div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <div class="font-semibold text-sm ${n.read ? 'text-gray-500' : `text-[${NAVY}]`}">${escapeHtml(n.name)}</div>
                  ${n.pinned ? Icon('pin','w-3.5 h-3.5 text-amber-600') : ''}
                </div>
                <div class="text-sm ${n.read ? 'text-gray-400' : 'text-gray-600'} mt-0.5 leading-relaxed">${escapeHtml(n.message)}</div>
                <div class="text-xs text-gray-400 mt-1" data-notif-time="${n.id}">${formatNotifTime(n.createdAt)}</div>
                ${n.type === 'connect_request' ? `
                <div class="flex gap-2 mt-3">
                  <button onclick="event.stopPropagation(); acceptConnection('${n.id}')" class="px-4 py-2 rounded-full text-xs font-semibold bg-gray-100 text-[${NAVY}]">Accept</button>
                  <button onclick="event.stopPropagation(); declineConnection('${n.id}')" class="px-4 py-2 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Decline</button>
                </div>` : ''}
              </div>
              ${selecting ? '' : `<button onclick="event.stopPropagation(); deleteNotif('${n.id}')" class="w-8 h-8 flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-red-500" title="Delete">${Icon('trash','w-4 h-4')}</button>`}
            </div>`;
          }).join('');
        }

        // Removes a single notification -- the per-row dustbin icon on
        // every notifCards row (Notifications, Notice Board, and the
        // pinned right-panel list all share this). Unlike applyNotifAction's
        // bulk 'delete', this needs no selection first: tap the icon, it's
        // gone. Re-renders whichever of those views is actually on screen
        // so a delete from one doesn't leave a stale row in another.
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

        // Connection-request notifications are seeded with the same id as
        // their requestConvos entry (see loadIncomingConnectionRequests in
        // chat.js), so Accept/Decline here just delegates to the same
        // acceptRequest/rejectRequest used by the Messaging -> Requests
        // tab -- that's what actually moves the connection into Primary,
        // updates "My Network", clears it from Discover, and writes the
        // accepted/rejected status back to Supabase. This just also
        // removes the notification row and re-renders this tab.
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

        // Applies pin / mark as read / block / delete to whichever notifData
        // ids are currently selected, shared by Notice Board and Notifications.
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

        // ---------------- OVERLAY: Class Announcements ----------------
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
              ${menuOverlayHeader('Notice Board', noticeBoardMenuOpen, 'toggleNoticeBoardMenu', notifActionsDropdownHTML('handleNoticeAction'))}
              <div class="p-5">
                <div class="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
                  ${noticeSelected.size ? `
                    <div class="text-xs font-semibold text-[${NAVY}]">${noticeSelected.size} selected</div>
                    <button onclick="noticeCancelSelect()" class="text-xs font-semibold text-gray-500">Cancel</button>
                  ` : `
                    <div></div>
                    <button onclick="markAllNotifsRead()" class="text-xs font-semibold text-amber-600">Mark all as read</button>
                  `}
                </div>
                <div class="space-y-3">${classroomNotifs.length ? notifCards(classroomNotifs, { selected: noticeSelected, longPressFn: 'noticeLongPressSelect', tapFn: 'noticeTap' }) : '<div class="text-sm text-gray-400 text-center py-6">No class announcements yet.</div>'}</div>
              </div>
            </div>`;
          attachMenuScrollCloser(ov.querySelector('.overflow-y-auto'), noticeBoardMenuOpen, 'toggleNoticeBoardMenu');
        }

        // Desktop right-panel view while Alerts is open: just the
        // classroom announcements that have been pinned (tap-and-hold ->
        // Pin from the Notice Board menu), same pin data as the full list.
        function rightPanelPinnedHTML(){
          const pinned = notifData.filter(n => n.source === 'classroom' && n.pinned);
          if (!pinned.length) return `<div class="text-gray-400 text-sm text-center py-10 px-5">No pinned messages yet.</div>`;
          return `<div class="p-5">${notifCards(pinned, { longPressFn: 'noticeLongPressSelect', tapFn: 'noticeTap' })}</div>`;
        }

        function markAllNotifsRead(){
          notifData.forEach(n => { n.read = true; });
          queueSaveUserState();
          // Previously only removed the two badge elements it knew about
          // by hand, so the newer classroom Alerts badges (cnav-notif-badge
          // / dcnav-notif-badge) and the desktop rail one were left
          // showing a stale count after "Mark all as read". Routing
          // through the same refresh function every other update uses
          // keeps every bell in sync in one place.
          refreshNotifBadge();
        }

        // ---------------- OVERLAY: Gamification ----------------
        // "This week's king of the Quiz" is derived live from whoever is
        // actually #1 on `leaderboard` (updated in applyQuizRewards as
        // real quizzes are played), instead of a fixed name/score that
        // never moved even after you took the top spot.
        function getQuizChampion(){
          return leaderboard[0] || { name: '-', pts: 0 };
        }

        const subGames = [
          { id:'wordHunt', icon:'search', title:'Word Hunt', tag:'Puzzle', img: GAME_IMG_wordHunt,
            desc:"Tap the first and last letter of a hidden word to select it. Words can run across, down, or diagonally: find them all." },
        ];

