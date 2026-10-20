#
# 琉璃 Liuli — LuCI glassmorphism theme
# Copyright 2026 likz0421
# Licensed under the Apache License 2.0
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-liuli
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=likz0421
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-theme-liuli
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=4. Themes
  TITLE:=Liuli (琉璃) Glassmorphism Theme
  DEPENDS:=+luci-base
  URL:=https://github.com/likz0421
endef

define Package/luci-theme-liuli/description
  A light glassmorphism LuCI theme: frosted panels, drifting gradient
  light blobs, hairline highlights, and a status topbar with device
  name, online clients, CPU, temperature, live traffic and clock.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/luci-theme-liuli/install
	$(INSTALL_DIR) $(1)/www/luci-static/liuli
	$(CP) ./htdocs/luci-static/liuli/* $(1)/www/luci-static/liuli/
	$(INSTALL_DIR) $(1)/www/luci-static/resources
	$(INSTALL_DATA) ./htdocs/luci-static/resources/*.js $(1)/www/luci-static/resources/
	$(INSTALL_DIR) $(1)/usr/share/ucode/luci/template/themes/liuli
	$(INSTALL_DATA) ./ucode/template/themes/liuli/*.ut $(1)/usr/share/ucode/luci/template/themes/liuli/
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/30_luci-theme-liuli $(1)/etc/uci-defaults/
endef

$(eval $(call BuildPackage,luci-theme-liuli))
