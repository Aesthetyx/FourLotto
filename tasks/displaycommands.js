const { task } = require("hardhat/config")

task("displaycommands", "displays the available commands to interact with FourLotto").setAction(
    async (taskArgs) => {
        console.log(" ")
        console.log(
            "=================================================================================================="
        )
        console.log(
            "to test interactions with FourLotto, please use the localhost network and not the hardhat network"
        )
        console.log(" ")
        console.log("=================")
        console.log("localhost network")
        console.log("=================")
        console.log(
            "to test interactions with FourLotto, please deploy to localhost network using the following commands:"
        )
        console.log("    - to start a localhost node: `hh node`")
        console.log(
            "    - to deploy FourLotto (if FourLotto has not already been deployed): `hh deploy --network localhost`"
        )
        console.log(" ")
        console.log("once the above is completed, use the following commands:")
        console.log("    - to display available commands: `hh displaycommands`")
        console.log(
            "    - to check availability of a four digit numberL `hh checkavailability YYYY --network localhost`"
        )
        console.log("      where,")
        console.log("          YYYY = the four digit number to check availability for")
        console.log(
            "    - to place a bet on FourLotto: `hh enterfourlotto X YYYY --network localhost`"
        )
        console.log("      where,")
        console.log(
            "          X = the index position of the account contained in the hardhat.config.js file for the desired network"
        )
        console.log("          YYYY = the four digit number to place bet on")
        console.log(
            "          (note that each address can only enter FourLotto once and only one bet can be placed on a particular four digit number)"
        )
        console.log(
            "    - to get information on the current draw: `hh getinfo --network localhost`"
        )
        console.log("    - to mock draw on localhost network: `hh mockdraw --network localhost`")
        console.log(
            "    - performupkeep task is only meant for interacting with FourLotto on testnet / mainnet and will not work for localhost network"
        )
        console.log(
            "    - to pause FourLotto (only by deployer): `hh pausefourlotto --network localhost`"
        )
        console.log(
            "    - to resume FourLotto (only by deployer): `hh resumefourlotto --network localhost`"
        )
        console.log(" ")
        console.log("=================")
        console.log("testnet / mainnet")
        console.log("=================")
        console.log(
            "to interact with FourLotto on testnet / mainnet, please use the following commands (replace ??? with the desired testnet / mainnet):"
        )
        console.log("    - to display available commands: `hh displaycommands`")
        console.log(
            "    - to check availability of a four digit numberL `hh checkavailability YYYY --network ???`"
        )
        console.log("      where,")
        console.log("          YYYY = the four digit number to check availability for")
        console.log("    - to place a bet on FourLotto: `hh enterfourlotto X YYYY --network ???`")
        console.log("      where,")
        console.log(
            "          X = the index position of the account contained in the hardhat.config.js file for the desired network"
        )
        console.log("          YYYY = the four digit number to place bet on")
        console.log(
            "          (note that each address can only enter FourLotto once and only one bet can be placed on a particular four digit number)"
        )
        console.log("    - to get information on the current draw: `hh getinfo --network ???`")
        console.log(
            "    - mockdraw task is only meant for interacting with FourLotto on localhost network and will not work for testnet / mainnet"
        )
        console.log("    - to call performupkeep manually: `hh performupkeep --network ???`")
        console.log(
            "    - to pause FourLotto (only by deployer): `hh pausefourlotto --network ???`"
        )
        console.log(
            "    - to resume FourLotto (only by deployer): `hh resumefourlotto --network ???`"
        )
        console.log(
            "=================================================================================================="
        )
        console.log(" ")
    }
)

module.exports = {}
