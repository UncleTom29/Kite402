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

  console.log(`\n=== Verifying Kite402 Contracts on ${network.name} ===\n`);

  const verifyOne = async (name: string, address: string, constructorArgs: unknown[]) => {
    console.log(`Verifying ${name} at ${address}...`);
    try {
      await run('verify:verify', { address, constructorArguments: constructorArgs });
      console.log(`  ✅ ${name} verified`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('Already Verified')) {
        console.log(`  ⚠️  ${name} already verified`);
      } else {
        console.error(`  ❌ ${name} failed:`, e);
      }
    }
  };

  await verifyOne('SpendPolicyLib', contracts.SpendPolicyLib, []);
  await verifyOne('AgentVaultImplementation', contracts.AgentVaultImplementation, []);
  await verifyOne('KiteCardAttestation', contracts.KiteCardAttestation, [deployer]);
  await verifyOne('Kite402Registry', contracts.Kite402Registry, [deployer]);
  await verifyOne('MultiSigOperator', contracts.MultiSigOperator, [[deployer], 1]);

  console.log('\n✅ Verification complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
