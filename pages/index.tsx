import React from 'react';
import type { NextPage } from 'next';
import { chain as chains, useAccount, useNetwork, useProvider } from 'wagmi';
import shallow from 'zustand/shallow'
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { Container, Spacer } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import { WAD } from '@fiatdao/sdk';
import { HeaderBar } from '../src/components/HeaderBar';
import { CollateralTypesTable } from '../src/components/CollateralTypesTable';
import { PositionsTable } from '../src/components/PositionsTable';
import { PositionModal } from '../src/components/PositionModal/PositionModal';
import { decodeCollateralTypeId, decodePositionId, getCollateralTypeData, getPositionData } from '../src/utils';
import * as userActions from '../src/actions';
import { useBorrowStore } from '../src/state/stores/borrowStore';
import { useLeverStore } from '../src/state/stores/leverStore';
import { useCollateralTypes } from '../src/state/queries/useCollateralTypes';
import { userDataKey, useUserData } from '../src/state/queries/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { fiatBalanceKey } from '../src/state/queries/useFiatBalance';
import useStore, { initialState } from '../src/state/stores/globalStore';
import useSoftReset from '../src/hooks/useSoftReset';

const Home: NextPage = () => {
  const provider = useProvider();
  const { address, connector } = useAccount({ onConnect: () => resetState(), onDisconnect: () => resetState() });
  const { chain } = useNetwork();
  const addRecentTransaction = useAddRecentTransaction();

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
  const user = useStore((state) => state.user);
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

  const softReset = useSoftReset();

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

  const setUnderlierAllowanceForProxy = async (fiat: any, amount: BigNumber) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = BigNumber.from(amount).add(modifyPositionData.collateralType.properties.underlierScale);
    const response = await userActions.sendTransaction(
      fiat, false, '', 'setUnderlierAllowanceForProxy', token, 'approve', proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set underlier allowance for Proxy' });
    const underlierAllowance = await token.allowance(user, proxies[0])
    setModifyPositionData({ ...modifyPositionData, underlierAllowance });
  }

  const unsetUnderlierAllowanceForProxy = async (fiat: any) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    const response =  await userActions.sendTransaction(
      fiat, false, '', 'unsetUnderlierAllowanceForProxy', token, 'approve', proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset underlier allowance for Proxy' });
  }

  const setFIATAllowanceForMoneta = async (fiat: any) => {
    const { moneta, vaultEPTActions, fiat: token } = fiat.getContracts();
    const response = await userActions.sendTransaction(
      // approveFIAT is implemented for all Actions contract
      fiat, true, proxies[0], 'setFIATAllowanceForMoneta', vaultEPTActions, 'approveFIAT', moneta.address, ethers.constants.MaxUint256
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set FIAT allowance Moneta' });
    const monetaFIATAllowance = await token.allowance(proxies[0], moneta.address)
    setModifyPositionData({ ...modifyPositionData, monetaFIATAllowance });
  }

  const setFIATAllowanceForProxy = async (fiat: any, amount: BigNumber) => {
    const { fiat: token } = fiat.getContracts();
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = amount.add(WAD);
    const response = await userActions.sendTransaction(
      fiat, false, '', 'setFIATAllowanceForProxy', token, 'approve', proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set  FIAT allowance for Proxy' });
    const proxyFIATAllowance = await token.allowance(user, proxies[0]);
    setModifyPositionData({ ...modifyPositionData, proxyFIATAllowance });
  }

  const unsetFIATAllowanceForProxy = async (fiat: any) => {
    const { fiat: token } = fiat.getContracts();
    const response = await userActions.sendTransaction(
      fiat, false, '', 'unsetFIATAllowanceForProxy', token, 'approve', proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset FIAT allowance for Proxy' });
  }

  // Cycle the first page render to allow styles to load
  React.useEffect(() => {
    setInitialPageLoad(false);
  }, []);

  if (initialPageLoad) return null;

  return (
    <div>
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
        setFIATAllowanceForProxy={setFIATAllowanceForProxy}
        unsetFIATAllowanceForProxy={unsetFIATAllowanceForProxy}
        setFIATAllowanceForMoneta={setFIATAllowanceForMoneta}
        setUnderlierAllowanceForProxy={setUnderlierAllowanceForProxy}
        unsetUnderlierAllowanceForProxy={unsetUnderlierAllowanceForProxy}
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
