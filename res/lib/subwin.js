var UI=require("gui2d/ui");
var W=require("gui2d/widgets");

///////////////////////
W.SubWindow=function(id,attrs){
	//just title bar + cross button
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "sub_window");
	UI.StdAnchoring(id,obj);
	UI.RoundRect(obj)
	UI.Begin(obj)
		UI.Begin(UI.Keep("caption",W.RoundRect("",{
				'x':0,'y':0,'w':obj.w,'h':obj.h_caption,
				'border_color':obj.border_color,'border_width':obj.border_width,
				'color':obj.caption_color})))
			//text
			W.Text("",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"center",
				'x':obj.padding,'y':0,
				'font':obj.font,'text':obj.title,'color':obj.text_color,
			})
			//the closing button
			//×✕✖
			W.Button("hide",{
				'anchor':'parent','anchor_align':"right",'anchor_valign':"center",
				'x':0,'y':0,
				'style':obj.button_style,
				'text':'✕',
				'OnClick':function(){obj.is_hidden=1;UI.Refresh();}
			})
		UI.End()
		obj.body();
	UI.End()
	return obj;
}

///////////////////////
W.TabLabel_prototype={
	title:"",//initial empty title
	//todo: inactive tab mouseover, dragging, click-sel 
}
W.TabLabel=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabLabel_prototype);
	UI.StdStyling(id,obj,attrs, "tab_label",obj.selected?"active":"inactive");
	if(!attrs.w){
		obj.text=obj.title;
		obj.w=UI.MeasureIconText(obj).w;
	}
	obj.x+=obj.x_animated
	UI.StdAnchoring(id,obj);
	UI.Begin(obj)
		if(obj.selected){
			UI.RoundRect({
				x:obj.x,y:obj.y-obj.shadow_size*0.5,w:obj.w+obj.shadow_size,h:obj.h+obj.shadow_size*1.5,
				color:obj.shadow_color,border_width:-obj.shadow_size,round:obj.shadow_size,
			})
			UI.RoundRect({
				x:obj.x,y:obj.y,w:obj.w,h:obj.h,
				color:obj.color,
			})
		}
		W.Text("",{
			'anchor':'parent','anchor_align':"center",'anchor_valign':"center",
			'x':0,'y':0,
			'font':obj.font,'text':obj.text,'color':obj.text_color,
		})
	UI.End()
	return obj
}

W.TabbedDocument_prototype={
	//closer -> class: OnClose notification and stuff
	CloseTab:function(tabid,forced){
		if(tabid==undefined){tabid=this.current_tab_id}
		var tab=this.items[tabid]
		if(!tab){return;}
		if(tab.need_save&&!forced){
			this.current_tab_id=tabid
			//dialog box
			tab.in_save_dialog=1
			UI.Refresh()
			return;
		}
		//close it
		if(!tab.need_save){
			tab.SaveMetaData();
			UI.SaveMetaData();
		}
		var window_list=this.items
		var n2=tabid;
		for(var i=tabid+1;i<window_list.length;i++){
			window_list[n2++]=window_list[i]
		}
		window_list.pop()
		if(this.current_tab_id>tabid){this.current_tab_id--}
		if(this.current_tab_id>=this.items.length){this.current_tab_id--}
		if(this.current_tab_id<0){this.current_tab_id=0;}
		UI.Refresh()
	},
	SetTab:function(tabid){
		this.current_tab_id=tabid
		UI.Refresh()
	},
	SaveTab:function(tabid){
		var active_document=this.items[tabid];
		active_document.Save()
		return !active_document.need_save
	},
	SaveCurrent:function(){
		var active_document=this.active_tab;
		active_document.Save()
		return !active_document.need_save
	},
	SaveAll:function(){
		var ret=1
		for(var i=0;i<this.items.length;i++){
			var tab_i=this.items[i]
			if(tab_i.need_save){
				tab_i.Save()
			}
			if(tab_i.need_save){ret=0}
		}
		return ret
	},
	OnClose:function(){
		var ret=0
		for(var i=0;i<this.items.length;i++){
			var tab_i=this.items[i]
			if(tab_i.need_save){
				this.current_tab_id=i
				tab_i.in_save_dialog=1
				ret=1
			}else{
				tab_i.SaveMetaData()
			}
		}
		var window_list=this.items
		var n2=0;
		for(var i=0;i<window_list.length;i++){
			var tab_i=window_list[i]
			if(tab_i.need_save){window_list[n2++]=tab_i;}else{if(this.current_tab_id>i){this.current_tab_id--}}
		}
		while(window_list.length>n2){window_list.pop();}
		if(this.current_tab_id>=this.items.length){this.current_tab_id--}
		if(this.current_tab_id<0){this.current_tab_id=0;}
		UI.SaveMetaData()
		UI.Refresh()
		this.m_is_close_pending=1
		return ret
	},
	OnMenu:function(){
		this.m_is_in_menu=!this.m_is_in_menu;
		if(this.m_is_in_menu){
			//g_menu_action_invoked=0;
			UI.m_frozen_global_menu=UI.m_global_menu
		}
		UI.Refresh()
	},
	OnWindowBlur:function(){
		this.m_is_in_menu=0;
		UI.Refresh()
	},
}
W.TabbedDocument=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabbedDocument_prototype);
	UI.StdStyling(id,obj,attrs, "tabbed_document");
	UI.StdAnchoring(id,obj);
	var items=obj.items
	if((obj.n_tabs_last_checked||0)<items.length){
		//new tab activating
		obj.current_tab_id=(items.length-1);
		obj.m_is_in_menu=0
	}
	obj.n_tabs_last_checked=items.length;
	if(!items.length&&obj.m_is_close_pending){
		obj.Close();
		return;
	}
	UI.Begin(obj)
		var sel={}
		var tabid=(obj.current_tab_id||0);
		sel[tabid]=1
		var n=items.length
		var y_label_area=obj.y
		var w_label_area=obj.w
		var w_menu=0;
		//the big menu
		var bk_menu=UI.m_global_menu
		UI.m_global_menu=new W.CFancyMenuDesc()
		UI.BigMenu("&File")
		w_label_area-=obj.w_menu_button+obj.padding*2
		if(obj.m_is_in_menu){
			w_menu=w_label_area-(obj.w_current_tab_label_width||0)
		}
		var anim=W.AnimationNode("menu_animation",{transition_dt:0.15,w_menu:w_menu})
		w_label_area-=anim.w_menu
		UI.RoundRect({
			x:obj.x,y:obj.y,w:obj.w-w_label_area,h:obj.h_caption,
			color:obj.menu_bar_color,
			border_width:obj.menu_bar_border_width,
			border_color:obj.menu_bar_border_color,
		})
		if(obj.m_is_in_menu){
			//var is_1st=!obj.main_menu_bar;
			W.TopMenuBar("main_menu_bar",{x:obj.x+obj.w_menu_button+obj.padding*2,w:anim.w_menu,y:obj.y,h:obj.h_caption,
				default_value:obj.m_menu_preselect,
				owner:obj})
			//if(is_1st){
			//	UI.SetFocus(obj.main_menu_bar)
			//}
		}else{
			UI.m_frozen_global_menu=undefined
			obj.m_menu_preselect=undefined
			if(bk_menu){
				for(var i=0;i<bk_menu.$.length;i++){(function(i){
					var s_text=bk_menu.$[i].text
					if(s_text){
						var p_and=s_text.indexOf('&')
						if(p_and>=0){
							W.Hotkey("",{key:"ALT+"+s_text.substr(p_and+1,1).toUpperCase(),action:function(){
								obj.m_is_in_menu=1;
								obj.m_menu_preselect=i
								//g_menu_action_invoked=0;
								UI.m_frozen_global_menu=UI.m_global_menu
								UI.InvalidateCurrentFrame()
								UI.Refresh()
							}})
						}
					}
				})(i)}
			}
		}
		W.Button("main_menu_button",{
			x:obj.x+obj.padding,y:y_label_area+0.5*(obj.h_caption-obj.h_menu_button),w:obj.w_menu_button,h:obj.h_menu_button,
			style:obj.menu_button_style,
			tooltip:'Menu',
			font:UI.icon_font,text:"单",
			value:obj.m_is_in_menu,
			OnChange:function(value){
				obj.m_is_in_menu=value
				if(obj.m_is_in_menu){
					//g_menu_action_invoked=0;
					UI.m_frozen_global_menu=UI.m_global_menu
				}
			}})
		var x_label_area=obj.x+obj.w-w_label_area
		//tabs should not need ids
		//when closing, should change the "existing" ids for the effect...
		UI.PushCliprect(x_label_area,y_label_area,w_label_area,obj.h_caption)
		var x_acc=-(obj.scroll_x||0);
		var x_acc_abs=0,x_acc_abs_tabid=0;
		for(var i=0;i<n;i++){
			var item_i=items[i]
			var label_i=W.TabLabel(i,{x:x_label_area,x_animated:x_acc,y:y_label_area,h:obj.h_caption,selected:i==tabid, title:item_i.title})
			x_acc+=label_i.w;
			if(i==tabid){x_acc_abs_tabid=x_acc_abs;}
			x_acc_abs+=label_i.w
		}
		if(n>0){
			obj.scroll_x=Math.max(Math.min(
				x_acc_abs-w_label_area+8,
				x_acc_abs_tabid+(obj[tabid].w-w_label_area)*0.5),0)
			obj.w_current_tab_label_width=obj[tabid].w
		}else{
			obj.w_current_tab_label_width=0;
		}
		UI.PopCliprect()
		obj.h_content=obj.h-(obj.h_caption+obj.h_bar);
		obj.active_tab=obj.items[tabid]
		//share the tab wrapper and get rid of it when the tab switches
		if(obj.prev_tabid!=tabid){
			obj.prev_tabid=tabid
			obj.active_tab_obj=undefined
		}
		if(obj.active_tab){
			var tab=obj.active_tab;
			//theme-colored bar
			if(UI.current_theme_color!=tab.color_theme[0]){
				UI.Theme_Minimalistic(tab.color_theme)
			}
			W.RoundRect("",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
				x:0,y:y_label_area+obj.h_caption,h:obj.h_bar,
				color:obj.border_color})
			UI.PushSubWindow(obj.x,y_label_area+obj.h_caption+obj.h_bar,obj.w,obj.h_content)
			var n0_topmost=UI.RecordTopMostContext()
			var obj_tab=UI.Begin(UI.Keep("active_tab_obj",W.RoundRect("",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
				x:0,y:0,h:obj.h_content,tab:tab,
				color:obj.color
			})))
				tab.body.call(tab)
			UI.End()
			UI.FlushTopMostContext(n0_topmost)
			UI.PopSubWindow()
			if(obj_tab.body.title){
				if(tab.title!=obj_tab.body.title){
					tab.title=obj_tab.body.title
					UI.Refresh()
				}
			}
			W.SaveDialog("savedlg",{x:obj.x,y:obj.h_caption+obj.h_bar,w:obj.w,h:obj.h_content,value:(obj.active_tab.in_save_dialog||0),tabid:tabid,parent:obj})
		}
	UI.End()
	if(!obj.m_is_in_menu){
		if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
			W.Hotkey("",{key:"CTRL+F4",action:function(){
				var num_id=tabid
				if(num_id<0){return;}
				obj.CloseTab(num_id)
			}});
		}
		W.Hotkey("",{key:"CTRL+W",action:function(){
			var num_id=tabid
			if(num_id<0){return;}
			obj.CloseTab(num_id)
		}});
		W.Hotkey("",{key:"CTRL+TAB",action:function(){
			var num_id=tabid
			if(num_id<0){return;}
			num_id++;if(num_id>=items.length){num_id=0;}
			obj.current_tab_id=num_id
			UI.Refresh()
		}});
		W.Hotkey("",{key:"CTRL+SHIFT+TAB",action:function(){
			var num_id=tabid
			if(num_id<0){return;}
			if(!num_id){num_id=items.length;}
			num_id--;
			obj.current_tab_id=num_id
			UI.Refresh()
		}});
		for(var i=0;i<items.length&&i<10;i++){(function(i){
			W.Hotkey("",{key:"ALT+"+String.fromCharCode(48+(i+1)%10),action:function(){
				obj.current_tab_id=i
				UI.Refresh()
			}})
		})(i)}
	}
	UI.m_the_document_area=obj
	return obj
}

////////////////////////////////////////////////////////
W.SaveDialog_prototype={
	GetSubStyle:function(){
		return this.value?"active":"inactive"
	},
};
W.SaveDialog=function(id,attrs){
	//value: enabled-ness
	var obj=UI.StdWidget(id,attrs,"save_dialog",W.SaveDialog_prototype)
	UI.RoundRect(obj)
	UI.Begin(obj)
		//coulddo: use blur instead
		if(obj.value){
			var region=W.Region("savedlg_region",{x:obj.x,y:obj.y,w:obj.w,h:obj.h})
			UI.SetFocus(region)
			var s_text0=UI._("It's not saved yet, so...")
			var s_text_y=UI._("Save")
			var s_text_n=UI._("Don't save")
			var s_text_c=UI._("Cancel")
			var sz_text=UI.MeasureText(obj.font_text,s_text0)
			var sz_buttons=UI.MeasureText(obj.font_buttons,s_text_y)
			sz_buttons.w+=UI.MeasureText(obj.font_buttons,s_text_n).w
			sz_buttons.w+=UI.MeasureText(obj.font_buttons,s_text_c).w
			sz_buttons.w+=obj.space_button*2+obj.good_button_style.padding*2
			var h_content=obj.space_middle+sz_text.h+obj.h_button
			var y_text=obj.y+(obj.h-h_content)*0.5
			var y_buttons=y_text+sz_text.h+obj.space_middle
			var x_buttons=obj.x+(obj.w-sz_buttons.w)*0.5
			var w_dlg_rect=Math.max(sz_text.w,sz_buttons.w)+obj.space_dlg_rect*2
			var h_dlg_rect=h_content+obj.space_dlg_rect*2
			UI.RoundRect({x:obj.x+(obj.w-w_dlg_rect)*0.5,y:obj.y+(obj.h-h_dlg_rect)*0.5,w:w_dlg_rect,h:h_dlg_rect,
				round:obj.round_dlg_rect,border_width:-obj.round_dlg_rect,color:obj.color_dlg_rect
			})
			W.Text("",{x:obj.x+(obj.w-sz_text.w)*0.5,y:y_text, font:obj.font_text,text:s_text0,color:obj.text_color})
			var fyes=function(){
				obj.parent.SaveTab(obj.tabid)
				obj.parent.CloseTab(obj.tabid)
				obj.parent=undefined
				UI.Refresh()
			}
			var fno=function(){
				obj.parent.CloseTab(obj.tabid,"forced")
				obj.parent=undefined
				UI.Refresh()
			}
			var fcancel=function(){
				obj.parent.items[obj.tabid].in_save_dialog=0
				obj.parent.m_is_close_pending=0
				obj.parent=undefined
				UI.Refresh()
			}
			W.Button("btn_y",{x:x_buttons,y:y_buttons,h:obj.h_button, font:obj.font_buttons,text:s_text_y,style:obj.good_button_style,OnClick:fyes});
			x_buttons+=UI.MeasureText(obj.font_buttons,s_text_y).w+obj.space_button
			W.Button("btn_n",{x:x_buttons,y:y_buttons,h:obj.h_button, font:obj.font_buttons,text:s_text_n,style:obj.bad_button_style,OnClick:fno});
			x_buttons+=UI.MeasureText(obj.font_buttons,s_text_n).w+obj.space_button
			W.Button("btn_c",{x:x_buttons,y:y_buttons,h:obj.h_button, font:obj.font_buttons,text:s_text_c,style:obj.bad_button_style,OnClick:fcancel});
			W.Hotkey("",{key:"Y",action:fyes});W.Hotkey("",{key:"S",action:fyes});W.Hotkey("",{key:"RETURN",action:fyes})
			W.Hotkey("",{key:"N",action:fno});W.Hotkey("",{key:"D",action:fno})
			W.Hotkey("",{key:"ESC",action:fcancel});W.Hotkey("",{key:"C",action:fcancel})
			/////////////////
			//disable the side window as well
			UI.document_property_sheet={};
		}
	UI.End(obj)
}

////////////////////////////////////////////////////////
//text (colored), rubber, button, newline (with optional line-wide event)
//var g_menu_action_invoked=0;
var WrapMenuAction=function(action){
	if(!action){return action;}
	UI.HackCallback(action)
	return UI.HackCallback(function(){
		//g_menu_action_invoked=1;
		UI.SetFocus(null);
		UI.InvalidateCurrentFrame();
		UI.Refresh()
		action();
	});
}

W.CFancyMenuDesc=function(){
	this.$=[];
}
W.CFancyMenuDesc.prototype={
	AddNormalItem:function(attrs){
		var style=UI.default_styles['fancy_menu']
		var children=this.$
		children.push({type:'text',icon:attrs.icon,text:attrs.text,color:attrs.action?style.text_color:style.hotkey_color,sel_color:style.text_sel_color})
		if(attrs.action){attrs.action=WrapMenuAction(attrs.action);}
		var p_and=attrs.text.indexOf('&')
		if(p_and>=0&&attrs.action){
			//underlined hotkey
			children.push(
				{type:'hotkey',key:attrs.text.substr(p_and+1,1).toUpperCase(),action:attrs.action},
				{type:'hotkey',key:"ALT+"+attrs.text.substr(p_and+1,1).toUpperCase(),action:attrs.action})
		}
		if(attrs.key){
			children.push(
				{type:'rubber'},
				{type:'text',text:UI.LocalizeKeyName(attrs.key),color:style.hotkey_color,sel_color:style.hotkey_sel_color})
			if(attrs.enable_hotkey&&attrs.action){W.Hotkey("",{key:attrs.key,action:attrs.action})}
		}
		children.push({type:'newline',action:attrs.action})
	},
	//todo: selection widget - bind to some property
	AddButtonRow:function(attrs,buttons){
		var style=UI.default_styles['fancy_menu']
		var children=this.$
		children.push({type:'text',icon:attrs.icon,text:attrs.text,color:style.text_color,sel_color:style.text_sel_color},{type:'rubber'})
		for(var i=0;i<buttons.length;i++){
			var button_i=buttons[i]
			button_i.type='button';
			button_i.action=WrapMenuAction(button_i.action);
			children.push(button_i);
			/////////////////
			if(button_i.text){
				var p_and=button_i.text.indexOf('&')
				if(p_and>=0){
					//underlined hotkey
					children.push(
						{type:'hotkey',key:button_i.text.substr(p_and+1,1).toUpperCase(),action:button_i.action},
						{type:'hotkey',key:'ALT+'+button_i.text.substr(p_and+1,1).toUpperCase(),action:button_i.action})
				}
			}
			if(button_i.key){
				W.Hotkey("",{key:button_i.key,action:button_i.action})
			}
		}
		children.push({type:'newline'})
	},
	AddSeparator:function(){
		var children=this.$
		children.push({type:'separator'})
	}
}

UI.BigMenu=function(){
	var menu=UI.m_global_menu;
	var style=UI.default_styles['fancy_menu']
	for(var i=0;i<arguments.length;i++){
		var name=arguments[i]
		if(!menu[name]){
			//if(menu==UI.m_global_menu){
			//}else{
			//	menu.$.push(
			//		{type:'text',text:name,color:style.text_color},
			//		{type:'rubber'},
			//		{type:'text',text:'\u25B6',color:style.text_color},
			//		{type:'newline',action:function(){
			//			//where do we open submenus... left-down
			//			//need to think over how to do the "popup"
			//		}},
			//	)
			//}
			menu[name]=new W.CFancyMenuDesc()
			menu.$.push(
				{'type':'submenu','text':name,'menu':menu[name]}
			)
		}
		menu=menu[name];
	}
	return menu
}

//make the top menu horizontal and disable nested child menus? with scrollable menus... it should work
W.TopMenuItem=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "top_menu_item",obj.selected?"active":"inactive");
	var text_attrs={font:obj.font,text:obj.text,color:obj.text_color,flags:8}
	if(!text_attrs.__layout){UI.LayoutText(text_attrs);}
	obj.w=(obj.w||text_attrs.w_text+obj.padding*2);
	obj.h=(obj.h||text_attrs.h_text);
	UI.StdAnchoring(id,obj);
	UI.RoundRect(obj)
	UI.Begin(obj)
		text_attrs.x=obj.x+obj.padding
		text_attrs.y=obj.y+0.5*(obj.h-text_attrs.h_text)
		W.Text("",text_attrs)
		var owner=obj.owner
		var parent=owner.list_view
		var p_and=attrs.text.indexOf('&')
		if(p_and>=0){
			//hotkey - listview selection setting
			W.Hotkey("",{key:attrs.text.substr(p_and+1,1).toUpperCase(),action:function(){
				parent.OnChange(parseInt(obj.id.substr(1)))
				owner.m_show_sub_menus=1;
				UI.Refresh()
			}})
		}
		//the submenu
		if(obj.selected&&owner.m_show_sub_menus){
			//placement... leftmost left, other right
			UI.TopMostWidget(function(){
				var obj_submenu=W.FancyMenu("sub_menu_"+id,{
					x:id=='$0'?0:obj.x-4,y:owner.y+owner.h,
					desc:obj.menu,
					HideMenu:function(){owner.owner.m_is_in_menu=0;},
					parent_menu_list_view:owner.list_view,
				})
				UI.SetFocus(obj_submenu)
			})
		}
	UI.End()
	return obj;
}

W.TopMenuBar=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "top_menu");
	UI.StdAnchoring(id,obj);
	var desc=UI.m_frozen_global_menu
	//todo: search
	//var lv_items=[]
	//for(var i=0;i<desc.$.length;i++){
	//	var submenu_i=desc.$[i];
	//	if(submenu_i.object_type!='submenu'){throw new Error('only submenus allows at the top level')}
	//	lv_items[i]={'text':submenu_i.text}
	//}
	//UI.RoundRect(obj)
	UI.Begin(obj)
		var is_first=!obj.list_view
		var fshow_sub_menus=function(){
			obj.m_show_sub_menus=1
			UI.Refresh()
		}
		UI.PushCliprect(obj.x,obj.y+2,obj.w,obj.h-4)
		W.ListView('list_view',{x:obj.x,y:obj.y+2,w:obj.w,h:obj.h-4,
			dimension:'x',layout_spacing:8,is_single_click_mode:1,
			item_template:{object_type:W.TopMenuItem,owner:obj,OnDblClick:fshow_sub_menus},items:desc.$})
		UI.PopCliprect()
		if(!obj.m_show_sub_menus){
			W.Hotkey("",{key:"DOWN",action:fshow_sub_menus})
			W.Hotkey("",{key:"RETURN RETURN2",action:fshow_sub_menus})
			W.Hotkey("",{key:"ESC",action:function(){obj.owner.m_is_in_menu=0;UI.Refresh();}})
			if(is_first&&!obj.m_show_sub_menus){
				UI.SetFocus(obj.list_view);
			}
			if(is_first&&obj.default_value!=undefined){
				obj.list_view.OnChange(obj.default_value);
				obj.m_show_sub_menus=1
				UI.InvalidateCurrentFrame();
				UI.Refresh();
			}
			//if(g_menu_action_invoked){
			//	UI.SetFocus(null)
			//	g_menu_action_invoked=0;
			//}
		}
	UI.End()
	return obj;
}

W.FancyMenu_prototype={
	OnBlur:function(obj_new){
		if(!obj_new||Object.getPrototypeOf(obj_new)!=W.FancyMenu_prototype){
			this.HideMenu();
			UI.Refresh()
		}
	},
	OnKeyDown:function(event){
		var sel=(this.value||0)
		var n=Math.max(this.selectable_items.length,1)
		var IsHotkey=UI.IsHotkey
		if(0){
		}else if(IsHotkey(event,"UP")){
			//item id selection
			sel--
			if(sel<0){sel=n-1;}
			this.value=sel;
			UI.Refresh()
		}else if(IsHotkey(event,"DOWN")){
			sel++
			if(sel>=n){sel=0;}
			this.value=sel;
			UI.Refresh()
		}
		else if(IsHotkey(event,"LEFT")){
			var list_view=this.parent_menu_list_view
			n=list_view.items.length;
			sel=(list_view.value||0)
			sel--
			if(sel<0){sel=n-1;}
			list_view.OnChange(sel)
			UI.Refresh()
		}else if(IsHotkey(event,"RIGHT")){
			var list_view=this.parent_menu_list_view
			n=list_view.items.length;
			sel=(list_view.value||0)
			sel++
			if(sel>=n){sel=0;}
			list_view.OnChange(sel)
			UI.Refresh()
		}else if(IsHotkey(event,"ESC")){
			this.HideMenu();
			UI.Refresh()
		}else if(IsHotkey(event,"RETURN RETURN2")){
			this.desc.$[this.selectable_items[sel]].action()
			UI.Refresh()
		}
	},
};
W.FancyMenu=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.FancyMenu_prototype);
	UI.StdStyling(id,obj,attrs, "fancy_menu");
	var items=obj.desc.$
	var w_icon=obj.w_icon
	var x_icon=obj.side_padding
	if(!obj.w){
		//measure w,h, create rendering aid for the items... write in place
		var per_part_w=[]
		var part_id=0,w_acc=0,h_acc=0;
		for(var i=0;i<items.length;i++){
			var item_i=items[i]
			var s_type=item_i.type
			var dx=0;
			if(s_type=='text'){
				w_acc+=UI.MeasureText(obj.font,item_i.text.replace('&','')).w
			}else if(s_type=='button'){
				w_acc+=UI.MeasureText(obj.font,item_i.icon||item_i.text).w
				w_acc+=obj.button_padding*2
			}else if(s_type=='rubber'){
				per_part_w[part_id]=Math.max(per_part_w[part_id]||0,w_acc)
				part_id++
				w_acc=0
			}else if(s_type=='separator'){
				h_acc+=obj.h_separator
			}else if(s_type=='newline'){
				per_part_w[part_id]=Math.max(per_part_w[part_id]||0,w_acc)
				part_id=0
				w_acc=0
				h_acc+=obj.h_menu_line
			}
			//ignore 'hotkey'
		}
		var w_needed=obj.side_padding+w_icon
		for(var i=0;i<per_part_w.length;i++){
			w_needed+=per_part_w[i]+obj.column_padding
			per_part_w[i]=w_needed
		}
		w_needed+=obj.side_padding-obj.column_padding
		obj.w=w_needed
		obj.h=h_acc+obj.vertical_padding*2
		//compute x y w h everywhere, assign icon with text and draw it at 0,y
		var selectable_items=[]
		part_id=0;w_acc=obj.side_padding+w_icon;h_acc=obj.vertical_padding;
		for(var i=0;i<items.length;i++){
			var item_i=items[i]
			var s_type=item_i.type
			var dx=0;
			if(s_type=='text'){
				item_i.x=w_acc
				item_i.y=h_acc
				w_acc+=UI.MeasureText(obj.font,item_i.text.replace('&','')).w
			}else if(s_type=='button'){
				item_i.x=w_acc
				item_i.y=h_acc+(obj.h_menu_line-obj.h_button)*0.5
				w_acc+=obj.button_padding
				w_acc+=UI.MeasureText(obj.font,item_i.icon||item_i.text).w
				w_acc+=obj.button_padding
				item_i.w=w_acc-item_i.x
				item_i.h=obj.h_button
				selectable_items.push(i)
			}else if(s_type=='rubber'){
				w_acc=per_part_w[part_id]
				part_id++
			}else if(s_type=='separator'){
				item_i.x=obj.side_padding;
				item_i.y=h_acc+(obj.h_separator-obj.h_separator_fill)*0.5
				item_i.w=w_needed-obj.side_padding*2;
				h_acc+=obj.h_separator
				w_acc=obj.side_padding+w_icon;
			}else if(s_type=='newline'){
				var right_space=w_needed-w_acc-obj.side_padding
				if(right_space>0&&part_id>0){
					for(var j=i-1;j>=0;j--){
						var item_j=items[j]
						if(item_j.type=='newline'||item_j.type=='rubber'||item_j.type=='separator'){break;}
						if(item_j.x!=undefined){item_j.x+=right_space}
					}
				}
				item_i.x=obj.side_padding*0.5
				item_i.y=h_acc
				item_i.w=w_needed-obj.side_padding
				item_i.h=obj.h_menu_line
				part_id=0;
				w_acc=obj.side_padding+w_icon;
				h_acc+=obj.h_menu_line
				if(item_i.action){
					item_i.sel_id=selectable_items.length
					selectable_items.push(i)
				}
			}
			//again ignore 'hotkey'
		}
		obj.selectable_items=selectable_items
	}
	/////////////////
	UI.StdAnchoring(id,obj);
	UI.RoundRect({x:obj.x,y:obj.y,w:obj.w+obj.shadow_size,h:obj.h+obj.shadow_size,
		color:obj.shadow_color,
		border_width:-obj.shadow_size,round:obj.shadow_size})
	UI.RoundRect(obj)
	W.PureRegion(id,obj);
	UI.Begin(obj)
	var hc=UI.GetCharacterHeight(obj.font)
	var hc_icon=UI.GetCharacterHeight(UI.icon_font_20)
	var sel_id1=obj.selectable_items[obj.value||0]
	var sel_id0=sel_id1
	if(items[sel_id1].type=='newline'){
		sel_id0--
		while(sel_id0>=0&&items[sel_id0].type!='newline'){
			sel_id0--;
		}
		sel_id0++
	}
	for(var i=0;i<items.length;i++){
		var item_i=items[i]
		var s_type=item_i.type
		var dx=0;
		var selected=(i>=sel_id0&&i<=sel_id1)
		if(sel_id0<sel_id1&&i==sel_id0){
			var item_sel1=items[sel_id1]
			UI.RoundRect({x:obj.x+item_sel1.x,y:obj.y+item_sel1.y,w:item_sel1.w,h:item_sel1.h,
				color:obj.sel_bgcolor,
			})
		}
		if(s_type=='text'){
			W.Text("",{x:obj.x+item_i.x,y:obj.y+item_i.y+(obj.h_menu_line-hc)*0.5,font:obj.font,text:item_i.text,color:selected?item_i.sel_color:item_i.color,flags:8})
			if(item_i.icon){
				W.Text("",{x:obj.x+x_icon,y:obj.y+item_i.y+(obj.h_menu_line-hc_icon)*0.5,font:UI.icon_font_20,text:item_i.icon,
					color:selected?item_i.sel_color:item_i.color})
			}
		}else if(s_type=='button'){
			W.Button(item_i.text,{x:obj.x+item_i.x,y:obj.y+item_i.y,w:item_i.w,h:item_i.h,
				font:item_i.icon?obj.button_style.icon_font:obj.button_style.font,text:item_i.icon||item_i.text,OnClick:item_i.action,
				value:selected,
				show_tooltip_override:selected,
				style:obj.button_style,
				tooltip:item_i.tooltip,
				flags:8})
		}else if(s_type=='separator'){
			UI.RoundRect({x:obj.x+item_i.x,y:obj.y+item_i.y,w:item_i.w,h:obj.h_separator_fill,
				color:obj.separator_color,
			})
		}else if(s_type=='newline'){
			if(item_i.action){
				W.Region("line_"+i.toString(),{
					x:obj.x+item_i.x,y:obj.y+item_i.y,w:item_i.w,h:item_i.h,
					OnClick:item_i.action,
					sel_id:item_i.sel_id,
					OnMouseOver:function(){obj.value=this.sel_id;UI.Refresh()}})
			}
		}else if(s_type=='hotkey'){
			W.Hotkey("",{key:item_i.key,action:item_i.action})
		}
	}
	UI.End()
	return obj
}

//todo: search support

///////////////////////
UI.m_new_document_search_path=IO.GetNewDocumentName(undefined,undefined,"document");
UI.UpdateNewDocumentSearchPath=function(){
	if(!UI.m_the_document_area){return;}
	var active_document=UI.m_the_document_area.active_tab
	var ret=undefined;
	if(active_document&&active_document.file_name){
		ret=UI.GetPathFromFilename(active_document.file_name)
	}
	if(!ret){
		ret=IO.GetNewDocumentName(undefined,undefined,"document");
	}
	UI.m_new_document_search_path=ret
	return ret
}
