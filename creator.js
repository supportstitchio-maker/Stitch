        // ============================================================
        // Creator payments (frontend) Plan: "Stitch creator payments: plan and wiring"
        // ============================================================

        const CREATOR_AMOUNT_DIVISOR = 1;
        const CREATOR_REPORT_REASONS = [['scam', 'Scam'], ['misleading', 'Misleading'], ['inappropriate', 'Inappropriate'], ['other', 'Other']];
        const CREATOR_MIN_WITHDRAWAL_GHS = 50;
        const CREATOR_MOMO_PROVIDERS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'];

        let currentUserCreatorStatus = ''; // '' | 'pending' | 'approved' | 'suspended'
        let creatorPayoutsHeld = false;

        function canCurrentUserSellPaid(){
          return isCurrentUserAdmin() || currentUserCreatorStatus === 'approved';
        }
        function creatorShareLabel(){ return (100 - PAID_SELLER_SHARE_PCT) + '%'; }
        function stitchShareLabel(){ return PAID_SELLER_SHARE_PCT + '%'; }

        function ghs(n){
          const v = Number(n || 0) / CREATOR_AMOUNT_DIVISOR;
          const sign = v < 0 ? '-' : '';
          return sign + 'GH₵' + Math.abs(v).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        function creatorDate(iso){
          if (!iso) return '';
          const d = new Date(iso);
          return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        function sumBy(rows, pred){
          return rows.reduce((n, r) => pred(r) ? n + Number(r.amount || 0) : n, 0);
        }
        function creatorProductName(type, id){
          const cls = (typeof myClasses !== 'undefined') ? myClasses.find(c => c.id === id) : null;
          if (cls) return cls.name;
          const course = (typeof allCourses !== 'undefined') ? allCourses.find(c => c.id === id) : null;
          if (course) return course.title;
          return type === 'course' ? 'Course' : 'Class';
        }
        async function creatorPeopleByIds(ids){
          const out = {};
          const list = Array.from(new Set((ids || []).filter(Boolean)));
          if (!list.length) return out;
          try {
            const sb = getSupabaseClient();
            const { data } = await sb.from(PUBLIC_PROFILES_TABLE).select('user_id, name, username').in('user_id', list);
            (data || []).forEach(p => { out[p.user_id] = p; });
          } catch (e) {}
          return out;
        }
        function personName(map, id){
          const p = map && map[id];
          return (p && (p.name || p.username)) || 'Unnamed user';
        }

        // The only door to money. Server decides everything; the app just asks.
        async function creatorApi(fn, body){
          const token = await getAuthAccessToken();
          if (!token) throw new Error('Please sign in again.');
          let res;
          try {
            res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_ANON_KEY },
              body: JSON.stringify(body || {}),
            });
          } catch (e) { throw new Error('Could not reach the server. Check your connection and try again.'); }
          let data = null;
          try { data = await res.json(); } catch (e) {}
          if (res.status === 404) { const e = new Error("This isn't switched on yet. Please try again later."); e.code = 'not_deployed'; throw e; }
          if (!res.ok || (data && data.error)) throw new Error((data && data.error) || ('Something went wrong (' + res.status + ').'));
          return data || {};
        }

        function creatorStateMissing(tableErr){
          return !!tableErr && /relation|does not exist|schema cache|42P01|PGRST2/i.test((tableErr.message || '') + (tableErr.code || ''));
        }

        // ---- Who am I as a creator? (called at boot and after any approval) ----
        async function loadCreatorState(){
          try {
            const sb = getSupabaseClient();
            if (!sb) return;
            const user = await getCachedAuthUser();
            if (!user) return;
            const { data, error } = await sb.from('creator_profiles').select('status, payouts_held').eq('user_id', user.id).maybeSingle();
            if (!error && data) {
              currentUserCreatorStatus = ['approved', 'suspended', 'pending'].includes(data.status) ? data.status : '';
              creatorPayoutsHeld = !!data.payouts_held;
            } else {
              currentUserCreatorStatus = currentUserPaidSellerRequested ? 'pending' : '';
            }
          } catch (e) {}
          if (typeof refreshProfilePosterButton === 'function') refreshProfilePosterButton();
        }

        // ============================================================
        // Overlay plumbing
        // ============================================================
        function creatorRerender(kind){
          // Wallet and receipts now live inside the Dashboard page
          const inDashboard = currentOverlayKind === 'posterDashboard' && (kind === 'creatorWallet' || kind === 'receipts');
          if (currentOverlayKind !== kind && !inDashboard) return;
          const ov = document.getElementById('overlay');
          if (!ov) return;
          const scroller = ov.querySelector('.overflow-y-auto');
          const top = scroller ? scroller.scrollTop : 0;
          ov.innerHTML = inDashboard ? posterDashboardHTML() : creatorOverlayHTML(kind);
          const s2 = ov.querySelector('.overflow-y-auto');
          if (s2) s2.scrollTop = top;
        }
        function creatorOverlayHTML(kind){
          if (kind === 'creatorWallet') return creatorWalletHTML();
          if (kind === 'creatorWithdraw') return creatorWithdrawHTML();
          if (kind === 'reportClass') return reportClassHTML();
          if (kind === 'receipts') return receiptsHTML();
          return '';
        }
        const creatorCard = 'bg-white rounded-2xl shadow-sm border border-gray-100';
        const creatorEmpty = msg => `<div class="bg-gray-50 border border-dashed border-gray-300 rounded-3xl p-8 text-center text-gray-500 text-sm">${msg}</div>`;
        const creatorNavyBtn = `background:linear-gradient(135deg, ${NAVY} 0%, ${ROYAL} 100%);`;

        // ============================================================
        // Creator Wallet
        // ============================================================
        let walletTab = 'students';
        let walletState = { loading: false, loaded: false, missing: false, ledger: [], payments: [], payouts: [], people: {} };

        function openCreatorWallet(){
          if (!canCurrentUserSellPaid() && currentUserCreatorStatus !== 'suspended') {
            openAppAlertModal('The Wallet is for approved creators. Apply from Career Space → Add course & paid classes.', 'Wallet');
            return;
          }
          walletTab = 'students';
          openDashboard('wallet');
        }

        async function loadCreatorWallet(){
          const sb = getSupabaseClient();
          if (!sb || walletState.loading) return;
          walletState.loading = true; walletState.missing = false;
          if (!walletState.loaded) creatorRerender('creatorWallet');
          try {
            const uid = await getCurrentUserId();
            const [l, p, o] = await Promise.all([
              sb.from('wallet_ledger').select('id, payment_id, type, amount, state, created_at').eq('creator_id', uid).order('created_at', { ascending: false }).limit(1000),
              sb.from('payments').select('id, paystack_reference, buyer_id, product_type, product_id, gross_amount, stitch_fee, creator_net, status, paid_at, release_at').eq('creator_id', uid).order('paid_at', { ascending: false }).limit(300),
              sb.from('payouts').select('id, amount, status, failure_reason, requested_at, paid_at').eq('creator_id', uid).order('requested_at', { ascending: false }).limit(100),
            ]);
            if ([l, p, o].some(r => r.error && creatorStateMissing(r.error))) walletState.missing = true;
            walletState.ledger = l.data || [];
            walletState.payments = p.data || [];
            walletState.payouts = o.data || [];
            walletState.people = await creatorPeopleByIds(walletState.payments.map(x => x.buyer_id));
            walletState.loaded = true;
          } catch (e) { console.warn('Loading wallet failed:', e); walletState.missing = true; }
          walletState.loading = false;
          creatorRerender('creatorWallet');
        }

        function walletBalances(){
          const L = walletState.ledger;
          return {
            available: sumBy(L, r => r.state === 'available'),
            pending: sumBy(L, r => r.state === 'pending'),
            lifetime: sumBy(L, r => r.type === 'sale'),
          };
        }

        // Display only. The database decides for real (creator_next_withdrawal_at) and refuses
        // early requests. Schedule: 1st withdrawal 14 days after the first sale, 2nd +7 days, 3rd
        // +7 days, then every 2 days
        const CREATOR_ACTIVE_PAYOUT = ['pending_approval', 'approved', 'processing', 'paid'];
        function creatorNextWithdrawalAt(){
          const active = walletState.payouts.filter(o => CREATOR_ACTIVE_PAYOUT.includes(o.status) && o.requested_at);
          const DAY = 86400000;
          if (!active.length) {
            const sales = walletState.ledger.filter(r => r.type === 'sale' && r.created_at);
            if (!sales.length) return null;
            return new Date(Math.min(...sales.map(r => new Date(r.created_at).getTime())) + PAID_SELLER_FIRST_WAIT_DAYS * DAY);
          }
          const last = Math.max(...active.map(o => new Date(o.requested_at).getTime()));
          const gap = active.length <= PAID_SELLER_GAP_DAYS.length ? PAID_SELLER_GAP_DAYS[active.length - 1] : PAID_SELLER_GAP_DAYS_AFTER;
          return new Date(last + gap * DAY);
        }
        function creatorWithdrawalInProgress(){
          return walletState.payouts.some(o => ['pending_approval', 'approved', 'processing'].includes(o.status));
        }
        // One short line the wallet and withdraw screens share.
        function creatorWithdrawalNote(){
          if (creatorWithdrawalInProgress()) return 'You have a withdrawal in progress. You can ask again once it is done.';
          const next = creatorNextWithdrawalAt();
          if (!next) return 'Your first withdrawal opens ' + PAID_SELLER_FIRST_WAIT_DAYS + ' days after your first sale.';
          if (next > new Date()) return 'Your next withdrawal opens on ' + creatorDate(next.toISOString()) + '.';
          return 'You can withdraw now.';
        }

        function setWalletTab(t){ walletTab = t; creatorRerender('creatorWallet'); }

        function walletStatusChip(status, reason){
          const map = {
            pending_approval: ['Waiting for approval', 'bg-amber-50 text-amber-600'],
            approved: ['Approved', 'bg-blue-50 text-blue-600'],
            processing: ['On its way', 'bg-blue-50 text-blue-600'],
            paid: ['Paid', 'bg-emerald-50 text-emerald-600'],
            failed: ['Failed', 'bg-red-50 text-red-500'],
            rejected: ['Declined', 'bg-red-50 text-red-500'],
            refunded: ['Refunded', 'bg-gray-100 text-gray-500'],
          };
          const [label, cls] = map[status] || [status || '', 'bg-gray-100 text-gray-500'];
          return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}">${label}</span>`;
        }

        function walletStudentsHTML(){
          const paid = walletState.payments.filter(x => x.status === 'paid');
          if (!paid.length) return creatorEmpty('No students yet. When someone pays to join one of your classes, they appear here.');
          const groups = {};
          paid.forEach(x => { (groups[x.product_type + ':' + x.product_id] = groups[x.product_type + ':' + x.product_id] || []).push(x); });
          return Object.keys(groups).map(k => {
            const rows = groups[k];
            const first = rows[0];
            return `
              <div class="${creatorCard} p-4 mb-3">
                <div class="flex items-center justify-between mb-2">
                  <div class="font-semibold text-sm truncate pr-3" style="color:${NAVY};">${escapeHtml(creatorProductName(first.product_type, first.product_id))}</div>
                  <div class="text-xs text-gray-400 flex-shrink-0">${rows.length} student${rows.length === 1 ? '' : 's'}</div>
                </div>
                ${rows.map(r => `
                  <div class="flex items-center justify-between py-2 border-t border-gray-100 text-sm">
                    <div class="min-w-0"><div class="truncate">${escapeHtml(personName(walletState.people, r.buyer_id))}</div><div class="text-[11px] text-gray-400">Joined ${creatorDate(r.paid_at)}</div></div>
                    <div class="font-semibold flex-shrink-0">${ghs(r.gross_amount)}</div>
                  </div>`).join('')}
              </div>`;
          }).join('');
        }

        function walletPaymentsHTML(){
          if (!walletState.payments.length) return creatorEmpty('No sales yet.');
          return walletState.payments.map(x => `
            <div class="${creatorCard} p-4 mb-3">
              <div class="flex items-center justify-between mb-1">
                <div class="font-semibold text-sm truncate pr-3">${escapeHtml(creatorProductName(x.product_type, x.product_id))}</div>
                ${walletStatusChip(x.status)}
              </div>
              <div class="text-[11px] text-gray-400 mb-3">${escapeHtml(personName(walletState.people, x.buyer_id))} · ${creatorDate(x.paid_at)}</div>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div><div class="text-[10px] text-gray-400">Student paid</div><div class="text-sm font-semibold">${ghs(x.gross_amount)}</div></div>
                <div><div class="text-[10px] text-gray-400">Stitch ${stitchShareLabel()}</div><div class="text-sm font-semibold text-gray-500">${ghs(x.stitch_fee)}</div></div>
                <div><div class="text-[10px] text-gray-400">You ${creatorShareLabel()}</div><div class="text-sm font-bold" style="color:${NAVY};">${ghs(x.creator_net)}</div></div>
              </div>
            </div>`).join('');
        }

        function walletWithdrawalsHTML(){
          if (!walletState.payouts.length) return creatorEmpty('No withdrawals yet.');
          return walletState.payouts.map(o => `
            <div class="${creatorCard} p-4 mb-3">
              <div class="flex items-center justify-between">
                <div class="font-bold" style="color:${NAVY};">${ghs(o.amount)}</div>
                ${walletStatusChip(o.status)}
              </div>
              <div class="text-[11px] text-gray-400 mt-1">Requested ${creatorDate(o.requested_at)}${o.paid_at ? ' · Paid ' + creatorDate(o.paid_at) : ''}</div>
              ${o.status === 'failed' || o.status === 'rejected' ? `<div class="text-xs text-red-500 mt-2">${escapeHtml(o.failure_reason || (o.status === 'rejected' ? 'An admin declined this request.' : 'The transfer failed. The money is back in your wallet.'))}</div>` : ''}
            </div>`).join('');
        }

        function creatorWalletHTML(){
          return `
            ${overlayHeader('Wallet', '20px', null, null, { center: true })}
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:50px;">
              <div class="max-w-2xl mx-auto">${creatorWalletBodyHTML()}</div>
            </div>`;
        }
        // The wallet's content on its own, so the Dashboard can show it as a tab.
        // Earnings charts on the creator wallet
        function walletChartsHTML(b){
          try {
            if (walletState.loading || walletState.missing) return '';
            const paid = walletState.payments.filter(x => x.status === 'paid');
            const withdrawn = Math.max(0, b.lifetime - b.available - b.pending);
            return chartColumnsCardHTML('Your earnings per week', chartTimeline(paid, x => x.paid_at, x => Number(x.creator_net || 0) / CREATOR_AMOUNT_DIVISOR, 8, 7), '#1e90ff', chartCompact, 'GH₵, last 8 weeks') +
              chartDonutCardHTML('Where your money is', [{ label: 'Available', n: b.available / CREATOR_AMOUNT_DIVISOR, color: '#059669' }, { label: 'Pending', n: b.pending / CREATOR_AMOUNT_DIVISOR, color: '#f59e0b' }, { label: 'Withdrawn', n: withdrawn / CREATOR_AMOUNT_DIVISOR, color: '#94a3b8' }], chartCompact(b.lifetime / CREATOR_AMOUNT_DIVISOR), 'lifetime GH₵');
          } catch (e) { return ''; }
        }
        function creatorWalletBodyHTML(){
          const b = walletBalances();
          const upcoming = walletState.payments.filter(x => x.status === 'paid' && x.release_at && new Date(x.release_at) > new Date()).sort((a, c) => new Date(a.release_at) - new Date(c.release_at));
          const nextRelease = upcoming[0];
          const body = walletState.loading && !walletState.loaded ? `<div class="text-center text-gray-400 text-sm py-8">Loading…</div>`
            : walletState.missing ? creatorEmpty('Your wallet is not set up yet. It will switch on once creator payments launch.')
            : walletTab === 'students' ? walletStudentsHTML() : walletTab === 'payments' ? walletPaymentsHTML() : walletWithdrawalsHTML();
          const tabs = [['students', 'Students'], ['payments', 'Payments'], ['withdrawals', 'Withdrawals']];
          return `
                ${currentUserCreatorStatus === 'suspended' ? `<div class="bg-red-50 text-red-600 text-xs rounded-2xl p-3 mb-3">Your creator access is paused. You can still see your history. Contact support to find out why.</div>` : ''}
                ${creatorPayoutsHeld ? `<div class="bg-amber-50 text-amber-700 text-xs rounded-2xl p-3 mb-3">Withdrawals are on hold while a report is reviewed.</div>` : ''}
                <div class="rounded-3xl p-5 text-white mb-3" style="${creatorNavyBtn}">
                  <div class="text-xs text-white/80">Available to withdraw</div>
                  <div class="text-3xl font-bold font-display mt-1">${ghs(b.available)}</div>
                  <div class="text-[11px] text-white/80 mt-2">${creatorWithdrawalNote()}</div>
                  <button onclick="openCreatorWithdraw()" class="mt-3 w-full py-2.5 rounded-full font-semibold text-sm" style="background:#fff;color:${NAVY};">Withdraw</button>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-2">
                  <div class="${creatorCard} p-4">
                    <div class="text-[11px] text-gray-400">Pending</div>
                    <div class="text-lg font-bold" style="color:${NAVY};">${ghs(b.pending)}</div>
                    <div class="text-[11px] text-gray-400 mt-1">${nextRelease ? 'Next release ' + creatorDate(nextRelease.release_at) : 'Nothing waiting'}</div>
                  </div>
                  <div class="${creatorCard} p-4">
                    <div class="text-[11px] text-gray-400">Lifetime earnings</div>
                    <div class="text-lg font-bold" style="color:${NAVY};">${ghs(b.lifetime)}</div>
                    <div class="text-[11px] text-gray-400 mt-1">Your ${creatorShareLabel()} of every sale</div>
                  </div>
                </div>
                ${walletChartsHTML(b)}
                ${upcoming.length ? `
                  <div class="text-[11px] text-gray-400 mb-4 px-1">${upcoming.slice(0, 3).map(x => `${ghs(x.creator_net)} on ${creatorDate(x.release_at)}`).join(' · ')}</div>` : '<div class="mb-4"></div>'}
                <div class="pill-bleed flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
                  ${tabs.map(([k, label]) => `<button onclick="setWalletTab('${k}')" class="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${walletTab === k ? '' : 'bg-white text-gray-500 border border-gray-200'}" style="${walletTab === k ? `background:rgba(10,37,64,0.08);color:${NAVY};border:1.5px solid ${NAVY};` : ''}">${label}</button>`).join('')}
                </div>
                ${body}`;
        }

        // ============================================================
        // Withdraw + payout account
        // ============================================================
        let withdrawDraft = null;
        let withdrawBusy = false;

        async function openCreatorWithdraw(){
          if (currentUserCreatorStatus !== 'approved') { openAppAlertModal('Only approved creators can withdraw.', 'Withdraw'); return; }
          withdrawDraft = { loaded: false, editing: false, saved: null, method: 'momo', provider: CREATOR_MOMO_PROVIDERS[0], accountName: '', accountNumber: '', amount: '' };
          openOverlayFrom(currentOverlayKind === 'posterDashboard' ? 'posterDashboard' : 'creatorWallet', 'creatorWithdraw');
          try {
            const sb = getSupabaseClient(); const uid = await getCurrentUserId();
            const { data } = await sb.from('creator_profiles').select('payout_method, provider, account_name, account_number').eq('user_id', uid).maybeSingle();
            if (data && data.account_number) {
              withdrawDraft.saved = data;
              Object.assign(withdrawDraft, { method: data.payout_method || 'momo', provider: data.provider || '', accountName: data.account_name || '', accountNumber: data.account_number || '' });
            } else withdrawDraft.editing = true;
          } catch (e) { withdrawDraft.editing = true; }
          withdrawDraft.loaded = true;
          creatorRerender('creatorWithdraw');
        }
        function setWithdrawField(f, v){ if (withdrawDraft) withdrawDraft[f] = v; }
        function setWithdrawMethod(m){
          withdrawDraft.method = m;
          withdrawDraft.provider = m === 'momo' ? CREATOR_MOMO_PROVIDERS[0] : '';
          creatorRerender('creatorWithdraw');
        }
        function editWithdrawAccount(){ withdrawDraft.editing = true; creatorRerender('creatorWithdraw'); }
        function withdrawAll(){ withdrawDraft.amount = String(walletBalances().available / CREATOR_AMOUNT_DIVISOR); creatorRerender('creatorWithdraw'); }

        function normalizeName(s){ return String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' '); }
        function payoutNameMatchesProfile(){
          const mine = normalizeName(typeof profileData !== 'undefined' ? profileData.name : '');
          const theirs = normalizeName(withdrawDraft.accountName);
          return !!mine && !!theirs && mine === theirs;
        }

        async function saveWithdrawAccount(){
          const d = withdrawDraft;
          if (!d.accountName.trim() || !/^[0-9+\s-]{8,20}$/.test(d.accountNumber.trim()) || (d.method === 'bank' && !d.provider.trim())) {
            openAppAlertModal(d.method === 'bank' ? 'Enter the bank name, the account name and a valid account number.' : 'Enter the name on the account and a valid mobile money number.');
            return;
          }
          if (!payoutNameMatchesProfile()) {
            openAppAlertModal(`The account name must match the name on your Stitch profile (${(profileData && profileData.name) || 'not set'}). Update one of them and try again.`, 'Names do not match');
            return;
          }
          try {
            const sb = getSupabaseClient(); const uid = await getCurrentUserId();
            // paystack_recipient_code is cleared so the next payout makes a fresh Paystack recipient.
            const { error } = await sb.from('creator_profiles').update({
              payout_method: d.method, provider: d.provider.trim(), account_name: d.accountName.trim(), account_number: d.accountNumber.trim(), paystack_recipient_code: null,
            }).eq('user_id', uid);
            if (error) throw error;
            d.saved = { payout_method: d.method, provider: d.provider, account_name: d.accountName, account_number: d.accountNumber };
            d.editing = false;
            creatorRerender('creatorWithdraw');
          } catch (e) { openAppAlertModal("Couldn't save your account. Check your connection and try again."); }
        }

        async function submitWithdrawal(){
          if (withdrawBusy) return;
          const d = withdrawDraft;
          const amount = Math.round(parseFloat(d.amount) * 100) / 100;
          const available = walletBalances().available / CREATOR_AMOUNT_DIVISOR;
          if (!d.saved) { openAppAlertModal('Save your payout account first.'); return; }
          if (!(amount > 0)) { openAppAlertModal('Enter how much you want to withdraw.'); return; }
          if (amount < CREATOR_MIN_WITHDRAWAL_GHS) { openAppAlertModal(`The minimum withdrawal is GH₵${CREATOR_MIN_WITHDRAWAL_GHS}.`); return; }
          if (amount > available) { openAppAlertModal(`You can withdraw up to ${ghs(available * CREATOR_AMOUNT_DIVISOR)} right now.`); return; }
          if (creatorPayoutsHeld) { openAppAlertModal('Withdrawals are on hold while a report is reviewed.'); return; }
          if (creatorWithdrawalInProgress()) { openAppAlertModal('You already have a withdrawal in progress. Wait for it to finish first.'); return; }
          withdrawBusy = true;
          const btn = document.getElementById('withdraw-submit-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Sending…'; }
          try {
            await creatorApi('request-payout', { amount });
            withdrawBusy = false;
            loadCreatorWallet();
            walletTab = 'withdrawals';
            overlayGoBack();
            openAppAlertModal(`Request sent. An admin reviews it within ${PAID_SELLER_APPROVAL_HOURS} hours, then the money goes to your account.`, 'Withdrawal requested');
          } catch (e) {
            withdrawBusy = false;
            if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = 'Request withdrawal'; }
            openAppAlertModal(e.message, "Couldn't request withdrawal");
          }
        }

        function creatorWithdrawHTML(){
          const d = withdrawDraft;
          if (!d || !d.loaded) return `${overlayHeader('Withdraw', '20px', null, null, { center: true })}<div class="text-center text-gray-400 text-sm py-8">Loading…</div>`;
          const available = walletBalances().available;
          const input = 'w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none';
          const label = 'text-xs font-bold text-gray-400 mb-1 block';
          const methodBtns = [['momo', 'Mobile money'], ['bank', 'Bank account']].map(([k, l]) => `<button onclick="setWithdrawMethod('${k}')" class="flex-1 px-4 py-2.5 rounded-2xl text-sm font-semibold outline-pill ${d.method === k ? 'is-selected' : ''}">${l}</button>`).join('');
          const accountForm = `
            <div class="${creatorCard} p-4 mb-4">
              <div class="font-semibold text-sm mb-3" style="color:${NAVY};">Payout account</div>
              <div class="flex gap-2 mb-3">${methodBtns}</div>
              ${d.method === 'momo'
                ? `<label class="${label}">Network</label><select onchange="setWithdrawField('provider', this.value)" class="${input} mb-3">${CREATOR_MOMO_PROVIDERS.map(p => `<option ${d.provider === p ? 'selected' : ''}>${p}</option>`).join('')}</select>`
                : `<label class="${label}">Bank name</label><input type="text" value="${escapeHtml(d.provider)}" oninput="setWithdrawField('provider', this.value)" placeholder="e.g. GCB Bank" class="${input} mb-3">`}
              <label class="${label}">Name on the account</label>
              <input type="text" value="${escapeHtml(d.accountName)}" oninput="setWithdrawField('accountName', this.value)" placeholder="Must match your Stitch profile name" class="${input} mb-3">
              <label class="${label}">${d.method === 'momo' ? 'Mobile money number' : 'Account number'}</label>
              <input type="tel" inputmode="numeric" value="${escapeHtml(d.accountNumber)}" oninput="setWithdrawField('accountNumber', this.value)" class="${input} mb-3">
              <button onclick="saveWithdrawAccount()" class="w-full py-2.5 rounded-full text-white font-semibold text-sm" style="${creatorNavyBtn}">Save account</button>
            </div>`;
          const savedCard = d.saved ? `
            <div class="${creatorCard} p-4 mb-4 flex items-center justify-between">
              <div class="min-w-0">
                <div class="text-[11px] text-gray-400">Paying out to</div>
                <div class="font-semibold text-sm truncate">${escapeHtml(d.saved.account_name)}</div>
                <div class="text-xs text-gray-500 truncate">${escapeHtml(d.saved.provider || '')} · ${escapeHtml(String(d.saved.account_number).replace(/.(?=.{4})/g, '•'))}</div>
              </div>
              <button onclick="editWithdrawAccount()" class="text-xs font-semibold flex-shrink-0 pl-3" style="color:${ROYAL};">Change</button>
            </div>` : '';
          return `
            ${overlayHeader('Withdraw', '20px', null, null, { center: true })}
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:40px;">
              <div class="max-w-2xl mx-auto">
                <div class="text-sm text-gray-500 mb-1">Available now: <span class="font-bold" style="color:${NAVY};">${ghs(available)}</span></div>
                <div class="text-xs text-gray-400 mb-4">${creatorWithdrawalNote()} ${PAID_SELLER_SCHEDULE_TEXT}</div>
                ${d.editing || !d.saved ? accountForm : savedCard}
                ${d.saved && !d.editing ? `
                  <label class="${label}">Amount (GH₵)</label>
                  <div class="flex gap-2 mb-2">
                    <input type="number" inputmode="decimal" min="${CREATOR_MIN_WITHDRAWAL_GHS}" step="0.01" value="${escapeHtml(d.amount)}" oninput="setWithdrawField('amount', this.value)" placeholder="Minimum GH₵${CREATOR_MIN_WITHDRAWAL_GHS}" class="${input}">
                    <button onclick="withdrawAll()" class="px-4 rounded-2xl bg-gray-100 text-xs font-semibold flex-shrink-0">All</button>
                  </div>
                  <div class="text-[11px] text-gray-400 mb-5">The amount is set aside as soon as you ask. An admin approves it within ${PAID_SELLER_APPROVAL_HOURS} hours, then it is sent to your account.</div>
                  <button id="withdraw-submit-btn" onclick="submitWithdrawal()" class="w-full py-3 rounded-full text-white font-semibold text-sm" style="${creatorNavyBtn}">Request withdrawal</button>` : ''}
              </div>
            </div>`;
        }

        // ============================================================
        // Report this class / course
        // ============================================================
        let reportClassDraft = null;
        let reportClassBusy = false;

        function openReportClass(productType, productId, productName){
          reportClassDraft = { productType, productId, productName: productName || '', reason: '', details: '' };
          openOverlayFrom(currentOverlayKind === 'courseDetail' ? 'courseDetail' : 'classDetail', 'reportClass');
        }
        function setReportClassReason(r){ reportClassDraft.reason = r; creatorRerender('reportClass'); }
        function setReportClassDetails(v){ if (reportClassDraft) reportClassDraft.details = v; }

        async function submitClassReport(){
          if (reportClassBusy || !reportClassDraft) return;
          if (!reportClassDraft.reason) { openAppAlertModal('Please choose a reason for your report.'); return; }
          reportClassBusy = true;
          const btn = document.getElementById('report-class-submit-btn');
          if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = 'Sending…'; }
          try {
            const sb = getSupabaseClient(); const uid = await getCurrentUserId();
            if (!sb || !uid) throw new Error('signin');
            const d = reportClassDraft;
            const { error } = await sb.from('class_reports').insert({
              product_type: d.productType, product_id: d.productId, reporter_id: uid, reason: d.reason, details: (d.details || '').trim().slice(0, 1000), status: 'open',
            });
            if (error) throw error;
            notifyAllAdminsRemote({ type: 'class_reported', title: 'Class reported', message: `"${d.productName || 'A class'}" was reported (${d.reason}). Review it on the Admin Dashboard.` });
            reportClassBusy = false;
            overlayGoBack();
            openAppAlertModal('Thanks. An admin will take a look.', 'Report sent');
          } catch (e) {
            reportClassBusy = false;
            if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = 'Send report'; }
            openAppAlertModal("Couldn't send your report. Please try again.");
          }
        }

        function reportClassHTML(){
          const d = reportClassDraft;
          if (!d) { setTimeout(overlayGoBack, 0); return '<div class="flex-1"></div>'; }
          return `
            ${overlayHeader('Report ' + (d.productType === 'course' ? 'course' : 'class'), '20px', null, null, { center: true })}
            <div class="flex-1 overflow-y-auto px-5" style="padding-top:6px;padding-bottom:20px;">
              <div class="max-w-2xl mx-auto">
                ${d.productName ? `<div class="text-sm text-gray-500 mb-4 text-center">Reporting "<span class="font-semibold text-gray-800">${escapeHtml(d.productName)}</span>"</div>` : ''}
                <label class="text-xs font-bold text-gray-400 mb-2 block">What's wrong?</label>
                ${stitchChipRowHTML(CREATOR_REPORT_REASONS.map(([k, l]) => [k, l]), k => reportClassDraft.reason === k, 'setReportClassReason', true)}
                <label class="text-xs font-bold text-gray-400 mt-5 mb-1 block">Tell us more (optional)</label>
                <textarea oninput="setReportClassDetails(this.value)" rows="4" maxlength="1000" placeholder="What happened?" class="w-full bg-gray-100 rounded-2xl px-4 py-3 text-sm outline-none resize-none">${escapeHtml(d.details)}</textarea>
              </div>
            </div>
            <div class="flex-shrink-0 w-full px-5" style="padding-top:10px;padding-bottom:max(22px, env(safe-area-inset-bottom));">
              <div class="max-w-2xl mx-auto">
                <button id="report-class-submit-btn" onclick="submitClassReport()" class="w-full py-3 rounded-full text-white font-semibold text-sm" style="${creatorNavyBtn}">Send report</button>
              </div>
            </div>`;
        }
        // Shown on class and course pages for anyone who isn't the teacher.
        function reportClassButtonHTML(productType, id, name){
          return `<button onclick="openReportClass('${productType}','${escapeForJsAttr(id)}','${escapeForJsAttr(name || '')}')" class="w-full flex items-center justify-center gap-2 rounded-2xl py-2.5 mb-4 font-semibold text-xs text-gray-500 border border-gray-200 bg-white">${Icon('flag', 'w-3.5 h-3.5')} Report this ${productType === 'course' ? 'course' : 'class'}</button>`;
        }

        // ============================================================
        // Student receipts (Profile)
        // ============================================================
        let receiptsState = { loading: false, loaded: false, missing: false, rows: [] };
        function openReceipts(){
          openDashboard('receipts');
        }
        // Called silently at login (see prefetchLoginData) so the tab opens with data already there;
        // opening the tab later just refreshes in the background instead of showing "Loading...".
        async function loadReceipts(){
          if (receiptsState.inFlight) return receiptsState.inFlight;
          receiptsState.inFlight = loadReceiptsInner().finally(() => { receiptsState.inFlight = null; });
          return receiptsState.inFlight;
        }
        async function loadReceiptsInner(){
          receiptsState.loading = !receiptsState.loaded; receiptsState.missing = false;
          if (receiptsState.loading) creatorRerender('receipts');
          try {
            const sb = getSupabaseClient(); const uid = await getCurrentUserId();
            const { data, error } = await sb.from('payments').select('id, paystack_reference, product_type, product_id, gross_amount, status, paid_at').eq('buyer_id', uid).order('paid_at', { ascending: false }).limit(200);
            if (error && creatorStateMissing(error)) receiptsState.missing = true;
            receiptsState.rows = data || [];
            receiptsState.loaded = true;
          } catch (e) { receiptsState.missing = true; }
          receiptsState.loading = false;
          creatorRerender('receipts');
        }
        function copyReceiptRef(ref){
          try { navigator.clipboard.writeText(ref); openAppAlertModal('Reference copied.', 'Receipt'); } catch (e) { openAppAlertModal(ref, 'Reference'); }
        }
        function receiptsHTML(){
          return `
            ${overlayHeader('Receipts', '20px', null, null, { right: true })}
            <div class="flex-1 overflow-y-auto px-5" style="padding-bottom:40px;"><div class="max-w-2xl mx-auto pt-2">${receiptsBodyHTML()}</div></div>`;
        }
        // The receipts list on its own, so the Dashboard can show it as a tab.
        function receiptsBodyHTML(){
          const rows = receiptsState.rows;
          const body = receiptsState.loading && !receiptsState.loaded ? `<div class="text-center text-gray-400 text-sm py-8">Loading…</div>`
            : receiptsState.missing ? creatorEmpty('Receipts are not set up yet.')
            : !rows.length ? creatorEmpty('No purchases yet. Receipts for paid classes show up here.')
            : rows.map(r => `
              <div class="${creatorCard} p-4 mb-3">
                <div class="flex items-center justify-between mb-1">
                  <div class="font-semibold text-sm truncate pr-3">${escapeHtml(creatorProductName(r.product_type, r.product_id))}</div>
                  <div class="font-bold text-sm" style="color:${NAVY};">${ghs(r.gross_amount)}</div>
                </div>
                <div class="flex items-center justify-between text-[11px] text-gray-400">
                  <span>${creatorDate(r.paid_at)} ${walletStatusChip(r.status)}</span>
                  <button onclick="copyReceiptRef('${escapeForJsAttr(r.paystack_reference || '')}')" class="font-semibold" style="color:${ROYAL};">Copy reference</button>
                </div>
              </div>`).join('');
          return body;
        }

        // ============================================================
        // Admin dashboard tabs
        // ============================================================
        const CREATOR_ADMIN_TABS = ['creators', 'payouts', 'classreports', 'payments', 'money', 'cancellations', 'audit'];
        let adminCreatorData = { loading: false, loaded: false, missing: [], apps: [], creators: [], payouts: [], reports: [], payments: [], ledger: [], audit: [], cancels: [], people: {} };
        let adminPaymentSearch = '';
        let adminCreatorOpenId = null;
        let adminCreatorOpenClasses = {};
        let adminPayoutRejectId = null;

        // One row per person: their creator_profiles row if they have one, otherwise a pending
        // application
        function adminCreatorRows(){
          const d = adminCreatorData;
          const byUser = {};
          d.creators.forEach(c => { byUser[c.user_id] = Object.assign({}, c); });
          d.apps.forEach(a => {
            if (!byUser[a.user_id]) byUser[a.user_id] = { user_id: a.user_id, status: 'pending' };
            if ((byUser[a.user_id].status || 'pending') === 'pending') byUser[a.user_id].plan = a.creator_content_plan;
          });
          const order = { pending: 0, approved: 1, suspended: 2 };
          return Object.values(byUser).sort((a, b) => (order[a.status || 'pending'] - order[b.status || 'pending']));
        }

        function creatorAdminTabs(){
          const d = adminCreatorData;
          const pendingApps = adminCreatorRows().filter(c => (c.status || 'pending') === 'pending').length;
          const pendingPayouts = d.payouts.filter(p => p.status === 'pending_approval').length;
          const openReports = d.reports.filter(r => r.status === 'open' || r.status === 'reviewing').length;
          const n = x => x ? ` (${x})` : '';
          return [['creators', 'Creators' + n(pendingApps)], ['payouts', 'Payouts' + n(pendingPayouts)], ['classreports', 'Class reports' + n(openReports)], ['payments', 'Payments'], ['money', 'Money'], ['cancellations', 'Cancellations' + n(d.cancels.filter(c => c.status === 'new').length)], ['audit', 'Audit log']];
        }

        async function loadAdminCreatorData(){
          const sb = getSupabaseClient();
          if (!sb || !isCurrentUserAdmin()) return;
          if (adminCreatorData.loading) return;
          adminCreatorData.loading = true;
          if (!adminCreatorData.loaded) refreshAdminDashboardDom();
          const q = [
            ['apps', sb.from(PROFILES_TABLE).select('user_id, creator_content_plan, creator_applied_at').eq('creator_wants_paid', true).order('creator_applied_at', { ascending: false }).limit(200)],
            ['creators', sb.from('creator_profiles').select('*').limit(500)],
            ['payouts', sb.from('payouts').select('*').order('requested_at', { ascending: false }).limit(300)],
            ['reports', sb.from('class_reports').select('*').order('created_at', { ascending: false }).limit(300)],
            ['payments', sb.from('payments').select('*').order('paid_at', { ascending: false }).limit(500)],
            ['ledger', sb.from('wallet_ledger').select('creator_id, payment_id, type, amount, state').limit(5000)],
            ['cancels', sb.from('career_cancel_reasons').select('*').order('created_at', { ascending: false }).limit(300)],
            ['audit', sb.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(150)],
          ];
          const results = await Promise.all(q.map(([, p]) => p.then(r => r, e => ({ data: null, error: e }))));
          const missing = [];
          q.forEach(([key], i) => {
            const r = results[i];
            if (r.error && key !== 'apps') missing.push(key);
            adminCreatorData[key] = r.data || [];
          });
          adminCreatorData.missing = missing;
          const d = adminCreatorData;
          const ids = [].concat(d.apps.map(a => a.user_id), d.creators.map(c => c.user_id), d.payouts.map(p => p.creator_id), d.reports.map(r => r.reporter_id), d.payments.map(p => p.buyer_id), d.payments.map(p => p.creator_id), d.audit.map(a => a.admin_id), d.cancels.map(c => c.user_id));
          d.people = await creatorPeopleByIds(ids);
          d.loading = false; d.loaded = true;
          refreshAdminDashboardDom();
        }

        function creatorBalanceFor(uid){
          const L = adminCreatorData.ledger.filter(r => r.creator_id === uid);
          return { available: sumBy(L, r => r.state === 'available'), pending: sumBy(L, r => r.state === 'pending'), lifetime: sumBy(L, r => r.type === 'sale') };
        }
        function creatorOpenReportsCount(uid){
          const productIds = new Set(adminCreatorData.payments.filter(p => p.creator_id === uid).map(p => p.product_id));
          return adminCreatorData.reports.filter(r => (r.status === 'open' || r.status === 'reviewing') && productIds.has(r.product_id)).length;
        }

        async function creatorAdminRun(fn, body, confirmTitle, confirmMsg, confirmLabel){
          const go = async () => {
            try { await creatorApi(fn, body); await loadAdminCreatorData(); loadCreatorState(); }
            catch (e) { openAppAlertModal(e.message, "That didn't work"); }
          };
          if (confirmTitle) openAppConfirmModal(confirmTitle, confirmMsg, confirmLabel || 'Confirm', go);
          else await go();
        }
        const adminDo = (action, payload, title, msg, label) => creatorAdminRun('admin-actions', Object.assign({ action }, payload), title, msg, label);

        function adminCreatorRowActions(c){
          const uid = escapeForJsAttr(c.user_id);
          const btn = (cls, onclick, label) => `<button onclick="${onclick}" class="flex-1 py-2 rounded-full text-xs font-semibold ${cls}">${label}</button>`;
          const out = [];
          if (c.status === 'pending' || !c.status) {
            out.push(btn('text-white', `adminDo('approve_creator',{userId:'${uid}'},'Approve this creator?','They can create paid classes and earn ${creatorShareLabel()} of each sale.','Approve')" style="${creatorNavyBtn}`, 'Approve'));
            out.push(btn('bg-gray-100 text-gray-600', `adminDo('reject_creator',{userId:'${uid}'},'Reject this application?','They are told it was not approved.','Reject')`, 'Reject'));
          } else if (c.status === 'approved') {
            out.push(btn('bg-amber-50 text-amber-700', `adminDo('${c.payouts_held ? 'release_payouts' : 'hold_payouts'}',{userId:'${uid}'},'${c.payouts_held ? 'Release payouts?' : 'Hold payouts?'}','${c.payouts_held ? 'They can withdraw again.' : 'They cannot withdraw until you release them.'}','${c.payouts_held ? 'Release' : 'Hold'}')`, c.payouts_held ? 'Release payouts' : 'Hold payouts'));
            out.push(btn('bg-red-50 text-red-500', `adminDo('suspend_creator',{userId:'${uid}'},'Suspend this creator?','Their classes stop selling and they cannot withdraw.','Suspend')`, 'Suspend'));
          } else if (c.status === 'suspended') {
            out.push(btn('text-white', `adminDo('reinstate_creator',{userId:'${uid}'},'Reinstate this creator?','They can sell and withdraw again.','Reinstate')" style="${creatorNavyBtn}`, 'Reinstate'));
          }
          return `<div class="flex gap-2 mt-3">${out.join('')}</div>`;
        }

        async function toggleAdminCreator(uid){
          adminCreatorOpenId = adminCreatorOpenId === uid ? null : uid;
          refreshAdminDashboardDom();
          if (adminCreatorOpenId && !adminCreatorOpenClasses[uid]) {
            try {
              const sb = getSupabaseClient();
              const { data } = await sb.from(CLASSES_TABLE).select('id, data').eq('teacher_id', uid).limit(100);
              adminCreatorOpenClasses[uid] = (data || []).map(r => ({ id: r.id, name: (r.data && r.data.name) || 'Class', paused: !!(r.data && r.data.isPaused) }));
            } catch (e) { adminCreatorOpenClasses[uid] = []; }
            refreshAdminDashboardDom();
          }
        }

        function adminCreatorCardHTML(c){
          const d = adminCreatorData;
          const b = creatorBalanceFor(c.user_id);
          const sales = d.payments.filter(p => p.creator_id === c.user_id && p.status === 'paid');
          const students = new Set(sales.map(p => p.buyer_id)).size;
          const reports = creatorOpenReportsCount(c.user_id);
          const open = adminCreatorOpenId === c.user_id;
          const statusChip = { pending: ['Waiting', 'bg-amber-50 text-amber-600'], approved: ['Approved', 'bg-emerald-50 text-emerald-600'], suspended: ['Suspended', 'bg-red-50 text-red-500'] }[c.status || 'pending'];
          const classes = adminCreatorOpenClasses[c.user_id];
          return `
            <div class="${creatorCard} p-4 mb-3">
              <button onclick="toggleAdminCreator('${escapeForJsAttr(c.user_id)}')" class="w-full text-left">
                <div class="flex items-center justify-between">
                  <div class="font-semibold text-sm truncate pr-3">${escapeHtml(personName(d.people, c.user_id))}</div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusChip[1]}">${statusChip[0]}${c.payouts_held ? ' · Payouts held' : ''}</span>
                </div>
                ${c.status === 'approved' ? `<div class="text-[11px] text-gray-400 mt-1">Earned ${ghs(b.lifetime)} · ${students} student${students === 1 ? '' : 's'}${reports ? ` · <span class="text-red-500 font-semibold">${reports} open report${reports === 1 ? '' : 's'}</span>` : ''}</div>` : ''}
              </button>
              ${c.plan ? `<div class="text-xs text-gray-500 mt-2 whitespace-pre-line">${escapeHtml(String(c.plan).slice(0, 500))}</div>` : ''}
              ${open && c.status === 'approved' ? `
                <div class="mt-3 pt-3 border-t border-gray-100 text-xs">
                  <div class="grid grid-cols-3 gap-2 text-center mb-3">
                    <div><div class="text-[10px] text-gray-400">Available</div><div class="font-semibold">${ghs(b.available)}</div></div>
                    <div><div class="text-[10px] text-gray-400">Pending</div><div class="font-semibold">${ghs(b.pending)}</div></div>
                    <div><div class="text-[10px] text-gray-400">Lifetime</div><div class="font-semibold">${ghs(b.lifetime)}</div></div>
                  </div>
                  <div class="font-semibold text-gray-500 mb-1">Classes</div>
                  ${classes === undefined ? '<div class="text-gray-400 mb-2">Loading…</div>' : classes.length ? classes.map(k => `
                    <div class="flex items-center justify-between py-1.5"><span class="truncate pr-2">${escapeHtml(k.name)}${k.paused ? ' <span class="text-red-500">(paused)</span>' : ''}</span>
                      <button onclick="adminDo('${k.paused ? 'unpause_class' : 'pause_class'}',{classId:'${escapeForJsAttr(k.id)}'},'${k.paused ? 'Resume this class?' : 'Pause this class?'}','${k.paused ? 'It can be joined and bought again.' : 'It stops selling until you resume it.'}','${k.paused ? 'Resume' : 'Pause'}')" class="text-xs font-semibold flex-shrink-0" style="color:${ROYAL};">${k.paused ? 'Resume' : 'Pause'}</button></div>`).join('') : '<div class="text-gray-400 mb-2">No classes yet.</div>'}
                  <div class="font-semibold text-gray-500 mt-3 mb-1">Recent payments</div>
                  ${sales.slice(0, 5).map(p => `<div class="flex justify-between py-1"><span class="truncate pr-2">${escapeHtml(personName(d.people, p.buyer_id))} · ${creatorDate(p.paid_at)}</span><span class="font-semibold flex-shrink-0">${ghs(p.gross_amount)}</span></div>`).join('') || '<div class="text-gray-400">No sales yet.</div>'}
                </div>` : ''}
              ${adminCreatorRowActions(c)}
            </div>`;
        }

        function adminCreatorsTabHTML(){
          const rows = adminCreatorRows();
          return rows.length ? rows.map(adminCreatorCardHTML).join('') : creatorEmpty('No creators or applications yet.');
        }

        function adminPayoutCardHTML(p){
          const d = adminCreatorData;
          const b = creatorBalanceFor(p.creator_id);
          const prof = d.creators.find(c => c.user_id === p.creator_id) || {};
          const reports = creatorOpenReportsCount(p.creator_id);
          const waiting = p.status === 'pending_approval';
          const nameOk = prof.account_name && normalizeName(prof.account_name) === normalizeName(personName(d.people, p.creator_id));
          const id = escapeForJsAttr(p.id);
          return `
            <div class="${creatorCard} p-4 mb-3">
              <div class="flex items-center justify-between">
                <div class="font-semibold text-sm truncate pr-3">${escapeHtml(personName(d.people, p.creator_id))}</div>
                <div class="font-bold" style="color:${NAVY};">${ghs(p.amount)}</div>
              </div>
              <div class="text-[11px] text-gray-400 mt-1">Requested ${creatorDate(p.requested_at)} ${walletStatusChip(p.status)}</div>
              <div class="text-xs text-gray-500 mt-2">
                Pay to ${escapeHtml(prof.account_name || 'no account saved')} · ${escapeHtml(prof.provider || '')} ${escapeHtml(prof.account_number || '')}
                ${prof.account_name ? `<span class="${nameOk ? 'text-emerald-600' : 'text-red-500 font-semibold'}"> · name ${nameOk ? 'matches profile' : 'does NOT match profile'}</span>` : ''}
              </div>
              ${(() => {
                if (!prof.payout_details_changed_at) return '';
                const days = Math.floor((Date.now() - new Date(prof.payout_details_changed_at).getTime()) / 86400000);
                const recent = days < 7;
                return `<div class="text-xs mt-1 ${recent ? 'text-amber-600 font-semibold' : 'text-gray-500'}">Payout account last changed ${creatorDate(prof.payout_details_changed_at)} (${days <= 0 ? 'today' : days === 1 ? '1 day ago' : days + ' days ago'})${recent ? ' · double-check before approving' : ''}</div>`;
              })()}
              <div class="text-xs text-gray-500 mt-1">Balance: ${ghs(b.available)} available, ${ghs(b.pending)} pending · ${reports ? `<span class="text-red-500 font-semibold">${reports} open report${reports === 1 ? '' : 's'}</span>` : 'no open reports'}${prof.payouts_held ? ' · <span class="text-amber-600 font-semibold">payouts held</span>' : ''}</div>
              ${p.failure_reason ? `<div class="text-xs text-red-500 mt-1">${escapeHtml(p.failure_reason)}</div>` : ''}
              ${waiting ? (adminPayoutRejectId === p.id ? `
                <textarea id="payout-reject-reason" rows="2" placeholder="Why? The creator will see this." class="w-full mt-3 bg-gray-100 rounded-2xl px-3 py-2 text-xs outline-none resize-none"></textarea>
                <div class="flex gap-2 mt-2">
                  <button onclick="adminPayoutRejectId=null;refreshAdminDashboardDom()" class="flex-1 py-2 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Back</button>
                  <button onclick="adminRejectPayout('${id}')" class="flex-1 py-2 rounded-full text-xs font-semibold bg-red-50 text-red-500">Reject</button>
                </div>` : `
                <div class="flex gap-2 mt-3">
                  <button onclick="creatorAdminRun('approve-payout',{payoutId:'${id}'},'Approve ${ghs(p.amount)}?','Stitch sends it to ${escapeForJsAttr(prof.account_name || 'their account')} to their account.','Approve')" class="flex-1 py-2 rounded-full text-xs font-semibold text-white" style="${creatorNavyBtn}">Approve</button>
                  <button onclick="adminPayoutRejectId='${id}';refreshAdminDashboardDom()" class="flex-1 py-2 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Reject</button>
                </div>`) : ''}
            </div>`;
        }
        function adminRejectPayout(id){
          const el = document.getElementById('payout-reject-reason');
          const reason = el ? el.value.trim() : '';
          if (!reason) { openAppAlertModal('Add a short reason so the creator knows why.'); return; }
          adminPayoutRejectId = null;
          adminDo('reject_payout', { payoutId: id, reason });
        }
        function adminPayoutsTabHTML(){
          const rows = adminCreatorData.payouts;
          if (!rows.length) return creatorEmpty('No withdrawal requests yet.');
          const waiting = rows.filter(p => p.status === 'pending_approval');
          const rest = rows.filter(p => p.status !== 'pending_approval').slice(0, 40);
          return (waiting.length ? waiting.map(adminPayoutCardHTML).join('') : creatorEmpty('Nothing waiting for approval.')) +
            (rest.length ? `<div class="text-xs font-semibold text-gray-400 mt-5 mb-2">Earlier requests</div>${rest.map(adminPayoutCardHTML).join('')}` : '');
        }

        function adminClassReportCardHTML(r){
          const d = adminCreatorData;
          const pay = d.payments.find(p => p.product_id === r.product_id);
          const creatorId = pay && pay.creator_id;
          const open = r.status === 'open' || r.status === 'reviewing';
          const id = escapeForJsAttr(r.id);
          const act = (cls, onclick, label) => `<button onclick="${onclick}" class="flex-1 py-2 rounded-full text-xs font-semibold ${cls}">${label}</button>`;
          return `
            <div class="${creatorCard} p-4 mb-3">
              <div class="flex items-center justify-between">
                <div class="font-semibold text-sm truncate pr-3">${escapeHtml(creatorProductName(r.product_type, r.product_id))}</div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${open ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}">${escapeHtml(r.status)}</span>
              </div>
              <div class="text-[11px] text-gray-400 mt-1">${escapeHtml(r.reason)} · reported by ${escapeHtml(personName(d.people, r.reporter_id))} · ${creatorDate(r.created_at)}</div>
              ${r.details ? `<div class="text-xs text-gray-600 mt-2 whitespace-pre-line">${escapeHtml(r.details)}</div>` : ''}
              ${open ? `<div class="flex gap-2 mt-3 flex-wrap">
                ${act('bg-amber-50 text-amber-700', `adminDo('pause_class',{classId:'${escapeForJsAttr(r.product_id)}',reportId:'${id}'},'Pause this class?','It stops selling until you resume it.','Pause')`, 'Pause class')}
                ${creatorId ? act('bg-amber-50 text-amber-700', `adminDo('hold_payouts',{userId:'${escapeForJsAttr(creatorId)}',reportId:'${id}'},'Hold this creator\\'s payouts?','They cannot withdraw until you release them.','Hold')`, 'Hold payouts') : ''}
                ${act('bg-gray-100 text-gray-600', `adminDo('dismiss_report',{reportId:'${id}'})`, 'Dismiss')}
              </div>` : ''}
            </div>`;
        }
        function adminClassReportsTabHTML(){
          const rows = adminCreatorData.reports;
          if (!rows.length) return creatorEmpty('No class reports.');
          const open = rows.filter(r => r.status === 'open' || r.status === 'reviewing');
          const closed = rows.filter(r => !(r.status === 'open' || r.status === 'reviewing')).slice(0, 30);
          return (open.length ? open.map(adminClassReportCardHTML).join('') : creatorEmpty('No open reports.')) +
            (closed.length ? `<div class="text-xs font-semibold text-gray-400 mt-5 mb-2">Closed</div>${closed.map(adminClassReportCardHTML).join('')}` : '');
        }

        function setAdminPaymentSearch(v){
          adminPaymentSearch = v;
          const el = document.getElementById('admin-payments-list');
          if (el) el.innerHTML = adminPaymentsListHTML();
        }
        function adminPaymentsListHTML(){
          const d = adminCreatorData;
          const q = adminPaymentSearch.trim().toLowerCase();
          const rows = d.payments.filter(p => !q || [p.paystack_reference, personName(d.people, p.buyer_id), personName(d.people, p.creator_id), creatorProductName(p.product_type, p.product_id)].join(' ').toLowerCase().includes(q)).slice(0, 100);
          if (!rows.length) return creatorEmpty(q ? 'No payments match that search.' : 'No payments yet.');
          return rows.map(p => `
            <div class="${creatorCard} p-4 mb-3">
              <div class="flex items-center justify-between">
                <div class="font-semibold text-sm truncate pr-3">${escapeHtml(creatorProductName(p.product_type, p.product_id))}</div>
                <div class="font-bold" style="color:${NAVY};">${ghs(p.gross_amount)}</div>
              </div>
              <div class="text-[11px] text-gray-400 mt-1">${escapeHtml(personName(d.people, p.buyer_id))} → ${escapeHtml(personName(d.people, p.creator_id))} · ${creatorDate(p.paid_at)} ${walletStatusChip(p.status)}</div>
              <div class="text-[11px] text-gray-500 mt-1">Stitch ${ghs(p.stitch_fee)} · Creator ${ghs(p.creator_net)} · ${escapeHtml(p.paystack_reference || '')}</div>
              ${p.status === 'paid' ? `<button onclick="creatorAdminRun('refund-payment',{paymentId:'${escapeForJsAttr(p.id)}'},'Refund ${ghs(p.gross_amount)}?','The student is refunded and the creator\\'s wallet is reduced. If they already withdrew it, their wallet goes negative.','Refund')" class="mt-3 text-xs font-semibold text-red-500">Refund</button>` : ''}
            </div>`).join('');
        }
        function adminPaymentsTabHTML(){
          return `<input type="search" value="${escapeHtml(adminPaymentSearch)}" oninput="setAdminPaymentSearch(this.value)" placeholder="Search by name, class or reference" class="w-full mb-3 px-4 py-2.5 rounded-2xl bg-gray-100 text-sm outline-none">
            <div id="admin-payments-list">${adminPaymentsListHTML()}</div>`;
        }

        function adminMoneyTabHTML(){
          const d = adminCreatorData;
          const paid = d.payments.filter(p => p.status === 'paid');
          const totalSales = paid.reduce((n, p) => n + Number(p.gross_amount || 0), 0);
          const stitchRevenue = paid.reduce((n, p) => n + Number(p.stitch_fee || 0), 0);
          const owed = sumBy(d.ledger, r => r.state === 'available' || r.state === 'pending');
          const pendingPayouts = d.payouts.filter(p => p.status === 'pending_approval');
          const card = (label, value, sub) => `<div class="${creatorCard} p-4"><div class="text-[11px] text-gray-400">${label}</div><div class="text-lg font-bold" style="color:${NAVY};">${value}</div>${sub ? `<div class="text-[11px] text-gray-400 mt-1">${sub}</div>` : ''}</div>`;
          return `<div class="grid grid-cols-2 gap-3">
              ${card('Total sales', ghs(totalSales), paid.length + ' payment' + (paid.length === 1 ? '' : 's'))}
              ${card('Stitch revenue', ghs(stitchRevenue), stitchShareLabel() + ' of sales')}
              ${card('Owed to creators', ghs(owed), 'Pending + available')}
              ${card('Payouts waiting', String(pendingPayouts.length), ghs(pendingPayouts.reduce((n, p) => n + Number(p.amount || 0), 0)))}
            </div>
            <div class="text-[11px] text-gray-400 mt-3">Based on the latest ${d.payments.length} payments. Check totals against your payment records before paying out.</div>`;
        }

        // Why people cancelled Stitch Bot (written by careerCancelSubmit in jobs.js)
        function adminCancellationsTabHTML(){
          const rows = adminCreatorData.cancels;
          if (!rows.length) return creatorEmpty('No cancellations yet. Reasons show up here when someone cancels Stitch Bot.');
          const summary = chartDonutCardHTML('Why people cancel', chartCountBy(rows, r => r.reason_label || 'Skipped'), rows.length, 'cancelled') +
            chartColumnsCardHTML('Cancellations per week', chartTimeline(rows, r => r.created_at, () => 1, 8, 7), '#ef4444', null, 'Last 8 weeks');
          const cards = rows.map(r => `
            <div class="${creatorCard} p-4 mb-3">
              <div class="flex items-start justify-between gap-3">
                <div class="font-semibold text-sm">${escapeHtml(r.reason_label || 'Skipped')}</div>
                ${r.status === 'new' ? `<button onclick="markCancelReasonRead(${r.id})" class="text-xs font-semibold flex-shrink-0" style="color:#1e90ff;">Mark read</button>` : `<span class="text-xs text-gray-400 flex-shrink-0">Read</span>`}
              </div>
              ${r.detail ? `<div class="text-sm text-gray-700 mt-2" style="white-space:pre-wrap;">${escapeHtml(r.detail)}</div>` : ''}
              <div class="text-[11px] text-gray-400 mt-2">${escapeHtml(personName(adminCreatorData.people, r.user_id))} · ${creatorDate(r.created_at)}${r.plan ? ' · ' + escapeHtml(r.plan) : ''}</div>
            </div>`).join('');
          return summary + cards;
        }
        async function markCancelReasonRead(id){
          const sb = getSupabaseClient(); if (!sb || !isCurrentUserAdmin()) return;
          const row = adminCreatorData.cancels.find(c => c.id === id); if (row) row.status = 'read';
          refreshAdminDashboardDom();
          try { await sb.from('career_cancel_reasons').update({ status: 'read' }).eq('id', id); } catch (e) {}
        }

        function adminAuditTabHTML(){
          const rows = adminCreatorData.audit;
          if (!rows.length) return creatorEmpty('No admin actions logged yet.');
          return rows.map(a => `
            <div class="${creatorCard} p-3 mb-2 text-xs">
              <div class="font-semibold">${escapeHtml(String(a.action || '').replace(/_/g, ' '))}</div>
              <div class="text-gray-400 mt-0.5">${escapeHtml(personName(adminCreatorData.people, a.admin_id))} · ${creatorDate(a.created_at)} · ${escapeHtml(String(a.target || '').slice(0, 60))}</div>
            </div>`).join('');
        }

        // Charts shown at the top of each creator/money tab
        function adminCreatorChartsHTML(tab){
          const d = adminCreatorData;
          const typeLabel = p => String(p.product_type || 'other').replace(/_/g, ' ').replace(/^./, ch => ch.toUpperCase());
          const paid = d.payments.filter(p => p.status === 'paid');
          const money = v => chartCompact(v);
          const mu = x => Number(x || 0) / CREATOR_AMOUNT_DIVISOR; // amounts are stored in minor units
          if (tab === 'creators') {
            const rows = adminCreatorRows();
            return chartDonutCardHTML('Creators by status', chartCountBy(rows, r => ({ pending: 'Pending', approved: 'Approved', suspended: 'Suspended' }[r.status || 'pending'] || 'Other'), { Pending: '#f59e0b', Approved: '#059669', Suspended: '#ef4444' }), rows.length, 'people');
          }
          if (tab === 'payouts') {
            const lab = { pending_approval: 'Waiting', approved: 'Approved', paid: 'Paid', rejected: 'Rejected', failed: 'Failed' };
            return chartDonutCardHTML('Withdrawals by status', chartCountBy(d.payouts, p => lab[p.status] || String(p.status || 'Other').replace(/_/g, ' ')), d.payouts.length, 'requests') +
              chartColumnsCardHTML('Withdrawal requests per week', chartTimeline(d.payouts, p => p.requested_at, p => mu(p.amount), 8, 7), '#4f46e5', chartCompact, 'Amount in GH₵, last 8 weeks');
          }
          if (tab === 'classreports') {
            return chartDonutCardHTML('Class reports by status', chartCountBy(d.reports, r => String(r.status || 'open').replace(/^./, ch => ch.toUpperCase())), d.reports.length, 'reports');
          }
          if (tab === 'payments') {
            return chartColumnsCardHTML('Sales per day', chartTimeline(paid, p => p.paid_at, p => mu(p.gross_amount), 14, 1), '#1e90ff', money, 'GH₵, last 14 days') +
              chartDonutCardHTML('What people bought', chartCountBy(paid, typeLabel), paid.length, 'payments');
          }
          if (tab === 'money') {
            const gross = paid.reduce((n, p) => n + mu(p.gross_amount), 0);
            const fee = paid.reduce((n, p) => n + mu(p.stitch_fee), 0);
            return chartLineCardHTML('Sales per week', chartTimeline(paid, p => p.paid_at, p => mu(p.gross_amount), 8, 7), 'Last 8 weeks') +
              chartColumnsCardHTML('Stitch revenue per week', chartTimeline(paid, p => p.paid_at, p => mu(p.stitch_fee), 8, 7), '#059669', money, 'GH₵, last 8 weeks') +
              (gross > 0 ? chartDonutCardHTML('Who gets the money', [{ label: 'Creators', n: Math.max(0, gross - fee), color: '#1e90ff' }, { label: 'Stitch', n: fee, color: '#059669' }], Math.round(fee / gross * 100) + '%', 'Stitch share') : '') +
              chartDonutCardHTML('Sales by type', chartCountBy(paid, typeLabel), paid.length, 'payments');
          }
          if (tab === 'audit') {
            return chartBarsCardHTML('Most common admin actions', chartCountBy(d.audit, a => String(a.action || 'other').replace(/_/g, ' ')), 'Latest ' + d.audit.length);
          }
          return '';
        }

        // Called from adminBodyHTML() in jobs.js for the tabs above.
        function creatorAdminBodyHTML(tab){
          const d = adminCreatorData;
          if (d.loading && !d.loaded) return `<div class="text-center text-gray-400 text-sm py-8">Loading…</div>`;
          const note = d.missing.length ? `<div class="bg-amber-50 text-amber-700 text-xs rounded-2xl p-3 mb-3">Not set up yet: ${d.missing.map(m => m.replace('classreports', 'class reports')).join(', ')}.</div>` : '';
          const body = tab === 'creators' ? adminCreatorsTabHTML()
            : tab === 'payouts' ? adminPayoutsTabHTML()
            : tab === 'classreports' ? adminClassReportsTabHTML()
            : tab === 'payments' ? adminPaymentsTabHTML()
            : tab === 'money' ? adminMoneyTabHTML()
            : tab === 'cancellations' ? adminCancellationsTabHTML()
            : adminAuditTabHTML();
          let charts = '';
          try { charts = adminCreatorChartsHTML(tab); } catch (e) { charts = ''; }
          return note + charts + body;
        }
