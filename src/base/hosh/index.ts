import { libsysInit, syscall } from "libsys";
import { std } from "libsys/std";

libsysInit().then(async () => {
	await std.print("hosh for hmiel-os $");

	const textDecoder = new TextDecoder();
	while(true) {
		const r = await syscall.syscalls.read(0, -1, 0);
		if(!r.ok)
			continue;

		const got = textDecoder.decode(r.value);
		console.log(got);
	}
});