import React from 'react';
import { useAccount, useNetwork, useProvider } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { decToWad, FIAT, scaleToWad, WAD, wadToDec, wadToScale, ZERO } from '@fiatdao/sdk';
import { Badge, Button, Container, Spacer } from '@nextui-org/react';
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
      healthFactor: ZERO as ethers.BigNumber, // [wad]
      error: null as null | string
    },
    transactionData: {
      action: null as null | string,
      status: null as TransactionStatus,
    }
  }), []) 

  const [setupListeners, setSetupListeners] = React.useState(false);
  const [contextData, setContextData] = React.useState(initialState.contextData);
  const [collateralTypesData, setCollateralTypesData] = React.useState(initialState.collateralTypesData);
  const [positionsData, setPositionsData] = React.useState(initialState.positionsData);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [modifyPositionFormData, setModifyPositionFormData] = React.useState(initialState.modifyPositionFormData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);
  const [selectedPositionId, setSelectedPositionId] = React.useState(initialState.selectedPositionId);
  const [selectedCollateralTypeId, setSelectedCollateralTypeId] = React.useState(initialState.selectedCollateralTypeId);
  const [fiatBalance, setFiatBalance] = React.useState<string>('0 FIAT');


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

  React.useEffect(() => {
    if (connector) {
      (async function () {
        if (!contextData.fiat) return;
        const { fiat } = contextData.fiat.getContracts();
        const signer = (await connector.getSigner());
        const user = await signer.getAddress();
        const fiatBalance = await fiat.balanceOf(user)
        setFiatBalance(`${parseFloat(wadToDec(fiatBalance)).toFixed(2)} FIAT`)
      })();

    }
  }, [connector, contextData.fiat])

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
      const matured = !(new Date() < (new Date(Number(collateralType.properties.maturity.toString()) * 1000)));
      setModifyPositionFormData({ ...modifyPositionFormData, mode: (matured) ? 'redeem' : 'deposit' });
      position = getPositionData(positionsData, vault, tokenId, owner);
    }
    const data = { ...modifyPositionData, collateralType, position };
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
  }, [
    connector,
    contextData,
    collateralTypesData,
    positionsData,
    selectedCollateralTypeId,
    selectedPositionId,
    modifyPositionData,
    modifyPositionFormData
  ]);

  // Update ModifyPosition form data
  React.useEffect(() => {
    // TODO: might have to swap for userReducer NOW.
    // or implement a debounce/use zustand if it's calling a certain rpc method
    if (
      !connector
      || modifyPositionData.collateralType == null
      || (selectedCollateralTypeId == null && selectedPositionId == null)
      || modifyPositionFormData.outdated === false
    ) return;


    const timeOutId = setTimeout(() => {
      (async function () {
        if (!contextData.fiat) return
        const { collateralType, position } = modifyPositionData;
        const { mode } = modifyPositionFormData;
        const { vault, tokenId, tokenScale, vaultType } = collateralType.properties;
        const { codex: { virtualRate: rate }, collybus: { liquidationPrice } } = collateralType.state;
        const { fiat } = contextData;
        const { vaultEPTActions, vaultFCActions, vaultFYActions } = fiat.getContracts();

        try {
          if (mode === 'deposit') {
            const { underlier } = modifyPositionFormData;
            let tokensOut = ethers.constants.Zero;
            if (vaultType === 'ERC20:EPT' && underlier.gt(ZERO)) {
              if (collateralType.properties.eptData == undefined) throw new Error('Missing data');
              const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
              tokensOut = await fiat.call(vaultEPTActions, 'underlierToPToken', vault, balancer, pool, underlier);
            } else if (vaultType === 'ERC1155:FC' && underlier.gt(ZERO)) {
              if (collateralType.properties.fcData == undefined) throw new Error('Missing data');
              tokensOut = await fiat.call(vaultFCActions, 'underlierToFCash', tokenId, underlier);
            } else if (vaultType === 'ERC20:FY' && underlier.gt(ZERO)) {
              if (collateralType.properties.fyData == undefined) throw new Error('Missing data');
              const { fyData: { yieldSpacePool } } = collateralType.properties;
              tokensOut = await fiat.call(vaultFYActions, 'underlierToFYToken', underlier, yieldSpacePool);
            } else if (underlier.gt(ZERO)) { throw new Error('Unsupported collateral type'); }
            const { slippagePct } = modifyPositionFormData;
            const deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippagePct)).div(WAD);
            if (selectedCollateralTypeId !== null) {
              const { targetedHealthFactor } = modifyPositionFormData;
              const deltaNormalDebt = fiat.computeMaxNormalDebt(
                deltaCollateral, targetedHealthFactor, rate, liquidationPrice
              );
              const deltaDebt = fiat.normalDebtToDebt(deltaNormalDebt, rate);
              const collateral = deltaCollateral;
              const debt = deltaDebt;
              const healthFactor = fiat.computeHealthFactor(collateral, deltaNormalDebt, rate, liquidationPrice);
              if (healthFactor.lte(WAD)) throw new Error('Health factor has to be greater than 1.0');
              setModifyPositionFormData({
                ...modifyPositionFormData, healthFactor, collateral, debt, deltaCollateral, outdated: false
              });
            } else {
              const { deltaDebt } = modifyPositionFormData;
              const normalDebt = fiat.debtToNormalDebt(deltaDebt, rate);
              const collateral = position.collateral.add(deltaCollateral);
              const debt = fiat.normalDebtToDebt(position.normalDebt, rate).add(deltaDebt);
              const healthFactor = fiat.computeHealthFactor(collateral, normalDebt, rate, liquidationPrice);
              if (healthFactor.lte(WAD)) throw new Error('Health factor has to be greater than 1.0');
              setModifyPositionFormData({
                ...modifyPositionFormData, healthFactor, collateral, debt, deltaCollateral, outdated: false
              });
            }
          } else if (mode === 'withdraw') {
            const { deltaCollateral, deltaDebt, slippagePct } = modifyPositionFormData;
            const tokenIn = wadToScale(deltaCollateral, tokenScale);
            let underlierAmount = ethers.constants.Zero;
            if (vaultType === 'ERC20:EPT' && tokenIn.gt(ZERO)) {
              if (collateralType.properties.eptData == undefined) throw new Error('Missing data');
              const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
              underlierAmount = await fiat.call(vaultEPTActions, 'pTokenToUnderlier', vault, balancer, pool, tokenIn);
            } else if (vaultType === 'ERC1155:FC' && tokenIn.gt(ZERO)) {
              if (collateralType.properties.fcData == undefined) throw new Error('Missing data');
              underlierAmount = await fiat.call(vaultFCActions, 'fCashToUnderlier', tokenId, tokenIn);
            } else if (vaultType === 'ERC20:FY' && tokenIn.gt(ZERO)) {
              if (collateralType.properties.fyData == undefined) throw new Error('Missing data');
              const { fyData: { yieldSpacePool } } = collateralType.properties;
              underlierAmount = await fiat.call(vaultFYActions, 'fyTokenToUnderlier', tokenIn, yieldSpacePool);
            } else if (tokenIn.gt(ZERO)) { throw new Error('Unsupported collateral type'); }
            const underlier = underlierAmount.mul(WAD.sub(slippagePct)).div(WAD);
            const deltaNormalDebt = fiat.debtToNormalDebt(deltaDebt, rate);
            if (position.collateral.lt(deltaCollateral)) throw new Error('Insufficient collateral');
            if (position.normalDebt.lt(deltaNormalDebt)) throw new Error('Insufficient debt');
            const collateral = position.collateral.sub(deltaCollateral);
            const normalDebt = position.normalDebt.sub(deltaNormalDebt);
            const debt = fiat.normalDebtToDebt(normalDebt, rate);
            const healthFactor = fiat.computeHealthFactor(collateral, normalDebt, rate, liquidationPrice);
            if (healthFactor.lte(WAD)) throw new Error('Health factor has to be greater than 1.0');
            setModifyPositionFormData({
              ...modifyPositionFormData, healthFactor, underlier, collateral, debt, outdated: false
            });
          } else if (mode === 'redeem') {
            const { deltaCollateral, deltaDebt } = modifyPositionFormData;
            const deltaNormalDebt = fiat.debtToNormalDebt(deltaDebt, rate);
            if (position.collateral.lt(deltaCollateral)) throw new Error('Insufficient collateral');
            if (position.normalDebt.lt(deltaNormalDebt)) throw new Error('Insufficient debt');
            const collateral = position.collateral.sub(deltaCollateral);
            const normalDebt = position.normalDebt.sub(deltaNormalDebt);
            const debt = fiat.normalDebtToDebt(normalDebt, rate);
            const healthFactor = fiat.computeHealthFactor(collateral, normalDebt, rate, liquidationPrice);
            if (healthFactor.lte(WAD)) throw new Error('Health factor has to be greater than 1.0');
            setModifyPositionFormData({
              ...modifyPositionFormData, healthFactor, collateral, debt, outdated: false,
            });
          } else { throw new Error('Invalid mode'); }
        } catch (error) {
          console.log(error);
          if (mode === 'deposit') {
            setModifyPositionFormData({
              ...modifyPositionFormData,
              underlier: modifyPositionFormData.underlier,
              deltaCollateral: ZERO,
              deltaDebt: ZERO,
              collateral: ZERO,
              debt: ZERO,
              healthFactor: ZERO,
              outdated: false,
              error: JSON.stringify(error)
            });
          } else if (mode === 'withdraw' || mode === 'redeem') {
            setModifyPositionFormData({
              ...modifyPositionFormData,
              underlier: ZERO,
              deltaCollateral: modifyPositionFormData.underlier,
              deltaDebt: modifyPositionFormData.deltaDebt,
              collateral: ZERO,
              debt: ZERO,
              healthFactor: ZERO,
              outdated: false,
              error: JSON.stringify(error)
            });
          }
        }
      })();
    }, 2000);
    // prevent timeout callback from executing if useEffect was interrupted by a rerender
    return () => clearTimeout(timeOutId)
  }, [
    connector,
    initialState,
    contextData,
    selectedCollateralTypeId,
    selectedPositionId,
    modifyPositionData,
    modifyPositionFormData
  ]);

  const createProxy = async (fiat: any, user: string) => {
    const { proxyRegistry } = fiat.getContracts();
    try {
      setTransactionData({ ...transactionData, status: 'sent' });
      console.log(await fiat.dryrun(proxyRegistry, 'deployFor', user));
      setTransactionData({ ...transactionData, status: 'confirmed' });
    } catch (e) {
      console.error('Error creating proxy');
      setTransactionData({ ...transactionData, status: 'error' });
    }
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
      modifyPositionFormData
    );
    setTransactionData(initialState.transactionData);
  }

  const sellCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'sellCollateralAndModifyDebt' });
    await userActions.sellCollateralAndModifyDebt(
      contextData,
      modifyPositionData.collateralType,
      modifyPositionFormData
    );
    setTransactionData(initialState.transactionData);
  }

  const redeemCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'redeemCollateralAndModifyDebt' });
    await userActions.redeemCollateralAndModifyDebt(
      contextData,
      modifyPositionData.collateralType,
      modifyPositionFormData
    );
    setTransactionData(initialState.transactionData);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
        <h4 style={{ justifyContent: 'flex',  }}>(Experimental) FIAT UI</h4>
        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            authenticationStatus,
            mounted,
          }) => {
            // Note: If your app doesn't use authentication, you
            // can remove all 'authenticationStatus' checks
            const ready = mounted && authenticationStatus !== 'loading';
            const connected =
              ready &&
              account &&
              chain &&
              (!authenticationStatus ||
                authenticationStatus === 'authenticated');

            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  'style': {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                      <Button onClick={openConnectModal} type="button">
                        Connect Wallet
                      </Button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <Button onClick={openChainModal} type="button" color='error'>
                        Wrong network
                      </Button>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Button
                        bordered
                        onClick={openChainModal}
                        style={{ display: 'flex', alignItems: 'center' }}
                        type="button"
                      >
                        {chain.name}
                      </Button>

                      <Button auto onClick={openAccountModal} type="button">
                        <span style={{marginRight: '20px'}}>{account.displayName}</span>
                        <Badge isSquared color="primary" variant="bordered">{fiatBalance}</Badge>
                      </Button>
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
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
        modifyPositionFormData={modifyPositionFormData}
        setTransactionStatus={(status) =>
          setTransactionData({ ...transactionData, status })
        }
        setMonetaDelegate={setMonetaDelegate}
        setUnderlierAllowance={setUnderlierAllowance}
        transactionData={transactionData}
        unsetMonetaDelegate={unsetMonetaDelegate}
        unsetUnderlierAllowance={unsetUnderlierAllowance}
        onUpdateUnderlier={(underlier) => {
          if (underlier === null) {
            const { underlier, targetedHealthFactor, slippagePct } = modifyPositionFormData;
            setModifyPositionFormData({ 
              ...initialState.modifyPositionFormData, underlier, targetedHealthFactor, slippagePct, outdated: false
            });  
          } else {
            setModifyPositionFormData({ ...modifyPositionFormData, underlier, outdated: true });
          }
        }}
        onUpdateSlippage={(slippagePct) => {
          if (slippagePct === null) {
            const { slippagePct, targetedHealthFactor, underlier } = modifyPositionFormData;
            setModifyPositionFormData({ 
              ...initialState.modifyPositionFormData, slippagePct, targetedHealthFactor, underlier, outdated: false
            }); 
          } else {
            setModifyPositionFormData({ ...modifyPositionFormData, slippagePct, outdated: true });
          }
        }}
        onUpdateTargetedHealthFactor={(targetedHealthFactor) => {
          if (targetedHealthFactor === null) {
            const { underlier, slippagePct, targetedHealthFactor } = modifyPositionFormData;
            setModifyPositionFormData({ 
              ...initialState.modifyPositionFormData, underlier, slippagePct, targetedHealthFactor, outdated: false
            }); 
          } else {
            setModifyPositionFormData({ ...modifyPositionFormData, targetedHealthFactor, outdated: true });
          }
        }}
        onSendTransaction={(action) => setTransactionData({ ...transactionData, action })}
        open={(!!selectedCollateralTypeId)}
        onClose={() => {
          setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          setModifyPositionFormData(initialState.modifyPositionFormData);
        }}
      />

      <ModifyPositionModal
        buyCollateralAndModifyDebt={buyCollateralAndModifyDebt}
        contextData={contextData}
        disableActions={disableActions}
        modifyPositionData={modifyPositionData}
        modifyPositionFormData={modifyPositionFormData}
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
        onUpdateDeltaCollateral={(deltaCollateral) => {
          if (deltaCollateral === null) {
            const { deltaCollateral, deltaDebt, slippagePct, mode } = modifyPositionFormData;
            setModifyPositionFormData({ 
              ...initialState.modifyPositionFormData, deltaCollateral, deltaDebt, slippagePct, mode, outdated: false
            });  
          } else {
            setModifyPositionFormData({ ...modifyPositionFormData, deltaCollateral, outdated: true });
          }
        }}
        onUpdateDeltaDebt={(deltaDebt) => {
          if (deltaDebt === null) {
            const { deltaCollateral, deltaDebt, slippagePct, mode } = modifyPositionFormData;
            setModifyPositionFormData({ 
              ...initialState.modifyPositionFormData, deltaCollateral, deltaDebt, slippagePct, mode, outdated: false
            });  
          } else {
            setModifyPositionFormData({ ...modifyPositionFormData, deltaDebt, outdated: true });
          }
        }}
        onUpdateUnderlier={(underlier) => {
          if (underlier === null) {
            const { underlier, deltaDebt, slippagePct, mode } = modifyPositionFormData;
            setModifyPositionFormData({ 
              ...initialState.modifyPositionFormData, underlier, deltaDebt, slippagePct, mode, outdated: false
            });  
          } else {
            setModifyPositionFormData({ ...modifyPositionFormData, underlier, outdated: true });
          }
        }}
        onUpdateSlippage={(slippagePct) => {
          if (slippagePct === null) {
            const { slippagePct, underlier, deltaCollateral, deltaDebt, mode } = modifyPositionFormData;
            if (modifyPositionFormData.mode === 'deposit') {
              setModifyPositionFormData({ 
                ...initialState.modifyPositionFormData, slippagePct, deltaDebt, underlier, mode, outdated: false,
              }); 
            } else {
              setModifyPositionFormData({ 
                ...initialState.modifyPositionFormData, slippagePct, deltaDebt, deltaCollateral, mode, outdated: false,
              }); 
            }
          } else {
            setModifyPositionFormData({ ...modifyPositionFormData, slippagePct, outdated: true });
          }
        }}
        onUpdateMode={(mode) => {
          setModifyPositionFormData({  ...initialState.modifyPositionFormData, mode, outdated: false }); 
        }}
        onSendTransaction={(action) => setTransactionData({ ...transactionData, action })}
        open={(!!selectedPositionId)}
        onClose={() => {
          setSelectedPositionId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          setModifyPositionFormData(initialState.modifyPositionFormData);
        }}
      />
      <Spacer />
    </div>
  );
};

export default Home;
