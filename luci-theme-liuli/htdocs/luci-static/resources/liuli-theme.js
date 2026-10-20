/* 琉璃 Liuli — 主题色调控制
 * 三态: auto (按 19:00-07:00 自动夜间切换) / light / dark
 * 偏好存 localStorage, head.ut 里的内联脚本负责首屏预置, 本文件负责交互与跨点巡检。
 */
'use strict';

(function () {
	const KEY = 'liuli.theme';
	const ORDER = [ 'auto', 'light', 'dark' ];
	const LABEL = { auto: '自动', light: '日间', dark: '夜间' };

	/* 夜间时段与强制模式由 head.ut 从 /etc/config/liuli 注入到 <html> 属性上 */
	function nightRange() {
		const r = document.documentElement;
		const s = parseInt(r.getAttribute('data-liuli-night-start'), 10);
		const e = parseInt(r.getAttribute('data-liuli-night-end'), 10);
		return [ isNaN(s) ? 19 : s, isNaN(e) ? 7 : e ];
	}

	function forced() {
		const f = document.documentElement.getAttribute('data-liuli-force');
		return (f == 'light' || f == 'dark') ? f : null;
	}

	function getPref() {
		try { return localStorage.getItem(KEY) || 'auto'; }
		catch (e) { return 'auto'; }
	}

	function setPref(p) {
		try {
			if (p && p !== 'auto')
				localStorage.setItem(KEY, p);
			else
				localStorage.removeItem(KEY);
		} catch (e) {}
	}

	function resolve(pref) {
		const f = forced();
		if (f)
			return f;

		if (pref == 'dark' || pref == 'light')
			return pref;

		const h = new Date().getHours();
		const r = nightRange();

		if (h >= r[0] || h < r[1])
			return 'dark';

		try {
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
				return 'dark';
		} catch (e) {}

		return 'light';
	}

	function syncButtons() {
		const pref = getPref();
		const mode = document.documentElement.getAttribute('data-liuli-theme');
		const nodes = document.querySelectorAll('[data-liuli-toggle]');
		const f = forced();

		for (let i = 0; i < nodes.length; i++) {
			const el = nodes[i];

			/* 设置页里已强制锁定日间/夜间, 顶栏按钮不再显示 */
			if (f) {
				el.style.display = 'none';
				continue;
			}

			el.setAttribute('title', '主题: ' + LABEL[pref] + ' (当前' + LABEL[mode] + ') — 点击切换');
			el.setAttribute('aria-label', el.getAttribute('title'));

			const lb = el.querySelector('.liuli-theme-label');
			if (lb)
				lb.textContent = LABEL[pref] + ' · ' + LABEL[mode];
		}
	}

	function apply() {
		const pref = getPref();
		const r = document.documentElement;
		r.setAttribute('data-liuli-pref', pref);
		r.setAttribute('data-liuli-theme', resolve(pref));
		syncButtons();
	}

	function cycle(ev) {
		if (ev) {
			ev.preventDefault();
			ev.stopPropagation();
		}
		const cur = getPref();
		setPref(ORDER[(ORDER.indexOf(cur) + 1 + ORDER.length) % ORDER.length]);
		apply();
	}

	/* 供 onclick 直接调用 */
	window.liuliThemeToggle = cycle;

	document.addEventListener('click', function (ev) {
		const t = ev.target.closest ? ev.target.closest('[data-liuli-toggle]') : null;
		if (t)
			cycle(ev);
	});

	/* 系统主题变化时即时跟随 (仅在 auto 模式) */
	try {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = function () { apply(); };
		if (mq.addEventListener)
			mq.addEventListener('change', onChange);
		else if (mq.addListener)
			mq.addListener(onChange);
	} catch (e) {}

	/* ---------- 移动端抽屉: 遮罩 + 点外部关闭 + ESC 关闭 ---------- */

	function setupDrawer() {
		const nav = document.getElementById('mainmenu');
		if (!nav)
			return;

		let backdrop = document.querySelector('.liuli-navbackdrop');
		if (!backdrop) {
			backdrop = document.createElement('div');
			backdrop.className = 'liuli-navbackdrop';
			document.body.appendChild(backdrop);
		}

		const sync = () => backdrop.classList.toggle('show', nav.classList.contains('open'));
		const close = () => nav.classList.remove('open');

		backdrop.addEventListener('click', close);

		document.addEventListener('keydown', (ev) => {
			if (ev.key == 'Escape')
				close();
		});

		/* 侧栏类名变化同步到遮罩 */
		if (window.MutationObserver)
			new MutationObserver(sync).observe(nav, { attributes: true, attributeFilter: [ 'class' ] });
		else
			window.setInterval(sync, 200);

		/* 点击导航项后自动收起抽屉 (移动端) */
		nav.addEventListener('click', (ev) => {
			if (ev.target.closest && ev.target.closest('a') && window.matchMedia('(max-width: 980px)').matches)
				close();
		});

		/* 视口变宽时自动收起, 避免残留遮罩挡住页面 */
		const mq = window.matchMedia('(min-width: 981px)');
		const onWide = () => { if (mq.matches) close(); };
		if (mq.addEventListener)
			mq.addEventListener('change', onWide);
		else if (mq.addListener)
			mq.addListener(onWide);

		sync();
	}

	const boot = function () { apply(); setupDrawer(); };

	if (document.readyState == 'loading')
		document.addEventListener('DOMContentLoaded', boot);
	else
		boot();

	/* 自动模式下每分钟巡检一次, 跨过 19:00 / 07:00 时自动换肤 */
	window.setInterval(function () {
		if (getPref() == 'auto' && document.documentElement.getAttribute('data-liuli-theme') != resolve('auto'))
			apply();
	}, 60000);
})();
