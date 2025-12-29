const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying DeepfakeVerification contract...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  const DeepfakeVerification = await hre.ethers.getContractFactory("DeepfakeVerification");
  const contract = await DeepfakeVerification.deploy();

  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  console.log("✅ DeepfakeVerification deployed to:", contractAddress);
  console.log("\n📋 Save this address for frontend integration!");
  
  // Verify deployment
  const owner = await contract.owner();
  console.log("👤 Contract owner:", owner);
  
  const stats = await contract.getStats();
  console.log("📊 Initial stats - DIDs:", stats[0].toString(), ", Verifications:", stats[1].toString());
  
  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync(
    "./deployment.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
