import ENS, { labelhash } from '@ensdomains/ensjs'
import { ethers, Contract } from 'ethers'
import { Provider, ExternalProvider } from '@ethersproject/providers'
import { NamingService, RecordItem, RecordItemAddr } from './NamingService'
import { abi as RegistrarContract } from '@ensdomains/ens-contracts/artifacts/contracts/ethregistrar/BaseRegistrarImplementation.sol/BaseRegistrarImplementation.json'
import { AllDIDErrorCode } from '../errors/AllDIDError'

export interface EnsServiceOptions {
  provider: Provider | ExternalProvider,
  networkId: string,
}

function getRegistrarContract ({ address, provider }): Contract {
  return new ethers.Contract(address, RegistrarContract, provider)
}

// from https://github.com/Space-ID/sidjs/blob/master/src/index.js#L16
function getEnsAddress (networkId: string): string {
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
  return ''
}

function getRegistrarAddress (networkId: string): string {
  // .bnb bsc testnet
  if ([97].includes(parseInt(networkId))) {
    return '0x888A2BA9787381000Cd93CA4bd23bB113f03C5Af'
  } 
  // ens
  else if ([1, 3, 4, 5].includes(parseInt(networkId))) {
    return '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85'
  }
  // .bnb bsc mainnet
  else if ([56].includes(parseInt(networkId))) {
    return '0xE3b1D32e43Ce8d658368e2CBFF95D57Ef39Be8a6'
  }
  return ''
}

enum KeyPrefix {
  Address= 'address',
  Profile= 'profile',
  Dweb = 'dweb',
  Text = 'text'
} 

export class EnsService extends NamingService {
  serviceName = 'ens'

  ens: ENS
  ensRegistrar: Contract

  emptyAddress = '0x0000000000000000000000000000000000000000'

  constructor (options: EnsServiceOptions) {
    super()
    this.ens = new ENS({
      provider: options.provider,
      ensAddress: getEnsAddress(options.networkId),
    })
    this.ensRegistrar = getRegistrarContract({
      provider: options.provider,
      address: getRegistrarAddress(options.networkId),
    })
  }

  isSupported (name: string): boolean {
    return /^.+\.eth$/.test(name)
  }

  protected getProfileKeys (): string[] {
    return [
      'email',
      'url',
      'avatar',
      'com.discord',
      'com.github',
      'com.twitter',
      'org.telegram',
    ]
  }
  
  protected getAddressKeys (): string[] {
    return ['ETH', 'BTC', 'LTC', 'DOGE']
  }

  async isRegistered (name: string): Promise<boolean> {
    let owner = await this.ens.name(name).getOwner()
    return owner !== this.emptyAddress ? true : false
  }

  async isAvailable (name: string): Promise<boolean> {
    return this.isRegistered(name).then((isRegistered) => !isRegistered)
  }

  async owner (name: string): Promise<string> {
    await this.checkRegistered(name)
    const tokenID = await this.tokenId(name)
    return this.ensRegistrar.ownerOf(tokenID)
  }

  async manager (name: string): Promise<string> {
    await this.checkRegistered(name)
    const address = await this.ens.name(name).getOwner()
    return address
  }

  async tokenId (name: string): Promise<string> {
    const nameArray = name.split('.')
    const label = nameArray[nameArray.length - 2]
    const tokenID: string = labelhash(label).toString()
    return tokenID
  }

  protected makeRecordItem (key: string): RecordItem {
    const keyArray = key.split('.')
    const type = keyArray.length > 1 ? keyArray[0] : ''
    const subtype = keyArray[keyArray.length - 1]
    return {
      key,
      type,
      subtype: subtype.toLowerCase(),
      label: '',
      value: '',
      ttl: 0,
    }
  }

  protected makeRecordKey (subtype: string): string {
    let textKey = subtype.toLowerCase()
    let addressKey = subtype.toUpperCase()
    const key = this.getAddressKeys().find(v => v === addressKey) ? addressKey : this.getProfileKeys().find(v => v === textKey)
    return key ? key : ''
  }

  protected async getText (name: string, subtype: string): Promise<string> {
    const ensName = this.ens.name(name)
    return ensName.getText(subtype)
  }

  protected async getRecord (name: string, type: string, subtype: string): Promise<string> {
    let value
    if (type === 'address') {
      // returns null when address is not set
      const recordItemAddr = await this.addr(name, subtype)
      value = recordItemAddr ? recordItemAddr.value : null
    }
    else {
      value = await this.getText(name, subtype)
    }
    return value
  }

  // key: type.subtype -> 'address.eth','text.email'
  async record (name: string, key: string): Promise<RecordItem | null> {
    await this.checkRegistered(name)
    const recordItem = this.makeRecordItem(key);
    const value = await this.getRecord(name, recordItem.type, recordItem.subtype)
    if (value) {
      recordItem.value = value
      return recordItem
    }
    return null
  }

  async records (name: string, keys?: string[]): Promise<RecordItem[]> {
    await this.checkRegistered(name)
    if (!keys) {
      const profileKeys = this.getProfileKeys().map((key) => `${KeyPrefix.Profile}.${key.toLowerCase()}`)
      const addressKeys = this.getAddressKeys().map((key) => `${KeyPrefix.Address}.${key.toLowerCase()}`)
      keys = profileKeys.concat(addressKeys)
    }
    const requestArray: Array<Promise<RecordItem>> = []
    keys.forEach((key) => requestArray.push(this.record(name, key)))
    const result = await Promise.all<RecordItem>(requestArray)
    return result.filter(v => v)
  }

  async addrs (
    name: string,
    keys?: string | string[]
  ): Promise<RecordItemAddr[]> {
    await this.checkRegistered(name)
    if (!keys) {
      keys = this.getAddressKeys()
    }
    if (Array.isArray(keys)) {
      const requestArray: Promise<RecordItemAddr>[] = []
      keys.forEach((key) => requestArray.push(this.addr(name, key)))
      const records = await Promise.all<RecordItemAddr>(requestArray)
      // filter null
      return records.filter(v => v)
    }
    else {
      const recordAddr = await this.addr(name, keys)
      return recordAddr ? [recordAddr] : []
    }
  }

  async addr (name: string, key: string): Promise<RecordItemAddr | null> {
    await this.checkRegistered(name)
    const recordItem = this.makeRecordItem(`${KeyPrefix.Address}.${key.toLowerCase()}`)
    const addressKey = this.makeRecordKey(key)
    if (addressKey) {
      recordItem.value = await this.ens.name(name).getAddress(addressKey)
    }
    if (recordItem.value && recordItem.value !== this.emptyAddress) {
      return {
        ...recordItem,
        symbol: recordItem.subtype.toUpperCase()
      }
    }
    return null
  }

  async dweb (name: string): Promise<string> {
    await this.checkRegistered(name)
    return this.ens.name(name).getContent()
  }

  async dwebs (name: string, keys?: string | string[]): Promise<string[]> {
    await this.checkRegistered(name)
    const contentHash = await this.dweb(name)
    return [contentHash]
  }

  async reverse (
    address: string,
  ): Promise<string | null> {
    const { name } = await this.ens.getName(address)
    return name
  }

  registryAddress (name: string): Promise<string> {
    return this.ens.ens.address
  }
}
