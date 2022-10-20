import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Container, Text, Table, Spacer, Button, Modal, Input, Loading,Card } from '@nextui-org/react';
import { Slider } from 'antd';
import 'antd/dist/antd.css';

// @ts-ignore
import { FIAT } from '@fiatdao/sdk/lib/index';

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
  const { isConnected, connector } = useAccount();

  const [mounted, setMounted] = React.useState(false);
  const [positionsData, setPositionsData] = React.useState([]);
  const [selPositionId, setSelPositionId] = React.useState(null);
  const [collateralTypesData, setCollateralTypesData] = React.useState([]);
  const [selCollateralTypeId, setSelCollateralTypeId] = React.useState(null);
  const [modifyPositionData, setModifyPositionData] = React.useState({});
  const [modifyPositionFormData, setModifyPositionFormData] = React.useState({
    outdated: false,
    underlier: 0,
    healthFactor: 1.2,
    collateral: 0,
    debt: 0
  });


  const encodeCollateralTypeId = (vault: string, tokenId: string) => (`${vault}-${tokenId.toString()}`);
  const decodeCollateralTypeId = (vaultId: string) => {
    const [vault, tokenId] = vaultId.split('-');
    return { vault, tokenId };
  }
  const encodePositionId = (vault: string, tokenId: string, owner: string) => (
    `${vault}-${tokenId.toString()}-${owner}`
  );
  const decodePositionId = (positionId: string) => {
    const [vault, tokenId, owner] = positionId.split('-');
    return { vault, tokenId, owner };
  }
  const getCollateralTypeData = (collateralTypes: any, vault: string, tokenId: string): {} | undefined => {
    return collateralTypes.find(
      // @ts-ignore
      ({properties: { vault: vault_, tokenId: tokenId_ }}) => (
        vault === vault_ && tokenId.toString() === tokenId_.toString()
      )
    );
  }
  const getPositionData = (positions: any, vault: string, tokenId: string, owner: string): {} | undefined => {
    return positions.find(
      // @ts-ignore
      ({ vault: vault_, tokenId: tokenId_, owner: owner_ }) => (
        vault === vault_ && tokenId.toString() === tokenId_.toString() && owner === owner_
      )
    );
  }

  const formatUnixTimestamp = (unixTimestamp: string): string => {
    const date = new Date(Number(unixTimestamp.toString()) * 1000);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Reset state if network or account changes
  React.useEffect(() => {
    if (!connector || mounted) return;
    connector.on('change', () => {
      setCollateralTypesData([]);
      setSelCollateralTypeId(null);
      setPositionsData([]);
      setSelPositionId(null);
      setModifyPositionData({});
    });
    setMounted(true);
  }, [mounted, connector]);

  // Fetch CollateralType and Vault data
  React.useEffect(() => {
    if (!connector || collateralTypesData.length !== 0 || positionsData.length !== 0) return;
    (async function () {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const fiat = await FIAT.fromSigner(signer);
      const collateralTypesData = await fiat.fetchCollateralTypesAndPrices();
      const positionsData = await fiat.fetchPositions(await signer.getAddress())
      setCollateralTypesData(collateralTypesData);
      setPositionsData(positionsData);
    })();
  }, [connector, collateralTypesData, positionsData]);

  // Populate ModifyPosition data
  React.useEffect(() => {
    if (
      !connector
      || (selCollateralTypeId == undefined && selPositionId == undefined)
      || Object.keys(modifyPositionData).length != 0
    ) return;

    // @ts-ignore
    const { vault, tokenId } = decodeCollateralTypeId(selCollateralTypeId || selPositionId);
    let data: { vault: {} | undefined, position: {} | undefined} = {
      vault: getCollateralTypeData(collateralTypesData, vault, tokenId), position: undefined
    };
    if (selPositionId) {
      const { owner } = decodePositionId(selPositionId);
      data = { ...data, position: getPositionData(positionsData, vault, tokenId, owner) };
    }
    console.log(data);
    setModifyPositionData(data);
  }, [connector, selCollateralTypeId, selPositionId, modifyPositionData, collateralTypesData, positionsData]);

  // Update ModifyPosition form data
  React.useEffect(() => {
    if (
      !connector
      || (selCollateralTypeId == undefined && selPositionId == undefined)
      || Object.keys(modifyPositionData).length == 0
      || modifyPositionFormData.outdated === false
    ) return;

    const timeOutId = setTimeout(() => {
      (async function () {
        const signer = (await connector.getSigner());
        if (!signer || !signer.provider) return;
        const fiat = await FIAT.fromSigner(signer);
        const { vault } = modifyPositionData as any;
        if (vault?.properties?.protocol === 'ELEMENT') {
          if (vault?.properties?.eptData == undefined) return;
          if (modifyPositionFormData.underlier === 0) return;
          const { vault: address, tokenScale, underlierScale, eptData: { balancerVault, poolId }} = vault.properties;
          const pTokenAmount = await fiat.call(
            fiat.getContracts().vaultEPTActions,
            'underlierToPToken',
            address,
            balancerVault,
            poolId,
            ethers.BigNumber.from(modifyPositionFormData.underlier).mul(underlierScale)
          );
          const collateral = fiat.scaleToWad(pTokenAmount, tokenScale);
          const { codex: { virtualRate }, collybus: { liquidationPrice }} = vault.state;
          const maxNormalDebt = fiat.computeMaxNormalDebt(
            collateral, fiat.decToWad(modifyPositionFormData.healthFactor.toString()), virtualRate, liquidationPrice
          );
          const debt = fiat.normalDebtToDebt(maxNormalDebt, virtualRate);
          console.log(collateral.toString(), debt.toString());
          setModifyPositionFormData({
            ...modifyPositionFormData, collateral, debt, outdated: false
          });
        } else if (vault?.properties?.protocol === 'NOTIONAL') {
        } else if (vault?.properties?.protocol === 'YIELD') {}
    })();
    }, 2000);
    // restart timer via useEffect cleanup callback
    return () => clearTimeout(timeOutId);
  }, [connector, modifyPositionFormData, modifyPositionData, selCollateralTypeId, selPositionId]);

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

      <Spacer y={1} />

      <Container>
        <Text h1>Collateral Types</Text>
        {mounted && isConnected && collateralTypesData.length != 0 && (
          <Table
            aria-label='CollateralTypes'
            css={{
              height: 'auto',
              minWidth: '100%',
            }}
            selectionMode='single'
            selectedKeys={'1'}
            onSelectionChange={(selected) => {
              setSelPositionId(null);
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
        {mounted && isConnected && positionsData.length != 0 && (
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
              setSelCollateralTypeId(null);
            }}
          >
            <Table.Header>
              <Table.Column>Protocol</Table.Column>
              <Table.Column>Token</Table.Column>
              <Table.Column>TokenId</Table.Column>
              <Table.Column>Owner</Table.Column>
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
                      <Table.Cell>{owner}</Table.Cell>
                      <Table.Cell>{ethers.utils.formatEther(collateral)}</Table.Cell>
                      <Table.Cell>{ethers.utils.formatEther(normalDebt)}</Table.Cell>
                    </Table.Row>
                  );
                })
              }
            </Table.Body>
          </Table>
        )}
      </Container>

      <Modal
        closeButton
        blur
        aria-labelledby="modal-title"
        open={(Object.keys(modifyPositionData).length != 0)}
        onClose={() => {
          setSelCollateralTypeId(null);
          setSelPositionId(null);
          setModifyPositionData({});
        }}
      >
        <Modal.Header>
          <Text id="modal-title" size={18}>
            <Text b size={18}>
              {(selCollateralTypeId) ? 'Create Position' : 'Modify Position'}
            </Text>
            <br/>
            {(Object.keys(modifyPositionData).length != 0) && (() => {
              if (Object.keys(modifyPositionData).length == 0) return null;
              const { vault: { metadata : { protocol, asset }, properties: { maturity } } } = modifyPositionData as any;
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
          <Input
            value={modifyPositionFormData.underlier}
            onChange={(event) => setModifyPositionFormData(
              { ...modifyPositionFormData, underlier: Number(event.target.value), outdated: true })
            }
            placeholder="0"
            type="number"
            label="Underlier to deposit"
            labelRight={(Object.keys(modifyPositionData).length != 0) && modifyPositionData.vault.properties.underlierSymbol}
            bordered
          />
          <Text size={'0.875rem'} style={{ paddingLeft: '0.25rem'}}>Health Factor</Text>
          <Slider
            value={modifyPositionFormData.healthFactor}
            onChange={(value) => setModifyPositionFormData(
              { ...modifyPositionFormData, healthFactor: value, outdated: true })
            }
            min={1.001}
            max={10.0}
            step={0.001}
            reverse
            getTooltipPopupContainer={(t) => t}
            marks={{
              10.00: { style: { color: 'white'}, label: '10' },
              9.00: { style: { color: 'white'}, label: '9' },
              8.00: { style: { color: 'white'}, label: '8' },
              7.00: { style: { color: 'white'}, label: '7' },
              6.00: { style: { color: 'white'}, label: '6' },
              5.00: { style: { color: 'white'}, label: '5' },
              4.00: { style: { color: 'white'}, label: '4' },
              3.00: { style: { color: 'white'}, label: '3' },
              2.00: { style: { color: 'white'}, label: '2' },
              1.001: { style: { color: 'white'}, label: '1.001' },
            }}
            style={{ padding: 0, height: 16 }}
          />
          <br/>
          <Card.Divider/>
          <br/>
          {(modifyPositionFormData.outdated) ? (<Loading size='xs'/>) : (
            <>
              <Text size={14}>Position Preview</Text>
              <Input
                readOnly
                value={ethers.utils.formatUnits(modifyPositionFormData.collateral, '18')}
                placeholder="0"
                type="number"
                label="Collateral"
                labelRight={(Object.keys(modifyPositionData).length != 0) && modifyPositionData.vault.properties.tokenSymbol}
                bordered
              />
              <Input
                readOnly
                value={ethers.utils.formatUnits(modifyPositionFormData.debt, '18')}
                placeholder="0"
                type="number"
                label="Debt"
                labelRight={'FIAT'}
                bordered
              />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          Modal
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Home;
