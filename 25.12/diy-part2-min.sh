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

# ---------------------------------------------------------
# 品牌与默认地址
#   · 主机名/发行名统一为 OpenWrt (上游脚本会改成 JWRT, 这里反向纠正)
#   · 默认管理地址 10.1.1.2 而不是 192.168.1.1
# ---------------------------------------------------------
CG="package/base-files/files/bin/config_generate"
if [ -f "$CG" ]; then
    echo ">>> 纠正默认品牌与 LAN 地址..."
    # JWRT / ImmortalWrt -> OpenWrt
    sed -i 's/JWRT/OpenWrt/g' "$CG"
    sed -i 's/ImmortalWrt/OpenWrt/g' "$CG"
    # 默认 LAN 地址 192.168.1.1 -> 10.1.1.2
    sed -i 's/192\.168\.1\.1/10.1.1.2/g' "$CG"
    echo "OK: config_generate 已处理"
else
    echo "WARN: 未找到 config_generate, 跳过品牌处理"
fi

# 发行版名称 (ubus system board 里的 release.distribution)
VERSION_MK="package/base-files/Makefile"
if [ -f "$VERSION_MK" ]; then
    sed -i 's/ImmortalWrt/OpenWrt/g' "$VERSION_MK"
fi
for f in package/base-files/files/etc/openwrt_release package/base-files/files/etc/os-release; do
    [ -f "$f" ] && sed -i 's/ImmortalWrt/OpenWrt/g' "$f"
done

# 兜底: 首次启动时强制写入主机名与 LAN 地址 (uci-defaults 只跑一次)
mkdir -p files/etc/uci-defaults
cat > files/etc/uci-defaults/99-liuli-defaults << 'UCI'
#!/bin/sh
# 琉璃构建: 首次启动默认值 (可通过 Web 界面自由修改)
[ -x /bin/config_generate ] || exit 0

uci -q batch <<'EOF'
set system.@system[0].hostname='OpenWrt'
set system.@system[0].zonename='Asia/Shanghai'
set system.@system[0].timezone='CST-8'
set network.lan.ipaddr='10.1.1.2'
set network.lan.netmask='255.255.255.0'
commit system
commit network
EOF

exit 0
UCI
chmod 0755 files/etc/uci-defaults/99-liuli-defaults

echo "OK: 默认主机名 OpenWrt / 管理地址 10.1.1.2 已写入"

# ---------------------------------------------------------
# CLX S20P: 诊断工具 + 安全的首次启动修复 (LED 补齐)
# ---------------------------------------------------------
mkdir -p files/usr/bin
cat > files/usr/bin/liuli-s20p-diag << 'DIAG'
#!/bin/sh
# 琉璃 · CLX S20P 诊断与修复
#   用法: liuli-s20p-diag            仅输出诊断报告
#         liuli-s20p-diag --apply    输出报告并执行安全的 LED 补齐修复
# 报告可贴给开发者用于精确定位机型相关的 bug。

. /lib/functions.sh

APPLY=0
[ "$1" = "--apply" ] && APPLY=1

hr() { echo "------------------------------------------------------------"; }

echo "===== 琉璃 S20P 诊断报告 $(date '+%F %T') ====="
hr
echo "## 机型"
echo "  board_name : $(cat /tmp/sysinfo/board_name 2>/dev/null)"
echo "  model      : $(cat /tmp/sysinfo/model 2>/dev/null)"
echo "  compatible : $(tr '\0' ' ' < /proc/device-tree/compatible 2>/dev/null)"
echo "  firmware   : $(cat /etc/openwrt_release 2>/dev/null | tr '\n' ' ')"
echo "  kernel     : $(uname -r)"
echo "  uptime     : $(cat /proc/uptime 2>/dev/null | cut -d. -f1) 秒"
hr

echo "## LED (内核已注册)"
ls /sys/class/leds/ 2>/dev/null | sed 's/^/  /'
echo "## LED (UCI 已配置)"
uci -q show system 2>/dev/null | grep "=led" | sed 's/^/  /'
uci -q show system 2>/dev/null | grep "\.sysfs=" | sed 's/^/  /'
hr

echo "## 网口 / 交换机"
for d in /sys/class/net/*; do
	n=$(basename "$d")
	printf "  %-12s %s\n" "$n" "$(ip -br link show dev "$n" 2>/dev/null | awk '{print $2, $3}')"
done
echo "## 接口状态"
ubus call network.interface dump 2>/dev/null | jsonfilter -e '@.interface[@.up=true].interface' 2>/dev/null | sed 's/^/  已连接: /'
ubus call network.interface dump 2>/dev/null | jsonfilter -e '@.interface[@.up=false].interface' 2>/dev/null | sed 's/^/  未连接: /'
hr

echo "## 无线"
for r in 0 1 2; do
	[ -d "/sys/class/ieee80211/phy$r" ] || continue
	echo "  phy$r 存在"
done
uci -q show wireless 2>/dev/null | grep -E "\.ssid=|\.macaddr=|\.disabled=|\.band=|\.channel=" | sed 's/^/  /'
echo "## factory 分区 MAC (报告用, 不会自动写入)"
fp=$(find_mtd_part factory 2>/dev/null)
if [ -n "$fp" ]; then
	echo "  factory = $fp"
	echo "  2.4G MAC : $(mtd_get_mac_binary factory 0x4 2>/dev/null)"
	echo "  5G   MAC : $(mtd_get_mac_binary factory 0x8004 2>/dev/null)"
else
	echo "  未找到 factory 分区"
fi
hr

echo "## 温度 / 散热"
for z in /sys/class/thermal/thermal_zone*; do
	[ -d "$z" ] || continue
	printf "  %-28s %s m°C\n" "$(cat $z/type 2>/dev/null)" "$(cat $z/temp 2>/dev/null)"
done
echo "## 连接数"
printf "  %s / %s\n" "$(cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null)" \
	"$(cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null)"
hr

echo "## 最近错误日志"
logread 2>/dev/null | grep -iE "err|fail|warn|timeout|panic" | tail -15 | sed 's/^/  /'
hr

# ---------------- 安全修复: LED 补齐 ----------------
echo "## LED 补齐 (内核有但 UCI 未配置的指示灯)"
NEED=0
for led in /sys/class/leds/*; do
	[ -d "$led" ] || continue
	name=$(basename "$led")
	if uci -q show system 2>/dev/null | grep -q "sysfs='$name'"; then
		echo "  = $name  已配置, 跳过"
		continue
	fi
	NEED=$((NEED + 1))
	lname=$(echo "$name" | tr '_' ' ')

	case "$name" in
		*wan*|*internet*)	tg=netdev; dev='wan';   mode='link tx rx' ;;
		*lan*)				tg=netdev; dev='br-lan'; mode='link tx rx' ;;
		*usb*)				tg=usbdev; dev='1-1';   mode='' ;;
		*wlan*|*wifi*|*5g*)	tg=phy0tpt; dev='';     mode='' ;;
		*2g*)				tg=phy1tpt; dev='';     mode='' ;;
		*)					tg=none;   dev='';      mode='' ;;
	esac

	if [ "$APPLY" = "1" ]; then
		uci -q add system led >/dev/null
		uci -q set system.@led[-1].name="$lname"
		uci -q set system.@led[-1].sysfs="$name"
		uci -q set system.@led[-1].trigger="$tg"
		[ -n "$dev" ]  && uci -q set system.@led[-1].dev="$dev"
		[ -n "$mode" ] && uci -q set system.@led[-1].mode="$mode"
		[ "$tg" = "none" ] && uci -q set system.@led[-1].default='1'
		echo "  + $name  -> trigger=$tg ${dev:+dev=$dev}"
	else
		echo "  + $name  建议 trigger=$tg ${dev:+dev=$dev}  (加 --apply 生效)"
	fi
done

[ "$NEED" = "0" ] && echo "  无需修复"

if [ "$APPLY" = "1" ] && [ "$NEED" != "0" ]; then
	uci -q commit system
	/etc/init.d/led restart >/dev/null 2>&1
	echo ""
	echo "已写入 $NEED 条 LED 配置并重启 LED 服务。"
	echo "若灯效不满意: uci show system | grep '=led' 查看, 用 uci delete system.@led[N] 删除。"
fi

hr
echo "诊断完成。把上面整段输出贴给开发者即可定位机型相关问题。"
exit 0
DIAG
chmod 0755 files/usr/bin/liuli-s20p-diag

# 首次启动时自动跑一次 LED 补齐 (只跑一次)
cat > files/etc/uci-defaults/98-liuli-s20p-leds << 'LEDUCI'
#!/bin/sh
# 首次启动: 若 LED 未被配置, 自动补齐 (仅执行一次)
case "$(cat /tmp/sysinfo/board_name 2>/dev/null)" in
	*clx*|*s20p*|*s20*) ;;
	*) exit 0 ;;
esac
[ -x /usr/bin/liuli-s20p-diag ] && /usr/bin/liuli-s20p-diag --apply >/tmp/liuli-s20p-leds.log 2>&1
exit 0
LEDUCI
chmod 0755 files/etc/uci-defaults/98-liuli-s20p-leds

echo "OK: S20P 诊断工具与 LED 自动补齐已写入"
