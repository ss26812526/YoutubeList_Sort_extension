(function () {
  'use strict';

  var DEFAULT_SETTINGS = { enabled: true, showBadges: true, lang: 'auto', multiBarPos: 'top' };

  var STRINGS = {
    'zh-TW': {
      enabled: '啟用擴充功能',
      showBadges: '顯示排序編號',
      language: '語言',
      langAuto: '自動（跟隨 YouTube）',
      multiBarPos: '多選操作列位置',
      posTop: '畫面上方',
      posBottom: '畫面下方',
      hint: '變更會立即套用到已開啟的 YouTube 分頁。',
    },
    en: {
      enabled: 'Enable extension',
      showBadges: 'Show position numbers',
      language: 'Language',
      langAuto: 'Auto (match YouTube)',
      multiBarPos: 'Multi-select bar',
      posTop: 'Top',
      posBottom: 'Bottom',
      hint: 'Changes apply to open YouTube tabs right away.',
    },
  };

  var enabledEl = document.getElementById('enabled');
  var badgesEl = document.getElementById('showBadges');
  var badgesRow = document.getElementById('badgesRow');
  var barPosRow = document.getElementById('barPosRow');
  var langEl = document.getElementById('lang');
  var barPosEl = document.getElementById('multiBarPos');

  // 設定面板本身沒有 YouTube 頁面可參考，「自動」時以瀏覽器語言決定
  function resolveLang(settings) {
    if (settings.lang === 'zh-TW' || settings.lang === 'en') return settings.lang;
    return /^zh/i.test(chrome.i18n.getUILanguage()) ? 'zh-TW' : 'en';
  }

  function render(settings) {
    var lang = resolveLang(settings);
    var table = STRINGS[lang];
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = table[el.dataset.i18n];
    });
    enabledEl.checked = settings.enabled;
    badgesEl.checked = settings.showBadges;
    badgesEl.disabled = !settings.enabled;
    badgesRow.classList.toggle('disabled', !settings.enabled);
    langEl.value = settings.lang;
    barPosEl.value = settings.multiBarPos;
    barPosEl.disabled = !settings.enabled;
    barPosRow.classList.toggle('disabled', !settings.enabled);
  }

  function save(patch) {
    chrome.storage.sync.set(patch, function () {
      chrome.storage.sync.get(DEFAULT_SETTINGS, render);
    });
  }

  enabledEl.addEventListener('change', function () { save({ enabled: enabledEl.checked }); });
  badgesEl.addEventListener('change', function () { save({ showBadges: badgesEl.checked }); });
  langEl.addEventListener('change', function () { save({ lang: langEl.value }); });
  barPosEl.addEventListener('change', function () { save({ multiBarPos: barPosEl.value }); });

  chrome.storage.sync.get(DEFAULT_SETTINGS, render);
})();
