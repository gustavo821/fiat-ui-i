import React from 'react';
import { Badge, Col, Row, SortDescriptor, Table, Text, User } from '@nextui-org/react';
import { WAD, wadToDec } from '@fiatdao/sdk';

import {
  encodePositionId, floor2, formatUnixTimestamp, getCollateralTypeData,
  interestPerSecondToAPY, interestPerSecondToRateUntilMaturity
} from '../utils';

interface PositionsTableProps {
  contextData: any,
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
      <Text h2>Positions</Text>
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
          <Table.Column>Borrow Rate (Due At Maturity)</Table.Column>
          <Table.Column>Collateral (Fair Value)</Table.Column>
          <Table.Column>Debt (Implied Value)</Table.Column>
          <Table.Column>Health Factor (At Maturity)</Table.Column>
          <Table.Column allowsSorting>Maturity (Days Until Maturity)</Table.Column>
        </Table.Header>
        <Table.Body>
          {
            sortedData.map((position) => {
              const { owner, vault, tokenId, collateral, normalDebt } = position;
              const {
                properties: { underlierSymbol, maturity },
                metadata: { protocol, asset, icons, urls, symbol },
                state: {
                  publican: { interestPerSecond }, codex: { virtualRate }, collybus: { fairPrice, liquidationPrice }
                }
              } = getCollateralTypeData(props.collateralTypesData, vault, tokenId);
              const borrowRate = interestPerSecondToRateUntilMaturity(interestPerSecond, maturity);
              const borrowRateAnnualized = interestPerSecondToAPY(interestPerSecond);
              const debt = normalDebt.mul(virtualRate).div(WAD);
              const dueAtMaturity = normalDebt.mul(borrowRate).div(WAD);
              const healthFactor = props.contextData.fiat.computeHealthFactor(collateral, normalDebt, virtualRate, liquidationPrice);
              const healthFactorAtMaturity = props.contextData.fiat.computeHealthFactor(collateral, normalDebt.add(dueAtMaturity), WAD, liquidationPrice);
              const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
              const daysUntilMaturity = Math.max(Math.floor((Number(maturity.toString()) - Math.floor(Date.now() / 1000)) / 86400), 0);
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
                  <User name={underlierSymbol} src={icons.underlier} size='sm' css={{
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
                      }
                    }}/>
                  </Table.Cell>
                  <Table.Cell>
                    <Row>{`${floor2(wadToDec(borrowRateAnnualized.mul(100)))}%`}</Row>
                    <Row>{`(${floor2(wadToDec(borrowRate.mul(100)))}% ≅ ${floor2(wadToDec(dueAtMaturity))} FIAT)`}</Row>
                  </Table.Cell>
                  <Table.Cell>
                    <Col>
                      <Row>{`${floor2(wadToDec(collateral)).toLocaleString()} ${symbol}`}</Row>
                      <Row>{`($${floor2(wadToDec(fairPrice.mul(collateral).div(WAD))).toLocaleString()})`}</Row>
                    </Col>
                  </Table.Cell>
                  <Table.Cell>
                    <Row>{floor2(wadToDec(debt)).toLocaleString()} FIAT</Row>
                    <Row>(${floor2(wadToDec(debt)).toLocaleString()})</Row>
                  </Table.Cell>
                  <Table.Cell>{`${floor2(wadToDec(healthFactor))} (${floor2(wadToDec(healthFactorAtMaturity))})`}</Table.Cell>
                  <Table.Cell>
                    <Badge isSquared color={new Date() < maturityFormatted ? 'success' : 'error'} variant='flat' >
                      {formatUnixTimestamp(maturity)}, ({daysUntilMaturity} days)
                    </Badge>
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
