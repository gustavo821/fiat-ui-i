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

if [ -z "$NEXT_PUBLIC_FORK_FAUCET_ACCOUNT" ]; then
  echo "NEXT_PUBLIC_FORK_FAUCET_ACCOUNT is undefined in .env";
  exit 1;
fi

cmd="npx ganache \
  --fork.url=https://eth-mainnet.alchemyapi.io/v2/$NEXT_PUBLIC_ALCHEMY_API_KEY \
  --miner.defaultGasPrice 30000000000 \
  --chain.vmErrorsOnRPCResponse=true \
  --wallet.unlockedAccounts=$NEXT_PUBLIC_FORK_FAUCET_ACCOUNT "

eval $cmd