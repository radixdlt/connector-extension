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

export type WalletInteractionExtensionInteraction = Output<
  typeof WalletInteractionExtensionInteraction
>

export const WalletInteractionExtensionInteraction = object({
  interactionId: string(),
  discriminator: literal(extensionInteractionDiscriminator.walletInteraction),
  interaction: WalletInteractionWithOptionalOrigin,
  sessionId: optional(string()),
})

export type CancelWalletInteractionExtensionInteraction = Output<
  typeof CancelWalletInteractionExtensionInteraction
>

export const CancelWalletInteractionExtensionInteraction = object({
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
  CancelWalletInteractionExtensionInteraction,
  WalletInteractionExtensionInteraction,
])
