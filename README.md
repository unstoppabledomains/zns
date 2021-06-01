# ZNS

The Zilliqa Name Service (ZNS) is a suite of smart contracts to make a naming
system like DNS on the blockchain. ZNS connects the familiar and powerful name
system mechanics to blockchain assets like addresses, websites and application
data, as well as traditional dns records.

## Getting Started

### Requirements

- [Docker](https://www.docker.com) required
- Node.js and Yarn are required as well.

### Installing

```sh
yarn install
```

### Testing

Tests run against standalone zilliqa development node. You will need to install [Docker](https://www.docker.com) before.

#### Run zilliqa development node.

```shell script
yarn zilliqa:start
```

It's requires keep port `5555` open on local machine. 
If port already occupied - you may have `zilliqa-dev-node` already run. 
You can check this via command below. 

#### Check node status

```shell script
docker ps
```

You should see similar output if node was ran. 
Almost each docker command requires `CONTAINER ID`. Container id generates automatically on each `docker run`:
```
CONTAINER ID        IMAGE                     COMMAND                  CREATED             STATUS              PORTS                    NAMES
3ab2b677fd8f        derain/zilliqa-dev-node   "/usr/local/bin/isol…"   11 minutes ago      Up 11 minutes       0.0.0.0:5555->5555/tcp   mystifying_wright
```

#### Run test suite
```
yarn test
```

#### Stop zilliqa development node

```shell script
yarn zilliqa:stop
```


#### Get logs from zilliqa development node
```shell script
docker logs <CONTAINER ID>
```

#### Run node in foreground to get real-time logs on screen
```shell script
docker run -p 5555:5555 derain/zilliqa-dev-node
```

## Build zilliqa-dev-node
You may need to rebuild docker image for `zilliqa development node`.
```shell script
cd docker/build
docker build . -t zilliqa-dev-node
```
And run your brand new docker image:
```shell script
docker run -p 5555:5555 zilliqa-dev-node
```

## Push new zilliqa-dev-node image

To build & push a new version of node image use `Build & Push Zilliqa Dev Node` GitHub Action.

For an introduction to Zilliqa and Scilla and some of the design considerations
look at the [Zilliqa Reference](./ZILLIQA.md).

There are 3 ZNS contract variants.

- Registry – This contract where the ZNS names are stored. Registry mechanics
  are explained in detail in the [Registry Reference](./REGISTRY.md).

- Resolvers – In order to keep the size of the main ZNS contract low, the ZNS resolution is stored in separate contracts called
  Resolvers. Resolvers mechanics are explained in detail in the
  [Resolvers Reference](./RESOLVERS.md).

- Registrars – These contracts manage the registration of new ZNS names. ZNS has 2
  of them. An auction registrar, which implements open, ascending price,
  variable length auction. And a simple registrar listing all names for a fixed
  price designed to be put in place after the initial auction period. Registrar
  mechanics are explained in detail in the
  [Registrar Reference](./REGISTRAR.md).

## License


