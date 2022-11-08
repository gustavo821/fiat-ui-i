import React from 'react';
import { Col, Row, styled, Table, Text, User } from '@nextui-org/react';

import { WAD, wadToDec } from '@fiatdao/sdk';

import { encodePositionId, getCollateralTypeData } from '../utils';
import Skeleton from 'react-loading-skeleton';
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
  collateralTypesData: Array<any>;
  positionsData: Array<any>;
  onSelectPosition: (positionId: string) => void;
}

export const PositionsTable = (props: PositionsTableProps) => {
  const colNames = React.useMemo(() => {
    return ['Protocol', 'Token', 'Collateral', 'Normal Debt', 'Maturity'];
  }, []);

  const cells = React.useMemo(() => {
    return props.collateralTypesData.length === 0 ? (
      <Table.Row>
        {colNames.map((colName) => (
          <Table.Cell key={colName}>
            <Skeleton count={colNames.length} />
          </Table.Cell>
        ))}
      </Table.Row>
    ) : (
      props.positionsData.map((position) => {
        const { owner, vault, tokenId, collateral, normalDebt } = position;
        const {
          properties: { tokenSymbol, maturity },
          metadata: { protocol, asset, icons, urls },
          state
        } = getCollateralTypeData(props.collateralTypesData, vault, tokenId);
        const maturityFormatted = new Date(Number(maturity.toString()) * 1000);
        return (
          <Table.Row key={encodePositionId(vault, tokenId, owner)}>
            <Table.Cell>
              <User src={icons.protocol} name={protocol}>
                <User.Link href={urls.project}>Visit</User.Link>
              </User>
            </Table.Cell>
            <Table.Cell>
              <User src={icons.asset} name={asset}>
                <User.Link href={urls.asset}>{tokenSymbol}</User.Link>
              </User>
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
            <Table.Cell>{wadToDec(normalDebt)}</Table.Cell>
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
    );
  }, [props.collateralTypesData, props.positionsData, colNames]);

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
