import { ethers } from 'ethers';

export const ZERO = ethers.constants.Zero;
export const WAD = ethers.utils.parseUnits('1', '18');
export const ADDRESS_ZERO = ethers.constants.AddressZero;
export const YEAR_IN_SECONDS = ethers.BigNumber.from(31622400);


// value: BigNumberish -> BigNumber
export function toBigNumber(value) {
  // toString() is supported by String, Number, BigNumber
  return ethers.BigNumber.from(value.toString());
}

// decimal: BigNumberish -> BigNumber
export function decToWad(decimal) {
  return ethers.utils.parseUnits(decimal.toString(), '18');
}

// wad: BigNumberish -> string
export function wadToDec(wad) {
  return ethers.utils.formatUnits(toBigNumber(wad), '18');
}

// amount: BigNumberish, toScale: BigNumberish -> BigNumber
export function decToScale(amount, toScale) {
  return ethers.utils.parseUnits(amount.toString(), String(toScale.toString().length - 1));
}

// amount: BigNumberish, fromScale: BigNumberish -> string
export function scaleToDec(amount, fromScale) {
  return ethers.utils.formatUnits(toBigNumber(amount), String(fromScale.toString().length - 1));
}

// amount: BigNumberish, fromScale: BigNumberish -> BigNumber
export function scaleToWad(amount, fromScale) {
  if (toBigNumber(fromScale).isZero()) return ZERO;
  return toBigNumber(amount).mul(WAD).div(fromScale.toString());
}

// amount: BigNumberish, fromScale: BigNumberish -> BigNumber
export function wadToScale(wad, toScale) {
  return toBigNumber(wad).mul(toScale.toString()).div(WAD);
}

export function toBytes32(str) {
  return ethers.utils.formatBytes32String(str);
}

export function encode4Byte(contract, method) {
  return ethers.utils.defaultAbiCoder.encode(['bytes4'], [contract.interface.getSighash(method)]);
}

export function addressEq(addressA, addressB) {
  return ethers.utils.getAddress(addressA) === ethers.utils.getAddress(addressB);
}
