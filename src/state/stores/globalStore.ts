import create from 'zustand';
import { FIAT } from '@fiatdao/sdk';
import { BigNumber } from 'ethers';

export type TransactionStatus = null | 'error' | 'sent' | 'confirming' | 'confirmed'; 

const useStore = create<any>()((set: any, get: any) => ({
  fiat: null,
  user: '',
  explorerUrl: '',
  hasProxy: false,
  disableActions: false,
  selectedCollateralTypeId: null,
  selectedPositionId: null,
  transactionData: {
    action: null as null | string,
    status: null as TransactionStatus,
  },
  modifyPositionData: {
    outdated: false,
    collateralType: null as undefined | null | any,
    position: null as undefined | null | any,
    underlierAllowance: null as null | BigNumber, // [underlierScale]
    underlierBalance: null as null | BigNumber, // [underlierScale]
    monetaFIATAllowance: null as null | BigNumber, // [wad]
    proxyFIATAllowance: null as null | BigNumber, // [wad]
  },
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
  resetStore: () => {
    set(() => ({
      fiat: null,
      user: '',
      explorerUrl: '',
      hasProxy: false,
      disableActions: false,
      transactionData: {
        action: null as null | string,
        status: null as TransactionStatus,
      }
    }))
  },
}));

export default useStore;
