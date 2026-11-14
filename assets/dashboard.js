(function () {
    'use strict';

    document.addEventListener('submit', function (event) {
        var form = event.target.closest('[data-zion-dashboard-widget-form]');
        if (!form || typeof window.zionPrivacyDashboard === 'undefined') {
            return;
        }

        event.preventDefault();
        var button = form.querySelector('button[type="submit"]');
        var status = form.querySelector('.zion-privacy-dashboard-settings__status');
        var original = button.textContent;
        var data = new FormData(form);
        data.append('action', 'zion_privacy_save_dashboard_widget_options');
        data.append('nonce', window.zionPrivacyDashboard.nonce);
        button.disabled = true;
        button.textContent = 'Saving…';
        status.textContent = '';
        status.className = 'zion-privacy-dashboard-settings__status is-loading';

        fetch(window.zionPrivacyDashboard.ajaxUrl, { method: 'POST', credentials: 'same-origin', body: data })
            .then(function (response) { return response.json(); })
            .then(function (result) {
                if (!result.success) {
                    throw new Error(result.data && result.data.message ? result.data.message : 'Could not save widget settings.');
                }
                status.textContent = 'Saved. Refreshing…';
                status.className = 'zion-privacy-dashboard-settings__status is-success';
                window.setTimeout(function () { window.location.reload(); }, 450);
            })
            .catch(function (error) {
                button.disabled = false;
                button.textContent = original;
                status.textContent = error.message;
                status.className = 'zion-privacy-dashboard-settings__status is-error';
            });
    });
}());
