const { task, types } = require("hardhat/config")

task("enterfourlotto", "enters FourLotto and places a bet on the specified number")
    .addPositionalParam(
        "accountindex",
        "address with which to enter FourLotto",
        undefined,
        types.number,
        false
    )
    .addPositionalParam("playerbet", "number to place bet on", undefined, types.string, false)
    .setAction(async (taskArgs) => {
        const ethers = hre.ethers
        const network = hre.network
        const accounts = await ethers.getSigners()
        const player = accounts[taskArgs.accountindex]
        const fourLotto = await ethers.getContract("FourLotto")
        const fourLottoPlayer = await fourLotto.connect(player)
        const fourLottoBetFee = await fourLottoPlayer.getBetFee()
        const drawNumber = await fourLottoPlayer.getCurrentDrawNumber()

        if (network.name == "hardhat") {
            console.log(" ")
            console.log(
                "=================================================================================================="
            )
            console.log(
                "hardhat network detected, please refer to information provided after deployment and work on other networks to interact with FourLotto"
            )
            console.log(" ")
            console.log("terminated enterfourlotto task")
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
                `${network.name} network detected, entering FourLotto with account ${
                    taskArgs.accountindex
                } (address: ${player.address}) and placing bet on ${
                    taskArgs.playerbet
                } with ${ethers.utils.formatEther(
                    fourLottoBetFee
                )} ETH for the current draw (draw #${drawNumber})...`
            )
            console.log(" ")
            const fourLottoState = await fourLottoPlayer.getFourLottoState()
            const isOpen = fourLottoState.toString() == "0"
            const correctBetLength = taskArgs.playerbet.length == 4
            const betCheck = await fourLottoPlayer.getCurrentBetDetails(taskArgs.playerbet)
            const playerCheck = await fourLottoPlayer.getCurrentPlayerDetails(player.address)
            const acceptableBet =
                isOpen && correctBetLength && !betCheck.isValid && !playerCheck.isValid

            if (acceptableBet == false) {
                console.log("failed to place bet, likely reasons for failure listed below:")
                if (isOpen == false) {
                    console.log("    - FourLotto is not open and thus not accepting any bets")
                }
                if (correctBetLength == false) {
                    console.log(
                        `    - ${taskArgs.playerbet} is not a four digit number, only place bets on four digit numbers`
                    )
                }
                if (betCheck.isValid == true) {
                    console.log(`    - another player has already placed a bet on ${betCheck.bet}`)
                }
                if (playerCheck.isValid == true) {
                    console.log(
                        `    - player has already placed a bet on ${playerCheck.bet} for the current draw`
                    )
                }
                console.log(" ")
                console.log("terminated enterfourlotto task")
                console.log(
                    "=================================================================================================="
                )
                console.log(" ")
            } else {
                await fourLottoPlayer.enterFourLotto(taskArgs.playerbet, {
                    value: fourLottoBetFee,
                })
                const lastTimeStamp = await fourLottoPlayer.getLastTimeStamp()
                const currentTime = new Date(lastTimeStamp.mul(1000).toNumber())
                console.log(`bet successfully placed on ${currentTime}, details displayed below:`)
                const playerDetails = await fourLottoPlayer.getCurrentPlayerDetails(player.address)
                const betDetails = await fourLottoPlayer.getCurrentBetDetails(taskArgs.playerbet)
                console.log(`    - placed bet with address ${playerDetails.playerAddress}`)
                console.log(`    - placed bet on ${betDetails.bet}`)
                console.log(" ")
                const timeOfCurrentDraw = new Date(
                    lastTimeStamp.mul(1000).toNumber() + +3 * 24 * 60 * 60 * 1000
                )
                console.log(`estimated time of settlement for current draw: ${timeOfCurrentDraw}`)
                console.log(" ")
                console.log("enterfourlotto task successfully executed")
                console.log(
                    "=================================================================================================="
                )
                console.log(" ")
            }
        }
    })

module.exports = {}
