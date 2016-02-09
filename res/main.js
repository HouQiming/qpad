var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");
require("res/lib/code_editor");
require("res/lib/bin_editor");
require("res/lib/subwin");
require("res/lib/notebook");
var Language=require("res/lib/langdef");

UI.g_version="3.0.0 ("+UI.Platform.ARCH+"_"+UI.Platform.BUILD+")";

UI.ChooseScalingFactor({designated_screen_size:1080})
UI.SetFontSharpening(1);
(function(){
	UI.pixels_per_unit_base=UI.pixels_per_unit
	UI.pixels_per_unit*=(UI.m_ui_metadata.zoom||1)
	UI.ResetRenderer(UI.pixels_per_unit);
})();
//UI.SetFontSharpening(0)
//UI.fallback_font_names=["res/fonts/dsanscn.ttc"]

UI.ReadOptionalConfigScript=function(fn){
	var fn_full=IO.GetStoragePath()+"/"+fn;
	var s0=IO.ReadAll(fn_full);
	if(!s0){
		fn_full="res/misc/"+fn;
		s0=IO.UIReadAll(fn_full);
		if(!s0){
			return;
		}
	}
	try{
		eval(s0);
	}catch(error){
		error.message=[error.message," (",fn_full,")"].join("");
		throw error;
	}
}

UI.ApplyTheme=function(custom_styles){
	var s0=UI.default_styles;
	for(var key in custom_styles){
		s0[key]=custom_styles[key]
	}
}

UI.ReadOptionalConfigScript("conf_translation.js");

UI.icon_font_name='res/fonts/iconfnt.ttf,!'
UI.icon_font=UI.Font(UI.icon_font_name,24);
UI.icon_font_20=UI.Font(UI.icon_font_name,20);
UI.SetRetardedWindingOrder(UI.core_font_cache['res/fonts/iconfnt.ttf']);
(function(){
	//for theme, we always eval the default theme first in case the custom one is only partially defined
	eval(IO.UIReadAll("res/misc/conf_theme.js"));
	var fn_full=IO.GetStoragePath()+"/conf_theme.js";
	var s0=IO.ReadAll(fn_full);
	if(s0){
		try{
			eval(s0);
		}catch(error){
			error.message=[error.message," (",fn_full,")"].join("");
			throw error;
		}
	}
})()
UI.ApplyTheme(UI.CustomTheme());

UI.ReadOptionalConfigScript("conf_keymap.js");

UI.TranslateHotkey=function(s){
	return UI.g_hotkey_map[s]||s;
}

var g_all_document_windows=[];
UI.g_all_document_windows=g_all_document_windows
UI.NewTab=function(tab){
	var current_tab_id=g_all_document_windows.length-1;
	if(UI.top.app.document_area&&UI.top.app.document_area.current_tab_id!=undefined&&UI.g_app_inited){
		current_tab_id=UI.top.app.document_area.current_tab_id;
	}
	if(tab.z_order==undefined){
		tab.z_order=UI.g_current_z_value;
		UI.g_current_z_value++;
	}
	var obj_active_tab=UI.GetFrontMostEditorTab();
	if(obj_active_tab&&UI.g_app_inited){
		current_tab_id=obj_active_tab.__global_tab_id;
	}
	if(!tab.area_name&&obj_active_tab){
		tab.area_name=obj_active_tab.area_name;
	}
	var new_tab_id=current_tab_id+1;
	if(new_tab_id<g_all_document_windows.length){
		var n=g_all_document_windows.length;
		var area=UI.top.app.document_area;
		for(j=n;j>new_tab_id;j--){
			area[j]=area[j-1];
			g_all_document_windows[j]=g_all_document_windows[j-1];
		}
		area[new_tab_id]=undefined;
		g_all_document_windows[new_tab_id]=tab;
		area.current_tab_id=new_tab_id;
		UI.SetFocus(undefined);
	}else{
		g_all_document_windows.push(tab);
		UI.top.app.document_area.current_tab_id=g_all_document_windows.length-1;
		UI.SetFocus(undefined);
	}
	UI.top.app.document_area.just_created_a_tab=1;
	UI.Refresh()
	return tab;
}

var ZOOM_RATE=1.0625
UI.UpdateZoom=function(){
	UI.ResetRenderer(UI.pixels_per_unit);
	UI.Refresh()
	UI.m_ui_metadata.zoom=(UI.pixels_per_unit/UI.pixels_per_unit_base)
}
UI.ZoomRelative=function(rate){
	UI.pixels_per_unit*=rate;
	UI.UpdateZoom()
}
UI.ZoomReset=function(){
	UI.pixels_per_unit=UI.pixels_per_unit_base
	UI.UpdateZoom()
}

UI.BeforeGC=function(){
	UI.ED_IndexGC();
};

if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
	UI.WIN_AddRegistryItem=function(sregfile, key,name_vals){
		sregfile.push("\n[",key,"]\n")
		for(var i=0;i<name_vals.length;i+=2){
			var sname=name_vals[i];
			var sval=name_vals[i+1];
			var stype=undefined;
			if(sname&&sname.length){
				var atypes=sname.split(":");
				if(atypes.length>1){
					stype=atypes.pop();
					sname=atypes.join(":");
				}
				sregfile.push('"')
				sregfile.push(sname.replace(/\\/g,"\\\\"))
				sregfile.push('"')
			}else{
				sregfile.push('@');
			}
			if(stype){
				sregfile.push('=')
				if(stype=="string"){
					sregfile.push('"')
					sregfile.push(sval.toString())
					sregfile.push('"')
				}else{
					sregfile.push(stype)
					sregfile.push(':')
					sregfile.push(sval.toString())
				}
			}else{
				sregfile.push("=hex(2):")
				for(var j=0;j<sval.length;j++){
					var cc=sval.charCodeAt(j);
					var ch0=(cc&255).toString(16);
					var ch1=(cc>>8).toString(16);
					if(ch0.length<2){sregfile.push('0');}
					sregfile.push(ch0);
					sregfile.push(',');
					if(ch1.length<2){sregfile.push('0');}
					sregfile.push(ch1);
					sregfile.push(',');
				}
				sregfile.push('00,00');
			}
			sregfile.push('\n')
		}
	}
	UI.WIN_ApplyRegistryFile=function(sregfile,sprompt){
		var sregfile=sregfile.join("");
		var buf=new Buffer(sregfile.length*2);
		for(var i=0;i<sregfile.length;i++){
			buf.writeInt16LE(sregfile.charCodeAt(i),i*2);
		}
		var fname=IO.ProcessUnixFileName("%temp%/"+sprompt+".reg").replace(/[/]/g,"\\");
		IO.CreateFile(fname,buf)
		var ret=IO.Shell(["regedit","/s",fname]);
		if(ret==0){
			IO.WIN_SHChangeNotify();
		}
		IO.Shell(["del",fname])
		return ret==0;
	}
	UI.InstallQPad=function(){
		//windows installation, generate .reg and run it
		if(UI.Platform.BUILD=="debug"){
			print("*** WARNING: INSTALLING A DEBUG VERSION! ***")
		}
		var sexe=IO.m_my_name.replace(/[/]/g,"\\");
		var sregfile=["\ufeffWindows Registry Editor Version 5.00\n"];
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CLASSES_ROOT\\*\\shell\\edit_with_qpad",[
			"",UI._("Edit with &QPad"),
			"icon",sexe+",0"])
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CLASSES_ROOT\\*\\shell\\edit_with_qpad\\command",["","\""+sexe+"\" \"%1\""])
		var sshortname=UI.GetMainFileName(IO.m_my_name).toLowerCase()
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CLASSES_ROOT\\Applications\\@1".replace("@1",sshortname),
			["FriendlyAppName",UI._("QPad Editor")])
		var file_formats=[]
		for(var i=0;i<Language.g_all_extensions.length;i++){
			var s_ext=Language.g_all_extensions[i];
			if(Language.GetNameByExt(s_ext)=='Binary'){
				continue;
			}
			file_formats.push(s_ext);
			file_formats.push("");
		}
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CLASSES_ROOT\\Applications\\@1\\SupportedTypes".replace("@1",sshortname),
			file_formats)
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CLASSES_ROOT\\Applications\\@1\\shell\\open\\command".replace("@1",sshortname),
			["","\""+sexe+"\" \"%1\""])
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers",
			[sexe+":string",'~ HIGHDPIAWARE'])
		var sversion=UI.g_version;
		var version_parts=sversion.split(/[. ]/)
		var vermajor=parseInt(version_parts[0]||"3");
		var verminor=parseInt(version_parts[1]||"0");
		var spath=IO.GetExecutablePath();
		UI.WIN_AddRegistryItem(sregfile,"HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\@1".replace("@1",sshortname),
			[
				"UninstallString","\""+sexe+"\" --internal-tool --uninstall",
				"DisplayName",UI._("QPad Text Editor"),
				"DisplayVersion",sversion,
				"DisplayIcon",sexe,
				"Publisher","Hou Qiming",
				"URLInfoAbout","www.houqiming.net/qpad/qpad.html",
				"NoModify:dword","1",
				"NoRepair:dword","1",
				"VersionMajor:dword",(vermajor).toString(),
				"VersionMinor:dword",(verminor).toString(),
				"EstimatedSize:dword",(((IO.GetFileSize(sexe)+IO.GetFileSize(spath+'/res.zip'))>>10)+1024).toString(),
				"InstallLocation",spath])
		return UI.WIN_ApplyRegistryFile(sregfile,UI._("Add QPad to explorer menus"));
	}
	UI.UninstallQPad=function(){
		var sshortname=UI.GetMainFileName(IO.m_my_name).toLowerCase()
		var sregfile=[
			"\ufeffWindows Registry Editor Version 5.00\n",
			"\n[-HKEY_CLASSES_ROOT\\*\\shell\\edit_with_qpad]\n",
			"\n[-HKEY_CLASSES_ROOT\\Applications\\@1]\n".replace("@1",sshortname),
			"\n[-HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\@1]\n".replace("@1",sshortname),
		];
		return UI.WIN_ApplyRegistryFile(sregfile,UI._("Uninstall QPad"));
	}
}
//UI.InstallQPad()

UI.g_app_inited=0;
UI.m_cmdline_opens=[];
UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		var app=UI.Begin(W.Window('app',{
				title:'QPad',w:1280,h:720,bgcolor:UI.default_styles.tabbed_document.color,icon:"res/icon256.png",
				flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1,
				OnWindowBlur:function(){
					this.document_area.OnWindowBlur();
				},
				OnMenu:function(){
					this.document_area.OnMenu();
				},
				OnClose:function(){
					return this.document_area.OnClose();
				}}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){if(!app.OnClose()){UI.DestroyWindow(app)}}});
			}
			var w_property_bar=320;
			//UI.Platform.ARCH=='android'?(app.w<app.h?'down':'left'):
			//var obj_panel=W.AutoHidePanel("property_panel",{
			//	x:0,y:0,w:w_property_bar,h:w_property_bar,initial_position:0,
			//	max_velocity:16000,acceleration:10000,velocity_to_target_threshold:0.005,
			//	anchor_placement:'right',//(app.w<app.h?'down':'right'),
			//	knob_size:UI.IS_MOBILE?40:4,
			//});
			//var reg_panel=UI.context_regions.pop()
			//var panel_placement=obj_panel.anchor_placement
			UI.document_property_sheet={};
			//if(panel_placement=='down'){
			//	W.TabbedDocument("document_area",{
			//		'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
			//		'x':0,'y':0,'h':obj_panel.y,
			//		items:g_all_document_windows,
			//		Close:function(){UI.DestroyWindow(app)},
			//	})
			//}else{
			W.TabbedDocument("document_area",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"fill",
				'x':0,'y':0,'w':app.w,//obj_panel.x,
				items:g_all_document_windows,
				Close:function(){UI.DestroyWindow(app)},
			})
			//}
			var property_windows=[]
			if(app.document_area.active_tab){
				property_windows=(app.document_area.active_tab.property_windows||property_windows);
			}
			//UI.context_regions.push(reg_panel)
			//////////////////////////
			//var w_shadow=6
			//var w_bar=4;
			//var shadow_color=0xaa000000
			//if(panel_placement=='down'){
			//	UI.RoundRect({
			//		x:-w_shadow,y:obj_panel.y-w_bar-w_shadow,w:app.w+w_shadow*2,h:w_shadow*2,
			//		color:shadow_color,border_width:-w_shadow,round:w_shadow,
			//	})
			//	UI.RoundRect({
			//		x:0,y:obj_panel.y-w_bar,w:app.w,h:w_property_bar,
			//		color:0xfff0f0f0,border_width:0,
			//	})
			//	W.Group("property_bar",{
			//		'anchor':obj_panel,'anchor_align':"fill",'anchor_valign':"up",
			//		'x':0,'y':0,'h':w_property_bar,
			//		item_template:{'object_type':W.SubWindow},items:property_windows,
			//		///////////
			//		'layout_direction':'right','layout_spacing':0,'layout_align':'left','layout_valign':'fill',
			//		'property_sheet':UI.document_property_sheet,
			//	});
			//	W.RoundRect("",{
			//		'anchor':obj_panel,'anchor_align':"fill",'anchor_valign':"up",
			//		'x':0,'y':-w_bar,'h':w_bar,
			//		'color':UI.current_theme_color,
			//	})
			//}else{
			//UI.RoundRect({
			//	x:obj_panel.x-w_bar-w_shadow,y:-w_shadow,w:w_shadow*2,h:app.h+w_shadow*2,
			//	color:shadow_color,border_width:-w_shadow,round:w_shadow,
			//})
			//UI.RoundRect({
			//	x:obj_panel.x-w_bar,y:0,w:w_property_bar,h:app.h,
			//	color:0xfff0f0f0,border_width:0,
			//})
			//W.Group("property_bar",{
			//	'anchor':obj_panel,'anchor_align':"left",'anchor_valign':"fill",
			//	'x':0,'y':0,'w':w_property_bar,
			//	item_template:{'object_type':W.SubWindow},items:property_windows,
			//	///////////
			//	'layout_direction':'down','layout_spacing':0,'layout_align':'fill','layout_valign':'up',
			//	'property_sheet':UI.document_property_sheet,
			//});
			//W.RoundRect("",{
			//	'anchor':obj_panel,'anchor_align':"left",'anchor_valign':"fill",
			//	'x':-w_bar,'y':0,'w':w_bar,
			//	'color':UI.current_theme_color,
			//})
			//}
			//////////////////////////
			var menu_file=UI.BigMenu("&File")
			menu_file.AddNormalItem({text:"&New",icon:'新',key:"CTRL+N",enable_hotkey:1,action:function(){
				var active_document=UI.top.app.document_area.active_tab
				if(active_document&&active_document.main_widget&&active_document.main_widget.m_is_special_document){
					app.document_area.CloseTab();
				}
				UI.UpdateNewDocumentSearchPath()
				UI.NewCodeEditorTab()
				UI.Refresh()
			}})
			menu_file.AddNormalItem({text:"&Open",icon:'开',key:"CTRL+O",enable_hotkey:1,action:function(){
				//var fn=IO.DoFileDialog(["Text documents (*.text)","*.text","All File","*.*"]);
				//if(!fn){return;}
				UI.UpdateNewDocumentSearchPath()
				var fn=IO.DoFileDialog(["All File","*.*"],UI.m_new_document_search_path+"/*");
				if(!fn){return;}
				var active_document=UI.m_the_document_area.active_tab
				if(active_document&&active_document.main_widget&&active_document.main_widget.m_is_special_document){
					UI.m_the_document_area.CloseTab();
				}
				UI.OpenEditorWindow(fn);
				UI.Refresh()
			}});
			menu_file.AddNormalItem({text:"&Save",key:"CTRL+S",icon:'存',enable_hotkey:1,action:function(){
				app.document_area.SaveCurrent();
			}});
			menu_file.AddNormalItem({text:"Save &as...",key:"SHIFT+CTRL+S",enable_hotkey:1,action:function(){
				app.document_area.SaveAs();
			}});
			menu_file.AddNormalItem({text:"Save a&ll",icon:'保',action:function(){
				app.document_area.SaveAll();
			}});
			if(app.document_area.active_tab){
				menu_file.AddNormalItem({text:"&Close",key:"CTRL+W",enable_hotkey:0,action:function(){
					app.document_area.CloseTab();
				}});
				menu_file.AddSeparator();
				menu_file.AddNormalItem({text:"Revert changes",action:function(){
					var obj_tab=app.document_area.active_tab;
					if(obj_tab&&obj_tab.Reload){obj_tab.Reload();};
				}});
			}
			menu_file.AddSeparator();
			menu_file.AddNormalItem({icon:"时",text:"Recent / projec&t...",
				key:"ALT+Q",
				enable_hotkey:1,action:UI.ExplicitFileOpen})
			//UI.OpenUtilTab.bind(undefined,'hist_view')
			//menu_file.AddNormalItem({text:"&Browse...",
			//	key:UI.m_ui_metadata.new_page_mode=='fs_view'?"ALT+Q":"ALT+Q,Q",
			//	enable_hotkey:0,action:UI.OpenUtilTab.bind(undefined,'fs_view')})
			menu_file.AddNormalItem({text:"Arran&ge tabs",
				enable_hotkey:0,action:function(){UI.top.app.document_area.ArrangeTabs();}})
			//menu_file.AddNormalItem({text:"Manage projects...",
			//	enable_hotkey:0,action:function(){
			//		UI.OpenEditorWindow("*project_list")
			//	}})
			//obj.ArrangeTabs.bind(obj.current_tab_id)
			//W.Hotkey("",{key:"ALT+Q",action:UI.ExplicitFileOpen})
			if(UI.m_closed_windows&&UI.m_closed_windows.length>0){
				menu_file.AddNormalItem({text:"Restore closed",key:"SHIFT+CTRL+T",enable_hotkey:1,action:function(){
					if(UI.m_closed_windows.length>0){
						var active_document=UI.top.app.document_area.active_tab
						var fn=UI.m_closed_windows.pop();
						if(active_document&&active_document.main_widget&&active_document.main_widget.m_is_special_document){
							UI.top.app.document_area.CloseTab();
						}
						//if(g_all_document_windows.length>0){
						//	//hack: put the tab at the end of it
						//	UI.top.app.document_area.current_tab_id=g_all_document_windows.length-1;
						//}
						UI.OpenEditorWindow(fn);
						UI.Refresh();
					}
				}})
			}
			menu_file.AddSeparator();
			W.Hotkey("",{key:"CTRL+-",action:function(){UI.ZoomRelative(1/ZOOM_RATE)}});
			W.Hotkey("",{key:"CTRL+0",action:function(){UI.ZoomReset()}});
			W.Hotkey("",{key:"CTRL+=",action:function(){UI.ZoomRelative(ZOOM_RATE)}});
			menu_file.AddButtonRow({icon:"扩",text:"Zoom (@1%)".replace("@1",(UI.pixels_per_unit/UI.pixels_per_unit_base*100).toFixed(0))},[
				{text:"-",tooltip:'CTRL -',action:function(){
					UI.ZoomRelative(1/ZOOM_RATE)
				}},{text:"100%",tooltip:'CTRL+0',action:function(){
					UI.ZoomReset()
				}},{text:"+",tooltip:'CTRL +',action:function(){
					UI.ZoomRelative(ZOOM_RATE)
				}}])
			if(!UI.Platform.IS_MOBILE){
				//OS shell
				menu_file.AddSeparator();
				menu_file.AddNormalItem({text:"Open shell (&D)...",icon:'控',enable_hotkey:0,action:function(){
					UI.UpdateNewDocumentSearchPath()
					if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
						IO.Shell(["start"," ","cmd","/k","cd","/d",UI.m_new_document_search_path])
					}else if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"){
						IO.Shell(["xterm",
							"-e",'cd '+UI.m_new_document_search_path+'; bash'])
					}else{
						//mac
						//http://stackoverflow.com/questions/7171725/open-new-terminal-tab-from-command-line-mac-os-x
						IO.Shell(["osascript",
							"-e",'tell application "Terminal" to activate'])
						IO.Shell(["osascript",
							"-e",'tell application "System Events" to delay 0.1'])
						IO.Shell(["osascript",
							"-e",'tell application "System Events" to tell process "Terminal" to keystroke "t" using command down'])
						IO.Shell(["osascript",	
							"-e",'tell application "Terminal" to do script "cd '+UI.m_new_document_search_path+'" in selected tab of the front window'])
					}
				}})
			}
			//todo
			menu_file.AddNormalItem({text:"Open notebook...",
				enable_hotkey:1,key:"ALT+N",
				action:function(){UI.NewNoteBookTab("Notebook","c:/h/edtest/notebook.json");}})
			//todo
			menu_file.AddSeparator();
			menu_file.AddNormalItem({text:"E&xit",action:function(){
				if(!app.OnClose()){UI.DestroyWindow(app)}
			}});
			menu_file=undefined;
			//if(!UI.m_current_file_list){
			//	UI.ClearFileListingCache();
			//}
			//////////////////////////
			var menu_edit=UI.BigMenu("&Edit")
			if(menu_edit.$.length){
				menu_edit.AddSeparator();
			}
			menu_edit.AddNormalItem({text:"Preferences...",icon:"设",key:" ",enable_hotkey:0,action:function(){
				UI.NewOptionsTab();
			}});
			menu_edit=undefined;
		UI.End();
	UI.End();
	if(!UI.g_app_inited){
		var workspace=UI.m_ui_metadata["<workspace_v2>"]
		var fn_current_tab=UI.m_ui_metadata["<current_tab>"]
		if(workspace){
			var current_tab_id=undefined
			UI.g_current_z_value=0;
			for(var i=0;i<workspace.length;i++){
				//UI.NewCodeEditorTab(workspace[i])
				if(workspace[i].util_type){
					UI.OpenUtilTab(workspace[i].util_type)
				}else{
					UI.OpenEditorWindow(workspace[i].file_name)
				}
				var item=UI.top.app.document_area.items[UI.top.app.document_area.items.length-1];
				item.z_order=workspace[i].z_order;
				item.area_name=(workspace[i].area_name||"doc_default");
				UI.g_current_z_value=Math.max(UI.g_current_z_value,item.z_order+1);
				if(workspace[i].file_name==fn_current_tab){
					current_tab_id=UI.top.app.document_area.items.length-1;
				}
			}
			if(current_tab_id!=undefined){
				UI.top.app.document_area.SetTab(current_tab_id)
				UI.top.app.document_area.n_tabs_last_checked=g_all_document_windows.length
				UI.SetFocus(undefined)
			}
			UI.InvalidateCurrentFrame();
			UI.Refresh()
		}
		if(UI.m_cmdline_opens.length){
			UI.OpenForCommandLine(UI.m_cmdline_opens)
			UI.InvalidateCurrentFrame();
			UI.Refresh()
			UI.m_cmdline_opens=[];
		}
		UI.g_app_inited=1;
	}
	if(!g_all_document_windows.length){
		if(app.quit_on_zero_tab){
			if(!app.OnClose()){UI.DestroyWindow(app)}
			return;
		}
		//UI.NewUIEditorTab()
		//UI.NewCodeEditorTab()
		//UI.OpenFile("c:/tp/kara/ide/edcore.spap")
		//UI.OpenFile("c:/h/edtest/empty.tex")
		//UI.OpenFile("c:/tp/papers/ours/vg2015/gpu_scanline.tex")
		//UI.OpenFile("C:/tp/qpad/history.xml")
		//UI.NewFromTemplate("templates/blank_demo.mo")
		//c:\tp\pure\mo\pm_tmp\win32\mo\s7main.c
		//UI.OpenFile("C:/h/syousetu/stars_tr.md")
		//UI.OpenFile("c:/h/edtest/crap.c")
		//UI.UpdateNewDocumentSearchPath()
		UI.m_new_document_search_path=IO.GetNewDocumentName(undefined,undefined,"document");
		UI.m_previous_document=undefined
		UI.OpenUtilTab('file_browser');
		UI.InvalidateCurrentFrame()
		UI.Refresh()
		app.quit_on_zero_tab=1;
	}
	if(UI.Platform.BUILD=="debug"){
		//detect memory leaks
		W.Hotkey("",{key:"SHIFT+CTRL+L",action:function(){
			UI.BeforeGC()
			Duktape.gc()
			UI.dumpMemoryUsage();
			UI.detectLeaks();
		}});
		W.Hotkey("",{key:"SHIFT+CTRL+M",action:function(){
			print("=== manual gc call")
			UI.BeforeGC()
			Duktape.gc()
			UI.debugDumpHeap()
			UI.debugDumpFragmentation()
		}});
	}
};

if(UI.Platform.ARCH=="mac"){
	/*
	todo: mac
		tell application "System Events"
		    count (every process whose name is "BBEdit")
		end tell
		tell application "System Events"
		    set theprocs to every process whose unix id is myProcessId
		    repeat with proc in theprocs
		        set the frontmost of proc to true
		    end repeat
		end tell
	*/
	IO.IsFirstInstance=function(){
		//todo
	};
	IO.SetForegroundProcess=function(pid){
		//todo
	};
}

if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"){
	IO.IsFirstInstance=function(){
		return 1;
	};
	IO.SetForegroundProcess=function(pid){
		return 0;
	};
}

UI.OpenFile=function(fn){
	if(IO.DirExists(fn)){
		UI.AddProjectDir(fn);
	}else if(IO.FileExists(fn)){
		UI.OpenEditorWindow(fn);
	}
};

(function(){
	var argv=IO.m_argv;
	if(argv.length>0){argv.shift();}
	if(argv.length>=2&&argv[0]=='--internal-tool'){
		if(argv[1]=="--uninstall"&&UI.UninstallQPad){
			UI.UninstallQPad();
		}
		return;
	}
	//instance check
	//this is not safe. it could race. shouldn't happen too often though
	//we try to open new instances when it races
	//temp file with pid + temp file check during OnFocus
	var is_first=IO.IsFirstInstance("qpad3_single_instance");
	var fn_hack_pipe=IO.GetStoragePath()+"/tmp_pid.txt";
	var fn_hack_pipe2=IO.GetStoragePath()+"/tmp_open.json";
	if(!is_first&&IO.FileExists(fn_hack_pipe)&&!IO.FileExists(fn_hack_pipe2)){
		//in case pid exceeds 32 bits... parseFloat it
		var pid=parseFloat(IO.ReadAll(fn_hack_pipe))
		IO.CreateFile(fn_hack_pipe2,JSON.stringify(argv))
		if(IO.SetForegroundProcess(pid)){
			return;
		}
	}
	IO.DeleteFile(fn_hack_pipe2)//delete lingering files
	IO.CreateFile(fn_hack_pipe,IO.GetPID().toString())
	UI.m_cmdline_opens=argv;
	UI.Run();
	IO.DeleteFile(fn_hack_pipe)
})()
