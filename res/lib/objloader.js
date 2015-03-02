
var LOADER=exports;

LOADER.m_loaders={};
LOADER.RegisterLoader=function(name,f){
	LOADER.m_loaders[name]=f;
}
LOADER.LoadObject=function(data_list,id,fname){
	var sdata=data_list[id*2+0]
	var sformat=data_list[id*2+1]
	if(!sformat){
		return sdata;
	}
	//var p_newline=sdata.indexOf("\n");
	//var sformat=sdata.substr(0,p_newline)
	var parser=LOADER.m_loaders[sformat];
	if(!parser){
		throw new Error("invalid document format '@1'".replace("@1",sformat))
	}
	var ret=parser(data_list,id,fname)
	data_list[id*2+0]=ret;
	data_list[id*2+1]=null;
	return ret
}

LOADER.LoadFile=function(fname){
	//todo: a general "load file" - extension based
	var data_list=UI.LoadZipDocument(fname)
	return LOADER.LoadObject(data_list,0,fname)
}

