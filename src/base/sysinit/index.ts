import { libsysInit, syscall } from "libsys";
import { sysfs } from "libsys/fs";
import { Result } from "libsys/result";
import * as TOML from "@ltd/j-toml";
import { std } from "libsys/std";

const ThrowResult = <T, E>(result: Result<T, E>) => {
	if (!result.ok)
		throw result.error;

	return result.value;
}

interface Unit {
	name: string,
	description: string,
	exec: string
}

libsysInit().then(async () => {
	let unitFiles: Array<string> = []
	let dependencyTree = {
		"boot.target": [] as Array<Unit>
	};

	/**
	 * Get all unit files in the config directory
	 */

	const config_unitHandle = ThrowResult(await syscall.syscalls.opendir(
		'/system/config/sysinit/unit'
	));
	const config_unitDirectory = ThrowResult(await syscall.syscalls.readdir(config_unitHandle));

	for(const entry of config_unitDirectory) {
		if(entry.type == sysfs.entry.Type.File)
			unitFiles.push(entry.name);
	}

	/**
	 * Read all collected files and create dependency tree
	 */

	const textDecoder = new TextDecoder();
	for(const unitFile of unitFiles) {
		const fh = ThrowResult(await syscall.syscalls.open(
			'/system/config/sysinit/unit/shell.unit',
			sysfs.open.AccessFlag.ReadOnly,
			sysfs.open.StatusFlag.Normal,
			sysfs.open.Type.Normal
		));

		const contentUint8 = ThrowResult(await syscall.syscalls.read(
			fh, -1, 0
		));
		await syscall.syscalls.close(fh);

		const contentString = textDecoder.decode(contentUint8);
		const contentTable = TOML.parse(contentString, {
			useBigInt: false
		} as any) as any;

		let unitTable = contentTable.Unit;
		let unit: Unit = {
			name: unitTable.Name,
			description: unitTable.Description,
			exec: unitTable.Exec
		};
		let unitWantedBy = contentTable.Unit.WantedBy;

		if(Object.values(unit).includes(undefined) || unitWantedBy == undefined || unitTable == undefined) {
			await std.print(`Unit file '${unitFile}' is invalid. Skipping...\n`);
			continue;
		}

		for(const [k, v] of Object.entries(dependencyTree)) {
			if(k == unitWantedBy) {
				v.push(unit);
			}
		}
	}

	await std.print("Got", dependencyTree["boot.target"].length, "unit(s) in boot.target.\n");

	/**
	 * Spawn necessary units listed in dependency tree
	 */

	// TODO
});
