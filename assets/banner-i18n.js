(function (window) {
  'use strict';

  var __ = window.wp.i18n.__;
  var _n = window.wp.i18n._n;
  var sprintf = window.wp.i18n.sprintf;
  var labels = {
    privacyPreferences: __('Privacy preferences', 'zion-privacy-client'),
    cookiePreferences: __('Cookie preferences', 'zion-privacy-client'),
    privacyChoices: __('Privacy choices', 'zion-privacy-client'),
    alwaysActive: __('Always active for core website functionality.', 'zion-privacy-client'),
    optionalCookies: __('Optional cookies', 'zion-privacy-client'),
    close: __('Close', 'zion-privacy-client'),
    cancel: __('Cancel', 'zion-privacy-client'),
    noDescription: __('No description available.', 'zion-privacy-client'),
    unknownCookie: __('Unknown cookie', 'zion-privacy-client'),
    reviewPreferences: __('Review cookie preferences', 'zion-privacy-client'),
    poweredBy: __('Powered by', 'zion-privacy-client'),
    bannerLogo: __('Banner logo', 'zion-privacy-client'),
    logo: __('Logo', 'zion-privacy-client'),
    title: __('Your privacy matters', 'zion-privacy-client'),
    message: __('Choose which categories of cookies you allow.', 'zion-privacy-client'),
    customize: __('Customize', 'zion-privacy-client'),
    selectorTitle: __('Customize cookies', 'zion-privacy-client'),
    selectorMessage: __('Choose which cookie categories you allow on this website.', 'zion-privacy-client'),
    usSelectorMessage: __('Choose whether optional cookies may be used or opt out of sale and sharing.', 'zion-privacy-client'),
    accept: __('Accept all', 'zion-privacy-client'),
    essential: __('Essential only', 'zion-privacy-client'),
    rejectAll: __('Reject all', 'zion-privacy-client'),
    save: __('Save preferences', 'zion-privacy-client'),
    saved: __('Cookie preferences saved.', 'zion-privacy-client'),
    privacyPolicy: __('Privacy policy', 'zion-privacy-client'),
    usLaws: __('US State Laws', 'zion-privacy-client'),
    combinedLaws: __('GDPR + US State Laws', 'zion-privacy-client'),
    doNotSell: __('Do not sell or share', 'zion-privacy-client'),
    rejectDoNotSell: __('Reject / do not sell or share', 'zion-privacy-client')
  };
  var categories = {
    necessary: __('Necessary', 'zion-privacy-client'),
    preferences: __('Preferences', 'zion-privacy-client'),
    analytics: __('Analytics', 'zion-privacy-client'),
    marketing: __('Marketing', 'zion-privacy-client'),
    security: __('Security', 'zion-privacy-client'),
    personalization: __('Personalization', 'zion-privacy-client'),
    unknown: __('Unknown', 'zion-privacy-client')
  };

  labels.categoryLabel = function (category) {
    return Object.prototype.hasOwnProperty.call(categories, category) ? categories[category] : categories.unknown;
  };
  labels.detectedCookies = function (count) {
    return sprintf(_n('%d cookie detected', '%d cookies detected', count, 'zion-privacy-client'), count);
  };
  labels.cookieDescription = function (value) {
    return value && value !== 'No description available.' ? value : labels.noDescription;
  };
  window.ZionPrivacyBannerI18n = labels;
}(window));
