import log from 'loglevel'
import { Chunked, messageToChunked } from '../data-chunking'

describe('data chunking', () => {
  beforeEach(() => {
    log.setLevel('silent')
  })

  describe('happy paths', () => {
    it('should transform a message to a chunked message', async () => {
      const message = 'foobar'
      const chunkedResult = await messageToChunked(
        Buffer.from(message, 'utf-8'),
        log
      )
      if (chunkedResult.isErr()) throw chunkedResult.error
      expect(chunkedResult.value).toHaveProperty('chunks')
      expect(chunkedResult.value).toHaveProperty('metaData')
    })

    it('should transform chunked message into message', async () => {
      const message = `Cerberus is the unique consensus protocol underpinning Radix. It took seven years of research, starting in 2013 and culminating in the Cerberus Whitepaper in 2020. How Cerberus is going to be implemented in its final fully sharded form is the focus of Radix Labs and Cassandra.

In its final form, Cerberus represents a radically different paradigm in the design of decentralized Distributed Ledger Technology systems. It is the only protocol that is designed so that all transactions are atomically composed across shards. This is a critical feature if DeFi is to ever scale to billions of users.

Cerberus takes a well-proven 'single-pipe' BFT (Byzantine Fault Tolerance) consensus process and parallelizes it across an extensive set of instances or shards – practically an unlimited number of shards. It achieves this parallelization through a unique new 'braided' synchronization of consensus across shards, as required by the 'dependencies' of each transaction. This requires the use of a specialized application layer called the Radix Engine.

All of this provides Cerberus with practically infinite 'linear' scalability. This means that as more nodes are added to the Radix Public Network, throughput increases linearly. As a result, Cerberus is the only consensus protocol that is capable of supporting the global financial system on a decentralized network.`

      const chunkedResult = await messageToChunked(
        Buffer.from(message, 'utf-8'),
        log,
        400
      )
      if (chunkedResult.isErr()) throw chunkedResult.error

      const chunkedMessage = Chunked(chunkedResult.value.metaData, log)

      let allChunksReceivedResult = chunkedMessage.allChunksReceived()
      if (allChunksReceivedResult.isErr()) throw allChunksReceivedResult.error
      expect(allChunksReceivedResult.value).toBe(false)

      chunkedResult.value.chunks.forEach(chunkedMessage.addChunk)

      allChunksReceivedResult = chunkedMessage.allChunksReceived()
      if (allChunksReceivedResult.isErr()) throw allChunksReceivedResult.error
      expect(allChunksReceivedResult.value).toBe(true)

      const validateResult = await chunkedMessage.validate()
      if (validateResult.isErr()) throw validateResult.error

      const messageResult = await chunkedMessage.toString()
      if (messageResult.isErr()) throw messageResult.error
      expect(message).toEqual(messageResult.value)
    })
  })
})
