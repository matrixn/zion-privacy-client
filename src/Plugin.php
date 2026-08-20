<?php

namespace ZionPrivacy;

use ZionPrivacy\Admin\AdminMenu;
use ZionPrivacy\Admin\DashboardWidget;
use ZionPrivacy\Api\ApiClient;
use ZionPrivacy\Consent\ConsentEventRepository;
use ZionPrivacy\Consent\ConsentSync;
use ZionPrivacy\Frontend\ConsentBanner;
use ZionPrivacy\Http\RestController;
use ZionPrivacy\Infrastructure\CredentialVault;
use ZionPrivacy\OAuth\CallbackHandler;
use ZionPrivacy\Settings\SettingsRepository;

final class Plugin
{
    public function register(): void
    {
        $settings = new SettingsRepository(new CredentialVault());
        $api = new ApiClient($settings);
        $consents = new ConsentEventRepository();
        ConsentEventRepository::maybeInstall();

        $oauth = new CallbackHandler($settings, $api);

        (new AdminMenu($settings))->register();
        (new RestController($settings, $api, $oauth, $consents))->register();
        $oauth->register();
        (new ConsentBanner($settings, $api))->register();
        (new ConsentSync($consents, $settings, $api))->register();
        (new DashboardWidget($settings, $api))->register();
    }
}
