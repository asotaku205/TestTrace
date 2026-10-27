// E2E chuyên biệt: modal chi tiết test case (đóng 3 cách, toast, race guard).
import { expect, test } from '@playwright/test';
import { goTab } from './nav.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `modal-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E Modal ${suffix}`;
const caseTitle = 'Test modal E2E';

test('test case modal: đóng, toast clone, không mở lại khi đóng nhanh', async ({
  page,
  request,
}) => {
  await test.step('đăng ký qua API, tạo project + test case', async () => {
    await request.post('http://localhost:3100/api/auth/register', {
      data: { email, password },
    });
    const login = await request.post('http://localhost:3100/api/auth/login', {
      data: { email, password },
    });
    const token = (await login.json()).accessToken as string;
    const h = { Authorization: `Bearer ${token}` };
    const project = await request.post('http://localhost:3100/api/projects', {
      headers: h,
      data: { name: projectName },
    });
    const projectId = (await project.json()).id as string;
    await request.post(`http://localhost:3100/api/projects/${projectId}/test-cases`, {
      headers: h,
      data: { title: caseTitle },
    });
  });

  await test.step('đăng nhập, mở tab Kho test', async () => {
    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Đã đăng nhập')).toBeVisible();
    await page.getByRole('button', { name: new RegExp(projectName) }).click();
    await goTab(page, 'Kho test');
    await expect(page.getByRole('button', { name: new RegExp(caseTitle) })).toBeVisible();
  });

  const dialog = page.getByRole('dialog');
  const openModal = async () => {
    // Sau khi Clone sẽ có 2 nút cùng tiêu đề: luôn mở bản gốc đầu tiên.
    await page.getByRole('button', { name: new RegExp(caseTitle) }).first().click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Trạng thái:')).toBeVisible();
  };

  await test.step('đóng bằng Escape, nút Đóng, click ngoài', async () => {
    await openModal();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await openModal();
    await dialog.getByLabel('Đóng').click();
    await expect(dialog).toBeHidden();
    await openModal();
    await page.mouse.click(8, 8);
    await expect(dialog).toBeHidden();
  });

  await test.step('Clone hiện toast và thêm 1 case vào danh sách', async () => {
    await openModal();
    await dialog.getByRole('button', { name: 'Clone', exact: true }).click();
    await expect(page.getByText('Đã clone test case')).toBeVisible();
    await dialog.getByLabel('Đóng').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: /TC-002/ })).toBeVisible();
  });

  await test.step('đóng nhanh sau khi Lưu expected thì modal không mở lại', async () => {
    await openModal();
    await dialog.getByPlaceholder('Expected result').fill('OK');
    await dialog.getByRole('button', { name: 'Lưu expected' }).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    await expect(dialog).toBeHidden();
  });
});
