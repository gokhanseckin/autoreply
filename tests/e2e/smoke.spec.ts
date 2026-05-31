import { test, expect } from '@playwright/test';

test('homepage renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Instagram DM Automation')).toBeVisible();
});

test('privacy policy renders TR and EN', async ({ page }) => {
  await page.goto('/p/tr');
  await expect(page.getByText('Veri Sorumlusu')).toBeVisible();
  await page.goto('/p/en');
  await expect(page.getByText('Data controller')).toBeVisible();
});

test('terms of service renders TR and EN', async ({ page }) => {
  await page.goto('/terms/tr');
  await expect(page.getByText('Kullanım Koşulları')).toBeVisible();
  await page.goto('/terms/en');
  await expect(page.getByText('Terms of Service')).toBeVisible();
});
