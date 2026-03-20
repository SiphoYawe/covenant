import type { ActExecutor, ActNumber } from '../types';
import { act1Registration } from './act-1-registration';
import { act2EconomyWorks } from './act-2-economy-works';
import { act3Villain } from './act-3-villain';
import { act4Consequences } from './act-4-consequences';
import { act5Payoff } from './act-5-payoff';

/** Registry mapping act numbers to their executor instances */
export const ACT_EXECUTORS: Record<ActNumber, ActExecutor> = {
  1: act1Registration,
  2: act2EconomyWorks,
  3: act3Villain,
  4: act4Consequences,
  5: act5Payoff,
};

/** Get the executor for a given act number */
export function getActExecutor(act: ActNumber): ActExecutor {
  return ACT_EXECUTORS[act];
}
