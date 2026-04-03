#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import { startCommand } from './commands/start.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');

const program = new Command();

program
  .name('clawdesign')
  .description('Visual web development tool powered by Claude Code')
  .version(version);

program
  .command('start')
  .description('Launch dev server and open visual editor')
  .option('--cmd <command>', 'Override dev server command')
  .option('--port <number>', 'Specify dev server port (skip auto-detection)')
  .option('--verbose', 'Show dev server output')
  .action(startCommand);

program.parse();
