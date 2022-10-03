import { Result, Ok, Err } from "../result";

let ttyMap: Map<number, HTMLElement> = new Map();

export function createTTYOnDisplay(display: number): Result<number> {
	let displayEl = document.getElementById(`core/display/${display}`);

	if (displayEl == null) {
		return Err(new Error(`Display '${display}' not found`));
	}

	let ttyId = 0;
	for (const [key, _] of ttyMap) {
		if(key > ttyId)
			ttyId = key;
	}

	let ttyEl = document.createElement('div');
	ttyEl.className = `core/tty/${ttyId}`;
	ttyEl.style.height = '100%';

	displayEl.innerHTML = "";
	displayEl.appendChild(ttyEl);

	// TODO: Add device file to FS

	ttyMap.set(ttyId, ttyEl);
	return Ok(ttyId);
}

export function getTTYElement(id: number): Result<HTMLElement> {
	if(ttyMap.has(id))
		return Ok(ttyMap.get(id)!);

	return Err(new Error(`TTY '${id} not found'`));
}