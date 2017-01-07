//todo: non-windows version
#include <windows.h>
#include "SDL.h"

typedef struct{
	HANDLE* p;
	int n;
	int sz;
}THandles;

static CRITICAL_SECTION g_lock;
static volatile THandles g_all_handles={0};
static volatile THandles g_removing_handles={0};
static volatile HANDLE g_change_event=NULL;
static volatile HANDLE g_start_waiting_event=NULL;
static volatile int g_job_done=0;

static void pushHandle(volatile THandles* pool,HANDLE hf){
	if(pool->n >= pool->sz){
		pool->sz+=pool->sz;
		if(pool->sz<256){
			pool->sz=256;
		}
		if(!pool->p){
			pool->p=calloc(pool->sz,sizeof(HANDLE));
		}else{
			pool->p=realloc(pool->p,pool->sz*sizeof(HANDLE));
		}
	}
	pool->p[pool->n++]=hf;
}

static DWORD WINAPI win_thread(void* unused_param){
	for(;;){
		DWORD ret=WaitForMultipleObjects(g_all_handles.n,g_all_handles.p,0,INFINITE);
		SDL_Event a;
		//////////////
		//send the SDL event
		memset(&a,0,sizeof(a));
		a.type=SDL_USEREVENT;
		a.user.code=4;
		if(ret>=WAIT_OBJECT_0+1&&ret<WAIT_OBJECT_0+g_all_handles.n){
			a.user.data1=g_all_handles.p[ret-WAIT_OBJECT_0];
		}
		//printf("%d %d\n",ret-WAIT_OBJECT_0,g_all_handles.n);fflush(stdout);
		SDL_PushEvent(&a);
		//////////////
		//wait for the next frame
		WaitForSingleObject(g_start_waiting_event,INFINITE);
		//////////////
		//maintain the handles
		EnterCriticalSection(&g_lock);
		if(g_job_done){
			LeaveCriticalSection(&g_lock);
			break;
		}
		if(g_removing_handles.n){
			int n2=0,i;
			for(i=0;i<g_all_handles.n;i++){
				HANDLE handle_i=g_all_handles.p[i];
				int is_bad=0;
				int j;
				for(j=0;j<g_removing_handles.n;j++){
					if(handle_i==g_removing_handles.p[j]){
						is_bad=1;
						break;
					}
				}
				if(!is_bad){
					g_all_handles.p[n2++]=handle_i;
				}
			}
			g_all_handles.n=n2;
			for(i=0;i<g_removing_handles.n;i++){
				CloseHandle(g_removing_handles.p[i]);
			}
			g_removing_handles.n=0;
		}
		LeaveCriticalSection(&g_lock);
	}
	CloseHandle(g_change_event);
	return 0;
}

void AddPipeHandle(void* hf){
	EnterCriticalSection(&g_lock);
	pushHandle(&g_all_handles,(HANDLE)hf);
	LeaveCriticalSection(&g_lock);
	SetEvent(g_change_event);
}

void RemoveAndClosePipeHandle(void* hf){
	EnterCriticalSection(&g_lock);
	pushHandle(&g_removing_handles,(HANDLE)hf);
	LeaveCriticalSection(&g_lock);
	SetEvent(g_change_event);
}

void StartWaitingForPipes(){
	SetEvent(g_start_waiting_event);
}

void InitPipeWaiter(){
	int tid=0;
	InitializeCriticalSectionAndSpinCount(&g_lock,100);
	g_change_event=CreateEventA(NULL,0,0,NULL);
	g_start_waiting_event=CreateEventA(NULL,0,0,NULL);
	pushHandle(&g_all_handles,g_change_event);
	CreateThread(NULL,0,win_thread,NULL,0,&tid);
}

void StopPipeWaiter(){
	EnterCriticalSection(&g_lock);
	g_job_done=1;
	LeaveCriticalSection(&g_lock);
	SetEvent(g_change_event);
	SetEvent(g_start_waiting_event);
}
