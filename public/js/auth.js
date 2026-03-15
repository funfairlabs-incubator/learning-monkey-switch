/**
 * public/js/auth.js
 *
 * Google OAuth with role-aware user resolution.
 *
 * allowed-users.json schema:
 * [
 *   { "email": "...", "name": "...", "role": "adult" },
 *   { "email": "...", "name": "...", "role": "child", "year_group": "Y9",
 *     "parent_overrides": ["mathematics", "computing"] }
 * ]
 *
 * Roles:
 *   adult  — full access, direct answers, can create/edit plans
 *   child  — Socratic mode enforced at the prompt level; parent_overrides
 *            is a list of topic slugs where direct answers are permitted
 *
 * Security model: GitHub Pages serves HTML to anyone. Content is hidden via
 * JS until auth + role check pass. The GCS bucket must have CORS enabled for
 * learn.funfairlabs.com. Appropriate for family use; not a substitute for
 * server-side auth for genuinely sensitive data.
 */

(function () {
  const config = window.LEARN_CONFIG || {};
  const CLIENT_ID   = config.clientId || '';
  const GCS_BUCKET  = config.gcsBucket || '';
  const ALLOWED_KEY = config.allowedUsersKey || 'learn-allowed-users.json';

  const ALLOWED_USERS_URL = `https://storage.googleapis.com/${GCS_BUCKET}/${ALLOWED_KEY}`;

  let currentUser = null; // { email, name, picture, role, year_group, parent_overrides }

  // ── GSI loader ───────────────────────────────────────────────────────────────

  function loadGSI(callback) {
    if (window.google?.accounts?.id) { callback(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = callback;
    document.head.appendChild(s);
  }

  // ── JWT parse ────────────────────────────────────────────────────────────────

  function parseJWT(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch { return null; }
  }

  // ── User resolution ──────────────────────────────────────────────────────────

  async function resolveUser(email) {
    try {
      const res = await fetch(ALLOWED_USERS_URL, { cache: 'no-store' });
      if (!res.ok) return null;
      const list = await res.json();
      if (!Array.isArray(list)) return null;
      const record = list.find(u => u.email?.toLowerCase() === email.toLowerCase());
      return record || null;
    } catch (e) {
      console.error('learn/auth: user resolution failed', e);
      return null;
    }
  }

  // ── UI ───────────────────────────────────────────────────────────────────────

  function showContent(user) {
    const gate    = document.getElementById('auth-gate');
    const content = document.getElementById('plans-content') || document.getElementById('plan-content') || document.getElementById('learn-content');
    if (gate)    gate.style.display    = 'none';
    if (content) content.style.display = '';

    // Apply role class to body so CSS can adjust UI per persona
    document.body.dataset.role      = user.role;
    document.body.dataset.yearGroup = user.year_group || '';

    // Show user chip in header if present
    const chip = document.getElementById('user-chip');
    if (chip) {
      chip.innerHTML = `
        <img src="${user.picture || ''}" alt="" class="user-avatar" onerror="this.style.display='none'">
        <span class="user-name">${user.name || user.email}</span>
        ${user.role === 'child' ? `<span class="role-badge role-badge--child">${user.year_group || 'student'}</span>` : ''}
        <button class="btn-signout" onclick="window.learnAuth.signOut()">sign out</button>
      `;
      chip.style.display = 'flex';
    }
  }

  function showError(msg) {
    const gate = document.getElementById('auth-gate');
    if (!gate) return;
    gate.style.display = '';
    const inner = gate.querySelector('.auth-gate-inner');
    if (inner) inner.innerHTML = `
      <p class="auth-kicker">access denied</p>
      <h2>Not authorised</h2>
      <p class="auth-sub">${msg}</p>
      <button class="btn-signin" onclick="window.learnAuth.signOut()">Sign out</button>
    `;
  }

  // ── Auth flow ────────────────────────────────────────────────────────────────

  async function handleCredential(response) {
    const payload = parseJWT(response.credential);
    if (!payload?.email) { showError('Invalid token.'); return; }

    const record = await resolveUser(payload.email);
    if (!record) {
      showError(`${payload.email} doesn't have access. Ask an admin to add you.`);
      return;
    }

    currentUser = {
      email:            record.email,
      name:             record.name || payload.name,
      picture:          payload.picture,
      role:             record.role || 'child',       // default to safer role
      year_group:       record.year_group || null,
      parent_overrides: record.parent_overrides || [], // topic slugs unlocked for direct help
    };

    showContent(currentUser);
    window.dispatchEvent(new CustomEvent('learn:auth', {
      detail: { authenticated: true, user: currentUser }
    }));
  }

  function initAuth() {
    const isProtected = window.location.pathname.startsWith('/plans') ||
                        window.location.pathname.startsWith('/learn');

    if (!CLIENT_ID) {
      if (isProtected) {
        const gate = document.getElementById('auth-gate');
        if (gate) gate.style.display = '';
      }
      return;
    }

    loadGSI(() => {
      google.accounts.id.initialize({
        client_id:   CLIENT_ID,
        callback:    handleCredential,
        auto_select: true,
      });

      if (isProtected) {
        google.accounts.id.prompt((n) => {
          // If silent sign-in fails, gate stays visible — user clicks button
        });
      } else {
        google.accounts.id.prompt(); // silent only on public pages
      }
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  window.learnAuth = {
    signIn() {
      loadGSI(() => {
        google.accounts.id.initialize({
          client_id:   CLIENT_ID,
          callback:    handleCredential,
          auto_select: false,
        });
        // renderButton works reliably on all browsers including mobile
        // Find or create a container for the button
        let container = document.getElementById('g-signin-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'g-signin-container';
          container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:white;padding:24px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.2);text-align:center;';
          container.innerHTML = '<p style="margin-bottom:16px;font-family:Arial,sans-serif;font-size:14px;color:#444">Sign in with your Google account</p><div id="g-signin-btn"></div><button onclick="document.getElementById('g-signin-container').remove()" style="margin-top:12px;background:none;border:none;font-size:12px;color:#888;cursor:pointer;font-family:Arial,sans-serif">Cancel</button>';
          document.body.appendChild(container);
        }
        google.accounts.id.renderButton(
          document.getElementById('g-signin-btn'),
          { theme: 'outline', size: 'large', width: 280 }
        );
      });
    },
    signOut()   {
      if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
      currentUser = null;
      window.location.reload();
    },
    getUser()   { return currentUser; },
    isAdult()   { return currentUser?.role === 'adult'; },
    isChild()   { return currentUser?.role === 'child'; },
    canOverride(topicSlug) {
      if (!currentUser) return false;
      if (currentUser.role === 'adult') return true;
      return (currentUser.parent_overrides || []).includes(topicSlug);
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
})();
