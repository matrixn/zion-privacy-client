<?php

namespace ZionPrivacy\Consent;

final class ConsentEventRepository
{
    private const DB_VERSION = '2';

    public static function install(): void
    {
        global $wpdb;

        require_once ABSPATH.'wp-admin/includes/upgrade.php';

        $table = self::table();
        $charset = $wpdb->get_charset_collate();
        dbDelta("CREATE TABLE {$table} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_uuid char(36) NOT NULL,
            consent_status varchar(32) NOT NULL,
            visitor_token varchar(255) NULL,
            regulation varchar(32) NOT NULL DEFAULT 'gdpr',
            categories longtext NULL,
            page_url text NULL,
            occurred_at datetime NOT NULL,
            synced_at datetime NULL,
            created_at datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY event_uuid (event_uuid),
            KEY synced_at (synced_at),
            KEY occurred_at (occurred_at)
        ) {$charset};");

        update_option('zion_privacy_consent_db_version', self::DB_VERSION, false);
    }

    public static function maybeInstall(): void
    {
        if ((string) get_option('zion_privacy_consent_db_version', '') !== self::DB_VERSION) {
            self::install();
        }
    }

    public static function table(): string
    {
        global $wpdb;

        return $wpdb->prefix.'zion_privacy_consents';
    }

    public function record(array $event): bool
    {
        global $wpdb;

        $status = sanitize_key((string) ($event['status'] ?? ''));
        if (! in_array($status, ['viewed', 'accepted', 'rejected', 'partially_accepted'], true)) {
            return false;
        }

        $eventUuid = sanitize_text_field((string) ($event['event_uuid'] ?? ''));
        if (! preg_match('/^[0-9a-f-]{36}$/i', $eventUuid)) {
            $eventUuid = wp_generate_uuid4();
        }

        $categories = is_array($event['categories'] ?? null) ? array_map('boolval', $event['categories']) : [];
        $visitorToken = sanitize_text_field((string) ($event['visitor_token'] ?? ''));
        $regulation = sanitize_key((string) ($event['regulation'] ?? 'gdpr'));
        if (! in_array($regulation, ['gdpr', 'us_state_laws', 'gdpr_us_state_laws'], true)) {
            $regulation = 'gdpr';
        }
        $occurredAt = sanitize_text_field((string) ($event['occurred_at'] ?? ''));
        $occurredAt = $occurredAt !== '' ? gmdate('Y-m-d H:i:s', strtotime($occurredAt) ?: time()) : gmdate('Y-m-d H:i:s');
        $now = current_time('mysql', true);

        $inserted = $wpdb->insert(self::table(), [
            'event_uuid' => $eventUuid,
            'consent_status' => $status,
            'visitor_token' => $visitorToken !== '' ? $visitorToken : null,
            'regulation' => $regulation,
            'categories' => wp_json_encode($categories),
            'page_url' => esc_url_raw((string) ($event['page_url'] ?? '')),
            'occurred_at' => $occurredAt,
            'created_at' => $now,
        ], ['%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s']);

        return $inserted !== false;
    }

    public function pending(int $limit = 100): array
    {
        global $wpdb;

        $limit = max(1, min(100, $limit));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT event_uuid, consent_status, visitor_token, regulation, categories, page_url, occurred_at FROM %i WHERE synced_at IS NULL ORDER BY id ASC LIMIT %d",
            self::table(),
            $limit,
        ), ARRAY_A);

        return array_map(static function (array $row): array {
            $categories = json_decode((string) ($row['categories'] ?? ''), true);

            return [
                'event_uuid' => (string) $row['event_uuid'],
                'status' => (string) $row['consent_status'],
                'visitor_token' => (string) ($row['visitor_token'] ?? ''),
                'regulation' => (string) ($row['regulation'] ?? 'gdpr'),
                'categories' => is_array($categories) ? $categories : [],
                'page_url' => (string) ($row['page_url'] ?? ''),
                'occurred_at' => gmdate('c', strtotime((string) $row['occurred_at']) ?: time()),
            ];
        }, is_array($rows) ? $rows : []);
    }

    public function markSynced(array $eventUuids): void
    {
        global $wpdb;

        $eventUuids = array_values(array_filter(array_map('sanitize_text_field', $eventUuids)));
        if ($eventUuids === []) {
            return;
        }

        $placeholders = implode(',', array_fill(0, count($eventUuids), '%s'));
        $wpdb->query($wpdb->prepare(
            "UPDATE %i SET synced_at = %s WHERE event_uuid IN ({$placeholders})",
            array_merge([self::table(), current_time('mysql', true)], $eventUuids),
        ));
    }
}
