import { useCallback } from 'react';
import { BigNumber } from 'ethers';
import { sendTransaction } from '../actions';
import { buildBuyCollateralAndModifyDebtArgs, buildModifyCollateralAndDebtArgs } from '../actions';
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