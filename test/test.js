const ethers = require('ethers');
const ganache = require('ganache');

const { FIAT } = require('../lib/index');
const {
  queryVault, queryVaults, queryCollateralType, queryCollateralTypes,
  queryPosition, queryPositions, queryTransaction, queryTransactions,
  queryUser, queryUsers, queryUserProxy, queryUserProxies
} = require('../lib/queries');

const ADDRESSES_MAINNET = require('changelog/deployment/deployment-mainnet.json');

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
  let collateralTypeData;
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
    fiat = await FIAT.fromSigner(await provider.getSigner());
    expect(fiat != undefined).toBe(true);
  });

  test('fromProvider', async () => {
    const fiat_ = await FIAT.fromProvider(provider);
    expect(fiat_ != undefined).toBe(true);
  });

  test('fromPrivateKey', async () => {
    const fiat_ = await FIAT.fromPrivateKey(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      '000000000000000000000000000000000000000000000000000000000000000A'
    );
    expect(fiat_ != undefined).toBe(true);
  });

  test('getMetadata', () => {
    const metadata = fiat.getMetadata(ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address);
    expect(Object.values(metadata).length).toBeGreaterThan(0);
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
      { contract: contracts.codex, method: 'vaults', args: [ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address] }
    ]);
    expect(results.length).toBe(4);
    expect(results[0].gt(0)).toBe(true);
    expect(results[2].gt(0)).toBe(true);
  });

  test('encode', async () => {
    await fiat.encode(
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address
    );
    await fiat.encode(
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { maxFeePerGas: '65000000000', maxPriorityFeePerGas: '1500000001'}
    );
  });

  test('send', async () => {
    await fiat.send(
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address
    );
    await fiat.send(
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { maxFeePerGas: '65000000000', maxPriorityFeePerGas: '1500000001'}
    );
  });

  // Ganache returns stale data 
  test.skip('sendViaProxy', async () => {
    await fiat.sendViaProxy(
      proxy,
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { from: proxyOwner }
    );
  });

  test('sendAndWait', async () => {
    await fiat.sendAndWait(
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address
    );
  });

  // Ganache returns stale data 
  test.skip('sendAndWaitViaProxy', async () => {
    await fiat.sendAndWaitViaProxy(
      proxy,
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { from: proxyOwner }
    );
  });

  test('dryrun', async () => {
    const vault = fiat.getVaultContract(ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address);

    const resultSuccess = await fiat.dryrun(contracts.publican, 'collect', vault.address);
    expect(resultSuccess.success).toBe(true);

    const resultError = await fiat.dryrun(vault, 'enter', 0, await fiat.signer.getAddress(), '1000');
    expect(resultError.success).toBe(false);
    expect(resultError.reason.includes('ERC20: insufficient-balance')).toBe(true);
    expect(resultError.customError).toBe('Error(string)'); // note: `data` field is not returned by tenderly
  });

  test('dryrunViaProxy', async () => {
    const vault = fiat.getVaultContract(ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address);

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

  test('fetchCollateralTypeData', async () => {
    collateralTypeData = await fiat.fetchCollateralTypeData(ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase(), 0);
    expect(collateralTypeData.properties.name).toBe('VaultEPT_ePyvDAI_24FEB23');
    expect(collateralTypeData.settings.codex.debtCeiling.gt(0)).toBe(true);
  });

  test('fetchPositionData', async () => {
    positionData = await fiat.fetchPositionData(
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address, 0, '0x9763b704f3fd8d70914d2d1293da4b7c1a38702c'
    );
    expect(positionData.collateral.gt(0)).toBe(true);
    expect(positionData.normalDebt.gt(0)).toBe(true);
  });

  test('computeHealthFactor', async () => {
    healthFactor = fiat.computeHealthFactor(
      positionData.collateral, positionData.normalDebt, collateralTypeData.state.codex.rate, collateralTypeData.state.collybus.liquidationPrice
    );
    expect(fiat.wadToDec(healthFactor) > 1.0).toBe(true);
  });

  test('computeMaxNormalDebt', async () => {
    const normalDebt = fiat.computeMaxNormalDebt(
      positionData.collateral, healthFactor, collateralTypeData.state.codex.rate, collateralTypeData.state.collybus.liquidationPrice
    );
    expect(normalDebt.div(1e8).eq(positionData.normalDebt.div(1e8))).toBe(true);
  });

  test('computeMinCollateral', async () => {
    const collateral = fiat.computeMinCollateral(
      healthFactor, positionData.normalDebt, collateralTypeData.state.codex.rate, collateralTypeData.state.collybus.liquidationPrice
    );
    expect(collateral.div(1e8).eq(positionData.collateral.div(1e8))).toBe(true);
  });

  test('normalDebtToDebt', async () => {
    const debt = fiat.normalDebtToDebt(positionData.normalDebt, collateralTypeData.state.codex.rate);
    expect(debt.gt(positionData.normalDebt)).toBe(true);
  });

  test('debtToNormalDebt', async () => {
    const debt = fiat.normalDebtToDebt(positionData.normalDebt, collateralTypeData.state.codex.rate);
    const normalDebt = fiat.debtToNormalDebt(debt, collateralTypeData.state.codex.rate);
    expect(normalDebt.eq(positionData.normalDebt)).toBe(true);
  });

  test('queryVault', async () => {
    const result = await fiat.query(
      queryVault, { id: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase() }
    );
    expect(result.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryVaults', async () => {
    const result = await fiat.query(
      queryVaults, { where: { address: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase() } }
    );
    expect(result.vaults[0].name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryCollateralType', async () => {
    const result = await fiat.query(
      queryCollateralType, { id: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase() + '-0'}
    );
    expect(result.collateralType.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryCollateralTypes', async () => {
    const result = await fiat.query(
      queryCollateralTypes, { where: { id: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase() + '-0'} }
    );
    expect(result.collateralTypes[0].vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryPosition', async () => {
    const result = await fiat.query(
      queryPosition, { id: '0x5a92f03d9079e009325d27af884db5ebdf181eaf-0x0-0x9763b704f3fd8d70914d2d1293da4b7c1a38702c' }
    );
    expect(result.position.collateralType.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryPositions', async () => {
    const result = await fiat.query(
      queryPositions, { where: { owner: '0x9763b704f3fd8d70914d2d1293da4b7c1a38702c' } }
    );
    expect(result.positions[0].collateralType.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryTransaction', async () => {
    const result = await fiat.query(
      queryTransaction, { id: '0xec2dcdfc520a59be94ee819d7fee6a83ce6efa6ae1288b54fc6ae8e3baecfb9a' }
    );
    expect(result.positionTransactionAction.position.collateralType.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });
  
  test('queryTransactions', async () => {
    const result = await fiat.query(
      queryTransactions, { where: { position_: { owner: '0x9763b704f3fd8d70914d2d1293da4b7c1a38702c' } } }
    );
    expect(result.positionTransactionActions[0].position.collateralType.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryUser', async () => {
    const result = await fiat.query(
      queryUser, { id: '0x9763b704f3fd8d70914d2d1293da4b7c1a38702c' }
    );
    expect(result.user.positions[0].collateralType.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryUsers', async () => {
    const result = await fiat.query(
      queryUsers, { where: { address: '0x9763b704f3fd8d70914d2d1293da4b7c1a38702c' } }
    );
    expect(result.users[0].positions[0].collateralType.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryUserProxy', async () => {
    const result = await fiat.query(
      queryUserProxy, { id: '0xcd6998d20876155d37aec0db4c19d63eeaef058f' }
    );
    expect(result.userProxy.proxy).toBe('0x9763b704f3fd8d70914d2d1293da4b7c1a38702c');
  });

  test('queryUserProxies', async () => {
    const result = await fiat.query(
      queryUserProxies, { where: { proxy: '0x9763b704f3fd8d70914d2d1293da4b7c1a38702c' } }
    );
    expect(result.userProxies[0].proxy).toBe('0x9763b704f3fd8d70914d2d1293da4b7c1a38702c');
  });

  test('underlierToPToken', async () => {
    const pToken = await fiat.call(
      contracts.vaultEPTActions,
      'underlierToPToken',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      collateralTypeData.properties.eptData.balancerVault,
      collateralTypeData.properties.eptData.poolId,
      fiat.decToWad('100')
    );
    expect(pToken.gt(fiat.decToWad('100'))).toBe(true);
  });
});
