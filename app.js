(() => {
  // ===== Pengaturan =====
  // HAENO AI backend. Groq secrets remain on the Vercel server.
  // This endpoint accepts POST JSON { message: string } and returns { reply: string }.
  // Supabase public URL is configured; add the project's publishable/anon key below to enable password recovery.
  const CONFIG = { apiUrl: 'https://haeno-backend1.vercel.app/api/chat', headers: {}, timeoutMs: 60000, supabaseUrl: 'https://ywocpjsxrdoiweoezfsh.supabase.co', supabaseAnonKey: 'ADD_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE' };

  const $ = (s) => document.querySelector(s);
  const authView = $('#authView'), appView = $('#appView');
  const authForm = $('#authForm'), authError = $('#authError');
  const nameWrap = $('#nameWrap'), nameField = $('#nameField');
  const emailField = $('#emailField'), passwordField = $('#passwordField');
  const authTitle = $('#authTitle'), authSubtitle = $('#authSubtitle'), authSubmitText = $('#authSubmitText');
  const tabs = [...document.querySelectorAll('.tab')];
  const rightSidebar = $('#rightSidebar'), welcomeScreen = $('#welcomeScreen'), messages = $('#messages');
  const promptInput = $('#promptInput'), historyList = $('#historyList');
  let authMode = 'login', currentUser = null, activeChatId = null, chats = [], toastTimer;
  let loginTransitionRunning = false, transitionFrame = 0;

  const updateAuthViewport = () => {
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--haeno-visible-height', `${Math.round(height)}px`);
    const active = document.activeElement;
    const authFieldFocused = authView.contains(active) && active && /^(INPUT|TEXTAREA)$/.test(active.tagName);
    const keyboardLikelyOpen = Boolean(authFieldFocused && viewport && window.innerHeight - viewport.height > 100);
    document.body.classList.toggle('keyboard-open', keyboardLikelyOpen);
  };
  window.addEventListener('resize', updateAuthViewport, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateAuthViewport, { passive: true });
  document.addEventListener('focusin', updateAuthViewport);
  document.addEventListener('focusout', () => window.setTimeout(updateAuthViewport, 90));
  updateAuthViewport();

  const safeParse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
  const userKey = (email) => 'haeno_chats_' + email.toLowerCase();
  const getUsers = () => safeParse(localStorage.getItem('haeno_users'), {});
  const showToast = (message) => {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  };
  const setMode = (mode) => {
    authMode = mode; authError.textContent = ''; authError.classList.remove('success');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    nameWrap.classList.toggle('hidden', mode !== 'register');
    $('#nameLabel').classList.toggle('hidden', mode !== 'register');
    authTitle.textContent = mode === 'login' ? 'Welcome to HAENO' : 'Create your space';
    authSubtitle.textContent = mode === 'login' ? 'Continue the conversations on your mind.' : 'One account for all your big ideas.';
    authSubmitText.textContent = mode === 'login' ? 'Enter workspace' : 'Create account & start';
    passwordField.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  };
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  $('#resetPasswordBtn').addEventListener('click', async () => {
    authError.classList.remove('success');
    const email = emailField.value.trim().toLowerCase();
    if (!email) { authError.textContent = 'Enter your email address first, then select Forgot password.'; emailField.focus(); return; }
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey || CONFIG.supabaseAnonKey === 'ADD_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE') {
      authError.textContent = 'Supabase password recovery is not configured yet. Add your Supabase publishable/anon key in app.js CONFIG.'; return;
    }
    const btn = $('#resetPasswordBtn'); btn.disabled = true; btn.textContent = 'Sending link…';
    try {
      const response = await fetch(CONFIG.supabaseUrl.replace(/\/$/, '') + '/auth/v1/recover', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CONFIG.supabaseAnonKey },
        body: JSON.stringify({ email, gotrue_meta_security: {} })
      });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.msg || detail.message || 'Request failed. Check your Supabase configuration.'); }
      authError.textContent = 'If the email is registered, a password reset link will be sent. Check your inbox and spam folder.'; authError.classList.add('success');
    } catch (err) { authError.textContent = err.message || 'Could not send the reset link.'; }
    finally { btn.disabled = false; btn.textContent = 'Forgot password?'; }
  });

  // Theme accent presets: the workspace remains dark; only neon/accent colors change.
  const themePresets = {
    blue: { accent:'#4aa8ff', accent2:'#7b7cff', glow:'rgba(42,139,255,.24)', line:'rgba(87,164,255,.22)' },
    teal: { accent:'#35e0c0', accent2:'#6affcf', glow:'rgba(27,220,180,.22)', line:'rgba(53,224,192,.22)' },
    crimson: { accent:'#e43b58', accent2:'#ff6477', glow:'rgba(210,30,65,.23)', line:'rgba(228,59,88,.24)' },
    white: { accent:'#f2f5ff', accent2:'#b9c7df', glow:'rgba(210,225,255,.18)', line:'rgba(225,234,255,.23)' }
  };
  const applyTheme = (name, animate = false) => {
    const chosen = 'teal', t = themePresets.teal;
    document.documentElement.dataset.theme = chosen;
    Object.entries(t).forEach(([key, value]) => document.documentElement.style.setProperty('--theme-' + key, value));
    document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.theme === chosen));
    try { localStorage.setItem('haeno_theme', chosen); } catch {}
    if (animate) {
      const overlay = $('#themeLoading'); overlay.classList.remove('hidden');
      overlay.classList.add('visible'); window.setTimeout(() => { overlay.classList.remove('visible'); window.setTimeout(() => overlay.classList.add('hidden'), 260); }, 850);
    }
  };
  // Theme controls were intentionally removed from the sidebar. Keep the theme fixed to teal
  // and guard optional legacy elements so a missing settings button cannot stop the whole app.
  const themeBtn = $('#themeSettingsBtn'), themePopup = $('#themePopup');
  if (themeBtn && themePopup) {
    themeBtn.addEventListener('click', () => { const open = themePopup.classList.contains('hidden'); themePopup.classList.toggle('hidden', !open); themeBtn.setAttribute('aria-expanded', String(open)); });
    document.querySelectorAll('.theme-option').forEach(b => b.addEventListener('click', () => { applyTheme(b.dataset.theme, true); themePopup.classList.add('hidden'); themeBtn.setAttribute('aria-expanded', 'false'); }));
    document.addEventListener('click', e => { if (!themePopup.contains(e.target) && !themeBtn.contains(e.target)) { themePopup.classList.add('hidden'); themeBtn.setAttribute('aria-expanded', 'false'); } });
  }
  applyTheme('teal');
  // Subtle teal starfall: particles travel diagonally from upper-left to lower-right.
  (() => {
    const canvas = $('#quantumCanvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    let w=0,h=0,dpr=1, stars=[], raf=0;
    const resize = () => {
      dpr=Math.min(window.devicePixelRatio||1,1.5); w=window.innerWidth; h=window.innerHeight;
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr); canvas.style.width=w+'px'; canvas.style.height=h+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const count=Math.min(44,Math.max(22,Math.floor(w*h/22000)));
      stars=Array.from({length:count},()=>({x:Math.random()*w,y:Math.random()*h,r:.55+Math.random()*1.35,v:.28+Math.random()*.62,tail:5+Math.random()*12,alpha:.2+Math.random()*.45}));
    };
    const draw=()=>{
      ctx.clearRect(0,0,w,h); const accent=getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim()||'#35e0c0';
      stars.forEach(s=>{
        s.x+=s.v*.72; s.y+=s.v*1.08;
        if(s.x>w+14||s.y>h+14){s.x=-Math.random()*w*.18;s.y=-Math.random()*24;}
        ctx.globalAlpha=s.alpha; ctx.strokeStyle=accent; ctx.lineWidth=.7; ctx.beginPath(); ctx.moveTo(s.x-s.tail*.55,s.y-s.tail*.8); ctx.lineTo(s.x,s.y); ctx.stroke();
        ctx.globalAlpha=Math.min(.8,s.alpha+.18); ctx.fillStyle=accent; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
      }); ctx.globalAlpha=1; raf=requestAnimationFrame(draw);
    };
    resize(); window.addEventListener('resize',resize,{passive:true}); raf=requestAnimationFrame(draw);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);}else{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);}});
  })();
  $('#showPass').addEventListener('click', () => {
    passwordField.type = passwordField.type === 'password' ? 'text' : 'password';
    $('#showPass').textContent = passwordField.type === 'password' ? '◉' : '◎';
  });
  authForm.addEventListener('submit', (e) => {
    e.preventDefault(); authError.textContent = '';
    const email = emailField.value.trim().toLowerCase(), password = passwordField.value;
    const users = getUsers();
    if (authMode === 'register') {
      const name = nameField.value.trim();
      if (!name) { authError.textContent = 'Please enter a display name first.'; return; }
      if (users[email]) { authError.textContent = 'This email is already registered. Try logging in.'; return; }
      // Demo only: never use this local-storage authentication for real accounts.
      users[email] = { name, password };
      try { localStorage.setItem('haeno_users', JSON.stringify(users)); }
      catch { authError.textContent = 'Local storage is unavailable. Open HAENO AI in a browser preview that allows site data.'; return; }
      emailField.value = email;
      passwordField.value = '';
      setMode('login');
      authError.textContent = 'Account created. Please log in.';
      authError.classList.add('success');
      return;
    } else {
      if (!users[email] || users[email].password !== password) {
        authError.textContent = 'Email or password does not match.'; return;
      }
      currentUser = { email, name: users[email].name };
      try { localStorage.setItem('haeno_session', email); } catch {}
    }
    if (loginTransitionRunning) return;
    loginTransitionRunning = true;
    runLoginTransition(() => {
      enterApp();
      loginTransitionRunning = false;
    });
  });

  function runLoginTransition(done) {
    const overlay = $('#loginTransition');
    const canvas = $('#transitionCanvas');
    if (!overlay || !canvas || !canvas.getContext) { done(); return; }
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    overlay.classList.remove('hidden', 'fade-out', 'is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');
    let raf = 0, timer = 0, particles = [], start = performance.now(), width = 0, height = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const cx = () => width / 2, cy = () => height / 2 - 18;
    const count = reduced ? 0 : 105;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * Math.min(width, height) * .25;
      particles.push({ a, r, size: .8 + Math.random() * 2, speed: .25 + Math.random() * .9, phase: Math.random() * Math.PI * 2 });
    }
    resize(); window.addEventListener('resize', resize);
    const draw = (now) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      if (!reduced) {
        particles.forEach((p, i) => {
          // Gather -> elegant spiral outward -> gather, with a small bounded particle count.
          const phase = t < .75 ? 1 - t / .75 : t < 1.55 ? (t - .75) / .8 : t < 2.2 ? 1 - (t - 1.55) / .65 : 0;
          const angle = p.a + t * p.speed * (t > .75 && t < 1.55 ? 1.9 : .42);
          const base = p.r * (t < .75 ? 1.7 - phase * .7 : t < 1.55 ? .55 + phase * 1.35 : t < 2.2 ? 1.9 - phase * 1.2 : .7);
          const x = cx() + Math.cos(angle) * base;
          const y = cy() + Math.sin(angle) * base * .78;
          const alpha = Math.max(.05, Math.min(.85, .3 + .45 * Math.sin(t * 2 + p.phase)));
          ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = i % 3 === 0 ? `rgba(255,75,220,${alpha})` : `rgba(190,135,255,${alpha})`;
          ctx.shadowBlur = 0; ctx.fill();
        });
        ctx.shadowBlur = 0;
      }
      if (t < (reduced ? .15 : 2.65)) raf = requestAnimationFrame(draw);
    };
    if (!reduced) raf = requestAnimationFrame(draw);
    // Reveal the chat underneath only after the overlay has reached full opacity.
    window.setTimeout(() => done(), reduced ? 30 : 720);
    const duration = reduced ? 180 : 2750;
    timer = window.setTimeout(() => {
      cancelAnimationFrame(raf); cancelAnimationFrame(transitionFrame); transitionFrame = 0;
      window.removeEventListener('resize', resize);
      overlay.classList.add('fade-out');
      window.setTimeout(() => {
        overlay.classList.add('hidden'); overlay.classList.remove('fade-out', 'is-visible'); overlay.setAttribute('aria-hidden', 'true');
        ctx.clearRect(0, 0, width, height);
      }, reduced ? 80 : 850);
    }, duration);
    transitionFrame = raf;
    // Keep a cleanup handle in case the page is logged out/re-entered mid-transition.
    overlay.dataset.transitionTimer = String(timer);
  }

  /* ---------- Chat workspace ---------- */
  const sendBtn = document.querySelector('.send-btn');
  const attachTray = $('#attachTray'), attachBtn = $('#attachBtn'), attachMenu = $('#attachMenu');
  const photoInput = $('#photoInput'), cameraInput = $('#cameraInput'), fileInput = $('#fileInput');
  const chatStage = document.querySelector('.chat-stage');
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  let pending = [], replyPending = false, sessionToken = 0, replyTimer = 0;

  const MAX_FILES = 6, MAX_BYTES = 20 * 1024 * 1024;
  const TEXT_EXT = /\.(txt|md|csv|tsv|json|js|jsx|ts|tsx|html|css|py|java|c|cpp|cs|go|rs|php|rb|sh|sql|xml|yml|yaml|log|ini|toml)$/i;
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const formatSize = (b) => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const isImageFile = (f) => /^image\/(jpeg|png|gif|webp|bmp|avif|svg\+xml)$/.test(f.type) || /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(f.name);

  const ICON_FILE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
  const ICON_IMG_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M21 16l-5-5-8 8"/></svg>';

  function enterApp() {
    sessionToken++;
    authView.classList.add('hidden'); appView.classList.remove('hidden');
    $('#profileName').textContent = currentUser.name; $('#profileEmail').textContent = currentUser.email;
    $('#sidebarAvatar').textContent = currentUser.name.slice(0, 1).toUpperCase();
    chats = safeParse(localStorage.getItem(userKey(currentUser.email)), []);
    activeChatId = null; pending = []; replyPending = false;
    renderTray(); renderHistory(); showWelcome(); closeSidebar(); updateSendState();
  }

  function persist() {
    if (!currentUser) return;
    const key = userKey(currentUser.email);
    let stripped = false;
    for (let i = 0; i < 80; i++) {
      try { localStorage.setItem(key, JSON.stringify(chats)); if (stripped) showToast('Device storage is full. Older attachments were not saved.'); return; }
      catch { if (!stripOldestImage()) break; stripped = true; }
    }
    showToast('Could not save chat history. Device storage is full.');
  }
  function stripOldestImage() {
    for (const chat of [...chats].sort((a, b) => a.updatedAt - b.updatedAt))
      for (const m of chat.messages) for (const a of (m.attachments || [])) if (a.dataUrl) { delete a.dataUrl; return true; }
    return false;
  }

  function showWelcome() { welcomeScreen.classList.remove('hidden'); messages.classList.add('hidden'); messages.innerHTML = ''; }
  function showMessages() { welcomeScreen.classList.add('hidden'); messages.classList.remove('hidden'); }
  function newChat() {
    activeChatId = null; showWelcome(); promptInput.value = ''; pending = []; renderTray(); resizeInput(); updateSendState();
    if (!isTouch) promptInput.focus();
    if (window.innerWidth <= 650) closeSidebar();
    renderHistory();
  }
  $('#newChatBtn').addEventListener('click', newChat);

  /* Sidebar: di desktop dilipat/dibuka, di HP muncul sebagai panel */
  const syncSidebarAria = () => {
    const mobile = window.innerWidth <= 650;
    const open = mobile ? rightSidebar.classList.contains('open') : !rightSidebar.classList.contains('collapsed');
    $('#sidebarToggle').setAttribute('aria-expanded', String(open));
  };
  function closeSidebar() { rightSidebar.classList.remove('open'); syncSidebarAria(); }
  $('#sidebarToggle').addEventListener('click', () => {
    if (window.innerWidth <= 650) rightSidebar.classList.toggle('open');
    else rightSidebar.classList.toggle('collapsed');
    syncSidebarAria();
  });
  $('#closeSidebar').addEventListener('click', closeSidebar);
  window.addEventListener('resize', syncSidebarAria, { passive: true });

  $('#logoutBtn').addEventListener('click', () => {
    sessionToken++; clearTimeout(replyTimer); replyPending = false; pending = [];
    try { localStorage.removeItem('haeno_session'); } catch {}
    currentUser = null; activeChatId = null; appView.classList.add('hidden'); authView.classList.remove('hidden');
    passwordField.value = ''; emailField.value = ''; promptInput.value = ''; setMode('login'); closeSidebar();
  });
  const confirmDelete = $('#confirmDelete');
  const closeDeleteDialog = () => confirmDelete.classList.add('hidden');
  $('#clearHistory').addEventListener('click', () => {
    if (!chats.length) { showToast('No chat history to delete.'); return; }
    confirmDelete.classList.remove('hidden');
  });
  $('#confirmCancel').addEventListener('click', closeDeleteDialog);
  $('#confirmClose').addEventListener('click', closeDeleteDialog);
  confirmDelete.addEventListener('click', e => { if (e.target === confirmDelete) closeDeleteDialog(); });
  $('#confirmDeleteBtn').addEventListener('click', () => {
    chats = []; activeChatId = null; persist(); renderHistory(); showWelcome(); closeDeleteDialog(); showToast('Chat history deleted successfully.');
  });
  document.querySelectorAll('.suggestion').forEach(btn => btn.addEventListener('click', () => {
    promptInput.value = btn.dataset.prompt; resizeInput(); updateSendState(); sendMessage();
  }));
  if (!/Mac|iPhone|iPad/i.test(navigator.userAgent)) { const k = document.querySelector('.new-chat-btn kbd'); if (k) k.textContent = 'Ctrl K'; }

  function renderHistory() {
    $('#chatCount').textContent = chats.length;
    if (!chats.length) {
      historyList.innerHTML = '<div class="empty-history"><span>◷</span><p>Belum ada obrolan.</p><small>Percakapanmu akan muncul di sini.</small></div>'; return;
    }
    historyList.innerHTML = '';
    [...chats].sort((a, b) => b.updatedAt - a.updatedAt).forEach(chat => {
      const item = document.createElement('div');
      item.className = 'history-item' + (chat.id === activeChatId ? ' active' : '');
      const icon = document.createElement('span'); icon.className = 'history-icon'; icon.textContent = '◈';
      const title = document.createElement('span'); title.className = 'history-title'; title.textContent = chat.title;
      const del = document.createElement('button'); del.className = 'history-delete'; del.textContent = '×'; del.title = 'Delete conversation'; del.setAttribute('aria-label', 'Delete conversation');
      del.addEventListener('click', e => { e.stopPropagation(); chats = chats.filter(c => c.id !== chat.id); if (activeChatId === chat.id) { activeChatId = null; showWelcome(); } persist(); renderHistory(); showToast('Conversation deleted.'); });
      item.append(icon, title, del); item.addEventListener('click', () => openChat(chat.id)); historyList.append(item);
    });
  }
  function openChat(id) {
    const chat = chats.find(c => c.id === id); if (!chat) return;
    activeChatId = id; showMessages(); messages.innerHTML = '';
    chat.messages.forEach(m => addMessage(m.role, m.text, m.attachments));
    renderHistory(); messages.scrollTop = messages.scrollHeight; if (window.innerWidth <= 650) closeSidebar();
  }

  /* ---------- Markdown ringan & aman (semua HTML di-escape dulu) ---------- */
  const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function inlineMd(s) {
    s = esc(s);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  function renderMarkdown(src) {
    const lines = String(src).replace(/\r/g, '').split('\n');
    let html = '', list = null, para = [], i = 0;
    const flushPara = () => { if (para.length) { html += '<p>' + para.map(inlineMd).join('<br>') + '</p>'; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) {
        flushPara(); closeList(); const buf = []; i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
        i++; html += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>'; continue;
      }
      let m;
      if (!line.trim()) { flushPara(); closeList(); }
      else if ((m = line.match(/^#{1,3}\s+(.*)$/))) { flushPara(); closeList(); html += '<p class="md-h">' + inlineMd(m[1]) + '</p>'; }
      else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushPara(); if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; } html += '<li>' + inlineMd(m[1]) + '</li>'; }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; } html += '<li>' + inlineMd(m[1]) + '</li>'; }
      else { closeList(); para.push(line); }
      i++;
    }
    flushPara(); closeList(); return html;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      try {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
        const ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch { return false; }
    }
  }

  /* ---------- Render pesan ---------- */
  function buildAttachments(atts) {
    const box = document.createElement('div');
    box.className = 'message-attachments' + (atts.length === 1 && atts[0].dataUrl ? ' single' : '');
    atts.forEach(a => {
      if (a.kind === 'image' && a.dataUrl) {
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'msg-img'; btn.title = a.name; btn.setAttribute('aria-label', 'Buka image ' + a.name);
        const img = document.createElement('img'); img.src = a.dataUrl; img.alt = a.name; img.decoding = 'async';
        btn.append(img); btn.addEventListener('click', () => openLightbox(a.dataUrl, a.name)); box.append(btn);
      } else {
        const chip = document.createElement('div'); chip.className = 'msg-file';
        chip.insertAdjacentHTML('beforeend', a.kind === 'image' ? ICON_IMG_OFF : ICON_FILE);
        const info = document.createElement('div');
        const name = document.createElement('div'); name.className = 'attach-name'; name.textContent = a.name;
        const meta = document.createElement('div'); meta.className = 'attach-meta';
        meta.textContent = (a.kind === 'image' ? 'GAMBAR · TIDAK TERSIMPAN · ' : '') + formatSize(a.size || 0);
        info.append(name, meta); chip.append(info); box.append(chip);
      }
    });
    return box;
  }
  function addMessage(role, text, atts, opts = {}) {
    const wrap = document.createElement('article'); wrap.className = 'message ' + role + (opts.error ? ' error' : '');
    const mark = document.createElement('div'); mark.className = 'message-mark';
    if (role === 'user') mark.textContent = currentUser?.name?.slice(0, 1).toUpperCase() || 'U';
    else { const logo = document.createElement('img'); logo.src = 'logo.png'; logo.alt = ''; logo.className = 'message-logo'; mark.append(logo); }
    const content = document.createElement('div'); content.className = 'message-content';
    const label = document.createElement('div'); label.className = 'message-label'; label.textContent = role === 'user' ? 'YOU' : 'HAENO';
    content.append(label);
    if (atts && atts.length) content.append(buildAttachments(atts));
    if (text) {
      const bubble = document.createElement('div'); bubble.className = 'message-bubble';
      if (role === 'assistant') { bubble.classList.add('md'); bubble.innerHTML = renderMarkdown(text); } else bubble.textContent = text;
      content.append(bubble);
    }
    if (role === 'assistant' && text && !opts.error) {
      const actions = document.createElement('div'); actions.className = 'message-actions';
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'copy-btn'; copy.textContent = 'SALIN';
      copy.addEventListener('click', async () => { const ok = await copyText(text); copy.textContent = ok ? 'TERSALIN ✓' : 'GAGAL'; setTimeout(() => copy.textContent = 'SALIN', 1600); });
      actions.append(copy); content.append(actions);
    }
    wrap.append(mark, content); messages.append(wrap); messages.scrollTop = messages.scrollHeight; return wrap;
  }

  /* ---------- Lightbox ---------- */
  const lightbox = $('#lightbox');
  function openLightbox(src, name) { $('#lightboxImg').src = src; $('#lightboxImg').alt = name || ''; $('#lightboxCaption').textContent = name || ''; lightbox.classList.remove('hidden'); $('#lightboxClose').focus(); }
  function closeLightbox() { lightbox.classList.add('hidden'); $('#lightboxImg').removeAttribute('src'); }
  $('#lightboxClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  /* ---------- Lampiran ---------- */
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  // Perkecil foto (maks 1024px) agar ringan dan muat di penyimpanan perangkat.
  async function compressImage(file, max = 1024, quality = .75) {
    const img = await loadImage(file);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }
  async function addFiles(list) {
    const files = [...list]; if (!files.length || !currentUser) return;
    for (const f of files) {
      if (pending.length >= MAX_FILES) { showToast('Maximum ' + MAX_FILES + ' attachments per message.'); break; }
      if (!f.size) { showToast(f.name + ' is empty and was skipped.'); continue; }
      if (f.size > MAX_BYTES) { showToast(f.name + ' is too large (20 MB maximum).'); continue; }
      const item = { id: uid(), kind: isImageFile(f) ? 'image' : 'file', name: f.name || 'lampiran', size: f.size, type: f.type || 'application/octet-stream', loading: true };
      pending.push(item); renderTray(); updateSendState();
      try {
        if (item.kind === 'image') { try { item.dataUrl = await compressImage(f); } catch { item.kind = 'file'; } }
        if (item.kind === 'file' && f.size <= 2 * 1024 * 1024 && (f.type.startsWith('text/') || f.type === 'application/json' || TEXT_EXT.test(f.name))) {
          item.text = (await f.text()).slice(0, 20000);
          item.lines = item.text ? item.text.split('\n').length : 0;
        }
      } catch { /* abaikan, file tetap dilampirkan sebagai metadata */ }
      item.loading = false; renderTray(); updateSendState();
    }
  }
  function renderTray() {
    attachTray.innerHTML = '';
    attachTray.classList.toggle('hidden', !pending.length);
    pending.forEach(it => {
      const el = document.createElement('div'); el.className = 'attach-item ' + (it.kind === 'image' && it.dataUrl ? 'image' : 'file') + (it.loading ? ' loading' : '');
      if (it.kind === 'image' && it.dataUrl) { const img = document.createElement('img'); img.src = it.dataUrl; img.alt = it.name; el.append(img); }
      else {
        el.insertAdjacentHTML('beforeend', ICON_FILE);
        const info = document.createElement('div');
        const name = document.createElement('div'); name.className = 'attach-name'; name.textContent = it.name;
        const meta = document.createElement('div'); meta.className = 'attach-meta'; meta.textContent = formatSize(it.size);
        info.append(name, meta); el.append(info);
      }
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'attach-remove'; rm.textContent = '×'; rm.setAttribute('aria-label', 'Hapus lampiran ' + it.name);
      rm.addEventListener('click', () => { pending = pending.filter(p => p.id !== it.id); renderTray(); updateSendState(); });
      el.append(rm); attachTray.append(el);
    });
    attachTray.scrollLeft = attachTray.scrollWidth;
  }
  function updateSendState() {
    const loading = pending.some(p => p.loading);
    sendBtn.disabled = replyPending || loading || (!promptInput.value.trim() && !pending.length);
    sendBtn.classList.toggle('busy', replyPending || loading);
  }

  const closeAttachMenu = () => { attachMenu.classList.add('hidden'); attachBtn.setAttribute('aria-expanded', 'false'); };
  attachBtn.addEventListener('click', e => {
    e.stopPropagation(); const open = attachMenu.classList.toggle('hidden') === false;
    attachBtn.setAttribute('aria-expanded', String(open));
    if (open) attachMenu.querySelector('button:not(.camera-only), .camera-only')?.focus?.();
  });
  attachMenu.addEventListener('click', e => {
    const b = e.target.closest('button[data-pick]'); if (!b) return;
    closeAttachMenu();
    ({ photo: photoInput, camera: cameraInput, file: fileInput })[b.dataset.pick].click();
  });
  document.addEventListener('click', e => { if (!attachMenu.classList.contains('hidden') && !e.target.closest('.attach-wrap')) closeAttachMenu(); });
  [photoInput, cameraInput, fileInput].forEach(inp => inp.addEventListener('change', () => { addFiles(inp.files); inp.value = ''; }));

  // Tempel image dari clipboard
  promptInput.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  });
  // Seret & lepas file
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  chatStage.addEventListener('dragenter', e => { if (!hasFiles(e) || !currentUser) return; e.preventDefault(); dragDepth++; chatStage.classList.add('dragging'); });
  chatStage.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  chatStage.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) chatStage.classList.remove('dragging'); });
  chatStage.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; chatStage.classList.remove('dragging'); addFiles(e.dataTransfer.files); });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => { if (hasFiles(e)) e.preventDefault(); });

  /* ---------- Balasan ---------- */
  function makeDemoReply(prompt) {
    const lower = prompt.toLowerCase();
    let lead = 'Let’s break this idea into clearer steps.';
    let steps = ['**Tujuan:** tentukan hasil akhir yang ingin kamu capai.', '**Eksplorasi:** buat beberapa pilihan, lalu pilih yang paling kuat.', '**Eksekusi:** mulai dari versi kecil yang bisa diuji, kemudian kembangkan.'];
    if (/game|gim|monster|pokemon/.test(lower)) {
      lead = 'Seru! Kita bisa mulai membangun konsep game ini dari fondasinya.';
      steps = ['**Core loop:** pemain menjelajah, menemukan tantangan, lalu mendapat sesuatu yang membuatnya ingin lanjut.', '**Identitas:** pilih satu mekanik unik agar game tidak terasa generik.', '**Prototype:** buat satu area kecil, satu karakter, dan satu tujuan untuk menguji apakah gameplay-nya menyenangkan.'];
    } else if (/cerita|story|plot|karakter/.test(lower)) {
      lead = 'Mari kita bentuk cerita yang punya identitas dan bikin pembaca penasaran.';
      steps = ['**Premis:** tokoh menginginkan sesuatu, tetapi ada hal yang membuatnya sulit.', '**Konflik:** buat pilihan tokoh punya konsekuensi nyata.', '**Twist:** tanam petunjuk sejak awal agar kejutan terasa masuk akal saat terungkap.'];
    } else if (/html|css|javascript|kode|coding|web/.test(lower)) {
      lead = 'Untuk proyek web, cara paling aman adalah membangun struktur kecil lalu menambah fitur satu per satu.';
      steps = ['**HTML:** susun komponen dan struktur konten.', '**CSS:** buat layout responsif dan visual yang konsisten.', '**JavaScript:** tambahkan interaksi, lalu tes di layar HP dan desktop.'];
    } else if (/ide|inspirasi|kreatif/.test(lower)) {
      lead = 'Coba mulai dari ide yang punya batasan jelas—justru batasan sering memunculkan konsep paling menarik.';
      steps = ['**Gabungkan dua hal berbeda** yang biasanya tidak dipasangkan.', '**Tambahkan satu aturan unik** yang mengubah cara orang menggunakannya.', '**Buat versi sederhana** dan minta orang lain mencoba sebelum dipoles.'];
    }
    return lead + '\n\n' + steps.join('\n\n') + '\n\nNote: this is a local demo response, not a live AI answer.';
  }
  function makeAttachmentNote(atts) {
    const rows = atts.map(a => `- **${a.name}** · ${a.kind === 'image' ? 'image' : 'file'} · ${formatSize(a.size)}` + (a.lines ? ` · ${a.lines} baris` : ''));
    return `Attachments received (${atts.length}):\n${rows.join('\n')}\n\nMode demo belum bisa membaca atau menganalisis isi lampiran. Hubungkan backend AI yang mendukung image/file lewat \`CONFIG.apiUrl\` di app.js.`;
  }
  async function getReply(chat, text, items) {
    if (!CONFIG.apiUrl) {
      await delay(650);
      const parts = [];
      if (items.length) parts.push(makeAttachmentNote(items));
      if (text || !items.length) parts.push(makeDemoReply(text));
      return parts.join('\n\n');
    }
    // Current Vercel endpoint accepts one text field. It does not process attachments or chat history yet.
    if (items.length && !text) return 'This backend currently supports text messages only. Please send a text prompt; image and file analysis is not enabled yet.';
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs);
    try {
      const res = await fetch(CONFIG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...CONFIG.headers }, body: JSON.stringify({ message: text }), signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      if (!data || typeof data.reply !== 'string') throw new Error('Unexpected API response. Expected { reply: string }.');
      return data.reply;
    } finally { clearTimeout(t); }
  }

  async function sendMessage() {
    const text = promptInput.value.trim(), items = pending.slice();
    if ((!text && !items.length) || !currentUser || replyPending) return;
    if (items.some(i => i.loading)) { showToast('Attachments are still processing…'); return; }
    replyPending = true; closeAttachMenu();
    const token = sessionToken;
    if (!activeChatId) {
      activeChatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const src = text || items[0].name;
      chats.push({ id: activeChatId, title: src.length > 31 ? src.slice(0, 31).trim() + '…' : src, messages: [], updatedAt: Date.now() });
    }
    const chat = chats.find(c => c.id === activeChatId);
    const atts = items.map(({ kind, name, size, type, dataUrl, lines }) => ({ kind, name, size, type, dataUrl, lines }));
    showMessages(); addMessage('user', text, atts);
    chat.messages.push({ role: 'user', text, ...(atts.length ? { attachments: atts } : {}) }); chat.updatedAt = Date.now();
    promptInput.value = ''; pending = []; renderTray(); resizeInput(); updateSendState(); persist(); renderHistory();

    const typing = document.createElement('article'); typing.className = 'message assistant';
    typing.innerHTML = '<div class="message-mark"><img src="logo.png" alt="" class="message-logo"></div><div class="message-content"><div class="message-label">HAENO · THINKING</div><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    messages.append(typing); messages.scrollTop = messages.scrollHeight;

    let reply, failed = false;
    try { reply = await getReply(chat, text, items); }
    catch (err) { failed = true; reply = err.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Could not reach the AI server (' + (err.message || 'error') + '). Please try again shortly.'; }
    typing.remove();
    if (token !== sessionToken || !currentUser) return;
    if (!failed) { chat.messages.push({ role: 'assistant', text: reply }); chat.updatedAt = Date.now(); persist(); renderHistory(); }
    if (activeChatId === chat.id) addMessage('assistant', reply, null, { error: failed });
    replyPending = false; updateSendState();
  }

  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendMessage(); });
  function resizeInput() { promptInput.style.height = 'auto'; promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + 'px'; }
  promptInput.addEventListener('input', () => { resizeInput(); updateSendState(); });
  // On mobile, Enter adds a new line (tap Send to submit). On desktop, Enter sends the message.
  promptInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) { e.preventDefault(); sendMessage(); } });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!appView.classList.contains('hidden')) newChat(); }
    if (e.key === 'Escape') { if (!lightbox.classList.contains('hidden')) closeLightbox(); else if (!attachMenu.classList.contains('hidden')) closeAttachMenu(); else closeSidebar(); }
  });

  updateSendState(); syncSidebarAria();

  // Tetap masuk setelah halaman di-refresh (demo lokal).
  try {
    const savedEmail = localStorage.getItem('haeno_session'), u = savedEmail && getUsers()[savedEmail];
    if (u) { currentUser = { email: savedEmail, name: u.name }; enterApp(); }
  } catch {}
})();
