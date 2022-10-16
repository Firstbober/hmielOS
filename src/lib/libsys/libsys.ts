/**
 * libsys/libsys
 *
 * The core of libsys.
 * Handles communication with kernel.
 */

import { PID } from "../../kernel/process";
import { sysfs } from "./fs";
import { PromiseResult } from "./result";

interface ResponsePromise {
	promiseResolve: (value: any | PromiseLike<any>) => void,
	promiseReject: (reason?: any) => void,
	key: number
}

let _f_canUseSyscalls = false;

let responsePromises: Array<ResponsePromise> = [];
let processKey = "";

export namespace syscall {
	export interface Syscalls {
		processInit: (processKey: string) => Promise<string[]>,

		open: (path: string, accessFlag: sysfs.open.AccessFlag, statusFlag: sysfs.open.StatusFlag, type: sysfs.open.Type) => PromiseResult<sysfs.open.Handle>,
		close: (handle: sysfs.open.Handle) => Promise<boolean>,

		read: (handle: sysfs.open.Handle, count: number, offset: number) => PromiseResult<Uint8Array>,
		write: (handle: sysfs.open.Handle, buffer: Uint8Array, count: number, offset: number) => PromiseResult<number>,

		opendir: (path: string) => PromiseResult<sysfs.open.Handle>,
		readdir: (handle: sysfs.open.Handle) => PromiseResult<Array<sysfs.entry.Entry>>,

		exec: (path: string, args: string[], env: Array<[string, string]>) => PromiseResult<PID>;
	}

	export interface Packet {
		type: string,
		data: Array<any>
	}

	function sendMessage(message: Packet) {
		if (!_f_canUseSyscalls)
			throw new Error("Cannot use syscalls, process isn't attached to hmielOS.");

		window.parent.postMessage(message, "*");
	}

	function sendSyscall<T>(syscall: string, ...args: any[]) {
		let rP: ResponsePromise = {
			key: responsePromises.length
		} as any;

		let p = new Promise<T>((resolve, reject) => {
			rP.promiseResolve = resolve;
			rP.promiseReject = reject;
		});

		responsePromises.push(rP);

		sendMessage({
			type: 'kernel.syscall.' + syscall,
			data: [processKey, rP.key, ...args]
		});

		return p;
	}

	export const syscalls: Syscalls = {
		async processInit(_processKey) {
			processKey = _processKey;
			return sendSyscall('processInit', _processKey);
		},

		async open(path, accessFlag, statusFlag, type) {
			return sendSyscall('open', path, accessFlag, statusFlag, type);
		},
		async close(handle) {
			return sendSyscall('close', handle);
		},

		async read(handle: sysfs.open.Handle, count: number, offset: number) {
			return sendSyscall('read', handle, count, offset);
		},
		async write(handle: sysfs.open.Handle, buffer: Uint8Array, count: number, offset: number) {
			return sendSyscall('write', handle, buffer, count, offset);
		},

		async opendir(path) {
			return sendSyscall('opendir', path);
		},
		async readdir(handle) {
			return sendSyscall('readdir', handle);
		},

		async exec(path, args, env) {
			return sendSyscall('exec', path, args, env);
		},
	};
}

export async function libsysInit() {
	const prockey = (new Proxy(new URLSearchParams(window.location.search), {
		get: (searchParams, prop) => searchParams.get(prop.toString()),
	}) as any).prockey;

	if (prockey == null) {
		throw new Error("Cannot init libsys, maybe this isn't hmielOS?");
	}

	window.addEventListener('message', (ev) => {
		const td = ev.data;
		if (td.type == undefined && td.data == undefined)
			return;

		const data: syscall.Packet = td;

		if (data.type.startsWith('kernel.syscall')) {
			let v = responsePromises.at(data.data[0]);
			if (v == undefined)
				return;

			if (v.key != data.data[0])
				return;

			let finalData = data.data;
			finalData.shift();

			v.promiseResolve(finalData[0])
			responsePromises.splice(data.data[0], 1);

			return;
		}
	})

	_f_canUseSyscalls = true;
	const rv = await syscall.syscalls.processInit(prockey);
	return {
		args: rv,
		process: {
			argv: rv
		}
	}
}

export default syscall.syscalls;