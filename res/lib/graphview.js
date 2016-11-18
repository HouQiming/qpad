var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");
require("res/lib/code_editor");

///////////////////////////
//load global config
var g_developer={
	email:"invalid",
};
(function(){
	var s_git_config=IO.ReadAll(IO.ProcessUnixFileName("~/.gitconfig"));
	if(!s_git_config){
		return;
	}
	var match_email=s_git_config.match(/\n[ \t]*email[ \t]*=[ \t]*(.*)/);
	if(match_email){
		g_developer.email=match_email[1];
	}
})();

var g_regexp_chopdir=new RegExp("(.*)[/\\\\]([^/\\\\]*)");
var g_regexp_chopext=new RegExp("(.*)\\.([^/\\\\.]*)");
var GetMainFileName=function(fname){
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
};

var readdir=function(sname,flags){
	var fs=[];
	var fnext=IO.CreateEnumFileContext(sname,flags);
	var fs=[];
	if(fnext){
		for(;;){
			var fi=fnext();
			if(!fi){break;}
			fs.push(IO.NormalizeFileName(fi.name));
		}
		fnext=undefined;
	}
	return fs;
};

var SearchClassFileSimple=function(sname){
	var fs=readdir(sname+'.*',1);
	if(fs.length>1){
		fs.sort();
	}
	if(fs.length>0){
		return fs[0];
	}
	return undefined;
};

var SearchClassFile=function(cache,sname){
	for(var i=0;i<cache.search_paths.length;i++){
		var spath=cache.search_paths[i];
		var fn=SearchClassFileSimple(spath+'/'+sname);
		if(fn){return fn;}
	}
	return undefined;
};

UI.GetPrivateClassList=function(cache){
	var list=cache.m_private_node_list;
	if(!list){
		list=[];
		for(var i=0;i<cache.search_paths.length;i++){
			var spath=cache.search_paths[i];
			var fnext=IO.CreateEnumFileContext(spath+'/*',1);
			if(fnext){
				for(;;){
					var fi=fnext();
					if(!fi){break;}
					if(UI.GetFileNameExtension(fi.name).toLowerCase()!='zg'){
						list.push(UI.GetMainFileName(fi.name));
					}
				}
				fnext=undefined;
			}
		}
		cache.m_private_node_list=list;
	}
	return list;
};

UI.GetNodeClass=function(cache,nd){
	var s_dir=(nd.m_package_dir||'');
	var sname=nd.m_class;
	if(typeof(sname)!='string'){
		return sname;
	}
	var holder=cache.m_classes_by_name[s_dir+sname];
	if(holder==undefined){
		holder=null;
		var fn=undefined;
		if(s_dir){
			//console.log('GetNodeClass',sname,cache.m_file_dir+'/'+s_dir+sname);
			fn=SearchClassFileSimple(cache.m_file_dir+'/'+s_dir+sname);
		}
		if(!fn){fn=SearchClassFile(cache,sname);}
		var snode=IO.ReadAll(fn);
		if(snode){
			var ndcls=undefined;
			if(UI.GetFileNameExtension(fn).toLowerCase()=='zjs'){
				ndcls=UI.ParseJSNode(snode);
			}else{
				ndcls=UI.ParseTextNode(snode);
			}
			ndcls.m_file_name=IO.NormalizeFileName(fn);
			ndcls.m_class_name=sname;
			holder={
				m_ndcls:ndcls,
				m_file_name:IO.NormalizeFileName(fn),
			};
			holder.m_file_save_time=(UI.g_ce_file_save_time[holder.m_file_name]||0);
			ndcls.m_port_map={};
			for(var i=0;i<ndcls.m_ports.length;i++){
				var port_i=ndcls.m_ports[i];
				port_i.m_sort_y=i;
				ndcls.m_port_map[port_i.id]=port_i;
				if(typeof(port_i.type)=="string"){
					port_i.type=port_i.type.split(' ');
				}else{
					port_i.type=[];
				}
				if(typeof(port_i.ui)=="string"){
					port_i.ui=port_i.ui.split(' ');
				}
			}
		}
		cache.m_classes_by_name[sname]=holder;
	}
	return holder&&holder.m_ndcls;
};

//////////////////////////
//the graph class
var g_edge_formats={
	oneline:function(arr_output,s_input){
		return s_input.replace(/\r?\n[ \t]*/g,'');
	},
	jsstring:function(arr_output,s_input){
		return JSON.stringify(s_input);
	},
	indented:function(arr_output,s_input,nd,port){
		var s_target_indent='';
		var s_context=arr_output.length?arr_output[arr_output.length-1]:'';
		var p_newline=s_context.lastIndexOf('\n');
		if(p_newline>0){
			var match=s_context.substr(p_newline+1).match(/[ \t]+/);
			s_target_indent=(match&&match[0]||'');
		}
		if(s_input&&s_input[s_input.length-1]=='\n'){
			s_input=s_input.substr(0,s_input.length-1);
		}
		if(s_input&&s_target_indent){
			var s_indented=UI.ED_GetClipboardTextSmart(s_target_indent,s_input);
			//var s_tagprefix=(port.tagprefix||'//');
			if(!s_indented){
				s_indented=s_input;
				//s_target_indent='';
			}
			//return [s_target_indent,s_tagprefix,'@sync_push=',ndi.__id__,'\n',s_input,'\n',
			//	s_target_indent,s_tagprefix,'@sync_pop=',ndi.__id__].join('');
			return s_indented;
		}else{
			return s_input;
		} 
	},
};
var g_per_run_id=0;
var ExpandDots=function(nds,es,is_ungroup){
	var node_map={};
	var n=nds.length,m=es.length;
	var is_dot=[];
	var dot_dad=[],dot_ins=[],dot_outs=[];
	for(var i=0;i<nds.length;i++){
		is_dot[i]=(!isGroup(nds[i])&&nds[i].m_class=='__dot__');
		if(is_dot[i]&&is_ungroup&&!nds[i].m_is_group_dot){
			is_dot[i]=0;
		}
		dot_dad[i]=i;
		if(is_dot[i]){
			dot_ins[i]=[];
			dot_outs[i]=[];
		}
		node_map[nds[i].__id__]=i;
	}
	var Collapse=function(a){
		if(dot_dad[a]==a){return a;}
		var a0=Collapse(dot_dad[a]);
		dot_dad[a]=a0;
		return a0;
	}
	var es_new=[];
	for(var i=0;i<m;i++){
		var e=es[i];
		var v0=node_map[e.id0];
		var v1=node_map[e.id1];
		if(is_dot[v0]){
			v0=Collapse(v0);
			if(is_dot[v1]){
				//both are dots, merge in the dset
				v1=Collapse(v1);
				if(v0!=v1){
					dot_dad[v1]=v0;
					Array.prototype.push.apply(dot_ins[v0],dot_ins[v1]);
					Array.prototype.push.apply(dot_outs[v0],dot_outs[v1]);
				}
			}else{
				dot_outs[v0].push({v:v1,port:e.port1});
			}
		}else{
			if(is_dot[v1]){
				v1=Collapse(v1);
				dot_ins[v1].push({v:v0,port:e.port0});
			}else{
				//keep the edge
				es_new.push(e);
			}
		}
	}
	for(var i=0;i<n;i++){
		if(!is_dot[i]||dot_dad[i]!=i){continue;}
		var ins=dot_ins[i];
		var outs=dot_outs[i];
		for(var j0=0;j0<ins.length;j0++){
			for(var j1=0;j1<outs.length;j1++){
				if(!nds[ins[j0].v]||!nds[outs[j1].v]){continue;}
				es_new.push({
					id0:nds[ins[j0].v].__id__,port0:ins[j0].port,
					id1:nds[outs[j1].v].__id__,port1:outs[j1].port,
				});
			}
		}
	}
	return es_new;
};
var BUILD_UNGROUP_SCALE=1.0/65536.0;//prevent inner y from influencing input order
var Ungroup=function(nds,es, nds_ungroup,is_quiet){
	//remove group nodes and restore the old connections
	var nds_new=[];
	var es_new=[];
	var is_in_group={};
	for(var i=0;i<nds_ungroup.length;i++){
		is_in_group[nds_ungroup[i].__id__]=1;
	}
	//first copy the non-group-related nodes / edges
	for(var i=0;i<nds.length;i++){
		if(!is_in_group[nds[i].__id__]){
			nds_new.push(nds[i]);
			if(!is_quiet){nds[i].m_is_selected=0;}
		}
	}
	for(var i=0;i<es.length;i++){
		if(!is_in_group[es[i].id0]&&!is_in_group[es[i].id1]){
			es_new.push(es[i]);
		}
	}
	//then put in the old graphs and connect the dots
	var gport_map={};
	var nds_gen=[];
	for(var i=0;i<nds_ungroup.length;i++){
		var nd_group=nds_ungroup[i];
		var ndcls=nd_group.m_class;
		if(typeof(ndcls)=='string'){continue;}
		//the old graph
		var gr=ndcls.m_graph;
		if(!gr){
			throw new Error('bad ungroup');
			continue;
		}
		var dx=nd_group.x;
		var dy=nd_group.y;
		var node_map={};
		for(var j=0;j<gr.nds.length;j++){
			var ndj=gr.nds[j];
			//set m_last_group_name when ungrouping - the group node may have been renamed
			ndj.m_last_group_name=nd_group.m_caption;
			ndj.m_need_rebuild=nd_group.m_need_rebuild;
			nds_new.push(ndj);
			if(!is_quiet){ndj.m_is_selected=1;nds_gen.push(ndj);}
			ndj.x=ndj.m_group_dx;
			ndj.y=ndj.m_group_dy;
			if(is_quiet){ndj.x*=BUILD_UNGROUP_SCALE;ndj.y*=BUILD_UNGROUP_SCALE;}
			ndj.x+=dx;
			ndj.y+=dy;
			ndj.m_package_dir=(nd_group.m_package_dir||'')+(ndj.m_group_package_dir||'');
			ndj.m_is_disabled=(nd_group.m_is_disabled||ndj.m_group_is_disabled);
			node_map[ndj.__id__]=ndj;
		}
		for(var j=0;j<gr.es.length;j++){
			es_new.push(gr.es[j]);
		}
		//the edges
		var gr_reconnects=ndcls.m_reconnects;
		for(var j=0;j<gr_reconnects.length;j++){
			var cnj=gr_reconnects[j];
			gport_map[nd_group.__id__+'='+cnj.port_outer]=cnj.id_inner;
		}
		//propagate UI values - m_ui_port_map
		var gr_ui_port_map=ndcls.m_ui_port_map;
		if(gr_ui_port_map){
			for(var j=0;j<gr_ui_port_map.length;j++){
				var cnj=gr_ui_port_map[j];
				var s_ui_value=nd_group.m_ui_values[cnj.port_outer];
				if(s_ui_value!=undefined){
					node_map[cnj.id_inner].m_ui_values[cnj.port_inner]=s_ui_value;
				}
			}
		}
	}
	//translate the dot connections
	for(var i=0;i<es.length;i++){
		//the original es should be immutable
		var e=es[i];
		e={id0:e.id0,port0:e.port0,id1:e.id1,port1:e.port1};
		var did=0;
		if(is_in_group[e.id0]){
			did=1;
			e.id0=gport_map[e.id0+'='+e.port0];
			if(!e.id0){continue;}
			e.port0='out';
		}
		if(is_in_group[e.id1]){
			did=1;
			e.id1=gport_map[e.id1+'='+e.port1];
			if(!e.id0){continue;}
			e.port1='in';
		}
		if(did){
			es_new.push(e);
		}
	}
	//finally remove the dots
	if(!is_quiet){
		es_new=ExpandDots(nds_new,es_new,1);
		nds_new=nds_new.filter(function(ndi){return !ndi.m_is_group_dot;})
	}
	return [nds_new,es_new,nds_gen];
};
var isGroup=function(ndi){return typeof(ndi.m_class)!='string';}
var graph_prototype={
	SignalEdit:function(nds_rebuild){
		for(var i=0;i<nds_rebuild.length;i++){
			nds_rebuild[i].m_need_rebuild=1;
		}
		//the undo queue has to be built in cache
		this.OnChange(nds_rebuild);
	},
	CreateNode:function(class_name){
		var ret={
			__id__:[g_developer.email, (new Date()).toUTCString(), g_per_run_id++].join("&"),
			m_renamed_ports:{},
			m_ui_values:{},
			m_class:class_name,
			m_caption:typeof(class_name)=='string'?class_name:'group',
			m_need_rebuild:1,
		}
		this.nds.push(ret);
		return ret;
	},
	Save:function(fn){
		return IO.CreateFile(fn,JSON.stringify(this,null,1));
	},
	SelectionClear:function(){
		for(var i=0;i<this.nds.length;i++){
			this.nds[i].m_is_selected=0;
		}
	},
	DeleteSelection:function(is_quiet){
		this.nds=this.nds.filter(function(ndi){return !ndi.m_is_selected;})
		var is_valid={};
		for(var i=0;i<this.nds.length;i++){
			is_valid[this.nds[i].__id__]=this.nds[i];
		}
		var signals=[];
		this.es=this.es.filter(function(edgei){
			var nd0=is_valid[edgei.id0];
			var nd1=is_valid[edgei.id1];
			if(nd0){signals.push(nd0);}
			if(nd1){signals.push(nd1);}
			return nd0&&nd1;
		})
		if(!is_quiet){
			this.SignalEdit([signals]);
		}
	},
	Build:function(sbasepath,cache,is_rebuild){
		IO.m_build_path=sbasepath;
		//console.log(sbasepath);
		//console.log();
		IO.SetCurrentDirectory(sbasepath);
		//IO.Shell(['cd']);
		var es=this.es;
		var nds=this.nds;
		var uvid=0;
		////////////////////////
		//expand groups, recursively
		for(;;){
			var nds=nds.filter(function(nd){return !(isGroup(nd)&&nd.m_is_disabled);});
			var ret_ung=Ungroup(nds,es,nds.filter(isGroup),1);
			var has_group=0;
			for(var i=0;i<nds.length;i++){
				if(isGroup(nds[i])){
					//groups get expanded and their rebuild flags have to be reset manually
					nds[i].m_need_rebuild=0;
					has_group=1;
				}
			}
			if(!has_group){
				break;
			}
			nds=ret_ung[0];
			es=ret_ung[1]
		}
		////////////////////////
		//expand dots
		//create a dot disjoint set and an input/output set for each dot
		es=ExpandDots(nds,es,0);
		////////////////////////
		//preprocess the graph into a more convenient format
		var node_map={},degs=[],es_topo=[],es_gather=[];
		var n=nds.length,m=es.length;
		for(var i=0;i<n;i++){
			node_map[nds[i].__id__]=i;
			degs[i]=0;
			es_topo[i]=[];
			es_gather[i]=[];
		}
		for(var i=0;i<m;i++){
			var e=es[i];
			var v0=node_map[e.id0];
			var v1=node_map[e.id1];
			if(v0==undefined||v1==undefined){continue;}
			es_topo[v0].push(v1);
			es_gather[v1].push({v0:v0,port0:e.port0,port1:e.port1});
			degs[v1]++;
		}
		var Q=[],head=0;
		for(var i=0;i<n;i++){
			if(degs[i]==0){
				Q.push(i);
			}
		}
		while(head<Q.length){
			var v0=Q[head];
			head++;
			var es_v0=es_topo[v0];
			for(var i=0;i<es_v0.length;i++){
				var v1=es_v0[i];
				if(0==--degs[v1]){
					Q.push(v1);
				}
			}
		}
		if(Q.length<n){
			//error - select the in-loop nodes
			for(var i=0;i<n;i++){
				nds[i].m_is_selected=(degs[i]>0?1:0);
			}
			//error message
			console.log('dependency loop detected!')
			return 0;
		}
		var port_value_map=[];
		for(var i=0;i<n;i++){
			var bc_i=nds[i].m_build_cache;
			if(!bc_i){
				bc_i={};
				nds[i].m_build_cache=bc_i;
			}
			if(nds[i].m_is_disabled){
				bc_i={};
			}
			port_value_map[i]=bc_i;
		}
		for(var i=0;i<Q.length;i++){
			var v0=Q[i];
			var ndi=nds[v0];
			var need_build_i=(is_rebuild||ndi.m_need_rebuild);
			if(ndi.m_is_disabled){continue;}
			var ndcls=UI.GetNodeClass(cache,ndi);
			//reset/propagate need_rebuild
			var es_v0=es_topo[v0];
			for(var j=0;j<es_v0.length;j++){
				var v1=es_v0[j];
				nds[v1].m_need_rebuild=1;
			}
			ndi.m_need_rebuild=0;
			if(ndcls){
				var pvmap_v0=port_value_map[v0];
				if(need_build_i){
					//wipe the build cache
					pvmap_v0={};
					port_value_map[v0]=pvmap_v0;
					ndi.m_build_cache=pvmap_v0;
					//gather connected input
					var es_v0=es_gather[v0];
					es_v0.sort(function(e0,e1){return nds[e0.v0].y<nds[e1.v0].y;}.bind(this))
					for(var j=0;j<es_v0.length;j++){
						var s_output=port_value_map[es_v0[j].v0][es_v0[j].port0];
						if(typeof(s_output)=='string'){
							var s_port1=es_v0[j].port1;
							var ss_input_v0=pvmap_v0[s_port1];
							if(!ss_input_v0){ss_input_v0=[];pvmap_v0[s_port1]=ss_input_v0;}
							ss_input_v0.push(s_output);
						}
					}
					//fill dangling ports with m_ui_values or empty array
					for(var j=0;j<ndcls.m_ports.length;j++){
						var port_j=ndcls.m_ports[j];
						var id=port_j.id;
						if(port_j.dir=='input'&&!pvmap_v0[id]){
							var s_ui_value=ndi.m_ui_values[id];
							if(s_ui_value==undefined){
								s_ui_value=port_j.default;
							}
							if(s_ui_value){
								pvmap_v0[id]=[s_ui_value];
							}else{
								pvmap_v0[id]=[];
							}
						}
					}
					//run the implementation to fill the outputs
					//inputs are arrays, outputs are strings
					if(ndcls.m_script){
						try{
							ndcls.m_script.call(null,pvmap_v0,pvmap_v0);
						}catch(err){
							console.log(ndcls.m_file_name,err.stack);
						}
					}else if(ndcls.m_blocks){
						var pvmap_v0_s={};
						for(var id in pvmap_v0){
							pvmap_v0_s[id]=pvmap_v0[id].join('');
						}
						var input_formats={};
						var output_need_synctag={};
						for(var j=0;j<ndcls.m_ports.length;j++){
							var port_j=ndcls.m_ports[j];
							if(port_j.dir=='input'&&port_j.format){
								input_formats[port_j.id]=[port_j.format,port_j];
							}
							if(port_j.dir=='output'){
								output_need_synctag[port_j.id]=(port_j.format?0:(port_j.tagprefix||'//'));
							}
						}
						for(var j=0;j<ndcls.m_blocks.length;j+=2){
							var id=ndcls.m_blocks[j];
							var blocks_j=ndcls.m_blocks[j+1];
							var blocks_ret=[];
							for(var k=0;k<blocks_j.length;k++){
								var s_block_jk=blocks_j[k];
								if(k&1){
									var format_params=input_formats[s_block_jk];
									var f_format=undefined;
									if(format_params){
										f_format=g_edge_formats[format_params[0]];
									}
									var s_input_port=s_block_jk;
									var need_inline_sync_wrap=0;
									s_block_jk=pvmap_v0_s[s_input_port];
									if(output_need_synctag[id]){
										if(!format_params||format_params[0]=='indented'){
											//insert the input knob tag - line version
											s_block_jk=[output_need_synctag[id],'@sync_in=',output_need_synctag[id].length,' ',s_input_port,'\n',s_block_jk].join('');
										}else{
											if(output_need_synctag[id]=='//'){
												//insert the input knob tag - inline version
												need_inline_sync_wrap=1;
											}else{
												//coulddo: non-C mid-line sync tags
											}
										}
									}
									if(f_format){
										//format input ports
										s_block_jk=f_format(blocks_ret,s_block_jk,ndi,format_params[1]/*port_j*/);
									}
									if(need_inline_sync_wrap){
										s_block_jk=['/*[',s_input_port,'*/',s_block_jk,'/*]*/',].join('');
									}
								}
								blocks_ret.push(s_block_jk);
							}
							pvmap_v0[id]=blocks_ret.join('');
						}
						//variable generator
						for(var j=0;j<ndcls.m_ports.length;j++){
							var port_j=ndcls.m_ports[j];
							if(port_j.dir=='output'&&port_j.format){
								if(port_j.format=='var'){
									pvmap_v0[port_j.id]='zV'+uvid.toString();
									uvid++;
								}
							}
							if(port_j.dir=='output'&&output_need_synctag[port_j.id]&&pvmap_v0[port_j.id]){
								//we can't use file names here - they are *absolute*
								//node-port
								var s_prefix=output_need_synctag[port_j.id];
								var s_original=pvmap_v0[port_j.id];
								//console.log(ndcls.m_class_name,port_j.id,!!s_original)
								pvmap_v0[port_j.id]=[
									s_prefix,'@sync_push=',ndi.__id__,'?',port_j.id,'\n',
									s_original,(s_original[s_original.length-1]=='\n'?'':'\n'),
									s_prefix,'@sync_pop=',ndi.__id__,'?',port_j.id,
								].join('');
							}
						}
					}
				}
			}
		}
		this.SignalEdit([]);
	},
};

UI.LoadGraph=function(fn){
	var sdata=IO.ReadAll(fn);
	if(!sdata){return undefined;}
	var ret=JSON.parse(sdata);
	if(!ret.nds){ret.nds=[];}
	if(!ret.es){ret.es=[];}
	//if(!ret.m_depends){ret.m_depends=[];}
	ret.__proto__=graph_prototype;
	return ret;
};

var PointDist=function(a,b){
	var dx=(a.x-b.x);
	var dy=(a.y-b.y);
	return Math.sqrt(dx*dx+dy*dy);
};
var OpenNodeEditorTab=function(obj,fn,nd){
	var edtab=UI.OpenEditorWindow(fn,function(){
		this.owner.m_graphview_ref=obj;
		this.owner.m_graphview_ndref=nd;
		this.owner.m_graphview_stickers=undefined;
	});
	edtab.area_name='v_tools';
}

var rproto_node={
	OnMouseDown:function(event){
		UI.SetFocus(this.owner);
		///////////////////////////
		this.m_drag_ctx={x:event.x,y:event.y, base_x:this.nd.x,base_y:this.nd.y};
		if(this.nd.m_is_selected){
			var mnds=[];
			this.m_drag_ctx.move_nodes=mnds;
			var nds=this.graph.nds;
			for(var i=0;i<nds.length;i++){
				if(nds[i].m_is_selected){
					mnds.push({nd:nds[i],base_x:nds[i].x,base_y:nds[i].y})
				}
			}
		}
		UI.CaptureMouse(this);
		UI.Refresh();
	},
	OnMouseMove:function(event){
		if(!this.m_drag_ctx){return;}
		var delta_x=(event.x-this.m_drag_ctx.x);
		var delta_y=(event.y-this.m_drag_ctx.y);
		if(this.m_drag_ctx.move_nodes){
			var mnds=this.m_drag_ctx.move_nodes;
			for(var i=0;i<mnds.length;i++){
				mnds[i].nd.x=mnds[i].base_x+ delta_x;
				mnds[i].nd.y=mnds[i].base_y+ delta_y;
			}
		}else{
			var ndi=this.nd;
			ndi.x=this.m_drag_ctx.base_x+ delta_x;
			ndi.y=this.m_drag_ctx.base_y+ delta_y;
		}
		UI.Refresh();
	},
	OnMouseUp:function(event){
		this.OnMouseMove(event);
		if(this.m_drag_ctx){
			this.m_drag_distance=PointDist(event,this.m_drag_ctx);
			if((this.m_drag_distance||0)>8){
				//move would necessitate rebuild - potential order change
				this.owner.graph.SignalEdit([this.nd]);
			}else{
				//if it didn't move, set selection
				if(!(UI.IsPressed("LSHIFT")||UI.IsPressed("RSHIFT")||UI.IsPressed("LCTRL")||UI.IsPressed("RCTRL"))){
					this.graph.SelectionClear();
				}
				this.nd.m_is_selected=!this.nd.m_is_selected;
				UI.Refresh();
			}
		}
		this.m_drag_ctx=undefined;
		UI.ReleaseMouse(this);
	},
	OnClick:function(event){
		if((this.m_drag_distance||0)>8){return;}
		if(event.clicks>=2){
			//rename case
			if(isGroup(this.nd)||this.nd.m_class!='__dot__'){
				var style=UI.default_styles.graph_view.node_style;
				var h_caption=style.caption_h;
				if(this.nd.m_caption.indexOf(': ')>=0){
					h_caption+=style.caption_h_desc;
				}
				if(event.y-this.y<h_caption+style.caption_padding){
					//node renaming
					this.owner.RenameNode(this.nd)
					return;
				}
			}
			//edit the node file - put fn in parser
			if(isGroup(this.nd)){
				var obj=this.owner;
				var ret=Ungroup(obj.graph.nds,obj.graph.es, [this.nd],0);
				obj.graph.nds=ret[0];
				obj.graph.es=ret[1];
				obj.graph.SignalEdit(ret[2]);
				UI.Refresh();
				return;
			}
			var ndcls=UI.GetNodeClass(this.owner.cache,this.nd);
			if(ndcls){
				OpenNodeEditorTab(this.owner,ndcls.m_file_name,this.nd);
			}
		}
	},
};
var rproto_port={
	//tentative edge system - temp UI
	OnMouseDown:function(event){
		//the initial position shouldn't matter
		UI.SetFocus(this.owner);UI.Refresh();
		this.m_drag_ctx=1;
		this.owner.m_temp_ui="edge";
		this.owner.m_temp_ui_desc={};
		this.owner.m_temp_ui_desc.v0={x:this.x-this.dx+this.pdx,y:this.y-this.dy+this.pdy,region:this};
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.m_drag_ctx){return;}
		//starting port info... this
		//ending port info: event - find nearest port
		var proxies=this.owner.m_proxy_ports;
		var best_dist2=this.owner.edge_style.snapping_distance;
		best_dist2*=best_dist2;
		var best_i=undefined;
		for(var i=0;i<proxies.length;i++){
			var dx=event.x-proxies[i].x;
			var dy=event.y-proxies[i].y;
			var dist2=dx*dx+dy*dy;
			if(best_dist2>dist2&&proxies[i].region.dir!=this.dir){
				best_dist2=dist2;
				best_i=i;
			}
		}
		this.owner.m_temp_ui_desc.v1={x:event.x,y:event.y,region:undefined};
		if(best_i!=undefined){
			if(proxies[best_i].region==this){
				this.owner.m_temp_ui_desc.v1=undefined;
			}else{
				this.owner.m_temp_ui_desc.v1=proxies[best_i];
			}
		}
		UI.Refresh()
	},
	OnMouseUp:function(event){
		this.OnMouseMove(event);
		var v0=this.owner.m_temp_ui_desc.v0;
		var v1=this.owner.m_temp_ui_desc.v1;
		this.owner.m_temp_ui=undefined;
		this.owner.m_temp_ui_desc=undefined;
		this.m_drag_ctx=undefined;
		if(v1){
			if(v1.region){
				//create edge
				if(v0.region.dir=='input'){
					//all edges should be output -> input
					var tmp=v0;v0=v1;v1=tmp;
				}
				this.owner.graph.es.push({
					id0:v0.region.nd.__id__, port0:v0.region.port,
					id1:v1.region.nd.__id__, port1:v1.region.port,
				})
				this.owner.graph.SignalEdit([v1.region.nd]);
			}else{
				//self-click, rename
				this.owner.m_temp_ui="rename_port";
				this.owner.m_temp_ui_desc={region:this};
			}
		}
		UI.ReleaseMouse(this);
	},
	OnRender:function(){
		//maintain port list
		this.owner.m_proxy_ports.push({x:this.x-this.dx+this.pdx,y:this.y-this.dy+this.pdy,region:this})
	},
};

UI.CreateGraph=function(){
	var ret={
		nds:[],
		es:[],
		//m_depends:[],
	};
	ret.__proto__=graph_prototype;
	return ret;
};

UI.GetNodeCache=function(cache,ndi){
	var cache_item=cache.nds[ndi.__id__];
	if(cache_item){return cache_item;}
	cache_item={};
	cache.nds[ndi.__id__]=cache_item;
	//compatibility checks
	if(!ndi.m_ui_values){
		ndi.m_ui_values={};
	}
	//get the node's class
	var ndcls=UI.GetNodeClass(cache,ndi);
	//var is_invalid_class=0;
	if(!ndcls){
		//assume empty class when rendering before it's loaded, do not cache the result
		cache[ndi.__id__]=undefined;
		ndcls={m_ports:[]};
		//is_invalid_class=1;
	}
	var style=UI.default_styles.graph_view.node_style;
	var wr=style.port_w_min,wl=style.port_w_min, nr=0,nl=0;
	for(var i=0;i<ndcls.m_ports.length;i++){
		var port_i=ndcls.m_ports[i];
		var name=(ndi.m_renamed_ports[port_i.id]||port_i.id);
		var side=(port_i.dir=="input"?"R":"L");
		var dims=UI.MeasureText(style.font_port,name);
		var w_port=dims.w+style.port_padding*2;
		if(side=="R"){
			if(port_i.ui){
				w_port+=style.port_w_ui_min;
			}
			wr=Math.max(wr,w_port);
			nr++;
		}else{
			wl=Math.max(wl,w_port);
			nl++;
		}
	}
	var s_caption=(ndi.m_caption||ndi.__id__);
	var s_desc='';
	var pcolon=s_caption.indexOf(': ');
	if(pcolon>=0){
		s_desc=s_caption.substr(pcolon+2);
		s_caption=s_caption.substr(0,pcolon);
	}
	var dims=UI.MeasureText(style.font_caption,s_caption);
	var h_caption=style.caption_h;
	var h_desc=style.caption_h_desc;
	var is_dot=0;
	if(!isGroup(ndi)&&ndi.m_class=='__dot__'){
		wl=style.port_padding*2;
		wr=style.port_padding*2;
		dims.w=0;
		dims.h=0;
		h_caption=0;
		is_dot=1;
	}
	if(s_desc){
		dims.w=Math.max(dims.w,UI.MeasureText(style.font_desc,s_desc).w);
	}else{
		h_desc=0;
	}
	var w_final=Math.max(dims.w+style.caption_padding*2, (wl-style.port_extrude)+(wr-style.port_extrude)+style.port_w_sep);
	var h_final=h_caption+h_desc+Math.max(nl,nr)*(style.port_h+style.port_h_sep)+style.port_h_sep;
	cache_item.m_rects=[];
	cache_item.m_texts=[];
	cache_item.m_regions=[];
	cache_item.m_param_widgets=[];
	//cache_item.m_param_panel=[];
	cache_item.m_w=w_final;
	cache_item.m_h=h_final;
	//cache_item.m_rects.push({
	//	dx:-style.shadow_size,dy:-style.shadow_size,
	//	w:w_final+style.shadow_size*2,h:h_final+style.shadow_size*2,
	//	round:style.shadow_size*1.5,
	//	border_width:-style.shadow_size*1.5,
	//	color:style.shadow_color,
	//});
	var color_node=style.node_color_default;
	if(ndcls.m_file_name&&ndi.m_class!='__dot__'){
		if(UI.GetPathFromFilename(ndcls.m_file_name)==cache.m_file_dir){
			color_node=style.node_color_private;
		}else{
			color_node=style.node_color_pack_priv;
		}
	}
	cache_item.m_rects.push({
		dx:0,dy:0,
		w:w_final,h:h_final,
		round:style.node_round,
		color:color_node,
		border_color:style.node_border_color,
		border_width:style.node_border_width,
	});
	cache_item.m_regions.push({
		dx:0,dy:0,
		w:w_final,h:h_final,
		name:[ndi.__id__,'node'].join('_'),
		nd:ndi,
		proto:rproto_node,
	})
	var y_caption=0;
	cache_item.m_texts.push({
		dx:style.caption_padding,dy:(h_caption-UI.GetCharacterHeight(style.font_caption))*0.5,
		font:style.font_caption,text:s_caption,color:style.caption_text_color
	});
	y_caption+=h_caption;
	if(s_desc){
		//render node description
		cache_item.m_texts.push({
			dx:style.caption_padding,dy:y_caption+(h_desc-UI.GetCharacterHeight(style.font_desc))*0.5,
			font:style.font_desc,text:s_desc,color:style.caption_desc_color
		});
		y_caption+=h_desc;
	}
	//multi-connect case - use node y for ordering with edge dragging
	//if one really needs it, one could use helper boards
	//generate editor UI
	//todo: inline UI
	var degs_ndi=cache.m_degs[ndi.__id__];
	var xl=-style.port_extrude,xr=w_final+style.port_extrude-wr,
		pxl=-0.5*style.port_extrude,pxr=w_final+0.5*style.port_extrude,
		yl=y_caption,yr=y_caption,
		dyl=(h_final-yl-style.port_h*nl)/(nl+1),
		dyr=(h_final-yr-style.port_h*nr)/(nr+1);
	var port_padding_y=(style.port_h-UI.GetCharacterHeight(style.font_port))*0.5;
	var endpoints={};
	cache_item.m_endpoints=endpoints;
	for(var i=0;i<ndcls.m_ports.length;i++){
		var port_i=ndcls.m_ports[i];
		var name=(ndi.m_renamed_ports[port_i.id]||port_i.id);
		var side=((port_i.dir=="input"?"R":"L"));
		var port_color;
		if(port_i.ui){
			port_color=UI.default_styles.graph_view.node_style.port_color_ui;
		}else if(port_i.type&&port_i.type.length>0&&port_i.type[port_i.type.length-1]=='string'){
			port_color=UI.default_styles.graph_view.node_style.port_color_string;
		}else if(port_i.type&&port_i.type.length>1&&port_i.type[port_i.type.length-2]=='variable'){
			port_color=UI.default_styles.graph_view.node_style.port_color_var;
		}else{
			port_color=UI.default_styles.graph_view.node_style.port_color;
		}
		var dims=UI.MeasureText(style.font_port,is_dot?'':name);
		if(side=="R"){
			yr+=dyr;
			if(port_i.ui&&(!degs_ndi||!degs_ndi[port_i.id])){
				//generate node UI for non-connected port
				//cache_item.m_param_panel.push({nd:ndi, name:name, port:port_i.id, port_ref:port_i, ui:port_i.ui});
				cache_item.m_param_widgets.push({
					dx:xl+wl+4,dy:yr,
					w:xr+wr-(dims.w+style.port_padding*2)-(xl+wl)-8,
					h:style.port_h,
					nd:ndi, name:name, port_ref:port_i});
			}
			cache_item.m_rects.push({
				dx:xr+wr-(dims.w+style.port_padding*2),dy:yr,
				w:(dims.w+style.port_padding*2),h:style.port_h,
				round:style.port_round,
				color:port_color,
				port_ref:port_i,
			});
			cache_item.m_regions.push({
				dx:xr+wr-(dims.w+style.port_padding*2),dy:yr,
				w:(dims.w+style.port_padding*2),h:style.port_h,
				name:[ndi.__id__,'port',port_i.id].join('_'),
				nd:ndi,port:port_i.id,dir:port_i.dir,
				pdx:pxr,pdy:yr+style.port_h*0.5,
				color:port_color,
				port_ref:port_i,
				proto:rproto_port,
			})
			endpoints[name]={dx:xr+wr,dy:yr+style.port_h*0.5};
			cache_item.m_texts.push({
				dx:xr+wr-(dims.w+style.port_padding*2)+style.port_padding,dy:yr+port_padding_y,
				font:style.font_port,text:name,color:style.port_text_color,
				port_ref:port_i,
			});
			yr+=style.port_h;
		}else{
			yl+=dyl;
			cache_item.m_rects.push({
				dx:xl,dy:yl,
				w:(dims.w+style.port_padding*2),h:style.port_h,
				round:style.port_round,
				color:port_color,
				port_ref:port_i,
			});
			cache_item.m_regions.push({
				dx:xl,dy:yl,
				w:(dims.w+style.port_padding*2),h:style.port_h,
				name:[ndi.__id__,'port',port_i.id].join('_'),
				nd:ndi,port:port_i.id,dir:port_i.dir,
				pdx:pxl,pdy:yl+style.port_h*0.5,
				color:port_color,
				port_ref:port_i,
				proto:rproto_port,
			})
			endpoints[name]={dx:xl,dy:yl+style.port_h*0.5};
			cache_item.m_texts.push({
				dx:xl+style.port_padding,dy:yl+port_padding_y,
				font:style.font_port,text:name,color:style.port_text_color,
				port_ref:port_i,
			});
			yl+=style.port_h;
		}
	}
	if(!isGroup(ndi)&&ndi.m_class=='__dot__'){
		cache_item.m_texts=[];
	}
	//if(is_invalid_class){
	//	cache_item.m_param_panel.push({create_class:ndi.m_class});
	//}
	return cache_item;
};

var g_host_graph_cache={};
var LoadGroupReference=function(s_group_name,s_group_file){
	if(!s_group_file){return undefined;}
	var fn=IO.NormalizeFileName(s_group_file);
	var ret=g_host_graph_cache[fn];
	var t_file=IO.GetFileTimestamp(fn);
	if(!ret||ret.t!=t_file){
		var gr=UI.LoadGraph(fn);
		if(!gr){
			return undefined;
		}
		ret={
			groups:{},
			t:t_file,
		};
		for(var i=0;i<gr.nds.length;i++){
			var ndi=gr.nds[i];
			if(isGroup(ndi)){
				var s_caption_i=ndi.m_caption;
				var pcolon=s_caption_i.indexOf(': ');
				if(pcolon>=0){
					s_caption_i=s_caption_i.substr(0,pcolon);
				}
				ret.groups[s_caption_i]=ndi;
			}else if(ndi.m_caption[0]=='@'){
				var s_caption_i=ndi.m_caption;
				var pcolon=s_caption_i.indexOf(': ');
				if(pcolon>=0){
					s_caption_i=s_caption_i.substr(0,pcolon);
				}
				//file template - save file name in node class - simplified SearchClassFile
				ret.groups[s_caption_i]=SearchClassFileSimple(UI.GetPathFromFilename(fn)+'/'+ndi.m_class);
			}
		}
		g_host_graph_cache[fn]=ret;
	}
	return ret.groups[s_group_name];
};
var FixClonedGroupClass=function(ndcls){
	var id_map_group=FixClonedGraph(ndcls.m_graph);
	var gr_reconnects=ndcls.m_reconnects;
	for(var j=0;j<gr_reconnects.length;j++){
		var cnj=gr_reconnects[j];
		cnj.id_inner=id_map_group[cnj.id_inner];
	}
	var gr_ui_port_map=ndcls.m_ui_port_map;
	for(var j=0;j<gr_ui_port_map.length;j++){
		var cnj=gr_ui_port_map[j];
		cnj.id_inner=id_map_group[cnj.id_inner];
	}
};
var FixClonedGraph=function(gr){
	var id_map={};
	for(var i=0;i<gr.nds.length;i++){
		var ndi=gr.nds[i];
		var id_new=[g_developer.email, (new Date()).toUTCString(), g_per_run_id++].join("&");
		id_map[ndi.__id__]=id_new;
		ndi.__id__=id_new;
		if(isGroup(ndi)){
			FixClonedGroupClass(ndi.m_class);
		}
	}
	for(var i=0;i<gr.es.length;i++){
		var e=gr.es[i];
		e.id0=id_map[e.id0];
		e.id1=id_map[e.id1];
	}
	return id_map;
};

UI.CloneGraph=function(gr){
	gr=JSON.parse(JSON.stringify(gr));
	FixClonedGraph(gr);
	return gr;
}

/*
graph: persistent data
cache: transient data
*/
W.graphview_prototype={
	m_is_graph_view:1,
	//this region is outside the scale
	OnMouseDown:function(event){
		UI.SetFocus(this);
		this.m_temp_ui=undefined;
		this.m_temp_ui_desc=undefined;
		//edge selection / edge dragging
		var event_edge={
			x:event.x/this.graph.tr.scale,
			y:event.y/this.graph.tr.scale,
		}
		var best_dist2=this.edge_style.region_width;
		var best_eid=undefined;
		best_dist2*=best_dist2;
		for(var i=0;i<this.m_proxy_edges.length;i++){
			var e=this.m_proxy_edges[i];
			var x0=e.line[0];
			var y0=e.line[1];
			var x1=e.line[2];
			var y1=e.line[3];
			var Nx=y1-y0,Ny=x0-x1;
			var t=((event_edge.x-x0)*(x1-x0)+(event_edge.y-y0)*(y1-y0))/(Nx*Nx+Ny*Ny);
			var sgn_dist=((event_edge.x-x0)*Nx+(event_edge.y-y0)*Ny);
			var dist2=sgn_dist*sgn_dist/(Nx*Nx+Ny*Ny);
			if(t<0){
				dist2=PointDist(event_edge,{x:x0,y:y0});dist2*=dist2;
			}else if(t>1){
				dist2=PointDist(event_edge,{x:x1,y:y1});dist2*=dist2;
			}
			if(best_dist2>dist2){
				best_dist2=dist2;
				best_eid=e.eid;
			}
		}
		if(best_eid==undefined||event.button!=UI.SDL_BUTTON_LEFT){
			//bg dragging
			this.m_drag_ctx={mode:"translation",x:event.x,y:event.y, tr:JSON.parse(JSON.stringify(this.graph.tr))};
			if(event.button==UI.SDL_BUTTON_LEFT){
				this.m_drag_ctx.mode="selection";
			}
		}else{
			//we've got an edge
			var e=this.graph.es[best_eid];
			var pid0=-1,pid1=-1;
			for(var i=0;i<this.m_proxy_ports.length;i++){
				var region=this.m_proxy_ports[i].region;
				if(region.nd.__id__==e.id0&&region.port==e.port0){pid0=i;}
				if(region.nd.__id__==e.id1&&region.port==e.port1){pid1=i;}
			}
			if(!(pid0>=0&&pid1>=0)){
				//error out
				this.m_drag_ctx={mode:"translation",x:event.x,y:event.y, tr:JSON.parse(JSON.stringify(this.graph.tr))};
			}else{
				var pos0=this.m_proxy_ports[pid0];
				var pos1=this.m_proxy_ports[pid1];
				var side=0;
				if(PointDist(event_edge,pos0)<PointDist(event_edge,pos1)){
					side=0;
				}else{
					side=1;
				}
				//delete edge and trigger dragging on the *opposite* end
				var rg_trigger=(1-side)==0?pos0.region:pos1.region;
				this.graph.es[best_eid]=this.graph.es[this.graph.es.length-1]
				this.graph.es.pop();
				this.graph.SignalEdit([pos1.region.nd]);
				rg_trigger.OnMouseDown(event_edge)
				rg_trigger.OnMouseMove(event_edge)
				return;
			}
		}
		UI.CaptureMouse(this);
		UI.Refresh();
	},
	OnMouseMove:function(event){
		if(!this.m_drag_ctx){return;}
		if(this.m_drag_ctx.mode=='translation'){
			this.graph.tr.trans[0]=this.m_drag_ctx.tr.trans[0]+ (event.x-this.m_drag_ctx.x);
			this.graph.tr.trans[1]=this.m_drag_ctx.tr.trans[1]+ (event.y-this.m_drag_ctx.y);
		}else if(this.m_drag_ctx.mode=='selection'){
			var nds=this.graph.nds;
			var cache=this.cache;
			var x0=(Math.min(this.m_drag_ctx.x, event.x)-this.x)/this.graph.tr.scale;
			var y0=(Math.min(this.m_drag_ctx.y, event.y)-this.y)/this.graph.tr.scale;
			var x1=(Math.max(this.m_drag_ctx.x, event.x)-this.x)/this.graph.tr.scale;
			var y1=(Math.max(this.m_drag_ctx.y, event.y)-this.y)/this.graph.tr.scale;
			this.m_drag_ctx.m_sel_rect=[x0,y0,x1,y1];
			for(var i=0;i<nds.length;i++){
				var ndi=nds[i];
				var cache_item=UI.GetNodeCache(cache,ndi);
				var ndi_x0=cache_item.m_rects[0].x;
				var ndi_y0=cache_item.m_rects[0].y;
				var ndi_x1=cache_item.m_rects[0].x+cache_item.m_rects[0].w;
				var ndi_y1=cache_item.m_rects[0].y+cache_item.m_rects[0].h;
				if(x0<=ndi_x0&&ndi_x1<=x1&&y0<=ndi_y0&&ndi_y1<=y1){
					ndi.m_is_selected=1;
				}else{
					ndi.m_is_selected=0;
				}
			}
		}
		UI.Refresh();
	},
	OnMouseUp:function(event){
		if(!this.m_drag_ctx){return;}
		this.OnMouseMove(event);
		this.m_drag_ctx=undefined;
		UI.ReleaseMouse(this);
	},
	OnMouseWheel:function(event){
		var mx_world=((UI.m_absolute_mouse_position.x-this.x_real)-this.graph.tr.trans[0])/this.graph.tr.scale;
		var my_world=((UI.m_absolute_mouse_position.y-this.y_real)-this.graph.tr.trans[1])/this.graph.tr.scale;
		var log_scale=Math.log(this.graph.tr.scale);
		log_scale+=event.y*0.1;
		this.graph.tr.scale=(Math.exp(log_scale)||1);
		this.graph.tr.trans[0]=(UI.m_absolute_mouse_position.x-this.x_real)-mx_world*this.graph.tr.scale;
		this.graph.tr.trans[1]=(UI.m_absolute_mouse_position.y-this.y_real)-my_world*this.graph.tr.scale;
		if(this.m_drag_ctx){
			this.m_drag_ctx={x:event.x,y:event.y, tr:JSON.parse(JSON.stringify(this.graph.tr))};
		}
		UI.Refresh();
	},
	OnKeyDown:function(event){
		if(this.m_drag_ctx){return;}
		var IsHotkey=UI.IsHotkey;
		if(0){
		}else if(IsHotkey(event,"TAB")){
			//tab: temp UI
			if(!this.m_temp_ui){
				this.m_temp_ui="add_node";
				this.m_temp_ui_desc={x:UI.m_absolute_mouse_position.x-this.x_real,y:UI.m_absolute_mouse_position.y-this.y_real};
			}
			UI.Refresh()
		}else if(IsHotkey(event,"DELETE")){
			//delete selection
			this.graph.DeleteSelection();
			UI.Refresh();
		}
	},
	Save:function(){
		this.graph.Save(this.m_file_name);
		this.m_saved_point=(this.cache&&this.cache.m_undo_queue.length||0);
		UI.BumpHistory(this.m_file_name)
	},
	NeedSave:function(){
		return this.m_saved_point!=(this.cache&&this.cache.m_undo_queue.length||0);
	},
	SaveMetaData:function(){
		//nothing - all metadata are saved in the main file for now
	},
	Reload:function(){
		//todo
	},
	/////////////////////
	OnGraphChange:function(nds_rebuild){
		this.cache.m_undo_queue.push(JSON.stringify(this.graph));
		//clear node cache
		for(var i=0;i<nds_rebuild.length;i++){
			this.cache.nds[nds_rebuild[i].__id__]=undefined;
		}
	},
	Undo:function(){
		var uq=this.cache.m_undo_queue;
		if(uq.length>=2){
			this.cache.m_redo_queue.push(uq.pop());
			var bk=this.graph.OnChange;
			this.graph=JSON.parse(uq[uq.length-1]);
			this.graph.__proto__=graph_prototype;
			this.graph.OnChange=bk;
			this.cache.nds={};
			return 1;
		}else{
			return 0;
		}
	},
	Redo:function(){
		var uq=this.cache.m_undo_queue;
		var rq=this.cache.m_redo_queue;
		if(rq.length>=1){
			uq.push(rq.pop());
			var bk=this.graph.OnChange;
			this.graph=JSON.parse(uq[uq.length-1]);
			this.graph.__proto__=graph_prototype;
			this.graph.OnChange=bk;
			this.cache.nds={};
			return 1;
		}else{
			return 0;
		}
	},
	Group:function(){
		//convert selected nodes into a sub-graph, store it to a file, then put the file back here
		var cache=this.cache;
		var nds=this.graph.nds;
		var es=this.graph.es;
		var gr=UI.CreateGraph();
		var gr_nds=gr.nds;
		var gr_es=gr.es;
		var gr_reconnects=[];
		var gr_ports=[];
		var gr_ui_port_map=[];
		var gr_ui_values={};
		var dot_cache={};
		var port_name_map={};
		var CreateDot=function(nd,port,side){
			var skey=nd.__id__+'='+port;
			var nd_dot=dot_cache[skey];
			if(nd_dot){return nd_dot;}
			//create an outer port
			var ndcls=UI.GetNodeClass(cache,nd);
			var port_inner=ndcls.m_port_map[port];
			if(!port_inner){
				return undefined;
			}
			nd_dot=gr.CreateNode('__dot__');
			nd_dot.m_is_group_dot=1;
			dot_cache[skey]=nd_dot;
			if(side=='in'){
				gr_es.push({
					id0:nd.__id__,port0:port,
					id1:nd_dot.__id__,port1:"in",
				});
			}else{
				gr_es.push({
					id0:nd_dot.__id__,port0:"out",
					id1:nd.__id__,port1:port,
				});
			}
			//console.log(JSON.stringify(ndcls.m_port_map),port)
			var port_outer=JSON.parse(JSON.stringify(port_inner));
			var cnt=0;
			while(port_name_map[port_outer.id]){
				cnt++;
				port_outer.id=port_inner.id+cnt.toString();
			}
			port_name_map[port_outer.id]=1;
			gr_ports.push(port_outer);
			port_outer.m_sort_y=nd.y+port_inner.m_sort_y;
			if(port_inner.ui){
				gr_ui_port_map.push({id_inner:nd.__id__,port_inner:port_inner.id,port_outer:port_outer.id});
			}
			nd_dot.m_port_outer_id=port_outer.id
			gr_ui_values[port_outer.id]=nd.m_ui_values[port];
			return nd_dot;
		};
		///////////////////
		//build the boring data structures
		var n=nds.length,m=es.length;
		var node_map={};
		var group_name=undefined;
		for(var i=0;i<n;i++){
			node_map[nds[i].__id__]=i;
			if(nds[i].m_is_selected){
				gr_nds.push(nds[i]);
				if(!group_name){
					group_name=nds[i].m_last_group_name;
				}
			}
		}
		if(!group_name){
			group_name='group';
		}
		//translate relevant ports and pick the group nodes
		//the connected-to-outside ports
		for(var i=0;i<m;i++){
			var e=es[i];
			var v0=node_map[e.id0];
			var v1=node_map[e.id1];
			if(nds[v0].m_is_selected){
				if(nds[v1].m_is_selected){
					//internal edge, just add it
					gr_es.push(e);
				}else{
					//output edge: create dot, dot edge, record port
					var nd_dot=CreateDot(nds[v0],e.port0,'in');
					if(nd_dot){
						gr_reconnects.push({
							//id0:nd_dot.__id__,port0:"out",
							id1:e.id1,port1:e.port1,
							port_outer:nd_dot.m_port_outer_id,
							id_inner:nd_dot.__id__,
						})
					}
				}
			}else{
				if(nds[v1].m_is_selected){
					//input edge: create dot, dot edge, record port
					var nd_dot=CreateDot(nds[v1],e.port1,'out');
					if(nd_dot){
						gr_reconnects.push({
							id0:e.id0,port0:e.port0,
							//id1:nd_dot.__id__,port1:"in",
							port_outer:nd_dot.m_port_outer_id,
							id_inner:nd_dot.__id__,
						})
					}
				}else{
					//unrelated edge
					//do nothing
				}
			}
		}
		//find the dangling ports
		var has_internal_edge={};
		for(var i=0;i<gr_es.length;i++){
			has_internal_edge[gr_es[i].id0+'='+gr_es[i].port0]=1;
			has_internal_edge[gr_es[i].id1+'='+gr_es[i].port1]=1;
		}
		for(var i=0;i<n;i++){
			if(nds[i].m_is_selected){
				var ndclsi=UI.GetNodeClass(cache,nds[i]);
				var id_ndi=nds[i].__id__;
				for(var pi=0;pi<ndclsi.m_ports.length;pi++){
					var port_i=ndclsi.m_ports[pi];
					if(!has_internal_edge[id_ndi+'='+port_i.id]){
						CreateDot(nds[i],port_i.id,port_i.dir=='input'?'out':'in');
					}
				}
			}
		}
		gr_ports.sort(function(a,b){return a.m_sort_y-b.m_sort_y});
		//build the group class
		var ndcls={
			m_graph:gr,
			m_reconnects:gr_reconnects,
			m_ports:gr_ports,
			m_ui_port_map:gr_ui_port_map,
		};
		ndcls.m_port_map={};
		for(var i=0;i<ndcls.m_ports.length;i++){
			var port_i=ndcls.m_ports[i];
			port_i.m_sort_y=i;
			ndcls.m_port_map[port_i.id]=port_i;
		}
		var nd_group=this.graph.CreateNode('group');
		nd_group.m_caption=group_name;
		nd_group.m_class=ndcls;
		nd_group.m_ui_values=gr_ui_values;
		var xtot=0,ytot=0,npt=0;
		for(var i=0;i<gr_nds.length;i++){
			var nd_i=gr_nds[i];
			if(nd_i.x!=undefined&&nd_i.y!=undefined){
				xtot+=nd_i.x;
				ytot+=nd_i.y;
				npt++;
			}
		}
		npt=Math.max(npt,1);
		nd_group.x=xtot/npt;
		nd_group.y=ytot/npt;
		var x0=nd_group.x;
		var y0=nd_group.y;
		for(var i=0;i<gr_nds.length;i++){
			var nd_i=gr_nds[i];
			if(nd_i.x!=undefined&&nd_i.y!=undefined){
				nd_i.x-=x0;
				nd_i.y-=y0;
				nd_i.m_group_dx=nd_i.x;
				nd_i.m_group_dy=nd_i.y;
			}
			nd_i.m_group_package_dir=nd_i.m_package_dir;
			nd_i.m_group_is_disabled=nd_i.m_is_disabled;
		}
		//var nd_rebuilds=[nd_group];
		for(var i=0;i<gr_reconnects.length;i++){
			var cni=gr_reconnects[i];
			if(cni.id0){
				es.push({
					id0:cni.id0,port0:cni.port0,
					id1:nd_group.__id__,port1:cni.port_outer,
				})
				cni.id0=undefined;cni.port0=undefined;
			}else{
				es.push({
					id0:nd_group.__id__,port0:cni.port_outer,
					id1:cni.id1,port1:cni.port1,
				})
				cni.id1=undefined;cni.port1=undefined;
				//nd_rebuilds.push(nds[node_map[cni.id1]]);
			}
		}
		this.graph.DeleteSelection(1);
		nd_group.m_is_selected=1;
		//this.graph.SignalEdit(nd_rebuilds)
		this.graph.SignalEdit([nd_group])
		UI.Refresh();
	},
	RenameNode:function(nd){
		this.m_temp_ui="rename_node";
		this.m_temp_ui_desc={nd:nd};
		UI.Refresh();
	},
	Copy:function(){
		var nds=this.graph.nds;
		var es=this.graph.es;
		var gr=UI.CreateGraph();
		var sel_map={};
		for(var i=0;i<nds.length;i++){
			if(nds[i].m_is_selected){
				gr.nds.push(nds[i]);
				sel_map[nds[i].__id__]=1;
			}
		}
		for(var i=0;i<es.length;i++){
			if(sel_map[es[i].id0]&&sel_map[es[i].id1]){
				gr.es.push(es[i]);
			}
		}
		UI.SDL_SetClipboardText(JSON.stringify(gr));
	},
	Paste:function(){
		var gr=undefined;
		try{
			gr=JSON.parse(UI.SDL_GetClipboardText());
			var is_pasted={};
			for(var i=0;i<gr.nds.length;i++){
				is_pasted[gr.nds[i].__id__]=1;
			}
			var id_map=FixClonedGraph(gr);
			//if it's same-graph copy-paste, try to dup the external edges
			var es=this.graph.es;
			var m0=es.length;
			//we're *adding edges* in the loop, and we shouldn't process those added edges
			for(var i=0;i<m0;i++){
				var e=es[i];
				if(is_pasted[e.id0]&&!is_pasted[e.id1]){
					es.push({
						id0:id_map[e.id0],port0:e.port0,
						id1:e.id1,port1:e.port1,
					})
				}else if(!is_pasted[e.id0]&&is_pasted[e.id1]){
					es.push({
						id0:e.id0,port0:e.port0,
						id1:id_map[e.id1],port1:e.port1,
					})
				}
			}
		}catch(e){
			console.log(e.stack);
			return;
		}
		this.graph.SelectionClear();
		Array.prototype.push.apply(this.graph.nds,gr.nds);
		Array.prototype.push.apply(this.graph.es,gr.es);
		this.graph.SignalEdit(gr.nds)
		return gr;
	},
	InsertDot:function(){
		var graph=this.graph;
		var nd_dot=graph.CreateNode('__dot__');
		nd_dot.x=(UI.m_absolute_mouse_position.x-this.x_real-graph.tr.trans[0])/graph.tr.scale;
		nd_dot.y=(UI.m_absolute_mouse_position.y-this.y_real-graph.tr.trans[1])/graph.tr.scale;
		var nd_sel=graph.nds.filter(function(ndi){
			return ndi.m_is_selected;
		});
		if(nd_sel.length==2){
			var id0=nd_sel[0].__id__;
			var id1=nd_sel[1].__id__;
			for(var i=0;i<graph.es.length;i++){
				var e=graph.es[i];
				if(e.id0==id0&&e.id1==id1||e.id0==id1&&e.id1==id0){
					graph.es[i]={id0:e.id0,port0:e.port0, id1:nd_dot.__id__,port1:'in'},
					graph.es.push({id0:nd_dot.__id__,port0:'out', id1:e.id1,port1:e.port1});
					break;
				}
			}
		}
		graph.SignalEdit([]);
		UI.Refresh();
	},
	Build:function(is_rebuild){
		var nds=this.graph.nds;
		var nd_metadata=undefined;
		for(var i=0;i<nds.length;i++){
			if(nds[i].m_caption=='metadata'){
				nd_metadata=nds[i];
				break;
			}
		}
		var s_build_dir_name=(nd_metadata&&nd_metadata['build_dir']||'build');
		var cache=this.cache;
		var sbasepath=UI.GetPathFromFilename(this.m_file_name)+'/..'+(s_build_dir_name?'/'+s_build_dir_name:'');
		IO.CreateDirectory(sbasepath);
		var graph=this.graph;
		graph.m_generated_files=[];
		IO.m_generated_files=graph.m_generated_files;
		this.graph.Build(sbasepath,cache,is_rebuild);
		IO.m_generated_files=undefined;
		////////////////////////////////
		//process the generated file list
		graph.m_presync_status={};
		for(var i=0;i<graph.m_generated_files.length;i++){
			var fn=graph.m_generated_files[i];
			fn=IO.NormalizeFileName(fn);
			graph.m_presync_status[fn]={tstamp:IO.GetFileTimestamp(fn),sha1:UI.GetFileDigest(fn)};
			graph.m_generated_files[i]=fn;
		}
	},
	QuickPreview:function(id){
		var graph=this.graph;
		var re_caption=new RegExp("view "+id.toString()+".*","i");
		var is_view={};
		graph.nds.filter(function(ndi){
			return ndi.m_caption.match(/view [0-9].*/i);
		}).forEach(function(ndi){
			is_view[ndi.__id__]=1;
		});
		var nd_views=graph.nds.filter(function(ndi){
			return ndi.m_caption.match(re_caption);
		});
		if(!(nd_views.length>0)){
			return;
		}
		var nd_view=nd_views[0];
		////////
		var nd_sels=graph.nds.filter(function(ndi){
			return ndi.m_is_selected;
		});
		if(!(nd_sels.length>0)){
			return;
		}
		var nd_sel=nd_sels[0];
		////////
		//port matching
		var ndcls_view=UI.GetNodeClass(this.cache,nd_view);
		var port1=undefined;
		var type_ref=undefined;
		for(var pi=0;pi<ndcls_view.m_ports.length;pi++){
			var port_pi=ndcls_view.m_ports[pi];
			if(port_pi.dir=='input'){
				if(nd_view.m_ui_values[port_pi.id]){
					continue;
				}
				port1=port_pi.id;
				if(port_pi.type&&port_pi.type.length>0){
					type_ref=port_pi.type[0];
				}
				break;
			}
		}
		var port0=undefined;
		var tidx_min=undefined;
		var ndcls_sel=UI.GetNodeClass(this.cache,nd_sel);
		for(var pi=0;pi<ndcls_sel.m_ports.length;pi++){
			var tidx_pi=undefined;
			var port_pi=ndcls_sel.m_ports[pi];
			if(port_pi.dir=='output'){
				var tidx_pi=9999;
				if(port_pi.type&&type_ref){
					tidx_pi=port_pi.type.indexOf(type_ref);
				}
				if(tidx_min==undefined||tidx_min>tidx_pi){
					tidx_min=tidx_pi;
					port0=port_pi.id;
				}
			}
		}
		////////
		graph.es=graph.es.filter(function(edgei){
			return !(edgei.id1==nd_view.__id__||(edgei.id0==nd_sel.__id__&&is_view[edgei.id1]));
		})
		graph.es.push({
			id0:nd_sel.__id__,port0:port0,
			id1:nd_view.__id__,port1:port1,
		})
		graph.SignalEdit([nd_view]);
		this.Build(0);
		UI.Refresh();
	},
	GetStickerMap:function(){
		//per-in-port sticker listing
		var graph=this.graph;
		var cache=this.cache;
		//if(cache.m_sticker_map){
		//	return cache.m_sticker_map;
		//}
		//cache.m_sticker_map={};
		var sticker_map0={};
		for(var i=0;i<graph.nds.length;i++){
			var ndi=graph.nds[i];
			var ndcls=UI.GetNodeClass(cache,ndi);
			if(!ndcls){continue;}
			for(var j=0;j<ndcls.m_ports.length;j++){
				if(!ndcls.m_ports[j].stickers){continue;}
				if(ndcls.m_ports[j].dir!='input'){continue;}
				var skey=ndi.__id__+'='+ndcls.m_ports[j].id;
				sticker_map0[skey]=ndcls.m_ports[j].stickers;
			}
		}
		var sticker_map={};
		for(var i=0;i<graph.es.length;i++){
			var e=graph.es[i];
			var stickers_i=sticker_map0[e.id1+'='+e.port1];
			if(stickers_i){
				if(!sticker_map[e.id0]){
					sticker_map[e.id0]=[];
				}
				sticker_map[e.id0]=sticker_map[e.id0].concat(stickers_i);
			}
		}
		return sticker_map;
	},
	SyncFromFinalCode:function(fn){
		var sync_jobs=[];
		try{
			sync_jobs=UI.ParseSyncTags(fn);
		}catch(e){
			console.log(e.stack);
			return 0;
		}
		if(!sync_jobs){
			return 0;
		}
		var cache=this.cache;
		var nds=this.graph.nds;
		var node_map={};
		var dfs=function(ndi){
			if(isGroup(ndi)){
				var ndcls=UI.GetNodeClass(cache,ndi);
				if(ndcls&&ndcls.m_graph){
					var nds=ndcls&&ndcls.m_graph.nds;
					for(var i=0;i<nds.length;i++){
						dfs(nds[i]);
					}
				}
			}else{
				node_map[ndi.__id__]=ndi;
			}
		};
		for(var i=0;i<nds.length;i++){
			dfs(nds[i]);
		}
		for(var i=0;i<sync_jobs.length;i++){
			var job_i=sync_jobs[i];
			var ndi=node_map[job_i.m_id];
			if(!ndi){
				continue;
			}
			var ndcls=UI.GetNodeClass(cache,ndi);
			if(!ndcls){
				continue;
			}
			var fn_i=ndcls.m_file_name;
			//coulddo: in case *both sides* have changes...
			//recreate the file in port order, then create a diff
			var port2code={};
			for(var j=0;j<job_i.m_port_jobs.length;j+=2){
				var sport=job_i.m_port_jobs[j];
				var scode=job_i.m_port_jobs[j+1];
				if(port2code[sport]&&port2code[sport]!=scode){
					//todo: give a notification after opening the window, choose the version that *doesn't match the original* ... in native
					console.log(['ambiguous code for port "',sport,'" of class "',ndi.m_class,'"'].join(''))
				}
				port2code[sport]=scode;
			}
			///////////////////////
			//open the editor window
			var edtab=UI.OpenEditorWindow(fn_i,(function(obj,ndi,port2code){
				return function(){
					this.owner.m_graphview_ref=obj;
					this.owner.m_graphview_ndref=ndi;
					this.owner.m_graphview_stickers=undefined;
					///////////////////
					UI.SyncOneFile(this.ed,port2code);
				}
			})(this,ndi,port2code),"quiet");
			edtab.area_name='v_tools';
			//make sure we create the doc immediately
			var bk_parent=UI.context_parent;
			UI.m_is_temp_mock_render=1;
			UI.context_parent={x:0,y:0,w:1920,h:1080,__children:[]};
			edtab.body()
			UI.context_parent=bk_parent;
			UI.m_is_temp_mock_render=undefined;
		}
		return 1;
	},
	CheckSyncableFile:function(fn){
		var graph=this.graph;
		if(!graph.m_presync_status){return;}
		var status_old=graph.m_presync_status[fn];
		if(!status_old){return;}
		var tstamp_new=IO.GetFileTimestamp(fn);
		if(status_old.tstamp==tstamp_new){return;}
		var hash_new=UI.GetFileDigest(fn);
		if(status_old.sha1==hash_new){return;}
		graph.m_presync_status[fn]={tstamp:tstamp_new,sha1:hash_new};
		this.SyncFromFinalCode(fn);
	},
	CheckAllSyncableFiles:function(){
		var fs=this.graph.m_generated_files;
		if(!fs){return;}
		for(var i=0;i<fs.length;i++){
			this.CheckSyncableFile(fs[i]);
		}
	},
};
W.GraphView=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"graph_view",W.graphview_prototype);
	var graph=obj.graph;
	var cache=obj.cache;
	if(!cache){
		var s_file_dir=UI.GetPathFromFilename(obj.m_file_name);
		cache={
			nds:{},
			m_classes_by_name:{},
			m_undo_queue:[JSON.stringify(graph)],
			m_redo_queue:[],
			m_local_packages:{},
			m_file_dir:s_file_dir,
			search_paths:[UI.m_node_dir,s_file_dir],
		};
		obj.cache=cache;
		obj.m_saved_point=1;
		obj.graph.OnChange=obj.OnGraphChange.bind(obj);
	}
	//test code-editor-saved class files
	if(cache.m_tested_save_time!=UI.g_ce_save_time){
		var classes_to_rebuild={};
		for(var sname in cache.m_classes_by_name){
			var holder=cache.m_classes_by_name[sname];
			if(holder&&holder.m_file_save_time!=(UI.g_ce_file_save_time[holder.m_file_name]||0)){
				cache.m_classes_by_name[sname]=undefined;
				cache.nds={};
				classes_to_rebuild[sname]=1;
			}
		}
		for(var i=0;i<graph.nds.length;i++){
			if(classes_to_rebuild[graph.nds[i].m_class]){
				graph.nds[i].m_need_rebuild=1;
			}
		}
		cache.m_tested_save_time=UI.g_ce_save_time;
	}
	UI.Begin(obj)
	W.PureRegion(id,obj);
	UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h,color:obj.color})
	obj.m_proxy_ports=[];
	obj.m_proxy_edges=[];
	var tr=graph.tr;
	if(tr==undefined){
		tr={};
		graph.tr=tr;
	}
	if(tr.scale==undefined){
		tr.scale=1;
	}
	if(tr.trans==undefined){
		tr.trans=[0,0];
	}
	UI.PushSubWindow(obj.x,obj.y,obj.w,obj.h,tr.scale);
	////////////
	//create connected-ness cache
	var degs_map={};
	for(var i=0;i<graph.es.length;i++){
		var e=graph.es[i];
		var degs_map_nd=degs_map[e.id0];
		if(!degs_map_nd){
			degs_map_nd={};
			degs_map[e.id0]=degs_map_nd;
		}
		degs_map_nd[e.port0]=(degs_map_nd[e.port0]||0)+1;
		///////////
		var degs_map_nd=degs_map[e.id1];
		if(!degs_map_nd){
			degs_map_nd={};
			degs_map[e.id1]=degs_map_nd;
		}
		degs_map_nd[e.port1]=(degs_map_nd[e.port1]||0)+1;
	}
	cache.m_degs=degs_map;
	////////////
	//render the nodes
	//when we're connecting, we need to grey out all but type-connectable ones, use the .port tag on renderables
	var is_connecting_edges=(obj.m_temp_ui=="edge");
	var need_ui=0;
	var port_ref_drag_v0=undefined;
	var port_ref_drag_v1=undefined;
	var type_ref_drag_v0=undefined;
	if(is_connecting_edges){
		port_ref_drag_v0=obj.m_temp_ui_desc.v0.region.port_ref;
		port_ref_drag_v1=obj.m_temp_ui_desc.v1&&obj.m_temp_ui_desc.v1.region&&obj.m_temp_ui_desc.v1.region.port_ref;
		type_ref_drag_v0=(port_ref_drag_v0&&port_ref_drag_v0.type&&port_ref_drag_v0.type[0]);
		if(!port_ref_drag_v0){
			is_connecting_edges=0;
		}
	}
	for(var ni=0;ni<graph.nds.length;ni++){
		var ndi=graph.nds[ni];
		var x=ndi.x+tr.trans[0]/tr.scale;
		var y=ndi.y+tr.trans[1]/tr.scale;
		var cache_item=UI.GetNodeCache(cache,ndi);
		for(var i=0;i<cache_item.m_rects.length;i++){
			var item_i=cache_item.m_rects[i];
			item_i.x=x+item_i.dx;
			item_i.y=y+item_i.dy;
			var is_faded=ndi.m_is_disabled;
			var fade_mask=0x55ffffff;
			if(is_connecting_edges&&!is_faded){
				is_faded=1;
				fade_mask=0x7fffffff;
				if(item_i.port_ref){
					if(item_i.port_ref==port_ref_drag_v0||item_i.port_ref==port_ref_drag_v1){
						is_faded=0;
					}else if(item_i.port_ref.dir!=port_ref_drag_v0.dir&&item_i.port_ref.type&&item_i.port_ref.type.indexOf(type_ref_drag_v0)>=0){
						is_faded=0;
					}
				}
			}
			if(i!=0&&is_faded){item_i.color&=fade_mask;}
			UI.RoundRect(item_i);
			if(i!=0){item_i.color|=0xff000000;}
			if(i==0){
				if(ndi.m_is_selected){
					//render selection
					item_i.x=x+item_i.dx;
					item_i.y=y+item_i.dy;
					UI.RoundRect({
						x:item_i.x,y:item_i.y,w:item_i.w,h:item_i.h,round:item_i.round,
						border_color:obj.node_style.node_selection_color&(is_faded?fade_mask:0xffffffff),border_width:obj.node_style.node_selection_width,
						color:0,
					});
				}
				if(ndi.m_need_rebuild&&!(!isGroup(ndi)&&ndi.m_class=='__dot__')){
					//render to-build indicator
					item_i.x=x+item_i.dx;
					item_i.y=y+item_i.dy;
					UI.RoundRect({
						x:item_i.x+item_i.round,y:item_i.y,w:item_i.w-item_i.round*2,h:obj.node_style.node_rebuild_bar_height,round:item_i.round,
						color:obj.node_style.node_selection_color&(is_faded?fade_mask:0xffffffff),
					});
				}
			}
		}
		for(var i=0;i<cache_item.m_texts.length;i++){
			var item_i=cache_item.m_texts[i];
			item_i.x=x+item_i.dx;
			item_i.y=y+item_i.dy;
			var is_faded=ndi.m_is_disabled;
			//if(is_connecting_edges&&!is_faded){
			//	is_faded=1;
			//	if(item_i.port_ref){
			//		if(item_i.port_ref==port_ref_drag_v0){
			//			is_faded=0;
			//		}else if(item_i.port_ref.dir!=port_ref_drag_v0.dir&&item_i.port_ref.type&&item_i.port_ref.type[0]==type_ref_drag_v0){
			//			is_faded=0;
			//		}
			//	}
			//}
			if(is_faded){item_i.color&=0x55ffffff;}
			W.Text('',item_i);
			item_i.color|=0xff000000;
			item_i.w=undefined;
			item_i.h=undefined;
		}
		for(var i=0;i<cache_item.m_regions.length;i++){
			var item_i=cache_item.m_regions[i];
			item_i.x=x+item_i.dx;
			item_i.y=y+item_i.dy;
			item_i.graph=graph;
			item_i.owner=obj;
			//item_i.tr=tr;
			var rg=W.Region(item_i.name,item_i,item_i.proto);
			if(rg.OnRender){
				rg.OnRender();
			}
		}
		for(var i=0;i<cache_item.m_param_widgets.length;i++){
			var item_i=cache_item.m_param_widgets[i];
			item_i.x=x+item_i.dx;
			item_i.y=y+item_i.dy;
			var fwidget=g_panel_ui_widgets[item_i.port_ref.ui[0].toLowerCase()];
			if(fwidget){
				fwidget.call(item_i,obj, item_i.x,item_i.y,item_i.w,item_i.h);
			}
		}
		//create UI panel
		//if(ndi.m_is_selected&&cache_item.m_param_panel.length>0){
		//	need_ui=1;
		//}
	}
	//if(need_ui){
	//	UI.OpenUtilTab("param_panel","quiet");
	//}
	//render the links
	var port_pos_map={};
	for(var i=0;i<obj.m_proxy_ports.length;i++){
		var region=obj.m_proxy_ports[i].region;
		var port_pos_map_nd=port_pos_map[region.nd.__id__];
		if(!port_pos_map_nd){
			port_pos_map_nd={};
			port_pos_map[region.nd.__id__]=port_pos_map_nd;
		}
		port_pos_map_nd[region.port]=obj.m_proxy_ports[i];
	}
	for(var ei=0;ei<graph.es.length;ei++){
		var e=graph.es[ei];
		if(!port_pos_map[e.id0]||!port_pos_map[e.id1]){
			continue;
		}
		var pos0=port_pos_map[e.id0][e.port0];
		var pos1=port_pos_map[e.id1][e.port1];
		if(pos0&&pos1){
			var edge_disabled=((pos0.region.nd.m_is_disabled||pos1.region.nd.m_is_disabled)?1:0);
			var C0=pos0.region.color;
			var C1=pos1.region.color;
			if(edge_disabled||is_connecting_edges){
				C0&=0x55ffffff;
				C1&=0x55ffffff;
			}
			UI.RenderEdge(pos0.x,pos0.y,pos1.x,pos1.y,C0,C1,obj.edge_style.line_width);
			obj.m_proxy_edges.push({line:[pos0.x,pos0.y,pos1.x,pos1.y],eid:ei})
		}
	}
	var edge_vbo=UI.GetEdgeVBO();
	//the GLWidget function will be called multiple times, while the outside part won't
	UI.GLWidget(function(){
		UI.FlushEdges(obj.edge_style.line_width*tr.scale,edge_vbo);
		if(obj.m_temp_ui=="edge"){
			//rendering edges
			var pos0=obj.m_temp_ui_desc.v0;
			var pos1=obj.m_temp_ui_desc.v1;
			pos0.x=pos0.region.x-pos0.region.dx+pos0.region.pdx;
			pos0.y=pos0.region.y-pos0.region.dy+pos0.region.pdy;
			if(pos1){
				UI.RenderEdge(
					pos0.x*tr.scale,pos0.y*tr.scale,pos1.x*tr.scale,pos1.y*tr.scale,
					pos0.region.color,
					pos1.region?pos1.region.color:(0x55ffffff&obj.edge_style.color),
					obj.edge_style.line_width*tr.scale);
				UI.FlushEdges(obj.edge_style.line_width*tr.scale,UI.GetEdgeVBO());
			}
		}
	});
	if(obj.m_drag_ctx&&obj.m_drag_ctx.m_sel_rect){
		var rc=obj.m_drag_ctx.m_sel_rect;
		UI.RoundRect({
			x:rc[0],y:rc[1],w:rc[2]-rc[0],h:rc[3]-rc[1],
			color:obj.node_style.dragsel_bgcolor,
			border_color:obj.node_style.dragsel_border_color,
			border_width:obj.node_style.dragsel_border_width,
		})
	}
	////////////
	//render the temp UI - add-node edit
	//it shouldn't be scaled
	var RenderTempEditor=function(id,attrs){
		var obj_prev=obj[id];
		W.Edit(id,{
			x:attrs.x,y:attrs.y,w:attrs.w,h:attrs.h,
			font:attrs.font,
			text:attrs.text,
			is_single_line:1,right_side_autoscroll_margin:0.5,
			precise_ctrl_lr_stop:0,
			same_line_only_left_right:0,
			owner:obj,
			additional_hotkeys:[{key:"ESCAPE",action:function(){
				//cancel the change
				var obj=this.owner
				obj.m_temp_ui=undefined;
				UI.Refresh()
			}}],
			OnBlur:function(){
				var obj=this.owner
				obj.m_temp_ui=undefined;
				UI.Refresh()
			},
			OnEnter:attrs.OnEnter,
		});
		if(!obj_prev){
			UI.SetFocus(obj[id]);
			obj[id].SetSelection(0,obj[id].ed.GetTextSize())
			UI.Refresh();
		}
	};
	//////////////////////////
	if(obj.m_temp_ui=="rename_node"){
		var node_style=UI.default_styles.graph_view.node_style;
		var nd_renamed=obj.m_temp_ui_desc.nd;
		var cache_item=UI.GetNodeCache(cache,nd_renamed);
		var rc={
			x:nd_renamed.x+tr.trans[0]/tr.scale+node_style.caption_padding,
			y:nd_renamed.y+tr.trans[1]/tr.scale+(node_style.caption_h-UI.GetCharacterHeight(node_style.font_caption))*0.5,
			w:cache_item.m_w-node_style.caption_padding*2,h:UI.GetCharacterHeight(node_style.font_caption),
			color:nd_renamed.m_color||node_style.node_color_default,
		};
		UI.RoundRect(rc)
		RenderTempEditor("rename_node_edit",{
			x:rc.x,
			y:rc.y,
			w:rc.w,h:rc.h,
			font:node_style.font_caption,
			text:nd_renamed.m_caption,
			OnEnter:function(){
				var obj=this.owner;
				obj.m_temp_ui_desc.nd.m_caption=this.ed.GetText();
				obj.m_temp_ui=undefined;
				obj.graph.SignalEdit([]);
				obj.cache.nds={};
				UI.Refresh();
			}
		});
	}else if(obj.m_temp_ui=="rename_port"){
		var rg_port=obj.m_temp_ui_desc.region;
		//todo
	}
	UI.PopSubWindow()
	//////////////////////////
	if(obj.m_temp_ui=="add_node"){
		//put it near the mouse
		var x_caret=Math.min(obj.m_temp_ui_desc.x,obj.x+obj.w-obj.style_package.w-4);
		var y_caret=Math.min(obj.m_temp_ui_desc.y,obj.y+obj.h-obj.style_package.h-4);
		var old_pack_page=obj.pack_page;
		W.PackagePage('pack_page',{
			'graphview':obj,
			x:x_caret-obj.style_package.dx,y:y_caret-obj.style_package.dy,
			w:obj.style_package.w,
			h:obj.style_package.h,
		});
		if(!old_pack_page){
			UI.SetFocus(obj.pack_page.find_bar_edit);
		}
	}
	//////////////////
	var nd_sel=obj.graph.nds.filter(function(ndi){
		return ndi.m_is_selected;
	});
	var menu_edit=UI.BigMenu("&Edit")
	menu_edit.AddNormalItem({text:"&Undo",icon:"撤",enable_hotkey:UI.nd_focus==obj,key:"CTRL+Z",action:function(){
		this.Undo()
	}.bind(obj)})
	menu_edit.AddNormalItem({text:"&Redo",icon:"做",enable_hotkey:UI.nd_focus==obj,key:"SHIFT+CTRL+Z",action:function(){
		this.Redo()
	}.bind(obj)})
	menu_edit.AddSeparator();
	menu_edit.AddNormalItem({text:"&Copy",icon:"拷",enable_hotkey:UI.nd_focus==obj,key:"CTRL+C",action:function(){
		this.Copy();
	}.bind(obj)})
	menu_edit.AddNormalItem({text:"Cu&t",icon:"剪",enable_hotkey:UI.nd_focus==obj,key:"CTRL+X",action:function(){
		this.Copy();
		this.graph.DeleteSelection(0);
	}.bind(obj)})
	if(UI.SDL_HasClipboardText()){
		menu_edit.AddNormalItem({text:"&Paste",icon:"粘",enable_hotkey:UI.nd_focus==obj,key:"CTRL+V",action:function(){
			this.Paste();
		}.bind(obj)})
	}
	menu_edit.AddNormalItem({text:"&Duplicate",enable_hotkey:UI.nd_focus==obj,key:"CTRL+D",action:function(){
		this.Copy();
		this.Paste();
	}.bind(obj)})
	if(nd_sel.length>0){
		menu_edit.AddSeparator();
		menu_edit.AddNormalItem({text:"&Group",enable_hotkey:UI.nd_focus==obj,key:"CTRL+G",action:function(){
			this.Group()
		}.bind(obj)})
		menu_edit.AddNormalItem({text:"Ungroup",enable_hotkey:UI.nd_focus==obj,key:"CTRL+U",action:function(){
			var ret=Ungroup(this.graph.nds,this.graph.es, this.graph.nds.filter(function(ndi){
				return isGroup(ndi)&&ndi.m_is_selected;
			}),0)
			this.graph.nds=ret[0];
			this.graph.es=ret[1];
			this.graph.SignalEdit(ret[2]);
			UI.Refresh();
		}.bind(obj)})
		menu_edit.AddSeparator();
		menu_edit.AddNormalItem({text:"Re&name",enable_hotkey:UI.nd_focus==obj,key:"F2",action:function(nd){
			this.RenameNode(nd);
		}.bind(obj,nd_sel[0])})
		menu_edit.AddNormalItem({text:"&Disable",icon:"释",enable_hotkey:UI.nd_focus==obj,key:"D",action:function(){
			var graph=this.graph;
			var is_all_disabled=1;
			for(var i=0;i<graph.nds.length;i++){
				if(graph.nds[i].m_is_selected&&!graph.nds[i].m_is_disabled){
					is_all_disabled=0;
				}
			}
			var nds_toggled=[];
			for(var i=0;i<graph.nds.length;i++){
				if(graph.nds[i].m_is_selected){
					graph.nds[i].m_is_disabled=!is_all_disabled;
					nds_toggled.push(graph.nds[i]);
				}
			}
			graph.SignalEdit(nds_toggled);
			UI.Refresh();
		}.bind(obj)})
	}
	menu_edit.AddNormalItem({text:UI._("Insert dot"),enable_hotkey:UI.nd_focus==obj,key:".",action:function(){
		obj.InsertDot();
	}.bind(obj)})
	if(UI.nd_focus==obj){
		W.Hotkey("",{key:'ESC',action:function(){UI.top.app.document_area.ToggleMaximizeMode();UI.Refresh();}});
		W.Hotkey("",{key:'SPACE',action:function(){UI.top.app.document_area.ToggleMaximizeMode();UI.Refresh();}});
	}
	if(nd_sel.length>0){
		menu_edit.AddSeparator();
		for(var i=1;i<=4;i++){
			menu_edit.AddNormalItem({text:UI.Format('Connect to "view &@1"',i.toString()),icon:"眼",enable_hotkey:UI.nd_focus==obj,key:i.toString(),action:function(i){
				obj.QuickPreview(i);
			}.bind(obj,i)})
		}
	}
	menu_edit=undefined;
	var menu_run=UI.BigMenu("&Run")
	menu_run.AddNormalItem({
		text:"Build &graph",key:"CTRL+B",
		enable_hotkey:1,action:function(){
			this.Build(0)
		}.bind(obj)})
	menu_run.AddNormalItem({
		text:"R&ebuild graph",key:"CTRL+SHIFT+B",
		enable_hotkey:1,action:function(){
			this.Build(1)
		}.bind(obj)})
	menu_run=undefined;
	UI.End()
	return obj;
};

var g_new_id=0;
UI.OpenGraphTab=function(file_name){
	//var layout=UI.m_ui_metadata["<layout>"];
	//layout.m_is_maximized=0;
	var file_name=file_name||("<New #"+(g_new_id++).toString()+">")
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var obj_tab_i=UI.g_all_document_windows[i];
		if(obj_tab_i.file_name==file_name&&obj_tab_i.document_type=="graph"){
			UI.top.app.document_area.SetTab(i)
			return obj_tab_i;
		}
	}
	file_name=IO.NormalizeFileName(file_name);
	//create graph files as standalone zg, *publish* them into the directory structure
	var ret=UI.NewTab({
		file_name:file_name,
		title:UI.GetSmartTabName(file_name),
		tooltip:file_name,
		document_type:"graph",
		NeedRendering:function(){
			if(!this.main_widget){return 1;}
			if(this==UI.top.app.document_area.active_tab){return 1;}
			//coulddo: involuntary update check
			return 0;
		},
		UpdateTitle:function(){
			if(this.main_widget){
				var body=this.main_widget;
				var fn_display=(body&&body.m_file_name||this.file_name)
				fn_display=IO.NormalizeFileName(fn_display,1);
				this.title=UI.GetSmartTabName(fn_display);
				this.tooltip=fn_display;
				this.need_save=this.main_widget.NeedSave();
				if(this.need_save){
					this.title=this.title+'*';
				}
			}
		},
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			if(this.main_widget){this.file_name=this.main_widget.m_file_name}
			var attrs={
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'x_real':UI.context_parent.x_real,'y_real':UI.context_parent.y_real,
				//'default_focus':1,
			};
			if(!this.main_widget){
				attrs.graph=UI.LoadGraph(this.file_name);
				if(!attrs.graph){
					attrs.graph=UI.CreateGraph();
				}
				attrs.m_file_name=this.file_name;
			}
			var body=W.GraphView("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
				body.m_file_name=this.file_name;
			}
			this.need_save=this.main_widget.NeedSave();
			this.UpdateTitle();
			return body;
		},
		Save:function(){
			if(!this.main_widget){return;}
			if(this.main_widget.m_file_name&&this.main_widget.m_file_name.indexOf('<')>=0){
				this.SaveAs()
				return
			}
			this.main_widget.Save();
			this.need_save=this.main_widget.NeedSave();
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(1,"zg",
				this.main_widget.m_file_name.indexOf('<')>=0?
					UI.m_new_document_search_path:
					UI.GetPathFromFilename(this.main_widget.m_file_name));
			if(!fn){return;}
			this.file_name=fn
			this.main_widget.m_file_name=fn
			this.main_widget.cache=undefined;
			this.Save()
		},
		SaveMetaData:function(){
			if(this.main_widget){this.main_widget.SaveMetaData();}
		},
		OnDestroy:function(){
			//if(this.main_widget){this.main_widget.OnDestroy();}
		},
		Reload:function(){
			if(this.main_widget){this.main_widget.Reload();}
		},
		//color_theme:[UI.Platform.BUILD=="debug"?0xff1f1fb4:0xffb4771f],
	})
	return ret;
};

///////////////////////////////////////
//ui panel
var g_panel_ui_widgets={
	//this is not a class prototype... yet
	editbox:function(obj_gview, x,y,w,h){
		var style=UI.default_styles.graph_view.ui_style;
		var id0=this.nd.__id__+'='+this.port_ref.id;
		var value=this.nd.m_ui_values[this.port_ref.id];
		if(value==undefined){
			value=this.port_ref.default;
		}
		W.EditBox(id0,{
			//x:x,y:y+4,w:w,h:h-8,font:style.font_widgets,
			x:x,y:y,w:w,h:h,font:style.font_widgets,
			border_width:1,
			value:value,
			OnChange:function(value){
				this.nd.m_ui_values[this.port_ref.id]=value;
				obj_gview.graph.SignalEdit([this.nd]);
				UI.Refresh();
			}.bind(this)
		});
	},
};

UI.g_ce_save_time=0;
UI.g_ce_file_save_time={};
UI.OnCodeEditorSave=function(fn){
	UI.g_ce_file_save_time[fn]=++UI.g_ce_save_time;
};

///////////////////////////////
W.PackagePage_prototype={
	InvalidateContent:function(){
		this.found_items=undefined;
		UI.Refresh()
	},
};
var fpackagepage_findbar_plugin=function(){
	//todo: AC, OnChange explanation
	this.AddEventHandler('ESC',function(){
		var obj=this.owner
		//var tab_frontmost=UI.GetFrontMostEditorTab();
		//if(tab_frontmost){
		//	UI.top.app.document_area.SetTab(tab_frontmost.__global_tab_id)
		//}
		//UI.top.app.document_area.CloseTab(obj.owner_tab.__global_tab_id)
		obj.graphview.m_temp_ui=undefined;
		UI.Refresh()
	})
	this.OnMouseWheel=function(event){
		var obj=this.owner
		obj.OnMouseWheel(event)
	}
	this.AddEventHandler('change',function(){
		//close the current file
		var obj=this.owner;
		obj.InvalidateContent()
		UI.Refresh()
	})
	var fpassthrough=function(key,event){
		var obj=this.owner
		if(obj.package_list){
			obj.package_list.OnKeyDown(event)
		}
	}
	this.AddEventHandler('RETURN RETURN2',function(key,event){
		var obj=this.owner
		//if(obj.text){
		//	obj.InvalidateContent();
		//	UI.Refresh()
		//}else 
		if(obj.package_list){
			obj.package_list.OnKeyDown(event)
		}
	})
	this.AddEventHandler('UP',fpassthrough)
	this.AddEventHandler('DOWN',fpassthrough)
	this.AddEventHandler('PGUP',fpassthrough)
	this.AddEventHandler('PGDN',fpassthrough)
};

UI.g_packages=[];
UI.g_packages_by_name={};
var ReindexPackages=function(){
	//here we *only* search for packages, not individual nodes
	//UI.m_node_dir
	//var search_paths=(UI.m_ui_metadata["<search_paths>"]||[]);
	var spath=IO.ProcessUnixFileName("~/.zpacks");
	if(!IO.DirExists(spath)){
		IO.CreateDirectory(spath);
	}
	var fnext=IO.CreateEnumFileContext(spath+'/*',2);
	var packs=[];
	if(fnext){
		for(;;){
			var fi=fnext();
			if(!fi){break;}
			if(UI.GetMainFileName(fi.name).toLowerCase()=='build'){
				continue;
			}
			packs.push(IO.NormalizeFileName(fi.name));
		}
		fnext=undefined;
	}
	packs.sort(function(a,b){
		var s0=UI.GetMainFileName(a).toLowerCase();
		var s1=UI.GetMainFileName(b).toLowerCase();
		return s0<s1?-1:(s0==s1?0:1);
	});
	//parse each package... on-demand
	UI.g_packages_by_name={};
	UI.g_packages=packs.map(function(sdir){
		var ret={
			name:UI.GetMainFileName(sdir).toLowerCase(),
			dir:sdir,
		};
		UI.g_packages_by_name[ret.name]=ret;
		return ret;
	});
};
//ReindexPackages();

var GetPackageByName=function(cache,s_package){
	var nd_package=cache.m_local_packages[s_package];
	if(nd_package==undefined){
		var sdir=cache.m_file_dir+'/zpacks/'+s_package;
		if(IO.DirExists(sdir)){
			nd_package={
				name:s_package,
				dir:sdir,
			}
		}else{
			nd_package=null;
		}
		cache.m_local_packages[s_package]=nd_package;
	}
	return nd_package||UI.g_packages_by_name[s_package];
};

var ParsePackage=function(nd_package){
	if(!nd_package){return;}
	if(!nd_package.nodes){
		//just grab all their top-level groups
		var graph_fns=[];
		var fnext=IO.CreateEnumFileContext(nd_package.dir+'/*.zg',1);
		if(fnext){
			for(;;){
				var fi=fnext();
				if(!fi){break;}
				graph_fns.push(IO.NormalizeFileName(fi.name));
			}
			fnext=undefined;
		}
		graph_fns.sort();
		nd_package.nodes=[];
		nd_package.m_description='';
		if(graph_fns.length>0){
			if(graph_fns.length>1){
				console.log(['warning: package "',nd_package.name,'" contains more than one graphs, picking "',graph_fns[0],'"'].join(''));
			}
			var graph=UI.LoadGraph(graph_fns[0]);
			nd_package.fn_graph=graph_fns[0];
			for(var i=0;i<graph.nds.length;i++){
				var nd_i=graph.nds[i];
				if(isGroup(nd_i)){
					//reusable group
					//for use with LoadGroupReference
					nd_package.nodes.push(nd_i.m_caption);
				}else if(nd_i.m_caption=='metadata'){
					nd_package.m_description=(nd_i.m_ui_values['description']||nd_package.m_description);
				}else if(nd_i.m_caption[0]=='@'){
					//example code snippet
					nd_package.nodes.push(nd_i.m_caption);
				}
			}
			//caption-packed description
			for(var i=0;i<nd_package.nodes.length;i++){
				var s_caption_i=nd_package.nodes[i];
				var pcolon=s_caption_i.indexOf(': ');
				if(pcolon>=0){
					nd_package.nodes[i]={
						name:s_caption_i.substr(0,pcolon),
						desc:s_caption_i.substr(pcolon+2),
					};
				}else{
					nd_package.nodes[i]={
						name:s_caption_i,
						desc:'',
					};
				}
			}
		}else{
			console.log(['error: package "',nd_package.name,'" does not contain any graph'].join(''));
		}
	}
	return nd_package.nodes;
};

W.PackagePage=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"package_page",W.PackagePage_prototype);
	UI.Begin(obj)
	UI.RoundRect({
		x:obj.x-obj.shadow_size,y:obj.y-obj.shadow_size,
		w:obj.w+obj.shadow_size*2,h:obj.h+obj.shadow_size*2,
		color:obj.shadow_color,
		border_width:-obj.shadow_size,
		round:obj.shadow_size});
	UI.RoundRect(obj)
	W.PureRegion(id,obj)
	UI.RoundRect({
		x:obj.x,y:obj.y,
		w:obj.w,h:obj.h_find_bar,
		color:obj.bgcolor});
	//coulddo: show current project
	var w_buttons=0;
	W.Button("refresh_button",{
		x:w_buttons,y:0,h:obj.h_find_bar,
		value:obj.selected,padding:8,
		font:UI.icon_font_20,
		text:obj.text?"撤":"刷",
		tooltip:obj.text?"Back":"Refresh",// - F5
		anchor:'parent',anchor_align:'right',anchor_valign:'up',
		OnClick:function(){
			this.InvalidateContent();
			ReindexPackages();
			UI.Refresh()
		}.bind(obj)
	})
	w_buttons+=obj.refresh_button.w
	var rect_bar=UI.RoundRect({
		x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
		w:obj.w-w_buttons-obj.find_bar_padding*2,h:obj.h_find_bar-obj.find_bar_padding*2,
		color:obj.find_bar_color,
		round:obj.find_bar_round})
	UI.DrawChar(UI.icon_font_20,obj.x+obj.find_bar_padding*2,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
		obj.find_bar_hint_color,'s'.charCodeAt(0))
	var x_find_edit=obj.x+obj.find_bar_padding*3+UI.GetCharacterAdvance(UI.icon_font_20,'s'.charCodeAt(0));
	var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
	W.Edit("find_bar_edit",{
		style:obj.find_bar_editor_style,
		x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
		owner:obj,
		precise_ctrl_lr_stop:UI.TestOption("precise_ctrl_lr_stop"),
		same_line_only_left_right:!UI.TestOption("left_right_line_wrap"),
		plugins:[fpackagepage_findbar_plugin],
		default_focus:2,
		tab_width:UI.GetOption("tab_width",4),
	});
	if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
		W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
			font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
			text:UI._("Add node")})
	}
	if(!obj.found_items){
		var s_search_text=obj.find_bar_edit.ed.GetText();
		var items=[];
		obj.found_items=items;
		var s_searches=s_search_text.toLowerCase().split(' ');
		//////////
		//use plain old name search
		//search for unreferenced packages
		var graphview=obj.graphview;
		//var packs_refed=graphview.graph.m_depends;
		var packs_refed=readdir(UI.GetPathFromFilename(obj.graphview.m_file_name)+'/zpacks/*',2).map(function(fn){return UI.GetMainFileName(fn);});
		var packs_refed_map={};
		for(var i=0;i<packs_refed.length;i++){
			packs_refed_map[packs_refed[i]]=1;
		}
		for(var i=0;i<UI.g_packages.length;i++){
			if(packs_refed_map[UI.g_packages[i].name]){continue;}
			var s_i=UI.g_packages[i].name.toLowerCase();
			var s_desc_i=(UI.g_packages[i].desc||'').toLowerCase();
			var is_bad=0;
			var hl_ranges=[];
			var hl_ranges_desc=[];
			for(var j=0;j<s_searches.length;j++){
				var p=s_i.indexOf(s_searches[j]);
				if(p<0){
					var p=s_desc_i.indexOf(s_searches[j]);
					if(p<0){
						is_bad=1;
						break
					}
					hl_ranges_desc.push(p,p+s_searches[j].length);
					continue;
				}
				hl_ranges.push(p,p+s_searches[j].length);
			}
			if(!is_bad){
				ParsePackage(UI.g_packages[i]);
				items.push({
					s_package:UI.g_packages[i].name,
					s_desc:UI.g_packages[i].m_description,
					hl_ranges:hl_ranges,
					hl_ranges_desc:hl_ranges_desc,
				});
			}
		}
		//nodes of already-referenced packages
		for(var pi=0;pi<packs_refed.length;pi++){
			var s_package=packs_refed[pi];
			var nd_package=GetPackageByName(obj.graphview.cache,s_package);
			if(!nd_package){continue;}
			var groups=ParsePackage(nd_package);
			for(var i=0;i<groups.length;i++){
				var s_i=groups[i].name.toLowerCase();
				var s_desc_i=(groups[i].desc||'').toLowerCase();
				if(s_i[0]=='@'){
					s_i=s_i.substr(1);
				}
				var is_bad=0;
				var hl_ranges=[];
				var hl_ranges_desc=[];
				for(var j=0;j<s_searches.length;j++){
					var p=s_i.indexOf(s_searches[j]);
					if(p<0){
						var p=s_desc_i.indexOf(s_searches[j]);
						if(p<0){
							is_bad=1;
							break
						}
						hl_ranges_desc.push(p,p+s_searches[j].length);
						continue;
					}
					hl_ranges.push(p,p+s_searches[j].length);
				}
				if(!is_bad){
					if(groups[i].name[0]=='@'){
						items.push({
							s_package:s_package,
							s_template:groups[i].name,
							s_desc:groups[i].desc,
							hl_ranges:hl_ranges,
							hl_ranges_desc:hl_ranges_desc,
						});
					}else{
						items.push({
							s_package:s_package,
							s_group:groups[i].name,
							s_desc:groups[i].desc,
							hl_ranges:hl_ranges,
							hl_ranges_desc:hl_ranges_desc,
						});
					}
				}
			}
		}
		//private nodes
		var pnode_list=UI.GetPrivateClassList(obj.graphview.cache);
		for(var i=0;i<pnode_list.length;i++){
			var s_i=pnode_list[i].toLowerCase();
			//var s_desc_i='private nodes'
			var is_bad=0;
			var hl_ranges=[];
			//var hl_ranges_desc=[];
			for(var j=0;j<s_searches.length;j++){
				var p=s_i.indexOf(s_searches[j]);
				if(p<0){
					//var p=s_desc_i.indexOf(s_searches[j]);
					//if(p<0){
					//	is_bad=1;
					//	break;
					//}
					//hl_ranges_desc.push(p,p+s_searches[j].length);
					//continue;
					is_bad=1;
					break;
				}
				hl_ranges.push(p,p+s_searches[j].length);
			}
			if(!is_bad){
				items.push({
					s_create:pnode_list[i],
					hl_ranges:hl_ranges,
					//hl_ranges_desc:hl_ranges_desc,
				});
			}
		}
		//create-node option
		if(s_searches.length==1){
			if(s_search_text.indexOf('.')>=0){
				items.push({
					s_create:s_search_text,
				});
			}
		}
		//postprocessing
		for(var i=0;i<items.length;i++){
			items[i].h=UI.default_styles.package_item.h;
		}
		obj.package_list=undefined;
	}
	//just show a list of candidates, with keyboard browsing -- listview
	UI.PushCliprect(obj.x,obj.y+obj.h_find_bar,obj.w,obj.h-obj.h_find_bar)
	W.ListView('package_list',{
		x:obj.x,y:obj.y+obj.h_find_bar,w:obj.w,h:obj.h-obj.h_find_bar,
		dimension:'y',layout_spacing:8,layout_align:'fill',
		no_clipping:1,
		mouse_wheel_speed:80,
		items:obj.found_items,
		item_template:{
			object_type:W.PackageItem,
			owner:obj,
		}})
	UI.RoundRect({
		x:obj.x-obj.top_hint_shadow_size, y:obj.y+obj.h_find_bar-obj.top_hint_shadow_size, 
		w:obj.w+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
		round:obj.top_hint_shadow_size,
		border_width:-obj.top_hint_shadow_size,
		color:obj.top_hint_shadow_color})
	UI.PopCliprect();
	UI.End()
	return obj
};

W.PackageItem_prototype={
	OnDblClick:function(){
		//actually create the node, invalid class is fine - could just delete it later, or create the class
		var obj=this.owner.graphview;
		var graph=obj.graph;
		var cache=obj.cache;
		if(this.s_package&&!this.s_group&&!this.s_template){
			//we're just adding a package
			//we stay in the adding mode, wipe the text, but keep the focus
			//graph.m_depends.push(this.s_package);
			var sdir_zpacks=UI.GetPathFromFilename(obj.m_file_name)+'/zpacks';
			IO.CreateDirectory(sdir_zpacks);
			UI.RecursiveCopy(UI.g_packages_by_name[this.s_package].dir,sdir_zpacks+'/'+this.s_package);
			/////////////////
			var plist=this.owner;
			var size=plist.find_bar_edit.ed.GetTextSize();
			if(size){
				plist.find_bar_edit.ed.Edit([0,size,null]);
			}
			graph.SignalEdit([]);
			plist.InvalidateContent();
			UI.Refresh();
			return;
		}
		var stext_raw=this.s_create;
		var s_file_template=undefined;
		var nd_package=GetPackageByName(cache,this.s_package);
		ParsePackage(nd_package);
		if(this.s_template){
			//add a number, copy the file
			var s_tname=this.s_template.substr(1);
			var s_tname0=UI.GetMainFileName(s_tname);
			var s_tname1=UI.GetFileNameExtension(s_tname);
			for(var seq=0;;seq++){
				var fname=[sdir,'/',s_tname0,seq,'.',s_tname1].join('');
				if(!IO.FileExists(fname)){
					stext_raw=[s_tname0,seq,'.',s_tname1].join('');
					break;
				}
			}
			s_file_template=LoadGroupReference(this.s_template,nd_package.fn_graph);
		}else if(this.s_group){
			//group reference, pick by caption, cache the graph with date checks
			var s_group_file=nd_package.fn_graph;
			var s_group_name=this.s_group;
			var nd_group_ref=LoadGroupReference(s_group_name,s_group_file);
			if(nd_group_ref){
				//duplicate the group class - mainly node ids in the graph
				var ndcls_cloned=JSON.parse(JSON.stringify(nd_group_ref.m_class));
				FixClonedGroupClass(ndcls_cloned);
				//create node with ndcls_cloned - group node creation
				stext_raw=ndcls_cloned;
			}
		}
		var nd_new=graph.CreateNode(stext_raw);
		var is_file=0;
		if(typeof(stext_raw)=='string'&&stext_raw.indexOf('.')>=0){
			//it's a file! a new class!
			//create the file in znodes/
			var sdir=UI.GetPathFromFilename(obj.m_file_name);
			//IO.CreateDirectory(sdir)
			//if(!IO.DirExists(sdir)){
			//	stext_raw=UI._('Unable to create the znodes directory');
			//}else{
			if(s_file_template&&!IO.FileExists(sdir+'/'+stext_raw)){
				IO.CreateFile(sdir+'/'+stext_raw,IO.ReadAll(s_file_template));
			}
			OpenNodeEditorTab(obj,sdir+'/'+stext_raw,nd_new);
			//we still need the node
			stext_raw=UI.RemoveExtension(stext_raw);
			//}
			is_file=1;
		}
		if(typeof(stext_raw)!='string'&&s_group_name){
			nd_new.m_caption=s_group_name;
			//prepend the package dir
			nd_new.m_package_dir='zpacks/'+this.s_package+'/'+(nd_new.m_package_dir||'');
		}
		//////////////////////////////////////
		//score-based auto-connect
		//better selection key - use "distance-to-selection"
		var node_map={};
		var es_uni=[];
		var Q=[];
		var dist_to_sel=[];
		for(var i=0;i<graph.nds.length;i++){
			if(graph.nds[i].m_is_selected){
				Q.push(i);
				dist_to_sel[i]=0;
			}
			node_map[graph.nds[i].__id__]=i;
			es_uni[i]=[];
		}
		for(var i=0;i<graph.es.length;i++){
			var e=graph.es[i];
			var v0=node_map[e.id0];
			var v1=node_map[e.id1];
			es_uni[v0].push(v1);
			es_uni[v1].push(v0);
		}
		//BFS for dist-to-sel
		var head=0;
		for(var dist=0;head<Q.length;dist++){
			for(var tail=Q.length;head<tail;head++){
				var v0=Q[head];
				var vs_next=es_uni[v0];
				for(var i=0;i<vs_next.length;i++){
					var v1=vs_next[i];
					if(dist_to_sel[v1]==undefined){
						dist_to_sel[v1]=dist+1;
						Q.push(v1);
					}
				}
			}
		}
		//for the unconnected...
		for(var i=0;i<graph.nds.length;i++){
			if(dist_to_sel[i]==undefined){
				dist_to_sel[i]=graph.nds.length;
			}
		}
		//enum and test all ports
		//keys: matched_type_id selection key x
		//do auto-layout in the same loop
		var ndcls_new=UI.GetNodeClass(cache,nd_new);
		if(ndcls_new&&ndcls_new.m_ports){
			var al_x_max=-1e10,al_y_avg=0,al_n=0;
			for(var pi=0;pi<ndcls_new.m_ports.length;pi++){
				var port_pi=ndcls_new.m_ports[pi];
				//if(port_pi.dir!='output'){continue;}
				var type_ordering={};
				for(var i=0;i<port_pi.type.length;i++){
					type_ordering[port_pi.type[i]]=i+1;
				}
				var type_key_best=1e9;
				var port_best=undefined;
				for(var i=0;i<graph.nds.length-1;i++){
					var ndi=graph.nds[i];
					var ndcls=UI.GetNodeClass(cache,ndi);
					var type_key=1e10;
					var id_best=undefined;
					for(var j=0;j<ndcls.m_ports.length;j++){
						var port_j=ndcls.m_ports[j];
						var type_j=port_j.type;
						if(port_j.dir==port_pi.dir){continue;}
						for(var tj=0;tj<type_j.length;tj++){
							if(type_key>type_ordering[type_j[tj]]+tj){
								type_key=type_ordering[type_j[tj]]+tj;
								id_best=port_j.id;
							}
						}
					}
					if(id_best&&(type_key_best>type_key||type_key_best==type_key&&(
					dist_to_sel[port_best.ndid]>dist_to_sel[i]||dist_to_sel[port_best.ndid]==dist_to_sel[i]&&(
					port_best.nd.x<ndi.x||port_best.nd.x==ndi.x&&port_best.nd.y<ndi.y)))){
						type_key_best=type_key;
						port_best={nd:ndi,ndid:i,port:id_best};
					}
				}
				if(port_best){
					if(port_pi.dir=='output'){
						graph.es.push({
							id0:nd_new.__id__, port0:port_pi.id,
							id1:port_best.nd.__id__, port1:port_best.port,
						})
						var cache_item=UI.GetNodeCache(cache,port_best.nd);
						al_x_max=Math.max(al_x_max,port_best.nd.x+cache_item.m_w);
						al_y_avg+=port_best.nd.y;
						al_n++;
					}else{
						graph.es.push({
							id0:port_best.nd.__id__, port0:port_best.port,
							id1:nd_new.__id__, port1:port_pi.id,
						})
					}
				}
			}
		}
		if(is_file){
			nd_new.x=(obj.m_temp_ui_desc.x-graph.tr.trans[0])/graph.tr.scale;
			nd_new.y=(obj.m_temp_ui_desc.y-graph.tr.trans[1])/graph.tr.scale;
		}else if(al_n){
			//connection-based auto-layout: x_max+margin, y_average
			nd_new.x=al_x_max+32;
			nd_new.y=al_y_avg/al_n;
		}else{
			//by default, add it "down"
			var y_max=0,x_y_max=0;
			for(var i=0;i<graph.nds.length;i++){
				var cache_item=UI.GetNodeCache(cache,graph.nds[i]);
				var y_i=graph.nds[i].y+(cache_item.m_h||0);
				if(y_max<y_i||y_max==y_i&&x_y_max<graph.nds[i].x){
					x_y_max=graph.nds[i].x;
					y_max=y_i;
				}
			}
			nd_new.x=x_y_max;
			nd_new.y=y_max+8;
		}
		for(var i=0;i<graph.nds.length;i++){
			graph.nds[i].m_is_selected=0;
		}
		nd_new.m_is_selected=1;
		obj.m_temp_ui=undefined;
		graph.SignalEdit([nd_new]);
		UI.Refresh()
	},
};
W.PackageItem=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"package_item",W.PackageItem_prototype);
	UI.Begin(obj)
		UI.RoundRect({
			x:obj.x+obj.padding,y:obj.y,w:obj.w-obj.padding*2-12+obj.shadow_size,h:obj.h+obj.shadow_size,
			border_width:-obj.shadow_size,round:obj.shadow_size,color:obj.shadow_color})
		var name_font=obj.name_font;
		var name_font_bold=obj.name_font_bold;
		var h_icon=UI.GetCharacterHeight(obj.icon_font);
		//coulddo: show a description of selected nodes
		UI.RoundRect({
			x:obj.x+obj.padding,y:obj.y,w:obj.w-obj.padding*2-12,h:obj.h,
			color:this.bgcolor,
		})
		if(obj.selected){
			var sel_bgcolor=obj.sel_bgcolor;
			UI.RoundRect({
				x:obj.x+obj.padding,y:obj.y,w:obj.w-12-obj.padding*2,h:obj.h,
				border_color:sel_bgcolor,border_width:obj.sel_border_width})
		}
		UI.PushCliprect(obj.x+obj.padding,obj.y,obj.w-obj.padding*2-12,obj.h)
		var s_icon='夹';
		var s_title='',s_title2=undefined;
		var s_hint=(obj.s_desc||'');
		if(obj.s_package){
			if(obj.s_group){
				s_icon='も';
				s_title=obj.s_group;
				s_title2='@'+obj.s_package;
			}else if(obj.s_template){
				s_icon='新';
				s_title=obj.s_template.substr(1);
				s_title2='@'+obj.s_package;
			}else{
				s_icon='夹';
				s_title=obj.s_package;
			}
		}else{
			s_title=obj.s_create;
			if(obj.s_create.indexOf('.')>=0){
				s_icon='新';
				if(UI.GetFileNameExtension(obj.s_create).toLowerCase()=='zjs'){
					s_hint=UI._('New script');
				}else{
					s_hint=UI._('New code snippet');
				}
			}else{
				s_icon='プ';
				s_hint=UI._('Native node');
			}
		}
		UI.DrawChar(obj.icon_font,obj.x+obj.padding+4,obj.y+(obj.h-h_icon)*0.5,
			obj.icon_color,s_icon.charCodeAt(0));
		W.Text("",{x:obj.x+obj.padding+56,y:obj.y+4,
			font:name_font,text:s_title,
			color:obj.name_color})
		if(s_title2){
			W.Text("",{x:obj.x+obj.padding+56+UI.MeasureText(name_font,s_title).w+8,y:obj.y+4,
				font:name_font,text:s_title2,
				color:obj.hint_color})
		}
		W.Text("",{x:obj.x+obj.padding+56,y:obj.y+4+28,
			font:obj.hint_font,text:s_hint,
			color:obj.hint_color})
		if(obj.hl_ranges){
			for(var i=0;i<obj.hl_ranges.length;i+=2){
				var p0=obj.hl_ranges[i+0];
				var p1=obj.hl_ranges[i+1];
				if(p0<p1){
					var x=obj.x+obj.padding+56+UI.MeasureText(name_font,s_title.substr(0,p0)).w
					W.Text("",{x:x,y:obj.y+4,
						font:name_font_bold,text:s_title.substr(p0,p1-p0),
						color:obj.name_color})
				}
			}
		}
		if(obj.hl_ranges_desc){
			for(var i=0;i<obj.hl_ranges_desc.length;i+=2){
				var p0=obj.hl_ranges_desc[i+0];
				var p1=obj.hl_ranges_desc[i+1];
				if(p0<p1){
					var x=obj.x+obj.padding+56+UI.MeasureText(obj.hint_font,s_hint.substr(0,p0)).w
					W.Text("",{x:x,y:obj.y+4+28,
						font:obj.hint_font_bold,text:s_hint.substr(p0,p1-p0),
						color:obj.hint_color})
				}
			}
		}
		UI.PopCliprect();
	UI.End()
	return obj
}
