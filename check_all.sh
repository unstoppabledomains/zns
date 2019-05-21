rm -rf contract_info
mkdir contract_info

for file in scilla/*.scilla; do
  echo $(scilla-checker $file \
    -libdir ../../Zilliqa/scilla/src/stdlib/ -contractinfo) \
    > "contract_info/$(basename $file .scilla).json"
done