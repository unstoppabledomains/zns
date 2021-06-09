# Reference: https://github.com/Zilliqa/Zilliqa/blob/release-8.0/docker/Dockerfile

FROM zilliqa/zilliqa:v8.0.4

ARG SOURCE_DIR=/zilliqa

ADD ./constants.xml ${SOURCE_DIR}
ADD ./isolated-server-accounts.json ${SOURCE_DIR}

ADD ./constants.xml .
ADD ./isolated-server-accounts.json .

ADD ./constants.xml /run/zilliqa
ADD ./isolated-server-accounts.json /run/zilliqa

EXPOSE 5555

ENTRYPOINT ["/usr/local/bin/isolatedServer", "-f", "/zilliqa/isolated-server-accounts.json"]
