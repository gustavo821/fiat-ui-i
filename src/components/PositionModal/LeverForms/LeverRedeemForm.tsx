import { computeCollateralizationRatio, decToScale, scaleToDec, WAD, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Spacer, Text, Tooltip } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, { useCallback, useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import shallow from 'zustand/shallow';
import useStore from '../../../state/stores/globalStore';
import { useLeverStore } from '../../../state/stores/leverStore';
import { floor2, floor4 } from '../../../utils';
import { Alert } from '../../Alert';
import { InputLabelWithMax } from '../../InputLabelWithMax';
import { NumericInput } from '../../NumericInput/NumericInput';
import { Slider } from '../../Slider/Slider';
import { buildRedeemCollateralAndDecreaseLeverArgs, sendTransaction } from '../../../actions';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import useSoftReset from '../../../hooks/useSoftReset';
import { useUserData } from '../../../state/queries/useUserData';

const LeverRedeemForm = ({
  onClose,
}: {
  onClose: () => void,
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
  const user = useStore((state) => state.user);
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

  const addRecentTransaction = useAddRecentTransaction();
  const { chain } = useNetwork();
  const { address } = useAccount();
  const softReset = useSoftReset();

  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const { proxies } = userData as any;
  
  const redeemCollateralAndDecreaseLever = useCallback(async (
    subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber
  ) => {
    const { collateralType, position } = modifyPositionData;
    const args = await buildRedeemCollateralAndDecreaseLeverArgs(
      fiat, user, proxies, collateralType, subTokenAmount, subDebt, maxUnderlierToSell, position
    );
    const response = await sendTransaction(
      fiat, true, proxies[0], 'redeemCollateralAndDecreaseLever', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({
      hash: response.transactionHash, description: 'Withdraw and redeem collateral and decrease leverage'
    });
    softReset();
    return response;
  }, [addRecentTransaction, fiat, modifyPositionData, proxies, softReset, user]);
  
  const subTokenAmount = useMemo(() => (
    (leverStore.redeemState.subTokenAmountStr === '')
      ? ZERO : decToScale(leverStore.redeemState.subTokenAmountStr, tokenScale)
  ), [leverStore.redeemState.subTokenAmountStr, tokenScale]);

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
              onMaxClick={() => leverStore.redeemActions.setSubTokenAmount(
                fiat, wadToDec(modifyPositionData.position.collateral).toString(), modifyPositionData
              )}
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
            placeholder='0.01'
            label={
              <Tooltip
                css={{ zIndex: 10000, width: 250 }}
                color='primary'
                content={`The maximum allowed slippage (in percentage) when swapping the redeemed ${underlierSymbol}
                  for the flash-lent FIAT. The transaction will revert if the amount of FIAT diverges by more
                  (in percentages) than the provided slippage amount.
                `}
              >
                Slippage<br/>(Underlier → FIAT)
              </Tooltip>
            }
            rightAdornment={'%'}
            style={{ width: '15.0rem' }}
          />
        </Grid.Container>
        {(
          !minCollRatio.isZero() &&
          !maxCollRatio.isZero() &&
          !minCollRatio.eq(maxCollRatio)
          && !collRatio.eq(ethers.constants.MaxUint256)
        )&& (
          <>
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={`The targeted collateralization ratio of the levered position.
                Note: The actual collateralization ratio can diverge slightly from the targeted value
                (see Position Preview).
              `}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              <Text size={'0.75rem'}>
                Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
              </Text>
            </Tooltip>
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={`The total amount of ${underlierSymbol} required to cover the outstanding debt / flash-lent
                amount of FIAT. This estimate accounts for slippage and price impact.
              `}
            >
              Underliers to cover flashloan (incl. slippage)
            </Tooltip>
          }
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={`The net amount of ${underlierSymbol} to receive after selling part of it to cover the
                outstanding debt / flash-lent amount of FIAT. This estimate accounts for slippage and price impact.
              `}
            >
              Underliers to receive (redeem)
            </Tooltip>
          }
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
            let collRatioBefore: BigNumber | string = computeCollateralizationRatio(
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <Tooltip
              css={{ zIndex: 10000, width: 250 }}
              color='primary'
              content={
                <>
                  The collateralization ratio is the ratio of the value of the collateral (fair price) divided by the
                  outstanding debt (FIAT) drawn against it. The fair price is derived from the spot price of the
                  underlier denominated in USD and a discounting model that the protocol applies for accounting for the
                  time value of money of the fixed term asset.
                  <br />
                  The following formula is used:
                  <InlineMath math="\text{collRatio} = \frac{\text{collateral}*\text{fairPrice}}{\text{debt}}"/>
                  <br />
                </>
              }
            >
              Collateralization Ratio (incl. slippage)
            </Tooltip>
          }
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
