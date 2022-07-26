const { task } = require("hardhat/config")

task("getinfo", "obtains player and bet details for current FourLotto draw").setAction(async () => {
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
        console.log("terminated getinfo task")
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
            `${network.name} network detected, obtaining player and prize money information for the current draw (draw #${drawNumber})...`
        )
        console.log(" ")

        if (currentBets.length == 0) {
            console.log(`no players have placed bets for the current draw`)
        } else {
            console.log(
                `${currentBets.length} player(s) have placed bets for the current draw, details listed below:`
            )
            console.log(" ")
            console.log("player addresses                                  bets")
            let betsPlaced = []
            for (let i = 0; i < 10000; i++) {
                let number
                if (i >= 0 && i < 10) {
                    number = ("000" + i).toString()
                } else if (i >= 10 && i < 100) {
                    number = ("00" + i).toString()
                } else if (i >= 100 && i < 1000) {
                    number = ("0" + i).toString()
                } else {
                    number = i.toString()
                }
                if (currentBets.includes(number)) {
                    betsPlaced.push(number)
                }
            }

            for (let i = 0; i < betsPlaced.length; i++) {
                const player = await fourLottoConnected.getCurrentBetDetails(betsPlaced[i])
                console.log(`${i + 1}) ${player.playerAddress}:    ${player.bet}`)
            }
        }
        console.log(" ")
        const lastTimeStamp = await fourLottoConnected.getLastTimeStamp()
        const timeOfCurrentDraw = new Date(
            lastTimeStamp.mul(1000).toNumber() + 3 * 24 * 60 * 60 * 1000
        )
        if (currentBets.length == 0) {
            console.log(`current draw will be settled 3 days from the first bet placed`)
        } else {
            console.log(`estimated time of settlement for current draw: ${timeOfCurrentDraw}`)
        }
        console.log(" ")
        const currentPot = await fourLottoConnected.getCurrentPot()
        const fourLottoBalance = await fourLottoConnected.getFourLottoBalance()
        const potentialFirstPlaceWinnings =
            await fourLottoConnected.getPotentialFirstPlaceWinnings()
        const potentialSecondPlaceWinnings =
            await fourLottoConnected.getPotentialSecondPlaceWinnings()
        const potentialThirdPlaceWinnings =
            await fourLottoConnected.getPotentialThirdPlaceWinnings()
        const potentialConsolationWinnings =
            await fourLottoConnected.getPotentialConsolationWinnings()
        console.log("current draw prize money vs balance rolled forward:")
        console.log(
            `    - total prize money for current draw: ${ethers.utils.formatEther(currentPot)} ETH`
        )
        console.log(
            `    - amount of ETH rolled forward to future draws: ${ethers.utils.formatEther(
                fourLottoBalance.sub(currentPot)
            )} ETH`
        )
        console.log(" ")
        console.log("prize money for the current draw:")
        console.log(
            `    - first place prize money (post tax): ${ethers.utils.formatEther(
                potentialFirstPlaceWinnings
            )} ETH`
        )
        console.log(
            `    - second place prize money (post tax): ${ethers.utils.formatEther(
                potentialSecondPlaceWinnings
            )} ETH`
        )
        console.log(
            `    - third place prize money (post tax): ${ethers.utils.formatEther(
                potentialThirdPlaceWinnings
            )} ETH`
        )
        console.log(
            `    - consolation prize money (post tax): ${ethers.utils.formatEther(
                potentialConsolationWinnings
            )} ETH`
        )
        console.log(" ")
        console.log("getinfo task successfully executed")
        console.log(
            "=================================================================================================="
        )
        console.log(" ")
    }
})

module.exports = {}
