// E2E-03: dán hàm → CFG + complexity/paths → highlight → export (nguồn: spec Slice 3).
import { expect, test } from '@playwright/test';
import { goTab } from './nav.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e3-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E Slice 3 ${suffix}`;

const SOURCE = `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`;

test('slice 3 cfg demo', async ({ page, request }) => {
  await test.step('đăng ký + đăng nhập + tạo project', async () => {
    await request.post('http://localhost:3100/api/auth/register', {
      data: { email, password },
    });
    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Đã đăng nhập')).toBeVisible();
    await page.getByPlaceholder('Tên project').fill(projectName);
    await page.getByRole('button', { name: 'Tạo project' }).click();
    await page.getByRole('button', { name: new RegExp(projectName) }).click();
  });

  await test.step('phân tích và xem metrics', async () => {
    await goTab(page, 'Analysis Lab');
    await page.getByPlaceholder('Dán function cần phân tích').fill(SOURCE);
    await page.getByRole('button', { name: 'Phân tích' }).click();
    // Modal kết quả tự mở sau phân tích
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByTestId('metric-Complexity').getByText('2', { exact: true })).toBeVisible();
    await expect(page.getByTestId('metric-Nodes')).toContainText('5 edges');
  });

  await test.step('click node highlight đúng dòng code', async () => {
    // Modal đang mở từ bước trước
    await page.locator('svg g[data-node-type="DECISION"]').first().click();
    const line = page.locator('pre div', { hasText: 'if (total > 100)' }).first();
    await expect(line).toHaveCSS('background-color', 'rgb(255, 241, 118)');
  });

  await test.step('path explorer + export JSON/SVG', async () => {
    await page.getByLabel('Path').selectOption('0');
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const jsonFile = await jsonDownload;
    expect(jsonFile.suggestedFilename()).toBe('cfg.json');
    const svgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export SVG' }).click();
    const svgFile = await svgDownload;
    expect(svgFile.suggestedFilename()).toBe('cfg.svg');
    await page.getByRole('dialog').getByLabel('Đóng').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  await test.step('cú pháp lỗi báo FAILED + diagnostic', async () => {
    await page.getByPlaceholder('Dán function cần phân tích').fill('function broken( {');
    await page.getByRole('button', { name: 'Phân tích' }).click();
    await expect(page.getByText('FAILED').first()).toBeVisible();
    await page.getByRole('dialog').getByLabel('Đóng').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
