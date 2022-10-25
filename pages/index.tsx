import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import { useAccount, useNetwork } from 'wagmi';
import { ethers } from 'ethers';
import {
  Container, Text, Table, Spacer, Modal, Input, Loading, Card, Button, Switch, Link, Navbar, Grid
} from '@nextui-org/react';
import { Slider } from 'antd';
import 'antd/dist/antd.css';

// @ts-ignore
import { FIAT, ZERO, WAD, decToScale, decToWad, scaleToWad, scaleToDec, wadToDec, wadToScale } from '@fiatdao/sdk';

import { styled } from '@nextui-org/react';

const StyledBadge = styled('span', {
  display: 'inline-block',
  textTransform: 'uppercase',
  padding: '$2 $3',
  margin: '0 2px',
  fontSize: '10px',
  fontWeight: '$bold',
  borderRadius: '14px',
  letterSpacing: '0.6px',
  lineHeight: 1,
  boxShadow: '1px 2px 5px 0px rgb(0 0 0 / 5%)',
  alignItems: 'center',
  alignSelf: 'center',
  color: '$white',
  variants: {
    type: {
      green: {
        bg: '$successLight',
        color: '$successLightContrast'
      },
      red: {
        bg: '$errorLight',
        color: '$errorLightContrast'
      },
      orange: {
        bg: '$warningLight',
        color: '$warningLightContrast'
      }
    }
  },
  defaultVariants: {
    type: 'active'
  }
});

function floor2(dec: any) {
  return Math.floor(Number(String(dec)) * 100) / 100;
}

function floor4(dec: any) {
  return Math.floor(Number(String(dec)) * 10000) / 10000;
}

const formatUnixTimestamp = (unixTimestamp: ethers.BigNumberish): string => {
  const date = new Date(Number(unixTimestamp.toString()) * 1000);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const Home: NextPage = () => {
  const { connector } = useAccount();
  const { chain } = useNetwork();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialState = {
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
      monetaDelegate: null as null | boolean
    },
    modifyPositionFormData: {
      outdated: true,
      mode: 'deposit', // [deposit, withdraw]
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

  const [mounted, setMounted] = React.useState(false);
  const [contextData, setContextData] = React.useState(initialState.contextData);
  const [collateralTypesData, setCollateralTypesData] = React.useState(initialState.collateralTypesData);
  const [positionsData, setPositionsData] = React.useState(initialState.positionsData);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [modifyPositionFormData, setModifyPositionFormData] = React.useState(initialState.modifyPositionFormData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);
  const [selectedPositionId, setSelectedPositionId] = React.useState(initialState.selectedPositionId);
  const [selectedCollateralTypeId, setSelectedCollateralTypeId] = React.useState(initialState.selectedCollateralTypeId);

  const encodeCollateralTypeId = (vault: string, tokenId: ethers.BigNumberish) => (`${vault}-${tokenId.toString()}`);
  const decodeCollateralTypeId = (collateralTypeId: string) => {
    const [vault, tokenId] = collateralTypeId.split('-');
    return { vault, tokenId };
  }
  const encodePositionId = (vault: string, tokenId: ethers.BigNumberish, owner: string) => (
    `${vault}-${tokenId.toString()}-${owner}`
  );
  const decodePositionId = (positionId: string) => {
    const [vault, tokenId, owner] = positionId.split('-');
    return { vault, tokenId, owner };
  }
  const getCollateralTypeData = (
    collateralTypes: Array<any>, vault: string, tokenId: ethers.BigNumberish
  ): undefined | any => {
    return collateralTypes.find(({properties: { vault: vault_, tokenId: tokenId_ }}) => (
      vault === vault_ && tokenId.toString() === tokenId_.toString()
    ));
  }
  const getPositionData = (
    positions: Array<any>, vault: string, tokenId: ethers.BigNumberish, owner: string
  ): undefined | any => {
    return positions.find(({ vault: vault_, tokenId: tokenId_, owner: owner_ }) => (
      vault === vault_ && tokenId.toString() === tokenId_.toString() && owner === owner_
    ));
  }

  // Reset state if network or account changes
  React.useEffect(() => {
    if (!connector || mounted) return;
    connector.on('change', () => {
      setContextData(initialState.contextData);
      setCollateralTypesData(initialState.collateralTypesData);
      setPositionsData(initialState.positionsData);
      setModifyPositionData(initialState.modifyPositionData);
      setModifyPositionFormData(initialState.modifyPositionFormData);
      setTransactionData(initialState.transactionData);
      setSelectedPositionId(initialState.selectedPositionId);
      setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
    });
    setMounted(true);
  }, [mounted, connector, initialState]);

  // Fetch User, CollateralType and Vault data
  React.useEffect(() => {
    if (!connector || collateralTypesData.length > 0 || positionsData.length > 0 || contextData.fiat != null) return;
    
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
  }, [connector, chain, collateralTypesData, positionsData, contextData]);

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
      data = { ...data, position: getPositionData(positionsData, vault, tokenId, owner) };
    }
    setModifyPositionData(data);

    if (contextData.proxies.length === 0) return;
    const { proxies: [proxy] } = contextData;
    if (data.position && data.position.owner.toLowerCase() !== proxy.toLowerCase()) return;

    (async function () {
      if (data.collateralType == null) return;
      const { codex, moneta, vaultEPTActions } = contextData.fiat.getContracts();
      const underlier = contextData.fiat.getERC20Contract(data.collateralType.properties.underlierToken);
      const [underlierAllowance, monetaDelegate] = await contextData.fiat.multicall([
        { contract: underlier, method: 'allowance', args: [proxy, vaultEPTActions.address] },
        { contract: codex, method: 'delegates', args: [proxy, moneta.address] }
      ]);
      setModifyPositionData({ ...modifyPositionData, ...data, underlierAllowance, monetaDelegate });
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
        const { vault, tokenId, tokenScale, vaultType } = collateralType.properties;
        const { codex: { virtualRate: rate }, collybus: { liquidationPrice } } = collateralType.state;
        const { fiat } = contextData;
        const { vaultEPTActions, vaultFCActions, vaultFYActions } = fiat.getContracts();
        try {
          if (modifyPositionFormData.mode === 'deposit') {
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
              const deltaNormalDebt = fiat.computeMaxNormalDebt(deltaCollateral, targetedHealthFactor, rate, liquidationPrice);
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
          } else if (modifyPositionFormData.mode === 'withdraw') {
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
          } else { throw new Error('Invalid mode'); }
        } catch (error) {
          console.log(error);
          setModifyPositionFormData({
            ...modifyPositionFormData,
            underlier: (modifyPositionFormData.mode === 'deposit') ? modifyPositionFormData.underlier : ZERO,
            deltaCollateral: (modifyPositionFormData.mode === 'withdraw') ? modifyPositionFormData.underlier : ZERO,
            deltaDebt: (modifyPositionFormData.mode === 'withdraw') ? modifyPositionFormData.deltaDebt : ZERO,
            collateral: ZERO,
            debt: ZERO,
            healthFactor: ZERO,
            outdated: false,
            error: JSON.stringify(error)
          });
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
        if (action == 'setupProxy') {
          console.log(await contextData.fiat.dryrun(
            contextData.fiat.getContracts().proxyRegistry,
            'deployFor',
            contextData.user
          ));
        }
        if (action == 'setUnderlierAllowance') {
          console.log(await contextData.fiat.dryrun(
            contextData.fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken),
            'approve',
            contextData.proxies[0],
            modifyPositionFormData.underlier
          ));
        }
        if (action == 'unsetUnderlierAllowance') {
          console.log(await contextData.fiat.dryrun(
            contextData.fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken),
            'approve',
            contextData.proxies[0],
            0
          ));
        }
        if (action == 'setMonetaDelegate') {
          console.log(await contextData.fiat.dryrun(
            contextData.fiat.getContracts().codex,
            'grantDelegate',
            contextData.fiat.getContracts().moneta.address
          ));
        }
        if (action == 'unsetMonetaDelegate') {
          console.log(await contextData.fiat.dryrun(
            contextData.fiat.getContracts().codex,
            'revokeDelegate',
            contextData.fiat.getContracts().moneta.address
          ));
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
            console.log(await contextData.fiat.dryrun(
              contextData.fiat.getContracts().vaultEPTActions,
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
            console.log(await contextData.fiat.dryrun(
              contextData.fiat.getContracts().vaultFCActions,
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
            console.log(await contextData.fiat.dryrun(
              contextData.fiat.getContracts().vaultFYActions,
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
            console.log(await contextData.fiat.dryrun(
              contextData.fiat.getContracts().vaultEPTActions,
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
            console.log(await contextData.fiat.dryrun(
              contextData.fiat.getContracts().vaultFCActions,
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
            console.log(await contextData.fiat.dryrun(
              contextData.fiat.getContracts().vaultFYActions,
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
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) { console.error(error); }
      setTransactionData({ ...transactionData, action: null, status: null });
    })();
  }, [connector, contextData, modifyPositionData, modifyPositionFormData, transactionData]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: 12,
        }}
      >
        <h4 style={{ justifyContent: 'flex',  }}>Lever App</h4>
        <ConnectButton />
      </div>

      <Spacer y={2} />

      <Container>
        <Card css={{ mw: '400px' }}>
          <Card.Body>
            <Text b size={18}>Proxy</Text>
            {(contextData.proxies.length > 0)
              ? (
                <Link
                  target='_blank'
                  href={`${contextData.explorerUrl}/address/${contextData.proxies[0]}`}
                  isExternal={true}
                >
                  {contextData.proxies[0]}
                </Link>)
              : (contextData.user === null) ? (null) : (
                <>
                  <Spacer y={1} />
                  <Button onPress={() => setTransactionData({ ...transactionData, action: 'setupProxy' })}>
                    Setup a new Proxy account
                  </Button>
                </>
              )
            }
          </Card.Body>
        </Card>
      </Container>

      <Spacer y={2} />

      <Container>
        <Text h1>Collateral Types</Text>
        {(collateralTypesData.length != 0) && (
          <Table
            aria-label='CollateralTypes'
            css={{
              height: 'auto',
              minWidth: '100%',
            }}
            selectionMode='single'
            selectedKeys={'1'}
            onSelectionChange={(selected) => {
              setSelectedPositionId(initialState.selectedPositionId);
              setSelectedCollateralTypeId(Object.values(selected)[0]);
            }}
          >
            <Table.Header>
              <Table.Column>Protocol</Table.Column>
              <Table.Column>Token</Table.Column>
              <Table.Column>Underlier</Table.Column>
              <Table.Column>Maturity</Table.Column>
              <Table.Column>TVL</Table.Column>
            </Table.Header>
            <Table.Body>
              {
                collateralTypesData.map((collateralType) => {
                  const { vault, tokenId, tokenSymbol, underlierSymbol, maturity } = collateralType.properties;
                  const { protocol, asset } = collateralType.metadata;
                  const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
                  return (
                    <Table.Row key={encodeCollateralTypeId(vault, tokenId)}>
                      <Table.Cell>{protocol}</Table.Cell>
                      <Table.Cell>{`${asset} (${tokenSymbol})`}</Table.Cell>
                      <Table.Cell>{underlierSymbol}</Table.Cell>
                      <Table.Cell>
                        <StyledBadge type={(new Date() < maturityFormatted) ? 'green' : 'red'}>
                          {formatUnixTimestamp(maturity)}
                        </StyledBadge>
                      </Table.Cell>
                      <Table.Cell>0</Table.Cell>
                    </Table.Row>
                  );
                })
              }
            </Table.Body>
          </Table>
        )}
      </Container>
      
      <Spacer y={2} />
      
      <Container>
        <Text h1>Positions</Text>
        {(positionsData.length != 0) && (
          <Table
            aria-label='Positions'
            css={{
              height: 'auto',
              minWidth: '100%',
            }}
            selectionMode='single'
            selectedKeys={'1'}
            onSelectionChange={(selected) => {
              setSelectedPositionId(Object.values(selected)[0]);
              setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
            }}
          >
            <Table.Header>
              <Table.Column>Protocol</Table.Column>
              <Table.Column>Token</Table.Column>
              <Table.Column>TokenId</Table.Column>
              <Table.Column>Collateral</Table.Column>
              <Table.Column>Normal Debt</Table.Column>
            </Table.Header>
            <Table.Body>
              {
                positionsData.map((position) => {
                  const {
                    owner,
                    vault,
                    tokenId,
                    collateral,
                    normalDebt
                    // @ts-ignore
                  } = position;
                  const {
                    // @ts-ignore
                    properties: {
                      tokenSymbol
                    },
                    // @ts-ignore
                    metadata: {
                      protocol,
                      asset
                    }
                  } = getCollateralTypeData(collateralTypesData, vault, tokenId);
                  return (
                    <Table.Row key={encodePositionId(vault, tokenId, owner)}>
                      <Table.Cell>{protocol}</Table.Cell>
                      <Table.Cell>{`${asset} (${tokenSymbol})`}</Table.Cell>
                      <Table.Cell>{(tokenId as Number).toString()}</Table.Cell>
                      <Table.Cell>{wadToDec(collateral)}</Table.Cell>
                      <Table.Cell>{wadToDec(normalDebt)}</Table.Cell>
                    </Table.Row>
                  );
                })
              }
            </Table.Body>
          </Table>
        )}
      </Container>

      <Modal
        preventClose
        closeButton={transactionData.status !== 'sent'}
        blur
        aria-labelledby='modal-title'
        open={(modifyPositionData.collateralType != null)}
        onClose={() => {
          setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          setSelectedPositionId(initialState.selectedPositionId);
          setModifyPositionData(initialState.modifyPositionData);
          setModifyPositionFormData(initialState.modifyPositionFormData);
        }}
      >
        <Modal.Header>
          <Text id='modal-title' size={18}>
            <Text b size={18}>
              {(selectedCollateralTypeId) ? 'Create Position' : 'Modify Position'}
            </Text>
            <br/>
            {(modifyPositionData.collateralType != null) && (() => {
              const { collateralType: { metadata : { protocol, asset }, properties: { maturity } } } = modifyPositionData;
              return (
                <>
                  <Text b size={16}>{`${protocol} - ${asset}`}</Text>
                  <br/>
                  <Text b size={14}>{`${formatUnixTimestamp(maturity)}`}</Text>
                </>
              );
            })()}
          </Text>
        </Modal.Header>
        <Modal.Body>
          <Navbar
            variant='static'
            isCompact
            disableShadow
            disableBlur
            containerCss={{justifyContent: 'center', background: 'transparent'}}
          >
            <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
              {(selectedCollateralTypeId) ? (
                <Navbar.Link isActive={modifyPositionFormData.mode === 'deposit'}>Deposit</Navbar.Link>
              ) : (
                <>
                  <Navbar.Link
                    isActive={modifyPositionFormData.mode === 'deposit'}
                    onClick={() => setModifyPositionFormData({
                      ...initialState.modifyPositionFormData, mode: 'deposit'
                    })}
                  >Increase</Navbar.Link>
                  <Navbar.Link
                    isActive={modifyPositionFormData.mode === 'withdraw'}
                    onClick={() => setModifyPositionFormData({
                      ...initialState.modifyPositionFormData, mode: 'withdraw'
                    })}
                  >Decrease</Navbar.Link>
                </>
              )}
            </Navbar.Content>
          </Navbar>
          
          <Text b size={'m'}>Inputs</Text>
          <Grid.Container gap={0} justify='space-between' css={{ marginBottom: '1rem' }}>
            <Grid>
              {(modifyPositionFormData.mode === 'deposit') ? (
                <Input
                  disabled={transactionData.status === 'sent'}
                  value={
                    (modifyPositionData.collateralType === null) ? (0) :
                    floor2(scaleToDec(modifyPositionFormData.underlier, modifyPositionData.collateralType.properties.underlierScale))
                  }
                  onChange={(event) => {
                    if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                      setModifyPositionFormData({
                        ...modifyPositionFormData, deltaCollateral: ZERO, deltaDebt: ZERO, outdated: false
                      });  
                    } else {
                      const num = (Number(event.target.value) < 0) ? 0 : Number(event.target.value);
                      const rounded = floor4(num);
                      setModifyPositionFormData({
                        ...modifyPositionFormData,
                        underlier: decToScale(rounded, modifyPositionData.collateralType.properties.underlierScale),
                        outdated: true
                      });
                    }
                  }}
                  placeholder='0'
                  type='number'
                  label='Underlier to swap'
                  labelRight={(modifyPositionData.collateralType != null) && modifyPositionData.collateralType.properties.underlierSymbol}
                  bordered
                  size='sm'
                  borderWeight='light'
                />
              ) : (
                <Input
                  disabled={transactionData.status === 'sent'}
                  value={
                    (modifyPositionData.collateralType === null) ? (0) :
                    floor2(wadToDec(modifyPositionFormData.deltaCollateral))
                  }
                  onChange={(event) => {
                    if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                      setModifyPositionFormData({
                        ...modifyPositionFormData, underlier: ZERO, healthFactor: ZERO, outdated: false
                      });  
                    } else {
                      const num = (Number(event.target.value) < 0) ? 0 : Number(event.target.value);
                      const rounded = floor4(num);
                      setModifyPositionFormData({
                        ...modifyPositionFormData,
                        deltaCollateral: decToWad(rounded),
                        outdated: true
                      });
                    }
                  }}
                  placeholder='0'
                  type='number'
                  label='Collateral to withdraw and swap'
                  labelRight={(modifyPositionData.collateralType != null) && modifyPositionData.collateralType.metadata.symbol}
                  bordered
                  size='sm'
                  borderWeight='light'
                  width='13.35rem'
                />
              )}
            </Grid>
            <Grid>
              <Input
                disabled={transactionData.status === 'sent'}
                value={floor2(Number(wadToDec(modifyPositionFormData.slippagePct)) * 100)}
                onChange={(event) => {
                  if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                    setModifyPositionFormData({
                      ...modifyPositionFormData,
                      healthFactor: ZERO,
                      deltaCollateral: (modifyPositionFormData.mode === 'deposit')
                        ? ZERO : modifyPositionFormData.deltaCollateral,
                      collateral: ZERO,
                      debt: ZERO,
                      outdated: false
                    });  
                  } else {
                    const num = (Number(event.target.value) < 0)
                      ? 0 : (Number(event.target.value) > 50) ? 50 : Number(event.target.value);
                    const raw = num / 100;
                    const rounded = floor4(raw);
                    setModifyPositionFormData({
                      ...modifyPositionFormData,
                      slippagePct: decToWad(rounded),
                      outdated: true
                    });
                  }
                }}
                step='0.01'
                placeholder='0'
                type='number'
                label='Slippage'
                labelRight={'%'}
                bordered
                size='sm'
                borderWeight='light'
                width='7.5rem'
              />
            </Grid>
          </Grid.Container>

          {(selectedCollateralTypeId)
            ? (
              <>
                <Text size={'0.75rem'} style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}>
                  Targeted health factor ({Number(wadToDec(modifyPositionFormData.targetedHealthFactor))})
                </Text>
                <Card variant='bordered' borderWeight='light'>
                  <Card.Body style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}>
                    <Slider
                      handleStyle={{ borderColor: '#0072F5' }}
                      included={false}
                      disabled={transactionData.status === 'sent'}
                      value={Number(wadToDec(modifyPositionFormData.targetedHealthFactor))}
                      onChange={(value) => setModifyPositionFormData(
                        { ...modifyPositionFormData, targetedHealthFactor: decToWad(String(value)), outdated: true })
                      }
                      min={1.001}
                      max={5.0}
                      step={0.001}
                      reverse
                      tooltip={{ getPopupContainer: (t) => t }}
                      marks={{
                        5.00: { style: { color: 'grey', fontSize: '0.75rem' }, label: 'Safe' },
                        4.0: { style: { color: 'grey', fontSize: '0.75rem' }, label: '4.0' },
                        3.00: { style: { color: 'grey', fontSize: '0.75rem' }, label: '3.0' },
                        2.00: { style: { color: 'grey', fontSize: '0.75rem' }, label: '2.0' },
                        1.001: { style: { color: 'grey', fontSize: '0.75rem', borderColor: 'white' }, label: 'Unsafe' },
                      }}
                    />
                  </Card.Body>
                </Card>
              </>
            )
            : (
              <Input
                disabled={transactionData.status === 'sent'}
                value={(modifyPositionData.collateralType === null) ? (0) : floor2(wadToDec(modifyPositionFormData.deltaDebt))}
                onChange={(event) => {
                  if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                    setModifyPositionFormData({
                      ...modifyPositionFormData,
                      healthFactor: ZERO,
                      collateral: ZERO,
                      debt: ZERO,
                      deltaCollateral: (modifyPositionFormData.mode === 'deposit')
                        ? ZERO : modifyPositionFormData.deltaCollateral,
                      outdated: false
                    });  
                  } else {
                    const num = (Number(event.target.value) < 0) ? 0 : Number(event.target.value);
                    const rounded = floor4(num);
                    setModifyPositionFormData({
                      ...modifyPositionFormData,
                      deltaDebt: decToWad(rounded),
                      outdated: true
                    });
                  }
                }}
                placeholder='0'
                type='number'
                label={(modifyPositionFormData.mode === 'deposit') ? 'FIAT to borrow' : 'FIAT to pay back'}
                labelRight={'FIAT'}
                bordered
                size='sm'
                borderWeight='light'
              />
            )
          }
         
        </Modal.Body>
        <Spacer y={0.75} />
        {(['deposit', 'withdraw'].includes(modifyPositionFormData.mode)) ? (
          <>
            <Card.Divider/>
            <Modal.Body>
              <Spacer y={0} />
              <Text b size={'m'}>Swap Preview</Text>
              <Input
                readOnly
                value={
                  (modifyPositionFormData.outdated) ? (' ') : (modifyPositionFormData.mode === 'deposit')
                    ? (floor4(wadToDec(modifyPositionFormData.deltaCollateral)))
                    : (floor4(scaleToDec(
                      modifyPositionFormData.underlier, modifyPositionData.collateralType.properties.underlierScale
                    )))
                }
                placeholder='0'
                type='string'
                label={(modifyPositionFormData.mode === 'deposit')
                  ? 'Collateral to deposit (incl. slippage)'
                  : 'Underliers to withdraw (incl. slippage)'
                }
                labelRight={
                  (modifyPositionData.collateralType != null) && (modifyPositionFormData.mode === 'deposit')
                    ? modifyPositionData.collateralType?.metadata?.symbol : modifyPositionData.collateralType?.properties?.underlierSymbol
                }
                contentLeft={(modifyPositionFormData.outdated) ? (<Loading size='xs'/>) : (null)}
                size='sm'
                status='primary'
              />
            </Modal.Body>
            <Spacer y={0.75} />
          </>
        ) : (null)}
        <Card.Divider/>
        <Modal.Body>
          <Spacer y={0} />
          <Text b size={'m'}>Position Preview</Text>
          <Input
            readOnly
            value={(modifyPositionFormData.outdated) ? (' ') : (floor4(wadToDec(modifyPositionFormData.collateral)))}
            placeholder='0'
            type='string'
            label={'Collateral'}
            labelRight={(modifyPositionData.collateralType != null) && modifyPositionData.collateralType.metadata.symbol}
            contentLeft={(modifyPositionFormData.outdated) ? (<Loading size='xs'/>) : (null)}
            size='sm'
            status='primary'
          />
          <Input
            readOnly
            value={(modifyPositionFormData.outdated) ? (' ') : (floor4(wadToDec(modifyPositionFormData.debt)))}
            placeholder='0'
            type='string'
            label='Debt'
            labelRight={'FIAT'}
            contentLeft={(modifyPositionFormData.outdated) ? (<Loading size='xs'/>) : (null)}
            size='sm'
            status='primary'
          />
          <Input
            readOnly
            value={(modifyPositionFormData.outdated)
              ? (' ') : (modifyPositionFormData.healthFactor.eq(ethers.constants.MaxUint256))
                ? ('∞')
                : (floor4(wadToDec(modifyPositionFormData.healthFactor)))
            }
            placeholder='0'
            type='string'
            label='Health Factor'
            labelRight={'🚦'}
            contentLeft={(modifyPositionFormData.outdated) ? (<Loading size='xs'/>) : (null)}
            size='sm'
            status='primary'
          />
          {/* <Spacer y={0} />
          <Text b size={'m'}>Summary</Text>
          <Text size="0.75rem">{(modifyPositionFormData.deltaCollateral.isZero()) ? null : 
          <>
            Swap <b>{floor2(scaleToDec(modifyPositionFormData.underlier, modifyPositionData.collateralType.properties.underlierScale))} {modifyPositionData.collateralType.properties.underlierSymbol} </b>
            for <b>~{floor2(wadToDec(modifyPositionFormData.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b>.
            Deposit <b>~{floor2(wadToDec(modifyPositionFormData.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b> as deltaCollateral.
            Borrow <b>~{floor2(wadToDec(modifyPositionFormData.deltaDebt))} FIAT</b> against the deltaCollateral.
          </>
          }</Text> */}
        </Modal.Body>
        <Modal.Footer justify='space-evenly'>
          <Text size={'0.875rem'}>
            Approve {(modifyPositionData.collateralType != null) && modifyPositionData.collateralType.properties.underlierSymbol}
          </Text>
          <Switch
            disabled={
              contextData.proxies.length == 0
              || transactionData.status === 'sent'
              || modifyPositionData.underlierAllowance === null
            }
            // @ts-ignore
            checked={() => (
              modifyPositionData.collateralType != null
              && !modifyPositionFormData.underlier.isZero()
              && modifyPositionData.underlierAllowance
              && modifyPositionData.underlierAllowance.gte(modifyPositionFormData.underlier)
            )}
            onChange={() => setTransactionData({ ...transactionData, action: 'setUnderlierAllowance' })}
            color='primary'
            icon={
              (['setUnderlierAllowance', 'unsetUnderlierAllowance'].includes(transactionData.action || '')
              && transactionData.status === 'sent')
                ? (<Loading size='xs' />)
                : (null)
            }
          />
          <Spacer y={0.5} />
          <Text size={'0.875rem'}>Enable FIAT</Text>
          <Switch
            disabled={
              contextData.proxies.length == 0
              || transactionData.status === 'sent'
              || modifyPositionData.monetaDelegate === null
            }
            // @ts-ignore
            checked={() => (modifyPositionData.collateralType != null) && (!!modifyPositionData.monetaDelegate)}
            onChange={() => setTransactionData({ ...transactionData, action: 'setMonetaDelegate' })}
            color='primary'
            icon={
              (['setMonetaDelegate', 'unsetMonetaDelegate'].includes(transactionData.action || '')
              && transactionData.status === 'sent')
                ? (<Loading size='xs' />)
                : (null)
            }
          />
          <Spacer y={3} />
          <Button
            css={{minWidth: '100%'}}
            disabled={(
              contextData.proxies.length == 0
              || modifyPositionFormData.underlier.isZero()
              || modifyPositionFormData.deltaCollateral.isZero()
              || modifyPositionData.underlierAllowance === null
              || modifyPositionData.underlierAllowance.lt(modifyPositionFormData.underlier)
              || transactionData.status === 'sent'
            )}
            icon={(transactionData.action === 'buyCollateralAndModifyDebt' && transactionData.status === 'sent')
              ? (<Loading size='xs' />)
              : (null)
            }
            onPress={() => setTransactionData({ ...transactionData, action: 'buyCollateralAndModifyDebt' })}
          >
            Deposit
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Home;
