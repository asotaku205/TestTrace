// E2E-06: gate Fail → drill-down → run mới → Pass → export CSV (nguồn: spec Slice 6).
import { expect, test } from '@playwright/test';

const API = 'http://localhost:3100';
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e6-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E Slice 6 ${suffix}`;

test('slice 6 release assurance', async ({ page, request }) => {
  let token = '';
  let projectId = '';
  let requirementId = '';
  let buildId = '';

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

  await test.step('requirement rủi ro cao + release/build/env', async () => {
    await page.getByPlaceholder('Tiêu đề requirement').fill('Tính phí E2E6');
    await page.getByRole('button', { name: 'Tạo requirement' }).click();
    const reqs = (await apiGet(`/api/projects/${projectId}/requirements`)) as Array<{
      id: string;
    }>;
    requirementId = reqs[0]?.id ?? '';
    const riskRes = await request.put(
      `${API}/api/projects/${projectId}/requirements/${requirementId}/risk`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { impact: 5, likelihood: 4 },
      },
    );
    expect(riskRes.status()).toBe(200);
    const reqRow = page.locator('li', { hasText: 'Tính phí E2E6' }).first();
    await reqRow.getByRole('button', { name: 'Duyệt' }).click();

    await page.getByPlaceholder('Tên release').fill('v1');
    await page.getByRole('button', { name: 'Tạo release' }).click();
    const relItem = page.locator('li', { hasText: 'v1' }).first();
    await relItem.getByPlaceholder('Build number').fill('1');
    await relItem.getByRole('button', { name: 'Thêm build' }).click();
    await page.getByPlaceholder('Tên môi trường').fill('Test');
    await page.getByRole('button', { name: 'Thêm environment' }).click();
    const releases = (await apiGet(`/api/projects/${projectId}/releases`)) as Array<{
      id: string;
      builds: Array<{ id: string }>;
    }>;
    buildId = releases[0]?.builds[0]?.id ?? '';
    expect(buildId).not.toBe('');
  });

  await test.step('tạo gate, publish, evaluate Fail', async () => {
    await page.getByPlaceholder('Tên gate').fill('Release gate');
    await page
      .getByPlaceholder('Luật YAML')
      .fill('uncovered_high_risk_requirements: 0\nopen_critical_defects: 0\n');
    await page.getByRole('button', { name: 'Tạo gate' }).click();
    await expect(page.getByText('Release gate').first()).toBeVisible();
    await page.getByRole('button', { name: 'Publish v1' }).click();
    await page.getByPlaceholder('Build ID để evaluate').fill(buildId);
    await page.getByRole('button', { name: 'Evaluate' }).click();
    await expect(page.getByText(/FAIL/).first()).toBeVisible();
  });

  await test.step('drill-down RTM rồi cover bằng test + run mới', async () => {
    await page.getByRole('button', { name: 'Tải lại RTM' }).click();
    await expect(page.locator('td', { hasText: 'UNCOVERED' }).first()).toBeVisible();

    await page.getByPlaceholder('Tiêu đề test').fill('Test phí E2E6');
    await page.getByRole('button', { name: 'Tạo test' }).click();
    await page.getByRole('button', { name: /TC-001/ }).click();
    await page.getByPlaceholder('Expected result').fill('OK');
    await page.getByRole('button', { name: 'Lưu expected' }).click();
    await page.getByPlaceholder('Requirement ID để gắn link').fill(requirementId);
    await page.getByRole('button', { name: 'Gắn requirement' }).click();
    await page.getByRole('button', { name: 'Duyệt READY' }).click();

    const runSection = page.locator('div', { hasText: 'Test run' }).last();
    await runSection.getByRole('button', { name: 'Tải lại runs' }).click();
    await page.getByPlaceholder('Tên run').fill('Run E2E6');
    const selects = runSection.locator('select');
    await selects.nth(0).selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });
    await selects.nth(2).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Lập run' }).click();
    await page.getByRole('button', { name: /Run E2E6/ }).click();
    const item = page.locator('ol li').first();
    await item.locator('select').selectOption('PASS');
    await page.getByRole('button', { name: 'Ghi kết quả' }).click();
    await page.getByRole('button', { name: 'Hoàn tất run' }).click();
  });

  await test.step('evaluate lại Pass và export CSV', async () => {
    await page.getByPlaceholder('Build ID để evaluate').fill(buildId);
    await page.getByRole('button', { name: 'Evaluate' }).click();
    await expect(page.getByText(/PASS/).first()).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Tải RTM' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
  });
});
