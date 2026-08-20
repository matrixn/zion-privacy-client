<?php

namespace ZionPrivacy;

use ZionPrivacy\Admin\AdminMenu;
use ZionPrivacy\Api\ApiClient;
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

        $oauth = new CallbackHandler($settings, $api);

        (new AdminMenu($settings))->register();
        (new RestController($settings, $api, $oauth))->register();
        $oauth->register();
        (new ConsentBanner($settings, $api))->register();
    }
}
