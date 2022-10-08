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
	if(!test.ok)
		return;

	console.log(await syscall.syscalls.write(1, new TextEncoder().encode('Hello, world from sysinit process\r\n'), -1, 0));
	console.log(await syscall.syscalls.close(test.value));
});
