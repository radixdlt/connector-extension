import { Chunked } from './data-chunking'

describe('Data chunking', () => {
  it('should reassemble chunked message with invalid message hash', async () => {
    const chunked = Chunked({
      packageType: 'metaData',
      messageId: '7a2f41a0-e1cd-469b-a756-872fa738d660',
      chunkCount: 1,
      hashOfMessage:
        'dea5b14b17eaadb9b2ee02bcc9d11fe60acfe99006cd55ae067aa448cd47d096',
      messageByteCount: 439,
    })
    chunked.addChunk({
      packageType: 'chunk',
      messageId: '7a2f41a0-e1cd-469b-a756-872fa738d660',
      chunkIndex: 0,
      chunkData:
        'eyJkaXNjcmltaW5hdG9yIjoic3VjY2VzcyIsImludGVyYWN0aW9uSWQiOiI1NzM2MDdmMC1lMzU0LTRiNTEtYTdhMi04NTJlZjg0YmU5ZGYiLCJpdGVtcyI6eyJkaXNjcmltaW5hdG9yIjoiYXV0aG9yaXplZFJlcXVlc3QiLCJhdXRoIjp7ImRpc2NyaW1pbmF0b3IiOiJsb2dpbldpdGhvdXRDaGFsbGVuZ2UiLCJwZXJzb25hIjp7ImlkZW50aXR5QWRkcmVzcyI6ImlkZW50aXR5X3RkeF9jXzFwbjB0bWh0cngzemxjdmV4a3pzdmVtd3lhZHhkYWtzbDk2c3YzZThhNzlzc254azI2MCIsImxhYmVsIjoieFN0ZWxlYSJ9fSwib25nb2luZ0FjY291bnRzIjp7ImFjY291bnRzIjpbeyJhZGRyZXNzIjoiYWNjb3VudF90ZHhfY18xcDh4c2VncHhzaDJ1dGNjczBuMDd2NWx6em0zZzZhdzk0OGVmbXpld242dHN1N3Z2NWEiLCJsYWJlbCI6Im1haW4iLCJhcHBlYXJhbmNlSWQiOjB9XX19fQ==',
    })

    const result = chunked.allChunksReceived()
    if (result.isErr()) throw result.error

    expect(result.value).toBe(true)

    const validResult = await chunked.validate()
    expect(validResult.isErr()).toBeTruthy()
  })
})
