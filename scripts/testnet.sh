#!/usr/bin/env bash
set -o errexit

if [ -f .env ]; then
  set -o allexport; source .env; set +o allexport
fi

if [ -f .env.local ]; then
  set -o allexport; source .env.local; set +o allexport
fi

if [ -z "$NEXT_PUBLIC_ALCHEMY_API_KEY" ]; then
  echo "NEXT_PUBLIC_ALCHEMY_API_KEY is undefined in .env";
  exit 1;
fi

# hardcoded unlocked accounts hold USDC, DAI and ETH necessary for testing on mainnet
cmd="npx ganache \
	--fork.url=https://eth-mainnet.alchemyapi.io/v2/$NEXT_PUBLIC_ALCHEMY_API_KEY \
	--miner.defaultGasPrice 30000000000 \
	--chain.vmErrorsOnRPCResponse=true \
  --wallet.unlockedAccounts=0xCFFAd3200574698b78f32232aa9D63eABD290703 \
  --wallet.unlockedAccounts=0x16b34ce9a6a6f7fc2dd25ba59bf7308e7b38e186 \
  --wallet.unlockedAccounts=0xF1A7dA08F6cb83069817d2D8F6e55E4F2D6C0834 "

eval $cmd