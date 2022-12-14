import create from 'zustand';
import { FIAT } from '@fiatdao/sdk';

const useStore = create<any>()((set: any, get: any) => ({
  fiat: null,
  user: '',
  explorerUrl: '',
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
  resetStore: () => {
    set(() => ({
      fiat: null,
      user: '',
      explorerUrl: ''
    }))
  }
}));

export default useStore;
