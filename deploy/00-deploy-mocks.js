const { network, ethers } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.002") // premium of 0.25 LINK per VRF on eth mainnet/testnet which is, at the present moment in time, estimated to be around 0.00125 ETH, overestimated to be 0.002 ETH
const GAS_PRICE_LINK = 1e9 // arbitrarily estimated to be 0.000000001 LINK per gas

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    // Mock to be deployed only if smart contract is deployed on the hardhat / localhost network
    if (chainId == 31337) {
        log("Local network detected, deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        })
    }
    console.log(
        "=================================================================================================="
    )
}

module.exports.tags = ["all", "mocks"]
