/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class SyncHookCodeFactory extends HookCodeFactory {
	// 钩子代码的内容 根据钩子类型不同 调用不同的call方法，此处调用的是callTapsSeries
	content({ onError, onDone, rethrowIfPossible }) {
		return this.callTapsSeries({
			onError: (i, err) => onError(err),
			onDone,
			rethrowIfPossible
		});
	}
}

const factory = new SyncHookCodeFactory();

class SyncHook extends Hook {
	// 同步钩子上不能使用该方法
	tapAsync() {
		throw new Error("tapAsync is not supported on a SyncHook");
	}

	// 同步钩子上不能使用该方法
	tapPromise() {
		throw new Error("tapPromise is not supported on a SyncHook");
	}

	// 重写compile
	// 参数为：{
	// 	taps: this.taps,
	// 	interceptors: this.interceptors,
	// 	args: this._args,
	// 	type: type
	// }
	compile(options) {
		factory.setup(this, options);
		return factory.create(options);
	}
}

module.exports = SyncHook;
