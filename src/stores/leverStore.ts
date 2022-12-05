import {
  applySwapSlippage,
  computeCollateralizationRatio,
  computeLeveredDeposit,
  debtToNormalDebt,
  decToScale,
  decToWad,
  maxCRForLeveredDeposit,
  minCRForLeveredDeposit,
  scaleToWad,
  WAD,
  wadToDec,
  wadToScale,
  ZERO,
} from '@fiatdao/sdk';
import { BigNumber } from 'ethers';
import create from 'zustand';
import * as userActions from '../actions';
import { debounce, floor2, floor4, minCollRatioWithBuffer } from '../utils';

/// A store for setting and getting form values to create and manage positions.
export interface LeverState {
  formDataLoading: boolean;
  formWarnings: string[];
  formErrors: string[];
  createState: {
    // input
    upFrontUnderliers: BigNumber; // [underlierScale]
    collateralSlippagePct: BigNumber; // [wad] underlier to collateral
    underlierSlippagePct: BigNumber; // [wad] fiat to underlier
    targetedCollRatio: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    addDebt: BigNumber; // [wad]
    minUnderliersToBuy: BigNumber; // [underlierScale]
    minTokenToBuy: BigNumber; // [tokenScale]
    // position summary
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
  };
  increaseState: {
    // input
    upFrontUnderliers: BigNumber; // [underlierScale]
    collateralSlippagePct: BigNumber; // [wad] underlier to collateral
    underlierSlippagePct: BigNumber; // [wad] fiat to underlier
    targetedCollRatio: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    addDebt: BigNumber; // [wad]
    minUnderliersToBuy: BigNumber; // [underlierScale]
    minTokenToBuy: BigNumber; // [tokenScale]
    // position summary
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
  };
  decreaseState: {
    // input
    collateralSlippagePct: BigNumber; // [wad] underlier to collateral
    underlierSlippagePct: BigNumber; // [wad] fiat to underlier
    subTokenAmount: BigNumber; // [tokenScale]
    subDebt: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    maxUnderliersToSell: BigNumber; // [underlierScale]
    minUnderliersToBuy: BigNumber; // [underlierScale]
    // position summary
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
  };
  redeemState: {
    // input
    collateralSlippagePct: BigNumber; // [wad] underlier to collateral
    underlierSlippagePct: BigNumber; // [wad] fiat to underlier
    subTokenAmount: BigNumber; // [tokenScale]
    subDebt: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    maxUnderliersToSell: BigNumber; // [underlierScale]
    // position summary
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
  };
}

interface LeverActions {
  setFormDataLoading: (isLoading: boolean) => void;
  reset: () => void;
  createActions: {
    setUpFrontUnderliers: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setCollateralSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setUnderlierSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setTargetedCollRatio: (
      fiat: any,
      value: number,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterCreation: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
  increaseActions: {
    setUpFrontUnderliers: (
      fiat: any,
      value: string,
      modifyPositionData: any,
      selectedCollateralTypeId?: string
    ) => void;
    setCollateralSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setUnderlierSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setTargetedCollRatio: (
      fiat: any,
      value: number,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterIncrease: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
  decreaseActions: {
    setSubTokenAmount: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setMaxSubTokenAmount: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
    setCollateralSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setUnderlierSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setTargetedCollRatio: (
      fiat: any,
      value: number,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterDecrease: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
  redeemActions: {
    setSubTokenAmount: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setMaxSubTokenAmount: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
    setCollateralSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setUnderlierSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setTargetedCollRatio: (
      fiat: any,
      value: number,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterRedeem: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
}

const initialState = {
  formDataLoading: false,
  formWarnings: [],
  formErrors: [],
  createState: {
    // input
    upFrontUnderliers: ZERO, // [underlierScale]
    collateralSlippagePct: decToWad('0.001'),
    underlierSlippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    addDebt: ZERO, // [wad]
    minUnderliersToBuy: ZERO, // [underlierScale]
    minTokenToBuy: ZERO, // [tokenScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO // [wad]
  },
  increaseState: {
    // input
    upFrontUnderliers: ZERO, // [underlierScale]
    collateralSlippagePct: decToWad('0.001'),
    underlierSlippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    addDebt: ZERO, // [wad]
    minUnderliersToBuy: ZERO, // [underlierScale]
    minTokenToBuy: ZERO, // [tokenScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO // [wad]
  },
  decreaseState: {
    // input
    collateralSlippagePct: decToWad('0.001'),
    underlierSlippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    subTokenAmount: ZERO, // [tokenScale]
    subDebt: ZERO, // [wad]
    maxUnderliersToSell: ZERO, // [underlierScale]
    minUnderliersToBuy: ZERO, // [underlierScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO // [wad]
  },
  redeemState: {
    // input
    collateralSlippagePct: decToWad('0.001'),
    underlierSlippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    subTokenAmount: ZERO, // [tokenScale]
    subDebt: ZERO, // [wad]
    maxUnderliersToSell: ZERO, // [underlierScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO // [wad]
  }
};

export const useLeverStore = create<LeverState & LeverActions>()((set, get) => ({
    ...initialState,

    setFormDataLoading: (isLoading) => { set(() => ({ formDataLoading: isLoading })) },

    reset: () => {
      set(initialState);
    },

    /*
        ____ ____  _____    _  _____ _____ 
       / ___|  _ \| ____|  / \|_   _| ____|
      | |   | |_) |  _|   / _ \ | | |  _|  
      | |___|  _ <| |___ / ___ \| | | |___ 
       \____|_| \_\_____/_/   \_\_| |_____|
                                           
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */
    createActions: {
      setUpFrontUnderliers: async (fiat, value, modifyPositionData) => {
        const collateralType = modifyPositionData.collateralType;
        const underlierScale = collateralType.properties.underlierScale;
        const upFrontUnderliers = value === null || value === ''
          ? initialState.createState.upFrontUnderliers
          : decToScale(floor4(Number(value) < 0 ? 0 : Number(value)), underlierScale);

          set((state) => ({
            createState: { ...state.createState, upFrontUnderliers },
            formDataLoading: true
          }));
          get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setCollateralSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.createState.collateralSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          createState: { ...state.createState, collateralSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.createState.underlierSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          createState: { ...state.createState, underlierSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setTargetedCollRatio: (fiat, value, modifyPositionData) => {
        set((state) => ({
          createState: { ...state.createState, targetedCollRatio: decToWad(String(value)) },
          formDataLoading: true,
        }));
        get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterCreation: debounce(async function (fiat: any, modifyPositionData: any) {
        const { collateralType } = modifyPositionData;
        const { tokenScale, underlierScale } = collateralType.properties;
        const { codex: { debtFloor }, collybus: { liquidationRatio } } = collateralType.settings;
        const { collateralSlippagePct, underlierSlippagePct, upFrontUnderliers, targetedCollRatio } = get().createState;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // calculate exchange rates
          // TODO: use userActions.fiatToUnderlier()
          const fiatToUnderlierRateIdeal = decToScale(1, underlierScale);
          const underlierToCollateralRateIdeal = await userActions.underlierToCollateralToken(
            fiat, decToScale(1, underlierScale), collateralType
          );
          const flashloanIdeal = computeLeveredDeposit(
            ZERO,
            ZERO,
            rate,
            fairPrice,
            scaleToWad(fiatToUnderlierRateIdeal, underlierScale),
            scaleToWad(underlierToCollateralRateIdeal, tokenScale),
            scaleToWad(upFrontUnderliers, underlierScale),
            targetedCollRatio
          );
          // sum of upfront underliers and underliers bought via flashloan
          const underlierIn = upFrontUnderliers.add(
            wadToScale(flashloanIdeal, underlierScale).mul(fiatToUnderlierRateIdeal).div(underlierScale)
          );
          // deltaCollateral (with price impact)
          const collateralOut = await userActions.underlierToCollateralToken(fiat, underlierIn, collateralType);
          const underlierToCollateralRateWithPriceImpact = applySwapSlippage(
            scaleToWad(collateralOut, tokenScale).mul(WAD).div(scaleToWad(underlierIn, underlierScale)),
            collateralSlippagePct
          );
          // TODO: use userActions.fiatToUnderlier() with scaleToWad
          const fiatToUnderlierRateWithPriceImpact = applySwapSlippage(WAD, underlierSlippagePct);

          let minCollRatio = minCollRatioWithBuffer(minCRForLeveredDeposit(
            fairPrice, fiatToUnderlierRateWithPriceImpact, underlierToCollateralRateWithPriceImpact
          ));
          if (minCollRatio.lt(minCollRatioWithBuffer(liquidationRatio)))
            minCollRatio = minCollRatioWithBuffer(liquidationRatio);
          const maxCollRatio = maxCRForLeveredDeposit(
            ZERO, ZERO, rate, fairPrice, underlierToCollateralRateWithPriceImpact, scaleToWad(upFrontUnderliers, underlierScale)
          );

          // calculate actual flashloan amount
          const flashloan = computeLeveredDeposit(
            ZERO,
            ZERO,
            rate,
            fairPrice,
            fiatToUnderlierRateWithPriceImpact,
            underlierToCollateralRateWithPriceImpact,
            scaleToWad(upFrontUnderliers, underlierScale),
            targetedCollRatio
          );

          const deltaDebt = flashloan;
          const deltaNormalDebt = debtToNormalDebt(deltaDebt, rate);
          const deltaCollateral = applySwapSlippage(scaleToWad(collateralOut, tokenScale), collateralSlippagePct);
          const collateral = deltaCollateral;
          const debt = deltaDebt;
          // TODO: should match targetCollRatio
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, deltaNormalDebt, rate);

          if (deltaDebt.gt(ZERO) && deltaDebt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          if (debt.gt(0) && collRatio.lt(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be greater than ${floor2(wadToDec(minCollRatio))} %`
            ]
          }));

          const newCreateFormState = {
            collateral, collRatio, debt, deltaCollateral, deltaDebt, minCollRatio, maxCollRatio
          };
          set((state) => ({
            createState: { ...state.createState, ...newCreateFormState },
            formDataLoading: false,
          }));
        } catch (e: any) {
          console.log(e);
          set((state) => ({
            increaseState: {
              ...state.increaseState,
              collateral: ZERO,
              collRatio: ZERO,
              debt: ZERO,
              deltaCollateral: ZERO,
              deltaDebt: ZERO,
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, e.message],
          }));
        }
      }),
    },

    /*
       ___ _   _  ____ ____  _____    _    ____  _____ 
      |_ _| \ | |/ ___|  _ \| ____|  / \  / ___|| ____|
       | ||  \| | |   | |_) |  _|   / _ \ \___ \|  _|  
       | || |\  | |___|  _ <| |___ / ___ \ ___) | |___ 
      |___|_| \_|\____|_| \_\_____/_/   \_\____/|_____|
                                                       
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */
    increaseActions: {
      setUpFrontUnderliers: async (fiat, value, modifyPositionData) => {
        const collateralType = modifyPositionData.collateralType;
        const underlierScale = collateralType.properties.underlierScale;
        const upFrontUnderliers = value === null || value === ''
          ? initialState.increaseState.upFrontUnderliers
          : decToScale(floor4(Number(value) < 0 ? 0 : Number(value)), underlierScale);

        set((state) => ({
          increaseState: { ...state.increaseState, upFrontUnderliers },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setTargetedCollRatio: (fiat, value, modifyPositionData) => {
        set((state) => ({
          increaseState: { ...state.increaseState, targetedCollRatio: decToWad(String(value)) },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setCollateralSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.increaseState.collateralSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          increaseState: { ...state.increaseState, collateralSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.increaseState.underlierSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          increaseState: { ...state.increaseState, underlierSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterIncrease: debounce(async (fiat: any, modifyPositionData: any) => {
        return null;
      }),
    },

    /*
       ____  _____ ____ ____  _____    _    ____  _____ 
      |  _ \| ____/ ___|  _ \| ____|  / \  / ___|| ____|
      | | | |  _|| |   | |_) |  _|   / _ \ \___ \|  _|  
      | |_| | |__| |___|  _ <| |___ / ___ \ ___) | |___ 
      |____/|_____\____|_| \_\_____/_/   \_\____/|_____|
                                                        
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */
    decreaseActions: {
      setSubTokenAmount: (fiat, value, modifyPositionData) => {
        let newSubTokenAmount: BigNumber;
        if (value === null || value === '') newSubTokenAmount = initialState.decreaseState.subTokenAmount;
        else newSubTokenAmount = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));

        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            subTokenAmount: newSubTokenAmount,
          },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setMaxSubTokenAmount: (fiat, modifyPositionData) => {
        const subTokenAmount = modifyPositionData.position.collateral;

        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            subTokenAmount,
          },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setTargetedCollRatio: (fiat, value, modifyPositionData) => {
        set((state) => ({
          decreaseState: { ...state.decreaseState, targetedCollRatio: decToWad(String(value)) },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setCollateralSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.decreaseState.collateralSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          decreaseState: { ...state.decreaseState, collateralSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.decreaseState.underlierSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          decreaseState: { ...state.decreaseState, underlierSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterDecrease: debounce(async (fiat: any, modifyPositionData: any) => {
        // TODO:
      }),
    },

    /*
       ____  _____ ____  _____ _____ __  __ 
      |  _ \| ____|  _ \| ____| ____|  \/  |
      | |_) |  _| | | | |  _| |  _| | |\/| |
      |  _ <| |___| |_| | |___| |___| |  | |
      |_| \_\_____|____/|_____|_____|_|  |_|
                                            
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */
    redeemActions: {
      setSubTokenAmount: (fiat, value, modifyPositionData) => {
        let newSubTokenAmount: BigNumber;
        if (value === null || value === '') newSubTokenAmount = initialState.redeemState.subTokenAmount;
        else newSubTokenAmount = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));

        set((state) => ({
          redeemState: {
            ...state.redeemState,
            subTokenAmount: newSubTokenAmount,
          },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setMaxSubTokenAmount: (fiat, modifyPositionData) => {
        const subTokenAmount = modifyPositionData.position.collateral;

        set((state) => ({
          redeemState: {
            ...state.redeemState,
            subTokenAmount,
          },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setTargetedCollRatio: (fiat, value, modifyPositionData) => {
        set((state) => ({
          redeemState: { ...state.redeemState, targetedCollRatio: decToWad(String(value)) },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setCollateralSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.redeemState.collateralSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          redeemState: { ...state.redeemState, collateralSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.redeemState.underlierSlippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          redeemState: { ...state.redeemState, underlierSlippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterRedeem: debounce(async (fiat: any, modifyPositionData: any) => {
        // TODO:
      }),
    },
  }));
