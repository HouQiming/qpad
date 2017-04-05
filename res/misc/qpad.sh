sed 's/@/dd count=1 bs=/;s/?/C=`wc -c "$1"|egrep -o [0-9]+|head -n 1`/;s/P/printf/' >~/.qpad.sh <<'EOF'
qpad(){
local T
local D
local S
local C
if [ "$1" = "" ];then
P 'usage: qpad <file>\n'
return
fi
if ! [ -f "$1" ];then
if [ -e "$1" ];then
P 'invalid file\n'
return
fi
touch "$1"
fi
T=`stty -g`
stty raw -echo
P 'not in qpad, press enter to quit\033]9001;\007'
D=`@1 2>/dev/null`
if [ "$D" != '#' ];then
P '\n'
stty "$T"
return
fi
?
P "\033]0;(qpad running)\007\033]9000;%s\007$C\n" "$1"
cat "$1"
while true;do
D=`@1 2>/dev/null`
if [ "$D" = 's' ];then
mv "$1" "$1.bak"
S=""
while true;do
C=`@1 2>/dev/null`
if [ "$C" = ';' ];then
break
fi
S="$S$C"
done
@$S >"$1" 2>/dev/null
?
D=`expr $S - $C`
while [ "$D" != 0 ];do
@$D >>"$1" 2>/dev/null
?
D=`expr $S - $C`
done
P 's'
D='s'
fi
if [ "$D" = 'q' ];then
break
fi
done
P '\033]0;Terminal\007'
stty "$T"
}
EOF
grep -q ~/.qpad.sh ~/.profile || printf "source ~/.qpad.sh\n" >>~/.profile
source ~/.qpad.sh
