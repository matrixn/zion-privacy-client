<?php

namespace ZionPrivacy\Admin;

use ZionPrivacy\Api\ApiClient;
use ZionPrivacy\Settings\SettingsRepository;

final class DashboardWidget
{
    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly ApiClient $api,
    ) {}

    public function register(): void
    {
        add_action('wp_dashboard_setup', [$this, 'addWidget']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
    }

    public function addWidget(): void
    {
        if (current_user_can('manage_options')) {
            wp_add_dashboard_widget('zion_privacy_consent_stats', 'Zion Privacy — Consent trends', [$this, 'render']);
        }
    }

    public function enqueue(string $hook): void
    {
        if ($hook === 'index.php') {
            wp_enqueue_style('zion-privacy-dashboard', ZION_PRIVACY_URL.'assets/dashboard.css', [], ZION_PRIVACY_VERSION);
        }
    }

    public function render(): void
    {
        if (! $this->settings->isConnected()) {
            echo '<p class="zion-privacy-dashboard-empty">Connect this website to Zion Privacy to see consent trends.</p>';

            return;
        }

        $response = $this->api->get('installation/consent-statistics', ['days' => 30]);
        if (is_wp_error($response)) {
            echo '<p class="zion-privacy-dashboard-empty">Consent statistics are temporarily unavailable.</p>';

            return;
        }

        $totals = (array) ($response['totals'] ?? []);
        $total = max(0, (int) ($totals['total'] ?? 0));
        $accepted = (int) ($totals['accepted'] ?? 0);
        $rejected = (int) ($totals['rejected'] ?? 0);
        $partial = (int) ($totals['partially_accepted'] ?? 0);
        $acceptedDegrees = $total > 0 ? round(($accepted / $total) * 360, 2) : 0;
        $rejectedDegrees = $total > 0 ? round(($rejected / $total) * 360, 2) : 0;
        $partialDegrees = max(0, 360 - $acceptedDegrees - $rejectedDegrees);
        $gradient = sprintf(
            'conic-gradient(#9ad4c1 0deg %1$sdeg, #f39baa %1$sdeg %2$sdeg, #a8c7fb %2$sdeg %3$sdeg)',
            $acceptedDegrees,
            $acceptedDegrees + $rejectedDegrees,
            $acceptedDegrees + $rejectedDegrees + $partialDegrees,
        );
        $period = esc_html(sprintf('Last %d days', (int) ($response['days'] ?? 30)));

        echo '<div class="zion-privacy-dashboard-consent">';
        echo '<div class="zion-privacy-dashboard-consent__heading"><strong>Consent overview</strong><span>'.esc_html($period).'</span></div>';
        echo '<div class="zion-privacy-dashboard-consent__body">';
        echo '<div class="zion-privacy-dashboard-consent__chart" style="--zion-consent-chart: '.esc_attr($gradient).'"><div><strong>'.esc_html((string) $total).'</strong><span>Total consents</span></div></div>';
        echo '<div class="zion-privacy-dashboard-consent__legend">';
        $this->legend('Accepted', $accepted, 'accepted', $total);
        $this->legend('Rejected', $rejected, 'rejected', $total);
        $this->legend('Partially accepted', $partial, 'partial', $total);
        echo '</div></div></div>';
    }

    private function legend(string $label, int $value, string $class, int $total): void
    {
        $percentage = $total > 0 ? round(($value / $total) * 100) : 0;
        echo '<div class="zion-privacy-dashboard-consent__legend-item"><span class="zion-privacy-dashboard-consent__swatch is-'.esc_attr($class).'" aria-hidden="true"></span><span><strong>'.esc_html((string) $value).'</strong> '.esc_html($label).'<small>'.esc_html((string) $percentage).'%</small></span></div>';
    }
}
