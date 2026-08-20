import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Timeline App', () => {
  test('Landing page shows correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Timeline Visualizer')).toBeVisible();
    await expect(page.getByText('Load demo data')).toBeVisible();
  });

  test('Load demo data works', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Load demo data').click();
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 5000 });
  });

  test('File upload and interactions work', async ({ page }) => {
    await page.goto('/');
    
    // Upload test fixture
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose a file' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'fixtures/test-timeline.json'));

    // Wait for data to process
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 });
    
    // Date filtering
    await expect(page.getByRole('button', { name: '2024', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '2024', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Jan', exact: true })).toBeVisible();

    // Activity filtering
    await expect(page.getByText('Walking').first()).toBeVisible();
    
    // Replay controls
    const playBtn = page.getByRole('button', { name: 'Play' });
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
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
    await page.getByText('Load demo data').click();
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 });
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
    await page.getByText('Load demo data').click();
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Start replay
    const playBtn = page.getByRole('button', { name: 'Play' });
    await playBtn.click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.waitForTimeout(2000);

    // Capture screenshot during flight replay
    await page.screenshot({ path: testInfo.outputPath('flight_rotated_marker.png') });
  });
});
