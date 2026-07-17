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
    'skin-task-banner', 'skin-task-off', 'skin-scrollbars-hidden',
  ];
  let observer;
  let timer;
  let scheduled;

  const clamp = (value, minimum, maximum, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  };

  const configurableSurfaceProperties = [
    '--skin-region-color', '--skin-region-opacity', '--skin-region-border-opacity',
    '--skin-region-blur', '--skin-region-radius', '--skin-region-shadow',
  ];
  const configurableSurfaceShadows = {
    none: 'none',
    soft: '0 10px 28px color-mix(in oklab, #101411 20%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 38%, transparent)',
    strong: '0 18px 48px color-mix(in oklab, #080b0a 36%, transparent), 0 3px 10px color-mix(in oklab, #080b0a 18%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 58%, transparent)',
  };
  const applyConfigurableSurface = (node, className, config, defaults) => {
    if (!node) return;
    const value = config || {};
    const color = /^#[0-9a-f]{6}$/i.test(value.background || '')
      ? value.background
      : defaults.color;
    node.classList.add('skin-configurable-surface', className);
    node.classList.toggle('skin-configurable-hidden', value.visible === false);
    node.style.setProperty('--skin-region-color', color);
    node.style.setProperty('--skin-region-opacity', `${Math.round(clamp(value.opacity, 0, 1, defaults.opacity) * 100)}%`);
    node.style.setProperty('--skin-region-border-opacity', `${Math.round(clamp(value.borderOpacity, 0, 1, defaults.borderOpacity) * 100)}%`);
    node.style.setProperty('--skin-region-blur', `${Math.round(clamp(value.blur, 0, 32, defaults.blur))}px`);
    node.style.setProperty('--skin-region-radius', `${Math.round(clamp(value.radius, 0, 32, defaults.radius))}px`);
    node.style.setProperty(
      '--skin-region-shadow',
      configurableSurfaceShadows[value.shadow] || configurableSurfaceShadows[defaults.shadow],
    );
  };

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
    const composer = theme.composer || {};
    const composerColor = /^#[0-9a-f]{6}$/i.test(composer.background || '')
      ? composer.background
      : 'var(--skin-surface)';
    const composerShadows = {
      none: 'none',
      soft: '0 10px 28px color-mix(in oklab, #101411 22%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 55%, transparent)',
      strong: '0 18px 48px color-mix(in oklab, #080b0a 34%, transparent), 0 3px 10px color-mix(in oklab, #080b0a 18%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 64%, transparent)',
    };
    root.style.setProperty('--skin-composer-color', composerColor);
    root.style.setProperty('--skin-composer-opacity', `${Math.round(clamp(composer.opacity, 0, 1, 0.88) * 100)}%`);
    root.style.setProperty('--skin-composer-border-opacity', `${Math.round(clamp(composer.borderOpacity, 0, 1, 0.65) * 100)}%`);
    root.style.setProperty('--skin-composer-blur', `${Math.round(clamp(composer.blur, 0, 32, 12))}px`);
    root.style.setProperty('--skin-composer-shadow', composerShadows[composer.shadow] || composerShadows.soft);
    for (const footer of document.querySelectorAll('[data-thread-scroll-footer="true"]')) {
      const hasComposer = Boolean(footer.querySelector('.composer-surface-chrome'));
      for (const layer of footer.children) {
        if (layer.querySelector('.composer-surface-chrome')) continue;
        layer.classList.toggle(
          'skin-composer-footer-backdrop',
          hasComposer && composer.showFooterBackdrop !== true,
        );
      }
    }
    const environment = theme.environment || {};
    const environmentColor = /^#[0-9a-f]{6}$/i.test(environment.background || '')
      ? environment.background
      : 'var(--skin-surface)';
    const environmentShadows = {
      none: 'none',
      soft: '0 14px 36px color-mix(in oklab, #101411 24%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 45%, transparent)',
      strong: '0 22px 58px color-mix(in oklab, #080b0a 38%, transparent), 0 4px 12px color-mix(in oklab, #080b0a 20%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 62%, transparent)',
    };
    root.style.setProperty('--skin-environment-color', environmentColor);
    root.style.setProperty('--skin-environment-opacity', `${Math.round(clamp(environment.opacity, 0, 1, 0.92) * 100)}%`);
    root.style.setProperty('--skin-environment-border-opacity', `${Math.round(clamp(environment.borderOpacity, 0, 1, 0.55) * 100)}%`);
    root.style.setProperty('--skin-environment-blur', `${Math.round(clamp(environment.blur, 0, 32, 12))}px`);
    root.style.setProperty('--skin-environment-radius', `${Math.round(clamp(environment.radius, 8, 32, 24))}px`);
    root.style.setProperty('--skin-environment-shadow', environmentShadows[environment.shadow] || environmentShadows.soft);
    for (const panel of document.querySelectorAll('[data-pip-obstacle="thread-summary-panel"]')) {
      panel.classList.toggle('skin-environment-panel-hidden', environment.visible === false);
      panel.firstElementChild?.firstElementChild?.classList.add('skin-environment-panel-surface');
    }
    const changeSummary = theme.changeSummary || {};
    const changeSummaryColor = /^#[0-9a-f]{6}$/i.test(changeSummary.background || '')
      ? changeSummary.background
      : 'var(--skin-surface)';
    const changeSummaryShadows = {
      none: 'none',
      soft: '0 10px 28px color-mix(in oklab, #101411 20%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 38%, transparent)',
      strong: '0 18px 46px color-mix(in oklab, #080b0a 34%, transparent), 0 3px 10px color-mix(in oklab, #080b0a 18%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--skin-line) 58%, transparent)',
    };
    root.style.setProperty('--skin-change-summary-color', changeSummaryColor);
    root.style.setProperty('--skin-change-summary-opacity', `${Math.round(clamp(changeSummary.opacity, 0, 1, 0.72) * 100)}%`);
    root.style.setProperty('--skin-change-summary-border-opacity', `${Math.round(clamp(changeSummary.borderOpacity, 0, 1, 0.45) * 100)}%`);
    root.style.setProperty('--skin-change-summary-blur', `${Math.round(clamp(changeSummary.blur, 0, 32, 8))}px`);
    root.style.setProperty('--skin-change-summary-radius', `${Math.round(clamp(changeSummary.radius, 8, 32, 12))}px`);
    root.style.setProperty('--skin-change-summary-shadow', changeSummaryShadows[changeSummary.shadow] || changeSummaryShadows.soft);
    for (const header of document.querySelectorAll('[class~="group/turn-diff-header"]')) {
      const card = header.parentElement;
      card?.classList.add('skin-change-summary-card');
      card?.classList.toggle('skin-change-summary-hidden', changeSummary.visible === false);
    }
    const ui = theme.ui || {};
    applyConfigurableSurface(sidebar, 'skin-sidebar-surface', ui.sidebar, {
      color: 'var(--skin-sidebar)', opacity: 0.76, borderOpacity: 0.25,
      blur: 8, radius: 0, shadow: 'none',
    });
    const headerDefaults = {
      color: 'var(--skin-surface)', opacity: 0.42, borderOpacity: 0.25,
      blur: 8, radius: 0, shadow: 'none',
    };
    applyConfigurableSurface(
      document.querySelector('main.main-surface > header.app-header-tint'),
      'skin-header-surface',
      ui.header,
      headerDefaults,
    );
    applyConfigurableSurface(
      document.querySelector('[class~="group/application-menu-top-bar"]'),
      'skin-application-menu-surface',
      {
        ...ui.header,
        visible: true,
        opacity: Math.max(0.72, clamp(ui.header?.opacity, 0, 1, headerDefaults.opacity)),
        radius: 0,
        shadow: 'none',
      },
      headerDefaults,
    );
    for (const bubble of document.querySelectorAll('[data-user-message-bubble="true"]')) {
      applyConfigurableSurface(bubble, 'skin-user-bubble-surface', ui.userBubble, {
        color: 'var(--skin-surface)', opacity: 0.62, borderOpacity: 0.25,
        blur: 4, radius: 20, shadow: 'none',
      });
    }
    const codeBlocks = new Set();
    for (const node of document.querySelectorAll('[class]')) {
      if ([...node.classList].some((token) => token.startsWith('_codeBlock_'))) codeBlocks.add(node);
    }
    for (const pre of document.querySelectorAll('pre')) {
      codeBlocks.add(pre.closest('[class*="bg-token-text-code-block-background"]') || pre);
    }
    for (const codeBlock of codeBlocks) {
      applyConfigurableSurface(codeBlock, 'skin-code-block-surface', ui.codeBlock, {
        color: 'var(--skin-surface)', opacity: 0.82, borderOpacity: 0.35,
        blur: 6, radius: 12, shadow: 'soft',
      });
    }
    for (const activityHeader of document.querySelectorAll('[class~="group/activity-header"]')) {
      applyConfigurableSurface(activityHeader.parentElement, 'skin-activity-card-surface', ui.activityCard, {
        color: 'var(--skin-surface)', opacity: 0.68, borderOpacity: 0.3,
        blur: 4, radius: 12, shadow: 'none',
      });
    }

    const threadRows = ui.threadRows || {};
    root.style.setProperty('--skin-thread-row-color', /^#[0-9a-f]{6}$/i.test(threadRows.background || '') ? threadRows.background : 'var(--skin-accent)');
    root.style.setProperty('--skin-thread-row-opacity', `${Math.round(clamp(threadRows.opacity, 0, 1, 0) * 100)}%`);
    root.style.setProperty('--skin-thread-row-hover-opacity', `${Math.round(clamp(threadRows.hoverOpacity, 0, 1, 0.1) * 100)}%`);
    root.style.setProperty('--skin-thread-row-selected-opacity', `${Math.round(clamp(threadRows.selectedOpacity, 0, 1, 0.18) * 100)}%`);
    root.style.setProperty('--skin-thread-row-radius', `${Math.round(clamp(threadRows.radius, 0, 24, 8))}px`);
    for (const row of document.querySelectorAll('[data-app-action-sidebar-thread-row]')) {
      row.classList.add('skin-thread-row');
      row.classList.toggle('skin-thread-row-hidden', threadRows.visible === false);
    }

    const summaryRows = ui.summaryRows || {};
    root.style.setProperty('--skin-summary-row-color', /^#[0-9a-f]{6}$/i.test(summaryRows.background || '') ? summaryRows.background : 'var(--skin-accent)');
    root.style.setProperty('--skin-summary-row-opacity', `${Math.round(clamp(summaryRows.opacity, 0, 1, 0) * 100)}%`);
    root.style.setProperty('--skin-summary-row-hover-opacity', `${Math.round(clamp(summaryRows.hoverOpacity, 0, 1, 0.12) * 100)}%`);
    root.style.setProperty('--skin-summary-row-selected-opacity', `${Math.round(clamp(summaryRows.selectedOpacity, 0, 1, 0.16) * 100)}%`);
    root.style.setProperty('--skin-summary-row-radius', `${Math.round(clamp(summaryRows.radius, 0, 24, 8))}px`);
    for (const row of document.querySelectorAll('[data-slot="thread-summary-panel-item-button"]')) {
      row.classList.add('skin-summary-row');
      row.classList.toggle('skin-summary-row-hidden', summaryRows.visible === false);
    }

    root.style.setProperty('--skin-navigation-rail-opacity', String(clamp(ui.navigationRailOpacity, 0, 1, 0.7)));
    for (const rail of document.querySelectorAll('[data-thread-user-message-navigation-rail-list="true"]')) {
      rail.classList.toggle('skin-navigation-rail-hidden', ui.navigationRailVisible === false);
      rail.classList.add('skin-navigation-rail');
    }

    const scrollbar = ui.scrollbar || {};
    root.classList.toggle('skin-scrollbars-hidden', scrollbar.visible === false);
    root.style.setProperty('--skin-scrollbar-color', /^#[0-9a-f]{6}$/i.test(scrollbar.color || '') ? scrollbar.color : 'var(--skin-line)');
    root.style.setProperty('--skin-scrollbar-opacity', `${Math.round(clamp(scrollbar.opacity, 0, 1, 0.45) * 100)}%`);
    root.style.setProperty('--skin-scrollbar-width', `${Math.round(clamp(scrollbar.width, 4, 16, 8))}px`);
    root.style.setProperty('--skin-scrollbar-radius', `${Math.round(clamp(scrollbar.radius, 0, 16, 8))}px`);

    const diff = ui.diff || {};
    root.style.setProperty('--skin-diff-color', /^#[0-9a-f]{6}$/i.test(diff.background || '') ? diff.background : 'var(--skin-surface)');
    root.style.setProperty('--skin-diff-opacity', `${Math.round(clamp(diff.opacity, 0, 1, 0.12) * 100)}%`);
    root.style.setProperty('--skin-diff-added', /^#[0-9a-f]{6}$/i.test(diff.addedColor || '') ? diff.addedColor : '#22c55e');
    root.style.setProperty('--skin-diff-deleted', /^#[0-9a-f]{6}$/i.test(diff.deletedColor || '') ? diff.deletedColor : '#ef4444');
    root.style.setProperty('--skin-diff-radius', `${Math.round(clamp(diff.radius, 0, 24, 6))}px`);
    for (const row of document.querySelectorAll('.thread-diff-virtualized')) {
      row.classList.add('skin-diff-row');
      row.classList.toggle('skin-diff-row-hidden', diff.visible === false);
    }

    const content = ui.content || {};
    root.style.setProperty('--thread-content-max-width', `${Math.round(clamp(content.maxWidth, 560, 1200, 768))}px`);
    root.style.setProperty('--skin-content-font-scale', String(clamp(content.fontScale, 0.8, 1.3, 1)));
    root.style.setProperty('--skin-message-gap', `${Math.round(clamp(content.messageGap, 4, 32, 16))}px`);
    for (const conversation of document.querySelectorAll('[data-thread-find-target="conversation"]')) {
      conversation.firstElementChild?.firstElementChild?.classList.add('skin-message-stack');
    }

    const richText = ui.richText || {};
    root.style.setProperty('--skin-link-color', /^#[0-9a-f]{6}$/i.test(richText.linkColor || '') ? richText.linkColor : 'var(--skin-accent)');
    root.style.setProperty('--skin-inline-code-color', /^#[0-9a-f]{6}$/i.test(richText.inlineCodeBackground || '') ? richText.inlineCodeBackground : 'var(--skin-surface)');
    root.style.setProperty('--skin-inline-code-opacity', `${Math.round(clamp(richText.inlineCodeOpacity, 0, 1, 0.65) * 100)}%`);
    root.style.setProperty('--skin-inline-code-radius', `${Math.round(clamp(richText.inlineCodeRadius, 0, 24, 6))}px`);
    root.style.setProperty('--skin-quote-accent', /^#[0-9a-f]{6}$/i.test(richText.quoteAccent || '') ? richText.quoteAccent : 'var(--skin-accent)');
    root.style.setProperty('--skin-quote-color', /^#[0-9a-f]{6}$/i.test(richText.quoteBackground || '') ? richText.quoteBackground : 'var(--skin-surface)');
    root.style.setProperty('--skin-quote-opacity', `${Math.round(clamp(richText.quoteOpacity, 0, 1, 0.24) * 100)}%`);
    root.style.setProperty('--skin-table-border', /^#[0-9a-f]{6}$/i.test(richText.tableBorder || '') ? richText.tableBorder : 'var(--skin-line)');
    root.style.setProperty('--skin-table-color', /^#[0-9a-f]{6}$/i.test(richText.tableBackground || '') ? richText.tableBackground : 'var(--skin-surface)');
    root.style.setProperty('--skin-table-opacity', `${Math.round(clamp(richText.tableOpacity, 0, 1, 0.4) * 100)}%`);
    root.style.setProperty('--skin-table-radius', `${Math.round(clamp(richText.tableRadius, 0, 24, 8))}px`);
    root.style.setProperty('--skin-image-radius', `${Math.round(clamp(richText.imageRadius, 0, 32, 8))}px`);
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
    for (const property of [
      '--skin-art', '--skin-art-position', '--skin-accent', '--skin-composer-color',
      '--skin-composer-opacity', '--skin-composer-border-opacity', '--skin-composer-blur',
      '--skin-composer-shadow', '--skin-environment-color', '--skin-environment-opacity',
      '--skin-environment-border-opacity', '--skin-environment-blur',
      '--skin-environment-radius', '--skin-environment-shadow',
      '--skin-change-summary-color', '--skin-change-summary-opacity',
      '--skin-change-summary-border-opacity', '--skin-change-summary-blur',
      '--skin-change-summary-radius', '--skin-change-summary-shadow',
      '--skin-thread-row-color', '--skin-thread-row-opacity', '--skin-thread-row-hover-opacity',
      '--skin-thread-row-selected-opacity', '--skin-thread-row-radius',
      '--skin-summary-row-color', '--skin-summary-row-opacity',
      '--skin-summary-row-hover-opacity', '--skin-summary-row-selected-opacity',
      '--skin-summary-row-radius',
      '--skin-navigation-rail-opacity', '--skin-scrollbar-color', '--skin-scrollbar-opacity',
      '--skin-scrollbar-width', '--skin-scrollbar-radius', '--skin-diff-color',
      '--skin-diff-opacity', '--skin-diff-added', '--skin-diff-deleted', '--skin-diff-radius',
      '--thread-content-max-width', '--skin-content-font-scale', '--skin-message-gap',
      '--skin-link-color', '--skin-inline-code-color', '--skin-inline-code-opacity',
      '--skin-inline-code-radius', '--skin-quote-accent', '--skin-quote-color',
      '--skin-quote-opacity', '--skin-table-border', '--skin-table-color',
      '--skin-table-opacity', '--skin-table-radius', '--skin-image-radius',
    ]) root.style.removeProperty(property);
    document.querySelectorAll('.skin-home').forEach((node) => node.classList.remove('skin-home'));
    document.querySelectorAll('.skin-task').forEach((node) => node.classList.remove('skin-task'));
    document.querySelectorAll('.skin-home-shell').forEach((node) => node.classList.remove('skin-home-shell'));
    document.querySelectorAll('.skin-composer-footer-backdrop').forEach((node) => node.classList.remove('skin-composer-footer-backdrop'));
    document.querySelectorAll('.skin-environment-panel-hidden').forEach((node) => node.classList.remove('skin-environment-panel-hidden'));
    document.querySelectorAll('.skin-environment-panel-surface').forEach((node) => node.classList.remove('skin-environment-panel-surface'));
    document.querySelectorAll('.skin-change-summary-hidden').forEach((node) => node.classList.remove('skin-change-summary-hidden'));
    document.querySelectorAll('.skin-change-summary-card').forEach((node) => node.classList.remove('skin-change-summary-card'));
    document.querySelectorAll('.skin-configurable-surface').forEach((node) => {
      node.classList.remove(
        'skin-configurable-surface', 'skin-configurable-hidden', 'skin-sidebar-surface',
        'skin-header-surface', 'skin-application-menu-surface', 'skin-user-bubble-surface',
        'skin-code-block-surface', 'skin-activity-card-surface',
      );
      for (const property of configurableSurfaceProperties) node.style.removeProperty(property);
    });
    document.querySelectorAll('.skin-thread-row').forEach((node) => node.classList.remove('skin-thread-row', 'skin-thread-row-hidden'));
    document.querySelectorAll('.skin-summary-row').forEach((node) => node.classList.remove('skin-summary-row', 'skin-summary-row-hidden'));
    document.querySelectorAll('.skin-navigation-rail').forEach((node) => node.classList.remove('skin-navigation-rail', 'skin-navigation-rail-hidden'));
    document.querySelectorAll('.skin-diff-row').forEach((node) => node.classList.remove('skin-diff-row', 'skin-diff-row-hidden'));
    document.querySelectorAll('.skin-message-stack').forEach((node) => node.classList.remove('skin-message-stack'));
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
