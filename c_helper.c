#ifndef _WIN32
//Unix stuff
#include <sys/file.h>
#include <sys/stat.h>
#include <errno.h>
#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int UnixMatchFileAttributes(char* fntar,char* fnsrc){
	#ifndef WEB
		struct stat sb;
		memset(&sb,0,sizeof(sb));
		if(stat(fntar,&sb)!=0){return 0;}
		if(chmod(fnsrc,sb.st_mode&(S_ISUID|S_ISGID|S_ISVTX|S_IRWXU|S_IRWXG|S_IRWXO))!=0){return 0;}
		if(chown(fnsrc,sb.st_uid,sb.st_gid)!=0){return 0;}
	#endif
	return 1;
}

int UnixIsFirstInstance(){
	#ifndef WEB
		int pid_file = open("/var/run/qpad.pid", O_CREAT | O_RDWR, 0666);
		int rc;
		if(pid_file==-1){return 1;}
		rc = flock(pid_file, LOCK_EX | LOCK_NB);
		if(rc) {
		    if(EWOULDBLOCK == errno){
		        return 0;
		    }
		}
	#endif
	return 1;
}

#endif
