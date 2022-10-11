# <h1 align="center"> FIAT SDK </h1>

**Repository containing an SDK for easier interaction with FIAT**

## Getting started

### Installing
Install the FIAT SDK by running the following command

```sh
yarn add @fiatdao/sdk # npm install @fiatdao/sdk
```

### Usage

Instantiating the SDK via an existing provider
```js
const detectEthereumProvider = require('@metamask/detect-provider');
const fiat = await fiat.fromProvider(await detedEthereumProvider());
```

Instantiating the SDK via private key in a node environment
```js
const fiat = await FIAT.fromPrivateKey(
  process.env.JSON_RPC_ENDPOINT_URL,
  process.env.PRIVATE_KEY
);
```

## Requirements
This repository uses Node.js and Yarn for building and testing.

### Set .env
Copy and update contents from `.env.example` to `.env`

## Tests

After installing dependencies with `yarn`, run `yarn test` to run the tests.

## Building and testing

```sh
git clone https://github.com/fiatdao/sdk
cd fiat
yarn # This installs the project's dependencies.
yarn test
```