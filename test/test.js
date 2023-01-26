const ethers = require('ethers');
const ganache = require('ganache');

const { FIAT } = require('../lib/index');
const {
  ZERO, WAD, YEAR_IN_SECONDS, decToWad, wadToDec, decToScale, scaleToDec, scaleToWad, wadToScale
} = require('../lib/utils');
const {
  interestPerYearToInterestPerSecond, interestPerSecondsToInterestPerYear, interestPerSecondToInterestToMaturity,
  interestPerSecondToAnnualYield, interestPerSecondToFeeRateAtMaturity,
  normalDebtToDebtAtMaturity, normalDebtToDebt, debtToNormalDebt,
  computeCollateralizationRatio, computeMaxNormalDebt, computeMinCollateral, applySwapSlippage
} = require('../lib/borrow');
const {
  computeFlashloanForLeveredDeposit, computeFlashloanForLeveredWithdrawal, estimatedUnderlierForLeveredWithdrawal,
  profitAtMaturity, yieldToMaturity, yieldToMaturityToAnnualYield,
  minCRForLeveredDeposit, maxCRForLeveredDeposit, minCRForLeveredWithdrawal, maxCRForLeveredWithdrawal
} = require('../lib/lever');
const {
  queryVault, queryVaults, queryCollateralType, queryCollateralTypes,
  queryPosition, queryPositions, queryTransaction, queryTransactions,
  queryUser, queryUsers, queryUserProxy, queryUserProxies, queryMeta
} = require('../lib/queries');

const ADDRESSES_MAINNET = require('changelog/deployment/deployment-mainnet.json');

jest.setTimeout(75000);

describe('Utils', () => {

  test('decToWad', () => {
    expect(decToWad(0).eq(ZERO)).toBe(true);
    expect(decToWad(0.1).eq(ethers.BigNumber.from('100000000000000000'))).toBe(true);
    expect(decToWad('0.1').eq(ethers.BigNumber.from('100000000000000000'))).toBe(true);
    expect(decToWad(ethers.BigNumber.from(1)).eq(WAD)).toBe(true);
  });

  test('wadToDec', () => {
    expect(Number(wadToDec(0)) == 0).toBe(true);
    expect(Number(wadToDec(1000000000000000)) == 0.001).toBe(true);
    expect(Number(wadToDec('100000000000000000')) == 0.1).toBe(true);
    expect(Number(wadToDec(WAD)) == 1).toBe(true);
  });

  test('decToScale', () => {
    expect(decToScale(0, 0).eq(ZERO)).toBe(true);
    expect(decToScale(0, '0').eq(ZERO)).toBe(true);
    expect(decToScale(0, ZERO).eq(ZERO)).toBe(true);
    expect(decToScale(0, WAD).eq(ZERO)).toBe(true);
    expect(decToScale(0.1, WAD).eq(ethers.BigNumber.from('100000000000000000'))).toBe(true);
    expect(decToScale('0.1', WAD).eq(ethers.BigNumber.from('100000000000000000'))).toBe(true);
    expect(decToScale(ethers.BigNumber.from(1), WAD).eq(WAD)).toBe(true);
  });

  test('scaleToDec', () => {
    expect(Number(scaleToDec(0, 0)) == 0).toBe(true);
    expect(Number(scaleToDec(0, '0')) == 0).toBe(true);
    expect(Number(scaleToDec(0, ZERO)) == 0).toBe(true);
    expect(Number(scaleToDec(0, WAD)) == 0).toBe(true);
    expect(Number(scaleToDec(1000000000000000, WAD)) == 0.001).toBe(true);
    expect(Number(scaleToDec('100000000000000000', WAD)) == 0.1).toBe(true);
    expect(Number(scaleToDec(WAD, WAD)) == 1).toBe(true);
  });

  test('scaleToWad', () => {
    expect(scaleToWad(0, 0).eq(ZERO)).toBe(true);
    expect(scaleToWad(0, '0').eq(ZERO)).toBe(true);
    expect(scaleToWad(0, ZERO).eq(ZERO)).toBe(true);
    expect(scaleToWad(0, 1).eq(ZERO)).toBe(true);
    expect(scaleToWad(1, 1).eq(WAD)).toBe(true);
    expect(scaleToWad('1', 1).eq(WAD)).toBe(true);
    expect(scaleToWad(ethers.BigNumber.from(1), 1).eq(WAD)).toBe(true);
  });

  test('wadToScale', () => {
    expect(Number(wadToScale(0, 0)) == 0).toBe(true);
    expect(Number(wadToScale(0, '0')) == 0).toBe(true);
    expect(Number(wadToScale(0, ZERO)) == 0).toBe(true);
    expect(Number(wadToScale(0, WAD)) == 0).toBe(true);
    expect(Number(wadToScale(1000000000000000000, '1')) == 1).toBe(true);
    expect(Number(wadToScale('1000000000000000000', '1')) == 1).toBe(true);
    expect(Number(wadToScale(WAD, '1')) == 1).toBe(true);
  });
});

// Tests run on mainnet state at block height 15711690
describe('Borrow', () => {

  const defaultAccount = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH contract
  const proxyOwner = '0xCE91783D36925bCc121D0C63376A248a2851982A'; // owner of `proxy`
  
  let server;

  let fiat;
  let collateralTypeData;
  let positionData;
  let collateralizationRatio;

  beforeAll(async () => {
    const options = {
      fork: { url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`, blockNumber: 15957377 },
      miner: { defaultGasPrice: 30000000000 },
      wallet: { unlockedAccounts: [defaultAccount, proxyOwner] },
      logging: { quiet: true }
    };
    server = ganache.server(options);
    await server.listen(8545);
    fiat = await FIAT.fromSigner(await (new ethers.providers.Web3Provider(server.provider)).getSigner());

    collateralTypeData = (await fiat.fetchCollateralTypesAndPrices(
      [{ vault: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase(), tokenId: 0 }]
    ))[0];
    const userData = await fiat.fetchUserData('0x9763b704f3fd8d70914d2d1293da4b7c1a38702c');
    positionData = { collateral: userData[0].positions[0].collateral, normalDebt: userData[0].positions[0].normalDebt };
  });

  afterAll(async () => {
    await server.close();
  });

  test('applySwapSlippage', async () => {
    expect(applySwapSlippage(WAD, decToWad(0.001)).eq(decToWad(0.999))).toBe(true);
  });

  test('computeCollateralizationRatio', async () => {
    collateralizationRatio = computeCollateralizationRatio(
      positionData.collateral, collateralTypeData.state.collybus.fairPrice, positionData.normalDebt, collateralTypeData.state.codex.rate
    );
    expect(wadToDec(collateralizationRatio) > 1.0).toBe(true);
  });

  test('computeMaxNormalDebt', async () => {
    const normalDebt = computeMaxNormalDebt(
      positionData.collateral, collateralTypeData.state.codex.rate, collateralTypeData.state.collybus.fairPrice, collateralizationRatio
    );
    expect(normalDebt.div(1e8).eq(positionData.normalDebt.div(1e8))).toBe(true);
  });

  test('computeMinCollateral', async () => {
    const collateral = computeMinCollateral(
      positionData.normalDebt, collateralTypeData.state.codex.rate, collateralTypeData.state.collybus.fairPrice, collateralizationRatio
    );
    expect(collateral.div(1e8).eq(positionData.collateral.div(1e8))).toBe(true);
  });

  test('normalDebtToDebt', async () => {
    const debt = normalDebtToDebt(positionData.normalDebt, collateralTypeData.state.codex.rate);
    expect(debt.gt(positionData.normalDebt)).toBe(true);
  });

  test('debtToNormalDebt', async () => {
    const debt = normalDebtToDebt(positionData.normalDebt, collateralTypeData.state.codex.rate);
    const normalDebt = debtToNormalDebt(debt, collateralTypeData.state.codex.rate);
    expect(normalDebt.eq(positionData.normalDebt)).toBe(true);
  });

  test('interestPerYearToInterestPerSecond', async () => {
    expect(
      interestPerYearToInterestPerSecond(decToWad('1.002500000104089600')).eq(decToWad('1.000000000078959300'))
    ).toBe(true);
    expect(
      interestPerYearToInterestPerSecond(decToWad(0)).eq(ZERO)
    ).toBe(true);
  });

  test('interestPerSecondsToInterestPerYear', async () => {
    expect(
      interestPerSecondsToInterestPerYear(decToWad('1.000000000079175600')).eq(decToWad('1.002506857997418600'))
    ).toBe(true);
    expect(
      interestPerSecondsToInterestPerYear(decToWad(0)).eq(ZERO)
    ).toBe(true);
  });

  test('interestPerSecondToAnnualYield', async () => {
    expect(
      interestPerSecondToAnnualYield(decToWad('1.000000000079175600')).eq(decToWad('0.002506843900000000'))
    ).toBe(true);
    expect(
      interestPerSecondToAnnualYield(decToWad(0)).eq(ZERO)
    ).toBe(true);
  });

  test('interestPerSecondToInterestToMaturity', async () => {
    expect(
      interestPerSecondToInterestToMaturity(
        interestPerYearToInterestPerSecond(WAD), ZERO, ZERO
      ).eq(WAD)
    ).toBe(true);
    expect(
      interestPerSecondToInterestToMaturity(
        interestPerYearToInterestPerSecond(WAD), ZERO, YEAR_IN_SECONDS
      ).eq(WAD)
    ).toBe(true);
    expect(
      interestPerSecondToInterestToMaturity(
        interestPerYearToInterestPerSecond(decToWad(1.01)), ZERO, YEAR_IN_SECONDS
      ).gte(decToWad(1.00999999))
    ).toBe(true);
  });

  test('interestPerSecondToFeeRateAtMaturity', async () => {
    expect(
      interestPerSecondToFeeRateAtMaturity(
        interestPerYearToInterestPerSecond(WAD), ZERO, ZERO
      ).eq(ZERO)
    ).toBe(true);
    expect(
      interestPerSecondToFeeRateAtMaturity(
        interestPerYearToInterestPerSecond(WAD), ZERO, YEAR_IN_SECONDS
      ).eq(ZERO)
    ).toBe(true);
    expect(
      interestPerSecondToFeeRateAtMaturity(
        interestPerYearToInterestPerSecond(decToWad(1.01)), ZERO, YEAR_IN_SECONDS
      ).gte(decToWad(0.00999999))
    ).toBe(true);
  });

  test('normalDebtToDebtAtMaturity', async () => {
    expect(
      normalDebtToDebtAtMaturity(
        decToWad(2),
        WAD,
        interestPerSecondToInterestToMaturity(
          interestPerYearToInterestPerSecond(WAD), ZERO, ZERO
        )
      ).eq(decToWad(2))
    ).toBe(true);
    expect(
      normalDebtToDebtAtMaturity(
        decToWad(2),
        decToWad(1.01),
        interestPerSecondToInterestToMaturity(
          interestPerYearToInterestPerSecond(decToWad(1.01)), ZERO, YEAR_IN_SECONDS
        )
      ).gte(decToWad(2))
    ).toBe(true);
  });
});

describe('Lever', () => {

  test('minCRForLeveredDeposit', async () => {
    expect(minCRForLeveredDeposit(
      ZERO,
      ZERO,
      ZERO,
      ZERO,
    ).eq(ZERO)).toBe(true);

    expect(
      minCRForLeveredDeposit(
        decToWad('0.95'),
        decToWad('1.00'),
        decToWad('1.00'),
        decToWad('1.05'),
      ).eq(decToWad('1.05'))
    ).toBe(true)

    expect(
      minCRForLeveredDeposit(
        decToWad('2.00'),
        decToWad('1.00'),
        decToWad('1.00'),
        decToWad('1.05'),
      ).eq(decToWad('2.00'))
    ).toBe(true);

    expect(
      minCRForLeveredDeposit(
        decToWad('1.00'),
        decToWad('2.00'),
        decToWad('1.00'),
        decToWad('1.05'),
      ).eq(decToWad('2.00'))
    ).toBe(true);

    expect(
      minCRForLeveredDeposit(
        decToWad('1.00'),
        decToWad('1.00'),
        decToWad('2.00'),
        decToWad('1.05'),
      ).eq(decToWad('2.00'))
    ).toBe(true);
  });

  test('maxCRForLeveredDeposit', async () => {
    expect(maxCRForLeveredDeposit(
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
    ).eq(ethers.constants.MaxUint256)).toBe(true);

    expect(
      maxCRForLeveredDeposit(
        ZERO,
        ZERO,
        WAD,
        WAD,
        WAD,
        decToWad('1000'),
        decToWad('1.05'),
      ).eq(ethers.constants.MaxUint256)
    ).toBe(true);

    expect(
      maxCRForLeveredDeposit(
        decToWad('2000'),
        decToWad('1000'),
        WAD,
        WAD,
        WAD,
        decToWad('1000'),
        decToWad('1.05'),
      ).eq(decToWad('3.00'))
    ).toBe(true);

    expect(
      maxCRForLeveredDeposit(
        decToWad('2000'),
        decToWad('1000'),
        WAD,
        WAD,
        WAD,
        decToWad(0),
        decToWad('1.05'),
      ).eq(decToWad('2.00'))
    ).toBe(true);

    expect(
      maxCRForLeveredDeposit(
        decToWad('2000'),
        decToWad('2000'),
        WAD,
        WAD,
        WAD,
        decToWad(0),
        decToWad('1.05'),
      ).eq(decToWad('1.05'))
    ).toBe(true);
  });

  test('minCRForLeveredWithdrawal', async () => {
    expect(minCRForLeveredWithdrawal(
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
    ).eq(ethers.constants.MaxUint256)).toBe(true);

    expect(minCRForLeveredWithdrawal(
      decToWad('2000'),
      decToWad('1000'),
      WAD,
      WAD,
      decToWad('500'),
      decToWad('1.05'),
    ).eq(decToWad('1.50'))).toBe(true);

    expect(minCRForLeveredWithdrawal(
      decToWad('2000'),
      decToWad('1000'),
      WAD,
      WAD,
      decToWad('1000'),
      decToWad('1.05'),
    ).eq(decToWad('1.05'))).toBe(true);

    expect(minCRForLeveredWithdrawal(
      decToWad('2000'),
      decToWad('1000'),
      WAD,
      WAD,
      decToWad('2000'),
      decToWad('1.05'),
    ).eq(decToWad('1.05'))).toBe(true);
  });

  test('maxCRForLeveredWithdrawal', async () => {
    expect(maxCRForLeveredWithdrawal(
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
      ZERO,
    ).eq(ethers.constants.MaxUint256)).toBe(true);

    expect(maxCRForLeveredWithdrawal(
      decToWad('2000'),
      decToWad('1000'),
      WAD,
      WAD,
      decToWad('0'),
      decToWad('0'),
      decToWad('1.05'),
    ).eq(decToWad('2.00'))).toBe(true)
    
    expect(maxCRForLeveredWithdrawal(
      decToWad('2000'),
      decToWad('1000'),
      WAD,
      WAD,
      decToWad('500'),
      decToWad('0'),
      decToWad('1.05'),
    ).eq(decToWad('1.50'))).toBe(true)

    expect(maxCRForLeveredWithdrawal(
      decToWad('2000'),
      decToWad('1000'),
      WAD,
      WAD,
      decToWad('1000'),
      decToWad('0'),
      decToWad('1.05'),
    ).eq(decToWad('1.05'))).toBe(true)
  });

  test('computeFlashloanForLeveredDeposit', async () => {
    // no existing position
    expect(computeFlashloanForLeveredDeposit(
      ZERO,
      ZERO,
      WAD,
      WAD,
      WAD,
      WAD,
      decToWad(1000),
      decToWad(2.0)
    ).eq(decToWad(1000))).toBe(true);

    // Position: Collateral: 0, Debt: 0, CR: 0
    // Inputs: UnderlierUpFront: 1000, targetCR: 3.0, underlierToCollateralRate: 2.0
    // Outputs: Flashloan: 2000, Collateral: 6000 , Debt: 2000
    expect(computeFlashloanForLeveredDeposit(
      ZERO,
      ZERO,
      WAD,
      WAD,
      WAD,
      decToWad(2.0),
      decToWad(1000),
      decToWad(3.0)
    ).eq(decToWad(2000))).toBe(true);

    // Position: Collateral: 0, Debt: 0, CR: 0
    // Inputs: UnderlierUpFront: 1000, targetCR: 2.0, underlierToCollateralRate: 0.5
    // Outputs: Flashloan: 333.33, Collateral: 666.66, Debt: 333.33
    expect(computeFlashloanForLeveredDeposit(
      ZERO,
      ZERO,
      WAD,
      WAD,
      WAD,
      decToWad(0.5),
      decToWad(1000),
      decToWad(2.0)
    ).eq(decToWad(1000).div(3))).toBe(true);

    // Position: Collateral: 1000, Debt: 500, CR: 2.0
    // Inputs: UnderlierUpFront: 200, targetCR: 2.0
    // Outputs: Flashloan: 200, Collateral: 1400, Debt: 700
    expect(computeFlashloanForLeveredDeposit(
      decToWad(1000),
      decToWad(500),
      WAD,
      WAD,
      WAD,
      WAD,
      decToWad(200),
      decToWad(2.0)
    ).eq(decToWad(200))).toBe(true);

    // Position: Collateral: 1000, Debt: 500, CR: 2.0
    // Inputs: UnderlierUpFront: 0, targetCR: 1.5
    // Outputs: -> Flashloan: 500, Collateral: 1500, Debt: 1000
    expect(computeFlashloanForLeveredDeposit(
      decToWad(1000),
      decToWad(500),
      WAD,
      WAD,
      WAD,
      WAD,
      decToWad(0),
      decToWad(1.5)
    ).eq(decToWad(500))).toBe(true);

    // Position: Collateral: 1000, Debt: 500, CR: 2.0
    // Inputs: UnderlierUpFront: 10000, targetCR: 2.0
    // Outputs: -> Flashloan: 10000, Collateral: 21000, Debt: 10500
    expect(computeFlashloanForLeveredDeposit(
      decToWad(1000),
      decToWad(500),
      WAD,
      WAD,
      WAD,
      WAD,
      decToWad(10000),
      decToWad(2.0)
    ).eq(decToWad(10000))).toBe(true);
  });

  test('computeFlashloanForLeveredWithdrawal', async () => {
    // no existing position
    expect(() => computeFlashloanForLeveredWithdrawal(
      ZERO,
      ZERO,
      WAD,
      WAD,
      decToWad(1000),
      ethers.constants.MaxUint256
    )).toThrow();

    // Position: Collateral: 1000, Debt: 0, CR: type(uint256).max
    // Inputs: CollateralToWithdraw: 10000, targetCR: type(uint256).max
    // Outputs: -> Flashloan: 0, Collateral: 0, Debt: 0
    expect(computeFlashloanForLeveredWithdrawal(
      decToWad(1000),
      ZERO,
      WAD,
      WAD,
      decToWad(1000),
      ethers.constants.MaxUint256
    ).eq(ZERO)).toBe(true);

    // Position: Collateral: 1000, Debt: 500, CR: 2.0
    // Inputs: CollateralToWithdraw: 10000, targetCR: type(uint256).max
    // Outputs: -> Flashloan: 500, Collateral: 0, Debt: 0
    expect(computeFlashloanForLeveredWithdrawal(
      decToWad(1000),
      decToWad(500),
      WAD,
      WAD,
      decToWad(1000),
      ethers.constants.MaxUint256
    ).eq(decToWad(500))).toBe(true);

    // Position: Collateral: 1000, Debt: 1000, CR: 1.0
    // Inputs: CollateralToWithdraw: 1000, targetCR: type(uint256).max
    // Outputs: -> Flashloan: 1000, Collateral: 0, Debt: 0
    expect(computeFlashloanForLeveredWithdrawal(
      decToWad(1000),
      decToWad(1000),
      WAD,
      WAD,
      decToWad(1000),
      ethers.constants.MaxUint256
    ).eq(decToWad(1000))).toBe(true);

    // Position: Collateral: 1000, Debt: 1000, CR: 2.0
    // Inputs: CollateralToWithdraw: 1000, targetCR: type(uint256).max
    // Outputs: -> Flashloan: 1000, Collateral: 0, Debt: 0
    expect(computeFlashloanForLeveredWithdrawal(
      decToWad(1000),
      decToWad(1000),
      WAD,
      decToWad(2.0),
      decToWad(1000),
      ethers.constants.MaxUint256
    ).eq(decToWad(1000))).toBe(true);

    // Position: Collateral: 1000, Debt: 1000, CR: 1.0
    // Inputs: CollateralToWithdraw: 500, targetCR: 2.0
    // Outputs: -> Flashloan: 750, Collateral: 0, Debt: 0
    expect(computeFlashloanForLeveredWithdrawal(
      decToWad(1000),
      decToWad(1000),
      WAD,
      WAD,
      decToWad(500),
      decToWad(2.0)
    ).eq(decToWad(750))).toBe(true);

    // Position: Collateral: 1000, Debt: 1000, CR: 2.0
    // Inputs: CollateralToWithdraw: 500, targetCR: 2.0
    // Outputs: -> Flashloan: 500, Collateral: 0, Debt: 0
    expect(computeFlashloanForLeveredWithdrawal(
      decToWad(1000),
      decToWad(1000),
      WAD,
      decToWad(2.0),
      decToWad(500),
      decToWad(2.0)
    ).eq(decToWad(500))).toBe(true);
  });

  test('estimatedUnderlierForLeveredWithdrawal', async () => {
    expect(() => estimatedUnderlierForLeveredWithdrawal(
      ZERO,
      WAD,
      WAD,
      decToWad(1000)
    ).toThrow());

    expect(estimatedUnderlierForLeveredWithdrawal(
      decToWad(1000),
      WAD,
      WAD,
      ZERO
    ).eq(decToWad(1000))).toBe(true);

    expect(estimatedUnderlierForLeveredWithdrawal(
      decToWad(1000),
      WAD,
      WAD,
      decToWad(500)
    ).eq(decToWad(500))).toBe(true);

    expect(estimatedUnderlierForLeveredWithdrawal(
      decToWad(1000),
      WAD,
      WAD,
      decToWad(1000)
    ).eq(ZERO)).toBe(true);
  });

  test('profitAtMaturity', async () => {
    expect(profitAtMaturity(
      WAD,
      WAD
    ).eq(ZERO)).toBe(true);
    expect(profitAtMaturity(
      WAD,
      ZERO
    ).eq(WAD.mul(-1))).toBe(true);
    expect(profitAtMaturity(
      ZERO,
      WAD
    ).eq(WAD)).toBe(true);
  });

  test('yieldToMaturity', async () => {
    expect(yieldToMaturity(
      WAD,
      WAD,
    ).eq(WAD)).toBe(true);
    expect(yieldToMaturity(
      WAD,
      WAD.mul(2),
    ).eq(WAD.mul(2))).toBe(true);
  });

  test('yieldToMaturityToAnnualYield', async () => {
    expect(yieldToMaturityToAnnualYield(
      WAD,
      ZERO,
      YEAR_IN_SECONDS
    ).eq(WAD)).toBe(true);
    expect(yieldToMaturityToAnnualYield(
      WAD.div(2),
      ZERO,
      YEAR_IN_SECONDS
    ).eq(WAD.div(2))).toBe(true);
    expect(yieldToMaturityToAnnualYield(
      WAD,
      YEAR_IN_SECONDS,
      YEAR_IN_SECONDS
    ).eq(ZERO)).toBe(true);
  });
});

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
  
  beforeAll(async () => {
    const options = {
      fork: { url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`, blockNumber: 16370300 },
      miner: { defaultGasPrice: 30000000000 },
      wallet: { unlockedAccounts: [defaultAccount, proxyOwner] },
      logging: { quiet: true }
    };
    server = ganache.server(options);
    await server.listen(8545);
    provider = new ethers.providers.Web3Provider(server.provider);
    fiat = await FIAT.fromSigner(await provider.getSigner());
    contracts = fiat.getContracts();
  });

  afterAll(async () => {
    await server.close();
  });

  test('fromSigner', async () => {
    const fiat_ = await FIAT.fromSigner(await provider.getSigner());
    expect(fiat_ != undefined).toBe(true);
  });

  test('fromProvider', async () => {
    expect(await FIAT.fromProvider(provider) != undefined).toBe(true);
    expect(await FIAT.fromProvider(provider, { subgraphUrl: '...' }) != undefined).toBe(true);
    const server_ = ganache.server({ chain: { chainId: 100 } });
    await server_.listen(8555);
    const provider_ = new ethers.providers.Web3Provider(server_.provider);
    expect(await FIAT.fromProvider(
      provider_, { subgraphUrl: '...', addresses: {}, metadata: {} }
    ) != undefined).toBe(true);
    expect(FIAT.fromProvider(provider_)).rejects.toThrow();
    await server_.close();
  });

  test('fromPrivateKey', async () => {
    expect(await FIAT.fromPrivateKey(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      '000000000000000000000000000000000000000000000000000000000000000A'
    ) != undefined).toBe(true);
  });

  test('getMetadata', () => {
    const metadata = fiat.getMetadata(ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address);
    expect(Object.values(metadata).length).toBeGreaterThan(0);
  });

  test('getContracts', () => {
    expect(Object.values(contracts).length).toBeGreaterThan(0);
  });

  test('getContractsFromProvider', async () => {
    const fiat_ = await FIAT.fromProvider(provider);
    const contractsFromProvider = fiat_.getContracts();
    expect(Object.values(contractsFromProvider).length).toBeGreaterThan(0);
  });

  test('call', async () => {
    expect((await fiat.call(contracts.codex, 'globalDebt')).gt(0)).toBe(true);
  });

  test('callProvider', async () => {
    const fiat_ = await FIAT.fromProvider(provider);
    expect((await fiat_.call(contracts.codex, 'globalDebt')).gt(0)).toBe(true);
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

  // Ganache returns stale data 
  test.skip('encodeViaProxy', async () => {
    console.log(await fiat.encodeViaProxy(
      proxy,
      contracts.publican,
      'collect',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      { from: proxyOwner }
    ));
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

  test('deployProxy', async () => {
    await fiat.deployProxy(await (await provider.getSigner()).getAddress());
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

  test('estimateGas', async () => {
    const vault = fiat.getVaultContract(ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address);
    const result = await fiat.estimateGas(contracts.publican, 'collect', vault.address);
    expect(result.gt(0)).toBe(true);
  });

  test('dryrun', async () => {
    const vault = fiat.getVaultContract(ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address);

    const resultSuccess = await fiat.dryrun(contracts.publican, 'collect', vault.address);
    expect(resultSuccess.success).toBe(true);

    const resultErrorGanache = await fiat.dryrun(vault, 'enter', 0, await fiat.signer.getAddress(), '1000');
    expect(resultErrorGanache.success).toBe(false);
    expect(resultErrorGanache.reason.includes('ERC20: insufficient-balance')).toBe(true);
    expect(resultErrorGanache.customError).toBe('Error(string)'); // note: `data` field is not returned by tenderly

    const fiat_ = await FIAT.fromPrivateKey(
      `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      '000000000000000000000000000000000000000000000000000000000000000A'
    );
    const resultErrorAlchemy = await fiat_.dryrun(vault, 'enter', 0, await fiat_.signer.getAddress(), '1000');
    expect(resultErrorAlchemy.success).toBe(false);
    expect(resultErrorAlchemy.reason.includes('ERC20: insufficient-balance')).toBe(true);
    expect(resultErrorAlchemy.customError).toBe('Error(string)');

    const fiat__ = await FIAT.fromPrivateKey(
      `https://rpc.tenderly.co/fork/${process.env.TENDERLY_API_KEY}`,
      '000000000000000000000000000000000000000000000000000000000000000A'
    );
    const resultErrorTenderly = await fiat__.dryrun(vault, 'enter', 0, await fiat__.signer.getAddress(), '1000');
    expect(resultErrorTenderly.success).toBe(false);
    expect(resultErrorTenderly.reason.includes('ERC20: insufficient-balance')).toBe(true);
    expect(resultErrorTenderly.customError).toBe('Error(string)');
  });

  test('dryrun - view', async () => {
    const collateralTypeData_ = (await fiat.fetchCollateralTypesAndPrices(
      [{ vault: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase(), tokenId: 0 }]
    ))[0];
    const resultSuccess = await fiat.dryrun(
      contracts.vaultEPTActions,
      'underlierToPToken',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      collateralTypeData_.properties.eptData.balancerVault,
      collateralTypeData_.properties.eptData.poolId,
      decToWad('100')
    );
    expect(resultSuccess.success).toBe(true);
    expect(resultSuccess.result.gt(0)).toBe(true);

    const resultError = await fiat.dryrun(
      contracts.vaultEPTActions,
      'underlierToPToken',
      ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address,
      collateralTypeData_.properties.eptData.balancerVault,
      collateralTypeData_.properties.eptData.poolId,
      decToWad('1000000000000000')
    );
    expect(resultError.success).toBe(false);
    expect(resultError.reason).toBe('VM Exception while processing transaction: revert BAL#001');
    expect(resultError.customError).toBe('Error(string)');
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
    // Ganache returns stale data it should be Error(string)
    expect(resultError.customError).toBe('VaultEPT__enter_notLive()');
  });

  test('fetchCollateralTypes', async () => {
    expect((await fiat.fetchCollateralTypes(
      [{ vault: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase(), tokenId: 0 }]
    ))[0].properties.name !== undefined).toBe(true);
    expect((await fiat.fetchCollateralTypes())[1].properties.name !== undefined).toBe(true);
  });

  test('fetchCollateralTypesAndPrices', async () => {
    collateralTypeData = (await fiat.fetchCollateralTypesAndPrices(
      [{ vault: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase(), tokenId: 0 }]
    ))[0];
    expect(collateralTypeData.properties.name !== undefined).toBe(true);
    expect((await fiat.fetchCollateralTypesAndPrices())[1].state.collybus.fairPrice !== undefined).toBe(true);
  });

   test('fetchUserData', async () => {
    const userData = await fiat.fetchUserData('0x9763b704f3fd8d70914d2d1293da4b7c1a38702c');
    expect(userData[0].isProxy).toBe(true);
    expect(userData[0].positions[0].collateral != null).toBe(true);
    positionData = { collateral: userData[0].positions[0].collateral, normalDebt: userData[0].positions[0].normalDebt };
    const userData2 = await fiat.fetchUserData('0xcD6998D20876155D37aEC0dB4C19d63EEAEf058F');
    expect(userData2[0].isProxy).toBe(true);
    const userData3 = await fiat.fetchUserData(defaultAccount);
    expect(userData3.length === 0).toBe(true);
    const userData4 = await fiat.fetchUserData('0xF1A7dA08F6cb83069817d2D8F6e55E4F2D6C0834');
    expect(userData4[0].isProxy).toBe(true);
  });

  test('fetchUserDataViaProvider', async () => {
    const userData = await fiat.fetchUserData('0x9763b704f3fd8d70914d2d1293da4b7c1a38702c');
    const userDataViaProvider = await fiat.fetchUserDataViaProvider('0x9763b704f3fd8d70914d2d1293da4b7c1a38702c');
    expect(userDataViaProvider[0].isProxy).toBe(userData[0].isProxy);
    expect(userDataViaProvider[0].positions[0].collateral.eq(userData[0].positions[0].collateral)).toBe(true);
    const userData2 = await fiat.fetchUserData('0xcD6998D20876155D37aEC0dB4C19d63EEAEf058F');
    const userDataViaProvider2 = await fiat.fetchUserDataViaProvider('0xcD6998D20876155D37aEC0dB4C19d63EEAEf058F');
    expect(userDataViaProvider2[0].isProxy).toBe(userData2[0].isProxy);
    const userData3 = await fiat.fetchUserData(defaultAccount);
    const userDataViaProvider3 = await fiat.fetchUserDataViaProvider(defaultAccount);
    expect(userDataViaProvider3.length).toBe(userData3.length);
    const userData4 = await fiat.fetchUserData('0xF1A7dA08F6cb83069817d2D8F6e55E4F2D6C0834');
    const userDataViaProvider4 = await fiat.fetchUserDataViaProvider('0xF1A7dA08F6cb83069817d2D8F6e55E4F2D6C0834');
    expect(userDataViaProvider4[0].isProxy).toBe(userData4[0].isProxy);
  });

  test('queryVault', async () => {
    const result = await fiat.query(
      queryVault, { id: ADDRESSES_MAINNET.vaultEPT_ePyvDAI_24FEB23.address.toLowerCase() }
    );
    expect(result.vault.name).toBe('VaultEPT_ePyvDAI_24FEB23');
  });

  test('queryMeta', async () => {
    const result = await fiat.query(queryMeta);
    expect(result._meta.block.hash != null).toBe(true);
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
      decToWad('100')
    );
    expect(pToken.gt(decToWad('100'))).toBe(true);
  });
});
