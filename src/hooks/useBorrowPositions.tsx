import { useCallback } from 'react';
import { BigNumber } from 'ethers';
import { sendTransaction } from '../actions';
import { buildBuyCollateralAndModifyDebtArgs, buildModifyCollateralAndDebtArgs, buildSellCollateralAndModifyDebtArgs, buildRedeemCollateralAndModifyDebtArgs } from '../actions';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import useStore from '../state/stores/globalStore';
import useSoftReset from './useSoftReset';
import { useUserData } from '../state/queries/useUserData';

export const useCreatePosition = () => {

  const { chain } = useNetwork();
  const { address } = useAccount();
  const addRecentTransaction = useAddRecentTransaction();
  const softReset = useSoftReset();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;

  const createPosition = useCallback(async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const args = buildBuyCollateralAndModifyDebtArgs(
      fiat, user, proxies, modifyPositionData.collateralType, deltaCollateral, deltaDebt, underlier
    );
    const response = await sendTransaction(
      fiat, true, proxies[0], 'createPosition', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create position' });
    softReset();
  }, [addRecentTransaction, fiat, modifyPositionData.collateralType, proxies, softReset, user])

  return createPosition;
}

export const useBuyCollateralAndModifyDebt = () => {
  const { chain } = useNetwork();
  const { address } = useAccount();
  const addRecentTransaction = useAddRecentTransaction();
  const softReset = useSoftReset();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;

  const buyCollateralAndModifyDebt = useCallback(async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
       // increase (mint)
      const args = buildModifyCollateralAndDebtArgs(fiat, user, proxies, collateralType, deltaDebt, position);
      const response = await sendTransaction(
        fiat, true, proxies[0], 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Borrow FIAT' });
      softReset();
    } else {
      const args = buildBuyCollateralAndModifyDebtArgs(
        fiat, user, proxies, collateralType, deltaCollateral, deltaDebt, underlier
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'buyCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Buy and deposit collateral and borrow FIAT'
      });
      softReset();
      return response;
    }
  } ,[addRecentTransaction, fiat, modifyPositionData, proxies, softReset, user]);
  
  return buyCollateralAndModifyDebt;
}

export const useSellCollateralAndModifyDebt = () => {
  const { chain } = useNetwork();
  const { address } = useAccount();
  const addRecentTransaction = useAddRecentTransaction();
  const softReset = useSoftReset();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;

  const sellCollateralAndModifyDebt = useCallback(async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
      // decrease (pay back)
      const args = buildModifyCollateralAndDebtArgs(
        fiat, user, proxies, collateralType, deltaDebt.mul(-1), position
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Repay borrowed FIAT' });
      softReset();
    }
    else {
      const args = buildSellCollateralAndModifyDebtArgs(
        fiat, user, proxies, collateralType, deltaCollateral, deltaDebt, underlier, position,
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'sellCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Withdraw and sell collateral and repay borrowed FIAT'
      });
      softReset();
    }
  } ,[addRecentTransaction, fiat, modifyPositionData, proxies, softReset, user]);
  
  return sellCollateralAndModifyDebt;
}

export const useRedeemCollateralAndModifyDebt = () => {
  const { chain } = useNetwork();
  const { address } = useAccount();
  const addRecentTransaction = useAddRecentTransaction();
  const softReset = useSoftReset();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;

  const redeemCollateralAndModifyDebt = useCallback(async (deltaCollateral: BigNumber, deltaDebt: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
       // decrease (pay back)
      const args = buildModifyCollateralAndDebtArgs(
        fiat, user, proxies, collateralType, deltaDebt.mul(-1), position
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Repay borrowed FIAT' });
      softReset();
    }
    else {
      const args = buildRedeemCollateralAndModifyDebtArgs(
        fiat, user, proxies, collateralType, deltaCollateral, deltaDebt, position
      );
      const response = await sendTransaction(
        fiat, true, proxies[0], 'redeemCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Withdraw and redeem collateral and repay borrowed FIAT'
      });
      softReset();
    }
  } ,[addRecentTransaction, fiat, modifyPositionData, proxies, softReset, user]);
  
  return redeemCollateralAndModifyDebt;
}