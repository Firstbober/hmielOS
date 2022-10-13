import { createExecutableFromURL } from "./kernel/exec";
import { krnlfs } from "./kernel/fs";
import { spawnProcess } from "./kernel/process";
import { initSyscalls } from "./kernel/syscall";
import { createTTYOnDisplay } from "./kernel/tty";
import { Result } from "libsys/result";
import { sysfs } from "libsys/fs";

function panic(message: string, error: Error) {
	const m = `KERNEL PANIC: ${message}`;
	window.alert(m);
	window.console.error(error);
	throw new Error(m)
}

const console = {
	log: async (...data: any[]) => {
		window.console.log(...data);
	}
}

/**
 * Create root directory structure
 *
 * /system - immutable base
 *   - programs
 *   - devices
 *   - configs
 * /home - rwx for all
 */

console.log("Creating root directory structure...");

krnlfs.mkdir('/system', true, [true, false, true]);
krnlfs.mkdir('/system/device', true, [true, true, false]);
krnlfs.mkdir('/system/config', true);
krnlfs.mkdir('/system/program', true);

krnlfs.mkdir('/home', true, [true, true, true]);

/**
 * Create TTY
 */

console.log('Creating tty...');

let tty: number | Result<number> = createTTYOnDisplay(0)
if (!tty.ok)
	throw panic('Cannot create TTY', tty.error);

const ttyStdout = krnlfs.open('/system/device/tty/0', sysfs.open.AccessFlag.WriteOnly, sysfs.open.StatusFlag.Normal, sysfs.open.Type.Functional);
if (!ttyStdout.ok)
	throw panic('aa', ttyStdout.error);


console.log = async (...data: any[]) => {
	await krnlfs.write(ttyStdout.value, new TextEncoder().encode(data.join(' ') + '\r\n'), -1, 0);
	window.console.log(...data);
}

import sysinit_unit_shell from './base/sysinit/unit/shell.unit?raw';

(async () => {

	/**
	 * Write applications and configs into filesystem
	 */

	await console.log('Writing basic applications into filesystem...');

	async function writeToFS(path: string, data: Uint8Array) {
		const handle = krnlfs.open(path, sysfs.open.AccessFlag.WriteOnly, sysfs.open.StatusFlag.Create, undefined, true);
		if (!handle.ok)
			return;

		await krnlfs.write(handle.value, data, -1, 0, undefined, true);
		krnlfs.close(handle.value);
	}

	function toUint8Array(text: string) {
		return new TextEncoder().encode(text);
	}

	const sysinit = createExecutableFromURL("./src/base/sysinit/index.html");
	{

		await writeToFS('/system/program/sysinit', sysinit);
		krnlfs.mkdir('/system/config/sysinit/unit', true);

		await writeToFS('/system/config/sysinit/unit/shell.unit', toUint8Array(sysinit_unit_shell));
	}

	const hosh = createExecutableFromURL('./src/base/hosh/index.html');
	{
		await writeToFS('/system/program/hosh', hosh);
	}

	/**
	 * Init syscalls
	 */

	initSyscalls();

	/**
	 * Start sysinit
	 */

	await console.log("Starting sysinit...");

	let spawnedProcess = spawnProcess(new TextDecoder().decode(Uint8Array.from(JSON.parse(new TextDecoder().decode(sysinit)).data)), -1);

	if (!spawnedProcess.ok)
		panic('Cannot spawn sysinit', spawnedProcess.error);

})()