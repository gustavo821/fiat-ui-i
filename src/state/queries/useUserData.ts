import { useQuery } from '@tanstack/react-query';
import useStore from '../stores/globalStore';
import { controlsStore } from '@barnbridge/react-tenderly-fork-controls';

export const userDataKey = {
  all: ['userDataKey'] as const,
  chainAndAddress: (chainId: number, userAddress: string) => [...userDataKey.all, chainId, userAddress] as const,
};

export function useUserData(fiat: any, chainId: number, userAddress: string) {
  return useQuery({
    queryKey: userDataKey.chainAndAddress(chainId, userAddress),
    queryFn: async () => {
      if (!fiat || !userAddress) {
        useStore.setState({hasProxy: false});
        return {
          positionsData: [],
          proxies: []
        }
      }
      const enabledControls = controlsStore.getState().enableForkMode;
      const userData = !enabledControls ? await fiat.fetchUserData(userAddress) : await fiat.fetchUserDataViaProvider(userAddress);
      const proxies = userData.filter((user: any) => (user.isProxy === true)).map((user: any) => user.user);
      useStore.setState({hasProxy: proxies.length > 0});

      return {
        positionsData: userData.flatMap((user: any) => user.positions),
        proxies,
      }
    },
    initialData: {
      positionsData: [],
      proxies: []
    },
    enabled: fiat != null,
  });
}
