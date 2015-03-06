var UI=require("gui2d/ui");
var g_regexp_chopdir=new RegExp("(.*)[/\\\\]([^/\\\\]*)");
var g_regexp_chopext=new RegExp("(.*)\\.([^.\\\\]*)");

UI.GetMainFileName=function(fname){
	var ret=fname.match(g_regexp_chopdir);
	var main_name=null;
	if(!ret){
		main_name=fname;
	}else{
		main_name=ret[2];
	}
	ret=main_name.match(g_regexp_chopext);
	if(ret){
		main_name=ret[1];
	}
	return main_name;
}

UI.GetFileNameExtension=function(fname){
	var ret=fname.match(g_regexp_chopext);
	if(ret){
		return ret[2];
	}else{
		return "";
	}
}

var LOADER=exports;

LOADER.m_ext_loaders={};
LOADER.RegisterLoaderForExtension=function(ext,f){
	LOADER.m_ext_loaders[ext]=f;
}
LOADER.m_zip_loaders={};
LOADER.RegisterZipLoader=function(name,f){
	LOADER.m_zip_loaders[name]=f;
}
LOADER.LoadObject=function(data_list,id,fname){
	var sdata=data_list[id*2+0]
	var sformat=data_list[id*2+1]
	if(!sformat){
		return sdata;
	}
	//var p_newline=sdata.indexOf("\n");
	//var sformat=sdata.substr(0,p_newline)
	var parser=LOADER.m_zip_loaders[sformat];
	if(!parser){
		throw new Error("invalid document format '@1'".replace("@1",sformat))
	}
	var ret=parser(data_list,id,fname)
	data_list[id*2+0]=ret;
	data_list[id*2+1]=null;
	return ret
}

UI.OpenFile=function(fname){
	//todo: consult history for loader preference
	var ext=UI.GetFileNameExtension(fname).toLowerCase()
	var parser=LOADER.m_ext_loaders[ext]
	if(parser){
		return parser(fname)
	}
	//try zipdoc by default for now
	var data_list=UI.LoadZipDocument(fname)
	return LOADER.LoadObject(data_list,0,fname)
}

