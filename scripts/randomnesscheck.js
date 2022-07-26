const { ethers, deployments } = require("hardhat")

async function checkRandomness() {
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    const playerOne = accounts[1]
    await deployments.fixture(["mocks", "FourLotto"])
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
    const fourLottoContract = await ethers.getContract("FourLotto")
    const fourLottoDeployer = fourLottoContract.connect(deployer)
    const fourLottoPlayerOne = fourLottoContract.connect(playerOne)
    const fourLottoBetFee = await fourLottoDeployer.getBetFee()
    const interval = await fourLottoDeployer.getInterval()

    const playerOneBet = "0000"
    let allWinningNumbers = []
    const numberOfTrials = 20 // check this value to update number of trials to run
    let single = 0
    let double = 0
    let triple = 0
    let quad = 0
    let quint = 0
    let sex = 0
    let sept = 0
    let oct = 0
    let non = 0
    let dec = 0
    for (let i = 0; i < numberOfTrials; i++) {
        await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
            value: fourLottoBetFee,
        })
        await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
        await network.provider.send("evm_mine", [])
        const txResponse = await fourLottoDeployer.performUpkeep("0x")
        const txReceipt = await txResponse.wait(1)
        const requestId = txReceipt.events[1].args.requestId
        await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, fourLottoDeployer.address)
        const winningNumbers = await fourLottoDeployer.getRecentWinningNumbers()
        console.log(`trial ${i + 1}: winning numbers = ${winningNumbers}`)
        for (x = 0; x < winningNumbers.length; x++) {
            allWinningNumbers.push(winningNumbers[x])
        }
        let _single = 0
        let _double = 0
        let _triple = 0
        let _quad = 0
        let _quint = 0
        let _sex = 0
        let _sept = 0
        let _oct = 0
        let _non = 0
        let _dec = 0
        for (y = 0; y < winningNumbers.length; y++) {
            let counter = 0
            for (z = 0; z < winningNumbers.length; z++) {
                if (winningNumbers[y] == winningNumbers[z]) {
                    counter++
                }
            }
            if (counter == 1) {
                _single++
            } else if (counter == 2) {
                _double++
            } else if (counter == 3) {
                _triple++
            } else if (counter == 4) {
                _quad++
            } else if (counter == 5) {
                _quint++
            } else if (counter == 6) {
                _sex++
            } else if (counter == 7) {
                _sept++
            } else if (counter == 8) {
                _oct++
            } else if (counter == 9) {
                _non++
            } else if (counter == 10) {
                _dec++
            }
        }
        console.log(
            `duplicate analysis complete - single: ${_single}, double: ${_double}, triple: ${_triple}, quad: ${_quad}, quint: ${_quint}, sex: ${_sex}, sept: ${_sept}, oct: ${_oct}, non: ${_non}, dec: ${_dec}`
        )
        if (
            _double == 0 &&
            _triple == 0 &&
            _quad == 0 &&
            _quint == 0 &&
            _sex == 0 &&
            _sept == 0 &&
            _oct == 0 &&
            _non == 0 &&
            _dec == 0
        ) {
            single++
        }
        double += _double / 2
        triple += _triple / 3
        quad += _quad / 4
        quint += _quint / 5
        sex += _sex / 6
        sept += _sept / 7
        oct += _oct / 8
        non += _non / 9
        dec += _dec / 10
    }
    const countOfWinningNumbers = {}
    for (const element of allWinningNumbers) {
        if (countOfWinningNumbers[element]) {
            countOfWinningNumbers[element]++
        } else {
            countOfWinningNumbers[element] = 1
        }
    }
    let unique = []
    let twoTimes = []
    let threeTimes = []
    let fourTimes = []
    let fiveTimes = []
    let sixTimes = []
    let sevenTimes = []
    let eightTimes = []
    let nineTimes = []
    let tenToNineteen = []
    let twentyToTwentyNine = []
    let thirtyToThirtyNine = []
    let fortyToFortyNine = []
    let fiftyToNintyNine = []
    let oneHundredAndAbove = []
    for (let number in countOfWinningNumbers) {
        if (countOfWinningNumbers[number] == 1) {
            unique.push(number)
        } else if (countOfWinningNumbers[number] == 2) {
            twoTimes.push(number)
        } else if (countOfWinningNumbers[number] == 3) {
            threeTimes.push(number)
        } else if (countOfWinningNumbers[number] == 4) {
            fourTimes.push(number)
        } else if (countOfWinningNumbers[number] == 5) {
            fiveTimes.push(number)
        } else if (countOfWinningNumbers[number] == 6) {
            sixTimes.push(number)
        } else if (countOfWinningNumbers[number] == 7) {
            sevenTimes.push(number)
        } else if (countOfWinningNumbers[number] == 8) {
            eightTimes.push(number)
        } else if (countOfWinningNumbers[number] == 9) {
            nineTimes.push(number)
        } else if (countOfWinningNumbers[number] >= 10 && countOfWinningNumbers[number] <= 19) {
            tenToNineteen.push(number)
        } else if (countOfWinningNumbers[number] >= 20 && countOfWinningNumbers[number] <= 29) {
            twentyToTwentyNine.push(number)
        } else if (countOfWinningNumbers[number] >= 30 && countOfWinningNumbers[number] <= 39) {
            thirtyToThirtyNine.push(number)
        } else if (countOfWinningNumbers[number] >= 40 && countOfWinningNumbers[number] <= 49) {
            fortyToFortyNine.push(number)
        } else if (countOfWinningNumbers[number] >= 50 && countOfWinningNumbers[number] <= 99) {
            fiftyToNintyNine.push(number)
        } else if (countOfWinningNumbers[number] >= 100) {
            oneHundredAndAbove.push(number)
        }
    }
    console.log("                                                                                 ")
    console.log(
        "=================================================================================================="
    )
    console.log(`SUMMARY REPORT ON RANDOMNESS OF FOURLOTTO USING ${numberOfTrials} TRIALS`)
    console.log(
        "=================================================================================================="
    )
    console.log("                                                                                 ")
    console.log("@ Check on duplicated numbers within a draw:")
    console.log(`    - Number of draws with 10 unique numbers: ${single}`)
    console.log(`    - Number of draws with 9 unique numbers: ${double}`)
    console.log(`    - Number of draws with 8 unique numbers: ${triple}`)
    console.log(`    - Number of draws with 7 unique numbers: ${quad}`)
    console.log(`    - Number of draws with 6 unique numbers: ${quint}`)
    console.log(`    - Number of draws with 5 unique numbers: ${sex}`)
    console.log(`    - Number of draws with 4 unique numbers: ${sept}`)
    console.log(`    - Number of draws with 3 unique numbers: ${oct}`)
    console.log(`    - Number of draws with 2 unique numbers: ${non}`)
    console.log(`    - Number of draws with 1 unique numbers: ${dec}`)
    console.log("                                                                                 ")
    console.log("@ Check on randomness of numbers generated across all draws:")
    console.log(
        `    - Numbers that did not appear once in ${numberOfTrials} trial runs: ${
            10000 -
            unique.length -
            twoTimes.length -
            threeTimes.length -
            fourTimes.length -
            fiveTimes.length -
            sixTimes.length -
            sevenTimes.length -
            eightTimes.length -
            nineTimes.length -
            tenToNineteen.length -
            twentyToTwentyNine.length -
            thirtyToThirtyNine.length -
            fortyToFortyNine.length -
            fiftyToNintyNine.length -
            oneHundredAndAbove.length
        }`
    )
    console.log(
        `    - Numbers that appeared once in ${numberOfTrials} trial runs: ${unique.length}`
    )
    console.log(
        `    - Numbers that appeared twice in ${numberOfTrials} trial runs: ${twoTimes.length}`
    )
    console.log(
        `    - Numbers that appeared third in ${numberOfTrials} trial runs: ${threeTimes.length}`
    )
    console.log(
        `    - Numbers that appeared four times in ${numberOfTrials} trial runs: ${fourTimes.length}`
    )
    console.log(
        `    - Numbers that appeared five times in ${numberOfTrials} trial runs: ${fiveTimes.length}`
    )
    console.log(
        `    - Numbers that appeared six times in ${numberOfTrials} trial runs: ${sixTimes.length}`
    )
    console.log(
        `    - Numbers that appeared seven times in ${numberOfTrials} trial runs: ${sevenTimes.length}`
    )
    console.log(
        `    - Numbers that appeared eight times in ${numberOfTrials} trial runs: ${eightTimes.length}`
    )
    console.log(
        `    - Numbers that appeared nine times in ${numberOfTrials} trial runs: ${nineTimes.length}`
    )
    console.log(
        `    - Numbers that appeared 10 to 19 times in ${numberOfTrials} trial runs: ${tenToNineteen.length}`
    )
    console.log(
        `    - Numbers that appeared 20 to 29 times in ${numberOfTrials} trial runs: ${twentyToTwentyNine.length}`
    )
    console.log(
        `    - Numbers that appeared 30 to 39 times in ${numberOfTrials} trial runs: ${thirtyToThirtyNine.length}`
    )
    console.log(
        `    - Numbers that appeared 40 to 49 times in ${numberOfTrials} trial runs: ${fortyToFortyNine.length}`
    )
    console.log(
        `    - Numbers that appeared 50 to 99 times in ${numberOfTrials} trial runs: ${fiftyToNintyNine.length}`
    )
    console.log(
        `    - Numbers that appeared 100 times or more in ${numberOfTrials} trial runs: ${oneHundredAndAbove.length}`
    )
}

checkRandomness()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
