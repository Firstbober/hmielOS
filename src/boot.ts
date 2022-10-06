import { fs } from "./kernel/fs";
import { spawnProcess } from "./kernel/process";
import { initSyscalls } from "./kernel/syscall";

/**
 * Create root directory structure
 *
 * /system - immutable base
 *   - programs
 * /home - rwx for all
 */

console.log("Creating root directory structure...");

fs.mkdir('/system', true, [true, false, true]);
fs.mkdir('/system/programs', true);

fs.mkdir('/home', true, [true, true, true]);

/**
 * Init syscalls
 */

initSyscalls();

/**
 * Start sysinit
 */

console.log("Starting sysinit...");

const sysinit = new URL("./base/sysinit/index.html", import.meta.url).href
let spawnedProcess = spawnProcess(sysinit, -1);

if(!spawnedProcess.ok) {
	let message = "KERNEL PANIC: cannot spawn sysinit";
	window.alert(message);
	throw new Error(message)
}
