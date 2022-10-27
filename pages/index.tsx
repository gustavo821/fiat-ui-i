import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import { useProvider, useAccount, useNetwork } from 'wagmi';
import { ethers } from 'ethers';
import { Container, Spacer } from '@nextui-org/react';

// @ts-ignore
import { FIAT, ZERO, WAD, decToWad, scaleToWad, wadToScale } from '@fiatdao/sdk';

import { ProxyCard } from './ProxyCard';
import { CollateralTypesTable } from './CollateralTypesTable';
import { PositionsTable } from './PositionsTable';
import { CreatePositionModal } from './CreatePositionModal';
import { ModifyPositionModal } from './ModifyPositionModal';

import { decodeCollateralTypeId, getCollateralTypeData, decodePositionId, getPositionData } from './utils';

const Home: NextPage = () => {
  const provider = useProvider();
  const { connector } = useAccount({ onConnect: () => resetState(), onDisconnect: () => resetState() });
  const { chain } = useNetwork();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialState = {
    setupListeners: false,
    fetchedData: false,
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
      status: null as null | string, // error, sent, confirming, confirmed
    }
  } 

  const [setupListeners, setSetupListeners] = React.useState(false);
  const [fetchedData, setFetchedData] = React.useState(false);
  const [contextData, setContextData] = React.useState(initialState.contextData);
  const [collateralTypesData, setCollateralTypesData] = React.useState(initialState.collateralTypesData);
  const [positionsData, setPositionsData] = React.useState(initialState.positionsData);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [modifyPositionFormData, setModifyPositionFormData] = React.useState(initialState.modifyPositionFormData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);
  const [selectedPositionId, setSelectedPositionId] = React.useState(initialState.selectedPositionId);
  const [selectedCollateralTypeId, setSelectedCollateralTypeId] = React.useState(initialState.selectedCollateralTypeId);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function resetState() {
    setSetupListeners(initialState.setupListeners);
    setFetchedData(initialState.fetchedData);
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

  React.useEffect(() => {
    if (connector || collateralTypesData.length !== 0) return;

    (async function () {
      const fiat = await FIAT.fromProvider(provider);
      const collateralTypesData_ = await fiat.fetchCollateralTypesAndPrices();
      setCollateralTypesData(collateralTypesData_
        .filter((collateralType: any) => (collateralType.metadata != undefined))
        .sort((a: any, b: any) => {
          if (Number(a.properties.maturity) > Number(b.properties.maturity)) return -1;
          if (Number(a.properties.maturity) < Number(b.properties.maturity)) return 1;
          return 0;
        })
      );
      setContextData({
        ...contextData,
        explorerUrl: chain?.blockExplorers?.etherscan?.url || ''
      });
    })();
  });

  // Fetch User, CollateralType and Vault data
  React.useEffect(() => {
    if (!connector || fetchedData || contextData.fiat != null) return;
    setFetchedData(true);
    
    (async function () {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const fiat = await FIAT.fromSigner(signer);
      const [collateralTypesData_, contextData_] = await Promise.all([
        fiat.fetchCollateralTypesAndPrices(),
        fiat.fetchUserData(user.toLowerCase())
      ]);

      const positionsData_ = contextData_.reduce((positions_: any, user: any) => (
        [
          ...positions_,
          ...user.positions.reduce((positions__: any, position: any) => ([...positions__, position]), [])
        ]
      ), []);

      setCollateralTypesData(collateralTypesData_
        .filter((collateralType: any) => (collateralType.metadata != undefined))
        .sort((a: any, b: any) => {
          if (Number(a.properties.maturity) > Number(b.properties.maturity)) return -1;
          if (Number(a.properties.maturity) < Number(b.properties.maturity)) return 1;
          return 0;
        })
      );
      setPositionsData(positionsData_);
      setContextData({
        fiat,
        explorerUrl: chain?.blockExplorers?.etherscan?.url || '',
        user,
        proxies: contextData_.filter((user: any) => (user.isProxy === true)).map((user: any) => user.user)
      });
    })();
  }, [connector, fetchedData, chain, collateralTypesData, positionsData, contextData]);

  // Populate ModifyPosition data
  React.useEffect(() => {
    if (
      !connector
      || modifyPositionData.collateralType !== null
      || (selectedCollateralTypeId == null && selectedPositionId == null)
    ) return;

    const { vault, tokenId } = decodeCollateralTypeId((selectedCollateralTypeId || selectedPositionId as string));
    let data = { ...modifyPositionData, collateralType: getCollateralTypeData(collateralTypesData, vault, tokenId) };
    if (selectedPositionId) {
      const { owner } = decodePositionId(selectedPositionId);
      const matured = !(new Date() < (new Date(Number(data.collateralType.properties.maturity.toString()) * 1000)));
      setModifyPositionFormData({ ...modifyPositionFormData, mode: (matured) ? 'redeem' : 'deposit' });
      data = { ...data, position: getPositionData(positionsData, vault, tokenId, owner) };
    }
    setModifyPositionData(data);

    if (contextData.proxies.length === 0) return;
    const { proxies: [proxy] } = contextData;
    if (data.position && data.position.owner.toLowerCase() !== proxy.toLowerCase()) return;

    (async function () {
      if (data.collateralType == null) return;
      const { codex, moneta, fiat, vaultEPTActions } = contextData.fiat.getContracts();
      const underlier = contextData.fiat.getERC20Contract(data.collateralType.properties.underlierToken);
      const [underlierAllowance, monetaDelegate, fiatAllowance] = await contextData.fiat.multicall([
        { contract: underlier, method: 'allowance', args: [proxy, vaultEPTActions.address] },
        { contract: codex, method: 'delegates', args: [proxy, moneta.address] },
        { contract: fiat, method: 'allowance', args: [proxy, vaultEPTActions.address] }
      ]);
      setModifyPositionData({ ...modifyPositionData, ...data, underlierAllowance, monetaDelegate, fiatAllowance });
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
    if (
      !connector
      || modifyPositionData.collateralType == null
      || (selectedCollateralTypeId == null && selectedPositionId == null)
      || modifyPositionFormData.outdated === false
    ) return;

    const timeOutId = setTimeout(() => {
      (async function () {
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
              const { eptData: { balancerVault: balancer, poolId: pool }} = collateralType.properties;
              tokensOut = await fiat.call(vaultEPTActions, 'underlierToPToken', vault, balancer, pool, underlier);
            } else if (vaultType === 'ERC1155:FC' && underlier.gt(ZERO)) {
              if (collateralType.properties.fcData == undefined) throw new Error('Missing data');
              tokensOut = await fiat.call(vaultFCActions, 'underlierToFCash', tokenId, underlier);
            } else if (vaultType === 'ERC20:FY' && underlier.gt(ZERO)) {
              if (collateralType.properties.fyData == undefined) throw new Error('Missing data');
              const { fyData: { yieldSpacePool }} = collateralType.properties;
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
              const { eptData: { balancerVault: balancer, poolId: pool }} = collateralType.properties;
              underlierAmount = await fiat.call(vaultEPTActions, 'pTokenToUnderlier', vault, balancer, pool, tokenIn);
            } else if (vaultType === 'ERC1155:FC' && tokenIn.gt(ZERO)) {
              if (collateralType.properties.fcData == undefined) throw new Error('Missing data');
              underlierAmount = await fiat.call(vaultFCActions, 'fCashToUnderlier', tokenId, tokenIn);
            } else if (vaultType === 'ERC20:FY' && tokenIn.gt(ZERO)) {
              if (collateralType.properties.fyData == undefined) throw new Error('Missing data');
              const { fyData: { yieldSpacePool }} = collateralType.properties;
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

  // Transaction methods
  React.useEffect(() => {
    if (
      !connector
      || contextData.fiat == null
      || transactionData.action == null
      || transactionData.status === 'sent'
    ) return;

    setTransactionData({ ...transactionData, status: 'sent' });
    const { action } = transactionData;

    (async function () {
      try {
        const {
          proxyRegistry, codex, moneta, vaultEPTActions, vaultFCActions, vaultFYActions
        } = contextData.fiat.getContracts();
        if (action == 'setupProxy') {
          console.log(await contextData.fiat.dryrun(proxyRegistry, 'deployFor', contextData.user));
        }
        if (action == 'setUnderlierAllowance') {
          const token = contextData.fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
          console.log(await contextData.fiat.dryrun(
            token, 'approve', contextData.proxies[0], modifyPositionFormData.underlier
          ));
        }
        if (action == 'unsetUnderlierAllowance') {
          const token = contextData.fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
          console.log(await contextData.fiat.dryrun(token, 'approve', contextData.proxies[0], 0));
        }
        if (action == 'setMonetaDelegate') {
          console.log(await contextData.fiat.dryrun(codex, 'grantDelegate', moneta.address));
        }
        if (action == 'unsetMonetaDelegate') {
          console.log(await contextData.fiat.dryrun(codex, 'revokeDelegate', moneta.address));
        }
        if (action == 'buyCollateralAndModifyDebt') {
          if (!modifyPositionData.collateralType) throw null;
          const { properties } = modifyPositionData.collateralType;
          const [collateralTypeData] = await contextData.fiat.fetchCollateralTypesAndPrices(
            [{ vault: properties.vault, tokenId: properties.tokenId }]
          );
          const normalDebt = contextData.fiat.debtToNormalDebt(
            modifyPositionFormData.deltaDebt, collateralTypeData.state.codex.virtualRate
          ).mul(WAD.sub(decToWad(0.001))).div(WAD);
          const tokenAmount = wadToScale(modifyPositionFormData.deltaCollateral, properties.tokenScale);
          const deadline = Math.round(+new Date() / 1000) + 3600;
          if (properties.vaultType === 'ERC20:EPT' && properties.eptData) {
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultEPTActions,
              'buyCollateralAndModifyDebt',
              properties.vault,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              modifyPositionFormData.underlier,
              normalDebt,
              [
                properties.eptData.balancerVault,
                properties.eptData.poolId,
                properties.underlierToken,
                properties.token,
                tokenAmount,
                deadline,
                modifyPositionFormData.underlier
              ]
            ));
          } else if (properties.vaultType === 'ERC1155:FC' && properties.fcData) {
            // 1 - (underlier / deltaCollateral)
            const minLendRate = wadToScale(
              WAD.sub(
                scaleToWad(modifyPositionFormData.underlier, properties.underlierScale).mul(WAD)
                .div(modifyPositionFormData.deltaCollateral)
              ),
              properties.tokenScale
            );
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultFCActions,
              'buyCollateralAndModifyDebt',
              properties.vault,
              properties.token,
              properties.tokenId,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              tokenAmount,
              normalDebt,
              minLendRate,
              modifyPositionFormData.underlier
            ));
          } else if (properties.vaultType === 'ERC20:FY' && properties.fyData) {
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultFYActions,
              'buyCollateralAndModifyDebt',
              properties.vault,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              modifyPositionFormData.underlier,
              normalDebt,
              [
                tokenAmount,
                properties.fyData.yieldSpacePool,
                properties.underlierToken,
                properties.token
              ]
            ));
          }
        }
        if (action == 'sellCollateralAndModifyDebt') {
          if (!modifyPositionData.collateralType) throw null;
          const { properties } = modifyPositionData.collateralType;
          const [collateralTypeData] = await contextData.fiat.fetchCollateralTypesAndPrices(
            [{ vault: properties.vault, tokenId: properties.tokenId }]
          );
          const normalDebt = contextData.fiat.debtToNormalDebt(
            modifyPositionFormData.deltaDebt, collateralTypeData.state.codex.virtualRate
          ).mul(WAD.sub(decToWad(0.001))).div(WAD);
          const tokenAmount = wadToScale(modifyPositionFormData.deltaCollateral, properties.tokenScale);
          const deadline = Math.round(+new Date() / 1000) + 3600;
          if (properties.vaultType === 'ERC20:EPT' && properties.eptData) {
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultEPTActions,
              'sellCollateralAndModifyDebt',
              properties.vault,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              tokenAmount,
              normalDebt,
              [
                properties.eptData.balancerVault,
                properties.eptData.poolId,
                properties.token,
                properties.underlierToken,
                modifyPositionFormData.underlier,
                deadline,
                tokenAmount
              ]
            ));
          } else if (properties.vaultType === 'ERC1155:FC' && properties.fcData) {
            // 1 - (deltaCollateral / underlier)
            const maxBorrowRate = wadToScale(
              WAD.sub(
                modifyPositionFormData.deltaCollateral.mul(WAD)
                .div(scaleToWad(modifyPositionFormData.underlier, properties.underlierScale))
              ),
              properties.tokenScale
            );
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultFCActions,
              'sellCollateralAndModifyDebt',
              properties.vault,
              properties.token,
              properties.tokenId,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              tokenAmount,
              normalDebt,
              maxBorrowRate
            ));
          } else if (properties.vaultType === 'ERC20:FY' && properties.fyData) {
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultFYActions,
              'sellCollateralAndModifyDebt',
              properties.vault,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              tokenAmount,
              normalDebt,
              [
                modifyPositionFormData.underlier,
                properties.fyData.yieldSpacePool,
                properties.token,
                properties.underlierToken
              ]
            ));
          } else { throw null; }
        }
        if (action == 'redeemCollateralAndModifyDebt') {
          if (!modifyPositionData.collateralType) throw null;
          const { properties } = modifyPositionData.collateralType;
          const [collateralTypeData] = await contextData.fiat.fetchCollateralTypesAndPrices(
            [{ vault: properties.vault, tokenId: properties.tokenId }]
          );
          const normalDebt = contextData.fiat.debtToNormalDebt(
            modifyPositionFormData.deltaDebt, collateralTypeData.state.codex.virtualRate
          ).mul(WAD.sub(decToWad(0.001))).div(WAD);
          const tokenAmount = wadToScale(modifyPositionFormData.deltaCollateral, properties.tokenScale);
          if (properties.vaultType === 'ERC20:EPT' && properties.eptData) {
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultEPTActions,
              'redeemCollateralAndModifyDebt',
              properties.vault,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              tokenAmount,
              normalDebt
             
            ));
          } else if (properties.vaultType === 'ERC1155:FC' && properties.fcData) {
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultFCActions,
              'redeemCollateralAndModifyDebt',
              properties.vault,
              properties.token,
              properties.tokenId,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              tokenAmount,
              normalDebt
            ));
          } else if (properties.vaultType === 'ERC20:FY' && properties.fyData) {
            console.log(await contextData.fiat.dryrunViaProxy(
              contextData.proxies[0],
              vaultFYActions,
              'redeemCollateralAndModifyDebt',
              properties.vault,
              contextData.proxies[0],
              contextData.user,
              contextData.user,
              tokenAmount,
              normalDebt
            ));
          } else { throw null; }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) { console.error(error); }
      setTransactionData({ ...transactionData, action: null, status: null });
    })();
  }, [connector, contextData, modifyPositionData, modifyPositionFormData, transactionData]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
        <h4 style={{ justifyContent: 'flex',  }}>Lever App</h4>
        <ConnectButton />
      </div>
      <Spacer y={2} />
      <Container>
        <ProxyCard {...contextData} onSendTransaction={(action) => setTransactionData({ ...transactionData, action })}/>
      </Container>
      <Spacer y={2} />
      <Container>
        <CollateralTypesTable
          collateralTypesData={collateralTypesData}
          onSelectCollateralType={(collateralTypeId) => {
            setSelectedPositionId(initialState.selectedPositionId);
            setSelectedCollateralTypeId(collateralTypeId);
          }}
        />
      </Container>
      <Spacer y={2} />
      <Container>
        <PositionsTable
          collateralTypesData={collateralTypesData}
          positionsData={positionsData}
          onSelectPosition={(positionId) => {
            setSelectedPositionId(positionId);
            setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          }}
        />
      </Container>

      <CreatePositionModal
        contextData={contextData}
        modifyPositionData={modifyPositionData}
        modifyPositionFormData={modifyPositionFormData}
        transactionData={transactionData}
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
        contextData={contextData}
        modifyPositionData={modifyPositionData}
        modifyPositionFormData={modifyPositionFormData}
        transactionData={transactionData}
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
