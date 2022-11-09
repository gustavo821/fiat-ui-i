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
import { scaleToDec, wadToDec } from '@fiatdao/sdk';

import { commifyToDecimalPlaces, floor2, floor4, formatUnixTimestamp } from '../utils';
import { TransactionStatus } from '../../pages';
import { useModifyPositionFormDataStore } from '../stores/formStore';

interface ModifyPositionModalProps {
  buyCollateralAndModifyDebt: () => any;
  contextData: any;
  disableActions: boolean;
  modifyPositionData: any;
  redeemCollateralAndModifyDebt: () => any;
  sellCollateralAndModifyDebt: () => any;
  setTransactionStatus: (status: TransactionStatus) => void;
  setMonetaDelegate: (fiat: any) => any;
  setUnderlierAllowance: (fiat: any) => any;
  transactionData: any;
  unsetMonetaDelegate: (fiat: any) => any;
  unsetUnderlierAllowance: (fiat: any) => any;
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
  const formDataStore = useModifyPositionFormDataStore();

  const matured = React.useMemo(() => {
    return !(new Date() < new Date(Number(props.modifyPositionData.collateralType?.properties.maturity.toString()) * 1000));
  }, [props.modifyPositionData.collateralType?.properties.maturity])

  React.useEffect(() => {
    const mode = matured ? 'redeem' : 'deposit';
    if (formDataStore.mode !== mode) {
      formDataStore.setMode(mode);
    }
  }, [formDataStore, matured])

  if (!props.contextData.user || !props.modifyPositionData.collateralType || !props.modifyPositionData.collateralType.metadata ) {
    // TODO: add skeleton components instead of loading
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

  const { action: currentTxAction } = props.transactionData;

  const hasProxy = proxies.length > 0;

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
                  isActive={formDataStore.mode === 'deposit'}
                  onClick={() => formDataStore.setMode('deposit')}
                >
                  Increase
                </Navbar.Link>
                <Navbar.Link
                  isActive={formDataStore.mode === 'withdraw'}
                  onClick={() => formDataStore.setMode('withdraw')}
                >
                  Decrease
                </Navbar.Link>
              </>
            )}
            {matured && (
              <Navbar.Link
                isDisabled={!matured}
                isActive={formDataStore.mode === 'redeem'}
                onClick={() => formDataStore.setMode('redeem')}
              >
                Redeem
              </Navbar.Link>
            )}
          </Navbar.Content>
        </Navbar>
        <Text b size={'m'}>
          Inputs
        </Text>
        {underlierBalance && formDataStore.mode === 'deposit' && (
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
            {formDataStore.mode === 'deposit' && (
              <Input
                disabled={props.disableActions}
                value={floor2(scaleToDec(formDataStore.underlier, underlierScale))}
                onChange={(event) => {
                  formDataStore.setUnderlier(props.contextData.fiat, event.target.value, props.modifyPositionData, null);
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
            {(formDataStore.mode === 'withdraw' || formDataStore.mode === 'redeem') && (
              <Input
                disabled={props.disableActions}
                value={floor2(wadToDec(formDataStore.deltaCollateral))}
                onChange={(event) => {
                  formDataStore.setDeltaCollateral(props.contextData.fiat, event.target.value, props.modifyPositionData, null);
                }}
                placeholder='0'
                type='number'
                label={
                  formDataStore.mode === 'withdraw'
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
            {(formDataStore.mode === 'deposit' || formDataStore.mode === 'withdraw') && (
              <Input
                disabled={props.disableActions}
                value={floor2(Number(wadToDec(formDataStore.slippagePct)) * 100)}
                onChange={(event) => {
                  formDataStore.setSlippagePct(props.contextData.fiat, event.target.value, props.modifyPositionData, null);
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
          value={floor2(wadToDec(formDataStore.deltaDebt))}
          onChange={(event) => {
            formDataStore.setDeltaDebt(props.contextData.fiat, event.target.value, props.modifyPositionData, null);
          }}
          placeholder='0'
          type='number'
          label={formDataStore.mode === 'deposit' ? 'FIAT to borrow' : 'FIAT to pay back'}
          labelRight={'FIAT'}
          bordered
          size='sm'
          borderWeight='light'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      {(formDataStore.mode === 'deposit' || formDataStore.mode === 'withdraw') && (
        <>
          <Modal.Body>
            <Spacer y={0} />
            <Text b size={'m'}>
              Swap Preview
            </Text>
            <Input
              readOnly
              value={
                formDataStore.formDataLoading
                  ? ' '
                  : formDataStore.mode === 'deposit'
                  ? floor4(wadToDec(formDataStore.deltaCollateral))
                  : floor4(scaleToDec(formDataStore.underlier, underlierScale))
              }
              placeholder='0'
              type='string'
              label={
                formDataStore.mode === 'deposit'
                  ? 'Collateral to deposit (incl. slippage)'
                  : 'Underliers to withdraw (incl. slippage)'
              }
              labelRight={formDataStore.mode === 'deposit' ? symbol : underlierSymbol}
              contentLeft={formDataStore.formDataLoading ? <Loading size='xs' /> : null}
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
          value={formDataStore.formDataLoading ? ' ' : floor4(wadToDec(formDataStore.collateral))}
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={symbol}
          contentLeft={formDataStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={formDataStore.formDataLoading ? ' ' : floor4(wadToDec(formDataStore.debt))}
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={formDataStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            formDataStore.formDataLoading
              ? ' '
              : formDataStore.healthFactor.eq(ethers.constants.MaxUint256)
              ? '∞'
              : floor4(wadToDec(formDataStore.healthFactor))
          }
          placeholder='0'
          type='string'
          label='Health Factor'
          labelRight={'🚦'}
          contentLeft={formDataStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        {formDataStore.mode === 'deposit' && (
          <>
            <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              checked={
                !formDataStore.underlier.isZero() && underlierAllowance?.gte(formDataStore.underlier)
              }
              onChange={() => {
                !formDataStore.underlier.isZero() && underlierAllowance.gte(formDataStore.underlier)
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
        {(formDataStore.mode === 'withdraw' || formDataStore.mode === 'redeem') && (
          <>
            <Text size={'0.875rem'}>Approve FIAT</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              checked={!formDataStore.deltaDebt.isZero() && fiatAllowance.gte(formDataStore.deltaDebt)}
              // TODO: these methods are not implemented
              onChange={() =>
                !formDataStore.deltaDebt.isZero() && fiatAllowance.gte(formDataStore.deltaDebt)
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
            props.disableActions || !hasProxy || formDataStore.mode === 'deposit'
              ? formDataStore.underlier.isZero()
              : formDataStore.deltaCollateral.isZero() || formDataStore.mode === 'deposit'
              ? monetaDelegate === false
              : true || formDataStore.mode === 'deposit'
              ? underlierAllowance.lt(formDataStore.underlier)
              : fiatAllowance.lt(formDataStore.deltaDebt)
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
            if (formDataStore.mode === 'deposit') {
              props.buyCollateralAndModifyDebt();
            } else if (formDataStore.mode === 'withdraw') {
              props.sellCollateralAndModifyDebt();
            } else if (formDataStore.mode === 'redeem') {
              props.redeemCollateralAndModifyDebt();
            }
          }}
        >
          {formDataStore.mode === 'deposit' && 'Deposit'}
          {formDataStore.mode === 'withdraw' && 'Withdraw'}
          {formDataStore.mode === 'redeem' && 'Redeem'}
        </Button>
      </Modal.Footer>
    </>
  );
};
