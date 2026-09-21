NATProbe Grand Slam
========================

This bundle contains the same NAT/STUN probe built across nearly the entire target matrix exposed by Go 1.23.2 on the current Linux toolchain.

Runtime attribution splash:
  Name: 哥哥科技
  Professional identification: 长兄天工
  URL: https://github.com/ucxn/BroTech

Directory layout:
  src/main.go            - source with launch attribution animation
  dist/                  - raw default binaries for every successful GOOS/GOARCH target
  dist/variants/         - additional ISA/compatibility builds
  packages/              - per-target convenience archives
  BUILD-MATRIX.md        - complete build/result matrix and limitations
  SHA256SUMS.txt         - hashes for all raw binaries
  LICENSE.md             - supplied adapted AAL text
  SIGNATURE-STATUS.txt   - important GPG signature status
  wasm_exec.js           - Go runtime helper for js/wasm
