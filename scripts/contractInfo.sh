ROOT="`dirname $0`/.."
cd $ROOT
CHECKER=./runner/bin/scilla-checker
STDLIB=./runner/src/stdlib
OUTDIR=./contract_info
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
for CONTRACT in `ls ./scilla/*.scilla`; do
  INFO=$OUTDIR/`basename $CONTRACT .scilla`.json
  $CHECKER -libdir $STDLIB -contractinfo $CONTRACT > $INFO || exit 1
done
exit 0
