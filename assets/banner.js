(function () {
  'use strict';

  var config = window.ZionPrivacyBanner || {};
  var storageKey = config.storageKey || 'zion_privacy_consent_v1';

  if (window.localStorage.getItem(storageKey)) {
    return;
  }

  var root = document.createElement('section');
  root.className = 'zion-privacy-banner zion-privacy-banner--' + safePosition(config.position || 'bottom') + (config.shadow === false ? ' is-flat' : '');
  root.setAttribute('aria-label', 'Privacy preferences');
  var colors = config.colors || {};
  root.style.setProperty('--zion-banner-background', colors.background || '#ffffff');
  root.style.setProperty('--zion-banner-text', colors.text || '#183153');
  root.style.setProperty('--zion-banner-muted', colors.muted || '#52657c');
  root.style.setProperty('--zion-banner-primary', colors.primary || '#2369d1');
  root.style.setProperty('--zion-banner-primary-text', colors.primaryText || '#ffffff');
  root.style.setProperty('--zion-banner-secondary', colors.secondary || '#f1f6fc');
  root.style.setProperty('--zion-banner-secondary-text', colors.secondaryText || '#1e477c');
  root.style.setProperty('--zion-banner-border', colors.border || '#dce5f0');
  root.style.setProperty('--zion-banner-radius', Math.max(0, Number(config.radius || 12)) + 'px');
  root.style.setProperty('--zion-banner-font-size', Math.max(12, Number(config.fontSize || 14)) + 'px');
  root.style.setProperty('--zion-banner-width', Math.max(520, Number(config.width || 1180)) + 'px');
  root.innerHTML = '<div class="zion-privacy-banner__content">'
    + '<div><h2>' + escapeHtml(config.title || 'Your privacy matters') + '</h2>'
    + '<p>' + escapeHtml(config.message || 'Choose which categories of cookies you allow.') + '</p>'
    + (config.showPrivacyLink !== false && config.privacyUrl ? '<a href="' + escapeAttribute(config.privacyUrl) + '">' + escapeHtml(config.privacyLinkLabel || 'Privacy policy') + '</a>' : '')
    + '</div><div class="zion-privacy-banner__actions">'
    + '<button type="button" data-zion-consent="reject">' + escapeHtml(config.rejectLabel || 'Essential only') + '</button>'
    + (config.showCustomize !== false ? '<button type="button" data-zion-consent="customize">' + escapeHtml(config.customizeLabel || 'Customize') + '</button>' : '')
    + '<button type="button" data-zion-consent="accept" class="is-primary">' + escapeHtml(config.acceptLabel || 'Accept all') + '</button>'
    + '</div></div>';
  document.body.appendChild(root);

  root.addEventListener('click', function (event) {
    var button = event.target.closest('[data-zion-consent]');

    if (!button) {
      return;
    }

    var action = button.getAttribute('data-zion-consent');

    if (action === 'customize') {
      showPreferences();
      return;
    }

    if (action === 'save-preferences') {
      savePreferences();
      return;
    }

    if (action === 'close-preferences') {
      closePreferences();
      return;
    }

    var consent = action === 'accept'
      ? { necessary: true, preferences: true, analytics: true, marketing: true, security: true, personalization: true, unknown: true }
      : { necessary: true, preferences: false, analytics: false, marketing: false, security: false, personalization: false, unknown: false };

    applyConsent(consent, action === 'accept' ? 'accepted' : 'rejected');
  });

  function showPreferences() {
    if (root.querySelector('.zion-privacy-banner__preferences')) {
      return;
    }

    var groups = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'];
    var cookies = Array.isArray(config.cookies) ? config.cookies : [];
    var html = groups.map(function (category) {
      var categoryCookies = cookies.filter(function (cookie) { return (cookie.category || 'unknown') === category; });
      var rows = categoryCookies.map(function (cookie) {
        return '<div class="zion-privacy-banner__cookie"><strong>'
          + escapeHtml(cookie.name || cookie.technical_name || 'Unknown cookie')
          + '</strong><span>' + escapeHtml(cookie.description || 'No description available.')
          + (cookie.vendor ? ' · ' + escapeHtml(cookie.vendor) : '') + '</span></div>';
      }).join('');

      if (!categoryCookies.length && category !== 'necessary') {
        return '';
      }

      return '<section class="zion-privacy-banner__category"><div class="zion-privacy-banner__category-head">'
        + '<div><h3>' + escapeHtml(formatLabel(category)) + '</h3><p>'
        + (category === 'necessary' ? 'Always active for core website functionality.' : (config.showCategoryCounts === false ? 'Optional cookies' : categoryCookies.length + ' cookie' + (categoryCookies.length === 1 ? '' : 's') + ' detected'))
        + '</p></div><label class="zion-privacy-banner__switch"><input type="checkbox" data-zion-category="' + category + '" ' + (category === 'necessary' ? 'checked disabled' : 'checked') + '><span></span></label></div>'
        + (config.showCookieDetails !== false && rows ? '<div class="zion-privacy-banner__cookies">' + rows + '</div>' : '')
        + '</section>';
    }).join('');

    var modal = document.createElement('div');
    modal.className = 'zion-privacy-banner__preferences';
    modal.innerHTML = '<div class="zion-privacy-banner__preferences-dialog" role="dialog" aria-modal="true" aria-label="Cookie preferences">'
      + '<div class="zion-privacy-banner__preferences-header"><div><span>Privacy choices</span><h2>' + escapeHtml(config.selectorTitle || 'Customize cookies') + '</h2><p>' + escapeHtml(config.selectorMessage || 'Choose which cookie categories you allow on this website.') + '</p></div><button type="button" data-zion-consent="close-preferences" aria-label="Close">×</button></div>'
      + '<div class="zion-privacy-banner__preferences-body">' + html + '</div>'
      + '<div class="zion-privacy-banner__preferences-footer"><button type="button" data-zion-consent="close-preferences">Cancel</button><button type="button" data-zion-consent="save-preferences" class="is-primary">' + escapeHtml(config.saveLabel || 'Save preferences') + '</button></div>'
      + '</div>';
    root.appendChild(modal);
  }

  function closePreferences() {
    var modal = root.querySelector('.zion-privacy-banner__preferences');
    if (modal) {
      modal.remove();
    }
  }

  function savePreferences() {
    var consent = { necessary: true };
    root.querySelectorAll('[data-zion-category]').forEach(function (input) {
      consent[input.getAttribute('data-zion-category')] = input.checked;
    });
    var optional = Object.keys(consent).filter(function (category) { return category !== 'necessary'; });
    var enabledOptional = optional.filter(function (category) { return consent[category]; }).length;
    var status = enabledOptional === optional.length ? 'accepted' : 'partially_accepted';
    applyConsent(consent, status);
  }

  function applyConsent(consent, status) {
    window.localStorage.setItem(storageKey, JSON.stringify(consent));
    sendConsentEvent(consent, status);
    root.remove();
    document.dispatchEvent(new CustomEvent('zionprivacy:consent', { detail: consent }));
  }

  function sendConsentEvent(consent, status) {
    if (config.consentTrackingEnabled === false || !config.consentUrl || !config.consentToken || !window.fetch) {
      return;
    }

    window.fetch(config.consentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.consentToken,
        event_uuid: uuid(),
        status: status,
        categories: consent,
        page_url: window.location.href,
        occurred_at: new Date().toISOString()
      }),
      keepalive: true
    }).catch(function () {});
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (character) {
      var random = Math.random() * 16 | 0;
      var value = character === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function formatLabel(value) {
    return String(value).replace(/_/g, ' ').replace(/\b\w/g, function (character) { return character.toUpperCase(); });
  }

  function safePosition(value) {
    return ['bottom', 'top', 'bottom_right', 'bottom_left', 'center'].indexOf(value) !== -1 ? value : 'bottom';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character];
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/javascript:/gi, '');
  }
}());
