// Lọc lỗi: domain ném {code} → HTTP status + body {code, message} (nguồn: Q10).
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

const statusByCode: Record<string, number> = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  AUTH_EMAIL_TAKEN: HttpStatus.CONFLICT,
  AUTH_INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  AUTH_TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
  AUTH_TOKEN_EXPIRED: HttpStatus.UNAUTHORIZED,
  AUTH_TOKEN_REVOKED: HttpStatus.UNAUTHORIZED,
  AUTH_HASH_MALFORMED: HttpStatus.INTERNAL_SERVER_ERROR,
  PROJECT_FORBIDDEN: HttpStatus.FORBIDDEN,
  PROJECT_NOT_FOUND: HttpStatus.NOT_FOUND,
  MEMBER_NOT_FOUND: HttpStatus.NOT_FOUND,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  MEMBER_EXISTS: HttpStatus.CONFLICT,
  MEMBER_LAST_OWNER: HttpStatus.FORBIDDEN,
  REQUIREMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  CRITERION_NOT_FOUND: HttpStatus.NOT_FOUND,
  REQUIREMENT_STATE: HttpStatus.CONFLICT,
  REQUIREMENT_READONLY: HttpStatus.FORBIDDEN,
  RISK_OUT_OF_RANGE: HttpStatus.BAD_REQUEST,
  REVIEW_TASK_NOT_FOUND: HttpStatus.NOT_FOUND,
  TESTCASE_NOT_FOUND: HttpStatus.NOT_FOUND,
  STEP_NOT_FOUND: HttpStatus.NOT_FOUND,
  SUITE_NOT_FOUND: HttpStatus.NOT_FOUND,
  TESTCASE_NOT_READY: HttpStatus.CONFLICT,
  SUITE_NOT_EMPTY: HttpStatus.CONFLICT,
  TESTCASE_RETIRED: HttpStatus.FORBIDDEN,
  SUITE_CYCLE: HttpStatus.BAD_REQUEST,
  RELEASE_NOT_FOUND: HttpStatus.NOT_FOUND,
  BUILD_NOT_FOUND: HttpStatus.NOT_FOUND,
  ENV_NOT_FOUND: HttpStatus.NOT_FOUND,
  RELEASE_STATE: HttpStatus.CONFLICT,
  BUILD_EXISTS: HttpStatus.CONFLICT,
  ENV_EXISTS: HttpStatus.CONFLICT,
  RELEASE_FROZEN: HttpStatus.FORBIDDEN,
  ENV_IN_USE: HttpStatus.CONFLICT,
  RUN_NOT_FOUND: HttpStatus.NOT_FOUND,
  RUN_BUILD_MISMATCH: HttpStatus.CONFLICT,
  RUN_EMPTY_SOURCE: HttpStatus.BAD_REQUEST,
  RUN_FINALIZED: HttpStatus.CONFLICT,
  RESULT_VALIDATION: HttpStatus.BAD_REQUEST,
  RUN_ITEM_NOT_FOUND: HttpStatus.NOT_FOUND,
  RUN_VERSION_CONFLICT: HttpStatus.CONFLICT,
  DEFECT_NOT_FOUND: HttpStatus.NOT_FOUND,
  DEFECT_STATE: HttpStatus.CONFLICT,
  DEFECT_FIXED_BUILD: HttpStatus.BAD_REQUEST,
  DEFECT_SOURCE: HttpStatus.CONFLICT,
};

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      res.status(exception.getStatus()).json(body);
      return;
    }
    const code =
      typeof exception === 'object' && exception !== null && 'code' in exception
        ? String((exception as { code: unknown }).code)
        : 'INTERNAL_ERROR';
    const message = exception instanceof Error ? exception.message : 'Lỗi không xác định';
    res.status(statusByCode[code] ?? HttpStatus.INTERNAL_SERVER_ERROR).json({ code, message });
  }
}
