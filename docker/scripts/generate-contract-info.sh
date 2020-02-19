#!/usr/bin/env bash

set -eo pipefail

ROOT=/zns-contracts
cd $ROOT
CHECKER=/scilla/0/bin/scilla-checker
STDLIB=/scilla/0/src/stdlib
OUTDIR=$ROOT/contract_info
mkdir -p $OUTDIR
rm $OUTDIR/*
if [ ! -x $CHECKER ]; then
  echo "$CHECKER is not executable"
  exit 1
fi
if [ ! -d $STDLIB ]; then
  echo "$STDLIB doesn't exist"
  exit 1
fi
for CONTRACT in /zns-contracts/scilla/*.scilla; do
  INFO=$OUTDIR/$(basename $CONTRACT .scilla).json
  $CHECKER -gaslimit 10000 -libdir $STDLIB -contractinfo $CONTRACT >$INFO || exit 1
done
exit 0
