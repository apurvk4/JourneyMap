import { test, expect } from '@playwright/test';

test.describe('Generate User Documentation Screenshots', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.setTimeout(120_000);

  test('Capture comprehensive user guide screenshots', async ({ page }, testInfo) => {
    const shot = (name: string) => testInfo.outputPath(`${name}.png`);

    // ── 1. Landing Page ──
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: shot('01_landing') });

    // ── 2. Load Demo Data → Dark Dashboard ──
    const demoButton = page.locator('button[title="Load demo data"], button:has-text("Load demo data")').first();
    await demoButton.scrollIntoViewIfNeeded();
    await demoButton.click({ force: true });
    const clearBtn = page.getByRole('button', { name: 'Clear timeline', exact: true });
    await expect(clearBtn).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: shot('02_dashboard_dark') });

    // ── 3. Light Theme ──
    const lightBtn = page.getByRole('radio', { name: /light/i });
    await lightBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: shot('03_dashboard_light') });

    // Switch back to dark for remaining screenshots
    const darkBtn = page.getByRole('radio', { name: /dark/i });
    await darkBtn.click();
    await page.waitForTimeout(1000);

    // ── 4. Search ──
    const searchInput = page.getByPlaceholder(/search places/i);
    await searchInput.fill('Restaurant');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: shot('04_search') });
    await searchInput.fill('');
    await page.waitForTimeout(500);

    // ── 5. Activity Filter: Routes-only pill ──
    const routesPill = page.locator('button.pill', { hasText: 'Routes' });
    await routesPill.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: shot('05_routes_only') });

    // ── 6. Activity Filter: Visits-only pill ──
    const visitsPill = page.locator('button.pill', { hasText: 'Visits' });
    await visitsPill.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: shot('06_visits_only') });

    // Reset activity filters
    const showAllActivity = page.locator('.card', { has: page.locator('text=Activities') }).getByText('Show all');
    if (await showAllActivity.count() > 0) {
      await showAllActivity.click();
      await page.waitForTimeout(500);
    }

    // ── 7. Activity checkbox filter (select Flight only) ──
    const flightLabel = page.locator('label', { hasText: 'Flight' });
    await flightLabel.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: shot('07_flight_filter') });

    // Reset
    const showAllBtn2 = page.locator('.card', { has: page.locator('text=Activities') }).getByText('Show all');
    if (await showAllBtn2.count() > 0) {
      await showAllBtn2.click();
      await page.waitForTimeout(500);
    }

    // ── 8. Date Filter: Year selection → shows months ──
    const yearPill = page.getByRole('button', { name: '2024', exact: true });
    await yearPill.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: shot('08_date_year') });

    // ── 9. Date Filter: Month selection → shows days ──
    const marPill = page.locator('button.pill', { hasText: 'Mar' });
    await marPill.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: shot('09_date_month') });

    // ── 10. Date Filter: Day selection ──
    const day15Pill = page.locator('button.pill', { hasText: '15' });
    if (await day15Pill.count() > 0) {
      await day15Pill.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: shot('10_date_day') });
    }

    // ── 11. Date Filter: Navigation arrows (next) ──
    const nextBtn = page.getByRole('button', { name: 'Next date range' });
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: shot('11_date_nav_next') });
    }

    // Reset date to show all
    const showAllDate = page.locator('.card', { has: page.locator('text=Date') }).getByText('Show all');
    if (await showAllDate.count() > 0) {
      await showAllDate.click();
      await page.waitForTimeout(500);
    }

    // ── 12. Segment Selection → Route detail ──
    // Click first route segment (non-visit) for route detail
    const routeSegments = page.locator('.visit-item');
    const routeCount = await routeSegments.count();
    if (routeCount > 0) {
      await routeSegments.first().click({ force: true });
      await page.waitForTimeout(1500);
      // Scroll to show the selection
      await page.screenshot({ path: shot('12_segment_selected') });
    }

    // Deselect
    if (routeCount > 0) {
      await routeSegments.first().click({ force: true });
      await page.waitForTimeout(500);
    }

    // ── 13. Scroll down to show Statistics + Calendar ──
    const statsCard = page.locator('.card', { has: page.locator('text=Statistics') });
    if (await statsCard.count() > 0) {
      await statsCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: shot('13_statistics') });
    }

    // ── 14. Calendar Heatmap ──
    const calCard = page.locator('.card', { has: page.locator('text=Calendar') });
    if (await calCard.count() > 0) {
      await calCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      // Click a heatmap cell
      const cells = page.locator('.heatmap-cell');
      if (await cells.count() > 0) {
        await cells.first().click({ force: true });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: shot('14_calendar_heatmap') });
        // Reset
        const yearReset = page.getByRole('button', { name: '2024', exact: true });
        await yearReset.click();
        await page.waitForTimeout(500);
      }
    }

    // ── 15. Scroll down to Timeline list ──
    const timelineCard = page.locator('.card', { has: page.locator('h3:text("Timeline")') });
    if (await timelineCard.count() > 0) {
      await timelineCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: shot('15_timeline_list') });
    }

    // ── 16. Replay Playback ──
    const playBtn = page.getByRole('button', { name: 'Play', exact: true });
    await playBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: shot('16_replay_playing') });

    // ── 17. Replay Paused → show controls ──
    const pauseBtn = page.getByRole('button', { name: 'Pause', exact: true });
    if (await pauseBtn.count() > 0) {
      await pauseBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: shot('17_replay_paused') });
    }

    // ── 18. Export buttons (in footer) ──
    // Scroll footer into view
    const footer = page.locator('.footer');
    if (await footer.count() > 0) {
      await footer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      await page.screenshot({ path: shot('18_export_buttons') });
    }

    // ── 19. Northern India / Kashmir / Ladakh Administrative Border (Dark Mode) ──
    await page.evaluate(() => {
      const map = (window as unknown as { __map?: { jumpTo: (opts: unknown) => void } }).__map;
      if (map) {
        map.jumpTo({ center: [76.5, 34.0], zoom: 5.2 });
      }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: shot('19_india_boundary_kashmir_dark') });

    // ── 20. Northern India / Kashmir / Ladakh Administrative Border (Light Mode) ──
    const lightRadio = page.getByRole('radio', { name: /light/i });
    await lightRadio.click();
    await page.waitForTimeout(1500);
    const layersInLight = await page.evaluate(() => {
      const map = (window as unknown as { __map?: { getStyle: () => { layers: Array<{ id: string }> }; jumpTo: (opts: unknown) => void } }).__map;
      if (map) {
        map.jumpTo({ center: [76.5, 34.0], zoom: 5.2 });
        return map.getStyle().layers.map(l => l.id);
      }
      return [];
    });
    console.log('LAYERS IN LIGHT MODE:', layersInLight);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: shot('20_india_boundary_kashmir_light') });
  });
});
