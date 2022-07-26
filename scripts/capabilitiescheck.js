const { ethers, deployments } = require("hardhat")

// remember to set count of accounts in hardhat.config.js to 10,000 before executing this script
async function checkCapabilities() {
    // capabilitiescheck settings
    const numberOfBetsPlaced = 10000

    // Gas cost results (assuming 50gwei/gas)
    // enterFourLotto
    //      - first player: 260,550 gas, ~0.013 ETH
    //      - subsequent players: 255,259 gas, ~0.013 ETH
    // performUpkeep: 93,745 gas, ~0.005 ETH
    // fulfillRandomWords
    //      - 10 players: 440,768 gas, ~0.022 ETH (no winners)
    //      - 100 players: 440,768 gas, ~0.022 ETH (no winners)
    //      - 1000 players: 503,280 gas, ~0.025 ETH (1 consolation winner)
    //      - 5000 players: 636,372 gas, ~0.032 ETH (1 second place winner, 3 consolation winners)
    //      - 10000 players: 902,332 gas, ~0.045 ETH (all prizes won)

    if (numberOfBetsPlaced > 10000) {
        console.log(
            `Detected greater than 10,000 bets to be placed, since FourLotto has a bet limit of 10,000 per draw, please revise numberOfBetsPlaced to 10,000 or below`
        )
    } else {
        // first FourLotto draw's winning numbers
        const first = 9506
        const secondOne = 1929
        const secondTwo = 8251
        const thirdOne = 5175
        const thirdTwo = 6493
        const thirdThree = 7351
        const consolationOne = 855
        const consolationTwo = 2055
        const consolationThree = 2214
        const consolationFour = 8879

        // contracts setup
        const accounts = await ethers.getSigners()
        const deployer = accounts[0]
        await deployments.fixture(["mocks", "FourLotto"])
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        const fourLottoContract = await ethers.getContract("FourLotto")
        const fourLottoDeployer = fourLottoContract.connect(deployer)
        console.log(
            `FourLotto deployed, executing capabilitiescheck.js with ${numberOfBetsPlaced} bets placed on FourLotto...`
        )

        // FourLotto variables
        const fourLottoBetFee = await fourLottoDeployer.getBetFee()
        const interval = await fourLottoDeployer.getInterval()
        const firstPlaceShareOfWinnings = 40
        const secondPlaceShareOfWinnings = 30
        const thirdPlaceShareOfWinnings = 20
        const consolationShareOfWinnings = 10

        // variables to store gas information for enterFourLotto
        let enterFourLottoGasCost = 0
        let enterFourLottoGasUsed = 0
        let enterFourLottoEffectiveGasPrice = 0

        // expected winners for first FourLotto draw
        const firstPlaceAccount = accounts[first]
        const secondPlaceAccountOne = accounts[secondOne]
        const secondPlaceAccountTwo = accounts[secondTwo]
        const thirdPlaceAccountOne = accounts[thirdOne]
        const thirdPlaceAccountTwo = accounts[thirdTwo]
        const thirdPlaceAccountThree = accounts[thirdThree]
        const consolationAccountOne = accounts[consolationOne]
        const consolationAccountTwo = accounts[consolationTwo]
        const consolationAccountThree = accounts[consolationThree]
        const consolationAccountFour = accounts[consolationFour]

        console.log(
            `Placing ${numberOfBetsPlaced} bets with ${numberOfBetsPlaced} different addresses to test FourLotto's capabilities... (updates progress every minute)`
        )
        // timer to provide constant updates every minute on progress of the following loop
        let i = 0
        const timeUpdates = setInterval(minuteUpdates, 60000)
        let minutes = 0
        let betsPlaced = 0
        function minuteUpdates() {
            if (i > 0) {
                if (i + 1 > numberOfBetsPlaced) {
                    betsPlaced = numberOfBetsPlaced
                } else {
                    betsPlaced = i + 1
                }
                if (i + 1 == numberOfBetsPlaced) {
                    clearInterval(timeUpdates)
                }
                let date = new Date()
                date.setSeconds(
                    date.getSeconds() + ((numberOfBetsPlaced - (i + 1)) / (i + 1)) * minutes * 60
                )
                console.log(
                    `Placed ${betsPlaced} out of ${numberOfBetsPlaced} bets (~${Math.round(
                        (betsPlaced / numberOfBetsPlaced) * 100
                    )}%)... (~${minutes} minute(s) have passed, estimated time of completion: ${date})`
                )
            }
            minutes++
        }
        minuteUpdates()
        // place bets to test capability of FourLotto
        for (i = 0; i < numberOfBetsPlaced; i++) {
            const wallet = accounts[i]
            const fourLotto = fourLottoContract.connect(wallet)
            // player bet setup
            let playerBet
            if (i >= 0 && i < 10) {
                playerBet = ("000" + i).toString()
            } else if (i >= 10 && i < 100) {
                playerBet = ("00" + i).toString()
            } else if (i >= 100 && i < 1000) {
                playerBet = ("0" + i).toString()
            } else {
                playerBet = i.toString()
            }
            if (i == 0) {
                // enter FourLotto and save gas cost for first player
                const enterTxResponse = await fourLotto.enterFourLotto(playerBet, {
                    value: fourLottoBetFee,
                })
                const enterTxReceipt = await enterTxResponse.wait(1)
                const { gasUsed, effectiveGasPrice } = enterTxReceipt
                enterFourLottoGasUsed = gasUsed
                enterFourLottoEffectiveGasPrice = effectiveGasPrice
                enterFourLottoGasCost = gasUsed.mul(effectiveGasPrice)
            } else {
                // enter FourLotto
                await fourLotto.enterFourLotto(playerBet, {
                    value: fourLottoBetFee,
                })
            }
            if (i + 1 == numberOfBetsPlaced) {
                console.log(
                    `Placed all ${numberOfBetsPlaced} bets, simulating FourLotto draw... (~${minutes} minutes taken to place all bets)`
                )
            }
        }

        // obtain number of players who have entered FourLotto
        const numberOfPlayers = await fourLottoDeployer.getNumberOfCurrentPlayers()

        // increase time and mine block
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
        await network.provider.send("evm_mine", [])

        // obtain starting balance of winners
        const firstPlaceAccountStartingBalance = await firstPlaceAccount.getBalance()
        const secondPlaceAccountOneStartingBalance = await secondPlaceAccountOne.getBalance()
        const secondPlaceAccountTwoStartingBalance = await secondPlaceAccountTwo.getBalance()
        const thirdPlaceAccountOneStartingBalance = await thirdPlaceAccountOne.getBalance()
        const thirdPlaceAccountTwoStartingBalance = await thirdPlaceAccountTwo.getBalance()
        const thirdPlaceAccountThreeStartingBalance = await thirdPlaceAccountThree.getBalance()
        const consolationAccountOneStartingBalance = await consolationAccountOne.getBalance()
        const consolationAccountTwoStartingBalance = await consolationAccountTwo.getBalance()
        const consolationAccountThreeStartingBalance = await consolationAccountThree.getBalance()
        const consolationAccountFourStartingBalance = await consolationAccountFour.getBalance()

        // run performUpkeep and fulfillRandomWords
        const performUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
        const performUpkeepTxReceipt = await performUpkeepTxResponse.wait(1)
        let performUpkeepGasUsed
        let performUpkeepEffectiveGasPrice
        {
            const { gasUsed, effectiveGasPrice } = performUpkeepTxReceipt
            performUpkeepGasUsed = gasUsed
            performUpkeepEffectiveGasPrice = effectiveGasPrice
        }
        const performUpkeepGasCost = performUpkeepGasUsed.mul(performUpkeepEffectiveGasPrice)
        const requestId = performUpkeepTxReceipt.events[1].args.requestId
        const deployerStartingBalance = await deployer.getBalance()
        const currentPot = await fourLottoDeployer.getCurrentPot()
        const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
            requestId,
            fourLottoDeployer.address
        )
        console.log(`Completed FourLotto draw, analysing results...`)
        const fulfillTxReceipt = await fulfillTxResponse.wait(1)
        let fulfillRandomWordsGasUsed
        let fulfillRandomWordsEffectiveGasPrice
        {
            const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
            fulfillRandomWordsGasUsed = gasUsed
            fulfillRandomWordsEffectiveGasPrice = effectiveGasPrice
        }

        const fulfillRandomWordsGasCost = fulfillRandomWordsGasUsed.mul(
            fulfillRandomWordsEffectiveGasPrice
        )

        // obtain ending balance of winners
        const firstPlaceAccountEndingBalance = await firstPlaceAccount.getBalance()
        const secondPlaceAccountOneEndingBalance = await secondPlaceAccountOne.getBalance()
        const secondPlaceAccountTwoEndingBalance = await secondPlaceAccountTwo.getBalance()
        const thirdPlaceAccountOneEndingBalance = await thirdPlaceAccountOne.getBalance()
        const thirdPlaceAccountTwoEndingBalance = await thirdPlaceAccountTwo.getBalance()
        const thirdPlaceAccountThreeEndingBalance = await thirdPlaceAccountThree.getBalance()
        const consolationAccountOneEndingBalance = await consolationAccountOne.getBalance()
        const consolationAccountTwoEndingBalance = await consolationAccountTwo.getBalance()
        const consolationAccountThreeEndingBalance = await consolationAccountThree.getBalance()
        const consolationAccountFourEndingBalance = await consolationAccountFour.getBalance()

        // get winning numbers and winners
        const winningNumbers = await fourLottoDeployer.getRecentWinningNumbers()
        const firstPlaceWinner = await fourLottoDeployer.getRecentFirstPlaceWinner()
        const secondPlaceWinners = await fourLottoDeployer.getRecentSecondPlaceWinners()
        const thirdPlaceWinners = await fourLottoDeployer.getRecentThirdPlaceWinners()
        const consolationWinners = await fourLottoDeployer.getRecentConsolationWinners()
        const deployerEndingBalance = await deployer.getBalance()

        // hidden as this function takes too much gas and breaks script
        // gas cost of removing history of one draw
        // const removeTxResponse = await fourLottoDeployer.removeHistoryOfAPastDraw(1)
        // const removeTxReceipt = await removeTxResponse.wait(1)
        // let removeGasUsed
        // let removeEffectiveGasPrice
        // {
        //     const { gasUsed, effectiveGasPrice } = removeTxReceipt
        //     removeGasUsed = gasUsed
        //     removeEffectiveGasPrice = effectiveGasPrice
        // }
        // const removeGasCost = removeGasUsed.mul(removeEffectiveGasPrice)

        // gas estimation
        const feeData = await ethers.provider.getFeeData()
        const maxFeePerGas = ethers.utils.formatUnits(feeData.maxFeePerGas, "gwei")
        const gasPrice = ethers.utils.formatUnits(feeData.gasPrice, "gwei")

        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(`SUMMARY REPORT ON CAPABILITIES OF FOURLOTTO USING ${numberOfBetsPlaced} BETS`)
        console.log(`(FourLotto tested at ${numberOfPlayers.mul(100).div(10000)}% of max capacity)`)
        console.log(
            "=================================================================================================="
        )
        console.log(" ")
        console.log(
            "@ gas price / max fee per gas obtained from ethers.provider.getFeeData() (to serve as a reasonableness test for actual gas cost calculated below):"
        )
        console.log(`    - maxFeePerGas: ${maxFeePerGas} gwei`)
        console.log(`    - gasPrice: ${gasPrice} gwei`)
        console.log(" ")
        console.log("@ gas cost of enterFourLotto function:")
        console.log(`    - gas used: ${enterFourLottoGasUsed} gas`)
        console.log(
            `    - effective gas price: ${ethers.utils.formatUnits(
                enterFourLottoEffectiveGasPrice,
                "gwei"
            )} gwei/gas`
        )
        console.log(
            `    - gas cost: ${ethers.utils.formatUnits(enterFourLottoGasCost, "gwei")} gwei`
        )
        console.log(" ")
        console.log("@ gas cost of performUpkeep function:")
        console.log(`    - gas used: ${performUpkeepGasUsed} gas`)
        console.log(
            `    - effective gas price: ${ethers.utils.formatUnits(
                performUpkeepEffectiveGasPrice,
                "gwei"
            )} gwei/gas`
        )
        console.log(
            `    - gas cost: ${ethers.utils.formatUnits(performUpkeepGasCost, "gwei")} gwei`
        )
        console.log(" ")
        console.log("@ gas cost of fulfillRandomWord function:")
        console.log(`    - gas used: ${fulfillRandomWordsGasUsed} gas`)
        console.log(
            `    - effective gas price: ${ethers.utils.formatUnits(
                fulfillRandomWordsEffectiveGasPrice,
                "gwei"
            )} gwei/gas`
        )
        console.log(
            `    - gas cost: ${ethers.utils.formatUnits(fulfillRandomWordsGasCost, "gwei")} gwei`
        )
        console.log(" ")
        // console.log("@ gas cost of removeHistoryOfAPastDraw function:")
        // console.log(`    - gas used: ${removeGasUsed} gas`)
        // console.log(`    - effective gas price: ${removeEffectiveGasPrice} wei/gas`)
        // console.log(`    - gas cost: ${removeGasCost} wei`)
        // console.log(" ")
        console.log("@ results of FourLotto:")
        console.log(`    - First place: ${winningNumbers[0]}`)
        console.log(`    - Second place: ${winningNumbers[1]}, ${winningNumbers[2]}`)
        console.log(
            `    - Third place: ${winningNumbers[3]}, ${winningNumbers[4]}, ${winningNumbers[5]}`
        )
        console.log(
            `    - Consolation: ${winningNumbers[6]}, ${winningNumbers[7]}, ${winningNumbers[8]}, ${winningNumbers[9]}`
        )
        console.log(" ")
        console.log(
            "@ Check on winner identification system and payment of winnings and tax to winners/owner:"
        )
        // first place: 9506
        if (numberOfBetsPlaced < first) {
            console.log(
                `    - Increase number of bets placed to ${first} to test first place winner identification and payment`
            )
        } else {
            if (firstPlaceWinner.toString() == firstPlaceAccount.address.toString()) {
                if (
                    firstPlaceAccountEndingBalance.toString() ==
                    firstPlaceAccountStartingBalance
                        .add(currentPot.mul(firstPlaceShareOfWinnings).div(100).mul(95).div(100))
                        .toString()
                ) {
                    console.log(`    - First place winner accurately identified and paid`)
                } else {
                    ;`    - First place winner accurately identified but inaccurately paid (actual: ${firstPlaceAccountEndingBalance.toString()}, expected: ${firstPlaceAccountStartingBalance
                        .add(currentPot.mul(firstPlaceShareOfWinnings).div(100).mul(95).div(100))
                        .toString()})`
                }
            } else {
                console.log(
                    `    - First place winner inaccurately identified (actual: ${firstPlaceWinner}, expected: ${firstPlaceAccount.address})`
                )
            }
        }
        // second place 1: 1929
        if (numberOfBetsPlaced < secondOne) {
            console.log(
                `    - Increase number of bets placed to ${secondOne} to test second place winner 1 identification and payment`
            )
        } else {
            if (secondPlaceWinners[0].toString() == secondPlaceAccountOne.address.toString()) {
                if (
                    secondPlaceAccountOneEndingBalance.toString() ==
                    secondPlaceAccountOneStartingBalance
                        .add(
                            currentPot
                                .mul(secondPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(secondPlaceWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Second place winner 1 accurately identified and paid`)
                } else {
                    ;`    - Second place winner 1 accurately identified but inaccurately paid (actual: ${secondPlaceAccountOneEndingBalance.toString()}, expected: ${secondPlaceAccountOneStartingBalance
                        .add(
                            currentPot
                                .mul(secondPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(secondPlaceWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Second place winner 1 inaccurately identified (actual: ${secondPlaceWinners[0]}, expected: ${secondPlaceAccountOne.address})`
                )
            }
        }
        // second place 2: 8251
        if (numberOfBetsPlaced < secondTwo) {
            console.log(
                `    - Increase number of bets placed to ${secondTwo} to test second place winner 2 identification and payment`
            )
        } else {
            if (secondPlaceWinners[1].toString() == secondPlaceAccountTwo.address.toString()) {
                if (
                    secondPlaceAccountTwoEndingBalance.toString() ==
                    secondPlaceAccountTwoStartingBalance
                        .add(
                            currentPot
                                .mul(secondPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(secondPlaceWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Second place winner 2 accurately identified and paid`)
                } else {
                    ;`    - Second place winner 2 accurately identified but inaccurately paid (actual: ${secondPlaceAccountTwoEndingBalance.toString()}, expected: ${secondPlaceAccountTwoStartingBalance
                        .add(
                            currentPot
                                .mul(secondPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(secondPlaceWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Second place winner 2 inaccurately identified (actual: ${secondPlaceWinners[1]}, expected: ${secondPlaceAccountTwo.address})`
                )
            }
        }
        // third place 1: 5175
        if (numberOfBetsPlaced < thirdOne) {
            console.log(
                `    - Increase number of bets placed to ${thirdOne} to test third place winner 1 identification and payment`
            )
        } else {
            if (thirdPlaceWinners[0].toString() == thirdPlaceAccountOne.address.toString()) {
                if (
                    thirdPlaceAccountOneEndingBalance.toString() ==
                    thirdPlaceAccountOneStartingBalance
                        .add(
                            currentPot
                                .mul(thirdPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(thirdPlaceWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Third place winner 1 accurately identified and paid`)
                } else {
                    ;`    - Third place winner 1 accurately identified but inaccurately paid (actual: ${thirdPlaceAccountOneEndingBalance.toString()}, expected: ${thirdPlaceAccountOneStartingBalance
                        .add(
                            currentPot
                                .mul(thirdPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(thirdPlaceWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Third place winner 1 inaccurately identified (actual: ${thirdPlaceWinners[0]}, expected: ${thirdPlaceAccountOne.address})`
                )
            }
        }
        // third place 2: 6493
        if (numberOfBetsPlaced < thirdTwo) {
            console.log(
                `    - Increase number of bets placed to ${thirdTwo} to test third place winner 2 identification and payment`
            )
        } else {
            if (thirdPlaceWinners[1].toString() == thirdPlaceAccountTwo.address.toString()) {
                if (
                    thirdPlaceAccountTwoEndingBalance.toString() ==
                    thirdPlaceAccountTwoStartingBalance
                        .add(
                            currentPot
                                .mul(thirdPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(thirdPlaceWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Third place winner 2 accurately identified and paid`)
                } else {
                    ;`    - Third place winner 2 accurately identified but inaccurately paid (actual: ${thirdPlaceAccountTwoEndingBalance.toString()}, expected: ${thirdPlaceAccountTwoStartingBalance
                        .add(
                            currentPot
                                .mul(thirdPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(thirdPlaceWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Third place winner 2 inaccurately identified (actual: ${thirdPlaceWinners[1]}, expected: ${thirdPlaceAccountTwo.address})`
                )
            }
        }
        // third place 3: 7351
        if (numberOfBetsPlaced < thirdThree) {
            console.log(
                `    - Increase number of bets placed to ${thirdThree} to test third place winner 3 identification and payment`
            )
        } else {
            if (thirdPlaceWinners[2].toString() == thirdPlaceAccountThree.address.toString()) {
                if (
                    thirdPlaceAccountThreeEndingBalance.toString() ==
                    thirdPlaceAccountThreeStartingBalance
                        .add(
                            currentPot
                                .mul(thirdPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(thirdPlaceWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Third place winner 3 accurately identified and paid`)
                } else {
                    ;`    - Third place winner 3 accurately identified but inaccurately paid (actual: ${thirdPlaceAccountThreeEndingBalance.toString()}, expected: ${thirdPlaceAccountThreeStartingBalance
                        .add(
                            currentPot
                                .mul(thirdPlaceShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(thirdPlaceWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Third place winner 3 inaccurately identified (actual: ${thirdPlaceWinners[2]}, expected: ${thirdPlaceAccountThree.address})`
                )
            }
        }
        // consolation place 1: 0855
        if (numberOfBetsPlaced < consolationOne) {
            console.log(
                `    - Increase number of bets placed to ${consolationOne} to test consolation winner 1 identification and payment`
            )
        } else {
            if (consolationWinners[0].toString() == consolationAccountOne.address.toString()) {
                if (
                    consolationAccountOneEndingBalance.toString() ==
                    consolationAccountOneStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Consolation winner 1 accurately identified and paid`)
                } else {
                    ;`    - Consolation winner 1 accurately identified but inaccurately paid (actual: ${consolationAccountOneEndingBalance.toString()}, expected: ${consolationAccountOneStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Consolation winner 1 inaccurately identified (actual: ${consolationWinners[0]}, expected: ${consolationAccountOne.address})`
                )
            }
        }
        // consolation place 2: 2055
        if (numberOfBetsPlaced < consolationTwo) {
            console.log(
                `    - Increase number of bets placed to ${consolationTwo} to test consolation winner 2 identification and payment`
            )
        } else {
            if (consolationWinners[1].toString() == consolationAccountTwo.address.toString()) {
                if (
                    consolationAccountTwoEndingBalance.toString() ==
                    consolationAccountTwoStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Consolation winner 2 accurately identified and paid`)
                } else {
                    ;`    - Consolation winner 2 accurately identified but inaccurately paid (actual: ${consolationAccountTwoEndingBalance.toString()}, expected: ${consolationAccountTwoStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Consolation winner 2 inaccurately identified (actual: ${consolationWinners[1]}, expected: ${consolationAccountTwo.address})`
                )
            }
        }
        // consolation place 3: 2214
        if (numberOfBetsPlaced < consolationThree) {
            console.log(
                `    - Increase number of bets placed to ${consolationThree} to test consolation winner 3 identification and payment`
            )
        } else {
            if (consolationWinners[2].toString() == consolationAccountThree.address.toString()) {
                if (
                    consolationAccountThreeEndingBalance.toString() ==
                    consolationAccountThreeStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Consolation winner 3 accurately identified and paid`)
                } else {
                    ;`    - Consolation winner 3 accurately identified but inaccurately paid (actual: ${consolationAccountThreeEndingBalance.toString()}, expected: ${consolationAccountThreeStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Consolation winner 3 inaccurately identified (actual: ${consolationWinners[2]}, expected: ${consolationAccountThree.address})`
                )
            }
        }
        // consolation place 4: 8879
        if (numberOfBetsPlaced < consolationFour) {
            console.log(
                `    - Increase number of bets placed to ${consolationFour} to test consolation winner 4 identification and payment`
            )
        } else {
            if (consolationWinners[3].toString() == consolationAccountFour.address.toString()) {
                if (
                    consolationAccountFourEndingBalance.toString() ==
                    consolationAccountFourStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()
                ) {
                    console.log(`    - Consolation winner 4 accurately identified and paid`)
                } else {
                    ;`    - Consolation winner 4 accurately identified but inaccurately paid (actual: ${consolationAccountFourEndingBalance.toString()}, expected: ${consolationAccountFourStartingBalance
                        .add(
                            currentPot
                                .mul(consolationShareOfWinnings)
                                .div(100)
                                .mul(95)
                                .div(100)
                                .div(consolationWinners.length)
                        )
                        .toString()})`
                }
            } else {
                console.log(
                    `    - Consolation winner 4 inaccurately identified (actual: ${consolationWinners[3]}, expected: ${consolationAccountFour.address})`
                )
            }
        }
        // tax to owner
        const actualBalance = deployerEndingBalance
        let expectedBalance
        if (numberOfBetsPlaced < consolationOne) {
            expectedBalance = deployerStartingBalance.sub(fulfillRandomWordsGasCost)
        } else if (numberOfBetsPlaced >= consolationOne && numberOfBetsPlaced < secondOne) {
            expectedBalance = deployerStartingBalance
                .add(currentPot.mul(consolationShareOfWinnings).div(100).mul(5).div(100))
                .sub(fulfillRandomWordsGasCost)
        } else if (numberOfBetsPlaced >= secondOne && numberOfBetsPlaced < thirdOne) {
            expectedBalance = deployerStartingBalance
                .add(currentPot.mul(consolationShareOfWinnings).div(100).mul(5).div(100))
                .add(currentPot.mul(secondPlaceShareOfWinnings).div(100).mul(5).div(100))
                .sub(fulfillRandomWordsGasCost)
        } else if (numberOfBetsPlaced >= thirdOne && numberOfBetsPlaced < first) {
            expectedBalance = deployerStartingBalance
                .add(currentPot.mul(consolationShareOfWinnings).div(100).mul(5).div(100))
                .add(currentPot.mul(secondPlaceShareOfWinnings).div(100).mul(5).div(100))
                .add(currentPot.mul(thirdPlaceShareOfWinnings).div(100).mul(5).div(100))
                .sub(fulfillRandomWordsGasCost)
        } else if (numberOfBetsPlaced >= first) {
            expectedBalance = deployerStartingBalance
                .add(currentPot.mul(consolationShareOfWinnings).div(100).mul(5).div(100))
                .add(currentPot.mul(secondPlaceShareOfWinnings).div(100).mul(5).div(100))
                .add(currentPot.mul(thirdPlaceShareOfWinnings).div(100).mul(5).div(100))
                .add(currentPot.mul(firstPlaceShareOfWinnings).div(100).mul(5).div(100))
                .sub(fulfillRandomWordsGasCost)
        }
        if (actualBalance.toString() == expectedBalance.toString()) {
            console.log(`    - Tax accurately transferred to owner`)
        } else {
            console.log(
                `    - Tax inaccurately transferred to owner (actual: ${actualBalance.toString()}, expected: ${expectedBalance.toString()})`
            )
        }
    }
}

checkCapabilities()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
