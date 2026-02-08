(() => {
  const SELECTOR = '._a9ym';
  const MAX_ITEMS = 800;
  const DEFAULT_INTERVAL = 1400;
  const MIN_INTERVAL = 400;
  const MAX_INTERVAL = 8000;

  const LAUNCHER_ID = '__ig_comment_slideshow_launcher__';
  const OVERLAY_ID = '__ig_comment_slideshow_overlay__';
  const SETTINGS_ID = '__ig_comment_slideshow_settings__';

  if (window.__IG_COMMENT_SLIDESHOW__?.destroy) {
    try {
      window.__IG_COMMENT_SLIDESHOW__.destroy();
    } catch {}
  }
  document.getElementById(LAUNCHER_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(SETTINGS_ID)?.remove();
  document.documentElement.style.overflow = '';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function normalizeText(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function commentKey(node, fallbackIndex) {
    const text = normalizeText(node.innerText);
    return text
      ? `${text.slice(0, 160)}::${text.length}`
      : `idx::${fallbackIndex}`;
  }

  function snapshotComments() {
    const nodes = $$(SELECTOR).filter(
      (n) => (n.innerText || '').trim().length > 0
    );
    return nodes.slice(0, MAX_ITEMS);
  }

  function cloneForOverlay(node) {
    const clone = node.cloneNode(true);
    clone.style.maxWidth = '100%';
    clone.style.width = '100%';
    clone.style.boxSizing = 'border-box';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      width: 100%;
      box-sizing: border-box;
      border-radius: 16px;
      padding: 12px;
      background: rgba(255,255,255,1);
      border: 1px solid rgba(255,255,255,0.10);
      backdrop-filter: blur(6px);
      color: white;
    `;
    wrapper.appendChild(clone);
    return wrapper;
  }

  let config = {
    interval: DEFAULT_INTERVAL,
    autoPlay: true
  };

  let allNodes = [];
  let nodeByKey = new Map();
  let selectedKeys = new Set();

  function ensureFreshSnapshot(selectMissing = true) {
    const latest = snapshotComments();
    allNodes = latest;
    nodeByKey.clear();
    latest.forEach((node, i) => nodeByKey.set(commentKey(node, i), node));

    const nextSelected = new Set();
    for (const key of selectedKeys) {
      if (nodeByKey.has(key)) nextSelected.add(key);
    }
    if (selectMissing) {
      for (const key of nodeByKey.keys()) {
        if (!nextSelected.has(key)) nextSelected.add(key);
      }
    }
    selectedKeys = nextSelected;
  }

  ensureFreshSnapshot();

  function selectedNodesList() {
    return Array.from(selectedKeys)
      .map((key) => nodeByKey.get(key))
      .filter(Boolean);
  }

  const launcher = document.createElement('div');
  launcher.id = LAUNCHER_ID;
  launcher.style.cssText = `
    position: fixed;
    bottom: 18px;
    right: 18px;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 2147483646;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  function createCircleButton(icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = icon;
    button.title = label;
    button.style.cssText = `
      width: 50px;
      height: 50px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.25);
      background: rgba(15,15,20,0.9);
      color: white;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
    `;
    button.onmouseenter = () =>
      (button.style.background = 'rgba(255,255,255,0.12)');
    button.onmouseleave = () =>
      (button.style.background = 'rgba(15,15,20,0.9)');
    return button;
  }

  const slideshowButton = createCircleButton('▶', 'Open comment slideshow');
  const settingsButton = createCircleButton('⚙', 'Open slideshow settings');
  launcher.appendChild(settingsButton);
  launcher.appendChild(slideshowButton);
  document.body.appendChild(launcher);

  let settingsVisible = false;
  let overlayOpen = false;
  let destroyed = false;
  let playing = config.autoPlay;
  let idx = 0;
  let bars = [];
  let overlay;
  let stage;
  let stageInner;
  let progressWrap;
  let pill;
  let hint;
  let closeBtn;
  let bottomSettingsBtn;
  let prevOverflow = '';
  let keybound = false;

  const settingsPanel = document.createElement('div');
  settingsPanel.id = SETTINGS_ID;
  settingsPanel.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0,0,0,0.65);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const settingsCard = document.createElement('div');
  settingsCard.style.cssText = `
    width: min(640px, calc(100vw - 40px));
    max-height: min(720px, calc(100vh - 60px));
    background: #0c0d13;
    border-radius: 22px;
    border: 1px solid rgba(255,255,255,0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0,0,0,0.45);
  `;

  const settingsHeader = document.createElement('div');
  settingsHeader.style.cssText = `
    padding: 18px 20px 10px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255,255,255,0.12);
  `;

  const settingsTitle = document.createElement('div');
  settingsTitle.textContent = 'Slideshow settings';
  settingsTitle.style.cssText = `
    color: rgba(255,255,255,0.92);
    font-size: 16px;
    font-weight: 600;
  `;

  const settingsClose = document.createElement('button');
  settingsClose.type = 'button';
  settingsClose.textContent = '✕';
  settingsClose.style.cssText = `
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.85);
    cursor: pointer;
    font-size: 18px;
  `;
  settingsClose.onmouseenter = () =>
    (settingsClose.style.background = 'rgba(255,255,255,0.12)');
  settingsClose.onmouseleave = () =>
    (settingsClose.style.background = 'rgba(255,255,255,0.04)');

  settingsHeader.appendChild(settingsTitle);
  settingsHeader.appendChild(settingsClose);

  const settingsBody = document.createElement('div');
  settingsBody.style.cssText = `
    padding: 10px 22px 16px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
    overflow: hidden;
  `;

  const configBlock = document.createElement('div');
  configBlock.style.cssText = 'display:flex; flex-direction:column; gap:12px;';

  const configRowLabel = document.createElement('div');
  configRowLabel.style.cssText =
    'display:flex; align-items:center; justify-content:space-between; font-size:12px; color: rgba(255,255,255,0.75);';
  configRowLabel.innerHTML = 'Slide interval';

  const intervalValue = document.createElement('span');
  intervalValue.style.cssText =
    'font-size:13px; font-weight:600; color: white;';
  intervalValue.textContent = `${config.interval} ms`;
  configRowLabel.appendChild(intervalValue);

  const intervalControl = document.createElement('div');
  intervalControl.style.cssText = 'display:flex; align-items:center; gap:12px;';

  const intervalSlider = document.createElement('input');
  intervalSlider.type = 'range';
  intervalSlider.min = MIN_INTERVAL;
  intervalSlider.max = MAX_INTERVAL;
  intervalSlider.step = 100;
  intervalSlider.value = config.interval;
  intervalSlider.style.cssText = 'flex:1; accent-color: #f7f7f7;';

  const intervalNumber = document.createElement('input');
  intervalNumber.type = 'number';
  intervalNumber.min = MIN_INTERVAL;
  intervalNumber.max = MAX_INTERVAL;
  intervalNumber.step = 100;
  intervalNumber.value = config.interval;
  intervalNumber.style.cssText = `
    width: 84px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.05);
    color: white;
    padding: 4px 10px;
    font-size: 13px;
    text-align: center;
  `;

  intervalControl.appendChild(intervalSlider);
  intervalControl.appendChild(intervalNumber);

  const autoPlayRow = document.createElement('div');
  autoPlayRow.style.cssText =
    'display:flex; align-items:center; justify-content:space-between; gap: 12px;';

  const autoPlayLabel = document.createElement('div');
  autoPlayLabel.textContent = 'Auto advance';
  autoPlayLabel.style.cssText = 'font-size:13px; color: rgba(255,255,255,0.9);';

  const autoPlayToggle = document.createElement('button');
  autoPlayToggle.type = 'button';
  autoPlayToggle.style.cssText = `
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.05);
    color: white;
    padding: 6px 16px;
    font-size: 13px;
    cursor: pointer;
  `;

  function updateAutoPlayToggle() {
    autoPlayToggle.textContent = config.autoPlay ? 'On' : 'Off';
    autoPlayToggle.style.borderColor = config.autoPlay
      ? 'rgba(130,255,180,0.7)'
      : 'rgba(255,255,255,0.25)';
    autoPlayToggle.style.color = config.autoPlay ? '#84ffa5' : 'white';
  }

  autoPlayToggle.addEventListener('click', () => {
    config.autoPlay = !config.autoPlay;
    playing = overlayOpen ? config.autoPlay : playing;
    updateAutoPlayToggle();
    updateHint();
    if (overlayOpen && playing) setProgress(idx, true);
  });

  updateAutoPlayToggle();
  autoPlayRow.appendChild(autoPlayLabel);
  autoPlayRow.appendChild(autoPlayToggle);

  configBlock.appendChild(configRowLabel);
  configBlock.appendChild(intervalControl);
  configBlock.appendChild(autoPlayRow);

  const selectionContainer = document.createElement('div');
  selectionContainer.style.cssText =
    'display:flex; flex-direction:column; gap:8px; flex:1; overflow:hidden;';

  const selectionActions = document.createElement('div');
  selectionActions.style.cssText =
    'display:flex; align-items:center; justify-content:space-between; gap:10px;';

  const selectionInfo = document.createElement('div');
  selectionInfo.style.cssText =
    'font-size:13px; color: rgba(255,255,255,0.75);';
  selectionInfo.textContent = '0 selected / loading...';

  const quickActions = document.createElement('div');
  quickActions.style.cssText = 'display:flex; gap:6px;';

  function createActionButton(label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = `
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      padding: 6px 14px;
      background: rgba(255,255,255,0.05);
      color: white;
      font-size: 13px;
      cursor: pointer;
    `;
    btn.onmouseenter = () => (btn.style.background = 'rgba(255,255,255,0.12)');
    btn.onmouseleave = () => (btn.style.background = 'rgba(255,255,255,0.05)');
    return btn;
  }

  const selectAllBtn = createActionButton('Select all');
  const selectNoneBtn = createActionButton('Deselect all');
  quickActions.appendChild(selectAllBtn);
  quickActions.appendChild(selectNoneBtn);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Filter comments…';
  searchInput.style.cssText = `
    width: 100%;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.06);
    color: white;
    padding: 10px 14px;
    font-size: 13px;
    outline: none;
  `;

  const selectionList = document.createElement('div');
  selectionList.style.cssText = `
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 4px;
  `;

  selectionContainer.appendChild(selectionActions);
  selectionActions.appendChild(selectionInfo);
  selectionActions.appendChild(quickActions);
  selectionContainer.appendChild(searchInput);
  selectionContainer.appendChild(selectionList);

  settingsBody.appendChild(configBlock);
  settingsBody.appendChild(selectionContainer);

  settingsCard.appendChild(settingsHeader);
  settingsCard.appendChild(settingsBody);
  settingsPanel.appendChild(settingsCard);
  document.body.appendChild(settingsPanel);

  function updateInterval(ms) {
    const clamped = Math.max(
      MIN_INTERVAL,
      Math.min(MAX_INTERVAL, Number(ms) || DEFAULT_INTERVAL)
    );
    config.interval = clamped;
    intervalSlider.value = clamped;
    intervalNumber.value = clamped;
    intervalValue.textContent = `${clamped} ms`;
    if (overlayOpen && playing) setProgress(idx, true);
  }

  intervalSlider.addEventListener('input', () =>
    updateInterval(intervalSlider.value)
  );
  intervalNumber.addEventListener('change', () =>
    updateInterval(intervalNumber.value)
  );

  function rebuildSelectionList({ snapshot = true } = {}) {
    if (snapshot) ensureFreshSnapshot();
    const filter = (searchInput.value || '').trim().toLowerCase();
    const items = Array.from(nodeByKey.entries()).map(([key, node]) => ({
      key,
      node,
      text: normalizeText(node.innerText)
    }));

    const filtered = filter
      ? items.filter((item) => item.text.toLowerCase().includes(filter))
      : items;

    selectionInfo.textContent = `${selectedKeys.size} selected · ${items.length} total`;
    selectionList.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.textContent =
        'No comments were found. Make sure the post has loaded more before opening settings again.';
      empty.style.cssText = 'color: rgba(255,255,255,0.6); font-size: 13px;';
      selectionList.appendChild(empty);
      return;
    }

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No matching comments for that filter.';
      empty.style.cssText = 'color: rgba(255,255,255,0.6); font-size: 13px;';
      selectionList.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const row = document.createElement('label');
      row.style.cssText = `
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 10px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.04);
        cursor: pointer;
      `;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedKeys.has(item.key);
      checkbox.style.cssText = 'margin-top: 2px; transform: scale(1.05);';

      const text = document.createElement('div');
      text.textContent = item.text || '(no text)';
      text.style.cssText = `
        color: white;
        font-size: 13px;
        line-height: 1.35;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      `;

      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedKeys.add(item.key);
        else selectedKeys.delete(item.key);
        selectionInfo.textContent = `${selectedKeys.size} selected · ${items.length} total`;
        if (overlayOpen) {
          idx = 0;
          render(0, true);
        }
      });

      row.appendChild(checkbox);
      row.appendChild(text);
      selectionList.appendChild(row);
    }
  }

  selectAllBtn.addEventListener('click', () => {
    ensureFreshSnapshot();
    selectedKeys = new Set(nodeByKey.keys());
    rebuildSelectionList({ snapshot: false });
    if (overlayOpen) {
      idx = 0;
      render(0, true);
    }
  });

  selectNoneBtn.addEventListener('click', () => {
    selectedKeys = new Set();
    ensureFreshSnapshot(false);
    rebuildSelectionList({ snapshot: false });
    if (overlayOpen) {
      idx = 0;
      render(0, true);
    }
  });

  searchInput.addEventListener('input', rebuildSelectionList);

  function showSettingsPanel(focusSearch = false) {
    settingsVisible = true;
    settingsPanel.style.display = 'flex';
    rebuildSelectionList();
    if (focusSearch) {
      setTimeout(() => searchInput.focus(), 200);
    }
    if (overlayOpen) {
      playing = false;
      updateHint();
    }
  }

  function hideSettingsPanel() {
    settingsVisible = false;
    settingsPanel.style.display = 'none';
    if (overlayOpen) {
      playing = config.autoPlay;
      updateHint();
      render(idx, true);
    }
  }

  settingsClose.addEventListener('click', hideSettingsPanel);
  settingsPanel.addEventListener('click', (event) => {
    if (event.target === settingsPanel) hideSettingsPanel();
  });

  function updateHint() {
    if (!hint) return;
    if (settingsVisible) {
      hint.textContent = 'Settings open • paused • Esc hides';
      return;
    }
    if (!playing) {
      hint.textContent = 'Paused • ⟵/⟶ • Space play • Esc hides';
    } else {
      hint.textContent = 'Tap left/right • ⟵/⟶ • Space pause • Esc hides';
    }
  }

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      background: rgba(0,0,0,0.88);
      display: none;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    const phone = document.createElement('div');
    phone.style.cssText = `
      width: min(390px, 92vw);
      height: min(844px, 92vh);
      border-radius: 34px;
      background: #0b0c10;
      border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 18px 70px rgba(0,0,0,0.6);
      position: relative;
      overflow: hidden;
    `;

    progressWrap = document.createElement('div');
    progressWrap.style.cssText = `
      position: absolute;
      left: 12px;
      right: 12px;
      top: 10px;
      display: flex;
      gap: 4px;
      height: 3px;
      z-index: 11;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 64px;
      padding: 10px 14px 8px 14px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.75), rgba(0,0,0,0));
      z-index: 10;
      pointer-events: none;
    `;

    pill = document.createElement('div');
    pill.style.cssText = `
      color: rgba(255,255,255,0.92);
      font-size: 12px;
      padding: 8px 10px;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      user-select: none;
      pointer-events: none;
      white-space: nowrap;
    `;
    pill.textContent = 'Loading comments...';

    header.appendChild(pill);

    stage = document.createElement('div');
    stage.style.cssText = `
      position: absolute;
      inset: 0;
      padding: 72px 16px 96px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    `;

    stageInner = document.createElement('div');
    stageInner.style.cssText = `
      width: 100%;
      max-width: 360px;
      background: rgba(255, 255, 255, 0);
      max-height: 100%;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 200ms ease, transform 200ms ease;
      opacity: 0;
      transform: translateY(10px);
    `;

    stage.appendChild(stageInner);

    const bottom = document.createElement('div');
    bottom.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 96px;
      padding: 12px 14px 16px 14px;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      background: linear-gradient(to top, rgba(0,0,0,0.70), rgba(0,0,0,0));
      gap: 10px;
      z-index: 10;
    `;

    hint = document.createElement('div');
    hint.style.cssText = `
      color: rgba(255,255,255,0.85);
      font-size: 12px;
      line-height: 1.2;
      user-select: none;
    `;
    hint.textContent = 'Tap left/right • ⟵/⟶ • Space pause • Esc hides';

    bottomSettingsBtn = document.createElement('button');
    bottomSettingsBtn.textContent = 'Settings';
    bottomSettingsBtn.type = 'button';
    bottomSettingsBtn.style.cssText = `
      border: 1px solid rgba(255,255,255,0.20);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.92);
      border-radius: 999px;
      padding: 10px 12px;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    `;
    bottomSettingsBtn.onmouseenter = () =>
      (bottomSettingsBtn.style.background = 'rgba(255,255,255,0.14)');
    bottomSettingsBtn.onmouseleave = () =>
      (bottomSettingsBtn.style.background = 'rgba(255,255,255,0.08)');
    bottomSettingsBtn.addEventListener('click', () => showSettingsPanel(true));

    bottom.appendChild(hint);
    bottom.appendChild(bottomSettingsBtn);

    closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 40px;
      height: 40px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.22);
      background: rgba(255,255,255,0.08);
      color: white;
      font-size: 18px;
      cursor: pointer;
      z-index: 50;
    `;

    closeBtn.addEventListener('click', hideOverlay);
    closeBtn.onmouseenter = () =>
      (closeBtn.style.background = 'rgba(255,255,255,0.16)');
    closeBtn.onmouseleave = () =>
      (closeBtn.style.background = 'rgba(255,255,255,0.08)');

    phone.appendChild(progressWrap);
    phone.appendChild(header);
    phone.appendChild(stage);
    phone.appendChild(bottom);
    phone.appendChild(closeBtn);
    overlay.appendChild(phone);
    document.body.appendChild(overlay);

    stage.addEventListener('click', (event) => {
      if (!overlayOpen) return;
      const rect = stage.getBoundingClientRect();
      const x = event.clientX - rect.left;
      playing = false;
      updateHint();
      if (x < rect.width / 2) render(idx - 1, false);
      else render(idx + 1, false);
    });

    if (!keybound) {
      window.addEventListener('keydown', onKey);
      keybound = true;
    }
  }

  function showOverlay() {
    if (destroyed) return;
    ensureOverlay();
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlayOpen = true;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    playing = config.autoPlay;
    settingsVisible = false;
    updateHint();
    idx = 0;
    render(idx, true);
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.style.display = 'none';
    overlayOpen = false;
    playing = false;
    if (prevOverflow !== undefined) {
      document.documentElement.style.overflow = prevOverflow;
    }
    prevOverflow = '';
  }

  function onKey(event) {
    if (destroyed || !overlayOpen) return;
    if (event.key === 'Escape') {
      if (settingsVisible) {
        hideSettingsPanel();
        return;
      }
      hideOverlay();
    }
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      playing = !playing;
      updateHint();
      if (playing) setProgress(idx, true);
    }
    if (event.key === 'ArrowRight') {
      playing = false;
      updateHint();
      render(idx + 1, false);
    }
    if (event.key === 'ArrowLeft') {
      playing = false;
      updateHint();
      render(idx - 1, false);
    }
  }

  function buildProgressBars(count) {
    progressWrap.innerHTML = '';
    const newBars = [];
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div');
      bar.style.cssText = `
        flex: 1;
        background: rgba(255,255,255,0.22);
        overflow: hidden;
        border-radius: 999px;
        position: relative;
      `;
      const fill = document.createElement('div');
      fill.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 0%;
        background: rgba(255,255,255,0.95);
        transition: none;
      `;
      bar.appendChild(fill);
      progressWrap.appendChild(bar);
      newBars.push({ fill });
    }
    return newBars;
  }

  function setProgress(activeIndex, animate) {
    const delay = config.interval;
    bars.forEach(({ fill }, i) => {
      fill.style.transition =
        animate && i === activeIndex ? `width ${delay}ms linear` : 'none';
      fill.style.width =
        i < activeIndex ? '100%' : i === activeIndex ? '0%' : '0%';
    });
    const active = bars[activeIndex];
    if (active && animate) {
      void active.fill.offsetWidth;
      active.fill.style.width = '100%';
    }
  }

  function render(targetIndex, animateProgress = false) {
    ensureFreshSnapshot();
    const list = selectedNodesList();

    if (!overlayOpen && !overlay) return;

    if (!list.length) {
      stageInner.innerHTML = '';
      const message = document.createElement('div');
      message.style.cssText = `
        width: 100%;
        max-width: 360px;
        border-radius: 16px;
        padding: 14px;
        background: rgba(255,255,255,1);
        border: 1px solid rgba(255,255,255,0.12);
        color: white;
        font-size: 14px;
        line-height: 1.4;
      `;
      message.textContent =
        'No comments selected. Open settings to choose at least one.';
      stageInner.appendChild(message);
      stageInner.style.opacity = '1';
      stageInner.style.transform = 'translateY(0)';
      pill.textContent = '0 / 0 selected';
      bars = buildProgressBars(0);
      return;
    }

    if (bars.length !== list.length) bars = buildProgressBars(list.length);

    idx = ((targetIndex % list.length) + list.length) % list.length;

    stageInner.style.opacity = '0';
    stageInner.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      stageInner.innerHTML = '';
      stageInner.scrollTop = 0;
      stageInner.appendChild(cloneForOverlay(list[idx]));
      requestAnimationFrame(() => {
        stageInner.style.opacity = '1';
        stageInner.style.transform = 'translateY(0)';
      });
    });

    pill.textContent = `${idx + 1} / ${list.length} selected`;
    setProgress(idx, animateProgress);
  }

  (async () => {
    while (!destroyed) {
      if (!overlayOpen || !playing || settingsVisible) {
        await sleep(90);
        continue;
      }
      setProgress(idx, true);
      await sleep(config.interval);
      if (destroyed || !overlayOpen || !playing || settingsVisible) continue;
      render(idx + 1, false);
    }
  })();

  function showSettingsPanelFromButton() {
    showSettingsPanel(true);
  }

  settingsButton.addEventListener('click', showSettingsPanelFromButton);
  slideshowButton.addEventListener('click', showOverlay);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    hideSettingsPanel();
    hideOverlay();
    settingsPanel.remove();
    launcher.remove();
    overlay?.remove();
    if (keybound) {
      window.removeEventListener('keydown', onKey);
      keybound = false;
    }
    document.documentElement.style.overflow = '';
    try {
      delete window.__IG_COMMENT_SLIDESHOW__;
    } catch {}
  }

  window.__IG_COMMENT_SLIDESHOW__ = {
    destroy,
    openSlideshow: showOverlay,
    openSelector: showSettingsPanelFromButton,
    selectNone: () => {
      selectedKeys = new Set();
      rebuildSelectionList();
      idx = 0;
      render(0, true);
    },
    selectAll: () => {
      ensureFreshSnapshot();
      selectedKeys = new Set(nodeByKey.keys());
      rebuildSelectionList();
      idx = 0;
      render(0, true);
    },
    getSelectedCount: () => selectedKeys.size,
    config
  };
})();
