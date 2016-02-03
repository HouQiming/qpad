var UI=require("gui2d/ui");
var W=require("gui2d/widgets");

///////////////////////
UI.interpolators["tabid"]=function(a,b,t){return b;}
W.TabLabel_prototype={
	title:"",//initial empty title
	mouse_state:'out',
	OnMouseOver:function(){this.mouse_state="over";UI.Refresh();},
	OnMouseOut:function(){this.mouse_state="out";UI.Refresh();},
	GetSubStyle:function(){
		return this.mouse_state
	},
	OnMouseDown:function(event){
		if(this.tabid==undefined){return;}
		if(event.clicks!=2){
			UI.CaptureMouse(this);
			this.owner.OnTabDown(this.tabid,event,this.x,this.y)
		}
	},
	OnMouseMove:function(event){
		if(this.tabid==undefined){return;}
		this.owner.OnTabMove(this.tabid,event)
	},
	OnMouseUp:function(event){
		if(this.tabid==undefined){return;}
		this.owner.OnTabMove(this.tabid,event)
		if(event.clicks==2){
			this.owner.CancelTabDragging();
		}else{
			this.owner.OnTabUp(this.tabid)
			this.tabid=undefined;
		}
		UI.ReleaseMouse(this);
	},
	OnClick:function(event){
		if(event.clicks==2&&this.tabid!=undefined){
			this.owner.ArrangeTabs(this.tabid)
		}
	},
}
W.TabLabel=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabLabel_prototype);
	UI.StdStyling(id,obj,attrs, "tab_label",obj.selected?"active":"inactive");
	//if(!attrs.w){
	//	obj.text=obj.title;
	//	obj.w=UI.MeasureIconText(obj).w;
	//}
	//obj.x+=obj.x_animated
	if(attrs.x==undefined){
		obj.x=obj.x_animated;
	}
	UI.StdAnchoring(id,obj);
	W.PureRegion(id,obj)
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
		if(obj.hotkey_str){
			var dims=UI.MeasureText(obj.hotkey_font,obj.hotkey_str)
			W.Text("",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"up",
				'x':obj.padding-dims.w-2,'y':6,
				'font':obj.hotkey_font,'text':obj.hotkey_str,
				'color':UI.lerp_rgba(obj.text_color&0xffffff,obj.text_color,0.5),
			})
		}
		W.Text("",{
			'anchor':'parent','anchor_align':"center",'anchor_valign':"center",
			'x':0,'y':0,
			'font':obj.font,'text':obj.title,'color':obj.text_color,
		})
		if(obj.mouse_state=="over"&&obj.tooltip){
			W.DrawTooltip(obj)
		}
	UI.End()
	return obj
}

UI.MAX_TAB_SWITCH_COUNT=32
UI.IncrementTabSwitchCount=function(counts,fn,delta0){
	var n_tot=(counts["$"]||0)
	var delta=Math.max(delta0,n_tot*delta0/UI.MAX_TAB_SWITCH_COUNT|0)
	n_tot+=delta
	counts["$"]=n_tot;
	var n=(counts[fn]||0)
	counts[fn]=n+delta;
	if(n_tot>UI.MAX_TAB_SWITCH_COUNT*1024){
		n_tot=0
		for(var key in counts){
			if(key=="$"){continue;}
			counts[key]=Math.max((counts[key]/1024)|0,1);
			n_tot+=counts[key];
		}
		counts["$"]=n_tot;
	}
}

UI.m_closed_windows=[];
var GetTabFileName=function(tab1){
	var fn=tab1.file_name
	if(tab1.main_widget&&tab1.main_widget.file_name){fn=tab1.main_widget.file_name}
	return fn;
}
var segDist=function(x0,x1,x){
	return x<x0?x0-x:Math.max(x-x1,0);
};
W.TabbedDocument_prototype={
	//closer -> class: OnClose notification and stuff
	CloseTab:function(tabid,forced){
		if(tabid==undefined){tabid=this.current_tab_id}
		if(tabid==undefined){return;}
		var tab=this.items[tabid]
		if(!tab){return;}
		if(tab.need_save&&!forced){
			//this doesn't count as a meaningful switch
			this.current_tab_id=tabid
			//dialog box
			tab.in_save_dialog=1
			UI.Refresh()
			return;
		}
		///////
		var fntab=GetTabFileName(tab);
		UI.m_closed_windows=UI.m_closed_windows.filter(UI.HackCallback(function(fn){return fn!=fntab}))
		UI.m_closed_windows.push(fntab);
		//close it
		if(!tab.need_save){
			tab.SaveMetaData();
			UI.SaveMetaData();
		}
		var window_list=this.items
		var n2=tabid;
		for(var i=tabid+1;i<window_list.length;i++){
			window_list[n2]=window_list[i]
			this[n2]=this[i];
			n2++;
		}
		this[window_list.length-1]=undefined;
		window_list.pop()
		if(this.just_created_a_tab){
			//just closed, go to previous tab
			if(this.current_tab_id>=tabid){this.current_tab_id--}
		}else{
			//switched, go to next tab
			if(this.current_tab_id>tabid){this.current_tab_id--}
		}
		this.just_created_a_tab=0;
		if(this.current_tab_id>=this.items.length){this.current_tab_id--}
		//this doesn't count as a meaningful switch
		if(this.current_tab_id<0){this.current_tab_id=0;}
		if(tab.OnDestroy){tab.OnDestroy()}
		this.CancelTabDragging();
		if(!this.m_is_close_pending){
			UI.SaveWorkspace();
		}
		UI.Refresh()
		UI.CallGCLater()
		//if(UI.Platform.BUILD=="debug"){
		//	print(">>> window closed");
		//	Duktape.gc();
		//	UI.dumpMemoryUsage();
		//}
	},
	SetTab:function(tabid){
		var tabid0=this.current_tab_id
		if(tabid0!=undefined){
			var tab0=this.items[tabid0]
			var tab1=this.items[tabid]
			if(tab0&&tab1){
				if(tab0.main_widget&&tab0.main_widget.m_tabswitch_count&&tab1.file_name){
					var fn=GetTabFileName(tab1);
					var counts=tab0.main_widget.m_tabswitch_count
					UI.IncrementTabSwitchCount(counts,fn,1)
				}
			}
		}
		if(this.current_tab_id!=tabid){
			//for close hack
			this.just_created_a_tab=0;
		}
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
	SaveAs:function(){
		var active_document=this.active_tab;
		active_document.SaveAs()
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
				if(ret==0){
					//this doesn't count as a meaningful switch
					this.just_created_a_tab=0;
					this.current_tab_id=i;
					tab_i.in_save_dialog=1
				}
				ret=1
			}//else{
			tab_i.SaveMetaData()
			//}
		}
		if(ret==0){
			if(!this.m_is_close_pending){
				UI.SaveWorkspace();
			}
		}else{
			this.m_is_close_pending=1
			UI.Refresh()
			return ret;
		}
		var window_list=this.items
		var n2=0;
		for(var i=0;i<window_list.length;i++){
			var tab_i=window_list[i]
			if(tab_i.need_save){
				window_list[n2]=tab_i;
				this[n2]=this[i];
				n2++;
			}else{
				if(this.current_tab_id>i){this.current_tab_id--}
			}
		}
		while(window_list.length>n2){
			this[window_list.length-1]=undefined;
			window_list.pop();
		}
		//this doesn't count as a meaningful switch
		if(this.current_tab_id>=this.items.length){this.current_tab_id--}
		if(this.current_tab_id<0){this.current_tab_id=0;}
		UI.SaveMetaData()
		UI.Refresh()
		this.just_created_a_tab=0;
		this.m_is_close_pending=1
		return ret
	},
	SetMenuState:function(value){
		if(this.m_is_in_menu==value){return;}
		this.m_is_in_menu=value;
		if(this.m_is_in_menu){
			//g_menu_action_invoked=0;
			UI.m_frozen_global_menu=UI.m_global_menu
			UI.m_frozen_global_menu.bk_tabbar_scroll_x=this.scroll_x
		}else{
			if(UI.m_frozen_global_menu){
				this.scroll_x=UI.m_frozen_global_menu.bk_tabbar_scroll_x;
			}
			UI.m_frozen_global_menu=undefined;
		}
		UI.Refresh()
	},
	OnMenu:function(){
		this.SetMenuState(!this.m_is_in_menu);
		UI.Refresh()
	},
	OnWindowBlur:function(){
		this.SetMenuState(0);
		UI.Refresh()
	},
	////////////
	OnTabDown:function(tabid,event,x_label,y_label){
		if(event.button==UI.SDL_BUTTON_MIDDLE){
			this.CloseTab(tabid)
			return;
		}else{
			this.SetTab(tabid)
		}
		//create a current tab label x snapshot
		this.m_dragging_caption_areas=this.m_caption_areas;
		this.m_dragging_tab_moved=0
		this.m_dragging_tab_x_offset=event.x-x_label;
		this.m_dragging_tab_y_offset=event.y-y_label;
		this.m_dragging_tab_src_tabid=tabid
		this.m_dragging_tab_target=undefined;
		/////////////
		var caption_areas=this.m_dragging_caption_areas;
		for(var i=0;i<caption_areas.length;i++){
			var area_i=caption_areas[i];
			for(var j=0;j<area_i.tabs.length;j++){
				var tabid_j=area_i.tabs[j];
				if(tabid_j==tabid){
					area_i.has_dragging_src=1;
				}
			}
		}
	},
	OnTabMove:function(tabid,event){
		var caption_areas=this.m_dragging_caption_areas;
		if(caption_areas==undefined){return;}
		var target_position=undefined;
		this.m_dragging_mouse_x=event.x;
		this.m_dragging_mouse_y=event.y;
		for(var i=0;i<caption_areas.length;i++){
			var area_i=caption_areas[i];
			if(segDist(area_i.y,area_i.y+area_i.h,event.y)<this.caption_drag_tolerance_y){
				for(var j=0;j<area_i.tabs.length;j++){
					var tabid_j=area_i.tabs[j];
					var x0_j=area_i.x0_w_tabs[j*2];
					var x1_j=x0_j+area_i.x0_w_tabs[j*2+1];
					var dist=segDist(x0_j,x1_j,event.x);
					//dist<this.caption_drag_tolerance_x
					if(target_position==undefined||target_position.score>dist){
						//source area / other area
						var side=0;
						if(area_i.has_dragging_src){
							side=(tabid_j<=this.m_dragging_tab_src_tabid?0:1);
						}else{
							side=(event.x<(x0_j+x1_j)*0.5?0:1);
						}
						if(side==0){
							target_position={
								score:dist,area_id:i,tabid:tabid_j,
							}
						}else{
							target_position={
								score:dist,area_id:i,tabid:this.items.length,
							}
						}
					}
				}
			}
			//window splitting check - cross-split
			var box=area_i.content_box;
			if(box.w>0&&box.h>0){
				var dist=segDist(box.x,box.x+box.w,event.x)+segDist(box.y,box.y+box.h,event.y);
				if(target_position==undefined||target_position.score>dist){
					//source area / other area
					var fx=(event.x-box.x)/box.w;
					var fy=(event.y-box.y)/box.h;
					var side=undefined;
					if(fx<fy){
						if(fx<1-fy){
							side="left";
						}else{
							side="down";
						}
					}else{
						if(fx<1-fy){
							side="up";
						}else{
							side="right";
						}
					}
					target_position={
						score:dist,name:area_i.name,area_id:i,
						split_side:side,
					}
				}
			}
		}
		if(target_position&&target_position.tabid==this.m_dragging_tab_src_tabid){
			target_position=undefined;
		}
		if(target_position){
			this.m_dragging_tab_moved=1;
		}
		this.m_dragging_tab_target=target_position;
		//create caption rendering context
		//active tab, tar-area after, src-area after potential split shade
		var tab_label_style=UI.default_styles.tab_label;
		var rendering_caption_areas=[];
		var tar_added=0;
		for(var i=0;i<caption_areas.length;i++){
			var area_i=caption_areas[i];
			var x_caption=area_i.x;
			var out_area_i={};out_area_i.__proto__=area_i;
			out_area_i.x0_w_tabs=[];
			for(var j=0;j<area_i.tabs.length;j++){
				var tabid_j=area_i.tabs[j];
				if(target_position&&tabid_j==this.m_dragging_tab_src_tabid){
					out_area_i.x0_w_tabs[j*2]=undefined;
					out_area_i.x0_w_tabs[j*2+1]=undefined;
					continue
				}else if(target_position&&!tar_added&&i==target_position.area_id&&target_position.tabid!=undefined&&tabid_j>=target_position.tabid){
					//add target
					var w_src_at_target=UI.MeasureText(tab_label_style.font,this.items[this.m_dragging_tab_src_tabid].title).w+tab_label_style.padding*2;
					x_caption+=w_src_at_target;
				}
				var w_j=UI.MeasureText(tab_label_style.font,this.items[tabid_j].title).w+tab_label_style.padding*2;
				out_area_i.x0_w_tabs[j*2]=x_caption;
				out_area_i.x0_w_tabs[j*2+1]=w_j;
				x_caption+=w_j;
			}
			rendering_caption_areas[i]=out_area_i;
		}
		this.m_dragging_rendering_caption_areas=rendering_caption_areas;
		UI.Refresh()
	},
	OnTabUp:function(tabid){
		if(this.m_dragging_caption_areas==undefined){return;}
		this.m_dragging_caption_areas=undefined;
		this.m_dragging_rendering_caption_areas=undefined;
		if(!this.m_dragging_tab_moved||!this.m_dragging_tab_target){
			//this.SetTab(tabid)
		}else{
			//get old names, generate new once
			var target_position=this.m_dragging_tab_target;
			if(target_position.split_side){
				//actually split, shuffle the object
				!?
			}else{
				//put at target_position.tabid
				!?
			}
			return//todo
			var dstid=this.m_dragging_tab_dst_tabid
			var srcid=this.m_dragging_tab_src_tabid
			var item_src=this.items[srcid]
			var label_src=this[srcid]
			var tabid_new=this.current_tab_id;
			if(srcid<dstid){
				for(j=srcid+1;j<=dstid;j++){
					this.items[j-1]=this.items[j]
					this[j-1]=this[j]
					if(this.current_tab_id==j){tabid_new=j-1;}
				}
			}else{
				for(j=srcid-1;j>=dstid;j--){
					this.items[j+1]=this.items[j]
					this[j+1]=this[j]
					if(this.current_tab_id==j){tabid_new=j+1;}
				}
			}
			if(this.current_tab_id==srcid){tabid_new=dstid;}
			this.just_created_a_tab=0;
			this.current_tab_id=tabid_new
			this.items[dstid]=item_src
			this[dstid]=label_src
			UI.Refresh()
		}
	},
	CancelTabDragging:function(){
		if(this.m_dragging_caption_areas==undefined){
			this.m_dragging_caption_areas=undefined
			if(UI.nd_captured){UI.ReleaseMouse(UI.nd_captured)}
		}
	},
	ArrangeTabs:function(tabid){
		if(tabid==undefined){tabid=this.current_tab_id;}
		if(!(tabid>=0&&tabid<this.items.length)){return;}
		var sname0=GetTabFileName(this.items[tabid]);
		var bk_ui_item=[];
		for(var i=0;i<this.items.length;i++){
			var item_i=this.items[i];
			var sname_i=GetTabFileName(item_i);
			item_i.m_id_original=i;
			item_i.m_arrangement_score=Duktape.__commonPrefixLength(sname0,sname_i);
			if(i==tabid){item_i.m_arrangement_score=1e15;}
			bk_ui_item[i]=this[i];
		}
		this.items.sort(function(a,b){return b.m_arrangement_score-a.m_arrangement_score||a.m_id_original-b.m_id_original})
		//reshuffle UI items
		for(var i=0;i<this.items.length;i++){
			var item_i=this.items[i];
			this[i]=bk_ui_item[item_i.m_id_original];
			item_i.m_id_original=undefined;
			item_i.m_arrangement_score=undefined;
		}
		this.just_created_a_tab=0;
		this.current_tab_id=0;
		UI.Refresh()
	},
}
var RenderLayout=function(layout,obj){
	//per-tab z_order, sort and reset on workspace save / restore
	var windows_to_render={};
	var items=obj.items;
	if(obj.active_tab){
		if(obj.active_tab.z_order!=UI.g_current_z_value-1){
			obj.active_tab.z_order=UI.g_current_z_value;
			UI.g_current_z_value++;
		}
	}
	for(var i=0;i<items.length;i++){
		var area_name=(items[i].area_name||"doc_default");
		var z_i=(items[i].z_order||0);
		if(!windows_to_render[area_name]||windows_to_render[area_name].z_order<=z_i){
			windows_to_render[area_name]=items[i];
		}
	}
	//dfs layout - is-there test
	var dfsIsThere=UI.HackCallback(function(nd){
		var is_there=0;
		if(nd.type=="hsplit"||nd.type=="vsplit"){
			for(var i=0;i<nd.children.length;i++){
				is_there|=dfsIsThere(nd.children[i]);
			}
		}else if(nd.type=="doc"){
			is_there=1;
		}else{
			is_there=(!!windows_to_render[nd.name]);
		}
		nd.temp_is_there=is_there;
		return is_there;
	});
	dfsIsThere(layout)
	var rendered_areas=[];
	//todo: animated area sizes?
	var dfsRender=UI.HackCallback(function(nd,x,y,w,h){
		if(nd.type=="hsplit"||nd.type=="vsplit"){
			var ch0=nd.children[0];
			var ch1=nd.children[1];
			if(ch0.temp_is_there&&ch1.temp_is_there){
				var split=nd.split;
				if(nd.type=="hsplit"){
					dfsRender(ch0,x,y,w*split,h);
					dfsRender(ch1,x+w*split,y,w-w*split,h);
				}else{
					dfsRender(ch0,x,y,w,h*split);
					dfsRender(ch1,x,y+h*split,w,h-h*split);
				}
			}else{
				dfsRender(ch0.temp_is_there?ch0:ch1,x,y,w,h);
			}
		}else{
			//compute undragged layout
			var tab=windows_to_render[nd.name];
			if(tab){
				var h_content=h-(obj.h_caption+obj.h_bar);
				if(h_content>0){
					rendered_areas.push({name:nd.name,x:x,y:y,w:w,h:h})
					W.RoundRect("",{
						'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
						x:x,y:y+obj.h_caption,h:obj.h_bar,
						color:obj.border_color})
					UI.PushSubWindow(x,y+obj.h_caption+obj.h_bar,w,h_content)
					var n0_topmost=UI.RecordTopMostContext()
					var s_wrapper_name="active_tab_obj_"+nd.name;
					if(obj[s_wrapper_name]&&obj[s_wrapper_name].tab!=tab){
						//destroy stale the tab wrapper
						obj[s_wrapper_name]=undefined;
					}
					var obj_tab=UI.Begin(UI.Keep(s_wrapper_name,W.RoundRect("",{
						x:0,y:0,w:w,h:h_content,tab:tab,
					})))
						tab.body.call(tab)
					UI.End()
					UI.FlushTopMostContext(n0_topmost)
					UI.PopSubWindow()
					tab.tooltip=obj_tab.body.tooltip
					if(obj_tab.body.title){
						if(tab.title!=obj_tab.body.title){
							tab.title=obj_tab.body.title
							UI.Refresh()
						}
					}
					var tabid=(obj.current_tab_id||0);
					W.SaveDialog("savedlg",{x:x,y:y+obj.h_caption+obj.h_bar,w:w,h:h_content,
						value:(tab.in_save_dialog||0),tabid:tabid,parent:obj})
				}
			}
		}
		nd.temp_is_there=undefined
	});
	dfsRender(layout,obj.x,obj.y,obj.w,obj.h)
	return [rendered_areas,windows_to_render];
}

W.TabbedDocument=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabbedDocument_prototype);
	UI.StdStyling(id,obj,attrs, "tabbed_document");
	UI.StdAnchoring(id,obj);
	var items=obj.items
	var layout=UI.m_ui_metadata["<layout>"];
	if(!layout||typeof(layout)!='object'){
		layout=JSON.parse(IO.UIReadAll("res/misc/default_layout.json"));
		UI.m_ui_metadata["<layout>"]=layout;
	}
	if((obj.n_tabs_last_checked||0)<items.length){
		//new tab activating
		//this doesn't count as a meaningful switch
		//obj.current_tab_id=(items.length-1);
		obj.SetMenuState(0);
		obj.CancelTabDragging();
		UI.SaveWorkspace();
		//if(UI.Platform.BUILD=="debug"){
		//	print(">>> window opened");
		//	Duktape.gc();
		//	UI.dumpMemoryUsage();
		//}
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
		var w_menu_button=obj.w_menu_button+obj.padding*2;
		var w_menu=w_menu_button;
		//the big menu
		var bk_menu=UI.m_global_menu
		UI.m_global_menu=new W.CFancyMenuDesc()
		UI.BigMenu("&File");
		if(obj.m_is_in_menu){
			w_menu=obj.w;
		}
		var anim=W.AnimationNode("menu_animation",{transition_dt:0.15,w_menu:w_menu})
		//menu shadow goes below tab label
		UI.RoundRect({
			x:obj.x+w_menu-obj.menu_bar_shadow_size,y:obj.y-obj.menu_bar_shadow_size*0.5,
			w:obj.menu_bar_shadow_size*2,h:obj.h_caption+obj.menu_bar_shadow_size*1.5,
			round:obj.menu_bar_shadow_size,
			border_width:-obj.menu_bar_shadow_size,
			color:obj.menu_bar_shadow_color,
		})
		if(obj.m_is_in_menu){
			//var is_1st=!obj.main_menu_bar;
			//but menu *bar* goes *above* the tab labels
			//if(is_1st){
			//	UI.SetFocus(obj.main_menu_bar)
			//}
		}else{
			UI.RoundRect({
				x:obj.x,y:obj.y,w:w_menu,h:obj.h_caption,
				color:obj.menu_bar_color,
				border_width:obj.menu_bar_border_width,
				border_color:obj.menu_bar_border_color,
			})
			UI.m_frozen_global_menu=undefined
			obj.m_menu_preselect=undefined
			if(bk_menu){
				for(var i=0;i<bk_menu.$.length;i++){
					var s_text=bk_menu.$[i].text
					if(s_text){
						var p_and=s_text.indexOf('&')
						if(p_and>=0){
							W.Hotkey("",{key:(UI.Platform.ARCH=="mac"?"ALT+WIN+":"ALT+")+s_text.substr(p_and+1,1).toUpperCase(),action:
								(function(obj,i){
									obj.m_menu_preselect=i;
									obj.SetMenuState(1);
									UI.InvalidateCurrentFrame()
									UI.Refresh()
								}).bind(null,obj,i)})
						}
					}
				}
			}
		}
		W.Button("main_menu_button",{
			x:obj.x+obj.padding,y:y_label_area+0.5*(obj.h_caption-obj.h_menu_button),w:obj.w_menu_button,h:obj.h_menu_button,
			style:obj.menu_button_style,
			tooltip:'Menu',
			font:UI.icon_font,text:"单",
			value:obj.m_is_in_menu,
			OnChange:function(value){
				obj.SetMenuState(value);
			}})
		obj.active_tab=items[tabid]
		//render the main layout
		var tmp_ret=RenderLayout(layout,obj)
		var rendered_areas=tmp_ret[0];
		var windows_to_render=tmp_ret[1];
		//compute the caption layout
		var rendered_area_by_name={};
		for(var i=0;i<rendered_areas.length;i++){
			var area_i=rendered_areas[i];
			rendered_area_by_name[area_i.name]=area_i;
			area_i.content_box={x:area_i.x,y:area_i.y+obj.h_caption+obj.h_bar,w:area_i.w,h:Math.max(area_i.h-(obj.h_caption+obj.h_bar),0)}
			if(area_i.x==obj.x&&area_i.y==obj.y){
				area_i.x+=w_menu_button;
				area_i.w-=w_menu_button;
			}
			area_i.h=Math.min(obj.h_caption,area_i.h)
			area_i.tabs=[];
			area_i.x0_w_tabs=[];
		}
		for(var i=0;i<items.length;i++){
			var area_name=(items[i].area_name||"doc_default");
			rendered_area_by_name[area_name].tabs.push(items[i]);
			items[i].__global_tab_id=i;
		}
		var tab_label_style=UI.default_styles.tab_label;
		for(var i=0;i<rendered_areas.length;i++){
			var area_i=rendered_areas[i];
			if(!(area_i.w>0)){continue;}
			var x_caption=area_i.x;
			for(var j=0;j<area_i.tabs.length;j++){
				var tab_j=area_i.tabs[j];
				var w_j=UI.MeasureText(tab_label_style.font,tab_j.title).w+tab_label_style.padding*2;
				area_i.x0_w_tabs[j*2]=x_caption;
				area_i.x0_w_tabs[j*2+1]=w_j;
				x_caption+=w_j;
			}
		}
		//render the captions
		//todo: update layout based on dragging status
		if(obj.m_dragging_rendering_caption_areas){
			var rendering_caption_areas=obj.m_dragging_rendering_caption_areas;
			//tar-area after, src-area after potential split shade
			for(var i=0;i<rendering_caption_areas.length;i++){
				var area_i=rendering_caption_areas[i];
				if(!(area_i.w>0)){continue;}
				UI.PushCliprect(area_i.x,area_i.y,area_i.w,area_i.h);
				for(var j=0;j<area_i.tabs.length;j++){
					var tab_j=obj.items[area_i.tabs[j]];
					if(area_i.tabs[j]==obj.m_dragging_tab_src_tabid){continue;}
					W.TabLabel(tab_j.__global_tab_id,{
						x_animated:area_i.x0_w_tabs[j*2],y:area_i.y,w:area_i.x0_w_tabs[j*2+1],h:area_i.h,
						selected:tab_j==obj.active_tab,
						title:tab_j.title, tooltip:tab_j.tooltip,
						hotkey_str:tab_j.__global_tab_id<10?String.fromCharCode(48+(tab_j.__global_tab_id+1)%10):undefined,
						tabid:tab_j.__global_tab_id,owner:obj})
				}
				UI.PopCliprect();
			}
			//active (src) tab
			var tab_dragging_src=obj.items[obj.m_dragging_tab_src_tabid];
			var w_src_at_target=UI.MeasureText(tab_label_style.font,tab_dragging_src.title).w+tab_label_style.padding*2;
			W.TabLabel(tab_dragging_src.__global_tab_id,{
				x_animated:obj.m_dragging_mouse_x-obj.m_dragging_tab_x_offset,y:obj.m_dragging_mouse_y-obj.m_dragging_tab_y_offset,
				w:w_src_at_target,h:area_i.h,
				selected:tab_dragging_src==obj.active_tab,
				title:tab_dragging_src.title, tooltip:tab_dragging_src.tooltip,
				hotkey_str:tab_dragging_src.__global_tab_id<10?String.fromCharCode(48+(tab_dragging_src.__global_tab_id+1)%10):undefined,
				tabid:tab_dragging_src.__global_tab_id,owner:obj})
			//splitting shade
			if(obj.m_dragging_tab_target&&obj.m_dragging_tab_target.split_side){
				var target_position=obj.m_dragging_tab_target;
				var box=rendering_caption_areas[target_position.area_id].content_box;
				var sside=target_position.split_side;
				var box_shade=undefined
				if(sside=="left"){
					box_shade={x:box.x,y:box.y,w:box.w*0.5,h:box.h}
				}else if(sside=="right"){
					box_shade={x:box.x+box.w*0.5,y:box.y,w:box.w*0.5,h:box.h}
				}else if(sside=="up"){
					box_shade={x:box.x,y:box.y,w:box.w,h:box.h*0.5}
				}else{
					UI.assert(sside=="down");
					box_shade={x:box.x,y:box.y+box.h*0.5,w:box.w,h:box.h*0.5}
				}
				if(box_shade){
					box_shade.color=obj.bgcolor_split_shade;
					box_shade.border_width=0;
					UI.RoundRect(box_shade)
				}
			}
		}else{
			for(var pass_i=0;pass_i<2;pass_i++){
				for(var i=0;i<rendered_areas.length;i++){
					var area_i=rendered_areas[i];
					if(!(area_i.w>0)){continue;}
					UI.PushCliprect(area_i.x,area_i.y,area_i.w,area_i.h);
					for(var j=0;j<area_i.tabs.length;j++){
						var tab_j=area_i.tabs[j];
						if((tab_j==obj.active_tab)==(pass_i==1)){
							W.TabLabel(tab_j.__global_tab_id,{
								x_animated:area_i.x0_w_tabs[j*2],y:area_i.y,w:area_i.x0_w_tabs[j*2+1],h:area_i.h,
								selected:tab_j==obj.active_tab,
								title:tab_j.title, tooltip:tab_j.tooltip,
								hotkey_str:tab_j.__global_tab_id<10?String.fromCharCode(48+(tab_j.__global_tab_id+1)%10):undefined,
								tabid:tab_j.__global_tab_id,owner:obj})
						}
					}
					UI.PopCliprect();
				}
			}
			//save areas for dragging
			for(var i=0;i<rendered_areas.length;i++){
				rendered_areas[i].tabs=rendered_areas[i].tabs.map(function(a){return a.__global_tab_id});
			}
			obj.m_caption_areas=rendered_areas;
		}
		//show the active-caption as a part of the menu
		if(obj.m_is_in_menu){
			//menu *bar* goes *above* the tab labels
			UI.RoundRect({
				x:obj.x,y:obj.y,w:w_menu,h:obj.h_caption,
				color:obj.menu_bar_color,
				border_width:obj.menu_bar_border_width,
				border_color:obj.menu_bar_border_color,
			})
			var s_active_title=(obj.active_tab&&obj.active_tab.title);
			var w_menu_bar=anim.w_menu-w_menu_button;
			if(s_active_title){
				var dims=UI.MeasureText(tab_label_style.font,s_active_title)
				UI.PushCliprect(obj.x+w_menu_button,obj.y,w_menu_bar,obj.h_caption);
					W.Text("",{
						x:obj.x+w_menu_button+w_menu_bar-dims.w,y:obj.y+(obj.h_caption-dims.h)*0.5,
						font:tab_label_style.font,text:s_active_title,
						color:obj.menu_bar_caption_text_color,
					});
				UI.PopCliprect();
				w_menu_bar-=dims.w;
			}
			if(w_menu_bar>0){
				W.TopMenuBar("main_menu_bar",{x:obj.x+w_menu_button,w:w_menu_bar,y:obj.y,h:obj.h_caption,
					default_value:obj.m_menu_preselect,
					owner:obj})
			}
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
			//this doesn't count as a meaningful switch, it's in-transit
			obj.just_created_a_tab=0;
			obj.current_tab_id=num_id
			UI.Refresh()
		}});
		W.Hotkey("",{key:"CTRL+SHIFT+TAB",action:function(){
			var num_id=tabid
			if(num_id<0){return;}
			if(!num_id){num_id=items.length;}
			num_id--;
			//this doesn't count as a meaningful switch, it's in-transit
			obj.just_created_a_tab=0;
			obj.current_tab_id=num_id
			UI.Refresh()
		}});
		for(var i=0;i<items.length&&i<10;i++){
			W.Hotkey("",{key:(UI.Platform.ARCH=="mac"?"WIN+":"ALT+")+String.fromCharCode(48+(i+1)%10),action:(function(obj,i){
				obj.SetTab(i)
				UI.Refresh()
			}).bind(null,obj,i)})
		}
	}
	bk_menu=undefined;
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
			var s_text0=UI._("It's not saved yet...")
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
			var w_dlg_rect=Math.max(sz_text.w,sz_buttons.w)+obj.space_dlg_rect_x*2
			var h_dlg_rect=h_content+obj.space_dlg_rect*2
			UI.RoundRect({
				x:obj.x+(obj.w-w_dlg_rect)*0.5,y:obj.y+(obj.h-h_dlg_rect)*0.5,
				w:w_dlg_rect+obj.shadow_size*0.5,h:h_dlg_rect+obj.shadow_size*0.5,
				round:obj.shadow_size,border_width:-obj.shadow_size,color:obj.shadow_color
			})
			UI.RoundRect({x:obj.x+(obj.w-w_dlg_rect)*0.5,y:obj.y+(obj.h-h_dlg_rect)*0.5,w:w_dlg_rect,h:h_dlg_rect,
				round:obj.round_dlg_rect,border_width:obj.border_width,border_color:obj.border_color,color:obj.color_dlg_rect
			})
			W.Text("",{x:obj.x+(obj.w-sz_text.w)*0.5,y:y_text, font:obj.font_text,text:s_text0,color:obj.text_color})
			var fyes=function(){
				var darea=obj.parent
				obj.parent.SaveTab(obj.tabid)
				obj.parent.CloseTab(obj.tabid)
				obj.parent=undefined
				UI.Refresh()
				if(darea.m_is_close_pending){
					if(!UI.top.app.OnClose()){UI.DestroyWindow(UI.top.app)}
				}
			}
			var fno=function(){
				var darea=obj.parent
				obj.parent.CloseTab(obj.tabid,"forced")
				obj.parent=undefined
				UI.Refresh()
				if(darea.m_is_close_pending){
					if(!UI.top.app.OnClose()){UI.DestroyWindow(UI.top.app)}
				}
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
			W.Hotkey("",{key:"Y",action:fyes});W.Hotkey("",{key:"S",action:fyes});W.Hotkey("",{key:"RETURN",action:fyes});W.Hotkey("",{key:"SPACE",action:fyes})
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
		children.push({type:'text',icon:attrs.icon,text:attrs.text,
			color:attrs.action?style.text_color:style.hotkey_color,
			icon_color:attrs.icon=="■"||attrs.icon=="□"?style.icon_color:style.text_color,
			context_menu_group:attrs.context_menu_group,
			sel_icon_color:style.text_sel_color,
			sel_color:style.text_sel_color})
		if(attrs.action){attrs.action=WrapMenuAction(attrs.action);}
		var p_and=attrs.text.indexOf('&')
		if(p_and>=0&&attrs.action){
			//underlined hotkey
			children.push({type:'hotkey',key:attrs.text.substr(p_and+1,1).toUpperCase(),context_menu_group:attrs.context_menu_group,action:attrs.action})
			if(UI.Platform.ARCH!="mac"){
				children.push({type:'hotkey',key:"ALT+"+attrs.text.substr(p_and+1,1).toUpperCase(),context_menu_group:attrs.context_menu_group,action:attrs.action})
			}
		}
		if(attrs.key){
			children.push(
				{type:'rubber',context_menu_group:attrs.context_menu_group},
				{type:'text',context_menu_group:attrs.context_menu_group,
					text:UI.LocalizeKeyName(UI.TranslateHotkey(attrs.key)),
					color:style.hotkey_color,sel_color:style.hotkey_sel_color})
			if(attrs.enable_hotkey&&attrs.action){W.Hotkey("",{key:attrs.key,action:attrs.action})}
		}
		children.push({type:'newline',context_menu_group:attrs.context_menu_group,action:attrs.action})
	},
	//todo: selection widget - bind to some property
	AddButtonRow:function(attrs,buttons){
		var style=UI.default_styles['fancy_menu']
		var children=this.$
		children.push({type:'text',icon:attrs.icon,text:attrs.text,
			icon_color:style.text_color,
			color:style.text_color,sel_color:style.text_sel_color},{type:'rubber'})
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
					children.push({type:'hotkey',key:button_i.text.substr(p_and+1,1).toUpperCase(),action:button_i.action})
					if(UI.Platform.ARCH!="mac"){
						children.push({type:'hotkey',key:'ALT+'+button_i.text.substr(p_and+1,1).toUpperCase(),action:button_i.action})
					}
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
		//if(UI.Platform.ARCH=="mac"){
		//	name=name.replace('&','')
		//}
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
					HideMenu:function(){owner.owner.SetMenuState(0);},
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
			W.Hotkey("",{key:"ESC",action:(function(obj){obj.owner.SetMenuState(0);UI.Refresh();}).bind(null,obj)})
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
	desc=undefined;
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
		else if(IsHotkey(event,"LEFT")&&this.parent_menu_list_view){
			var list_view=this.parent_menu_list_view
			n=list_view.items.length;
			sel=(list_view.value||0)
			sel--
			if(sel<0){sel=n-1;}
			list_view.OnChange(sel)
			UI.Refresh()
		}else if(IsHotkey(event,"RIGHT")&&this.parent_menu_list_view){
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
					color:selected?item_i.sel_icon_color:item_i.icon_color})
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

//coulddo: menu search support

///////////////////////
UI.m_new_document_search_path=IO.GetNewDocumentName(undefined,undefined,"document");
UI.m_previous_document=undefined
UI.UpdateNewDocumentSearchPath=function(){
	if(!UI.m_the_document_area){return;}
	var active_document=UI.m_the_document_area.active_tab
	var ret=undefined;
	if(active_document&&active_document.file_name){
		ret=UI.GetPathFromFilename(active_document.file_name)
		UI.m_previous_document=active_document.file_name
	}else{
		ret=IO.GetNewDocumentName(undefined,undefined,"document");
		UI.m_previous_document=undefined
	}
	UI.m_new_document_search_path=ret
	return ret
}
