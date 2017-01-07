#pragma once
#ifndef __PIPE_WAITER_H
#define __PIPE_WAITER_H
void CreatePipeWaiterThread(void* handle,
void* ptr_fn_data,void* ptr_this_data,
void* ptr_fn_close,void* ptr_this_close);
#endif
