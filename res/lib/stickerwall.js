"use strict"
var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");
require("res/lib/code_editor");
var H_MAX_STICKER=1440;
var SIZE_MIN=100;

UI.ParseNow=function(fn){
	UI.ED_ForceIntoParseQueueFront(fn);
	return UI.ED_ParseMore();
};

var ScaleKnob_prototype={
	OnMouseDown:function(event){
		var obj=this.owner;
		this.x_anchor=obj.x+obj.w*this.x_anchor_rel;
		this.y_anchor=obj.y+obj.h*this.y_anchor_rel;
		this.dx_base=(this.x+this.w*0.5-this.x_anchor);
		this.dy_base=(this.y+this.h*0.5-this.y_anchor);
		this.drag_x_anchor=this.x_anchor;
		this.drag_y_anchor=this.y_anchor;
		this.drag_x0=(obj.x-this.x_anchor);
		this.drag_y0=(obj.y-this.y_anchor);
		//this.drag_x1=(obj.x+obj.w-this.x_anchor);
		//this.drag_y1=(obj.y+obj.h-this.y_anchor);
		this.dx_center=(this.x+this.w*0.5)-event.x;
		this.dy_center=(this.y+this.h*0.5)-event.y;
		this.drag_w=obj.w;
		this.drag_h=obj.h;
		this.is_dragging=1;
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		var obj=this.owner;
		if(!this.is_dragging){return;}
		//var snap_x=[];
		//var snap_y=[];
		//if(this.x_anchor_rel==0){snap_x.push(UI.SNAP_RIGHT,this.dx_center)}
		//if(this.x_anchor_rel==1){snap_x.push(UI.SNAP_LEFT,this.dx_center)}
		//if(this.y_anchor_rel==0){snap_y.push(UI.SNAP_RIGHT,this.dy_center)}
		//if(this.y_anchor_rel==1){snap_y.push(UI.SNAP_LEFT,this.dy_center)}
		//TestSnappingCoords(obj,event, snap_x,snap_y);
		var x_scale=(event.x+this.dx_center-this.drag_x_anchor)/this.dx_base;
		var y_scale=(event.y+this.dy_center-this.drag_y_anchor)/this.dy_base;
		if(obj.disable_y_scale){y_scale=undefined;}
		if(this.lock_aspect_ratio){x_scale=Math.min(x_scale,y_scale);y_scale=x_scale;}
		if(x_scale){
			x_scale=Math.max(x_scale,SIZE_MIN/this.drag_w);
			obj.x=this.drag_x_anchor+this.drag_x0*x_scale;
			obj.w=this.drag_w*x_scale;
		}else{
			x_scale=1.0;
		}
		if(y_scale){
			y_scale=Math.max(y_scale,SIZE_MIN/this.drag_h);
			obj.y=this.drag_y_anchor+this.drag_y0*y_scale;
			obj.h=this.drag_h*y_scale;
		}else{
			y_scale=1.0;
		}
		//doc.SetTransform({"scale":[x_scale,y_scale],"relative_anchor":[this.x_anchor_rel,this.y_anchor_rel]});
		//obj.OnChange(obj);
		UI.Refresh()
	},
	OnMouseUp:function(event){
		this.OnMouseMove(event);
		var obj=this.owner;
		this.is_dragging=0;
		UI.ReleaseMouse(this);
		UI.Refresh();
	},
};

var MoveKnob_prototype={
	OnMouseDown:function(event){
		var obj=this.owner;
		var wall=this.wall_owner;
		this.dx=-event.x;
		this.dy=-event.y;
		this.is_dragging=1;
		if(!obj.m_is_selected){
			wall.ClearSelection();
			obj.m_is_selected=1;
		}
		for(var i=0;i<wall.m_stickers.length;i++){
			var sticker_i=wall.m_stickers[i];
			if(sticker_i.m_is_selected){
				sticker_i.drag_x=sticker_i.x;
				sticker_i.drag_y=sticker_i.y;
			}
		}
		UI.CaptureMouse(this);
	},
	OnMouseMove:function(event){
		if(!this.is_dragging){return;}
		var wall=this.wall_owner;
		for(var i=0;i<wall.m_stickers.length;i++){
			var sticker_i=wall.m_stickers[i];
			if(sticker_i.m_is_selected){
				sticker_i.x=sticker_i.drag_x+this.dx+event.x;
				sticker_i.y=sticker_i.drag_y+this.dy+event.y;
			}
		}
		UI.Refresh();
	},
	OnMouseUp:function(event){
		this.OnMouseMove(event);
		var wall=this.wall_owner;
		for(var i=0;i<wall.m_stickers.length;i++){
			var sticker_i=wall.m_stickers[i];
			if(sticker_i.m_is_selected){
				sticker_i.drag_x=undefined;
				sticker_i.drag_y=undefined;
			}
		}
		this.is_dragging=0;
		UI.ReleaseMouse(this);
		UI.Refresh();
	},
};

/*
the wall itself is simple
	x,y,type
	graphview-like global zoom / scale / ...
	boxdoc-like per-item zoom / scale
the problem is node types
	code range
		a separate editor with the proper index loaded?
		and sync the edits ccnt-by-ccnt...
			could be a good idea, the sync part
			since it always remains as a ccnt sub-range
	documentation
	editing script
		e.g.
			adding a new FBO to libnama
			adding a new message type to ctp_trader
			a semi-auto nodejs noob guide
	notebook cell
		a button to an actual notebook cell
	image...
	3D model...
edges
	mainly connect to text range in code
*/
var g_sw_separator='\n=====\udbff\udfff stickerwall =====\n',g_sw_separator_re=new RegExp(g_sw_separator,'g');
var g_checker_shader=IO.UIReadAll("res/misc/checker.glsl");
var sticker_wall_prototype={
	//todo: save
	InitSticker:function(sticker_i,text){
		switch(sticker_i.type){
		case "code":
			var fn_i=sticker_i.file_name;
			var fn_found=UI.SearchIncludeFile(this.m_file_name,fn_i);
			if(fn_found){fn_i=fn_found;}
			if(!IO.FileExists(fn_i)){break;}
			var doc_host=UI.OpenCodeEditorDocument(fn_i,-1);
			if(!doc_host.ed){
				doc_host.m_load_sync=1;
				doc_host.Init();
			}
			var diff_host=doc_host.m_diff_from_save;
			var ccnt_tag0=0,ccnt_tag1=0;
			if(!doc_host.ed.m_file_index){
				var parse_ret=UI.ParseNow(fn_i);
				if(parse_ret&&parse_ret.file_index){
					doc_host.ed.m_file_index=parse_ret.file_index;
				}
			}
			var decls=UI.ED_QueryKeyDeclByNeedle(doc_host,sticker_i.tag0_name);
			ccnt_tag0=((decls&&decls[(sticker_i.tag0_number||0)*2])||0);
			if(diff_host){ccnt_tag0=diff_host.BaseToCurrent(ccnt_tag0);}
			if(sticker_i.tag1_name===undefined){
				//{} auto-pairing mode
				var line_tag0=doc_host.GetLC(ccnt_tag0)[0];
				var ccnt_lend_tag0=doc_host.GetEnhancedEnd(ccnt_tag0);
				var blevel_tag0=doc_host.GetBracketLevel(doc_host.SeekLC(line_tag0,0));
				var blevel_lend_tag0=doc_host.GetBracketLevel(ccnt_lend_tag0);
				if(blevel_lend_tag0==blevel_tag0){
					//try the next line
					var ccnt_lnext_tag0=doc_host.GetEnhancedEnd(doc_host.SeekLC(line_tag0+1,0));
					var blevel_lnext_tag0=doc_host.GetBracketLevel(ccnt_lnext_tag0);
					if(blevel_lnext_tag0>blevel_tag0){
						blevel_lend_tag0=blevel_lnext_tag0;
						ccnt_lend_tag0=ccnt_lnext_tag0;
					}
				}
				if(blevel_lend_tag0>blevel_tag0){
					ccnt_tag1=doc_host.FindOuterBracket(ccnt_lend_tag0,1);
				}
			}else{
				decls=UI.ED_QueryKeyDeclByNeedle(doc_host,sticker_i.tag1_name);
				ccnt_tag1=((decls&&decls[(sticker_i.tag1_number||0)*2])||ccnt_tag0);
				if(diff_host){ccnt_tag1=diff_host.BaseToCurrent(ccnt_tag1);}
			}
			if(ccnt_tag1>ccnt_tag0){
				ccnt_tag0=doc_host.SeekLC(doc_host.GetLC(ccnt_tag0)[0],0);
				ccnt_tag1=doc_host.SeekLC(doc_host.GetLC(ccnt_tag1)[0]+1,0);
				if(ccnt_tag1>ccnt_tag0){
					var doc_code=UI.OpenCodeEditorDocument(fn_i,-2);
					doc_code.m_sync_group_ccnt0=ccnt_tag0;
					doc_code.m_sync_group_ccnt1=ccnt_tag1;
					doc_code.show_background=0;
					doc_code.m_sticker_wall_owner=this;
					doc_code.disable_line_numbers=1;
					doc_code.Init()
					sticker_i.doc=doc_code;
				}
			}
			UI.CloseCodeEditorDocument(doc_host);
			break;
		case "note":
			var doc_note=UI.CreateEmptyCodeEditor("Markdown");
			//doc_note.plugins=this.m_cell_plugins;
			doc_note.m_enable_wrapping=1;
			doc_note.m_current_wrap_width=sticker_i.w/sticker_i.scale-UI.default_styles.code_editor.padding;
			doc_note.wrap_width=doc_note.m_current_wrap_width;
			doc_note.disable_x_scroll=1;
			doc_note.show_background=0;
			doc_note.disable_line_numbers=1;
			doc_note.m_sticker_wall_owner=this;
			doc_note.Init();
			doc_note.scroll_x=0;doc_note.scroll_y=0;
			if(text){doc_note.ed.Edit([0,0,text],1);}
			doc_note.saved_point=doc_note.ed.GetUndoQueueLength();
			sticker_i.doc=doc_note;
			break;
		//case "script":
		//	break;
		//case "image":
		//	break;
		}
	},
	Init:function(){
		this.m_is_inited=1;
		this.m_stickers=[];
		//load
		var fn=this.m_file_name;
		var s_file_data=IO.ReadAll(fn);
		var parts=s_file_data.split(g_sw_separator);
		var obj_json=JSON.parse(parts[0]);
		if(obj_json.m_stickers){
			this.m_stickers=obj_json.m_stickers;
		}
		var ppart=1;
		for(var i=0;i<this.m_stickers.length;i++){
			var sticker_i=this.m_stickers[i];
			var text="";
			if(sticker_i.type=="note"){
				text=(parts[ppart++]||"");
			}
			this.InitSticker(sticker_i,text);
		}
	},
	Render:function(){
		var stickers=this.m_stickers;
		var common_style=this.common_style;
		var tr=this.m_tr;
		if(tr==undefined){
			tr={};
			this.m_tr=tr;
		}
		if(tr.scale==undefined){
			tr.scale=1;
		}
		if(tr.trans==undefined){
			tr.trans=[0,0];
		}
		//view transformation
		UI.PushSubWindow(this.x,this.y,this.w,this.h,1.0);
		UI.GLWidget(function(){
			UI.ED_DrawFullScreenEffect(g_checker_shader,{
				coord_scale:[this.w,this.h],
				trans:tr.trans,
				scale:tr.scale,
				color_0:common_style.bgcolor0,
				color_1:common_style.bgcolor1,
			});
		}.bind(this));
		UI.PopSubWindow();
		UI.PushSubWindow(this.x,this.y,this.w,this.h,tr.scale);
		var move_padding=common_style.move_padding/tr.scale+common_style.padding;
		for(var i=0;i<stickers.length;i++){
			var sticker_i=stickers[i];
			var style_i=this.sticker_styles[sticker_i.type];
			var x=sticker_i.x+tr.trans[0]/tr.scale;
			var y=sticker_i.y+tr.trans[1]/tr.scale;
			//measure size
			switch(sticker_i.type){
			case "code":
			case "note":
				if(!sticker_i.doc){
					continue;
				}
				var w_inner=sticker_i.w/sticker_i.scale;
				var doc_i=sticker_i.doc;
				if(doc_i.m_enable_wrapping&&doc_i.m_current_wrap_width!=w_inner){
					doc_i.m_current_wrap_width=w_inner;
					var renderer=doc_i.GetRenderer();
					var ed_caret_original=doc_i.GetCaretXY();
					var scroll_y_original=doc_i.scroll_y;
					renderer.ResetWrapping(doc_i.m_enable_wrapping?doc_i.m_current_wrap_width:0,doc_i)
					doc_i.caret_is_wrapped=0
					doc_i.ed.InvalidateStates([0,doc_i.ed.GetTextSize()])
					var ed_caret_new=doc_i.GetCaretXY();
					doc_i.scroll_y=scroll_y_original-ed_caret_original.y+ed_caret_new.y;
				}
				////////////////////
				sticker_i.h=Math.min(UI.MeasureEditorSize(sticker_i.doc,w_inner)*sticker_i.scale,Math.max(H_MAX_STICKER,sticker_i.w));
				sticker_i.disable_y_scale=1;
				break;
			//case "script":
			//	break;
			//case "image":
			//	break;
			}
			//moving borders
			var sticker_name=("sticker_"+i.toString());
			W.Region(sticker_name+"_move_knob",{
				x:x-move_padding,y:y-move_padding,
				w:sticker_i.w+move_padding*2,
				h:sticker_i.h+move_padding*2,
				owner:sticker_i,
				wall_owner:this,
				mouse_cursor:"sizeall",
			},MoveKnob_prototype);
			//render background
			UI.RoundRect({
				x:x-common_style.padding,y:y-common_style.padding,
				w:sticker_i.w+common_style.padding*2+common_style.shadow_size,h:sticker_i.h+common_style.padding*2+common_style.shadow_size,
				round:common_style.shadow_size,
				border_width:-common_style.shadow_size,
				color:common_style.shadow_color,
			});
			UI.RoundRect({
				x:x-common_style.padding,y:y-common_style.padding,
				w:sticker_i.w+common_style.padding*2,h:sticker_i.h+common_style.padding*2,
				color:style_i.bgcolor,
				border_width:sticker_i.m_is_selected?common_style.selection_width/tr.scale:0,
				border_color:common_style.selection_color,
			});
			//render content
			UI.PushSubWindow(x,y,sticker_i.w,sticker_i.h,sticker_i.scale)
			switch(sticker_i.type){
			case "code":
				W.CodeEditor(sticker_name,{
					disable_minimap:1,
					doc:sticker_i.doc,
					show_background:0,
					x:0,y:0,
					w:sticker_i.w/sticker_i.scale,h:sticker_i.h/sticker_i.scale,
				});
				sticker_i.doc.default_focus=sticker_i.m_is_selected+1;
				sticker_i.doc.OnFocus=function(sticker_i){
					if(sticker_i.m_is_selected){return;}
					this.ClearSelection();
					sticker_i.m_is_selected=1;
					UI.Refresh();
				}.bind(this,sticker_i);
				break;
			case "note":
				W.CodeEditor(sticker_name,{
					disable_minimap:1,
					doc:sticker_i.doc,
					show_background:0,
					x:0,y:0,
					w:sticker_i.w/sticker_i.scale,h:sticker_i.h/sticker_i.scale,
				});
				sticker_i.doc.default_focus=sticker_i.m_is_selected+1;
				sticker_i.doc.OnFocus=function(sticker_i){
					if(sticker_i.m_is_selected){return;}
					this.ClearSelection();
					sticker_i.m_is_selected=1;
					UI.Refresh();
				}.bind(this,sticker_i);
				break;
			//case "script":
			//	break;
			//case "image":
			//	break;
			}
			UI.PopSubWindow();
		}
		for(var i=0;i<stickers.length;i++){
			var sticker_i=stickers[i];
			var style_i=this.sticker_styles[sticker_i.type];
			var x=sticker_i.x+tr.trans[0]/tr.scale;
			var y=sticker_i.y+tr.trans[1]/tr.scale;
			//resizing knobs
			if(sticker_i.m_is_selected){
				var knob=Object.create(common_style.knob_scale);
				knob.w/=tr.scale;
				knob.h/=tr.scale;
				knob.border_width/=tr.scale;
				var dx=knob.w*0.5;var dy=knob.h*0.5;
				var x0=x-common_style.padding-dx;
				var y0=y-common_style.padding-dy;
				var x2=x0+sticker_i.w+common_style.padding*2;
				var y2=y0+sticker_i.h+common_style.padding*2;
				var x1=(x0+x2)*0.5;
				var y1=(y0+y2)*0.5;
				knob.x=x0;knob.y=y0;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob00",{x_anchor_rel:2*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,x_anchor:x2+dx,y_anchor:y2+dy,mouse_cursor:"sizenwse"},ScaleKnob_prototype);
				knob.x=x1;knob.y=y0;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob10",{x_anchor_rel:1*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,y_anchor:y2+dy,mouse_cursor:"sizens"},ScaleKnob_prototype);
				knob.x=x2;knob.y=y0;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob20",{x_anchor_rel:0*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,x_anchor:x0+dx,y_anchor:y2+dy,mouse_cursor:"sizenesw"},ScaleKnob_prototype);
				knob.x=x0;knob.y=y1;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob01",{x_anchor_rel:2*0.5,y_anchor_rel:1*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,x_anchor:x2+dx,mouse_cursor:"sizewe"},ScaleKnob_prototype);
				knob.x=x2;knob.y=y1;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob21",{x_anchor_rel:0*0.5,y_anchor_rel:1*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,x_anchor:x0+dx,mouse_cursor:"sizewe"},ScaleKnob_prototype);
				knob.x=x0;knob.y=y2;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob02",{x_anchor_rel:2*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,x_anchor:x2+dx,y_anchor:y0+dy,mouse_cursor:"sizenesw"},ScaleKnob_prototype);
				knob.x=x1;knob.y=y2;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob12",{x_anchor_rel:1*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,y_anchor:y0+dy,mouse_cursor:"sizens"},ScaleKnob_prototype);
				knob.x=x2;knob.y=y2;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob22",{x_anchor_rel:0*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,owner:sticker_i,x_anchor:x0+dx,y_anchor:y0+dy,mouse_cursor:"sizenwse"},ScaleKnob_prototype);
			}
		}
		//drag rect
		if(this.m_drag_ctx&&this.m_drag_ctx.m_sel_rect){
			var rc=this.m_drag_ctx.m_sel_rect;
			UI.RoundRect({
				x:rc[0],y:rc[1],w:rc[2]-rc[0],h:rc[3]-rc[1],
				color:this.common_style.dragsel_bgcolor,
				border_color:this.common_style.dragsel_border_color,
				border_width:this.common_style.dragsel_border_width,
			})
		}
		UI.PopSubWindow();
	},
	///////////////////////////
	OnMouseDown:function(event){
		UI.SetFocus(this);
		this.m_drag_ctx={mode:"translation",x:event.x,y:event.y, tr:JSON.parse(JSON.stringify(this.m_tr))};
		if(event.button==UI.SDL_BUTTON_LEFT){
			this.m_drag_ctx.mode="selection";
			UI.SetFocus(this);
		}
		UI.CaptureMouse(this);
		UI.Refresh();
	},
	OnMouseMove:function(event){
		if(!this.m_drag_ctx){return;}
		if(this.m_drag_ctx.mode=='translation'){
			this.m_tr.trans[0]=this.m_drag_ctx.tr.trans[0]+ (event.x-this.m_drag_ctx.x);
			this.m_tr.trans[1]=this.m_drag_ctx.tr.trans[1]+ (event.y-this.m_drag_ctx.y);
		}else if(this.m_drag_ctx.mode=='selection'){
			var stickers=this.m_stickers;
			var x0=(Math.min(this.m_drag_ctx.x, event.x)-this.x)/this.m_tr.scale;
			var y0=(Math.min(this.m_drag_ctx.y, event.y)-this.y)/this.m_tr.scale;
			var x1=(Math.max(this.m_drag_ctx.x, event.x)-this.x)/this.m_tr.scale;
			var y1=(Math.max(this.m_drag_ctx.y, event.y)-this.y)/this.m_tr.scale;
			this.m_drag_ctx.m_sel_rect=[x0,y0,x1,y1];
			for(var i=0;i<stickers.length;i++){
				var ndi=stickers[i];
				var ndi_x0=ndi.x+this.m_tr.trans[0]/this.m_tr.scale;
				var ndi_y0=ndi.y+this.m_tr.trans[1]/this.m_tr.scale;
				var ndi_x1=ndi_x0+ndi.w;
				var ndi_y1=ndi_y0+ndi.h;
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
		var x_real=UI.m_absolute_mouse_position.x/UI.pixels_per_unit-this.x;
		var y_real=UI.m_absolute_mouse_position.y/UI.pixels_per_unit-this.y;
		var mx_world=(x_real-this.m_tr.trans[0])/this.m_tr.scale;
		var my_world=(y_real-this.m_tr.trans[1])/this.m_tr.scale;
		var log_scale=Math.log(this.m_tr.scale);
		log_scale+=event.y*0.1;
		this.m_tr.scale=(Math.exp(log_scale)||1);
		this.m_tr.trans[0]=x_real-mx_world*this.m_tr.scale;
		this.m_tr.trans[1]=y_real-my_world*this.m_tr.scale;
		if(this.m_drag_ctx){
			this.m_drag_ctx={x:x_real,y:y_real, tr:JSON.parse(JSON.stringify(this.m_tr))};
		}
		UI.Refresh();
	},
	///////////////////////////
	ClearSelection:function(){
		var stickers=this.m_stickers;
		for(var i=0;i<stickers.length;i++){
			stickers[i].m_is_selected=0;
		}
	},
	DeleteSelection:function(){
		var stickers=this.m_stickers;
		var n2=0;
		for(var i=0;i<stickers.length;i++){
			if(!stickers[i].m_is_selected){
				this["sticker_"+n2.toString()]=this["sticker_"+i.toString()];
				stickers[n2]=stickers[i];
				n2++;
			}
		}
		stickers.length=n2;
		UI.Refresh();
	},
	PlaceSticker:function(new_sticker){
		//O(n^3) search: enum all x/y combos, find the nearest not-covered one
		var separation=32;
		var stickers=this.m_stickers;
		var n=stickers.length;
		var xs=[];
		var ys=[];
		var x_min=0,y_min=0,x_max=0,y_max=0;
		for(var i=0;i<n;i++){
			xs.push(stickers[i].x-separation-new_sticker.w, stickers[i].x+stickers[i].w+separation);
			ys.push(stickers[i].y-separation-new_sticker.h, stickers[i].y+stickers[i].h+separation);
			xs.push(stickers[i].x, stickers[i].x+stickers[i].w-new_sticker.w);
			ys.push(stickers[i].y, stickers[i].y+stickers[i].h-new_sticker.h);
			if(!i){
				x_min=stickers[i].x;
				y_min=stickers[i].y;
				x_max=stickers[i].x+stickers[i].w;
				y_max=stickers[i].y+stickers[i].h;
			}else{
				x_min=Math.min(x_min,stickers[i].x);
				y_min=Math.min(y_min,stickers[i].y);
				x_max=Math.max(x_max,stickers[i].x+stickers[i].w);
				y_max=Math.max(y_max,stickers[i].y+stickers[i].h);
			}
		}
		xs.sort();ys.sort();
		var best_dist=1e30;
		var best_area=1e30;
		new_sticker.x=0;
		new_sticker.y=0;
		for(var xi=0;xi<xs.length;xi++){
			for(var yi=0;yi<ys.length;yi++){
				var x=xs[xi],y=ys[yi];
				var area_xy=(Math.max(x_max,x)-Math.min(x_min,x))*(Math.max(y_max,y)-Math.min(y_min,y));
				if(best_area<area_xy){continue;}
				var dist_nearest=1e30;
				for(var i=0;i<n;i++){
					var sticker_i=stickers[i];
					var x0=sticker_i.x-separation-new_sticker.w;
					var y0=sticker_i.y-separation-new_sticker.h;
					var x1=sticker_i.x+sticker_i.w+separation;
					var y1=sticker_i.y+sticker_i.h+separation;
					if(x0<x&&x<x1&&y0<y&&y<y1){
						area_xy=1e31;
						dist_nearest=1e31;
						break;
					}
					var dx=Math.max(x0-x,x-x1,0);
					var dy=Math.max(y0-y,y-y1,0);
					var dist_i=dx*dx+dy*dy;
					if(sticker_i.m_is_selected){
						dist_i/=2;
					}
					if(dist_nearest>dist_i){
						dist_nearest=dist_i;
					}
				}
				if(best_area>area_xy||best_area==area_xy&&(best_dist>dist_nearest||best_dist==dist_nearest&&(new_sticker.y>y||new_sticker.y==y&&new_sticker.x>x))){
					best_area=area_xy;
					best_dist=dist_nearest;
					new_sticker.x=x;
					new_sticker.y=y;
				}
			}
		}
		this.m_stickers.push(new_sticker);
		this.InitSticker(new_sticker,"");
		//auto scroll
		this.AutoScrollToShow(new_sticker)
	},
	AutoScrollToShow:function(sticker_i){
		this.m_tr.trans[0]=-Math.min(Math.max(-this.m_tr.trans[0],sticker_i.x+sticker_i.w+8-this.w),sticker_i.x-8);
		this.m_tr.trans[1]=-Math.min(Math.max(-this.m_tr.trans[1],sticker_i.y+sticker_i.h+8-this.h),sticker_i.y-8);
	},
	InsertNote:function(){
		var new_sticker={
			"type":"note",
			"w":300,"h":32,
			"scale":1,
		};
		this.PlaceSticker(new_sticker);
		UI.Refresh();
	},
};
W.StickerWall=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"sticker_wall",sticker_wall_prototype);
	UI.Begin(obj)
	W.PureRegion(id,obj)
	if(!obj.m_is_inited){
		obj.Init();
	}
	obj.Render();
	UI.End()
	return obj;
};

UI.OpenStickerWallTab=function(file_name,is_quiet){
	var layout=UI.m_ui_metadata["<layout>"];
	layout.m_is_maximized=0;
	file_name=IO.NormalizeFileName(file_name);
	//coulddo: bring-up check
	UI.top.app.quit_on_zero_tab=0;
	var bk_current_tab_id=undefined;
	if(is_quiet){
		bk_current_tab_id=UI.top.app.document_area.current_tab_id;
	}
	var ret=UI.NewTab({
		file_name:file_name,
		title:UI.GetMainFileName((file_name)),
		tooltip:file_name,
		document_type:"stickerwall",
		//area_name:"v_tools",
		NeedRendering:function(){
			if(!this.main_widget){return 1;}
			if(this==UI.top.app.document_area.active_tab){return 1;}
			return 0;
		},
		UpdateTitle:function(){
			if(this.main_widget){
				var body=this.main_widget;
				var s_name=UI.GetMainFileName((this.file_name));
				this.tooltip=this.file_name;
			}
		},
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			var common_style=UI.default_styles.sticker_wall.common_style;
			if(this.main_widget){this.file_name=this.main_widget.m_file_name}
			//sticker wall area
			var attrs={
				'x':0,'y':common_style.h_toolbar,
				'w':UI.context_parent.w,
				'h':UI.context_parent.h-common_style.h_toolbar,
				'm_file_name':this.file_name,
				'activated':this==UI.top.app.document_area.active_tab,
			};
			var body=W.StickerWall("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
			}
			this.need_save=this.main_widget.need_save;
			this.UpdateTitle();
			//toolbar
			UI.RoundRect({
				x:-common_style.toolbar_shadow_size,y:common_style.h_toolbar-common_style.toolbar_shadow_size,
				w:UI.context_parent.w+common_style.toolbar_shadow_size*2,h:common_style.toolbar_shadow_size*2,
				round:common_style.toolbar_shadow_size,
				border_width:-common_style.toolbar_shadow_size,
				color:common_style.toolbar_shadow_color,
			});
			UI.RoundRect({
				x:0,y:0,
				w:UI.context_parent.w,h:common_style.h_toolbar,
				color:common_style.toolbar_color,
			});
			var x_current=0;
			//new sticker buttons
			x_current+=W.Button("new_note",{
				x:x_current,y:0,
				w:32,h:32,
				font:UI.Font(UI.icon_font_name,24),
				text:"T",
				tooltip:"Add note - CTRL+M",
				OnClick:function(){body.InsertNote();},
			}).w;
			x_current+=W.Button("del_note",{
				x:x_current,y:0,
				w:32,h:32,
				font:UI.Font(UI.icon_font_name,24),
				text:"剪",
				tooltip:"Delete stickers - DELETE",
				OnClick:function(){body.DeleteSelection();},
			}).w;
			if(UI.HasFocus(body)){
				W.Hotkey("",{
					key:"CTRL+M",
					action:function(){body.InsertNote();},
				});
				W.Hotkey("",{
					key:"DELETE",
					action:function(){body.DeleteSelection();},
				});
			}
			x_current+=32;
			//todo: buttons - font, goto, button style
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
			if(this.is_default&&this.need_save){
				this.need_save=65536;
			}
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(1,"json",
				this.main_widget.m_file_name.indexOf('<')>=0?
					UI.m_new_document_search_path:
					UI.GetPathFromFilename(this.main_widget.m_file_name));
			if(!fn){return;}
			this.m_file_name=fn
			this.main_widget.m_file_name=fn
			this.Save()
		},
		SaveMetaData:function(){
			if(this.main_widget){this.main_widget.SaveMetaData();}
		},
		OnDestroy:function(){
			if(this.main_widget){this.main_widget.OnDestroy();}
		},
		Reload:function(){
			if(this.main_widget){this.main_widget.Reload();}
		},
	})
	if(is_quiet){
		UI.top.app.document_area.current_tab_id=bk_current_tab_id;
	}
	return ret;
};
