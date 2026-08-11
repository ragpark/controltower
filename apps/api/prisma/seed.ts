/* eslint-disable no-console */
import { PrismaClient, SourceType } from '@prisma/client';
import {
  CLASSIFICATION_RULES,
  DEFAULT_MAPPING,
  isLegacyMapping,
  SUPERSEDED_RULE_NAMES,
  SUPERSEDED_SOURCE_NAMES,
} from './seed-data';

const prisma = new PrismaClient();

async function seedRules() {
  for (const rule of CLASSIFICATION_RULES) {
    await prisma.classificationRule.upsert({
      where: { name: rule.name },
      create: rule,
      update: {
        description: rule.description,
        priority: rule.priority,
        strategy: rule.strategy,
        ruleDefinition: rule.ruleDefinition,
        outcome: rule.outcome,
      },
    });
  }
  console.log(`Seeded ${CLASSIFICATION_RULES.length} classification rules`);
}

/**
 * Disable rules from earlier releases that the current set replaces. Left
 * enabled they compete on equal priorities with their replacements, and the
 * engine's alphabetical tie-break can hand the decision to the obsolete rule.
 */
async function retireSupersededRules() {
  const { count } = await prisma.classificationRule.updateMany({
    where: { name: { in: SUPERSEDED_RULE_NAMES }, enabled: true },
    data: { enabled: false },
  });
  if (count > 0) {
    console.log(`Disabled ${count} superseded classification rule(s)`);
  }
}

async function seedSources() {
  // update:{} on both — source configuration is operator-editable in Settings
  // and must survive a restart. Stale mappings are handled by the migration below.
  await prisma.source.upsert({
    where: { name: 'ActiveHub manual upload' },
    create: {
      name: 'ActiveHub manual upload',
      type: SourceType.CSV_UPLOAD,
      enabled: true,
      configJson: { mapping: DEFAULT_MAPPING, delimiter: ',' },
    },
    update: {},
  });
  await prisma.source.upsert({
    where: { name: 'ActiveHub scheduled export' },
    create: {
      name: 'ActiveHub scheduled export',
      type: SourceType.CSV_FILE,
      enabled: true,
      schedule: '*/15 * * * *',
      configJson: {
        connector: { directory: '.', pattern: 'activehub' },
        mapping: DEFAULT_MAPPING,
        delimiter: ',',
      },
    },
    update: {},
  });
  await prisma.source.upsert({
    where: { name: 'Provisioning failure report' },
    create: {
      name: 'Provisioning failure report',
      type: SourceType.EMAIL_FAILURE_REPORT,
      enabled: true,
      configJson: {},
    },
    update: {},
  });
  console.log('Seeded default sources');
}

/**
 * Disable the sources seeded by earlier releases. The old scheduled source
 * matches filenames by substring ("orders"), which overlaps the ActiveHub
 * source's pattern — left enabled, both cron jobs import the same files every
 * 15 minutes. Disabled rather than deleted so imported orders keep their
 * provenance; an operator can re-enable from Settings.
 */
async function retireSupersededSources() {
  const { count } = await prisma.source.updateMany({
    where: { name: { in: SUPERSEDED_SOURCE_NAMES }, enabled: true },
    data: { enabled: false, status: 'DISABLED' },
  });
  if (count > 0) {
    console.log(
      `Disabled ${count} superseded source(s): ${SUPERSEDED_SOURCE_NAMES.join(', ')}`,
    );
  }
}

/**
 * Sources created from the pre-alignment template carry a mapping built for the
 * placeholder headers "Order Number" / "Product Code". Applied to a real
 * ActiveHub export that mapping matches nothing, so every row fails validation.
 * Only the exact legacy template is rewritten — a custom mapping that happens to
 * use one of those header names is legitimate and left untouched.
 */
async function migrateLegacyMappings() {
  const sources = await prisma.source.findMany();
  let migrated = 0;

  for (const source of sources) {
    const config = (source.configJson ?? {}) as {
      mapping?: Record<string, unknown>;
      [key: string]: unknown;
    };
    if (!isLegacyMapping(config.mapping)) continue;

    await prisma.source.update({
      where: { id: source.id },
      data: { configJson: { ...config, mapping: DEFAULT_MAPPING } },
    });
    migrated += 1;
    console.log(`Migrated legacy column mapping on source "${source.name}"`);
  }

  if (migrated > 0) {
    console.log(`Migrated ${migrated} source(s) to the ActiveHub column mapping`);
  }
}

async function main() {
  await seedRules();
  await retireSupersededRules();
  await seedSources();
  await retireSupersededSources();
  await migrateLegacyMappings();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
