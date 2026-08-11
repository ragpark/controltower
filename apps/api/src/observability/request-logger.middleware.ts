import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    if (req.path === '/healthz' || req.path === '/readyz' || req.path === '/metrics') {
      return next();
    }
    const start = Date.now();
    res.on('finish', () => {
      const user = (req as Request & { user?: { sub?: string } }).user?.sub ?? 'anonymous';
      this.logger.log(
        JSON.stringify({
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - start,
          user,
        }),
      );
    });
    next();
  }
}
