import { useCallback } from 'react';
import useStore from '../state/stores/globalStore';
import { collateralTypesKey } from '../state/queries/useCollateralTypes';
import { userDataKey } from '../state/queries/useUserData';
import { fiatBalanceKey } from '../state/queries/useFiatBalance';
import { useQueryClient } from '@tanstack/react-query';

const useSoftReset = () => {
  const softResetStore = useStore((state) => state.softResetStore);
  const queryClient = useQueryClient();
  const softReset = useCallback(() => {
    // Soft reset after a transaction
    softResetStore();
    // Refetch data after a reset
    queryClient.invalidateQueries(collateralTypesKey.all);
    queryClient.invalidateQueries(userDataKey.all);
    queryClient.invalidateQueries(fiatBalanceKey.all);
  }, [softResetStore, queryClient]);

  return softReset;
}

export default useSoftReset;
