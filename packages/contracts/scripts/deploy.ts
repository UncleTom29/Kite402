import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`\n=== Kite402 Contract Deployment ===`);
  console.log(`Network : ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // 1. Deploy SpendPolicyLib (library — linked automatically by Hardhat)
  console.log('1/5 Deploying SpendPolicyLib...');
  const SpendPolicyLib = await ethers.getContractFactory('SpendPolicyLib');
  const spendPolicyLib = await SpendPolicyLib.deploy();
  await spendPolicyLib.waitForDeployment();
  const libAddress = await spendPolicyLib.getAddress();
  console.log(`     SpendPolicyLib: ${libAddress}`);

  // 2. Deploy AgentVault implementation (UUPS — proxy deployed per agent)
  console.log('2/5 Deploying AgentVault implementation...');
  const AgentVault = await ethers.getContractFactory('AgentVault', {
    libraries: { SpendPolicyLib: libAddress },
  });
  const agentVaultImpl = await AgentVault.deploy();
  await agentVaultImpl.waitForDeployment();
  const vaultImplAddress = await agentVaultImpl.getAddress();
  console.log(`     AgentVault impl: ${vaultImplAddress}`);

  // 3. Deploy KiteCardAttestation
  console.log('3/5 Deploying KiteCardAttestation...');
  const KiteCardAttestation = await ethers.getContractFactory('KiteCardAttestation');
  const attestation = await KiteCardAttestation.deploy(deployer.address);
  await attestation.waitForDeployment();
  const attestationAddress = await attestation.getAddress();
  console.log(`     KiteCardAttestation: ${attestationAddress}`);

  // 4. Deploy Kite402Registry
  console.log('4/5 Deploying Kite402Registry...');
  const Kite402Registry = await ethers.getContractFactory('Kite402Registry');
  const registry = await Kite402Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`     Kite402Registry: ${registryAddress}`);

  // 5. Deploy MultiSigOperator (2-of-3 with deployer as sole signer for now)
  console.log('5/5 Deploying MultiSigOperator (1-of-1 placeholder — update signers before mainnet)...');
  const MultiSigOperator = await ethers.getContractFactory('MultiSigOperator');
  const multisig = await MultiSigOperator.deploy([deployer.address], 1);
  await multisig.waitForDeployment();
  const multisigAddress = await multisig.getAddress();
  console.log(`     MultiSigOperator: ${multisigAddress}`);

  // Save deployment addresses
  const deployments = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      SpendPolicyLib: libAddress,
      AgentVaultImplementation: vaultImplAddress,
      KiteCardAttestation: attestationAddress,
      Kite402Registry: registryAddress,
      MultiSigOperator: multisigAddress,
    },
  };

  const outDir = path.resolve(__dirname, '../../../deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2));

  console.log(`\n✅ Deployment complete. Addresses saved to ${outPath}`);
  console.log('\n=== Next Steps ===');
  console.log('1. Copy contract addresses to your .env file:');
  console.log(`   KITE402_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`   KITE_CARD_ATTESTATION_ADDRESS=${attestationAddress}`);
  console.log(`   AGENT_VAULT_IMPLEMENTATION_ADDRESS=${vaultImplAddress}`);
  console.log(`   MULTISIG_OPERATOR_ADDRESS=${multisigAddress}`);
  console.log('2. Run scripts/verify.ts to verify on KiteScan');
  console.log('3. Call registry.addRegistrar(<API_WALLET>) to authorise the backend');
  console.log('4. Call attestation.addAttestor(<API_WALLET>) to authorise the backend');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
