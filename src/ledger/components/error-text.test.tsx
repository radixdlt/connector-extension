import { render } from '@testing-library/react'
import { ErrorText } from './error-text'
import { MessagingContext } from '../contexts/messaging-context'

describe('ErrorText', () => {
  const { location } = window

  afterAll(() => {
    window.location = location
  })

  const renderErrorText = (error: string) =>
    render(
      <MessagingContext.Provider
        value={{ switchToFullWindow: () => {} } as any}
      >
        <ErrorText error={error} />,
      </MessagingContext.Provider>,
    )

  describe('GIVEN known error', () => {
    it('should render message instead', () => {
      const { getByText } = renderErrorText('DeviceMismatch')
      expect(
        getByText(/Make sure you connected correct Ledger device/i),
      ).toBeTruthy()
    })

    describe('GIVEN "FailedToCreateTransport" error inside popup', () => {
      it('should display "first time" instructions', () => {
        Object.defineProperty(window, 'location', {
          value: new URL('https://popup.html/?isPopupWindow=true'),
          configurable: true,
          writable: true,
        })
        const { getByText } = renderErrorText('FailedToCreateTransport')
        expect(getByText(/navigate to full window/i)).toBeTruthy()
      })
    })

    describe('GIVEN "FailedToCreateTransport" error outside popup', () => {
      it('should not display "first time" instructions', () => {
        Object.defineProperty(window, 'location', {
          value: new URL('https://popup.html'),
          configurable: true,
          writable: true,
        })
        const { getByText } = renderErrorText('FailedToCreateTransport')
        expect(() => getByText(/navigate to full window/i)).toThrow()
      })
    })
  })

  describe('GIVEN unknown error', () => {
    it('should render error descriptor', () => {
      const { getByText } = renderErrorText('6e14')
      expect(getByText(/Unknown Error: BadBip32PathNetworkId/i)).toBeTruthy()
    })

    it('should render error descriptor', () => {
      const { getByText } = renderErrorText('6f0f')
      expect(getByText(/Unknown Error: CxErrorEcInvalidPoint/i)).toBeTruthy()
    })

    it('should render error itself', () => {
      const { getByText } = renderErrorText('xxxxx')
      expect(getByText(/Unknown Error: xxxxx/i)).toBeTruthy()
    })
  })
})
