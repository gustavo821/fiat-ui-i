import { useQuery } from '@tanstack/react-query';
import * as userActions from '../../../src/actions';

export const collateralTypesKey = {
  all: ['collateralTypesKey'] as const,
  chain: (chainId: number) => [...collateralTypesKey.all, chainId] as const,
};

export function useCollateralTypes(fiat: any, chainId: number) {
  return useQuery({
    queryKey: collateralTypesKey.chain(chainId),
    queryFn: async () => {
      if (!fiat) {
        return []
      }
      const collateralTypesData_ = await fiat.fetchCollateralTypesAndPrices([]);
      const earnableRates = await userActions.getEarnableRate(fiat, collateralTypesData_);

      return collateralTypesData_
        .filter((collateralType: any) => collateralType.metadata != undefined)
        .sort((a: any, b: any) => {
          if (Number(a.properties.maturity) > Number(b.properties.maturity)) return -1;
          if (Number(a.properties.maturity) < Number(b.properties.maturity)) return 1;
          return 0;
        })
        .map((collateralType: any) => {
          const earnableRate = earnableRates.find((item: any) => item.vault === collateralType.properties.vault);
          return {
            ...collateralType,
            earnableRate: earnableRate?.earnableRate,
          };
        });
    },
    initialData: [],
  });
}
