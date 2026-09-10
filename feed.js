// ---- Feed render + pull-to-refresh ----
        function feedSkeletonHTML(){
          return `
            <div class="px-5 pb-5" style="padding-top:var(--top-safe-pad);">
              <div class="-mx-5 mb-6 border-b border-gray-100">
                <div class="px-5">${skeletonStoryRowHTML(5)}</div>
              </div>
              <div>${skeletonPostHTML()}${skeletonPostHTML()}${skeletonPostHTML()}</div>
            </div>`;
        }

        let homeFeedRefreshing = false;

        function pullToRefreshIndicatorHTML(){
          const active = homeFeedRefreshing;
          return `
            <div id="ptr-indicator" class="w-full flex items-center justify-center flex-shrink-0" style="height:${active ? '52px' : '0px'};overflow:hidden;transition:height .18s ease;">
              <div style="width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(10,37,64,0.15);border-top-color:${NAVY};${active ? 'animation:classroom-spin .7s linear infinite;' : ''}"></div>
            </div>`;
        }

        function renderFeed() {
          const screenEl = document.getElementById('screen');
          if (!screenEl) return; // shell not mounted yet (e.g. essentialLoads resolved before renderApp() finished) -- it will re-render once the tab is actually shown
          const prevScrollTop = screenEl.scrollTop;
          if (typeof remotePostsLoaded !== 'undefined' && !remotePostsLoaded) {
            // A slow first connection used to just sit on a bare skeleton
            // with nothing to look at. If this account has a saved
            // snapshot from a previous successful load, show that instead
            // -- clearly labeled as saved, not live -- while the real
            // fetch keeps running in the background and replaces it the
            // moment it lands (loadRemotePostsImpl flips
            // feedShowingCachedOnly off and calls back into renderFeed
            // through the normal post-load path).
            const cachedUserId = (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
            const cached = cachedUserId ? loadFeedCacheSnapshot(cachedUserId) : null;
            if (cached) {
              feedShowingCachedOnly = true;
              screenEl.innerHTML = `
                <div class="px-5 pb-5" style="padding-top:var(--top-safe-pad);">
                  ${feedCacheBannerHTML()}
                  <div class="space-y-3" id="feed-list">
                    ${cached.posts.map(feedPost).join('')}
                  </div>
                </div>`;
              return;
            }
            feedShowingCachedOnly = false;
            screenEl.innerHTML = feedSkeletonHTML();
            return;
          }
          feedShowingCachedOnly = false;
          screenEl.innerHTML = `
            <div class="px-5 pb-5" style="padding-top:var(--top-safe-pad);">
              ${pullToRefreshIndicatorHTML()}
              <div class="-mx-5 mb-6 border-b border-gray-100">
                <div class="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-4" id="story-strip">
                  ${stories.map(storyBubble).join('')}
                </div>
              </div>

              <div class="space-y-3" id="feed-list">
                ${feedPosts.filter(p => p.mediaHtml || p.uploading).map(feedPost).join('')}
              </div>
            </div>`;
          if (screenEl) {
            screenEl.scrollTop = prevScrollTop;
            requestAnimationFrame(() => {
              if (!screenEl.isConnected) return;
              screenEl.scrollTop = prevScrollTop;
              requestAnimationFrame(() => {
                if (screenEl.isConnected) screenEl.scrollTop = prevScrollTop;
              });
            });
          }
          const feedListEl = document.getElementById('feed-list');
          if (feedListEl) setupFeedVideoAutoplay(feedListEl);
        }

        function patchFeedInPlace(){
          // Still showing the cached snapshot (no successful live fetch
          // yet) -- defer to renderFeed(), which knows how to correctly
          // redisplay either state. Patching the cached DOM against the
          // live feedPosts array here (possibly still empty, if this is
          // the very first load and the connection hasn't come back)
          // would otherwise blank out the cached posts a person is
          // relying on to see something while they wait to reconnect.
          if (typeof feedShowingCachedOnly !== 'undefined' && feedShowingCachedOnly) { renderFeed(); return; }
          const list = document.getElementById('feed-list');
          if (!list) { renderFeed(); return; }
          const storyStrip = document.getElementById('story-strip');
          if (storyStrip) storyStrip.innerHTML = stories.map(storyBubble).join('');
          // Keep this in sync with the filter in renderFeed() above (and
          // with the "uploading OR has media" definition used everywhere
          // else a post is counted) -- a post mid-upload has no mediaHtml
          // yet, but it should already occupy its slot in the feed (shown
          // via its skeleton in feedPost()) instead of popping in only once
          // the upload finishes.
          const posts = feedPosts.filter(p => p.mediaHtml || p.uploading);
          const keepIds = new Set();
          posts.forEach(post => {
            const elId = 'post-' + post.id;
            keepIds.add(elId);
            const existingEl = document.getElementById(elId);
            if (existingEl) {
              if (existingEl.parentNode !== list || list.children[posts.indexOf(post)] !== existingEl) {
                list.appendChild(existingEl);
              }
            } else {
              const wrap = document.createElement('div');
              wrap.innerHTML = feedPost(post);
              const newEl = wrap.firstElementChild;
              if (newEl) list.appendChild(newEl);
            }
          });
          Array.from(list.children).forEach(child => {
            if (!keepIds.has(child.id)) child.remove();
          });
          setupFeedVideoAutoplay(list);
        }

        let ptrPulling = false;
        let ptrMouseActive = false;
        let ptrStartY = 0;
        let ptrDistance = 0;
        let ptrWheelAccum = 0;
        let ptrWheelResetTimer = null;
        const PTR_DEADZONE = 12;
        const PTR_TRIGGER_DISTANCE = 64;
        const PTR_MAX_DISTANCE = 96;

        function setupPullToRefresh(screenEl){
          if (!screenEl) return;
          screenEl.addEventListener('touchstart', (e) => {
            if (typeof currentTab === 'undefined' || currentTab !== 0) return;
            if (homeFeedRefreshing || screenEl.scrollTop > 0) { ptrPulling = false; return; }
            ptrPulling = true;
            ptrStartY = e.touches[0].clientY;
            ptrDistance = 0;
          }, { passive: true });

          screenEl.addEventListener('touchmove', (e) => {
            if (!ptrPulling) return;
            if (currentTab !== 0 || screenEl.scrollTop > 0) {
              ptrPulling = false;
              setPullIndicatorHeight(0, true);
              return;
            }
            const rawDy = e.touches[0].clientY - ptrStartY;
            if (rawDy <= PTR_DEADZONE) { ptrDistance = 0; setPullIndicatorHeight(0, false); return; }
            const dy = rawDy - PTR_DEADZONE;
            ptrDistance = Math.min(PTR_MAX_DISTANCE, dy * 0.5);
            setPullIndicatorHeight(ptrDistance, false);
          }, { passive: true });

          screenEl.addEventListener('touchend', () => {
            if (!ptrPulling) return;
            ptrPulling = false;
            if (ptrDistance >= PTR_TRIGGER_DISTANCE) {
              startHomeFeedRefresh();
            } else {
              setPullIndicatorHeight(0, true);
            }
            ptrDistance = 0;
          }, { passive: true });

          // Desktop (mouse) support: mirrors the touch handlers above so
          // click-and-drag with a mouse also triggers pull-to-refresh, since
          // desktop browsers don't fire touch events.
          screenEl.addEventListener('mousedown', (e) => {
            if (typeof currentTab === 'undefined' || currentTab !== 0) return;
            if (homeFeedRefreshing || screenEl.scrollTop > 0) { ptrPulling = false; return; }
            ptrMouseActive = true;
            ptrPulling = true;
            ptrStartY = e.clientY;
            ptrDistance = 0;
          });

          window.addEventListener('mousemove', (e) => {
            if (!ptrMouseActive || !ptrPulling) return;
            if (typeof currentTab === 'undefined' || currentTab !== 0 || screenEl.scrollTop > 0) {
              ptrPulling = false;
              setPullIndicatorHeight(0, true);
              return;
            }
            const rawDy = e.clientY - ptrStartY;
            if (rawDy <= PTR_DEADZONE) { ptrDistance = 0; setPullIndicatorHeight(0, false); return; }
            const dy = rawDy - PTR_DEADZONE;
            ptrDistance = Math.min(PTR_MAX_DISTANCE, dy * 0.5);
            setPullIndicatorHeight(ptrDistance, false);
          });

          window.addEventListener('mouseup', () => {
            if (!ptrMouseActive) return;
            ptrMouseActive = false;
            if (!ptrPulling) return;
            ptrPulling = false;
            if (ptrDistance >= PTR_TRIGGER_DISTANCE) {
              startHomeFeedRefresh();
            } else {
              setPullIndicatorHeight(0, true);
            }
            ptrDistance = 0;
          });

          // Desktop trackpad/scroll-wheel support: most desktop users
          // scroll with a wheel rather than click-and-drag, so mirror the
          // same gesture there -- once the feed is already scrolled all
          // the way to the top, continuing to scroll up ("up up up, and
          // there is nothing to display, and you still scroll") pulls
          // down the refresh indicator instead of doing nothing.
          screenEl.addEventListener('wheel', (e) => {
            if (typeof currentTab === 'undefined' || currentTab !== 0 || homeFeedRefreshing) return;
            if (screenEl.scrollTop > 0) {
              if (ptrWheelAccum > 0) { ptrWheelAccum = 0; setPullIndicatorHeight(0, true); }
              return;
            }
            if (e.deltaY < 0) {
              ptrWheelAccum = Math.min(PTR_MAX_DISTANCE, ptrWheelAccum + (-e.deltaY) * 0.6);
              setPullIndicatorHeight(ptrWheelAccum, false);
              clearTimeout(ptrWheelResetTimer);
              ptrWheelResetTimer = setTimeout(() => {
                if (ptrWheelAccum >= PTR_TRIGGER_DISTANCE) {
                  startHomeFeedRefresh();
                } else {
                  setPullIndicatorHeight(0, true);
                }
                ptrWheelAccum = 0;
              }, 220);
            } else if (e.deltaY > 0 && ptrWheelAccum > 0) {
              clearTimeout(ptrWheelResetTimer);
              ptrWheelAccum = 0;
              setPullIndicatorHeight(0, true);
            }
          }, { passive: true });
        }

        function setPullIndicatorHeight(px, animated){
          const el = document.getElementById('ptr-indicator');
          if (!el) return;
          el.style.transition = animated ? 'height .18s ease' : 'none';
          el.style.height = px + 'px';
        }

        async function startHomeFeedRefresh(){
          if (homeFeedRefreshing) return;
          homeFeedRefreshing = true;
          const el = document.getElementById('ptr-indicator');
          if (el) {
            el.style.transition = 'height .18s ease';
            el.style.height = '52px';
            const spinner = el.firstElementChild;
            if (spinner) spinner.style.animation = 'classroom-spin .7s linear infinite';
          }
          try {
            await loadRemotePosts();
            await loadPostInteractions();
          } catch (e) {  }
          homeFeedRefreshing = false;
          if (typeof currentTab === 'undefined' || currentTab !== 0) return;
          setPullIndicatorHeight(0, true);
          setTimeout(() => {
            if (typeof currentTab !== 'undefined' && currentTab === 0) {
              if (typeof patchFeedInPlace === 'function') patchFeedInPlace();
              else renderFeed();
            }
          }, 180);
        }

        let stories = [
          { id:0, name:'Glimpse', icon:'person', bg:'', mine:true },
        ];

        // ---- SVG icon library ----
        function Icon(type, cls){
          const paths = {
            home: `<path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.97-.97v7.63a2.25 2.25 0 01-2.25 2.25h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3a2.25 2.25 0 01-2.25-2.25V12.6l-.97.97a.75.75 0 11-1.06-1.06l8.69-8.69z"/>`,
            search: `<path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clip-rule="evenodd"/>`,
            bell: `<path fill-rule="evenodd" d="M12 2.25c-1.036 0-1.875.84-1.875 1.875v.155A6.375 6.375 0 005.25 10.5v3.379a3 3 0 01-.879 2.121l-.6.6a.75.75 0 00.53 1.28h15.398a.75.75 0 00.53-1.28l-.6-.6a3 3 0 01-.879-2.121V10.5a6.375 6.375 0 00-4.875-6.22v-.155c0-1.036-.84-1.875-1.875-1.875zM9.75 18.75a2.25 2.25 0 104.5 0h-4.5z" clip-rule="evenodd"/>`,
            plus: `<path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>`,
            mail: `<path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/>`,
            briefcase: `<path d="M8 8V6.25A3.25 3.25 0 0111.25 3h1.5A3.25 3.25 0 0116 6.25V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="8" width="18" height="12" rx="3"/><line x1="3.8" y1="13.6" x2="20.2" y2="13.6" stroke="white" stroke-width="0.7" stroke-linecap="round" opacity="0.85"/><rect x="10" y="12.5" width="4" height="3" rx="0.9" fill="white"/>`,
            book: `<rect x="3" y="16.5" width="18" height="3.2" rx="0.8"/><rect x="3.4" y="12.6" width="17.2" height="3.2" rx="0.8" transform="rotate(-1.5 12 14.2)"/><rect x="3.6" y="8.7" width="16" height="3.2" rx="0.8" transform="rotate(1.5 12 10.3)"/><rect x="4.4" y="4.3" width="13.5" height="3.6" rx="0.8" transform="rotate(-4 11 6.1)"/>`,
            bookStack: `<rect x="3" y="7.4" width="4.4" height="13.1" rx="0.9"/><rect x="9.1" y="5" width="4.4" height="15.5" rx="0.9"/><rect x="15" y="7.3" width="4.7" height="13.2" rx="0.9" transform="rotate(11 17.35 13.9)"/>`,
            mic: `<path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z"/><path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z"/>`,
            user: `<path d="M12 12.5c2.9 0 5.25-2.35 5.25-5.25S14.9 2 12 2 6.75 4.35 6.75 7.25 9.1 12.5 12 12.5zm0 2.5c-3.87 0-9 1.94-9 5.25V22h18v-1.75c0-3.31-5.13-5.25-9-5.25z"/>`,
            users: `<path d="M9 12.75a4.25 4.25 0 100-8.5 4.25 4.25 0 000 8.5zm7.5-.75a3.5 3.5 0 10-1.66-6.58 5.72 5.72 0 010 5.16A3.48 3.48 0 0016.5 12zM9 14.5c-3.5 0-7 1.75-7 4.75V21h14v-1.75c0-3-3.5-4.75-7-4.75zm7.9.03c1.85.6 3.6 1.83 3.6 3.72V21h3v-1.75c0-2.35-2.65-3.72-6.6-3.72z"/>`,
            graduate: `<path d="M12 3L1 8l11 5 9-4.1V17h2V8L12 3zM5 12.18v3.64C5 18.13 8.13 20 12 20s7-1.87 7-4.18v-3.64l-7 3.18-7-3.18z"/>`,
            bot: `<g transform="translate(12,12) scale(1.15) translate(-12,-12)"><rect x="5" y="9" width="14" height="10" rx="3"/><rect x="10.25" y="3" width="3.5" height="4" rx="1.75"/><circle cx="12" cy="4.5" r="1.1"/><circle cx="9.2" cy="14" r="1.3" fill="white"/><circle cx="14.8" cy="14" r="1.3" fill="white"/><line x1="8.5" y1="17.2" x2="15.5" y2="17.2" stroke="white" stroke-width="1" stroke-linecap="round"/><rect x="2.3" y="12.5" width="1.8" height="3.5" rx="0.9"/><rect x="19.9" y="12.5" width="1.8" height="3.5" rx="0.9"/></g>`,
            camera: `<path fill-rule="evenodd" d="M9.344 3.07a24.66 24.66 0 015.312 0c.967.052 1.75.816 1.928 1.766l.157.837c.083.444.377.82.83.916A3.001 3.001 0 0121 9.5v8A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-8a3.001 3.001 0 012.43-2.911c.452-.096.746-.472.828-.916l.158-.837c.178-.95.96-1.714 1.928-1.766zM12 16.5a4 4 0 100-8 4 4 0 000 8z" clip-rule="evenodd"/>`,
            handRaised: `<path d="M8 11.25V4.75a1.5 1.5 0 013 0v6M11 10.75V3.75a1.5 1.5 0 013 0v7M14 10.75V6a1.5 1.5 0 013 0v9.5a6 6 0 01-6 6h-.75a6 6 0 01-5.196-3l-2.06-3.567a1.6 1.6 0 012.732-1.65L8 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            cameraOff: `<path d="M9.344 3.07a24.66 24.66 0 015.312 0c.967.052 1.75.816 1.928 1.766l.157.837c.083.444.377.82.83.916A3.001 3.001 0 0121 9.5v8c0 .58-.156 1.123-.428 1.59l-11.66-11.66c.166-.312.27-.665.328-.98l.158-.837c.178-.95.96-1.714 1.928-1.766zM4.28 3.22a.75.75 0 00-1.06 1.06L6.02 7.08A3 3 0 003 9.5v8A2.5 2.5 0 005.5 20h13c.412 0 .8-.1 1.142-.278l1.078 1.078a.75.75 0 101.06-1.06L4.28 3.22zM12 8.5c.245 0 .484.023.716.067l3.717 3.717A4 4 0 0112 16.5a4 4 0 01-3.976-4.49l3.06 3.06A4.02 4.02 0 0012 15.5a3 3 0 001.487-.392L9.392 11.013A4 4 0 0112 8.5z"/>`,
            video: `<path d="M4.5 5.5A2.5 2.5 0 002 8v8a2.5 2.5 0 002.5 2.5h9A2.5 2.5 0 0016 15.5v-1.35l4.05 2.5A1 1 0 0021.5 15.7V8.3a1 1 0 00-1.45-.9L16 9.9V8.5A2.5 2.5 0 0013.5 6h-9z"/>`,
            photoTile: `<path fill-rule="evenodd" d="M3.75 4.5A2.25 2.25 0 001.5 6.75v10.5A2.25 2.25 0 003.75 19.5h16.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75zM7.5 8.25a1.875 1.875 0 110 3.75 1.875 1.875 0 010-3.75zm5.53 2.397a.75.75 0 011.128-.06l3.712 3.713a.75.75 0 01-.53 1.28H6.66a.75.75 0 01-.505-1.305l3.06-2.782a.75.75 0 01.995-.006l1.06.95 1.75-1.79z" clip-rule="evenodd"/>`,
            videoTile: `<path d="M4 5.25A1.75 1.75 0 002.25 7v10A1.75 1.75 0 004 18.75h16A1.75 1.75 0 0021.75 17V7A1.75 1.75 0 0020 5.25H4zM5.5 7.5h1.75v1.5H5.5v-1.5zm11.25 0H18.5v1.5h-1.75v-1.5zM5.5 15v-1.5h1.75V15H5.5zm11.25 0v-1.5H18.5V15h-1.75zM8.75 7.75A1.25 1.25 0 0110 6.5h4A1.25 1.25 0 0115.25 7.75v8.5A1.25 1.25 0 0114 17.5h-4a1.25 1.25 0 01-1.25-1.25v-8.5z" fill="currentColor"/><path d="M11.1 9.65a.55.55 0 01.85-.46l2.1 1.35a.55.55 0 010 .92l-2.1 1.35a.55.55 0 01-.85-.46v-2.7z" fill="white"/>`,
            phone: `<path fill-rule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97a15.075 15.075 0 006.696 6.696l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clip-rule="evenodd"/>`,
            phoneOutline: `<path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            minimize: `<path d="M9 4v4a1 1 0 01-1 1H4M15 4v4a1 1 0 001 1h4M9 20v-4a1 1 0 00-1-1H4M15 20v-4a1 1 0 011-1h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
            personPlus: `<circle cx="10" cy="8" r="3.2"/><path d="M3.5 20c0-3.87 3.14-7 7-7 .9 0 1.76.16 2.55.46" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 14v6M15 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
            phoneHangup: `<path d="M12 2.25c-4.5 0-8.25 1.68-8.25 3.75 0 1.06 1.02 2.53 2.4 3.87.35.34.9.32 1.24-.03l1.4-1.46a.9.9 0 00.14-1.06 3.6 3.6 0 01-.4-1.13c-.06-.4.1-.8.42-1.03a10.5 10.5 0 016.1 0c.32.23.48.63.42 1.03-.07.4-.2.79-.4 1.13a.9.9 0 00.14 1.06l1.4 1.46c.34.35.89.37 1.24.03 1.38-1.34 2.4-2.81 2.4-3.87 0-2.07-3.75-3.75-8.25-3.75z"/>`,
            heart: `<path d="M11.645 20.91l-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012a.752.752 0 01-.704 0z"/>`,
            heartOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>`,
            thumbUp: `<path d="M2.5 10.5a1.5 1.5 0 011.5-1.5h2.25a.75.75 0 01.75.75v9.5a.75.75 0 01-.75.75H4a1.5 1.5 0 01-1.5-1.5v-8z"/><path d="M9.9 8.05L14.02 3c.3-.37.82-.48 1.24-.26A3.25 3.25 0 0117 5.6c0 1.14-.24 2.23-.68 3.22a.4.4 0 00.37.56h3.44c1.6 0 2.94 1.25 2.99 2.85.04.9-.06 1.79-.29 2.65l-1.35 5.02a3.26 3.26 0 01-3.15 2.4H10.5a2.75 2.75 0 01-2.75-2.75V9.6c0-.58.2-1.14.57-1.6l1.58-1.95z"/>`,
            thumbUpOutline: `<path d="M2.5 10.5a1.5 1.5 0 011.5-1.5h2.25a.75.75 0 01.75.75v9.5a.75.75 0 01-.75.75H4a1.5 1.5 0 01-1.5-1.5v-8z"/><path fill="none" stroke-linecap="round" stroke-linejoin="round" d="M9.9 8.05L14.02 3c.3-.37.82-.48 1.24-.26A3.25 3.25 0 0117 5.6c0 1.14-.24 2.23-.68 3.22a.4.4 0 00.37.56h3.44c1.6 0 2.94 1.25 2.99 2.85.04.9-.06 1.79-.29 2.65l-1.35 5.02a3.26 3.26 0 01-3.15 2.4H10.5a2.75 2.75 0 01-2.75-2.75V9.6c0-.58.2-1.14.57-1.6l1.58-1.95z"/>`,
            comment: `<path fill-rule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223z" clip-rule="evenodd"/><circle cx="8.2" cy="11.2" r="1.15" fill="white"/><circle cx="12" cy="11.2" r="1.15" fill="white"/><circle cx="15.8" cy="11.2" r="1.15" fill="white"/>`,
            repost: `<path d="M18 6.41V4a1 1 0 011.707-.707l3 3a1 1 0 010 1.414l-3 3A1 1 0 0118 10V7.5H8a1 1 0 00-1 1V11H5V8.5a3 3 0 013-3h10zM6 17.59V20a1 1 0 01-1.707.707l-3-3a1 1 0 010-1.414l3-3A1 1 0 016 14v2.5h10a1 1 0 001-1V13h2v2.5a3 3 0 01-3 3H6z"/>`,
            repostOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-4.992M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/>`,
            send: `<path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z"/>`,
            link: `<path fill-rule="evenodd" d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.353 5.25 5.25 0 01-1.449-8.45l4.5-4.5a5.25 5.25 0 117.424 7.424l-1.757 1.757a.75.75 0 11-1.06-1.06l1.757-1.757a3.75 3.75 0 000-5.304zm-7.389 4.192a5.25 5.25 0 011.449 8.45l-4.5 4.5a5.25 5.25 0 11-7.424-7.424l1.757-1.757a.75.75 0 111.06 1.06l-1.757 1.757a3.75 3.75 0 105.304 5.304l4.5-4.5a3.75 3.75 0 00-1.035-6.037.75.75 0 01.646-1.353z" clip-rule="evenodd"/>`,
            target: `<circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.75" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1.5"/>`,
            edit: `<path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"/><path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z"/>`,
            clock: `<path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clip-rule="evenodd"/>`,
            calendar: `<path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clip-rule="evenodd"/>`,
            file: `<path fill-rule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" clip-rule="evenodd"/><path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z"/>`,
            folder: `<path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z"/>`,
            bookmark: `<path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clip-rule="evenodd"/>`,
            bookmarkOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>`,
            star: `<path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd"/>`,
            sparkles: `<path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.966 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z" clip-rule="evenodd"/>`,
            flame: `<path fill-rule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.176 7.547 7.547 0 01-1.705-1.715.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clip-rule="evenodd"/>`,
            bolt: `<path fill-rule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clip-rule="evenodd"/>`,
            landmark: `<path fill-rule="evenodd" d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 11-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6zM4.5 12a.75.75 0 01.75.75v6.75H3a.75.75 0 000 1.5h18a.75.75 0 000-1.5h-2.25V12.75a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75v6.75h-2.25V12.75a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v6.75H8.25V12.75a.75.75 0 00-.75-.75h-3z" clip-rule="evenodd"/>`,
            chart: `<path d="M18.375 2.25c-1.036 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z"/>`,
            check: `<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/>`,
            checkSingle: `<path d="M4.5 12.75l5 5 10-11.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
            checkDouble: `<path d="M1 12.75l5 5 8-9.25" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 12.75l5 5 9.5-11" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
            grid: `<path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v4.5C1.5 10.41 2.34 11.25 3.375 11.25h4.5c1.036 0 1.875-.84 1.875-1.875v-4.5C9.75 3.839 8.91 3 7.875 3h-4.5zM3.375 12.75c-1.036 0-1.875.84-1.875 1.875v4.5c0 1.035.84 1.875 1.875 1.875h4.5c1.035 0 1.875-.84 1.875-1.875v-4.5c0-1.036-.84-1.875-1.875-1.875h-4.5zM12.75 4.875c0-1.036.84-1.875 1.875-1.875h4.5c1.035 0 1.875.84 1.875 1.875v4.5c0 1.035-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 01-1.875-1.875v-4.5zM12.75 14.625c0-1.036.84-1.875 1.875-1.875h4.5c1.035 0 1.875.84 1.875 1.875v4.5c0 1.035-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 01-1.875-1.875v-4.5z"/>`,
            gridOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>`,
            play: `<path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd"/>`,
            pause: `<rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/>`,
            close: `<path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>`,
            back: `<path fill-rule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06l-6.22 6.22H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clip-rule="evenodd"/>`,
            chevronDown: `<path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clip-rule="evenodd"/>`,
            lock: `<path fill-rule="evenodd" d="M12 1.5a4.5 4.5 0 00-4.5 4.5v3.75H6.75a2.25 2.25 0 00-2.25 2.25v7.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25H16.5V6A4.5 4.5 0 0012 1.5zm3 8.25V6a3 3 0 10-6 0v3.75h6z" clip-rule="evenodd"/>`,
            help: `<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c.096-.026.204-.04.319-.04.55 0 .975.322.975.8 0 .253-.099.469-.335.719-.386.408-.883.913-.883 1.663v.2a.75.75 0 001.5 0v-.088c0-.313.183-.556.5-.887.406-.425.813-.892.813-1.607 0-1.243-1.055-2.05-2.34-2.05-1.056 0-1.86.492-2.223 1.243a.75.75 0 101.348.656c.14-.288.44-.5.848-.612zM12 17a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>`,
            settings: `<path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 01-.517.6c-.157.055-.311.116-.463.181a.798.798 0 01-.798-.074l-.453-.324a1.875 1.875 0 00-2.416.2l-.243.243a1.875 1.875 0 00-.2 2.416l.324.453a.798.798 0 01.074.798 6.98 6.98 0 00-.181.463.798.798 0 01-.6.517l-.549.091A1.875 1.875 0 002.25 11.078v.344c0 .917.663 1.699 1.567 1.85l.549.091c.281.047.518.238.6.517.055.157.116.311.181.463a.798.798 0 01-.074.798l-.324.453a1.875 1.875 0 00.2 2.416l.243.243c.648.648 1.67.712 2.416.2l.453-.324a.798.798 0 01.798-.074c.152.065.306.126.463.181.279.082.47.319.517.6l.091.549a1.875 1.875 0 001.85 1.567h.344c.917 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 01.517-.6c.157-.055.311-.116.463-.181a.798.798 0 01.798.074l.453.324a1.875 1.875 0 002.416-.2l.243-.243a1.875 1.875 0 00.2-2.416l-.324-.453a.798.798 0 01-.074-.798c.065-.152.126-.306.181-.463.082-.279.319-.47.6-.517l.549-.091a1.875 1.875 0 001.567-1.85v-.344a1.875 1.875 0 00-1.567-1.85l-.549-.091a.798.798 0 01-.6-.517 6.98 6.98 0 00-.181-.463.798.798 0 01.074-.798l.324-.453a1.875 1.875 0 00-.2-2.416l-.243-.243a1.875 1.875 0 00-2.416-.2l-.453.324a.798.798 0 01-.798.074 6.98 6.98 0 00-.463-.181.798.798 0 01-.517-.6l-.091-.549a1.875 1.875 0 00-1.85-1.567h-.344zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd"/>`,
            trash: `<path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clip-rule="evenodd"/>`,
            block: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="5.8" y1="5.8" x2="18.2" y2="18.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
            scan: `<path d="M4 9V6a2 2 0 012-2h3M20 9V6a2 2 0 00-2-2h-3M4 15v3a2 2 0 002 2h3M20 15v3a2 2 0 01-2 2h-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="9" y="9" width="6" height="6" rx="1"/>`,
            select: `<rect x="3" y="4" width="4.5" height="4.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.2 6.2l0.9 0.9 1.7-1.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><line x1="10.5" y1="6.2" x2="21" y2="6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="3" y="10.75" width="4.5" height="4.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="10.5" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="3" y="17.5" width="4.5" height="4.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="10.5" y1="19.75" x2="21" y2="19.75" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
            upload: `<path fill-rule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>`,
            clip: `<path d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94a3 3 0 114.243 4.243L8.552 18.32a1.5 1.5 0 01-2.122-2.122l7.81-7.81" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            menu: `<path fill-rule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clip-rule="evenodd"/>`,
            dots: `<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>`,
            shuffle: `<path d="M4 5h3.6c1 0 1.9.5 2.5 1.4l5.8 8.5c.6.9 1.5 1.4 2.5 1.4H21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 19h3.6c1 0 1.9-.5 2.5-1.4l1-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.4 6.9c.6-.9 1.5-1.4 2.5-1.4H21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 3l3 2.5-3 2.5M18.5 16l3 2.5-3 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
            trophy: `<path d="M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M5 5.5H3.5a.5.5 0 00-.5.5v.75A2.75 2.75 0 004.75 9.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M19 5.5h1.5a.5.5 0 01.5.5v.75A2.75 2.75 0 0119.25 9.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="10.75" y="13.5" width="2.5" height="4"/><rect x="8" y="17.5" width="8" height="2" rx="0.6"/>`,
            trending: `<path d="M3 17l6-6 4 4 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
            filter: `<path d="M3.5 5h17M6.5 12h11M10 19h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
            pin: `<path fill-rule="evenodd" d="M12 21c-.28 0-.55-.12-.74-.34C10.32 19.5 6 14.28 6 9.75a6 6 0 1112 0c0 4.53-4.32 9.75-5.26 10.91-.19.22-.46.34-.74.34zm0-8.25a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>`,
            dashes: `<line x1="5" y1="6.5" x2="19" y2="6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="5" y1="17.5" x2="19" y2="17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
            listDots: `<circle cx="4" cy="6" r="1.4"/><line x1="8" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4" cy="12" r="1.4"/><line x1="8" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4" cy="18" r="1.4"/><line x1="8" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
            arrowRight: `<path fill-rule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clip-rule="evenodd"/>`,
            arrowLeft: `<path fill-rule="evenodd" d="M11.03 3.97a.75.75 0 010 1.06L4.81 11.25H21a.75.75 0 010 1.5H4.81l6.22 6.22a.75.75 0 11-1.06 1.06l-7.5-7.5a.75.75 0 010-1.06l7.5-7.5a.75.75 0 011.06 0z" clip-rule="evenodd"/>`,
            flag: `<path d="M5 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 4.5h11l-2.2 3.75L16 12H5" fill="currentColor" stroke="none"/>`,
            download: `<path d="M12 3v10m0 0l4-4m-4 4l-4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
            shield: `<path d="M12 2l7 3v5.5c0 5-3 8.7-7 10.5-4-1.8-7-5.5-7-10.5V5l7-3z"/>`,
            gift: `<rect x="4" y="9.5" width="16" height="10" rx="1"/><rect x="2.5" y="6" width="19" height="4" rx="1"/><rect x="11.1" y="6" width="1.8" height="13.5" fill="white"/><path d="M12 6c-1-3.2-5.2-3-5.2 0h5.2zm0 0c1-3.2 5.2-3 5.2 0H12z"/>`,
            logout: `<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
            theme: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3a9 9 0 000 18V3z"/>`,
            doc: `<path fill-rule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" clip-rule="evenodd"/><path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z"/><path d="M7 13.5h6M7 16.5h6M7 10.5h3" stroke="white" stroke-width="0.8" stroke-linecap="round"/>`,
            crown: `<path d="M3.5 8.5L7 11l5-6 5 6 3.5-2.5-1.4 9.5H4.9L3.5 8.5z"/><rect x="4.9" y="18" width="14.2" height="2.2" rx="0.6"/>`,
            leaf: `<path d="M20 3.5c-9 0-15.5 6-15.5 14 0 1 .1 2 .3 2.6.6.2 1.7.3 2.6.3 8 0 14-6.5 14-15.5 0-.4 0-.9-.1-1.4-.4-.1-.9-.1-1.3 0z"/><path d="M5.5 19.5C9 16 13 12 17.5 7.5" fill="none" stroke="white" stroke-width="1.1" stroke-linecap="round"/>`,
            gem: `<path d="M3 9l3.5-5.5h11L21 9l-9 12L3 9z"/><path d="M3 9h18M8.3 3.5L6.5 9l5.5 12M15.7 3.5L17.5 9 12 21" fill="none" stroke="white" stroke-width="0.7" stroke-linejoin="round"/>`,
            coin: `<ellipse cx="8" cy="5.3" rx="4.3" ry="1.9"/><rect x="3.7" y="5.3" width="8.6" height="12.6"/><ellipse cx="8" cy="17.9" rx="4.3" ry="1.9"/><rect x="3.7" y="8.2" width="8.6" height="0.9" fill="white"/><rect x="3.7" y="11.2" width="8.6" height="0.9" fill="white"/><rect x="3.7" y="14.2" width="8.6" height="0.9" fill="white"/><circle cx="15.3" cy="15.3" r="6.7" fill="white"/><circle cx="15.3" cy="15.3" r="5.7"/><path d="M15.3 11.3v8.4M13.2 13.4c0-1.05.95-1.9 2.4-1.9s2.4.75 2.4 1.7c0 2.15-4.8 1.1-4.8 3.25 0 .95.95 1.7 2.4 1.7s2.4-.85 2.4-1.9" fill="none" stroke="white" stroke-width="1.3" stroke-linecap="round"/>`,
            copy: `<rect x="8.25" y="8.25" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15.75 8.25V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8.25A1.5 1.5 0 006 15.75h2.25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            paperclip: `<path d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32a1.5 1.5 0 01-2.122-2.121l7.693-7.693" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            alertTriangle: `<path d="M12 9v3.75m0 3h.008v.008H12v-.008zM9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            rocket: `<path d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 0014.63 6.63m.96 7.74a14.98 14.98 0 01-7.74.96m6.78-8.7a6 6 0 00-7.38 5.84H9.7m0 0a5.98 5.98 0 01-.94 3.14m.94-3.14a5.98 5.98 0 00-3.14.94m0 0a6.01 6.01 0 00-1.64 3.7 6.01 6.01 0 003.7-1.64" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
            tap: `<path d="M8.25 12V6.75a1.5 1.5 0 013 0v3.75m0-.75V5.25a1.5 1.5 0 013 0v5.25m0-3.75v2.25a1.5 1.5 0 013 0v3.75m-9 .75v2.25a6 6 0 006 6 6 6 0 006-6v-2.25M8.25 12l-1.72-1.72a1.5 1.5 0 00-2.42 1.77l2.2 3.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
            micOff: `<path d="M8.25 4.5a3.75 3.75 0 117.5 0v6.379l-7.319-7.32c.2-.036.404-.06.615-.06zM4.28 3.22a.75.75 0 00-1.06 1.06l17.5 17.5a.75.75 0 101.06-1.06l-3.093-3.093A6.72 6.72 0 0019.5 12.75v-1.5a.75.75 0 00-1.5 0v1.5c0 1.02-.26 1.978-.717 2.813l-1.096-1.096c.203-.53.313-1.106.313-1.717v-.879L8.25 9.62V4.5c0-.108.004-.215.012-.32l-3.982-3.96z"/><path d="M15.53 16.591a5.246 5.246 0 01-8.03-4.591v-1.5a.75.75 0 00-1.5 0v1.5a6.751 6.751 0 006 6.709v2.291h-3a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-3v-2.291a6.72 6.72 0 002.594-.848l-1.064-1.064-.5-.5v-.706z"/>`,
            square: `<rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
            penTool: `<path d="M16.862 4.487a2.1 2.1 0 113.033 2.902L7.5 19.789l-4 1 1-4L16.862 4.487z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.3 7.05l2.65 2.65" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
            circle: `<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
            lineTool: `<line x1="5" y1="19" x2="19" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
            textT: `<path d="M4 5h16M12 5v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
            eraser: `<rect x="5" y="11" width="14" height="7" rx="1.5" transform="rotate(-20 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/>`,
            undo: `<path d="M8 7L4 11l4 4M4 11h9a6 6 0 110 12h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
            monitor: `<rect x="2.5" y="4" width="19" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`,
            thumbsUp: `<path d="M2 9.75A1.25 1.25 0 013.25 8.5a1.25 1.25 0 011.25 1.25v7.5a1.25 1.25 0 11-2.5 0v-7.5zM12 4.5V3.2c0-.268.14-.526.395-.607A2 2 0 0115 4.5c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261.99 2.317 2.23.045.7.023 1.4-.068 2.09-.15 1.13-1.12 1.93-2.26 1.93h-5.286c-.591 0-1.176-.104-1.719-.302L9 13.56V6.19l1.28-.495a4.5 4.5 0 001.72-1.195z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
            clap: `<path d="M9.5 4l-3 5.2a1.4 1.4 0 002.4 1.5L11 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.5 4l3 5.2a1.4 1.4 0 01-2.4 1.5L13 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 12.5c-.5 3 1.2 6.2 5.5 7.5 4.3-1.3 6-4.5 5.5-7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            laugh: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9.8c.5-1 1.5-1 2 0M14 9.8c.5-1 1.5-1 2 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7.5 13.3c1 2.6 3 3.7 4.5 3.7s3.5-1.1 4.5-3.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
            wow: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.1"/><circle cx="15" cy="10" r="1.1"/><ellipse cx="12" cy="15.2" rx="2.1" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
            party: `<path d="M4.5 19.5l3.2-9.8 6.6 6.6-9.8 3.2z"/><path d="M10.5 8L12 4.5M14.5 10.7l3.7-1.8M7.3 5.2L5.7 3.5M18.2 6.8l1.8-1M5.3 12.2l-1.8.9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
            volume: `<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06z"/><path d="M18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z"/><path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z"/>`,
            volumeOff: `<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06z"/><path d="M17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 101.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06L19.5 10.94l-1.72-1.72z"/>`,
            eye: `<path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>`,
            eyeOff: `<path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z"/><path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0115.75 12zM12.53 15.713l-4.243-4.244a3.75 3.75 0 004.243 4.243z"/><path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 00-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A3.75 3.75 0 016.75 12z"/>`,
            homeOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/>`,
            briefcaseOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"/>`,
            bookOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>`,
            commentOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>`,
            plusOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>`,
            addGlimpseOutline: `<circle cx="12" cy="12" r="9" stroke-dasharray="2.6 2.6"/><path stroke-linecap="round" d="M12 7.75v8.5M7.75 12h8.5"/>`,
            bellOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>`,
            trendingOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/>`,
            settingsOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`,
            userOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>`,
            folderOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-19.5 0v6a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-6m-19.5 0V6A2.25 2.25 0 014.5 3.75h4.372c.516 0 .966.351 1.091.852l.632 2.528c.124.5.574.852 1.09.852H19.5A2.25 2.25 0 0121.75 9.75v3"/>`,
            editOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>`,
            botOutline: `<g transform="translate(12,12) scale(1.15) translate(-12,-12)"><rect x="5" y="9" width="14" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="10.25" y="3" width="3.5" height="4" rx="1.75" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="4.5" r="1.1" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="9.2" cy="14" r="1.3" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="14.8" cy="14" r="1.3" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="8.5" y1="17.2" x2="15.5" y2="17.2" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><rect x="2.3" y="12.5" width="1.8" height="3.5" rx="0.9" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="19.9" y="12.5" width="1.8" height="3.5" rx="0.9" fill="none" stroke="currentColor" stroke-width="1.2"/></g>`,
            bulbOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-2.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75-7.478a3.75 3.75 0 10-3.75 6.5v.478m3.75-6.978a3.75 3.75 0 00-3.75 0m3.75 0v1m-3.75-1v1m-1.243 5.7c-.85-.493-1.507-1.333-1.507-2.316a5.25 5.25 0 1110.5 0c0 .983-.658 1.823-1.507 2.316M9.75 21h4.5"/>`,
            videoClip: `<rect x="2" y="5" width="20" height="14" rx="2.5"/><rect x="7" y="7.4" width="10" height="9.2" rx="1.4" fill="white"/><rect x="3.1" y="6.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="3.1" y="9.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="3.1" y="12.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="3.1" y="15.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="6.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="9.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="12.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="15.6" width="1.5" height="1.5" rx="0.3" fill="white"/><path d="M10.3 9.8l4 2.2-4 2.2z"/>`,
            photoFrame: `<path fill-rule="evenodd" d="M4 4.75A1.75 1.75 0 015.75 3h13A1.75 1.75 0 0120.5 4.75v9.5a1.75 1.75 0 01-1.75 1.75H9.1L4.7 20.1a.85.85 0 01-1.45-.6V4.75zM8.6 8.6a1.35 1.35 0 100-2.7 1.35 1.35 0 000 2.7zm-2.85 5.4h11.5v-1.15l-3.4-4.15-3.35 3.9-2.05-1.65-2.7 3.05v-.0z" clip-rule="evenodd"/>`,
          };
          const isOutline = /Outline$/.test(type);
          const viewBoxOverrides = { phoneHangup: '0 -5.82 24 24' };
          const vb = viewBoxOverrides[type] || '0 0 24 24';
          const attrs = isOutline ? `viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6"` : `viewBox="${vb}" fill="currentColor"`;
          return `<svg ${attrs} class="${cls}">${paths[type] || paths.user}</svg>`;
        }
        function silhouetteIcon(type, cls){ return Icon(type, cls); }

        function IconBold(type, cls){
          const boldPaths = {
            back: `<path d="M11 4.5L3.8 12l7.2 7.5M4.8 12h15.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            plus: `<line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`,
            dots: `<circle cx="12" cy="5" r="2.3"/><circle cx="12" cy="12" r="2.3"/><circle cx="12" cy="19" r="2.3"/>`,
            settings: `<path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 01-.517.6c-.157.055-.311.116-.463.181a.798.798 0 01-.798-.074l-.453-.324a1.875 1.875 0 00-2.416.2l-.243.243a1.875 1.875 0 00-.2 2.416l.324.453a.798.798 0 01.074.798 6.98 6.98 0 00-.181.463.798.798 0 01-.6.517l-.549.091A1.875 1.875 0 002.25 11.078v.344c0 .917.663 1.699 1.567 1.85l.549.091c.281.047.518.238.6.517.055.157.116.311.181.463a.798.798 0 01-.074.798l-.324.453a1.875 1.875 0 00.2 2.416l.243.243c.648.648 1.67.712 2.416.2l.453-.324a.798.798 0 01.798-.074c.152.065.306.126.463.181.279.082.47.319.517.6l.091.549a1.875 1.875 0 001.85 1.567h.344c.917 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 01.517-.6c.157-.055.311-.116.463-.181a.798.798 0 01.798.074l.453.324a1.875 1.875 0 002.416-.2l.243-.243a1.875 1.875 0 00.2-2.416l-.324-.453a.798.798 0 01-.074-.798c.065-.152.126-.306.181-.463.082-.279.319-.47.6-.517l.549-.091a1.875 1.875 0 001.567-1.85v-.344a1.875 1.875 0 00-1.567-1.85l-.549-.091a.798.798 0 01-.6-.517 6.98 6.98 0 00-.181-.463.798.798 0 01.074-.798l.324-.453a1.875 1.875 0 00-.2-2.416l-.243-.243a1.875 1.875 0 00-2.416-.2l-.453.324a.798.798 0 01-.798.074 6.98 6.98 0 00-.463-.181.798.798 0 01-.517-.6l-.091-.549a1.875 1.875 0 00-1.85-1.567h-.344zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd"/>`,
            trending: `<path d="M3 17l6-6 4 4 8-8" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h6v6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
            dashes: `<line x1="5" y1="6.5" x2="19" y2="6.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><line x1="5" y1="17.5" x2="19" y2="17.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`,
            filter: `<path d="M3.5 5h17M6.5 12h11M10 19h4" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
            listDots: `<circle cx="4" cy="6" r="1.7"/><line x1="8" y1="6" x2="20" y2="6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="4" cy="12" r="1.7"/><line x1="8" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="4" cy="18" r="1.7"/><line x1="8" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
            close: `<path d="M5.47 5.47L18.53 18.53M18.53 5.47L5.47 18.53" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>`,
            home: `<path d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            briefcase: `<path d="M20.25 8.25v9a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-9M20.25 8.25A2.25 2.25 0 0018 6h-3V4.5A1.5 1.5 0 0013.5 3h-3A1.5 1.5 0 009 4.5V6H6a2.25 2.25 0 00-2.25 2.25M20.25 8.25v.373a4.505 4.505 0 01-1.988 3.737c-2.523 1.694-5.79 2.64-9.262 2.64s-6.74-.946-9.262-2.64A4.505 4.505 0 011.75 8.623V8.25M15 6V4.5A1.5 1.5 0 0013.5 3h-3A1.5 1.5 0 009 4.5V6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            book: `<path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            comment: `<path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            bell: `<path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            folder: `<path d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-19.5 0v6a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-6m-19.5 0V6.75A2.25 2.25 0 014.5 4.5h4.379a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H19.5a2.25 2.25 0 012.25 2.25v.75" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            edit: `<path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            bot: `<path d="M9.75 3v2.25M14.25 3v2.25M5.25 9.75h13.5M5.25 9.75A2.25 2.25 0 003 12v6a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-6a2.25 2.25 0 00-2.25-2.25M5.25 9.75V9a2.25 2.25 0 012.25-2.25h9A2.25 2.25 0 0118.75 9v.75M9 15.75h.008v.008H9v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM14.625 15.75h.008v.008h-.008v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            compass: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M15.3 8.7l-1.9 4.7-4.7 1.9 1.9-4.7 4.7-1.9z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>`,
            graduationCap: `<path d="M4.26 10.15a60.4 60.4 0 00-.49 6.34A48.6 48.6 0 0012 20.9a48.6 48.6 0 018.23-4.4 60.4 60.4 0 00-.49-6.35m-15.48 0a50.6 50.6 0 00-2.66-.82A59.9 59.9 0 0112 3.5a59.9 59.9 0 0110.4 5.83c-.9.25-1.78.52-2.66.82m-15.48 0A50.7 50.7 0 0112 13.49a50.7 50.7 0 017.74-3.34M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.67A55.4 55.4 0 0112 8.44" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
            bookStack: `<rect x="3" y="7.4" width="4.4" height="13.1" rx="0.9"/><rect x="9.1" y="5" width="4.4" height="15.5" rx="0.9"/><rect x="15" y="7.3" width="4.7" height="13.2" rx="0.9" transform="rotate(11 17.35 13.9)"/>`,
            user: `<path d="M12 12.5c2.9 0 5.25-2.35 5.25-5.25S14.9 2 12 2 6.75 4.35 6.75 7.25 9.1 12.5 12 12.5zm0 2.5c-3.87 0-9 1.94-9 5.25V22h18v-1.75c0-3.31-5.13-5.25-9-5.25z"/>`,
          };
          return `<svg viewBox="0 0 24 24" fill="currentColor" class="${cls}">${boldPaths[type] || ''}</svg>`;
        }

        // ---- Story bubble strip + viewer navigation ----
        function storyBubble(s){
          if (s.mine) {
            const hasGlimpse = (typeof myGlimpses !== 'undefined' && myGlimpses.length > 0);
            const mineRingBg = !hasGlimpse ? 'rgba(10,37,64,0.16)' : (myGlimpsesViewed ? '#d1d5db' : `linear-gradient(135deg, ${NAVY}, ${ROYAL})`);
            const openMine = hasGlimpse ? `viewMyGlimpse(${myGlimpses[0].id})` : 'openMyGlimpses()';
            return `
              <div class="flex flex-col items-center gap-1.5 flex-shrink-0 w-20">
                <div class="relative">
                  <button onclick="${openMine}" class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center" style="padding:3.5px;background:${mineRingBg};">
                    <div class="w-full h-full rounded-full overflow-hidden flex items-center justify-center border-2 border-white" style="color:${NAVY};background:rgba(10,37,64,0.14);">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : silhouetteIcon(s.icon,'w-9 h-9')}</div>
                  </button>
                  <button onclick="event.stopPropagation(); openMyGlimpses()" title="Add to your glimpse" class="absolute z-10 rounded-full flex items-center justify-center shadow" style="top:0;left:0;width:1.5rem;height:1.5rem;box-sizing:border-box;color:${NAVY};background:#ffffff;border:3px solid #ffffff;">${Icon('plus','w-3 h-3')}</button>
                </div>
                <button onclick="${openMine}" class="text-xs font-semibold text-gray-800 truncate w-20 text-center">${escapeHtml(s.name)}</button>
              </div>`;
          }
          const ringStyle = s.viewed ? 'padding:3.5px;background:#d1d5db;' : `padding:3.5px;background:linear-gradient(135deg, ${NAVY}, ${ROYAL});`;
          return `
            <button onclick="viewStory('${s.id}')" class="flex flex-col items-center gap-1.5 flex-shrink-0 w-20">
              <div class="w-20 h-20 rounded-full" style="${ringStyle}">
                <div class="w-full h-full rounded-full ${s.bg} flex items-center justify-center border-2 border-white overflow-hidden">${s.photo ? `<img src="${s.photo}" class="w-full h-full object-cover">` : silhouetteIcon(s.icon, 'w-9 h-9 ' + (s.iconClass||''))}</div>
              </div>
              <div class="text-xs font-semibold text-gray-800 truncate w-20 text-center">${escapeHtml(s.name)}</div>
            </button>`;
        }

        const STORY_ITEM_DURATION_MS = 4500;
        let currentStoryId = null;
        let currentItemIndex = 0;
        let storyTimer = null;
        let storyTypingTimeout = null;
        let activeSpeechRecognition = null;
        // ---- Voice recording for story replies ----
        function startMicRecording(opts){
          const micBtn = document.getElementById(opts.micBtnId);
          const inputEl = document.getElementById(opts.inputId);
          if (!micBtn) return;
          if (activeSpeechRecognition) { stopMicRecording(opts); return; }

          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          const setListening = (on) => {
            micBtn.classList.toggle('bg-red-500', on);
            micBtn.classList.toggle('text-white', on);
            micBtn.classList.toggle('bg-gray-100', !on);
            micBtn.classList.toggle('text-[' + NAVY + ']', !on);
            micBtn.style.animation = on ? 'pulse 1s infinite' : '';
            if (inputEl) inputEl.placeholder = on ? 'Listening...' : opts.defaultPlaceholder;
          };

          if (!SR) {
            setListening(true);
            if (inputEl) inputEl.placeholder = 'Voice input not supported here';
            setTimeout(() => setListening(false), 1800);
            return;
          }

          try {
            const recognition = new SR();
            recognition.lang = 'en-US';
            recognition.interimResults = true;
            recognition.continuous = false;
            activeSpeechRecognition = recognition;
            setListening(true);

            recognition.onresult = function(e){
              let transcript = '';
              for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
              if (inputEl) inputEl.value = transcript;
              if (opts.onInput) opts.onInput();
            };
            recognition.onerror = function(){ stopMicRecording(opts); };
            recognition.onend = function(){ stopMicRecording(opts); };
            recognition.start();
          } catch (err) {
            activeSpeechRecognition = null;
            setListening(false);
          }
        }

        function stopMicRecording(opts){
          if (activeSpeechRecognition) {
            try { activeSpeechRecognition.stop(); } catch (e) {}
            activeSpeechRecognition = null;
          }
          const micBtn = document.getElementById(opts.micBtnId);
          const inputEl = document.getElementById(opts.inputId);
          if (micBtn) {
            micBtn.classList.remove('bg-red-500', 'text-white');
            micBtn.classList.add('bg-gray-100', 'text-[' + NAVY + ']');
            micBtn.style.animation = '';
          }
          if (inputEl) inputEl.placeholder = opts.defaultPlaceholder;
        }

        let storyVoiceListening = false;
        let storyElapsedMs = 0;
        let storyRunStartedAt = 0;
        let storyPaused = false;

        function storyItems(s){
          return (s.items && s.items.length) ? s.items : [{ caption: s.caption, icon: s.icon, iconClass: s.iconClass }];
        }

        function reorderStoriesByViewed(){
          const mineList = stories.filter(s => s.mine);
          const others = stories.filter(s => !s.mine);
          others.sort((a, b) => (a.viewed === b.viewed) ? 0 : (a.viewed ? 1 : -1));
          stories = [...mineList, ...others];
        }

        function viewStory(id){
          const s = stories.find(x => x.id === id);
          s.viewed = true;
          if (!s.mine) persistGlimpseViewed(s);
          reorderStoriesByViewed();
          const bubble = document.getElementById('story-strip');
          if (bubble) bubble.innerHTML = stories.map(storyBubble).join('');
          currentStoryId = id;
          currentItemIndex = 0;
          openStoryOverlay(s);
        }

        function openStoryOverlay(s){
          // Opening a glimpse (story) sits on top of the home feed -- pause any
          // feed post video that's autoplaying underneath so it doesn't keep
          // playing (and making sound) in the background while the glimpse is
          // open. Without this, the feed video's own scroll position never
          // changes (the page behind the overlay doesn't scroll), so nothing
          // else would ever stop it.
          if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = storyViewerHTML(s, currentItemIndex);
          startStoryTimer(s);
          if (!s.mine && s.items && s.items[currentItemIndex] && s.items[currentItemIndex].id != null) {
            glimpseViewRemote(s.items[currentItemIndex].id);
          }
        }

        function startStoryTimer(s){
          storyElapsedMs = 0;
          resumeStoryTimer(s);
        }

        function resumeStoryTimer(s){
          clearStoryTimer();
          storyPaused = false;
          const remaining = Math.max(0, STORY_ITEM_DURATION_MS - storyElapsedMs);
          storyRunStartedAt = Date.now();
          const fill = document.getElementById('story-fill-' + currentItemIndex);
          if (fill) {
            const startPct = Math.min(100, (storyElapsedMs / STORY_ITEM_DURATION_MS) * 100);
            fill.style.transition = 'none';
            fill.style.width = startPct + '%';
            void fill.offsetWidth; 
            fill.style.transition = `width ${remaining}ms linear`;
            fill.style.width = '100%';
          }
          storyTimer = setTimeout(() => advanceStory(s, 1), remaining);
        }

        function pauseStoryTimer(){
          if (storyPaused) return;
          storyPaused = true;
          storyElapsedMs = Math.min(STORY_ITEM_DURATION_MS, storyElapsedMs + (Date.now() - storyRunStartedAt));
          clearStoryTimer();
          const fill = document.getElementById('story-fill-' + currentItemIndex);
          if (fill) {
            const pct = Math.min(100, (storyElapsedMs / STORY_ITEM_DURATION_MS) * 100);
            fill.style.transition = 'none';
            fill.style.width = pct + '%';
          }
        }

        function resumeCurrentStoryTimer(){
          if (!storyPaused) return;
          const s = stories.find(x => x.id === currentStoryId);
          if (s) resumeStoryTimer(s);
        }

        function clearStoryTimer(){
          if (storyTimer) { clearTimeout(storyTimer); storyTimer = null; }
        }

        function advanceStory(s, dir){
          const items = storyItems(s);
          const nextIndex = currentItemIndex + dir;
          if (nextIndex < 0) {
            goToAdjacentStory(dir);
            return;
          }
          if (nextIndex >= items.length) {
            goToAdjacentStory(dir);
            return;
          }
          currentItemIndex = nextIndex;
          openStoryOverlay(s);
        }

        function goToAdjacentStory(dir){
          if (currentStoryId === null) { closeOverlay(); return; }
          const viewable = stories.filter(x => !x.mine);
          const idx = viewable.findIndex(x => x.id === currentStoryId);
          const nextStory = viewable[idx + dir];
          if (!nextStory) { closeOverlay(); return; }
          nextStory.viewed = true;
          if (!nextStory.mine) persistGlimpseViewed(nextStory);
          reorderStoriesByViewed();
          const bubble = document.getElementById('story-strip');
          if (bubble) bubble.innerHTML = stories.map(storyBubble).join('');
          currentStoryId = nextStory.id;
          currentItemIndex = dir < 0 ? storyItems(nextStory).length - 1 : 0;
          openStoryOverlay(nextStory);
        }

        function storyTapNext(){
          const s = stories.find(x => x.id === currentStoryId);
          if (s) advanceStory(s, 1);
        }
        function storyTapPrev(){
          const s = stories.find(x => x.id === currentStoryId);
          if (s) advanceStory(s, -1);
        }

        const STORY_TAP_MAX_MS = 250;
        let storyPressStartedAt = 0;
        function storyPressStart(e){
          if (e && e.cancelable) e.preventDefault();
          storyPressStartedAt = Date.now();
          pauseStoryTimer();
        }
        function storyPressEnd(e, dir){
          if (e && e.cancelable) e.preventDefault();
          const heldMs = Date.now() - storyPressStartedAt;
          if (heldMs < STORY_TAP_MAX_MS) {
            if (dir === 'prev') storyTapPrev(); else storyTapNext();
          } else {
            resumeCurrentStoryTimer();
          }
        }
        function storyPressCancel(){
          resumeCurrentStoryTimer();
        }

        function findConvoRecord(name){
          for (const arr of convoArrays()) {
            const exact = arr.find(c => c.name === name);
            if (exact) return exact;
          }
          const firstName = name.split(' ')[0];
          for (const arr of convoArrays()) {
            const partial = arr.find(c => c.name.split(' ')[0] === firstName);
            if (partial) return partial;
          }
          return null;
        }

        function ensureConvoForStory(s){
          let convo = findConvoRecord(s.name);
          if (!convo) {
            convo = { id: 'story-' + s.id, icon: s.icon || 'user', avatarBg: s.bg || 'bg-gray-100', name: s.name, preview: '', time: 'now', unread: false };
            primaryConvos.unshift(convo);
          }
          if (!convoMeta[convo.id]) convoMeta[convo.id] = { icon: convo.icon, avatarBg: convo.avatarBg, name: convo.name, preview: convo.preview };
          if (!conversationMessages[convo.id]) conversationMessages[convo.id] = [];
          return convo;
        }

        function bumpConvoToTop(convo){
          for (const arr of convoArrays()) {
            const idx = arr.indexOf(convo);
            if (idx > 0) { arr.splice(idx, 1); arr.unshift(convo); }
          }
        }

        function autoGrowStoryReply(el){
          el.style.height = 'auto';
          const maxH = 104; 
          const newH = Math.min(el.scrollHeight, maxH);
          el.style.height = newH + 'px';
          el.style.borderRadius = el.scrollHeight > 40 ? '1.25rem' : '9999px';
        }

        function updateStoryReplySendIcon(){
          const input = document.getElementById('story-reply-input');
          const btn = document.getElementById('story-send-btn');
          if (!input || !btn) return;
          const hasText = input.value.trim().length > 0;
          btn.innerHTML = Icon(hasText ? 'send' : 'mic', 'w-4 h-4');
        }

        function storyReplyPrimaryAction(){
          const input = document.getElementById('story-reply-input');
          const hasText = input && input.value.trim().length > 0;
          if (hasText) storySendMessage(); else toggleStoryVoiceInput();
        }

        function toggleStoryVoiceInput(){
          const btn = document.getElementById('story-send-btn');
          const input = document.getElementById('story-reply-input');
          if (!btn || storyVoiceListening) return;
          storyVoiceListening = true;
          btn.classList.remove('bg-[' + NAVY + ']');
          startMicRecording({
            micBtnId: 'story-send-btn',
            inputId: 'story-reply-input',
            defaultPlaceholder: 'Send message',
            onInput: () => { if (input) autoGrowStoryReply(input); updateStoryReplySendIcon(); }
          });
          const finish = () => {
            storyVoiceListening = false;
            btn.classList.remove('bg-gray-100', 'text-[' + NAVY + ']', 'bg-red-500', 'text-white');
            btn.classList.add('bg-[' + NAVY + ']', 'text-white');
            if (input) autoGrowStoryReply(input);
            updateStoryReplySendIcon();
          };
          const checkDone = setInterval(() => {
            if (!activeSpeechRecognition) { clearInterval(checkDone); finish(); }
          }, 200);
        }

        function handleStoryReplyFileSelect(event){
          const files = Array.from(event.target.files || []);
          event.target.value = '';
          if (!files.length) return;
          const s = stories.find(x => x.id === currentStoryId);
          if (!s) return;
          const convo = ensureConvoForStory(s);
          files.forEach(f => {
            const emoji = f.type && f.type.startsWith('image/') ? '📷' : (f.type && f.type.startsWith('video/') ? '🎞️' : '📎');
            conversationMessages[convo.id].push({ from: 'me', text: `${emoji} ${escapeHtml(f.name)}` });
          });
          const summary = files.length > 1 ? `${files.length} files sent` : `Sent ${files[0].name}`;
          convo.preview = summary;
          convo.time = 'now';
          convo.unread = false;
          bumpConvoToTop(convo);
          const input = document.getElementById('story-reply-input');
          if (input) {
            const prevPlaceholder = input.placeholder;
            input.placeholder = summary + '!';
            setTimeout(() => { if (input) input.placeholder = prevPlaceholder === 'Listening...' ? 'Send message' : prevPlaceholder; }, 1500);
          }
        }

        function handleStoryReplyTyping(){
          pauseStoryTimer();
          const input = document.getElementById('story-reply-input');
          if (input) autoGrowStoryReply(input);
          updateStoryReplySendIcon();
        }
        function handleStoryReplyBlur(){
          resumeCurrentStoryTimer();
        }

        function storyLiked(){
          const s = stories.find(x => x.id === currentStoryId);
          if (!s) return;
          const item = storyItems(s)[currentItemIndex];
          item.liked = !item.liked;
          const btn = document.getElementById('story-like-btn');
          if (btn) {
            btn.innerHTML = Icon(item.liked ? 'heart' : 'heartOutline', 'w-5 h-5');
            btn.classList.toggle('text-white', !item.liked);
            btn.classList.toggle('text-red-500', item.liked);
          }
          if (item.liked) {
            const convo = ensureConvoForStory(s);
            conversationMessages[convo.id].push({ from: 'me', text: '❤️ Liked your glimpse' });
            convo.preview = 'You liked their glimpse';
            convo.time = 'now';
            convo.unread = false;
            bumpConvoToTop(convo);
          }
        }

        function storySendMessage(){
          const input = document.getElementById('story-reply-input');
          const text = input ? input.value.trim() : '';
          if (!text) return;
          const s = stories.find(x => x.id === currentStoryId);
          if (s) {
            const convo = ensureConvoForStory(s);
            conversationMessages[convo.id].push({ from: 'me', text });
            convo.preview = text;
            convo.time = 'now';
            convo.unread = false;
            bumpConvoToTop(convo);
          }
          if (input) {
            input.value = '';
            input.style.height = 'auto';
            input.style.borderRadius = '9999px';
            input.placeholder = 'Sent!';
            setTimeout(() => { if (input) input.placeholder = 'Send message'; }, 1200);
          }
          updateStoryReplySendIcon();
          if (storyTypingTimeout) { clearTimeout(storyTypingTimeout); storyTypingTimeout = null; }
          resumeCurrentStoryTimer();
        }

        function storyViewerHTML(s, itemIndex){
          const items = storyItems(s);
          const idx = itemIndex || 0;
          const item = items[idx] || items[0];
          const icon = item.icon || s.icon;
          const iconClass = item.iconClass || s.iconClass;
          const segments = items.map((it, i) => `
            <div class="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div id="story-fill-${i}" class="h-full bg-white" style="width:${i < idx ? '100%' : '0%'};"></div>
            </div>`).join('');
          return `
            <div class="flex flex-col h-full bg-black text-white" style="padding-top:var(--top-safe-pad);">
              <div class="flex items-center justify-between px-4 flex-shrink-0">
                <button onclick="storyTapNext()" class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full border-2 border-white/60 flex items-center justify-center overflow-hidden" style="background:transparent;">${(s.mine && profileData.photo) ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : (!s.mine && s.photo) ? `<img src="${s.photo}" class="w-full h-full object-cover">` : silhouetteIcon(icon, 'w-4 h-4 ' + (iconClass||''))}</div>
                  <div class="text-lg font-semibold">${escapeHtml(s.name)}</div>
                  <div class="text-sm text-white/60">2h</div>
                </button>
                <button onclick="closeOverlay()">${IconBold('close','w-6 h-6')}</button>
              </div>
              <div class="flex gap-1.5 px-3 pt-3 pb-1 flex-shrink-0">${segments}</div>
              <div class="flex-1 relative">
                ${item.mediaUrl ? `
                  <div class="absolute inset-0 flex items-center justify-center bg-black pointer-events-none">
                    ${item.mediaType === 'video'
                      ? `<video src="${item.mediaUrl}" class="max-w-full max-h-full" autoplay playsinline loop oncontextmenu="return false" style="-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;" ${glimpseVideoAttrs(item.trimStart, item.trimEnd)}></video>`
                      : `<img src="${item.mediaUrl}" class="max-w-full max-h-full object-contain" draggable="false" oncontextmenu="return false" style="-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;">`}
                  </div>
                  ${item.caption ? `
                    <div class="absolute left-0 right-0 px-6 py-3 text-sm text-white text-center pointer-events-none" style="bottom:5.5rem;background:linear-gradient(to top, rgba(0,0,0,0.55), transparent);">${escapeHtml(item.caption)}</div>
                  ` : ''}
                ` : `
                <div class="absolute inset-0 flex items-center justify-center px-8 text-center pointer-events-none">
                  <div>
                    <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">${silhouetteIcon(icon, 'w-10 h-10 ' + (iconClass||''))}</div>
                    <div class="text-lg font-medium">${escapeHtml(item.caption)}</div>
                  </div>
                </div>
                `}
                <div class="absolute inset-0 flex">
                  <button onpointerdown="storyPressStart(event)" onpointerup="storyPressEnd(event,'prev')" onpointercancel="storyPressCancel()" onpointerleave="storyPressCancel()" class="h-full" style="width:50%;" aria-label="Previous glimpse"></button>
                  <button onpointerdown="storyPressStart(event)" onpointerup="storyPressEnd(event,'next')" onpointercancel="storyPressCancel()" onpointerleave="storyPressCancel()" class="h-full" style="width:50%;" aria-label="Next glimpse"></button>
                </div>
                <div class="absolute bottom-0 px-4 py-4 flex items-end justify-center gap-2" style="left:0;right:0;padding-bottom:calc(env(safe-area-inset-bottom, 12px) + 12px);">
                  <input type="file" id="story-reply-file-input" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx" multiple class="hidden" onchange="handleStoryReplyFileSelect(event)">
                  <button onclick="document.getElementById('story-reply-file-input').click()" title="Attach a file" class="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white" style="background:#1f2937;border:1px solid #374151;">${Icon('paperclip','w-4 h-4')}</button>
                  <textarea id="story-reply-input" rows="1" placeholder="Send message" oninput="handleStoryReplyTyping()" onfocus="pauseStoryTimer()" onblur="handleStoryReplyBlur()" class="flex-1 min-w-0 text-sm text-white placeholder-gray-300" style="background:#1f2937;border:1px solid #374151;outline:none;resize:none;padding:0.5rem 0.875rem;border-radius:9999px;max-height:6.5rem;overflow-y:auto;line-height:1.3;"></textarea>
                  <button id="story-send-btn" onclick="storyReplyPrimaryAction()" class="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white bg-[${NAVY}]">${Icon('mic','w-4 h-4')}</button>
                </div>
              </div>
            </div>`;
        }

        const GLIMPSES_TABLE = 'glimpses';
        const GLIMPSE_VIEWS_TABLE = 'glimpse_views';

        async function glimpseInsertRemote(glimpse){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data: userRes } = await sb.auth.getUser();
            const user = userRes && userRes.user;
            if (!user) return false;
            const { error } = await sb.from(GLIMPSES_TABLE).insert({
              id: String(glimpse.id),
              user_id: user.id,
              data: glimpse,
            });
            return !error;
          } catch (e) { return false; }
        }

        async function glimpseDeleteRemote(id){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(GLIMPSES_TABLE).delete().eq('id', String(id));
            return !error;
          } catch (e) { return false; }
        }

        const viewedGlimpsesThisSession = new Set();
        async function glimpseViewRemote(glimpseId){
          const key = String(glimpseId);
          if (viewedGlimpsesThisSession.has(key)) return false;
          viewedGlimpsesThisSession.add(key);
          const sb = getSupabaseClient();
          const userId = await getCurrentUserId();
          if (!sb || !userId) return false;
          try {
            const { error } = await sb.from(GLIMPSE_VIEWS_TABLE)
              .upsert({ glimpse_id: key, user_id: userId }, { onConflict: 'glimpse_id,user_id', ignoreDuplicates: true });
            return !error;
          } catch (e) { return false; }
        }

        let remoteGlimpsesLoaded = false;

        async function loadRemoteGlimpses(){
          const sb = getSupabaseClient();
          if (!sb) { remoteGlimpsesLoaded = true; return false; }
          try {
            const { data: userRes } = await sb.auth.getUser();
            const me = userRes && userRes.user;
            const cutoffIso = new Date(Date.now() - GLIMPSE_LIFETIME_MS).toISOString();
            const { data, error } = await sb.from(GLIMPSES_TABLE)
              .select('id, user_id, data, created_at')
              .gte('created_at', cutoffIso)
              .order('created_at', { ascending: true });
            remoteGlimpsesLoaded = true;
            if (error || !data) return false;

            const rows = data.filter(row => !me || row.user_id !== me.id);
            const otherIdsBefore = stories.filter(s => !s.mine).map(s => String(s.id)).sort().join(',');
            if (!rows.length) {
              stories = stories.filter(s => s.mine);
              return otherIdsBefore !== '';
            }
            const authorIds = [...new Set(rows.map(r => r.user_id))];
            const { data: profiles } = await sb.from(PUBLIC_PROFILES_TABLE).select('*').in('user_id', authorIds);
            const profileById = {};
            (profiles || []).forEach(p => { profileById[p.user_id] = p; });

            const byAuthor = {};
            rows.forEach(row => {
              (byAuthor[row.user_id] = byAuthor[row.user_id] || []).push({
                id: row.id,
                ...row.data,
              });
            });

            const previouslyViewed = {};
            stories.forEach(s => {
              if (s.mine) return;
              previouslyViewed[s.id] = {
                viewed: !!s.viewed,
                newestId: (s.items && s.items.length) ? Math.max(...s.items.map(it => it.id || 0)) : 0,
              };
            });
            const persistedViewed = loadPersistedViewedGlimpses();
            const remoteStories = Object.keys(byAuthor).map(userId => {
              const profile = profileById[userId];
              const items = byAuthor[userId];
              const first = items[0];
              const newestId = Math.max(...items.map(it => it.id || 0));
              const inMemory = previouslyViewed[userId];
              const persisted = persistedViewed[userId];
              const viewed = (!!inMemory && inMemory.viewed && inMemory.newestId >= newestId)
                || (!!persisted && persisted.newestId >= newestId);
              return {
                id: userId,
                name: (profile && (profile.name || profile.username)) || 'Stitch member',
                icon: first.icon || 'user',
                bg: profile && profile.photo ? '' : 'bg-blue-50',
                photo: (profile && profile.photo) || null,
                otherUserId: userId,
                items,
                viewed,
                mine: false,
              };
            });
            stories = [...stories.filter(s => s.mine), ...remoteStories];
            reorderStoriesByViewed();
            const otherIdsAfter = remoteStories.map(s => String(s.id)).sort().join(',');
            return otherIdsAfter !== otherIdsBefore;
          } catch (e) { remoteGlimpsesLoaded = true; return false; }
        }

        let myGlimpses = [];
        let myGlimpsesViewed = false;
        let openMyGlimpseMenuId = null;

        // ---- Glimpses (stories) persistence + viewed tracking ----
        function myGlimpseViewedStorageKey(){
          const uid = (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
          return uid ? `my-glimpse-viewed-v1:${uid}` : null;
        }
        function persistMyGlimpsesViewed(){
          try {
            const key = myGlimpseViewedStorageKey();
            if (!key) return;
            const newestId = myGlimpses.length ? Math.max(...myGlimpses.map(g => g.id || 0)) : 0;
            localStorage.setItem(key, String(newestId));
          } catch (e) {  }
        }
        function syncMyGlimpsesViewedFromStorage(){
          try {
            const key = myGlimpseViewedStorageKey();
            if (!key || !myGlimpses.length) { myGlimpsesViewed = false; return; }
            const stored = parseInt(localStorage.getItem(key) || '0', 10);
            const newestId = Math.max(...myGlimpses.map(g => g.id || 0));
            myGlimpsesViewed = stored >= newestId;
          } catch (e) { myGlimpsesViewed = false; }
        }

        const GLIMPSE_LIFETIME_MS = 24 * 60 * 60 * 1000;

        function glimpsesViewedStorageKey(){
          const uid = (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
          return uid ? `glimpses-viewed-v1:${uid}` : null;
        }

        function loadPersistedViewedGlimpses(){
          try {
            const key = glimpsesViewedStorageKey();
            if (!key) return {};
            const raw = localStorage.getItem(key);
            const map = raw ? (JSON.parse(raw) || {}) : {};
            const cutoff = Date.now() - GLIMPSE_LIFETIME_MS;
            let changed = false;
            Object.keys(map).forEach(id => {
              const entry = (map[id] && typeof map[id] === 'object') ? map[id] : { newestId: 0, ts: map[id] };
              if (!(entry.ts > cutoff)) { delete map[id]; changed = true; }
              else { map[id] = entry; }
            });
            if (changed) { try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) {  } }
            return map;
          } catch (e) { return {}; }
        }

        function persistGlimpseViewed(story){
          try {
            const key = glimpsesViewedStorageKey();
            if (!key) return;
            const authorId = story && story.id;
            if (authorId == null) return;
            const newestId = (story.items && story.items.length) ? Math.max(...story.items.map(it => it.id || 0)) : 0;
            const map = loadPersistedViewedGlimpses();
            map[authorId] = { newestId, ts: Date.now() };
            localStorage.setItem(key, JSON.stringify(map));
          } catch (e) {  }
        }

        function purgeExpiredGlimpses(){
          const cutoff = Date.now() - GLIMPSE_LIFETIME_MS;
          const before = myGlimpses.length;
          myGlimpses = myGlimpses.filter(g => (g.createdAt || g.id || 0) > cutoff);
          const changed = myGlimpses.length !== before;
          if (changed) queueSaveUserState();
          return changed;
        }

        function glimpseComposeBg(){
          return document.body.classList.contains('dark-mode') ? '#000000' : '#ffffff';
        }
        const GLIMPSE_COMPOSE_FONTS = [
          "'Montserrat', system-ui, -apple-system, sans-serif",
          "'Colmeak', 'Montserrat', sans-serif",
          "Georgia, 'Times New Roman', serif",
          "'Courier New', Courier, monospace",
          "'Brush Script MT', cursive",
        ];
        const GLIMPSE_COMPOSE_FONT_SIZE = '1.5rem';
        let glimpseComposeText = '';
        let glimpseComposeFontIndex = 0;

        // ---- My Glimpses screen (own stories + viewers) ----
        function openMyGlimpses(){
          purgeExpiredGlimpses();
          // Pause any feed post video autoplaying underneath before showing
          // this glimpse overlay (see openStoryOverlay for the same fix).
          if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = myGlimpsesHTML();
        }

        function refreshMyGlimpses(){
          purgeExpiredGlimpses();
          const ov = document.getElementById('overlay');
          if (ov && !ov.classList.contains('hidden')) ov.innerHTML = myGlimpsesHTML();
        }

        function myGlimpsesHTML(){
          return `
            <div class="flex flex-col h-full bg-white relative">
              <div class="flex items-center gap-4 px-4 pb-4 border-b border-gray-100 flex-shrink-0 bg-white" style="padding-top:var(--top-safe-pad);">
                <button onclick="closeOverlay()" style="color:${NAVY};">${IconBold('close','w-5 h-5')}</button>
                <div class="text-xl font-bold font-display" style="color:${NAVY};">My glimpse</div>
              </div>
              <div class="flex-1 overflow-y-auto">
                ${myGlimpses.length === 0 ? `
                  <div class="px-6 py-16 text-center text-gray-400 text-sm">No glimpses yet.<br>Tap "Add glimpse" below to share a photo or video.</div>
                ` : myGlimpses.map(myGlimpseRow).join('')}
                <div class="px-6 pt-2 pb-4 flex justify-center">
                  <button type="button" onclick="composeGlimpseMedia()" class="flex items-center justify-center gap-2.5 rounded-full px-8 py-3 min-w-[200px]" style="color:${NAVY};background:rgba(10,37,64,0.08);cursor:pointer;">
                    ${Icon('addGlimpseOutline','w-5 h-5')}
                    <span class="text-sm font-semibold">Add glimpse</span>
                  </button>
                </div>
                <div class="px-6 pb-6 text-center text-xs text-gray-400 leading-relaxed">
                  Your glimpses are private to your Stitch network and disappear after 24 hours.
                </div>
              </div>
            </div>`;
        }

        function myGlimpseRow(g){
          return `
            <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 relative" id="glimpse-row-${g.id}">
              <div class="rounded-full flex items-center justify-center text-white overflow-hidden flex-shrink-0" style="width:3.5rem;height:3.5rem;${g.bgStyle}">${g.mediaType === 'image' ? `<img src="${g.mediaUrl}" class="w-full h-full object-cover">` : g.mediaType === 'video' ? `<video src="${g.mediaUrl}" class="w-full h-full object-cover" muted ${glimpseVideoAttrs(g.trimStart, g.trimEnd)}></video>` : silhouetteIcon(g.icon,'w-6 h-6')}</div>
              <button onclick="viewMyGlimpse(${g.id})" class="flex-1 min-w-0 text-left">
                <div class="text-[15px] font-semibold text-gray-800">${g.timeLabel}</div>
              </button>
              <button onclick="toggleMyGlimpseMenu(${g.id})" class="w-8 h-8 flex items-center justify-center text-gray-400 flex-shrink-0">${IconBold('dots','w-5 h-5')}</button>
              <div id="glimpse-menu-${g.id}">${openMyGlimpseMenuId === g.id ? glimpseRowMenuHTML(g) : ''}</div>
            </div>`;
        }

        function glimpseRowMenuHTML(g){
          return `
            <div onclick="toggleMyGlimpseMenu(${g.id})" onwheel="toggleMyGlimpseMenu(${g.id})" ontouchmove="toggleMyGlimpseMenu(${g.id})" class="fixed inset-0 z-10"></div>
            <div class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:2.75rem;top:2.75rem;width:11rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              <button onclick="toggleMyGlimpseMenu(${g.id}); openShareGlimpse(${g.id});" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('send','w-4 h-4')} Share glimpse</button>
              <button onclick="deleteMyGlimpse(${g.id})" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete glimpse</button>
            </div>`;
        }

        function toggleMyGlimpseMenu(id){
          const prevId = openMyGlimpseMenuId;
          openMyGlimpseMenuId = (openMyGlimpseMenuId === id) ? null : id;
          [id, prevId].forEach(gid => {
            if (gid === null) return;
            const menuEl = document.getElementById('glimpse-menu-' + gid);
            const g = myGlimpses.find(x => x.id === gid);
            if (menuEl && g) menuEl.innerHTML = openMyGlimpseMenuId === gid ? glimpseRowMenuHTML(g) : '';
          });
          const ov = document.getElementById('overlay');
          attachMenuScrollCloser(ov ? ov.querySelector('.overflow-y-auto') : null, openMyGlimpseMenuId === id, () => toggleMyGlimpseMenu(id));
        }

        function viewMyGlimpse(id){
          const g = myGlimpses.find(x => x.id === id);
          if (!g) return;
          currentStoryId = null;
          currentItemIndex = 0;
          myGlimpseViewersOpen = false;
          myGlimpsesViewed = true;
          persistMyGlimpsesViewed();
          refreshStoryStrip();
          // Pause any feed post video autoplaying underneath before showing
          // this glimpse overlay (see openStoryOverlay for the same fix).
          if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = myGlimpseViewerHTML(g);
          loadGlimpseViewers(g);
        }

        async function loadGlimpseViewers(g){
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { data: rows, error } = await sb.from(GLIMPSE_VIEWS_TABLE)
              .select('user_id, created_at').eq('glimpse_id', String(g.id))
              .order('created_at', { ascending: false });
            if (error || !rows || !rows.length) return;
            const viewerIds = rows.map(r => r.user_id);
            const { data: profiles } = await sb.from(PUBLIC_PROFILES_TABLE).select('*').in('user_id', viewerIds);
            const profileById = {};
            (profiles || []).forEach(p => { profileById[p.user_id] = p; });
            g.viewers = rows.map(r => {
              const p = profileById[r.user_id];
              return {
                name: (p && (p.name || p.username)) || 'Stitch member',
                icon: 'user',
                avatarBg: 'bg-blue-50',
                viewedLabel: formatRequestTime(r.created_at),
              };
            });
            const panelEl = document.getElementById('glimpse-viewers-panel-' + g.id);
            if (panelEl && currentStoryId === null) panelEl.innerHTML = glimpseViewersPanelHTML(g);
          } catch (e) {  }
        }

        let myGlimpseViewersOpen = false;

        function toggleMyGlimpseViewers(id){
          myGlimpseViewersOpen = !myGlimpseViewersOpen;
          const g = myGlimpses.find(x => x.id === id);
          if (!g) return;
          const panelEl = document.getElementById('glimpse-viewers-panel-' + id);
          if (panelEl) panelEl.innerHTML = glimpseViewersPanelHTML(g);
        }

        function myGlimpseViewerHTML(g){
          const isLightGlimpse = !g.mediaUrl && g.bgStyle && g.bgStyle.indexOf('#ffffff') !== -1;
          const fg = isLightGlimpse ? '#0a2540' : '#ffffff';
          const avatarBg = isLightGlimpse ? 'rgba(10,37,64,0.10)' : 'rgba(255,255,255,0.16)';
          return `
            <div class="flex flex-col h-full relative" style="color:${fg};${g.mediaUrl ? 'background:#000;' : g.bgStyle}">
              <div class="absolute inset-0 flex items-center justify-center ${g.mediaUrl ? 'bg-black' : ''} pointer-events-none">
                ${g.mediaUrl ? `
                  ${g.mediaType === 'video'
                    ? `<video src="${g.mediaUrl}" class="max-w-full max-h-full" autoplay playsinline loop oncontextmenu="return false" style="-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;" ${glimpseVideoAttrs(g.trimStart, g.trimEnd)}></video>`
                    : `<img src="${g.mediaUrl}" class="max-w-full max-h-full object-contain" draggable="false" oncontextmenu="return false" style="-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;">`}
                ` : `
                  <div class="px-8 text-center">
                    <div class="text-lg font-medium" style="color:${fg};">${escapeHtml(g.caption)}</div>
                  </div>
                `}
              </div>
              <div class="relative flex items-center gap-3 px-4 flex-shrink-0" style="padding-top:var(--top-safe-pad);">
                <button onclick="openMyGlimpses()" class="flex-shrink-0" style="color:${fg};">${IconBold('back','w-5 h-5')}</button>
                <div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style="background:${avatarBg};color:${fg};">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : silhouetteIcon(g.icon,'w-4 h-4')}</div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold truncate">My glimpse</div>
                  <div class="text-xs" style="color:${fg};opacity:0.6;">${g.timeLabel}</div>
                </div>
              </div>
              ${g.caption && g.mediaUrl ? `
                <div class="relative px-6 py-3 text-sm text-white text-center" style="margin-top:auto;background:linear-gradient(to top, rgba(0,0,0,0.55), transparent);">${escapeHtml(g.caption)}</div>
              ` : ''}
              <div id="glimpse-viewers-panel-${g.id}" class="absolute inset-0" style="pointer-events:none;">${glimpseViewersPanelHTML(g)}</div>
            </div>`;
        }

        function glimpseViewersPanelHTML(g){
          const viewers = g.viewers || [];
          const open = myGlimpseViewersOpen;
          // Pinned to the real bottom of the screen via absolute
          // positioning instead of a flex margin-top:auto -- the wrapping
          // #glimpse-viewers-panel div around this (see myGlimpseViewerHTML)
          // isn't itself a flex item of the outer column, so margin-auto
          // on a descendant inside it had no container to push against and
          // the pill just sat wherever it fell in normal document flow,
          // right under the header.
          const hasCaptionBar = g.caption && g.mediaUrl;
          return `
              <div class="absolute left-4 flex items-center" style="bottom:calc(env(safe-area-inset-bottom, 16px) + ${hasCaptionBar ? '4.5rem' : '16px'});pointer-events:auto;">
                <button onclick="toggleMyGlimpseViewers(${g.id})" class="flex items-center gap-2 rounded-full pl-3 pr-4 py-2 text-white" style="background:rgba(0,0,0,0.45);color:#ffffff;">
                  ${Icon(open ? 'eyeOff' : 'eye', 'w-5 h-5')}
                  <span class="text-sm font-semibold">${viewers.length}</span>
                </button>
              </div>
              ${open ? `
                <div onclick="toggleMyGlimpseViewers(${g.id})" class="absolute inset-0 z-10" style="background:rgba(0,0,0,0.35);pointer-events:auto;"></div>
                <div class="absolute left-0 right-0 bottom-0 z-20 bg-white text-gray-900 overflow-y-auto" style="border-top-left-radius:1.5rem;border-top-right-radius:1.5rem;max-height:60vh;padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);pointer-events:auto;">
                  <div class="flex justify-center pt-2.5 pb-1"><div class="w-9 h-1 rounded-full bg-gray-300"></div></div>
                  <div class="px-5 pb-2" style="padding-top:0.5rem;">
                    <div class="text-base font-bold font-display">Viewed by ${viewers.length}</div>
                  </div>
                  ${viewers.length === 0 ? `
                    <div class="px-6 text-center text-gray-400 text-sm" style="padding-top:2.5rem;padding-bottom:2.5rem;">No views yet.</div>
                  ` : viewers.map(glimpseViewerRow).join('')}
                </div>
              ` : ''}`;
        }

        function glimpseViewerRow(v){
          const safeName = escapeForJsAttr(v.name);
          return `
            <div class="flex items-center gap-3 px-5 py-2.5">
              <div class="w-11 h-11 rounded-full ${v.avatarBg} flex items-center justify-center text-gray-600 flex-shrink-0">${Icon(v.icon,'w-5 h-5')}</div>
              <div class="min-w-0 flex-1">
                <div class="text-[15px] font-semibold text-gray-800 truncate">${escapeHtml(v.name)}</div>
                <div class="text-xs text-gray-400">${v.viewedLabel}</div>
              </div>
              <button onclick="replyToGlimpseViewer('${safeName}','${v.icon}','${v.avatarBg}')" title="Reply" class="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0" style="background:#f3f4f6;">${Icon('comment','w-4 h-4')}</button>
            </div>`;
        }

        // ---- Replying to a glimpse viewer ----
        function ensureConvoForPerson(name, icon, avatarBg){
          let convo = findConvoRecord(name);
          if (!convo) {
            convo = { id: 'glimpse-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), icon: icon || 'user', avatarBg: avatarBg || 'bg-gray-100', name, preview: '', time: 'now', unread: false };
            primaryConvos.unshift(convo);
          }
          if (!convoMeta[convo.id]) convoMeta[convo.id] = { icon: convo.icon, avatarBg: convo.avatarBg, name: convo.name, preview: convo.preview };
          if (!conversationMessages[convo.id]) conversationMessages[convo.id] = [];
          return convo;
        }

        function replyToGlimpseViewer(name, icon, avatarBg){
          const convo = ensureConvoForPerson(name, icon, avatarBg);
          openConversation(convo.id);
        }

        // ---- Glimpse composer (text) ----
        function composeGlimpseText(){
          glimpseComposeText = '';
          glimpseComposeFontIndex = 0;
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = glimpseComposeHTML();
          const el = document.getElementById('glimpse-compose-input');
          if (el) el.focus();
        }

        function glimpseComposeHTML(){
          const bg = glimpseComposeBg();
          const isLight = bg === '#ffffff';
          const fg = isLight ? '#0a2540' : '#ffffff';
          const btnBg = isLight ? 'rgba(10,37,64,0.10)' : 'rgba(255,255,255,0.18)';
          const placeholderColor = isLight ? 'rgba(10,37,64,0.45)' : 'rgba(255,255,255,0.6)';
          const hasText = glimpseComposeText.trim().length > 0;
          return `
            <style>#glimpse-compose-input::placeholder{color:${placeholderColor};}</style>
            <div id="glimpse-compose-screen" class="flex flex-col h-full" style="background:${bg}; color:${fg};">
              <div class="flex items-center justify-between px-4 flex-shrink-0" style="padding-top:var(--top-safe-pad);">
                <button onclick="closeGlimpseCompose()" class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:${btnBg}; color:${fg};">${IconBold('close','w-5 h-5')}</button>
                <button onclick="cycleGlimpseComposeFont()" title="Font" class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0" style="background:${btnBg}; color:${fg};">Aa</button>
              </div>
              <div class="flex-1 flex items-center justify-center px-8 overflow-y-auto">
                <textarea id="glimpse-compose-input" oninput="handleGlimpseComposeInput()" placeholder="Type a status" rows="1"
                  class="w-full bg-transparent text-center font-semibold"
                  style="font-size:${GLIMPSE_COMPOSE_FONT_SIZE}; font-family:${GLIMPSE_COMPOSE_FONTS[glimpseComposeFontIndex]}; line-height:1.4; color:${fg}; caret-color:${fg}; outline:none; resize:none;">${glimpseComposeText}</textarea>
              </div>
              <div class="flex items-center px-4 flex-shrink-0" style="justify-content:flex-end;padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);">
                <button id="glimpse-compose-send" onclick="submitGlimpseCompose()" class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style="background:${hasText ? '#22c55e' : btnBg};">${Icon('send','w-5 h-5 text-white')}</button>
              </div>
            </div>`;
        }

        function handleGlimpseComposeInput(){
          const el = document.getElementById('glimpse-compose-input');
          if (!el) return;
          glimpseComposeText = el.value;
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
          const isLight = glimpseComposeBg() === '#ffffff';
          const btnBg = isLight ? 'rgba(10,37,64,0.10)' : 'rgba(255,255,255,0.18)';
          const btn = document.getElementById('glimpse-compose-send');
          if (btn) btn.style.background = glimpseComposeText.trim() ? '#22c55e' : btnBg;
        }

        function cycleGlimpseComposeFont(){
          glimpseComposeFontIndex = (glimpseComposeFontIndex + 1) % GLIMPSE_COMPOSE_FONTS.length;
          const el = document.getElementById('glimpse-compose-input');
          if (el) el.style.fontFamily = GLIMPSE_COMPOSE_FONTS[glimpseComposeFontIndex];
        }

        function submitGlimpseCompose(){
          const text = glimpseComposeText.trim();
          if (!text) return;
          addMyGlimpse({ caption:text, icon:'book', bgStyle:'background:' + glimpseComposeBg() });
          closeGlimpseCompose();
        }

        function closeGlimpseCompose(){
          glimpseComposeText = '';
          glimpseComposeFontIndex = 0;
          openMyGlimpses();
        }

        // ---- Glimpse composer (photo/video + caption) ----
        function composeGlimpseMedia(){
          const input = document.getElementById('glimpse-media-input');
          if (input) input.click();
        }

        const GLIMPSE_MAX_SECONDS = 60;

        // glimpseVideoAttrs(startSec, endSec) builds the ontimeupdate/onloadedmetadata
        // attributes that keep a <video> looping over just the trimmed window a user
        // selected in the crop screen. When no window is given it falls back to the
        // old behaviour of looping the first GLIMPSE_MAX_SECONDS of the clip.
        function glimpseVideoAttrs(startSec, endSec){
          const s = isFinite(startSec) && startSec > 0 ? Number(startSec) : 0;
          const e = isFinite(endSec) && endSec > s ? Number(endSec) : (s + GLIMPSE_MAX_SECONDS);
          return `onloadedmetadata="if(this.currentTime<${s}){this.currentTime=${s};}" ontimeupdate="if(this.currentTime>=${e}||this.currentTime<${s}){this.currentTime=${s};}"`;
        }

        function handleGlimpseMediaSelected(e){
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (!file) return;
          const isVideo = file.type.startsWith('video/');
          const previewUrl = URL.createObjectURL(file);
          if (!isVideo) {
            glimpseMediaDurationSec = null;
            glimpseMediaTrimStart = 0;
            glimpseMediaTrimEnd = null;
            openGlimpseMediaCaptionScreen(file, 'image', previewUrl);
            return;
          }
          // Videos go straight to the caption screen and post as-is (looping the
          // first GLIMPSE_MAX_SECONDS if longer than that) -- no crop/trim step.
          const probe = document.createElement('video');
          probe.preload = 'metadata';
          probe.muted = true;
          probe.onloadedmetadata = function(){
            const duration = isFinite(probe.duration) ? probe.duration : null;
            glimpseMediaDurationSec = duration;
            glimpseMediaTrimStart = 0;
            glimpseMediaTrimEnd = duration && duration > 0 ? Math.min(duration, GLIMPSE_MAX_SECONDS) : null;
            openGlimpseMediaCaptionScreen(file, 'video', previewUrl);
          };
          probe.onerror = function(){
            // Metadata couldn't be read (e.g. unsupported format) - fall back to
            // posting the whole clip rather than blocking the user.
            glimpseMediaDurationSec = null;
            glimpseMediaTrimStart = 0;
            glimpseMediaTrimEnd = null;
            openGlimpseMediaCaptionScreen(file, 'video', previewUrl);
          };
          probe.src = previewUrl;
        }

        let glimpseMediaPreviewUrl = null;
        let glimpseMediaPreviewType = null; 
        let glimpseMediaCaptionText = '';
        let glimpseMediaFile = null;
        let glimpseMediaDurationSec = null;
        let glimpseMediaTrimStart = 0;   // selected slice start (sec) for the video being composed
        let glimpseMediaTrimEnd = null;  // selected slice end (sec) for the video being composed

        function openGlimpseMediaCaptionScreen(file, type, url){
          glimpseMediaFile = file;
          glimpseMediaPreviewUrl = url;
          glimpseMediaPreviewType = type;
          glimpseMediaCaptionText = '';
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = glimpseMediaCaptionHTML();
          const el = document.getElementById('glimpse-media-caption-input');
          if (el) el.focus();
        }

        function refreshGlimpseMediaCaptionScreen(){
          const ov = document.getElementById('overlay');
          if (!ov || ov.classList.contains('hidden')) return;
          const input = document.getElementById('glimpse-media-caption-input');
          const hadFocus = document.activeElement === input;
          const caret = input ? input.selectionStart : null;
          ov.innerHTML = glimpseMediaCaptionHTML();
          if (hadFocus) {
            const newInput = document.getElementById('glimpse-media-caption-input');
            if (newInput) {
              newInput.focus();
              if (caret != null) newInput.setSelectionRange(caret, caret);
            }
          }
        }

        function glimpseMediaCaptionHTML(){
          const hasCaption = glimpseMediaCaptionText.trim().length > 0;
          return `
            <div class="flex flex-col h-full bg-black text-white relative">
              <div class="absolute inset-0 overflow-hidden">
                ${glimpseMediaPreviewType === 'video'
                  ? `<video src="${glimpseMediaPreviewUrl}" class="absolute inset-0 w-full h-full object-cover" style="filter:blur(35px) brightness(0.65) saturate(1.3);transform:scale(1.2);" autoplay playsinline muted loop ${glimpseVideoAttrs(glimpseMediaTrimStart, glimpseMediaTrimEnd)}></video>`
                  : `<img src="${glimpseMediaPreviewUrl}" class="absolute inset-0 w-full h-full object-cover" style="filter:blur(35px) brightness(0.65) saturate(1.3);transform:scale(1.2);">`}
                <div class="absolute inset-0 flex items-center justify-center">
                  ${glimpseMediaPreviewType === 'video'
                    ? `<video src="${glimpseMediaPreviewUrl}" class="max-w-full max-h-full" autoplay playsinline loop ${glimpseVideoAttrs(glimpseMediaTrimStart, glimpseMediaTrimEnd)}></video>`
                    : `<img src="${glimpseMediaPreviewUrl}" class="max-w-full max-h-full object-contain">`}
                </div>
              </div>
              <div class="relative flex items-center px-4 flex-shrink-0" style="padding-top:var(--top-safe-pad);">
                <button onclick="cancelGlimpseMediaCaption()" class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(0,0,0,0.45);">${IconBold('close','w-5 h-5')}</button>
              </div>
              <div class="relative flex items-end gap-2 px-4" style="margin-top:auto;padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);">
                <textarea id="glimpse-media-caption-input" oninput="handleGlimpseMediaCaptionInput()" placeholder="Add a caption..." rows="1"
                  class="flex-1 min-w-0 text-sm text-white placeholder-gray-300" style="background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.25);outline:none;resize:none;padding:0.65rem 1rem;border-radius:9999px;max-height:6.5rem;overflow-y:auto;line-height:1.3;">${escapeHtml(glimpseMediaCaptionText)}</textarea>
                <button id="glimpse-media-caption-send" onclick="submitGlimpseMediaCaption()" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:${hasCaption ? '#22c55e' : '#ffffff'};box-shadow:0 2px 8px rgba(0,0,0,0.35);">${Icon('send', hasCaption ? 'w-5 h-5 text-white' : `w-5 h-5 text-[${NAVY}]`)}</button>
              </div>
            </div>`;
        }

        function handleGlimpseMediaCaptionInput(){
          const el = document.getElementById('glimpse-media-caption-input');
          if (!el) return;
          glimpseMediaCaptionText = el.value;
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
          const btn = document.getElementById('glimpse-media-caption-send');
          if (btn) {
            const has = glimpseMediaCaptionText.trim().length > 0;
            btn.style.background = has ? '#22c55e' : '#ffffff';
            const svg = btn.querySelector('svg');
            if (svg) svg.setAttribute('class', has ? 'w-5 h-5 text-white' : `w-5 h-5 text-[${NAVY}]`);
          }
        }

        function submitGlimpseMediaCaption(){
          const caption = glimpseMediaCaptionText.trim();
          addMyGlimpse({
            caption,
            icon:'camera',
            bgStyle:'background:linear-gradient(135deg,#374151,#111827)',
            mediaUrl: glimpseMediaPreviewUrl,
            mediaType: glimpseMediaPreviewType,
            mediaFile: glimpseMediaFile,
            trimStart: glimpseMediaPreviewType === 'video' ? glimpseMediaTrimStart : undefined,
            trimEnd: glimpseMediaPreviewType === 'video' ? glimpseMediaTrimEnd : undefined,
          });
          resetGlimpseMediaCaptionState();
          openMyGlimpses();
        }

        function cancelGlimpseMediaCaption(){
          resetGlimpseMediaCaptionState();
          openMyGlimpses();
        }

        function resetGlimpseMediaCaptionState(){
          glimpseMediaPreviewUrl = null;
          glimpseMediaPreviewType = null;
          glimpseMediaCaptionText = '';
          glimpseMediaFile = null;
          glimpseMediaDurationSec = null;
          glimpseMediaTrimStart = 0;
          glimpseMediaTrimEnd = null;
        }

        // ---- Feed post video playback (mute/autoplay) ----
        function refreshStoryStrip(){
          const bubble = document.getElementById('story-strip');
          if (bubble) bubble.innerHTML = stories.map(storyBubble).join('');
        }

        function addMyGlimpse(data){
          if (!requireCompleteProfile()) return;
          myGlimpsesViewed = false;
          GlimpsesAPI.create(data).then(() => { refreshMyGlimpses(); refreshStoryStrip(); });
        }

        function deleteMyGlimpse(id){
          GlimpsesAPI.remove(id).then(() => {
            openMyGlimpseMenuId = null;
            refreshMyGlimpses();
            refreshStoryStrip();
          });
        }

        let feedPosts = [];

        let deletedPostIds = new Set();

        // Excludes repost cards: those already have their own "Reposts" tab
        // on the profile, so counting them here too would inflate "Posts"
        // with items the person never actually uploaded -- and since the
        // main feed shows reposts as separate cards from the originals,
        // including them here is exactly what made this count drift away
        // from what someone would count scrolling their own uploads in the
        // feed.
        function myPostsCount(){
          return feedPosts.filter(p => p.mine && !p.isRepost).length;
        }

        function mockRequest(fn){
          return Promise.resolve(fn());
        }

        const POSTS_TABLE = 'posts';
        const POST_MEDIA_BUCKET = 'post-media';

        async function uploadPostMediaToStorage(file, postId){
          const sb = getSupabaseClient();
          if (!sb) return null;
          try {
            const path = `${postId}-${escapeHtml(file.name)}`;
            const { error } = await sb.storage.from(POST_MEDIA_BUCKET).upload(path, file, { upsert: true });
            if (error) { console.warn('Post media upload failed:', error.message); return null; }
            const { data } = sb.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);
            return (data && data.publicUrl) ? { url: data.publicUrl, path } : null;
          } catch (err) {
            console.warn('Post media upload failed:', err);
            return null;
          }
        }

        // Grabs a real frame out of a video file client-side (via an
        // off-screen <video>+<canvas>) so it can be uploaded as a poster
        // image alongside the video. A poster shows instantly and the
        // browser handles the poster-to-live-frame handoff natively with
        // no black flash at all -- unlike the shimmer-until-ready fallback
        // above, which still has to wait on the phone's video decoder.
        // Best-effort: returns null on any failure/timeout, in which case
        // the video just falls back to the shimmer treatment as before.
        function generateVideoPosterFile(file, index){
          return new Promise((resolve) => {
            let settled = false;
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            const cleanup = () => { try { URL.revokeObjectURL(url); } catch (e) {} };
            const finish = (blob) => {
              if (settled) return;
              settled = true;
              cleanup();
              resolve(blob ? new File([blob], `poster-${index}.jpg`, { type: 'image/jpeg' }) : null);
            };
            const timer = setTimeout(() => finish(null), 4000);
            video.muted = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
              try { video.currentTime = Math.min(0.3, (video.duration || 1) / 2); }
              catch (e) { clearTimeout(timer); finish(null); }
            }, { once: true });
            video.addEventListener('seeked', () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 720;
                canvas.height = video.videoHeight || 1280;
                canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((b) => { clearTimeout(timer); finish(b); }, 'image/jpeg', 0.82);
              } catch (e) { clearTimeout(timer); finish(null); }
            }, { once: true });
            video.addEventListener('error', () => { clearTimeout(timer); finish(null); }, { once: true });
          });
        }

        async function deletePostMediaFromStorage(path){
          if (!path) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { error } = await sb.storage.from(POST_MEDIA_BUCKET).remove([path]);
            if (error) console.warn('Post media delete failed:', error.message);
          } catch (err) { console.warn('Post media delete failed:', err); }
        }

        async function deletePostMediaListFromStorage(paths){
          if (!paths || !paths.length) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { error } = await sb.storage.from(POST_MEDIA_BUCKET).remove(paths);
            if (error) console.warn('Post media delete failed:', error.message);
          } catch (err) { console.warn('Post media delete failed:', err); }
        }

        // ---- Feed post video playback (mute/autoplay) ----
        // Videos autoplay with sound on by default as they scroll into view (see
        // setupFeedVideoAutoplay below) and pause once scrolled past -- tap the
        // speaker to mute. Some browsers block autoplay-with-sound without a
        // prior user gesture; attemptFeedVideoPlay() falls back to a muted
        // autoplay in that case rather than not playing at all.
        // Only one feed video should ever be playing at a time -- pause every
        // other feed video before starting this one, whether it was started
        // by the scroll-triggered autoplay observer or a manual tap.
        // loadeddata/canplay only mean "enough data buffered to start" --
        // on some phones there's a real gap between that and an actual
        // frame being decoded and composited on screen, which left a
        // black flash even after the skeleton below had already been
        // removed. requestVideoFrameCallback is the API that specifically
        // fires once a frame has really been presented; timeupdate and a
        // timer are fallbacks for browsers without it (or if it never
        // fires for some other reason) so the skeleton is never stuck up
        // forever.
        function revealFeedVideo(video){
          const sk = video.parentElement && video.parentElement.querySelector('.feed-video-skeleton');
          if (sk) sk.remove();
        }
        // A wrap-based version of revealFeedVideo for callers (like the poster
        // preloader below) that only have the wrap element, not the <video> itself.
        function revealFeedVideoWrap(el){
          const wrap = el.closest ? el.closest('.feed-video-wrap') : null;
          const sk = wrap && wrap.querySelector('.feed-video-skeleton');
          if (sk) sk.remove();
        }
        function armFeedVideoReveal(video){
          if (video.dataset.revealArmed === '1') return;
          video.dataset.revealArmed = '1';
          let done = false;
          const reveal = () => { if (done) return; done = true; revealFeedVideo(video); };
          if (typeof video.requestVideoFrameCallback === 'function') {
            video.requestVideoFrameCallback(reveal);
          }
          video.addEventListener('timeupdate', reveal, { once: true });
          video.addEventListener('loadeddata', () => { setTimeout(reveal, 600); }, { once: true });
          // Safety net: a <video poster="..."> only shows that poster once the
          // poster image itself has actually finished downloading -- until
          // then the browser paints the raw video canvas solid black. Right
          // after sign-in/sign-up, a burst of posts, avatars, and poster
          // images all fetch at once, so that "instant" poster paint the
          // posterUrl branch below assumes can easily take a second or more
          // -- that stretch of solid black is exactly what looked like posts
          // "blacking out" on sign-in. So the skeleton is now always kept in
          // the markup (never skipped just because a posterUrl exists), and
          // removed as soon as whichever finishes first: the poster image
          // loading (see armFeedVideoPoster) or a real video frame painting.
          // A final timer guarantees the skeleton never gets stuck forever
          // if neither of those signals ever fires for some reason.
          setTimeout(reveal, 5000);
        }

        function pauseOtherFeedVideos(video){  document.querySelectorAll('#feed-list video, #post-feed-list video').forEach(function(v){
            if (v === video) return;
            if (!v.paused) {
              v.pause();
              const wrap = v.closest('.feed-video-wrap');
              const btn = wrap && wrap.querySelector('.feed-video-playbtn');
              if (btn) btn.style.opacity = '1';
            }
          });
        }

        function attemptFeedVideoPlay(video, btn){
          pauseOtherFeedVideos(video);
          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch((err) => {
              // Leaving the feed, opening an overlay, or scrolling a post out of
              // view (see pauseAllOverlayMedia / setupFeedVideoAutoplay) can call
              // pause() while this play() is still resolving. That rejects with
              // an AbortError -- an intentional interruption, not the browser
              // blocking unmuted autoplay -- so it must never trigger the
              // permanent mute fallback below, or a video can end up muted for
              // no policy reason at all.
              if (err && err.name === 'AbortError') return;
              if (!video.muted) {
                video.muted = true;
                const wrap = video.closest('.feed-video-wrap');
                const muteBtn = wrap && wrap.querySelector('.feed-video-mutebtn');
                if (muteBtn) muteBtn.innerHTML = Icon('volumeOff', 'w-4 h-4 text-white');
                video.play().catch(() => {});
              }
            });
          }
          if (btn) btn.style.opacity = '0';
        }

        // A failed video/image load almost always means "the network hiccuped
        // just now" rather than "this file was actually deleted" -- but the
        // old error handlers immediately declared it "no longer available"
        // on the very first failure, which is both misleading (implies
        // permanent deletion) and gives the person no way to recover from a
        // one-off blip without reloading the whole page. This retries
        // automatically a couple of times first (silently fixing most
        // transient failures), and only falls back to a placeholder -- with
        // honest wording and an actual "Tap to retry" -- once it's genuinely
        // struck out.
        function feedMediaAutoRetry(el, kind){
          const attempt = (parseInt(el.dataset.retry || '0', 10)) + 1;
          const baseUrl = el.dataset.baseSrc || el.currentSrc || el.src;
          el.dataset.baseSrc = baseUrl;
          if (attempt > 2) {
            feedMediaShowRetryPlaceholder(el, kind, baseUrl);
            return;
          }
          el.dataset.retry = String(attempt);
          setTimeout(() => {
            const sep = baseUrl.indexOf('?') === -1 ? '?' : '&';
            el.src = baseUrl + sep + '_retry=' + Date.now();
            if (kind === 'video' && typeof el.load === 'function') el.load();
          }, attempt * 1200);
        }

        function feedMediaShowRetryPlaceholder(el, kind, baseUrl){
          const isVideo = kind === 'video';
          const host = isVideo ? (el.closest('.feed-video-wrap') || el) : el;
          const fillCls = el.classList.contains('absolute')
            ? 'absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gray-100 text-gray-400 text-xs italic text-center px-2'
            : 'w-full py-10 flex flex-col items-center justify-center gap-1.5 bg-gray-100 text-gray-400 text-xs italic text-center px-2';
          const originalClass = el.className;
          const placeholder = document.createElement('div');
          placeholder.className = fillCls;
          placeholder.innerHTML = `<span>Couldn't load this ${isVideo ? 'video' : 'image'} -- check your connection</span><button type="button" class="not-italic font-semibold" style="pointer-events:auto;color:${NAVY};">Tap to retry</button>`;
          placeholder.querySelector('button').addEventListener('click', () => {
            const fresh = isVideo ? document.createElement('video') : document.createElement('img');
            fresh.className = originalClass;
            if (isVideo) {
              fresh.setAttribute('controls', '');
              fresh.setAttribute('playsinline', '');
              fresh.setAttribute('preload', 'metadata');
            }
            fresh.onerror = () => feedMediaAutoRetry(fresh, kind);
            placeholder.replaceWith(fresh);
            fresh.src = baseUrl + (baseUrl.indexOf('?') === -1 ? '?' : '&') + '_retry=' + Date.now();
          });
          host.replaceWith(placeholder);
        }

        function simplePostVideoHtml(url, errorTarget, posterUrl){
          const uid = 'pv' + Math.random().toString(36).slice(2, 9);
          const err = errorTarget || 'Video no longer available';
          // Feed videos are only fetched with preload="metadata" (to avoid
          // burning data on posts nobody scrolls to), so the <video> element
          // has nothing decoded to paint yet and renders solid black until
          // playback actually starts pulling in frame data. That black
          // rectangle is what looked like posts "blacking out" on sign-in.
          // A posterUrl (newly-uploaded videos, see generateVideoPosterFile)
          // helps a lot, but it is NOT instant -- it's still an image fetched
          // over the network, and right after sign-in/sign-up a whole feed's
          // worth of posts, avatars, and posters are all fetching at once, so
          // it can take a beat to actually paint. The shimmering skeleton is
          // therefore always rendered (regardless of whether a posterUrl
          // exists) and only removed once something is genuinely ready to
          // show -- the poster image loading (armFeedVideoPoster) or the
          // video producing a real frame (armFeedVideoReveal), whichever
          // comes first. That keeps the raw black canvas from ever being
          // exposed to the user.
          const posterAttr = posterUrl ? ` poster="${posterUrl}"` : '';
          const skeleton = `<div class="feed-video-skeleton absolute inset-0 skel-shimmer" style="pointer-events:none;"></div>`;
          return `
            <div class="relative feed-video-wrap" id="${uid}">
              ${skeleton}
              <video src="${url}"${posterAttr} playsinline webkit-playsinline preload="metadata" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" class="w-full h-auto bg-gray-100 block" onloadedmetadata="armFeedVideoReveal(this)" onended="const b=this.closest('.feed-video-wrap').querySelector('.feed-video-playbtn'); if(b) b.style.opacity='1';" onerror="feedMediaAutoRetry(this,'video')"></video>
              <div class="feed-video-playbtn absolute inset-0 flex items-center justify-center" style="pointer-events:none;">
                <button type="button" onclick="event.stopPropagation(); toggleFeedVideoPlay('${uid}')" class="flex items-center justify-center rounded-full" style="width:3.5rem;height:3.5rem;background:rgba(0,0,0,0.45);pointer-events:auto;">${Icon('play','w-6 h-6 text-white')}</button>
              </div>
              <button type="button" onclick="event.stopPropagation(); toggleFeedVideoMute('${uid}')" class="feed-video-mutebtn absolute flex items-center justify-center rounded-full" style="bottom:10px;right:10px;width:2rem;height:2rem;background:rgba(0,0,0,0.45);">${Icon('volume','w-4 h-4 text-white')}</button>
              ${posterUrl ? `<img src="${posterUrl}" alt="" style="display:none" onload="revealFeedVideoWrap(this)" onerror="revealFeedVideoWrap(this)">` : ''}
            </div>`;
        }

        function toggleFeedVideoPlay(wrapId){
          const wrap = document.getElementById(wrapId);
          if (!wrap) return;
          const video = wrap.querySelector('video');
          const btn = wrap.querySelector('.feed-video-playbtn');
          if (!video) return;
          if (video.paused) {
            attemptFeedVideoPlay(video, btn);
            delete video.dataset.userPaused;
          } else {
            video.pause();
            video.dataset.userPaused = '1';
            if (btn) btn.style.opacity = '1';
          }
        }

        let feedVideoObserver = null;
        let feedVideoPreloadObserver = null;
        // Feed videos ship with preload="metadata" so posts nobody scrolls to
        // never burn data -- but that also means nothing real starts
        // downloading until playback actually kicks off (autoplay crossing
        // the 60% threshold below, or a manual tap), which is exactly the gap
        // the skeleton has to sit through. This second observer watches a
        // much wider band around the viewport (roughly a screen's worth
        // ahead) and, the moment a video enters it, bumps it to
        // preload="auto" so the browser starts pulling real frame data
        // early -- while the skeleton is still up, well before the post is
        // actually on screen. armFeedVideoReveal's loadeddata listener then
        // fires sooner and the skeleton comes down with real content ready,
        // instead of the user watching it swap to a black gap before frames
        // arrive. Off-screen videos further down the feed are left alone at
        // preload="metadata", so this doesn't turn into "load every video in
        // the feed at once."
        function setupFeedVideoPreload(container){
          if (feedVideoPreloadObserver) { feedVideoPreloadObserver.disconnect(); feedVideoPreloadObserver = null; }
          if (!container || typeof IntersectionObserver === 'undefined') return;
          const videos = container.querySelectorAll('.feed-video-wrap video');
          if (!videos.length) return;
          feedVideoPreloadObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return;
              const video = entry.target;
              feedVideoPreloadObserver.unobserve(video);
              if (video.preload === 'auto' || video.readyState >= 2) return;
              video.preload = 'auto';
              video.load();
            });
          }, { rootMargin: '600px 0px', threshold: 0 });
          videos.forEach(v => feedVideoPreloadObserver.observe(v));
        }
        function setupFeedVideoAutoplay(container){
          if (feedVideoObserver) { feedVideoObserver.disconnect(); feedVideoObserver = null; }
          setupFeedVideoPreload(container);
          if (!container || typeof IntersectionObserver === 'undefined') return;
          const videos = container.querySelectorAll('.feed-video-wrap video');
          if (!videos.length) return;
          feedVideoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              const video = entry.target;
              const wrap = video.closest('.feed-video-wrap');
              const btn = wrap && wrap.querySelector('.feed-video-playbtn');
              const ratio = entry.intersectionRatio;
              if (ratio >= 0.6) {
                if (video.paused && video.dataset.userPaused !== '1') {
                  attemptFeedVideoPlay(video, btn);
                }
              } else if (ratio <= 0.15) {
                if (!video.paused) {
                  video.pause();
                  if (btn) btn.style.opacity = '1';
                }
                delete video.dataset.userPaused;
              }
            });
          }, { threshold: [0, 0.15, 0.6] });
          videos.forEach(v => feedVideoObserver.observe(v));
        }

        function toggleFeedVideoMute(wrapId){
          const wrap = document.getElementById(wrapId);
          if (!wrap) return;
          const video = wrap.querySelector('video');
          const btn = wrap.querySelector('.feed-video-mutebtn') || document.getElementById('mutebtn-' + wrapId);
          if (!video) return;
          video.muted = !video.muted;
          if (btn) btn.innerHTML = Icon(video.muted ? 'volumeOff' : 'volume', 'w-4 h-4 text-white');
        }

        // ---- Post media grid layout (multi-image posts) ----
        function postMediaHtmlFromUploaded(items){
          const itemHtml = (it) => it.type === 'video'
            ? simplePostVideoHtml(it.url, undefined, it.posterUrl)
            : `<img src="${it.url}" class="w-full h-auto" onerror="feedMediaAutoRetry(this,'image')">`;
          if (items.length === 1) return itemHtml(items[0]);
          return postMediaGridHtml(items);
        }

        // Grid-tile videos never autoplay (they're static previews until
        // tapped open), so there's no playback to key off of the way
        // armFeedVideoReveal does. Instead, nudge currentTime forward a
        // hair right after metadata loads -- that forces the browser to
        // actually decode a real frame at that timestamp, and 'seeked'
        // fires once it's genuinely rendered, so that's the reveal signal.
        function armFeedVideoThumbnail(video){
          if (video.dataset.revealArmed === '1') return;
          video.dataset.revealArmed = '1';
          let done = false;
          const reveal = () => { if (done) return; done = true; revealFeedVideo(video); };
          video.addEventListener('seeked', reveal, { once: true });
          video.addEventListener('loadeddata', () => { setTimeout(reveal, 800); }, { once: true });
          try { video.currentTime = 0.05; } catch (e) { reveal(); }
          // Safety net so the skeleton can never get stuck forever -- see the
          // matching comment in armFeedVideoReveal for why this is needed
          // even when a posterUrl is present.
          setTimeout(reveal, 5000);
        }

        function postMediaGridTile(it, index, areaStyle, extraCount){
          // Same black-canvas issue as simplePostVideoHtml, same fix: the
          // skeleton is always rendered (even when a posterUrl exists,
          // because that poster is still a real network fetch and isn't
          // guaranteed to paint instantly) and removed as soon as the
          // poster image actually finishes loading or the video produces a
          // real frame, whichever happens first.
          const posterAttr = it.posterUrl ? ` poster="${it.posterUrl}"` : '';
          const posterPreload = it.posterUrl ? `<img src="${it.posterUrl}" alt="" style="display:none" onload="revealFeedVideoWrap(this)" onerror="revealFeedVideoWrap(this)">` : '';
          const media = it.type === 'video'
            ? `<div class="relative w-full h-full feed-video-wrap"><video src="${it.url}"${posterAttr} class="absolute inset-0 w-full h-full object-cover" muted playsinline preload="metadata" onloadedmetadata="armFeedVideoThumbnail(this)" onerror="feedMediaAutoRetry(this,'video')"></video><div class="feed-video-skeleton absolute inset-0 skel-shimmer" style="pointer-events:none;"></div>${posterPreload}</div>`
            : `<img src="${it.url}" class="absolute inset-0 w-full h-full object-cover" onerror="feedMediaAutoRetry(this,'image')">`;
          return `
            <div class="relative overflow-hidden" style="${areaStyle}" onclick="event.stopPropagation(); openPostMediaGallery(postGridOwnerId(this), ${index})">
              ${media}
              ${extraCount ? `<div class="absolute inset-0 flex items-center justify-center text-white font-semibold text-xl" style="background:rgba(0,0,0,0.45);">+${extraCount}</div>` : ''}
            </div>`;
        }

        function postGridOwnerId(tileEl){
          const card = tileEl.closest('[id^="post-"]');
          return card ? Number(card.id.replace('post-', '')) : null;
        }

        function postMediaGridHtml(items){
          const gap = 'gap:2px;';
          if (items.length === 2) {
            return `
              <div class="grid post-media-grid" style="grid-template-columns:1fr 1fr;aspect-ratio:4/3;${gap}">
                ${postMediaGridTile(items[0], 0, '')}
                ${postMediaGridTile(items[1], 1, '')}
              </div>`;
          }
          if (items.length === 3) {
            return `
              <div class="grid post-media-grid" style="grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:4/3;${gap}">
                ${postMediaGridTile(items[0], 0, 'grid-row:1 / 3;')}
                ${postMediaGridTile(items[1], 1, '')}
                ${postMediaGridTile(items[2], 2, '')}
              </div>`;
          }
          const extra = items.length > 4 ? items.length - 4 : 0;
          const hiddenExtras = extra ? `<div class="hidden">${items.slice(4).map(it => it.type === 'video' ? `<video src="${it.url}"></video>` : `<img src="${it.url}">`).join('')}</div>` : '';
          return `
            <div class="grid post-media-grid" style="grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr 1fr;aspect-ratio:4/3;${gap}">
              ${postMediaGridTile(items[0], 0, 'grid-row:1 / 4;')}
              ${postMediaGridTile(items[1], 1, '')}
              ${postMediaGridTile(items[2], 2, '')}
              ${postMediaGridTile(items[3], 3, '', extra)}
            </div>${hiddenExtras}`;
        }

        function postMediaItemsList(post){
          if (!post || !post.mediaHtml) return [];
          const items = [];
          const re = /<(img|video)[^>]*\ssrc="([^"]+)"/gi;
          let m;
          while ((m = re.exec(post.mediaHtml))) {
            items.push({ url: m[2], type: /^video$/i.test(m[1]) ? 'video' : 'image' });
          }
          return items;
        }

        async function postInsertRemote(post){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data: userRes } = await sb.auth.getUser();
            const user = userRes && userRes.user;
            const { error } = await sb.from(POSTS_TABLE).insert({
              id: String(post.id),
              data: post,
              created_by: user ? user.id : null,
            });
            return !error;
          } catch (e) { return false; }
        }

        async function postDeleteRemote(id){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { error } = await sb.from(POSTS_TABLE).delete().eq('id', String(id));
            return !error;
          } catch (e) { return false; }
        }

        // ---- Feed cache: show something instantly on a slow/first
        // connection instead of a bare skeleton, using whatever was last
        // successfully loaded for THIS account. ----
        const FEED_CACHE_PREFIX = 'stitchFeedCache:';
        const FEED_CACHE_MAX_POSTS = 10;
        // True only while the feed on screen is the cached snapshot (not
        // live data yet). Every write action checks this and refuses to
        // run rather than let someone like/comment/repost/post against
        // data that might already be gone or out of date, and that would
        // silently fail (or worse, appear to succeed) once actually sent.
        let feedShowingCachedOnly = false;

        function feedCacheKeyForUser(userId){
          return userId ? (FEED_CACHE_PREFIX + userId) : null;
        }

        function saveFeedCacheSnapshot(userId){
          try {
            if (!userId || typeof localStorage === 'undefined') return;
            const key = feedCacheKeyForUser(userId);
            // Only real, finished posts -- never an in-progress upload
            // (meaningless after a reload) and never anything whose media
            // markup embeds actual file bytes as a data: URL (a fresh
            // upload can briefly look like this before its real storage
            // URL comes back) so the cache stays a handful of KB instead
            // of ballooning toward localStorage's ~5MB ceiling.
            const snapshot = feedPosts
              .filter(p => p.mediaHtml && !p.uploading && p.mediaHtml.indexOf('data:') === -1)
              .slice(0, FEED_CACHE_MAX_POSTS);
            if (!snapshot.length) return;
            localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), posts: snapshot }));
          } catch (e) { /* storage full/unavailable/private-mode -- caching is a nicety, never worth breaking the feed over */ }
        }

        function loadFeedCacheSnapshot(userId){
          try {
            const key = feedCacheKeyForUser(userId);
            if (!key || typeof localStorage === 'undefined') return null;
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.posts) || !parsed.posts.length) return null;
            return parsed;
          } catch (e) { return null; }
        }

        function clearFeedCacheSnapshot(userId){
          try {
            const key = feedCacheKeyForUser(userId);
            if (key && typeof localStorage !== 'undefined') localStorage.removeItem(key);
          } catch (e) {}
        }

        // Belt-and-suspenders sweep for sign-out on a shared/public device:
        // even if a user id somehow isn't available at the exact moment of
        // sign-out, this guarantees no account's cached feed can survive
        // into whoever logs in next on the same browser.
        function clearAllFeedCaches(){
          try {
            if (typeof localStorage === 'undefined') return;
            Object.keys(localStorage).forEach(k => {
              if (k.indexOf(FEED_CACHE_PREFIX) === 0) localStorage.removeItem(k);
            });
          } catch (e) {}
        }

        function feedCacheBannerHTML(){
          return `
            <div class="flex items-center gap-2 text-xs font-medium rounded-2xl px-3.5 py-2.5 mb-4" style="background:rgba(10,37,64,0.06);color:${NAVY};">
              <div style="width:14px;height:14px;border-radius:50%;border:2px solid rgba(30,144,255,0.25);border-top-color:${NAVY};animation:classroom-spin .7s linear infinite;flex-shrink:0;"></div>
              <span>Showing saved posts -- reconnecting...</span>
            </div>`;
        }

        let remotePostsLoaded = false;

        // Guards against loadRemotePosts() running twice at once (e.g. the
        // boot sequence in authEnterApp() and the initial switchTab(0) both
        // call it within moments of each other). Without this, two
        // overlapping calls can each read feedPosts before either has
        // finished merging its results, both decide the same row is "new",
        // and both push it in -- showing every post twice until a refresh
        // happens to run the merge just once. A second call while one is
        // already in flight now just awaits that same in-progress result
        // instead of starting its own redundant fetch+merge.
        let loadRemotePostsInFlight = null;
        function loadRemotePosts(){
          if (loadRemotePostsInFlight) return loadRemotePostsInFlight;
          loadRemotePostsInFlight = loadRemotePostsImpl().finally(() => { loadRemotePostsInFlight = null; });
          return loadRemotePostsInFlight;
        }
        // Collapses accidental duplicate rows in the shared posts table --
        // e.g. a real double-tap on "Post" that got two separate inserts
        // through (each tap uploads its media to its own storage path, so
        // two rows from the same double-tap don't necessarily share a
        // mediaPath/mediaPaths). Same author + same caption, posted close
        // together: keep one, drop the rest. Media isn't part of the match
        // on purpose -- two rows from one accidental double-submit still
        // count as the same post even though their uploads landed at
        // different paths. Reposts are left alone since two people can
        // legitimately repost the same original within the same window.
        //
        // A blank caption (the common case -- most photo/video posts have
        // no caption at all) used to fall back to also requiring matching
        // media, which is exactly the case a double-tap duplicate fails:
        // two genuinely separate uploads of the same picked files, so two
        // different storage paths, so the old fallback never matched and
        // the duplicate stayed visible forever. Any same-author match now
        // collapses regardless of caption; a tight window keeps this from
        // ever merging two real, unrelated posts -- a double-tap's two
        // inserts land seconds apart, while two coincidental separate
        // photos from the same person land minutes apart at the least.
        function dedupeRemotePostRows(rows){
          const seen = new Map();
          const keep = [];
          rows.forEach(row => {
            const d = row.data || {};
            if (d.isRepost) { keep.push(row); return; }
            const body = d.body || '';
            const sig = [row.created_by, body].join('|');
            const windowMs = body ? 5 * 60 * 1000 : 60 * 1000;
            const prior = seen.get(sig);
            if (prior && Math.abs(new Date(prior.created_at).getTime() - new Date(row.created_at).getTime()) <= windowMs) return;
            seen.set(sig, row);
            keep.push(row);
          });
          return keep;
        }


        async function loadRemotePostsImpl(){
          const sb = getSupabaseClient();
          if (!sb) { remotePostsLoaded = true; return false; }
          try {
            const { data: userRes } = await sb.auth.getUser();
            const me = userRes && userRes.user;
            const { data: rawData, error } = await sb.from(POSTS_TABLE)
              .select('id, data, created_by, created_at')
              .order('created_at', { ascending: false });
            remotePostsLoaded = true;
            if (error || !rawData) return false;
            const data = dedupeRemotePostRows(rawData);
            const remoteIds = new Set(data.map(row => String(row.id)));
            const lengthBeforeFilter = feedPosts.length;
            feedPosts = feedPosts.filter(p => {
              if (deletedPostIds.has(String(p.id))) return false;
              if (p.mine) {
                if (remoteIds.has(String(p.id))) return true;
                // A "mine" post is normally kept unconditionally so it
                // doesn't flicker out of the feed while its own insert is
                // still in flight. But a post older than a couple minutes
                // that still isn't in the server's row set never actually
                // made it there (see the postInsertRemote fix in
                // PostsAPI.create) -- it's a ghost from an earlier failed
                // attempt, sitting only in this device's saved state.
                // Drop it now instead of restoring it forever.
                const ageMs = Date.now() - Number(p.id || 0);
                return ageMs < 2 * 60 * 1000;
              }
              if (!p.authorId) return true;
              return remoteIds.has(String(p.id));
            });
            const postsWereRemoved = feedPosts.length !== lengthBeforeFilter;
            // A post can be pruned here (deleted elsewhere, or a ghost that
            // never actually made it to the server) while the person is
            // sitting on some other tab entirely, or while Home/Profile are
            // cached-but-off-screen (see cachedHomeFeedNode/
            // cachedProfileScreenNode in core.js). Neither of those DOM
            // trees gets touched by this function, so without invalidating
            // them here too, switching back to Home or Profile later would
            // reattach the stale cached snapshot -- the exact "deleted post
            // shows back up on my profile" bug this is fixing.
            if (postsWereRemoved && typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
            if (postsWereRemoved && typeof queueSaveUserState === 'function') queueSaveUserState();
            const knownIds = new Set(feedPosts.map(p => String(p.id)));
            const newRows = data.filter(row => !knownIds.has(row.id) && !deletedPostIds.has(String(row.id)));
            const existingAuthorIds = feedPosts.filter(p => !p.mine && p.authorId).map(p => p.authorId);
            const authorIds = [...new Set([
              ...newRows.filter(row => !(me && row.created_by === me.id)).map(row => row.created_by),
              ...existingAuthorIds,
            ].filter(Boolean))];
            let photoById = {};
            let nameById = {};
            // FIX: the profiles query's `error` was never checked. On a
            // transient network hiccup (this whole function is polled
            // every 30s -- see startFeedPolling -- so it's a matter of
            // "when", not "if"), `profiles` comes back undefined, so
            // `(profiles || [])` silently produced an empty list. The
            // forEach below then ran anyway and reset EVERY existing
            // non-mine post's photo to null (photoById[id] || null),
            // wiping out every other user's avatar across the whole
            // already-loaded feed until the next successful poll. That's
            // the intermittent "other people's name/photo disappear" bug
            // -- it was never about any single post, it was any transient
            // failure of this one query blanking everyone at once. Now a
            // failed fetch just leaves the previously-known photos alone.
            let photoFetchFailed = false;
            if (authorIds.length) {
              // `name` is fetched here alongside `photo` for the exact same
              // reason: without it, a post only ever showed whatever name
              // its author had at the moment they posted. Renaming your
              // account updated your own device's view of your own posts
              // (see feedPostHeaderHtml's post.mine check) but never
              // reached anyone else looking at those same posts, since
              // their copy had no way to know your name had changed. Now
              // every viewer re-resolves the author's *current* name from
              // public_profiles on every load/poll, same as the photo.
              const { data: profiles, error: profilesError } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, photo, name').in('user_id', authorIds);
              if (profilesError) {
                photoFetchFailed = true;
              } else {
                (profiles || []).forEach(p => { photoById[p.user_id] = p.photo; if (p.name) nameById[p.user_id] = p.name; });
              }
            }
            if (!photoFetchFailed) {
              feedPosts.forEach(p => {
                if (!p.mine && p.authorId && authorIds.includes(p.authorId)) {
                  p.photo = photoById[p.authorId] || null;
                  if (nameById[p.authorId]) p.name = nameById[p.authorId];
                }
              });
            }
            newRows.forEach(row => {
              const id = row.id;
              const isMine = !!(me && row.created_by === me.id);
              feedPosts.push({ ...row.data, id: row.data.id ?? id, mine: isMine, authorId: row.created_by, connected: isMine ? true : !!row.data.connected, photo: isMine ? row.data.photo : (photoFetchFailed ? null : (photoById[row.created_by] || null)), name: isMine ? row.data.name : (photoFetchFailed ? row.data.name : (nameById[row.created_by] || row.data.name)) });
              knownIds.add(id);
            });
            // Catch up on tags made while this device was offline/closed: the realtime handler below only fires
            // for someone who was already connected at the exact moment they were tagged, so anything posted in
            // between sessions would otherwise never surface. Every freshly-fetched row gets checked here too.
            if (me && typeof addNotif === 'function') {
              newRows.forEach(row => {
                if (row.created_by === me.id) return;
                const taggedUsers = Array.isArray(row.data && row.data.taggedUsers) ? row.data.taggedUsers : [];
                if (!taggedUsers.some(t => t && String(t.id) === String(me.id))) return;
                const name = row.data.name || 'Someone in your network';
                addNotif({
                  id: 'tag-' + row.id,
                  type: 'tag',
                  source: 'network',
                  icon: 'users',
                  iconBg: 'bg-blue-50',
                  iconClass: 'text-blue-600',
                  name,
                  message: `${name} tagged you in a post`,
                  otherUserId: row.created_by,
                  postId: row.data.id,
                  createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
                });
              });
            }
            feedPosts.sort((a, b) => Number(b.id) - Number(a.id));
            rankFeedPosts();
            feedShowingCachedOnly = false;
            saveFeedCacheSnapshot(me && me.id);
            return newRows.length > 0 || postsWereRemoved;
          } catch (e) { remotePostsLoaded = true; return false; }
        }

        // ---- Feed ranking algorithm ----
        function buildAuthorAffinity(){
          const affinity = {};
          feedPosts.forEach(post => {
            if (!post.authorId || post.mine) return;
            let score = 0;
            if (post.liked) score += 3;
            if (post.saved) score += 2;
            if (post.reposted) score += 2;
            if (post.commentsList && post.commentsList.some(c => c.name === 'You')) score += 4;
            if (score > 0) affinity[post.authorId] = (affinity[post.authorId] || 0) + score;
          });
          return affinity;
        }

        // rankFeedPosts() re-runs every time the Home tab is revisited (see
        // loadRemotePostsImpl/loadPostInteractions below), not just when a
        // post is actually new. It used to roll a fresh Math.random() jitter
        // per post on every single call, which reshuffled the *entire* feed
        // order each time -- so simply switching away and back to the Home
        // tab (or anything else that triggers a re-rank) could reorder posts
        // that hadn't changed at all, reading as the feed "rebuilding" itself.
        // Each post now gets one random jitter value the first time it's
        // ranked, cached on the post object, so its position only moves when
        // something about it (likes/comments/affinity/etc.) actually changes.
        function rankFeedPosts(){
          if (!feedPosts.length) return;
          const affinity = buildAuthorAffinity();
          const now = Date.now();
          const scored = feedPosts.map(post => {
            let score = 0;
            const ageHours = Math.max(0, (now - Number(post.id || now)) / 3600000);
            score += Math.max(0, 24 - ageHours) * 0.5; 
            score += (post.likes || 0) * 0.8 + (post.comments || 0) * 1.2 + (post.reposts || 0) * 1.5 + (post.views || 0) * 0.1;
            if (post.authorId && affinity[post.authorId]) score += affinity[post.authorId] * 2;
            if (!post.mine && post.authorId && typeof isUserInMyNetwork === 'function' && isUserInMyNetwork(post.authorId)) score += 6;
            if (post.mine) score += 100;
            if (typeof post._rankJitter !== 'number') post._rankJitter = Math.random() * 4;
            score += post._rankJitter;
            return { post, score };
          });
          scored.sort((a, b) => b.score - a.score);
          feedPosts.length = 0;
          scored.forEach(s => feedPosts.push(s.post));
        }

        function shuffleArray(arr){
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        const POST_LIKES_TABLE = 'post_likes';
        const POST_REPOSTS_TABLE = 'post_reposts';
        const POST_SAVES_TABLE = 'post_saves';
        const POST_COMMENTS_TABLE = 'post_comments';
        const POST_VIEWS_TABLE = 'post_views';
        const POST_SHARES_TABLE = 'post_shares';

        async function getCurrentUserId(){
          const user = await getCachedAuthUser();
          return (user && user.id) || null;
        }

        async function postLikeRemote(id, liked){
          const sb = getSupabaseClient();
          const userId = await getCurrentUserId();
          if (!sb || !userId) return false;
          try {
            if (liked) {
              const { error } = await sb.from(POST_LIKES_TABLE)
                .upsert({ post_id: String(id), user_id: userId }, { onConflict: 'post_id,user_id' });
              return !error;
            }
            const { error } = await sb.from(POST_LIKES_TABLE)
              .delete().eq('post_id', String(id)).eq('user_id', userId);
            return !error;
          } catch (e) { return false; }
        }

        async function postRepostRemote(id, reposted){
          const sb = getSupabaseClient();
          const userId = await getCurrentUserId();
          if (!sb || !userId) return false;
          try {
            if (reposted) {
              const { error } = await sb.from(POST_REPOSTS_TABLE)
                .upsert({ post_id: String(id), user_id: userId }, { onConflict: 'post_id,user_id' });
              return !error;
            }
            const { error } = await sb.from(POST_REPOSTS_TABLE)
              .delete().eq('post_id', String(id)).eq('user_id', userId);
            return !error;
          } catch (e) { return false; }
        }

        async function postSaveRemote(id, saved){
          const sb = getSupabaseClient();
          const userId = await getCurrentUserId();
          if (!sb || !userId) return false;
          try {
            if (saved) {
              const { error } = await sb.from(POST_SAVES_TABLE)
                .upsert({ post_id: String(id), user_id: userId }, { onConflict: 'post_id,user_id' });
              return !error;
            }
            const { error } = await sb.from(POST_SAVES_TABLE)
              .delete().eq('post_id', String(id)).eq('user_id', userId);
            return !error;
          } catch (e) { return false; }
        }

        let feedActivityChannel = null;
        let feedActivitySubscribedForUserId = null;
        async function subscribeToFeedActivity(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (feedActivityChannel && feedActivitySubscribedForUserId === myId) return;
          if (feedActivityChannel) { try { sb.removeChannel(feedActivityChannel); } catch (e) {  } feedActivityChannel = null; }
          feedActivitySubscribedForUserId = myId;
          feedActivityChannel = sb.channel('feed-activity:' + myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POSTS_TABLE }, (payload) => handleRemotePostInsert(payload, myId))
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: POSTS_TABLE }, (payload) => handleRemotePostDelete(payload))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_COMMENTS_TABLE }, (payload) => handleRemoteCommentInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_LIKES_TABLE }, (payload) => handleRemoteLikeInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_REPOSTS_TABLE }, (payload) => handleRemoteRepostInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_SHARES_TABLE }, (payload) => handleRemoteShareInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: OPPORTUNITIES_TABLE }, (payload) => handleRemoteOpportunityInsert(payload, myId))
            .subscribe();
        }

        // ---- Feed polling fallback ----
        // The realtime channel above is the fast path for a new post
        // showing up right away, but it isn't the only path in to
        // feedPosts -- same idea as startCoursesPolling/
        // startOpportunitiesPolling. A postgres_changes subscription can
        // go quiet without visibly disconnecting: the phone locks or the
        // browser suspends the tab's socket in the background, and
        // Supabase doesn't replay whatever was posted while it was gone.
        // Without a backup, someone sitting right there on the Home tab
        // never finds out about a new post until something else happens to
        // re-fetch (switching tabs away and back, or a fresh login/session
        // start) -- which reads exactly like "only shows up after logging
        // out and back in". Polling every 30s guarantees a new post surfaces
        // on its own within that window even if the realtime push never
        // arrives.
        let feedPollInterval = null;
        function startFeedPolling(){
          if (feedPollInterval) return;
          feedPollInterval = setInterval(async () => {
            const sb = getSupabaseClient();
            if (!sb) return;
            const changed = await loadRemotePosts().catch(() => false);
            if (!changed) return;
            if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof patchFeedInPlace === 'function') patchFeedInPlace();
            if (typeof currentTab !== 'undefined' && currentTab === 4 && typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
          }, 30000);
        }

        // ---- Realtime feed events (deletes/inserts/comments) ----
        function handleRemotePostDelete(payload){
          const row = payload && payload.old;
          if (!row || row.id === undefined) return;
          const id = row.id;
          if (typeof feedPosts === 'undefined') return;
          const before = feedPosts.length;
          feedPosts = feedPosts.filter(p => String(p.id) !== String(id) && String(p.repostOf) !== String(id));
          if (feedPosts.length === before) return; 
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
          // This can fire while Home/Profile are cached-but-off-screen (the
          // person is on a different tab, or the delete came from another
          // device/tab) -- invalidate both cached DOM snapshots so whichever
          // one is opened next is rebuilt from the now-current feedPosts
          // instead of reattaching a stale copy that still has this post in
          // it. The live-DOM patches below still run too, for whichever tab
          // happens to be on screen right now.
          if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          if (typeof currentTab !== 'undefined' && currentTab === 0) {
            const el = document.getElementById('post-' + id);
            if (el) el.remove(); else if (typeof renderFeed === 'function') renderFeed();
          }
          if (typeof currentTab !== 'undefined' && currentTab === 4 && typeof profileTab !== 'undefined') {
            if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
          }
        }

        function handleRemotePostInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.data || row.created_by === myId) return;
          const name = row.data.name || 'Someone in your network';
          const taggedUsers = Array.isArray(row.data.taggedUsers) ? row.data.taggedUsers : [];
          const iAmTagged = taggedUsers.some(t => t && String(t.id) === String(myId));
          if (iAmTagged && typeof addNotif === 'function') {
            addNotif({
              id: 'tag-' + row.id,
              type: 'tag',
              source: 'network',
              icon: 'users',
              iconBg: 'bg-blue-50',
              iconClass: 'text-blue-600',
              name,
              message: `${name} tagged you in a post`,
              otherUserId: row.created_by,
              postId: row.data.id,
            });
          }
          if (typeof isUserInMyNetwork !== 'function' || !isUserInMyNetwork(row.created_by)) return;
          if (typeof addNotif === 'function') {
            addNotif({
              id: 'post-' + row.id,
              type: 'post',
              source: 'network',
              icon: 'camera',
              iconBg: 'bg-blue-50',
              iconClass: 'text-blue-600',
              name,
              message: `${name} shared a new post`,
              otherUserId: row.created_by,
              postId: row.data.id,
            });
          }
          if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof feedPosts !== 'undefined' && !feedPosts.some(p => String(p.id) === String(row.data.id))) {
            feedPosts.unshift(Object.assign({}, row.data, { mine: false, authorId: row.created_by }));
            const feedList = document.getElementById('feed-list');
            if (feedList && typeof patchFeedInPlace === 'function') patchFeedInPlace();
          }
        }

        function handleRemoteCommentInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.post_id || row.user_id === myId) return;
          const post = typeof findPost === 'function' ? findPost(isNaN(Number(row.post_id)) ? row.post_id : Number(row.post_id)) : null;
          if (!post || !post.mine) return; 
          const name = row.author_name || 'Someone';
          if (typeof addNotif === 'function') {
            addNotif({
              id: 'comment-' + row.id,
              type: 'comment',
              source: 'network',
              icon: 'comment',
              iconBg: 'bg-emerald-50',
              iconClass: 'text-emerald-600',
              name,
              message: `${name} commented on your post`,
              otherUserId: row.user_id,
              postId: post.id,
            });
          }
        }

        async function lookupProfileName(userId){
          const sb = getSupabaseClient();
          if (!sb || !userId) return 'Someone';
          try {
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('name,username').eq('user_id', userId).maybeSingle();
            return (data && (data.name || data.username)) || 'Someone';
          } catch (e) { return 'Someone'; }
        }

        async function handleRemoteLikeInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.post_id || row.user_id === myId) return;
          const post = typeof findPost === 'function' ? findPost(isNaN(Number(row.post_id)) ? row.post_id : Number(row.post_id)) : null;
          if (!post || !post.mine) return; 
          const name = await lookupProfileName(row.user_id);
          if (typeof addNotif === 'function') {
            addNotif({
              id: 'like-' + row.post_id + '-' + row.user_id,
              type: 'like',
              source: 'network',
              icon: 'heart',
              iconBg: 'bg-pink-50',
              iconClass: 'text-pink-600',
              name,
              message: `${name} liked your post`,
              otherUserId: row.user_id,
              postId: post.id,
            });
          }
        }

        async function handleRemoteRepostInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.post_id || row.user_id === myId) return;
          const post = typeof findPost === 'function' ? findPost(isNaN(Number(row.post_id)) ? row.post_id : Number(row.post_id)) : null;
          if (!post || !post.mine) return; 
          const name = await lookupProfileName(row.user_id);
          if (typeof addNotif === 'function') {
            addNotif({
              id: 'repost-' + row.post_id + '-' + row.user_id,
              type: 'repost',
              source: 'network',
              icon: 'repost',
              iconBg: 'bg-blue-50',
              iconClass: 'text-blue-600',
              name,
              message: `${name} reposted your post`,
              otherUserId: row.user_id,
              postId: post.id,
            });
          }
        }

        async function handleRemoteShareInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.post_id || row.user_id === myId) return;
          const post = typeof findPost === 'function' ? findPost(isNaN(Number(row.post_id)) ? row.post_id : Number(row.post_id)) : null;
          if (!post) return;
          post.shares = (post.shares || 0) + 1;
          if (typeof bumpShareCountDisplay === 'function') bumpShareCountDisplay(post.id);
          if (!post.mine) return; 
          const name = await lookupProfileName(row.user_id);
          if (typeof addNotif === 'function') {
            addNotif({
              id: 'share-' + row.post_id + '-' + row.user_id + '-' + row.id,
              type: 'share',
              source: 'network',
              icon: 'send',
              iconBg: 'bg-blue-50',
              iconClass: 'text-blue-600',
              name,
              message: `${name} shared your post`,
              otherUserId: row.user_id,
              postId: post.id,
            });
          }
        }

        function handleRemoteOpportunityInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.data || row.created_by === myId) return;
          const title = row.data.title || 'A new opportunity';
          if (typeof addNotif === 'function') {
            addNotif({
              id: 'opportunity-' + row.id,
              type: 'opportunity',
              source: 'app',
              icon: 'briefcase',
              iconBg: 'bg-blue-50',
              iconClass: 'text-blue-600',
              name: 'Opportunities',
              message: `New opportunity posted: "${title}"`,
              jobId: row.id,
            });
          }
        }

        async function postCommentRemote(id, text){
          const sb = getSupabaseClient();
          if (!sb) return false;
          try {
            const { data: userRes } = await sb.auth.getUser();
            const user = userRes && userRes.user;
            const authorName = (typeof profileData !== 'undefined' && profileData.name) ? profileData.name : 'Someone';
            const { error } = await sb.from(POST_COMMENTS_TABLE).insert({
              post_id: String(id),
              user_id: user ? user.id : null,
              author_name: authorName,
              text,
            });
            return !error;
          } catch (e) { return false; }
        }

        async function postShareRemote(id){
          const sb = getSupabaseClient();
          const userId = await getCurrentUserId();
          if (!sb || !userId) return false;
          try {
            const { error } = await sb.from(POST_SHARES_TABLE).insert({
              post_id: String(id),
              user_id: userId,
            });
            return !error;
          } catch (e) { return false; }
        }

        const viewedThisSession = new Set();
        async function postViewRemote(id){
          const post = findPost(id);
          if (post && post.mine) return false;
          const key = String(id);
          if (viewedThisSession.has(key)) return false;
          viewedThisSession.add(key);
          const sb = getSupabaseClient();
          const userId = await getCurrentUserId();
          if (!sb || !userId) return false;
          try {
            const { error } = await sb.from(POST_VIEWS_TABLE)
              .upsert({ post_id: key, user_id: userId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true });
            return !error;
          } catch (e) { return false; }
        }

        async function loadPostInteractions(){
          const sb = getSupabaseClient();
          if (!sb || !feedPosts.length) return;
          const ids = feedPosts.map(p => String(p.id));
          try {
            const myId = await getCurrentUserId();
            const [likesRes, repostsRes, savesRes, commentsRes, viewsRes, sharesRes] = await Promise.all([
              sb.from(POST_LIKES_TABLE).select('post_id,user_id').in('post_id', ids),
              sb.from(POST_REPOSTS_TABLE).select('post_id,user_id').in('post_id', ids),
              myId
                ? sb.from(POST_SAVES_TABLE).select('post_id').in('post_id', ids).eq('user_id', myId)
                : Promise.resolve({ data: [] }),
              sb.from(POST_COMMENTS_TABLE).select('post_id,user_id,author_name,text,created_at').in('post_id', ids).order('created_at', { ascending: true }),
              sb.from(POST_VIEWS_TABLE).select('post_id').in('post_id', ids),
              sb.from(POST_SHARES_TABLE).select('post_id').in('post_id', ids),
            ]);

            const commenterIds = [...new Set((commentsRes.data || []).map(r => r.user_id).filter(Boolean))];
            let commentPhotoById = {};
            if (commenterIds.length) {
              const { data: commenterProfiles } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, photo').in('user_id', commenterIds);
              (commenterProfiles || []).forEach(p => { commentPhotoById[p.user_id] = p.photo; });
            }

            const likesByPost = {}, repostsByPost = {}, commentsByPost = {}, viewsByPost = {}, sharesByPost = {};
            const savedSet = new Set();
            (likesRes.data || []).forEach(r => { (likesByPost[r.post_id] = likesByPost[r.post_id] || []).push(r.user_id); });
            (repostsRes.data || []).forEach(r => { (repostsByPost[r.post_id] = repostsByPost[r.post_id] || []).push(r.user_id); });
            (savesRes.data || []).forEach(r => savedSet.add(r.post_id));
            (commentsRes.data || []).forEach(r => { (commentsByPost[r.post_id] = commentsByPost[r.post_id] || []).push({ name: r.author_name || 'Someone', text: r.text, userId: r.user_id || null, photo: (r.user_id && commentPhotoById[r.user_id]) || null }); });
            (viewsRes.data || []).forEach(r => { viewsByPost[r.post_id] = (viewsByPost[r.post_id] || 0) + 1; });
            (sharesRes.data || []).forEach(r => { sharesByPost[r.post_id] = (sharesByPost[r.post_id] || 0) + 1; });

            feedPosts.forEach(post => {
              const pid = String(post.id);
              const likeUsers = likesByPost[pid] || [];
              const repostUsers = repostsByPost[pid] || [];
              const remoteComments = commentsByPost[pid] || [];
              post.likes = likeUsers.length;
              post.liked = !!(myId && likeUsers.includes(myId));
              post.reposts = repostUsers.length;
              post.reposted = !!(myId && repostUsers.includes(myId));
              post.saved = savedSet.has(pid);
              post.commentsList = remoteComments;
              post.comments = remoteComments.length;
              post.views = viewsByPost[pid] || 0;
              post.shares = sharesByPost[pid] || 0;
            });
            rankFeedPosts();
          } catch (e) {  }
        }

        // ---- "Still posting" placeholder (shown until upload is fully done) ----
        // Mirrors the real grid shapes from postMediaGridHtml so the layout
        // never jumps once the real media swaps in -- 1 item is a single
        // block, 2/3/4+ items get the same column/row arrangement the real
        // grid will use, just filled with shimmer tiles instead of media.
        function uploadingMediaSkeletonHtml(count){
          const tile = `<div class="skel-shimmer w-full h-full"></div>`;
          const gap = 'gap:2px;';
          if (count <= 1) {
            return `<div class="skel-shimmer w-full" style="aspect-ratio:4/5;"></div>`;
          }
          if (count === 2) {
            return `<div class="grid" style="grid-template-columns:1fr 1fr;aspect-ratio:4/3;${gap}">${tile}${tile}</div>`;
          }
          if (count === 3) {
            return `<div class="grid" style="grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;aspect-ratio:4/3;${gap}"><div class="skel-shimmer w-full h-full" style="grid-row:1 / 3;"></div>${tile}${tile}</div>`;
          }
          return `<div class="grid" style="grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr 1fr;aspect-ratio:4/3;${gap}"><div class="skel-shimmer w-full h-full" style="grid-row:1 / 4;"></div>${tile}${tile}${tile}</div>`;
        }
        function uploadingPostMediaHtml(count){
          return `
            <div class="relative">
              ${uploadingMediaSkeletonHtml(count)}
              <div class="absolute inset-x-0 bottom-2 flex items-center justify-center pointer-events-none">
                <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-[11px] font-medium" style="background:rgba(0,0,0,0.55);">
                  <span class="inline-block rounded-full border-2 border-white/40 border-t-white animate-spin" style="width:11px;height:11px;"></span>
                  Posting…
                </div>
              </div>
            </div>`;
        }

        const PostsAPI = {
          list(){
            return mockRequest(() => feedPosts);
          },
          get(id){
            return mockRequest(() => feedPosts.find(p => p.id === id) || null);
          },
          create(data){
            const { mediaFile, mediaType, mediaFiles, mediaTypes, ...rest } = data;
            const files = mediaFiles && mediaFiles.length ? mediaFiles : (mediaFile ? [mediaFile] : []);
            const types = mediaTypes && mediaTypes.length ? mediaTypes : (mediaType ? [mediaType] : []);
            const willUpload = files.length > 0;
            // A post with media stays in an explicit "uploading" state --
            // rendered via uploadingPostMediaHtml above, shaped to match the
            // real grid it'll become -- until the real, fully-hosted media is
            // ready: uploaded to storage, video posters generated, and
            // arranged into its final grid HTML. That avoids the post
            // popping into the feed with a local blob preview (or a bare
            // black video box) that then shifts or swaps out from under the
            // user once the real upload finishes; the post only appears
            // "final" once it actually is.
            delete rest.mediaHtml;
            const post = {
              id: Date.now(),
              avatarIcon: 'user', avatarBg: 'bg-blue-100', name: profileData.name, meta: 'now',
              connected: true, verified: false, mine: true,
              body: '', mediaHtml: null,
              likes: 0, liked: false, reposts: 0, reposted: false, shares: 0, comments: 0, commentsList: [], saved: false, views: 0,
              ...rest,
              uploading: willUpload,
              uploadCount: files.length,
            };
            feedPosts.unshift(post);
            queueSaveUserState();
            const background = (async () => {
              if (files.length) {
                const uploads = await Promise.all(files.map((f, i) => uploadPostMediaToStorage(f, post.id + '-' + i)));
                const posterUploads = await Promise.all(files.map(async (f, i) => {
                  if ((types[i] || 'image') !== 'video') return null;
                  const posterFile = await generateVideoPosterFile(f, i);
                  if (!posterFile) return null;
                  return uploadPostMediaToStorage(posterFile, post.id + '-' + i + '-poster');
                }));
                const okItems = uploads
                  .map((u, i) => u ? { url: u.url, type: types[i] || 'image', path: u.path, posterUrl: posterUploads[i] ? posterUploads[i].url : undefined, posterPath: posterUploads[i] ? posterUploads[i].path : undefined } : null)
                  .filter(Boolean);
                if (okItems.length) {
                  post.mediaPaths = okItems.flatMap(it => it.posterPath ? [it.path, it.posterPath] : [it.path]);
                  post.mediaPath = post.mediaPaths[0];
                  post.mediaHtml = postMediaHtmlFromUploaded(okItems);
                }
                post.uploading = false;
                queueSaveUserState();
                refreshFeedPostCard(post.id);
                if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
              }
              // postInsertRemote used to be fire-and-forget here: if the
              // insert failed silently (flaky network, an RLS hiccup),
              // submitPost() still reported success and the post stuck
              // around forever in this device's own saved state -- a
              // "ghost" post nobody else could ever see, since the
              // "always keep my own posts" merge rule in
              // loadRemotePostsImpl never re-checked whether it had
              // actually reached the server. So a failed insert still rolls
              // the optimistic local post back out here and lets the
              // person know, instead of quietly leaving a phantom post
              // behind.
              const inserted = await postInsertRemote(post);
              if (!inserted) {
                feedPosts = feedPosts.filter(p => p.id !== post.id);
                queueSaveUserState();
                refreshFeedPostCard(post.id);
                if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
                if (typeof openAppAlertModal === 'function') openAppAlertModal('Your post could not be saved and was removed. Please check your connection and try again.');
              }
            })();
            background.catch(err => console.warn('Post background sync failed:', err));
            // Exposed so callers (submitPost's postSubmitInFlight guard) can
            // wait for the real upload+insert to finish before letting the
            // person submit again -- see the note on postSubmitInFlight in
            // overlays.js for why resolving before this was ready let a
            // genuine second tap slip through and create a real duplicate
            // row in the shared posts table.
            post._pending = background;
            return Promise.resolve(post);
          },
          remove(id){
            return mockRequest(() => {
              const removed = feedPosts.find(p => p.id === id);
              const removedIndex = feedPosts.indexOf(removed);
              feedPosts = feedPosts.filter(p => p.id !== id);
              deletedPostIds.add(String(id));
              queueSaveUserState();
              postDeleteRemote(id).then(ok => {
                if (ok) {
                  deletedPostIds.delete(String(id));
                  queueSaveUserState();
                  // Only clear the media out of storage once the row itself
                  // is confirmed gone -- doing this unconditionally used to
                  // mean a failed delete could still strand a restored post
                  // with its images wiped out from under it.
                  if (removed && removed.mine && removed.mediaPaths && removed.mediaPaths.length) deletePostMediaListFromStorage(removed.mediaPaths);
                  else if (removed && removed.mine && removed.mediaPath) deletePostMediaFromStorage(removed.mediaPath);
                  return;
                }
                // The delete never actually reached the server (RLS
                // rejection, dropped connection, etc). Leaving the local
                // state saying "gone" while the server still has the row is
                // exactly what let a deleted post quietly reappear later --
                // once deletedPostIds resets on a fresh session/reload, the
                // still-live row comes right back in via loadRemotePosts.
                // Put it back and say so, instead of pretending it worked.
                deletedPostIds.delete(String(id));
                if (removed && !feedPosts.some(p => p.id === id)) {
                  const insertAt = Math.min(removedIndex, feedPosts.length);
                  feedPosts.splice(insertAt < 0 ? feedPosts.length : insertAt, 0, removed);
                }
                queueSaveUserState();
                if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
                if (typeof refreshFeedPostCard === 'function') refreshFeedPostCard(id);
                if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
                if (typeof openAppAlertModal === 'function') openAppAlertModal("Your post couldn't be deleted. Please check your connection and try again.");
              });
              return { id };
            });
          },
          removeByAuthor(name){
            return mockRequest(() => {
              feedPosts = feedPosts.filter(p => p.name !== name);
              queueSaveUserState();
              return { name };
            });
          },
          toggleLike(id){
            return mockRequest(() => {
              const post = feedPosts.find(p => p.id === id);
              if (!post) return null;
              post.liked = !post.liked;
              post.likes += post.liked ? 1 : -1;
              queueSaveUserState();
              postLikeRemote(id, post.liked); 
              return post;
            });
          },
          toggleRepost(id){
            return mockRequest(() => {
              const post = feedPosts.find(p => p.id === id);
              if (!post) return null;
              post.reposted = !post.reposted;
              post.reposts += post.reposted ? 1 : -1;
              queueSaveUserState();
              postRepostRemote(id, post.reposted); 

              if (post.reposted) {
                const original = post.isRepost ? (findPost(post.repostOf) || post) : post;
                const repostPost = {
                  id: Date.now(),
                  avatarIcon: 'user', avatarBg: 'bg-blue-100', name: profileData.name, meta: 'now',
                  connected: true, verified: false, mine: true,
                  isRepost: true, repostOf: original.id,
                  repostAuthorName: original.name, repostAuthorIcon: original.avatarIcon,
                  repostAuthorBg: original.avatarBg, repostAuthorId: original.authorId || null,
                  body: original.body, mediaHtml: original.mediaHtml, tag: original.tag, tagClass: original.tagClass,
                  likes: 0, liked: false, reposts: 0, reposted: false, shares: 0, comments: 0, commentsList: [], saved: false, views: 0,
                };
                feedPosts.unshift(repostPost);
                post.myRepostId = repostPost.id; 
                queueSaveUserState();
                postInsertRemote(repostPost); 
              } else if (post.myRepostId) {
                feedPosts = feedPosts.filter(p => p.id !== post.myRepostId);
                postDeleteRemote(post.myRepostId);
                post.myRepostId = null;
                queueSaveUserState();
              }

              return post;
            });
          },
          toggleSave(id){
            return mockRequest(() => {
              const post = feedPosts.find(p => p.id === id);
              if (!post) return null;
              post.saved = !post.saved;
              queueSaveUserState();
              postSaveRemote(id, post.saved); 
              return post;
            });
          },
          addComment(id, text){
            return mockRequest(() => {
              const post = feedPosts.find(p => p.id === id);
              if (!post) return null;
              post.commentsList.push({ name: 'You', text, photo: (typeof profileData !== 'undefined' ? profileData.photo : null) || null });
              post.comments++;
              queueSaveUserState();
              postCommentRemote(id, text); 
              return post;
            });
          },
          share(id){
            return mockRequest(() => {
              const post = feedPosts.find(p => p.id === id);
              if (!post) return null;
              post.shares = (post.shares || 0) + 1;
              queueSaveUserState();
              postShareRemote(id); 
              return post;
            });
          },
        };

        const GlimpsesAPI = {
          list(){
            return mockRequest(() => {
              purgeExpiredGlimpses();
              return myGlimpses;
            });
          },
          create(data){
            const { mediaFile, ...rest } = data;
            const now = new Date();
            const timeLabel = 'Today, ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const glimpse = { id: Date.now(), createdAt: Date.now(), timeLabel, type: 'text', viewers: [], ...rest };
            myGlimpses.unshift(glimpse);
            queueSaveUserState();
            if (mediaFile) {
              uploadPostMediaToStorage(mediaFile, glimpse.id).then(uploaded => {
                if (uploaded) {
                  glimpse.mediaUrl = uploaded.url;
                  glimpse.mediaPath = uploaded.path;
                  queueSaveUserState();
                  refreshMyGlimpses();
                  refreshStoryStrip();
                }
                glimpseInsertRemote(glimpse); 
              });
            } else {
              glimpseInsertRemote(glimpse);
            }
            return mockRequest(() => glimpse);
          },
          remove(id){
            return mockRequest(() => {
              const removed = myGlimpses.find(g => g.id === id);
              myGlimpses = myGlimpses.filter(g => g.id !== id);
              queueSaveUserState();
              if (removed && removed.mediaPath) deletePostMediaFromStorage(removed.mediaPath);
              glimpseDeleteRemote(id);
              return { id };
            });
          },
        };

        setInterval(() => {
          if (purgeExpiredGlimpses()) refreshMyGlimpses();
        }, 60 * 1000);

        let blockedAccounts = [];

        const NetworkAPI = {
          listBlocked(){
            return mockRequest(() => blockedAccounts);
          },
          block(name, icon, avatarBg, photo){
            return mockRequest(() => {
              if (!blockedAccounts.some(b => b.name === name)) {
                blockedAccounts.push({ name, icon: icon || 'user', avatarBg: avatarBg || 'bg-gray-200', photo: photo || null });
              }
              queueSaveUserState();
              return blockedAccounts;
            });
          },
          unblock(name){
            return mockRequest(() => {
              blockedAccounts = blockedAccounts.filter(b => b.name !== name);
              queueSaveUserState();
              return blockedAccounts;
            });
          },
        };

        // ---- Post-level actions (block/save/menu/delete/report) ----
        function blockAccount(name, icon, avatarBg, photo){
          if (!name) return;
          NetworkAPI.block(name, icon, avatarBg, photo);
          PostsAPI.removeByAuthor(name);
        }

        function unblockAccount(name){
          NetworkAPI.unblock(name).then(() => renderBlockedAccountsOverlay());
        }

        // Shared guard for every write-action entry point below. Cached
        // posts can already be stale (liked/deleted/edited elsewhere) by
        // the time a slow connection catches up, so likes/comments/
        // reposts/shares/saves are blocked outright while on the cached
        // snapshot rather than letting them appear to work and then
        // silently fail (or worse, silently succeed against a post that's
        // since changed) once a request finally goes out.
        function blockedWhileShowingCachedFeed(){
          if (!feedShowingCachedOnly) return false;
          openAppAlertModal("You're viewing saved posts from your last session. Reconnect to the internet to like, comment, repost, share, or post.", "Reconnecting...");
          return true;
        }

        function toggleSavePost(id){
          if (blockedWhileShowingCachedFeed()) return;
          PostsAPI.toggleSave(id).then(post => {
            if (!post) return;
            forEachById('save-btn-'+id, btn => {
              const isReelDetail = btn.closest('#video-post-' + id) != null;
              btn.className = isReelDetail
                ? `flex flex-col items-center ${post.saved ? `text-[${ROYAL}]` : 'text-white'}`
                : `p-1 -mr-1 ${post.saved ? `text-[${ROYAL}]` : 'text-gray-500'}`;
            });
            if (typeof renderSavedItemsOverlay === 'function') renderSavedItemsOverlay();
            if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
            if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          });
        }

        function refreshFeedPostCard(id){
          const post = findPost(id);
          document.querySelectorAll(`[id="post-${id}"]`).forEach(el => {
            if (!post) { el.remove(); return; }
            const wrap = document.createElement('div');
            wrap.innerHTML = feedPost(post);
            const fresh = wrap.firstElementChild;
            if (fresh) el.replaceWith(fresh);
          });
          const overlayEl = document.getElementById('overlay');
          const overlayVisible = overlayEl && !overlayEl.classList.contains('hidden');
          const activeListEl = overlayVisible ? document.getElementById('post-feed-list') : document.getElementById('feed-list');
          if (activeListEl) setupFeedVideoAutoplay(activeListEl);
        }

        let openPostMenuId = null;

        function postMenuDropdownHtml(post){
          if (openPostMenuId !== post.id) return '';
          return `
            <div id="post-menu-backdrop-${post.id}" onclick="togglePostMenu(${post.id})" onwheel="closePostMenuOnScroll(${post.id})" ontouchmove="closePostMenuOnScroll(${post.id})" class="fixed inset-0 z-10"></div>
            <div id="post-menu-dropdown-${post.id}" class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1rem;top:2.75rem;width:11rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
              ${post.mine
                ? `<button onclick="deletePost(${post.id})" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete post</button>`
                : `
                  <button onclick="notInterestedPost(${post.id})" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('close','w-4 h-4')} Not interested</button>
                  <button onclick="${isPostReported(post.id) ? '' : `reportPost(${post.id})`}" ${isPostReported(post.id) ? 'disabled' : ''} class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left menu-item-pill ${isPostReported(post.id) ? 'text-gray-400' : 'text-red-500'}">${Icon('flag','w-4 h-4')} ${isPostReported(post.id) ? 'Reported' : 'Report'}</button>
                `}
            </div>
          `;
        }

        function removePostMenuDom(id){
          document.querySelectorAll(`[id="post-menu-backdrop-${id}"]`).forEach(el => el.remove());
          document.querySelectorAll(`[id="post-menu-dropdown-${id}"]`).forEach(el => el.remove());
        }

        function togglePostMenu(id){
          const previousId = openPostMenuId;
          const willOpen = previousId !== id;
          if (previousId !== null) removePostMenuDom(previousId);
          openPostMenuId = willOpen ? id : null;
          if (willOpen) {
            const post = findPost(id);
            if (post) {
              document.querySelectorAll(`[id="post-header-${id}"]`).forEach(headerEl => {
                headerEl.insertAdjacentHTML('beforeend', postMenuDropdownHtml(post));
              });
            }
          }
          const overlayEl = document.getElementById('overlay');
          const overlayVisible = overlayEl && !overlayEl.classList.contains('hidden');
          const scrollEl = overlayVisible ? document.getElementById('post-feed-list') : document.getElementById('screen');
          attachMenuScrollCloser(scrollEl, openPostMenuId === id, () => closePostMenuOnScroll(id));
        }

        function closePostMenuOnScroll(id){
          if (openPostMenuId !== id) return;
          openPostMenuId = null;
          removePostMenuDom(id);
        }

        function deletePost(id){
          PostsAPI.remove(id).then(() => {
            openPostMenuId = null;
            refreshFeedPostCard(id);
            if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
            if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          });
        }

        function notInterestedPost(id){
          openPostMenuId = null;
          PostsAPI.remove(id).then(() => refreshFeedPostCard(id));
        }

        let reportedPosts = new Set();

        function isPostReported(id){
          return reportedPosts.has(id);
        }

        function reportPost(id){
          if (isPostReported(id)) return;
          reportedPosts.add(id);
          queueSaveUserState();
          openPostMenuId = null;
          removePostMenuDom(id);
          openAppAlertModal('Thanks for letting us know. This post has been reported and our team will review it.');
        }

        async function connectWithPoster(id){
          const post = findPost(id);
          if (!post || !post.authorId || post.connectRequestSent) return;
          post.connectRequestSent = true; 
          renderFeed();
          const ok = await sendConnectionRequestTo(post.authorId);
          if (!ok) { post.connectRequestSent = false; renderFeed(); }
        }

        async function cancelConnectWithPoster(id){
          const post = findPost(id);
          if (!post || !post.authorId || !post.connectRequestSent) return;
          const authorId = post.authorId;
          feedPosts.forEach(p => { if (p.authorId === authorId) p.connectRequestSent = false; }); 
          renderFeed();
          const ok = await cancelMyConnectionRequestTo(authorId);
          if (!ok) {
            feedPosts.forEach(p => { if (p.authorId === authorId) p.connectRequestSent = true; });
            renderFeed();
            return;
          }
          if (typeof clearRequestSentLocally === 'function') clearRequestSentLocally(authorId);
        }

        // ---- Post card rendering (main feed item) ----
        function openPersonProfileForPost(id){
          const post = findPost(id);
          if (!post || !post.authorId) return;
          openPersonProfile(post.authorId, {
            name: post.name, icon: post.avatarIcon, avatarBg: post.avatarBg,
            photo: post.mine ? profileData.photo : null,
          });
        }

        function verifiedBadge(){
          return `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 flex-shrink-0" fill="${ROYAL}"><path fill-rule="evenodd" d="M12 2.25c-.71 0-1.35.36-1.76.93a2.08 2.08 0 00-2.53.7 2.08 2.08 0 00-.98 2.33 2.08 2.08 0 00-1.65 1.95 2.08 2.08 0 00-.7 2.53 2.08 2.08 0 00.93 2.31c-.02.15-.03.3-.03.45 0 1.02.7 1.87 1.65 2.1.06.99.75 1.83 1.72 2.05.16.9.85 1.62 1.76 1.8.28.85 1.08 1.47 2.03 1.47s1.75-.62 2.03-1.47c.91-.18 1.6-.9 1.76-1.8.97-.22 1.66-1.06 1.72-2.05.95-.23 1.65-1.08 1.65-2.1 0-.15-.01-.3-.03-.45.55-.42.93-1.08.93-1.83s-.38-1.41-.93-1.83c.03-.15.03-.3.03-.45a2.08 2.08 0 00-1.65-1.95 2.08 2.08 0 00-.98-2.33 2.08 2.08 0 00-2.53-.7A2.08 2.08 0 0012 2.25zm3.7 8.1l-4.2 4.2a.75.75 0 01-1.06 0l-2.1-2.1a.75.75 0 111.06-1.06l1.57 1.57 3.67-3.67a.75.75 0 111.06 1.06z" clip-rule="evenodd"/></svg>`;
        }

        function formatPostTimeAgo(post){
          const created = Number(post.id);
          if (!created) return post.timeAgo || post.meta || '';
          const diffMs = Date.now() - created;
          const minute = 60000, hour = 3600000, day = 86400000;
          if (diffMs < minute) return 'Now';
          if (diffMs < hour) return Math.floor(diffMs / minute) + 'm ago';
          if (diffMs < day) return Math.floor(diffMs / hour) + 'h ago';
          if (diffMs < 2 * day) return 'a day ago';
          if (diffMs < 7 * day) return Math.floor(diffMs / day) + ' days ago';
          return new Date(created).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: created < Date.now() - 365 * day ? 'numeric' : undefined });
        }

        function renderPostBodyHtml(post){
          const escapedBody = escapeHtml(post.body);
          let out = linkifyHashtags(escapedBody);
          const tagged = Array.isArray(post.taggedUsers) ? post.taggedUsers : [];
          tagged.forEach(t => {
            if (!t || !t.username) return;
            const escapedUsername = t.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp('(^|\\s)@' + escapedUsername + '(?=\\s|$)', 'gi');
            out = out.replace(re, (m, pre) => `${pre}<span class="font-semibold cursor-pointer" style="color:${ROYAL}" onclick="event.stopPropagation(); openPersonProfile('${escapeForJsAttr(t.id)}')">@${escapeHtml(t.username)}</span>`);
          });
          return out;
        }

        // ---- Hashtags: turn "#word" into a tappable link to that
        // hashtag's own feed (see openHashtagFeed / postListForSource
        // below), and let trending hashtags be computed straight from
        // the posts everyone already has -- no separate hashtag table
        // needed, since post text is already synced for everyone.
        function linkifyHashtags(escapedText){
          return escapedText.replace(/(^|[\s(])#([A-Za-z0-9_]{1,50})\b/g, (m, pre, tag) => {
            return `${pre}<span class="font-semibold cursor-pointer" style="color:${ROYAL}" onclick="event.stopPropagation(); openHashtagFeed('${tag.toLowerCase()}')">#${escapeHtml(tag)}</span>`;
          });
        }

        function extractHashtags(text){
          if (!text) return [];
          const seen = new Set();
          const re = /#([A-Za-z0-9_]{1,50})\b/g;
          let m;
          while ((m = re.exec(text))) seen.add(m[1].toLowerCase());
          return Array.from(seen);
        }

        function computeTrendingHashtags(limit){
          limit = limit || 12;
          const counts = new Map();
          feedPosts.forEach(p => {
            extractHashtags(p.body).forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
          });
          return Array.from(counts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
            .slice(0, limit);
        }

        function openHashtagFeed(tag){
          openPostFeedFrom('hashtag:' + String(tag).toLowerCase());
        }

        function trendingHashtagsRowHTML(){
          const trending = computeTrendingHashtags(12);
          if (!trending.length) return '';
          return `
            <div class="-mx-5 mb-4 pb-1 border-b border-gray-100">
              <div class="flex gap-2 overflow-x-auto no-scrollbar px-5 pb-3" style="scroll-snap-type:x proximity;">
                ${trending.map(t => `
                  <button onclick="openHashtagFeed('${t.tag}')" class="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold" style="background:rgba(10,37,64,0.06);color:${NAVY};scroll-snap-align:start;">
                    <span>#${escapeHtml(t.tag)}</span>
                    <span class="text-gray-400 font-medium">${formatCount(t.count)}</span>
                  </button>`).join('')}
              </div>
            </div>`;
        }

        function gradientHeartIcon(cls){
          const gid = 'heartGrad' + Math.random().toString(36).slice(2, 9);
          return `<svg viewBox="0 0 24 24" class="${cls}"><defs><linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${NAVY}"/><stop offset="100%" stop-color="${ROYAL}"/></linearGradient></defs><path fill="url(#${gid})" d="M11.645 20.91l-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012a.752.752 0 01-.704 0z"/></svg>`;
        }

        function feedPostHeaderHtml(post, isStranger, showConnect, showRequestSent, overlay){
          const nameCls = overlay ? 'font-semibold text-[13px] truncate text-white' : 'font-semibold text-[13px] truncate';
          // FIX: "text-white/80" was never generated in the static styles.css (only text-white
          // and text-white/60 exist there), so the class did nothing and "Now" rendered in the
          // default dark text color instead of white. Using text-white/60, which does exist.
          const timeCls = overlay ? 'text-[11px] text-white/60 truncate' : 'text-[11px] text-gray-500 truncate';
          const dotsCls = overlay ? 'w-7 h-7 flex items-center justify-center text-white flex-shrink-0' : 'w-7 h-7 flex items-center justify-center text-gray-400 flex-shrink-0';
          const connectCls = overlay
            ? 'text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-white/20 text-white border-white/60'
            : 'text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0';
          const connectStyle = overlay ? 'border:1.5px solid rgba(255,255,255,0.6);' : `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};`;
          // FIX: the overlay header must be taken out of normal document flow so it floats
          // on top of the video instead of sitting beside it. Previously this class list had
          // BOTH "relative" and "absolute" — since .relative is defined after .absolute in the
          // compiled Tailwind stylesheet, "position: relative" was winning, so the header stayed
          // in-flow as a second flex child of .feed-media (display:flex). That split single-video
          // posts into two columns: the video on the left, and the (mispositioned) name/avatar
          // header floating alone on the right. Removing "relative" here lets "absolute" apply.
          const rowCls = overlay
            ? 'px-4 py-2.5 flex gap-2.5 items-center absolute top-0 left-0 right-0 z-10'
            : 'px-4 py-2 flex gap-2.5 items-center relative';
          const rowStyle = overlay ? 'background:linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0));' : '';
          return `
              <div id="post-header-${post.id}" class="${rowCls}" style="${rowStyle}">
                <div class="w-7 h-7 rounded-full ${post.avatarBg} overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForPost(${post.id})">${(post.mine && profileData.photo) ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : (!post.mine && post.photo) ? `<img src="${post.photo}" class="w-full h-full object-cover">` : Icon(post.avatarIcon,'w-3.5 h-3.5 text-gray-600')}</div>
                <div class="flex-1 min-w-0 cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForPost(${post.id})">
                  <div class="flex items-center gap-1">
                    <span class="${nameCls}">${escapeHtml(post.mine ? (profileData.name || post.name) : post.name) || 'Stitch member'}</span>
                    ${post.verified ? verifiedBadge() : ''}
                  </div>
                  <div class="${timeCls}">${isStranger ? 'Suggested for you' : formatPostTimeAgo(post)}</div>
                </div>
                ${showConnect ? `
                  <button onclick="event.stopPropagation(); connectWithPoster(${post.id})" class="${connectCls}" style="${connectStyle}">Connect</button>
                ` : ''}
                ${showRequestSent ? `
                  <button onclick="event.stopPropagation(); cancelConnectWithPoster(${post.id})" class="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0 ${overlay ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}">Cancel Request</button>
                ` : ''}
                <button onclick="event.stopPropagation(); togglePostMenu(${post.id})" class="${dotsCls}">${IconBold('dots','w-4 h-4')}</button>
                ${postMenuDropdownHtml(post)}
              </div>`;
        }

        function feedPost(post){
          const isStranger = !post.mine && !!post.authorId && !isUserInMyNetwork(post.authorId);
          const showConnect = isStranger && !post.connectRequestSent;
          const showRequestSent = isStranger && post.connectRequestSent;
          // NOTE: multi-media grids use the "post-media-grid" class (see postMediaGridHtml),
          // not "post-media-carousel". This was checking for a class name that's never actually
          // produced, so it never excluded anything. Harmless today (grid tiles don't use
          // "feed-video-wrap" either, so isVideoPost still came out false for grids) — fixed
          // for correctness/future-proofing in case the grid markup changes.
          const isVideoPost = !!post.mediaHtml && /feed-video-wrap/.test(post.mediaHtml) && !/post-media-grid/.test(post.mediaHtml);
          const mediaAreaHtml = post.uploading ? uploadingPostMediaHtml(post.uploadCount || 1) : (post.mediaHtml || '');
          return `
            <div class="bg-white overflow-hidden -mx-5 border-b border-gray-100" id="post-${post.id}">
              ${post.isRepost ? `
                <div class="px-4 pt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                  ${Icon('repost','w-3.5 h-3.5')}
                  <span>${post.mine ? 'You' : escapeHtml(post.name)} reposted</span>
                </div>` : ''}
              ${isVideoPost ? '' : feedPostHeaderHtml(post, isStranger, showConnect, showRequestSent, false)}

              <div class="feed-media relative" ${post.uploading ? '' : `onclick="handleFeedMediaTap(event, ${post.id})"`} style="cursor:${post.uploading ? 'default' : 'pointer'};">${mediaAreaHtml}${isVideoPost ? feedPostHeaderHtml(post, isStranger, showConnect, showRequestSent, true) : ''}</div>

              <div class="flex items-center justify-between px-3.5 pt-1.5 text-gray-800">
                <button onclick="toggleLike(${post.id})" id="like-btn-${post.id}" class="p-1 -ml-1 flex items-center gap-1 ${post.liked ? `text-[${ROYAL}]` : 'text-gray-500'}">
                  <span id="like-icon-${post.id}">${post.liked ? gradientHeartIcon('w-[18px] h-[18px]') : Icon('heartOutline','w-[18px] h-[18px]')}</span>
                  <span class="text-[12px]" id="like-inline-count-${post.id}">${formatCount(post.likes)}</span>
                </button>
                <button onclick="openComments(${post.id})" id="comment-btn-${post.id}" class="p-1 flex items-center gap-1 text-gray-500">
                  ${Icon('comment','w-[18px] h-[18px]')}
                  <span class="text-[12px]" id="comment-inline-count-${post.id}">${formatCount(post.comments)}</span>
                </button>
                <button onclick="toggleRepost(${post.id})" id="repost-btn-${post.id}" class="p-1 flex items-center gap-1 ${post.reposted ? 'text-emerald-600' : 'text-gray-500'}">
                  ${Icon('repost','w-[18px] h-[18px]')}
                  <span class="text-[12px]" id="repost-inline-count-${post.id}">${formatCount(post.reposts)}</span>
                </button>
                <button onclick="openShare(${post.id})" id="share-btn-${post.id}" class="p-1 flex items-center gap-1 text-gray-500">
                  ${Icon('send','w-[18px] h-[18px]')}
                </button>
                <button onclick="toggleSavePost(${post.id})" id="save-btn-${post.id}" class="p-1 -mr-1 ${post.saved ? `text-[${ROYAL}]` : 'text-gray-500'}">${Icon('bookmark','w-[18px] h-[18px]')}</button>
              </div>

              <div class="px-3.5 pt-1.5 text-[13px] font-semibold" id="like-count-${post.id}">${post.likes.toLocaleString()} likes</div>

              ${(post.body && post.body.trim()) || (post.isRepost && post.repostAuthorName && post.repostAuthorName !== post.name) ? `
              <div class="px-3.5 pt-1 text-[13px] leading-snug">
                <span>${renderPostBodyHtml(post)}</span>
                ${post.isRepost && post.repostAuthorName && post.repostAuthorName !== post.name ? `<div class="text-[11px] text-gray-400 mt-0.5">Originally posted by ${escapeHtml(post.repostAuthorName)}</div>` : ''}
              </div>
              ` : ''}

              <button onclick="openComments(${post.id})" class="px-3.5 pt-1 pb-3 block text-[12px] text-gray-400" id="comment-count-${post.id}">
                ${post.comments > 0 ? `View all ${post.comments} comments` : 'Add a comment...'}
              </button>
            </div>`;
        }

        function handleFeedMediaTap(evt, postId){
          openPostDetail(postId, evt);
        }

        let reelSwipeEnabled = false;
        function openPostDetail(id, evt){
          const post = findPost(id);
          if (!post) return;
          document.querySelectorAll('#feed-list video, #post-feed-list video').forEach(v => {
            if (!v.paused) {
              v.pause();
              const btn = v.closest('.feed-video-wrap') && v.closest('.feed-video-wrap').querySelector('.feed-video-playbtn');
              if (btn) btn.style.opacity = '1';
            }
          });
          if (feedVideoObserver) { feedVideoObserver.disconnect(); feedVideoObserver = null; }
          if (feedVideoPreloadObserver) { feedVideoPreloadObserver.disconnect(); feedVideoPreloadObserver = null; }
          const isMulti = !!(post.mediaHtml && /post-media-grid/.test(post.mediaHtml));
          const hasSingleMedia = !isMulti && !!post.mediaHtml;
          reelSwipeEnabled = !!(evt && evt.currentTarget && evt.currentTarget.closest && evt.currentTarget.closest('#post-feed-list'));
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = hasSingleMedia ? '0' : OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = hasSingleMedia ? reelPostDetailHTML(post) : postDetailHTML(post);
          activeReelPostId = hasSingleMedia ? post.id : null;
          const bottomNavEl = document.getElementById('bottom-nav');
          const classroomNavEl = document.getElementById('classroom-nav');
          if (bottomNavEl) bottomNavEl.style.display = 'none';
          if (classroomNavEl) classroomNavEl.style.display = 'none';
          if (!post.mine && !viewedThisSession.has(String(id))) {
            post.views = (post.views || 0) + 1;
          }
          postViewRemote(id);
        }

        // ---- Reel-style (full-screen) post detail + swipe nav ----
        let activeReelPostId = null;
        function reelPostQueue(){
          return postListForSource(postFeedSource).filter(p => p.mediaHtml && !/post-media-grid/.test(p.mediaHtml));
        }

        function navigateReelPost(currentId, direction){
          if (!reelSwipeEnabled) return;
          const post = findPost(currentId);
          if (!post) return;
          const queue = reelPostQueue();
          const idx = queue.findIndex(p => String(p.id) === String(post.id));
          if (idx === -1) return;
          const nextPost = queue[idx + direction];
          if (!nextPost) return; 
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const outgoingVideo = ov.querySelector('video');
          if (outgoingVideo && !outgoingVideo.paused) outgoingVideo.pause();
          ov.innerHTML = reelPostDetailHTML(nextPost);
          activeReelPostId = nextPost.id;
          if (!nextPost.mine && !viewedThisSession.has(String(nextPost.id))) {
            nextPost.views = (nextPost.views || 0) + 1;
          }
          postViewRemote(nextPost.id);
        }

        let vpdSwipeStartX = null;
        let vpdSwipeStartY = null;
        function vpdTouchStart(e){
          const t = e.touches && e.touches[0];
          if (!t) return;
          vpdSwipeStartX = t.clientX;
          vpdSwipeStartY = t.clientY;
        }
        function vpdTouchEnd(e, postId){
          if (vpdSwipeStartY == null) return;
          const startX = vpdSwipeStartX, startY = vpdSwipeStartY;
          vpdSwipeStartX = null; vpdSwipeStartY = null;
          const t = e.changedTouches && e.changedTouches[0];
          if (!t) return;
          const dy = t.clientY - startY;
          const dx = t.clientX - startX;
          const SWIPE_THRESHOLD = 60;
          // Swipe left/right between posts (not up/down) -- mirrors the
          // same-post image gallery's horizontal swipe below.
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
          navigateReelPost(postId, dx < 0 ? 1 : -1);
        }

        function framedMediaLayerHtml(media, extraImgAttrs, anchorTop){
          if (!media) return '';
          // anchorTop pins object-position to the top instead of the
          // default center. Used when this media sits behind the comments
          // sheet, which covers the bottom ~58-92% of the screen --
          // centering the media there would push most of it behind the
          // sheet, leaving a big unused gap up top. Anchoring to the top
          // means whatever's visible above the sheet is an actual part of
          // the post instead of empty letterboxing. Other callers (the
          // full reel viewer, the image carousel) keep the normal centered
          // framing since there's no sheet covering them.
          const objPos = anchorTop ? 'top' : 'center';
          if (media.type === 'video') {
            return `<video src="${media.url}" class="absolute inset-0 w-full h-full" style="object-fit:contain;object-position:${objPos};background:#000;" ${extraImgAttrs || ''}></video>`;
          }
          return `
            <div class="absolute inset-0" style="background-image:url('${media.url}');background-size:cover;background-position:center;filter:blur(28px) brightness(0.55);transform:scale(1.15);"></div>
            <img src="${media.url}" class="absolute inset-0 w-full h-full" style="object-fit:contain;object-position:${objPos};">`;
        }

        function reelPostDetailHTML(post){
          const media = extractPostMedia(post);
          const isVideo = !!media && media.type === 'video';
          const uid = 'vpd' + post.id;
          const captionHtml = renderPostBodyHtml(post);
          const videoAttrs = 'playsinline webkit-playsinline disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" loop onloadedmetadata="attemptFeedVideoPlay(this, this.closest(\'.feed-video-wrap\').querySelector(\'.feed-video-playbtn\'))"';
          return `
            <div class="relative w-full h-full bg-black overflow-hidden" id="video-post-${post.id}" ontouchstart="vpdTouchStart(event)" ontouchend="vpdTouchEnd(event, ${post.id})">
              <div class="absolute inset-0 feed-video-wrap" id="${uid}" ${isVideo ? `onclick="toggleFeedVideoPlay('${uid}')"` : ''}>
                ${framedMediaLayerHtml(media, isVideo ? videoAttrs : '')}
                ${isVideo ? `
                <div class="feed-video-playbtn absolute inset-0 flex items-center justify-center" style="pointer-events:none;opacity:0;">
                  <div class="flex items-center justify-center rounded-full" style="width:4rem;height:4rem;background:rgba(0,0,0,0.45);">${Icon('play','w-7 h-7 text-white')}</div>
                </div>
                <button type="button" onclick="event.stopPropagation(); toggleFeedVideoMute('${uid}')" class="feed-video-mutebtn absolute flex items-center justify-center rounded-full" style="bottom:50px;right:14px;width:2.5rem;height:2.5rem;background:rgba(0,0,0,0.45);">${Icon('volume','w-5 h-5 text-white')}</button>` : ''}
              </div>

              <button onclick="event.stopPropagation(); closeOverlay()" class="absolute z-20 flex items-center justify-center rounded-full" style="top:calc(env(safe-area-inset-top, 12px) + 12px);left:14px;width:2.25rem;height:2.25rem;background:rgba(0,0,0,0.35);">${IconBold('back','w-5 h-5 text-white')}</button>
            </div>`;
        }

        // ---- Post media gallery (swipe through images) ----
        let activeGalleryPostId = null;
        let activeGalleryIndex = 0;
        function openPostMediaGallery(postId, index){
          const post = findPost(postId);
          if (!post) return;
          document.querySelectorAll('#feed-list video, #post-feed-list video').forEach(v => {
            if (!v.paused) v.pause();
          });
          if (feedVideoObserver) { feedVideoObserver.disconnect(); feedVideoObserver = null; }
          if (feedVideoPreloadObserver) { feedVideoPreloadObserver.disconnect(); feedVideoPreloadObserver = null; }
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = postMediaGalleryHTML(post, index || 0);
          activeGalleryPostId = postId;
          activeGalleryIndex = index || 0;
          const bottomNavEl = document.getElementById('bottom-nav');
          const classroomNavEl = document.getElementById('classroom-nav');
          if (bottomNavEl) bottomNavEl.style.display = 'none';
          if (classroomNavEl) classroomNavEl.style.display = 'none';
          if (!post.mine && !viewedThisSession.has(String(postId))) {
            post.views = (post.views || 0) + 1;
          }
          postViewRemote(postId);
        }

        function postMediaGalleryHTML(post, index){
          const items = postMediaItemsList(post);
          const item = items[index] || items[0] || null;
          const isVideo = !!item && item.type === 'video';
          const videoAttrs = 'playsinline webkit-playsinline muted controls';
          return `
            <div class="relative w-full h-full bg-black overflow-hidden" id="gallery-post-${post.id}" ontouchstart="galleryTouchStart(event)" ontouchend="galleryTouchEnd(event, ${post.id}, ${index})">
              <div class="absolute inset-0">
                ${framedMediaLayerHtml(item, isVideo ? videoAttrs : '')}
              </div>

              ${items.length > 1 ? `
              <div class="absolute z-20 flex items-center gap-1.5" style="top:calc(env(safe-area-inset-top, 12px) + 16px);left:50%;transform:translateX(-50%);">
                ${items.map((it, i) => `<span class="rounded-full" style="width:${i === index ? '16px' : '5px'};height:5px;background:${i === index ? '#ffffff' : 'rgba(255,255,255,0.5)'};box-shadow:0 0 2px rgba(0,0,0,0.4);transition:width .15s;"></span>`).join('')}
              </div>` : ''}

              <button onclick="event.stopPropagation(); closeOverlay()" class="absolute z-20 flex items-center justify-center rounded-full" style="top:calc(env(safe-area-inset-top, 12px) + 12px);left:14px;width:2.25rem;height:2.25rem;background:rgba(0,0,0,0.35);">${IconBold('back','w-5 h-5 text-white')}</button>
            </div>`;
        }

        let galSwipeStartX = null;
        let galSwipeStartY = null;
        function galleryTouchStart(e){
          const t = e.touches && e.touches[0];
          if (!t) return;
          galSwipeStartX = t.clientX;
          galSwipeStartY = t.clientY;
        }
        function galleryTouchEnd(e, postId, index){
          if (galSwipeStartX == null) return;
          const startX = galSwipeStartX, startY = galSwipeStartY;
          galSwipeStartX = null; galSwipeStartY = null;
          const t = e.changedTouches && e.changedTouches[0];
          if (!t) return;
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;
          const SWIPE_THRESHOLD = 60;
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return; 
          navigateGalleryItem(postId, index, dx < 0 ? 1 : -1); 
        }

        function navigateGalleryItem(postId, index, direction){
          const post = findPost(postId);
          if (!post) return;
          const items = postMediaItemsList(post);
          const nextIndex = index + direction;
          if (nextIndex < 0 || nextIndex >= items.length) return; 
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const outgoingVideo = ov.querySelector('video');
          if (outgoingVideo && !outgoingVideo.paused) outgoingVideo.pause();
          ov.innerHTML = postMediaGalleryHTML(post, nextIndex);
          activeGalleryPostId = postId;
          activeGalleryIndex = nextIndex;
        }

        // Left/right arrow keys move between posts (reel view) or between
        // images within the same post (gallery view), mirroring the
        // horizontal swipe gestures above -- desktop users get the same
        // navigation without needing a mouse drag.
        document.addEventListener('keydown', function(e){
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
          const ov = document.getElementById('overlay');
          if (!ov || ov.classList.contains('hidden')) return;
          const direction = e.key === 'ArrowRight' ? 1 : -1;
          if (activeGalleryPostId != null && ov.querySelector('[id^="gallery-post-"]')) {
            e.preventDefault();
            navigateGalleryItem(activeGalleryPostId, activeGalleryIndex, direction);
          } else if (activeReelPostId != null && ov.querySelector('[id^="video-post-"]')) {
            e.preventDefault();
            navigateReelPost(activeReelPostId, direction);
          }
        });

        // ---- Standard post detail screen + related post feed ----
        function postDetailHTML(post){
          return `
            ${overlayHeader('Post', '20px')}
            <div class="flex-1 overflow-y-auto no-scrollbar">
              <div class="px-5 pb-2 border-b border-gray-100 post-detail-full-media">${feedPost(post)}</div>
              <div class="p-5 space-y-4">
                ${post.commentsList.length ? post.commentsList.map(commentRow).join('') : '<div class="text-center text-gray-400 text-sm py-8">Be the first to comment.</div>'}
              </div>
            </div>
            <div class="border-t p-3 flex items-center gap-2 flex-shrink-0">
              <textarea id="comment-input" placeholder="Add a comment..." rows="1" enterkeyhint="enter" oninput="autoGrowConvoInput(this)" class="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-sm resize-none" style="max-height:100px;overflow-y:auto;line-height:1.3;"></textarea>
              <button onclick="addComment(${post.id})" class="bg-[${NAVY}] text-white px-4 py-2 rounded-full text-sm font-semibold">Post</button>
            </div>`;
        }

        function findPost(id){
          return feedPosts.find(p => p.id === id);
        }

        let postFeedSource = 'mine';
        let postFeedStartId = null;

        function postListForSource(source){
          if (source === 'reposts') return feedPosts.filter(p => p.reposted).sort(byNewestFirst);
          if (source === 'saved') return feedPosts.filter(p => p.saved).sort(byNewestFirst);
          if (typeof source === 'string' && source.indexOf('hashtag:') === 0) {
            const tag = source.slice('hashtag:'.length).toLowerCase();
            return feedPosts.filter(p => extractHashtags(p.body).includes(tag)).sort(byNewestFirst);
          }
          if (typeof source === 'string' && source.indexOf('author-videos:') === 0) {
            const authorId = source.slice('author-videos:'.length);
            return feedPosts.filter(p => String(p.authorId) === authorId && !p.isRepost && postMediaKind(p) === 'video').sort(byNewestFirst);
          }
          if (typeof source === 'string' && source.indexOf('author-pictures:') === 0) {
            const authorId = source.slice('author-pictures:'.length);
            return feedPosts.filter(p => String(p.authorId) === authorId && !p.isRepost && postMediaKind(p) === 'picture').sort(byNewestFirst);
          }
          if (typeof source === 'string' && source.indexOf('author-reposts:') === 0) {
            const authorId = source.slice('author-reposts:'.length);
            return feedPosts.filter(p => String(p.authorId) === authorId && p.isRepost).sort(byNewestFirst);
          }
          if (typeof source === 'string' && source.indexOf('author:') === 0) {
            const authorId = source.slice('author:'.length);
            return feedPosts.filter(p => String(p.authorId) === authorId).sort(byNewestFirst);
          }
          return feedPosts.filter(p => p.mine).sort(byNewestFirst);
        }

        function postFeedTitle(source){
          if (source === 'reposts') return 'Reposts';
          if (source === 'saved') return 'Saved';
          if (typeof source === 'string' && source.indexOf('hashtag:') === 0) {
            return '#' + source.slice('hashtag:'.length);
          }
          if (typeof source === 'string' && (source.indexOf('author-videos:') === 0 || source.indexOf('author-pictures:') === 0 || source.indexOf('author-reposts:') === 0 || source.indexOf('author:') === 0)) {
            const authorId = source.slice(source.indexOf(':') + 1);
            const viewed = (typeof viewedProfile !== 'undefined' && viewedProfile && String(viewedProfile.id) === authorId) ? viewedProfile : null;
            const anyPost = feedPosts.find(p => String(p.authorId) === authorId);
            return (viewed && viewed.name) || (anyPost && anyPost.name) || 'Posts';
          }
          return 'Posts';
        }

        function openPostFeedFrom(source, postId){
          postFeedSource = source;
          postFeedStartId = postId;
          const returnKind = (typeof currentOverlayKind !== 'undefined' && currentOverlayKind) || null;
          if (returnKind) openOverlayFrom(returnKind, 'postFeed');
          else openOverlay('postFeed');
        }

        function postFeedHTML(){
          const items = postListForSource(postFeedSource);
          return `
            ${overlayHeader(escapeHtml(postFeedTitle(postFeedSource)), '20px')}
            <div class="flex-1 overflow-y-auto no-scrollbar" id="post-feed-list">
              ${items.length
                ? `<div class="px-5 space-y-3">${items.map(feedPost).join('')}</div>`
                : '<div class="text-center text-gray-400 text-sm py-10">Nothing here yet.</div>'}
            </div>`;
        }

        function scrollToPostFeedStart(){
          if (postFeedStartId == null) return;
          const el = document.getElementById('post-' + postFeedStartId);
          if (el) el.scrollIntoView({ block: 'start' });
        }

        // ---- Likes, reposts, and comments ----
        function formatCount(n){
          if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
          if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
          return n.toLocaleString();
        }

        function forEachById(id, fn){
          document.querySelectorAll(`[id="${id}"]`).forEach(fn);
        }

        function toggleLike(id){
          if (blockedWhileShowingCachedFeed()) return;
          PostsAPI.toggleLike(id).then(post => {
            if (!post) return;
            forEachById('like-icon-'+id, iconEl => { iconEl.innerHTML = post.liked ? gradientHeartIcon('w-[18px] h-[18px]') : Icon('heartOutline', 'w-[18px] h-[18px]'); });
            forEachById('like-count-'+id, likeCountEl => { likeCountEl.textContent = post.likes.toLocaleString() + ' likes'; });
            forEachById('like-btn-'+id, btn => {
              const isReelDetail = btn.closest('#video-post-' + id) != null;
              btn.className = isReelDetail
                ? `flex flex-col items-center gap-1 ${post.liked ? `text-[${ROYAL}]` : 'text-white'}`
                : `p-1 -ml-1 flex items-center gap-1 ${post.liked ? `text-[${ROYAL}]` : 'text-gray-500'}`;
            });
            forEachById('like-inline-count-'+id, inline => { inline.textContent = formatCount(post.likes); });
          });
        }

        function toggleRepost(id){
          if (blockedWhileShowingCachedFeed()) return;
          PostsAPI.toggleRepost(id).then(post => {
            if (!post) return;
            forEachById('repost-btn-'+id, btn => {
              const isReelDetail = btn.closest('#video-post-' + id) != null;
              btn.className = isReelDetail
                ? `flex flex-col items-center gap-1 ${post.reposted ? 'text-emerald-600' : 'text-white'}`
                : `p-1 flex items-center gap-1 ${post.reposted ? 'text-emerald-600' : 'text-gray-500'}`;
            });
            forEachById('repost-inline-count-'+id, inline => { inline.textContent = formatCount(post.reposts); });
            if (currentTab === 0) renderFeed();
            if (typeof refreshProfilePostsUI === 'function') refreshProfilePostsUI();
            if (typeof invalidateFeedAndProfileCaches === 'function') invalidateFeedAndProfileCaches();
          });
        }

        let commentSheetReturnHTML = null;

        function openComments(id){
          if (blockedWhileShowingCachedFeed()) return;
          const post = findPost(id);
          if (!post) return;
          if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          // Same "remember what was underneath" pattern as the Share sheet
          // (see openShare/closeShareSheet below): lets closing this sheet
          // return to whatever overlay -- a single post, a post feed list --
          // was already open, instead of always falling back to Home.
          commentSheetReturnHTML = (!ov.classList.contains('hidden')) ? ov.innerHTML : null;
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.style.background = '#000';
          ov.innerHTML = commentSheetWrapperHTML(post);
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeCommentSheet(fromPopState));
        }

        function closeCommentSheet(fromPopState){
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
          const ov = document.getElementById('overlay');
          const returnHTML = commentSheetReturnHTML;
          commentSheetReturnHTML = null;
          ov.style.background = '';
          if (returnHTML !== null) {
            if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
            ov.innerHTML = returnHTML;
            if (currentOverlayKind === 'postFeed' && typeof setupFeedVideoAutoplay === 'function') {
              const pfl = document.getElementById('post-feed-list');
              if (pfl) setupFeedVideoAutoplay(pfl);
            }
          } else {
            closeOverlay(fromPopState);
          }
        }

        // Comments now open as a draggable bottom sheet sitting over the
        // post's own media (mirrors the reel/gallery full-screen viewer)
        // instead of navigating to a separate "Comments" page. The sheet
        // starts at COMMENT_SHEET_DEFAULT_VH, leaving the post visible
        // above it, and can be dragged (via the handle) up to
        // COMMENT_SHEET_MAX_VH to read a long thread, or down past
        // COMMENT_SHEET_MIN_VH to dismiss -- same idea as Instagram/TikTok's
        // comment drawers.
        const COMMENT_SHEET_DEFAULT_VH = 58;
        const COMMENT_SHEET_MAX_VH = 92;
        const COMMENT_SHEET_MIN_VH = 30;

        function commentSheetWrapperHTML(post){
          const media = extractPostMedia(post);
          return `
            <div class="relative w-full h-full bg-black overflow-hidden" id="comment-sheet-root-${post.id}">
              <div class="absolute inset-0" onclick="closeCommentSheet()">
                ${framedMediaLayerHtml(media, '', true)}
              </div>
              <button onclick="event.stopPropagation(); closeCommentSheet()" class="absolute z-20 flex items-center justify-center rounded-full" style="top:calc(env(safe-area-inset-top, 12px) + 12px);left:14px;width:2.25rem;height:2.25rem;background:rgba(0,0,0,0.35);">${IconBold('back','w-5 h-5 text-white')}</button>
              <div id="comment-sheet-panel-${post.id}" class="absolute left-0 right-0 bottom-0 bg-white flex flex-col" style="height:${COMMENT_SHEET_DEFAULT_VH}vh;border-radius:22px 22px 0 0;overflow:hidden;transition:height .22s ease;">
                ${commentSheetPanelInnerHTML(post)}
              </div>
            </div>`;
        }

        function commentSheetPanelInnerHTML(post){
          return `
            <div class="flex justify-center pt-2.5 pb-1 flex-shrink-0" style="touch-action:none;cursor:grab;" ontouchstart="commentSheetDragStart(event, ${post.id})" ontouchmove="commentSheetDragMove(event, ${post.id})" ontouchend="commentSheetDragEnd(event, ${post.id})">
              <div class="w-9 h-1.5 rounded-full bg-gray-300"></div>
            </div>
            ${commentsSheetBodyHTML(post)}`;
        }

        function commentsSheetBodyHTML(post){
          return `
            <div class="text-center font-semibold text-base pb-3 flex-shrink-0" style="color:${NAVY};">Comments</div>
            <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-4 space-y-4">
              ${post.commentsList.length ? post.commentsList.map(commentRow).join('') : '<div class="text-center text-gray-400 text-sm py-8">Be the first to comment.</div>'}
            </div>
            <div class="border-t p-3 flex items-center gap-2 flex-shrink-0" style="padding-bottom:calc(env(safe-area-inset-bottom, 12px) + 12px);">
              <textarea id="comment-input" placeholder="Add a comment..." rows="1" enterkeyhint="enter" oninput="autoGrowConvoInput(this)" class="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-sm resize-none" style="max-height:100px;overflow-y:auto;line-height:1.3;"></textarea>
              <button onclick="addComment(${post.id})" class="bg-[${NAVY}] text-white px-4 py-2 rounded-full text-sm font-semibold">Post</button>
            </div>`;
        }

        let commentSheetDragStartY = null;
        let commentSheetStartHeightPx = null;

        function commentSheetDragStart(e, postId){
          const t = e.touches && e.touches[0];
          if (!t) return;
          const panel = document.getElementById('comment-sheet-panel-' + postId);
          if (!panel) return;
          commentSheetDragStartY = t.clientY;
          commentSheetStartHeightPx = panel.getBoundingClientRect().height;
          panel.style.transition = 'none';
        }

        function commentSheetDragMove(e, postId){
          if (commentSheetDragStartY == null) return;
          const t = e.touches && e.touches[0];
          if (!t) return;
          const panel = document.getElementById('comment-sheet-panel-' + postId);
          if (!panel) return;
          const dy = t.clientY - commentSheetDragStartY;
          const newHeightPx = commentSheetStartHeightPx - dy;
          const vh = window.innerHeight;
          const minPx = vh * (COMMENT_SHEET_MIN_VH - 15) / 100;
          const maxPx = vh * COMMENT_SHEET_MAX_VH / 100;
          panel.style.height = Math.max(minPx, Math.min(maxPx, newHeightPx)) + 'px';
          e.preventDefault();
        }

        function commentSheetDragEnd(e, postId){
          if (commentSheetDragStartY == null) return;
          commentSheetDragStartY = null;
          const panel = document.getElementById('comment-sheet-panel-' + postId);
          if (!panel) return;
          panel.style.transition = 'height .22s ease';
          const vh = window.innerHeight;
          const heightVh = (panel.getBoundingClientRect().height / vh) * 100;
          if (heightVh < COMMENT_SHEET_MIN_VH) {
            closeCommentSheet();
            return;
          }
          const midpoint = (COMMENT_SHEET_DEFAULT_VH + COMMENT_SHEET_MAX_VH) / 2;
          panel.style.height = (heightVh > midpoint ? COMMENT_SHEET_MAX_VH : COMMENT_SHEET_DEFAULT_VH) + 'vh';
        }

        function commentRow(c){
          const isMine = c.name === 'You' || (typeof profileData !== 'undefined' && profileData.name && c.name === profileData.name);
          const avatarPhoto = c.photo || (isMine ? profileData.photo : null);
          return `
            <div class="flex gap-3">
              <div class="w-9 h-9 bg-blue-50 rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0">${avatarPhoto ? `<img src="${avatarPhoto}" class="w-full h-full object-cover">` : Icon('user','w-4 h-4 text-gray-500')}</div>
              <div class="text-sm"><span class="font-semibold">${escapeHtml(c.name)}</span> ${escapeHtml(c.text)}</div>
            </div>`;
        }

        function addComment(id){
          if (!requireCompleteProfile()) return;
          const input = document.getElementById('comment-input');
          const text = input.value.trim();
          if (!text) return;
          input.value = '';
          if (typeof autoGrowConvoInput === 'function') autoGrowConvoInput(input);
          PostsAPI.addComment(id, text).then(post => {
            if (!post) return;
            const cc = document.getElementById('comment-count-'+id);
            if (cc) cc.textContent = post.comments > 0 ? `View all ${post.comments} comments` : 'Add a comment...';
            const inline = document.getElementById('comment-inline-count-'+id);
            if (inline) inline.textContent = formatCount(post.comments);
            const ov = document.getElementById('overlay');
            const isDetailOpen = !!(ov && ov.querySelector('#post-' + id));
            const isReelOpen = !!(ov && ov.querySelector('#video-post-' + id));
            const commentPanel = ov && document.getElementById('comment-sheet-panel-' + id);
            if (isDetailOpen) {
              if (ov) ov.innerHTML = postDetailHTML(post);
            } else if (isReelOpen) {
              if (ov) ov.innerHTML = reelPostDetailHTML(post);
            } else if (commentPanel) {
              commentPanel.innerHTML = commentSheetPanelInnerHTML(post);
            } else {
              openComments(id);
            }
          });
        }

        let shareSelected = new Set();

        // ---- Share a post to contacts ----
        let shareSheetReturnHTML = null;

        function openShare(id){
          if (blockedWhileShowingCachedFeed()) return;
          const post = findPost(id);
          shareSelected = new Set();
          if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          // If another overlay -- e.g. a single post's expanded "postFeed"
          // view -- is already open underneath, remember its markup so
          // closing this sheet (X button or hardware/browser back) returns
          // there instead of falling all the way back to Home. Without this,
          // opening Share just overwrote whatever was already in #overlay
          // with no way back to it.
          shareSheetReturnHTML = (!ov.classList.contains('hidden')) ? ov.innerHTML : null;
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          // Share now presents as a bottom sheet (like LinkedIn's "Send as
          // message") instead of a full page: #overlay becomes a dim
          // backdrop that the sheet itself sits at the bottom of, rather
          // than an opaque full-screen page. #overlay's own "bg-gray-50"
          // class is still there underneath -- this inline style just wins
          // while the sheet is open, and gets cleared again in
          // closeShareSheet so any other overlay reverts to its normal look.
          ov.style.background = 'rgba(8,15,28,0.55)';
          ov.innerHTML = shareSheetWrapperHTML(post);
          if (typeof pushModalBackHandler === 'function') pushModalBackHandler(fromPopState => closeShareSheet(fromPopState));
        }

        function closeShareSheet(fromPopState){
          if (typeof popModalBackHandler === 'function') popModalBackHandler(fromPopState);
          const ov = document.getElementById('overlay');
          const returnHTML = shareSheetReturnHTML;
          shareSheetReturnHTML = null;
          // Undo the dim-backdrop background from openShare so whatever
          // shows next (a returned-to overlay, or nothing) isn't left
          // looking tinted.
          ov.style.background = '';
          if (returnHTML !== null) {
            if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
            ov.innerHTML = returnHTML;
            if (currentOverlayKind === 'postFeed' && typeof setupFeedVideoAutoplay === 'function') {
              const pfl = document.getElementById('post-feed-list');
              if (pfl) setupFeedVideoAutoplay(pfl);
            }
          } else {
            closeOverlay(fromPopState);
          }
        }

        // Wraps shareHTML's content in a bottom-anchored sheet: a drag
        // handle, rounded top corners, capped height so it never covers the
        // whole screen, and a tap-outside-to-close backdrop area (the
        // backdrop color itself comes from openShare setting #overlay's
        // background). Matches the "Send as message" bottom-sheet pattern
        // instead of Share opening as its own full page.
        function shareSheetWrapperHTML(post){
          return `
            <div class="w-full h-full flex flex-col justify-end" onclick="if (event.target === this) closeShareSheet();">
              <div class="w-full bg-white flex flex-col share-sheet-panel" style="max-height:82vh;border-radius:22px 22px 0 0;overflow:hidden;" onclick="event.stopPropagation();">
                <div class="flex justify-center pt-2.5 pb-1 flex-shrink-0"><div class="w-9 h-1.5 rounded-full bg-gray-300"></div></div>
                ${shareHTML(post)}
              </div>
            </div>`;
        }

        function shareContactsList(){
          const seen = new Set();
          const list = [];
          for (const arr of convoArrays()){
            for (const c of arr){
              if (!seen.has(c.id)) { seen.add(c.id); list.push(c); }
            }
          }
          return list;
        }

        function shareHTML(post){
          const contacts = shareContactsList();
          return `
            <div class="flex-shrink-0 w-full">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between">
                <div class="font-semibold text-lg font-display" style="color:${NAVY};">Send as message</div>
                <button onclick="closeShareSheet()" style="color:${ROYAL};">${IconBold('close','w-5 h-5')}</button>
              </div>
              <div class="max-w-2xl mx-auto px-5 pb-4">
                <div class="relative">
                  <div class="text-gray-400" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);">${Icon('search','w-4 h-4')}</div>
                  <input id="share-search-${post.id}" oninput="filterShareContacts(${post.id})" placeholder="Search" class="w-full bg-gray-100 rounded-full text-sm" style="outline:none;padding:0.625rem 1rem 0.625rem 2.5rem;"/>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-hidden">
              <div class="max-w-2xl mx-auto px-5">
                <div id="share-grid-${post.id}" class="flex overflow-x-auto no-scrollbar" style="gap:16px;scroll-snap-type:x proximity;padding:2px 2px 8px;">
                  ${contacts.map(c => shareContactCell(post.id, c)).join('')}
                </div>
                <div id="share-empty-${post.id}" class="hidden text-center text-sm text-gray-400 py-10">No matches</div>
              </div>
            </div>
            <div class="flex-shrink-0 w-full flex items-start justify-start no-scrollbar border-t border-gray-100" style="gap:22px;padding:16px 20px calc(env(safe-area-inset-bottom, 12px) + 16px) 20px;background:#fafafa;overflow-x:auto;">
              <div id="share-action-${post.id}">${shareActionHTML(post.id)}</div>
              ${shareExternalOption('send','Share', `sharePostExternally(${post.id})`, `linear-gradient(135deg,${ROYAL},${NAVY})`, '#fff')}
              ${shareExternalOption('link','Copy link', `copyPostLink(${post.id})`, '#eef0f4', NAVY)}
              ${shareWhatsAppOption(`shareViaWhatsApp(${post.id})`)}
              ${shareMessagesOption(`shareViaSMS(${post.id})`)}
            </div>`;
        }

        function shareContactCell(postId, c){
          const selected = shareSelected.has(c.id);
          return `
            <button id="share-cell-${postId}-${c.id}" data-name="${escapeHtml(c.name.toLowerCase())}" onclick="toggleShareContact(${postId}, '${c.id}')" class="flex flex-col items-center gap-1.5 flex-shrink-0 text-center" style="width:72px;scroll-snap-align:start;">
              <div class="relative">
                <div class="w-14 h-14 ${c.avatarBg} rounded-full flex items-center justify-center text-gray-600 overflow-hidden" style="${selected ? `box-shadow:0 0 0 2.5px ${ROYAL};` : ''}">${avatarInnerHTML(c,'w-6 h-6')}</div>
                <div id="share-check-${postId}-${c.id}" class="${selected ? '' : 'hidden'} absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center" style="background:${ROYAL};box-shadow:0 0 0 2px #fff;">${Icon('check','w-3 h-3 text-white')}</div>
              </div>
              <div class="text-xs font-medium truncate w-full leading-tight">${escapeHtml(c.name)}</div>
            </button>`;
        }

        function toggleShareContact(postId, contactId){
          if (shareSelected.has(contactId)) shareSelected.delete(contactId); else shareSelected.add(contactId);
          const selected = shareSelected.has(contactId);
          const badge = document.getElementById(`share-check-${postId}-${contactId}`);
          if (badge) badge.classList.toggle('hidden', !selected);
          const avatar = badge && badge.previousElementSibling;
          if (avatar) avatar.style.boxShadow = selected ? `0 0 0 2.5px ${ROYAL}` : '';
          const action = document.getElementById(`share-action-${postId}`);
          if (action) action.innerHTML = shareActionHTML(postId);
        }

        // Renders the trailing action button in the share sheet: "More apps"
        // (opens the OS share sheet) when nothing's selected, or "Send"
        // (delivers directly to the picked contacts, with a count badge)
        // once at least one contact is checked. This used to be a second,
        // separate floating button that appeared on top of "More apps" --
        // replacing "More apps" in place instead avoids the overlap.
        function shareActionHTML(postId){
          const count = shareSelected.size;
          if (count > 0) {
            return `
              <div class="flex flex-col items-center gap-1 flex-shrink-0" style="width:56px;">
                <button onclick="sendPostToSelectedContacts(${postId})" title="Send" class="rounded-full flex items-center justify-center flex-shrink-0 relative" style="width:38px;height:38px;background:linear-gradient(135deg,${ROYAL},${NAVY});color:#fff;">
                  ${Icon('send','w-4 h-4')}
                  <span class="absolute bg-white text-[10px] font-bold rounded-full flex items-center justify-center" style="top:-3px;right:-3px;width:17px;height:17px;color:${ROYAL};box-shadow:0 0 0 1.5px ${ROYAL};">${count}</span>
                </button>
                <div class="text-[11px] text-gray-600 font-medium text-center leading-tight">Send</div>
              </div>`;
          }
          return '';
        }

        function shareExternalOption(icon,label,onclick,bg,fg){
          bg = bg || '#eef0f4';
          fg = fg || NAVY;
          return `
            <div class="flex flex-col items-center gap-1 flex-shrink-0" style="width:56px;">
              <button onclick="${onclick}" title="${label}" class="rounded-full flex items-center justify-center flex-shrink-0" style="width:38px;height:38px;background:${bg};color:${fg};">${Icon(icon,'w-4 h-4')}</button>
              <div class="text-[11px] text-gray-600 font-medium text-center leading-tight">${escapeHtml(label)}</div>
            </div>`;
        }

        // Brand logos (WhatsApp / Messages) shown alongside the generic
        // "Share" (opens the OS share sheet) and "Copy link" options,
        // matching a native share panel's row of quick-share icons. These
        // are the actual app logos, so they're rendered as images rather
        // than drawn as colored circles with an inline icon.
        const WHATSAPP_LOGO_URI = "data:image/png;base64,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";
        const MESSAGES_LOGO_URI = "data:image/png;base64,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";

        function shareBrandOption(label, onclick, logoUri){
          return `
            <div class="flex flex-col items-center gap-1 flex-shrink-0" style="width:56px;">
              <button onclick="${onclick}" title="${label}" class="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style="width:38px;height:38px;">
                <img src="${logoUri}" alt="${escapeHtml(label)}" class="w-full h-full object-cover">
              </button>
              <div class="text-[11px] text-gray-600 font-medium text-center leading-tight">${escapeHtml(label)}</div>
            </div>`;
        }

        function shareWhatsAppOption(onclick){
          return shareBrandOption('WhatsApp', onclick, WHATSAPP_LOGO_URI);
        }

        function shareMessagesOption(onclick){
          return shareBrandOption('Messages', onclick, MESSAGES_LOGO_URI);
        }

        function filterShareContacts(postId){
          const input = document.getElementById(`share-search-${postId}`);
          const q = input ? input.value.trim().toLowerCase() : '';
          const grid = document.getElementById(`share-grid-${postId}`);
          const empty = document.getElementById(`share-empty-${postId}`);
          if (!grid) return;
          let visibleCount = 0;
          Array.from(grid.children).forEach(cell => {
            const match = !q || cell.dataset.name.includes(q);
            cell.classList.toggle('hidden', !match);
            if (match) visibleCount++;
          });
          if (empty) empty.classList.toggle('hidden', visibleCount !== 0);
        }

        function sendPostToSelectedContacts(postId){
          if (!shareSelected.size) return;
          const post = findPost(postId);
          const text = `Shared a post: "${(post.body || 'a post from Stitch').slice(0,60)}"`;
          const ids = Array.from(shareSelected);
          ids.forEach(contactId => deliverSharedMessage(contactId, text));
          PostsAPI.share(postId).then(() => bumpShareCountDisplay(postId));
          closeShareSheet();
          openAppAlertModal(ids.length === 1 ? 'Sent' : `Sent to ${ids.length} people`);
        }

        function deliverSharedMessage(convoId, text){
          const convo = findConvoById(convoId);
          if (!convo) return;
          conversationMessages[convoId] = conversationMessages[convoId] || [];
          const localId = 'lm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          conversationMessages[convoId].push({ from: 'me', text, time: Date.now(), read: false, localId });
          updateConvoPreview(convoId, text);
          queueSaveUserState();
          refreshConvoLogIfOpen(convoId);
          const meta = convoMeta[convoId];
          if (meta && meta.otherUserId) {
            sendMessageRemote(convoId, meta.otherUserId, text, null, null, [], localId);
          } else if (meta && meta.icon === 'users' && Array.isArray(meta.members)) {
            meta.members.forEach(m => {
              if (m.mine || !m.otherUserId) return;
              sendMessageRemote(convoId, m.otherUserId, text, null, null, [], localId);
            });
          }
        }

        function bumpShareCountDisplay(id){
          const inline = document.getElementById('share-inline-count-'+id);
          if (inline) {
            const post = findPost(id);
            inline.textContent = formatCount(post.shares);
          }
        }

        function findConvoById(id){
          for (const arr of convoArrays()){
            const found = arr.find(c => c.id === id);
            if (found) return found;
          }
          return null;
        }

        function shareAction(id, msg){
          PostsAPI.share(id).then(() => bumpShareCountDisplay(id));
          closeOverlay();
          openAppAlertModal(msg);
        }

        // ---- Real link-sharing for posts: build a permalink-style URL,
        // then either copy it or hand off to the OS share sheet via the
        // Web Share API (same pattern used for class invites/referrals). ----
        function postShareLink(id){
          return window.location.origin + window.location.pathname + '?post=' + encodeURIComponent(id);
        }

        function copyPostLink(id){
          const link = postShareLink(id);
          PostsAPI.share(id).then(() => bumpShareCountDisplay(id));
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Link copied to clipboard'));
          } else {
            openAppAlertModal('Link: ' + link);
          }
          closeShareSheet();
        }

        function sharePostExternally(id){
          const post = findPost(id);
          const link = postShareLink(id);
          // Closing our own sheet used to happen before navigator.share()
          // was even called, so there was a brief flash of the bare feed
          // underneath before the OS share sheet slid up on top of it.
          // Keeping the Share Post sheet open until the native share flow
          // actually settles (success, cancel, or unsupported) makes that
          // transition direct instead of dropping back to the feed first.
          if (navigator.share) {
            const authorName = (post && post.name) ? post.name : 'this post';
            navigator.share({ title: 'Stitch', text: `Check out ${authorName}'s post on Stitch`, url: link })
              .then(() => { PostsAPI.share(id).then(() => bumpShareCountDisplay(id)); })
              .catch(() => {})
              .finally(() => closeShareSheet());
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            PostsAPI.share(id).then(() => bumpShareCountDisplay(id));
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Sharing isn\'t supported here -- link copied instead'));
            closeShareSheet();
          } else {
            openAppAlertModal('Link: ' + link);
            closeShareSheet();
          }
        }

        function shareViaWhatsApp(id){
          const post = findPost(id);
          const link = postShareLink(id);
          const authorName = (post && post.name) ? post.name : 'this post';
          const text = `Check out ${authorName}'s post on Stitch: ${link}`;
          PostsAPI.share(id).then(() => bumpShareCountDisplay(id));
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          closeShareSheet();
        }

        function shareViaSMS(id){
          const post = findPost(id);
          const link = postShareLink(id);
          const authorName = (post && post.name) ? post.name : 'this post';
          const text = `Check out ${authorName}'s post on Stitch: ${link}`;
          PostsAPI.share(id).then(() => bumpShareCountDisplay(id));
          window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
          closeShareSheet();
        }

        // ---- Add a post to your glimpse (repost as story) ----
        function extractPostMedia(post){
          if (!post || !post.mediaHtml) return null;
          const srcMatch = post.mediaHtml.match(/<(img|video)[^>]*\ssrc="([^"]+)"/i);
          if (!srcMatch) return null;
          return { url: srcMatch[2], type: /^video$/i.test(srcMatch[1]) ? 'video' : 'image' };
        }

        function postMediaKind(post){
          if (!post || !post.mediaHtml) return 'picture';
          const firstTag = post.mediaHtml.match(/<(img|video)\b/i);
          return (firstTag && /^video$/i.test(firstTag[1])) ? 'video' : 'picture';
        }

        let shareGlimpseSelected = new Set();

        // ---- Share a glimpse to contacts ----
        function openShareGlimpse(id){
          const g = myGlimpses.find(x => x.id === id);
          if (!g) return;
          shareGlimpseSelected = new Set();
          if (typeof pauseAllOverlayMedia === 'function') pauseAllOverlayMedia();
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = shareGlimpseHTML(g);
        }

        function shareGlimpseHTML(g){
          const contacts = shareContactsList();
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:var(--top-safe-pad);">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between">
                <div class="font-semibold text-lg font-display" style="color:${NAVY};">Send as message</div>
                <button onclick="openMyGlimpses()" style="color:${ROYAL};">${IconBold('close','w-5 h-5')}</button>
              </div>
              <div class="max-w-2xl mx-auto px-5 pb-4">
                <div class="relative">
                  <div class="text-gray-400" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);">${Icon('search','w-4 h-4')}</div>
                  <input id="share-glimpse-search-${g.id}" oninput="filterShareGlimpseContacts(${g.id})" placeholder="Search" class="w-full bg-gray-100 rounded-full text-sm" style="outline:none;padding:0.625rem 1rem 0.625rem 2.5rem;"/>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-hidden">
              <div class="max-w-2xl mx-auto px-5">
                <div id="share-glimpse-grid-${g.id}" class="flex overflow-x-auto no-scrollbar" style="gap:16px;scroll-snap-type:x proximity;padding:2px 2px 8px;">
                  ${contacts.map(c => shareGlimpseContactCell(g.id, c)).join('')}
                </div>
                <div id="share-glimpse-empty-${g.id}" class="hidden text-center text-sm text-gray-400 py-10">No matches</div>
              </div>
            </div>
            <div class="flex-shrink-0 w-full flex items-start justify-start no-scrollbar border-t border-gray-100" style="gap:22px;padding:16px 20px calc(env(safe-area-inset-bottom, 12px) + 16px) 20px;background:#fafafa;overflow-x:auto;">
              <div id="share-glimpse-action-${g.id}">${shareGlimpseActionHTML(g.id)}</div>
              ${shareExternalOption('send','Share', `shareGlimpseExternally(${g.id})`, `linear-gradient(135deg,${ROYAL},${NAVY})`, '#fff')}
              ${shareExternalOption('link','Copy link', `copyGlimpseLink(${g.id})`, '#eef0f4', NAVY)}
              ${shareWhatsAppOption(`shareGlimpseViaWhatsApp(${g.id})`)}
              ${shareMessagesOption(`shareGlimpseViaSMS(${g.id})`)}
            </div>`;
        }

        function shareGlimpseContactCell(glimpseId, c){
          const selected = shareGlimpseSelected.has(c.id);
          return `
            <button id="share-glimpse-cell-${glimpseId}-${c.id}" data-name="${escapeHtml(c.name.toLowerCase())}" onclick="toggleShareGlimpseContact(${glimpseId}, '${c.id}')" class="flex flex-col items-center gap-1.5 flex-shrink-0 text-center" style="width:72px;scroll-snap-align:start;">
              <div class="relative">
                <div class="w-14 h-14 ${c.avatarBg} rounded-full flex items-center justify-center text-gray-600 overflow-hidden" style="${selected ? `box-shadow:0 0 0 2.5px ${ROYAL};` : ''}">${avatarInnerHTML(c,'w-6 h-6')}</div>
                <div id="share-glimpse-check-${glimpseId}-${c.id}" class="${selected ? '' : 'hidden'} absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center" style="background:${ROYAL};box-shadow:0 0 0 2px #fff;">${Icon('check','w-3 h-3 text-white')}</div>
              </div>
              <div class="text-xs font-medium truncate w-full leading-tight">${escapeHtml(c.name)}</div>
            </button>`;
        }

        function toggleShareGlimpseContact(glimpseId, contactId){
          if (shareGlimpseSelected.has(contactId)) shareGlimpseSelected.delete(contactId); else shareGlimpseSelected.add(contactId);
          const selected = shareGlimpseSelected.has(contactId);
          const badge = document.getElementById(`share-glimpse-check-${glimpseId}-${contactId}`);
          if (badge) badge.classList.toggle('hidden', !selected);
          const avatar = badge && badge.previousElementSibling;
          if (avatar) avatar.style.boxShadow = selected ? `0 0 0 2.5px ${ROYAL}` : '';
          const action = document.getElementById(`share-glimpse-action-${glimpseId}`);
          if (action) action.innerHTML = shareGlimpseActionHTML(glimpseId);
        }

        function shareGlimpseActionHTML(glimpseId){
          const count = shareGlimpseSelected.size;
          if (count > 0) {
            return `
              <div class="flex flex-col items-center gap-1 flex-shrink-0" style="width:56px;">
                <button onclick="sendGlimpseToSelectedContacts(${glimpseId})" title="Send" class="rounded-full flex items-center justify-center flex-shrink-0 relative" style="width:38px;height:38px;background:linear-gradient(135deg,${ROYAL},${NAVY});color:#fff;">
                  ${Icon('send','w-4 h-4')}
                  <span class="absolute bg-white text-[10px] font-bold rounded-full flex items-center justify-center" style="top:-3px;right:-3px;width:17px;height:17px;color:${ROYAL};box-shadow:0 0 0 1.5px ${ROYAL};">${count}</span>
                </button>
                <div class="text-[11px] text-gray-600 font-medium text-center leading-tight">Send</div>
              </div>`;
          }
          return '';
        }

        function filterShareGlimpseContacts(glimpseId){
          const input = document.getElementById(`share-glimpse-search-${glimpseId}`);
          const q = input ? input.value.trim().toLowerCase() : '';
          const grid = document.getElementById(`share-glimpse-grid-${glimpseId}`);
          const empty = document.getElementById(`share-glimpse-empty-${glimpseId}`);
          if (!grid) return;
          let visibleCount = 0;
          Array.from(grid.children).forEach(cell => {
            const match = !q || cell.dataset.name.includes(q);
            cell.classList.toggle('hidden', !match);
            if (match) visibleCount++;
          });
          if (empty) empty.classList.toggle('hidden', visibleCount !== 0);
        }

        function sendGlimpseToSelectedContacts(glimpseId){
          if (!shareGlimpseSelected.size) return;
          const g = myGlimpses.find(x => x.id === glimpseId);
          if (!g) return;
          const desc = g.caption ? `"${g.caption.slice(0,60)}"` : (g.mediaType === 'video' ? 'a video' : g.mediaType === 'image' ? 'a photo' : 'a glimpse');
          const text = `Shared a glimpse: ${desc}`;
          const ids = Array.from(shareGlimpseSelected);
          ids.forEach(contactId => deliverSharedMessage(contactId, text));
          closeOverlay();
          openAppAlertModal(ids.length === 1 ? 'Sent' : `Sent to ${ids.length} people`);
        }

        function shareGlimpseAction(id, msg){
          openMyGlimpses();
          openAppAlertModal(msg);
        }

        function glimpseShareLink(id){
          return window.location.origin + window.location.pathname + '?glimpse=' + encodeURIComponent(id);
        }

        function copyGlimpseLink(id){
          const link = glimpseShareLink(id);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Link copied to clipboard'));
          } else {
            openAppAlertModal('Link: ' + link);
          }
          closeOverlay();
        }

        function shareGlimpseExternally(id){
          const link = glimpseShareLink(id);
          if (navigator.share) {
            navigator.share({ title: 'Stitch', text: 'Check out this Glimpse on Stitch', url: link })
              .catch(() => {})
              .finally(() => closeOverlay());
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(() => openAppAlertModal('Sharing isn\'t supported here -- link copied instead'));
            closeOverlay();
          } else {
            openAppAlertModal('Link: ' + link);
            closeOverlay();
          }
        }

        function shareGlimpseViaWhatsApp(id){
          const link = glimpseShareLink(id);
          const text = `Check out this Glimpse on Stitch: ${link}`;
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
          closeOverlay();
        }

        function shareGlimpseViaSMS(id){
          const link = glimpseShareLink(id);
          const text = `Check out this Glimpse on Stitch: ${link}`;
          window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
          closeOverlay();
        }
