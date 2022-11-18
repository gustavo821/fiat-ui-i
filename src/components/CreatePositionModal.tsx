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
import { Slider } from 'antd';
import 'antd/dist/antd.css';
import { scaleToDec, wadToDec } from '@fiatdao/sdk';

import { commifyToDecimalPlaces, floor2, floor4, formatUnixTimestamp } from '../utils';
import { useModifyPositionFormDataStore } from '../stores/formStore';
import { Alert } from './Alert';

interface CreatePositionModalProps {
  buyCollateralAndModifyDebt: () => any;
  contextData: any;
  disableActions: boolean;
  modifyPositionData: any;
  selectedCollateralTypeId: string | null;
  setMonetaDelegate: (fiat: any) => any;
  setUnderlierAllowance: (fiat: any) => any;
  transactionData: any;
  unsetMonetaDelegate: (fiat: any) => any;
  unsetUnderlierAllowance: (fiat: any) => any;
  open: boolean;
  onClose: () => void;
}

export const CreatePositionModal = (props: CreatePositionModalProps) => {
  return (
    <Modal
      preventClose
      blur
      closeButton={!props.disableActions}
      open={props.open}
      onClose={() => props.onClose()}
      width='27rem'
    >
      <CreatePositionModalBody {...props} />
    </Modal>
  );
};

const CreatePositionModalBody = (props: CreatePositionModalProps) => {
  const formDataStore = useModifyPositionFormDataStore();
  const [rpcError, setRpcError] = React.useState('');

  if (
    !props.modifyPositionData.collateralType ||
    !props.modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  const { proxies } = props.contextData;
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol, protocol, asset },
      properties: { underlierScale, underlierSymbol, maturity },
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = props.modifyPositionData;

  if (Math.floor(Date.now() / 1000) > Number(maturity.toString())) {
    return (
      <>
        <Modal.Header>
          <Text id='modal-title' size={18}>
            <Text b size={18}>Matured Asset</Text>
            <br />
            <Text b size={16}>{`${protocol} - ${asset}`}</Text>
            <br />
            <Text b size={14}>{`${formatUnixTimestamp(maturity)}`}</Text>
          </Text>
        </Modal.Header>
      </>
    );
  }

  const { action: currentTxAction } = props.transactionData;

  const hasProxy = proxies.length > 0;

  const renderFormAlerts = () => {
    const formAlerts = [];

    if (!hasProxy) {
      formAlerts.push(
        <Alert
          severity='warning'
          message={'Creating positions requires a Proxy. Please close this modal and click "Create Proxy Account" in the top bar.'}
          key={'warn-needsProxy'}
        />
      );
    }

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
          <Text b size={18}>Create Position</Text>
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
          disableBlur
          disableShadow
          containerCss={{ justifyContent: 'center', background: 'transparent' }}
        >
          <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
            <Navbar.Link isActive>Deposit</Navbar.Link>
          </Navbar.Content>
        </Navbar>
        <Text b size={'m'}>
          Inputs
        </Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Wallet:{' '}
            {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)}{' '}
            {underlierSymbol}
          </Text>
        )}
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <Input
              disabled={props.disableActions}
              value={floor2(scaleToDec(formDataStore.underlier, underlierScale))}
              onChange={(event) => {
                if (!props.selectedCollateralTypeId) {
                  console.error('No selectedCollateralTypeId!');
                  return;
                }
                formDataStore.setUnderlier(
                  props.contextData.fiat, event.target.value, props.modifyPositionData, props.selectedCollateralTypeId
                );
              }}
              placeholder='0'
              inputMode='decimal'
              label={'Underlier to swap'}
              labelRight={underlierSymbol}
              bordered
              size='sm'
              borderWeight='light'
              width='15rem'
            />
          </Grid>
          <Grid>
            <Input
              disabled={props.disableActions}
              value={floor2(Number(wadToDec(formDataStore.slippagePct)) * 100)}
              onChange={(event) => {
                if (!props.selectedCollateralTypeId) {
                  console.error('No selectedCollateralTypeId!');
                  return;
                }
                formDataStore.setSlippagePct(
                  props.contextData.fiat, event.target.value, props.modifyPositionData, props.selectedCollateralTypeId
                );
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
          </Grid>
        </Grid.Container>
        <Text
          size={'0.75rem'}
          style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
        >
          Targeted health factor ({Number(wadToDec(formDataStore.targetedHealthFactor))})
        </Text>
        <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
          <Card.Body
            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
          >
            <Slider
              handleStyle={{ borderColor: '#0072F5' }}
              included={false}
              disabled={props.disableActions}
              value={Number(wadToDec(formDataStore.targetedHealthFactor))}
              onChange={(value) => {
                if (!props.selectedCollateralTypeId) {
                  console.error('No selectedCollateralTypeId!');
                  return;
                }
                formDataStore.setTargetedHealthFactor(
                  props.contextData.fiat, value, props.modifyPositionData, props.selectedCollateralTypeId
                );
              }}
              min={1.001}
              max={5.0}
              step={0.001}
              reverse
              tooltip={{ getPopupContainer: (t) => t }}
              marks={{
                5.0: {
                  style: { color: 'grey', fontSize: '0.75rem' },
                  label: 'Safe',
                },
                4.0: {
                  style: { color: 'grey', fontSize: '0.75rem' },
                  label: '4.0',
                },
                3.0: {
                  style: { color: 'grey', fontSize: '0.75rem' },
                  label: '3.0',
                },
                2.0: {
                  style: { color: 'grey', fontSize: '0.75rem' },
                  label: '2.0',
                },
                1.001: {
                  style: {
                    color: 'grey',
                    fontSize: '0.75rem',
                    borderColor: 'white',
                  },
                  label: 'Unsafe',
                },
              }}
            />
          </Card.Body>
        </Card>
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>
          Swap Preview
        </Text>
        <Input
          readOnly
          value={formDataStore.formDataLoading ? ' ' : floor4(wadToDec(formDataStore.deltaCollateral))}
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={formDataStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
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
          labelRight={tokenSymbol}
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
        {/* <Spacer y={0} />
          <Text b size={'m'}>Summary</Text>
          <Text size='0.75rem'>{(modifyPositionFormData.deltaCollateral.isZero()) ? null : 
      <Text size='0.75rem'>{(modifyPositionFormData.deltaCollateral.isZero()) ? null : 
          <Text size='0.75rem'>{(modifyPositionFormData.deltaCollateral.isZero()) ? null : 
          <>
            Swap <b>{floor2(scaleToDec(modifyPositionFormData.underlier, modifyPositionData.collateralType.properties.underlierScale))} {modifyPositionData.collateralType.properties.underlierSymbol} </b>
            for <b>~{floor2(wadToDec(modifyPositionFormData.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b>.
            Deposit <b>~{floor2(wadToDec(modifyPositionFormData.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b> as deltaCollateral.
            Borrow <b>~{floor2(wadToDec(modifyPositionFormData.deltaDebt))} FIAT</b> against the deltaCollateral.
          </>
          }</Text> */}
      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
        <Switch
          disabled={props.disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(formDataStore.underlier) ?? false}
          onChange={async () => {
            if (!formDataStore.underlier.isZero() && underlierAllowance?.gte(formDataStore.underlier)) {
              try {
                setRpcError('');
                await props.unsetUnderlierAllowance(props.contextData.fiat);
              } catch (e: any) {
                setRpcError(e.message);
              }
            } else {
              try {
                setRpcError('');
                await props.setUnderlierAllowance(props.contextData.fiat);
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
          // Switch type is wrong, this is necessary
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
        <Spacer y={3} />
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            formDataStore.formErrors.length !== 0 ||
            formDataStore.formWarnings.length !== 0 ||
            props.disableActions ||
            !hasProxy ||
            formDataStore.underlier?.isZero() ||
            formDataStore.deltaCollateral?.isZero() ||
            underlierAllowance?.lt(formDataStore.underlier) ||
            monetaDelegate === false
          }
          icon={
            props.disableActions &&
            currentTxAction === 'buyCollateralAndModifyDebt' ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setRpcError('');
              await props.buyCollateralAndModifyDebt();
              props.onClose();
            } catch (e: any) {
              setRpcError(e.message);
            }
          }}
        >
          Deposit
        </Button>
      </Modal.Footer>
    </>
  );
};
