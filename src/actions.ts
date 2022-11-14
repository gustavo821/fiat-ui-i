import { decToWad, scaleToWad, WAD, wadToScale, ZERO } from '@fiatdao/sdk';
import { ethers } from 'ethers';

export const underlierToCollateralToken = async (fiat: any,
  underlier: ethers.BigNumber,
  collateralType: any): Promise<ethers.BigNumber> => {
  if (!underlier.gt(ZERO)) return ZERO;
  const { vault, tokenId, vaultType } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
  switch (vaultType) {
    case 'ERC20:EPT': {
      if (collateralType.properties.eptData == undefined) throw new Error('Missing EPT data');
      const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
      return await fiat.call(
        vaultEPTActions,
        'underlierToPToken',
        vault,
        balancer,
        pool,
        underlier
      );
    }
    case 'ERC1155:FC': {
      if (collateralType.properties.fcData == undefined) throw new Error('Missing FC data');
      return await fiat.call(
        vaultFCActions,
        'underlierToFCash',
        tokenId,
        underlier
      );
    }
    case 'ERC20:FY': {
      if (collateralType.properties.fyData == undefined) throw new Error('Missing FY data');
      const { fyData: { yieldSpacePool } } = collateralType.properties;
      return await fiat.call(
        vaultFYActions,
        'underlierToFYToken',
        underlier,
        yieldSpacePool
      );
    }
    case 'ERC20:SPT': {
      if (collateralType.properties.sptData == undefined) throw new Error('Missing SPT data');
      const { sptData: { spacePool, balancerVault } } = collateralType.properties;
      return await fiat.call(
        vaultSPTActions,
        'underlierToPToken',
        spacePool,
        balancerVault,
        underlier
      );
    }
    default: {
      throw new Error('Unsupported collateral type');
    }
  }
};

export const collateralTokenToUnderlier = async (fiat: any,
  collateral: ethers.BigNumber,
  collateralType: any): Promise<ethers.BigNumber> => {
  if (collateral.gt(ZERO)) return ZERO;
  const { vault, tokenId, vaultType } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();

  switch (vaultType) {
    case 'ERC20:EPT': {
      if (collateralType.properties.eptData == undefined) throw new Error('Missing EPT data');
      const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
      return await fiat.call(
        vaultEPTActions,
        'pTokenToUnderlier',
        vault,
        balancer,
        pool,
        collateral
      );
    }
    case 'ERC1155:FC': {
      if (collateralType.properties.fcData == undefined) throw new Error('Missing FC data');
      return await fiat.call(
        vaultFCActions,
        'fCashToUnderlier',
        tokenId,
        collateral
      );
    }
    case 'ERC20:FY': {
      if (collateralType.properties.fyData == undefined) throw new Error('Missing FY data');
      const { fyData: { yieldSpacePool } } = collateralType.properties;
      return await fiat.call(
        vaultFYActions,
        'fyTokenToUnderlier',
        collateral,
        yieldSpacePool
      );
    }
    case 'ERC20:SPT': {
      if (collateralType.properties.sptData == undefined) throw new Error('Missing SPT data');
      const { sptData: { spacePool, balancerVault } } = collateralType.properties;
      return await fiat.call(
        vaultSPTActions,
        'pTokenToUnderlier',
        spacePool,
        balancerVault,
        collateral
      );
    }
    default:
      throw new Error('Unsupported collateral type');
  }
};

export const getEarnableRate = async (fiat: any, collateralTypesData: any) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
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
      case 'ERC20:SPT': {
        if (!properties.sptData) return console.error('Missing SPT data');
        const { spacePool, balancerVault } = properties.sptData;
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultSPTActions, method: 'underlierToPToken', args: [spacePool, balancerVault, underlierScale]
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

export const modifyCollateralAndDebt = async (
  contextData: any,
  collateralTypeData: any,
  deltaDebt: ethers.BigNumber,
  position: { collateral: ethers.BigNumber, normalDebt: ethers.BigNumber }
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  let deltaNormalDebt = contextData.fiat
    .debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate)
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  if (position.normalDebt.sub(deltaNormalDebt).lt(WAD)) deltaNormalDebt = position.normalDebt;

  // if deltaCollateral is zero use generic modifyCollateralAndDebt method since no swap is necessary
  let actions;
  if (properties.vaultType === 'EPT:20') actions = vaultEPTActions;
  if (properties.vaultType === 'FC:1155') actions = vaultFCActions;
  if (properties.vaultType === 'FY:20') actions = vaultFYActions;
  if (properties.vaultType === 'SPT:20') actions = vaultSPTActions;
  return console.log(
    await contextData.fiat.sendAndWaitViaProxy(
      contextData.proxies[0],
      actions,
      'modifyCollateralAndDebt',
      properties.vault,
      properties.tokenId,
      contextData.proxies[0],
      contextData.user,
      contextData.user,
      ZERO,
      deltaNormalDebt
    )
  );
}

export const buyCollateralAndModifyDebt = async (
  contextData: any,
  // TODO avoid null checks on properties.<vaultName>Data with a typecheck here
  collateralTypeData: any,
  deltaCollateral: ethers.BigNumber,
  deltaDebt: ethers.BigNumber,
  underlier: ethers.BigNumber
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const deltaNormalDebt = contextData.fiat
    .debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate)
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(deltaCollateral, properties.tokenScale);

  // if deltaCollateral is zero use generic modifyCollateralAndDebt method since no swap is necessary
  if (deltaCollateral.isZero()) return console.error('Invalid value for `deltaCollateral` - Value has to be non-zero');

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) return console.error('Missing EPT data');
      const deadline = Math.round(+new Date() / 1000) + 3600;
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultEPTActions,
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          underlier,
          deltaNormalDebt,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.underlierToken,
            properties.token,
            tokenAmount,
            deadline,
            underlier,
          ]
        )
      );
      break;
    }
    case 'ERC1155:FC': {
      if (!properties.fcData) return console.error('Missing FC data');
      // 1 - (underlier / deltaCollateral)
      const minLendRate = wadToScale(
        WAD.sub(scaleToWad(underlier, properties.underlierScale).mul(WAD).div(deltaCollateral)),
        properties.tokenScale
      );
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
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
          deltaNormalDebt,
          minLendRate,
          underlier
        )
      );
      break;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) return console.error('Missing FY data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultFYActions,
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          underlier,
          deltaNormalDebt,
          [
            tokenAmount,
            properties.fyData.yieldSpacePool,
            properties.underlierToken,
            properties.token
          ]
        )
      );
      break;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) return console.error('Missing SPT data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultSPTActions,
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          underlier,
          deltaNormalDebt,
          [
            properties.sptData.adapter,
            tokenAmount,
            properties.sptData.maturity,
            properties.underlierToken,
            properties.token,
            properties.underlier
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
  deltaCollateral: ethers.BigNumber,
  deltaDebt: ethers.BigNumber,
  underlier: ethers.BigNumber,
  position: { collateral: ethers.BigNumber, normalDebt: ethers.BigNumber }
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  let deltaNormalDebt = contextData.fiat
    .debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate)
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  if (position.normalDebt.sub(deltaNormalDebt).lt(WAD)) deltaNormalDebt = position.normalDebt;

  const tokenAmount = wadToScale(deltaCollateral, properties.tokenScale);

  // if deltaCollateral is zero use generic modifyCollateralAndDebt method since no swap is necessary
  if (deltaCollateral.isZero()) return console.error('Invalid value for `deltaCollateral` - Value has to be non-zero');

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) return console.error('Missing EPT data');
      const deadline = Math.round(+new Date() / 1000) + 3600;
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultEPTActions,
          'sellCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.token,
            properties.underlierToken,
            underlier,
            deadline,
            tokenAmount
          ]
        )
      );
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) return console.error('Missing FC data');
      const maxBorrowRate = wadToScale(
        WAD.sub(deltaCollateral.mul(WAD).div(scaleToWad(underlier, properties.underlierScale))),
        properties.tokenScale
      );
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
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
          deltaNormalDebt,
          maxBorrowRate
        )
      );
      break;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) return console.error('Missing FY data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultFYActions,
          'sellCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            underlier,
            properties.fyData.yieldSpacePool,
            properties.token,
            properties.underlierToken,
          ]
        )
      );
      break;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) return console.error('Missing SPT data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultSPTActions,
          'sellCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            properties.sptData.adapter,
            underlier,
            properties.sptData.maturity,
            properties.token,
            properties.underlierToken,
            properties.tokenAmount,
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

export const redeemCollateralAndModifyDebt = async (contextData: any,
  collateralTypeData: any,
  deltaCollateral: ethers.BigNumber,
  deltaDebt: ethers.BigNumber,
  position: { collateral: ethers.BigNumber, normalDebt: ethers.BigNumber }
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  let deltaNormalDebt = contextData.fiat
    .debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate)
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  if (position.normalDebt.sub(deltaNormalDebt).lt(WAD)) deltaNormalDebt = position.normalDebt;

  const tokenAmount = wadToScale(deltaCollateral, properties.tokenScale);

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) return console.error('Missing EPT data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultEPTActions,
          'redeemCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt
        )
      );
      break;
    }
    case 'ERC1155:FC': {
      if (!properties.fcData) return console.error('Missing FC data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
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
          deltaNormalDebt
        )
      );
      break;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) return console.error('Missing FY data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultFYActions,
          'redeemCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt
        )
      );
      break;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) return console.error('Missing SPT data');
      console.log(
        // await contextData.fiat.dryrunViaProxy(
        await contextData.fiat.sendAndWaitViaProxy(
          contextData.proxies[0],
          vaultSPTActions,
          'redeemCollateralAndModifyDebt',
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            properties.sptData.adapter,
            properties.sptData.maturity,
            properties.sptData.target,
            properties.underlierToken,
            tokenAmount
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
