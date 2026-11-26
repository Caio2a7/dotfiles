#!/bin/sh
# Wake the alt-resize daemon. O_RDWR open on a FIFO never blocks, even with no reader.
f="$XDG_RUNTIME_DIR/alt-resize.fifo"
[ -p "$f" ] && { exec 3<>"$f"; echo >&3; }
exit 0
