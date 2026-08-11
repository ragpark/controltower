import { ConsoleLogger, LogLevel } from '@nestjs/common';

const LEVELS: Record<string, number> = { debug: 10, verbose: 10, log: 20, warn: 30, error: 40 };

/**
 * Structured JSON logger (one JSON object per line) suitable for Azure Log
 * Analytics / Datadog ingestion. Falls back to pretty output when LOG_FORMAT=pretty.
 */
export class JsonLogger extends ConsoleLogger {
  private readonly json = (process.env.LOG_FORMAT ?? 'json') === 'json';
  private readonly minLevel = LEVELS[process.env.LOG_LEVEL ?? 'log'] ?? 20;

  protected write(level: LogLevel, message: unknown, context?: string, stack?: string) {
    if ((LEVELS[level] ?? 20) < this.minLevel) return;
    if (!this.json) {
      if (stack) super[level === 'error' ? 'error' : 'log'](message as string, stack, context);
      else super[level === 'error' ? 'error' : 'log'](message as string, context);
      return;
    }
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...(stack ? { stack } : {}),
    });
    // eslint-disable-next-line no-console
    console.log(line);
  }

  override log(message: unknown, context?: string) {
    this.write('log', message, context ?? this.context);
  }
  override error(message: unknown, stack?: string, context?: string) {
    this.write('error', message, context ?? this.context, stack);
  }
  override warn(message: unknown, context?: string) {
    this.write('warn', message, context ?? this.context);
  }
  override debug(message: unknown, context?: string) {
    this.write('debug', message, context ?? this.context);
  }
  override verbose(message: unknown, context?: string) {
    this.write('verbose', message, context ?? this.context);
  }
}
