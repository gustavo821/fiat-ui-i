import React from 'react';
import type { NextPage } from 'next';
import { chain as chains, useAccount, useNetwork, useProvider, useSwitchNetwork } from 'wagmi';
import shallow from 'zustand/shallow'
import { Container, Spacer } from '@nextui-org/react';
import { HeaderBar } from '../src/components/HeaderBar';
import { CollateralTypesTable } from '../src/components/CollateralTypesTable';
import { PositionsTable } from '../src/components/PositionsTable';
import { PositionModal } from '../src/components/PositionModal/PositionModal';
import { decodeCollateralTypeId, decodePositionId, getCollateralTypeData, getPositionData } from '../src/utils';
import { useBorrowStore } from '../src/state/stores/borrowStore';
import { useLeverStore } from '../src/state/stores/leverStore';
import { useCollateralTypes } from '../src/state/queries/useCollateralTypes';
import { userDataKey, useUserData } from '../src/state/queries/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { fiatBalanceKey } from '../src/state/queries/useFiatBalance';
import useStore, { initialState } from '../src/state/stores/globalStore';
import { ForkControls } from 'react-tenderly-fork-controls';
import { JsonRpcProvider } from '@ethersproject/providers';
import { useImpersonatingAddress } from 'react-tenderly-fork-controls';

const Home: NextPage = () => {
  const provider = useProvider() as JsonRpcProvider;
  const { address, connector } = useAccount({ onConnect: () => resetState(), onDisconnect: () => resetState() });
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork()
  const impersonatingAddress = useImpersonatingAddress();
  console.log({impersonatingAddress})

  // Only select necessary actions off of the store to minimize re-renders
  const borrowStore = useBorrowStore(
    React.useCallback(
      (state) => ({
        reset: state.reset,
      }),
      []
    ), shallow
  );

  // Only select necessary actions off of the store to minimize re-renders
  const leverStore = useLeverStore(
    React.useCallback(
      (state) => ({
        reset: state.reset,
      }),
      []
    ), shallow
  );

  const queryClient = useQueryClient();

  const [initialPageLoad, setInitialPageLoad] = React.useState<boolean>(true);
  const [setupListeners, setSetupListeners] = React.useState(false);

  const fiat = useStore((state) => state.fiat);
  const fiatFromSigner = useStore((state) => state.fiatFromSigner);
  const fiatFromProvider = useStore((state) => state.fiatFromProvider);
  const setUser = useStore((state) => state.setUser);
  const setExplorerUrl = useStore((state) => state.setExplorerUrl);
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const setModifyPositionData = useStore((state) => state.setModifyPositionData);
  const selectedCollateralTypeId = useStore((state) => state.selectedCollateralTypeId);
  const setSelectedCollateralTypeId = useStore((state) => state.setSelectedCollateralTypeId);
  const selectedPositionId = useStore((state) => state.selectedPositionId);
  const setSelectedPositionId = useStore((state) => state.setSelectedPositionId);
  const resetStore = useStore((state) => state.resetStore);

  const { data: collateralTypesData } = useCollateralTypes(fiat, chain?.id ?? chains.mainnet.id);
  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { positionsData, proxies } = userData as any;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function resetState() {
    setSetupListeners(false);
    resetStore();
    queryClient.invalidateQueries(userDataKey.all);
    queryClient.invalidateQueries(fiatBalanceKey.all);
  }

  // Reset state if network or account changes
  React.useEffect(() => {
    if (!connector || setupListeners) return;
    connector.on('change', () => resetState());
    setSetupListeners(true);
  }, [setupListeners, connector, resetState]);

  React.useEffect(() => {
    if (!provider || fiat || connector || !fiatFromProvider) return;
    fiatFromProvider(provider)
  }, [provider, connector, fiat, fiatFromProvider])

  // Fetch block explorer data
  React.useEffect(() => {
    if (!chain?.blockExplorers?.etherscan?.url) return;
    setExplorerUrl(chain?.blockExplorers?.etherscan?.url);
  }, [connector, chain?.blockExplorers?.etherscan?.url, setExplorerUrl]);

  // Fetch User data, Vault data, and set Fiat SDK in global state
  React.useEffect(() => {
    if (!connector) return;
    
    (async function () {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      setUser(user);
      fiatFromSigner(signer)
    })();
    // Address and chain dependencies are needed to recreate FIAT sdk object on account or chain change,
    // even though their values aren't used explicitly.
  }, [connector, address, chain, fiatFromSigner, setUser]);

  // Populate ModifyPosition data
  React.useEffect(() => {
    if (
      modifyPositionData.collateralType !== null
      || (selectedCollateralTypeId == null && selectedPositionId == null)
    ) return;

    const { vault, tokenId } = decodeCollateralTypeId((selectedCollateralTypeId || selectedPositionId as string));
    const collateralType = getCollateralTypeData(collateralTypesData, vault, tokenId)

    let position;
    if (selectedPositionId) {
      const { owner } = decodePositionId(selectedPositionId);
      position = getPositionData(positionsData, vault, tokenId, owner);
    }
    const data = { ...modifyPositionData, collateralType, position };

    setModifyPositionData({...data});

    (async function () {
      // For positions with proxies, fetch underlier balance, allowance, fiat allowance, and moneta delegation enablement
      if (proxies.length === 0) return;
      const [proxy] = proxies;
      if (
        !fiat ||
        data.collateralType == null ||
        (data.position &&
          data.position.owner.toLowerCase() !== proxy.toLowerCase())
      ) {
        return;
      }

      const { moneta, fiat: fiatToken } = fiat.getContracts();
      const underlier = fiat.getERC20Contract(data.collateralType.properties.underlierToken);

      const signer = (await connector?.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const [underlierAllowance, underlierBalance, monetaFIATAllowance, proxyFIATAllowance] = await fiat.multicall([
        { contract: underlier, method: 'allowance', args: [user, proxy] },
        { contract: underlier, method: 'balanceOf', args: [user] },
        { contract: fiatToken, method: 'allowance', args: [proxy, moneta.address] },
        { contract: fiatToken, method: 'allowance', args: [user, proxy] }
      ]);

      setModifyPositionData({
        ...modifyPositionData, ...data, underlierAllowance, underlierBalance, monetaFIATAllowance, proxyFIATAllowance
      });
    })();

  }, [connector, collateralTypesData, positionsData, selectedCollateralTypeId, selectedPositionId, modifyPositionData, setModifyPositionData, borrowStore, proxies, fiat]);

  // Cycle the first page render to allow styles to load
  React.useEffect(() => {
    setInitialPageLoad(false);
  }, []);

  if (initialPageLoad) return null;

  return (
    <div>
      <ForkControls provider={provider} forkType="ganache" chain={chain} switchNetwork={switchNetwork} />
      <HeaderBar />
      <Container lg>
        {
          !positionsData || positionsData.length === 0
            ? null
            : (
              <>
                <PositionsTable />
                <Spacer y={2} />
              </>
            )
        }
      </Container>
      <Container lg>
        <CollateralTypesTable />
      </Container>

      <PositionModal
        open={!!modifyPositionData && (!!selectedCollateralTypeId || !!selectedPositionId)}
        onClose={() => {
          setSelectedPositionId(initialState.selectedPositionId);
          setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          borrowStore.reset();
          leverStore.reset();
        }}
      />
      <Spacer />
    </div>
  );
};

export default Home;
