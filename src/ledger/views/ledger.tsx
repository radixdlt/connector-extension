import { Button, PopupWindow, Text } from 'components'
import { useEffect, useState } from 'react'
import {
  LedgerResponse,
  LedgerDiscriminator,
  LedgerPublicKeyRequest,
  LedgerSignTransactionRequest,
  LedgerSignChallengeRequest,
  createLedgerSuccessResponse,
  createLedgerErrorResponse,
  LedgerSuccessResponse,
} from '../schemas'
import { createMessage } from 'chrome/messages/create-message'
import { Messages } from 'chrome/messages/_types'
import { ledger } from '../wrapper/ledger-wrapper'
import { sendMessage } from 'chrome/helpers/send-message'
import { Subscription } from 'rxjs'
import { LedgerMask } from 'ledger/components/ledger-mask'
import { Result } from 'neverthrow'
import { LedgerErrorCode } from 'ledger/wrapper/constants'

const ErrorMessages: Record<string, string> = {
  [LedgerErrorCode.MultipleLedgerConnected]: 'Multiple Devices Found',
  [LedgerErrorCode.UnlockDevice]: 'Ledger Device Locked',
  [LedgerErrorCode.BadIns]: 'Radix Babylon app is not opened',
  [LedgerErrorCode.NoDevicesConnected]: 'No Device Found',
  [LedgerErrorCode.FailedToListLedgerDevices]: 'No Device Found',
  [LedgerErrorCode.FailedToCreateTransport]: 'No Device Found',
  [LedgerErrorCode.FailedToExchangeData]:
    'Restart Babylon app on Ledger device',
  [LedgerErrorCode.DeviceMismatch]: `Wrong Device Connected`,
}

const isErrorForExtension = (error: string) =>
  Object.keys(ErrorMessages).includes(error)

const isWalletToLedgerFromBackground = (
  message: any,
): message is Messages['walletToLedger'] => {
  return (
    message?.discriminator === 'walletToLedger' &&
    message?.source === 'background'
  )
}

const viewsDefinition = {
  [LedgerDiscriminator.getDeviceInfo]: () => ({
    header: 'Ledger Connection Request',
    content: LedgerDiscriminator.getDeviceInfo,
    ledgerDevice: undefined,
    requestFunction: ledger.getDeviceInfo,
  }),
  [LedgerDiscriminator.derivePublicKeys]: (
    request: LedgerPublicKeyRequest,
  ) => ({
    header: 'Ledger Connection Request',
    content: LedgerDiscriminator.derivePublicKeys,
    ledgerDevice: request.ledgerDevice,
    requestFunction: ledger.getPublicKeys,
  }),
  [LedgerDiscriminator.signTransaction]: (
    request: LedgerSignTransactionRequest,
  ) => ({
    header: 'Ledger Signing Request',
    content: LedgerDiscriminator.signTransaction,
    ledgerDevice: request.ledgerDevice,
    requestFunction: ledger.signTransaction,
  }),
  [LedgerDiscriminator.signChallenge]: (
    request: LedgerSignChallengeRequest,
  ) => ({
    header: 'Ledger Signing Request',
    content: LedgerDiscriminator.signChallenge,
    ledgerDevice: request.ledgerDevice,
    requestFunction: ledger.signAuth,
  }),
  [LedgerDiscriminator.deriveAndDisplayAddress]: (
    request: LedgerPublicKeyRequest,
  ) => ({
    header: 'Ledger Connection Request',
    content: LedgerDiscriminator.deriveAndDisplayAddress,
    ledgerDevice: request.ledgerDevice,
    requestFunction: ledger.deriveAndDisplayAddress,
  }),
}

export const Ledger = () => {
  const [progressMessage, setProgressMessage] = useState<string | undefined>()
  const [currentId, setCurrentId] = useState<number | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [currentMessage, setCurrentMessage] =
    useState<Messages['walletToLedger']>()
  const [viewDefinition, setViewDefinition] = useState<any>()

  const respond = (response: LedgerResponse) => {
    sendMessage(createMessage.ledgerResponse(response)).map(() =>
      window.close(),
    )
  }

  const renderContent = (discriminator: string) => {
    if (discriminator === LedgerDiscriminator.getDeviceInfo) {
      return (
        <>
          <Text>
            Connect the <strong>Ledger S, S+</strong>, or{' '}
            <strong>Nano X</strong> hardware wallet device you want to connect
            to your Radix Wallet.
          </Text>

          {!error && (
            <Button
              mt="2xl"
              px="2xl"
              onClick={() => {
                viewDefinition
                  ?.requestFunction(currentMessage?.data)
                  .then(ledgerResponseHandler)
              }}
            >
              Continue
            </Button>
          )}
        </>
      )
    }

    if (discriminator === LedgerDiscriminator.derivePublicKeys) {
      return (
        <Text>
          Connect the following hardware wallet device to create an account.
        </Text>
      )
    }

    if (
      [
        LedgerDiscriminator.signTransaction,
        LedgerDiscriminator.signChallenge,
      ].includes(discriminator)
    ) {
      return <Text>Connect the following hardware wallet device to sign.</Text>
    }
  }

  const ledgerResponseHandler = async (response: Result<any, any>) => {
    if (!currentMessage?.data) {
      return
    }

    if (response.isErr()) {
      if (isErrorForExtension(response.error)) {
        sendMessage(createMessage.focusLedgerTab())
        setError(ErrorMessages[response.error] ?? response.error)
        return
      }

      respond(createLedgerErrorResponse(currentMessage.data, response.error))
      return
    }

    if (response.isOk()) {
      if (currentMessage?.data) {
        const ledgerResponse = createLedgerSuccessResponse(
          currentMessage.data,
          response.value,
        ) as LedgerSuccessResponse

        respond(ledgerResponse)
      }
    }
  }

  useEffect(() => {
    const disconnectHandler = (event: HIDConnectionEvent) => {
      if (event.device.productId === currentId && currentMessage) {
        respond(
          createLedgerErrorResponse(currentMessage.data, 'deviceDisconnected'),
        )
      }
    }
    navigator.hid.addEventListener('disconnect', disconnectHandler)
    return () => {
      navigator.hid.removeEventListener('disconnect', disconnectHandler)
    }
  }, [currentId])

  useEffect(() => {
    const subscription = new Subscription()
    const readMessage = (message: unknown) => {
      if (isWalletToLedgerFromBackground(message)) {
        setError(undefined)
        sendMessage(
          createMessage.confirmationSuccess('ledger', message.messageId),
        )
        if (message.data.interactionId === currentMessage?.data.interactionId) {
          return
        }

        if (
          [
            LedgerDiscriminator.signChallenge,
            LedgerDiscriminator.signTransaction,
            LedgerDiscriminator.getDeviceInfo,
          ].includes(message.data.discriminator)
        ) {
          sendMessage(createMessage.focusLedgerTab())
        }

        setCurrentMessage(message)
        setViewDefinition(
          viewsDefinition[message.data.discriminator](message.data as any),
        )
      }
    }

    subscription.add(
      ledger.progress$.subscribe((message) => setProgressMessage(message)),
    )
    subscription.add(
      ledger.connectedDeviceId$.subscribe((connectedDeviceId) =>
        setCurrentId(connectedDeviceId),
      ),
    )

    chrome.runtime.onMessage.addListener(readMessage)

    return () => {
      subscription.unsubscribe()
      chrome.runtime.onMessage.removeListener(readMessage)
    }
  }, [])

  useEffect(() => {
    if (
      viewDefinition &&
      currentMessage &&
      currentMessage.data.discriminator !== LedgerDiscriminator.getDeviceInfo
    ) {
      viewDefinition
        .requestFunction(currentMessage.data)
        .then(ledgerResponseHandler)
    }
  }, [viewDefinition, currentMessage])

  return (
    <PopupWindow content="start" items="center">
      {progressMessage ? (
        <LedgerMask header="Ledger Request Sent">
          <Text>
            Please review the request on your connected Ledger device.
          </Text>
        </LedgerMask>
      ) : (
        <LedgerMask
          header={viewDefinition?.header}
          error={error || ''}
          onRetry={() =>
            viewDefinition
              ?.requestFunction(currentMessage?.data)
              .then(ledgerResponseHandler)
          }
          ledgerDevice={viewDefinition?.ledgerDevice}
        >
          {renderContent(viewDefinition?.content)}
        </LedgerMask>
      )}
    </PopupWindow>
  )
}
