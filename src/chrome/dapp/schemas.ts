import {
  ExtensionInteraction,
  Metadata,
  WalletInteractionItems,
  extensionInteractionDiscriminator,
} from '@radixdlt/radix-dapp-toolkit'
import { InferOutput, literal, object, optional, string, union } from 'valibot'

export type MetadataWithOptionalOrigin = InferOutput<
  typeof MetadataWithOptionalOrigin
>

export const MetadataWithOptionalOrigin = object({
  ...Metadata.entries,
  ...object({
    origin: optional(string()),
  }).entries,
})

export type WalletInteractionWithOptionalOrigin = InferOutput<
  typeof WalletInteractionWithOptionalOrigin
>

export const WalletInteractionWithOptionalOrigin = object({
  interactionId: string(),
  metadata: MetadataWithOptionalOrigin,
  items: WalletInteractionItems,
})

export type WalletInteractionExtensionInteractionOptionalOrigin = InferOutput<
  typeof WalletInteractionExtensionInteractionOptionalOrigin
>

export const WalletInteractionExtensionInteractionOptionalOrigin = object({
  interactionId: string(),
  discriminator: literal(extensionInteractionDiscriminator.walletInteraction),
  interaction: WalletInteractionWithOptionalOrigin,
  sessionId: optional(string()),
})

export type CancelWalletInteractionExtensionInteractionOptionalOrigin =
  InferOutput<typeof CancelWalletInteractionExtensionInteractionOptionalOrigin>

export const CancelWalletInteractionExtensionInteractionOptionalOrigin = object(
  {
    interactionId: string(),
    discriminator: literal(
      extensionInteractionDiscriminator.cancelWalletInteraction,
    ),
    metadata: MetadataWithOptionalOrigin,
  },
)

export type ExtenstionInteractionOptionalOrigin = InferOutput<
  typeof ExtenstionInteractionOptionalOrigin
>

export const ExtenstionInteractionOptionalOrigin = union([
  ExtensionInteraction,
  CancelWalletInteractionExtensionInteractionOptionalOrigin,
  WalletInteractionExtensionInteractionOptionalOrigin,
])
