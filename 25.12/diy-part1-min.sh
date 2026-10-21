#!/bin/bash
#
# https://github.com/P3TERX/Actions-OpenWrt
# File name: diy-part1.sh
# Description: OpenWrt DIY script part 1 (Before Update feeds)
# s20p-min 个人精简版: 仅追加 Lucky(官方 3.3.3 xiaojv 预编译)
#

# 1. NAS feeds
echo 'src-git nas https://github.com/linkease/nas-packages.git;master' >> feeds.conf.default
echo 'src-git nas_luci https://github.com/linkease/nas-packages-luci.git;main' >> feeds.conf.default

# 2. iStore feeds
echo 'src-git istore https://github.com/linkease/istore;main' >> feeds.conf.default

mkdir -p package/custom

# =========================================================
# 琉璃主题 & 琉璃看板 (仓库内已包含 luci-theme-liuli / luci-app-liuli,
# 直接拷入编译树, 编进固件镜像, 刷完即自带, 无需再单独安装)
# 与 build-theme.yml 同一套 Makefile
# =========================================================
mkdir -p package/custom/liuli-theme package/custom/luci-app-liuli
cp -r "$GITHUB_WORKSPACE/luci-theme-liuli/." package/custom/liuli-theme/
cp -r "$GITHUB_WORKSPACE/luci-app-liuli/." package/custom/luci-app-liuli/
echo "liuli 主题/看板已加入编译树"

# =========================================================
# Lucky: 官方 luci-app-lucky v3.3.3 (LuCI 应用)
# 核心 lucky 包替换为 release.66666.host 官方 3.3.3 xiaojv
# 预编译静态二进制 (aarch64/arm64), 非 GitHub 快照源码编译
# =========================================================
git clone --depth=1 -b v3.3.3 https://github.com/gdy666/luci-app-lucky.git package/custom/lucky-app

cat > package/custom/lucky-app/lucky/Makefile <<'LUCKY_EOF'
# SPDX-License-Identifier: MIT
# Lucky core - official prebuilt static binary (3.3.3 xiaojv)

include $(TOPDIR)/rules.mk

PKG_NAME:=lucky
PKG_VERSION:=3.3.3
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=GDY666 <gdy666@foxmail.com>

LUCKY_ARCH:=

ifeq ($(ARCH),aarch64)
  LUCKY_ARCH:=arm64
endif
ifeq ($(ARCH),x86_64)
  LUCKY_ARCH:=x86_64
endif

PKG_SOURCE:=lucky_$(PKG_VERSION)_Linux_$(LUCKY_ARCH)_xiaojv.tar.gz
PKG_SOURCE_URL:=https://release.66666.host/v3.3.3beta/3.3.3_xiaojv/
PKG_HASH:=a0ff1fa14a08fa9b3aefc36644ebfcfa0be93a726abc28185aa3553b04af3b58
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/lucky
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Lucky network utility (official prebuilt 3.3.3 xiaojv)
  DEPENDS:=@(aarch64||x86_64)
  URL:=https://lucky666.cn
endef

define Package/lucky/description
 Lucky provides IPv4/IPv6 port forwarding, DDNS, Wake-on-LAN,
 reverse proxy, ACME automation and related network services.
 Prebuilt static binary from the official release server.
endef

define Package/lucky/conffiles
/etc/config/lucky
endef

define Build/Prepare
	$(INSTALL_DIR) $(PKG_BUILD_DIR)
	gzip -dc $(DL_DIR)/$(PKG_SOURCE) | $(HOST_TAR) -C $(PKG_BUILD_DIR) -xf -
	$(Build/Patch)
endef

define Build/Compile
endef

define Package/lucky/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lucky $(1)/usr/bin/lucky
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./files/lucky-call $(1)/usr/libexec/lucky-call
	$(INSTALL_BIN) ./files/lucky-watchdog $(1)/usr/libexec/lucky-watchdog
	$(INSTALL_DIR) $(1)/usr/share/lucky
	echo '$(LUCKY_ARCH)' > $(1)/usr/share/lucky/arch
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/lucky.init $(1)/etc/init.d/lucky
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/luckyuci $(1)/etc/config/lucky
endef

define Package/lucky/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || /usr/libexec/lucky-watchdog sync
endef

define Package/lucky/prerm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ] && [ "$${PKG_UPGRADE}" != 1 ]; then
	/etc/init.d/lucky stop
	/usr/libexec/lucky-watchdog remove
fi
endef

$(eval $(call BuildPackage,lucky))
LUCKY_EOF

# 科学插件 (仅克隆, 本精简版不编译)
# Passwall
rm -rf feeds/packages/net/{xray-core,v2ray-geodata,sing-box,chinadns-ng,dns2socks,hysteria,ipt2socks,microsocks,naiveproxy,shadowsocks-libev,shadowsocks-rust,shadowsocksr-libev,simple-obfs,tcping,trojan-plus,tuic-client,v2ray-plugin,xray-plugin,geoview,shadow-tls}
git clone --depth=1 https://github.com/Openwrt-Passwall/openwrt-passwall-packages.git package/custom/passwall-packages
rm -rf feeds/luci/applications/luci-app-passwall
git clone --depth=1 https://github.com/Openwrt-Passwall/openwrt-passwall.git package/custom/passwall
git clone --depth=1 https://github.com/Openwrt-Passwall/openwrt-passwall2.git package/custom/passwall2

# OpenClash update to new version
rm -rf feeds/luci/applications/luci-app-openclash
git clone --depth=1 -b dev https://github.com/vernesong/OpenClash.git feeds/luci/applications/luci-app-openclash

# 功能插件
git clone --depth=1 https://github.com/sbwml/luci-app-openlist2.git package/custom/openlist2

rm -rf feeds/packages/lang/golang
git clone https://github.com/sbwml/packages_lang_golang -b 26.x feeds/packages/lang/golang

# VPN
git clone --depth=1 https://github.com/EasyTier/luci-app-easytier.git package/custom/easytier

# change the default theme:
sed -i 's/+luci-theme-bootstrap/+luci-theme-argon/g; s/default Bootstrap theme/Argon theme/g' feeds/luci/collections/luci-light/Makefile

./scripts/feeds update -a
./scripts/feeds install -a
