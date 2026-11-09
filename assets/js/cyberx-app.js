(function () {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const showToast = (message, type = 'success') => {
    const stack = $('.toast-stack') || (() => {
      const el = document.createElement('div');
      el.className = 'toast-stack';
      document.body.appendChild(el);
      return el;
    })();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2600);
  };

  const initMobileMenu = () => {
    const toggle = $('.mobile-toggle');
    const menu = $('.mobile-menu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  };

  const initGlobalNavigation = () => {
    const nav = $('.header .nav');
    if (!nav || nav.dataset.cyberxNavReady) return;
    const groups = [
      ['Home', [['Home', 'index.html']]],
      ['Learning', [['Learning paths and modules', 'learning.html']]],
      ['Practice', [['Puzzle Arena', 'puzzle.html'], ['Leaderboard', 'leaderboard.html']]],
      ['Platform', [['Dashboard', 'dashboard.html'], ['Community', 'community.html'], ['Resources', 'resources.html'], ['AI Assistant', 'assistant.html']]],
      ['Awareness', [['Overview', 'awareness.html'], ['Threats', 'awareness.html#threats'], ['Signs', 'awareness.html#signs'], ['Tools', 'awareness.html#tools'], ['Scenarios', 'awareness.html#scenarios'], ['Checklist', 'awareness.html#checklist'], ['Emergency', 'awareness.html#emergency']]],
      ['Account', [['Profile', 'profile.html'], ['Sign in', 'auth.html'], ['Pricing', 'pricing.html']]],
    ];
    const activeHref = location.pathname.split('/').pop() || 'index.html';
    nav.replaceChildren();
    groups.forEach(([label, links], index) => {
      const item = document.createElement('div');
      item.className = 'nav-group';
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.id = `cx-nav-button-${index}`;
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', `cx-nav-dropdown-${index}`);
      const panel = document.createElement('div');
      panel.className = 'nav-dropdown'; panel.id = `cx-nav-dropdown-${index}`;
      panel.setAttribute('aria-labelledby', button.id);
      links.forEach(([text, href]) => {
        const link = document.createElement('a'); link.href = href; link.textContent = text;
        if (href.split('#')[0] === activeHref) link.classList.add('active');
        panel.append(link);
      });
      button.addEventListener('click', () => {
        const open = item.classList.toggle('open');
        button.setAttribute('aria-expanded', String(open));
        $$('.nav-group', nav).filter((other) => other !== item).forEach((other) => {
          other.classList.remove('open'); other.querySelector('button')?.setAttribute('aria-expanded', 'false');
        });
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { item.classList.remove('open'); button.setAttribute('aria-expanded', 'false'); button.focus(); }
      });
      item.append(button, panel); nav.append(item);
    });
    nav.dataset.cyberxNavReady = 'true';

    const menu = $('.header .mobile-menu');
    if (menu && !menu.dataset.cyberxNavReady) {
      menu.replaceChildren();
      groups.forEach(([label, links], index) => {
        const section = document.createElement('div'); section.className = 'mobile-category';
        const toggle = document.createElement('button'); toggle.type = 'button'; toggle.textContent = label;
        toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', `cx-mobile-group-${index}`);
        const list = document.createElement('div'); list.id = `cx-mobile-group-${index}`; list.hidden = true;
        links.forEach(([text, href]) => { const link = document.createElement('a'); link.href = href; link.textContent = text; list.append(link); });
        toggle.addEventListener('click', () => { list.hidden = !list.hidden; toggle.setAttribute('aria-expanded', String(!list.hidden)); });
        section.append(toggle, list); menu.append(section);
      });
      menu.dataset.cyberxNavReady = 'true';
    }
  };

  const initFilterPills = () => {
    $$('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const group = button.dataset.filterGroup || 'filter';
        $$(`[data-filter-group="${group}"]`).forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
      });
    });
  };

  const initDemoInteractions = () => {
    $$('[data-demo-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.demoAction || 'action';
        const message = button.dataset.demoMessage || 'Demo action ready';
        showToast(message, action === 'danger' ? 'error' : 'success');
      });
    });
  };

  const initFormValidation = () => {
    const forms = $$('form[data-validate]:not([data-auth-form]):not([data-profile-form]):not([data-community-form])');
    forms.forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const required = [...form.querySelectorAll('[required]')];
        const missing = required.filter((el) => !String(el.value || '').trim());
        if (missing.length) {
          showToast('Please complete all required fields.', 'error');
          return;
        }
        showToast(form.dataset.successMessage || 'Saved successfully.', 'success');
      });
    });
  };

  const safeAuthMessage = (error, context) => {
    const code = error?.code || error?.name || '';
    if (code === 'invalid_credentials') return 'Email or password is incorrect.';
    if (code === 'user_already_exists') return 'An account already uses this email. Try signing in.';
    if (code === 'weak_password') return 'Choose a stronger password with at least 12 characters.';
    if (code === 'email_not_confirmed') return 'Confirm your email before signing in.';
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Too many attempts. Wait a little and try again.';
    return context === 'signup' ? 'Account creation failed. Check your details and try again.' : 'The request failed. Check your details and try again.';
  };

  const setNotice = (node, message, kind = 'warning') => {
    if (!node) return;
    node.textContent = message;
    node.className = `notice ${kind}`;
    node.hidden = !message;
  };

  const initAuthIntegration = async () => {
    const signup = $('[data-auth-signup]');
    const signin = $('[data-auth-signin]');
    const recovery = $('[data-auth-recovery]');
    if (!signup && !signin) return;
    const backend = await (window.CyberXBackendReady || Promise.resolve(null));
    const signupStatus = $('[data-auth-status]', signup || document);
    const signinStatus = $('[data-auth-status]', signin || document);
    const recoveryStatus = $('[data-auth-status]', recovery || document);
    const demoNotice = $('[data-auth-demo]');
    if (!backend) {
      const demoMessage = 'Demo mode: local Supabase credentials or the Supabase browser client are not configured.';
      if (demoNotice) demoNotice.textContent = demoMessage;
      [signup, signin, recovery].filter(Boolean).forEach((form) => form.addEventListener('submit', (event) => {
        event.preventDefault();
        const status = $('[data-auth-status]', form);
        setNotice(status, demoMessage, 'warning');
      }));
      return;
    }
    if (demoNotice) demoNotice.hidden = true;
    const client = backend.client;

    signup?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = $('[name="display_name"]', signup).value.trim();
      const handle = $('[name="handle"]', signup).value.trim();
      const email = $('[name="email"]', signup).value.trim();
      const password = $('[name="password"]', signup).value;
      const confirm = $('[name="confirm-password"]', signup).value;
      const terms = $('input[type="checkbox"]', signup).checked;
      if (!signup.checkValidity() || name.length < 1 || name.length > 48 || handle.length < 1 || handle.length > 32 || password.length < 12 || password !== confirm || !terms) {
        setNotice(signupStatus, password !== confirm ? 'Passwords do not match.' : 'Complete the form, accept the guidelines, and use a password of at least 12 characters.', 'warning');
        return;
      }
      const button = $('button[type="submit"]', signup);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      setNotice(signupStatus, 'Creating your account…', 'warning');
      try {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: name, handle }, emailRedirectTo: `${location.origin}/auth.html` },
        });
        if (error) throw error;
        if (data.session) {
          setNotice(signupStatus, 'Account created and signed in. Your profile is ready.', 'success');
          window.setTimeout(() => { location.href = 'profile.html'; }, 500);
        } else {
          setNotice(signupStatus, 'Account created. Check your email for the confirmation link before signing in.', 'success');
        }
      } catch (error) {
        setNotice(signupStatus, safeAuthMessage(error, 'signup'), 'error');
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });

    signin?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = $('[name="email"]', signin).value.trim();
      const password = $('[name="password"]', signin).value;
      if (!signin.checkValidity() || !email || !password) {
        setNotice(signinStatus, 'Enter a valid email and password.', 'warning');
        return;
      }
      const button = $('button[type="submit"]', signin);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      setNotice(signinStatus, 'Signing in…', 'warning');
      try {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const displayName = data.user?.user_metadata?.display_name || 'member';
        setNotice(signinStatus, `Signed in as ${displayName}. Opening your profile…`, 'success');
        window.setTimeout(() => { location.href = 'profile.html'; }, 500);
      } catch (error) {
        setNotice(signinStatus, safeAuthMessage(error, 'signin'), 'error');
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });

    $('[data-password-reset]')?.addEventListener('click', async (event) => {
      event.preventDefault();
      const email = $('[name="email"]', signin)?.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setNotice(signinStatus, 'Enter your account email above, then choose Forgot password.', 'warning');
        return;
      }
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth.html` });
        if (error) throw error;
        setNotice(signinStatus, 'If an account matches that email, a password reset link has been sent.', 'success');
      } catch (error) {
        setNotice(signinStatus, safeAuthMessage(error, 'reset'), 'error');
      }
    });

    recovery?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = $('[name="password"]', recovery).value;
      const confirmation = $('[name="confirm-password"]', recovery).value;
      if (!recovery.checkValidity() || password.length < 12 || password !== confirmation) {
        setNotice(recoveryStatus, password !== confirmation ? 'Passwords do not match.' : 'Use a password of at least 12 characters.', 'warning');
        return;
      }
      const button = $('button[type="submit"]', recovery); button.disabled = true; button.setAttribute('aria-busy', 'true');
      try {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        recovery.reset();
        setNotice(recoveryStatus, 'Password updated. You can now sign in with the new password.', 'success');
      } catch (error) {
        setNotice(recoveryStatus, safeAuthMessage(error, 'reset'), 'error');
      } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
    });

    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && recovery) {
        if (signup) signup.hidden = true;
        if (signin) signin.hidden = true;
        recovery.hidden = false;
        if (demoNotice) demoNotice.hidden = true;
        setNotice(recoveryStatus, 'Choose a new password for your account.', 'warning');
      } else if (event === 'SIGNED_OUT' && recovery) {
        recovery.hidden = true;
        if (signup) signup.hidden = false;
        if (signin) signin.hidden = false;
      }
    });

    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session && signinStatus) setNotice(signinStatus, `Session restored for ${data.session.user.user_metadata?.display_name || 'member'}.`, 'success');
    } catch {
      if (signinStatus) setNotice(signinStatus, 'Could not restore your session. Sign in again.', 'warning');
    }
  };

  const initProfileIntegration = async () => {
    const form = $('[data-profile-form]');
    if (!form) return;
    const backend = await (window.CyberXBackendReady || Promise.resolve(null));
    const content = $('[data-profile-content]');
    const accessNote = $('[data-profile-access-note]');
    const status = $('[data-profile-status]', form);
    const client = backend?.client;
    if (!client) {
      if (accessNote) { accessNote.hidden = false; accessNote.textContent = 'Demo profile. Configure local Supabase to use account settings.'; }
      return;
    }
    const signOut = $('[data-auth-signout]');
    let currentUser = null;
    const loadProfile = async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      currentUser = sessionData.session?.user || null;
      if (!currentUser) {
        if (content) content.hidden = true;
        if (accessNote) accessNote.hidden = false;
        return;
      }
      const { data: profile, error } = await client.from('member_profiles')
        .select('user_id,display_name,handle,headline,bio')
        .eq('user_id', currentUser.id).maybeSingle();
      if (error || !profile) throw error || new Error('profile_missing');
      if (content) content.hidden = false;
      if (accessNote) accessNote.hidden = true;
      $('[data-profile-display-name]').textContent = profile.display_name;
      $('[data-profile-handle]').textContent = `@${profile.handle}`;
      $('[data-profile-headline]').textContent = profile.headline || '';
      $('[data-profile-initials]').textContent = profile.display_name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
      $('[name="display_name"]', form).value = profile.display_name;
      $('[name="handle"]', form).value = profile.handle;
      $('[name="headline"]', form).value = profile.headline || '';
      $('[name="bio"]', form).value = profile.bio || '';
    };
    try { await loadProfile(); } catch { setNotice(accessNote, 'Your profile could not be loaded. Please sign in again or retry.', 'error'); }
    signOut?.addEventListener('click', async () => {
      signOut.disabled = true;
      const { error } = await client.auth.signOut();
      if (error) { signOut.disabled = false; setNotice(status, 'Sign out failed. Please retry.', 'error'); return; }
      location.href = 'auth.html';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentUser) { setNotice(status, 'Sign in before updating your profile.', 'warning'); return; }
      const fields = {
        display_name: $('[name="display_name"]', form).value.trim(),
        handle: $('[name="handle"]', form).value.trim(),
        headline: $('[name="headline"]', form).value.trim(),
        bio: $('[name="bio"]', form).value.trim(),
      };
      if (!form.checkValidity() || fields.display_name.length > 48 || fields.handle.length > 32 || fields.headline.length > 64 || fields.bio.length > 500) {
        setNotice(status, 'Check the required fields and character limits.', 'warning'); return;
      }
      const button = $('button[type="submit"]', form); button.disabled = true; button.setAttribute('aria-busy', 'true');
      try {
        const { error } = await client.from('member_profiles').update(fields).eq('user_id', currentUser.id);
        if (error) throw error;
        await loadProfile();
        setNotice(status, 'Profile saved to your account.', 'success');
      } catch { setNotice(status, 'Profile could not be saved. Check your connection and retry.', 'error'); }
      finally { button.disabled = false; button.removeAttribute('aria-busy'); }
    });
  };

  const learningTrackNames = Object.freeze({
    'offensive-tradecraft': 'Offensive tradecraft',
    'detection-engineering': 'Detection engineering',
    'secure-operations': 'Secure operations',
  });

  const initLearningProgress = async () => {
    const cards = $$('[data-learning-track]');
    if (!cards.length) return;
    const notice = $('[data-learning-message]');
    const buttons = $$('[data-start-track]');
    const completeButtons = $$('[data-complete-track]');
    const backend = await (window.CyberXBackendReady || Promise.resolve(null));
    if (!backend) {
      setNotice(notice, 'Demo progress is not saved. Configure a local Supabase account to persist started paths.', 'warning');
      buttons.forEach((button) => button.addEventListener('click', () => showToast('Demo path start is not saved.', 'success')));
      return;
    }
    const client = backend.client;
    const updateProgress = async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) { setNotice(notice, 'Could not check your account session.', 'error'); return; }
      const user = sessionData.session?.user;
      if (!user) {
        cards.forEach((card) => { card.querySelector('[data-track-state]').textContent = 'Sign in to save'; });
        buttons.forEach((button) => { button.disabled = false; });
        setNotice(notice, 'Sign in to save started learning paths. Activity is private to your account.', 'warning');
        return;
      }
      const { data, error } = await client.from('learning_progress').select('track_id,started_at,completed_at').order('started_at', { ascending: false });
      if (error) { setNotice(notice, 'Learning progress could not be loaded. Refresh and try again.', 'error'); return; }
      const progressByTrack = new Map(data.map((item) => [item.track_id, item]));
      const started = new Set(progressByTrack.keys());
      const completed = new Set(data.filter((item) => item.completed_at).map((item) => item.track_id));
      cards.forEach((card) => {
        const trackId = card.dataset.learningTrack;
        const isStarted = started.has(trackId);
        const isCompleted = completed.has(trackId);
        card.querySelector('[data-track-state]').textContent = isCompleted ? 'Completed' : isStarted ? 'Started' : 'Not started';
        const button = card.querySelector('[data-start-track]');
        if (button) { button.textContent = isCompleted ? 'Path completed' : isStarted ? 'Path started' : 'Start path'; button.disabled = isStarted; }
        const completeButton = card.querySelector('[data-complete-track]');
        if (completeButton) {
          completeButton.hidden = !isStarted;
          completeButton.disabled = isCompleted;
          completeButton.textContent = isCompleted ? 'Path completed' : 'Mark path complete';
        }
      });
      setNotice(notice, `${started.size} learning path${started.size === 1 ? '' : 's'} saved to your account. ${completed.size} marked complete by you.`, 'success');
    };
    await updateProgress();
    buttons.forEach((button) => button.addEventListener('click', async () => {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) { setNotice(notice, 'Sign in before starting a path. Your progress will be private to your account.', 'warning'); return; }
      button.disabled = true; button.setAttribute('aria-busy', 'true');
      const { error } = await client.from('learning_progress').insert({ track_id: button.dataset.startTrack });
      if (error && error.code !== '23505') {
        button.disabled = false;
        setNotice(notice, 'The path could not be saved. Check your connection and try again.', 'error');
      } else {
        setNotice(notice, `${learningTrackNames[button.dataset.startTrack]} saved as started.`, 'success');
        await updateProgress();
      }
      button.removeAttribute('aria-busy');
    }));
    completeButtons.forEach((button) => button.addEventListener('click', async () => {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) { setNotice(notice, 'Sign in before completing a path. Completion is saved to your account.', 'warning'); return; }
      button.disabled = true; button.setAttribute('aria-busy', 'true');
      const { error } = await client.rpc('cyberx_complete_learning_path', { p_track_id: button.dataset.completeTrack });
      if (error) {
        button.disabled = false;
        setNotice(notice, error.code === 'P0002' ? 'Start this path before marking it complete.' : 'Completion could not be saved. Check your connection and retry.', 'error');
      } else {
        setNotice(notice, `${learningTrackNames[button.dataset.completeTrack]} marked complete. This is a member-confirmed milestone.`, 'success');
        await updateProgress();
      }
      button.removeAttribute('aria-busy');
    }));
    client.auth.onAuthStateChange(() => { queueMicrotask(() => { void updateProgress(); }); });
  };

  const initDashboardProgress = async () => {
    const accountSections = $$('[data-dashboard-account]');
    if (!accountSections.length) return;
    const notice = $('[data-dashboard-access]');
    const backend = await (window.CyberXBackendReady || Promise.resolve(null));
    if (!backend) {
      setNotice(notice, 'Account activity is not connected. The schedule below is a demo preview.', 'warning');
      return;
    }
    const client = backend.client;
    const renderAccount = async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) { setNotice(notice, 'Could not check your account session.', 'error'); return; }
      const user = sessionData.session?.user;
      if (!user) {
        accountSections.forEach((section) => { section.hidden = true; });
        setNotice(notice, 'Sign in to view your learning activity. The schedule below is a demo preview.', 'warning');
        return;
      }
      const { data, error } = await client.from('learning_progress').select('track_id,started_at,completed_at').order('started_at', { ascending: false });
      if (error) { setNotice(notice, 'Your learning activity could not be loaded. Refresh and try again.', 'error'); return; }
      accountSections.forEach((section) => { section.hidden = false; });
      $('[data-learning-started-count]').textContent = String(data.length);
      $('[data-learning-completed-count]').textContent = String(data.filter((item) => item.completed_at).length);
      const recent = $('[data-dashboard-recent]');
      recent.replaceChildren();
      if (!data.length) {
        const item = document.createElement('li');
        const detail = document.createElement('div');
        appendDashboardText(detail, 'strong', 'No learning paths started yet.');
        appendDashboardText(detail, 'small', 'Start a path from Learning to see it here.');
        item.append(detail); recent.append(item);
      } else {
        data.forEach((progress) => {
          const item = document.createElement('li');
          const dot = document.createElement('span'); dot.className = 'status-dot ok';
          const detail = document.createElement('div');
          appendDashboardText(detail, 'strong', learningTrackNames[progress.track_id] || 'Learning path');
          const started = new Date(progress.started_at);
          const completed = progress.completed_at ? new Date(progress.completed_at) : null;
          const state = completed && !Number.isNaN(completed.valueOf())
            ? `Member-confirmed complete ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(completed)}`
            : Number.isNaN(started.valueOf()) ? 'Started' : `Started ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(started)}`;
          appendDashboardText(detail, 'small', state);
          item.append(dot, detail); recent.append(item);
        });
      }
      setNotice(notice, 'Your account paths are shown below. Path completion is self-confirmed; lesson activity and skill scores are not tracked.', 'success');
    };
    const appendDashboardText = (parent, tag, value) => {
      const node = document.createElement(tag); node.textContent = value; parent.append(node); return node;
    };
    await renderAccount();
    client.auth.onAuthStateChange(() => { queueMicrotask(() => { void renderAccount(); }); });
  };

  const initPasswordToggles = () => {
    $$('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = document.getElementById(button.dataset.togglePassword);
        if (!target) return;
        const isPassword = target.type === 'password';
        target.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? 'Hide' : 'Show';
      });
    });
  };

  const initTabs = () => {
    const tabGroups = $$('[data-tab-group]');
    tabGroups.forEach((group) => {
      const buttons = $$('[data-tab-target]', group);
      const panels = $$('[data-tab-panel]', group.parentElement || document);
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const target = button.dataset.tabTarget;
          buttons.forEach((item) => item.classList.toggle('active', item === button));
          panels.forEach((panel) => {
            panel.hidden = panel.dataset.tabPanel !== target;
          });
        });
      });
    });
  };

  const initResourceSearch = () => {
    const search = document.querySelector('[data-resource-search]');
    if (!search) return;
    search.addEventListener('input', (event) => {
      const value = event.target.value.trim().toLowerCase();
      document.querySelectorAll('[data-resource-card]').forEach((card) => {
        const text = (card.textContent || '').toLowerCase();
        card.hidden = value && !text.includes(value);
      });
    });
  };

  const initVoteButtons = () => {
    document.querySelectorAll('[data-vote]').forEach((button) => {
      if (button.dataset.voteReady) return;
      button.dataset.voteReady = 'true';
      button.addEventListener('click', () => {
        if (button.disabled) return;
        const container = button.closest('[data-vote-container]');
        const valueNode = container?.querySelector('[data-vote-count]');
        const current = Number(valueNode?.textContent || '0');
        const delta = button.dataset.vote === 'up' ? 1 : -1;
        if (valueNode) valueNode.textContent = String(current + delta);
        button.disabled = true;
        button.setAttribute('aria-pressed', 'true');
        showToast('Demo vote shown locally; it is not saved.', 'success');
      });
    });
  };

  const initNotifications = () => {
    document.querySelectorAll('[data-read-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('[data-notification-item]');
        item?.classList.remove('unread');
        button.textContent = 'Read';
        button.disabled = true;
      });
    });

    const markAll = document.querySelector('[data-mark-all-read]');
    if (markAll) {
      markAll.addEventListener('click', () => {
        document.querySelectorAll('[data-notification-item]').forEach((item) => item.classList.remove('unread'));
        document.querySelectorAll('[data-read-id]').forEach((button) => {
          button.textContent = 'Read';
          button.disabled = true;
        });
        showToast('All notifications marked as read.', 'success');
      });
    }
  };

  const initChatAssistant = () => {
    const form = document.querySelector('[data-chat-form]');
    const input = document.querySelector('[data-chat-input]');
    const history = document.querySelector('[data-chat-history]');
    const clearButton = document.querySelector('[data-clear-chat]');
    if (!form || !input || !history) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const userBubble = document.createElement('div');
      userBubble.className = 'assistant-message user';
      userBubble.innerHTML = '<strong>You</strong><span>' + window.escapeHtml(text) + '</span>';
      history.appendChild(userBubble);

      const statusBubble = document.createElement('div');
      statusBubble.className = 'assistant-message assistant';
      statusBubble.innerHTML = '<div class="assistant-branding"><img src="image/CYBERX-LOGO2.png" alt="CyberX AI assistant"><strong>AI demo</strong></div><span>Analyzing the request in demo mode. A real backend integration is still pending.</span>';
      history.appendChild(statusBubble);

      input.value = '';
      history.scrollTop = history.scrollHeight;
    });

    clearButton?.addEventListener('click', () => {
      history.innerHTML = '<div class="assistant-message assistant"><div class="assistant-branding"><img src="image/CYBERX-LOGO2.png" alt="CyberX AI assistant"><strong>AI demo</strong></div><span>Conversation cleared. Ready for the next scenario.</span></div>';
      showToast('Conversation cleared.', 'success');
    });

    window.escapeHtml = window.escapeHtml || ((value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;'));
  };

  const initCommunitySafetyWorkflows = (client) => {
    const section = $('[data-community-backend-workflows]');
    const suggestionForm = $('[data-suggestion-form]');
    const suggestionStatus = $('[data-suggestion-status]');
    const suggestionList = $('[data-suggestion-list]');
    const moderationPanel = $('[data-moderation-panel]');
    const moderationQueue = $('[data-moderation-queue]');
    const moderationStatus = $('[data-moderation-status]');
    let currentUser = null;
    let queueLoading = false;
    if (!section || !suggestionForm || !suggestionList) return { setUser() {}, openReport() {} };
    section.hidden = false;

    const setStatus = (node, message, state = '') => {
      if (!node) return;
      node.textContent = message;
      if (state) node.dataset.state = state;
      else delete node.dataset.state;
    };
    const append = (parent, tag, text, className = '') => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text ?? '');
      parent.append(node);
      return node;
    };
    const addAction = (parent, label, onClick) => {
      const button = append(parent, 'button', label, 'btn btn-secondary');
      button.type = 'button';
      button.addEventListener('click', onClick);
      return button;
    };

    const loadSuggestions = async () => {
      suggestionList.replaceChildren();
      if (!currentUser) { append(suggestionList, 'p', 'Sign in to submit a suggestion and view its status.', 'community-comment-state'); return; }
      const { data, error } = await client.from('community_suggestions')
        .select('id,title,description,status,created_at').order('created_at', { ascending: false }).limit(30);
      if (error) { append(suggestionList, 'p', 'Suggestions could not be loaded.'); return; }
      if (!data.length) { append(suggestionList, 'p', 'No suggestions submitted yet.', 'community-comment-state'); return; }
      const list = append(suggestionList, 'div', undefined, 'community-review-list');
      data.forEach((suggestion) => {
        const item = append(list, 'article', undefined, 'community-review-item');
        append(item, 'strong', suggestion.title);
        append(item, 'p', suggestion.description);
        append(item, 'span', suggestion.status.replaceAll('_', ' '), 'community-suggestion-status');
      });
    };

    const submitReview = async (itemType, itemId, decision, button) => {
      button.disabled = true;
      const { error } = await client.rpc('cyberx_review_community_item', {
        p_item_type: itemType, p_item_id: itemId, p_decision: decision, p_note: '',
      });
      if (error) {
        setStatus(moderationStatus, 'Review action was denied or could not be saved.', 'error');
        button.disabled = false;
        return;
      }
      setStatus(moderationStatus, 'Review action saved and recorded in the audit log.', 'success');
      await loadModerationQueue();
      document.dispatchEvent(new CustomEvent('cyberx:community-moderated'));
    };

    const loadModerationQueue = async () => {
      if (queueLoading || !currentUser || !moderationPanel || moderationPanel.hidden) return;
      queueLoading = true;
      moderationQueue.replaceChildren();
      setStatus(moderationStatus, 'Loading review queue…', 'loading');
      try {
        const [reports, suggestions, posts] = await Promise.all([
          client.from('community_reports').select('id,post_id,reporter_display_name,reason,details,status,created_at').eq('status', 'open').order('created_at').limit(50),
          client.from('community_suggestions').select('id,author_display_name,title,description,status,created_at').in('status', ['pending','under_review','accepted']).order('created_at').limit(50),
          client.from('community_posts').select('id,author_display_name,title,moderation_status,created_at').neq('moderation_status', 'published').order('created_at', { ascending: false }).limit(50),
        ]);
        const failed = [reports, suggestions, posts].find((result) => result.error);
        if (failed) throw failed.error;
        const queue = append(moderationQueue, 'div', undefined, 'community-review-list');
        let count = 0;
        reports.data.forEach((report) => {
          count++;
          const item = append(queue, 'article', undefined, 'community-review-item');
          append(item, 'strong', `Report · ${report.reason} · ${report.reporter_display_name}`);
          append(item, 'p', report.details || 'No additional details.');
          append(item, 'small', `Post ${report.post_id} · ${report.created_at}`);
          const actions = append(item, 'div', undefined, 'community-review-actions');
          [['Mark reviewed','reviewed'],['Dismiss','dismissed'],['Hide post','hide_post'],['Remove post','remove_post']].forEach(([label, decision]) =>
            addAction(actions, label, (event) => { void submitReview('report', report.id, decision, event.currentTarget); }));
        });
        suggestions.data.forEach((suggestion) => {
          count++;
          const item = append(queue, 'article', undefined, 'community-review-item');
          append(item, 'strong', `Suggestion · ${suggestion.title} · ${suggestion.author_display_name}`);
          append(item, 'p', suggestion.description);
          append(item, 'small', `Status: ${suggestion.status.replaceAll('_', ' ')}`);
          const actions = append(item, 'div', undefined, 'community-review-actions');
          const decisions = suggestion.status === 'pending'
            ? [['Start review','under_review'],['Accept','accepted'],['Reject','rejected']]
            : suggestion.status === 'under_review'
              ? [['Accept','accepted'],['Reject','rejected']]
              : [['Mark implemented','implemented']];
          decisions.forEach(([label, decision]) => addAction(actions, label, (event) => {
            void submitReview('suggestion', suggestion.id, decision, event.currentTarget);
          }));
        });
        posts.data.forEach((post) => {
          count++;
          const item = append(queue, 'article', undefined, 'community-review-item');
          append(item, 'strong', `Post · ${post.title} · ${post.author_display_name}`);
          append(item, 'small', `Status: ${post.moderation_status}`);
          const actions = append(item, 'div', undefined, 'community-review-actions');
          if (post.moderation_status === 'hidden') addAction(actions, 'Restore post', (event) => {
            void submitReview('post', post.id, 'restore', event.currentTarget);
          });
          if (post.moderation_status === 'hidden') addAction(actions, 'Remove post', (event) => {
            void submitReview('post', post.id, 'remove', event.currentTarget);
          });
        });
        if (!count) append(queue, 'p', 'The review queue is empty.', 'community-comment-state');
        setStatus(moderationStatus, `${count} item${count === 1 ? '' : 's'} in the review queue.`, 'success');
      } catch {
        moderationQueue.replaceChildren();
        setStatus(moderationStatus, 'The review queue could not be loaded. Verify reviewer authorization and retry.', 'error');
      } finally { queueLoading = false; }
    };

    suggestionForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!currentUser) { setStatus(suggestionStatus, 'Sign in to submit a suggestion.', 'error'); return; }
      const title = suggestionForm.elements.namedItem('suggestion-title').value.trim();
      const description = suggestionForm.elements.namedItem('suggestion-detail').value.trim();
      if (!title || title.length > 120 || !description || description.length > 3000) {
        setStatus(suggestionStatus, 'Enter a title (1–120 characters) and description (1–3,000 characters).', 'error'); return;
      }
      const button = suggestionForm.querySelector('[type="submit"]');
      button.disabled = true; button.setAttribute('aria-busy', 'true');
      setStatus(suggestionStatus, 'Saving suggestion…', 'loading');
      const { error } = await client.from('community_suggestions').insert({ title, description, idempotency_key: crypto.randomUUID() });
      if (error) setStatus(suggestionStatus, 'Suggestion could not be saved. Check your connection or rate limit and retry.', 'error');
      else {
        suggestionForm.reset();
        setStatus(suggestionStatus, 'Suggestion submitted for review.', 'success');
        await loadSuggestions();
        await loadModerationQueue();
      }
      button.disabled = false; button.removeAttribute('aria-busy');
    });

    const openReport = (post, item) => {
      if (!currentUser) { setStatus($('[data-community-feed-status]'), 'Sign in to report a post.', 'error'); return; }
      item.querySelector('.community-report-form')?.remove();
      const reportForm = document.createElement('form'); reportForm.className = 'community-report-form';
      const reasonLabel = append(reportForm, 'label', 'Reason');
      const reason = document.createElement('input'); reason.name = 'reason'; reason.maxLength = 80; reason.required = true; reason.placeholder = 'Briefly describe the concern';
      reasonLabel.append(reason);
      const detailLabel = append(reportForm, 'label', 'Details (optional)');
      const details = document.createElement('textarea'); details.name = 'details'; details.maxLength = 1000; details.rows = 3;
      detailLabel.append(details);
      const message = append(reportForm, 'p', '', 'community-form-status'); message.setAttribute('role', 'status');
      const button = append(reportForm, 'button', 'Submit report', 'btn btn-secondary'); button.type = 'submit';
      reportForm.append(reasonLabel, detailLabel, message, button); item.append(reportForm);
      reportForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const reasonValue = reason.value.trim(); const detailsValue = details.value.trim();
        if (reasonValue.length < 3 || reasonValue.length > 80 || detailsValue.length > 1000) {
          setStatus(message, 'Enter a reason of 3–80 characters. Details may be up to 1,000 characters.', 'error'); return;
        }
        button.disabled = true; setStatus(message, 'Submitting report…', 'loading');
        const { error } = await client.from('community_reports').insert({ post_id: post.id, reason: reasonValue, details: detailsValue });
        if (error) {
          setStatus(message, error.code === '23505' ? 'You have already reported this post.' : 'Report could not be saved. Check your connection or rate limit and retry.', 'error');
          button.disabled = false;
        } else {
          setStatus(message, 'Report submitted privately to the moderation queue.', 'success');
          reason.disabled = true; details.disabled = true; button.disabled = true;
          await loadModerationQueue();
        }
      });
    };

    const setUser = (user) => {
      currentUser = user || null;
      suggestionForm.querySelectorAll('input,textarea,button').forEach((field) => { field.disabled = !currentUser; });
      if (moderationPanel) {
        const role = currentUser?.app_metadata?.cyberx_role;
        moderationPanel.hidden = !['admin','moderator'].includes(role);
      }
      setStatus(suggestionStatus, currentUser ? '' : 'Sign in to submit a suggestion and view your review status.');
      void loadSuggestions();
      void loadModerationQueue();
    };
    return { setUser, openReport };
  };

  const initLiveCommunityComposer = (backend, form, list) => {
    const client = backend.client;
    const titleInput = form.querySelector('[name="post-title"]');
    const categoryInput = form.querySelector('[name="post-category"]');
    const contentInput = form.querySelector('[name="post-content"]');
    const status = form.querySelector('[data-community-status]');
    const submit = form.querySelector('[type="submit"]');
    const feedStatus = $('[data-community-feed-status]');
    const authNote = $('[data-community-auth-note]');
    const headingPill = $('.community-page .feed-grid > .pad-card .section-heading .pill');
    const composerPill = $('[data-community-composer-mode]');
    let session = null;
    let submitting = false;
    let loading = false;
    if (!titleInput || !categoryInput || !contentInput || !status || !submit) return;
    if (headingPill) headingPill.textContent = 'Live feed';
    if ($('[data-community-mode]')) $('[data-community-mode]').textContent = 'Live feed';
    if (composerPill) composerPill.textContent = 'Connected';
    submit.textContent = 'Publish post';
    const safetyWorkflows = initCommunitySafetyWorkflows(client);

    const setStatus = (node, message, state = '') => {
      if (!node) return;
      node.textContent = message;
      if (state) node.dataset.state = state;
      else delete node.dataset.state;
    };
    const formatTime = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.valueOf())) return 'Recently';
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    };
    const appendText = (parent, tag, className, value) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = value == null ? '' : String(value);
      parent.append(node);
      return node;
    };
    const setAccessState = (user) => {
      session = user ? { user } : null;
      safetyWorkflows.setUser(user || null);
      const enabled = Boolean(user);
      if (authNote) authNote.hidden = enabled;
      form.querySelectorAll('input, select, textarea, button').forEach((field) => { field.disabled = !enabled || loading || submitting; });
      if (!enabled) setStatus(status, 'Sign in to create a post. Posts are saved only after the server confirms success.', '');
      else if (status.textContent.startsWith('Sign in to create')) setStatus(status, '');
    };

    const loadComments = async (postId, panel) => {
      panel.replaceChildren();
      const loadingText = appendText(panel, 'p', 'community-comment-state', 'Loading comments…');
      const { data, error } = await client.from('community_comment_feed')
        .select('id,post_id,author_display_name,content,created_at')
        .eq('post_id', postId).order('created_at', { ascending: true }).limit(50);
      loadingText.remove();
      if (error) { appendText(panel, 'p', 'community-comment-state', 'Comments could not be loaded.'); return; }
      if (!data.length) appendText(panel, 'p', 'community-comment-state', 'No comments yet.');
      data.forEach((comment) => {
        const item = document.createElement('div'); item.className = 'community-comment';
        const meta = document.createElement('div'); meta.className = 'post-meta';
        appendText(meta, 'strong', '', comment.author_display_name);
        const time = document.createElement('time'); time.dateTime = comment.created_at; time.textContent = formatTime(comment.created_at); meta.append(time);
        const body = appendText(item, 'p', '', comment.content);
        item.prepend(meta); panel.append(item);
      });
      if (!session) {
        const signIn = document.createElement('p'); signIn.className = 'community-comment-state';
        const link = document.createElement('a'); link.href = 'auth.html'; link.textContent = 'Sign in to add a comment';
        signIn.append(link); panel.append(signIn); return;
      }
      const commentForm = document.createElement('form'); commentForm.className = 'community-comment-form';
      const label = appendText(commentForm, 'label', '', 'Add a comment');
      const textarea = document.createElement('textarea'); textarea.maxLength = 2000; textarea.required = true; textarea.rows = 3; textarea.setAttribute('aria-label', 'Comment text');
      const message = appendText(commentForm, 'p', 'community-comment-state', ''); message.setAttribute('role', 'status');
      const button = document.createElement('button'); button.type = 'submit'; button.className = 'btn btn-secondary'; button.textContent = 'Post comment';
      label.append(textarea); commentForm.append(label, message, button); panel.append(commentForm);
      commentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const content = textarea.value.trim();
        if (!content || content.length > 2000) { message.textContent = 'Enter a comment of 1–2,000 characters.'; return; }
        button.disabled = true; message.textContent = 'Saving comment…';
        const { error: insertError } = await client.from('community_comments').insert({ post_id: postId, content });
        if (insertError) { message.textContent = 'Comment could not be saved. Please retry.'; button.disabled = false; return; }
        await loadComments(postId, panel);
        await loadFeed();
        setStatus(feedStatus, 'Comment saved.', 'success');
      });
    };

    const renderPost = (post, likedPostIds) => {
      const item = document.createElement('article'); item.className = 'post-card'; item.dataset.postId = post.id;
      const meta = document.createElement('div'); meta.className = 'post-meta';
      appendText(meta, 'span', '', post.author_display_name);
      const time = document.createElement('time'); time.dateTime = post.created_at; time.textContent = formatTime(post.created_at); meta.append(time);
      const category = appendText(item, 'span', 'tag-chip community-post-category', post.category);
      category.setAttribute('aria-label', `Category: ${post.category}`);
      appendText(item, 'h3', 'post-title', post.title);
      appendText(item, 'p', 'community-post-content', post.content);
      const actions = document.createElement('div'); actions.className = 'feed-actions';
      const votes = document.createElement('div'); votes.className = 'vote-row';
      const vote = document.createElement('button'); vote.type = 'button'; vote.className = 'vote-button'; vote.textContent = likedPostIds.has(post.id) ? '♥ Liked' : '♡ Like';
      vote.setAttribute('aria-pressed', String(likedPostIds.has(post.id))); vote.setAttribute('aria-label', likedPostIds.has(post.id) ? 'Remove like' : 'Like post');
      const count = appendText(votes, 'span', 'vote-value', post.like_count); votes.prepend(vote);
      vote.addEventListener('click', async () => {
        if (!session) { setStatus(feedStatus, 'Sign in to like a post.', 'error'); return; }
        vote.disabled = true;
        const wasLiked = likedPostIds.has(post.id);
        const result = wasLiked
          ? await client.from('community_reactions').delete().eq('post_id', post.id).eq('user_id', session.user.id)
          : await client.from('community_reactions').insert({ post_id: post.id });
        if (result.error) { setStatus(feedStatus, 'Your reaction could not be saved. Please retry.', 'error'); vote.disabled = false; return; }
        await loadFeed();
      });
      const commentButton = document.createElement('button'); commentButton.type = 'button'; commentButton.className = 'btn btn-secondary';
      commentButton.textContent = `Comments (${post.comment_count})`; commentButton.setAttribute('aria-expanded', 'false');
      commentButton.addEventListener('click', async () => {
        let panel = item.querySelector('.community-comments-panel');
        if (panel) { const willOpen = panel.hidden; panel.hidden = !willOpen; commentButton.setAttribute('aria-expanded', String(willOpen)); return; }
        panel = document.createElement('section'); panel.className = 'community-comments-panel'; panel.setAttribute('aria-label', `Comments on ${post.title}`);
        actions.before(panel); commentButton.setAttribute('aria-expanded', 'true');
        await loadComments(post.id, panel);
      });
      const reportButton = document.createElement('button'); reportButton.type = 'button'; reportButton.className = 'btn btn-secondary'; reportButton.textContent = 'Report';
      reportButton.addEventListener('click', () => safetyWorkflows.openReport(post, item));
      votes.append(count); actions.append(votes, commentButton, reportButton); item.append(meta, actions); return item;
    };

    const loadFeed = async () => {
      if (loading) return;
      loading = true; setStatus(feedStatus, 'Loading community posts…', 'loading');
      try {
        const { data, error } = await client.from('community_feed')
          .select('id,author_display_name,title,category,content,created_at,like_count,comment_count')
          .order('created_at', { ascending: false }).limit(20);
        if (error) throw error;
        const likedPostIds = new Set();
        if (session?.user && data.length) {
          const { data: reactions, error: reactionError } = await client.from('community_reactions')
            .select('post_id').eq('user_id', session.user.id).in('post_id', data.map((post) => post.id));
          if (reactionError) throw reactionError;
          reactions.forEach((reaction) => likedPostIds.add(reaction.post_id));
        }
        list.replaceChildren();
        if (!data.length) appendText(list, 'p', 'community-empty', 'No community posts yet.');
        data.forEach((post) => list.append(renderPost(post, likedPostIds)));
        setStatus(feedStatus, `${data.length} recent post${data.length === 1 ? '' : 's'} loaded.`, 'success');
      } catch {
        list.replaceChildren();
        appendText(list, 'p', 'community-empty', 'The community feed could not be loaded. Please refresh and try again.');
        setStatus(feedStatus, 'Community posts are temporarily unavailable.', 'error');
      } finally {
        loading = false;
        form.querySelectorAll('input, select, textarea, button').forEach((field) => { field.disabled = !session; });
      }
    };
    document.addEventListener('cyberx:community-moderated', () => { void loadFeed(); });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;
      if (!session) { setStatus(status, 'Sign in to create a post.', 'error'); return; }
      const title = titleInput.value.trim(); const category = categoryInput.value; const content = contentInput.value.trim();
      const categories = [...categoryInput.options].map((option) => option.value);
      const errors = { title: !title ? 'Enter a title.' : title.length > 120 ? 'Use 120 characters or fewer.' : '', category: categories.includes(category) ? '' : 'Choose a listed category.', content: !content ? 'Enter post content.' : content.length > 5000 ? 'Use 5,000 characters or fewer.' : '' };
      Object.entries(errors).forEach(([field, message]) => {
        const errorNode = form.querySelector(`[data-field-error="${field}"]`);
        if (errorNode) { errorNode.textContent = message; errorNode.hidden = !message; }
        const input = field === 'title' ? titleInput : field === 'category' ? categoryInput : contentInput;
        input.setAttribute('aria-invalid', String(Boolean(message)));
      });
      if (Object.values(errors).some(Boolean)) { setStatus(status, 'Review the highlighted fields and try again.', 'error'); return; }
      submitting = true; submit.disabled = true; submit.setAttribute('aria-busy', 'true'); setStatus(status, 'Saving your post…', 'loading');
      try {
        const { error } = await client.from('community_posts').insert({ title, category, content, idempotency_key: crypto.randomUUID() });
        if (error) {
          if (error.code === '23505') { await loadFeed(); setStatus(status, 'This submission was already received. Check the refreshed feed.', 'success'); }
          else throw error;
        } else {
          form.reset(); setStatus(status, 'Post published to the community feed.', 'success');
          await loadFeed();
        }
      } catch {
        setStatus(status, 'Your post could not be saved. Check the fields or connection and retry.', 'error');
      } finally {
        submitting = false; submit.removeAttribute('aria-busy');
        form.querySelectorAll('input, select, textarea, button').forEach((field) => { field.disabled = !session; });
      }
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      setAccessState(data.session?.user || null);
      return loadFeed();
    }).catch(() => { setAccessState(null); void loadFeed(); });
    client.auth.onAuthStateChange((_event, newSession) => {
      queueMicrotask(() => { setAccessState(newSession?.user || null); void loadFeed(); });
    });
  };

  const initCommunityComposer = () => {
    const form = document.querySelector('[data-community-form]');
    const list = document.querySelector('[data-community-feed]');
    if (!form || !list) return;
    const titleInput = form.querySelector('[name="post-title"]');
    const categoryInput = form.querySelector('[name="post-category"]');
    const contentInput = form.querySelector('[name="post-content"]');
    const status = form.querySelector('[data-community-status]');
    const submit = form.querySelector('[type="submit"]');
    if (!titleInput || !categoryInput || !contentInput || !status || !submit) return;
    if (window.CyberXBackend?.client) {
      initLiveCommunityComposer(window.CyberXBackend, form, list);
      return;
    }
    let submitting = false;
    const renderEmptyState = () => {
      const hasPosts = Boolean(list.querySelector('.post-card'));
      const emptyState = list.querySelector('.community-empty');
      if (hasPosts) emptyState?.remove();
      else if (!emptyState) {
        const empty = document.createElement('p');
        empty.className = 'community-empty';
        empty.textContent = 'No community posts yet.';
        list.append(empty);
      }
    };
    renderEmptyState();
    new MutationObserver(renderEmptyState).observe(list, { childList: true });

    const setError = (field, message) => {
      const error = form.querySelector(`[data-field-error="${field}"]`);
      const input = field === 'title' ? titleInput : field === 'category' ? categoryInput : contentInput;
      if (error) { error.textContent = message; error.hidden = !message; }
      input.setAttribute('aria-invalid', String(Boolean(message)));
    };
    const setStatus = (message, state = '') => {
      status.textContent = message;
      if (state) status.dataset.state = state;
      else delete status.dataset.state;
    };

    form.addEventListener('input', () => {
      setStatus('');
      setError('title', ''); setError('category', ''); setError('content', '');
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (submitting) return;
      const title = titleInput.value.trim();
      const category = categoryInput.value;
      const content = contentInput.value.trim();
      const validCategories = [...categoryInput.options].map((option) => option.value);
      setError('title', !title ? 'Enter a title.' : title.length > 120 ? 'Use 120 characters or fewer.' : '');
      setError('category', !validCategories.includes(category) ? 'Choose a listed category.' : '');
      setError('content', !content ? 'Enter post content.' : content.length > 5000 ? 'Use 5,000 characters or fewer.' : '');
      if (!title || title.length > 120 || !validCategories.includes(category) || !content || content.length > 5000) {
        setStatus('Review the highlighted fields and try again.', 'error');
        (form.querySelector('[aria-invalid="true"]') || titleInput).focus();
        return;
      }
      submitting = true;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      setStatus('Adding your post to this demo feed…', 'loading');

      // The current Community feed is a local demo: append safely, never imply persistence.
      requestAnimationFrame(() => {
        try {
          const item = document.createElement('article');
          item.className = 'post-card';
          const meta = document.createElement('div'); meta.className = 'post-meta';
          const author = document.createElement('span'); author.textContent = 'Demo author';
          const time = document.createElement('time'); time.textContent = 'Just now'; time.dateTime = new Date().toISOString();
          meta.append(author, time);
          const categoryLabel = document.createElement('span'); categoryLabel.className = 'tag-chip community-post-category'; categoryLabel.textContent = category;
          const heading = document.createElement('h3'); heading.className = 'post-title'; heading.textContent = title;
          const body = document.createElement('p'); body.textContent = content;
          const actions = document.createElement('div'); actions.className = 'feed-actions';
          const votes = document.createElement('div'); votes.className = 'vote-row'; votes.dataset.voteContainer = '';
          const vote = document.createElement('button'); vote.type = 'button'; vote.className = 'vote-button'; vote.dataset.vote = 'up'; vote.textContent = '▲ Like';
          const count = document.createElement('span'); count.className = 'vote-value'; count.dataset.voteCount = ''; count.textContent = '0';
          votes.append(vote, count);
          const comment = document.createElement('button'); comment.type = 'button'; comment.className = 'btn btn-secondary'; comment.dataset.demoAction = 'demo'; comment.dataset.demoMessage = 'Comments are not connected in this demo.'; comment.textContent = 'Comment';
          actions.append(votes, comment);
          item.append(meta, categoryLabel, heading, body, actions);
          list.querySelector('.community-empty')?.remove();
          list.prepend(item);
          form.reset();
          setError('title', ''); setError('category', ''); setError('content', '');
          setStatus('Added to this browser session only. This post was not saved to a server.', 'success');
          showToast('Demo post added locally; it is not saved.', 'success');
          initVoteButtons();
          initDemoInteractions();
        } catch {
          setStatus('The demo post could not be displayed. Your form contents are still available.', 'error');
          showToast('Could not add the demo post. Please try again.', 'error');
        } finally {
          submitting = false;
          submit.disabled = false;
          submit.removeAttribute('aria-busy');
        }
      });
    });
  };

  const initSuggestionForm = () => {
    const form = document.querySelector('[data-suggestion-form]');
    if (!form) return;
    if (window.CyberXBackend?.client) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = form.querySelector('[name="suggestion-title"]');
      const detail = form.querySelector('[name="suggestion-detail"]');
      if (!title || !detail || !title.value.trim() || !detail.value.trim()) {
        showToast('Add a suggestion title and details.', 'error');
        return;
      }
      showToast('Suggestion submitted in demo mode.', 'success');
      form.reset();
    });
  };

  const initThemeToggles = () => {
    document.querySelectorAll('[data-toggle-switch]').forEach((switchEl) => {
      switchEl.addEventListener('click', () => {
        switchEl.classList.toggle('on');
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initGlobalNavigation();
    initMobileMenu();
    initFilterPills();
    initDemoInteractions();
    initFormValidation();
    initPasswordToggles();
    initTabs();
    initResourceSearch();
    initVoteButtons();
    initNotifications();
    initChatAssistant();
    initCommunityComposer();
    initAuthIntegration();
    initProfileIntegration();
    initLearningProgress();
    initDashboardProgress();
    initSuggestionForm();
    initThemeToggles();
  });
})();
