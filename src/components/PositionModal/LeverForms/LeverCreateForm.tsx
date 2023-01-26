import { decToScale, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Loading, Modal, Row, Spacer, Switch, Text } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, { useMemo } from 'react';
import shallow from 'zustand/shallow';
import useStore from '../../../state/stores/globalStore';
import { useLeverStore } from '../../../state/stores/leverStore';
import { commifyToDecimalPlaces, floor2, floor4 } from '../../../utils';
import { Alert } from '../../Alert';
import { NumericInput } from '../../NumericInput/NumericInput';
import { Slider } from '../../Slider/Slider';
import { LeverPreview } from './LeverPreview';
import { useCreateLeveredPosition } from '../../../hooks/useLeveredPositions';
import { useSetUnderlierAllowanceForProxy, useUnsetUnderlierAllowanceForProxy } from '../../../hooks/useSetAllowance';

const LeverCreateForm = ({
  onClose,
}: {
  onClose: () => void,
}) => {
  const leverStore = useLeverStore(
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

  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const createLeveredPosition = useCreateLeveredPosition();
  const setUnderlierAllowanceForProxy = useSetUnderlierAllowanceForProxy();
  const unsetUnderlierAllowanceForProxy = useUnsetUnderlierAllowanceForProxy();

  const [submitError, setSubmitError] = React.useState('');
  
  const {
    collateralType: {
      properties: { underlierScale, underlierSymbol, },
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = modifyPositionData;
  const {
    upFrontUnderliersStr, collateralSlippagePctStr, underlierSlippagePctStr, targetedCollRatio,
    addDebt, minUnderliersToBuy, minTokenToBuy, minCollRatio, maxCollRatio
  } = leverStore.createState;
  const {
    setUpFrontUnderliers, setCollateralSlippagePct, setUnderlierSlippagePct, setTargetedCollRatio
  } = leverStore.createActions;
  const { action: currentTxAction } = transactionData;

  const upFrontUnderliers = useMemo(() => {
    return leverStore.createState.upFrontUnderliersStr === '' ? ZERO : decToScale(leverStore.createState.upFrontUnderliersStr, underlierScale)
  }, [leverStore.createState.upFrontUnderliersStr, underlierScale])

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

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED' ) {
      formAlerts.push(<Alert severity='error' message={submitError} key={'error-submit'}/>);
    }

    return formAlerts;
  }

  if (
    !modifyPositionData.collateralType ||
    !modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  return (
    <>
      <Modal.Body>
        <Text b size={'m'}>Inputs</Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Available to deposit:{' '}
            {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)}{' '}
            {underlierSymbol}
          </Text>
        )}
        <NumericInput
          disabled={disableActions}
          value={upFrontUnderliersStr}
          onChange={(event) => { setUpFrontUnderliers(fiat, event.target.value, modifyPositionData) }}
          placeholder='0'
          label={'Underlier to swap'}
          rightAdornment={underlierSymbol}
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={underlierSlippagePctStr}
              onChange={(event) => { setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='1.00'
              label='Slippage w/ Price Impact (FIAT to Underlier swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={collateralSlippagePctStr}
              onChange={(event) => { setCollateralSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='1.00'
              label='Slippage w/ Price Impact (Underlier to Collateral swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
        </Grid.Container>
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
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
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  maxLabel={'Safer'}
                  min={floor4(wadToDec(minCollRatio))}
                  minLabel={'Riskier'}
                  onValueChange={(value) => { setTargetedCollRatio(fiat, Number(value), modifyPositionData) }}
                  step={0.001}
                  value={[Number(wadToDec(targetedCollRatio))]}
                />
              </Card.Body>
            </Card>
          </>
        )}
        <Text size={'$sm'}>
          Note: Third-party swap fees are due on the total position amounts. Withdrawing collateral before maturity may result in a loss.
        </Text>
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <LeverPreview />
      <Modal.Footer justify='space-evenly'>
        <Card variant='bordered'>
          <Card.Body>
          <Row justify='flex-start'>
            <Switch
              disabled={disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(upFrontUnderliers) ?? false}
              onChange={async () => {
                if (!upFrontUnderliers.isZero() && underlierAllowance?.gte(upFrontUnderliers)) {
                  try {
                    setSubmitError('');
                    await unsetUnderlierAllowanceForProxy();
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                } else {
                  try {
                    setSubmitError('');
                    await setUnderlierAllowanceForProxy(upFrontUnderliers);
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
        <Spacer y={0.5} />
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            leverStore.formErrors.length !== 0 ||
            leverStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            upFrontUnderliers?.isZero() ||
            minTokenToBuy?.isZero() ||
            underlierAllowance?.lt(upFrontUnderliers) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createLeveredPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createLeveredPosition(upFrontUnderliers, addDebt, minUnderliersToBuy, minTokenToBuy);
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

export default LeverCreateForm;
