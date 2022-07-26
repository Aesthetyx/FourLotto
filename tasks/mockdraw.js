const { task } = require("hardhat/config")
const { developmentChains } = require("../helper-hardhat-config")

task(
    "mockdraw",
    "mocks performUpkeep on localhost network to determine winning numbers for FourLotto and pay winners, if any"
).setAction(async () => {
    const ethers = hre.ethers
    const network = hre.network
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
    const fourLottoDeployer = await ethers.getContract("FourLotto", deployer)
    const interval = await fourLottoDeployer.getInterval()
    const drawNumber = await fourLottoDeployer.getCurrentDrawNumber()

    if (!developmentChains.includes(hre.network.name)) {
        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(
            "testnet / mainnet detected, please note that the mockdraw task is only meant for interaction with FourLotto deployed on the localhost network"
        )
        console.log(" ")
        console.log("terminated mockdraw task")
        console.log(
            "=================================================================================================="
        )
        console.log(" ")
    } else if (hre.network.name == developmentChains[0]) {
        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(
            "hardhat network detected, please refer to information provided after deployment and work on other networks to interact with FourLotto"
        )
        console.log(" ")
        console.log("terminated mockdraw task")
        console.log(
            "=================================================================================================="
        )
        console.log(" ")
    } else if (hre.network.name == developmentChains[1]) {
        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(
            `localhost network detected, settling the current draw (draw #${drawNumber})...`
        )
        const accounts = await ethers.getSigners()
        const deployer = accounts[0]
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        const fourLottoDeployer = await ethers.getContract("FourLotto", deployer)
        const interval = await fourLottoDeployer.getInterval()
        // to include more code here to display certain information and execute draw and display results
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
        await network.provider.send("evm_mine", [])
        console.log("simulating chainlink keepers and calling checkUpkeep...")
        const { upkeepNeeded } = await fourLottoDeployer.callStatic.checkUpkeep("0x")
        if (!upkeepNeeded) {
            console.log(
                "upkeepNeeded returned false, likely because no players have placed any bets for the current FourLotto draw, use the following command:"
            )
            console.log(
                "    - to place a bet on FourLotto: `hh enterfourlotto X YYYY --network localhost`"
            )
            console.log("      where,")
            console.log("          X = index position of the account to enter FourLotto")
            console.log("          YYYY = four digit number to place bet on")
            console.log(
                "          (note that each address can only enter FourLotto once and only one bet can be placed on a particular four digit number)"
            )
            console.log(" ")
            console.log("terminated mockdraw task")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        } else {
            console.log("checkUpkeep returned true")
            console.log("simulating chainlink keepers again and calling performUpkeep...")
            const performTxResponse = await fourLottoDeployer.performUpkeep("0x")
            const performTxReceipt = await performTxResponse.wait(1)
            const requestId = performTxReceipt.events[1].args.requestId
            console.log("simulating performUpkeep calling fulfillRandomWords...")
            await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, fourLottoDeployer.address)
            const lastTimeStamp = await fourLottoDeployer.getLastTimeStamp()
            const currentTime = new Date(lastTimeStamp.mul(1000).toNumber())
            console.log(" ")
            console.log(`draw #${drawNumber} concluded on ${currentTime}, details displayed below:`)
            const newDrawNumber = await fourLottoDeployer.getCurrentDrawNumber()
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
            console.log("mockdraw task successfully executed")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        }
    }
})

module.exports = {}
