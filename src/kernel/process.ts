import { sysfs } from "libsys/fs";
import { Err, Ok, Result } from "libsys/result";
import { krnlfs } from "./fs";

export type PID = number;

export interface Process {
	parent: PID,
	url: string,
	iframe: HTMLIFrameElement,
	processToken: string,

	fileHandlers: Array<sysfs.open.Handle | undefined>
}

interface ProcessWIP extends Process {
	promisedPID: PID
}

let processesWIP: Array<ProcessWIP | undefined> = [];
let processes: Array<Process | undefined> = [];

export namespace error {
	export class ProcessError extends Error { name: string = 'ProcessError'; }
	export class NoSuchProcess extends ProcessError { name: string = 'NoSuchProcess'; }
}

export function spawnProcess(url: string, _parent: PID, _fhToClone: Array<sysfs.open.Handle> = []): Result<PID> {
	let iframe = document.createElement('iframe') as HTMLIFrameElement;
	let uuid = crypto.randomUUID();
	let promisedPID = processes.length;

	iframe.height = "0";
	(iframe as any).loading = "eager";
	(iframe as any).fetchpriority = "high";
	iframe.sandbox.add('allow-scripts')
	iframe.src = `${url}?prockey=${uuid}`;
	iframe.hidden = true;
	iframe.id = `kernel/process/iframes/${promisedPID}`;
	document.getElementById('kernel/process/iframes')?.appendChild(iframe);

	const parent = processes.at(_parent) != undefined ? _parent : -1;

	let process: Process = {
		parent,
		url,
		iframe,
		processToken: uuid,
		fileHandlers: []
	};
	let wipPID = processesWIP.length;

	if (parent != -1) {
		// TODO
	} else {
		const stdin: Result<number> = krnlfs.open('stdin', sysfs.open.AccessFlag.ReadWrite, undefined, sysfs.open.Type.Virtual);
		if (!stdin.ok)
			return stdin;

		const stdout: Result<number> = krnlfs.open('/system/device/tty/0', sysfs.open.AccessFlag.WriteOnly, undefined, sysfs.open.Type.Virtual);
		if (!stdout.ok)
			return stdout;

		const stderr: number = stdout.value;

		process.fileHandlers.push(stdin.value);
		process.fileHandlers.push(stdout.value);
		process.fileHandlers.push(stderr);
	}

	// TODO: Add file handler cloning

	processesWIP.push({
		...process,
		promisedPID
	});
	processes.push(process);

	setTimeout(() => {
		if (processesWIP[wipPID] == undefined)
			return;

		processes[promisedPID] = undefined;
		processesWIP[wipPID] = undefined;

		document.getElementById('kernel/process/iframes')?.removeChild(iframe);
		iframe.remove();
	}, (1000) * 60);

	return Ok(promisedPID);
}

export function acceptProcess(processKey: string): Result<Process, error.ProcessError> {
	for (let i = 0; i < processesWIP.length; i++) {
		const pW = processesWIP[i];

		if (pW == undefined)
			continue;

		if (pW.processToken != processKey) {
			continue;
		}

		processesWIP.splice(i, 1);
		return Ok(processes[pW.promisedPID]!);
	}

	return Err(new error.NoSuchProcess());
}

export function getAllProcesses(): Array<[PID, Process]> {
	let procs: Array<[PID, Process]> = [];
	for (let i = 0; i < processes.length; i++) {
		const p = processes[i];
		if (p != undefined)
			procs.push([i, p]);
	}
	return procs;
}

export function getProcessWithToken(token: string): Result<[PID, Process], error.ProcessError> {
	for (const process of getAllProcesses()) {
		if (process[1].processToken == token)
			return Ok(process);
	}

	return Err(new error.NoSuchProcess());
}