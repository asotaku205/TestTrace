import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RequirementsModule } from './requirements/requirements.module.js';
import { TestCasesModule } from './tests/test-cases.module.js';
import { AuditModule } from './audit/audit.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProjectsModule,
    RequirementsModule,
    TestCasesModule,
    AuditModule,
  ],
})
export class AppModule {}
