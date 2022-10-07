export namespace sysfs {
	export namespace open {
		export type Handle = number;

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
}