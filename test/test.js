const ethers = require('ethers');
const ganache = require('ganache');

const { FIAT } = require('../lib/index');
const { queryPositions } = require('../lib/queries');

const MAINNET = require('changelog/deployment/deployment-mainnet.json');

jest.setTimeout(10000);

// Tests run on mainnet state at block height 15711690
describe('FIAT', () => {

  const defaultAccount = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH contract
  const proxyOwner = '0xCE91783D36925bCc121D0C63376A248a2851982A'; // owner of `proxy`
  const proxy = '0x89afBc32Ad881014DB72089BbF3535aF04b8d929';
  
  let server;
  let provider;

  let fiat;
  let contracts;
  let vaultData;
  let positionData;
  let healthFactor;
  
  beforeAll(async () => {
    const options = {
      fork: { url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`, blockNumber: 15711690 },
      miner: { defaultGasPrice: 30000000000 },
      wallet: { unlockedAccounts: [defaultAccount, proxyOwner] },
      logging: { quiet: true }
    };
    server = ganache.server(options);
    await server.listen(8545);
    provider = new ethers.providers.Web3Provider(server.provider);
  });

  afterAll(async () => {
    await server.close();
  });

  test('fromSigner', async () => {
    fiat = await FIAT.fromProvider(provider, 'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph');
    expect(fiat != undefined).toBe(true);
  });

  test('fromPrivateKey', async () => {
    const fiat_ = await FIAT.fromPrivateKey(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      '000000000000000000000000000000000000000000000000000000000000000A',
      'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph'
    );
    expect(fiat_ != undefined).toBe(true);
  });

  test('getContracts', () => {
    contracts = fiat.getContracts();
    expect(Object.values(contracts).length).toBeGreaterThan(0);
  });

  test('call', async () => {
    expect((await fiat.call(contracts.codex, 'globalDebt')).gt(0)).toBe(true);
  });

  test('multicall', async () => {
    const results = await fiat.multicall([
      { contract: contracts.codex, method: 'globalDebt', args: [] },
      { contract: contracts.codex, method: 'globalUnbackedDebt', args: [] },
      { contract: contracts.codex, method: 'globalDebtCeiling', args: [] },
      { contract: contracts.codex, method: 'vaults', args: [MAINNET.vaultEPT_ePyvDAI_24FEB23.address] }
    ]);
    expect(results.length).toBe(4);
    expect(results[0].gt(0)).toBe(true);
    expect(results[2].gt(0)).toBe(true);
  });

  test('encode', async () => {
    await fiat.encode(
      contracts.publican,
      'collect',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address
    );
    await fiat.encode(
      contracts.publican,
      'collect',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { maxFeePerGas: '65000000000', maxPriorityFeePerGas: '1500000001'}
    );
  });

  test('send', async () => {
    await fiat.send(
      contracts.publican,
      'collect',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address
    );
    await fiat.send(
      contracts.publican,
      'collect',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { maxFeePerGas: '65000000000', maxPriorityFeePerGas: '1500000001'}
    );
  });

  // Ganache returns stale data 
  test.skip('sendViaProxy', async () => {
    await fiat.sendViaProxy(
      proxy,
      contracts.publican,
      'collect',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { from: proxyOwner }
    );
  });

  test('sendAndWait', async () => {
    await fiat.sendAndWait(
      contracts.publican,
      'collect',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address
    );
  });

  // Ganache returns stale data 
  test.skip('sendAndWaitViaProxy', async () => {
    await fiat.sendAndWaitViaProxy(
      proxy,
      contracts.publican,
      'collect',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { from: proxyOwner }
    );
  });

  test('dryrun', async () => {
    const vault = fiat.getVaultContract(MAINNET.vaultEPT_ePyvDAI_24FEB23.address);

    const resultSuccess = await fiat.dryrun(contracts.publican, 'collect', vault.address);
    expect(resultSuccess.success).toBe(true);

    const resultError = await fiat.dryrun(vault, 'enter', 0, await fiat.signer.getAddress(), '1000');
    expect(resultError.success).toBe(false);
    expect(resultError.reason.includes('ERC20: insufficient-balance')).toBe(true);
    expect(resultError.customError).toBe('Error(string)'); // note: `data` field is not returned by tenderly
  });

  test('dryrunViaProxy', async () => {
    const vault = fiat.getVaultContract(MAINNET.vaultEPT_ePyvDAI_24FEB23.address);

    // Ganache returns stale data 
    // const resultSuccess = await fiat.dryrunViaProxy(
    //   proxy, contracts.publican, 'collect', vault.address, { from: proxyOwner }
    // );
    // expect(resultSuccess.success).toBe(true);
    
    const resultError = await fiat.dryrunViaProxy(
      proxy, vault, 'enter', 0, await fiat.signer.getAddress(), '1000', { from: proxyOwner }
    );
    expect(resultError.success).toBe(false);
    expect(resultError.reason != undefined).toBe(true);
    // expect(resultError.customError).toBe('Error(string)'); // Ganache returns stale data
  });

  test('fetchVaultData', async () => {
    vaultData = await fiat.fetchVaultData(MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase());
    expect(vaultData.properties.name).toBe('VaultEPT_ePyvDAI_24FEB23');
    expect(vaultData.settings.codex.debtCeiling.gt(0)).toBe(true);
  });

  test('fetchPositionData', async () => {
    positionData = await fiat.fetchPositionData(
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address, 0, '0x9763B704F3fd8d70914D2d1293Da4B7c1A38702c'
    );
    expect(positionData.collateral.gt(0)).toBe(true);
    expect(positionData.normalDebt.gt(0)).toBe(true);
  });

  test('computeHealthFactor', async () => {
    healthFactor = fiat.computeHealthFactor(
      positionData.collateral, positionData.normalDebt, vaultData.state.codex.rate, vaultData.state.liquidationPrice
    );
    expect(fiat.wadToDec(healthFactor) > 1.0).toBe(true);
  });

  test('computeMaxNormalDebt', async () => {
    const normalDebt = fiat.computeMaxNormalDebt(
      positionData.collateral, healthFactor, vaultData.state.codex.rate, vaultData.state.liquidationPrice
    );
    expect(normalDebt.div(1e8).eq(positionData.normalDebt.div(1e8))).toBe(true);
  });

  test('computeMinCollateral', async () => {
    const collateral = fiat.computeMinCollateral(
      healthFactor, positionData.normalDebt, vaultData.state.codex.rate, vaultData.state.liquidationPrice
    );
    expect(collateral.div(1e8).eq(positionData.collateral.div(1e8))).toBe(true);
  });

  test('normalDebtToDebt', async () => {
    const debt = fiat.normalDebtToDebt(positionData.normalDebt, vaultData.state.codex.rate);
    expect(debt.gt(positionData.normalDebt)).toBe(true);
  });

  test('debtToNormalDebt', async () => {
    const debt = fiat.normalDebtToDebt(positionData.normalDebt, vaultData.state.codex.rate);
    const normalDebt = fiat.debtToNormalDebt(debt, vaultData.state.codex.rate);
    expect(normalDebt.eq(positionData.normalDebt)).toBe(true);
  });

  test('query', async () => {
    const result = await fiat.query(queryPositions, { where: { owner: '0x9763B704F3fd8d70914D2d1293Da4B7c1A38702c' } });
    expect(result.positions[0].vaultName).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('underlierToPToken', async () => {
    const pToken = await fiat.call(
      contracts.vaultEPTActions,
      'underlierToPToken',
      MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      vaultData.properties.tokenIds[0].balancerVault,
      vaultData.properties.tokenIds[0].poolId,
      fiat.decToWad('100')
    );
    expect(pToken.gt(fiat.decToWad('100'))).toBe(true);
  });
});
