import { useCallback } from 'react';
import { BigNumber } from 'ethers';
import { sendTransaction } from '../actions';
import { buildBuyCollateralAndIncreaseLeverArgs, buildSellCollateralAndDecreaseLeverArgs } from '../actions';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import useStore from '../state/stores/globalStore';
import useSoftReset from './useSoftReset';
import { useUserData } from '../state/queries/useUserData';

export const useCreateLeveredPosition = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();
  const softReset = useSoftReset();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const createLeveredPosition = useCallback(async (
    upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber
  ) => {
    const args = await buildBuyCollateralAndIncreaseLeverArgs(
      fiat, user, proxies, modifyPositionData.collateralType, upFrontUnderlier, addDebt, minUnderlierToBuy, minTokenToBuy
    );
    const response = await sendTransaction(
      fiat, true, proxies[0], 'createLeveredPosition', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create levered position' });
    softReset();
  }, [addRecentTransaction, fiat, modifyPositionData.collateralType, proxies, softReset, user]);

  return createLeveredPosition;
}

export const useBuyCollateralAndIncreaseLever = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();
  const softReset = useSoftReset();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const buyCollateralAndIncreaseLever = useCallback(async (
    upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber
  ) => {
    const args = await buildBuyCollateralAndIncreaseLeverArgs(
      fiat, user, proxies, modifyPositionData.collateralType, upFrontUnderlier, addDebt, minUnderlierToBuy, minTokenToBuy
    );
    const response = await sendTransaction(
      fiat, true, proxies[0], 'buyCollateralAndIncreaseLever', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({
      hash: response.transactionHash, description: 'Buy and deposit collateral and increase leverage'
    });
    softReset();
    return response;
  }, [addRecentTransaction, fiat, modifyPositionData.collateralType, proxies, softReset, user]);

  return buyCollateralAndIncreaseLever;
}

export const useSellCollateralAndDecreaseLever = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();
  const softReset = useSoftReset();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const sellCollateralAndDecreaseLever = useCallback(async (
    subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber, minUnderlierToBuy: BigNumber
  ) => {
    const { collateralType, position } = modifyPositionData;
    const args = await buildSellCollateralAndDecreaseLeverArgs(
      fiat, user, proxies, collateralType, subTokenAmount, subDebt, maxUnderlierToSell, minUnderlierToBuy, position
    );
    const response = await sendTransaction(
      fiat, true, proxies[0], 'sellCollateralAndDecreaseLever', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({
      hash: response.transactionHash, description: 'Withdraw and sell collateral and decrease leverage'
    });
    softReset();
    return response;
  }, [addRecentTransaction, fiat, modifyPositionData, proxies, softReset, user]);

  return sellCollateralAndDecreaseLever;
}

