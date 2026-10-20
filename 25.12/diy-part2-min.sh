#!/bin/bash
#
# https://github.com/P3TERX/Actions-OpenWrt
# File name: diy-part2.sh
# Description: OpenWrt DIY script part 2 (After Update feeds)
# s20p-min 个人精简版: 仅保留编译修复 + sysctl 网络优化
# (不改默认 IP, 不改主机名/品牌)
#

echo "=========================================="
echo "执行自定义优化脚本 (diy-part2-min.sh)"
echo "=========================================="

# ---------------------------------------------------------
# libxcrypt 专项救治 (极致精简版)
# ---------------------------------------------------------
XCRYPT_MK="feeds/packages/libs/libxcrypt/Makefile"
if [ -f "$XCRYPT_MK" ]; then
    echo ">>> 正在硬化 libxcrypt 编译参数..."
    sed -i 's/CONFIGURE_ARGS[ \t]*+=[ \t]*/&--disable-werror /' "$XCRYPT_MK"
    sed -i 's/TARGET_CFLAGS[ \t]*+=[ \t]*/&-fcommon /' "$XCRYPT_MK"
    echo "OK: libxcrypt 参数注入完成。"
fi

# 修复Rust本地编译LLVM
RUST_FILE="feeds/packages/lang/rust/Makefile"

if [ -f "$RUST_FILE" ]; then
  sed -i 's/download-ci-llvm=true/download-ci-llvm=false/g' "$RUST_FILE"
  echo "OK: Rust 已设置为本地编译 LLVM"
else
  RUST_FILE=$(find feeds/ -type f -name "Makefile" -path "*/lang/rust/*" | head -1)
  if [ -n "$RUST_FILE" ]; then
    sed -i 's/download-ci-llvm=true/download-ci-llvm=false/g' "$RUST_FILE"
    echo "OK: Rust 已设置为本地编译 LLVM (路径: $RUST_FILE)"
  else
    echo "WARN: 未找到 Rust Makefile，跳过"
  fi
fi

# ---------------------------------------------------------
# MT7986A 2.5G 网络优化 (BBR + 缓冲区 + conntrack)
# ---------------------------------------------------------
mkdir -p files/etc/sysctl.d
cat > files/etc/sysctl.d/99-mt7986a-optimize.conf << 'SYSCTL'
# --- 1. 队列与拥塞控制 (低延迟核心) ---
net.core.default_qdisc = fq_codel
net.ipv4.tcp_congestion_control = bbr
# --- 2. TCP 行为优化 ---
net.ipv4.tcp_low_latency = 1
net.ipv4.tcp_autocorking = 0
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_mtu_probing = 1
net.ipv4.tcp_limit_output_bytes = 1048576
# --- 3. 内存缓冲区调整 (适配 2GB RAM + 2.5G 网络) ---
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_mem = 32768 65536 131072
# --- 4. 监听与连接队列 ---
net.core.somaxconn = 1024
net.ipv4.tcp_max_syn_backlog = 1024
# --- 5. UDP 精细化分配 (游戏/语音保命优化) ---
net.netfilter.nf_conntrack_udp_timeout = 30
net.netfilter.nf_conntrack_udp_timeout_stream = 180
net.netfilter.nf_conntrack_max = 262144
# --- 6. IPv6 专项优化 ---
net.ipv6.neigh.default.gc_thresh1 = 1024
net.ipv6.neigh.default.gc_thresh2 = 2048
net.ipv6.neigh.default.gc_thresh3 = 4096
net.ipv6.conf.all.max_addresses = 2
SYSCTL

echo "OK: sysctl 网络优化已写入"
