import create from 'zustand';
import { ethers } from 'ethers';
import { decToScale, decToWad, scaleToDec, scaleToWad, WAD, wadToDec, wadToScale, ZERO } from '@fiatdao/sdk';

import * as userActions from '../actions';
import { debounce, floor4 } from '../utils';

interface DepositSliceState {
  collateral: ethers.BigNumber; // [wad]
  deltaDebt: ethers.BigNumber; // [wad]
  underlier: ethers.BigNumber; // [underlierScale]
  targetedCollRatio: ethers.BigNumber; // [wad]
  slippagePct: ethers.BigNumber; // [wad]
  formDataLoading: boolean;
  formWarnings: string[];
  formErrors: string[];
}

interface DepositSliceActions {
  setUnderlier: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setSlippagePct: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setTargetedCollRatio: (
    fiat: any,
    value: number,
    modifyPositionData: any,
    selectedCollateralTypeId: string
  ) => void;
  setDeltaDebt: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  calculateNewPositionData: (
    fiat: any,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setFormDataLoading: (isLoading: boolean) => void;
}

const initialState = {
  slippagePct: decToWad('0.001'),
  collateral: ZERO, // [wad]
  underlier: ZERO,
  deltaDebt: ZERO, // [wad]
  targetedCollRatio: decToWad('1.2'),
  formDataLoading: false,
  formWarnings: [],
  formErrors: [],
};

export const createDepositSlice = create<DepositSliceState & DepositSliceActions>()((set,get) => ({
    ...initialState,

    setUnderlier: async (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      const collateralType = modifyPositionData.collateralType;
      const underlierScale = collateralType.properties.underlierScale;
      const underlier = value === null || value === ''
        ? initialState.underlier
        : decToScale(floor4(Number(value) < 0 ? 0 : Number(value)), underlierScale);
      set(() => ({ underlier }));
      // Estimate output values given underlier
      set(() => ({ formDataLoading: true }));
      get().calculateNewPositionData(fiat, modifyPositionData, selectedCollateralTypeId);
    },

    setSlippagePct: (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      let newSlippage: ethers.BigNumber;
      if (value === null || value === '') {
        newSlippage = initialState.slippagePct;
      } else {
        const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
        newSlippage = decToWad(floor4(ceiled / 100));
      }
      set(() => ({ slippagePct: newSlippage }));
      // Re-estimate deltaCollateral
      const { calculateNewPositionData } = get();
      set(() => ({ formDataLoading: true }));
      calculateNewPositionData(fiat, modifyPositionData, selectedCollateralTypeId);
    },

    setTargetedCollRatio: (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      set(() => ({ targetedCollRatio: decToWad(String(value)) }));
      // Re-estimate new collateralization ratio and debt
      const { calculateNewPositionData } = get();
      set(() => ({ formDataLoading: true }));
      calculateNewPositionData(fiat, modifyPositionData, selectedCollateralTypeId);
    },

    setDeltaDebt: (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      let newDeltaDebt: ethers.BigNumber;
      if (value === null || value === '') newDeltaDebt = initialState.deltaDebt;
      else newDeltaDebt = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));
      set(() => ({ deltaDebt: newDeltaDebt }));
      const { calculateNewPositionData } = get();
      set(() => ({ formDataLoading: true }));
      calculateNewPositionData(fiat, modifyPositionData, selectedCollateralTypeId);
    },

    calculateNewPositionData: debounce(async function (
      fiat: any, modifyPositionData: any, selectedCollateralTypeId: string | null
    ) {
      const { collateralType, position } = modifyPositionData;
      const { tokenScale, underlierScale } = collateralType.properties;
      const { codex: { debtFloor } } = collateralType.settings;
      const { slippagePct, underlier } = get();
      const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

      // Reset form errors and warnings on new input
      set(() => ({ formWarnings: [], formErrors: [] }));

      try {
        let deltaCollateral = ZERO;
        if (!underlier.isZero()) {
          try {
            // Preview underlier to collateral token swap
            const tokensOut = await userActions.underlierToCollateralToken(fiat, underlier, collateralType);
            // redemption price with a 1:1 exchange rate
            const minTokensOut = underlier.mul(tokenScale).div(underlierScale);
            // apply slippagePct to preview
            const tokensOutWithSlippage = tokensOut.mul(WAD.sub(slippagePct)).div(WAD);
            // assert: minTokensOut > idealTokenOut
            if (tokensOutWithSlippage.lt(minTokensOut)) set(() => (
              { formWarnings: ['Large Price Impact (Negative Yield)'] }
            ));
            deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippagePct)).div(WAD);
          } catch (e: any) {
            if (e.reason && e.reason === 'BAL#001') {
              // Catch balancer-specific underflow error
              // https://dev.balancer.fi/references/error-codes
              throw new Error('Insufficient liquidity to convert underlier to collateral');
            }
            throw e;
          }
        }

        if (selectedCollateralTypeId !== null) {
          // For new position, calculate deltaDebt based on targetedCollRatio
          const { targetedCollRatio } = get();
          const deltaNormalDebt = fiat.computeMaxNormalDebt(deltaCollateral, rate, fairPrice, targetedCollRatio);
          const deltaDebt = fiat.normalDebtToDebt(deltaNormalDebt, rate);
          const collateral = deltaCollateral;
          const debt = deltaDebt;
          const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, deltaNormalDebt, rate);

          if (deltaDebt.gt(ZERO) && deltaDebt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          if (debt.gt(0) && collRatio.lte(WAD)) set(() => ({
            formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%']
          }));

          set(() => ({ collRatio, collateral, debt, deltaDebt, deltaCollateral }));
        } else {
          // For exsiting position, calculate deltaNormalDebt based on targetedCollRatio, taking into account the position's collateral
          const { deltaDebt } = get();
          const collateral = position.collateral.add(deltaCollateral);
          const debt = fiat.normalDebtToDebt(position.normalDebt, rate).add(deltaDebt);
          const normalDebt = fiat.debtToNormalDebt(debt, rate);
          const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          if (debt.gt(ZERO) && debt.lte(collateralType.settings.codex.debtFloor) ) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          if (debt.gt(0) && collRatio.lte(WAD)) set(() => ({
            formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%']
          }));

          set(() => ({ collRatio, collateral, debt, deltaCollateral }));
        }
      } catch (error: any) {
        set(() => ({
          deltaCollateral: ZERO,
          deltaDebt: ZERO,
          collateral: ZERO,
          debt: ZERO,
          collRatio: ZERO,
          formErrors: [...get().formErrors, error.message],
        }));
      }

      set(() => ({ formDataLoading: false }));
    }),

    setFormDataLoading: (isLoading) => { set(() => ({ formDataLoading: isLoading })) },
}));
