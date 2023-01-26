import { BigNumber, ethers } from 'ethers';

import { ZERO, WAD, YEAR_IN_SECONDS, wadToDec, decToWad, toBigNumber } from './utils';

/**
 * Deducts slippage from an exchange rate
 * @param exchangeRate Exchange rate [wad]
 * @param slippagePercentage Slippage as percentage [wad]
 * @return net exchange rate [wad]
 */
export function applySwapSlippage(exchangeRate, slippagePercentage) {
  return toBigNumber(exchangeRate).mul(WAD.sub(slippagePercentage)).div(WAD);
}

/**
 * Converts interest per year to interest per second
 * @param interestPerYear Interest per year [wad]
 * @return interest per second [wad]
 */ 
export function interestPerYearToInterestPerSecond(interestPerYear) {
  return decToWad(Math.pow(wadToDec(interestPerYear), 1/YEAR_IN_SECONDS.toNumber()));
}

/**
 * Converts interest per seconds to interest per year
 * @param interestPerSecond Interest per seconds [wad]
 * @return interest per year [wad]
 */ 
export function interestPerSecondsToInterestPerYear(interestPerSecond) {
  return decToWad(Math.pow(wadToDec(interestPerSecond), YEAR_IN_SECONDS.toNumber()));
}

/**
 * Converts interest per second to annual yield (APY)
 * @param interestPerSecond Interest per second [wad]
 * @return annual yield [wad]
 */
export function interestPerSecondToAnnualYield(interestPerSecond) {
  if (toBigNumber(interestPerSecond).lt(WAD)) return ZERO;
  return decToWad(
    (Math.pow(Number(wadToDec(interestPerSecond).slice(0, 17)), YEAR_IN_SECONDS) - 1).toFixed(10)
  );
};

/**
 * Compute the interest to maturity using the interest per second
 * @param interestPerSecond Interest per second [wad]
 * @param now Current unix timestamp [seconds]
 * @param maturity Maturity unix timestamp [seconds]
 * @return interest to maturity [wad]
 */
export function interestPerSecondToInterestToMaturity(interestPerSecond, now, maturity) {
  if (toBigNumber(now).gte(maturity)) return WAD;
  return decToWad(Math.pow(wadToDec(interestPerSecond), toBigNumber(maturity).sub(now).toNumber()));
}

/**
 * Compute the fee rate due at maturity using the interest per second
 * @param interestPerSecond Interest per second [wad]
 * @param now Current unix timestamp [seconds]
 * @param maturity Maturity unix timestamp [seconds]
 * @return fee rate at maturity [wad]
 */
export function interestPerSecondToFeeRateAtMaturity(interestPerSecond, now, maturity) {
  if (toBigNumber(now).gte(maturity)) return ZERO;
  return interestPerSecondToInterestToMaturity(interestPerSecond, now, maturity).sub(WAD);
}

/**
 * Converts normalized debt to debt by applying the borrow rate accumulator
 * @param normalDebt Normalized debt [wad]
 * @param rate Borrow rate accumulator [wad]
 * @return debt [wad]
 */
export function normalDebtToDebt(normalDebt, rate) {
  return toBigNumber(normalDebt).mul(rate).div(WAD);
}

/**
 * Converts debt to normalized debt by deducting the borrow rate accumulator
 * @param debt Debt [wad]
 * @param rate Borrow rate accumulator [wad]
 * @return normalized debt [wad]
 */
export function debtToNormalDebt(debt, rate) {
  if (toBigNumber(rate).isZero()) throw new Error('Invalid value for `rate` - expected non-zero value');
  let normalDebt = toBigNumber(debt).mul(WAD).div(rate);
  // avoid potential rounding error when converting back to debt from normalDebt
  if (normalDebt.mul(rate).div(WAD).lt(debt)) {
    normalDebt = normalDebt.add(1);
  }
  return normalDebt;
}

/**
 * Computes the debt at maturity via the provided normalized debt, the borrow rate accumulator and interest to maturity
 * @param normalDebt Normalized debt [wad]
 * @param rate Borrow rate accumulator [wad]
 * @param interestToMaturity Interest at maturity [wad]
 * @return debt at maturity [wad]
 */
export function normalDebtToDebtAtMaturity(normalDebt, rate, interestToMaturity) {
  return toBigNumber(normalDebt).mul(toBigNumber(rate).add(interestToMaturity).sub(WAD)).div(WAD);
}

/**
 * Computes the collateralization ratio given collateral and normalized debt amounts
 * @param collateral Collateral [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param normalDebt Normalized debt [wad]
 * @param rate Borrow rate accumulator [wad]
 * @return collateralization ratio [wad]
 */
export function computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate) {
  const debt = normalDebtToDebt(normalDebt, rate);
  if (debt.isZero()) return ethers.constants.MaxUint256;
  return toBigNumber(collateral).mul(fairPrice).div(debt);
}

/**
 * Computes a max. possible amount of normalized debt for a given collateralization ratio
 * @param collateral Collateral [wad]
 * @param rate Borrow rate accumulator [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param collateralizationRatio Collateralization ratio [wad] 
 * @return max. normalized debt [wad]
 */
export function computeMaxNormalDebt(collateral, rate, fairPrice, collateralizationRatio) {
  if (toBigNumber(collateralizationRatio).isZero())
    throw new Error('Invalid value for `collateralizationRatio` - expected non-zero value');
  return debtToNormalDebt(toBigNumber(collateral).mul(fairPrice).div(collateralizationRatio), rate);
}

/**
 * Computes a min. required amount of collateral for a given collateralization ratio
 * @param normalDebt Normalized debt [wad]
 * @param rate Borrow rate accumulator [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param collateralizationRatio Collateralization ratio [wad] 
 * @return min. collateral [wad]
 */
export function computeMinCollateral(normalDebt, rate, fairPrice, collateralizationRatio) {
  if (toBigNumber(fairPrice).isZero())
    throw new Error('Invalid value for `fairPrice` - expected non-zero value');
  const debt = normalDebtToDebt(normalDebt, rate);
  return toBigNumber(collateralizationRatio).mul(debt).div(fairPrice);
}
