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
      root.classList.toggle('is-customizing');
      return;
    }

    var consent = action === 'accept'
      ? { necessary: true, preferences: true, analytics: true, marketing: true }
      : { necessary: true, preferences: false, analytics: false, marketing: false };

    window.localStorage.setItem(storageKey, JSON.stringify(consent));
    root.remove();
    document.dispatchEvent(new CustomEvent('zionprivacy:consent', { detail: consent }));
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character];
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/javascript:/gi, '');
  }
}());
