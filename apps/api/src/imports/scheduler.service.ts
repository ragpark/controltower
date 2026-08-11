import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SourceType } from '@control-tower/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorService } from './orchestrator.service';

const JOB_PREFIX = 'source-import:';

/**
 * Registers one cron job per enabled, scheduled source ("detect new source
 * data"). Jobs are re-synced whenever a source changes through the API.
 */
@Injectable()
export class SourceSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SourceSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: SchedulerRegistry,
    private readonly orchestrator: OrchestratorService,
  ) {}

  async onModuleInit() {
    if ((process.env.SCHEDULER_ENABLED ?? 'true').toLowerCase() !== 'true') {
      this.logger.warn('Source scheduler disabled via SCHEDULER_ENABLED=false');
      return;
    }
    await this.syncAll();
  }

  onModuleDestroy() {
    for (const name of this.jobNames()) this.removeJob(name);
  }

  private jobNames(): string[] {
    return [...this.registry.getCronJobs().keys()].filter((n) => n.startsWith(JOB_PREFIX));
  }

  private removeJob(name: string) {
    try {
      this.registry.deleteCronJob(name);
    } catch {
      // already gone
    }
  }

  async syncAll(): Promise<void> {
    for (const name of this.jobNames()) this.removeJob(name);

    const sources = await this.prisma.source.findMany({
      where: { enabled: true, schedule: { not: null } },
    });
    for (const source of sources) {
      this.scheduleSource(source.id, source.name, source.type as SourceType, source.schedule!);
    }
    this.logger.log(`Scheduled ${sources.length} source import job(s)`);
  }

  /** Called by SourcesService after create/update/delete. */
  async syncSource(sourceId: string): Promise<void> {
    this.removeJob(JOB_PREFIX + sourceId);
    const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
    if (!source || !source.enabled || !source.schedule) return;
    this.scheduleSource(source.id, source.name, source.type as SourceType, source.schedule);
  }

  private scheduleSource(id: string, name: string, type: SourceType, schedule: string) {
    const connector = this.orchestrator.connectors;
    if (connector.has(type) && !connector.get(type).supportsScheduledFetch) {
      this.logger.warn(`Source "${name}" (${type}) does not support scheduled fetch — skipped`);
      return;
    }
    let job: CronJob;
    try {
      job = new CronJob(schedule, () => {
        this.orchestrator
          .runSource(id, 'scheduler')
          .catch((error) => this.logger.error(`Scheduled import for "${name}" failed: ${error}`));
      });
    } catch (error) {
      this.logger.error(`Invalid cron "${schedule}" for source "${name}": ${error}`);
      return;
    }
    this.registry.addCronJob(JOB_PREFIX + id, job as never);
    job.start();
    this.logger.log(`Scheduled "${name}" with cron "${schedule}"`);
  }
}
