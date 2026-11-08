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
    const forms = $$('form[data-validate]');
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
      statusBubble.innerHTML = '<strong>AI demo</strong><span>Analyzing the request in demo mode. A real backend integration is still pending.</span>';
      history.appendChild(statusBubble);

      input.value = '';
      history.scrollTop = history.scrollHeight;
    });

    clearButton?.addEventListener('click', () => {
      history.innerHTML = '<div class="assistant-message assistant"><strong>AI demo</strong><span>Conversation cleared. Ready for the next scenario.</span></div>';
      showToast('Conversation cleared.', 'success');
    });

    window.escapeHtml = window.escapeHtml || ((value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;'));
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
    initSuggestionForm();
    initThemeToggles();
  });
})();
