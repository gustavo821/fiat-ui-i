import React from 'react';
import {
  Button,
  Card,
  Grid,
  Input,
  Loading,
  Modal,
  Navbar,
  Spacer,
  Switch,
  Text,
} from '@nextui-org/react';
import { ethers } from 'ethers';
import { decToScale, decToWad, scaleToDec, wadToDec } from '@fiatdao/sdk';

import { commifyToDecimalPlaces, floor2, floor4, formatUnixTimestamp } from '../utils';
import { TransactionStatus } from '../../pages';

interface ModifyPositionModalProps {
  buyCollateralAndModifyDebt: () => any;
  contextData: any;
  disableActions: boolean;
  modifyPositionData: any;
  modifyPositionFormData: any;
  redeemCollateralAndModifyDebt: () => any;
  sellCollateralAndModifyDebt: () => any;
  setTransactionStatus: (status: TransactionStatus) => void;
  setMonetaDelegate: (fiat: any) => any;
  setUnderlierAllowance: (fiat: any) => any;
  transactionData: any;
  unsetMonetaDelegate: (fiat: any) => any;
  unsetUnderlierAllowance: (fiat: any) => any;
  onUpdateDeltaCollateral: (deltaCollateral: null | ethers.BigNumber) => void;
  onUpdateDeltaDebt: (deltaDebt: null | ethers.BigNumber) => void;
  onUpdateUnderlier: (underlier: null | ethers.BigNumber) => void;
  onUpdateSlippage: (slippagePct: null | ethers.BigNumber) => void;
  onUpdateMode: (mode: string) => void;
  onSendTransaction: (action: string) => void;
  open: boolean;
  onClose: () => void;
}

export const ModifyPositionModal = (props: ModifyPositionModalProps) => {
  return (
    <Modal
      preventClose
      closeButton={!props.disableActions}
      blur
      open={props.open}
      onClose={() => props.onClose()}
    >
      <ModifyPositionModalBody {...props} />
    </Modal>
  );
};

const ModifyPositionModalBody = (props: ModifyPositionModalProps) => {
  if (!props.contextData.user || !props.modifyPositionData.collateralType || !props.modifyPositionData.collateralType.metadata ) {
    // TODO
    // return <Loading />;
    return null;
  }

  const { proxies } = props.contextData;
  const {
    collateralType: {
      metadata: { symbol: symbol, protocol, asset },
      properties: { underlierScale, underlierSymbol, maturity },
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
    fiatAllowance,
  } = props.modifyPositionData;

  const {
    mode,
    outdated,
    underlier,
    slippagePct,
    deltaCollateral,
    deltaDebt,
    collateral,
    debt,
    healthFactor,
  } = props.modifyPositionFormData;
  const { action: currentTxAction } = props.transactionData;

  const hasProxy = proxies.length > 0;
  const matured = !(new Date() < new Date(Number(maturity.toString()) * 1000));

  return (
    <>
      <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>
            Modify Position
          </Text>
          <br />
          <Text b size={16}>{`${protocol} - ${asset}`}</Text>
          <br />
          <Text b size={14}>{`${formatUnixTimestamp(maturity)}`}</Text>
        </Text>
      </Modal.Header>
      <Modal.Body>
        <Navbar
          variant='static'
          isCompact
          disableShadow
          disableBlur
          containerCss={{ justifyContent: 'center', background: 'transparent' }}
        >
          <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
            {!matured && (
              <>
                <Navbar.Link
                  isActive={mode === 'deposit'}
                  onClick={() => props.onUpdateMode('deposit')}
                >
                  Increase
                </Navbar.Link>
                <Navbar.Link
                  isActive={mode === 'withdraw'}
                  onClick={() => props.onUpdateMode('withdraw')}
                >
                  Decrease
                </Navbar.Link>
              </>
            )}
            {matured && (
              <Navbar.Link
                isDisabled={!matured}
                isActive={mode === 'redeem'}
                onClick={() => props.onUpdateMode('redeem')}
              >
                Redeem
              </Navbar.Link>
            )}
          </Navbar.Content>
        </Navbar>
        <Text b size={'m'}>
          Inputs
        </Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Wallet: {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)} {underlierSymbol}
          </Text>
        )}
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            {mode === 'deposit' && (
              <Input
                disabled={props.disableActions}
                value={floor2(scaleToDec(underlier, underlierScale))}
                onChange={(event) => {
                  if (
                    event.target.value === null ||
                    event.target.value === undefined ||
                    event.target.value === ''
                  ) {
                    props.onUpdateUnderlier(null);
                  } else {
                    props.onUpdateUnderlier(
                      decToScale(
                        floor4(
                          Number(event.target.value) < 0
                            ? 0
                            : Number(event.target.value)
                        ),
                        underlierScale
                      )
                    );
                  }
                }}
                placeholder='0'
                type='number'
                label='Underlier to swap'
                labelRight={underlierSymbol}
                bordered
                size='sm'
                borderWeight='light'
              />
            )}
            {(mode === 'withdraw' || mode === 'redeem') && (
              <Input
                disabled={props.disableActions}
                value={floor2(wadToDec(deltaCollateral))}
                onChange={(event) => {
                  if (
                    event.target.value === null ||
                    event.target.value === undefined ||
                    event.target.value === ''
                  ) {
                    props.onUpdateDeltaCollateral(null);
                  } else {
                    props.onUpdateDeltaCollateral(
                      decToWad(
                        floor4(
                          Number(event.target.value) < 0
                            ? 0
                            : Number(event.target.value)
                        )
                      )
                    );
                  }
                }}
                placeholder='0'
                type='number'
                label={
                  mode === 'withdraw'
                    ? 'Collateral to withdraw and swap'
                    : 'Collateral to withdraw and redeem'
                }
                labelRight={symbol}
                bordered
                size='sm'
                borderWeight='light'
                width='13.35rem'
              />
            )}
          </Grid>
          <Grid>
            {(mode === 'deposit' || mode === 'withdraw') && (
              <Input
                disabled={props.disableActions}
                value={floor2(Number(wadToDec(slippagePct)) * 100)}
                onChange={(event) => {
                  if (
                    event.target.value === null ||
                    event.target.value === undefined ||
                    event.target.value === ''
                  ) {
                    props.onUpdateSlippage(null);
                  } else {
                    const ceiled =
                      Number(event.target.value) < 0
                        ? 0
                        : Number(event.target.value) > 50
                        ? 50
                        : Number(event.target.value);
                    props.onUpdateSlippage(decToWad(floor4(ceiled / 100)));
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
            )}
          </Grid>
        </Grid.Container>
        <Input
          disabled={props.disableActions}
          value={floor2(wadToDec(deltaDebt))}
          onChange={(event) => {
            if (
              event.target.value === null ||
              event.target.value === undefined ||
              event.target.value === ''
            ) {
              props.onUpdateDeltaDebt(null);
            } else {
              props.onUpdateDeltaDebt(
                decToWad(
                  floor4(
                    Number(event.target.value) < 0
                      ? 0
                      : Number(event.target.value)
                  )
                )
              );
            }
          }}
          placeholder='0'
          type='number'
          label={mode === 'deposit' ? 'FIAT to borrow' : 'FIAT to pay back'}
          labelRight={'FIAT'}
          bordered
          size='sm'
          borderWeight='light'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      {(mode === 'deposit' || mode === 'withdraw') && (
        <>
          <Modal.Body>
            <Spacer y={0} />
            <Text b size={'m'}>
              Swap Preview
            </Text>
            <Input
              readOnly
              value={
                outdated
                  ? ' '
                  : mode === 'deposit'
                  ? floor4(wadToDec(deltaCollateral))
                  : floor4(scaleToDec(underlier, underlierScale))
              }
              placeholder='0'
              type='string'
              label={
                mode === 'deposit'
                  ? 'Collateral to deposit (incl. slippage)'
                  : 'Underliers to withdraw (incl. slippage)'
              }
              labelRight={mode === 'deposit' ? symbol : underlierSymbol}
              contentLeft={outdated ? <Loading size='xs' /> : null}
              size='sm'
              status='primary'
            />
          </Modal.Body>
          <Spacer y={0.75} />
          <Card.Divider />
        </>
      )}
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>
          Position Preview
        </Text>
        <Input
          readOnly
          value={outdated ? ' ' : floor4(wadToDec(collateral))}
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={symbol}
          contentLeft={outdated ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={outdated ? ' ' : floor4(wadToDec(debt))}
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={outdated ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            outdated
              ? ' '
              : healthFactor.eq(ethers.constants.MaxUint256)
              ? '∞'
              : floor4(wadToDec(healthFactor))
          }
          placeholder='0'
          type='string'
          label='Health Factor'
          labelRight={'🚦'}
          contentLeft={outdated ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        {mode === 'deposit' && (
          <>
            <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              checked={
                !underlier.isZero() && underlierAllowance?.gte(underlier)
              }
              onChange={() => {
                !underlier.isZero() && underlierAllowance.gte(underlier)
                  ? props.unsetUnderlierAllowance(props.contextData.fiat)
                  : props.setUnderlierAllowance(props.contextData.fiat)
              }
              }
              color='primary'
              icon={
                ['setUnderlierAllowance', 'unsetUnderlierAllowance'].includes(
                  currentTxAction || ''
                ) && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
            <Spacer y={0.5} />
            <Text size={'0.875rem'}>Enable FIAT</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              checked={!!monetaDelegate}
              onChange={() =>
                !!monetaDelegate
                  ? props.unsetMonetaDelegate(props.contextData.fiat)
                  : props.setMonetaDelegate(props.contextData.fiat)
              }
              color='primary'
              icon={
                ['setMonetaDelegate', 'unsetMonetaDelegate'].includes(
                  currentTxAction || ''
                ) && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
          </>
        )}
        {(mode === 'withdraw' || mode === 'redeem') && (
          <>
            <Text size={'0.875rem'}>Approve FIAT</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              checked={!deltaDebt.isZero() && fiatAllowance.gte(deltaDebt)}
              // TODO: these methods are not implemented
              onChange={() =>
                !deltaDebt.isZero() && fiatAllowance.gte(deltaDebt)
                  ? props.onSendTransaction('unsetFIATAllowance')
                  : props.onSendTransaction('setFIATAllowance')
              }
              color='primary'
              icon={
                ['setFIATAllowance', 'unsetFIATAllowance'].includes(
                  currentTxAction || ''
                ) && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
          </>
        )}
        <Spacer y={3} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            props.disableActions || !hasProxy || mode === 'deposit'
              ? underlier.isZero()
              : deltaCollateral.isZero() || mode === 'deposit'
              ? monetaDelegate === false
              : true || mode === 'deposit'
              ? underlierAllowance.lt(underlier)
              : fiatAllowance.lt(deltaDebt)
          }
          icon={
            [
              'buyCollateralAndModifyDebt',
              'sellCollateralAndModifyDebt',
              'redeemCollateralAndModifyDebt',
            ].includes(currentTxAction || '') && props.disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={() => {
            if (mode === 'deposit') {
              props.buyCollateralAndModifyDebt();
            } else if (mode === 'withdraw') {
              props.sellCollateralAndModifyDebt();
            } else if (mode === 'redeem') {
              props.redeemCollateralAndModifyDebt();
            }
          }}
        >
          {mode === 'deposit' && 'Deposit'}
          {mode === 'withdraw' && 'Withdraw'}
          {mode === 'redeem' && 'Redeem'}
        </Button>
      </Modal.Footer>
    </>
  );
};
