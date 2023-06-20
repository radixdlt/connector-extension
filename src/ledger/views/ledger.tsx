import { Box, Button, PopupWindow, Text } from 'components'
import { useEffect, useMemo, useState } from 'react'
import {
  isPublicKeyRequest,
  isSignChallengeRequest,
  isSignTransactionRequest,
  isDeviceIdRequest,
  LedgerResponse,
  createLedgerErrorResponse,
} from '../schemas'
import { ApplyLedgerFactor } from './apply-ledger-factor'
import { NewHardwareWallet } from './new-hardware-wallet'
import { SignChallenge } from './sign-challenge'
import { SignTransaction } from './sign-transaction'
import { createMessage } from 'chrome/messages/create-message'
import { Messages } from 'chrome/messages/_types'
import { ledger } from '../wrapper/ledger-wrapper'
import { MessagingContext } from 'ledger/contexts/messaging-context'
import { sendMessage } from 'chrome/messages/send-message'
import { Subscription } from 'rxjs'

export const Ledger = () => {
  const [progressMessage, setProgressMessage] = useState<string | undefined>()
  const [currentMessage, setCurrentMessage] =
    useState<Messages['walletToLedger']>()

  const messagingContext = useMemo(() => {
    const respond = async (response: LedgerResponse) => {
      await chrome.runtime.sendMessage(createMessage.ledgerResponse(response))
      window.close()
    }

    const switchToFullWindow = async () => {
      await chrome.runtime.sendMessage(
        createMessage.convertPopupToTab(currentMessage!)
      )
      window.close()
    }

    return {
      respond,
      switchToFullWindow,
    }
  }, [currentMessage])

  const renderLedgerView = (message?: Messages['walletToLedger']) => {
    if (!message) return

    if (isDeviceIdRequest(message.data)) {
      return <NewHardwareWallet message={message.data} />
    } else if (isPublicKeyRequest(message.data)) {
      return <ApplyLedgerFactor message={message.data} />
    } else if (isSignTransactionRequest(message.data)) {
      return <SignTransaction message={message.data} />
    } else if (isSignChallengeRequest(message.data)) {
      return <SignChallenge message={message.data} />
    }
  }

  const cancel = () => {
    if (!currentMessage) return

    sendMessage(
      createMessage.ledgerResponse(
        createLedgerErrorResponse(currentMessage.data, 'userCancelled')
      )
    ).map(() => window.close())
  }

  useEffect(() => {
    const subscription = new Subscription()
    const readMessage = (message: any) => {
      if (
        message.discriminator === 'walletToLedger' &&
        message.source === 'background'
      ) {
        sendMessage(
          createMessage.confirmationSuccess('ledger', message.messageId)
        )
        if (message.data.interactionId === currentMessage?.data.interactionId) {
          return
        }
        setCurrentMessage(message)
      }
    }

    subscription.add(
      ledger.progress$.subscribe((message) => setProgressMessage(message))
    )
    chrome.runtime.onMessage.addListener(readMessage)

    return () => {
      subscription.unsubscribe()
      chrome.runtime.onMessage.removeListener(readMessage)
    }
  }, [])

  return (
    <PopupWindow content="start">
      <MessagingContext.Provider value={messagingContext}>
        <Box maxWidth="medium">
          {renderLedgerView(currentMessage)}
          <Text italic style={{ color: 'white' }}>
            {progressMessage}
          </Text>
          {progressMessage ? null : (
            <Button full mt="medium" onClick={cancel}>
              Cancel
            </Button>
          )}
        </Box>
      </MessagingContext.Provider>
    </PopupWindow>
  )
}
