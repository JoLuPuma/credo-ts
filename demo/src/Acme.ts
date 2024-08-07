import { AskarModule } from "@credo-ts/askar"
import { Agent, ConsoleLogger, HttpOutboundTransport, InitConfig, LogLevel, MediationRecipientModule, MediatorPickupStrategy, WsOutboundTransport } from "@credo-ts/core"
import { agentDependencies } from "@credo-ts/node"
import { ariesAskar } from "@hyperledger/aries-askar-nodejs"

export class Acme{
public agent
public constructor(mediatorInvitationUrl: string, name: string ) {
const agentConfig: InitConfig = {
  label: `Credo ${name}`,
  walletConfig: {
    id: name,
    key: name,
  },endpoints:['didcomm:transport/queue'],
  logger: new ConsoleLogger(LogLevel.debug),
  autoUpdateStorageOnStartup: true,
}

this.agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  modules: {
    mediationRecipient: new MediationRecipientModule({
      mediatorInvitationUrl:mediatorInvitationUrl,mediatorPickupStrategy: MediatorPickupStrategy.Implicit,
    }),
    askar: new AskarModule({ ariesAskar }),
  },
})

this.agent.registerOutboundTransport(new HttpOutboundTransport())
this.agent.registerOutboundTransport(new WsOutboundTransport())
}

public async initializeAgent() {
  await this.agent.initialize()

}

}