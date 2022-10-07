import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import 'xterm/css/xterm.css'

import { Result, Ok, Err } from "../result";
import { fs } from "./fs";

let ttyMap: Map<number, HTMLElement> = new Map();

async function runTTY(ttyId: number) {
	let ttyEl = getTTYElement(ttyId);
	if (ttyEl.ok)
		ttyEl.value.innerHTML = `<div id='core/tty/terminal' style='height: 100%'></div>`;

	const term = new Terminal();
	const fitAddon = new FitAddon();

	term.loadAddon(fitAddon);
	term.open(document.getElementById('core/tty/terminal')!);
	fitAddon.fit();
	/*
	let currentLine = '';
	let bufferedLine = '';
	let currentLineIdx = 0;
	let lines: Array<string> = [];

	term.writeln('Welcome to test terminal in hmielOS!');
	term.writeln('WARNING This input is temporary and most things are hardcoded.');
	term.writeln('Proper terminal will come when processes are done\n');
	term.write('hmielOS v0.1.0 $ ');
	*/

	let ttyFile = fs.open(`/system/devices/tty/${ttyId}`, fs.FileAccessFlag.ReadWrite);
	if (!ttyFile.ok)
		return term.writeln(`Cannot open '/system/devices/tty/${ttyId}'`);

	while (true) {
		let data = await fs.read(ttyFile.value, -1, 0);

		if (data.ok) {
			term.write(new TextDecoder().decode(data.value));
		}
	}
}

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

	fs.mkdir('/system/devices/tty');
	let h = fs.open(`/system/devices/tty/${ttyId}`, fs.FileAccessFlag.WriteOnly, fs.FileStatusFlag.Create, fs.OpenType.Functional);
	if (!h.ok)
		return h;

	fs.close(h.value);
	ttyMap.set(ttyId, ttyEl);

	runTTY(ttyId);

	return Ok(ttyId);
}

export function getTTYElement(id: number): Result<HTMLElement> {
	if (ttyMap.has(id))
		return Ok(ttyMap.get(id)!);

	return Err(new Error(`TTY '${id} not found'`));
}