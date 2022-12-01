import { WAD } from './utils';
import { ethers } from 'ethers';

/**
 * Deducts slippage from an exchange rate
 * @param exchangeRate Exchange rate [wad]
 * @param slippagePercentage Slippage as percentage [wad]
 * @return net exchange rate [wad]
 */
export function applySwapSlippage(exchangeRate, slippagePercentage) {
  return exchangeRate.mul(WAD.sub(slippagePercentage)).div(WAD);
}

/**
 * Converts normalized debt to debt by applying the borrow rate
 * @param normalDebt Normalized debt [wad]
 * @param rate Borrow rat [wad]
 * @return debt [wad]
 */
export function normalDebtToDebt(normalDebt, rate) {
  return normalDebt.mul(rate).div(WAD);
}

/**
 * Converts debt to normalized debt by deducting the borrow rate
 * @param debt Debt [wad]
 * @param rate Borrow rate [wad]
 * @return normalized debt [wad]
 */
export function debtToNormalDebt(debt, rate) {
  if (rate.isZero()) throw new Error('Invalid value for `rate` - expected non-zero value');
  let normalDebt = debt.mul(WAD).div(rate);
  // avoid potential rounding error when converting back to debt from normalDebt
  if (normalDebt.mul(rate).div(WAD).lt(debt)) {
    normalDebt = normalDebt.add(1);
  }
  return normalDebt;
}

/**
 * Computes the collateralization ratio given collateral and normalized debt amounts
 * @param collateral Collateral [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param normalDebt Normalized debt [wad]
 * @param rate Borrow rate [wad]
 * @return collateralization ratio [wad]
 */
export function computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate) {
  if (collateral.isZero()) return ethers.BigNumber.from(0);
  const debt = normalDebtToDebt(normalDebt, rate);
  if (debt.isZero()) return ethers.BigNumber.from(ethers.constants.MaxUint256);
  return collateral.mul(fairPrice).div(debt);
}

/**
 * Computes a max. possible amount of normalized debt for a given collateralization ratio
 * @param collateral Collateral [wad]
 * @param rate Borrow Rate [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param collateralizationRatio Collateralization ratio [wad] 
 * @return max. normalized debt [wad]
 */
export function computeMaxNormalDebt(collateral, rate, fairPrice, collateralizationRatio) {
  if (collateralizationRatio.isZero()) throw new Error('Invalid value for `collateralizationRatio` - expected non-zero value');
  if (rate.isZero()) throw new Error('Invalid value for `rate` - expected non-zero value');
  return debtToNormalDebt(collateral.mul(fairPrice).div(collateralizationRatio), rate);
}

/**
 * Computes a min. required amount of collateral for a given collateralization ratio
 * @param normalDebt Normalized debt [wad]
 * @param rate Borrow Rate [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param collateralizationRatio Collateralization ratio [wad] 
 * @return min. collateral [wad]
 */
export function computeMinCollateral(normalDebt, rate, fairPrice, collateralizationRatio) {
  if (fairPrice.isZero()) throw new Error('Invalid value for `fairPrice` - expected non-zero value');
  const debt = normalDebtToDebt(normalDebt, rate);
  return collateralizationRatio.mul(debt).div(fairPrice);
}
