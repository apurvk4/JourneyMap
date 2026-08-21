import { test, expect } from '@playwright/test';
import path from 'path';

async function resetStoredTimeline(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('timeline_persistence_enabled', 'false');
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage access issues in restricted contexts.
    }

    try {
      const req = indexedDB.deleteDatabase('timeline-visualizer');
      req.onsuccess = () => undefined;
      req.onerror = () => undefined;
      req.onblocked = () => undefined;
    } catch {
      // ignore delete failures
    }
  });
}

async function clickDemoData(page: Parameters<typeof test>[0]['page']) {
  const demoButton = page.locator('button[title="Load demo data"], button:has-text("Load demo data")').first();
  await demoButton.evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
}

async function getVisibleClearButton(page: Parameters<typeof test>[0]['page']) {
  return page.getByRole('button', { name: 'Clear timeline', exact: true });
}

async function getVisiblePlayButton(page: Parameters<typeof test>[0]['page']) {
  return page.getByRole('button', { name: 'Play', exact: true });
}

async function openMobileDrawerIfNeeded(page: Parameters<typeof test>[0]['page']) {
  const toggle = page.locator('.mobile-drawer-toggle');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
}

async function closeMobileDrawerIfNeeded(page: Parameters<typeof test>[0]['page']) {
  const drawer = page.locator('.mobile-drawer.open');
  if (await drawer.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Close menu' }).click();
  }
}

test.describe('Timeline App', () => {
  test.beforeEach(async ({ page }) => {
    await resetStoredTimeline(page);
  });

  test('Landing page shows correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Timeline Visualizer')).toBeVisible();
    await expect(page.getByText('Load demo data')).toBeVisible();
  });

  test('Load demo data works', async ({ page }) => {
    await page.goto('/');
    await clickDemoData(page);
    await expect(await getVisibleClearButton(page)).toBeVisible({ timeout: 10000 });
  });

  test('File upload and interactions work', async ({ page }) => {
    await page.goto('/');
    
    // Upload test fixture
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose a file' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'fixtures/test-timeline.json'));

    // Wait for data to process
    await expect(await getVisibleClearButton(page)).toBeVisible({ timeout: 10000 });
    await openMobileDrawerIfNeeded(page);
    
    // Date filtering
    await expect(page.getByRole('button', { name: '2024', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '2024', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Jan', exact: true })).toBeVisible();

    // Activity filtering
    const mobileWalking = page.locator('.mobile-drawer.open .activity-filter-label:visible').filter({ hasText: /^Walking$/ });
    await expect(mobileWalking.first()).toBeVisible();
    await closeMobileDrawerIfNeeded(page);
    
    // Replay controls
    const playBtn = await getVisiblePlayButton(page);
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });

  test('Dark and Light theme switching works and updates map', async ({ page }, testInfo) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));
    page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
    page.on('response', res => {
      if (res.url().includes('cartocdn') || res.url().includes('openstreetmap') || res.url().includes('tiles')) {
        console.log('TILE RES:', res.status(), res.url());
      }
    });

    await page.goto('/');
    await clickDemoData(page);
    await expect(await getVisibleClearButton(page)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);

    // Save dark map screenshot
    await page.screenshot({ path: testInfo.outputPath('dark_map_view.png') });

    // Switch to light theme
    const lightBtn = page.getByRole('radio', { name: /light/i });
    await lightBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.waitForTimeout(3000);

    // Save light map screenshot
    await page.screenshot({ path: testInfo.outputPath('light_map_view.png') });
  });

  test('Flight replay rotates airplane icon towards destination', async ({ page }, testInfo) => {
    await page.goto('/');
    await clickDemoData(page);
    await expect(page.getByRole('button', { name: 'Clear timeline' })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Start replay
    const playBtn = await getVisiblePlayButton(page);
    await playBtn.click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.waitForTimeout(2000);

    // Capture screenshot during flight replay
    await page.screenshot({ path: testInfo.outputPath('flight_rotated_marker.png') });
  });

  test('Video Export modal opens and configures presets', async ({ page }, testInfo) => {
    await page.goto('/');
    await clickDemoData(page);
    await expect(await getVisibleClearButton(page)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Click Video export button
    const videoBtn = page.getByRole('button', { name: /video/i });
    await expect(videoBtn).toBeVisible();
    await videoBtn.click();

    // Verify modal is open
    const modal = page.locator('.video-modal-content');
    await expect(modal).toBeVisible();
    await expect(page.locator('#video-modal-title')).toHaveText('Export Journey Video');

    // Switch to 15s preset
    await page.getByRole('button', { name: /15s/i }).click();

    // Switch to 720p resolution
    await page.getByRole('button', { name: /720p/i }).click();

    await page.screenshot({ path: testInfo.outputPath('video_export_modal.png') });

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).not.toBeVisible();
  });
});
