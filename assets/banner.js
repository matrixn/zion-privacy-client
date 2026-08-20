(function () {
  'use strict';

  var config = window.ZionPrivacyBanner || {};
  var storageKey = config.storageKey || 'zion_privacy_consent_v1';

  if (window.localStorage.getItem(storageKey)) {
    return;
  }

  var root = document.createElement('section');
  root.className = 'zion-privacy-banner';
  root.setAttribute('aria-label', 'Privacy preferences');
  root.innerHTML = '<div class="zion-privacy-banner__content">'
    + '<div><h2>' + escapeHtml(config.title || 'Your privacy matters') + '</h2>'
    + '<p>' + escapeHtml(config.message || 'Choose which categories of cookies you allow.') + '</p>'
    + (config.privacyUrl ? '<a href="' + escapeAttribute(config.privacyUrl) + '">Privacy policy</a>' : '')
    + '</div><div class="zion-privacy-banner__actions">'
    + '<button type="button" data-zion-consent="reject">Essential only</button>'
    + '<button type="button" data-zion-consent="customize">Customize</button>'
    + '<button type="button" data-zion-consent="accept" class="is-primary">Accept all</button>'
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

    applyConsent(consent);
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
        + (category === 'necessary' ? 'Always active for core website functionality.' : categoryCookies.length + ' cookie' + (categoryCookies.length === 1 ? '' : 's') + ' detected')
        + '</p></div><label class="zion-privacy-banner__switch"><input type="checkbox" data-zion-category="' + category + '" ' + (category === 'necessary' ? 'checked disabled' : 'checked') + '><span></span></label></div>'
        + (rows ? '<div class="zion-privacy-banner__cookies">' + rows + '</div>' : '')
        + '</section>';
    }).join('');

    var modal = document.createElement('div');
    modal.className = 'zion-privacy-banner__preferences';
    modal.innerHTML = '<div class="zion-privacy-banner__preferences-dialog" role="dialog" aria-modal="true" aria-label="Cookie preferences">'
      + '<div class="zion-privacy-banner__preferences-header"><div><span>Privacy choices</span><h2>Customize cookies</h2></div><button type="button" data-zion-consent="close-preferences" aria-label="Close">×</button></div>'
      + '<div class="zion-privacy-banner__preferences-body">' + html + '</div>'
      + '<div class="zion-privacy-banner__preferences-footer"><button type="button" data-zion-consent="close-preferences">Cancel</button><button type="button" data-zion-consent="save-preferences" class="is-primary">Save preferences</button></div>'
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
    applyConsent(consent);
  }

  function applyConsent(consent) {
    window.localStorage.setItem(storageKey, JSON.stringify(consent));
    root.remove();
    document.dispatchEvent(new CustomEvent('zionprivacy:consent', { detail: consent }));
  }

  function formatLabel(value) {
    return String(value).replace(/_/g, ' ').replace(/\b\w/g, function (character) { return character.toUpperCase(); });
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
