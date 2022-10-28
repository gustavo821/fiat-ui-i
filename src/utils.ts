import { ethers } from 'ethers';

export const formatUnixTimestamp = (unixTimestamp: ethers.BigNumberish): string => {
  const date = new Date(Number(unixTimestamp.toString()) * 1000);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function floor2(dec: any) {
  return Math.floor(Number(String(dec)) * 100) / 100;
}

export function floor4(dec: any) {
  return Math.floor(Number(String(dec)) * 10000) / 10000;
}

export const encodeCollateralTypeId = (vault: string, tokenId: ethers.BigNumberish) => {
  return `${vault}-${tokenId.toString()}`;
}

export const decodeCollateralTypeId = (collateralTypeId: string) => {
  const [vault, tokenId] = collateralTypeId.split('-');
  return { vault, tokenId };
}

export const encodePositionId = (vault: string, tokenId: ethers.BigNumberish, owner: string) => {
  return `${vault}-${tokenId.toString()}-${owner}`;
}

export const decodePositionId = (positionId: string) => {
  const [vault, tokenId, owner] = positionId.split('-');
  return { vault, tokenId, owner };
}

export const getCollateralTypeData = (
  collateralTypes: Array<any>, vault: string, tokenId: ethers.BigNumberish
): undefined | any => {
  return collateralTypes.find(({properties: { vault: vault_, tokenId: tokenId_ }}) => (
    vault === vault_ && tokenId.toString() === tokenId_.toString()
  ));
}

export const getPositionData = (
  positions: Array<any>, vault: string, tokenId: ethers.BigNumberish, owner: string
): undefined | any => {
  return positions.find(({ vault: vault_, tokenId: tokenId_, owner: owner_ }) => (
    vault === vault_ && tokenId.toString() === tokenId_.toString() && owner === owner_
  ));
}