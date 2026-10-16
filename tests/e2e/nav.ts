// Helper điều hướng tab sidebar trong e2e.
import type { Page } from '@playwright/test';

export async function goTab(page: Page, name: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Module' })
    .getByRole('button', { name, exact: true })
    .click();
}
