const { FIAT } = require('../lib/index');
const { queryPositions, queryUserProxy } = require('../lib/queries');

const MAINNET = require('changelog/deployment/deployment-mainnet.json');

(async () => {
  const fiat = await FIAT.fromPrivateKey(
    'https://eth-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY,
    '000000000000000000000000000000000000000000000000000000000000000A',
    'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph'
  );

  const contracts = fiat.getContracts();

  console.log(Object.values(contracts).map(({ address }) => address));

  console.log(await fiat.call(contracts.codex, 'globalDebt'));

  console.log(await fiat.multicall([
    { contract: contracts.codex, method: 'globalDebt', args: [] },
    { contract: contracts.codex, method: 'globalUnbackedDebt', args: [] },
    { contract: contracts.codex, method: 'globalDebtCeiling', args: [] },
    { contract: contracts.codex, method: 'vaults', args: [MAINNET.vaultEPT_ePyvDAI_24FEB23.address] }
  ]));

  const vaultData = await fiat.fetchVaultData(MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase());
  console.log(JSON.stringify(vaultData));
  
  const positionData = await fiat.fetchPositionData(
    MAINNET.vaultEPT_ePyvDAI_24FEB23.address, 0, '0x9763B704F3fd8d70914D2d1293Da4B7c1A38702c'
  );
  console.log(positionData);

  const healthFactor = fiat.computeHealthFactor(
    positionData.collateral, positionData.normalDebt, vaultData.state.codex.rate, vaultData.state.liquidationPrice
  );
  console.log(healthFactor.toString());

  console.log(fiat.computeMaxNormalDebt(
    positionData.collateral, healthFactor, vaultData.state.codex.rate, vaultData.state.liquidationPrice)
  );

  console.log(fiat.computeMinCollateral(
    healthFactor, positionData.normalDebt, vaultData.state.codex.rate, vaultData.state.liquidationPrice)
  );

  console.log(await fiat.query(queryPositions, { where: { owner: '0x9763B704F3fd8d70914D2d1293Da4B7c1A38702c' } }));

  console.log(await fiat.call(
    contracts.vaultEPTActions,
    'underlierToPToken',
    MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
    vaultData.properties.tokenIds[0].balancerVault,
    vaultData.properties.tokenIds[0].poolId,
    fiat.toWad('100')
  ));
})();

