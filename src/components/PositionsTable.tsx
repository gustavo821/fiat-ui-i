import React from 'react';
import { Col, Row, SortDescriptor, styled, Table, Text, User } from '@nextui-org/react';

import { WAD, wadToDec } from '@fiatdao/sdk';

import { encodePositionId, getCollateralTypeData } from '../utils';
import { formatUnixTimestamp } from '../utils';

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
        color: '$successLightContrast',
      },
      red: {
        bg: '$errorLight',
        color: '$errorLightContrast',
      },
      orange: {
        bg: '$warningLight',
        color: '$warningLightContrast',
      },
    },
  },
  defaultVariants: {
    type: 'active',
  },
});

interface PositionsTableProps {
  collateralTypesData: Array<any>,
  positionsData: Array<any>,
  onSelectPosition: (positionId: string) => void
}

export const PositionsTable = (props: PositionsTableProps) => {
  const [sortedData, setSortedData] = React.useState<any[]>([]);
  const [sortProps, setSortProps] = React.useState<SortDescriptor>({
    column: 'Maturity',
    direction: 'descending'
  });

  React.useEffect(() => {
    const data = [...props.positionsData]
    data.sort((a: any, b: any) : number => {
      if (!props.collateralTypesData || !a || !b) return 0;
      const { vault: vaultA, tokenId: tokenIdA } = a;
      const { vault: vaultB, tokenId: tokenIdB } = b;
      const dataA = getCollateralTypeData(props.collateralTypesData, vaultA, tokenIdA);
      const dataB = getCollateralTypeData(props.collateralTypesData, vaultB, tokenIdB);
      if (!dataA || !dataB) return 0;
      if (sortProps.direction === 'descending' ) {
        return dataA.properties.maturity.toNumber() < dataB.properties.maturity.toNumber() ? 1 : -1
      }
      return dataA.properties.maturity.toNumber() > dataB.properties.maturity.toNumber() ? 1 : -1
    });
    setSortedData(data);
  }, [props.collateralTypesData, props.positionsData, sortProps.direction])

  if (props.positionsData === null || props.positionsData.length === 0 || props.collateralTypesData.length === 0) {
    // TODO
    // return <Loading />;
    return null;
  }

  return (
    <>
      <Text h1>Positions</Text>
      <Table
        aria-label='Positions'
        css={{ height: 'auto', minWidth: '100%' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) =>
          props.onSelectPosition(Object.values(selected)[0])
        }
        sortDescriptor={sortProps as SortDescriptor}
        onSortChange={(data) => {
          setSortProps({
            direction: data.direction,
            column: data.column
          })
        }}
      >
        <Table.Header>
          <Table.Column>Asset</Table.Column>
          <Table.Column>Underlier</Table.Column>
          <Table.Column>Collateral</Table.Column>
          <Table.Column>Debt</Table.Column>
          <Table.Column allowsSorting>Maturity</Table.Column>
        </Table.Header>
        <Table.Body>
          {
            sortedData.map((position) => {
              const { owner, vault, tokenId, collateral, normalDebt } = position;
              const {
                properties: { underlierSymbol, maturity },
                metadata: { protocol, asset, icons, urls },
                state
              } = getCollateralTypeData(props.collateralTypesData, vault, tokenId);
              const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
              const debt = normalDebt.mul(state.codex.virtualRate).div(WAD)
              return (
                <Table.Row key={encodePositionId(vault, tokenId, owner)}>
                  <Table.Cell>
                    <User src={icons.asset} name={asset} css={{
                      borderRadius: '0px',
                      '& span': {
                        '& .nextui-avatar-bg': {
                          background: 'transparent !important'
                        },
                        borderRadius: '0px !important',
                        '& img': {
                          borderRadius: '0px !important',
                          background: 'transparent !important',
                        }
                      },
                    }}>
                      <User.Link href={urls.asset}>{protocol}</User.Link>
                    </User>
                  </Table.Cell>
                  <Table.Cell>
                    <User name={underlierSymbol} src={icons.underlier} size='sm'/>
                  </Table.Cell>
                  <Table.Cell>
                    <Col>
                      <Row>
                        {wadToDec(collateral)}
                      </Row>
                      <Row>
                        {`$${parseFloat(wadToDec(state.collybus.fairPrice.mul(collateral).div(WAD))).toFixed(2)}`}
                      </Row>
                    </Col>
                  </Table.Cell>
                  <Table.Cell>{wadToDec(debt)}</Table.Cell>
                  <Table.Cell>
                    <StyledBadge
                      type={new Date() < maturityFormatted ? 'green' : 'red'}
                    >
                      {formatUnixTimestamp(maturity)}
                    </StyledBadge>
                  </Table.Cell>
                </Table.Row>
              );
            })
          }
        </Table.Body>
      </Table>
    </>
  );
};
