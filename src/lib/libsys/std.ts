import { sysfs } from "./fs";
import { syscall } from "./libsys";

const textEncoder = new TextEncoder();

export namespace std {
	export async function print(...data: any[]) {
		let dF = data.join(' ');
		dF = dF.replaceAll('\n', '\r\n');

		await syscall.syscalls.write(sysfs.open.StdOut, textEncoder.encode(dF + '\r\n'), -1, 0);
	}

	export async function printraw(...data: any[]) {
		let dF = data.join(' ');
		dF = dF.replaceAll('\n', '\r\n');

		await syscall.syscalls.write(sysfs.open.StdOut, textEncoder.encode(dF), -1, 0);
	}
}