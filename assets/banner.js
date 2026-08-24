(function () {
  'use strict';

  var config = window.ZionPrivacyBanner || {};
  var storageKey = config.storageKey || 'zion_privacy_consent_v1';
  var isPreview = config.preview === true
    || String(config.preview || '').toLowerCase() === 'true'
    || /(?:^|&)zion_priv_preview=(?:true|1|yes)(?:&|$)/i.test(window.location.search.replace(/^\?/, ''));
  var hasStoredConsent = !isPreview && !!window.localStorage.getItem(storageKey);

  var host = document.createElement('section');
  host.setAttribute('data-zion-privacy-banner-host', '');
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.width = '100vw';
  host.style.height = '100vh';
  host.style.zIndex = '2147483647';
  host.style.pointerEvents = 'none';
  var shadowRoot = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = config.styleUrl || '';
  shadowRoot.appendChild(stylesheet);

  var root = document.createElement('section');
  var launcher = null;
  var modalOnly = false;
  var regulation = safeRegulation(config.regulation || 'gdpr');
  var defaultRejectLabel = regulation === 'us_state_laws'
    ? 'Do not sell or share'
    : (regulation === 'gdpr_us_state_laws' ? 'Reject / do not sell or share' : 'Essential only');
  var rejectLabel = config.rejectLabel && config.rejectLabel !== 'Essential only' ? config.rejectLabel : defaultRejectLabel;
  root.className = 'zion-privacy-banner zion-privacy-banner--' + safePosition(config.position || 'bottom')
    + ' zion-privacy-banner--regulation-' + regulation
    + (config.shadow === false ? ' is-flat' : '')
    + (config.useSiteFont === false ? ' uses-system-font' : ' uses-site-font')
    + (config.hoverEnabled === false ? ' hover-disabled' : '')
    + (hasStoredConsent ? ' is-hidden' : '')
    + ' hover-' + safeHoverEffect(config.hoverEffect || 'lift_glow');
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
  var configuredWidth = Number(config.width || 0);
  root.style.setProperty('--zion-banner-width', configuredWidth > 0
    ? Math.max(520, configuredWidth) + 'px'
    : 'calc(100vw - 40px)');
  root.style.setProperty('--zion-banner-hover-duration', Math.max(100, Number(config.hoverDuration || 180)) + 'ms');
  root.style.setProperty('--zion-banner-hover-scale', Math.max(100, Number(config.hoverScale || 102)) / 100);
  root.innerHTML = '<div class="zion-privacy-banner__content">'
    + '<div><h2>' + escapeHtml(config.title || 'Your privacy matters') + '</h2>'
    + '<p>' + escapeHtml(config.message || 'Choose which categories of cookies you allow.') + '</p>'
    + renderPolicyLinks()
    + '</div><div class="zion-privacy-banner__actions">'
    + '<button type="button" data-zion-consent="reject">' + escapeHtml(rejectLabel) + '</button>'
    + (config.showCustomize !== false ? '<button type="button" data-zion-consent="customize">' + escapeHtml(config.customizeLabel || 'Customize') + '</button>' : '')
    + '<button type="button" data-zion-consent="accept" class="is-primary">' + escapeHtml(config.acceptLabel || 'Accept all') + '</button>'
    + '</div></div>'
    + '<div class="zion-privacy-banner__footer">' + renderPoweredBy() + '</div>';
  shadowRoot.appendChild(root);
  document.body.appendChild(host);
  recordVisitorView();

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

  if (hasStoredConsent && config.showCookieLauncher !== false) {
    showLauncher();
  }

  function showPreferences(fromLauncher) {
    if (root.querySelector('.zion-privacy-banner__preferences')) {
      return;
    }

    if (fromLauncher) {
      modalOnly = true;
      root.classList.remove('is-hidden');
      root.classList.add('is-modal-only');
    }

    var groups = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'];
    var cookies = Array.isArray(config.cookies) ? config.cookies : [];
    var optionalDefault = regulation === 'us_state_laws';
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
        + '</p></div><label class="zion-privacy-banner__switch"><input type="checkbox" data-zion-category="' + category + '" ' + (category === 'necessary' ? 'checked disabled' : (optionalDefault ? 'checked' : '')) + '><span></span></label></div>'
        + (config.showCookieDetails !== false && rows ? '<div class="zion-privacy-banner__cookies">' + rows + '</div>' : '')
        + '</section>';
    }).join('');

    var selectorMessage = config.selectorMessage || (regulation === 'us_state_laws' ? 'Choose whether optional cookies may be used or opt out of sale and sharing.' : 'Choose which cookie categories you allow on this website.');
    var modal = document.createElement('div');
    modal.className = 'zion-privacy-banner__preferences';
    modal.innerHTML = '<div class="zion-privacy-banner__preferences-dialog" role="dialog" aria-modal="true" aria-label="Cookie preferences">'
      + '<div class="zion-privacy-banner__preferences-header"><div><span>Privacy choices · ' + escapeHtml(formatRegulation(regulation)) + '</span><h2>' + escapeHtml(config.selectorTitle || 'Customize cookies') + '</h2><p>' + escapeHtml(selectorMessage) + '</p>' + renderPolicyLinks() + '</div><button type="button" data-zion-consent="close-preferences" aria-label="Close">×</button></div>'
      + '<div class="zion-privacy-banner__preferences-body">' + html + '</div>'
      + '<div class="zion-privacy-banner__preferences-footer">'
      + '<div class="zion-privacy-banner__preferences-actions">'
      + '<button type="button" data-zion-consent="reject">' + escapeHtml(rejectLabel) + '</button>'
      + '<button type="button" data-zion-consent="close-preferences">Cancel</button>'
      + '<button type="button" data-zion-consent="save-preferences">' + escapeHtml(config.saveLabel || 'Save preferences') + '</button>'
      + '<button type="button" data-zion-consent="accept" class="is-primary">' + escapeHtml(config.acceptLabel || 'Accept all') + '</button>'
      + '</div>'
      + renderPoweredBy()
      + '</div>'
      + '</div>';
    root.appendChild(modal);
  }

  function renderPoweredBy() {
    if (config.showPoweredBy === false) {
      return '';
    }

    var poweredByUrl = escapeHtml(config.poweredByUrl || 'https://zion3d.ro');

    return '<div class="zion-privacy-banner__powered">Powered by <a href="' + poweredByUrl + '" target="_blank" rel="noopener noreferrer" class="zion-privacy-banner__powered-link"><span class="zion-privacy-banner__powered-logo"><strong>zion</strong><span>Privacy</span></span></a></div>';
  }

  function closePreferences() {
    var modal = root.querySelector('.zion-privacy-banner__preferences');
    if (modal) {
      modal.remove();
    }
    if (modalOnly) {
      modalOnly = false;
      root.classList.remove('is-modal-only');
      root.classList.add('is-hidden');
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
    if (!isPreview) {
      window.localStorage.setItem(storageKey, JSON.stringify(consent));
      sendConsentEvent(consent, status);
    }
    if (isPreview) {
      host.remove();
    } else {
      hasStoredConsent = true;
      modalOnly = false;
      var modal = root.querySelector('.zion-privacy-banner__preferences');
      if (modal) {
        modal.remove();
      }
      root.classList.remove('is-modal-only');
      root.classList.add('is-hidden');
      showLauncher();
    }
    document.dispatchEvent(new CustomEvent('zionprivacy:consent', { detail: consent }));
    redirectAfterRejection(status);
  }

  function redirectAfterRejection(status) {
    if (isPreview || status !== 'rejected' || config.rejectRedirectEnabled !== true || !config.rejectRedirectUrl) {
      return;
    }

    window.setTimeout(function () {
      window.location.assign(config.rejectRedirectUrl);
    }, 150);
  }

  function showLauncher() {
    if (launcher || isPreview) {
      return;
    }

    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'zion-privacy-banner__launcher zion-privacy-banner__launcher--' + safeLauncherPosition(config.launcherPosition || 'bottom_right');
    launcher.setAttribute('aria-label', 'Review cookie preferences');
    launcher.title = 'Review cookie preferences';
    launcher.innerHTML = '<span class="zion-privacy-banner__launcher-icon" aria-hidden="true">🍪</span><span class="zion-privacy-banner__launcher-label">Review cookie preferences</span>';
    launcher.addEventListener('click', function () {
      showPreferences(true);
    });
    shadowRoot.appendChild(launcher);
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
        visitor_token: visitorToken(),
        regulation: regulation,
        categories: consent,
        page_url: window.location.href,
        occurred_at: new Date().toISOString()
      }),
      keepalive: true
    }).catch(function () {});
  }

  function recordVisitorView() {
    if (isPreview || config.consentTrackingEnabled === false || !config.consentUrl || !config.consentToken || !window.fetch) {
      return;
    }

    var seenKey = storageKey + '_visitor_seen';
    try {
      if (window.localStorage.getItem(seenKey) === '1') {
        return;
      }

      window.localStorage.setItem(seenKey, '1');
    } catch (error) {
      // Continue without local deduplication when storage is unavailable.
    }

    sendConsentEvent(null, 'viewed');
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

  function visitorToken() {
    var key = 'zion_privacy_visitor_v1';
    var token = window.localStorage.getItem(key);
    if (!token) {
      token = uuid();
      window.localStorage.setItem(key, token);
    }
    return token;
  }

  function formatLabel(value) {
    return String(value).replace(/_/g, ' ').replace(/\b\w/g, function (character) { return character.toUpperCase(); });
  }

  function renderPolicyLinks() {
    var links = Array.isArray(config.policyLinks) ? config.policyLinks.filter(function (link) {
      return link && link.url && link.label;
    }) : [];

    if (!links.length && !Array.isArray(config.policyLinks) && config.showPrivacyLink !== false && config.privacyUrl) {
      links = [{ url: config.privacyUrl, label: config.privacyLinkLabel || 'Privacy policy' }];
    }

    if (!links.length) {
      return '';
    }

    var target = safeLinkTarget(config.policyLinkTarget || '_self');
    var targetAttribute = ' target="' + escapeAttribute(target) + '"' + (target === '_blank' ? ' rel="noopener noreferrer"' : '');

    return '<div class="zion-privacy-banner__policy-links">' + links.map(function (link) {
      return '<a href="' + escapeAttribute(link.url) + '"' + targetAttribute + '>' + escapeHtml(link.label) + '</a>';
    }).join('<span aria-hidden="true"> · </span>') + '</div>';
  }

  function safePosition(value) {
    return ['bottom', 'top', 'bottom_centered', 'top_centered', 'bottom_right', 'bottom_left', 'top_right', 'top_left', 'center'].indexOf(value) !== -1 ? value : 'bottom';
  }

  function safeLauncherPosition(value) {
    return ['top_left', 'top_right', 'bottom_left', 'bottom_right'].indexOf(value) !== -1 ? value : 'bottom_right';
  }

  function safeLinkTarget(value) {
    return ['_self', '_blank', '_parent', '_top'].indexOf(value) !== -1 ? value : '_self';
  }

  function safeHoverEffect(value) {
    return ['none', 'lift', 'glow', 'lift_glow'].indexOf(value) !== -1 ? value : 'lift_glow';
  }

  function safeRegulation(value) {
    return ['gdpr', 'us_state_laws', 'gdpr_us_state_laws'].indexOf(value) !== -1 ? value : 'gdpr';
  }

  function formatRegulation(value) {
    return value === 'us_state_laws' ? 'US State Laws' : (value === 'gdpr_us_state_laws' ? 'GDPR + US State Laws' : 'GDPR');
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
