(function () {
  'use strict';

  var config = window.ZionPrivacyBanner || {};
  var text = window.ZionPrivacyBannerI18n;
  var storageKey = config.storageKey || 'zion_privacy_consent_v1';
  var isPreview = config.preview === true
    || String(config.preview || '').toLowerCase() === 'true'
    || /(?:^|&)zion_priv_preview=(?:true|1|yes)(?:&|$)/i.test(window.location.search.replace(/^\?/, ''));
  var storedConsent = !isPreview ? readStoredConsent() : null;
  var hasStoredConsent = !isPreview && storedConsent !== null;

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
  var design = safeDesign(config.design || 'bar');
  var launcher = null;
  var modalOnly = false;
  var regulation = safeRegulation(config.regulation || 'gdpr');
  var defaultEssentialLabel = regulation === 'us_state_laws'
    ? text.doNotSell
    : (regulation === 'gdpr_us_state_laws' ? text.rejectDoNotSell : text.essential);
  var rejectLabel = config.rejectLabel || defaultEssentialLabel;
  var rejectAllLabel = config.rejectAllLabel || text.rejectAll;
  root.className = 'zion-privacy-banner zion-privacy-banner--design-' + design + ' zion-privacy-banner--' + safePosition(config.position || 'bottom')
    + ' zion-privacy-banner--regulation-' + regulation
    + (config.shadow === false ? ' is-flat' : '')
    + (config.useSiteFont === false ? ' uses-system-font' : ' uses-site-font')
    + (config.hoverEnabled === false ? ' hover-disabled' : '')
    + (hasStoredConsent ? ' is-hidden' : '')
    + ' hover-' + safeHoverEffect(config.hoverEffect || 'lift_glow');
  root.setAttribute('aria-label', text.privacyPreferences);
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
  Array.from(root.style).forEach(function (property) {
    if (property.indexOf('--zion-banner-') === 0) host.style.setProperty(property, root.style.getPropertyValue(property));
  });
  var isCardDesign = design === 'card';
  root.innerHTML = '<div class="zion-privacy-banner__content">'
    + '<div class="zion-privacy-banner__copy">' + renderCardHeader()
    + (isCardDesign ? '' : '<h2>' + escapeHtml(config.title || text.title) + '</h2>'
      + '<p>' + escapeHtml(config.message || text.message) + '</p>')
    + renderPolicyLinks()
    + '</div><div class="zion-privacy-banner__actions">'
    + (!isCardDesign && config.showReject !== false ? '<button type="button" data-zion-consent="essential">' + escapeHtml(rejectLabel) + '</button>' : '')
    + (config.showRejectAll !== false ? '<button type="button" data-zion-consent="reject-all">' + escapeHtml(rejectAllLabel) + '</button>' : '')
    + (config.showCustomize !== false ? '<button type="button" data-zion-consent="customize">' + escapeHtml(config.customizeLabel || text.customize) + '</button>' : '')
    + (config.showAccept !== false ? '<button type="button" data-zion-consent="accept" class="is-primary">' + escapeHtml(config.acceptLabel || text.accept) + '</button>' : '')
    + '</div></div>'
    + '<div class="zion-privacy-banner__footer">' + renderPoweredBy() + '</div>';
  shadowRoot.appendChild(root);
  document.body.appendChild(host);
  recordVisitorView();

  root.addEventListener('click', function (event) {
    var categoryToggle = event.target.closest('[data-zion-category-toggle]');

    if (categoryToggle) {
      toggleCategory(categoryToggle.getAttribute('data-zion-category-toggle'));
      return;
    }

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

    if (action === 'essential' || action === 'reject') {
      applyConsent({ necessary: true, preferences: false, analytics: false, marketing: false, security: false, personalization: false, unknown: false }, 'rejected', false);
      return;
    }

    if (action === 'reject-all') {
      applyConsent({ necessary: true, preferences: false, analytics: false, marketing: false, security: false, personalization: false, unknown: false }, 'rejected', true);
      return;
    }

    var consent = action === 'accept'
      ? { necessary: true, preferences: true, analytics: true, marketing: true, security: true, personalization: true, unknown: true }
      : { necessary: true, preferences: false, analytics: false, marketing: false, security: false, personalization: false, unknown: false };

    applyConsent(consent, action === 'accept' ? 'accepted' : 'rejected', false);
  });

  if (hasStoredConsent && config.showCookieLauncher !== false) {
    showLauncher();
  }

  function showPreferences(fromLauncher) {
    if (root.querySelector('.zion-privacy-banner__preferences')) {
      return;
    }
    root.classList.add('is-preferences-open');

    if (fromLauncher) {
      modalOnly = true;
      root.classList.remove('is-hidden');
      root.classList.add('is-modal-only');
    }

    var groups = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'];
    var cookies = Array.isArray(config.cookies) ? config.cookies : [];
    var optionalDefault = regulation === 'us_state_laws';
    var savedConsent = !isPreview ? readStoredConsent() : null;
    var expandedCategories = !isPreview ? readExpandedCategories() : {};
    var html = groups.map(function (category) {
      var categoryCookies = cookies.filter(function (cookie) { return (cookie.category || 'unknown') === category; });
      var rows = categoryCookies.map(function (cookie) {
        return '<div class="zion-privacy-banner__cookie"><strong>'
          + escapeHtml(cookie.name || cookie.technical_name || text.unknownCookie)
          + '</strong><span>' + escapeHtml(text.cookieDescription(cookie.description))
          + (cookie.vendor ? ' · ' + escapeHtml(cookie.vendor) : '') + '</span></div>';
      }).join('');

      if (!categoryCookies.length && category !== 'necessary') {
        return '';
      }

      var isSelected = category === 'necessary'
        ? true
        : (savedConsent && Object.prototype.hasOwnProperty.call(savedConsent, category)
          ? Boolean(savedConsent[category])
          : optionalDefault);
      var isExpanded = expandedCategories[category] === true;
      var categoryId = 'zion-privacy-category-' + category;

      return '<section class="zion-privacy-banner__category' + (isExpanded ? ' is-expanded' : '') + '" data-zion-category-panel="' + category + '"><div class="zion-privacy-banner__category-head">'
        + '<button type="button" class="zion-privacy-banner__category-toggle" data-zion-category-toggle="' + category + '" aria-expanded="' + (isExpanded ? 'true' : 'false') + '" aria-controls="' + categoryId + '"><span><h3>' + escapeHtml(text.categoryLabel(category)) + '</h3><p>'
        + escapeHtml(category === 'necessary' ? text.alwaysActive : (config.showCategoryCounts === false ? text.optionalCookies : text.detectedCookies(categoryCookies.length)))
        + '</p></span><span class="zion-privacy-banner__category-chevron" aria-hidden="true"></span></button><label class="zion-privacy-banner__switch"><input type="checkbox" aria-label="' + escapeAttribute(text.categoryLabel(category)) + '" data-zion-category="' + category + '" ' + (isSelected ? 'checked' : '') + (category === 'necessary' ? ' disabled' : '') + '><span></span></label></div>'
        + (config.showCookieDetails !== false && rows ? '<div id="' + categoryId + '" class="zion-privacy-banner__cookies">' + rows + '</div>' : '')
        + '</section>';
    }).join('');

    var selectorMessage = config.selectorMessage || (regulation === 'us_state_laws' ? text.usSelectorMessage : text.selectorMessage);
    var modal = document.createElement('div');
    modal.className = 'zion-privacy-banner__preferences';
    modal.innerHTML = '<div class="zion-privacy-banner__preferences-dialog" role="dialog" aria-modal="true" aria-label="' + escapeAttribute(text.cookiePreferences) + '">'
      + '<div class="zion-privacy-banner__preferences-header"><div><span>' + escapeHtml(text.privacyChoices) + ' · ' + escapeHtml(formatRegulation(regulation)) + '</span><h2>' + escapeHtml(config.selectorTitle || text.selectorTitle) + '</h2><p>' + escapeHtml(selectorMessage) + '</p>' + renderPolicyLinks() + '</div><button type="button" data-zion-consent="close-preferences" aria-label="' + escapeAttribute(text.close) + '">×</button></div>'
      + '<div class="zion-privacy-banner__preferences-body">' + html + '</div>'
      + '<div class="zion-privacy-banner__preferences-footer">'
      + '<div class="zion-privacy-banner__preferences-actions">'
      + (config.showReject !== false ? '<button type="button" data-zion-consent="essential">' + escapeHtml(rejectLabel) + '</button>' : '')
      + (config.showRejectAll !== false ? '<button type="button" data-zion-consent="reject-all">' + escapeHtml(rejectAllLabel) + '</button>' : '')
      + '<button type="button" data-zion-consent="close-preferences">' + escapeHtml(text.cancel) + '</button>'
      + (config.showSavePreferences !== false ? '<button type="button" data-zion-consent="save-preferences">' + escapeHtml(config.saveLabel || text.save) + '</button>' : '')
      + (config.showAccept !== false ? '<button type="button" data-zion-consent="accept" class="is-primary">' + escapeHtml(config.acceptLabel || text.accept) + '</button>' : '')
      + '</div>'
      + renderPoweredBy()
      + '</div>'
      + '</div>';
    root.appendChild(modal);
  }

  function toggleCategory(category) {
    var panel = root.querySelector('[data-zion-category-panel="' + escapeAttribute(category) + '"]');
    var toggle = root.querySelector('[data-zion-category-toggle="' + escapeAttribute(category) + '"]');

    if (!panel || !toggle) {
      return;
    }

    var expanded = !panel.classList.contains('is-expanded');
    panel.classList.toggle('is-expanded', expanded);
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');

    if (!isPreview) {
      var expandedCategories = readExpandedCategories();
      expandedCategories[category] = expanded;
      writeStorage(storageKey + '_expanded_categories', JSON.stringify(expandedCategories));
    }
  }

  function readExpandedCategories() {
    try {
      var raw = readStorage(storageKey + '_expanded_categories');
      var parsed = raw ? JSON.parse(raw) : {};

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function renderPoweredBy() {
    if (config.showPoweredBy === false) {
      return '';
    }

    var poweredByUrl = escapeHtml(config.poweredByUrl || 'https://zion3d.ro');

    return '<div class="zion-privacy-banner__powered">' + escapeHtml(text.poweredBy) + ' <a href="' + poweredByUrl + '" target="_blank" rel="noopener noreferrer" class="zion-privacy-banner__powered-link"><span class="zion-privacy-banner__powered-logo"><strong>zion</strong><span>Privacy</span></span></a></div>';
  }

  function renderCardHeader() {
    if (design !== 'card') {
      return '';
    }

    var logo = config.logoUrl
      ? '<img src="' + escapeAttribute(config.logoUrl) + '" alt="' + escapeAttribute(text.bannerLogo) + '">'
      : '<span>' + escapeHtml(text.logo) + '</span>';

    var closeAction = config.showRejectAll !== false ? 'reject-all' : 'essential';
    return '<div class="zion-privacy-banner__card-header"><div class="zion-privacy-banner__logo">' + logo + '</div><div class="zion-privacy-banner__card-heading"><h2>' + escapeHtml(config.title || text.title) + '</h2><p>' + escapeHtml(config.message || text.message) + '</p></div><button type="button" class="zion-privacy-banner__card-close" data-zion-consent="' + closeAction + '" aria-label="' + escapeAttribute(closeAction === 'reject-all' ? rejectAllLabel : rejectLabel) + '">×</button></div>';
  }

  function closePreferences() {
    root.classList.remove('is-preferences-open');
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

  function applyConsent(consent, status, shouldRedirect) {
    var normalizedConsent = normalizeConsent(consent);

    if (!isPreview) {
      storedConsent = normalizedConsent;
      try {
        writeStorage(storageKey, JSON.stringify(normalizedConsent));
      } catch (error) {
        // Consent can still be sent when browser storage is unavailable.
      }
      sendConsentEvent(normalizedConsent, status);
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
      root.classList.remove('is-preferences-open');
      root.classList.add('is-hidden');
      showLauncher();
    }
    document.dispatchEvent(new CustomEvent('zionprivacy:consent', { detail: normalizedConsent }));
    redirectAfterRejection(status, shouldRedirect === true);
  }

  function redirectAfterRejection(status, shouldRedirect) {
    if (isPreview || !shouldRedirect || status !== 'rejected' || config.rejectRedirectEnabled !== true || !config.rejectRedirectUrl) {
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
    launcher.setAttribute('aria-label', text.reviewPreferences);
    launcher.title = text.reviewPreferences;
    launcher.innerHTML = '<span class="zion-privacy-banner__launcher-icon" aria-hidden="true">🍪</span><span class="zion-privacy-banner__launcher-label">' + escapeHtml(text.reviewPreferences) + '</span>';
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

  function readStoredConsent() {
    try {
      var raw = readStorage(storageKey);
      if (!raw) {
        return null;
      }

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return normalizeConsent(parsed);
    } catch (error) {
      return null;
    }
  }

  function normalizeConsent(consent) {
    var categories = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'];
    var normalized = {};

    categories.forEach(function (category) {
      normalized[category] = category === 'necessary' || Boolean(consent && consent[category]);
    });

    return normalized;
  }

  function recordVisitorView() {
    if (isPreview || config.consentTrackingEnabled === false || !config.consentUrl || !config.consentToken || !window.fetch) {
      return;
    }

    var seenKey = storageKey + '_visitor_seen';
    try {
      if (readStorage(seenKey) === '1') {
        return;
      }

      writeStorage(seenKey, '1');
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
    var token = readStorage(key);
    if (!token) {
      token = uuid();
      writeStorage(key, token);
    }
    return token;
  }

  function readStorage(key) {
    try {
      if (window.localStorage) {
        var localValue = window.localStorage.getItem(key);
        if (localValue !== null) {
          return localValue;
        }
      }
    } catch (error) {
      // Fall back to a first-party cookie when browser storage is blocked.
    }

    var prefix = encodeURIComponent(key) + '=';
    var cookie = document.cookie.split(';').map(function (part) { return part.trim(); }).find(function (part) {
      return part.indexOf(prefix) === 0;
    });

    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
  }

  function writeStorage(key, value) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(key, value);
        if (window.localStorage.getItem(key) === value) {
          return;
        }
      }
    } catch (error) {
      // Fall back to a first-party cookie when browser storage is blocked.
    }

    document.cookie = encodeURIComponent(key) + '=' + encodeURIComponent(value) + '; Max-Age=31536000; Path=/; SameSite=Lax' + (window.location.protocol === 'https:' ? '; Secure' : '');
  }

  function renderPolicyLinks() {
    var links = Array.isArray(config.policyLinks) ? config.policyLinks.filter(function (link) {
      return link && link.url && link.label;
    }) : [];

    if (!links.length && !Array.isArray(config.policyLinks) && config.showPrivacyLink !== false && config.privacyUrl) {
      links = [{ url: config.privacyUrl, label: config.privacyLinkLabel || text.privacyPolicy }];
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

  function safeDesign(value) {
    return ['bar', 'card'].indexOf(value) !== -1 ? value : 'bar';
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
    return value === 'us_state_laws' ? text.usLaws : (value === 'gdpr_us_state_laws' ? text.combinedLaws : 'GDPR');
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
