import { generateConnectionPasswordAndDeriveSecrets } from '../secrets'
describe('signaling server secrets', () => {
  it('should generate connection password and derive secrets', async () => {
    const result = await generateConnectionPasswordAndDeriveSecrets(5)

    if (result.isErr()) throw result.error

    const secrets = result.value

    expect(Buffer.isBuffer(secrets.encryptionKey)).toBeTruthy()
    expect(Buffer.isBuffer(secrets.connectionId)).toBeTruthy()
  })
})
