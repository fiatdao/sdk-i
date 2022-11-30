import { ethers } from 'ethers';

import { ZERO, WAD } from './utils';

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
// *                                            Levered Deposit                                                *
// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

/**
 * Computes the min. possible collateralization ratio for a levered deposit
 * @param fairPrice Fair price of collateral [WAD]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @return min. collateralization ratio [WAD]
 **/ 
export function minCRForLeveredDeposit(fairPrice, fiatToUnderlierRate, underlierToCollateralRate) {
  return fairPrice.mul(fiatToUnderlierRate).div(WAD).mul(underlierToCollateralRate).div(WAD);  
}

/**
 * Computes the max. possible collateralization ratio for a levered deposit
 * @param collateral Current collateral in position [WAD]
 * @param normalDebt Current normalDebt in position [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @param underlierUpfront Upfront amount of Underlier [WAD]
 * @return max. collateralization ratio [WAD]
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
 * @param collateral Current collateral in position [WAD]
 * @param debt Current debt in position [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @param underlierUpfront Upfront amount of Underlier [WAD]
 * @param targetCollateralizationRatio Targeted collateralization ratio [WAD]
 * @return flashloan amount [WAD]
 **/ 
export function computeLeveredDeposit(
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
  const minCollateralizationRatio = minCRForLeveredDeposit(
    fairPrice, fiatToUnderlierRate, underlierToCollateralRate
  );
  const maxCollateralizationRatio = maxCRForLeveredDeposit(
    collateral, normalDebt, rate, fairPrice, underlierToCollateralRate, underlierUpfront
  );

  if (!(
    minCollateralizationRatio.lt(targetCollateralizationRatio)
    && targetCollateralizationRatio.lte(maxCollateralizationRatio)
  )) {
    throw new Error('Invalid value for `targetCollateralizationRatio`');
  }

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
 * @param collateral Current collateral in position [WAD]
 * @param normalDebt Current normalDebt in position [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param collateralToWithdraw Collateral to withdraw (`collateral` has to be greater or equal) [WAD]
 * @return min. collateralization ratio [WAD]
 **/ 
 export function minCRForLeveredWithdrawal(collateral, normalDebt, fairPrice, rate, collateralToWithdraw) {
  const debt = normalDebt.mul(rate).div(WAD);
  return debt.isZero()
    ? ethers.constants.MaxUint256
    : (fairPrice.mul(collateral.sub(collateralToWithdraw)).div(debt));
}

/**
 * Computes the estimated withdrawable underlier amount for a levered withdrawal
 * @param collateralToWithdraw Collateral to withdraw [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 * @param flashloan Flashloan amount (see computeLeveredWithdrawal) [WAD]
 * @return withdrawalable underlier [WAD]
 */
export function estimatedUnderlierForLeveredWithdrawal(
  collateralToWithdraw, underlierToCollateralRate, fiatToUnderlierRate, flashloan
) {
  if (underlierToCollateralRate.isZero())
    throw new Error('Invalid value for `underlierToCollateralRate` - expect non-zero value');

  const underlier = (
    (collateralToWithdraw.sub(underlierToCollateralRate.mul(fiatToUnderlierRate).div(WAD).mul(flashloan).div(WAD)))
    .mul(WAD).div(underlierToCollateralRate)
  );
  if (underlier.lt(ZERO)) throw new Error('Negative withdrawable underlier amount');
  return underlier;
}

/**
 * Computes the flashloan amount (or deltaNormalDebt) for a levered withdrawal
 * @param collateral Current collateral in position [WAD]
 * @param debt Current debt in position [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param collateralToWithdraw Collateral to withdraw (`collateral` has to be greater or equal) [WAD]
 * @param targetCollateralizationRatio Targeted collateralization ratio [WAD]
 * @return flashloan amount [WAD]
 **/ 
 export function computeLeveredWithdrawal(
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
  const minCollateralizationRatio = minCRForLeveredWithdrawal(
    collateral, normalDebt, fairPrice, rate, collateralToWithdraw
  );

  if (!(minCollateralizationRatio.lte(targetCollateralizationRatio))) {
    throw new Error('Invalid value for `targetCollateralizationRatio`');
  }

  const flashloan = debt.sub(
    (fairPrice.mul(collateral.sub(collateralToWithdraw)).div(WAD))
    .mul(WAD).div(targetCollateralizationRatio)
  );
  if (flashloan.lt(ZERO)) throw new Error('Negative flashloan amount');
  return flashloan;
}
