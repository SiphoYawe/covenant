#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { SeedEngine, parseCliArgs, loadEngineState } from './engine';
import type { SeedPhase } from './types';

const STATE_PATH = path.join(process.cwd(), 'seed', 'engine-state.json');

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  console.log('\n========================================');
  console.log('  Covenant Seed Engine CLI');
  console.log('========================================');
  console.log(`  Phases: ${args.phases.join(', ')}`);
  console.log(`  Resume: ${args.resume}`);
  console.log(`  Reset: ${args.reset}`);
  console.log('========================================\n');

  // Handle --reset: clear state and start fresh
  if (args.reset) {
    if (fs.existsSync(STATE_PATH)) {
      const backup = `${STATE_PATH}.backup-${Date.now()}`;
      fs.copyFileSync(STATE_PATH, backup);
      fs.unlinkSync(STATE_PATH);
      console.log(`State reset. Backup saved to ${backup}\n`);
    } else {
      console.log('No state file to reset.\n');
    }
  }

  // Handle --resume: check for existing state
  if (args.resume) {
    const existing = loadEngineState(STATE_PATH);
    if (existing) {
      const agents = Object.keys(existing.registeredAgents).length;
      const interactions = existing.completedInteractions.length;
      const phases = existing.phasesCompleted;
      console.log(`Resuming from existing state:`);
      console.log(`  Agents registered: ${agents}`);
      console.log(`  Interactions completed: ${interactions}`);
      console.log(`  Phases completed: ${phases.join(', ') || 'none'}\n`);
    } else {
      console.log('No existing state found. Starting fresh.\n');
    }
  }

  // Create and run engine
  const engine = new SeedEngine({
    statePath: STATE_PATH,
    phases: args.phases,
  });

  try {
    await engine.run();
    console.log('Seed engine completed successfully.\n');
    process.exit(0);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`\nSeed engine failed: ${msg}\n`);
    process.exit(1);
  }
}

main();
