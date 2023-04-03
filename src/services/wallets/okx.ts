import {
  Chain,
  Wallet,
  getWalletConnectConnector,
} from "@rainbow-me/rainbowkit";
import {
  ConnectorNotFoundError,
  UserRejectedRequestError,
  ResourceUnavailableError,
  RpcError,
} from "wagmi";
import { getClient } from "@wagmi/core";
import { getAddress } from "ethers/lib/utils.js";
import { InjectedConnector } from "wagmi/connectors/injected";
import type { Address } from "abitype";

declare global {
  interface Window {
    okxwallet: any;
  }
}

export interface OKXWalletOptions {
  chains: Chain[];
}

class OXKConnector extends InjectedConnector {
  public readonly id = "okxwallet";

  public constructor({
    chains,
  }: {
    chains?: Chain[];
  } = {}) {
    super({
      chains,
      options: {
        name: "OKX",
        shimDisconnect: true,
        getProvider: () => {
          if (typeof window === "undefined") {
            return;
          }

          // eslint-disable-next-line consistent-return
          return window.okxwallet;
        },
      },
    });
  }

  public async connect({ chainId }: { chainId?: number } = {}) {
    try {
      const provider = await this.getProvider();
      if (!provider) throw new ConnectorNotFoundError();

      if (provider.on) {
        provider.on("accountsChanged", this.onAccountsChanged);
        provider.on("chainChanged", this.onChainChanged);
        provider.on("disconnect", this.onDisconnect);
      }

      this.emit("message", { type: "connecting" });

      // Attempt to show wallet select prompt with `wallet_requestPermissions` when
      // `shimDisconnect` is active and account is in disconnected state (flag in storage)
      let account: Address | null = null;

      if (
        this.options?.shimDisconnect &&
        !getClient().storage?.getItem(this.shimDisconnectKey)
      ) {
        account = await this.getAccount().catch(() => null);
        const isConnected = !!account;
        if (isConnected)
          // Attempt to show another prompt for selecting wallet if already connected
          try {
            await provider.request({
              method: "wallet_requestPermissions",
              params: [{ eth_accounts: {} }],
            });
          } catch (error) {
            // Not all MetaMask injected providers support `wallet_requestPermissions` (e.g. MetaMask iOS).
            // Only bubble up error if user rejects request
            if (this.isUserRejectedRequestError(error))
              throw new UserRejectedRequestError(error);
          }
      }

      if (!account) {
        const accounts = await provider.request({
          method: "eth_requestAccounts",
        });
        account = getAddress(accounts[0] as string);
      }

      // Switch to chain if provided
      let id = await this.getChainId();
      let unsupported = this.isChainUnsupported(id);
      if (chainId && id !== chainId) {
        const chain = await this.switchChain(chainId);
        id = chain.id;
        unsupported = this.isChainUnsupported(id);
      }

      if (this.options?.shimDisconnect)
        getClient().storage?.setItem(this.shimDisconnectKey, true);

      return { account, chain: { id, unsupported }, provider };
    } catch (error) {
      if (this.isUserRejectedRequestError(error))
        throw new UserRejectedRequestError(error);
      if ((error as RpcError).code === -32002)
        throw new ResourceUnavailableError(error);
      throw error;
    }
  }
}

export const okxWallet = ({ chains }: OKXWalletOptions): Wallet => {
  const isInjected =
    typeof window !== "undefined" &&
    typeof window.ethereum !== "undefined" &&
    typeof window.okxwallet !== "undefined";
  const shouldUseWalletConnect = !isInjected;
  return {
    id: "okx",
    name: "OKX Wallet",
    iconUrl:
      "https://explorer-api.walletconnect.com/v3/logo/md/45f2f08e-fc0c-4d62-3e63-404e72170500?projectId=031d2b33f0e66c821d14c5bbaaa6b611",
    iconBackground: "#000000",
    iconAccent: "#ffffff",
    installed: !shouldUseWalletConnect ? isInjected : void 0,
    downloadUrls: {
      browserExtension:
        "https://chrome.google.com/webstore/detail/okx-wallet/mcohilncbfahbmgdjkbpemcciiolgcge?hl=en",
      android: "https://static.efuumh.com/upgradeapp/okx-android.apk",
      ios: "https://itunes.apple.com/app/id1327268470?mt=8",
      qrCode: "https://www.okx.com/download",
    },
    createConnector: () => {
      const connector: any = shouldUseWalletConnect
        ? getWalletConnectConnector({ chains })
        : new OXKConnector({
            chains,
          });
      const getUri = async () => {
        const { uri } = (await connector.getProvider()).connector;
        return uri;
      };
      return {
        connector,
        mobile: {
          getUri: shouldUseWalletConnect
            ? async () => {
                const uri = await getUri();
                return `okex://main/wc?uri=${encodeURIComponent(uri)}`;
              }
            : void 0,
        },
        qrCode: shouldUseWalletConnect
          ? {
              getUri,
              instructions: {
                learnMoreUrl:
                  "https://www.okx.com/support/hc/en-us/sections/360003035872",
                steps: [
                  {
                    description:
                      "We recommend putting OKX Wallet on your home screen for quicker access.",
                    step: "install",
                    title: "Open the OKX Wallet app",
                  },
                  {
                    description:
                      "Be sure to back up your wallet using a secure method. Never share your secret phrase with anyone.",
                    step: "create",
                    title: "Create or Import a Wallet",
                  },
                  {
                    description:
                      "After you scan, a connection prompt will appear for you to connect your wallet.",
                    step: "scan",
                    title: "Tap the scan button",
                  },
                ],
              },
            }
          : void 0,
        extension: {
          learnMoreUrl:
            "https://www.okx.com/support/hc/en-us/sections/360003035872/",
          instructions: {
            steps: [
              {
                description:
                  "We recommend pinning OKX Wallet to your taskbar for quicker access to your wallet.",
                step: "install",
                title: "Install the OKX Wallet extension",
              },
              {
                description:
                  "Be sure to back up your wallet using a secure method. Never share your secret phrase with anyone.",
                step: "create",
                title: "Create or Import a Wallet",
              },
              {
                description:
                  "Once you set up your wallet, click below to refresh the browser and load up the extension.",
                step: "refresh",
                title: "Refresh your browser",
              },
            ],
          },
        },
      };
    },
  };
};
