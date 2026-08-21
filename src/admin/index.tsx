import { createRoot, useEffect, useState } from "@wordpress/element";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  SelectControl,
  Spinner,
  TextControl,
  TextareaControl,
  ToggleControl,
} from "@wordpress/components";

declare global {
  interface Window {
    ZionPrivacyAdmin: AdminConfig;
  }
}

type ViewKey =
  | "dashboard"
  | "scans"
  | "cookies"
  | "statistics"
  | "banner"
  | "settings";
type ToastTone = "success" | "error" | "info";
type ThemeMode = "dark" | "light";
type AdminConfig = {
  restUrl: string;
  nonce: string;
  page: string;
  connected: boolean;
  version: string;
  scanPollIntervalSeconds?: number;
  cookieCacheMinutes?: number;
  defaultScanMode?: string;
  defaultScanScenario?: string;
};
type RecordData = Record<string, any>;
type ToastData = {
  id: number;
  message: string;
  tone: ToastTone;
  progress: number;
  paused: boolean;
};
type ScanFormState = {
  mode: "manual" | "automatic";
  scenario: string;
  schedule_frequency: "daily" | "weekly" | "monthly";
  schedule_time: string;
  schedule_weekday: string;
  schedule_date: string;
};

const config = window.ZionPrivacyAdmin;
let toastSequence = 0;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(config.restUrl + path.replace(/^\//, ""), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-WP-Nonce": config.nonce,
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.message || "The WordPress API bridge returned an error.",
    );
  return data as T;
}

function announce(message: string, tone: ToastTone = "success") {
  window.dispatchEvent(
    new CustomEvent("zion-privacy:notice", { detail: { message, tone } }),
  );
}
function Header({
  title,
  subtitle,
  connected,
}: {
  title: string;
  subtitle: string;
  connected?: boolean;
}) {
  return (
    <>
      <div className="zion-admin__header">
        <div>
          <p className="zion-admin__eyebrow">Zion Privacy / Control center</p>
          <h1 className="zion-admin__title">{title}</h1>
          <p className="zion-admin__subtitle">{subtitle}</p>
        </div>
        {typeof connected === "boolean" && (
          <span
            className={`zion-admin__status ${
              connected ? "zion-admin__status--connected" : ""
            }`}
          >
            {connected ? "Connected to API" : "Not connected"}
          </span>
        )}
      </div>
      <ToastRegion />
    </>
  );
}
function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="zion-admin__metric">
      <div className="zion-admin__metric-label">{label}</div>
      <div className="zion-admin__metric-value">{value}</div>
      {note && <div className="zion-admin__metric-note">{note}</div>}
    </div>
  );
}
function CookieSummaryChart({
  categories: entries,
  total,
}: {
  categories: [string, any][];
  total: number;
}) {
  const palette = [
    "#f97316",
    "#3b82f6",
    "#f59e0b",
    "#8b5cf6",
    "#60a5fa",
    "#ea580c",
    "#64748b",
  ];
  let cursor = 0;
  const stops = entries.map(([name, value], index) => {
    const start = cursor;
    cursor += total ? (Number(value) / total) * 360 : 0;
    return `${palette[index % palette.length]} ${start.toFixed(
      2,
    )}deg ${cursor.toFixed(2)}deg`;
  });
  const chartStyle: Record<string, string> = {
    "--zion-cookie-chart": total
      ? `conic-gradient(${stops.join(", ")})`
      : "conic-gradient(#334155 0deg 360deg)",
  };
  return (
    <div className="zion-admin__cookie-summary">
      <div className="zion-admin__cookie-chart" style={chartStyle}>
        <div>
          <strong>{total}</strong>
          <span>cookies</span>
        </div>
      </div>
      <div className="zion-admin__cookie-legend">
        {entries.length ? (
          entries.map(([name, value], index) => (
            <div className="zion-admin__cookie-legend-item" key={name}>
              <span
                className="zion-admin__cookie-swatch"
                style={{ background: palette[index % palette.length] }}
              />
              <span>
                <strong>{formatLabel(name)}</strong>
                <small>
                  {value} ·{" "}
                  {total ? Math.round((Number(value) / total) * 100) : 0}%
                </small>
              </span>
            </div>
          ))
        ) : (
          <span className="zion-admin__muted">
            No cookie categories available.
          </span>
        )}
      </div>
    </div>
  );
}
function ConnectionBanner({
  connected,
  onConnect,
}: {
  connected: boolean;
  onConnect: (provider: string) => void;
}) {
  if (connected) return null;
  return (
    <div className="zion-admin__banner zion-admin__notice">
      <div>
        <h2>Connect your website to Zion Privacy</h2>
        <p>
          Unlock remote scans, cookie intelligence and privacy statistics with
          the API-owned OAuth flow.
        </p>
      </div>
      <div className="zion-admin__actions">
        <Button
          variant="primary"
          icon={<ButtonIcon name="dashicons-admin-links" />}
          onClick={() => onConnect("google")}
        >
          Connect with Google
        </Button>
      </div>
    </div>
  );
}

function ButtonIcon({ name }: { name: string }) {
  return (
    <span
      className={`zion-admin__button-icon dashicons ${name}`}
      aria-hidden="true"
    />
  );
}

function ConsentTrendChart({ totals }: { totals: RecordData }) {
  const items = [
    ["accepted", "Accepted", "#8fe3c0", "accepted"],
    ["rejected", "Rejected", "#f2a0aa", "rejected"],
    ["partially_accepted", "Partially accepted", "#81c8e8", "partial"],
  ];
  const total = items.reduce((sum, [key]) => sum + Number(totals[key] || 0), 0);
  let cursor = 0;
  const stops = items.map(([key, , color]) => {
    const start = cursor;
    cursor += total ? (Number(totals[key] || 0) / total) * 360 : 0;
    return `${color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
  });
  const style: Record<string, string> = {
    "--zion-consent-chart": total
      ? `conic-gradient(${stops.join(", ")})`
      : "conic-gradient(#334155 0deg 360deg)",
  };
  return (
    <div className="zion-admin__consent-trend">
      <div className="zion-admin__consent-donut" style={style}>
        <div>
          <strong>{total}</strong>
          <span>Total consents</span>
        </div>
      </div>
      <div className="zion-admin__consent-legend">
        {items.map(([key, label, , className]) => (
          <div className="zion-admin__consent-legend-item" key={key}>
            <span
              className={`zion-admin__consent-swatch zion-admin__consent-swatch--${className}`}
            />
            <span>
              <strong>{Number(totals[key] || 0)}</strong> {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageviewsChart({ scans }: { scans: RecordData[] }) {
  const entries = scans.slice().reverse().slice(-7);
  const max = Math.max(
    1,
    ...entries.map((scan) => Number(scan.page_count || 0)),
  );
  return (
    <div className="zion-admin__pageview-chart">
      {entries.length ? (
        entries.map((scan) => (
          <div className="zion-admin__pageview-bar" key={scan.id}>
            <span
              style={{
                height: `${Math.max(
                  4,
                  (Number(scan.page_count || 0) / max) * 100,
                )}%`,
              }}
              title={`${scan.page_count || 0} pages — ${formatLabel(
                scan.status || "unknown",
              )}`}
            />
            <small>
              {scan.finished_at ? shortDate(scan.finished_at) : "—"}
            </small>
          </div>
        ))
      ) : (
        <div className="zion-admin__empty">No pageview data available yet.</div>
      )}
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<RecordData | null>(null);
  const [settings, setSettings] = useState<RecordData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      request<RecordData>("dashboard"),
      request<RecordData>("settings"),
    ])
      .then(([dashboard, savedSettings]) => {
        setData(dashboard);
        setSettings(savedSettings);
      })
      .catch((e) => {
        setError(e.message);
        announce(e.message, "error");
      });
  }, []);
  if (error) return <PageError message={error} />;
  if (!data || !settings) return <Loading />;
  const stats = data.stats || {};
  const categories = Object.entries(stats.categories || {});
  const scans = data.scans || [];
  const account = data.account || {};
  const packageData = account.package || {};
  const usage = account.usage || {};
  const consent = data.consent || { totals: {}, recent: [] };
  const nextScan = scans
    .filter((scan: RecordData) => scan.next_run_at)
    .sort((a: RecordData, b: RecordData) =>
      String(a.next_run_at).localeCompare(String(b.next_run_at)),
    )[0];
  const previewUrl = previewUrlFor(
    String(data.website?.base_url || window.location.origin),
  );
  return (
    <>
      <Header
        title="Dashboard"
        subtitle="A clear view of your website privacy posture, scanner activity and consent readiness."
        connected={config.connected}
      />
      <ConnectionBanner connected={config.connected} onConnect={connect} />
      {data.website ? (
        <>
          <div className="zion-admin__grid">
            <Metric
              label="Total cookies"
              value={stats.total_cookies || 0}
              note="Latest completed scan"
            />
            <Metric
              label="Categories"
              value={categories.length}
              note="Cookie taxonomy"
            />
            <Metric
              label="Pages scanned"
              value={stats.pages_scanned || 0}
              note={
                data.website.last_successful_scan_at
                  ? `Last success: ${formatDate(
                      data.website.last_successful_scan_at,
                    )}`
                  : "No completed scan yet"
              }
            />
            <Metric
              label="Average scan duration"
              value={formatDuration(stats.average_duration_seconds)}
              note={`${stats.successful_scans || 0} successful scans`}
            />
          </div>
          <Card className="zion-admin__plan-card">
            <CardHeader>
              <div className="zion-admin__card-heading">
                <div>
                  <h2>{packageData.label || "Free"} plan</h2>
                  <p>
                    Your current API entitlement and usage for this WordPress
                    installation.
                  </p>
                </div>
                <span className="zion-admin__plan-badge">
                  {formatLabel(packageData.key || "free")}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="zion-admin__plan-grid">
                <div>
                  <span>Pages per scan</span>
                  <strong>{limitValue(packageData.max_pages)}</strong>
                  <small>
                    {usage.latest_scan_pages || 0} latest ·{" "}
                    {usage.pages_scanned_total || 0} total scanned
                  </small>
                </div>
                <div>
                  <span>Websites</span>
                  <strong>
                    {usage.websites_used || 0} /{" "}
                    {limitValue(packageData.max_websites)}
                  </strong>
                  <small>
                    {usage.websites_remaining === null
                      ? "No website limit"
                      : `${usage.websites_remaining || 0} remaining`}
                  </small>
                </div>
                <div>
                  <span>Websites remaining</span>
                  <strong>{limitValue(usage.websites_remaining)}</strong>
                  <small>{usage.websites_used || 0} currently used</small>
                </div>
                <div>
                  <span>Scans this month</span>
                  <strong>{usage.scans_this_month || 0}</strong>
                  <small>
                    {usage.scans_completed_this_month || 0} completed ·{" "}
                    {usage.scans_failed_this_month || 0} failed
                  </small>
                </div>
                <div>
                  <span>Scan quota</span>
                  <strong>{limitValue(usage.scan_limit)}</strong>
                  <small>
                    {usage.scans_completed || 0} completed ·{" "}
                    {usage.scans_total || 0} total executed
                  </small>
                </div>
              </div>
            </CardBody>
          </Card>
          <div className="zion-admin__grid zion-admin__grid--two">
            <Card>
              <CardHeader>
                <div className="zion-admin__card-heading">
                  <div>
                    <h2>Website connection</h2>
                    <p>
                      Authenticated website linked to this WordPress
                      installation.
                    </p>
                  </div>
                  <span
                    className={`zion-admin__website-status zion-admin__website-status--${websiteStatusClass(
                      data.website.status,
                    )}`}
                  >
                    {websiteStatusLabel(data.website.status)}
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="zion-admin__website-identity">
                  <span className="zion-admin__website-orb dashicons dashicons-admin-site-alt" />
                  <div>
                    <h3>{data.website.name}</h3>
                    <p>{data.website.base_url}</p>
                  </div>
                </div>
                <div className="zion-admin__dashboard-website-meta">
                  <div>
                    <span>Cookie banner status</span>
                    <strong
                      className={
                        settings.banner_enabled
                          ? "zion-admin__green"
                          : "zion-admin__muted"
                      }
                    >
                      {settings.banner_enabled ? "Active" : "Inactive"}
                    </strong>
                  </div>
                  <div>
                    <span>Regulation</span>
                    <strong>
                      {formatRegulation(settings.banner_regulation)}
                    </strong>
                  </div>
                  <div>
                    <span>Targeted location</span>
                    <strong>Worldwide</strong>
                  </div>
                  <div>
                    <span>Preview</span>
                    <a
                      className="zion-admin__dashboard-link"
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Live preview banner ↗
                    </a>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <div className="zion-admin__card-heading">
                  <div>
                    <h2>Cookie summary</h2>
                    <p>Distribution from the latest saved cookie inventory.</p>
                  </div>
                  <a
                    className="zion-admin__dashboard-link"
                    href="#"
                    onClick={(event) => event.preventDefault()}
                  >
                    Manage cookies ›
                  </a>
                </div>
              </CardHeader>
              <CardBody>
                <CookieSummaryChart
                  categories={categories}
                  total={Number(stats.total_cookies || 0)}
                />
                <div className="zion-admin__dashboard-website-meta">
                  <div>
                    <span>Last successful scan</span>
                    <strong>
                      {data.website.last_successful_scan_at
                        ? formatDate(data.website.last_successful_scan_at)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Pages scanned</span>
                    <strong>{stats.pages_scanned || 0}</strong>
                  </div>
                  <div>
                    <span>Next scan</span>
                    <strong>
                      {nextScan?.next_run_at
                        ? formatDate(nextScan.next_run_at)
                        : "Not scheduled"}
                    </strong>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
          <div className="zion-admin__grid zion-admin__grid--two">
            <Card className="zion-admin__dashboard-chart-card">
              <CardHeader>
                <div className="zion-admin__card-heading">
                  <h2>Consent trends</h2>
                  <span className="zion-admin__muted">Last 7 days</span>
                </div>
              </CardHeader>
              <CardBody>
                <ConsentTrendChart totals={consent.totals || {}} />
              </CardBody>
            </Card>
            <Card className="zion-admin__dashboard-chart-card">
              <CardHeader>
                <div className="zion-admin__card-heading">
                  <h2>Pageviews</h2>
                  <span className="zion-admin__muted">
                    Recent scan coverage
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                <PageviewsChart scans={scans} />
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <h2>Recent consent logs</h2>
              <p>
                Anonymous visitor decisions retained for audit and trend
                analysis.
              </p>
            </CardHeader>
            <CardBody>
              <div className="zion-admin__table-wrap">
                <table className="zion-admin__table zion-admin__consent-log-table">
                  <thead>
                    <tr>
                      <th>Consent ID</th>
                      <th>Consent status</th>
                      <th>Regulation</th>
                      <th>Date / time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(consent.recent || []).length ? (
                      (consent.recent || []).map(
                        (event: RecordData, index: number) => (
                          <tr
                            key={`${event.visitor}-${event.occurred_at}-${index}`}
                          >
                            <td>
                              <code>
                                {event.visitor || "Anonymous visitor"}
                              </code>
                            </td>
                            <td>
                              <span
                                className={`zion-admin__consent-status zion-admin__consent-status--${
                                  event.status || "unknown"
                                }`}
                              >
                                {formatLabel(event.status || "unknown")}
                              </span>
                            </td>
                            <td>{formatRegulation(event.regulation)}</td>
                            <td className="zion-admin__muted">
                              {formatDate(event.occurred_at)}
                            </td>
                          </tr>
                        ),
                      )
                    ) : (
                      <tr>
                        <td colSpan={4}>
                          <div className="zion-admin__empty">
                            No consent events recorded yet.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <h2>Recent scans</h2>
              <p>Live results are loaded from the Zion Privacy API.</p>
            </CardHeader>
            <CardBody>
              <ScanTable scans={scans.slice(0, 7)} />
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardBody>
            <div className="zion-admin__empty">
              {config.connected
                ? "The account is connected, but no website has been registered yet."
                : "Connect this WordPress website to load its existing scans, cookies and privacy statistics."}
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Scans() {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [modalScan, setModalScan] = useState<RecordData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const load = (clear = false) => {
    setError("");
    if (clear) {
      setRefreshing(true);
      setData((current) => (current ? { ...current, data: [] } : current));
    }
    request<RecordData>("scans")
      .then(setData)
      .catch((e) => {
        setError(e.message);
        announce(e.message, "error");
      })
      .finally(() => setRefreshing(false));
  };
  useEffect(load, []);
  useEffect(() => {
    if (!data?.data?.some((scan: RecordData) => isActiveScan(scan.status)))
      return undefined;
    const timer = window.setInterval(
      () => {
        request<RecordData>("scans")
          .then(setData)
          .catch(() => undefined);
      },
      Math.max(1, Number(config.scanPollIntervalSeconds || 3)) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [data]);
  if (error) return <PageError message={error} />;
  if (!data) return <Loading />;
  const website = data.website;
  const scans = data.data || [];
  const hasLiveScans = scans.some((scan: RecordData) =>
    isActiveScan(scan.status),
  );
  const close = () => {
    setModalOpen(false);
    setModalScan(null);
  };
  return (
    <>
      <Header
        title="Scans"
        subtitle="Create, schedule, review and control scans for this WordPress website without leaving the page."
        connected={config.connected}
      />
      <ConnectionBanner connected={config.connected} onConnect={connect} />
      {website ? (
        <Card>
          <CardHeader>
            <div className="zion-admin__card-heading">
              <div>
                <h2>
                  Scan history{" "}
                  {hasLiveScans && (
                    <span className="zion-admin__live-indicator">
                      <span />
                      Live updates
                    </span>
                  )}
                </h2>
                <p>
                  {website.name} · {scans.length} scans available · pages and
                  cookies refresh every 3 seconds while active
                </p>
                <div className="zion-admin__scan-timestamps">
                  <span>
                    <small>Last scan</small>
                    <strong>
                      {formatOptionalDate(website.last_scanned_at)}
                    </strong>
                  </span>
                  <span>
                    <small>Last successful</small>
                    <strong>
                      {formatOptionalDate(website.last_successful_scan_at)}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="zion-admin__actions">
                <Button
                  variant="primary"
                  icon={<ButtonIcon name="dashicons-plus-alt2" />}
                  onClick={() => {
                    setModalScan(null);
                    setModalOpen(true);
                  }}
                >
                  Create scan
                </Button>
                <Button
                  variant="secondary"
                  icon={<ButtonIcon name="dashicons-update" />}
                  onClick={() => load(true)}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing…" : "Refresh scans"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <ScanTable
              scans={scans}
              websiteId={website.id}
              onEdit={(scan) => {
                setModalScan(scan);
                setModalOpen(true);
              }}
              onRun={async (scan) => {
                if (isActiveScan(scan.status)) {
                  if (
                    !window.confirm(
                      "Stop this scan? Partial results will be retained.",
                    )
                  )
                    return;
                  try {
                    await request(`scans/${encodeURIComponent(scan.id)}/stop`, {
                      method: "POST",
                    });
                    announce("Scan stop requested.");
                    load();
                  } catch (e: any) {
                    announce(e.message, "error");
                  }
                  return;
                }
                if (!window.confirm("Run this scan now?")) return;
                try {
                  await request(`scans/${encodeURIComponent(scan.id)}/run`, {
                    method: "POST",
                  });
                  announce("Scan queued in Horizon.");
                  load();
                } catch (e: any) {
                  announce(e.message, "error");
                }
              }}
              onDelete={async (scan) => {
                if (!window.confirm("Delete this scan? This cannot be undone."))
                  return;
                try {
                  await request(
                    `websites/${encodeURIComponent(
                      website.id,
                    )}/scans/${encodeURIComponent(scan.id)}`,
                    { method: "DELETE" },
                  );
                  announce("Scan deleted.");
                  load();
                } catch (e: any) {
                  announce(e.message, "error");
                }
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <div className="zion-admin__empty">
              {config.connected
                ? "No website is linked to this WordPress installation yet."
                : "Connect this website to load its scan history."}
            </div>
          </CardBody>
        </Card>
      )}
      {modalOpen && (
        <ScanModal
          websiteId={website.id}
          scan={modalScan || undefined}
          onClose={close}
          onSaved={() => {
            close();
            load();
          }}
        />
      )}
    </>
  );
}

function ScanModal({
  websiteId,
  scan,
  onClose,
  onSaved,
}: {
  websiteId: string;
  scan?: RecordData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ScanFormState>(() => scanForm(scan));
  const [saving, setSaving] = useState(false);
  const automatic = form.mode === "automatic";
  const change = (key: keyof ScanFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const body: RecordData = { mode: form.mode, scenario: form.scenario };
    if (automatic) {
      body.schedule_frequency = form.schedule_frequency;
      body.schedule_time = form.schedule_time;
      if (form.schedule_frequency === "weekly")
        body.schedule_weekday = Number(form.schedule_weekday);
      if (form.schedule_frequency === "monthly")
        body.schedule_date = form.schedule_date;
    }
    try {
      const path = scan
        ? `websites/${encodeURIComponent(websiteId)}/scans/${encodeURIComponent(
            scan.id,
          )}`
        : `websites/${encodeURIComponent(websiteId)}/scans`;
      await request(path, {
        method: scan ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      announce(scan ? "Scan updated." : "Scan created and queued.");
      onSaved();
    } catch (e: any) {
      announce(e.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="zion-admin__modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="zion-admin__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zion-scan-modal-title"
      >
        <div className="zion-admin__modal-header">
          <div>
            <p className="zion-admin__eyebrow">Scanner configuration</p>
            <h2 id="zion-scan-modal-title">
              {scan ? "Edit scan" : "Create scan"}
            </h2>
          </div>
          <button
            type="button"
            className="zion-admin__modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form className="zion-admin__modal-form" onSubmit={submit}>
          <div className="zion-admin__modal-field">
            <label htmlFor="scan-mode">Run mode</label>
            <select
              id="scan-mode"
              className="zion-admin__modal-input"
              value={form.mode}
              onChange={(event) => change("mode", event.target.value)}
            >
              <option value="manual">Manual scan</option>
              <option value="automatic">Automatic recurring scan</option>
            </select>
            <small>
              Automatic scans are dispatched by Laravel Scheduler and Horizon.
            </small>
          </div>
          <div className="zion-admin__modal-field">
            <label htmlFor="scan-scenario">Scenario</label>
            <select
              id="scan-scenario"
              className="zion-admin__modal-input"
              value={form.scenario}
              onChange={(event) => change("scenario", event.target.value)}
            >
              <option value="pre_consent">Pre-consent</option>
              <option value="reject_all">Reject all</option>
              <option value="accept_all">Accept all</option>
            </select>
          </div>
          {automatic && (
            <>
              <div className="zion-admin__modal-field">
                <label htmlFor="scan-frequency">Frequency</label>
                <select
                  id="scan-frequency"
                  className="zion-admin__modal-input"
                  value={form.schedule_frequency}
                  onChange={(event) =>
                    change("schedule_frequency", event.target.value)
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {form.schedule_frequency !== "monthly" && (
                <div className="zion-admin__modal-field">
                  <label htmlFor="scan-time">Time (24-hour)</label>
                  <input
                    id="scan-time"
                    className="zion-admin__modal-input"
                    type="time"
                    value={form.schedule_time}
                    required
                    onChange={(event) =>
                      change("schedule_time", event.target.value)
                    }
                  />
                </div>
              )}
              {form.schedule_frequency === "weekly" && (
                <div className="zion-admin__modal-field">
                  <label htmlFor="scan-weekday">Weekday</label>
                  <select
                    id="scan-weekday"
                    className="zion-admin__modal-input"
                    value={form.schedule_weekday}
                    onChange={(event) =>
                      change("schedule_weekday", event.target.value)
                    }
                  >
                    {weekdays.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {form.schedule_frequency === "monthly" && (
                <div className="zion-admin__modal-field">
                  <label htmlFor="scan-date">Monthly date</label>
                  <input
                    id="scan-date"
                    className="zion-admin__modal-input"
                    type="date"
                    min={todayIso()}
                    max={yearFromNowIso()}
                    value={form.schedule_date}
                    required
                    onChange={(event) =>
                      change("schedule_date", event.target.value)
                    }
                  />
                  <small>
                    Only the selected day is used. Day 31 runs on the last valid
                    day of February or a 30-day month.
                  </small>
                </div>
              )}
            </>
          )}
          <div className="zion-admin__modal-footer">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : scan ? "Save changes" : "Create scan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BannerPage() {
  const [settings, setSettings] = useState<RecordData | null>(null);
  const [cookies, setCookies] = useState<RecordData[]>([]);
  const [pages, setPages] = useState<RecordData[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    request<RecordData>("settings")
      .then(setSettings)
      .catch((e) => {
        setError(e.message);
        announce(e.message, "error");
      });
    request<{ data: RecordData[] }>("cookies")
      .then((result) => setCookies(result.data || []))
      .catch(() => setCookies([]));
    request<{ data: RecordData[] }>("settings/pages")
      .then((result) => setPages(result.data || []))
      .catch(() => setPages([]));
  }, []);

  if (error) return <PageError message={error} />;
  if (!settings) return <Loading />;

  const pageOptions = [
    { label: "Select a WordPress page", value: "0" },
    ...pages.map((page) => ({
      label: `${page.title}${page.status !== "publish" ? ` (${page.status})` : ""}`,
      value: String(page.id),
    })),
  ];

  const update = (values: RecordData) =>
    setSettings((current) => ({ ...(current || {}), ...values }));
  const save = () => {
    setSaving(true);
    request<RecordData>("settings", {
      method: "POST",
      body: JSON.stringify(settings),
    })
      .then(setSettings)
      .then(() => announce("Consent banner settings saved."))
      .catch((e) => announce(e.message, "error"))
      .finally(() => setSaving(false));
  };
  const reset = () => {
    if (
      !window.confirm(
        "Reset all consent banner settings to their default values?",
      )
    )
      return;
    setResetting(true);
    request<RecordData>("settings/reset-banner", { method: "POST" })
      .then(setSettings)
      .then(() => announce("Consent banner design reset to defaults."))
      .catch((e) => announce(e.message, "error"))
      .finally(() => setResetting(false));
  };
  const renew = () => {
    if (
      !window.confirm(
        "Show the consent banner again to visitors who already made a choice? Existing consent history will be preserved.",
      )
    )
      return;
    setRenewing(true);
    request<RecordData>("settings/renew-consents", { method: "POST" })
      .then(setSettings)
      .then(() =>
        announce(
          "Consent renewal enabled. The banner will reappear for existing visitors.",
        ),
      )
      .catch((e) => announce(e.message, "error"))
      .finally(() => setRenewing(false));
  };

  return (
    <>
      <Header
        title="Consent banner"
        subtitle="Design the visitor experience with precise control over behavior, content, buttons, colors and cookie preferences."
        connected={settings.connected}
      />
      <div className="zion-admin__banner-layout">
        <Card className="zion-admin__banner-settings-card">
          <CardHeader>
            <div className="zion-admin__card-heading">
              <div>
                <h2>Banner settings</h2>
                <p>
                  Every change appears in the preview immediately. Use the
                  grouped sections to keep the configuration easy to maintain.
                </p>
              </div>
              <span className="zion-admin__preview-label">Design studio</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="zion-admin__banner-settings">
              <BannerAccordion
                title="Consent settings"
                description="Choose the privacy framework and manage anonymous consent records."
                icon="⚖"
                open
              >
                <div className="zion-admin__form">
                  <SelectControl
                    label="Regulation"
                    value={settings.banner_regulation || "gdpr"}
                    options={[
                      { label: "GDPR", value: "gdpr" },
                      { label: "US State Laws", value: "us_state_laws" },
                      {
                        label: "GDPR + US State Laws",
                        value: "gdpr_us_state_laws",
                      },
                    ]}
                    onChange={(value) => update({ banner_regulation: value })}
                  />
                  <div className="zion-admin__field zion-admin__field--full">
                    <div className="zion-admin__help-label">
                      Consent log{" "}
                      <span title="Keeping a record of your visitor consents can be essential for audit purposes">
                        ?
                      </span>
                    </div>
                    <ToggleControl
                      label="Store anonymous visitor consent choices"
                      checked={settings.consent_tracking_enabled !== false}
                      onChange={(value) =>
                        update({ consent_tracking_enabled: value })
                      }
                    />
                    <small>
                      Only a one-way anonymous visitor identifier, consent
                      status, selected categories and timestamp are retained.
                      No name, email or IP address is stored.
                    </small>
                  </div>
                  <div className="zion-admin__field zion-admin__field--full">
                    <div className="zion-admin__help-label">
                      Renew user consents{" "}
                      <span title="If you make any changes to how your website collects data, such as manually adding cookies or updating your cookie policy or banner message, we recommend that you renew your existing user consents. This action will trigger the cookie banner to reappear for all existing users who have already given consent.">
                        ?
                      </span>
                    </div>
                    <p className="zion-admin__renew-note">
                      Renewing increments the consent policy version. Existing
                      approvals and the audit history are preserved, while the
                      banner appears again for returning visitors.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={renew}
                      disabled={renewing}
                    >
                      {renewing ? "Renewing…" : "Renew user consents"}
                    </Button>
                  </div>
                </div>
              </BannerAccordion>
              <BannerAccordion
                title="Behavior and layout"
                description="Control when the banner appears and where it sits on the screen."
                icon="◈"
                open
              >
                <div className="zion-admin__form">
                  <div className="zion-admin__field zion-admin__field--full">
                    <ToggleControl
                      label="Enable consent banner"
                      checked={!!settings.banner_enabled}
                      onChange={(value) => update({ banner_enabled: value })}
                    />
                  </div>
                  <SelectControl
                    label="Banner position"
                    value={settings.banner_position || "bottom"}
                    options={[
                      { label: "Bottom — full width", value: "bottom" },
                      { label: "Top — full width", value: "top" },
                      {
                        label: "Bottom right — compact",
                        value: "bottom_right",
                      },
                      { label: "Bottom left — compact", value: "bottom_left" },
                      { label: "Centered dialog", value: "center" },
                    ]}
                    onChange={(value) => update({ banner_position: value })}
                  />
                  <NumberControl
                    label="Maximum width (px)"
                    value={settings.banner_width || 1180}
                    min={520}
                    max={1400}
                    onChange={(value) => update({ banner_width: value })}
                  />
                  <NumberControl
                    label="Corner radius (px)"
                    value={settings.banner_radius || 12}
                    min={0}
                    max={32}
                    onChange={(value) => update({ banner_radius: value })}
                  />
                  <div className="zion-admin__field zion-admin__field--full">
                    <ToggleControl
                      label="Use elevated shadow"
                      checked={settings.banner_shadow !== false}
                      onChange={(value) => update({ banner_shadow: value })}
                    />
                  </div>
                </div>
              </BannerAccordion>
              <BannerAccordion
                title="Content and legal links"
                description="Write the visitor message and optionally show links to your legal pages."
                icon="✦"
              >
                <div className="zion-admin__form">
                  <TextControl
                    label="Banner title"
                    value={settings.banner_title || ""}
                    onChange={(value) => update({ banner_title: value })}
                  />
                  <TextareaControl
                    label="Banner message"
                    value={settings.banner_message || ""}
                    onChange={(value) => update({ banner_message: value })}
                  />
                  <TextControl
                    label="Selector title"
                    value={settings.banner_selector_title || ""}
                    onChange={(value) =>
                      update({ banner_selector_title: value })
                    }
                  />
                  <TextareaControl
                    label="Selector introduction"
                    value={settings.banner_selector_message || ""}
                    onChange={(value) =>
                      update({ banner_selector_message: value })
                    }
                  />
                  <PolicyLinkSettings
                    title="Privacy policy"
                    enabled={settings.banner_show_privacy_policy_link !== false}
                    pageId={settings.banner_privacy_policy_page_id || 0}
                    label={settings.banner_privacy_policy_link_label || "Privacy policy"}
                    pageOptions={pageOptions}
                    onChange={(values) => update(values)}
                    description="Link visitors to the privacy policy page selected below."
                  />
                  <PolicyLinkSettings
                    title="Terms and Conditions"
                    enabled={!!settings.banner_show_terms_link}
                    pageId={settings.banner_terms_page_id || 0}
                    label={settings.banner_terms_link_label || "Terms and Conditions"}
                    pageOptions={pageOptions}
                    onChange={(values) => update(values)}
                    description="Add the terms page to the legal links shown in the banner."
                  />
                  <PolicyLinkSettings
                    title="Cookie policy"
                    enabled={!!settings.banner_show_cookie_policy_link}
                    pageId={settings.banner_cookie_policy_page_id || 0}
                    label={settings.banner_cookie_policy_link_label || "Cookie policy"}
                    pageOptions={pageOptions}
                    onChange={(values) => update(values)}
                    description="Add the cookie policy page to the legal links shown in the banner."
                  />
                </div>
              </BannerAccordion>
              <BannerAccordion
                title="Buttons and actions"
                description="Choose the labels visitors use to accept, reject or customize their consent."
                icon="➜"
              >
                <div className="zion-admin__form">
                  <TextControl
                    label="Accept all button"
                    value={settings.banner_accept_label || ""}
                    onChange={(value) => update({ banner_accept_label: value })}
                  />
                  <TextControl
                    label="Essential only button"
                    value={settings.banner_reject_label || ""}
                    onChange={(value) => update({ banner_reject_label: value })}
                  />
                  <TextControl
                    label="Customize button"
                    value={settings.banner_customize_label || ""}
                    onChange={(value) =>
                      update({ banner_customize_label: value })
                    }
                  />
                  <TextControl
                    label="Save preferences button"
                    value={settings.banner_save_label || ""}
                    onChange={(value) => update({ banner_save_label: value })}
                  />
                  <div className="zion-admin__field zion-admin__field--full">
                    <ToggleControl
                      label="Show Customize button"
                      checked={settings.banner_show_customize !== false}
                      onChange={(value) =>
                        update({ banner_show_customize: value })
                      }
                    />
                    <small>
                      When disabled, visitors can still choose Essential only or
                      Accept all, but the category selector is not opened from
                      the banner.
                    </small>
                  </div>
                </div>
              </BannerAccordion>
              <BannerAccordion
                title="Cookie selector"
                description="Decide how much cookie information is shown inside the Customize dialog."
                icon="◌"
              >
                <div className="zion-admin__form">
                  <div className="zion-admin__field zion-admin__field--full">
                    <ToggleControl
                      label="Show cookie details"
                      checked={settings.banner_show_cookie_details !== false}
                      onChange={(value) =>
                        update({ banner_show_cookie_details: value })
                      }
                    />
                    <ToggleControl
                      label="Show cookie counts per category"
                      checked={settings.banner_show_category_counts !== false}
                      onChange={(value) =>
                        update({ banner_show_category_counts: value })
                      }
                    />
                    <small>
                      Category switches always remain available for the consent
                      decision; these settings only control the explanatory
                      content.
                    </small>
                  </div>
                </div>
              </BannerAccordion>
              <BannerAccordion
                title="Colors and typography"
                description="Match the banner to the visual identity of the website."
                icon="◉"
              >
                <div className="zion-admin__form">
                  <ColorControl
                    label="Banner background"
                    value={settings.banner_background_color || "#ffffff"}
                    onChange={(value) =>
                      update({ banner_background_color: value })
                    }
                  />
                  <ColorControl
                    label="Main text"
                    value={settings.banner_text_color || "#183153"}
                    onChange={(value) => update({ banner_text_color: value })}
                  />
                  <ColorControl
                    label="Muted text"
                    value={settings.banner_muted_color || "#52657c"}
                    onChange={(value) => update({ banner_muted_color: value })}
                  />
                  <ColorControl
                    label="Primary button"
                    value={settings.banner_primary_color || "#2369d1"}
                    onChange={(value) =>
                      update({ banner_primary_color: value })
                    }
                  />
                  <ColorControl
                    label="Primary button text"
                    value={settings.banner_primary_text_color || "#ffffff"}
                    onChange={(value) =>
                      update({ banner_primary_text_color: value })
                    }
                  />
                  <ColorControl
                    label="Secondary button"
                    value={settings.banner_secondary_color || "#f1f6fc"}
                    onChange={(value) =>
                      update({ banner_secondary_color: value })
                    }
                  />
                  <ColorControl
                    label="Secondary button text"
                    value={settings.banner_secondary_text_color || "#1e477c"}
                    onChange={(value) =>
                      update({ banner_secondary_text_color: value })
                    }
                  />
                  <ColorControl
                    label="Border"
                    value={settings.banner_border_color || "#dce5f0"}
                    onChange={(value) => update({ banner_border_color: value })}
                  />
                  <NumberControl
                    label="Base font size (px)"
                    value={settings.banner_font_size || 14}
                    min={12}
                    max={20}
                    onChange={(value) => update({ banner_font_size: value })}
                  />
                  <div className="zion-admin__field zion-admin__field--full">
                    <ToggleControl
                      label="Use website font"
                      checked={settings.banner_use_site_font !== false}
                      onChange={(value) =>
                        update({ banner_use_site_font: value })
                      }
                    />
                    <small>
                      When enabled, the isolated banner inherits the active
                      theme font. Disable it to use a neutral system font.
                    </small>
                  </div>
                </div>
              </BannerAccordion>
              <BannerAccordion
                title="Button hover animations"
                description="Give the consent actions a subtle interaction without changing their default appearance."
                icon="✧"
              >
                <div className="zion-admin__form">
                  <div className="zion-admin__field zion-admin__field--full">
                    <ToggleControl
                      label="Enable button hover animations"
                      checked={settings.banner_button_hover_enabled !== false}
                      onChange={(value) =>
                        update({ banner_button_hover_enabled: value })
                      }
                    />
                    <small>
                      Applies to the main banner buttons and the buttons inside
                      the cookie preferences modal.
                    </small>
                  </div>
                  <SelectControl
                    label="Hover effect"
                    value={settings.banner_button_hover_effect || "lift_glow"}
                    options={[
                      { label: "Lift + glow", value: "lift_glow" },
                      { label: "Lift", value: "lift" },
                      { label: "Glow", value: "glow" },
                      { label: "None", value: "none" },
                    ]}
                    onChange={(value) =>
                      update({ banner_button_hover_effect: value })
                    }
                  />
                  <NumberControl
                    label="Animation duration (ms)"
                    value={settings.banner_button_hover_duration || 180}
                    min={100}
                    max={500}
                    onChange={(value) =>
                      update({ banner_button_hover_duration: value })
                    }
                  />
                  <NumberControl
                    label="Hover scale (%)"
                    value={settings.banner_button_hover_scale || 102}
                    min={100}
                    max={106}
                    onChange={(value) =>
                      update({ banner_button_hover_scale: value })
                    }
                  />
                </div>
              </BannerAccordion>
            </div>
            <div className="zion-admin__actions zion-admin__banner-form-actions">
              <Button
                variant="secondary"
                onClick={reset}
                disabled={saving || resetting}
              >
                {resetting ? "Resetting…" : "Reset design"}
              </Button>
              <Button
                variant="primary"
                onClick={save}
                disabled={saving || resetting}
              >
                {saving ? "Saving…" : "Save banner settings"}
              </Button>
            </div>
          </CardBody>
        </Card>
        <div className="zion-admin__preview-sticky">
          <Card className="zion-admin__preview-card">
            <CardHeader>
              <div className="zion-admin__card-heading">
                <div>
                  <h2>Live preview</h2>
                  <p>
                    Preview the banner and open Customize to see the configured
                    category selector.
                  </p>
                </div>
                <span className="zion-admin__preview-label">Live</span>
              </div>
            </CardHeader>
            <CardBody>
              <BannerPreview settings={settings} cookies={cookies} pages={pages} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function BannerAccordion({
  title,
  description,
  icon,
  open,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="zion-admin__banner-accordion" open={open}>
      <summary>
        <span className="zion-admin__banner-accordion-icon">{icon}</span>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span className="zion-admin__banner-accordion-chevron">⌄</span>
      </summary>
      <div className="zion-admin__banner-accordion-body">{children}</div>
    </details>
  );
}

function PolicyLinkSettings({
  title,
  description,
  enabled,
  pageId,
  label,
  pageOptions,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  pageId: number;
  label: string;
  pageOptions: { label: string; value: string }[];
  onChange: (values: RecordData) => void;
}) {
  return (
    <div className="zion-admin__field zion-admin__field--full zion-admin__policy-link-settings">
      <div className="zion-admin__policy-link-heading">
        <div>
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
        <ToggleControl
          label={`Show ${title.toLowerCase()} link`}
          checked={enabled}
          onChange={(value) => {
            const key = title === "Privacy policy"
              ? "banner_show_privacy_policy_link"
              : title === "Terms and Conditions"
                ? "banner_show_terms_link"
                : "banner_show_cookie_policy_link";
            onChange({ [key]: value });
          }}
        />
      </div>
      {enabled && (
        <div className="zion-admin__policy-link-fields">
          <SelectControl
            label={`${title} page`}
            value={String(pageId || 0)}
            options={pageOptions}
            onChange={(value) => {
              const key = title === "Privacy policy"
                ? "banner_privacy_policy_page_id"
                : title === "Terms and Conditions"
                  ? "banner_terms_page_id"
                  : "banner_cookie_policy_page_id";
              onChange({ [key]: Number(value) });
            }}
          />
          <TextControl
            label="Link text"
            value={label}
            onChange={(value) => {
              const key = title === "Privacy policy"
                ? "banner_privacy_policy_link_label"
                : title === "Terms and Conditions"
                  ? "banner_terms_link_label"
                  : "banner_cookie_policy_link_label";
              onChange({ [key]: value });
            }}
          />
          {pageId === 0 && (
            <small className="zion-admin__policy-link-warning">
              Select a page to display this link in the live banner.
            </small>
          )}
        </div>
      )}
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="zion-admin__color-control">
      <span>{label}</span>
      <span className="zion-admin__color-control-input">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <code>{value}</code>
      </span>
    </label>
  );
}
function NumberControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="zion-admin__field">
      <label>{label}</label>
      <input
        className="zion-admin__settings-input"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>
        Allowed range: {min}–{max}.
      </small>
    </div>
  );
}

function BannerPreview({
  settings,
  cookies,
  pages,
}: {
  settings: RecordData;
  cookies: RecordData[];
  pages: RecordData[];
}) {
  const [customizing, setCustomizing] = useState(false);
  const hoverEffect =
    ["none", "lift", "glow", "lift_glow"].indexOf(
      settings.banner_button_hover_effect || "lift_glow",
    ) !== -1
      ? settings.banner_button_hover_effect || "lift_glow"
      : "lift_glow";
  const style: Record<string, string> = {
    "--zion-preview-background": settings.banner_background_color || "#ffffff",
    "--zion-preview-text": settings.banner_text_color || "#183153",
    "--zion-preview-muted": settings.banner_muted_color || "#52657c",
    "--zion-preview-primary": settings.banner_primary_color || "#2369d1",
    "--zion-preview-primary-text":
      settings.banner_primary_text_color || "#ffffff",
    "--zion-preview-secondary": settings.banner_secondary_color || "#f1f6fc",
    "--zion-preview-secondary-text":
      settings.banner_secondary_text_color || "#1e477c",
    "--zion-preview-border": settings.banner_border_color || "#dce5f0",
    "--zion-preview-hover-duration":
      String(settings.banner_button_hover_duration || 180) + "ms",
    "--zion-preview-hover-scale": String(
      (settings.banner_button_hover_scale || 102) / 100,
    ),
    fontFamily:
      settings.banner_use_site_font === false
        ? '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        : "inherit",
  };
  const position = settings.banner_position || "bottom";
  const previewClass =
    "zion-admin__banner-preview zion-admin__banner-preview--" +
    position +
    " zion-admin__banner-preview--hover-" +
    hoverEffect +
    (settings.banner_button_hover_enabled === false
      ? " zion-admin__banner-preview--hover-disabled"
      : "");
  const policyLinks = [
    {
      enabled: settings.banner_show_privacy_policy_link !== false,
      pageId: settings.banner_privacy_policy_page_id || 0,
      label: settings.banner_privacy_policy_link_label || "Privacy policy",
    },
    {
      enabled: !!settings.banner_show_terms_link,
      pageId: settings.banner_terms_page_id || 0,
      label: settings.banner_terms_link_label || "Terms and Conditions",
    },
    {
      enabled: !!settings.banner_show_cookie_policy_link,
      pageId: settings.banner_cookie_policy_page_id || 0,
      label: settings.banner_cookie_policy_link_label || "Cookie policy",
    },
  ]
    .filter((link) => link.enabled && link.pageId > 0)
    .map((link) => ({
      ...link,
      url: pages.find((page) => Number(page.id) === Number(link.pageId))?.url || "",
    }))
    .filter((link) => link.url);
  return (
    <div className={previewClass} style={style}>
      <div className="zion-admin__banner-preview-content">
        <div>
          <h3>{settings.banner_title || "Your privacy matters"}</h3>
          <p>
            {settings.banner_message ||
              "Choose which categories of cookies you allow."}
          </p>
          {policyLinks.length > 0 && (
            <div className="zion-admin__banner-preview-policy-links">
              {policyLinks.map((link, index) => (
                <span key={link.pageId}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  <a
                    href={link.url}
                    onClick={(event) => event.preventDefault()}
                  >
                    {link.label}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="zion-admin__banner-preview-actions">
          <button
            type="button"
            onClick={() => announce("Essential cookies only selected.", "info")}
          >
            {settings.banner_reject_label || "Essential only"}
          </button>
          {settings.banner_show_customize !== false && (
            <button type="button" onClick={() => setCustomizing(true)}>
              {settings.banner_customize_label || "Customize"}
            </button>
          )}
          <button
            type="button"
            className="is-primary"
            onClick={() => announce("All cookies accepted.", "success")}
          >
            {settings.banner_accept_label || "Accept all"}
          </button>
        </div>
      </div>
      {customizing && (
        <CookiePreferenceModal
          settings={settings}
          cookies={cookies}
          onClose={() => setCustomizing(false)}
        />
      )}
    </div>
  );
}

function CookiePreferenceModal({
  settings,
  cookies,
  onClose,
}: {
  settings: RecordData;
  cookies: RecordData[];
  onClose: () => void;
}) {
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    necessary: true,
    preferences: true,
    analytics: true,
    marketing: true,
    security: true,
    personalization: true,
    unknown: false,
  });
  const grouped = categories
    .map((category) => ({
      ...category,
      cookies: cookies.filter(
        (cookie) => (cookie.category || "unknown") === category.value,
      ),
    }))
    .filter(
      (category) => category.cookies.length || category.value === "necessary",
    );
  const setCategory = (category: string, value: boolean) =>
    setPreferences((current) => ({ ...current, [category]: value }));
  return (
    <div className="zion-admin__preference-backdrop">
      <div
        className="zion-admin__preference-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Cookie preferences"
      >
        <div className="zion-admin__preference-header">
          <div>
            <span className="zion-admin__eyebrow">Privacy choices</span>
            <h3>{settings.banner_selector_title || "Customize cookies"}</h3>
            <p>
              {settings.banner_selector_message ||
                "Choose which cookie categories you allow on this website."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="zion-admin__preference-body">
          {grouped.map((group) => (
            <section
              className="zion-admin__preference-category"
              key={group.value}
            >
              <div className="zion-admin__preference-category-head">
                <div>
                  <h4>{group.label}</h4>
                  <p>
                    {group.value === "necessary"
                      ? "Always active for core website functionality."
                      : settings.banner_show_category_counts !== false
                      ? `${group.cookies.length} cookie${
                          group.cookies.length === 1 ? "" : "s"
                        } detected`
                      : "Optional cookies"}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!preferences[group.value]}
                  disabled={group.value === "necessary"}
                  onChange={(event) =>
                    setCategory(group.value, event.target.checked)
                  }
                />
              </div>
              {settings.banner_show_cookie_details !== false &&
                group.cookies.length > 0 && (
                  <div className="zion-admin__preference-cookies">
                    {group.cookies.map((cookie: RecordData, index: number) => (
                      <div key={`${cookie.name}-${index}`}>
                        <strong>{cookie.display_name || cookie.name}</strong>
                        <span>
                          {cookie.description ||
                            cookie.purpose ||
                            "No description available."}
                          {cookie.vendor ? ` · ${cookie.vendor}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </section>
          ))}
        </div>
        <div className="zion-admin__preference-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              announce("Cookie preferences saved.", "success");
              onClose();
            }}
          >
            {settings.banner_save_label || "Save preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Cookies() {
  const [cookies, setCookies] = useState<RecordData[]>([]);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [savingCategories, setSavingCategories] = useState<Record<string, boolean>>({});
  const [cacheInfo, setCacheInfo] = useState<RecordData>({});
  const [account, setAccount] = useState<RecordData>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [identifying, setIdentifying] = useState<Record<string, boolean>>({});
  const load = (force = false) => {
    setLoading(true);
    setError("");
    request<RecordData>(`cookies${force ? "?refresh=1" : ""}`)
      .then((result) => {
        const nextCookies = result.data || [];
        setCookies(nextCookies);
        setCategoryDrafts(
          nextCookies.reduce(
            (drafts: Record<string, string>, item: RecordData) => {
              drafts[String(item.id)] = item.category || "unknown";
              return drafts;
            },
            {},
          ),
        );
        setAccount(result.account || {});
        setCacheInfo({
          saved_at: result.saved_at || null,
          cached: !!result.cached,
          stale: !!result.stale,
        });
        if (result.stale)
          announce(
            "The API is unavailable. Showing the last locally saved cookie set.",
            "info",
          );
      })
      .catch((e) => {
        setError(e.message);
        announce(e.message, "error");
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(
      () => load(),
      Math.max(1, Number(config.cookieCacheMinutes || 5)) * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const updateCategory = (cookie: RecordData) => {
    const key = String(cookie.id);
    const category = categoryDrafts[key] || cookie.category || "unknown";
    const identity = [
      cookie.name || "",
      cookie.domain || "",
      cookie.path || "",
    ].join("|");
    setSavingCategories((items) => ({ ...items, [key]: true }));
    request("cookies/category", {
      method: "POST",
      body: JSON.stringify({ identity, category }),
    })
      .then(() => {
        setCookies((items) =>
          items.map((item) =>
            item.id === cookie.id
              ? { ...item, category, classification_source: "local_override" }
              : item,
          ),
        );
        announce("Cookie category saved for this website.");
      })
      .catch((e) => {
        setError(e.message);
        announce(e.message, "error");
      })
      .finally(() =>
        setSavingCategories((items) => ({ ...items, [key]: false })),
      );
  };
  const identifyCookie = (cookie: RecordData) => {
    const key = String(cookie.id);
    setIdentifying((items) => ({ ...items, [key]: true }));
    request<RecordData>(`cookies/${encodeURIComponent(key)}/identify`, {
      method: "POST",
    })
      .then((result) => {
        if (result.data)
          setCookies((items) =>
            items.map((item) => (item.id === cookie.id ? result.data : item)),
          );
        if (result.data)
          setCategoryDrafts((items) => ({
            ...items,
            [key]: result.data.category || "unknown",
          }));
        announce(
          result.source === "database"
            ? "Cookie identified from the local AI knowledge database."
            : "Cookie identification queued for Gemini.",
          result.source === "database" ? "success" : "info",
        );
        load();
      })
      .catch((e) => announce(e.message, "error"))
      .finally(() => setIdentifying((items) => ({ ...items, [key]: false })));
  };
  const packageKey = String(account.package?.key || "free");
  const aiAllowed = ["pro", "premium", "agency"].includes(packageKey);
  if (error) return <PageError message={error} />;
  return (
    <>
      <Header
        title="Cookies"
        subtitle="Review the latest cookie inventory returned by the remote scanner. Results are also saved locally in WordPress."
        connected={config.connected}
      />
      {!config.connected ? (
        <ConnectionBanner connected={false} onConnect={connect} />
      ) : (
        <Card>
          <CardHeader>
            <div className="zion-admin__card-heading">
              <div>
                <h2>Cookie inventory</h2>
                <p>
                  Categories can be adjusted locally per website. Select a
                  category and save it; the override is reapplied after future
                  scans. Existing AI knowledge is reused before a new Gemini
                  request is allowed.
                </p>
                <div className="zion-admin__cookie-cache-meta">
                  <span
                    className={`zion-admin__cache-dot ${
                      cacheInfo.stale ? "is-stale" : ""
                    }`}
                  />
                  {cacheInfo.saved_at
                    ? `${
                        cacheInfo.stale ? "Stale local set" : "Saved locally"
                      } · ${formatDate(cacheInfo.saved_at)}`
                    : "No local snapshot saved yet"}
                </div>
              </div>
              <div className="zion-admin__actions">
                <Button
                  variant="secondary"
                  icon={<ButtonIcon name="dashicons-update" />}
                  onClick={() => load(true)}
                  disabled={loading}
                >
                  {loading ? "Refreshing…" : "Refresh cookies"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="zion-admin__table-wrap">
              <table className="zion-admin__table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Vendor</th>
                    <th>Purpose</th>
                    <th>Source</th>
                    <th>AI identification</th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.length ? (
                    cookies.map((cookie) => {
                      const key = String(cookie.id);
                      const selectedCategory =
                        categoryDrafts[key] || cookie.category || "unknown";
                      const categoryChanged =
                        selectedCategory !== (cookie.category || "unknown");
                      const busy =
                        !!identifying[key] ||
                        ["queued", "processing"].includes(
                          String(cookie.ai_status || ""),
                        );
                      return (
                        <tr key={cookie.id}>
                          <td>
                            <strong
                              className={
                                cookie.classification_source === "ai"
                                  ? "zion-admin__green"
                                  : ""
                              }
                            >
                              {cookie.display_name || cookie.name}
                            </strong>
                            <br />
                            <span className="zion-admin__muted">
                              {cookie.name}
                            </span>
                          </td>
                          <td>
                            <div className="zion-admin__category-editor">
                              <SelectControl
                                label=""
                                hideLabelFromVision
                                options={categories}
                                value={selectedCategory}
                                onChange={(value) =>
                                  setCategoryDrafts((items) => ({
                                    ...items,
                                    [key]: value,
                                  }))
                                }
                              />
                              <Button
                                variant="primary"
                                icon={<ButtonIcon name="dashicons-saved" />}
                                onClick={() => updateCategory(cookie)}
                                disabled={
                                  !categoryChanged || !!savingCategories[key]
                                }
                              >
                                {savingCategories[key] ? "Saving…" : "Save"}
                              </Button>
                            </div>
                          </td>
                          <td>{cookie.vendor || "—"}</td>
                          <td>{cookie.purpose || cookie.description || "—"}</td>
                          <td
                            className={
                              cookie.classification_source === "ai"
                                ? "zion-admin__green"
                                : "zion-admin__muted"
                            }
                          >
                            {cookie.ai_source === "database"
                              ? "AI knowledge DB"
                              : formatLabel(
                                  cookie.classification_source || "scanner",
                                )}
                          </td>
                          <td>
                            {aiAllowed ? (
                              <Button
                                variant="secondary"
                                icon={<ButtonIcon name="dashicons-lightbulb" />}
                                onClick={() => identifyCookie(cookie)}
                                disabled={busy}
                              >
                                {busy
                                  ? "Identifying…"
                                  : cookie.classification_source === "ai"
                                  ? "Re-identify"
                                  : "Identify with AI"}
                              </Button>
                            ) : (
                              <span
                                className="zion-admin__ai-plan-lock"
                                title="AI cookie identification requires Pro or higher."
                              >
                                Pro+ required
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="zion-admin__empty">
                          No cookies have been returned yet.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Statistics() {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    request<RecordData>("statistics")
      .then(setData)
      .catch((e) => {
        setError(e.message);
        announce(e.message, "error");
      });
  }, []);
  if (error) return <PageError message={error} />;
  if (!data) return <Loading />;
  const stats = data.stats || {};
  const scans = data.scans || [];
  const maxPages = Math.max(
    1,
    ...scans.map((scan: RecordData) => Number(scan.page_count || 0)),
  );
  return (
    <>
      <Header
        title="Statistics"
        subtitle="Website-specific scanner metrics from the Zion Privacy API."
        connected={config.connected}
      />
      <div className="zion-admin__grid">
        <Metric label="Scans" value={stats.scans_count || 0} />
        <Metric label="Successful" value={stats.successful_scans || 0} />
        <Metric label="Cookies" value={stats.total_cookies || 0} />
        <Metric label="Pages" value={stats.pages_scanned || 0} />
      </div>
      <Card>
        <CardHeader>
          <h2>Pages scanned per recent scan</h2>
        </CardHeader>
        <CardBody>
          <div className="zion-admin__bar-chart">
            {scans.length ? (
              scans.map((scan: RecordData) => (
                <div className="zion-admin__bar" key={scan.id}>
                  <span
                    style={{
                      height: `${Math.max(
                        3,
                        (Number(scan.page_count || 0) / maxPages) * 100,
                      )}%`,
                    }}
                    title={`${scan.page_count || 0} pages — ${formatLabel(
                      scan.status || "unknown",
                    )}`}
                  />
                </div>
              ))
            ) : (
              <div className="zion-admin__empty">
                No scan data available yet.
              </div>
            )}
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2>Recent scan outcomes</h2>
        </CardHeader>
        <CardBody>
          <ScanTable scans={scans} />
        </CardBody>
      </Card>
    </>
  );
}

function Settings() {
  const [settings, setSettings] = useState<RecordData | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    request<RecordData>("settings")
      .then(setSettings)
      .catch((e) => {
        setError(e.message);
        announce(e.message, "error");
      });
  }, []);
  if (error) return <PageError message={error} />;
  if (!settings) return <Loading />;
  const update = (values: RecordData) =>
    setSettings((current) => ({ ...(current || {}), ...values }));
  const save = () => {
    setSaving(true);
    request<RecordData>("settings", {
      method: "POST",
      body: JSON.stringify(settings),
    })
      .then((saved) => {
        setSettings(saved);
        config.scanPollIntervalSeconds = saved.scan_poll_interval_seconds;
        config.defaultScanMode = saved.default_scan_mode;
        config.defaultScanScenario = saved.default_scan_scenario;
        announce("Application settings saved.");
      })
      .catch((e) => announce(e.message, "error"))
      .finally(() => setSaving(false));
  };
  const disconnect = () => {
    request("disconnect", { method: "POST" })
      .then(() => {
        announce("Zion Privacy account disconnected.");
        window.location.reload();
      })
      .catch((e) => announce(e.message, "error"));
  };
  return (
    <>
      <Header
        title="Settings"
        subtitle="Manage the secure connection and the application behavior for this WordPress website."
        connected={settings.connected}
      />
      <div className="zion-admin__settings-layout">
        <Card className="zion-admin__settings-card zion-admin__settings-card--connection">
          <CardHeader>
            <h2>API connection</h2>
            <p>
              The production Zion Privacy API is fixed to
              https://privacy-api.zion3d.ro/. Connect this WordPress
              installation through the secure API-owned OAuth flow.
            </p>
          </CardHeader>
          <CardBody>
            <div className="zion-admin__readonly">
              https://privacy-api.zion3d.ro/
            </div>
            <div className="zion-admin__actions">
              <Button variant="primary" onClick={() => connect("google")}>
                Connect with Google
              </Button>
              {settings.connected && (
                <Button isDestructive onClick={disconnect}>
                  Disconnect account
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
        <Card className="zion-admin__settings-card">
          <CardHeader>
            <h2>Connection details</h2>
          </CardHeader>
          <CardBody>
            {settings.connected ? (
              <div>
                <p className="zion-admin__green">Connected</p>
                <div className="zion-admin__readonly">
                  {settings.account?.email ||
                    settings.account?.name ||
                    "Connected Zion Privacy account"}
                </div>
                <p className="zion-admin__muted">
                  The credential is not displayed in WordPress.
                </p>
              </div>
            ) : (
              <p className="zion-admin__muted">No account is connected.</p>
            )}
          </CardBody>
        </Card>
        <Card className="zion-admin__settings-card zion-admin__settings-card--application">
          <CardHeader>
            <h2>Application behavior</h2>
            <p>
              These settings control how the WordPress client communicates with
              the API and how new scan forms start.
            </p>
          </CardHeader>
          <CardBody>
            <div className="zion-admin__form">
              <div className="zion-admin__field">
                <label>Live scan refresh interval</label>
                <select
                  className="zion-admin__settings-select"
                  value={settings.scan_poll_interval_seconds || 3}
                  onChange={(event) =>
                    update({
                      scan_poll_interval_seconds: Number(event.target.value),
                    })
                  }
                >
                  <option value="1">Every 1 second</option>
                  <option value="3">Every 3 seconds</option>
                  <option value="5">Every 5 seconds</option>
                  <option value="10">Every 10 seconds</option>
                  <option value="30">Every 30 seconds</option>
                </select>
                <small>Used only while a scan is active.</small>
              </div>
              <div className="zion-admin__field">
                <label>API request timeout</label>
                <input
                  className="zion-admin__settings-input"
                  type="number"
                  min="10"
                  max="60"
                  value={settings.api_timeout_seconds || 20}
                  onChange={(event) =>
                    update({ api_timeout_seconds: Number(event.target.value) })
                  }
                />
                <small>Allowed range: 10–60 seconds.</small>
              </div>
              <div className="zion-admin__field">
                <label>Default scan mode</label>
                <select
                  className="zion-admin__settings-select"
                  value={settings.default_scan_mode || "manual"}
                  onChange={(event) =>
                    update({ default_scan_mode: event.target.value })
                  }
                >
                  <option value="manual">Manual scan</option>
                  <option value="automatic">Automatic recurring scan</option>
                </select>
                <small>
                  Only changes the initial value in the Create scan modal.
                </small>
              </div>
              <div className="zion-admin__field">
                <label>Default scan scenario</label>
                <select
                  className="zion-admin__settings-select"
                  value={settings.default_scan_scenario || "pre_consent"}
                  onChange={(event) =>
                    update({ default_scan_scenario: event.target.value })
                  }
                >
                  <option value="pre_consent">Pre-consent</option>
                  <option value="reject_all">Reject all</option>
                  <option value="accept_all">Accept all</option>
                </select>
                <small>Can still be changed for each scan.</small>
              </div>
              <div className="zion-admin__field">
                <label>Banner cookie cache (minutes)</label>
                <input
                  className="zion-admin__settings-input"
                  type="number"
                  min="1"
                  max="60"
                  value={settings.banner_cookie_cache_minutes || 5}
                  onChange={(event) =>
                    update({
                      banner_cookie_cache_minutes: Number(event.target.value),
                    })
                  }
                />
                <small>
                  Controls how often the public banner refreshes cookie metadata
                  from the API.
                </small>
              </div>
              <div className="zion-admin__field zion-admin__field--full">
                <ToggleControl
                  label="Collect consent analytics"
                  checked={settings.consent_tracking_enabled !== false}
                  onChange={(value) =>
                    update({ consent_tracking_enabled: value })
                  }
                />
                <small>
                  Stores banner choices locally in WordPress and synchronizes
                  them with the API every 15 minutes for the WordPress Dashboard
                  chart.
                </small>
              </div>
            </div>
            <div className="zion-admin__actions">
              <Button variant="primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save application settings"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function ScanTable({
  scans,
  websiteId,
  onEdit,
  onRun,
  onDelete,
}: {
  scans: RecordData[];
  websiteId?: string;
  onEdit?: (scan: RecordData) => void;
  onRun?: (scan: RecordData) => void;
  onDelete?: (scan: RecordData) => void;
}) {
  const actions = !!(onEdit || onRun || onDelete);
  return (
    <div className="zion-admin__table-wrap">
      <table className="zion-admin__table">
        <thead>
          <tr>
            <th>Scan</th>
            <th>Status</th>
            <th>Scenario</th>
            <th>Pages</th>
            <th>Cookies</th>
            <th>Finished</th>
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {scans.length ? (
            scans.map((scan) => {
              const active = isActiveScan(scan.status);
              return (
                <tr
                  key={scan.id}
                  className={active ? "zion-admin__scan-row--active" : ""}
                >
                  <td>
                    <code title={String(scan.id || "")}>
                      {String(scan.id || "").slice(-12)}
                    </code>
                    {scan.is_scheduled && (
                      <small className="zion-admin__table-note">
                        {formatLabel(scan.schedule_frequency || "automatic")} ·{" "}
                        {scan.next_run_at
                          ? formatDate(scan.next_run_at)
                          : "scheduled"}
                      </small>
                    )}
                  </td>
                  <td>
                    <span
                      className={`zion-admin__status-text zion-admin__status-text--${
                        scan.status || "unknown"
                      }`}
                    >
                      {formatLabel(scan.status || "unknown")}
                    </span>
                  </td>
                  <td>{formatLabel(scan.scenario || "pre_consent")}</td>
                  <td>
                    <strong>{scan.page_count || 0}</strong>
                    {active && (
                      <span className="zion-admin__live-value">updating</span>
                    )}
                  </td>
                  <td>
                    <strong>{scan.cookie_count || 0}</strong>
                  </td>
                  <td className="zion-admin__muted">
                    {scan.finished_at ? formatDate(scan.finished_at) : "—"}
                  </td>
                  {actions && (
                    <td>
                      <div className="zion-admin__table-actions">
                        {onEdit && (
                          <Button
                            variant="secondary"
                            icon={<ButtonIcon name="dashicons-edit" />}
                            onClick={() => onEdit(scan)}
                          >
                            Edit
                          </Button>
                        )}
                        {onRun && (
                          <Button
                            variant={active ? "secondary" : "primary"}
                            icon={
                              <ButtonIcon
                                name={
                                  active
                                    ? "dashicons-controls-pause"
                                    : "dashicons-controls-play"
                                }
                              />
                            }
                            onClick={() => onRun(scan)}
                          >
                            {active ? "Stop" : "Run"}
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            isDestructive
                            icon={<ButtonIcon name="dashicons-trash" />}
                            onClick={() => onDelete(scan)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={actions ? 7 : 6}>
                <div className="zion-admin__empty">No scans available yet.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Sidebar({
  page,
  onNavigate,
  theme,
  onThemeChange,
}: {
  page: ViewKey;
  onNavigate: (view: ViewKey) => void;
  theme: ThemeMode;
  onThemeChange: () => void;
}) {
  const items: { key: ViewKey; label: string; icon: string }[] = [
    { key: "dashboard", label: "Dashboard", icon: "dashicons-dashboard" },
    { key: "scans", label: "Scans", icon: "dashicons-search" },
    { key: "cookies", label: "Cookies", icon: "dashicons-list-view" },
    { key: "statistics", label: "Statistics", icon: "dashicons-chart-area" },
    { key: "banner", label: "Banner", icon: "dashicons-welcome-view-site" },
    { key: "settings", label: "Settings", icon: "dashicons-admin-generic" },
  ];
  return (
    <aside className="zion-admin__sidebar">
      <div className="zion-admin__brand">
        <span className="zion-admin__brand-mark">Z</span>
        <span>
          <strong>Zion Privacy</strong>
          <small>Website intelligence</small>
        </span>
      </div>
      <nav className="zion-admin__nav" aria-label="Zion Privacy navigation">
        {items.map((item) => (
          <button
            type="button"
            className={`zion-admin__nav-item ${
              page === item.key ? "is-active" : ""
            }`}
            key={item.key}
            onClick={() => onNavigate(item.key)}
          >
            <span className={`zion-admin__nav-icon dashicons ${item.icon}`} />
            <span>{item.label}</span>
            {page === item.key && <span className="zion-admin__nav-pip" />}
          </button>
        ))}
      </nav>
      <div className="zion-admin__sidebar-footer">
        <span
          className={`zion-admin__sidebar-status ${
            config.connected ? "is-online" : ""
          }`}
        />
        {config.connected ? "API connected" : "Awaiting connection"}
        <button
          type="button"
          className="zion-admin__theme-switcher"
          onClick={onThemeChange}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <span
            className={`dashicons ${
              theme === "dark" ? "dashicons-sun" : "dashicons-moon"
            }`}
          />
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <small>v{config.version}</small>
      </div>
    </aside>
  );
}
function ToastRegion() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (
        event as CustomEvent<{ message: string; tone: ToastTone }>
      ).detail;
      setToasts((items) => [
        ...items,
        {
          id: ++toastSequence,
          message: detail.message,
          tone: detail.tone,
          progress: 0,
          paused: false,
        },
      ]);
    };
    window.addEventListener("zion-privacy:notice", handle);
    return () => window.removeEventListener("zion-privacy:notice", handle);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setToasts((items) =>
          items
            .map((toast) =>
              toast.paused
                ? toast
                : { ...toast, progress: toast.progress + 0.02 },
            )
            .filter((toast) => toast.progress < 1),
        ),
      100,
    );
    return () => window.clearInterval(timer);
  }, []);
  const pause = (id: number, paused: boolean) =>
    setToasts((items) =>
      items.map((toast) => (toast.id === id ? { ...toast, paused } : toast)),
    );
  const copy = (message: string) => {
    if (navigator.clipboard) void navigator.clipboard.writeText(message);
  };
  if (!toasts.length) return null;
  return (
    <div className="zion-admin__toast-region" aria-live="polite">
      {toasts.map((toast) => (
        <div
          className={`zion-admin__toast zion-admin__toast--${toast.tone}`}
          key={toast.id}
          onMouseEnter={() => pause(toast.id, true)}
          onMouseLeave={() => pause(toast.id, false)}
          onClick={() => copy(toast.message)}
          role="status"
          title="Click to copy this notification"
        >
          <div className="zion-admin__toast-dot" />
          <span>{toast.message}</span>
          <div className="zion-admin__toast-progress">
            <span
              style={{ width: `${Math.min(100, toast.progress * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [page, setPage] = useState<ViewKey>(normalizeView(config.page));
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  useEffect(() => {
    try {
      window.localStorage.setItem("zion-privacy-theme", theme);
    } catch (error) {
      /* localStorage can be blocked by browser privacy settings. */
    }
    document.body.classList.toggle(
      "zion-privacy-theme-light",
      theme === "light",
    );
  }, [theme]);
  useEffect(() => {
    const handle = () =>
      setPage(
        normalizeView(
          new URLSearchParams(window.location.search).get("view") ||
            "dashboard",
        ),
      );
    window.addEventListener("popstate", handle);
    return () => window.removeEventListener("popstate", handle);
  }, []);
  const navigate = (view: ViewKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", "zion-privacy");
    if (view === "dashboard") url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.pushState({}, "", url);
    setPage(view);
  };
  const content =
    page === "scans" ? (
      <Scans />
    ) : page === "cookies" ? (
      <Cookies />
    ) : page === "statistics" ? (
      <Statistics />
    ) : page === "banner" ? (
      <BannerPage />
    ) : page === "settings" ? (
      <Settings />
    ) : (
      <Dashboard />
    );
  return (
    <div className="zion-admin-shell" data-theme={theme}>
      <Sidebar
        page={page}
        onNavigate={navigate}
        theme={theme}
        onThemeChange={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <main className="zion-admin__main">
        <div className="zion-admin">{content}</div>
      </main>
    </div>
  );
}
function Loading() {
  return (
    <div className="zion-admin__spinner">
      <Spinner />
    </div>
  );
}
function PageError({ message }: { message: string }) {
  return (
    <>
      <Header
        title="Zion Privacy"
        subtitle="The admin bridge could not load data."
      />
      <div className="zion-admin__page-error">
        <strong>Something went wrong</strong>
        <span>{message}</span>
      </div>
    </>
  );
}
function connect(provider: string) {
  request<{ url: string }>("connect", {
    method: "POST",
    body: JSON.stringify({ provider }),
  })
    .then((result) => {
      window.location.href = result.url;
    })
    .catch((e) => announce(e.message, "error"));
}
function initialTheme(): ThemeMode {
  try {
    return window.localStorage.getItem("zion-privacy-theme") === "light"
      ? "light"
      : "dark";
  } catch (error) {
    return "dark";
  }
}
function normalizeView(value: string): ViewKey {
  const legacy: Record<string, ViewKey> = {
    "zion-privacy": "dashboard",
    "zion-privacy-cookies": "cookies",
    "zion-privacy-statistics": "statistics",
    "zion-privacy-settings": "settings",
  };
  return (
    legacy[value] ||
    ([
      "dashboard",
      "scans",
      "cookies",
      "statistics",
      "banner",
      "settings",
    ].includes(value)
      ? (value as ViewKey)
      : "dashboard")
  );
}
function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
function formatRegulation(value: string) {
  return (
    (
      {
        gdpr: "GDPR",
        us_state_laws: "US State Laws",
        gdpr_us_state_laws: "GDPR + US State Laws",
      } as Record<string, string>
    )[value] || "GDPR"
  );
}
function previewUrlFor(value: string) {
  try {
    const url = new URL(value);
    url.searchParams.set("zion_priv_preview", "true");
    return url.toString();
  } catch (error) {
    return `${value.replace(/\/$/, "")}/?zion_priv_preview=true`;
  }
}
function websiteStatusClass(value: string) {
  return value === "active" ? "active" : "inactive";
}
function websiteStatusLabel(value: string) {
  return value === "active" ? "Active" : "Inactive";
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
function formatOptionalDate(value: string | null | undefined) {
  return value ? formatDate(value) : "—";
}
function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  return seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    : `${seconds}s`;
}
function limitValue(value: any) {
  return value === null || typeof value === "undefined" ? "Unlimited" : value;
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function yearFromNowIso() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}
function dateForDay(day: any) {
  const date = new Date();
  const max = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(Number(day) || date.getDate(), max));
  return date.toISOString().slice(0, 10);
}
function scanForm(scan?: RecordData): ScanFormState {
  return {
    mode: scan?.is_scheduled
      ? "automatic"
      : config.defaultScanMode === "automatic"
      ? "automatic"
      : "manual",
    scenario: scan?.scenario || config.defaultScanScenario || "pre_consent",
    schedule_frequency: ["daily", "weekly", "monthly"].includes(
      scan?.schedule_frequency,
    )
      ? scan.schedule_frequency
      : "daily",
    schedule_time: scan?.schedule_time || "09:00",
    schedule_weekday: String(scan?.schedule_weekday || 1),
    schedule_date: dateForDay(scan?.schedule_day_of_month),
  };
}
function isActiveScan(status: string): boolean {
  return [
    "queued",
    "discovering",
    "crawling",
    "scanning",
    "processing",
    "classifying",
  ].includes(status);
}
const weekdays = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];
const categories = [
  "necessary",
  "preferences",
  "analytics",
  "marketing",
  "security",
  "personalization",
  "unknown",
].map((value) => ({ label: formatLabel(value), value }));
const rootElement = document.getElementById("zion-privacy-admin");
if (rootElement) createRoot(rootElement).render(<App />);
