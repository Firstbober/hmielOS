import { Ok, Result } from "../result";

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
	processesWIP.push({
		...process,
		promisedPID
	});
	processes.push(process);

	return Ok(promisedPID);
}