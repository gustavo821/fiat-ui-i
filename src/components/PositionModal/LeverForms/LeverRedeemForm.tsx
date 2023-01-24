import { computeCollateralizationRatio, decToScale, scaleToDec, WAD, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Spacer, Text } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, { useMemo } from 'react';
import shallow from 'zustand/shallow';
import useStore from '../../../state/stores/globalStore';
import { useLeverStore } from '../../../state/stores/leverStore';
import { floor2, floor4 } from '../../../utils';
import { Alert } from '../../Alert';
import { InputLabelWithMax } from '../../InputLabelWithMax';
import { NumericInput } from '../../NumericInput/NumericInput';
import { Slider } from '../../Slider/Slider';

const LeverRedeemForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  redeemCollateralAndDecreaseLever,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  redeemCollateralAndDecreaseLever: (subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber) => any;
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const leverStore = useLeverStore(
    React.useCallback(
      (state) => ({
        redeemState: state.redeemState,
        redeemActions: state.redeemActions,
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
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale },
      state: { codex: { virtualRate }, collybus: { fairPrice } }
    },
    position
  } = modifyPositionData;
  const {
    subTokenAmountStr, underlierSlippagePctStr,
    maxUnderliersToSell, targetedCollRatio, underliersToRedeem,
    collateral, collRatio, debt, minCollRatio, maxCollRatio
  } = leverStore.redeemState;
  
  const { action: currentTxAction } = transactionData;
  
  const subTokenAmount = useMemo(() => {
    return leverStore.redeemState.subTokenAmountStr === '' ? ZERO : decToScale(leverStore.redeemState.subTokenAmountStr, tokenScale)
  }, [leverStore.redeemState.subTokenAmountStr, tokenScale])

  const renderFormAlerts = () => {
    const formAlerts = [];

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

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
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
        <NumericInput
          disabled={disableActions}
          value={subTokenAmountStr}
          onChange={(event) => {
            leverStore.redeemActions.setSubTokenAmount(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='Collateral to withdraw and redeem'
              onMaxClick={() => leverStore.redeemActions.setSubTokenAmount(fiat, wadToDec(modifyPositionData.position.collateral).toString(), modifyPositionData)}
            />
          }
          rightAdornment={modifyPositionData.collateralType.metadata.symbol}
          style={{ width: '100%' }}
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <NumericInput
            disabled={disableActions}
            value={underlierSlippagePctStr}
            onChange={(event) => {
              leverStore.redeemActions.setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            label='Slippage (Underlier to FIAT swap)'
            rightAdornment={'%'}
            style={{ width: '15.0rem' }}
          />
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
                  onValueChange={(value) => {
                    leverStore.redeemActions.setTargetedCollRatio(fiat, Number(value), modifyPositionData);
                  }}
                  step={0.001}
                  value={[Number(wadToDec(targetedCollRatio))]}
                />
              </Card.Body>
            </Card>
          </>
        )}
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            return `${floor2(scaleToDec(maxUnderliersToSell, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to cover flashloan (includes slippage)'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            const underliersToWithdraw = underliersToRedeem.sub(maxUnderliersToSell);
            return `${floor2(scaleToDec(underliersToWithdraw, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to redeem'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Position Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.collateral))} → ${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.normalDebt.mul(virtualRate).div(WAD)))} → ${floor2(wadToDec(debt))}`
          }
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' ';
            let collRatioBefore = computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`;
            return `${collRatioBefore} → ${collRatioAfter}`
          })()}
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        {/* renderSummary() */}
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (subTokenAmount.isZero() && leverStore.redeemState.subDebt.isZero()) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndIncreaseLever',
              'sellCollateralAndDecreaseLever',
              'redeemCollateralAndDecreaseLever'
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await redeemCollateralAndDecreaseLever(
                subTokenAmount,
                leverStore.redeemState.subDebt,
                leverStore.redeemState.maxUnderliersToSell
              );
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Redeem
        </Button>
      </Modal.Footer>
    </>
  )
}

export default LeverRedeemForm;
