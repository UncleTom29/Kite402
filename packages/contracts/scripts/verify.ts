import { run, network } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const deploymentPath = path.resolve(
    __dirname,
    `../../../deployments/${network.name}.json`,
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment file found at ${deploymentPath}. Run deploy.ts first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const { contracts, deployer } = deployment;
  const successes: string[] = [];
  const failures: Array<{ name: string; error: string }> = [];

  console.log(`\n=== Verifying Kite402 Contracts on ${network.name} ===\n`);

  const verifyOne = async (
    name: string,
    address: string,
    constructorArgs: unknown[],
    contract?: string,
  ) => {
    console.log(`Verifying ${name} at ${address}...`);
    try {
      await run('verify:verify', {
        address,
        constructorArguments: constructorArgs,
        ...(contract ? { contract } : {}),
      });
      console.log(`  ✅ ${name} verified`);
      successes.push(name);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (
        message.includes('Already Verified') ||
        message.includes('already been verified')
      ) {
        console.log(`  ⚠️  ${name} already verified`);
        successes.push(name);
      } else {
        console.error(`  ❌ ${name} failed:`, e);
        failures.push({ name, error: message });
      }
    }
  };

  await verifyOne(
    'SpendPolicyLib',
    contracts.SpendPolicyLib,
    [],
    'contracts/SpendPolicyLib.sol:SpendPolicyLib',
  );
  await verifyOne('AgentVaultImplementation', contracts.AgentVaultImplementation, []);
  await verifyOne('KiteCardAttestation', contracts.KiteCardAttestation, [deployer]);
  await verifyOne('Kite402Registry', contracts.Kite402Registry, [deployer]);
  await verifyOne('MultiSigOperator', contracts.MultiSigOperator, [[deployer], 1]);

  console.log(`\nVerification summary for ${network.name}:`);
  console.log(`  Successful: ${successes.length}`);
  console.log(`  Failed    : ${failures.length}`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(`  - ${failure.name}: ${failure.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ Verification complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
