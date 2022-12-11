import { useQuery } from '@tanstack/react-query';

export const userDataKey = {
  all: ['userDataKey'] as const,
  chainAndAddress: (chainId: number, userAddress: string) => [...userDataKey.all, chainId, userAddress] as const,
};

export function useUserData(fiat: any, chainId: number, userAddress: string) {
  return useQuery({
    queryKey: userDataKey.chainAndAddress(chainId, userAddress),
    queryFn: async () => {
      if (!fiat || !userAddress) {
        return {
          positionsData: [],
          proxies: []
        }
      }
      const userData = await fiat.fetchUserData(userAddress);
      return {
        positionsData: userData.flatMap((user: any) => user.positions),
        proxies: userData.filter((user: any) => (user.isProxy === true)).map((user: any) => user.user),
      }
    },
    initialData: {
      positionsData: [],
      proxies: []
    },
    enabled: fiat != null,
  });
}
