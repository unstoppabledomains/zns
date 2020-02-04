FROM zilliqa/scilla:v0.5.0

# Format guideline: one package per line and keep them alphabetically sorted
RUN apt-get update \
    && apt-get install -y software-properties-common \
    && add-apt-repository ppa:tah83/secp256k1 -y \
    && apt-get update && apt-get install -y --no-install-recommends \
    autoconf \
    build-essential \
    ca-certificates \
    cmake \
    # curl is not a build dependency
    curl \
    git \
    golang \
    libboost-filesystem-dev \
    libboost-program-options-dev \
    libboost-system-dev \
    libboost-test-dev \
    libboost-python-dev \
    libcurl4-openssl-dev \
    libevent-dev \
    python3-dev \
    libjsoncpp-dev \
    libjsonrpccpp-dev \
    libleveldb-dev \
    libmicrohttpd-dev \
    libminiupnpc-dev \
    libsnappy-dev \
    libssl-dev \
    libtool \
    ocl-icd-opencl-dev \
    pkg-config \
    python \
    python-pip \
    python3-setuptools \
    python3-pip \
    libsecp256k1-dev \
    && rm -rf /var/lib/apt/lists/* \
    && pip install setuptools \
    && pip install  request requests clint futures \
    && pip3 install requests clint future

ARG ZILLIQA_VERSION=feature/kaya_binary
ARG REPO=https://github.com/Zilliqa/Zilliqa.git
ARG SOURCE_DIR=/zilliqa
ARG BUILD_DIR=/build
ARG INSTALL_DIR=/usr/local
ARG BUILD_TYPE=RelWithDebInfo
ARG EXTRA_CMAKE_ARGS=

RUN git clone -b ${ZILLIQA_VERSION} --depth 1 ${REPO} ${SOURCE_DIR} && \
    cmake -H${SOURCE_DIR} -B${BUILD_DIR} -DCMAKE_BUILD_TYPE=${BUILD_TYPE} \
        -DCMAKE_INSTALL_PREFIX=${INSTALL_DIR} ${EXTRA_CMAKE_ARGS} \
    && cmake --build ${BUILD_DIR} -- -j$(nproc) \
    && cmake --build ${BUILD_DIR} --target install \
    && rm -rf ${BUILD_DIR}

ADD ./constants.xml ${SOURCE_DIR}
ADD ./isolated-server-accounts.json ${SOURCE_DIR}

ENV LD_LIBRARY_PATH=${INSTALL_DIR}/lib

EXPOSE 5555

WORKDIR ${SOURCE_DIR}

ENTRYPOINT ["/usr/local/bin/isolatedServer", "-f", "/zilliqa/isolated-server-accounts.json"]