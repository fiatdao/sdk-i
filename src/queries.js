import { gql } from 'graphql-request'

export const SUBGRAPH_URL_MAINNET = 'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph';
export const SUBGRAPH_URL_GOERLI = 'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph-goerli';

export const queryVault = gql`
  query Vault($id: ID!) {
    vault(id: $id) {
      name
      collateralTypes {
        tokenId
        maturity
        symbol
        underlierSymbol
        eptData {
          balancerVault
          convergentCurvePool
          poolId
        }
        fcData {
          notional
          tenor
        }
        fyData {
          yieldSpacePool
        }
      }
    }
  }
`

export const queryPositions = gql`
  query Positions($where: Position_filter) {
    positions(where: $where) {
      id
      vaultName
      maturity
      collateral
      owner
      normalDebt
      collateralType {
        symbol
        address
        underlierSymbol
        underlierAddress
        tokenId
      }
      vault {
        type
        vaultType
        address
        maxDiscount
        collateralizationRatio
        interestPerSecond
        debtFloor
      }
    }
  }
`

export const queryCollateralTypes = gql`
  query CollateralTypes(
    $where: CollateralType_filter
    $orderBy: CollateralType_orderBy
    $orderDirection: OrderDirection
  ) {
    collateralTypes(where: $where, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      tokenId
      symbol
      underlierSymbol
      underlierAddress
      underlierScale
      maturity
      address
      scale
      faceValue
      eptData {
        id
        balancerVault
        convergentCurvePool
        poolId
      }
      vault {
        id
        defaultRateId
        type
        collateralizationRatio
        address
        interestPerSecond
        vaultType
        debtFloor
        name
      }
    }
    collybusSpots(orderDirection: $orderDirection) {
      id
      token
      spot
    }
    collybusDiscountRates {
      id
      rateId
      discountRate
    }
  }
`


export const queryAuction = gql`
  fragment Auction on CollateralAuction {
    id
    auctionId
    isActive
    collateralToSell
    tokenId
    vaultName
    debt
    startsAt
    startPrice
    user {
      id
    }
    vault {
      id
      name
      address
      type
      interestPerSecond
      maxAuctionDuration
      auctionDebtFloor
    }
    collateralType {
      id
      address
      faceValue
      maturity
      tokenId
      symbol
      underlierAddress
      underlierSymbol
      underlierScale
    }
  }
`

export const queryAuctionById = gql`
  query auctionById($id: ID!) {
    collateralAuction(id: $id) {
      ...Auction
    }
  }
`

export const queryAuctions = gql`
  query auctions($where: CollateralAuction_filter) {
    collateralAuctions(where: $where) {
      ...Auction
    }
  }
`

export const queryTransactions = gql`
  query Transactions($where: PositionTransactionAction_filter) {
    positionTransactionActions(where: $where) {
      __typename
      vaultName
      id
      collateral
      deltaCollateral
      normalDebt
      deltaNormalDebt
      transactionHash
      tokenId
      timestamp
      user {
        id
      }
      vault {
        address
      }
      position {
        maturity
        collateralType {
          tokenId
          address
          underlierAddress
          underlierSymbol
          symbol
        }
      }
    }
  }
`

export const queryUserProxy = gql`
  query userProxy($id: ID!) {
    userProxy(id: $id) {
      id
      proxyAddress
    }
  }
`
