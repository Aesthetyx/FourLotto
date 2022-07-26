const { task } = require("hardhat/config")

task("checkavailability", "checks the availability of a four digit number for the current draw")
    .addPositionalParam(
        "bet",
        "four digit number that the player wishes to place bet on for current draw",
        undefined,
        types.string,
        false
    )
    .setAction(async (taskArgs) => {
        const ethers = hre.ethers
        const network = hre.network
        const accounts = await ethers.getSigners()
        const fourLotto = await ethers.getContract("FourLotto")
        const fourLottoConnected = await fourLotto.connect(accounts[0])
        const currentBets = await fourLottoConnected.getCurrentBets()
        const drawNumber = await fourLottoConnected.getCurrentDrawNumber()

        if (network.name == "hardhat") {
            console.log(" ")
            console.log(
                "=================================================================================================="
            )
            console.log(
                "hardhat network detected, please refer to information provided after deployment and work on other networks to interact with FourLotto"
            )
            console.log(" ")
            console.log("terminated checkavailability task")
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
                `${network.name} network detected, checking availability of ${taskArgs.bet} for the current draw (draw #${drawNumber})...`
            )
            console.log(" ")
            const lastTimeStamp = await fourLottoConnected.getLastTimeStamp()
            const timeOfCurrentDraw = new Date(
                lastTimeStamp.mul(1000).toNumber() + +3 * 24 * 60 * 60 * 1000
            )
            console.log(`estimated time of settlement for current draw: ${timeOfCurrentDraw}`)
            console.log(" ")
            if (currentBets.includes(taskArgs.bet)) {
                console.log(`${taskArgs.bet} is not available for current draw`)
            } else {
                console.log(`${taskArgs.bet} is available for current draw`)
            }
            console.log(" ")
            console.log("checkavailability task successfully executed")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        }
    })

module.exports = {}
