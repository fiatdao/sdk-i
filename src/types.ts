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
  eptData: EptData;
  fcData?: null;
  fyData?: null;
}

export interface EptData {
  id: string;
  balancerVault: string;
  convergentCurvePool: string;
  poolId: string;
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
}