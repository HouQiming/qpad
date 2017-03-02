#ifdef _WIN32
//Windows version
#include <windows.h>
#include "sdl_callbacks.h"

static DWORD WINAPI win_thread(void* param){
	void* buf[1]={NULL};
	HANDLE handle=(HANDLE)((void**)param)[0];
	void* ptr_fn_data=((void**)param)[1];
	void* ptr_this_data=((void**)param)[2];
	void* ptr_fn_close=((void**)param)[3];
	void* ptr_this_close=((void**)param)[4];
	free(param);
	param=NULL;
	for(;;){
		int n_read=0;
		int ret=ReadFile(handle,buf,1,&n_read,NULL);
		if(!ret||!n_read){
			break;
		}
		sdlcbQueueSync(ptr_fn_data,ptr_this_data,buf[0]);
	}
	sdlcbQueue(ptr_fn_close,ptr_this_close,NULL);
	return 0;
}

void CreatePipeWaiterThread(HANDLE handle,
void* ptr_fn_data,void* ptr_this_data,
void* ptr_fn_close,void* ptr_this_close){
	int tid=0;
	void** param=(void**)calloc(5,sizeof(void*));
	param[0]=handle;
	param[1]=ptr_fn_data;
	param[2]=ptr_this_data;
	param[3]=ptr_fn_close;
	param[4]=ptr_this_close;
	CreateThread(NULL,0,win_thread,param,0,&tid);
}
#else
//Unix version
#include <unistd.h>
#include <stdint.h>
#include "SDL.h"
#include "sdl_callbacks.h"

static int unix_thread(void* param){
	void* buf[1]={NULL};
	int handle=(int)(intptr_t)((void**)param)[0];
	void* ptr_fn_data=((void**)param)[1];
	void* ptr_this_data=((void**)param)[2];
	void* ptr_fn_close=((void**)param)[3];
	void* ptr_this_close=((void**)param)[4];
	free(param);
	param=NULL;
	for(;;){
		int ret=read(handle,buf,1);
		if(!(ret>0)){
			break;
		}
		sdlcbQueueSync(ptr_fn_data,ptr_this_data,buf[0]);
	}
	sdlcbQueue(ptr_fn_close,ptr_this_close,NULL);
	return 0;
}

void CreatePipeWaiterThread(void* handle,
void* ptr_fn_data,void* ptr_this_data,
void* ptr_fn_close,void* ptr_this_close){
	int tid=0;
	void** param=(void**)calloc(5,sizeof(void*));
	param[0]=handle;
	param[1]=ptr_fn_data;
	param[2]=ptr_this_data;
	param[3]=ptr_fn_close;
	param[4]=ptr_this_close;
	SDL_CreateThread(unix_thread,"pipe_waiter",param);
}

#endif
