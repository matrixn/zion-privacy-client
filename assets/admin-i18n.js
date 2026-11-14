(function () {
    'use strict';

    var config = window.ZionPrivacyAdmin || {};
    if (config.locale !== 'ro_RO') {
        return;
    }

    var translations = window.ZionPrivacyAdminTranslations || {};
    var keys = Object.keys(translations).sort(function (a, b) {
        return b.length - a.length;
    });
    var ignored = { CODE: true, PRE: true, SCRIPT: true, STYLE: true, TEXTAREA: true };

    function translateValue(value) {
        if (!value || typeof value !== 'string') {
            return value;
        }
        var trimmed = value.replace(/\s+/g, ' ').trim();
        if (translations[trimmed]) {
            var start = value.search(/\S|$/);
            var end = value.search(/\s*$/);
            return value.slice(0, start) + translations[trimmed] + value.slice(end);
        }
        var result = value;
        keys.forEach(function (key) {
            if (key.length > 2 && result.indexOf(key) !== -1) {
                result = result.split(key).join(translations[key]);
            }
        });
        return result;
    }

    function translateElement(element) {
        if (!element || element.nodeType !== 1 || element.closest('[data-zion-i18n-ignore]')) {
            return;
        }

        ['title', 'aria-label', 'placeholder'].forEach(function (attribute) {
            if (element.hasAttribute(attribute)) {
                var translated = translateValue(element.getAttribute(attribute));
                if (translated !== element.getAttribute(attribute)) {
                    element.setAttribute(attribute, translated);
                }
            }
        });
        Array.prototype.slice.call(element.childNodes).forEach(translateNode);
    }

    function translateNode(node) {
        if (node.nodeType === 3) {
            var parent = node.parentElement;
            if (!parent || ignored[parent.tagName]) {
                return;
            }
            var translated = translateValue(node.nodeValue);
            if (translated !== node.nodeValue) {
                node.nodeValue = translated;
            }
            return;
        }
        if (node.nodeType === 1) {
            translateElement(node);
        }
    }

    function translateRoot() {
        ['zion-privacy-admin', 'zion_privacy_consent_stats'].forEach(function (id) {
            var root = document.getElementById(id);
            if (root) {
                translateElement(root);
            }
        });
    }

    translateRoot();
    new MutationObserver(function () { translateRoot(); }).observe(document.body, { childList: true, subtree: true });
}());
