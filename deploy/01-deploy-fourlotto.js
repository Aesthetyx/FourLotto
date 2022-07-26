/* Import statements */
const { ethers, network } = require("hardhat")
const {
    developmentChains,
    networkConfig,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const SUBSCRIPTION_FUND_AMOUNT = ethers.utils.parseEther("200000") // arbitrarily set to 200000 ETH for funding the subscriptionId when deploying on hardhat / localhost network

/* deploy function */
module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    // decide appropriate VRFCoordinatorV2 address, i.e., if hardhat / localhost, use address of mock deployed, if not, use the actual address of the deployed VRFCoordinatorV2, which is contained in helper-hardhat-config.js
    if (chainId == 31337) {
        // obtain address of mock deployed
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        // create VRF v2 subscription via createSubscription() function in VRFCoordinatorV2Mock and obtain subscriptionId from the event emitted by the createSubscription() function
        console.log("Local network detected, creating subscription...")
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        console.log("Subscription ID obtained, funding subscription...")
        // fund the subscriptionId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, SUBSCRIPTION_FUND_AMOUNT)
        console.log("Subscription funded")
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }
    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS
    console.log(
        "=================================================================================================="
    )

    // constructor arguments for FourLotto
    const arguments = [
        deployer,
        vrfCoordinatorV2Address,
        subscriptionId,
        networkConfig[chainId]["gasLane"],
        networkConfig[chainId]["keepersUpdateInterval"],
        networkConfig[chainId]["fourLottoBetFee"],
        networkConfig[chainId]["callbackGasLimit"],
    ]

    // deploy FourLotto smart contract
    const FourLotto = await deploy("FourLotto", {
        from: deployer,
        log: true,
        args: arguments,
        waitConfirmations: waitBlockConfirmations,
    })

    // if deployed on ETH mainnet or any of the testnets, and if ETHERSCAN_API_KEY is contained within .env file, verify contract on etherscan
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying contract...")
        await verify(FourLotto.address, arguments)
    }

    // additional information for deployer
    console.log(
        "=================================================================================================="
    )
    console.log(
        "Please use this command to view available commands to interact with FourLotto: `hh displaycommands`"
    )
    console.log(
        "=================================================================================================="
    )
}

module.exports.tags = ["all", "FourLotto"]
