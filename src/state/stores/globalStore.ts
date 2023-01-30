import create from 'zustand';
import { FIAT } from '@fiatdao/sdk';
import { BigNumber } from 'ethers';
import { getProvider } from '@wagmi/core'
import { USE_FORK } from '../../components/HeaderBar';

export type TransactionStatus = null | 'error' | 'sent' | 'confirming' | 'confirmed'; 

export const initialState = {
  fiat: null,
  impersonateAddress: '',
  user: '',
  explorerUrl: '',
  hasProxy: false,
  disableActions: false,
  selectedPositionId: null as null | string,
  selectedCollateralTypeId: null as null | string,
  modifyPositionData: {
    outdated: false,
    collateralType: null as undefined | null | any,
    position: null as undefined | null | any,
    underlierAllowance: null as null | BigNumber, // [underlierScale]
    underlierBalance: null as null | BigNumber, // [underlierScale]
    monetaFIATAllowance: null as null | BigNumber, // [wad]
    proxyFIATAllowance: null as null | BigNumber, // [wad]
  },
  transactionData: {
    action: null as null | string,
    status: null as TransactionStatus,
  },
  ganacheTime: new Date() as Date,
}

const useStore = create<any>()((set: any) => ({
  fiat: initialState.fiat,
  user: initialState.user,
  impersonateAddress: initialState.impersonateAddress,
  explorerUrl: initialState.explorerUrl,
  hasProxy: initialState.hasProxy,
  disableActions: initialState.disableActions,
  selectedCollateralTypeId: initialState.selectedCollateralTypeId,
  selectedPositionId: initialState.selectedPositionId,
  transactionData: initialState.transactionData,
  modifyPositionData: initialState.modifyPositionData,
  ganacheTime: initialState.ganacheTime,
  fiatFromProvider: async (provider: any) => {
    const fiatProvider = await FIAT.fromProvider(provider, null);
    set(() => ({
      fiat: fiatProvider
    }));
  },
  fiatFromSigner: async (signer: any) => {
    const fiatSigner = await FIAT.fromSigner(signer, null);
    set(() => ({
      fiat: fiatSigner
    }));
  },
  setUser: (address: string) => {
    set(() => ({
      user: address
    }))
  },
  setImpersonateAddress: (address: string) => {
    set(() => ({
      impersonateAddress: address,
    }))
  },
  setExplorerUrl: (url: string) => {
    set(() => ({
      explorerUrl: url
    }))
  },
  setSelectedCollateralTypeId: (id: string) => {
    set(() => ({
      selectedCollateralTypeId: id
    }))
  },
  setSelectedPositionId: (id: string) => {
    set(() => ({
      selectedPositionId: id
    }))
  },
  setTransactionData: (data: any) => {
    set(() => ({
      disableActions: data.status === 'sent',
      transactionData: data
    }));
  },
  setModifyPositionData: (data: any) => {
    set(() => ({
      modifyPositionData: data
    }))
  },
  getGanacheTime: async () => {
    if (!USE_FORK) return;
    const provider = getProvider() as any;
    const result = await provider.send('eth_getBlockByNumber', ['latest', false]);
    const timestamp = BigNumber.from(result.timestamp).toNumber() * 1000;
    set(() => ({
      ganacheTime: new Date(timestamp)
    }))
  },
  softResetStore: () => {
    set(() => ({
      disableActions: initialState.disableActions,
      modifyPositionData: initialState.modifyPositionData,
      transactionData: initialState.transactionData,
      selectedPositionId: initialState.selectedPositionId,
      selectedCollateralTypeId: initialState.selectedCollateralTypeId
    }))
  },
  resetStore: () => {
    set((state: any) => ({
      ...initialState,
      ganacheTime: state.ganacheTime,
      impersonateAddress: state.impersonateAddress,
    }))
  },
}));

export default useStore;
