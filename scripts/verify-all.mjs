import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = process.cwd();
const targets = [
  {
    name: 'kiteTestnet',
    deployment: path.join(repoRoot, 'deployments', 'kiteTestnet.json'),
    command: ['pnpm', 'contracts:verify:testnet'],
  },
  {
    name: 'kiteMainnet',
    deployment: path.join(repoRoot, 'deployments', 'kiteMainnet.json'),
    command: ['pnpm', 'contracts:verify:mainnet'],
  },
];

const summary = [];

for (const target of targets) {
  console.log(`\n=== ${target.name} ===`);
  if (!existsSync(target.deployment)) {
    console.log(`Skipping ${target.name}: missing deployment file at ${target.deployment}`);
    summary.push({ name: target.name, status: 'skipped' });
    continue;
  }

  const result = spawnSync(target.command[0], target.command.slice(1), {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status === 0) {
    summary.push({ name: target.name, status: 'verified' });
  } else {
    summary.push({ name: target.name, status: `failed (${result.status ?? 'signal'})` });
  }
}

console.log('\n=== Verification Report ===');
for (const item of summary) {
  console.log(`${item.name}: ${item.status}`);
}

if (summary.some((item) => item.status.startsWith('failed'))) {
  process.exit(1);
}