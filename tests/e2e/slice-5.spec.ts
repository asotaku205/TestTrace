// E2E-05: Trusted → đổi code → diff → regression → Stale (nguồn: spec Slice 5).
import { expect, test } from '@playwright/test';
import { goTab } from './nav.js';

const API = 'http://localhost:3100';
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e5-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E Slice 5 ${suffix}`;

const V1 = `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`;
const V2 = `function fee(total) {
  if (total >= 100) {
    return 0;
  } else {
    return 5;
  }
}`;

test('slice 5 trusted-to-stale', async ({ page, request }) => {
  let token = '';
  let projectId = '';
  let requirementId = '';

  async function apiGet(path: string) {
    const res = await request.get(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await res.json()) as never;
  }

  await test.step('đăng ký, đăng nhập, tạo project', async () => {
    await request.post(`${API}/api/auth/register`, { data: { email, password } });
    const login = await request.post(`${API}/api/auth/login`, { data: { email, password } });
    token = ((await login.json()) as { accessToken: string }).accessToken;
    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Đã đăng nhập')).toBeVisible();
    await page.getByPlaceholder('Tên project').fill(projectName);
    await page.getByRole('button', { name: 'Tạo project' }).click();
    await page.getByRole('button', { name: new RegExp(projectName) }).click();
    const projects = (await apiGet('/api/projects')) as Array<{ id: string; name: string }>;
    projectId = projects.find((p) => p.name === projectName)?.id ?? '';
    expect(projectId).not.toBe('');
  });

  await test.step('requirement + approve + link code + test READY', async () => {
    await goTab(page, 'Requirement');
    await page.getByPlaceholder('Tiêu đề requirement').fill('Tính phí E2E5');
    await page.getByRole('button', { name: 'Tạo requirement' }).click();
    await expect(page.getByText('REQ-001').first()).toBeVisible();
    const reqs = (await apiGet(`/api/projects/${projectId}/requirements`)) as Array<{
      id: string;
    }>;
    requirementId = reqs[0]?.id ?? '';
    const reqRow = page.locator('li', { hasText: 'Tính phí E2E5' }).first();
    await reqRow.getByRole('button', { name: 'Duyệt' }).click();
    await expect(page.getByText('APPROVED').first()).toBeVisible();

    await goTab(page, 'Analysis Lab');
    await page.getByPlaceholder('Dán function cần phân tích').fill(V1);
    await page.getByRole('button', { name: 'Phân tích' }).click();
    await expect(page.getByText('SUCCEEDED').first()).toBeVisible();
    await page.getByRole('dialog').getByLabel('Đóng').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await goTab(page, 'Code registry');
    await page.getByPlaceholder('Requirement ID để gắn unit').fill(requirementId);
    await page.getByRole('button', { name: 'Tải lại registry' }).click();
    await page.getByRole('button', { name: /fee.*\(1 versions\)/ }).click();
    await page.getByRole('button', { name: 'Gắn unit' }).click();

    await goTab(page, 'Kho test');
    await page.getByPlaceholder('Tiêu đề test').fill('Test phí E2E5');
    await page.getByRole('button', { name: 'Tạo test' }).click();
    await page.getByRole('button', { name: /TC-001/ }).click();
    await page.getByPlaceholder('Expected result').fill('OK');
    await page.getByRole('button', { name: 'Lưu expected' }).click();
    await page.getByPlaceholder('Requirement ID để gắn link').fill(requirementId);
    await page.getByRole('button', { name: 'Gắn requirement' }).click();
    await page.getByRole('button', { name: 'Duyệt READY' }).click();
    await page.getByRole('dialog').getByLabel('Đóng').click();
    await expect(page.getByText('[READY]').first()).toBeVisible();
  });

  await test.step('release + run PASS + finalize → RTM TRUSTED', async () => {
    await goTab(page, 'Release');
    await page.getByPlaceholder('Tên release').fill('v1');
    await page.getByRole('button', { name: 'Tạo release' }).click();
    const relItem = page.locator('li', { hasText: 'v1' }).first();
    await relItem.getByPlaceholder('Build number').fill('1');
    await relItem.getByRole('button', { name: 'Thêm build' }).click();
    await page.getByPlaceholder('Tên môi trường').fill('Test');
    await page.getByRole('button', { name: 'Thêm environment' }).click();

    await goTab(page, 'Lượt chạy');
    const runSection = page.locator('div', { hasText: 'Test run' }).last();
    await runSection.getByRole('button', { name: 'Tải lại runs' }).click();
    await page.getByPlaceholder('Tên run').fill('Run E2E5');
    const selects = runSection.locator('select');
    await selects.nth(0).selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });
    await selects.nth(2).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Lập run' }).click();
    await page.getByRole('button', { name: /Run E2E5/ }).click();
    const item = page.locator('ol li').first();
    await item.locator('select').selectOption('PASS');
    await page.getByRole('button', { name: 'Ghi kết quả' }).click();
    await page.getByRole('button', { name: 'Hoàn tất run' }).click();
    await expect(page.getByText('FINALIZED')).toBeVisible();

    await goTab(page, 'RTM');
    await page.getByRole('button', { name: 'Tải lại RTM' }).click();
    await expect(page.locator('td', { hasText: 'TRUSTED' }).first()).toBeVisible();
  });

  await test.step('đổi điều kiện → diff → regression → STALE', async () => {
    await goTab(page, 'Analysis Lab');
    await page.getByPlaceholder('Dán function cần phân tích').fill(V2);
    await page.getByRole('button', { name: 'Phân tích' }).click();
    await expect(page.getByText('SUCCEEDED').nth(1)).toBeVisible();
    await page.getByRole('dialog').getByLabel('Đóng').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await goTab(page, 'Impact');
    const impactSection = page.locator('div', { hasText: 'Change Impact' }).last();
    await impactSection.getByRole('button', { name: 'Tải lại impact' }).click();
    const combos = impactSection.getByRole('combobox');
    await combos.first().selectOption({ index: 1 });
    const versionSelects = impactSection.getByRole('combobox');
    await versionSelects.nth(1).selectOption({ index: 1 });
    await versionSelects.nth(2).selectOption({ index: 2 });
    await page.getByRole('button', { name: 'So sánh' }).click();
    await expect(page.getByText('DIRECT_LINK').first()).toBeVisible();

    await goTab(page, 'RTM');
    await page.getByRole('button', { name: 'Tải lại RTM' }).click();
    await expect(page.locator('td', { hasText: 'STALE' }).first()).toBeVisible();
  });
});
