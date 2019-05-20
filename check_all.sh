rm -rf contract_info
mkdir contract_info

for file in scilla/*.scilla; do
  echo $(../scilla/bin/scilla-checker $file \
    -libdir ../scilla/src/stdlib/ -contractinfo) \
    > "contract_info/$(basename $file .scilla).json"
done