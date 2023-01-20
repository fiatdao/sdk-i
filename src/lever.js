import { ethers } from 'ethers';

import { ZERO, WAD, YEAR_IN_SECONDS, decToWad, wadToDec } from './utils';

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// *                                            Levered Deposit                                                *
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * Computes the min. possible collateralization ratio for a levered deposit
 * @param fairPrice Fair price of collateral [wad]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [wad]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [wad]
 * @return min. collateralization ratio [wad]
 **/ 
export function minCRForLeveredDeposit(fairPrice, fiatToUnderlierRate, underlierToCollateralRate) {
  return fairPrice.mul(fiatToUnderlierRate).div(WAD).mul(underlierToCollateralRate).div(WAD);  
}

/**
 * Computes the max. possible collateralization ratio for a levered deposit
 * @param collateral Current collateral in position [wad]
 * @param normalDebt Current normalDebt in position [wad]
 * @param rate Current (virtual) normalDebt to debt rate [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [wad]
 * @param underlierUpfront Upfront amount of Underlier [wad]
 * @return max. collateralization ratio [wad]
 **/ 
export function maxCRForLeveredDeposit(
  collateral, normalDebt, rate, fairPrice, underlierToCollateralRate, underlierUpfront
) {
  const debt = normalDebt.mul(rate).div(WAD);
  return debt.isZero()
    ? ethers.constants.MaxUint256
    : (
      fairPrice
        .mul(collateral.add(underlierToCollateralRate.mul(underlierUpfront).div(WAD))).div(WAD)
    ).mul(WAD).div(debt);
}

/**
 * Computes the flashloan amount (or deltaNormalDebt) for a levered deposit
 * @dev Min. and max. collateralization ratios are not checked in this function
 * @param collateral Current collateral in position [wad]
 * @param debt Current debt in position [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param rate Current (virtual) normalDebt to debt rate [wad]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [wad]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [wad]
 * @param underlierUpfront Upfront amount of Underlier [wad]
 * @param targetCollateralizationRatio Targeted collateralization ratio [wad]
 * @return flashloan amount [wad]
 **/ 
export function computeFlashloanForLeveredDeposit(
  collateral,
  normalDebt,
  rate,
  fairPrice,
  fiatToUnderlierRate,
  underlierToCollateralRate,
  underlierUpfront,
  targetCollateralizationRatio
) {
  const debt = normalDebt.mul(rate).div(WAD);
  return (
    (fairPrice.mul(collateral.add(underlierToCollateralRate.mul(underlierUpfront).div(WAD))).div(WAD))
    .sub(targetCollateralizationRatio.mul(debt).div(WAD))
  ).mul(WAD).div(
    targetCollateralizationRatio
    .sub(fairPrice.mul(fiatToUnderlierRate).div(WAD).mul(underlierToCollateralRate).div(WAD))
  );
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// *                                   Levered Withdrawal / Redemption                                         *
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * Computes the min. possible collateralization ratio for a levered withdrawal
 * @param collateral Current collateral in position [wad]
 * @param normalDebt Current normalDebt in position [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param rate Current (virtual) normalDebt to debt rate [wad]
 * @param collateralToWithdraw Collateral to withdraw (`collateral` has to be greater or equal) [wad]
 * @return min. collateralization ratio [wad]
 **/ 
 export function minCRForLeveredWithdrawal(collateral, normalDebt, fairPrice, rate, collateralToWithdraw) {
  if (collateral.lt(collateralToWithdraw))
    throw new Error('Invalid value for `collateralToWithdraw` - expected collateral >= collateralToWithdraw');
  const debt = normalDebt.mul(rate).div(WAD);
  return debt.isZero()
    ? ethers.constants.MaxUint256
    : (fairPrice.mul(collateral.sub(collateralToWithdraw)).div(debt));
}

/**
 * Computes the max. possible collateralization ratio for a levered withdrawal
 * @param collateral Current collateral in position [WAD]
 * @param collateralToWithdraw Collateral to withdraw (`collateral` has to be greater or equal) [WAD]
 * @return max. collateralization ratio [WAD]
 **/ 
export function maxCRForLeveredWithdrawal(collateral, collateralToWithdraw) {
  if (collateral.lt(collateralToWithdraw))
    throw new Error('Invalid value for `collateralToWithdraw` - expected collateral >= collateralToWithdraw');
  return ethers.constants.MaxUint256;
}

/**
 * Computes the estimated withdrawable underlier amount for a levered withdrawal
 * @dev For a redemption `collateralToWithdraw` == `collateral` and `collateralToUnderlierRate` == WAD
 * @param collateralToWithdraw Collateral to withdraw [wad]
 * @param collateralToUnderlierRate Exchange rate from the Collateral asset to the Underlier [wad]
 * @param underlierToFIATRate Exchange rate from the Underlier to FIAT [wad]
 * @param flashloan Flashloan amount (see computeFlashloanForLeveredWithdrawal) [wad]
 * @return withdrawalable underlier [wad]
 */
export function estimatedUnderlierForLeveredWithdrawal(
  collateralToWithdraw, collateralToUnderlierRate, underlierToFIATRate, flashloan
) {
  const underlier = (
    (collateralToWithdraw.sub((flashloan.mul(WAD).div(underlierToFIATRate).mul(WAD)).div(collateralToUnderlierRate)))
    .mul(collateralToUnderlierRate).div(WAD)
  );

  if (underlier.lt(ZERO)) throw new Error('Negative withdrawable underlier amount');
  return underlier;
}

/**
 * Computes the flashloan amount (or deltaNormalDebt) for a levered withdrawal
 * @param collateral Current collateral in position [wad]
 * @param debt Current debt in position [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param rate Current (virtual) normalDebt to debt rate [wad]
 * @param collateralToWithdraw Collateral to withdraw (`collateral` has to be greater or equal) [wad]
 * @param targetCollateralizationRatio Targeted collateralization ratio [wad]
 * @return flashloan amount [wad]
 **/ 
export function computeFlashloanForLeveredWithdrawal(
  collateral,
  normalDebt,
  rate,
  fairPrice,
  collateralToWithdraw,
  targetCollateralizationRatio
) {
  if (collateralToWithdraw.gt(collateral))
    throw new Error('Invalid value for `collateral` - expected collateral >= collateralToWithdraw');

  const debt = normalDebt.mul(rate).div(WAD);

  const flashloan = debt.sub(
    (fairPrice.mul(collateral.sub(collateralToWithdraw)).div(WAD)).mul(WAD).div(targetCollateralizationRatio)
  );
  if (flashloan.lt(ZERO)) throw new Error('Negative flashloan amount');
  return flashloan;
}

/**
 * Computes the profit at maturity for a levered withdrawal
 * @dev For a redemption `underlierToWithdraw` is calculated via estimatedUnderlierForLeveredWithdrawal
 * @param underlierUpfront Underlier amount upfront [wad]
 * @param underlierToWithdraw Underlier amount to withdraw [wad]
 * @return profit at maturity [wad]
 */ 
export function profitAtMaturity(underlierUpfront, underlierToWithdraw) {
  return underlierToWithdraw.sub(underlierUpfront);
}

/**
 * Computes the yield to maturity
 * @param underlierUpfront Underlier amount upfront [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @return yield to maturity [wad]
 */
export function yieldToMaturity(underlierUpfront, fairPrice) {
  return (((underlierUpfront.add(fairPrice)).mul(WAD).div(underlierUpfront)).sub(WAD));
}

/**
 * Computes the annual yield
 * @param yieldToMaturity Yield to maturity [wad]
 * @param now Current timestamp [seconds]
 * @param maturity Maturity timestamp [seconds]
 * @return annual yield [wad]
 */
export function yieldToMaturityToAnnualYield(yieldToMaturity, now, maturity) {
  if (now.gte(maturity)) return ZERO;
  return decToWad(
    Math.pow(Number(wadToDec((WAD.add(yieldToMaturity)))), YEAR_IN_SECONDS.toNumber()/Number(maturity.sub(now)))
  ).sub(WAD);
}
