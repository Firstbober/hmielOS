import { libsysInit } from "libsys";

function arg(args: string[], definition: [string, string, string][]) {

}

libsysInit().then(async ({ args }) => {
	const pargs = arg(args, [
		['<path>', '', 'path to wasm file']
	]);

	const importObject = {
		module: {},
		env: {
			memory: new WebAssembly.Memory({ initial: 256 }),
		},
		wasi_unstable: {
			args_get: () => {},
			args_sizes_get: () => {},
			environ_get: () => {},
			environ_sizes_get: () => {},
			clock_res_get: () => {},
			clock_time_get: () => {},
			fd_advise: () => {},
			fd_allocate: () => {},
			fd_close: () => {},
			fd_datasync: () => {},
			fd_fdstat_get: () => {},
			fd_fdstat_set_flags: () => {},
			fd_fdstat_set_rights: () => {},
			fd_filestat_get: () => {},
			fd_filestat_set_size: () => {},
			fd_filestat_set_times: () => {},
			fd_pread: () => {},
			fd_prestat_get: () => {},
			fd_prestat_dir_name: () => {},
			fd_pwrite: () => {},
			fd_read: () => {},
			fd_readdir: () => {},
			fd_renumber	: () => {},
			fd_seek: () => {},
			fd_sync: () => {},
			fd_tell: () => {},
			fd_write: () => {},
			path_create_directory: () => {},
			path_filestat_get: () => {},
			path_filestat_set_times: () => {},
			path_link: () => {},
			path_open: () => {},
			path_readlink: () => {},
			path_remove_directory: () => {},
			path_rename: () => {},
			path_symlink: () => {},
			path_unlink_file: () => {},
			poll_oneoff: () => {},
			proc_exit: () => {},
			proc_raise: () => {},
			sched_yield: () => {},
			random_get: () => {},
			sock_accept: () => {},
			sock_recv: () => {},
			sock_send: () => {},
			sock_shutdown: () => {},
		}
	};

	WebAssembly.instantiateStreaming(fetch(
		"https://registry-cdn.wapm.io/contents/syrusakbary/coreutils/0.0.1/target/wasm32-wasi/release/uutils.wasm"
	), importObject).then(
		(obj) => {
			console.log("got here")
			console.log(obj);
		}
	);
});
