<?php

namespace ZionPrivacy\Consent;

use ZionPrivacy\Api\ApiClient;
use ZionPrivacy\Settings\SettingsRepository;

final class ConsentSync
{
    private const HOOK = 'zion_privacy_sync_consent_events';

    public function __construct(
        private readonly ConsentEventRepository $events,
        private readonly SettingsRepository $settings,
        private readonly ApiClient $api,
    ) {}

    public function register(): void
    {
        add_filter('cron_schedules', [$this, 'schedules']);
        add_action(self::HOOK, [$this, 'sync']);

        if (! wp_next_scheduled(self::HOOK)) {
            wp_schedule_event(time() + 120, 'zion_privacy_15min', self::HOOK);
        }
    }

    public static function deactivate(): void
    {
        $timestamp = wp_next_scheduled(self::HOOK);
        if ($timestamp) {
            wp_unschedule_event($timestamp, self::HOOK);
        }
    }

    public function schedules(array $schedules): array
    {
        $schedules['zion_privacy_15min'] = [
            'interval' => 15 * MINUTE_IN_SECONDS,
            'display' => 'Every 15 minutes (Zion Privacy consent sync)',
        ];

        return $schedules;
    }

    public function sync(): void
    {
        if (! $this->settings->consentTrackingEnabled() || ! $this->settings->isConnected()) {
            return;
        }

        $events = $this->events->pending();
        if ($events === []) {
            return;
        }

        $response = $this->api->post('installation/consents', ['events' => $events]);
        if (is_wp_error($response)) {
            return;
        }

        $this->events->markSynced(array_column($events, 'event_uuid'));
    }
}
