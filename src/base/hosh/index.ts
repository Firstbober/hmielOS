import { libsysInit } from "libsys";
import { std } from "libsys/std";

libsysInit().then(async () => {
	await std.print("hosh for hmiel-os $");
});