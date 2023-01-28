/// A script for trasnferring tokens from whales into your own account
/// when running a local mainnet fork with ganache.
/// Requires a impersonating the whale accounts with `ganache --wallet.unlockedAccounts="<address_to_impersonate>"`
/// See example of unlocking multiple accounts in the `run-testnet.sh` script

/* eslint-disable @typescript-eslint/no-var-requires */
const ethers = require('ethers');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const USE_GANACHE = process.env.NEXT_PUBLIC_GANACHE_FORK === 'true';
const USE_TENDERLY = process.env.NEXT_PUBLIC_TENDERLY_FORK === 'true';
const USE_FORK = USE_GANACHE || USE_TENDERLY;

if (!USE_FORK) {
  throw new Error('Configure .env to use tenderly or ganache');
}

(async () => {
  /// Steal tokens from a whale
  /// Any address to steal tokens from must be unlocked. See docstring at top of file
  const stealWhaleTokens = async (whaleSigner, toAddress, tokenContract, amount) => {
    const tokenSymbol = await tokenContract.symbol()
    console.log(`Transferring ${tokenSymbol} tokens to address: `, toAddress)
    const connectedTokContract = await tokenContract.connect(whaleSigner)
    console.log('Connected to contract!')

    const tokenDecimals = await connectedTokContract.decimals()
    const exp = ethers.BigNumber.from(10).pow(tokenDecimals)
    const bnAmount = ethers.BigNumber.from(amount).mul(exp)
    console.log('Transferring...')
    await connectedTokContract.transfer(toAddress, bnAmount)

    console.log(
      `Success! Your ${tokenSymbol} balance is now: ${(
        await connectedTokContract.balanceOf(toAddress)
      )
        .div(exp)
        .toString()}\n`,
    )
  }

  const toAddress = process.env.NEXT_PUBLIC_IMPERSONATE_ACCOUNT;
  const whaleAddress = process.env.NEXT_PUBLIC_FORK_FAUCET_ACCOUNT;
  const fiatHolderAddress = process.env.NEXT_PUBLIC_FORK_FIAT_FAUCET_ACCOUNT;

  const url = USE_GANACHE ? 'http://127.0.0.1:8545' : `https://rpc.tenderly.co/fork/${process.env.NEXT_PUBLIC_TENDERLY_RPC_API_KEY}`;
  const erc20Abi = JSON.parse(fs.readFileSync('./scripts/erc20.json'))
  const provider = new ethers.providers.JsonRpcProvider(url)
  try {
    const fiatBalancerSigner = provider.getSigner(fiatHolderAddress)
    const mainnetFIATAddress = '0x586Aa273F262909EEF8fA02d90Ab65F5015e0516'
    const fiatToken = new ethers.Contract(mainnetFIATAddress, erc20Abi, provider)
    await stealWhaleTokens(fiatBalancerSigner, toAddress, fiatToken, 5000)

    const usdcWhaleSigner = provider.getSigner(whaleAddress)
    const mainnetUSDCAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    const usdcToken = new ethers.Contract(mainnetUSDCAddress, erc20Abi, provider)
    await stealWhaleTokens(usdcWhaleSigner, toAddress, usdcToken, 10000)

    const daiWhaleSigner = provider.getSigner(whaleAddress)
    const mainnetDaiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    const daiToken = new ethers.Contract(mainnetDaiAddress, erc20Abi, provider)
    await stealWhaleTokens(daiWhaleSigner, toAddress, daiToken, 10000)

  } catch (e) {
    console.error('Error stealing tokens', e)
  }
})()
