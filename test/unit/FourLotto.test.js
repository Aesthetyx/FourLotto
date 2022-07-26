const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

// Since unit tests will all pass before smart contract is deployed to testnet, skip all unit tests if deploying on any network besides hardhat / localhost networks
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FourLotto Unit Tests", function () {
          let fourLottoContract,
              fourLottoDeployer,
              fourLottoPlayerOne,
              fourLottoPlayerTwo,
              fourLottoPlayerThree,
              fourLottoPlayerFour,
              fourLottoPlayerFive,
              vrfCoordinatorV2Mock,
              fourLottoBetFee,
              interval,
              playerOne,
              playerTwo,
              playerThree,
              playerFour,
              playerFive,
              deployer,
              accounts,
              taxRate
          // before all unit tests, deploy smart contracts and mocks and initialise all necessary variables
          beforeEach(async () => {
              // const { deployer, playerOne } = await getNamedAccounts()
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              playerOne = accounts[1]
              playerTwo = accounts[2]
              playerThree = accounts[3]
              playerFour = accounts[4]
              playerFive = accounts[5]
              await deployments.fixture(["mocks", "FourLotto"])
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              fourLottoContract = await ethers.getContract("FourLotto")
              fourLottoDeployer = fourLottoContract.connect(deployer)
              fourLottoPlayerOne = fourLottoContract.connect(playerOne)
              fourLottoPlayerTwo = fourLottoContract.connect(playerTwo)
              fourLottoPlayerThree = fourLottoContract.connect(playerThree)
              fourLottoPlayerFour = fourLottoContract.connect(playerFour)
              fourLottoPlayerFive = fourLottoContract.connect(playerFive)
              fourLottoBetFee = await fourLottoDeployer.getBetFee()
              interval = await fourLottoDeployer.getInterval()
              taxRate = 5
          })

          describe("constructor", function () {
              it("initialises i_owner correctly", async () => {
                  const owner = await fourLottoDeployer.getOwner()
                  assert.equal(owner, deployer.address)
              })

              it("initialises i_vrfCoordinator correctly", async () => {
                  const vrfCoordinator = await fourLottoDeployer.getVRFCoordinator()
                  assert.equal(vrfCoordinator, vrfCoordinatorV2Mock.address) // need to figure out why i_vrfCoordinator is just the address and not the entire VRFCoordinatorV2Mock contract
              })

              it("initialises i_gasLane correctly", async () => {
                  const gasLane = await fourLottoDeployer.getGasLane()
                  assert.equal(gasLane.toString(), networkConfig[network.config.chainId]["gasLane"])
              })

              it("initialises i_interval correctly", async () => {
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["keepersUpdateInterval"]
                  )
              })

              it("initialises i_subscriptionId correctly", async () => {
                  const subscriptionId = await fourLottoDeployer.getSubscriptionId()
                  assert.equal(
                      subscriptionId.toString(),
                      networkConfig[network.config.chainId]["subscriptionId"]
                  )
              })

              it("initialises i_betFee correctly", async () => {
                  assert.equal(
                      fourLottoBetFee.toString(),
                      networkConfig[network.config.chainId]["fourLottoBetFee"]
                  )
              })

              it("initialises s_fourLottoState correctly", async () => {
                  const fourLottoState = await fourLottoDeployer.getFourLottoState()
                  assert.equal(fourLottoState.toString(), "0")
              })

              it("initialises s_lastTimeStamp correctly", async () => {
                  const lastTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  assert(lastTimeStamp < Date.now())
              })

              it("initialises i_callbackGasLimit correctly", async () => {
                  const callbackGasLimit = await fourLottoDeployer.getCallbackGasLimit()
                  assert.equal(
                      callbackGasLimit.toString(),
                      networkConfig[network.config.chainId]["callbackGasLimit"]
                  )
              })
          })

          describe("receive", function () {
              it("transactions with empty calldata triggers receive", async () => {
                  const tx = playerOne.sendTransaction({
                      to: fourLottoDeployer.address,
                      data: "0x",
                  })
                  await expect(tx).to.be.revertedWith("FourLotto__NoFunctionCalled")
              })
          })

          describe("fallback", function () {
              it("transactions with inaccurate calldata triggers fallback", async () => {
                  const tx = playerOne.sendTransaction({
                      to: fourLottoDeployer.address,
                      data: "0x1234",
                  })
                  await expect(tx).to.be.revertedWith("FourLotto__UnknownFunctionCalled")
              })
          })

          describe("enterFourLotto", function () {
              it("reverts when FourLotto is not open (calculating)", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", []) // this can also be written as await network.provider.request({method:"evm_mine", params: []}) but former is shorter
                  // pretend to be a Chainlink keeper
                  await fourLottoDeployer.performUpkeep([])
                  await expect(
                      fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                          value: fourLottoBetFee,
                      })
                  ).to.be.revertedWith("FourLotto__FourLottoNotOpen")
              })

              it("reverts when FourLotto is not open (paused)", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoDeployer.pauseFourLotto()
                  await expect(
                      fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                          value: fourLottoBetFee,
                      })
                  ).to.be.revertedWith("FourLotto__FourLottoNotOpen")
              })

              it("reverts if a non four digit number is entered", async () => {
                  const playerOneBet = "0000"
                  const playerTwoBet = "00000"
                  const playerThreeBet = "000000"
                  const playerFourBet = "000"
                  const playerFiveBet = "00"
                  await assert(
                      fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                          value: fourLottoBetFee,
                      })
                  )
                  await expect(
                      fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                          value: fourLottoBetFee,
                      })
                  ).to.be.revertedWith("FourLotto__InvalidBet")
                  await expect(
                      fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                          value: fourLottoBetFee,
                      })
                  ).to.be.revertedWith("FourLotto__InvalidBet")
                  await expect(
                      fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                          value: fourLottoBetFee,
                      })
                  ).to.be.revertedWith("FourLotto__InvalidBet")
                  await expect(
                      fourLottoPlayerFive.enterFourLotto(playerFiveBet, {
                          value: fourLottoBetFee,
                      })
                  ).to.be.revertedWith("FourLotto__InvalidBet")
              })

              it("reverts if another player has already placed a bet for a particular number for current draw", async () => {
                  const playerOneBet = "0000"
                  const playerTwoBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await expect(
                      fourLottoPlayerTwo.enterFourLotto(playerTwoBet, { value: fourLottoBetFee })
                  ).to.be.revertedWith("FourLotto__NumberAlreadyTaken")
              })

              it("reverts if player has already placed a bet for current draw", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneSecondBet = "0001"
                  await expect(
                      fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                          value: fourLottoBetFee,
                      })
                  ).to.be.revertedWith("FourLotto__PlayerHasAlreadyEntered")
              })

              it("reverts if insufficient ETH is sent to fund bet", async () => {
                  const playerOneBet = "0000"
                  await expect(
                      fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                          value: fourLottoBetFee.sub(1),
                      })
                  ).to.be.revertedWith("FourLotto__SendMoreToFundBet")
              })

              it("updates s_lastTimeStamp based on when the first player enters", async () => {
                  const playerOneBet = "0000"
                  const playerTwoBet = "0001"
                  const firstTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 100])
                  await network.provider.send("evm_mine", [])
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const secondTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  assert(secondTimeStamp - firstTimeStamp >= interval.toNumber() - 100)
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const thirdTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  expect(thirdTimeStamp).to.be.equal(secondTimeStamp)
              })

              it("records player accurately after entry", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const players = await fourLottoDeployer.getCurrentPlayers()
                  const numberOfPlayers = await fourLottoDeployer.getNumberOfCurrentPlayers()
                  assert.equal(players[0] == playerOne.address, numberOfPlayers.toString() == "1")
                  expect(players[1]).to.be.undefined
              })

              it("records bet accurately after entry", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const bets = await fourLottoDeployer.getCurrentBets()
                  const numberOfBets = await fourLottoDeployer.getNumberOfCurrentBets()
                  assert.equal(bets[0] == playerOneBet, numberOfBets.toString() == "1")
                  expect(bets[1]).to.be.undefined
              })

              it("records s_betDetails mapping accurately after entry", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const betDetails = await fourLottoDeployer.getCurrentBetDetails(playerOneBet)
                  const defaultBetDetails = await fourLottoDeployer.getCurrentBetDetails("0001")
                  assert.equal(
                      betDetails.isValid == true,
                      betDetails.bet == playerOneBet,
                      betDetails.playerAddress == playerOne.address
                  )
                  assert.equal(
                      defaultBetDetails.isValid == false,
                      defaultBetDetails.bet == "",
                      defaultBetDetails.playerAddress == ethers.constants.AddressZero
                  )
              })

              it("records s_playerDetails mapping accurately after entry", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerDetails = await fourLottoDeployer.getCurrentPlayerDetails(
                      playerOne.address
                  )
                  const defaultPlayerDetails = await fourLottoDeployer.getCurrentPlayerDetails(
                      playerTwo.address
                  )
                  assert.equal(
                      playerDetails.isValid == true,
                      playerDetails.bet == playerOneBet,
                      playerDetails.playerAddress == playerOne.address
                  )
                  assert.equal(
                      defaultPlayerDetails.isValid == false,
                      defaultPlayerDetails.bet == "",
                      defaultPlayerDetails.playerAddress == ethers.constants.AddressZero
                  )
              })

              it("emits FourLottoEntered event when a player enters FourLotto", async () => {
                  const playerOneBet = "0000"
                  await expect(
                      fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                          value: fourLottoBetFee,
                      })
                  )
                      .to.emit(fourLottoDeployer, "FourLottoEntered")
                      .withArgs(playerOneBet, playerOne.address)
              })
          })

          describe("checkUpkeep", function () {
              it("returns false if FourLotto is not open (calculating)", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  // pretend to be Chainlink Keepers
                  await fourLottoDeployer.performUpkeep([])
                  const { upkeepNeeded } = await fourLottoDeployer.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded) // this is the same as assert.equal(upkeepNeeded, false), but former is shorter
              })

              it("returns false if FourLotto is not open (paused)", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoDeployer.pauseFourLotto()
                  const { upkeepNeeded } = await fourLottoDeployer.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })

              it("returns false if not enough time has passed", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 10])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await fourLottoDeployer.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })

              it("returns false if there are no players for the current draw", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await fourLottoDeployer.callStatic.checkUpkeep("0x")
                  assert(!upkeepNeeded)
              })

              it("returns true if enough time has passed, players have entered for current draw, there is ETH in the pot, and FourLotto is open", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await fourLottoDeployer.callStatic.checkUpkeep("0x")
                  assert(upkeepNeeded)
              })
          })

          describe("performUpkeep", function () {
              it("reverts if checkUpkeep returns false", async () => {
                  await expect(fourLottoDeployer.performUpkeep("0x")).to.be.revertedWith(
                      "FourLotto__UpkeepNotNeeded"
                  )
              })

              it("runs if checkUpkeep returns true", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const tx = await fourLottoDeployer.performUpkeep("0x")
                  assert(tx)
              })

              it("sets s_fourLottoState to calculating", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  await fourLottoDeployer.performUpkeep("0x")
                  const fourLottoState = await fourLottoDeployer.getFourLottoState()
                  assert.equal(fourLottoState.toString(), "1")
              })

              it("calls requestRandomWords from vrfCoordinatorV2Mock, which emits a RandomWordsRequested event that contains a requestId", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  await expect(fourLottoDeployer.performUpkeep("0x")).to.emit(
                      vrfCoordinatorV2Mock,
                      "RandomWordsRequested"
                  )
              })

              it("emits a WinningNumberRequested event which contains the requestId obtained from calling requestRandomWords from vrfCoordinatorV2Mock", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await fourLottoDeployer.performUpkeep("0x")
                  expect(txResponse).to.emit(vrfCoordinatorV2Mock, "WinningNumberRequested")
                  const txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.events[1].args.requestId
                  assert(requestId)
              })
          })

          describe("fulfillRandomWords", function () {
              it("can only be called after performUpkeep, i.e., calling fulfillRandomWords with a random requestId will not work", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, fourLottoDeployer.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(10, fourLottoDeployer.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(100, fourLottoDeployer.address)
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1000, fourLottoDeployer.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              it("should determine and save winning numbers", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstTxReceipt = await firstTxResponse.wait(1)
                  firstRequestId = firstTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstRequestId,
                      fourLottoDeployer.address
                  )
                  const firstWinningNumbers = await fourLottoDeployer.getRecentWinningNumbers()
                  console.log(`    First set of winning numbers: ${firstWinningNumbers}`) // 9506,1929,8251,5175,6493,7351,0855,2055,2214,8879
                  expect(firstWinningNumbers).to.not.be.empty
                  // second draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const SecondTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const SecondTxReceipt = await SecondTxResponse.wait(1)
                  SecondRequestId = SecondTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      SecondRequestId,
                      fourLottoDeployer.address
                  )
                  const secondWinningNumbers = await fourLottoDeployer.getRecentWinningNumbers()
                  console.log(`    Second set of winning numbers: ${secondWinningNumbers}`) // 8157,3932,0683,7709,8726,8863,5775,1635,5989,7131
                  expect(secondWinningNumbers).to.not.be.empty
                  assert(secondWinningNumbers != firstWinningNumbers)
              })

              it("should not pay out winnings and tax if there are no winners (current pot = 0 ETH)", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.toString()
                  )
              })

              it("should not pay out winnings and tax if there are no winners (0 ETH < current pot < 100 ETH)", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).toString()
                  )

                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.toString()
                  )
              })

              it("should not pay out winnings and tax if there are no winners (current pot > 100 ETH)", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.toString()
                  )
              })

              it("should accurately pay out first place winnings and tax if first place winner is identified (current pot = 0 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "9506"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const firstPlaceWinnings =
                      await fourLottoDeployer.getPotentialFirstPlaceWinnings()
                  const firstPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(40)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(firstPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(firstPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.sub(firstPlaceWinnings).sub(firstPlaceTax).toString()
                  )
              })

              it("should accurately pay out first place winnings and tax if first place winner is identified (0 ETH < current pot < 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "8157"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const firstPlaceWinnings =
                      await fourLottoDeployer.getPotentialFirstPlaceWinnings()
                  const firstPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(40)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(firstPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(firstPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.sub(firstPlaceWinnings).sub(firstPlaceTax).toString()
                  )
              })

              it("should accurately pay out first place winnings and tax if first place winner is identified (current pot > 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "8157"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const firstPlaceWinnings =
                      await fourLottoDeployer.getPotentialFirstPlaceWinnings()
                  const firstPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(40)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(firstPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(firstPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.sub(firstPlaceWinnings).sub(firstPlaceTax).toString()
                  )
              })

              it("should accurately pay out second place winnings and tax if 1 second place winner is identified (current pot = 0 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "1929"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const secondPlaceWinnings =
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  const secondPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(30)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(secondPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(secondPlaceWinnings)
                          .sub(secondPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out second place winnings and tax if 1 second place winner is identified (0 ETH < current pot < 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "3932"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const secondPlaceWinnings =
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  const secondPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(30)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(secondPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(secondPlaceWinnings)
                          .sub(secondPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out second place winnings and tax if 1 second place winner is identified (current pot > 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "3932"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const secondPlaceWinnings =
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  const secondPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(30)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(secondPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(secondPlaceWinnings)
                          .sub(secondPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out second place winnings and tax if 2 second place winners are identified (current pot = 0 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "1929"
                  const playerTwoBet = "8251"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const secondPlaceWinnings = (
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  ).div(2)
                  const secondPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(30)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(secondPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(secondPlaceWinnings.mul(2))
                          .sub(secondPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out second place winnings and tax if 2 second place winners are identified (0 ETH < current pot < 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "3932"
                  const playerTwoBet = "0683"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const secondPlaceWinnings = (
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  ).div(2)
                  const secondPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(30)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(secondPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(secondPlaceWinnings.mul(2))
                          .sub(secondPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out second place winnings and tax if 2 second place winners are identified (current pot > 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "3932"
                  const playerTwoBet = "0683"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const secondPlaceWinnings = (
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  ).div(2)
                  const secondPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(30)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(secondPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(secondPlaceWinnings.mul(2))
                          .sub(secondPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 1 third place winner is identified (current pot = 0 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "5175"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings =
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.sub(thirdPlaceWinnings).sub(thirdPlaceTax).toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 1 third place winner is identified (0 ETH < current pot < 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "7709"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings =
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.sub(thirdPlaceWinnings).sub(thirdPlaceTax).toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 1 third place winner is identified (current pot > 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "7709"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings =
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance.sub(thirdPlaceWinnings).sub(thirdPlaceTax).toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 2 third place winners are identified (current pot = 0 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "5175"
                  const playerTwoBet = "6493"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings = (
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  ).div(2)
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(thirdPlaceWinnings.mul(2))
                          .sub(thirdPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 2 third place winners are identified (0 ETH < current pot < 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "7709"
                  const playerTwoBet = "8726"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings = (
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  ).div(2)
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(thirdPlaceWinnings.mul(2))
                          .sub(thirdPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 2 third place winners are identified (current pot > 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "7709"
                  const playerTwoBet = "8726"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings = (
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  ).div(2)
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(thirdPlaceWinnings.mul(2))
                          .sub(thirdPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 3 third place winners are identified (current pot = 0 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "5175"
                  const playerTwoBet = "6493"
                  const playerThreeBet = "7351"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings = (
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  ).div(3)
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(thirdPlaceWinnings.mul(3))
                          .sub(thirdPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 3 third place winners are identified (0 ETH < current pot < 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "7709"
                  const playerTwoBet = "8726"
                  const playerThreeBet = "8863"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings = (
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  ).div(3)
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(thirdPlaceWinnings.mul(3))
                          .sub(thirdPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out third place winnings and tax if 3 third place winners are identified (current pot > 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "7709"
                  const playerTwoBet = "8726"
                  const playerThreeBet = "8863"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const thirdPlaceWinnings = (
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  ).div(3)
                  const thirdPlaceTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(20)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(thirdPlaceTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(thirdPlaceWinnings.mul(3))
                          .sub(thirdPlaceTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 1 consolation winner is identified (current pot = 0 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0855"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings =
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings)
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 1 consolation winner is identified (0 ETH < current pot < 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings =
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings)
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 1 consolation winner is identified (current pot > 100 ETH) and saves winner in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings =
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings)
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 2 consolation winners are identified (current pot = 0 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0855"
                  const playerTwoBet = "2055"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(2)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(2))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 2 consolation winners are identified (0 ETH < current pot < 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  const playerTwoBet = "1635"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(2)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(2))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 2 consolation winners are identified (current pot > 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  const playerTwoBet = "1635"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(2)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(2))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 3 consolation winners are identified (current pot = 0 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0855"
                  const playerTwoBet = "2055"
                  const playerThreeBet = "2214"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(3)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(3))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 3 consolation winners are identified (0 ETH < current pot < 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  const playerTwoBet = "1635"
                  const playerThreeBet = "5989"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(3)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(3))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 3 consolation winners are identified (current pot > 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  const playerTwoBet = "1635"
                  const playerThreeBet = "5989"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(3)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(3))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 4 consolation winners are identified (current pot = 0 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0855"
                  const playerTwoBet = "2055"
                  const playerThreeBet = "2214"
                  const playerFourBet = "8879"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const playerFourStartingBalance = await playerFour.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(4)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const playerFourEndingBalance = await playerFour.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerFourEndingBalance.toString(),
                      playerFourStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(4))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 4 consolation winners are identified (0 ETH < current pot < 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  const playerTwoBet = "1635"
                  const playerThreeBet = "5989"
                  const playerFourBet = "7131"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const playerFourStartingBalance = await playerFour.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(4)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const playerFourEndingBalance = await playerFour.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerFourEndingBalance.toString(),
                      playerFourStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(4))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out consolation winnings and tax if 4 consolation winners are identified (current pot > 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "5775"
                  const playerTwoBet = "1635"
                  const playerThreeBet = "5989"
                  const playerFourBet = "7131"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const playerFourStartingBalance = await playerFour.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const consolationWinnings = (
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  ).div(4)
                  const consolationTax = (await fourLottoDeployer.getCurrentPot())
                      .mul(10)
                      .mul(5)
                      .div(100)
                      .div(100)
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const playerFourEndingBalance = await playerFour.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      playerFourEndingBalance.toString(),
                      playerFourStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(consolationTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(consolationWinnings.mul(4))
                          .sub(consolationTax)
                          .toString()
                  )
              })

              it("should accurately pay out winnings and tax if winners are identified at all tiers (current pot = 0 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "9506"
                  const playerTwoBet = "1929"
                  const playerThreeBet = "5175"
                  const playerFourBet = "0855"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const playerFourStartingBalance = await playerFour.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const firstPlaceWinnings =
                      await fourLottoDeployer.getPotentialFirstPlaceWinnings()
                  const secondPlaceWinnings =
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  const thirdPlaceWinnings =
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  const consolationWinnings =
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  const currentPot = await fourLottoDeployer.getCurrentPot()
                  const winningsTax = currentPot
                      .mul(40)
                      .mul(5)
                      .div(100)
                      .div(100)
                      .add(currentPot.mul(30).mul(5).div(100).div(100))
                      .add(currentPot.mul(20).mul(5).div(100).div(100))
                      .add(currentPot.mul(10).mul(5).div(100).div(100))
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const playerFourEndingBalance = await playerFour.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(firstPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerFourEndingBalance.toString(),
                      playerFourStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(winningsTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(firstPlaceWinnings)
                          .sub(secondPlaceWinnings)
                          .sub(thirdPlaceWinnings)
                          .sub(consolationWinnings)
                          .sub(winningsTax)
                          .toString()
                  )
              })

              it("should accurately pay out winnings and tax if winners are identified at all tiers (0 ETH < current pot < 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("50"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "8157"
                  const playerTwoBet = "3932"
                  const playerThreeBet = "7709"
                  const playerFourBet = "5775"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const playerFourStartingBalance = await playerFour.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const firstPlaceWinnings =
                      await fourLottoDeployer.getPotentialFirstPlaceWinnings()
                  const secondPlaceWinnings =
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  const thirdPlaceWinnings =
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  const consolationWinnings =
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  const currentPot = await fourLottoDeployer.getCurrentPot()
                  const winningsTax = currentPot
                      .mul(40)
                      .mul(5)
                      .div(100)
                      .div(100)
                      .add(currentPot.mul(30).mul(5).div(100).div(100))
                      .add(currentPot.mul(20).mul(5).div(100).div(100))
                      .add(currentPot.mul(10).mul(5).div(100).div(100))
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const playerFourEndingBalance = await playerFour.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(firstPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerFourEndingBalance.toString(),
                      playerFourStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(winningsTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(firstPlaceWinnings)
                          .sub(secondPlaceWinnings)
                          .sub(thirdPlaceWinnings)
                          .sub(consolationWinnings)
                          .sub(winningsTax)
                          .toString()
                  )
              })

              it("should accurately pay out winnings and tax if winners are identified at all tiers (current pot > 100 ETH) and save winners in the respective recent winners array", async () => {
                  const playerOneBet = "0000"
                  // first draw
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: ethers.utils.parseEther("150"),
                  })

                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const firstUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const firstUpkeepTxReceipt = await firstUpkeepTxResponse.wait(1)
                  firstUpkeepRequestId = firstUpkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      firstUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  // second draw
                  const playerOneSecondBet = "8157"
                  const playerTwoBet = "3932"
                  const playerThreeBet = "7709"
                  const playerFourBet = "5775"
                  await fourLottoPlayerOne.enterFourLotto(playerOneSecondBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  const playerOneStartingBalance = await playerOne.getBalance()
                  const playerTwoStartingBalance = await playerTwo.getBalance()
                  const playerThreeStartingBalance = await playerThree.getBalance()
                  const playerFourStartingBalance = await playerFour.getBalance()
                  const fourLottoStartingBalance = await fourLottoDeployer.getFourLottoBalance()
                  const firstPlaceWinnings =
                      await fourLottoDeployer.getPotentialFirstPlaceWinnings()
                  const secondPlaceWinnings =
                      await fourLottoDeployer.getPotentialSecondPlaceWinnings()
                  const thirdPlaceWinnings =
                      await fourLottoDeployer.getPotentialThirdPlaceWinnings()
                  const consolationWinnings =
                      await fourLottoDeployer.getPotentialConsolationWinnings()
                  const currentPot = await fourLottoDeployer.getCurrentPot()
                  const winningsTax = currentPot
                      .mul(40)
                      .mul(5)
                      .div(100)
                      .div(100)
                      .add(currentPot.mul(30).mul(5).div(100).div(100))
                      .add(currentPot.mul(20).mul(5).div(100).div(100))
                      .add(currentPot.mul(10).mul(5).div(100).div(100))
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const secondUpkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondUpkeepTxReceipt = await secondUpkeepTxResponse.wait(1)
                  secondUpkeepRequestId = secondUpkeepTxReceipt.events[1].args.requestId
                  const deployerStartingBalance = await deployer.getBalance()
                  const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondUpkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const playerFourEndingBalance = await playerFour.getBalance()
                  const deployerEndingBalance = await deployer.getBalance()
                  const fourLottoEndingBalance = await fourLottoDeployer.getFourLottoBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.add(firstPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(secondPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(thirdPlaceWinnings).toString()
                  )
                  assert.equal(
                      playerFourEndingBalance.toString(),
                      playerFourStartingBalance.add(consolationWinnings).toString()
                  )
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.sub(gasCost).add(winningsTax).toString()
                  )
                  assert.equal(
                      fourLottoEndingBalance.toString(),
                      fourLottoStartingBalance
                          .sub(firstPlaceWinnings)
                          .sub(secondPlaceWinnings)
                          .sub(thirdPlaceWinnings)
                          .sub(consolationWinnings)
                          .sub(winningsTax)
                          .toString()
                  )
              })

              it("should accurately record winners to the respective recent winner arrays", async () => {
                  const playerOneBet = "9506"
                  const playerTwoBet = "1929"
                  const playerThreeBet = "5175"
                  const playerFourBet = "0855"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const recentFirstPlaceWinner = await fourLottoDeployer.getRecentFirstPlaceWinner()
                  const recentSecondPlaceWinners =
                      await fourLottoDeployer.getRecentSecondPlaceWinners()
                  const recentThirdPlaceWinners =
                      await fourLottoDeployer.getRecentThirdPlaceWinners()
                  const recentConsolationWinners =
                      await fourLottoDeployer.getRecentConsolationWinners()
                  assert.equal(
                      recentFirstPlaceWinner[0] == playerOne.address,
                      recentSecondPlaceWinners[0] == playerTwo.address,
                      recentThirdPlaceWinners[0] == playerThree.address,
                      recentConsolationWinners[0] == playerFour.address
                  )
                  expect(recentFirstPlaceWinner[1]).to.be.undefined
                  expect(recentSecondPlaceWinners[1]).to.be.undefined
                  expect(recentThirdPlaceWinners[1]).to.be.undefined
                  expect(recentConsolationWinners[1]).to.be.undefined
              })

              it('should increase s_drawNumber by 1 to "reset" mappings', async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const startingDrawNumber = await fourLottoDeployer.getCurrentDrawNumber()
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const endingDrawNumber = await fourLottoDeployer.getCurrentDrawNumber()
                  assert.equal(endingDrawNumber.toString(), startingDrawNumber.add(1).toString())
              })

              it("should update s_lastTimeStamp to time of current draw", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  const startingTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const endingTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  assert(endingTimeStamp - startingTimeStamp > interval)
              })

              it("should set s_fourLottoState back to open", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      upkeepRequestId,
                      fourLottoDeployer.address
                  )
                  const fourLottoState = await fourLottoDeployer.getFourLottoState()
                  assert.equal(fourLottoState.toString(), "0")
              })

              it("should emit DrawCompleted event", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const upkeepTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const upkeepTxReceipt = await upkeepTxResponse.wait(1)
                  upkeepRequestId = upkeepTxReceipt.events[1].args.requestId
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(
                          upkeepRequestId,
                          fourLottoDeployer.address
                      )
                  ).to.emit(fourLottoDeployer, "DrawCompleted")
              })
          })

          describe("pauseFourLotto", function () {
              const playerOneBet = "0000"
              const playerTwoBet = "8157" // 2nd draw first place
              const playerThreeBet = "3932" // 2nd draw second place
              const playerFourBet = "7709" // 2nd draw third place
              const playerFiveBet = "5775" // 2nd consolation
              let startingTimeStamp,
                  startingPot,
                  deployerStartingBalance,
                  playerOneStartingBalance,
                  playerTwoStartingBalance,
                  playerThreeStartingBalance,
                  playerFourStartingBalance,
                  playerFiveStartingBalance

              beforeEach(async () => {
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await fourLottoDeployer.performUpkeep("0x")
                  const txReceipt = await txResponse.wait(1)
                  requestId = txReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      requestId,
                      fourLottoDeployer.address
                  )
                  startingTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  await fourLottoPlayerTwo.enterFourLotto(playerTwoBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerThree.enterFourLotto(playerThreeBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFour.enterFourLotto(playerFourBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoPlayerFive.enterFourLotto(playerFiveBet, {
                      value: fourLottoBetFee,
                  })
                  playerOneStartingBalance = await playerOne.getBalance()
                  playerTwoStartingBalance = await playerTwo.getBalance()
                  playerThreeStartingBalance = await playerThree.getBalance()
                  playerFourStartingBalance = await playerFour.getBalance()
                  playerFiveStartingBalance = await playerFive.getBalance()
                  startingPot = await fourLottoDeployer.provider.getBalance(
                      fourLottoDeployer.address
                  )
                  deployerStartingBalance = await deployer.getBalance()
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 10])
              })

              it("cannot be called if FourLotto is calculating", async () => {
                  await network.provider.send("evm_increaseTime", [20])
                  await network.provider.send("evm_mine", [])
                  await fourLottoDeployer.performUpkeep("0x")
                  await expect(fourLottoDeployer.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__FourLottoNotOpen"
                  )
              })

              it("cannot be called if FourLotto is already paused", async () => {
                  await fourLottoDeployer.pauseFourLotto()
                  await expect(fourLottoDeployer.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__FourLottoNotOpen"
                  )
              })

              it("can only be called if there is balance of FourLotto > 0", async () => {
                  await network.provider.send("evm_increaseTime", [20])
                  await network.provider.send("evm_mine", [])
                  const secondTxResponse = await fourLottoDeployer.performUpkeep("0x")
                  const secondTxReceipt = await secondTxResponse.wait(1)
                  secondRequestId = await secondTxReceipt.events[1].args.requestId
                  await vrfCoordinatorV2Mock.fulfillRandomWords(
                      secondRequestId,
                      fourLottoDeployer.address
                  )
                  await expect(fourLottoDeployer.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__NoPotAndThereforeNoNeedToCloseFourLotto"
                  )
              })

              it("can only be called by owner", async () => {
                  await expect(fourLottoPlayerOne.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerTwo.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerThree.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerFour.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerFive.pauseFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  const tx = await fourLottoDeployer.pauseFourLotto()
                  assert(tx)
              })

              it("refunds players for the current draw", async () => {
                  await fourLottoDeployer.pauseFourLotto()
                  const playerOneEndingBalance = await playerOne.getBalance()
                  const playerTwoEndingBalance = await playerTwo.getBalance()
                  const playerThreeEndingBalance = await playerThree.getBalance()
                  const playerFourEndingBalance = await playerFour.getBalance()
                  const playerFiveEndingBalance = await playerFive.getBalance()
                  assert.equal(
                      playerOneEndingBalance.toString(),
                      playerOneStartingBalance.toString()
                  )
                  assert.equal(
                      playerTwoEndingBalance.toString(),
                      playerTwoStartingBalance.add(fourLottoBetFee).toString()
                  )
                  assert.equal(
                      playerThreeEndingBalance.toString(),
                      playerThreeStartingBalance.add(fourLottoBetFee).toString()
                  )
                  assert.equal(
                      playerFourEndingBalance.toString(),
                      playerFourStartingBalance.add(fourLottoBetFee).toString()
                  )
                  assert.equal(
                      playerFiveEndingBalance.toString(),
                      playerFiveStartingBalance.add(fourLottoBetFee).toString()
                  )
              })

              it("extracts remaining pot to owner", async () => {
                  const currentPlayers = await fourLottoDeployer.getCurrentPlayers()
                  const pauseTxResponse = await fourLottoDeployer.pauseFourLotto()
                  const pauseTxReceipt = await pauseTxResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = pauseTxReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const potExtractedByOwner = startingPot.sub(
                      fourLottoBetFee.mul(currentPlayers.length)
                  )
                  const deployerEndingBalance = await deployer.getBalance()
                  assert.equal(
                      deployerEndingBalance.toString(),
                      deployerStartingBalance.add(potExtractedByOwner).sub(gasCost).toString()
                  )
              })

              it('should increase s_drawNumber by 1 to "reset" mappings', async () => {
                  const startingDrawNumber = await fourLottoDeployer.getCurrentDrawNumber()
                  await fourLottoDeployer.pauseFourLotto()
                  const endingDrawNumber = await fourLottoDeployer.getCurrentDrawNumber()
                  assert.equal(endingDrawNumber.toString(), startingDrawNumber.add(1).toString())
              })

              it("should update s_lastTimeStamp to time that FourLotto is paused", async () => {
                  await fourLottoDeployer.pauseFourLotto()
                  const endingTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  assert(endingTimeStamp - startingTimeStamp > interval.toNumber() - 10)
              })

              it("should set s_fourLottoState to paused", async () => {
                  await fourLottoDeployer.pauseFourLotto()
                  const fourLottoState = await fourLottoDeployer.getFourLottoState()
                  assert.equal(fourLottoState.toString(), "4")
              })

              it("should now have 0 remaining pot", async () => {
                  await fourLottoDeployer.pauseFourLotto()
                  assert.equal(
                      await fourLottoDeployer.provider.getBalance(fourLottoDeployer.address),
                      0
                  )
              })
          })

          describe("resumeFourLotto", function () {
              it("can only be called by owner", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoDeployer.pauseFourLotto()
                  await expect(fourLottoPlayerOne.resumeFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerTwo.resumeFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerThree.resumeFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerFour.resumeFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  await expect(fourLottoPlayerFive.resumeFourLotto()).to.be.revertedWith(
                      "FourLotto__OnlyOwnerCanCallThisFunction"
                  )
                  const tx = await fourLottoDeployer.resumeFourLotto()
                  assert(tx)
              })

              it("cannot be called when FourLotto is already open", async () => {
                  await expect(fourLottoDeployer.resumeFourLotto()).to.be.revertedWith(
                      "FourLotto__FourLottoAlreadyOperating"
                  )
              })

              it("sets FourLotto to open", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoDeployer.pauseFourLotto()
                  await fourLottoDeployer.resumeFourLotto()
                  const fourLottoStatus = await fourLottoDeployer.getFourLottoState()
                  assert.equal(fourLottoStatus.toString(), "0")
              })

              it("refreshes timestamp to current time that FourLotto is resumed", async () => {
                  const playerOneBet = "0000"
                  await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
                      value: fourLottoBetFee,
                  })
                  await fourLottoDeployer.pauseFourLotto()
                  const closeTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  await network.provider.send("evm_increaseTime", [interval.mul(5).toNumber()])
                  await network.provider.send("evm_mine", [])
                  await fourLottoDeployer.resumeFourLotto()
                  const reopenTimeStamp = await fourLottoDeployer.getLastTimeStamp()
                  assert(reopenTimeStamp - closeTimeStamp >= interval.mul(5))
              })
          })

          // hidden as removeHistoryOfAPastDraw currently consumes too much gas and is thus impractical
          //   describe("removeHistoryOfAPastDraw", function () {
          //       const playerOneBet = "0000"
          //       beforeEach(async () => {
          //           await fourLottoPlayerOne.enterFourLotto(playerOneBet, {
          //               value: fourLottoBetFee,
          //           })
          //           await network.provider.send("evm_increaseTime", [interval.toNumber() + 10])
          //           await network.provider.send("evm_mine", [])
          //           const txResponse = await fourLottoDeployer.performUpkeep("0x")
          //           const txReceipt = await txResponse.wait(1)
          //           requestId = txReceipt.events[1].args.requestId
          //           await vrfCoordinatorV2Mock.fulfillRandomWords(
          //               requestId,
          //               fourLottoDeployer.address
          //           )
          //       })

          //       it("can only be called by owner", async () => {
          //           await expect(fourLottoPlayerOne.removeHistoryOfAPastDraw(1)).to.be.revertedWith(
          //               "FourLotto__OnlyOwnerCanCallThisFunction"
          //           )
          //           await expect(fourLottoPlayerTwo.removeHistoryOfAPastDraw(1)).to.be.revertedWith(
          //               "FourLotto__OnlyOwnerCanCallThisFunction"
          //           )
          //           await expect(fourLottoPlayerThree.removeHistoryOfAPastDraw(1)).to.be.revertedWith(
          //               "FourLotto__OnlyOwnerCanCallThisFunction"
          //           )
          //           await expect(fourLottoPlayerFour.removeHistoryOfAPastDraw(1)).to.be.revertedWith(
          //               "FourLotto__OnlyOwnerCanCallThisFunction"
          //           )
          //           await expect(fourLottoPlayerFive.removeHistoryOfAPastDraw(1)).to.be.revertedWith(
          //               "FourLotto__OnlyOwnerCanCallThisFunction"
          //           )
          //           const tx = await fourLottoDeployer.removeHistoryOfAPastDraw(1)
          //           assert(tx)
          //       })

          //       it("cannot delete players and bets for current draw or a draw that does not exist", async () => {
          //           await expect(fourLottoDeployer.removeHistoryOfAPastDraw(3)).to.be.revertedWith(
          //               "FourLotto__UnableToRemoveHistory"
          //           )
          //           await expect(fourLottoDeployer.removeHistoryOfAPastDraw(2)).to.be.revertedWith(
          //               "FourLotto__UnableToRemoveHistory"
          //           )
          //           await expect(fourLottoDeployer.removeHistoryOfAPastDraw(0)).to.be.revertedWith(
          //               "FourLotto__DrawDidNotOccur"
          //           )
          //           await expect(fourLottoDeployer.removeHistoryOfAPastDraw(-1)).to.be.reverted
          //       })

          //       it("clears history of bets placed during a particular draw", async () => {
          //           const pastBetsBefore = await fourLottoDeployer.getPastBets(1)
          //           const pastPlayerOneBetDetailsBefore = await fourLottoDeployer.getPastBetDetails(
          //               1,
          //               playerOneBet
          //           )
          //           await fourLottoDeployer.removeHistoryOfAPastDraw(1)
          //           const pastPlayerOneBetDetailsAfter = await fourLottoDeployer.getPastBetDetails(
          //               1,
          //               playerOneBet
          //           )
          //           const pastBetsAfter = await fourLottoDeployer.getPastBets(1)

          //           assert.equal(
          //               pastPlayerOneBetDetailsBefore.isValid == true,
          //               pastPlayerOneBetDetailsBefore.bet == playerOneBet,
          //               pastPlayerOneBetDetailsBefore.playerAddress == playerOne.address
          //           )
          //           assert.equal(
          //               pastPlayerOneBetDetailsAfter.isValid == false,
          //               pastPlayerOneBetDetailsAfter.bet == "",
          //               pastPlayerOneBetDetailsAfter.playerAddress == ethers.constants.AddressZero
          //           )
          //           expect(pastBetsBefore).to.not.be.empty
          //           expect(pastBetsAfter).to.be.empty
          //       })

          //       it("clears history of players who placed bets during a particular draw", async () => {
          //           const pastPlayerOnePlayerDetailsBefore =
          //               await fourLottoDeployer.getPastPlayerDetails(1, playerOne.address)
          //           const pastPlayersBefore = await fourLottoDeployer.getPastPlayers(1)
          //           await fourLottoDeployer.removeHistoryOfAPastDraw(1)
          //           const pastPlayerOnePlayerDetailsAfter =
          //               await fourLottoDeployer.getPastPlayerDetails(1, playerOne.address)
          //           const pastPlayersAfter = await fourLottoDeployer.getPastPlayers(1)
          //           assert.equal(
          //               pastPlayerOnePlayerDetailsBefore.isValid == true,
          //               pastPlayerOnePlayerDetailsBefore.bet == playerOneBet,
          //               pastPlayerOnePlayerDetailsBefore.playerAddress == playerOne.address
          //           )
          //           assert.equal(
          //               pastPlayerOnePlayerDetailsAfter.isValid == false,
          //               pastPlayerOnePlayerDetailsAfter.bet == "",
          //               pastPlayerOnePlayerDetailsAfter.playerAddress == ethers.constants.AddressZero
          //           )
          //           expect(pastPlayersBefore).to.not.be.empty
          //           expect(pastPlayersAfter).to.be.empty
          //       })
          //   })

          describe("rest of getter functions not tested above", function () {
              it("should get the correct number of requests confirmations", async () => {
                  const requestConfirmations = await fourLottoDeployer.getRequestConfirmations()
                  assert.equal(requestConfirmations.toString(), "5")
              })

              it("should get the correct number of verifiably random numbers requested from Chainlink VRF", async () => {
                  const numberOfWords = await fourLottoDeployer.getNumWords()
                  assert.equal(numberOfWords.toString(), "41")
              })

              it("should get the correct history of winning numbers", async () => {
                  const winningNumbersOrderArray =
                      await fourLottoDeployer.getWinningNumbersOrderArray()
                  const winningNumbersOrder = [
                      [1, 2, 3, 4],
                      [1, 2, 4, 3],
                      [1, 3, 2, 4],
                      [1, 3, 4, 2],
                      [1, 4, 2, 3],
                      [1, 4, 3, 2],
                      [2, 1, 3, 4],
                      [2, 1, 4, 3],
                      [2, 3, 1, 4],
                      [2, 3, 4, 1],
                      [2, 4, 1, 3],
                      [2, 4, 3, 1],
                      [3, 1, 2, 4],
                      [3, 1, 4, 2],
                      [3, 2, 1, 4],
                      [3, 2, 4, 1],
                      [3, 4, 1, 2],
                      [3, 4, 2, 1],
                      [4, 1, 2, 3],
                      [4, 1, 3, 2],
                      [4, 2, 1, 3],
                      [4, 2, 3, 1],
                      [4, 3, 1, 2],
                      [4, 3, 2, 1],
                  ]
                  assert.equal(winningNumbersOrderArray.toString(), winningNumbersOrder.toString())
              })
          })

          // test staging test in unit tests to ensure that the staging test works as intended before performing staging test
          describe("FourLotto staging tests", function () {
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
                          console.log(
                              "    setting up listener, listening for DrawCompleted event..."
                          )
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
                                  let firstPlaceTax,
                                      secondPlaceTax,
                                      thirdPlaceTax,
                                      consolationPlaceTax
                                  if (recentFirstPlaceWinner.length > 0) {
                                      firstPlaceTax = currentPot.mul(40).mul(5).div(100).div(100)
                                      console.log(`      - first place: ${recentFirstPlaceWinner}`)
                                  } else {
                                      console.log(`      - first place: no winner`)
                                  }
                                  if (recentSecondPlaceWinners.length > 0) {
                                      secondPlaceTax = currentPot.mul(30).mul(5).div(100).div(100)
                                      console.log(
                                          `      - second place: ${recentSecondPlaceWinners}`
                                      )
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
                                      consolationPlaceTax = currentPot
                                          .mul(10)
                                          .mul(5)
                                          .div(100)
                                          .div(100)
                                      console.log(
                                          `      - consolation: ${recentConsolationWinners}`
                                      )
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
                                      const betDetails =
                                          await fourLottoDeployer.getCurrentBetDetails(
                                              playerBetArray[i]
                                          )
                                      const playerDetails =
                                          await fourLottoDeployer.getCurrentPlayerDetails(
                                              playerAddressArray[i]
                                          )
                                      assert.equal(
                                          playerDetails.isValid == false,
                                          playerDetails.bet == "",
                                          playerDetails.playerAddress ==
                                              ethers.constants.AddressZero
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
                                          .sub(performGasCost)
                                          .sub(fulfillGasCost)
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

                          // call performUpkeep
                          await network.provider.send("evm_increaseTime", [
                              interval.toNumber() + 10,
                          ])
                          await network.provider.send("evm_mine", [])
                          console.log("    performUpkeep manually called...")
                          const performTxResponse = await fourLottoDeployer.performUpkeep("0x")
                          const performTxReceipt = await performTxResponse.wait(1)
                          let performGasCost
                          {
                              const { gasUsed, effectiveGasPrice } = performTxReceipt
                              performGasCost = gasUsed.mul(effectiveGasPrice)
                          }
                          const requestId = performTxReceipt.events[1].args.requestId
                          console.log("    fulfillRandomWords manually called...")
                          const fulfillTxResponse = await vrfCoordinatorV2Mock.fulfillRandomWords(
                              requestId,
                              fourLottoDeployer.address
                          )
                          const fulfillTxReceipt = await fulfillTxResponse.wait(1)
                          let fulfillGasCost
                          {
                              const { gasUsed, effectiveGasPrice } = fulfillTxReceipt
                              fulfillGasCost = gasUsed.mul(effectiveGasPrice)
                          }
                      })
                  })
              })
          })
      })
