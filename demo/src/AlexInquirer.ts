import type { DidCommCredentialExchangeRecord, DidCommProofExchangeRecord } from '@credo-ts/didcomm'
import { clear } from 'console'
import figlet from 'figlet'
import { prompt } from 'inquirer'

import { Alex } from './Alex'
import { BaseInquirer, ConfirmOptions } from './BaseInquirer'
import { Listener } from './Listener'
import { Title } from './OutputClass'

export const runAlex = async () => {
  clear()
  console.log(figlet.textSync('Alex', { horizontalLayout: 'full' }))
  const alex = await AlexInquirer.build()
  await alex.processAnswer()
}

enum PromptOptions {
  ReceiveConnectionUrl = 'Receive connection invitation',
  AddMediator = 'Add a mediator',
  SendMessage = 'Send message',
  Exit = 'Exit',
  Restart = 'Restart',
}

export class AlexInquirer extends BaseInquirer {
  public alex: Alex
  public promptOptionsString: string[]
  public listener: Listener

  public constructor(alex: Alex) {
    super()
    this.alex = alex
    this.listener = new Listener()
    this.promptOptionsString = Object.values(PromptOptions)
    this.listener.messageListener(this.alex.agent, this.alex.name)
  }

  public static async build(): Promise<AlexInquirer> {
    const alex = await Alex.build()
    return new AlexInquirer(alex)
  }

  private async getPromptChoice() {
    if (this.alex.connectionRecordFaberId) return prompt([this.inquireOptions(this.promptOptionsString)])

    const reducedOption = [PromptOptions.AddMediator, PromptOptions.ReceiveConnectionUrl, PromptOptions.Exit, PromptOptions.Restart]
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
      await this.alex.agent.didcomm.credentials.declineOffer({
        credentialExchangeRecordId: credentialExchangeRecord.id,
      })
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.alex.acceptCredentialOffer(credentialExchangeRecord)
    }
  }

  public async acceptProofRequest(proofExchangeRecord: DidCommProofExchangeRecord) {
    const confirm = await prompt([this.inquireConfirmation(Title.ProofRequestTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.alex.agent.didcomm.proofs.declineRequest({ proofExchangeRecordId: proofExchangeRecord.id })
    } else if (confirm.options === ConfirmOptions.Yes) {
      await this.alex.acceptProofRequest(proofExchangeRecord)
    }
  }

  public async connection() {
    const title = Title.InvitationTitle
    const getUrl = await prompt([this.inquireInput(title)])
    await this.alex.acceptConnection(getUrl.input)
    if (!this.alex.connected) return

    this.listener.credentialOfferListener(this.alex, this)
    this.listener.proofRequestListener(this.alex, this)
  }

  public async mediator() {
    const title = '\n\nPaste the mediator invitation url here:'
    const getUrl = await prompt([this.inquireInput(title)])
    try {
      await this.alex.addMediator(getUrl.input)
    } catch (error) {
      console.error('\nFailed to add mediator. Please try again.\n')
    }
  }

  public async message() {
    const message = await this.inquireMessage()
    if (!message) return

    await this.alex.sendMessage(message)
  }

  public async exit() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      return
    }
    if (confirm.options === ConfirmOptions.Yes) {
      await this.alex.exit()
    }
  }

  public async restart() {
    const confirm = await prompt([this.inquireConfirmation(Title.ConfirmTitle)])
    if (confirm.options === ConfirmOptions.No) {
      await this.processAnswer()
      return
    }
    if (confirm.options === ConfirmOptions.Yes) {
      await this.alex.restart()
      await runAlex()
    }
  }
}

void runAlex()
