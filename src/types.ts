import { BigNumber } from "ethers";

export type CollateralTypesFilter = Array<{
  vault: string;
  tokenId: number;
}>;

export type CollateralTypes = Array<CollateralType>;

export interface CollateralType {
  properties: Properties;
  metadata: Metadata;
  settings: Settings;
  state: State;
}
export interface Properties {
  vault: string;
  vaultType: string;
  name: string;
  protocol: string;
  token: string;
  tokenId: string;
  tokenScale: BigNumber;
  tokenSymbol: string;
  underlierToken: string;
  underlierScale: BigNumber;
  underlierSymbol: string;
  maturity: BigNumber;
  eptData?: EptData;
  fcData?: FcData;
  fyData?: FyData;
  sptData?: SptData;
}

export interface EptData {
  balancerVault: string;
  convergentCurvePool: string;
  poolId: string;
}

export interface FcData {
  notional: string;
  tenor: string;
}

export interface FyData {
  yieldSpacePool: string;
}

export interface SptData {
  adapter: string;
  balancerVault: string;
  maturity: string;
  spacePool: string;
  target: string;
}

export interface Metadata {
  protocol: string;
  asset: string;
  symbol: string;
  decimals: number;
  name: string;
  tokenIds?: (string)[] | null;
  icons: Icons;
  urls: Urls;
}

export interface Icons {
  protocol: string;
  asset: string;
  underlier: string;
}

export interface Urls {
  project: string;
  asset: string;
}

export interface Settings {
  codex: any;
  collybus: any;
  limes: any;
  collateralAuction: any;
}

export interface State {
  codex: any;
  limes: any;
  publican: any;
  collybus: any;
}

export interface UserData {
  balances?: Balances[];
  credit: BigNumber;
  delegated?: any[];
  delegates?: any[];
  isProxy: boolean;
  positions?: Positions[] | null;
  unbackedDebt: BigNumber;
  user: string;
}

export interface Balances {
  collateralType: any;
  balance: BigNumber;
}

export interface Positions {
  owner: string;
  vault: string;
  token: string;
  tokenId: BigNumber;
  collateral: BigNumber;
  normalDebt: BigNumber;
}
