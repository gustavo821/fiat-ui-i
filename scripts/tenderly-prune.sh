#!/usr/bin/env bash
set -o errexit

if [ -f .env ]; then
  set -o allexport; source .env; set +o allexport
fi

if [ -f .env.local ]; then
  set -o allexport; source .env.local; set +o allexport
fi

if [ -z "$NEXT_PUBLIC_TENDERLY_SIM_API_KEY" ]; then
  echo "NEXT_PUBLIC_TENDERLY_SIM_API_KEY is undefined in .env";
  exit 1;
fi

if [ -z "$NEXT_PUBLIC_TENDERLY_USER" ]; then
  echo "NEXT_PUBLIC_TENDERLY_USER is undefined in .env";
  exit 1;
fi

if [ -z "$NEXT_PUBLIC_TENDERLY_PROJECT" ]; then
  echo "NEXT_PUBLIC_TENDERLY_PROJECT is undefined in .env";
  exit 1;
fi

forks=$(curl \
  -X GET "https://api.tenderly.co/api/v1/account/$NEXT_PUBLIC_TENDERLY_USER/project/$NEXT_PUBLIC_TENDERLY_PROJECT/forks?page=1&perPage=100" \
  -H "X-Access-Key: $NEXT_PUBLIC_TENDERLY_SIM_API_KEY"
)

# delete all forks besides the fixed ones
FORK_1=92d51780-16ec-408a-95cb-36c98392980d
FORK_2=0c027a03-bad7-45da-8f9f-c681f11ffded
FORK_3=bac3644f-cf54-44d1-a419-23cd144aac5e

for id in $(echo "$forks" \
  | jq ".simulation_forks[] | select( .id != \"$FORK_1\" and .id != \"$FORK_2\" and .id != \"$FORK_3\" )" \
  | jq '.id'
); do
  curl \
    -X DELETE "https://api.tenderly.co/api/v1/account/$NEXT_PUBLIC_TENDERLY_USER/project/$NEXT_PUBLIC_TENDERLY_PROJECT/fork/$(echo $id | tr -d '"')" \
    -H "X-Access-Key: $NEXT_PUBLIC_TENDERLY_SIM_API_KEY"
done
