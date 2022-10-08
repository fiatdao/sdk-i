import gql from 'graphql-tag'

export const POSITIONS = gql`
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

export const COLLATERALS = gql`
  query Collaterals(
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


export const AUCTION_MAIN_DATA = gql`
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

export const AUCTION_BY_ID = gql`
  ${AUCTION_MAIN_DATA}
  query auctionById($id: ID!) {
    collateralAuction(id: $id) {
      ...Auction
    }
  }
`

export const AUCTIONS = gql`
  ${AUCTION_MAIN_DATA}
  query auctions($where: CollateralAuction_filter) {
    collateralAuctions(where: $where) {
      ...Auction
    }
  }
`

export const TRANSACTIONS = gql`
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

export const USER_PROXY = gql`
  query userProxy($id: ID!) {
    userProxy(id: $id) {
      id
      proxyAddress
    }
  }
`
