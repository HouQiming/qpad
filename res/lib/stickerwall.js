"use strict"
var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");
require("res/lib/code_editor");
var H_MAX_STICKER=1440;
var SIZE_MIN=16;
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

UI.ParseNow=function(fn){
	UI.ED_ForceIntoParseQueueFront(fn);
	return UI.ED_ParseMore();
};

var ScaleKnob_prototype={
	OnMouseDown:function(event){
		var obj=this.owner;
		this.x_anchor=obj.x+obj.w*this.x_anchor_rel;
		this.y_anchor=obj.y+obj.h*this.y_anchor_rel;
		this.dx_base=(obj.x+obj.w*(1-this.x_anchor_rel)-this.x_anchor);
		this.dy_base=(obj.y+obj.h*(1-this.y_anchor_rel)-this.y_anchor);
		this.drag_x_anchor=this.x_anchor;
		this.drag_y_anchor=this.y_anchor;
		this.drag_x0=(obj.x-this.x_anchor);
		this.drag_y0=(obj.y-this.y_anchor);
		//this.drag_x1=(obj.x+obj.w-this.x_anchor);
		//this.drag_y1=(obj.y+obj.h-this.y_anchor);
		this.dx_center=(obj.x+obj.w*(1-this.x_anchor_rel))-event.x;
		this.dy_center=(obj.y+obj.h*(1-this.y_anchor_rel))-event.y;
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
		if(x_scale&&this.x_anchor_rel!=0.5){
			x_scale=Math.max(x_scale,SIZE_MIN/this.drag_w);
			obj.x=this.drag_x_anchor+this.drag_x0*x_scale;
			obj.w=this.drag_w*x_scale;
		}else{
			x_scale=1.0;
		}
		if(y_scale&&this.y_anchor_rel!=0.5){
			y_scale=Math.max(y_scale,SIZE_MIN/this.drag_h);
			obj.y=this.drag_y_anchor+this.drag_y0*y_scale;
			obj.h=this.drag_h*y_scale;
		}else{
			y_scale=1.0;
		}
		this.wall_owner.need_save=1;
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
		wall.need_save=1;
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

var TestQPadTag=function(doc,line_tag){
	var ccnt_tag=doc.SeekLC(line_tag,0);
	var s_line=doc.ed.GetText(ccnt_tag,Math.min(doc.ed.GetTextSize()-ccnt_tag,128));
	var pnewline=s_line.indexOf('\n');
	if(pnewline<0){pnewline=s_line.length;}
	var ptag=s_line.indexOf('//@qpad#');
	return ptag>=0&&ptag<pnewline;
};

UI.g_clipboard_flag_stickerwall='\u1234_a_\u5678_b_\uabcd_c_';
var g_clipboard_flag_stickerwall_re=new RegExp('^'+UI.g_clipboard_flag_stickerwall+'(.*)');
var g_sw_separator='\n=====\udbff\udfff stickerwall =====\n',g_sw_separator_re=new RegExp(g_sw_separator,'g');
var g_checker_shader=IO.UIReadAll("res/misc/checker.glsl");
var g_sticker_doc_plugins=[function(){
	this.AddEventHandler('ESC',function(){
		UI.SetFocus(this.m_sticker_wall_owner);
		UI.Refresh();
	});
}];
var g_unique_counter=0;
var CreateStickerID=function(){
	return IO.SHA1([UI.g_git_email,Date.now(),g_unique_counter++].join('&'));
};
var sticker_wall_prototype={
	InitSticker:function(sticker_i,text){
		sticker_i.text=undefined;
		switch(sticker_i.type){
		case "code":
			var fn_i=sticker_i.file_name;
			var fn_found=UI.SearchIncludeFile(this.m_file_name,fn_i);
			if(fn_found){fn_i=fn_found;}
			if(!IO.FileExists(fn_i)){
				console.log('referenced file not found: '+fn_i);
				break;
			}
			var doc_host=UI.OpenCodeEditorDocument(fn_i,-1);
			if(!doc_host.ed){
				doc_host.m_load_sync=1;
				doc_host.Init();
			}
			//keydecl queries have already taken the diff into account
			//var diff_host=doc_host.m_diff_from_parse;
			var ccnt_tag0=0,ccnt_tag1=0;
			if(!doc_host.ed.m_file_index){
				var parse_ret=UI.ParseNow(fn_i);
				if(parse_ret&&parse_ret.file_index){
					doc_host.ed.m_file_index=parse_ret.file_index;
				}
			}
			var decls=UI.ED_QueryKeyDeclByNeedle(doc_host,sticker_i.tag0_name);
			ccnt_tag0=((decls&&decls[(sticker_i.tag0_number||0)*2])||0);
			//if(diff_host){ccnt_tag0=diff_host.BaseToCurrent(ccnt_tag0);}
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
				//if(diff_host){ccnt_tag1=diff_host.BaseToCurrent(ccnt_tag1);}
			}
			if(ccnt_tag1>=ccnt_tag0){
				var line_tag0=doc_host.GetLC(ccnt_tag0)[0];
				var line_tag1=doc_host.GetLC(ccnt_tag1)[0];
				if(TestQPadTag(doc_host,line_tag0)){
					line_tag0++;
				}
				if(TestQPadTag(doc_host,line_tag1)){
					line_tag1--;
				}
				line_tag1++;
				ccnt_tag0=doc_host.SeekLC(line_tag0,0);
				ccnt_tag1=doc_host.SeekLC(line_tag1,0);
				if(ccnt_tag1>ccnt_tag0+1){
					ccnt_tag1--;
				}
				if(ccnt_tag1>ccnt_tag0){
					var doc_code=UI.OpenCodeEditorDocument(fn_i,-2);
					doc_code.m_sync_group_ccnt0=ccnt_tag0;
					doc_code.m_sync_group_ccnt1=ccnt_tag1;
					doc_code.show_background=0;
					doc_code.m_sticker_wall_owner=this;
					doc_code.disable_line_numbers=1;
					doc_code.disable_top_hint=1;
					doc_code.plugins=g_sticker_doc_plugins;
					doc_code.Init()
					sticker_i.doc=doc_code;
				}
			}else{
				console.log('bad sticker: '+JSON.stringify(sticker_i)+" "+ccnt0+" "+ccnt1);
			}
			UI.OpenEditorWindow(fn_i,function(){},"quite").NeedMainWidget();
			UI.CloseCodeEditorDocument(doc_host);
			break;
		case "note":
		case "group":
			var doc_note=UI.CreateEmptyCodeEditor("Markdown");
			//doc_note.plugins=this.m_cell_plugins;
			doc_note.m_enable_wrapping=1;
			doc_note.m_current_wrap_width=sticker_i.w/sticker_i.scale-UI.default_styles.code_editor.padding;
			doc_note.wrap_width=doc_note.m_current_wrap_width;
			doc_note.disable_x_scroll=1;
			doc_note.disable_top_hint=1;
			doc_note.show_background=0;
			doc_note.disable_line_numbers=1;
			doc_note.m_sticker_wall_owner=this;
			doc_note.plugins=g_sticker_doc_plugins;
			doc_note.Init();
			doc_note.scroll_x=0;doc_note.scroll_y=0;
			if(text){doc_note.ed.Edit([0,0,text],1);}
			doc_note.saved_point=doc_note.ed.GetUndoQueueLength();
			sticker_i.doc=doc_note;
			break;
		case "notebook_cell":
			//do nothing
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
		try{
			var s_file_data=(IO.ReadAll(fn)||'{"m_stickers":[]}');
			var parts=s_file_data.split(g_sw_separator);
			var obj_json=JSON.parse(parts[0]);
			if(obj_json.m_stickers){
				this.m_stickers=obj_json.m_stickers;
			}
			var ppart=1;
			for(var i=0;i<this.m_stickers.length;i++){
				var sticker_i=this.m_stickers[i];
				var text="";
				if(sticker_i.type=="note"||sticker_i.type=="group"){
					text=(parts[ppart++]||"");
				}
				this.InitSticker(sticker_i,text);
			}
		}catch(err){
			this.m_stickers=[];
		}
		var loaded_metadata=(UI.m_ui_metadata[this.m_file_name]||{});
		this.m_tr=loaded_metadata.tr;
	},
	TestNeedSave:function(){
		var ret=this.need_save;
		for(var i=0;i<this.m_stickers.length;i++){
			var sticker_i=this.m_stickers[i];
			if(sticker_i.type=="note"||sticker_i.type=="group"){
				var doc=sticker_i.doc;
				if(doc&&(doc.saved_point||0)!=doc.ed.GetUndoQueueLength()){
					ret|=2;
					break;
				}
			}
		}
		return ret;
	},
	Save:function(){
		var fn=this.m_file_name;
		var parts=[''];
		var docs=[];
		for(var i=0;i<this.m_stickers.length;i++){
			var sticker_i=this.m_stickers[i];
			if(sticker_i.type=="note"||sticker_i.type=="group"){
				parts.push(sticker_i.doc.ed.GetText());
			}
			docs[i]=sticker_i.doc;
			sticker_i.doc=undefined;
		}
		parts[0]=JSON.stringify({m_stickers:this.m_stickers});
		for(var i=0;i<this.m_stickers.length;i++){
			this.m_stickers[i].doc=docs[i];
		}
		var save_ret=UI.SafeSave(this.m_file_name,parts.join(g_sw_separator));
		if(!save_ret){
			return 0;
		}
		this.need_save=0;
		for(var i=0;i<this.m_stickers.length;i++){
			var sticker_i=this.m_stickers[i];
			if(sticker_i.type=="note"||sticker_i.type=="group"){
				var doc=sticker_i.doc;
				doc.saved_point=doc.ed.GetUndoQueueLength();
				doc.ResetSaveDiff();
			}
		}
		UI.RefreshAllTabs()
		return 1;
	},
	SaveMetaData:function(){
		var new_metadata=(UI.m_ui_metadata[this.m_file_name]||{});
		new_metadata.tr=this.m_tr;
		UI.m_ui_metadata[this.m_file_name]=new_metadata;
	},
	OnDestroy:function(){
		for(var i=0;i<this.m_stickers.length;i++){
			this.DestroyStickerEditor(this.m_stickers[i]);
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
		for(var passi=0;passi<2;passi++){
			for(var i=0;i<stickers.length;i++){
				var sticker_i=stickers[i];
				if((sticker_i.type==="group")!==(passi===0)){continue;}
				var style_i=this.sticker_styles[sticker_i.type];
				var x=sticker_i.x+tr.trans[0]/tr.scale;
				var y=sticker_i.y+tr.trans[1]/tr.scale;
				if(x>=this.w/tr.scale||y>=this.h/tr.scale||x+sticker_i.w<=0||y+sticker_i.h<=0){
					continue;
				}
				//measure size
				switch(sticker_i.type){
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
				case "code":
				case "notebook_cell":
				case "group":
					//do nothing - let the user resize it
					sticker_i.disable_y_scale=0;
					break;
				//case "script":
				//	break;
				//case "image":
				//	break;
				}
				//moving borders
				if(!sticker_i.__unique_id){
					sticker_i.__unique_id=CreateStickerID();
				}
				var sticker_name=("sticker_"+sticker_i.__unique_id);
				W.Region(sticker_name+"_move_knob",{
					x:x-move_padding,y:y-common_style.h_caption-move_padding,
					w:sticker_i.w+move_padding*2,
					h:sticker_i.h+common_style.h_caption+move_padding*2,
					owner:sticker_i,
					wall_owner:this,
					mouse_cursor:"sizeall",
				},MoveKnob_prototype);
				//render background
				if(sticker_i.type!=="group"){
					UI.RoundRect({
						x:x-common_style.padding,y:y-common_style.h_caption-common_style.padding,
						w:sticker_i.w+common_style.padding*2+common_style.shadow_size,h:sticker_i.h+common_style.h_caption+common_style.padding*2+common_style.shadow_size,
						round:common_style.shadow_size,
						border_width:-common_style.shadow_size,
						color:common_style.shadow_color,
					});
				}
				UI.RoundRect({
					x:x-common_style.padding,y:y-common_style.h_caption-common_style.padding,
					w:sticker_i.w+common_style.padding*2,h:sticker_i.h+common_style.h_caption+common_style.padding*2,
					color:style_i.bgcolor,
					border_width:sticker_i.m_is_selected?common_style.selection_width/tr.scale:0,
					border_color:common_style.selection_color,
				});
				//render content
				var dx_subwin=Math.min(x,0)/sticker_i.scale;
				var dy_subwin=Math.min(y,0)/sticker_i.scale;
				UI.PushSubWindow(x,y,sticker_i.w,Math.ceil(sticker_i.h),sticker_i.scale)
				switch(sticker_i.type){
				case "code":
					W.CodeEditor(sticker_name,{
						disable_minimap:1,
						doc:sticker_i.doc,
						show_background:0,
						x:dx_subwin,y:dy_subwin,
						w:sticker_i.w/sticker_i.scale,h:sticker_i.h/sticker_i.scale,
					});
					sticker_i.doc.default_focus=sticker_i.m_is_selected+1;
					sticker_i.doc.OnFocus=function(sticker_i){
						if(sticker_i.m_is_selected){return;}
						this.ClearSelection();
						this.AutoScrollToShow(sticker_i);
						sticker_i.m_is_selected=1;
						UI.Refresh();
					}.bind(this,sticker_i);
					break;
				case "note":
				case "group":
					W.CodeEditor(sticker_name,{
						disable_minimap:1,
						doc:sticker_i.doc,
						show_background:0,
						x:dx_subwin,y:dy_subwin,
						w:sticker_i.w/sticker_i.scale,h:sticker_i.h/sticker_i.scale,
					});
					sticker_i.doc.default_focus=sticker_i.m_is_selected+1;
					sticker_i.doc.OnFocus=function(sticker_i){
						if(sticker_i.m_is_selected){return;}
						this.ClearSelection();
						this.AutoScrollToShow(sticker_i);
						sticker_i.m_is_selected=1;
						UI.Refresh();
					}.bind(this,sticker_i);
					break;
				case "notebook_cell":
					//one big button, locate mark and run
					//caption
					W.Button(sticker_name,{
						x:dx_subwin,y:dy_subwin,
						w:sticker_i.w/sticker_i.scale,h:sticker_i.h/sticker_i.scale,
						text:sticker_i.caption,
						//tooltip:UI.Format("Run notebook cell '@1'",sticker_i.caption),
						border_width:0,
						OnClick:function(sticker_i){
							var result_cell=UI.OpenNotebookCellFromEditor(this,"[button: "+sticker_i.caption+"]","Plain text",0,"output");
							if(result_cell){
								var bk_active_tab=UI.top.app.document_area.active_tab;
								var obj_notebook=result_cell.obj_notebook;
								if(obj_notebook.RunCell(result_cell.cell_id)=="focus"){
									//if we got a cancel notification...
									bk_active_tab=undefined;
								}
								if(bk_active_tab!=undefined){
									UI.top.app.document_area.BringUpTab(bk_active_tab.__global_tab_id)
									UI.SetFocus(this);
								}
							}
							UI.Refresh();
						}.bind(this,sticker_i),
					});
					break;
				//case "script":
				//	break;
				//case "image":
				//	break;
				}
				UI.PopSubWindow();
			}
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
				var y0=y-common_style.h_caption-common_style.padding-dy;
				var x2=x0+sticker_i.w+common_style.padding*2;
				var y2=y0+common_style.h_caption+sticker_i.h+common_style.padding*2;
				var x1=(x0+x2)*0.5;
				var y1=(y0+y2)*0.5;
				knob.x=x0;knob.y=y0;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob00",{x_anchor_rel:2*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,x_anchor:x2+dx,y_anchor:y2+dy,mouse_cursor:"sizenwse"},ScaleKnob_prototype);
				knob.x=x1;knob.y=y0;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob10",{x_anchor_rel:1*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,y_anchor:y2+dy,mouse_cursor:"sizens"},ScaleKnob_prototype);
				knob.x=x2;knob.y=y0;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob20",{x_anchor_rel:0*0.5,y_anchor_rel:2*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,x_anchor:x0+dx,y_anchor:y2+dy,mouse_cursor:"sizenesw"},ScaleKnob_prototype);
				knob.x=x0;knob.y=y1;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob01",{x_anchor_rel:2*0.5,y_anchor_rel:1*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,x_anchor:x2+dx,mouse_cursor:"sizewe"},ScaleKnob_prototype);
				knob.x=x2;knob.y=y1;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob21",{x_anchor_rel:0*0.5,y_anchor_rel:1*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,x_anchor:x0+dx,mouse_cursor:"sizewe"},ScaleKnob_prototype);
				knob.x=x0;knob.y=y2;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob02",{x_anchor_rel:2*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,x_anchor:x2+dx,y_anchor:y0+dy,mouse_cursor:"sizenesw"},ScaleKnob_prototype);
				knob.x=x1;knob.y=y2;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob12",{x_anchor_rel:1*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,y_anchor:y0+dy,mouse_cursor:"sizens"},ScaleKnob_prototype);
				knob.x=x2;knob.y=y2;UI.RoundRect(knob);W.Region(sticker_name+"_scale_knob22",{x_anchor_rel:0*0.5,y_anchor_rel:0*0.5,x:knob.x,y:knob.y,w:knob.w,h:knob.h,wall_owner:this,owner:sticker_i,x_anchor:x0+dx,y_anchor:y0+dy,mouse_cursor:"sizenwse"},ScaleKnob_prototype);
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
	DestroyStickerEditor:function(sticker_i){
		if(!sticker_i.doc){return;}
		if(sticker_i.type=="note"||sticker_i.type=="group"){
			sticker_i.text=sticker_i.doc.ed.GetText();
			sticker_i.doc.OnDestroy();
			sticker_i.doc=undefined;
		}else{
			UI.CloseCodeEditorDocument(sticker_i.doc);
			sticker_i.doc=undefined;
		}
	},
	DeleteSelection:function(){
		var stickers=this.m_stickers;
		var deleted_stickers=[];
		var n2=0;
		for(var i=0;i<stickers.length;i++){
			var sticker_i=stickers[i];
			if(!sticker_i.m_is_selected){
				stickers[n2]=sticker_i;
				n2++;
			}else{
				this.DestroyStickerEditor(sticker_i);
				deleted_stickers.push(sticker_i);
			}
		}
		stickers.length=n2;
		if(deleted_stickers){
			UI.SDL_SetClipboardText(UI.g_clipboard_flag_stickerwall+JSON.stringify(deleted_stickers));
		}
		UI.Refresh();
		this.need_save=1;
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
					if(x0<x&&x<x1&&y0<y&&y<y1&&sticker_i.type!="group"){
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
		this.ClearSelection();
		new_sticker.m_is_selected=1;
		this.m_stickers.push(new_sticker);
		this.InitSticker(new_sticker,new_sticker.text||"");
		//auto scroll
		this.AutoScrollToShow(new_sticker)
		this.need_save=1;
	},
	AutoScrollToShow:function(sticker_i){
		this.m_tr.trans[0]=-Math.min(Math.max(-this.m_tr.trans[0],(sticker_i.x+sticker_i.w)*this.m_tr.scale+8-this.w),sticker_i.x*this.m_tr.scale-8);
		this.m_tr.trans[1]=-Math.min(Math.max(-this.m_tr.trans[1],(sticker_i.y+sticker_i.h)*this.m_tr.scale+8-this.h),sticker_i.y*this.m_tr.scale-8);
	},
	InsertNote:function(){
		var new_sticker={
			"type":"note",
			"w":300,"h":32,
			"scale":0.8,
		};
		this.PlaceSticker(new_sticker);
		UI.Refresh();
	},
	InsertGroup:function(){
		var new_sticker={
			"type":"group",
			"w":300,"h":300,
			"scale":1.25,
		};
		this.PlaceSticker(new_sticker);
		UI.Refresh();
	},
	Paste:function(){
		var new_sticker=undefined;
		var text=UI.SDL_GetClipboardText();
		var match=text.match(g_clipboard_flag_stickerwall_re);
		if(match){
			try{
				new_sticker=JSON.parse(match[1]);
				if(match[1][0]=='['){
					//pasting cut stickers
					this.ClearSelection();
					for(var i=0;i<new_sticker.length;i++){
						var sticker_i=new_sticker[i];
						this.InitSticker(sticker_i,sticker_i.text||"");
						this.m_stickers.push(sticker_i);
						sticker_i.m_is_selected=1;
					}
					this.need_save=1;
					UI.Refresh();
					return;
				}
			}catch(err){
				return;
			}
			//code
			if(new_sticker.type=="code"){
				new_sticker.scale=1;
				new_sticker.w=800;
				new_sticker.h=300;
				if(this.m_file_name&&this.m_file_name[0]!='<'){
					new_sticker.file_name=UI.ComputeRelativePath(this.m_file_name,new_sticker.file_name);
				}
			}else if(new_sticker.type=="notebook_cell"){
				new_sticker.scale=1;
				new_sticker.w=256;
				new_sticker.h=32;
			}
		}else{
			//note
			new_sticker={
				"type":"note",
				"w":300,"h":300,
				"scale":1,
				"text":text,
			};
		}
		this.PlaceSticker(new_sticker);
		UI.Refresh();
	},
	MultiplyScale:function(scale){
		var stickers=this.m_stickers;
		for(var i=0;i<stickers.length;i++){
			if(stickers[i].m_is_selected){
				stickers[i].scale*=scale;
			}
		}
		this.need_save=1;
		UI.Refresh();
	},
	GotoOriginal:function(){
		var stickers=this.m_stickers;
		for(var i=0;i<stickers.length;i++){
			if(stickers[i].m_is_selected&&stickers[i].type=="code"){
				var sticker_i=stickers[i];
				UI.OpenEditorWindow(sticker_i.doc.m_file_name,function(){
					UI.SetSelectionEx(this,
						sticker_i.doc.sel0.ccnt+sticker_i.doc.ed.QueryMySyncGroupOffset(),
						sticker_i.doc.sel1.ccnt+sticker_i.doc.ed.QueryMySyncGroupOffset(),
						'sticker_goto');
				});
				break;
			}
		}
		UI.Refresh();
	},
	MoveCursorKeyboard:function(dx,dy){
		var sel_x=-dx*10000;
		var sel_y=-dy*10000;
		var stickers=this.m_stickers;
		for(var i=0;i<stickers.length;i++){
			if(stickers[i].m_is_selected){
				sel_x=stickers[i].x;
				sel_y=stickers[i].y;
				break;
			}
		}
		var best_cosine=0;
		for(var i=0;i<stickers.length;i++){
			var dx_i=stickers[i].x-sel_x;
			var dy_i=stickers[i].y-sel_y;
			var ilg=1.0/Math.sqrt(dx_i*dx_i+dy_i*dy_i);
			if(ilg>0){
				dx_i*=ilg;
				dy_i*=ilg;
			}else{
				continue;
			}
			var cosine=dx_i*dx+dy_i*dy;
			if(best_cosine<cosine){
				best_cosine=cosine;
			}
		}
		var best_lg=1e10;
		var best_i=-1;
		for(var i=0;i<stickers.length;i++){
			var dx_i=stickers[i].x-sel_x;
			var dy_i=stickers[i].y-sel_y;
			var lg=Math.sqrt(dx_i*dx_i+dy_i*dy_i);
			var ilg=1.0/lg;
			if(ilg>0){
				dx_i*=ilg;
				dy_i*=ilg;
			}else{
				continue;
			}
			var cosine=dx_i*dx+dy_i*dy;
			if(cosine>best_cosine*0.9&&best_lg>lg){
				best_lg=lg;
				best_i=i;
			}
		}
		if(best_i>=0){
			this.ClearSelection();
			stickers[best_i].m_is_selected=1;
		}
		UI.Refresh();
	},
	MoveSelectionKeyboard:function(dx,dy){
		for(var i=0;i<this.m_stickers.length;i++){
			var sticker_i=this.m_stickers[i];
			if(sticker_i.m_is_selected){
				sticker_i.x+=dx;
				sticker_i.y+=dy;
			}
		}
		this.need_save=1;
		UI.Refresh();
	},
	ResizeSelectionKeyboard:function(dx,dy){
		for(var i=0;i<this.m_stickers.length;i++){
			var sticker_i=this.m_stickers[i];
			if(sticker_i.m_is_selected){
				sticker_i.w+=dx;
				sticker_i.h+=dy;
			}
		}
		this.need_save=1;
		UI.Refresh();
	},
};
W.StickerWall=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"sticker_wall",sticker_wall_prototype);
	UI.Begin(obj)
	W.PureRegion(id,obj)
	if(!obj.m_is_inited){
		var bk_active_tab=UI.top.app.document_area.active_tab;
		obj.Init();
		UI.top.app.document_area.BringUpTab(bk_active_tab.__global_tab_id)
		UI.SetFocus(obj);
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
				this.need_save=body.TestNeedSave();
				this.title=UI.Format("@1 (Sticker wall)",s_name)+(this.need_save?'*':'');
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
			this.need_save=this.main_widget.TestNeedSave();
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
			//new sticker buttons
			var has_any_sel=0;
			var has_code_sel=0;
			for(var i=0;i<body.m_stickers.length;i++){
				if(body.m_stickers[i].m_is_selected){
					has_any_sel=1;
					if(body.m_stickers[i].type=="code"){
						has_code_sel=1;
					}
				}
			}
			var x_current=0;
			x_current+=W.Button("new_note",{
				x:x_current,y:0,
				w:32,h:32,
				font:UI.Font(UI.icon_font_name,28),
				text:"T",
				tooltip:"Add note - CTRL+M",
				OnClick:function(){body.InsertNote();},
			}).w;
			//if(UI.HasFocus(body)){
			W.Hotkey("",{
				key:"CTRL+M",
				action:function(){body.InsertNote();},
			});
			//}
			x_current+=W.Button("new group",{
				x:x_current,y:0,
				w:32,h:32,
				font:UI.Font(UI.icon_font_name,28),
				text:"组",
				tooltip:"Add group - SHIFT+CTRL+M",
				OnClick:function(){body.InsertGroup();},
			}).w;
			W.Hotkey("",{
				key:"SHIFT+CTRL+M",
				action:function(){body.InsertGroup();},
			});
			if(has_any_sel){
				x_current+=W.Button("del_note",{
					x:x_current,y:0,
					w:32,h:32,
					font:UI.Font(UI.icon_font_name,28),
					text:"剪",
					tooltip:"Cut stickers - SHIFT+CTRL+X",
					OnClick:function(){body.DeleteSelection();},
				}).w;
				W.Hotkey("",{
					key:"SHIFT+CTRL+X",
					action:function(){body.DeleteSelection();},
				});
				if(UI.HasFocus(body)){
					W.Hotkey("",{
						key:"DELETE",
						action:function(){body.DeleteSelection();},
					});
				}
			}
			if(UI.SDL_HasClipboardText()){
				x_current+=W.Button("paste",{
					x:x_current,y:0,
					w:32,h:32,
					font:UI.Font(UI.icon_font_name,28),
					text:"粘",
					tooltip:"Paste - CTRL+V",
					OnClick:function(){body.Paste();},
				}).w;
				if(UI.HasFocus(body)){
					W.Hotkey("",{
						key:"CTRL+V",
						action:function(){body.Paste();},
					});
				}
			}
			if(has_any_sel){
				x_current+=W.Button("font_bigger",{
					x:x_current,y:0,
					w:32,h:32,
					font:UI.Font(UI.icon_font_name,28),
					text:"大",
					tooltip:"Bigger font - SHIFT+CTRL+'+'",
					OnClick:function(){
						body.MultiplyScale(1.105);
					},
				}).w;
				x_current+=W.Button("font_smaller",{
					x:x_current,y:0,
					w:32,h:32,
					font:UI.Font(UI.icon_font_name,28),
					text:"小",
					tooltip:"Smaller font - SHIFT+CTRL+'-'",
					OnClick:function(){
						body.MultiplyScale(1.0/1.105);
					},
				}).w;
				//if(UI.HasFocus(body)){
				W.Hotkey("",{
					key:"SHIFT+CTRL+-",
					action:function(){body.MultiplyScale(1.0/1.105);},
				});
				W.Hotkey("",{
					key:"SHIFT+CTRL+=",
					action:function(){body.MultiplyScale(1.105);},
				});
				//}
			}
			if(has_code_sel){
				x_current+=W.Button("goto_code",{
					x:x_current,y:0,
					w:32,h:32,
					font:UI.Font(UI.icon_font_name,28),
					text:"去",
					tooltip:"Go to original - CTRL+ALT+G",
					OnClick:function(){
						body.GotoOriginal();
					},
				}).w;
				W.Hotkey("",{
					key:"CTRL+ALT+G",
					action:function(){body.GotoOriginal();},
				});
			}
			if(UI.HasFocus(body)){
				W.Hotkey("",{
					key:"ESC",
					action:function(){
						for(var i=0;i<body.m_stickers.length;i++){
							var sticker_i=body.m_stickers[i];
							if(sticker_i.m_is_selected&&sticker_i.doc){
								UI.SetFocus(sticker_i.doc);
								UI.Refresh();
								break;
							}
						}
					},
				});
				////////////////////
				//moving the cursor
				W.Hotkey("",{
					key:"UP",
					action:function(){
						//what is "up"? angle-based test
						body.MoveCursorKeyboard(0,-1);
					},
				});
				W.Hotkey("",{
					key:"DOWN",
					action:function(){
						body.MoveCursorKeyboard(0,1);
					},
				});
				W.Hotkey("",{
					key:"LEFT",
					action:function(){
						body.MoveCursorKeyboard(-1,0);
					},
				});
				W.Hotkey("",{
					key:"RIGHT",
					action:function(){
						body.MoveCursorKeyboard(1,0);
					},
				});
				////////////////////
				//move the stickers... by a fixed amount
				W.Hotkey("",{
					key:"SHIFT+UP",
					action:function(){
						body.MoveSelectionKeyboard(0,-32);
					},
				});
				W.Hotkey("",{
					key:"SHIFT+DOWN",
					action:function(){
						body.MoveSelectionKeyboard(0,32);
					},
				});
				W.Hotkey("",{
					key:"SHIFT+LEFT",
					action:function(){
						body.MoveSelectionKeyboard(-32,0);
					},
				});
				W.Hotkey("",{
					key:"SHIFT+RIGHT",
					action:function(){
						body.MoveSelectionKeyboard(32,0);
					},
				});
				////////////////////
				//resizing the sticker
				W.Hotkey("",{
					key:"CTRL+UP",
					action:function(){
						body.ResizeSelectionKeyboard(0,-32);
					},
				});
				W.Hotkey("",{
					key:"CTRL+DOWN",
					action:function(){
						body.ResizeSelectionKeyboard(0,32);
					},
				});
				W.Hotkey("",{
					key:"CTRL+LEFT",
					action:function(){
						body.ResizeSelectionKeyboard(-32,0);
					},
				});
				W.Hotkey("",{
					key:"CTRL+RIGHT",
					action:function(){
						body.ResizeSelectionKeyboard(32,0);
					},
				});
			}
			//file name
			var name_did={};
			var s_file_name=undefined;
			for(var i=0;i<body.m_stickers.length;i++){
				var sticker_i=body.m_stickers[i];
				if(sticker_i.m_is_selected){
					if(sticker_i.type=="code"&&sticker_i.doc){
						//if(!name_did[sticker_i.file_name]){
						//	name_did[sticker_i.file_name]=1;
						s_file_name=sticker_i.file_name;
						if(UI.HasFocus(sticker_i.doc)){
							break;
						}
					}
				}
			}
			W.Text("",{
				x:x_current+8,y:2,
				font:UI.Font(UI.font_name,24),
				text:s_file_name,
				color:common_style.file_name_color,
			});
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
			var fn=IO.DoFileDialog(1,"wall",
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
