const { task } = require("hardhat/config")
const { developmentChains } = require("../helper-hardhat-config")

task("performupkeep", "manually calls performUpkeep on FourLotto to settle current draw").setAction(
    async (taskArgs) => {
        const ethers = hre.ethers
        const network = hre.network
        const accounts = await ethers.getSigners()
        const fourLotto = await ethers.getContract("FourLotto")
        const deployer = accounts[0]
        const fourLottoDeployer = await fourLotto.connect(deployer)
        const drawNumber = await fourLottoDeployer.getCurrentDrawNumber()

        if (network.name == "hardhat") {
            console.log(" ")
            console.log(
                "=================================================================================================="
            )
            console.log(
                "hardhat network detected, please refer to information provided after deployment and work on other networks to interact with FourLotto"
            )
            console.log(" ")
            console.log("terminated performupkeep task")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        } else if (network.name == "localhost") {
            console.log(" ")
            console.log(
                "=================================================================================================="
            )
            console.log(
                "localhost network detected, please note that the performupkeep task is only meant for interaction with FourLotto deployed on testnet / mainnet"
            )
            console.log(" ")
            console.log("terminated performupkeep task")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        } else {
            console.log(" ")
            console.log(
                "=================================================================================================="
            )
            console.log(
                `${network.name} network detected, calling performUpkeep to attempt to settle the current draw (draw #${drawNumber})...`
            )
            console.log(" ")

            const txResponse = await fourLottoDeployer.performUpkeep("0x")
            const txReceipt = await txResponse.wait(10)
            const newDrawNumber = await fourLottoDeployer.getCurrentDrawNumber()
            console.log(" ")
            const lastTimeStamp = await fourLottoDeployer.getLastTimeStamp()
            const currentTime = new Date(lastTimeStamp.mul(1000).toNumber())
            console.log(`draw #${drawNumber} concluded on ${currentTime}, details displayed below:`)
            const winningNumbers = await fourLottoDeployer.getRecentWinningNumbers()
            const firstPlaceWinner = await fourLottoDeployer.getRecentFirstPlaceWinner()
            const secondPlaceWinners = await fourLottoDeployer.getRecentSecondPlaceWinners()
            const thirdPlaceWinners = await fourLottoDeployer.getRecentThirdPlaceWinners()
            const consolationWinners = await fourLottoDeployer.getRecentConsolationWinners()
            console.log("    - winning numbers:")
            console.log(`        - first place: ${winningNumbers[0]}`)
            console.log(`        - second place: ${winningNumbers[1]}, ${winningNumbers[2]}`)
            console.log(
                `        - third place: ${winningNumbers[3]}, ${winningNumbers[4]}, ${winningNumbers[5]}`
            )
            console.log(
                `        - consolation: ${winningNumbers[6]}, ${winningNumbers[7]}, ${winningNumbers[8]}, ${winningNumbers[9]}`
            )
            console.log(" ")
            console.log("    - winners:")
            if (firstPlaceWinner.length > 0) {
                console.log(`        - first place winner: ${firstPlaceWinner}`)
            } else {
                console.log(`        - first place winner: no winner`)
            }
            if (secondPlaceWinners.length > 0) {
                console.log(`        - second place winners: ${secondPlaceWinners}`)
            } else {
                console.log(`        - second place winners: no winners`)
            }
            if (thirdPlaceWinners.length > 0) {
                console.log(`        - third place winners: ${thirdPlaceWinners}`)
            } else {
                console.log(`        - third place winners: no winners`)
            }
            if (consolationWinners.length > 0) {
                console.log(`        - consolation winners: ${consolationWinners}`)
            } else {
                console.log(`        - consolation winners: no winners`)
            }
            console.log(" ")
            console.log(`draw #${newDrawNumber} initiated and has started accepting bets...`)
            console.log(" ")
            console.log("performupkeep task successfully executed")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        }
    }
)

module.exports = {}
