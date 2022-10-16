import { libsysInit, syscall } from "libsys";
import { std } from "libsys/std";
import ansi from 'ansi-escape-sequences'

interface InData {
	domCode: string,
	domKey: string,
	ctrlKey: boolean,
	altKey: boolean,
	shiftKey: boolean
}

function stringAsInData(str: string): InData {
	const a = str.split('█');
	return {
		domCode: a[0],
		domKey: a[1],
		ctrlKey: Boolean(Number(a[2] == '1')),
		altKey: Boolean(Number(a[3])),
		shiftKey: Boolean(Number(a[4]))
	}
}

async function interpretLineBuffer(_lineBuffer: string) {
	if(_lineBuffer.includes("wwr")) {
		await syscall.syscalls.exec('/system/program/wasiwasm.runtime', [], []);
	}
}

libsysInit().then(async () => {
	const textDecoder = new TextDecoder();
	const motdH = await syscall.syscalls.open('/system/config/motd', 1, 2, 0);

	if (motdH.ok) {
		const data = await syscall.syscalls.read(motdH.value, -1, 0);
		if (!data.ok) {
			await std.print("Couldn't read '/system/config/motd'");
		} else {
			const text = textDecoder.decode(data.value);
			await std.print(text);
		}
	}

	await std.printraw("[hmielOS]$ ");

	let currentLineIdx: number = 0;
	let lines: Array<string> = [""];
	let offsetLeft = 0;
	let offsetRight = 0;

	const showableDomCodes = ['Key', 'Numpad', 'Digit', 'Bracket', 'Semicolon', 'Backslash', 'Quote', 'Minus', 'Plus', 'Equal', 'Backquote', 'Comma', 'Period', 'Slash', 'Space'];

	while (true) {
		const r = await syscall.syscalls.read(0, -1, 0);
		if (!r.ok)
			continue;

		const data = stringAsInData(textDecoder.decode(r.value));

		switch (data.domCode) {
			case 'Enter':
				await std.printraw("\n\r" + "[hmielOS]$ ");
				await interpretLineBuffer(lines[currentLineIdx]);

				currentLineIdx += 1;

				lines[currentLineIdx] = ""
				offsetLeft = 0;
				offsetRight = 0;
				break;

			case 'ArrowUp':
			case 'ArrowDown':
				const isUp = data.domCode.endsWith('Up');
				const isDown = data.domCode.endsWith('Down');

				const sC = async (v: number) => {
					let totalCommand = "";

					if (offsetLeft != 0) {
						totalCommand += ansi.cursor.forward(offsetLeft);
						offsetLeft = 0;
					}

					if (lines[currentLineIdx] != "")
						totalCommand += ansi.cursor.back(lines[currentLineIdx].length);
					totalCommand += ansi.erase.inLine();

					currentLineIdx += v;

					totalCommand += lines[currentLineIdx];
					offsetLeft = 0;
					offsetRight = lines[currentLineIdx].length;

					await std.printraw(totalCommand);
				};

				if (isUp && currentLineIdx > 0)
					await sC(-1);
				if (isDown && currentLineIdx + 1 < lines.length)
					await sC(1);

				break;

			case 'ArrowLeft':
			case 'ArrowRight':
				const isLeft = data.domCode.endsWith('Left');
				const isRight = data.domCode.endsWith('Right');

				if (isLeft && offsetLeft != lines[currentLineIdx].length) {
					await std.printraw(ansi.cursor.back(1));
					offsetLeft += 1;
					offsetRight -= 1;
				}
				if (isRight && offsetLeft != 0) {
					await std.printraw(ansi.cursor.forward(1));
					offsetLeft -= 1;
					offsetRight += 1;
				}

				break;

			case 'Backspace':
				const cL = lines[currentLineIdx];

				if (offsetLeft != 0 && offsetRight != 0) {
					let cmd = "";

					cmd += ansi.cursor.back(1);
					cmd += ansi.erase.inLine();
					cmd += cL.slice(cL.length - offsetLeft);
					cmd += ansi.cursor.back(offsetLeft);

					lines[currentLineIdx] = [cL.slice(0, cL.length - offsetLeft - 1), cL.slice(cL.length - offsetLeft)].join('');

					await std.printraw(cmd);
					offsetRight -= 1;
					break;
				}

				if (cL.length != 0 && offsetLeft == 0 && offsetRight != 0) {
					lines[currentLineIdx] = cL.slice(0, -1);
					await std.printraw(ansi.cursor.back(1) + ansi.erase.inLine());
					offsetRight -= 1;
				}

				break;

			default:
				let key = "";
				for (const showable of showableDomCodes) {
					if (data.domCode.startsWith(showable)) {
						key = data.domKey;
						break;
					}
				}

				if (offsetLeft != 0) {
					const cL = lines[currentLineIdx];
					lines[currentLineIdx] = [cL.slice(0, cL.length - offsetLeft), key, cL.slice(cL.length - offsetLeft)].join('');

					await std.printraw(`${ansi.erase.inLine()}${key}${cL.slice(cL.length - offsetLeft)}${ansi.cursor.back(offsetLeft)}`);
				} else {
					lines[currentLineIdx] += key;
					await std.printraw(key);
				}

				offsetRight += 1;
				break;
		}
	}
});