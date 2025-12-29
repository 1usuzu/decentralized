const hre = require("hardhat");

async function main() {
  console.log("Deploying DeepfakeVerification contract...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Oracle signer address (same as deployer for demo, use separate in production)
  const oracleSignerAddress = process.env.ORACLE_SIGNER_ADDRESS || deployer.address;
  console.log("Oracle signer:", oracleSignerAddress);

  // Deploy contract with oracle signer
  const DeepfakeVerification = await hre.ethers.getContractFactory("DeepfakeVerification");
  const contract = await DeepfakeVerification.deploy(oracleSignerAddress);

  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  console.log("DeepfakeVerification deployed to:", contractAddress);
  console.log("\nSave this address for frontend integration!");
  
  // Verify deployment
  const owner = await contract.owner();
  console.log("Contract owner:", owner);
  
  const oracleSigner = await contract.getOracleSigner();
  console.log("Oracle signer:", oracleSigner);
  
  const stats = await contract.getStats();
  console.log("Initial stats - DIDs:", stats[0].toString(), ", Verifications:", stats[1].toString());
  
  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    oracleSigner: oracleSignerAddress,
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    "./deployment.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
