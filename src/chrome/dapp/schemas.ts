import {
  ExtensionInteraction,
  Metadata,
  WalletInteractionItems,
  extensionInteractionDiscriminator,
} from '@radixdlt/radix-dapp-toolkit'
import {
  Output,
  literal,
  merge,
  object,
  optional,
  string,
  union,
} from 'valibot'

export type MetadataWithOptionalOrigin = Output<
  typeof MetadataWithOptionalOrigin
>

export const MetadataWithOptionalOrigin = merge([
  Metadata,
  object({
    origin: optional(string()),
  }),
])

export type WalletInteractionWithOptionalOrigin = Output<
  typeof WalletInteractionWithOptionalOrigin
>

export const WalletInteractionWithOptionalOrigin = object({
  interactionId: string(),
  metadata: MetadataWithOptionalOrigin,
  items: WalletInteractionItems,
})

export type WalletInteractionExtensionInteractionOptionalOrigin = Output<
  typeof WalletInteractionExtensionInteractionOptionalOrigin
>

export const WalletInteractionExtensionInteractionOptionalOrigin = object({
  interactionId: string(),
  discriminator: literal(extensionInteractionDiscriminator.walletInteraction),
  interaction: WalletInteractionWithOptionalOrigin,
  sessionId: optional(string()),
})

export type CancelWalletInteractionExtensionInteractionOptionalOrigin = Output<
  typeof CancelWalletInteractionExtensionInteractionOptionalOrigin
>

export const CancelWalletInteractionExtensionInteractionOptionalOrigin = object({
  interactionId: string(),
  discriminator: literal(
    extensionInteractionDiscriminator.cancelWalletInteraction,
  ),
  metadata: MetadataWithOptionalOrigin,
})

export type ExtenstionInteractionOptionalOrigin = Output<
  typeof ExtenstionInteractionOptionalOrigin
>

export const ExtenstionInteractionOptionalOrigin = union([
  ExtensionInteraction,
  CancelWalletInteractionExtensionInteractionOptionalOrigin,
  WalletInteractionExtensionInteractionOptionalOrigin,
])
