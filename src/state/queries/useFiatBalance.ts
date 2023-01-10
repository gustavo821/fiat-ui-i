import { useQuery } from '@tanstack/react-query';
import { wadToDec } from '@fiatdao/sdk';

export const fiatBalanceKey = {
  all: ['fiatBalance'] as const,
  chainAndAddress: (chainId: number, userAddress: string) => [...fiatBalanceKey.all, chainId, userAddress] as const,
};

export function useFiatBalance(fiat: any, chainId: number, userAddress: string) {
  return useQuery({
    queryKey: fiatBalanceKey.chainAndAddress(chainId, userAddress),
    queryFn: async () => {
      if (!fiat || !userAddress) {
        return ''
      }
      const { fiat: fiatToken } = fiat.getContracts();
      const fiatBalance = await fiatToken.balanceOf(userAddress);
      return `${parseFloat(wadToDec(fiatBalance)).toFixed(2)} FIAT`
    },
    enabled: fiat != null,
  });
}
