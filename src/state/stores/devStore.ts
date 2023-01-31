import create from 'zustand';
import { BigNumber } from 'ethers';
import { getProvider } from '@wagmi/core'
import { USE_FORK } from '../../components/HeaderBar';

const initialState = {
  impersonateAddress: '',
  ganacheTime: new Date() as Date,
}

const devStore = create<any>()((set: any) => ({
  impersonateAddress: initialState.impersonateAddress,
  ganacheTime: initialState.ganacheTime,
  setImpersonateAddress: (address: string) => {
    set(() => ({
      impersonateAddress: address,
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
}));

export default devStore;
