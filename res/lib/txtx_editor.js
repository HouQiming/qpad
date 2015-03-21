var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
require("res/lib/color_picker");
require("res/lib/global_doc");

/*
switch to a purely style-based interface
*/

//todo: inserting objects - GUI
COMMAND_INSERT_OBJECT=0x100000
COMMAND_RUBBER_SPACE=0x107fff
COMMAND_SET_STYLE=0x108000
COMMAND_END=0x110000
STYLE_UNDERLINED=1
STYLE_STRIKE_OUT=2
STYLE_SUPERSCRIPT=4
STYLE_SUBSCRIPT=8
//STYLE_FONT_ITALIC=(1<<16)
//STYLE_FONT_BOLD=(1<<17)
////////////////
//embolden and potential shear
//var g_registered_fonts={
//	'Roman':      ["res/fonts/cmunrm.ttf","res/fonts/cmunci.ttf","res/fonts/cmunbx.ttf","res/fonts/cmunbi.ttf"],
//	'Sans Serif': ["res/fonts/cmunss.ttf","res/fonts/cmunsi.ttf","res/fonts/cmunsx.ttf","res/fonts/cmunso.ttf"],
//	'Typewriter': ["res/fonts/cmuntt.ttf","res/fonts/cmunit.ttf","res/fonts/cmuntb.ttf","res/fonts/cmuntx.ttf"],
//};
////////////////
var TxtxEditor_prototype=Object.create(W.Edit_prototype)
TxtxEditor_prototype.state_handlers=["renderer_fancy","line_column_unicode"];
TxtxEditor_prototype.wrap_width=1024;
TxtxEditor_prototype.page_margin_left=0;
TxtxEditor_prototype.page_margin_right=0;
TxtxEditor_prototype.page_margin_up=0;
TxtxEditor_prototype.page_margin_down=0;
//TxtxEditor_prototype.disable_scrolling_x=1
////////////////
TxtxEditor_prototype.GetStyleIDAt=function(ccnt){
	var ed=this.ed;
	return ed.GetStateAt(ed.m_handler_registration["renderer"],ccnt,"ddl")[2];
};
//TxtxEditor_prototype.GetCurrentStyleObject=function(){
//	var style_id=this.GetStyleIDAt(this.GetSelection()[1]);
//	return this.styles[style_id];
//};
UI.CreateFontFromStyle=function(params){
	var font_name,embolden;
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
	return UI.Font(params.font_face,params.font_size,params.font_embolden+embolden)
}
var CreateStyleArray=function(in_styles){
	var out_styles=[]
	for(var i=0;i<in_styles.length;i++){
		var style_i=UI.CloneStyle(in_styles[i]);
		style_i.font=UI.CreateFontFromStyle(style_i)
		out_styles[i]=style_i;
	}
	return out_styles;
};

TxtxEditor_prototype.Init=function(){
	this.m_style_map={};
	this.styles=CreateStyleArray(this.m_global_document.GetObject(0).m_data.styles);
	W.Edit_prototype.Init.call(this);
	this.styles=undefined
};
TxtxEditor_prototype.OnStyleChange=function(){
	var ed=this.ed;
	if(ed){
		var handler=ed.GetHandlerByID(ed.m_handler_registration["renderer"]);
		handler.UpdateStyles(CreateStyleArray(this.m_global_document.GetObject(0).m_data.styles));
	}
}
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
	this.m_global_document.ReportEdit(this.m_sub_document_id)
	ed.Edit(ops);
};
//todo: undo hooks
TxtxEditor_prototype.GetRenderer=function(){
	var ed=this.ed;
	return ed.GetHandlerByID(ed.m_handler_registration["renderer"]);
};
TxtxEditor_prototype.GetStyleName=function(params){
	var lspace=(params.relative_line_space||0.0);
	var pspace=(params.relative_paragraph_space||0.8);
	return name=[params.font_face,params.font_size,params.flags,params.color,lspace,pspace].join("_")
}
TxtxEditor_prototype.ModifyTextStyle=function(ModifyStyle,sel){
	if(!sel){sel=this.GetSelection();}
	var ed=this.ed;
	var sel_side=(this.sel0.ccnt<this.sel1.ccnt);
	var ops;
	var new_sel;
	var obj=this;
	UI.HackCallback(fcallback)
	if(sel[0]<sel[1]){
		var s_original=ed.GetText(sel[0],sel[1]-sel[0]);
		var styling_regions=UI.TokenizeByStylingRegions(s_original)
		if(styling_regions.length>0){
			styling_regions[0]=this.GetStyleIDAt(sel[0]);
		}
		for(var i=0;i<styling_regions.length;i+=2){
			//map all the styles and re-join them
			styling_regions[i]=Duktape.__utf8_fromCharCode(COMMAND_SET_STYLE+ModifyStyle(styling_regions[i]));
		}
		styling_regions.push(Duktape.__utf8_fromCharCode(COMMAND_SET_STYLE+this.GetStyleIDAt(sel[1])))
		ops=[sel[0],sel[1]-sel[0],styling_regions.join("")];
		new_sel=[sel[0],sel[0]+Duktape.__byte_length(ops[2])]
	}else{
		var s_style=Duktape.__utf8_fromCharCode(COMMAND_SET_STYLE+ModifyStyle(this.GetStyleIDAt(sel[0])));
		ops=[sel[0],0,s_style];
		new_sel=[sel[0]+Duktape.__byte_length(s_style),sel[0]+Duktape.__byte_length(s_style)]
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
	ccnt=this.SnapToValidLocation(this.ed.MoveToBoundary(ccnt,1,"space"),1);
	//todo: numbering
	return ccnt;
}
TxtxEditor_prototype.GetEnhancedEnd=function(ccnt0){
	var ed=this.ed;
	var ccnt=this.SeekLC(this.GetLC(ccnt0)[0],1e17);if(ccnt>0&&ed.GetText(ccnt-1,1)=="\n"){ccnt--;}
	if(ed.GetText(ccnt-lg_rubber_space,lg_rubber_space)==s_rubber_space){
		ccnt-=lg_rubber_space;
	}
	return this.SnapToValidLocation(this.ed.MoveToBoundary(ccnt,-1,"space"),-1);
}
TxtxEditor_prototype.GetLineSelection=function(){
	var sel=this.GetSelection();
	sel[0]=this.GetEnhancedHome(sel[0])
	sel[1]=Math.max(this.GetEnhancedEnd(sel[1]),sel[0])
	return sel;
}
TxtxEditor_prototype.GetRubberPadding=function(line0){
	var ccnt0=this.SeekLC(line0,0)
	var ccnt1=this.SeekLC(line0+1,0)
	var ed=this.ed;
	var mask=0;
	var lg0=0;
	if(ccnt1>0&&ed.GetText(ccnt1-1,1)=="\n"){ccnt1--;}
	if(ccnt0>=ccnt1){return 0;}
	if(ed.GetText(ccnt0,lg_rubber_space)==s_rubber_space){
		lg0=lg_rubber_space;
		mask|=1
	}
	if(ccnt1>ccnt0+lg0&&ed.GetText(ccnt1-lg_rubber_space,lg_rubber_space)==s_rubber_space){
		mask|=2
	}
	return mask
}
TxtxEditor_prototype.SetRubberPadding=function(mask,line0,line1){
	if(!line0){
		var sel=this.GetSelection();
		line0=this.GetLC(sel[0])[0];
		line1=this.GetLC(sel[1])[0]+1;
	}
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
//////////////////////////
TxtxEditor_prototype.GetReferences=function(){
	var renderer=this.GetRenderer()
	var n=renderer.GetObjectCount()
	var objects=[]
	for(var i=0;i<n;i++){
		objects.push(renderer.GetObject(i).obj_id)
	}
	return objects
}
TxtxEditor_prototype.SetReferences=function(mapping){
	var renderer=this.GetRenderer()
	var n=renderer.GetObjectCount()
	for(var i=0;i<n;i++){
		var obj_i=renderer.GetObject(i)
		obj_i.obj_id=mapping[obj_i.obj_id]
	}
}
TxtxEditor_prototype.default_extension="txt";
TxtxEditor_prototype.enable_compression=1
TxtxEditor_prototype.Save=function(){
	var ed=this.ed
	var renderer=this.GetRenderer()
	var perm=renderer.Internal_ConvertTextToPersistentForm(ed.GetText(),0)
	for(var i=0;i<perm.objects.length;i++){
		perm.objects[i].obj=perm.objects[i].obj.__unique_id
	}
	var s_text=perm.text;
	//it does not have to use every style
	//perm.styles=undefined;
	perm.text=undefined;
	perm.wrap_width=this.wrap_width
	var s_json=JSON.stringify(perm);
	return ["txtx\n",s_json,"\n",s_text].join("");
}
//////////////////////////
TxtxEditor_prototype.AsWidget=function(id,attrs){
	//there is no anchoring or styling, all coords are assumed to be absolute for performance
	if(this.is_text_box){
		//textbox: sync wrap_width
		var ww2=(attrs.w-this.page_margin_left-this.page_margin_right);
		if(ww2!=this.wrap_width){
			this.wrap_width=ww2;
			this.GetRenderer().Internal_UpdatePermanentStyles(this)
			this.ed.InvalidateStates([0,this.ed.GetTextSize()])
		}
	}
	var obj=UI.Keep(id,attrs)
	UI.Begin(obj)
	obj.doc=this;
	var doc=W.Edit("doc",{
		'x':obj.x+this.page_margin_left,'y':obj.y+this.page_margin_up,
		'w':obj.w-this.page_margin_left-this.page_margin_right,'h':obj.h-this.page_margin_up-this.page_margin_down,
		'read_only':obj.read_only,
	},TxtxEditor_prototype)
	var renderer=this.GetRenderer()
	var embeded_objects=renderer.g_rendered_objects;
	if(embeded_objects.length){
		var fanchortransform=UI.HackCallback(function(){
			var real_obj=renderer.GetObject(this.numerical_id);
			this.translate_y_original=this.y;
			//this.translate_y_baseline=real_obj.y_baseline;
			this.baseline_ratio=real_obj.y_baseline/real_obj.h;
			this.scale_w_original=real_obj.w
			this.scale_h_original=real_obj.h
		})
		var fonchange=UI.HackCallback(function(tr){
			var real_obj=renderer.GetObject(this.numerical_id);
			real_obj.w=this.scale_w_original*(tr.scale?tr.scale[0]:1)
			real_obj.h=this.scale_h_original*(tr.scale?tr.scale[1]:1)
			real_obj.y_baseline=this.baseline_ratio*real_obj.h-(tr.translation?tr.translation[1]:0);
			doc.ed.InvalidateStates([this.ccnt,lg_rubber_space])
			UI.Refresh()
		})
		var pboxdoc=obj.embeded_objects;
		for(var i=0;i<embeded_objects.length;i++){
			var obj_i=embeded_objects[i];
			obj_i.x/=UI.pixels_per_unit//abs to relative
			obj_i.y/=UI.pixels_per_unit//abs to relative
			obj_i.w/=UI.pixels_per_unit//abs to relative
			obj_i.h/=UI.pixels_per_unit//abs to relative
			var obj_real=this.m_global_document.GetObject(renderer.GetObject(obj_i.numerical_id).obj_id)
			var id_i="$"+obj_i.numerical_id
			obj_i.read_only=obj.read_only
			UI.EmbedObjectAndPostponeRegions(id_i,obj_i,obj_real,pboxdoc)
			obj_i.AnchorTransform=fanchortransform;
			obj_i.SetTransform=fonchange;
		}
		var sel={}
		if(doc.sync_object_selection_to_boxdoc&&pboxdoc){
			var ccnt0=doc.sel0.ccnt;
			var ccnt1=doc.sel1.ccnt;
			if(ccnt0>ccnt1){var tmp=ccnt0;ccnt0=ccnt1;ccnt1=tmp;}
			for(var i=0;i<embeded_objects.length;i++){
				var obj_i=embeded_objects[i];
				if(obj_i.ccnt>=ccnt0&&obj_i.ccnt<ccnt1){
					sel[obj_i.id]=1;
				}
			}
			pboxdoc.group.selection=sel;
		}
		var fOnSelectionChange=UI.HackCallback(function(){
			var sel=obj.embeded_objects.group.selection;
			var ccnt0=doc.ed.GetTextSize()
			var ccnt1=0
			for(var k in sel){
				if(sel[k]){
					var ccnt=obj.embeded_objects.group[k].ccnt
					ccnt0=Math.min(ccnt0,ccnt)
					ccnt1=Math.max(ccnt1,ccnt+lg_rubber_space)
				}
			}
			if(ccnt0<ccnt1){
				doc.sel0.ccnt=ccnt0;
				doc.sel1.ccnt=ccnt1;
				UI.Refresh()
			}
			doc.sync_object_selection_to_boxdoc=0;
		})
		//snapping coords
		/*
		//this is incorrect as the dragging is not in real-coords
		var sel={}
		if(obj.embeded_objects){sel=(obj.embeded_objects.group.selection||sel);}
		var snapping_coords={'x':[],'y':[],'tolerance':UI.IS_MOBILE?8:4}
		for(var i=0;i<embeded_objects.length;i++){
			var item_i=embeded_objects[i];
			if(sel[item_i.id]){
				//avoid self-snapping
				continue;
			}
			snapping_coords.x.push(UI.SNAP_LEFT,item_i.x);
			snapping_coords.x.push(UI.SNAP_CENTER,item_i.x+item_i.w*0.5);
			snapping_coords.x.push(UI.SNAP_RIGHT,item_i.x+item_i.w);
			snapping_coords.y.push(UI.SNAP_LEFT,item_i.y);
			snapping_coords.y.push(UI.SNAP_CENTER,item_i.y+item_i.h*0.5);
			snapping_coords.y.push(UI.SNAP_RIGHT,item_i.y+item_i.h);
		}
		*/
		if(!obj.read_only){
			W.BoxDocument("embeded_objects",{
				'x':0,'y':0,'w':obj.x+obj.w,'h':obj.y+obj.h,
				'items':embeded_objects,
				//'snapping_coords':snapping_coords,
				'disable_region':1,
				'OnSelectionChange':fOnSelectionChange
			})
		}
	}
	/////////////////////////////////////////////
	//create the property sheet
	var sheet=UI.document_property_sheet;
	var sel=doc.GetSelection();
	var cur_line=doc.GetLC(sel[0])[0]
	var style_id=this.GetStyleIDAt(sel[1]);
	var gdoc=this.m_global_document
	sheet["style"]=[style_id,function(value){
		doc.ModifyTextStyle(function(){return value})
	}]
	sheet["style_gdoc"]=gdoc
	sheet["align_l"]=[
		doc.GetRubberPadding(cur_line)==0,
		function(value){doc.SetRubberPadding(0)}],
	sheet["align_c"]=[
		doc.GetRubberPadding(cur_line)==3,
		function(value){doc.SetRubberPadding(value?3:0)}],
	sheet["align_r"]=[
		doc.GetRubberPadding(cur_line)==1,
		function(value){doc.SetRubberPadding(value?1:0)}],
	gdoc.SetStyleEditorPropertySheet()
	UI.End(obj)
	return obj
}
//////////////////////////
UI.NewTxtxEditor=function(wrap_width){
	if(!TxtxEditor_prototype.hyphenator){
		//TxtxEditor_prototype.hyphenator=UI.ParseHyphenator(IO.UIReadAll("res/misc/ushyphmax.tex"));
		TxtxEditor_prototype.hyphenator=UI.ParseHyphenator(IO.UIReadAll("res/misc/ushyphmax.dfa"));
	}
	var ret=Object.create(TxtxEditor_prototype)
	ret.wrap_width=wrap_width
	ret.Init()
	return ret
}

//a newing function... for the document type. or just a template document
UI.RegisterZipLoader("png",function(gdoc,sdata){
	var obj_img=UI.CreateEmbeddedImageFromFileData(sdata);
	if(!obj_img){throw new Error("invalid image")}
	return obj_img
})
UI.RegisterZipLoader("txt",function(gdoc,sdata){
	var pline0=sdata.indexOf('\n');if(pline0<0){return;}
	var pline1=sdata.indexOf('\n',pline0+1);if(pline1<0){return;}
	var perm=JSON.parse(sdata.substr(pline0+1,pline1-pline0-1));
	perm.text=sdata.substr(pline1+1)
	for(var i=0;i<perm.objects.length;i++){
		var obj_id=perm.objects[i].obj
		if(!(obj_id*2<data_list.length&&obj_id>=0)){
			throw new Error("invalid object id '@1'".replace('@1',obj_id));
		}
		perm.objects[i].obj=UI.LoadObject(data_list,obj_id)
	}
	return UI.NewTxtxEditor(perm.wrap_width);
})

//////////////////////////
TxtxEditor_prototype.Copy=function(){
	var ccnt0=this.sel0.ccnt;
	var ccnt1=this.sel1.ccnt;
	var ed=this.ed
	if(ccnt0>ccnt1){var tmp=ccnt0;ccnt0=ccnt1;ccnt1=tmp;}
	if(ccnt0<ccnt1){
		//add the objects / styles and return a local string for Edit calls
		var renderer=this.GetRenderer()
		var stext=ed.GetText(ccnt0,ccnt1-ccnt0)
		var perm=renderer.Internal_ConvertTextToPersistentForm(stext,this.GetStyleIDAt(ccnt0))
		var gdoc=this.m_global_document
		var clip=gdoc.BeginCopy(perm.text);
		for(var i=0;i<perm.objects.length;i++){
			var obj_i=renderer.GetObject(perm.objects[i]);
			gdoc.CopyObject(clip,obj_i.obj_id)
			perm.objects[i]={obj:obj_i.obj_id, w:obj_i.w, h:obj_i.h, y_baseline:obj_i.y_baseline}
		}
		//need this for cross-document paste
		//style names rather than actual style?
		//we need a name for each style - use existing same-name style if found, add original style if not
		for(var i=0;i<perm.styles.length;i++){
			gdoc.CopyStyle(clip,perm.styles[i])
		}
		gdoc.root=perm
		gdoc.format="txtx"
	}
}
TxtxEditor_prototype.Paste=function(){
	//test clipboard text and format...
	var gdoc=this.m_global_document
	var stext=gdoc.BeginPaste()
	if(typeof stext=='object'){
		//stext is actually the clipboard object
		if(stext.format=='txtx'){
			var perm=stext.root;
			var ed=this.ed;
			var renderer=this.GetRenderer()
			var objects=[]
			var styles=[]
			for(var i=0;i<perm.objects.length;i++){
				var obj_i=perm.objects[i];
				objects[i]=gdoc.PasteObject(stext,obj_i)
			}
			this.m_style_map={}
			for(var i=0;i<perm.styles.length;i++){
				styles[i]=gdoc.PasteStyle(stext,perm.styles[i])
			}
			this.m_style_map=undefined;
			stext=renderer.Internal_TranslateStylesAndObjects(perm.text,objects,styles)
		}else{
			throw new Error("please implement the paste function for "+stext)//todo
		}
	}else{
		//do nothing: stext is good as is
	}
	this.OnTextInput({"text":stext})
}
//////////////////////////
TxtxEditor_prototype.OnSelectionChange=function(){
	this.sync_object_selection_to_boxdoc=1
}
TxtxEditor_prototype.additional_hotkeys=[];
/////////////////////////////////////////

//var hyp=UI.ParseHyphenator(IO.UIReadAll("res/misc/ushyphmax.tex"))
//IO.CreateFile("test/ushyphmax.dfa",hyp.toString())

//var g_active_txtx_editor;
//UI.frame_callbacks.push(function(){g_active_txtx_editor=null;})
//var ToggleStyleFlag=function(style_flag){
//	if(!g_active_txtx_editor){return;}
//	g_active_txtx_editor.doc.ToggleStyleFlag(style_flag)
//}

W.subwindow_text_properties={
	//'id':'text_properties',
	'title':'Text properties',h:300,
	body:function(){
		var parent=UI.context_parent;
		/*widget*/(W.Button('bold',{
			'x':13.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'B',
			property_name:"bold"}));
		/*widget*/(W.Button('italic',{
			'x':45.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'I',
			property_name:"italic"}));
		/*widget*/(W.Button('underlined',{
			'x':77.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'U',
			property_name:"underlined"}));
		/*widget*/(W.Button('superscript',{
			'x':109.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'^',
			property_name:"superscript"}));
		/*widget*/(W.Button('subscript',{
			'x':141.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'_',
			property_name:"subscript"}));
		/*widget*/(W.Button('align_l',{
			'x':176.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'1',
			property_name:"align_l"}));
		/*widget*/(W.Button('align_c',{
			'x':208.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'2',
			property_name:"align_c"}));
		/*widget*/(W.Button('align_r',{
			'x':240.02037844241704,'y':74,'w':32,'h':32,
			style:UI.default_styles.check_button,font:UI.icon_font,text:'3',
			property_name:"align_r"}));
		//todo: make the color picker more elaborate
		/*widget*/(W.ColorPicker('color_picker',{
			'x':13.02037844241704,'y':124,'w':32,'h':32,
			'mode':'rgb',
			property_name:"text_color"}));
		/*widget*/(W.RoundRect('',{
			'x':233.02037844241704,'y':124,'w':100,'h':100,
			color:parent.color_picker.value,
			border_width:1.5,border_color:0xff444444}));
		//todo: style renaming, emboldening
		//and yes, choose between the 3 for now...
		/*widget*/(W.ComboBox("font_box",{
			'x':13.02037844241704,'y':36,'w':166.83966387238038,'h':29,
			items:[
				{text:"Roman"},
				{text:"Sans Serif"},
				{text:"Typewriter"},
			],
			property_name:"font_face",
		}));
		/*widget*/(W.EditBox("size_box",{
			'x':191.0906294148415,'y':36,'w':80.92974902757557,'h':29,
			property_name:"font_size",
		}));
	}
};

//todo: hotkeys: # or \
//post-textInput-triggered-action
W.subwindow_style_picker={
	'title':'Styles',h:300,
	body:function(){
		var gdoc=UI.document_property_sheet.style_gdoc
		var styles=gdoc.GetObject(0).m_data.styles
		var list_items=[]
		for(var i=0;i<styles.length;i++){
			style_i=styles[i]
			list_items.push({x:0,y:0,w:0,h:h_i,
				font:UI.CreateFontFromStyle(style_i),
				text:style_i.name,
				color:style_i.color})
		}
		//
		list_items.push({
			object_type:W.Button,
			x:0,y:0,
			style:{
				border_width:0,border_color:0,
				color:0,
				$:{
					over:{
						text_color:0xff444444
					},
					down:{
						text_color:0xff000000
					},
					out:{
						text_color:0xff7f7f7f
					},
				}
			},
			font:UI.Font(UI.font_name,24),
			text:"+ New style",
			OnClick:function(){
				//create new style from style 0
				var new_style=UI.CloneStyle(styles[0])
				styles.push(new_style)
				new_style.name="style_"+styles.length
				UI.Refresh()
			}
		})
		//a ListView of style objects
		W.ListView("style_list",{
			anchor:'parent',anchor_valign:'fill',anchor_align:'fill',
			x:0,y:0,
			property_name:'style',
			layout_spacing:thumbnail_margin*2,layout_align:'fill',layout_valign:'up',
			items:list_items,
			item_template:{object_type:W.Text},
		})
	}
};
