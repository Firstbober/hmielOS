import { acceptProcess } from "./process"
import { syscall } from 'libsys';
import { Ok } from "libsys/result";

const syscalls: syscall.Syscalls = {
	async processInit(processKey) {
		const p = acceptProcess(processKey);

		if (p.ok) p.value.iframe.contentWindow?.postMessage({
			type: 'kernel.syscall.processInit',
			data: [this]
		}, '*');
	},

	async open(path, accessFlag, statusFlag, type) {
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
	let syscallName = packet.type.split('kernel.fs.')[1];

	let entries = Object.entries(syscalls);

	for (const [k, v] of entries) {
		if (k != syscallName) {
			continue;
		}

		await v.bind("here will be process")(...packet.data);
		break;
	}
}

export function initSyscalls() {
	window.addEventListener('message', async (ev) => {
		const td = ev.data;
		if (td.type == undefined && td.data == undefined)
			return;

		const data: syscall.Packet = td;

		if (data.type.startsWith('kernel.syscall.processInit')) {
			await syscalls.processInit.bind(data.data[0])(data.data[1]);
			return;
		}
		if (data.type.startsWith('kernel.syscall')) { await handleSyscalls(data); return; }
	});
}