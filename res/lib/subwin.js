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
		var tab=this.items[tabid]
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
	}
}
W.TabbedDocument=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabbedDocument_prototype);
	UI.StdStyling(id,obj,attrs, "tabbed_document");
	UI.StdAnchoring(id,obj);
	var items=obj.items
	if((obj.n_tabs_last_checked||0)<items.length){
		//new tab activating
		obj.current_tab_id=(items.length-1);
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
		UI.m_global_menu=new W.CFancyMenuDesc()
		w_label_area-=obj.w_menu_button+obj.padding*2
		if(obj.m_is_in_menu){
			w_menu=w_label_area-(obj.w_current_tab_label_width||0)
		}
		var anim=W.AnimationNode("menu_animation",{transition_dt:0.15,w_menu:w_menu})
		w_label_area-=anim.w_menu
		UI.RoundRect({
			x:obj.x,y:obj.y,w:obj.w-w_label_area,h:obj.h_caption,
			color:[{x:0,y:0,color:0xffffffff},{x:0,y:1,color:0xffd0d0d0}],
			border_width:1,
			border_color:0xff444444,
		})
		if(obj.m_is_in_menu){
			W.TopMenuBar("main_menu_bar",{x:obj.x+obj.w_menu_button+obj.padding*2,w:anim.w_menu,y:obj.y,h:obj.h_caption})
		}
		W.Button("main_menu_button",{
			x:obj.x+obj.padding,y:y_label_area+0.5*(obj.h_caption-obj.h_menu_button),w:obj.w_menu_button,h:obj.h_menu_button,
			style:obj.menu_button_style,
			font:UI.icon_font,text:"单",
			value:obj.m_is_in_menu,
			OnChange:function(value){
				obj.m_is_in_menu=value
				if(obj.m_is_in_menu){
					UI.m_frozen_global_menu=UI.m_global_menu
				}else{
					UI.m_frozen_global_menu=undefined
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
			var obj_tab=UI.Begin(UI.Keep("active_tab_obj",W.RoundRect("",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
				x:0,y:0,h:obj.h_content,tab:tab,
				color:obj.color
			})))
				tab.body.call(tab)
			UI.End()
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
W.CFancyMenuDesc=function(){
	this.$=[];
}
W.CFancyMenuDesc.prototype={
	AddNormalItem:function(attrs){
		var style=UI.default_styles['fancy_menu']
		var children=this.$
		children.push({type:'text',text:attrs.text,color:style.text_color})
		var p_and=attrs.text.indexOf('&')
		if(p_and>=0){
			//underlined hotkey
			children.push(
				{type:'hotkey',key:attrs.text.substr(p_and+1,1).toUpperCase(),action:attrs.action})
		}
		if(attrs.key){
			children.push(
				{type:'rubber'},
				{type:'text',text:UI.LocalizeKeyName(attrs.key),color:style.hotkey_color})
			if(attrs.enable_hotkey){W.Hotkey("",{key:attrs.key,action:attrs.action})}
		}
		children.push({type:'newline',action:attrs.action})
	},
	AddButtonRow:function(s_text,buttons){
		var style=UI.default_styles['fancy_menu']
		var children=this.$
		children.push({type:'text',text:s_text,color:style.text_color},{type:'rubber'})
		for(var i=0;i<buttons.length;i++){
			var button_i=buttons[i]
			button_i.type='button';
			children.push(button_i);
		}
		children.push({type:'newline'})
	},
	AddSeparator:function(){
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
			//			//todo: where do we open submenus... left-down
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
	UI.End()
	var parent=obj.owner.list_view
	//todo: hotkey, menu popup, search - listview selection setting
	return obj;
}

W.TopMenuBar=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "top_menu");
	UI.StdAnchoring(id,obj);
	var desc=UI.m_frozen_global_menu
	//var lv_items=[]
	//for(var i=0;i<desc.$.length;i++){
	//	var submenu_i=desc.$[i];
	//	if(submenu_i.object_type!='submenu'){throw new Error('only submenus allows at the top level')}
	//	lv_items[i]={'text':submenu_i.text}
	//}
	//UI.RoundRect(obj)
	UI.Begin(obj)
		W.ListView('list_view',{x:obj.x,y:obj.y+2,w:obj.w,h:obj.h-4,
			 dimension:'x',layout_spacing:8,
			 item_template:{object_type:W.TopMenuItem,owner:obj},items:desc.$})
	UI.End()
	return obj;
}

//todo: notification system
