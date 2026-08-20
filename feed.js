        // ---------------- HOME / FEED ----------------
        // remotePostsLoaded (declared with loadRemotePosts further down)
        // flips true once that first fetch resolves. Before that,
        // feedPosts is just whatever's left over from local state --
        // often empty -- so renderFeed() shows a skeleton instead of an
        // empty feed that looks broken.
        function feedSkeletonHTML(){
          return `
            <div class="px-5 pb-5" style="padding-top:20px;">
              <div class="-mx-5 mb-6 border-b border-gray-100">
                <div class="px-5">${skeletonStoryRowHTML(5)}</div>
              </div>
              <div>${skeletonPostHTML()}${skeletonPostHTML()}${skeletonPostHTML()}</div>
            </div>`;
        }

        // ---- Pull to refresh (Home feed) ----
        // Dragging down from the very top of the feed re-fetches posts
        // and glimpses, same data as a tab-switch refresh, and always
        // reshuffles the feed order (see shuffleArray usage in
        // loadRemotePosts below) so the feed doesn't come back looking
        // identical to what was just pulled down on. The indicator lives
        // in the normal document flow between the story strip and the
        // post list (not a fixed overlay, and not above the glimpses) so
        // pulling it open pushes just the posts down underneath it,
        // leaving the glimpse row pinned at the top -- no extra transform
        // math needed since scrollTop is already pinned at 0 while this
        // can happen.
        let homeFeedRefreshing = false;

        function pullToRefreshIndicatorHTML(){
          const active = homeFeedRefreshing;
          return `
            <div id="ptr-indicator" class="w-full flex items-center justify-center flex-shrink-0" style="height:${active ? '52px' : '0px'};overflow:hidden;transition:height .18s ease;">
              <div style="width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(10,37,64,0.15);border-top-color:${NAVY};${active ? 'animation:classroom-spin .7s linear infinite;' : ''}"></div>
            </div>`;
        }

        function renderFeed() {
          // A full innerHTML rebuild (below) always resets #screen's
          // scrollTop to 0 -- normally fine right after a tab switch
          // (scroll is already 0 then), but renderFeed also gets called
          // while someone is mid-scroll, deep in the feed, whenever a
          // realtime event needs to repaint (a repost toggling, a post
          // getting deleted elsewhere, etc). Without this, that felt
          // like the whole feed randomly snapping back to the top while
          // scrolling -- capturing/restoring the scroll position across
          // the rebuild keeps the person exactly where they were.
          const screenEl = document.getElementById('screen');
          const prevScrollTop = screenEl ? screenEl.scrollTop : 0;
          if (typeof remotePostsLoaded !== 'undefined' && !remotePostsLoaded) {
            document.getElementById('screen').innerHTML = feedSkeletonHTML();
            return;
          }
          document.getElementById('screen').innerHTML = `
            <div class="px-5 pb-5" style="padding-top:20px;">
              <div class="-mx-5 mb-6 border-b border-gray-100">
                <div class="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-4" id="story-strip">
                  ${stories.map(storyBubble).join('')}
                </div>
              </div>

              ${pullToRefreshIndicatorHTML()}
              <div class="space-y-3" id="feed-list">
                ${feedPosts.filter(p => p.mediaHtml).map(feedPost).join('')}
              </div>
            </div>`;
          if (screenEl) {
            // Right after the innerHTML swap above, the fresh post images/
            // videos haven't finished loading yet, so #screen's scrollable
            // content is briefly *shorter* than it was a moment ago (no
            // reserved height for media that hasn't decoded). Setting
            // scrollTop here gets silently clamped down to whatever that
            // shorter height allows -- which is what made scrolling up
            // "not stay stable": a background refresh mid-scroll (loading
            // fresh posts, a repost toggling elsewhere, etc.) would land
            // the feed lower than where the person actually was, then
            // visibly slide further as images kept loading in underneath.
            // Reasserting scrollTop again on the next couple of frames,
            // once media has had a chance to lay out and the real
            // scrollHeight is back, corrects that drift instead of leaving
            // it wherever the first (possibly clamped) assignment landed.
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

        // Updates the Home feed in place instead of the full innerHTML
        // rebuild renderFeed() does -- reuses each post card's existing
        // DOM node (moving it into its new position rather than
        // recreating it) so an already-loaded/playing <video> is never
        // torn down and reloaded. renderFeed() is still needed the very
        // first time Home's content replaces whatever tab was showing
        // before (nothing to reuse yet), but every background refresh
        // after that -- which runs on every single return to Home, see
        // switchTab in core.js -- was calling renderFeed() again the
        // instant new data arrived, forcing every visible video to flash
        // to black and re-buffer even when it hadn't actually changed.
        // This only inserts/removes the posts that actually changed.
        function patchFeedInPlace(){
          const list = document.getElementById('feed-list');
          if (!list) { renderFeed(); return; }
          const storyStrip = document.getElementById('story-strip');
          if (storyStrip) storyStrip.innerHTML = stories.map(storyBubble).join('');
          const posts = feedPosts.filter(p => p.mediaHtml);
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

        // Wires up the drag gesture on #screen: only "arms" when Home is
        // the active tab and the feed is already scrolled all the way to
        // the top (scrollTop 0), same convention as every native
        // pull-to-refresh. Called once from setupBottomNavScroll in
        // core.js, alongside the taskbar's own scroll handler, since
        // #screen itself persists across tab switches (only its
        // innerHTML is replaced).
        let ptrPulling = false;
        let ptrStartY = 0;
        let ptrDistance = 0;
        // Small deadzone before a pull is allowed to "arm" -- guards
        // against a touch's natural jitter near the start of a gesture
        // (a few px of downward noise while the finger is actually
        // moving up) getting misread as a pull-to-refresh and pushing
        // the feed down mid upward-scroll.
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
            // Below the deadzone -- whether slightly down or up -- treat
            // as "not pulling yet" rather than committing the indicator,
            // and keep tracking from the same start point so a genuine
            // upward scroll never gets a false downward blip recorded
            // against it.
            if (rawDy <= PTR_DEADZONE) { ptrDistance = 0; setPullIndicatorHeight(0, false); return; }
            const dy = rawDy - PTR_DEADZONE;
            // Half-rate drag (like iOS rubber-banding) so it takes a
            // deliberate pull to trigger, not a light nudge.
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
        }

        function setPullIndicatorHeight(px, animated){
          const el = document.getElementById('ptr-indicator');
          if (!el) return;
          el.style.transition = animated ? 'height .18s ease' : 'none';
          el.style.height = px + 'px';
        }

        // Runs the same data refresh switchTab(0) already does when
        // returning to Home (loadRemotePosts + loadPostInteractions +
        // loadRemoteGlimpses), then repaints -- but triggered by the drag
        // gesture instead of a tab switch, and only if Home is still the
        // active tab by the time it resolves (person may have navigated
        // away mid-pull).
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
            await loadRemoteGlimpses();
          } catch (e) { /* best-effort, same as every other refresh path */ }
          homeFeedRefreshing = false;
          if (typeof currentTab === 'undefined' || currentTab !== 0) return;
          // Let the indicator slide back up gently first -- collapsing it
          // to 0 with its own transition -- instead of just calling
          // renderFeed() straight away, which would rebuild the screen's
          // innerHTML with a brand-new (already-collapsed) indicator and
          // make the page snap back into place instantly.
          setPullIndicatorHeight(0, true);
          setTimeout(() => {
            if (typeof currentTab !== 'undefined' && currentTab === 0) renderFeed();
          }, 180);
        }

        // ---------------- STORIES ----------------
        // Each story can hold more than one glimpse: `items` is a list of
        // { caption, icon?, iconClass? } posts by that person. The viewer
        // below shows one progress segment per item, so someone with 3
        // glimpses gets 3 equal-width bars instead of the load being
        // divided unevenly or all items sharing a single bar.
        let stories = [
          { id:0, name:'Glimpse', icon:'person', bg:'', mine:true },
        ];

        // Unified minimalist icon set: rounded, solid, single color (currentColor)
        function Icon(type, cls){
          const paths = {
            home: `<path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.97-.97v7.63a2.25 2.25 0 01-2.25 2.25h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3a2.25 2.25 0 01-2.25-2.25V12.6l-.97.97a.75.75 0 11-1.06-1.06l8.69-8.69z"/>`,
            search: `<path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clip-rule="evenodd"/>`,
            bell: `<path fill-rule="evenodd" d="M12 2.25c-1.036 0-1.875.84-1.875 1.875v.155A6.375 6.375 0 005.25 10.5v3.379a3 3 0 01-.879 2.121l-.6.6a.75.75 0 00.53 1.28h15.398a.75.75 0 00.53-1.28l-.6-.6a3 3 0 01-.879-2.121V10.5a6.375 6.375 0 00-4.875-6.22v-.155c0-1.036-.84-1.875-1.875-1.875zM9.75 18.75a2.25 2.25 0 104.5 0h-4.5z" clip-rule="evenodd"/>`,
            plus: `<path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>`,
            mail: `<path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/><path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/>`,
            briefcase: `<path d="M8 8V6.25A3.25 3.25 0 0111.25 3h1.5A3.25 3.25 0 0116 6.25V8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="8" width="18" height="12" rx="3"/><line x1="3.8" y1="13.6" x2="20.2" y2="13.6" stroke="white" stroke-width="0.7" stroke-linecap="round" opacity="0.85"/><rect x="10" y="12.5" width="4" height="3" rx="0.9" fill="white"/>`,
            book: `<rect x="3" y="16.5" width="18" height="3.2" rx="0.8"/><rect x="3.4" y="12.6" width="17.2" height="3.2" rx="0.8" transform="rotate(-1.5 12 14.2)"/><rect x="3.6" y="8.7" width="16" height="3.2" rx="0.8" transform="rotate(1.5 12 10.3)"/><rect x="4.4" y="4.3" width="13.5" height="3.6" rx="0.8" transform="rotate(-4 11 6.1)"/>`,
            mic: `<path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z"/><path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z"/>`,
            user: `<path d="M12 12.5c2.9 0 5.25-2.35 5.25-5.25S14.9 2 12 2 6.75 4.35 6.75 7.25 9.1 12.5 12 12.5zm0 2.5c-3.87 0-9 1.94-9 5.25V22h18v-1.75c0-3.31-5.13-5.25-9-5.25z"/>`,
            users: `<path d="M9 12.75a4.25 4.25 0 100-8.5 4.25 4.25 0 000 8.5zm7.5-.75a3.5 3.5 0 10-1.66-6.58 5.72 5.72 0 010 5.16A3.48 3.48 0 0016.5 12zM9 14.5c-3.5 0-7 1.75-7 4.75V21h14v-1.75c0-3-3.5-4.75-7-4.75zm7.9.03c1.85.6 3.6 1.83 3.6 3.72V21h3v-1.75c0-2.35-2.65-3.72-6.6-3.72z"/>`,
            graduate: `<path d="M12 3L1 8l11 5 9-4.1V17h2V8L12 3zM5 12.18v3.64C5 18.13 8.13 20 12 20s7-1.87 7-4.18v-3.64l-7 3.18-7-3.18z"/>`,
            bot: `<g transform="translate(12,12) scale(1.15) translate(-12,-12)"><rect x="5" y="9" width="14" height="10" rx="3"/><rect x="10.25" y="3" width="3.5" height="4" rx="1.75"/><circle cx="12" cy="4.5" r="1.1"/><circle cx="9.2" cy="14" r="1.3" fill="white"/><circle cx="14.8" cy="14" r="1.3" fill="white"/><line x1="8.5" y1="17.2" x2="15.5" y2="17.2" stroke="white" stroke-width="1" stroke-linecap="round"/><rect x="2.3" y="12.5" width="1.8" height="3.5" rx="0.9"/><rect x="19.9" y="12.5" width="1.8" height="3.5" rx="0.9"/></g>`,
            camera: `<path fill-rule="evenodd" d="M9.344 3.07a24.66 24.66 0 015.312 0c.967.052 1.75.816 1.928 1.766l.157.837c.083.444.377.82.83.916A3.001 3.001 0 0121 9.5v8A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-8a3.001 3.001 0 012.43-2.911c.452-.096.746-.472.828-.916l.158-.837c.178-.95.96-1.714 1.928-1.766zM12 16.5a4 4 0 100-8 4 4 0 000 8z" clip-rule="evenodd"/>`,
            handRaised: `<path d="M8 11.25V4.75a1.5 1.5 0 013 0v6M11 10.75V3.75a1.5 1.5 0 013 0v7M14 10.75V6a1.5 1.5 0 013 0v9.5a6 6 0 01-6 6h-.75a6 6 0 01-5.196-3l-2.06-3.567a1.6 1.6 0 012.732-1.65L8 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            cameraOff: `<path d="M9.344 3.07a24.66 24.66 0 015.312 0c.967.052 1.75.816 1.928 1.766l.157.837c.083.444.377.82.83.916A3.001 3.001 0 0121 9.5v8c0 .58-.156 1.123-.428 1.59l-11.66-11.66c.166-.312.27-.665.328-.98l.158-.837c.178-.95.96-1.714 1.928-1.766zM4.28 3.22a.75.75 0 00-1.06 1.06L6.02 7.08A3 3 0 003 9.5v8A2.5 2.5 0 005.5 20h13c.412 0 .8-.1 1.142-.278l1.078 1.078a.75.75 0 101.06-1.06L4.28 3.22zM12 8.5c.245 0 .484.023.716.067l3.717 3.717A4 4 0 0112 16.5a4 4 0 01-3.976-4.49l3.06 3.06A4.02 4.02 0 0012 15.5a3 3 0 001.487-.392L9.392 11.013A4 4 0 0112 8.5z"/>`,
            video: `<path d="M4.5 5.5A2.5 2.5 0 002 8v8a2.5 2.5 0 002.5 2.5h9A2.5 2.5 0 0016 15.5v-1.35l4.05 2.5A1 1 0 0021.5 15.7V8.3a1 1 0 00-1.45-.9L16 9.9V8.5A2.5 2.5 0 0013.5 6h-9z"/>`,
            // "Photo" tile icon: framed picture containing a sun and a
            // mountain range, matching the classic image-placeholder
            // glyph -- used for the Pictures tab on someone's profile.
            photoTile: `<path fill-rule="evenodd" d="M3.75 4.5A2.25 2.25 0 001.5 6.75v10.5A2.25 2.25 0 003.75 19.5h16.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75zM7.5 8.25a1.875 1.875 0 110 3.75 1.875 1.875 0 010-3.75zm5.53 2.397a.75.75 0 011.128-.06l3.712 3.713a.75.75 0 01-.53 1.28H6.66a.75.75 0 01-.505-1.305l3.06-2.782a.75.75 0 01.995-.006l1.06.95 1.75-1.79z" clip-rule="evenodd"/>`,
            // "Video" tile icon: filmstrip with a play triangle in the
            // center window -- used for the Videos tab on someone's
            // profile.
            videoTile: `<path d="M4 5.25A1.75 1.75 0 002.25 7v10A1.75 1.75 0 004 18.75h16A1.75 1.75 0 0021.75 17V7A1.75 1.75 0 0020 5.25H4zM5.5 7.5h1.75v1.5H5.5v-1.5zm11.25 0H18.5v1.5h-1.75v-1.5zM5.5 15v-1.5h1.75V15H5.5zm11.25 0v-1.5H18.5V15h-1.75zM8.75 7.75A1.25 1.25 0 0110 6.5h4A1.25 1.25 0 0115.25 7.75v8.5A1.25 1.25 0 0114 17.5h-4a1.25 1.25 0 01-1.25-1.25v-8.5z" fill="currentColor"/><path d="M11.1 9.65a.55.55 0 01.85-.46l2.1 1.35a.55.55 0 010 .92l-2.1 1.35a.55.55 0 01-.85-.46v-2.7z" fill="white"/>`,
            phone: `<path fill-rule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97a15.075 15.075 0 006.696 6.696l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clip-rule="evenodd"/>`,
            phoneOutline: `<path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
            minimize: `<path d="M9 4v4a1 1 0 01-1 1H4M15 4v4a1 1 0 001 1h4M9 20v-4a1 1 0 00-1-1H4M15 20v-4a1 1 0 011-1h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
            personPlus: `<circle cx="10" cy="8" r="3.2"/><path d="M3.5 20c0-3.87 3.14-7 7-7 .9 0 1.76.16 2.55.46" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 14v6M15 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
            phoneHangup: `<path d="M12 2.25c-4.5 0-8.25 1.68-8.25 3.75 0 1.06 1.02 2.53 2.4 3.87.35.34.9.32 1.24-.03l1.4-1.46a.9.9 0 00.14-1.06 3.6 3.6 0 01-.4-1.13c-.06-.4.1-.8.42-1.03a10.5 10.5 0 016.1 0c.32.23.48.63.42 1.03-.07.4-.2.79-.4 1.13a.9.9 0 00.14 1.06l1.4 1.46c.34.35.89.37 1.24.03 1.38-1.34 2.4-2.81 2.4-3.87 0-2.07-3.75-3.75-8.25-3.75z"/>`,
            heart: `<path d="M11.645 20.91l-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012a.752.752 0 01-.704 0z"/>`,
            heartOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>`,
            // Solid/outline thumbs-up pair used for the feed "like" button
            // (replacing the old heart icon) -- same glyph in both cases,
            // solid fill when liked (colored blue via the button's own
            // text color class) and a plain stroke outline otherwise,
            // matching the fill/outline convention every other icon pair
            // here follows (see the `isOutline` check in Icon() below).
            thumbUp: `<path d="M2 9.75A1.25 1.25 0 013.25 8.5a1.25 1.25 0 011.25 1.25v7.5a1.25 1.25 0 11-2.5 0v-7.5zM12 4.5V3.2c0-.268.14-.526.395-.607A2 2 0 0115 4.5c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261.99 2.317 2.23.045.7.023 1.4-.068 2.09-.15 1.13-1.12 1.93-2.26 1.93h-5.286c-.591 0-1.176-.104-1.719-.302L9 13.56V6.19l1.28-.495a4.5 4.5 0 001.72-1.195z"/>`,
            thumbUpOutline: `<path stroke-linecap="round" stroke-linejoin="round" d="M2 9.75A1.25 1.25 0 013.25 8.5a1.25 1.25 0 011.25 1.25v7.5a1.25 1.25 0 11-2.5 0v-7.5zM12 4.5V3.2c0-.268.14-.526.395-.607A2 2 0 0115 4.5c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261.99 2.317 2.23.045.7.023 1.4-.068 2.09-.15 1.13-1.12 1.93-2.26 1.93h-5.286c-.591 0-1.176-.104-1.719-.302L9 13.56V6.19l1.28-.495a4.5 4.5 0 001.72-1.195z"/>`,
            comment: `<path fill-rule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223z" clip-rule="evenodd"/><circle cx="8.2" cy="11.2" r="1.15" fill="white"/><circle cx="12" cy="11.2" r="1.15" fill="white"/><circle cx="15.8" cy="11.2" r="1.15" fill="white"/>`,
            repost: `<path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clip-rule="evenodd"/>`,
            send: `<path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z"/>`,
            link: `<path fill-rule="evenodd" d="M19.902 4.098a3.75 3.75 0 00-5.304 0l-4.5 4.5a3.75 3.75 0 001.035 6.037.75.75 0 01-.646 1.353 5.25 5.25 0 01-1.449-8.45l4.5-4.5a5.25 5.25 0 117.424 7.424l-1.757 1.757a.75.75 0 11-1.06-1.06l1.757-1.757a3.75 3.75 0 000-5.304zm-7.389 4.192a5.25 5.25 0 011.449 8.45l-4.5 4.5a5.25 5.25 0 11-7.424-7.424l1.757-1.757a.75.75 0 111.06 1.06l-1.757 1.757a3.75 3.75 0 105.304 5.304l4.5-4.5a3.75 3.75 0 00-1.035-6.037.75.75 0 01.646-1.353z" clip-rule="evenodd"/>`,
            target: `<circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.75" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="1.5"/>`,
            edit: `<path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"/><path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z"/>`,
            clock: `<path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clip-rule="evenodd"/>`,
            calendar: `<path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clip-rule="evenodd"/>`,
            file: `<path fill-rule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" clip-rule="evenodd"/><path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z"/>`,
            folder: `<path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z"/>`,
            bookmark: `<path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clip-rule="evenodd"/>`,
            star: `<path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clip-rule="evenodd"/>`,
            sparkles: `<path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.966 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z" clip-rule="evenodd"/>`,
            flame: `<path fill-rule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.176 7.547 7.547 0 01-1.705-1.715.75.75 0 00-1.152-.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clip-rule="evenodd"/>`,
            bolt: `<path fill-rule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clip-rule="evenodd"/>`,
            landmark: `<path fill-rule="evenodd" d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 11-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6zM4.5 12a.75.75 0 01.75.75v6.75H3a.75.75 0 000 1.5h18a.75.75 0 000-1.5h-2.25V12.75a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75v6.75h-2.25V12.75a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v6.75H8.25V12.75a.75.75 0 00-.75-.75h-3z" clip-rule="evenodd"/>`,
            chart: `<path d="M18.375 2.25c-1.036 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z"/>`,
            check: `<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd"/>`,
            // Plain (non-circled) checkmarks used for chat read-receipt
            // ticks -- single for "sent", double (overlapping) for
            // "delivered"/"read" -- see convoReadTicksHTML in chat.js.
            checkSingle: `<path d="M4.5 12.75l5 5 10-11.5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
            checkDouble: `<path d="M1 12.75l5 5 8-9.25" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 12.75l5 5 9.5-11" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
            grid: `<path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v4.5C1.5 10.41 2.34 11.25 3.375 11.25h4.5c1.036 0 1.875-.84 1.875-1.875v-4.5C9.75 3.839 8.91 3 7.875 3h-4.5zM3.375 12.75c-1.036 0-1.875.84-1.875 1.875v4.5c0 1.035.84 1.875 1.875 1.875h4.5c1.035 0 1.875-.84 1.875-1.875v-4.5c0-1.036-.84-1.875-1.875-1.875h-4.5zM12.75 4.875c0-1.036.84-1.875 1.875-1.875h4.5c1.035 0 1.875.84 1.875 1.875v4.5c0 1.035-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 01-1.875-1.875v-4.5zM12.75 14.625c0-1.036.84-1.875 1.875-1.875h4.5c1.035 0 1.875.84 1.875 1.875v4.5c0 1.035-.84 1.875-1.875 1.875h-4.5a1.875 1.875 0 01-1.875-1.875v-4.5z"/>`,
            play: `<path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd"/>`,
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
            /* Outline (stroke-only) variants used on the desktop nav rail so
               active/inactive tabs read as line icons rather than solid,
               "deep"-colored glyphs. */
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
            suggestionBox: `<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 10.5l1.72-5.16A1.5 1.5 0 016.9 4.25h10.2a1.5 1.5 0 011.43 1.09l1.72 5.16m-18 0v7.5A1.75 1.75 0 005.5 21h13a1.75 1.75 0 001.75-1.75v-7.5m-18 0h5.1a.75.75 0 01.72.54l.4 1.37a1.5 1.5 0 001.44 1.09h1.68a1.5 1.5 0 001.44-1.09l.4-1.37a.75.75 0 01.72-.54h5.1"/>`,
            // Post-type badge glyphs (see post.tagClass in feed.js) --
            // videoClip: a filmstrip with sprocket holes down each side
            // and a play triangle on its screen, for "Video" posts.
            // photoFrame: a picture frame with a sun/mountain scene and a
            // folded corner, for "Photo" posts.
            videoClip: `<rect x="2" y="5" width="20" height="14" rx="2.5"/><rect x="7" y="7.4" width="10" height="9.2" rx="1.4" fill="white"/><rect x="3.1" y="6.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="3.1" y="9.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="3.1" y="12.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="3.1" y="15.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="6.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="9.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="12.6" width="1.5" height="1.5" rx="0.3" fill="white"/><rect x="19.4" y="15.6" width="1.5" height="1.5" rx="0.3" fill="white"/><path d="M10.3 9.8l4 2.2-4 2.2z"/>`,
            photoFrame: `<path fill-rule="evenodd" d="M4 4.75A1.75 1.75 0 015.75 3h13A1.75 1.75 0 0120.5 4.75v9.5a1.75 1.75 0 01-1.75 1.75H9.1L4.7 20.1a.85.85 0 01-1.45-.6V4.75zM8.6 8.6a1.35 1.35 0 100-2.7 1.35 1.35 0 000 2.7zm-2.85 5.4h11.5v-1.15l-3.4-4.15-3.35 3.9-2.05-1.65-2.7 3.05v-.0z" clip-rule="evenodd"/>`,
          };
          const isOutline = /Outline$/.test(type);
          const attrs = isOutline ? `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"` : `viewBox="0 0 24 24" fill="currentColor"`;
          return `<svg ${attrs} class="${cls}">${paths[type] || paths.user}</svg>`;
        }
        // legacy alias used by story bubbles
        function silhouetteIcon(type, cls){ return Icon(type, cls); }

        // Bolder variants of specific icons, used only on title bars per request
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
          };
          return `<svg viewBox="0 0 24 24" fill="currentColor" class="${cls}">${boldPaths[type] || ''}</svg>`;
        }

        function storyBubble(s){
          if (s.mine) {
            const hasGlimpse = (typeof myGlimpses !== 'undefined' && myGlimpses.length > 0);
            const mineRingBg = !hasGlimpse ? 'rgba(10,37,64,0.16)' : (myGlimpsesViewed ? '#d1d5db' : `linear-gradient(135deg, ${NAVY}, ${ROYAL})`);
            // Tapping your own bubble/photo opens the actual glimpse (like
            // tapping anyone else's) once you have one posted -- it used
            // to always open the manage/list screen instead, so there was
            // no direct way to just view your own glimpse the way you'd
            // view someone else's. The small "+" badge always opens that
            // list/add screen either way.
            const openMine = hasGlimpse ? `viewMyGlimpse(${myGlimpses[0].id})` : 'openMyGlimpses()';
            return `
              <div class="flex flex-col items-center gap-1.5 flex-shrink-0 w-20">
                <div class="relative">
                  <button onclick="${openMine}" class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center" style="padding:3.5px;background:${mineRingBg};">
                    <div class="w-full h-full rounded-full overflow-hidden flex items-center justify-center border-2 border-white" style="color:${NAVY};background:rgba(10,37,64,0.14);">${profileData.photo ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : silhouetteIcon(s.icon,'w-9 h-9')}</div>
                  </button>
                  <button onclick="event.stopPropagation(); openMyGlimpses()" title="Add to your glimpse" class="absolute z-10 rounded-full flex items-center justify-center shadow" style="top:0;left:0;width:1.5rem;height:1.5rem;box-sizing:border-box;color:${NAVY};background:#ffffff;border:3px solid ${NAVY};">${Icon('plus','w-3 h-3')}</button>
                </div>
                <button onclick="${openMine}" class="text-xs font-semibold text-gray-800 truncate w-20 text-center">${escapeHtml(s.name)}</button>
              </div>`;
          }
          const ringStyle = s.viewed ? 'background:#d1d5db;' : `background:linear-gradient(135deg, ${NAVY}, ${ROYAL});`;
          return `
            <button onclick="viewStory('${s.id}')" class="flex flex-col items-center gap-1.5 flex-shrink-0 w-20">
              <div class="w-20 h-20 rounded-full p-[3.5px]" style="${ringStyle}">
                <div class="w-full h-full rounded-full ${s.bg} flex items-center justify-center border-2 border-white overflow-hidden">${s.photo ? `<img src="${s.photo}" class="w-full h-full object-cover">` : silhouetteIcon(s.icon, 'w-9 h-9 ' + (s.iconClass||''))}</div>
              </div>
              <div class="text-xs font-semibold text-gray-800 truncate w-20 text-center">${escapeHtml(s.name)}</div>
            </button>`;
        }

        // A person's glimpses each load for the same fixed duration. If they
        // posted more than one, the bar at the top is divided into that many
        // equal segments (not one bar shared/stretched across all of them);
        // finished segments sit full, the active one fills over
        // STORY_ITEM_DURATION_MS, and the rest stay empty until reached.
        const STORY_ITEM_DURATION_MS = 4500;
        let currentStoryId = null;
        let currentItemIndex = 0;
        let storyTimer = null;
        let storyTypingTimeout = null;
        // Real microphone speech-to-text, backed by the Web Speech API
        // (which itself requests actual mic access from the browser).
        // Shared by the glimpse-reply, DM, and AI-class mic buttons so
        // each one records real speech instead of faking a canned reply.
        // Falls back to a short "not supported" flash if the browser/
        // device has no SpeechRecognition implementation, rather than
        // pretending to have heard anything.
        let activeSpeechRecognition = null;
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
            // No mic speech-recognition support in this browser: say so
            // instead of silently inserting fake text.
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
        // Tracks how far into the current item's duration we are (ms) and
        // when the current running segment started, so a press-and-hold or
        // typing pause can freeze the progress bar and resume from the same
        // spot instead of restarting or continuing to silently count down.
        let storyElapsedMs = 0;
        let storyRunStartedAt = 0;
        let storyPaused = false;

        function storyItems(s){
          return (s.items && s.items.length) ? s.items : [{ caption: s.caption, icon: s.icon, iconClass: s.iconClass }];
        }

        // Once a person's glimpse ring has been marked viewed (gray, not
        // blue) it should also drop to the back of the story strip --
        // same "seen, out of the way" convention as every other stories
        // UI -- instead of staying wherever it happened to sort
        // originally. Keeps `stories[0]` (the "mine" bubble) untouched
        // and only reshuffles among everyone else, stably: the relative
        // order within the still-unviewed group and within the
        // already-viewed group is left exactly as it was.
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
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = storyViewerHTML(s, currentItemIndex);
          startStoryTimer(s);
          // Record a real view against this specific item -- s.items only
          // exists (with real backend row ids) for other accounts' remote
          // glimpses; single-item local/demo stories have nothing to
          // register against, so this just no-ops for those.
          if (!s.mine && s.items && s.items[currentItemIndex] && s.items[currentItemIndex].id != null) {
            glimpseViewRemote(s.items[currentItemIndex].id);
          }
        }

        // Called whenever a new item/story loads: resets progress to 0 and
        // starts the bar running from scratch.
        function startStoryTimer(s){
          storyElapsedMs = 0;
          resumeStoryTimer(s);
        }

        // Resumes the bar from wherever storyElapsedMs left off (used after
        // a press-and-hold or a typing pause ends). Restarting the fill's
        // transition from its current width, rather than from 0%, is what
        // makes it continue instead of visibly jumping back.
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
            void fill.offsetWidth; // force reflow so the transition below restarts cleanly
            fill.style.transition = `width ${remaining}ms linear`;
            fill.style.width = '100%';
          }
          storyTimer = setTimeout(() => advanceStory(s, 1), remaining);
        }

        // Freezes the bar exactly where it is; used while the user is
        // pressing and holding the glimpse, or typing in the reply box.
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

        // Resumes the currently open story/item after a pause (as opposed
        // to resumeStoryTimer(s), which needs the story object directly).
        function resumeCurrentStoryTimer(){
          if (!storyPaused) return;
          const s = stories.find(x => x.id === currentStoryId);
          if (s) resumeStoryTimer(s);
        }

        function clearStoryTimer(){
          if (storyTimer) { clearTimeout(storyTimer); storyTimer = null; }
        }

        // dir = 1 for next glimpse/person, -1 for previous
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

        // Press-and-hold-to-pause: holding a finger/mouse down on the
        // glimpse freezes the loading bar; lifting it quickly (a genuine
        // tap) advances to the next glimpse, but lifting after a longer
        // hold just resumes from where it paused, without advancing.
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
          const maxH = 104; // ~6.5rem
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
          // Use the real microphone via the Web Speech API instead of a
          // canned reply; the send icon just needs its own accent classes
          // (bg-[NAVY] rather than the shared mic-button gray/navy pair),
          // so toggle those manually around the shared recorder.
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
          // Give visible feedback right on the glimpse screen; otherwise
          // tapping the attach icon looks like it did nothing.
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
            <div class="flex flex-col h-full bg-black text-white" style="padding-top:20px;">
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
                      ? `<video src="${item.mediaUrl}" class="max-w-full max-h-full" autoplay playsinline loop></video>`
                      : `<img src="${item.mediaUrl}" class="max-w-full max-h-full object-contain">`}
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

        // ---------------- MY GLIMPSES (My status) ----------------
        // Glimpses are now backed by a real table too, the same way posts
        // are (see POSTS_TABLE above) -- previously GlimpsesAPI only ever
        // wrote to this browser's own local myGlimpses/queueSaveUserState,
        // so a glimpse never reached anyone else's device no matter how
        // long you waited; it just quietly "went live" nowhere.
        //
        // Requires, in the configured Supabase project:
        //   create table glimpses (
        //     id text primary key,
        //     user_id uuid not null references auth.users(id) on delete cascade,
        //     data jsonb not null,
        //     created_at timestamptz not null default now()
        //   );
        //   alter table glimpses enable row level security;
        //   create policy "Anyone signed in can read glimpses" on glimpses
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Users can insert their own glimpses" on glimpses
        //     for insert with check (auth.uid() = user_id);
        //   create policy "Users can delete their own glimpses" on glimpses
        //     for delete using (auth.uid() = user_id);
        //
        //   create table glimpse_views (
        //     glimpse_id text not null,
        //     user_id uuid not null references auth.users(id) on delete cascade,
        //     created_at timestamptz not null default now(),
        //     primary key (glimpse_id, user_id)
        //   );
        //   alter table glimpse_views enable row level security;
        //   create policy "Anyone signed in can read glimpse views" on glimpse_views
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Users record their own view" on glimpse_views
        //     for insert with check (auth.uid() = user_id);
        //
        // Until these tables exist, posting/viewing a glimpse still works
        // exactly as before for its own author -- it just stays local to
        // that one browser, same fallback as everywhere else in this app.
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

        // Best-effort: records that the current account viewed a specific
        // glimpse item (own glimpses are skipped, same convention as
        // postViewRemote, and each glimpse only ever counts one view per
        // viewer no matter how many times they replay it).
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

        // Pulls every other account's still-live (< 24h old) glimpses into
        // the story strip, grouped one bubble per person with their items
        // in posting order -- the actual "go live to other accounts" half
        // of glimpses, mirroring loadRemotePosts for the feed. Called once
        // on app entry and again whenever Home is reopened (see
        // window.onload in games.js and switchTab in core.js).
        // Same "did anything actually change" return convention as
        // loadRemotePosts above, and for the same reason -- see the
        // switchTab(0) comment in core.js.
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

            // Home re-runs this fetch every time the tab is reopened (see
            // the comment above), which used to rebuild every bubble
            // from scratch with viewed: false -- so the blue "unwatched"
            // ring came right back on someone whose glimpse you'd
            // already watched, the moment you left Home and returned.
            // Carrying forward the previous viewed flag (matched by
            // author id) is what actually makes "seen" stick.
            // Track not just *whether* an author was previously viewed but
            // the newest item id that was true of at the time -- otherwise
            // an author who posts a fresh glimpse after you'd already seen
            // an earlier one from them would keep showing the gray
            // "already seen" ring instead of switching back to the
            // gradient "new/unviewed" ring, since the old code only ever
            // recorded a per-author yes/no flag with no way to tell a
            // brand new glimpse apart from one already looked at.
            const previouslyViewed = {};
            stories.forEach(s => {
              if (s.mine) return;
              previouslyViewed[s.id] = {
                viewed: !!s.viewed,
                newestId: (s.items && s.items.length) ? Math.max(...s.items.map(it => it.id || 0)) : 0,
              };
            });
            // Also fold in whatever's persisted from a previous
            // session/login (see persistGlimpseViewed) so a glimpse this
            // account already watched doesn't come back as "unviewed"
            // just because the app was closed and reopened -- but again,
            // only up through whatever newest item id was actually seen.
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
        // Mirrors the "viewed" flag other people's story rings use --
        // true once you've actually opened one of your own glimpses in
        // the full-screen viewer (viewMyGlimpse), so the ring goes gray
        // just like anyone else's does once seen. Just opening the "My
        // glimpse" list (openMyGlimpses) doesn't count -- with several
        // glimpses posted, the ring should stay blue until you've
        // actually looked at what's in there. Resets to false (ring
        // back to gradient) the moment a new glimpse of yours is added.
        let myGlimpsesViewed = false;
        let openMyGlimpseMenuId = null;

        // Persists whether *your own* glimpse ring has been opened (see
        // myGlimpsesViewed above) so it doesn't come back showing the
        // blue/gradient "unwatched" ring purely because the app was
        // closed and reopened -- only in-memory state tracked this
        // before, which is why it kept resetting on every fresh login.
        // Stores the newest glimpse id that existed the last time you
        // opened viewMyGlimpse, scoped per account (same pattern as
        // glimpsesViewedStorageKey below); a newly-posted glimpse still
        // shows the gradient ring again since its id will be newer than
        // whatever's stored.
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
          } catch (e) { /* ignore */ }
        }
        // Called once myGlimpses has been restored from saved account
        // state (see applyUserState in core.js) to decide whether the
        // ring should start out gray (already seen this login) or
        // gradient (unwatched) for whatever's actually in myGlimpses now.
        function syncMyGlimpsesViewedFromStorage(){
          try {
            const key = myGlimpseViewedStorageKey();
            if (!key || !myGlimpses.length) { myGlimpsesViewed = false; return; }
            const stored = parseInt(localStorage.getItem(key) || '0', 10);
            const newestId = Math.max(...myGlimpses.map(g => g.id || 0));
            myGlimpsesViewed = stored >= newestId;
          } catch (e) { myGlimpsesViewed = false; }
        }

        // Glimpses auto-expire this long after being posted (24 hours),
        // matching the "disappear after 24 hours" copy shown in the list.
        const GLIMPSE_LIFETIME_MS = 24 * 60 * 60 * 1000;

        // Which other-account glimpses (keyed by the author's user id,
        // matching stories[].id for a remote story) *this* signed-in
        // account has already opened, persisted in localStorage so a
        // glimpse someone already viewed doesn't come back showing as
        // unviewed (blue ring, sorted back to the front) after a fresh
        // login/reload -- only the in-memory `stories[].viewed` flag used
        // to track this, which reset on every real page load. Scoped per
        // account id (same pattern as careerStartPillDismissedKey in
        // core.js) and wrapped in try/catch since localStorage can throw
        // in private-browsing/storage-restricted contexts.
        function glimpsesViewedStorageKey(){
          const uid = (typeof _cachedAuthUser !== 'undefined' && _cachedAuthUser) ? _cachedAuthUser.id : null;
          return uid ? `glimpses-viewed-v1:${uid}` : null;
        }

        // Returns { [authorUserId]: { newestId, ts } }, dropping any
        // entries older than a glimpse's 24-hour lifetime (that author's
        // glimpse from back then is gone anyway, and a new one from them
        // should show as unviewed like normal). newestId is the highest
        // item id that had been seen as of ts, so a later glimpse from
        // the same author (a higher id) is recognized as new/unviewed
        // instead of being masked by the old per-author-only flag.
        function loadPersistedViewedGlimpses(){
          try {
            const key = glimpsesViewedStorageKey();
            if (!key) return {};
            const raw = localStorage.getItem(key);
            const map = raw ? (JSON.parse(raw) || {}) : {};
            const cutoff = Date.now() - GLIMPSE_LIFETIME_MS;
            let changed = false;
            Object.keys(map).forEach(id => {
              // Older entries were stored as a bare timestamp number;
              // normalize those to the new { newestId, ts } shape so a
              // stale-format entry doesn't throw off comparisons.
              const entry = (map[id] && typeof map[id] === 'object') ? map[id] : { newestId: 0, ts: map[id] };
              if (!(entry.ts > cutoff)) { delete map[id]; changed = true; }
              else { map[id] = entry; }
            });
            if (changed) { try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) { /* ignore */ } }
            return map;
          } catch (e) { return {}; }
        }

        // Marks one author's glimpse(s) as viewed for next login, up
        // through whatever their newest item id is right now. Called
        // right alongside the existing in-memory `s.viewed = true` (see
        // viewStory and goToAdjacentStory). Takes the story object itself
        // (not just the author id) so it can record that newest id --
        // otherwise a later glimpse from the same author would still
        // read back as "already viewed" and never show the unviewed
        // ring again.
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
          } catch (e) { /* ignore */ }
        }

        // Drops any glimpse whose 24-hour window has passed. Cheap to call
        // often: it's a no-op (no re-render, no save) when nothing expired.
        // Called before anything reads/renders myGlimpses so an expired
        // glimpse never has a chance to show up stale.
        function purgeExpiredGlimpses(){
          const cutoff = Date.now() - GLIMPSE_LIFETIME_MS;
          const before = myGlimpses.length;
          myGlimpses = myGlimpses.filter(g => (g.createdAt || g.id || 0) > cutoff);
          const changed = myGlimpses.length !== before;
          if (changed) queueSaveUserState();
          return changed;
        }

        // ---------------- COMPOSE GLIMPSE (pen icon) ----------------
        // Glimpse compose background now just follows the app's own
        // light/dark theme instead of offering a separate color picker --
        // white in light mode, black in dark mode -- so there's nothing
        // to cycle through anymore.
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

        function openMyGlimpses(){
          purgeExpiredGlimpses();
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
              <div class="flex items-center gap-4 px-4 pb-4 border-b border-gray-100 flex-shrink-0 bg-white" style="padding-top:20px;">
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
            <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 relative">
              <div class="rounded-full flex items-center justify-center text-white overflow-hidden flex-shrink-0" style="width:3.5rem;height:3.5rem;${g.bgStyle}">${g.mediaType === 'image' ? `<img src="${g.mediaUrl}" class="w-full h-full object-cover">` : g.mediaType === 'video' ? `<video src="${g.mediaUrl}" class="w-full h-full object-cover" muted></video>` : silhouetteIcon(g.icon,'w-6 h-6')}</div>
              <button onclick="viewMyGlimpse(${g.id})" class="flex-1 min-w-0 text-left">
                <div class="text-[15px] font-semibold text-gray-800">${g.timeLabel}</div>
              </button>
              <button onclick="toggleMyGlimpseMenu(${g.id})" class="w-8 h-8 flex items-center justify-center text-gray-400 flex-shrink-0">${IconBold('dots','w-5 h-5')}</button>
              ${openMyGlimpseMenuId === g.id ? `
                <div onclick="toggleMyGlimpseMenu(${g.id})" onwheel="toggleMyGlimpseMenu(${g.id})" ontouchmove="toggleMyGlimpseMenu(${g.id})" class="fixed inset-0 z-10"></div>
                <div class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:2.75rem;top:2.75rem;width:11rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
                  <button onclick="toggleMyGlimpseMenu(${g.id}); openShareGlimpse(${g.id});" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('send','w-4 h-4')} Share glimpse</button>
                  <button onclick="deleteMyGlimpse(${g.id})" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete glimpse</button>
                </div>
              ` : ''}
            </div>`;
        }

        function toggleMyGlimpseMenu(id){
          openMyGlimpseMenuId = (openMyGlimpseMenuId === id) ? null : id;
          refreshMyGlimpses();
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
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = myGlimpseViewerHTML(g);
          loadGlimpseViewers(g);
        }

        // Best-effort: pulls the real list of who has viewed this glimpse
        // (see glimpse_views, written by glimpseViewRemote whenever
        // someone else opens it) and re-renders once it resolves, so the
        // eye-icon count and "Viewed by" list reflect real viewers instead
        // of staying stuck at the empty array it's created with.
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
            const ov = document.getElementById('overlay');
            if (ov && currentStoryId === null) ov.innerHTML = myGlimpseViewerHTML(g);
          } catch (e) { /* best effort -- viewer list just stays empty */ }
        }

        // Whether the "Viewed by" list is expanded over the glimpse (tapping
        // the eye icon toggles this, WhatsApp-status style) -- views aren't
        // shown by default, only after the person deliberately asks for them.
        let myGlimpseViewersOpen = false;

        function toggleMyGlimpseViewers(id){
          myGlimpseViewersOpen = !myGlimpseViewersOpen;
          const g = myGlimpses.find(x => x.id === id);
          if (!g) return;
          const ov = document.getElementById('overlay');
          if (ov) ov.innerHTML = myGlimpseViewerHTML(g);
        }

        // Shows your own glimpse plus who has viewed it, each with a reply
        // button; unlike other people's glimpses, your own glimpse screen
        // has nothing to "reply" to on the glimpse itself, so this shows
        // the viewer list instead of the message-composer bar.
        function myGlimpseViewerHTML(g){
          const viewers = g.viewers || [];
          const open = myGlimpseViewersOpen;
          // Text-only glimpses now only ever use white or black as their
          // own background (see glimpseComposeBg) -- keep the caption and
          // header readable against either by flipping to dark text/icons
          // on a white glimpse instead of always assuming white-on-dark.
          const isLightGlimpse = !g.mediaUrl && g.bgStyle && g.bgStyle.indexOf('#ffffff') !== -1;
          const fg = isLightGlimpse ? '#0a2540' : '#ffffff';
          const avatarBg = isLightGlimpse ? 'rgba(10,37,64,0.10)' : 'rgba(255,255,255,0.16)';
          return `
            <div class="flex flex-col h-full relative" style="color:${fg};${g.mediaUrl ? 'background:#000;' : g.bgStyle}">
              <div class="absolute inset-0 flex items-center justify-center ${g.mediaUrl ? 'bg-black' : ''} pointer-events-none">
                ${g.mediaUrl ? `
                  ${g.mediaType === 'video'
                    ? `<video src="${g.mediaUrl}" class="max-w-full max-h-full" autoplay playsinline loop></video>`
                    : `<img src="${g.mediaUrl}" class="max-w-full max-h-full object-contain">`}
                ` : `
                  <div class="px-8 text-center">
                    <div class="text-lg font-medium" style="color:${fg};">${escapeHtml(g.caption)}</div>
                  </div>
                `}
              </div>
              <div class="relative flex items-center gap-3 px-4 flex-shrink-0" style="padding-top:20px;">
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
              <div class="relative flex items-center px-4 flex-shrink-0" style="${g.caption && g.mediaUrl ? '' : 'margin-top:auto;'}padding-top:0.75rem;padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);">
                <button onclick="toggleMyGlimpseViewers(${g.id})" class="flex items-center gap-2 rounded-full pl-3 pr-4 py-2 text-white" style="background:rgba(0,0,0,0.45);color:#ffffff;">
                  ${Icon(open ? 'eyeOff' : 'eye', 'w-5 h-5')}
                  <span class="text-sm font-semibold">${viewers.length}</span>
                </button>
              </div>
              ${open ? `
                <div onclick="toggleMyGlimpseViewers(${g.id})" class="absolute inset-0 z-10" style="background:rgba(0,0,0,0.35);"></div>
                <div class="absolute left-0 right-0 bottom-0 z-20 bg-white text-gray-900 overflow-y-auto" style="border-top-left-radius:1.5rem;border-top-right-radius:1.5rem;max-height:60vh;padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);">
                  <div class="flex justify-center pt-2.5 pb-1"><div class="w-9 h-1 rounded-full bg-gray-300"></div></div>
                  <div class="px-5 pb-2" style="padding-top:0.5rem;">
                    <div class="text-base font-bold font-display">Viewed by ${viewers.length}</div>
                  </div>
                  ${viewers.length === 0 ? `
                    <div class="px-6 text-center text-gray-400 text-sm" style="padding-top:2.5rem;padding-bottom:2.5rem;">No views yet.</div>
                  ` : viewers.map(glimpseViewerRow).join('')}
                </div>
              ` : ''}
            </div>`;
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

        // Opens (or creates) a chat with a glimpse viewer so you can reply
        // directly to them, the same way tapping any inbox conversation does.
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
              <div class="flex items-center justify-between px-4 flex-shrink-0" style="padding-top:20px;">
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

        // Cycles the typeface used for the glimpse text (not its size;
        // the size stays fixed at GLIMPSE_COMPOSE_FONT_SIZE).
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

        function composeGlimpseMedia(){
          const input = document.getElementById('glimpse-media-input');
          if (input) input.click();
        }

        // Glimpse videos are capped at this length. Anything longer gets
        // cut into this-many-seconds-or-shorter, back-to-back clips and
        // each one is posted as its own glimpse in order (see
        // splitAndPostGlimpseVideo), the same way a long upload becomes
        // multiple Stories elsewhere.
        const GLIMPSE_MAX_SECONDS = 60;

        function handleGlimpseMediaSelected(e){
          const file = e.target.files && e.target.files[0];
          // Reset so choosing the same file again still fires onchange
          e.target.value = '';
          if (!file) return;
          const isVideo = file.type.startsWith('video/');
          // A blob: URL (just a lightweight reference to the file, not the
          // file's actual bytes) instead of a data: URL here on purpose --
          // reading a large/long video into a base64 data: URL and then
          // embedding it (twice: blurred background copy + foreground
          // copy) inside glimpseMediaCaptionHTML's template string could
          // exceed the JS engine's max string length and crash with
          // "RangeError: Invalid string length" in production.
          const previewUrl = URL.createObjectURL(file);
          if (!isVideo) {
            glimpseMediaDurationSec = null;
            openGlimpseMediaCaptionScreen(file, 'image', previewUrl);
            return;
          }
          openGlimpseMediaCaptionScreen(file, 'video', previewUrl);
          // Figure out the clip's length in the background so the caption
          // screen can flag (and, on submit, actually perform) a split
          // once it's known -- doesn't block opening the preview.
          const probe = document.createElement('video');
          probe.preload = 'metadata';
          probe.muted = true;
          probe.onloadedmetadata = function(){
            URL.revokeObjectURL(probe.src);
            // The user may have already cancelled or picked something
            // else by the time metadata loads -- only apply this to the
            // still-current preview.
            if (glimpseMediaFile !== file) return;
            glimpseMediaDurationSec = isFinite(probe.duration) ? probe.duration : null;
            const el = document.getElementById('glimpse-media-caption-input');
            if (el) refreshGlimpseMediaCaptionScreen();
          };
          probe.onerror = function(){ URL.revokeObjectURL(probe.src); };
          probe.src = previewUrl;
        }

        // ---------------- COMPOSE GLIMPSE (media caption step) ----------------
        // Shown right after a photo/video is picked, before it's posted --
        // lets the user preview the media full-screen and type an optional
        // caption that will be overlaid on it in the glimpse viewer.
        let glimpseMediaPreviewUrl = null;
        let glimpseMediaPreviewType = null; // 'image' | 'video'
        let glimpseMediaCaptionText = '';
        let glimpseMediaFile = null;
        let glimpseMediaDurationSec = null; // set once a picked video's length is known
        let glimpseSplitInProgress = false;

        function openGlimpseMediaCaptionScreen(file, type, url){
          glimpseMediaFile = file;
          glimpseMediaPreviewUrl = url;
          glimpseMediaPreviewType = type;
          glimpseMediaCaptionText = '';
          glimpseSplitInProgress = false;
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = '0';
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = glimpseMediaCaptionHTML();
          const el = document.getElementById('glimpse-media-caption-input');
          if (el) el.focus();
        }

        // Re-renders just the caption screen in place (used once a picked
        // video's duration finishes loading, so the "will post as N
        // glimpses" notice can appear without yanking focus/typing away
        // from the caption box the way a full re-open would).
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

        function glimpseSplitChunkCount(){
          if (glimpseMediaPreviewType !== 'video' || !glimpseMediaDurationSec) return 1;
          return Math.max(1, Math.ceil(glimpseMediaDurationSec / GLIMPSE_MAX_SECONDS));
        }

        function glimpseMediaCaptionHTML(){
          const hasCaption = glimpseMediaCaptionText.trim().length > 0;
          const chunkCount = glimpseSplitChunkCount();
          const splitNotice = chunkCount > 1
            ? `<div class="relative px-4 pb-2 flex-shrink-0"><div class="inline-block text-xs font-semibold px-3 py-1.5 rounded-full" style="background:rgba(0,0,0,0.5);">Longer than ${GLIMPSE_MAX_SECONDS}s -- will post as ${chunkCount} glimpses</div></div>`
            : '';
          return `
            <div class="flex flex-col h-full bg-black text-white relative">
              <div class="absolute inset-0 overflow-hidden">
                ${glimpseMediaPreviewType === 'video'
                  ? `<video src="${glimpseMediaPreviewUrl}" class="absolute inset-0 w-full h-full object-cover" style="filter:blur(35px) brightness(0.65) saturate(1.3);transform:scale(1.2);" autoplay playsinline muted loop></video>`
                  : `<img src="${glimpseMediaPreviewUrl}" class="absolute inset-0 w-full h-full object-cover" style="filter:blur(35px) brightness(0.65) saturate(1.3);transform:scale(1.2);">`}
                <div class="absolute inset-0 flex items-center justify-center">
                  ${glimpseMediaPreviewType === 'video'
                    ? `<video src="${glimpseMediaPreviewUrl}" class="max-w-full max-h-full" autoplay playsinline muted loop></video>`
                    : `<img src="${glimpseMediaPreviewUrl}" class="max-w-full max-h-full object-contain">`}
                </div>
              </div>
              <div class="relative flex items-center px-4 flex-shrink-0" style="padding-top:20px;">
                <button onclick="cancelGlimpseMediaCaption()" class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(0,0,0,0.45);">${IconBold('close','w-5 h-5')}</button>
              </div>
              ${glimpseSplitInProgress ? `
              <div class="relative flex-1 flex items-center justify-center px-4">
                <div class="text-sm font-semibold px-4 py-2 rounded-full" style="background:rgba(0,0,0,0.55);">Splitting into ${chunkCount} glimpses...</div>
              </div>` : `
              ${splitNotice}
              <div class="relative flex items-end gap-2 px-4" style="margin-top:auto;padding-bottom:calc(env(safe-area-inset-bottom, 16px) + 16px);">
                <textarea id="glimpse-media-caption-input" oninput="handleGlimpseMediaCaptionInput()" placeholder="Add a caption..." rows="1"
                  class="flex-1 min-w-0 text-sm text-white placeholder-gray-300" style="background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.25);outline:none;resize:none;padding:0.65rem 1rem;border-radius:9999px;max-height:6.5rem;overflow-y:auto;line-height:1.3;">${escapeHtml(glimpseMediaCaptionText)}</textarea>
                <button id="glimpse-media-caption-send" onclick="submitGlimpseMediaCaption()" class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style="background:${hasCaption ? '#22c55e' : '#ffffff'};box-shadow:0 2px 8px rgba(0,0,0,0.35);">${Icon('send', hasCaption ? 'w-5 h-5 text-white' : `w-5 h-5 text-[${NAVY}]`)}</button>
              </div>`}
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
          if (glimpseSplitChunkCount() > 1) {
            splitAndPostGlimpseVideo(glimpseMediaFile, glimpseMediaDurationSec, caption);
            return;
          }
          addMyGlimpse({
            caption,
            icon:'camera',
            bgStyle:'background:linear-gradient(135deg,#374151,#111827)',
            mediaUrl: glimpseMediaPreviewUrl,
            mediaType: glimpseMediaPreviewType,
            mediaFile: glimpseMediaFile,
          });
          resetGlimpseMediaCaptionState();
          openMyGlimpses();
        }

        function cancelGlimpseMediaCaption(){
          if (glimpseSplitInProgress) return; // don't let a mid-split cancel orphan the recorder
          resetGlimpseMediaCaptionState();
          openMyGlimpses();
        }

        function resetGlimpseMediaCaptionState(){
          glimpseMediaPreviewUrl = null;
          glimpseMediaPreviewType = null;
          glimpseMediaCaptionText = '';
          glimpseMediaFile = null;
          glimpseMediaDurationSec = null;
          glimpseSplitInProgress = false;
        }

        // Picks the best video mime type this browser's MediaRecorder
        // actually supports, for the re-encoded clip chunks below.
        function pickGlimpseChunkMimeType(){
          const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
          for (const type of candidates) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) return type;
          }
          return '';
        }

        // A video longer than GLIMPSE_MAX_SECONDS gets cut into that-many-
        // seconds-or-shorter, back-to-back clips, and each one is posted
        // as its own glimpse in order -- the typed caption only goes on
        // the first. Each chunk is produced by actually seeking/playing
        // the source video and capturing its live video+audio stream
        // (HTMLMediaElement.captureStream + MediaRecorder) rather than
        // re-reading the whole file as a data: URL, which is what used to
        // be able to exceed the JS engine's max string length on longer
        // clips and crash glimpseMediaCaptionHTML in production.
        function splitAndPostGlimpseVideo(file, duration, firstCaption){
          const testEl = document.createElement('video');
          if (typeof MediaRecorder === 'undefined' || typeof testEl.captureStream !== 'function') {
            // Can't split on this browser -- post the full clip rather
            // than block the user.
            addMyGlimpse({
              caption: firstCaption || '',
              icon: 'camera',
              bgStyle: 'background:linear-gradient(135deg,#374151,#111827)',
              mediaUrl: glimpseMediaPreviewUrl,
              mediaType: 'video',
              mediaFile: file,
            });
            resetGlimpseMediaCaptionState();
            openMyGlimpses();
            return;
          }

          glimpseSplitInProgress = true;
          refreshGlimpseMediaCaptionScreen();

          const chunkCount = Math.max(1, Math.ceil(duration / GLIMPSE_MAX_SECONDS));
          const player = document.createElement('video');
          player.muted = false;
          player.playsInline = true;
          player.src = URL.createObjectURL(file);
          player.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;';
          document.body.appendChild(player);

          const recordChunk = (index) => new Promise((resolve, reject) => {
            const start = index * GLIMPSE_MAX_SECONDS;
            const end = Math.min(duration, start + GLIMPSE_MAX_SECONDS);
            const onSeeked = () => {
              player.removeEventListener('seeked', onSeeked);
              let stream;
              try { stream = player.captureStream(); } catch (err) { reject(err); return; }
              let recorder;
              try { recorder = new MediaRecorder(stream, { mimeType: pickGlimpseChunkMimeType() }); }
              catch (err) { reject(err); return; }
              const parts = [];
              let settled = false;
              recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) parts.push(ev.data); };
              recorder.onstop = () => {
                if (settled) return;
                settled = true;
                player.pause();
                resolve(new Blob(parts, { type: recorder.mimeType || file.type }));
              };
              recorder.onerror = (err) => { if (!settled) { settled = true; reject(err); } };
              recorder.start();
              player.play().catch(reject);
              const stopTimer = setTimeout(() => {
                if (recorder.state !== 'inactive') recorder.stop();
              }, Math.max(200, (end - start) * 1000));
              player.addEventListener('ended', function onEnded(){
                player.removeEventListener('ended', onEnded);
                clearTimeout(stopTimer);
                if (recorder.state !== 'inactive') recorder.stop();
              });
            };
            player.addEventListener('seeked', onSeeked);
            player.currentTime = start;
          });

          (async () => {
            try {
              for (let i = 0; i < chunkCount; i++) {
                const blob = await recordChunk(i);
                const chunkFile = new File([blob], `glimpse-${Date.now()}-${i + 1}.webm`, { type: blob.type });
                addMyGlimpse({
                  caption: i === 0 ? (firstCaption || '') : '',
                  icon: 'video',
                  bgStyle: 'background:linear-gradient(135deg,#374151,#111827)',
                  mediaUrl: URL.createObjectURL(blob),
                  mediaType: 'video',
                  mediaFile: chunkFile,
                });
              }
            } catch (err) {
              console.warn('Glimpse split failed, posting the original clip instead:', err);
              addMyGlimpse({
                caption: firstCaption || '',
                icon: 'camera',
                bgStyle: 'background:linear-gradient(135deg,#374151,#111827)',
                mediaUrl: glimpseMediaPreviewUrl,
                mediaType: 'video',
                mediaFile: file,
              });
            } finally {
              URL.revokeObjectURL(player.src);
              player.remove();
              resetGlimpseMediaCaptionState();
              openMyGlimpses();
            }
          })();
        }

        // Re-renders the home story strip in place (if it's currently on
        // screen) -- used so the ring around your own bubble appears or
        // disappears right away after posting/deleting a glimpse, without
        // needing to leave and come back to the Home tab.
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

        // Stateful post data so like/comment/repost/share persist while browsing
        // connected:true  -> poster is in your network (no Connect button, just meta line)
        // connected:false -> poster is outside your connections (shows a "Connect" button, "Suggested for you")
        let feedPosts = [];

        // Tombstone of post ids this account has deleted locally but whose
        // remote delete (postDeleteRemote) hasn't been confirmed yet. Kept
        // so a refresh -- or a loadRemotePosts that runs before the delete
        // request finishes -- doesn't pull the still-there row straight
        // back into feedPosts. Cleared once the remote delete succeeds.
        let deletedPostIds = new Set();

        // The number shown as "Posts" on the profile (and the Job Plan
        // stats panel) -- computed live from feedPosts rather than a
        // manually incremented counter. profileData.posts used to try to
        // track this by hand, but nothing ever incremented it on create
        // (only deletePost decremented it), so it was permanently wrong
        // for every account. Mirrors the same fix already applied to
        // networkConnectionCount() in chat.js.
        function myPostsCount(){
          return feedPosts.filter(p => p.mine).length;
        }

        // ================== BACKEND-READY DATA LAYER (Posts & Glimpses) ==================
        // Every Post and Glimpse ("My glimpse" / status) read-or-write goes
        // through PostsAPI / GlimpsesAPI below instead of the UI touching
        // feedPosts / myGlimpses directly. Each method already returns a
        // Promise and takes/returns plain, JSON-serializable data, exactly
        // like a real network call would.
        //
        // There's no backend yet, so every method below just reads/writes
        // the local feedPosts / myGlimpses arrays, wrapped in mockRequest()
        // so callers already `await` it the same way they'd await a real
        // request. When a backend exists, swap ONLY the body of the
        // relevant method for a fetch() call returning the same shape of
        // data: nothing that calls PostsAPI.* / GlimpsesAPI.* elsewhere
        // in the app needs to change. For example:
        //
        //   list(){
        //     return fetch('/api/posts').then(res => res.json());
        //   },
        //   create(data){
        //     return fetch('/api/posts', {
        //       method: 'POST',
        //       headers: { 'Content-Type': 'application/json' },
        //       body: JSON.stringify(data)
        //     }).then(res => res.json());
        //   },
        // Runs the local mock immediately (so any code that doesn't bother
        // to await it, like a stray forEach(), still sees the change take
        // effect right away) but still returns a real Promise, so any code
        // that DOES await it/.then() it behaves exactly like it will once
        // this is swapped for a real fetch() call.
        function mockRequest(fn){
          return Promise.resolve(fn());
        }

        // ---- Shared posts backend (Supabase) ----
        // Posts used to live only in this browser's own account-state blob
        // (see the note on feedPosts in core.js's collectUserState), so a
        // post made here never reached anyone else's feed -- there was no
        // shared table backing it, just a per-account save. This adds one:
        // a post's media (if any) is uploaded to a public Storage bucket,
        // and the post itself is inserted as a row in `posts`; every
        // account pulls those rows into its feed via loadRemotePosts()
        // below. Likes/reposts/saves/comments are now ALSO backed by their
        // own per-user tables (see the "Post interactions" block further
        // down in this file) so a like/comment/reshare made on one account
        // shows up for everyone else too, instead of only updating that
        // one browser's local state.
        //
        // Requires, in the configured Supabase project:
        //   create table posts (
        //     id text primary key,
        //     data jsonb not null,
        //     created_by uuid references auth.users(id),
        //     created_at timestamptz not null default now()
        //   );
        //   alter table posts enable row level security;
        //   create policy "Anyone signed in can read posts"
        //     on posts for select using (auth.role() = 'authenticated');
        //   create policy "Users can insert their own posts"
        //     on posts for insert with check (auth.uid() = created_by);
        //   create policy "Users can delete their own posts"
        //     on posts for delete using (auth.uid() = created_by);
        // ...plus a public Storage bucket named POST_MEDIA_BUCKET
        // (Storage -> New bucket -> Public bucket) for the photo/video
        // attached to a post. Until both exist, posting still works for
        // its author (same as before), it just won't reach other accounts.
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

        // Removes a post/glimpse's media file from the shared Storage
        // bucket. Called when the post/glimpse itself is deleted so the
        // underlying file doesn't just sit there forever, orphaned --
        // deleting the `posts`/`glimpses` row alone (postDeleteRemote /
        // glimpseDeleteRemote) only ever removed the database record, not
        // the actual file in POST_MEDIA_BUCKET. Best-effort: a failure
        // here shouldn't block or undo the row deletion, which has
        // already gone through.
        async function deletePostMediaFromStorage(path){
          if (!path) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { error } = await sb.storage.from(POST_MEDIA_BUCKET).remove([path]);
            if (error) console.warn('Post media delete failed:', error.message);
          } catch (err) { console.warn('Post media delete failed:', err); }
        }

        // Deletes every file behind a multi-media post in one go -- same
        // as deletePostMediaFromStorage but for the mediaPaths array a
        // post with more than one photo/video carries.
        async function deletePostMediaListFromStorage(paths){
          if (!paths || !paths.length) return;
          const sb = getSupabaseClient();
          if (!sb) return;
          try {
            const { error } = await sb.storage.from(POST_MEDIA_BUCKET).remove(paths);
            if (error) console.warn('Post media delete failed:', error.message);
          } catch (err) { console.warn('Post media delete failed:', err); }
        }

        // Plain tap-to-play/pause video for feed posts -- deliberately NOT
        // using the native `controls` bar, since that bar comes with a
        // seek/scrub strip along the bottom and (in Chrome/Android) an
        // overflow "..." menu offering Download, Picture-in-Picture and
        // playback-speed options that shouldn't be exposed on post videos.
        // A video starts playing on its own once it's scrolled into view
        // (see setupFeedVideoAutoplay below) and pauses again once it's
        // scrolled back out -- same as Instagram/TikTok feed video --
        // tapping it also toggles play/pause by hand, and a simple
        // centered play icon fades in while paused. There is no
        // progress/scrub bar and no overflow menu at all. A small volume
        // icon in the corner (see toggleFeedVideoMute below) is the one
        // other control -- feed video starts muted (autoplaying with
        // sound isn't something browsers allow without a direct tap, and
        // muted-by-default is the same convention Instagram/TikTok use),
        // tap it to unmute.
        function simplePostVideoHtml(url, errorTarget){
          const uid = 'pv' + Math.random().toString(36).slice(2, 9);
          const err = errorTarget || 'Video no longer available';
          return `
            <div class="relative feed-video-wrap" id="${uid}" onclick="toggleFeedVideoPlay('${uid}')">
              <video src="${url}" playsinline webkit-playsinline muted preload="metadata" disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" class="w-full h-auto bg-black block feed-video-fade" style="opacity:0;transition:opacity .15s ease;" onloadeddata="this.style.opacity='1';" onended="const b=this.closest('.feed-video-wrap').querySelector('.feed-video-playbtn'); if(b) b.style.opacity='1';" onerror="this.onerror=null;this.closest('.feed-video-wrap').replaceWith(Object.assign(document.createElement('div'),{className:'w-full py-10 flex items-center justify-center bg-gray-100 text-gray-400 text-xs italic',textContent:'${err}'}))"></video>
              <div class="feed-video-playbtn absolute inset-0 flex items-center justify-center" style="pointer-events:none;">
                <div class="flex items-center justify-center rounded-full" style="width:3.5rem;height:3.5rem;background:rgba(0,0,0,0.45);">${Icon('play','w-6 h-6 text-white')}</div>
              </div>
              <button type="button" onclick="event.stopPropagation(); toggleFeedVideoMute('${uid}')" class="feed-video-mutebtn absolute flex items-center justify-center rounded-full" style="bottom:10px;right:10px;width:2rem;height:2rem;background:rgba(0,0,0,0.45);">${Icon('volumeOff','w-4 h-4 text-white')}</button>
            </div>`;
        }

        // Toggles play/pause on a feed video wrapper built by
        // simplePostVideoHtml above, and shows/hides the centered play
        // icon to match -- the only controls these videos get, by design
        // (no native scrub bar, no download/speed/PiP overflow menu).
        function toggleFeedVideoPlay(wrapId){
          const wrap = document.getElementById(wrapId);
          if (!wrap) return;
          const video = wrap.querySelector('video');
          const btn = wrap.querySelector('.feed-video-playbtn');
          if (!video) return;
          if (video.paused) {
            video.play().catch(() => {});
            delete video.dataset.userPaused;
            if (btn) btn.style.opacity = '0';
          } else {
            video.pause();
            // Remembers this was a deliberate pause so the scroll-
            // triggered autoplay observer (setupFeedVideoAutoplay) below
            // doesn't immediately resume it again while it's still in
            // view -- scrolling away and back clears this, same as
            // landing on it the first time.
            video.dataset.userPaused = '1';
            if (btn) btn.style.opacity = '1';
          }
        }

        // ---------------- Scroll-triggered feed video autoplay ----------------
        // A post's video starts playing on its own once enough of it is
        // visible on screen, and pauses again the moment it scrolls back
        // out -- same behavior as Instagram/TikTok feed video -- rather
        // than requiring an explicit tap every time. Muted by default
        // (browsers block autoplay-with-sound that isn't triggered by a
        // direct tap), same as simplePostVideoHtml's default state; the
        // corner mute button still works exactly the same either way.
        // Re-armed after every feed/post-list render (renderFeed,
        // patchFeedInPlace, postFeedHTML) since each of those can add,
        // remove, or move video elements the previous observer wasn't
        // watching.
        let feedVideoObserver = null;
        function setupFeedVideoAutoplay(container){
          if (feedVideoObserver) { feedVideoObserver.disconnect(); feedVideoObserver = null; }
          if (!container || typeof IntersectionObserver === 'undefined') return;
          const videos = container.querySelectorAll('.feed-video-wrap video');
          if (!videos.length) return;
          feedVideoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              const video = entry.target;
              const wrap = video.closest('.feed-video-wrap');
              const btn = wrap && wrap.querySelector('.feed-video-playbtn');
              if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                if (video.paused && video.dataset.userPaused !== '1') {
                  video.play().catch(() => {});
                  if (btn) btn.style.opacity = '0';
                }
              } else {
                if (!video.paused) {
                  video.pause();
                  if (btn) btn.style.opacity = '1';
                }
                // Leaving view clears any manual pause -- scrolling back
                // to it later autoplays fresh, the same as landing on it
                // the first time.
                delete video.dataset.userPaused;
              }
            });
          }, { threshold: [0, 0.6] });
          videos.forEach(v => feedVideoObserver.observe(v));
        }

        // Mutes/unmutes a feed video without also toggling play/pause
        // (the click handler on the corner button stops propagation so
        // the tap doesn't fall through to toggleFeedVideoPlay), and swaps
        // the little corner icon between speaker/speaker-off to match.
        // The button lives inside the video wrap for the plain in-feed
        // player (simplePostVideoHtml) but as a sibling of it in the
        // full-screen reel view (reelPostDetailHTML, given an explicit
        // id="mutebtn-<wrapId>" there) -- checking both is what actually
        // finds it in the reel view; wrap.querySelector alone never did,
        // which is why the icon never visually flipped when muting there
        // even though the mute itself worked.
        function toggleFeedVideoMute(wrapId){
          const wrap = document.getElementById(wrapId);
          if (!wrap) return;
          const video = wrap.querySelector('video');
          const btn = wrap.querySelector('.feed-video-mutebtn') || document.getElementById('mutebtn-' + wrapId);
          if (!video) return;
          video.muted = !video.muted;
          if (btn) btn.innerHTML = Icon(video.muted ? 'volumeOff' : 'volume', 'w-4 h-4 text-white');
        }

        // Builds a post's mediaHtml from already-uploaded {url, type} items
        // pointing at public Storage URLs: a single item renders as a
        // plain img/video (unchanged from before multi-media support), two
        // or more render as a horizontally swipeable, scroll-snapped
        // carousel with dot indicators so people can flick left/right
        // through the rest of the post's photos/videos. Each item keeps
        // its own onerror fallback so one broken file doesn't take out the
        // whole post.
        function postMediaHtmlFromUploaded(items){
          const itemHtml = (it) => it.type === 'video'
            ? simplePostVideoHtml(it.url)
            : `<img src="${it.url}" class="w-full h-auto" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'w-full py-10 flex items-center justify-center bg-gray-100 text-gray-400 text-xs italic',textContent:'Image no longer available'}))">`;
          if (items.length === 1) return itemHtml(items[0]);
          const uid = 'pmc' + Math.random().toString(36).slice(2, 9);
          return `
            <div class="relative post-media-carousel" id="${uid}">
              <div class="flex overflow-x-auto no-scrollbar w-full" style="scroll-snap-type:x mandatory;" onscroll="updatePostCarouselDots('${uid}', this)">
                ${items.map(it => `<div class="flex-shrink-0 w-full" style="scroll-snap-align:center;">${itemHtml(it)}</div>`).join('')}
              </div>
              <div class="absolute left-1/2 flex items-center gap-1.5" style="bottom:8px;transform:translateX(-50%);">
                ${items.map((it, i) => `<span data-dot="${i}" class="rounded-full" style="width:5px;height:5px;background:${i===0?'#ffffff':'rgba(255,255,255,0.5)'};box-shadow:0 0 2px rgba(0,0,0,0.4);"></span>`).join('')}
              </div>
            </div>`;
        }

        // Best-effort remote insert so a new post actually reaches other
        // accounts instead of only living in this browser's own state
        // blob. If there's no backend configured, or the insert fails
        // (RLS, offline, table not set up yet), this just returns false --
        // the post still works locally for its author either way.
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

        let remotePostsLoaded = false;

        // Pulls every account's posts into the shared feed. Called once on
        // startup (see window.onload in games.js) and again whenever the
        // feed screen is opened, so a post made by someone else while you
        // were elsewhere in the app shows up next time you check Home.
        // Your own posts already exist locally with your live liked/saved/
        // reposted state, so a remote copy of one of those is skipped
        // rather than overwriting it.
        // Returns whether the fetch actually changed feedPosts (a post
        // was added or removed) -- see the comment on the switchTab(0)
        // Promise.all call in core.js for why this matters: re-rendering
        // the feed tears down and reloads every visible post video from
        // scratch (a brief black flash while it re-buffers), so callers
        // use this to skip that rebuild when nothing actually changed.
        async function loadRemotePosts(){
          const sb = getSupabaseClient();
          if (!sb) { remotePostsLoaded = true; return false; }
          try {
            const { data: userRes } = await sb.auth.getUser();
            const me = userRes && userRes.user;
            const { data, error } = await sb.from(POSTS_TABLE)
              .select('id, data, created_by, created_at')
              .order('created_at', { ascending: false });
            remotePostsLoaded = true;
            if (error || !data) return false;
            // Drop any post already loaded here (this account's cached
            // feedPosts, restored as-is from saved state) that no longer
            // exists in POSTS_TABLE -- e.g. the author deleted it from
            // another device, or an admin removed it -- while this account
            // was elsewhere and missed the realtime DELETE event. Posts
            // this account is itself mid-delete-on stay gone via
            // deletedPostIds even if a stale row briefly reappears here.
            const remoteIds = new Set(data.map(row => String(row.id)));
            const lengthBeforeFilter = feedPosts.length;
            feedPosts = feedPosts.filter(p => {
              if (deletedPostIds.has(String(p.id))) return false;
              if (p.mine || !p.authorId) return true; // not remote-backed (yet); leave alone
              return remoteIds.has(String(p.id));
            });
            const postsWereRemoved = feedPosts.length !== lengthBeforeFilter;
            const knownIds = new Set(feedPosts.map(p => String(p.id)));
            const newRows = data.filter(row => !knownIds.has(row.id) && !deletedPostIds.has(String(row.id)));
            // Look up each author's current profile photo so avatars in the
            // feed stay in sync with whatever they've set on their profile,
            // instead of freezing whatever (if anything) was baked into the
            // post at the moment it was created. This has to cover EVERY
            // other-account author already in feedPosts too, not just
            // authors of brand-new rows -- otherwise a post that got cached
            // locally before its author ever set a profile photo (or before
            // they changed it) would keep showing the stale/missing avatar
            // forever, since it never appears in newRows again. The
            // person's own Profile page doesn't have this problem because
            // it queries live every time it's opened; the feed only did
            // that for posts it hadn't seen before.
            const existingAuthorIds = feedPosts.filter(p => !p.mine && p.authorId).map(p => p.authorId);
            const authorIds = [...new Set([
              ...newRows.filter(row => !(me && row.created_by === me.id)).map(row => row.created_by),
              ...existingAuthorIds,
            ].filter(Boolean))];
            let photoById = {};
            if (authorIds.length) {
              const { data: profiles } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, photo').in('user_id', authorIds);
              (profiles || []).forEach(p => { photoById[p.user_id] = p.photo; });
            }
            // Refresh the cached avatar on every already-known post from
            // another account so a photo change reaches posts that were
            // loaded before it happened.
            feedPosts.forEach(p => {
              if (!p.mine && p.authorId && authorIds.includes(p.authorId)) {
                p.photo = photoById[p.authorId] || null;
              }
            });
            newRows.forEach(row => {
              const id = row.id;
              const isMine = !!(me && row.created_by === me.id);
              feedPosts.push({ ...row.data, id: row.data.id ?? id, mine: isMine, authorId: row.created_by, connected: isMine ? true : !!row.data.connected, photo: isMine ? row.data.photo : (photoById[row.created_by] || null) });
              knownIds.add(id);
            });
            feedPosts.sort((a, b) => Number(b.id) - Number(a.id));
            // The feed favors what you're actually likely to engage
            // with -- see rankFeedPosts below -- rather than a fixed
            // chronological or fully random order. Nothing else depends
            // on feedPosts' array order (profile post counts, lookups,
            // etc. all use .filter/.find), so reordering here is safe.
            rankFeedPosts();
            return newRows.length > 0 || postsWereRemoved;
          } catch (e) { remotePostsLoaded = true; return false; }
        }

        // ---------------- FEED RANKING (Suggested for you) ----------------
        // Builds a simple per-author affinity score from this account's
        // own past activity on the posts currently loaded -- likes,
        // saves, reposts, and comments you've left -- so authors you
        // actually engage with surface more often. This is the same
        // signal the "Suggested for you" label already uses for
        // strangers (see isStranger in feedPost); ranking just makes
        // the order reflect it too, not only the label.
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

        // Reorders feedPosts in place to favor: posts from people
        // you're connected to, posts from authors you've previously
        // liked/commented/saved/reposted, and posts already getting
        // engagement from others -- with recency and a small random
        // jitter mixed in so the feed still feels fresh on every
        // reload instead of static or robotic. Your own posts always
        // sort to the top since there's nothing to "suggest" about
        // them. Called after loadRemotePosts (using whatever
        // engagement data is already cached) and again after
        // loadPostInteractions resolves, once real like/comment/view
        // counts for this batch are in.
        function rankFeedPosts(){
          if (!feedPosts.length) return;
          const affinity = buildAuthorAffinity();
          const now = Date.now();
          const scored = feedPosts.map(post => {
            let score = 0;
            const ageHours = Math.max(0, (now - Number(post.id || now)) / 3600000);
            score += Math.max(0, 24 - ageHours) * 0.5; // mild recency boost, not dominant
            score += (post.likes || 0) * 0.8 + (post.comments || 0) * 1.2 + (post.reposts || 0) * 1.5 + (post.views || 0) * 0.1;
            if (post.authorId && affinity[post.authorId]) score += affinity[post.authorId] * 2;
            if (!post.mine && post.authorId && typeof isUserInMyNetwork === 'function' && isUserInMyNetwork(post.authorId)) score += 6;
            if (post.mine) score += 100;
            score += Math.random() * 4; // keeps ordering from feeling identical every load
            return { post, score };
          });
          scored.sort((a, b) => b.score - a.score);
          feedPosts.length = 0;
          scored.forEach(s => feedPosts.push(s.post));
        }

        // Fisher-Yates shuffle. The feed itself now uses rankFeedPosts
        // above instead of a flat shuffle, but this stays available for
        // anything else in this file that wants a plain randomization
        // (other files -- study.js, quizzesAndGames.js -- each keep
        // their own copy rather than relying on cross-file load order).
        function shuffleArray(arr){
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        // ---- Post interactions backend (Supabase) ----
        // Likes, reposts, saves, and comments each get their own table so
        // they're visible to every account, not just written into this
        // browser's local copy of the post. Likes/reposts/comments are
        // fully public (anyone signed in can see who liked what); saves
        // are private -- the RLS policy below only lets a row's own owner
        // read it back, so "saved" state follows your account across
        // devices without exposing what you've saved to anyone else.
        //
        // Requires, in the configured Supabase project:
        //   create table post_likes (
        //     post_id text not null,
        //     user_id uuid not null references auth.users(id) on delete cascade,
        //     created_at timestamptz not null default now(),
        //     primary key (post_id, user_id)
        //   );
        //   alter table post_likes enable row level security;
        //   create policy "Anyone signed in can read likes" on post_likes
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Users manage their own like" on post_likes
        //     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
        //
        //   create table post_reposts (
        //     post_id text not null,
        //     user_id uuid not null references auth.users(id) on delete cascade,
        //     created_at timestamptz not null default now(),
        //     primary key (post_id, user_id)
        //   );
        //   alter table post_reposts enable row level security;
        //   create policy "Anyone signed in can read reposts" on post_reposts
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Users manage their own repost" on post_reposts
        //     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
        //
        //   create table post_saves (
        //     post_id text not null,
        //     user_id uuid not null references auth.users(id) on delete cascade,
        //     created_at timestamptz not null default now(),
        //     primary key (post_id, user_id)
        //   );
        //   alter table post_saves enable row level security;
        //   create policy "Users manage their own saves" on post_saves
        //     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
        //
        //   create table post_comments (
        //     id bigint generated always as identity primary key,
        //     post_id text not null,
        //     user_id uuid references auth.users(id) on delete set null,
        //     author_name text not null,
        //     text text not null,
        //     created_at timestamptz not null default now()
        //   );
        //   alter table post_comments enable row level security;
        //   create policy "Anyone signed in can read comments" on post_comments
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Users can insert their own comments" on post_comments
        //     for insert with check (auth.uid() = user_id);
        //
        // Until these tables exist, likes/reposts/saves/comments keep
        // working locally for whoever taps them (same mock-state fallback
        // as before) -- they just won't be visible to other accounts.
        //   create table post_views (
        //     post_id text not null,
        //     user_id uuid not null references auth.users(id) on delete cascade,
        //     created_at timestamptz not null default now(),
        //     primary key (post_id, user_id)
        //   );
        //   alter table post_views enable row level security;
        //   create policy "Anyone signed in can read view counts" on post_views
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Users record their own view" on post_views
        //     for insert with check (auth.uid() = user_id);
        //
        // One row per (post, viewer) -- like likes/reposts/saves, opening
        // the same post five times only ever counts as one view, matching
        // how "views" reads everywhere else (LinkedIn, Instagram insights).
        // Registered when the post's full detail view is opened (see
        // openPostDetail below), not just on scrolling past it in the
        // feed -- deliberate open is a much stronger, cheaper-to-implement
        // signal than a real impression tracker, and it's the same
        // approach this app already uses for glimpse view counts.
        const POST_LIKES_TABLE = 'post_likes';
        const POST_REPOSTS_TABLE = 'post_reposts';
        const POST_SAVES_TABLE = 'post_saves';
        const POST_COMMENTS_TABLE = 'post_comments';
        const POST_VIEWS_TABLE = 'post_views';
        // Unlike likes/reposts/saves (one row per post+user, toggled on/off),
        // a share is a one-off event you can repeat -- sharing the same post
        // to three different contacts, or sharing it once and later hitting
        // "Copy link" too, is three/two real shares, not one. So this table
        // has no unique constraint on (post_id, user_id) and is insert-only,
        // same shape as post_comments/post_views. The count shown next to
        // the share icon is just how many rows exist for that post_id.
        //   create table post_shares (
        //     id bigint generated always as identity primary key,
        //     post_id text not null,
        //     user_id uuid not null references auth.users(id),
        //     created_at timestamptz not null default now()
        //   );
        //   alter table post_shares enable row level security;
        //   create policy "Anyone signed in can read shares" on post_shares
        //     for select using (auth.role() = 'authenticated');
        //   create policy "Users record their own shares" on post_shares
        //     for insert with check (auth.uid() = user_id);
        //   alter publication supabase_realtime add table post_shares;
        const POST_SHARES_TABLE = 'post_shares';
        // Both posts and post_comments need to be added to Supabase's
        // realtime publication for the postgres_changes subscriptions above
        // (INSERT/DELETE on posts, INSERT on post_comments) to actually
        // fire -- same requirement as `classes`/`messages` elsewhere in
        // this app. Run once per project:
        //   alter publication supabase_realtime add table posts;
        //   alter publication supabase_realtime add table post_comments;

        async function getCurrentUserId(){
          const user = await getCachedAuthUser();
          return (user && user.id) || null;
        }

        // Best-effort writes -- mirror postInsertRemote/postDeleteRemote
        // above: local optimistic state already updated by PostsAPI by the
        // time these run, so a failure here (offline, tables not set up
        // yet, RLS) just means the like/repost/save/comment stays local to
        // this browser instead of breaking the tap.
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

        // ---- Live "someone posted" / "someone commented" notifications ----
        // Wires the Notifications bell tab (addNotif, in overlays.js) up
        // to real activity from other accounts, same pattern as the
        // connection-request/message notifications in chat.js. There's no
        // per-recipient targeting here the way a call ring has (this app
        // has no server-side authorization on Realtime channels either
        // way -- see broadcastToUserChannel's comment in chat.js), so
        // every signed-in client hears every insert and just decides
        // locally whether it's relevant: a new post only notifies people
        // already in that author's network, a new comment only notifies
        // the post's own author, and a new opportunity notifies everyone
        // (it's not connection-gated, same as the Opportunities tab
        // itself).
        let feedActivityChannel = null;
        let feedActivitySubscribedForUserId = null;
        async function subscribeToFeedActivity(){
          const sb = getSupabaseClient();
          if (!sb) return;
          const myId = await getCurrentUserId();
          if (!myId) return;
          if (feedActivityChannel && feedActivitySubscribedForUserId === myId) return;
          if (feedActivityChannel) { try { sb.removeChannel(feedActivityChannel); } catch (e) { /* ignore */ } feedActivityChannel = null; }
          feedActivitySubscribedForUserId = myId;
          feedActivityChannel = sb.channel('feed-activity:' + myId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POSTS_TABLE }, (payload) => handleRemotePostInsert(payload, myId))
            // DELETE was previously missing here entirely: deletePost()
            // correctly removed the row from Supabase (postDeleteRemote),
            // so the post really was gone, but every other account that
            // already had a local copy of it (from an earlier
            // handleRemotePostInsert or loadRemotePosts) never heard about
            // the deletion and kept showing it -- "delete for everyone"
            // wasn't actually live. This is what makes it live.
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: POSTS_TABLE }, (payload) => handleRemotePostDelete(payload))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_COMMENTS_TABLE }, (payload) => handleRemoteCommentInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_LIKES_TABLE }, (payload) => handleRemoteLikeInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_REPOSTS_TABLE }, (payload) => handleRemoteRepostInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: POST_SHARES_TABLE }, (payload) => handleRemoteShareInsert(payload, myId))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: OPPORTUNITIES_TABLE }, (payload) => handleRemoteOpportunityInsert(payload, myId))
            .subscribe();
          // REQUIRED for post deletions to actually be live, same as the
          // `classes` table note in courses.js -- postgres_changes only
          // fires for tables added to Supabase's realtime publication.
          // Run this once per project (harmless if already added):
          //   alter publication supabase_realtime add table posts;
          //   alter publication supabase_realtime add table post_likes;
          //   alter publication supabase_realtime add table post_reposts;
          //   alter publication supabase_realtime add table post_shares;
        }

        // Removes a post that was deleted on another account from this
        // account's own local feed the moment it happens, instead of it
        // lingering until the next full loadRemotePosts(). Also drops any
        // local repost of that same post, same as removing the original
        // manually would.
        function handleRemotePostDelete(payload){
          const row = payload && payload.old;
          if (!row || row.id === undefined) return;
          const id = row.id;
          if (typeof feedPosts === 'undefined') return;
          const before = feedPosts.length;
          feedPosts = feedPosts.filter(p => String(p.id) !== String(id) && String(p.repostOf) !== String(id));
          if (feedPosts.length === before) return; // wasn't in this account's local feed anyway
          if (typeof queueSaveUserState === 'function') queueSaveUserState();
          // Targeted DOM removal instead of a full renderFeed()/
          // renderProfile() rebuild -- same reasoning as patchFeedInPlace
          // above: a post disappearing (deleted on another device, by an
          // admin, etc.) shouldn't flash every *other* post's video on
          // screen just because one card needs to go away.
          if (typeof currentTab !== 'undefined' && currentTab === 0) {
            const el = document.getElementById('post-' + id);
            if (el) el.remove(); else if (typeof renderFeed === 'function') renderFeed();
          }
          if (typeof currentTab !== 'undefined' && currentTab === 4 && typeof profileTab !== 'undefined') {
            const content = document.getElementById('profile-tab-content');
            if (content && typeof profileTabContent === 'function') content.innerHTML = profileTabContent();
          }
        }

        function handleRemotePostInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.data || row.created_by === myId) return;
          const name = row.data.name || 'Someone in your network';
          // Tag notice: fires whenever this account is one of the post's
          // taggedUsers, regardless of network status -- being tagged by
          // someone you're not yet connected to should still reach you,
          // same as any other app's mention notification.
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
          // Also drop it straight into the feed itself if it's currently
          // open, same as the rest of the app's "live" realtime updates.
          if (typeof currentTab !== 'undefined' && currentTab === 0 && typeof feedPosts !== 'undefined' && !feedPosts.some(p => String(p.id) === String(row.data.id))) {
            feedPosts.unshift(Object.assign({}, row.data, { mine: false, authorId: row.created_by }));
            const feedList = document.getElementById('feed-list');
            // patchFeedInPlace (not a full renderFeed()) so every other
            // post already on screen keeps its DOM node -- and any
            // already-loaded/playing <video> inside it -- instead of the
            // whole feed flashing to black and reloading every video
            // just because one new post from someone else came in.
            if (feedList && typeof patchFeedInPlace === 'function') patchFeedInPlace();
          }
        }

        function handleRemoteCommentInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.post_id || row.user_id === myId) return;
          const post = typeof findPost === 'function' ? findPost(isNaN(Number(row.post_id)) ? row.post_id : Number(row.post_id)) : null;
          if (!post || !post.mine) return; // only the post's own author gets notified
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

        // Looks up a display name for a user_id from public_profiles --
        // shared by the like/repost handlers below, neither of which
        // carries a name on the row itself the way post_comments does
        // (author_name is written at insert time there; likes/reposts
        // are just a bare {post_id, user_id} join row).
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
          if (!post || !post.mine) return; // only the post's own author gets notified
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
          if (!post || !post.mine) return; // only the post's own author gets notified
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

        // Fires for every account the instant anyone shares a post -- two
        // separate jobs, same as the like/repost handlers above:
        //  1. Bump the local shares count (and, if the feed/post-detail/
        //     profile post grid is currently showing it, the on-screen
        //     number) so the share count is genuinely live for everyone
        //     looking at that post, not just whoever tapped share.
        //  2. Notify the post's own author, same "X shared your post"
        //     treatment likes/reposts already get.
        // Skips the sharer's own client for both -- their optimistic
        // update already ran locally the moment they tapped (see
        // PostsAPI.share), so re-applying it here would double-count it.
        async function handleRemoteShareInsert(payload, myId){
          const row = payload && payload.new;
          if (!row || !row.post_id || row.user_id === myId) return;
          const post = typeof findPost === 'function' ? findPost(isNaN(Number(row.post_id)) ? row.post_id : Number(row.post_id)) : null;
          if (!post) return;
          post.shares = (post.shares || 0) + 1;
          if (typeof bumpShareCountDisplay === 'function') bumpShareCountDisplay(post.id);
          if (!post.mine) return; // only the post's own author gets notified
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

        // Best-effort: records one share event for this post -- called
        // once per actual share action (sent to a contact, "Copy link",
        // "Add to Glimpse", "More apps"), same insert-only shape as
        // postCommentRemote. Local optimistic count already moved by the
        // time this runs (see PostsAPI.share below), so a failure here
        // just means this particular share stays local to this browser.
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

        // Best-effort: records that the current account viewed this post.
        // Skips your own posts (viewing your own post shouldn't inflate
        // its own view count, same convention as LinkedIn/Instagram) and
        // skips posts already viewed this session so re-opening the same
        // post repeatedly during one visit doesn't hammer the DB with
        // upserts it already knows the answer to.
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

        // Pulls the real like/repost/save/comment state for every post
        // currently in the feed and overwrites the local counts with it --
        // called right after loadRemotePosts() so both the post list and
        // its interaction counts are in sync. Best-effort: if it fails or
        // there's no backend configured, posts just keep whatever local
        // mock state they already had (same fallback as everywhere else).
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

            // Look up each commenter's current profile photo, the same
            // way loadRemotePosts does for post authors, so a comment's
            // avatar reflects whoever actually left it -- not just your
            // own -- and stays in sync if they change their photo later
            // instead of freezing whatever was true at comment time.
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
            // Real engagement numbers for this batch just came in --
            // re-rank now so the order reflects them, not just whatever
            // was cached from the last time this ran.
            rankFeedPosts();
          } catch (e) { /* best effort -- local mock state stays as-is */ }
        }

        const PostsAPI = {
          list(){
            return mockRequest(() => feedPosts);
          },
          get(id){
            return mockRequest(() => feedPosts.find(p => p.id === id) || null);
          },
          create(data){
            // mediaFiles/mediaTypes (arrays, one entry per picked photo/
            // video) are the current path from the composer -- mediaFile/
            // mediaType (singular) are still accepted so anything else in
            // the app that calls PostsAPI.create with a single file keeps
            // working unchanged.
            const { mediaFile, mediaType, mediaFiles, mediaTypes, ...rest } = data;
            const files = mediaFiles && mediaFiles.length ? mediaFiles : (mediaFile ? [mediaFile] : []);
            const types = mediaTypes && mediaTypes.length ? mediaTypes : (mediaType ? [mediaType] : []);
            return (async () => {
              const post = {
                id: Date.now(),
                avatarIcon: 'user', avatarBg: 'bg-blue-100', name: profileData.name, meta: 'now',
                connected: true, verified: false, mine: true,
                body: '', mediaHtml: null,
                likes: 0, liked: false, reposts: 0, reposted: false, shares: 0, comments: 0, commentsList: [], saved: false, views: 0,
                ...rest,
              };
              // Locally-picked images/videos only exist as blob:/data:
              // URLs in this browser -- upload the real files to shared
              // Storage first and point mediaHtml at their public URLs
              // instead, or the post would show as broken to everyone
              // else. Uploads run in parallel; mediaPaths (plural) is kept
              // for deletion later even for a single-item post, so
              // PostsAPI.remove only has to handle one shape.
              if (files.length) {
                const uploads = await Promise.all(files.map((f, i) => uploadPostMediaToStorage(f, post.id + '-' + i)));
                const okItems = uploads
                  .map((u, i) => u ? { url: u.url, type: types[i] || 'image', path: u.path } : null)
                  .filter(Boolean);
                if (okItems.length) {
                  post.mediaPaths = okItems.map(it => it.path);
                  post.mediaPath = post.mediaPaths[0]; // back-compat for any single-path reader
                  post.mediaHtml = postMediaHtmlFromUploaded(okItems);
                }
              }
              feedPosts.unshift(post);
              queueSaveUserState();
              postInsertRemote(post); // best-effort; local post already works either way
              return post;
            })();
          },
          remove(id){
            return mockRequest(() => {
              const removed = feedPosts.find(p => p.id === id);
              feedPosts = feedPosts.filter(p => p.id !== id);
              deletedPostIds.add(String(id));
              queueSaveUserState();
              // Only delete the underlying Storage file when this is one
              // of MY posts. PostsAPI.remove() is also used by
              // notInterestedPost() to quietly hide someone else's post
              // from just my feed -- that must never delete their file.
              if (removed && removed.mine && removed.mediaPaths && removed.mediaPaths.length) deletePostMediaListFromStorage(removed.mediaPaths);
              else if (removed && removed.mine && removed.mediaPath) deletePostMediaFromStorage(removed.mediaPath);
              postDeleteRemote(id).then(ok => {
                if (ok) {
                  // Confirmed gone remotely -- the tombstone has done its
                  // job, so drop it rather than let the set grow forever.
                  deletedPostIds.delete(String(id));
                  queueSaveUserState();
                }
                // On failure the tombstone stays, so the next loadRemotePosts
                // still won't resurrect the not-actually-deleted-yet post.
              });
              return { id };
            });
          },
          // Used when blocking an account: clears every post from that
          // author out of the feed in one go.
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
              postLikeRemote(id, post.liked); // best-effort, syncs for other accounts
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
              postRepostRemote(id, post.reposted); // best-effort, syncs for other accounts

              if (post.reposted) {
                // Publish the repost as an actual post on your own profile/
                // feed -- same as Instagram/LinkedIn's "Repost": everyone
                // who follows you now sees it in their feed too, not just a
                // counter ticking up on the original.
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
                post.myRepostId = repostPost.id; // remembered so un-reposting removes the right post
                queueSaveUserState();
                postInsertRemote(repostPost); // best-effort, syncs the repost for other accounts
              } else if (post.myRepostId) {
                // Un-repost: pull the post we published for it back out.
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
              postSaveRemote(id, post.saved); // best-effort, keeps saves synced across your own devices
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
              postCommentRemote(id, text); // best-effort, syncs for other accounts
              return post;
            });
          },
          // Records one share event -- called once per actual share action
          // (sent to a contact, "Copy link", "Add to Glimpse", "More
          // apps"), same insert-only pattern as addComment above rather
          // than toggleLike/toggleRepost's on/off pattern, since a share
          // isn't something you can "un-share". Persisted to post_shares
          // so the count is real and live for every account, not just a
          // number that resets when this browser's local state is gone.
          share(id){
            return mockRequest(() => {
              const post = feedPosts.find(p => p.id === id);
              if (!post) return null;
              post.shares = (post.shares || 0) + 1;
              queueSaveUserState();
              postShareRemote(id); // best-effort, syncs for other accounts
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
            // createdAt anchors the 24h expiry independently of `id`, so
            // expiry logic keeps working even if id generation ever
            // changes to something other than Date.now().
            const glimpse = { id: Date.now(), createdAt: Date.now(), timeLabel, type: 'text', viewers: [], ...rest };
            // Goes into myGlimpses (with its local blob:/data: URL) and
            // resolves right away instead of waiting on the Storage
            // upload first -- that upload, especially for a video, is
            // what used to make a freshly-posted glimpse take a long
            // time to actually show up after tapping send. The upload
            // still happens, just in the background below, and swaps
            // mediaUrl/mediaPath over to the real hosted URL once it
            // resolves so other accounts can load it too; only then does
            // the glimpse itself get written to the shared table (a
            // remote row pointing at a blob: URL would be useless to
            // everyone else anyway).
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
                glimpseInsertRemote(glimpse); // best-effort; glimpse already works locally either way
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

        // Backstop for the 24h expiry: catches a glimpse aging out while the
        // "My glimpse" list happens to be sitting open (openMyGlimpses/
        // refreshMyGlimpses only purge at the moment they're called).
        setInterval(() => {
          if (purgeExpiredGlimpses()) refreshMyGlimpses();
        }, 60 * 1000);

        // ---------------- SAVED & BLOCKED ----------------
        let blockedAccounts = [];

        // Same backend-ready pattern as PostsAPI/GlimpsesAPI above: a real
        // backend later just means swapping the body of these two methods
        // for a fetch() call, nothing else changes.
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

        function blockAccount(name, icon, avatarBg, photo){
          if (!name) return;
          NetworkAPI.block(name, icon, avatarBg, photo);
          // Blocking someone also clears their posts from the feed.
          PostsAPI.removeByAuthor(name);
        }

        function unblockAccount(name){
          NetworkAPI.unblock(name).then(() => renderBlockedAccountsOverlay());
        }

        function toggleSavePost(id){
          PostsAPI.toggleSave(id).then(post => {
            if (!post) return;
            // Updates whichever save/bookmark button is actually visible
            // in place (see forEachById above) instead of a full
            // renderFeed() -- that rebuild only ever touches #screen, so
            // it never reached the button on an open detail/reel view,
            // which is what made the icon look like it only "reacted"
            // once the view was closed and the freshly-rendered card
            // underneath came into view.
            forEachById('save-btn-'+id, btn => {
              const isReelDetail = btn.closest('#video-post-' + id) != null;
              btn.className = isReelDetail
                ? `flex flex-col items-center ${post.saved ? `text-[${ROYAL}]` : 'text-white'}`
                : `p-1 ml-auto -mr-1 ${post.saved ? `text-[${ROYAL}]` : 'text-gray-800'}`;
            });
            // The Saved screen is a genuinely different list of posts
            // (unsaving one removes it from that list entirely, not just
            // a style change), so it still needs a real re-render.
            if (typeof renderSavedItemsOverlay === 'function') renderSavedItemsOverlay();
          });
        }

        let openPostMenuId = null;

        function togglePostMenu(id){
          openPostMenuId = (openPostMenuId === id) ? null : id;
          renderFeed();
          const screenEl = document.getElementById('screen');
          attachMenuScrollCloser(screenEl, openPostMenuId === id, () => closePostMenuOnScroll(id));
        }

        // Closing the post menu because the user scrolled the feed (rather
        // than tapped) shouldn't trigger a full renderFeed() -- rebuilding
        // the whole post list mid-scroll caused a visible jump/glitch on
        // the homepage. Just drop the backdrop + dropdown nodes for this
        // one post instead; the state flag is still cleared so the next
        // full render (e.g. opening another post's menu) reflects it.
        function closePostMenuOnScroll(id){
          if (openPostMenuId !== id) return;
          openPostMenuId = null;
          const backdrop = document.getElementById('post-menu-backdrop-' + id);
          const dropdown = document.getElementById('post-menu-dropdown-' + id);
          if (backdrop) backdrop.remove();
          if (dropdown) dropdown.remove();
        }

        function deletePost(id){
          PostsAPI.remove(id).then(() => {
            openPostMenuId = null;
            // The "Posts" stat on the profile is computed live from
            // feedPosts (see myPostsCount above), so removing the post
            // from feedPosts above is all that's needed to keep it accurate
            // -- no separate counter to update here.
            renderFeed();
            if (typeof currentTab !== 'undefined' && currentTab === 4 && typeof renderProfile === 'function') renderProfile();
          });
        }

        // "Not interested" just quietly drops this one post out of the
        // feed -- unlike blocking, it doesn't touch the author's account
        // or their other posts.
        function notInterestedPost(id){
          openPostMenuId = null;
          PostsAPI.remove(id).then(() => renderFeed());
        }

        // Reports are real, persistent state (not just an alert): once a
        // post is reported, its id is stored so the menu item flips to
        // "Reported" and won't fire again for that post.
        let reportedPosts = new Set();

        function isPostReported(id){
          return reportedPosts.has(id);
        }

        function reportPost(id){
          if (isPostReported(id)) return;
          reportedPosts.add(id);
          queueSaveUserState();
          openPostMenuId = null;
          renderFeed();
          openAppAlertModal('Thanks for letting us know. This post has been reported and our team will review it.');
        }

        async function connectWithPoster(id){
          const post = findPost(id);
          if (!post || !post.authorId || post.connectRequestSent) return;
          post.connectRequestSent = true; // optimistic -- flip back if the insert fails
          renderFeed();
          const ok = await sendConnectionRequestTo(post.authorId);
          if (!ok) { post.connectRequestSent = false; renderFeed(); }
        }

        // "Cancel Request" tapped on a post's pill -- cancels by author,
        // so it also clears connectRequestSent on every other post from
        // the same person still showing that pill in this feed.
        async function cancelConnectWithPoster(id){
          const post = findPost(id);
          if (!post || !post.authorId || !post.connectRequestSent) return;
          const authorId = post.authorId;
          feedPosts.forEach(p => { if (p.authorId === authorId) p.connectRequestSent = false; }); // optimistic
          renderFeed();
          const ok = await cancelMyConnectionRequestTo(authorId);
          if (!ok) {
            feedPosts.forEach(p => { if (p.authorId === authorId) p.connectRequestSent = true; });
            renderFeed();
            return;
          }
          if (typeof clearRequestSentLocally === 'function') clearRequestSentLocally(authorId);
        }

        // Tapping a post's avatar opens the same read-only profile card
        // (see openPersonProfile in overlays.js) used everywhere else --
        // lets you see who they are and decide whether to connect,
        // without leaving the feed. Own posts route to your own profile
        // tab instead (handled inside openPersonProfile).
        function openPersonProfileForPost(id){
          const post = findPost(id);
          if (!post || !post.authorId) return;
          openPersonProfile(post.authorId, {
            name: post.name, icon: post.avatarIcon, avatarBg: post.avatarBg,
            photo: post.mine ? profileData.photo : null,
          });
        }

        // Small blue "verified" checkmark badge, Instagram-style
        function verifiedBadge(){
          return `<svg viewBox="0 0 24 24" class="w-3.5 h-3.5 flex-shrink-0" fill="${ROYAL}"><path fill-rule="evenodd" d="M12 2.25c-.71 0-1.35.36-1.76.93a2.08 2.08 0 00-2.53.7 2.08 2.08 0 00-.98 2.33 2.08 2.08 0 00-1.65 1.95 2.08 2.08 0 00-.7 2.53 2.08 2.08 0 00.93 2.31c-.02.15-.03.3-.03.45 0 1.02.7 1.87 1.65 2.1.06.99.75 1.83 1.72 2.05.16.9.85 1.62 1.76 1.8.28.85 1.08 1.47 2.03 1.47s1.75-.62 2.03-1.47c.91-.18 1.6-.9 1.76-1.8.97-.22 1.66-1.06 1.72-2.05.95-.23 1.65-1.08 1.65-2.1 0-.15-.01-.3-.03-.45.55-.42.93-1.08.93-1.83s-.38-1.41-.93-1.83c.03-.15.03-.3.03-.45a2.08 2.08 0 00-1.65-1.95 2.08 2.08 0 00-.98-2.33 2.08 2.08 0 00-2.53-.7A2.08 2.08 0 0012 2.25zm3.7 8.1l-4.2 4.2a.75.75 0 01-1.06 0l-2.1-2.1a.75.75 0 111.06-1.06l1.57 1.57 3.67-3.67a.75.75 0 111.06 1.06z" clip-rule="evenodd"/></svg>`;
        }

        // Relative post timestamp ("Now", "5m", "3h", "a day ago", "5 days
        // ago", then a plain date past a week) computed live from the
        // post's id -- every post's id is its creation time in ms (see
        // PostsAPI.create above), so this is always accurate instead of
        // the static meta:'now' string that used to get baked in once at
        // creation and never change again no matter how old the post got.
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

        // Renders a post's caption with any tagged people's "@username"
        // mentions highlighted in blue (and tappable, opening their
        // profile) at the exact spot they were typed -- rather than just
        // listing tagged names separately. Runs against the already-
        // escaped body text, so it only ever matches literal "@handle"
        // characters (letters/digits/periods/underscores -- the only
        // characters a username can contain, see USERNAME_INVALID_RE in
        // profile.js), never anything that could re-open an HTML tag.
        function renderPostBodyHtml(post){
          const escapedBody = escapeHtml(post.body);
          const tagged = Array.isArray(post.taggedUsers) ? post.taggedUsers : [];
          if (!tagged.length) return escapedBody;
          let out = escapedBody;
          tagged.forEach(t => {
            if (!t || !t.username) return;
            const escapedUsername = t.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp('(^|\\s)@' + escapedUsername + '(?=\\s|$)', 'gi');
            out = out.replace(re, (m, pre) => `${pre}<span class="font-semibold cursor-pointer" style="color:${ROYAL}" onclick="event.stopPropagation(); openPersonProfile('${escapeForJsAttr(t.id)}')">@${escapeHtml(t.username)}</span>`);
          });
          return out;
        }

        function feedPost(post){
          // Real network status (see isUserInMyNetwork in chat.js), not the
          // static post.connected flag the original poster's own client
          // happened to save -- that never reflected whether *you*
          // specifically are connected to them. Own posts and posts with
          // no known author (e.g. local-only, not yet synced) never show
          // a Connect button.
          const isStranger = !post.mine && !!post.authorId && !isUserInMyNetwork(post.authorId);
          const showConnect = isStranger && !post.connectRequestSent;
          const showRequestSent = isStranger && post.connectRequestSent;
          return `
            <div class="bg-white overflow-hidden -mx-5 border-b border-gray-100" id="post-${post.id}">
              ${post.isRepost ? `
                <div class="px-4 pt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
                  ${Icon('repost','w-3.5 h-3.5')}
                  <span>${post.mine ? 'You' : escapeHtml(post.name)} reposted</span>
                </div>` : ''}
              <div class="px-4 py-2 flex gap-2.5 items-center relative">
                <div class="w-7 h-7 rounded-full ${post.avatarBg} overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForPost(${post.id})">${(post.mine && profileData.photo) ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : (!post.mine && post.photo) ? `<img src="${post.photo}" class="w-full h-full object-cover">` : Icon(post.avatarIcon,'w-3.5 h-3.5 text-gray-600')}</div>
                <div class="flex-1 min-w-0 cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForPost(${post.id})">
                  <div class="flex items-center gap-1">
                    <span class="font-semibold text-[13px] truncate">${escapeHtml(post.name)}</span>
                    ${post.verified ? verifiedBadge() : ''}
                  </div>
                  <div class="text-[11px] text-gray-500 truncate">${isStranger ? 'Suggested for you' : formatPostTimeAgo(post)}</div>
                </div>
                ${showConnect ? `
                  <button onclick="connectWithPoster(${post.id})" class="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0" style="background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};">Connect</button>
                ` : ''}
                ${showRequestSent ? `
                  <button onclick="cancelConnectWithPoster(${post.id})" class="text-[11px] font-semibold px-3 py-1 rounded-full flex-shrink-0 bg-gray-100 text-gray-600">Cancel Request</button>
                ` : ''}
                <button onclick="togglePostMenu(${post.id})" class="w-7 h-7 flex items-center justify-center text-gray-400 flex-shrink-0">${IconBold('dots','w-4 h-4')}</button>
                ${openPostMenuId === post.id ? `
                  <div id="post-menu-backdrop-${post.id}" onclick="togglePostMenu(${post.id})" onwheel="closePostMenuOnScroll(${post.id})" ontouchmove="closePostMenuOnScroll(${post.id})" class="fixed inset-0 z-10"></div>
                  <div id="post-menu-dropdown-${post.id}" class="absolute bg-white rounded-2xl border border-gray-100 py-2 z-20 menu-dropdown-inset" style="right:1rem;top:2.75rem;width:11rem;box-shadow:0 10px 30px rgba(0,0,0,.14);">
                    ${post.mine
                      ? `<button onclick="deletePost(${post.id})" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 menu-item-pill">${Icon('trash','w-4 h-4')} Delete post</button>`
                      : `
                        <button onclick="notInterestedPost(${post.id})" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 menu-item-pill">${Icon('close','w-4 h-4')} Not interested</button>
                        <button onclick="${isPostReported(post.id) ? '' : `reportPost(${post.id})`}" ${isPostReported(post.id) ? 'disabled' : ''} class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left menu-item-pill ${isPostReported(post.id) ? 'text-gray-400' : 'text-red-500'}">${Icon('flag','w-4 h-4')} ${isPostReported(post.id) ? 'Reported' : 'Report'}</button>
                      `}
                  </div>
                ` : ''}
              </div>

              <div class="feed-media" onclick="openPostDetail(${post.id}, event)" style="cursor:pointer;">${post.mediaHtml || ''}</div>

              <div class="flex items-center px-3 pt-1.5 text-gray-800">
                <button onclick="toggleLike(${post.id})" id="like-btn-${post.id}" class="p-1 -ml-1 flex items-center gap-1 ${post.liked ? `text-[${ROYAL}]` : ''}">
                  <span id="like-icon-${post.id}">${Icon(post.liked ? 'thumbUp' : 'thumbUpOutline','w-5 h-5')}</span>
                  <span class="text-[12px] font-semibold" id="like-inline-count-${post.id}">${formatCount(post.likes)}</span>
                </button>
                <button onclick="openComments(${post.id})" id="comment-btn-${post.id}" class="p-1 ml-2 flex items-center gap-1">
                  ${Icon('comment','w-5 h-5')}
                  <span class="text-[12px] font-semibold" id="comment-inline-count-${post.id}">${formatCount(post.comments)}</span>
                </button>
                <button onclick="toggleRepost(${post.id})" id="repost-btn-${post.id}" class="p-1 ml-2 flex items-center gap-1 ${post.reposted ? 'text-emerald-600' : ''}">
                  ${Icon('repost','w-4 h-4')}
                  <span class="text-[12px] font-semibold" id="repost-inline-count-${post.id}">${formatCount(post.reposts)}</span>
                </button>
                <button onclick="openShare(${post.id})" id="share-btn-${post.id}" class="p-1 ml-2 flex items-center gap-1">
                  ${Icon('send','w-5 h-5')}
                  <span class="text-[12px] font-semibold" id="share-inline-count-${post.id}">${formatCount(post.shares)}</span>
                </button>
                <button onclick="toggleSavePost(${post.id})" id="save-btn-${post.id}" class="p-1 ml-auto -mr-1 ${post.saved ? `text-[${ROYAL}]` : 'text-gray-800'}">${Icon('bookmark','w-5 h-5')}</button>
              </div>

              <div class="px-3.5 pt-1 text-[13px] font-semibold" id="like-count-${post.id}">${post.likes.toLocaleString()} likes</div>

              ${(post.body && post.body.trim()) || (post.isRepost && post.repostAuthorName && post.repostAuthorName !== post.name) ? `
              <div class="px-3.5 pt-1 text-[13px] leading-snug">
                ${post.mediaHtml ? `<span class="inline-flex items-center justify-center rounded align-middle mr-1" style="width:1.15rem;height:1.15rem;padding:2px;background:rgba(30,144,255,0.12);color:${NAVY};" title="${postMediaKind(post) === 'video' ? 'Video' : 'Photo'}">${Icon(postMediaKind(post) === 'video' ? 'videoClip' : 'photoFrame','w-3 h-3')}</span>` : ''}
                <span>${renderPostBodyHtml(post)}</span>
                ${post.isRepost && post.repostAuthorName && post.repostAuthorName !== post.name ? `<div class="text-[11px] text-gray-400 mt-0.5">Originally posted by ${escapeHtml(post.repostAuthorName)}</div>` : ''}
              </div>
              ` : ''}

              <button onclick="openComments(${post.id})" class="px-3.5 pt-1 block text-[12px] text-gray-400" id="comment-count-${post.id}">
                ${post.comments > 0 ? `View all ${post.comments} comments` : 'Add a comment...'}
              </button>

              <div class="px-3.5 pt-1 pb-3 text-[10px] text-gray-400" id="share-count-${post.id}">${(post.views || 0) > 0 ? `${formatCount(post.views)} views &middot; ` : ''}${formatPostTimeAgo(post)}</div>
            </div>`;
        }

        // Opens a full post detail window. A post whose one piece of
        // media is a photo or a video (i.e. not a multi-item carousel)
        // opens as a full-bleed, Reels-style player (see
        // reelPostDetailHTML) instead of the card-plus-comments-list
        // layout, since forcing a tall video/photo into that card meant
        // a lot of scrolling to see anything else; multi-photo/video
        // carousel posts keep the original card (avatar, media, actions,
        // caption) followed by its comments and a composer, since that's
        // the only place that renders their swipeable carousel. Tapping
        // the media specifically (not the like/comment/share icons,
        // which have their own handlers) triggers this.
        //
        // Whether the reel view lets you swipe to the next/previous post
        // depends on where it was opened from: tapped straight out of
        // the Home feed, it only ever shows that one post (`evt` has no
        // #post-feed-list ancestor); tapped out of a profile's grid (or
        // Saved/Reposts/etc, all of which route through the same
        // scrollable #post-feed-list -- see openPostFeedFrom), you can
        // keep swiping through the rest of that same list without
        // backing out first, the way a TikTok/Reels-style viewer works.
        let reelSwipeEnabled = false;
        function openPostDetail(id, evt){
          const post = findPost(id);
          if (!post) return;
          // The tap that opens this bubbles up through the in-feed video's
          // own tap-to-play area (toggleFeedVideoPlay), which starts that
          // video playing with sound *before* this handler runs -- and
          // that card stays in the DOM underneath the overlay (only
          // #overlay gets new content here, not #screen), so without this
          // it kept playing right along with the new full-screen video
          // this opens, and the two played over each other. Pausing every
          // feed video first (there's normally only ever one playing, but
          // this covers it either way) stops that.
          document.querySelectorAll('#feed-list video, #post-feed-list video').forEach(v => {
            if (!v.paused) {
              v.pause();
              const btn = v.closest('.feed-video-wrap') && v.closest('.feed-video-wrap').querySelector('.feed-video-playbtn');
              if (btn) btn.style.opacity = '1';
            }
          });
          const isMulti = !!(post.mediaHtml && /post-media-carousel/.test(post.mediaHtml));
          const hasSingleMedia = !isMulti && !!post.mediaHtml;
          reelSwipeEnabled = !!(evt && evt.currentTarget && evt.currentTarget.closest && evt.currentTarget.closest('#post-feed-list'));
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = hasSingleMedia ? '0' : OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = hasSingleMedia ? reelPostDetailHTML(post) : postDetailHTML(post);
          const bottomNavEl = document.getElementById('bottom-nav');
          const classroomNavEl = document.getElementById('classroom-nav');
          if (bottomNavEl) bottomNavEl.style.display = 'none';
          if (classroomNavEl) classroomNavEl.style.display = 'none';
          // Optimistic +1 so the author sees the count move without
          // waiting on the round trip; postViewRemote no-ops (and doesn't
          // re-count) if this is your own post or already viewed this
          // session, matching that same guard here.
          if (!post.mine && !viewedThisSession.has(String(id))) {
            post.views = (post.views || 0) + 1;
          }
          postViewRemote(id);
        }

        // Full-screen, edge-to-edge player for a single-media post (photo
        // or video) -- the media fills the whole screen (a video is tap
        // to play/pause, same as the in-feed player; a photo is just
        // shown) with like/comment/repost/share/save stacked as overlaid
        // icons down the right edge and the author + caption overlaid
        // bottom-left, mirroring a Reels-style viewer instead of the
        // plain card-with-comments-below layout. Tapping the comment
        // icon opens the existing comments sheet (openComments) on top
        // of it, same handler the card view uses.
        function reelPostQueue(){
          return postListForSource(postFeedSource).filter(p => p.mediaHtml && !/post-media-carousel/.test(p.mediaHtml));
        }

        // Swipes to the next/previous post in whichever list this reel
        // view was opened from (see reelSwipeEnabled above) -- direction
        // 1 = next (older), -1 = previous (newer). Does nothing if swipe
        // wasn't enabled for this open (a post tapped straight from the
        // Home feed only ever shows that one post), and does nothing at
        // either end of the list.
        function navigateReelPost(currentId, direction){
          if (!reelSwipeEnabled) return;
          const post = findPost(currentId);
          if (!post) return;
          const queue = reelPostQueue();
          const idx = queue.findIndex(p => String(p.id) === String(post.id));
          if (idx === -1) return;
          const nextPost = queue[idx + direction];
          if (!nextPost) return; // no more posts in that direction
          const ov = document.getElementById('overlay');
          if (!ov) return;
          ov.innerHTML = reelPostDetailHTML(nextPost);
          if (!nextPost.mine && !viewedThisSession.has(String(nextPost.id))) {
            nextPost.views = (nextPost.views || 0) + 1;
          }
          postViewRemote(nextPost.id);
        }

        // Touch tracking for the full-screen swipe above. Attached to the
        // whole player (not just the tap-to-play area) so a swipe
        // starting anywhere on screen works, same as a real Reels/TikTok
        // player; a plain tap still falls through to toggleFeedVideoPlay
        // (video posts only) since its dy/dx never clear the swipe
        // threshold below.
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
          if (Math.abs(dy) < SWIPE_THRESHOLD || Math.abs(dx) > Math.abs(dy)) return; // not a deliberate vertical swipe
          navigateReelPost(postId, dy < 0 ? 1 : -1); // swipe up -> next, swipe down -> previous
        }

        function reelPostDetailHTML(post){
          const media = extractPostMedia(post);
          const isVideo = !!media && media.type === 'video';
          const uid = 'vpd' + post.id;
          const captionHtml = renderPostBodyHtml(post);
          return `
            <div class="relative w-full h-full bg-black overflow-hidden" id="video-post-${post.id}" ontouchstart="vpdTouchStart(event)" ontouchend="vpdTouchEnd(event, ${post.id})">
              <div class="absolute inset-0 feed-video-wrap" id="${uid}" ${isVideo ? `onclick="toggleFeedVideoPlay('${uid}')"` : ''}>
                ${media ? (isVideo
                  ? `<video src="${media.url}" class="absolute inset-0 w-full h-full object-contain" playsinline webkit-playsinline disablePictureInPicture controlsList="nodownload noplaybackrate nofullscreen" autoplay loop></video>`
                  : `<img src="${media.url}" class="absolute inset-0 w-full h-full object-contain">`) : ''}
                ${isVideo ? `
                <div class="feed-video-playbtn absolute inset-0 flex items-center justify-center" style="pointer-events:none;opacity:0;">
                  <div class="flex items-center justify-center rounded-full" style="width:4rem;height:4rem;background:rgba(0,0,0,0.45);">${Icon('play','w-7 h-7 text-white')}</div>
                </div>` : ''}
              </div>

              <button onclick="event.stopPropagation(); closeOverlay()" class="absolute z-20 flex items-center justify-center rounded-full" style="top:calc(env(safe-area-inset-top, 12px) + 12px);left:14px;width:2.25rem;height:2.25rem;background:rgba(0,0,0,0.35);">${IconBold('back','w-5 h-5 text-white')}</button>

              ${isVideo ? `<button type="button" id="mutebtn-${uid}" onclick="event.stopPropagation(); toggleFeedVideoMute('${uid}')" class="feed-video-mutebtn absolute z-20 flex items-center justify-center rounded-full" style="top:calc(env(safe-area-inset-top, 12px) + 12px);right:14px;width:2.25rem;height:2.25rem;background:rgba(0,0,0,0.35);">${Icon('volume','w-4 h-4 text-white')}</button>` : ''}

              <div class="absolute z-20 flex flex-col items-center gap-4" style="right:12px;bottom:calc(env(safe-area-inset-bottom, 12px) + 100px);">
                <button onclick="event.stopPropagation(); toggleLike(${post.id})" id="like-btn-${post.id}" class="flex flex-col items-center gap-1 ${post.liked ? `text-[${ROYAL}]` : 'text-white'}">
                  <span id="like-icon-${post.id}" class="rounded-full flex items-center justify-center" style="width:2.75rem;height:2.75rem;background:rgba(120,120,120,0.45);">${Icon(post.liked ? 'thumbUp' : 'thumbUpOutline','w-6 h-6')}</span>
                  <span class="text-[11px] font-bold text-white" id="like-inline-count-${post.id}">${formatCount(post.likes)}</span>
                </button>
                <button onclick="event.stopPropagation(); openComments(${post.id})" id="comment-btn-${post.id}" class="flex flex-col items-center gap-1 text-white">
                  <span class="rounded-full flex items-center justify-center" style="width:2.75rem;height:2.75rem;background:rgba(120,120,120,0.45);">${Icon('comment','w-6 h-6')}</span>
                  <span class="text-[11px] font-bold text-white" id="comment-inline-count-${post.id}">${formatCount(post.comments)}</span>
                </button>
                <button onclick="event.stopPropagation(); toggleRepost(${post.id})" id="repost-btn-${post.id}" class="flex flex-col items-center gap-1 ${post.reposted ? 'text-emerald-600' : 'text-white'}">
                  <span class="rounded-full flex items-center justify-center" style="width:2.75rem;height:2.75rem;background:rgba(120,120,120,0.45);">${Icon('repost','w-5 h-5')}</span>
                  <span class="text-[11px] font-bold text-white" id="repost-inline-count-${post.id}">${formatCount(post.reposts)}</span>
                </button>
                <button onclick="event.stopPropagation(); openShare(${post.id})" id="share-btn-${post.id}" class="flex flex-col items-center gap-1 text-white">
                  <span class="rounded-full flex items-center justify-center" style="width:2.75rem;height:2.75rem;background:rgba(120,120,120,0.45);">${Icon('send','w-6 h-6')}</span>
                  <span class="text-[11px] font-bold text-white" id="share-inline-count-${post.id}">${formatCount(post.shares)}</span>
                </button>
                <button onclick="event.stopPropagation(); toggleSavePost(${post.id})" id="save-btn-${post.id}" class="flex flex-col items-center ${post.saved ? `text-[${ROYAL}]` : 'text-white'}">
                  <span id="save-icon-${post.id}" class="rounded-full flex items-center justify-center" style="width:2.75rem;height:2.75rem;background:rgba(120,120,120,0.45);">${Icon('bookmark','w-6 h-6')}</span>
                </button>
              </div>

              <div class="absolute z-20" style="left:16px;right:88px;bottom:calc(env(safe-area-inset-bottom, 12px) + 20px);">
                <div class="flex items-center gap-2 ${captionHtml ? 'mb-1.5' : ''} cursor-pointer" onclick="event.stopPropagation(); openPersonProfileForPost(${post.id})">
                  <div class="w-8 h-8 rounded-full ${post.avatarBg} overflow-hidden flex items-center justify-center flex-shrink-0" style="background:rgba(120,120,120,0.45);">${(post.mine && profileData.photo) ? `<img src="${profileData.photo}" class="w-full h-full object-cover">` : (!post.mine && post.photo) ? `<img src="${post.photo}" class="w-full h-full object-cover">` : Icon(post.avatarIcon,'w-4 h-4 text-white')}</div>
                  <span class="text-white font-semibold text-sm rounded-full" style="background:rgba(120,120,120,0.45);padding:2px 10px;">${escapeHtml(post.name)}</span>
                  ${post.verified ? verifiedBadge() : ''}
                </div>
                ${captionHtml ? `<div class="text-white text-[13px] leading-snug rounded-2xl" style="background:rgba(120,120,120,0.45);padding:6px 10px;display:inline-block;">${captionHtml}</div>` : ''}
              </div>
            </div>`;
        }

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

        // ---------------- Filtered post feed (profile grids -> scrollable feed) ----------------
        // Tapping a tile in the Posts/Reposts grid on your own Profile, the
        // Saved screen, or someone else's profile used to do nothing --
        // the grid was purely decorative. This opens the tapped tile
        // inside a scrollable, Instagram-style single-column feed of that
        // same collection (your posts, your reposts, your saved posts, or
        // one specific person's posts), landing on the exact post that was
        // tapped, built from the same feedPost() card the Home feed uses
        // -- so liking, commenting, reposting, sharing, and saving all
        // work here exactly like they do there, and tapping the media
        // still opens the full post + comments (openPostDetail).
        let postFeedSource = 'mine';
        let postFeedStartId = null;

        // `source` is one of 'mine' | 'reposts' | 'saved', 'author:<id>' for
        // another person's full post list, or one of the three grids their
        // profile actually shows -- 'author-videos:<id>' | 'author-
        // pictures:<id>' | 'author-reposts:<id>' -- since someone else's
        // profile splits Posts into Videos/Pictures (their Saved items are
        // private and never shown to other users) and surfaces their
        // Reposts alongside them (see personProfileHTML in overlays.js).
        // Sorted newest-first (by `id`, each post's Date.now() creation
        // timestamp) rather than however feedPosts happens to be ordered
        // -- feedPosts gets reshuffled by rankFeedPosts() on every Home
        // feed refresh, which was otherwise making this scrollable feed
        // (and the swipeable reel order it drives -- see
        // navigateReelPost) silently reorder itself underneath someone
        // who had it open, or land on a different order each time it was
        // reopened from a Profile grid. byNewestFirst is defined once in
        // profile.js and shared here.
        function postListForSource(source){
          if (source === 'reposts') return feedPosts.filter(p => p.reposted).sort(byNewestFirst);
          if (source === 'saved') return feedPosts.filter(p => p.saved).sort(byNewestFirst);
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
          if (typeof source === 'string' && (source.indexOf('author-videos:') === 0 || source.indexOf('author-pictures:') === 0 || source.indexOf('author-reposts:') === 0 || source.indexOf('author:') === 0)) {
            const authorId = source.slice(source.indexOf(':') + 1);
            // Prefer whichever profile is currently loaded (has the most
            // up-to-date name); fall back to any post by that author.
            const viewed = (typeof viewedProfile !== 'undefined' && viewedProfile && String(viewedProfile.id) === authorId) ? viewedProfile : null;
            const anyPost = feedPosts.find(p => String(p.authorId) === authorId);
            return (viewed && viewed.name) || (anyPost && anyPost.name) || 'Posts';
          }
          return 'Posts';
        }

        // Opens the scrollable feed at `postId`, remembering whichever
        // screen it was tapped from (the Profile tab itself, the Saved
        // overlay, or someone else's profile overlay) so the back arrow
        // returns there -- same openOverlayFrom pattern used everywhere
        // else in the app. currentOverlayKind is read *before* opening
        // the new overlay (which would otherwise overwrite it first).
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

        // Jumps straight to the tapped post with no scroll animation --
        // same "land exactly where you tapped" behavior as opening a
        // photo from an Instagram profile grid -- instead of dropping the
        // person at the top of the whole list and making them scroll back
        // down to find the post they actually tapped.
        function scrollToPostFeedStart(){
          if (postFeedStartId == null) return;
          const el = document.getElementById('post-' + postFeedStartId);
          if (el) el.scrollIntoView({ block: 'start' });
        }

        // Compact counter formatting (1.2K, 67.4K, 1,171) to match the
        // like/comment/repost/share numbers shown inline next to each icon.
        function formatCount(n){
          if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
          if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
          return n.toLocaleString();
        }

        // A post can legitimately be on screen twice at once -- its card
        // in the Home feed / a profile grid's scrollable list sitting in
        // #screen, underneath the full-screen detail/reel view that just
        // opened on top of it in #overlay -- and both copies render with
        // the same element ids (like-btn-123, save-btn-123, etc). Plain
        // document.getElementById only ever returns the first match in
        // document order, which is the hidden #screen copy (#overlay
        // comes after #screen in the markup) -- so a tap on the like/
        // save/repost button *while the detail view is open* was quietly
        // updating the hidden card underneath instead of the one actually
        // visible, and the visible one only ever caught up once the
        // overlay closed and revealed the (correctly updated) card below.
        // querySelectorAll with an [id="..."] attribute selector, unlike
        // getElementById, returns every element sharing that id -- so
        // updating all of them keeps whichever copy is actually visible
        // in sync no matter which screen (or both) it's currently on.
        function forEachById(id, fn){
          document.querySelectorAll(`[id="${id}"]`).forEach(fn);
        }

        function toggleLike(id){
          PostsAPI.toggleLike(id).then(post => {
            if (!post) return;
            forEachById('like-icon-'+id, iconEl => { iconEl.innerHTML = Icon(post.liked ? 'thumbUp' : 'thumbUpOutline', 'w-6 h-6'); });
            forEachById('like-count-'+id, likeCountEl => { likeCountEl.textContent = post.likes.toLocaleString() + ' likes'; });
            forEachById('like-btn-'+id, btn => {
              // This same id exists on two very differently laid-out
              // buttons -- the plain in-feed card icon row, and the
              // full-screen detail/reel player's stacked icon+count
              // column (see reelPostDetailHTML) -- so which layout
              // classes belong here depends on which layout this
              // particular matched element is, not just the liked color.
              const isReelDetail = btn.closest('#video-post-' + id) != null;
              btn.className = isReelDetail
                ? `flex flex-col items-center gap-1 ${post.liked ? `text-[${ROYAL}]` : 'text-white'}`
                : `p-1 -ml-1 flex items-center gap-1 ${post.liked ? `text-[${ROYAL}]` : ''}`;
            });
            forEachById('like-inline-count-'+id, inline => { inline.textContent = formatCount(post.likes); });
          });
        }

        function toggleRepost(id){
          PostsAPI.toggleRepost(id).then(post => {
            if (!post) return;
            forEachById('repost-btn-'+id, btn => {
              const isReelDetail = btn.closest('#video-post-' + id) != null;
              btn.className = isReelDetail
                ? `flex flex-col items-center gap-1 ${post.reposted ? 'text-emerald-600' : 'text-white'}`
                : `p-1 ml-2 flex items-center gap-1 ${post.reposted ? 'text-emerald-600' : ''}`;
            });
            forEachById('repost-inline-count-'+id, inline => { inline.textContent = formatCount(post.reposts); });
            // Reposting/un-reposting adds or removes an actual post from
            // the feed (see PostsAPI.toggleRepost), so the feed list itself
            // needs a re-render, not just this button's own state.
            if (currentTab === 0) renderFeed();
          });
        }

        function openComments(id){
          const post = findPost(id);
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = commentsHTML(post);
        }

        function commentsHTML(post){
          return `
            ${overlayHeader('Comments', '20px')}
            <div class="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
              ${post.commentsList.length ? post.commentsList.map(commentRow).join('') : '<div class="text-center text-gray-400 text-sm py-8">Be the first to comment.</div>'}
            </div>
            <div class="border-t p-3 flex items-center gap-2 flex-shrink-0">
              <textarea id="comment-input" placeholder="Add a comment..." rows="1" enterkeyhint="enter" oninput="autoGrowConvoInput(this)" class="flex-1 border border-gray-200 rounded-2xl px-4 py-2 text-sm resize-none" style="max-height:100px;overflow-y:auto;line-height:1.3;"></textarea>
              <button onclick="addComment(${post.id})" class="bg-[${NAVY}] text-white px-4 py-2 rounded-full text-sm font-semibold">Post</button>
            </div>`;
        }

        function commentRow(c){
          // c.photo is set from the real commenter's profile (see
          // loadPostInteractions' commentPhotoById lookup) for anyone,
          // not just you. The name-based fallback only matters for the
          // brief optimistic window right after you post a comment,
          // before that photo would've been attached locally.
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
            // Refresh whichever view is currently open in the overlay:
            // the full post detail page (opened by tapping a photo/
            // carousel post) keeps its media/caption above the comments,
            // the full-screen reel player keeps its own overlay chrome,
            // and the plain comments sheet (opened via the comment icon)
            // only shows the list. Checked by looking *inside #overlay*
            // specifically (ov.querySelector, not a bare
            // document.getElementById) since a post can be on screen
            // twice at once -- its card in the Home feed sitting hidden
            // underneath the open overlay uses this same element id, and
            // a plain getElementById would have found that hidden copy
            // instead of checking what's actually open.
            const ov = document.getElementById('overlay');
            const isDetailOpen = !!(ov && ov.querySelector('#post-' + id));
            const isReelOpen = !!(ov && ov.querySelector('#video-post-' + id));
            if (isDetailOpen) {
              if (ov) ov.innerHTML = postDetailHTML(post);
            } else if (isReelOpen) {
              if (ov) ov.innerHTML = reelPostDetailHTML(post);
            } else {
              openComments(id);
            }
          });
        }

        // Contacts tapped in the share sheet below (openShare/shareHTML)
        // before hitting the send button -- reset every time the sheet
        // opens so a leftover selection from a previous share doesn't
        // carry over.
        let shareSelected = new Set();

        function openShare(id){
          const post = findPost(id);
          shareSelected = new Set();
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = shareHTML(post);
        }

        // Everyone the user already has a thread with (primary inbox,
        // requests, and collabs), deduped by conversation id; this is the
        // "network" list shown in the share sheet grid.
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

        // Laid out the same way as the Tag People page (tagPickerListHTML
        // in overlays.js) -- a single-column list of full-width rows,
        // avatar + name/handle on the left and a status indicator on the
        // right -- instead of the old grid of bare circles, so picking who
        // to share with looks and behaves like tagging someone.
        function shareHTML(post){
          const contacts = shareContactsList();
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between">
                <div class="font-semibold text-lg font-display" style="color:${NAVY};">Share post</div>
                <button onclick="closeOverlay()" style="color:${ROYAL};">${IconBold('close','w-5 h-5')}</button>
              </div>
              <div class="max-w-2xl mx-auto px-5 pb-4">
                <div class="relative">
                  <div class="text-gray-400" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);">${Icon('search','w-4 h-4')}</div>
                  <input id="share-search-${post.id}" oninput="filterShareContacts(${post.id})" placeholder="Search" class="w-full bg-gray-100 rounded-full text-sm" style="outline:none;padding:0.625rem 1rem 0.625rem 2.5rem;"/>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div class="max-w-2xl mx-auto px-5">
                <div id="share-grid-${post.id}">
                  ${contacts.map(c => shareContactCell(post.id, c)).join('')}
                </div>
                <div id="share-empty-${post.id}" class="hidden text-center text-sm text-gray-400 py-10">No matches</div>
              </div>
            </div>
            <div class="flex-shrink-0 w-full flex items-start justify-center gap-8 border-t border-gray-100" style="padding-top:16px;padding-bottom:calc(env(safe-area-inset-bottom, 12px) + 16px);background:#fafafa;">
              ${shareExternalOption('link','Copy link', `shareAction(${post.id}, 'Link copied to clipboard')`)}
              ${shareExternalOption('addGlimpseOutline','Add to Glimpse', `addPostToGlimpse(${post.id})`)}
              ${shareExternalOption('send','More apps', `shareAction(${post.id}, 'Opening share sheet...')`)}
            </div>
            <div id="share-send-fab-${post.id}">${shareSendFabHTML(post.id)}</div>`;
        }

        // Tapping a contact only selects/deselects them (a round checkbox,
        // same look as the "New collaboration" contact picker) -- nothing
        // is actually sent until the send FAB (shareSendFabHTML) is
        // tapped. See toggleShareContact / sendPostToSelectedContacts.
        function shareContactCell(postId, c){
          const selected = shareSelected.has(c.id);
          return `
            <button id="share-cell-${postId}-${c.id}" data-name="${escapeHtml(c.name.toLowerCase())}" onclick="toggleShareContact(${postId}, '${c.id}')" class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left">
              <div class="w-9 h-9 ${c.avatarBg} rounded-full flex items-center justify-center text-gray-600 overflow-hidden flex-shrink-0">${avatarInnerHTML(c,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate">${escapeHtml(c.name)}</div>
              </div>
              <div id="share-check-${postId}-${c.id}" class="w-5 h-5 rounded-full border-2 ${selected ? `bg-[${ROYAL}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${selected ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>
            </button>`;
        }

        // Flips one contact's selection state in-place (no full re-render
        // of the list, so scroll position and the search filter stay put)
        // and refreshes the floating send button to reflect the new count.
        function toggleShareContact(postId, contactId){
          if (shareSelected.has(contactId)) shareSelected.delete(contactId); else shareSelected.add(contactId);
          const box = document.getElementById(`share-check-${postId}-${contactId}`);
          if (box) {
            const selected = shareSelected.has(contactId);
            box.className = `w-5 h-5 rounded-full border-2 ${selected ? `bg-[${ROYAL}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0`;
            box.innerHTML = selected ? Icon('check','w-3.5 h-3.5 text-white') : '';
          }
          const fab = document.getElementById(`share-send-fab-${postId}`);
          if (fab) fab.innerHTML = shareSendFabHTML(postId);
        }

        // Floating send button, same fixed-corner placement already used
        // for the "Next" button in the new-collaboration contact picker
        // (see newCollabSelectHTML in chat.js). Hidden entirely until at
        // least one contact is selected; shows a badge with the count.
        function shareSendFabHTML(postId){
          const count = shareSelected.size;
          if (!count) return '';
          return `
            <div style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;">
              <button onclick="sendPostToSelectedContacts(${postId})" title="Send" class="flex items-center justify-center text-white rounded-full shadow-lg" style="position:relative;width:56px;height:56px;background:linear-gradient(135deg,${ROYAL},${NAVY});">
                ${Icon('send','w-5 h-5')}
                <span class="absolute bg-white text-[10px] font-bold rounded-full flex items-center justify-center" style="top:-4px;right:-4px;width:18px;height:18px;color:${ROYAL};box-shadow:0 0 0 2px ${ROYAL};">${count}</span>
              </button>
            </div>`;
        }

        // Each external-share option is an icon button with its label
        // written underneath (link/copy, add to glimpse, more apps) --
        // previously the label only showed up as a hover title, invisible
        // on mobile with no cursor to hover with.
        function shareExternalOption(icon,label,onclick){
          return `
            <div class="flex flex-col items-center gap-1.5" style="width:64px;">
              <button onclick="${onclick}" title="${label}" class="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-700 shadow-sm flex-shrink-0">${Icon(icon,'w-4 h-4')}</button>
              <div class="text-[10px] text-gray-500 font-medium text-center leading-tight">${escapeHtml(label)}</div>
            </div>`;
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

        // Fires when the send FAB is tapped: delivers the post to every
        // selected contact for real (see deliverSharedMessage -- same
        // sendMessageRemote path a typed chat message goes through, so it
        // actually lands in Supabase and the other person's device picks
        // it up over their own subscribeToIncomingMessages subscription,
        // not just a local-only echo), then closes the sheet.
        function sendPostToSelectedContacts(postId){
          if (!shareSelected.size) return;
          const post = findPost(postId);
          const text = `Shared a post: "${(post.body || 'a post from Stitch').slice(0,60)}"`;
          const ids = Array.from(shareSelected);
          ids.forEach(contactId => deliverSharedMessage(contactId, text));
          PostsAPI.share(postId).then(() => bumpShareCountDisplay(postId));
          closeOverlay();
          openAppAlertModal(ids.length === 1 ? 'Sent' : `Sent to ${ids.length} people`);
        }

        // Shared delivery path for both "Share post" and "Share glimpse":
        // pushes the message into the local thread immediately (so it
        // shows up right away for the sender) and, if this contact/group
        // has a real backend user behind it, also sends it through
        // sendMessageRemote (chat.js) -- the same insert + push-notify
        // path sendConvoMessage uses -- so the recipient actually
        // receives it instead of the message only ever existing on the
        // sender's own device.
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
          // Neither branch matched: every member is a local-only mock
          // contact with no backend user, so the message just stays sent
          // on this device, same as sendConvoMessage does in that case.
        }

        // Refreshes the inline share count next to the send icon on the
        // feed card, same pattern as the like/repost/comment counters.
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

        // Pulls the actual photo/video out of a post's rendered mediaHtml
        // so it can be reused as glimpse media -- glimpses only ever hold
        // pictures and videos, never plain text, so a text-only post has
        // nothing to hand back here. For a multi-item post (a swipeable
        // carousel -- see postMediaCarouselHtml/postMediaHtmlFromUploaded)
        // this grabs just the first pane's media, same as tapping "Add to
        // Glimpse" on a single-media post.
        function extractPostMedia(post){
          if (!post || !post.mediaHtml) return null;
          const srcMatch = post.mediaHtml.match(/<(img|video)[^>]*\ssrc="([^"]+)"/i);
          if (!srcMatch) return null;
          return { url: srcMatch[2], type: /^video$/i.test(srcMatch[1]) ? 'video' : 'image' };
        }

        // Same video-vs-picture check as extractPostMedia, but for anywhere
        // that just needs the media *kind* without pulling the URL back out
        // -- used to split a profile's posts into separate Videos/Pictures
        // grids (see personProfileHTML in overlays.js). A post with no
        // media (or a text-only post) counts as 'picture' so it still has
        // a home in one of the two grids instead of silently vanishing.
        // For a multi-item carousel post, this looks at the first pane
        // (same convention as extractPostMedia).
        function postMediaKind(post){
          if (!post || !post.mediaHtml) return 'picture';
          const firstTag = post.mediaHtml.match(/<(img|video)\b/i);
          return (firstTag && /^video$/i.test(firstTag[1])) ? 'video' : 'picture';
        }

        // Wired to the "Add to Glimpse" option in the share sheet: takes
        // the post's own photo/video and posts it straight to the current
        // user's glimpse, same shape as a normal camera-picked glimpse.
        function addPostToGlimpse(id){
          const post = findPost(id);
          const media = extractPostMedia(post);
          if (!media) {
            closeOverlay();
            openAppAlertModal('Only photos and videos can be added to your glimpse');
            return;
          }
          addMyGlimpse({
            caption: '',
            icon: media.type === 'video' ? 'video' : 'camera',
            bgStyle: 'background:linear-gradient(135deg,#374151,#111827)',
            mediaUrl: media.url,
            mediaType: media.type,
          });
          PostsAPI.share(id).then(() => bumpShareCountDisplay(id));
          closeOverlay();
          openAppAlertModal('Added to your glimpse');
        }

        // ---------------- SHARE GLIMPSE ----------------
        // "Share glimpse" in the My Glimpse row menu -- same contacts-grid
        // sheet as sharing a post (shareHTML/shareContactsList above),
        // just pointed at a glimpse instead of a post. Opened from inside
        // the My Glimpse list overlay, so its close button returns to
        // that list (openMyGlimpses()) rather than exiting to the app
        // underneath, the same way the media-caption screen's cancel/
        // submit do.
        // Same pattern as shareSelected above, kept as its own set since
        // the post-share sheet and glimpse-share sheet are opened from
        // different places and shouldn't bleed selections into each other.
        let shareGlimpseSelected = new Set();

        function openShareGlimpse(id){
          const g = myGlimpses.find(x => x.id === id);
          if (!g) return;
          shareGlimpseSelected = new Set();
          const ov = document.getElementById('overlay');
          ov.classList.remove('hidden');
          ov.style.top = OVERLAY_TOP;
          ov.style.paddingTop = '';
          ov.style.bottom = '0';
          ov.innerHTML = shareGlimpseHTML(g);
        }

        // Same list layout as shareHTML above / the Tag People page --
        // full-width rows instead of a grid of circles.
        function shareGlimpseHTML(g){
          const contacts = shareContactsList();
          return `
            <div class="flex-shrink-0 w-full" style="padding-top:20px;">
              <div class="max-w-2xl mx-auto px-5 pb-3 flex items-center justify-between">
                <div class="font-semibold text-lg font-display" style="color:${NAVY};">Share glimpse</div>
                <button onclick="openMyGlimpses()" style="color:${ROYAL};">${IconBold('close','w-5 h-5')}</button>
              </div>
              <div class="max-w-2xl mx-auto px-5 pb-4">
                <div class="relative">
                  <div class="text-gray-400" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);">${Icon('search','w-4 h-4')}</div>
                  <input id="share-glimpse-search-${g.id}" oninput="filterShareGlimpseContacts(${g.id})" placeholder="Search" class="w-full bg-gray-100 rounded-full text-sm" style="outline:none;padding:0.625rem 1rem 0.625rem 2.5rem;"/>
                </div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto">
              <div class="max-w-2xl mx-auto px-5">
                <div id="share-glimpse-grid-${g.id}">
                  ${contacts.map(c => shareGlimpseContactCell(g.id, c)).join('')}
                </div>
                <div id="share-glimpse-empty-${g.id}" class="hidden text-center text-sm text-gray-400 py-10">No matches</div>
              </div>
            </div>
            <div class="flex-shrink-0 w-full flex items-start justify-center gap-8 border-t border-gray-100" style="padding-top:16px;padding-bottom:calc(env(safe-area-inset-bottom, 12px) + 16px);background:#fafafa;">
              ${shareExternalOption('link','Copy link', `shareGlimpseAction(${g.id}, 'Link copied to clipboard')`)}
              ${shareExternalOption('send','More apps', `shareGlimpseAction(${g.id}, 'Opening share sheet...')`)}
            </div>
            <div id="share-glimpse-send-fab-${g.id}">${shareGlimpseSendFabHTML(g.id)}</div>`;
        }

        // Tapping a contact only selects/deselects them -- sending happens
        // when the send FAB is tapped (see toggleShareGlimpseContact /
        // sendGlimpseToSelectedContacts), same as the post-share sheet.
        function shareGlimpseContactCell(glimpseId, c){
          const selected = shareGlimpseSelected.has(c.id);
          return `
            <button id="share-glimpse-cell-${glimpseId}-${c.id}" data-name="${escapeHtml(c.name.toLowerCase())}" onclick="toggleShareGlimpseContact(${glimpseId}, '${c.id}')" class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left">
              <div class="w-9 h-9 ${c.avatarBg} rounded-full flex items-center justify-center text-gray-600 overflow-hidden flex-shrink-0">${avatarInnerHTML(c,'w-4 h-4')}</div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold truncate">${escapeHtml(c.name)}</div>
              </div>
              <div id="share-glimpse-check-${glimpseId}-${c.id}" class="w-5 h-5 rounded-full border-2 ${selected ? `bg-[${ROYAL}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0">${selected ? Icon('check','w-3.5 h-3.5 text-white') : ''}</div>
            </button>`;
        }

        function toggleShareGlimpseContact(glimpseId, contactId){
          if (shareGlimpseSelected.has(contactId)) shareGlimpseSelected.delete(contactId); else shareGlimpseSelected.add(contactId);
          const box = document.getElementById(`share-glimpse-check-${glimpseId}-${contactId}`);
          if (box) {
            const selected = shareGlimpseSelected.has(contactId);
            box.className = `w-5 h-5 rounded-full border-2 ${selected ? `bg-[${ROYAL}] border-[${ROYAL}]` : 'border-gray-300'} flex items-center justify-center flex-shrink-0`;
            box.innerHTML = selected ? Icon('check','w-3.5 h-3.5 text-white') : '';
          }
          const fab = document.getElementById(`share-glimpse-send-fab-${glimpseId}`);
          if (fab) fab.innerHTML = shareGlimpseSendFabHTML(glimpseId);
        }

        function shareGlimpseSendFabHTML(glimpseId){
          const count = shareGlimpseSelected.size;
          if (!count) return '';
          return `
            <div style="position:fixed;right:1.25rem;bottom:1.25rem;z-index:50;">
              <button onclick="sendGlimpseToSelectedContacts(${glimpseId})" title="Send" class="flex items-center justify-center text-white rounded-full shadow-lg" style="position:relative;width:56px;height:56px;background:linear-gradient(135deg,${ROYAL},${NAVY});">
                ${Icon('send','w-5 h-5')}
                <span class="absolute bg-white text-[10px] font-bold rounded-full flex items-center justify-center" style="top:-4px;right:-4px;width:18px;height:18px;color:${ROYAL};box-shadow:0 0 0 2px ${ROYAL};">${count}</span>
              </button>
            </div>`;
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

        // Fires when the send FAB is tapped: actually delivers the
        // glimpse to every selected contact via deliverSharedMessage
        // (same real sendMessageRemote path as a typed chat message),
        // then closes the sheet.
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

