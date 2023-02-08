import React from 'react' // eslint-disable-line
import { RunTabUI } from '@remix-ui/run-tab'
import { ViewPlugin } from '@remixproject/engine-web'
import { addressToString } from '@remix-ui/helper'
import * as packageJson from '../../../../../package.json'

const EventManager = require('../../lib/events')
const Recorder = require('../tabs/runTab/model/recorder.js')
const _paq = window._paq = window._paq || []

const profile = {
  name: 'udapp',
  displayName: 'Deploy & run transactions',
  icon: 'assets/img/deployAndRun.webp',
  description: 'Execute, save and replay transactions',
  kind: 'udapp',
  location: 'sidePanel',
  documentation: 'https://remix-ide.readthedocs.io/en/latest/run.html',
  version: packageJson.version,
  maintainedBy: 'Remix',
  permission: true,
  events: ['newTransaction'],
  methods: ['createVMAccount', 'sendTransaction', 'getAccounts', 'pendingTransactionsCount', 'getSettings', 'setEnvironmentMode', 'clearAllInstances', 'addInstance', 'resolveContractAndAddInstance']
}

export class RunTab extends ViewPlugin {
  constructor (blockchain, config, fileManager, editor, filePanel, compilersArtefacts, networkModule, fileProvider) {
    super(profile)
    this.event = new EventManager()
    this.config = config
    this.blockchain = blockchain
    this.fileManager = fileManager
    this.editor = editor
    this.filePanel = filePanel
    this.compilersArtefacts = compilersArtefacts
    this.networkModule = networkModule
    this.fileProvider = fileProvider
    this.recorder = new Recorder(blockchain)
    this.REACT_API = {}
    this.setupEvents()
    this.el = document.createElement('div')
  }

  setupEvents () {
    this.blockchain.events.on('newTransaction', (tx, receipt) => {
      this.emit('newTransaction', tx, receipt)
    })
  }

  getSettings () {
    return new Promise((resolve, reject) => {
      resolve({
        selectedAccount: this.REACT_API.accounts.selectedAccount,
        selectedEnvMode: this.REACT_API.selectExEnv,
        networkEnvironment: this.REACT_API.networkName
      })
    })
  }

  async setEnvironmentMode (env) {
    const canCall = await this.askUserPermission('setEnvironmentMode', 'change the environment used')
    if (canCall) {
      env = typeof env === 'string' ? { context: env } : env
      this.emit('setEnvironmentModeReducer', env, this.currentRequest.from)
    }
  }

  clearAllInstances () {
    this.emit('clearAllInstancesReducer')
  }

  addInstance (address, abi, name) {
    this.emit('addInstanceReducer', address, abi, name)
  }

  createVMAccount (newAccount) {
    return this.blockchain.createVMAccount(newAccount)
  }

  sendTransaction (tx) {
    _paq.push(['trackEvent', 'udapp', 'sendTx', 'udappTransaction'])
    return this.blockchain.sendTransaction(tx)
  }

  getAccounts (cb) {
    return this.blockchain.getAccounts(cb)
  }

  pendingTransactionsCount () {
    return this.blockchain.pendingTransactionsCount()
  }

  render () {
    return  <div><RunTabUI plugin={this} /></div>
  }

  onReady (api) {
    this.REACT_API = api
  }

  async onInitDone () {
    const udapp = this // eslint-disable-line

    const addProvider = async (name, displayName, isInjected) => {
      await this.call('blockchain', 'addProvider', {
        name: displayName,
        isInjected,
        init: () => { return this.call(name, 'init') },
        provider: {
          async sendAsync (payload, callback) {
            try {
              const result = await udapp.call(name, 'sendAsync', payload)
              callback(null, result)
            } catch (e) {
              callback(e)
            }
          }
        }
      })
    }

    await addProvider('hardhat-provider', 'Hardhat Provider', false)
    await addProvider('ganache-provider', 'Ganache Provider', false)
    await addProvider('foundry-provider', 'Foundry Provider', false)
    await addProvider('walletconnect', 'Wallet Connect', false)
    await addProvider('basic-http-provider', 'External Http Provider', false)
    
    const displayNameInjected = `Injected Provider${(window && window.ethereum && !(window.ethereum.providers && !window.ethereum.selectedProvider)) ?
      window.ethereum.isCoinbaseWallet || window.ethereum.selectedProvider?.isCoinbaseWallet ? ' - Coinbase' :
      window.ethereum.isBraveWallet || window.ethereum.selectedProvider?.isBraveWallet ? ' - Brave' :
      window.ethereum.isMetaMask || window.ethereum.selectedProvider?.isMetaMask ? ' - MetaMask' : '' : ''}`
    await addProvider('injected', displayNameInjected, true)
    await addProvider('injected-optimism-provider', 'Optimism Provider', true)
    await addProvider('injected-arbitrum-one-provider', 'Arbitrum One Provider', true)    
  }

  writeFile (fileName, content) {
    return this.call('fileManager', 'writeFile', fileName, content)
  }

  readFile (fileName) {
    return this.call('fileManager', 'readFile', fileName)
  }

  resolveContractAndAddInstance (contractObject, address) {
    const data = this.compilersArtefacts.getCompilerAbstract(contractObject.contract.file)

    this.compilersArtefacts.addResolvedContract(addressToString(address), data)
    this.addInstance(address, contractObject.abi, contractObject.name)
  }
}
