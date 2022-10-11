export namespace sysfs {
	export namespace open {
		export type Handle = number;

		export const StdIn = 0;
		export const StdOut = 1;
		export const StdErr = 2;

		export enum AccessFlag {
			None,
			ReadOnly,
			WriteOnly,
			ReadWrite
		}

		export enum StatusFlag {
			Normal,
			Append,
			Create,
		}

		export enum Type {
			Normal,
			Functional,
			Virtual
		}
	}

	export namespace entry {
		export enum Type {
			Directory,
			File,
			FunctionalFile
		}

		/// Read, write, execute
		export type Attributes = [boolean, boolean, boolean];

		export type Directory = { type: Type.Directory, name: string, attributes: Attributes, entries: Array<Entry> };
		export type File = { type: Type.File, name: string, attributes: Attributes };
		export type FunctionalFile = {
			type: Type.FunctionalFile,
			name: string,
			attributes: Attributes
		};

		export type Entry =
			| Directory
			| File
			| FunctionalFile;
	}
}