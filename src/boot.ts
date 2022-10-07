import { createExecutableFromURL } from "./kernel/exec";
import { fs } from "./kernel/fs";
import { spawnProcess } from "./kernel/process";
import { initSyscalls } from "./kernel/syscall";
import { createTTYOnDisplay } from "./kernel/tty";
import { Result } from "./result";

function panic(message: string) {
	const m = `KERNEL PANIC: ${message}`;
	window.alert(m);
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
 *   - config
 * /home - rwx for all
 */

console.log("Creating root directory structure...");

fs.mkdir('/system', true, [true, false, true]);
fs.mkdir('/system/devices', true, [true, true, false]);
fs.mkdir('/system/programs', true);

fs.mkdir('/home', true, [true, true, true]);

/**
 * Create TTY
 */

console.log('Creating tty...');

let tty: number | Result<number> = createTTYOnDisplay(0)
if (!tty.ok)
	throw panic('Cannot create TTY');

const ttyStdout = fs.open('/system/devices/tty/0', fs.FileAccessFlag.WriteOnly, fs.FileStatusFlag.Normal, fs.OpenType.Functional);
if (!ttyStdout.ok)
	throw panic('aa')


console.log = async (...data: any[]) => {
	await fs.write(ttyStdout.value, new TextEncoder().encode(data.join(' ') + '\r\n'), -1, 0);
	window.console.log(...data);
}

(async () => {

	/**
	 * Write applications into filesystem
	 */

	await console.log('Writing basic applications into filesystem...');

	async function writeToFS(path: string, data: Uint8Array) {
		const handle = fs.open(path, fs.FileAccessFlag.WriteOnly, fs.FileStatusFlag.Create);
		if (!handle.ok)
			return;

		await fs.write(handle.value, data, -1, 0);
		fs.close(handle.value);
	}

	const sysinit = new URL("./base/sysinit/index.html", import.meta.url).href
	await writeToFS('/system/programs/sysinit', createExecutableFromURL(sysinit));

	/**
	 * Init syscalls
	 */

	initSyscalls();

	/**
	 * Start sysinit
	 */

	await console.log("Starting sysinit...");

	let spawnedProcess = spawnProcess(sysinit, -1);

	if (!spawnedProcess.ok)
		panic('Cannot spawn sysinit');

})()