(function () {
  'use strict';

  // 只選播放清單本體內的歌曲；頁面底部「推薦影片」區塊也用同一個元件，需排除
  const SELECTOR_ITEM = 'ytd-playlist-video-list-renderer ytd-playlist-video-renderer';
  const SELECTOR_MENU = '#menu.ytd-playlist-video-renderer';
  const CHECK_INTERVAL = 2000;
  const LOG_PREFIX = '[YT-Sorter]';

  let toastEl = null;
  let injecting = false;

  // ---- 設定（由 bridge.js 從 chrome.storage 讀出後寫到 <html data-ytps-settings>）----
  // 本檔在 MAIN world 執行，無法直接存取 chrome.storage
  const SETTINGS_ATTR = 'data-ytps-settings';
  const SETTINGS_EVENT = 'ytps-settings-changed';
  const DEFAULT_SETTINGS = { enabled: true, showBadges: true, lang: 'auto', multiBarPos: 'top' };

  function readSettings() {
    try {
      var raw = document.documentElement.getAttribute(SETTINGS_ATTR);
      return Object.assign({}, DEFAULT_SETTINGS, raw ? JSON.parse(raw) : {});
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  let settings = readSettings();

  // ---- 多語系 ----
  const STRINGS = {
    'zh-TW': {
      moveBtnTitle: '移動位置',
      moveBtnAria: '移動影片位置',
      moveToBefore: '移動到第',
      moveToAfter: '個',
      moveToTop: '移到最前面',
      cancel: '取消',
      confirm: '確認',
      pickFromList: '📋 從完整清單選擇位置',
      currentPos: '目前位置：第 {0} 個（已載入 {1} 部影片）',
      pickerTitle: '選擇目標位置',
      pickerTitleCount: '選擇目標位置（共 {0} 部影片）',
      close: '關閉',
      pickerSearch: '搜尋標題、頻道或編號',
      pickerLoading: '正在取得完整播放清單...',
      pickerFailed: '讀取失敗：{0}',
      untitled: '(無標題)',
      currentTag: '目前',
      stepFetch: '取得完整播放清單',
      stepWrite: '寫入 YouTube',
      noApi: '無法取得 YouTube API 資訊，請重新整理頁面',
      noPlaylistId: '找不到播放清單 ID',
      noItemData: '無法取得影片資料',
      playlistEmpty: '無法取得播放清單資料',
      incomplete: '播放清單讀取不完整（取得 {0} 部影片，畫面已載入 {1} 部），請重新整理後再試',
      notFound: '找不到這部影片在播放清單中的位置，請重新整理後再試',
      alreadyThere: '已經在目標位置了',
      moved: '✓ 已移動到第 {0} 個',
      movedNotLoaded: '✓ 已移動到第 {0} 個（該位置尚未載入，往下捲動即可看到）',
      moveFailed: '移動失敗：{0}',
      selectAria: '選取這部影片',
      multiSelect: '☑ 多選',
      multiSelectTitle: '勾選多部影片一起移動',
      selectedCount: '已選 {0} 個',
      clearSelection: '清除',
      pickerMultiTitle: '勾選要移動的影片（共 {0} 部影片）',
      pickerMultiHint: '勾選要移動的影片，再點任一列設為目標位置',
      targetTag: '目標',
      stepWriteCount: '寫入 YouTube（{0}/{1}）',
      noSelection: '請先勾選要移動的影片',
      selectionGone: '勾選的影片已不在播放清單中，請重新整理後再試',
      multiMoved: '✓ 已將 {0} 部影片移到第 {1} 個起',
      multiMovedReload: '✓ 已將 {0} 部影片移到第 {1} 個起（重新整理頁面即可看到最新順序）',
      multiPartial: '已移動 {0} 部，{1} 部失敗：{2}',
      multiMovedNotLoaded: '✓ 已將 {0} 部影片移到第 {1} 個起（該位置尚未載入，往下捲動即可看到）',
      busy: '另一個移動正在進行，請稍候',
    },
    en: {
      moveBtnTitle: 'Move',
      moveBtnAria: 'Move video',
      moveToBefore: 'Move to #',
      moveToAfter: '',
      moveToTop: 'Move to top',
      cancel: 'Cancel',
      confirm: 'Move',
      pickFromList: '📋 Pick from full list',
      currentPos: 'Current position: #{0} ({1} videos loaded)',
      pickerTitle: 'Choose a position',
      pickerTitleCount: 'Choose a position ({0} videos)',
      close: 'Close',
      pickerSearch: 'Search by title, channel or number',
      pickerLoading: 'Loading the full playlist...',
      pickerFailed: 'Couldn\'t load the playlist: {0}',
      untitled: '(Untitled)',
      currentTag: 'Current',
      stepFetch: 'Load full playlist',
      stepWrite: 'Save to YouTube',
      noApi: 'Couldn\'t read YouTube session info. Reload the page and try again.',
      noPlaylistId: 'Couldn\'t find the playlist ID',
      noItemData: 'Couldn\'t read this video\'s data',
      playlistEmpty: 'Couldn\'t load the playlist',
      incomplete: 'Only {0} videos were loaded, but {1} are on the page. Reload and try again.',
      notFound: 'Couldn\'t find this video in the playlist. Reload and try again.',
      alreadyThere: 'Already at that position',
      moved: '✓ Moved to #{0}',
      movedNotLoaded: '✓ Moved to #{0}. Scroll down to load that part of the list.',
      moveFailed: 'Move failed: {0}',
      selectAria: 'Select this video',
      multiSelect: '☑ Select',
      multiSelectTitle: 'Select several videos and move them together',
      selectedCount: '{0} selected',
      clearSelection: 'Clear',
      pickerMultiTitle: 'Select videos to move ({0} videos)',
      pickerMultiHint: 'Tick the videos to move, then click any row to set the target position',
      targetTag: 'Target',
      stepWriteCount: 'Save to YouTube ({0}/{1})',
      noSelection: 'Select the videos to move first',
      selectionGone: 'The selected videos are no longer in this playlist. Reload and try again.',
      multiMoved: '✓ Moved {0} videos to #{1}',
      multiMovedReload: '✓ Moved {0} videos to #{1}. Reload the page to see the new order.',
      multiPartial: 'Moved {0}, {1} failed: {2}',
      multiMovedNotLoaded: '✓ Moved {0} videos to #{1}. Scroll down to load that part of the list.',
      busy: 'Another move is in progress. Please wait.',
    },
  };

  // 「自動」跟隨 YouTube 介面語言：中文介面用繁中，其餘用英文
  function resolveLang() {
    if (settings.lang === 'zh-TW' || settings.lang === 'en') return settings.lang;
    var hl = '';
    try { hl = window.ytcfg?.get('HL') || ''; } catch (e) { /* ignore */ }
    hl = hl || document.documentElement.lang || navigator.language || '';
    return /^zh/i.test(hl) ? 'zh-TW' : 'en';
  }

  function tr(key) {
    var table = STRINGS[resolveLang()] || STRINGS['zh-TW'];
    var text = key in table ? table[key] : STRINGS['zh-TW'][key];
    var args = Array.prototype.slice.call(arguments, 1);
    return text.replace(/\{(\d+)\}/g, function (_, i) { return args[i]; });
  }

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  function logError(...args) {
    console.error(LOG_PREFIX, ...args);
  }

  function isPlaylistPage() {
    return window.location.pathname === '/playlist' &&
      new URLSearchParams(window.location.search).has('list');
  }

  function getPlaylistId() {
    return new URLSearchParams(window.location.search).get('list');
  }

  function isOwnPlaylist() {
    const dragHandles = document.querySelectorAll('#reorder');
    if (dragHandles.length > 0) return true;
    const sortBtn = document.querySelector('yt-sort-filter-sub-menu-renderer');
    if (sortBtn) {
      const sortText = sortBtn.textContent || '';
      if (sortText.includes('手動') || sortText.includes('Manual')) return true;
    }
    return false;
  }

  function getYtConfig() {
    try {
      const apiKey = window.ytcfg?.get('INNERTUBE_API_KEY');
      const context = window.ytcfg?.get('INNERTUBE_CONTEXT');
      log('Config:', apiKey ? 'API key found' : 'NO API key', context ? 'context found' : 'NO context');
      return { apiKey, context };
    } catch (e) {
      logError('Failed to get ytcfg:', e);
      return null;
    }
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function generateAuthHeader() {
    const sapisid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
    if (!sapisid) {
      log('No SAPISID cookie found');
      return null;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const origin = 'https://www.youtube.com';
    const input = timestamp + ' ' + sapisid + ' ' + origin;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return 'SAPISIDHASH ' + timestamp + '_' + hashHex;
  }

  async function buildHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const auth = await generateAuthHeader();
    if (auth) {
      headers['Authorization'] = auth;
    }
    const visitorData = window.ytcfg?.get('VISITOR_DATA');
    if (visitorData) {
      headers['X-Goog-Visitor-Id'] = visitorData;
    }
    const sessionIdx = window.ytcfg?.get('SESSION_INDEX');
    if (sessionIdx !== undefined) {
      headers['X-Goog-AuthUser'] = String(sessionIdx);
    }
    return headers;
  }

  function getAllLoadedItems() {
    return Array.from(document.querySelectorAll(SELECTOR_ITEM));
  }

  function getItemData(el) {
    const data = el?.data || el?.__data?.data || el?.polymerController?.data;
    if (!data) return null;
    return {
      videoId: data.videoId,
      setVideoId: data.setVideoId,
      title: data.title?.runs?.[0]?.text || '',
    };
  }

  function extractItemFromRenderer(renderer) {
    if (renderer.playlistVideoRenderer) {
      var pvr = renderer.playlistVideoRenderer;
      return {
        videoId: pvr.videoId,
        setVideoId: pvr.setVideoId,
        title: pvr.title?.runs?.[0]?.text || pvr.title?.simpleText || '',
        channel: pvr.shortBylineText?.runs?.[0]?.text || '',
      };
    }
    if (renderer.lockupViewModel) {
      var lvm = renderer.lockupViewModel;
      var meta = lvm.metadata?.lockupMetadataViewModel;
      var title = meta?.title?.content || '';
      var setVid = lvm.rendererContext?.commandContext?.onTap?.innertubeCommand
        ?.watchEndpoint?.playlistSetVideoId || '';
      var channel = meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]
        ?.metadataParts?.[0]?.text?.content || '';
      return { videoId: lvm.contentId, setVideoId: setVid, title: title, channel: channel };
    }
    return null;
  }

  // 在 continuationItemRenderer / continuationItemViewModel 子樹中深度搜尋 token。
  // YouTube 會變動包裝層（例如 commandExecutorCommand.commands[]），不可寫死路徑。
  function findContinuationToken(node) {
    if (!node || typeof node !== 'object') return null;
    if (node.continuationCommand?.token) return node.continuationCommand.token;
    var keys = Array.isArray(node) ? node : Object.values(node);
    for (var child of keys) {
      var token = findContinuationToken(child);
      if (token) return token;
    }
    return null;
  }

  function extractContinuation(item) {
    var wrapper = item.continuationItemRenderer || item.continuationItemViewModel;
    return wrapper ? findContinuationToken(wrapper) : null;
  }

  // 走訪整個回應樹，收集所有歌曲與續載 token，不依賴固定的巢狀路徑。
  // 只採用「與歌曲位於同一陣列」的 continuation：回應中還有其他區塊
  // （例如 sectionListRenderer 層級）的 continuation，誤用會導致只抓到第一頁。
  function collectPlaylistData(node, result) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      var hasPlaylistItem = false;
      var arrayCont = null;
      for (var child of node) {
        if (!child || typeof child !== 'object') continue;
        var extracted = extractItemFromRenderer(child);
        if (extracted) {
          if (extracted.setVideoId) {
            hasPlaylistItem = true;
            // 保留原始資料：多選移動時，尚未載入的影片要插進 YouTube 內部清單資料需要它
            if (child.playlistVideoRenderer) extracted.raw = child;
            if (!result.seen.has(extracted.setVideoId)) {
              result.seen.add(extracted.setVideoId);
              result.items.push(extracted);
            }
          }
          continue;
        }
        var cont = extractContinuation(child);
        if (cont) {
          arrayCont = cont;
          continue;
        }
        collectPlaylistData(child, result);
      }
      if (hasPlaylistItem && arrayCont) result.continuation = arrayCont;
      return;
    }
    for (var key in node) collectPlaylistData(node[key], result);
  }

  async function browseRequest(body) {
    var headers = await buildHeaders();
    var resp = await fetch(
      'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false',
      {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(body),
      }
    );
    if (!resp.ok) {
      throw new Error('Browse API error: ' + resp.status);
    }
    return resp.json();
  }

  var MAX_CONTINUATION_PAGES = 200;

  // 寫入後約 1～2 秒內，browse API 可能還回傳寫入前的舊順序。
  // 記下最近一次移動的結果與移動前（含多選移動途中）的各個狀態；
  // 讀到的順序正好是這些舊狀態之一時，改用移動後的順序。其他不同的順序（例如原生拖拉）照常採用
  var RECENT_ORDER_TTL = 60000;
  var recentOrder = null;

  function rememberOrder(playlistId, staleOrders, newOrder) {
    recentOrder = {
      playlistId: playlistId,
      stale: new Set(staleOrders.map(function (o) { return o.join(); })),
      order: newOrder.slice(),
      at: Date.now(),
    };
  }

  function applyRecentOrder(playlistId, items) {
    if (!recentOrder || recentOrder.playlistId !== playlistId) return items;
    if (Date.now() - recentOrder.at > RECENT_ORDER_TTL) return items;
    var fetched = items.map(function (it) { return it.setVideoId; }).join();
    if (!recentOrder.stale.has(fetched)) return items;
    var byId = new Map(items.map(function (it) { return [it.setVideoId, it]; }));
    log('Stale playlist order detected, using the order after the last move');
    return recentOrder.order.map(function (id) { return byId.get(id); });
  }

  async function fetchFullPlaylist(playlistId, config) {
    var result = { items: [], seen: new Set(), continuation: null };
    var usedTokens = new Set();

    log('Fetching full playlist:', playlistId);

    var data = await browseRequest({
      context: config.context,
      browseId: 'VL' + playlistId,
    });
    collectPlaylistData(data?.contents, result);

    log('First page loaded:', result.items.length, 'items, has continuation:', !!result.continuation);

    var pages = 0;
    while (result.continuation && !usedTokens.has(result.continuation) && pages < MAX_CONTINUATION_PAGES) {
      var token = result.continuation;
      usedTokens.add(token);
      result.continuation = null;
      pages++;

      data = await browseRequest({
        context: config.context,
        continuation: token,
      });
      collectPlaylistData(data?.onResponseReceivedActions, result);
      collectPlaylistData(data?.onResponseReceivedCommands, result);
      collectPlaylistData(data?.onResponseReceivedEndpoints, result);

      log('Continuation page', pages, 'loaded, total items:', result.items.length);
    }

    log('Full playlist loaded:', result.items.length, 'items');
    return applyRecentOrder(playlistId, result.items);
  }

  async function moveVideo(playlistId, setVideoId, predecessorSetVideoId, config) {
    var moveAction = {
      setVideoId: setVideoId,
      action: 'ACTION_MOVE_VIDEO_AFTER',
    };
    if (predecessorSetVideoId) {
      moveAction.movedSetVideoIdPredecessor = predecessorSetVideoId;
    }

    var body = {
      context: config.context,
      playlistId: playlistId,
      actions: [moveAction],
      params: 'CAFAAQ%3D%3D',
    };

    log('Moving video, setVideoId:', setVideoId, 'after:', predecessorSetVideoId || '(top)');

    var headers = await buildHeaders();
    var resp = await fetch(
      'https://www.youtube.com/youtubei/v1/browse/edit_playlist?prettyPrint=false',
      {
        method: 'POST',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(body),
      }
    );

    var responseData = await resp.json();
    log('Move response status:', resp.status, 'data:', JSON.stringify(responseData).substring(0, 200));

    if (!resp.ok) {
      throw new Error('API error: ' + resp.status);
    }
    if (responseData.error) {
      throw new Error(responseData.error.message || 'Unknown API error');
    }
    return responseData;
  }

  function showToast(message, duration) {
    duration = duration || 3000;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ytps-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, duration);
  }

  function createMoveButton(itemEl) {
    if (itemEl.querySelector('.ytps-move-btn')) return;

    const menuContainer = itemEl.querySelector(SELECTOR_MENU);
    if (!menuContainer) return;

    const btn = document.createElement('button');
    btn.className = 'ytps-move-btn';
    btn.title = tr('moveBtnTitle');
    btn.textContent = '↕';
    btn.setAttribute('aria-label', tr('moveBtnAria'));

    const panel = document.createElement('div');
    panel.className = 'ytps-panel';

    var panelHeader = document.createElement('div');
    panelHeader.className = 'ytps-panel-header';
    var currentPos = document.createElement('span');
    currentPos.className = 'ytps-current-pos';
    panelHeader.appendChild(currentPos);

    var inputRow = document.createElement('div');
    inputRow.className = 'ytps-panel-row';
    var labelBefore = document.createElement('span');
    labelBefore.style.cssText = 'font-size:13px;color:var(--yt-spec-text-primary,#fff)';
    labelBefore.textContent = tr('moveToBefore');
    var input = document.createElement('input');
    input.type = 'number';
    input.className = 'ytps-input';
    input.min = '1';
    input.placeholder = '#';
    var labelAfter = document.createElement('span');
    labelAfter.style.cssText = 'font-size:13px;color:var(--yt-spec-text-primary,#fff)';
    labelAfter.textContent = tr('moveToAfter');
    labelAfter.hidden = !labelAfter.textContent;
    inputRow.appendChild(labelBefore);
    inputRow.appendChild(input);
    inputRow.appendChild(labelAfter);

    var actionRow = document.createElement('div');
    actionRow.className = 'ytps-panel-row';
    actionRow.style.justifyContent = 'space-between';
    var topBtn = document.createElement('button');
    topBtn.className = 'ytps-btn ytps-btn-secondary ytps-btn-top';
    topBtn.textContent = tr('moveToTop');
    var btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:6px';
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'ytps-btn ytps-btn-secondary ytps-cancel-btn';
    cancelBtn.textContent = tr('cancel');
    var confirmBtn = document.createElement('button');
    confirmBtn.className = 'ytps-btn ytps-btn-primary ytps-confirm-btn';
    confirmBtn.textContent = tr('confirm');
    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(confirmBtn);
    actionRow.appendChild(topBtn);
    actionRow.appendChild(btnGroup);

    var pickBtn = document.createElement('button');
    pickBtn.className = 'ytps-btn ytps-btn-secondary ytps-pick-btn';
    pickBtn.textContent = tr('pickFromList');

    panel.appendChild(panelHeader);
    panel.appendChild(inputRow);
    panel.appendChild(pickBtn);
    panel.appendChild(actionRow);

    var progress = document.createElement('div');
    progress.className = 'ytps-progress';
    PROGRESS_STEPS.forEach(function (label) {
      var step = document.createElement('div');
      step.className = 'ytps-progress-step';
      var icon = document.createElement('span');
      icon.className = 'ytps-progress-icon';
      var text = document.createElement('span');
      text.textContent = tr(label);
      step.appendChild(icon);
      step.appendChild(text);
      progress.appendChild(step);
    });
    panel.appendChild(progress);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';

    // 多選勾選框：Polymer 會重用節點，勾選狀態一律以點擊當下的 setVideoId 為準，再由 syncSelectionUi() 同步
    var selectBox = document.createElement('input');
    selectBox.type = 'checkbox';
    selectBox.className = 'ytps-select-cb';
    selectBox.setAttribute('aria-label', tr('selectAria'));
    selectBox.addEventListener('click', function (e) {
      e.stopPropagation();
      var data = getItemData(itemEl);
      if (!data?.setVideoId) {
        selectBox.checked = false;
        return;
      }
      setSelected(data.setVideoId, selectBox.checked);
    });
    wrapper.appendChild(selectBox);
    wrapper.appendChild(btn);
    wrapper.appendChild(panel);

    menuContainer.insertBefore(wrapper, menuContainer.firstChild);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAllPanels();
      var items = getAllLoadedItems();
      var idx = items.indexOf(itemEl);
      currentPos.textContent = tr('currentPos', idx + 1, items.length);
      setProgress(panel, null);
      input.value = '';
      input.style.borderColor = '';
      panel.classList.add('open');
      btn.classList.add('active');
      itemEl.classList.add('ytps-highlight');
      setTimeout(function () { input.focus(); }, 50);
    });

    cancelBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closePanel(btn, panel, itemEl);
    });

    topBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      handleMove(itemEl, btn, panel, confirmBtn, 1);
    });

    pickBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openPositionPicker(getItemData(itemEl)?.setVideoId, function (pos) {
        input.value = pos;
        input.style.borderColor = '';
        input.focus();
      });
    });

    confirmBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var target = parseInt(input.value, 10);
      if (!target || target < 1) {
        input.style.borderColor = '#f44';
        return;
      }
      handleMove(itemEl, btn, panel, confirmBtn, target);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        closePanel(btn, panel, itemEl);
      }
    });
  }

  var pickerEl = null;

  function closePositionPicker() {
    if (pickerEl) {
      pickerEl.remove();
      pickerEl = null;
    }
  }

  // 彈出完整播放清單（透過 API 取得，不受頁面懶載入限制）。
  // 單選模式：點選任一列即回傳該位置編號。
  // 多選模式（multi = true）：每列有勾選框，點任一列設為目標位置，按底部「移動」執行
  async function openPositionPicker(currentSetVideoId, onPick, multi) {
    closePositionPicker();
    var config = getYtConfig();
    var playlistId = getPlaylistId();
    if (!config?.context || !playlistId) {
      showToast(tr('noApi'));
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'ytps-picker-overlay';
    var box = document.createElement('div');
    box.className = 'ytps-picker';

    var header = document.createElement('div');
    header.className = 'ytps-picker-header';
    var titleEl = document.createElement('span');
    titleEl.className = 'ytps-picker-title';
    titleEl.textContent = multi ? tr('multiSelectTitle') : tr('pickerTitle');
    var closeBtn = document.createElement('button');
    closeBtn.className = 'ytps-picker-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', tr('close'));
    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'ytps-input ytps-picker-search';
    search.placeholder = tr('pickerSearch');

    var listEl = document.createElement('div');
    listEl.className = 'ytps-picker-list';
    var status = document.createElement('div');
    status.className = 'ytps-picker-status';
    status.textContent = tr('pickerLoading');
    listEl.appendChild(status);

    box.appendChild(header);
    if (multi) {
      var hint = document.createElement('div');
      hint.className = 'ytps-picker-hint';
      hint.textContent = tr('pickerMultiHint');
      box.appendChild(hint);
    }
    box.appendChild(search);
    box.appendChild(listEl);

    var footer = null;
    if (multi) {
      footer = createMultiControls(true);
      box.appendChild(footer.el);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    pickerEl = overlay;
    pickerEl._ytpsFooter = footer;

    overlay.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target === overlay) closePositionPicker();
    });
    closeBtn.addEventListener('click', closePositionPicker);
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePositionPicker();
      }
    });
    setTimeout(function () { search.focus(); }, 50);

    var fullList;
    try {
      fullList = await fetchFullPlaylist(playlistId, config);
    } catch (err) {
      logError('Picker fetch failed:', err);
      if (pickerEl === overlay) status.textContent = tr('pickerFailed', err.message);
      return;
    }
    if (pickerEl !== overlay) return;
    if (fullList.length === 0) {
      status.textContent = tr('playlistEmpty');
      return;
    }

    titleEl.textContent = multi ? tr('pickerMultiTitle', fullList.length) : tr('pickerTitleCount', fullList.length);
    var frag = document.createDocumentFragment();
    var rows = [];
    var currentRow = null;
    var targetRow = null;
    var targetTag = document.createElement('span');
    targetTag.className = 'ytps-picker-tag';
    targetTag.textContent = tr('targetTag');

    function markTarget(row) {
      if (targetRow) targetRow.classList.remove('ytps-picker-target');
      targetTag.remove();
      targetRow = row;
      if (row) {
        row.classList.add('ytps-picker-target');
        row.appendChild(targetTag);
      }
    }

    fullList.forEach(function (item, i) {
      var row = document.createElement('div');
      row.className = 'ytps-picker-row';
      if (multi) {
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'ytps-select-cb';
        cb.setAttribute('aria-label', tr('selectAria'));
        cb.checked = selection.has(item.setVideoId);
        row.classList.toggle('ytps-picker-selected', cb.checked);
        cb.addEventListener('click', function (e) {
          e.stopPropagation();
          setSelected(item.setVideoId, cb.checked);
          row.classList.toggle('ytps-picker-selected', cb.checked);
        });
        row.appendChild(cb);
      }
      var num = document.createElement('span');
      num.className = 'ytps-picker-num';
      num.textContent = i + 1;
      var thumb = document.createElement('img');
      thumb.className = 'ytps-picker-thumb';
      thumb.loading = 'lazy';
      thumb.alt = '';
      if (item.videoId) thumb.src = 'https://i.ytimg.com/vi/' + item.videoId + '/default.jpg';
      var text = document.createElement('div');
      text.className = 'ytps-picker-text';
      var t = document.createElement('div');
      t.className = 'ytps-picker-song';
      t.textContent = item.title || tr('untitled');
      var c = document.createElement('div');
      c.className = 'ytps-picker-channel';
      c.textContent = item.channel || '';
      text.appendChild(t);
      text.appendChild(c);
      row.appendChild(num);
      row.appendChild(thumb);
      row.appendChild(text);
      if (!multi && item.setVideoId === currentSetVideoId) {
        row.classList.add('ytps-picker-current');
        var tag = document.createElement('span');
        tag.className = 'ytps-picker-tag';
        tag.textContent = tr('currentTag');
        row.appendChild(tag);
        currentRow = row;
      }
      row.addEventListener('click', function () {
        if (multi) {
          footer.input.value = i + 1;
          // 觸發 input 事件，讓上方操作列的位置欄同步
          footer.input.dispatchEvent(new Event('input'));
          markTarget(row);
          return;
        }
        closePositionPicker();
        onPick(i + 1);
      });
      rows.push({ el: row, key: ((i + 1) + ' ' + item.title + ' ' + item.channel).toLowerCase() });
      frag.appendChild(row);
    });
    listEl.textContent = '';
    listEl.appendChild(frag);
    if (currentRow) currentRow.scrollIntoView({ block: 'center' });

    if (multi) {
      var preset = parseInt(footer.input.value, 10);
      if (preset >= 1 && preset <= rows.length) markTarget(rows[preset - 1].el);
      footer.input.addEventListener('input', function () {
        var n = parseInt(footer.input.value, 10);
        markTarget(n >= 1 && n <= rows.length ? rows[n - 1].el : null);
      });
    }

    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      rows.forEach(function (r) {
        var show = !q || r.key.includes(q);
        r.el.style.display = show ? '' : 'none';
      });
    });
  }

  var PROGRESS_STEPS = ['stepFetch', 'stepWrite'];

  // 面板內的步驟進度：step 為進行中的步驟索引，-1 表示目前步驟失敗，null 表示隱藏
  function setProgress(panel, step) {
    var progress = panel.querySelector('.ytps-progress');
    if (!progress) return;
    if (step === null) {
      progress.classList.remove('show');
      panel._ytpsStep = null;
      return;
    }
    var failed = step === -1;
    var active = failed ? (panel._ytpsStep ?? 0) : step;
    panel._ytpsStep = active;
    progress.classList.add('show');
    Array.from(progress.children).forEach(function (el, i) {
      var state = i < active ? 'done' : i === active ? (failed ? 'failed' : 'active') : 'pending';
      el.className = 'ytps-progress-step ytps-step-' + state;
      el.firstChild.textContent = state === 'done' ? '✓' : state === 'failed' ? '✕' : String(i + 1);
    });
  }

  function closePanel(btn, panel, itemEl) {
    panel.classList.remove('open');
    btn.classList.remove('active');
    itemEl.classList.remove('ytps-highlight');
  }

  function closeAllPanels() {
    closePositionPicker();
    document.querySelectorAll('.ytps-panel.open').forEach(function (p) {
      p.classList.remove('open');
    });
    document.querySelectorAll('.ytps-move-btn.active').forEach(function (b) {
      b.classList.remove('active');
    });
    document.querySelectorAll('.ytps-highlight').forEach(function (el) {
      el.classList.remove('ytps-highlight');
    });
  }

  function removeIndexBadges() {
    document.querySelectorAll('.ytps-index-badge').forEach(function (b) { b.remove(); });
  }

  // 移除擴充功能加到頁面上的所有 UI（關閉擴充功能或切換語言時使用）
  function removeAllUi() {
    closeAllPanels();
    document.querySelectorAll('.ytps-move-btn').forEach(function (b) {
      if (b.parentElement) b.parentElement.remove();
    });
    removeIndexBadges();
    removeMultiBar();
    selection.clear();
    document.querySelectorAll('.ytps-selected').forEach(function (el) { el.classList.remove('ytps-selected'); });
    if (toastEl) toastEl.classList.remove('show');
  }

  function updateIndexBadges() {
    if (!settings.showBadges) return;
    var items = getAllLoadedItems();
    items.forEach(function (item, i) {
      var badge = item.querySelector('.ytps-index-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'ytps-index-badge';
        item.style.position = 'relative';
        item.insertBefore(badge, item.firstChild);
      }
      // 只在數字改變時寫入，否則會觸發 MutationObserver 形成每 500ms 的無限循環
      if (badge.textContent !== String(i + 1)) badge.textContent = i + 1;
    });
  }

  // 透過 Polymer 的 splice 移動 YouTube 內部的清單資料，讓畫面跟著重繪。
  // 若直接搬 DOM 節點，內部資料仍是舊順序，下一次原生拖拉會依舊資料重繪，歌曲被彈回原位
  function moveInModel(itemEl, setVideoId, targetPos) {
    var listEl = itemEl.closest('ytd-playlist-video-list-renderer');
    var ctrl = listEl && (listEl.polymerController || listEl);
    var contents = listEl && listEl.data && listEl.data.contents;
    if (!ctrl || typeof ctrl.splice !== 'function' || !Array.isArray(contents)) return false;

    var fromIdx = contents.findIndex(function (c) {
      return c.playlistVideoRenderer && c.playlistVideoRenderer.setVideoId === setVideoId;
    });
    if (fromIdx === -1) return false;
    var loadedCount = contents.filter(function (c) { return c.playlistVideoRenderer; }).length;
    var hasMore = contents.some(function (c) { return c.continuationItemRenderer; });

    var entry = ctrl.splice('data.contents', fromIdx, 1)[0];
    var targetIdx = Math.max(targetPos - 1, 0);
    // 目標在尚未載入的範圍：只從已載入的資料移除，之後捲動載入時會出現在正確位置
    if (!hasMore || targetIdx < loadedCount - 1) {
      ctrl.splice('data.contents', Math.min(targetIdx, loadedCount - 1), 0, entry);
      return 'inserted';
    }
    return 'removed';
  }

  function findItemBySetVideoId(setVideoId) {
    return getAllLoadedItems().find(function (el) {
      return getItemData(el)?.setVideoId === setVideoId;
    });
  }

  var ANIM_DURATION = 350;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isInViewport(rect) {
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }

  // 記錄畫面附近每首歌的位置（以 setVideoId 為鍵）。
  // Polymer 會重用節點，移動前後同一首歌可能在不同的元素上，所以不能以元素為鍵
  function snapshotPositions() {
    var map = new Map();
    getAllLoadedItems().forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.bottom < -window.innerHeight || rect.top > window.innerHeight * 2) return;
      var id = getItemData(el)?.setVideoId;
      if (id) map.set(id, rect.top);
    });
    return map;
  }

  // 落點標示：短暫閃爍外框
  function flashLanded(el) {
    el.classList.remove('ytps-landed');
    void el.offsetWidth;
    el.classList.add('ytps-landed');
    setTimeout(function () { el.classList.remove('ytps-landed'); }, 1600);
  }

  // FLIP 動畫：元素已在新位置，先用 transform 推回舊位置，再過渡到 0。
  // 只動畫畫面內的元素；transform 不會觸發 MutationObserver 的 childList
  function playFlip(before, movedId) {
    var animated = [];
    getAllLoadedItems().forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (!isInViewport(rect)) return;
      var id = getItemData(el)?.setVideoId;
      var oldTop = id && before.get(id);
      if (oldTop === undefined) return;
      var delta = oldTop - rect.top;
      if (Math.abs(delta) < 1) return;
      el.style.transition = 'none';
      el.style.transform = 'translateY(' + delta + 'px)';
      if (movedId instanceof Set ? movedId.has(id) : id === movedId) el.classList.add('ytps-moving');
      animated.push(el);
    });
    if (animated.length === 0) return;
    void document.body.offsetHeight;
    animated.forEach(function (el) {
      el.style.transition = 'transform ' + ANIM_DURATION + 'ms ease-in-out';
      el.style.transform = '';
    });
    setTimeout(function () {
      animated.forEach(function (el) {
        el.style.transition = '';
        el.classList.remove('ytps-moving');
      });
    }, ANIM_DURATION + 50);
  }

  // 等 Polymer 依新資料重繪完成（目標歌曲出現在預期位置）後再執行 callback。
  // 目前 splice 會同步重繪，通常第一次檢查就成立；用 setTimeout 而非 requestAnimationFrame，
  // 因為分頁不在前景時 rAF 會暫停
  function waitForRender(setVideoId, targetPos, callback) {
    var tries = 0;
    function check() {
      var items = getAllLoadedItems();
      var idx = items.findIndex(function (el) { return getItemData(el)?.setVideoId === setVideoId; });
      if ((idx !== -1 && (idx === targetPos - 1 || idx === items.length - 1)) || tries++ > 30) {
        callback(idx === -1 ? null : items[idx]);
        return;
      }
      setTimeout(check, 16);
    }
    check();
  }

  function moveDomElement(itemEl, targetPos) {
    var setVideoId = getItemData(itemEl)?.setVideoId;
    var oldRect = itemEl.getBoundingClientRect();
    var before = snapshotPositions();
    var modelResult = setVideoId && moveInModel(itemEl, setVideoId, targetPos);
    if (modelResult === 'removed') {
      updateIndexBadges();
      showToast(tr('movedNotLoaded', targetPos), 3000);
      return;
    }
    if (modelResult === 'inserted') {
      // Polymer 會重用節點並重新綁定資料，移動後的歌曲不一定還在原本的 itemEl
      waitForRender(setVideoId, targetPos, function (movedEl) {
        updateIndexBadges();
        if (!movedEl) return;
        var newRect = movedEl.getBoundingClientRect();
        // 起點與終點都在畫面內：播放滑動動畫；距離太遠：平滑捲動到新位置
        var nearby = isInViewport(oldRect) && isInViewport(newRect);
        if (nearby && !prefersReducedMotion()) {
          playFlip(before, setVideoId);
          setTimeout(function () { flashLanded(movedEl); }, ANIM_DURATION);
        } else {
          if (!nearby) {
            movedEl.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
          }
          flashLanded(movedEl);
        }
      });
      return;
    }

    var items = getAllLoadedItems();
    var container = itemEl.parentElement;
    if (!container) return;

    var targetIdx = targetPos - 1;
    if (targetIdx < 0) targetIdx = 0;

    if (targetIdx >= items.length) {
      container.appendChild(itemEl);
    } else {
      var refEl = items[targetIdx];
      if (refEl === itemEl) return;
      var currentIdx = items.indexOf(itemEl);
      if (currentIdx < targetIdx) {
        refEl.after(itemEl);
      } else {
        container.insertBefore(itemEl, refEl);
      }
    }

    itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateIndexBadges();
  }

  async function handleMove(itemEl, btn, panel, confirmBtn, targetPos) {
    var config = getYtConfig();
    if (!config?.apiKey || !config?.context) {
      showToast(tr('noApi'));
      logError('Missing config:', config);
      return;
    }

    var playlistId = getPlaylistId();
    if (!playlistId) {
      showToast(tr('noPlaylistId'));
      return;
    }

    var itemData = getItemData(itemEl);
    if (!itemData?.setVideoId) {
      showToast(tr('noItemData'));
      logError('Missing item data:', itemData);
      return;
    }

    if (isMoving()) {
      showToast(tr('busy'));
      return;
    }
    singleBusy = true;

    log('handleMove:', itemData.title, '-> position', targetPos);

    panel.classList.add('ytps-loading');
    var origText = confirmBtn.textContent;
    var spinner = document.createElement('span');
    spinner.className = 'ytps-spinner';
    confirmBtn.textContent = '';
    confirmBtn.appendChild(spinner);

    var progressDone = false;
    try {
      setProgress(panel, 0);
      var fullList = await fetchFullPlaylist(playlistId, config);

      if (fullList.length === 0) {
        showToast(tr('playlistEmpty'));
        logError('Empty playlist returned');
        return;
      }

      if (targetPos > fullList.length) {
        targetPos = fullList.length;
      }

      var currentIdx = fullList.findIndex(function (item) {
        return item.setVideoId === itemData.setVideoId;
      });

      if (currentIdx === -1) {
        var loadedCount = getAllLoadedItems().length;
        logError('Song not found in full list, setVideoId:', itemData.setVideoId,
          'fetched:', fullList.length, 'loaded in DOM:', loadedCount);
        if (fullList.length < loadedCount) {
          // 取回的清單比畫面上已載入的還少，代表續載解析失敗（YouTube 可能改了回應格式）
          showToast(tr('incomplete', fullList.length, loadedCount));
        } else {
          showToast(tr('notFound'));
        }
        return;
      }

      log('Current index:', currentIdx, 'Target position:', targetPos);

      if (currentIdx + 1 === targetPos) {
        showToast(tr('alreadyThere'));
        closePanel(btn, panel, itemEl);
        return;
      }

      var listWithout = fullList.filter(function (_, i) { return i !== currentIdx; });
      var predecessorSetVideoId = null;
      if (targetPos > 1) {
        predecessorSetVideoId = listWithout[targetPos - 2].setVideoId;
      }

      log('Predecessor setVideoId:', predecessorSetVideoId || '(move to top)');

      setProgress(panel, 1);
      await moveVideo(playlistId, itemData.setVideoId, predecessorSetVideoId, config);
      var orderBefore = fullList.map(function (it) { return it.setVideoId; });
      var orderAfter = listWithout.map(function (it) { return it.setVideoId; });
      orderAfter.splice(targetPos - 1, 0, itemData.setVideoId);
      rememberOrder(playlistId, [orderBefore], orderAfter);

      progressDone = true;
      showToast(tr('moved', targetPos), 2000);
      closePanel(btn, panel, itemEl);

      moveDomElement(itemEl, targetPos);
    } catch (err) {
      logError('Move failed:', err);
      showToast(tr('moveFailed', err.message));
      setProgress(panel, -1);
      progressDone = true;
    } finally {
      singleBusy = false;
      if (!progressDone) setProgress(panel, null);
      panel.classList.remove('ytps-loading');
      confirmBtn.textContent = origText;
    }
  }

  // ---- 多選移動 ----
  // 勾選狀態以 setVideoId 記錄，頁面上的勾選框與完整清單視窗共用同一份
  var selection = new Set();
  var selectionPlaylistId = null;
  var multiBar = null;
  var multiBusy = false;
  var singleBusy = false;

  function isMoving() {
    return multiBusy || singleBusy;
  }

  function setSelected(setVideoId, on) {
    if (on) selection.add(setVideoId);
    else selection.delete(setVideoId);
    syncSelectionUi();
  }

  function clearSelection() {
    selection.clear();
    if (pickerEl) {
      pickerEl.querySelectorAll('.ytps-picker-row .ytps-select-cb').forEach(function (cb) {
        cb.checked = false;
        cb.closest('.ytps-picker-row').classList.remove('ytps-picker-selected');
      });
    }
    syncSelectionUi();
  }

  // 依勾選狀態更新頁面勾選框、列的底色與操作列；只在值有變時寫入，避免觸發 MutationObserver
  function syncSelectionUi() {
    document.querySelectorAll(SELECTOR_ITEM).forEach(function (itemEl) {
      var cb = itemEl.querySelector('.ytps-select-cb');
      if (!cb) return;
      var on = selection.has(getItemData(itemEl)?.setVideoId);
      if (cb.checked !== on) cb.checked = on;
      if (itemEl.classList.contains('ytps-selected') !== on) itemEl.classList.toggle('ytps-selected', on);
    });
    var controls = [multiBar && multiBar._ytps, pickerEl && pickerEl._ytpsFooter];
    controls.forEach(function (c) {
      if (!c) return;
      var text = tr('selectedCount', selection.size);
      if (c.countEl.textContent !== text) c.countEl.textContent = text;
    });
    if (multiBar) {
      var expanded = selection.size > 0 || multiBusy;
      if (multiBar.classList.contains('ytps-multibar-expanded') !== expanded) {
        multiBar.classList.toggle('ytps-multibar-expanded', expanded);
      }
    }
  }

  // 「已選 N 個｜放到第 [ ] 個｜…｜清除｜移動」：底部操作列與完整清單視窗底部共用
  function createMultiControls(inPicker) {
    var el = document.createElement('div');
    el.className = inPicker ? 'ytps-picker-footer' : 'ytps-multibar-controls';

    var countEl = document.createElement('span');
    countEl.className = 'ytps-multi-count';
    countEl.textContent = tr('selectedCount', selection.size);

    var label = document.createElement('span');
    label.className = 'ytps-multi-label';
    label.textContent = tr('moveToBefore');
    var input = document.createElement('input');
    input.type = 'number';
    input.className = 'ytps-input';
    input.min = '1';
    input.placeholder = '#';
    var labelAfter = document.createElement('span');
    labelAfter.className = 'ytps-multi-label';
    labelAfter.textContent = tr('moveToAfter');
    labelAfter.hidden = !labelAfter.textContent;

    var status = document.createElement('span');
    status.className = 'ytps-multi-status';

    var clearBtn = document.createElement('button');
    clearBtn.className = 'ytps-btn ytps-btn-secondary';
    clearBtn.textContent = tr('clearSelection');
    var moveBtn = document.createElement('button');
    moveBtn.className = 'ytps-btn ytps-btn-primary ytps-multi-move';
    moveBtn.textContent = tr('confirm');

    el.appendChild(countEl);
    el.appendChild(label);
    el.appendChild(input);
    el.appendChild(labelAfter);
    var pickBtn = null;
    var topBtn = null;
    if (!inPicker) {
      pickBtn = document.createElement('button');
      pickBtn.className = 'ytps-btn ytps-btn-secondary';
      pickBtn.textContent = '📋';
      pickBtn.title = tr('pickFromList');
      pickBtn.setAttribute('aria-label', tr('pickFromList'));
      topBtn = document.createElement('button');
      topBtn.className = 'ytps-btn ytps-btn-secondary';
      topBtn.textContent = tr('moveToTop');
      el.appendChild(pickBtn);
      el.appendChild(topBtn);
    }
    el.appendChild(status);
    el.appendChild(clearBtn);
    el.appendChild(moveBtn);

    var controls = { el: el, countEl: countEl, input: input, status: status, moveBtn: moveBtn };

    // 兩組輸入框同步目標位置；操作列可能在視窗開著時重建，每次都重新取得
    function barInput() {
      return multiBar && multiBar._ytps && multiBar._ytps.input;
    }
    if (inPicker && barInput()) input.value = barInput().value;
    input.addEventListener('input', function () {
      input.style.borderColor = '';
      if (inPicker && barInput()) barInput().value = input.value;
    });

    function submit(target) {
      if (selection.size === 0) {
        showToast(tr('noSelection'));
        return;
      }
      if (!target || target < 1) {
        input.style.borderColor = '#f44';
        return;
      }
      if (isMoving()) {
        showToast(tr('busy'));
        return;
      }
      if (inPicker) closePositionPicker();
      handleMultiMove(target);
    }

    clearBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      clearSelection();
    });
    moveBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      submit(parseInt(input.value, 10));
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit(parseInt(input.value, 10));
      }
    });
    if (pickBtn) {
      pickBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openPositionPicker(null, null, true);
      });
    }
    if (topBtn) {
      topBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        submit(1);
      });
    }
    return controls;
  }

  // 底部浮動操作列：未勾選時只顯示「☑ 多選」，有勾選時展開
  function ensureMultiBar() {
    if (multiBar && multiBar.isConnected) return;
    multiBar = document.createElement('div');
    multiBar.className = 'ytps-multibar';
    var openBtn = document.createElement('button');
    openBtn.className = 'ytps-btn ytps-btn-secondary ytps-multibar-open';
    openBtn.textContent = tr('multiSelect');
    openBtn.title = tr('multiSelectTitle');
    openBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openPositionPicker(null, null, true);
    });
    multiBar.appendChild(openBtn);
    multiBar._ytps = createMultiControls(false);
    multiBar.appendChild(multiBar._ytps.el);
    applyMultiBarPos();
    document.body.appendChild(multiBar);
  }

  function applyMultiBarPos() {
    if (!multiBar) return;
    var bottom = settings.multiBarPos === 'bottom';
    if (multiBar.classList.contains('ytps-multibar-bottom') !== bottom) {
      multiBar.classList.toggle('ytps-multibar-bottom', bottom);
    }
  }

  function removeMultiBar() {
    if (multiBar) multiBar.remove();
    multiBar = null;
  }

  function setMultiStatus(text) {
    if (!multiBar) return;
    multiBar._ytps.status.textContent = text || '';
  }

  // 依序套用移動（setVideoId 移到 predecessor 之後，null 表示移到最前面），回傳新順序
  function applyMoves(order, moves) {
    var result = order.slice();
    moves.forEach(function (m) {
      result.splice(result.indexOf(m.id), 1);
      var at = m.after ? result.indexOf(m.after) + 1 : 0;
      result.splice(at, 0, m.id);
    });
    return result;
  }

  // 規劃多選移動。targetPos 是目前清單（含已勾選影片）的編號，意思是「放到目前第 targetPos 個的位置」：
  // 已勾選的影片接在第 targetPos 個之前最後一部未勾選影片的後面，並維持原本的先後順序
  function planMultiMove(order, selected, targetPos) {
    var picked = order.filter(function (id) { return selected.has(id); });
    var prev = null;
    for (var i = Math.min(targetPos, order.length + 1) - 2; i >= 0; i--) {
      if (!selected.has(order[i])) {
        prev = order[i];
        break;
      }
    }
    var moves = picked.map(function (id) {
      var m = { id: id, after: prev };
      prev = id;
      return m;
    });
    return { picked: picked, moves: moves };
  }

  // 把 YouTube 內部清單資料改成新順序（只處理已載入的範圍）。
  // 回傳 { ok, missing, beyond }：missing 表示有影片應出現在已載入範圍內，但缺少可插入的資料；
  // beyond 表示有影片移到尚未載入的範圍，畫面上暫時看不到
  function reorderModel(listEl, newOrder, rawById, movedIds) {
    var ctrl = listEl && (listEl.polymerController || listEl);
    var contents = listEl && listEl.data && listEl.data.contents;
    if (!ctrl || typeof ctrl.splice !== 'function' || !Array.isArray(contents)) return { ok: false };

    var loaded = contents.filter(function (c) { return c.playlistVideoRenderer; });
    var loadedIds = loaded.map(function (c) { return c.playlistVideoRenderer.setVideoId; });
    var hasMore = contents.some(function (c) { return c.continuationItemRenderer; });
    var entryById = new Map();
    loaded.forEach(function (c) { entryById.set(c.playlistVideoRenderer.setVideoId, c); });

    // 新的已載入範圍：清單已全部載入時取整份；否則取到原本已載入、且沒被移動的最後一部影片為止，
    // 之後的部分交給捲動續載
    var newPrefix;
    if (!hasMore) {
      newPrefix = newOrder;
    } else {
      var lastKeep = -1;
      loadedIds.forEach(function (id) {
        if (movedIds.has(id)) return;
        lastKeep = Math.max(lastKeep, newOrder.indexOf(id));
      });
      newPrefix = newOrder.slice(0, lastKeep + 1);
    }

    // 先移除所有被移動的影片，再依新順序由前往後插入
    for (var i = contents.length - 1; i >= 0; i--) {
      var pvr = contents[i].playlistVideoRenderer;
      if (pvr && movedIds.has(pvr.setVideoId)) ctrl.splice('data.contents', i, 1);
    }
    var missing = false;
    var beyond = false;
    movedIds.forEach(function (id) {
      if (newPrefix.indexOf(id) === -1) beyond = true;
    });
    var offset = 0;
    newPrefix.forEach(function (id, idx) {
      if (!movedIds.has(id)) return;
      var entry = entryById.get(id) || rawById.get(id);
      if (!entry) {
        missing = true;
        offset++;
        return;
      }
      ctrl.splice('data.contents', idx - offset, 0, entry);
    });
    return { ok: true, missing: missing, beyond: beyond };
  }

  async function handleMultiMove(targetPos) {
    if (isMoving()) {
      showToast(tr('busy'));
      return;
    }
    var config = getYtConfig();
    var playlistId = getPlaylistId();
    if (!config?.apiKey || !config?.context) {
      showToast(tr('noApi'));
      return;
    }
    if (!playlistId) {
      showToast(tr('noPlaylistId'));
      return;
    }

    // 移動期間可能換頁，先記下目前的清單元件，結束時確認仍是同一份清單才更新畫面
    var listEl = document.querySelector('ytd-playlist-video-list-renderer');
    multiBusy = true;
    if (multiBar) multiBar.classList.add('ytps-loading');
    syncSelectionUi();
    var done = 0;
    var total = 0;
    var retryTarget = '';
    try {
      setMultiStatus(tr('stepFetch') + '…');
      var fullList = await fetchFullPlaylist(playlistId, config);
      if (fullList.length === 0) {
        showToast(tr('playlistEmpty'));
        return;
      }
      var order = fullList.map(function (it) { return it.setVideoId; });
      var picked = order.filter(function (id) { return selection.has(id); });
      // 已不在清單中的勾選（例如在別處刪除）直接捨棄
      selection.forEach(function (id) { if (picked.indexOf(id) === -1) selection.delete(id); });
      if (picked.length === 0) {
        showToast(tr('selectionGone'));
        return;
      }

      var moves = planMultiMove(order, selection, Math.max(targetPos, 1)).moves;

      var finalOrder = applyMoves(order, moves);
      if (finalOrder.join() === order.join()) {
        showToast(tr('alreadyThere'));
        clearSelection();
        return;
      }

      total = moves.length;
      var succeeded = [];
      var failure = null;
      for (var i = 0; i < moves.length; i++) {
        setMultiStatus(tr('stepWriteCount', i + 1, total) + '…');
        try {
          await moveVideo(playlistId, moves[i].id, moves[i].after, config);
          succeeded.push(moves[i]);
          done++;
        } catch (err) {
          failure = err;
          break;
        }
      }
      if (succeeded.length === 0) throw failure;

      var newOrder = applyMoves(order, succeeded);
      var staleOrders = [order];
      for (var k = 1; k < succeeded.length; k++) staleOrders.push(applyMoves(order, succeeded.slice(0, k)));
      rememberOrder(playlistId, staleOrders, newOrder);
      var rawById = new Map();
      fullList.forEach(function (it) { if (it.raw) rawById.set(it.setVideoId, it.raw); });
      var movedIds = new Set(succeeded.map(function (m) { return m.id; }));
      var landedPos = newOrder.indexOf(succeeded[0].id) + 1;

      var samePage = getPlaylistId() === playlistId && listEl && listEl.isConnected;
      var before = snapshotPositions();
      var result = samePage ? reorderModel(listEl, newOrder, rawById, movedIds) : { ok: false };
      // 成功移動的取消勾選，失敗的保持勾選以便重試
      movedIds.forEach(function (id) { selection.delete(id); });

      if (failure) {
        // 重試時接在最後一部已移動的影片後面，維持原本的先後順序
        retryTarget = String(newOrder.indexOf(succeeded[succeeded.length - 1].id) + 2);
        showToast(tr('multiPartial', succeeded.length, total - succeeded.length, failure.message), 5000);
      } else if (!samePage) {
        showToast(tr('multiMoved', succeeded.length, landedPos), 2500);
      } else if (!result.ok || result.missing) {
        showToast(tr('multiMovedReload', succeeded.length, landedPos), 4000);
      } else if (result.beyond) {
        updateIndexBadges();
        showToast(tr('multiMovedNotLoaded', succeeded.length, landedPos), 4000);
      } else {
        showToast(tr('multiMoved', succeeded.length, landedPos), 2500);
      }
      if (result.ok) animateMultiMove(before, movedIds);
    } catch (err) {
      logError('Multi move failed:', err);
      showToast(tr('moveFailed', err.message), 5000);
    } finally {
      multiBusy = false;
      setMultiStatus('');
      if (multiBar) multiBar.classList.remove('ytps-loading');
      if (multiBar && done > 0) multiBar._ytps.input.value = retryTarget;
      syncSelectionUi();
    }
  }

  // 等重繪後播放動畫：移動的影片在畫面內就滑動，否則捲到第一部落點；所有落點閃爍外框
  function animateMultiMove(before, movedIds) {
    setTimeout(function () {
      updateIndexBadges();
      syncSelectionUi();
      var landed = getAllLoadedItems().filter(function (el) {
        return movedIds.has(getItemData(el)?.setVideoId);
      });
      if (landed.length === 0) return;
      var first = landed[0];
      var visible = isInViewport(first.getBoundingClientRect());
      if (visible && !prefersReducedMotion()) {
        playFlip(before, movedIds);
        setTimeout(function () { landed.forEach(flashLanded); }, ANIM_DURATION);
      } else {
        if (!visible) first.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
        landed.forEach(flashLanded);
      }
    }, 50);
  }

  function injectButtons() {
    if (injecting) return;
    if (!settings.enabled) return;
    if (!isPlaylistPage()) return;
    if (!isOwnPlaylist()) return;

    injecting = true;
    try {
      var items = getAllLoadedItems();
      // 換到另一份播放清單時清除勾選
      if (selectionPlaylistId !== getPlaylistId()) {
        selectionPlaylistId = getPlaylistId();
        selection.clear();
      }
      items.forEach(function (item) { createMoveButton(item); });
      updateIndexBadges();
      ensureMultiBar();
      syncSelectionUi();
    } finally {
      injecting = false;
    }
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.ytps-move-btn') && !e.target.closest('.ytps-panel') &&
        !e.target.closest('.ytps-picker-overlay') && !e.target.closest('.ytps-multibar')) {
      closeAllPanels();
    }
  });

  var _injectTimer = null;
  var observer = new MutationObserver(function () {
    if (_injectTimer) return;
    _injectTimer = setTimeout(function () {
      _injectTimer = null;
      if (isPlaylistPage()) {
        injectButtons();
      }
    }, 500);
  });

  // 設定變更時立即套用，不需重新整理頁面
  function applySettings() {
    var prev = settings;
    settings = readSettings();
    if (!settings.enabled) {
      removeAllUi();
      return;
    }
    if (!prev.enabled || prev.lang !== settings.lang) {
      // 按鈕與面板的文字在建立時寫入，切換語言要整組重建
      removeAllUi();
    } else if (prev.showBadges && !settings.showBadges) {
      removeIndexBadges();
    }
    applyMultiBarPos();
    injectButtons();
  }

  document.addEventListener(SETTINGS_EVENT, applySettings);

  function init() {
    log('Initializing on', window.location.href);
    // bridge.js 讀取 storage 是非同步的，可能在本檔初始化後才寫入設定
    settings = readSettings();
    if (isPlaylistPage()) {
      log('Playlist page detected, injecting buttons');
      injectButtons();
    }
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  var lastUrl = window.location.href;
  setInterval(function () {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // 換頁時先移除操作列，回到自己的播放清單時由 injectButtons() 重建
      removeMultiBar();
      if (isPlaylistPage()) {
        setTimeout(injectButtons, 1000);
      } else {
        closeAllPanels();
      }
    }
  }, CHECK_INTERVAL);
})();
