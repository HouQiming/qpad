var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/code_editor");
require("res/lib/bin_editor");
require("res/lib/subwin");
require("res/lib/notebook_v2");
require("res/lib/help_page");
require("res/plugin/edbase");
var Language=require("res/lib/langdef");
//if something was never viewed after 24 active editing hours, close it
var MAX_STALE_TIME=3600*24;

UI.g_version="3.0.0 ("+UI.Platform.ARCH+"_"+UI.Platform.BUILD+")";

if(UI.TestOption('software_srgb')){
	//UI.SetSRGBEnabling(0);
	UI.SetSRGBEnabling(2);
}
if(UI.IS_MOBILE){
	//on mobile, we're better without the IME - it doesn't work on external kbd anyway
	UI.SDL_StartTextInput=function(){};
	UI.SDL_StopTextInput=function(){};
}
UI.ChooseScalingFactor({designated_screen_size:UI.IS_MOBILE?720:1080})
UI.SetFontSharpening(1);
UI.wheel_message_mode="over";
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
//UI.SetRetardedWindingOrder(UI.core_font_cache['res/fonts/iconfnt.ttf']);
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
		for(var j=n;j>new_tab_id;j--){
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
	for(var i=0;i<g_all_document_windows.length;i++){
		g_all_document_windows[i].__global_tab_id=i;
	}
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
		return UI.WIN_ApplyRegistryFile(sregfile,"Add QPad to explorer menus");
	}
	UI.UninstallQPad=function(){
		var sshortname=UI.GetMainFileName(IO.m_my_name).toLowerCase()
		var sregfile=[
			"\ufeffWindows Registry Editor Version 5.00\n",
			"\n[-HKEY_CLASSES_ROOT\\*\\shell\\edit_with_qpad]\n",
			"\n[-HKEY_CLASSES_ROOT\\qpad3_file]\n",
			"\n[-HKEY_CLASSES_ROOT\\Applications\\@1]\n".replace("@1",sshortname),
			"\n[-HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\@1]\n".replace("@1",sshortname),
		];
		return UI.WIN_ApplyRegistryFile(sregfile,"Uninstall QPad");
	}
	UI.SetFileAssoc=function(sext){
		var sregfile=["\ufeffWindows Registry Editor Version 5.00\n"];
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CLASSES_ROOT\\."+sext,["","qpad3_file"])
		var sexe=IO.m_my_name.replace(/[/]/g,"\\");
		UI.WIN_AddRegistryItem(sregfile,"HKEY_CLASSES_ROOT\\qpad3_file\\shell\\open\\command",["","\""+sexe+"\" \"%1\""])
		return UI.WIN_ApplyRegistryFile(sregfile,"Set file association");
	}
	UI.ShowInFolder=function(fn){
		IO.Shell(["explorer","/select,",IO.NormalizeFileName(fn,1).replace(/[/]/g,'\\')])
	}
}
if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"){
	UI.InstallQPad=function(){
		//linux installation, generate .desktop and copy it
		if(UI.Platform.BUILD=="debug"){
			print("*** WARNING: INSTALLING A DEBUG VERSION! ***")
		}
		var a_desktop_file=[
			"[Desktop Entry]\n",
			"Name=QPad\n",
			"Type=Application\n",
			"Terminal=false\n",
			"Exec=/usr/bin/qpad\n",
			"Icon=/usr/share/qpad/icon.svg\n",
			"Comment=QPad Text Editor\n",
			"NoDisplay=false\n",
			"Categories=Development;IDE\n",
			"Name[en]=QPad Text Editor\n",
			];
		var fn_desktop=IO.GetNewDocumentName("a","desktop","temp")
		IO.CreateFile(fn_desktop,a_desktop_file.join(""))
		var fn_svg=IO.GetNewDocumentName("a","svg","temp")
		IO.CreateFile(fn_svg,IO.UIReadAll("res/misc/icon_linux.svg"))
		var a_sh_installer=["#!/bin/sh\n"];
		a_sh_installer.push("cp ",IO.m_my_name," /usr/bin/qpad\n")
		a_sh_installer.push("mkdir -p /usr/share/qpad\n")
		a_sh_installer.push("mv ",fn_svg," /usr/share/qpad/icon.svg\n")
		a_sh_installer.push("mv ",fn_desktop," /usr/share/applications/qpad.desktop\n")
		a_sh_installer.push('rm -- "$0"\n')
		var fn_sh=IO.GetNewDocumentName("a","sh","temp")
		IO.CreateFile(fn_sh,a_sh_installer.join(""))
		var s_terminal="xterm";
		if(IO.FileExists("/usr/bin/x-terminal-emulator")){
			s_terminal="x-terminal-emulator";
		}
		IO.Shell([s_terminal,
			"-e",'sudo /bin/sh '+fn_sh])
	}
}
if(UI.Platform.ARCH=="mac"){
	UI.InstallQPad=function(){
		//mac installation, copy qpad.app to /Applications/
		var spath=IO.GetExecutablePath();
		spath=UI.GetPathFromFilename(spath)+'../../../qpad.app';
		var a_sh_installer=["#!/bin/sh\n"];
		a_sh_installer.push("cp -r ",spath," /Applications/\n")
		a_sh_installer.push('rm -- "$0"\n')
		var fn_sh=IO.GetNewDocumentName("a","sh","temp")
		IO.CreateFile(fn_sh,a_sh_installer.join(""))
		IO.Shell(['sudo','/bin/sh',fn_sh])
	}
}
//UI.InstallQPad()

var SetHelpText=function(doc_code){
	var tab_help=UI.OpenUtilTab('help_page');
	var doc_help_edit=(tab_help&&tab_help.util_widget&&tab_help.util_widget.find_bar_edit);
	if(doc_help_edit){
		doc_help_edit.SetSelection(0,doc_help_edit.ed.GetTextSize())
		tab_help.util_widget.InvalidateContent();
		if(doc_code){
			//sel-to-help
			var sel=doc_code.GetSelection();
			if(!(sel[0]<sel[1])){
				var ccnt=doc_code.sel1.ccnt;
				var ed=doc_code.ed;
				var neib=ed.GetUtf8CharNeighborhood(ccnt);;
				if(UI.ED_isWordChar(neib[0])||UI.ED_isWordChar(neib[1])){
					sel[0]=doc_code.SkipInvisibles(ccnt,-1);
					sel[0]=doc_code.SnapToValidLocation(ed.MoveToBoundary(ed.SnapToCharBoundary(sel[0],-1),-1,"word_boundary_left"),-1);
					sel[1]=doc_code.SkipInvisibles(ccnt,1);
					sel[1]=doc_code.SnapToValidLocation(ed.MoveToBoundary(ed.SnapToCharBoundary(sel[1],1),1,"word_boundary_right"),1);
				}
			}
			if(sel[0]<sel[1]){
				//auto-search
				doc_help_edit.ed.Edit([
					0,doc_help_edit.ed.GetTextSize(),doc_code.ed.GetText(sel[0],sel[1]-sel[0])])
				doc_help_edit.SetSelection(0,doc_help_edit.ed.GetTextSize())
				doc_help_edit.CallOnChange()
			}
		}
	}
};

var OpenShell=function(){
	UI.UpdateNewDocumentSearchPath()
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		if(IO.FileExists(IO.GetStoragePath()+"/plugins/shell.bat")){
			IO.RunProcess(["cmd","/c",IO.GetStoragePath()+"/plugins/shell.bat"],UI.m_new_document_search_path)
		}else{
			IO.RunProcess(["cmd"],UI.m_new_document_search_path)
		}
	}else if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"){
		var s_terminal="xterm";
		if(IO.FileExists("/usr/bin/x-terminal-emulator")){
			s_terminal="x-terminal-emulator";
		}
		//var fn_sh=IO.GetNewDocumentName("a","sh","temp")
		//IO.CreateFile(fn_sh,'#!/bin/sh\ncd \''+UI.m_new_document_search_path+'\'\nrm -- "$0"\nexec "$SHELL"\n')
		//IO.Shell([s_terminal,"-e","/bin/sh "+fn_sh,"&"])
		IO.RunProcess([s_terminal],UI.m_new_document_search_path)
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
};

UI.g_app_inited=0;
UI.m_cmdline_opens=[];
var CreateMenus=function(){
	var doc_area=UI.top.app.document_area;
	var menu_file=UI.BigMenu("&File")
	menu_file.AddNormalItem({text:"&New",icon:'新',key:"CTRL+N",enable_hotkey:1,action:function(){
		var active_document=UI.top.app.document_area.active_tab
		if(active_document&&active_document.main_widget&&active_document.main_widget.m_is_special_document){
			UI.top.app.document_area.CloseTab();
		}
		UI.UpdateNewDocumentSearchPath()
		UI.NewCodeEditorTab()
		UI.Refresh()
	}})
	menu_file.AddNormalItem({text:"&Open",icon:'开',key:"CTRL+O",enable_hotkey:1,action:function(){
		UI.UpdateNewDocumentSearchPath()
		var fn=IO.DoFileDialog(0,undefined,UI.m_new_document_search_path);
		if(!fn){return;}
		var active_document=UI.m_the_document_area.active_tab
		if(active_document&&active_document.main_widget&&active_document.main_widget.m_is_special_document){
			UI.m_the_document_area.CloseTab();
		}
		UI.OpenFile(fn);
		UI.Refresh()
	}});
	if(doc_area.active_tab&&doc_area.active_tab.Save){
		menu_file.AddNormalItem({text:"&Save",key:"CTRL+S",icon:'存',enable_hotkey:1,action:function(){
			UI.top.app.document_area.SaveCurrent();
		}});
	}
	if(doc_area.active_tab&&doc_area.active_tab.SaveAs){
		if(UI.Platform.ARCH=="web"){
			menu_file.AddNormalItem({text:"Downlo&ad as file",key:"SHIFT+CTRL+S",enable_hotkey:1,action:function(){
				UI.top.app.document_area.SaveAs();
			}});
		}else{
			menu_file.AddNormalItem({text:"Save &as...",key:"SHIFT+CTRL+S",enable_hotkey:1,action:function(){
				UI.top.app.document_area.SaveAs();
			}});
		}
	}
	menu_file.AddNormalItem({text:"Save a&ll",icon:'保',action:function(){
		UI.top.app.document_area.SaveAll();
	}});
	if(UI.top.app.document_area.active_tab){
		menu_file.AddSeparator();
		menu_file.AddNormalItem({
			text:"&Close",key:"CTRL+W",enable_hotkey:0,
			tab_menu_group:"close",
			action:function(){
				UI.top.app.document_area.CloseTab();
			}
		});
		if(UI.top.app.document_area.items.length>1){
			menu_file.AddNormalItem({
				text:"Close all",
				tab_menu_group:"close",
				action:function(){
					UI.top.app.document_area.CloseAll(0)
				}
			});
			menu_file.AddNormalItem({
				text:"Close all but this",
				tab_menu_group:"close",
				action:function(){
					UI.top.app.document_area.CloseAll(1)
				}
			});
		}
	}
	var obj_active_tab=UI.GetFrontMostEditorTab();
	if(obj_active_tab&&obj_active_tab.Reload){
		menu_file.AddSeparator();
		menu_file.AddNormalItem({text:"Revert changes",action:function(obj_active_tab){
			obj_active_tab.Reload();
		}.bind(undefined,obj_active_tab)});
	}
	menu_file.AddSeparator();
	menu_file.AddNormalItem({icon:"时",text:"Recent / projec&t...",
		key:"ALT+Q",
		enable_hotkey:1,action:UI.ExplicitFileOpen})
	//UI.OpenUtilTab.bind(undefined,'hist_view')
	//menu_file.AddNormalItem({text:"&Browse...",
	//	key:UI.m_ui_metadata.new_page_mode=='fs_view'?"ALT+Q":"ALT+Q,Q",
	//	enable_hotkey:0,action:UI.OpenUtilTab.bind(undefined,'fs_view')})
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
	//menu_file.AddSeparator();
	if(!UI.Platform.IS_MOBILE){
		//OS shell
		menu_file.AddSeparator();
		menu_file.AddNormalItem({text:"Open shell (&D)...",icon:'控',enable_hotkey:0,action:OpenShell})
	}
	if(obj_active_tab&&obj_active_tab.main_widget&&obj_active_tab.main_widget.doc){
		obj_active_tab.main_widget.doc.CallHooks("global_menu")
	}
	menu_file.AddSeparator();
	menu_file.AddNormalItem({text:"E&xit",action:function(){
		if(!UI.top.app.OnClose()){UI.DestroyWindow(UI.top.app)}
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
	//////////////////////////
	var menu_tools=UI.BigMenu("&Tools")
	var obj_real_active_tab=UI.top.app.document_area.active_tab;
	if(obj_real_active_tab&&obj_real_active_tab.file_name){
		menu_tools.AddNormalItem({text:"Copy path",tab_menu_group:'tools',enable_hotkey:0,
			action:function(fn){
				var s=IO.NormalizeFileName(fn,1);
				if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
					s=s.replace(/[/]/g,'\\');
				}
				UI.SDL_SetClipboardText(s)
			}.bind(undefined,obj_real_active_tab.file_name)
		})
		menu_tools.AddNormalItem({text:"Move related tabs to front",tab_menu_group:'tools',
			enable_hotkey:0,action:function(){UI.top.app.document_area.ArrangeTabs();}})
		menu_tools.AddNormalItem({text:"Open shell here (&D)...",tab_menu_group:'tools',icon:'控',enable_hotkey:0,action:OpenShell})
		if(UI.ShowInFolder){
			menu_tools.AddNormalItem({text:"Show in folder...",tab_menu_group:'tools',icon:'开',enable_hotkey:0,
				action:UI.ShowInFolder.bind(undefined,obj_real_active_tab.file_name)
			})
		}
		menu_tools.AddSeparator()
	}
	if(obj_active_tab&&obj_active_tab.file_name){
		//polite GetEditorProject is identical to UI.GetNotebookProject
		var spath_repo=UI.GetEditorProject(obj_active_tab.file_name,"polite");
		if(spath_repo){
			var fn_notebook=IO.NormalizeFileName(spath_repo+"/notebook.json");
			if(obj_real_active_tab&&obj_real_active_tab.document_type=='notebook'&&obj_real_active_tab.file_name==fn_notebook){
				menu_tools.AddNormalItem({text:"Return to file",
					enable_hotkey:1,key:"ALT+N",
					action:UI.top.app.document_area.SetTab.bind(
						UI.top.app.document_area,
						obj_active_tab.__global_tab_id),
				})
			}else{
				var doc=obj_active_tab.main_widget&&obj_active_tab.main_widget.doc;
				if(doc){
					menu_tools.AddNormalItem({icon:"本",text:"&Notebook...",
						enable_hotkey:1,key:"ALT+N",
						action:(function(){
							var result_cell=UI.OpenNotebookCellFromEditor(this,"# TODO LIST\n","Markdown",1,'input');
							UI.OpenNoteBookTab(fn_notebook)
							if(result_cell){
								UI.SetFocus(result_cell.obj_notebook.m_cells[result_cell.cell_id].m_text_in);
							}
							UI.Refresh()
						}).bind(doc)
					})
				}
				doc=undefined;
			}
		}
	}
	menu_tools.AddNormalItem({
		text:"&Help...",icon:"问",
		enable_hotkey:1,key:"F1",
		action:function(doc_code){
			var tab_help=UI.OpenUtilTab('help_page');
			var doc_help_edit=(tab_help&&tab_help.util_widget&&tab_help.util_widget.find_bar_edit);
			if(!doc_help_edit){
				if(doc_code){
					UI.InvalidateCurrentFrame()
					UI.NextTick(SetHelpText.bind(undefined,doc_code));
				}
			}
			SetHelpText(doc_code);
		}.bind(undefined,obj_active_tab&&obj_active_tab.main_widget&&obj_active_tab.main_widget.doc)
	});
	if(obj_active_tab&&obj_active_tab.main_widget&&obj_active_tab.main_widget.doc&&obj_active_tab==obj_real_active_tab){
		if(UI.SetFileAssoc){
			var sext=UI.GetFileNameExtension(obj_active_tab.main_widget.file_name);
			menu_tools.AddSeparator();
			menu_tools.AddNormalItem({
				icon:"盾",
				text:UI.Format("Use QPad to open *.@1",sext),
				tab_menu_group:"assoc",
				action:UI.SetFileAssoc.bind(undefined,sext),
			})
		}
	}
	menu_tools.AddSeparator()
	W.Hotkey("",{key:"CTRL+-",action:function(){UI.ZoomRelative(1/ZOOM_RATE)}});
	W.Hotkey("",{key:"CTRL+0",action:function(){UI.ZoomReset()}});
	W.Hotkey("",{key:"CTRL+=",action:function(){UI.ZoomRelative(ZOOM_RATE)}});
	menu_tools.AddButtonRow({icon:"扩",text:UI._("Zoom (@1%)").replace("@1",(UI.pixels_per_unit/UI.pixels_per_unit_base*100).toFixed(0))},[
		{text:"-",tooltip:'CTRL -',action:function(){
			UI.ZoomRelative(1/ZOOM_RATE)
		}},{text:"100%",tooltip:'CTRL+0',action:function(){
			UI.ZoomReset()
		}},{text:"+",tooltip:'CTRL +',action:function(){
			UI.ZoomRelative(ZOOM_RATE)
		}}])
	menu_tools=undefined;
	obj_active_tab=undefined;
	obj_real_active_tab=undefined;
	//////////////////////////
	doc_area=undefined;
}

UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		var app=UI.Begin(W.Window('app',{
				title:'QPad',w:1280,h:720,
				bgcolor:UI.default_styles.tabbed_document.color,
				icon:"res/misc/icon_win.png",
				flags:(UI.Platform.ARCH=="web"?0:UI.SDL_WINDOW_MAXIMIZED)|UI.SDL_WINDOW_RESIZABLE,
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
			app.progress=undefined;
			//console.log(app.w,app.h,UI.pixels_per_unit)
			//var w_property_bar=320;
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
			UI.m_invalid_util_tabs=[];
			W.TabbedDocument("document_area",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"fill",
				'x':0,'y':0,'w':app.w,//obj_panel.x,
				items:g_all_document_windows,
				Close:function(){UI.DestroyWindow(app)},
				fmenu_callback:CreateMenus,
			})
			if(UI.m_invalid_util_tabs.length){
				UI.m_invalid_util_tabs.sort();
				while(UI.m_invalid_util_tabs.length>0){
					UI.top.app.document_area.CloseTab(UI.m_invalid_util_tabs.pop());
				}
				UI.InvalidateCurrentFrame();
			}
			//////////////////////////
		UI.End();
	UI.End();
	if(!UI.g_app_inited){
		var workspace=UI.m_ui_metadata["<workspace_v2>"]
		var fn_current_tab=UI.m_ui_metadata["<current_tab>"]
		if(workspace){
			var current_tab_id=undefined;
			var close_stale=UI.TestOption('close_stale');
			UI.g_current_z_value=0;
			for(var i=0;i<workspace.length;i++){
				//UI.NewCodeEditorTab(workspace[i])
				if(close_stale&&workspace[i].stale_time>=MAX_STALE_TIME&&!workspace[i].util_type&&workspace[i].file_name!=fn_current_tab){
					continue;
				}
				if(workspace[i].util_type){
					UI.OpenUtilTab(workspace[i].util_type)
				}else if(workspace[i].document_type=='notebook'){
					UI.OpenNoteBookTab(workspace[i].file_name)
				}else{
					UI.OpenEditorWindow(workspace[i].file_name)
				}
				var item=UI.top.app.document_area.items[UI.top.app.document_area.items.length-1];
				item.z_order=workspace[i].z_order;
				item.area_name=(workspace[i].area_name||"doc_default");
				item.stale_time=(workspace[i].stale_time||0);
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
	if(!UI.m_ui_metadata["<has_opened_us_before>"]){
		UI.m_new_document_search_path=IO.GetNewDocumentName(undefined,undefined,"document");
		UI.m_previous_document=undefined
		UI.OpenUtilTab('file_browser');
		if(UI.Platform.ARCH!="web"){
			UI.NewOptionsTab();
		}
		if(UI.Platform.ARCH=="web"){
			var fn=IO.NormalizeFileName(IO.ProcessUnixFileName('~/markdown.md'));
			UI.m_ui_metadata[fn]={m_enable_wrapping:1};
			UI.OpenFile(fn);
			UI.OpenFile(IO.ProcessUnixFileName('~/example.cpp'));
		}
		UI.InvalidateCurrentFrame()
		UI.Refresh()
		UI.m_ui_metadata["<has_opened_us_before>"]=1;
	}
	if(UI.SetTaskbarProgress){
		UI.SetTaskbarProgress(app.__hwnd,app.progress||0);
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

		tell application "Finder" to select file "" of folder ""
	*/
	IO.IsFirstInstance=function(){
		//todo
		return 1;
	};
	IO.SetForegroundProcess=function(pid){
		//todo
		return 0;
	};
	UI.ShowInFolder=function(fn){
		//todo
	}
}

//if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"||UI.IS_MOBILE||UI.Platform.ARCH=="web")
//if(!IO.IsFirstInstance){
//	IO.IsFirstInstance=function(){
//		return 1;
//	};
//	IO.SetForegroundProcess=function(pid){
//		return 0;
//	};
//}

UI.OpenFile=function(fn){
	var fn=IO.NormalizeFileName(fn);
	if(IO.DirExists(fn)){
		UI.AddProjectDir(fn);
	}else if(IO.FileExists(fn)){
		for(var i=0;i<UI.g_all_document_windows.length;i++){
			if(UI.g_all_document_windows[i].file_name==fn){
				if(UI.TestOption("explicit_open_mtf")){
					var tab_frontmost=UI.GetFrontMostEditorTab();
					if(tab_frontmost&&i>tab_frontmost.__global_tab_id+1){
						UI.top.app.document_area.MoveToFront(tab_frontmost.__global_tab_id,i);
						return;
					}
				}
			}
		}
		UI.OpenEditorWindow(fn);
	}
};

(function(){
	var argv=IO.m_argv;
	if(argv.length>0){argv.shift();}
	if(argv.length>=2&&argv[0]=='--internal-tool'){
		if(argv[1]=="--uninstall"){
			if(UI.UninstallQPad){
				UI.UninstallQPad();
			}
		}else if(argv[1]=="--install"){
			if(UI.InstallQPad){
				UI.InstallQPad();
			}
		}
		return;
	}
	//instance check
	//this is not safe. it could race. shouldn't happen too often though
	//we try to open new instances when it races
	//temp file with pid + temp file check during OnFocus
	if(IO.IsFirstInstance){
		var is_first=IO.IsFirstInstance("qpad3_single_instance");
		var fn_hack_pipe=IO.GetStoragePath()+"/tmp_pid.txt";
		var fn_hack_pipe2=IO.GetStoragePath()+"/tmp_open.json";
		if(argv.length>=1&&argv[0]=='--new-instance'){
			is_first=1;
		}
		if(!is_first&&IO.FileExists(fn_hack_pipe)&&!IO.FileExists(fn_hack_pipe2)){
			//in case pid exceeds 32 bits... parseFloat it
			var pid=parseFloat(IO.ReadAll(fn_hack_pipe))
			for(var i=0;i<argv.length;i++){
				argv[i]=IO.NormalizeFileName(argv[i])
			}
			IO.CreateFile(fn_hack_pipe2,JSON.stringify(argv))
			if(IO.SetForegroundProcess(pid)){
				return;
			}
		}
		IO.DeleteFile(fn_hack_pipe2)//delete lingering files
		IO.CreateFile(fn_hack_pipe,IO.GetPID().toString())
	}
	UI.m_cmdline_opens=argv;
	UI.Run();
	if(IO.IsFirstInstance){
		IO.DeleteFile(fn_hack_pipe)
	}
})()
