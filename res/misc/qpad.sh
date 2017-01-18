grep -q '=== qpad interfacing script ===' ~/.profile || cat >>~/.profile <<'EOF'
# === qpad interfacing script ===
qpad(){
local T
local D
local S
local C
if [ "$1" = "" ];then
echo "usage: qpad <file>"
return
fi
if ! [ -f "$1" ];then
if [ -e "$1" ];then
echo "I can only edit normal files"
return
fi
touch "$1"
fi
T=`stty -g`
stty raw -echo
printf 'not in qpad, press enter to quit\033]9001;\007'
D=`dd count=1 bs=1 2>/dev/null`
if [ "$D" != '#' ];then
printf '\n'
stty "$T"
return
fi
printf '\033]0;(qpad running)\007\033]9000;%s\007' "$1"
wc -c "$1"
cat "$1"
while true;do
D=`dd count=1 bs=1 2>/dev/null`
if [ "$D" = 's' ];then
cp "$1" "$1.bak"
S=""
while true;do
C=`dd count=1 bs=1 2>/dev/null`
if [ "$C" = ';' ];then
break
fi
S="$S$C"
done
dd count=1 bs=$S >"$1" 2>/dev/null
echo -n s
fi
if [ "$D" = 'q' ];then
break
fi
done
stty "$T"
}
# Remote editing script installed to ~/.profile
# Type 'qpad <file>' to edit it remotely
EOF
source ~/.profile
