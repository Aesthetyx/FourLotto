const { task } = require("hardhat/config")

task("resumefourlotto", "resumes FourLotto").setAction(async (taskArgs) => {
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
        console.log("terminated resumefourlotto task")
        console.log(
            "=================================================================================================="
        )
        console.log(" ")
    } else {
        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(`${network.name} network detected, attempting to resume FourLotto...`)
        console.log(" ")
        const fourLottoState = await fourLottoDeployer.getFourLottoState()
        if (fourLottoState.toString() == "4") {
            await fourLottoDeployer.resumeFourLotto()
            const lastTimeStamp = await fourLottoDeployer.getLastTimeStamp()
            const currentTime = new Date(lastTimeStamp.mul(1000).toNumber())
            console.log(`FourLotto resumed on ${currentTime}`)
            console.log(" ")
            console.log("FourLotto has started to receive bets again")
            console.log(" ")
            console.log("resumefourlotto task successfully executed")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        } else {
            console.log("unable to resume FourLotto, likely because it is already operating")
            console.log(" ")
            console.log("terminated resumefourlotto task")
            console.log(
                "=================================================================================================="
            )
            console.log(" ")
        }
    }
})
