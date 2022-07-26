require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()
require("./tasks/checkavailability")
require("./tasks/displaycommands")
require("./tasks/enterfourlotto")
require("./tasks/getinfo")
require("./tasks/mockdraw")
require("./tasks/pausefourlotto")
require("./tasks/performupkeep")
require("./tasks/resumefourlotto")

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const MAINNET_RPC_URL =
    process.env.MAINNET_RPC_URL ||
    process.env.ALCHEMY_MAINNET_RPC_URL ||
    "https://eth-mainnet.alchemyapi.io/v2/your-api-key"
const RINKEBY_RPC_URL =
    process.env.RINKEBY_RPC_URL || "https://eth-rinkeby.alchemyapi.io/v2/your-api-key"
const KOVAN_RPC_URL = process.env.KOVAN_RPC_URL || "https://eth-kovan.alchemyapi.io/v2/your-api-key"
const POLYGON_MAINNET_RPC_URL =
    process.env.POLYGON_MAINNET_RPC_URL || "https://polygon-mainnet.alchemyapi.io/v2/your-api-key"

// deployer account for testnets
const PRIVATE_KEY_DEPLOYER = process.env.PRIVATE_KEY_DEPLOYER || "0x"

// FourLotto players for testnets
const PRIVATE_KEY_PLAYER_ONE = process.env.PRIVATE_KEY_PLAYER_ONE
const PRIVATE_KEY_PLAYER_TWO = process.env.PRIVATE_KEY_PLAYER_TWO
const PRIVATE_KEY_PLAYER_THREE = process.env.PRIVATE_KEY_PLAYER_THREE
const PRIVATE_KEY_PLAYER_FOUR = process.env.PRIVATE_KEY_PLAYER_FOUR
const PRIVATE_KEY_PLAYER_FIVE = process.env.PRIVATE_KEY_PLAYER_FIVE
const PRIVATE_KEY_PLAYER_SIX = process.env.PRIVATE_KEY_PLAYER_SIX
const PRIVATE_KEY_PLAYER_SEVEN = process.env.PRIVATE_KEY_PLAYER_SEVEN
const PRIVATE_KEY_PLAYER_EIGHT = process.env.PRIVATE_KEY_PLAYER_EIGHT
const PRIVATE_KEY_PLAYER_NINE = process.env.PRIVATE_KEY_PLAYER_NINE
const PRIVATE_KEY_PLAYER_TEN = process.env.PRIVATE_KEY_PLAYER_TEN
const PRIVATE_KEY_PLAYER_ELEVEN = process.env.PRIVATE_KEY_PLAYER_ELEVEN
const PRIVATE_KEY_PLAYER_TWELVE = process.env.PRIVATE_KEY_PLAYER_TWELVE
const PRIVATE_KEY_PLAYER_THIRTEEN = process.env.PRIVATE_KEY_PLAYER_THIRTEEN
const PRIVATE_KEY_PLAYER_FOURTEEN = process.env.PRIVATE_KEY_PLAYER_FOURTEEN
const PRIVATE_KEY_PLAYER_FIFTEEN = process.env.PRIVATE_KEY_PLAYER_FIFTEEN
const PRIVATE_KEY_PLAYER_SIXTEEN = process.env.PRIVATE_KEY_PLAYER_SIXTEEN
const PRIVATE_KEY_PLAYER_SEVENTEEN = process.env.PRIVATE_KEY_PLAYER_SEVENTEEN
const PRIVATE_KEY_PLAYER_EIGHTEEN = process.env.PRIVATE_KEY_PLAYER_EIGHTEEN
const PRIVATE_KEY_PLAYER_NINETEEN = process.env.PRIVATE_KEY_PLAYER_NINETEEN

// optional
// const MNEMONIC = process.env.MNEMONIC || "your mnemonic"

// Your API key for Etherscan, obtain one at https://etherscan.io/
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "Your etherscan API key"
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "Your polygonscan API key"
const REPORT_GAS = process.env.REPORT_GAS || false

module.exports = {
    contractSizer: {
        runOnCompile: true,
    },
    defaultNetwork: "hardhat",
    etherscan: {
        // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: {
            rinkeby: ETHERSCAN_API_KEY,
            kovan: ETHERSCAN_API_KEY,
            polygon: POLYGONSCAN_API_KEY,
        },
    },
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        token: "ETH",
    },
    mocha: {
        timeout: 90000000, // 90000 seconds max for running tests
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
            1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
        },
        player: {
            default: 1,
        },
    },
    networks: {
        hardhat: {
            // // If you want to do some forking, uncomment this
            // forking: {
            //   url: MAINNET_RPC_URL
            // }
            chainId: 31337,
            accounts: {
                // count: 10000, // this line is only required for capabilitiescheck script, so comment it out if not required
                accountsBalance: "1000000000000000000000", // 1 thousand ETH
            },
            blockGasLimit: 15_000_000, // gas limit of a block
        },
        localhost: {
            chainId: 31337,
        },
        kovan: {
            url: KOVAN_RPC_URL,
            accounts: PRIVATE_KEY_DEPLOYER !== undefined ? [PRIVATE_KEY_DEPLOYER] : [],
            //accounts: {
            //     mnemonic: MNEMONIC,
            // },
            saveDeployments: true,
            chainId: 42,
        },
        rinkeby: {
            url: RINKEBY_RPC_URL,
            accounts: [
                PRIVATE_KEY_DEPLOYER,
                PRIVATE_KEY_PLAYER_ONE,
                PRIVATE_KEY_PLAYER_TWO,
                PRIVATE_KEY_PLAYER_THREE,
                PRIVATE_KEY_PLAYER_FOUR,
                PRIVATE_KEY_PLAYER_FIVE,
                PRIVATE_KEY_PLAYER_SIX,
                PRIVATE_KEY_PLAYER_SEVEN,
                PRIVATE_KEY_PLAYER_EIGHT,
                PRIVATE_KEY_PLAYER_NINE,
                PRIVATE_KEY_PLAYER_TEN,
                PRIVATE_KEY_PLAYER_ELEVEN,
                PRIVATE_KEY_PLAYER_TWELVE,
                PRIVATE_KEY_PLAYER_THIRTEEN,
                PRIVATE_KEY_PLAYER_FOURTEEN,
                PRIVATE_KEY_PLAYER_FIFTEEN,
                PRIVATE_KEY_PLAYER_SIXTEEN,
                PRIVATE_KEY_PLAYER_SEVENTEEN,
                PRIVATE_KEY_PLAYER_EIGHTEEN,
                PRIVATE_KEY_PLAYER_NINETEEN,
            ],
            //   accounts: {
            //     mnemonic: MNEMONIC,
            //   },
            saveDeployments: true,
            chainId: 4,
        },
        mainnet: {
            url: MAINNET_RPC_URL,
            accounts: PRIVATE_KEY_DEPLOYER !== undefined ? [PRIVATE_KEY_DEPLOYER] : [],
            //   accounts: {
            //     mnemonic: MNEMONIC,
            //   },
            saveDeployments: true,
            chainId: 1,
        },
        polygon: {
            url: POLYGON_MAINNET_RPC_URL,
            accounts: PRIVATE_KEY_DEPLOYER !== undefined ? [PRIVATE_KEY_DEPLOYER] : [],
            saveDeployments: true,
            chainId: 137,
        },
    },
    solidity: {
        version: "0.8.7",
        settings: {
            optimizer: {
                enabled: true,
                runs: 10000,
            },
        },
    },
}
