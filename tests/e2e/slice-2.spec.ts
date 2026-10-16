// E2E-02: release → run → Fail → defect → Fixed → retest Pass → Closed (nguồn: spec Slice 2).
// ID kỹ thuật (build/env/result) lấy qua API; mọi hành vi nghiệp vụ thao tác trên UI.
import { expect, test } from '@playwright/test';
import { goTab } from './nav.js';

const API = 'http://localhost:3100';
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e2-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E Slice 2 ${suffix}`;

test('slice 2 fail-to-close', async ({ page, request }) => {
  let token = '';
  let projectId = '';
  let envId = '';
  let build2Id = '';

  async function apiGet(path: string) {
    const res = await request.get(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (await res.json()) as never;
  }

  await test.step('đăng ký + đăng nhập', async () => {
    await request.post(`${API}/api/auth/register`, { data: { email, password } });
    const login = await request.post(`${API}/api/auth/login`, { data: { email, password } });
    token = ((await login.json()) as { accessToken: string }).accessToken;
    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Đã đăng nhập')).toBeVisible();
  });

  await test.step('tạo project + release + build + env trên UI', async () => {
    await page.getByPlaceholder('Tên project').fill(projectName);
    await page.getByRole('button', { name: 'Tạo project' }).click();
    await page.getByRole('button', { name: new RegExp(projectName) }).click();
    await goTab(page, 'Release');
    await page.getByPlaceholder('Tên release').fill('v1');
    await page.getByRole('button', { name: 'Tạo release' }).click();
    const releaseItem = page.locator('li', { hasText: 'v1' }).first();
    await expect(releaseItem).toBeVisible();
    await releaseItem.getByPlaceholder('Build number').fill('1');
    await releaseItem.getByRole('button', { name: 'Thêm build' }).click();
    await expect(releaseItem.getByText('1').first()).toBeVisible();
    await page.getByPlaceholder('Tên môi trường').fill('Test');
    await page.getByRole('button', { name: 'Thêm environment' }).click();
    await expect(page.getByText('Test').first()).toBeVisible();

    const projects = (await apiGet('/api/projects')) as Array<{ id: string; name: string }>;
    projectId = projects.find((p) => p.name === projectName)?.id ?? '';
    const envs = (await apiGet(`/api/projects/${projectId}/environments`)) as Array<{
      id: string;
    }>;
    envId = envs[0]?.id ?? '';
    expect(projectId).not.toBe('');
    expect(envId).not.toBe('');

    const suite = await request.post(`${API}/api/projects/${projectId}/suites`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Smoke' },
    });
    const suiteId = ((await suite.json()) as { id: string }).id;
    await request.post(`${API}/api/projects/${projectId}/test-cases`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Case lỗi E2E', suiteId, expectedResult: 'OK' },
    });
  });

  await test.step('lập run, ghi Fail, hoàn tất trên UI', async () => {
    await goTab(page, 'Lượt chạy');
    await page.getByPlaceholder('Tên run').fill('Run E2E2');
    const runSection = page
      .locator('div', {
        has: page.getByRole('button', { name: 'Lập run' }),
      })
      .last();
    await runSection.getByRole('button', { name: 'Tải lại runs' }).click();
    const selects = runSection.locator('select');
    await selects.nth(0).selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });
    await selects.nth(2).selectOption({ index: 1 });
    await selects.nth(3).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Lập run' }).click();
    await expect(page.getByText('Run E2E2')).toBeVisible();
    await page.getByRole('button', { name: /Run E2E2/ }).click();
    const firstItem = page.locator('ol li').first();
    await firstItem.locator('select').selectOption('FAIL');
    await page.getByPlaceholder('Actual result (FAIL bắt buộc)').fill('Crash E2E');
    await page.getByRole('button', { name: 'Ghi kết quả' }).click();
    await expect(page.getByText('FAIL').first()).toBeVisible();
    await page.getByRole('button', { name: 'Hoàn tất run' }).click();
    await expect(page.getByText('FINALIZED')).toBeVisible();
  });

  let bugCode = '';
  await test.step('tạo defect từ Fail, đi tới IN_PROGRESS', async () => {
    await goTab(page, 'Lượt chạy');
    await page.getByRole('button', { name: 'Tạo defect từ Fail này' }).click();
    await goTab(page, 'Defect');
    const defectSection = page
      .locator('div', {
        has: page.getByRole('button', { name: 'Tạo defect' }),
      })
      .last();
    await defectSection.getByRole('button', { name: 'Tải lại defects' }).click();
    const defects = (await apiGet(`/api/projects/${projectId}/defects`)) as Array<{
      id: string;
      code: string;
    }>;
    bugCode = defects[0]?.code ?? '';
    expect(bugCode).not.toBe('');
    await page.getByRole('button', { name: new RegExp(bugCode) }).click();
    for (const to of ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS']) {
      await page.getByRole('button', { name: `→ ${to}` }).click();
      await expect(page.getByText(`[${to}]`).first()).toBeVisible();
    }
  });

  await test.step('thêm build 2, FIXED, tạo retest run', async () => {
    await goTab(page, 'Release');
    const releaseItem = page.locator('li', { hasText: 'v1' }).first();
    await releaseItem.getByPlaceholder('Build number').fill('2');
    await releaseItem.getByRole('button', { name: 'Thêm build' }).click();
    const builds = (await apiGet(`/api/projects/${projectId}/releases`)) as Array<{
      builds: Array<{ id: string; number: string }>;
    }>;
    build2Id = builds[0]?.builds.find((b) => b.number === '2')?.id ?? '';
    expect(build2Id).not.toBe('');
    await goTab(page, 'Defect');
    await page.getByRole('button', { name: new RegExp(bugCode) }).click();
    await page.getByPlaceholder('Fixed build ID (khi FIXED)').fill(build2Id);
    await page.getByRole('button', { name: '→ FIXED' }).click();
    await expect(page.getByText('[FIXED]').first()).toBeVisible();
    await page.getByPlaceholder('Build ID để retest').fill(build2Id);
    await page.getByPlaceholder('Environment ID để retest').fill(envId);
    await page.getByRole('button', { name: 'Tạo retest run' }).click();
    await expect(page.getByText('[RETEST]').first()).toBeVisible();
  });

  await test.step('ghi PASS ở retest run rồi chốt CLOSED', async () => {
    await goTab(page, 'Defect');
    await page.getByRole('button', { name: new RegExp(bugCode) }).click();
    const runs = (await apiGet(`/api/projects/${projectId}/runs`)) as Array<{
      id: string;
      name: string;
    }>;
    const retestRunId = runs.find((r) => r.name.startsWith('Retest'))?.id ?? '';
    expect(retestRunId).not.toBe('');
    const detail = (await apiGet(`/api/projects/${projectId}/runs/${retestRunId}`)) as {
      items: Array<{ id: string }>;
    };
    const itemId = detail.items[0]?.id ?? '';
    await request.post(
      `${API}/api/projects/${projectId}/runs/${retestRunId}/items/${itemId}/result`,
      { headers: { Authorization: `Bearer ${token}` }, data: { status: 'PASS' } },
    );
    const retestDetail = (await apiGet(`/api/projects/${projectId}/runs/${retestRunId}`)) as {
      items: Array<{ results: Array<{ id: string }> }>;
    };
    const resultId = retestDetail.items[0]?.results[0]?.id ?? '';
    expect(resultId).not.toBe('');
    await page.getByPlaceholder('Result ID để chốt').fill(resultId);
    await page.getByRole('button', { name: /Chốt retest/ }).click();
    await expect(page.getByText('[CLOSED]').first()).toBeVisible();
  });
});
