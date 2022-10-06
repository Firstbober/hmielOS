import { Err, Ok, Result } from "../result";
import path from "path-browserify";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export enum FSEntryType {
	Directory,
	File,
	FunctionalFile
}

/// Read, write, execute
export type FSEntryAttributes = [boolean, boolean, boolean];

export type FSEntryDirectory = { type: FSEntryType.Directory, name: string, attributes: FSEntryAttributes, entries: Array<FSEntry> };
export type FSEntryFile = { type: FSEntryType.File, name: string, attributes: FSEntryAttributes, inOpQueue: number, data: Uint8Array };
export type FSEntryFunctionalFile = { type: FSEntryType.FunctionalFile, name: string, attributes: FSEntryAttributes, inOpQueue: number, data: Uint8Array };

export type FSEntry =
	| FSEntryDirectory
	| FSEntryFile
	| FSEntryFunctionalFile;

export let root: FSEntryDirectory = {
	type: FSEntryType.Directory,
	name: '/',
	attributes: [true, false, true],
	entries: []
};

interface FSFileDescriptor {
	type: FSEntryType,
	path: string,
	entry: FSEntry
	accessFlag: fs.FileAccessFlag,
	statusFlag: fs.FileStatusFlag
}

let fileDescriptors: Map<fs.FileHandle, FSFileDescriptor> = new Map();
// 0/1 - read/write
let operationQueue: Array<[boolean]> = [];

export namespace fs {
	export type FileHandle = number;

	export enum FileAccessFlag {
		None,
		ReadOnly,
		WriteOnly,
		ReadWrite
	}

	export enum FileStatusFlag {
		Normal,
		Append,
		Create,
	}

	export namespace error {
		export class NoSuchEntry extends Error { name: string = 'NoSuchEntry'; }
		export class NoSuchFileHandle extends Error { name: string = 'NoSuchFileHandle'; }
		export class EntryExists extends Error { name: string = 'EntryExists' }
		// TODO Accept FSEntryType as message
		export class InvalidEntryType extends Error { name: string = 'InvalidEntryType' }
		export class OperationInaccessible extends Error { name: string = 'OperationInaccessible' }
		export class ParentDoesntExist extends Error { name: string = 'ParentDoesntExist' }
		export class IsADirectory extends Error { name: string = 'IsADirectory'; }
		export class OutOfRange extends Error { name: string = 'OutOfRange'; }
	}

	function getEntry(path: string): Result<[FSEntry, FSEntryDirectory], [Error, FSEntryDirectory]> {
		path = path.startsWith('/') ? path : `/${path}`;

		let pathElements = path.split('/');
		pathElements.shift();

		if (pathElements[0] == '')
			return Ok([root, root]);

		let currentDirectory: FSEntryDirectory = root;

		let i = 0;
		let foundElements = 1;

		for (const pel of pathElements) {
			entries: for (const entry of currentDirectory.entries) {
				if (pel != entry.name)
					continue;

				if (i == pathElements.length - 1)
					return Ok([entry, currentDirectory]);

				if (entry.type == FSEntryType.File) {
					return Err([new error.InvalidEntryType('File'), currentDirectory]);
				}

				if (entry.type == FSEntryType.Directory) {
					currentDirectory = entry;
					foundElements++;
					break entries;
				}

				return Err([new error.NoSuchEntry(), currentDirectory]);
			}

			i++;
		}

		if (foundElements < pathElements.length)
			return Err([new error.ParentDoesntExist(), currentDirectory])

		return Err([new error.NoSuchEntry(), currentDirectory]);
	}

	function getNewFileHandle(): FileHandle {
		let fileHandle = 0;
		for (const [key, _] of fileDescriptors) {
			if (key > fileHandle)
				fileHandle = key;
		}

		return fileHandle;
	}

	function attributesIntoFlag(attributes: FSEntryAttributes): FileAccessFlag {
		let read, write = [attributes[0], attributes[1]];

		if (read && write)
			return FileAccessFlag.ReadWrite

		if (read)
			return FileAccessFlag.ReadOnly

		if (write)
			return FileAccessFlag.WriteOnly

		return FileAccessFlag.None
	}

	function getFileDescriptor(fh: FileHandle): Result<FSFileDescriptor> {
		if (!fileDescriptors.has(fh))
			return Err(new error.NoSuchFileHandle());

		let fd = fileDescriptors.get(fh)!;
		return Ok(fd);
	}

	export function open(path: string, accessFlag: FileAccessFlag, statusFlag: FileStatusFlag = FileStatusFlag.Normal): Result<FileHandle> {
		const foundEntry = getEntry(path);

		if (!foundEntry.ok && statusFlag != FileStatusFlag.Create)
			return Err(foundEntry.error[0]);

		if (!foundEntry.ok)
			if (!(foundEntry.error[0] instanceof error.NoSuchEntry))
				return Err(foundEntry.error[0])

		if (foundEntry.ok)
			if (foundEntry.value[0].type == FSEntryType.Directory)
				return Err(new error.IsADirectory());

		if(!foundEntry.ok && statusFlag == FileStatusFlag.Create && !foundEntry.error[1].attributes[1]) {
			return Err(new error.OperationInaccessible('write'));
		}

		let fileHandle = getNewFileHandle();

		let pathSplit = path.split('/');
		let entry: FSEntry = foundEntry.ok ? foundEntry.value[0] : {
			type: FSEntryType.File,
			name: pathSplit[pathSplit.length - 1],
			attributes: foundEntry.error[1].attributes,
			inOpQueue: -1,
			data: new Uint8Array(0)
		};

		if (!foundEntry.ok && statusFlag == FileStatusFlag.Create) {
			foundEntry.error[1].entries.push(entry);
		}

		fileDescriptors.set(fileHandle, {
			type: foundEntry.ok ? foundEntry.value[0].type : FSEntryType.File,
			entry,
			path,
			accessFlag,
			statusFlag
		});

		return Ok(fileHandle);
	}

	export function close(fh: FileHandle): boolean {
		return fileDescriptors.delete(fh);
	}

	export function opendir(path: string): Result<FileHandle> {
		const foundEntry = getEntry(path);

		if (!foundEntry.ok)
			return Err(new error.NoSuchEntry())

		let fileHandle = getNewFileHandle();

		fileDescriptors.set(fileHandle, {
			type: foundEntry.ok ? foundEntry.value[0].type : FSEntryType.File,
			entry: foundEntry.value[0],
			path,
			accessFlag: attributesIntoFlag(foundEntry.value[0].attributes),
			statusFlag: FileStatusFlag.Normal
		});

		return Ok(fileHandle);
	}

	export function readdir(fh: FileHandle): Result<Array<FSEntry>> {
		if (!fileDescriptors.has(fh))
			return Err(new error.NoSuchFileHandle());

		let fd = fileDescriptors.get(fh)!;

		if (fd.type != FSEntryType.Directory)
			return Err(new error.InvalidEntryType());

		return Ok((fd.entry as FSEntryDirectory).entries);
	}

	export function mkdir(dirPath: string, recursive: boolean = false, attributes: FSEntryAttributes = [true, true, true]): Result<undefined> {
		const foundEntry = getEntry(dirPath);

		if (foundEntry.ok)
			return Err(new error.EntryExists())

		if (!foundEntry.ok)
			if (!(foundEntry.error[0] instanceof error.NoSuchEntry) && (foundEntry.error[0] instanceof error.ParentDoesntExist && !recursive))
				return Err(foundEntry.error[0])

		if (!recursive) {
			foundEntry.error[1].entries.push({
				type: FSEntryType.Directory,
				name: path.basename(dirPath),
				attributes,
				entries: []
			});
			return Ok(undefined)
		}

		const elements = dirPath.startsWith("/") ? dirPath.split('/') : (`/${dirPath}`.split('/'));
		elements.shift()
		let newPath = '/';

		for (const pel of elements) {
			newPath = path.join(newPath, pel);
			const foundEntry = getEntry(newPath);

			if (!foundEntry.ok) {
				foundEntry.error[1].entries.push({
					type: FSEntryType.Directory,
					name: pel,
					attributes,
					entries: []
				});
			}
		}

		return Ok(undefined);
	}

	async function fileOpCommon<T>(type: boolean, fh: FileHandle, callback: (entry: FSEntryFile) => Promise<Result<T>>): Promise<Result<T>> {
		let fd = getFileDescriptor(fh);
		if (!fd.ok)
			return fd;

		if (fd.value.type == FSEntryType.Directory)
			return Err(new error.IsADirectory())

		if (type)
			if (!fd.value.entry.attributes[1])
				return Err(new error.OperationInaccessible('write'));
		if (!type)
			if (!fd.value.entry.attributes[0])
				return Err(new error.OperationInaccessible('read'));


		let entry = fd.value.entry as FSEntryFile;
		while (entry.inOpQueue != -1) {
			await sleep(10);
		}

		let qP = operationQueue.push([type]) - 1;

		let result = await callback(entry);

		operationQueue.splice(qP, 1);

		return result;
	}

	export async function read(fh: FileHandle, count: number, offset: number): Promise<Result<Uint8Array>> {
		return await fileOpCommon(false, fh, async (entry) => {
			if (count + offset > entry.data.length) {
				return Err(new error.OutOfRange());
			}

			return Ok(entry.data.subarray(offset, count == -1 ? entry.data.length : count));
		});
	}

	export async function write(fh: FileHandle, buffer: Uint8Array, count: number, offset: number): Promise<Result<number>> {
		return await fileOpCommon(true, fh, async (entry) => {
			let realCount = count;
			if (count == -1) realCount = buffer.length;

			if (offset + realCount > entry.data.length) {
				let newData = new Uint8Array(offset + realCount);
				newData.set(entry.data, 0);
				entry.data = newData;
			}

			entry.data.set(buffer.subarray(0, realCount), offset);

			return Ok(realCount);
		})
	}
}