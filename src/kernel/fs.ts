import { Err, Ok, Result } from "../result";

export enum FSEntryType {
	Directory,
	File,
	FunctionalFile
}

/// Read, write, execute
export type FSEntryAttributes = [boolean, boolean, boolean];

export type FSEntryDirectory = { type: FSEntryType.Directory, name: string, attributes: FSEntryAttributes, entries: Array<FSEntry> };
export type FSEntryFile = { type: FSEntryType.File, name: string, attributes: FSEntryAttributes };
export type FSEntryFunctionalFile = { type: FSEntryType.FunctionalFile, name: string, attributes: FSEntryAttributes };

export type FSEntry =
	| FSEntryDirectory
	| FSEntryFile
	| FSEntryFunctionalFile;

let root: FSEntryDirectory = {
	type: FSEntryType.Directory,
	name: '/',
	attributes: [true, true, true],
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
		// TODO Accept FSEntryType as message
		export class InvalidEntryType extends Error { name: string = 'InvalidEntryType' }
		export class ParentDoesntExist extends Error { name: string = 'ParentDoesntExist' }
		export class IsADirectory extends Error { name: string = 'IsADirectory'; }
	}

	function getEntry(path: string): Result<[FSEntry, FSEntryDirectory], [Error, FSEntryDirectory]> {
		if (!path.startsWith('/'))
			return Err([new error.NoSuchEntry(), root]);

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

		let fileHandle = getNewFileHandle();

		let pathSplit = path.split('/');
		let entry: FSEntry = foundEntry.ok ? foundEntry.value[0] : {
			type: FSEntryType.File,
			name: pathSplit[pathSplit.length - 1],
			attributes: foundEntry.error[1].attributes
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
}