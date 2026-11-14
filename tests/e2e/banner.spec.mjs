import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const asset = path => readFile(new URL(path, root), 'utf8');
const cookie = (category, index) => ({ name: `synthetic_${category}_${index}`, category, description: 'No description available.' });
const cookies = ['necessary', 'preferences', 'analytics', 'marketing', 'security', 'personalization', 'unknown'].flatMap(category =>
  Array.from({ length: category === 'security' ? 20 : category === 'analytics' ? 2 : 1 }, (_, index) => cookie(category, index)));

async function fixture(page, baseURL, { romanian = true, preview = true, ...overrides } = {}) {
  const target = new URL(baseURL);
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(target.hostname);
  expect(target.port).toBe('8917');
  const events = [];
  await page.route('**/__zion-privacy-consent', async route => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true } });
  });
  for (const [url, file, contentType] of [
    ['helper.js', 'assets/banner-i18n.js', 'application/javascript'],
    ['banner.js', 'assets/banner.js', 'application/javascript'],
    ['banner.css', 'assets/banner.css', 'text/css'],
  ]) await page.route(`**/__zion-privacy-${url}`, route => asset(file).then(body => route.fulfill({ body, contentType })));
  const catalog = JSON.parse(await asset('languages/zion-privacy-client-ro_RO-zion-privacy-banner-i18n.json'));
  const config = {
    preview, styleUrl: '/__zion-privacy-banner.css', position: 'bottom_centered', width: 1160,
    radius: 16, fontSize: 15, regulation: 'gdpr', cookies,
    consentTrackingEnabled: true, consentToken: 'synthetic-token', consentUrl: '/__zion-privacy-consent',
    storageKey: 'zion_privacy_synthetic_test',
    colors: { background: '#141f16', text: '#f3f6ef', muted: '#b4c3b3', primary: '#d9fb4f', primaryText: '#080d09', secondary: '#080d09', secondaryText: '#f3f6ef', border: '#435d29' },
    ...overrides,
  };
  const safeJSON = value => JSON.stringify(value).replaceAll('<', '\\u003c');
  await page.route('**/__zion-privacy-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="${romanian ? 'ro' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#080d09;color:#f3f6ef;font-family:Arial,sans-serif}</style></head><body><main><h1>Zion synthetic fixture</h1></main><script src="/wp-includes/js/dist/hooks.min.js"></script><script src="/wp-includes/js/dist/i18n.min.js"></script><script>${romanian ? `wp.i18n.setLocaleData(${safeJSON(catalog.locale_data.messages)},'zion-privacy-client');` : ''}window.ZionPrivacyBanner=${safeJSON(config)};</script><script src="/__zion-privacy-helper.js"></script><script src="/__zion-privacy-banner.js"></script></body></html>`,
  }));
  await page.goto('/__zion-privacy-fixture');
  await expect(page.locator('.zion-privacy-banner')).toBeVisible();
  return events;
}

for (const width of [390, 768, 1024, 1440]) {
  test(`Romanian banner and preferences fit at ${width}px`, async ({ page, baseURL }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    const events = await fixture(page, baseURL);
    const banner = page.locator('.zion-privacy-banner');
    await expect(banner.getByRole('button', { name: 'Personalizează', exact: true })).toBeVisible();
    const bounds = await banner.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await banner.getByRole('button', { name: 'Personalizează', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Preferințe cookie', exact: true });
    const dialogBounds = await dialog.boundingBox();
    expect(dialogBounds.x).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.x + dialogBounds.width).toBeLessThanOrEqual(width);
    expect(dialogBounds.y + dialogBounds.height).toBeLessThanOrEqual(1000);
    for (const label of ['Necesare', 'Preferințe', 'Analiză', 'Marketing', 'Securitate', 'Personalizare', 'Neclasificate'])
      await expect(dialog.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: 'Necesare', exact: true })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Necesare', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: 'Analiză', exact: true })).not.toBeChecked();
    await dialog.locator('[data-zion-category-toggle="necessary"]').click();
    await dialog.locator('[data-zion-category-toggle="analytics"]').click();
    await dialog.locator('[data-zion-category-toggle="security"]').click();
    await expect(dialog.getByText('1 cookie identificat', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText('2 cookie-uri identificate', { exact: true })).toBeVisible();
    await expect(dialog.getByText('20 de cookie-uri identificate', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Nu există o descriere disponibilă.', { exact: true }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Anulează', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(banner).toBeVisible();
    expect(events).toHaveLength(0);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

test('cookie categories start collapsed and remember their expanded state', async ({ page, baseURL }) => {
  await fixture(page, baseURL, { preview: false });
  const banner = page.locator('.zion-privacy-banner');
  await banner.getByRole('button', { name: 'Personalizează', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Preferințe cookie', exact: true });
  const analytics = dialog.locator('[data-zion-category-toggle="analytics"]');
  await expect(analytics).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog.locator('.zion-privacy-banner__category[data-zion-category-panel="analytics"] .zion-privacy-banner__cookie').first()).toBeHidden();
  await analytics.click();
  await expect(analytics).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.locator('.zion-privacy-banner__category[data-zion-category-panel="analytics"] .zion-privacy-banner__cookie').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Salvează preferințele', exact: true }).click();
  await page.getByRole('button', { name: 'Modifică preferințele cookie', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Preferințe cookie', exact: true });
  await expect(dialog.locator('[data-zion-category-toggle="analytics"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(dialog.locator('.zion-privacy-banner__category[data-zion-category-panel="analytics"] .zion-privacy-banner__cookie').first()).toBeVisible();
});

test('banner typography and category geometry are isolated from inherited site styles', async ({ page, baseURL }) => {
  await fixture(page, baseURL);
  await page.evaluate(() => {
    document.body.style.fontSize = '48px';
    document.body.style.lineHeight = '3';
    document.body.style.letterSpacing = '0.35em';
    document.body.style.textAlign = 'center';
  });

  const banner = page.locator('.zion-privacy-banner');
  expect(await banner.evaluate(element => getComputedStyle(element).fontSize)).toBe('15px');
  expect(await banner.evaluate(element => getComputedStyle(element).lineHeight)).toBe('21px');
  expect(await banner.evaluate(element => getComputedStyle(element).letterSpacing)).toBe('normal');
  expect(await banner.evaluate(element => getComputedStyle(element).textAlign)).toBe('left');

  await banner.getByRole('button', { name: 'Personalizează', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preferințe cookie', exact: true });
  const category = dialog.locator('[data-zion-category-panel="analytics"]');
  const categoryWidth = Number.parseFloat(await category.evaluate(element => getComputedStyle(element).width));
  expect(categoryWidth).toBeGreaterThan(500);
  expect(categoryWidth).toBeLessThanOrEqual(580);
  expect(await category.locator('h3').evaluate(element => getComputedStyle(element).fontSize)).toBe('14px');
  expect(await category.locator('h3').evaluate(element => getComputedStyle(element).lineHeight)).toBe('18.2px');
});

test('native English fallback and configurable merchant labels remain available', async ({ page, baseURL }) => {
  await fixture(page, baseURL, { romanian: false, title: 'Merchant title', customizeLabel: 'My choices' });
  await expect(page.getByRole('heading', { name: 'Merchant title', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'My choices', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cookie preferences', exact: true });
  await expect(dialog.getByRole('heading', { name: 'Necessary', exact: true })).toBeVisible();
  await expect(dialog.getByText('2 cookies detected', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('Romanian labels preserve the consent payload and launcher uses the configured palette', async ({ page, baseURL }) => {
  const events = await fixture(page, baseURL, { preview: false });
  await page.getByRole('button', { name: 'Personalizează', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Analiză', exact: true }).check();
  await page.getByRole('button', { name: 'Salvează preferințele', exact: true }).click();
  await expect.poll(() => events.filter(event => event.categories).length).toBe(1);
  const consent = events.find(event => event.categories);
  expect(consent.categories).toEqual({ necessary: true, preferences: false, analytics: true, marketing: false, security: false, personalization: false, unknown: false });
  const launcher = page.getByRole('button', { name: 'Modifică preferințele cookie', exact: true });
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveCSS('background-color', 'rgb(217, 251, 79)');
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Preferințe cookie', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Analiză', exact: true })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Preferințe', exact: true })).not.toBeChecked();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('zion_privacy_synthetic_test')));
  expect(stored).toEqual(consent.categories);
});

for (const [label, allowed] of [['Doar necesare', false], ['Refuză opționalele', false], ['Acceptă toate', true]]) {
  test(`${label} keeps the existing native consent decision`, async ({ page, baseURL }) => {
    const events = await fixture(page, baseURL, { preview: false });
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect.poll(() => events.filter(event => event.categories).length).toBe(1);
    const consent = events.find(event => event.categories);
    expect(consent.categories.necessary).toBe(true);
    expect(Object.entries(consent.categories).filter(([key]) => key !== 'necessary').every(([, value]) => value === allowed)).toBe(true);
    await expect(page.getByRole('button', { name: 'Modifică preferințele cookie', exact: true })).toBeVisible();
  });
}

test('compact category summaries hide inventory without hiding consent controls', async ({ page, baseURL }) => {
  await fixture(page, baseURL, { showCookieDetails: false });
  await page.getByRole('button', { name: 'Personalizează', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Preferințe cookie', exact: true });
  await expect(dialog.locator('.zion-privacy-banner__cookie')).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: 'Analiză', exact: true })).toBeVisible();
  await expect(dialog.getByText('2 cookie-uri identificate', { exact: true })).toBeVisible();
});

test('the public preview never persists consent decisions', async ({ page, baseURL }) => {
  const events = await fixture(page, baseURL);
  await page.getByRole('button', { name: 'Acceptă toate', exact: true }).click();
  await expect(page.locator('[data-zion-privacy-banner-host]')).toHaveCount(0);
  expect(events).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('zion_privacy_synthetic_test'))).toBeNull();
});
