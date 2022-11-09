import { decToWad, scaleToWad, WAD, wadToScale } from '@fiatdao/sdk';

export const getEarnableRate = async (fiat: any, collateralTypesData: any) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } = fiat.getContracts();
  const queries = collateralTypesData.flatMap((collateralTypeData: any) => {
    const { properties } = collateralTypeData;
    const { vault, tokenId, vaultType, tokenScale, underlierScale, maturity } = properties;
    if (new Date() >= new Date(Number(maturity.toString()) * 1000)) return [];
    switch (vaultType) {
      case 'ERC20:EPT': {
        if (!properties.eptData) return console.error('Missing EPT data');
        const { balancerVault, poolId } = properties.eptData;
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultEPTActions, method: 'underlierToPToken', args: [vault, balancerVault, poolId, underlierScale]
          }
        };
      }
      case 'ERC1155:FC': {
        if (!properties.fcData) return console.error('Missing FC data');
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultFCActions, method: 'underlierToFCash', args: [tokenId, underlierScale]
          }
        };
      }
      case 'ERC20:FY': {
        if (!properties.fyData) return console.error('Missing FY data');
        const { yieldSpacePool } = properties.fyData;
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultFYActions, method: 'underlierToFYToken', args: [underlierScale, yieldSpacePool]
          }
        };
      }
      default: {
        throw new Error('Unsupported vault type: ', properties.vaultType);
      }
    }
  });
  const results = await fiat.multicall(queries.map((query: any) => query.call));
  return results.map((result: any, index: number) => {
    return {
      vault: queries[index].vault, earnableRate: scaleToWad(result, queries[index].tokenScale).sub(WAD)
    };
  });
};

export const buyCollateralAndModifyDebt = async (
  contextData: any,
  // TODO avoid null checks on properties.<vaultName>Data with a typecheck here
  collateralTypeData: any,
  modifyPositionFormData: any
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(modifyPositionFormData.deltaDebt, collateralTypeData.state.codex.virtualRate)
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(modifyPositionFormData.deltaCollateral, properties.tokenScale);

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      const deadline = Math.round(+new Date() / 1000) + 3600;

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultEPTActions,
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          modifyPositionFormData.underlier,
          normalDebt,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.underlierToken,
            properties.token,
            tokenAmount,
            deadline,
            modifyPositionFormData.underlier,
          ]
        )
      );
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      // 1 - (underlier / deltaCollateral)
      const minLendRate = wadToScale(
        WAD.sub(
          scaleToWad(modifyPositionFormData.underlier, properties.underlierScale)
          .mul(WAD)
          .div(modifyPositionFormData.deltaCollateral)
        ),
        properties.tokenScale
      );

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultFCActions,
          'buyCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          properties.tokenId,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt,
          minLendRate,
          modifyPositionFormData.underlier
        )
      );
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultFYActions,
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt,
          [
            modifyPositionFormData.underlier,
            properties.fyData.yieldSpacePool,
            properties.token,
            properties.underlierToken,
          ]
        )
      );
      break;
    }

    default: {
      console.error('Unsupported vault: ', properties.vaultType);
    }
  }
};

export const sellCollateralAndModifyDebt = async (
  contextData: any,
  collateralTypeData: any,
  modifyPositionFormData: any
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      modifyPositionFormData.deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    modifyPositionFormData.deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      const deadline = Math.round(+new Date() / 1000) + 3600;

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultEPTActions,
          'sellCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.token,
            properties.underlierToken,
            modifyPositionFormData.underlier,
            deadline,
            tokenAmount,
          ]
        )
      );
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      const maxBorrowRate = wadToScale(
        WAD.sub(
          modifyPositionFormData.deltaCollateral
            .mul(WAD)
            .div(
              scaleToWad(
                modifyPositionFormData.underlier,
                properties.underlierScale
              )
            )
        ),
        properties.tokenScale
      );

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultFCActions,
          'sellCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          properties.tokenId,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt,
          maxBorrowRate
        )
      );
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultFYActions,
          'sellCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt,
          [
            modifyPositionFormData.underlier,
            properties.fyData.yieldSpacePool,
            properties.token,
            properties.underlierToken,
          ]
        )
      );
      break;
    }

    default: {
      console.error('Unsupported vault: ', properties.vaultType);
    }
  }
};

export const redeemCollateralAndModifyDebt = async (
  contextData: any,
  collateralTypeData: any,
  modifyPositionFormData: any
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      modifyPositionFormData.deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    modifyPositionFormData.deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultEPTActions,
          'redeemCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt
        )
      );
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultFCActions,
          'redeemCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          properties.tokenId,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt
        )
      );
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultFYActions,
          'redeemCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          normalDebt
        )
      );
      break;
    }

    default: {
      console.error('Unsupported vault: ', properties.vaultType);
    }
  }
};

// TODO: maybe implement? or just delete it - underlier actions only is kinda nice
// export const modifyCollateralAndDebt = async (
//   contextData: any,
//   collateralTypeData: any,
//   modifyPositionFormData: any
// ) => {
//   const { vaultEPTActions, vaultFCActions, vaultFYActions } =
//     contextData.fiat.getContracts();
//   const { properties } = collateralTypeData;

//   const normalDebt = contextData.fiat
//     .debtToNormalDebt(
//       modifyPositionFormData.deltaDebt,
//       collateralTypeData.state.codex.virtualRate
//     )
//     .mul(WAD.sub(decToWad(0.001)))
//     .div(WAD);
//   const tokenAmount = wadToScale(
//     modifyPositionFormData.deltaCollateral,
//     properties.tokenScale
//   );

//   switch (properties.vaultType) {
//     case 'ERC20:EPT': {
//       if (!properties.eptData) {
//         console.error('Missing EPT data');
//         return;
//       }
//       break;
//     }

//     case 'ERC1155:FC': {
//       if (!properties.fcData) {
//         console.error('Missing FC data');
//         return;
//       }
//       break;
//     }

//     case 'ERC20:FY': {
//       if (!properties.fyData) {
//         console.error('Missing FY data');
//         return;
//       }
//       break;
//     }

//     default: {
//       console.error('Unsupported vault: ', properties.vaultType);
//     }
//   }
// };
