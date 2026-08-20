import { createRoot, useEffect, useMemo, useState } from '@wordpress/element';
import { Button, Card, CardBody, CardHeader, Notice, SelectControl, Spinner, TextControl, TextareaControl, ToggleControl } from '@wordpress/components';

declare global {
  interface Window { ZionPrivacyAdmin: AdminConfig; }
}

type AdminConfig = { restUrl: string; nonce: string; page: string; connected: boolean; version: string };
type RecordData = Record<string, any>;

const config = window.ZionPrivacyAdmin;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(config.restUrl + path.replace(/^\//, ''), {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce, ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'The WordPress API bridge returned an error.');
  return data as T;
}

function Header({ title, subtitle, connected }: { title: string; subtitle: string; connected?: boolean }) {
  return <div className="zion-admin__header"><div><p className="zion-admin__eyebrow">Zion Privacy</p><h1 className="zion-admin__title">{title}</h1><p className="zion-admin__subtitle">{subtitle}</p></div>{typeof connected === 'boolean' && <span className={`zion-admin__status ${connected ? 'zion-admin__status--connected' : ''}`}>{connected ? 'Connected to API' : 'Not connected'}</span>}</div>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="zion-admin__metric"><div className="zion-admin__metric-label">{label}</div><div className="zion-admin__metric-value">{value}</div>{note && <div className="zion-admin__metric-note">{note}</div>}</div>;
}

function ConnectionBanner({ connected, onConnect }: { connected: boolean; onConnect: (provider: string) => void }) {
  if (connected) return null;
  return <div className="zion-admin__banner zion-admin__notice"><div><h2>Connect your website to Zion Privacy</h2><p>Use the secure API-owned OAuth flow to connect this WordPress installation.</p></div><div className="zion-admin__actions"><Button variant="primary" onClick={() => onConnect('google')}>Connect with Google</Button><Button variant="secondary" onClick={() => onConnect('facebook')}>Connect with Facebook</Button></div></div>;
}

function Dashboard() {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { request<RecordData>('dashboard').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <PageError message={error} />;
  if (!data) return <Loading />;
  const stats = data.stats || {};
  const categories = Object.entries(stats.categories || {});
  const scans = data.scans || [];
  return <><Header title="Dashboard" subtitle="A clear view of your website privacy posture, scanner activity and consent readiness." connected={config.connected} /><ConnectionBanner connected={config.connected} onConnect={connect} />{data.website ? <><div className="zion-admin__grid"><Metric label="Total cookies" value={stats.total_cookies || 0} note="Latest completed scan" /><Metric label="Categories" value={categories.length} note="Cookie taxonomy" /><Metric label="Pages scanned" value={stats.pages_scanned || 0} note={data.website.last_successful_scan_at ? `Last success: ${formatDate(data.website.last_successful_scan_at)}` : 'No completed scan yet'} /><Metric label="Average scan duration" value={formatDuration(stats.average_duration_seconds)} note={`${stats.successful_scans || 0} successful scans`} /></div><div className="zion-admin__grid zion-admin__grid--two"><Card><CardHeader><h2>Website connection</h2></CardHeader><CardBody><p><strong>{data.website.name}</strong></p><p className="zion-admin__muted">{data.website.base_url}</p><p className="zion-admin__muted">Status: {data.website.status || 'unknown'}</p></CardBody></Card><Card><CardHeader><h2>Cookie summary</h2></CardHeader><CardBody><div className="zion-admin__legend">{categories.length ? categories.map(([name, count]) => <span key={name}><strong>{formatLabel(name)}</strong> {count as number}</span>) : <span>No cookie categories available.</span>}</div></CardBody></Card></div><Card><CardHeader><h2>Recent scans</h2><p>Live results are loaded from the Zion Privacy API.</p></CardHeader><CardBody><ScanTable scans={scans.slice(0, 7)} /></CardBody></Card></> : <Card><CardBody><div className="zion-admin__empty">{config.connected ? 'The account is connected, but no website has been registered yet.' : 'Connect this WordPress website to load its existing scans, cookies and privacy statistics.'}</div></CardBody></Card>}</>;
}

function Cookies() {
  const [cookies, setCookies] = useState<RecordData[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { request<{ data: RecordData[] }>('cookies').then((result) => setCookies(result.data || [])).catch((e) => setError(e.message)); }, []);
  const updateCategory = (cookie: RecordData, category: string) => { const identity = [cookie.name || '', cookie.domain || '', cookie.path || ''].join('|'); request('cookies/category', { method: 'POST', body: JSON.stringify({ identity, category }) }).then(() => setCookies((items) => items.map((item) => item.id === cookie.id ? { ...item, category, classification_source: 'local_override' } : item))).catch((e) => setError(e.message)); };
  if (error) return <PageError message={error} />;
  return <><Header title="Cookies" subtitle="Review the latest cookie inventory returned by the remote scanner. Technical names remain unchanged." connected={config.connected} />{!config.connected ? <ConnectionBanner connected={false} onConnect={connect} /> : <Card><CardHeader><h2>Cookie inventory</h2><p>Categories can be adjusted locally without changing the scanner's technical identity.</p></CardHeader><CardBody><div className="zion-admin__table-wrap"><table className="zion-admin__table"><thead><tr><th>Name</th><th>Category</th><th>Vendor</th><th>Purpose</th><th>Source</th></tr></thead><tbody>{cookies.length ? cookies.map((cookie) => <tr key={cookie.id}><td><strong className={cookie.classification_source === 'ai' ? 'zion-admin__green' : ''}>{cookie.display_name || cookie.name}</strong><br /><span className="zion-admin__muted">{cookie.name}</span></td><td><SelectControl label="" hideLabelFromVision options={categories} value={cookie.category || 'unknown'} onChange={(value) => updateCategory(cookie, value)} /></td><td>{cookie.vendor || '—'}</td><td>{cookie.purpose || cookie.description || '—'}</td><td className={cookie.classification_source === 'ai' ? 'zion-admin__green' : 'zion-admin__muted'}>{formatLabel(cookie.classification_source || 'scanner')}</td></tr>) : <tr><td colSpan={5}><div className="zion-admin__empty">No cookies have been returned yet.</div></td></tr>}</tbody></table></div></CardBody></Card>}</>;
}

function Statistics() {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { request<RecordData>('statistics').then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <PageError message={error} />;
  if (!data) return <Loading />;
  const stats = data.stats || {};
  const scans = data.scans || [];
  const maxPages = Math.max(1, ...scans.map((scan: RecordData) => Number(scan.page_count || 0)));
  return <><Header title="Statistics" subtitle="Website-specific scanner metrics from the Zion Privacy API." connected={config.connected} /><div className="zion-admin__grid"><Metric label="Scans" value={stats.scans_count || 0} /><Metric label="Successful" value={stats.successful_scans || 0} /><Metric label="Cookies" value={stats.total_cookies || 0} /><Metric label="Pages" value={stats.pages_scanned || 0} /></div><Card><CardHeader><h2>Pages scanned per recent scan</h2></CardHeader><CardBody><div className="zion-admin__bar-chart">{scans.length ? scans.map((scan: RecordData) => <div className="zion-admin__bar" key={scan.id}><span style={{ height: `${Math.max(3, (Number(scan.page_count || 0) / maxPages) * 100)}%` }} title={`${scan.page_count || 0} pages — ${formatLabel(scan.status || 'unknown')}`} /></div>) : <div className="zion-admin__empty">No scan data available yet.</div>}</div></CardBody></Card><Card><CardHeader><h2>Recent scan outcomes</h2></CardHeader><CardBody><ScanTable scans={scans} /></CardBody></Card></>;
}

function Settings() {
  const [settings, setSettings] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { request<RecordData>('settings').then(setSettings).catch((e) => setError(e.message)); }, []);
  if (error) return <PageError message={error} />;
  if (!settings) return <Loading />;
  const save = () => { request<RecordData>('settings', { method: 'POST', body: JSON.stringify(settings) }).then(setSettings).then(() => setSaved(true)).catch((e) => setError(e.message)); };
  return <><Header title="Settings" subtitle="Configure the consent banner. OAuth provider credentials stay on the Zion Privacy API." connected={settings.connected} />{saved && <Notice status="success" onRemove={() => setSaved(false)}>Settings saved.</Notice>}{error && <Notice status="error">{error}</Notice>}<div className="zion-admin__grid zion-admin__grid--two"><Card><CardHeader><h2>API connection</h2><p>The production Zion Privacy API is fixed to https://privacy-api.zion3d.ro/. Connect this WordPress installation through the secure API-owned OAuth flow.</p></CardHeader><CardBody><div className="zion-admin__readonly">https://privacy-api.zion3d.ro/</div><div className="zion-admin__actions"><Button variant="primary" onClick={() => connect('google')}>Connect with Google</Button><Button variant="secondary" onClick={() => connect('facebook')}>Connect with Facebook</Button>{settings.connected && <Button isDestructive onClick={() => request('disconnect', { method: 'POST' }).then(() => window.location.reload())}>Disconnect account</Button>}</div></CardBody></Card><Card><CardHeader><h2>Connection details</h2></CardHeader><CardBody>{settings.connected ? <div><p className="zion-admin__green">Connected</p><div className="zion-admin__readonly">{settings.account?.email || settings.account?.name || 'Connected Zion Privacy account'}</div><p className="zion-admin__muted">The credential is not displayed in WordPress.</p></div> : <p className="zion-admin__muted">No account is connected.</p>}</CardBody></Card></div><Card><CardHeader><h2>Consent banner</h2><p>The banner works locally while the API connection is being configured.</p></CardHeader><CardBody><div className="zion-admin__form"><div className="zion-admin__field zion-admin__field--full"><ToggleControl label="Enable banner" checked={!!settings.banner_enabled} onChange={(value) => setSettings({ ...settings, banner_enabled: value })} /></div><TextControl label="Banner title" value={settings.banner_title || ''} onChange={(value) => setSettings({ ...settings, banner_title: value })} /><TextareaControl label="Banner message" value={settings.banner_message || ''} onChange={(value) => setSettings({ ...settings, banner_message: value })} /></div><div className="zion-admin__actions"><Button variant="primary" onClick={save}>Save banner settings</Button></div></CardBody></Card></>;
}

function ScanTable({ scans }: { scans: RecordData[] }) { return <div className="zion-admin__table-wrap"><table className="zion-admin__table"><thead><tr><th>Scan</th><th>Status</th><th>Scenario</th><th>Pages</th><th>Cookies</th><th>Finished</th></tr></thead><tbody>{scans.length ? scans.map((scan) => <tr key={scan.id}><td><code>{String(scan.id || '').slice(-12)}</code></td><td className={scan.status === 'completed' ? 'zion-admin__green' : scan.status === 'failed' ? 'zion-admin__amber' : ''}>{formatLabel(scan.status || 'unknown')}</td><td>{formatLabel(scan.scenario || 'pre_consent')}</td><td>{scan.page_count || 0}</td><td>{scan.cookie_count || 0}</td><td className="zion-admin__muted">{scan.finished_at ? formatDate(scan.finished_at) : '—'}</td></tr>) : <tr><td colSpan={6}><div className="zion-admin__empty">No scans available yet.</div></td></tr>}</tbody></table></div>; }

function App() { const page = config.page; const [notice, setNotice] = useState(''); const onConnect = (provider: string) => { request<{ url: string }>('connect', { method: 'POST', body: JSON.stringify({ provider }) }).then((result) => { window.location.href = result.url; }).catch((e) => setNotice(e.message)); }; const content = page === 'zion-privacy-cookies' ? <Cookies /> : page === 'zion-privacy-statistics' ? <Statistics /> : page === 'zion-privacy-settings' ? <Settings /> : <Dashboard />; return <div className="zion-admin">{notice && <Notice status="error" onRemove={() => setNotice('')}>{notice}</Notice>}{content}</div>; }

function Loading() { return <div className="zion-admin__spinner"><Spinner /></div>; }
function PageError({ message }: { message: string }) { return <><Header title="Zion Privacy" subtitle="The admin bridge could not load data." /><Notice status="error">{message}</Notice></>; }
function connect(provider: string) { request<{ url: string }>('connect', { method: 'POST', body: JSON.stringify({ provider }) }).then((result) => { window.location.href = result.url; }).catch((e) => window.alert(e.message)); }
function formatLabel(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function formatDuration(seconds: number | null) { if (!seconds) return '—'; return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`; }
const categories = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'].map((value) => ({ label: formatLabel(value), value }));

const rootElement = document.getElementById('zion-privacy-admin');
if (rootElement) createRoot(rootElement).render(<App />);
