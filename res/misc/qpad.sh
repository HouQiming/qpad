#!/bin/sh
grep -q '=== qpad interfacing script ===' ~/.bashrc || cat >>~/.bashrc <<'EOF'
# === qpad interfacing script ===
qpad(){
	local TTYS
	local CMD
	local SIZE
	local CHAR
	if [ "$1" = "" ]; then
		echo "usage: qpad <file>"
		return
	fi
	if ! [ -f "$1" ]; then
		if [ -e "$1" ]; then
			echo "I can only edit normal files"
			return
		fi
		touch "$1"
	fi
	TTYS=`stty -g`
	stty raw -echo
	printf 'not in qpad, press enter to quit\033]9001;\007'
	CMD=`head -c 1`
	if [ "${CMD}" != '#' ]; then
		printf '\n'
		stty "${TTYS}"
		return
	fi
	printf '\033]0;(qpad running)\007\033]9000;%s\007' "$1"
	wc -c "$1"
	cat "$1"
	while true; do
		CMD=`head -c 1`
		if [ "${CMD}" = 's' ]; then
			cp "$1" "$1.bak"
			SIZE=""
			while true; do
				CHAR=`head -c 1`
				if [ "${CHAR}" = ';' ]; then
					break
				fi
				SIZE="${SIZE}${CHAR}"
			done
			head -c "${SIZE}" > "$1"
			echo -n "s"
		fi
		if [ "${CMD}" = 'q' ]; then
			break
		fi
	done
	stty "${TTYS}"
}
# === end of qpad stuff ===
EOF
echo "Remote editing script installed to ~/.bashrc"
echo "Type 'qpad <file>' to edit it remotely"
