import { styled, Table, Text, User } from '@nextui-org/react';
import React from 'react';

import Skeleton from 'react-loading-skeleton';
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

interface CollateralTypesTableProps {
  collateralTypesData: Array<any>;
  onSelectCollateralType: (collateralTypeId: string) => void;
}

export const CollateralTypesTable = (props: CollateralTypesTableProps) => {
  const colNames = React.useMemo(() => {
    return ['Protocol', 'Token', 'Underlier', 'Maturity', 'TVL'];
  }, []);

  const cells = React.useMemo(() => {
    return props.collateralTypesData.length === 0 ? (
      <Table.Row>
        {colNames.map((colName) => (
          <Table.Cell key={colName}><Skeleton count={colNames.length}/></Table.Cell>
        ))}
      </Table.Row>
    ) : (
      props.collateralTypesData.map((collateralType: any) => {
        const { vault, tokenId, underlierSymbol, maturity } =
          collateralType.properties;
        const { protocol, asset, icons, urls, symbol } = collateralType.metadata;
        const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
        return (
          <Table.Row key={encodeCollateralTypeId(vault, tokenId)}>
            <Table.Cell>
              <User src={icons.protocol} name={protocol}>
                <User.Link href={urls.project}>Visit</User.Link>
              </User>
            </Table.Cell>
            <Table.Cell>
              <User src={icons.asset} name={asset}>
                <User.Link href={urls.asset}>{symbol}</User.Link>
              </User>
            </Table.Cell>
            <Table.Cell>
              <User name={underlierSymbol} src={icons.underlier} size='sm'/>
            </Table.Cell>
            <Table.Cell>
              <StyledBadge
                type={new Date() < maturityFormatted ? 'green' : 'red'}
              >
                {formatUnixTimestamp(maturity)}
              </StyledBadge>
            </Table.Cell>
            <Table.Cell>0</Table.Cell>
          </Table.Row>
        );
      })
    );
  }, [props.collateralTypesData, colNames]);

  return (
    <>
      <Text h1>Collateral Types</Text>
      <Table
        aria-label='Collateral Types'
        css={{ height: 'auto', minWidth: '100%' }}
        selectionMode='single'
        selectedKeys={'1'}
        onSelectionChange={(selected) =>
          props.onSelectCollateralType(Object.values(selected)[0])
        }
      >
        <Table.Header>
          {colNames.map((colName) => (
            <Table.Column key={colName}>{colName}</Table.Column>
          ))}
        </Table.Header>
        <Table.Body>{cells}</Table.Body>
      </Table>
    </>
  );
};
