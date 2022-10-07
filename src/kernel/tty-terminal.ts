import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { FitAddon } from 'xterm-addon-fit';

import { getTTYElement } from './tty';
import { fs, FSEntryAttributes, FSEntryType } from './fs';
import { getAllProcesses } from './process';

async function evalTerminal(term: Terminal, line: string) {
	const commands: any = {
		'touch': async (params: Array<string>) => {
			if (params.length == 0) {
				term.writeln('Usage: touch <filename>');
				return;
			}

			let handle = fs.open(params[0].startsWith('/') ? params[0] : `/${params[0]}`, fs.FileAccessFlag.WriteOnly, fs.FileStatusFlag.Create);
			if (!handle.ok) {
				term.writeln(handle.error.name);
				return;
			}
			fs.close(handle.value);
		},

		'ls': async (params: Array<string>) => {
			let fh = fs.opendir(params.length > 0 ? params[0] : '/');

			if (!fh.ok)
				return term.writeln(fh.error.name);

			let rd = fs.readdir(fh.value);

			if (!rd.ok)
				return term.writeln(rd.error.name);

			const attrIntoStr = (attr: FSEntryAttributes) => {
				return `${attr[0] ? 'R' : '-'}${attr[1] ? 'W' : '-'}${attr[2] ? 'X' : '-'}`
			}

			const typeIntoStr = (type: FSEntryType) => {
				if (type == FSEntryType.File)
					return 'File';
				if (type == FSEntryType.Directory)
					return 'Dir ';
				if (type == FSEntryType.FunctionalFile)
					return 'FFil';

				return 'None';
			}

			for (const entry of rd.value) {
				term.writeln(`${attrIntoStr(entry.attributes)} ${typeIntoStr(entry.type)}  ${entry.name}`);
			}

			fs.close(fh.value);
		},

		'mkdir': async (params: Array<string>) => {
			if (params.length == 0) {
				term.writeln('Usage: mkdir [-r] <directory>');
				return;
			}

			let recursive = false;
			let directory = "";

			if (params[0] == '-r')
				recursive = true;

			if (recursive && params.length != 2)
				return term.writeln('Usage: mkdir [-r] <directory>')

			directory = recursive ? params[1] : params[0];

			let res = fs.mkdir(directory, recursive);
			if (!res.ok) {
				return term.writeln(res.error.name)
			}
		},

		'top': async () => {
			term.writeln("PID  PPID  Path");

			let processes = getAllProcesses();
			for (let i = 0; i < processes.length; i++) {
				const p = processes[i];
				term.writeln(`${i}    ${p.parent}    ${p.url}`);
			}
		},

		'write': async (params: Array<string>) => {
			if(params.length < 2) {
				return term.writeln('Usage: write <filename> <data>');
			}

			let handle = fs.open(params[0].startsWith('/') ? params[0] : `/${params[0]}`, fs.FileAccessFlag.WriteOnly);
			if (!handle.ok) {
				term.writeln(handle.error.name);
				return;
			}

			const ret = await fs.write(handle.value, new TextEncoder().encode(params[1]), -1, 0);

			if(!ret.ok) {
				term.writeln(ret.error.name);
				return fs.close(handle.value);
			}

			fs.close(handle.value);
		},

		'read': async (params: Array<string>) => {
			if(params.length < 1) {
				return term.writeln('Usage: read <filename>');
			}

			let handle = fs.open(params[0].startsWith('/') ? params[0] : `/${params[0]}`, fs.FileAccessFlag.ReadOnly);
			if (!handle.ok) {
				term.writeln(handle.error.name);
				return;
			}

			const ret = await fs.read(handle.value, -1, 0);

			if(!ret.ok) {
				term.writeln(ret.error.name);
				return fs.close(handle.value);
			}

			term.writeln(`As bytes: [${ret.value.toString()}]`);
			term.writeln(`As text: '${new TextDecoder().decode(ret.value)}'`);

			fs.close(handle.value);
		},

		'help': async () => {
			term.writeln(Object.keys(commands).join(', '));
		}
	}

	let command = line.split(" ")[0];
	if (!Object.keys(commands).includes(command)) {
		term.write(`No such command '${command}'\r\n`);
		return;
	}

	let params = line.split(" ");
	params.shift()
	await commands[command](params);
}

export function startTerminalOnTTY(tty: number) {
	let ttyEl = getTTYElement(tty);
	if (ttyEl.ok)
		ttyEl.value.innerHTML = `<div id='core/tty/terminal' style='height: 100%'></div>`;

	const term = new Terminal();
	const fitAddon = new FitAddon();

	term.loadAddon(fitAddon);
	term.open(document.getElementById('core/tty/terminal')!);
	fitAddon.fit();

	let currentLine = '';
	let bufferedLine = '';
	let currentLineIdx = 0;
	let lines: Array<string> = [];

	term.writeln('Welcome to test terminal in hmielOS!');
	term.writeln('WARNING This input is temporary and most things are hardcoded.');
	term.writeln('Proper terminal will come when processes are done\n');
	term.write('hmielOS v0.1.0 $ ');

	term.onKey(async (e) => {
		let bannedKeycodes = ["ArrowLeft", "ArrowRight"];
		for (const keycode of bannedKeycodes) {
			if (e.domEvent.code == keycode)
				return;
		}

		if (e.domEvent.code == "Backspace") {
			if (currentLine.length == 0)
				return;

			term.write('\b \b');
			currentLine = currentLine.slice(0, currentLine.length - 1);

			return;
		}

		if (e.domEvent.code == "Enter") {
			term.write('\r\n');

			await evalTerminal(term, currentLine);
			lines.push(currentLine);
			currentLine = "";

			term.write('hmielOS v0.1.0 $ ');

			return;
		}

		if (e.domEvent.code == "ArrowUp" && lines.length > 0 && currentLineIdx < lines.length) {
			currentLineIdx += 1;
			if (currentLineIdx == 1) {
				bufferedLine = currentLine;
			}

			for (const _ of currentLine) {
				term.write('\b \b');
			}

			currentLine = lines[lines.length - currentLineIdx];
			term.write(currentLine);

			return;
		} else if (e.domEvent.code == "ArrowUp") return;

		if (e.domEvent.code == "ArrowDown" && currentLineIdx != 0) {
			for (const _ of currentLine) {
				term.write('\b \b');
			}

			currentLineIdx -= 1;
			if (currentLineIdx == 0) {
				currentLine = bufferedLine;
				bufferedLine = '';
				term.write(currentLine);
			} else {
				currentLine = lines[lines.length - currentLineIdx];
				term.write(currentLine);
			}

			return;
		} else if (e.domEvent.code == "ArrowDown") return;

		currentLine += e.key;
		term.write(e.key);
	});
}