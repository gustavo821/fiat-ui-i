import { useCallback } from 'react';
import { BigNumber, ethers } from 'ethers';
import { sendTransaction } from '../actions';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import useStore from '../state/stores/globalStore';
import { useUserData } from '../state/queries/useUserData';
import { WAD } from '@fiatdao/sdk';

export const useSetUnderlierAllowanceForProxy = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const setModifyPositionData = useStore((state) => state.setModifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const setUnderlierAllowanceForProxy = useCallback(async (amount: BigNumber) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = BigNumber.from(amount).add(modifyPositionData.collateralType.properties.underlierScale);
    const response = await sendTransaction(
      fiat, false, '', 'setUnderlierAllowanceForProxy', token, 'approve', proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set underlier allowance for Proxy' });
    const underlierAllowance = await token.allowance(user, proxies[0])
    setModifyPositionData({ ...modifyPositionData, underlierAllowance });
  }, [fiat, addRecentTransaction, modifyPositionData, setModifyPositionData, proxies, user]);

  return setUnderlierAllowanceForProxy;
}

export const useUnsetUnderlierAllowanceForProxy = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();

  const fiat = useStore(state => state.fiat);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const unsetUnderlierAllowanceForProxy = useCallback(async () => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    const response =  await sendTransaction(
      fiat, false, '', 'unsetUnderlierAllowanceForProxy', token, 'approve', proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset underlier allowance for Proxy' });
  }, [fiat, addRecentTransaction, modifyPositionData, proxies]);

  return unsetUnderlierAllowanceForProxy;
}

export const useSetFIATAllowanceForMoneta = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();

  const fiat = useStore(state => state.fiat);
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const setModifyPositionData = useStore((state) => state.setModifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const useSetFIATAllowanceForMoneta = useCallback(async () => {
    const { moneta, vaultEPTActions, fiat: token } = fiat.getContracts();
    const response = await sendTransaction(
      // approveFIAT is implemented for all Actions contract
      fiat, true, proxies[0], 'setFIATAllowanceForMoneta', vaultEPTActions, 'approveFIAT', moneta.address, ethers.constants.MaxUint256
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set FIAT allowance Moneta' });
    const monetaFIATAllowance = await token.allowance(proxies[0], moneta.address)
    setModifyPositionData({ ...modifyPositionData, monetaFIATAllowance });
  }, [fiat, addRecentTransaction, modifyPositionData, setModifyPositionData, proxies]);

  return useSetFIATAllowanceForMoneta;
}

export const useSetFIATAllowanceForProxy = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();

  const fiat = useStore(state => state.fiat);
  const user = useStore((state) => state.user);
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const setModifyPositionData = useStore((state) => state.setModifyPositionData);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const setFIATAllowanceForProxy = useCallback(async (amount: BigNumber) => {
    const { fiat: token } = fiat.getContracts();
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = amount.add(WAD);
    const response = await sendTransaction(
      fiat, false, '', 'setFIATAllowanceForProxy', token, 'approve', proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set  FIAT allowance for Proxy' });
    const proxyFIATAllowance = await token.allowance(user, proxies[0]);
    setModifyPositionData({ ...modifyPositionData, proxyFIATAllowance });
  }, [fiat, addRecentTransaction, modifyPositionData, setModifyPositionData, proxies, user]);

  return setFIATAllowanceForProxy;
}

export const useUnsetFIATAllowanceForProxy = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();

  const fiat = useStore(state => state.fiat);

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const unsetFIATAllowanceForProxy = useCallback(async () => {
    const { fiat: token } = fiat.getContracts();
    const response = await sendTransaction(
      fiat, false, '', 'unsetFIATAllowanceForProxy', token, 'approve', proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset FIAT allowance for Proxy' });
  }, [fiat, addRecentTransaction, proxies]);

  return unsetFIATAllowanceForProxy;
}
