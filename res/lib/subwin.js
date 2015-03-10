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
	obj.x=obj.x_animated
	UI.StdAnchoring(id,obj);
	UI.Begin(obj)
		if(obj.selected){
			UI.RoundRect({
				x:obj.x-obj.shadow_size,y:obj.y-obj.shadow_size,w:obj.w+obj.shadow_size*2,h:obj.h+obj.shadow_size*2,
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

W.TabbedDocument=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "tabbed_document");
	UI.StdAnchoring(id,obj);
	var items=obj.items
	if((obj.n_tabs_last_checked||0)<items.length){
		//new tab activating
		obj.current_tab_id=(items.length-1);
		obj.n_tabs_last_checked=items.length;
	}
	UI.Begin(obj)
		var sel={}
		var tabid=(obj.current_tab_id||0);
		sel[tabid]=1
		var n=items.length
		//tabs should not need ids
		//when closing, should change the "existing" ids for the effect...
		UI.PushCliprect(obj.x,obj.y,obj.w,obj.h_caption)
		var x_acc=-(obj.scroll_x||0);//obj.scroll_x_animated;
		for(var i=0;i<n;i++){
			var item_i=items[i]
			var label_i=W.TabLabel(i,{x_animated:x_acc,y:obj.y,h:obj.h_caption,selected:i==tabid, title:item_i.title})
			x_acc+=label_i.w;
		}
		if(n>0){obj.scroll_x=Math.max(Math.min(x_acc-obj.w,obj[tabid].x+(obj[tabid].w-obj.w)*0.5),0)}
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
				x:0,y:obj.h_caption,h:obj.h_bar,
				color:obj.border_color})
			UI.SwitchToSubWindow(obj.x,obj.h_caption+obj.h_bar,obj.w,obj.h_content)
			var obj_tab=UI.Begin(UI.Keep("active_tab_obj",W.RoundRect("",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
				x:0,y:0,h:obj.h_content,
				color:obj.color
			})))
				tab.body.call(tab)
			UI.End()
			UI.SwitchToSubWindow()
			if(obj_tab.body.title){
				if(tab.title!=obj_tab.body.title){
					tab.title=obj_tab.body.title
					UI.Refresh()
				}
			}
		}
	UI.End()
	W.Hotkey("",{key:"CTRL+TAB",action:UI.HackCallback(function(){
		var num_id=tabid
		if(num_id<0){return;}
		num_id++;if(num_id>=items.length){num_id=0;}
		obj.current_tab_id=num_id
		UI.Refresh()
	})});
	W.Hotkey("",{key:"CTRL+SHIFT+TAB",action:UI.HackCallback(function(){
		var num_id=tabid
		if(num_id<0){return;}
		if(!num_id){num_id=items.length;}
		num_id--;
		obj.current_tab_id=num_id
		UI.Refresh()
	})});
	return obj
}
