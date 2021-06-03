import { utils, constants, providers, BigNumber, Wallet} from "ethers";
import {RestServerNodeService} from "@connext/vector-utils";
import {config} from "dotenv";
import {resolve} from "path";

import pino from 'pino';
import {DEFAULT_CHANNEL_TIMEOUT} from "@connext/vector-types";
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
        1
    );
    const dService = await RestServerNodeService.connect(
        `${nodeUrlBase + davePort}`,
        logger.child({ testName, name: "Dave" }),
        undefined,
        1

    )

    console.log(cService,dService)

    const cChannelExists = await cService.getStateChannelByParticipants({publicIdentifier: routerPublicIdentifier, counterparty:cService.publicIdentifier, chainId:chainId})
    const dChannelExists = await dService.getStateChannelByParticipants({publicIdentifier: routerPublicIdentifier, counterparty:dService.publicIdentifier, chainId:chainId})

    let cSetup;
    let dSetup

    //this can get the channel above cant hmm
    // const chanbyaddy = await cService.getStateChannel({channelAddress:"0xeae9aF6363Fa5a199ff516F5527834F7670f56ca"})

    //these return "Node not found"
    console.log(dChannelExists,cChannelExists)


    if(!cChannelExists.getError()){
        //create chan.
        cSetup = await cService.setup({
            counterpartyIdentifier: routerPublicIdentifier,
            chainId,
            timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
        })
    }else if(!dChannelExists.getError()){
        dSetup = await cService.setup({
            counterpartyIdentifier: routerPublicIdentifier,
            chainId,
            timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
        })

    }


}
main()