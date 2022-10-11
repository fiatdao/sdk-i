const { FIAT } = require('../lib/index');
const { queryPositions } = require('../lib/queries');

const MAINNET = require('changelog/deployment/deployment-mainnet.json');

// Tests run on mainnet state at block height 15711690
describe('FIAT', () => {

  let fiat;
  let contracts;
  let vaultData;
  let positionData;
  let healthFactor;

  test('fromPrivateKey', async () => {
    fiat = await FIAT.fromPrivateKey(
      process.env.TENDERLY_FORK_URL_15711690,
      '000000000000000000000000000000000000000000000000000000000000000A',
      'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph'
    );
  });

  test('fromPrivateKey', () => {
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

  test('dryrun', async () => {
    const vault = fiat.getVaultContract(MAINNET.vaultEPT_ePyvDAI_24FEB23.address);
    const error = await fiat.dryrun(vault, 'enter', 0, fiat.signer.address, '1000');
    expect(error.success).toBe(false);
    expect(error.reason.includes('ERC20: insufficient-balance')).toBe(true);
    expect(error.customError).toBe(undefined); // .toBe('Error(string)'); // `data` field is not returned by tenderly
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
