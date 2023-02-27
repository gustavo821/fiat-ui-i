import {
  applySwapSlippage,
  computeCollateralizationRatio,
  computeFlashloanForLeveredDeposit,
  computeFlashloanForLeveredWithdrawal,
  debtToNormalDebt,
  decToScale,
  decToWad,
  estimatedUnderlierForLeveredWithdrawal,
  interestPerSecondToInterestToMaturity,
  maxCRForLeveredDeposit,
  maxCRForLeveredWithdrawal,
  // maxCRForLeveredWithdrawal,
  minCRForLeveredDeposit,
  minCRForLeveredWithdrawal,
  normalDebtToDebt,
  profitAtMaturity,
  scaleToDec,
  scaleToWad,
  WAD,
  wadToDec,
  wadToScale,
  yieldToMaturity,
  yieldToMaturityToAnnualYield,
  ZERO
} from '@fiatdao/sdk';
import { BigNumber } from 'ethers';
import create from 'zustand';
import * as userActions from '../../actions';
import {
  debounce,
  floor2,
  getTimestamp,
  maxCollRatioWithBuffer,
  minCollRatioWithBuffer
} from '../../utils';

/// A store for setting and getting form values to create and manage *levered* positions.
/// User input values are `string`s to handle all sensible decimal inputs (empty str, 0, 0.0, etc.).
/// These strings are converted to `BigNumber`s when necessary.
export interface LeverState {
  formDataLoading: boolean;
  formWarnings: string[];
  formErrors: string[];
  createState: {
    // input
    upFrontUnderliersStr: string; // [underlierScale]
    collateralSlippagePctStr: string; // [wad] underlier to collateral
    underlierSlippagePctStr: string; // [wad] fiat to underlier
    targetedCollRatio: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    addDebt: BigNumber; // [wad]
    minUnderliersToBuy: BigNumber; // [underlierScale]
    minTokenToBuy: BigNumber; // [tokenScale]
    leveragedGain: BigNumber; // [wad]
    leveragedAPY: BigNumber; // [wad]
    // position summary
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // new collateralization ratio [wad]
    debt: BigNumber; // [wad]
    // estimates without slippage protection (best case)
    estCollateral: BigNumber; // estimated new collateral [wad]
    estCollRatio: BigNumber; // estimated new collateralization ratio [wad]
    estMinUnderliersToBuy: BigNumber; // estimated min. amount of underliers to buy from FIAT [underlierScale]
    estMinTokenToBuy: BigNumber; // estimated min. amount of tokens to buy from Underliers [tokenScale]
  };
  increaseState: {
    // input
    upFrontUnderliersStr: string; // [underlierScale]
    collateralSlippagePctStr: string; // [wad] underlier to collateral
    underlierSlippagePctStr: string; // [wad] fiat to underlier
    targetedCollRatio: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    addDebt: BigNumber; // [wad]
    minUnderliersToBuy: BigNumber; // [underlierScale]
    minTokenToBuy: BigNumber; // [tokenScale]
    redeemableUnderliers: BigNumber; // [underlierScale]
    // position summary
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    // estimates without slippage protection (best case)
    estCollateral: BigNumber; // estimated new collateral [wad]
    estCollRatio: BigNumber; // estimated new collateralization ratio [wad]
    estMinUnderliersToBuy: BigNumber; // estimated min. amount of underliers to buy from FIAT [underlierScale]
    estMinTokenToBuy: BigNumber; // estimated min. amount of tokens to buy from Underliers [tokenScale]
  };
  decreaseState: {
    // input
    collateralSlippagePctStr: string; // [wad] underlier to collateral
    underlierSlippagePctStr: string; // [wad] fiat to underlier
    subTokenAmountStr: string; // [tokenScale]
    subDebt: BigNumber; // [wad]
    targetedCollRatio: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    maxUnderliersToSell: BigNumber; // [underlierScale]
    minUnderliersToBuy: BigNumber; // [underlierScale]
    redeemableUnderliers: BigNumber; // [underlierScale]
    // position summary
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
  };
  redeemState: {
    // input
    underlierSlippagePctStr: string; // [wad] fiat to underlier
    subTokenAmountStr: string; // [tokenScale]
    subDebt: BigNumber; // [wad]
    targetedCollRatio: BigNumber; // [wad]
    // output
    minCollRatio: BigNumber; // [wad]
    maxCollRatio: BigNumber; // [wad]
    underliersToRedeem: BigNumber; // [underlierScale]
    maxUnderliersToSell: BigNumber; // [underlierScale]
    redeemableUnderliers: BigNumber; // [underlierScale]
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

const initialState: LeverState = {
  formDataLoading: false,
  formWarnings: [],
  formErrors: [],
  createState: {
    // input
    upFrontUnderliersStr: '', // [underlierScale]
    collateralSlippagePctStr: '0.01',
    underlierSlippagePctStr: '0.01',
    targetedCollRatio: decToWad('1.2'),
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    addDebt: ZERO, // [wad]
    minUnderliersToBuy: ZERO, // [underlierScale]
    minTokenToBuy: ZERO, // [tokenScale]
    leveragedGain: ZERO, // [wad]
    leveragedAPY: ZERO, // [wad]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad]
    debt: ZERO, // [wad]
    // upper bound estimates (without slippage)
    estCollateral: ZERO, // [wad]
    estCollRatio: ZERO, // [wad]
    estMinUnderliersToBuy: ZERO, // [underlierScale]
    estMinTokenToBuy: ZERO // [tokenScale]
  },
  increaseState: {
    // input
    upFrontUnderliersStr: '', // [underlierScale]
    collateralSlippagePctStr: '0.5',
    underlierSlippagePctStr: '0.01',
    targetedCollRatio: ZERO, // [wad]
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    addDebt: ZERO, // [wad]
    minUnderliersToBuy: ZERO, // [underlierScale]
    minTokenToBuy: ZERO, // [tokenScale]
    redeemableUnderliers: ZERO, // [underlierScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad]
    debt: ZERO, // [wad]
    // upper bound estimates (without slippage)
    estCollateral: ZERO, // [wad]
    estCollRatio: ZERO, // [wad]
    estMinUnderliersToBuy: ZERO, // [underlierScale]
    estMinTokenToBuy: ZERO // [tokenScale]
  },
  decreaseState: {
    // input
    collateralSlippagePctStr: '0.5',
    underlierSlippagePctStr: '0.01',
    subTokenAmountStr: '', // [tokenScale]
    targetedCollRatio: ZERO, // [wad]
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    subDebt: ZERO, // [wad]
    maxUnderliersToSell: ZERO, // [underlierScale]
    minUnderliersToBuy: ZERO, // [underlierScale]
    redeemableUnderliers: ZERO, // [underlierScale]
    // position summary
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad]
    debt: ZERO // [wad]
  },
  redeemState: {
    // input
    underlierSlippagePctStr: '0.01',
    subTokenAmountStr: '', // [tokenScale]
    targetedCollRatio: ZERO, // [wad]
    // output
    minCollRatio: ZERO, // [wad]
    maxCollRatio: ZERO, // [wad]
    subDebt: ZERO, // [wad]
    underliersToRedeem: ZERO, // [underlierScale]
    maxUnderliersToSell: ZERO, // [underlierScale]
    redeemableUnderliers: ZERO, // [underlierScale]
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
        set((state) => ({
          createState: { ...state.createState, upFrontUnderliersStr: value },
          formDataLoading: true
        }));
          get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setCollateralSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          createState: { ...state.createState, collateralSlippagePctStr: value },
          formDataLoading: true,
        }));
        get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          createState: { ...state.createState, underlierSlippagePctStr: value },
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
        const { 
          properties: { tokenScale, underlierScale, maturity },
          settings: { codex: { debtFloor }, collybus: { liquidationRatio } },
          state: { codex: { virtualRate: rate }, collybus: { fairPrice }, publican: { interestPerSecond } }
        } = collateralType
        const {
          collateralSlippagePctStr, underlierSlippagePctStr, upFrontUnderliersStr, targetedCollRatio
        } = get().createState;

        // reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // convert inputs from string to BigNumber
          const upFrontUnderliers = (upFrontUnderliersStr === null || upFrontUnderliersStr === '')
            ? ZERO : decToScale(upFrontUnderliersStr, underlierScale);
          const collSlippageCeiled = (Number(collateralSlippagePctStr) < 0)
            ? 0 : (Number(collateralSlippagePctStr) > 50) ? 50 : Number(collateralSlippagePctStr);
          const collateralSlippagePct = decToWad(collSlippageCeiled / 100);
          const underlierSlippageCeiled = (Number(underlierSlippagePctStr) < 0)
            ? 0 : (Number(underlierSlippagePctStr) > 50) ? 50 : Number(underlierSlippagePctStr);
          const underlierSlippagePct = decToWad(underlierSlippageCeiled / 100);
          
          // compute required flashloan amount based on ideal exchange rates (w/o price impact and slippage)
          const fiatToUnderlierRateIdeal = await userActions.fiatToUnderlier(fiat, decToWad(1), collateralType);
          const underlierToCollateralRateIdeal = await userActions.underlierToCollateralToken(
            fiat, decToScale(1, underlierScale), collateralType
          );
          const flashloan = computeFlashloanForLeveredDeposit(
            ZERO,
            ZERO,
            rate,
            fairPrice,
            scaleToWad(fiatToUnderlierRateIdeal, underlierScale),
            scaleToWad(underlierToCollateralRateIdeal, tokenScale),
            scaleToWad(upFrontUnderliers, underlierScale),
            targetedCollRatio.add(decToWad(0.0025)) // error compensation
          );
          const addDebt = flashloan;
          const addNormalDebt = debtToNormalDebt(addDebt, rate);
          const debt = addDebt;
          const normalDebt = addNormalDebt;
          
          // compute upper bound exchange rates including price impact (w/o slippage)
          // sum of upfront underliers provided by user and underliers bought via flashloan
          const underliersInIdeal = upFrontUnderliers.add(flashloan.mul(fiatToUnderlierRateIdeal).div(WAD));
          const collateralOut = await userActions.underlierToCollateralToken(fiat, underliersInIdeal, collateralType);
          const underlierToCollateralRateWithPriceImpact = collateralOut.mul(underlierScale).div(underliersInIdeal);
          const fiatToUnderlierRateWithPriceImpact = (await userActions.fiatToUnderlier(
            fiat, flashloan, collateralType
          )).mul(WAD).div(flashloan);
          const underliersIn = upFrontUnderliers.add(flashloan.mul(fiatToUnderlierRateWithPriceImpact).div(WAD));
          console.debug('Rate (Underlier to Collateral Asset):', scaleToDec(underlierToCollateralRateWithPriceImpact, tokenScale));
          console.debug('Rate (FIAT to Underlier):', scaleToDec(fiatToUnderlierRateWithPriceImpact, underlierScale));

          // compute the upper bound output amounts for the resulting collateral and collateralization ratio
          const estMinUnderliersToBuy = flashloan.mul(fiatToUnderlierRateWithPriceImpact).div(WAD);
          const estMinTokenToBuy = underliersIn.mul(underlierToCollateralRateWithPriceImpact).div(underlierScale);
          const estCollateral = scaleToWad(estMinTokenToBuy, tokenScale);
          const estCollRatio = computeCollateralizationRatio(estCollateral, fairPrice, normalDebt, rate);

          // compute the lower bound amounts for the resulting collateral and collateralization ratio
          const fiatToUnderlierRateWithSlippage = applySwapSlippage(
            fiatToUnderlierRateWithPriceImpact, underlierSlippagePct
          );
          const underlierToCollateralRateWithSlippage = applySwapSlippage(
            underlierToCollateralRateWithPriceImpact, collateralSlippagePct
          );
          const minUnderliersToBuy = flashloan.mul(fiatToUnderlierRateWithSlippage).div(WAD);
          const minTokenToBuy = underliersIn.mul(underlierToCollateralRateWithSlippage).div(underlierScale);
          const collateral = scaleToWad(minTokenToBuy, tokenScale);
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          // calculate the net. gain at maturity (including the due borrow fee)
          const borrowFees = normalDebt.mul(
            interestPerSecondToInterestToMaturity(interestPerSecond, getTimestamp(), maturity).sub(WAD)
          ).div(WAD);
          const withdrawableUnderliers = wadToScale(estimatedUnderlierForLeveredWithdrawal(
            collateral, WAD, WAD, debt.add(borrowFees)
          ), underlierScale); // assuming 1:1 exchanges rates upon maturity for FIAT : Underlier : Collateral Asset
          const leveragedGain = profitAtMaturity(upFrontUnderliers, withdrawableUnderliers);
          if (leveragedGain.lt(ZERO)) set(() => ({
            formErrors: [...get().formErrors, 'Large Price Impact (Negative Yield)']
          }));
          const leveragedAPY = yieldToMaturityToAnnualYield(
            yieldToMaturity(scaleToWad(upFrontUnderliers, underlierScale), scaleToWad(leveragedGain, underlierScale)),
            getTimestamp(),
            maturity
          );

          // compute the lower and upper bounds for the possible collateralization ratio
          const minCollRatio = minCollRatioWithBuffer(minCRForLeveredDeposit(
            fairPrice,
            scaleToWad(fiatToUnderlierRateWithSlippage, underlierScale),
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale),
            liquidationRatio
          ));
          const maxCollRatio = maxCRForLeveredDeposit(
            ZERO,
            ZERO,
            rate,
            fairPrice,
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale),
            scaleToWad(upFrontUnderliers, underlierScale),
            liquidationRatio
          );

          // check that the resulting debt is either zero or above the debt floor
          if (debt.gt(ZERO) && debt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          // check that the resulting collateralization ratio is within the lower and upper bounds
          if (debt.gt(0) && collRatio.lt(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be greater than ${floor2(wadToDec(minCollRatio.mul(100)))}%`
            ]
          }));
          if (debt.gt(0) && collRatio.gt(maxCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be less than ${floor2(wadToDec(maxCollRatio.mul(100)))}%`
            ]
          }));

          set((state) => ({
            createState: {
              ...state.createState,
              minCollRatio, maxCollRatio, minUnderliersToBuy, minTokenToBuy,
              addDebt, leveragedGain, leveragedAPY,
              collateral, collRatio, debt,
              estMinUnderliersToBuy, estMinTokenToBuy, estCollateral, estCollRatio
            },
            formDataLoading: false,
          }));
        } catch (error: any) {
          console.error(error);
          set((state) => ({
            createState: {
              ...state.createState,
              minCollRatio: ZERO, maxCollRatio: ZERO, minUnderliersToBuy: ZERO, minTokenToBuy: ZERO,
              addDebt: ZERO, leveragedGain: ZERO, leveragedAPY: ZERO,
              collateral: ZERO, collRatio: ZERO, debt: ZERO,
              estMinUnderliersToBuy: ZERO, estMinTokenToBuy: ZERO, estCollateral: ZERO, estCollRatio: ZERO
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, error.message],
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
        set((state) => ({
          increaseState: { ...state.increaseState, upFrontUnderliersStr: value },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setCollateralSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          increaseState: { ...state.increaseState, collateralSlippagePctStr: value },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          increaseState: { ...state.increaseState, underlierSlippagePctStr: value },
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

      calculatePositionValuesAfterIncrease: debounce(async function (fiat: any, modifyPositionData: any) {
        const { collateralType, position } = modifyPositionData;
        const { 
          properties: { tokenScale, underlierScale, maturity },
          settings: { codex: { debtFloor }, collybus: { liquidationRatio } },
          state: { codex: { virtualRate: rate }, collybus: { fairPrice }, publican: { interestPerSecond } }
        } = collateralType
        const { collateralSlippagePctStr, underlierSlippagePctStr, upFrontUnderliersStr } = get().increaseState;
        let { targetedCollRatio } = get().increaseState;

        // reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // convert user inputs from strings to BigNumbers
          const upFrontUnderliers = (upFrontUnderliersStr === null || upFrontUnderliersStr === '')
            ? ZERO : decToScale(upFrontUnderliersStr, underlierScale);
          const collSlippageCeiled = (Number(collateralSlippagePctStr) < 0)
            ? 0 : (Number(collateralSlippagePctStr) > 50) ? 50 : Number(collateralSlippagePctStr);
          const collateralSlippagePct = decToWad(collSlippageCeiled / 100);
          const underlierSlippageCeiled = (Number(underlierSlippagePctStr) < 0)
            ? 0 : (Number(underlierSlippagePctStr) > 50) ? 50 : Number(underlierSlippagePctStr);
          const underlierSlippagePct = decToWad(underlierSlippageCeiled / 100);

          // set the initial value for targetCollRatio to the current collRatio
          const currentCollRatio = (position.collateral.isZero() && position.normalDebt.isZero())
            ? initialState.createState.targetedCollRatio
            : computeCollateralizationRatio(position.collateral, fairPrice, position.normalDebt, rate);
          if (targetedCollRatio.isZero()) targetedCollRatio = currentCollRatio
          
          // compute required flashloan amount based on ideal exchange rates (w/o price impact and slippage)
          const fiatToUnderlierRateIdeal = await userActions.fiatToUnderlier(fiat, decToWad(1), collateralType);
          const underlierToCollateralRateIdeal = await userActions.underlierToCollateralToken(
            fiat, decToScale(1, underlierScale), collateralType
          );
          const flashloan = computeFlashloanForLeveredDeposit(
            position.collateral,
            position.normalDebt,
            rate,
            fairPrice,
            scaleToWad(fiatToUnderlierRateIdeal, underlierScale),
            scaleToWad(underlierToCollateralRateIdeal, tokenScale),
            scaleToWad(upFrontUnderliers, underlierScale),
            targetedCollRatio.add(decToWad(0.0025)) // error compensation
          );
          const addDebt = flashloan;
          const addNormalDebt = debtToNormalDebt(addDebt, rate);
          const debt = normalDebtToDebt(position.normalDebt, rate).add(addDebt);
          const normalDebt = position.normalDebt.add(addNormalDebt);
          
          // compute upper bound exchange rates including price impact (w/o slippage)
          // sum of upfront underliers provided by user and underliers bought via flashloan
          const underliersInIdeal = upFrontUnderliers.add(flashloan.mul(fiatToUnderlierRateIdeal).div(WAD));
          const collateralOut = await userActions.underlierToCollateralToken(fiat, underliersInIdeal, collateralType);
          const underlierToCollateralRateWithPriceImpact = collateralOut.mul(underlierScale).div(underliersInIdeal);
          const fiatToUnderlierRateWithPriceImpact = (await userActions.fiatToUnderlier(
            fiat, flashloan, collateralType)
          ).mul(WAD).div(flashloan);
          const underliersIn = upFrontUnderliers.add(flashloan.mul(fiatToUnderlierRateWithPriceImpact).div(WAD));
          console.debug('Rate (Underlier to Collateral Asset):', scaleToDec(underlierToCollateralRateWithPriceImpact, tokenScale));
          console.debug('Rate (FIAT to Underlier):', scaleToDec(fiatToUnderlierRateWithPriceImpact, underlierScale));

          // compute the upper bound output amounts for the resulting collateral and collateralization ratio
          const estMinUnderliersToBuy = flashloan.mul(fiatToUnderlierRateWithPriceImpact).div(WAD);
          const estMinTokenToBuy = underliersIn.mul(underlierToCollateralRateWithPriceImpact).div(underlierScale);
          const estCollateral = position.collateral.add(scaleToWad(estMinTokenToBuy, tokenScale));
          const estCollRatio = computeCollateralizationRatio(estCollateral, fairPrice, normalDebt, rate);

          // compute the lower bound amounts for the resulting collateral and collateralization ratio
          const fiatToUnderlierRateWithSlippage = applySwapSlippage(
            fiatToUnderlierRateWithPriceImpact, underlierSlippagePct
          );
          const underlierToCollateralRateWithSlippage = applySwapSlippage(
            underlierToCollateralRateWithPriceImpact, collateralSlippagePct
          );
          const minUnderliersToBuy = flashloan.mul(fiatToUnderlierRateWithSlippage).div(WAD);
          const minTokenToBuy = underliersIn.mul(underlierToCollateralRateWithSlippage).div(underlierScale);
          const collateral = position.collateral.add(scaleToWad(minTokenToBuy, tokenScale));
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          // calculate the net. redeemable underlier amount at maturity
          const borrowFees = normalDebt.mul(
            interestPerSecondToInterestToMaturity(interestPerSecond, getTimestamp(), maturity).sub(WAD)
          ).div(WAD); // assuming 1:1 exchanges rates upon maturity for FIAT : underlier : collateral asset
          const redeemableUnderliers = wadToScale(estimatedUnderlierForLeveredWithdrawal(
            collateral, WAD, WAD, debt.add(borrowFees)
          ), underlierScale);

          // compute the lower and upper bounds for the possible collateralization ratio
          let minCollRatio = minCollRatioWithBuffer(minCRForLeveredDeposit(
            fairPrice,
            scaleToWad(fiatToUnderlierRateWithSlippage, underlierScale),
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale),
            liquidationRatio
          ));
          if (minCollRatio.gt(currentCollRatio)) minCollRatio = currentCollRatio;
          let maxCollRatio = maxCollRatioWithBuffer(maxCRForLeveredDeposit(
            position.collateral,
            position.normalDebt,
            rate,
            fairPrice,
            scaleToWad(underlierToCollateralRateWithSlippage, tokenScale),
            scaleToWad(upFrontUnderliers, underlierScale),
            liquidationRatio
          ));
          if (maxCollRatio.lt(minCollRatio)) maxCollRatio = minCollRatio;
          if (maxCollRatio.lt(currentCollRatio)) maxCollRatio = currentCollRatio;

          // check that the upper bound estimate is not less than the lower bound estimate
          if (estMinTokenToBuy.lt(minTokenToBuy) || estMinUnderliersToBuy.lt(minUnderliersToBuy)) set(() => ({
            formErrors: [
              ...get().formErrors,
              'Transaction is likely to fail. Please increase the Slippage tolerance.'
            ]
          }));

          // check that the resulting debt is either zero or above the debt floor
          if (debt.gt(ZERO) && debt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          // check that the resulting collateralization ratio is within the lower and upper bounds
          if (debt.gt(0) && collRatio.lt(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be greater than ${floor2(wadToDec(minCollRatio.mul(100)))}%`
            ]
          }));
          if (debt.gt(0) && collRatio.gt(maxCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be less than ${floor2(wadToDec(maxCollRatio.mul(100)))}%`
            ]
          }));

          set((state) => ({
            increaseState: {
              ...state.increaseState,
              minCollRatio, maxCollRatio, minUnderliersToBuy, minTokenToBuy,
              addDebt, redeemableUnderliers, targetedCollRatio,
              collateral, collRatio, debt,
              estMinUnderliersToBuy, estMinTokenToBuy, estCollateral, estCollRatio
            },
            formDataLoading: false,
          }));
        } catch (error: any) {
          console.error(error);
          set((state) => ({
            increaseState: {
              ...state.increaseState,
              minCollRatio: ZERO, maxCollRatio: ZERO, minUnderliersToBuy: ZERO, minTokenToBuy: ZERO,
              addDebt: ZERO, redeemableUnderliers: ZERO, targetedCollRatio: ZERO,
              collateral: ZERO, collRatio: ZERO, debt: ZERO,
              estMinUnderliersToBuy: ZERO, estMinTokenToBuy: ZERO, estCollateral: ZERO, estCollRatio: ZERO
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, error.message],
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
        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            subTokenAmountStr: value
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
        set((state) => ({
          decreaseState: { ...state.decreaseState, collateralSlippagePctStr: value },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          decreaseState: { ...state.decreaseState, underlierSlippagePctStr: value },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterDecrease: debounce(async function (fiat: any, modifyPositionData: any) {
        const { collateralType, position } = modifyPositionData;
        const { 
          properties: { tokenScale, underlierScale, maturity },
          settings: { codex: { debtFloor }, collybus: { liquidationRatio } },
          state: { codex: { virtualRate: rate }, collybus: { fairPrice }, publican: { interestPerSecond }  }
        } = collateralType;
        const { subTokenAmountStr, collateralSlippagePctStr, underlierSlippagePctStr } = get().decreaseState;
        let { targetedCollRatio } = get().decreaseState;

        // reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // convert user inputs from strings to BigNumbers
          const subTokenAmount = (subTokenAmountStr === null || subTokenAmountStr === '')
            ? ZERO : decToScale(subTokenAmountStr, tokenScale);
          const collSlippageCeiled = (Number(collateralSlippagePctStr) < 0)
            ? 0 : (Number(collateralSlippagePctStr) > 50) ? 50 : Number(collateralSlippagePctStr);
          const collateralSlippagePct = decToWad(collSlippageCeiled / 100);
          const underlierSlippageCeiled = (Number(underlierSlippagePctStr) < 0)
            ? 0 : (Number(underlierSlippagePctStr) > 50) ? 50 : Number(underlierSlippagePctStr);
          const underlierSlippagePct = decToWad(underlierSlippageCeiled / 100);
          
          // set the initial value for targetCollRatio to the current collRatio
          const currentCollRatio = computeCollateralizationRatio(
            position.collateral, fairPrice, position.normalDebt, rate
          );
          if (targetedCollRatio.isZero()) targetedCollRatio = currentCollRatio
          
          // calculate the resulting collateral amount given the amount of collateral to remove
          const collateral = position.collateral.sub(scaleToWad(subTokenAmount, tokenScale));
          if (collateral.lt(0)) throw new Error('Can\'t withdraw more collateral than there is deposited');
          if (collateral.isZero(0) && subTokenAmount.isZero())
            throw new Error('Collateral is zero. Can\'t withdraw more collateral.');

          // calculate the required flashloan given the amount of collateral to remove and the targeted coll. ratio
          const flashloan = computeFlashloanForLeveredWithdrawal(
            position.collateral,
            position.normalDebt,
            rate,
            fairPrice,
            scaleToWad(subTokenAmount, tokenScale),
            targetedCollRatio
          );
          const subDebt = flashloan;
          const subNormalDebt = debtToNormalDebt(subDebt, rate);
          const debt = normalDebtToDebt(position.normalDebt, rate).sub(subDebt);
          const normalDebt = position.normalDebt.sub(subNormalDebt);

          // calculate lower bound output amounts via the exchanges rate with price impact and slippage
          const underliersOut = await userActions.collateralTokenToUnderlier(fiat, subTokenAmount, collateralType);
          const collateralToUnderlierRateWithSlippage = applySwapSlippage(
            underliersOut.mul(tokenScale).div(subTokenAmount).mul(tokenScale).div(underlierScale),
            collateralSlippagePct
          );
          const underliersIn = await userActions.fiatForUnderlier(fiat, flashloan, collateralType);
          const fiatForUnderlierRateWithSlippage = applySwapSlippage(
            underliersIn.mul(underlierScale).div(wadToScale(flashloan, underlierScale)),
            underlierSlippagePct.mul(-1) // apply positive slippage for max. == worsed price
          );
          // calculate the amount of underliers to receive in exchange for the collateral to remove
          const minUnderliersToBuy = subTokenAmount.mul(collateralToUnderlierRateWithSlippage).div(tokenScale);
          // calculate the amount of underliers required to repay the flashloan
          let maxUnderliersToSell = flashloan.mul(fiatForUnderlierRateWithSlippage).div(WAD);
          // applied slippage might cause maxUnderliersToSell to be greater than minUnderliersToBuy
          if (maxUnderliersToSell.gt(minUnderliersToBuy)) maxUnderliersToSell = minUnderliersToBuy;
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          // calculate the net. redeemable underlier amount at maturity
          const borrowFees = normalDebt.mul(
            interestPerSecondToInterestToMaturity(interestPerSecond, getTimestamp(), maturity).sub(WAD)
          ).div(WAD); // assuming 1:1 exchanges rates upon maturity for FIAT : Underlier : Collateral Asset
          const redeemableUnderliers = wadToScale(estimatedUnderlierForLeveredWithdrawal(
            collateral,
            WAD,
            WAD,
            debt.add(borrowFees)
          ), underlierScale);

          // compute the lower and upper bounds for the possible collateralization ratio
          let minCollRatio = minCollRatioWithBuffer(minCRForLeveredWithdrawal(
            position.collateral,
            position.normalDebt,
            fairPrice,
            rate,
            scaleToWad(subTokenAmount, tokenScale), liquidationRatio
          ));
          if (minCollRatio.gt(currentCollRatio)) minCollRatio = currentCollRatio;
          // limited by how much debt can be payed back
          let maxSubNormalDebt = debtToNormalDebt(
            await userActions.underlierToFIAT(fiat, underliersOut, collateralType), rate
          );
          if (maxSubNormalDebt.gt(position.normalDebt)) maxSubNormalDebt = position.normalDebt;
          let maxCollRatio = maxCollRatioWithBuffer(maxCRForLeveredWithdrawal(
            position.collateral,
            position.normalDebt,
            fairPrice,
            rate,
            scaleToWad(subTokenAmount, tokenScale),
            maxSubNormalDebt,
            liquidationRatio
          ));
          if (maxCollRatio.lt(minCollRatio)) maxCollRatio = minCollRatio;
          if (maxCollRatio.lt(currentCollRatio)) maxCollRatio = currentCollRatio;

          // check that the resulting debt is either zero or above the debt floor
          if (debt.gt(ZERO) && debt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          // check that the resulting collateralization ratio is within the lower and upper bounds
          if (debt.gt(0) && collRatio.lt(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be greater than ${floor2(wadToDec(minCollRatio.mul(100)))}%`
            ]
          }));
          if (debt.gt(0) && collRatio.gt(maxCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be less than ${floor2(wadToDec(maxCollRatio.mul(100)))}%`
            ]
          }));

          set((state) => ({
            decreaseState: {
              ...state.decreaseState,
              minCollRatio, maxCollRatio, maxUnderliersToSell, minUnderliersToBuy, targetedCollRatio,
              subDebt, redeemableUnderliers,
              collateral, collRatio, debt
            },
            formDataLoading: false
          }));
        } catch (error: any) {
          console.error(error);
          set((state) => ({
            decreaseState: {
              ...state.decreaseState,
              minCollRatio: ZERO, maxCollRatio: ZERO, maxUnderliersToSell: ZERO, minUnderliersToBuy: ZERO,
              subDebt: ZERO, redeemableUnderliers: ZERO, targetedCollRatio: ZERO,
              collateral: ZERO, collRatio: ZERO, debt: ZERO
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, error.message],
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
        set((state) => ({
          redeemState: { ...state.redeemState, subTokenAmountStr: value },
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

      setUnderlierSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          redeemState: { ...state.redeemState, underlierSlippagePctStr: value },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterRedeem: debounce(async (fiat: any, modifyPositionData: any) => {
        const { collateralType, position } = modifyPositionData;
        const { 
          properties: { tokenScale, underlierScale },
          settings: { codex: { debtFloor }, collybus: { liquidationRatio } },
          state: { codex: { virtualRate: rate }, collybus: { fairPrice } }
        } = collateralType;
        const { subTokenAmountStr, underlierSlippagePctStr } = get().redeemState;
        let { targetedCollRatio } = get().redeemState;

        // reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // convert user inputs from strings to BigNumbers
          const subTokenAmount = (subTokenAmountStr === null || subTokenAmountStr === '')
            ? ZERO : decToScale(subTokenAmountStr, tokenScale);
          const underlierSlippageCeiled = (Number(underlierSlippagePctStr) < 0)
            ? 0 : (Number(underlierSlippagePctStr) > 50) ? 50 : Number(underlierSlippagePctStr);
          const underlierSlippagePct = decToWad(underlierSlippageCeiled / 100);

          // set the initial value for targetCollRatio to the current collRatio
          const currentCollRatio = computeCollateralizationRatio(
            position.collateral, fairPrice, position.normalDebt, rate
          );
          if (targetedCollRatio.isZero()) targetedCollRatio = currentCollRatio
    
          // calculate the resulting collateral amount given the amount of collateral to remove
          const collateral = position.collateral.sub(scaleToWad(subTokenAmount, tokenScale));
          if (collateral.lt(0)) throw new Error('Can\'t withdraw more collateral than there is deposited');
          if (collateral.isZero(0) && subTokenAmount.isZero())
            throw new Error('Collateral is zero. Can\'t withdraw more collateral.');

          // calculate the required flashloan given the amount of collateral to remove and the targeted coll. ratio
          const flashloan = computeFlashloanForLeveredWithdrawal(
            position.collateral,
            position.normalDebt,
            rate,
            fairPrice,
            scaleToWad(subTokenAmount, tokenScale),
            targetedCollRatio
          );
          const subDebt = flashloan;
          const subNormalDebt = debtToNormalDebt(subDebt, rate);
          const debt = normalDebtToDebt(position.normalDebt, rate).sub(subDebt);
          const normalDebt = position.normalDebt.sub(subNormalDebt);

          // calculate lower bound output amounts via the exchanges rate with price impact and slippage
          // Note: assuming 1 to 1 redemption rate
          const underliersOut = subTokenAmount.mul(underlierScale).div(tokenScale);
          const collateralToUnderlierRate = underliersOut.mul(tokenScale)
            .div(subTokenAmount).mul(tokenScale).div(underlierScale);
          const underliersIn = await userActions.fiatForUnderlier(fiat, flashloan, collateralType);
          const fiatForUnderlierRateWithSlippage = applySwapSlippage(
            underliersIn.mul(underlierScale).div(wadToScale(flashloan, underlierScale)),
            underlierSlippagePct.mul(-1) // apply positive slippage for max. == worsed price
          );
                    
          // calculate the net. redeemable underlier amount
          const underliersToRedeem = subTokenAmount.mul(collateralToUnderlierRate).div(tokenScale);
          let maxUnderliersToSell = flashloan.mul(fiatForUnderlierRateWithSlippage).div(WAD);
          // slippage might cause maxUnderliersToSell to be greater than minUnderliersToBuy
          if (maxUnderliersToSell.gt(underliersToRedeem)) maxUnderliersToSell = underliersToRedeem;
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          // compute the lower and upper bounds for the possible collateralization ratio
          let minCollRatio = minCollRatioWithBuffer(minCRForLeveredWithdrawal(
            position.collateral,
            position.normalDebt,
            fairPrice,
            rate,
            scaleToWad(subTokenAmount, tokenScale), liquidationRatio
          ));
          if (minCollRatio.lt(minCollRatioWithBuffer(liquidationRatio)))
            minCollRatio = minCollRatioWithBuffer(liquidationRatio);
          if (minCollRatio.gt(currentCollRatio)) minCollRatio = currentCollRatio;
          const maxSubDebt = await userActions.underlierToFIAT(fiat, underliersOut, collateralType);
          let maxCollRatio = computeCollateralizationRatio(
            collateral, fairPrice, position.normalDebt.sub(debtToNormalDebt(maxSubDebt, rate)), rate
          );
          if (maxCollRatio.lt(minCollRatio)) maxCollRatio = minCollRatio;
          if (maxCollRatio.lt(currentCollRatio)) maxCollRatio = currentCollRatio;

          // check that the resulting debt is either zero or above the debt floor
          if (debt.gt(ZERO) && debt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          // check that the resulting collateralization ratio is within the lower and upper bounds
          if (debt.gt(0) && collRatio.lt(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be greater than ${floor2(wadToDec(minCollRatio.mul(100)))}%`
            ]
          }));
          if (debt.gt(0) && collRatio.gt(maxCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, `Collateralization Ratio has to be less than ${floor2(wadToDec(maxCollRatio.mul(100)))}%`
            ]
          }));

          set((state) => ({
            redeemState: {
              ...state.redeemState,
              minCollRatio, maxCollRatio, maxUnderliersToSell, underliersToRedeem,
              subDebt, targetedCollRatio,
              collateral, collRatio, debt
            },
            formDataLoading: false
          }));
        } catch (error: any) {
          console.error(error);
          set((state) => ({
            redeemState: {
              ...state.redeemState,
              minCollRatio: ZERO, maxCollRatio: ZERO, maxUnderliersToSell: ZERO, minUnderliersToBuy: ZERO,
              subDebt: ZERO, targetedCollRatio: ZERO,
              collateral: ZERO, collRatio: ZERO, debt: ZERO
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, error.message],
          }));
        }
      }),
    },
  }));
