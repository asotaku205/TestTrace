// E2E-04: cùng thuật toán JS + Python → CFG tương đương → draft → duyệt → test case (nguồn: spec Slice 4).
import { expect, test } from '@playwright/test';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e4-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E Slice 4 ${suffix}`;

const JS_SOURCE = `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`;

const PY_SOURCE = `def fee(total):
    if total > 100:
        return 0
    else:
        return 5`;

test('slice 4 cfg-to-test hai ngôn ngữ', async ({ page }) => {
  await test.step('đăng ký, đăng nhập, tạo project', async () => {
    await page.request.post('http://localhost:3100/api/auth/register', {
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

  await test.step('phân tích cùng thuật toán ở hai ngôn ngữ', async () => {
    await page.getByPlaceholder('Dán function cần phân tích').fill(JS_SOURCE);
    await page.getByRole('button', { name: 'Phân tích' }).click();
    await expect(page.getByText('[SUCCEEDED]').first()).toBeVisible();
    await page
      .locator('div', { has: page.getByPlaceholder('Dán function cần phân tích') })
      .last()
      .getByLabel('Ngôn ngữ')
      .selectOption('python');
    await page.getByPlaceholder('Dán function cần phân tích').fill(PY_SOURCE);
    await page.getByRole('button', { name: 'Phân tích' }).click();
    const succeeded = page.locator('li', { hasText: '[SUCCEEDED]' });
    await expect(succeeded).toHaveCount(2);
  });

  await test.step('CFG tương đương: cùng complexity 2', async () => {
    await page.locator('li', { hasText: '[SUCCEEDED]' }).first().getByRole('button').click();
    await expect(page.getByText('Complexity: 2')).toBeVisible();
  });

  await test.step('chọn path, sinh draft, duyệt thành test case', async () => {
    await page.getByLabel('Path').selectOption('0');
    await page.getByRole('button', { name: 'Sinh draft từ path' }).click();
    await expect(page.getByText(/Đã sinh draft:/)).toBeVisible();
    await page.getByRole('button', { name: 'Tải lại drafts' }).click();
    const draftsSection = page.locator('div', { hasText: 'Test draft chờ duyệt' }).last();
    const row = draftsSection.locator('li').first();
    await row.getByPlaceholder('Tiêu đề test khi duyệt').fill('Test phí từ draft');
    await row.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(page.getByText('Test draft chờ duyệt (0)')).toBeVisible();
    await page.getByPlaceholder('Tìm mã/tiêu đề').fill('Test phí từ draft');
    await page.getByRole('button', { name: 'Tìm' }).click();
    await expect(page.getByText('Test phí từ draft').first()).toBeVisible();
  });
});
