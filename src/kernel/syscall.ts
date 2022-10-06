import { acceptProcess } from "./process"
import { SyscallPacket, Syscalls } from 'libsys';

const syscalls: Syscalls = {
	async processInit(processKey) {
		const p = acceptProcess(processKey);

		if (p.ok) p.value.iframe.contentWindow?.postMessage({
			type: 'kernel.syscall.processInit',
			data: [this]
		}, '*');
	},
};

async function handleSyscalls(packet: SyscallPacket) {
	let syscallName = packet.type.split('kernel.syscall.')[1];

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

		const data: SyscallPacket = td;

		if (data.type.startsWith('kernel.syscall.processInit')) {
			await syscalls.processInit.bind(data.data[0])(data.data[1]);
			return;
		}
		if (data.type.startsWith('kernel.syscall')) { await handleSyscalls(data); return; }
	});
}