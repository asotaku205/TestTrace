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
