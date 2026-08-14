((cssText, assetId, theme, preferences, revision) => {
  const STATE = '__CODEX_SKIN_STUDIO_STATE__';
  const MEDIA_STATE = '__CODEX_SKIN_STUDIO_MEDIA__';
  const current = window[STATE];
  const mediaStore = window[MEDIA_STATE];
  const mediaAsset = mediaStore?.assets?.[assetId];
  const modelPickerLayout = preferences?.modelPickerLayout === 'flat' ? 'flat' : 'native';
  const mainSurfaceSelector = 'main[data-app-shell-main-surface], main.main-surface';
  const findCompactHomeShell = () => {
    if (!document.documentElement?.classList.contains('compact-window')) return null;
    const composerRoot = document.querySelector('[data-codex-composer-root]');
    const shell = composerRoot?.closest('[class*="_homeShell_"]')
      || composerRoot?.parentElement?.parentElement;
    return shell?.querySelector('[class*="_ComposerLayoutRoot_"]') ? shell : null;
  };
  const appHeaderSelector = [
    'main[data-app-shell-main-surface] > header[data-app-shell-application-menu-bar]',
    'main.main-surface > header.app-header-tint',
  ].join(', ');
  const legacyApplicationMenuSelector = '[class~="group/application-menu-top-bar"]';
  const findMainSurface = () => document.querySelector(mainSurfaceSelector);
  const findAppHeader = (surface = findMainSurface()) => surface?.querySelector(
    ':scope > header[data-app-shell-application-menu-bar], :scope > header.app-header-tint',
  );
  const applicationMenuIsRequired = () => (
    !document.documentElement?.classList.contains('compact-window')
    && document.documentElement?.getAttribute('data-codex-window-chrome') === 'application-menu'
  );
  const findApplicationMenuSurface = () => {
    if (applicationMenuIsRequired()) {
      for (const menubar of document.querySelectorAll('#root [role="menubar"]')) {
        if (menubar.querySelector('[id^="application-menu-trigger-"]')) {
          return menubar.parentElement;
        }
      }
    }
    return document.querySelector(legacyApplicationMenuSelector);
  };
  if (current?.revision === revision && mediaAsset?.url === current.artUrl) {
    if (current.ensure?.() !== true) {
      return { installed: false, reason: 'shell-not-ready' };
    }
    return { installed: true, revision, reused: true };
  }

  const root = document.documentElement;
  if (!root || !document.body) return { installed: false, reason: 'document-not-ready' };
  if (!mediaAsset?.url) return { installed: false, reason: 'media-not-ready' };
  mediaAsset.refs = (mediaAsset.refs || 0) + 1;
  const artUrl = mediaAsset.url;
  current?.cleanup?.();
  const isVideo = theme.backgroundKind === 'video';
  const classes = [
    'codex-skin-studio', 'skin-theme-light', 'skin-theme-dark', 'skin-safe-left',
    'skin-safe-right', 'skin-safe-center', 'skin-safe-none', 'skin-task-ambient',
    'skin-task-banner', 'skin-task-off', 'skin-scrollbars-hidden',
    'skin-background-video', 'skin-model-picker-flat',
  ];
  let observer;
  let appearanceObserver;
  let healthTimer;
  let scheduled;
  let flatMenuResizeHandler;
  let videoLayer;
  const pendingNodes = new Set();
  const flatMenuStates = new Map();
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
  const environmentPanelSurfaceFor = (panel) => {
    // New Codex builds keep the PIP obstacle as an empty sibling of the visible panel.
    const sectionActions = panel?.parentElement?.querySelector(
      '[data-slot="thread-summary-panel-section-actions"]',
    );
    const section = sectionActions?.closest('section');
    const content = section?.parentElement?.parentElement;
    const nativeSurface = content?.closest(
      '[class*="bg-surface-elevated"], [class*="bg-background-primary"], [class*="elevation-"]',
    );
    return nativeSurface
      || content
      || panel?.firstElementChild?.firstElementChild
      || null;
  };
  const applyEnvironmentPanel = (panel, environment) => {
    const surface = environmentPanelSurfaceFor(panel);
    if (!surface) return;
    surface.classList.toggle('skin-environment-panel-hidden', environment.visible === false);
    surface.classList.add('skin-environment-panel-surface');
  };
  const diagramMarkerSelector = [
    '[data-codex-diagram]', '[data-diagram]', '[data-mermaid]',
    '[class~="mermaid"]', '[class*="mermaid"]',
    'svg[id^="mermaid-"]', 'svg[id^="flowchart-"]',
  ].join(', ');
  const diagramDefaults = {
    color: 'var(--skin-surface)', opacity: 0.88, borderOpacity: 0.35,
    blur: 8, radius: 12, shadow: 'none',
  };
  const isDiagramSvg = (svg) => {
    if (!(svg instanceof SVGElement)) return false;
    const identity = [
      svg.id || '',
      typeof svg.className === 'string' ? svg.className : svg.className?.baseVal || '',
      svg.getAttribute('aria-label') || '',
    ].join(' ');
    if (/mermaid|flowchart|diagram|graph/i.test(identity)) return true;
    return svg.querySelectorAll('text, .nodeLabel, foreignObject').length >= 2
      && svg.querySelectorAll('rect, polygon, .node').length >= 2
      && svg.querySelectorAll('path, line, polyline, marker').length >= 2;
  };
  const diagramSurfaceFor = (svg) => {
    const explicit = svg.closest(diagramMarkerSelector);
    const assistant = svg.closest('[data-content-search-unit-key$=":assistant"]');
    if (!assistant) return explicit && !explicit.matches('svg') ? explicit : null;
    let candidate = explicit && !explicit.matches('svg') ? explicit : svg.parentElement;
    let best = candidate || svg;
    let depth = 0;
    while (candidate && candidate !== assistant && depth < 4) {
      if (candidate.children.length === 1 && candidate.firstElementChild?.contains(svg)) best = candidate;
      candidate = candidate.parentElement;
      depth += 1;
    }
    return best;
  };
  const applyDiagramSurfaces = (scope, config) => {
    const surfaces = new Set();
    const assistants = relatedMatches(scope, '[data-content-search-unit-key$=":assistant"]');
    for (const assistant of assistants) {
      assistant.querySelectorAll(diagramMarkerSelector).forEach((candidate) => {
        const svg = candidate.matches('svg') ? candidate : candidate.querySelector('svg');
        if (candidate.matches('[data-codex-diagram], [data-diagram], [data-mermaid], [class~="mermaid"], [class*="mermaid"]') || (svg && isDiagramSvg(svg))) {
          surfaces.add(candidate.matches('svg') ? diagramSurfaceFor(svg) : candidate);
        }
      });
      assistant.querySelectorAll('svg').forEach((svg) => {
        if (isDiagramSvg(svg)) surfaces.add(diagramSurfaceFor(svg));
      });
    }
    surfaces.forEach((surface) => {
      applyConfigurableSurface(surface, 'skin-diagram-surface', config, diagramDefaults);
    });
  };
  const headerSurfaceDefaults = {
    color: 'var(--skin-surface)', opacity: 0.42, borderOpacity: 0.25,
    blur: 8, radius: 0, shadow: 'none',
  };
  const pageSearchInputSelector = '#scheduled-page-search, #plugins-page-search';
  const pageSearchDefaults = {
    color: 'var(--skin-surface)', opacity: 0.76, borderOpacity: 0.28,
    blur: 10, radius: 16, shadow: 'none',
  };
  const applyApplicationMenuSurface = () => {
    const applicationMenu = findApplicationMenuSurface();
    applyConfigurableSurface(
      applicationMenu,
      'skin-application-menu-surface',
      {
        ...theme.ui?.header,
        visible: true,
        opacity: Math.max(
          0.72,
          clamp(theme.ui?.header?.opacity, 0, 1, headerSurfaceDefaults.opacity),
        ),
        radius: 0,
        shadow: 'none',
      },
      headerSurfaceDefaults,
    );
    return applicationMenu;
  };
  const applyPageSearchSurfaces = (scope) => {
    const config = { ...(theme.ui?.pageSearch || {}), visible: true };
    for (const input of relatedMatches(scope, pageSearchInputSelector)) {
      const field = input.parentElement;
      const region = input.closest('[class~="sticky"]');
      applyConfigurableSurface(region, 'skin-page-search-surface', config, pageSearchDefaults);
      applyConfigurableSurface(field, 'skin-page-search-input-surface', {
        ...config,
        opacity: clamp(config.opacity, 0, 1, pageSearchDefaults.opacity) + 0.12,
      }, {
        ...pageSearchDefaults,
        opacity: 0.84,
        radius: 16,
      });
    }
  };

  const isVisible = (node) => {
    if (!node?.isConnected) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const isIntelligenceMenu = (node) => node instanceof Element
    && node.matches('[role="menu"]')
    && Boolean(node.querySelector('[data-model-picker-view-toggle]'))
    && Boolean(node.querySelector('[data-model-picker-power-slider]'));

  const flatMenuLabel = (panel) => {
    if (!panel || panel.querySelector('.skin-intelligence-flat-label')) return;
    const label = document.createElement('div');
    label.className = 'skin-intelligence-flat-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = '推理强度';
    panel.prepend(label);
  };

  const openFlatModelSubmenu = (state) => {
    if (flatMenuStates.get(state.menu) !== state || !state.modelItem?.isConnected) return;
    if (state.modelItem.getAttribute('aria-expanded') === 'true') {
      state.modelOpened = true;
      applyFlatMenuState(state);
      return;
    }
    if (state.openAttempts >= 4) return;
    state.openAttempts += 1;
    requestAnimationFrame(() => {
      if (flatMenuStates.get(state.menu) !== state || !state.modelItem?.isConnected) return;
      state.modelItem.focus({ preventScroll: true });
      state.modelItem.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39,
        bubbles: true, cancelable: true,
      }));
      requestAnimationFrame(() => {
        if (flatMenuStates.get(state.menu) !== state) return;
        if (state.modelItem.getAttribute('aria-expanded') === 'true') {
          state.modelOpened = true;
          applyFlatMenuState(state);
          refreshFlatSubmenus();
        } else {
          openFlatModelSubmenu(state);
        }
      });
    });
  };

  const applyFlatMenuState = (state) => {
    const {
      menu, simplePanel, viewToggle, viewControls, modelItem, effortItem,
    } = state;
    if (!menu?.isConnected) return;
    menu.classList.add('skin-intelligence-flat-menu');
    simplePanel?.classList.add('skin-intelligence-flat-simple-panel');
    viewToggle?.classList.add('skin-intelligence-flat-view-toggle');
    viewControls?.classList.add('skin-intelligence-flat-view-controls');
    effortItem?.classList.add('skin-intelligence-flat-effort-trigger');
    modelItem?.classList.add('skin-intelligence-flat-model-trigger');
    modelItem?.classList.toggle('skin-intelligence-flat-model-hidden', state.modelOpened);
    state.advancedPanel?.classList.add('skin-intelligence-flat-advanced-panel');
    if (simplePanel) {
      simplePanel.removeAttribute('inert');
      simplePanel.setAttribute('aria-hidden', 'false');
      flatMenuLabel(simplePanel);
    }
  };

  const refreshFlatSubmenus = () => {
    for (const state of flatMenuStates.values()) {
      if (!state.menu.isConnected) continue;
      const previous = state.submenu;
      if (previous && !previous.isConnected) state.submenu = null;
      const submenu = state.modelItem?.id
        ? [...document.querySelectorAll('[role="menu"]')].find((candidate) => (
          candidate !== state.menu
          && candidate.getAttribute('aria-labelledby') === state.modelItem.id
          && isVisible(candidate)
        ))
        : null;
      if (previous && previous !== submenu) {
        previous.classList.remove('skin-intelligence-flat-model-menu');
        previous.querySelector('.skin-intelligence-flat-model-label')?.remove();
        if (state.submenuWrapper?.isConnected) state.submenuWrapper.style.cssText = state.originalSubmenuWrapperStyle || '';
        state.submenuWrapper = null;
        state.originalSubmenuWrapperStyle = null;
        state.modelOpened = false;
        state.modelItem?.classList.remove('skin-intelligence-flat-model-hidden');
      }
      if (!submenu) continue;
      state.submenu = submenu;
      const wrapper = submenu.parentElement;
      if (state.submenuWrapper !== wrapper) {
        state.submenuWrapper = wrapper;
        state.originalSubmenuWrapperStyle = wrapper?.getAttribute('style') || '';
      }
      submenu.classList.add('skin-intelligence-flat-model-menu');
      if (!submenu.querySelector('.skin-intelligence-flat-model-label')) {
        const label = document.createElement('div');
        label.className = 'skin-intelligence-flat-model-label';
        label.setAttribute('role', 'presentation');
        label.textContent = '模型';
        submenu.prepend(label);
      }
      if (wrapper) {
        const menuRect = state.menu.getBoundingClientRect();
        const submenuRect = submenu.getBoundingClientRect();
        const gap = 6;
        const canPlaceLeft = menuRect.left - submenuRect.width - gap >= 8;
        const left = canPlaceLeft
          ? menuRect.left - submenuRect.width - gap
          : Math.min(Math.max(8, menuRect.right + gap), window.innerWidth - submenuRect.width - 8);
        const top = canPlaceLeft
          ? Math.min(Math.max(8, menuRect.top), window.innerHeight - submenuRect.height - 8)
          : Math.min(Math.max(8, menuRect.bottom + gap), window.innerHeight - submenuRect.height - 8);
        wrapper.style.position = 'fixed';
        wrapper.style.transform = 'none';
        wrapper.style.left = `${Math.round(left)}px`;
        wrapper.style.top = `${Math.round(top)}px`;
        wrapper.style.margin = '0';
        wrapper.style.zIndex = '51';
      }
      if (document.activeElement === state.modelItem) {
        submenu.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
      }
    }
  };

  const ensureFlatMenu = (menu) => {
    if (!isIntelligenceMenu(menu)) return;
    let state = flatMenuStates.get(menu);
    if (!state) {
      const slider = menu.querySelector('[data-model-picker-power-slider]');
      const simplePanel = slider?.closest('[data-active]');
      const advancedPanel = menu.querySelector('[data-active="true"]');
      const viewToggle = menu.querySelector('[data-model-picker-view-toggle]');
      const viewControls = viewToggle?.parentElement;
      const menuItems = [...menu.querySelectorAll('[role="menuitem"][aria-haspopup="menu"]')];
      const modelItem = menuItems[0];
      const effortItem = menuItems[1];
      if (!slider || !simplePanel || !modelItem) return;
      state = {
        menu,
        slider,
        simplePanel,
        advancedPanel,
        viewToggle,
        viewControls,
        modelItem,
        effortItem,
        originalAriaHidden: simplePanel.getAttribute('aria-hidden'),
        originalInert: simplePanel.hasAttribute('inert'),
        modelOpened: false,
        openAttempts: 0,
        submenu: null,
        submenuWrapper: null,
        originalSubmenuWrapperStyle: null,
      };
      flatMenuStates.set(menu, state);
      requestAnimationFrame(() => openFlatModelSubmenu(state));
    }
    applyFlatMenuState(state);
  };

  const cleanupFlatMenu = (state) => {
    const {
      menu, simplePanel, viewToggle, viewControls, modelItem, effortItem, submenu,
    } = state;
    submenu?.classList.remove('skin-intelligence-flat-model-menu');
    submenu?.querySelector('.skin-intelligence-flat-model-label')?.remove();
    if (state.submenuWrapper?.isConnected) {
      state.submenuWrapper.style.cssText = state.originalSubmenuWrapperStyle || '';
    }
    menu?.classList.remove('skin-intelligence-flat-menu');
    simplePanel?.classList.remove('skin-intelligence-flat-simple-panel');
    state.advancedPanel?.classList.remove('skin-intelligence-flat-advanced-panel');
    simplePanel?.querySelector('.skin-intelligence-flat-label')?.remove();
    if (simplePanel?.isConnected) {
      if (state.originalInert) simplePanel.setAttribute('inert', '');
      else simplePanel.removeAttribute('inert');
      if (state.originalAriaHidden == null) simplePanel.removeAttribute('aria-hidden');
      else simplePanel.setAttribute('aria-hidden', state.originalAriaHidden);
    }
    viewToggle?.classList.remove('skin-intelligence-flat-view-toggle');
    viewControls?.classList.remove('skin-intelligence-flat-view-controls');
    modelItem?.classList.remove('skin-intelligence-flat-model-trigger');
    modelItem?.classList.remove('skin-intelligence-flat-model-hidden');
    effortItem?.classList.remove('skin-intelligence-flat-effort-trigger');
    flatMenuStates.delete(menu);
  };

  const syncFlatMenus = () => {
    if (modelPickerLayout === 'flat') {
      document.querySelectorAll('[role="menu"]').forEach((menu) => {
        if (isIntelligenceMenu(menu)) ensureFlatMenu(menu);
      });
      refreshFlatSubmenus();
    } else {
      [...flatMenuStates.values()].forEach(cleanupFlatMenu);
    }
    [...flatMenuStates.values()]
      .filter((state) => !state.menu.isConnected)
      .forEach(cleanupFlatMenu);
  };

  const nativeAppearance = () => {
    const classNames = `${root.className} ${document.body.className}`.toLowerCase().replace(/skin-theme-(?:light|dark)/g, '');
    if (/\b(dark|electron-dark|theme-dark)\b/.test(classNames)) return 'dark';
    if (/\b(light|electron-light|theme-light)\b/.test(classNames)) return 'light';
    try { return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
  };

  const applyAppearance = () => {
    const appearance = theme.appearance === 'auto' ? nativeAppearance() : theme.appearance;
    root.classList.toggle('skin-theme-light', appearance === 'light');
    root.classList.toggle('skin-theme-dark', appearance === 'dark');
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

  const relatedMatches = (scope, selector) => {
    const matches = new Set();
    if (scope instanceof Element) {
      if (scope.matches(selector)) matches.add(scope);
      const closest = scope.closest(selector);
      if (closest) matches.add(closest);
    }
    scope.querySelectorAll?.(selector).forEach((node) => matches.add(node));
    return matches;
  };

  const refreshHome = () => {
    const mainSurfaces = [...document.querySelectorAll(mainSurfaceSelector)];
    const home = mainSurfaces.find((candidate) => candidate.querySelector('[data-testid="home-icon"]'));
    for (const candidate of mainSurfaces) {
      candidate.classList.toggle('skin-home', candidate === home);
      candidate.classList.toggle('skin-task', candidate !== home);
    }
    const homeWelcome = theme.ui?.homeWelcome || {};
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
    findMainSurface()?.classList.toggle('skin-home-shell', Boolean(home));
    const compactHomeShell = findCompactHomeShell();
    compactHomeShell?.classList.add('skin-compact-home-shell');
    compactHomeShell?.querySelector('[class*="_shellUnderlay_"]')?.classList.add('skin-compact-home-underlay');
  };

  // Codex has changed the height/position utility classes for this layer a few
  // times. Keep the stable visual markers so the transient footer fade is
  // still owned by the composer setting after an app update.
  const fileChangeFadeSelector = [
    'div[class~="pointer-events-none"][class~="absolute"][class~="inset-x-0"][class*="bg-gradient-to-t"]',
    'div[class~="pointer-events-none"][class~="absolute"][class*="from-token-main-surface-primary"][class*="to-transparent"]',
  ].join(', ');
  const changeSummaryCompactSelector = 'div.rounded-3xl.border[class*="bg-token-input-background"]';
  const diffRowSelector = [
    '.thread-diff-virtualized',
    '[class~="group/turn-diff-file-row"]',
  ].join(', ');
  const homeUtilityBarSelector = '[class*="_homeUtilityBar_"], [class*="_HomeUtilityBar_"]';
  const composerSurfaceSelector = '.composer-surface-chrome, [class*="_ComposerLayoutRoot_"]';

  const isCompactChangeSummary = (summary) => {
    if (!summary?.classList) return false;
    const classes = summary.classList;
    return classes.contains('flex')
      && classes.contains('w-max')
      && classes.contains('max-w-full')
      && classes.contains('min-w-0')
      && classes.contains('items-center')
      && classes.contains('gap-2')
      && classes.contains('px-3')
      && classes.contains('py-1.5')
      && classes.contains('backdrop-blur-sm');
  };

  const applyChangeSummarySurface = (summary, changeSummary) => {
    if (!isCompactChangeSummary(summary)) return;
    summary.classList.add('skin-change-summary-compact');
    summary.classList.toggle('skin-change-summary-hidden', changeSummary.visible === false);
    summary.classList.toggle('skin-change-summary-shadow-reset', changeSummary.shadow === 'none');
    // The compact summary can be wrapped by a native shadow-bearing surface.
    // Reset that wrapper too when the user explicitly disables the shadow.
    summary.parentElement?.classList.toggle(
      'skin-change-summary-shadow-reset',
      changeSummary.shadow === 'none',
    );
  };

  const applyChangeSummaryCard = (card, changeSummary) => {
    if (!card) return;
    card.classList.add('skin-change-summary-card');
    card.classList.toggle('skin-change-summary-hidden', changeSummary.visible === false);
    card.classList.toggle('skin-change-summary-shadow-reset', changeSummary.shadow === 'none');
    card.parentElement?.classList.toggle(
      'skin-change-summary-shadow-reset',
      changeSummary.shadow === 'none',
    );
  };

  const processIncrementalScope = (scope) => {
    if (!scope?.querySelectorAll && !(scope instanceof Element)) return;
    const composer = theme.composer || {};
    const environment = theme.environment || {};
    const changeSummary = theme.changeSummary || {};
    const ui = theme.ui || {};

    for (const composerSurface of relatedMatches(scope, composerSurfaceSelector)) {
      composerSurface.querySelector('[class*="_ComposerLayoutBody_"]')?.classList.add('skin-composer-body');
      const controls = composerSurface.querySelectorAll('button, [role="button"]');
      controls.forEach((control) => control.classList.add('skin-composer-control'));
      const primaryAction = [...controls].find((control) => {
        const label = `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`;
        return control.getAttribute('type') === 'submit' || /send|发送|stop|停止/i.test(label);
      });
      primaryAction?.classList.add('skin-composer-primary-action');
    }
    for (const utilityBar of relatedMatches(scope, homeUtilityBarSelector)) {
      utilityBar.classList.add('skin-home-utility-bar');
    }
    for (const footer of relatedMatches(scope, '[data-thread-scroll-footer="true"]')) {
      const hasComposer = Boolean(footer.querySelector(composerSurfaceSelector));
      for (const layer of footer.children) {
        if (layer.querySelector(composerSurfaceSelector)) continue;
        layer.classList.toggle(
          'skin-composer-footer-backdrop',
          hasComposer && composer.showFooterBackdrop !== true,
        );
      }
    }
    for (const layer of relatedMatches(scope, fileChangeFadeSelector)) {
      layer.classList.toggle('skin-composer-file-change-backdrop', composer.showFooterBackdrop !== true);
    }

    for (const panel of relatedMatches(scope, '[data-pip-obstacle="thread-summary-panel"]')) {
      applyEnvironmentPanel(panel, environment);
    }
    for (const header of relatedMatches(scope, '[class~="group/turn-diff-header"]')) {
      applyChangeSummaryCard(header.parentElement, changeSummary);
    }
    for (const summary of relatedMatches(scope, changeSummaryCompactSelector)) {
      applyChangeSummarySurface(summary, changeSummary);
    }

    for (const sidebar of relatedMatches(scope, 'aside.app-shell-left-panel')) {
      applyConfigurableSurface(sidebar, 'skin-sidebar-surface', ui.sidebar, {
        color: 'var(--skin-sidebar)', opacity: 0.66, borderOpacity: 0.25,
        blur: 8, radius: 0, shadow: 'none',
      });
    }
    for (const header of relatedMatches(scope, appHeaderSelector)) {
      applyConfigurableSurface(header, 'skin-header-surface', ui.header, headerSurfaceDefaults);
    }
    applyApplicationMenuSurface();
    applyPageSearchSurfaces(scope);
    for (const bubble of relatedMatches(scope, '[data-user-message-bubble="true"]')) {
      applyConfigurableSurface(bubble, 'skin-user-bubble-surface', ui.userBubble, {
        color: 'var(--skin-surface)', opacity: 0.2, borderOpacity: 0.25,
        blur: 4, radius: 20, shadow: 'none',
      });
    }
    const codeBlocks = new Set(relatedMatches(scope, '[class*="_codeBlock_"]'));
    for (const pre of relatedMatches(scope, 'pre')) {
      codeBlocks.add(pre.closest('[class*="bg-token-text-code-block-background"]') || pre);
    }
    for (const codeBlock of codeBlocks) {
      applyConfigurableSurface(codeBlock, 'skin-code-block-surface', ui.codeBlock, {
        color: 'var(--skin-surface)', opacity: 0.17, borderOpacity: 0,
        blur: 6, radius: 12, shadow: 'none',
      });
    }
    for (const activityHeader of relatedMatches(scope, '[class~="group/activity-header"]')) {
      applyConfigurableSurface(activityHeader.parentElement, 'skin-activity-card-surface', ui.activityCard, {
        color: 'var(--skin-surface)', opacity: 0.2, borderOpacity: 0.3,
        blur: 4, radius: 12, shadow: 'none',
      });
    }
    applyDiagramSurfaces(scope, ui.diagram || {});
    for (const suggestions of relatedMatches(scope, '[class~="group/home-suggestions"]')) {
      suggestions.classList.toggle('skin-home-suggestions-hidden', ui.homeSuggestions?.visible === false);
    }
    for (const suggestion of relatedMatches(scope, '[class~="group/home-suggestions"] button')) {
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
    for (const selector of ['[role="dialog"]', '[role="menu"]', '[role="listbox"]', '[data-slot="popover-content"]']) {
      for (const overlay of relatedMatches(scope, selector)) {
        applyConfigurableSurface(overlay, 'skin-overlay-surface', overlayConfig, overlayDefaults);
      }
    }

    const threadRows = ui.threadRows || {};
    for (const row of relatedMatches(scope, '[data-app-action-sidebar-thread-row]')) {
      row.classList.add('skin-thread-row');
      row.classList.toggle('skin-thread-row-hidden', threadRows.visible === false);
    }
    const summaryRows = ui.summaryRows || {};
    for (const row of relatedMatches(scope, '[data-slot="thread-summary-panel-item-button"]')) {
      row.classList.add('skin-summary-row');
      row.classList.toggle('skin-summary-row-hidden', summaryRows.visible === false);
    }
    for (const rail of relatedMatches(scope, '[data-thread-user-message-navigation-rail-list="true"]')) {
      rail.classList.toggle('skin-navigation-rail-hidden', ui.navigationRailVisible === false);
      rail.classList.add('skin-navigation-rail');
    }
    const diff = ui.diff || {};
    for (const row of relatedMatches(scope, diffRowSelector)) {
      row.classList.add('skin-diff-row');
      row.classList.toggle('skin-diff-row-hidden', diff.visible === false);
    }
    syncFlatMenus();
    for (const conversation of relatedMatches(scope, '[data-thread-find-target="conversation"]')) {
      conversation.firstElementChild?.firstElementChild?.classList.add('skin-message-stack');
    }
  };

  const ensure = () => {
    const mainShell = findMainSurface();
    const compactHomeShell = findCompactHomeShell();
    const sidebar = document.querySelector('aside.app-shell-left-panel');
    const hasMainShell = Boolean(mainShell && sidebar);
    const hasCompactHomeShell = Boolean(!mainShell && compactHomeShell);
    if (!hasMainShell && !hasCompactHomeShell) return false;
    mainShell?.classList.add('skin-main-surface');
    compactHomeShell?.classList.add('skin-compact-home-shell');
    compactHomeShell?.querySelector('[class*="_shellUnderlay_"]')?.classList.add('skin-compact-home-underlay');
    let style = document.getElementById('codex-skin-studio-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'codex-skin-studio-style';
      (document.head || root).appendChild(style);
    }
    if (style.textContent !== cssText) style.textContent = cssText;
    root.classList.add('codex-skin-studio');
    root.classList.toggle('skin-background-video', isVideo);
    root.classList.toggle('skin-model-picker-flat', modelPickerLayout === 'flat');
    applyAppearance();

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
    const composerSurfaces = document.querySelectorAll(composerSurfaceSelector);
    for (const composerSurface of composerSurfaces) {
      composerSurface.querySelector('[class*="_ComposerLayoutBody_"]')?.classList.add('skin-composer-body');
      const controls = composerSurface.querySelectorAll('button, [role="button"]');
      controls.forEach((control) => control.classList.add('skin-composer-control'));
      const primaryAction = [...controls].find((control) => {
        const label = `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`;
        return control.getAttribute('type') === 'submit' || /send|发送|stop|停止/i.test(label);
      });
      primaryAction?.classList.add('skin-composer-primary-action');
    }
    for (const utilityBar of document.querySelectorAll(homeUtilityBarSelector)) {
      utilityBar.classList.add('skin-home-utility-bar');
    }
    for (const footer of document.querySelectorAll('[data-thread-scroll-footer="true"]')) {
      const hasComposer = Boolean(footer.querySelector(composerSurfaceSelector));
      for (const layer of footer.children) {
        if (layer.querySelector(composerSurfaceSelector)) continue;
        layer.classList.toggle(
          'skin-composer-footer-backdrop',
          hasComposer && composer.showFooterBackdrop !== true,
        );
      }
    }
    for (const layer of document.querySelectorAll(fileChangeFadeSelector)) {
      layer.classList.toggle('skin-composer-file-change-backdrop', composer.showFooterBackdrop !== true);
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
      applyEnvironmentPanel(panel, environment);
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
      applyChangeSummaryCard(header.parentElement, changeSummary);
    }
    for (const summary of document.querySelectorAll(changeSummaryCompactSelector)) {
      applyChangeSummarySurface(summary, changeSummary);
    }
    const ui = theme.ui || {};
    applyConfigurableSurface(sidebar, 'skin-sidebar-surface', ui.sidebar, {
      color: 'var(--skin-sidebar)', opacity: 0.66, borderOpacity: 0.25,
      blur: 8, radius: 0, shadow: 'none',
    });
    const taskHeader = findAppHeader(mainShell);
    applyConfigurableSurface(
      taskHeader,
      'skin-header-surface',
      ui.header,
      headerSurfaceDefaults,
    );
    const applicationMenu = applyApplicationMenuSurface();
    applyPageSearchSurfaces(document);
    for (const bubble of document.querySelectorAll('[data-user-message-bubble="true"]')) {
      applyConfigurableSurface(bubble, 'skin-user-bubble-surface', ui.userBubble, {
        color: 'var(--skin-surface)', opacity: 0.2, borderOpacity: 0.25,
        blur: 4, radius: 20, shadow: 'none',
      });
    }
    const codeBlocks = new Set();
    document.querySelectorAll('[class*="_codeBlock_"]').forEach((node) => codeBlocks.add(node));
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
    applyDiagramSurfaces(document, ui.diagram || {});
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
    for (const row of document.querySelectorAll(diffRowSelector)) {
      row.classList.add('skin-diff-row');
      row.classList.toggle('skin-diff-row-hidden', diff.visible === false);
    }

    syncFlatMenus();

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
    const diagram = ui.diagram || {};
    root.style.setProperty('--skin-diagram-padding', `${Math.round(clamp(diagram.padding, 4, 40, 16))}px`);
    root.style.setProperty('--skin-diagram-node-color', /^#[0-9a-f]{6}$/i.test(diagram.nodeBackground || '') ? diagram.nodeBackground : 'var(--skin-surface)');
    root.style.setProperty('--skin-diagram-node-border', /^#[0-9a-f]{6}$/i.test(diagram.nodeBorder || '') ? diagram.nodeBorder : 'var(--skin-line)');
    root.style.setProperty('--skin-diagram-node-text', /^#[0-9a-f]{6}$/i.test(diagram.nodeText || '') ? diagram.nodeText : 'var(--skin-text-primary)');
    root.style.setProperty('--skin-diagram-connector', /^#[0-9a-f]{6}$/i.test(diagram.connector || '') ? diagram.connector : 'var(--skin-line)');
    root.style.setProperty('--skin-diagram-emphasis', /^#[0-9a-f]{6}$/i.test(diagram.emphasis || '') ? diagram.emphasis : 'var(--skin-accent)');
    const mainSurfaces = [...document.querySelectorAll(mainSurfaceSelector)];
    const home = mainSurfaces.find((candidate) => candidate.querySelector('[data-testid="home-icon"]'));
    for (const candidate of mainSurfaces) {
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
    mainShell?.classList.toggle('skin-home-shell', Boolean(home));
    compactHomeShell?.classList.add('skin-compact-home-shell');
    compactHomeShell?.querySelector('[class*="_shellUnderlay_"]')?.classList.add('skin-compact-home-underlay');
    return !applicationMenuIsRequired()
      || Boolean(applicationMenu?.classList.contains('skin-application-menu-surface'));
  };

  const healthCheck = () => {
    const mainShell = findMainSurface();
    const compactHomeShell = findCompactHomeShell();
    const shellHealthy = Boolean(
      (mainShell?.classList.contains('skin-main-surface')
        && document.querySelector('aside.app-shell-left-panel'))
      || compactHomeShell?.classList.contains('skin-compact-home-shell'),
    );
    const style = document.getElementById('codex-skin-studio-style');
    const applicationMenu = findApplicationMenuSurface();
    const applicationMenuIsHealthy = !applicationMenuIsRequired()
      || applicationMenu?.classList.contains('skin-application-menu-surface');
    if (!shellHealthy
      || !style
      || style.textContent !== cssText
      || !root.classList.contains('codex-skin-studio')
      || !applicationMenuIsHealthy) {
      return ensure();
    }
    if (isVideo && !document.getElementById('codex-skin-studio-video')) {
      ensureVideoLayer();
    }
    return true;
  };
  const flushPendingNodes = () => {
    scheduled = undefined;
    const nodes = [...pendingNodes].filter((node) => node.isConnected);
    pendingNodes.clear();
    const scopes = nodes.filter((node) => !nodes.some(
      (candidate) => candidate !== node && candidate.contains(node),
    ));
    for (const scope of scopes) processIncrementalScope(scope);
    if (scopes.length > 0) refreshHome();
  };
  const scheduleNode = (node) => {
    if (!(node instanceof Element)) return;
    pendingNodes.add(node);
    if (scheduled === undefined) scheduled = requestAnimationFrame(flushPendingNodes);
  };
  const cleanup = () => {
    if (scheduled !== undefined) cancelAnimationFrame(scheduled);
    clearInterval(healthTimer);
    observer?.disconnect();
    appearanceObserver?.disconnect();
    [...flatMenuStates.values()].forEach(cleanupFlatMenu);
    if (flatMenuResizeHandler) window.removeEventListener('resize', flatMenuResizeHandler);
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
      '--skin-diagram-padding', '--skin-diagram-node-color', '--skin-diagram-node-border',
      '--skin-diagram-node-text', '--skin-diagram-connector', '--skin-diagram-emphasis',
    ]) root.style.removeProperty(property);
    document.querySelectorAll('.skin-home').forEach((node) => node.classList.remove('skin-home'));
    document.querySelectorAll('.skin-task').forEach((node) => node.classList.remove('skin-task'));
    document.querySelectorAll('.skin-main-surface').forEach((node) => node.classList.remove('skin-main-surface'));
    document.querySelectorAll('.skin-home-shell').forEach((node) => node.classList.remove('skin-home-shell'));
    document.querySelectorAll('.skin-compact-home-shell').forEach((node) => node.classList.remove('skin-compact-home-shell'));
    document.querySelectorAll('.skin-compact-home-underlay').forEach((node) => node.classList.remove('skin-compact-home-underlay'));
    document.querySelectorAll('.skin-home-welcome-icon-hidden').forEach((node) => node.classList.remove('skin-home-welcome-icon-hidden'));
    document.querySelectorAll('.skin-home-welcome-title-hidden').forEach((node) => node.classList.remove('skin-home-welcome-title-hidden'));
    document.querySelectorAll('.skin-composer-footer-backdrop').forEach((node) => node.classList.remove('skin-composer-footer-backdrop'));
    document.querySelectorAll('.skin-composer-file-change-backdrop').forEach((node) => node.classList.remove('skin-composer-file-change-backdrop'));
    document.querySelectorAll('.skin-home-utility-bar').forEach((node) => node.classList.remove('skin-home-utility-bar'));
    document.querySelectorAll('.skin-composer-body').forEach((node) => node.classList.remove('skin-composer-body'));
    document.querySelectorAll('.skin-environment-panel-hidden').forEach((node) => node.classList.remove('skin-environment-panel-hidden'));
    document.querySelectorAll('.skin-environment-panel-surface').forEach((node) => node.classList.remove('skin-environment-panel-surface'));
    document.querySelectorAll('.skin-change-summary-hidden').forEach((node) => node.classList.remove('skin-change-summary-hidden'));
    document.querySelectorAll('.skin-change-summary-card').forEach((node) => node.classList.remove('skin-change-summary-card'));
    document.querySelectorAll('.skin-change-summary-compact').forEach((node) => node.classList.remove('skin-change-summary-compact'));
    document.querySelectorAll('.skin-change-summary-shadow-reset').forEach((node) => node.classList.remove('skin-change-summary-shadow-reset'));
    document.querySelectorAll('.skin-home-suggestions-hidden').forEach((node) => node.classList.remove('skin-home-suggestions-hidden'));
    document.querySelectorAll('.skin-configurable-surface').forEach((node) => {
      node.classList.remove(
        'skin-configurable-surface', 'skin-configurable-hidden', 'skin-sidebar-surface',
        'skin-header-surface', 'skin-application-menu-surface', 'skin-user-bubble-surface',
        'skin-code-block-surface', 'skin-activity-card-surface', 'skin-home-suggestion-surface', 'skin-overlay-surface',
        'skin-diagram-surface', 'skin-page-search-surface', 'skin-page-search-input-surface',
      );
      for (const property of configurableSurfaceProperties) node.style.removeProperty(property);
    });
    document.querySelectorAll('.skin-thread-row').forEach((node) => node.classList.remove('skin-thread-row', 'skin-thread-row-hidden'));
    document.querySelectorAll('.skin-summary-row').forEach((node) => node.classList.remove('skin-summary-row', 'skin-summary-row-hidden'));
    document.querySelectorAll('.skin-navigation-rail').forEach((node) => node.classList.remove('skin-navigation-rail', 'skin-navigation-rail-hidden'));
    document.querySelectorAll('.skin-diff-row').forEach((node) => node.classList.remove('skin-diff-row', 'skin-diff-row-hidden'));
    document.querySelectorAll('.skin-message-stack').forEach((node) => node.classList.remove('skin-message-stack'));
    document.querySelectorAll('.skin-composer-control').forEach((node) => node.classList.remove('skin-composer-control', 'skin-composer-primary-action'));
    videoLayer?.pause();
    videoLayer?.remove();
    const asset = window[MEDIA_STATE]?.assets?.[assetId];
    if (asset?.url === artUrl) {
      asset.refs = Math.max(0, (asset.refs || 1) - 1);
      if (asset.refs === 0) {
        URL.revokeObjectURL(asset.url);
        delete window[MEDIA_STATE].assets[assetId];
      }
    }
    if (window[STATE]?.revision === revision) delete window[STATE];
    return true;
  };

  observer = new MutationObserver((records) => {
    let healthRequired = false;
    for (const record of records) {
      if (record.type === 'attributes') {
        scheduleNode(record.target);
        continue;
      }
      record.addedNodes.forEach((node) => {
        scheduleNode(node);
        if (node instanceof Element
          && (node.matches(mainSurfaceSelector) || node.querySelector?.(mainSurfaceSelector))) {
          healthRequired = true;
        }
      });
      for (const node of record.removedNodes) {
        if (node instanceof Element
          && (node.id === 'codex-skin-studio-style'
            || node.id === 'codex-skin-studio-video'
            || node.querySelector?.('#codex-skin-studio-style, #codex-skin-studio-video'))) {
          healthRequired = true;
        }
      }
    }
    if (records.length > 0) queueMicrotask(syncFlatMenus);
    if (healthRequired) queueMicrotask(healthCheck);
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  appearanceObserver = new MutationObserver(applyAppearance);
  for (const node of [root, document.body]) {
    appearanceObserver.observe(node, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-appearance'],
    });
  }
  flatMenuResizeHandler = () => requestAnimationFrame(refreshFlatSubmenus);
  window.addEventListener('resize', flatMenuResizeHandler, { passive: true });
  healthTimer = setInterval(healthCheck, 30000);
  if (!ensure()) {
    cleanup();
    return { installed: false, reason: 'shell-not-ready' };
  }
  window[STATE] = { revision, assetId, ensure: healthCheck, cleanup, observer, healthTimer, artUrl };
  return { installed: true, revision };
})(__SKIN_CSS__, __SKIN_MEDIA_ID__, __SKIN_THEME__, { modelPickerLayout: __SKIN_MODEL_PICKER_LAYOUT__ }, __SKIN_REVISION__)
