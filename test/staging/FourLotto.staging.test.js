const { assert, expect } = require("chai")
const { ethers, network } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("FourLotto staging tests", function () {
          let accounts,
              deployer,
              fourLottoContract,
              fourLottoDeployer,
              interval,
              fourLottoBetFee,
              winningNumbers
          const numberOfBetsPlaced = 19 // adjust this amount for number of players entering FourLotto during staging test (must not be greater than number of accounts)

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              fourLottoContract = await ethers.getContract("FourLotto")
              fourLottoDeployer = await ethers.getContract("FourLotto", deployer)
              interval = await fourLottoDeployer.getInterval()
              fourLottoBetFee = await fourLottoDeployer.getBetFee()
          })

          describe("test that FourLotto's interactions with chainlink VRF and chainlink keepers work", function () {
              it("works with live chainlink VRF and chainlink keepers to automatically determining winning numbers and pay out winnings and taxes", async () => {
                  console.log("    setting up FourLotto staging test...")
                  const startingTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  const startingDrawNumber = await fourLottoDeployer.getCurrentDrawNumber()

                  let playerAddressArray = [],
                      playerStartingBalanceArray = [],
                      playerBetArray = []

                  await new Promise(async (resolve, reject) => {
                      console.log("    setting up listener, listening for DrawCompleted event...")
                      fourLottoDeployer.once("DrawCompleted", async () => {
                          console.log("    event emitted, running through tests...")
                          try {
                              // player balances to be used in assert statements
                              let playerEndingBalanceArray = []
                              for (let i = 1; i < numberOfBetsPlaced + 1; i++) {
                                  let player = accounts[i]
                                  let playerEndingBalance = await player.getBalance()
                                  playerEndingBalanceArray.push(playerEndingBalance)
                              }
                              const deployerEndingBalance = await deployer.getBalance()
                              // winner details to be used in assert statements
                              winningNumbers = await fourLottoDeployer.getRecentWinningNumbers()
                              console.log(
                                  "    =================================================================================="
                              )
                              console.log(`    winning numbers:`)
                              console.log(`      - first place: ${winningNumbers[0]}`)
                              console.log(
                                  `      - second place: ${winningNumbers[1]}, ${winningNumbers[2]}`
                              )
                              console.log(
                                  `      - third place: ${winningNumbers[3]}, ${winningNumbers[4]}, ${winningNumbers[5]}`
                              )
                              console.log(
                                  `      - consolation: ${winningNumbers[6]}, ${winningNumbers[7]}, ${winningNumbers[8]}, ${winningNumbers[9]}`
                              )
                              console.log(
                                  "    =================================================================================="
                              )
                              const recentFirstPlaceWinner =
                                  await fourLottoDeployer.getRecentFirstPlaceWinner()
                              const recentSecondPlaceWinners =
                                  await fourLottoDeployer.getRecentSecondPlaceWinners()
                              const recentThirdPlaceWinners =
                                  await fourLottoDeployer.getRecentThirdPlaceWinners()
                              const recentConsolationWinners =
                                  await fourLottoDeployer.getRecentConsolationWinners()
                              // other FourLotto variables to be used in assert statements
                              const fourLottoState = await fourLottoDeployer.getFourLottoState()
                              const endingDrawNumber =
                                  await fourLottoDeployer.getCurrentDrawNumber()
                              const endingTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                              const currentPlayers = await fourLottoDeployer.getCurrentPlayers()
                              const numberOfCurrentPlayers =
                                  await fourLottoDeployer.getNumberOfCurrentPlayers()
                              const currentBets = await fourLottoDeployer.getCurrentBets()
                              const numberOfCurrentBets =
                                  await fourLottoDeployer.getNumberOfCurrentBets()
                              // tax calculations
                              console.log(`    winners:`)
                              let firstPlaceTax, secondPlaceTax, thirdPlaceTax, consolationPlaceTax
                              if (recentFirstPlaceWinner.length > 0) {
                                  firstPlaceTax = currentPot.mul(40).mul(5).div(100).div(100)
                                  console.log(`      - first place: ${recentFirstPlaceWinner}`)
                              } else {
                                  console.log(`      - first place: no winner`)
                              }
                              if (recentSecondPlaceWinners.length > 0) {
                                  secondPlaceTax = currentPot.mul(30).mul(5).div(100).div(100)
                                  console.log(`      - second place: ${recentSecondPlaceWinners}`)
                              } else {
                                  console.log(`      - second place: no winners`)
                              }
                              if (recentThirdPlaceWinners.length > 0) {
                                  thirdPlaceTax = currentPot.mul(20).mul(5).div(100).div(100)
                                  console.log(`      - third place: ${recentThirdPlaceWinners}`)
                              } else {
                                  console.log(`      - third place: no winners`)
                              }
                              if (recentConsolationWinners.length > 0) {
                                  consolationPlaceTax = currentPot.mul(10).mul(5).div(100).div(100)
                                  console.log(`      - consolation: ${recentConsolationWinners}`)
                              } else {
                                  console.log(`      - consolation: no winners`)
                              }
                              console.log(
                                  "    =================================================================================="
                              )

                              // assert statements
                              // winning numbers
                              console.log(
                                  "    checking if 10 winning numbers have been generated..."
                              )
                              expect(winningNumbers).to.not.be.empty
                              console.log(
                                  "    verified that 10 winning numbers have been generated"
                              )
                              // other lottery state variables
                              console.log(
                                  "    checking if s_drawNumber, s_fourLottoState, s_lastTimeStamp have been correctly updated..."
                              )
                              assert.equal(
                                  endingDrawNumber.toString(),
                                  startingDrawNumber.add(1).toString()
                              )
                              assert.equal(fourLottoState.toString(), "0")
                              assert(endingTimeStamp.sub(startingTimeStamp) > interval)
                              console.log(
                                  "    verified that s_drawNumber, s_fourLottoState, s_lastTimeStamp have been correctly updated"
                              )
                              // current players and bets
                              console.log(
                                  "    checking if current players and bets have been reset..."
                              )
                              expect(currentPlayers).to.be.empty
                              assert.equal(numberOfCurrentPlayers.toString(), "0")
                              expect(currentBets).to.be.empty
                              assert.equal(numberOfCurrentBets.toString(), "0")
                              console.log(
                                  "    verified that current players and bets have been reset"
                              )
                              // mappings
                              console.log(
                                  "    checking if s_players and s_bets mappings have been reset..."
                              )
                              for (let i = 0; i < numberOfBetsPlaced; i++) {
                                  const betDetails = await fourLottoDeployer.getCurrentBetDetails(
                                      playerBetArray[i]
                                  )
                                  const playerDetails =
                                      await fourLottoDeployer.getCurrentPlayerDetails(
                                          playerAddressArray[i]
                                      )
                                  assert.equal(
                                      playerDetails.isValid == false,
                                      playerDetails.bet == "",
                                      playerDetails.playerAddress == ethers.constants.AddressZero
                                  )
                                  assert.equal(
                                      betDetails.isValid == false,
                                      betDetails.bet == "",
                                      betDetails.playerAddress == ethers.constants.AddressZero
                                  )
                              }
                              console.log(
                                  "    verified that s_players and s_bets mappings have been reset"
                              )

                              // deployer balance
                              console.log("    checking if deployer balance is as expected...")
                              assert.equal(
                                  deployerEndingBalance.toString(),
                                  deployerStartingBalance
                                      .add(firstPlaceTax || 0)
                                      .add(secondPlaceTax || 0)
                                      .add(thirdPlaceTax || 0)
                                      .add(consolationPlaceTax || 0)
                                      //   .sub(performGasCost)
                                      //   .sub(fulfillGasCost)
                                      .toString()
                              )
                              console.log(`    verified that deployer balance is as expected`)

                              // player balances
                              console.log("    checking if player balances are as expected...")
                              for (i = 0; i < numberOfBetsPlaced; i++) {
                                  let playerAddress = playerAddressArray[i]
                                  let firstPlacePrizeMoney,
                                      secondPlacePrizeMoney,
                                      thirdPlacePrizeMoney,
                                      consolationPrizeMoney

                                  if (recentFirstPlaceWinner.includes(playerAddress)) {
                                      firstPlacePrizeMoney = firstPlaceWinnings
                                  }
                                  if (recentSecondPlaceWinners.includes(playerAddress)) {
                                      secondPlacePrizeMoney = secondPlaceWinnings.div(
                                          recentSecondPlaceWinners.length
                                      )
                                  }
                                  if (recentThirdPlaceWinners.includes(playerAddress)) {
                                      thirdPlacePrizeMoney = thirdPlaceWinnings.div(
                                          recentThirdPlaceWinners.length
                                      )
                                  }
                                  if (recentConsolationWinners.includes(playerAddress)) {
                                      consolationPrizeMoney = consolationWinnings.div(
                                          recentConsolationWinners.length
                                      )
                                  }
                                  assert.equal(
                                      playerEndingBalanceArray[i].toString(),
                                      playerStartingBalanceArray[i]
                                          .add(firstPlacePrizeMoney || 0)
                                          .add(secondPlacePrizeMoney || 0)
                                          .add(thirdPlacePrizeMoney || 0)
                                          .add(consolationPrizeMoney || 0)
                                          .toString()
                                  )
                                  console.log(
                                      `    verified that player ${i + 1} balance is as expected`
                                  )
                              }
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })

                      // place bets on FourLotto
                      console.log(`    ${numberOfBetsPlaced} players entering FourLotto...`)
                      for (let i = 1; i < numberOfBetsPlaced + 1; i++) {
                          let player = accounts[i]
                          const fourLotto = await fourLottoContract.connect(player)
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
                          // enter FourLotto
                          const txResponse = await fourLotto.enterFourLotto(playerBet, {
                              value: fourLottoBetFee,
                          })

                          // store player address and bet for assert statements
                          playerAddressArray.push(player.address)
                          playerBetArray.push(playerBet)
                          // progress updates in terminal
                          if (i < numberOfBetsPlaced) {
                              console.log(
                                  `    completed ${i} of ${numberOfBetsPlaced} bets to be placed...`
                              )
                          } else if (i == numberOfBetsPlaced) {
                              console.log(
                                  `    completed all ${numberOfBetsPlaced} bets, waiting for listener to pick up DrawCompleted event and check through assert statements to conclude staging test...`
                              )
                          }
                          if (i == numberOfBetsPlaced) {
                              await txResponse.wait(1) // buy time so that the player balances that are pulled in later sections of this report are accurate (from prior testing, code ran too quickly that some playerStartingBalance were pulled before their enterFourLotto transaction was mined and balance updated)
                          }
                      }
                      // store deployer starting balance for assert statements
                      const deployerStartingBalance = await deployer.getBalance()
                      // expected amounts transferred to player and deployer
                      const firstPlaceWinnings =
                          await fourLottoDeployer.getPotentialFirstPlaceWinnings()
                      const secondPlaceWinnings =
                          await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                      const thirdPlaceWinnings =
                          await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                      const consolationWinnings =
                          await fourLottoDeployer.getPotentialConsolationWinnings()
                      const currentPot = await fourLottoDeployer.getCurrentPot()
                      for (let i = 1; i < numberOfBetsPlaced + 1; i++) {
                          let player = accounts[i]
                          const playerStartingBalance = await player.getBalance()
                          // store player starting balances for assert statements
                          playerStartingBalanceArray.push(playerStartingBalance)
                      }

                      //   // call performUpkeep
                      //   await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                      //   await network.provider.send("evm_mine", [])
                      //   console.log("    performUpkeep manually called...")
                      //   const performTxResponse = await fourLottoDeployer.performUpkeep("0x")
                      //   const performTxReceipt = await performTxResponse.wait(1)
                      //   let performGasCost
                      //   {
                      //       const { gasUsed, effectiveGasPrice } = performTxReceipt
                      //       performGasCost = gasUsed.mul(effectiveGasPrice)
                      //   }
                      //   const requestId = performTxReceipt.events[1].args.requestId
                      //   console.log("    fulfillRandomWords manually called...")
                      //   const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      //       requestId,
                      //       fourLottoDeployer.address
                      //   )
                      //   const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                      //   let fulfillGasCost
                      //   {
                      //       const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                      //       fulfillGasCost = gasUsed.mul(effectiveGasPrice)
                      //   }
                  })
              })
          })
      })
