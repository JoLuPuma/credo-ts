import type {
  DidCommConnectionRecord,
  DidCommCredentialExchangeRecord,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'

import { BaseAgent } from './BaseAgent'
import { DidCommMediatorPickupStrategy } from '@credo-ts/didcomm'
import { greenText, Output, redText } from './OutputClass'

export class Alex extends BaseAgent {
  public connected: boolean
  public connectionRecordFaberId?: string
  public mediatorConnected: boolean

  public constructor(port: number, name: string) {
    super({ port, name, endpoints: [], inboundTransports: [] })
    this.connected = false
    this.mediatorConnected = false
  }

  public static async build(): Promise<Alex> {
    const alex = new Alex(0, 'alex')
    await alex.initializeAgent()
    return alex
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordFaberId) {
      throw Error(redText(Output.MissingConnectionRecord))
    }
    return await this.agent.didcomm.connections.getById(this.connectionRecordFaberId)
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.didcomm.oob.receiveInvitationFromUrl(invitationUrl, {
      label: 'alex',
    })
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand))
    }
    return connectionRecord
  }

  private async waitForConnection(connectionRecord: DidCommConnectionRecord) {
    const record = await this.agent.didcomm.connections.returnWhenIsConnected(connectionRecord.id)
    this.connected = true
    console.log(greenText(Output.ConnectionEstablished))
    return record.id
  }

  public async acceptConnection(invitationUrl: string) {
    const connectionRecord = await this.receiveConnectionRequest(invitationUrl)
    this.connectionRecordFaberId = await this.waitForConnection(connectionRecord)
  }

  public async addMediator(mediatorInvitationUrl: string) {
    try {
      const { connectionRecord } = await this.agent.didcomm.oob.receiveInvitationFromUrl(mediatorInvitationUrl, {
        label: 'alex-mediator',
      })
      if (!connectionRecord) {
        throw new Error(redText('No connectionRecord has been created from mediator invitation'))
      }

      const mediatorConnection = await this.agent.didcomm.connections.returnWhenIsConnected(connectionRecord.id)

      await this.agent.didcomm.mediationRecipient.provision(mediatorConnection)
      await this.agent.didcomm.mediationRecipient.initiateMessagePickup(
        undefined,
        DidCommMediatorPickupStrategy.PickUpV2
      )

      this.mediatorConnected = true
      console.log(
        greenText('\nMediator connection established, set as default, and upgraded to WebSocket implicit pickup!\n')
      )
    } catch (error) {
      console.error(redText(`\nFailed to add mediator: ${error}\n`))
      throw error
    }
  }

  public async acceptCredentialOffer(credentialExchangeRecord: DidCommCredentialExchangeRecord) {
    await this.agent.didcomm.credentials.acceptOffer({
      credentialExchangeRecordId: credentialExchangeRecord.id,
    })
  }

  public async acceptProofRequest(proofExchangeRecord: DidCommProofExchangeRecord) {
    const requestedCredentials = await this.agent.didcomm.proofs.selectCredentialsForRequest({
      proofExchangeRecordId: proofExchangeRecord.id,
    })

    await this.agent.didcomm.proofs.acceptRequest({
      proofExchangeRecordId: proofExchangeRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    })
    console.log(greenText('\nProof request accepted!\n'))
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord()
    await this.agent.didcomm.basicMessages.sendMessage(connectionRecord.id, message)
  }

  public async exit() {
    console.log(Output.Exit)
    await this.agent.shutdown()
    process.exit(0)
  }

  public async restart() {
    await this.agent.shutdown()
  }
}
