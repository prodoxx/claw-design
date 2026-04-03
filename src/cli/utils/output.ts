import ora, { type Ora } from 'ora';
import pc from 'picocolors';

export function createSpinner(text: string): Ora {
  return ora(text).start();
}

export function printHeader(version: string): void {
  console.log(pc.bold(`clawdesign v${version}`));
}

export function printReady(port: number): void {
  console.log(`\n  ${pc.green('Ready!')}`);
  console.log(pc.dim(`  Dev server: http://localhost:${port}`));
  console.log(pc.dim('  Press Ctrl+C to stop'));
}

export function printError(
  title: string,
  message: string,
  suggestion?: string
): void {
  console.error(`\n  ${pc.red('\u2718')} ${pc.bold(title)}`);
  console.error(`  ${message}`);
  if (suggestion) {
    console.error(pc.dim(`  ${suggestion}`));
  }
}
