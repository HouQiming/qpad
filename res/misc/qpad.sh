#!/bin/sh
grep -q '=== qpad interfacing script ===' ~/.bashrc || cat >>~/.bashrc <<'EOF'
# === qpad interfacing script ===
function qpad(){
	local STTY_STATE
	local CMD
	local SIZE
	if [ "$#" -lt 1 ]
	then
      echo "usage: qpad <file>"
      return
	fi
	if ! [ -f "$1" ]
	then
      if [ -e "$1" ]
      then
        echo "I can only edit normal files"
        return
      fi
      touch "$1"
	fi
	STTY_STATE=`stty -g`
	stty raw -echo
	echo -n -e '\e]9000;'
	echo -n "$1"
	echo -n -e '\007'
	wc -c "$1"
	cat "$1"
	while true
	do
      CMD=`head -c 1`
      if [ "${CMD}" == 's' ]
      then
        cp "$1" "$1.bak"
        read -d ';' SIZE
        head -c "${SIZE}" > "$1"
        echo -n "s"
      fi
      if [ "${CMD}" == 'q' ]
      then
        break
      fi
	done
	stty "${STTY_STATE}"
}
EOF
echo "Remote editing script installed to ~/.bashrc"
echo "Type 'qpad <file>' to edit it remotely"
