import {
  decToScale,
  decToWad,
  scaleToDec,
  scaleToWad,
  WAD,
} from '@fiatdao/sdk';
import * as userActions from '../actions';
import 'antd/dist/antd.css';
import { ethers } from 'ethers';
import create from 'zustand';
import { debounce, floor4 } from '../utils';

/// A store for setting and getting form values.
/// Used to create and manage positions.
interface FormState {
  mode: string; // [deposit, withdraw, redeem]
  slippagePct: ethers.BigNumber; // [wad]
  underlier: ethers.BigNumber; // [underlierScale]
  deltaCollateral: ethers.BigNumber; // [wad]
  deltaDebt: ethers.BigNumber; // [wad]
  targetedHealthFactor: ethers.BigNumber; // [wad]
  collateral: ethers.BigNumber; // [wad]
  debt: ethers.BigNumber; // [wad]
  healthFactor: ethers.BigNumber; // [wad] estimated new health factor
  formDataLoading: boolean;
}

interface FormActions {
  setMode: (mode: string) => void;
  setUnderlier: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string
  ) => void;
  calculateNewPositionData: (
    fiat: any,
    modifyPositionData: any,
    selectedCollateralTypeId: string
  ) => void;
  setSlippagePct: (
    fiat: any,
    value: string,
    modifyPositionData: any,
    selectedCollateralTypeId: string
  ) => void;
  setTargetedHealthFactor: (
    fiat: any,
    value: number,
    modifyPositionData: any,
    selectedCollateralTypeId: string
  ) => void;
  setDeltaCollateral: (value: string) => void;
}

const initialState = {
  mode: 'deposit', // [deposit, withdraw, redeem]
  slippagePct: decToWad('0.001'),
  underlier: ethers.constants.Zero,
  deltaCollateral: ethers.constants.Zero,
  deltaDebt: ethers.constants.Zero, // [wad]
  targetedHealthFactor: decToWad('1.2'),
  collateral: ethers.constants.Zero, // [wad]
  debt: ethers.constants.Zero, // [wad]
  healthFactor: ethers.constants.Zero, // [wad] estimated new health factor
  formDataLoading: false,
};

export const useModifyPositionFormDataStore = create<FormState & FormActions>()(
  (set, get) => ({
    ...initialState,

    setMode: (mode) => { set(() => ({ mode })) },

    // Sets underlier and estimates output of bond tokens
    setUnderlier: async (
      fiat,
      value,
      modifyPositionData,
      selectedCollateralTypeId
    ) => {
      const collateralType = modifyPositionData.collateralType;
      const underlierScale = collateralType.properties.underlierScale;

      const underlier =
        value === null || value === ''
          ? initialState.underlier
          : decToScale(
              floor4(Number(value) < 0 ? 0 : Number(value)),
              underlierScale
            );
      set(() => ({ underlier }));

      // Estimate output values given underlier
      set(() => ({ formDataLoading: true }));
      get().calculateNewPositionData(
        fiat,
        modifyPositionData,
        selectedCollateralTypeId
      );
      set(() => ({ formDataLoading: true }));
    },

    // Calculates new health factor, collateral, debt, and deltaCollateral as needed
    // Debounced to prevent spamming RPC calls
    calculateNewPositionData: debounce(async function (
      fiat: any,
      modifyPositionData: any,
      selectedCollateralTypeId: string
    ) {
      const collateralType = modifyPositionData.collateralType;
      const underlierScale = collateralType.properties.underlierScale;
      const { slippagePct, underlier } = get();
      const {
        codex: { virtualRate: rate },
        collybus: { liquidationPrice },
      } = collateralType.state;
      const tokensOut = await userActions.underlierToBondToken(
        fiat,
        underlier,
        collateralType
      );

      const deltaCollateral = scaleToWad(tokensOut, underlierScale)
        .mul(WAD.sub(slippagePct))
        .div(WAD);

      if (selectedCollateralTypeId !== null) {
        // new position
        // calculate debt based off chosen health factor
        const { targetedHealthFactor } = get();
        const deltaNormalDebt = fiat.computeMaxNormalDebt(
          deltaCollateral,
          targetedHealthFactor,
          rate,
          liquidationPrice
        );
        const deltaDebt = fiat.normalDebtToDebt(deltaNormalDebt, rate);
        const collateral = deltaCollateral;
        const debt = deltaDebt;
        const healthFactor = fiat.computeHealthFactor(
          collateral,
          deltaNormalDebt,
          rate,
          liquidationPrice
        );

        if (healthFactor.lte(ethers.constants.One)) {
          console.error('Health factor has to be greater than 1.0');
        }

        set(() => ({
          healthFactor, // new est. health factor, not user's targetedHealthFactor
          collateral,
          debt,
          deltaCollateral,
        }));
      } else {
        const position = modifyPositionData.position;
        // existing position (selectedCollateralTypeId will be null)
        // calculate debt based off chosen health factor, taking into account position's existing collateral
        const { deltaDebt } = get();
        const normalDebt = fiat.debtToNormalDebt(deltaDebt, rate);
        const collateral = position.collateral.add(deltaCollateral);
        const debt = fiat
          .normalDebtToDebt(position.normalDebt, rate)
          .add(deltaDebt);
        const healthFactor = fiat.computeHealthFactor(
          collateral,
          normalDebt,
          rate,
          liquidationPrice
        );
        if (healthFactor.lte(ethers.constants.One)) {
          console.error('Health factor has to be greater than 1.0');
        }

        set(() => ({
          healthFactor, // new est. health factor, not user's targetedHealthFactor
          collateral,
          debt,
          deltaCollateral,
        }));
      }

      set(() => ({ formDataLoading: false }));
    }),

    setSlippagePct: (
      fiat,
      value,
      modifyPositionData,
      selectedCollateralTypeId
    ) => {
      let newSlippage: ethers.BigNumber;
      if (value === null || value === '') {
        newSlippage = initialState.slippagePct;
      } else {
        const ceiled =
          Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
        newSlippage = decToWad(floor4(ceiled / 100));
      }
      set(() => ({ slippagePct: newSlippage }));

      // Call setUnderlier with previously stored value to re-estimate deltaCollateral
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(
        underlier,
        modifyPositionData.collateralType.properties.underlierScale
      );
      setUnderlier(
        fiat,
        underlierString,
        modifyPositionData,
        selectedCollateralTypeId
      );
    },

    setTargetedHealthFactor: (
      fiat,
      value,
      modifyPositionData,
      selectedCollateralTypeId
    ) => {
      set(() => ({ targetedHealthFactor: decToWad(String(value)) }));

      // Call setUnderlier with previously stored value to re-estimate new health factor and debt
      const { underlier, setUnderlier } = get();
      const underlierString = scaleToDec(
        underlier,
        modifyPositionData.collateralType.properties.underlierScale
      );
      setUnderlier(
        fiat,
        underlierString,
        modifyPositionData,
        selectedCollateralTypeId
      );
    },

    setDeltaCollateral: (value) => {
      let newDeltaCollateral: ethers.BigNumber;

      if (value === null || value === '') {
        newDeltaCollateral = initialState.deltaCollateral;
      }

      newDeltaCollateral = decToWad(
        floor4(Number(value) < 0 ? 0 : Number(value))
      );

      set(() => ({ deltaCollateral: newDeltaCollateral }));
    },

    reset: () => {
      set(initialState);
    },
  })
);
