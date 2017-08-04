sed 's/@/dd count=1 bs=/;s/H/ ];then/;s/?/C=`\wc -c "$1"|egrep -o [0-9]+|head -n 1`/;s/P/printf /' >~/.qpad.sh <<'EOF'
qpad(){
local T
local D
local S
local C
if [ "$1" = ""H
P'usage: qpad <file>\n'
return
fi
if ! [ -f "$1"H
if [ -e "$1"H
P'invalid file\n'
return
fi
touch "$1"
fi
T=`stty -g`
stty raw -echo
P'not in qpad, press enter to quit\033]9001;\007'
D=`@1 2>/dev/null`
if [ "$D" != '#'H
P'\n'
stty "$T"
return
fi
?
P"\033]0;(qpad running)\007\033]9000;%s\007$C\n" "$1"
cat "$1"
while true;do
D=`@1 2>/dev/null`
if [ "$D" = 's'H
\cp "$1" "$1.bak"
S=""
while true;do
C=`@1 2>/dev/null`
if [ "$C" = ';'H
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
P's'
D='s'
fi
if [ "$D" = 'q'H
break
fi
done
P'\033]0;Terminal\007'
stty "$T"
}
EOF
I(){
if [ -f "$1" ];then
grep -q ~/.qpad.sh "$1" || printf "source ~/.qpad.sh\n" >>"$1"
fi
}
I ~/.profile
I ~/.bash_profile
I ~/.bashrc
source ~/.qpad.sh
# Try qpad <file>
