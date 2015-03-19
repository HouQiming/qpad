var UI=require("gui2d/ui");

//////////////////////////
//todo: continuous undo
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

UI.m_ext_loaders={};
UI.RegisterLoaderForExtension=function(ext,f){
	UI.m_ext_loaders[ext]=f;
}
UI.m_zip_loaders={};
UI.RegisterZipLoader=function(name,f){
	UI.m_zip_loaders[name]=f;
}
var LoadZipObject=function(doc,zip_info){
	var sdata=zip_info.data
	var sformat=zip_info.ext
	if(!sformat){
		return sdata;
	}
	//var p_newline=sdata.indexOf("\n");
	//var sformat=sdata.substr(0,p_newline)
	var parser=UI.m_zip_loaders[sformat];
	if(!parser){
		throw new Error("invalid document format '@1'".replace("@1",sformat))
	}
	return parser(doc,sdata)
}

UI.LoadZipDocument=function(fname){
	var ret=UI._LoadZipDocument(fname)
	if(!ret){return ret}
	var doc=UI.NewGlobalDoc(fname);
	doc.m_loaded_file=ret
	if(!doc.GetObject(0)){return undefined;}
	if(!doc.GetObject(1)){return undefined;}
	doc.GetObject(1).OpenAsTab()
	return doc
}

UI.OpenFile=function(fname){
	//todo: consult history for loader preference
	var ext=UI.GetFileNameExtension(fname).toLowerCase()
	var parser=UI.m_ext_loaders[ext]
	if(parser){
		return parser(fname)
	}
	//try zipdoc by default for now
	return UI.LoadZipDocument(fname)
}

//////////////////////////
UI.internal_clipboard={}
UI.NewGlobalDoc=function(fname){
	this.m_objects=[]
	this.m_undo_ids=[]
	this.m_redo_ids=[]
	//////////////////
	//the style sheet document
	var obj_styles=Object.create(UI.JSONObject_prototype)
	obj_styles.Init()
	obj_styles.styles=[];
	this.AddObject(obj_styles)
	this.m_file_name=fname
}
UI.NewGlobalDoc.prototype={
	//documents should insert creation functions here
	AddObject:function(obj){
		var ret=this.m_objects.length;
		this.m_objects.push(obj)
		obj.m_global_document=this
		obj.m_sub_document_id=ret
		return ret;
	},
	ReportEdit:function(id){
		this.m_redo_ids=[]
		this.m_undo_ids.push(id)
		if(!id){
			var objs=this.m_objects;
			for(var i=0;i<objs.length;i++){
				var obj_i=objs[i]
				if(obj_i.OnStyleChange){
					obj_i.OnStyleChange()
				}
			}
		}
	},
	Undo:function(){
		if(!this.m_undo_ids.length){return;}
		var id=this.m_undo_ids.pop();
		this.m_objects[id].Undo()
		this.m_redo_ids.push(id)
	},
	Redo:function(){
		var id=this.m_redo_ids.pop();
		this.m_objects[id].Redo()
		this.m_undo_ids.push(id)
	},
	//////////////////////////////////////
	GetObject:function(id){
		var ret=this.m_objects[id]
		if(!ret){
			if(this.m_loaded_file){
				var zip_info=this.m_loaded_file.ReadObject(id)
				ret=LoadZipObject(this,zip_info)
				ret.m_global_document=this
				ret.m_sub_document_id=id
				this.m_objects[id]=ret;
			}
		}
		return ret
	},
	Save:function(){
		//JS-side object GC:
		//root=1, style always needed
		if(this.m_loaded_file){
			//load everything before saving
			var n=this.m_loaded_file.n
			for(var i=0;i<n;i++){
				this.GetObject(i);
			}
			this.m_loaded_file=undefined;
		}
		var objs=m_objects
		var n=0,mapping=[];
		for(var i=0;i<objs.length;i++){
			var obj_i=objs[i];
			obj_i.__unique_id=-1
			mapping[i]=-1;
		}
		objs[0].__unique_id=n++
		var dfs=function(id){
			var obj=m_objects[id]
			if(obj.__unique_id>=0){return;}
			obj.__unique_id=n++
			var refs=obj.GetReferences();
			if(refs){
				for(var i=0;i<refs.length;i++){
					var id_i=refs[i]
					dfs(id_i)
				}
			}
		}
		dfs(1)
		var new_objs=[];
		for(var i=0;i<objs.length;i++){
			var obj_i=objs[i];
			if(obj_i.__unique_id<0){
				//nothing
			}else{
				mapping[i]=new_objs.length
				new_objs.push(obj_i)
			}
		}
		for(var i=0;i<new_objs.length;i++){
			new_objs[i].SetReferences(mapping)
		}
		this.m_objects=new_objs
		//////////////////////////////////
		UI.SaveZipDocument(obj.file_name,new_objs)
	},
	///////////////////
	BeginCopy:function(stext){
		var ret={};
		ret.m_objects={};
		ret.m_objects[0]={styles:{}};
		ret.owner=this;
		UI.internal_clipboard={data:ret,key:stext}
		UI.SDL_SetClipboardText(stext)
		return ret
	},
	CopyObject:function(cobj,id){
		if(!id||cobj.m_objects[id]){return;}
		var obj_i=this.m_objects[id];
		cobj.m_objects[id]=[obj_i.default_extension,obj_i.Save()]//(obj_i.share_across_docs?obj_i:obj_i.Save())
	},
	CopyStyle:function(cobj,id){
		!?
		cobj.m_objects[0].styles[id]=this.m_objects[0].styles[id]
	},
	BeginPaste:function(){
		var stext=UI.SDL_GetClipboardText();
		if(UI.internal_clipboard.key==stext){
			return UI.internal_clipboard.data
		}
		return stext;
	},
	PasteObject:function(cobj,id){
		if(!id||cobj.owner==this){
			return id;
		}
		var obj=cobj.m_objects[id];
		//share_across_docs doesn't hold: have to clone it
		if(typeof obj!='number'){
			var parser=UI.m_zip_loaders[obj[0]];
			obj=parser(doc,obj[1])
			obj=this.AddObject(obj)
			cobj.m_objects[id]=obj
		}
		return obj//an id here
	},
	PasteStyle:function(cobj,id){
		var pstyles=cobj.m_objects[0].styles;
		var style_obj=pstyles[id]
		var pmystyles=this.m_objects[0].styles
		var sstyle=JSON.stringify(style_obj)
		var ret=this.m_style_map[sstyle]
		if(ret==undefined){
			ret=pmystyles.length
			pmystyles.push(JSON.parse(sstyle))
			this.m_style_map[sstyle]=ret;
		}
		return ret;
	},
};

UI.GlobalDoc_prototype=UI.NewGlobalDoc.prototype

UI.JSONObject_prototype={
	//coulddo: string diff
	Init:function(){
		this.m_data={}
		this.m_undo_queue=[]
		this.m_redo_queue=[]
	},
	BeforeEdit:function(){
		this.m_redo_queue=[]
		this.m_undo_queue.push(JSON.stringify(this.m_data))
		this.m_global_document.ReportEdit(this.m_sub_document_id)
	},
	Undo:function(){
		this.m_redo_queue.push(JSON.stringify(this.m_data))
		this.m_data=JSON.parse(this.m_undo_queue.pop())
	},
	Redo:function(){
		this.m_undo_queue.push(JSON.stringify(this.m_data))
		this.m_data=JSON.parse(this.m_redo_queue.pop())
	},
	Save:function(){
		return JSON.stringify(this.m_data)
	}
};
