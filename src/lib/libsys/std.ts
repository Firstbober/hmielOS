import { sysfs } from "./fs";
import { syscall } from "./libsys";

const textEncoder = new TextEncoder();

export namespace std {
	export async function print(...data: any[]) {
		await syscall.syscalls.write(sysfs.open.StdOut, textEncoder.encode(data.join(' ') + '\r\n'), -1, 0);
	}
}