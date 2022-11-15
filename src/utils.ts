import { BigNumber, ethers } from 'ethers';
import { decToWad, scaleToDec, wadToDec, ZERO } from '@fiatdao/sdk';

export const formatUnixTimestamp = (unixTimestamp: ethers.BigNumberish): string => {
  const date = new Date(Number(unixTimestamp.toString()) * 1000);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

export function floor2(dec: ethers.BigNumberish): number {
  return Math.floor(Number(String(dec)) * 100) / 100;
}

export function floor4(dec: ethers.BigNumberish): number {
  return Math.floor(Number(String(dec)) * 10000) / 10000;
}

export const commifyToDecimalPlaces = (value: BigNumber, scale: number, decimalPlaces: number): string => {
  const parts = ethers.utils.commify(scaleToDec(value, scale)).split('.');
  return parts[0] + '.' + parts[1].slice(0, decimalPlaces);
};

export const earnableRateToAPY = (earnableRate: BigNumber, maturity: ethers.BigNumberish): BigNumber => {
  const now = Math.floor(Date.now() / 1000)
  if (now >= Number(maturity.toString())) return ZERO;
  const secondsUntilMaturity = Number(maturity.toString()) - Math.floor(Date.now() / 1000);
  const yearFraction = secondsUntilMaturity / 31622400;
  return ethers.BigNumber.from(
    decToWad((Math.pow((1 + Number(wadToDec(earnableRate))), (1 / yearFraction )) - 1).toFixed(10))
  );
};

export const interestPerSecondToRateUntilMaturity = (
  interestPerSecond: ethers.BigNumberish, maturity: ethers.BigNumberish
): BigNumber => {
  const now = Math.floor(Date.now() / 1000)
  if (now >= Number(maturity.toString())) return ZERO;
  const secondsUntilMaturity = Number(maturity.toString()) - Math.floor(Date.now() / 1000);
  return decToWad(
    (Math.pow(Number(wadToDec(ethers.BigNumber.from(interestPerSecond)).slice(0, 17)), secondsUntilMaturity) - 1)
      .toFixed(10)
  );
}

export const interestPerSecondToAPY = (interestPerSecond: ethers.BigNumberish): BigNumber => {
  return decToWad(
    (Math.pow(Number(wadToDec(ethers.BigNumber.from(interestPerSecond)).slice(0, 17)), 31622400) - 1).toFixed(10)
  );
};

export const encodeCollateralTypeId = (vault: string, tokenId: ethers.BigNumberish): string => {
  return `${vault}-${tokenId.toString()}`;
};

export const decodeCollateralTypeId = (collateralTypeId: string) => {
  const [vault, tokenId] = collateralTypeId.split('-');
  return { vault, tokenId };
};

export const encodePositionId = (vault: string, tokenId: ethers.BigNumberish, owner: string): string => {
  return `${vault}-${tokenId.toString()}-${owner}`;
};

export const decodePositionId = (positionId: string) => {
  const [vault, tokenId, owner] = positionId.split('-');
  return { vault, tokenId, owner };
};

export const getCollateralTypeData = (
  collateralTypes: Array<any>, vault: string, tokenId: ethers.BigNumberish
): undefined | any => {
  return collateralTypes.find(({properties: { vault: vault_, tokenId: tokenId_ }}) => (
    vault === vault_ && tokenId.toString() === tokenId_.toString()
  ));
};

export const getPositionData = (
  positions: Array<any>, vault: string, tokenId: ethers.BigNumberish, owner: string
): undefined | any => {
  return positions.find(({ vault: vault_, tokenId: tokenId_, owner: owner_ }) => (
    vault === vault_ && tokenId.toString() === tokenId_.toString() && owner === owner_
  ));
};

// Take a function as an argument and returns a "debounced" version. This debounced
// version will only be executed after `delay` milliseconds have passed after it's last invocation
export function debounce<F extends (...args: Parameters<F>) => ReturnType<F>>(
  func: F,
  delay = 500,): (...args: Parameters<F>) => void {
  let timeout: number | NodeJS.Timeout;
  return (...args: Parameters<F>): void => {
    clearTimeout(timeout as number); // this number cast is for browser support NodeJS.Timeout is for Node envs and so tsc stops whining
    timeout = setTimeout(() => func(...args), delay);
  };
}
