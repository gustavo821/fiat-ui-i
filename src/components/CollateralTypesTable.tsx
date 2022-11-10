import { SortDescriptor, styled, Table, Text, User } from '@nextui-org/react';
import React from 'react';
import { wadToDec, ZERO } from '@fiatdao/sdk';
import { encodeCollateralTypeId, formatUnixTimestamp } from '../utils';

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

interface CollateralTypesTableProps {
  collateralTypesData: Array<any>,
  onSelectCollateralType: (collateralTypeId: string) => void
}

export const CollateralTypesTable = (props: CollateralTypesTableProps) => {
  const [sortedData, setSortedData] = React.useState<any[]>([]);
  const [sortProps, setSortProps] = React.useState<SortDescriptor>({
    column: 'Maturity',
    direction: 'descending'
  });
  
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


  if (props.collateralTypesData.length === 0) {
    // TODO
    // return <Loading />;
    return null;
  }

  return (
    <>
      <Text h1>Create Position</Text>
      <Table
        aria-label='Collateral Types'
        css={{ height: 'auto', minWidth: '100%' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) =>
          props.onSelectCollateralType(Object.values(selected)[0])
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
          <Table.Column>Total Assets</Table.Column>
          <Table.Column>% Gain</Table.Column>
          <Table.Column allowsSorting>Maturity</Table.Column>
        </Table.Header>
        <Table.Body>
          {
            sortedData.map((collateralType: any) => {
              const { vault, tokenId, underlierSymbol, maturity } = collateralType.properties;
              const { protocol, asset, icons, urls, symbol } = collateralType.metadata;
              const depositedCollateral = collateralType.state.codex.depositedCollateral;
              const earnableRate = collateralType?.earnableRate?.mul(100);
              const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
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
                  <Table.Cell>
                    <User name={underlierSymbol} src={icons.underlier} size='sm'/>
                  </Table.Cell>
                  <Table.Cell>{`${parseFloat(wadToDec(depositedCollateral)).toFixed(2)} ${symbol}`}</Table.Cell>
                  <Table.Cell>
                    {`${parseFloat(wadToDec(earnableRate ?? ZERO)).toFixed(2)}%`}
                  </Table.Cell>
                  <Table.Cell>
                    <StyledBadge type={new Date() < maturityFormatted ? 'green' : 'red'} >
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
