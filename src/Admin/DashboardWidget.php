<?php

namespace ZionPrivacy\Admin;

use ZionPrivacy\Api\ApiClient;
use ZionPrivacy\Localization\AdminLocale;
use ZionPrivacy\Settings\SettingsRepository;

final class DashboardWidget
{
    private const WIDGET_OPTIONS = 'zion_privacy_dashboard_widget_options';
    private const FEATURES = [
        'overview' => 'Consent overview',
        'comparison' => 'Visitor comparison',
        'insights' => 'Smart insights',
        'categories' => 'Category impact',
    ];

    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly ApiClient $api,
    ) {}

    public function register(): void
    {
        add_action('wp_dashboard_setup', [$this, 'addWidget']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue']);
        add_action('wp_ajax_zion_privacy_save_dashboard_widget_options', [$this, 'saveWidgetOptions']);
    }

    public function addWidget(): void
    {
        if (current_user_can('manage_options')) {
            wp_add_dashboard_widget('zion_privacy_consent_stats', 'Zion Privacy — Consent intelligence', [$this, 'render']);
        }
    }

    public function enqueue(string $hook): void
    {
        if ($hook !== 'index.php') {
            return;
        }

        wp_enqueue_style('zion-privacy-dashboard', ZION_PRIVACY_URL.'assets/dashboard.css', [], ZION_PRIVACY_VERSION);
        wp_enqueue_script('zion-privacy-dashboard', ZION_PRIVACY_URL.'assets/dashboard.js', [], ZION_PRIVACY_VERSION, true);
        wp_enqueue_script('zion-privacy-admin-locale', ZION_PRIVACY_URL.'assets/admin-i18n.js', [], ZION_PRIVACY_VERSION, true);
        wp_localize_script('zion-privacy-dashboard', 'zionPrivacyDashboard', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('zion_privacy_dashboard_options'),
        ]);
        wp_localize_script('zion-privacy-admin-locale', 'ZionPrivacyAdmin', ['locale' => AdminLocale::locale()]);
        wp_localize_script('zion-privacy-admin-locale', 'ZionPrivacyAdminTranslations', AdminLocale::translations());
    }

    public function saveWidgetOptions(): void
    {
        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'You are not allowed to change dashboard widget settings.'], 403);
        }

        check_ajax_referer('zion_privacy_dashboard_options', 'nonce');
        $submitted = isset($_POST['features']) && is_array($_POST['features'])
            ? array_map('sanitize_key', wp_unslash($_POST['features']))
            : [];
        $options = [];

        foreach (array_keys(self::FEATURES) as $feature) {
            $options[$feature] = in_array($feature, $submitted, true);
        }

        update_option(self::WIDGET_OPTIONS, $options, false);
        wp_send_json_success(['message' => 'Dashboard widget layout saved.']);
    }

    public function render(): void
    {
        if (! $this->settings->isConnected()) {
            echo '<p class="zion-privacy-dashboard-empty">Connect this website to Zion Privacy to see consent intelligence.</p>';
            return;
        }

        $response = $this->api->get('installation/consent-statistics', ['days' => 30]);
        if (is_wp_error($response)) {
            echo '<p class="zion-privacy-dashboard-empty">Consent statistics are temporarily unavailable.</p>';
            return;
        }

        $options = $this->widgetOptions();
        $totals = (array) ($response['totals'] ?? []);
        $total = max(0, (int) ($totals['total'] ?? 0));
        $accepted = max(0, (int) ($totals['accepted'] ?? 0));
        $rejected = max(0, (int) ($totals['rejected'] ?? 0));
        $partial = max(0, (int) ($totals['partially_accepted'] ?? 0));
        $period = sprintf('Last %d days', (int) ($response['days'] ?? 30));

        echo '<section class="zion-privacy-dashboard-card">';
        echo '<header class="zion-privacy-dashboard-card__header"><div><span class="zion-privacy-dashboard-eyebrow">Consent intelligence</span><h3>Understand every visitor choice</h3><p>See how visitors respond to your privacy experience and which categories matter most.</p></div><span class="zion-privacy-dashboard-period">'.esc_html($period).'</span></header>';

        if ($options['overview']) {
            $this->renderOverview($total, $accepted, $rejected, $partial);
        }
        if ($options['comparison']) {
            $this->renderComparison((array) ($response['visitor_comparison'] ?? []), $total);
        }
        if ($options['insights'] || $options['categories']) {
            $visiblePanels = (int) $options['insights'] + (int) $options['categories'];
            $gridClass = $visiblePanels === 1 ? ' is-single' : '';
            echo '<div class="zion-privacy-dashboard-grid'.esc_attr($gridClass).'">';
            if ($options['insights']) {
                $this->renderInsights($response, $total, $accepted, $rejected, $partial);
            }
            if ($options['categories']) {
                $this->renderCategories((array) ($response['category_breakdown']['categories'] ?? []));
            }
            echo '</div>';
        }
        $this->renderSettings($options);
        echo '</section>';
    }

    private function renderOverview(int $total, int $accepted, int $rejected, int $partial): void
    {
        $acceptedDegrees = $total > 0 ? round(($accepted / $total) * 360, 2) : 0;
        $rejectedDegrees = $total > 0 ? round(($rejected / $total) * 360, 2) : 0;
        $gradient = sprintf('conic-gradient(#f28a22 0deg %1$sdeg, #e96c7d %1$sdeg %2$sdeg, #4f8fe8 %2$sdeg 360deg)', $acceptedDegrees, $acceptedDegrees + $rejectedDegrees);

        echo '<div class="zion-privacy-dashboard-overview"><div class="zion-privacy-dashboard-donut" style="--zion-consent-chart: '.esc_attr($gradient).'" role="img" aria-label="'.esc_attr(sprintf('%d total consent decisions', $total)).'"><div><strong>'.esc_html((string) $total).'</strong><span>Total decisions</span></div></div><div class="zion-privacy-dashboard-decisions">';
        $this->decision('Accepted', $accepted, 'accepted', $total, 'All optional categories were allowed.');
        $this->decision('Rejected', $rejected, 'rejected', $total, 'Optional categories were declined.');
        $this->decision('Partially accepted', $partial, 'partial', $total, 'Only selected categories were allowed.');
        echo '</div></div>';
    }

    private function decision(string $label, int $value, string $class, int $total, string $description): void
    {
        $percentage = $total > 0 ? round(($value / $total) * 100) : 0;
        echo '<div class="zion-privacy-dashboard-decision"><span class="zion-privacy-dashboard-dot is-'.esc_attr($class).'"></span><div><div><strong>'.esc_html((string) $value).'</strong> '.esc_html($label).'<b>'.esc_html((string) $percentage).'%</b></div><small>'.esc_html($description).'</small></div></div>';
    }

    private function renderComparison(array $comparison, int $total): void
    {
        $visitors = max(0, (int) ($comparison['total'] ?? $comparison['unique_visitors'] ?? 0));
        $decisions = max(0, (int) ($comparison['decisions'] ?? $total));
        $undecided = max(0, (int) ($comparison['undecided'] ?? max(0, $visitors - $decisions)));

        echo '<div class="zion-privacy-dashboard-section"><div class="zion-privacy-dashboard-section__title"><div><span class="zion-privacy-dashboard-eyebrow">Visitor signal</span><h4>Visitors versus decisions</h4></div><span class="zion-privacy-dashboard-help" title="A visitor is counted once during the selected period. Decisions are recorded consent actions.">?</span></div><div class="zion-privacy-dashboard-metrics">';
        $this->metric('Unique visitors', $visitors, 'people reached your banner');
        $this->metric('Consent decisions', $decisions, 'recorded choices');
        $this->metric('Awaiting choice', $undecided, 'visitors without a decision');
        echo '</div></div>';
    }

    private function metric(string $label, int $value, string $description): void
    {
        echo '<div class="zion-privacy-dashboard-metric"><strong>'.esc_html((string) $value).'</strong><span>'.esc_html($label).'</span><small>'.esc_html($description).'</small></div>';
    }

    private function renderInsights(array $response, int $total, int $accepted, int $rejected, int $partial): void
    {
        $decisions = ['Accepted' => $accepted, 'Rejected' => $rejected, 'Partially accepted' => $partial];
        arsort($decisions);
        $dominant = (string) array_key_first($decisions);
        $dominantValue = (int) reset($decisions);
        $categories = (array) ($response['category_breakdown']['categories'] ?? []);
        $leadingCategory = 'No category data yet';
        $leadingCount = 0;

        foreach ($categories as $key => $stats) {
            $count = (int) (($stats['accepted'] ?? 0));
            if ($count > $leadingCount) {
                $leadingCategory = ucwords(str_replace(['_', '-'], ' ', (string) $key));
                $leadingCount = $count;
            }
        }

        echo '<div class="zion-privacy-dashboard-insights"><span class="zion-privacy-dashboard-eyebrow">Smart readout</span><h4>Your consent story</h4><p><strong>'.esc_html($dominant).'</strong> is the leading choice with <strong>'.esc_html((string) $dominantValue).'</strong> decisions. <strong>'.esc_html($leadingCategory).'</strong> has the highest accepted-category activity.</p><div class="zion-privacy-dashboard-insight-tags"><span>Decision pattern</span><span>Category signal</span></div></div>';
    }

    private function renderCategories(array $categories): void
    {
        $labels = ['necessary' => 'Necessary', 'preferences' => 'Preferences', 'analytics' => 'Analytics', 'marketing' => 'Marketing', 'security' => 'Security', 'personalization' => 'Personalization', 'unknown' => 'Unknown'];
        $max = 1;
        foreach ($categories as $stats) {
            $max = max($max, (int) (($stats['accepted'] ?? 0)));
        }

        echo '<div class="zion-privacy-dashboard-categories"><div class="zion-privacy-dashboard-section__title"><div><span class="zion-privacy-dashboard-eyebrow">Category impact</span><h4>What visitors allow</h4></div></div>';
        foreach ($labels as $key => $label) {
            $stats = (array) ($categories[$key] ?? []);
            $accepted = (int) ($stats['accepted'] ?? 0);
            $visitors = (int) ($stats['unique_visitors'] ?? 0);
            $width = $accepted > 0 ? max(6, round(($accepted / $max) * 100)) : 0;
            echo '<div class="zion-privacy-dashboard-category"><div><strong>'.esc_html($label).'</strong><span>'.esc_html((string) $accepted).' selections · '.esc_html((string) $visitors).' visitors</span></div><div class="zion-privacy-dashboard-progress"><span style="width: '.esc_attr((string) $width).'%"></span></div></div>';
        }
        echo '</div>';
    }

    private function renderSettings(array $options): void
    {
        echo '<details class="zion-privacy-dashboard-settings"><summary><span>Customize statistics</span><small>Choose which insights appear in this widget</small></summary><form data-zion-dashboard-widget-form><div class="zion-privacy-dashboard-settings__grid">';
        foreach (self::FEATURES as $key => $label) {
            echo '<label><input type="checkbox" name="features[]" value="'.esc_attr($key).'" '.checked($options[$key], true, false).'><span><strong>'.esc_html($label).'</strong><small>Show this section in the dashboard</small></span></label>';
        }
        echo '</div><button type="submit" class="button button-primary">Save widget layout</button><span class="zion-privacy-dashboard-settings__status" aria-live="polite"></span></form></details>';
    }

    private function widgetOptions(): array
    {
        $stored = get_option(self::WIDGET_OPTIONS, []);
        $stored = is_array($stored) ? $stored : [];
        return array_merge($this->widgetDefaults(), array_intersect_key($stored, self::FEATURES));
    }

    private function widgetDefaults(): array
    {
        return array_fill_keys(array_keys(self::FEATURES), true);
    }
}
