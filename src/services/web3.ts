import "@rainbow-me/rainbowkit/styles.css";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { configureChains, createClient } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import {
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { okxWallet } from "@/services/wallets/okx";
import { mainnet, bsc, avalanche, polygon, goerli } from "wagmi/chains";

export const { chains, provider } = configureChains(
  [mainnet, bsc, avalanche, polygon, goerli],
  [publicProvider()]
);

const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
      okxWallet({ chains }),
      metaMaskWallet({ chains, shimDisconnect: true }),
      rainbowWallet({ chains, shimDisconnect: true }),
      coinbaseWallet({ chains, appName: "Your App Name" }),
      walletConnectWallet({ chains }),
      injectedWallet({ chains, shimDisconnect: true }),
    ],
  },
]);

export const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});
