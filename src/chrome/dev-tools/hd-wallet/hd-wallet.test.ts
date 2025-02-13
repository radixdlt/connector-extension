import { BaseHdWallet, createRadixWallet } from './hd-wallet'
import { describe, beforeAll, it, expect } from 'vitest'

describe('HD Wallet', () => {
  let wallet: BaseHdWallet

  const createTestCase = (
    path: string,
    publicKey: string,
    privateKey?: string,
  ) => ({ path, publicKey, privateKey })

  describe('ed25519 curve', () => {
    beforeAll(() => {
      wallet = createRadixWallet({
        seed: 'equip will roof matter pink blind book anxiety banner elbow sun young',
        curve: 'ed25519',
      })
    })

    it('should return correct public keys', () => {
      const testCases = [
        createTestCase(
          'm/44H/1022H/12H/525H/1460H/0H',
          '451152a1cef7be603205086d4ebac0a0b78fda2ff4684b9dea5ca9ef003d4e7d',
          '13e971fb16cb2c816d6b9f12176e9b8ab9af1831d006114d344d119ab2715506',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1460H/1H',
          '0a4b894208a1f6b1bd7e823b59909f01aae0172b534baa2905b25f1bcbbb4f0a',
          'ec7634aff9d698d9a5b4001d5eaa878eefc4fc05939dfedcef0112329fd9966a',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1460H/2H',
          '235c27aafa83376d475040a7eb53ea889ae93bda005ef7f445f221f73b43313e',
          '9e96517567abba3e5492db11bc016450abb4e60406038d6423a87a0ad860a9ce',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1460H/3H',
          'cc294e8c43be93012f827cd54a11a2f836e5934c2361d61b5a737adbd42bf030',
          'e92d352f6846e75fb760c40229de8c3c2b04210b2955129877286cf15893a21e',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1678H/0H',
          '2612a6865d354ed285baf4877d671276e6cd8cd81e3f1101c35d16853c204fa4',
          '4a39274fd5f320172329ec96e88b658ad9798ea47f292e30f80915f01f3acc48',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1678H/1H',
          '2f92b0b43ee39c6c3006b2a5c7cdbdee0c6b6835d76a0dc8da0aeffc741d5c96',
          'd02147e27720dba12acbddc3d6d4fc43a64cab1dbbdcc3e7e0268c766deeccce',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1678H/2H',
          '3f23bcce53cf2ea14d238f8473aaf3c7ed3f4047fa20158389eabb651766f8d5',
          '41519644a280fc18191765ee32fdcc7a37ac95012e18c5fb31679222925da1ce',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1678H/3H',
          '5b36d055cdd07129ba0b780cd285661d5dae02831a55b408f84f9b72ba95c0a9',
          'b843c520aca4d980f69dcf02a6d3deb50c10bdaa350ed262b49cbb0997fcbd28',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1391H/0H',
          'd998153796a745c2f733079c791f4ae93eb96a812b39c9ee7a26eca32fa14905',
          '62e1255e91b6fafdf06d3d6e3cfa660a5dd39aaa6ab7c207e2535c86f597e47f',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1391H/1H',
          '94e163e6739fa0c9db3f44c0675f185fdb0f1dddb6d929cc49a199717c0a2da2',
          '30d9891cf7436d07f45a3358bbf4b0857388c08d1a7fe9973fd6044fa86a9ce0',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1391H/2H',
          '9bd51ee27f37367ee4c7cf18e5b8e1b40ae808d3da0350de152c9db34de778d3',
          '80b136f184159c7873321a73e6523be68d428440f95efb77fb67b43560cd5401',
        ),
        createTestCase(
          'm/44H/1022H/12H/525H/1391H/3H',
          'd9d6fc68321ce02c30122c6ff5c1a8068142703f9dac362cff29bfb814a2130f',
          '215af43054ac6055f86c9986d482a8fe6b0bf70543f6ebe74f69e33424b11282',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1460H/0H',
          'cc129e0d00d365f2269cee259923e904b8c46ef5b28aefc18df8ed20ef42a3eb',
          '9c683ba15644596f747bc749fed2657644c2873391f9c874efd32ccacc5adf08',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1460H/1H',
          'f67ac35c37921579b59f77fe05a1012ad8240092c8fed0d8fe1f96206eb99c3e',
          'aa45993887e5fe45252db7b34ad26686a4ef165f65ba30206d87d900310ea360',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1460H/2H',
          '02c8074258844ae4b81d80261fc411e95070526e0d92803fe4f343e00dc89ed5',
          'a5b3a586440f996d12ac9f21f61ed0758c13c012e42ed8c9d83e4bf4548e3dd3',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1460H/3H',
          'fca4f791866a48cb53a269e420fa6b7f192e98fee5f9e8f9009962ca3d9baeb2',
          'da699f61d6c2a4893d00b1f15158894974fb403a16a865583538f0542e883c54',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1678H/0H',
          'f6f2056e3edb8905be1717c1f8f5204242047875ba548c19d42962366800c1d4',
          '7997d39b74a390bc213c566ec016dd9023c4319af9da5194fb87c0d73f1d970f',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1678H/1H',
          '960ee0acd88b0e7f1e8cb171139c2e0e7b8d776134a103b36034a6991fcac175',
          'fa9c15acc1f46b790acdb060682c8d9fca307f02ba7a1deee4009c4f89cc3ddc',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1678H/2H',
          '07ba2aa69eee065495d8820ef9d5a94b982370e233f04472900cfb5efdb4fa3d',
          '4aea7c10102b93b173a72c62c6e5b3a19dacbc4e5dee6fc3f32e04a35d012059',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1678H/3H',
          'b4763c9a25d95f32e5ddefc7006ffc4a6570818bf24aeff581ac60cd82a751ba',
          '11e570fe1fc5c7a0deba1c672428b0793f45ca091580a50561ab46e50147ed07',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1391H/0H',
          '996626245f999a4c500c394036db43f73abb18f46970066ff124c750dc096360',
          '603ca94347db5edba67c73fa2c75d40f8534efbb6f043e279a62959b799fc55b',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1391H/1H',
          'afe925e5aabfa04fb10640cad2c1f6739b3dc9fb4ddeba6ff28e90854d45962d',
          '8564e2302ef419354a47265b6e5e6bed276b34cb691ef5a73fd6a722052cacda',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1391H/2H',
          '1226b881b66c58015e760852c0cb202869b73e29fbe0b3d22d50af0fa606b14a',
          '7af1d0b3f6a634891fb502de1bc14d3a06402e96380dfe377d4fb5864922cdf6',
        ),
        createTestCase(
          'm/44H/1022H/12H/618H/1391H/3H',
          '7fa1d448ef608a6e1a8533d816367b4fa0d60c39844bb82dbce1ea266105a275',
          'f5ec1d8379d2173975ea693afbd8940820f9d1b82b9f777f02c1ecd4197deab0',
        ),
      ]

      testCases.forEach((testCase) => {
        const keys = wallet.deriveFullPath(testCase.path.split('H').join("'"))
        expect(keys.publicKey).toBe(testCase.publicKey)
        expect(keys.privateKey).toBe(testCase.privateKey)
      })
    })
  })

  describe('secp256k1 curve', () => {
    beforeAll(() => {
      wallet = createRadixWallet({
        seed: 'equip will roof matter pink blind book anxiety banner elbow sun young',
        curve: 'secp256k1',
      })
    })

    it('should return correct public keys', () => {
      const testCases = [
        createTestCase(
          `m/44'/1022'/2'/1/3`,
          '03d79039c428a6b835e136fbb582e9259df23f8660f928367c3f0d6912728a8444',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/0H`,
          '03f43fba6541031ef2195f5ba96677354d28147e45b40cde4662bec9162c361f55',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/1H`,
          '0206ea8842365421f48ab84e6b1b197010e5a43a527952b11bc6efe772965e97cc',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/2H`,
          '024f44df0493977fcc5704c00c5c89932d77a9a0b016680e6a931684e160fb8d99',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/3H`,
          '0388485f6889d7ebcf1cf6f6dafc8ae5d224f9e847fac868c2e006e71ff3383a91',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/4H`,
          '024128185f801aee4ebe9a70d6290f60051162526551240da1374363b58e2e1e2c',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/5H`,
          '03f3f51a028cbed1a2c0c3b1f21abc5354f58e8d5279e817195750b8ddec9334f4',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/6H`,
          '0383d0721aac0569c37edafe5edd6e2d320822dc23f9207b263b2319837ed1a89d',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/7H`,
          '03af13461247c39e54fab62597701ab06c67edac7f8de4df1283a2645706c0b153',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/8H`,
          '0226912f5226f4a7c9c80780f32c6ad406c8b471c4929033e5e1756ca248c5a278',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/9H`,
          '035a9825274e30ce325cc3934b4e23b008097bd97f1b0a0ef57f7dc9a33e5760ed',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/0`,
          '03bc2ec8f3668c869577bf66b7b48f8dee57b833916aa70966fa4a5029b63bb18f',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/1`,
          '03c8a6a5710b5abba09341c24382de3222913120dee5084e887529bf821f3973e2',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/2`,
          '02d6b5b132e16160d6337d83408165c49edac7bb0112b1d1b3e96e3f6908f6d0d6',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/3`,
          '03ce5f85ad86922fbc217806a79d9f4d8d6a268f3822ffed9533a9fff73a4374b7',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/4`,
          '03e2c66201fc7330992d316d847bdbeb561704b70779ce60a4fcff53ffe5b6cb36',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/5`,
          '02df71a292057d1f7cda4fbcd252e43907646610cc191b6f44050683f82a7e63de',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/6`,
          '03d054f1c3d7982994d9581c496f84b6cdf584c8eff0401da82d8c19ad88e8a768',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/7`,
          '03ccf3b2bd4294d7e7e84268003f1e25c4893a482e28fcf00dfc1ff65679541d50',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/8`,
          '0284c067d070bfdb790883cab583f13a0b13f9d52eacdb52a5d8588231ce8c8b89',
        ),
        createTestCase(
          `m/44H/1022H/0H/0/9`,
          '02e5703b668deebac710118df687296e90da93c19d0db3cce656b6a677ab3e4747',
        ),
      ]

      testCases.forEach((testCase) => {
        const keys = wallet.deriveFullPath(testCase.path.split('H').join("'"))
        expect(keys.publicKey).toBe(testCase.publicKey)
        if (testCase.privateKey) {
          expect(keys.privateKey).toBe(testCase.privateKey)
        }
      })
    })
  })
})
