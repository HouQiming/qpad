var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");
require("res/lib/code_editor");

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
				//this.owner.graph.SignalEdit([this.nd]);
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
		//if(event.clicks>=2){
		//	UI.SetSelectionEx(this.owner.doc,this.epos0,this.epos1,"port_click")
		//}
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
			if(best_dist2>dist2&&proxies[i].region.dir!=this.dir&&proxies[i].region.nd!=this.nd){
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
	OnClick:function(event){
		if(event.clicks>=2){
			UI.SetSelectionEx(this.owner.editor,this.port_ref.loc0.ccnt,this.port_ref.loc1.ccnt,"port_click")
		}
	},
	OnRender:function(){
		//maintain port list
		this.owner.m_proxy_ports.push({x:this.x-this.dx+this.pdx,y:this.y-this.dy+this.pdy,region:this})
	},
};
var PreprocessNode=function(ndi){
	var style=UI.default_styles.graph_view.node_style;
	var wr=style.port_w_min,wl=style.port_w_min, nr=0,nl=0;
	ndi.m_ports=[];
	for(var i=0;i<ndi.in_ports.length;i++){
		var port=ndi.in_ports[i];
		var name=port.id;
		port.dir="input";
		ndi.m_ports.push(port);
		var dims=UI.MeasureText(style.font_port,name);
		var w_port=dims.w+style.port_padding*2;
		wr=Math.max(wr,w_port);
		nr++;
	}
	for(var i=0;i<ndi.out_ports.length;i++){
		var port=ndi.out_ports[i];
		var name=port.id;
		port.dir="output";
		ndi.m_ports.push(port);
		var dims=UI.MeasureText(style.font_port,name);
		var w_port=dims.w+style.port_padding*2;
		wl=Math.max(wl,w_port);
		nl++;
	}
	var s_caption=ndi.name;
	var s_desc='';
	var pcolon=s_caption.indexOf(': ');
	if(pcolon>=0){
		s_desc=s_caption.substr(pcolon+2);
		s_caption=s_caption.substr(0,pcolon);
	}
	var dims=UI.MeasureText(style.font_caption,s_caption);
	var h_caption=style.caption_h;
	var h_desc=style.caption_h_desc;
	if(s_desc){
		dims.w=Math.max(dims.w,UI.MeasureText(style.font_desc,s_desc).w);
	}else{
		h_desc=0;
	}
	var w_final=Math.max(dims.w+style.caption_padding*2, (wl-style.port_extrude)+(wr-style.port_extrude)+style.port_w_sep);
	var h_final=h_caption+h_desc+Math.max(nl,nr)*(style.port_h+style.port_h_sep)+style.port_h_sep;
	ndi.m_rects=[];
	ndi.m_texts=[];
	ndi.m_regions=[];
	ndi.m_param_widgets=[];
	//ndi.m_param_panel=[];
	ndi.m_w=w_final;
	ndi.m_h=h_final;
	var color_node=style.node_color_default;
	if(ndi.__id__=="<root>"){
		color_node=style.node_color_private;
	}
	//coulddo: colors
	//if(ndcls.m_file_name&&ndi.m_class!='__dot__'){
	//	if(UI.GetPathFromFilename(ndcls.m_file_name)==cache.m_file_dir){
	//		color_node=style.node_color_private;
	//	}else{
	//		color_node=style.node_color_pack_priv;
	//	}
	//}
	ndi.m_rects.push({
		dx:0,dy:0,
		w:w_final,h:h_final,
		round:style.node_round,
		color:color_node,
		border_color:style.node_border_color,
		border_width:style.node_border_width,
	});
	ndi.m_regions.push({
		dx:0,dy:0,
		w:w_final,h:h_final,
		name:[ndi.__id__,'node'].join('_'),
		nd:ndi,
		proto:rproto_node,
	})
	var y_caption=0;
	ndi.m_texts.push({
		dx:style.caption_padding,dy:(h_caption-UI.GetCharacterHeight(style.font_caption))*0.5,
		font:style.font_caption,text:s_caption,color:style.caption_text_color
	});
	y_caption+=h_caption;
	if(s_desc){
		//render node description
		ndi.m_texts.push({
			dx:style.caption_padding,dy:y_caption+(h_desc-UI.GetCharacterHeight(style.font_desc))*0.5,
			font:style.font_desc,text:s_desc,color:style.caption_desc_color
		});
		y_caption+=h_desc;
	}
	//multi-connect case - use node y for ordering with edge dragging
	//if one really needs it, one could use helper boards
	//generate editor UI
	var xl=-style.port_extrude,xr=w_final+style.port_extrude-wr,
		pxl=-0.5*style.port_extrude,pxr=w_final+0.5*style.port_extrude,
		yl=y_caption,yr=y_caption,
		dyl=(h_final-yl-style.port_h*nl)/(nl+1),
		dyr=(h_final-yr-style.port_h*nr)/(nr+1);
	var port_padding_y=(style.port_h-UI.GetCharacterHeight(style.font_port))*0.5;
	var endpoints={};
	ndi.m_endpoints=endpoints;
	for(var i=0;i<ndi.m_ports.length;i++){
		var port_i=ndi.m_ports[i];
		var name=port_i.id;
		var side=((port_i.dir=="input"?"R":"L"));
		var port_color=UI.default_styles.graph_view.node_style.port_color;
		var dims=UI.MeasureText(style.font_port,name);
		if(side=="R"){
			yr+=dyr;
			ndi.m_rects.push({
				dx:xr+wr-(dims.w+style.port_padding*2),dy:yr,
				w:(dims.w+style.port_padding*2),h:style.port_h,
				round:style.port_round,
				color:port_color,
				port_ref:port_i,
			});
			ndi.m_regions.push({
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
			ndi.m_texts.push({
				dx:xr+wr-(dims.w+style.port_padding*2)+style.port_padding,dy:yr+port_padding_y,
				font:style.font_port,text:name,color:style.port_text_color,
				port_ref:port_i,
			});
			yr+=style.port_h;
		}else{
			yl+=dyl;
			ndi.m_rects.push({
				dx:xl,dy:yl,
				w:(dims.w+style.port_padding*2),h:style.port_h,
				round:style.port_round,
				color:port_color,
				port_ref:port_i,
			});
			ndi.m_regions.push({
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
			ndi.m_texts.push({
				dx:xl+style.port_padding,dy:yl+port_padding_y,
				font:style.font_port,text:name,color:style.port_text_color,
				port_ref:port_i,
			});
			yl+=style.port_h;
		}
	}
};
var UpdateGraph=function(nds,es){
	var style=UI.default_styles.graph_view.node_style;
	//automatic layout - nested level for x
	var node_map={},port_maps=[],degs=[],es_topo=[],es_gather=[];
	var n=nds.length,m=es.length;
	for(var i=0;i<n;i++){
		node_map[nds[i].__id__]=i;
		degs[i]=0;
		es_topo[i]=[];
		es_gather[i]=[];
		port_maps[i]={};
		for(var j=0;j<nds[i].m_ports.length;j++){
			var port=nds[i].m_ports[j];
			port_maps[i][port.id]=j;
		}
	}
	for(var i=0;i<m;i++){
		var e=es[i];
		var v0=node_map[e.id0];
		var v1=node_map[e.id1];
		if(v0==undefined||v1==undefined){continue;}
		es_topo[v0].push(v1);
		es_gather[v1].push({v0:v0,port0:port_maps[v0][e.port0],port1:port_maps[v1][e.port1]});
		//console.log(JSON.stringify(e),JSON.stringify({v0:v0,port0:port_maps[v0][e.port0],port1:port_maps[v1][e.port1]}));
		degs[v1]++;
	}
	var Q=[],head=0,tail=0,depth=style.node_padding,w_max=0;
	for(var i=0;i<n;i++){
		if(degs[i]==0){
			Q.push(i);
		}
	}
	while(head<Q.length){
		if(head>=tail){
			depth+=w_max+style.node_padding*4;
			tail=Q.length;
		}
		var v0=Q[head];
		nds[v0].x=depth;
		w_max=Math.max(w_max,nds[v0].m_w);
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
		console.log('panic: bad graph');
	}
	////////////////
	//compute combined annotations at slots - slot-part correspondences
	for(var i=0;i<Q.length;i++){
		var v1=Q[i];
		var ndi=nds[v1];
		var esi=es_gather[v1];
		for(var j=0;j<esi.length;j++){
			//others->port inheritance
			var e=esi[j];
			var ndv0=nds[e.v0];
			var final_annotations=ndv0.m_ports[e.port0].final_annotations;
			var port1=ndi.m_ports[e.port1];
			//console.log(JSON.stringify(e),ndi.__id__,ndi.m_ports.length,v1,JSON.stringify(Q),JSON.stringify(node_map));
			if(!port1.final_annotations){
				port1.final_annotations={};
			}
			if(final_annotations){
				port1.final_annotations.__proto__=final_annotations;
			}
		}
		if(ndi.__id__!="<root>"){
			var params=ndi.params;
			for(var j=0;j<ndi.in_ports.length;j++){
				//flatten the annotations at this slot
				var obj_out={};
				//port->slot inheritance
				var port_j=ndi.in_ports[j];
				var obj0=ndi.out_ports[port_j.part_id].final_annotations;
				for(var k in obj0){
					obj_out[k]=obj0[k];
				}
				//combo params
				for(var k in params){
					obj_out[k]=params[k];
				}
				//slot annotations
				var obj1=port_j.annotations;
				for(var k in obj1){
					obj_out[k]=obj1[k];
				}
				port_j.final_annotations=obj_out;
			}
		}
	}
	////////////////
	//automatic layout - sort by ccnt for y
	//this invalidates all the graph structures above!
	var y_currents={};
	nds.sort(function(a,b){return a.epos_part0-b.epos_part0;})
	for(var i=0;i<nds.length;i++){
		var key_x=(nds[i].x|0);
		var y_current=(y_currents[key_x]||style.node_padding);
		nds[i].y=y_current;
		y_currents[key_x]=y_current+nds[i].m_h+style.node_padding;
	}
	////////////////////////////////
	//search available combos
	var all_combos=UI.ED_GetAllComboNames();
	var available=[];
	var all_ports=[];
	for(var i=0;i<nds.length;i++){
		var ndi=nds[i];
		for(var j=0;j<ndi.in_ports.length;j++){
			all_ports.push(ndi.in_ports[j])
		}
	}
	for(var i=0;i<all_combos.length;i++){
		var nd_combo=UI.ED_CreateComboNode(all_combos[i]);
		var is_available=1;
		var score=0;
		for(var j=0;j<nd_combo.out_ports.length;j++){
			var annotations=nd_combo.out_ports[j].annotations;
			if(!annotations){continue;}
			var got_port=0;
			for(var j2=0;j2<all_ports.length;j2++){
				if(canConnect(all_ports[j2],annotations)){
					got_port=1;
					break;
				}
			}
			if(!got_port){
				is_available=0;
				break;
			}
		}
		if(is_available){
			available.push({name:nd_combo.name,desc:nd_combo.desc,score:score})
		}
	}
	available.sort(function(a,b){
		var dscore=b.score-a.score;
		if(dscore){return dscore;}
		return (a.name<b.name?-1:(a.name>b.name?1:0));
	})
	return available;
};
UI.BuildComboGraph=function(doc,parsed_combos){
	var nds=parsed_combos.matched;
	var es=parsed_combos.edges;
	nds.push({__id__:"<root>",
		name:UI.GetSmartTabName(doc.m_file_name),
		in_ports:parsed_combos.root_slots,
		out_ports:[],params:[],epos_part0:0})
	//layout individual nodes
	for(var ni=0;ni<nds.length;ni++){
		var ndi=nds[ni];
		PreprocessNode(ndi);
		for(var pi=0;pi<ndi.m_ports.length;pi++){
			var port=ndi.m_ports[pi];
			port.loc0=doc.ed.CreateLocator(port.epos0,-1);
			port.loc1=doc.ed.CreateLocator(port.epos1,1);
		}
	}
	var available=UpdateGraph(nds,es);
	////////////////
	var ret={nds:nds,es:es,available:available};
	ret.__proto__=graph_prototype;
	return ret;
};
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
				//if(PointDist(event_edge,pos0)<PointDist(event_edge,pos1)){
				//	side=0;
				//}else{
				//	side=1;
				//}
				//todo: auto-reconnect on not-reconnected mouseup
				//delete edge and trigger dragging on the *opposite* end
				var rg_trigger=(1-side)==0?pos0.region:pos1.region;
				this.graph.es[best_eid]=this.graph.es[this.graph.es.length-1]
				this.graph.es.pop();
				//this.graph.SignalEdit([pos1.region.nd]);
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
				var ndi_x0=ndi.m_rects[0].x;
				var ndi_y0=ndi.m_rects[0].y;
				var ndi_x1=ndi.m_rects[0].x+ndi.m_rects[0].w;
				var ndi_y1=ndi.m_rects[0].y+ndi.m_rects[0].h;
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
		var mx_world=((UI.m_absolute_mouse_position.x-this.x)-this.graph.tr.trans[0])/this.graph.tr.scale;
		var my_world=((UI.m_absolute_mouse_position.y-this.y)-this.graph.tr.trans[1])/this.graph.tr.scale;
		var log_scale=Math.log(this.graph.tr.scale);
		log_scale+=event.y*0.1;
		this.graph.tr.scale=(Math.exp(log_scale)||1);
		this.graph.tr.trans[0]=(UI.m_absolute_mouse_position.x-this.x)-mx_world*this.graph.tr.scale;
		this.graph.tr.trans[1]=(UI.m_absolute_mouse_position.y-this.y)-my_world*this.graph.tr.scale;
		if(this.m_drag_ctx){
			this.m_drag_ctx={x:event.x,y:event.y, tr:JSON.parse(JSON.stringify(this.graph.tr))};
		}
		UI.Refresh();
	},
	OnKeyDown:function(event){
		if(this.m_drag_ctx){return;}
		var IsHotkey=UI.IsHotkey;
		if(0){
		}else if(IsHotkey(event,"ESC")){
			this.editor.m_graph=undefined;
			UI.Refresh();
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
	UpdateGraph:function(){
		var graph=this.graph;
		graph.available=UpdateGraph(graph.nds,graph.es);
		if(this.editor&&this.editor.owner){
			this.editor.owner.__package__=undefined;
		}
	},
};
var canConnect=function(port,annotations){
	if(!annotations){return 1;}
	var final_annotations=port.final_annotations;
	if(!final_annotations){return 0;}
	for(var k in annotations){
		if(final_annotations[k]!=annotations[k]){
			return 0;
		}
	}
	return 1;
};
W.GraphView=function(id,attrs){
	//keep the old object for zooms and all
	var obj=UI.StdWidget(id,attrs,"graph_view",W.graphview_prototype);
	UI.Begin(obj)
	W.PureRegion(id,obj)
	var graph=obj.graph;
	var nds=graph.nds;
	var es=graph.es;
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
	//cache.m_degs=degs_map;
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
		type_ref_drag_v0=port_ref_drag_v0.annotations;
		if(!port_ref_drag_v0){
			is_connecting_edges=0;
		}
	}
	for(var ni=0;ni<graph.nds.length;ni++){
		var ndi=graph.nds[ni];
		var x=ndi.x+tr.trans[0]/tr.scale;
		var y=ndi.y+tr.trans[1]/tr.scale;
		var cache_item=ndi;
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
					}else if(canConnect(item_i.port_ref,type_ref_drag_v0)){
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
	UI.PopSubWindow()
	UI.End()
	return obj;
};

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
		for(var i=0;i<obj.available.length;i++){
			var s_i=obj.available[i].name.toLowerCase();
			var s_desc_i=(obj.available[i].desc||'').toLowerCase();
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
				items.push({
					s_combo:obj.available[i].name,
					s_desc:obj.available[i].desc,
					hl_ranges:hl_ranges,
					hl_ranges_desc:hl_ranges_desc,
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
		var obj=this.owner.graphview;
		var graph=obj.graph;
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
		//create the new node
		var nd_new=UI.ED_CreateComboNode(this.s_combo);
		if(!graph.node_counter){
			graph.node_counter=0;
		}
		graph.node_counter++;
		nd_new.__id__=['__new',this.s_combo,graph.node_counter].join('_');
		PreprocessNode(nd_new);
		graph.nds.push(nd_new);
		//enum and test all ports
		//keys: matched_type_id selection key x
		//do auto-layout in the same loop
		var al_x_max=-1e10,al_y_avg=0,al_n=0;
		var connected_slots=[];
		for(var pi=0;pi<nd_new.out_ports.length;pi++){
			var port_pi=nd_new.out_ports[pi];
			//if(port_pi.dir!='output'){continue;}
			var port_best=undefined;
			var nd_root=undefined;
			for(var i=0;i<graph.nds.length-1;i++){
				var ndi=graph.nds[i];
				if(ndi.__id__=="<root>"){
					nd_root=ndi;
				}
				for(var j=0;j<ndi.in_ports.length;j++){
					var port_j=ndi.in_ports[j];
					var type_j=port_j.type;
					if(port_j.dir==port_pi.dir){continue;}
					//if(port_pi.dir=='output'){
					//	if(!canConnect(port_j,port_pi.annotations)){
					//		continue;
					//	}
					//}else{
					//	if(!canConnect(port_pi,port_j.annotations)){
					//		continue;
					//	}
					//}
					if(!canConnect(port_j,port_pi.annotations)){
						continue;
					}
					var id_best=port_j.id;
					if(!port_best||id_best==port_pi.id&&port_best.port!=port_pi.id||(id_best==port_pi.id)==(port_best.port==port_pi.id)&&(
					dist_to_sel[port_best.ndid]>dist_to_sel[i]||dist_to_sel[port_best.ndid]==dist_to_sel[i]&&(
					port_best.nd.x<ndi.x||port_best.nd.x==ndi.x&&port_best.nd.y<ndi.y))){
						port_best={nd:ndi,ndid:i,port:id_best};
					}
				}
			}
			if(!port_best){
				//force-connect to root
				port_best={nd:nd_root,port:"-"};
			}
			//we have switched the edge sides, it's now input->output
			if(port_pi.dir=='output'){
				graph.es.push({
					id0:port_best.nd.__id__, port0:port_best.port,
					id1:nd_new.__id__, port1:port_pi.id,
				})
				al_x_max=Math.max(al_x_max,port_best.nd.x+port_best.nd.m_w);
				al_y_avg+=port_best.nd.y;
				al_n++;
			}else{
				graph.es.push({
					id0:nd_new.__id__, port0:port_pi.id,
					id1:port_best.nd.__id__, port1:port_best.port,
				})
			}
			//first write down the slots
			connected_slots[pi]=port_best;
		}
		//actually insert the code
		var doc=obj.editor;
		var port_slot_ccnts=[];
		for(var pi=0;pi<nd_new.out_ports.length;pi++){
			var nd_target=connected_slots[pi].nd;
			var port_id=connected_slots[pi].port;
			var port=undefined;
			for(var i=0;i<nd_target.in_ports.length;i++){
				port=nd_target.in_ports[i]
				if(port.id==port_id){
					break;
				}
			}
			var var_bindings=port.final_annotations||{};
			var replaced_vars={};
			var part_data=UI.ED_GetComboPartData(nd_new.name,pi);
			for(var i=0;i<part_data.id_params.length;i++){
				var id_i=part_data.id_params[i];
				if(var_bindings[id_i]){
					replaced_vars[id_i]=var_bindings[id_i];
				}
			}
			var scode=part_data.scode.replace(/\b[0-9a-zA-Z_$]\b/g,function(smatch){
				return replaced_vars[smatch]||smatch;
			});
			var ccnt_insert=port.loc1.ccnt;
			var line_indent=doc.GetLC(ccnt_insert)[0];
			var is_last_line=0;
			if(line_indent>0&&doc.ed.GetUtf8CharNeighborhood(ccnt_insert)[1]=='}'.charCodeAt(0)){
				line_indent--;
				is_last_line=1;
			}
			var ccnt_lh=doc.SeekLC(line_indent,0);
			var ccnt_after_indent=doc.ed.MoveToBoundary(ccnt_lh,1,"space");
			var s_target_indent=doc.ed.GetText(ccnt_lh,ccnt_after_indent-ccnt_lh);
			var scode_indented=UI.ED_GetClipboardTextSmart(s_target_indent,scode);
			if(is_last_line&&scode_indented&&scode_indented.length>=s_target_indent.length&&scode_indented.slice(scode_indented.length-s_target_indent.length)==s_target_indent){
				scode_indented=scode_indented.slice(scode_indented.length-s_target_indent.length)+scode_indented.slice(0,scode_indented.length-s_target_indent.length);
			}
			scode=(scode_indented||scode);
			var slot_desc=UI.ED_SlotsFromPartCode(scode);
			scode=slot_desc.scode;
			//ccnt_insert=doc.ed.MoveToBoundary(ccnt_insert,-1,"space");
			doc.HookedEdit([ccnt_insert,0,scode]);
			doc.CallOnChange()
			var epos0=ccnt_insert;
			var epos1=ccnt_insert+Duktape.__byte_length(scode);
			doc.SetSelection(epos0,epos1)
			UI.Refresh()
			port.epos1=epos1;//expand the port
			nd_new.out_ports[pi].epos0=epos0;
			nd_new.out_ports[pi].epos1=epos1;
			//save slot eposes 
			port_slot_ccnts[pi]=slot_desc.slot_ccnts;
		}
		for(var pi=0;pi<nd_new.in_ports.length;pi++){
			var part_id=nd_new.in_ports[pi].part_id;
			var epos=(port_slot_ccnts[part_id][pi]+nd_new.out_ports[part_id].epos0||nd_new.out_ports[part_id].epos1);
			nd_new.in_ports[pi].epos0=epos;
			nd_new.in_ports[pi].epos1=epos;
		}
		for(var pi=0;pi<nd_new.m_ports.length;pi++){
			var port=nd_new.m_ports[pi];
			port.loc0=doc.ed.CreateLocator(port.epos0,-1);
			port.loc1=doc.ed.CreateLocator(port.epos1,1);
		}
		if(al_n){
			//connection-based auto-layout: x_max+margin, y_average
			nd_new.x=al_x_max+UI.default_styles.graph_view.node_style.node_padding;
			nd_new.y=al_y_avg/al_n;
		}else{
			//by default, add it "down"
			var y_max=0,x_y_max=0;
			for(var i=0;i<graph.nds.length;i++){
				var y_i=graph.nds[i].y+(graph.nds[i].m_h||0);
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
		//re-query availabilities
		obj.UpdateGraph();
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
		//var s_icon='夹';
		var s_title=obj.s_combo;
		var s_hint=(obj.s_desc||'');
		//UI.DrawChar(obj.icon_font,obj.x+obj.padding+4,obj.y+(obj.h-h_icon)*0.5,
		//	obj.icon_color,s_icon.charCodeAt(0));
		W.Text("",{x:obj.x+obj.padding+4,y:obj.y+4,
			font:name_font,text:s_title,
			color:obj.name_color})
		W.Text("",{x:obj.x+obj.padding+4,y:obj.y+4+28,
			font:obj.hint_font,text:s_hint,
			color:obj.hint_color})
		if(obj.hl_ranges){
			for(var i=0;i<obj.hl_ranges.length;i+=2){
				var p0=obj.hl_ranges[i+0];
				var p1=obj.hl_ranges[i+1];
				if(p0<p1){
					var x=obj.x+obj.padding+4+UI.MeasureText(name_font,s_title.substr(0,p0)).w
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
					var x=obj.x+obj.padding+4+UI.MeasureText(obj.hint_font,s_hint.substr(0,p0)).w
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
