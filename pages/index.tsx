import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import { useAccount, useNetwork } from 'wagmi';
import { ethers } from 'ethers';
import { Container, Text, Table, Spacer, Modal, Input, Loading, Card, Button, Switch, Link } from '@nextui-org/react';
import { Slider } from 'antd';
import 'antd/dist/antd.css';

// @ts-ignore
import { FIAT, ZERO, WAD, decToScale, decToWad, scaleToWad, scaleToDec, wadToDec } from '@fiatdao/sdk';

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

const Home: NextPage = () => {
  const { connector } = useAccount();
  const { chain } = useNetwork();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialState = {
    userData: {
      fiat: null as null | FIAT,
      explorerUrl: null as null | string,
      user: null as null | string,
      proxies: [] as Array<string>
    },
    positionsData: [] as Array<any>,
    selPositionId: null as null | string,
    collateralTypesData: [] as Array<any>,
    selCollateralTypeId: null as null | string,
    modifyPositionData: {
      vault: null as undefined | null | any,
      position: null as undefined | null | any,
      underlierAllowance: null as null | ethers.BigNumber,
      monetaDelegate: null as null | boolean
    },
    modifyPositionFormData: {
      outdated: false,
      underlier: ZERO as ethers.BigNumber,
      healthFactor: decToWad('1.2') as ethers.BigNumber,
      collateral: ZERO as ethers.BigNumber,
      debt: ZERO as ethers.BigNumber,
      slippagePct: decToWad('0.001') as ethers.BigNumber,
    },
    transactionData: {
      action: null as null | string,
      status: null as null | string, // error, sent, confirming, confirmed
    }
  } 

  const [mounted, setMounted] = React.useState(false);
  const [userData, setUserData] = React.useState(initialState.userData);
  const [positionsData, setPositionsData] = React.useState(initialState.positionsData);
  const [selPositionId, setSelPositionId] = React.useState(initialState.selPositionId);
  const [collateralTypesData, setCollateralTypesData] = React.useState(initialState.collateralTypesData);
  const [selCollateralTypeId, setSelCollateralTypeId] = React.useState(initialState.selCollateralTypeId);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [modifyPositionFormData, setModifyPositionFormData] = React.useState(initialState.modifyPositionFormData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);

  const encodeCollateralTypeId = (vault: string, tokenId: ethers.BigNumberish) => (`${vault}-${tokenId.toString()}`);
  const decodeCollateralTypeId = (vaultId: string) => {
    const [vault, tokenId] = vaultId.split('-');
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
    return collateralTypes.find(
      // @ts-ignore
      ({properties: { vault: vault_, tokenId: tokenId_ }}) => (
        vault === vault_ && tokenId.toString() === tokenId_.toString()
      )
    );
  }
  const getPositionData = (
    positions: Array<any>, vault: string, tokenId: ethers.BigNumberish, owner: string
  ): undefined | any => {
    return positions.find(
      // @ts-ignore
      ({ vault: vault_, tokenId: tokenId_, owner: owner_ }) => (
        vault === vault_ && tokenId.toString() === tokenId_.toString() && owner === owner_
      )
    );
  }
  const formatUnixTimestamp = (unixTimestamp: ethers.BigNumberish): string => {
    const date = new Date(Number(unixTimestamp.toString()) * 1000);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Reset state if network or account changes
  React.useEffect(() => {
    if (!connector || mounted) return;
    connector.on('change', () => {
      setUserData(initialState.userData);
      setPositionsData(initialState.positionsData);
      setSelPositionId(initialState.selPositionId);
      setCollateralTypesData(initialState.collateralTypesData);
      setSelCollateralTypeId(initialState.selCollateralTypeId);
      setModifyPositionData(initialState.modifyPositionData);
      setModifyPositionFormData(initialState.modifyPositionFormData);
      setTransactionData(initialState.transactionData);
    });
    setMounted(true);
  }, [mounted, connector, initialState]);

  // Fetch User, CollateralType and Vault data
  React.useEffect(() => {
    if (!connector || collateralTypesData.length > 0 || positionsData.length > 0 || userData.fiat != null) return;
    
    (async function () {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const fiat = await FIAT.fromSigner(signer);
      const [collateralTypesData_, userData_] = await Promise.all([
        fiat.fetchCollateralTypesAndPrices(),
        fiat.fetchUserData(user.toLowerCase())
      ]);

      const positionsData_ = userData_.reduce((positions_: any, user: any) => (
        [
          ...positions_,
          ...user.positions.reduce((positions__: any, position: any) => ([...positions__, position]), [])
        ]
      ), []);

      setCollateralTypesData(collateralTypesData_.sort((a: any, b: any) => {
        if (Number(a.properties.maturity) > Number(b.properties.maturity)) return -1;
        if (Number(a.properties.maturity) < Number(b.properties.maturity)) return 1;
        return 0;
      }));
      setPositionsData(positionsData_);
      setUserData({
        fiat,
        explorerUrl: chain?.blockExplorers?.etherscan?.url || '',
        user,
        proxies: userData_.filter((user: any) => (user.isProxy === true)).map((user: any) => user.user)
      });
    })();
  }, [connector, chain, collateralTypesData, positionsData, userData]);

  // Populate ModifyPosition data
  React.useEffect(() => {
    if (
      !connector || (selCollateralTypeId == null && selPositionId == null) || modifyPositionData.vault !== null
    ) return;

    const { vault, tokenId } = decodeCollateralTypeId((selCollateralTypeId || selPositionId as string));
    let data = { ...modifyPositionData, vault: getCollateralTypeData(collateralTypesData, vault, tokenId) };
    if (selPositionId) {
      const { owner } = decodePositionId(selPositionId);
      data = { ...data, position: getPositionData(positionsData, vault, tokenId, owner) };
    }
    setModifyPositionData(data);

    if (userData.proxies.length === 0) return;
    const { proxies: [proxy] } = userData;
    if (data.position && data.position.owner.toLowerCase() !== proxy.toLowerCase()) return;

    (async function () {
      if (data.vault == null) return;
      const { codex, moneta, vaultEPTActions } = userData.fiat.getContracts();
      const underlier = userData.fiat.getERC20Contract(data.vault.properties.underlierToken);
      const [underlierAllowance, monetaDelegate] = await userData.fiat.multicall([
        { contract: underlier, method: 'allowance', args: [proxy, vaultEPTActions.address] },
        { contract: codex, method: 'delegates', args: [proxy, moneta.address] }
      ]);
      setModifyPositionData({ ...modifyPositionData, ...data, underlierAllowance, monetaDelegate });
    })();
  }, [connector, selCollateralTypeId, selPositionId, modifyPositionData, collateralTypesData, positionsData, userData]);

  // Update ModifyPosition form data
  React.useEffect(() => {
    if (
      !connector
      || (selCollateralTypeId == null && selPositionId == null)
      || modifyPositionData.vault == null
      || modifyPositionFormData.outdated === false
    ) return;

    const timeOutId = setTimeout(() => {
      (async function () {
        const { vault } = modifyPositionData as any;
        const { vault: address, tokenScale, protocol } = vault.properties;
        try {
          if (modifyPositionFormData.underlier.isZero()) throw null;
          let tokenAmount = ethers.constants.Zero;
          if (protocol === 'ELEMENT') {
            if (vault.properties.eptData == undefined) throw null;
            const { eptData: { balancerVault, poolId }} = vault.properties;
            tokenAmount = await userData.fiat.call(
              userData.fiat.getContracts().vaultEPTActions,
              'underlierToPToken',
              address,
              balancerVault,
              poolId,
              modifyPositionFormData.underlier
            );
          } else if (protocol === 'NOTIONAL') {
            if (vault.properties.fcData == undefined) throw null;
            tokenAmount = await userData.fiat.call(
              userData.fiat.getContracts().vaultFCActions,
              'underlierToFCash',
              modifyPositionData.vault.properties.tokenId,
              modifyPositionFormData.underlier
            );
          } else if (protocol === 'YIELD') {
            if (vault.properties.fyData == undefined) throw null;
            const { fyData: { yieldSpacePool }} = vault.properties;
            tokenAmount = await userData.fiat.call(
              userData.fiat.getContracts().vaultFYActions,
              'underlierToFYToken',
              modifyPositionFormData.underlier,
              yieldSpacePool
            );
          } else { throw null; }
          const collateral = scaleToWad(tokenAmount, tokenScale)
            .mul(WAD.sub(modifyPositionFormData.slippagePct)).div(WAD);
          const { codex: { virtualRate }, collybus: { liquidationPrice }} = vault.state;
          const maxNormalDebt = userData.fiat.computeMaxNormalDebt(
            collateral, modifyPositionFormData.healthFactor, virtualRate, liquidationPrice
          );
          const debt = userData.fiat.normalDebtToDebt(maxNormalDebt, virtualRate);
          setModifyPositionFormData({
            ...modifyPositionFormData, collateral, debt, outdated: false
          });
        } catch (error) {
          console.log(error);
          setModifyPositionFormData({
            ...modifyPositionFormData, collateral: ethers.constants.Zero, debt: ethers.constants.Zero, outdated: false
          });
        }
      })();
    }, 2000);
    // prevent timeout callback from executing if useEffect was interrupted by a rerender
    return () => clearTimeout(timeOutId)
  }, [connector, userData, selCollateralTypeId, selPositionId, modifyPositionData, modifyPositionFormData]);

  // Transaction methods
  React.useEffect(() => {
    if (
      !connector
      || userData.fiat == null
      || transactionData.action == null
      || transactionData.status === 'sent'
    ) return;

    setTransactionData({ ...transactionData, status: 'sent' });
    const { action } = transactionData;

    (async function () {
      try {
        if (action == 'setupProxy') {
          console.log(await userData.fiat.dryrun(
            userData.fiat.getContracts().proxyRegistry,
            'deployFor',
            userData.user
          ));
        }
        if (action == 'setUnderlierAllowance') {
          console.log(await userData.fiat.dryrun(
            userData.fiat.getERC20Contract(modifyPositionData.vault.properties.underlierToken),
            'approve',
            userData.proxies[0],
            modifyPositionFormData.underlier
          ));
        }
        if (action == 'unsetUnderlierAllowance') {
          console.log(await userData.fiat.dryrun(
            userData.fiat.getERC20Contract(modifyPositionData.vault.properties.underlierToken),
            'approve',
            userData.proxies[0],
            0
          ));
        }
        if (action == 'setMonetaDelegate') {
          console.log(await userData.fiat.dryrun(
            userData.fiat.getContracts().codex,
            'grantDelegate',
            userData.fiat.getContracts().moneta.address
          ));
        }
        if (action == 'unsetMonetaDelegate') {
          console.log(await userData.fiat.dryrun(
            userData.fiat.getContracts().codex,
            'revokeDelegate',
            userData.fiat.getContracts().moneta.address
          ));
        }
        if (action == 'buyCollateralAndModifyDebt') {
          if (
            !modifyPositionData.vault
            || !modifyPositionData.vault.properties.eptData
            || !modifyPositionFormData.underlier
            || !modifyPositionFormData.collateral
          ) throw null;
          console.log(await userData.fiat.dryrun(
            userData.fiat.getContracts().vaultEPTActions,
            'buyCollateralAndModifyDebt',
            modifyPositionData.vault.properties.vault,
            userData.proxies[0],
            userData.user,
            modifyPositionFormData.underlier,
            [
              modifyPositionData.vault.properties.eptData.balancerVault,
              modifyPositionData.vault.properties.eptData.poolId,
              modifyPositionData.vault.properties.underlierToken,
              modifyPositionData.vault.properties.token,
              modifyPositionFormData.collateral,
              Math.round(+new Date() / 1000) + 3600,
              modifyPositionFormData.underlier
            ]
          ));
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) { console.error(error); }
      setTransactionData({ ...transactionData, action: null, status: null });
    })();
  }, [connector, userData, modifyPositionData, modifyPositionFormData, transactionData]);

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
        <Card css={{ mw: "400px" }}>
          <Card.Body>
            <Text b size={18}>Proxy</Text>
            {(userData.proxies.length > 0)
              ? (
                <Link
                  target="_blank"
                  href={`${userData.explorerUrl}/address/${userData.proxies[0]}`}
                  isExternal={true}
                >
                  {userData.proxies[0]}
                </Link>)
              : (userData.user === null) ? (null) : (
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
              setSelPositionId(initialState.selPositionId);
              setSelCollateralTypeId(Object.values(selected)[0]);
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
                collateralTypesData.map((vault) => {
                  const {
                    vault: address,
                    tokenId,
                    tokenSymbol,
                    underlierSymbol,
                    maturity
                    // @ts-ignore
                  } = vault.properties;
                  const {
                    protocol,
                    asset
                    // @ts-ignore
                  } = vault.metadata;
                  const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
                  return (
                    <Table.Row key={encodeCollateralTypeId(address, tokenId)}>
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
              setSelPositionId(Object.values(selected)[0]);
              setSelCollateralTypeId(initialState.selCollateralTypeId);
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
                      name,
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
        closeButton
        blur
        aria-labelledby='modal-title'
        open={(modifyPositionData.vault != null)}
        onClose={() => {
          setSelCollateralTypeId(initialState.selCollateralTypeId);
          setSelPositionId(initialState.selPositionId);
          setModifyPositionData(initialState.modifyPositionData);
          setModifyPositionFormData(initialState.modifyPositionFormData);
        }}
      >
        <Modal.Header>
          <Text id='modal-title' size={18}>
            <Text b size={18}>
              {(selCollateralTypeId) ? 'Create Position' : 'Modify Position'}
            </Text>
            <br/>
            {(modifyPositionData.vault != null) && (() => {
              const { vault: { metadata : { protocol, asset }, properties: { maturity } } } = modifyPositionData;
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
          <Text b size={'m'}>Input</Text>
          <Input
            disabled={transactionData.status === 'sent'}
            value={
              (modifyPositionData.vault === null) ? (0) :
              Math.floor(
                Number(
                  scaleToDec(modifyPositionFormData.underlier, modifyPositionData.vault.properties.underlierScale)
                ) * 100
              ) / 100
            }
            onChange={(event) => {
              if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                setModifyPositionFormData({
                  ...modifyPositionFormData, collateral: ZERO, debt: ZERO, outdated: false
                });  
              } else {
                const num = (Number(event.target.value) < 0) ? 0 : Number(event.target.value);
                const rounded = Math.floor(num * 10000) / 10000
                setModifyPositionFormData({
                  ...modifyPositionFormData,
                  underlier: decToScale(rounded, modifyPositionData.vault.properties.underlierScale),
                  outdated: true
                });
              }
            }}
            placeholder='0'
            type='number'
            label='Underlier to deposit'
            labelRight={(modifyPositionData.vault != null) && modifyPositionData.vault.properties.underlierSymbol}
            bordered
          />
          <Text size={'0.875rem'} style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}>
            Targeted health factor
          </Text>
          <Card variant='bordered' borderWeight='normal'>
            <Card.Body style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}>
              <Slider
                disabled={transactionData.status === 'sent'}
                value={Number(wadToDec(modifyPositionFormData.healthFactor))}
                onChange={(value) => setModifyPositionFormData(
                  { ...modifyPositionFormData, healthFactor: decToWad(String(value)), outdated: true })
                }
                min={1.001}
                max={5.0}
                step={0.001}
                reverse
                getTooltipPopupContainer={(t) => t}
                marks={{
                  5.00: { style: { color: 'grey'}, label: 'Safe' },
                  4.0: { style: { color: 'grey'}, label: '4.0' },
                  3.00: { style: { color: 'grey'}, label: '3.0' },
                  2.00: { style: { color: 'grey'}, label: '2.0' },
                  1.001: { style: { color: 'grey'}, label: 'Unsafe' },
                }}
              />
            </Card.Body>
          </Card>
          <Input
            disabled={transactionData.status === 'sent'}
            value={Math.floor(Number(wadToDec(modifyPositionFormData.slippagePct)) * 100 * 100) / 100}
            onChange={(event) => {
              if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                setModifyPositionFormData({
                  ...modifyPositionFormData, collateral: ZERO, debt: ZERO, outdated: false
                });  
              } else {
                const num = (Number(event.target.value) < 0)
                  ? 0 : (Number(event.target.value) > 50) ? 50 : Number(event.target.value);
                const raw = num / 100;
                const rounded = Math.floor(raw * 10000) / 10000
                setModifyPositionFormData({
                  ...modifyPositionFormData,
                  slippagePct: decToWad(rounded),
                  outdated: true
                });
              }
            }}
            step="0.01"
            placeholder='0'
            type='number'
            label='Accepted slippage'
            labelRight={'%'}
            bordered
          />
          <Spacer y={0.5} />
        </Modal.Body>
        <Spacer y={0.5} />
        <Card.Divider/>
        <Modal.Body>
          <Spacer y={0.5} />
          <Text b size={'m'}>Preview</Text>
          <Input
            readOnly
            value={(modifyPositionFormData.outdated) ? (' ') : (wadToDec(modifyPositionFormData.collateral))}
            placeholder='0'
            type='string'
            label='Collateral (Slippage Adjusted)'
            labelRight={(modifyPositionData.vault != null) && modifyPositionData.vault.metadata.symbol}
            contentLeft={(modifyPositionFormData.outdated) ? (<Loading size='xs'/>) : (null)}
            bordered
          />
          <Input
            readOnly
            value={(modifyPositionFormData.outdated) ? (' ') : (wadToDec(modifyPositionFormData.debt))}
            placeholder='0'
            type='string'
            label='Debt'
            labelRight={'FIAT'}
            contentLeft={(modifyPositionFormData.outdated) ? (<Loading size='xs'/>) : (null)}
            bordered
          />
          <Spacer y={0.5} />
        </Modal.Body>
        <Card.Divider/>
        <Modal.Footer>
          <Text>
            Approve {(modifyPositionData.vault != null) && modifyPositionData.vault.properties.underlierSymbol}
          </Text>
          <Switch
            disabled={
              userData.proxies.length == 0
              || transactionData.status === 'sent'
              || modifyPositionData.underlierAllowance === null
            }
            // @ts-ignore
            checked={() => (
              modifyPositionData.vault != null
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
          <Text>Enable FIAT</Text>
          <Switch
            disabled={
              userData.proxies.length == 0
              || transactionData.status === 'sent'
              || modifyPositionData.monetaDelegate === null
            }
            // @ts-ignore
            checked={() => (modifyPositionData.vault != null) && (!!modifyPositionData.monetaDelegate)}
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
            disabled={(
              userData.proxies.length == 0
              || modifyPositionFormData.underlier.isZero()
              || modifyPositionFormData.collateral.isZero()
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
