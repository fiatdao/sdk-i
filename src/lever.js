import { ethers } from 'ethers';

import { WAD } from './utils';

/**
 * Computes the min. possible collateralization ratio for a levered deposit
 * @param fairPrice Fair price of collateral [WAD]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @return min. collateralization ratio [wad]
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
 * @param collateral Current collateral in position [WAD]
 * @param debt Current debt in position [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @param underlierUpfront Upfront amount of Underlier [WAD]
 * @param targetCollateralizationRatio Targeted collateralization ratio [WAD]
 * @return flashloan amount [wad]
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

/**
 * Computes the flashloan amount (or deltaNormalDebt) for a levered withdrawal
 * @param collateral Current collateral in position [WAD]
 * @param debt Current debt in position [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @param underlierUpfront Upfront amount of Underlier [WAD]
 * @param targetCollateralizationRatio Targeted collateralization ratio [WAD]
 * @return flashloan amount
 **/ 
 export function computeLeveredWithdrawal(
  collateral,
  normalDebt,
  rate,
  fairPrice,
  fiatToUnderlierRate,
  underlierToCollateralRate,
  underlierUpfront,
  targetCollateralizationRatio
) {
  return 0;
}

/**
 * Computes the flashloan amount (or deltaNormalDebt) for a levered redemption
 * @param collateral Current collateral in position [WAD]
 * @param debt Current debt in position [WAD]
 * @param fairPrice Fair price of collateral [WAD]
 * @param rate Current (virtual) normalDebt to debt rate [WAD]
 * @param fiatToUnderlierRate Exchange rate from FIAT to Underlier token [WAD]
 * @param underlierToCollateralRate Exchange rate from Underlier to Collateral token [WAD]
 * @param underlierUpfront Upfront amount of Underlier [WAD]
 * @param targetCollateralizationRatio Targeted collateralization ratio [WAD]
 * @return flashloan amount
 **/ 
 export function computeLeveredRedemption(
  collateral,
  normalDebt,
  rate,
  fairPrice,
  fiatToUnderlierRate,
  underlierToCollateralRate,
  underlierUpfront,
  targetCollateralizationRatio
) {
  return 0;
}
