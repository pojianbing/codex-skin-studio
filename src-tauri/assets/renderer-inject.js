((cssText, artDataUrl, theme, revision) => {
  const STATE = '__CODEX_SKIN_STUDIO_STATE__';
  const current = window[STATE];
  if (current?.revision === revision) {
    current.ensure?.();
    return { installed: true, revision, reused: true };
  }
  current?.cleanup?.();

  const root = document.documentElement;
  if (!root || !document.body) return { installed: false, reason: 'document-not-ready' };
  const binary = atob(artDataUrl.slice(artDataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const mime = /^data:([^;,]+)/.exec(artDataUrl)?.[1] || 'image/jpeg';
  const artUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const classes = [
    'codex-skin-studio', 'skin-theme-light', 'skin-theme-dark', 'skin-safe-left',
    'skin-safe-right', 'skin-safe-center', 'skin-safe-none', 'skin-task-ambient',
    'skin-task-banner', 'skin-task-off',
  ];
  let observer;
  let timer;
  let scheduled;

  const nativeAppearance = () => {
    const classNames = `${root.className} ${document.body.className}`.toLowerCase().replace(/skin-theme-(?:light|dark)/g, '');
    if (/\b(dark|electron-dark|theme-dark)\b/.test(classNames)) return 'dark';
    if (/\b(light|electron-light|theme-light)\b/.test(classNames)) return 'light';
    try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
  };

  const ensure = () => {
    const shell = document.querySelector('main.main-surface');
    const sidebar = document.querySelector('aside.app-shell-left-panel');
    if (!shell || !sidebar) return false;
    let style = document.getElementById('codex-skin-studio-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'codex-skin-studio-style';
      (document.head || root).appendChild(style);
    }
    if (style.textContent !== cssText) style.textContent = cssText;
    root.classList.add('codex-skin-studio');
    const appearance = theme.appearance === 'auto' ? nativeAppearance() : theme.appearance;
    root.classList.toggle('skin-theme-light', appearance === 'light');
    root.classList.toggle('skin-theme-dark', appearance === 'dark');

    let safeArea = theme.art.safeArea;
    if (safeArea === 'auto') {
      safeArea = theme.art.focusX > 0.6 ? 'left' : (theme.art.focusX < 0.4 ? 'right' : 'left');
    }
    for (const value of ['left', 'right', 'center', 'none']) {
      root.classList.toggle(`skin-safe-${value}`, safeArea === value);
    }

    let taskMode = theme.art.taskMode;
    if (taskMode === 'auto') {
      taskMode = 'ambient';
    }
    for (const value of ['ambient', 'banner', 'off']) {
      root.classList.toggle(`skin-task-${value}`, taskMode === value);
    }
    root.style.setProperty('--skin-art', `url("${artUrl}")`);
    root.style.setProperty('--skin-art-position', `${Math.round(theme.art.focusX * 100)}% ${Math.round(theme.art.focusY * 100)}%`);
    root.style.setProperty('--skin-accent', theme.palette.accent || '#3b82f6');
    const home = document.querySelector('[role="main"]:has([data-testid="home-icon"])');
    for (const candidate of document.querySelectorAll('[role="main"]')) {
      candidate.classList.toggle('skin-home', candidate === home);
      candidate.classList.toggle('skin-task', candidate !== home);
    }
    shell.classList.toggle('skin-home-shell', Boolean(home));
    return true;
  };

  const schedule = () => {
    clearTimeout(scheduled);
    scheduled = setTimeout(ensure, 120);
  };
  const cleanup = () => {
    clearTimeout(scheduled);
    clearInterval(timer);
    observer?.disconnect();
    document.getElementById('codex-skin-studio-style')?.remove();
    root.classList.remove(...classes);
    for (const property of ['--skin-art', '--skin-art-position', '--skin-accent']) root.style.removeProperty(property);
    document.querySelectorAll('.skin-home').forEach((node) => node.classList.remove('skin-home'));
    document.querySelectorAll('.skin-task').forEach((node) => node.classList.remove('skin-task'));
    document.querySelectorAll('.skin-home-shell').forEach((node) => node.classList.remove('skin-home-shell'));
    URL.revokeObjectURL(artUrl);
    if (window[STATE]?.revision === revision) delete window[STATE];
    return true;
  };

  observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-theme', 'data-appearance'] });
  timer = setInterval(ensure, 4000);
  window[STATE] = { revision, ensure, cleanup, observer, timer, artUrl };
  ensure();
  return { installed: true, revision };
})(__SKIN_CSS__, __SKIN_ART__, __SKIN_THEME__, __SKIN_REVISION__)
