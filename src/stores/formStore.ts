import create from 'zustand';
import { ethers } from 'ethers';
import { decToScale, decToWad, scaleToDec, scaleToWad, WAD, wadToDec, wadToScale, ZERO } from '@fiatdao/sdk';

import * as userActions from '../actions';
import { debounce, floor4 } from '../utils';

/// A store for setting and getting form values to create and manage positions.
interface FormState {
  mode: string; // [deposit, withdraw, redeem]
  slippagePct: ethers.BigNumber; // [wad]
  underlier: ethers.BigNumber; // [underlierScale]
  deltaCollateral: ethers.BigNumber; // [wad]
  deltaDebt: ethers.BigNumber; // [wad]
  targetedCollRatio: ethers.BigNumber; // [wad]
  collateral: ethers.BigNumber; // [wad]
  debt: ethers.BigNumber; // [wad]
  collRatio: ethers.BigNumber; // [wad] estimated new collateralization ratio
  formDataLoading: boolean;
  formWarnings: string[];
  formErrors: string[];
}

interface FormActions {
  setMode: (mode: string) => void;
  setUnderlier: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setMaxUnderlier: (
    fiat: any,
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
  setDeltaCollateral: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setMaxDeltaCollateral: (
    fiat: any,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setDeltaDebt: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setMaxDeltaDebt: (
    fiat: any,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  setFormDataLoading: (isLoading: boolean) => void;
  calculateNewPositionData: (
    fiat: any,
    modifyPositionData: any,
    selectedCollateralTypeId: string | null
  ) => void;
  resetCollateralAndDebtInputs: (fiat: any, modifyPositionData: any) => void;
  reset: () => void;
}

const initialState = {
  mode: 'deposit', // [deposit, withdraw, redeem]
  slippagePct: decToWad('0.001'),
  underlier: ZERO,
  deltaCollateral: ZERO,
  deltaDebt: ZERO, // [wad]
  targetedCollRatio: decToWad('1.2'),
  collateral: ZERO, // [wad]
  debt: ZERO, // [wad]
  collRatio: ZERO, // [wad] estimated new collateralization ratio
  formDataLoading: false,
  formWarnings: [],
  formErrors: [],
};

export const useModifyPositionFormDataStore = create<FormState & FormActions>()((set, get) => ({
    ...initialState,

    setMode: (mode) => { set(() => ({ mode })); },

    // Sets underlier and estimates output of bond tokens
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

    // Sets underlier and estimates output of bond tokens
    setMaxUnderlier: async (fiat, modifyPositionData, selectedCollateralTypeId) => {
      const underlier = modifyPositionData.underlierBalance;
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
      // Call setUnderlier with previously stored value to re-estimate deltaCollateral
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(underlier, modifyPositionData.collateralType.properties.underlierScale);
      setUnderlier(fiat, underlierString, modifyPositionData, selectedCollateralTypeId);
    },

    setTargetedCollRatio: (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      set(() => ({ targetedCollRatio: decToWad(String(value)) }));
      // Call setUnderlier with previously stored value to re-estimate new collateralization ratio and debt
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(underlier, modifyPositionData.collateralType.properties.underlierScale);
      setUnderlier(fiat, underlierString, modifyPositionData, selectedCollateralTypeId);
    },

    setDeltaCollateral: (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      let newDeltaCollateral: ethers.BigNumber;
      if (value === null || value === '') newDeltaCollateral = initialState.deltaCollateral;
      else newDeltaCollateral = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));
      set(() => ({ deltaCollateral: newDeltaCollateral }));
      // Call setUnderlier with previously stored value to re-estimate new collateralization ratio and debt
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(underlier, modifyPositionData.collateralType.properties.underlierScale);
      setUnderlier(fiat, underlierString, modifyPositionData, selectedCollateralTypeId);
    },

    setMaxDeltaCollateral: (fiat, modifyPositionData, selectedCollateralTypeId) => {
      const deltaCollateral = modifyPositionData.position.collateral;
      set(() => ({ deltaCollateral }));
      // Call setUnderlier with previously stored value to re-estimate new collateralization ratio and debt
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(underlier, modifyPositionData.collateralType.properties.underlierScale);
      setUnderlier(fiat, underlierString, modifyPositionData, selectedCollateralTypeId);
    },

    setDeltaDebt: (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      let newDeltaDebt: ethers.BigNumber;
      if (value === null || value === '') newDeltaDebt = initialState.deltaDebt;
      else newDeltaDebt = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));
      set(() => ({ deltaDebt: newDeltaDebt }));
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(underlier, modifyPositionData.collateralType.properties.underlierScale);
      setUnderlier(fiat, underlierString, modifyPositionData, selectedCollateralTypeId);
    },

    setMaxDeltaDebt: (fiat, modifyPositionData, selectedCollateralTypeId) => {
      const deltaDebt = fiat.normalDebtToDebt(
        modifyPositionData.position.normalDebt, modifyPositionData.collateralType.state.codex.virtualRate
      );
      set(() => ({ deltaDebt }));
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(underlier, modifyPositionData.collateralType.properties.underlierScale);
      setUnderlier(fiat, underlierString, modifyPositionData, selectedCollateralTypeId);
    },

    setFormDataLoading: (isLoading) => { set(() => ({ formDataLoading: isLoading })) },

    // Calculates new collateralizationRatio, collateral, debt, and deltaCollateral as needed
    // Debounced to prevent spamming RPC calls
    calculateNewPositionData: debounce(async function (
      fiat: any, modifyPositionData: any, selectedCollateralTypeId: string | null
    ) {
      const { collateralType, position } = modifyPositionData;
      const { tokenScale, underlierScale } = collateralType.properties;
      const { codex: { debtFloor } } = collateralType.settings;
      const { slippagePct, underlier, mode } = get();
      const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

      // Reset form errors and warnings on new input
      set(() => ({ formWarnings: [], formErrors: [] }));

      try {
        if (mode === 'deposit') {
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
            // Calculate deltaDebt for new position based on targetedCollRatio
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
            // Calculate deltaNormalDebt based on targetedCollRatio, taking into account an existing position's collateral
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
        } else if (mode === 'withdraw') {
          const { deltaCollateral, deltaDebt, slippagePct } = get();
          const tokenInScaled = wadToScale(deltaCollateral, tokenScale);
          let underlier = ZERO;
          if (!tokenInScaled.isZero()) {
            try {
            const underlierAmount = await userActions.collateralTokenToUnderlier(fiat, tokenInScaled, collateralType);
            underlier = underlierAmount.mul(WAD.sub(slippagePct)).div(WAD); // with slippage
            } catch (e: any) {
              if (e.reason && e.reason === 'BAL#001') {
                // Catch balancer-specific underflow error
                // https://dev.balancer.fi/references/error-codes
                throw new Error('Insufficient liquidity to convert collateral to underlier');
              }
              throw e;
            }
          }
          const deltaNormalDebt = fiat.debtToNormalDebt(deltaDebt, rate);

          if (position.collateral.lt(deltaCollateral)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient collateral']
          }));
          if (position.normalDebt.lt(deltaNormalDebt)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient debt']
          }));

          const collateral = position.collateral.sub(deltaCollateral);
          let normalDebt = position.normalDebt.sub(deltaNormalDebt);
          // override normalDebt to position.normalDebt if normalDebt is less than 1 FIAT 
          if (normalDebt.lt(WAD)) normalDebt = ZERO;
          const debt = fiat.normalDebtToDebt(normalDebt, rate);
          if (debt.gt(ZERO) && debt.lt(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
          if (!(collateral.isZero() && normalDebt.isZero()) && collRatio.lte(WAD))
            set(() => ({ formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%'] }));

          set(() => ({ collRatio, underlier, collateral, debt }));
        } else if (mode === 'redeem') {
          const { deltaCollateral, deltaDebt } = get();
          const deltaNormalDebt = fiat.debtToNormalDebt(deltaDebt, rate);

          if (position.collateral.lt(deltaCollateral)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient collateral']
          }));
          if (position.normalDebt.lt(deltaNormalDebt)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient debt']
          }));

          const collateral = position.collateral.sub(deltaCollateral);
          let normalDebt = position.normalDebt.sub(deltaNormalDebt);
          // override normalDebt to position.normalDebt if normalDebt is less than 1 FIAT 
          if (normalDebt.lt(WAD)) normalDebt = ZERO;
          const debt = fiat.normalDebtToDebt(normalDebt, rate);
          if (debt.gt(ZERO) && debt.lt(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
          if (!(collateral.isZero() && normalDebt.isZero()) && collRatio.lte(WAD))
            set(() => ({ formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%'] }));

          set(() => ({ collRatio, collateral, debt }));
        } else {
          throw new Error('Invalid mode');
        }
      } catch (error: any) {
        if (mode === 'deposit') {
          set(() => ({
            deltaCollateral: ZERO,
            deltaDebt: ZERO,
            collateral: ZERO,
            debt: ZERO,
            collRatio: ZERO,
            formErrors: [...get().formErrors, error.message],
          }));
        } else if (mode === 'withdraw' || mode === 'redeem') {
          try {
            set(() => ({
              underlier: ZERO,
              collateral: position.collateral,
              debt: fiat.normalDebtToDebt(position.normalDebt, rate),
              collRatio: fiat.computeCollateralizationRatio(position.collateral, fairPrice, position.normalDebt, rate),
              formErrors: [...get().formErrors, error.message],
            }));
          } catch (error: any) {
            set(() => ({
              underlier: ZERO,
              collateral: ZERO,
              debt: ZERO,
              collRatio: ZERO,
              formErrors: [...get().formErrors, error.message],
            }));
          }
        }
      }

      set(() => ({ formDataLoading: false }));
    }),

    resetCollateralAndDebtInputs: (fiat, modifyPositionData) => {
      const { deltaCollateral, deltaDebt, underlier } = initialState;
      set(() => ({ deltaCollateral, deltaDebt, underlier }));
      set(() => ({ formDataLoading: true }));
      get().calculateNewPositionData(fiat, modifyPositionData, null);
    },

    reset: () => {
      set(initialState);
    },
  }));
