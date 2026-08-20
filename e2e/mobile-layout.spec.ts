import { test, expect } from '@playwright/test';

test.describe('Mobile layout', () => {
    test.beforeEach(async ({ page }) => {
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

        // Close by clicking backdrop
        await page.locator('.drawer-backdrop').click();
        await expect(drawer).not.toBeVisible();
    });

    test('header shows status and demo/clear buttons when timeline loaded', async ({ page }) => {
        await page.setViewportSize({ width: 420, height: 800 });

        // Load demo using header Demo button (select by title to avoid duplicates)
        const demoBtn = page.locator('button[title="Load demo data"]');
        await expect(demoBtn).toBeVisible();
        await demoBtn.click();

        // Wait a moment for the timeline to load and dashboard to appear
        await page.waitForTimeout(300);

        // Click the global Clear timeline button and verify upload landing returns
        const clearBtn = page.getByRole('button', { name: 'Clear timeline' });
        await expect(clearBtn).toBeVisible();
        await clearBtn.click();

        // After clearing, upload landing should be visible again
        await expect(page.locator('.upload-landing').first()).toBeVisible();
    });
});
