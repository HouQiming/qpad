var UI=require("gui2d/ui");
var W=require("gui2d/widgets");

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

var LoadClasses=function(){
	var find_context=IO.CreateEnumFileContext(UI.m_node_dir+"/*",5)
	UI.m_nd_classes=[];
	UI.m_classes_by_name={};
	UI.m_is_loading_classes=1;
	var enumClasses=function(){
		for(var i=0;i<32;i++){
			var fnext=find_context();
			if(!fnext){
				find_context=undefined;
				UI.m_is_loading_classes=0;
				UI.Refresh();
				return;
			}
			//var sname=fnext.name.slice(UI.m_node_dir.length+1).replace(/[/]/g,'.').toLowerCase();
			var sname=fnext.name.slice(UI.m_node_dir.length+1).toLowerCase();
			var obj_class_holder={name:sname,file:fnext.name};
			UI.m_nd_classes.push(obj_class_holder);
			UI.m_classes_by_name[sname]=obj_class_holder;
		}
		UI.NextTick(enumClasses);
	}
	enumClasses();
};
LoadClasses();

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

UI.GetNodeClass=function(sname){
	var holder=UI.m_classes_by_name[sname];
	if(!holder){return undefined;}
	if(holder.obj){return holder.obj;}
	holder.obj=UI.ParseNode(UI.ReadFile(holder.file));
	holder.obj.m_name=GetMainFileName(holder.name);
	return holder.obj;
};

//////////////////////////
//the graph class
var g_per_run_id=0;
var graph_prototype={
	CreateNode:function(class_name){
		var ret={
			__id__:[g_developer.email, (new Date()).toUTCString(), g_per_run_id++].join("&"),
			m_renamed_ports:{},
			m_class:class_name,
			m_caption:GetMainFileName(class_name),
		}
		this.nds.push(ret);
		return ret;
	},
	Save:function(fn){
		return UI.CreateFile(fn,JSON.stringify(this,null,1));
	},
	SelectionClear:function(){
		for(var i=0;i<this.nds.length;i++){
			this.nds[i].m_is_selected=0;
		}
	},
	DeleteSelection:function(){
		this.nds=this.nds.filter(function(ndi){return !ndi.m_is_selected;})
		var is_valid={};
		for(var i=0;i<this.nds.length;i++){
			is_valid[this.nds[i].__id__]=1;
		}
		this.es=this.es.filter(function(edgei){return is_valid[edgei.id0]&&is_valid[edgei.id1];})
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
		//select
		UI.SetFocus(this.owner);UI.Refresh();
		if(!(UI.IsPressed("LSHIFT")||UI.IsPressed("RSHIFT")||UI.IsPressed("LCTRL")||UI.IsPressed("RCTRL"))){
			this.graph.SelectionClear();
		}
		this.nd.m_is_selected=!this.nd.m_is_selected;
		UI.Refresh();
		///////////////////////////
		this.m_drag_ctx={x:event.x,y:event.y, base_x:this.nd.x,base_y:this.nd.y};
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.m_drag_ctx){return;}
		var ndi=this.nd;
		ndi.x=this.m_drag_ctx.base_x+ (event.x-this.m_drag_ctx.x);
		ndi.y=this.m_drag_ctx.base_y+ (event.y-this.m_drag_ctx.y);
		UI.Refresh();
	},
	OnMouseUp:function(event){
		this.OnMouseMove(event);
		if(this.m_drag_ctx){
			this.m_drag_distance=PointDist(event,this.m_drag_ctx);
		}
		this.m_drag_ctx=undefined;
		UI.ReleaseMouse(this);
	},
	OnClick:function(event){
		if((this.m_drag_distance||0)>8){return;}
		if(event.clicks>=2){
			//param pane / edit node file / edit caption
			//todo: module system overhaul
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
			if(best_dist2>dist2){
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
				this.owner.graph.es.push({
					id0:v0.region.nd.__id__, port0:v0.region.port,
					id1:v1.region.nd.__id__, port1:v1.region.port,
				})
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
	//todo: cache.search_paths, cache the class
	var ndcls=UI.GetNodeClass(ndi.m_class);
	if(!ndcls){
		//assume empty class when rendering before it's loaded, do not cache the result
		cache[ndi.__id__]=undefined;
		ndcls={m_ports:[]};
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
	var w_final=Math.max(dims.w+style.caption_padding*2, (wl-style.port_extrude)+(wr-style.port_extrude)+style.port_w_sep);
	var h_final=style.caption_h+Math.max(nl,nr)*(style.port_h+style.port_h_sep)+style.port_h_sep;
	cache_item.m_rects=[];
	cache_item.m_texts=[];
	cache_item.m_regions=[];
	cache_item.m_w=w_final;
	cache_item.m_h=h_final;
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
		dx:style.caption_padding,dy:(style.caption_h-UI.GetCharacterHeight(style.font_caption))*0.5,
		font:style.font_caption,text:ndi.m_caption,color:style.caption_text_color
	});
	//multi-connect case - use node y for ordering with edge dragging
	//if one really needs it, one could use helper boards
	var xl=-style.port_extrude,xr=w_final+style.port_extrude-wr,
		pxl=-0.5*style.port_extrude,pxr=w_final+0.5*style.port_extrude,
		yl=style.caption_h,yr=style.caption_h, 
		dyl=(h_final-yl-style.port_h*nl)/(nl+1),
		dyr=(h_final-yr-style.port_h*nr)/(nr+1);
	var port_padding_y=(style.port_h-UI.GetCharacterHeight(style.font_port))*0.5;
	var endpoints={};
	cache_item.m_endpoints=endpoints;
	for(var i=0;i<ndcls.m_ports.length;i++){
		var port_i=ndcls.m_ports[i];
		var name=(ndi.m_renamed_ports[port_i.id]||port_i.id);
		var side=(port_i.side||port_i.dir=="input"?"R":"L");
		if(side=="R"){
			yr+=dyr;
			cache_item.m_rects.push({
				dx:xr,dy:yr,
				w:wr,h:style.port_h,
				round:style.port_round,
				color:port_i.color||style.port_color,
			});
			cache_item.m_regions.push({
				dx:xr,dy:yr,
				w:wr,h:style.port_h,
				name:[ndi.__id__,'port',port_i.id].join('_'),
				nd:ndi,port:port_i.id,
				pdx:pxr,pdy:yr+style.port_h*0.5,
				proto:rproto_port,
			})
			endpoints[name]={dx:xr+wr,dy:yr+style.port_h*0.5};
			cache_item.m_texts.push({
				dx:xr+style.port_padding,dy:yr+port_padding_y,
				font:style.font_port,text:name,color:style.port_text_color
			});
			yr+=style.port_h;
		}else{
			yl+=dyl;
			cache_item.m_rects.push({
				dx:xl,dy:yl,
				w:wr,h:style.port_h,
				round:style.port_round,
				color:port_i.color||style.port_color,
			});
			cache_item.m_regions.push({
				dx:xl,dy:yl,
				w:wr,h:style.port_h,
				name:[ndi.__id__,'port',port_i.id].join('_'),
				nd:ndi,port:port_i.id,
				pdx:pxl,pdy:yl+style.port_h*0.5,
				proto:rproto_port,
			})
			endpoints[name]={dx:xl,dy:yl+style.port_h*0.5};
			cache_item.m_texts.push({
				dx:xl+style.port_padding+(wl-UI.MeasureText(style.font_port,name).w),dy:yl+port_padding_y,
				font:style.font_port,text:name,color:style.port_text_color
			});
			yl+=style.port_h;
		}
	}
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
			//todo: drag-sel
			this.m_drag_ctx={x:event.x,y:event.y, tr:JSON.parse(JSON.stringify(this.graph.tr))};
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
				this.m_drag_ctx={x:event.x,y:event.y, tr:JSON.parse(JSON.stringify(this.graph.tr))};
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
		var ndi=this.nd;
		this.graph.tr.trans[0]=this.m_drag_ctx.tr.trans[0]+ (event.x-this.m_drag_ctx.x);
		this.graph.tr.trans[1]=this.m_drag_ctx.tr.trans[1]+ (event.y-this.m_drag_ctx.y);
		UI.Refresh();
	},
	OnMouseUp:function(event){
		if(!this.m_drag_ctx){return;}
		this.m_drag_ctx=undefined;
		UI.ReleaseMouse(this);
	},
	OnMouseWheel:function(event){
		var mx_world=(UI.m_absolute_mouse_position.x-this.graph.tr.trans[0])/this.graph.tr.scale;
		var my_world=(UI.m_absolute_mouse_position.y-this.graph.tr.trans[1])/this.graph.tr.scale;
		var log_scale=Math.log(this.graph.tr.scale);
		log_scale+=event.y*0.1;
		this.graph.tr.scale=(Math.exp(log_scale)||1);
		this.graph.tr.trans[0]=UI.m_absolute_mouse_position.x-mx_world*this.graph.tr.scale;
		this.graph.tr.trans[1]=UI.m_absolute_mouse_position.y-my_world*this.graph.tr.scale;
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
				this.m_temp_ui_desc={x:UI.m_absolute_mouse_position.x,y:UI.m_absolute_mouse_position.y};
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
		this.need_save=0;
	},
	SaveMetaData:function(){
		//nothing - all metadata are saved in the main file for now
	},
	Reload:function(){
		//todo
	},
};
W.GraphView=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"graph_view",W.graphview_prototype);
	var graph=obj.graph;
	var cache=obj.cache;
	if(!cache){
		cache={
			nds:{},
			search_paths:[UI.m_node_dir],
		};
		//todo: obj.m_file_name
		obj.cache=cache;
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
	//render the nodes
	for(var ni=0;ni<graph.nds.length;ni++){
		var ndi=graph.nds[ni];
		var x=ndi.x+tr.trans[0]/tr.scale;
		var y=ndi.y+tr.trans[1]/tr.scale;
		var cache_item=UI.GetNodeCache(cache,ndi);
		for(var i=0;i<cache_item.m_rects.length;i++){
			var item_i=cache_item.m_rects[i];
			item_i.x=x+item_i.dx;
			item_i.y=y+item_i.dy;
			UI.RoundRect(item_i);
			if(!i&&ndi.m_is_selected){
				//render selection
				item_i.x=x+item_i.dx;
				item_i.y=y+item_i.dy;
				UI.RoundRect({
					x:item_i.x,y:item_i.y,w:item_i.w,h:item_i.h,round:item_i.round,
					border_color:obj.node_style.port_selection_color,border_width:obj.node_style.port_selection_width,
					color:0,
				});
			}
		}
		for(var i=0;i<cache_item.m_texts.length;i++){
			var item_i=cache_item.m_texts[i];
			item_i.x=x+item_i.dx;
			item_i.y=y+item_i.dy;
			W.Text('',item_i);
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
		UI.RenderEdge(pos0.x,pos0.y,pos1.x,pos1.y,obj.edge_style.line_width);
		obj.m_proxy_edges.push({line:[pos0.x,pos0.y,pos1.x,pos1.y],eid:ei})
	}
	UI.GLWidget(function(){
		UI.FlushEdges(obj.edge_style.color);
		if(obj.m_temp_ui=="edge"){
			//rendering edges
			var pos0=obj.m_temp_ui_desc.v0;
			var pos1=obj.m_temp_ui_desc.v1;
			pos0.x=pos0.region.x-pos0.region.dx+pos0.region.pdx;
			pos0.y=pos0.region.y-pos0.region.dy+pos0.region.pdy;
			if(pos1){
				UI.RenderEdge(pos0.x*tr.scale,pos0.y*tr.scale,pos1.x*tr.scale,pos1.y*tr.scale,obj.edge_style.line_width*tr.scale);
				UI.FlushEdges((pos1.region?0xffffffff:0x55ffffff)&obj.edge_style.color);
			}
		}
	});
	UI.PopSubWindow()
	////////////
	//render the temp UI - add-node edit
	//it shouldn't be scaled
	if(obj.m_temp_ui=="add_node"){
		//put it near the mouse
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
		var obj_prev=obj.newnode_edit;
		//todo: AC
		W.Edit("newnode_edit",{
			x:x_caret-style_edit.edit_padding,y:y_caret+(hc-hc_editing)*0.5,
			w:style_edit.edit_w+style_edit.edit_padding*2,h:hc_editing,
			font:style_edit.font_edit,
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
			OnEnter:function(){
				//actually create the node, invalid class is fine - could just delete it later, or create the class
				var obj=this.owner;
				var graph=obj.graph;
				var cache=obj.cache;
				var stext_raw=this.ed.GetText();
				var nd_new=graph.CreateNode(stext_raw);
				//todo: auto-connect
				//todo: connection-based auto-layout
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
				obj.m_temp_ui=undefined;
				UI.Refresh()
			},
		});
		if(!obj_prev){
			UI.SetFocus(obj.newnode_edit);
			UI.Refresh();
		}
	}else if(obj.m_temp_ui=="rename_port"){
		var rg_port=obj.m_temp_ui_desc.region;
		//todo
	}
	W.Hotkey("",{key:"CTRL+S",action:function(){
		this.Save();
	}.bind(this)});
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
			if(!is_quiet){UI.top.app.document_area.SetTab(i)}
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
				this.need_save=this.main_widget.need_save;
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
				//'default_focus':1,
			};
			if(!this.main_widget){
				attrs.graph=UI.LoadGraph(this.file_name);
				if(!attrs.graph){
					attrs.graph=UI.CreateGraph();
				}
			}
			var body=W.GraphView("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
				body.m_file_name=this.file_name;
			}
			this.need_save=this.main_widget.need_save;
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
			this.need_save=this.main_widget.need_save;
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(1,"zg",
				this.main_widget.file_name.indexOf('<')>=0?
					UI.m_new_document_search_path:
					UI.GetPathFromFilename(this.main_widget.file_name));
			if(!fn){return;}
			this.file_name=fn
			this.main_widget.m_file_name=fn
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
