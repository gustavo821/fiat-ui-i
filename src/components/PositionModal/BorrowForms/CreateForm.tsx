import { decToScale, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, { useMemo } from 'react';
import shallow from 'zustand/shallow';
import { useBorrowStore } from '../../../state/stores/borrowStore';
import useStore from '../../../state/stores/globalStore';
import { commifyToDecimalPlaces, floor2, floor4, minCollRatioWithBuffer } from '../../../utils';
import { Alert } from '../../Alert';
import { NumericInput } from '../../NumericInput/NumericInput';
import { Slider } from '../../Slider/Slider';

const CreateForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  createPosition,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol },
      settings: { collybus: { liquidationRatio } }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = modifyPositionData;
  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const { action: currentTxAction } = transactionData;

  const borrowStore = useBorrowStore(
    React.useCallback(
      (state) => ({
        createState: state.createState,
        createActions: state.createActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );

  const underlierBN = useMemo(() => {
    return borrowStore.createState.underlierStr === '' ? ZERO : decToScale(borrowStore.createState.underlierStr, underlierScale)
  }, [borrowStore.createState.underlierStr, underlierScale])

  const [submitError, setSubmitError] = React.useState('');

  const minCollRatio = useMemo(() => minCollRatioWithBuffer(liquidationRatio), [liquidationRatio])

  if (
    !modifyPositionData.collateralType ||
    !modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  // const renderSummary = () => {
  //   if (borrowStore.createState.deltaCollateral.isZero()) {
  //     return null;
  //   }

  //   return (
  //     <>
  //       <Spacer y={0} />
  //       <Text b size={'m'}>Summary</Text>
  //       <Text size='0.75rem'>
  //         <>
  //           Swap <b>{floor2(scaleToDec(borrowStore.createState.underlierStr, modifyPositionData.collateralType.properties.underlierScale))} {modifyPositionData.collateralType.properties.underlierSymbol}</b> for<b> ~{floor2(wadToDec(borrowStore.createState.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b>. Deposit <b>~{floor2(wadToDec(borrowStore.createState.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b> as deltaCollateral. Borrow <b>~{floor2(wadToDec(borrowStore.createState.deltaDebt))} FIAT</b> against the deltaCollateral.
  //         </>
  //       </Text>
  //     </>
  //   );
  // }

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

    if (borrowStore.formWarnings.length !== 0) {
      borrowStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (borrowStore.formErrors.length !== 0) {
      borrowStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED' ) {
      formAlerts.push(<Alert severity='error' message={submitError} key={'error-submit'}/>);
    }

    return formAlerts;
  }

  return (
    <>
      <Modal.Body>
        <Text b size={'m'}>
          Inputs
        </Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Available to deposit:{' '}
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
            <NumericInput
              disabled={disableActions}
              value={borrowStore.createState.underlierStr}
              onChange={(event) => {
                borrowStore.createActions.setUnderlier(
                  fiat, event.target.value, modifyPositionData);
              }}
              label={'Underlier to swap'}
              placeholder='0'
              style={{ width: '15rem' }}
              rightAdornment={underlierSymbol}
            />
          </Grid>
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={borrowStore.createState.slippagePctStr}
              onChange={(event) => {
                borrowStore.createActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
              }}
              placeholder='0.01'
              inputMode='decimal'
              label='Slippage'
              rightAdornment={'%'}
              style={{ width: '7.5rem' }}
            />
          </Grid>
        </Grid.Container>
        <Text
          size={'0.75rem'}
          style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
        >
          Targeted collateralization ratio ({floor2(wadToDec(borrowStore.createState.targetedCollRatio.mul(100)))}%)
        </Text>
        <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
          <Card.Body
            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
          >
            <Slider
              aria-label={'Targeted Collateralization Ratio'}
              color='gradient'
              disabled={disableActions}
              inverted
              max={5.0}
              maxLabel={'Safer'}
              min={floor4(wadToDec(minCollRatio))}
              minLabel={'Riskier'}
              onValueChange={(value) => {
                borrowStore.createActions.setTargetedCollRatio(fiat, Number(value), modifyPositionData);
              }}
              step={0.001}
              value={[Number(wadToDec(borrowStore.createState.targetedCollRatio))]}
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
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.deltaCollateral))}
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
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
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.collateral))}
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.debt))}
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            borrowStore.formDataLoading
              ? ' '
              : borrowStore.createState.collRatio.eq(ethers.constants.MaxUint256)
                ? '∞'
                : `${floor2(wadToDec(borrowStore.createState.collRatio.mul(100)))}%`
          }
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />

        {/* renderSummary() */}

      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
      <Card variant='bordered'>
        <Card.Body>
        <Row justify='flex-start'>
          <Switch
            disabled={disableActions || !hasProxy}
            // Next UI Switch `checked` type is wrong, this is necessary
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(underlierBN) ?? false}
            onChange={async () => {
              if (!underlierBN.isZero() && underlierAllowance?.gte(underlierBN)) {
                try {
                  setSubmitError('');
                  await unsetUnderlierAllowanceForProxy(fiat);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              } else {
                try {
                  setSubmitError('');
                  await setUnderlierAllowanceForProxy(fiat, underlierBN);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              }
            }}
            color='primary'
            icon={
              ['setUnderlierAllowanceForProxy', 'unsetUnderlierAllowanceForProxy'].includes(currentTxAction || '') && disableActions ? (
                <Loading size='xs' />
            ) : null
            }
          />
          <Spacer x={0.5} />
          <Text>Allow <code>FIAT I</code> to transfer your {underlierSymbol}</Text>
          </Row>
          </Card.Body>
        </Card>
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            borrowStore.formErrors.length !== 0 ||
            borrowStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            underlierBN.isZero() ||
            borrowStore.createState.deltaCollateral?.isZero() ||
            underlierAllowance?.lt(underlierBN) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createPosition(
                borrowStore.createState.deltaCollateral, borrowStore.createState.deltaDebt, underlierBN
              );
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Deposit
        </Button>
      </Modal.Footer>
    </>
  );
}

export default CreateForm;
