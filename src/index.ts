import { utils, constants, providers, BigNumber, Wallet} from "ethers";
import {getRandomBytes32, RestServerNodeService} from "@connext/vector-utils";
import {config} from "dotenv";
import {resolve} from "path";
import {daveEvts,carolEvts} from "./eventSetup";

import pino from 'pino';
import {DEFAULT_CHANNEL_TIMEOUT, EngineEvents, TransferNames} from "@connext/vector-types";
const logger = pino({ level: "debug" });

const env = config({path:resolve("./docker/.env")})

//carol config
const carolPort = "8069"
const carolMnemonic = process.env.MNEMONIC_1 || undefined
const carolWallet = Wallet.fromMnemonic(carolMnemonic!)

const davePort = "8070"
const daveMnemonic = process.env.MNEMONIC_2 || undefined
const daveWallet = Wallet.fromMnemonic(daveMnemonic!)


const r1Port = "8001"
const r2Port = "8002"

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

const testName = "simnet"
const chainId = 5;

async function connectSANodes(){

    const cService = await RestServerNodeService.connect(
        `${nodeUrlBase + carolPort}`,
        logger.child({ testName, name: "Carol" }),
        daveEvts,
        0
    );
    const dService = await RestServerNodeService.connect(
        `${'http://localhost:' + davePort}`,
        logger.child({ testName, name: "Dave" }),
        daveEvts,
        0
    )

    return([cService,dService]);
}

async function connectRouterNodes(){
    const r1Service = await RestServerNodeService.connect(
        `${nodeUrlBase + r1Port}`,
        logger.child({ testName, name: "Router 1:" }),
        undefined,
        0
    );
    const r2Service = await RestServerNodeService.connect(
        `${nodeUrlBase + r2Port}`,
        logger.child({ testName, name: "Router 2:" }),
        undefined,
        0
    );

    return([r1Service,r2Service])
}

async function setupSANodesToRouter(saNodes:RestServerNodeService[], routerPID:string){

    for (const node of saNodes) {
        //check channel between node[] and routerPID
        let channelExists = await node.getStateChannelByParticipants({publicIdentifier: node.publicIdentifier, counterparty:routerPID, chainId:chainId})
        if(channelExists?.isError === true){
            console.log(`Creating Channel`)
            const chanSetup = await node.setup({
                    counterpartyIdentifier: routerPID,
                    chainId,
                    timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
                })
            if(chanSetup.getError()?.message){
                console.log("Error creating channel")
            }else{
                console.log("Success creating channel")
            }
        }
        channelExists = await node.getStateChannelByParticipants({publicIdentifier: node.publicIdentifier, counterparty:routerPID, chainId:chainId})
        if(channelExists.getValue()){console.log(`Channel Exists Between ${node.publicIdentifier} and ${routerPID} \n at Channel Address: ${channelExists.getValue()?.channelAddress}`)}

    }
}
async function basicDeposit(serviceFrom:RestServerNodeService, channel:string| undefined){
    if(!channel){return}
    console.log("Depositing")
    const depositAmt = utils.parseEther(".1");
    const assetId = constants.AddressZero;

//why didnt this like my chainId at first defaulted to 4???
    const depositTx = await serviceFrom.sendDepositTx({
        amount: depositAmt.toString(),
        assetId,
        chainId: 5,
        channelAddress:  channel,
        publicIdentifier: serviceFrom.publicIdentifier,
    })
    console.log("Deposit TX Hash: ", depositTx)

}

async function main(){
    //check c bal
    const c_bal = await hasBalance(chainId, carolWallet.address)
    const d_bal = await hasBalance(chainId, daveWallet.address)
    if(!d_bal || !c_bal) {return }

    const [cService, dService] = await connectSANodes();
    const [r1Service, r2Service] = await connectRouterNodes();
    //setup channels
    await setupSANodesToRouter([cService,dService],r1Service.publicIdentifier)
    await setupSANodesToRouter([cService,dService],r2Service.publicIdentifier)

    const channel = await dService.getStateChannelByParticipants({publicIdentifier: dService.publicIdentifier, counterparty:r1Service.publicIdentifier, chainId:chainId})
    const taransferAmt = utils.parseEther(".005");
    const assetId = constants.AddressZero;
    //****** C & D have funds in chan with R1 on id 5

    // basicDeposit(cService,channel.getValue() || "");
    //await basicDeposit(dService,channel.getValue()?.channelAddress)

    // const reconcileDeposit = await dService.reconcileDeposit({
    //     assetId,
    //     channelAddress: channel.getValue()?.channelAddress || "",
    //     publicIdentifier: dService.publicIdentifier
    // })
    // console.log(`Reconcile Deposit`, reconcileDeposit)



    // const restore = await cService.restoreState({publicIdentifier:cService.publicIdentifier, counterpartyIdentifier:routerPublicIdentifier, chainId:chainId})
    // console.log(restore)

    // const drestore = await dService.restoreState({publicIdentifier:dService.publicIdentifier, counterpartyIdentifier:routerPublicIdentifier, chainId:5})
    // console.log(drestore)


    //register CService Listener for dave's transfer
    const preImage = getRandomBytes32();
    const lockHash = utils.soliditySha256(["bytes32"], [preImage]);
    //

    const chanAddress = channel.getValue()?.channelAddress || ""

    let routedSuccessfully:string[] = [];

    //register created transfer for dave
    dService.on(
        EngineEvents.CONDITIONAL_TRANSFER_CREATED,
        (data) => {
            console.log(`See Contitional Transfer ${JSON.stringify(data)}`)
            routedSuccessfully.push(data.transfer.meta.routingId);
        },
        undefined,
        dService.publicIdentifier,
    );
    //
    let cancelled:string[] = [];

    cService.on(
        EngineEvents.CONDITIONAL_TRANSFER_CREATED,
        (data) => {
            console.log(`See Car Contitional Transfer ${JSON.stringify(data)}`)
            cancelled.push(data.transfer.meta.routingId);
        },
        undefined,
        cService.publicIdentifier,
    );

    //store routing id => preImage string.
    //actually do transfer
    const transferRes = await dService.conditionalTransfer({
        amount: taransferAmt.toString(),
        assetId: assetId,
        channelAddress: chanAddress,
        type: TransferNames.HashlockTransfer,
        details: {
            lockHash,
            expiry: "0",
        },
        recipient: cService.publicIdentifier,
        recipientChainId: 4
    })

    const transferId = transferRes.getValue()?.transferId
    console.log(transferRes)
    //
    // const resolveRes = await cService.resolveTransfer({
    //     publicIdentifier: cService.publicIdentifier,
    //     channelAddress: chanAddress,
    //     transferResolver: { preImage },
    //     transferId,
    // });
    // console.log(resolveRes)
    console.log(transferRes);
    console.log(routedSuccessfully)
    console.log(cancelled)
    ////////






    //
    //
    //
    //
    //
    // // const dChannelExists = await dService.getStateChannelByParticipants({publicIdentifier: dService.publicIdentifier, counterparty:routerPublicIdentifier, chainId:chainId})
    // // let cSetup;
    // // let dSetup
    // //
    // // //this can get the channel above cant hmm
    // // // const chanbyaddy = await cService.getStateChannel({channelAddress:"0xeae9aF6363Fa5a199ff516F5527834F7670f56ca"})
    // //
    // // //these return "Node not found"
    // // console.log(JSON.stringify(dChannelExists),JSON.stringify(cChannelExists))
    // //
    // //
    // // if(!cChannelExists.getError()){
    // //     //create chan.
    // //     cSetup = await cService.setup({
    // //         counterpartyIdentifier: routerPublicIdentifier,
    // //         chainId,
    // //         timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
    // //     })
    // // }else if(!dChannelExists.getError()){
    // //     dSetup = await cService.setup({
    // //         counterpartyIdentifier: routerPublicIdentifier,
    // //         chainId,
    // //         timeout: DEFAULT_CHANNEL_TIMEOUT.toString(),
    // //     })
    // //
    // // }
    // //

}
main()