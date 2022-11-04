import React from 'react';
import { Text, Table, styled, Loading } from '@nextui-org/react';

import { formatUnixTimestamp, encodeCollateralTypeId } from './utils';

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
  if (props.collateralTypesData.length === 0) {
    // TODO
    // return <Loading />;
    return null;
  }

  return (
    <>
      <Text h1>Collateral Types</Text>
      <Table
        aria-label='Collateral Types'
        css={{ height: 'auto', minWidth: '100%' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) => props.onSelectCollateralType(Object.values(selected)[0])}
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
            props.collateralTypesData.map((collateralType: any) => {
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
    </>
  );
};
