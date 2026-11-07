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
      button.addEventListener('click', () => {
        const container = button.closest('[data-vote-container]');
        const valueNode = container?.querySelector('[data-vote-count]');
        const current = Number(valueNode?.textContent || '0');
        const delta = button.dataset.vote === 'up' ? 1 : -1;
        if (valueNode) valueNode.textContent = String(current + delta);
        showToast('Vote recorded in demo mode.', 'success');
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

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = form.querySelector('[name="post-title"]');
      const content = form.querySelector('[name="post-content"]');
      if (!title || !content || !title.value.trim() || !content.value.trim()) {
        showToast('Add a title and content before posting.', 'error');
        return;
      }
      const item = document.createElement('article');
      item.className = 'post-card';
      item.innerHTML = '<div class="post-meta"><span>Demo author</span><span>Just now</span></div><h3 class="post-title">' + window.escapeHtml(title.value.trim()) + '</h3><p>' + window.escapeHtml(content.value.trim()) + '</p><div class="feed-actions"><div class="vote-row"><button type="button" class="vote-button" data-vote="up">▲ Like</button><span class="vote-value" data-vote-count>1</span></div><button type="button" class="btn btn-secondary" data-demo-action="demo">Comment</button></div>';
      list.prepend(item);
      form.reset();
      showToast('Demo post added to the community feed.', 'success');
      initVoteButtons();
      initDemoInteractions();
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
