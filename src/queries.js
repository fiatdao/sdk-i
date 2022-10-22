import { gql } from 'graphql-request'

export const SUBGRAPH_URL_MAINNET = 'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph';
export const SUBGRAPH_URL_GOERLI = 'https://api.thegraph.com/subgraphs/name/fiatdao/fiat-subgraph-goerli';



export const VaultFragment = gql`
  fragment VaultFragment on Vault {
    id
    address
    name
    protocol
    vaultType
    token
    tokenScale
    tokenSymbol
    underlier
    underlierScale
    underlierSymbol
    debtFloor
    debtCeiling
    rate
    totalNormalDebt
    liquidationRatio
    defaultRateId
    defaultRateId_a {
      id
      rateId
      discountRate
    }
    spot {
      id
      spot
    }
    interestPerSecond
    collateralAuctionCollybus
    collateralAuctionCalculator
    multiplier
    maxAuctionDuration
    auctionDebtFloor
    maxDiscount
    limesCollateralAuction
    liquidationPenalty
    maxDebtOnAuction
    debtOnAuction
  }
`

export const CollateralTypeFragment = gql`
  fragment CollateralTypeFragment on CollateralType {
    id
    tokenId
    maturity
    depositedCollateral
    faceValue
    discountRate {
      id
      rateId
      discountRate
    }
    eptData {
      id
      balancerVault
      convergentCurvePool
      poolId
    }
    fcData {
      id
      notional
      tenor
    }
    fyData {
      id
      yieldSpacePool
    }
  }
`

export const PositionFragment = gql`
  fragment PositionFragment on Position {
    id
    owner
    collateral
    normalDebt
    maturity
  }
`

export const CollateralAuctionFragment = gql`
  fragment CollateralAuctionFragment on CollateralAuction {
    id
    auctionId
    isActive
    collateralToSell
    debt
    startsAt
    startPrice
  }
`

export const TransactionFragment = gql`
  fragment TransactionFragment on PositionTransactionAction {
    __typename
    id
    transactionHash
    collateral
    normalDebt
    deltaCollateral
    deltaNormalDebt
    timestamp
  }
`

export const UserFragment = gql`
  fragment UserFragment on User {
    id
    address
    proxy {
      id
      proxy
      owner
    }
    credit
    unbackedDebt
    balances {
      collateralType {
        id
        vault {
          token
        }
        tokenId
      }
      balance
    }
    delegated {
      delegator {
        id
        address
      }
      delegatee {
        id
        address
      }
      hasDelegate
    }
    delegates {
      delegator {
        id
        address
      }
      delegatee {
        id
        address
      }
      hasDelegate
    }
  }
`

export const UserProxyFragment = gql`
  fragment UserProxyFragment on UserProxy {
    id
    proxy
    owner
  }
`

export const queryVault = gql`
  ${VaultFragment}
  ${CollateralTypeFragment}
  query Vault($id: ID!) {
    vault(id: $id) {
      ...VaultFragment
      collateralTypes {
        ...CollateralTypeFragment
      }
    }
    collybusSpots(orderDirection: $orderDirection) {
      id
      token
      spot
    }
  }
`

export const queryVaults = gql`
  ${VaultFragment}
  ${CollateralTypeFragment}
  query Vault($where: Vault_filter) {
    vaults(where: $where) {
      ...VaultFragment
      collateralTypes {
        ...CollateralTypeFragment
      }
    }
    collybusSpots(orderDirection: $orderDirection) {
      id
      token
      spot
    }
  }
`

export const queryCollateralType = gql`
  ${CollateralTypeFragment}
  ${VaultFragment}
  query CollateralType($id: ID!) {
    collateralType(id: $id) {
      ...CollateralTypeFragment
      vault {
        ...VaultFragment
      }
    }
    collybusSpots(orderDirection: $orderDirection) {
      id
      token
      spot
    }
  }
`

export const queryCollateralTypes = gql`
  ${CollateralTypeFragment}
  ${VaultFragment}
  query CollateralType($where: CollateralType_filter) {
    collateralTypes(where: $where) {
      ...CollateralTypeFragment
      vault {
        ...VaultFragment
      }
    }
    collybusSpots(orderDirection: $orderDirection) {
      id
      token
      spot
    }
  }
`

export const queryPosition = gql`
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${UserFragment}
  query Position($id: ID!) {
    position(id: $id) {
      ...PositionFragment
      collateralType {
        ...CollateralTypeFragment
        vault {
          ...VaultFragment
        }
      }
      user {
        ...UserFragment
      }
    }
  }
`

export const queryPositions = gql`
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${UserFragment}
  query Positions($where: Position_filter) {
    positions(where: $where) {
      ...PositionFragment
      collateralType {
        ...CollateralTypeFragment
        vault {
          ...VaultFragment
        }
      }
      user {
        ...UserFragment
      }
    }
  }
`

export const queryCollateralAuction = gql`
  ${CollateralAuctionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${UserFragment}
  query auction($id: ID!) {
    collateralAuction(id: $id) {
      ...CollateralAuctionFragment
      collateralType {
        ...CollateralTypeFragment
        vault {
          ...VaultFragment
        }
      }
      user {
        ...UserFragment
      }
    }
  }
`

export const queryCollateralAuctions = gql`
  ${CollateralAuctionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${UserFragment}
  query auctions($where: CollateralAuction_filter) {
    collateralAuctions(where: $where) {
      ...CollateralAuctionFragment
      collateralType {
        ...CollateralTypeFragment
        vault {
          ...VaultFragment
        }
      }
      user {
        ...UserFragment
      }
    }
  }
`

export const queryTransaction = gql`
  ${TransactionFragment}
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  query transaction($id: ID!) {
    positionTransactionAction(id: $id) {
      ...TransactionFragment
      position {
        ...PositionFragment
        collateralType {
          ...CollateralTypeFragment
          vault {
            ...VaultFragment
          }
        }
      }
    }
  }
`

export const queryTransactions = gql`
  ${TransactionFragment}
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  query transactions($where: PositionTransactionAction_filter) {
    positionTransactionActions(where: $where) {
      ...TransactionFragment
      position {
        ...PositionFragment
        collateralType {
          ...CollateralTypeFragment
          vault {
            ...VaultFragment
          }
        }
      }
    }
  }
`

export const queryUser = gql`
  ${UserFragment}
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${CollateralAuctionFragment}
  query user($id: ID!) {
    user(id: $id) {
      ...UserFragment
      positions {
        ...PositionFragment
        collateralType {
          ...CollateralTypeFragment
          vault {
            ...VaultFragment
          }
        }
      }
      collateralAuctions {
        ...CollateralAuctionFragment
        collateralType {
          id
          vault {
            id
          }
        }
      }
    }
  }
`

export const queryUsers = gql`
  ${UserFragment}
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${CollateralAuctionFragment}
  query users($where: User_filter!) {
    users(where: $where) {
      ...UserFragment
      positions {
        ...PositionFragment
        collateralType {
          ...CollateralTypeFragment
          vault {
            ...VaultFragment
          }
        }
      }
      collateralAuctions {
        ...CollateralAuctionFragment
        collateralType {
          id
          vault {
            id
          }
        }
      }
    }
  }
`

export const queryUserProxy = gql`
  ${UserProxyFragment}
  ${UserFragment}
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${CollateralAuctionFragment}
  query userProxy($id: ID!) {
    userProxy(id: $id) {
      ...UserProxyFragment
      user {
        ...UserFragment
        positions {
          ...PositionFragment
          collateralType {
            ...CollateralTypeFragment
            vault {
              ...VaultFragment
            }
          }
        }
        collateralAuctions {
          ...CollateralAuctionFragment
          collateralType {
            id
            vault {
              id
            }
          }
        }
      }
    }
  }
`

export const queryUserProxies = gql`
  ${UserProxyFragment}
  ${UserFragment}
  ${PositionFragment}
  ${CollateralTypeFragment}
  ${VaultFragment}
  ${CollateralAuctionFragment}
  query userProxies($where: UserProxy_filter!) {
    userProxies(where: $where) {
      ...UserProxyFragment
      user {
        ...UserFragment
        positions {
          ...PositionFragment
          collateralType {
            ...CollateralTypeFragment
            vault {
              ...VaultFragment
            }
          }
        }
        collateralAuctions {
          ...CollateralAuctionFragment
          collateralType {
            id
            vault {
              id
            }
          }
        }
      }
    }
  }
`

export const queryMeta = gql`
  query meta {
    _meta {
      block {
        number
        hash
        timestamp
      }
      deployment
      hasIndexingErrors
    }
  }
`
