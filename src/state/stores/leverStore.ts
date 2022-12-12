import {
  applySwapSlippage,
  computeCollateralizationRatio,
  computeLeveredDeposit,
  computeMaxNormalDebt,
  debtToNormalDebt,
  decToScale,
  decToWad,
  maxCRForLeveredDeposit,
  minCRForLeveredDeposit,
  minCRForLeveredWithdrawal,
  normalDebtToDebt,
  scaleToWad,
  WAD,
  wadToDec,
  wadToScale,
  ZERO,
} from '@fiatdao/sdk';
import { BigNumber } from 'ethers';
import create from 'zustand';
import * as userActions from '../../actions';
import { debounce, floor2, floor4, minCollRatioWithBuffer } from '../../utils';

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
    collRatio: BigNumber; // new collateralization ratio [wad]
    debt: BigNumber; // [wad]
    // estimates based on price impact
    estCollateral: BigNumber; // estimated new collateral [wad]
    estCollRatio: BigNumber; // estimated new collateralization ratio [wad]
    estMinUnderliersToBuy: BigNumber; // estimated min. amount of underliers to buy from FIAT [underlierScale]
    estMinTokenToBuy: BigNumber; // estimated min. amount of tokens to buy from Underliers [tokenScale]
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
    // estimates based on price impact
    estCollateral: BigNumber; // estimated new collateral [wad]
    estCollRatio: BigNumber; // estimated new collateralization ratio [wad]
    estMinUnderliersToBuy: BigNumber; // estimated min. amount of underliers to buy from FIAT [underlierScale]
    estMinTokenToBuy: BigNumber; // estimated min. amount of tokens to buy from Underliers [tokenScale]
  };
  decreaseState: {
    // input
    collateralSlippagePct: BigNumber; // [wad] underlier to collateral
    underlierSlippagePct: BigNumber; // [wad] fiat to underlier
    subTokenAmount: BigNumber; // [tokenScale]
    subDebt: BigNumber; // [wad]
    targetedCollRatio: BigNumber; // [wad]
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
    targetedCollRatio: BigNumber; // [wad]
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
    collateralSlippagePct: decToWad('0.01'),
    underlierSlippagePct: decToWad('0.01'),
    targetedCollRatio: decToWad('1.2'),
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    addDebt: ZERO, // [wad]
    minUnderliersToBuy: ZERO, // [underlierScale]
    minTokenToBuy: ZERO, // [tokenScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad]
    debt: ZERO, // [wad]
    // estimates based on price impact
    estCollateral: ZERO, // [wad]
    estCollRatio: ZERO, // [wad]
    estMinUnderliersToBuy: ZERO, // [underlierScale]
    estMinTokenToBuy: ZERO // [tokenScale]
  },
  increaseState: {
    // input
    upFrontUnderliers: ZERO, // [underlierScale]
    collateralSlippagePct: decToWad('0.01'),
    underlierSlippagePct: decToWad('0.01'),
    targetedCollRatio: decToWad('1.2'),
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    addDebt: ZERO, // [wad]
    minUnderliersToBuy: ZERO, // [underlierScale]
    minTokenToBuy: ZERO, // [tokenScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad]
    debt: ZERO, // [wad]
    // estimates based on price impact
    estCollateral: ZERO, // [wad]
    estCollRatio: ZERO, // [wad]
    estMinUnderliersToBuy: ZERO, // [underlierScale]
    estMinTokenToBuy: ZERO // [tokenScale]
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
    collRatio: ZERO, // [wad]
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
    collRatio: ZERO, // [wad]
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
        const { underlierScale } = modifyPositionData.collateralType.properties;
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

      // Calculate Levered Deposit:
      // 1. fetch ideal exchange rates excluding price impact and slippage
      //    - using the preview methods of LeverActions for:
      //      a. FIAT to Underliers swap by swapping 1 FIAT
      //      b. Underliers to Collateral tokens swap by swapping 1 Underlier
      // 2. compute ideal flashloan amount based on ideal exchange rates excluding price impact and slippage
      //    - amount is neither the lowest or highest flash loan as there are multiple exchange rates
      //      which can be lower or greater with price impact and slippage applied
      // 3. compute estimated exchange rates including price impact (without slippage)
      //    - using the preview methods of LeverActions for:
      //      a. FIAT to Underliers swap using the ideal flashloan amount
      //      b. Underliers to Collateral tokens swap using the total amount of Underliers (upfront + swapped)
      // 4. compute estimated and worsed case outputs
      //      a. estimated values based on estimated exchange rates with price impact (without slippage)
      //      b. worsed case values based on slippage adjusted ideal exchange rates 
      calculatePositionValuesAfterCreation: debounce(async function (fiat: any, modifyPositionData: any) {
        const { collateralType } = modifyPositionData;
        const { 
          properties: { tokenScale, underlierScale },
          settings: { codex: { debtFloor }, collybus: { liquidationRatio } },
          state: { codex: { virtualRate: rate }, collybus: { fairPrice } }
        } = collateralType
        const {
          collateralSlippagePct, underlierSlippagePct, upFrontUnderliers, targetedCollRatio
        } = get().createState;

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // 1.
          const fiatToUnderlierRateIdeal = await userActions.fiatToUnderlier(fiat, decToWad(1), collateralType);
          const underlierToCollateralRateIdeal = await userActions.underlierToCollateralToken(
            fiat, decToScale(1, underlierScale), collateralType
          );

          // 2.
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
          
          // 3.
          // sum of upfront underliers provided by user and underliers bought via flashloan
          const underlierIn = upFrontUnderliers.add(flashloanIdeal.mul(fiatToUnderlierRateIdeal).div(WAD));
          const collateralOut = await userActions.underlierToCollateralToken(fiat, underlierIn, collateralType);
          const underlierToCollateralRateWithPriceImpact = collateralOut.mul(underlierScale).div(underlierIn);
          const fiatToUnderlierRateWithPriceImpact = wadToScale(flashloanIdeal, underlierScale).mul(underlierScale).div(
            await userActions.fiatToUnderlier(fiat, flashloanIdeal, collateralType)
          );

          // 4.
          const addDebt = flashloanIdeal;
          const addNormalDebt = debtToNormalDebt(addDebt, rate);
          const debt = addDebt;
          const normalDebt = addNormalDebt;

          // a.
          const estMinUnderliersToBuy = flashloanIdeal.mul(fiatToUnderlierRateWithPriceImpact).div(WAD);
          const estMinTokenToBuy = underlierIn.mul(underlierToCollateralRateWithPriceImpact).div(underlierScale);
          const estCollateral = scaleToWad(estMinTokenToBuy, tokenScale);
          const estCollRatio = computeCollateralizationRatio(estCollateral, fairPrice, normalDebt, rate);

          // b.
          const fiatToUnderlierRateWithSlippage = applySwapSlippage(fiatToUnderlierRateIdeal, underlierSlippagePct);
          const underlierToCollateralRateWithSlippage = applySwapSlippage(underlierToCollateralRateIdeal, collateralSlippagePct);
          let minCollRatio = minCollRatioWithBuffer(minCRForLeveredDeposit(
            fairPrice,
            scaleToWad(fiatToUnderlierRateWithSlippage, underlierScale),
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale)
          ));
          if (minCollRatio.lt(minCollRatioWithBuffer(liquidationRatio)))
            minCollRatio = minCollRatioWithBuffer(liquidationRatio);
          const maxCollRatio = maxCRForLeveredDeposit(
            ZERO, ZERO, rate, fairPrice,
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale), scaleToWad(upFrontUnderliers, underlierScale)
          );
          const minUnderliersToBuy = flashloanIdeal.mul(fiatToUnderlierRateWithSlippage).div(WAD);
          const minTokenToBuy = underlierIn.mul(underlierToCollateralRateWithSlippage).div(underlierScale);
          const collateral = scaleToWad(minTokenToBuy, tokenScale);
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          if (debt.gt(ZERO) && debt.lte(debtFloor)) set(() => ({
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

          set((state) => ({
            createState: {
              ...state.createState,
              minCollRatio, maxCollRatio, addDebt, minUnderliersToBuy, minTokenToBuy,
              collateral, collRatio, debt,
              estMinUnderliersToBuy, estMinTokenToBuy, estCollateral, estCollRatio
            },
            formDataLoading: false,
          }));
        } catch (e: any) {
          console.log(e);
          set((state) => ({
            createState: {
              ...state.createState,
              minCollRatio: ZERO, maxCollRatio: ZERO, addDebt: ZERO, minUnderliersToBuy: ZERO, minTokenToBuy: ZERO,
              collateral: ZERO, collRatio: ZERO, debt: ZERO,
              estMinUnderliersToBuy: ZERO, estMinTokenToBuy: ZERO, estCollateral: ZERO, estCollRatio: ZERO
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
        const { underlierScale } = modifyPositionData.collateralType.properties;
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

      // Calculate Levered Increase:
      // same as Levered Deposit
      calculatePositionValuesAfterIncrease: debounce(async function (fiat: any, modifyPositionData: any) {
        const { collateralType, position } = modifyPositionData;
        const { 
          properties: { tokenScale, underlierScale },
          settings: { codex: { debtFloor }, collybus: { liquidationRatio } },
          state: { codex: { virtualRate: rate }, collybus: { fairPrice } }
        } = collateralType
        const {
          collateralSlippagePct, underlierSlippagePct, upFrontUnderliers, targetedCollRatio
        } = get().increaseState;

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // 1.
          const fiatToUnderlierRateIdeal = await userActions.fiatToUnderlier(fiat, decToWad(1), collateralType);
          const underlierToCollateralRateIdeal = await userActions.underlierToCollateralToken(
            fiat, decToScale(1, underlierScale), collateralType
          );

          // TODO: move into actions that is called if increaseState is initialized to set min. max. values
          // for targetCollateralizationRatio slider
          // let minCollRatio_ = minCollRatioWithBuffer(minCRForLeveredDeposit(
          //   fairPrice, fiatToUnderlierRateIdeal, underlierToCollateralRateIdeal
          // ));
          // if (minCollRatio_.lt(minCollRatioWithBuffer(liquidationRatio)))
          // minCollRatio_ = minCollRatioWithBuffer(liquidationRatio);
          // const maxCollRatio_ = maxCRForLeveredDeposit(
          //   position.collateral, position.normalDebt, rate, fairPrice, scaleToWad(underlierToCollateralRateIdeal, tokenScale),
          //   scaleToWad(upFrontUnderliers, underlierScale)
          // );

          // 2.
          const flashloanIdeal = computeLeveredDeposit(
            position.collateral,
            position.normalDebt,
            rate,
            fairPrice,
            scaleToWad(fiatToUnderlierRateIdeal, underlierScale),
            scaleToWad(underlierToCollateralRateIdeal, tokenScale),
            scaleToWad(upFrontUnderliers, underlierScale),
            targetedCollRatio
          );
          
          // 3.
          // sum of upfront underliers provided by user and underliers bought via flashloan
          const underlierIn = upFrontUnderliers.add(flashloanIdeal.mul(fiatToUnderlierRateIdeal).div(WAD));
          const collateralOut = await userActions.underlierToCollateralToken(fiat, underlierIn, collateralType);
          const underlierToCollateralRateWithPriceImpact = collateralOut.mul(underlierScale).div(underlierIn);
          const fiatToUnderlierRateWithPriceImpact = wadToScale(flashloanIdeal, underlierScale).mul(underlierScale).div(
            await userActions.fiatToUnderlier(fiat, flashloanIdeal, collateralType)
          );

          // 4.
          const addDebt = flashloanIdeal;
          const addNormalDebt = debtToNormalDebt(addDebt, rate);
          const debt = normalDebtToDebt(position.normalDebt, rate).add(addDebt);
          const normalDebt = position.normalDebt.add(addNormalDebt);

          // a.
          const estMinUnderliersToBuy = flashloanIdeal.mul(fiatToUnderlierRateWithPriceImpact).div(WAD);
          const estMinTokenToBuy = underlierIn.mul(underlierToCollateralRateWithPriceImpact).div(underlierScale);
          const estCollateral = position.collateral.add(scaleToWad(estMinTokenToBuy, tokenScale));
          const estCollRatio = computeCollateralizationRatio(estCollateral, fairPrice, normalDebt, rate);

          // b.
          const fiatToUnderlierRateWithSlippage = applySwapSlippage(fiatToUnderlierRateIdeal, underlierSlippagePct);
          const underlierToCollateralRateWithSlippage = applySwapSlippage(underlierToCollateralRateIdeal, collateralSlippagePct);
          let minCollRatio = minCollRatioWithBuffer(minCRForLeveredDeposit(
            fairPrice,
            scaleToWad(fiatToUnderlierRateWithSlippage, underlierScale),
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale)
          ));
          if (minCollRatio.lt(minCollRatioWithBuffer(liquidationRatio)))
            minCollRatio = minCollRatioWithBuffer(liquidationRatio);
          const maxCollRatio = maxCRForLeveredDeposit(
            position.collateral, position.normalDebt, rate, fairPrice,
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale), scaleToWad(upFrontUnderliers, underlierScale)
          );
          const minUnderliersToBuy = flashloanIdeal.mul(fiatToUnderlierRateWithSlippage).div(WAD);
          const minTokenToBuy = underlierIn.mul(underlierToCollateralRateWithSlippage).div(underlierScale);
          const collateral = position.collateral.add(scaleToWad(minTokenToBuy, tokenScale));
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          if (debt.gt(ZERO) && debt.lte(debtFloor)) set(() => ({
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

          set((state) => ({
            increaseState: {
              ...state.increaseState,
              minCollRatio, maxCollRatio, addDebt, minUnderliersToBuy, minTokenToBuy,
              collateral, collRatio, debt,
              estMinUnderliersToBuy, estMinTokenToBuy, estCollateral, estCollRatio
            },
            formDataLoading: false,
          }));
        } catch (e: any) {
          console.log(e);
          set((state) => ({
            increaseState: {
              ...state.increaseState,
              minCollRatio: ZERO, maxCollRatio: ZERO, addDebt: ZERO, minUnderliersToBuy: ZERO, minTokenToBuy: ZERO,
              collateral: ZERO, collRatio: ZERO, debt: ZERO,
              estMinUnderliersToBuy: ZERO, estMinTokenToBuy: ZERO, estCollateral: ZERO, estCollRatio: ZERO
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, e.message],
          }));
        }
      })
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
        const { collateralType } = modifyPositionData;
        const { properties: { tokenScale } } = collateralType;
        let newSubTokenAmount: BigNumber;
        if (value === null || value === '') newSubTokenAmount = initialState.decreaseState.subTokenAmount;
        else newSubTokenAmount = decToScale(floor4(Number(value) < 0 ? 0 : Number(value)), tokenScale);
        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            subTokenAmount: newSubTokenAmount
          },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setMaxSubTokenAmount: (fiat, modifyPositionData) => {
        const { tokenScale } = modifyPositionData.collateralType.properties;
        const subTokenAmount = wadToScale(modifyPositionData.position.collateral, tokenScale);
        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            subTokenAmount
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

      // Calculate Levered Decrease:
      calculatePositionValuesAfterDecrease: debounce(async function (fiat: any, modifyPositionData: any) {
        const { collateralType, position } = modifyPositionData;
        const { 
          properties: { tokenScale, underlierScale },
          settings: { codex: { debtFloor }, collybus: { liquidationRatio } },
          state: { codex: { virtualRate: rate }, collybus: { fairPrice } }
        } = collateralType;
        const {
          subTokenAmount, collateralSlippagePct, underlierSlippagePct, targetedCollRatio
        } = get().decreaseState;

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          const collateral = position.collateral.sub(scaleToWad(subTokenAmount, tokenScale));
          if (collateral.lt(0)) set(() => ({
            formErrors: [...get().formErrors, 'Can\'t withdraw more collateral than there is deposited']
          }));

          // if the resulting collateral is 0 than the flashloan amount has to be equal the entire outstanding debt
          // TODO: replace with computeLeveredWithdrawal method
          const flashloanIdeal = (collateral.isZero())
            ? normalDebtToDebt(position.normalDebt, rate)
            : normalDebtToDebt(
              position.normalDebt.sub(computeMaxNormalDebt(collateral, rate, fairPrice, targetedCollRatio)), rate
            );

          const underlierOut = await userActions.collateralTokenToUnderlier(fiat, subTokenAmount, collateralType);
          const collateralToUnderlierRateWithSlippage = applySwapSlippage(
            underlierOut.mul(tokenScale).div(subTokenAmount).mul(tokenScale).div(underlierScale),
            collateralSlippagePct
          );
          const underlierIn = await userActions.fiatForUnderlier(fiat, flashloanIdeal, collateralType);
          const fiatForUnderlierRateWithSlippage = applySwapSlippage(
            wadToScale(flashloanIdeal, underlierScale).mul(underlierScale).div(underlierIn),
            underlierSlippagePct.mul(-1) // apply positive slippage for max. == worsed price
          );

          const subDebt = flashloanIdeal;
          const subNormalDebt = debtToNormalDebt(subDebt, rate);
          const debt = normalDebtToDebt(position.normalDebt, rate).sub(subDebt);
          const normalDebt = position.normalDebt.sub(subNormalDebt);
          
          const minUnderliersToBuy = subTokenAmount.mul(collateralToUnderlierRateWithSlippage).div(tokenScale);
          const maxUnderliersToSell = flashloanIdeal.mul(fiatForUnderlierRateWithSlippage).div(WAD);
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          let minCollRatio = minCollRatioWithBuffer(minCRForLeveredWithdrawal(
            position.collateral, position.normalDebt, fairPrice, rate, scaleToWad(subTokenAmount, tokenScale)
          ));
          if (minCollRatio.lt(minCollRatioWithBuffer(liquidationRatio)))
            minCollRatio = minCollRatioWithBuffer(liquidationRatio);
          const maxCollRatio = computeCollateralizationRatio(
            collateral, fairPrice,
            // TODO: replace with underliertToFIAT method
            position.normalDebt.sub(debtToNormalDebt(scaleToWad(underlierOut, underlierScale), rate)), rate
          );

          if (debt.gt(ZERO) && debt.lte(debtFloor)) set(() => ({
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

          set((state) => ({
            decreaseState: {
              ...state.decreaseState,
              minCollRatio, maxCollRatio, subDebt, maxUnderliersToSell, minUnderliersToBuy,
              collateral, collRatio, debt
            },
            formDataLoading: false
          }));
        } catch (e: any) {
          console.log(e);
          set((state) => ({
            decreaseState: {
              ...state.decreaseState,
              minCollRatio: ZERO, maxCollRatio: ZERO, subDebt: ZERO, maxUnderliersToSell: ZERO, minUnderliersToBuy: ZERO,
              collateral: ZERO, collRatio: ZERO, debt: ZERO
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, e.message],
          }));
        }
      })
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
