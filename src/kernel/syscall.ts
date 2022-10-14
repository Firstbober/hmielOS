/**
 * kernel/syscall
 *
 * Here lies the implementation of all syscalls in the system.
 */

import { acceptProcess, getProcessWithToken, PID, Process, spawnProcess } from "./process"
import { syscall } from 'libsys';
import { Err, Ok } from "libsys/result";
import { krnlfs } from "./fs";
import { sysfs } from "libsys/fs";

const syscalls: syscall.Syscalls = {
	async processInit(processKey) {
		const p = acceptProcess(processKey);

		if (p.ok) p.value.iframe.contentWindow?.postMessage({
			type: 'kernel.syscall.processInit',
			data: [(this as any)[1]]
		}, '*');
	},

	async open(path, accessFlag, statusFlag, type) {
		let process = this as unknown as [PID, Process];

		let krnlHandle = krnlfs.open(path, accessFlag, statusFlag, type);
		if (!krnlHandle.ok)
			return krnlHandle;

		let procHandle = process[1].fileHandlers.findIndex((value) => value == undefined);
		if (procHandle == -1)
			procHandle = process[1].fileHandlers.push(krnlHandle.value) - 1;

		return Ok(procHandle);
	},

	async close(handle) {
		let process = this as unknown as [PID, Process];

		let procHandle = process[1].fileHandlers.at(handle);
		if (procHandle == undefined)
			return false;

		const r = krnlfs.close(procHandle);
		process[1].fileHandlers[procHandle] = undefined;
		return r;
	},

	async read(handle, count, offset) {
		let process = this as unknown as [PID, Process];

		let procHandle = process[1].fileHandlers.at(handle);
		if (procHandle == undefined)
			procHandle = -9999;

		return krnlfs.read(procHandle, count, offset);
	},

	async write(handle, buffer, count, offset) {
		let process = this as unknown as [PID, Process];

		let procHandle = process[1].fileHandlers.at(handle);
		if (procHandle == undefined)
			procHandle = -9999;

		return krnlfs.write(procHandle, buffer, count, offset);
	},

	async opendir(path) {
		let process = this as unknown as [PID, Process];

		let krnlHandle = krnlfs.opendir(path);
		if (!krnlHandle.ok)
			return krnlHandle;

		let procHandle = process[1].fileHandlers.findIndex((value) => value == undefined);
		if (procHandle == -1)
			procHandle = process[1].fileHandlers.push(krnlHandle.value) - 1;

		return Ok(procHandle);
	},

	async readdir(handle) {
		let process = this as unknown as [PID, Process];

		let procHandle = process[1].fileHandlers.at(handle);
		if (procHandle == undefined)
			procHandle = -9999;

		let r = krnlfs.readdir(procHandle);
		if (!r.ok)
			return r;

		let a: Array<sysfs.entry.Entry> = [];
		for (const entry of r.value) {
			let e: sysfs.entry.Directory | sysfs.entry.Directory | sysfs.entry.FunctionalFile = {
				type: entry.type,
				name: entry.name,
				attributes: entry.attributes
			} as any;

			if (entry.type == sysfs.entry.Type.Directory) {
				let eEntries: Array<sysfs.entry.Entry> = [];
				for (const eE of entry.entries) {
					eEntries.push({
						type: eE.type,
						name: eE.name,
						attributes: eE.attributes
					} as any);
				}

				(e as sysfs.entry.Directory).entries = eEntries;
			}

			a.push(e);
		}

		return Ok(a);
	},

	async exec(path, _args, _env) {
		let process = this as unknown as [PID, Process];

		let fh = krnlfs.open(path, sysfs.open.AccessFlag.ReadOnly, sysfs.open.StatusFlag.Normal, sysfs.open.Type.Normal);

		if (!fh.ok)
			return fh;

		let content = await krnlfs.read(fh.value, -1, 0);

		if (!content.ok)
			return content;

		krnlfs.close(fh.value);

		const decoder = new TextDecoder();
		try {
			let executable = JSON.parse(decoder.decode(content.value));
			let url = decoder.decode(Uint8Array.from(executable.data));

			const pid = spawnProcess(url, process[0]);
			if(!pid.ok)
				return pid;

			return Ok(pid.value);
		} catch (error) {
			return Err(new Error('Not Executable'));
		}
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
		if (!process.ok)
			return;

		let ret = await v.bind(process.value)(...(packet.data.slice(2)));
		process.value[1].iframe.contentWindow?.postMessage({
			type: 'kernel.syscall.' + syscallName,
			data: [packet.data[1], ret]
		}, '*');

		break;
	}
}

export function initSyscalls() {
	window.addEventListener('message', async (ev) => {
		const td = ev.data;
		if (td.type == undefined && td.data == undefined)
			return;

		const data: syscall.Packet = td;

		if (data.data.length < 2)
			return;

		if (data.type.startsWith('kernel.syscall.processInit')) {
			await syscalls.processInit.bind(data.data)(data.data[2]);
			return;
		}
		if (data.type.startsWith('kernel.syscall')) { await handleSyscalls(data); return; }
	});
}