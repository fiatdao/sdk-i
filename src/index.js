import { ethers } from 'ethers';
import { Contract, Provider } from 'ethers-multicall';

import MAINNET from 'changelog/deployment/deployment-mainnet.json';
import GOERLI from 'changelog/deployment/deployment-goerli.json';

import Aer from 'changelog/abis/Aer.sol/Aer.json';
import Codex from 'changelog/abis/Codex.sol/Codex.json';
import Collybus from 'changelog/abis/Collybus.sol/Collybus.json';
import ERC20 from 'changelog/abis/ERC20.sol/ERC20.json';
import ERC1155 from 'changelog/abis/ERC1155.sol/ERC1155.json';
import FIATToken from 'changelog/abis/FIAT.sol/FIAT.json';
import Flash from 'changelog/abis/Flash.sol/Flash.json';
import Limes from 'changelog/abis/Limes.sol/Limes.json';
import IVault from 'changelog/abis/IVault.sol/IVault.json';
import Moneta from 'changelog/abis/Moneta.sol/Moneta.json';
import NoLossCollateralAuction from 'changelog/abis/NoLossCollateralAuction.sol/NoLossCollateralAuction.json';
import PRBProxy from 'changelog/abis/PRBProxy.sol/PRBProxy.json';
import Publican from 'changelog/abis/Publican.sol/Publican.json';

const { parseUnits: toUnit,  formatBytes32String: toBytes32 } = ethers.utils;
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

const GAS_MULTIPLIER = 1.3;
const WAD = ethers.utils.parseUnits('1', '18');

export class FIAT {

  constructor(signer, provider, subgraphUrl, chainId) {
    this.signer = signer;
    this.provider = provider;
    this.subgraphUrl = subgraphUrl;
    this.addresses = (chainId === 1) ? MAINNET : (chainId === 5) ? GOERLI : null;
    if (this.addresses === null) throw new Error('Unsupported Network');

    this.ethcallProvider = new Provider(provider, chainId);
  }

  static async fromSigner(signer, subgraphUrl) {
    return new FIAT(signer, signer.provider, subgraphUrl, (await signer.provider.getNetwork()).chainId);
  }

  static async fromPrivateKey(web3ProviderUrl, privateKey, subgraphUrl) {
    const provider = new ethers.providers.JsonRpcProvider(web3ProviderUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    return new FIAT(signer, provider, subgraphUrl, (await signer.provider.getNetwork()).chainId);
  }

  toWad(decimal) {
    return toUnit(decimal, '18');
  }

  fromWad(wad) {
    return fromUnit(wad, '18');
  }

  toBytes32(str) {
    return toBytes32(str);
  }

  #getContract(artifact, address) {
    const contract = new ethers.ContractFactory(artifact.abi, artifact.bytecode, this.signer).attach(address);
    contract.abi = artifact.abi;
    return contract;
  }

  getContracts() {
    return {
      aer: this.#getContract(Aer, this.addresses['aer'].address),
      codex: this.#getContract(Codex, this.addresses['codex'].address),
      limes: this.#getContract(Limes, this.addresses['limes'].address),
      moneta: this.#getContract(Moneta, this.addresses['moneta'].address),
      publican: this.#getContract(Publican, this.addresses['publican'].address),
      fiat: this.#getContract(FIATToken, this.addresses['fiat'].address),
      collybus: this.#getContract(Collybus, this.addresses['collybus'].address),
      flash: this.#getContract(Flash, this.addresses['flash'].address),
      noLossCollateralAuction: this.#getContract(NoLossCollateralAuction, this.addresses['collateralAuction'].address)
    }
  }

  getVaultContract(address) {
    return this.#getContract(IVault, address);
  }

  getProxyContract(address) {
    return this.#getContract(PRBProxy, address);
  }

  getERC20Contract(address) {
    return this.#getContract(ERC20, address);
  }

  getERC1155Contract(address) {
    return this.#getContract(ERC1155, address);
  }

  encode4Byte(contract, method) {
    return ethers.utils.defaultAbiCoder.encode(['bytes4'], [contract.interface.getSighash(method)]);
  }

  async call(contract, method, ...args) {
    return await contract[method](...args);
  }

  async multicall(calls) {
    const multicall = calls.map(({ contract, method, args }) => {
      return (new Contract(contract.address, contract.abi))[method](...args);
    });
    return await this.ethcallProvider.all(multicall);
  }

  #buildTx(contract, ...args) {
    const txRequest = [ ...args ];
    const txOpts = txRequest[txRequest.length - 1];
    if (txOpts && Object.getPrototypeOf(txOpts) === Object.prototype) {
      if (txOpts.from) contract = contract.connect(new ethers.VoidSigner(txOpts.from, this.provider));
      delete txRequest.splice([txRequest.length - 1], 1);
    } else {
      txOpts = {};
    }
    return  { contract, txRequest, txOpts };
  }

  async send(contract, method, ...args) {
    const { _contract, txRequest, txOpts } = this.buildTx(contract, ...args);
    return await _contract[method](
      ...txRequest, { ...txOpts, gasLimit: gas.mul(GAS_MULTIPLIER * 100).div(100), ...feeData }
    );
  }

  async sendAndWait(contract, method, ...args) {
    return await send(contract, method, ...args).wait();
  }

  async encodeTx(contract, method, ...args) {
    const { _contract, txRequest, txOpts } = this.#buildTx(contract, ...args);
    const gas = await _contract.estimateGas[method](...txRequest, txOpts);
    return await _contract.populateTransaction[method](
      ...txRequest, { ...txOpts, gasLimit: gas.mul(GAS_MULTIPLIER * 100).div(100), ...feeData }
    );
  }

  async fetchAll() {}

  async fetchVaultData(address) {
    const { codex, collybus, limes, noLossCollateralAuction, publican } = this.getContracts();
    const vaultContract = this.getVaultContract(address);
    return await this.multicall([
      { contract: codex, method: 'vaults', args: [address] },
      { contract: collybus, method: 'vaults', args: [address] },
      { contract: limes, method: 'vaults', args: [address] },
      { contract: noLossCollateralAuction, method: 'vaults', args: [address] },
      { contract: publican, method: 'vaults', args: [address] },
      { contract: vaultContract, method: 'maturity', args: ['0'] },
      { contract: vaultContract, method: 'token', args: [] },
      { contract: vaultContract, method: 'tokenScale', args: [] },
      { contract: vaultContract, method: 'underlierToken', args: [] },
      { contract: vaultContract, method: 'underlierScale', args: [] },
      { contract: vaultContract, method: 'fairPrice', args: [0, true, false] }
    ]);
  }

  async fetchPositionData(vault, tokenId, owner) {
    const { codex } = this.getContracts();
    return await this.call(codex, 'positions', vault, tokenId, owner);
  }

  async healthFactor(collateral, normalDebt, rate, fairPrice, liquidationRatio) {
    const debt = normalDebt.mul(rate).div(WAD);
    if (debt.isZero()) return ethers.BigNumber(100);
    if (!collateral.isZero()) collateral.mul(fairPrice).div(debt).div(liquidationRatio);
    return ethers.BigNumber(0);
  }
}
