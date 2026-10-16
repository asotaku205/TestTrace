// Seed project TestTrace Self-Test: idempotent, mã cố định cho E2E tham chiếu (nguồn: Q6 Slice 6).
// Chạy: pnpm db:seed (không ghi đè dữ liệu có sẵn).
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { hashPassword } from '@testtrace/domain';

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const path of ['.env.example', '.env']) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) vars[m[1]] = m[2];
    }
  }
  return { ...vars, ...process.env };
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  const user = env.DATABASE_USERNAME ?? 'postgres';
  const password = encodeURIComponent(env.DATABASE_PASSWORD ?? '');
  const host = env.DATABASE_HOST ?? 'localhost';
  const port = env.DATABASE_PORT ?? '5432';
  const name = env.DATABASE_NAME ?? 'testtrace_dev';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user =
    (await prisma.user.findUnique({ where: { email: 'selftest@example.com' } })) ??
    (await prisma.user.create({
      data: {
        email: 'selftest@example.com',
        passwordHash: await hashPassword('selftest-123'),
        name: 'Self Test Owner',
      },
    }));
  const project =
    (await prisma.project.findFirst({ where: { name: 'TestTrace Self-Test' } })) ??
    (await prisma.project.create({ data: { name: 'TestTrace Self-Test' } }));
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: 'OWNER' },
    update: {},
  });

  const seedRequirements = [
    { code: 'REQ-001', title: 'Đăng nhập local', risk: { impact: 5, likelihood: 4 } },
    { code: 'REQ-002', title: 'RTM sống', risk: null },
    { code: 'REQ-003', title: 'CFG Python', risk: null },
  ];
  for (const seed of seedRequirements) {
    let requirement = await prisma.requirement.findUnique({
      where: { projectId_code: { projectId: project.id, code: seed.code } },
    });
    if (!requirement) {
      requirement = await prisma.requirement.create({
        data: { projectId: project.id, code: seed.code, title: seed.title, status: 'APPROVED' },
      });
    }
    if (seed.risk) {
      await prisma.risk.upsert({
        where: { requirementId: requirement.id },
        create: { requirementId: requirement.id, ...seed.risk },
        update: {},
      });
    }
  }

  const suite =
    (await prisma.testSuite.findFirst({ where: { projectId: project.id, name: 'Smoke' } })) ??
    (await prisma.testSuite.create({ data: { projectId: project.id, name: 'Smoke' } }));
  const existingCase = await prisma.testCase.findUnique({
    where: { projectId_code: { projectId: project.id, code: 'TC-001' } },
  });
  const testCase =
    existingCase ??
    (await prisma.testCase.create({
      data: {
        projectId: project.id,
        suiteId: suite.id,
        code: 'TC-001',
        title: 'Đăng nhập đúng',
        expectedResult: 'Vào được dashboard',
        status: 'READY',
      },
    }));
  const req1 = await prisma.requirement.findUniqueOrThrow({
    where: { projectId_code: { projectId: project.id, code: 'REQ-001' } },
  });
  await prisma.requirementTestCase.upsert({
    where: { requirementId_testCaseId: { requirementId: req1.id, testCaseId: testCase.id } },
    create: { requirementId: req1.id, testCaseId: testCase.id },
    update: {},
  });

  const release =
    (await prisma.release.findFirst({ where: { projectId: project.id, name: 'RC-1' } })) ??
    (await prisma.release.create({ data: { projectId: project.id, name: 'RC-1' } }));
  await prisma.build.upsert({
    where: { releaseId_number: { releaseId: release.id, number: '1' } },
    create: { releaseId: release.id, number: '1' },
    update: {},
  });
  await prisma.environment.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Test' } },
    create: { projectId: project.id, name: 'Test' },
    update: {},
  });

  const gate =
    (await prisma.qualityGate.findFirst({
      where: { projectId: project.id, name: 'Release gate' },
    })) ??
    (await prisma.qualityGate.create({
      data: { projectId: project.id, name: 'Release gate', createdBy: user.id },
    }));
  const latest = await prisma.gateVersion.findFirst({
    where: { gateId: gate.id },
    orderBy: { version: 'desc' },
  });
  if (!latest) {
    await prisma.gateVersion.create({
      data: {
        gateId: gate.id,
        version: 1,
        rules: { open_critical_defects: 0, pass_rate_min: 80 },
      },
    });
  }
  console.log('seed ok: TestTrace Self-Test');
  await seedDemo(prisma, user.id);
}

async function seedDemo(prisma: PrismaClient, userId: string): Promise<void> {
  const project =
    (await prisma.project.findFirst({ where: { name: 'TestTrace Demo' } })) ??
    (await prisma.project.create({ data: { name: 'TestTrace Demo' } }));
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId } },
    create: { projectId: project.id, userId, role: 'OWNER' },
    update: {},
  });

  const reqSeeds = [
    { code: 'REQ-D01', title: 'Thanh toán VNPay', status: 'APPROVED', risk: { impact: 5, likelihood: 4 } },
    { code: 'REQ-D02', title: 'Đăng nhập SSO', status: 'APPROVED', risk: { impact: 4, likelihood: 4 } },
    { code: 'REQ-D03', title: 'Xuất hóa đơn VAT', status: 'APPROVED', risk: { impact: 3, likelihood: 4 } },
    { code: 'REQ-D04', title: 'Quên mật khẩu', status: 'DRAFT', risk: null },
    { code: 'REQ-D05', title: 'Tìm kiếm sản phẩm', status: 'APPROVED', risk: { impact: 2, likelihood: 3 } },
  ] as const;
  const reqs: Record<string, { id: string }> = {};
  for (const s of reqSeeds) {
    let r = await prisma.requirement.findUnique({
      where: { projectId_code: { projectId: project.id, code: s.code } },
    });
    if (!r) {
      r = await prisma.requirement.create({
        data: { projectId: project.id, code: s.code, title: s.title, status: s.status },
      });
    }
    reqs[s.code] = r;
    if (s.risk) {
      await prisma.risk.upsert({
        where: { requirementId: r.id },
        create: { requirementId: r.id, ...s.risk },
        update: {},
      });
    }
  }

  const suites: Record<string, { id: string }> = {};
  for (const name of ['Smoke', 'Regression']) {
    suites[name] =
      (await prisma.testSuite.findFirst({ where: { projectId: project.id, name } })) ??
      (await prisma.testSuite.create({ data: { projectId: project.id, name } }));
  }

  const caseSeeds = [
    { code: 'TC-D01', title: 'Thanh toán VNPay thành công', suite: 'Smoke', status: 'READY', req: 'REQ-D01',
      steps: [['Mở trang thanh toán', 'Hiện QR VNPay'], ['Quét QR và xác nhận', 'Trừ tiền đúng số']] },
    { code: 'TC-D02', title: 'Thanh toán VNPay thất bại', suite: 'Regression', status: 'READY', req: 'REQ-D01',
      steps: [['Nhập thẻ hết hạn', 'Báo lỗi thẻ'], ['Thử lại 3 lần', 'Khóa tạm 15 phút']] },
    { code: 'TC-D03', title: 'Đăng nhập SSO Google', suite: 'Smoke', status: 'READY', req: 'REQ-D02',
      steps: [['Bấm "Đăng nhập bằng Google"', 'Chuyển sang Google'], ['Chọn tài khoản', 'Vào dashboard']] },
    { code: 'TC-D04', title: 'Xuất hóa đơn VAT', suite: 'Regression', status: 'READY', req: 'REQ-D03',
      steps: [['Nhập MST hợp lệ', 'Hiện thông tin công ty'], ['Bấm xuất hóa đơn', 'Tải PDF']] },
    { code: 'TC-D05', title: 'Tìm kiếm theo tên', suite: 'Regression', status: 'DRAFT', req: 'REQ-D05',
      steps: [['Nhập từ khóa "giày"', 'Hiện danh sách giày']] },
    { code: 'TC-D06', title: 'Quên mật khẩu gửi email', suite: 'Smoke', status: 'DRAFT', req: 'REQ-D04',
      steps: [['Nhập email đã đăng ký', 'Nhận email reset']] },
  ];
  const cases: Record<string, { id: string }> = {};
  for (const s of caseSeeds) {
    let c = await prisma.testCase.findUnique({
      where: { projectId_code: { projectId: project.id, code: s.code } },
    });
    if (!c) {
      c = await prisma.testCase.create({
        data: {
          projectId: project.id, suiteId: suites[s.suite].id, code: s.code,
          title: s.title, status: s.status, expectedResult: 'Đúng như mô tả',
        },
      });
      for (const [i, [action, expected]] of s.steps.entries()) {
        await prisma.testStep.create({
          data: { testCaseId: c.id, position: i + 1, action, expected },
        });
      }
    }
    cases[s.code] = c;
    await prisma.requirementTestCase.upsert({
      where: { requirementId_testCaseId: { requirementId: reqs[s.req].id, testCaseId: c.id } },
      create: { requirementId: reqs[s.req].id, testCaseId: c.id },
      update: {},
    });
  }

  const release =
    (await prisma.release.findFirst({ where: { projectId: project.id, name: 'RC-1' } })) ??
    (await prisma.release.create({ data: { projectId: project.id, name: 'RC-1' } }));
  const build = await prisma.build.upsert({
    where: { releaseId_number: { releaseId: release.id, number: '1' } },
    create: { releaseId: release.id, number: '1' },
    update: {},
  });
  const env = await prisma.environment.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Test' } },
    create: { projectId: project.id, name: 'Test' },
    update: {},
  });

  let run = await prisma.testRun.findFirst({
    where: { projectId: project.id, name: 'Demo run 1' },
  });
  if (!run) {
    run = await prisma.testRun.create({
      data: {
        projectId: project.id, releaseId: release.id, buildId: build.id,
        environmentId: env.id, name: 'Demo run 1', status: 'FINALIZED',
        createdBy: userId, finalizedAt: new Date(),
      },
    });
    const verdicts: Array<[string, string, string]> = [
      ['TC-D01', 'PASS', 'Thanh toán OK'],
      ['TC-D02', 'FAIL', 'Timeout sau 30s'],
      ['TC-D03', 'PASS', 'SSO OK'],
      ['TC-D04', 'PASS', 'PDF đúng mẫu'],
    ];
    for (const [i, [code, verdict, actual]] of verdicts.entries()) {
      const item = await prisma.testRunItem.create({
        data: {
          runId: run.id, testCaseId: cases[code].id,
          snapshot: { code, title: code }, position: i + 1,
        },
      });
      await prisma.testResult.create({
        data: { itemId: item.id, status: verdict, actualResult: actual, createdBy: userId },
      });
    }
  }

  const failResult = await prisma.testResult.findFirst({
    where: { item: { runId: run.id }, status: 'FAIL' },
  });
  if (failResult && !(await prisma.defect.findFirst({ where: { projectId: project.id, code: 'BUG-D01' } }))) {
    await prisma.defect.create({
      data: {
        projectId: project.id, code: 'BUG-D01', title: 'Thanh toán VNPay timeout sau 30s',
        severity: 'CRITICAL', status: 'IN_PROGRESS', reporterId: userId,
        sourceResultId: failResult.id,
      },
    });
  }
  if (!(await prisma.defect.findFirst({ where: { projectId: project.id, code: 'BUG-D02' } }))) {
    await prisma.defect.create({
      data: {
        projectId: project.id, code: 'BUG-D02', title: 'SSO redirect sai trang sau login',
        severity: 'MAJOR', status: 'CLOSED', reporterId: userId,
      },
    });
  }

  const gate =
    (await prisma.qualityGate.findFirst({ where: { projectId: project.id, name: 'Release gate' } })) ??
    (await prisma.qualityGate.create({
      data: { projectId: project.id, name: 'Release gate', createdBy: userId },
    }));
  if (!(await prisma.gateVersion.findFirst({ where: { gateId: gate.id } }))) {
    await prisma.gateVersion.create({
      data: {
        gateId: gate.id, version: 1,
        rules: { open_critical_defects: 0, pass_rate_min: 80 },
      },
    });
  }
  console.log('seed ok: TestTrace Demo');
}

function run(): void {
  main()
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}

run();
