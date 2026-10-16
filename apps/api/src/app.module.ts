import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RequirementsModule } from './requirements/requirements.module.js';
import { TestCasesModule } from './tests/test-cases.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ReleasesModule } from './releases/releases.module.js';
import { RunsModule } from './runs/runs.module.js';
import { DefectsModule } from './defects/defects.module.js';
import { EvidenceModule } from './evidence/evidence.module.js';
import { AnalysesModule } from './analyses/analyses.module.js';
import { DraftsModule } from './drafts/drafts.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    RequirementsModule,
    TestCasesModule,
    AuditModule,
    ReleasesModule,
    RunsModule,
    DefectsModule,
    EvidenceModule,
    AnalysesModule,
    DraftsModule,
  ],
})
export class AppModule {}
