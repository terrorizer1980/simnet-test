import { utils, constants, providers, BigNumber, Wallet} from "ethers";
import {getRandomBytes32, RestServerNodeService} from "@connext/vector-utils";
import {config} from "dotenv";
import {resolve} from "path";

import pino from 'pino';
import {DEFAULT_CHANNEL_TIMEOUT, TransferNames} from "@connext/vector-types";
const logger = pino({ level: "debug" });

const env = config({path:resolve("./docker/.env")})

//carol config
const carolPort = "8001"
const carolMnemonic = process.env.MNEMONIC_1 || undefined
const carolWallet = Wallet.fromMnemonic(carolMnemonic!)

const davePort = "8002"
const daveMnemonic = process.env.MNEMONIC_2 || undefined
const daveWallet = Wallet.fromMnemonic(daveMnemonic!)

const nodeUrlBase = "http://localhost:"
const routerPublicIdentifier = "vector5ZCDdvFNyC8fB1uV1iontd4uj8kyrZqWNfifXXLviCfGLaD9Sr"

const g_provider = new providers.JsonRpcProvider(
    "https://goerli.infura.io/v3/af2f28bdb95d40edb06226a46106f5f9"
);
const r_provider = new providers.JsonRpcProvider(
    "https://rinkeby.infura.io/v3/af2f28bdb95d40edb06226a46106f5f9"
);

const hasBalance = async function(chainId:number, address:string, asset?:"ETH"){
    if(chainId === 4){
        const bal = await r_provider.getBalance(address)
        return bal;
    }else if(chainId === 5){
        const bal = await g_provider.getBalance(address)
        return bal;
    }
    return undefined;
}


async function main(){
    const chainId = 5;
    //check c bal

    const c_bal = await hasBalance(chainId, carolWallet.address)
    const d_bal = await hasBalance(chainId, daveWallet.address)
    if(!d_bal || !c_bal) {return }

    const testName = "simnet"

    const cService = await RestServerNodeService.connect(
        `${nodeUrlBase + carolPort}`,
        logger.child({ testName, name: "Carol" }),
        undefined,
        0
    );
    const dService = await RestServerNodeService.connect(
        `${nodeUrlBase + davePort}`,
        logger.child({ testName, name: "Dave" }),
        undefined,
        0

    )

    console.log(dService)

    // const cSetup = await cService.setup({
    //         counterpartyIdentifier: routerPublicIdentifier,
    //         chainId,
    //         timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
    //     })
    // console.log(cSetup)


    // const dSetup = await dService.setup({
    //         counterpartyIdentifier: routerPublicIdentifier,
    //         chainId:5,
    //         timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
    //     })
    // console.log(dSetup)


    // const restore = await cService.restoreState({publicIdentifier:cService.publicIdentifier, counterpartyIdentifier:routerPublicIdentifier, chainId:chainId})
    // console.log(restore)

    // const drestore = await dService.restoreState({publicIdentifier:dService.publicIdentifier, counterpartyIdentifier:routerPublicIdentifier, chainId:5})
    // console.log(drestore)


    const cChannelExists = await cService.getStateChannelByParticipants({publicIdentifier: cService.publicIdentifier, counterparty:routerPublicIdentifier, chainId:chainId})
    console.log(cChannelExists)
    //
    const dChannelExists = await dService.getStateChannelByParticipants({publicIdentifier: dService.publicIdentifier, counterparty:routerPublicIdentifier, chainId:chainId})
    console.log(dChannelExists)
    //
    const depositAmt = utils.parseEther(".1");
    const assetId = constants.AddressZero;

    //
    // const tx = await cService.sendDepositTx({
    //     amount: depositAmt.toString(),
    //     assetId,
    //     chainId: 5,
    //     channelAddress:  await restore.getValue().channelAddress,
    //     publicIdentifier: cService.publicIdentifier,
    // })


    //******
    // const tx = await dService.sendDepositTx({
    //     amount: depositAmt.toString(),
    //     assetId,
    //     chainId: 5,
    //     channelAddress:  await drestore.getValue()?.channelAddress,
    //     publicIdentifier: dService.publicIdentifier,
    // })
    //
    // console.log(tx)

    const preImage = getRandomBytes32();
    const lockHash = utils.soliditySha256(["bytes32"], [preImage]);

    const taransferAmt = utils.parseEther(".05");

    const transferRes = await cService.conditionalTransfer({
        amount: taransferAmt.toString(),
        assetId: assetId,
        channelAddress: await cChannelExists.getValue()?.channelAddress || "",
        type: TransferNames.HashlockTransfer,
        details: {
            lockHash,
            expiry: "0",
        },
        recipient: dService.publicIdentifier,
        recipientChainId: 5
    })

    console.log(transferRes)





    // const dChannelExists = await dService.getStateChannelByParticipants({publicIdentifier: dService.publicIdentifier, counterparty:routerPublicIdentifier, chainId:chainId})
    // let cSetup;
    // let dSetup
    //
    // //this can get the channel above cant hmm
    // // const chanbyaddy = await cService.getStateChannel({channelAddress:"0xeae9aF6363Fa5a199ff516F5527834F7670f56ca"})
    //
    // //these return "Node not found"
    // console.log(JSON.stringify(dChannelExists),JSON.stringify(cChannelExists))
    //
    //
    // if(!cChannelExists.getError()){
    //     //create chan.
    //     cSetup = await cService.setup({
    //         counterpartyIdentifier: routerPublicIdentifier,
    //         chainId,
    //         timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
    //     })
    // }else if(!dChannelExists.getError()){
    //     dSetup = await cService.setup({
    //         counterpartyIdentifier: routerPublicIdentifier,
    //         chainId,
    //         timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
    //     })
    //
    // }
    //

}
main()