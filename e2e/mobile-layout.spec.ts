import { test, expect } from '@playwright/test';

test.describe('Mobile layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            try {
                localStorage.setItem('timeline_persistence_enabled', 'false');
                localStorage.clear();
                sessionStorage.clear();
            } catch {
                // Ignore storage access issues in a restricted browser context.
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
        await page.goto('/');
    });

    test('shows mobile header and toggles drawer', async ({ page }) => {
        // Emulate a narrow viewport
        await page.setViewportSize({ width: 420, height: 800 });

        // Wait for app to render
        await page.waitForSelector('.header');

        // Mobile drawer toggle should be visible
        const toggle = page.locator('.mobile-drawer-toggle');
        await expect(toggle).toBeVisible();

        // Click to open drawer
        await toggle.click();

        // Backdrop should appear
        await expect(page.locator('.drawer-backdrop')).toBeVisible();

        // Drawer panel should be visible and contain expected controls
        const drawer = page.locator('.mobile-drawer');
        await expect(drawer).toBeVisible();
        await expect(drawer.locator('.mobile-drawer-content >> text=Search')).toBeVisible();

        // Close via the drawer's close action instead of the backdrop, which is intentionally behind the panel.
        await page.getByRole('button', { name: 'Close menu' }).click();
        await expect(drawer).not.toBeVisible();
    });

    test('header shows status and demo/clear buttons when timeline loaded', async ({ page }) => {
        await page.setViewportSize({ width: 420, height: 800 });

        const demoBtn = page.locator('button[title="Load demo data"], button:has-text("Load demo data")').first();
        await expect(demoBtn).toBeVisible();
        await demoBtn.evaluate((button) => {
            (button as HTMLButtonElement).click();
        });

        await page.waitForTimeout(300);

        await page.getByRole('button', { name: 'Open settings' }).click();

        const clearBtn = page.getByRole('button', { name: 'Clear timeline' }).first();
        await expect(clearBtn).toBeVisible();
        await clearBtn.click();

        await expect(page.locator('.upload-landing').first()).toBeVisible();
    });

    test('opens a floating settings menu on mobile for overflow actions', async ({ page }) => {
        await page.setViewportSize({ width: 420, height: 800 });

        const demoBtn = page.locator('button[title="Load demo data"], button:has-text("Load demo data")').first();
        await expect(demoBtn).toBeVisible();
        await demoBtn.click();

        await page.waitForTimeout(300);

        await page.getByRole('button', { name: 'Open settings' }).click();

        await expect(page.locator('.mobile-settings-menu')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Clear timeline' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Demo' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load different file' }).first()).toBeVisible();
    });
});
