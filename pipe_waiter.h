#pragma once
#ifndef __PIPE_WAITER_H
#define __PIPE_WAITER_H
void AddPipeHandle(void* hf);
void RemoveAndClosePipeHandle(void* hf);
void InitPipeWaiter();
void StopPipeWaiter();
void StartWaitingForPipes();
#endif
