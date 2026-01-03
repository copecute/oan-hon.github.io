(async () => {
  const ROM_BASE_URL = 'https://api.oanhon.com/nes/rom/';

  let nes;
  let emulatorLoaded = false;

  const params = new URLSearchParams(location.search);
  let romParam = params.get('rom');
  let romUrl = ROM_BASE_URL + 'contra.nes';
  let romFile = null;

  // Kiểm tra xem có romParam không
  if (romParam) {
    if (/^https?:\/\//i.test(romParam)) {
      romUrl = romParam;
    } else {
      let cleanName = romParam.replace(/^\/+/, '');
      if (!cleanName.endsWith('.nes')) cleanName += '.nes';
      romUrl = ROM_BASE_URL + cleanName;
    }
    const gameName = params.get('name') || 'NES GAME';
    document.getElementById('game-title').innerText = gameName;
    await loadROM(romUrl, gameName);
  } else {
    // Không có romParam, hiển thị UI chọn file
    document.getElementById('rom-select-overlay').style.display = 'flex';

    // Thiết lập sự kiện cho nút chọn file
    document.getElementById('select-rom-btn').onclick = () => {
      document.getElementById('rom-file-input').click();
    };

    // Sự kiện khi chọn file
    document.getElementById('rom-file-input').onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        romFile = file;
        const gameName = file.name.replace('.nes', '');
        document.getElementById('game-title').innerText = gameName;
        document.getElementById('rom-select-overlay').style.display = 'none';
        await loadROM(romFile, gameName);
      }
    };

    // Sự kiện cho nút chọn file
    document.getElementById('select-rom-btn').ontouchend = (e) => {
      e.preventDefault();
      document.getElementById('rom-file-input').click();
    };
  }

  async function loadROM(romSource, gameName) {
    document.getElementById('loading-overlay').style.display = 'flex';

    try {
      if (romSource instanceof File) {
        // Load từ file
        nes = await Nostalgist.nes(romSource);
      } else {
        // Load từ URL
        nes = await Nostalgist.nes(romSource);
      }
      document.getElementById('emulator-container').appendChild(nes.getCanvas());
      document.getElementById('loading-overlay').style.display = 'none';
      emulatorLoaded = true;
    } catch (err) {
      document.getElementById('loading-overlay').style.display = 'none';
      document.getElementById('error-overlay').style.display = 'flex';
      const msg = err.message || 'Không thể tải ROM. Kiểm tra file hoặc kết nối mạng.';
      document.getElementById('error-message').innerText = `Lỗi: ${msg}`;
      console.error(err);
      return;
    }
  }

  const topBar = document.getElementById('top-bar');
  const showMenuBtn = document.getElementById('show-menu-btn');
  const hideMenuBtn = document.getElementById('hide-menu-btn');
  
  hideMenuBtn.onclick = () => {
    topBar.classList.add('hidden');
    showMenuBtn.style.display = 'flex';
  };
  
  const showMenuFn = () => {
    topBar.classList.remove('hidden');
    showMenuBtn.style.display = 'none';
  };

  showMenuBtn.onclick = showMenuFn;
  showMenuBtn.ontouchend = (e) => {
    e.preventDefault();
    showMenuFn();
  };
  
  let isEditMode = false;
  let navTouchId = null;
  const touchingKeys = new Set();
  const pressedInGame = new Set();
  const keyboardPressed = new Set();
  let autoFireConfig = { a: false, b: false };
  let turboMode = { a: 'toggle', b: 'toggle' };
  let virtualControls = true;
  let showFPS = false;
  let turboCounter = 0;
  
  const actionLabel = {
    up: 'Hướng lên',
    down: 'Hướng xuống',
    left: 'Hướng trái',
    right: 'Hướng phải',
    a: 'Nút A',
    b: 'Nút B',
    start: 'Nút Start',
    select: 'Nút Select',
    turboA: 'Turbo A (bật/tắt)',
    turboB: 'Turbo B (bật/tắt)',
    menu: 'Mở menu cài đặt'
  };
  
  const actionsList = Object.keys(actionLabel).map(act => ({action: act, label: actionLabel[act]}));
  
  const defaultKeyToAction = {
    'w': 'up', 'W': 'up',
    's': 'down', 'S': 'down',
    'a': 'left', 'A': 'left',
    'd': 'right', 'D': 'right',
    'k': 'a', 'K': 'a',
    'j': 'b', 'J': 'b',
    'h': 'start', 'H': 'start',
    'g': 'select', 'G': 'select',
    'i': 'turboA', 'I': 'turboA',
    'u': 'turboB', 'U': 'turboB',
    't': 'menu', 'T': 'menu'
  };
  
  let keyToAction = {...defaultKeyToAction};
  let actionToKey = {};
  
  const buildActionToKey = () => {
    actionToKey = {};
    for (const [k, act] of Object.entries(keyToAction)) {
      actionToKey[act] = k;
    }
  };
  
  const formatKey = (key) => {
    if (!key) return 'Chưa đặt';
    if (key === 'Shift') return 'Shift';
    if (key.startsWith('Arrow')) {
      const dir = key.replace('Arrow', '');
      return dir + ' (mũi tên)';
    }
    if (key.length === 1) return key.toUpperCase();
    return key;
  };
  
  const sendKey = (key, pressed) => {
    if (pressed) {
      if (!pressedInGame.has(key)) {
        nes.pressDown(key);
        pressedInGame.add(key);
      }
    } else {
      if (pressedInGame.has(key)) {
        nes.pressUp(key);
        pressedInGame.delete(key);
      }
    }
  };
  
  const updateButtonVisual = (key, pressed) => {
    if (['up','down','left','right'].includes(key)) {
      document.querySelectorAll(`[data-dir="${key}"]`).forEach(el => el.classList.toggle('active-dir', pressed));
    }
    if (['a','b','start','select'].includes(key)) {
      const el = document.getElementById(`btn-${key}`);
      if (el) el.classList.toggle('active-press', pressed);
    }
  };
  
  const updateTurboVisual = () => {
    ['a', 'b'].forEach(k => {
      const mainBtn = document.getElementById(`btn-${k}`);
      const turboBtn = document.getElementById(`turbo-${k}`);
      if (mainBtn) mainBtn.classList.toggle('auto-on', autoFireConfig[k]);
      if (turboBtn) turboBtn.classList.toggle('toggle-active', autoFireConfig[k]);
    });
  };
  
  const updateTurboModeUI = () => {
    const modeBtnA = document.getElementById('mode-turbo-a');
    const modeBtnB = document.getElementById('mode-turbo-b');
    if (modeBtnA) {
      modeBtnA.innerText = turboMode.a === 'hold' ? 'BẤM GIỮ' : 'BẤM NHẢ';
      modeBtnA.classList.toggle('toggle-active', turboMode.a === 'toggle');
    }
    if (modeBtnB) {
      modeBtnB.innerText = turboMode.b === 'hold' ? 'BẤM GIỮ' : 'BẤM NHẢ';
      modeBtnB.classList.toggle('toggle-active', turboMode.b === 'toggle');
    }
  };
  
  setInterval(() => {
    turboCounter++;
    const isTurboFrame = turboCounter % 2 === 0;
    ['a', 'b'].forEach(k => {
      const manualPressed = touchingKeys.has(k) || keyboardPressed.has(k);
      if (autoFireConfig[k] && !manualPressed) {
        if (isTurboFrame) nes.pressDown(k);
        else nes.pressUp(k);
      }
    });
  }, 60);
  
  const forceTurboRelease = (k) => {
    const manualPressed = touchingKeys.has(k) || keyboardPressed.has(k);
    if (!autoFireConfig[k] && !manualPressed) {
      sendKey(k, false);
    }
  };
  
  let fpsFrames = 0;
  let fpsLastTime = performance.now();
  const fpsElement = document.getElementById('fps-display');
  const fpsLoop = () => {
    if (showFPS) {
      fpsFrames++;
      const now = performance.now();
      if (now - fpsLastTime >= 1000) {
        fpsElement.innerText = `FPS: ${fpsFrames}`;
        fpsFrames = 0;
        fpsLastTime = now;
      }
    }
    requestAnimationFrame(fpsLoop);
  };
  
  const processTouches = (e) => {
    if (!virtualControls || e.target.closest('#top-bar') || e.target.closest('#modal-settings') || isEditMode) return;
    e.preventDefault();
  
    const currentFrameKeys = new Set();
    const navEl = document.querySelector('.ctrl-element[data-role="nav"]:not([style*="display: none"])');
    const navRect = navEl ? navEl.getBoundingClientRect() : null;
    const stick = document.getElementById('analog-stick');
    const actionBtns = document.querySelectorAll('.overlay-btn[data-key]');
  
    Array.from(e.touches).forEach(t => {
      const x = t.clientX, y = t.clientY;
      let isNavFinger = false;
      if (navRect) {
        if (navTouchId === null && x >= navRect.left && x <= navRect.right && y >= navRect.top && y <= navRect.bottom) navTouchId = t.identifier;
        if (t.identifier === navTouchId) {
          isNavFinger = true;
          const centerX = navRect.left + navRect.width / 2, centerY = navRect.top + navRect.height / 2;
          const dx = x - centerX, dy = y - centerY, dist = Math.sqrt(dx*dx + dy*dy);
          if (navEl.id === 'analog') {
            const limit = navRect.width / 2;
            stick.style.transform = `translate(${dist > limit ? dx*(limit/dist) : dx}px, ${dist > limit ? dy*(limit/dist) : dy}px)`;
          }
          const ts = 15;
          if (dy < -ts) currentFrameKeys.add('up');
          if (dy > ts) currentFrameKeys.add('down');
          if (dx < -ts) currentFrameKeys.add('left');
          if (dx > ts) currentFrameKeys.add('right');
        }
      }
      if (!isNavFinger) {
        for (const btn of actionBtns) {
          const r = btn.getBoundingClientRect();
          if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
            currentFrameKeys.add(btn.dataset.key);
          }
        }
      }
    });
  
    const activeIds = Array.from(e.touches).map(t => t.identifier);
    if (!activeIds.includes(navTouchId)) {
      navTouchId = null;
      if (stick) stick.style.transform = `translate(0,0)`;
    }
  
    touchingKeys.clear();
    currentFrameKeys.forEach(k => touchingKeys.add(k));
  
    ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'].forEach(k => {
      const pressed = currentFrameKeys.has(k);
      sendKey(k, pressed);
      updateButtonVisual(k, pressed);
    });
  
    if (e.type === 'touchend') {
      Array.from(e.changedTouches).forEach(t => {
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const turboBtn = el?.closest('[data-turbo]');
        if (turboBtn) {
          const key = turboBtn.dataset.turbo;
          if (turboMode[key] === 'toggle') {
            autoFireConfig[key] = !autoFireConfig[key];
            forceTurboRelease(key);
            updateTurboVisual();
            save();
          }
        }
      });
    }
  };
  
  const area = document.body;
  area.addEventListener('touchstart', processTouches, {passive: false});
  area.addEventListener('touchmove', processTouches, {passive: false});
  area.addEventListener('touchend', processTouches, {passive: false});
  area.addEventListener('touchcancel', processTouches, {passive: false});
  
  document.addEventListener('keydown', (e) => {
    const action = keyToAction[e.key];
    if (!action) return;
    
    if (action === 'turboA') {
      if (turboMode.a === 'toggle') {
        autoFireConfig.a = !autoFireConfig.a;
        forceTurboRelease('a');
        updateTurboVisual();
        save();
      }
      e.preventDefault();
    } else if (action === 'turboB') {
      if (turboMode.b === 'toggle') {
        autoFireConfig.b = !autoFireConfig.b;
        forceTurboRelease('b');
        updateTurboVisual();
        save();
      }
      e.preventDefault();
    } else if (action === 'menu') {
      document.getElementById('modal-settings').style.display = 'flex';
      e.preventDefault();
    } else if (['up','down','left','right','a','b','start','select'].includes(action)) {
      if (!keyboardPressed.has(action)) {
        keyboardPressed.add(action);
        sendKey(action, true);
        updateButtonVisual(action, true);
        e.preventDefault();
      }
    }
  });
  
  document.addEventListener('keyup', (e) => {
    const action = keyToAction[e.key];
    if (action && ['up','down','left','right','a','b','start','select'].includes(action)) {
      if (keyboardPressed.has(action)) {
        keyboardPressed.delete(action);
        sendKey(action, false);
        updateButtonVisual(action, false);
      }
    }
    if (action === 'turboA' && turboMode.a === 'hold') {
      autoFireConfig.a = false;
      forceTurboRelease('a');
      updateTurboVisual();
    }
    if (action === 'turboB' && turboMode.b === 'hold') {
      autoFireConfig.b = false;
      forceTurboRelease('b');
      updateTurboVisual();
    }
  });
  
  let currentRemapAction = null;
  const settingsMain = document.getElementById('settings-main');
  const keyboardPanel = document.getElementById('keyboard-edit-panel');
  const keyList = document.getElementById('key-list');
  const remapOverlay = document.getElementById('remap-overlay');
  
  const populateKeyList = () => {
    keyList.innerHTML = '';
    actionsList.forEach(item => {
      const {action, label} = item;
      const currentKey = formatKey(actionToKey[action]);
      const div = document.createElement('div');
      div.className = 'setting-item';
      const span = document.createElement('span');
      span.textContent = label;
      const button = document.createElement('button');
      button.className = 'toggle-btn change-key-btn';
      button.dataset.action = action;
      button.textContent = currentKey;
      div.appendChild(span);
      div.appendChild(button);
      keyList.appendChild(div);
    });
  };
  
  keyList.addEventListener('click', (e) => {
    const target = e.target.closest('.change-key-btn');
    if (target) {
      const action = target.dataset.action;
      currentRemapAction = action;
      const label = actionLabel[action] || action.toUpperCase();
      document.getElementById('remap-text').textContent = `Nhấn phím mới cho ${label}\n(Nhấn Escape để hủy)`;
      remapOverlay.style.display = 'flex';
      if (nes && nes.pause) nes.pause();
      document.addEventListener('keydown', remapKeyHandler);
    }
  });
  
  const finishRemap = (canceled = false) => {
    remapOverlay.style.display = 'none';
    if (nes && nes.resume) nes.resume();
    currentRemapAction = null;
    document.removeEventListener('keydown', remapKeyHandler);
    populateKeyList();
  };
  
  const remapKeyHandler = (e) => {
    e.preventDefault();
    const newKey = e.key;
    if (newKey === 'Escape' || newKey === 'Esc') {
      finishRemap(true);
      return;
    }
    const oldKey = actionToKey[currentRemapAction];
    if (oldKey && oldKey !== newKey) delete keyToAction[oldKey];
    keyToAction[newKey] = currentRemapAction;
    actionToKey[currentRemapAction] = newKey;
    save();
    finishRemap();
  };
  
  document.getElementById('cancel-remap').onclick = () => finishRemap(true);
  document.getElementById('cancel-remap').ontouchend = (e) => { e.preventDefault(); finishRemap(true); };
  
  const fpsToggleBtn = document.getElementById('toggle-fps');
  fpsToggleBtn.onclick = () => {
    showFPS = !showFPS;
    fpsToggleBtn.innerText = showFPS ? "BẬT" : "TẮT";
    fpsToggleBtn.classList.toggle('toggle-active', showFPS);
    fpsElement.style.display = showFPS ? 'block' : 'none';
    save();
  };
  
  const modeTurboABtn = document.getElementById('mode-turbo-a');
  const modeTurboBBtn = document.getElementById('mode-turbo-b');
  
  modeTurboABtn.onclick = () => {
    turboMode.a = turboMode.a === 'hold' ? 'toggle' : 'hold';
    updateTurboModeUI();
    save();
  };
  
  modeTurboBBtn.onclick = () => {
    turboMode.b = turboMode.b === 'hold' ? 'toggle' : 'hold';
    updateTurboModeUI();
    save();
  };
  
  document.getElementById('edit-keyboard').onclick = () => {
    settingsMain.style.display = 'none';
    keyboardPanel.style.display = 'block';
    populateKeyList();
  };
  
  document.getElementById('back-to-settings').onclick = () => {
    keyboardPanel.style.display = 'none';
    settingsMain.style.display = 'block';
  };
  
  const modal = document.getElementById('modal-settings');
  document.getElementById('open-settings').onclick = () => {
    modal.style.display = 'flex';
    settingsMain.style.display = 'block';
    keyboardPanel.style.display = 'none';
  };

  document.addEventListener('keydown', (e) => {
    if ((e.key === 't' || e.key === 'T') && modal.style.display === 'flex') {
      e.preventDefault();
      closeModalFn();
    }
  });

  document.getElementById('fullscreen-btn').onclick = () => {
    const docElm = document.documentElement;
    if (docElm.requestFullscreen) {
      docElm.requestFullscreen();
    } else if (docElm.mozRequestFullScreen) {
      docElm.mozRequestFullScreen();
    } else if (docElm.webkitRequestFullscreen) {
      docElm.webkitRequestFullscreen();
    } else if (docElm.msRequestFullscreen) {
      docElm.msRequestFullscreen();
    }
  };
  
  document.getElementById('rotate-btn').onclick = () => {
    if (screen.orientation && screen.orientation.lock) {
      const cur = screen.orientation.type.includes('landscape') ? 'portrait' : 'landscape';
      screen.orientation.lock(cur).catch(()=>{
        alert('Thiết bị không hỗ trợ xoay màn hình tự động.');
      });
    } else {
      alert('Trình duyệt/thiết bị không hỗ trợ!');
    }
  };
  
  const closeModalFn = (e) => {
    e && e.preventDefault();
    modal.style.display = 'none';
    save();
  };
  document.getElementById('close-modal').onclick = closeModalFn;
  document.getElementById('close-modal').ontouchend = closeModalFn;

  document.getElementById('reset-default').onclick = () => {
    localStorage.clear();
    location.reload();
  };
  
  const setupToggle = (id, key, isVirtual = false) => {
    const btn = document.getElementById(id);
    btn.onclick = () => {
      if (isVirtual) {
        virtualControls = !virtualControls;
      }
      updateUI();
      save();
    };
  };
  setupToggle('toggle-virtual', null, true);
  
  const turboBtnA = document.getElementById('turbo-a');
  const turboBtnB = document.getElementById('turbo-b');

  const setupTurboButton = (key, btn) => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (turboMode[key] === 'hold') {
        autoFireConfig[key] = true;
        updateTurboVisual();
      }
    });
    
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (turboMode[key] === 'hold') {
        autoFireConfig[key] = false;
        forceTurboRelease(key);
        updateTurboVisual();
      }
    });
    
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (turboMode[key] === 'hold') {
        autoFireConfig[key] = true;
        updateTurboVisual();
      } else {
        autoFireConfig[key] = !autoFireConfig[key];
        forceTurboRelease(key);
        updateTurboVisual();
        save();
      }
    });
    
    btn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      if (turboMode[key] === 'hold') {
        autoFireConfig[key] = false;
        forceTurboRelease(key);
        updateTurboVisual();
      }
    });
    
    btn.addEventListener('mouseleave', (e) => {
      if (turboMode[key] === 'hold') {
        autoFireConfig[key] = false;
        forceTurboRelease(key);
        updateTurboVisual();
      }
    });
  };
  
  setupTurboButton('a', turboBtnA);
  setupTurboButton('b', turboBtnB);

  document.addEventListener('keydown', (e) => {
    const action = keyToAction[e.key];
    if (action === 'turboA' && turboMode.a === 'hold') {
      if (!autoFireConfig.a) {
        autoFireConfig.a = true;
        updateTurboVisual();
      }
      e.preventDefault();
    } else if (action === 'turboB' && turboMode.b === 'hold') {
      if (!autoFireConfig.b) {
        autoFireConfig.b = true;
        updateTurboVisual();
      }
      e.preventDefault();
    }
  });
  
  let dragObj = null, offset = {x:0, y:0};
  const startDrag = (e) => {
    if (!isEditMode || !virtualControls) return;
    const t = e.touches ? e.touches[0] : e;
    const target = e.target.closest('.ctrl-element');
    if (target) {
      dragObj = target;
      const r = target.getBoundingClientRect();
      offset.x = t.clientX - r.left;
      offset.y = t.clientY - r.top;
    }
  };
  const doDrag = (e) => {
    if (!dragObj) return;
    const t = e.touches ? e.touches[0] : e;
    dragObj.style.left = (t.clientX - offset.x) + 'px';
    dragObj.style.top = (t.clientY - offset.y) + 'px';
    dragObj.style.bottom = 'auto';
    dragObj.style.right = 'auto';
  };
  window.addEventListener('touchstart', startDrag);
  window.addEventListener('touchmove', doDrag);
  window.addEventListener('touchend', () => dragObj = null);
  
  const save = () => {
    const pos = {};
    document.querySelectorAll('.ctrl-element').forEach(el => {
      pos[el.dataset.id] = { left: el.style.left, top: el.style.top, bottom: el.style.bottom, right: el.style.right };
    });
    localStorage.setItem('nes_static_pos', JSON.stringify(pos));
    localStorage.setItem('nes_static_ui', JSON.stringify({   
      scale: document.getElementById('ui-scale').value,   
      opacity: document.getElementById('ui-opacity').value,  
      type: document.getElementById('control-type').value,  
      autoA: autoFireConfig.a,  
      autoB: autoFireConfig.b,  
      virtual: virtualControls,
      showFPS: showFPS,
      turboModeA: turboMode.a,
      turboModeB: turboMode.b
    }));
    localStorage.setItem('nes_static_screen', JSON.stringify({width: window.innerWidth, height: window.innerHeight}));
    localStorage.setItem('nes_keymap', JSON.stringify(keyToAction));
  };
  
  const load = () => {
    const savedScreen = JSON.parse(localStorage.getItem('nes_static_screen') || '{"width":0,"height":0}');
    if (Math.abs(window.innerWidth - savedScreen.width) > 100 || Math.abs(window.innerHeight - savedScreen.height) > 100) {
      localStorage.removeItem('nes_static_pos');
    }
  
    const pos = JSON.parse(localStorage.getItem('nes_static_pos') || '{}');
    Object.keys(pos).forEach(id => {
      const el = document.querySelector(`[data-id="${id}"]`);
      if (el && pos[id]) {
        Object.assign(el.style, pos[id]);
      }
    });
  
    const ui = JSON.parse(localStorage.getItem('nes_static_ui') || '{"scale":"1.0","opacity":"0.7","type":"dpad","autoA":false,"autoB":false,"virtual":true,"showFPS":false,"turboModeA":"toggle","turboModeB":"toggle"}');
    document.getElementById('ui-scale').value = ui.scale;
    document.getElementById('ui-opacity').value = ui.opacity;
    document.getElementById('control-type').value = ui.type;
    autoFireConfig.a = ui.autoA ?? false;
    autoFireConfig.b = ui.autoB ?? false;
    virtualControls = ui.virtual ?? true;
    showFPS = ui.showFPS ?? false;
    turboMode.a = ui.turboModeA ?? 'toggle';
    turboMode.b = ui.turboModeB ?? 'toggle';
  
    const savedKeyMap = JSON.parse(localStorage.getItem('nes_keymap') || 'null');
    if (savedKeyMap) keyToAction = savedKeyMap;
    buildActionToKey();
  
    updateTurboVisual();
    updateTurboModeUI();
    fpsToggleBtn.innerText = showFPS ? "BẬT" : "TẮT";
    fpsToggleBtn.classList.toggle('toggle-active', showFPS);
    fpsElement.style.display = showFPS ? 'block' : 'none';
  };
  
  document.getElementById('start-edit').onclick = () => {
    modal.style.display = 'none';
    isEditMode = true;
    document.getElementById('edit-bar').style.display = 'flex';
    document.getElementById('top-bar').style.display = 'none';
    showMenuBtn.style.display = 'none';
  };
  document.getElementById('save-edit').onclick = () => {
    isEditMode = false;
    document.getElementById('edit-bar').style.display = 'none';
    document.getElementById('top-bar').style.display = 'flex';
    save();
  };
  document.getElementById('reset-pos').onclick = () => { localStorage.clear(); location.reload(); };
  
  const updateUI = () => {
    const s = document.getElementById('ui-scale').value;
    const o = document.getElementById('ui-opacity').value;
    const t = document.getElementById('control-type').value;
    const vBtn = document.getElementById('toggle-virtual');
    vBtn.innerText = virtualControls ? "BẬT" : "TẮT";
    vBtn.classList.toggle('toggle-active', virtualControls);
    document.getElementById('overlay-buttons').style.opacity = virtualControls ? o : '0';
    document.getElementById('overlay-buttons').style.display = virtualControls ? 'block' : 'none';
    document.querySelectorAll('.ctrl-element').forEach(el => el.style.transform = `scale(${s})`);
    document.getElementById('dpad').style.display = t === 'dpad' ? 'grid' : 'none';
    document.getElementById('analog').style.display = t === 'analog' ? 'block' : 'none';
  };
  
  document.getElementById('ui-scale').oninput = updateUI;
  document.getElementById('ui-opacity').oninput = updateUI;
  document.getElementById('control-type').onchange = () => { updateUI(); save(); };
  
  let resizeTimer;
  load();
  updateUI();
  updateTurboVisual();
  updateTurboModeUI();
  requestAnimationFrame(fpsLoop);
})();