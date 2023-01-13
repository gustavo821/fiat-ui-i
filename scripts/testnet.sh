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

cmd="ganache \
	--wallet.accounts="0x$PRIVATE_KEY,1000000000000000000000" \
	--fork.url=https://eth-mainnet.alchemyapi.io/v2/$NEXT_PUBLIC_ALCHEMY_API_KEY \
	--miner.defaultGasPrice 30000000000 \
	--chain.vmErrorsOnRPCResponse=true \
  --wallet.unlockedAccounts=0xCFFAd3200574698b78f32232aa9D63eABD290703 \
  --wallet.unlockedAccounts=0x16b34ce9a6a6f7fc2dd25ba59bf7308e7b38e186"

eval $cmd