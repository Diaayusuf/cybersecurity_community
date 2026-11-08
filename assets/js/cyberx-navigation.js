/* Single source of truth for public site navigation and the homepage terminal. */
(function () {
  const categories = [
    { name: 'Main', items: [
      { name: 'Home', destination: '#home', aliases: ['index', 'homepage'] },
    ] },
    { name: 'Teams', items: [
      { name: 'Red Team', destination: '#red-team', aliases: ['red', 'redteam', 'operations red'] },
      { name: 'Blue Team', destination: '#blue-team', aliases: ['blue', 'blueteam', 'defense', 'defence'] },
    ] },
    { name: 'Intelligence', items: [
      { name: 'Secret', destination: 'puzzle.html', aliases: ['secret puzzle', 'hidden puzzle'] },
      { name: 'Awareness', destination: 'awareness.html', aliases: ['security awareness'] },
      { name: 'Articles', destination: '#articles', aliases: ['article', 'news'] },
      { name: 'Resources', destination: 'resources.html', aliases: ['resource'] },
    ] },
    { name: 'Platform', items: [
      { name: 'Learning', destination: 'learning.html', aliases: ['learn', 'courses'] },
      { name: 'Puzzle Arena', destination: 'puzzle.html', aliases: ['puzzle', 'arena', 'challenges'] },
      { name: 'Experience', destination: '#experience', aliases: ['experiences', 'share experience'] },
      { name: 'Dashboard', destination: 'dashboard.html', aliases: ['dash', 'mission dashboard'] },
      { name: 'Leaderboard', destination: 'leaderboard.html', aliases: ['leader board', 'hall of fame'] },
    ] },
    { name: 'Community', items: [
      { name: 'Community', destination: 'community.html', aliases: ['forum', 'community feed'] },
      { name: 'AI Assistant', destination: 'assistant.html', aliases: ['assistant', 'ai', 'chat'] },
      { name: 'Donate', destination: '#donate', aliases: ['donation', 'support'] },
    ] },
    { name: 'Account', items: [
      { name: 'Sign In', destination: 'auth.html', aliases: ['sign-in', 'signin', 'login', 'auth'] },
      { name: 'Profile', destination: 'profile.html', aliases: ['account', 'my profile'] },
      // Existing public route retained from the previous homepage navbar.
      { name: 'Pricing', destination: 'pricing.html', aliases: ['plans', 'membership'] },
    ] },
  ];

  categories.forEach(category => category.items.forEach(item => {
    item.category = category.name;
    item.availability = 'available';
    item.access = 'public';
  }));

  const navigation = { categories };
  window.CYBERX_NAVIGATION = navigation;

  // The homepage keeps its original nav components and styling; only link data is shared.
  const renderHomepageNavigation = () => {
    const desktop = document.querySelector('#main-nav .home-nav-desktop');
    const mobile = document.getElementById('home-mobile-nav');
    if (!desktop || !mobile) return;

    const makeLink = (item, className = '') => {
      const link = document.createElement('a');
      link.href = item.destination;
      link.textContent = item.name.toUpperCase();
      link.dataset.navigationPage = item.name;
      if (className) link.className = className;
      return link;
    };

    desktop.replaceChildren();
    mobile.replaceChildren();
    categories.forEach((category, index) => {
      if (category.name === 'Main') {
        const home = makeLink(category.items[0], 'home-nav-home');
        desktop.append(home);
        mobile.append(makeLink(category.items[0]));
        return;
      }

      const group = document.createElement('div');
      group.className = 'home-nav-group';
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'home-nav-trigger';
      trigger.textContent = category.name.toUpperCase();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', `home-nav-${index}-panel`);
      const panel = document.createElement('div');
      panel.className = 'home-nav-panel';
      panel.id = `home-nav-${index}-panel`;
      panel.setAttribute('aria-label', `${category.name} links`);
      category.items.filter(item => item.availability === 'available').forEach(item => panel.append(makeLink(item)));
      group.append(trigger, panel);
      desktop.append(group);

      const mobileGroup = document.createElement('div');
      mobileGroup.className = 'home-mobile-group';
      const mobileTrigger = document.createElement('button');
      mobileTrigger.type = 'button';
      mobileTrigger.className = 'home-mobile-group-toggle';
      mobileTrigger.textContent = category.name.toUpperCase();
      mobileTrigger.setAttribute('aria-expanded', 'false');
      mobileTrigger.setAttribute('aria-controls', `home-mobile-nav-${index}`);
      const mobilePanel = document.createElement('div');
      mobilePanel.className = 'home-mobile-group-panel';
      mobilePanel.id = `home-mobile-nav-${index}`;
      mobilePanel.hidden = true;
      category.items.filter(item => item.availability === 'available').forEach(item => mobilePanel.append(makeLink(item)));
      mobileGroup.append(mobileTrigger, mobilePanel);
      mobile.append(mobileGroup);
    });
  };

  renderHomepageNavigation();
})();
