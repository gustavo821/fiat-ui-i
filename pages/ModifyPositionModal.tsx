import React from 'react';
import { Text, Spacer, Card, Button, Modal, Navbar, Grid, Input, Loading, Switch } from '@nextui-org/react';
import { ethers } from 'ethers';
import { Slider } from 'antd';
import 'antd/dist/antd.css';
// @ts-ignore
import { decToScale, decToWad, scaleToDec, wadToDec } from '@fiatdao/sdk';

import { formatUnixTimestamp, floor2, floor4 } from './utils';

interface ModifyPositionModalProps {
  contextData: any,
  modifyPositionData: any,
  modifyPositionFormData: any,
  transactionData: any,
  onUpdateDeltaCollateral: (deltaCollateral: null | ethers.BigNumber) => void,
  onUpdateDeltaDebt: (deltaDebt: null | ethers.BigNumber) => void,
  onUpdateUnderlier: (underlier: null | ethers.BigNumber) => void,
  onUpdateSlippage: (slippagePct: null | ethers.BigNumber) => void,
  onUpdateTargetedHealthFactor: (targetedHealthFactor: null | ethers.BigNumber) => void,
  onUpdateMode: (mode: string) => void,
  onSendTransaction: (action: string) => void,
  open: boolean,
  onClose: () => void
}

export const ModifyPositionModal = (props: ModifyPositionModalProps) => {

  if (props.contextData.fiat == null) return null;
  if (props.modifyPositionData.collateralType == null) return null;
  if (props.modifyPositionData.underlierAllowance == null) return null;
  if (props.modifyPositionData.monetaDelegate == null) return null;

  const { proxies } = props.contextData;
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol, protocol, asset },
      properties: { underlierScale, underlierSymbol, maturity }
    },
    underlierAllowance,
    monetaDelegate
  } = props.modifyPositionData;
  const {
    mode, outdated, underlier, slippagePct, deltaCollateral, deltaDebt, collateral, debt, healthFactor
  } = props.modifyPositionFormData;
  const { action: currentTxAction } = props.transactionData;

  const hasProxy = (proxies.length > 0);
  const disableActions = (props.transactionData.status === 'sent');
  
  return (
    <Modal preventClose closeButton={!disableActions} blur open={props.open} onClose={props.onClose}>
       <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>Modify Position</Text>
          <br/>
          <Text b size={16}>{`${protocol} - ${asset}`}</Text>
          <br/>
          <Text b size={14}>{`${formatUnixTimestamp(maturity)}`}</Text>
        </Text>
      </Modal.Header>
      <Modal.Body>

        <Navbar
          variant='static' isCompact disableShadow disableBlur
          containerCss={{justifyContent: 'center', background: 'transparent'}}
        >
          <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
            <Navbar.Link isActive={mode === 'deposit'} onClick={() => props.onUpdateMode('deposit')}>
              Increase
            </Navbar.Link>
            <Navbar.Link isActive={mode === 'withdraw'} onClick={() => props.onUpdateMode('withdraw')}>
              Decrease
            </Navbar.Link>
          </Navbar.Content>
        </Navbar>
        <Text b size={'m'}>Inputs</Text>
        <Grid.Container gap={0} justify='space-between' css={{ marginBottom: '1rem' }}>
          <Grid>
            {(mode === 'deposit') ? (
              <Input
                disabled={disableActions}
                value={floor2(scaleToDec(underlier, underlierScale))}
                onChange={(event) => {
                  if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                    props.onUpdateUnderlier(null);
                  } else {
                    props.onUpdateUnderlier(decToScale(floor4((Number(event.target.value) < 0)
                      ? 0
                      : Number(event.target.value)), underlierScale)
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
            ) : (
              <Input
                disabled={disableActions}
                value={floor2(wadToDec(deltaCollateral))}
                onChange={(event) => {
                  if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                    props.onUpdateDeltaCollateral(null);
                  } else {
                    props.onUpdateDeltaCollateral(decToWad(floor4((Number(event.target.value) < 0)
                      ? 0
                      : Number(event.target.value)))
                    );
                  }
                }}
                placeholder='0'
                type='number'
                label='Collateral to withdraw and swap'
                labelRight={tokenSymbol}
                bordered
                size='sm'
                borderWeight='light'
                width='13.35rem'
              />
            )}
          </Grid>
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(slippagePct)) * 100)}
              onChange={(event) => {
                if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
                  props.onUpdateSlippage(null);
                } else {
                  const ceiled = (Number(event.target.value) < 0)
                    ? 0 : (Number(event.target.value) > 50) ? 50
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
          </Grid>
        </Grid.Container>
        <Input
          disabled={disableActions}
          value={floor2(wadToDec(deltaDebt))}
          onChange={(event) => {
            if (event.target.value === null || event.target.value === undefined || event.target.value === '') {
              props.onUpdateDeltaDebt(null);
            } else {
              props.onUpdateDeltaDebt(decToWad(floor4((Number(event.target.value) < 0)
                ? 0
                : Number(event.target.value)
              )));
            }
          }}
          placeholder='0'
          type='number'
          label={(mode === 'deposit') ? 'FIAT to borrow' : 'FIAT to pay back'}
          labelRight={'FIAT'}
          bordered
          size='sm'
          borderWeight='light'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider/>
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Swap Preview</Text>
        <Input
          readOnly
          value={(outdated) ? (' ') : (mode === 'deposit')
            ? (floor4(wadToDec(deltaCollateral)))
            : (floor4(scaleToDec(underlier, underlierScale)))
          }
          placeholder='0'
          type='string'
          label={(mode === 'deposit')
            ? 'Collateral to deposit (incl. slippage)'
            : 'Underliers to withdraw (incl. slippage)'
          }
          labelRight={(mode === 'deposit') ? tokenSymbol : underlierSymbol}
          contentLeft={(outdated) ? (<Loading size='xs'/>) : (null)}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider/>
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Position Preview</Text>
        <Input
          readOnly
          value={(outdated) ? (' ') : (floor4(wadToDec(collateral)))}
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={(outdated) ? (<Loading size='xs'/>) : (null)}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(outdated) ? (' ') : (floor4(wadToDec(debt)))}
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={(outdated) ? (<Loading size='xs'/>) : (null)}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(outdated) ? (' ') : (healthFactor.eq(ethers.constants.MaxUint256)) ? ('∞') : (floor4(wadToDec(healthFactor)))}
          placeholder='0'
          type='string'
          label='Health Factor'
          labelRight={'🚦'}
          contentLeft={(outdated) ? (<Loading size='xs'/>) : (null)}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        {
          (mode === 'deposit') ? (
            <>
              <Text size={'0.875rem'}>
                Approve {underlierSymbol}
              </Text>
              <Switch
                disabled={disableActions || !hasProxy}
                // @ts-ignore
                checked={() => (!underlier.isZero() && underlierAllowance.gte(underlier))}
                onChange={() => (!underlier.isZero() && underlierAllowance.gte(underlier))
                  ? props.onSendTransaction('unsetUnderlierAllowance')
                  : props.onSendTransaction('setUnderlierAllowance')
                }
                color='primary'
                icon={
                  (['setUnderlierAllowance', 'unsetUnderlierAllowance'].includes(currentTxAction || '') && disableActions)
                    ? (<Loading size='xs' />)
                    : (null)
                }
              />
              <Spacer y={0.5} />
              <Text size={'0.875rem'}>Enable FIAT</Text>
              <Switch
                disabled={disableActions || !hasProxy}
                // @ts-ignore
                checked={() => (!!monetaDelegate)}
                onChange={() => (!!monetaDelegate)
                  ? props.onSendTransaction('unsetMonetaDelegate')
                  : props.onSendTransaction('setMonetaDelegate')
                }
                color='primary'
                icon={
                  (['setMonetaDelegate', 'unsetMonetaDelegate'].includes(currentTxAction || '') && disableActions)
                    ? (<Loading size='xs' />)
                    : (null)
                }
              />
            </>
          ) : (
            <>
              <Text size={'0.875rem'}>
                Approve FIAT
              </Text>
              <Switch
                disabled={disableActions || !hasProxy}
                // @ts-ignore
                checked={() => (!deltaDebt.isZero() && fiatAllowance.gte(deltaDebt))}
                onChange={() => (!deltaDebt.isZero() && fiatAllowance.gte(deltaDebt))
                  ? props.onSendTransaction('unsetFIATAllowance')
                  : props.onSendTransaction('setFIATAllowance')
                }
                color='primary'
                icon={
                  (['setFIATAllowance', 'unsetFIATAllowance'].includes(currentTxAction || '') && disableActions)
                    ? (<Loading size='xs' />)
                    : (null)
                }
              />
            </>
          )
        }
        <Spacer y={3} />
        <Button
          css={{minWidth: '100%'}}
          disabled={(
            disableActions
            || !hasProxy
            || (mode === 'deposit') ? underlier.isZero() : deltaCollateral.isZero()
            || (mode === 'deposit') ? monetaDelegate === false : true
            || (mode === 'deposit') ? underlierAllowance.lt(underlier) : fiatAllowance.lt(deltaDebt)
          )}
          icon={(['buyCollateralAndModifyDebt', 'sellCollateralAndModifyDebt'].includes(currentTxAction || '') && disableActions)
            ? (<Loading size='xs' />)
            : (null)
          }
          onPress={() => (mode === 'deposit')
            ? props.onSendTransaction('buyCollateralAndModifyDebt')
            : props.onSendTransaction('sellCollateralAndModifyDebt')
          }
        >
          {(mode === 'deposit') ? ('Deposit') : ('Withdraw') }
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
