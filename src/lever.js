import { ethers } from 'ethers';
import { normalDebtToDebt, computeCollateralizationRatio } from './borrow';

import { ZERO, WAD, YEAR_IN_SECONDS, decToWad, wadToDec, toBigNumber } from './utils';

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// *                                            Levered Deposit                                                *
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * Computes the min. possible collateralization ratio for a levered deposit
 * @param fairPrice Liquidation price of collateral [wad]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [wad]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [wad]
 * @param liquidationRatio Liquidation ratio [wad]
 * @return min. collateralization ratio [wad]
 **/ 
export function minCRForLeveredDeposit(fairPrice, fiatToUnderlierRate, underlierToCollateralRate, liquidationRatio) {
  const ratio = toBigNumber(fairPrice).mul(fiatToUnderlierRate).div(WAD).mul(underlierToCollateralRate).div(WAD);
  return (ratio.gte(liquidationRatio)) ? ratio : liquidationRatio;
}

/**
 * Computes the max. possible collateralization ratio for a levered deposit
 * @param collateral Current collateral in position [wad]
 * @param normalDebt Current normalDebt in position [wad]
 * @param rate Current (virtual) normalDebt to debt rate [wad]
 * @param fairPrice Fair price of collateral [wad]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [wad]
 * @param underlierUpfront Upfront amount of Underlier [wad]
 * @param liquidationRatio Liquidation ratio [wad]
 * @return max. collateralization ratio [wad]
 **/ 
export function maxCRForLeveredDeposit(
  collateral, normalDebt, rate, fairPrice, underlierToCollateralRate, underlierUpfront, liquidationRatio
) {
  const debt = normalDebtToDebt(normalDebt, rate);
  if (debt.isZero()) return ethers.constants.MaxUint256;
  const ratio = (toBigNumber(fairPrice)
    .mul(toBigNumber(collateral).add(toBigNumber(underlierToCollateralRate).mul(underlierUpfront).div(WAD)))
    .div(WAD)
  ).mul(WAD).div(debt);
  return (ratio.gte(liquidationRatio)) ? ratio : liquidationRatio;
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
  const debt = normalDebtToDebt(normalDebt, rate);
  return (
    (
      toBigNumber(fairPrice)
        .mul(toBigNumber(collateral).add(toBigNumber(underlierToCollateralRate).mul(underlierUpfront).div(WAD)))
        .div(WAD)
    ).sub(toBigNumber(targetCollateralizationRatio).mul(debt).div(WAD))
  ).mul(WAD).div(
    toBigNumber(targetCollateralizationRatio)
      .sub(toBigNumber(fairPrice).mul(fiatToUnderlierRate).div(WAD).mul(underlierToCollateralRate).div(WAD))
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
 * @param liquidationRatio Liquidation ratio [wad]
 * @return min. collateralization ratio [wad]
 **/ 
 export function minCRForLeveredWithdrawal(
  collateral, normalDebt, fairPrice, rate, collateralToWithdraw, liquidationRatio
) {
  if (toBigNumber(collateral).lt(collateralToWithdraw))
    throw new Error('Invalid value for `collateralToWithdraw` - expected collateral >= collateralToWithdraw');
  const debt = normalDebtToDebt(normalDebt, rate);
  if (debt.isZero()) return ethers.constants.MaxUint256;
  const ratio = toBigNumber(fairPrice).mul(toBigNumber(collateral).sub(collateralToWithdraw)).div(debt);
  return (ratio.gte(liquidationRatio)) ? ratio : liquidationRatio;
}

/**
 * Computes the max. possible collateralization ratio for a levered withdrawal
 * @param collateral Current collateral in position [WAD]
 * @param normalDebt Current normalDebt in position [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param normalDebtToRepay Max. amount of normalDebt to repay [WAD]
 * @param collateralToWithdraw Collateral to withdraw (`collateral` has to be greater or equal) [WAD]
 * @param liquidationRatio Liquidation ratio [wad]
 * @return max. collateralization ratio [WAD]
 **/ 
export function maxCRForLeveredWithdrawal(
  collateral, normalDebt, fairPrice, rate, collateralToWithdraw, normalDebtToRepay, liquidationRatio
) {
  if (toBigNumber(collateral).lt(collateralToWithdraw))
    throw new Error('Invalid value for `collateralToWithdraw` - expected collateral >= collateralToWithdraw');
  if (toBigNumber(normalDebt).lt(normalDebtToRepay))
    throw new Error('Invalid value for `normalDebt` - expected normalDebt >= normalDebtToRepay');
  if (toBigNumber(normalDebt).isZero()) return ethers.constants.MaxUint256;
  const ratio = computeCollateralizationRatio(
    toBigNumber(collateral).sub(collateralToWithdraw),
    fairPrice,
    toBigNumber(normalDebt).sub(normalDebtToRepay),
    rate
  );
  return (ratio.gte(liquidationRatio)) ? ratio : liquidationRatio;
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
    (
      toBigNumber(collateralToWithdraw)
        .sub((toBigNumber(flashloan).mul(WAD).div(underlierToFIATRate).mul(WAD)).div(collateralToUnderlierRate))
    )
      .mul(collateralToUnderlierRate)
      .div(WAD)
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
  if (toBigNumber(collateralToWithdraw).gt(collateral))
    throw new Error('Invalid value for `collateral` - expected collateral >= collateralToWithdraw');
  const debt = normalDebtToDebt(normalDebt, rate);
  const flashloan = debt.sub(
    (toBigNumber(fairPrice).mul(toBigNumber(collateral).sub(collateralToWithdraw)).div(WAD))
      .mul(WAD)
      .div(targetCollateralizationRatio)
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
  return toBigNumber(underlierToWithdraw).sub(underlierUpfront);
}

/**
 * Converts the profit at maturity to the yield to maturity
 * @dev Use `profitAtMaturity` method to compute the profit at maturity
 * @param underlierUpfront Underlier amount upfront [wad]
 * @param profitAtMaturity Profit at maturity [wad]
 * @return yield to maturity [wad]
 */
export function yieldToMaturity(underlierUpfront, profitAtMaturity) {
  if (underlierUpfront.isZero()) return ZERO;
  return ((toBigNumber(underlierUpfront).add(profitAtMaturity)).mul(WAD).div(underlierUpfront)).sub(WAD);
}

/**
 * Converts the yield to maturity to annual yield (APY)
 * @param yieldToMaturity Yield to maturity [wad]
 * @param now Current timestamp [seconds]
 * @param maturity Maturity timestamp [seconds]
 * @return annual yield [wad]
 */
export function yieldToMaturityToAnnualYield(yieldToMaturity, now, maturity) {
  if (toBigNumber(now).gte(maturity)) return ZERO;
  return decToWad(
    Math.pow(
      Number(wadToDec((WAD.add(yieldToMaturity)))),
      YEAR_IN_SECONDS.toNumber()/Number(toBigNumber(maturity).sub(now))
    )
  ).sub(WAD);
}
