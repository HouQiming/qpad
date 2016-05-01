#ifndef _WIN32
//Unix stuff
#include <sys/stat.h>
#include <unistd.h>

int UnixMatchFileAttributes(char* fntar,char* fnsrc){
	struct stat sb;
	memset(&sb,0,sizeof(sb));
	if(stat(fntar,&sb)!=0){return 0;}
	if(chmod(fnsrc,sb.st_mode&(S_ISUID|S_ISGID|S_ISVTX|S_IRWXU|S_IRWXG|S_IRWXO))!=0){return 0;}
	if(chown(fnsrc,sb.st_uid,sb.st_gid)!=0){return 0;}
	return 1;
}

#endif
