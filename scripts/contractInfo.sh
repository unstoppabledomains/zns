ROOT="`dirname $0`/.."
cd $ROOT
CHECKER=./bin/scilla-checker
STDLIB=./scilla/stdlib
if [ ! -x $CHECKER ]; then
  echo "$CHECKER is not executable"
  exit 1
fi
if [ ! -d $STDLIB ]; then
  echo "$STDLIB doesn't exist"
  exit 1
fi
for CONTRACT in `ls ./scilla/*.scilla`; do
  INFO=./contract_info/`basename $CONTRACT .scilla`.json
  $CHECKER -libdir $STDLIB -contractinfo $CONTRACT > $INFO
done
exit 0
