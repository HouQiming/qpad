var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");
require("res/lib/global_doc");
require("res/lib/code_editor");

W.HelpPage_prototype={
	InvalidateContent:function(){
		this.m_file_name=undefined
		this.text=undefined;
		this.help_ctx=undefined;
		this.found_items=undefined;
		this.help_list=undefined;
		UI.Refresh();
	},
	OpenFile:function(fn){
		this.m_file_name=fn;
		if(fn.length&&fn[0]=='*'){
			this.text=IO.UIReadAll(fn.substr(1));
		}else{
			this.text=IO.ReadAll(fn);
		}
		UI.Refresh();
	},
	SetSelection:function(id){
		this.cur_op=id;
		var op_active=this.help_ctx.m_ops[id];
		this.scroll_y=Math.min(Math.max(this.scroll_y,op_active.y1-this.h_main_area),op_active.y0);
		this.ValidateScroll()
		UI.Refresh();
	},
	RunOp:function(id){
		var op_active=this.help_ctx.m_ops[id];
		return op_active.action.call(this,op_active);
	},
	ValidateScroll:function(){
		var ytot=this.help_ctx.prt.m_h_text+this.padding;
		var h_main_area=this.h_main_area;
		this.scroll_y=Math.max(Math.min(this.scroll_y,ytot-h_main_area),0);
	},
	OnMouseWheel:function(event){
		if(!this.help_ctx){return;}
		var hc=UI.GetCharacterHeight(this.styles[0].font);
		var scroll_y0=this.scroll_y;
		var h_scrolling_area=this.h_main_area;
		this.scroll_y+=-hc*this.mouse_wheel_speed*event.y;
		this.ValidateScroll();
		if(this.scroll_y!=scroll_y0){
			UI.Refresh();
		}
	},
	ShowError:function(s){
		print(s)
		//todo: dialog box
	},
};

var fhelppage_findbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		var obj=this.owner
		var tab_frontmost=UI.GetFrontMostEditorTab();
		if(tab_frontmost){
			UI.top.app.document_area.SetTab(tab_frontmost.__global_tab_id)
		}
		UI.top.app.document_area.CloseTab(obj.owner_tab.__global_tab_id)
		UI.Refresh()
	})
	this.OnMouseWheel=function(event){
		var obj=this.owner
		obj.OnMouseWheel(event)
	}
	this.AddEventHandler('change',function(){
		//close the current file
		var obj=this.owner
		obj.InvalidateContent()
		UI.Refresh()
	})
	var fpassthrough=function(key,event){
		var obj=this.owner
		if(obj.help_list){
			obj.help_list.OnKeyDown(event)
		}
	}
	this.AddEventHandler('RETURN RETURN2',function(key,event){
		var obj=this.owner
		if(obj.text){
			obj.InvalidateContent();
			UI.Refresh()
		}else if(obj.help_list){
			obj.help_list.OnKeyDown(event)
		}
	})
	this.AddEventHandler('UP',fpassthrough)
	this.AddEventHandler('DOWN',fpassthrough)
	this.AddEventHandler('PGUP',fpassthrough)
	this.AddEventHandler('PGDN',fpassthrough)
}

var g_help_hooks=[];
UI.RegisterHelpHook=function(f){
	g_help_hooks.push(f);
};

W.HelpPage=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"help_page",W.HelpPage_prototype);
	UI.Begin(obj)
	UI.RoundRect(obj)
	W.PureRegion(id,obj)
	//top bar for searching - repo.m_helps
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
			if(this.current_repo){
				UI.ReindexHelp(this.current_repo);
			}
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
		plugins:[fhelppage_findbar_plugin],
		default_focus:2,
		tab_width:UI.GetOption("tab_width",4),
	});
	if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
		W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
			font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
			text:UI._("Search")})
	}
	var spath_repo="<none>";
	if(obj.editor_widget){
		spath_repo=UI.GetEditorProject(obj.editor_widget.file_name);
	}
	if(spath_repo!=obj.current_repo){
		//repo changed, invalidate all
		obj.InvalidateContent();
		obj.current_repo=spath_repo;
	}
	if(!obj.text){
		var repo=UI.GetRepoByPath(spath_repo);
		if(!obj.found_items){
			var s_search_text=obj.find_bar_edit.ed.GetText();
			var items=[];
			obj.found_items=items;
			var s_searches=s_search_text.toLowerCase().split(' ');
			var fsearchHelpIndex=function(idx){
				if(!idx){return;}
				for(var i=0;i<idx.length;i++){
					var help_item_i=idx[i];
					var s_i=help_item_i.title_search;
					var is_bad=0;
					var hl_ranges=[];
					for(var j=0;j<s_searches.length;j++){
						var p=s_i.indexOf(s_searches[j]);
						if(p<0){
							is_bad=1;
							break
						}
						hl_ranges.push(p,p+s_searches[j].length);
					}
					if(!is_bad){
						items.push({
							icon:"问",
							title:help_item_i.title,
							file_name:help_item_i.file_name,
							hl_ranges:hl_ranges,
						})
					}
				}
			};
			fsearchHelpIndex(repo&&repo.m_helps);
			fsearchHelpIndex([{title:"Using the Help System",title_search:"using the help system",file_name:"*res/misc/metahelp.md"}]);
			//we should always have something with the search engine hooks
			for(var i=0;i<g_help_hooks.length;i++){
				g_help_hooks[i](items,s_search_text);
			}
		}
		//just show a list of candidates, with keyboard browsing -- listview
		UI.PushCliprect(obj.x,obj.y+obj.h_find_bar,obj.w,obj.h-obj.h_find_bar)
		W.ListView('help_list',{
			x:obj.x,y:obj.y+obj.h_find_bar,w:obj.w,h:obj.h-obj.h_find_bar,
			dimension:'y',layout_spacing:8,layout_align:'fill',
			no_clipping:1,
			items:obj.found_items,
			item_template:{
				object_type:W.HelpItem,
				owner:obj,
			}})
		UI.RoundRect({
			x:obj.x-obj.top_hint_shadow_size, y:obj.y+obj.h_find_bar-obj.top_hint_shadow_size, 
			w:obj.w+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
			round:obj.top_hint_shadow_size,
			border_width:-obj.top_hint_shadow_size,
			color:obj.top_hint_shadow_color})
		UI.PopCliprect()
		if(!repo||!repo.m_helps_parsed){
			//set up for a re-find
			obj.found_items=undefined;
		}
	}
	if(obj.text){
		//||!obj.found_items.length
		//if(!obj.found_items.length&&!obj.text){
		//	obj.text=IO.UIReadAll("res/misc/metahelp.md");
		//}
		var w_main_area=obj.w-obj.padding*2-obj.w_scroll_bar;
		var h_main_area=obj.h-obj.h_find_bar
		obj.h_main_area=h_main_area;
		if(!obj.help_ctx||obj.help_ctx.w_precomputed_for!=w_main_area){
			var fn_base=obj.m_file_name;
			var spath_peer=undefined;
			var spath_repo=undefined;
			if(fn_base){
				spath_peer=UI.GetPathFromFilename(fn_base);
				spath_repo=UI.GetEditorProject(fn_base,"polite");
			}
			var fsearchImage=function(fn){
				console.log(spath_peer,spath_repo,fn)//todo
				if(spath_peer&&IO.FileExists(spath_peer+'/'+fn)){
					return IO.NormalizeFileName(spath_peer+'/'+fn);
				}
				if(spath_repo&&IO.FileExists(spath_repo+'/'+fn)){
					return IO.NormalizeFileName(spath_repo+'/'+fn);
				}
				return fn;
			}
			obj.help_ctx=UI.ED_ProcessHelp(obj.text,obj.styles,fsearchImage,w_main_area);
			obj.help_ctx.prt=UI.ED_FormatRichText(
				Language.GetHyphenator(UI.m_ui_language),
				obj.help_ctx.m_text,4,w_main_area,obj.styles,obj.help_ctx.m_objs);
			UI.ED_CreateOpHighlights(obj.help_ctx.m_ops,obj.help_ctx.prt,obj.help_ctx.m_text);
			obj.help_ctx.w_precomputed_for=w_main_area
		}
		var ytot=obj.help_ctx.prt.m_h_text+obj.padding;
		var scroll_y=(obj.scroll_y||0);obj.scroll_y=scroll_y;
		var anim=W.AnimationNode("scrolling_animation",{
			transition_dt:obj.scroll_transition_dt,
			scroll_y:scroll_y})
		//the scroll bar
		if(h_main_area<ytot){
			var sbar_value=Math.max(Math.min(scroll_y/(ytot-h_main_area),1),0);
			W.ScrollBar("sbar",{
				x:obj.x+obj.w-obj.w_scroll_bar, y:obj.y+obj.h_find_bar, w:obj.w_scroll_bar, h:obj.h-obj.h_find_bar, dimension:'y',
				page_size:h_main_area, total_size:ytot, value:sbar_value,
				OnMouseWheel:obj.OnMouseWheel.bind(obj),
				OnChange:function(value){
					obj.scrolling_animation=undefined;
					obj.scroll_y=value*(this.total_size-this.page_size)
					UI.Refresh()
				},
			})
		}
		UI.PushCliprect(obj.x,obj.y+obj.h_find_bar,obj.w,obj.h-obj.h_find_bar)
		//the ops
		var cur_op=(obj.cur_op||0);
		for(var i=0;i<obj.help_ctx.m_ops.length;i++){
			//highlight it
			var op_i=obj.help_ctx.m_ops[i];
			//print(op_i.y0,op_i.y1)
			UI.RoundRect({
				x:obj.x+obj.padding,
				y:obj.y+obj.h_find_bar-obj.scroll_y+op_i.y0,
				w:w_main_area,
				h:op_i.y1-op_i.y0,
				color:i==cur_op?obj.ophl.focus_color:obj.ophl.color,
				round:obj.ophl.blur,
				border_width:-obj.ophl.blur,
			})
			W.Region("rgn_op_"+i.toString(),{
				x:obj.x+obj.padding,
				y:obj.y+obj.h_find_bar-obj.scroll_y+op_i.y0,
				w:w_main_area,
				h:op_i.y1-op_i.y0,
				id:i,
				OnClick:function(event){
					obj.SetSelection(this.id)
					if(event.clicks>=2){
						obj.RunOp(this.id)
					}
				},
			})
		}
		//we don't have to activate the tab...
		if(cur_op<obj.help_ctx.m_ops.length){
			W.Hotkey("",{key:"CTRL+E",action:(function(){
				var cur_op=(this.cur_op||0);
				if(this.RunOp(cur_op)){
					cur_op++;
					if(!(cur_op<this.help_ctx.m_ops.length)){
						cur_op=0;
					}
					this.SetSelection(cur_op);
				}
				UI.Refresh();
			}).bind(obj)})
		}
		//coulddo: pre-format the code to a predefined style - after beautifier
		//the main part
		UI.ED_RenderRichText(obj.help_ctx.prt,obj.help_ctx.m_text,obj.x+obj.padding,obj.y+obj.h_find_bar-obj.scroll_y,obj.help_ctx.m_objs)
		//if(obj.scroll_y>0){
		UI.RoundRect({
			x:obj.x-obj.top_hint_shadow_size, y:obj.y+obj.h_find_bar-obj.top_hint_shadow_size, 
			w:obj.w+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
			round:obj.top_hint_shadow_size,
			border_width:-obj.top_hint_shadow_size,
			color:obj.top_hint_shadow_color})
		//}
		UI.PopCliprect()
	}
	UI.End()
	return obj
};

W.HelpItem_prototype={
	OnDblClick:function(){
		if(this.url){
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				IO.Shell(["start"," ",this.url])
			}else if(UI.Platform.ARCH=="mac"){
				IO.Shell(["open",this.url])
			}else if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"){
				IO.Shell(["xdg-open",this.url])
			}else if(UI.Platform.ARCH=="web"){
				UI.EmscriptenEval("window.open("+JSON.stringify(this.url)+",'_blank');");
			}else{
				//coulddo: support mobile
			}
			var tab_frontmost=UI.GetFrontMostEditorTab();
			if(tab_frontmost){
				UI.top.app.document_area.SetTab(tab_frontmost.__global_tab_id)
			}
			UI.top.app.document_area.CloseTab(this.owner.owner_tab.__global_tab_id)
		}else if(this.file_name){
			this.owner.OpenFile(this.file_name);
		}
	},
};
W.HelpItem=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"help_item",W.HelpItem_prototype);
	UI.Begin(obj)
		if(obj.selected){
			var sel_bgcolor=obj.owner.activated?obj.sel_bgcolor:obj.sel_bgcolor_deactivated;
			UI.RoundRect({
				x:obj.x,y:obj.y+2,w:obj.w-12,h:obj.h-4,
				color:sel_bgcolor})
		}
		var name_font=obj.name_font;
		var name_font_bold=obj.name_font_bold;
		var h_icon=UI.GetCharacterHeight(obj.icon_font);
		var w_icon=h_icon+4
		UI.DrawChar(obj.icon_font,obj.x+2,obj.y+(obj.h-h_icon)*0.5,obj.selected?obj.sel_name_color:obj.name_color,obj.icon.charCodeAt(0))
		W.Text("",{x:obj.x+2+w_icon,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
			font:name_font,text:obj.title,
			color:obj.selected?obj.sel_name_color:obj.name_color})
		if(obj.hl_ranges){
			for(var i=0;i<obj.hl_ranges.length;i+=2){
				var p0=obj.hl_ranges[i+0];
				var p1=obj.hl_ranges[i+1];
				if(p0<p1){
					var x=obj.x+2+w_icon+UI.MeasureText(name_font,obj.title.substr(0,p0)).w
					W.Text("",{x:x,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
						font:name_font_bold,text:obj.title.substr(p0,p1-p0),
						color:obj.selected?obj.sel_name_color:obj.name_color})
				}
			}
		}
	UI.End()
	return obj
}

UI.RenderEmbededCodeBox=function(x,y,desc){
	var obj=UI.context_parent;
	if(!desc.doc){
		var doc=UI.CreateEmptyCodeEditor(Language.GetNameByExt(desc.m_language.toLowerCase()));
		var code_style=UI.default_styles.help_page.styles[3];
		//doc.plugins=this.m_cell_plugins;
		doc.wrap_width=0;
		doc.m_enable_wrapping=0;
		doc.m_current_wrap_width=512;
		doc.font=code_style.font;
		doc.font_emboldened=code_style.font_emboldened;
		doc.tex_font=code_style.font;
		doc.tex_font_emboldened=code_style.font_emboldened;
		doc.Init();
		doc.scroll_x=0;doc.scroll_y=0;
		if(desc.m_code){doc.ed.Edit([0,0,desc.m_code],1);}
		doc.saved_point=doc.ed.GetUndoQueueLength();
		desc.doc=doc;
	}
	var obj_widget=W.CodeEditor("embeded_code_"+desc.m_id.toString(),{
		doc:desc.doc,
		disable_minimap:1,
		x:x,y:y,w:desc.m_width,h:desc.m_height,
	})
};

UI.GetCurrentProjectPath=function(){
	var tab_frontmost=UI.GetFrontMostEditorTab();
	var obj=(tab_frontmost&&tab_frontmost.main_widget);
	return obj&&UI.GetEditorProject(obj.file_name);
};

var g_help_commands=[];
var g_help_commands_match_poses=[1];
var g_help_command_regex=undefined;
UI.RegisterHelpCommand=function(strigger,f_action,need_code){
	var count=(strigger.match(/[(]/g)||[]).length+1;
	g_help_command_regex=undefined;
	g_help_commands.push(strigger,f_action,need_code);
	g_help_commands_match_poses.push(g_help_commands_match_poses[g_help_commands_match_poses.length-1]+count);
};

UI.PrecomputeHelpCommands=function(){
	if(!g_help_command_regex){
		var sregex=['^('];
		for(var i=0;i<g_help_commands.length;i+=3){
			if(i){sregex.push(')|(');}
			sregex.push(g_help_commands[i])
		}
		sregex.push(')');
		g_help_command_regex=new RegExp(sregex.join(''));
	}
};

UI.ParseHelpCommand=function(sline){
	var match=sline.match(g_help_command_regex);
	if(match){
		for(var i=0;i<g_help_commands_match_poses.length-1;i++){
			var pos_i=g_help_commands_match_poses[i];
			if(match[pos_i]){
				var ret={
					match:pos_i+1<g_help_commands_match_poses[i+1]?match.slice(pos_i+1,g_help_commands_match_poses[i+1]):undefined,
					action:g_help_commands[i*3+1],
					need_code:g_help_commands[i*3+2],
				}
				return ret;
			}
		}
	}
	return undefined;
}

var fhelp_run=function(op_active){
	var doc=op_active.obj_code.doc;
	if(!doc){return 0;}
	var machine=(op_active.match?op_active.match[0]:'localhost');
	if(machine=="editor"){
		var s_code=doc.ed.GetText();
		try{
			eval("(function(){"+s_code+"})()");
		}catch(e){
			this.ShowError(e.stack)
			return 0;
		}
		return 1;
	}
	//if(machine=="notebook"){
	//}
	var lname=Language.GetNameByExt(op_active.obj_code.m_language.toLowerCase());
	var ldesc=Language.GetDescObjectByName(lname);
	if(!ldesc.m_buildenv_by_name){return;}
	var obj_buildenv=ldesc.m_buildenv_by_name[UI.GetDefaultBuildEnv(lname)];
	if(!obj_buildenv||!obj_buildenv.CreateInterpreterCall){return;}
	var sext=(ldesc&&ldesc.extensions&&ldesc.extensions[0]||op_active.obj_code.m_language);
	//coulddo: machine
	var fn_script=IO.GetNewDocumentName("qnb",sext,"temp")
	var s_code=doc.ed.GetText();
	IO.CreateFile(fn_script,s_code)
	var args=obj_buildenv.CreateInterpreterCall(fn_script,undefined);
	if(typeof(args)=='string'){return;}
	var spath=UI.GetCurrentProjectPath();
	if(!spath){spath=UI.GetPathFromFilename(this.m_file_name);}
	if(!IO.RunProcess(args,spath,1)){
		this.ShowError(UI._('the code failed to run'));
		IO.DeleteFile(fn_script);
		return 0;
	}
	return 1;
}

UI.RegisterHelpCommand('Run:',fhelp_run,1);

UI.RegisterHelpCommand('Run in ([^:]+):',fhelp_run,1);

UI.RegisterHelpCommand('Insert code',function(op_active){
	var doc=op_active.obj_code.doc;
	if(!doc){return 0;}
	//copy-paste, it's useful to leave the stuff in clipboard
	doc.SetSelection(0,doc.ed.GetTextSize())
	doc.Copy()
	if(this.editor_widget){
		this.editor_widget.doc.SmartPaste();
		return 1;
	}else{
		this.ShowError(UI._("code copied to clipboard"));
		return 0;
	}
},1);

UI.RegisterHelpCommand('Make sure ',function(){return 1;},0);

var g_regexp_abspath=new RegExp("^(([a-zA-Z]:/)|(/)|[~])");
UI.RegisterHelpCommand('Open `([^`]+)`',function(op_active){
	var file_name=op_active.match[0];
	if(file_name.search(g_regexp_abspath)<0){
		var spath=UI.GetCurrentProjectPath();
		file_name=spath+'/'+file_name;
	}
	if(IO.FileExists(file_name)){
		UI.OpenEditorWindow(file_name);
		return 1;
	}else{
		this.ShowError(UI._("the file doesn't exist"));
		return 0;
	}
},0);

UI.RegisterHelpCommand('Find (regex) `([^`]+)`',function(op_active){
	var isregex=op_active.match[0];
	var sneedle=op_active.match[1];
	if(!this.editor_widget||!this.editor_widget.doc){
		this.ShowError(UI._("you need a window open for find to work"));
		return 0;
	}
	var doc=this.editor_widget.doc;
	this.editor_widget.FindNext(1,sneedle,isregex?UI.SEARCH_FLAG_REGEXP:0);
	return 1;
},0);

UI.RegisterUtilType("help_page",function(){return UI.NewTab({
	title:UI._("Help"),
	area_name:"h_tools",
	body:function(){
		//frontmost doc
		UI.context_parent.body=this.util_widget;
		var tab_frontmost=UI.GetFrontMostEditorTab();
		var body=W.HelpPage('body',{
			'anchor':'parent','anchor_align':'fill','anchor_valign':'fill',
			'editor_widget':tab_frontmost&&tab_frontmost.main_widget,
			'activated':this==UI.top.app.document_area.active_tab,
			'owner_tab':this,
			'x':0,'y':0});
		this.util_widget=body;
		return body;
	},
	Save:function(){},
	SaveMetaData:function(){},
	OnDestroy:function(){},
})});
