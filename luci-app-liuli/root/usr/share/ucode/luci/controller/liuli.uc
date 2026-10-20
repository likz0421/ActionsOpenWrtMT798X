// 琉璃看板 — Liuli device dashboard
// Copyright 2026 likz0421
// Licensed under the Apache License 2.0

'use strict';

entry({
	'admin/status/liuli': {
		title: '设备看板',
		order: 6,
		action: function() {
			return { type: 'view', path: 'liuli/dashboard' };
		}
	}
});
