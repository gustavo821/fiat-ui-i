import { decToScale, decToWad } from '@fiatdao/sdk';
import 'antd/dist/antd.css';
import { ethers } from 'ethers';
import create from 'zustand';

import { floor4 } from '../utils';

interface FormState {
  fiatSdk: any;
  underlier: ethers.BigNumber;
  slippagePct: ethers.BigNumber;
  targetedHealthFactor: ethers.BigNumber;
  deltaCollateral: ethers.BigNumber;
}

interface FormActions {
  setFiatSdk: any;
  setUnderlier: (value: string, underlierScale: ethers.BigNumber) => void;
  setSlippage: (value: string) => void;
  setTargetedHealthFactor: (value: number) => void;
  setDeltaCollateral: (value: string) => void;
  // TODO: maybe have an event listener that calls a set network action, that updates the provider in the store?
  // but i don't WANT provider in the store and in wagmi hooks, i want to reuse the wagmi hook provider
  // without recreating the ENTIRE FUCKING STORW
}

const initialState = {
  fiatSdk: null,
  underlier: ethers.constants.Zero,
  slippagePct: decToWad('0.001'),
  targetedHealthFactor: decToWad('1.2'),
  deltaCollateral: ethers.constants.Zero,
};

export const useModifyPositionFormDataStore = create<FormState & FormActions>()(
  (set, get) => ({
    ...initialState,

    setFiatSdk: (fiatSdk: any) => {
      set(() => ({ fiatSdk }));
    },

    setUnderlier: async (value, underlierScale) => {
      const bnAmount =
        value === null || value === ''
          ? initialState.underlier
          : decToScale(
              floor4(Number(value) < 0 ? 0 : Number(value)),
              underlierScale
            );
      set(() => ({ underlier: bnAmount }));

      // const fiatSdk = get().fiatSdk;

      // const tokensOut = await fiatSdk.call(
      //   vaultEPTActions,
      //   'underlierToPToken',
      //   vault,
      //   balancer,
      //   pool,
      //   underlier
      // );

      // note that delta collat for creating position is just the value
      // but for manage position have to add collateral in position
      // setDeltaCollateral();
    },

    setSlippage: (value) => {
      let newSlippage: ethers.BigNumber;
      if (value === null || value === '') {
        newSlippage = initialState.slippagePct;
      } else {
        const ceiled =
          Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
        newSlippage = decToWad(floor4(ceiled / 100));
      }
      set(() => ({ slippagePct: newSlippage }));
    },

    setTargetedHealthFactor: (value) => {
      set(() => ({ targetedHealthFactor: decToWad(String(value)) }));
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
