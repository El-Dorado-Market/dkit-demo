import { useMemo, useState, type FormEvent } from 'react';
import './App.css';
import {
  createSwapKit as createDoritoKit,
  Chain,
  type TokenV2,
  type ChainWallet,
  ProviderName,
  type QuoteRequest,
  type QuoteResponse,
  type QuoteResponseRoute,
} from '@swapkit/sdk';

// #region Environment variables
const api = import.meta.env.VITE_API;
// #endregion

// #region client
const client = createDoritoKit();
// #endregion

// #region utilities
const getAssetId = ({
  chain,
  ticker,
  address,
}: Pick<Wallet, 'chain'> & Pick<TokenV2, 'address' | 'ticker'>) => {
  return chain + '.' + ticker + ((address && '-' + address) || '');
};

type Wallet = ChainWallet<Chain>;
type Wallets = Array<Wallet>;
type WalletsMap = { [K in Chain]?: Wallet };

const chains = [Chain.Base, Chain.THORChain] satisfies Array<Chain>;
// #endregion

function App() {
  // #region state
  const [assets, setAssets] = useState<Array<TokenV2>>([]);

  const [walletsMap, setWalletsMap] = useState<WalletsMap>({});
  const setWallets = (wallets: Wallets) => {
    setWalletsMap(
      wallets.reduce<WalletsMap>((newWallets, wallet) => {
        return Object.assign(newWallets, { [wallet.chain]: wallet });
      }, {}),
    );
  };
  const wallets: Wallets = useMemo(() => {
    return Object.values(walletsMap);
  }, [walletsMap]);

  const [route, setRoute] = useState<QuoteResponseRoute | null>(null);

  const [txHash, setTxHash] = useState<string | null>(null);
  const explorerUrl = useMemo(() => {
    return txHash && client.getExplorerTxUrl({ chain: Chain.Base, txHash });
  }, [txHash]);
  const xscannerUrl = useMemo(() => {
    return txHash && 'http://xscanner.org/tx/' + txHash;
  }, [txHash]);
  // #endregion

  // #region functions
  const onConnectKeystore = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const mnemonicInput =
      e.target instanceof HTMLFormElement &&
      e.target.elements.namedItem('mnemonic');
    const mnemonic =
      mnemonicInput instanceof HTMLInputElement && mnemonicInput.value.trim();
    if (!mnemonic) {
      alert('Cannot connect wallet, missing mnemonic');
      return;
    }
    client.connectKeystore(chains, mnemonic).then(() => {
      setWallets(
        chains.map((chain) => {
          return client.getWallet(chain);
        }),
      );
    });
  };

  const onFetchAssets = () => {
    return fetch(api + '/tokens?provider=' + ProviderName.THORCHAIN)
      .then((res) => {
        return res.json();
      })
      .then(({ tokens }) => {
        return setAssets(tokens);
      });
  };

  const onFetchBalances = () => {
    return Promise.all(
      chains.map((chain) => {
        return client.getWalletWithBalance(chain);
      }),
    ).then((walletsWithBalance) => {
      setWallets(walletsWithBalance);
    });
  };

  const onFetchQuote = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sellAssetSelect =
      e.target instanceof HTMLFormElement &&
      e.target.elements.namedItem('sell-asset');
    const sellAsset =
      sellAssetSelect instanceof HTMLSelectElement && sellAssetSelect.value;
    if (!sellAsset) {
      alert('Please select sell asset');
      return;
    }
    const buyAssetSelect =
      e.target instanceof HTMLFormElement &&
      e.target.elements.namedItem('buy-asset');
    const buyAsset =
      buyAssetSelect instanceof HTMLSelectElement && buyAssetSelect.value;
    if (!buyAsset) {
      alert('Please select buy asset');
      return;
    }
    const sellAmountInput =
      e.target instanceof HTMLFormElement &&
      e.target.elements.namedItem('sell-amount');
    const sellAmount =
      sellAmountInput instanceof HTMLInputElement &&
      Number.parseFloat(sellAmountInput.value);
    if (!sellAmount || Number.isNaN(sellAmount) || sellAmount <= 0) {
      alert('Please enter a valid sell amount');
      return;
    }
    const sourceAddress = walletsMap[Chain.Base]?.address;
    if (!sourceAddress) {
      alert('Please connect Base wallet');
      return;
    }
    const destinationAddress = walletsMap[Chain.THORChain]?.address;
    if (!destinationAddress) {
      alert('Please connect Thor wallet');
      return;
    }
    const quoteRequest = {
      buyAsset,
      destinationAddress,
      includeTx: true,
      sellAmount: sellAmount.toString(),
      sellAsset,
      sourceAddress,
    } satisfies QuoteRequest;
    return fetch(api + '/quote', {
      body: JSON.stringify(quoteRequest),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
      .then((res) => {
        return res.json();
      })
      .then((quote: QuoteResponse) => {
        const route = quote.routes.find((route) => {
          return route.providers.at(0) === ProviderName.THORCHAIN;
        });
        if (!route) {
          alert('No route found for the selected assets');
          return;
        }
        return setRoute(route);
      });
  };

  const onSwap = () => {
    if (!route) {
      alert('Missing route, please fetch quote first');
      return;
    }
    return client.swap({ route }).then(setTxHash);
  };
  // #endregion

  return (
    <div>
      <h1>Getting started with dKiT using Keystore</h1>
      <section>
        <h2>Connect wallet to see addresses</h2>
        <form
          onSubmit={onConnectKeystore}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <label htmlFor="mnemonic">
            Mnemonic phrase as a space separated list of words
          </label>
          <input
            id="mnemonic"
            type="password"
            placeholder="cloud river stone apple breeze shadow leaf ocean spark flame hill dream"
          />
          <input type="submit" value="Connect Keystore" />
        </form>
        <ul>
          {wallets.map((wallet) => {
            return (
              <li key={wallet.chain}>
                {wallet.chain}: {wallet.address}
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h2>Fetch balances to see asset value</h2>
        <button onClick={onFetchBalances} type="button">
          Fetch balances
        </button>
        <ul>
          {wallets.map((wallet) => {
            return (
              <li key={wallet.chain}>
                <h3>{wallet.chain}</h3>
                <ul>
                  {wallet.balance.map((balance) => {
                    const id = getAssetId({
                      address: balance.address,
                      chain: wallet.chain,
                      ticker: balance.ticker,
                    });
                    return (
                      <li key={id}>
                        {id}: {balance.getValue('string')}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <h2>Fetch assets to get expected buy amount via Thorchain</h2>
        <button onClick={onFetchAssets} type="button">
          Fetch assets
        </button>
        <form
          onSubmit={onFetchQuote}
          style={{
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center',
          }}
        >
          <label htmlFor="sell-asset">Sell Asset</label>
          <select id="sell-asset">
            <option value="">No asset selected</option>
            {assets.map((asset) => {
              return (
                <option key={asset.identifier} value={asset.identifier}>
                  {asset.identifier}
                </option>
              );
            })}
          </select>
          <label htmlFor="buy-asset">Buy Asset</label>
          <select id="buy-asset">
            <option value="">No asset selected</option>
            {assets.map((asset) => {
              return (
                <option key={asset.identifier} value={asset.identifier}>
                  {asset.identifier}
                </option>
              );
            })}
          </select>
          <label htmlFor="sell-amount">Sell Amount</label>
          <input
            id="sell-amount"
            type="number"
            placeholder="1"
            min={0}
            step="any"
          />
          <input type="submit" value="Get Quote" />
        </form>
        <p>Expected buy amount: {route?.expectedBuyAmount}</p>
      </section>
      <section>
        <h2>Swap to get inbound transaction hash</h2>
        <button onClick={onSwap} type="button">
          Swap
        </button>
        <div>
          <h3>Inbound transaction hash</h3>
          {explorerUrl && <a href={explorerUrl}>{explorerUrl}</a>}
        </div>
        <div>
          <h3>Xscanner</h3>{' '}
          {xscannerUrl && <a href={xscannerUrl}>{xscannerUrl}</a>}
        </div>
      </section>
    </div>
  );
}

export default App;
