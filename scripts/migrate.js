const {Long, BN} = require('@zilliqa-js/util')
const {Zilliqa} = require('@zilliqa-js/zilliqa')
const {toBech32Address} = require('@zilliqa-js/crypto')

const {readFileSync} = require('fs')
const path = require('path')

const {contract_info: accountFunderInfo} = require('../contract_info/account_funder.json');
const {contract_info: adminInfo} = require('../contract_info/admin.json');

const {generateMapperFromContractInfo} = require('../build/lib/params');
const {default: Zns} = require('../build/lib/Zns');

const accountFunderData = generateMapperFromContractInfo(accountFunderInfo);
const adminData = generateMapperFromContractInfo(adminInfo);

const networks = {
  mainnet: {
    version: 65537,
    endpoint: 'https://api.zilliqa.com',
    privateKey: process.env.ZIL_MAINNET_PRIVATE_KEY,
    admins: []
  },
  testnet: {
    version: 21823489,
    endpoint: 'https://dev-api.zilliqa.com',
    privateKey: process.env.ZIL_TESTNET_PRIVATE_KEY,
    admins: [
      '0x4007ddaa515063d3753600535211279401b40d89',
      '0x93155e74c7ea923b26b8edaa92359ba3e3589d26'
    ]
  },
};

async function migrateAccountFunder(zilliqa, version, gasPrice) {
  const [,accountFunder] = await zilliqa.contracts
    .new(
      readFileSync('./scilla/account_funder.scilla', 'utf8'),
      accountFunderData.init({}),
    )
    .deploy({
      version,
      amount: new BN(0),
      gasLimit: Long.fromNumber(25000),
      gasPrice,
    });

  console.log('AccountFunder', accountFunder.address);
  console.log('   (BECH32)', toBech32Address(accountFunder.address));
  
  return accountFunder;
}

async function migrateRegistry(zilliqa, version, gasPrice) {
  const zilNode = Zns.namehash('zil');
  const zns = await Zns.deployRegistry(zilliqa, zilliqa.wallet.defaultAccount.address, zilNode, {
    version,
    gasPrice,
    gasLimit: Long.fromNumber(80000),
  });
  const {address: registryAddress} = zns.contract;
  console.log('Registry', registryAddress);
  console.log('   (BECH32)', toBech32Address(registryAddress));

  return zns;
}

async function migrateAdmin(zilliqa, version, gasPrice, registryAddress) {
  const [, admin] = await zilliqa.contracts
    .new(
      readFileSync(
        path.join(__dirname, '../scilla/admin.scilla'),
      ).toString(),
      adminData.init({
        initialAdmin: zilliqa.wallet.defaultAccount.address,
        registry: registryAddress,
      }),
    )
    .deploy({
      version,
      gasPrice,
      gasLimit: Long.fromNumber(10000),
    });

  console.log('Admin', admin.address);
  console.log('   (BECH32)', toBech32Address(admin.address));

  return admin;
}

async function setAdmins(adminContract, version, gasPrice, admins = []) {
  for (let i = 0; i < admins.length; i++) {
    const tx = await adminContract.call(
      'setAdmin',
      adminData.f.setAdmin({
        address: admins[i],
        isApproved: true,
      }),
      {
        version,
        amount: new BN(0),
        gasPrice,
        gasLimit: Long.fromNumber(10000),
      },
    )
    if (!tx.isConfirmed()) {
      throw new Error('Transaction is not confirmed', tx)
    }

    console.log('Admin added', admins[i]);
  }
}

async function migrate(network) {
  const _network = networks[network];
  console.log('Migration config:', _network);

  const {version, endpoint, privateKey, admins} = _network;

  const zilliqa = new Zilliqa(endpoint);
  const gasPrice = new BN(
    (await zilliqa.blockchain.getMinimumGasPrice()).result,
  );
  console.log('gasPrice:', gasPrice.toString());

  zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey));
  console.log('zilliqa.wallet.defaultAccount:', zilliqa.wallet.defaultAccount);

  const balance = await zilliqa.blockchain.getBalance(
    zilliqa.wallet.defaultAccount.address,
  );
  console.log('balance:', balance.result);

  await migrateAccountFunder(zilliqa, version, gasPrice);
  const zns = await migrateRegistry(zilliqa, version, gasPrice);
  const {address: registryAddress} = zns.contract;

  const adminContract = await migrateAdmin(zilliqa, version, gasPrice, registryAddress);
  await zns.setAdmin(adminContract.address);

  await setAdmins(adminContract, version, gasPrice, admins);
}

migrate(process.env.ZIL_NETWORK || 'testnet')
  .then(console.log)
  .catch(console.error);
