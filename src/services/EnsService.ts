import ENS, { labelhash } from '@ensdomains/ensjs'
import { ethers, Contract } from 'ethers'
import { Provider, ExternalProvider } from '@ethersproject/providers'
import { NamingService, RecordItem, RecordItemAddr } from './NamingService'
import { abi as RegistrarContract } from '@ensdomains/ens-contracts/artifacts/contracts/ethregistrar/BaseRegistrarImplementation.sol/BaseRegistrarImplementation.json'

export interface EnsServiceOptions {
  provider: Provider | ExternalProvider
  networkId: string
}

function getRegistrarContract ({ address, provider }) {
  return new ethers.Contract(address, RegistrarContract, provider)
}

// from https://github.com/Space-ID/sidjs/blob/master/src/index.js#L16
function getEnsAddress (networkId: string) {
  // .bnb bsc testnet
  if ([97].includes(parseInt(networkId))) {
    return '0xfFB52185b56603e0fd71De9de4F6f902f05EEA23'
  }
  // ens
  else if ([1, 3, 4, 5].includes(parseInt(networkId))) {
    return '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  }
  // .bnb bsc mainnet
  else if ([56].includes(parseInt(networkId))) {
    return '0x08CEd32a7f3eeC915Ba84415e9C07a7286977956'
  }
}

function getRegistrarAddress (networkId: string) {
  // .bnb bsc testnet

  // ens
  if ([1, 3, 4, 5].includes(parseInt(networkId))) {
    return '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85'
  }
  // .bnb bsc mainnet
}

function getTextRecordKeys () {
  return [
    'email',
    'url',
    'avatar',
    'description',
    'notice',
    'keywords',
    'com.discord',
    'com.github',
    'com.reddit',
    'com.twitter',
    'org.telegram',
    'eth.ens.delegate'
  ]
}

function getAddrRecordKeys () {
  return ['ETH', 'BTC', 'LTC', 'DOGE']
}

export class EnsService extends NamingService {
  serviceName = 'ens'

  ens: ENS
  ensRegisterar: Contract
  constructor (options: EnsServiceOptions) {
    super()
    this.ens = new ENS({
      provider: options.provider,
      ensAddress: getEnsAddress(options.networkId)
    })
    this.ensRegisterar = getRegistrarContract({
      provider: options.provider,
      address: getRegistrarAddress(options.networkId)
    })
  }

  isSupported (name: string): boolean {
    return /^.+\.eth$/.test(name)
  }

  isRegistered (name: string): Promise<boolean> {
    return this.isSupported ? this.owner(name).then(owner => !!owner) : null
  }

  isAvailable (name: string): Promise<boolean> {
    return this.isSupported
      ? this.isRegistered(name).then(isRegistered => !isRegistered)
      : null
  }

  async owner (name: string): Promise<string> {
    if (!this.isSupported(name)) return
    const address = await this.tokenId(name)
    return this.ensRegisterar.ownerOf(address)
  }

  manager (name: string): Promise<string> {
    if (!this.isSupported(name)) return
    return this.ens.name(name).getOwner()
  }

  tokenId (name: string): Promise<string> {
    if (!this.isSupported(name)) return
    const nameArray = name.split('.')
    const label = nameArray[0]
    const tokenID: string = labelhash(label) + ''
    return Promise.resolve(tokenID)
  }

  // key: type.subtype -> 'address.eth','text.email'
  async record (name: string, key: string): Promise<RecordItem> {
    if (!this.isSupported(name)) return
    const ensName = this.ens.name(name)
    let keyArray = key.split('.'),
      type = keyArray.length > 1 ? keyArray[0] : '',
      subtype = keyArray[keyArray.length - 1],
      value
    if (type === 'address') {
      value = await ensName.getAddress(subtype)
    } else {
      value = await ensName.getText(subtype)
    }
    return Promise.resolve({
      key,
      type,
      subtype,
      label: '',
      value,
      ttl: 0
    })
  }

  async records (name: string, keys?: string[]): Promise<RecordItem[]> {
    if (!this.isSupported(name)) return
    if (!keys) keys = getTextRecordKeys().map(key => `text.${key}`)
    const requestArray: Array<Promise<RecordItem>> = []
    keys.forEach(key => requestArray.push(this.record(name, key)))
    // await batchRequest(requestArray, record => recordArray.push(record))
    return Promise.all<RecordItem>(requestArray)
  }

  async addrs (
    name: string,
    keys?: string | string[]
  ): Promise<RecordItemAddr[]> {
    if (!this.isSupported(name)) return
    if (!keys) {
      keys = getAddrRecordKeys()
    }
    if (Array.isArray(keys)) {
      let records = await this.records(
        name,
        keys.map(key => `address.${key}`)
      )
      return records.map(record => ({
        ...record,
        symbol: record.key.split('.')[1].toUpperCase()
      }))
    } else {
      let record = await this.record(name, `address.${keys}`)
      return [{
        ...record,
        symbol: keys.toUpperCase()
      }]
    }
  }

  async addr (name: string): Promise<RecordItemAddr> {
    if (!this.isSupported(name)) return
    let symbol = 'ETH'
    return {
      ...await this.record(name, `address.${symbol}`),
      symbol
    }
  }

  dweb (name: string): Promise<string> {
    if (!this.isSupported(name)) return
    return this.ens.name(name).getContent()
  }

  async dwebs (name: string, keys?: string | string[]): Promise<string[]> {
    let contentHash = await this.dweb(name)
    return [contentHash]
  }

  async reverse (
    address: string,
    currencyTicker: string
  ): Promise<string | null> {
    const name = await this.ens.getName(address)
    if (!this.isSupported(name)) return
    return this.ens.name(name).getAddress(currencyTicker)
  }

  registryAddress (name: string): Promise<string> {
    if (!this.isSupported(name)) return
    return this.ens.ens.address
  }
}
