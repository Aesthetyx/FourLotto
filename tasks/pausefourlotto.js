const { task } = require("hardhat/config")

task("pausefourlotto", "pauses FourLotto").setAction(async (taskArgs) => {
    const ethers = hre.ethers
    const network = hre.network
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]
    const fourLottoDeployer = await ethers.getContract("FourLotto", deployer)

    if (network.name == "hardhat") {
        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(
            "hardhat network detected, please refer to information provided after deployment and work on other networks to interact with FourLotto"
        )
        console.log(" ")
        console.log("terminated pausefourlotto task")
        console.log(
            "=================================================================================================="
        )
        console.log(" ")
    } else {
        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(`${network.name} network detected, attempting to pause FourLotto...`)
        console.log(" ")
        const fourLottoState = await fourLottoDeployer.getFourLottoState()
        const fourLottoBalance = await fourLottoDeployer.getFourLottoBalance()
        if (fourLottoState.toString() == "0" && fourLottoBalance > 0) {
            await fourLottoDeployer.pauseFourLotto()
            const lastTimeStamp = await fourLottoDeployer.getLastTimeStamp()
            const currentTime = new Date(lastTimeStamp.mul(1000).toNumber())
            console.log(`FourLotto paused on ${currentTime}`)
            console.log(" ")
            console.log("please resume FourLotto to start receiving bets again")
            console.log(" ")
            console.log("pausefourlotto task successfully executed")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        } else {
            console.log("unable to pause FourLotto, likely due to reasons listed below:")
            if (fourLottoState.toString() != "0") {
                console.log(
                    "    - FourLotto is not currently open (e.g., calculating, paying, pausing, closed) and thus unable to pause FourLotto"
                )
            }
            if (fourLottoBalance == 0) {
                console.log(
                    "    - FourLotto currently has a balance of 0 ETH and thus unable/no need to pause FourLotto"
                )
            }
            console.log(" ")
            console.log("terminated pausefourlotto task")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        }
    }
})
