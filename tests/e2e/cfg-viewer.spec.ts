// E2E chuyên biệt: CFG layout dọc + zoom/pan + click node highlight (Analysis Lab).
import { expect, test } from '@playwright/test';
import { goTab } from './nav.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `cfgview-${suffix}@example.com`;
const password = 'mat-khau-123';
const projectName = `E2E CFG Viewer ${suffix}`;

const SOURCE = `function fee(total) {
  if (total > 100) {
    return total * 0.9;
  }
  return total;
}`;

test('CFG viewer: layout dọc, ENTRY code thật, zoom, highlight', async ({ page, request }) => {
  await test.step('đăng ký qua API, tạo project', async () => {
    await request.post('http://localhost:3100/api/auth/register', {
      data: { email, password },
    });
    const login = await request.post('http://localhost:3100/api/auth/login', {
      data: { email, password },
    });
    const token = (await login.json()).accessToken as string;
    await request.post('http://localhost:3100/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: projectName },
    });
  });

  const svg = page.locator('svg[aria-label="Control flow graph"]');

  await test.step('đăng nhập, phân tích hàm fee', async () => {
    await page.goto('/');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Đã đăng nhập')).toBeVisible();
    await page.getByRole('button', { name: new RegExp(projectName) }).click();
    await goTab(page, 'Analysis Lab');
    await page.getByPlaceholder('Dán function cần phân tích').fill(SOURCE);
    await page.getByRole('button', { name: 'Phân tích', exact: true }).click();
    await page.getByText('Phân tích xong').waitFor({ timeout: 15000 });
    await expect(svg).toBeVisible();
  });

  await test.step('layout dọc: ENTRY trên cùng, EXIT dưới cùng', async () => {
    const entry = page.locator('g[data-node-type="ENTRY"]');
    const decision = page.locator('g[data-node-type="DECISION"]');
    const exit = page.locator('g[data-node-type="EXIT"]');
    const entryBox = await entry.boundingBox();
    const decisionBox = await decision.boundingBox();
    const exitBox = await exit.boundingBox();
    expect(entryBox).not.toBeNull();
    expect(decisionBox).not.toBeNull();
    expect(exitBox).not.toBeNull();
    expect(entryBox!.y).toBeLessThan(decisionBox!.y);
    expect(decisionBox!.y).toBeLessThan(exitBox!.y);
  });

  await test.step('ENTRY hiện câu lệnh đầu tiên, không phải chữ ký hàm', async () => {
    const entryText = (await page.locator('g[data-node-type="ENTRY"]').textContent()) ?? '';
    expect(entryText).toContain('if (total > 100)');
    expect(entryText).not.toContain('function fee');
  });

  await test.step('zoom phóng to rồi về 100%', async () => {
    const before = await svg.getAttribute('width');
    await page.getByRole('button', { name: 'Phóng to' }).click();
    const zoomed = await svg.getAttribute('width');
    expect(Number(zoomed)).toBeGreaterThan(Number(before));
    await page.getByRole('button', { name: 'Về 100%' }).click();
    const reset = await svg.getAttribute('width');
    expect(reset).toBe(before);
  });

  await test.step('click DECISION highlight dòng code + caption', async () => {
    await page.locator('g[data-node-type="DECISION"] rect').click();
    await expect(page.getByText(/Đang chọn DECISION, dòng 2-2/)).toBeVisible();
    const hot = page.locator('[data-hot="true"]');
    await expect(hot.first()).toContainText('if (total > 100)');
  });

  await test.step('kéo nền graph không chọn node', async () => {
    // Bỏ chọn trước rồi kéo vùng trống của svg.
    await page.locator('g[data-node-type="DECISION"] rect').click();
    await expect(page.getByText(/Đang chọn/)).toBeHidden();
    const box = await svg.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width - 15;
    const startY = box!.y + box!.height - 15;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 80, startY - 60, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText(/Đang chọn/)).toBeHidden();
  });
});
