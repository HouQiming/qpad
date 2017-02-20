console={
	log:function(){
		for(var i=0;i<arguments.length;i++){
			if(i){Duktape.__console_output.push(' ');}
			Duktape.__console_output.push(arguments[i])
		}
		Duktape.__console_output.push('\n');
	}
};
Duktape.__eval_expr=function(){
	try{
		Duktape.__console_output=[];
		Duktape.__error=undefined;
		Duktape.__error_stack=undefined;
		var ret=JSON.stringify(eval(Duktape.__code));
		return ret;
	}catch(e){
		Duktape.__error=e.message;
		Duktape.__error_stack=e.stack;
		return undefined;
	}
};
Duktape.__get_status=function(){
	return {__error_stack:Duktape.__error_stack,__console_output:Duktape.__console_output.join('')};
};
