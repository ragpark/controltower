import { AlwaysStrategy } from './strategies/always.strategy';
import { FieldMatchStrategy } from './strategies/field-match.strategy';
import { OrderAgeStrategy } from './strategies/order-age.strategy';
import { RuleStrategy } from './strategies/rule-strategy';

export class StrategyRegistry {
  private readonly strategies = new Map<string, RuleStrategy>();

  register(strategy: RuleStrategy): this {
    this.strategies.set(strategy.type, strategy);
    return this;
  }

  get(type: string): RuleStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(
        `Unknown rule strategy "${type}". Registered: ${[...this.strategies.keys()].join(', ')}`,
      );
    }
    return strategy;
  }

  has(type: string): boolean {
    return this.strategies.has(type);
  }

  list(): string[] {
    return [...this.strategies.keys()];
  }
}

export function createDefaultRegistry(now?: () => Date): StrategyRegistry {
  return new StrategyRegistry()
    .register(new FieldMatchStrategy())
    .register(new OrderAgeStrategy(now))
    .register(new AlwaysStrategy());
}
