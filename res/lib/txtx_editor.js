var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");

//todo: inserting objects - editor hook, file dlg - gallery dlg - additional_hotkeys
//CreateEmbeddedImageFromFileData, PickImage
COMMAND_INSERT_OBJECT=0x100000
COMMAND_RUBBER_SPACE=0x107fff
COMMAND_SET_STYLE=0x108000
COMMAND_END=0x110000
STYLE_UNDERLINED=1
STYLE_STRIKE_OUT=2
STYLE_SUPERSCRIPT=4
STYLE_SUBSCRIPT=8
STYLE_FONT_BOLD=(1<<16)
STYLE_FONT_ITALIC=(1<<17)
!?
STYLE_FONT_TYPE_WRITER=(1<<18)
STYLE_FONT_SANS_SERIF=(1<<19)
LEVEL_CHAPTER=0
LEVEL_SECTION=1
LEVEL_SUBSECTION=2
LEVEL_PARAGRAPH=3
LEVEL_NORMAL=4
LEVEL_SMALL=5
////////////////
var g_computer_modern_flags=[STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,STYLE_FONT_SANS_SERIF|STYLE_FONT_BOLD,0,0];
var g_computer_modern_sizes=[48,48,42,30,30,24];
var g_GetFontFromStyle_callbacks={
	"computer_modern":function(params){
		var font_name;
		var level=(params.level);
		var flags=(params.flags||0)^g_computer_modern_flags[level];
		var size=g_computer_modern_sizes[level];
		var embolden=0;
		if(flags&STYLE_FONT_TYPE_WRITER){
			if(flags&STYLE_FONT_BOLD){
				if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmuntx.ttf";}else{font_name="res/fonts/cmuntb.ttf";}
			}else if(flags&STYLE_FONT_ITALIC){
				font_name="res/fonts/cmunit.ttf";
			}else{
				font_name="res/fonts/cmuntt.ttf"
			}
		}else if(flags&STYLE_FONT_SANS_SERIF){
			if(flags&STYLE_FONT_BOLD){
				if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmunso.ttf";}else{font_name="res/fonts/cmunsx.ttf"}
			}else if(flags&STYLE_FONT_ITALIC){
				font_name="res/fonts/cmunsi.ttf";
			}else{
				font_name="res/fonts/cmunss.ttf";
			}
		}else{
			if(flags&STYLE_FONT_BOLD){
				if(flags&STYLE_FONT_ITALIC){font_name="res/fonts/cmunbi.ttf";}else{font_name="res/fonts/cmunbx.ttf"}
			}else if(flags&STYLE_FONT_ITALIC){
				font_name="res/fonts/cmunci.ttf";
			}else{
				font_name="res/fonts/cmunrm.ttf";
			}
		}
		//print(font_name,size,JSON.stringify(params));
		return UI.Font(font_name,size,embolden)
	},
};
var GetFontFromStyle=function(name,params){
	return g_GetFontFromStyle_callbacks[name](params);
};
////////////////
var TxtxEditor_prototype=Object.create(W.Edit_prototype)
TxtxEditor_prototype.state_handlers=["renderer_fancy","line_column_unicode"];
TxtxEditor_prototype.wrap_width=1024;
TxtxEditor_prototype.root_style_name="computer_modern";
//TxtxEditor_prototype.disable_scrolling_x=1
////////////////
TxtxEditor_prototype.GetStyleIDAt=function(ccnt){
	var ed=this.ed;
	return ed.GetStateAt(ed.m_handler_registration["renderer"],ccnt,"ddl")[2];
};
TxtxEditor_prototype.GetCurrentStyleObject=function(){
	var style_id=this.GetStyleIDAt(this.GetSelection()[0]);
	return this.styles[style_id];
};
TxtxEditor_prototype.Init=function(){
	this.m_style_map={};
	this.styles=[];
	this.CreateStyle({color:0xff000000,level:LEVEL_NORMAL,flags:0})
	W.Edit_prototype.Init.call(this);
};
TxtxEditor_prototype.HookedEdit=function(ops){
	var ed=this.ed;
	for(var i=0;i<ops.length;i+=3){
		if(ops[i+1]){
			//there is deletion, preserve the style
			var s_original=ed.GetText(ops[i+0],ops[i+1]);
			for(var j=s_original.length-1;j>=0;j--){
				var ch=s_original.charCodeAt(j);
				if(ch>=COMMAND_SET_STYLE&&ch<COMMAND_END){
					ops[i+2]=Duktape.__utf8_fromCharCode(ch)+(ops[i+2]||"");
					break;
				}
			}
		}
	}
	ed.Edit(ops);
};
TxtxEditor_prototype.GetRenderer=function(){
	var ed=this.ed;
	return ed.GetHandlerByID(ed.m_handler_registration["renderer"]);
};
TxtxEditor_prototype.CreateStyle=function(params){
	var name=[this.root_style_name,(params.level||0),(params.flags||0),(params.color||0xff000000)].join("_")
	if(this.m_style_map[name]){
		return this.m_style_map[name];
	}
	this.m_style_map[name]=this.styles.length;
	params.font=GetFontFromStyle(this.root_style_name,params);
	this.styles.push(params);
	var ed=this.ed;
	if(ed){
		var handler=ed.GetHandlerByID(ed.m_handler_registration["renderer"]);
		handler.UpdateStyles(this.styles);
	}
	return this.m_style_map[name];
};
TxtxEditor_prototype.SetTextStyle=function(params,sel){
	if(!sel)sel=this.GetSelection();
	var sid=this.CreateStyle(params);
	var ed=this.ed;
	var s_style=Duktape.__utf8_fromCharCode(COMMAND_SET_STYLE+sid);
	var sel_side=(this.sel0.ccnt<this.sel1.ccnt);
	var ops;
	var new_sel;
	ops=[sel[0],0,s_style];
	new_sel=[sel[0]+Duktape.__byte_length(s_style),sel[1]+Duktape.__byte_length(s_style)]
	if(sel[0]<sel[1]){
		var s_original=ed.GetText(sel[0],sel[1]-sel[0]);
		var s_wiped=UI.RemoveStylingCharacters(s_original);
		var sid_original=this.GetStyleIDAt(sel[1]);
		if(s_wiped!=s_original){
			ops=[sel[0],sel[1]-sel[0],s_style+s_wiped+Duktape.__utf8_fromCharCode(COMMAND_SET_STYLE+sid_original)];
			new_sel[1]=new_sel[0]+Duktape.__byte_length(s_wiped)
		}else{
			if(sid_original!=sid){
				ops.push(sel[1])
				ops.push(0)
				ops.push(Duktape.__utf8_fromCharCode(COMMAND_SET_STYLE+sid_original))
			}
		}
	}
	ed.Edit(ops);
	if(sel_side==1){
		this.sel0.ccnt=new_sel[0];
		this.sel1.ccnt=new_sel[1];
	}else{
		this.sel0.ccnt=new_sel[1];
		this.sel1.ccnt=new_sel[0];
	}
	UI.Refresh()
};
var s_rubber_space=Duktape.__utf8_fromCharCode(COMMAND_RUBBER_SPACE);
var lg_rubber_space=Duktape.__byte_length(s_rubber_space);
TxtxEditor_prototype.GetEnhancedHome=function(ccnt0){
	var ed=this.ed;
	var ccnt=this.SeekLC(this.GetLC(ccnt0)[0],0);
	if(ed.GetText(ccnt,lg_rubber_space)==s_rubber_space){
		ccnt+=lg_rubber_space;
	}
	ccnt=this.SnapToVisualBoundary(this.ed.MoveToBoundary(ccnt,1,"space"),1);
	//todo: numbering
	return ccnt;
}
TxtxEditor_prototype.GetEnhancedEnd=function(ccnt0){
	var ed=this.ed;
	var ccnt=this.SeekLC(this.GetLC(ccnt0)[0],1e17);if(ccnt>0&&ed.GetText(ccnt-1,1)=="\n"){ccnt--;}
	if(ed.GetText(ccnt-lg_rubber_space,lg_rubber_space)==s_rubber_space){
		ccnt-=lg_rubber_space;
	}
	return this.SnapToVisualBoundary(this.ed.MoveToBoundary(ccnt,-1,"space"),-1);
}
TxtxEditor_prototype.GetLineSelection=function(){
	var sel=this.GetSelection();
	sel[0]=this.GetEnhancedHome(sel[0])
	sel[1]=Math.max(this.GetEnhancedEnd(sel[1]),sel[0])
	return sel;
}
TxtxEditor_prototype.SetRubberPadding=function(line0,line1,mask){
	var line_ccnts=[];
	for(var i=line0;i<=line1;i++){
		line_ccnts.push(this.SeekLC(i,0));
	}
	var ed=this.ed;
	var ops=[];
	for(var i=0;i<line_ccnts.length-1;i++){
		var ccnt0=line_ccnts[i];
		var ccnt1=line_ccnts[i+1];
		var lg0=0,lg1=0;
		if(ccnt1>0&&ed.GetText(ccnt1-1,1)=="\n"){ccnt1--;}
		if(ccnt0>ccnt1){break;}
		if(ed.GetText(ccnt0,lg_rubber_space)==s_rubber_space){
			lg0=lg_rubber_space;
		}
		if(ccnt1>ccnt0+lg0&&ed.GetText(ccnt1-lg_rubber_space,lg_rubber_space)==s_rubber_space){
			lg1=lg_rubber_space;
			ccnt1-=lg1;
		}
		if(lg0||(mask&1)){
			ops.push(ccnt0)
			ops.push(lg0)
			ops.push((mask&1)?s_rubber_space:null)
		}
		if(lg1||(mask&2)){
			ops.push(ccnt1)
			ops.push(lg1)
			ops.push((mask&2)?s_rubber_space:null)
		}
	}
	if(ops.length){
		this.HookedEdit(ops)
		this.CallOnChange()
		UI.Refresh();
	}
}
TxtxEditor_prototype.additional_hotkeys=[
	{key:"CTRL+B",action:function(obj){
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:(cur_state.level),flags:((cur_state.flags||0)^STYLE_FONT_BOLD)})
	}},
	{key:"CTRL+I",action:function(obj){
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:(cur_state.level),flags:((cur_state.flags||0)^STYLE_FONT_ITALIC)})
	}},
	{key:"ALT+SHIFT+LEFT",action:function(obj){
		var sel=obj.GetLineSelection();
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:Math.max((cur_state.level)-1,0),flags:(cur_state.flags||0)},sel)
	}},
	{key:"ALT+SHIFT+RIGHT",action:function(obj){
		var sel=obj.GetLineSelection();
		var cur_state=obj.GetCurrentStyleObject();
		obj.SetTextStyle({color:cur_state.color,level:Math.min((cur_state.level)+1,LEVEL_SMALL),flags:(cur_state.flags||0)},sel)
	}},
	{key:"CTRL+L",action:function(obj){
		var sel=obj.GetSelection();
		obj.SetRubberPadding(obj.GetLC(sel[0])[0],obj.GetLC(sel[1])[0]+1,0)
	}},
	{key:"CTRL+E",action:function(obj){
		var sel=obj.GetSelection();
		obj.SetRubberPadding(obj.GetLC(sel[0])[0],obj.GetLC(sel[1])[0]+1,3)
	}},
	{key:"CTRL+R",action:function(obj){
		var sel=obj.GetSelection();
		obj.SetRubberPadding(obj.GetLC(sel[0])[0],obj.GetLC(sel[1])[0]+1,1)
	}},
	//todo: event-listening plugin: 1. 2. 3. centering and stuff
	{key:"ALT+I",action:function(obj){
		var img_name=UI.PickImage();
		if(!img_name){return;}
		var s_data=IO.ReadAll(img_name)
		if(!s_data){return;}//todo: show error notification
		var obj_img=UI.CreateEmbeddedImageFromFileData(s_data);
		if(!obj_img){return;}//todo: show error notification
		var oid=obj.GetRenderer().InsertObject(obj_img,obj_img.w,obj_img.h,obj_img.h)
		obj.OnTextInput({"text":Duktape.__utf8_fromCharCode(COMMAND_INSERT_OBJECT+oid)})
	}},
];
var InitPrototype=function(){
	if(!TxtxEditor_prototype.hyphenator){
		TxtxEditor_prototype.hyphenator=UI.ParseHyphenator(IO.UIReadAll("res/misc/ushyphmax.tex"));
	}
};

UI.CreateTxtxDocument=function(attrs){
	//todo: loading from file
	InitPrototype();
	var ret=Object.create(TxtxEditor_prototype);
	ret.wrap_width=(attrs.wrap_width||attrs.w);
	ret.w=attrs.w;
	ret.h=attrs.h;
	ret.Init();
	return ret;
};

W.TxtxEditor=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "txtx_editor",obj.focus_state||"blur");
	UI.StdAnchoring(id,obj);
	UI.RoundRect(obj)
	UI.Begin(obj)
		//handle page properties
		var w0=obj.page_margin_left
		var w1=obj.page_width
		var w2=obj.page_margin_right
		//todo: not-wide-enough case
		InitPrototype();
		var doc=W.Edit("doc",{
			'x':obj.x+w0,'y':obj.y,'w':w1+w2,'h':obj.h,
			'wrap_width':w1,
		},TxtxEditor_prototype)
		var renderer=doc.GetRenderer();
		var embeded_objects=renderer.g_rendered_objects;
		if(embeded_objects.length){
			var fanchortransform=UI.HackCallback(function(){
				var real_obj=renderer.GetObject(this.numerical_id);
				this.translate_y_original=this.y;
				this.translate_y_baseline=real_obj.y_baseline;
				this.baseline_ratio=real_obj.y_baseline/real_obj.h;
				this.scale_w_original=real_obj.w
				this.scale_h_original=real_obj.h
			})
			var fonchange=UI.HackCallback(function(tr){
				var real_obj=renderer.GetObject(this.numerical_id);
				if(tr.translation){
					real_obj.y_baseline=this.translate_y_baseline-(tr.translation[1]);
				}else{
					real_obj.w=this.scale_w_original*tr.scale[0]
					real_obj.h=this.scale_h_original*tr.scale[1]
					real_obj.y_baseline=this.baseline_ratio*real_obj.h;
				}
				doc.ed.InvalidateStates([this.ccnt,lg_rubber_space])
				UI.Refresh()
			})
			for(var i=0;i<embeded_objects.length;i++){
				var obj_i=embeded_objects[i];
				obj_i.id="$"+obj_i.numerical_id;
				obj_i.AnchorTransform=fanchortransform;
				obj_i.SetTransform=fonchange;
			}
			//region-less boxDocument
			W.BoxDocument("embeded_objects",{
				'x':0,'y':0,'w':obj.x+w0+w1+w2,'h':obj.y+obj.h,
				'items':embeded_objects,
				'disable_region':1,
			})
		}
	UI.End()
	/*
	W.PureRegion(id,obj)
	var doc=obj.doc;
	UI.DrawBitmap(0,obj.x,obj.y,obj.w,obj.h,obj.bgcolor);
	var scale=obj.scale;
	var scroll_x=doc.scroll_x;
	var scroll_y=doc.scroll_y;
	var ed=doc.ed;
	ed.Render({x:scroll_x,y:scroll_y,w:obj.w/scale,h:obj.h/scale, scr_x:obj.x,scr_y:obj.y, scale:scale});
	if(!obj.is_read_only){
		if(doc.w!=obj.w/scale||doc.h!=obj.h/scale){
			doc.w=obj.w/scale;
			doc.h=obj.h/scale;
			UI.Refresh()
		}
		doc.x=obj.x;doc.y=obj.y;
		if(UI.HasFocus(obj)){
			var ed_caret=doc.GetCaretXY();
			var x_caret=obj.x+(ed_caret.x-scroll_x+ed.m_caret_offset)*scale;
			var y_caret=obj.y+(ed_caret.y-scroll_y)*scale;
			UI.SetCaret(UI.context_window,
				x_caret,y_caret,
				doc.caret_width,ed.GetCharacterHeightAt(doc.sel1.ccnt)*scale,
				doc.caret_color,doc.caret_flicker);
		}
		var renderer=doc.GetRenderer();
		var embeded_objects=renderer.g_rendered_objects;
		if(embeded_objects.length){
			UI.Begin(obj)
				var fondragstart=UI.HackCallback(function(obj_i){
					var real_obj=renderer.GetObject(obj_i.numerical_id);
					obj_i.change_mode="translate";
					obj_i.translate_y_original=obj_i.y;
					obj_i.translate_y_baseline=real_obj.y_baseline;
				})
				var fonscalestart=UI.HackCallback(function(obj_i){
					var real_obj=renderer.GetObject(obj_i.numerical_id);
					obj_i.change_mode="scale";
					obj_i.baseline_ratio=real_obj.y_baseline/real_obj.h;
				})
				var fonchange=UI.HackCallback(function(obj_i){
					var real_obj=renderer.GetObject(obj_i.numerical_id);
					if(obj_i.change_mode=="translate"){
						real_obj.y_baseline=obj_i.translate_y_baseline-(obj_i.y-obj_i.translate_y_original)/scale;
					}else{
						real_obj.y_baseline=obj_i.baseline_ratio*obj_i.h/scale;
					}
					real_obj.w=obj_i.w/scale;
					real_obj.h=obj_i.h/scale;
					doc.ed.InvalidateStates([obj_i.ccnt,lg_rubber_space])
					UI.Refresh()
				})
				for(var i=0;i<embeded_objects.length;i++){
					var obj_i=embeded_objects[i];
					obj_i.id="$"+obj_i.numerical_id;
					obj_i.OnScaleStart=fonscalestart;
					obj_i.OnDragStart=fondragstart;
					obj_i.OnChange=fonchange;
				}
				//todo: region-less boxDocument, improve the updating mechanism
				W.Group("embeded_objects",{
					layout_direction:'inside',layout_align:'left',layout_valign:'up',x:0,y:0,
					'item_object':W.BoxDocumentItem,'items':embeded_objects})
			UI.End(obj)
		}
	}
	*/
	return obj;
};
