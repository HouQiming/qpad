var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
require("res/plugin/edbase");
var Language=require("res/lib/langdef");
var MAX_PARSABLE=33554432

function parent(){return UI.context_parent;}

var g_sandbox=UI.CreateSandbox();
g_sandbox.ReadBack=function(s){return JSON.parse(g_sandbox._ReadBack("JSON.stringify("+s+")"))}
g_sandbox.eval("var UI=require('gui2d/ui');var W=require('gui2d/widgets');require('res/lib/inmate');")
//xywh: relative mode?
g_sandbox.m_relative_scaling=1;//0.5;
var g_params={padding:12};
var g_initial_code=IO.ReadAll("mo\\test\\uiediting.js");
var g_language_C=Language.GetDescObjectByName("C/C++")

////////////////////////////////////////
//the UI editor
var ParseCodeError=function(err){
	print(err.stack)
}

var RerunUserCode=function(code_box){
	var working_range=code_box.working_range;
	if(!working_range||!working_range.point0){return 0;}
	var range_0=working_range.point0.ccnt;
	var range_1=working_range.point1.ccnt;
	code_box.has_errors=0;
	var ed=code_box.ed;
	var s_code=ed.GetText(range_0,range_1-range_0);
	if(!s_code){return 0;}
	var re_widget=new RegExp('/\\*widget\\*/\\(',"g")
	var re_editor=new RegExp('/\\*editor: ',"g")
	var ftranslate_widget=function(smatch,sname){
		return "UI.__report_widget(";
	};
	s_code=s_code.replace(re_widget,ftranslate_widget).replace(re_editor,"");
	try{
		g_sandbox.eval(ed.GetText().replace(re_editor,""));
		g_sandbox.eval("UI.top={};UI.Application=function(id,attrs){"+s_code+"};");
	}catch(err){
		ParseCodeError(err)
		code_box.has_errors=1;
	}
	UI.Refresh()
	return 1;
};

//obj_replacement==undefined for getting original
//over-matching is fine
var re_param_replacer=new RegExp("\\'([xywh])\\':([^,]+),","g");
var transform_xywh=function(code_box,ord,obj_replacement){
	var obj_ret={};
	var ed=code_box.ed;
	var range_0=code_box.working_range.point0.ccnt;
	var range_1=code_box.working_range.point1.ccnt;
	code_box.has_errors=0;
	var s_code=ed.GetText(range_0,range_1-range_0);
	var s_widget_key="/*widget*/(";
	var utf8_offset=nthIndex(s_code,s_widget_key,ord)
	if(utf8_offset<0){
		throw new Error("panic: UI->widget desync");
	}
	var byte_offset=ed.ConvertUTF8OffsetToBytesize(range_0,utf8_offset);
	var lg_key=Duktape.__byte_length(s_widget_key);
	//use JS search and convert back to ccnt...
	var byte_offset_widget_end=code_box.FindOuterBracket(byte_offset+lg_key,1);
	//do the replacement
	s_code=ed.GetText(byte_offset,byte_offset_widget_end-byte_offset);
	var freplace_params=UI.HackCallback(function(smatch,s_name,s_value){
		if(!obj_replacement){
			obj_ret[s_name]=s_value;
			return smatch;
		}
		if(!obj_replacement[s_name]){return smatch;}
		var s_replacement="'"+s_name+"':"+obj_replacement[s_name].toString()+",";
		return s_replacement;
	});
	s_code=s_code.replace(re_param_replacer,freplace_params);
	if(obj_replacement){
		code_box.transform_ops.push(byte_offset)
		code_box.transform_ops.push(byte_offset_widget_end-byte_offset)
		code_box.transform_ops.push(s_code)
	}
	return obj_ret;
};
	
var DrawFrame=function(code_box){
	var inner_widgets=[];
	if(!code_box.has_errors){
		try{
			g_sandbox.eval("UI.__init_widget_report();UI.DrawFrame();");
			inner_widgets=g_sandbox.ReadBack('UI.__get_widget_report()');
		}catch(err){
			ParseCodeError(err)
			code_box.has_errors=1;
		}
	}
	if(!code_box.has_errors){
		var inner_widget_map={};
		for(var i=0;i<inner_widgets.length;i++){
			var wi=inner_widgets[i];
			wi.id="$"+wi.id;
			wi.x*=g_sandbox.m_relative_scaling;
			wi.y*=g_sandbox.m_relative_scaling;
			wi.w*=g_sandbox.m_relative_scaling;
			wi.h*=g_sandbox.m_relative_scaling;
			inner_widget_map[wi.id]=wi;
		}
		var n2=0;
		var items=code_box.document_items;
		for(var i=0;i<items.length;i++){
			if(!inner_widget_map[items[i].id]){continue;}
			var attrs_old=items[i];
			var attrs_new=inner_widget_map[attrs_old.id];
			for(var s in attrs_new){
				attrs_old[s]=attrs_new[s];
			}
			inner_widget_map[attrs_old.id]=undefined;
			items[n2]=attrs_old;
			n2++;
		}
		items=items.slice(0,n2);
		for(var id in inner_widget_map){
			var attrs=inner_widget_map[id];
			if(attrs){
				items.push(attrs);
			}
		}
		//set OnChange
		var fonstart=UI.HackCallback(function(){
			code_box.undo_needed=0;
			this.user_anchor_x=this.user_x;
			this.user_anchor_y=this.user_y;
			this.user_anchor_w=this.w;
			this.user_anchor_h=this.h;
			///////////////
			this.old_xywh=transform_xywh(code_box,parseInt(this.id.substr(1)))
		});
		var fonchange=UI.HackCallback(function(tr){
			//we only consider top level groups, so we ignore non-top-level anchoring
			//create a replacement object first
			//var obj_replacement={x:obj.x/g_sandbox.m_relative_scaling,y:obj.y/g_sandbox.m_relative_scaling,w:obj.w/g_sandbox.m_relative_scaling,h:obj.h/g_sandbox.m_relative_scaling};
			var obj_replacement={
				x:this.user_anchor_x,
				y:this.user_anchor_y,
				w:this.user_anchor_w,
				h:this.user_anchor_h};
			if(tr.scale){
				obj_replacement.x+=obj_replacement.w*tr.relative_anchor[0]
				obj_replacement.y+=obj_replacement.h*tr.relative_anchor[1]
				obj_replacement.w*=tr.scale[0]
				obj_replacement.h*=tr.scale[1]
				obj_replacement.x-=obj_replacement.w*tr.relative_anchor[0]
				obj_replacement.y-=obj_replacement.h*tr.relative_anchor[1]
			}
			if(tr.translation){
				obj_replacement.x+=tr.translation[0];
				obj_replacement.y+=tr.translation[1];
			}
			obj_replacement.x/=g_sandbox.m_relative_scaling
			obj_replacement.y/=g_sandbox.m_relative_scaling
			obj_replacement.w/=g_sandbox.m_relative_scaling
			obj_replacement.h/=g_sandbox.m_relative_scaling
			if(this.inmate_placement!="inside"||this.inmate_align!="left"||this.inmate_valign!="up"){
				var dx_source_code_space=obj_replacement.x-this.user_anchor_x/g_sandbox.m_relative_scaling
				var dy_source_code_space=obj_replacement.y-this.user_anchor_y/g_sandbox.m_relative_scaling
				if(this.inmate_placement=='left'||this.inmate_align=='right'){
					dx_source_code_space*=-1;
				}
				if(this.inmate_placement=='up'||this.inmate_align=='down'){
					dy_source_code_space*=-1;
				}
				obj_replacement.x=(parseFloat(this.old_xywh.x)||0)+dx_source_code_space
				obj_replacement.y=(parseFloat(this.old_xywh.y)||0)+dy_source_code_space
			}
			//////////
			transform_xywh(code_box,parseInt(this.id.substr(1)),obj_replacement)
			//ed.Edit([byte_offset,byte_offset_widget_end-byte_offset,s_code]);
			//print(byte_offset,byte_offset_widget_end-byte_offset)
		});
		var fonfinish=UI.HackCallback(function(){
			code_box.undo_needed=0;
		});
		for(var i=0;i<items.length;i++){
			var item_i=items[i];
			item_i.AnchorTransform=fonstart;
			item_i.SetTransform=fonchange;
			item_i.FinalizeTransform=fonfinish;
			item_i.w_min=1;
			item_i.h_min=1;
			item_i.user_x=item_i.x;
			item_i.user_y=item_i.y;
			//item_i.old_values={x:item_i.x,y:item_i.y,w:item_i.w,h:item_i.h};
		}
		code_box.document_items=items;
	}
}

var nthIndex=function(str,pat,n){
	var L=str.length,i=-1;
	while(n>=0&&i++<L){
		i=str.indexOf(pat,i);
		n--;
	}
	return i>=L?-1:i;
}

W.subwindow_ui_insertion_bar={
	'title':'Insert widgets',h:500,
	body:function(){
		var obj_temp=W.Text("-",{anchor:'parent',anchor_align:'left',anchor_valign:'up',x:8,y:32,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,text:"Zoom"})
		obj_temp=W.Slider("zoom",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,w:180,h:24,h_slider:8,property_name:'scale'})
		W.Text("-",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,
			text:(g_sandbox.m_relative_scaling*100).toFixed(0)+"%"})
		obj_temp=W.Text("-",{anchor:'parent',anchor_align:'left',anchor_valign:'up',x:8,y:64,
			font:UI.Font("res/fonts/opensans.ttf",24),color:0xff000000,text:"Padding"})
		W.EditBox("padding_editor",{anchor:obj_temp,anchor_placement:'right',anchor_valign:'center',x:8,y:0,w:64,h:28,
			property_name:'padding'})
		W.Group("layout",{
			anchor:'parent',anchor_align:'fill',anchor_valign:'up',
			x:8,y:96,h:400,
			layout_direction:"down",layout_spacing:12,
			item_template:{object_type:W.Button,padding:4},
			items:[
				{text:'Label',property_name:'Label'},
				{text:'Button',property_name:'Button'},
				{text:'EditBox',property_name:'EditBox'},
				{text:'Slider',property_name:'Slider'},
				{text:'Select',property_name:'Select'},
			],
		})
	}
};
var g_template_code=IO.UIReadAll("res/misc/ui_template.js")
UI.NewUIEditorTab=function(fname0){
	var file_name=fname0||IO.GetNewDocumentName("ui","js","document")
	return UI.NewTab({
		file_name:file_name,
		title:UI.GetMainFileName(file_name),
		doc:undefined,
		body:function(){
			//create and keep, or throw in and continue
			UI.context_parent.body=this.doc
			var body=W.UIEditor("body",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
				'bgcolor':0xfff0f0f0,
			})
			if(!this.doc){
				this.doc=body;
				var s_data=(IO.ReadAll(fname0)||g_template_code);
				if(s_data){
					var code_box=body.doc
					var ed=code_box.ed;
					ed.Edit([0,0,s_data],1)
					var s_code=ed.GetText();
					var s_widget_key="/*insert here*/";
					var utf8_offset=nthIndex(s_code,s_widget_key,0)
					if(utf8_offset>=0){
						var byte_offset=ed.ConvertUTF8OffsetToBytesize(0,utf8_offset);
						code_box.sel0.ccnt=byte_offset
						code_box.sel1.ccnt=byte_offset
						code_box.OnSelectionChange()
					}
					///////////
					s_data=undefined;
					UI.Refresh()
				}
			}
			return body;
		},
		property_windows:[
			W.subwindow_ui_insertion_bar
		],
		color_theme:[0xff9a3d6a],
	})
};
//UI.RegisterLoaderForExtension("js",function(fn){return UI.NewUIEditorTab(fn)})
UI.RegisterLoaderForExtension("*",function(fn){return UI.NewCodeEditorTab(fn)})

W.UIEditor=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"ui_editor");
	UI.Begin(obj);
		///////////////////
		var ed_rect=W.RoundRect("",{
			color:0xffffffff,border_color:UI.current_theme_color,border_width:2,round:4,
			anchor:parent(),anchor_align:"right",anchor_valign:"center",
			x:8,y:0,w:obj.w*0.4,h:obj.h-16,
		});
		//var tick0=Duktape.__ui_get_tick();
		var code_box=W.Edit("doc",{
			font:UI.Font("res/fonts/inconsolata.ttf",24),color:0xff000000,
			tab_width:4,
			text:"",
			anchor:ed_rect,anchor_align:"center",anchor_valign:"center",
			///////////////
			state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode","seeker_indentation"],
			language:g_language_C,
			///////////////
			OnSelectionChange:function(){
				var code_box=obj.doc;
				var ed=code_box.ed;
				var ccnt_sel=code_box.sel1.ccnt;
				var range_0=code_box.FindBracketSafe(0,ccnt_sel,-1);
				var range_1=code_box.FindBracketSafe(0,ccnt_sel,1);
				var working_range=code_box.working_range;
				if(!working_range){
					working_range={};
					code_box.working_range=working_range;
				}
				if(working_range.point0&&range_0==working_range.point0.ccnt&&range_1==working_range.point1.ccnt){
					return;
				}
				if(!(range_0>=18&&ed.GetText(range_0-18,18)=='function(id,attrs)')){
					//if it's not a valid control, leave it alone
					return;
				}
				if(!working_range.point0){
					working_range.point0=ed.CreateLocator(range_0,-1); working_range.point0.undo_tracked=1;
					working_range.point1=ed.CreateLocator(range_1,1); working_range.point1.undo_tracked=1;
				}
				working_range.point0.ccnt=range_0;
				working_range.point1.ccnt=range_1;
				code_box.document_items=[];
				code_box.need_to_rerun=1;
			},
			OnChange:function(){
				code_box.need_to_rerun=1;
			},
			///////////////
			x:0,y:0,w:ed_rect.w-8,h:ed_rect.h-8,
		});
		var w_sandbox_area=obj.w-ed_rect.w-24
		//print("code_box:",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
		//the sandbox is effectively a GLwidget
		UI.GLWidget(function(){
			//var tick0=Duktape.__ui_get_tick();
			g_sandbox.DrawSandboxScreen(obj.x+8,obj.y+8,w_sandbox_area,obj.h-16,0,0);
			//print("g_sandbox.DrawWindow",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
		})
		//create the boxes
		if(code_box.document_items){
			var items=code_box.document_items;
			var snapping_coords={'x':[],'y':[],'tolerance':UI.IS_MOBILE?8:4}
			for(var i=0;i<items.length;i++){
				var item_i=items[i];
				if(obj.controls&&obj.controls.group.selection&&obj.controls.group.selection[item_i.id]){
					//avoid self-snapping
					continue;
				}
				snapping_coords.x.push(UI.SNAP_LEFT,item_i.x);
				snapping_coords.x.push(UI.SNAP_CENTER,item_i.x+item_i.w*0.5);
				snapping_coords.x.push(UI.SNAP_RIGHT,item_i.x+item_i.w);
				snapping_coords.y.push(UI.SNAP_LEFT,item_i.y);
				snapping_coords.y.push(UI.SNAP_CENTER,item_i.y+item_i.h*0.5);
				snapping_coords.y.push(UI.SNAP_RIGHT,item_i.y+item_i.h);
				///////////
				snapping_coords.x.push(UI.SNAP_RIGHT,item_i.x-g_params.padding);
				snapping_coords.x.push(UI.SNAP_LEFT,item_i.x+item_i.w+g_params.padding);
				snapping_coords.y.push(UI.SNAP_RIGHT,item_i.y-g_params.padding);
				snapping_coords.y.push(UI.SNAP_LEFT,item_i.y+item_i.h+g_params.padding);
			}
			var sandbox_main_window_w=g_sandbox.ReadBack('[UI.sandbox_main_window_w]')[0]*g_sandbox.m_relative_scaling
			var sandbox_main_window_h=g_sandbox.ReadBack('[UI.sandbox_main_window_h]')[0]*g_sandbox.m_relative_scaling
			W.BoxDocument("controls",{
				x:obj.x+8,y:obj.y+8,w:sandbox_main_window_w,h:sandbox_main_window_h,
				'border_color':UI.current_theme_color&0xccffffff,'border_width':2,
				'color':UI.current_theme_color&0x44ffffff,
				'snapping_coords':snapping_coords,
				'items':code_box.document_items,
				'BeginTransform':function(){
					var ed=code_box.ed;
					if(code_box.undo_needed){ed.Undo();}
					code_box.transform_ops=[];
				},
				'EndTransform':function(){
					code_box.HookedEdit(code_box.transform_ops);
					code_box.transform_ops=null;
					code_box.undo_needed=1;
					code_box.need_to_rerun=1;
				},
			})
		}
		///////////////////
		//this calls BeginPaint which is not reentrant... consider it as a separate window
		//var s_code=ed_box.ed.GetText();
		//g_sandbox.eval("UI.Application=function(id,obj){"+s_code+"};UI.DrawFrame();");
		//var tick0=Duktape.__ui_get_tick();
		UI.CallNextFrame(function(){
			if(code_box.need_to_rerun){
				code_box.need_to_rerun=0;
				RerunUserCode(code_box);
			}
			DrawFrame(code_box)
			return 0
		})
		obj.InsertCode=UI.HackCallback(function(placing_hint,s_insertion){
			if(!code_box.working_range||!code_box.working_range.point0){return;}
			var ed=code_box.ed;
			var range_0=code_box.working_range.point0.ccnt;
			var range_1=code_box.working_range.point1.ccnt;
			code_box.has_errors=0;
			var s_code=ed.GetText(range_0,range_1-range_0);
			var s_widget_key="/*insert here*/";
			var utf8_offset=nthIndex(s_code,s_widget_key,0)
			if(utf8_offset<0){
				print("please don't remove the '/*insert here*/' comment")
				return;
			}
			var byte_offset=ed.ConvertUTF8OffsetToBytesize(range_0,utf8_offset);
			var y_bottom_top=0,y_bottom_bottom=0,x_rightmost=0,h_standard=32
			var x,y,w,h
			if(code_box.document_items){
				for(var i=0;i<code_box.document_items.length;i++){
					var box_i=code_box.document_items[i];
					if(y_bottom_top<box_i.y/g_sandbox.m_relative_scaling){
						y_bottom_top=box_i.y/g_sandbox.m_relative_scaling;
						if(h_standard){h_standard=box_i.h/g_sandbox.m_relative_scaling}
					}
					if(y_bottom_bottom<(box_i.y+box_i.h)/g_sandbox.m_relative_scaling){y_bottom_bottom=(box_i.y+box_i.h)/g_sandbox.m_relative_scaling;}
				}
			}else{
				y_bottom_top=g_params.padding;
			}
			if(placing_hint=="line"){
				x=x_rightmost+g_params.padding
				w=sandbox_main_window_w/g_sandbox.m_relative_scaling-g_params.padding-x
				y=y_bottom_bottom+g_params.padding
				h=h_standard
			}else{
				if(code_box.document_items){
					for(var i=0;i<code_box.document_items.length;i++){
						var box_i=code_box.document_items[i];
						if(y_bottom_top<(box_i.y+box_i.h)/g_sandbox.m_relative_scaling){
							y_bottom_top=box_i.y/g_sandbox.m_relative_scaling;
							if(x_rightmost<(box_i.x+box_i.w)/g_sandbox.m_relative_scaling){
								x_rightmost=(box_i.x+box_i.w)/g_sandbox.m_relative_scaling
							}
						}
					}
				}
				x=x_rightmost+g_params.padding
				w=sandbox_main_window_w/g_sandbox.m_relative_scaling-g_params.padding-x
				y=y_bottom_top
				h=h_standard
				if(w<=0){
					x_rightmost=0
					y=y_bottom_bottom+g_params.padding
					x=x_rightmost+g_params.padding
					w=sandbox_main_window_w/g_sandbox.m_relative_scaling-g_params.padding-x
				}
			}
			var pos_str=["'x':",x,",'y':",y,",'w':",w,",'h':",h].join("");
			if(s_insertion.indexOf('W.Label(')>=0){
				//Text objects are implicitly sized
				pos_str=["'x':",x,",'y':",y].join("");
			}
			var ops=[byte_offset,0,'/*widget*/('+s_insertion.replace(new RegExp('\\$id\\$','g'),byte_offset.toString()).replace('$pos$',pos_str)+');\n\t']
			code_box.HookedEdit(ops);
			code_box.sel0.ccnt=ops[0]
			code_box.sel1.ccnt=ops[0]+Duktape.__byte_length(ops[2])
			code_box.need_to_rerun=1;
			UI.Refresh()
		})
		////////////////////////
		UI.document_property_sheet={
			'Label':[0,function(){obj.InsertCode("line","W.Label('text_$id$',{$pos$,\n\t\ttext:'label'})")}],
			'Button':[0,function(){obj.InsertCode("line","W.Button('button_$id$',{$pos$,\n\t\tproperty_name:'button_$id$',\n\t\ttext:'Button'})")}],
			'EditBox':[0,function(){obj.InsertCode("value","W.EditBox('editbox_$id$',{$pos$,\n\t\tproperty_name:'editbox_$id$'})")}],
			'Slider':[0,function(){obj.InsertCode("value","W.Slider('slider_$id$',{$pos$,\n\t\tproperty_name:'slider_$id$'})")}],
			'Select':[0,function(){obj.InsertCode("value","W.Select('select_$id$',{$pos$,\n\t\tproperty_name:'select_$id$',\n\t\titems:[0,1]})")}],
			'scale':[
				(Math.log(g_sandbox.m_relative_scaling)+2)/3,
				function(value){
					g_sandbox.m_relative_scaling=Math.exp(value*3-2)
					if(Math.abs(g_sandbox.m_relative_scaling-1)<0.1){g_sandbox.m_relative_scaling=1;}
					code_box.need_to_rerun=1;
					UI.Refresh()
				}],
			'padding':[g_params.padding.toString(),function(value){g_params.padding=value;}],
		}
		////////////////////////
		obj.Save=UI.HackCallback(function(){
			IO.CreateFile(obj.file_name,this.doc.ed.GetText())
			obj.saved_point=this.doc.ed.GetUndoQueueLength();
			UI.Refresh()
		})
		obj.title=UI.GetMainFileName(obj.file_name)+((obj.saved_point||0)!=obj.doc.ed.GetUndoQueueLength()?" *":"")
	//print("DrawUserFrame:",Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000,"ms");
	UI.End();
	return obj
};

///////////////////////////////////////////////////////
//the code editor
W.CodeEditor_prototype=UI.InheritClass(W.Edit_prototype,{
	tab_is_char:1,
	plugin_class:'code_editor',
	state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode","seeker_indentation"],
	//state_handlers:["renderer_fancy","colorer_programmer","line_column_unicode","seeker_indentation"],
	////////////////////
	//per-language portion
	//language:g_language_C,
	Init:function(){
		this.m_event_hooks={}
		this.m_event_hooks['load']=[]
		this.m_event_hooks['save']=[]
		this.m_event_hooks['parse']=[]
		this.m_event_hooks['menu']=[]
		//before creating the editor, try to call a language callback
		var loaded_metadata=(this.file_name&&UI.m_ui_metadata[this.file_name]||{})
		var hyp_name=(loaded_metadata.m_hyphenator_name||this.plugin_language_desc&&this.plugin_language_desc.default_hyphenator_name)
		if(hyp_name){
			this.hyphenator=Language.GetHyphenator(hyp_name)
			this.m_hyphenator_name=hyp_name
			this.font=this.tex_font
			this.font_emboldened=this.tex_font_emboldened
		}
		var spell_checker=(loaded_metadata.m_spell_checker||this.plugin_language_desc&&this.plugin_language_desc.spell_checker)
		if(spell_checker){
			this.m_spell_checker=spell_checker;
		}
		W.Edit_prototype.Init.call(this);
		//these are locators when set
		this.m_bookmarks=[undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined];
		this.m_unkeyed_bookmarks=[];
	},
	FindNearestBookmark:function(ccnt,direction){
		//just do a sequential search
		var best=undefined,best_bm=undefined;
		for(var i=0;i<10;i++){
			var bm=this.m_bookmarks[i]
			if(!bm){continue;}
			var dist=(bm.ccnt-ccnt)*direction;
			if(dist>=0&&!(best<dist)){
				best=dist
				best_bm=bm;
			}
		}
		for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
			var bm=this.m_unkeyed_bookmarks[i];
			if(!bm){continue;}
			var dist=(bm.ccnt-ccnt)*direction;
			if(dist>=0&&!(best<dist)){
				best=dist
				best_bm=bm;
			}
		}
		return best_bm;
	},
	DeleteBookmark:function(bm){
		//just do a sequential search
		bm.discard()
		for(var i=0;i<10;i++){
			if(bm==this.m_bookmarks[i]){
				this.m_bookmarks[i]=undefined;
				return;
			}
		}
		for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
			if(bm==this.m_unkeyed_bookmarks[i]){
				this.m_unkeyed_bookmarks[i]=undefined;
				return;
			}
		}
	},
	////////////////////
	//overloaded methods
	StartLoading:function(fn){
		var ed=this.ed;
		var is_preview=this.m_is_preview
		ed.hfile_loading=UI.EDLoader_Open(ed,fn,is_preview?4096:undefined)
		//abandonment should work as is...
		var floadNext=(function(){
			ed.hfile_loading=UI.EDLoader_Read(ed,ed.hfile_loading,is_preview?16384:undefined)
			if(is_preview){
				var rendering_ccnt1=this.SeekXY(0,this.h)
				if(rendering_ccnt1<ed.GetTextSize()){
					//abandon and stop loading, without calling OnLoad
					if(ed.hfile_loading){
						ed.hfile_loading.discard()
						ed.hfile_loading=undefined
					}
					UI.Refresh()
					return
				}
			}
			if(ed.hfile_loading){
				UI.NextTick(floadNext);
			}else{
				this.OnLoad()
			}
			UI.Refresh()
		}).bind(this)
		if(ed.hfile_loading){
			floadNext()
		}else{
			this.OnLoad()
		}
		UI.Refresh()
	},
	//always go left
	GetBracketLevel:function(ccnt){
		var ed=this.ed;
		return ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"ill")[1];
	},
	FindBracket:function(n_brackets,ccnt,direction){
		var ed=this.ed;
		var ret=ed.FindNearest(ed.m_handler_registration["colorer"],[0,n_brackets],"ll",ccnt,direction);
		return ret;
	},
	FindBracketSafe:function(n_brackets,ccnt,direction){
		var ret=this.FindBracket(n_brackets,ccnt,direction)
		if(ret==-1){
			if(direction<0){
				return 0;
			}else{
				return ed.GetTextSize();
			}
		}
		return ret;
	},
	FindOuterBracket:function(ccnt,direction){
		return this.FindBracket(this.GetBracketLevel(ccnt)-1,ccnt,direction);
	},
	IsBracketEnabledAt:function(ccnt){
		var lang=this.plugin_language_desc
		var ed=this.ed
		var enabled_mask=lang.m_inside_mask_to_enabled_mask[ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"ill")[0]];
		return (enabled_mask&lang.m_bracket_enabling_mask)!=0
	},
	///////////////////////////////
	GetIndentLevel:function(ccnt){
		return this.GetLC(Math.min(this.GetEnhancedHome(ccnt),ccnt))[1];
	},
	FindOuterIndentation:function(ccnt){
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(ccnt);
		return ed.FindNearest(id_indent,[my_level-1],"l",ccnt,-1);
	},
	///////////////////////////////
	BracketSizeAt:function(ccnt,side){
		//ccnt is at the last character of a token...
		var lang=this.plugin_language_desc
		if(!lang){return 1;}
		var tokens=(side==0?lang.m_lbracket_tokens:lang.m_rbracket_tokens)
		if(!tokens){return 1;}
		for(var i=0;i<tokens.length;i++){
			var s=tokens[i]
			var lg=Duktape.__byte_length(s)
			if(this.ed.GetText(ccnt+1-lg,lg)==s){
				return lg
			}
		}
		return 1
	},
	FindOuterBracket_SizeFriendly:function(ccnt,delta){
		var ccnt_raw=this.FindOuterBracket(ccnt,delta)
		return ccnt_raw+1-this.BracketSizeAt(ccnt_raw,0)
	},
	FindOuterLevel:function(ccnt){
		var ret=Math.max(this.FindOuterBracket_SizeFriendly(ccnt,-1),this.FindOuterIndentation(ccnt))
		if(ret>=ccnt){ret=-1;}
		return ret
	},
	///////////////////////////////
	IsLineEndAt:function(ccnt){
		var ch=this.ed.GetUtf8CharNeighborhood(ccnt)[1]
		if(ch==10){return 1}
		if(ch==13&&this.ed.GetUtf8CharNeighborhood(ccnt+1)[1]=='\n'){return 1}
		return 0
	},
	IsLeftBracket:function(s){
		var lang=this.plugin_language_desc
		var bs=lang.m_lbracket_tokens
		if(bs){
			for(var i=0;i<bs.length;i++){
				if(bs[i]==s){return 1;}
			}
		}
		return 0;
	},
	IsRightBracket:function(s){
		var lang=this.plugin_language_desc
		var bs=lang.m_rbracket_tokens
		for(var i=0;i<bs.length;i++){
			if(bs[i]==s){return 1;}
		}
		return 0;
	},
	///////////////////////////////////////
	//smarter clipboard actions
	Cut:function(){
		var ccnt0=this.sel0.ccnt
		var ccnt1=this.sel1.ccnt
		if(ccnt0==ccnt1){
			var line_current=this.GetLC(ccnt1)[0]
			var line_ccnts=this.SeekAllLinesBetween(line_current,line_current+2)
			this.sel0.ccnt=line_ccnts[0];
			this.sel1.ccnt=line_ccnts[1];
		}
		W.Edit_prototype.Cut.call(this)
	},
})

W.MinimapThingy_prototype={
	dimension:'y',
	OnMouseDown:function(event){
		this.anchored_value=this.value
		this.anchored_xy=event.y
		UI.CaptureMouse(this)
	},
	OnMouseUp:function(event){
		UI.ReleaseMouse(this)
		this.anchored_value=undefined
		UI.Refresh()
	},
	OnMouseMove:function(event){
		if(this.anchored_value==undefined){return;}
		this.OnChange(Math.min(Math.max(this.anchored_value+(event.y-this.anchored_xy)/this.factor,0),1))
	},
}

UI.IsSearchFrontierCompleted=function(frontier){
	return UI.GetSearchFrontierCcnt(frontier)<0
}

UI.GetSearchFrontierCcnt=function(frontier){
	if((typeof frontier)=='number'){
		return frontier
	}else{
		return frontier.ccnt
	}
}

var g_re_regexp_escape=new RegExp("[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|]","g")
var RegexpEscape=function(s){
	return s.replace(g_re_regexp_escape,"\\$&");
}

var fadein=function(C,alpha){
	return (((((C>>24)&0xff)*alpha)|0)<<24)|(C&0xffffff)
};

UI.non_animated_values.x_shake=1
UI.non_animated_values.dx_shake=1
UI.non_animated_values.ddx_shake=1
W.NotificationItem=function(id,attrs){
	if(!UI.context_parent[id]){
		attrs.alpha=0;
		attrs.dx_shake=UI.default_styles.code_editor.dx_shake_notification
	}
	var obj=UI.Keep(id,attrs)
	UI.StdStyling(id,obj,attrs, "code_editor_notification");
	//shaking
	if(!obj.x_shake){obj.x_shake=0}
	if(obj.x_shake||obj.dx_shake){
		var dt_all=Duktape.__ui_seconds_between_ticks(UI.m_last_frame_tick,UI.m_frame_tick)
		if(!obj.dx_shake){obj.dx_shake=0}
		if(!obj.ddx_shake){obj.ddx_shake=0}
		for(var dt_i=0;dt_i<dt_all;dt_i+=0.001){
			//http://en.wikipedia.org/wiki/Newmark-beta_method
			var dt=Math.min(dt_all-dt_i,0.001)
			var a0=obj.ddx_shake
			var a1=-(obj.k_shake*obj.x_shake)-(obj.damping_shake*obj.dx_shake);
			var v0=obj.dx_shake
			var v1=v0+dt*0.5*(a0+a1)
			var x0=obj.x_shake
			var x1=x0+dt*(v0+dt*0.25*(a0+a1))
			obj.x_shake=x1
			obj.dx_shake=v1
			obj.ddx_shake=a1
		}
		if(Math.abs(obj.dx_shake)<obj.dx_min_shake&&Math.abs(obj.x_shake)<obj.x_min_shake){
			obj.x_shake=0
			obj.dx_shake=0;
			obj.ddx_shake=0;
		}
		UI.AutoRefresh()
	}
	///////////
	var tmp={w:obj.w_text,h:1e17,font:obj.font,text:obj.text}
	UI.LayoutText(tmp);
	obj.w=obj.padding*2+obj.w_icon+obj.w_text
	obj.h=obj.padding*2+Math.max(obj.w_icon,tmp.h_text)
	UI.StdAnchoring(id,obj);
	UI.RoundRect({x:obj.x+obj.x_shake+obj.border_width,y:obj.y,w:obj.w+obj.shadow_size*0.75,h:obj.h+obj.shadow_size*0.75,
		color:fadein(obj.shadow_color,obj.alpha),
		round:obj.shadow_size,
		border_width:-obj.shadow_size})
	UI.RoundRect({x:obj.x+obj.x_shake+obj.border_width,y:obj.y,w:obj.w,h:obj.h,
		color:fadein(obj.color,obj.alpha),round:obj.round,border_color:fadein(obj.border_color,obj.alpha),border_width:obj.border_width})
	if(obj.progress!=undefined){
		//progress
		UI.PushCliprect(obj.x+obj.x_shake+obj.border_width,obj.y,obj.w*obj.progress,obj.h)
		UI.RoundRect({x:obj.x+obj.x_shake+obj.border_width,y:obj.y,w:obj.w,h:obj.h,
			color:fadein(obj.progress_color,obj.alpha),
			round:obj.round,
			border_color:fadein(obj.border_color,obj.alpha),border_width:obj.border_width})
		UI.PopCliprect()
	}
	if(obj.icon){UI.DrawChar(obj.icon_font,obj.x+obj.x_shake+obj.padding,obj.y+obj.padding,fadein(obj.icon_color,obj.alpha),obj.icon.charCodeAt(0))}
	UI.DrawTextControl(tmp,obj.x+obj.x_shake+obj.padding+obj.w_icon,obj.y+obj.padding,fadein(obj.text_color,obj.alpha))
	if(obj.OnClick){
		W.PureRegion(id,obj)
	}
	return obj
}

UI.SEARCH_FLAG_CASE_SENSITIVE=1
UI.SEARCH_FLAG_WHOLE_WORD=2
UI.SEARCH_FLAG_REGEXP=4
W.CodeEditorWidget_prototype={
	m_find_flags:0,
	m_wrap_width:0,
	OnEditorCreate:function(){
		var doc=this.doc
		var obj=this
		doc.OnLoad=obj.OnLoad.bind(obj)
		doc.StartLoading(obj.file_name)
		doc.HookedEdit=function(ops){
			if(obj.m_current_find_context&&ops.length>0&&!obj.m_replace_context){
				var match_id=obj.BisectMatches(ops[0])
				if(match_id){
					var match_ccnt0=obj.GetMatchCcnt(match_id,0)
					var match_ccnt1=obj.GetMatchCcnt(match_id,1)
					var intersected=1;
					for(var i=0;i<ops.length;i+=3){
						var ccnt0_i=ops[i]
						var ccnt1_i=ops[i]+ops[i+1]
						if(!(ccnt0_i<=match_ccnt1&&ccnt1_i>=match_ccnt0)){
							intersected=0;
							break
						}
					}
					if(intersected){
						//start replacing - *every* op intersects with the match...
						obj.SetReplacingContext(match_ccnt0,match_ccnt1)
					}
				}
			}
			this.ed.Edit(ops);
		}
		doc.AddEventHandler('change',function(){
			if(obj.m_current_find_context){
				obj.m_current_find_context.Cancel()
				obj.m_current_find_context=undefined
			}
			if(obj.m_ac_context){
				//this should self-destruct when it's a disabling change
				//it should work properly if the user continues typing
				obj.m_ac_context.m_ccnt=-1;
			}
			obj.m_is_brand_new=0
		})
		doc.AddEventHandler('ESC',function(){
			obj.m_notifications=[]
			obj.m_ac_context=undefined
			doc.m_user_just_typed_char=0
			obj.DestroyReplacingContext();
			UI.Refresh()
			return 1
		})
	},
	///////////////////////////
	OnLoad:function(){
		var loaded_metadata=(UI.m_ui_metadata[this.file_name]||{})
		var doc=this.doc
		if(loaded_metadata.m_bookmarks){
			for(var i=0;i<10;i++){
				if(loaded_metadata.m_bookmarks[i]!='n/a'&&!doc.m_bookmarks[i]){
					doc.m_bookmarks[i]=doc.ed.CreateLocator(Math.max(Math.min(loaded_metadata.m_bookmarks[i],doc.ed.GetTextSize()),0))
				}
			}
		}
		if(loaded_metadata.m_unkeyed_bookmarks){
			var bm=loaded_metadata.m_unkeyed_bookmarks
			for(var i=0;i<bm.length;i++){
				doc.m_unkeyed_bookmarks.push(doc.ed.CreateLocator(Math.max(Math.min(bm[i],doc.ed.GetTextSize()),0)))
			}
		}
		if(loaded_metadata.sel0){doc.sel0.ccnt=Math.max(Math.min(loaded_metadata.sel0,doc.ed.GetTextSize()),0);}
		if(loaded_metadata.sel1){doc.sel1.ccnt=Math.max(Math.min(loaded_metadata.sel1,doc.ed.GetTextSize()),0);}
		this.m_current_needle=loaded_metadata.m_current_needle
		this.m_find_flags=(loaded_metadata.m_find_flags||0)
		this.m_wrap_width=(loaded_metadata.m_wrap_width||0)
		doc.AutoScroll("center")
		doc.scrolling_animation=undefined
		doc.CallHooks("selectionChange")
		doc.CallHooks("load")
		this.ParseFile()
		UI.Refresh()
	},
	SaveMetaData:function(){
		if(this.m_is_preview){return;}
		var doc=this.doc
		if(!doc||!IO.FileExists(this.file_name)){return;}
		var new_metadata={m_bookmarks:[],m_unkeyed_bookmarks:[],
			m_current_needle:this.m_current_needle,
			m_find_flags:this.m_find_flags,
			m_wrap_width:this.m_wrap_width,
			m_hyphenator_name:this.m_hyphenator_name,
			m_spell_checker:this.m_spell_checker,
			sel0:doc.sel0.ccnt,
			sel1:doc.sel1.ccnt,
		}
		for(var i=0;i<10;i++){
			var bm=doc.m_bookmarks[i]
			new_metadata.m_bookmarks[i]=(bm?bm.ccnt:'n/a')
		}
		for(var i=0;i<doc.m_unkeyed_bookmarks.length;i++){
			var bm=doc.m_unkeyed_bookmarks[i]
			if(bm){
				new_metadata.m_unkeyed_bookmarks.push(bm.ccnt)
			}
		}
		UI.m_ui_metadata[this.file_name]=new_metadata
	},
	OnSave:function(){
		this.SaveMetaData();
		UI.SaveMetaData();
		this.doc.CallHooks("save")
		this.ParseFile()
	},
	Save:function(){
		var doc=this.doc
		if(doc.ed.hfile_loading){
			this.CreateNotification({id:'saving_progress',icon:'错',text:"You cannot save a file before it finishes loading"})
			return
		}
		var ctx=UI.EDSaver_Open(doc.ed,this.file_name)
		if(!ctx){
			this.CreateNotification({id:'saving_progress',icon:'错',text:"Cannot create a temporary file for saving"})
			return
		}
		doc.ed.saving_context=ctx
		this.AcquireEditLock();
		var fsave=UI.HackCallback(function(){
			var ret=UI.EDSaver_Write(ctx)
			if(ret=="done"){
				doc.saved_point=doc.ed.GetUndoQueueLength()
				this.ReleaseEditLock();
				doc.ed.saving_context=undefined
				this.OnSave();
				this.DismissNotification('saving_progress')
				UI.Refresh()
			}else if(ret=="continue"){
				this.CreateNotification({id:'saving_progress',icon:undefined,text:"Saving @1%...".replace('@1',(ctx.progress*100).toFixed(0)),
					progress:ctx.progress
				},"quiet")
				UI.NextTick(fsave)
			}else{
				this.ReleaseEditLock();
				doc.ed.saving_context=undefined
				this.CreateNotification({id:'saving_progress',icon:'错',text:"Failed to save it"})
			}
		}).bind(this)
		fsave();
	},
	///////////////////////////////////////////
	m_edit_lock:0,
	AcquireEditLock:function(){
		this.m_edit_lock++
	},
	ReleaseEditLock:function(){
		if(this.m_edit_lock>0){this.m_edit_lock--;}
	},
	////////////////////////////////////
	//the virtual document doesn't include middle expansion
	//middle-expand with fixed additional size to make it possible
	ResetFindingContext:function(sneedle,flags, force_ccnt){
		var doc=this.doc
		var ccnt=(force_ccnt==undefined?doc.sel1.ccnt:force_ccnt)
		if(this.m_current_find_context){
			if(force_ccnt!=undefined&&force_ccnt==this.m_current_find_context.m_starting_ccnt0&&!this.m_changed_after_find){
				return;
			}
			this.m_current_find_context.Cancel()
			this.m_current_find_context=undefined
		}
		if(!sneedle.length){
			this.m_current_find_context=undefined
			this.m_current_needle=undefined
			return;
		}
		this.m_current_needle=sneedle
		var hc=UI.GetCharacterHeight(doc.font)
		var ccnt_tot=doc.ed.GetTextSize()
		var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
		var ctx={
			m_is_just_reset:1,
			m_forward_matches:[],
			m_forward_frontier:ccnt,
			m_backward_matches:[],
			m_backward_frontier:ccnt,
			m_highlight_ranges:[],
			m_locators:[],
			m_owner:this,
			m_starting_ccnt0:force_ccnt==undefined?doc.sel0.ccnt:ccnt,
			m_starting_ccnt1:force_ccnt==undefined?doc.sel1.ccnt:ccnt,
			m_current_point:0,
			m_needle:sneedle,
			m_flags:flags,
			m_find_scroll_visual_y:-(this.h/this.find_item_scale-this.find_item_expand_current*hc)*0.5,
			m_home_end:'init',
			///////////////////////////////
			m_merged_y_windows_backward:[],
			m_merged_y_windows_forward:[],
			m_mergable_ccnt_backward:undefined,
			m_mergable_ccnt_forward:undefined,
			m_current_merged_item:0,
			m_y_extent_backward:0,
			m_y_extent_forward:0,
			CreateHighlight:function(ccnt0,ccnt1){
				var doc=this.m_owner.doc
				var locator_0=doc.ed.CreateLocator(ccnt0,-1);locator_0.undo_tracked=0;
				var locator_1=doc.ed.CreateLocator(ccnt1,-1);locator_1.undo_tracked=0;
				var hlobj=doc.ed.CreateHighlight(locator_0,locator_1,-1)
				hlobj.color=this.m_owner.find_item_highlight_color;
				hlobj.invertible=0;
				this.m_highlight_ranges.push(hlobj);
				this.m_locators.push(locator_0);
				this.m_locators.push(locator_1);
				UI.Refresh()
			},
			ReportMatchForward:function(ccnt0,ccnt1){
				this.m_forward_matches.push(ccnt0,ccnt1)
				this.CreateHighlight(ccnt0,ccnt1)
				return 1024
			},
			ReportMatchBackward:function(ccnt0,ccnt1){
				this.m_backward_matches.push(ccnt0,ccnt1)
				this.CreateHighlight(ccnt0,ccnt1)
				return 1024
			},
			Cancel:function(){
				for(var i=0;i<this.m_highlight_ranges.length;i++){
					this.m_highlight_ranges[i].discard()
				}
				for(var i=0;i<this.m_locators.length;i++){
					this.m_locators[i].discard()
				}
			},
		}
		this.m_current_find_context=ctx
		var y_id=doc.ed.XYFromCcnt(ccnt).y
		var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
		//id, virtual_screen_y, scroll_y, h
		//the middle segment is duplicated for convenience
		ctx.m_merged_y_windows_backward.push(0,-hc,y_id0,y_id1-y_id0)
		ctx.m_merged_y_windows_forward.push(0,-hc,y_id0,y_id1-y_id0)
		ctx.m_mergable_ccnt_backward=doc.ed.SeekXY(0,y_id)
		ctx.m_mergable_ccnt_forward=doc.ed.SeekXY(1e17,y_id)
		ctx.m_y_extent_backward=-hc
		ctx.m_y_extent_forward=hc*2
		if(force_ccnt==undefined){
			this.AutoScrollFindItems();
			UI.InvalidateCurrentFrame();
			UI.Refresh()
		}
	},
	GetFindItem:function(id){
		var ctx=this.m_current_find_context
		var arr,ofs;
		if(id<0){
			ofs=-id
			arr=ctx.m_merged_y_windows_backward
		}else{
			ofs=id
			arr=ctx.m_merged_y_windows_forward
		}
		ofs<<=2
		return {id:arr[ofs+0],visual_y:arr[ofs+1],scroll_y:arr[ofs+2],shared_h:arr[ofs+3]}
	},
	BisectFindItems:function(y){
		var ctx=this.m_current_find_context
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.visual_y<=y){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		return Math.max(r,l0);
	},
	GetMatchCcnt:function(id,side){
		var ctx=this.m_current_find_context
		if(id==0){
			return side==0?ctx.m_starting_ccnt0:ctx.m_starting_ccnt1;
		}else if(id<0){
			var ofs=(id+1)*(-2)+side
			if(ofs<ctx.m_backward_matches.length){
				return ctx.m_backward_matches[ofs]
			}
		}else{
			var ofs=(id-1)*2+side
			if(ofs<ctx.m_forward_matches.length){
				return ctx.m_forward_matches[ofs]
			}
		}
		return undefined
	},
	AutoScrollFindItems:function(){
		var doc=this.doc
		var ctx=this.m_current_find_context
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1)
		var l=l0
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		var id=ctx.m_current_point
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.id<=id){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		var fitem_current=this.GetFindItem(r)
		ctx.m_current_merged_item=r
		ctx.m_current_visual_y=doc.ed.XYFromCcnt(this.GetMatchCcnt(id,0)).y-fitem_current.scroll_y+fitem_current.visual_y
		////////////////////
		var hc=UI.GetCharacterHeight(doc.font)
		var find_shared_h=(this.h-this.h_find_bar)/this.find_item_scale-this.find_item_expand_current*hc
		var h_bof_eof_message_with_sep=UI.GetCharacterHeight(this.find_message_font)+this.find_item_separation*2
		ctx.m_current_visual_h=find_shared_h
		doc.sel0.ccnt=this.GetMatchCcnt(id,0)
		doc.sel1.ccnt=this.GetMatchCcnt(id,1)
		doc.AutoScroll("show")
		ctx.m_find_scroll_visual_y=Math.min(Math.max(ctx.m_find_scroll_visual_y,fitem_current.visual_y+fitem_current.shared_h+h_bof_eof_message_with_sep-find_shared_h),fitem_current.visual_y-h_bof_eof_message_with_sep)
		ctx.m_find_scroll_visual_y=Math.max(Math.min(ctx.m_find_scroll_visual_y,ctx.m_y_extent_forward+h_bof_eof_message_with_sep-find_shared_h),ctx.m_y_extent_backward-h_bof_eof_message_with_sep)
	},
	BisectMatches:function(ccnt){
		var ctx=this.m_current_find_context
		var l0=-(ctx.m_backward_matches.length>>1)
		var l=l0
		var r=(ctx.m_forward_matches.length>>1)
		while(l<=r){
			var m=(l+r)>>1
			var ccnt_m=this.GetMatchCcnt(m,0)
			if(ccnt_m<=ccnt){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		return r;
	},
	//visual y -> bsearch -> scroll_y -> ccnt -> bsearch -> match id
	SeekFindItemByVisualY:function(visual_y,scroll_x){
		var ctx=this.m_current_find_context
		var doc=this.doc
		//visual y -> bsearch -> scroll_y
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		var id=ctx.m_current_point
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.visual_y<=visual_y){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		//scroll_y -> ccnt
		var fitem=this.GetFindItem(r)
		var scroll_y=visual_y-fitem.visual_y+fitem.scroll_y
		var ccnt=doc.ed.SeekXY(scroll_x,scroll_y)
		//ccnt -> bsearch -> match id
		ctx.m_current_point=this.BisectMatches(ccnt)
	},
	RenderVisibleFindItems:function(w_line_numbers,w_find_items,h_find_items, DrawItem){
		this.AutoScrollFindItems()
		//do it here and now
		var ctx=this.m_current_find_context
		var doc=this.doc
		var hc=UI.GetCharacterHeight(doc.font)
		var h_bof_eof_message=UI.GetCharacterHeight(this.find_message_font)+this.find_item_separation
		var eps=hc/16;
		var ccnt_middle=this.GetMatchCcnt(ctx.m_current_point,1)
		var xy_middle=doc.ed.XYFromCcnt(ccnt_middle)
		var find_scroll_x=Math.max(xy_middle.x-(w_find_items-w_line_numbers),0)
		var find_scroll_y=ctx.m_find_scroll_visual_y
		var anim_node=W.AnimationNode("find_item_scrolling",{
			scroll_x:find_scroll_x,
			scroll_y:find_scroll_y,
		})
		find_scroll_x=anim_node.scroll_x
		find_scroll_y=anim_node.scroll_y
		if(ctx.m_is_just_reset){
			//don't animate the first round
			ctx.m_is_just_reset=0;
			this.find_item_scrolling=undefined;
		}
		var find_shared_h=h_find_items
		var ccnt_tot=doc.ed.GetTextSize()
		var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
		var h_safety=hc*this.find_item_expand_current;
		var h_safety_internal=h_safety+h_find_items//for page up/down
		if(find_scroll_y<ctx.m_y_extent_backward+h_safety_internal&&!UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)){
			var p0=ctx.m_backward_matches.length
			ctx.m_backward_frontier=UI.ED_Search(doc.ed,ctx.m_backward_frontier,-1,ctx.m_needle,ctx.m_flags,262144,ctx.ReportMatchBackward,ctx)
			var ccnt_merged_anyway=ctx.m_mergable_ccnt_backward
			var current_y1=ctx.m_merged_y_windows_backward.pop()
			var current_y0=ctx.m_merged_y_windows_backward.pop()
			var current_visual_y=ctx.m_merged_y_windows_backward.pop()
			var current_id=ctx.m_merged_y_windows_backward.pop()
			current_y1+=current_y0
			for(var pmatch=p0;pmatch<ctx.m_backward_matches.length;pmatch+=2){
				var ccnt_id=ctx.m_backward_matches[pmatch]
				if(ccnt_id>=ccnt_merged_anyway){current_id=-1-(pmatch>>1);continue;}
				var y_id=doc.ed.XYFromCcnt(ccnt_id).y
				var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
				if(y_id1>current_y0-eps){
					//merge
					current_visual_y-=Math.max(current_y0-y_id0,0)
					current_id=-1-(pmatch>>1)
					current_y0=y_id0
				}else{
					ctx.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
					current_id=-1-(pmatch>>1)
					current_y0=y_id0
					current_y1=y_id1
					current_visual_y-=y_id1-y_id0+this.find_item_separation
				}
				ccnt_merged_anyway=doc.ed.SeekXY(0,y_id)
			}
			ctx.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
			ctx.m_mergable_ccnt_backward=ccnt_merged_anyway
			ctx.m_merged_y_windows_forward[0]=ctx.m_merged_y_windows_backward[0]
			ctx.m_merged_y_windows_forward[1]=ctx.m_merged_y_windows_backward[1]
			ctx.m_merged_y_windows_forward[2]=ctx.m_merged_y_windows_backward[2]
			ctx.m_merged_y_windows_forward[3]=ctx.m_merged_y_windows_backward[3]
			ctx.m_y_extent_backward=current_visual_y
			if(ctx.m_home_end=='home'){
				ctx.m_current_point=-(ctx.m_backward_matches.length>>1)
				if(UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)){
					ctx.m_home_end=undefined
				}
			}
			UI.Refresh()
		}
		if(find_scroll_y+find_shared_h>ctx.m_y_extent_forward-h_safety_internal&&!UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
			var p0=ctx.m_forward_matches.length
			ctx.m_forward_frontier=UI.ED_Search(doc.ed,ctx.m_forward_frontier,1,ctx.m_needle,ctx.m_flags,262144,ctx.ReportMatchForward,ctx);
			var ccnt_merged_anyway=ctx.m_mergable_ccnt_forward
			var current_y1=ctx.m_merged_y_windows_forward.pop()
			var current_y0=ctx.m_merged_y_windows_forward.pop()
			var current_visual_y=ctx.m_merged_y_windows_forward.pop()
			var current_id=ctx.m_merged_y_windows_forward.pop()
			current_y1+=current_y0
			for(var pmatch=p0;pmatch<ctx.m_forward_matches.length;pmatch+=2){
				var ccnt_id=ctx.m_forward_matches[pmatch]
				if(ccnt_id<=ccnt_merged_anyway){continue;}
				var y_id=doc.ed.XYFromCcnt(ccnt_id).y
				var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
				if(y_id0<current_y1+eps){
					//merge
					current_y1=y_id1
				}else{
					ctx.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
					current_visual_y+=current_y1-current_y0+this.find_item_separation
					current_id=(pmatch>>1)+1
					current_y0=y_id0
					current_y1=y_id1
				}
				ccnt_merged_anyway=doc.ed.SeekXY(1e17,y_id)
			}
			ctx.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
			ctx.m_mergable_ccnt_forward=ccnt_merged_anyway
			ctx.m_merged_y_windows_backward[0]=ctx.m_merged_y_windows_forward[0]
			ctx.m_merged_y_windows_backward[1]=ctx.m_merged_y_windows_forward[1]
			ctx.m_merged_y_windows_backward[2]=ctx.m_merged_y_windows_forward[2]
			ctx.m_merged_y_windows_backward[3]=ctx.m_merged_y_windows_forward[3]
			ctx.m_y_extent_forward=current_visual_y+current_y1-current_y0
			if(ctx.m_home_end=='end'){
				ctx.m_current_point=(ctx.m_forward_matches.length>>1)
				if(UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
					ctx.m_home_end=undefined
				}
			}
			if(ctx.m_home_end=='init'){
				if(ctx.m_forward_matches.length>0){
					ctx.m_current_point=1
					ctx.m_home_end=undefined
				}else if(UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
					ctx.m_home_end=undefined
				}
			}
			UI.Refresh()
		}
		var p0=this.BisectFindItems(find_scroll_y-h_safety)
		var p1=this.BisectFindItems(find_scroll_y+find_shared_h+h_safety)
		var ret=[]
		if(p0==-((ctx.m_merged_y_windows_backward.length>>2)-1)){
			//BOF
			var s_bof_message;
			if(!UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)){
				s_bof_message=UI._("Searching @1%").replace("@1",((1-UI.GetSearchFrontierCcnt(ctx.m_backward_frontier)/ccnt_tot)*100).toFixed(0))
			}else{
				s_bof_message=UI._("No more matches above")
			}
			var text_dim=UI.MeasureText(this.find_message_font,s_bof_message)
			var y=ctx.m_y_extent_backward-find_scroll_y-h_bof_eof_message
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:this.find_message_font,color:this.find_message_color,
				text:s_bof_message})
		}
		for(var i=p0;i<=p1;i++){
			var find_item_i=this.GetFindItem(i)
			var h_expand=0
			if(i==ctx.m_current_merged_item){
				h_expand=hc*this.find_item_expand_current;
			}
			var nodekey="find_item_"+i.toString();
			h_expand=W.AnimationNode(nodekey,{
				h_expand:h_expand,
			}).h_expand
			find_scroll_y-=h_expand*0.5
			DrawItem(find_item_i, find_scroll_x,find_scroll_y,h_expand)
			find_scroll_y-=h_expand*0.5
		}
		if(p1==(ctx.m_merged_y_windows_forward.length>>2)-1){
			//EOF
			var s_eof_message;
			if(!UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
				s_eof_message=UI._("Searching @1%").replace("@1",((UI.GetSearchFrontierCcnt(ctx.m_forward_frontier)/ccnt_tot)*100).toFixed(0))
			}else{
				s_eof_message=UI._("No more matches below")
			}
			var text_dim=UI.MeasureText(this.find_message_font,s_eof_message)
			var y=ctx.m_y_extent_forward-find_scroll_y+this.find_item_separation
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:this.find_message_font,color:this.find_message_color,
				text:s_eof_message})
		}
		return ret
	},
	FindNext:function(direction){
		UI.assert(!this.m_find_next_context,"panic: FindNext when there is another context")
		if(!this.m_current_needle){
			//no needle, no find
			return;
		}
		this.DestroyReplacingContext()
		var doc=this.doc
		var ccnt=doc.sel1.ccnt
		var ctx={
			m_frontier:ccnt,
			m_owner:this,
			m_needle:this.m_current_needle,
			m_flags:this.m_find_flags,
			m_match_reported:0,
			ReportMatch:function(ccnt0,ccnt1){
				if(direction>0){
					doc.sel0.ccnt=ccnt0
					doc.sel1.ccnt=ccnt1
				}else{
					doc.sel0.ccnt=ccnt1
					doc.sel1.ccnt=ccnt0
				}
				this.m_match_reported=1
				doc.AutoScroll("center_if_hidden")
				doc.CallOnSelectionChange();
				UI.Refresh()
				return 1048576
			},
			ffind_next:function(){
				this.m_frontier=UI.ED_Search(doc.ed,this.m_frontier,direction,this.m_needle,this.m_flags,1048576,this.ReportMatch,this)
				if(UI.IsSearchFrontierCompleted(this.m_frontier)||this.m_match_reported){
					UI.assert(this.m_owner.m_find_next_context==this,"panic: FindNext context overwritten")
					this.m_owner.ReleaseEditLock();
					this.m_owner.m_find_next_context=undefined
					if(!this.m_match_reported){
						//notification
						this.m_owner.CreateNotification({id:'find_result',icon:'警',text:(direction<0?"No more matches above":"No more matches below")})
					}
					UI.Refresh()
				}else{
					UI.NextTick(this.ffind_next.bind(this));
				}
			}
		}
		this.AcquireEditLock();
		this.m_find_next_context=ctx;
		ctx.ffind_next();
	},
	BeforeQuickFind:function(direction){
		var sel=this.doc.GetSelection()
		//this.show_find_bar=1
		this.m_sel0_before_find=this.doc.sel0.ccnt
		this.m_sel1_before_find=this.doc.sel1.ccnt
		if(!(sel[0]<sel[1])){
			var ccnt=this.doc.sel1.ccnt
			var ed=this.doc.ed
			sel[0]=this.doc.SkipInvisibles(ccnt,-1);
			sel[0]=this.doc.SnapToValidLocation(ed.MoveToBoundary(ed.SnapToCharBoundary(sel[0],-1),-1,"word_boundary_left"),-1)
			sel[1]=this.doc.SkipInvisibles(ccnt,1);
			sel[1]=this.doc.SnapToValidLocation(ed.MoveToBoundary(ed.SnapToCharBoundary(sel[1],1),1,"word_boundary_right"),1)
		}
		if(sel[0]<sel[1]){
			if(this.m_current_find_context){
				this.m_current_find_context.Cancel()
				this.m_current_find_context=undefined
			}
			this.m_current_needle=this.doc.ed.GetText(sel[0],sel[1]-sel[0])
			if(this.m_find_flags&UI.SEARCH_FLAG_REGEXP){
				this.m_current_needle=RegexpEscape(this.m_current_needle)
			}
		}
	},
	///////////////////////////////////
	SetReplacingContext:function(ccnt0,ccnt1){
		this.DestroyReplacingContext();
		var ctx=this.m_current_find_context
		var doc=this.doc
		var ed=doc.ed
		var rctx={
			m_needle:ctx.m_needle,
			m_flags:ctx.m_flags,
			m_locators:[ed.CreateLocator(ccnt0,-1),ed.CreateLocator(ccnt1,1)],
		}
		rctx.m_locators[0].undo_tracked=1
		rctx.m_locators[1].undo_tracked=1
		var hlobj=doc.ed.CreateHighlight(rctx.m_locators[0],rctx.m_locators[1],-1)
		hlobj.color=this.find_item_highlight_color;
		hlobj.invertible=0;
		rctx.m_highlight=hlobj
		this.m_replace_context=rctx;
	},
	DestroyReplacingContext:function(do_dismiss){
		if(do_dismiss==undefined){do_dismiss=1;}
		var rctx=this.m_replace_context
		if(rctx){
			rctx.m_locators[0].discard()
			rctx.m_locators[1].discard()
			rctx.m_highlight.discard()
			this.m_replace_context=undefined
			if(do_dismiss){this.DismissNotification('find_result')}
		}
	},
	DoReplace:function(ccnt0,ccnt1,is_first,s_replace){
		var doc=this.doc
		var rctx=this.m_replace_context
		if(!rctx){return;}
		this.AcquireEditLock();
		rctx.m_ccnt0=ccnt0
		rctx.m_ccnt1=ccnt1
		rctx.m_frontier=ccnt0
		rctx.m_match_cost=(is_first?1048576:64)
		rctx.m_s_replace=s_replace
		rctx.m_owner=this
		var ffind_next=function(){
			//print("replace: ffind_next ",rctx.m_frontier)
			rctx.m_frontier=UI.ED_Search(doc.ed,rctx.m_frontier,1,rctx.m_needle,rctx.m_flags,1048576, undefined,rctx)
			//print("search finished ",s_replace)
			var ccnt_frontier=UI.GetSearchFrontierCcnt(rctx.m_frontier)
			if(ccnt_frontier<0||ccnt_frontier>=rctx.m_ccnt1||rctx.m_current_replace_job&&is_first){
				var need_onchange=0
				rctx.m_owner.ReleaseEditLock();
				if(rctx.m_current_replace_job){
					var n_replaced=UI.ED_ApplyReplaceOps(doc.ed,rctx.m_current_replace_job)
					need_onchange=1
					rctx.m_owner.CreateNotification({id:'find_result',icon:'对',text:UI._("Replaced @1 matches").replace("@1",n_replaced.toString())})
				}else{
					rctx.m_owner.CreateNotification({id:'find_result',icon:'警',text:(direction<0?UI._("Nothing replaced above"):UI._("Nothing replaced below"))})
				}
				rctx.m_owner.DestroyReplacingContext(0);
				if(need_onchange){doc.CallOnChange();}
			}else{
				UI.NextTick(ffind_next);
			}
		}
		ffind_next();
	},
	DoReplaceFromUI:function(is_first){
		var doc=this.doc
		var rctx=this.m_replace_context
		if(!rctx){return;}
		var sel=doc.GetSelection()
		var ccnt0,ccnt1;
		if(sel[0]<sel[1]){
			ccnt0=sel[0]
			ccnt1=sel[1]
		}else{
			ccnt0=sel[0]
			ccnt1=doc.ed.GetTextSize()
		}
		var srep_ccnt0=rctx.m_locators[0].ccnt
		var srep_ccnt1=rctx.m_locators[1].ccnt
		if(srep_ccnt0<srep_ccnt1){
			s_replace=doc.ed.GetText(srep_ccnt0,srep_ccnt1-srep_ccnt0)
		}else{
			s_replace='';
		}
		this.DoReplace(ccnt0,ccnt1,is_first,s_replace)
	},
	///////////////////////////////////
	BringUpNotification:function(item){
		var ns=this.m_notifications
		for(var i=0;i<ns.length;i++){
			var nsi=ns[i]
			if(nsi==item){
				for(var j=i-1;j>=0;j--){
					ns[j+1]=ns[j]
				}
				ns[0]=item
				//if(!i){
				//item.x_shake=this.x_shake_notification
				this.notification_list[item.id].dx_shake=this.dx_shake_notification
				//}
				return
			}
		}
	},
	CreateNotification:function(attrs,is_quiet){
		var ns=this.m_notifications
		if(!ns){
			ns=[]
			this.m_notifications=ns
		}
		for(var i=0;i<ns.length;i++){
			var nsi=ns[i]
			//(nsi.text==attrs.text&&(nsi.color==attrs.color||!attrs.color)){
			if(nsi.id==attrs.id){
				//bring it up and shake it - y-animated list?
				for(var key in attrs){
					nsi[key]=attrs[key]
				}
				if(!is_quiet){this.BringUpNotification(nsi)}
				return nsi;
			}
		}
		attrs.alpha=1
		//if(!is_quiet){attrs.dx_shake=this.dx_shake_notification}
		ns.push(attrs)
		UI.Refresh()
		return attrs;
	},
	DismissNotification:function(id){
		if(this.m_notifications){
			this.m_notifications=this.m_notifications.filter(function(a){return a.id!=id})
		}
	},
	////////////////////////////////
	ParseFile:function(){
		if(this.m_is_preview){return;}
		UI.BumpHistory(this.file_name)
		var doc=this.doc
		var sz=doc.ed.GetTextSize()
		if(sz>MAX_PARSABLE||!this.show_auto_completion){
			return;
		}
		doc.m_file_index=UI.ED_ParseAs(this.file_name,doc.plugin_language_desc)
		doc.CallHooks("parse")
	},
}

var ffindbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		this.CancelFind();
	})
	this.AddEventHandler('RETURN',function(){
		var obj=this.owner
		obj.show_find_bar=0;
		obj.doc.AutoScroll('center')
		obj.doc.scrolling_animation=undefined
		UI.Refresh()
	})
	this.AddEventHandler('change',function(){
		var obj=this.owner
		obj.doc.sel0.ccnt=obj.m_sel0_before_find
		obj.doc.sel1.ccnt=obj.m_sel1_before_find
		obj.DestroyReplacingContext();
		obj.ResetFindingContext(this.ed.GetText(),obj.m_find_flags)
	})
	this.AddEventHandler('UP',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point>-((ctx.m_backward_matches.length>>1))){
				ctx.m_current_point--
				obj.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	this.AddEventHandler('DOWN',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point<(ctx.m_forward_matches.length>>1)){
				ctx.m_current_point++
				obj.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	//////////////////////////////////////////////////
	this.AddEventHandler('PGUP',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y-=ctx.m_current_visual_h
			obj.SeekFindItemByVisualY(ctx.m_current_visual_y-ctx.m_current_visual_h,1e17)
			ctx.m_home_end=undefined;
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('PGDN',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y+=ctx.m_current_visual_h
			obj.SeekFindItemByVisualY(ctx.m_current_visual_y+ctx.m_current_visual_h,0)
			ctx.m_home_end=undefined;
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+HOME',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			obj.SeekFindItemByVisualY(ctx.m_y_extent_backward,0)
			ctx.m_home_end='home';
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+END',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			obj.SeekFindItemByVisualY(ctx.m_y_extent_forward,1e17)
			ctx.m_home_end='end';
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
}

var FILE_LISTING_BUDGET=100
W.FileItemOnDemand=function(){
	if(!this.name_to_find){
		return "keep"
	}
	if(!this.m_find_context){
		//enum both files and dirs
		this.m_find_context=IO.CreateEnumFileContext(this.name_to_find,3)
	}
	var ret=[];
	for(var i=0;i<FILE_LISTING_BUDGET;i++){
		var fnext=this.m_find_context()
		if(!fnext){
			this.m_find_context=undefined;
			return ret
		}
		if(UI.m_current_file_list.m_appeared_full_names[fnext.name]){continue;}
		UI.m_current_file_list.m_appeared_full_names[fnext.name]=1
		ret.push({
			name:fnext.name,
			size:fnext.size,
			is_dir:fnext.is_dir,
			time:fnext.time,
			h:UI.default_styles.file_item.h})
	}
	ret.push(this)
	return ret;
}

var GetSmartFileName=function(obj_param){
	if(!obj_param.display_name){
		var redo_queue=[]
		redo_queue.push(obj_param)
		for(;redo_queue.length;){
			var obj=redo_queue.pop()
			var ret=obj.display_name
			if(ret){return ret;}
			var arv=UI.m_current_file_list.m_appeared_names
			var name=obj.name
			var name_s=name
			for(;;){
				var pslash=name_s.lastIndexOf('/')
				var cur_name
				if(pslash<=0){
					cur_name=name
				}else{
					cur_name=name.substr(pslash+1)
				}
				var obj0=arv[cur_name];
				if(!obj0){
					arv[cur_name]=obj
					obj.display_name=cur_name
					break;
				}
				if(typeof obj0=='string'){
					//screwed, continue
				}else{
					//need to re-get obj0's name
					obj0.display_name=undefined
					redo_queue.push(obj0)
					UI.InvalidateCurrentFrame()
					UI.Refresh()
					arv[cur_name]='screwed'
				}
				if(pslash<=0){
					obj.display_name=cur_name
					break
				}
				name_s=name_s.substr(0,pslash)
			}
		}
	}
	return obj_param.display_name
}

var ZeroPad=function(n,w){
	var s=n.toString();
	if(s.length<w){
		var a=[]
		for(var i=s.length;i<w;i++){
			a.push('0')
		}
		a.push(s)
		s=a.join("")
	}
	return s
}

var FormatFileSize=function(size){
	if(size<1024){
		return size+"B"
	}else if(size<1048576){
		return (size/1024).toFixed(1)+"KB"
	}else if(size<1073741824){
		return (size/1048576).toFixed(1)+"MB"
	}else if(size<1099511627776){
		return (size/1073741824).toFixed(1)+"GB"
	}else{
		return (size/1099511627776).toFixed(1)+"TB"
	}
}

var FormatRelativeTime=function(then,now){
	if(now[0]==then[0]){
		if(now[1]==then[1]){
			if(now[2]==then[2]){
				return UI.Format("@1:@2",ZeroPad(then[3],2),ZeroPad(then[4],2,10))
			}else if(now[2]==then[2]+1){
				return UI.Format("@1:@2 Yesterday",ZeroPad(then[3],2),ZeroPad(then[4],2,10))
			}
		}
		return UI.MonthDay(then[1],then[2])
	}else{
		return UI.Format("@1/@2/@3",ZeroPad(then[1]+1,2),ZeroPad(then[2]+1,2),then[0])
	}
}

var FileItem_prototype={
	OnDblClick:function(event){
		if(this.is_dir){
			var obj=this.owner
			var fbar=obj.find_bar_edit
			var ed=fbar.ed
			ed.Edit([0,ed.GetTextSize(),this.name+'/'])
			fbar.sel1.ccnt=ed.GetTextSize()
			fbar.sel0.ccnt=fbar.sel1.ccnt
			fbar.CallOnChange()
			UI.Refresh()
			return
		}
		var fn=this.name
		var obj=this.owner.owner
		obj.file_name=fn
		obj.doc=undefined
		obj.m_language_id=undefined
		obj.m_is_brand_new=undefined;
		obj.m_is_preview=undefined;
		UI.Refresh()
	},
}
W.FileItem=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"file_item",FileItem_prototype);
	UI.Begin(obj)
		//icon, name, meta-info
		//hopefully go without a separator line
		var s_ext=UI.GetFileNameExtension(obj.name)
		var language_id=Language.GetNameByExt(s_ext)
		var desc=Language.GetDescObjectByName(language_id)
		var ext_color=(desc.file_icon_color||obj.file_icon_color)
		var icon_code=(desc.file_icon||'档').charCodeAt(0)
		if(obj.is_dir){
			ext_color=0xffb4771f
			icon_code='开'.charCodeAt(0)
		}
		var sel_bgcolor=ext_color
		//////////////
		var icon_font=UI.Font(UI.icon_font_name,obj.h_icon)
		var w_icon=UI.GetCharacterAdvance(icon_font,icon_code)
		if(obj.selected){
			ext_color=obj.sel_file_icon_color
			UI.RoundRect({
				x:obj.x,y:obj.y+2,w:obj.w-12,h:obj.h-4,
				color:sel_bgcolor})
		}
		UI.DrawChar(icon_font,obj.x,obj.y+(obj.h-obj.h_icon)*0.5,ext_color,icon_code)
		W.Text("",{x:obj.x+w_icon,y:obj.y+4,
			font:obj.name_font,text:GetSmartFileName(obj),
			color:obj.selected?obj.sel_name_color:obj.name_color})
		var s_misc_text=[obj.is_dir?UI._("Folder"):FormatFileSize(obj.size),FormatRelativeTime(obj.time,UI.m_current_file_list.m_now)].join(", ")
		W.Text("",{x:obj.x+w_icon,y:obj.y+30,
			font:obj.misc_font,text:s_misc_text,
			color:obj.selected?obj.sel_misc_color:obj.misc_color})
		s_ext=s_ext.toUpperCase()
		if(!desc.file_icon&&!obj.is_dir){
			var ext_dims=UI.MeasureText(UI.Font(UI.font_name,24),s_ext)
			var ext_font=UI.Font(UI.font_name,Math.min(24*28/ext_dims.w,24))
			ext_dims=UI.MeasureText(ext_font,s_ext)
			W.Text("",{x:obj.x+(w_icon-ext_dims.w)*0.5,y:obj.y+(obj.h-ext_dims.h)*0.5,
				font:ext_font,text:s_ext,
				color:ext_color})
		}
	UI.End()
	return obj
}

var fnewpage_findbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		var obj=this.owner
		if(this.m_close_on_esc){
			UI.top.app.document_area.CloseTab()
		}else{
			var editor_widget=obj.owner
			editor_widget.m_is_brand_new=0
			if(editor_widget.m_file_name_before_preview){
				//clear preview
				editor_widget.file_name=editor_widget.m_file_name_before_preview
				editor_widget.doc=undefined
				editor_widget.m_language_id=undefined
				editor_widget.m_is_preview=0
				editor_widget.m_file_name_before_preview=undefined
			}
		}
		UI.Refresh()
	})
	var fpassthrough=function(key,event){
		var obj=this.owner
		obj.file_list.OnKeyDown(event)
	}
	this.AddEventHandler('change',function(){
		var obj=this.owner
		obj.m_file_list=undefined
		UI.Refresh()
	})
	this.AddEventHandler('RETURN RETURN2',fpassthrough)
	this.AddEventHandler('UP',fpassthrough)
	this.AddEventHandler('DOWN',fpassthrough)
	this.AddEventHandler('PGUP',fpassthrough)
	this.AddEventHandler('PGDN',fpassthrough)
	this.AddEventHandler('TAB',function(key,event){
		//todo: path completion
	})
}

var g_regexp_backslash=new RegExp("\\\\","g");
var g_regexp_abspath=new RegExp("(([a-zA-Z]:/)|(/)).*");
W.SXS_NewPage=function(id,attrs){
	//todo: proper refreshing on metadata change
	//todo: left-window preview... how? initiate a weak load, core ready
	var obj=UI.StdWidget(id,attrs,"sxs_new_page");
	UI.Begin(obj)
		UI.RoundRect(obj)
		////////////////////////////////////////////
		//the find bar
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h_find_bar,
			color:obj.find_bar_bgcolor})
		var rect_bar=UI.RoundRect({
			x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
			w:obj.w-obj.find_bar_padding*2,h:obj.h_find_bar-obj.find_bar_padding*2,
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
			plugins:[fnewpage_findbar_plugin],
		});
		if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
			W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
				font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
				text:"Search"})
		}
		////////////////////////////////////////////
		UI.m_current_file_list=obj.m_current_file_list
		var files=obj.m_file_list;
		var first_time=0
		if(!files){
			obj.m_current_file_list={
				m_now:IO.WallClockTime(),
				m_appeared_names:{},
				m_appeared_full_names:{},
			}
			UI.m_current_file_list=obj.m_current_file_list
			files=[]
			///////////////////////
			var s_search_text=obj.find_bar_edit.ed.GetText()
			//it's more of a smart interpretation of the user-typed string, not a full-blown explorer
			//history mode
			//only do space split for hist mode
			if(s_search_text.indexOf('/')<0){
				var hist=UI.m_ui_metadata["<history>"].filter(function(a){return a.toUpperCase()})
				if(hist){
					var hist_keywords=s_search_text.split(" ");
					for(var i=hist.length-1;i>=0;i--){
						var fn_i=hist[i],fn_i_search=fn_i.toUpperCase()
						var is_invalid=0;
						for(var j=0;j<hist_keywords.length;j++){
							if(fn_i.indexOf(hist_keywords[j])<0){
								is_invalid=1
								break;
							}
						}
						if(is_invalid){continue;}
						files.push({name_to_find:fn_i})
					}
				}
			}
			//file system part
			var s_path=s_search_text
			if(s_path.length||!files.length){
				s_path=s_path.replace(g_regexp_backslash,"/")
				if(s_path.match(g_regexp_abspath)){
					//do nothing: it's absolute
				}else{
					s_path=UI.m_new_document_search_path+"/"+s_path
				}
				files.push({
					name_to_find:s_path+"*"
				})
			}
			//coulddo: git project part
			obj.m_file_list=files
			obj.file_list=undefined
			first_time=1
		}
		W.ListView('file_list',{
			x:obj.x+4,y:obj.y+obj.h_find_bar+4,w:obj.w-8,h:obj.h-obj.h_find_bar-4,
			mouse_wheel_speed:80,
			dimension:'y',layout_spacing:0,layout_align:'fill',
			OnDemand:W.FileItemOnDemand,
			OnChange:function(value){
				W.ListView_prototype.OnChange.call(this,value)
				this.OpenPreview(value)
			},
			OpenPreview:function(value,is_explicit){
				var editor_widget=obj.owner
				if(!editor_widget.m_is_brand_new||!UI.HasFocus(obj.find_bar_edit)&&!is_explicit){return;}
				if(editor_widget.m_file_name_before_preview){
					//clear preview first
					editor_widget.file_name=editor_widget.m_file_name_before_preview
					editor_widget.doc=undefined
					editor_widget.m_language_id=undefined
					editor_widget.m_is_preview=0
					editor_widget.m_file_name_before_preview=undefined
				}
				if(!this.items.length){return;}
				if(!this.items[value].name||this.items[value].is_dir){return;}
				var fn=this.name
				if(!editor_widget.m_file_name_before_preview){
					editor_widget.m_file_name_before_preview=editor_widget.file_name
				}
				editor_widget.file_name=this.items[value].name
				editor_widget.doc=undefined
				editor_widget.m_language_id=undefined
				editor_widget.m_is_brand_new=1
				editor_widget.m_is_preview=1
				UI.Refresh()
			},
			item_template:{
				object_type:W.FileItem,
				owner:obj,
			},items:files})
		if(first_time){
			obj.file_list.OpenPreview(0,"explicit")
		}
		//find bar shadow
		UI.PushCliprect(obj.x,obj.y+obj.h_find_bar,obj.w,obj.h-obj.h_find_bar)
		UI.RoundRect({
			x:obj.x-obj.find_bar_shadow_size, y:obj.y+obj.h_find_bar-obj.find_bar_shadow_size, w:obj.w+2*obj.find_bar_shadow_size, h:obj.find_bar_shadow_size*2,
			round:obj.find_bar_shadow_size,
			border_width:-obj.find_bar_shadow_size,
			color:obj.find_bar_shadow_color})
		UI.PopCliprect()
		//todo: on-demand sort, proper wiping of child elements
		//the windows way: "mounted" history
		//bread / search
	UI.End()
	return obj
}

W.CodeEditor=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"code_editor",W.CodeEditorWidget_prototype);
	if(obj.m_is_brand_new&&obj.doc&&UI.HasFocus(obj.doc)){
		if(obj.m_file_name_before_preview){
			obj.file_name=obj.m_file_name_before_preview
			obj.doc=undefined
			obj.m_language_id=undefined
			obj.m_is_preview=0
			obj.m_file_name_before_preview=undefined
		}
	}
	if(!obj.m_language_id){
		var s_ext=UI.GetFileNameExtension(obj.file_name)
		obj.m_language_id=Language.GetNameByExt(s_ext)
	}
	var sxs_visualizer=obj.m_sxs_visualizer;
	var w_obj_area=obj.w
	var h_obj_area=obj.h
	var x_sxs_area=0
	var y_sxs_area=0
	var w_sxs_area=0
	var h_sxs_area=0
	var sxs_area_dim=undefined
	if(obj.m_is_brand_new){
		sxs_visualizer=W.SXS_NewPage
	}
	if(sxs_visualizer){
		if(w_obj_area>=h_obj_area){
			w_obj_area>>=1
			x_sxs_area=obj.x+w_obj_area
			y_sxs_area=obj.y
			w_sxs_area=obj.w-w_obj_area
			h_sxs_area=obj.h
			sxs_area_dim='x'
		}else{
			h_obj_area>>=1
			x_sxs_area=obj.x
			y_sxs_area=obj.y+h_obj_area
			w_sxs_area=obj.w
			h_sxs_area=obj.h-h_obj_area
			sxs_area_dim='y'
		}
	}
	UI.Begin(obj)
		//main code area
		var doc=obj.doc
		var prev_h_top_hint=(obj.h_top_hint||0),h_top_hint=0,w_line_numbers=0,w_scrolling_area=0,y_top_hint_scroll=0;
		var h_scrolling_area=h_obj_area
		var h_top_find=0,h_bottom_find=0
		var editor_style=UI.default_styles.code_editor.editor_style
		var top_hint_bbs=[]
		var current_find_context=obj.m_current_find_context
		var ytot
		if(doc){
			//scrolling and stuff
			var ccnt_tot=doc.ed.GetTextSize()
			var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
			if(h_obj_area<ytot&&!obj.m_is_preview){
				w_scrolling_area=obj.w_scroll_bar+4
				if(obj.show_minimap){
					w_scrolling_area+=obj.w_minimap+obj.padding
				}
			}
			if(w_obj_area<=w_line_numbers+w_scrolling_area){
				w_scrolling_area=0
				if(w_obj_area<=w_line_numbers){
					w_line_numbers=w_obj_area*0.5
				}
			}
			//top hint in a separate area
			if(obj.show_top_hint&&!obj.show_find_bar){
				var top_hints=[];
				var rendering_ccnt0=doc.SeekXY(doc.scroll_x,doc.scroll_y)
				var ccnt=doc.GetEnhancedHome(doc.sel1.ccnt)
				//prev_h_top_hint
				for(;;){
					var ccnti=ccnt
					ccnt=doc.FindOuterLevel(ccnti)
					if(ccnt<0||ccnt>=ccnti){break}
					if(ccnt<rendering_ccnt0){
						top_hints.push(ccnt)
					}
					if(top_hints.length>=obj.top_hint_max_levels){break;}
				}
				if(top_hints.length){
					//convert to bbs
					var top_hint_inv=[];
					for(var i=top_hints.length-1;i>=0;i--){
						top_hint_inv.push(top_hints[i]);
					}
					var line_xys=doc.ed.GetXYEnMasse(top_hint_inv)
					var hc=UI.GetCharacterHeight(doc.font)
					var eps=hc/16;
					var cur_bb_y0=line_xys[1];
					var cur_bb_y1=cur_bb_y0+hc;
					h_top_hint=hc
					for(var i=2;i<line_xys.length;i+=2){
						var y=line_xys[i+1];
						if(Math.abs(y-cur_bb_y1)<eps){
							cur_bb_y1=y+hc;
							h_top_hint+=hc
						}else if(y<cur_bb_y1){
							continue
						}else{
							top_hint_bbs.push(cur_bb_y0,cur_bb_y1)
							cur_bb_y0=y;
							cur_bb_y1=y+hc;
							h_top_hint+=hc
						}
					}
					if(h_top_hint>hc*obj.top_hint_max_lines-eps){
						y_top_hint_scroll=hc*obj.top_hint_max_lines-h_top_hint;
						h_top_hint=hc*obj.top_hint_max_lines;
					}
					top_hint_bbs.push(cur_bb_y0,cur_bb_y1)
				}
			}else{
				h_top_hint=0
			}
			//if(UI.nd_captured){
			//	h_top_hint=prev_h_top_hint;//don't change it while scrolling
			//}
			if(Math.abs(h_top_hint-prev_h_top_hint)>4&&h_top_hint>0&&!UI.nd_captured){
				h_top_hint=(h_top_hint*0.5+prev_h_top_hint*0.5);
				UI.Refresh()
			}
			obj.h_top_hint=h_top_hint
			if(h_top_hint-prev_h_top_hint){
				if(doc.scrolling_animation){
					var anim=doc.scrolling_animation
					if(anim.transition_current_frame){anim.transition_current_frame.scroll_y+=h_top_hint-prev_h_top_hint;}
					if(anim.transition_frame0){anim.transition_frame0.scroll_y+=h_top_hint-prev_h_top_hint;}
					if(anim.transition_frame1){anim.transition_frame1.scroll_y+=h_top_hint-prev_h_top_hint;}
				}
				doc.scroll_y+=h_top_hint-prev_h_top_hint
				doc.h=h_obj_area-h_top_hint
				if(!UI.nd_captured){doc.AutoScroll("show");}
			}
			//current line highlight
			if(!doc.cur_line_hl){
				var hl_items=doc.CreateTransientHighlight({'depth':-100,'color':obj.color_cur_line_highlight,'invertible':0});
				doc.cur_line_p0=hl_items[0]
				doc.cur_line_p1=hl_items[1]
				doc.cur_line_hl=hl_items[2]
			}
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			var line_ccnts=doc.SeekAllLinesBetween(line_current,line_current+2)
			doc.cur_line_p0.ccnt=line_ccnts[0];
			doc.cur_line_p1.ccnt=line_ccnts[1];
			//find highlight
			if(!obj.show_find_bar&&obj.m_current_needle){
				//repeat the animation to get correct the correct scrolling information
				UI.Begin(doc)
					var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
						scroll_x:doc.scroll_x,
						scroll_y:doc.scroll_y})
				UI.End("temp")
				doc.visible_scroll_x=anim.scroll_x
				doc.visible_scroll_y=anim.scroll_y
				var scroll_x=doc.visible_scroll_x;
				var scroll_y=doc.visible_scroll_y;
				var area_w=doc.w
				var area_h=doc.h
				var rendering_ccnt0=doc.SeekXY(scroll_x,scroll_y)
				var rendering_ccnt1=doc.SeekXY(scroll_x+area_w,scroll_y+area_h)
				obj.ResetFindingContext(obj.m_current_needle,obj.m_find_flags, Math.min(Math.max(rendering_ccnt0,doc.SeekLC(doc.GetLC(doc.sel1.ccnt)[0],0)),rendering_ccnt1))
				var ctx=obj.m_current_find_context
				current_find_context=ctx
				if(!UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)&&UI.GetSearchFrontierCcnt(ctx.m_backward_frontier)>rendering_ccnt0){
					ctx.m_backward_frontier=UI.ED_Search(doc.ed,ctx.m_backward_frontier,-1,ctx.m_needle,ctx.m_flags,65536,ctx.ReportMatchBackward,ctx)
					UI.Refresh()
				}
				if(!UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)&&UI.GetSearchFrontierCcnt(ctx.m_forward_frontier)<rendering_ccnt1){
					ctx.m_forward_frontier=UI.ED_Search(doc.ed,ctx.m_forward_frontier,1,ctx.m_needle,ctx.m_flags,65536,ctx.ReportMatchForward,ctx);
					UI.Refresh()
				}
			}
		}
		//hopefully 8 is the widest char
		if(obj.show_line_numbers){
			var lmax=(doc?doc.GetLC(doc.ed.GetTextSize())[0]:0)+1
			w_line_numbers=lmax.toString().length*UI.GetCharacterAdvance(obj.line_number_font,56);
		}
		var w_bookmark=UI.GetCharacterAdvance(obj.bookmark_font,56)+4
		w_line_numbers+=obj.padding+w_bookmark;
		if(obj.show_find_bar&&current_find_context){
			UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x,y:obj.y,w:w_obj_area,h:h_obj_area})
			UI.RoundRect({color:obj.bgcolor,x:obj.x+w_obj_area-w_scrolling_area,y:obj.y,w:w_scrolling_area,h:h_obj_area})
		}else{
			UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y,w:w_line_numbers,h:h_obj_area})
			UI.RoundRect({color:obj.bgcolor,x:obj.x+w_line_numbers,y:obj.y,w:w_obj_area-w_line_numbers,h:h_obj_area})
		}
		if(doc&&doc.ed.hfile_loading){
			//loading progress
			obj.CreateNotification({
				id:'loading_progress',
				icon:undefined,
				progress:doc.ed.hfile_loading.progress,
				text:"Loading @1%...".replace('@1',(doc.ed.hfile_loading.progress*100).toFixed(0))},"quiet")
		}else{
			obj.DismissNotification('loading_progress')
		}
		var DrawLineNumbers=function(scroll_x,scroll_y,area_w,area_y,area_h){
			if(bm_xys){
				var hc=UI.GetCharacterHeight(doc.font)
				UI.PushCliprect(obj.x,area_y,w_obj_area,area_h)
				for(var i=0;i<bm_ccnts.length;i++){
					var y=bm_xys[i*2+1]-scroll_y+area_y
					var id=bm_ccnts[i][0]
					UI.RoundRect({x:2,y:y+4,w:w_line_numbers-4,h:hc-8,
						color:obj.bookmark_color,
						border_color:obj.bookmark_border_color,
						border_width:Math.min(hc/8,2),
						round:4})
					if(id>=0){
						UI.DrawChar(obj.bookmark_font,4,y+4,obj.bookmark_text_color,48+id)
					}
				}
				UI.PopCliprect()
			}
			if(obj.show_line_numbers){
				var rendering_ccnt0=doc.SeekXY(scroll_x,scroll_y)
				var rendering_ccnt1=doc.SeekXY(scroll_x+area_w,scroll_y+area_h)
				var dy_line_number=(UI.GetCharacterHeight(doc.font)-UI.GetCharacterHeight(obj.line_number_font))*0.5;
				var line0=doc.GetLC(rendering_ccnt0)[0];
				var line1=doc.GetLC(rendering_ccnt1)[0];
				var line_ccnts=doc.SeekAllLinesBetween(line0,line1+1);
				var line_xys=doc.ed.GetXYEnMasse(line_ccnts)
				UI.PushCliprect(obj.x,area_y,w_obj_area,area_h)
				for(var i=0;i<line_ccnts.length;i++){
					if(i&&line_ccnts[i]==line_ccnts[i-1]){break;}
					var s_line_number=(line0+i+1).toString();
					var y=line_xys[i*2+1]-scroll_y+dy_line_number+area_y
					var text_dim=UI.MeasureText(obj.line_number_font,s_line_number)
					var x=w_line_numbers-text_dim.w-obj.padding
					W.Text("",{x:obj.x+x,y:y, font:obj.line_number_font,text:s_line_number,color:line0+i==line_current?obj.line_number_color_focus:obj.line_number_color})
				}
				UI.PopCliprect()
			}
		}
		var bm_ccnts=undefined,bm_xys=undefined;
		var PrepareBookmarks=function(){
			//prepare bookmarks - they appear under line numbers
			bm_ccnts=[]
			for(var i=0;i<doc.m_bookmarks.length;i++){
				var bm=doc.m_bookmarks[i];
				if(bm){
					bm_ccnts.push([i,bm.ccnt])
				}
			}
			var bm_filtered=[];
			for(var i=0;i<doc.m_unkeyed_bookmarks.length;i++){
				var bm=doc.m_unkeyed_bookmarks[i];
				if(bm){
					bm_ccnts.push([-1,bm.ccnt])
					bm_filtered.push(bm)
				}
			}
			doc.m_unkeyed_bookmarks=bm_filtered;
			if(bm_ccnts.length){
				bm_ccnts.sort(function(a,b){return (a[1]*10+a[0])-(b[1]*10+b[0]);});
				bm_xys=doc.ed.GetXYEnMasse(bm_ccnts.map(function(a){return a[1]}))
			}
		}
		if(doc&&obj.m_edit_lock){
			obj.__children.push(doc)
			UI.Begin(doc)
				var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
					scroll_x:doc.scroll_x,
					scroll_y:doc.scroll_y})
			UI.End()
			doc.visible_scroll_x=anim.scroll_x
			doc.visible_scroll_y=anim.scroll_y
			//still render it, but without the caret or user interaction
			doc.x=obj.x+w_line_numbers+obj.padding
			doc.y=obj.y
			doc.w=w_obj_area-w_line_numbers-obj.padding-w_scrolling_area
			doc.h=h_obj_area
			doc.ed.Render({x:doc.visible_scroll_x,y:doc.visible_scroll_y,
				w:doc.w/doc.scale,h:doc.h/doc.scale, 
				scr_x:doc.x*UI.pixels_per_unit,scr_y:doc.y*UI.pixels_per_unit, 
				scale:UI.pixels_per_unit, obj:doc});
			//////////////////
			PrepareBookmarks()
			DrawLineNumbers(doc.visible_scroll_x,doc.visible_scroll_y,doc.w,doc.y,doc.h);
		}else{
			if(obj.show_find_bar){
				h_top_find+=obj.h_find_bar
			}
			//individual lines, each with a box and a little shadow for separation
			var h_max_find_items_per_side=(h_obj_area-obj.h_find_bar)*obj.find_item_space_percentage*0.5
			var h_find_item_middle=h_obj_area-obj.h_find_bar-h_max_find_items_per_side*2
			//var find_ranges_back=undefined;
			//var find_ranges_forward=undefined;
			var find_item_scroll_x=undefined
			var w_document=w_obj_area-w_scrolling_area-w_line_numbers
			var DrawFindItemBox=function(y,h){
				UI.RoundRect({color:obj.line_number_bgcolor,x:0,y:y,w:w_line_numbers,h:h})
				UI.RoundRect({color:obj.bgcolor,x:0+w_line_numbers,y:y,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale,h:h})
				UI.RoundRect({x:0,y:y,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale,h:h,
					color:0,border_color:obj.find_item_border_color,border_width:obj.find_item_border_width})
				UI.PushCliprect(0,y+h,(w_obj_area-w_scrolling_area)/obj.find_item_scale,obj.find_item_separation)
					UI.RoundRect({x:0-obj.find_item_shadow_size,y:y+h-obj.find_item_shadow_size,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale+obj.find_item_shadow_size*2,h:obj.find_item_shadow_size*2,
						color:obj.find_item_shadow_color,
						round:obj.find_item_shadow_size,
						border_width:-obj.find_item_shadow_size})
				UI.PopCliprect()
			}
			var DrawFindItemHighlight=function(y,h,highlight_alpha){
				var alpha=Math.max(Math.min(((1-highlight_alpha)*64)|0,255),0)
				UI.RoundRect({color:(obj.find_mode_bgcolor&0xffffff)|(alpha<<24),x:0,y:y,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale,h:h})
			}
			if(obj.show_find_bar&&current_find_context){
				obj.__children.push(doc)
				UI.Begin(doc)
					var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
						scroll_x:doc.scroll_x,
						scroll_y:doc.scroll_y})
				UI.End()
				doc.visible_scroll_x=anim.scroll_x
				doc.visible_scroll_y=anim.scroll_y
			}else{
				W.Edit("doc",{
					///////////////
					language:Language.GetDefinitionByName(obj.m_language_id),
					plugin_language_desc:Language.GetDescObjectByName(obj.m_language_id),
					style:editor_style,
					wrap_width:obj.m_is_preview?w_obj_area-w_line_numbers-obj.padding-w_scrolling_area:obj.m_wrap_width,
					///////////////
					x:obj.x+w_line_numbers+obj.padding,y:obj.y+h_top_hint+h_top_find,w:w_obj_area-w_line_numbers-obj.padding-w_scrolling_area,h:h_obj_area-h_top_hint-h_top_find-h_bottom_find,
					///////////////
					m_is_preview:obj.m_is_preview,
				},W.CodeEditor_prototype);
				//line number bar shadow when x scrolled
				if(doc){
					var x_shadow_size_max=obj.x_scroll_shadow_size
					var x_shadow_size=Math.min(doc.visible_scroll_x/8,x_shadow_size_max)
					if(x_shadow_size>0){
						UI.PushCliprect(obj.x+w_line_numbers,obj.y+h_top_hint,w_obj_area-w_scrolling_area-w_line_numbers,h_obj_area-h_top_hint)
						UI.RoundRect({
							x:obj.x+w_line_numbers-x_shadow_size_max*2+x_shadow_size,
							y:obj.y+h_top_hint-x_shadow_size_max,
							w:2*x_shadow_size_max, 
							h:h_obj_area-h_top_hint+x_shadow_size_max*2,
							round:x_shadow_size_max,
							border_width:-x_shadow_size_max,
							color:obj.x_scroll_shadow_color})
						UI.PopCliprect()
					}
				}
			}
			if(!doc){
				//initiate progressive loading
				//Init
				doc=obj.doc
				obj.OnEditorCreate()
				UI.InvalidateCurrentFrame()
				UI.Refresh()
			}
			if(obj.m_replace_context){
				//replace hint
				var rctx=obj.m_replace_context
				var srep_ccnt0=rctx.m_locators[0].ccnt
				var srep_ccnt1=rctx.m_locators[1].ccnt
				if(srep_ccnt0<srep_ccnt1){
					s_replace=doc.ed.GetText(srep_ccnt0,srep_ccnt1-srep_ccnt0)
				}else{
					s_replace='';
				}
				if(rctx.m_needle==s_replace){
					obj.DismissNotification('find_result')
				}else{
					obj.CreateNotification({
						id:'find_result',icon:'警',text:[rctx.m_needle,'  \u2192',s_replace].join("\n")
					},"quiet")
				}
			}
			PrepareBookmarks()
			//generic drawing function
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			//the find bar and stuff
			if(obj.show_find_bar&&current_find_context){
				//draw the find items
				doc.ed.m_other_overlay=undefined
				UI.PushSubWindow(obj.x,obj.y+obj.h_find_bar,w_obj_area-w_scrolling_area,h_obj_area-obj.h_find_bar,obj.find_item_scale)
				var hc=UI.GetCharacterHeight(doc.font)
				var w_find_items=(w_obj_area-w_scrolling_area)/obj.find_item_scale, h_find_items=(h_obj_area-obj.h_find_bar)/obj.find_item_scale-obj.find_item_expand_current*hc;
				var h_expand_max=hc*obj.find_item_expand_current
				var render_secs=0,ln_secs=0;
				//DrawItem
				obj.RenderVisibleFindItems(w_line_numbers+obj.padding,w_find_items,h_find_items,function(find_item_i,find_scroll_x,find_scroll_y,h_expand){
					var doc_h=find_item_i.shared_h+h_expand
					var doc_scroll_y=Math.max(Math.min(find_item_i.scroll_y-h_expand*0.5,ytot-doc_h),0)
					DrawFindItemBox(find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h)
					var tick0=Duktape.__ui_get_tick()
					doc.ed.Render({x:find_scroll_x,y:doc_scroll_y,w:w_find_items,h:doc_h,
						scr_x:(w_line_numbers+obj.padding)*UI.pixels_per_unit,scr_y:(find_item_i.visual_y-find_scroll_y-h_expand*0.5)*UI.pixels_per_unit, scale:UI.pixels_per_unit, obj:doc});
					var tick1=Duktape.__ui_get_tick()
					DrawLineNumbers(find_scroll_x,doc_scroll_y,
						doc.w,find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h);
					var tick2=Duktape.__ui_get_tick()
					render_secs+=Duktape.__ui_seconds_between_ticks(tick0,tick1)
					ln_secs+=Duktape.__ui_seconds_between_ticks(tick1,tick2)
					DrawFindItemHighlight(find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h,h_expand/h_expand_max)
				})
				//print(render_secs*1000,ln_secs*1000)
				UI.PopSubWindow()
			}else{
				//line numbers
				DrawLineNumbers(doc.visible_scroll_x,doc.visible_scroll_y,doc.w,doc.y,doc.h);
				//auto-completion
				var got_overlay_before=!!doc.ed.m_other_overlay;
				doc.ed.m_other_overlay=undefined
				if(doc.sel0.ccnt==doc.sel1.ccnt&&obj.show_auto_completion&&(doc.m_user_just_typed_char||doc.plugin_language_desc.default_hyphenator_name)){
					var acctx=obj.m_ac_context
					var ac_was_actiavted=0
					if(acctx&&acctx.m_ccnt!=doc.sel1.ccnt){
						ac_was_actiavted=acctx.m_activated
						acctx=undefined;
						UI.InvalidateCurrentFrame()
						UI.Refresh()
					}
					if(!acctx){
						var accands
						var is_spell_mode=0
						if(doc.m_user_just_typed_char){
							accands=UI.ED_QueryAutoCompletion(doc,doc.sel1.ccnt)
						}else{
							//tex mode - it's actually a spelling suggestion
							//var ccnt_word=doc.sel1.ccnt
							//var ccnt_word0=doc.SnapToValidLocation(doc.ed.MoveToBoundary(doc.ed.SnapToCharBoundary(ccnt_word,-1),-1,"word_boundary_left"),-1)
							//var ccnt_word1=doc.SnapToValidLocation(doc.ed.MoveToBoundary(doc.ed.SnapToCharBoundary(ccnt_word,1),1,"word_boundary_right"),1)
							var accands={length:0,at:function(id){return this.suggestions[id]},suggestions:[],s_prefix:""}
							is_spell_mode=1
							//if(ccnt_word0+1<ccnt_word1){
							var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
							//accands.s_prefix=doc.ed.GetText(ccnt_word0,ccnt_word1-ccnt_word0)
							var spell_ctx=renderer.HunspellSuggest(doc.ed,doc.sel1.ccnt)
							if(spell_ctx){
								var suggestions=spell_ctx.suggestions
								accands.s_prefix=spell_ctx.s_prefix
								suggestions.push("Add '@1' to dictionary".replace("@1",accands.s_prefix))
								accands.suggestions=suggestions.map(function(a){return {name:a,weight:1}})
								accands.length=suggestions.length
								accands.ccnt0=spell_ctx.ccnt0
							}
							//}
						}
						acctx={
							m_is_spell_mode:is_spell_mode,
							m_ccnt:doc.sel1.ccnt,
							m_accands:accands,
							m_scroll_i:0,
							m_display_items:[],
							m_n_cands:accands?accands.length:0,
							m_x_current:obj.accands_padding*0.5,
							m_selection:0,
							GetDisplayItem:function(id){
								var ret=this.m_display_items[id]
								if(!ret){
									UI.assert(id==this.m_display_items.length,"panic: not doing acctx sequentially")
									var cc=this.m_accands.at(id);
									//ignore weight for now: cc.weight
									ret={
										x:this.m_x_current,
										w:UI.MeasureText(obj.accands_font,cc.name).w,
										name:cc.name
									}
									this.m_x_current+=ret.w+obj.accands_padding
									this.m_display_items[id]=ret
								}
								return ret
							},
							Activate:function(){
								if(!this.m_n_cands){return;}
								this.m_activated=1;
								UI.Refresh()
							},
							Confirm:function(id){
								var s_prefix=this.m_accands.s_prefix
								if(is_spell_mode&&id==this.m_n_cands-1){
									//coulddo: remove, or just give a "user-dic-editing" option
									var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
									renderer.HunspellAddWord(s_prefix);
									UI.Refresh();
									return;
								}
								var lg=Duktape.__byte_length(s_prefix);
								var ccnt0=doc.sel1.ccnt-lg
								if(is_spell_mode){
									ccnt0=this.m_accands.ccnt0
								}
								var sname=this.m_accands.at(id).name
								if(doc.plugin_language_desc.default_hyphenator_name){
									sname=UI.ED_CopyCase(sname,sname.toLowerCase(),sname.toUpperCase(),s_prefix)
								}
								var lg2=Duktape.__byte_length(sname);
								doc.HookedEdit([ccnt0,lg,sname])
								if(!this.m_accands.m_common_prefix){
									obj.m_ac_context=undefined
									doc.m_user_just_typed_char=0
								}else{
									obj.m_ac_context.m_ccnt=-1;
								}
								doc.sel0.ccnt=ccnt0+lg2
								doc.sel1.ccnt=ccnt0+lg2
								UI.Refresh()
							},
							IDFromX:function(x){
								while(this.m_x_current<x&&this.m_display_items.length<this.m_n_cands){
									this.GetDisplayItem(this.m_display_items.length)
								}
								var dis=this.m_display_items
								var l=0;
								var r=dis.length-1
								while(l<=r){
									var m=(l+r)>>1
									if(dis[m].x<=x){
										l=m+1
									}else{
										r=m-1
									}
								}
								return Math.max(r,0)
							},
						}
						obj.m_ac_context=acctx
						UI.Refresh()
					}
					if(!obj.show_find_bar){
						if(acctx.m_n_cands>0){
							if(ac_was_actiavted){
								acctx.Activate()
							}
							var ac_w_needed=0
							while(acctx.m_display_items.length<acctx.m_scroll_i){
								acctx.GetDisplayItem(acctx.m_display_items.length)
							}
							for(var i=acctx.m_scroll_i;i<acctx.m_n_cands&&i<acctx.m_scroll_i+obj.accands_n_shown;i++){
								ac_w_needed+=acctx.GetDisplayItem(i).w+obj.accands_padding
							}
							var ed_caret=doc.GetCaretXY();
							var x_caret=(ed_caret.x-doc.visible_scroll_x+doc.ed.m_caret_offset);
							var y_caret=(ed_caret.y-doc.visible_scroll_y);
							x_caret-=UI.MeasureText(doc.font,acctx.m_accands.s_prefix).w
							var hc=UI.GetCharacterHeight(doc.font)
							var x_accands=Math.max(Math.min(x_caret,obj.x+w_obj_area-ac_w_needed-doc.x),0)
							var y_accands=y_caret+hc
							if(doc.y+y_accands+obj.accands_h>obj.y+h_obj_area){
								y_accands=y_caret-obj.h_accands
							}
							x_accands+=doc.x
							y_accands+=doc.y
							var ac_anim_node=W.AnimationNode("accands_scrolling",{
								scroll_x:acctx.GetDisplayItem(acctx.m_scroll_i).x,
								current_w:ac_w_needed,
							})
							var ac_scroll_x=ac_anim_node.scroll_x
							var w_accands=ac_anim_node.current_w
							UI.RoundRect({
								x:x_accands, y:y_accands, 
								w:w_accands+obj.accands_shadow_size, h:obj.h_accands+obj.accands_shadow_size,
								round:obj.accands_shadow_size,
								border_width:-obj.accands_shadow_size,
								color:obj.accands_shadow_color})
							UI.RoundRect({
								x:x_accands, y:y_accands,
								w:w_accands, h:obj.h_accands,
								border_width:obj.accands_border_width,
								border_color:obj.accands_border_color,
								round:obj.accands_round,
								color:obj.accands_bgcolor})
							//draw the candidates
							UI.PushCliprect(x_accands, y_accands, w_accands, obj.h_accands)
							var hc_accands=UI.GetCharacterHeight(obj.accands_font)
							var y_accands_text=y_accands+(obj.h_accands-hc_accands)*0.5
							var ac_id0=acctx.IDFromX(ac_scroll_x)
							var ac_id1=acctx.IDFromX(ac_scroll_x+w_accands)
							for(var i=ac_id0;i<=ac_id1;i++){
								var dii=acctx.GetDisplayItem(i)
								var selected=(acctx.m_activated&&i==acctx.m_selection)
								var num_id=(i-acctx.m_scroll_i+11)%10
								var w_hint_char=UI.GetCharacterAdvance(obj.accands_id_font,48+num_id)
								var x_item=x_accands+dii.x-ac_scroll_x+obj.accands_left_padding
								//x, w, name
								if(selected){
									UI.RoundRect({
										x:x_item-w_hint_char-obj.accands_sel_padding,
										y:y_accands_text-obj.accands_sel_padding,
										w:dii.w+obj.accands_sel_padding*2+w_hint_char,h:hc_accands+obj.accands_sel_padding*2,
										color:obj.accands_sel_bgcolor,
									})
								}
								W.Text("",{x:x_item,y:y_accands_text,
									font:obj.accands_font,text:dii.name,
									color:selected?obj.accands_text_sel_color:obj.accands_text_color})
								//if(acctx.m_activated){
								UI.DrawChar(obj.accands_id_font,
									x_item-obj.accands_sel_padding*0.5-w_hint_char,y_accands_text,
									selected?obj.accands_text_sel_color:obj.accands_text_color,48+num_id)
								W.Hotkey("",{key:"ALT+"+String.fromCharCode(48+num_id),action:(function(i){return function(){
									acctx.Confirm(i)
								}})(i)})
								//}
							}
							UI.PopCliprect()
						}else if(acctx.m_n_cands==1){
							//doc.ed.m_other_overlay always shows the 1st candidate?
							//need PPM weight calibration, and float weights
							//can't auto-calibrate - PPM always wins
							//tab should be strictly for common prefix? if we could guess the 1st candidate right...
							var s_name=acctx.m_accands.at(0).name
							doc.ed.m_other_overlay={'type':'AC','text':acctx.m_accands.m_common_prefix}
						}
					}
				}else{
					var acctx=obj.m_ac_context
					if(acctx){
						obj.m_ac_context=undefined
						UI.InvalidateCurrentFrame()
						UI.Refresh()
					}
				}
				if(got_overlay_before&&!doc.ed.m_other_overlay){
					UI.InvalidateCurrentFrame()
					UI.Refresh()
				}
				////////////////
				//the top hint, do it after since its Render screws the spell checks
				if(top_hint_bbs.length){
					var y_top_hint=y_top_hint_scroll;
					for(var bbi=0;bbi<top_hint_bbs.length;bbi+=2){
						var y0=top_hint_bbs[bbi]
						var y1=top_hint_bbs[bbi+1]
						var hh=Math.min(y1-y0,h_top_hint-y_top_hint)
						if(hh>=0){
							doc.ed.Render({x:0,y:y0,w:w_obj_area-w_line_numbers-w_scrolling_area,h:hh,
								scr_x:obj.x+w_line_numbers,scr_y:obj.y+y_top_hint, scale:UI.pixels_per_unit, obj:doc});
							//also draw the line numbers
							DrawLineNumbers(0,y0,1,obj.y+y_top_hint,y1-y0);
						}
						y_top_hint+=y1-y0;
					}
					UI.PushCliprect(obj.x,obj.y+h_top_hint,w_obj_area-w_scrolling_area,h_obj_area-h_top_hint)
					//a (shadowed) separation bar
					UI.RoundRect({
						x:obj.x-obj.top_hint_shadow_size, y:obj.y+h_top_hint-obj.top_hint_shadow_size, w:w_obj_area-w_scrolling_area+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
						round:obj.top_hint_shadow_size,
						border_width:-obj.top_hint_shadow_size,
						color:obj.top_hint_shadow_color})
					UI.RoundRect({
						x:obj.x, y:obj.y+h_top_hint, w:w_obj_area-w_scrolling_area, h:obj.top_hint_border_width,
						color:obj.top_hint_border_color})
					UI.PopCliprect()
				}
			}
			if(obj.show_find_bar){
				//the find bar
				UI.PushCliprect(obj.x,obj.y,w_obj_area-w_scrolling_area,h_obj_area)
				UI.RoundRect({
					x:obj.x-obj.find_bar_shadow_size, y:obj.y+obj.h_find_bar-obj.find_bar_shadow_size, w:w_obj_area-w_scrolling_area+2*obj.find_bar_shadow_size, h:obj.find_bar_shadow_size*2,
					round:obj.find_bar_shadow_size,
					border_width:-obj.find_bar_shadow_size,
					color:obj.find_bar_shadow_color})
				UI.PopCliprect()
				UI.RoundRect({x:obj.x,y:obj.y,w:w_obj_area-w_scrolling_area,h:obj.h_find_bar,
					color:obj.find_bar_bgcolor})
				var rect_bar=UI.RoundRect({
					x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
					w:w_obj_area-w_scrolling_area-obj.find_bar_padding*2-(obj.find_bar_button_size+obj.find_bar_padding)*3,h:obj.h_find_bar-obj.find_bar_padding*2,
					color:obj.find_bar_color,
					round:obj.find_bar_round})
				UI.DrawChar(UI.icon_font_20,obj.x+obj.find_bar_padding*2,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
					obj.find_bar_hint_color,'s'.charCodeAt(0))
				var x_button_right=rect_bar.x+rect_bar.w+obj.find_bar_padding
				W.Button("find_button_case",{style:UI.default_styles.check_button,
					x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
					font:UI.icon_font,text:"写",tooltip:"Case sensitive",
					value:(obj.m_find_flags&UI.SEARCH_FLAG_CASE_SENSITIVE?1:0),
					OnChange:function(value){
						obj.m_find_flags=(obj.m_find_flags&~UI.SEARCH_FLAG_CASE_SENSITIVE)|(value?UI.SEARCH_FLAG_CASE_SENSITIVE:0)
						obj.DestroyReplacingContext();
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.m_find_flags)
					}})
				x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
				W.Button("find_button_word",{style:UI.default_styles.check_button,
					x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
					font:UI.icon_font,text:"字",tooltip:"Whole word",
					value:(obj.m_find_flags&UI.SEARCH_FLAG_WHOLE_WORD?1:0),
					OnChange:function(value){
						obj.m_find_flags=(obj.m_find_flags&~UI.SEARCH_FLAG_WHOLE_WORD)|(value?UI.SEARCH_FLAG_WHOLE_WORD:0)
						obj.DestroyReplacingContext();
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.m_find_flags)
					}})
				x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
				W.Button("find_button_regexp",{style:UI.default_styles.check_button,
					x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
					font:UI.icon_font,text:"正",tooltip:"Regular expression",
					value:(obj.m_find_flags&UI.SEARCH_FLAG_REGEXP?1:0),
					OnChange:function(value){
						obj.m_find_flags=(obj.m_find_flags&~UI.SEARCH_FLAG_REGEXP)|(value?UI.SEARCH_FLAG_REGEXP:0)
						obj.DestroyReplacingContext();
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.m_find_flags)
					}})
				var x_find_edit=obj.x+obj.find_bar_padding*3+UI.GetCharacterAdvance(UI.icon_font_20,'s'.charCodeAt(0));
				var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
				var previous_edit=obj.find_bar_edit
				W.Edit("find_bar_edit",{
					language:doc.language,
					plugin_language_desc:doc.plugin_language_desc,
					style:obj.find_bar_editor_style,
					x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
					owner:obj,
					plugins:[ffindbar_plugin],
					CancelFind:function(){
						var obj=this.owner
						obj.show_find_bar=0;
						obj.doc.sel0.ccnt=obj.m_sel0_before_find
						obj.doc.sel1.ccnt=obj.m_sel1_before_find
						obj.doc.AutoScroll('center')
						obj.doc.scrolling_animation=undefined
						UI.Refresh()
					},
					OnBlur:function(nd_new){
						if(nd_new==doc){
							this.CancelFind();
						}
					},
				},W.CodeEditor_prototype);
				if(!previous_edit){
					if(obj.m_current_needle){
						obj.find_bar_edit.ed.Edit([0,0,obj.m_current_needle],1)
						obj.find_bar_edit.sel0.ccnt=0
						obj.find_bar_edit.sel1.ccnt=obj.find_bar_edit.ed.GetTextSize()
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),obj.m_find_flags)
					}
					UI.SetFocus(obj.find_bar_edit);
					UI.InvalidateCurrentFrame();
					UI.Refresh()
				}else if(UI.nd_focus==doc){
					UI.SetFocus(obj.find_bar_edit);
					UI.InvalidateCurrentFrame();
					UI.Refresh()
				}
				if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
					W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
						font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
						text:"Search"})
				}
			}
			//UI.RoundRect({
			//	x:obj.x+w_line_numbers-1, y:obj.y, w:1, h:h_obj_area,
			//	color:obj.separator_color})
			if(UI.HasFocus(doc)){
				var menu_edit=UI.BigMenu("&Edit")
				menu_edit.AddNormalItem({text:"&Undo",enable_hotkey:0,key:"CTRL+Z",action:function(){
					doc.Undo()
				}})
				menu_edit.AddNormalItem({text:"&Redo",enable_hotkey:0,key:"CTRL+SHIFT+Z",action:function(){
					doc.Redo()
				}})
				///////////////////////
				menu_edit.AddSeparator()
				menu_edit.AddNormalItem({text:"Select &all",enable_hotkey:0,key:"CTRL+A",action:function(){
					doc.sel0.ccnt=0
					doc.sel1.ccnt=doc.ed.GetTextSize()
					doc.CallOnSelectionChange()
					UI.Refresh()
				}})
				if(doc.sel0.ccnt<doc.sel1.ccnt){
					menu_edit.AddNormalItem({text:"&Copy",icon:"拷",enable_hotkey:0,key:"CTRL+C",action:function(){
						doc.Copy()
					}})
				}
				menu_edit.AddNormalItem({text:"Cu&t",icon:"剪",enable_hotkey:0,key:"CTRL+X",action:function(){
					doc.Cut()
				}})
				menu_edit.AddNormalItem({text:"&Paste",icon:"粘",enable_hotkey:0,key:"CTRL+V",action:function(){
					doc.Paste()
				}})
				///////////////////////
				var acctx=obj.m_ac_context
				if(acctx&&acctx.m_n_cands){
					menu_edit.AddSeparator()
					if(acctx.m_n_cands==1){
						menu_edit.AddNormalItem({text:"Auto-complete",enable_hotkey:1,key:"TAB",action:function(){
							acctx.Confirm(0)
						}})
					}else if(!acctx.m_activated){
						menu_edit.AddNormalItem({text:"Auto-complete",enable_hotkey:1,key:"TAB",action:function(){
							acctx.Activate()
						}})
					}else{
						//the keys: left/right ,. -= 1234567890, enter / space / tab
						var fprevpage=function(){
							acctx.m_scroll_i=Math.max(acctx.m_scroll_i-(obj.accands_n_shown),0)
							acctx.m_selection=acctx.m_scroll_i
							UI.Refresh()
						}
						var fnextpage=function(){
							acctx.m_scroll_i=Math.min(acctx.m_scroll_i+(obj.accands_n_shown),acctx.m_n_cands-1)
							acctx.m_selection=acctx.m_scroll_i
							UI.Refresh()
						}
						var fprevcand=function(){
							if(acctx.m_selection>0){
								acctx.m_selection--
								if(acctx.m_selection<acctx.m_scroll_i){
									acctx.m_scroll_i=Math.max(acctx.m_scroll_i-(obj.accands_n_shown),0)
								}
								UI.Refresh();
							}
						}
						var fnextcand=function(){
							if(acctx.m_selection<acctx.m_n_cands-1){
								acctx.m_selection++
								if(acctx.m_scroll_i+obj.accands_n_shown<=acctx.m_selection){
									acctx.m_scroll_i=Math.min(acctx.m_scroll_i+(obj.accands_n_shown),acctx.m_n_cands-1)
								}
								UI.Refresh();
							}
						}
						var fconfirm=function(){
							acctx.Confirm(acctx.m_selection)
						}
						menu_edit.AddButtonRow({text:"Auto-complete"},[
							{text:"<",tooltip:'- or ,',action:fprevpage},
							{key:"RETURN RETURN2",text:"confirm",tooltip:'ENTER or SPACE',action:fconfirm},
							{text:">",tooltip:'= or .',action:fnextpage}])
						W.Hotkey("",{text:",",action:fprevpage})
						W.Hotkey("",{text:".",action:fnextpage})
						W.Hotkey("",{text:"-",action:fprevpage})
						W.Hotkey("",{text:"=",action:fnextpage})
						W.Hotkey("",{key:"LEFT",action:fprevcand})
						W.Hotkey("",{key:"RIGHT",action:fnextcand})
						W.Hotkey("",{text:" ",action:fconfirm})
						W.Hotkey("",{key:"TAB",action:fconfirm})
					}
				}
				///////////////////////
				var menu_search=UI.BigMenu("&Search")
				menu_search.AddNormalItem({text:"&Find or replace",icon:"s",enable_hotkey:1,key:"CTRL+F",action:function(){
					var sel=obj.doc.GetSelection()
					obj.show_find_bar=1
					obj.m_sel0_before_find=obj.doc.sel0.ccnt
					obj.m_sel1_before_find=obj.doc.sel1.ccnt
					if(sel[0]<sel[1]){
						obj.m_current_needle=obj.doc.ed.GetText(sel[0],sel[1]-sel[0])
						if(obj.m_find_flags&UI.SEARCH_FLAG_REGEXP){
							obj.m_current_needle=RegexpEscape(obj.m_current_needle)
						}
					}
					UI.Refresh()
				}})
				menu_search.AddButtonRow({text:"Find "},[
					{key:"SHIFT+CTRL+G SHIFT+F3",text:"&previous",tooltip:'SHIFT+CTRL+G',action:function(){
						obj.FindNext(-1)
					}},{key:"CTRL+G F3",text:"&next",tooltip:'CTRL+G',action:function(){
						obj.FindNext(1)
					}}])
				menu_search.AddButtonRow({text:"Find the current word"},[
					{key:"SHIFT+CTRL+F3",text:"above",tooltip:'SHIFT+CTRL+F3',action:function(){
						obj.BeforeQuickFind(-1);
						obj.FindNext(-1)
					}},{key:"CTRL+F3",text:"below",tooltip:'CTRL+F3',action:function(){
						obj.BeforeQuickFind(1);
						obj.FindNext(1)
					}}])
				if(obj.m_replace_context){
					menu_search.AddSeparator()
					menu_search.AddButtonRow({text:"Replace"},[
						{key:"CTRL+D",text:"next",tooltip:'CTRL+D',action:function(){
							obj.DoReplaceFromUI(1)
						}},{key:"ALT+A",text:"all",tooltip:'ALT+A',action:function(){
							obj.DoReplaceFromUI(0)
						}}])
				}
				doc.CallHooks('menu')
			}
		}
		//minimap / scroll bar
		if(doc&&w_scrolling_area>0){
			var y_scrolling_area=obj.y
			var effective_scroll_y=doc.visible_scroll_y-h_top_hint
			var sbar_value=Math.max(Math.min(effective_scroll_y/(ytot-h_scrolling_area),1),0)
			if(obj.show_minimap){
				var x_minimap=obj.x+w_obj_area-w_scrolling_area+obj.padding*0.5
				var minimap_scale=obj.minimap_font_height/UI.GetFontHeight(editor_style.font)
				var h_minimap=h_scrolling_area/minimap_scale
				var scroll_y_minimap=sbar_value*Math.max(ytot-h_minimap,0)
				UI.PushSubWindow(x_minimap,y_scrolling_area,obj.w_minimap,h_scrolling_area,minimap_scale)
					var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
					renderer.m_temporarily_disable_spell_check=1
					doc.ed.Render({x:0,y:scroll_y_minimap,w:obj.w_minimap/minimap_scale,h:h_minimap,
						scr_x:0,scr_y:0, scale:UI.pixels_per_unit, obj:doc});
					renderer.m_temporarily_disable_spell_check=0
				UI.PopSubWindow()
				var minimap_page_y0=(effective_scroll_y-scroll_y_minimap)*minimap_scale
				var minimap_page_y1=(effective_scroll_y+h_scrolling_area-scroll_y_minimap)*minimap_scale
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
					color:obj.minimap_page_shadow})
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:obj.minimap_page_border_width,
					color:obj.minimap_page_border_color})
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y1-obj.minimap_page_border_width, w:obj.w_minimap+obj.padding, h:obj.minimap_page_border_width,
					color:obj.minimap_page_border_color})
				if((minimap_page_y1-minimap_page_y0)<h_minimap){
					W.Region('minimap_page',{
						x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
						value:sbar_value,
						factor:h_scrolling_area-(minimap_page_y1-minimap_page_y0),
						OnChange:function(value){
							doc.scroll_y=value*(ytot-h_scrolling_area)
							doc.scrolling_animation=undefined
							UI.Refresh()
						},
					},W.MinimapThingy_prototype)
				}
			}
			//scrollbar background
			var sbar=UI.RoundRect({x:obj.x+w_obj_area-obj.w_scroll_bar-4, y:y_scrolling_area, w:obj.w_scroll_bar+4, h:h_scrolling_area,
				color:obj.line_number_bgcolor
			})
			//at-scrollbar bookmark marker
			var hc_bookmark=UI.GetCharacterHeight(obj.bookmark_font)
			if(bm_ccnts.length){
				for(var i=0;i<bm_ccnts.length;i++){
					var y=Math.max(Math.min(bm_xys[i*2+1]/(ytot-h_scrolling_area),1),0)*sbar.h+sbar.y
					var id=bm_ccnts[i][0]
					UI.RoundRect({
						x:sbar.x, w:sbar.w,
						y:y-obj.bookmark_scroll_bar_marker_size*0.5,h:obj.bookmark_scroll_bar_marker_size,
						color:obj.bookmark_text_color})
					if(id>=0){
						UI.DrawChar(obj.bookmark_font,sbar.x+2,
							y-sbar.y>hc_bookmark?y-obj.bookmark_scroll_bar_marker_size*0.5-hc_bookmark:y+obj.bookmark_scroll_bar_marker_size*0.5,
							obj.bookmark_text_color,48+id)
					}
				}
			}
			//the actual bar
			W.ScrollBar("sbar",{x:obj.x+w_obj_area-obj.w_scroll_bar-4, y:y_scrolling_area+4, w:obj.w_scroll_bar, h:h_scrolling_area-8, dimension:'y',
				page_size:h_scrolling_area, total_size:ytot, value:sbar_value,
				OnChange:function(value){
					doc.scroll_y=value*(this.total_size-this.page_size)
					doc.scrolling_animation=undefined
					UI.Refresh()
				},
				style:obj.scroll_bar_style
			})
			//separators
			UI.RoundRect({
				x:obj.x+w_obj_area-w_scrolling_area, y:y_scrolling_area, w:1, h:h_scrolling_area,
				color:obj.separator_color})
		}
		if(obj.m_notifications&&!obj.show_find_bar){
			W.ListView('notification_list',{x:obj.x+w_obj_area-w_scrolling_area-obj.w_notification-8,y:obj.y,w:obj.w_notification,h:h_obj_area-8,
				dimension:'y',layout_spacing:8,layout_align:'left',is_single_click_mode:1,no_region:1,no_clipping:1,
				item_template:{
					object_type:W.NotificationItem,
				},items:obj.m_notifications})
		}
		///////////////////////////////////////
		if(sxs_visualizer){
			//it could just get parent as owner
			//separation shadow
			var w_shadow=obj.sxs_shadow_size
			if(sxs_area_dim=='x'){
				UI.RoundRect({
					x:x_sxs_area-w_shadow,y:y_sxs_area-w_shadow,w:w_shadow*2,h:h_sxs_area+w_shadow*2,
					color:obj.sxs_shadow_color,border_width:-w_shadow,round:w_shadow,
				})
			}else{
				UI.RoundRect({
					x:x_sxs_area-w_shadow,y:y_sxs_area-w_shadow,w:w_sxs_area+w_shadow*2,h:w_shadow*2,
					color:obj.sxs_shadow_color,border_width:-w_shadow,round:w_shadow,
				})
			}
			sxs_visualizer('sxs_visualizer',{x:x_sxs_area,y:y_sxs_area,w:w_sxs_area,h:h_sxs_area,owner:obj})
		}
	UI.End()
	return obj
}

UI.NewCodeEditorTab=function(fname0){
	var file_name=fname0||IO.GetNewDocumentName("new","txt","document")
	return UI.NewTab({
		file_name:file_name,
		title:UI.RemovePath(file_name),
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.doc;
			if(this.doc){this.file_name=this.doc.file_name}
			var body=W.CodeEditor("body",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
			})
			if(!this.doc){
				this.doc=body;
				body.m_is_brand_new=!fname0
			}
			var doc=body.doc;
			if(body.m_is_brand_new){
				body.title="New Tab"
			}else{
				body.title=UI.RemovePath(body.file_name)
			}
			this.need_save=0
			if(doc&&(doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
				body.title=body.title+'*'
				this.need_save=1
			}
			if(this.auto_focus_file_search&&body.sxs_visualizer&&body.sxs_visualizer.find_bar_edit){
				this.auto_focus_file_search=0
				UI.SetFocus(body.sxs_visualizer.find_bar_edit)
				body.sxs_visualizer.find_bar_edit.m_close_on_esc=1
				UI.Refresh()
			}
			return body;
		},
		Save:function(){
			this.doc.Save();
			var doc=this.doc.doc;
			this.need_save=0
			if((doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
				this.need_save=1
			}
		},
		SaveMetaData:function(){
			if(this.doc){this.doc.SaveMetaData();}
		},
		property_windows:[],
		color_theme:[0xffb4771f],
	})
};

UI.RegisterLoaderForExtension("*",function(fname){return UI.NewCodeEditorTab(fname)})
