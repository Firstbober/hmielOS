# hmielOS

Unix-like "operating system" in TypeScript and HTML.

```
npm i
npm run dev
```

## Contributing

### Where to start reading the code?

**src/kernel/boot.ts**

From there you will be able to read nearly all important code and analyze it.

### How to add syscalls?

Go into `src/lib/libsys.ts` and look at `Syscalls` interface and `export const syscalls: Syscalls`. Add your own syscall then go to `kernel/syscall.ts` and write the implementation.

### How to add new programs?

Create one in `base` based on `sysinit` or `hosh` programs and write it onto the filesystem using functions in `src/kernel/boot.ts`.