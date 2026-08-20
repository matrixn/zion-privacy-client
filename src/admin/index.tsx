import { createRoot, useEffect, useState } from '@wordpress/element';
import { Button, Card, CardBody, CardHeader, SelectControl, Spinner, TextControl, TextareaControl, ToggleControl } from '@wordpress/components';

declare global {
  interface Window { ZionPrivacyAdmin: AdminConfig; }
}

type ViewKey = 'dashboard' | 'scans' | 'cookies' | 'statistics' | 'settings';
type ToastTone = 'success' | 'error' | 'info';
type AdminConfig = { restUrl: string; nonce: string; page: string; connected: boolean; version: string };
type RecordData = Record<string, any>;
type ToastData = { id: number; message: string; tone: ToastTone; progress: number; paused: boolean };

const config = window.ZionPrivacyAdmin;
let toastSequence = 0;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(config.restUrl + path.replace(/^\//, ''), {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': config.nonce, ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'The WordPress API bridge returned an error.');
  return data as T;
}

function announce(message: string, tone: ToastTone = 'success') {
  window.dispatchEvent(new CustomEvent('zion-privacy:notice', { detail: { message, tone } }));
}

function Header({ title, subtitle, connected }: { title: string; subtitle: string; connected?: boolean }) {
  return <div className="zion-admin__header"><div><p className="zion-admin__eyebrow">Zion Privacy / Control center</p><h1 className="zion-admin__title">{title}</h1><p className="zion-admin__subtitle">{subtitle}</p></div>{typeof connected === 'boolean' && <span className={`zion-admin__status ${connected ? 'zion-admin__status--connected' : ''}`}>{connected ? 'Connected to API' : 'Not connected'}</span>}</div>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="zion-admin__metric"><div className="zion-admin__metric-label">{label}</div><div className="zion-admin__metric-value">{value}</div>{note && <div className="zion-admin__metric-note">{note}</div>}</div>;
}

function ConnectionBanner({ connected, onConnect }: { connected: boolean; onConnect: (provider: string) => void }) {
  if (connected) return null;
  return <div className="zion-admin__banner zion-admin__notice"><div><h2>Connect your website to Zion Privacy</h2><p>Unlock remote scans, cookie intelligence and privacy statistics with the API-owned OAuth flow.</p></div><div className="zion-admin__actions"><Button variant="primary" onClick={() => onConnect('google')}>Connect with Google</Button><Button variant="secondary" onClick={() => onConnect('facebook')}>Connect with Facebook</Button></div></div>;
}

function Dashboard() {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { request<RecordData>('dashboard').then(setData).catch((e) => { setError(e.message); announce(e.message, 'error'); }); }, []);
  if (error) return <PageError message={error} />;
  if (!data) return <Loading />;
  const stats = data.stats || {};
  const categories = Object.entries(stats.categories || {});
  const scans = data.scans || [];
  return <><Header title="Dashboard" subtitle="A clear view of your website privacy posture, scanner activity and consent readiness." connected={config.connected} /><ConnectionBanner connected={config.connected} onConnect={connect} />{data.website ? <><div className="zion-admin__grid"><Metric label="Total cookies" value={stats.total_cookies || 0} note="Latest completed scan" /><Metric label="Categories" value={categories.length} note="Cookie taxonomy" /><Metric label="Pages scanned" value={stats.pages_scanned || 0} note={data.website.last_successful_scan_at ? `Last success: ${formatDate(data.website.last_successful_scan_at)}` : 'No completed scan yet'} /><Metric label="Average scan duration" value={formatDuration(stats.average_duration_seconds)} note={`${stats.successful_scans || 0} successful scans`} /></div><div className="zion-admin__grid zion-admin__grid--two"><Card><CardHeader><h2>Website connection</h2></CardHeader><CardBody><p><strong>{data.website.name}</strong></p><p className="zion-admin__muted">{data.website.base_url}</p><p className="zion-admin__muted">Status: {data.website.status || 'unknown'}</p></CardBody></Card><Card><CardHeader><h2>Cookie summary</h2></CardHeader><CardBody><div className="zion-admin__legend">{categories.length ? categories.map(([name, count]) => <span key={name}><strong>{formatLabel(name)}</strong> {count as number}</span>) : <span>No cookie categories available.</span>}</div></CardBody></Card></div><Card><CardHeader><h2>Recent scans</h2><p>Live results are loaded from the Zion Privacy API.</p></CardHeader><CardBody><ScanTable scans={scans.slice(0, 7)} /></CardBody></Card></> : <Card><CardBody><div className="zion-admin__empty">{config.connected ? 'The account is connected, but no website has been registered yet.' : 'Connect this WordPress website to load its existing scans, cookies and privacy statistics.'}</div></CardBody></Card>}</>;
}

function Scans() {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  const load = () => { setError(''); request<RecordData>('scans').then(setData).catch((e) => { setError(e.message); announce(e.message, 'error'); }); };
  useEffect(load, []);
  if (error) return <PageError message={error} />;
  if (!data) return <Loading />;
  return <><Header title="Scans" subtitle="Review every scan returned for this WordPress website and refresh results without leaving the page." connected={config.connected} /><ConnectionBanner connected={config.connected} onConnect={connect} />{data.website ? <Card><CardHeader><div className="zion-admin__card-heading"><div><h2>Scan history</h2><p>{data.website.name} · {data.data?.length || 0} scans available</p></div><Button variant="secondary" onClick={load}>Refresh scans</Button></div></CardHeader><CardBody><ScanTable scans={data.data || []} /></CardBody></Card> : <Card><CardBody><div className="zion-admin__empty">{config.connected ? 'No website is linked to this WordPress installation yet.' : 'Connect this website to load its scan history.'}</div></CardBody></Card>}</>;
}

function Cookies() {
  const [cookies, setCookies] = useState<RecordData[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { request<{ data: RecordData[] }>('cookies').then((result) => setCookies(result.data || [])).catch((e) => { setError(e.message); announce(e.message, 'error'); }); }, []);
  const updateCategory = (cookie: RecordData, category: string) => { const identity = [cookie.name || '', cookie.domain || '', cookie.path || ''].join('|'); request('cookies/category', { method: 'POST', body: JSON.stringify({ identity, category }) }).then(() => { setCookies((items) => items.map((item) => item.id === cookie.id ? { ...item, category, classification_source: 'local_override' } : item)); announce('Cookie category updated.'); }).catch((e) => { setError(e.message); announce(e.message, 'error'); }); };
  if (error) return <PageError message={error} />;
  return <><Header title="Cookies" subtitle="Review the latest cookie inventory returned by the remote scanner. Technical names remain unchanged." connected={config.connected} />{!config.connected ? <ConnectionBanner connected={false} onConnect={connect} /> : <Card><CardHeader><h2>Cookie inventory</h2><p>Categories can be adjusted locally without changing the scanner's technical identity.</p></CardHeader><CardBody><div className="zion-admin__table-wrap"><table className="zion-admin__table"><thead><tr><th>Name</th><th>Category</th><th>Vendor</th><th>Purpose</th><th>Source</th></tr></thead><tbody>{cookies.length ? cookies.map((cookie) => <tr key={cookie.id}><td><strong className={cookie.classification_source === 'ai' ? 'zion-admin__green' : ''}>{cookie.display_name || cookie.name}</strong><br /><span className="zion-admin__muted">{cookie.name}</span></td><td><SelectControl label="" hideLabelFromVision options={categories} value={cookie.category || 'unknown'} onChange={(value) => updateCategory(cookie, value)} /></td><td>{cookie.vendor || '—'}</td><td>{cookie.purpose || cookie.description || '—'}</td><td className={cookie.classification_source === 'ai' ? 'zion-admin__green' : 'zion-admin__muted'}>{formatLabel(cookie.classification_source || 'scanner')}</td></tr>) : <tr><td colSpan={5}><div className="zion-admin__empty">No cookies have been returned yet.</div></td></tr>}</tbody></table></div></CardBody></Card>}</>;
}

function Statistics() {
  const [data, setData] = useState<RecordData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { request<RecordData>('statistics').then(setData).catch((e) => { setError(e.message); announce(e.message, 'error'); }); }, []);
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
  useEffect(() => { request<RecordData>('settings').then(setSettings).catch((e) => { setError(e.message); announce(e.message, 'error'); }); }, []);
  if (error) return <PageError message={error} />;
  if (!settings) return <Loading />;
  const save = () => { request<RecordData>('settings', { method: 'POST', body: JSON.stringify(settings) }).then(setSettings).then(() => announce('Settings saved.')).catch((e) => { setError(e.message); announce(e.message, 'error'); }); };
  const disconnect = () => { request('disconnect', { method: 'POST' }).then(() => { announce('Zion Privacy account disconnected.'); window.location.reload(); }).catch((e) => announce(e.message, 'error')); };
  return <><Header title="Settings" subtitle="Configure the consent banner and manage the connection for this WordPress website." connected={settings.connected} /><div className="zion-admin__settings-layout"><Card className="zion-admin__settings-card zion-admin__settings-card--connection"><CardHeader><h2>API connection</h2><p>The production Zion Privacy API is fixed to https://privacy-api.zion3d.ro/. Connect this WordPress installation through the secure API-owned OAuth flow.</p></CardHeader><CardBody><div className="zion-admin__readonly">https://privacy-api.zion3d.ro/</div><div className="zion-admin__actions"><Button variant="primary" onClick={() => connect('google')}>Connect with Google</Button><Button variant="secondary" onClick={() => connect('facebook')}>Connect with Facebook</Button>{settings.connected && <Button isDestructive onClick={disconnect}>Disconnect account</Button>}</div></CardBody></Card><Card className="zion-admin__settings-card"><CardHeader><h2>Connection details</h2></CardHeader><CardBody>{settings.connected ? <div><p className="zion-admin__green">Connected</p><div className="zion-admin__readonly">{settings.account?.email || settings.account?.name || 'Connected Zion Privacy account'}</div><p className="zion-admin__muted">The credential is not displayed in WordPress.</p></div> : <p className="zion-admin__muted">No account is connected.</p>}</CardBody></Card><Card className="zion-admin__settings-card zion-admin__settings-card--banner"><CardHeader><h2>Consent banner</h2><p>The banner works locally while the API connection is being configured.</p></CardHeader><CardBody><div className="zion-admin__form"><div className="zion-admin__field zion-admin__field--full"><ToggleControl label="Enable banner" checked={!!settings.banner_enabled} onChange={(value) => setSettings({ ...settings, banner_enabled: value })} /></div><TextControl label="Banner title" value={settings.banner_title || ''} onChange={(value) => setSettings({ ...settings, banner_title: value })} /><TextareaControl label="Banner message" value={settings.banner_message || ''} onChange={(value) => setSettings({ ...settings, banner_message: value })} /></div><div className="zion-admin__actions"><Button variant="primary" onClick={save}>Save banner settings</Button></div></CardBody></Card></div></>;
}

function ScanTable({ scans }: { scans: RecordData[] }) { return <div className="zion-admin__table-wrap"><table className="zion-admin__table"><thead><tr><th>Scan</th><th>Status</th><th>Scenario</th><th>Pages</th><th>Cookies</th><th>Finished</th></tr></thead><tbody>{scans.length ? scans.map((scan) => <tr key={scan.id}><td><code>{String(scan.id || '').slice(-12)}</code></td><td><span className={`zion-admin__status-text zion-admin__status-text--${scan.status || 'unknown'}`}>{formatLabel(scan.status || 'unknown')}</span></td><td>{formatLabel(scan.scenario || 'pre_consent')}</td><td>{scan.page_count || 0}</td><td>{scan.cookie_count || 0}</td><td className="zion-admin__muted">{scan.finished_at ? formatDate(scan.finished_at) : '—'}</td></tr>) : <tr><td colSpan={6}><div className="zion-admin__empty">No scans available yet.</div></td></tr>}</tbody></table></div>; }

function Sidebar({ page, onNavigate }: { page: ViewKey; onNavigate: (view: ViewKey) => void }) {
  const items: { key: ViewKey; label: string; icon: string }[] = [{ key: 'dashboard', label: 'Dashboard', icon: '⌂' }, { key: 'scans', label: 'Scans', icon: '◉' }, { key: 'cookies', label: 'Cookies', icon: '◌' }, { key: 'statistics', label: 'Statistics', icon: '✦' }, { key: 'settings', label: 'Settings', icon: '⚙' }];
  return <aside className="zion-admin__sidebar"><div className="zion-admin__brand"><span className="zion-admin__brand-mark">Z</span><span><strong>Zion Privacy</strong><small>Website intelligence</small></span></div><nav className="zion-admin__nav" aria-label="Zion Privacy navigation">{items.map((item) => <button type="button" className={`zion-admin__nav-item ${page === item.key ? 'is-active' : ''}`} key={item.key} onClick={() => onNavigate(item.key)}><span className="zion-admin__nav-icon">{item.icon}</span><span>{item.label}</span>{page === item.key && <span className="zion-admin__nav-pip" />}</button>)}</nav><div className="zion-admin__sidebar-footer"><span className={`zion-admin__sidebar-status ${config.connected ? 'is-online' : ''}`} />{config.connected ? 'API connected' : 'Awaiting connection'}<small>v{config.version}</small></div></aside>;
}

function ToastRegion() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  useEffect(() => { const handle = (event: Event) => { const detail = (event as CustomEvent<{ message: string; tone: ToastTone }>).detail; setToasts((items) => [...items, { id: ++toastSequence, message: detail.message, tone: detail.tone, progress: 0, paused: false }]); }; window.addEventListener('zion-privacy:notice', handle); return () => window.removeEventListener('zion-privacy:notice', handle); }, []);
  useEffect(() => { const timer = window.setInterval(() => setToasts((items) => items.map((toast) => toast.paused ? toast : { ...toast, progress: toast.progress + .02 }).filter((toast) => toast.progress < 1)), 100); return () => window.clearInterval(timer); }, []);
  const pause = (id: number, paused: boolean) => setToasts((items) => items.map((toast) => toast.id === id ? { ...toast, paused } : toast));
  const copy = (message: string) => { if (navigator.clipboard) void navigator.clipboard.writeText(message); };
  return <div className="zion-admin__toast-region" aria-live="polite">{toasts.map((toast) => <div className={`zion-admin__toast zion-admin__toast--${toast.tone}`} key={toast.id} onMouseEnter={() => pause(toast.id, true)} onMouseLeave={() => pause(toast.id, false)} onClick={() => copy(toast.message)} role="status" title="Click to copy this notification"><div className="zion-admin__toast-dot" /><span>{toast.message}</span><div className="zion-admin__toast-progress"><span style={{ width: `${Math.min(100, toast.progress * 100)}%` }} /></div></div>)}</div>;
}

function App() {
  const [page, setPage] = useState<ViewKey>(normalizeView(config.page));
  useEffect(() => { const handle = () => setPage(normalizeView(new URLSearchParams(window.location.search).get('view') || 'dashboard')); window.addEventListener('popstate', handle); return () => window.removeEventListener('popstate', handle); }, []);
  const navigate = (view: ViewKey) => { const url = new URL(window.location.href); url.searchParams.set('page', 'zion-privacy'); if (view === 'dashboard') url.searchParams.delete('view'); else url.searchParams.set('view', view); window.history.pushState({}, '', url); setPage(view); };
  const content = page === 'scans' ? <Scans /> : page === 'cookies' ? <Cookies /> : page === 'statistics' ? <Statistics /> : page === 'settings' ? <Settings /> : <Dashboard />;
  return <div className="zion-admin-shell"><Sidebar page={page} onNavigate={navigate} /><main className="zion-admin__main"><div className="zion-admin">{content}</div></main><ToastRegion /></div>;
}

function Loading() { return <div className="zion-admin__spinner"><Spinner /></div>; }
function PageError({ message }: { message: string }) { return <><Header title="Zion Privacy" subtitle="The admin bridge could not load data." /><div className="zion-admin__page-error"><strong>Something went wrong</strong><span>{message}</span></div></>; }
function connect(provider: string) { request<{ url: string }>('connect', { method: 'POST', body: JSON.stringify({ provider }) }).then((result) => { window.location.href = result.url; }).catch((e) => announce(e.message, 'error')); }
function normalizeView(value: string): ViewKey { const legacy: Record<string, ViewKey> = { 'zion-privacy': 'dashboard', 'zion-privacy-cookies': 'cookies', 'zion-privacy-statistics': 'statistics', 'zion-privacy-settings': 'settings' }; return legacy[value] || (['dashboard', 'scans', 'cookies', 'statistics', 'settings'].includes(value) ? value as ViewKey : 'dashboard'); }
function formatLabel(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase()); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function formatDuration(seconds: number | null) { if (!seconds) return '—'; return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`; }
const categories = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'].map((value) => ({ label: formatLabel(value), value }));

const rootElement = document.getElementById('zion-privacy-admin');
if (rootElement) createRoot(rootElement).render(<App />);
