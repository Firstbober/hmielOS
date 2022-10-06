let _f_canUseSyscalls = false;

export interface Syscalls {
	processInit: (processKey: string) => Promise<void>
}

export interface SyscallPacket {
	type: string,
	data: Array<any>
}

function sendMessage(message: SyscallPacket) {
	if (!_f_canUseSyscalls)
		throw new Error("Cannot use syscalls, process isn't attached to hmielOS.");

	window.parent.postMessage(message, "*");
}

interface ResponsePromise {
	promiseResolve: (value: any | PromiseLike<any>) => void,
	promiseReject: (reason?: any) => void,
	key: number
}

let responsePromises: Array<ResponsePromise> = [];

const syscalls: Syscalls = {
	async processInit(processKey) {
		let rP: ResponsePromise = {
			key: responsePromises.length
		} as any;

		let p = new Promise<void>((resolve, reject) => {
			rP.promiseResolve = resolve;
			rP.promiseReject = reject;
		});

		responsePromises.push(rP);

		sendMessage({
			type: 'kernel.syscall.processInit',
			data: [rP.key, processKey]
		});

		return p;
	},
};

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

		const data: SyscallPacket = td;

		if (data.type.startsWith('kernel.syscall')) {
			let v = responsePromises.at(data.data[0]);
			if(v == undefined)
				return;

			if(v.key != data.data[0])
				return;

			let finalData = data.data;
			finalData.shift();

			v.promiseResolve([...finalData])
			responsePromises.splice(data.data[0], 1);

			return;
		}
	})

	_f_canUseSyscalls = true;
	await syscalls.processInit(prockey);
}

export default syscalls;