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
  codex: CodexSettings;
  collybus: CollybusSettings;
  limes: LimesSettings;
  collateralAuction: CollateralAuctionSettings;
}
export interface CodexSettings {
  debtCeiling: BigNumber;
  debtFloor: BigNumber;
}

export interface CollybusSettings {
  liquidationRatio: BigNumber;
  defaultRateId: BigNumber;
}

export interface LimesSettings {
  liquidationPenalty: BigNumber;
  collateralAuction: string;
  maxDebtOnAuction: BigNumber;
}

export interface CollateralAuctionSettings {
  multiplier: BigNumber;
  maxAuctionDuration: BigNumber;
  auctionDebtFloor: BigNumber;
  collybus: string;
}

export interface State {
  codex: CodexState;
  limes: LimesState;
  publican: PublicanState;
  collybus: CollybusState;
}
export interface CodexState {
  totalNormalDebt: BigNumber;
  rate: BigNumber;
  virtualRate? : BigNumber; // fetchCollateralTypesAndPrices
}

export interface LimesState {
  debtOnAuction: string;
}

export interface PublicanState {
  interestPerSecond: string;
}

export interface CollybusState {
  rateId?: BigNumber | null;
  discountRate?: BigNumber | null;
  fairPrice?: BigNumber; // fetchCollateralTypesAndPrices
  liquidationPrice?: BigNumber; // fetchCollateralTypesAndPrices
  faceValue?: BigNumber; // fetchCollateralTypesAndPrices
}

export interface UserData {
  user: string;
  isProxy: boolean;
  credit: BigNumber;
  unbackedDebt: BigNumber;
  balances?: (Balances)[] | null;
  delegated?: (null)[] | null; // todo
  delegates?: (null)[] | null; // todo
  positions?: (Positions)[] | null;
}

export interface Balances {
  collateralType: BalanceCollateralType;
  balance: BigNumber;
}

export interface BalanceCollateralType {
  token: string;
  tokenId: string;
}

export interface Positions {
  owner: string;
  vault: string;
  token: string;
  tokenId: BigNumber;
  collateral: BigNumber;
  normalDebt: BigNumber;
}
