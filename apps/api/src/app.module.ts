import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RequirementsModule } from './requirements/requirements.module.js';

@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, RequirementsModule],
})
export class AppModule {}
