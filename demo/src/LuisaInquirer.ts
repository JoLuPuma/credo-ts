import type { DidCommCredentialExchangeRecord, DidCommProofExchangeRecord } from '@credo-ts/didcomm'

import { clear } from 'console'
import figlet from 'figlet'
import { prompt } from 'inquirer'

import { Luisa } from './Luisa'
import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runLuisa = async () => {
  clear()
  console.log(figlet.textSync('Luisa', { horizontalLayout: 'full' }))
  const luisa = await LuisaInquirer.build()
  await luisa.processAnswer()
}

enum PromptOptions {
  ReceiveConnectionUrl = 'Receive connection invitation',
  AddMediator = 'Add a mediator',
  SendMessage = 'Send message',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class LuisaInquirer extends BaseInquirer {
  public luisa: Luisa
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(luisa: Luisa) {
    super()
    this.luisa = luisa
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.luisa.agent, this.luisa.name)
  }

  public static async build(): Promise<LuisaInquirer> {
    const luisa = await Luisa.build()
    return new LuisaInquirer(luisa)
  }

  private async getPromptChoice() {
    if (this.luisa.connectionRecordFaberId) return prompt([this.inquireOptions(this.promptOptionsString)])

    const reducedOption = [PromptOptions.ReceiveConnectionUrl, PromptOptions.AddMediator, PromptOptions.Exit, PromptOptions.Restart]
    return prompt([this.inquireOptions(reducedOption)])
  }

  public async processAnswer() {
    const choice = await this.getPromptChoice()
    if (this.listener.on) return

    switch (choice.options) {
      case PromptOptions.ReceiveConnectionUrl:
        await this.connection()
        break
      case PromptOptions.AddMediator:
        await this.mediator()
        break
      case PromptOptions.SendMessage:
        await this.message()
        break
      case PromptOptions.Exit:
        await this.exit()
        break
      case PromptOptions.Restart:
        await this.restart()
        return
    }
    await this.processAnswer()
  }

  public async acceptCredentialOffer(credentialExchangeRecord: DidCommCredentialExchangeRecord) {
    const confirm = await prompt([this.inquireConfirmation(Title.CredentialOfferTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.luisa.agent.didcomm.credentials.declineOffer({
        credentialExchangeRecordId: credentialExchangeRecord.id,
      })
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.luisa.acceptCredentialOffer(credentialExchangeRecord)
    }
  }

  public async acceptProofRequest(proofExchangeRecord: DidCommProofExchangeRecord) {
    const confirm = await prompt([this.inquireConfirmation(Title.ProofRequestTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.luisa.agent.didcomm.proofs.declineRequest({ proofExchangeRecordId: proofExchangeRecord.id })
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.luisa.acceptProofRequest(proofExchangeRecord)
    }
  }

  public async connection() {
    const title = Title.InvitationTitle
    const getUrl = await prompt([this.inquireInput(title)])
    await this.luisa.acceptConnection(getUrl.input)
    if (!this.luisa.connected) return

    this.listener.credentialOfferListener(this.luisa, this)
    this.listener.proofRequestListener(this.luisa, this)
  }

  public async mediator() {
    const title = '\n\nPaste the mediator invitation url here:'
    const getUrl = await prompt([this.inquireInput(title)])
    try {
      await this.luisa.addMediator(getUrl.input)
    } catch (error) {
      console.error('\nFailed to add mediator. Please try again.\n')
    }
  }

  public async message() {
    const message = await this.inquireMessage()
    if (!message) return

    await this.luisa.sendMessage(message)
  }

  public async exit() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    }
    if (confirm.options === ConfirmOptions.Yes) {
      await this.luisa.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    }
    if (confirm.options === ConfirmOptions.Yes) {
      await this.luisa.restart()
      await runLuisa()
    }
  }
}

void runLuisa()
