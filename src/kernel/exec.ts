export enum ExecutableType {
	URL
}

export interface HmielExecutableFormat {
	version: number,
	type: ExecutableType,
	data: Uint8Array
}

export function createExecutableFromURL(url: string): Uint8Array {
	let executable: HmielExecutableFormat = {
		version: 1,
		type: ExecutableType.URL,
		data: new TextEncoder().encode(url)
	};

	return new TextEncoder().encode(JSON.stringify(executable));
}