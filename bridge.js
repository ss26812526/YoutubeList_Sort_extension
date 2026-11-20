(function () {
  'use strict';

  // 在擴充功能的隔離環境（ISOLATED world）執行，可以存取 chrome.storage。
  // content.js 在 MAIN world 執行、讀不到 chrome.storage，所以由這裡把設定寫到
  // <html data-ytps-settings>，再發出事件通知 content.js 重新讀取。
  var DEFAULT_SETTINGS = { enabled: true, showBadges: true, lang: 'auto', multiBarPos: 'top' };
  var SETTINGS_ATTR = 'data-ytps-settings';
  var SETTINGS_EVENT = 'ytps-settings-changed';

  function publish(settings) {
    document.documentElement.setAttribute(SETTINGS_ATTR, JSON.stringify(settings));
    document.dispatchEvent(new CustomEvent(SETTINGS_EVENT));
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, publish);

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'sync') return;
    chrome.storage.sync.get(DEFAULT_SETTINGS, publish);
  });
})();
