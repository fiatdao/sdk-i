const { FIAT } = require('../lib/index');

const MAINNET = require('changelog/deployment/deployment-mainnet.json');

(async () => {
  const fiat = await FIAT.fromPrivateKey(
    'https://eth-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY,
    '000000000000000000000000000000000000000000000000000000000000000A',
    'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph'
  );

  const contracts = fiat.getContracts();
  if (!contracts || !contracts.codex || !contracts.codex.address || contracts.codex.address.length === 0)
    throw new Error('');

  console.log(await fiat.multicall([
    { contract: contracts.codex, method: 'globalDebt', args: [] },
    { contract: contracts.codex, method: 'globalUnbackedDebt', args: [] },
    { contract: contracts.codex, method: 'globalDebtCeiling', args: [] },
    { contract: contracts.codex, method: 'vaults', args: [MAINNET.vaultEPT_ePyvDAI_24FEB23.address] }
  ]));

  console.log(await fiat.fetchVaultData(MAINNET.vaultEPT_ePyvDAI_24FEB23.address));
  console.log(await fiat.fetchPositionData(MAINNET.vaultEPT_ePyvDAI_24FEB23.address, 0, '0x9763B704F3fd8d70914D2d1293Da4B7c1A38702c'));
})();

