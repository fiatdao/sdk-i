import { ethers } from 'ethers';
import { Contract as EthCallContract, Provider as EthCallProvider } from 'ethers-multicall';
import { request } from 'graphql-request'

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
import VaultEPTActions from 'changelog/abis/VaultEPTActions.sol/VaultEPTActions.json';
import VaultFCActions from 'changelog/abis/VaultFCActions.sol/VaultFCActions.json';
import VaultFYActions from 'changelog/abis/VaultFYActions.sol/VaultFYActions.json';

import { queryVault } from './queries';

// mute 'duplicate event' abi error
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

const WAD = ethers.utils.parseUnits('1', '18');

export class FIAT {

  constructor(signer, provider, subgraphUrl, chainId) {
    this.gasMultiplier = 1.3;
    this.signer = signer;
    this.provider = provider;
    // workaround for selecting the right address for Ganache in ethers-multicall
    this.ethcallProvider = new EthCallProvider(provider, (chainId === 1337) ? 1 : chainId);
    this.subgraphUrl = subgraphUrl;
    // 1 - Mainnet, 1337 - Ganache, 5 - Goerli
    this.addresses = (chainId === 1 || chainId === 1337) ? MAINNET : (chainId === 5) ? GOERLI : null;
    if (this.addresses === null) throw new Error('Unsupported Network');
  }

  static async fromProvider(provider, subgraphUrl) {
    return new FIAT(await provider.getSigner(), provider, subgraphUrl, (await provider.getNetwork()).chainId);
  }

  static async fromPrivateKey(web3ProviderUrl, privateKey, subgraphUrl) {
    const provider = new ethers.providers.JsonRpcProvider(web3ProviderUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    return new FIAT(signer, provider, subgraphUrl, (await signer.provider.getNetwork()).chainId);
  }

  setGasMultiplier(multiplier) {
    this.gasMultiplier = multiplier;
  }

  decToWad(decimal) {
    return ethers.utils.parseEther(decimal);
  }

  wadToDec(wad) {
    return ethers.utils.formatEther(wad);
  }

  scaleToWad(amount, fromScale) {
    if (fromScale.isZero()) return ethers.BigNumber.from(0);
    return amount.mul(WAD).div(fromScale);
  }

  wadToScale(amount, toScale) {
    return amount.mul(toScale).div(WAD);
  }

  toBytes32(str) {
    return ethers.utils.formatBytes32String(str);
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
      noLossCollateralAuction: this.#getContract(NoLossCollateralAuction, this.addresses['collateralAuction'].address),
      vaultEPTActions: this.#getContract(VaultEPTActions, this.addresses['vaultEPTActions'].address),
      vaultFCActions: this.#getContract(VaultFCActions, this.addresses['vaultFCActions'].address),
      vaultFYActions: this.#getContract(VaultFYActions, this.addresses['vaultFYActions'].address)
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
      return (new EthCallContract(contract.address, contract.abi))[method](...args);
    });
    return await this.ethcallProvider.all(multicall);
  }

  #buildTx(contract, ...args) {
    const txRequest = [ ...args ];
    let txOpts = txRequest[txRequest.length - 1];
    if (txOpts && Object.getPrototypeOf(txOpts) === Object.prototype) {
      if (txOpts.from) contract = contract.connect(new ethers.VoidSigner(txOpts.from, this.provider));
      delete txRequest.splice([txRequest.length - 1], 1);
    } else {
      txOpts = {};
    }
    return  { contract, txRequest, txOpts };
  }

  async send(contract, method, ...args) {
    const { contract: _contract, txRequest, txOpts } = this.#buildTx(contract, ...args);
    const gas = await _contract.estimateGas[method](...txRequest, txOpts);
    return await _contract[method](
      ...txRequest, { ...txOpts, gasLimit: gas.mul(this.gasMultiplier * 100).div(100) }
    );
  }

  async sendAndWait(contract, method, ...args) {
    return await (await this.send(contract, method, ...args)).wait();
  }

  async sendViaProxy(proxyAddress, targetContract, method, ...args) {
    const { contract, txRequest, txOpts } = this.#buildTx(targetContract, ...args);
    return await this.send(
      this.getProxyContract(proxyAddress),
      'execute',
      contract.address,
      contract.interface.encodeFunctionData(method, [...txRequest]),
      txOpts
    );
  }

  async sendAndWaitViaProxy(proxyAddress, targetContract, method, ...args) {
    return await (await this.sendViaProxy(proxyAddress, targetContract, method, ...args)).wait();
  }

  async dryrun(contract, method, ...args) {
    const { contract: _contract, txRequest, txOpts } = this.#buildTx(contract, ...args);
    try {
      const gas = await _contract.estimateGas[method](...txRequest, txOpts);
      return { success: true, gas }
    } catch (error) {
      let reason;
      let customError;
      let data;
      // Ganache response format
      if (error && error.data && error.data.result) {
        reason = error.data.reason || '';
        data = error.data.result;
      // Alchemy response format
      } else if (error && error.error && error.error.error && error.error.error.data) {
        reason = error.reason;
        data = error.error.error.data;
      // Tenderly response format
      } else if (error && error.reason) {
        reason = error.reason;
      }
      if (data != undefined) {
        try {
          customError = (await ethers.utils.fetchJson(
            `https://www.4byte.directory/api/v1/signatures/?hex_signature=${data.slice(0, 10)}`
          )).results[0].text_signature;
        } catch (error) {}
      }
      return { success: false, reason, customError }
    }
  }

  async dryrunViaProxy(proxyAddress, targetContract, method, ...args) {
    const { contract, txRequest, txOpts } = this.#buildTx(targetContract, ...args);
    return await this.dryrun(
      this.getProxyContract(proxyAddress),
      'execute',
      contract.address,
      contract.interface.encodeFunctionData(method, [...txRequest]),
      txOpts
    );
  }

  async encodeTx(contract, method, ...args) {
    const { contract: _contract, txRequest, txOpts } = this.#buildTx(contract, ...args);
    const gas = await _contract.estimateGas[method](...txRequest, txOpts);
    return await _contract.populateTransaction[method](
      ...txRequest, { ...txOpts, gasLimit: gas.mul(this.gasMultiplier * 100).div(100), ...feeData }
    );
  }

  async query(query, variables) {
    return await request(this.subgraphUrl, query, variables); 
  }

  async fetchVaultData(address) {
    const { codex, collybus, limes, noLossCollateralAuction, publican } = this.getContracts();
    const vaultContract = this.getVaultContract(address);
    const [multicallData, graphData] = await Promise.all([
      this.multicall([
        { contract: codex, method: 'vaults', args: [address] },
        { contract: collybus, method: 'vaults', args: [address] },
        { contract: limes, method: 'vaults', args: [address] },
        { contract: noLossCollateralAuction, method: 'vaults', args: [address] },
        { contract: publican, method: 'vaults', args: [address] },
        { contract: vaultContract, method: 'vaultType', args: [] },
        { contract: vaultContract, method: 'token', args: [] },
        { contract: vaultContract, method: 'tokenScale', args: [] },
        { contract: vaultContract, method: 'underlierToken', args: [] },
        { contract: vaultContract, method: 'underlierScale', args: [] },
        { contract: vaultContract, method: 'fairPrice', args: [0, false, false] },
        { contract: vaultContract, method: 'fairPrice', args: [0, true, false] },
        { contract: vaultContract, method: 'fairPrice', args: [0, false, true] }
      ]),
      this.query(queryVault, { id: address })
    ]);
    return {
      properties: {
        name: graphData.vault.name,
        vaultType: multicallData[5],
        token: multicallData[6],
        tokenScale: multicallData[7],
        tokenSymbol: graphData.vault.collateralTypes[0].symbol,
        underlierToken: multicallData[8],
        underlierScale: multicallData[9],
        underlierSymbol: graphData.vault.collateralTypes[0].underlierSymbol,
        tokenIds: graphData.vault.collateralTypes.map(
          ({ tokenId, maturity, eptData, fcData, fyData }) => ({ tokenId, maturity, ...eptData, ...fcData, ...fyData })
        )
      },
      settings: {
        codex: {
          debtCeiling: multicallData[0].debtCeiling,
          debtFloor: multicallData[0].debtFloor
        },
        collybus: {
          liquidationRatio: multicallData[1].liquidationRatio,
          defaultRateId: multicallData[1].defaultRateId
        },
        limes: {
          liquidationPenalty: multicallData[2].liquidationPenalty,
          collateralAuction: multicallData[2].collateralAuction
        },
        collateralAuction: {
          multiplier: multicallData[3].multiplier,
          maxDebtOnAuction: multicallData[2].maxDebtOnAuction,
          maxAuctionDuration: multicallData[3].maxAuctionDuration,
          auctionDebtFloor: multicallData[3].auctionDebtFloor,
          collybus: multicallData[3].collybus,
          calculator: multicallData[3].calculator
        }
      },
      state: {
        codex: {
          totalNormalDebt: multicallData[0].totalNormalDebt,
          rate: multicallData[0].rate
        },
        limes: {
          debtOnAuction: multicallData[2].debtOnAuction
        },
        publican: {
          interestPerSecond: multicallData[4].interestPerSecond,
          lastCollected: multicallData[4].lastCollected
        },
        fairPrice: multicallData[10],
        liquidationPrice: multicallData[11],
        faceValue: multicallData[12],
      }
    }
  }

  async fetchPositionData(vault, tokenId, owner) {
    const { codex } = this.getContracts();
    const positionData = await this.call(codex, 'positions', vault, tokenId, owner);
    return {
      collateral: positionData.collateral,
      normalDebt: positionData.normalDebt,
    };
  }

  // collateral in WAD 
  computeHealthFactor(collateral, normalDebt, rate, liquidationPrice) {
    const debt = this.normalDebtToDebt(normalDebt, rate);
    if (debt.isZero()) return ethers.BigNumber.from(ethers.constants.MaxUint256);
    if (collateral.isZero()) return ethers.BigNumber.from(0);
    return collateral.mul(liquidationPrice).div(debt);
  }

  // collateral in WAD 
  computeMaxNormalDebt(collateral, healthFactor, rate, liquidationPrice) {
    if (healthFactor.isZero() || rate.isZero()) return ethers.BigNumber.from(0);
    return this.debtToNormalDebt(collateral.mul(liquidationPrice).div(healthFactor), rate);
  }

  computeMinCollateral(healthFactor, normalDebt, rate, liquidationPrice) {
    const debt = this.normalDebtToDebt(normalDebt, rate);
    if (debt.isZero()) return ethers.BigNumber.from(ethers.constants.MaxUint256);
    if (liquidationPrice.isZero()) return ethers.BigNumber.from(0);
    return healthFactor.mul(debt).div(liquidationPrice);
  }

  normalDebtToDebt(normalDebt, rate) {
    return normalDebt.mul(rate).div(WAD);
  }

  debtToNormalDebt(debt, rate) {
    if (rate.isZero()) return ethers.BigNumber.from(0);
    let normalDebt = debt.mul(WAD).div(rate);
    // avoid potential rounding error when converting back to debt from normalDebt
    if (normalDebt.mul(rate).div(WAD).lt(debt)) {
      normalDebt = normalDebt.add(1);
    }
    return normalDebt;
  }
}
