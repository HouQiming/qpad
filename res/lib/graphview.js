var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");

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

UI.GetNodeClass=function(cache,sname){
	if(typeof(sname)!='string'){
		return sname;
	}
	var holder=cache.m_classes_by_name[sname];
	if(holder==undefined){
		holder=null;
		for(var i=0;i<cache.search_paths.length;i++){
			var spath=cache.search_paths[i];
			var fnext=IO.CreateEnumFileContext(spath+'/'+sname+'.*',3);
			var fs=[];
			if(fnext){
				for(;;){
					var fi=fnext();
					if(!fi){break;}
					fs.push(IO.NormalizeFileName(fi.name));
				}
				fnext=undefined;
			}
			if(fs.length>1){
				fs.sort();
			}
			if(fs.length>0){
				if(IO.DirExists(fs[0])){
					//we're referencing another graph
					//todo
					break;
				}else{
					var snode=IO.ReadAll(fs[0]);
					if(snode){
						var ndcls=undefined;
						if(UI.GetFileNameExtension(fs[0]).toLowerCase()=='zjs'){
							ndcls=UI.ParseJSNode(snode);
						}else{
							ndcls=UI.ParseTextNode(snode);
						}
						ndcls.m_file_name=IO.NormalizeFileName(fs[0]);
						holder={
							m_ndcls:ndcls,
							m_file_name:IO.NormalizeFileName(fs[0]),
						};
						holder.m_file_save_time=(UI.g_ce_file_save_time[holder.m_file_name]||0);
						ndcls.m_port_map={};
						for(var i=0;i<ndcls.m_ports.length;i++){
							var port_i=ndcls.m_ports[i];
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
						break;
					}
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
	indented:function(arr_output,s_input){
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
			return UI.ED_GetClipboardTextSmart(s_target_indent,s_input);
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
				es_new.push({
					id0:nds[ins[j0].v].__id__,port0:ins[j0].port,
					id1:nds[outs[j1].v].__id__,port1:outs[j1].port,
				});
			}
		}
	}
	return es_new;
};
var Ungroup=function(nds,es, nds_ungroup,do_sel){
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
			if(do_sel){nds[i].m_is_selected=0;}
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
		var dx=nd_group.x-nd_group.m_x0;
		var dy=nd_group.y-nd_group.m_y0;
		for(var j=0;j<gr.nds.length;j++){
			var ndj=gr.nds[j];
			//set m_last_group_name when ungrouping - the group node may have been renamed
			ndj.m_last_group_name=nd_group.m_caption;
			nds_new.push(ndj);
			if(do_sel){ndj.m_is_selected=1;nds_gen.push(ndj);}
			ndj.x+=dx;
			ndj.y+=dy;
		}
		for(var j=0;j<gr.es.length;j++){
			es_new.push(gr.es[j]);
		}
		//the edges
		gr_reconnects=ndcls.m_reconnects;
		for(var j=0;j<gr_reconnects.length;j++){
			var cnj=gr_reconnects[j];
			gport_map[nd_group.__id__+'='+cnj.port_outer]=cnj.id_inner;
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
	if(do_sel){
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
			m_caption:class_name,
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
		IO.m_current_graph_path=sbasepath;
		IO.SetCurrentDirectory(IO.m_current_graph_path);
		var es=this.es;
		var nds=this.nds;
		////////////////////////
		//expand groups
		var ret_ung=Ungroup(nds,es,nds.filter(isGroup),0);
		nds=ret_ung[0];
		es=ret_ung[1]
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
			port_value_map[i]=bc_i;
		}
		for(var i=0;i<Q.length;i++){
			var v0=Q[i];
			var ndi=nds[v0];
			var need_build_i=(is_rebuild||ndi.m_need_rebuild);
			if(ndi.m_is_disabled){continue;}
			var ndcls=UI.GetNodeClass(cache,ndi.m_class);
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
						var id=ndcls.m_ports[j].id;
						if(ndcls.m_ports[j].dir=='input'&&!pvmap_v0[id]){
							var s_ui_value=ndi.m_ui_values[id];
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
							console.log(err.stack);
						}
					}else if(ndcls.m_blocks){
						var pvmap_v0_s={};
						for(var id in pvmap_v0){
							pvmap_v0_s[id]=pvmap_v0[id].join('');
						}
						var output_formats={};
						for(var j=0;j<ndcls.m_ports.length;j++){
							var port_j=ndcls.m_ports[j];
							if(port_j.dir=='input'&&port_j.format){
								output_formats[port_j.id]=port_j.format;
							}
						}
						for(var j=0;j<ndcls.m_blocks.length;j+=2){
							var id=ndcls.m_blocks[j];
							var blocks_j=ndcls.m_blocks[j+1];
							var blocks_ret=[];
							for(var k=0;k<blocks_j.length;k++){
								var s_block_jk=blocks_j[k];
								if(k&1){
									var f_format=output_formats[s_block_jk];
									if(f_format){
										f_format=g_edge_formats[f_format];
									}
									s_block_jk=pvmap_v0_s[s_block_jk];
									if(f_format){
										//format input ports
										s_block_jk=f_format(blocks_ret,s_block_jk);
									}
								}
								blocks_ret.push(s_block_jk);
							}
							pvmap_v0[id]=blocks_ret.join('');
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
	ret.__proto__=graph_prototype;
	return ret;
};

var PointDist=function(a,b){
	var dx=(a.x-b.x);
	var dy=(a.y-b.y);
	return Math.sqrt(dx*dx+dy*dy);
};
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
				if(event.y-this.y<style.caption_h){
					//node renaming
					this.owner.RenameNode(this.nd)
					return;
				}
			}
			//edit node file - put fn in parser
			if(isGroup(this.nd)){
				var obj=this.owner;
				var ret=Ungroup(obj.graph.nds,obj.graph.es, [this.nd],1);
				obj.graph.nds=ret[0];
				obj.graph.es=ret[1];
				obj.graph.SignalEdit(ret[2]);
				UI.Refresh();
				return;
			}
			var ndcls=UI.GetNodeClass(this.owner.cache,this.nd.m_class);
			if(ndcls){
				UI.OpenEditorWindow(ndcls.m_file_name);
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
	var ndcls=UI.GetNodeClass(cache,ndi.m_class);
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
		var side=(port_i.side||port_i.dir=="input"?"R":"L");
		var dims=UI.MeasureText(style.font_port,name);
		var w_port=dims.w+style.port_padding*2;
		if(side=="R"){
			wr=Math.max(wr,w_port);
			nr++;
		}else{
			wl=Math.max(wl,w_port);
			nl++;
		}
	}
	var dims=UI.MeasureText(style.font_caption,ndi.m_caption||ndi.__id__);
	var h_caption=style.caption_h;
	if(!isGroup(ndi)&&ndi.m_class=='__dot__'){
		wl=style.port_padding*2;
		wr=style.port_padding*2;
		dims.w=0;
		dims.h=0;
		h_caption=0;
	}
	var w_final=Math.max(dims.w+style.caption_padding*2, (wl-style.port_extrude)+(wr-style.port_extrude)+style.port_w_sep);
	var h_final=h_caption+Math.max(nl,nr)*(style.port_h+style.port_h_sep)+style.port_h_sep;
	cache_item.m_rects=[];
	cache_item.m_texts=[];
	cache_item.m_regions=[];
	cache_item.m_param_panel=[];
	cache_item.m_w=w_final;
	cache_item.m_h=h_final;
	cache_item.m_rects.push({
		dx:-style.shadow_size,dy:-style.shadow_size,
		w:w_final+style.shadow_size*2,h:h_final+style.shadow_size*2,
		round:style.shadow_size*1.5,
		border_width:-style.shadow_size*1.5,
		color:style.shadow_color,
	});
	cache_item.m_rects.push({
		dx:0,dy:0,
		w:w_final,h:h_final,
		round:style.node_round,
		color:ndi.m_color||style.node_color_default,
	});
	cache_item.m_regions.push({
		dx:0,dy:0,
		w:w_final,h:h_final,
		name:[ndi.__id__,'node'].join('_'),
		nd:ndi,
		proto:rproto_node,
	})
	cache_item.m_texts.push({
		dx:style.caption_padding,dy:(h_caption-UI.GetCharacterHeight(style.font_caption))*0.5,
		font:style.font_caption,text:ndi.m_caption,color:style.caption_text_color
	});
	//multi-connect case - use node y for ordering with edge dragging
	//if one really needs it, one could use helper boards
	//generate editor UI
	var degs_ndi=cache.m_degs[ndi.__id__];
	var xl=-style.port_extrude,xr=w_final+style.port_extrude-wr,
		pxl=-0.5*style.port_extrude,pxr=w_final+0.5*style.port_extrude,
		yl=h_caption,yr=h_caption, 
		dyl=(h_final-yl-style.port_h*nl)/(nl+1),
		dyr=(h_final-yr-style.port_h*nr)/(nr+1);
	var port_padding_y=(style.port_h-UI.GetCharacterHeight(style.font_port))*0.5;
	var endpoints={};
	cache_item.m_endpoints=endpoints;
	for(var i=0;i<ndcls.m_ports.length;i++){
		var port_i=ndcls.m_ports[i];
		var name=(ndi.m_renamed_ports[port_i.id]||port_i.id);
		var side=(port_i.side||(port_i.dir=="input"?"R":"L"));
		if(port_i.ui&&(!degs_ndi||!degs_ndi[port_i.id])){
			//generate node UI for non-connected port
			cache_item.m_param_panel.push({nd:ndi, name:name, port:port_i.id, ui:port_i.ui});
		}
		if(side=="R"){
			yr+=dyr;
			cache_item.m_rects.push({
				dx:xr,dy:yr,
				w:wr,h:style.port_h,
				round:style.port_round,
				color:port_i.color||style.port_color,
				port_ref:port_i,
			});
			cache_item.m_regions.push({
				dx:xr,dy:yr,
				w:wr,h:style.port_h,
				name:[ndi.__id__,'port',port_i.id].join('_'),
				nd:ndi,port:port_i.id,dir:port_i.dir,
				pdx:pxr,pdy:yr+style.port_h*0.5,
				color:port_i.color||style.port_color,
				port_ref:port_i,
				proto:rproto_port,
			})
			endpoints[name]={dx:xr+wr,dy:yr+style.port_h*0.5};
			cache_item.m_texts.push({
				dx:xr+style.port_padding,dy:yr+port_padding_y,
				font:style.font_port,text:name,color:style.port_text_color,
				port_ref:port_i,
			});
			yr+=style.port_h;
		}else{
			yl+=dyl;
			cache_item.m_rects.push({
				dx:xl,dy:yl,
				w:wl,h:style.port_h,
				round:style.port_round,
				color:port_i.color||style.port_color,
				port_ref:port_i,
			});
			cache_item.m_regions.push({
				dx:xl,dy:yl,
				w:wl,h:style.port_h,
				name:[ndi.__id__,'port',port_i.id].join('_'),
				nd:ndi,port:port_i.id,dir:port_i.dir,
				pdx:pxl,pdy:yl+style.port_h*0.5,
				color:port_i.color||style.port_color,
				port_ref:port_i,
				proto:rproto_port,
			})
			endpoints[name]={dx:xl,dy:yl+style.port_h*0.5};
			cache_item.m_texts.push({
				dx:xl+(wl-UI.MeasureText(style.font_port,name).w-style.port_padding),dy:yl+port_padding_y,
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

/*
graph: persistent data
cache: transient data
*/
W.graphview_prototype={
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
		if(best_eid==undefined){
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
				var ndi_x0=cache_item.m_rects[1].x;
				var ndi_y0=cache_item.m_rects[1].y;
				var ndi_x1=cache_item.m_rects[1].x+cache_item.m_rects[1].w;
				var ndi_y1=cache_item.m_rects[1].y+cache_item.m_rects[1].h;
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
		var dot_cache={};
		var port_name_map={};
		var CreateDot=function(nd,port,side){
			var skey=nd.__id__+'='+port;
			var nd_dot=dot_cache[skey];
			if(nd_dot){return nd_dot;}
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
			//create an outer port
			var ndcls=UI.GetNodeClass(cache,nd.m_class);
			var port_inner=ndcls.m_port_map[port];
			var port_outer=JSON.parse(JSON.stringify(port_inner));
			var cnt=0;
			while(port_name_map[port_outer.id]){
				cnt++;
				port_outer.id=port_inner.id+cnt.toString();
			}
			port_name_map[port_outer.id]=1;
			gr_ports.push(port_outer);
			nd_dot.m_port_outer_id=port_outer.id
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
		//pick the group nodes
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
					gr_reconnects.push({
						//id0:nd_dot.__id__,port0:"out",
						id1:e.id1,port1:e.port1,
						port_outer:nd_dot.m_port_outer_id,
						id_inner:nd_dot.__id__,
					})
				}
			}else{
				if(nds[v1].m_is_selected){
					//input edge: create dot, dot edge, record port
					var nd_dot=CreateDot(nds[v1],e.port1,'out');
					gr_reconnects.push({
						id0:e.id0,port0:e.port0,
						//id1:nd_dot.__id__,port1:"in",
						port_outer:nd_dot.m_port_outer_id,
						id_inner:nd_dot.__id__,
					})
				}else{
					//unrelated edge
					//do nothing
				}
			}
		}
		var ndcls={
			m_graph:gr,
			m_reconnects:gr_reconnects,
			m_ports:gr_ports,
		};
		ndcls.m_port_map={};
		for(var i=0;i<ndcls.m_ports.length;i++){
			var port_i=ndcls.m_ports[i];
			ndcls.m_port_map[port_i.id]=port_i;
		}
		var nd_group=this.graph.CreateNode('group');
		nd_group.m_caption=group_name;
		nd_group.m_class=ndcls;
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
		nd_group.m_x0=nd_group.x;
		nd_group.m_y0=nd_group.y;
		//var nd_rebuilds=[nd_group];
		for(var i=0;i<gr_reconnects.length;i++){
			var cni=gr_reconnects[i];
			if(cni.id0){
				es.push({
					id0:cni.id0,port0:cni.port0,
					id1:nd_group.__id__,port1:cni.port_outer,
				})
			}else{
				es.push({
					id0:nd_group.__id__,port0:cni.port_outer,
					id1:cni.id1,port1:cni.port1,
				})
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
};
W.GraphView=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"graph_view",W.graphview_prototype);
	var graph=obj.graph;
	var cache=obj.cache;
	if(!cache){
		cache={
			nds:{},
			m_classes_by_name:{},
			m_undo_queue:[JSON.stringify(graph)],
			m_redo_queue:[],
			search_paths:[UI.m_node_dir,UI.GetPathFromFilename(obj.m_file_name)+'/znodes'],
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
	var big_param_panel=[];
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
			if(i!=1&&is_faded){item_i.color&=fade_mask;}
			UI.RoundRect(item_i);
			item_i.color|=0xff000000;
			if(i==1){
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
				if(ndi.m_need_rebuild){
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
		//create UI panel
		if(ndi.m_is_selected&&cache_item.m_param_panel.length>0){
			big_param_panel.push({caption:ndi.m_caption});
			for(var i=0;i<cache_item.m_param_panel.length;i++){
				big_param_panel.push(cache_item.m_param_panel[i]);
			}
		}
	}
	obj.m_big_param_panel=big_param_panel;
	if(big_param_panel.length){
		UI.OpenUtilTab("param_panel","quiet");
	}
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
		//todo: AC, OnChange explanation
		var x_caret=obj.m_temp_ui_desc.x;
		var y_caret=obj.m_temp_ui_desc.y;
		var style_edit=obj.edit_style;
		var hc=UI.GetCharacterHeight(style_edit.font_edit)+8;
		UI.RoundRect({
			x:x_caret-style_edit.edit_padding-style_edit.edit_border_width,y:y_caret,
			w:style_edit.edit_w+(style_edit.edit_padding+style_edit.edit_border_width)*2+style_edit.edit_shadow_size,h:hc+style_edit.edit_shadow_size,
			color:style_edit.edit_shadow_color,border_width:-style_edit.edit_shadow_size,
			round:style_edit.edit_shadow_size,
		})
		UI.RoundRect({
			x:x_caret-style_edit.edit_padding-style_edit.edit_border_width,y:y_caret,w:style_edit.edit_w+(style_edit.edit_padding+style_edit.edit_border_width)*2,h:hc,
			color:style_edit.edit_bgcolor,border_width:style_edit.edit_border_width,border_color:style_edit.edit_border_color,
			round:style_edit.edit_round,
		})
		var hc_editing=UI.GetCharacterHeight(style_edit.font_edit);
		RenderTempEditor("newnode_edit",{
			x:x_caret-style_edit.edit_padding,y:y_caret+(hc-hc_editing)*0.5,
			w:style_edit.edit_w+style_edit.edit_padding*2,h:hc_editing,
			font:style_edit.font_edit,
			OnEnter:function(){
				//actually create the node, invalid class is fine - could just delete it later, or create the class
				var obj=this.owner;
				var graph=obj.graph;
				var cache=obj.cache;
				var stext_raw=this.ed.GetText();
				if(stext_raw.indexOf('.')>=0){
					//it's a file! a new class!
					//create the file in znodes/
					var sdir=UI.GetPathFromFilename(obj.m_file_name)+'/znodes'
					IO.CreateDirectory(sdir)
					if(!IO.DirExists(sdir)){
						stext_raw=UI._('Unable to create the znodes directory');
					}else{
						UI.OpenEditorWindow(sdir+'/'+stext_raw);
						//we still need the node
						stext_raw=UI.RemoveExtension(stext_raw);
					}
				}
				var nd_new=graph.CreateNode(stext_raw);
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
				var ndcls_new=UI.GetNodeClass(cache,nd_new.m_class);
				if(ndcls_new&&ndcls_new.m_ports){
					var al_x_max=-1e10,al_y_avg=0,al_n=0;
					for(var pi=0;pi<ndcls_new.m_ports.length;pi++){
						var port_pi=ndcls_new.m_ports[pi];
						if(port_pi.dir!='output'){continue;}
						var type_ordering={};
						for(var i=0;i<port_pi.type.length;i++){
							type_ordering[port_pi.type[i]]=i+1;
						}
						var type_key_best=1e9;
						var port_best=undefined;
						for(var i=0;i<graph.nds.length;i++){
							var ndi=graph.nds[i];
							var ndcls=UI.GetNodeClass(cache,ndi.m_class);
							var type_key=1e10;
							var id_best=undefined;
							for(var j=0;j<ndcls.m_ports.length;j++){
								var port_j=ndcls.m_ports[j];
								var type_j=port_j.type;
								if(port_j.dir!='input'){continue;}
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
							graph.es.push({
								id0:nd_new.__id__, port0:port_pi.id,
								id1:port_best.nd.__id__, port1:port_best.port,
							})
							var cache_item=UI.GetNodeCache(cache,port_best.nd);
							al_x_max=Math.max(al_x_max,port_best.nd.x+cache_item.m_w);
							al_y_avg+=port_best.nd.y;
							al_n++;
						}
					}
				}
				if(al_n){
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
			}
		});
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
	if(nd_sel.length>0){
		menu_edit.AddSeparator();
		menu_edit.AddNormalItem({text:"&Group",enable_hotkey:UI.nd_focus==obj,key:"CTRL+G",action:function(){
			this.Group()
		}.bind(obj)})
		menu_edit.AddNormalItem({text:"Ungroup",enable_hotkey:UI.nd_focus==obj,key:"CTRL+U",action:function(){
			var ret=Ungroup(this.graph.nds,this.graph.es, this.graph.nds.filter(function(ndi){
				return isGroup(ndi)&&ndi.m_is_selected;
			}),1)
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
	menu_edit=undefined;
	var menu_run=UI.BigMenu("&Run")
	menu_run.AddNormalItem({
		text:"Build &graph",key:"CTRL+B",
		enable_hotkey:1,action:function(){
			var sdir=UI.GetPathFromFilename(obj.m_file_name)+'/../build'
			IO.CreateDirectory(sdir)
			this.graph.Build(sdir,this.cache,0)
		}.bind(obj)})
	menu_run.AddNormalItem({
		text:"R&ebuild graph",key:"CTRL+SHIFT+B",
		enable_hotkey:1,action:function(){
			var sdir=UI.GetPathFromFilename(obj.m_file_name)+'/../build'
			IO.CreateDirectory(sdir)
			this.graph.Build(sdir,this.cache,1)
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
		var style=UI.default_styles.graph_param_panel.ui_style;
		var id0=this.nd.__id__+'='+this.port;
		W.EditBox(id0,{
			x:x,y:y+4,w:w,h:h-8,font:style.font_widgets,
			value:this.nd.m_ui_values[this.port],
			OnChange:function(value){
				this.nd.m_ui_values[this.port]=value;
				obj_gview.graph.SignalEdit([this.nd]);
				UI.Refresh();
			}.bind(this)
		});
	},
};
W.ParamPanelPage=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"graph_param_panel",W.graphview_prototype);
	if(!obj.graphview){
		return obj;
	}
	var big_param_panel=obj.graphview.m_big_param_panel;
	if(!big_param_panel||!big_param_panel.length){
		W.Text("",{
			x:0,y:0,anchor:obj,anchor_align:"center",anchor_valign:"center",
			font:obj.message_style.font,text:UI._("No parameters available"),
			color:obj.message_style.text_color,
		})
		return obj;
	}
	UI.Begin(obj)
		var y_current=obj.y;
		var style=obj.ui_style;
		var dy_label=(style.spacing_widget-UI.GetCharacterHeight(style.font_label))*0.5;
		for(var i=0;i<big_param_panel.length;i++){
			var item_i=big_param_panel[i];
			if(item_i.caption!=undefined){
				//caption
				if(i){
					y_current+=style.spacing_node;
				}
				var dim=UI.MeasureText(style.font_caption,item_i.caption);
				UI.RoundRect({x:obj.x+8,y:y_current+(dim.h-2)*0.5,w:obj.w-16,h:2,color:style.caption_color})
				UI.RoundRect({x:obj.x+30,y:y_current+(dim.h-8)*0.5,w:dim.w+8,h:8,color:obj.color})
				W.Text("",{x:obj.x+34,y:y_current,font:style.font_caption,text:item_i.caption,color:style.caption_color});
				y_current+=style.spacing_caption;
			}else if(item_i.ui){
				var dim=W.Text("",{x:obj.x+16,y:y_current+dy_label,font:style.font_label,text:item_i.name,color:style.widget_color});
				var fwidget=g_panel_ui_widgets[item_i.ui[0].toLowerCase()];
				if(fwidget){
					fwidget.call(item_i,obj.graphview, obj.x+16+dim.w+8,y_current,obj.w-24-dim.w-16,style.spacing_widget);
				}
				y_current+=style.spacing_widget;
			}
		}
	UI.End()
	return obj;
};

UI.RegisterUtilType("param_panel",function(){return UI.NewTab({
	title:UI._("Parameters"),
	area_name:"h_tools",
	body:function(){
		//frontmost doc
		UI.context_parent.body=this.util_widget;
		var tab_frontmost=UI.GetFrontMostEditorTab();
		var obj_real=(tab_frontmost&&tab_frontmost.document_type=="graph"&&tab_frontmost.main_widget);
		var body=W.ParamPanelPage('body',{
			'anchor':'parent','anchor_align':'fill','anchor_valign':'fill',
			'graphview':obj_real,
			'activated':this==UI.top.app.document_area.active_tab,
			'x':0,'y':0,
		});
		this.util_widget=body;
		if(!obj_real){
			UI.m_invalid_util_tabs.push(this.__global_tab_id);
		}
		return body;
	},
	Save:function(){},
	SaveMetaData:function(){},
	OnDestroy:function(){},
})});

UI.g_ce_save_time=0;
UI.g_ce_file_save_time={};
UI.OnCodeEditorSave=function(fn){
	UI.g_ce_file_save_time[fn]=++UI.g_ce_save_time;
};
