'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require rpc';
'require ui';

/* 琉璃 Liuli — 主题外观设置
 * 全部改动写入 /etc/config/liuli, 由主题模板 head.ut / sysauth.ut
 * 在每次页面渲染时读取并注入 <style>, 无需重启, 刷新即可生效。
 */

const callFileWrite = rpc.declare({
	object: 'file',
	method: 'write',
	params: [ 'path', 'data', 'mode', 'base64' ]
});

const SCHEMES = [
	[ 'aurora',   '极光 (默认 · 靛蓝紫)', '#5b7cfa', '#8b5cf6' ],
	[ 'ocean',    '深海 (青蓝)',          '#0ea5e9', '#6366f1' ],
	[ 'sunset',   '晚霞 (橙粉)',          '#fb7185', '#f59e0b' ],
	[ 'forest',   '森野 (青绿)',          '#10b981', '#0ea5e9' ],
	[ 'graphite', '石墨 (中性灰蓝)',      '#64748b', '#334155' ],
	[ 'wine',     '酒红 (玫瑰)',          '#e11d48', '#a21caf' ],
	[ 'custom',   '自定义 (使用下方取色器)', '', '' ]
];

function upload(input, target) {
	const f = input && input.files && input.files[0];
	if (!f)
		return Promise.reject(new Error('请先选择图片文件'));

	if (f.size > 3 * 1024 * 1024)
		return Promise.reject(new Error('图片过大 (最大 3MB)'));

	return new Promise((resolve, reject) => {
		const rd = new FileReader();
		rd.onerror = () => reject(new Error('读取文件失败'));
		rd.onload = () => {
			const b64 = String(rd.result).replace(/^data:.*?;base64,/, '');
			callFileWrite(target, b64, 420, true)
				.then(() => resolve(target))
				.catch(reject);
		};
		rd.readAsDataURL(f);
	});
}

return view.extend({
	render() {
		const m = new form.Map('liuli', _('琉璃主题设置'),
			_('自定义主题配色、背景图、登录页背景与玻璃质感。所有设置写入 /etc/config/liuli，保存后刷新页面即可生效。'));

		this.map = m;

		const s = m.section(form.TypedSection, 'theme', _('外观方案'));
		s.anonymous = true;
		s.addremove = false;

		/* ---------- 配置导入 / 导出 ---------- */

		const io = s.option(form.DummyValue, '_io', _('配置导入 / 导出'));
		io.rawhtml = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:2px 0 4px">' +
			'<button type="button" class="cbi-button cbi-button-apply" data-liuli-export="1">导出当前配置</button>' +
			'<button type="button" class="cbi-button" data-liuli-import="1">导入配置</button>' +
			'<input type="file" accept=".conf,.txt,application/json,text/plain" data-liuli-import-file style="display:none">' +
			'<span data-liuli-io-msg style="font-size:11px;color:#94a3b8"></span>' +
			'</div><div style="font-size:11px;color:#94a3b8;margin-top:4px">导出的 .conf 可在另一台装了琉璃主题的机器上「导入配置」一键还原配色与背景设置</div>';

		/* ---------- 配色 ---------- */

		const scheme = s.option(form.ListValue, 'scheme', _('内置配色方案'));
		for (const v of SCHEMES)
			scheme.value(v[0], v[1]);
		scheme.default = 'aurora';
		scheme.onchange = L.bind(function (ev, section, value) {
			for (const v of SCHEMES)
				if (v[0] == value && v[2]) {
					const p = this.map.findElement('option', 'theme', section, 'primary');
					const p2 = this.map.findElement('option', 'theme', section, 'primary2');
					if (p) p.setValue(v[2]);
					if (p2) p2.setValue(v[3]);
				}
		}, this);

		const primary = s.option(form.Value, 'primary', _('主色调'));
		primary.default = '#5b7cfa';
		primary.datatype = 'string';
		primary.rmempty = false;

		const primary2 = s.option(form.Value, 'primary2', _('辅助色 (渐变末端)'));
		primary2.default = '#8b5cf6';
		primary2.datatype = 'string';
		primary2.rmempty = false;

		/* 渐变色卡: 点击直接填入上面两个取色框 */
		const sw = s.option(form.DummyValue, '_swatches', _('渐变色卡'));
		sw.rawhtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 6px">' +
			SCHEMES.filter((v) => v[2]).map((v) =>
				'<button type="button" data-liuli-grad="' + v[2] + ',' + v[3] + '" title="' + v[1] + '" ' +
				'style="width:44px;height:28px;border-radius:8px;cursor:pointer;border:1px solid rgba(148,163,184,.35);' +
				'background:linear-gradient(135deg,' + v[2] + ',' + v[3] + ')"></button>').join('') +
			'</div><div style="font-size:11px;color:#94a3b8">点击色卡可一键套用渐变，也可在上面的输入框里直接写十六进制色值</div>';

		/* ---------- 背景 ---------- */

		s.option(form.DummyValue, '_bgsep', '').rawhtml = '<hr style="margin:18px 0;border:none;border-top:1px solid rgba(148,163,184,.25)">';

		const bg = s.option(form.Value, 'bg_image', _('主界面背景图 URL'),
			_('留空则使用内置的渐变光斑背景。可填图片 URL，也可用下方的上传按钮上传本地图片。'));
		bg.rmempty = true;

		const bgupload = s.option(form.DummyValue, '_bgupload', _('上传主界面背景'));
		bgupload.rawhtml =
			'<input type="file" accept="image/*" data-liuli-upload="/www/luci-static/liuli/liuli-bg" ' +
			'style="font-size:12px"> <button type="button" class="cbi-button" ' +
			'data-liuli-do="/www/luci-static/liuli/liuli-bg" data-liuli-opt="bg_image">上传并应用</button>' +
			' <button type="button" class="cbi-button" data-liuli-clear="bg_image">清除背景</button>' +
			'<div style="font-size:11px;color:#94a3b8;margin-top:6px">支持 jpg/png/webp，最大 3MB</div>';

		const bgdim = s.option(form.ListValue, 'bg_dim', _('背景压暗'),
			_('背景图太亮导致文字看不清时开启。'));
		bgdim.value('0', _('不压暗'));
		bgdim.value('20', _('轻微压暗 20%'));
		bgdim.value('40', _('中等压暗 40%'));
		bgdim.value('60', _('强压暗 60%'));
		bgdim.default = '0';

		const lbg = s.option(form.Value, 'login_bg', _('登录页背景图 URL'),
			_('留空则跟随主界面背景。'));
		lbg.rmempty = true;

		const lbgup = s.option(form.DummyValue, '_lbgupload', _('上传登录页背景'));
		lbgup.rawhtml =
			'<input type="file" accept="image/*" data-liuli-upload="/www/luci-static/liuli/liuli-login-bg" ' +
			'style="font-size:12px"> <button type="button" class="cbi-button" ' +
			'data-liuli-do="/www/luci-static/liuli/liuli-login-bg" data-liuli-opt="login_bg">上传并应用</button>' +
			' <button type="button" class="cbi-button" data-liuli-clear="login_bg">清除背景</button>';

		/* ---------- 质感 ---------- */

		s.option(form.DummyValue, '_qsep', '').rawhtml = '<hr style="margin:18px 0;border:none;border-top:1px solid rgba(148,163,184,.25)">';

		const blur = s.option(form.Value, 'blur', _('毛玻璃模糊强度 (px)'),
			_('数值越大越朦胧，性能开销也越大；低端设备建议 10-16。'));
		blur.datatype = 'range(0,40)';
		blur.default = '22';

		const radius = s.option(form.Value, 'radius', _('卡片圆角 (px)'));
		radius.datatype = 'range(0,32)';
		radius.default = '18';

		const glass = s.option(form.Value, 'glass', _('玻璃不透明度 (%)'),
			_('越高越不透明，越低越通透。'));
		glass.datatype = 'range(20,100)';
		glass.default = '62';

		const blobs = s.option(form.ListValue, 'blobs', _('背景光斑动效'));
		blobs.value('1', _('开启'));
		blobs.value('0', _('关闭 (省电)'));
		blobs.default = '1';

		const chips = s.option(form.ListValue, 'chips', _('顶栏状态胶囊'));
		chips.value('1', _('显示'));
		chips.value('0', _('隐藏'));
		chips.default = '1';

		/* ---------- 夜间模式 ---------- */

		s.option(form.DummyValue, '_nsep', '').rawhtml = '<hr style="margin:18px 0;border:none;border-top:1px solid rgba(148,163,184,.25)">';

		const dark = s.option(form.ListValue, 'dark', _('主题色调'),
			_('“自动”会按下面的时间段在日间/夜间模式之间自动切换；顶栏的太阳图标可随时手动覆盖。'));
		dark.value('auto', _('自动 (按时间段)'));
		dark.value('light', _('始终日间'));
		dark.value('dark', _('始终夜间'));
		dark.default = 'auto';

		const ds = s.option(form.Value, 'dark_start', _('夜间开始时间 (0-23)'));
		ds.datatype = 'range(0,23)';
		ds.default = '19';
		ds.depends('dark', 'auto');

		const de = s.option(form.Value, 'dark_end', _('夜间结束时间 (0-23)'));
		de.datatype = 'range(0,23)';
		de.default = '7';
		de.depends('dark', 'auto');

		return m.render().then((node) => {
			const ioMsg = node.querySelector('[data-liuli-io-msg]');
			const setMsg = (t) => { if (ioMsg) ioMsg.textContent = t; };
			const callGet = rpc.declare({ object: 'luci.liuli-theme', method: 'getConfig', params: [] });
			const callSet = rpc.declare({ object: 'luci.liuli-theme', method: 'setConfig', params: ['config'] });

			/* 导入: 选择文件后读取并写回 */
			const fileInput = node.querySelector('[data-liuli-import-file]');
			if (fileInput)
				fileInput.addEventListener('change', (ev) => {
					const f = ev.target.files && ev.target.files[0];
					if (!f)
						return;
					const rd = new FileReader();
					rd.onerror = () => setMsg('读取文件失败');
					rd.onload = () => {
						const text = String(rd.result);
						setMsg('正在写入配置…');
						callSet(text).then((r) => {
							if (r && r.ok) {
								setMsg('导入成功，正在刷新…');
								window.setTimeout(() => window.location.reload(), 600);
							} else {
								setMsg('导入失败: ' + ((r && r.error) ? r.error : '未知错误'));
							}
						}).catch((e) => setMsg('导入失败: ' + e));
					};
					rd.readAsText(f);
					ev.target.value = '';
				});

			/* 上传交互 */
			node.addEventListener('click', (ev) => {
				const target = ev.target;

				if (target.dataset.liuliExport != null) {
					setMsg('正在读取配置…');
					callGet().then((r) => {
						const cfg = (r && r.config) ? r.config : '';
						const blob = new Blob([cfg], { type: 'text/plain;charset=utf-8' });
						const a = document.createElement('a');
						const d = new Date().toISOString().slice(0, 10);
						a.href = URL.createObjectURL(blob);
						a.download = 'liuli-theme-' + d + '.conf';
						a.click();
						URL.revokeObjectURL(a.href);
						setMsg('已导出 ' + cfg.length + ' 字节');
					}).catch((e) => setMsg('导出失败: ' + e));
					return;
				}

				if (target.dataset.liuliImport != null) {
					if (fileInput)
						fileInput.click();
					return;
				}

				if (target.dataset.liuliDo) {
					const path = target.dataset.liuliDo;
					const opt = target.dataset.liuliOpt;
					const input = node.querySelector('[data-liuli-upload="' + path + '"]');

					target.disabled = true;
					target.textContent = '上传中…';

					upload(input, path).then(() => {
						const el = this.map.findElement('option', 'theme', null, opt);
						if (el)
							el.setValue(path + '?t=' + Date.now());
						ui.addNotification(null, E('p', {}, _('背景已上传，点击底部“保存并应用”生效')), 'success');
					}).catch((e) => {
						ui.addNotification(null, E('p', {}, _('上传失败: ') + e.message), 'danger');
					}).finally(() => {
						target.disabled = false;
						target.textContent = '上传并应用';
					});
				}

				if (target.dataset.liuliClear) {
					const el = this.map.findElement('option', 'theme', null, target.dataset.liuliClear);
					if (el)
						el.setValue('');
					ui.addNotification(null, E('p', {}, _('已清空，点击底部“保存”生效')));
				}

				const grad = target.dataset.liuliGrad;
				if (grad) {
					const parts = grad.split(',');
					const p = this.map.findElement('option', 'theme', null, 'primary');
					const p2 = this.map.findElement('option', 'theme', null, 'primary2');
					if (p) p.setValue(parts[0]);
					if (p2) p2.setValue(parts[1]);
				}
			});

			return node;
		});
	},

	handleSave(ev) {
		return this.map.save().then(() => {
			ui.addNotification(null, E('p', {}, _('设置已保存，正在刷新页面…')), 'success');
			window.setTimeout(() => { window.location.reload(); }, 700);
		});
	},

	handleReset: null,
	handleSaveApply: null
});
