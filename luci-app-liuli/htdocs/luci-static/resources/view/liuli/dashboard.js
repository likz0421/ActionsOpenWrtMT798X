'use strict';
'require view';
'require rpc';
'require poll';

/* 琉璃看板 — Liuli device dashboard view
 * 设备列表 / 厂商与类型识别 / 连接状态 / 今日流量排行
 */

const callDevices = rpc.declare({
	object: 'luci.liuli',
	method: 'getDevices',
	expect: { leases: [], arp: [], stations: [], traffic: {} }
});

/* ---------- 设备类型图标 (1.7px 线性) ---------- */

const TYPE_ICONS = {
	phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5.5h3"/></svg>',
	tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M10.5 19h3"/></svg>',
	laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="11" rx="2"/><path d="M2 19h20l-2-2.5H4L2 19z"/></svg>',
	desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M9 20.5h6M12 16.5v4"/></svg>',
	tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="13" rx="2"/><path d="M8 21.5h8"/></svg>',
	nas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/></svg>',
	camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2.5h7L17 8h3a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V9.5A1.5 1.5 0 0 1 4 8Z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
	printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9V3.5h11V9"/><rect x="3.5" y="9" width="17" height="7.5" rx="1.5"/><path d="M6.5 14h11v6.5h-11z"/></svg>',
	iot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/></svg>',
	router: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 13V8M17 13V8M7 8l3-3.5M17 8l-3-3.5M7 16.5h.01M10.5 16.5h3"/></svg>',
	users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M5.5 21v-1.5a3.5 3.5 0 0 1 3-3.46M18.5 21v-1.5a3.5 3.5 0 0 0-3-3.46"/></svg>',
	down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10M12 14l-3.5-3.5M12 14l3.5-3.5"/><path d="M5 20h14"/></svg>',
	up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10M12 10l-3.5 3.5M12 10l3.5 3.5"/><path d="M5 4h14"/></svg>',
	unknown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.3"/><path d="M12 17.2h.01"/></svg>'
};

const TYPE_NAMES = {
	phone: '手机', tablet: '平板', laptop: '笔记本', desktop: '电脑',
	tv: '电视', nas: 'NAS', camera: '摄像头', printer: '打印机',
	iot: '智能设备', router: '路由器', unknown: '设备'
};

/* ---------- MAC OUI → 厂商 ---------- */

const OUI = {
	'001A11': 'Google', '3C5AB4': 'Google', 'F4F5D8': 'Google',
	'B827EB': 'Raspberry Pi', 'DCA632': 'Raspberry Pi', 'E45F01': 'Raspberry Pi', '286AB4': 'Raspberry Pi',
	'00044B': 'NVIDIA', '48B02D': 'NVIDIA',
	'001111': 'Intel', '0012F0': 'Intel', '001320': 'Intel', '001500': 'Intel', '001517': 'Intel',
	'00166F': 'Intel', '001676': 'Intel', '0016EA': 'Intel', '0016EB': 'Intel', '001733': 'Intel',
	'0018DE': 'Intel', '001907': 'Intel', '0019D1': 'Intel', '001B21': 'Intel', '001B77': 'Intel',
	'001CBF': 'Intel', '001CC0': 'Intel', '001DE0': 'Intel', '001DE1': 'Intel', '001E64': 'Intel',
	'001E65': 'Intel', '001E67': 'Intel', '001F3B': 'Intel', '001F3C': 'Intel', '00215C': 'Intel',
	'00216A': 'Intel', '00216B': 'Intel', '0022FA': 'Intel', '0022FB': 'Intel', '0024D6': 'Intel',
	'0024D7': 'Intel', '0026C6': 'Intel', '0026C7': 'Intel', '002710': 'Intel', '3413E8': 'Intel',
	'3C970E': 'Intel', '4025C2': 'Intel', '448500': 'Intel', '4CEB42': 'Intel', '5891CF': 'Intel',
	'5C514F': 'Intel', '5CE0C5': 'Intel', '605718': 'Intel', '648099': 'Intel', '6805CA': 'Intel',
	'6C8814': 'Intel', '701CE0': 'Intel', '74E50B': 'Intel', '78929C': 'Intel', '7C7A91': 'Intel',
	'8086F2': 'Intel', '843A4B': 'Intel', '887873': 'Intel', '8C705A': 'Intel', '902E16': 'Intel',
	'9459C0': 'Intel', '984FEE': 'Intel', '9C4E36': 'Intel', 'A0369F': 'Intel', 'A4BF01': 'Intel',
	'A86DAA': 'Intel', 'AC7BA1': 'Intel', 'B46BFC': 'Intel', 'B88AEC': 'Intel', 'BC0F64': 'Intel',
	'C85B76': 'Intel', 'D07E35': 'Intel', 'D8F2CA': 'Intel', 'DC5360': 'Intel', 'E4A7A0': 'Intel',
	'E82AEA': 'Intel', 'EC8EB5': 'Intel', 'F40669': 'Intel',
	'0023DF': 'Apple', '0026BB': 'Apple', '040CCE': 'Apple', '28CFDA': 'Apple', '542696': 'Apple',
	'60C547': 'Apple', '68A86D': 'Apple', '705681': 'Apple', '7C6D62': 'Apple', '8866A5': 'Apple',
	'90B21F': 'Apple', 'A46706': 'Apple', 'ACBC32': 'Apple', 'C869CD': 'Apple', 'D023DB': 'Apple',
	'D4909C': 'Apple', 'DC2B2A': 'Apple', 'E0F5C6': 'Apple', 'F0DBF8': 'Apple', '001E52': 'Apple',
	'002500': 'Apple', '00C612': 'Apple', '3C0754': 'Apple', '40B395': 'Apple', '001CB3': 'Apple',
	'002312': 'Apple', '002332': 'Apple', '002436': 'Apple', '0025BC': 'Apple', '10DDB1': 'Apple',
	'1499E2': 'Apple', '183451': 'Apple', '1C9180': 'Apple', '20C9D0': 'Apple', '28E02C': 'Apple',
	'3408BC': 'Apple', '38C93F': 'Apple', '3C2EF9': 'Apple', '44FB42': 'Apple', '4C57CA': 'Apple',
	'50DE06': 'Apple', '54E43A': 'Apple', '5C969D': 'Apple', '645AED': 'Apple', '6C96CF': 'Apple',
	'74E2F5': 'Apple', '784F43': 'Apple', '80E650': 'Apple', '843835': 'Apple', '8C587C': 'Apple',
	'9060D1': 'Apple', '949426': 'Apple', '9801A7': 'Apple', '9C207B': 'Apple', 'A0999B': 'Apple',
	'A4B197': 'Apple', 'A88808': 'Apple', 'AC1F74': 'Apple', 'B0481A': 'Apple', 'B8098A': 'Apple',
	'BC6C21': 'Apple', 'C0847A': 'Apple', 'C4B301': 'Apple', 'C82A14': 'Apple', 'CC08E0': 'Apple',
	'D0817A': 'Apple', 'D4DCCD': 'Apple', 'D89695': 'Apple', 'DCA904': 'Apple', 'E0ACCB': 'Apple',
	'E425E7': 'Apple', 'E88D28': 'Apple', 'EC852F': 'Apple', 'F01898': 'Apple', 'F45C89': 'Apple',
	'F81EDF': 'Apple', 'FC253F': 'Apple', '000D93': 'Apple', '001124': 'Apple', '001451': 'Apple',
	'0017F2': 'Apple', '0019E3': 'Apple', '001B63': 'Apple', '001FF3': 'Apple', '002241': 'Apple',
	'002608': 'Apple', '00264A': 'Apple', '0026B0': 'Apple',
	'001A2A': 'Samsung', '3423BA': 'Samsung', '5C0A5B': 'Samsung', '8C7712': 'Samsung', 'BC1485': 'Samsung',
	'E8508B': 'Samsung', '781FDB': 'Samsung', 'A02195': 'Samsung', 'C8D778': 'Samsung', '002637': 'Samsung',
	'001599': 'Samsung', '001247': 'Samsung', '002119': 'Samsung', '8425DB': 'Samsung', 'B479A7': 'Samsung',
	'8CBEBE': 'Xiaomi', '640980': 'Xiaomi', '7811DC': 'Xiaomi', 'F0B429': 'Xiaomi', '286C07': 'Xiaomi',
	'508F4C': 'Xiaomi', 'ACC1EE': 'Xiaomi', '04CF8C': 'Xiaomi', '001216': 'Xiaomi', '34CE00': 'Xiaomi',
	'7C8DD1': 'Xiaomi', 'F8A45F': 'Xiaomi', '009EC8': 'Xiaomi', '38A4ED': 'Xiaomi', '8C53C3': 'Xiaomi',
	'C40BCB': 'Xiaomi', '00EC0A': 'Xiaomi', '14F65A': 'Xiaomi', '2082C0': 'Xiaomi',
	'009ACD': 'HUAWEI', '48DB6F': 'HUAWEI', 'F04347': 'HUAWEI', '00E0FC': 'HUAWEI', 'E0247F': 'HUAWEI',
	'80B686': 'HUAWEI', '34CDBE': 'HUAWEI', '9C52F8': 'HUAWEI',
	'346B5B': 'Honor', '485AB2': 'Honor', '9C8C6E': 'Honor',
	'4C6B1A': 'OPPO', '8CD2E9': 'OPPO', 'D04AC1': 'OPPO', '5063A1': 'OPPO', '04D9F5': 'OPPO',
	'38E1AA': 'vivo', '986FE8': 'vivo', 'B08E1E': 'vivo', '44C346': 'vivo', 'C89BAD': 'vivo',
	'64A2F9': 'OnePlus', '94E6F7': 'OnePlus', 'C0EEFB': 'OnePlus', '94B234': 'OnePlus',
	'4A5AF1': 'realme', 'B0B9C6': 'realme',
	'0050F2': 'Microsoft', '00125A': 'Microsoft', '00155D': 'Microsoft', '0017FA': 'Microsoft',
	'001DD8': 'Microsoft', '002248': 'Microsoft', '281878': 'Microsoft', '7C1E52': 'Microsoft',
	'0003FF': 'Microsoft', '000D3A': 'Microsoft', '00BD3A': 'Microsoft', '501AC5': 'Microsoft',
	'5882A8': 'Microsoft', '6045BD': 'Microsoft', '7CED8D': 'Microsoft', '9CAA1B': 'Microsoft',
	'B40B44': 'Microsoft', 'DCB4C4': 'Microsoft', 'E498D6': 'Microsoft', '000E58': 'Microsoft',
	'001A79': 'TP-Link', '50C7BF': 'TP-Link', '98DAC4': 'TP-Link', '0023CD': 'TP-Link', 'EC086B': 'TP-Link',
	'001F3F': 'ASUSTek', '08606E': 'ASUSTek', '1C872C': 'ASUSTek', '2C4D54': 'ASUSTek', '38D547': 'ASUSTek',
	'4CEDFB': 'ASUSTek', '6045CB': 'ASUSTek', '74D02B': 'ASUSTek', 'AC220B': 'ASUSTek', 'BCAEC5': 'ASUSTek',
	'D850E6': 'ASUSTek', 'E03F49': 'ASUSTek', 'F46D04': 'ASUSTek',
	'001E8C': 'D-Link', '1C7EE5': 'D-Link', '9094E4': 'D-Link', '001B11': 'D-Link', '00265A': 'D-Link',
	'000F3F': 'NETGEAR', '204E7F': 'NETGEAR', '9C3DCF': 'NETGEAR', 'A040A0': 'NETGEAR', 'E091F5': 'NETGEAR',
	'001C14': 'NETGEAR', '001463': 'NETGEAR', '00184D': 'NETGEAR', '001B2F': 'NETGEAR', '00223F': 'NETGEAR',
	'0024B2': 'NETGEAR', '0026F2': 'NETGEAR',
	'001349': 'Zyxel', '5CF4AB': 'Zyxel', 'B0B2DC': 'Zyxel', '0019CB': 'Zyxel',
	'C83A35': 'Tenda',
	'000C42': 'MikroTik', '4C5E0C': 'MikroTik', '6C3B6B': 'MikroTik', '488F5A': 'MikroTik', '744D28': 'MikroTik',
	'00156D': 'Ubiquiti', '24A43C': 'Ubiquiti', '788A20': 'Ubiquiti', 'FCECDA': 'Ubiquiti', '44D9E7': 'Ubiquiti',
	'001AA1': 'Cisco', '00260B': 'Cisco', '000A41': 'Cisco', '001BD4': 'Cisco', '001A2B': 'Cisco',
	'00BB3A': 'Amazon', '44500D': 'Amazon', '6854FD': 'Amazon', '74C246': 'Amazon', 'F0272D': 'Amazon',
	'F0D2F1': 'Amazon', '40B4CD': 'Amazon', '0C47C9': 'Amazon', 'AC63BE': 'Amazon',
	'001788': 'Philips', 'ECB5FA': 'Philips',
	'001E75': 'LG', '001C62': 'LG', '001F6B': 'LG', '0021FB': 'LG', '002483': 'LG', '0026E2': 'LG',
	'2C598A': 'LG',
	'0013A9': 'Sony', '001DBA': 'Sony', '0024BE': 'Sony', '30F9ED': 'Sony', '78843C': 'Sony',
	'A8E3EE': 'Sony', 'FC0FE6': 'Sony',
	'001BA9': 'Brother', '008077': 'Brother', '3055C3': 'Brother',
	'000085': 'Canon', '8891DD': 'Canon',
	'00215A': 'Hewlett-Packard', '001F29': 'Hewlett-Packard', '0025B3': 'Hewlett-Packard',
	'3CD92B': 'Hewlett-Packard', '000F20': 'Hewlett-Packard', '00110A': 'Hewlett-Packard',
	'001438': 'Hewlett-Packard', '001708': 'Hewlett-Packard', '001B78': 'Hewlett-Packard',
	'00237D': 'Hewlett-Packard', '000D9D': 'Hewlett-Packard', '000F61': 'Hewlett-Packard',
	'001279': 'Hewlett-Packard', '001321': 'Hewlett-Packard', '001635': 'Hewlett-Packard',
	'001871': 'Hewlett-Packard', '0019BB': 'Hewlett-Packard', '001A4B': 'Hewlett-Packard',
	'001E0B': 'Hewlett-Packard', '001FFE': 'Hewlett-Packard', '0060B0': 'Hewlett-Packard',
	'0080A0': 'Hewlett-Packard', '082E5F': 'Hewlett-Packard', '1CC1DE': 'Hewlett-Packard',
	'2C4138': 'Hewlett-Packard', '308D99': 'Hewlett-Packard', '3C4A92': 'Hewlett-Packard',
	'0000E2': 'Acer', '0021CC': 'Acer', '002622': 'Acer', '00C09F': 'Acer',
	'0024E4': 'Withings', '4480EB': 'Withings',
	'000E58': 'Sonos', '5CAAFD': 'Sonos', '948127': 'Sonos', 'B8E937': 'Sonos', '782885': 'Sonos',
	'240AC4': 'Espressif', '3C71BF': 'Espressif', '84F3EB': 'Espressif', 'A4CF12': 'Espressif',
	'B4E62D': 'Espressif', 'CC50E3': 'Espressif', 'DC4F22': 'Espressif', 'ECFA40': 'Espressif',
	'483FDA': 'Espressif', '8CAA60': 'Espressif'
};

function vendorOf(mac) {
	const p = String(mac || '').toUpperCase().replace(/[^0-9A-F]/g, '').substr(0, 6);
	return OUI[p] || null;
}

/* ---------- 设备类型识别 ---------- */

function typeOf(hostname, vendor) {
	const h = String(hostname || '').toLowerCase();

	if (/iphone/.test(h)) return 'phone';
	if (/ipad/.test(h)) return 'tablet';
	if (/macbook|imac|macmini|mac-pro|macpro|osx|darwin/.test(h)) return 'laptop';
	if (/android|redmi|poco|harmony|mate\d|honor|oppo|vivo|oneplus|realme|iqoo|nova|reno|findx|小米|华为|荣耀|红米/.test(h)) return 'phone';
	if (/desktop|workstation|win-|-pc$|^pc$|ubuntu|debian|archlinux|centos|fedora|windows|linux/.test(h)) return 'desktop';
	if (/tv|television|chromecast|firetv|appletv|roku|shield|电视|机顶盒/.test(h)) return 'tv';
	if (/nas|synology|ds\d{3}|qnap|terramaster|freenas|truenas|openmediavault|群晖|威联通/.test(h)) return 'nas';
	if (/cam|camera|ipc|doorbell|摄像头|门铃/.test(h)) return 'camera';
	if (/printer|print|打印机/.test(h)) return 'printer';
	if (/esp|esp32|esp8266|sonoff|tasmota|shelly|tuya|zigbee|sensor|智能|插座|灯泡|温控/.test(h)) return 'iot';
	if (/openwrt|immortalwrt|lede|padavan|router|ap-|repeater|extender|switch/.test(h)) return 'router';

	if (vendor) {
		const v = vendor.toLowerCase();
		if (v == 'apple') return 'phone';
		if (/samsung|xiaomi|huawei|honor|oppo|vivo|oneplus|realme/.test(v)) return 'phone';
		if (v == 'intel' || v == 'microsoft') return 'desktop';
		if (v == 'raspberry pi') return 'nas';
		if (/tp-link|netgear|d-link|tenda|zyxel|ubiquiti|cisco|mikrotik/.test(v)) return 'router';
		if (v == 'sony' || v == 'lg' || v == 'philips') return 'tv';
		if (/hewlett-packard|brother|canon|epson/.test(v)) return 'printer';
		if (v == 'amazon' || v == 'espressif' || v == 'sonos' || v == 'withings') return 'iot';
	}
	return 'unknown';
}

/* ---------- 工具 ---------- */

function fmtBytes(n) {
	n = Number(n) || 0;
	if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
	if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
	if (n >= 1024) return (n / 1024).toFixed(0) + ' KB';
	return n + ' B';
}

function fmtMac(mac) {
	return String(mac || '').toUpperCase();
}

function shortMac(mac) {
	const m = fmtMac(mac);
	return m.substr(m.length - 5);
}

function signalText(sig) {
	if (sig == null)
		return null;
	const n = Number(sig);
	if (isNaN(n))
		return null;
	if (n >= -50) return n + ' dBm 极佳';
	if (n >= -60) return n + ' dBm 良好';
	if (n >= -70) return n + ' dBm 一般';
	return n + ' dBm 较弱';
}

function wifiBand(iface) {
	const i = String(iface || '');
	if (/rai|ax|5g|5ghz|band5/i.test(i)) return '5G';
	if (/ra0|2g|2\.4/i.test(i)) return '2.4G';
	return null;
}

function iconEl(type, cls) {
	const el = E('span', { 'class': cls || 'ico' });
	el.innerHTML = TYPE_ICONS[type] || TYPE_ICONS.unknown;
	return el;
}

/* ---------- 视图 ---------- */

return view.extend({
	load() {
		return Promise.all([ callDevices() ]);
	},

	render(raw) {
		const self = this;
		const d = raw[0] ?? {};
		const selfMacs = {};
		for (let m of (d.self_macs ?? []))
			selfMacs[fmtMac(m)] = 1;

		/* 合并: MAC → 设备 */
		const devices = {};
		const upsert = (mac, info) => {
			mac = fmtMac(mac);
			if (!mac || mac == '00:00:00:00:00:00' || selfMacs[mac])
				return;
			devices[mac] = devices[mac] ?? {
				mac: mac, ip: null, hostname: null, online: false,
				wireless: false, signal: null, iface: null, rx: 0, tx: 0
			};
			const dev = devices[mac];
			if (info.ip && !dev.ip) dev.ip = info.ip;
			if (info.hostname && !dev.hostname) dev.hostname = info.hostname;
			if (info.online) dev.online = true;
			if (info.wireless) dev.wireless = true;
			if (info.signal != null && dev.signal == null) dev.signal = info.signal;
			if (info.iface && !dev.iface) dev.iface = info.iface;
			if (info.rx) dev.rx += info.rx;
			if (info.tx) dev.tx += info.tx;
		};

		const now = Date.now() / 1000;
		for (let l of (d.leases ?? []))
			upsert(l.mac, { ip: l.ip, hostname: l.hostname, online: Number(l.expiry) > now });
		for (let a of (d.arp ?? []))
			upsert(a.mac, { ip: a.ip, online: true });
		for (let s of (d.stations ?? []))
			upsert(s.mac, { wireless: true, signal: s.signal, iface: s.iface, online: true });

		const traffic = d.traffic ?? {};
		for (let mac in devices) {
			const dev = devices[mac];
			const t = traffic[dev.ip];
			if (t) {
				dev.rx += Number(t.rx) || 0;
				dev.tx += Number(t.tx) || 0;
			}
			dev.vendor = vendorOf(dev.mac) || '未知';
			dev.type = typeOf(dev.hostname, dev.vendor);
			dev.name = dev.hostname || (dev.vendor + '-' + shortMac(dev.mac));
		}

		const list = [];
		for (let mac in devices)
			list.push(devices[mac]);

		let online = 0, totalRx = 0, totalTx = 0;
		for (let dev of list) {
			if (dev.online) online++;
			totalRx += dev.rx;
			totalTx += dev.tx;
		}
		list.sort((a, b) => (b.rx + b.tx) - (a.rx + a.tx));

		let rank = 0, last = -1;
		for (let i = 0; i < list.length; i++) {
			const total = list[i].rx + list[i].tx;
			if (total !== last) { rank = i + 1; last = total; }
			list[i].rank = total > 0 ? rank : 0;
		}

		const top = list.length ? list[0] : null;
		const topTotal = top ? (top.rx + top.tx) : 0;

		/* ---- 汇总卡片 ---- */
		const summary = E('div', { 'class': 'liuli-grid' }, [
			this.metric('设备总数', list.length, '台', 'router'),
			this.metric('在线设备', online, '台', 'users'),
			this.metric('今日总下载', fmtBytes(totalRx), '', 'down'),
			this.metric('今日总上传', fmtBytes(totalTx), '', 'up')
		]);

		/* ---- TOP1 英雄卡 ---- */
		let hero = null;
		if (top && topTotal > 0) {
			hero = E('div', { 'class': 'liuli-hero' }, [
				iconEl(top.type, 'liuli-hero-icon'),
				E('div', { 'class': 'liuli-hero-body' }, [
					E('div', { 'class': 'liuli-hero-title' }, [ '今日流量冠军' ]),
					E('div', { 'class': 'liuli-hero-name' }, [ top.name ]),
					E('div', { 'class': 'liuli-hero-meta' }, [
						`${TYPE_NAMES[top.type] || '设备'} · ${top.vendor} · ${top.wireless ? '无线' : '有线'} · ${top.ip || '—'}`
					]),
					E('div', { 'class': 'liuli-hero-traffic' }, [
						`↓ ${fmtBytes(top.rx)}`, E('span', { 'class': 'sep' }, '/'), `↑ ${fmtBytes(top.tx)}`
					])
				]),
				E('div', { 'class': 'liuli-hero-badge' }, [ 'TOP 1' ])
			]);
		}

		/* ---- 筛选 ---- */
		const filters = [
			{ key: 'all', label: '全部' },
			{ key: 'online', label: '在线' },
			{ key: 'wireless', label: '无线' },
			{ key: 'phone', label: '手机' },
			{ key: 'computer', label: '电脑' },
			{ key: 'tv', label: '电视' },
			{ key: 'nas', label: 'NAS' },
			{ key: 'iot', label: '智能设备' }
		];
		const filterBar = E('div', { 'class': 'liuli-filters' });
		for (const f of filters) {
			filterBar.appendChild(E('button', {
				'class': 'liuli-filter' + (f.key == 'all' ? ' active' : ''),
				'click': (ev) => {
					filterBar.querySelectorAll('.liuli-filter').forEach(b => b.classList.remove('active'));
					ev.currentTarget.classList.add('active');
					self.applyFilter(f.key);
				}
			}, [ f.label ]));
		}

		/* ---- 设备列表 ---- */
		const listEl = E('div', { 'class': 'liuli-devices' });
		const nodes = {};
		for (const dev of list) {
			const node = this.deviceCard(dev);
			nodes[dev.mac] = node;
			listEl.appendChild(node);
		}

		this.deviceNodes = nodes;
		this.deviceList = list;

		const root = E('div', { 'class': 'liuli-dash' }, [
			E('link', { 'rel': 'stylesheet', 'href': L.resource('view/liuli.css') }),
			E('div', { 'class': 'liuli-pagehead' }, [
				E('div', {}, [
					E('h2', {}, ['设备看板']),
					E('div', { 'class': 'desc' }, [ `统计日期 ${d.date || '—'} · 数据每 10 秒自动刷新` ])
				]),
				E('button', {
					'class': 'cbi-button cbi-button-add',
					'click': () => this.refresh()
				}, ['刷新'])
			]),
			summary,
			hero,
			filterBar,
			listEl,
			E('div', { 'class': 'liuli-note' }, [
				'流量统计基于 nftables 每设备计数器; 若路由器开启了软硬件流控转发, 单设备统计可能偏低。'
			])
		]);

		poll.add(L.bind(this.refresh, this), 10);

		return root;
	},

	metric(label, value, unit, icon) {
		return E('div', { 'class': 'liuli-card liuli-metric' }, [
			E('div', { 'class': 'top' }, [ iconEl(icon, 'ico'), label ]),
			E('div', { 'class': 'val' }, [ String(value), E('small', {}, [ unit ]) ])
		]);
	},

	deviceCard(dev) {
		const type = dev.type || 'unknown';
		const band = dev.wireless ? (wifiBand(dev.iface) || '无线') : '有线';
		const sig = dev.wireless ? signalText(dev.signal) : null;

		const node = E('div', {
			'class': 'liuli-card liuli-device' + (dev.online ? '' : ' offline'),
			'data-type': type,
			'data-online': dev.online ? '1' : '0',
			'data-wireless': dev.wireless ? '1' : '0'
		}, [
			E('div', { 'class': 'd-head' }, [
				iconEl(type, 'd-icon'),
				E('div', { 'class': 'd-title' }, [
					E('div', { 'class': 'd-name' }, [ dev.name ]),
					E('div', { 'class': 'd-meta' }, [ `${dev.vendor} · ${TYPE_NAMES[type] || '设备'}` ])
				]),
				dev.rank == 1 ? E('span', { 'class': 'd-rank top' }, ['TOP 1']) :
					(dev.rank > 1 ? E('span', { 'class': 'd-rank' }, ['#' + dev.rank]) : null)
			]),
			E('div', { 'class': 'd-rows' }, [
				E('div', { 'class': 'd-row' }, [ E('span', { 'class': 'k' }, ['IP 地址']), E('span', { 'class': 'v mono' }, [ dev.ip || '—' ]) ]),
				E('div', { 'class': 'd-row' }, [ E('span', { 'class': 'k' }, ['MAC']), E('span', { 'class': 'v mono' }, [ dev.mac ]) ]),
				E('div', { 'class': 'd-row' }, [ E('span', { 'class': 'k' }, ['连接方式']), E('span', { 'class': 'v' }, [ band + (sig ? ` · ${sig}` : '') ]) ]),
				E('div', { 'class': 'd-row' }, [ E('span', { 'class': 'k' }, ['今日流量']), E('span', { 'class': 'v mono traffic' }, [ `↓ ${fmtBytes(dev.rx)} · ↑ ${fmtBytes(dev.tx)}` ]) ])
			]),
			E('div', { 'class': 'd-status' }, [
				E('span', { 'class': 'dot' + (dev.online ? ' on' : '') }),
				dev.online ? '在线' : '离线'
			])
		]);

		return node;
	},

	applyFilter(key) {
		for (const dev of this.deviceList) {
			const node = this.deviceNodes[dev.mac];
			if (!node)
				continue;
			let show = true;
			if (key == 'online') show = dev.online;
			else if (key == 'wireless') show = dev.wireless;
			else if (key == 'phone') show = (dev.type == 'phone' || dev.type == 'tablet');
			else if (key == 'computer') show = (dev.type == 'laptop' || dev.type == 'desktop');
			else if (key == 'tv') show = (dev.type == 'tv');
			else if (key == 'nas') show = (dev.type == 'nas');
			else if (key == 'iot') show = (dev.type == 'iot');
			node.style.display = show ? '' : 'none';
		}
	},

	refresh() {
		const self = this;
		callDevices().then(function(raw) {
			const d = raw ?? {};
			const selfMacs = {};
			for (let m of (d.self_macs ?? []))
				selfMacs[fmtMac(m)] = 1;
			const traffic = d.traffic ?? {};
			const stations = {};
			for (let s of (d.stations ?? []))
				stations[fmtMac(s.mac)] = s;
			const arp = {};
			for (let a of (d.arp ?? []))
				arp[fmtMac(a.mac)] = a.ip;
			const leases = {};
			for (let l of (d.leases ?? []))
				leases[fmtMac(l.mac)] = l;

			for (let mac in self.deviceNodes) {
				if (selfMacs[mac])
					continue;
				const node = self.deviceNodes[mac];
				const ip = leases[mac]?.ip ?? arp[mac];
				const t = traffic[ip];
				const on = arp[mac] || stations[mac];
				const trafficEl = node.querySelector('.traffic');
				if (t && trafficEl)
					trafficEl.textContent = `↓ ${fmtBytes(t.rx)} · ↑ ${fmtBytes(t.tx)}`;
				const dot = node.querySelector('.dot');
				const statusText = node.querySelector('.d-status');
				if (dot && statusText) {
					dot.className = 'dot' + (on ? ' on' : '');
					statusText.lastChild.textContent = on ? '在线' : '离线';
				}
			}
		}).catch(function() {});
	}
});
