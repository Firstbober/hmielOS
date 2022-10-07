import { acceptProcess, getProcessWithToken } from "./process"
import { syscall } from 'libsys';
import { Ok } from "libsys/result";

const syscalls: syscall.Syscalls = {
	async processInit(processKey) {
		const p = acceptProcess(processKey);

		if (p.ok) p.value.iframe.contentWindow?.postMessage({
			type: 'kernel.syscall.processInit',
			data: [(this as any)[1]]
		}, '*');
	},

	async open(path, accessFlag, statusFlag, type) {
		console.log(`Process wants to open ${path}`, this);

		return Ok(0);
	},

	async close(handle) {
		return true;
	},

	async read(handle, count, offset) {
		return Ok(new Uint8Array());
	},

	async write(handle, buffer, count, offset) {
		return Ok(0);
	},
};

async function handleSyscalls(packet: syscall.Packet) {
	let syscallName = packet.type.split('kernel.syscall.')[1];

	let entries = Object.entries(syscalls);

	for (const [k, v] of entries) {
		if (k != syscallName) {
			continue;
		}

		let process = getProcessWithToken(packet.data[0]);
		if(!process.ok)
			return;

		await v.bind([process, packet.data[1]])(...(packet.data.slice(2)));
		break;
	}
}

export function initSyscalls() {
	window.addEventListener('message', async (ev) => {
		const td = ev.data;
		if (td.type == undefined && td.data == undefined)
			return;

		const data: syscall.Packet = td;

		if(data.data.length < 2)
			return;

		if (data.type.startsWith('kernel.syscall.processInit')) {
			await syscalls.processInit.bind(data.data)(data.data[2]);
			return;
		}
		if (data.type.startsWith('kernel.syscall')) { await handleSyscalls(data); return; }
	});
}