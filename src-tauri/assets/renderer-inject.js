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
  const isVideo = mime === 'video/mp4';
  const classes = [
    'codex-skin-studio', 'skin-theme-light', 'skin-theme-dark', 'skin-safe-left',
    'skin-safe-right', 'skin-safe-center', 'skin-safe-none', 'skin-task-ambient',
    'skin-task-banner', 'skin-task-off', 'skin-scrollbars-hidden', 'skin-level-slider-custom',
    'skin-background-video',
  ];
  let observer;
  let timer;
  let scheduled;
  let videoLayer;
  const levelSliderBindings = new Map();

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

  const updateLevelSlider = (slider) => {
    const ticks = [...slider.querySelectorAll('[class*="_Tick_"]')];
    slider.querySelector('[class*="_Track_"]')?.classList.add('skin-level-slider-track');
    slider.querySelector('[class*="_Range_"]')?.classList.add('skin-level-slider-range');
    slider.querySelector('[class*="_Thumb_"]')?.classList.add('skin-level-slider-thumb');

    let selectedIndex = -1;
    ticks.forEach((tick, index) => {
      tick.classList.add('skin-level-slider-tick');
      if (tick.getAttribute('data-selected') === 'true') selectedIndex = index;
    });

    const activeIndex = Math.max(0, Math.min(4, selectedIndex));
    slider.classList.add('skin-level-slider');
    slider.style.setProperty('--skin-level-active-color', `var(--skin-level-color-${activeIndex})`);

    if (!levelSliderBindings.has(slider)) {
      const refresh = () => requestAnimationFrame(() => updateLevelSlider(slider));
      for (const event of ['click', 'change', 'input', 'keydown', 'pointermove', 'pointerup']) {
        slider.addEventListener(event, refresh, { passive: true });
      }
      levelSliderBindings.set(slider, refresh);
    }
  };

  const nativeAppearance = () => {
    const classNames = `${root.className} ${document.body.className}`.toLowerCase().replace(/skin-theme-(?:light|dark)/g, '');
    if (/\b(dark|electron-dark|theme-dark)\b/.test(classNames)) return 'dark';
    if (/\b(light|electron-light|theme-light)\b/.test(classNames)) return 'light';
    try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
  };

  const syncVideoPlayback = () => {
    if (!videoLayer) return;
    void videoLayer.play().catch(() => {});
  };

  const ensureVideoLayer = () => {
    if (!isVideo) return;
    videoLayer = document.getElementById('codex-skin-studio-video');
    if (!videoLayer) {
      videoLayer = document.createElement('video');
      videoLayer.id = 'codex-skin-studio-video';
      videoLayer.src = artUrl;
      videoLayer.autoplay = true;
      videoLayer.loop = false;
      videoLayer.muted = true;
      videoLayer.playsInline = true;
      videoLayer.preload = 'auto';
      videoLayer.setAttribute('aria-hidden', 'true');
      videoLayer.addEventListener('ended', () => {
        videoLayer.currentTime = 0;
        void videoLayer.play().catch(() => {});
      });
      document.body.prepend(videoLayer);
    }
    syncVideoPlayback();
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
    root.classList.toggle('skin-background-video', isVideo);
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
    if (isVideo) {
      root.style.removeProperty('--skin-art');
      ensureVideoLayer();
    } else {
      root.style.setProperty('--skin-art', `url("${artUrl}")`);
    }
    root.style.setProperty('--skin-art-position', `${Math.round(theme.art.focusX * 100)}% ${Math.round(theme.art.focusY * 100)}%`);
    root.style.setProperty('--skin-accent', theme.palette.accent || '#3b82f6');
    const resolvedColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
    const levelSlider = theme.levelSlider || {};
    const levelSliderEnabled = levelSlider.enabled !== false;
    root.classList.toggle('skin-level-slider-custom', levelSliderEnabled);
    const levelColorFallbacks = ['#22c55e', '#339cff', '#8b5cf6', '#f59e0b', '#ef4444'];
    for (let index = 0; index < levelColorFallbacks.length; index += 1) {
      root.style.setProperty(
        `--skin-level-color-${index}`,
        resolvedColor(levelSlider.levelColors?.[index], levelColorFallbacks[index]),
      );
    }
    root.style.setProperty(
      '--skin-level-thumb-color',
      resolvedColor(levelSlider.thumbColor, '#ffffff'),
    );
    const tokens = theme.tokens || {};
    root.style.setProperty('--skin-text-primary', resolvedColor(tokens.textPrimary, 'var(--skin-text)'));
    root.style.setProperty('--skin-text-secondary', resolvedColor(tokens.textSecondary, 'var(--skin-muted-text)'));
    root.style.setProperty('--skin-text-muted', resolvedColor(tokens.textMuted, 'var(--skin-muted-text)'));
    root.style.setProperty('--skin-text-disabled', resolvedColor(tokens.textDisabled, 'color-mix(in oklab, var(--skin-muted-text) 56%, transparent)'));
    root.style.setProperty('--skin-text-inverse', resolvedColor(tokens.textInverse, '#ffffff'));
    root.style.setProperty('--skin-border', resolvedColor(tokens.border, 'var(--skin-line)'));
    root.style.setProperty('--skin-focus-ring', resolvedColor(tokens.focusRing, 'var(--skin-accent)'));
    root.style.setProperty('--skin-success', resolvedColor(tokens.success, '#22c55e'));
    root.style.setProperty('--skin-warning', resolvedColor(tokens.warning, '#f59e0b'));
    root.style.setProperty('--skin-danger', resolvedColor(tokens.danger, '#ef4444'));
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
    root.style.setProperty('--skin-composer-opacity', `${Math.round(clamp(composer.opacity, 0, 1, 0.2) * 100)}%`);
    root.style.setProperty('--skin-composer-border-opacity', `${Math.round(clamp(composer.borderOpacity, 0, 1, 0.01) * 100)}%`);
    root.style.setProperty('--skin-composer-blur', `${Math.round(clamp(composer.blur, 0, 32, 12))}px`);
    root.style.setProperty('--skin-composer-shadow', composerShadows[composer.shadow] || composerShadows.none);
    root.style.setProperty('--skin-composer-radius', `${Math.round(clamp(composer.radius, 8, 32, 16))}px`);
    root.style.setProperty('--skin-composer-placeholder', resolvedColor(composer.placeholderColor, 'var(--skin-text-muted)'));
    root.style.setProperty('--skin-composer-control-color', resolvedColor(composer.controlColor, 'var(--skin-accent)'));
    root.style.setProperty('--skin-composer-control-opacity', `${Math.round(clamp(composer.controlOpacity, 0, 1, 0.14) * 100)}%`);
    root.style.setProperty('--skin-composer-control-radius', `${Math.round(clamp(composer.controlRadius, 0, 24, 8))}px`);
    root.style.setProperty('--skin-composer-action-color', resolvedColor(composer.primaryActionColor, 'var(--skin-accent)'));
    root.style.setProperty('--skin-composer-action-text', resolvedColor(composer.primaryActionText, 'var(--skin-text-inverse)'));
    const composerSurfaces = document.querySelectorAll('.composer-surface-chrome');
    for (const composerSurface of composerSurfaces) {
      const controls = composerSurface.querySelectorAll('button, [role="button"]');
      controls.forEach((control) => control.classList.add('skin-composer-control'));
      const primaryAction = [...controls].find((control) => {
        const label = `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`;
        return control.getAttribute('type') === 'submit' || /send|发送|stop|停止/i.test(label);
      });
      primaryAction?.classList.add('skin-composer-primary-action');
    }
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
    for (const layer of document.querySelectorAll('div')) {
      const isFileChangeFooterFade = layer.classList.contains('pointer-events-none')
        && layer.classList.contains('absolute')
        && layer.classList.contains('inset-x-0')
        && layer.classList.contains('-bottom-1')
        && layer.classList.contains('h-7')
        && layer.classList.contains('bg-gradient-to-t')
        && layer.classList.contains('from-token-main-surface-primary')
        && layer.classList.contains('to-transparent');
      if (isFileChangeFooterFade) {
        layer.classList.toggle('skin-composer-file-change-backdrop', composer.showFooterBackdrop !== true);
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
    root.style.setProperty('--skin-environment-opacity', `${Math.round(clamp(environment.opacity, 0, 1, 0.2) * 100)}%`);
    root.style.setProperty('--skin-environment-border-opacity', `${Math.round(clamp(environment.borderOpacity, 0, 1, 0.01) * 100)}%`);
    root.style.setProperty('--skin-environment-blur', `${Math.round(clamp(environment.blur, 0, 32, 12))}px`);
    root.style.setProperty('--skin-environment-radius', `${Math.round(clamp(environment.radius, 8, 32, 24))}px`);
    root.style.setProperty('--skin-environment-shadow', environmentShadows[environment.shadow] || environmentShadows.none);
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
    root.style.setProperty('--skin-change-summary-opacity', `${Math.round(clamp(changeSummary.opacity, 0, 1, 0.2) * 100)}%`);
    root.style.setProperty('--skin-change-summary-border-opacity', `${Math.round(clamp(changeSummary.borderOpacity, 0, 1, 0.45) * 100)}%`);
    root.style.setProperty('--skin-change-summary-blur', `${Math.round(clamp(changeSummary.blur, 0, 32, 8))}px`);
    root.style.setProperty('--skin-change-summary-radius', `${Math.round(clamp(changeSummary.radius, 8, 32, 12))}px`);
    root.style.setProperty('--skin-change-summary-shadow', changeSummaryShadows[changeSummary.shadow] || changeSummaryShadows.none);
    for (const header of document.querySelectorAll('[class~="group/turn-diff-header"]')) {
      const card = header.parentElement;
      card?.classList.add('skin-change-summary-card');
      card?.classList.toggle('skin-change-summary-hidden', changeSummary.visible === false);
    }
    for (const summary of document.querySelectorAll('div.rounded-3xl.border[class~="bg-token-input-background/70"]')) {
      const isCompactChangeSummary = summary.classList.contains('flex')
        && summary.classList.contains('w-max')
        && summary.classList.contains('max-w-full')
        && summary.classList.contains('min-w-0')
        && summary.classList.contains('items-center')
        && summary.classList.contains('gap-2')
        && summary.classList.contains('px-3')
        && summary.classList.contains('py-1.5')
        && summary.classList.contains('text-token-foreground')
        && summary.classList.contains('backdrop-blur-sm');
      if (isCompactChangeSummary) {
        summary.classList.add('skin-change-summary-compact');
        summary.classList.toggle('skin-change-summary-hidden', changeSummary.visible === false);
      }
    }
    const ui = theme.ui || {};
    applyConfigurableSurface(sidebar, 'skin-sidebar-surface', ui.sidebar, {
      color: 'var(--skin-sidebar)', opacity: 0.66, borderOpacity: 0.25,
      blur: 8, radius: 0, shadow: 'none',
    });
    const headerDefaults = {
      color: 'var(--skin-surface)', opacity: 0.42, borderOpacity: 0.25,
      blur: 8, radius: 0, shadow: 'none',
    };
    const taskHeader = document.querySelector('main.main-surface > header.app-header-tint');
    const applicationMenu = document.querySelector('[class~="group/application-menu-top-bar"]');
    applyConfigurableSurface(
      taskHeader,
      'skin-header-surface',
      ui.header,
      headerDefaults,
    );
    applyConfigurableSurface(
      applicationMenu,
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
        color: 'var(--skin-surface)', opacity: 0.2, borderOpacity: 0.25,
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
        color: 'var(--skin-surface)', opacity: 0.17, borderOpacity: 0,
        blur: 6, radius: 12, shadow: 'none',
      });
    }
    for (const activityHeader of document.querySelectorAll('[class~="group/activity-header"]')) {
      applyConfigurableSurface(activityHeader.parentElement, 'skin-activity-card-surface', ui.activityCard, {
        color: 'var(--skin-surface)', opacity: 0.2, borderOpacity: 0.3,
        blur: 4, radius: 12, shadow: 'none',
      });
    }
    const homeSuggestions = document.querySelector('[class~="group/home-suggestions"]');
    homeSuggestions?.classList.toggle('skin-home-suggestions-hidden', ui.homeSuggestions?.visible === false);
    for (const suggestion of document.querySelectorAll('[class~="group/home-suggestions"] button')) {
      applyConfigurableSurface(suggestion, 'skin-home-suggestion-surface', {
        ...ui.homeSuggestions,
        visible: true,
      }, {
        color: 'var(--skin-surface)', opacity: 0.2, borderOpacity: 0.16,
        blur: 8, radius: 4, shadow: 'none',
      });
    }

    const overlayConfig = { ...(ui.overlays || {}), visible: true };
    const overlayDefaults = {
      color: 'var(--skin-surface)', opacity: 0.92, borderOpacity: 0.5,
      blur: 14, radius: 12, shadow: 'strong',
    };
    const overlays = new Set();
    for (const selector of ['[role="dialog"]', '[role="menu"]', '[role="listbox"]', '[data-slot="popover-content"]']) {
      document.querySelectorAll(selector).forEach((node) => overlays.add(node));
    }
    for (const overlay of overlays) {
      applyConfigurableSurface(overlay, 'skin-overlay-surface', overlayConfig, overlayDefaults);
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
    root.style.setProperty('--skin-diff-color', /^#[0-9a-f]{6}$/i.test(diff.background || '') ? diff.background : '#ffffff');
    root.style.setProperty('--skin-diff-opacity', `${Math.round(clamp(diff.opacity, 0, 1, 0.03) * 100)}%`);
    root.style.setProperty('--skin-diff-hover-opacity', `${Math.round(clamp(diff.hoverOpacity, 0, 1, 0.01) * 100)}%`);
    root.style.setProperty('--skin-diff-added', /^#[0-9a-f]{6}$/i.test(diff.addedColor || '') ? diff.addedColor : '#22c55e');
    root.style.setProperty('--skin-diff-deleted', /^#[0-9a-f]{6}$/i.test(diff.deletedColor || '') ? diff.deletedColor : '#ef4444');
    root.style.setProperty('--skin-diff-radius', `${Math.round(clamp(diff.radius, 0, 24, 1))}px`);
    for (const row of document.querySelectorAll('.thread-diff-virtualized')) {
      row.classList.add('skin-diff-row');
      row.classList.toggle('skin-diff-row-hidden', diff.visible === false);
    }

    if (levelSliderEnabled) {
      for (const slider of document.querySelectorAll('[data-model-picker-power-slider]')) {
        updateLevelSlider(slider);
      }
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
    const homeWelcome = ui.homeWelcome || {};
    const homeIcons = home?.querySelectorAll('[data-testid="home-icon"]') || [];
    for (const icon of homeIcons) {
      icon.classList.toggle('skin-home-welcome-icon-hidden', homeWelcome.iconVisible === false);
    }
    const welcomeTitles = new Set(home?.querySelectorAll('h1, h2, [role="heading"]') || []);
    const suggestionGroup = home?.querySelector('[class~="group/home-suggestions"]');
    const addWelcomeTitle = (node) => {
      if (!node || node === home || node === suggestionGroup || (suggestionGroup && node.contains(suggestionGroup))) return;
      welcomeTitles.add(node);
    };
    for (const icon of homeIcons) {
      addWelcomeTitle(icon.nextElementSibling);
      addWelcomeTitle(icon.parentElement?.nextElementSibling);
    }
    addWelcomeTitle(suggestionGroup?.previousElementSibling);
    for (const title of welcomeTitles) {
      title.classList.toggle('skin-home-welcome-title-hidden', homeWelcome.titleVisible === false);
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
      '--skin-composer-shadow', '--skin-composer-radius', '--skin-composer-placeholder',
      '--skin-composer-control-color', '--skin-composer-control-opacity', '--skin-composer-control-radius',
      '--skin-composer-action-color', '--skin-composer-action-text', '--skin-text-primary',
      '--skin-text-secondary', '--skin-text-muted', '--skin-text-disabled', '--skin-text-inverse',
      '--skin-border', '--skin-focus-ring', '--skin-success', '--skin-warning', '--skin-danger',
      '--skin-environment-color', '--skin-environment-opacity',
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
      '--skin-diff-opacity', '--skin-diff-hover-opacity', '--skin-diff-added', '--skin-diff-deleted', '--skin-diff-radius',
      '--thread-content-max-width', '--skin-content-font-scale', '--skin-message-gap',
      '--skin-link-color', '--skin-inline-code-color', '--skin-inline-code-opacity',
      '--skin-inline-code-radius', '--skin-quote-accent', '--skin-quote-color',
      '--skin-quote-opacity', '--skin-table-border', '--skin-table-color',
      '--skin-table-opacity', '--skin-table-radius', '--skin-image-radius',
      '--skin-level-color-0', '--skin-level-color-1', '--skin-level-color-2',
      '--skin-level-color-3', '--skin-level-color-4', '--skin-level-thumb-color',
    ]) root.style.removeProperty(property);
    document.querySelectorAll('.skin-home').forEach((node) => node.classList.remove('skin-home'));
    document.querySelectorAll('.skin-task').forEach((node) => node.classList.remove('skin-task'));
    document.querySelectorAll('.skin-home-shell').forEach((node) => node.classList.remove('skin-home-shell'));
    document.querySelectorAll('.skin-home-welcome-icon-hidden').forEach((node) => node.classList.remove('skin-home-welcome-icon-hidden'));
    document.querySelectorAll('.skin-home-welcome-title-hidden').forEach((node) => node.classList.remove('skin-home-welcome-title-hidden'));
    document.querySelectorAll('.skin-composer-footer-backdrop').forEach((node) => node.classList.remove('skin-composer-footer-backdrop'));
    document.querySelectorAll('.skin-composer-file-change-backdrop').forEach((node) => node.classList.remove('skin-composer-file-change-backdrop'));
    document.querySelectorAll('.skin-environment-panel-hidden').forEach((node) => node.classList.remove('skin-environment-panel-hidden'));
    document.querySelectorAll('.skin-environment-panel-surface').forEach((node) => node.classList.remove('skin-environment-panel-surface'));
    document.querySelectorAll('.skin-change-summary-hidden').forEach((node) => node.classList.remove('skin-change-summary-hidden'));
    document.querySelectorAll('.skin-change-summary-card').forEach((node) => node.classList.remove('skin-change-summary-card'));
    document.querySelectorAll('.skin-change-summary-compact').forEach((node) => node.classList.remove('skin-change-summary-compact'));
    document.querySelectorAll('.skin-home-suggestions-hidden').forEach((node) => node.classList.remove('skin-home-suggestions-hidden'));
    document.querySelectorAll('.skin-configurable-surface').forEach((node) => {
      node.classList.remove(
        'skin-configurable-surface', 'skin-configurable-hidden', 'skin-sidebar-surface',
        'skin-header-surface', 'skin-application-menu-surface', 'skin-user-bubble-surface',
        'skin-code-block-surface', 'skin-activity-card-surface', 'skin-home-suggestion-surface', 'skin-overlay-surface',
      );
      for (const property of configurableSurfaceProperties) node.style.removeProperty(property);
    });
    document.querySelectorAll('.skin-thread-row').forEach((node) => node.classList.remove('skin-thread-row', 'skin-thread-row-hidden'));
    document.querySelectorAll('.skin-summary-row').forEach((node) => node.classList.remove('skin-summary-row', 'skin-summary-row-hidden'));
    document.querySelectorAll('.skin-navigation-rail').forEach((node) => node.classList.remove('skin-navigation-rail', 'skin-navigation-rail-hidden'));
    document.querySelectorAll('.skin-diff-row').forEach((node) => node.classList.remove('skin-diff-row', 'skin-diff-row-hidden'));
    document.querySelectorAll('.skin-message-stack').forEach((node) => node.classList.remove('skin-message-stack'));
    document.querySelectorAll('.skin-composer-control').forEach((node) => node.classList.remove('skin-composer-control', 'skin-composer-primary-action'));
    for (const [slider, refresh] of levelSliderBindings) {
      for (const event of ['click', 'change', 'input', 'keydown', 'pointermove', 'pointerup']) {
        slider.removeEventListener(event, refresh);
      }
      slider.classList.remove('skin-level-slider');
      slider.style.removeProperty('--skin-level-active-color');
      slider.querySelectorAll('[class*="_Tick_"]').forEach((tick) => {
        tick.classList.remove('skin-level-slider-tick');
      });
      slider.querySelector('[class*="_Track_"]')?.classList.remove('skin-level-slider-track');
      slider.querySelector('[class*="_Range_"]')?.classList.remove('skin-level-slider-range');
      slider.querySelector('[class*="_Thumb_"]')?.classList.remove('skin-level-slider-thumb');
    }
    levelSliderBindings.clear();
    videoLayer?.pause();
    videoLayer?.remove();
    URL.revokeObjectURL(artUrl);
    if (window[STATE]?.revision === revision) delete window[STATE];
    return true;
  };

  observer = new MutationObserver(schedule);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-appearance', 'data-selected', 'data-max', 'data-pointer-down'],
  });
  timer = setInterval(ensure, 4000);
  window[STATE] = { revision, ensure, cleanup, observer, timer, artUrl };
  ensure();
  return { installed: true, revision };
})(__SKIN_CSS__, __SKIN_ART__, __SKIN_THEME__, __SKIN_REVISION__)
