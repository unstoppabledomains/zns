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
    endpoint: 'https://api.zilliqa.com'
  },
  testnet: {
    version: 21823489,
    endpoint: 'https://dev-api.zilliqa.com'
  },
};

function deployAccountFunder(zilliqa, params) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/account_funder.scilla', 'utf8'),
      accountFunderData.init({}),
    )
    .deploy({...params});
}

async function migrate(privateKey, net) {
  console.log('privateKey:', privateKey);

  const {version, endpoint} = networks[net];
  console.log('version:', version);
  console.log('url:', endpoint);

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

  const [,accountFunder] = await deployAccountFunder(zilliqa, {
    version,
    amount: new BN(0),
    gasLimit: Long.fromNumber(25000),
    gasPrice,
  });
  console.log('AccountFunder', accountFunder.address);
  console.log('   (BECH32)', toBech32Address(accountFunder.address));

  const zilNode = Zns.namehash('zil');
  const zns = await Zns.deployRegistry(zilliqa, zilliqa.wallet.defaultAccount.address, zilNode, {
    version,
    gasPrice,
    gasLimit: Long.fromNumber(80000),
  });
  const {address: registryAddress} = zns.contract;
  console.log('Registry', registryAddress);
  console.log('   (BECH32)', toBech32Address(registryAddress));

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
    })

  console.log('Admin', admin.address);
  console.log('   (BECH32)', toBech32Address(admin.address));
}

const privateKey = 'a68c7b791f65cc61ee8367ba017191356c112d224ab0650b7d8e0a509d524a78';
migrate(privateKey, process.env.ZIL_NETWORK || 'testnet')
  .then(console.log)
  .catch(console.error);
