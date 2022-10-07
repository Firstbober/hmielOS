import { libsysInit, syscall } from "libsys";
import { sysfs } from "libsys/fs";
libsysInit().then(async () => {
	console.log("WORKS!");

	let test = await syscall.syscalls.open(
		'/home/test.sysinit.txt',
		sysfs.open.AccessFlag.ReadWrite,
		sysfs.open.StatusFlag.Create,
		sysfs.open.Type.Normal
	);

	console.log(test);
});
