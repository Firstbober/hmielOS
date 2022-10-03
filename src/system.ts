import './index.css';

import { startTerminalOnTTY } from "./kernel/tty-terminal";
import { createTTYOnDisplay } from './kernel/tty';
import { Result } from './result';

let tty: number | Result<number> = createTTYOnDisplay(0)
if(tty.ok)
	tty = tty.value
tty = tty as number;

startTerminalOnTTY(tty);