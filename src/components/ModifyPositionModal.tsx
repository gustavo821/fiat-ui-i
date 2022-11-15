import React from 'react';
import {
  Button,
  Card,
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
import { Alert } from './Alert';
import { InputLabel } from './InputLabel';

interface ModifyPositionModalProps {
  buyCollateralAndModifyDebt: () => any;
  contextData: any;
  disableActions: boolean;
  modifyPositionData: any;
  redeemCollateralAndModifyDebt: () => any;
  sellCollateralAndModifyDebt: () => any;
  setFIATAllowance: (fiat: any) => any;
  setTransactionStatus: (status: TransactionStatus) => void;
  setMonetaDelegate: (fiat: any) => any;
  setUnderlierAllowance: (fiat: any) => any;
  transactionData: any;
  unsetFIATAllowance: (fiat: any) => any;
  unsetMonetaDelegate: (fiat: any) => any;
  unsetUnderlierAllowance: (fiat: any) => any;
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
  const [rpcError, setRpcError] = React.useState('');

  const matured = React.useMemo(() => {
    const maturity = props.modifyPositionData.collateralType?.properties.maturity.toString();
    return (maturity !== undefined && !(new Date() < new Date(Number(maturity) * 1000)));
  }, [props.modifyPositionData.collateralType?.properties.maturity])

  React.useEffect(() => {
    if (matured && formDataStore.mode !== 'redeem') {
      formDataStore.setMode('redeem');
    }  
  }, [formDataStore, matured, props.contextData.fiat, props.modifyPositionData])

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

  const renderFormAlerts = () => {
    const formAlerts = [];

    if (formDataStore.formWarnings.length !== 0) {
      formDataStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (formDataStore.formErrors.length !== 0) {
      formDataStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (rpcError !== '') {
      formAlerts.push(<Alert severity='error' message={rpcError} />);
    }

    return formAlerts;
  }

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
        {formDataStore.mode === 'deposit' && (
          <Input
            disabled={props.disableActions}
            value={floor2(scaleToDec(formDataStore.underlier, underlierScale))}
            onChange={(event) => {
              formDataStore.setUnderlier(props.contextData.fiat, event.target.value, props.modifyPositionData, null);
            }}
            placeholder='0'
            inputMode='decimal'
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
            inputMode='decimal'
            label={
              formDataStore.mode === 'withdraw'
                ? 'Collateral to withdraw and swap'
                : 'Collateral to withdraw and redeem'
            }
            labelRight={symbol}
            bordered
            size='sm'
            borderWeight='light'
          />
        )}
        {(formDataStore.mode === 'deposit' || formDataStore.mode === 'withdraw') && (
          <Input
            disabled={props.disableActions}
            value={floor2(Number(wadToDec(formDataStore.slippagePct)) * 100)}
            onChange={(event) => {
              formDataStore.setSlippagePct(props.contextData.fiat, event.target.value, props.modifyPositionData, null);
            }}
            step='0.01'
            placeholder='0'
            inputMode='decimal'
            label='Slippage'
            labelRight={'%'}
            bordered
            size='sm'
            borderWeight='light'
            width='7.5rem'
          />
        )}
        <Input
          disabled={props.disableActions}
          value={floor2(wadToDec(formDataStore.deltaDebt))}
          onChange={(event) => {
            formDataStore.setDeltaDebt(props.contextData.fiat, event.target.value, props.modifyPositionData, null);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            formDataStore.mode === 'deposit'
              ? 'FIAT to borrow'
              : <InputLabel label='FIAT to pay back' onMaxClick={() => formDataStore.setDeltaDebt(props.contextData.fiat, wadToDec(formDataStore.debt), props.modifyPositionData, null)} />
          }
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
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(formDataStore.underlier) ?? false}
              onChange={async () => {
                if(!formDataStore.underlier.isZero() && underlierAllowance.gte(formDataStore.underlier)) {
                  try {
                    setRpcError('');
                    await props.unsetUnderlierAllowance(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setUnderlierAllowance(props.contextData.fiat)
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setUnderlierAllowance', 'unsetUnderlierAllowance'].includes(currentTxAction || '') && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
            <Spacer y={0.5} />
            <Text size={'0.875rem'}>Enable FIAT</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => !!monetaDelegate}
              onChange={async () => {
                if (!!monetaDelegate) {
                  try {
                    setRpcError('');
                    await props.unsetMonetaDelegate(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setMonetaDelegate(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setMonetaDelegate', 'unsetMonetaDelegate'].includes(currentTxAction || '') && props.disableActions ? (
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
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => fiatAllowance?.gt(0) && fiatAllowance?.gte(formDataStore.deltaDebt) ?? false}
              onChange={async () => {
                if (formDataStore.deltaDebt.gt(0) && fiatAllowance.gte(formDataStore.deltaDebt)) {
                  try {
                    setRpcError('');
                    await props.unsetFIATAllowance(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setFIATAllowance(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setFIATAllowance', 'unsetFIATAllowance'].includes(currentTxAction || '') && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
          </>
        )}
        <Spacer y={3} />
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (props.disableActions || !hasProxy) return true;
            if (formDataStore.mode === 'deposit') {
              if (monetaDelegate === false) return true;
              if (formDataStore.underlier.isZero() && formDataStore.deltaDebt.isZero()) return true;
              if (!formDataStore.underlier.isZero() && underlierAllowance.lt(formDataStore.underlier)) return true;
            } else if (formDataStore.mode === 'withdraw') {
              if (formDataStore.deltaCollateral.isZero() && formDataStore.deltaDebt.isZero()) return true;
              if (!formDataStore.deltaDebt.isZero() && fiatAllowance.lt(formDataStore.deltaDebt)) return true;
            } else if (formDataStore.mode === 'redeem') {
              if (formDataStore.deltaCollateral.isZero() && formDataStore.deltaDebt.isZero()) return true;
              if (!formDataStore.deltaDebt.isZero() && fiatAllowance.lt(formDataStore.deltaDebt)) return true;
            }
            return false;
          })()}
          icon={
            [
              'buyCollateralAndModifyDebt',
              'sellCollateralAndModifyDebt',
              'redeemCollateralAndModifyDebt',
            ].includes(currentTxAction || '') && props.disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setRpcError('');
              if (formDataStore.mode === 'deposit') {
                await props.buyCollateralAndModifyDebt();
              } else if (formDataStore.mode === 'withdraw') {
                await props.sellCollateralAndModifyDebt();
              } else if (formDataStore.mode === 'redeem') {
                await props.redeemCollateralAndModifyDebt();
              }
              props.onClose();
            } catch (e: any) {
              setRpcError(e.message);
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
