import { ethers } from 'ethers';

import { WAD } from './utils';

/**
 *  @param fairPrice Fair price of collateral [WAD]
 *  @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 *  @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 **/ 
export function computeMinCollateralizationRatio(fairPrice, fiatToUnderlierRate, underlierToCollateralRate) {
  return fairPrice.mul(fiatToUnderlierRate).div(WAD).mul(underlierToCollateralRate).div(WAD);  
}

/**
 *  @param collateral Current collateral in position [WAD]
 *  @param normalDebt Current normalDebt in position [WAD]
 *  @param rate Current (virtual) normalDebt to debt rate [WAD]
 *  @param fairPrice Fair price of collateral [WAD]
 *  @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 *  @param underlierUpfront Upfront amount of Underlier [WAD]
 **/ 
export function computeMaxCollateralizationRatio(
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
 *  @param collateral Current collateral in position [WAD]
 *  @param debt Current debt in position [WAD]
 *  @param fairPrice Fair price of collateral [WAD]
 *  @param rate Current (virtual) normalDebt to debt rate [WAD]
 *  @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 *  @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 *  @param underlierUpfront Upfront amount of Underlier [WAD]
 *  @param targetCollateralizationRatio Targeted collateralization ratio [WAD]
 **/ 
export function computeFlashloanDeposit(
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
  const minCollateralizationRatio = computeMinCollateralizationRatio(
    fairPrice, fiatToUnderlierRate, underlierToCollateralRate
  );
  const maxCollateralizationRatio = computeMaxCollateralizationRatio(
    collateral, normalDebt, rate, fairPrice, underlierToCollateralRate, underlierUpfront
  );

  // console.log(minCollateralizationRatio.toString());
  // console.log(maxCollateralizationRatio.toString());
  
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

// computeFlashloanWithdrawal

// computeFlashloanRedemption
