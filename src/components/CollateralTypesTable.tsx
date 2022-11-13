import React from 'react';
import { Badge, SortDescriptor, styled, Table, Text, User } from '@nextui-org/react';
import { wadToDec, ZERO } from '@fiatdao/sdk';
import {
  earnableRateToAPY, encodeCollateralTypeId, floor2, formatUnixTimestamp,
  interestPerSecondToAPY, interestPerSecondToRateUntilMaturity
} from '../utils';

interface CollateralTypesTableProps {
  collateralTypesData: Array<any>,
  onSelectCollateralType: (collateralTypeId: string) => void
}

export const CollateralTypesTable = (props: CollateralTypesTableProps) => {
  const [sortedData, setSortedData] = React.useState<any[]>([]);
  const [sortProps, setSortProps] = React.useState<SortDescriptor>({ column: 'Maturity', direction: 'descending' });
  
  React.useEffect(() => {
    const data = [...props.collateralTypesData]
    data.sort((a: any, b: any) : number => {
      if (sortProps.direction === 'descending' ) {
        return a.properties.maturity.toNumber() < b.properties.maturity.toNumber() ? 1 : -1
      }
      return a.properties.maturity.toNumber() > b.properties.maturity.toNumber() ? 1 : -1
    });
    console.log({data})
    setSortedData(data);
  }, [props.collateralTypesData, sortProps.direction])

  if (props.collateralTypesData.length === 0) return null;

  return (
    <>
      <Text h1>Create Position</Text>
      <Table
        aria-label='Collateral Types'
        css={{ height: 'auto', minWidth: '100%' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) => props.onSelectCollateralType(Object.values(selected)[0])}
        sortDescriptor={sortProps as SortDescriptor}
        onSortChange={(data) => { setSortProps({ direction: data.direction, column: data.column })}}
      >
        <Table.Header>
          <Table.Column>Asset</Table.Column>
          <Table.Column>Underlier</Table.Column>
          <Table.Column>APY (PNL At Maturty)</Table.Column>
          <Table.Column>Borrow Rate (Due At Maturity)</Table.Column>
          <Table.Column>Total Assets</Table.Column>
          <Table.Column allowsSorting>Maturity (Days Until Maturity)</Table.Column>
        </Table.Header>
        <Table.Body>
          {
            sortedData.map((collateralType: any) => {
              const { vault, tokenId, underlierSymbol, maturity } = collateralType.properties;
              const { protocol, asset, icons, urls, symbol } = collateralType.metadata;
              const { publican: { interestPerSecond }, codex: { depositedCollateral } } = collateralType.state;
              const earnableRate = collateralType?.earnableRate || ZERO;
              const earnableRateAnnulized = earnableRateToAPY(earnableRate, maturity);
              const borrowRate = interestPerSecondToRateUntilMaturity(interestPerSecond, maturity);
              const borrowRateAnnualized = interestPerSecondToAPY(interestPerSecond);
              const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
              const daysUntilMaturity = Math.max(Math.floor((Number(maturity.toString()) - Math.floor(Date.now() / 1000)) / 86400), 0);
              return (
                <Table.Row key={encodeCollateralTypeId(vault, tokenId)}>
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
                  <Table.Cell><User name={underlierSymbol} src={icons.underlier} size='sm'/></Table.Cell>
                  <Table.Cell>{`${floor2(wadToDec(earnableRateAnnulized.mul(100)))}% (${floor2(wadToDec(earnableRate.mul(100)))}%)`}</Table.Cell>
                  <Table.Cell>{`${floor2(wadToDec(borrowRateAnnualized))}% (${floor2(wadToDec(borrowRate))}%)`}</Table.Cell>
                  <Table.Cell>{`${floor2(wadToDec(depositedCollateral))} ${symbol}`}</Table.Cell>
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
