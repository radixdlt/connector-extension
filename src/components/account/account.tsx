import type { Account as AccountType } from '@radixdlt/radix-dapp-toolkit'
import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'

declare global {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging needs an interface
    interface IntrinsicElements {
      'radix-account': {
        ref: RefObject<HTMLElement>
        label: string
        address: string
        appearanceId: number
      }
    }
  }
}

// The dApp toolkit's <radix-account> card, defined once its module is loaded:
// in the background, so that it does not hold up the popup's first paint.
let accountCardLoaded: Promise<unknown> | undefined
const loadAccountCard = () => {
  // Typed only under moduleResolution "bundler" (the package's `exports`).
  // @ts-expect-error -- no types for this subpath under "node"
  accountCardLoaded ??= import('@radixdlt/radix-dapp-toolkit/connect-button')
  return accountCardLoaded
}

/**
 * The card's copy icon, drawn for the gradients: opaque, with 1.5px strokes. Its own
 * is white at 0.64 opacity (0.51 within the address) and 1px thin, faint on the light
 * end of a gradient.
 */
const copyIcon = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.25 9.25V3.25a1.5 1.5 0 0 1 1.5-1.5h5.5"/>' +
    '<rect x="4.75" y="4.25" width="7.5" height="8.5" rx="1.5" fill="white" fill-opacity="0.2"/>' +
    '</svg>',
)}")`

/**
 * What the card's own styles lack, added to its shadow root (beside them): a copy icon
 * that stands out on any of the account gradients, and a copy button that shows when
 * the pointer is on it.
 */
let accountCardStyles: CSSStyleSheet | undefined
const accountCardStylesheet = () => {
  if (!accountCardStyles) {
    accountCardStyles = new CSSStyleSheet()
    accountCardStyles.replaceSync(`
      /* Its own is 12px white at 0.8 opacity: 1.7:1 on the mint end of a gradient. The
         halo of shade keeps it apart where no white reaches 4.5:1 (2.1:1 on mint). */
      .address {
        font-size: 13px;
        opacity: 1;
        /* Underlined only when it is pointed at or reached: at rest, beside the copy
           icon, the line cut through q, j and p and added nothing. */
        text-decoration: none;
        text-underline-offset: 2px;
        text-shadow:
          0 0 2px rgba(0, 0, 0, 0.35),
          0 1px 2px rgba(0, 0, 0, 0.3);
      }
      .address:hover,
      .address:focus-visible {
        text-decoration: underline;
      }
      .tooltip-wrapper i {
        background-image: ${copyIcon};
        width: 14px;
        height: 14px;
        /* An edge of shade: the white keeps apart from the mint and pink ends. */
        filter: drop-shadow(0 0 0.75px rgba(0, 0, 0, 0.6))
          drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.25));
      }
      .tooltip-wrapper {
        cursor: pointer;
        padding: 4px;
        margin: -4px;
        border-radius: 6px;
        transition: background-color 0.15s ease;
      }
      .tooltip-wrapper:hover {
        background-color: rgba(255, 255, 255, 0.28);
      }
      .tooltip-wrapper:active {
        background-color: rgba(255, 255, 255, 0.4);
      }
      @media (prefers-reduced-motion: reduce) {
        .tooltip-wrapper { transition: none; }
      }
    `)
  }
  return accountCardStyles
}

/** Adds `accountCardStylesheet` to a card, once it is defined and has rendered. */
const styleAccountCard = (element: HTMLElement) =>
  customElements.whenDefined('radix-account').then(() => {
    const root = element.shadowRoot
    const sheet = accountCardStylesheet()
    if (root && !root.adoptedStyleSheets.includes(sheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
  })

export const Account = ({
  account,
  onLinkClick,
}: {
  account: AccountType
  onLinkClick?: (ev: CustomEvent) => void
}) => {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    loadAccountCard()
    const element = ref.current
    // eslint-disable-next-line no-void -- fire-and-forget
    if (element) void styleAccountCard(element)
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element || !onLinkClick) return

    element.addEventListener('onLinkClick', onLinkClick as EventListener)
    // The element it was added to: a ref made at each render was empty by then.
    return () =>
      element.removeEventListener('onLinkClick', onLinkClick as EventListener)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- added once, on mount
  }, [])
  return (
    <radix-account
      ref={ref}
      label={account.label}
      address={account.address}
      appearanceId={account.appearanceId}
    />
  )
}
