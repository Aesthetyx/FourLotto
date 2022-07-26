const networkConfig = {
    default: {
        name: "hardhat",
        keepersUpdateInterval: "30",
    },
    31337: {
        name: "localhost",
        subscriptionId: "1", // subscriptionId will always be 1 when deploying on localhost network because of how the createSubscription() works and because a new VRFCoordinatorV2Mock is deployed everytime hh deploy is used
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", // 30 gwei
        keepersUpdateInterval: "259200", // 3 days * 24 hours * 60 mins * 60 seconds = 259,200 seconds
        fourLottoBetFee: "10000000000000000", // 0.01 ETH
        callbackGasLimit: "2500000", // follow rinkeby limit until otherwise required
    },
    4: {
        name: "rinkeby",
        subscriptionId: "9139", // update this subscriptionId to the new subscriptionId if a new subscription is created for chainlink VRF
        gasLane: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc", // 30 gwei
        keepersUpdateInterval: "360", // set to 360 seconds for testing purposes on rinkeby testnet
        fourLottoBetFee: "10000000000000000", // 0.01 ETH
        callbackGasLimit: "2500000", // max gas limit is 2,500,000 gas for rinkeby, therefore set to max to minimise chance of having insufficient gas
        vrfCoordinatorV2: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
    },
    1: {
        name: "mainnet",
        subscriptionId: "1111", // to update if deploying on mainnet
        gasLane: "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef", // 200 gwei
        keepersUpdateInterval: "259200",
        fourLottoBetFee: "10000000000000000", // 0.01 ETH
        callbackGasLimit: "2500000", // follow rinkeby limit until otherwise required
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 10
const frontEndContractsFile = "../nextjs-smartcontract-lottery-fcc/constants/contractAddresses.json"
const frontEndAbiFile = "../nextjs-smartcontract-lottery-fcc/constants/abi.json"

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    frontEndContractsFile,
    frontEndAbiFile,
}
