(() => {
  // ====== CONFIG ======
  const SELECTOR = '._a9ym'; // comment nodes
  const DELAY_MS = 1000; // 1 second per comment
  const MOBILE_W = 390; // mobile frame width
  const MOBILE_H = 844; // mobile frame height
  const MAX_ITEMS = 800; // safety cap

  // ====== CLEANUP EXISTING ======
  const old = document.getElementById('__ig_comment_slideshow_overlay__');
  if (old) old.remove();

  // ====== HELPERS ======
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function snapshotComments() {
    const nodes = $$(SELECTOR).filter(
      (n) => (n.innerText || '').trim().length > 0
    );
    return nodes.slice(0, MAX_ITEMS);
  }

  function normalizeText(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function commentKey(node, fallbackIndex) {
    // stable-ish key for selection persistence
    const t = normalizeText(node.innerText);
    return t ? `${t.slice(0, 160)}::${t.length}` : `idx::${fallbackIndex}`;
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
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.10);
      backdrop-filter: blur(6px);
      color: white;
    `;
    wrapper.appendChild(clone);
    return wrapper;
  }

  // ====== OVERLAY UI ======
  const overlay = document.createElement('div');
  overlay.id = '__ig_comment_slideshow_overlay__';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(0,0,0,0.92);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  `;

  const phone = document.createElement('div');
  phone.style.cssText = `
    width: min(${MOBILE_W}px, 92vw);
    height: min(${MOBILE_H}px, 92vh);
    border-radius: 34px;
    background: #0b0c10;
    border: 1px solid rgba(255,255,255,0.14);
    box-shadow: 0 18px 70px rgba(0,0,0,0.6);
    position: relative;
    overflow: hidden;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    width: 40px; height: 40px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.22);
    background: rgba(255,255,255,0.08);
    color: white;
    font-size: 18px;
    cursor: pointer;
    z-index: 50;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    position: absolute;
    left: 0; right: 0; top: 0;
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

  const title = document.createElement('div');
  title.style.cssText = `
    color: rgba(255,255,255,0.92);
    font-size: 13px;
    line-height: 1.1;
    pointer-events: none;
  `;
  title.textContent = 'Comment Slideshow';

  const pill = document.createElement('div');
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

  header.appendChild(title);
  header.appendChild(pill);

  const progressWrap = document.createElement('div');
  progressWrap.style.cssText = `
    position: absolute;
    left: 12px; right: 12px; top: 10px;
    display: flex;
    gap: 4px;
    height: 3px;
    z-index: 11;
  `;

  const stage = document.createElement('div');
  stage.style.cssText = `
    position: absolute;
    inset: 0;
    padding: 72px 16px 96px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const stageInner = document.createElement('div');
  stageInner.style.cssText = `
    width: 100%;
    max-width: 360px;
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
    left: 0; right: 0; bottom: 0;
    height: 96px;
    padding: 12px 14px 16px 14px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    background: linear-gradient(to top, rgba(0,0,0,0.70), rgba(0,0,0,0));
    gap: 10px;
    z-index: 10;
  `;

  const hint = document.createElement('div');
  hint.style.cssText = `
    color: rgba(255,255,255,0.85);
    font-size: 12px;
    line-height: 1.2;
    user-select: none;
  `;
  hint.textContent = 'Tap left/right • ⟵/⟶ • Space pause • Esc close';
  bottom.appendChild(hint);

  const btn = (label) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `
      border: 1px solid rgba(255,255,255,0.20);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.92);
      border-radius: 999px;
      padding: 10px 12px;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
    `;
    b.onmouseenter = () => (b.style.background = 'rgba(255,255,255,0.14)');
    b.onmouseleave = () => (b.style.background = 'rgba(255,255,255,0.08)');
    return b;
  };

  const editBtn = btn('Select comments');
  editBtn.style.marginLeft = 'auto';
  bottom.appendChild(editBtn);

  phone.appendChild(progressWrap);
  phone.appendChild(header);
  phone.appendChild(stage);
  phone.appendChild(bottom);
  phone.appendChild(closeBtn);
  overlay.appendChild(phone);
  document.body.appendChild(overlay);

  // prevent page scroll behind
  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';

  // ====== SELECTION STATE ======
  let allNodes = snapshotComments();
  const nodeByKey = new Map();
  allNodes.forEach((n, i) => nodeByKey.set(commentKey(n, i), n));

  // Selected set defaults to all
  let selectedKeys = new Set(Array.from(nodeByKey.keys()));

  // ====== PLAYER STATE ======
  let idx = 0;
  let playing = true;
  let destroyed = false;
  let bars = [];

  function selectedNodesList() {
    const keys = Array.from(selectedKeys);
    const list = keys.map((k) => nodeByKey.get(k)).filter(Boolean);
    return list;
  }

  function buildProgressBars(count) {
    progressWrap.innerHTML = '';
    const out = [];
    for (let i = 0; i < count; i++) {
      const b = document.createElement('div');
      b.style.cssText = `
        flex: 1;
        background: rgba(255,255,255,0.22);
        overflow: hidden;
        border-radius: 999px;
        position: relative;
      `;
      const fill = document.createElement('div');
      fill.style.cssText = `
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 0%;
        background: rgba(255,255,255,0.95);
        transition: none;
      `;
      b.appendChild(fill);
      progressWrap.appendChild(b);
      out.push({ fill });
    }
    return out;
  }

  function setProgress(activeIndex, animate) {
    bars.forEach(({ fill }, i) => {
      fill.style.transition =
        animate && i === activeIndex ? `width ${DELAY_MS}ms linear` : 'none';
      fill.style.width =
        i < activeIndex ? '100%' : i === activeIndex ? '0%' : '0%';
    });
    const a = bars[activeIndex];
    if (a && animate) {
      void a.fill.offsetWidth;
      a.fill.style.width = '100%';
    }
  }

  function ensureFreshSnapshot() {
    // Re-snapshot to include newly loaded comments, but keep selections if possible.
    const latest = snapshotComments();
    // Rebuild maps
    allNodes = latest;
    nodeByKey.clear();
    allNodes.forEach((n, i) => nodeByKey.set(commentKey(n, i), n));

    // Keep selected keys that still exist; add new ones as selected by default
    const nextSelected = new Set();
    for (const k of selectedKeys) if (nodeByKey.has(k)) nextSelected.add(k);
    for (const k of nodeByKey.keys())
      if (!nextSelected.has(k)) nextSelected.add(k);
    selectedKeys = nextSelected;
  }

  function render(i, animateProgress = false) {
    ensureFreshSnapshot();
    const list = selectedNodesList();

    if (!list.length) {
      stageInner.innerHTML = '';
      const msg = document.createElement('div');
      msg.style.cssText = `
        width: 100%;
        max-width: 360px;
        border-radius: 16px;
        padding: 14px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        color: white;
        font-size: 14px;
        line-height: 1.4;
      `;
      msg.textContent = `No comments selected. Tap "Select comments" and choose at least one.`;
      stageInner.appendChild(msg);
      stageInner.style.opacity = '1';
      stageInner.style.transform = 'translateY(0)';
      pill.textContent = `0 / 0`;
      bars = buildProgressBars(0);
      return;
    }

    if (bars.length !== list.length) bars = buildProgressBars(list.length);

    idx = (i + list.length) % list.length;

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

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    document.documentElement.style.overflow = prevOverflow;
    window.removeEventListener('keydown', onKey);
    overlay.remove();
    try {
      delete window.__IG_COMMENT_SLIDESHOW__;
    } catch {}
  }

  closeBtn.addEventListener('click', destroy);

  function onKey(e) {
    if (destroyed) return;
    if (e.key === 'Escape') destroy();
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      playing = !playing;
      hint.textContent = playing
        ? 'Tap left/right • ⟵/⟶ • Space pause • Esc close'
        : 'Paused • ⟵/⟶ • Space play • Esc close';
      if (playing) setProgress(idx, true);
    }
    if (e.key === 'ArrowRight') {
      playing = false;
      hint.textContent = 'Paused • ⟵/⟶ • Space play • Esc close';
      render(idx + 1, false);
    }
    if (e.key === 'ArrowLeft') {
      playing = false;
      hint.textContent = 'Paused • ⟵/⟶ • Space play • Esc close';
      render(idx - 1, false);
    }
  }
  window.addEventListener('keydown', onKey);

  stage.style.cursor = 'pointer';
  stage.addEventListener('click', (e) => {
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    playing = false;
    hint.textContent = 'Paused • ⟵/⟶ • Space play • Esc close';
    if (x < rect.width / 2) render(idx - 1, false);
    else render(idx + 1, false);
  });

  // ====== SELECTION UI (PICKER) ======
  const picker = document.createElement('div');
  picker.style.cssText = `
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.88);
    z-index: 40;
    display: none;
    flex-direction: column;
  `;

  const pickerTop = document.createElement('div');
  pickerTop.style.cssText = `
    padding: 14px 14px 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
  `;

  const pickerTitle = document.createElement('div');
  pickerTitle.style.cssText = `
    color: rgba(255,255,255,0.95);
    font-size: 13px;
    font-weight: 600;
  `;
  pickerTitle.textContent = 'Select comments';

  const search = document.createElement('input');
  search.placeholder = 'Search text…';
  search.style.cssText = `
    flex: 1;
    height: 36px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.08);
    color: white;
    padding: 0 12px;
    outline: none;
    font-size: 12px;
  `;

  const allBtn = btn('All');
  const noneBtn = btn('None');
  const doneBtn = btn('Done');

  pickerTop.appendChild(pickerTitle);
  pickerTop.appendChild(search);
  pickerTop.appendChild(allBtn);
  pickerTop.appendChild(noneBtn);
  pickerTop.appendChild(doneBtn);

  const pickerList = document.createElement('div');
  pickerList.style.cssText = `
    padding: 10px 14px 14px 14px;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  picker.appendChild(pickerTop);
  picker.appendChild(pickerList);
  phone.appendChild(picker);

  function rebuildPicker() {
    ensureFreshSnapshot();
    const q = normalizeText(search.value).toLowerCase();
    const items = Array.from(nodeByKey.entries()).map(([key, node], i) => ({
      key,
      node,
      text: normalizeText(node.innerText),
      i
    }));

    const filtered = q
      ? items.filter((it) => it.text.toLowerCase().includes(q))
      : items;

    pickerList.innerHTML = '';

    const info = document.createElement('div');
    info.style.cssText = `color: rgba(255,255,255,0.75); font-size: 12px; margin-bottom: 4px;`;
    info.textContent = `${selectedKeys.size} selected / ${items.length} total`;
    pickerList.appendChild(info);

    for (const it of filtered) {
      const row = document.createElement('label');
      row.style.cssText = `
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 10px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.06);
        cursor: pointer;
      `;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selectedKeys.has(it.key);
      cb.style.cssText = `margin-top: 2px; transform: scale(1.1);`;

      const text = document.createElement('div');
      text.style.cssText = `
        color: rgba(255,255,255,0.92);
        font-size: 12px;
        line-height: 1.35;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      `;
      text.textContent = it.text || '(no text)';

      cb.addEventListener('change', () => {
        if (cb.checked) selectedKeys.add(it.key);
        else selectedKeys.delete(it.key);
        // live update header info
        info.textContent = `${selectedKeys.size} selected / ${items.length} total`;
      });

      row.appendChild(cb);
      row.appendChild(text);
      pickerList.appendChild(row);
    }
  }

  function openPicker() {
    playing = false;
    hint.textContent = 'Paused • ⟵/⟶ • Space play • Esc close';
    picker.style.display = 'flex';
    rebuildPicker();
  }

  function closePicker(apply = true) {
    picker.style.display = 'none';
    if (apply) {
      idx = 0;
      render(0, true);
    }
  }

  editBtn.addEventListener('click', openPicker);
  doneBtn.addEventListener('click', () => closePicker(true));
  allBtn.addEventListener('click', () => {
    ensureFreshSnapshot();
    selectedKeys = new Set(Array.from(nodeByKey.keys()));
    rebuildPicker();
  });
  noneBtn.addEventListener('click', () => {
    selectedKeys = new Set();
    rebuildPicker();
  });
  search.addEventListener('input', rebuildPicker);

  // ====== START ======
  render(0, true);

  (async () => {
    while (!destroyed) {
      if (!playing || picker.style.display === 'flex') {
        await sleep(80);
        continue;
      }
      setProgress(idx, true);
      await sleep(DELAY_MS);
      if (destroyed || !playing || picker.style.display === 'flex') continue;
      render(idx + 1, false);
    }
  })();

  // Console handle
  window.__IG_COMMENT_SLIDESHOW__ = {
    destroy,
    openSelector: openPicker,
    selectNone: () => {
      selectedKeys = new Set();
      render(0, true);
    },
    selectAll: () => {
      ensureFreshSnapshot();
      selectedKeys = new Set(Array.from(nodeByKey.keys()));
      render(0, true);
    },
    getSelectedCount: () => selectedKeys.size
  };
})();
