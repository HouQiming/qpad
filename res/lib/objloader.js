
var LOADER=exports;

LOADER.m_loaders={};
LOADER.RegisterLoader=function(name,f){
	LOADER.m_loaders[name]=f;
}
LOADER.ParseObject=function(sdata,is_root){
	var p_newline=sdata.indexOf("\n");
	var parser=LOADER.m_loaders[sdata.substr(0,p_newline)];
	if(!parser){return undefined;}
	return parser(sdata,is_root)
}
