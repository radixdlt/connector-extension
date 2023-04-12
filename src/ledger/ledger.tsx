import { Box, PopupWindow } from 'components'
import { useEffect, useState } from 'react'
import {
  isPublicKeyRequest,
  isSignChallengeRequest,
  isSignTransactionRequest,
  isDeviceIdRequest,
  LedgerResponse,
  isImportOlympiaDeviceRequest,
} from './schemas'
import { ApplyLedgerFactor } from './views/apply-ledger-factor'
import { NewHardwareWallet } from './views/new-hardware-wallet'
import { SignChallenge } from './views/sign-challenge'
import { SignTransaction } from './views/sign-transaction'
import { createMessage } from 'chrome/messages/create-message'
import { Messages } from 'chrome/messages/_types'
import { ImportOlympiaDevice } from './views/import-olympia-device'

export const Ledger = () => {
  const [currentMessage, setCurrentMessage] =
    useState<Messages['walletToLedger']>()

  const respond = async (response: LedgerResponse) => {
    await chrome.runtime.sendMessage(createMessage.ledgerResponse(response))
    await chrome.runtime.sendMessage(
      createMessage.confirmationSuccess('offScreen', currentMessage!.messageId)
    )
    window.close()
  }

  const renderLedgerView = (message?: Messages['walletToLedger']) => {
    if (!message) return

    if (isDeviceIdRequest(message.data)) {
      return <NewHardwareWallet message={message.data} respond={respond} />
    } else if (isPublicKeyRequest(message.data)) {
      return <ApplyLedgerFactor message={message.data} respond={respond} />
    } else if (isSignTransactionRequest(message.data)) {
      return <SignTransaction message={message.data} respond={respond} />
    } else if (isSignChallengeRequest(message.data)) {
      return <SignChallenge message={message.data} respond={respond} />
    } else if (isImportOlympiaDeviceRequest(message.data)) {
      return <ImportOlympiaDevice message={message.data} respond={respond} />
    }
  }

  useEffect(() => {
    const readMessage = (message: any) => {
      if (
        message.discriminator === 'walletToLedger' &&
        message.source === 'background'
      ) {
        setCurrentMessage(message)
      }
    }

    chrome.runtime.onMessage.addListener(readMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(readMessage)
    }
  }, [])

  return (
    <PopupWindow content="start">
      <Box maxWidth="medium">{renderLedgerView(currentMessage)}</Box>
    </PopupWindow>
  )
}
