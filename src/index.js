import { ethers } from 'ethers';
import { Contract as EthCallContract, Provider as EthCallProvider } from 'ethers-multicall';
import { request } from 'graphql-request'

import ADDRESSES_MAINNET from 'changelog/deployment/deployment-mainnet.json';
import ADDRESSES_GOERLI from 'changelog/deployment/deployment-goerli.json';
import METADATA_MAINNET from 'changelog/metadata/metadata-mainnet.json';
import METADATA_GOERLI from 'changelog/metadata/metadata-goerli.json';

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

import {
  SUBGRAPH_URL_MAINNET, SUBGRAPH_URL_GOERLI, queryCollateralTypes, queryUserProxies
} from './queries';

// mute 'duplicate event' abi error
ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR);

const WAD = ethers.utils.parseUnits('1', '18');

// all number values are generally expected as ethers.BigNumber unless they come from the subgraph directly
export class FIAT {

  constructor(signer, provider, chainId) {
    // supported networks: 1 - Mainnet, 5 - Goerli, 1337 - Ganache
    if (![1, 5, 1337].includes(chainId)) throw new Error('Unsupported network');
    // assuming Ganache is running in forked mode (required for ethers-multicall)
    chainId = (chainId === 1337) ? 1 : chainId;

    this.gasMultiplier = 1.3;
    this.signer = signer;
    this.provider = provider;
    this.ethcallProvider = new EthCallProvider(provider, chainId);
    this.subgraphUrl = (chainId === 1) ? SUBGRAPH_URL_MAINNET : SUBGRAPH_URL_GOERLI;
    this.addresses = (chainId === 1) ? ADDRESSES_MAINNET : ADDRESSES_GOERLI;
    this.metadata = (chainId === 1) ? METADATA_MAINNET : METADATA_GOERLI;
  }

  static async fromSigner(signer) {
    return new FIAT(signer, signer.provider, (await signer.provider.getNetwork()).chainId);
  }

  static async fromProvider(provider) {
    let signer;
    try { signer = await provider.getSigner() } catch (error) {}
    return new FIAT(signer, provider, (await provider.getNetwork()).chainId);
  }

  static async fromPrivateKey(web3ProviderUrl, privateKey) {
    const provider = new ethers.providers.JsonRpcProvider(web3ProviderUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    return new FIAT(signer, provider, (await signer.provider.getNetwork()).chainId);
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
    if (fromScale.isZero()) throw new Error('Invalid value for `fromScale` - expected non-zero value');
    return amount.mul(WAD).div(fromScale);
  }

  wadToScale(amount, toScale) {
    return amount.mul(toScale).div(WAD);
  }

  toBytes32(str) {
    return ethers.utils.formatBytes32String(str);
  }

  getMetadata(address) {
    return this.metadata[
      Object.keys(this.metadata).find((_address) => _address.toLowerCase() === address.toLowerCase())
    ];
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
    if (this.signer == undefined) {
      throw new Error(
        '`signer` is unavailable - no `signer` found on `provider` - try via `fromSigner` or `fromPrivateKey` instead.'
      );
    }
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

  async encode(contract, method, ...args) {
    const { contract: _contract, txRequest, txOpts } = this.#buildTx(contract, ...args);
    const gas = await _contract.estimateGas[method](...txRequest, txOpts);
    return await _contract.populateTransaction[method](
      ...txRequest, { ...txOpts, gasLimit: gas.mul(this.gasMultiplier * 100).div(100) }
    );
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

  async query(query, variables) {
    return await request(this.subgraphUrl, query, variables); 
  }

  // collateralTypesFilter: [{ vault: Address, tokenId: Number }]
  async fetchCollateralTypes(collateralTypesFilter) {
    const graphData = await this.query(
      queryCollateralTypes,
      (collateralTypesFilter && collateralTypesFilter.length !== 0)
        ? { 
          where: {
            id_in: collateralTypesFilter.map(({vault, tokenId}) => `${vault.toLowerCase()}-${tokenId.toString()}`) 
          }
        }
        : {}
    );
    return graphData.collateralTypes.map((collateralType) => {
      return {
        properties: {
          vault: collateralType.vault.address,
          vaultType: ethers.utils.parseBytes32String(collateralType.vault.vaultType),
          name: collateralType.vault.name,
          protocol: collateralType.vault.protocol,
          token: collateralType.vault.token,
          tokenId: collateralType.tokenId,
          tokenScale: ethers.BigNumber.from(collateralType.vault.tokenScale),
          tokenSymbol: collateralType.vault.tokenSymbol,
          underlierToken: collateralType.vault.underlier,
          underlierScale: ethers.BigNumber.from(collateralType.vault.underlierScale),
          underlierSymbol: collateralType.vault.underlierSymbol,
          maturity: ethers.BigNumber.from(collateralType.maturity),
          eptData: collateralType.eptData,
          fcData: collateralType.fcData,
          fyData: collateralType.fyData,
        },
        metadata: this.getMetadata(collateralType.vault.address),
        settings: {
          codex: {
            debtCeiling: ethers.BigNumber.from(collateralType.vault.debtCeiling),
            debtFloor: ethers.BigNumber.from(collateralType.vault.debtFloor)
          },
          collybus: {
            liquidationRatio: ethers.BigNumber.from(collateralType.vault.liquidationRatio),
            defaultRateId: ethers.BigNumber.from(collateralType.vault.defaultRateId)
          },
          limes: {
            liquidationPenalty: ethers.BigNumber.from(collateralType.vault.liquidationPenalty),
            collateralAuction: collateralType.vault.limesCollateralAuction,
            maxDebtOnAuction: ethers.BigNumber.from(collateralType.vault.maxDebtOnAuction)
          },
          collateralAuction: {
            multiplier: ethers.BigNumber.from(collateralType.vault.multiplier),
            maxAuctionDuration: ethers.BigNumber.from(collateralType.vault.maxAuctionDuration),
            auctionDebtFloor: ethers.BigNumber.from(collateralType.vault.auctionDebtFloor),
            collybus: collateralType.vault.collateralAuctionCollybus,
            calculator: collateralType.vault.collateralAUctionCalculator
          }
        },
        state: {
          codex: {
            totalNormalDebt: ethers.BigNumber.from(collateralType.vault.totalNormalDebt),
            rate: ethers.BigNumber.from(collateralType.vault.rate)
          },
          limes: {
            debtOnAuction: collateralType.vault.debtOnAuction
          },
          publican: {
            interestPerSecond: collateralType.vault.interestPerSecond,
            lastCollected: collateralType.vault.lastCollected
          },
          collybus: {
            rateId: (collateralType.discountRate) ? ethers.BigNumber.from(collateralType.discountRate.rateId) : null,
            discountRate: (collateralType.discountRate) ? ethers.BigNumber.from(collateralType.discountRate.discountRate) : null,
          }
        }
      };
    });
  }

  // collateralTypesFilter: [{ vault: Address, tokenId: Number }]
  async fetchCollateralTypesAndPrices(collateralTypesFilter) {
    const collateralTypes = (collateralTypesFilter && collateralTypesFilter.length)
      ? collateralTypesFilter
      : Object.keys(this.metadata).reduce((collateralTypes_, vault) => (
        [ ...collateralTypes_, ...this.metadata[vault].tokenIds.map((tokenId) => ({ vault, tokenId })) ]
      ), []);

    const contracts = this.getContracts();
    const [priceData, collateralTypesData] = await Promise.all([
      this.multicall(collateralTypes.reduce((calls, { vault, tokenId }) => (
        [
          ...calls,
          { contract: this.getVaultContract(vault), method: 'fairPrice', args: [tokenId, false, false] },
          { contract: this.getVaultContract(vault), method: 'fairPrice', args: [tokenId, true, false] },
          { contract: this.getVaultContract(vault), method: 'fairPrice', args: [tokenId, false, true] },
          { contract: contracts.publican, method: 'virtualRate', args: [vault] }
        ]
      ), [])),
      this.fetchCollateralTypes(collateralTypesFilter)
    ]);
    
    function getPrices(vault_, tokenId_) {
      const index = collateralTypes.findIndex(({ vault, tokenId }) => (
        vault.toLowerCase() === vault_.toLowerCase() && tokenId.toString() === tokenId_.toString()
      )) * 4;
      return {
        fairPrice: priceData[index],
        liquidationPrice: priceData[index + 1],
        faceValue: priceData[index + 2],
        virtualRate: priceData[index + 3]
      };
    }

    return collateralTypesData.map((collateralTypeData) => {
      const prices = getPrices(collateralTypeData.properties.vault, collateralTypeData.properties.tokenId);
      return {
        ...collateralTypeData,
        state: {
          ...collateralTypeData.state,
          codex: {
            ...collateralTypeData.state.codex,
            virtualRate: prices.virtualRate
          },
          collybus: {
            ...collateralTypeData.state.collybus,
            fairPrice: prices.fairPrice,
            liquidationPrice: prices.liquidationPrice,
            faceValue: prices.faceValue
          }
        } 
      };
    });
  }

  async fetchPositions(address) {
    const graphData = await Promise.all([
      this.query(queryUserProxies, { where: { owner: address.toLowerCase() } }),
      this.query(queryUserProxies, { where: { proxy: address.toLowerCase() } })
    ]);
    const positions = [...graphData[0].userProxies, ...graphData[1].userProxies].reduce((positions_, user) => (
      [ ...positions_, ...user.user.positions.reduce((positions__, position) => ([...positions__, position]), []) ]
    ), []);

    return positions.map((position) => ({
      owner: position.owner,
      vault: position.collateralType.vault.address,
      tokenId: ethers.BigNumber.from(position.collateralType.tokenId),
      collateral: ethers.BigNumber.from(position.collateral),
      normalDebt: ethers.BigNumber.from(position.normalDebt)
    }));
  }

  async fetchPosition(vault, tokenId, owner) {
    const { codex } = this.getContracts();
    const position = await this.call(codex, 'positions', vault, tokenId, owner);
    return {
      collateral: position.collateral,
      normalDebt: position.normalDebt,
    };
  }

  // collateral in WAD 
  computeHealthFactor(collateral, normalDebt, rate, liquidationPrice) {
    if (collateral.isZero()) return ethers.BigNumber.from(0);
    const debt = this.normalDebtToDebt(normalDebt, rate);
    if (debt.isZero()) return ethers.BigNumber.from(ethers.constants.MaxUint256);
    return collateral.mul(liquidationPrice).div(debt);
  }

  // collateral in WAD 
  computeMaxNormalDebt(collateral, healthFactor, rate, liquidationPrice) {
    if (healthFactor.isZero()) throw new Error('Invalid value for `healthFactor` - expected non-zero value');
    if (rate.isZero()) throw new Error('Invalid value for `rate` - expected non-zero value');
    return this.debtToNormalDebt(collateral.mul(liquidationPrice).div(healthFactor), rate);
  }

  computeMinCollateral(healthFactor, normalDebt, rate, liquidationPrice) {
    if (liquidationPrice.isZero()) throw new Error('Invalid value for `liquidationPrice` - expected non-zero value');
    const debt = this.normalDebtToDebt(normalDebt, rate);
    return healthFactor.mul(debt).div(liquidationPrice);
  }

  normalDebtToDebt(normalDebt, rate) {
    return normalDebt.mul(rate).div(WAD);
  }

  debtToNormalDebt(debt, rate) {
    if (rate.isZero()) throw new Error('Invalid value for `rate` - expected non-zero value');
    let normalDebt = debt.mul(WAD).div(rate);
    // avoid potential rounding error when converting back to debt from normalDebt
    if (normalDebt.mul(rate).div(WAD).lt(debt)) {
      normalDebt = normalDebt.add(1);
    }
    return normalDebt;
  }
}
