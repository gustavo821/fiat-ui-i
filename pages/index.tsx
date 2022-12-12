import React from 'react';
import type { NextPage } from 'next';
import { chain as chains, useAccount, useNetwork, useProvider } from 'wagmi';
import shallow from 'zustand/shallow'
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { Container, Spacer } from '@nextui-org/react';
import { BigNumber, ContractReceipt, ethers } from 'ethers';
import { FIAT, WAD, wadToDec } from '@fiatdao/sdk';
import { HeaderBar } from '../src/components/HeaderBar';
import { CollateralTypesTable } from '../src/components/CollateralTypesTable';
import { PositionsTable } from '../src/components/PositionsTable';
import { PositionModal } from '../src/components/PositionModal/PositionModal';
import {
  decodeCollateralTypeId, decodePositionId, encodePositionId, getCollateralTypeData, getPositionData
} from '../src/utils';
import * as userActions from '../src/actions';
import { useBorrowStore } from '../src/state/stores/borrowStore';
import { collateralTypesKey, useCollateralTypes } from '../src/state/queries/useCollateralTypes';
import { userDataKey, useUserData } from '../src/state/queries/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { fiatBalanceKey } from '../src/state/queries/useFiatBalance';

export type TransactionStatus = null | 'error' | 'sent' | 'confirming' | 'confirmed';

const Home: NextPage = () => {
  const provider = useProvider();
  const { address, connector } = useAccount({ onConnect: () => resetState(), onDisconnect: () => resetState() });
  const { chain } = useNetwork();
  const addRecentTransaction = useAddRecentTransaction();

  const initialState = React.useMemo(() => ({
    setupListeners: false,
    contextData: {
      fiat: null as null | FIAT,
      explorerUrl: null as null | string,
      user: null as null | string,
    },
    selectedPositionId: null as null | string,
    selectedCollateralTypeId: null as null | string,
    modifyPositionData: {
      outdated: false,
      collateralType: null as undefined | null | any,
      position: null as undefined | null | any,
      underlierAllowance: null as null | BigNumber, // [underlierScale]
      underlierBalance: null as null | BigNumber, // [underlierScale]
      monetaFIATAllowance: null as null | BigNumber, // [wad]
      proxyFIATAllowance: null as null | BigNumber, // [wad]
    },
    transactionData: {
      action: null as null | string,
      status: null as TransactionStatus,
    },
  }), []) 

  // Only select necessary actions off of the store to minimize re-renders
  const borrowStore = useBorrowStore(
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
  const [contextData, setContextData] = React.useState(initialState.contextData);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);
  const [selectedPositionId, setSelectedPositionId] = React.useState(initialState.selectedPositionId);
  const [selectedCollateralTypeId, setSelectedCollateralTypeId] = React.useState(initialState.selectedCollateralTypeId);

  const { data: collateralTypesData, isFetching: isFetchingCollateralTypes } = useCollateralTypes(contextData.fiat, chain?.id ?? chains.mainnet.id);
  const { data: userData, isFetching: isFetchingPositionsData } = useUserData(contextData.fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { positionsData, proxies } = userData as any;

  const disableActions = React.useMemo(() => transactionData.status === 'sent', [transactionData.status])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function resetState() {
    setSetupListeners(initialState.setupListeners);
    setContextData(initialState.contextData);
    setModifyPositionData(initialState.modifyPositionData);
    setTransactionData(initialState.transactionData);
    setSelectedPositionId(initialState.selectedPositionId);
    setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
    queryClient.invalidateQueries(userDataKey.all);
    queryClient.invalidateQueries(fiatBalanceKey.all);
  }

  const softReset = () => {
    // Soft reset after a transaction
    setModifyPositionData(initialState.modifyPositionData);
    setTransactionData(initialState.transactionData);
    setSelectedPositionId(initialState.selectedPositionId);
    setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
    // Refetch data after a reset
    queryClient.invalidateQueries(collateralTypesKey.all);
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
    if (!provider || contextData.fiat || connector) return;
    (async function () {
      const fiat = await FIAT.fromProvider(provider, null);
      setContextData((curContextData) => ({
        ...curContextData,
        fiat,
      }));
    })();
  }, [provider, connector, contextData.fiat])

  // Fetch block explorer data
  React.useEffect(() => {
    if (!chain?.blockExplorers?.etherscan?.url) return;
    setContextData((curContextData) => ({
      ...curContextData,
      explorerUrl: chain?.blockExplorers?.etherscan?.url || '',
    }));
  }, [connector, chain?.blockExplorers?.etherscan?.url]);

  // Fetch User data, Vault data, and set Fiat SDK in global state
  React.useEffect(() => {
    if (!connector) return;
    
    (async function () {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const fiat = await FIAT.fromSigner(signer, undefined);
      setContextData((curContextData) => ({
        ...curContextData,
        fiat,
        user,
      }));
    })();
    // Address and chain dependencies are needed to recreate FIAT sdk object on account or chain change,
    // even though their values aren't used explicitly.
  }, [connector, address, chain]);

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
        !contextData.fiat ||
        data.collateralType == null ||
        (data.position &&
          data.position.owner.toLowerCase() !== proxy.toLowerCase())
      ) {
        return;
      }

      const { moneta, fiat } = contextData.fiat.getContracts();
      const underlier = contextData.fiat.getERC20Contract(data.collateralType.properties.underlierToken);

      const signer = (await connector?.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const [underlierAllowance, underlierBalance, monetaFIATAllowance, proxyFIATAllowance] = await contextData.fiat.multicall([
        { contract: underlier, method: 'allowance', args: [user, proxy] },
        { contract: underlier, method: 'balanceOf', args: [user] },
        { contract: fiat, method: 'allowance', args: [proxy, moneta.address] },
        { contract: fiat, method: 'allowance', args: [user, proxy] }
      ]);

      setModifyPositionData({
        ...modifyPositionData, ...data, underlierAllowance, underlierBalance, monetaFIATAllowance, proxyFIATAllowance
      });
    })();

  }, [connector, contextData, collateralTypesData, positionsData, selectedCollateralTypeId, selectedPositionId, modifyPositionData, borrowStore, proxies]);

  const sendTransaction = async (
    fiat: any, useProxy: boolean, action: string, contract: ethers.Contract, method: string, ...args: any[]
  ): Promise<ContractReceipt> => {
    try {
      setTransactionData({ action, status: 'sent' });
      // Dryrun every transaction first to catch and decode errors
      const dryrunResp = useProxy
        ? await fiat.dryrunViaProxy(proxies[0], contract, method, ...args)
        : await fiat.dryrun(contract, method, ...args);
      if (!dryrunResp.success) {
        const reason = dryrunResp.reason !== undefined ? 'Reason: ' + dryrunResp.reason + '.' : '';
        const customError = dryrunResp.customError !== undefined ? 'Custom error: ' + dryrunResp.customError + '.' : '';
        const error = dryrunResp.error !== undefined ? dryrunResp.error + '.' : '';
        // Throw conglomerate error message to prevent sendAndWait from running and throwing a less user-friendly error
        throw new Error(reason + customError + error);
      }

      const resp = useProxy
        ? await fiat.sendAndWaitViaProxy(proxies[0], contract, method, ...args)
        : await fiat.sendAndWait(contract, method, ...args);
      setTransactionData(initialState.transactionData);
      return resp;
    } catch (e: any) {
      console.error(e);
      setTransactionData({ ...transactionData, status: 'error' });
      if (e && e.code && e.code === 'ACTION_REJECTED') {
        // handle rejected transactions by user
        throw new Error('ACTION_REJECTED');
      } else {
        // Should be caught by caller to set appropriate errors
        throw e;
      }
    }
  }

  const createProxy = async (fiat: any, user: string) => {
    const response = await sendTransaction(
      fiat, false, 'createProxy', fiat.getContracts().proxyRegistry, 'deployFor', user
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create Proxy account' });
    // Refetch User data query to get proxy
    queryClient.invalidateQueries(userDataKey.all);
  }

  const setUnderlierAllowanceForProxy = async (fiat: any, amount: BigNumber) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = amount.add(modifyPositionData.collateralType.properties.underlierScale);
    const response = await sendTransaction(
      fiat, false, 'setUnderlierAllowanceForProxy', token, 'approve', proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set underlier allowance for Proxy' });
    const underlierAllowance = await token.allowance(contextData.user, proxies[0])
    setModifyPositionData({ ...modifyPositionData, underlierAllowance });
  }

  const unsetUnderlierAllowanceForProxy = async (fiat: any) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    const response =  await sendTransaction(
      fiat, false, 'unsetUnderlierAllowanceForProxy', token, 'approve', proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset underlier allowance for Proxy' });
  }

  const setFIATAllowanceForMoneta = async (fiat: any) => {
    const { moneta, vaultEPTActions, fiat: token } = fiat.getContracts();
    const response = await sendTransaction(
      // approveFIAT is implemented for all Actions contract
      fiat, true, 'setFIATAllowanceForMoneta', vaultEPTActions, 'approveFIAT', moneta.address, ethers.constants.MaxUint256
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set FIAT allowance Moneta' });
    const monetaFIATAllowance = await token.allowance(proxies[0], moneta.address)
    setModifyPositionData({ ...modifyPositionData, monetaFIATAllowance });
  }

  const setFIATAllowanceForProxy = async (fiat: any, amount: BigNumber) => {
    const { fiat: token } = fiat.getContracts();
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = amount.add(WAD);
    const response = await sendTransaction(
      fiat, false, 'setFIATAllowanceForProxy', token, 'approve', proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set  FIAT allowance for Proxy' });
    const proxyFIATAllowance = await token.allowance(contextData.user, proxies[0]);
    setModifyPositionData({ ...modifyPositionData, proxyFIATAllowance });
  }

  const unsetFIATAllowanceForProxy = async (fiat: any) => {
    const { fiat: token } = fiat.getContracts();
    const response = await sendTransaction(
      fiat, false, 'unsetFIATAllowanceForProxy', token, 'approve', proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset FIAT allowance for Proxy' });
  }

  const createPosition = async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const args = userActions.buildBuyCollateralAndModifyDebtArgs(
      contextData, proxies, modifyPositionData.collateralType, deltaCollateral, deltaDebt, underlier
    );
    const response = await sendTransaction(
      contextData.fiat, true, 'createPosition', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create position' });
    softReset();
  }

  const buyCollateralAndModifyDebt = async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
       // increase (mint)
      const args = userActions.buildModifyCollateralAndDebtArgs(contextData, proxies, collateralType, deltaDebt, position);
      const response = await sendTransaction(
        contextData.fiat, true, 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Borrow FIAT' });
      softReset();
    } else {
      const args = userActions.buildBuyCollateralAndModifyDebtArgs(
        contextData, proxies, collateralType, deltaCollateral, deltaDebt, underlier
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'buyCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Buy and deposit collateral and borrow FIAT'
      });
      softReset();
      return response;
    }
  }

  const sellCollateralAndModifyDebt = async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
      // decrease (pay back)
      const args = userActions.buildModifyCollateralAndDebtArgs(
        contextData, proxies, collateralType, deltaDebt.mul(-1), position
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Repay borrowed FIAT' });
      softReset();
    }
    else {
      const args = userActions.buildSellCollateralAndModifyDebtArgs(
        contextData, proxies, collateralType, deltaCollateral, deltaDebt, underlier, position,
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'sellCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Withdraw and sell collateral and repay borrowed FIAT'
      });
      softReset();
    }
  }

  const redeemCollateralAndModifyDebt = async (deltaCollateral: BigNumber, deltaDebt: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
       // decrease (pay back)
      const args = userActions.buildModifyCollateralAndDebtArgs(
        contextData, proxies, collateralType, deltaDebt.mul(-1), position
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Repay borrowed FIAT' });
      softReset();
    }
    else {
      const args = userActions.buildRedeemCollateralAndModifyDebtArgs(
        contextData, collateralType, deltaCollateral, deltaDebt, position
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'redeemCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Withdraw and redeem collateral and repay borrowed FIAT'
      });
      softReset();
    }
  }

  const createLeveredPosition = async (
    upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber
  ) => {
    const args = await userActions.buildBuyCollateralAndIncreaseLeverArgs(
      contextData, proxies, modifyPositionData.collateralType, upFrontUnderlier, addDebt, minUnderlierToBuy, minTokenToBuy
    );
    const response = await sendTransaction(
      contextData.fiat, true, 'createLeveredPosition', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create levered position' });
    softReset();
  }

  const buyCollateralAndIncreaseLever = async (
    upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber
  ) => {
    const args = await userActions.buildBuyCollateralAndIncreaseLeverArgs(
      contextData, proxies, modifyPositionData.collateralType, upFrontUnderlier, addDebt, minUnderlierToBuy, minTokenToBuy
    );
    const response = await sendTransaction(
      contextData.fiat, true, 'buyCollateralAndIncreaseLever', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({
      hash: response.transactionHash, description: 'Buy and deposit collateral and increase leverage'
    });
    softReset();
    return response;
  }

  const sellCollateralAndDecreaseLever = async (
    subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber, minUnderlierToBuy: BigNumber
  ) => {
    const { collateralType, position } = modifyPositionData;
    const args = await userActions.buildSellCollateralAndDecreaseLeverArgs(
      contextData, proxies, collateralType, subTokenAmount, subDebt, maxUnderlierToSell, minUnderlierToBuy, position
    );
    const response = await sendTransaction(
      contextData.fiat, true, 'sellCollateralAndDecreaseLever', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({
      hash: response.transactionHash, description: 'Withdraw and sell collateral and decrease leverage'
    });
    softReset();
    return response;
  }

  const redeemCollateralAndDecreaseLever = async (
    subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber
  ) => {
    const { collateralType, position } = modifyPositionData;
    const args = await userActions.buildRedeemCollateralAndDecreaseLeverArgs(
      contextData, proxies, collateralType, subTokenAmount, subDebt, maxUnderlierToSell, position
    );
    const response = await sendTransaction(
      contextData.fiat, true, 'redeemCollateralAndDecreaseLever', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({
      hash: response.transactionHash, description: 'Withdraw and redeem collateral and decrease leverage'
    });
    softReset();
    return response;
  }

  // Cycle the first page render to allow styles to load
  React.useEffect(() => {
    setInitialPageLoad(false);
  }, []);

  if (initialPageLoad) return null;

  return (
    <div>
      <HeaderBar 
        contextData={contextData} 
        transactionData={transactionData}
        disableActions={disableActions}
        createProxy={createProxy}
      />
      <Container lg>
        {
          !positionsData || positionsData.length === 0
            ? null
            : (
              <>
                <PositionsTable
                  contextData={contextData}
                  onSelectPosition={(positionId) => {
                    setSelectedPositionId(positionId);
                    setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
                  }}
                />
                <Spacer y={2} />
              </>
            )
        }
      </Container>
      <Container lg>
        <CollateralTypesTable
          fiat={contextData.fiat}
          onSelectCollateralType={(collateralTypeId) => {
            // If user has an existing position for the collateral type then open PositionModal instead
            const { vault, tokenId } = decodeCollateralTypeId(collateralTypeId);
            const positionData = getPositionData(positionsData, vault, tokenId, proxies[0]);
            if (positionData !== undefined) {
              const positionId = encodePositionId(vault, tokenId, positionData.owner);
              setSelectedPositionId(positionId);
              setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
            } else {
              setSelectedPositionId(initialState.selectedPositionId);
              setSelectedCollateralTypeId(collateralTypeId);
            }
          }}
        />
      </Container>

      <PositionModal
        contextData={contextData}
        modifyPositionData={modifyPositionData}
        disableActions={disableActions}
        createPosition={createPosition}
        buyCollateralAndModifyDebt={buyCollateralAndModifyDebt}
        sellCollateralAndModifyDebt={sellCollateralAndModifyDebt}
        redeemCollateralAndModifyDebt={redeemCollateralAndModifyDebt}
        createLeveredPosition={createLeveredPosition}
        buyCollateralAndIncreaseLever={buyCollateralAndIncreaseLever}
        sellCollateralAndDecreaseLever={sellCollateralAndDecreaseLever}
        redeemCollateralAndDecreaseLever={redeemCollateralAndDecreaseLever}
        selectedPositionId={selectedPositionId}
        selectedCollateralTypeId={selectedCollateralTypeId}
        setFIATAllowanceForProxy={setFIATAllowanceForProxy}
        unsetFIATAllowanceForProxy={unsetFIATAllowanceForProxy}
        setFIATAllowanceForMoneta={setFIATAllowanceForMoneta}
        setUnderlierAllowanceForProxy={setUnderlierAllowanceForProxy}
        unsetUnderlierAllowanceForProxy={unsetUnderlierAllowanceForProxy}
        transactionData={transactionData}
        setTransactionStatus={(status) =>
          setTransactionData({ ...transactionData, status })
        }
        open={!!modifyPositionData && (!!selectedCollateralTypeId || !!selectedPositionId)}
        onClose={() => {
          setSelectedPositionId(initialState.selectedPositionId);
          setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          borrowStore.reset();
        }}
      />
      <Spacer />
    </div>
  );
};

export default Home;
