import { WAD } from './utils';

export function applySwapSlippage(exchangeRate, slippagePercentage) {
  return exchangeRate.mul(WAD.sub(slippagePercentage)).div(WAD);
}

export function normalDebtToDebt(normalDebt, rate) {
  return normalDebt.mul(rate).div(WAD);
}

export function debtToNormalDebt(debt, rate) {
  if (rate.isZero()) throw new Error('Invalid value for `rate` - expected non-zero value');
  let normalDebt = debt.mul(WAD).div(rate);
  // avoid potential rounding error when converting back to debt from normalDebt
  if (normalDebt.mul(rate).div(WAD).lt(debt)) {
    normalDebt = normalDebt.add(1);
  }
  return normalDebt;
}

// collateral in WAD 
export function computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate) {
  if (collateral.isZero()) return ethers.BigNumber.from(0);
  const debt = normalDebtToDebt(normalDebt, rate);
  if (debt.isZero()) return ethers.BigNumber.from(ethers.constants.MaxUint256);
  return collateral.mul(fairPrice).div(debt);
}

// collateral in WAD 
export function computeMaxNormalDebt(collateral, rate, fairPrice, collateralizationRatio) {
  if (collateralizationRatio.isZero()) throw new Error('Invalid value for `collateralizationRatio` - expected non-zero value');
  if (rate.isZero()) throw new Error('Invalid value for `rate` - expected non-zero value');
  return debtToNormalDebt(collateral.mul(fairPrice).div(collateralizationRatio), rate);
}

export function computeMinCollateral(normalDebt, rate, fairPrice, collateralizationRatio) {
  if (fairPrice.isZero()) throw new Error('Invalid value for `fairPrice` - expected non-zero value');
  const debt = normalDebtToDebt(normalDebt, rate);
  return collateralizationRatio.mul(debt).div(fairPrice);
}
