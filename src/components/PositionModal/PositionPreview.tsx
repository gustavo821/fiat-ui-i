import { computeCollateralizationRatio, normalDebtToDebt, wadToDec } from '@fiatdao/sdk';
import { Input, Loading, Text, Tooltip } from '@nextui-org/react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { BigNumber, ethers } from 'ethers';
import { floor2, floor5 } from '../../utils';

export const PositionPreview = ({
  formDataLoading,
  collateral,
  normalDebt,
  estimatedCollateral,
  estimatedCollateralRatio,
  estimatedDebt,
  virtualRate,
  fairPrice,
  symbol,
}: {
  formDataLoading: boolean,
  collateral: BigNumber,
  normalDebt: BigNumber,
  estimatedCollateral: BigNumber,
  estimatedCollateralRatio: BigNumber,
  estimatedDebt: BigNumber,
  virtualRate: BigNumber,
  fairPrice: BigNumber,
  symbol: string,
}) => {
  return (
    <>
      <Text b size={'m'}>
        Position Preview
      </Text>
      <Input
        readOnly
        value={(formDataLoading)
          ? ' '
          : `${floor2(wadToDec(collateral))} → ${floor2(wadToDec(estimatedCollateral))}`
        }
        placeholder='0'
        type='string'
        label={`Collateral (before: ${floor2(wadToDec(collateral))} ${symbol})`}
        labelRight={symbol}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
      <Input
        readOnly
        value={(formDataLoading)
          ? ' '
          : `${floor5(wadToDec(normalDebtToDebt(normalDebt, virtualRate)))} → ${floor5(wadToDec(estimatedDebt))}`
        }
        placeholder='0'
        type='string'
        label={`Debt (before: ${floor5(wadToDec(normalDebtToDebt(normalDebt, virtualRate)))} FIAT)`}
        labelRight={'FIAT'}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
      <Input
        readOnly
        value={(() => {
          if (formDataLoading) return ' ';
          let collRatioBefore: BigNumber | string = computeCollateralizationRatio(
            collateral, fairPrice, normalDebt, virtualRate
          );
          collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
            ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (estimatedCollateralRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(estimatedCollateralRatio.mul(100)))}%`;
              return `${collRatioBefore} → ${collRatioAfter}`;
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
                <InlineMath math='\text{collRatio} = \frac{\text{collateral}*\text{fairPrice}}{\text{debt}}'/>
                <br />
              </>
            }
          >
            {`Collateralization Ratio (before: ${(() => {
              const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, virtualRate);
              if (collRatio.eq(ethers.constants.MaxUint256)) return '∞'
                return floor2(wadToDec(collRatio.mul(100)));
              })()
            }%)`}
          </Tooltip>
        }
        labelRight={'🚦'}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
    </>
  );
}
