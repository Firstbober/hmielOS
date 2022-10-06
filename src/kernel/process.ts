import { Err, Ok, Result } from "../result";

type PID = number;

interface Process {
	parent: PID,
	url: string,
	iframe: HTMLIFrameElement,
	processToken: string
}

interface ProcessWIP extends Process {
	promisedPID: PID
}

let processesWIP: Array<ProcessWIP> = [];
let processes: Array<Process> = [];

export namespace error {
	export class ProcessError extends Error { name: string = 'ProcessError'; }
	export class NoSuchProcess extends ProcessError { name: string = 'NoSuchProcess'; }
}

export function spawnProcess(url: string, parent: PID): Result<PID> {
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

	let process = {
		parent,
		url,
		iframe,
		processToken: uuid
	};
	let wipPID = processesWIP.length;

	processesWIP.push({
		...process,
		promisedPID
	});
	processes.push(process);

	setTimeout(() => {
		if (processesWIP[wipPID] == undefined)
			return;

		processes.splice(promisedPID, 1);
		processesWIP.splice(wipPID, 1);

		document.getElementById('kernel/process/iframes')?.removeChild(iframe);
		iframe.remove();
	}, (1000) * 60);

	return Ok(promisedPID);
}

export function acceptProcess(processKey: string): Result<Process, error.ProcessError> {
	for (let i = 0; i < processesWIP.length; i++) {
		const pW = processesWIP[i];

		if (pW.processToken != processKey) {
			continue;
		}

		processesWIP.splice(i, 1);
		return Ok(processes[pW.promisedPID]);
	}

	return Err(new error.NoSuchProcess());
}

export function getAllProcesses(): Array<Process> {
	return processes;
}