/**
 * kernel/tty
 *
 * TTY implementation using xterm and html.
 * Also here we create stdin and stdout file handles.
 */

// Init all xterm stuff
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import 'xterm/css/xterm.css'

// Our imports
import { Result, Ok, Err } from "libsys/result";
import { krnlfs } from "./fs";
import { sysfs } from "libsys/fs";

let ttyMap: Map<number, HTMLElement> = new Map();

/// Start tty on previously established ID
async function runTTY(ttyId: number) {
	// Get tty html element
	let ttyEl = getTTYElement(ttyId);
	if (ttyEl.ok)
		ttyEl.value.innerHTML = `<div id='core/tty/terminal' style='height: 100%'></div>`;

	// Create xterm instance
	const term = new Terminal();
	const fitAddon = new FitAddon();

	// Xterm magic
	term.loadAddon(fitAddon);
	term.open(document.getElementById('core/tty/terminal')!);
	fitAddon.fit();

	// Open stdout file
	let ttyFile = krnlfs.open(`/system/device/tty/${ttyId}`, sysfs.open.AccessFlag.ReadWrite);
	if (!ttyFile.ok)
		return term.writeln(`Cannot open '/system/device/tty/${ttyId}'`);

	const textEncoder = new TextEncoder();
	term.onKey(async (e) => {
		const data = `${e.domEvent.code}█${e.domEvent.key}█${+ e.domEvent.ctrlKey}█${+ e.domEvent.altKey}█${+ e.domEvent.shiftKey}`;
		await krnlfs.write(stdinFH, textEncoder.encode(data), -1, 0);
	});

	// Show on screen data from stdout
	while (true) {
		let data = await krnlfs.read(ttyFile.value, -1, 0);

		if (data.ok) {
			term.write(new TextDecoder().decode(data.value));
		}
	}
}

let stdinFH = -1;

/// Create TTY on specified display
export function createTTYOnDisplay(display: number): Result<number> {
	let displayEl = document.getElementById(`core/display/${display}`);

	if (displayEl == null) {
		return Err(new Error(`Display '${display}' not found`));
	}

	let ttyId = 0;
	for (const [key, _] of ttyMap) {
		if (key > ttyId)
			ttyId = key;
	}

	let ttyEl = document.createElement('div');
	ttyEl.className = `core/tty/${ttyId}`;
	ttyEl.style.height = '100%';

	displayEl.innerHTML = "";
	displayEl.appendChild(ttyEl);

	krnlfs.mkdir('/system/device/tty');
	let h = krnlfs.open(`/system/device/tty/${ttyId}`, sysfs.open.AccessFlag.WriteOnly, sysfs.open.StatusFlag.Create, sysfs.open.Type.Functional);
	if (!h.ok)
		return h;

	let stdinH = krnlfs.open(`/virtual/${ttyId}-in`, sysfs.open.AccessFlag.ReadOnly, sysfs.open.StatusFlag.Create, sysfs.open.Type.Functional);
	if (!stdinH.ok)
		return stdinH;

	stdinFH = stdinH.value;

	krnlfs.close(h.value);
	ttyMap.set(ttyId, ttyEl);

	runTTY(ttyId);

	return Ok(ttyId);
}

export function getTTYElement(id: number): Result<HTMLElement> {
	if (ttyMap.has(id))
		return Ok(ttyMap.get(id)!);

	return Err(new Error(`TTY '${id} not found'`));
}

/// Get stdin file handle
export function getStdInFH(): Result<sysfs.open.Handle> {
	if (stdinFH == -1)
		return Err(new Error('No stdin handle yet.'))

	return Ok(stdinFH);
}