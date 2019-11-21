（注：建议大家在看该文档的同时，边实践边思考作者会以什么样的方式来实现这样的操作）
# Tapable

The tapable package expose many Hook classes, which can be used to create hooks for plugins.
tapable库会暴露一些钩子，可用于插件
``` javascript
const {
	SyncHook,
	SyncBailHook,
	SyncWaterfallHook,
	SyncLoopHook,
	AsyncParallelHook,
	AsyncParallelBailHook,
	AsyncSeriesHook,
	AsyncSeriesBailHook,
	AsyncSeriesWaterfallHook
 } = require("tapable");
```

## Installation

``` shell
npm install --save tapable
```

## Usage

All Hook constructors take one optional argument, which is a list of argument names as strings.
所有的钩子构造函数都接受一个可选参数，这个参数是一个字符串数组（必须完整声明所有的参数，否则在注册回调函数时接收不到传递的多余参数）
``` js
const hook = new SyncHook(["arg1", "arg2", "arg3"]);
```

The best practice is to expose all hooks of a class in a `hooks` property:
最佳实践是在一个类里边的hooks属性上暴露所有的钩子（可参考webpack源码中的插件）
``` js
class Car {
	constructor() {
		this.hooks = {
			accelerate: new SyncHook(["newSpeed"]),
			brake: new SyncHook(),
			calculateRoutes: new AsyncParallelHook(["source", "target", "routesList"])
		};
	}

	/* ... */
}
```

Other people can now use these hooks:

``` js
const myCar = new Car();

// Use the tap method to add a consument
myCar.hooks.brake.tap("WarningLampPlugin", () => warningLamp.on());
```

It's required to pass a name to identify the plugin/reason.
需要一个名字来识别这个插件
You may receive arguments:
你可以这样接收参数
``` js
myCar.hooks.accelerate.tap("LoggerPlugin", newSpeed => console.log(`Accelerating to ${newSpeed}`));
```

For sync hooks, `tap` is the only valid method to add a plugin. Async hooks also support async plugins:
同步钩子，tap是添加插件的唯一方法。异步钩子还支持另外两个异步的方法添加插件：
``` js
myCar.hooks.calculateRoutes.tapPromise("GoogleMapsPlugin", (source, target, routesList) => {
	// return a promise
	return google.maps.findRoute(source, target).then(route => {
		routesList.add(route);
	});
});
myCar.hooks.calculateRoutes.tapAsync("BingMapsPlugin", (source, target, routesList, callback) => {
	bing.findRoute(source, target, (err, route) => {
		if(err) return callback(err);
		routesList.add(route);
		// call the callback
		callback();
	});
});

// You can still use sync plugins
myCar.hooks.calculateRoutes.tap("CachedRoutesPlugin", (source, target, routesList) => {
	const cachedRoute = cache.get(source, target);
	if(cachedRoute)
		routesList.add(cachedRoute);
})
```

The class declaring these hooks need to call them:
在类里边声明一些方法来调用这些钩子：
``` js
class Car {
	/* ... */

	setSpeed(newSpeed) {
		this.hooks.accelerate.call(newSpeed);
	}

	useNavigationSystemPromise(source, target) {
		const routesList = new List();
		return this.hooks.calculateRoutes.promise(source, target, routesList).then(() => {
			return routesList.getRoutes();
		});
	}

	useNavigationSystemAsync(source, target, callback) {
		const routesList = new List();
		this.hooks.calculateRoutes.callAsync(source, target, routesList, err => {
			if(err) return callback(err);
			callback(null, routesList.getRoutes());
		});
	}
}
```

The Hook will compile a method with the most efficient way of running your plugins. It generates code depending on:
* The number of registered plugins (none, one, many)
* The kind of registered plugins (sync, async, promise)
* The used call method (sync, async, promise)
* The number of arguments
* Whether interception is used

钩子会生成一个方法以便通过最高效的途径去运行你的插件。它依赖以下条件去生成这个方法：
* 注册插件的数量（0，1个，多个）
* 注册插件的类型（sync、async、promise）
* 触发钩子的方法（sync、async、promise）
* 参数的数量
* 是否有用拦截器

This ensures fastest possible execution.

## Hook types

Each hook can be tapped with one or several functions. How they are executed depends on the hook type:
每个钩子可以被一个或多个函数触发，他们的执行方式取决于钩子的类型：
* Basic hook (without “Waterfall”, “Bail” or “Loop” in its name). This hook simply calls every function it tapped in a row.

* __Waterfall__. A waterfall hook also calls each tapped function in a row. Unlike the basic hook, it passes a return value from each function to the next function.

* __Bail__. A bail hook allows exiting early. When any of the tapped function returns anything, the bail hook will stop executing the remaining ones.

* __Loop__. TODO

* 基础钩子（名字上没有‘Waterfall’，‘Bail’，‘Loop’）。这种钩子只是简单地连续地触发钩子上挂载的所有函数。
* Waterfall。同基础钩子一样执行所有的函数，只不过它会将前一个函数的返回值传递给下一个函数。
* Bail。支持提前退出。当其中任何一个函数的返回值不为undefined时，就是退出，不执行剩下的所有函数。

Additionally, hooks can be synchronous or asynchronous. To reflect this, there’re “Sync”, “AsyncSeries”, and “AsyncParallel” hook classes:
另外，钩子分为同步和异步。可通过名字里的‘Sync’、‘AsyncSeries’、‘AsyncParallel’加以区分。

* __Sync__. A sync hook can only be tapped with synchronous functions (using `myHook.tap()`).

* __AsyncSeries__. An async-series hook can be tapped with synchronous, callback-based and promise-based functions (using `myHook.tap()`, `myHook.tapAsync()` and `myHook.tapPromise()`). They call each async method in a row.

* __AsyncParallel__. An async-parallel hook can also be tapped with synchronous, callback-based and promise-based functions (using `myHook.tap()`, `myHook.tapAsync()` and `myHook.tapPromise()`). However, they run each async method in parallel.

* Sync。同步的钩子只能被同步的方法触发（tap()）
* AsyncSeries。异步的钩子只能被异步、基于回调、基于promise的函数触发（tap()、tapAsync()、tapPromise()）,连续地调用异步方法
* AsyncParallel。调用方式同上，只不过是并行地调用异步方法


The hook type is reflected in its class name. E.g., `AsyncSeriesWaterfallHook` allows asynchronous functions and runs them in series, passing each function’s return value into the next function.
钩子的类型可以通过名字加以区分。AsyncSeriesWaterfallHook允许异步方法并且串行地执行函数，将每一个函数地执行结果传递给下一个函数

## Interception

All Hooks offer an additional interception API:

``` js
myCar.hooks.calculateRoutes.intercept({
	call: (source, target, routesList) => {
		console.log("Starting to calculate routes");
	},
	register: (tapInfo) => {
		// tapInfo = { type: "promise", name: "GoogleMapsPlugin", fn: ... }
		console.log(`${tapInfo.name} is doing its job`);
		return tapInfo; // may return a new tapInfo object
	}
})
```

**call**: `(...args) => void` Adding `call` to your interceptor will trigger when hooks are triggered. You have access to the hooks arguments.

**tap**: `(tap: Tap) => void` Adding `tap` to your interceptor will trigger when a plugin taps into a hook. Provided is the `Tap` object. `Tap` object can't be changed.

**loop**: `(...args) => void` Adding `loop` to your interceptor will trigger for each loop of a looping hook.

**register**: `(tap: Tap) => Tap | undefined` Adding `register` to your interceptor will trigger for each added `Tap` and allows to modify it.

**call** 当钩子被触发地时候会执行该方法，该方法可以获取钩子地参数
**tap** 当钩子被触发进入插件前执行， 入参是一个Tap对象，该对象不能被改变
**loop** 针对loop钩子，在每一次轮询会执行该方法
**register** 当插件被挂载到一个钩子上地时候会执行， 入参是一个Tap对象，并且可以对Tap进行修改
(注：当同时存在上述四个拦截方法时，调用顺序依次为：register、call、loop、tap)

## Context

Plugins and interceptors can opt-in to access an optional `context` object, which can be used to pass arbitrary values to subsequent plugins and interceptors.
插件和拦截器可以获取一个context上下文对象，该对象可以被用来传递任意参数给随后的插件和拦截器。需要设置context属性为true，否则context为undefined（调用tap方法也需要传入context：true，否则接收不到，该逻辑在源码HookCodeFactory.js文件的head方法有体现）
``` js
myCar.hooks.accelerate.intercept({
	context: true,
	tap: (context, tapInfo) => {
		// tapInfo = { type: "sync", name: "NoisePlugin", fn: ... }
		console.log(`${tapInfo.name} is doing it's job`);

		// `context` starts as an empty object if at least one plugin uses `context: true`.
		// If no plugins use `context: true`, then `context` is undefined.
		if (context) {
			// Arbitrary properties can be added to `context`, which plugins can then access.
			context.hasMuffler = true;
		}
	}
});

myCar.hooks.accelerate.tap({
	name: "NoisePlugin",
	context: true
}, (context, newSpeed) => {
	if (context && context.hasMuffler) {
		console.log("Silence...");
	} else {
		console.log("Vroom!");
	}
});
```

## HookMap

A HookMap is a helper class for a Map with Hooks
一个帮助类用于由Hooks组成的Map，可以使用for语句（webpack中未用到）
``` js
const keyedHook = new HookMap(key => new SyncHook(["arg"]))
```

``` js
keyedHook.tap("some-key", "MyPlugin", (arg) => { /* ... */ });
keyedHook.tapAsync("some-key", "MyPlugin", (arg, callback) => { /* ... */ });
keyedHook.tapPromise("some-key", "MyPlugin", (arg) => { /* ... */ });
```

``` js
const hook = keyedHook.get("some-key");
if(hook !== undefined) {
	hook.callAsync("arg", err => { /* ... */ });
}
```

## Hook/HookMap interface

Public:

``` ts
interface Hook {
	tap: (name: string | Tap, fn: (context?, ...args) => Result) => void,
	tapAsync: (name: string | Tap, fn: (context?, ...args, callback: (err, result: Result) => void) => void) => void,
	tapPromise: (name: string | Tap, fn: (context?, ...args) => Promise<Result>) => void,
	intercept: (interceptor: HookInterceptor) => void
}

interface HookInterceptor {
	call: (context?, ...args) => void,
	loop: (context?, ...args) => void,
	tap: (context?, tap: Tap) => void,
	register: (tap: Tap) => Tap,
	context: boolean
}

interface HookMap {
	for: (key: any) => Hook,
	tap: (key: any, name: string | Tap, fn: (context?, ...args) => Result) => void,
	tapAsync: (key: any, name: string | Tap, fn: (context?, ...args, callback: (err, result: Result) => void) => void) => void,
	tapPromise: (key: any, name: string | Tap, fn: (context?, ...args) => Promise<Result>) => void,
	intercept: (interceptor: HookMapInterceptor) => void
}

interface HookMapInterceptor {
	factory: (key: any, hook: Hook) => Hook
}

interface Tap {
	name: string,
	type: string
	fn: Function,
	stage: number,
	context: boolean
}
```

Protected (only for the class containing the hook):

``` ts
interface Hook {
	isUsed: () => boolean,
	call: (...args) => Result,
	promise: (...args) => Promise<Result>,
	callAsync: (...args, callback: (err, result: Result) => void) => void,
}

interface HookMap {
	get: (key: any) => Hook | undefined,
	for: (key: any) => Hook
}
```

## MultiHook

A helper Hook-like class to redirect taps to multiple other hooks:
一个帮助类，用于将一个tap分发到其他钩子上（webpack中未用到）
``` js
const { MultiHook } = require("tapable");

this.hooks.allHooks = new MultiHook([this.hooks.hookA, this.hooks.hookB]);
```
