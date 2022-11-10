import React from 'react';
import { useAccount, useNetwork, useProvider } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { decToWad, FIAT, ZERO } from '@fiatdao/sdk';
import { Container, Spacer } from '@nextui-org/react';
import type { NextPage } from 'next';

import { ProxyCard } from '../src/components/ProxyCard';
import { CollateralTypesTable } from '../src/components/CollateralTypesTable';
import { PositionsTable } from '../src/components/PositionsTable';
import { CreatePositionModal } from '../src/components/CreatePositionModal';
import { ModifyPositionModal } from '../src/components/ModifyPositionModal';
import {
  decodeCollateralTypeId, decodePositionId, encodePositionId, getCollateralTypeData, getPositionData
} from '../src/utils';
import * as userActions from '../src/actions';
import { useModifyPositionFormDataStore } from '../src/stores/formStore';

export type TransactionStatus = null | 'error' | 'sent' | 'confirming' | 'confirmed';

const Home: NextPage = () => {
  const provider = useProvider();
  const { connector } = useAccount({ onConnect: () => resetState(), onDisconnect: () => resetState() });
  const { chain } = useNetwork();


  const initialState = React.useMemo(() => ({
    setupListeners: false,
    contextData: {
      fiat: null as null | FIAT,
      explorerUrl: null as null | string,
      user: null as null | string,
      proxies: [] as Array<string>
    },
    positionsData: [] as Array<any>,
    collateralTypesData: [] as Array<any>,
    selectedPositionId: null as null | string,
    selectedCollateralTypeId: null as null | string,
    modifyPositionData: {
      outdated: false,
      collateralType: null as undefined | null | any,
      position: null as undefined | null | any,
      underlierAllowance: null as null | ethers.BigNumber, // [underlierScale]
      underlierBalance: null as null | ethers.BigNumber,
      monetaDelegate: null as null | boolean,
      fiatAllowance: null as null | ethers.BigNumber // [wad]
    },
    modifyPositionFormData: {
      outdated: true,
      mode: 'deposit', // [deposit, withdraw, redeem]
      slippagePct: decToWad('0.001') as ethers.BigNumber, // [wad]
      underlier: ZERO as ethers.BigNumber, // [underlierScale]
      deltaCollateral: ZERO as ethers.BigNumber, // [wad]
      deltaDebt: ZERO as ethers.BigNumber, // [wad]
      targetedHealthFactor: decToWad('1.2') as ethers.BigNumber, // [wad]
      collateral: ZERO as ethers.BigNumber, // [wad]
      debt: ZERO as ethers.BigNumber, // [wad]
      healthFactor: ZERO as ethers.BigNumber, // [wad] estimated new health factor
      error: null as null | string
    },
    transactionData: {
      action: null as null | string,
      status: null as TransactionStatus,
    }
  }), []) 

  const formDataStore = useModifyPositionFormDataStore();

  const [setupListeners, setSetupListeners] = React.useState(false);
  const [contextData, setContextData] = React.useState(initialState.contextData);
  const [collateralTypesData, setCollateralTypesData] = React.useState(initialState.collateralTypesData);
  const [positionsData, setPositionsData] = React.useState(initialState.positionsData);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [modifyPositionFormData, setModifyPositionFormData] = React.useState(initialState.modifyPositionFormData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);
  const [selectedPositionId, setSelectedPositionId] = React.useState(initialState.selectedPositionId);
  const [selectedCollateralTypeId, setSelectedCollateralTypeId] = React.useState(initialState.selectedCollateralTypeId);

  const disableActions = React.useMemo(() => transactionData.status === 'sent', [transactionData.status])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function resetState() {
    setSetupListeners(initialState.setupListeners);
    setContextData(initialState.contextData);
    setCollateralTypesData(initialState.collateralTypesData);
    setPositionsData(initialState.positionsData);
    setModifyPositionData(initialState.modifyPositionData);
    setModifyPositionFormData(initialState.modifyPositionFormData);
    setTransactionData(initialState.transactionData);
    setSelectedPositionId(initialState.selectedPositionId);
    setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
  }

  // Reset state if network or account changes
  React.useEffect(() => {
    if (!connector || setupListeners) return;
    connector.on('change', () => resetState());
    setSetupListeners(true);
  }, [setupListeners, connector, resetState]);

  // Fetch CollateralTypes and block explorer data
  React.useEffect(() => {
    if (collateralTypesData.length !== 0) return;

    (async function () {
      const fiat = await FIAT.fromProvider(provider, null);
      const collateralTypesData_ = await fiat.fetchCollateralTypesAndPrices([]);
      setCollateralTypesData(collateralTypesData_
        .filter((collateralType: any) => (collateralType.metadata != undefined))
        .sort((a: any, b: any) => {
          if (Number(a.properties.maturity) > Number(b.properties.maturity)) return -1;
          if (Number(a.properties.maturity) < Number(b.properties.maturity)) return 1;
          return 0;
        })
      );
      setContextData((curContextData) => ({
        ...curContextData,
        explorerUrl: chain?.blockExplorers?.etherscan?.url || ''
      }));
    })();
  }, [chain?.blockExplorers?.etherscan?.url, collateralTypesData.length, connector, provider]);

  // Fetch User and Vault data
  React.useEffect(() => {
    if (!connector) return;
    
    (async function () {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const fiat = await FIAT.fromSigner(signer, undefined);
      const userData = await fiat.fetchUserData(user.toLowerCase());
      const positionsData = userData.flatMap((user) => user.positions);
      setPositionsData(positionsData);
      const proxies = userData.filter((user: any) => (user.isProxy === true)).map((user: any) => user.user);
      setContextData((curContextData) => ({
        ...curContextData,
        fiat,
        user,
        proxies,
      }));
    })();
  }, [connector]);

  // Populate ModifyPosition data
  React.useEffect(() => {
    if (
      !connector
      || modifyPositionData.collateralType !== null
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
    formDataStore.calculateNewPositionData(contextData.fiat, data, null);
    setModifyPositionData(data);

    (async function () {
      // For positions with proxies, fetch underlier balance, allowance, fiat allowance, and moneta delegation enablement
      if (contextData.proxies.length === 0) return;
      const { proxies: [proxy] } = contextData;
      if (
        !contextData.fiat ||
        data.collateralType == null ||
        (data.position &&
          data.position.owner.toLowerCase() !== proxy.toLowerCase())
      ) {
        return;
      }

      const { codex, moneta, fiat, vaultEPTActions } = contextData.fiat.getContracts();
      const underlier = contextData.fiat.getERC20Contract(data.collateralType.properties.underlierToken);

      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const [underlierAllowance, underlierBalance, monetaDelegate, fiatAllowance] = await contextData.fiat.multicall([
        { contract: underlier, method: 'allowance', args: [proxy, vaultEPTActions.address] },
        { contract: underlier, method: 'balanceOf', args: [user] },
        { contract: codex, method: 'delegates', args: [proxy, moneta.address] },
        { contract: fiat, method: 'allowance', args: [proxy, vaultEPTActions.address] }
      ]);
      setModifyPositionData({
        ...modifyPositionData, ...data, underlierAllowance, underlierBalance, monetaDelegate, fiatAllowance
      });
    })();
  }, [connector, contextData, collateralTypesData, positionsData, selectedCollateralTypeId, selectedPositionId, modifyPositionData, formDataStore]);

  const dryRun = async (fiat: any, contract: ethers.Contract, method: string, ...args: any[]) => {
    try {
      setTransactionData({ action: method, status: 'sent' });

      // OPTIONAL: resolve with wait to to simulate a real txn
      // and reject with a fake error to test error states
      await new Promise((resolve: any, reject: any) => {
        setTimeout(resolve, 200);
        // setTimeout(reject({message: 'Fake error'}), 200);
      });

      const resp = await fiat.dryrun(contract, method, ...args);
      console.log('Dryrun resp: ', resp);
      setTransactionData(initialState.transactionData);
    } catch (e) {
      console.error('Dryrun error: ', e);
      setTransactionData({ ...transactionData, status: 'error' });
      throw e
    }
  }

  const sendAndWait = async (fiat: any, contract: ethers.Contract, method: string, ...args: any[]) => {
    try {
      setTransactionData({ action: method, status: 'sent' });
      await fiat.send(contract, method, ...args);
      setTransactionData(initialState.transactionData);
    } catch (e) {
      console.log(e);
      setTransactionData({ ...transactionData, status: 'error' });
      throw e
    }
  }

  const createProxy = async (fiat: any, user: string) => {
    await dryRun(fiat, fiat.getContracts().proxyRegistry, 'deployFor', user);
    // await sendAndWait(fiat, fiat.getContracts().proxyRegistry, 'deployFor', user);
  }

  const setUnderlierAllowance = async (fiat: any) => {
    setTransactionData({ status: 'sent', action: 'setUnderlierAllowance' });
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    console.log(await fiat.dryrun(
      token, 'approve', contextData.proxies[0], modifyPositionFormData.underlier
    ));
    setTransactionData(initialState.transactionData);
  }

  const unsetUnderlierAllowance = async (fiat: any) => {
    setTransactionData({ status: 'sent', action: 'unsetUnderlierAllowance' });
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    console.log(await fiat.dryrun(token, 'approve', contextData.proxies[0], 0));
    setTransactionData(initialState.transactionData);
  }

  const setMonetaDelegate = async (fiat: any) => {
    const { codex, moneta } = fiat.getContracts();
    setTransactionData({ status: 'sent', action: 'setMonetaDelegate' });
    console.log(await fiat.dryrun(codex, 'grantDelegate', moneta.address));
    setTransactionData(initialState.transactionData);
  }

  const unsetMonetaDelegate = async (fiat: any) => {
    const { codex, moneta } = fiat.getContracts();
    setTransactionData({ status: 'sent', action: 'unsetMonetaDelegate' });
    console.log(await fiat.dryrun(codex, 'revokeDelegate', moneta.address));
    setTransactionData(initialState.transactionData);
  }

  const buyCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'buyCollateralAndModifyDebt' });
    await userActions.buyCollateralAndModifyDebt(
      contextData,
      modifyPositionData.collateralType,
      formDataStore.deltaCollateral,
      formDataStore.deltaDebt,
      formDataStore.underlier,
    );
    setTransactionData(initialState.transactionData);
  }

  const sellCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'sellCollateralAndModifyDebt' });
    await userActions.sellCollateralAndModifyDebt(
      contextData,
      modifyPositionData.collateralType,
      formDataStore.deltaCollateral,
      formDataStore.deltaDebt,
      formDataStore.underlier,
    );
    setTransactionData(initialState.transactionData);
  }

  const redeemCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'redeemCollateralAndModifyDebt' });
    await userActions.redeemCollateralAndModifyDebt(
      contextData,
      modifyPositionData.collateralType,
      formDataStore.deltaCollateral,
      formDataStore.deltaDebt,
    );
    setTransactionData(initialState.transactionData);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
        <h4 style={{ justifyContent: 'flex',  }}>(Experimental) FIAT UI</h4>
        <ConnectButton showBalance={false} />
      </div>
      <Spacer y={2} />
      <Container>
        <ProxyCard
          {...contextData}
          createProxy={createProxy}
          disableActions={disableActions}
        />
      </Container>
      <Spacer y={2} />
      <Container>
        <CollateralTypesTable
          collateralTypesData={collateralTypesData}
          onSelectCollateralType={(collateralTypeId) => {
            // If user has an existing position for the collateral type then open ModifyPositionModal instead
            const { vault, tokenId } = decodeCollateralTypeId(collateralTypeId);
            const positionData = getPositionData(positionsData, vault, tokenId, contextData.proxies[0]);
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
      <Spacer y={2} />
      <Container>
        {
          positionsData === null || positionsData.length === 0
            ? null
            : (
              <PositionsTable
                collateralTypesData={collateralTypesData}
                positionsData={positionsData}
                onSelectPosition={(positionId) => {
                  setSelectedPositionId(positionId);
                  setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
                }}
              />
            )
        }
      </Container>

      <CreatePositionModal
        buyCollateralAndModifyDebt={buyCollateralAndModifyDebt}
        contextData={contextData}
        disableActions={disableActions}
        modifyPositionData={modifyPositionData}
        selectedCollateralTypeId={selectedCollateralTypeId}
        setMonetaDelegate={setMonetaDelegate}
        setUnderlierAllowance={setUnderlierAllowance}
        transactionData={transactionData}
        unsetMonetaDelegate={unsetMonetaDelegate}
        unsetUnderlierAllowance={unsetUnderlierAllowance}
        open={(!!selectedCollateralTypeId)}
        onClose={() => {
          setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          formDataStore.reset();
        }}
      />

      <ModifyPositionModal
        buyCollateralAndModifyDebt={buyCollateralAndModifyDebt}
        contextData={contextData}
        disableActions={disableActions}
        modifyPositionData={modifyPositionData}
        redeemCollateralAndModifyDebt={redeemCollateralAndModifyDebt}
        sellCollateralAndModifyDebt={sellCollateralAndModifyDebt}
        setTransactionStatus={(status) =>
          setTransactionData({ ...transactionData, status })
        }
        setMonetaDelegate={setMonetaDelegate}
        setUnderlierAllowance={setUnderlierAllowance}
        transactionData={transactionData}
        unsetMonetaDelegate={unsetMonetaDelegate}
        unsetUnderlierAllowance={unsetUnderlierAllowance}
        onSendTransaction={(action) => setTransactionData({ ...transactionData, action })}
        open={(!!selectedPositionId)}
        onClose={() => {
          setSelectedPositionId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          setModifyPositionFormData(initialState.modifyPositionFormData);
          formDataStore.reset();
        }}
      />
      <Spacer />
    </div>
  );
};

export default Home;
