#!/usr/bin/env bash
# 链码升版示例（路径与版本号请按你虚拟机 test-network 实际修改后执行）
set -euo pipefail
TN="${TN:-$HOME/work/fabric-packages/fabric/fabric/scripts/fabric-samples/test-network}"
CC_NAME="${CC_NAME:-score}"
CC_VER="${CC_VER:-1.2}"
CC_SEQ="${CC_SEQ:-3}"
echo "使用 test-network: $TN"
echo "链码: $CC_NAME  version=$CC_VER sequence=$CC_SEQ"
echo "请先 cd 到链码目录执行 go mod tidy && go mod vendor，再在本脚本中核对 deployCC 参数。"
echo "示例命令（勿盲跑）："
echo "  cd $TN"
echo "  ./network.sh deployCC -ccn $CC_NAME -ccp <链码目录绝对路径> -ccl golang -ccv $CC_VER -ccs $CC_SEQ"
