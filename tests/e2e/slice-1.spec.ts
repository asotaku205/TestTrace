// E2E-01: luồng Slice 1 hoàn chỉnh trên UI thật (nguồn: spec Slice 1 demo cuối slice).
// project → requirement (risk + criteria + approve) → test (steps + expected + link + READY) → audit.
import { expect, test } from '@playwright/test';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e1-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E Slice 1 ${suffix}`;
const requirementTitle = 'Tính phí E2E';
const testTitle = 'Test phí E2E';

test('slice 1 end-to-end', async ({ page, request }) => {
  await test.step('đăng ký qua API rồi đăng nhập trên UI', async () => {
    await request.post('http://localhost:3100/api/auth/register', {
      data: { email, password },
    });
    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Đã đăng nhập')).toBeVisible();
  });

  await test.step('tạo project', async () => {
    await page.getByPlaceholder('Tên project').fill(projectName);
    await page.getByRole('button', { name: 'Tạo project' }).click();
    await expect(page.getByRole('button', { name: new RegExp(projectName) })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(projectName) }).click();
  });

  let requirementId = '';
  await test.step('tạo requirement + criteria + risk + duyệt', async () => {
    await page.getByPlaceholder('Tiêu đề requirement').fill(requirementTitle);
    await page.getByRole('button', { name: 'Tạo requirement' }).click();
    await expect(page.getByText('REQ-001')).toBeVisible();
    await page.getByPlaceholder('Thêm acceptance criteria').fill('Có phí khi ngoại thành');
    await page.getByRole('button', { name: 'Thêm', exact: true }).click();
    await expect(page.getByText('Có phí khi ngoại thành')).toBeVisible();
    const reqItem = page.locator('li', { hasText: requirementTitle }).first();
    await reqItem.getByRole('button', { name: 'Duyệt' }).click();
    await expect(page.getByText('APPROVED').first()).toBeVisible();

    const login = await request.post('http://localhost:3100/api/auth/login', {
      data: { email, password },
    });
    const token = (await login.json()).accessToken as string;
    const projects = await request.get('http://localhost:3100/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const project = ((await projects.json()) as Array<{ id: string; name: string }>).find(
      (p) => p.name === projectName,
    );
    const reqs = await request.get(
      `http://localhost:3100/api/projects/${project?.id}/requirements`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    requirementId = (((await reqs.json()) as Array<{ id: string }>)[0]?.id ?? '') as string;
    expect(requirementId).not.toBe('');
  });

  await test.step('tạo test + steps + expected + link + READY', async () => {
    await page.getByPlaceholder('Tiêu đề test').fill(testTitle);
    await page.getByRole('button', { name: 'Tạo test' }).click();
    await expect(page.getByText('TC-001')).toBeVisible();
    await page.getByRole('button', { name: new RegExp(`${testTitle}`) }).click();
    await page.getByPlaceholder('Thêm step').fill('Nhập địa chỉ ngoại thành');
    await page.getByRole('button', { name: 'Thêm step' }).click();
    await expect(page.getByText('Nhập địa chỉ ngoại thành')).toBeVisible();
    await page.getByPlaceholder('Expected result').fill('Hiện phí ship 30k');
    await page.getByRole('button', { name: 'Lưu expected' }).click();
    await page.getByPlaceholder('Requirement ID để gắn link').fill(requirementId);
    await page.getByRole('button', { name: 'Gắn requirement' }).click();
    await page.getByRole('button', { name: 'Duyệt READY' }).click();
    await expect(page.getByText('[READY]').first()).toBeVisible();
  });

  await test.step('audit ghi nhận luồng', async () => {
    const audit = page.locator('div', { has: page.getByText('Nhật ký hoạt động') }).last();
    await audit.getByRole('button', { name: 'Tải lại' }).click();
    await expect(page.getByText('requirement.approved').first()).toBeVisible();
    await expect(page.getByText('test.ready').first()).toBeVisible();
  });
});
