/*****************************************************************/
/* This is a sandbox file to test out different settings.        */
/* It won't be saved, so don't put anything useful here.         */
/* Other files have to be _RELOADED_ for changes to take effect. */
/*****************************************************************/
#include <stdio.h>

#define EXAMPLE_CONST 42

struct ExampleStruct{
	int example_member;
};

int ExampleFunction(const ExampleStruct &a){
	return a.example_member*EXAMPLE_CONST;
}

void AnotherFunction(){
	char *example_array[20];
	// Edit the lines below to test the edit propagation feature
	//   example_array[0]="Lorem"; → char* Lorem=example_array[0];
	example_array[0]="Lorem";
	example_array[1]="ipsum";
	example_array[2]="dolor";
	example_array[3]="sit";
	example_array[4]="amet";
	example_array[5]="consectetur";
	example_array[6]="adipiscing";
	example_array[7]="elit";
	example_array[8]="sed";
	example_array[9]="do";
	example_array[10]="eiusmod";
	example_array[11]="tempor";
	example_array[12]="incididunt";
	example_array[13]="ut";
	example_array[14]="labore";
	example_array[15]="et";
	example_array[16]="dolore";
	example_array[17]="magna";
	example_array[18]="aliqua";
	example_array[19]="Ut";
	///////////////////////////////////
	// Move cursor a few lines below to see outer-scope overlays
	char concatenated[512]={0};
	strcat(concatenated,example_array[0]);
	strcat(concatenated,example_array[1]);
	strcat(concatenated,example_array[2]);
	strcat(concatenated,example_array[3]);
	strcat(concatenated,example_array[4]);
	strcat(concatenated,example_array[5]);
	strcat(concatenated,example_array[6]);
	strcat(concatenated,example_array[7]);
	strcat(concatenated,example_array[8]);
	strcat(concatenated,example_array[9]);
	strcat(concatenated,example_array[10]);
	strcat(concatenated,example_array[11]);
	strcat(concatenated,example_array[12]);
	strcat(concatenated,example_array[13]);
	strcat(concatenated,example_array[14]);
	strcat(concatenated,example_array[15]);
	strcat(concatenated,example_array[16]);
	strcat(concatenated,example_array[17]);
	strcat(concatenated,example_array[18]);
	strcat(concatenated,example_array[19]);
	printf("%s\n",concatenated);
	// A unicode string for you to SHIFT+CTRL+U (⇧⌘U on Mac)
	printf("'文' == '\u6587'\n");
}

int main(){
	ExampleStruct a;
	a.example_member=24;
	printf("%d\n",ExampleFunction(a));
	AnotherFunction();
	return 0;
}
