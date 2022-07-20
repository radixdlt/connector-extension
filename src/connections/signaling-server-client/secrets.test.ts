import {
  deriveSecretsFromConnectionPassword,
  generateConnectionPasswordAndDeriveSecrets,
} from './secrets'
describe('signaling server secrets', () => {
  it('should generate connection password and derive secrets', async () => {
    const result = await generateConnectionPasswordAndDeriveSecrets(5)

    if (result.isErr()) throw result.error

    const secrets = result.value

    const result2 = await deriveSecretsFromConnectionPassword(
      secrets._connectionPasswordRaw
    )

    if (result2.isErr()) throw result2.error

    const derivedSecrets = result2.value

    expect(secrets).toEqual(derivedSecrets)
  })
})
