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
STYLE_FONT_ITALIC=(1<<16)
STYLE_FONT_BOLD=(1<<17)
////////////////
//embolden and potential shear
var g_registered_fonts={
	'Roman':      ["res/fonts/cmunrm.ttf","res/fonts/cmunci.ttf","res/fonts/cmunbx.ttf","res/fonts/cmunbi.ttf"],
	'Sans Serif': ["res/fonts/cmunss.ttf","res/fonts/cmunsi.ttf","res/fonts/cmunsx.ttf","res/fonts/cmunso.ttf"],
	'Typewriter': ["res/fonts/cmuntt.ttf","res/fonts/cmunit.ttf","res/fonts/cmuntb.ttf","res/fonts/cmuntx.ttf"],
};
////////////////
var TxtxEditor_prototype=Object.create(W.Edit_prototype)
TxtxEditor_prototype.state_handlers=["renderer_fancy","line_column_unicode"];
TxtxEditor_prototype.wrap_width=1024;
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
	this.CreateStyle({"font_face":"Roman","font_size":30,"flags":0,"color":0xff000000,"relative_line_space":0,"relative_paragraph_space":0.8})
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
var g_style_core_properties=["font_face","font_size","flags","color","relative_line_space","relative_paragraph_space"];
TxtxEditor_prototype.CloneStyle=function(params){
	var ret={};
	for(var i=0;i<g_style_core_properties.length;i++){
		var id=g_style_core_properties[i];
		ret[id]=params[id];
	}
	return ret;
}
TxtxEditor_prototype.CreateStyle=function(params){
	var lspace=(params.relative_line_space||0.0);
	var pspace=(params.relative_paragraph_space||0.8);
	if(!params.font_face){params.font_face="Roman";}
	if(!params.font_size){params.font_size=30;}
	if(!params.flags){params.flags=0;}
	var name=[params.font_face,params.font_size,params.flags,(params.color||0xff000000),lspace,pspace].join("_")
	if(this.m_style_map[name]){
		return this.m_style_map[name];
	}
	this.m_style_map[name]=this.styles.length;
	var font_name,size=params.font_size,embolden=0;
	if(!g_registered_fonts[params.font_face]){
		//external font
		font_name=params.font_face;
		if(params.flags&STYLE_FONT_BOLD){embolden=200;}
	}else{
		font_name=g_registered_fonts[params.font_face][(params.flags>>16)&3];
		if(!font_name){
			font_name=g_registered_fonts[params.font_face][(params.flags>>16)&1];
			if(!font_name){
				font_name=g_registered_fonts[params.font_face][0];
			}
			if(params.flags&STYLE_FONT_BOLD){embolden=200;}
		}
	}
	if(params.flags&(STYLE_SUPERSCRIPT|STYLE_SUBSCRIPT)){
		size*=0.75;
	}
	params.font=UI.Font(font_name,size,embolden);
	//space multipliers should ignore super/sub scripts
	params.line_space=lspace*params.font_size;
	params.paragraph_space=pspace*params.font_size;
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
TxtxEditor_prototype.ToggleStyleFlag=function(style_flag){
	var new_style=this.CloneStyle(this.GetCurrentStyleObject());
	new_style.flags^=style_flag;
	this.SetTextStyle(new_style)
}
TxtxEditor_prototype.additional_hotkeys=[
	{key:"CTRL+B",action:function(){
		this.ToggleStyleFlag(STYLE_FONT_BOLD)
	}},
	{key:"CTRL+I",action:function(){
		this.ToggleStyleFlag(STYLE_FONT_ITALIC)
	}},
	{key:"CTRL+L",action:function(){
		var sel=this.GetSelection();
		this.SetRubberPadding(this.GetLC(sel[0])[0],this.GetLC(sel[1])[0]+1,0)
	}},
	{key:"CTRL+E",action:function(){
		var sel=this.GetSelection();
		this.SetRubberPadding(this.GetLC(sel[0])[0],this.GetLC(sel[1])[0]+1,3)
	}},
	{key:"CTRL+R",action:function(){
		var sel=this.GetSelection();
		this.SetRubberPadding(this.GetLC(sel[0])[0],this.GetLC(sel[1])[0]+1,1)
	}},
	//todo: event-listening plugin: 1. 2. 3. centering and stuff
	{key:"ALT+I",action:function(){
		var img_name=UI.PickImage();
		if(!img_name){return;}
		var s_data=IO.ReadAll(img_name)
		if(!s_data){return;}//todo: show error notification
		var obj_img=UI.CreateEmbeddedImageFromFileData(s_data);
		if(!obj_img){return;}//todo: show error notification
		var oid=this.GetRenderer().InsertObject(obj_img,obj_img.w,obj_img.h,obj_img.h)
		this.OnTextInput({"text":Duktape.__utf8_fromCharCode(COMMAND_INSERT_OBJECT+oid)})
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

var g_active_txtx_editor;
UI.frame_callbacks.push(function(){g_active_txtx_editor=null;})

var ToggleStyleFlag=function(style_flag){
	if(!g_active_txtx_editor){return;}
	g_active_txtx_editor.doc.ToggleStyleFlag(style_flag)
}

W.subwindow_text_properties={
	'id':'text_properties',
	'title':'Text properties',h:114,
	body:function(){
		/*widget*/(W.Button('bold',{
			'x':13.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'B',
			OnClick:function(){ToggleStyleFlag(STYLE_FONT_BOLD)}}));
		/*widget*/(W.Button('italic',{
			'x':45.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'I',
			OnClick:function(){ToggleStyleFlag(STYLE_FONT_ITALIC)}}));
		/*widget*/(W.Button('underlined',{
			'x':77.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'U',
			OnClick:function(){ToggleStyleFlag(STYLE_UNDERLINED)}}));
		/*widget*/(W.Button('superscript',{
			'x':109.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'^',
			OnClick:function(){ToggleStyleFlag(STYLE_SUPERSCRIPT)}}));
		/*widget*/(W.Button('subscript',{
			'x':141.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'_',
			OnClick:function(){ToggleStyleFlag(STYLE_SUBSCRIPT)}}));
		/*widget*/(W.Button('align_l',{
			'x':176.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'1',
			OnClick:function(){/*todo*/}}));
		/*widget*/(W.Button('align_c',{
			'x':208.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'2',
			OnClick:function(){/*todo*/}}));
		/*widget*/(W.Button('align_r',{
			'x':240.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:g_icon_font,text:'3',
			OnClick:function(){/*todo*/}}));
		/*widget*/(W.ComboBox("font_box",{
			'x':13.02037844241704,'y':36,'w':166.83966387238038,'h':29,
			items:[
				{text:"Roman"},
				{text:"Sans Serif"},
				{text:"Typewriter"},
			],
		}));
		/*widget*/(W.ComboBox("size_box",{
			'x':191.0906294148415,'y':36,'w':80.92974902757557,'h':29,
			items:[
				{text:"24"},
				{text:"28"},
				{text:"30"},
				{text:"32"},
				{text:"44"},
			],
		}));
	}
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
		var text_ppt_window=UI.top.app.property_bar.text_properties
		if(text_ppt_window){
			//current style to UI
			var cur_state=obj.doc.GetCurrentStyleObject();
			//["font_face","font_size","flags","color","relative_line_space","relative_paragraph_space"];
			UI.SetComboBoxText(text_ppt_window.font_box, cur_state.font_face)
			UI.SetComboBoxText(text_ppt_window.size_box, cur_state.font_size)
			text_ppt_window.underlined.checked=!!(cur_state.flags&STYLE_UNDERLINED);
			//text_ppt_window.strike_out.checked=!!(cur_state.flags&STYLE_STRIKE_OUT);
			text_ppt_window.superscript.checked=!!(cur_state.flags&STYLE_SUPERSCRIPT);
			text_ppt_window.subscript.checked=!!(cur_state.flags&STYLE_SUBSCRIPT);
			text_ppt_window.italic.checked=!!(cur_state.flags&STYLE_FONT_ITALIC);
			text_ppt_window.bold.checked=!!(cur_state.flags&STYLE_FONT_BOLD);
			//todo: color and the color dialog
			//todo: rubber space detection
			//spacings do not appear here
		}
	UI.End()
	g_active_txtx_editor=obj;
	return obj;
};
