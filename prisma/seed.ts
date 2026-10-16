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
  // Demo project phải hiện với MỌI user (ai seed / đăng nhập cũng thấy để demo)
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  for (const u of allUsers) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: u.id } },
      create: { projectId: project.id, userId: u.id, role: 'OWNER' },
      update: {},
    });
  }

  // Requirements là TÍNH NĂNG THẬT của chính dự án TestTrace (dogfooding)
  const reqSeeds = [
    { code: 'REQ-D01', title: 'Đăng nhập local (JWT + refresh token)', status: 'APPROVED', risk: { impact: 5, likelihood: 4 } },
    { code: 'REQ-D02', title: 'RTM sống tự cập nhật trạng thái', status: 'APPROVED', risk: { impact: 4, likelihood: 4 } },
    { code: 'REQ-D03', title: 'Phân tích CFG đa ngôn ngữ (TS/JS/Python)', status: 'APPROVED', risk: { impact: 4, likelihood: 3 } },
    { code: 'REQ-D04', title: 'Quality Gate chặn release chưa đạt chuẩn', status: 'APPROVED', risk: { impact: 5, likelihood: 3 } },
    { code: 'REQ-D05', title: 'Tự động gia hạn access token', status: 'DRAFT', risk: null },
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
    { code: 'TC-D01', title: 'Đăng nhập đúng email + mật khẩu', suite: 'Smoke', status: 'READY', req: 'REQ-D01',
      steps: [['Nhập email và mật khẩu đúng', 'Nhận access token'], ['Gọi API /projects', 'Trả về danh sách project']] },
    { code: 'TC-D02', title: 'Token hết hạn báo AUTH_TOKEN_EXPIRED', suite: 'Regression', status: 'READY', req: 'REQ-D01',
      steps: [['Chờ token hết hạn 15 phút', 'API trả 401'], ['Kiểm tra mã lỗi', 'AUTH_TOKEN_EXPIRED']] },
    { code: 'TC-D03', title: 'Sửa requirement → RTM chuyển STALE', suite: 'Smoke', status: 'READY', req: 'REQ-D02',
      steps: [['Sửa tiêu đề requirement đã APPROVED', 'Ô RTM chuyển STALE'], ['Tải lại RTM', 'Thấy trạng thái mới']] },
    { code: 'TC-D04', title: 'Phân tích CFG function Python', suite: 'Regression', status: 'READY', req: 'REQ-D03',
      steps: [['Dán function Python có if/else', 'Hiện CFG + complexity'], ['Chọn path', 'Sinh được draft']] },
    { code: 'TC-D05', title: 'Gate FAIL khi còn bug critical', suite: 'Regression', status: 'DRAFT', req: 'REQ-D04',
      steps: [['Tạo bug CRITICAL chưa đóng', 'Evaluate gate'], ['Kiểm tra verdict', 'FAIL']] },
    { code: 'TC-D06', title: 'Tự động refresh token khi hết hạn', suite: 'Smoke', status: 'DRAFT', req: 'REQ-D05',
      steps: [['Dùng token đã hết hạn', 'App tự gọi refresh'], ['Gọi lại API', 'Thành công không cần login lại']] },
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
      ['TC-D01', 'PASS', 'Login trả token đúng'],
      ['TC-D02', 'FAIL', 'Chưa tự refresh, báo lỗi'],
      ['TC-D03', 'PASS', 'RTM chuyển STALE đúng'],
      ['TC-D04', 'PASS', 'CFG + sinh draft OK'],
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
        projectId: project.id, code: 'BUG-D01', title: 'App không tự refresh token khi hết hạn (AUTH_TOKEN_EXPIRED)',
        description: 'Access token hết hạn sau 15 phút, app web chưa tự gọi refresh → user thấy lỗi. Cần thêm silent refresh.',
        severity: 'CRITICAL', status: 'IN_PROGRESS', reporterId: userId,
        sourceResultId: failResult.id,
      },
    });
  }
  if (!(await prisma.defect.findFirst({ where: { projectId: project.id, code: 'BUG-D02' } }))) {
    await prisma.defect.create({
      data: {
        projectId: project.id, code: 'BUG-D02', title: 'Node CFG hiện nhãn chung chung thay vì code thật',
        description: 'Các node CFG hiện DECISION/MERGE thay vì code thật như `if (total > 100)`. Cần dùng sourceRange để trích code.',
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
  // Đăng ký SOURCE CODE THẬT của dự án vào Code Registry (dogfooding)
  const { createHash } = await import('node:crypto');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
  const realFiles: Array<{ path: string; language: string; reqCode: string }> = [
    { path: 'apps/api/src/auth/auth.service.ts', language: 'typescript', reqCode: 'REQ-D01' },
    { path: 'packages/domain/src/jwt.ts', language: 'typescript', reqCode: 'REQ-D01' },
    { path: 'packages/cfg-core/src/graph.ts', language: 'typescript', reqCode: 'REQ-D03' },
    { path: 'apps/api/src/gates/gates.service.ts', language: 'typescript', reqCode: 'REQ-D04' },
  ];
  for (const f of realFiles) {
    const fullPath = join(repoRoot, f.path);
    if (!existsSync(fullPath)) continue;
    const source = readFileSync(fullPath, 'utf8');
    const sourceHash = createHash('sha256').update(source).digest('hex');
    let artifact = await prisma.codeArtifact.findUnique({
      where: { projectId_language_name: { projectId: project.id, language: f.language, name: f.path } },
    });
    if (!artifact) {
      artifact = await prisma.codeArtifact.create({
        data: { projectId: project.id, language: f.language, name: f.path },
      });
    }
    let version = await prisma.codeVersion.findUnique({
      where: { artifactId_sourceHash: { artifactId: artifact.id, sourceHash } },
    });
    if (!version) {
      version = await prisma.codeVersion.create({
        data: { artifactId: artifact.id, sourceHash, source },
      });
      // Trích tên hàm/method làm code unit (regex đơn giản)
      const unitNames = new Set<string>();
      for (const m of source.matchAll(/(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{=;]+)?\{)/g)) {
        const name = m[1] ?? m[2];
        if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) unitNames.add(name);
      }
      for (const qualifiedName of Array.from(unitNames).slice(0, 20)) {
        const sigHash = createHash('sha256').update(qualifiedName).digest('hex');
        await prisma.codeUnit.upsert({
          where: { versionId_qualifiedName: { versionId: version.id, qualifiedName } },
          create: {
            artifactId: artifact.id, versionId: version.id,
            qualifiedName, signatureHash: sigHash,
          },
          update: {},
        });
        await prisma.requirementCodeUnit.upsert({
          where: {
            requirementId_artifactId_qualifiedName: {
              requirementId: reqs[f.reqCode].id, artifactId: artifact.id, qualifiedName,
            },
          },
          create: {
            requirementId: reqs[f.reqCode].id, artifactId: artifact.id, qualifiedName,
          },
          update: {},
        });
      }
    }
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
