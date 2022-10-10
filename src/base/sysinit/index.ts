import { libsysInit, syscall } from "libsys";
import { sysfs } from "libsys/fs";
import { Result } from "libsys/result";

const ThrowResult = <T, E>(result: Result<T, E>) => {
	if (!result.ok)
		throw result.error;

	return result.value;
}

libsysInit().then(async () => {
	let unitFiles: Array<string> = []

	const config_unitHandle = ThrowResult(await syscall.syscalls.opendir(
		'/system/config/sysinit/unit'
	));
	const config_unitDirectory = ThrowResult(await syscall.syscalls.readdir(config_unitHandle));

	for(const entry of config_unitDirectory) {
		if(entry.type == sysfs.entry.Type.File)
			unitFiles.push(entry.name);
	}

	console.log(unitFiles);

	/*
	let test = await syscall.syscalls.open(
		'/system/config/sysinit/unit/shell.unit',
		sysfs.open.AccessFlag.ReadOnly,
		sysfs.open.StatusFlag.Normal,
		sysfs.open.Type.Normal
	);

	console.log(test);
	if(!test.ok)
		return;

	console.log(await syscall.syscalls.read(test.value, -1, 0));
	console.log(await syscall.syscalls.close(test.value));
	*/
});
