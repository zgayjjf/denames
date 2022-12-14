import { defaultCreateInstanceOptions } from '../../src/createInstance'
import { EnsService } from '../../src/services/EnsService'

describe('ENSService', () => {
  const ensService = new EnsService(defaultCreateInstanceOptions.ens)

  describe('isSupported', () => {
    it('support abc.eth', () => {
      expect(ensService.isSupported('abc.eth')).toBe(true)
    })

    it('do not support abc.bit', async () => {
      await expect(ensService.isSupported('abc.bit')).toBe(false)
    })

    it('leon.eth has been registered', async () => {
      const isRegistered = await ensService.isRegistered('leon.eth')
      expect(isRegistered).toBe(true)
    })

    it('leon.eth is available', async () => {
      const isAvailable = await ensService.isAvailable('leon.eth')
      expect(isAvailable).toBe(false)
    })

    it('address that owner of leon.eth is valid', async () => {
      const owner = await ensService.owner('leon.eth')
      expect(owner).toMatch(/^0x[0-9A-Fa-f]{40}$/)
    })

    it('tokenId that owner of leon.eth is valid', async () => {
      const tokenId = await ensService.tokenId('leon.eth')
      expect(tokenId).toMatch(/^0x[0-9A-Fa-f]{64}$/)
    })

    it("leont.eth's text record", async () => {
      const record = await ensService.record('leont.eth', 'text.keywords')
      expect(record).toEqual({
        key: 'text.keywords',
        type: 'text',
        subtype: 'keywords',
        label: '',
        value: 'noway',
        ttl: 0
      })
    })

    it("leont.eth's text records", async () => {
      const records = await ensService.records('leont.eth', ['text.keywords'])
      expect(records).toEqual([
        {
          key: 'text.keywords',
          type: 'text',
          subtype: 'keywords',
          label: '',
          value: 'noway',
          ttl: 0
        }
      ])
    })

    it("leont.eth's addr is valid", async () => {
      const addr = await ensService.addr('leont.eth')
      expect(addr).toEqual({
        key: 'address.ETH',
        label: '',
        subtype: 'ETH',
        symbol: 'ETH',
        ttl: 0,
        type: 'address',
        value: '0xC72B6f66017246d6A7f159F5C2BF358188AD9ECa'
      })
    })

    it("leont.eth's addrs is valid", async () => {
      const addr = await ensService.addrs('leont.eth', 'ETH')
      expect(addr).toEqual([
        {
          key: 'address.ETH',
          label: '',
          subtype: 'ETH',
          symbol: 'ETH',
          ttl: 0,
          type: 'address',
          value: '0xC72B6f66017246d6A7f159F5C2BF358188AD9ECa'
        }
      ])
    })

    it('leont.eth\'s reverse is invalid', async () => {
      const name = await ensService.addrs('0xC72B6f66017246d6A7f159F5C2BF358188AD9ECa')
      expect(name).not.toEqual('leont.eth')
    })

    it('leont.eth\'s registryAddress is valid', async () => {
      const name = await ensService.addrs('leont.eth')
      expect(name).toEqual('0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e')
    })
  })
})
