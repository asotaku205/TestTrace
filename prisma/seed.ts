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
// Project demo "TestTrace Demo" quản lý CHÍNH dự án TestTrace theo đúng
// quy trình phát triển 6 slice (dogfooding). Idempotent.
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

  // Requirements = tính năng THẬT theo 6 slice phát triển
  const reqSeeds = [
    // Slice 1: Requirement → test case
    { code: 'REQ-S101', title: 'Đăng nhập local (JWT + refresh rotation)', status: 'APPROVED', risk: { impact: 5, likelihood: 4 } },
    { code: 'REQ-S102', title: 'Quản lý requirement + chấm điểm rủi ro', status: 'APPROVED', risk: { impact: 4, likelihood: 3 } },
    { code: 'REQ-S103', title: 'Viết test case + link 2 chiều requirement', status: 'APPROVED', risk: { impact: 4, likelihood: 3 } },
    // Slice 2: Thực thi kiểm thử
    { code: 'REQ-S201', title: 'Release / build / environment', status: 'APPROVED', risk: { impact: 3, likelihood: 3 } },
    { code: 'REQ-S202', title: 'Test run + ghi kết quả PASS/FAIL', status: 'APPROVED', risk: { impact: 4, likelihood: 4 } },
    { code: 'REQ-S203', title: 'Defect lifecycle (tạo từ FAIL → đóng)', status: 'APPROVED', risk: { impact: 4, likelihood: 3 } },
    // Slice 3: Phân tích mã nguồn
    { code: 'REQ-S301', title: 'Code Registry đăng ký file nguồn', status: 'APPROVED', risk: { impact: 3, likelihood: 2 } },
    { code: 'REQ-S302', title: 'CFG đa ngôn ngữ (TS/JS/Python) + viewer', status: 'APPROVED', risk: { impact: 4, likelihood: 4 } },
    // Slice 4: Sinh test tự động
    { code: 'REQ-S401', title: 'Sinh test draft từ path CFG', status: 'APPROVED', risk: { impact: 3, likelihood: 3 } },
    { code: 'REQ-S402', title: 'Sinh test biên BVA', status: 'APPROVED', risk: { impact: 3, likelihood: 3 } },
    // Slice 5: Truy vết sống
    { code: 'REQ-S501', title: 'RTM sống (Trusted/Stale)', status: 'APPROVED', risk: { impact: 4, likelihood: 4 } },
    { code: 'REQ-S502', title: 'Impact analysis khi code thay đổi', status: 'APPROVED', risk: { impact: 4, likelihood: 3 } },
    // Slice 6: Quyết định release
    { code: 'REQ-S601', title: 'Quality Gate chặn release chưa đạt chuẩn', status: 'APPROVED', risk: { impact: 5, likelihood: 3 } },
    { code: 'REQ-S602', title: 'Dashboard + báo cáo CSV', status: 'APPROVED', risk: { impact: 2, likelihood: 2 } },
    { code: 'REQ-S603', title: 'Tự động gia hạn access token (silent refresh)', status: 'DRAFT', risk: null },
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
    let s = await prisma.testSuite.findFirst({ where: { projectId: project.id, name } });
    if (!s) s = await prisma.testSuite.create({ data: { projectId: project.id, name } });
    suites[name] = s;
  }

  const caseSeeds = [
    { code: 'TC-S101', title: 'Đăng nhập đúng → nhận token pair', suite: 'Smoke', status: 'READY', req: 'REQ-S101',
      steps: [['Nhập email + mật khẩu đúng', 'Nhận accessToken'], ['Gọi /api/auth/me', 'Trả về user id']] },
    { code: 'TC-S102', title: 'Refresh token xoay vòng', suite: 'Regression', status: 'READY', req: 'REQ-S101',
      steps: [['Dùng refresh token cũ gọi /refresh', 'Nhận pair mới'], ['Dùng lại token cũ', 'Bị từ chối 401']] },
    { code: 'TC-S103', title: 'Tạo requirement + chấm risk', suite: 'Smoke', status: 'READY', req: 'REQ-S102',
      steps: [['Tạo requirement mới', 'Ở trạng thái DRAFT'], ['Nhập impact/likelihood', 'Tự tính risk score']] },
    { code: 'TC-S104', title: 'Link requirement ↔ test case 2 chiều', suite: 'Regression', status: 'READY', req: 'REQ-S103',
      steps: [['Tạo test case gắn requirement', 'Hiện ở cả 2 phía'], ['Xóa link', 'Cả 2 phía đều mất']] },
    { code: 'TC-S201', title: 'Tạo release + build + environment', suite: 'Smoke', status: 'READY', req: 'REQ-S201',
      steps: [['Tạo release v0.2', 'Trạng thái DRAFT'], ['Thêm build + env Staging', 'Gắn được vào run']] },
    { code: 'TC-S202', title: 'Chạy test run ghi PASS/FAIL', suite: 'Smoke', status: 'READY', req: 'REQ-S202',
      steps: [['Tạo run từ test READY', 'Run ở trạng thái OPEN'], ['Ghi kết quả từng case', 'Finalize khóa run']] },
    { code: 'TC-S203', title: 'Tạo defect từ FAIL → đóng', suite: 'Regression', status: 'READY', req: 'REQ-S203',
      steps: [['Từ kết quả FAIL tạo defect', 'Defect gắn đúng result'], ['Chuyển qua các trạng thái', 'Đóng được khi đã fix']] },
    { code: 'TC-S301', title: 'Đăng ký file nguồn vào registry', suite: 'Smoke', status: 'READY', req: 'REQ-S301',
      steps: [['Đăng ký auth.service.ts', 'Tạo artifact + version'], ['Trích units', 'Hiện danh sách hàm']] },
    { code: 'TC-S302', title: 'Phân tích CFG function có if/else', suite: 'Smoke', status: 'READY', req: 'REQ-S302',
      steps: [['Dán function có if/else', 'Hiện CFG + complexity'], ['Chọn node', 'Highlight đúng dòng code']] },
    { code: 'TC-S401', title: 'Sinh draft từ path CFG', suite: 'Regression', status: 'READY', req: 'REQ-S401',
      steps: [['Phân tích function', 'Liệt kê các path'], ['Bấm tạo draft 1 path', 'Draft ở NEEDS_REVIEW']] },
    { code: 'TC-S402', title: 'Sinh test biên BVA', suite: 'Regression', status: 'READY', req: 'REQ-S402',
      steps: [['Nhập biến + min/max', 'Sinh 5 điểm biên'], ['Duyệt draft', 'Thành test case']] },
    { code: 'TC-S501', title: 'Sửa requirement → RTM STALE', suite: 'Smoke', status: 'READY', req: 'REQ-S501',
      steps: [['Sửa requirement đã APPROVED', 'Ô RTM chuyển STALE'], ['Tải lại RTM', 'Thấy trạng thái mới']] },
    { code: 'TC-S502', title: 'Đổi code → impact báo test ảnh hưởng', suite: 'Regression', status: 'DRAFT', req: 'REQ-S502',
      steps: [['Sửa file đã đăng ký', 'Chạy impact analysis'], ['Xem kết quả', 'Liệt kê test cần chạy lại']] },
    { code: 'TC-S601', title: 'Gate FAIL khi còn bug critical', suite: 'Regression', status: 'READY', req: 'REQ-S601',
      steps: [['Tạo bug CRITICAL chưa đóng', 'Evaluate gate'], ['Kiểm tra verdict', 'FAIL, chặn release']] },
    { code: 'TC-S602', title: 'Dashboard hiện đúng số liệu', suite: 'Smoke', status: 'DRAFT', req: 'REQ-S602',
      steps: [['Mở dashboard', 'KPI khớp DB'], ['Tải báo cáo CSV', 'File đúng định dạng']] },
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
      await prisma.requirementTestCase.create({
        data: { testCaseId: c.id, requirementId: reqs[s.req].id },
      });
    }
    cases[s.code] = c;
  }

  // Releases theo 6 slice
  const sliceReleases = [
    { name: 'v0.1-nentang', note: 'Slice 1: requirement, test case, auth' },
    { name: 'v0.2-thucthi', note: 'Slice 2: release, run, defect' },
    { name: 'v0.3-manguon', note: 'Slice 3: CFG, code registry' },
    { name: 'v0.4-sinhtest', note: 'Slice 4: BVA, path draft' },
    { name: 'v0.5-truyvet', note: 'Slice 5: RTM sống, impact' },
    { name: 'v0.6-quyetdinh', note: 'Slice 6: quality gate, dashboard' },
  ];
  const releases: Array<{ id: string }> = [];
  for (const r of sliceReleases) {
    let rel = await prisma.release.findFirst({ where: { projectId: project.id, name: r.name } });
    if (!rel) {
      rel = await prisma.release.create({
        data: { projectId: project.id, name: r.name, status: 'RELEASED' },
      });
    }
    releases.push(rel);
  }
  const latest = releases[releases.length - 1];
  let build = await prisma.build.findFirst({ where: { releaseId: latest.id } });
  if (!build) {
    build = await prisma.build.create({
      data: { releaseId: latest.id, number: 'build-6' },
    });
  }
  let env = await prisma.environment.findFirst({ where: { projectId: project.id, name: 'Staging' } });
  if (!env) {
    env = await prisma.environment.create({ data: { projectId: project.id, name: 'Staging' } });
  }

  let run = await prisma.testRun.findFirst({ where: { projectId: project.id, name: 'Demo run 1' } });
  if (!run) {
    run = await prisma.testRun.create({
      data: {
        projectId: project.id, releaseId: latest.id, buildId: build.id,
        environmentId: env.id, name: 'Demo run 1', status: 'FINALIZED',
        createdBy: userId, finalizedAt: new Date(),
      },
    });
    const verdicts: Array<[string, string, string]> = [
      ['TC-S101', 'PASS', 'Login OK'],
      ['TC-S102', 'PASS', 'Rotation OK'],
      ['TC-S202', 'FAIL', 'Chưa tự refresh token'],
      ['TC-S302', 'FAIL', 'Node hiện nhãn chung chung'],
      ['TC-S501', 'PASS', 'RTM STALE OK'],
      ['TC-S601', 'PASS', 'Gate FAIL đúng'],
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

  const failResults = await prisma.testResult.findMany({
    where: { item: { runId: run.id }, status: 'FAIL' },
    include: { item: true },
  });
  const bugSeeds = [
    { code: 'BUG-D01', title: 'App không tự refresh token khi hết hạn (AUTH_TOKEN_EXPIRED)', severity: 'CRITICAL', status: 'IN_PROGRESS',
      desc: 'Access token hết hạn sau 15 phút, app web chưa tự gọi refresh → user thấy lỗi.' },
    { code: 'BUG-D02', title: 'Node CFG hiện nhãn chung chung thay vì code thật', severity: 'MAJOR', status: 'NEW',
      desc: 'Các node CFG hiện DECISION/MERGE thay vì code thật như `if (total > 100)`.' },
  ];
  for (const [i, b] of bugSeeds.entries()) {
    if (!(await prisma.defect.findFirst({ where: { projectId: project.id, code: b.code } }))) {
      await prisma.defect.create({
        data: {
          projectId: project.id, code: b.code, title: b.title, description: b.desc,
          severity: b.severity, status: b.status, reporterId: userId,
          sourceResultId: failResults[i]?.id,
        },
      });
    }
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

  // Đăng ký SOURCE CODE THẬT theo từng slice vào Code Registry
  const { createHash } = await import('node:crypto');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
  const realFiles: Array<{ path: string; language: string; reqCode: string }> = [
    // Slice 1
    { path: 'apps/api/src/auth/auth.service.ts', language: 'typescript', reqCode: 'REQ-S101' },
    { path: 'packages/domain/src/jwt.ts', language: 'typescript', reqCode: 'REQ-S101' },
    // Slice 2
    { path: 'apps/api/src/runs/runs.service.ts', language: 'typescript', reqCode: 'REQ-S202' },
    { path: 'apps/api/src/defects/defects.service.ts', language: 'typescript', reqCode: 'REQ-S203' },
    // Slice 3
    { path: 'packages/cfg-core/src/graph.ts', language: 'typescript', reqCode: 'REQ-S302' },
    { path: 'packages/language-js-ts/src/adapter.ts', language: 'typescript', reqCode: 'REQ-S302' },
    // Slice 4
    { path: 'packages/test-generation/src/bva.ts', language: 'typescript', reqCode: 'REQ-S402' },
    { path: 'packages/test-generation/src/path-predicates.ts', language: 'typescript', reqCode: 'REQ-S401' },
    // Slice 5
    { path: 'apps/api/src/rtm/rtm.service.ts', language: 'typescript', reqCode: 'REQ-S501' },
    { path: 'apps/api/src/impact/impact.service.ts', language: 'typescript', reqCode: 'REQ-S502' },
    // Slice 6
    { path: 'apps/api/src/gates/gates.service.ts', language: 'typescript', reqCode: 'REQ-S601' },
    { path: 'apps/web/src/lib/api.ts', language: 'typescript', reqCode: 'REQ-S603' },
  ];
  for (const f of realFiles) {
    const fullPath = join(repoRoot, f.path);
    let source: string;
    try {
      source = readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }
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
