// Sandbox file to test out different settings
#include <stdio.h>

#define EXAMPLE_CONST 42

struct ExampleStruct{
	int example_member;
};

int ExampleFunction(const ExampleStruct &a){
	return a.example_member*EXAMPLE_CONST;
}

int main(){
	ExampleStruct a;
	a.example_member=24;
	printf("%d\n",ExampleFunction(a));
	return 0;
}
