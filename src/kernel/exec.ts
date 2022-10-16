import { sysfs } from "libsys/fs";
import { Err, Ok, PromiseResult } from "libsys/result";
import { krnlfs } from "./fs";
import { PID, spawnProcess } from "./process";

export namespace exec {
	export interface HmielExecutableFormat {
		version: number,
		interpreter: string,
		data: Array<number>
	}

	export namespace error {
		export class UnsupportedExecutableVersion extends Error {
			name: string = 'UnsupportedExecutableVersion';
			constructor(version: number) {
				super(`Version '${version}' of this executable is unsupported`)
			}
		}
	}

	export function createExecutableFromURL(url: string): Uint8Array {
		let executable: HmielExecutableFormat = {
			version: 100,
			interpreter: 'hmielOS_URL',
			data: Array.from(new TextEncoder().encode(url))
		};

		return new TextEncoder().encode(JSON.stringify(executable));
	}

	export async function executeFromFS(path: string, parent: PID, args: Array<string> = []): PromiseResult<PID> {
		let fh = krnlfs.open(path, sysfs.open.AccessFlag.ReadOnly, sysfs.open.StatusFlag.Normal, sysfs.open.Type.Normal);

		if (!fh.ok)
			return fh;

		let content = await krnlfs.read(fh.value, -1, 0);

		if (!content.ok)
			return content;

		krnlfs.close(fh.value);

		const decoder = new TextDecoder();
		try {
			let executable = JSON.parse(decoder.decode(content.value)) as HmielExecutableFormat;

			// Validity check
			if (executable.version >= 200)
				return Err(new error.UnsupportedExecutableVersion(executable.version));

			if (executable.interpreter == 'hmielOS_URL') {
				let url = decoder.decode(Uint8Array.from(executable.data));

				const pid = spawnProcess(url, parent, args);
				if (!pid.ok)
					return pid;

				return Ok(pid.value);
			}

			return executeFromFS(executable.interpreter, parent, [path, ...args]);
		} catch (error) {
			return Err(new Error('Not Executable'));
		}
	}
}