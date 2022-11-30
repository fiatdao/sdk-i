import { ethers } from 'ethers';

export const ZERO = ethers.constants.Zero;
export const WAD = ethers.utils.parseUnits('1', '18');

// decimal: BigNumberish -> BigNumber
export function decToWad(decimal) {
  return ethers.utils.parseUnits(String(decimal), '18');
}

// wad: BigNumberish -> string
export function wadToDec(wad) {
  return ethers.utils.formatUnits(wad, '18');
}

// amount: BigNumberish, toScale: BigNumberish -> BigNumber
export function decToScale(amount, toScale) {
  return ethers.utils.parseUnits(String(amount), String(toScale.toString().length - 1));
}

// amount: BigNumberish, fromScale: BigNumberish -> string
export function scaleToDec(amount, fromScale) {
  return ethers.utils.formatUnits(amount, String(fromScale.toString().length - 1));
}

// amount: BigNumberish, fromScale: BigNumberish -> BigNumber
export function scaleToWad(amount, fromScale) {
  if (ethers.BigNumber.from(fromScale.toString()).isZero()) return ZERO;
  return ethers.BigNumber.from(amount.toString()).mul(WAD).div(fromScale.toString());
}

// amount: BigNumberish, fromScale: BigNumberish -> BigNumber
export function wadToScale(wad, toScale) {
  return ethers.BigNumber.from(wad.toString()).mul(toScale.toString()).div(WAD);
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

// const convertToHumanReadableValue = (value: BigNumber, scale: number): string => {
//   const parts = ethers.utils.commify(scaleToDec(value, scale)).toString().split('.')
//   return parts[0] + '.' + parts[1].slice(0,2)
// }
