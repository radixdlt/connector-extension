import { Button, PopupWindow, Text } from 'components'
import { useEffect, useRef, useState } from 'react'
import type {
  LedgerResponse,
  LedgerRequest,
  LedgerSuccessResponse,
} from '../schemas'
import {
  LedgerDiscriminator,
  createLedgerSuccessResponse,
  createLedgerErrorResponse,
} from '../schemas'
import { createMessage } from 'chrome/messages/create-message'
import type { Message, Messages } from 'chrome/messages/_types'
import { ledger, ledgerLogger } from '../wrapper/ledger-wrapper'
import { sendMessage } from 'chrome/helpers/send-message'
import { isExtensionPage } from 'chrome/messages/trusted-senders'
import { Subscription } from 'rxjs'
import { LedgerMask } from 'ledger/components/ledger-mask'
import type { Result, ResultAsync } from 'neverthrow'
import { LedgerErrorCode } from 'ledger/wrapper/constants'

/**
 * These errors returned from Ledger device are stopped at Connector Extension level (not passed to wallet)
 */
const ErrorMessages: Record<string, string> = {
  [LedgerErrorCode.MultipleLedgerConnected]: 'Multiple Devices Found',
  [LedgerErrorCode.UnlockDevice]: 'Ledger Device Locked',
  [LedgerErrorCode.BadIns]: 'Radix Babylon app is not open on Ledger device',
  [LedgerErrorCode.WrongDataLength]:
    'Radix Babylon app is not open on Ledger device',
  [LedgerErrorCode.NoDevicesConnected]: 'No Device Found',
  [LedgerErrorCode.FailedToListLedgerDevices]: 'No Device Found',
  [LedgerErrorCode.FailedToCreateTransport]: 'No Device Found',
  [LedgerErrorCode.DeviceIsLocked]: 'No Device Found',
  [LedgerErrorCode.PendingReviewScreen]: 'Device Not Ready',
  [LedgerErrorCode.FailedToExchangeData]:
    'Restart Babylon app on Ledger device',
  [LedgerErrorCode.DeviceMismatch]: `Wrong Device Connected`,
}

const isErrorForExtension = (error: string) =>
  Object.keys(ErrorMessages).includes(error)

const isWalletToLedgerFromBackground = (
  message: unknown,
): message is Messages['walletToLedger'] =>
  (message as Partial<Message> | undefined)?.discriminator ===
    'walletToLedger' &&
  (message as Partial<Message> | undefined)?.source === 'background'
/**
 * There is single React view for every request type
 */
type LedgerView = {
  header: string
  content: LedgerRequest['discriminator']
  ledgerDevice?: Extract<
    LedgerRequest,
    { ledgerDevice: unknown }
  >['ledgerDevice']
  /** Gives the request to the device. */
  run: () => ResultAsync<unknown, string>
}

const viewOf = (request: LedgerRequest): LedgerView => {
  switch (request.discriminator) {
    case 'getDeviceInfo':
      return {
        header: 'Ledger Connection Request',
        content: request.discriminator,
        ledgerDevice: undefined,
        run: () => ledger.getDeviceInfo(request),
      }
    case 'derivePublicKeys':
      return {
        header: 'Ledger Connection Request',
        content: request.discriminator,
        ledgerDevice: request.ledgerDevice,
        run: () => ledger.getPublicKeys(request),
      }
    case 'signTransaction':
      return {
        header: 'Ledger Signing Request',
        content: request.discriminator,
        ledgerDevice: request.ledgerDevice,
        run: () => ledger.signTransaction(request),
      }
    case 'signChallenge':
      return {
        header: 'Ledger Signing Request',
        content: request.discriminator,
        ledgerDevice: request.ledgerDevice,
        run: () => ledger.signAuth(request),
      }
    case 'signSubintentHash':
      return {
        header: 'Ledger Pre-Authorization Request',
        content: request.discriminator,
        ledgerDevice: request.ledgerDevice,
        run: () => ledger.signSubintent(request),
      }
    case 'deriveAndDisplayAddress':
      return {
        header: 'Ledger Connection Request',
        content: request.discriminator,
        ledgerDevice: request.ledgerDevice,
        run: () => ledger.deriveAndDisplayAddress(request),
      }
  }
}

export const Ledger = () => {
  const [progressMessage, setProgressMessage] = useState<string | undefined>()
  const [currentId, setCurrentId] = useState<number | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [currentMessage, setShownMessage] =
    useState<Messages['walletToLedger']>()
  // The request being handled, for the listeners added once: a value of a render
  // would stay the first one's (none), and a request sent again was run again.
  const handling = useRef<Messages['walletToLedger']>()
  const setCurrentMessage = (message: Messages['walletToLedger']) => {
    handling.current = message
    setShownMessage(message)
  }
  const [viewDefinition, setViewDefinition] = useState<LedgerView>()

  const respond = (response: LedgerResponse, walletPublicKey: string) => {
    sendMessage(createMessage.ledgerResponse(response, walletPublicKey)).map(
      () => window.close(),
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
                viewDefinition?.run().then(ledgerResponseHandler)
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

  const ledgerResponseHandler = async (response: Result<unknown, string>) => {
    if (!currentMessage?.data) {
      return
    }

    if (response.isErr()) {
      if (isErrorForExtension(response.error)) {
        sendMessage(createMessage.focusLedgerTab())
        setError(ErrorMessages[response.error] ?? response.error)
        return
      }

      respond(
        createLedgerErrorResponse(currentMessage.data, response.error),
        currentMessage.walletPublicKey,
      )
      return
    }

    if (response.isOk()) {
      if (currentMessage?.data) {
        const ledgerResponse = createLedgerSuccessResponse(
          currentMessage.data,
          response.value,
        ) as LedgerSuccessResponse

        respond(ledgerResponse, currentMessage.walletPublicKey)
      }
    }
  }

  useEffect(() => {
    const disconnectHandler = (event: HIDConnectionEvent) => {
      ledgerLogger.debug(
        `HID device disconnected, productId: ${event.device.productId}, currentId: ${currentId}`,
      )
      const message = handling.current
      if (event.device.productId === currentId && message) {
        respond(
          createLedgerErrorResponse(message.data, 'deviceDisconnected'),
          message.walletPublicKey,
        )
      }
    }
    navigator.hid.addEventListener('disconnect', disconnectHandler)
    return () => {
      navigator.hid.removeEventListener('disconnect', disconnectHandler)
    }
  }, [currentId])

  /**
   * This effect has listener which waits for Ledger Requests
   */
  useEffect(() => {
    const subscription = new Subscription()
    const readMessage = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ) => {
      // Only from the extension: a web page must never get the device to sign.
      if (!isExtensionPage(sender)) return
      if (isWalletToLedgerFromBackground(message)) {
        setError(undefined)
        sendMessage(
          createMessage.confirmationSuccess('ledger', message.messageId),
        )
        // Sent again (the wallet asks once more): the device already has it.
        if (
          message.data.interactionId === handling.current?.data.interactionId
        ) {
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
        setViewDefinition(viewOf(message.data))
      }
    }

    subscription.add(
      ledger.progress$.subscribe((message) => setProgressMessage(message)),
    )
    subscription.add(
      ledger.connectedDeviceId$.subscribe((connectedDeviceId) => {
        ledgerLogger.debug(`Current device ID: ${connectedDeviceId}`)
        setCurrentId(connectedDeviceId)
      }),
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
      viewDefinition.run().then(ledgerResponseHandler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs per new view or message
  }, [viewDefinition, currentMessage])

  return (
    <PopupWindow content="start" items="center">
      {progressMessage ? (
        <LedgerMask header="Ledger Request Sent">
          <Text>
            Please review the request on your connected Ledger device.
          </Text>
          <Text size="small" color="radixGrey2" mt="lg" negativeMarginBottom>
            {progressMessage}
          </Text>
        </LedgerMask>
      ) : (
        <LedgerMask
          header={viewDefinition?.header ?? ''}
          error={error || ''}
          onRetry={() => viewDefinition?.run().then(ledgerResponseHandler)}
          ledgerDevice={viewDefinition?.ledgerDevice}
        >
          {renderContent(viewDefinition?.content ?? '')}
        </LedgerMask>
      )}
    </PopupWindow>
  )
}
