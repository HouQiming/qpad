var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
require("res/lib/color_picker");
var LOADER=require("res/lib/objloader");

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
TxtxEditor_prototype.Init=function(){
	this.m_style_map={};
	!? //generate font from pure-JSON styles
	this.styles=this.m_global_document.GetObject(0).styles;
	//this.CreateStyle({"font_face":"Roman","font_size":30,"flags":0,"color":0xff000000,"relative_line_space":0,"relative_paragraph_space":0.8})
	W.Edit_prototype.Init.call(this);
	this.styles=undefined
};
TxtxEditor_prototype.OnStyleChange=function(){
	var ed=this.ed;
	if(ed){
		!? //generate font from pure-JSON styles
		var handler=ed.GetHandlerByID(ed.m_handler_registration["renderer"]);
		handler.UpdateStyles(this.styles);
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
var g_style_core_properties=["font_face","font_size","flags","color","relative_line_space","relative_paragraph_space"];
TxtxEditor_prototype.CloneStyle=function(params){
	var ret={};
	for(var i=0;i<g_style_core_properties.length;i++){
		var id=g_style_core_properties[i];
		ret[id]=params[id];
	}
	return ret;
}
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
	!?
	var perm=this.GetTextAsPersistentForm()
	for(var i=0;i<perm.objects.length;i++){
		perm.objects[i].obj=perm.objects[i].obj.__unique_id
	}
	var s_text=perm.text;
	perm.text=undefined;
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
	!? var style_id=this.GetStyleIDAt(this.GetSelection()[1]);
	var cur_state=doc.GetCurrentStyleObject();
	var sel=doc.GetSelection();
	var cur_line=doc.GetLC(sel[0])[0]
	var sheet=UI.document_property_sheet;
	sheet["font_face"]=[cur_state.font_face,function(value){doc.ModifyTextStyle(function(style){style.font_face=value});}],
	sheet["font_size"]=[cur_state.font_size,function(value){doc.ModifyTextStyle(function(style){style.font_size=value});}],
	sheet["underlined"]=[!!(cur_state.flags&STYLE_UNDERLINED),function(value){doc.ModifyTextStyle(function(style){style.flags=((style.flags&~STYLE_UNDERLINED)|(value?STYLE_UNDERLINED:0))});}],
	//sheet["strike_out"]=[!!(cur_state.flags&STYLE_STRIKE_OUT),function(value){doc.ModifyTextStyle(function(style){style.flags=((style.flags&~STYLE_STRIKE_OUT)|(value?STYLE_STRIKE_OUT:0))});}],
	sheet["superscript"]=[!!(cur_state.flags&STYLE_SUPERSCRIPT),function(value){doc.ModifyTextStyle(function(style){style.flags=((style.flags&~(STYLE_SUPERSCRIPT|STYLE_SUBSCRIPT))|(value?STYLE_SUPERSCRIPT:0))});}],
	sheet["subscript"]=[!!(cur_state.flags&STYLE_SUBSCRIPT),function(value){doc.ModifyTextStyle(function(style){style.flags=((style.flags&~(STYLE_SUPERSCRIPT|STYLE_SUBSCRIPT))|(value?STYLE_SUBSCRIPT:0))});}],
	sheet["italic"]=[!!(cur_state.flags&STYLE_FONT_ITALIC),function(value){doc.ModifyTextStyle(function(style){style.flags=((style.flags&~STYLE_FONT_ITALIC)|(value?STYLE_FONT_ITALIC:0))});}],
	sheet["bold"]=[!!(cur_state.flags&STYLE_FONT_BOLD),function(value){doc.ModifyTextStyle(function(style){style.flags=((style.flags&~STYLE_FONT_BOLD)|(value?STYLE_FONT_BOLD:0))});}],
	//////
	sheet["text_color"]=[
		cur_state.color,
		function(value,is_continuous){
			if(is_continuous){
				doc.PerformContinuousUndo()
			}
			doc.ModifyTextStyle(function(style){style.color=value});
		},
		function(){doc.BeginContinuousUndo();},
		function(){doc.EndContinuousUndo();}],
	sheet["align_l"]=[
		doc.GetRubberPadding(cur_line)==0,
		function(value){doc.SetRubberPadding(0)}],
	sheet["align_c"]=[
		doc.GetRubberPadding(cur_line)==3,
		function(value){doc.SetRubberPadding(value?3:0)}],
	sheet["align_r"]=[
		doc.GetRubberPadding(cur_line)==1,
		function(value){doc.SetRubberPadding(value?1:0)}],
	UI.End(obj)
	return obj
}
//////////////////////////
UI.GlobalDoc_prototype.NewTxtxEditor=function(wrap_width){
	if(!TxtxEditor_prototype.hyphenator){
		//TxtxEditor_prototype.hyphenator=UI.ParseHyphenator(IO.UIReadAll("res/misc/ushyphmax.tex"));
		TxtxEditor_prototype.hyphenator=UI.ParseHyphenator(IO.UIReadAll("res/misc/ushyphmax.dfa"));
	}
	var ret=Object.create(TxtxEditor_prototype)
	this.AddObject(ret)
	ret.wrap_width=wrap_width
	ret.Init()
	return ret
}

UI.GlobalDoc_prototype.NewTextBox=function(){
	var wrap_width=200
	var obj_txtbox=this.NewTxtxEditor(wrap_width);
	obj_txtbox.is_text_box=1;
	obj_txtbox.disable_scrolling_x=1;
	obj_txtbox.disable_scrolling_y=1;
	//todo
	obj_txtbox.w=wrap_width
	obj_txtbox.h=150
	obj_txtbox.page_margin_left=8
	obj_txtbox.page_margin_right=8
	obj_txtbox.page_margin_up=8
	obj_txtbox.page_margin_down=8
	//todo
	return obj_txtbox
}

!? //m_global_document, re-doing the style sheet
//a newing function... for the document type. or just a template document
TxtxEditor_prototype.OpenAsTab=function(){
	//could have incremental insertion
	!? fname0,perm
	var doc=UI.NewTxtxEditor(1200);//todo
	doc.page_margin_left=50;//todo
	doc.page_margin_right=50;//todo
	doc.page_margin_up=0;//todo
	doc.page_margin_down=0;//todo
	var file_name=(fname0||IO.GetNewDocumentName("doc","txtx","document"));
	if(perm){
		!?
		var sbody=doc.PastePersistentText(perm)
		//todo: incremental insertion
		doc.ed.Edit([0,0,sbody],1)
		perm=undefined;
	}
	//todo: page property window
	return UI.NewTab({
		file_name:file_name,
		doc:doc,
		body:function(){
			//use attribute to have a "throw-it-back" object
			var body=W.TxtxTab("body",{
				'anchor':'parent','anchor_align':"center",'anchor_valign':"fill",
				'x':0,'y':0,'w':Math.min(doc.page_margin_left+doc.wrap_width+doc.page_margin_right,UI.context_parent.w),
				'page_margin_left':doc.page_margin_left,'page_margin_right':doc.page_margin_right,'page_width':doc.wrap_width,
				'file_name':this.file_name,'doc':doc,
				'scale':1,'bgcolor':0xffffffff,
			})
			return body;
		},
		title:UI.GetMainFileName(file_name),
		property_windows:[
			W.subwindow_text_properties
		],
		color_theme:[0xffcc7733],
	})
};
LOADER.RegisterZipLoader("png",function(gdoc,sdata){
	!?
	var sdata=data_list[id*2+0];
	var obj_img=UI.CreateEmbeddedImageFromFileData(sdata);
	if(!obj_img){throw new Error("invalid image")}
	return obj_img
})
LOADER.RegisterZipLoader("txt",function(gdoc,sdata){
	!?
	var sdata=data_list[id*2+0];
	var pline0=sdata.indexOf('\n');if(pline0<0){return;}
	var pline1=sdata.indexOf('\n',pline0+1);if(pline1<0){return;}
	var perm=JSON.parse(sdata.substr(pline0+1,pline1-pline0-1));
	perm.text=sdata.substr(pline1+1)
	for(var i=0;i<perm.objects.length;i++){
		var obj_id=perm.objects[i].obj
		if(!(obj_id*2<data_list.length&&obj_id>=0)){
			throw new Error("invalid object id '@1'".replace('@1',obj_id));
		}
		perm.objects[i].obj=LOADER.LoadObject(data_list,obj_id)
	}
	if(id==0){
		UI.NewTxtxTab(fname,perm);
	}else{
		//todo: page properties
		throw new Error("textbox unimplemented")
	}
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
		var styles=gdoc.GetObject(0).styles
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
TxtxEditor_prototype.additional_hotkeys=[
	{key:"CTRL+B",action:function(){
		this.ToggleStyleFlag(STYLE_FONT_BOLD)
	}},
	{key:"CTRL+I",action:function(){
		this.ToggleStyleFlag(STYLE_FONT_ITALIC)
	}},
	{key:"CTRL+L",action:function(){
		var sel=this.GetSelection();
		this.SetRubberPadding(0,this.GetLC(sel[0])[0],this.GetLC(sel[1])[0]+1)
	}},
	{key:"CTRL+E",action:function(){
		var sel=this.GetSelection();
		this.SetRubberPadding(3,this.GetLC(sel[0])[0],this.GetLC(sel[1])[0]+1)
	}},
	{key:"CTRL+R",action:function(){
		var sel=this.GetSelection();
		this.SetRubberPadding(1,this.GetLC(sel[0])[0],this.GetLC(sel[1])[0]+1)
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
	{key:"ALT+J",action:function(){
		var obj_txtbox=UI.NewTextBox();
		var oid=this.GetRenderer().InsertObject(obj_txtbox,obj_txtbox.w,obj_txtbox.h,obj_txtbox.h)
		this.OnTextInput({"text":Duktape.__utf8_fromCharCode(COMMAND_INSERT_OBJECT+oid)})
	}},
];
/////////////////////////////////////////
TxtxEditor_prototype.BeginContinuousUndo=function(){
	this.m_contundo_point=this.ed.GetUndoQueueLength();
	this.m_style_count=this.styles.length;
}
TxtxEditor_prototype.PerformContinuousUndo=function(){
	while(this.ed.GetUndoQueueLength()>this.m_contundo_point){
		this.ed.Undo()
	}
	var n0=this.m_style_count,n1=this.styles.length;
	for(var i=n0;i<n1;i++){
		var name=this.GetStyleName(this.styles[i]);
		this.m_style_map[name]=undefined;
		this.styles[i]=undefined;
	}
	this.styles.length=this.m_style_count;
}
TxtxEditor_prototype.EndContinuousUndo=function(){
	this.m_contundo_point=undefined
	this.m_style_count=undefined
}
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
		//todo
		/*widget*/(W.ColorPicker('color_picker',{
			'x':13.02037844241704,'y':124,'w':32,'h':32,
			'mode':'rgb',
			property_name:"text_color"}));
		/*widget*/(W.RoundRect('',{
			'x':233.02037844241704,'y':124,'w':100,'h':100,
			color:parent.color_picker.value,
			border_width:1.5,border_color:0xff444444}));
		//todo
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

W.TxtxTab=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"txtx_editor");
	//UI.StdStyling(id,obj,attrs, "txtx_editor",obj.focus_state||"blur");
	//UI.StdAnchoring(id,obj);
	UI.RoundRect(obj)
	UI.Begin(obj)
		//handle page properties
		//todo: scrolling?
		var w0=obj.page_margin_left
		var w1=obj.page_width
		var w2=obj.page_margin_right
		if(w0+w1+w2>obj.w){
			var w_excess=w0+w1+w2-obj.w
			var ratio0=(w0+w2?w0/(w0+w2):0);
			w0=Math.max(w0-ratio0*w_excess,0)
			w2=Math.max(w2-(1-ratio0)*w_excess,0)
			if(w1>obj.w){
				//really not wide enough
				w1=obj.w
			}
		}
		var doc=obj.doc;
		doc.AsWidget("body",{'x':obj.x,'y':obj.y,'w':w0+w1+w2,'h':obj.h})
		obj.Save=UI.HackCallback(function(){
			//todo: save as: int osal_DoFileDialogWin(short* buf, short* filter,short* def_ext,int is_save){
			//we can do without it on phones: save as opens rename in file explorer
			UI.SaveZipDocument(obj.file_name,this.doc)
			obj.saved_point=this.doc.ed.GetUndoQueueLength();
			UI.Refresh()
		})
		obj.title=UI.GetMainFileName(obj.file_name)+((obj.saved_point||0)!=obj.doc.ed.GetUndoQueueLength()?" *":"")
	UI.End()
	return obj;
};
