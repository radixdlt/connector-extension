import { useConnectionsClient } from 'pairing/state/connections'
import QRCode from 'react-qr-code'
import { Link } from 'react-router-dom'
import { LaunchIcon } from 'ui/icons'
import { RelinkWarning } from './relink-warning'
import 'settings/settings.css'

/**
 * Linking a wallet: the QR code it scans (with the password of this pairing), how
 * to reach the scanner in the Radix Wallet app, and a way out (back to the linked
 * wallets, or to the wallet's download page when none is linked yet).
 */
export const ConnectionPassword = ({
  connectionPassword,
  publicKey,
  signature,
  purpose,
}: {
  connectionPassword?: string
  publicKey?: string
  signature?: string
  purpose?: 'general'
}) => {
  const connectionsClient = useConnectionsClient()
  if (!connectionPassword || !publicKey || !signature) return null

  const hasWallets = connectionsClient.hasConnections()

  return (
    <div className="main-view pairing">
      {/* Room for the settings button in the top-right corner. */}
      <h1 className="pairing__title">
        {hasWallets ? 'Link New Radix Wallet' : 'Radix Wallet Connector'}
      </h1>
      <p className="pairing__intro">
        Scan this code with the Radix Wallet app on your phone to use dApps in
        this browser.
      </p>

      <div className="main-view__content">
        <figure className="pairing__qr">
          {/* Dark on white in every theme: what scanners read best. */}
          <div
            className="pairing__qr-card"
            role="img"
            aria-label="QR code to link the Radix Wallet"
          >
            <QRCode
              size={152}
              bgColor="#ffffff"
              fgColor="#000000"
              value={JSON.stringify({
                password: connectionPassword,
                publicKey,
                signature,
                purpose,
              })}
            />
          </div>
          <figcaption className="pairing__waiting">
            Waiting for your wallet
          </figcaption>
        </figure>

        {/* As the settings draw their lists: full width, divided by lines. */}
        <section
          className="rdx-section rdx-settings-palette pairing__steps"
          aria-labelledby="pairing-steps-title"
        >
          <h2 id="pairing-steps-title" className="rdx-section__header">
            How to link
          </h2>
          <ol className="rdx-group">
            <li>
              <div className="rdx-row">
                <span className="rdx-row__icon pairing__step-number">1</span>
                <span className="pairing__step-text">
                  Open the <strong>Radix Wallet</strong> app on your phone
                </span>
              </div>
            </li>
            <li>
              <div className="rdx-row">
                <span className="rdx-row__icon pairing__step-number">2</span>
                <span className="pairing__step-text">
                  Tap the gear icon to open the <strong>Settings</strong>
                </span>
              </div>
            </li>
            <li>
              <div className="rdx-row">
                <span className="rdx-row__icon pairing__step-number">3</span>
                <span className="pairing__step-text">
                  Tap <strong>Linked Connectors</strong>, then{' '}
                  <strong>Link New Connector</strong>, and scan this code
                </span>
              </div>
            </li>
            <li>
              <div className="rdx-row">
                <span className="rdx-row__icon pairing__step-number">4</span>
                <span className="pairing__step-text">
                  Name the connector in the wallet (for example, “Chrome on my
                  laptop”) and tap <strong>Continue</strong>
                </span>
              </div>
            </li>
            <li>
              <div className="rdx-row">
                <span className="rdx-row__icon pairing__step-number">5</span>
                <span className="pairing__step-text">
                  Back here, give the wallet a name to recognise it in this
                  browser
                </span>
              </div>
            </li>
          </ol>
        </section>
        <RelinkWarning />
      </div>

      <div className="main-view__footer">
        {hasWallets ? (
          <Link
            className="main-view__button main-view__button--secondary"
            to="/"
          >
            Cancel
          </Link>
        ) : (
          <a
            className="main-view__button main-view__button--secondary"
            href="https://wallet.radixdlt.com"
            target="_blank"
            rel="noreferrer"
          >
            Get the Radix Wallet
            <LaunchIcon />
          </a>
        )}
      </div>
    </div>
  )
}
